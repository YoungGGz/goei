// 11-20 전수점검 「인물 기록」 고침 시험 (중대-3, 보통-14·15·19, 사소-12·17·18·20)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-audit-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/hypa.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const H = await mod('hypa');
const P = await mod('prompt/index');

const settings = (over = {}) => ({ ...St.peopleSettings({ $pp_prev_pairs: '1' }), ...over });
const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], ...extra });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: ['Jyaldi'], titles: ['부장'] }];
const base = () => chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 유저를 감싸 안으며 팔을 다쳤다. 쟈알디가 문을 지켰다.', 'c1']);
function setup(over = {}) {
  const c = base();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [1], { settings: settings(over), system: 'S', values: {}, names });
  return { c, store, input, ctx: { settings: settings(over), sheetOf: () => null } };
}

test('계기: 같은 응답에 같은 계기 두 줄이면 하나만 (보통-19)', () => {
  const { c, store, input, ctx } = setup();
  const cue = { who: '쟈알디', cue: '도움', m: 'm2', quote: '감싸 안으며', reason: 'x' };
  const rep = U.applyUpdate(store, c, input, { cues: [cue, { ...cue }] }, ctx);
  assert.equal(rep.applied.cues, 1);
  assert.ok(rep.dropped.some((d) => d.reason === '같은 메시지에 같은 계기가 이미 있음'));
});

test('계기·항목 상한은 설정값 (사소-20)', () => {
  const { c, store, input, ctx } = setup({ cueCap: 1 });
  const rep = U.applyUpdate(store, c, input, { cues: [{ who: '쟈알디', cue: '도움', m: 'm2', quote: '감싸 안으며' }, { who: '쟈알디', cue: '작은친절', m: 'm2', quote: '문을 지켰다' }] }, ctx);
  assert.equal(rep.applied.cues, 1);
  assert.ok(rep.dropped.some((d) => d.reason === '인물당 1개 상한'));
  assert.deepEqual([St.PP_DEFAULTS.entry_cap, St.PP_DEFAULTS.tidy_entry_cap, St.PP_DEFAULTS.cue_cap, St.PP_DEFAULTS.log_cap], ['8', '24', '2', '800']);
});

test('첫인상은 지우기를 받지 않는다 (보통-15)', () => {
  const { c, store, input, ctx } = setup();
  store.people.쟈알디.slots['affinity.appraisal'] = [{ id: 'a1', text: '믿을 만해 보임', src: 'story', anchor: 'c1', seq: 0, target: '@user' }];
  const rep = U.applyUpdate(store, c, input, { entries: [{ who: '쟈알디', slot: 'affinity.appraisal', op: 'remove', replace: 'a1', m: 'm2', quote: '감싸 안으며' }] }, ctx);
  assert.ok(rep.dropped.some((d) => d.reason === '한 번 쓰면 고치지 않는 칸'));
  assert.equal(S.liveEntries(store.people.쟈알디.slots['affinity.appraisal'], S.liveness(c)).length, 1);
});

test('문서 지우기는 인용이 있어야 (사소-18)', () => {
  const { c, store, input, ctx } = setup();
  store.docs['location:본부'] = { type: 'location', key: '본부', entries: [{ id: 'd1', text: '본부 사무실', src: 'story', anchor: 'c1', seq: 0 }] };
  const rep = U.applyUpdate(store, c, input, { docs: [{ type: 'location', key: '본부', op: 'remove', replace: 'd1', m: 'm2' }] }, ctx);
  assert.ok(rep.dropped.some((d) => d.reason === '인용 없음'));
});

test('다시 읽기 비우기는 접힌 호감 합도 지운다 (보통-14)', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.folded.쟈알디 = 12;
  U.clearStoryRecords(store, '쟈알디');
  assert.equal(store.folded.쟈알디, undefined);
});

test('갱신기 자료에 모으는 중인 성격 변화 후보 (중대-3)', () => {
  const p = person('쟈알디', { candidates: { k1: { id: 'k1', axis: 'emotionalExpressiveness', direction: 'up', pattern: '감정을 더 드러냄', evidence: [{ id: 'o1', anchor: 'c1', seq: 0, quote: '감싸 안으며', reason: 'x', strength: 50, confidence: 60 }], status: 'collecting', at: '' } } });
  const out = U.personPayload(p, S.liveness(base()), [], undefined, { axes: true });
  assert.deepEqual(out.axes_collecting, [{ axis: 'emotionalExpressiveness', direction: 'up', pattern: '감정을 더 드러냄' }]);
});

test('지침의 인물 수·항목 수 자리는 설정값으로 (사소-17·20)', () => {
  const s = settings({ sceneMax: 9, entryCap: 5, cueCap: 3, tidyEntryCap: 30 });
  const out = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '', 'ko', '', '', s);
  assert.match(out, /≤5 entries per person per response, ≤9 persons/);
  assert.ok(!/<<[A-Z_]+>>/.test(out));
});

test('되돌리기: 이름이 같은 다른 종류 문서도 가른다 (사소-12)', () => {
  const store = T.emptyStore();
  const before = S.snapshotRun(store);
  store.docs['location:등불'] = { type: 'location', key: '등불', entries: [{ id: 'x1', text: '가게', src: 'story', anchor: 'c1', seq: 0 }] };
  store.docs['item:등불'] = { type: 'item', key: '등불', entries: [{ id: 'x2', text: '물건', src: 'story', anchor: 'c1', seq: 0 }] };
  S.recordRun(store, before, '');
  assert.equal(S.undoLastRun(store), 2);
  assert.ok(store.docs['location:등불'].entries[0].void && store.docs['item:등불'].entries[0].void);
});

test('하이파 플러스 순번은 만든 차례 (보통-20)', () => {
  const items = H.hypaPlusItems({ chunks: [{ nodes: [{ content: '나중', createdAt: 1700000002000 }, { content: '먼저', createdAt: 1700000001000 }] }] });
  assert.deepEqual(items.map((x) => [x.text.split('\n').pop(), x.index]), [['먼저', 1], ['나중', 2]]);
});
