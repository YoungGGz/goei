// 줄 상한은 저장하는 그 채팅의 값으로: 다른 채팅을 열어 둔 사이에 끝난 응답 처리가 열린 채팅의 상한으로 정리하지 않는다 (host/risu.ts saveChat)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'goei-ledger-caps-'));
await build({
  stdin: {
    contents: `
      export { updateChat } from './src/host/risu';
      export { addWalletEntry, readWallet, walletVars, walletBalance, setWalletCap, WALLET_CAP_VAR, WALLET_VAR } from './src/core/wallet';
      export { addItemLog, readItems, itemsVars, setItemRules } from './src/core/items';
      export { ITEM_LOG_CAP_VAR } from './src/core/itemrules';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(dir, 'caps.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.css': 'text', '.txt': 'text', '.svg': 'text', '.html': 'text', '.png': 'dataurl', '.webp': 'dataurl' },
});
const chats = new Map();
globalThis.matchMedia ??= () => ({ matches: false });
globalThis.risuai = {
  getChatFromIndex: async (c, i) => chats.get(`${c}:${i}`) ?? null,
  setChatToIndex: async (c, i, chat) => { chats.set(`${c}:${i}`, chat); },
};
const M = await import(pathToFileURL(join(dir, 'caps.mjs')));

const alive = new Set(['a1']);
const walletOf = (n) => ({ start: 0, log: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, anchor: 'a1', amount: 10, memo: 'm', src: 'story', at: '' })) });
const itemsOf = (n) => ({ list: [], log: Array.from({ length: n }, (_, i) => ({ id: `l${i}`, name: `물건${i}`, what: 'drop', by: 'manual', anchor: 'a1', at: '' })) });

test('가계부: 다른 채팅의 상한(100)이 올라와 있어도 저장하는 채팅의 상한(기본 400)으로 정리한다', async () => {
  chats.set('0:0', { message: [], scriptstate: { ...M.walletVars(walletOf(300)) } });
  M.setWalletCap({ [M.WALLET_CAP_VAR]: '100' }); // 다른 채팅을 열어 둔 상태
  const saved = await M.updateChat(0, 0, (cur) => ({ ...cur, scriptstate: { ...cur.scriptstate, ...M.walletVars(M.addWalletEntry(M.readWallet(cur.scriptstate), { anchor: 'a1', amount: 10, memo: 'new', src: 'story', id: 'new' }, alive)) } }));
  const w = M.readWallet(saved.scriptstate);
  assert.equal(w.log.length, 301);
  assert.equal(w.start, 0);
  assert.equal(M.walletBalance(w, alive), 3010);
});

test('가계부: 저장하는 채팅의 상한이 100이면 다른 채팅 값(2000)이 올라와 있어도 100줄로 정리한다', async () => {
  chats.set('0:1', { message: [], scriptstate: { ...M.walletVars(walletOf(300)), [M.WALLET_CAP_VAR]: '100' } });
  M.setWalletCap({ [M.WALLET_CAP_VAR]: '2000' });
  const saved = await M.updateChat(0, 1, (cur) => ({ ...cur, scriptstate: { ...cur.scriptstate, ...M.walletVars(M.addWalletEntry(M.readWallet(cur.scriptstate), { anchor: 'a1', amount: 10, memo: 'new', src: 'story', id: 'new' }, alive)) } }));
  const w = M.readWallet(saved.scriptstate);
  assert.equal(w.log.length, 100);
  assert.equal(M.walletBalance(w, alive), 3010);
});

test('소지품 기록: 다른 채팅의 상한(100)이 올라와 있어도 저장하는 채팅의 상한(기본 400)으로 정리한다', async () => {
  chats.set('0:2', { message: [], scriptstate: { ...M.itemsVars(itemsOf(300)) } });
  M.setItemRules({ [M.ITEM_LOG_CAP_VAR]: '100' });
  const saved = await M.updateChat(0, 2, (cur) => ({ ...cur, scriptstate: { ...cur.scriptstate, ...M.itemsVars(M.addItemLog(M.readItems(cur.scriptstate), { name: '라디오', what: 'get', by: 'story', anchor: 'a1', id: 'new' }, alive)) } }));
  assert.equal(M.readItems(saved.scriptstate).log.length, 301);
  chats.set('0:3', { message: [], scriptstate: { ...M.itemsVars(itemsOf(300)), [M.ITEM_LOG_CAP_VAR]: '100' } });
  M.setItemRules(undefined);
  const saved2 = await M.updateChat(0, 3, (cur) => ({ ...cur, scriptstate: { ...cur.scriptstate, ...M.itemsVars(M.addItemLog(M.readItems(cur.scriptstate), { name: '라디오', what: 'get', by: 'story', anchor: 'a1', id: 'new' }, alive)) } }));
  const log = M.readItems(saved2.scriptstate).log;
  assert.equal(log.length, 100);
  assert.equal(log.at(-1).id, 'new');
});
