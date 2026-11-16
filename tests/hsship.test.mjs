// 망상홈쇼핑 택배 상자가 닿는 때 (2026-11-16 사용자: 주문하자마자가 아니라 몰래 뽑은 턴에 닿고, 닿은 턴에만 메인 요청에 받는 법을 넘긴다. 출연은 상자를 열 때 걸린다)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist-test/core.mjs';
const { homeshop, hsship } = core;
const { newOrder, ordersVars, readOrders, liveOrders, orderArrived, dueOrders, boxOrder, openOrder } = homeshop;
const { deliverOrders } = hsship;

const chatOf = (turns, vars = {}) => ({ message: Array.from({ length: turns * 2 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `m${i}`, chatId: `c${i}` })), scriptstate: vars });
const sent = (chat) => ({ ...chat, message: [...chat.message, { role: 'user', data: 'go', chatId: `u${chat.message.length}` }] });
const answered = (chat, id) => ({ ...chat, message: [...chat.message, { role: 'char', data: 'r', chatId: id }] });
const keys = (chat) => new Set(chat.message.map((m) => m.chatId));
const ITEM = { id: 'x1', name: '행운의 무전기', desc: '광고', effect: '누군가 받는다', truth: '받는 쪽은 죽은 사람', use: true, price: 0, pay: '무이자 3회', weight: 0.4 };
const TERMS = { money: 0, items: [], appear: 3, other: '' };
const apply = (chat, vars) => (vars ? { ...chat, scriptstate: { ...chat.scriptstate, ...vars } } : chat);
const boxes = (chat) => core.liveItems(core.readItems(chat.scriptstate), keys(chat)).filter((x) => x.store === 'hs');
const arriveText = core.guideTxt('Hs', 'ARRIVE').trim();

test('택배 상자: 0턴으로 뽑히면 주문한 턴에 바로 닿고, 다음 요청에 받는 법이 한 번 간다', () => {
  let chat = chatOf(2);
  chat = apply(chat, ordersVars([newOrder(chat, ITEM, { ship: [0, 0] }, 'appear', TERMS)]));
  assert.equal(dueOrders(chat).length, 1);
  chat = apply(chat, deliverOrders(chat));
  const o = readOrders(chat.scriptstate)[0];
  assert.equal(o.boxKey, 'c3', '주문한 턴의 응답에 묶인다');
  assert.equal(boxes(chat).length, 1);
  assert.equal(boxes(chat)[0].id, o.boxId);
  assert.ok(!String(boxes(chat)[0].paidWith).includes('출연'), '상자에는 출연을 적지 않는다 (열 때 걸린다)');
  assert.equal(deliverOrders(chat), null, '두 번 넣지 않는다');
  assert.ok(arriveText.length > 0);
  assert.ok(core.inventoryText(sent(chat)).includes(arriveText), '닿은 턴의 요청');
  const later = sent(answered(sent(chat), 'r1'));
  assert.ok(!core.inventoryText(later).includes(arriveText), '그다음 턴에는 안 간다');
});

test('택배 상자: 뽑힌 턴이 될 때까지 「오는 중」이고 메인 요청에 아무것도 안 간다', () => {
  let chat = chatOf(2);
  chat = apply(chat, ordersVars([newOrder(chat, ITEM, { ship: [2, 2] }, 'appear', TERMS)]));
  assert.equal(readOrders(chat.scriptstate)[0].arrive, 4);
  assert.equal(deliverOrders(chat), null);
  assert.equal(boxes(chat).length, 0);
  assert.equal(core.inventoryText(sent(chat)), core.inventoryText(sent(chatOf(2))), '주문만 한 턴: 주문 안 한 것과 같은 글');
  // 3턴째 응답 뒤: 아직
  chat = answered(sent(chat), 'r3');
  assert.equal(deliverOrders(chat), null);
  assert.equal(orderArrived(liveOrders(chat.scriptstate, keys(chat))[0], keys(chat)), false);
  // 4턴째를 보낸 동안(답 전)에는 넣지 않는다 — 넣으면 한 턴 일찍 알려진다
  assert.equal(deliverOrders(sent(chat)), null);
  assert.ok(!core.inventoryText(sent(chat)).includes(arriveText));
  // 4턴째 응답 뒤: 닿는다. 5턴째 요청에 받는 법
  chat = answered(sent(chat), 'r4');
  chat = apply(chat, deliverOrders(chat));
  assert.equal(readOrders(chat.scriptstate)[0].boxKey, 'r4');
  assert.equal(boxes(chat).length, 1);
  assert.ok(core.inventoryText(sent(chat)).includes(arriveText));
});

