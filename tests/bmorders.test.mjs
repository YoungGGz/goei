// 포인트몰 수령 대기 (2026-11-16 사용자: 접속·구매는 어디서든, 받는 것은 회사에서): 사면 「주문 조회」의 수령 대기 → 받기 → 소지품
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/orders'; export { buildUpdate, applyUpdate, assemblePrompt, enabledSections } from './src/core/people/updater'; export { peopleSettings } from './src/core/people/settings'; export { peopleStore } from './src/core/people/store'; export { UPDATER_COMPACT, UPDATER_DETAILED } from './src/core/people/prompt'; export { settleBmPickups, confirmBmPickups, bmPickupConfirm, bmPicked, readItems, liveItems, inventoryText, addItem, itemsVars } from './src/core/items';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.txt': 'text', '.css': 'text' }, logLevel: 'silent' });
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

// ── 「받기」를 본편이 확인해야 들어오게 (2026-11-16 사용자: 갈 수 없는 상황인데 받아 버리면 뜬금없다) ──
const msgs = (n) => Array.from({ length: n }, (_, i) => [{ role: 'user', data: 'x', chatId: `u${i + 1}` }, { role: 'char', data: '답.', chatId: `c${i + 1}` }]).flat();
const ON = { $pp_on: '1' };

test('받기를 누르면 「수령하러 감」: 물건은 안 들어오고, 다음 응답이 나오면 묵은 표시(수령 대기), 그 응답을 다시 굴리면 되살아남', () => {
  const r = M.requestBmOrders([order('a', '재생 물약', 'c1'), order('b', '탈모약', 'c1'), order('c', '팝콘', 'c1', { taken: true, takenKey: 'c1' })], 'c2', ['a']);
  assert.deepEqual(r.got.map((o) => o.id), ['a']);
  const a = r.list.find((o) => o.id === 'a');
  assert.equal(a.taken, undefined); assert.equal(a.reqKey, 'c2');
  assert.equal(M.bmGoing(a, 'c2'), true); assert.equal(M.bmGoing(a, 'c3'), false, '다음 응답이 나오면 수령 대기로');
  assert.equal(M.bmGoing(r.list.find((o) => o.id === 'b'), 'c2'), false);
  assert.equal(M.requestBmOrders(r.list, 'c2', ['a']).got.length, 0, '이미 가는 중이면 다시 안 적는다');
  const all = M.requestBmOrders(r.list, 'c2');
  assert.deepEqual(all.got.map((o) => o.id), ['b'], '모두 받기: 안 받았고 아직 안 가는 것만');
  assert.deepEqual(M.bmAsked(all.list, 'c2').map((o) => o.id), ['a', 'b']); assert.equal(M.bmAsked(all.list, 'c3').length, 0);
  // 받은 응답(c3)이 죽으면 다시 안 받은 것이 되고, 누른 때의 응답(c2)이 다시 마지막 응답이라 「수령하러 감」으로 되살아난다
  const took = all.list.map((o) => (o.id === 'a' ? { ...o, taken: true, takenKey: 'c3' } : o));
  const back = M.liveBmOrders(M.bmOrdersVars(took), new Set(['c1', 'c2'])).find((o) => o.id === 'a');
  assert.equal(back.taken, false); assert.equal(M.bmGoing(back, 'c2'), true);
});

test('확인할 수 있는 구성인가: 소지품 넘기기 + 포인트몰 「구매」 넘기기 + 갱신기 매 턴', () => {
  assert.equal(M.bmPickupConfirm({ ...ON }), true);
  assert.equal(M.bmPickupConfirm({ $pp_on: '0' }), false, '인물 기록 꺼짐');
  assert.equal(M.bmPickupConfirm({ ...ON, $pp_when: 'manual' }), false, '수동 갱신');
  assert.equal(M.bmPickupConfirm({ ...ON, $bm_sh_main: '0' }), false, '본편에 알릴 길이 없음');
});

test('메인 요청: 받으러 가는 턴에 PICKUP_TRY 한 번 (가는 것은 대기 줄에서 빠짐), 다음 응답 뒤에는 대기 줄로 돌아옴', () => {
  const list = M.requestBmOrders([order('a', '재생 물약', 'c1'), order('b', '탈모약', 'c1')], 'c1', ['a']).list;
  const go = { message: msgs(1), scriptstate: { ...ON, ...M.bmOrdersVars(list) } };
  const t1 = M.inventoryText(go);
  assert.match(t1, /sets out to collect in person[^\n]*재생 물약/); assert.match(t1, /only if the scene lets them/);
  assert.match(t1, /not collected yet[^\n]*탈모약/); assert.doesNotMatch(t1, /not collected yet[^\n]*재생 물약/); assert.doesNotMatch(t1, /this turn the protagonist collects in person/);
  const t2 = M.inventoryText({ ...go, message: msgs(2) });
  assert.doesNotMatch(t2, /sets out to collect/, '못 받았으면 다음 턴에는 다시 안 간다'); assert.match(t2, /not collected yet[^\n]*재생 물약/);
  // 갱신기가 안 도는 구성: 받으러 간다는 글은 안 간다 (누르면 바로 들어오는 길)
  assert.doesNotMatch(M.inventoryText({ ...go, scriptstate: { ...go.scriptstate, $pp_on: '0' } }), /sets out to collect/);
});

