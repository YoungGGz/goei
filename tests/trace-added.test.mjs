// 호출 기록의 메인 요청 조립 줄: 보낸 것 전부의 토큰 옆에 「(이 중 플러그인이 넣은 것 N토큰)」 (사용자 11-15: 둘을 더하는 것처럼 읽히지 않게)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1114/trace-added';
mkdirSync(dir, { recursive: true });
const S = JSON.stringify;
await build({
  stdin: {
    contents: `
      export { traceBegin, traceMain, loadTrace, clearTrace } from './src/host/trace';
      export { traceUi, tracePage } from './src/ui/editor/trace';
      export { tokens } from './src/core/gnet';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(dir, 'm.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text' },
  define: { __UPDATE_BASE__: S(''), __PLUGIN_VERSION__: S('0.0.0'), __WORLD_PACK__: S('{}'), __INSTALL_PACK__: S('{}'), __ITEMS_PACK__: S('{}'), __LOOKS_PACK__: S('{}'), __HOMESHOP_PACK__: S('{}') },
});

const store = new Map();
globalThis.risuai = {
  pluginStorage: {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
    keys: async () => [...store.keys()],
  },
};
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);
const page = async () => {
  M.traceUi.turns = await M.loadTrace();
  return M.tracePage(() => '', '');
};
/** 메인 요청 조립 칸의 작은 글 줄 */
const mainMeta = (html) => html.split('메인 요청 조립</b>')[1].match(/<small class="gw-flow-meta">([^<]*)<\/small>/)[1];
const tick = () => new Promise((r) => setTimeout(r, 20));

test('호출 기록: 메인 요청 조립 줄, 보낸 것 전부 옆에 「이 중 플러그인이 넣은 것 N토큰」이 보인다', async () => {
  await M.clearTrace();
  await M.traceBegin();
  const added = ['끼운 로어 글 하나', '참고 기록 '.repeat(400)];
  M.traceMain([{ role: 'system', content: added.join('\n') }, { role: 'user', content: '안녕' }], [], added);
  await tick(); // 토큰은 요청을 보낸 뒤에 센다
  const main = (await M.loadTrace()).at(-1).main;
  const n = added.reduce((s, t) => s + M.tokens(t), 0);
  assert.equal(main.added, n);
  assert.ok(n >= 1000, String(n));
  const meta = mainMeta(await page());
  const total = `${main.totalTokens.toLocaleString('ko-KR')}토큰`;
  // 총 토큰 바로 옆, 천 단위 쉼표는 다른 숫자와 같게
  assert.ok(meta.includes(`${total} (이 중 플러그인이 넣은 것 ${n.toLocaleString('ko-KR')}토큰)`), meta);
});

test('호출 기록: 더한 글이 없으면 0, 기록에 숫자가 없으면(옛 기록) 글을 붙이지 않는다', async () => {
  await M.clearTrace();
  await M.traceBegin();
  M.traceMain([{ role: 'user', content: '안녕' }], [], []);
  await tick();
  assert.ok(mainMeta(await page()).includes(' (이 중 플러그인이 넣은 것 0토큰)'));

  await M.clearTrace();
  await M.traceBegin();
  M.traceMain([{ role: 'user', content: '안녕' }], ['라우터']);
  await tick();
  const meta = mainMeta(await page());
  assert.ok(!meta.includes('플러그인이 넣은 것'), meta);
  assert.ok(/토큰 · 건너뛴 단계 라우터$/.test(meta), meta);
  await new Promise((r) => setTimeout(r, 1700)); // 모아 쓰기가 끝난 뒤 정리
  await M.clearTrace();
});
