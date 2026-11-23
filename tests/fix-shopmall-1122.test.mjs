// 11-22 플레이 순서 점검(1_상점·2_몰) 재검토에서 진짜 버그로 본 것 고침
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = await build({
  stdin: {
    contents: `
      export { shopSource } from './src/ui/shop';
      export { deskSource, mallSettingsPane } from './src/ui/malls';
      export { previewHomeshop } from './src/ui/homeshop';
      export { flowNodes } from './src/ui/editor/flow';
      export { numKind } from './src/ui/editor/catalog';
      export { consultValue } from './src/core/consult';
      export { shopGive } from './src/core/shopfn';
      export { mallVars, mallSettings, readMall, mallAutoTurn } from './src/core/malls';
      export { applyShelf, shelfPrompt, talkPrompt, shopSettings, emptyShop, prevNames, pointShelf, parseShelf, ShopError } from './src/core/shop';
      export { stripStatusTags, findStatusTags } from './src/core/world/status';
      export { addItem, readItems, itemsVars, recentItemLog, inventoryText } from './src/core/items';
      export { pointsMember, pointsOn, pointsVars } from './src/core/points';
      export { guideTxt } from './src/core/guides';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const item = (name, extra = {}) => ({ name, price: 100, desc: `${name} 설명`, effect: `${name} 효과`, ...extra });
const shopState = (items) => ({ ...M.emptyShop({ raw: '', shop: '철물점', owner: '주인' }, 'c1'), loaded: true, identity: { sells: '공구', never: '-', prices: '-' }, items, prev: ['옛 망치'] });
const sysOf = (msgs) => msgs.map((m) => m.content).join('\n');

// ── 1. 새로고침: 지금 걸린 것도 피하라는 목록에, 새 진열에서 지금 것·산 것과 같은 이름은 뺀다 ──

test('1: 진열 요청의 피할 목록에 지난 것·산 것·지금 진열대(안 팔린 것)가 다 든다. 문의 요청은 지금 진열을 넣지 않는다', () => {
  const st = shopState([{ ...item('신문'), id: 'a' }, { ...item('앰플'), id: 'b', sold: true }]);
  assert.deepEqual(M.prevNames(st), ['옛 망치', '신문', '앰플']);
  assert.deepEqual(M.prevNames(st, true), ['옛 망치', '앰플']);
  const s = M.shopSettings({});
  const src = { st, refs: '', story: '', status: '', situation: '', identity: '', language: null };
  const sys = sysOf(M.shelfPrompt(src, s));
  const line = M.guideTxt('Shop', 'AVOID_PREV', {}).split('{prev}')[0].trim();
  const avoid = sys.split('\n').find((l) => l.startsWith(line));
  assert.ok(avoid && avoid.includes('신문') && avoid.includes('앰플') && avoid.includes('옛 망치'), avoid);
});

test('1: 아무것도 안 사고 새로고침 → 새 진열에서 지금 진열대와 같은 이름은 빠진다. 산 것과 같은 이름도', () => {
  const st = shopState([{ ...item('신문'), id: 'a' }, { ...item('앰플'), id: 'b', sold: true }]);
  const s = M.shopSettings({});
  const next = M.applyShelf(st, { identity: st.identity, owner: '', items: [item('신문'), item('앰플'), item('우산')] }, s);
  assert.deepEqual(next.items.filter((x) => !x.sold).map((x) => x.name), ['우산']);
  assert.ok(next.prev.includes('신문'), '안 팔린 것은 지난 목록으로');
  // 다 겹치면 받은 줄이 없다는 오류
  assert.throws(() => M.applyShelf(st, { identity: st.identity, owner: '', items: [item('신문')] }, s), M.ShopError);
});

test('1: 설정 「지난 목록 피하기」를 끄면 같은 이름도 그대로 받는다 (설정을 넘지 않는다)', () => {
  const st = shopState([{ ...item('신문'), id: 'a' }]);
  const s = M.shopSettings({ $sh_prev: '0' });
  const next = M.applyShelf(st, { identity: st.identity, owner: '', items: [item('신문')] }, s);
  assert.deepEqual(next.items.map((x) => x.name), ['신문']);
});

// ── 2. 상점·쇼핑몰·망상홈쇼핑 요청의 [최근 본문]에 상태창 줄(잔고)이 가지 않는다. 포인트몰 1:1 상담은 그대로 ──

const STATUS = '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 사무실|-|-|-|관리국/신입|1234567]';
const ctxOf = (vars = {}) => ({
  charIndex: 0, chatIndex: 0,
  char: { name: '괴이봇', desc: '봇 설명', globalLore: [] },
  chat: { message: [{ role: 'user', data: '둘러본다', chatId: 'u1' }, { role: 'char', data: `상점에 들어섰다.\n${STATUS}`, chatId: 'c1' }], scriptstate: { $cos_roll_on: '0', $bm_roll_on: '0', $br_login: '1', ...vars } },
});

test('2: stripStatusTags 는 상태창 태그만 뺀다', () => {
  assert.equal(M.stripStatusTags(`가\n${STATUS}\n나`), '가\n\n나');
  assert.equal(M.stripStatusTags('태그 없음'), '태그 없음');
  assert.equal(M.findStatusTags(M.stripStatusTags(`가 ${STATUS}`)).length, 0);
});

test('2: 기본 상점·우주몰·포인트몰 진열 요청의 [최근 본문]에 상태창 줄이 없다 (본문 글은 남는다)', () => {
  const ctx = ctxOf();
  const s = M.shopSettings(ctx.chat.scriptstate);
  const src = M.shopSource(ctx, shopState([]), s, M.shopGive(ctx.chat.scriptstate, 'shop', 'shelf'));
  assert.ok(src.story.includes('상점에 들어섰다'), src.story);
  assert.ok(!src.story.includes('1234567') && !src.story.includes('▣'), src.story);
  for (const site of ['cos', 'bm']) {
    const ms = M.mallSettings(ctx.chat.scriptstate, site);
    const mctx = { ...ctx, chat: { ...ctx.chat, scriptstate: M.mallVars(ctx.chat.scriptstate, site) } };
    const msrc = M.shopSource(mctx, { ...M.readMall(ctx.chat.scriptstate, site), loaded: true }, ms, M.shopGive(ctx.chat.scriptstate, site, 'talk'));
    assert.ok(msrc.story.includes('상점에 들어섰다') && !msrc.story.includes('1234567'), `${site}: ${msrc.story}`);
  }
});

test('2: 망상홈쇼핑 편성 요청에도 상태창 줄이 없다', () => {
  const ctx = ctxOf({ $hs_on: '1' });
  const msgs = M.previewHomeshop(ctx);
  if (!msgs) return; // 꺼져 있으면 요청이 없다
  const text = sysOf(msgs);
  assert.ok(!text.includes('1234567'), text.slice(Math.max(0, text.indexOf('1234567') - 300), text.indexOf('1234567') + 50));
});

test('2: 포인트몰 1:1 상담도 [최근 본문]에서 상태창 줄을 뺀다 (잔고 숨김, 재확인 BM2-1)', () => {
  const ctx = ctxOf();
  const src = M.deskSource(ctx);
  assert.ok(src.story.includes('상점에 들어섰다') && !src.story.includes('▣') && !src.story.includes('1234567'), src.story);
});

// ── 3. 이번 턴에 산 것은 「Recently: got」에 다시 적지 않는다 (모든 가게) ──

test('3: 상점·우주몰에서 이번 턴에 산 것은 Recently 에 없고 This turn 의 산 것에만 있다', () => {
  const msgs = [{ role: 'user', data: 'u', chatId: 'u0' }, { role: 'char', data: 'r', chatId: 'c0' }, { role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: 'r', chatId: 'c1' }];
  const alive = new Set(msgs.map((m) => m.chatId));
  let it = M.readItems({});
  it = M.addItem(it, alive, { name: '옛 손전등', from: 'story', anchor: 'c0' });
  it = M.addItem(it, alive, { name: '구두약', from: 'store', anchor: 'c1', price: 100 });
  it = M.addItem(it, alive, { name: '우산', from: 'store', store: 'cos', anchor: 'c1', price: 100, paidWith: 'bank transfer to 우주 쇼핑몰' });
  it = M.addItem(it, alive, { name: '쪽지', from: 'story', anchor: 'c1' });
  const vars = { ...M.itemsVars(it) };
  const chat = { message: [...msgs, { role: 'user', data: 'go', chatId: 'u2' }], scriptstate: vars };
  const recent = M.recentItemLog(chat, it, 3, vars).join('; ');
  assert.ok(!recent.includes('구두약') && !recent.includes('우산'), recent);
  assert.ok(recent.includes('쪽지') && recent.includes('옛 손전등'), recent);
  const text = M.inventoryText(chat);
  assert.ok(text.includes('구두약') && text.includes('우산'), text);
});

test('3: 지난 턴에 산 것은 Recently 에 남는다 (이번 턴 것만 뺀다)', () => {
  const msgs = [{ role: 'user', data: 'u', chatId: 'u0' }, { role: 'char', data: 'r', chatId: 'c0' }, { role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: 'r', chatId: 'c1' }];
  const alive = new Set(msgs.map((m) => m.chatId));
  const it = M.addItem(M.readItems({}), alive, { name: '구두약', from: 'store', anchor: 'c0', price: 100 });
  const vars = M.itemsVars(it);
  const chat = { message: msgs, scriptstate: vars };
  assert.ok(M.recentItemLog(chat, it, 3, vars).join('; ').includes('구두약'));
});

// ── 5·7. 포인트몰: 백일몽일 때만, 정가 포인트만 ──

test('5: 지난 포인트 거래만 남은 백일몽 밖 채팅은 포인트몰을 쓰지 않는다 (장부는 그대로 보인다)', () => {
  const w = { start: 0, log: [{ id: 'p1', anchor: 'c1', amount: 500, memo: '복지' }] };
  const out = { message: [], scriptstate: { $st_points_on: '0', $br_login: '1', ...M.pointsVars(w) } };
  assert.equal(M.pointsOn(out), true, '장부는 보인다');
  assert.equal(M.pointsMember(out), false);
  assert.equal(M.mallAutoTurn({ ...out, scriptstate: { ...out.scriptstate, $bm_auto: 'turn' } }, 'bm'), M.mallAutoTurn({ message: [], scriptstate: { $st_points_on: '0', $br_login: '1', $bm_auto: 'turn' } }, 'bm'));
  const member = { message: [], scriptstate: { $st_points_on: '1' } };
  assert.equal(M.pointsMember(member), true);
});

test('5: 즐겨찾기·새 탭·서랍(browserSites)과 구매가 pointsMember 를 쓴다', () => {
  const app = readFileSync('src/ui/app.ts', 'utf8');
  assert.match(app, /id !== 'bm' \|\| \(!!ctx && pointsMember\(ctx\.chat\)\)/);
  const malls = readFileSync('src/ui/malls.ts', 'utf8');
  assert.match(malls, /if \(p && \(!pointsMember\(chat\) \|\| list\.some\(\(x\) => !\(x\.price > 0\)\)\)\) return null;/);
});

test('7: 포인트몰 진열에서 현물·대가 값 줄은 버린다 (0포인트 공짜 물건이 되지 않게)', () => {
  const r = { identity: { sells: '복지', never: '-', prices: '-', points: true }, owner: '', items: [item('연필', { price: 0, pay: '연필 한 자루' }), item('쿠폰', { price: 0, pay: '900p' }), item('컵', { price: 300 }), item('공짜', { price: 0 }), item('반반', { price: 200, pay: '머리카락' })] };
  assert.deepEqual(M.pointShelf(r).items.map((x) => [x.name, x.price]), [['쿠폰', 900], ['컵', 300]]);
  assert.throws(() => M.pointShelf({ ...r, items: [item('연필', { price: 0, pay: '연필 한 자루' })] }), M.ShopError);
});

// ── 8. AI 상담: 값 등급 하한·상한은 수 칸 ──

test('8: 자릿점 글 칸(inputmode=numeric)도 min·max 가 있으면 수 칸이고, 「백만원」은 받지 않는다', () => {
  const nk = M.numKind('text', 'numeric', '1', '1000000000000');
  assert.deepEqual(nk, { lo: 1, hi: 1000000000000, digits: true });
  assert.equal(M.numKind('text', null, '1', '9'), null, '보통 글 칸은 그대로 글 칸');
  assert.equal(M.numKind('text', 'numeric', null, null), null, 'min·max 가 없으면 글 칸');
  const row = { id: 'ms-tier.cos:0:lo', menu: '우주 쇼핑몰', name: '하한', kind: 'num', cur: '999999', lo: nk.lo, hi: nk.hi };
  assert.equal(M.consultValue(row, '백만원'), null);
  assert.equal(M.consultValue(row, '1,000,000원'), '1000000');
  assert.equal(M.consultValue(row, '0'), null);
});

test('8: 우주몰 설정의 값 등급 하한·상한 칸에 min·max 가 있다', () => {
  const html = M.mallSettingsPane(ctxOf({ $cos_roll_on: '1' }), 'cos');
  const inputs = [...html.matchAll(/<input[^>]*data-key="cos:0:(lo|hi)"[^>]*>/g)].map((m) => m[0]);
  assert.equal(inputs.length, 2);
  for (const i of inputs) assert.ok(/inputmode="numeric"/.test(i) && /min="1"/.test(i) && /max="1000000000000"/.test(i), i);
});

// ── 9. 호출 흐름: 포인트몰 1:1 상담이 꺼지면 「호출 없음」 ──

test('9: 포인트몰 1:1 상담 줄은 상담·포인트몰이 꺼지면 다른 줄처럼 「호출 없음」', () => {
  const row = (vars) => M.flowNodes(ctxOf(vars)).manual.find((n) => n.name === '포인트몰 1:1 상담');
  assert.equal(row({ $bm_desk_on: '0' }).calls, '호출 없음');
  const on = row({});
  if (M.mallSettings(ctxOf().chat.scriptstate, 'bm').on) assert.equal(on.calls, '보낼 때마다 1회 (상담사 연결 1회 더)');
  else assert.equal(on.calls, '호출 없음');
});

// ── 재검토(11-22): 새로고침 답이 모두 겹쳐 버려지면 바로 오류로 끝나지 않고 설정 「재시도」대로 다시 묻는다 ──

test('1-재검토: 겹치는 줄만 온 새로고침은 generate 의 재시도로 다시 묻고, 두 번째 답으로 진열한다', async () => {
  const outR = await build({
    stdin: { contents: `export { generate } from './src/host/llm'; export { applyShelf, parseShelf, shopSettings, emptyShop } from './src/core/shop';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
  });
  const R = await import(`data:text/javascript;base64,${Buffer.from(outR.outputFiles[0].text).toString('base64')}`);
  const ID = '<shop-identity>\nsells: 공구\nnever: 음식\nprices: 싸다\n</shop-identity>\n<owner>뭐 찾소.</owner>\n';
  const replies = [`${ID}<shelf>\n신문|1000|사용|newspaper|0.5||\n</shelf>`, `${ID}<shelf>\n우산|2000|사용|umbrella|0.5||\n</shelf>`];
  const sent = [];
  const prev = globalThis.risuai;
  globalThis.risuai = { runLLMModel: async (o) => { sent.push(o.messages); return { type: 'success', result: replies[sent.length - 1] ?? '' }; } };
  try {
    const st = shopState([{ ...item('신문'), id: 'a' }]);
    const s = R.shopSettings({});
    // 화면(ui/shop.ts·ui/malls.ts ask)과 같은 꼴: 진열대에 얹는 것까지 읽기 안에서
    const { value } = await R.generate([{ role: 'user', content: 'shelf' }], 'aux', (raw) => R.applyShelf(st, R.parseShelf(raw, st.identity), s), { retries: 1, retryModel: 'same', transientRetries: 0 });
    assert.equal(sent.length, 2, '한 번 더 물었다');
    assert.deepEqual(value.items.filter((x) => !x.sold).map((x) => x.name), ['우산']);
  } finally {
    globalThis.risuai = prev;
  }
  // 화면 두 곳이 진열대 얹기를 읽기 안에서 한다
  assert.match(readFileSync('src/ui/shop.ts', 'utf8'), /generate\(shelfPrompt\(src, s\), s\.model, \(raw\) => applyShelf\(st0, parseShelf\(/);
  assert.match(readFileSync('src/ui/malls.ts', 'utf8'), /return \{ r, applied: applyShelf\(st0, r, s\) \};/);
});

// ── 사용자 22:22: 소지품 기록 화면·물건 출처 줄의 몰 구매는 한국어로. 사실만 한 번 저장하고 본편 영어는 지침 MALL.PAID.* 로 ──

const outK = await build({
  stdin: { contents: `export { mallPaidLabel } from './src/ui/items'; export { addItem, readItems, boughtLine, mallPaidText, bmOrderPaid, confirmBmPickups } from './src/core/items';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const K = await import(`data:text/javascript;base64,${Buffer.from(outK.outputFiles[0].text).toString('base64')}`);

test('몰 구매 화면 글: 「₩ 1,500,000 · 우주 쇼핑몰 입금」「1,200 P · 백일몽 포인트몰」「₩ 3,000,000 · 우주 쇼핑몰 선납 완료」', () => {
  assert.equal(K.mallPaidLabel({ mall: 'cos', by: 'bank', amount: 1500000 }), '₩ 1,500,000 · 우주 쇼핑몰 입금');
  assert.equal(K.mallPaidLabel({ mall: 'bm', by: 'points', amount: 1200 }), '1,200 P · 백일몽 포인트몰');
  assert.equal(K.mallPaidLabel({ mall: 'cos', by: 'order', amount: 3000000 }), '₩ 3,000,000 · 우주 쇼핑몰 선납 완료');
  assert.equal(K.mallPaidLabel({ mall: 'cos', by: 'bank', amount: 1000, pay: '머리카락' }), '₩ 1,000 · 우주 쇼핑몰 입금 + 머리카락');
});

test('몰 구매: 물건·획득 기록에는 사실(mallPaid)만 — 영어 글(paidWith·note)은 저장하지 않고, 본편 글은 예전과 같다', () => {
  const alive = new Set(['c1']);
  let it = K.addItem(K.readItems({}), alive, { name: '우산', from: 'store', store: 'cos', anchor: 'c1', price: 1500000, mallPaid: { mall: 'cos', by: 'bank', amount: 1500000 } });
  it = K.addItem(it, alive, { name: '손전등', from: 'store', store: 'cos-order', anchor: 'c1', price: 3000000, mallPaid: { mall: 'cos', by: 'order', amount: 3000000 } });
  it = K.addItem(it, alive, { name: '복지 컵', from: 'store', store: 'bm', anchor: 'c1', mallPaid: { mall: 'bm', by: 'points', amount: 1200 } });
  for (const e of it.list) assert.equal(e.paidWith, undefined, e.name);
  for (const l of it.log) { assert.equal(l.note, undefined, l.name); assert.ok(l.mallPaid, l.name); }
  const line = (n) => K.boughtLine(it.list.find((e) => e.name === n));
  // 지침 MALL.PAID.* · INVENTORY.BOUGHT.* 로 만든 글 (살 때 적어 두던 글과 같다)
  assert.equal(line('우산'), '우산 (paid with bank transfer to 우주 쇼핑몰 + 1,500,000 won)');
  assert.equal(line('손전등'), '손전등 (paid with custom order from 우주 쇼핑몰, paid in advance + 3,000,000 won)');
  assert.equal(line('복지 컵'), '복지 컵 (paid with 1,200 Baekilmong points at 백일몽 포인트몰)');
  assert.equal(K.mallPaidText({ mall: 'cos', by: 'bank', amount: 5, pay: '피 200ml' }), M.guideTxt('Main', 'MALL.PAID.BANK', { mall: '우주 쇼핑몰', extra: ` ${M.guideTxt('Main', 'MALL.PAID.EXTRA', { pay: '피 200ml' })}` }));
  // 몰 화면 코드는 영어 MALL.PAID 글을 저장하지 않는다
  assert.doesNotMatch(readFileSync('src/ui/malls.ts', 'utf8'), /paidWith|'MALL\.PAID\./);
});

test('포인트몰 수령: 살 때의 사실이 받은 물건에 그대로, 없으면 그 값만큼 포인트', () => {
  const o = { id: 'o1', anchor: 'c1', price: 900, item: { name: '복지 우산', desc: '', effect: '' }, mallPaid: { mall: 'bm', by: 'points', amount: 900 } };
  assert.deepEqual(K.bmOrderPaid(o), o.mallPaid);
  const { mallPaid: _m, ...bare } = o;
  assert.deepEqual(K.bmOrderPaid(bare), { mall: 'bm', by: 'points', amount: 900 });
  const r = K.confirmBmPickups(K.readItems({}), [o], [o], ['복지 우산'], new Set(['c1', 'c2']), 'c2', []);
  const got = r.it.list.find((e) => e.name === '복지 우산');
  assert.deepEqual(got.mallPaid, o.mallPaid);
  assert.equal(K.mallPaidLabel(r.it.log.find((l) => l.item === got.id).mallPaid), '900 P · 백일몽 포인트몰');
});
