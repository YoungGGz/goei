// 전수점검 2차 재확인 「08 소지품·가계부」 B1·B2·B3·Q2 고침 시험
// 원칙(사용자 2026-11-22): 본편 응답을 다시 굴리거나 지우면 그 응답이 만든 것(설명·상태·그림·이름·장착 칸)은 전부 되돌아간다.
// 지운 응답이 쓴 「사용」은 아직 안 쓴 자리라 다음 요청에 다시 실린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem, applyItemChanges, liveItems, isEquipped, equipItem, unequipItem, noteEdits, settleEdits, sellItem, itemsVars, readItems,
  inventoryText, usesToSend, useSentAt, settleItemUse, itemLeft, itemUseVars, ITEM_USE_AT_VAR, aliveAnchors, queueUseVars, readItemUse,
} from '../dist-test/core.mjs';

const empty = () => ({ list: [], log: [] });
const ch = (anchor, name, action, extra = {}) => ({ anchor, name, action, desc: '', effect: '', quote: '', ...extra });
const msg = (role, chatId, data = role) => ({ role, data, chatId });

test('B1: 고장·설명을 바꾼 응답을 다시 굴리면 옛 상태·설명으로 돌아오고, 다음 요청에 고장으로 실리지 않는다', () => {
  let it = addItem(empty(), new Set(), { name: '검은 우산', desc: '접힌 검은 우산', use: true, from: 'manual', anchor: '' });
  const a1 = new Set(['c1']);
  it = applyItemChanges(it, a1, [ch('c1', '검은 우산', 'update', { desc: '살이 부러진 우산', state: 'broken' })]);
  assert.equal(liveItems(it, a1)[0].state, 'broken');
  assert.equal(liveItems(it, a1)[0].desc, '살이 부러진 우산');
  // c1 을 다시 굴림 → c1b (바뀜 없는 답)
  const a2 = new Set(['c1b']);
  const e = liveItems(it, a2)[0];
  assert.equal(e.state, 'ok', '다시 굴리면 고장이 풀린다');
  assert.equal(e.desc, '접힌 검은 우산', '설명도 돌아온다');
  const chat = { message: [msg('user', 'u1'), msg('char', 'c1b'), msg('user', 'u2')], scriptstate: itemsVars(it) };
  assert.ok(!/\[broken|cannot be used/.test(inventoryText(chat)), '다음 요청에 고장으로 실리지 않는다');
  // 새 응답의 변화는 되돌린 상태 위에 얹힌다 (옛 응답의 고장이 다시 살아나지 않는다)
  it = applyItemChanges(it, a2, [ch('c1b', '검은 우산', 'update', { desc: '젖은 우산' })]);
  assert.equal(liveItems(it, a2)[0].state, 'ok');
  assert.equal(liveItems(it, a2)[0].desc, '젖은 우산');
  // 살아 있는 응답의 변화는 그대로
  assert.equal(liveItems(it, new Set(['c1b', 'c2']))[0].desc, '젖은 우산');
});

test('B1: 본문에서 다시 얻어 설명이 바뀐 것(new → 같은 이름 갱신)도 그 응답을 다시 굴리면 돌아온다', () => {
  let it = addItem(empty(), new Set(['c0']), { name: '손전등', desc: '작은 손전등', from: 'story', anchor: 'c0' });
  it = applyItemChanges(it, new Set(['c0', 'c1']), [ch('c1', '손전등', 'new', { desc: '불빛이 약해진 손전등' })]);
  assert.equal(liveItems(it, new Set(['c0', 'c1']))[0].desc, '불빛이 약해진 손전등');
  assert.equal(liveItems(it, new Set(['c0', 'c1b']))[0].desc, '작은 손전등');
});

test('B2: 본문 장착·벗음·두고 옴을 다시 굴리면 장착 칸이 돌아온다', () => {
  let it = addItem(empty(), new Set(), { name: '방탄 조끼', desc: '조끼', equip: 'gear', wear: true, from: 'manual', anchor: '' });
  it = addItem(it, new Set(), { name: '야구 방망이', desc: '방망이', equip: 'weapon', from: 'manual', anchor: '' });
  const vest = it.list.find((x) => x.name === '방탄 조끼').id;
  const bat = it.list.find((x) => x.name === '야구 방망이').id;
  const on = (it, alive, id) => isEquipped(liveItems(it, alive).find((x) => x.id === id), liveItems(it, alive));
  assert.ok(on(it, new Set(), vest));
  const a1 = new Set(['c1']);
  const it1 = applyItemChanges(it, a1, [ch('c1', '방탄 조끼', 'unequip'), ch('c1', '야구 방망이', 'equip')]);
  assert.ok(!on(it1, a1, vest) && on(it1, a1, bat));
  const a2 = new Set(['c1b']);
  assert.ok(on(it1, a2, vest), '벗은 응답을 다시 굴리면 다시 입고 있다');
  assert.ok(!on(it1, a2, bat), '든 응답을 다시 굴리면 손에서 내려간다');
  // 두고 옴: 다시 굴리면 물건이 돌아오고 칸도 그대로
  const it2 = applyItemChanges(it, a1, [ch('c1', '방탄 조끼', 'left', { place: '사물함' })]);
  assert.equal(liveItems(it2, a1).some((x) => x.id === vest), false);
  assert.ok(on(it2, a2, vest), '두고 온 응답을 다시 굴리면 입은 채로 돌아온다');
  // 상점에 판 응답을 다시 굴려도 제 칸으로
  const it3 = sellItem(it, vest, 'c1', '상점에 팖');
  assert.ok(on(it3, a2, vest));
});

test('B2: 손으로 바꾼 장착은 본문 응답을 다시 굴려도 그대로 남는다', () => {
  let it = addItem(empty(), new Set(), { name: '야구 방망이', desc: '방망이', equip: 'weapon', from: 'manual', anchor: '' });
  const bat = it.list[0].id;
  const a1 = new Set(['c1']);
  it = applyItemChanges(it, a1, [ch('c1', '야구 방망이', 'equip')]);
  assert.equal(liveItems(it, a1)[0].slot, 0);
  // 화면에서 둘째 손 칸으로 옮김 (ui/items.ts write: settleEdits → noteEdits(…, ''))
  const cur = settleEdits(it, a1);
  it = noteEdits(cur, equipItem(cur, a1, bat, 1, 'weapon'), '');
  assert.equal(liveItems(it, new Set(['c1b']))[0].slot, 1, '사용자가 옮긴 칸이 남는다');
  const cur2 = settleEdits(it, a1);
  it = noteEdits(cur2, unequipItem(cur2, bat), '');
  assert.equal(liveItems(it, new Set(['c1b']))[0].slot, undefined);
});

test('B3: 수집기가 찬 응답을 다시 굴리면 「빈」 이름·그림·설명이 돌아온다', () => {
  let it = addItem(empty(), new Set(), { name: '빈 꿈결 수집기', desc: '비어 있는 수집기', icon: '빈 꿈결 수집기', from: 'manual', anchor: '' });
  const a1 = new Set(['c1']);
  it = applyItemChanges(it, a1, [ch('c1', '빈 꿈결 수집기', 'update', { desc: '노란 빛이 짙게 찬 수집기', icon: '꿈결 수집기 b등급' })]);
  const full = liveItems(it, a1)[0];
  assert.equal(full.name, '꿈결 수집기');
  assert.equal(full.icon, '꿈결 수집기 b등급');
  const back = liveItems(it, new Set(['c1b']))[0];
  assert.equal(back.name, '빈 꿈결 수집기');
  assert.equal(back.icon, '빈 꿈결 수집기');
  assert.equal(back.desc, '비어 있는 수집기');
  // 「빈 X」를 지닌 채 「… X」를 새로 얻은 길(new)도 같다
  let it2 = addItem(empty(), new Set(), { name: '빈 꿈결 수집기', desc: '비어 있는 수집기', icon: '빈 꿈결 수집기', from: 'manual', anchor: '' });
  it2 = applyItemChanges(it2, a1, [ch('c1', '찬 꿈결 수집기', 'new', { desc: '가득 참', icon: '꿈결 수집기 a등급' })]);
  assert.equal(liveItems(it2, a1)[0].name, '찬 꿈결 수집기');
  assert.equal(liveItems(it2, new Set(['c1b']))[0].name, '빈 꿈결 수집기');
  // 저장했다 읽어도 같다
  assert.equal(liveItems(readItems(itemsVars(it)), new Set(['c1b']))[0].name, '빈 꿈결 수집기');
});

test('Q2: 사용을 건 응답을 지우고 새 메시지를 보내면 그 사용이 칩·요청에 다시 실리고, 새 답에 쓴 것으로 적힌다', () => {
  let it = addItem(empty(), new Set(), { name: '진통제', desc: '알약', use: true, uses: 3, from: 'manual', anchor: '' });
  const id = it.list[0].id;
  const vars0 = { ...itemsVars(it), ...itemUseVars([{ id, n: 1 }]), [ITEM_USE_AT_VAR]: '' };
  const c1 = { message: [msg('char', 'g0'), msg('user', 'u2')], scriptstate: vars0 };
  assert.deepEqual(usesToSend(c1).map((u) => u.name), ['진통제']);
  // 답 c2 → 정리: 보낸 자리 u2, c2 에 사용 기록
  const c2 = { message: [...c1.message, msg('char', 'c2')], scriptstate: vars0 };
  const v2 = { ...vars0, ...settleItemUse(c2, 2, new Set([id]), false) };
  assert.equal(v2[ITEM_USE_AT_VAR], 'u2');
  assert.equal(itemLeft(readItems(v2), readItems(v2).list[0], aliveAnchors({ message: c2.message })), 2);
  assert.equal(useSentAt({ message: c2.message, scriptstate: v2 }), 'u2', '답이 있으면 보낸 자리');
  // 답 c2 를 지움: 횟수는 돌아오고, 아직 안 쓴 자리라 칩에도 보인다 (보낸 자리 아님)
  const c3 = { message: [msg('char', 'g0'), msg('user', 'u2')], scriptstate: v2 };
  assert.equal(useSentAt(c3), '');
  assert.equal(itemLeft(readItems(v2), readItems(v2).list[0], aliveAnchors(c3)), 3);
  // 새 메시지 u3: 요청에 실린다
  const c4 = { message: [...c3.message, msg('user', 'u3')], scriptstate: v2 };
  assert.deepEqual(usesToSend(c4).map((u) => u.name), ['진통제'], '새 메시지 요청에 사용이 실린다');
  assert.ok(inventoryText(c4).includes('진통제'));
  // 답 c3: 이 답에 쓴 것으로 적히고 자리는 u3
  const c5 = { message: [...c4.message, msg('char', 'c3')], scriptstate: v2 };
  const v5 = { ...v2, ...settleItemUse(c5, 3, new Set([id]), false) };
  assert.equal(v5[ITEM_USE_AT_VAR], 'u3');
  assert.equal(itemLeft(readItems(v5), readItems(v5).list[0], aliveAnchors(c5)), 2);
  assert.equal(useSentAt({ message: c5.message, scriptstate: v5 }), 'u3');
  // 다음에 다른 물건을 넣으면 지난 턴 것은 비우고 새로 시작한다 (숨어 있던 사용이 덧붙지 않는다)
  const next = queueUseVars({ message: [...c5.message], scriptstate: v5 }, (q) => [...q, { id: 'other', n: 1 }]);
  assert.deepEqual(readItemUse(next), [{ id: 'other', n: 1 }]);
});

// ── 반박 검토 (11-23) ──
test('B1: 가운데 응답을 지운 뒤 뒤 응답을 다시 굴리면, 지운 응답이 적은 값이 아니라 둘 다 바꾸기 전 값으로 돌아온다', () => {
  let it = addItem(empty(), new Set(), { name: '검은 우산', desc: '접힌 검은 우산', use: true, from: 'manual', anchor: '' });
  it = applyItemChanges(it, new Set(['c1']), [ch('c1', '검은 우산', 'update', { desc: '살이 부러진 우산', state: 'broken' })]);
  it = applyItemChanges(it, new Set(['c1', 'c2']), [ch('c2', '검은 우산', 'update', { desc: '천이 찢어진 우산' })]);
  // c1 만 지움 (c2 는 살아 있음): c2 가 적은 설명은 그대로, c1 만 바꾼 고장은 풀린다
  const a = new Set(['c2']);
  assert.equal(liveItems(it, a)[0].desc, '천이 찢어진 우산');
  assert.equal(liveItems(it, a)[0].state, 'ok');
  // 그사이 저장이 한 번 지나가 사라진 기록이 굳는다
  it = settleEdits(it, a);
  assert.equal(liveItems(it, a)[0].desc, '천이 찢어진 우산');
  // c2 를 다시 굴림: c1 이 적은 「살이 부러진」이 되살지 않는다
  const e = liveItems(it, new Set(['c2b']))[0];
  assert.equal(e.desc, '접힌 검은 우산');
  assert.equal(e.state, 'ok');
});

test('B1: 다시 굴린 뒤 늦게 온 갱신(사라진 응답 근거)은 보이지 않고, 새 응답의 변화에도 섞이지 않는다', () => {
  let it = addItem(empty(), new Set(), { name: '검은 우산', desc: '접힌 검은 우산', use: true, from: 'manual', anchor: '' });
  const a2 = new Set(['c1b']);
  it = applyItemChanges(it, a2, [ch('c1', '검은 우산', 'update', { desc: '살이 부러진 우산', state: 'broken' })]);
  assert.equal(liveItems(it, a2)[0].state, 'ok');
  assert.equal(liveItems(it, a2)[0].desc, '접힌 검은 우산');
  it = applyItemChanges(it, a2, [ch('c1b', '검은 우산', 'update', { desc: '젖은 우산' })]);
  assert.equal(liveItems(it, a2)[0].desc, '젖은 우산');
  assert.equal(liveItems(it, a2)[0].state, 'ok');
  assert.equal(liveItems(it, new Set(['c1c']))[0].desc, '접힌 검은 우산');
});

test('B2: 본문이 든 물건이 그 칸의 다른 물건을 밀어냈으면, 다시 굴릴 때 밀려난 물건도 제 칸으로 돌아온다', () => {
  let it = addItem(empty(), new Set(), { name: '단검', desc: '칼', equip: 'weapon', wear: true, from: 'manual', anchor: '' });
  it = addItem(it, new Set(), { name: '권총', desc: '총', equip: 'weapon', wear: true, from: 'manual', anchor: '' });
  it = addItem(it, new Set(), { name: '야구 방망이', desc: '방망이', equip: 'weapon', from: 'manual', anchor: '' });
  const idOf = (n) => it.list.find((x) => x.name === n).id;
  const before = Object.fromEntries(liveItems(it, new Set()).map((x) => [x.name, x.slot]));
  const a1 = new Set(['c1']);
  it = applyItemChanges(it, a1, [ch('c1', '단검', 'unequip'), ch('c1', '야구 방망이', 'equip')]);
  assert.equal(liveItems(it, a1).find((x) => x.id === idOf('야구 방망이')).slot, before.단검);
  const back = Object.fromEntries(liveItems(it, new Set(['c1b'])).map((x) => [x.name, x.slot]));
  assert.deepEqual(back, before);
});
