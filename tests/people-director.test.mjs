// 연출형 Director: 기능별 지침(C)·2차 검색(B)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-dir-'));
await build({
  entryPoints: ['src/core/people/director.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const D = await mod('director');
const T = await mod('types');
const St = await mod('settings');

const settings = (state = {}) => St.peopleSettings({ $pp_director: 'scene', $pp_rhythm: '0', ...state });
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const c = chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 말했다. "명일 아파트 건은 네가 맡아."', 'c1'], ['user', '알겠다고 했다', 'u2'], ['char', '쟈알디가 서류를 건넸다.', 'c2']);

test('기능별 지침: 켜진 기능의 절과 전용 칸만, 끄면 기본 지침만', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots['register.context'] = [{ id: 'e1', text: '사무실에선 요원님, 둘이면 너', src: 'story', anchor: 'c1', seq: 1, target: '@user', quote: '명일' }];
  const b = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', settings(), { 쟈알디: '규칙' });
  assert.ok(b.system.includes('## Affinity and taste') && b.system.includes('## Address and speech register') && b.system.includes('## Personality axes'));
  assert.ok(!b.system.includes('## Openness') && !b.system.includes('## Narrative rhythm'), '꺼진 기능 절은 없음');
  assert.ok(b.system.includes('Missing material'));
  assert.equal(b.data.people[0].slots['register.context'][0].text, '사무실에선 요원님, 둘이면 너');
  assert.equal(b.data.people[0].axes.length, 6);
  assert.equal(b.data.people[0].affinity, '무관심');
  const plain = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', settings({ $pp_director_features: '0', $pp_director_search: '0' }), {});
  assert.ok(!plain.system.includes('## Affinity and taste') && !plain.system.includes('Missing material'));
  assert.equal(plain.data.people[0].slots, undefined);
  assert.equal(plain.data.people[0].axes, undefined);
  // 정성 모드면 단계 없음
  const q = D.buildDirector(c, store, ['쟈알디'], 'x', settings({ $pp_num_affinity: '0' }), {});
  assert.equal(q.data.people[0].affinity, undefined);
});

test('2차 검색: need → 코드 검색(채팅·로어북·위키) → found 를 얹은 2차 자료, 2차에서는 need 거부', () => {
  const r = D.parseDirectorAny('{"need":[{"kind":"chat","query":"명일 아파트","reason":"어떤 건인지"},{"kind":"lore","query":"명일","reason":"x"},{"kind":"wiki","query":"쟈알디"},{"kind":"nope","query":"x"},{"kind":"chat","query":"명일 아파트"}]}', ['쟈알디'], true, true);
  assert.ok('need' in r);
  assert.deepEqual(r.need.map((n) => n.kind), ['chat', 'lore', 'wiki']);
  assert.throws(() => D.parseDirectorAny('{"need":[{"kind":"chat","query":"x"}]}', ['쟈알디'], true, false), /2차/);
  const lore = [{ comment: '명일 아파트', key: '명일,아파트', content: '재개발이 멈춘 아파트. 지하에 뭔가 있다.' }, { comment: '다른', key: 'z', content: 'zzz' }];
  const found = D.runSearches(r.need, { chat: c, lore });
  assert.equal(found[0].hits.length, 1, '마지막 메시지(답하지 않은 입력)는 빼고 그 전 메시지에서 찾음');
  assert.equal(found[0].hits[0].ref, 'm#2');
  assert.ok(found[0].hits[0].text.includes('명일 아파트'));
  assert.equal(found[1].hits[0].ref, 'lore:명일 아파트');
  assert.equal(found[2].hits.length, 0);
  const built = { system: 'SYS', data: { people: [] }, key: 'k', people: ['쟈알디'], search: true };
  const p2 = D.buildDirectorPass2(built, found);
  assert.ok(p2.system.includes('second pass') && p2.data.found === found && p2.search === false);
  const notes = D.parseDirectorAny('{"notes":[{"who":"쟈알디","now":"서류를 넘김","react":"짧게 확인","must_not_reveal":["지하"]}]}', ['쟈알디'], true, false);
  assert.deepEqual(notes.notes, [{ who: '쟈알디', now: '서류를 넘김', react: '짧게 확인', mustNot: ['지하'] }]);
  assert.equal(D.parseDirector('{"notes":[]}', ['쟈알디'], true).length, 0);
});

test('요청 자료: 기록은 record 전문 한 번만, 꼬리 칸(state·threads·knowledge·suspicion)은 싣지 않는다. 재사용 열쇠는 그대로 꼬리를 본다 (gupdp#1)', () => {
  const e = (id, text, extra = {}) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, ...extra });
  const mk = (state, threads) => {
    const store = T.emptyStore();
    store.people.쟈알디 = person('쟈알디');
    store.people.쟈알디.slots.state = [e('s1', state)];
    store.people.쟈알디.slots.threads = [e('t1', threads)];
    store.people.쟈알디.slots.knowledge = [e('k1', '명일 아파트 지하의 소문을 들었다')];
    store.people.쟈알디.slots.suspicion = [e('u1', '요원이 보고서를 고쳤다고 의심', { target: '@user' })];
    return store;
  };
  const st = settings({ $pp_suspicion: '1' });
  const b = D.buildDirector(c, mk('서류 더미에 파묻혀 있다', '아파트 건 보고를 기다린다'), ['쟈알디'], '서류를 받았다', st, {});
  const p = b.data.people[0];
  for (const k of ['state', 'threads', 'knowledge', 'suspicion']) assert.equal(p[k], undefined, `${k} 꼬리 칸 없음`);
  for (const t of ['서류 더미에 파묻혀 있다', '아파트 건 보고를 기다린다', '명일 아파트 지하의 소문을 들었다']) {
    assert.ok(p.record.includes(t), 'record 전문에는 있음');
    assert.equal(JSON.stringify(b.data).split(t).length - 1, 1, `자료에 한 번만: ${t}`);
  }
  // 열쇠: 같은 기록이면 같고, 상태·미해결이 바뀌면 달라진다
  assert.equal(D.buildDirector(c, mk('서류 더미에 파묻혀 있다', '아파트 건 보고를 기다린다'), ['쟈알디'], '서류를 받았다', st, {}).key, b.key);
  assert.notEqual(D.buildDirector(c, mk('자리를 비웠다', '아파트 건 보고를 기다린다'), ['쟈알디'], '서류를 받았다', st, {}).key, b.key);
  assert.notEqual(D.buildDirector(c, mk('서류 더미에 파묻혀 있다', '다른 건'), ['쟈알디'], '서류를 받았다', st, {}).key, b.key);
});

