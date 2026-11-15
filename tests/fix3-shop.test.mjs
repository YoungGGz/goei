// 전수검사 11-13 · 상점 고침 점검: 다시 굴리면 산 것·판 것 되살림(shop#4), 같은 가게에 머물 때 지난 턴 사건 되풀이 없음(shop#2·mainreach#1),
// 원이 아닌 대가(gshop#1), 거래 끊기 끔이면 <closed/> 꼴 줄 없음(gshop#13), 머리말 지시를 지침 절로(wording#4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix3/shop';
await mkdir(dir, { recursive: true });
await build({
  stdin: { contents: "export * from './shop'; export { setGuideOverride, guideDefault } from './guides'; export { shopGive, shopFnNum, shopFnVar, shopAmountNone, SHOP_AMOUNTS } from './shopfn'; export { carryDesk, endDesk } from './bmdesk';", resolveDir: resolve('src/core'), loader: 'ts' },
  outfile: join(dir, 'shop.mjs'), bundle: true, platform: 'node', format: 'esm', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const S = await import(pathToFileURL(join(dir, 'shop.mjs')));

const SHELF = '<shop-identity>\nsells: 공구\nnever: 음식\nprices: 싸다\nprice_range: 1000~50000\n</shop-identity>\n<owner>뭐 찾소.</owner>\n<shelf>\n손전등|18000|사용|flashlight|0.5|LED|비춘다\n생수|1500|소모1|water bottle|0.5|500ml|\n</shelf>';
const msgs = (last) => [{ role: 'user', data: '들어간다', chatId: 'u1' }, { role: 'char', data: last, chatId: 'c1' }];
const src = (st) => ({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null });

/** R1(상점 표식)에서 손전등을 사고 칼을 판 상태 */
function visit() {
  const c = { message: msgs('x\n[shop: 철물점|주인]'), scriptstate: {} };
  let st = S.applyShelf(S.readShop(S.settleShop(c, 1).vars), S.parseShelf(SHELF, null), S.shopSettings({}));
  const lamp = st.items.find((x) => x.name === '손전등');
  st = S.markSold(st, lamp.id, st.key);
  st = S.startSell(st, { itemId: 'i_9', name: '낡은 칼', desc: '', use: false, effect: '' });
  st = S.applyTalk(st, S.parseTalk('<owner>오천.</owner>\n<change mode="none"></change>\n<offer>5000</offer>'));
  st = S.closeSale(st, st.key);
  return { c: { ...c, scriptstate: S.shopVars(st) }, st };
}

test('shop#4: 산·판 응답을 다시 굴리면 진열대·판 것이 되살아난다', () => {
  const { c, st } = visit();
  assert.equal(st.sales[0].k, st.key);
  assert.equal(S.currentShop(c).items.find((x) => x.name === '손전등').sold, true);
  // R1 을 다시 굴림 → 같은 가게 표식의 새 응답 R1'
  const re = { message: [c.message[0], { role: 'char', data: 'y\n[shop: 철물점|주인]', chatId: 'c1b' }], scriptstate: c.scriptstate };
  const next = S.readShop(S.settleShop(re, 1).vars);
  assert.notEqual(next.key, st.key);
  assert.equal(next.items.find((x) => x.name === '손전등').sold, undefined);
  assert.deepEqual(next.sales, []);
  assert.deepEqual(S.shopEvents({ ...re, scriptstate: S.shopVars(next) }), []);
  // 키 없는 산 것(옛 저장분)은 그대로 산 것
  const old = { ...st, items: st.items.map((x) => (x.name === '생수' ? { ...x, sold: true } : x)) };
  assert.equal(S.reviveShop(old, new Set()).items.find((x) => x.name === '생수').sold, true);
});

test('shop#2·mainreach#1: 같은 가게에 머물러도 지난 턴의 판 것·대화는 다시 안 간다', () => {
  const { c } = visit();
  const st1 = S.readShop(c.scriptstate);
  const talked = S.applyTalk(S.sayToOwner(st1, '깎아 줘'), S.parseTalk('<owner>안 돼.</owner>\n<change mode="none"></change>'));
  const c1 = { ...c, scriptstate: S.shopVars(talked) };
  assert.equal(S.shopEvents(c1).length, 2);
  const c2m = [...c1.message, { role: 'user', data: '둘러본다', chatId: 'u2' }, { role: 'char', data: 'z\n[shop: 철물점|주인]', chatId: 'c2' }];
  const r = S.settleShop({ ...c1, message: c2m }, 3);
  assert.deepEqual(S.shopEvents({ message: c2m, scriptstate: { ...c1.scriptstate, ...r.vars } }), []);
});

test('gshop#1: 원이 아닌 대가는 주인 대화 요청에 그 말로 간다', () => {
  const st = { ...S.emptyShop({ raw: '', shop: '기억 가게', owner: '' }, 'k'), loaded: true, items: [{ id: 'a', name: '기억의 병', price: 0, pay: '기억 한 조각', use: true, desc: 'd', effect: 'e' }, { id: 'b', name: '혼합', price: 5000, pay: '피 한 방울', use: true, desc: 'd', effect: 'e' }] };
  const user = S.talkPrompt(src(st), S.shopSettings({})).at(-1).content;
  assert.match(user, /기억의 병\|기억 한 조각\|/);
  assert.match(user, /혼합\|피 한 방울 \+ 5000\|/);
});

test('gshop#13: 거래 끊기가 꺼져 있으면 출력 꼴에 <closed/> 줄이 없다', () => {
  const st = { ...S.emptyShop({ raw: '', shop: '가게', owner: '' }, 'k'), loaded: true };
  const sys = (kick) => S.talkPrompt(src(st), { ...S.shopSettings({}), kick }).map((m) => m.content).join('\n');
  assert.match(sys(true), /<closed\/> only if the owner ends the dealing\./);
  assert.doesNotMatch(sys(false), /<closed\/> only if the owner ends the dealing\./);
});

test('wording#4: 머리말 지시는 지침 절에서, 기본 글은 옛 글 그대로', () => {
  const st = { ...S.emptyShop({ raw: '', shop: '가게', owner: '' }, 'k'), loaded: true, notes: [{ id: 'n', title: '쪽지', price: 1, text: 't' }] };
  const s = { ...src(st), refs: 'R', assign: 'A', orders: 'O' };
  const user = () => S.talkPrompt(s, S.shopSettings({}), 'Cos').at(-1).content;
  const u = user();
  for (const h of ['[참고 자료 — 작중 인물에게 자동 공개되지 않음]\nR', '[이번 진열 배정 — 칸마다 그대로 따를 것]\nA', '[진행 중 맞춤 주문 — 이미 선납됨, 다시 견적 내지 말 것]\nO', '[이번 방문에 내민 정보 쪽지 — 다시 내밀지 말 것]\n']) assert.ok(u.includes(h), h);
  S.setGuideOverride('Cos', S.guideDefault('Cos').replace('[참고 자료 — 작중 인물에게 자동 공개되지 않음]', '[자료 고침]'));
  assert.ok(user().includes('[자료 고침]\nR'));
  // 절이 없으면 옛 글
  S.setGuideOverride('Cos', S.guideDefault('Cos').replace(/\n*@@SECTION HEAD_REFS\n[\s\S]*?\n@@END/, ''));
  assert.ok(user().includes('[참고 자료 — 작중 인물에게 자동 공개되지 않음]\nR'));
  S.setGuideOverride('Cos', null);
  // 홈쇼핑 머리말은 그대로
  assert.ok(S.broadcastMaterial(s, S.shopSettings({})).includes('[참고 자료 — 작중 인물에게 자동 공개되지 않음]\nR'));
});

// ── 요청을 줄이는 고침 (쇼핑몰 가게 정체의 currency 줄 · 지난 문의 대화 줄 수 · 문의로 물건 바꾸기 · 말 안 한 1:1 상담 이어 쓰기) ──
const sysOf = (m) => m.find((x) => x.role === 'system').content;
const userOf = (m) => m.at(-1).content;

test('쇼핑몰 첫 진열 지침은 가게 정체의 currency 줄을 청하지 않는다 (결제 수단은 몰마다 정해져 있다). 기본 상점은 그대로', () => {
  const fresh = (shop) => S.emptyShop({ raw: '', shop, owner: '' }, '');
  const first = (guide, st) => sysOf(S.shelfPrompt(src(st), S.shopSettings({}), guide));
  assert.doesNotMatch(first('Cos', fresh('우주 쇼핑몰')), /^currency:/m);
  const bm = { ...fresh('백일몽 포인트몰'), identity: { sells: '', never: '', prices: '', points: true } };
  assert.doesNotMatch(first('Bm', bm), /^currency:/m);
  assert.match(first('Bm', bm), /every price and every offer is a plain integer in Baekilmong welfare points/, '포인트라는 것은 POINT_SHOP 절이 알린다');
  for (const g of ['Cos', 'Bm']) assert.match(first(g, fresh('몰')), /<shop-identity>\nsells: [^\n]+\nnever: [^\n]+\nprices: [^\n]+\n<\/shop-identity>/);
  assert.match(first('Shop', fresh('철물점')), /^currency: points only if/m);
  // currency 줄이 없는 응답도, 있는 옛 응답도 읽는다. 포인트몰은 「900p」 값을 포인트로 읽는다 (ui/malls.ts 가 pointPrice 를 입힌다)
  const reply = (cur) => `<shop-identity>\nsells: 복지 물품\nnever: 무기\nprices: 포인트${cur}\n</shop-identity>\n<owner></owner>\n<shelf>\n텀블러|900p|-|도구/텀블러/tumbler|0.3|보온|\n</shelf>`;
  const r = S.parseShelf(reply(''), null);
  assert.equal(r.identity.sells, '복지 물품');
  assert.deepEqual(r.items.map(S.pointPrice).map((x) => [x.price, x.pay]), [[900, undefined]]);
  assert.equal(S.parseShelf(reply('\ncurrency: points'), null).items[0].price, 900);
});

test('지난 문의 대화: 기본은 전부, 줄 수를 정하면 진열·문의 요청에 최근 줄만 넘긴다 (방금 한 말은 늘 넘긴다)', () => {
  assert.equal(S.SHOP_AMOUNTS.talk.max, 40);
  assert.equal(S.shopGive({}, 'cos', 'talk').talk, 40, '기본 = 저장해 둔 줄 전부');
  assert.equal(S.shopGive({ [S.shopFnVar('talk', 'talk')]: '6' }, 'cos', 'talk').talk, 6);
  assert.equal(S.shopGive({ [S.shopFnVar('talk', 'talk')]: '6' }, 'cos', 'shelf').talk, 40, '기능마다 따로');
  assert.equal(S.shopFnNum({ [S.shopFnVar('shelf', 'talk')]: '0' }, 'shelf', 'talk'), 0);
  assert.equal(S.shopFnNum({ [S.shopFnVar('shelf', 'talk')]: '99' }, 'shelf', 'talk'), 40, '범위 밖이면 기본');
  assert.equal(S.shopAmountNone('desk', 'talk'), true);
  assert.equal(S.shopAmountNone('say', 'talk'), true);
  assert.equal(S.shopAmountNone('talk', 'talk'), false);
  assert.equal(S.shopAmountNone('desk', 'turns'), false);
  let st = { ...S.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, ''), loaded: true, identity: { sells: '잡화', never: '', prices: '' } };
  for (let i = 1; i <= 5; i++) { st = S.sayToOwner(st, `물음${i}`); st = { ...st, talk: [...st.talk, { who: 'owner', text: `답${i}` }] }; }
  st = S.sayToOwner(st, '방금 한 말');
  const s0 = S.shopSettings({});
  const all = userOf(S.talkPrompt(src(st), s0, 'Cos'));
  for (const w of ['물음1', '답5', '방금 한 말']) assert.ok(all.includes(w), w);
  assert.equal(userOf(S.talkPrompt({ ...src(st), talkMax: 40 }, s0, 'Cos')), all, '기본 값이면 전과 같다');
  const cut = userOf(S.talkPrompt({ ...src(st), talkMax: 3 }, s0, 'Cos'));
  for (const w of ['물음5', '답5', '방금 한 말']) assert.ok(cut.includes(w), w);
  for (const w of ['물음1', '답1', '물음4', '답4']) assert.ok(!cut.includes(w), w);
  const zero = userOf(S.talkPrompt({ ...src(st), talkMax: 0 }, s0, 'Cos'));
  assert.ok(zero.includes('방금 한 말') && !zero.includes('답5'));
  // 진열 새로 받기
  const restock = (max) => userOf(S.shelfPrompt({ ...src(st), ...(max === undefined ? {} : { talkMax: max }) }, s0, 'Cos'));
  assert.ok(restock().includes('물음1') && restock().includes('[이번 방문 대화]'));
  assert.ok(restock(2).includes('방금 한 말') && restock(2).includes('답5') && !restock(2).includes('물음5'));
  assert.ok(!restock(0).includes('[이번 방문 대화]') && !restock(0).includes('방금 한 말'));
});

test('문의로 물건 바꾸기: 기본(켬)은 전과 같고, 끄면 문의 요청에서 진열 규칙이 빠지고 물건 더하기·다시 짜기를 받지 않는다', () => {
  assert.equal(S.shopSettings({}).talkStock, true);
  assert.equal(S.shopSettings({ [S.SHOP_TALK_STOCK_VAR]: '0' }).talkStock, false);
  assert.ok(S.SHOP_SHARED_VARS.includes(S.SHOP_TALK_STOCK_VAR), '가게들이 한 값을 같이 쓴다');
  const { st } = visit();
  const live = S.sayToOwner({ ...st, sell: null }, '망치 있소?');
  const on = sysOf(S.talkPrompt(src(live), S.shopSettings({})));
  const off = sysOf(S.talkPrompt(src(live), S.shopSettings({ [S.SHOP_TALK_STOCK_VAR]: '0' })));
  assert.match(on, /Shelf size:/);
  assert.doesNotMatch(on, /the stock on the shelf is fixed/);
  assert.doesNotMatch(off, /Shelf size:/, '진열 규칙이 빠진다');
  assert.match(off, /the stock on the shelf is fixed: never add an item and never re-stock/);
  assert.match(off, /<change mode="none\|partial\|all">/, '값 흥정·빼기는 그대로 돌려줄 수 있다');
  assert.ok(off.length < on.length);
  // 우주 쇼핑몰: 맞춤 주문 견적 줄이 같은 칸을 쓰므로 물건 줄 꼴은 남기고 나머지 진열 규칙만 뺀다. 팔기 중에는 줄 꼴도 뺀다
  const cos = { ...live, shop: '우주 쇼핑몰', owner: '운영자' };
  const cosOn = sysOf(S.talkPrompt(src(cos), S.shopSettings({}), 'Cos'));
  const cosOff = sysOf(S.talkPrompt(src(cos), S.shopSettings({ [S.SHOP_TALK_STOCK_VAR]: '0' }), 'Cos'));
  assert.match(cosOff, /Shelf size:/);
  assert.match(cosOff, /A custom-order quote, where this shop takes custom orders, is still allowed\./);
  assert.ok(cosOff.length < cosOn.length);
  const selling = S.startSell(cos, { itemId: 'i_1', name: '낡은 칼', desc: '', use: false, effect: '' });
  assert.doesNotMatch(sysOf(S.talkPrompt(src(selling), S.shopSettings({ [S.SHOP_TALK_STOCK_VAR]: '0' }), 'Cos')), /Shelf size:/);
  // 응답: 꺼 두면 더하기·전체 다시 짜기는 버리고 값 바꾸기·빼기는 받는다
  const reply = S.parseTalk('<owner>있소.</owner>\n<change mode="partial">\n+ 망치|9000|손|도구/망치/hammer|0.6|쇠망치|\n~ 생수|1000\n</change>');
  const names = (x) => S.shelfItems(x).map((i) => `${i.name}:${i.price}`);
  assert.deepEqual(names(S.applyTalk(live, reply)), ['생수:1000', '망치:9000']);
  assert.deepEqual(names(S.applyTalk(live, reply, true, false)), ['생수:1000']);
  const allNew = S.parseTalk('<owner>싹 바꿨소.</owner>\n<change mode="all">\n톱|20000|손|도구/톱/saw|0.8|톱|\n</change>');
  assert.deepEqual(names(S.applyTalk(live, allNew)), ['톱:20000']);
  assert.deepEqual(names(S.applyTalk(live, allNew, true, false)), ['생수:1500'], '진열대는 그대로');
  assert.equal(S.applyTalk(live, allNew, true, false).talk.at(-1).text, '싹 바꿨소.', '주인 대사는 남는다');
});

test('1:1 상담: 연결만 하고 말을 걸지 않은 상담은 턴이 넘어가도 이어 쓴다 (새로 만들지 않는다). 말을 건 상담은 전처럼 끝낸다', () => {
  const agent = { id: 'a1', no: '0427', name: '김', rank: '대리', dept: '복지', intro: '', voice: '', dice: [] };
  const idle = { agent, anchor: 'c1', past: [], talk: [{ who: 'sys', text: '연결' }, { who: 'op', text: '안녕하세요, 고객님.', k: 'c1' }] };
  const kept = S.carryDesk(idle, 'c2');
  assert.equal(kept.agent, agent);
  assert.equal(kept.anchor, 'c2');
  assert.deepEqual(kept.talk, [{ who: 'sys', text: '연결' }, { who: 'op', text: '안녕하세요, 고객님.', k: 'c2' }], '첫 인사는 지금 턴의 것으로 옮긴다');
  assert.deepEqual(kept.past, []);
  const used = { ...idle, talk: [...idle.talk, { who: 'me', text: '환불 돼요?', k: 'c1' }, { who: 'op', text: '확인해 드릴게요.', k: 'c1' }] };
  assert.equal(S.carryDesk(used, 'c2'), null);
  assert.equal(S.carryDesk({ agent: null, anchor: '', past: [], talk: [] }, 'c2'), null);
  assert.equal(S.carryDesk(idle, ''), null);
});
