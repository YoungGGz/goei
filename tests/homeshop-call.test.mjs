// 망상홈쇼핑 전화 주문 (ui/homeshop.ts operatorAsk·order): 말로 받은 주문(<deal/>)의 시청 기록 차례 · 다시 굴린 주문의 통화 말 · 단추 주문 조건이 흥정 조건으로 섞이지 않음 · 가계부 끈 채 돈 조건 <deal/>
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
export { homeshopAction, homeshopInput, homeshopTab, resetHomeshop } from './src/ui/homeshop';
export { showVars, readOrders, liveOrders } from './src/core/homeshop';
export { readLog, hsMainContext } from './src/core/hslog';
export { aliveAnchors } from './src/core/wallet';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const code = out.outputFiles[0].text;
let seq = 0;
const dir = mkdtempSync(join(tmpdir(), 'goei-hscall-'));
const fresh = () => { const f = join(dir, `m${++seq}.mjs`); writeFileSync(f, code); return import(pathToFileURL(f).href); };

const ITEM = { id: 'p1', name: '젖지 않는 우산', price: 300000, desc: '비를 막아 줍니다.', effect: '젖지 않는다', truth: '?', use: true, pay: '', weight: 0.5 };
const showOf = () => ({ loaded: true, key: 'k1', title: '', at: 0, prev: [], chat: [], parts: [{ item: ITEM, cues: [], inst: 1 }] });
const TERMS = '<terms>\nmoney|250000\ndemo|yes\n</terms>';

/** 가짜 Risu: 채팅 하나를 들고 있고, 상담원 답은 차례로 내준다 */
function setup(M, vars = {}, answers = []) {
  const calls = [];
  let chat = {
    message: [{ role: 'user', data: '본다', chatId: 'u1' }, { role: 'char', data: '골목.', chatId: 'c1' }],
    scriptstate: { $hs_net: '1', $hs_op_hello: '0', $hs_op_done: '0', ...M.showVars(showOf()), ...vars },
    note: '',
  };
  globalThis.risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    nativeFetch: async () => { throw new Error('막힘'); },
    runLLMModel: async (o) => { calls.push(o.messages.map((m) => m.content).join('\n')); return { type: 'success', result: answers.shift() ?? '' }; },
    getChatFromIndex: async () => structuredClone(chat),
    setChatToIndex: async (_a, _b, next) => { chat = structuredClone(next); },
  };
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: { name: '괴이봇', desc: '', globalLore: [] }, chat: structuredClone(chat) });
  const env = { render() {}, refresh: async () => {}, current: () => ctx() };
  const act = (a, v) => M.homeshopAction(a, v, ctx(), env);
  const say = async (text) => { M.homeshopInput(text, 'hs-op'); await act('hs-op'); };
  return { calls, act, say, get chat() { return chat; }, set chat(c) { chat = c; }, ctx };
}
const settle = () => new Promise((r) => setTimeout(r, 20));
const types = (M, chat) => { const t = M.hsMainContext(chat, 'R', null, 0); return t ? JSON.parse(t.split('\n').at(-2)).records.flatMap((r) => r.lines) : []; };
/** 다시 굴리기: 주문한 응답(c1)을 새 응답으로 바꾼다 */
const reroll = (c) => ({ ...c, message: [c.message[0], { role: 'char', data: '다시 쓴 골목.', chatId: 'c1b' }] });

test('말로 받은 주문: 시청 기록에 수락하는 말 → 상담원 말 → 주문 줄 차례로 적힌다', async () => {
  const M = await fresh();
  M.resetHomeshop();
  const R = setup(M, { $st_wallet: JSON.stringify({ start: 2000000, list: [] }) }, [`<operator>\n이십오만 원에 시연 한 번.\n</operator>\n${TERMS}`, `<operator>\n좋아요, 주문 받았습니다.\n</operator>\n${TERMS}\n<deal/>`]);
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'talk');
  await R.say('얼마예요?');
  await R.say('그걸로 주문할게요.');
  await settle();
  assert.equal(M.readOrders(R.chat.scriptstate).length, 1, '주문이 들어갔다');
  const lines = types(M, R.chat).map((l) => `${l.type}:${l.text}`);
  const i = lines.indexOf('user_to_phone_order_operator:그걸로 주문할게요.');
  const j = lines.indexOf('phone_order_operator:좋아요, 주문 받았습니다.');
  const k = lines.findIndex((l) => l.startsWith('user_order:'));
  assert.ok(i >= 0 && j > i && k > j, lines.join('\n'));
});