test('자료가 없는 기능 절(의심·리듬·성적)은 붙이지 않고, 자료가 실리면 붙인다 (11-14 재검토 gtoken#5)', () => {
  const on = settings({ $pp_suspicion: '1', $pp_rhythm: '1', $pp_axes: '1', $pp_sexual_desire: '1', $pp_paraphilia: '1' });
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const empty = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(!empty.system.includes('## Suspicion'), '의심 칸이 비면 의심 절 없음');
  assert.ok(!empty.system.includes('## Narrative rhythm'), '리듬 기록이 없으면 리듬 절 없음');
  assert.ok(!/sexual_context_only/.test(empty.system), '성적 글이 없으면 성적 절 없음');
  assert.ok(empty.system.includes('## Personality axes') && empty.system.includes('## Affinity and taste'), '다른 절은 그대로');
  assert.equal(empty.data.rhythm, undefined);
  assert.equal(empty.data.people[0].slots, undefined);
  // 자료가 실리면 그 절이 붙는다
  // 의심은 기본이 정성 모드(suspicion.* 칸), 수치를 켜면 suspicion 칸. 그 모드에서 실리는 칸에 글이 있어야 한다
  const num = settings({ $pp_suspicion: '1', $pp_num_suspicion: '1' });
  store.people.쟈알디.slots.suspicion = [{ id: 'su1', text: '[시작] 서류 날짜가 맞지 않는다', src: 'story', anchor: 'c1', seq: 1, target: '@user', quote: '명일' }];
  assert.ok(!D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' }).system.includes('## Suspicion'), '정성 모드에서는 수치 칸이 실리지 않으니 절도 없음');
  const sn = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', num, { 쟈알디: '' });
  assert.ok(sn.data.people[0].slots.suspicion.length === 1 && sn.system.includes('## Suspicion'));
  store.people.쟈알디.slots['suspicion.concern'] = [{ id: 'su3', text: '서류 날짜가 맞지 않는다', src: 'story', anchor: 'c1', seq: 2, target: '@user', quote: '명일' }];
  const sus = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(sus.data.people[0].slots['suspicion.concern'].length === 1 && sus.system.includes('## Suspicion'));
  assert.ok(!sus.system.includes('## Narrative rhythm') && !/sexual_context_only/.test(sus.system));
  store.docs['rhythm:hook:서류'] = { type: 'rhythm', key: 'hook:서류', entries: [{ id: 'h1', text: '[stage:seeded] [tier:mid] 서류', src: 'story', anchor: 'c1', seq: 1 }] };
  const rh = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(rh.data.rhythm.length === 1 && rh.system.includes('## Narrative rhythm'));
  store.people.쟈알디.sexual = { desire: { text: '직설적이다', at: 'T' }, paraphilia: { text: '', at: '' }, desireOn: true, paraphiliaOn: true, explicit: null };
  const sx = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(sx.data.people[0].sexual_desire && /sexual_context_only fields/.test(sx.system));
  // 지워진 메시지에 닻을 둔 의심 기록은 자료가 아니다
  const gone = T.emptyStore();
  gone.people.쟈알디 = person('쟈알디');
  gone.people.쟈알디.slots['suspicion.concern'] = [{ id: 'su2', text: 'x', src: 'story', anchor: 'zz', seq: 1, target: '@user', quote: 'x' }];
  assert.ok(!D.buildDirector(c, gone, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' }).system.includes('## Suspicion'));
});

// 토큰 점검 (11-15): 기능 전용 칸은 `slots` 에만 싣고 `record` 에서는 뺀다 (같은 글이 두 번 나가지 않게)
test('기능별 지침: 전용 칸의 글은 slots 에 전부 한 번만, record 에는 기본 칸만', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const e = (id, text, extra = {}) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, quote: '명일', ...extra });
  store.people.쟈알디.slots['register.context'] = Array.from({ length: 6 }, (_, i) => e(`r${i}`, `호칭 조건 ${i}번`, { target: '@user' }));
  store.people.쟈알디.slots['suspicion.concern'] = [e('q1', '정성 의심 내용', { target: '@user' })];
  store.people.쟈알디.slots.state = [e('s1', '사무실에 있음')];
  const count = (t, w) => t.split(w).length - 1;
  const on = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', settings(), {}).data;
  const text = JSON.stringify(on);
  for (let i = 0; i < 6; i++) assert.equal(count(text, `호칭 조건 ${i}번`), 1, `항목 ${i}: 한 번만`);
  assert.equal(on.people[0].slots['register.context'].length, 6, '최근 몇 개가 아니라 살아 있는 항목 전부');
  assert.equal(count(text, '정성 의심 내용'), 1);
  assert.doesNotMatch(on.people[0].record, /호칭 조건|정성 의심 내용|Address and relationship stage/);
  assert.match(on.people[0].record, /Current state:\n- 사무실에 있음/, '기본 칸은 record 에 그대로');
  // 수치 의심 칸: slots 에 종류(kind)까지, record 에는 없음
  store.people.쟈알디.slots.suspicion = [e('u1', '[+2] 서류가 바뀌어 있었다', { target: '@user', kind: '거짓말' })];
  const num = D.buildDirector(c, store, ['쟈알디'], 'x', settings({ $pp_num_suspicion: '1' }), {}).data;
  assert.deepEqual(num.people[0].slots.suspicion, [{ text: '[+2] 서류가 바뀌어 있었다', target: '@user', kind: '거짓말' }]);
  assert.equal(count(JSON.stringify(num), '서류가 바뀌어 있었다'), 1);
  // 기능별 지침을 끄면 slots 가 없으니 record 가 전용 칸을 싣는다 (전과 같음)
  const off = D.buildDirector(c, store, ['쟈알디'], 'x', settings({ $pp_director_features: '0' }), {}).data;
  assert.equal(off.people[0].slots, undefined);
  assert.equal(count(off.people[0].record, '호칭 조건 3번'), 1);
});

