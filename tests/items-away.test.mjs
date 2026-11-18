// 치운 물건 기억 (2026-11-17 사용자): 치운 뒤 N턴까지만 기억한다. 지나면 목록에서 지우고 자료 items_away 에도 안 넘긴다. 물건 줄 상한은 설정
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, applyItemChanges, forgetAway, itemAwayTurns, itemListCapOf, itemsAwayOf, itemsVars, liveItems, removeItem, setItemRules } from '../dist-test/core.mjs';

const empty = { list: [], log: [] };
const ch = (o) => ({ desc: '', effect: '', ...o });
/** 봇 응답 n 개짜리 채팅 (c1, u1, c2, u2, …) */
const keysOf = (n) => Array.from({ length: n }, (_, i) => [`c${i + 1}`, `u${i + 1}`]).flat().slice(0, n * 2 - 1);
const chatOf = (it, n, vars = {}) => ({ message: keysOf(n).map((k) => ({ role: k[0] === 'u' ? 'user' : 'char', data: 'x', chatId: k })), scriptstate: { ...itemsVars(it), ...vars } });
const T = (n) => ({ $it_away_turns: String(n) });

function base(n) {
  const alive = new Set(keysOf(n));
  let it = addItem(empty, alive, { name: '손전등', from: 'story', anchor: 'c1', quote: 'q' });
  it = addItem(it, alive, { name: '우산', from: 'story', anchor: 'c1', quote: 'q' });
  it = addItem(it, alive, { name: '유리병', from: 'story', anchor: 'c1', quote: 'q' });
  it = addItem(it, alive, { name: '수첩', from: 'story', anchor: 'c1', quote: 'q' });
  it = applyItemChanges(it, alive, [
    ch({ anchor: 'c2', name: '손전등', action: 'gone', quote: 'q' }),
    ch({ anchor: 'c2', name: '우산', action: 'left', place: '현관', quote: 'q' }),
    ch({ anchor: 'c2', name: '유리병', action: 'destroyed', quote: 'q' }),
  ], { order: keysOf(n) });
  return it;
}

test('설정 값: 기본 30, 0 = 계속, 이상한 값은 기본. 물건 줄 상한 기본 200, 50~1000', () => {
  assert.equal(itemAwayTurns(undefined), 30);
  assert.equal(itemAwayTurns(T(0)), 0);
  assert.equal(itemAwayTurns(T(5)), 5);
  assert.equal(itemAwayTurns({ $it_away_turns: 'x' }), 30);
  assert.equal(itemAwayTurns(T(9999)), 300);
  assert.equal(itemListCapOf(undefined), 200);
  assert.equal(itemListCapOf({ $it_list_cap: '10' }), 50);
  assert.equal(itemListCapOf({ $it_list_cap: '5000' }), 1000);
  assert.equal(itemListCapOf({ $it_list_cap: '300' }), 300);
});

test('N턴 안: 그대로 넘어가고 줄도 남는다. N턴이 지나면 items_away 에서 빠지고 저장 정리가 줄을 지운다 (기록은 그대로)', () => {
  setItemRules(undefined);
  // c2 에 치움. 응답 5개(c5) = 치운 뒤 3턴
  const it = base(5);
  assert.deepEqual(itemsAwayOf(chatOf(it, 5, T(3))), [{ name: '손전등' }, { name: '우산', place: '현관' }]);
  assert.equal(forgetAway(it, chatOf(it, 5, T(3))), it);
  // 응답 6개 = 치운 뒤 4턴 → 3턴 기억이면 잊는다
  const it6 = base(6);
  assert.deepEqual(itemsAwayOf(chatOf(it6, 6, T(3))), []);
  const cut = forgetAway(it6, chatOf(it6, 6, T(3)));
  assert.deepEqual(cut.list.map((e) => e.name), ['수첩'], '치운 것은 종류를 가리지 않고(잃음·두고 옴·파괴) 지우고 갖고 있는 것은 남긴다');
  assert.equal(cut.log, it6.log);
  // 0 = 계속
  assert.deepEqual(itemsAwayOf(chatOf(it6, 6, T(0))).length, 2);
  assert.equal(forgetAway(it6, chatOf(it6, 6, T(0))), it6);
  // 기본 30턴
  assert.equal(forgetAway(it6, chatOf(it6, 6)), it6);
});

test('잊은 뒤 되찾으면 새 물건으로 생긴다. 잊기 전이면 같은 줄이 돌아온다', () => {
  setItemRules(undefined);
  const it = base(6);
  const alive = new Set(keysOf(6));
  const id0 = it.list.find((e) => e.name === '손전등').id;
  const same = applyItemChanges(it, alive, [ch({ anchor: 'c6', name: '손전등', action: 'new', quote: 'q' })], { order: keysOf(6) });
  assert.equal(liveItems(same, alive).find((e) => e.name === '손전등').id, id0);
  const cut = forgetAway(it, chatOf(it, 6, T(3)));
  const fresh = applyItemChanges(cut, alive, [ch({ anchor: 'c6', name: '손전등', action: 'new', quote: 'q' })], { order: keysOf(6) });
  const got = liveItems(fresh, alive).find((e) => e.name === '손전등');
  assert.ok(got && got.id !== id0);
});

test('치운 응답이 사라져 돌아온 물건·되찾은 물건은 지우지 않는다', () => {
  setItemRules(undefined);
  const it = base(8);
  // c2 가 지워진 채팅: 치운 것이 전부 돌아와 있다
  const chat = chatOf(it, 8, T(3));
  chat.message = chat.message.filter((m) => m.chatId !== 'c2');
  assert.equal(forgetAway(it, chat), it);
  // c3 에서 되찾은 우산: 한참 지나도 그대로
  const alive = new Set(keysOf(8));
  const back = applyItemChanges(it, alive, [ch({ anchor: 'c3', name: '우산', action: 'new', quote: 'q' })], { order: keysOf(8) });
  const cut = forgetAway(back, chatOf(back, 8, T(3)));
  assert.deepEqual(cut.list.map((e) => e.name).sort(), ['수첩', '우산']);
});

test('사용자가 버린 것: 버린 때의 마지막 메시지에서 센다. 때를 모르는 줄은 지우지 않는다', () => {
  setItemRules(undefined);
  const alive = new Set(keysOf(8));
  let it = addItem(empty, alive, { name: '깡통', from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '끈', from: 'manual', anchor: '' });
  it = removeItem(it, it.list[0].id, 'drop', 'manual', '', { key: 'c2' });
  it = removeItem(it, it.list[1].id, 'drop', 'manual', '');
  assert.deepEqual(itemsAwayOf(chatOf(it, 5, T(3))).map((x) => x.name), ['깡통', '끈']);
  assert.deepEqual(itemsAwayOf(chatOf(it, 6, T(3))).map((x) => x.name), ['끈']);
  assert.deepEqual(forgetAway(it, chatOf(it, 6, T(3))).list.map((e) => e.name), ['끈']);
});

test('물건 줄 상한: 설정한 수를 넘으면 사라진 응답의 줄부터 뺀다', () => {
  setItemRules({ $it_list_cap: '50' });
  const alive = new Set(['c9']);
  let it = empty;
  for (let i = 0; i < 60; i++) it = addItem(it, alive, { name: `낡은 것 ${i}`, from: 'story', anchor: `x${i}`, quote: 'q' });
  assert.equal(it.list.length, 50);
  setItemRules(undefined);
  for (let i = 0; i < 60; i++) it = addItem(it, alive, { name: `또 낡은 것 ${i}`, from: 'story', anchor: `y${i}`, quote: 'q' });
  assert.equal(it.list.length, 110);
});
