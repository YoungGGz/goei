// 호출 기록 저장 찌꺼기: 목록(goei-trace)에 없는 턴 기록(goei-trace:<id>)은 처음 읽을 때 지운다. 목록에 있는 턴과 다른 열쇠는 건드리지 않는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1119/trace-orphan';
mkdirSync(dir, { recursive: true });
const S = JSON.stringify;
await build({
  stdin: { contents: `export { loadTrace } from './src/host/trace';`, resolveDir: process.cwd(), loader: 'ts' },
  outfile: join(dir, 'm.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text' },
  define: { __UPDATE_BASE__: S(''), __PLUGIN_VERSION__: S('0.0.0'), __WORLD_PACK__: S('{}'), __INSTALL_PACK__: S('{}'), __ITEMS_PACK__: S('{}'), __LOOKS_PACK__: S('{}'), __HOMESHOP_PACK__: S('{}') },
});

const turn = (id) => S({ id, at: '2026-11-19T00:00:00Z', calls: [] });
const store = new Map([
  ['goei-trace', S(['a', 'b'])],
  ['goei-trace:a', turn('a')],
  ['goei-trace:b', turn('b')],
  ['goei-trace:old1', turn('old1')],
  ['goei-trace:old2', turn('old2')],
  ['goei-other', 'x'],
]);
globalThis.risuai = {
  pluginStorage: {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
    keys: async () => [...store.keys()],
  },
};

test('처음 읽을 때 목록에 없는 턴 기록만 지운다', async () => {
  const { loadTrace } = await import(pathToFileURL(join(dir, 'm.mjs')).href);
  const turns = await loadTrace();
  assert.deepEqual(turns.map((t) => t.id), ['a', 'b']);
  assert.deepEqual([...store.keys()].sort(), ['goei-other', 'goei-trace', 'goei-trace:a', 'goei-trace:b']);
});
