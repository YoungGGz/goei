// 전수검사 11-13: 망상홈쇼핑·쇼핑몰·포인트 장부 고친 것 (malls#2~#8, settings#6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({
  stdin: {
    contents: `
      export { hsVars, hsSettings, parseChat, turnStep, hsNumVars, HS_NUM } from './src/core/homeshop';
      export { HS_PAIRS } from './src/core/setdef/homeshop';
      export { shopGiveOn } from './src/core/shopfn';
      export { dropDoubleSync, syncPointsToStatus, readPoints } from './src/core/points';
      export { mergeLate, lateNow, sendsOrders } from './src/ui/malls';
      export { guideSections } from './src/core/guides';
      export { mallVarsOf, readMall, mallAtKey, mallSeenKey, mallUnseen } from './src/core/malls';
      export { aliveAnchors } from './src/core/wallet';
      export { markSold, capShelf, readShop, applyShelf, shopSettings } from './src/core/shop';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('malls#2: 망상홈쇼핑 맥락 반영은 제 값이 있으면 그 값 (가게 표와 같다)', () => {
  const on = { $sh_ctx: '0', $hs_sh_ctx: '1' };
  assert.equal(M.hsSettings(on).shop.context, true);
  assert.equal(M.hsSettings(on).shop.context, M.shopGiveOn(on, 'hs', 'ctx'));
  assert.equal(M.hsSettings({ $hs_sh_ctx: '0' }).shop.context, false);
  // 제 값이 없으면 기본 상점 값
  assert.equal(M.hsSettings({ $sh_ctx: '0' }).shop.context, false);
  assert.equal(M.hsVars({ $sh_ctx: '0' }).$sh_ctx, '0');
  assert.equal(M.hsVars({}).$sh_ctx, undefined);
  // 다른 공유 값은 새지 않는다
  assert.equal(M.hsVars({ $sh_turns: '3', $hs_sh_turns: '9' }).$sh_turns, '3');
});

test('malls#3: 채팅 머리줄에 상품명·꾸밈이 붙어도 부로 나눈다. 「|」 있는 줄은 늘 채팅', () => {
  const r = M.parseChat('공용|안녕\n#1 꿈 베개\n닉|와 싸다\n**#2**: 거울\n닉2|무섭다\n#7번손님|말');
  assert.deepEqual(r.shared, [{ nick: '공용', text: '안녕' }]);
  assert.equal(r.parts.length, 2);
  assert.deepEqual(r.parts[0], [{ nick: '닉', text: '와 싸다' }]);
  assert.deepEqual(r.parts[1].map((x) => x.nick), ['닉2', '#7번손님']);
  // 머리 없는 응답은 전부 공용
  assert.equal(M.parseChat('a|b\nc|d').parts.length, 0);
});

test('malls#4: 되돌림 줄은 산 줄을 먼저 짝짓는다 (리롤로 죽은 줄과 짝지어 산 줄을 남기지 않는다)', () => {
  const e = (id, anchor, amount, memo = '상태창 포인트') => ({ id, anchor, amount, memo, src: 'story', at: '' });
  const w = { ...M.readPoints({}), log: [e('ps_N', 'N', 5000), e('w_1', 'N', 5000, '정산'), e('ps_N1a', 'N1a', -5000), e('ps_N1b', 'N1b', -5000)] };
  const healed = M.dropDoubleSync(w, new Set(['N', 'N1b']));
  assert.deepEqual(healed.log.map((x) => x.id), ['w_1', 'ps_N1a']);
  // 산 줄이 없으면 지금처럼 아무 줄이나
  const w2 = { ...w, log: [e('ps_N', 'N', 5000), e('w_1', 'N', 5000, '정산'), e('ps_zz', 'zz', -5000)] };
  assert.deepEqual(M.dropDoubleSync(w2, new Set(['N'])).log.map((x) => x.id), ['w_1']);
  assert.deepEqual(M.dropDoubleSync(w2).log.map((x) => x.id), ['w_1']);
});

test('malls#7: 턴 넘김은 판정만 (수동 여부와 무관), 다시 굴리기·끝난 편성은 안 넘긴다', () => {
  const show = { loaded: true, key: 'k', title: '', parts: [{}, {}, {}], chat: [], at: 0, prev: [], tk: 't1' };
  assert.deepEqual(M.turnStep(show, true, 't2'), { ...show, at: 1, tk: 't2' });
  assert.equal(M.turnStep(show, true, 't1'), null);
  assert.equal(M.turnStep(show, false, 't2'), null);
  assert.equal(M.turnStep({ ...show, at: 3 }, true, 't2'), null);
  assert.equal(M.turnStep({ ...show, tk: undefined }, true, 't2'), null);
});

test('malls#8: 답을 기다리는 동안 산 물건·취소한 판매는 되돌리지 않는다', () => {
  const it = (id, sold) => ({ id, name: id, price: 1, desc: '', effect: '', ...(sold ? { sold: true, soldKey: 'c1' } : {}) });
  const base = { shop: '', owner: '', key: '', loaded: true, identity: { sells: '', never: '', prices: '' }, items: [], talk: [], closed: false, prev: [], sell: null, sales: [] };
  const st0 = { ...base, items: [it('a'), it('b')], sell: { itemId: 'x', name: 'x' } };
  const now = { ...st0, items: [it('a', true), it('b')], sell: null };
  // 문의 답: 진열은 그대로, 판매 카드 남음
  const talk = M.mergeLate(now, { ...st0, talk: [{ who: 'owner', text: '응' }] }, st0);
  assert.equal(talk.items.find((x) => x.id === 'a').sold, true);
  assert.equal(talk.sell, null);
  assert.equal(talk.talk.length, 1);
  // 진열 새로 짜기: 산 물건이 새 진열에 없으면 팔린 채로 앞에 붙는다
  const shelf = M.mergeLate(now, { ...st0, items: [it('c'), it('d')] }, st0);
  assert.deepEqual(shelf.items.map((x) => [x.id, !!x.sold]), [['a', true], ['c', false], ['d', false]]);
  // 그사이 바뀐 게 없으면 답 그대로
  const same = { ...st0, items: [it('c')] };
  assert.deepEqual(M.mergeLate(st0, same, st0), same);
});

test('재검토 11-14 1-3: 산 응답을 다시 굴린 뒤 진열을 새로 짜도 옛 물건이 끼어 남지 않는다', () => {
  const it = (id) => ({ id, name: id, price: 1, desc: '', effect: '' });
  const base = { shop: 'S', owner: '', key: '', loaded: true, identity: { sells: '', never: '', prices: '' }, items: [], talk: [], closed: false, prev: [], sell: null, sales: [] };
  // A·B 진열, 응답 r1 에서 A 를 삼
  const bought = { message: [{ role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: 'x', chatId: 'r1' }] };
  const soldKey = [...M.aliveAnchors(bought)][1];
  const stored = M.markSold({ ...base, items: [it('A'), it('B')] }, 'A', soldKey);
  // 그 응답을 다시 굴림 (새 chatId) → 산 것은 없던 일
  const chat = { message: [{ role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: 'y', chatId: 'r2' }], scriptstate: M.mallVarsOf('cos', stored) };
  assert.equal(M.aliveAnchors(chat).has(soldKey), false);
  const st0 = M.readMall(chat.scriptstate, 'cos', M.aliveAnchors(chat));
  assert.deepEqual(st0.items.map((x) => [x.id, !!x.sold]), [['A', false], ['B', false]]);
  // 저장된 값에는 팔린 표시가 남아 있다 (기준 없이 읽으면 팔린 것으로 보인다)
  assert.equal(M.readMall(chat.scriptstate, 'cos').items.find((x) => x.id === 'A').sold, true);
  // C·D 로 새로 짬: 저장 직전 상태도 같은 기준으로 읽어야 A 가 「기다리는 동안 산 것」이 되지 않는다
  const next = { ...st0, items: [it('C'), it('D')] };
  const merged = M.mergeLate(M.lateNow(chat, 'cos'), next, st0);
  assert.deepEqual(merged.items.map((x) => x.id), ['C', 'D']);
  // 기다리는 동안 산 응답이 살아 있으면 그대로 팔린 채로 앞에 붙는다 (malls#8 은 그대로)
  const live = { ...bought, scriptstate: M.mallVarsOf('cos', stored) };
  const st0b = { ...base, items: [it('A'), it('B')] };
  assert.deepEqual(M.mergeLate(M.lateNow(live, 'cos'), { ...st0b, items: [it('C'), it('D')] }, st0b).items.map((x) => [x.id, !!x.sold]), [['A', true], ['C', false], ['D', false]]);
});

test('settings#6: 최소가 최대를 넘으면 짝도 같이 맞춘다', () => {
  const pair = (k) => Object.values(M.HS_PAIRS).find((p) => p.includes(k));
  const K = (k) => M.HS_NUM[k].key;
  assert.deepEqual(M.hsNumVars({ [K('cueMax')]: '5' }, 'cueMin', 8, pair('cueMin')), { [K('cueMin')]: '8', [K('cueMax')]: '8' });
  assert.deepEqual(M.hsNumVars({ [K('cueMin')]: '9' }, 'cueMax', 4, pair('cueMax')), { [K('cueMax')]: '4', [K('cueMin')]: '4' });
  // 넘지 않으면 한 칸만, 범위 밖은 잘라서
  assert.deepEqual(M.hsNumVars({}, 'cueMin', 3, pair('cueMin')), { [K('cueMin')]: '3' });
  assert.deepEqual(M.hsNumVars({}, 'cueMin', 99, pair('cueMin')), { [K('cueMin')]: '20', [K('cueMax')]: '20' });
  // 짝 없는 칸
  assert.deepEqual(M.hsNumVars({}, 'speed', 12, pair('speed')), { [K('speed')]: '12' });
  assert.deepEqual(M.hsNumVars({}, 'nope', 1), {});
});

test('우주 쇼핑몰: 「진행 중 맞춤 주문」 목록은 문의 요청에만 넣는다 (진열 요청에는 쓰는 곳이 없다)', () => {
  assert.equal(M.sendsOrders('cos', 'talk'), true);
  assert.equal(M.sendsOrders('cos', 'shelf'), false);
  assert.equal(M.sendsOrders('bm', 'talk'), false);
  assert.equal(M.sendsOrders('bm', 'shelf'), false);
});

test('망상홈쇼핑 지침: 스티커 밑 글·맞교환 말을 편성에서 따로 청하지 않는다 (스티커는 진실 칸에서 몇 글자, 맞교환은 상담원 요청이 판단)', () => {
  const g = M.guideSections('Hs');
  assert.equal(g.BROADCAST_PEEK, undefined);
  assert.equal(g.BROADCAST_BARTER, undefined);
  assert.doesNotMatch(g.BROADCAST, /\{peek_|\{barter_/);
  assert.match(g.OPERATOR, /not a human/);
});

test('쇼핑몰 「매 턴」: 받아 둔 진열을 아직 안 열어 봤으면 새로 받지 않는다', () => {
  const at = M.mallAtKey('cos'), seen = M.mallSeenKey('cos');
  assert.equal(M.mallUnseen({ [at]: 't:a' }, 'cos', true), true, '받기만 하고 안 열어 봄');
  assert.equal(M.mallUnseen({ [at]: 't:a', [seen]: 't:a' }, 'cos', true), false, '열어 봄');
  assert.equal(M.mallUnseen({ [at]: 't:b', [seen]: 't:a' }, 'cos', true), true, '본 뒤 새로 받은 진열은 아직 안 봄');
  assert.equal(M.mallUnseen({}, 'cos', false), false, '진열이 없으면 받는다');
  assert.equal(M.mallUnseen({ [at]: 't:a' }, 'bm', true), false, '몰마다 따로');
});

test('진열대 자르기: 파는 물건과 산 물건을 따로 센다 — 산 것이 40개를 넘어도 진열대가 비지 않는다 (2026-11-17)', () => {
  const it = (id, sold) => ({ id, name: id, price: 1, desc: '', effect: '', ...(sold ? { sold: true, soldKey: 'k' } : {}) });
  const sold = Array.from({ length: 45 }, (_, i) => it(`s${i}`, true));
  const open = Array.from({ length: 8 }, (_, i) => it(`n${i}`));
  const out = M.capShelf([...sold, ...open]);
  assert.deepEqual(out.filter((x) => !x.sold).map((x) => x.id), open.map((x) => x.id));
  assert.deepEqual(out.filter((x) => x.sold).map((x) => x.id), sold.slice(5).map((x) => x.id), '산 것은 최근 40개');
  assert.equal(M.capShelf(Array.from({ length: 50 }, (_, i) => it(`n${i}`))).length, 40);
  // 저장에서 읽을 때도 같다
  const base = { shop: 'S', owner: '', key: '', loaded: true, identity: { sells: '', never: '', prices: '' }, items: [...sold, ...open], talk: [], closed: false, prev: [], sell: null, sales: [] };
  const st = M.readMall(M.mallVarsOf('cos', base), 'cos');
  assert.equal(st.items.filter((x) => !x.sold).length, 8);
  assert.equal(st.items.filter((x) => x.sold).length, 40);
});
