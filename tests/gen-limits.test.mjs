// 생성 공통으로 옮긴 수: 요청당 사진(8) · 호출 기록 보관(5) · AI 상담 대화 보관(80)·보관 채팅(30)·지난 대화 참조(24).
// 기본값은 전에 코드에 고정돼 있던 값, 설정이 동작을 바꾸고, 틀린 값은 기본값으로 돌아간다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { advanced, attach as A } from '../dist-test/core.mjs';

const { advNum, advValue, advVar, advItem, applyAdvanced, applyGenLimits, consultLimits, TRACE_LIMITS } = advanced;
const hex = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('hex');
const img = (i) => `%%ATTACHMENT:${hex({ kind: 'image', content: `사진 ${i}`, asset: `assets/a${i}.png` })}%%`;
const sent = (n) => A.prepareAttachments([{ role: 'user', content: Array.from({ length: n }, (_, i) => img(i)).join(' ') }]).at(-1).images ?? [];

test('기본값은 전에 고정돼 있던 값이고 변수 이름은 $gen_ 으로 시작한다', () => {
  assert.equal(advNum({}, 'gen', 'image_max'), 8);
  assert.equal(advNum({}, 'gen', 'trace_keep'), 5);
  assert.deepEqual(consultLimits(undefined), { lines: 80, chats: 30, talk: 24 });
  assert.equal(A.IMAGE_MAX, 8);
  for (const k of ['image_max', 'trace_keep', 'consult_lines', 'consult_chats', 'consult_talk']) assert.equal(advVar('gen', advItem('gen', k)), `$gen_${k}`);
});

test('틀린 값(범위 밖·글자·소수)은 기본값으로 돌아간다', () => {
  for (const bad of ['0', '21', 'abc', '2.5', '-1', '']) {
    assert.equal(advValue({ $gen_image_max: bad }, 'gen', 'image_max'), '8', bad);
    assert.equal(advValue({ $gen_trace_keep: bad }, 'gen', 'trace_keep'), '5', bad);
  }
  assert.deepEqual(consultLimits({ $gen_consult_lines: '19', $gen_consult_chats: '0', $gen_consult_talk: '1' }), { lines: 80, chats: 30, talk: 24 });
  assert.deepEqual(consultLimits({ $gen_consult_lines: '501', $gen_consult_chats: '101', $gen_consult_talk: '201' }), { lines: 80, chats: 30, talk: 24 });
  assert.deepEqual(consultLimits({ $gen_consult_lines: '200', $gen_consult_chats: '5', $gen_consult_talk: '40' }), { lines: 200, chats: 5, talk: 40 });
});

test('요청당 사진: 기본 8장, 설정한 수만큼 최근 사진만 붙고 나머지는 설명 글만 간다', () => {
  applyAdvanced({});
  assert.deepEqual(sent(10), Array.from({ length: 8 }, (_, i) => `assets/a${i + 2}.png`));
  applyAdvanced({ $gen_image_max: '3' });
  assert.deepEqual(sent(10), ['assets/a7.png', 'assets/a8.png', 'assets/a9.png']);
  applyGenLimits({ $gen_image_max: '12' });
  assert.equal(sent(10).length, 10);
  applyGenLimits({ $gen_image_max: '99' });
  assert.equal(sent(10).length, 8);
  applyAdvanced({});
});

test('호출 기록 보관: 기본 5턴, 설정한 턴 수만 남고 저장소에서도 지워진다', async () => {
  const dir = join(tmpdir(), 'goei-gen-limits');
  mkdirSync(dir, { recursive: true });
  const S = JSON.stringify;
  await build({
    stdin: { contents: `export { traceBegin, loadTrace, clearTrace, TRACE_KEEP } from './src/host/trace';\nexport { applyGenLimits } from './src/core/advanced';`, resolveDir: process.cwd(), loader: 'ts' },
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
  const run = async (n) => {
    await M.clearTrace();
    for (let i = 0; i < n; i++) await M.traceBegin();
    return (await M.loadTrace()).length;
  };
  assert.equal(M.TRACE_KEEP, 5);
  assert.equal(TRACE_LIMITS.keep, 5);
  assert.equal(await run(8), 5);
  M.applyGenLimits({ $gen_trace_keep: '2' });
  assert.equal(await run(8), 2);
  M.applyGenLimits({ $gen_trace_keep: '7' });
  assert.equal(await run(8), 7);
  // 줄이면 다음 턴부터 넘는 턴이 빠지고, 저장소의 턴 글도 지워진다
  M.applyGenLimits({ $gen_trace_keep: '3' });
  await M.traceBegin();
  assert.equal((await M.loadTrace()).length, 3);
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal([...store.keys()].filter((k) => k.startsWith('goei-trace:')).length, 3);
  assert.equal(JSON.parse(store.get('goei-trace')).length, 3);
  M.applyGenLimits({ $gen_trace_keep: '100' });
  assert.equal(await run(8), 5);
  await new Promise((r) => setTimeout(r, 1800));
});
