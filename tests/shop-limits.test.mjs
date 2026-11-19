// 상점 보관하는 양·참고 글 길이 설정 (설정 → 상점 「보관하는 양」): 기본값은 예전에 코드에 적혀 있던 수 그대로, 설정을 바꾸면 그 수만큼, 이상한 값은 기본값
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/shop'; export * from './src/core/orders'; export { endDesk, deskSettings, DESK_KEY, DESK_KEEP_RANGE } from './src/core/bmdesk';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const base = () => M.emptyShop({ raw: '', shop: '철물점', owner: '주인' }, 'c1');
const full = () => ({
  ...base(), loaded: true,
  talk: Array.from({ length: 300 }, (_, i) => ({ who: 'me', text: `말${i}` })),
  prev: Array.from({ length: 300 }, (_, i) => `물건${i}`),
  sales: Array.from({ length: 300 }, (_, i) => ({ name: `판 것${i}`, price: 100 })),
  quotes: Array.from({ length: 300 }, (_, i) => ({ id: `q${i}`, price: 100, hours: 1, item: { name: `맞춤${i}` } })),
  notes: Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, title: `정보${i}`, price: 100, body: '내용' })),
});
const sizes = (st) => [st.talk.length, st.prev.length, st.sales.length, st.quotes.length, st.notes.length];
const read = () => M.readShop(M.shopVars(full()));

test('기본값은 예전 수 그대로: 대화 40 · 지난 목록 40 · 판매 40 · 견적 20 · 정보 20 · 위키 3000자 · 보고 1500자', () => {
  assert.deepEqual(M.shopLimits(undefined), { prev: 40, sales: 40, notes: 20, talk: 40, wiki: 3000, report: 1500 });
  M.setShopKeep(undefined);
  assert.deepEqual(sizes(read()), [40, 40, 40, 20, 20]);
  assert.equal(read().talk[39].text, '말299', '최근 것을 남긴다');
  assert.equal(M.sayToOwner(read(), '하나 더').talk.length, 40);
  assert.equal(M.closeSale({ ...read(), sell: { id: 'x', name: '시계', price: 500 } }).sales.length, 40);
  for (const l of Object.values(M.SHOP_LIMITS)) assert.ok(M.SHOP_SHARED_VARS.includes(l.key), '상점 넷이 한 값을 같이 쓴다');
});

test('설정을 바꾸면 그 수만큼 남긴다', () => {
  M.setShopKeep({ $sh_keep_talk: '100', $sh_keep_prev: '10', $sh_keep_sales: '60', $sh_keep_notes: '5' });
  try {
    assert.deepEqual(sizes(read()), [100, 10, 60, 5, 5]);
    assert.equal(M.sayToOwner(read(), '하나 더').talk.length, 100);
    assert.equal(M.closeSale({ ...read(), sell: { id: 'x', name: '시계', price: 500 } }).sales.length, 60);
    const st = M.applyShelf({ ...read(), items: [{ id: 'a', name: '새 이름', desc: '', use: false, effect: '', price: 1 }] }, { identity: base().identity, owner: '어서 오쇼', items: [{ name: '손전등', desc: '', use: true, effect: '', price: 1000 }] }, M.shopSettings({}));
    assert.equal(st.prev.length, 10);
    assert.equal(st.prev[9], '새 이름', '방금 내린 물건이 지난 목록의 끝');
    assert.equal(st.talk.length, 100);
  } finally { M.setShopKeep(undefined); }
  assert.deepEqual(M.shopLimits({ $sh_wiki_chars: '6000', $sh_report_chars: '500' }), { prev: 40, sales: 40, notes: 20, talk: 40, wiki: 6000, report: 500 });
});

