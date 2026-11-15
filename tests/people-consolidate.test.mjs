// 인물 기록 정리 (보조 모델 1회): 요청 자료·응답 검사·반영
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-con-'));
await build({
  entryPoints: ['src/core/people/consolidate.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/updater.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const C = await mod('consolidate');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const U = await mod('updater');

const chat = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '쟈알디가 왔다. 명단을 봤다. 팔을 다쳤다.', chatId: 'c1' }] };
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const e = (id, text, extra = {}) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, quote: '왔다', ...extra });

test('정리: 입력은 살아 있는 비고정 항목만, 칸 상한 포함; 결과는 from 으로 원본을 접거나 대체한다', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.state = [e('s1', '본부에 있음'), e('s2', '왼팔 부상'), e('s3', '피곤함'), e('s4', '고정', { pin: true }), e('s5', '취소', { void: true })];
  store.people.쟈알디.slots.history = [e('h1', '명단 사건'), e('h2', '부상')];
  const settings = { ...St.peopleSettings({}) };
  const input = C.buildConsolidate(store, chat, '쟈알디', settings);
  assert.deepEqual(input.data.slots.state.map((x) => x.id), ['s1', 's2', 's3'], '고정·취소는 안 넣음');
  assert.equal(input.data.target, Math.round(settings.personCap * 0.8));
  assert.ok(input.system.includes('in Korean'));
  const r = C.parseConsolidate('```json\n{"slots":{"state":[{"text":"본부에서 왼팔을 다친 채 피곤해함","from":["s1","s2","s3"]}],"history":[{"text":"명단 사건 뒤 부상","from":["h1"]},{"text":"x","from":["h2"]}],"scene":[{"text":"없는 칸","from":["z"]}]}}\n```');
  const live = S.liveness(chat);
  const rep = C.applyConsolidate(store, '쟈알디', input, r, live, settings);
  assert.equal(rep.slots, 1, 'state 만 반영 (history 는 입력보다 줄지 않음, scene 은 입력에 없음)');
  const state = S.liveEntries(store.people.쟈알디.slots.state, live);
  assert.deepEqual(state.map((x) => x.text).sort(), ['고정', '본부에서 왼팔을 다친 채 피곤해함'].sort());
  assert.equal(S.entryStates(store.people.쟈알디.slots.state, live).get('s1'), 'replaced');
  assert.ok(rep.dropped.some((d) => d.slot === 'history') && rep.dropped.some((d) => d.slot === 'scene'));
  // 하나에서 온 결과는 대체 (되살릴 수 있음)
  const store2 = T.emptyStore();
  store2.people.쟈알디 = person('쟈알디');
  store2.people.쟈알디.slots.threads = [e('t1', '재조사 약속'), e('t2', '커피 약속'), e('t3', '보고서')];
  const in2 = C.buildConsolidate(store2, chat, '쟈알디', settings);
  C.applyConsolidate(store2, '쟈알디', in2, { slots: { threads: [{ text: '재조사·커피 약속', from: ['t1', 't2'] }, { text: '보고서 제출', from: ['t3'] }] } }, live, settings);
  const st = S.entryStates(store2.people.쟈알디.slots.threads, live);
  assert.equal(st.get('t1'), 'replaced');
  assert.equal(st.get('t3'), 'replaced');
  assert.equal(S.liveEntries(store2.people.쟈알디.slots.threads, live).length, 2);
});

test('설정: 기록 언어 영어면 지침 끝에 언어 규칙, 저장 10,000자·본편 16,000자·정리는 같은 호출', () => {
  const s = St.peopleSettings({});
  assert.equal(s.lang, 'ko');
  assert.equal(s.personCap, 10000);
  assert.equal(s.blockCap, 16000);
  assert.equal(s.tidy, 'same');
  const out = U.assemblePrompt('A <<USER_RULES>> B', new Set(), '', 'en');
  assert.ok(out.includes('## Record language') && out.includes('in English'));
  assert.ok(!U.assemblePrompt('A <<USER_RULES>> B', new Set(), '', 'ko').includes('Record language'));
  assert.ok(C.CONSOLIDATE_PROMPT('en').includes('in English'));
});

