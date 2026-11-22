// 전수점검 2차 재확인 「04 망상홈쇼핑」 HS2-1: 소지품을 끈 채 주문하면 상자를 둘 데가 없다 — 어느 결제 방법으로도 주문이 들어가지 않고 돈도 빠지지 않는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await build({
  stdin: {
    contents: `export { shopSource } from './src/ui/shop';
export { homeshopAction, resetHomeshop, payOk } from './src/ui/homeshop';
export { showVars, readOrders, hsSettings } from './src/core/homeshop';
export { readWallet, walletBalance, aliveAnchors } from './src/core/wallet';
export { readItems } from './src/core/items';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const dir = mkdtempSync(join(tmpdir(), 'goei-hs3b-'));
const file = join(dir, 'm.mjs');
writeFileSync(file, out.outputFiles[0].text);
const M = await import(pathToFileURL(file).href);

const ITEM = { id: 'p1', name: '젖지 않는 우산', price: 800000, desc: '비를 막아 줍니다.', effect: '젖지 않는다', truth: '?', use: true, pay: '', weight: 0.5 };
const show = () => ({ loaded: true, key: 'k1', title: '', at: 0, prev: [], chat: [], parts: [{ item: ITEM, cues: [], inst: 1 }] });

function setup(vars) {
  let chat = {
    message: [{ role: 'user', data: '본다', chatId: 'u1' }, { role: 'char', data: '골목.', chatId: 'c1' }],
    scriptstate: { $hs_net: '1', $hs_op_hello: '0', $hs_op_done: '0', $st_wallet: JSON.stringify({ start: 2000000, list: [] }), ...M.showVars(show()), ...vars },
  };
  globalThis.risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    nativeFetch: async () => { throw new Error('막힘'); },
    runLLMModel: async () => ({ type: 'success', result: '' }),
    getChatFromIndex: async () => structuredClone(chat),
    setChatToIndex: async (_a, _b, next) => { chat = structuredClone(next); },
  };
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: { name: '괴이봇', desc: '', globalLore: [] }, chat: structuredClone(chat) });
  const env = { render() {}, refresh: async () => {}, current: () => ctx() };
  return { act: (a, v) => M.homeshopAction(a, v, ctx(), env), ctx, get chat() { return chat; } };
}

test('HS2-1: 소지품이 꺼져 있으면 어느 결제 방법도 고를 수 없고, 원 결제 주문을 눌러도 돈이 빠지지 않는다', async () => {
  M.resetHomeshop();
  const R = setup({ $it_on: '0' });
  const part = show().parts[0];
  const s = M.hsSettings(R.chat.scriptstate);
  for (const p of ['won', 'barter', 'talk', 'appear']) assert.equal(M.payOk(R.ctx(), part, s, p), false, p);
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'won');
  await R.act('hs-order');
  assert.equal(M.readOrders(R.chat.scriptstate).length, 0, '주문이 들어가지 않는다');
  assert.equal(M.walletBalance(M.readWallet(R.chat.scriptstate, 0), M.aliveAnchors(R.chat)), 2000000, '돈이 빠지지 않는다');
  assert.equal(M.readItems(R.chat.scriptstate).list.length, 0);
});

test('HS2-1: 소지품이 켜져 있으면 원 결제 주문이 그대로 들어간다', async () => {
  M.resetHomeshop();
  const R = setup({});
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'won');
  await R.act('hs-order');
  assert.equal(M.readOrders(R.chat.scriptstate).length, 1);
  assert.equal(M.walletBalance(M.readWallet(R.chat.scriptstate, 0), M.aliveAnchors(R.chat)), 1200000);
});