test('이상한 값은 기본값, 범위 밖은 범위 끝', () => {
  assert.deepEqual(M.shopLimits({ $sh_keep_talk: 'abc', $sh_keep_prev: '', $sh_wiki_chars: 'x' }), M.shopLimits(undefined));
  const l = M.shopLimits({ $sh_keep_talk: '0', $sh_keep_prev: '99999', $sh_keep_notes: '-3', $sh_wiki_chars: '1', $sh_report_chars: '999999' });
  assert.deepEqual(l, { prev: 200, sales: 40, notes: 5, talk: 10, wiki: 500, report: 10000 });
  M.setShopKeep({ $sh_keep_talk: '엉뚱' });
  assert.equal(read().talk.length, 40);
  M.setShopKeep(undefined);
});

const cos = (i, taken) => ({ id: `o${i}`, anchor: 'c1', price: 1, hours: 1, orderedAt: null, orderedKey: 'c1', item: { name: `주문${i}` }, ...(taken ? { taken: true, takenKey: 'c1' } : {}) });
test('주문 기록 수: 기본 12건·40건, 설정대로 줄고 늘며, 안 받은 주문은 버리지 않는다', () => {
  assert.equal(M.cosOrdersKeep(undefined), 12);
  assert.equal(M.bmOrdersKeep({}), 40);
  const taken = Array.from({ length: 60 }, (_, i) => cos(i, true));
  assert.equal(M.readOrders(M.ordersVars(taken)).length, 12);
  assert.equal(M.readBmOrders(M.bmOrdersVars(taken)).length, 40);
  const vars = { [M.COS_ORDERS_KEEP_VAR]: '30', [M.BM_ORDERS_KEEP_VAR]: '5' };
  assert.equal(M.readOrders(M.ordersVars(taken, M.cosOrdersKeep(vars))).length, 30);
  assert.equal(M.readBmOrders(M.bmOrdersVars(taken, M.bmOrdersKeep(vars))).length, 5);
  assert.equal(M.readOrders(M.ordersVars(taken, M.cosOrdersKeep(vars)))[0].id, 'o30', '오래된 것부터 버린다');
  const waiting = Array.from({ length: 20 }, (_, i) => cos(i, false));
  assert.equal(M.pruneBmOrders(waiting, 5).length, 20);
  assert.equal(M.cosOrdersKeep({ [M.COS_ORDERS_KEEP_VAR]: '많이' }), 12);
  assert.equal(M.cosOrdersKeep({ [M.COS_ORDERS_KEEP_VAR]: '' }), 12);
  assert.equal(M.bmOrdersKeep({ [M.BM_ORDERS_KEEP_VAR]: '1' }), 5);
  assert.equal(M.bmOrdersKeep({ [M.BM_ORDERS_KEEP_VAR]: '9999' }), 200);
});

const agent = (i) => ({ id: `a${i}`, name: `상담사${i}`, rank: '', dept: '', intro: '', voice: '', dice: [] });
test('지난 상담사 보관 수: 기본 20명, 설정대로, 이상한 값은 기본값', () => {
  const st = { agent: agent(999), talk: [], anchor: 'c1', past: Array.from({ length: 150 }, (_, i) => agent(i)) };
  assert.equal(M.deskSettings({}).keep, 20);
  assert.equal(M.endDesk(st).past.length, 20);
  assert.equal(M.endDesk(st).past[0].id, 'a999', '방금 상담사가 맨 앞');
  assert.equal(M.endDesk(st, M.deskSettings({ [M.DESK_KEY.keep]: '48' }).keep).past.length, 48);
  assert.equal(M.deskSettings({ [M.DESK_KEY.keep]: 'x' }).keep, 20);
  assert.equal(M.deskSettings({ [M.DESK_KEY.keep]: '' }).keep, 20);
  assert.equal(M.deskSettings({ [M.DESK_KEY.keep]: '1' }).keep, M.DESK_KEEP_RANGE[0]);
  assert.equal(M.deskSettings({ [M.DESK_KEY.keep]: '5000' }).keep, M.DESK_KEEP_RANGE[1]);
});
