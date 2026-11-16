// 망상홈쇼핑 택배 상자 (2026-11-16 사용자: 주문하면 바로 받는다). 받는 법(ARRIVE)은 상자가 들어온 턴의 메인 요청에 한 번만 가고, 출연은 상자를 열 때 걸린다
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist-test/core.mjs';
const { homeshop } = core;
const { newOrder, ordersVars, readOrders, boxOrder, openOrder, orderPaid, HS_BOX } = homeshop;

const chatOf = (turns, vars = {}) => ({ message: Array.from({ length: turns * 2 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `m${i}`, chatId: `c${i}` })), scriptstate: vars });
const sent = (chat) => ({ ...chat, message: [...chat.message, { role: 'user', data: 'go', chatId: `u${chat.message.length}` }] });
const answered = (chat, id) => ({ ...chat, message: [...chat.message, { role: 'char', data: 'r', chatId: id }] });
const keys = (chat) => new Set(chat.message.map((m) => m.chatId));
const ITEM = { id: 'x1', name: '행운의 무전기', desc: '광고', effect: '누군가 받는다', truth: '받는 쪽은 죽은 사람', use: true, price: 0, pay: '무이자 3회', weight: 0.4 };
const TERMS = { money: 0, items: [], appear: 3, other: '' };
const arriveText = core.guideTxt('Hs', 'ARRIVE').trim();
/** 주문 확정 (ui/homeshop.ts order 와 같은 순서): 장부 줄 + 그 자리에서 소지품에 상자 */
const order = (chat, item = ITEM, pay = 'appear', terms = TERMS, walletId = '') => {
  const o = newOrder(chat, item, pay, terms);
  const name = HS_BOX.name(item.name);
  const items = core.addItem(core.readItems(chat.scriptstate), keys(chat), { name, desc: HS_BOX.desc, icon: HS_BOX.icon, weight: item.weight, from: 'store', store: 'hs', anchor: o.anchor, paidWith: orderPaid(o, false), ...(terms.money > 0 ? { price: terms.money, walletId } : {}) });
  o.boxId = core.itemId(o.anchor, name);
  return { ...chat, scriptstate: { ...chat.scriptstate, ...core.itemsVars(items), ...ordersVars([o]) } };
};

test('택배 상자: 주문하면 바로 소지품에 들어오고, 다음 요청에 받는 법이 한 번만 간다', () => {
  let chat = order(chatOf(2));
  const o = readOrders(chat.scriptstate)[0];
  assert.equal(o.anchor, 'c3', '주문한 응답에 묶인다');
  assert.ok(boxOrder(chat.scriptstate, o.boxId, keys(chat)), '안 연 상자');
  const text = core.inventoryText(sent(chat));
  assert.ok(text.includes(arriveText), text);
  assert.ok(!text.includes('시연 참여'), '상자에는 출연을 적지 않는다 (열 때 걸린다)');
  chat = answered(sent(chat), 'r1');
  assert.ok(!core.inventoryText(sent(chat)).includes(arriveText), '그다음 턴에는 다시 가지 않는다');
});

test('택배 상자: 주문한 응답을 지우면 주문도 상자도 없던 일', () => {
  const chat = order(chatOf(2));
  const gone = { ...chat, message: chat.message.slice(0, 3) };
  assert.equal(homeshop.liveOrders(gone.scriptstate, keys(gone)).length, 0);
  assert.equal(core.liveItems(core.readItems(gone.scriptstate), keys(gone)).filter((x) => x.store === 'hs').length, 0);
});

test('택배 상자: 연 턴에는 받는 법이 다시 가지 않고, 출연은 연 때부터 걸린다', () => {
  let chat = answered(sent(order(chatOf(2))), 'r1');
  const alive = keys(chat);
  const o = boxOrder(chat.scriptstate, readOrders(chat.scriptstate)[0].boxId, alive);
  assert.ok(o);
  // ui/homeshop.ts openBox 와 같은 순서
  let items = core.readItems(chat.scriptstate);
  items = { ...items, list: items.list.map((x) => (x.id === o.boxId ? { ...x, soldAt: 'r1' } : x)) };
  items = core.addItem(items, alive, { name: o.item.name, from: 'store', store: 'hs', anchor: 'r1', paidWith: orderPaid(o, true) });
  chat = { ...chat, scriptstate: { ...chat.scriptstate, ...core.itemsVars(items), ...ordersVars([openOrder(chat, o, { call: [3, 3] }, 'r1', () => 0)]) } };
  const text = core.inventoryText(sent(chat));
  assert.ok(text.includes('행운의 무전기'), text);
  assert.ok(!text.includes(arriveText), '상자를 연 턴에 도착 글이 다시 가지 않는다');
  assert.ok(text.includes('다음 방송 시연 참여'), '연 물건에는 치른 것 전부(출연 포함)');
  assert.deepEqual(readOrders(chat.scriptstate)[0].dues, [6], '시연 호출은 연 때부터, 한 번');
});

test('택배 상자: 원으로 치른 주문의 상자는 값과 거래 id 를 잇는다', () => {
  const chat = order(chatOf(1), { ...ITEM, price: 39000 }, 'won', { money: 39000, items: [], appear: 0, other: '' }, 'w1');
  const box = core.liveItems(core.readItems(chat.scriptstate), keys(chat)).find((x) => x.store === 'hs');
  assert.equal(box.price, 39000);
  assert.equal(box.walletId, 'w1');
});

test('우주몰 맞춤 주문을 받은 턴에는 제 받는 법(ARRIVE_ORDER)이 간다: 송금 순간이 아니다 (2026-11-16)', () => {
  const order = core.guideTxt('Cos', 'ARRIVE_ORDER').trim();
  const site = core.guideTxt('Cos', 'ARRIVE').trim();
  assert.ok(order && !/transfer lands/.test(order) && /transfer lands/.test(site));
  assert.deepEqual(core.arrivals([{ name: '맞춤 장갑', store: 'cos-order' }]), [order]);
  assert.deepEqual(core.arrivals([{ name: '우주 양말', store: 'cos' }]), [site]);
  assert.deepEqual(core.arrivals([{ name: '우주 양말', store: 'cos' }, { name: '맞춤 장갑', store: 'cos-order' }]), [site, order]);
});
