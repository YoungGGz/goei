// 플레이 순서 점검 2차 재확인에서 남은 버그 고침 (상점·몰·상담·괴담넷·위키 묶음, 11-23)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await build({
  stdin: {
    contents: `
      export { applyShelf, applyTalk, emptyShop, findShopTag, parseShelf, parseTalk, sayToOwner, settleShop, shopEvents, shopSettings, shopVars, stampReply, startSell, talkPrompt, readShop, SHOP_VAR } from './src/core/shop';
      export { mallEvents, mallVarsOf, readMall } from './src/core/malls';
      export { endDesk, readDesk, deskVars } from './src/core/bmdesk';
      export { paidWon } from './src/core/items';
      export { commitIncoming } from './src/core/gnet';
      export { shopAction, shopUi, resetShop } from './src/ui/shop';
      export { mallAction, resetMalls, deskSource } from './src/ui/malls';
      export { handleWiki, wiki, resetWiki } from './src/ui/wiki';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const code = out.outputFiles[0].text;
const dir = mkdtempSync(join(tmpdir(), 'goei-fix3c-'));
let seq = 0;
const fresh = () => { const f = join(dir, `m${++seq}.mjs`); writeFileSync(f, code); return import(pathToFileURL(f).href); };
const M = await fresh();

/** 가짜 Risu: 채팅을 저장해 두고, 모델 답은 replies 차례로 (hold 가 있으면 그 약속을 기다린다) */
function fakeRisu(chats) {
  const calls = [];
  const R = { calls, replies: [], hold: null, chats };
  globalThis.risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    nativeFetch: async () => { throw new Error('막힘'); },
    runLLMModel: async (o) => {
      calls.push(o);
      if (R.hold) await R.hold;
      const r = R.replies.shift();
      return r === undefined ? { type: 'fail', result: '시험' } : { type: 'success', result: r };
    },
    getChatFromIndex: async (_c, i) => structuredClone(chats[i]),
    setChatToIndex: async (_c, i, chat) => { chats[i] = structuredClone(chat); },
  };
  return R;
}
const ST = '[▣|2025.03.14|11:20 PM|🌙|6°C|가게|없음|없음|없음|관리국/신입|10000]';
const shopChat = (key, vars = {}) => ({ message: [{ role: 'user', data: '들어간다', chatId: 'u1' }, { role: 'char', data: `가게에 들어섰다.\n${ST}\n[shop: 이정 책방|]`, chatId: key }], scriptstate: { ...vars }, note: '' });
const ctxOf = (chat, chatIndex = 0) => ({ charIndex: 0, chatIndex, char: { name: '괴이봇', desc: '', globalLore: [] }, chat });
const SHELF = `<shop-identity>\nsells: 책\nnever: 무기\nprices: 돈\ncurrency: -\n</shop-identity>\n<owner>\n어서 오십시오.\n</owner>\n<shelf>\n족제비털 붓|500|손|도구/붓/brush|0.021|털끝이 갈라졌다||특가:800\n송연먹|200|소모20|소모품/먹/ink stick|0.004|먹||\n</shelf>`;
const loadedShop = (key) => M.applyShelf({ ...M.emptyShop({ shop: '이정 책방', owner: '' }, key) }, M.parseShelf(SHELF, null), M.shopSettings({}));

// ── S2-2 특가를 다른 대가로 흥정하면 특가가 아니다 ──
test('S2-2: 특가 물건을 다른 대가로 흥정하면 특가 표시(tag·was)가 빠진다', () => {
  const st = loadedShop('c1');
  const brush = st.items.find((x) => x.name === '족제비털 붓');
  assert.equal(brush.tag, 'sale');
  const r = M.parseTalk('<owner>\n먹을 갈아 주시면 드리지요.\n</owner>\n<change mode="partial">\n~ 족제비털 붓|먹 한 자루 갈아 드리기\n</change>');
  const next = M.applyTalk(st, r);
  const b2 = next.items.find((x) => x.name === '족제비털 붓');
  assert.equal(b2.pay, '먹 한 자루 갈아 드리기');
  assert.equal(b2.tag, undefined);
  assert.equal(b2.was, undefined);
  // 원 값으로 더 깎으면 특가는 그대로
  const r2 = M.parseTalk('<owner>\n사백에 드리지요.\n</owner>\n<change mode="partial">\n~ 족제비털 붓|400\n</change>');
  const b3 = M.applyTalk(st, r2).items.find((x) => x.name === '족제비털 붓');
  assert.equal(b3.tag, 'sale');
  assert.equal(b3.was, 800);
});

// ── S2-3 대가로 산 물건의 「산 값」 ──
test('S2-3: 원이 아닌 대가·포인트로 산 물건은 원 「산 값」을 넘기지 않는다', () => {
  assert.equal(M.paidWon({ price: 3000 }), 3000);
  assert.equal(M.paidWon({ price: 0, paidWith: '옛 책 한 권' }), undefined);
  assert.equal(M.paidWon({ price: 400, paidWith: '필사 한 장' }), undefined);
  assert.equal(M.paidWon({ paidWith: '1,200 points' }), undefined);
  assert.equal(M.paidWon({ mallPaid: { mall: 'bm', by: 'points', amount: 1200 } }), undefined);
  assert.equal(M.paidWon({ price: 5000, mallPaid: { mall: 'cos', by: 'bank', amount: 5000 } }), 5000);
  assert.equal(M.paidWon({ price: 5000, mallPaid: { mall: 'cos', by: 'bank', amount: 5000, pay: '이빨 하나' } }), undefined);
  // 요청: paid 가 없으면 「bought earlier for … won」 줄이 없다
  const st = M.startSell(loadedShop('c1'), { itemId: 'i1', name: '손때 묻은 필사첩', desc: '', effect: '', use: false });
  const p = M.talkPrompt({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null }, M.shopSettings({}));
  assert.ok(!JSON.stringify(p).includes('bought earlier for'));
});

// ── S2-5 백일몽 소속이 아니면 포인트 가게가 아니다 ──
test('S2-5: 백일몽 소속이 아니면 정체가 포인트여도 원 가게로 읽고, 남은 포인트 가게에서는 팔 수 없다', async () => {
  const raw = SHELF.replace('currency: -', 'currency: points');
  assert.equal(M.parseShelf(raw, null).identity.points, true);
  assert.equal(M.parseShelf(raw, null, false).identity.points, undefined);
  // 비소속인데 저장된 방문이 포인트 가게: 팔기 확정이 포인트를 만들지 않는다
  const st0 = loadedShop('c1');
  const pst = { ...st0, identity: { ...st0.identity, points: true }, sell: { itemId: 'n1', name: '한지 노트', desc: '', effect: '', use: false, price: 500 } };
  const items = JSON.stringify({ list: [{ id: 'n1', name: '한지 노트', desc: '', effect: '', use: false, from: 'found', anchor: 'u1', at: 1 }] });
  const chats = [shopChat('c1', { ...M.shopVars(pst), $st_items: items })];
  fakeRisu(chats);
  const UI = await fresh();
  UI.resetShop();
  await UI.shopAction('shop-sell', undefined, ctxOf(structuredClone(chats[0])), { render() {}, refresh: async () => {}, current: () => ctxOf(structuredClone(chats[0])) });
  assert.ok(!chats[0].scriptstate.$st_points || !String(chats[0].scriptstate.$st_points).includes('500'), String(chats[0].scriptstate.$st_points));
  assert.match(UI.shopUi.info, /백일몽/);
});

// ── S2-7 늦게 온 주인 답 ──
test('S2-7: 답을 기다리는 사이 본편이 넘어가도, 늦게 온 주인 답은 내 말과 함께 다음 본편에 간다', async () => {
  const st1 = loadedShop('c1');
  const said = M.sayToOwner(st1, '송연먹 백오십에 안 될까요?');
  const chats = [shopChat('c1', M.shopVars(said))];
  const R = fakeRisu(chats);
  let open;
  R.hold = new Promise((r) => { open = r; });
  R.replies.push('<owner>\n그럼 백오십에 드리지요.\n</owner>\n<change mode="partial">\n~ 송연먹|150\n</change>');
  const UI = await fresh();
  UI.resetShop();
  const ctx = () => ctxOf(structuredClone(chats[0]));
  const env = { render() {}, refresh: async () => {}, current: ctx };
  // 보낸 말 (shop-say 는 내 말을 먼저 저장한다): 여기서는 이미 저장한 상태에서 대화 요청만
  const first = ctxOf(structuredClone(chats[0]));
  UI.shopUi.input = '';
  // 붙잡힌 동안: 본편 요청에는 답 없는 내 말이 가지 않는다
  assert.equal(M.shopEvents(chats[0]).length, 0, JSON.stringify(M.shopEvents(chats[0])));
  // 대화 요청을 시작: shop-say 와 같은 길 (내 말 저장 → ask)
  chats[0] = shopChat('c1', M.shopVars(st1));
  const going = UI.shopAction('shop-say', '송연먹 백오십에 안 될까요?', first, env);
  await new Promise((r) => setTimeout(r, 20));
  // 본편이 한 턴 넘어감: 같은 가게 응답 c2
  const c = chats[0];
  c.message.push({ role: 'user', data: '둘러본다', chatId: 'u2' }, { role: 'char', data: `책방은 조용했다.\n${ST}\n[shop: 이정 책방|]`, chatId: 'c2' });
  const s0 = M.readShop(c.scriptstate);
  c.scriptstate = { ...c.scriptstate, ...M.shopVars({ ...s0, key: 'c2' }) };
  open();
  await going;
  const ev = M.shopEvents(chats[0]).join('\n');
  assert.match(ev, /백오십에 드리지요/);
  assert.match(ev, /송연먹 백오십에 안 될까요/);
});

// ── cos-4 / cos-5 우주몰 문의 ──
const cosChat = (key, st) => ({ message: [{ role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: `글.\n${ST}`, chatId: key }], scriptstate: { ...M.mallVarsOf('cos', st) }, note: '' });
const cosBase = () => ({ ...M.emptyShop({ shop: '우주 쇼핑몰', owner: '' }, ''), loaded: true, identity: { sells: '아무거나', never: '-', prices: '원' } });

test('cos-4: 답 없는 내 질문은 본편에 가지 않고, 문의 창을 다시 열면 떼어 입력칸으로 돌아간다', async () => {
  const st = { ...cosBase(), talk: [{ who: 'owner', text: '어서 와라.', k: 'c1' }, { who: 'me', text: '우산은 어때?', k: 'c1' }] };
  const chats = [cosChat('c1', st)];
  assert.equal(M.mallEvents(chats[0]).filter((x) => x.includes('우산')).length, 0, M.mallEvents(chats[0]).join('\n'));
  const R = fakeRisu(chats);
  const UI = await fresh();
  UI.resetMalls();
  const ctx = () => ctxOf(structuredClone(chats[0]));
  await UI.mallAction('mall-ask', undefined, ctx(), { render() {}, refresh: async () => {}, current: ctx }, 'cos');
  const after = M.readMall(chats[0].scriptstate, 'cos');
  assert.deepEqual(after.talk.map((l) => l.who), ['owner']);
  assert.equal(R.calls.length, 0);
});

test('cos-5: 운영자 답이 본편 다음 턴 뒤에 와도 다음 본편에 간다', () => {
  const st0 = { ...cosBase(), talk: [{ who: 'me', text: '우산은 어때?', k: 'c1' }] };
  const next = M.applyTalk(st0, M.parseTalk('<owner>\n우산 있다.\n</owner>\n<change mode="none">\n</change>'));
  const stamped = M.stampReply(st0, next, 'c2');
  const chat = { message: [{ role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: 'a', chatId: 'c1' }, { role: 'user', data: 'u', chatId: 'u2' }, { role: 'char', data: 'b', chatId: 'c2' }], scriptstate: M.mallVarsOf('cos', stamped) };
  const ev = M.mallEvents(chat).join('\n');
  assert.match(ev, /우산 있다/);
  assert.match(ev, /우산은 어때/);
});

// ── BM2-2 끝난 상담도 본편에 ──
const deskChat = (key, desk, vars = {}) => ({ message: [{ role: 'user', data: 'u', chatId: 'u1' }, { role: 'char', data: `글.\n${ST}`, chatId: key }], scriptstate: { ...M.deskVars(desk), ...vars }, note: '' });
const agent = { id: 'a1', no: '1234', name: '김', rank: '사원', dept: '총무', intro: '', voice: '', dice: [] };

test('BM2-2: 「상담 종료」·상담원이 끊은 상담도 그 턴 본편에 간다', () => {
  const d = { agent, anchor: 'c1', past: [], talk: [{ who: 'sys', text: '연결' }, { who: 'op', text: '무엇을 도와드릴까요', k: 'c1' }, { who: 'me', text: '환불도 되나요?', k: 'c1' }, { who: 'op', text: '안 됩니다.', k: 'c1' }] };
  const ended = M.endDesk(d);
  assert.equal(ended.talk.length, 0);
  const ev = M.mallEvents(deskChat('c1', ended)).join('\n');
  assert.match(ev, /환불도 되나요/);
  // 다음 상담까지 있어도 둘 다
  const d2 = { ...ended, agent: { ...agent, id: 'a2' }, anchor: 'c1', talk: [{ who: 'me', text: '수령 시간은요?', k: 'c1' }, { who: 'op', text: '아홉 시까지요.', k: 'c1' }] };
  const ev2 = M.mallEvents(deskChat('c1', d2)).join('\n');
  assert.match(ev2, /환불도 되나요/);
  assert.match(ev2, /수령 시간은요/);
  // 다음 턴에는 다시 안 간다
  const c3 = deskChat('c1', M.endDesk(d2));
  c3.message.push({ role: 'user', data: 'u', chatId: 'u2' }, { role: 'char', data: 'x', chatId: 'c2' });
  assert.ok(!M.mallEvents(c3).join('\n').includes('환불'));
});

// ── BM2-6 답 없는 상담 말 ──
test('BM2-6: 답 없는 끝의 상담 말은 본편에 가지 않고, 상담을 다시 열면 떼어 입력칸으로 돌아간다', async () => {
  const d = { agent, anchor: 'c1', past: [], talk: [{ who: 'sys', text: '연결' }, { who: 'op', text: '안녕하세요', k: 'c1' }, { who: 'me', text: '대여창고 몇 시까지 해요?', k: 'c1' }] };
  const vars = { $st_points_on: '1', $br_login: '1', $br_nick: '손님' };
  const chats = [deskChat('c1', d, vars)];
  assert.ok(!M.mallEvents(chats[0]).join('\n').includes('대여창고'));
  assert.ok(!JSON.stringify(M.endDesk(d)).includes('대여창고'));
  const R = fakeRisu(chats);
  const UI = await fresh();
  UI.resetMalls();
  const ctx = () => ctxOf(structuredClone(chats[0]));
  await UI.mallAction('mall-ask', undefined, ctx(), { render() {}, refresh: async () => {}, current: ctx }, 'bm');
  assert.ok(!JSON.stringify(M.readDesk(chats[0].scriptstate).talk).includes('대여창고'));
  assert.equal(R.calls.length, 0);
});

// ── BM2-1 상담 요청에 잔고 ──
test('BM2-1: 1:1 상담 요청의 [최근 본문]에 원 잔고·지난 포인트가 든 상태창 줄이 가지 않는다', () => {
  const chat = deskChat('c1', { agent: null, anchor: '', past: [], talk: [] }, { $st_points_on: '1' });
  chat.message[1].data = '상담 창을 열었다.\n[▣|2025.03.14|11:20 PM|🌙|6°C|가게|없음|없음|없음|백일몽/사원|140000|5000]';
  const src = M.deskSource(ctxOf(chat));
  assert.ok(src.story.includes('상담 창을 열었다') && !src.story.includes('140000') && !src.story.includes('5000'), src.story);
});

// ── BM2-3 백일몽을 나온 뒤 포인트몰 ──
test('BM2-3: 백일몽 소속이 아니면 남은 포인트몰 탭에서 진열·상담을 부르지 않는다', async () => {
  const st = { ...cosBase(), shop: '포인트몰', identity: { sells: '-', never: '-', prices: '-', points: true } };
  const chats = [{ ...deskChat('c1', { agent: null, anchor: '', past: [], talk: [] }, { $br_login: '1', $br_nick: '손님' }), }];
  chats[0].scriptstate = { ...chats[0].scriptstate, ...M.mallVarsOf('bm', st) };
  const R = fakeRisu(chats);
  const UI = await fresh();
  UI.resetMalls();
  const ctx = () => ctxOf(structuredClone(chats[0]));
  const env = { render() {}, refresh: async () => {}, current: ctx };
  await UI.mallAction('mall-refresh', undefined, ctx(), env, 'bm');
  await UI.mallAction('mall-ask', undefined, ctx(), env, 'bm');
  assert.equal(R.calls.length, 0);
});

// ── 99-1 생각 블록 안 상점 표식 ──
test('99-1: 생각 블록 안에만 있는 상점 표식으로는 상점이 열리지 않는다', () => {
  const think = '<Thoughts>\n상점 표식을 붙일까? [shop: 세븐마트|김점장] 아니다.\n</Thoughts>\n';
  const body = '그녀는 계산을 마치고 편의점을 나섰다.';
  assert.equal(M.findShopTag(think + body), null);
  assert.equal(M.findShopTag(`${think}${body}\n[shop: 세븐마트|김점장]`)?.shop, '세븐마트');
  const chat = { message: [{ role: 'user', data: '나간다', chatId: 'u1' }, { role: 'char', data: think + body, chatId: 'c1' }], scriptstate: {} };
  const r = M.settleShop(chat, 1, []);
  assert.ok(!r || !r.vars[M.SHOP_VAR], JSON.stringify(r));
});

// ── GN-1 선쪽지 출처 글이 같은 새로고침에서 빠짐 ──
test('GN-1: 출처 글이 같은 새로고침에서 바뀌어 빠져도 선쪽지를 버리지 않는다', () => {
  const post = { id: 1846001, date: '', nick: '남', title: '이상한 소리', views: 1, votes: 0, body: '본문', mine: false, comments: [{ parent: 0, nick: '나', body: '저도 들었어요', mine: true, unread: false }] };
  const st = { posts: [{ id: 1846099, date: '', nick: '새', title: '새 글', views: 0, votes: 0, body: '새', mine: false, comments: [] }], archive: [], dms: [], sources: {}, seq: 1 };
  const plan = { allowed: true, userHandle: '나', history: [], post, comment: post.comments[0], commentIndex: 1 };
  const ok = M.commitIncoming(st, [{ nick: '익명', body: '그 소리 어디서 들었어요?' }], plan, '2025.03.14');
  assert.equal(ok, true);
  assert.equal(st.dms.length, 1);
  assert.equal(st.sources['익명'].postid, 1846001);
});

// ── 문제1 위키: 다른 채팅으로 옮긴 뒤 앞 채팅의 실패 ──
test('위키 문제1: 다른 채팅으로 옮긴 뒤 앞 채팅의 문서 작성이 실패해도 지금 채팅 위키에 실패 안내·원문이 뜨지 않는다', async () => {
  const chat = (id) => ({ message: [{ role: 'user', data: 'u', chatId: `u${id}` }, { role: 'char', data: '글', chatId: `c${id}` }], scriptstate: {}, note: '' });
  const chats = [chat(0), chat(1)];
  const R = fakeRisu(chats);
  let open;
  R.hold = new Promise((r) => { open = r; });
  R.replies.push('');
  const UI = await fresh();
  UI.resetWiki(true);
  chats[0].scriptstate = { $gen_retries: '0' };
  let cur = ctxOf(chats[0], 0);
  let finished;
  const done = new Promise((r) => { finished = r; });
  const env = { render() {}, refresh: async () => { finished(); }, current: () => cur };
  Object.assign(UI.wiki, { view: 'compose', title: '빛이 없으라' });
  const going = UI.handleWiki('wiki-start', '빛이 없으라', cur, env);
  await new Promise((r) => setTimeout(r, 20));
  cur = ctxOf(chats[1], 1);
  UI.resetWiki(true);
  open();
  await going;
  // 작성은 끝나면 refresh 를 부른다 (handleWiki 는 기다리지 않는다)
  await Promise.race([done, new Promise((r) => setTimeout(r, 20000))]);
  assert.equal(UI.wiki.notice, '');
  assert.equal(UI.wiki.failure, null);
});