test('갱신기가 받았다고 한 것만 받음: 산 그대로(진실 포함) from story, 같은 이름 new 는 빼서 둘이 되지 않게', () => {
  const alive = new Set(['c1', 'c2']);
  const orders = M.requestBmOrders([order('a', '재생 물약', 'c1'), order('b', '탈모약', 'c1'), order('c', '방독면', 'c1')], 'c1', ['a', 'b']).list;
  const changes = [{ action: 'new', name: '재생 물약', desc: '모델이 쓴 설명', anchor: 'c2' }, { action: 'new', name: '주운 열쇠', anchor: 'c2' }];
  const r = M.confirmBmPickups(M.readItems({}), orders, M.bmAsked(orders, 'c1'), ['재생 물약', '방독면'], alive, 'c2', changes);
  assert.deepEqual(r.got.map((o) => o.id), ['a'], '받으러 가지 않은 것(방독면)은 답해도 안 받는다');
  assert.deepEqual(r.changes.map((c) => c.name), ['주운 열쇠']);
  assert.equal(r.orders.find((o) => o.id === 'a').takenKey, 'c2'); assert.equal(r.orders.find((o) => o.id === 'b').taken, undefined);
  const got = M.liveItems(r.it, alive);
  assert.equal(got.length, 1); assert.equal(got[0].truth, '숨은 진실'); assert.equal(got[0].desc, '설명'); assert.equal(got[0].from, 'story'); assert.equal(got[0].store, 'bm');
  // 그 뒤 「같은 이름 new → 대기 정산」 길이 다시 넣지 않는다
  const s2 = M.settleBmPickups(r.it, r.orders, alive, r.changes);
  assert.equal(s2.settled, 0); assert.equal(M.liveItems(s2.it, alive).length, 1);
  // 받은 다음 턴에 받는 법(ARRIVE)·받으러 감이 다시 가지 않는다
  const t = M.inventoryText({ message: msgs(2), scriptstate: { ...ON, ...M.itemsVars(r.it), ...M.bmOrdersVars(r.orders) } });
  assert.doesNotMatch(t, /collects in person/); assert.doesNotMatch(t, /sets out to collect/); assert.match(t, /not collected yet[^\n]*탈모약/);
});

test('갱신기 요청·답: 받으러 간 응답에만 pickup_check, 답은 물은 이름만, 답 칸이 없으면 못 받음', () => {
  const chat = { message: msgs(2), scriptstate: { ...ON } };
  const settings = M.peopleSettings(chat.scriptstate);
  const store = M.peopleStore(chat);
  const base = { settings, system: '', values: {}, names: [], roster: [], exclude: [] };
  const input = M.buildUpdate(chat, store, [3], { ...base, pickup: { at: 3, items: ['재생 물약', '탈모약'] } });
  assert.deepEqual(input.data.pickup_check.items, ['재생 물약', '탈모약']); assert.equal(input.data.want.pickup, true);
  assert.equal(M.buildUpdate(chat, store, [3], { ...base }).data.pickup_check, undefined, '받으러 간 것이 없으면 칸이 없다');
  const run = (value) => M.applyUpdate(M.peopleStore(chat), chat, input, value, { settings, sheetOf: () => null, baseOf: () => null, exclude: [] }).pickup;
  assert.deepEqual(run({ pickup: ['재생 물약', '없는 물건'] }), { anchor: 'c2', names: ['재생 물약'] });
  assert.deepEqual(run({ pickup: [] }).names, []);
  assert.deepEqual(run({}).names, [], '답 칸이 없으면 못 받은 것');
  // 지침: 물을 때만 절과 출력 칸이 들어간다 (자세히·간결 둘 다)
  for (const g of [M.UPDATER_DETAILED, M.UPDATER_COMPACT]) {
    const on = M.assemblePrompt(g, new Set([...M.enabledSections(settings), 'pickup']));
    const off = M.assemblePrompt(g, M.enabledSections(settings));
    assert.match(on, /pickup_check\.items/); assert.match(on, /"pickup":\[/);
    assert.doesNotMatch(off, /pickup/);
  }
});
