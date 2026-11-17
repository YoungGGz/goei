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

test('저장 정리: 사라진 응답의 줄은 버리고 지난 줄은 최근 60개만 (2026-11-17)', () => {
  const c = chatOf(100);
  const store = T.emptyStore();
  store.people['쟈알디'] = person('쟈알디');
  const list = (store.people['쟈알디'].slots.state = []);
  // 응답마다 앞 줄을 고친 줄 100개: 살아 있는 것 1, 지난 줄 99
  for (let i = 1; i <= 100; i++) list.push(entry(`e${i}`, `상태 ${i}`, `c${i}`, i > 1 ? { replaces: `e${i - 1}` } : {}));
  list.push(entry('gone', '다시 굴린 응답의 줄', 'c999'));
  list.push(entry('mine', '직접 적은 줄', 'c998', { src: 'manual' }));
  // 진행 중인 떡밥의 지난 줄은 남긴다
  store.docs['rhythm:hook:편지'] = { type: 'rhythm', key: 'hook:편지', entries: [entry('h1', '[stage:seeded] [tier:long] 편지', 'c1'), entry('h2', '[stage:hinted] [tier:long] 봉투', 'c2', { replaces: 'h1' })] };
  const n = P.pruneEntries(store, c);
  const ids = store.people['쟈알디'].slots.state.map((e) => e.id);
  assert.ok(!ids.includes('gone'), '사라진 응답의 줄은 버림');
  assert.ok(ids.includes('e100') && ids.includes('e40') && !ids.includes('e39'), '살아 있는 줄 + 최근에 밀려난 지난 줄 60개');
  assert.equal(ids.length, 1 + P.HISTORY_KEEP);
  assert.ok(!ids.includes('mine'), '직접 적은 줄은 ①에서는 남지만, 죽은 줄이라 ②에서 가장 오래된 것으로 밀려남');
  assert.equal(store.docs['rhythm:hook:편지'].entries.length, 2);
  assert.equal(n, 1 + 40);
  assert.deepEqual(S.liveEntries(store.people['쟈알디'].slots.state, S.liveness(c)).map((e) => e.id), ['e100']);
  assert.equal(P.pruneEntries(store, c), 0, '다시 불러도 더 버리지 않음');
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