test('택배 상자: 닿은 응답을 다시 굴리면 상자가 없던 일이 되고 새 응답에 다시 닿는다 (닿는 턴은 다시 뽑지 않는다)', () => {
  let chat = chatOf(2);
  chat = apply(chat, ordersVars([newOrder(chat, ITEM, { ship: [1, 1] }, 'appear', TERMS)]));
  const base = sent(chat);
  let a = answered(base, 'rA');
  a = apply(a, deliverOrders(a));
  assert.equal(boxes(a).length, 1);
  // 다시 굴림: rA 가 지워지고 rB
  const rolled = { ...a, message: base.message };
  assert.equal(boxes(rolled).length, 0, '옛 응답의 상자는 죽는다');
  assert.equal(deliverOrders(rolled), null, '답을 받기 전에는 넣지 않는다');
  assert.ok(!core.inventoryText(rolled).includes(arriveText), '다시 굴리는 요청에 받는 법이 새지 않는다');
  let b = answered(rolled, 'rB');
  b = apply(b, deliverOrders(b));
  assert.equal(readOrders(b.scriptstate)[0].boxKey, 'rB');
  assert.equal(readOrders(b.scriptstate)[0].arrive, 3);
  assert.equal(boxes(b).length, 1);
});

test('택배 상자: 연 턴에는 받는 법이 다시 가지 않는다', () => {
  let chat = chatOf(2);
  chat = apply(chat, ordersVars([newOrder(chat, ITEM, { ship: [0, 0] }, 'appear', TERMS)]));
  chat = apply(chat, deliverOrders(chat));
  // 닿은 턴이 지나고 다음 응답(r1) 뒤에 연다 (ui/homeshop.ts openBox 와 같은 순서)
  chat = answered(sent(chat), 'r1');
  const alive = keys(chat);
  const o = boxOrder(chat.scriptstate, readOrders(chat.scriptstate)[0].boxId, alive);
  assert.ok(o);
  let items = core.readItems(chat.scriptstate);
  items = { ...items, list: items.list.map((x) => (x.id === o.boxId ? { ...x, soldAt: 'r1' } : x)) };
  items = core.addItem(items, alive, { name: o.item.name, from: 'store', store: 'hs', anchor: 'r1', paidWith: homeshop.orderPaid(o, true) });
  chat = apply(chat, { ...core.itemsVars(items), ...ordersVars([openOrder(chat, o, { call: [3, 3] }, 'r1', () => 0)]) });
  const text = core.inventoryText(sent(chat));
  assert.ok(text.includes('행운의 무전기'), text);
  assert.ok(!text.includes(arriveText), '상자를 연 턴에 도착 글이 다시 가지 않는다');
  assert.ok(text.includes('무이자 출연 3회'), '연 물건에는 치른 것 전부(출연 포함)');
  assert.deepEqual(readOrders(chat.scriptstate)[0].dues, [6, 9, 12], '출연 호출은 연 때부터');
});

test('택배 상자: 원으로 치른 주문의 상자는 값과 거래 id 를 이어받는다', () => {
  let chat = chatOf(1);
  const o = { ...newOrder(chat, { ...ITEM, price: 39000 }, { ship: [0, 0] }, 'won', { money: 39000, items: [], appear: 0, other: '' }), walletId: 'w1' };
  chat = apply(chat, ordersVars([o]));
  chat = apply(chat, deliverOrders(chat));
  const box = boxes(chat)[0];
  assert.equal(box.price, 39000);
  assert.equal(box.walletId, 'w1');
});
