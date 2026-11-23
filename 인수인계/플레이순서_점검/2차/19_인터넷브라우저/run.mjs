// 플레이 순서 점검 2차 · 19 인터넷 브라우저 틀 (탭·즐겨찾기·소속별 사이트·뒤로/앞으로·로그인·저장·카드 단독 창)
// 지침: ../../GPT_점검지침_초안.md 3판. 틀: ../03_백일몽포인트몰/run.mjs · ../09_괴담넷_게시판_DM/run.mjs
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture)를 가짜 Risu(tests/qc-settings-harness.mjs)에 띄운다.
// part=main  : PC 1100×900, 화면 단추를 Playwright 로 눌러 대표 경로
// part=phone : 폰 390×844, 서랍·탭 목록·쓸어 뒤로
// part=branch: 같은 틀에서 상태만 바꿔 갈래(새로고침·채팅 바꾸기·카드 단독 창·소속·망상홈쇼핑 노출·로그인·본편 요청)
// 결과: out/단계NN_*.txt, out/상태NN.json, out/결과-<part>.json
// 사용법: node 인수인계/플레이순서_점검/2차/19_인터넷브라우저/run.mjs [main|phone|branch]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main', 'phone', 'branch'];
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ── 장면 (로어북 「중림 지하상가」, 관리국 신입) ──
const ST = (time, ident = '관리국/신입', place = '중림 지하상가') => `[▣|2025.03.14|${time}|🌙|6°C|${place}|없음|없음|없음|${ident}|100000]`;
const C1 = `퇴근길, 중림 지하상가 셔터가 반쯤 내려와 있었다. 휴대폰 알림이 연달아 울렸다.\n${ST('11:20 PM')}`;
const REFRESH1 = JSON.stringify({
  posts: [
    { author: '야근요정', id: 1846003, tag: '현장', title: '중림 지하상가 B구역 또 셔터 내림', date: '2025.03.14 22:40', views: 1820, upvotes: 64, content: '오늘 B구역 셔터 또 내려감.', mine: false, comments: [] },
    { author: '회수반막내', id: 1846002, tag: '거래', title: '회수물 시세 질문', date: '2025.03.14 21:10', views: 940, upvotes: 21, content: '손거울류 요즘 얼마 쳐줌?', mine: false, comments: [] },
  ],
  incoming: [],
  keyFigures: [],
});

// ── 기록 틀 ──
const results = [];
const notes = [];
let stepNo = 0;
let part = '';
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name: `${part}${name}` }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ part, step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 700)}`}`);
}
function note(s, what, actual) { notes.push({ part, step: `${s.n} ${s.name}`, what, actual }); console.log(`NOTE [${s.n} ${s.name}] ${what}: ${JSON.stringify(actual)?.slice(0, 500)}`); }
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeTxt = (s, body) => writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, body);