test('말로 받은 주문을 다시 굴리면: 주문과 같이 그 말도 본편·다음 상담원 요청에서 빠진다', async () => {
  const M = await fresh();
  M.resetHomeshop();
  const R = setup(M, { $st_wallet: JSON.stringify({ start: 2000000, list: [] }) }, [`<operator>\n이십오만 원에 시연 한 번.\n</operator>\n${TERMS}`, `<operator>\n좋아요, 주문 받았습니다.\n</operator>\n${TERMS}\n<deal/>`, `<operator>\n네?\n</operator>\n${TERMS}`]);
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'talk');
  await R.say('얼마예요?');
  await R.say('그걸로 주문할게요.');
  await settle();
  R.chat = reroll(R.chat);
  assert.equal(M.liveOrders(R.chat.scriptstate, M.aliveAnchors(R.chat)).length, 0, '주문은 없던 일');
  const lines = types(M, R.chat).map((l) => l.text);
  assert.ok(!lines.includes('좋아요, 주문 받았습니다.') && !lines.includes('그걸로 주문할게요.'), lines.join('\n'));
  assert.ok(lines.includes('이십오만 원에 시연 한 번.'), '주문과 무관한 앞 말은 남는다');
  await R.act('hs-pop', '');
  await R.act('hs-pop', 'call');
  await R.say('여보세요?');
  const last = R.calls.at(-1);
  assert.ok(!last.includes('주문 받았습니다') && !last.includes('그걸로 주문할게요'), last);
  assert.ok(last.includes('이십오만 원에 시연 한 번.'));
});

test('단추 주문 뒤 다시 굴리면: 주문 조건이 맞교환·흥정 조건으로 남지 않고, 주문 뒤 상담원 말도 빠진다 (Codex 06)', async () => {
  const M = await fresh();
  M.resetHomeshop();
  const R = setup(M, { $st_wallet: JSON.stringify({ start: 2000000, list: [] }), $hs_op_done: '1' }, ['<operator>\n상자는 벌써 가 있어요.\n</operator>', '<operator>\n감정해 보죠.\n</operator>\n<terms>none</terms>']);
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'won');
  await R.act('hs-order');
  await settle();
  assert.equal(M.readOrders(R.chat.scriptstate).length, 1);
  assert.ok(R.calls[0].includes('300,000'), '주문 뒤 말 요청의 [지금 조건]은 방금 주문 조건');
  assert.ok(types(M, R.chat).some((l) => l.text === '상자는 벌써 가 있어요.'));
  R.chat = reroll(R.chat);
  assert.ok(!types(M, R.chat).some((l) => l.text === '상자는 벌써 가 있어요.'), '주문 뒤 말도 주문과 같이 빠진다');
  // 맞교환·흥정으로 바꿔 주문 단추를 눌러도 상담원이 낸 적 없는 조건으로 주문이 들어가지 않는다
  await R.act('hs-pop', '');
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'talk');
  await R.act('hs-order');
  await R.act('hs-pay', 'barter');
  await R.act('hs-order');
  await settle();
  assert.equal(M.liveOrders(R.chat.scriptstate, M.aliveAnchors(R.chat)).length, 0, '조건 없이 주문되면 안 된다');
});

test('가계부를 끈 채 상담원이 돈 조건으로 <deal/>: termsBlock 의 가계부 안내가 뜨고 주문은 안 된다', async () => {
  const M = await fresh();
  M.resetHomeshop();
  const R = setup(M, { $st_col_wallet: 'off' }, ['<operator>\n좋아요, 주문 받았습니다.\n</operator>\n<terms>\nmoney|100000\nother|머리카락 한 줌\n</terms>\n<deal/>']);
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'talk');
  await R.say('그걸로 할게요.');
  await settle();
  assert.equal(M.readOrders(R.chat.scriptstate).length, 0, '돈 몫은 받을 수 없어 주문 안 됨');
  const env = { render() {}, refresh: async () => {}, current: () => R.ctx() };
  globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const html = M.homeshopTab(R.ctx(), env);
  assert.ok(html.includes('가계부가 꺼져 있어 돈으로 낼 수 없습니다.'), '조건을 지우기 전에 막힌 까닭을 보인다');
});

test('단추 주문 조건은 다시 굴린 뒤 흥정·맞교환 조건 칸으로 넘어가지 않는다 (주문 뒤 말 끔, Codex 06)', async () => {
  const M = await fresh();
  M.resetHomeshop();
  const R = setup(M, { $st_wallet: JSON.stringify({ start: 2000000, list: [] }) });
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'won');
  await R.act('hs-order');
  R.chat = reroll(R.chat);
  await R.act('hs-pop', '');
  await R.act('hs-pop', 'call');
  await R.act('hs-pay', 'talk');
  await R.act('hs-order');
  await settle();
  assert.equal(M.liveOrders(R.chat.scriptstate, M.aliveAnchors(R.chat)).length, 0, '상담원이 낸 적 없는 조건으로 주문되면 안 된다');
});
