// 호출 기록 › 메인 요청 조립의 줄 이름표 (사용자 2026-11-15): 플러그인이 넣은 줄은 단계 이름, 고친 줄은 「○○ 고침」, 그대로인 줄은 이름표 없음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1115/stagetags';
mkdirSync(dir, { recursive: true });
const S = JSON.stringify;
await build({
  stdin: { contents: `export { tagStep, contextTag } from './src/core/stagetags';\nexport { traceBegin, traceMain, loadTrace, clearTrace } from './src/host/trace';\nexport { traceUi, tracePage } from './src/ui/editor/trace';`, resolveDir: process.cwd(), loader: 'ts' },
  outfile: join(dir, 'm.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text' },
  define: { __UPDATE_BASE__: S(''), __PLUGIN_VERSION__: S('0.0.0'), __WORLD_PACK__: S('{}'), __INSTALL_PACK__: S('{}'), __ITEMS_PACK__: S('{}'), __LOOKS_PACK__: S('{}'), __HOMESHOP_PACK__: S('{}') },
});
const store = new Map();
globalThis.risuai = { pluginStorage: { getItem: async (k) => (store.has(k) ? store.get(k) : null), setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k), keys: async () => [...store.keys()] } };
globalThis.matchMedia = () => ({ matches: false });
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

const sys = { role: 'system', content: 'Risu 프리셋 시스템 글 '.repeat(4) };
const u1 = { role: 'user', content: '첫 사용자 글입니다. 길게 써 둡니다 '.repeat(2) };
const a1 = { role: 'assistant', content: '봇 응답 본문입니다. 길게 써 둡니다 '.repeat(2) };
const u2 = { role: 'user', content: '마지막 사용자 행동' };

test('그대로 넘어온 줄은 이름표가 그대로, 새로 넣은 줄은 단계 이름', () => {
  const prev = [sys, u1, a1, u2];
  const lore = { role: 'system', content: '플러그인이 넣은 로어' };
  const next = [sys, lore, u1, a1, u2];
  assert.deepEqual(M.tagStep(prev, ['', '', '', ''], next, '로어'), ['', '로어', '', '', '']);
  // 배열이 같으면 그대로
  assert.deepEqual(M.tagStep(prev, ['', 'x', '', ''], prev, '로어'), ['', 'x', '', '']);
});

test('같은 글을 새 객체로 다시 만든 줄은 고친 것으로 치지 않는다', () => {
  const prev = [sys, u1];
  const next = [{ ...sys }, { ...u1 }];
  assert.deepEqual(M.tagStep(prev, ['', ''], next, '시작 카드 표식'), ['', '']);
});

test('원래 줄을 고치면 「○○ 고침」, 플러그인이 넣은 줄을 다른 단계가 고치면 이름표 뒤에 덧붙는다', () => {
  const prev = [sys, u1, a1, u2];
  const next = [sys, u1, { ...a1, content: a1.content + '\n[Inventory] 손전등' }, u2];
  assert.deepEqual(M.tagStep(prev, ['', '', '', ''], next, '소지품'), ['', '', '소지품 고침', '']);
  const lore = { role: 'system', content: '플러그인이 넣은 로어 글입니다. 이름이 여럿 들어 있습니다' };
  const fixed = { role: 'system', content: lore.content + ' (인물 기록으로 대신함)' };
  assert.deepEqual(M.tagStep([lore, u2], ['로어', ''], [fixed, u2], '인물 기록'), ['로어 · 인물 기록 고침', '']);
  assert.deepEqual(M.tagStep([a1], ['소지품 고침'], [{ ...a1, content: 'X' + a1.content }], '인물 기록'), ['소지품 고침 · 인물 기록 고침']);
});

test('참고 기록은 어느 기능 것인지까지', () => {
  const ctx = (o) => `[MODULE_CONTEXT_BEGIN]\n규칙\n${JSON.stringify(o)}\n[MODULE_CONTEXT_END]`;
  assert.equal(M.contextTag(ctx({ feature: 'gnet', site: '세정게', records: [] })), '참고 기록 · 세정게');
  assert.equal(M.contextTag(ctx({ feature: 'phone', records: [] })), '참고 기록 · 괴담톡');
  assert.equal(M.contextTag(ctx({ feature: 'wiki', records: [] })), '참고 기록 · 위키');
  assert.equal(M.contextTag(ctx({ feature: 'homeshop', access: '', records: [] })), '참고 기록 · 망상홈쇼핑');
  assert.equal(M.contextTag('아무 글'), '참고 기록');
  const prev = [sys, u2];
  const add = [{ role: 'system', content: ctx({ feature: 'gnet', site: '괴담넷', records: [] }) }, { role: 'system', content: ctx({ feature: 'homeshop', records: [] }) }];
  assert.deepEqual(M.tagStep(prev, ['', ''], [sys, ...add, u2], (m) => M.contextTag(m.content)), ['', '참고 기록 · 괴담넷', '참고 기록 · 망상홈쇼핑', '']);
});

test('호출 기록 화면: 이름표가 역할 바로 뒤에 보이고, 이름표 없는 줄은 그대로', async () => {
  await M.clearTrace();
  await M.traceBegin();
  M.traceMain([sys, { role: 'system', content: '플러그인 로어' }, u2], [], undefined, ['', '로어', '인물 기록 고침']);
  const main = (await M.loadTrace()).at(-1).main;
  assert.deepEqual(main.tail.map((r) => r.tag ?? ''), ['', '로어', '인물 기록 고침']);
  assert.ok(!('tag' in main.tail[0]), '빈 이름표는 저장하지 않는다');
  M.traceUi.turns = await M.loadTrace();
  M.traceUi.open.add(`${M.traceUi.turns.at(-1).id}:main`); // 메인 요청 조립 칸을 펼친다
  const body = M.tracePage(() => '', '');
  assert.ok(body.includes('<small>[system]</small> <em class="gw-flow-tag">로어</em>'), '로어 이름표');
  assert.ok(body.includes('<small>[user]</small> <em class="gw-flow-tag">인물 기록 고침</em>'), '고침 이름표');
  assert.equal((body.match(/gw-flow-tag/g) ?? []).length, 2);
});

test('짧은 줄을 고친 것도 고침으로 (상태창 줄을 떼어 낸 봇 응답)', () => {
  const a = { role: 'assistant', content: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]' };
  const sysBlock = { role: 'system', content: '[직전 상태] ...' };
  assert.deepEqual(M.tagStep([sys, a, u2], ['', '', ''], [sys, { ...a, content: '본문' }, sysBlock, u2], '상태창'), ['', '상태창 고침', '상태창', '']);
  // 역할 줄 수가 같으면 글이 전혀 안 겹쳐도 고친 것
  assert.deepEqual(M.tagStep([u1, u2], ['', ''], [u1, { role: 'user', content: '완전히 다른 글' }], '지시문·전화 풀기'), ['', '지시문·전화 풀기 고침']);
});