const b = await launch();
let page; let errors; let vpNow = 'pc';
const allErrors = [];
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const J = (v) => { try { return JSON.parse(v || 'null'); } catch { return null; } };
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (r && typeof r === 'object' ? r : { type: 'success', result: r })); }, t);
const act = async (action, value, wait = 400) => {
  await page.evaluate(({ action, value }) => {
    const el = document.createElement('button');
    el.dataset.action = action;
    if (value !== undefined) el.dataset.value = value;
    el.style.display = 'none';
    (document.querySelector('.gx-panel') || document.querySelector('.gx') || document.body).appendChild(el);
    el.click();
    el.remove();
  }, { action, value });
  await sleep(wait);
};
const press = async (sel, wait = 500) => { await page.locator(sel).first().click({ timeout: 5000 }); await sleep(wait); };
const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
const waitLlm = async (n0, k = 1) => { await page.waitForFunction(([n0, k]) => (window.__calls.llm || []).length >= n0 + k, [n0, k], { timeout: 15000 }).catch(() => {}); await sleep(1100); };
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
/** 브라우저 틀이 보이는 것: 탭 제목들·지금 탭·주소·즐겨찾기·뒤로/앞으로 단추 */
const chrome = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const tabs = [...document.querySelectorAll('.br-tabs .br-tab')].map((t) => ({ on: t.classList.contains('on'), title: t.querySelector('.br-tt')?.textContent ?? '' }));
  return {
    tabs,
    cur: tabs.findIndex((t) => t.on),
    url: q('.br-omni .br-u')?.textContent ?? '',
    bms: [...document.querySelectorAll('.br-bms [data-action="br-go"]')].map((e) => e.dataset.value),
    ntp: [...document.querySelectorAll('.br-ntp-s')].map((e) => e.dataset.value),
    back: !q('.br-tool [data-action="br-back"]')?.disabled,
    fwd: !q('.br-tool [data-action="br-fwd"]')?.disabled,
    page: q('.br-page')?.className ?? '',
    prof: q('.br-prof')?.getAttribute('aria-label') ?? '',
    pcNavBack: q('.gx-nh[data-action="nav-back"]') ? !q('.gx-nh[data-action="nav-back"]').disabled : null,
    tabN: q('.br-tabn')?.textContent ?? '',
  };
});
const KEEP = /^\$(br_(login|nick|tabs)|gn_nick|st_points_on|hs_(on|net))$/;
const saveState = async (s, extra = {}) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => KEEP.test(k)).map(([k, v]) => [k, J(v) ?? v])), chrome: await chrome().catch(() => null), ...extra }, null, 2));
const mainRequest = async (text, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [text, uid]);
const botReply = async (text, cid, wait = 600) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(wait); };
const BASE = { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_points_on: '0', $ib_affiliation: '관리국', $st_wallet: JSON.stringify({ start: 100000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) };
const firstChat = (extra = {}, msg = C1) => ({ message: [{ role: 'user', data: '지하상가 앞을 지나간다.', chatId: 'u1' }, { role: 'char', data: msg, chatId: 'c1' }], scriptstate: { ...BASE, ...extra } });
const openWindow = async () => {
  await closeWin(page); await sleep(150);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
};
const bootChat = async (chat0, v = 'pc') => {
  if (page) { allErrors.push(...errors); await page.close(); }
  vpNow = v;
  ({ page, errors } = await boot(b, fx, chat0, v, { store: STORE }));
  if (v === 'phone') await page.addStyleTag({ content: '[x-goei-fab]{display:none!important}' });
  await openWindow();
  await closeWin(page); await sleep(200);
};
/** 페이지 새로고침 흉내: 저장된 채팅으로 새 페이지 */
const reloadPage = async () => { const c = await snap(); await bootChat(c, vpNow); };
/** 인터넷 메뉴 (PC 왼쪽 메뉴 단추를 실제로 누른다; 없으면 data-action) */
const goNet = async () => {
  // 이미 인터넷 안이면 누르지 않는다 (인터넷 안에서 「인터넷」을 다시 누르면 상황판으로 가는 것이 정한 동작, 전수점검 보통-74)
  if (await page.$('.gx .br .br-tabs, .gx .br-solo')) return;
  const sel = '.gx-nav [data-action="nav-tab"][data-value="net"]';
  if (vpNow === 'pc' && (await visible(sel))) await press(sel, 500);
  else await act('nav-tab', 'net', 500);
};
const loadPosts = async () => { await queue(REFRESH1); const n0 = await llmCount(); await press('.br-tool [data-action="br-reload"]', 100); await waitLlm(n0); };
const gnOpenState = () => page.evaluate(() => ({ post: !!document.querySelector('.gn-post, .gn-view, .bs-view, [data-gn-post]'), url: document.querySelector('.br-omni .br-u')?.textContent ?? '' }));
/** 카드(채팅 속 「접속하기」)로 사이트 열기: display 로 그려 붙이고 단추를 실제로 누른다 */
const openCard = async (text) => {
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), text);
  await page.evaluate((h) => { document.getElementById('chat-card')?.remove(); const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:10px;top:10px;width:360px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
  const btn = await page.$('#chat-card [data-goei-shop]');
  if (btn) await page.click('#chat-card [data-goei-shop]');
  await sleep(1500);
  await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
  return !!btn;
};
/** 폰 쓸기: 오른쪽으로 쓸면 뒤로 */
const swipe = async (dir = 'back') => {
  await page.evaluate((dir) => {
    const t0 = document.querySelector('.br-page') || document.querySelector('.gx-content');
    const r = t0.getBoundingClientRect();
    const y = r.top + Math.min(200, r.height / 2);
    const x0 = dir === 'back' ? 60 : 320;
    const x1 = dir === 'back' ? 260 : 120;
    const mk = (x) => new Touch({ identifier: 1, target: t0, clientX: x, clientY: y });
    t0.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(x0)], changedTouches: [mk(x0)], bubbles: true }));
    for (const x of [x0 + (x1 - x0) * 0.2, x0 + (x1 - x0) * 0.6, x1]) t0.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(x)], changedTouches: [mk(x)], bubbles: true }));
    t0.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(x1)], bubbles: true }));
  }, dir);
  await sleep(600);
};
const tabsVar = async () => J((await vars()).$br_tabs);
const finish = (p) => writeFileSync(`${OUT}결과-${p}.json`, JSON.stringify({ results: results.filter((r) => r.part === p), notes: notes.filter((r) => r.part === p) }, null, 2));

