// 생성 공통으로 옮긴 수: 요청당 사진(8) · AI 상담 지난 대화 참조(24). 기본값은 전에 코드에 고정돼 있던 값, 설정이 동작을 바꾸고, 틀린 값은 기본값으로 돌아간다.
// 호출 기록 보관(5) · AI 상담 대화 보관(80)·보관 채팅(30)은 저장소가 기기에 하나라 이 기기 설정: 채팅 변수로는 바뀌지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { advanced, attach as A } from '../dist-test/core.mjs';

const { advNum, advValue, advVar, advItem, applyAdvanced, applyGenLimits, consultTalk } = advanced;
const hex = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('hex');
const img = (i) => `%%ATTACHMENT:${hex({ kind: 'image', content: `사진 ${i}`, asset: `assets/a${i}.png` })}%%`;
const sent = (n) => A.prepareAttachments([{ role: 'user', content: Array.from({ length: n }, (_, i) => img(i)).join(' ') }]).at(-1).images ?? [];

// 기기 설정(prefs)을 읽는 쪽(호출 기록·AI 상담 보관)은 한 묶음으로 지어 같은 설정을 보게 한다
const dir = join(tmpdir(), 'goei-gen-limits');
mkdirSync(dir, { recursive: true });
const S = JSON.stringify;
await build({
  stdin: { contents: `export { traceBegin, loadTrace, clearTrace, TRACE_KEEP } from './src/host/trace';\nexport { consultKeep, trimConsult } from './src/core/consult';\nexport { applyAdvanced } from './src/core/advanced';\nexport { setPrefs, getPrefs } from './src/core/settings';`, resolveDir: process.cwd(), loader: 'ts' },
  outfile: join(dir, 'm.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text' },
  define: { __UPDATE_BASE__: S(''), __PLUGIN_VERSION__: S('0.0.0'), __WORLD_PACK__: S('{}'), __INSTALL_PACK__: S('{}'), __ITEMS_PACK__: S('{}'), __LOOKS_PACK__: S('{}'), __HOMESHOP_PACK__: S('{}') },
});
const bundle = () => import(pathToFileURL(join(dir, 'm.mjs')).href);

test('기본값은 전에 고정돼 있던 값이고 변수 이름은 $gen_ 으로 시작한다', () => {
  assert.equal(advNum({}, 'gen', 'image_max'), 8);
  assert.equal(consultTalk(undefined), 24);
  assert.equal(A.IMAGE_MAX, 8);
  for (const k of ['image_max', 'consult_talk']) assert.equal(advVar('gen', advItem('gen', k)), `$gen_${k}`);
  // 기기에 하나뿐인 저장소를 자르는 수는 채팅 변수 표에 없다
  for (const k of ['trace_keep', 'consult_lines', 'consult_chats']) assert.equal(advItem('gen', k), undefined, k);
});

test('틀린 값(범위 밖·글자·소수)은 기본값으로 돌아간다', () => {
  for (const bad of ['0', '21', 'abc', '2.5', '-1', '']) assert.equal(advValue({ $gen_image_max: bad }, 'gen', 'image_max'), '8', bad);
  for (const bad of ['1', '201', 'abc']) assert.equal(consultTalk({ $gen_consult_talk: bad }), 24, bad);
  assert.equal(consultTalk({ $gen_consult_talk: '40' }), 40);
});

test('AI 상담 보관: 이 기기 값 하나로 자른다 (기본 80줄·30개). 채팅마다 다르지 않아 다른 채팅에서 상담해도 올려 둔 양이 줄지 않는다', async () => {
  const C = await bundle();
  const Prefs = C;
  const mk = (chats, lines) => Object.fromEntries(Array.from({ length: chats }, (_, i) => [`c:${i}`, { lines: Array.from({ length: lines }, (_, j) => ({ who: 'me', text: `${j}` })), pending: [], at: i + 1 }]));
  Prefs.setPrefs({});
  assert.deepEqual(C.consultKeep(), { lines: 80, chats: 30 });
  let store = mk(35, 100);
  C.trimConsult(store);
  assert.equal(Object.keys(store).length, 30);
  assert.ok(!('c:4' in store) && 'c:5' in store, '상담한 지 오래된 채팅부터 지운다');
  assert.deepEqual([store['c:34'].lines.length, store['c:34'].lines[0].text], [80, '20']);
  // 올려 두면 어느 채팅에서 저장하든 같은 수
  Prefs.setPrefs({ consultLines: 500, consultChats: 100 });
  store = mk(60, 300);
  C.trimConsult(store);
  assert.deepEqual([Object.keys(store).length, store['c:0'].lines.length], [60, 300]);
  Prefs.setPrefs({ consultLines: 20, consultChats: 1 });
  C.trimConsult(store);
  assert.deepEqual([Object.keys(store), store['c:59'].lines.length], [['c:59'], 20]);
  // 범위 밖은 버린다
  Prefs.setPrefs({ consultLines: 19, consultChats: 101, traceKeep: 21 });
  assert.deepEqual([C.consultKeep(), Prefs.getPrefs().traceKeep], [{ lines: 80, chats: 30 }, undefined]);
  Prefs.setPrefs({});
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

test('호출 기록 보관: 기본 5턴, 이 기기 값만큼만 남고 저장소에서도 지워진다. 채팅 변수로는 바뀌지 않는다', async () => {
  const store = new Map();
  globalThis.risuai = {
    pluginStorage: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => void store.set(k, v),
      removeItem: async (k) => void store.delete(k),
      keys: async () => [...store.keys()],
    },
  };
  const M = await bundle();
  const run = async (n) => {
    await M.clearTrace();
    for (let i = 0; i < n; i++) await M.traceBegin();
    return (await M.loadTrace()).length;
  };
  assert.equal(M.TRACE_KEEP, 5);
  assert.equal(await run(8), 5);
  M.setPrefs({ traceKeep: 2 });
  assert.equal(await run(8), 2);
  M.setPrefs({ traceKeep: 20 });
  assert.equal(await run(25), 20);
  // 다른 채팅을 읽어도(그 채팅 변수에 옛 값이 남아 있어도) 20턴이 그대로다: 채팅을 읽기 전에 새 턴을 열어도 잘리지 않는다
  M.applyAdvanced({ $gen_trace_keep: '5' });
  M.applyAdvanced({});
  await M.traceBegin();
  assert.equal((await M.loadTrace()).length, 20);
  // 줄이면 다음 턴부터 넘는 턴이 빠지고, 저장소의 턴 글도 지워진다
  M.setPrefs({ traceKeep: 3 });
  await M.traceBegin();
  assert.equal((await M.loadTrace()).length, 3);
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal([...store.keys()].filter((k) => k.startsWith('goei-trace:')).length, 3);
  assert.equal(JSON.parse(store.get('goei-trace')).length, 3);
  M.setPrefs({ traceKeep: 100 });
  assert.equal(await run(8), 5);
  await new Promise((r) => setTimeout(r, 1800));
});
