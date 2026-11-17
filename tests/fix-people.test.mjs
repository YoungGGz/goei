// 전수검사 11-13: 훅 심은 턴(진전 뒤), 호감 단계 일치(본편·Director·갱신기), 계기 자료 이름만
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-fix-people-'));
await build({
  entryPoints: ['src/core/people/rhythm.ts', 'src/core/people/updater.ts', 'src/core/people/director.ts', 'src/core/people/request.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/affinity.ts', 'src/core/people/base.ts', 'src/core/people/prune.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const Rh = await mod('rhythm');
const U = await mod('updater');
const D = await mod('director');
const R = await mod('request');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const A = await mod('affinity');
const B = await mod('base');
const P = await mod('prune');

const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chatOf = (n, who = '쟈알디') => ({ message: Array.from({ length: n * 2 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: i % 2 ? `${who}가 ${(i + 1) / 2}번째로 말했다.` : `입력 ${i / 2 + 1}`, chatId: i % 2 ? `c${(i + 1) / 2}` : `u${i / 2 + 1}` })) });
const entry = (id, text, anchor, extra = {}) => ({ id, text, src: 'story', anchor, seq: 1, quote: '말했다', ...extra });

test('훅 시계: 진전(replaces)해도 심은 턴은 처음 심은 턴', () => {
  const c = chatOf(10);
  const live = S.liveness(c);
  const store = T.emptyStore();
  store.docs['rhythm:hook:편지'] = { type: 'rhythm', key: 'hook:편지', entries: [entry('h1', '[stage:seeded] [tier:mid] 편지', 'c2'), entry('h2', '[stage:hinted] [tier:mid] 봉투', 'c9', { replaces: 'h1' })] };
  const k = Rh.rhythmClock(store, c, live);
  const h = k.hooks.find((x) => x.key === 'hook:편지');
  assert.equal(h.planted, 2);
  assert.equal(h.age, 8);
  assert.equal(h.last, 9);
  assert.equal(h.sinceLast, 1);
  assert.equal(h.due, true);
  assert.equal(k.lastPlant, 2);
  assert.equal(k.plantAllowed, true, '진전만으로는 새 훅 간격이 막히지 않음');
  // 처음 항목이 취소되면 다음 살아 있는 사슬 항목 기준
  store.docs['rhythm:hook:편지'].entries[0].void = true;
  const k2 = Rh.rhythmClock(store, c, live);
  assert.equal(k2.hooks.find((x) => x.key === 'hook:편지').planted, 9);
});

test('리듬: 끝난 떡밥은 요청에 싣지 않고, 같은 이름으로 다시 심으면 새로 센다 (2026-11-17)', () => {
  const c = chatOf(10);
  const live = S.liveness(c);
  const store = T.emptyStore();
  store.docs['rhythm:scene'] = { type: 'rhythm', key: 'scene', entries: [entry('s1', '[phase:build_up] [engagement:active] 긴장', 'c8')] };
  store.docs['rhythm:hook:편지'] = { type: 'rhythm', key: 'hook:편지', entries: [entry('h1', '[stage:seeded] [tier:short] 편지', 'c1'), entry('h2', '[stage:resolved] [tier:short] 편지를 읽음', 'c4', { replaces: 'h1' })] };
  store.docs['rhythm:hook:열쇠'] = { type: 'rhythm', key: 'hook:열쇠', entries: [entry('k1', '[stage:hinted] [tier:mid] 열쇠', 'c6')] };
  assert.deepEqual(Rh.rhythmNow(store, live).map((r) => r.doc.key), ['scene', 'hook:열쇠']);
  const settings = St.peopleSettings({ $pp_director: 'note', $pp_rhythm: '1' });
  assert.deepEqual(U.docsNow(store, live, settings, [], []).map((d) => d.key), ['scene', 'hook:열쇠']);
  // 끝난 떡밥 이름으로 다시 심음: 심은 턴은 새 줄부터
  store.docs['rhythm:hook:편지'].entries.push(entry('h3', '[stage:seeded] [tier:short] 두 번째 편지', 'c9', { replaces: 'h2' }));
  const h = Rh.rhythmClock(store, c, live).hooks.find((x) => x.key === 'hook:편지');
  assert.equal(h.planted, 9);
  assert.ok(Rh.rhythmNow(store, live).some((r) => r.doc.key === 'hook:편지'));
});

test('저장 정리: 사라진 응답의 줄은 버리고, 지난 줄은 밀려난 때가 뒤쪽 200 메시지 밖이면 버린다 (2026-11-17)', () => {
  const c = chatOf(150); // 메시지 300개: 경계 = 위치 100 (c50 의 위치 99 까지가 밖)
  const store = T.emptyStore();
  store.people['쟈알디'] = person('쟈알디');
  const list = (store.people['쟈알디'].slots.state = []);
  // 응답마다 앞 줄을 고친 줄 150개: 살아 있는 것 1, 지난 줄 149
  for (let i = 1; i <= 150; i++) list.push(entry(`e${i}`, `상태 ${i}`, `c${i}`, i > 1 ? { replaces: `e${i - 1}` } : {}));
  list.push(entry('gone', '다시 굴린 응답의 줄', 'c999'));
  // 진행 중인 떡밥의 지난 줄은 남긴다, 끝난 떡밥은 같은 규칙으로 버린다
  store.docs['rhythm:hook:편지'] = { type: 'rhythm', key: 'hook:편지', entries: [entry('h1', '[stage:seeded] [tier:long] 편지', 'c1'), entry('h2', '[stage:hinted] [tier:long] 봉투', 'c2', { replaces: 'h1' })] };
  store.docs['rhythm:hook:열쇠'] = { type: 'rhythm', key: 'hook:열쇠', entries: [entry('k1', '[stage:seeded] [tier:short] 열쇠', 'c1'), entry('k2', '[stage:resolved] [tier:short] 열쇠를 찾음', 'c3', { replaces: 'k1' })] };
  // 정리 줄(기준 '#0')이 a 를 합치고, a 는 예전에 z 를 고쳤다: a 만 지워져 z 가 되살아나면 안 된다
  const hist = (store.people['쟈알디'].slots.history = []);
  hist.push(entry('z', '옛 행적', 'c120'), entry('a', '고친 행적', 'c140', { replaces: 'z' }), { ...entry('M', '합친 행적', '#0', { replaces: 'a' }), quote: undefined });
  const n = P.pruneEntries(store, c);
  const ids = store.people['쟈알디'].slots.state.map((e) => e.id);
  assert.ok(!ids.includes('gone'), '사라진 응답의 줄은 버림');
  // e_i 가 밀려난 때 = c_(i+1) 의 위치 2i+1. 100 보다 작으면 버림 → e1..e49 버림, e50 부터 남음
  assert.ok(ids.includes('e150') && ids.includes('e50') && !ids.includes('e49'));
  assert.equal(store.docs['rhythm:hook:편지'].entries.length, 2);
  assert.deepEqual(store.docs['rhythm:hook:열쇠'].entries.map((e) => e.id), ['k2']);
  assert.deepEqual(hist.length, 3, '최근에 밀려난 줄은 사슬째 남는다');
  const live = S.liveness(c);
  assert.deepEqual(S.liveEntries(store.people['쟈알디'].slots.history, live).map((e) => e.id), ['M']);
  assert.deepEqual(S.liveEntries(store.people['쟈알디'].slots.state, live).map((e) => e.id), ['e150']);
  assert.equal(n, 1 + 49 + 1);
  assert.equal(P.pruneEntries(store, c), 0, '다시 불러도 더 버리지 않음');
  // 오래된 사슬: a 가 경계 밖이면 a 와 z 를 같이 버린다 (z 만 남아 되살아나지 않는다)
  const s2 = T.emptyStore();
  s2.people['쟈알디'] = person('쟈알디');
  s2.people['쟈알디'].slots.history = [entry('z', '옛 행적', 'c10'), entry('a', '고친 행적', 'c20', { replaces: 'z' }), { ...entry('M', '합친 행적', '#0', { replaces: 'a' }), quote: undefined }];
  P.pruneEntries(s2, c);
  assert.deepEqual(s2.people['쟈알디'].slots.history.map((e) => e.id), ['M']);
});

test('리듬: 문서 연산 remove 로 닫은 떡밥은 끝난 단계로 적히고, 리듬 문서는 열쇠마다 줄 하나 (2026-11-17)', () => {
  assert.equal(Rh.retireHookText('[stage:hinted] [tier:short] 편지'), '[stage:retired] [tier:short] 편지');
  assert.equal(Rh.retireHookText('표식 없음'), null);
  const c = chatOf(10);
  const live = S.liveness(c);
  const store = T.emptyStore();
  // 예전 저장: 「(해소)」가 붙어 머리가 안 읽히는 떡밥 줄은 싣지 않는다
  store.docs['rhythm:hook:옛것'] = { type: 'rhythm', key: 'hook:옛것', entries: [entry('o1', '(해소) [stage:seeded] [tier:short] 옛것', 'c2')] };
  assert.deepEqual(Rh.rhythmNow(store, live), []);
});

test('저장 정리: 등록 대기 이름은 근거 응답이 뒤쪽 200 메시지 밖이면 버린다 (확인 뒤 등록은 그대로) (2026-11-17)', () => {
  const c = chatOf(150);
  const mk = () => { const s = T.emptyStore(); s.pending = { 옛이름: { anchor: 'c10', aliases: [] }, 새이름: { anchor: 'c140', aliases: [] }, 사라짐: { anchor: 'gone', aliases: [] } }; return s; };
  const a = mk(); S.prunePending(a, c, true);
  assert.deepEqual(Object.keys(a.pending), ['새이름']);
  const b = mk(); S.prunePending(b, c);
  assert.deepEqual(Object.keys(b.pending), ['옛이름', '새이름']);
});

test('저장 정리: 다음 턴 메모는 최근 응답 20개 것만 남긴다 (2026-11-17)', () => {
  const c = chatOf(30);
  const store = T.emptyStore();
  for (let k = 1; k <= 30; k++) {
    store.log.push({ id: `n${k}`, anchor: `c${k}`, seq: 0, src: 'story', who: '쟈알디', kind: 'note', now: `memo ${k}`, reason: '다음 턴 메모' });
    store.log.push({ id: `q${k}`, anchor: `c${k}`, seq: 1, src: 'story', who: '쟈알디', kind: 'cue', cue: '헌신', reason: 'r' });
  }
  assert.equal(P.pruneNotes(store, c), 10);
  assert.deepEqual(store.log.filter((x) => x.kind === 'note').map((x) => x.id), Array.from({ length: 20 }, (_, i) => `n${i + 11}`));
  assert.equal(store.log.filter((x) => x.kind === 'cue').length, 30, '호감 계기는 그대로');
  assert.equal(U.latestNote(store, '쟈알디', S.liveness(c)).now, 'memo 30');
});

test('호감 단계: Director·갱신기도 성격 계수(temper)를 본편과 같이 쓴다', () => {
  const name = '게슈간';
  assert.notEqual(B.temperOf(name)?.open ?? 1, 1, '시험 인물은 temper 가 1이 아니어야');
  const c = chatOf(12, name);
  const live = S.liveness(c);
  const store = T.emptyStore();
  store.people[name] = person(name);
  for (let k = 1; k <= 12; k++) store.log.push({ id: `cue${k}`, anchor: `c${k}`, seq: 0, src: 'story', who: name, kind: 'cue', cue: '헌신', reason: 'r' });
  const settings = St.peopleSettings({ $pp_director: 'scene', $pp_rhythm: '0' });
  const changes = S.liveChanges(store, live);
  const want = A.affinityView(store.people[name], changes, 0, { temper: B.temperOf(name), speed: settings.speed, speedDown: settings.speedDown, turnCap: settings.turnCap }).stage;
  const plain = A.affinityView(store.people[name], changes, 0, { turnCap: settings.turnCap }).stage;
  assert.notEqual(want.label, plain.label, '계수 유무로 단계가 갈리는 경우');
  const dir = D.buildDirector(c, store, [name], '입력', settings, {});
  assert.equal(dir.data.people[0].affinity, want.label);
  const input = U.buildUpdate(c, store, [23], { settings, system: 'S', values: {}, names: [{ name, aliases: [], titles: [] }], only: [name] });
  const p = input.data.people.find((x) => x.name === name);
  assert.equal(p.affinity_now, `${want.label}(${want.max})`);
  const main = R.peopleBlockFor(c, { settings, store, sheetOf: () => null, temperOf: B.temperOf, people: [name] });
  assert.ok(main.text.includes(want.label), '본편 블록도 같은 단계');
});

test('갱신기 자료 cues: 계기 이름만 (뜻은 지침 표)', () => {
  const c = chatOf(2);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [3], { settings: St.peopleSettings({}), system: 'S', values: {}, names: [{ name: '쟈알디', aliases: [], titles: [] }] });
  assert.deepEqual(input.data.cues, [...T.CUES]);
});