// ═════════════════════ part main: PC 대표 경로 ═════════════════════
if (PARTS.includes('main')) {
  part = 'PC_'; stepNo = 0;
  await bootChat(firstChat());
  let s;
  s = step('인터넷_첫화면');
  await openWindow();
  await goNet();
  let c = await chrome();
  check(s, '빈 새 탭 하나', c.tabs.length === 1 && c.page.includes('br-p-home'), '탭 1·새 탭', c, '사용자 11-08 「사이트당 탭 하나·빈 새 탭 하나」');
  check(s, '관리국: 즐겨찾기·새 탭 바로가기에 포인트몰(bm) 없음', !c.bms.includes('bm') && !c.ntp.includes('bm'), 'bm 없음', { bms: c.bms, ntp: c.ntp }, '사용자 11-08 「백일몽 포인트몰(백일몽만)」');
  check(s, '즐겨찾기 = 새 탭 바로가기', JSON.stringify(c.bms) === JSON.stringify(c.ntp), c.bms, c.ntp);
  check(s, '게시판 넷·우주몰·위키는 있음', ['gn', 'gal', 'wpf', 'sm', 'cos', 'wk'].every((x) => c.bms.includes(x)), '6개', c.bms, '사용자 11-08 북마크 목록');
  note(s, '망상홈쇼핑(hs) 즐겨찾기 (기본값 $hs_net)', { has: c.bms.includes('hs'), hs_on: (await vars()).$hs_on, hs_net: (await vars()).$hs_net });
  await saveState(s);

  s = step('괴담넷_열기_글열기');
  let n0 = await llmCount();
  await press('.br-bms [data-action="br-go"][data-value="gn"]', 700);
  note(s, '괴담넷을 열 때 보조 호출 수(기본 설정)', (await llmCount()) - n0);
  await loadPosts();
  c = await chrome();
  check(s, '탭 제목·주소가 괴담넷', c.tabs[0]?.title.includes('괴담넷') && c.url.startsWith('goedam.net'), '괴담넷', c);
  const postSel = '[data-action="gn-open"][data-value="1846003"]';
  const hasPost = await page.$(postSel);
  if (hasPost) await press(postSel, 600); else await act('gn-open', '1846003', 600);
  c = await chrome();
  check(s, '글을 열면 주소가 글 주소로', c.url.includes('/board/free/1846003'), '/board/free/1846003', c.url, '사용자 11-08 「게시글은 새 화면으로 열기(같은 탭, 주소 바뀜)」');
  check(s, '탭 뒤로 단추가 켜짐', c.back, true, c.back);
  await saveState(s);

  s = step('새탭_위키_문서');
  await press('.br-tabs [data-action="br-new"]', 500);
  c = await chrome();
  check(s, '+ 누르면 탭 2개, 둘째 탭이 새 탭', c.tabs.length === 2 && c.cur === 1 && c.page.includes('br-p-home'), '2·cur1', c);
  check(s, '새 탭은 뒤로 못 감', !c.back, false, c.back);
  await press('.br-bms [data-action="br-go"][data-value="wk"]', 800);
  await act('wiki-pick', '중림 지하상가', 800);
  c = await chrome();
  check(s, '위키 문서 주소', c.url.includes('/w/중림 지하상가') || c.url.includes('/w/'), '/w/중림 지하상가', c.url);
  await saveState(s);

  s = step('뒤로_앞으로_단추');
  await press('.br-tool [data-action="br-back"]', 600);
  const back1 = await chrome();
  await press('.br-tool [data-action="br-back"]', 600);
  const back2 = await chrome();
  check(s, '뒤로 1: 위키 대문', back1.url === 'goei.wiki' || back1.url.endsWith('goei.wiki') || back1.tabs[1]?.title.includes('대문'), '대문', back1);
  check(s, '뒤로 2: 이 탭의 새 탭 화면 (괴담넷 탭으로 안 건너감)', back2.cur === 1 && back2.page.includes('br-p-home'), 'cur1·새 탭', back2, '사용자 11-10 「탭별로 움직여야 한다」(app.ts 346 주석)');
  await press('.br-tool [data-action="br-fwd"]', 500);
  await press('.br-tool [data-action="br-fwd"]', 600);
  c = await chrome();
  check(s, '앞으로 두 번: 위키 문서로', c.url.includes('/w/'), '/w/…', c.url);
  await saveState(s);

  s = step('같은탭_다른사이트_뒤로');
  await press('.br-bms [data-action="br-go"][data-value="wpf"]', 700);
  const wpf = await chrome();
  await press('.br-tool [data-action="br-back"]', 600);
  c = await chrome();
  check(s, '세정게로 바꾼 뒤 뒤로 → 같은 탭 위키 문서', wpf.url.startsWith('www.wpf.or.kr') && c.url.includes('/w/') && c.cur === 1, '/w/…', { wpf: wpf.url, back: c.url });
  await saveState(s);

  s = step('첫탭으로_돌아가기');
  await press('.br-tabs .br-tab:nth-child(1) .br-tabb', 700);
  c = await chrome();
  check(s, '괴담넷 탭은 보던 글 그대로', c.cur === 0 && c.url.includes('/board/free/1846003'), '/board/free/1846003', c);
  await saveState(s);

  s = step('같은사이트_즐겨찾기');
  await press('.br-bms [data-action="br-go"][data-value="gn"]', 700);
  c = await chrome();
  check(s, '보던 사이트의 즐겨찾기를 누르면 그 사이트 첫 화면(목록)', !c.url.includes('/1846003'), 'goedam.net/board/free', c.url, 'app.ts goSite 주석 「지금 탭에서 사이트를 연다 (그 사이트 첫 화면부터)」, 위키는 resetWiki 로 대문');
  await saveState(s);

  s = step('다른사이트_갔다가_즐겨찾기');
  // 글을 다시 열고 → 괴담갤로 → 괴담넷 즐겨찾기
  if (await page.$(postSel)) await press(postSel, 500); else await act('gn-open', '1846003', 500);
  await press('.br-bms [data-action="br-go"][data-value="gal"]', 700);
  await press('.br-bms [data-action="br-go"][data-value="gn"]', 700);
  c = await chrome();
  check(s, '괴담갤 갔다가 괴담넷 즐겨찾기 → 첫 화면', !c.url.includes('/1846003'), 'goedam.net/board/free', c.url, '같은 근거');
  await saveState(s);

  s = step('탭닫기_되살리기');
  await press('.br-tabs .br-tab:nth-child(2) [data-action="br-close"]', 600);
  c = await chrome();
  const closed1 = c.tabs.length;
  await act('br-reopen', '', 700);
  const re = await chrome();
  check(s, '둘째 탭 × → 탭 1개', closed1 === 1, 1, closed1);
  check(s, 'ㄱ 제스처(br-reopen) → 닫은 탭이 위키 문서로 되살아나고 뒤로 가능', re.tabs.length === 2 && re.cur === 1 && re.url.includes('/w/') && re.back, '탭2·/w/·뒤로', re, '11-09 사용자 마우스 제스처 ㄱ');
  await saveState(s);

  s = step('로그인_로그아웃');
  await press('.br-prof', 400);
  const defNick = await page.locator('.br-lgn input[name="br-nick"]').inputValue();
  note(s, '로그인 칸 미리 든 값(지난 닉네임 없으면 페르소나 이름)', defNick);
  await page.locator('.br-lgn input[name="br-nick"]').fill('토끼');
  await press('.br-lgn [data-action="br-login-save"]', 700);
  let v = await vars();
  c = await chrome();
  check(s, '로그인: $br_login 1, $br_nick·$gn_nick 토끼, 프로필 표시', v.$br_login === '1' && v.$br_nick === '토끼' && v.$gn_nick === '토끼' && c.prof.includes('토끼'), '토끼', { login: v.$br_login, nick: v.$br_nick, gn: v.$gn_nick, prof: c.prof });
  await press('.br-prof', 400);
  await press('.br-lgn [data-action="br-login-guest"]', 700);
  v = await vars();
  check(s, '로그아웃: $br_login 0, $br_nick 남김(다음에 미리 채움), 게시판 닉 비움', v.$br_login === '0' && v.$br_nick === '토끼' && !v.$gn_nick, '0·토끼·빈', { login: v.$br_login, nick: v.$br_nick, gn: v.$gn_nick }, '11-09 사용자 「로그아웃하면 닉네임이 날아갔다」');
  await press('.br-prof', 400);
  const again = await page.locator('.br-lgn input[name="br-nick"]').inputValue();
  check(s, '다시 열면 지난 닉네임이 미리 들어 있음', again === '토끼', '토끼', again);
  await page.locator('.br-lgn input[name="br-nick"]').fill('   ');
  await page.locator('.br-lgn input[name="br-nick"]').press('Enter');
  await sleep(500);
  v = await vars();
  check(s, '빈 닉네임 엔터는 로그인 안 됨', v.$br_login === '0', '0', v.$br_login, '2026-11-09 사용자');
  await press('.br-lgn [data-action="br-login-save"]', 300).catch(() => {});
  await act('br-login', '', 300);
  await saveState(s);

  s = step('저장_새로고침_되살림');
  await sleep(2000);
  const tv = await tabsVar();
  check(s, '$br_tabs 에 탭 2개·지금 탭 1 저장', tv?.t?.length === 2 && tv?.c === 1, '2·c1', tv);
  const before = await chrome();
  await reloadPage();
  await openWindow();
  await goNet();
  c = await chrome();
  check(s, '새로고침 뒤 인터넷: 같은 탭 수·같은 지금 탭·같은 주소', c.tabs.length === before.tabs.length && c.cur === before.cur && c.url === before.url, before, c, '사용자 11-08 「새로고침해도 탭이 남게」');
  check(s, '새로고침 뒤에도 탭 뒤로 가능', c.back, true, c.back);
  if (c.back) { await press('.br-tool [data-action="br-back"]', 600); note(s, '새로고침 뒤 뒤로 한 번', await chrome()); }
  await saveState(s);

  s = step('본편요청_내부값');
  const out = await mainRequest('휴대폰을 주머니에 넣는다.', 'u2');
  const all = out.map((m) => m.content).join('\n');
  writeTxt(s, fmtMsgs(out));
  check(s, '본편 요청에 브라우저 내부 값($br_tabs·탭 상태 JSON·로그인 표식) 없음', !/br_tabs|"tab":"(net|gnet|wiki)"|\$br_login|\$br_nick/.test(all), '없음', /br_tabs|"tab":"(net|gnet|wiki)"|\$br_login|\$br_nick/.exec(all)?.[0] ?? '');
  await saveState(s);
  finish('PC_');
}

