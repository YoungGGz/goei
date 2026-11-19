// 다른 채팅을 저장한 뒤에는 열려 있는 채팅의 수(소지품 줄 상한·거래 줄 상한·고급 설정)로 되돌린다 (host/risu.ts saveChat · shown)
// 예전엔 채팅 B 를 열어 둔 채 채팅 A 의 뒤 저장이 끝나면 다음 loadContext 까지 A 의 값으로 읽었다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'goei-limits-restore-'));
const entry = `
  export { loadContext, updateChat } from './src/host/risu';
  export { itemListCap, itemLogCap, ITEM_LIST_CAP_VAR, ITEM_LOG_CAP_VAR } from './src/core/itemrules';
  export { addWalletEntry, WALLET_CAP_VAR } from './src/core/wallet';
  export { ATTACH_LIMITS } from './src/core/attach';
  export { advVar, advItem } from './src/core/advanced';
`;
await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
  outfile: join(dir, 'limits.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.css': 'text', '.txt': 'text', '.svg': 'text', '.html': 'text', '.png': 'dataurl', '.webp': 'dataurl' },
});

const chats = new Map();
let current = { char: 0, chat: 0 };
globalThis.matchMedia ??= () => ({ matches: false });
globalThis.risuai = {
  getCurrentCharacterIndex: async () => current.char,
  getCurrentChatIndex: async () => current.chat,
  getCharacterFromIndex: async () => ({ name: '시험 봇', globalLore: [] }),
  getChatFromIndex: async (c, i) => chats.get(`${c}:${i}`) ?? null,
  setChatToIndex: async (c, i, chat) => { chats.set(`${c}:${i}`, chat); },
  getDatabase: async () => ({ modules: [], enabledModules: [] }),
};
// 모듈 상태(열려 있는 채팅 기억)가 시험마다 새로 시작하게 묶음을 시험마다 따로 불러온다
let n = 0;
const fresh = () => import(`${pathToFileURL(join(dir, 'limits.mjs')).href}?v=${++n}`);

/** 지금 올라와 있는 거래 줄 상한 (꺼내는 함수가 없어, 2100줄 가계부에 한 줄 넣고 남는 줄 수로 본다. 상한은 100~2000) */
const alive = new Set(['a1']);
const bigLog = Array.from({ length: 2100 }, (_, i) => ({ id: `m${i}`, anchor: 'a1', amount: 1, memo: 'm', src: 'story', at: '' }));
const walletCapNow = (M) => M.addWalletEntry({ start: 0, log: bigLog }, { anchor: 'a1', amount: 1, memo: 'new', src: 'story', id: 'new' }, alive).log.length;

/** 지금 올라와 있는 값 묶음: 소지품 줄 상한, 소지품 기록 상한, 거래 줄 상한, 요청당 사진 수(고급 설정) */
const now = (M) => ({ list: M.itemListCap(), log: M.itemLogCap(), wallet: walletCapNow(M), images: M.ATTACH_LIMITS.images });
const stateOf = (M, v) => ({
  [M.ITEM_LIST_CAP_VAR]: String(v.list), [M.ITEM_LOG_CAP_VAR]: String(v.log), [M.WALLET_CAP_VAR]: String(v.wallet),
  [M.advVar('gen', M.advItem('gen', 'image_max'))]: String(v.images),
});
const A = { list: 200, log: 300, wallet: 700, images: 3 };
const B = { list: 500, log: 1000, wallet: 1500, images: 12 };
const DEF = { list: 200, log: 400, wallet: 400, images: 8 };

/** 채팅 A(0:0)·B(0:1)를 넣고 B 를 연다 */
async function openB(M) {
  chats.clear();
  chats.set('0:0', { message: [], scriptstate: stateOf(M, A) });
  chats.set('0:1', { message: [], scriptstate: stateOf(M, B) });
  current = { char: 0, chat: 1 };
  const ctx = await M.loadContext();
  assert.ok(ctx, 'loadContext 가 채팅 B 를 읽어야 한다');
}

