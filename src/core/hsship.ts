// 망상홈쇼핑 전화 주문의 택배 상자 넣기 (2026-11-16 사용자: 주문하자마자가 아니라 몰래 뽑은 턴에 닿는다).
// 주문 때는 장부 줄만 적고(core/homeshop.ts newOrder), 닿을 턴이 된 주문의 상자를 여기서 소지품에 넣는다.
// 부르는 곳: 주문 확정 직후(0턴이면 바로) · 응답을 받은 뒤마다(body.ts). 저장하는 것은 상자 물건과 넣은 응답 키뿐이라, 그 응답을 지우거나 다시 굴리면 상자가 없던 일이 되고 새 응답에 다시 닿는다.
import type { Chat } from './types';
import { addItem, itemId, itemsVars, liveItems, readItems } from './items';
import { aliveAnchors } from './wallet';
import { lastBot } from './shop';
import { dueOrders, HS_BOX, hsName, orderPaid, ordersVars, readOrders } from './homeshop';

/** 닿을 턴이 된 주문의 상자를 소지품에 넣은 채팅 변수. 넣을 것이 없으면 null */
export function deliverOrders(chat: Chat): Record<string, string> | null {
  const due = dueOrders(chat);
  if (!due.length) return null;
  const alive = aliveAnchors(chat);
  const anchor = lastBot(chat)?.key ?? '';
  let items = readItems(chat.scriptstate);
  const given = new Map<string, { boxId: string; boxKey: string }>();
  for (const o of due) {
    // 같은 이름의 상자가 이미 있으면(같은 상품을 다시 주문) 한 줄로 합쳐져 못 열게 되므로 번호를 붙인다
    const mine = liveItems(items, alive);
    let name = HS_BOX.name(o.item.name);
    for (let k = 2; k < 20 && mine.some((x) => x.id === itemId(anchor, name) || x.name === name); k++) name = `${HS_BOX.name(o.item.name).slice(0, 27)} ${k}`;
    // 상자: 원 몫은 값으로(가계부와 이어짐), 나머지 대가(물건·그 밖)는 결제 글로. 출연은 상자를 열 때 걸리므로 여기 적지 않는다
    const money = o.terms?.money ?? 0;
    items = addItem(items, alive, { name, desc: HS_BOX.desc, icon: HS_BOX.icon, weight: o.item.weight, from: 'store', store: 'hs', anchor, paidWith: orderPaid(o, false) || hsName(), ...(money > 0 ? { price: money, ...(o.walletId ? { walletId: o.walletId } : {}) } : {}) });
    given.set(o.id, { boxId: itemId(anchor, name), boxKey: anchor });
  }
  const orders = readOrders(chat.scriptstate).map((x) => (given.has(x.id) ? { ...x, ...given.get(x.id)! } : x));
  return { ...itemsVars(items), ...ordersVars(orders) };
}