// ═════════════════════ part phone: 폰 ═════════════════════
if (PARTS.includes('phone')) {
  part = '폰_'; stepNo = 40;
  await bootChat(firstChat(), 'phone');
  let s; let c;
  s = step('서랍_사이트');
  await openWindow();
  const drawer = await page.evaluate(() => [...document.querySelectorAll('.gx-cdr [data-action="br-site"]')].map((e) => e.dataset.value));
  check(s, '폰 서랍: 사이트 전부(관리국이라 포인트몰 없음)', ['gn', 'gal', 'wpf', 'sm', 'cos', 'wk'].every((x) => drawer.includes(x)) && !drawer.includes('bm'), 'bm 없는 6+', drawer, '사용자 11-08 폰 서랍');
  await act('br-site', 'gn', 700);
  c = await chrome();
  check(s, '서랍 괴담넷 → 인터넷 탭이 괴담넷', c.page.includes('br-p-gn'), 'br-p-gn', c.page);
  check(s, '폰은 주소줄 ‹ › 새로고침 단추가 안 보임(PC 전용)', !(await visible('.br-tool [data-action="br-back"]')), '안 보임', await visible('.br-tool [data-action="br-back"]'));
  await saveState(s);

  s = step('탭목록_새탭_위키');
  await press('.br-tool [data-action="br-list"]', 500);
  const list = await page.evaluate(() => document.querySelectorAll('.br-tlist .br-tcard').length);
  check(s, '탭 수 단추 → 탭 목록 1장', list === 1, 1, list);
  await press('.br-tlist [data-action="br-new"]', 600);
  c = await chrome();
  check(s, '탭 목록 「새 탭」 → 새 탭 화면, 탭 수 2', c.page.includes('br-p-home') && c.tabN === '2', '2', c);
  await act('br-site', 'wk', 700);
  await act('wiki-pick', '중림 지하상가', 800);
  c = await chrome();
  check(s, '둘째 탭에서 위키 문서', c.url.includes('/w/'), '/w/…', c.url);
  await saveState(s);

  s = step('쓸어서_뒤로');
  await swipe('back');
  const sw1 = await chrome();
  await swipe('back');
  const sw2 = await chrome();
  await swipe('back');
  const sw3 = await chrome();
  writeTxt(s, JSON.stringify({ sw1, sw2, sw3 }, null, 2));
  check(s, '뒤로 쓸기 1: 같은 탭 위키 대문', sw1.page.includes('br-p-wk') && sw1.tabN === '2', '위키 대문', sw1);
  check(s, '뒤로 쓸기 2: 같은 탭 새 탭 화면', sw2.page.includes('br-p-home'), '새 탭 화면', sw2);
  check(s, '뒤로 쓸기 3: 이 탭 처음이라 더 안 감 (괴담넷 탭으로 건너가지 않음)', sw3.page.includes('br-p-home'), '그대로', sw3, '사용자 11-10 「탭별로 움직여야 한다」(app.ts 346 주석, PC 마우스 제스처는 탭 기록만)');
  await saveState(s);

  s = step('가로넘침');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(s, '폰 가로 넘침 없음', !wide, false, wide);
  await page.screenshot({ path: `${OUT}폰_인터넷.png` });
  finish('폰_');
}

