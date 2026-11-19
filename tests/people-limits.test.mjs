// 인물 기록의 수 상한 설정: 기본값은 예전에 코드에 박혀 있던 값, 설정을 바꾸면 그 수로, 잘못된 값은 기본값·끝 값
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-limits-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/axes.ts', 'src/core/people/select.ts', 'src/core/people/router.ts', 'src/core/people/inject.ts', 'src/core/setdef/people.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/${n}.mjs`)));
const U = await mod('people/updater');
const S = await mod('people/store');
const T = await mod('people/types');
const St = await mod('people/settings');
const X = await mod('people/axes');
const Sel = await mod('people/select');
const Ro = await mod('people/router');
const Inj = await mod('people/inject');
const Def = await mod('setdef/people');
// 갱신 기록(진단)은 기기 저장소를 쓴다: 호스트 쪽은 한 묶음으로 만들어 설정(core/settings)을 같이 쓴다
const hostFile = join(dir, 'host.mjs');
await build({ stdin: { contents: "export * as H from './src/host/people';\nexport * as Set from './src/core/settings';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile: hostFile, logLevel: 'silent' });
const { H, Set: Prefs } = await import(pathToFileURL(hostFile));

const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {}, ...extra });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const NAMES = ['가람', '나래', '다온', '라온', '마루', '바다', '사랑', '아름'];

test('기본값은 예전 값 그대로, 잘못된 값은 기본값, 범위 밖은 끝 값', () => {
  const s = St.peopleSettings({});
  assert.deepEqual([s.patternsCap, s.evidenceCap, s.sceneMax, s.batchTurns, s.observedMax, s.unknownMax], [30, 40, 6, 6, 4, 5]);
  const bad = St.peopleSettings({ $pp_patterns_cap: 'abc', $pp_evidence_cap: '', $pp_scene_max: 'null', $pp_batch_turns: 'x', $pp_observed_max: '-', $pp_unknown_max: 'NaN' });
  assert.deepEqual([bad.patternsCap, bad.evidenceCap, bad.sceneMax, bad.batchTurns, bad.observedMax, bad.unknownMax], [30, 40, 6, 6, 4, 5]);
  const out = St.peopleSettings({ $pp_patterns_cap: '0', $pp_evidence_cap: '9999', $pp_scene_max: '0', $pp_batch_turns: '99', $pp_observed_max: '-3', $pp_unknown_max: '100' });
  assert.deepEqual([out.patternsCap, out.evidenceCap, out.sceneMax, out.batchTurns, out.observedMax, out.unknownMax], [5, 200, 1, 20, 1, 20]);
  assert.equal(St.peopleSettings({ $pp_scene_max: '3.6' }).sceneMax, 4, '소수는 반올림');
  assert.equal(St.ppNum({ $pp_batch_turns: '8' }, 'batch_turns'), 8);
});

test('설정 줄: 다른 상한 줄처럼 값 셋 가운데 고르고, 기본값이 그 안에 있고 전부 범위 안', () => {
  const rows = Def.PEOPLE_SET.groups.flatMap((g) => g.rows);
  for (const [k, [lo, hi]] of Object.entries(St.PP_NUM)) {
    const row = rows.find((r) => r.key === k);
    assert.ok(row, k);
    assert.equal(row.ctl.t, 'seg');
    assert.ok(row.help);
    const vals = row.ctl.opts.map(([v]) => Number(v));
    assert.ok(vals.includes(Number(St.PP_DEFAULTS[k])), k);
    assert.ok(vals.every((n) => n >= lo && n <= hi), k);
  }
  const tidy = Def.PEOPLE_SET.groups.find((g) => g.title === '정리').rows.map((r) => r.key);
  assert.deepEqual(tidy.slice(tidy.indexOf('keep_msgs')), ['keep_msgs', 'keep_scene', 'patterns_cap', 'evidence_cap']);
});

test('한 번에 읽는 응답 수', () => {
  const c = { message: Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: 'x', chatId: `m${i}` })) };
  const unread = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  assert.deepEqual(U.planBatches(c, unread, 100000).map((b) => b.length), [6, 4]);
  assert.deepEqual(U.planBatches(c, unread, 100000, 3).map((b) => b.length), [3, 3, 3, 1]);
});

test('장면 인물 수: 코드 고르기·Router·갱신기', () => {
  const store = T.emptyStore();
  for (const n of NAMES) store.people[n] = person(n);
  const c = chat(['user', '출근했다', 'u1'], ['char', `${NAMES.join(', ')}이 모였다.`, 'c1']);
  const match = (t) => NAMES.filter((n) => t.includes(n));
  assert.equal(Sel.scenePeople(c, store, match).length, 6);
  assert.equal(Sel.scenePeople(c, store, match, { max: 3 }).length, 3);
  const names = NAMES.map((name) => ({ name, aliases: [], titles: [] }));
  assert.equal(Ro.ROUTER_MAX, 6);
  assert.equal(Ro.buildRouter(c, store, names, '입력').max, 6);
  assert.equal(Ro.buildRouter(c, store, names, '입력', { max: 8 }).max, 8);
  // 인물 수만 바꿔도 Router 결과를 다시 묻는다 (지침 글 길이는 4 → 8 로 같다)
  const keyOf = (max) => Ro.buildRouter(c, store, names, '입력', { max, prompt: 'MAX={{MAX}}' }).key;
  assert.notEqual(keyOf(4), keyOf(8));
  assert.equal(keyOf(4), keyOf(4));
  const answer = JSON.stringify({ selected: NAMES });
  assert.equal(Ro.parseRouter(answer, store, names).selected.length, 6);
  assert.equal(Ro.parseRouter(answer, store, names, 2).selected.length, 2);
  const up = (vars) => U.buildUpdate(c, store, [1], { settings: St.peopleSettings(vars), system: 'SYS', values: {}, names }).people.length;
  assert.equal(up({}), 6);
  assert.equal(up({ $pp_scene_max: '2' }), 2);
  assert.equal(up({ $pp_scene_max: '8' }), 8);
});

test('모르는 사실 수', () => {
  const store = T.emptyStore();
  store.people.가람 = person('가람');
  store.people.나래 = person('나래', { slots: { knowledge: Array.from({ length: 9 }, (_, i) => ({ id: `k${i}`, text: `비밀 ${i}번 금고의 위치`, src: 'manual', anchor: '#0', seq: i })) } });
  const c = chat(['user', '출근했다', 'u1']);
  const live = S.liveness(c);
  assert.equal(Inj.unknownTo(store.people.가람, store, live).length, 5);
  assert.equal(Inj.unknownTo(store.people.가람, store, live, 2).length, 2);
});

test('후보당 관찰 상한 · 넣는 성격 관찰 수', () => {
  const c = chat(...Array.from({ length: 100 }, (_, i) => [i % 2 ? 'char' : 'user', `글 ${i}`, `m${i}`]));
  const live = S.liveness(c);
  const fill = (cap) => {
    const p = person('가람');
    for (let i = 0; i < 45; i++) X.observe(p, { axis: 'guardedness', direction: 'up', pattern: '경계가 늘었다', anchor: `m${i * 2 + 1}`, seq: i, quote: `글 ${i * 2 + 1}`, reason: '이유', strength: 60, confidence: 60 }, 'now', cap);
    return Object.values(p.candidates)[0].evidence;
  };
  assert.equal(fill(undefined).length, 40);
  const kept = fill(10);
  assert.equal(kept.length, 10);
  assert.equal(kept.at(-1).anchor, 'm89', '최근 관찰이 남는다');

  const p = person('가람');
  for (let i = 0; i < 7; i++) X.observe(p, { axis: 'pattern', direction: 'new', pattern: `변화후보${i}번`, anchor: `m${i * 2 + 1}`, seq: i, quote: `글 ${i * 2 + 1}`, reason: '이유', strength: 60, confidence: 60 }, 'now');
  const store = T.emptyStore();
  store.people.가람 = p;
  const shown = (o) => (Inj.personBlock(p, store, live, [], { axes: true, axesObserved: true, ...o }).match(/변화후보\d번/g) ?? []).length;
  assert.equal(shown({}), 4);
  assert.equal(shown({ observedMax: 2 }), 2);
  assert.equal(shown({ observedMax: 7 }), 7);
});

test('장기 변화 상한: 읽을 때·승인할 때·기록을 옮길 때', () => {
  const raw = (vars) => ({ message: [], scriptstate: vars, [T.PEOPLE_KEY]: { people: { 가람: person('가람', { patterns: Array.from({ length: 35 }, (_, i) => `변화 ${i}`) }) } } });
  assert.equal(S.peopleStore(raw({})).people.가람.patterns.length, 30);
  assert.equal(S.peopleStore(raw({ $pp_patterns_cap: '10' })).people.가람.patterns.length, 10);
  assert.deepEqual(S.peopleStore(raw({ $pp_patterns_cap: '10' })).people.가람.patterns, Array.from({ length: 10 }, (_, i) => `변화 ${i + 25}`), '오래된 것부터 지운다 (최근 것이 남는다)');
  assert.equal(S.peopleStore(raw({ $pp_patterns_cap: '아무거나' })).people.가람.patterns.length, 30);

  const c = chat(...Array.from({ length: 20 }, (_, i) => [i % 2 ? 'char' : 'user', `글 ${i}`, `m${i}`]));
  const live = S.liveness(c);
  const ready = (cap) => {
    const p = person('가람', { patterns: Array.from({ length: 30 }, (_, i) => `변화 ${i}`) });
    for (let i = 0; i < 6; i++) X.observe(p, { axis: 'pattern', direction: 'new', pattern: '새 변화', anchor: `m${i * 2 + 1}`, seq: i, quote: `글 ${i * 2 + 1}`, reason: '이유', strength: 60, confidence: 80 }, 'now');
    assert.equal(X.approveCandidate(p, Object.keys(p.candidates)[0], live, 'now', cap), null);
    return p.patterns;
  };
  assert.equal(ready(undefined).length, 30);
  assert.equal(ready(undefined).at(-1), '새 변화');
  assert.equal(ready(40).length, 31);
  assert.equal(ready(8).length, 8);

  const merge = (cap) => {
    const store = T.emptyStore();
    store.people.옛이름 = person('옛이름', { patterns: Array.from({ length: 20 }, (_, i) => `가 ${i}`) });
    store.people.가람 = person('가람', { patterns: Array.from({ length: 20 }, (_, i) => `나 ${i}`) });
    assert.ok(cap === undefined ? S.renamePerson(store, '옛이름', '가람', null) : S.renamePerson(store, '옛이름', '가람', null, cap));
    return store.people.가람.patterns;
  };
  assert.equal(merge(undefined).length, 30);
  assert.equal(merge(50).length, 40);
  assert.equal(merge(undefined)[0], '나 10', '옮길 때도 오래된 것부터 지운다');
  assert.equal(merge(undefined).at(-1), '가 19');
});

test('갱신 기록 보관: 이 기기 설정 하나 (채팅마다 다르지 않다)', async () => {
  const rows = Def.PEOPLE_SET.groups.flatMap((g) => g.rows);
  for (const k of ['diag_keep', 'diag_fail_keep']) {
    assert.equal(rows.find((r) => r.key === k).scope, 'device', k);
    assert.equal(St.PP_DEFAULTS[k], undefined, `${k} 는 채팅 설정이 아니다`);
  }
  Prefs.setPrefs({});
  assert.deepEqual(H.diagKeep(), { ok: 10, fail: 30 });
  assert.deepEqual([Prefs.setPrefs({ diagKeep: 0, diagFailKeep: 500 }).diagKeep, Prefs.getPrefs().diagFailKeep], [undefined, undefined], '범위 밖은 버린다');
  Prefs.setPrefs({ diagKeep: 5, diagFailKeep: 50 });
  assert.deepEqual(H.diagKeep(), { ok: 5, fail: 50 });

  const box = {};
  const before = globalThis.risuai;
  globalThis.risuai = { pluginStorage: { getItem: async (k) => box[k] ?? null, setItem: async (k, v) => { box[k] = v; } } };
  try {
    const run = (i, ok, chatId) => ({ at: `2026-11-19T00:00:${String(i).padStart(2, '0')}`, chat: chatId, ok, indexes: [i], people: [], stage: 'update', reason: '', model: 'aux', outChars: 0, ms: 0 });
    // 채팅 A·B 가 번갈아 남겨도 같은 수로 자른다: 실패 50건이 다른 채팅의 한 번으로 줄지 않는다
    for (let i = 0; i < 55; i++) await H.pushDiag(run(i, false, i % 2 ? 'A' : 'B'), false);
    for (let i = 55; i < 62; i++) await H.pushDiag(run(i, true, 'B'), false);
    const list = await H.loadDiag();
    assert.equal(list.filter((r) => !r.ok).length, 50);
    assert.equal(list.filter((r) => r.ok).length, 5);
    assert.equal(list.filter((r) => !r.ok)[0].indexes[0], 5, '오래된 것부터 지운다');
    Prefs.setPrefs({});
    await H.pushDiag(run(62, true, 'A'), false);
    assert.deepEqual([(await H.loadDiag()).filter((r) => r.ok).length, (await H.loadDiag()).filter((r) => !r.ok).length], [6, 30]);
  } finally {
    globalThis.risuai = before;
    Prefs.setPrefs({});
  }
});

test('장면 인물 수 설명: 항상 포함할 인물만큼 늘어나는 것은 메인 요청뿐', () => {
  const help = Def.PEOPLE_SET.groups.flatMap((g) => g.rows).find((r) => r.key === 'scene_max').help;
  assert.match(help, /메인 요청은 항상 포함할 인물이 더 많으면/);
});