test('기능별 지침: record 의 글자 몫은 slots 에 실은 글자만큼 줄어, 둘을 합쳐도 record 가 전용 칸을 싣던 때보다 크지 않다', () => {
  const store = T.emptyStore();
  const e = (id, text, extra = {}) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, quote: '명일', ...extra });
  for (const n of ['쟈알디', '나루']) {
    store.people[n] = person(n);
    store.people[n].slots.history = Array.from({ length: 40 }, (_, i) => e(`${n}h${i}`, `지난 일 ${i} ` + '가'.repeat(290)));
    store.people[n].slots['register.context'] = Array.from({ length: 16 }, (_, i) => e(`${n}r${i}`, `호칭 ${i} ` + '나'.repeat(290), { target: '@user' }));
  }
  const s = (v = {}) => settings({ $pp_block_cap: '16000', ...v });
  const on = D.buildDirector(c, store, ['쟈알디', '나루'], 'x', s(), {}).data.people[0];
  const off = D.buildDirector(c, store, ['쟈알디', '나루'], 'x', s({ $pp_director_features: '0' }), {}).data.people[0];
  const slotChars = Object.values(on.slots).flat().reduce((m, x) => m + x.text.length + 3, 0);
  assert.equal(on.slots['register.context'].length, 16, 'slots 는 살아 있는 항목 전부');
  assert.ok(on.record.length + slotChars <= off.record.length, `record ${on.record.length} + slots ${slotChars} ≤ 전용 칸을 싣던 record ${off.record.length}`);
  const hist = (t) => (t.match(/지난 일 \d+/g) ?? []).join(',');
  assert.equal(hist(on.record), hist(off.record), '지난 일은 전과 같은 만큼 남는다');
});