// ═════════════════════ part branch: 갈래 ═════════════════════
if (PARTS.includes('branch')) {
  part = '갈래_'; stepNo = 60;
  let s; let c;

  // ── 카드 단독 창 → 닫기 → 상황판 인터넷 · 전역 ‹ (PC 메뉴 뒤로) ──
  s = step('카드단독창_뒤_전역뒤로');
  await bootChat(firstChat());
  await openWindow();
  await goNet();
  await press('.br-bms [data-action="br-go"][data-value="gn"]', 700);
  await press('.br-bms [data-action="br-go"][data-value="wk"]', 700);
  const pre = await chrome();
  await closeWin(page); await sleep(300);
  const card = await openCard(`가판대 화면에 쇼핑몰 주소가 떠 있었다.\n${ST('11:30 PM')}\n[shop: 우주 쇼핑몰|@web:cos]`);
  const solo = await page.evaluate(() => ({ solo: !!document.querySelector('.br-solo'), page: document.querySelector('.br-page')?.className ?? '' }));
  check(s, '카드 「접속하기」 → 탭·주소줄 없는 우주몰 단독 창', card && solo.solo && solo.page.includes('br-p-cos'), 'br-solo·cos', { card, ...solo }, '11-20 사용자 「인터넷 창을 통째로 띄우지 않는다」');
  await closeWin(page); await sleep(300);
  await openWindow();
  await goNet();
  c = await chrome();
  check(s, '단독 창을 닫고 상황판 인터넷: 전과 같은 탭(우주몰 탭 없음)', c.tabs.length === pre.tabs.length && !c.tabs.some((t) => /쇼핑몰|★/.test(t.title)), pre, c, '11-20 사용자 「카드로 본 망상홈쇼핑이 상황판 인터넷 창에 남아 있다」');
  const tabs0 = c.tabs.length;
  const hops = [];
  for (let i = 0; i < 4; i++) {
    const nb = page.locator('.gx-nh[data-action="nav-back"]').first();
    if (!(await nb.isVisible().catch(() => false)) || (await nb.isDisabled())) break;
    await nb.click(); await sleep(600);
    hops.push(await chrome());
  }
  await sleep(2000);
  const savedTabs = await tabsVar();
  writeTxt(s, JSON.stringify({ pre, after: c, hops, savedTabs }, null, 2));
  note(s, '2초 뒤 $br_tabs 에 남은 탭 수(사이트)', savedTabs?.t?.map((t) => t.s));
  check(s, 'PC 메뉴 ‹ 를 눌러도 탭이 새로 생기지 않고 우주몰(단독 창에서 본 것)이 상황판 인터넷에 안 나옴', hops.every((h) => h.tabs.length <= tabs0 && !/br-p-cos/.test(h.page)), `탭 ≤ ${tabs0}, cos 없음`, hops.map((h) => ({ n: h.tabs.length, page: h.page, titles: h.tabs.map((t) => t.title) })), '11-20 사용자(위와 같음) · app.ts navStep 「닫힌 탭이면 새 탭에」');
  await saveState(s);

  // ── 전역 ‹ (PC 메뉴) 뒤 탭 기록 ──
  s = step('PC메뉴뒤로_뒤_탭기록');
  await bootChat(firstChat());
  await openWindow();
  await goNet();
  await press('.br-bms [data-action="br-go"][data-value="gn"]', 700);
  await press('.br-tabs [data-action="br-new"]', 500);
  await press('.br-bms [data-action="br-go"][data-value="wk"]', 700);
  // PC 메뉴 ‹ 한 번 → 둘째 탭 새 탭 화면
  await press('.gx-nh[data-action="nav-back"]', 600);
  const m1 = await chrome();
  note(s, 'PC 메뉴 ‹ 뒤', m1);
  await saveState(s);
  check(s, 'PC 메뉴 ‹ 뒤 주소줄 › 로 위키에 다시 갈 수 있음 (두 기록이 어긋나지 않음)', m1.fwd, 'br-fwd 켜짐', { back: m1.back, fwd: m1.fwd, page: m1.page }, '실제 브라우저처럼 탭 기록(사용자 11-10). 근거 약함 — 물을 것 후보');

  // ── 소속: 백일몽 ↔ 관리국 ──
  s = step('백일몽_즐겨찾기');
  await bootChat(firstChat({ $st_faction: 'C00', $st_points_on: '1', $ib_affiliation: '백일몽' }, `점심시간, 사내망에 접속했다.\n${ST('12:10 PM', '백일몽/사원', '백일몽 본사')}`));
  await openWindow(); await goNet();
  c = await chrome();
  check(s, '백일몽 소속: 즐겨찾기·새 탭에 포인트몰', c.bms.includes('bm') && c.ntp.includes('bm'), 'bm 있음', { bms: c.bms, ntp: c.ntp });
  await press('.br-bms [data-action="br-go"][data-value="bm"]', 700);
  await press('.br-tabs [data-action="br-new"]', 500);
  await press('.br-bms [data-action="br-go"][data-value="gn"]', 700);
  await press('.br-tabs .br-tab:nth-child(1) [data-action="br-close"]', 600);
  await sleep(1800);
  await saveState(s);

  s = step('관리국으로_바뀐뒤_닫은탭되살림');
  await page.evaluate(() => { window.__chat.scriptstate.$st_points_on = '0'; window.__chat.scriptstate.$st_faction = 'A00'; });
  await reloadPage();
  await openWindow(); await goNet();
  c = await chrome();
  const n0 = await llmCount();
  await act('br-reopen', '', 800);
  const r = await chrome();
  const calls = (await llmCount()) - n0;
  check(s, '관리국: 즐겨찾기에 bm 없음', !c.bms.includes('bm'), '없음', c.bms);
  note(s, 'ㄱ(닫은 탭 다시 열기)로 포인트몰 탭이 되살아나는가 — 03 문제3 과 같은 뿌리(bmHtml 소속 확인 없음)', { page: r.page, titles: r.tabs.map((t) => t.title), calls });
  await saveState(s);

  // ── 망상홈쇼핑 노출 ──
  s = step('망상홈쇼핑_노출');
  await bootChat(firstChat({ $hs_on: '1', $hs_net: '1' }));
  await openWindow(); await goNet();
  const hsOn = (await chrome()).bms.includes('hs');
  await page.evaluate(() => { window.__chat.scriptstate.$hs_net = '0'; });
  await openWindow(); await goNet();
  const hsOff = (await chrome()).bms.includes('hs');
  check(s, '「인터넷에 상시 노출」 켬 → 즐겨찾기에 있음, 끔 → 없음', hsOn && !hsOff, '있음→없음', { hsOn, hsOff }, 'app.ts browserSites 주석');
  await saveState(s);

  // ── 채팅 바꾸기: 채팅마다 탭 따로 ──
  s = step('채팅바꾸기');
  await bootChat(firstChat());
  await page.evaluate(() => {
    window.__chats = [window.__chat, JSON.parse(JSON.stringify({ ...window.__chat, scriptstate: { ...window.__chat.scriptstate } }))];
    window.__ci = 0;
    window.risuai.getCurrentChatIndex = async () => window.__ci;
    window.risuai.getChatFromIndex = async (a, i) => JSON.parse(JSON.stringify(window.__chats[i ?? window.__ci]));
    window.risuai.setChatToIndex = async (a, i, chat) => { window.__calls.setChat.push(chat); window.__chats[i] = JSON.parse(JSON.stringify(chat)); if (i === window.__ci) window.__chat = window.__chats[i]; };
  });
  await openWindow(); await goNet();
  await press('.br-bms [data-action="br-go"][data-value="cos"]', 800);
  await sleep(1800);
  const a1 = await chrome();
  await closeWin(page);
  await page.evaluate(() => { window.__ci = 1; window.__chat = window.__chats[1]; });
  await openWindow(); await goNet();
  const b1 = await chrome();
  note(s, '채팅 B 화면', { b1, txt: await page.evaluate(() => document.querySelector('.gx')?.innerText.slice(0, 300)) });
  await act('br-go', 'wpf', 700);
  await sleep(1800);
  await closeWin(page);
  await page.evaluate(() => { window.__ci = 0; window.__chat = window.__chats[0]; });
  await openWindow(); await goNet();
  const a2 = await chrome();
  check(s, '채팅 B 는 빈 새 탭(채팅 A 의 우주몰이 안 옴)', b1.page.includes('br-p-home'), '새 탭', b1);
  check(s, '채팅 A 로 돌아오면 A 의 우주몰 탭', a2.page.includes('br-p-cos') && a2.tabs.length === a1.tabs.length, 'cos', a2);
  const chats = await page.evaluate(() => window.__chats.map((c) => c.scriptstate.$br_tabs));
  writeTxt(s, JSON.stringify({ a1, b1, a2, chats }, null, 2));
  await saveState(s);

  // ── 깨진 $br_tabs ──
  s = step('깨진_탭저장값');
  await bootChat(firstChat({ $br_tabs: '{"c":5,"t":[{"s":"zz","h":[1,"x"],"a":9},{"s":"bm","h":[],"a":-1}]' }));
  await openWindow(); await goNet();
  c = await chrome();
  check(s, '깨진 JSON → 빈 새 탭 하나, 오류 없음', c.tabs.length === 1 && c.page.includes('br-p-home'), '새 탭 1', c);
  await saveState(s);
  s = step('남의소속_사이트가_든_탭저장값');
  await bootChat(firstChat({ $br_tabs: JSON.stringify({ c: 0, t: [{ s: 'bm', h: [], a: -1 }] }) }));
  await openWindow(); await goNet();
  c = await chrome();
  note(s, '관리국 채팅에 bm 탭이 저장돼 있으면 (03 문제3 과 같은 뿌리)', { page: c.page, titles: c.tabs.map((t) => t.title), bms: c.bms });
  await saveState(s);

  // ── 탭 기록 저장 창 밖 (뒤로 많이 간 탭) ──
  s = step('뒤로많이간_탭_새로고침');
  await bootChat(firstChat());
  await openWindow(); await goNet();
  await press('.br-bms [data-action="br-go"][data-value="wk"]', 700);
  const titles = ['중림 지하상가', '관리국', '백일몽', '특수재난대응협회', '중림 지하상가', '관리국', '백일몽', '특수재난대응협회', '중림 지하상가', '관리국', '백일몽', '특수재난대응협회'];
  for (const t of titles) await act('wiki-pick', t, 250);
  for (let i = 0; i < 11; i++) await act('br-back', '', 200);
  const far = await chrome();
  await sleep(1800);
  await reloadPage();
  await openWindow(); await goNet();
  c = await chrome();
  writeTxt(s, JSON.stringify({ far, after: c, saved: await tabsVar() }, null, 2));
  note(s, '13칸 기록에서 11번 뒤로 간 탭을 새로고침 (저장은 최근 10칸만)', { before: far.url, after: c.url, back: c.back, fwd: c.fwd });
  await saveState(s);

  // ── 폰: 서랍으로 이미 열린 사이트 탭 ──
  s = step('폰_서랍_이미있는탭');
  await bootChat(firstChat(), 'phone');
  await openWindow();
  await act('br-site', 'gn', 600);
  await act('br-list', '', 300); await act('br-new', '', 400);
  await act('br-site', 'wk', 600);
  await act('nav-tab', 'board', 400);
  await act('br-site', 'gn', 600);
  c = await chrome();
  check(s, '인터넷 밖에서 서랍 괴담넷 → 있던 괴담넷 탭으로 (탭 수 그대로)', c.page.includes('br-p-gn') && c.tabN === '2', 'gn·2', c, 'app.ts br-site 주석');
  await saveState(s);
  finish('갈래_');
}

allErrors.push(...(errors ?? []));
writeFileSync(`${OUT}오류.json`, JSON.stringify(allErrors, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length} 검사, 통과 ${results.length - fail.length}, 실패 ${fail.length}`);
await b.close();