test('(a) B 를 열어 둔 채 A 를 저장: 저장 안에서는 A 값, 끝나면 B 값', async () => {
  const M = await fresh();
  await openB(M);
  // loadContext 는 고급 설정 가운데 요청당 사진 수만 맞춘다. 나머지는 B 값이어야 한다
  assert.deepEqual(now(M), B);
  let inside = null;
  const saved = await M.updateChat(0, 0, (cur) => { inside = now(M); return { ...cur, scriptstate: { ...cur.scriptstate, touched: '1' } }; });
  assert.deepEqual(inside, A, '저장 안에서는 저장하는 채팅(A) 값');
  assert.equal(saved.scriptstate.touched, '1');
  assert.equal(chats.get('0:0').scriptstate.touched, '1');
  assert.deepEqual(now(M), B, '저장이 끝나면 열려 있는 채팅(B) 값');
});

test('(a) A 저장이 A 의 상한을 바꿔도 열려 있는 B 값은 그대로', async () => {
  const M = await fresh();
  await openB(M);
  await M.updateChat(0, 0, (cur) => ({ ...cur, scriptstate: { ...cur.scriptstate, [M.ITEM_LIST_CAP_VAR]: '850', [M.WALLET_CAP_VAR]: '900' } }));
  assert.equal(chats.get('0:0').scriptstate[M.ITEM_LIST_CAP_VAR], '850');
  assert.deepEqual(now(M), B);
});

test('(b) 열려 있는 채팅을 저장하며 상한을 바꾸면 새 값이 올라온다', async () => {
  const M = await fresh();
  await openB(M);
  const C = { list: 750, log: 600, wallet: 1100, images: 5 };
  let inside = null;
  await M.updateChat(0, 1, (cur) => { inside = now(M); return { ...cur, scriptstate: { ...cur.scriptstate, ...stateOf(M, C) } }; });
  assert.deepEqual(inside, B, '바꾸기 전에는 B 의 옛 값');
  assert.deepEqual(now(M), C, '저장한 값이 곧 열려 있는 채팅 값');
  // 그 뒤 다른 채팅을 저장해도 새 값으로 되돌아온다 (기억해 둔 값이 저장한 값으로 바뀌었다)
  await M.updateChat(0, 0, (cur) => ({ ...cur }));
  assert.deepEqual(now(M), C);
});

test('(c) 바꾸는 함수가 null 을 돌려줘도 B 값으로 되돌린다', async () => {
  const M = await fresh();
  await openB(M);
  let inside = null;
  const saved = await M.updateChat(0, 0, () => { inside = now(M); return null; });
  assert.equal(saved, null);
  assert.deepEqual(inside, A);
  assert.deepEqual(now(M), B);
});

test('(c) 바꾸는 함수가 던져도 B 값으로 되돌린다', async () => {
  const M = await fresh();
  await openB(M);
  let inside = null;
  await assert.rejects(M.updateChat(0, 0, () => { inside = now(M); throw new Error('boom'); }), /boom/);
  assert.deepEqual(inside, A);
  assert.deepEqual(now(M), B);
});

test('(c) 열려 있는 채팅 저장이 null·던짐이면 B 의 옛 값 그대로', async () => {
  const M = await fresh();
  await openB(M);
  assert.equal(await M.updateChat(0, 1, () => null), null);
  assert.deepEqual(now(M), B);
  await assert.rejects(M.updateChat(0, 1, () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(now(M), B);
});

test('(c) 저장할 채팅이 없어 실패해도 B 값은 그대로', async () => {
  const M = await fresh();
  await openB(M);
  await assert.rejects(M.updateChat(0, 9, (cur) => cur));
  assert.deepEqual(now(M), B);
});

test('(d) 아직 채팅을 읽은 적이 없으면 저장한 채팅 값이 남는다 (옛 동작)', async () => {
  const M = await fresh();
  chats.clear();
  chats.set('0:0', { message: [], scriptstate: stateOf(M, A) });
  assert.deepEqual(now(M), DEF, '처음에는 기본값');
  await M.updateChat(0, 0, (cur) => ({ ...cur }));
  assert.deepEqual(now(M), A);
  await M.updateChat(0, 0, () => null);
  assert.deepEqual(now(M), A);
});