test('정리: 수치 모드 의심 칸은 정리 자료에 넣지 않고, 모델이 돌려줘도 반영하지 않는다 (종류·점수 보존)', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.state = [e('s1', '본부에 있음'), e('s2', '왼팔 부상')];
  store.people.쟈알디.slots.suspicion = [
    e('q1', '[시작] 명단을 몰래 봄', { target: '@user', kind: '배신' }),
    e('q2', '[단서·중] 밤에 자료실 출입', { target: '@user', kind: '배신', seq: 2 }),
  ];
  const settings = { ...St.peopleSettings({}), features: new Set(['suspicion']), qualitative: new Set() };
  assert.ok(T.slotsFor(settings.features, settings.qualitative).includes('suspicion'), '수치 모드에서 의심 칸이 켜져 있음');
  const live = S.liveness(chat);
  const before = JSON.stringify(U.suspicionCases(store.people.쟈알디, live));
  const input = C.buildConsolidate(store, chat, '쟈알디', settings);
  assert.equal(input.data.slots.suspicion, undefined, '의심 칸은 입력에 없음');
  assert.ok(![...input.ids.keys()].some((id) => id === 'q1' || id === 'q2'));
  const r = C.parseConsolidate('{"slots":{"suspicion":[{"text":"[시작] 명단을 몰래 보고 밤에 자료실 출입","target":"@user","from":["q1","q2"]}]}}');
  const rep = C.applyConsolidate(store, '쟈알디', input, r, live, settings);
  assert.equal(rep.slots, 0);
  assert.deepEqual(S.liveEntries(store.people.쟈알디.slots.suspicion, live).map((x) => x.id), ['q1', 'q2']);
  assert.equal(JSON.stringify(U.suspicionCases(store.people.쟈알디, live)), before, '사례(종류·점수) 그대로');
  // 의심 칸만 있으면 정리할 것이 없다
  delete store.people.쟈알디.slots.state;
  assert.equal(C.buildConsolidate(store, chat, '쟈알디', settings), null);
});

// 토큰 점검 (11-15): 정리 지침의 칸 설명은 자료에 실린 칸만, 별도 정리 호출은 같은 항목들로 다시 부르지 않는다
test('정리 지침: 자료에 없는 칸(빈 칸·첫인상·수치 의심)의 설명은 싣지 않는다', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.state = [e('s1', '본부에 있음'), e('s2', '왼팔 부상')];
  store.people.쟈알디.slots['affinity.appraisal'] = [e('a1', '첫인상', { target: '@user' })];
  store.people.쟈알디.slots.suspicion = [e('u1', '[+1] 단서', { target: '@user', kind: '거짓말' })];
  const settings = St.peopleSettings({ $pp_num_suspicion: '1' });
  const input = C.buildConsolidate(store, chat, '쟈알디', settings);
  assert.deepEqual(Object.keys(input.data.slots), ['state']);
  assert.equal(input.system, C.CONSOLIDATE_PROMPT(settings.lang, ['state']));
  assert.ok(input.system.includes('state = '));
  for (const s of ['history = ', 'affinity.appraisal = ', 'suspicion = ', 'knowledge = ']) assert.ok(!input.system.includes(s), s);
  assert.ok(C.CONSOLIDATE_PROMPT(settings.lang, T.slotsFor(settings.features, settings.qualitative)).includes('history = '), '전에는 켜진 칸 전부의 설명이 실렸다');
});

test('별도 정리: 상한을 넘긴 인물만, 같은 항목들로 이미 불렀으면 다시 부르지 않고 항목이 달라지면 다시 부른다', () => {
  const store = T.emptyStore();
  const long = (id) => e(id, `${id} ` + '가'.repeat(280));
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.history = Array.from({ length: 10 }, (_, i) => long(`h${i}`));
  store.people.나루 = person('나루');
  store.people.나루.slots.history = [long('n1')];
  // 정리할 수 없는 항목(고정)만으로 상한을 넘긴 인물: 정리 자료가 없어 부르지 않는다
  store.people.도윤 = person('도윤');
  store.people.도윤.slots.history = Array.from({ length: 10 }, (_, i) => ({ ...long(`p${i}`), pin: true }));
  const settings = St.peopleSettings({ $pp_person_cap: '2000', $pp_tidy: 'separate' });
  const tried = new Map();
  const due = C.tidyDue(store, chat, settings, tried);
  assert.deepEqual(due.map((d) => d.name), ['쟈알디']);
  // 불렀는데 결과가 줄지 않아 그대로인 경우: 같은 입력이라 다음 턴에는 부르지 않는다
  tried.set(due[0].name, due[0].key);
  assert.deepEqual(C.tidyDue(store, chat, settings, tried), []);
  // 새 항목이 생기면 입력이 달라져 다시 부른다
  store.people.쟈알디.slots.history.push(long('h10'));
  assert.deepEqual(C.tidyDue(store, chat, settings, tried).map((d) => d.name), ['쟈알디']);
  // 정리가 반영되면(항목이 합쳐지면) 상한 아래로 내려가 대상에서 빠진다
  const input = C.buildConsolidate(store, chat, '쟈알디', settings);
  C.applyConsolidate(store, '쟈알디', input, { slots: { history: [{ text: '합친 기록', from: [...input.ids.keys()] }] } }, S.liveness(chat), settings);
  assert.deepEqual(C.tidyDue(store, chat, settings, tried), []);
});
