// 포인트몰 수령 대기 (2026-11-16 사용자: 접속·구매는 어디서든, 받는 것은 회사에서): 사면 「주문 조회」의 수령 대기 → 받기 → 소지품
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/orders'; export { settleBmPickups, bmPicked, readItems, liveItems, inventoryText, addItem, itemsVars } from './src/core/items';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.txt': 'text', '.css': 'text' }, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const order = (id, name, anchor, more = {}) => ({ id, anchor, price: 300, walletId: id, paidWith: '300 Baekilmong points at 백일몽 포인트몰', item: { name, desc: '설명', effect: '광고', truth: '숨은 진실', use: true }, ...more });

test('살아 있음: 산 응답이 죽으면 대기도 없음, 받은 응답이 죽으면 다시 수령 대기', () => {
  const vars = M.bmOrdersVars([order('a', '재생 물약', 'c1'), order('b', '탈모약', 'c1', { taken: true, takenKey: 'c3' })]);
  assert.equal(M.bmWaiting(vars, new Set(['c1', 'c3'])).length, 1);
  assert.equal(M.liveBmOrders(vars, new Set(['c1', 'c3'])).find((o) => o.id === 'b').taken, true);
  assert.equal(M.bmWaiting(vars, new Set(['c1'])).length, 2, '받은 응답이 죽으면 다시 수령 대기');
  assert.equal(M.bmWaiting(vars, new Set([])).length, 0, '산 응답이 죽으면 대기도 없음 (포인트가 돌아온다)');
});

test('받기 하나 · 모두 받기, 넘쳐도 안 받은 것은 안 버림', () => {
  const list = [order('a', '재생 물약', 'c1'), order('b', '탈모약', 'c1'), order('c', '팝콘', 'c2')];
  const one = M.takeBmOrders(list, 'c5', ['b']);
  assert.deepEqual(one.got.map((o) => o.id), ['b']);
  assert.equal(one.list.find((o) => o.id === 'b').takenKey, 'c5');
  const all = M.takeBmOrders(one.list, 'c6');
  assert.deepEqual(all.got.map((o) => o.id), ['a', 'c'], '이미 받은 것은 다시 안 받음');
  assert.equal(M.takeBmOrders(all.list, 'c7').got.length, 0);
  const many = Array.from({ length: M.BM_ORDERS_MAX + 5 }, (_, i) => order(`w${i}`, `물건${i}`, 'c1'));
  assert.equal(M.pruneBmOrders(many).length, many.length, '안 받은 것은 버리지 않는다');
  const mixed = [...Array.from({ length: 5 }, (_, i) => order(`t${i}`, `받은${i}`, 'c1', { taken: true, takenKey: 'c1' })), ...many];
  assert.equal(M.pruneBmOrders(mixed).filter((o) => o.taken).length, 0, '넘치면 받은 것부터');
});

test('본문이 먼저 받았다고 쓰면: 새 물건을 만들지 않고 대기 줄을 받음으로, 살 때의 진실 그대로', () => {
  const alive = new Set(['c1', 'c2']);
  const orders = [order('a', '재생 물약', 'c1')];
  const r = M.settleBmPickups(M.readItems({}), orders, alive, [{ action: 'new', name: '재생 물약', desc: '모델이 쓴 설명', anchor: 'c2' }, { action: 'new', name: '주운 열쇠', anchor: 'c2' }]);
  assert.equal(r.settled, 1);
  assert.deepEqual(r.changes.map((c) => c.name), ['주운 열쇠'], '처리한 줄은 뺀다');
  assert.equal(r.orders[0].taken, true); assert.equal(r.orders[0].takenKey, 'c2');
  const got = M.liveItems(r.it, alive);
  assert.equal(got.length, 1); assert.equal(got[0].truth, '숨은 진실'); assert.equal(got[0].desc, '설명'); assert.equal(got[0].store, 'bm'); assert.equal(got[0].from, 'story');
  // 이미 받은 것·대기에 없는 이름은 건드리지 않는다
  const again = M.settleBmPickups(r.it, r.orders, alive, [{ action: 'new', name: '재생 물약', anchor: 'c2' }]);
  assert.equal(again.settled, 0); assert.equal(again.changes.length, 1);
});

test('메인 요청: 기다리는 동안 한 줄, 받은 턴에 받는 법 한 번 (방금 삼에는 안 올림), 그 뒤에는 안 감', () => {
  const msgs = (n) => Array.from({ length: n }, (_, i) => [{ role: 'user', data: 'x', chatId: `u${i + 1}` }, { role: 'char', data: '답.', chatId: `c${i + 1}` }]).flat();
  const wait = { message: msgs(1), scriptstate: { ...M.bmOrdersVars([order('a', '재생 물약', 'c1')]) } };
  const t1 = M.inventoryText(wait);
  assert.match(t1, /not collected yet/); assert.match(t1, /재생 물약/); assert.doesNotMatch(t1, /collects in person/);
  // 받기: c1 뒤에 누름 → 물건은 c1 에 묶여 들어온다
  const items = M.addItem(M.readItems({}), new Set(['c1']), { name: '재생 물약', desc: '설명', from: 'store', store: 'bm', anchor: 'c1', paidWith: 'x' });
  const took = { message: msgs(1), scriptstate: { ...M.itemsVars(items), ...M.bmOrdersVars(M.takeBmOrders([order('a', '재생 물약', 'c1')], 'c1').list) } };
  const t2 = M.inventoryText(took);
  assert.match(t2, /collects in person/); assert.match(t2, /Security Team rental storage/); assert.doesNotMatch(t2, /just bought/); assert.doesNotMatch(t2, /not collected yet/);
  const later = { ...took, message: msgs(2) };
  const t3 = M.inventoryText(later);
  assert.doesNotMatch(t3, /collects in person/, '다음 턴에는 다시 안 간다'); assert.match(t3, /재생 물약/);
  // 설정 「메인 요청에 붙이는 것」 포인트몰을 끄면 기다리는 줄도 안 간다
  assert.doesNotMatch(M.inventoryText({ ...wait, scriptstate: { ...wait.scriptstate, '$bm_sh_main': '0' } }), /not collected yet/);
});
