// 2차 점검 14 (호출 흐름·진행 창): Router 시간 제한(14-1), 앞 턴 뒤 작업이 다음 턴에 섞임(14-2), 턴 중 단추 호출이 합계에 듦(14-3), 단추 호출이 폰 막대 점을 켬(14-4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/fix3d/flow';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
const ENTRY = `
export * as Prog from './src/core/progress';
export * as Tr from './src/host/trace';
export * as L from './src/host/llm';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { Prog, Tr, L } = await import(pathToFileURL(outfile));
const people = await readFile(new URL('../src/host/people.ts', import.meta.url), 'utf8');

const store = new Map();
globalThis.risuai = {
  pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k), keys: async () => [...store.keys()] },
  runLLMModel: async () => ({ type: 'success', result: 'ok' }),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stage = (t, label) => t.plan.find((s) => s.id === t.calls.find((c) => c.label === label)?.stage);

test('14-1: 시간 제한을 넘긴 호출은 그때 실패로 적히고, 늦게 온 답은 「완료」로 바꾸지 않는다', async () => {
  Prog.resetProgress();
  Prog.progressBegin();
  Prog.progressPlan([{ id: 'router', label: '라우터', group: 'router', match: ['라우터'] }]);
  globalThis.risuai.runLLMModel = async () => { await sleep(150); return { type: 'success', result: '{"selected":[]}' }; };
  await assert.rejects(L.runModel([{ role: 'user', content: 'x' }], 'aux', undefined, '라우터', 0.05), /시간 제한/);
  const t = Prog.progressTurn();
  const s = t.plan.find((x) => x.id === 'router');
  assert.equal(Prog.stageState(t, s), 'fail');
  await sleep(200);
  assert.equal(Prog.stageState(t, s), 'fail', '늦게 온 답이 완료로 바꾸지 않는다');
  assert.equal(t.calls[0].ok, false);
  // Router·Director 는 runModel 의 시간 제한을 쓴다 (따로 Promise.race 로 끊고 호출은 계속 돌게 두지 않는다)
  assert.doesNotMatch(people, /Promise\.race/);
  assert.match(people, /'라우터', settings\.routerTimeout\)/);
  assert.match(people, /'디렉터', settings\.directorTimeout\)/);
  globalThis.risuai.runLLMModel = async () => ({ type: 'success', result: 'ok' });
});

test('14-2: 다음 턴이 응답을 받기 전에 시작한 앞 턴의 뒤 작업은 앞 턴에 붙는다', async () => {
  Prog.resetProgress();
  const WIKI = { id: 'wiki', label: '위키', group: 'update', match: ['위키 제목', '위키 글'] };
  const MALL = { id: 'mall:cos', label: '우주 쇼핑몰', group: 'net', match: ['우주 쇼핑몰 진열'] };
  await Tr.traceBegin();
  Prog.progressPlan([WIKI, MALL]);
  Tr.traceReply('A 응답');
  const a = Prog.progressTurn();
  const aId = Tr.traceTurnId();
  // 턴 A 의 뒤 작업(위키)이 도는 중에 턴 B 가 열린다
  await Tr.traceBegin();
  Prog.progressPlan([WIKI, MALL]);
  const b = Prog.progressTurn();
  assert.notEqual(a, b);
  assert.equal(Prog.callOwner('우주 쇼핑몰 진열'), 'prev');
  assert.deepEqual(Tr.traceMark('우주 쇼핑몰 진열'), { id: aId, phase: 'after' });
  const id = Prog.progressCallStart('우주 쇼핑몰 진열', 'aux', 0);
  assert.equal(b.calls.length, 0, '새 턴 진행 창에 안 섞인다');
  assert.equal(a.calls.find((c) => c.id === id)?.label, '우주 쇼핑몰 진열');
  Prog.progressCallEnd(id, { ok: true, ms: 10, respTokens: 5 });
  assert.equal(a.calls.find((c) => c.id === id).ok, true);
  assert.equal(Prog.stageState(b, b.plan.find((s) => s.id === 'mall:cos')), 'wait', '새 턴의 칸은 실패로 뜨지 않는다');
  // 앞 턴이 끝나면 그 뒤 호출은 다시 새 턴 판정
  Prog.progressEnd(a);
  Tr.traceEnd(aId);
  assert.equal(Prog.callOwner('우주 쇼핑몰 진열'), 'turn');
  // 새 턴이 응답을 받은 뒤의 뒤 작업은 새 턴 것
  Tr.traceReply('B 응답');
  assert.equal(Prog.callOwner('위키 글'), 'turn');
  Prog.resetProgress();
});

test('R60: 앞 턴이 시작한 위키 단계의 다음 호출은 새 턴이 응답을 받은 뒤여도 앞 턴 것', async () => {
  Prog.resetProgress();
  const WIKI = { id: 'wiki', label: '위키', group: 'update', match: ['위키 제목', '위키 글'] };
  await Tr.traceBegin();
  Prog.progressPlan([WIKI]);
  Tr.traceReply('A 응답');
  const a = Prog.progressTurn();
  const t1 = Prog.progressCallStart('위키 제목', 'aux', 0); // A 의 위키 제목이 도는 중
  await Tr.traceBegin();
  Prog.progressPlan([WIKI]);
  const b = Prog.progressTurn();
  Tr.traceReply('B 응답');
  Prog.progressCallEnd(t1, { ok: true, ms: 10 });
  assert.equal(Prog.callOwner('위키 글'), 'prev');
  const g = Prog.progressCallStart('위키 글', 'aux', 0);
  assert.ok(a.calls.some((c) => c.id === g));
  assert.equal(Prog.callOwner('위키 글 다시 묻기 1'), 'prev');
  // 새 턴 자기 것: 앞 턴이 이미 부른 이름
  assert.equal(Prog.callOwner('위키 제목'), 'turn');
  assert.equal(b.calls.length, 0);
  Prog.resetProgress();
});

test('14-3: 채팅 턴 중에 단추로 부른 호출(AI 상담)은 그 턴 합계·「지난 턴」에 들지 않는다', async () => {
  Prog.resetProgress();
  await Tr.traceBegin();
  Prog.progressPlan([{ id: 'update', label: '갱신기', group: 'update', match: ['갱신기'] }]);
  assert.equal(Prog.callOwner('AI 상담'), 'manual');
  assert.equal(Tr.traceMark('AI 상담').phase, 'manual');
  assert.equal(Tr.traceMark('라우터').phase, 'before', '라우터는 계획 전에도 턴 호출');
  const t = Prog.progressTurn();
  const id = Prog.progressCallStart('AI 상담', 'aux', 0);
  Prog.progressCallTokens(id, 6000);
  Prog.progressCallEnd(id, { ok: true, ms: 10, respTokens: 14 });
  assert.equal(stage(t, 'AI 상담').group, 'other');
  const s = Prog.turnSummary(t);
  assert.equal(s.calls, 0);
  assert.equal(s.req, 0);
  for (const g of Prog.GROUPS) assert.notEqual(Prog.groupState(t, g), 'run');
  Prog.resetProgress();
});

test('14-4: 턴 없이 단추 호출만 하면 폰 막대 점이 켜지지 않는다 (수동 턴은 전부 기타)', () => {
  Prog.resetProgress();
  Prog.progressCallStart('AI 상담', 'aux', 0);
  const t = Prog.progressTurn();
  assert.equal(t.manual, true);
  for (const g of Prog.GROUPS) assert.equal(Prog.groupState(t, g), 'skip', g);
  Prog.progressCallStart('망상홈쇼핑 상담원', 'aux', 0);
  Prog.progressCallStart('위키 글', 'aux', 0);
  for (const g of Prog.GROUPS) assert.equal(Prog.groupState(t, g), 'skip', g);
  assert.equal(Prog.turnSummary(t).calls, 0, '아직 안 끝남');
  Prog.resetProgress();
});
