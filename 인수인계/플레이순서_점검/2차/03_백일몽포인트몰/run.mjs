// 플레이 순서 점검 2차 · 백일몽 포인트몰 + 1:1 상담 (지침: ../../GPT_점검지침_초안.md, 1차 틀: ../../2_몰/run.mjs 포인트몰 부분을 복사해 갈래를 늘림)
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄운다.
// part=main: PC 1100×900 에서 화면 단추를 Playwright 로 직접 누름. part=phone: 폰 390×844 단추. part=branch: 같은 틀에서 상태만 바꿔 data-action 으로.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과-<part>.json
// 사용법: node 인수인계/플레이순서_점검/2차/03_백일몽포인트몰/run.mjs [main|phone|branch|branch2]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main'];
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ── 장면: 로어북 「백일몽」 본사(서울 강남구). 신분 백일몽/사원, 원 140,000 · 포인트 5,000p ──
const BST = (time, points, ident = '백일몽/사원', won = 140000) => `[▣|2025.04.02|${time}|☀️|12°C|백일몽 본사|없음|없음|없음|${ident}|${won}|${points}]`;
const B1 = `점심시간, 사원증을 찍고 사내망에 접속했다. 복지몰 배너가 반짝였다.\n${BST('12:10 PM', 5000)}`;
const B2 = `오후 업무가 시작됐다. 책상 위 모니터에 결재 알림이 쌓여 있었다.\n${BST('01:30 PM', 3800)}`;
const B3 = `퇴근 무렵, 보안팀 대여창고 앞 복도는 한산했다.\n${BST('06:10 PM', 3800)}`;
const B4 = `대여창고 직원이 상자를 건넸다. 안대형 수면 마스크가 비닐에 싸여 있었다.\n${BST('06:30 PM', 3000)}`;

const BM_SHELF1 = `<shop-identity>
sells: 임직원 복지 물품, 가전, 건강 용품, 현장 탐사 보급품
never: 현금 교환, 외부 반출 기밀품
prices: 백일몽 복지 포인트만, 정가
</shop-identity>
<owner>
이달의 복지 상품이 새로 등록되었습니다.
</owner>
<shelf>
현장용 소형 응급 키트|1200|소모5|의료/구급상자/first aid kit|0.42|현장탐사팀 표준 응급 키트, 붕대와 소독약 포함|가벼운 상처 응급 처치|
안대형 수면 마스크|800|장비|옷/안대/sleep mask|0.035|숙면용 안대, 사내 의무실 추천품||
B등급 꿈결용액 앰플|9000|소모1|의료/앰플/ampoule|0.015|정제된 B등급 꿈결용액 한 병|상처 회복 촉진|희귀
</shelf>`;
const BM_SHELF2 = `<owner>
신규 상품이 입고되었습니다.
</owner>
<shelf>
사원증 목걸이 줄|300|장비|옷/목걸이줄/lanyard|0.02|사원증용 목걸이 줄, 남색||
휴대용 손난로|500|소모3|소모품/손난로/hand warmer|0.06|흔들면 데워지는 일회용 손난로 세 개||
</shelf>`;
const BM_SHELF_ZERO = `<owner>
</owner>
<shelf>
무료 시음 쿠폰|0|소모1|서류/쿠폰/coupon|0.005|사내 카페 시음 쿠폰||
사무용 볼펜|40|소모1|도구/볼펜/pen|0.01|검정 볼펜 한 자루||
</shelf>`;
const DESK_MAKE = (name = '김하영', dept = '인사팀') => `<card>
이름: ${name}
직급: 주임
부서: ${dept}
소개: 내근 4년 차, 월급만큼만 일한다
말투: 짧고 사무적인 존댓말
</card>
<say>안녕하세요. 포인트몰 상담입니다.</say>`;
const DESK_TALK = `<say>붕대랑 소독약이요.

수령은 본사 대여창고입니다.</say>`;
const DESK_END = `<say>다른 문의는 내일 다시 주세요.</say>
<end/>`;
const DESK_TALK_B = `<say>네, 말씀하세요.</say>`;

// ── 기록 틀 ──
const results = [];
const notes = [];
let stepNo = 0;
let part = '';
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name: `${part}${name}` }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
function note(s, what, actual) { notes.push({ step: `${s.n} ${s.name}`, what, actual }); console.log(`NOTE [${s.n} ${s.name}] ${what}: ${JSON.stringify(actual)?.slice(0, 400)}`); }
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const inventoryOf = (out) => out.filter((m) => m.role === 'system' && /\[Inventory\]|\[Shop\]/.test(m.content)).map((m) => m.content).join('\n');
const thisTurn = (inv) => /This turn:[^\n]*/.exec(inv)?.[0] ?? '';
const allText = (msgs) => msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
const sysText = (msgs) => msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
const userText = (msgs) => msgs.filter((m) => m.role === 'user').map((m) => m.content).join('\n');

const b = await launch();
let page; let errors;
const allErrors = [];
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
const balOf = async (k) => page.evaluate((k) => { const c = window.__chat; const keys = new Set(c.message.map((m, i) => m.chatId ?? String(i))); const w = JSON.parse(c.scriptstate[k] || 'null'); return w ? w.start + w.log.filter((e) => !e.anchor || keys.has(e.anchor)).reduce((n, e) => n + e.amount, 0) : null; }, k);
const pts = () => balOf('$st_points');
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (r && typeof r === 'object' ? r : { type: 'success', result: r })); }, t);
const hold = () => page.evaluate(() => { window.__llm = [new Promise((r) => { window.__release = (t) => r({ type: 'success', result: t }); })]; });
const release = (t) => page.evaluate((t) => window.__release?.(t), t);
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
const screen = () => page.evaluate(() => document.querySelector('.ms')?.innerText ?? '');
const deskScreen = () => page.evaluate(() => document.querySelector('.bd-win')?.innerText ?? '');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const KEEP = /^\$(st_(wallet|items|points|item_use|points_on|faction)|bm_(shop|shop_note|shop_at|shop_seen|orders|desk)|br_(login|nick|tabs))$/;
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => KEEP.test(k)).map(([k, v]) => [k, J({ v }, 'v') ?? v])), messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2));
const mainRequest = async (text, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [text, uid]);
const rerollRequest = async () => page.evaluate(async () => {
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
});
const peekMain = async (text) => { const c = await snap(); const out = await mainRequest(text, 'peek'); await page.evaluate((c) => { window.__chat = c; }, c); return out; };
const botReply = async (text, cid, wait = 600) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(wait); };
const openBm = async (byPress = false) => {
  await closeWin(page); await sleep(200);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await act('nav-tab', 'net');
  if (!(await page.$('.ms-bm'))) {
    if (byPress && (await visible('.br-bms [data-action="br-go"][data-value="bm"]'))) await press('.br-bms [data-action="br-go"][data-value="bm"]', 600);
    else await act('br-go', 'bm', 600);
  }
};
const callLog = [];
const dumpCalls = async (tag) => { const n = await llmCount(); for (let i = 0; i < n; i++) { const m = await llmAt(i); callLog.push(`${tag} #${i} ${String(m[0]?.content ?? '').slice(0, 70).replace(/\n/g, ' ')}`); } };
const BASE = { $st_look: '7.1', $st_faction: 'C00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_points_on: '1', $st_items: JSON.stringify({ list: [], log: [] }), $st_points: JSON.stringify({ start: 0, log: [{ id: 'p1', anchor: '', amount: 5000, memo: '이번 달 복지 포인트', src: 'story', at: '2026-11-08T00:00:00Z' }] }) };
const LOGIN = { $br_login: '1', $br_nick: '토끼' };
const firstChat = (extra = {}) => ({ message: [{ role: 'user', data: '점심을 먹고 자리로 돌아온다.', chatId: 'u1' }, { role: 'char', data: B1, chatId: 'c1' }], scriptstate: { ...BASE, ...extra } });
const bootChat = async (chat0, v = 'pc', tag = part) => {
  if (page) { await dumpCalls(tag); allErrors.push(...errors); await page.close(); }
  ({ page, errors } = await boot(b, fx, chat0, v, { store: STORE }));
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); });
  await sleep(400);
};
/** 페이지 새로고침 흉내: 지금 채팅(저장 상태)으로 새 페이지를 띄운다 */
const reloadPage = async (v = 'pc') => { const c = await snap(); await bootChat(c, v); };
const loadShelf = async (reply = BM_SHELF1) => { await openBm(); await act('mall-page', ''); await queue(reply); const n0 = await llmCount(); await act('mall-refresh', ''); await waitLlm(n0); return J(await vars(), '$bm_shop'); };
/** 지금 살아 있는 진열(다시 굴리기로 되살아난 것 포함)에서 이름으로 id: 화면 카드에서 읽고, 화면에 없으면 저장 상태 */
const idOf = async (name) => (await page.evaluate((n) => [...document.querySelectorAll('.ms-bm .bp-it')].find((e) => e.querySelector('.bp-nm')?.textContent === n)?.dataset.item, name)) || J(await vars(), '$bm_shop')?.items?.find((x) => x.name === name && !x.sold)?.id;
const MONEY_LEAK = (all) => /\|140000\b|140,000|\b140000\b/.test(all);
const statusLines = (all) => (all.match(/\[▣[^\]\n]*\]/g) ?? []);
const situ = (all) => /\[진행 중 괴이·사건\]\n([\s\S]*?)(?:\n\n\[|$)/.exec(all)?.[1] ?? '';

// ═════════════════════ part main: 대표 경로 (PC, 화면 단추) ═════════════════════
if (PARTS.includes('main')) {
  part = 'PC_';
  await bootChat(firstChat());
  const ids = {};
  {
    const s = step('열기_로그인전');
    const n0 = await llmCount();
    await closeWin(page); await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await act('nav-tab', 'net');
    await act('br-home', '', 500);
    const sites = await page.evaluate(() => [...document.querySelectorAll('.br-bms [data-action="br-go"]')].map((e) => e.dataset.value));
    check(s, '백일몽 소속: 즐겨찾기에 포인트몰', sites.includes('bm'), 'bm', sites, '사용자 11-08 「백일몽 포인트몰(백일몽만, 로그인해야 씀)」');
    await press('.br-bms [data-action="br-go"][data-value="bm"]', 700);
    const txt = await screen();
    check(s, '로그인 전: 「로그인이 필요합니다」, 상품·1:1 상담 단추 없음', txt.includes('로그인이 필요합니다') && !(await page.$('.bp-desk')), '로그인 필요', txt.slice(0, 200), '사용자 11-08 로그인해야 씀');
    check(s, '자동 호출 기본 수동: 열어도 보조 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0, '사용자 11-22');
    await saveState(s);
  }
  {
    const s = step('로그인_단추');
    await press('.bp-box [data-action="br-login"]', 400);
    await page.locator('.br-lgn input[name="br-nick"]').fill('토끼');
    await press('.br-lgn [data-action="br-login-save"]', 700);
    const v = await vars();
    const txt = await screen();
    check(s, '로그인 저장($br_login 1·토끼), 보유 5,000 P, 빈 진열 안내', v.$br_login === '1' && v.$br_nick === '토끼' && txt.includes('5,000 P') && txt.includes('등록된 상품이 없습니다'), '토끼 · 5,000 P', { login: v.$br_login, nick: v.$br_nick, txt: txt.slice(0, 200) });
    await saveState(s);
  }
  {
    const s = step('첫진열_단추');
    await queue(BM_SHELF1);
    const n0 = await llmCount();
    await press('.ms [data-action="mall-refresh"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, BM_SHELF1);
    const all = allText(msgs); const sys = sysText(msgs); const usr = userText(msgs);
    check(s, '보조 호출 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    check(s, 'COMMON·FIRST·POINT_SHOP 이 들어감', sys.includes('point.baekilmong.intra') && sys.includes('First page of this visit') && sys.includes("This is Baekilmong's point shop"), '세 절', { common: sys.includes('point.baekilmong.intra'), first: sys.includes('First page of this visit') });
    check(s, 'FIRST 가 몰 공지를 시킴(807f994): 「owner\'s first line to the protagonist」 없음', !all.includes("owner's first line") && all.includes('a short mall notice about the goods on this page'), '공지', /<owner>\n[^\n]*/.exec(sys)?.[0], '사용자 11-08 운영자 없음, 11-22 23:22 「고쳐」');
    // 지침 COMMON 「There is no shopkeeper」 과 다른 절이 같은 요청에서 주인을 전제하나
    const ownerHits = ['the owner\'s pride', 'who the owner is', "owner's character", 'the owner remembers'].filter((k) => all.includes(k));
    check(s, '같은 요청 안에 주인(owner)을 전제하는 문장이 없음 (COMMON 「There is no shopkeeper」과 같은 뜻)', ownerHits.length === 0, '없음', ownerHits, '사용자 11-08 「포인트몰: 운영자 없음」, 1차 문제6 을 사용자가 11-22 23:22 「고쳐」');
    check(s, '[가게] 칸이 주인 없이(HEAD_SHOP)', /\[가게\]\n백일몽 포인트몰\n/.test(usr) && !/주인:/.test(usr), '[가게] 백일몽 포인트몰', /\[가게\][^\n]*\n[^\n]*/.exec(usr)?.[0]);
    check(s, '진열 배정이 포인트 구간(p)', /Item 1 — CATEGORY:[^\n]*price [\d,]+-[\d,]+ p/.test(all), 'p 구간', /Item 1 —[^\n]*/.exec(all)?.[0]);
    check(s, '포인트(5000)·원 잔고(140000)가 요청 어디에도 없음', !/\b5000\b|5,000/.test(all) && !MONEY_LEAK(all), '없음', statusLines(all), '포인트몰 COMMON 「Never mention the player\'s points」, 사용자 11-22 잔고 숨김');
    check(s, '첫 방문이라 피할 목록 없음', !all.includes('Previously shown here'), '없음', /Previously[^\n]*/.exec(all)?.[0] ?? '');
    const st = J(await vars(), '$bm_shop');
    for (const x of st?.items ?? []) ids[x.name] = x.id;
    const v = await vars();
    check(s, '진열 3개 저장(포인트 가게), 공지 $bm_shop_note 저장, 받은 턴 표시', st?.items?.length === 3 && st.identity.points === true && v.$bm_shop_note === '이달의 복지 상품이 새로 등록되었습니다.' && !!v.$bm_shop_at, '3개·공지', { n: st?.items?.length, note: v.$bm_shop_note, at: v.$bm_shop_at });
    const txt = await screen();
    check(s, '화면: 공지가 배너에, 상품 3개, 9000p 는 「포인트 부족」(disabled)', txt.includes('이달의 복지 상품이 새로 등록되었습니다.') && (await page.evaluate((id) => { const b = document.querySelector(`.ms [data-action="mall-buy"][data-value="${id}"]`); return !!b && b.disabled && b.textContent.includes('포인트 부족'); }, ids['B등급 꿈결용액 앰플'])), '배너·부족', txt.slice(0, 300));
    await saveState(s);
  }
  {
    const s = step('구매_단추');
    await press(`.ms [data-action="mall-buy"][data-value="${ids['현장용 소형 응급 키트']}"]`, 800);
    const p = await pts();
    const ord = J(await vars(), '$bm_orders');
    const w = J(await vars(), '$st_wallet');
    check(s, '포인트 5,000 → 3,800, 원 가계부에는 거래 없음', p === 3800 && !(w?.log ?? []).some((e) => e.src === 'store'), 3800, { p, wallet: w?.log?.length }, '사용자 11-08 원화와 교환 X');
    check(s, '물건은 수령 대기(주문 1건), 소지품엔 없음', ord?.length === 1 && !ord[0].taken && !J(await vars(), '$st_items').list.length, '대기 1', ord?.map((o) => o.item.name), '사용자 11-16 받는 것은 회사에서');
    const txt = await screen();
    check(s, '화면: 구매 완료 안내·보유 3,800 P·키트가 진열에서 빠짐', txt.includes('구매가 완료') && txt.includes('3,800 P') && !(await page.evaluate(() => document.querySelector('.bp-grid')?.innerText ?? '')).includes('현장용 소형 응급 키트'), '3,800 P', txt.slice(0, 300));
    check(s, '9000p 는 여전히 눌리지 않음(포인트 부족)', await page.evaluate((id) => document.querySelector(`.ms [data-action="mall-buy"][data-value="${id}"]`)?.disabled === true, ids['B등급 꿈결용액 앰플']), 'disabled', '');
    await saveState(s);
  }
  {
    const s = step('주문조회_단추');
    await press('.bp-side [data-action="mall-page"][data-value="orders"]', 500);
    const txt = await screen();
    check(s, '주문 조회: 키트 수령 대기·받기 단추·본사 대여창고 안내, 메뉴에 (1)', txt.includes('수령 대기') && txt.includes('본사 대여창고') && txt.includes('주문 조회 (1)') && (await visible('.ms [data-action="mall-pickup"]')), '수령 대기', txt.slice(0, 300), '로어북 백일몽: 보안팀 대여창고(지침 Bm PICKUP_WAIT)');
    await press('.bp-side [data-action="mall-page"][data-value=""]', 300);
    await saveState(s);
  }
  let agentA = null;
  {
    const s = step('상담_연결_단추');
    await queue(DESK_MAKE());
    const n0 = await llmCount();
    await press('.bp-desk', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, DESK_MAKE());
    const all = allText(msgs); const usr = userText(msgs);
    check(s, '연결 요청: COMMON·MAKE·MANUAL·MAKE_OUTPUT', all.includes('1:1 상담 chat') && all.includes('Create the counselor') && all.includes('복지몰 상담 매뉴얼') && all.includes('<card>'), '네 절', '');
    check(s, '[손님] 사내 계정 토끼 · 남은 포인트 3,800p (구매 뒤 값)', /사내 계정: 토끼\n남은 포인트: 3,800p/.test(usr), '3,800p', /\[손님\]\n[^\n]*\n[^\n]*/.exec(usr)?.[0], '지침 BmDesk CUSTOMER');
    check(s, '[지금 진열된 상품] 에 안 팔린 둘(마스크·앰플)만, 산 키트는 없음', /\[지금 진열된 상품\]/.test(usr) && usr.includes('안대형 수면 마스크|800p') && usr.includes('B등급 꿈결용액 앰플|9000p') && !usr.includes('현장용 소형 응급 키트|'), '둘', /\[지금 진열된 상품\]\n[\s\S]*?\n\n/.exec(usr)?.[0]);
    check(s, '[이번 상담사 주사위] 7칸 + 최근 상담사 (없음)', /\[이번 상담사 주사위\]\n(?:[^\n]+\n){7}/.test(usr) && /\[최근 상담사 — 겹치지 말 것\]\n\(없음\)/.test(usr), '7칸·(없음)', /\[이번 상담사 주사위\][\s\S]*?\[현재 작업\]/.exec(usr)?.[0]);
    check(s, '상담 요청에 원 잔고(140000)가 없음 (포인트는 CUSTOMER 로만)', !MONEY_LEAK(all), '없음', statusLines(all), '사용자 11-22 「숨길 수 있으면 숨기고」(상점·몰·홈쇼핑), shop.ts:346 주석은 포인트만 일부러 넘긴다고 함');
    const sl = statusLines(usr);
    check(s, '[최근 본문] 의 포인트 숫자가 [손님] 남은 포인트와 어긋나지 않음', !sl.some((l) => /\|5000\]$/.test(l)), '3,800 만', sl, '같은 요청 안의 두 값이 다르면 상담사가 어느 쪽을 믿을지 정할 근거가 없음');
    const d = J(await vars(), '$bm_desk');
    agentA = d?.agent;
    const txt = await deskScreen();
    check(s, '상담원 카드 저장, 화면엔 「상담원 NNNN」만(실명·직급·부서 안 보임), 인사 말풍선', d?.agent?.name === '김하영' && /상담원 \d{4}/.test(txt) && !txt.includes('김하영') && !txt.includes('인사팀') && !txt.includes('주임') && txt.includes('포인트몰 상담입니다'), '번호만', txt.slice(0, 300), '사용자 11-09 실명·직급·부서 드러나면 안 됨');
    await saveState(s);
  }
  {
    const s = step('상담_말하기_단추');
    await queue(DESK_TALK);
    const n0 = await llmCount();
    await page.locator('.bd-in input[data-input="mall-say"]').fill('응급 키트에 뭐 들어 있어요?');
    await press('.bd-in [data-action="mall-say"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, DESK_TALK);
    const all = allText(msgs); const usr = userText(msgs);
    check(s, '대화 요청: TALK·END_ON·TALK_OUTPUT_END, 카드(호칭 포함)', all.includes('Stay the counselor') && all.includes('may end the chat on their own') && all.includes('<end/> after the <say> block'), '절', '', '설정 「상담 끊음」 기본 켬');
    check(s, '[이번 상담 대화] 끝줄이 방금 한 말, 시스템 줄(연결 안내)은 빠짐', /\[손님\] 응급 키트에 뭐 들어 있어요\?$/.test(usr.trim()) && !usr.includes('님이 상담에 연결되었습니다'), '끝줄', usr.slice(-200));
    const d = J(await vars(), '$bm_desk');
    check(s, '답 말풍선 2개로 나뉘어 저장', d.talk.filter((l) => l.who === 'op').length === 3, 'op 3줄(인사1+답2)', d.talk.map((l) => `${l.who}:${l.text}`));
    await saveState(s);
  }
  {
    const s = step('상담원이_끝냄_end');
    await queue(DESK_END);
    const n0 = await llmCount();
    await page.locator('.bd-in input[data-input="mall-say"]').fill('환불도 되나요?');
    await press('.bd-in [data-action="mall-say"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, DESK_END);
    const d = J(await vars(), '$bm_desk');
    const txt = await deskScreen();
    const dis = await page.evaluate(() => document.querySelector('.bd-in input')?.disabled === true);
    check(s, '<end/>: ended 저장, 「상담원이 상담을 종료했습니다.」 줄, 입력칸 잠김, <end/> 표식은 말풍선에 안 보임', d.ended === true && txt.includes('상담원이 상담을 종료했습니다.') && dis && !txt.includes('<end'), 'ended', { ended: d.ended, dis, txt: txt.slice(-200) }, '지침 BmDesk END_ON');
    await saveState(s);
  }
  {
    const s = step('창닫고_다시열기_새상담사');
    await press('.bd-wt [data-action="mall-ask-close"]', 300);
    check(s, '닫기(×) 누르면 창이 닫힘', !(await page.$('.bd-win')), '닫힘', '');
    await queue(DESK_MAKE('박도윤', '총무팀'));
    const n0 = await llmCount();
    await press('.bp-desk', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, DESK_MAKE('박도윤', '총무팀'));
    const usr = userText(msgs);
    check(s, '끝낸 뒤 다시 열면 새 상담사 연결 호출(MAKE) 1회, 최근 상담사에 김하영', (await llmCount()) - n0 === 1 && /\[최근 상담사 — 겹치지 말 것\]\n- 김하영 \(주임, 인사팀\)/.test(usr), 'MAKE·김하영', /\[최근 상담사[^\n]*\n[^\n]*/.exec(usr)?.[0], 'memory goei-guides-router-1122: <end/> 다시 열면 다른 상담사');
    const d = J(await vars(), '$bm_desk');
    const txt = await deskScreen();
    check(s, '새 상담원 번호가 앞 상담원과 다름, 대화는 새로', d.agent?.name === '박도윤' && d.agent.no !== agentA?.no && !d.ended && !txt.includes('환불도 되나요'), '새 번호', { a: agentA?.no, b: d.agent?.no });
    await queue(DESK_TALK_B);
    const n1 = await llmCount();
    await page.locator('.bd-in input[data-input="mall-say"]').fill('수령 시간이 궁금해요');
    await press('.bd-in [data-action="mall-say"]', 100);
    await waitLlm(n1);
    await press('.bd-wt [data-action="mall-ask-close"]', 300);
    await saveState(s);
  }
  {
    const s = step('다음턴_본편');
    await closeWin(page);
    const out = await mainRequest('오후 업무를 시작한다.', 'u2');
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '수령 대기 줄(PICKUP_WAIT)에 키트', /Bought at 백일몽 포인트몰, not collected yet[^:]*: 현장용 소형 응급 키트/.test(inv), 'PICKUP_WAIT', /Bought at 백일몽[^\n]*/.exec(inv)?.[0], '사용자 11-16');
    check(s, '「방금 삼」·받는 법(ARRIVE) 없음', !/just bought/.test(thisTurn(inv)) && !inv.includes('collects in person'), '없음', thisTurn(inv));
    const desk = /chatted by text with a counselor[^;\n]*/.exec(inv)?.[0] ?? '';
    check(s, '본편에 상담(MALL.DESK) 한 번', (inv.match(/chatted by text with a counselor/g) ?? []).length === 1, 1, desk);
    check(s, '이번 턴 두 상담이 다 넘어감(앞 상담사와 한 「환불도 되나요?」·뒤 상담사와 한 「수령 시간」)', desk.includes('환불도 되나요') && desk.includes('수령 시간이 궁금해요'), '둘 다', desk, 'shopctx.ts 머리 주석 「상점에서 한 일(…1:1 상담)은 다음 턴 메인 요청에」, 설정 「메인 요청에 붙이는 것 · 1:1 상담」');
    check(s, '본편 요청에 상담원 실명(김하영·박도윤)이 안 샘', !/김하영|박도윤|인사팀|총무팀/.test(allText(out)), '없음', '', '사용자 11-09');
    await botReply(B2, 'c2');
    const inv2 = inventoryOf(await peekMain('메일을 확인한다.'));
    check(s, '그다음 턴: 상담 사건은 다시 안 감, 수령 대기 줄은 계속', !inv2.includes('chatted by text with a counselor') && inv2.includes('not collected yet'), '대기만', thisTurn(inv2) + ' / ' + (/Bought at[^\n]*/.exec(inv2)?.[0] ?? ''));
    await saveState(s);
  }
  {
    const s = step('새로고침_주소창단추');
    await openBm();
    await act('mall-page', '');
    await queue(BM_SHELF2);
    const n0 = await llmCount();
    await press('.br-tool [data-action="br-reload"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, BM_SHELF2);
    const all = allText(msgs);
    const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
    check(s, 'RESTOCK·정체 고정(currency: points)', all.includes('Re-stock') && all.includes('[가게 정체 — 고정]') && all.includes('currency: points') && !all.includes('First page of this visit'), 'RESTOCK', '');
    check(s, '피할 목록에 산 키트 + 지금 걸린 마스크·앰플', ['현장용 소형 응급 키트', '안대형 수면 마스크', 'B등급 꿈결용액 앰플'].every((n) => avoid.includes(n)), '셋', avoid, '지침 Bm VARIETY, 1차 고침');
    check(s, '[이번 방문 대화] 칸 없음(포인트몰은 대화 없음)', !all.includes('[이번 방문 대화]'), '없음', '');
    check(s, '포인트·원 잔고 숫자 없음', !/\b3800\b|3,800/.test(all) && !MONEY_LEAK(all), '없음', statusLines(all));
    const v = await vars();
    check(s, '새 공지로 바뀜, 화면 배너도 새 공지', v.$bm_shop_note === '신규 상품이 입고되었습니다.' && (await screen()).includes('신규 상품이 입고되었습니다.'), '신규 상품', v.$bm_shop_note);
    await saveState(s);
  }
}

// ═════════════════════ part phone: 폰 390×844 ═════════════════════
if (PARTS.includes('phone')) {
  part = '폰_'; stepNo = 30;
  await bootChat(firstChat(LOGIN), 'phone');
  // 가짜 Risu 에서는 떠 있는 열기 단추(x-goei-fab)가 창과 같은 문서에 있어 폰 아래쪽 단추를 가린다 (실제 Risu 와 다를 수 있어 판정하지 않고 숨김)
  await page.addStyleTag({ content: '[x-goei-fab]{display:none!important}' });
  {
    const s = step('서랍_포인트몰');
    await closeWin(page); await openWin(page); await sleep(400);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    const drawer = await page.evaluate(() => [...document.querySelectorAll('.gx-cdr [data-action]')].map((e) => `${e.dataset.action}:${e.dataset.value ?? ''}`));
    note(s, '폰 서랍 단추', drawer);
    await act('nav-tab', 'net');
    if (!(await page.$('.ms-bm'))) await act('br-go', 'bm', 600);
    const txt = await screen();
    check(s, '폰: 포인트몰 화면, 보유 5,000 P, 상품 불러오기 단추 보임', txt.includes('5,000 P') && (await visible('.ms [data-action="mall-refresh"]')), '보임', txt.slice(0, 200));
    await saveState(s);
  }
  {
    const s = step('불러오기_구매_단추');
    await queue(BM_SHELF1);
    const n0 = await llmCount();
    await press('.ms [data-action="mall-refresh"]', 100);
    await waitLlm(n0);
    const kid = await idOf('안대형 수면 마스크');
    await press(`.ms [data-action="mall-buy"][data-value="${kid}"]`, 800);
    check(s, '폰: 단추로 사면 포인트 5,000 → 4,200, 수령 대기 1', (await pts()) === 4200 && J(await vars(), '$bm_orders')?.length === 1, 4200, await pts());
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(s, '폰: 가로 넘침 없음', !wide, '없음', wide);
    await saveState(s);
  }
  {
    const s = step('진열있을때_새로고침_단추');
    const vis = await page.evaluate(() => [...document.querySelectorAll('[data-action="br-reload"],[data-action="mall-refresh"]')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }).map((e) => e.dataset.action));
    check(s, '폰: 진열이 남아 있을 때 새로 받을 단추(주소창 새로고침 또는 상품 불러오기)가 보임', vis.length > 0, '하나 이상', vis, '지침 4절 「PC / 폰: 같은 동작이 두 배치에서 다 되나」; PC 는 주소창 새로고침(br-reload, class pc)');
    await page.screenshot({ path: `${OUT}폰_진열.png` });
    await saveState(s);
  }
  {
    const s = step('상담_단추');
    await queue(DESK_MAKE());
    const n0 = await llmCount();
    await press('.bp-desk', 100);
    await waitLlm(n0);
    await queue(DESK_TALK);
    const n1 = await llmCount();
    await page.locator('.bd-in input[data-input="mall-say"]').fill('수령은 어디서 해요?');
    await press('.bd-in [data-action="mall-say"]', 100);
    await waitLlm(n1);
    const d = J(await vars(), '$bm_desk');
    const box = await page.evaluate(() => { const r = document.querySelector('.bd-win')?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight } : null; });
    check(s, '폰: 상담 연결·말하기 동작(op 3줄), 상담 창이 화면 안', d?.talk?.filter((l) => l.who === 'op').length === 3 && box && box.l >= 0 && box.r <= box.w + 1 && box.t >= 0 && box.b <= box.h + 1, '동작·화면 안', { box, talk: d?.talk?.length });
    await page.screenshot({ path: `${OUT}폰_상담창.png` });
    await saveState(s);
  }
}

// ═════════════════════ part branch: 갈래 (상태만 바꿔 data-action) ═════════════════════
if (PARTS.includes('branch')) {
  part = '갈래_'; stepNo = 40;
  // B1 진열 응답 실패·꼴 틀림·빈 답 → 재시도 뒤 성공
  await bootChat(firstChat(LOGIN));
  {
    const s = step('진열_실패');
    await openBm();
    await queue({ type: 'fail', result: 'timeout' }, { type: 'fail', result: 'timeout' }, { type: 'fail', result: 'timeout' });
    const n0 = await llmCount();
    await act('mall-refresh', '', 3500);
    const v = await vars();
    const txt = await screen();
    note(s, '실패 때 호출 수(재시도 포함)', (await llmCount()) - n0);
    check(s, '실패: 상태 저장 안 됨, 안내가 보이고 「상품 불러오기」 단추가 다시 눌림', !v.$bm_shop && !v.$bm_shop_note && (await page.$('.bp-fail')) && (await page.evaluate(() => document.querySelector('.ms [data-action="mall-refresh"]')?.disabled === false)), '저장 없음·다시 누름', { shop: !!v.$bm_shop, txt: txt.slice(0, 300) });
    await saveState(s);
  }
  {
    const s = step('진열_꼴틀림_빈답_뒤성공');
    await queue('상품 없습니다.', '', BM_SHELF1);
    const n0 = await llmCount();
    await act('mall-refresh', '', 300);
    await waitLlm(n0, 3);
    const st = J(await vars(), '$bm_shop');
    note(s, '호출 수', (await llmCount()) - n0);
    check(s, '꼴 틀린 답·빈 답은 버리고 재시도 끝에 받은 진열만 저장(3개)', st?.items?.length === 3, 3, st?.items?.length);
    await saveState(s);
  }
  {
    const s = step('값0_진열');
    // 진열이 있는 상태에서 값 0 줄이 섞인 새 진열
    await queue(BM_SHELF_ZERO);
    const n0 = await llmCount();
    await act('mall-refresh', '', 300);
    await waitLlm(n0);
    const st = J(await vars(), '$bm_shop');
    const zero = st?.items?.find((x) => x.name === '무료 시음 쿠폰' && !x.sold);
    check(s, '값 0 줄은 진열에 안 올라가거나 살 수 없음 (정가 포인트 구매만)', !zero || zero.price > 0, '없음', zero);
    if (zero) {
      await act('mall-buy', zero.id, 700);
      check(s, '값 0 상품을 눌러도 수령 대기가 안 생김', !(J(await vars(), '$bm_orders') ?? []).length, 0, J(await vars(), '$bm_orders'));
    }
    await saveState(s);
  }
  // B2 상담 실패·빈 답·연타·늦은 답·새로고침
  {
    const s = step('상담연결_실패_다시');
    await queue('카드 없이 인사만 합니다', 'x', 'y');
    const n0 = await llmCount();
    await act('mall-ask', '', 300);
    await waitLlm(n0, 3);
    let d = J(await vars(), '$bm_desk');
    const txt = await deskScreen();
    check(s, '카드 없는 답: 상담원 저장 안 됨, 창에 실패 안내, 「다른 상담사 연결」 단추가 눌림', !d?.agent && txt.includes('<card>') && (await page.evaluate(() => [...document.querySelectorAll('.bd-tools button')].find((b) => b.dataset.action === 'mall-desk-next')?.disabled === false)), '안내·다시', { agent: d?.agent, txt: txt.slice(0, 300) });
    await queue(DESK_MAKE());
    const n1 = await llmCount();
    await act('mall-desk-next', '', 200);
    await waitLlm(n1);
    d = J(await vars(), '$bm_desk');
    check(s, '「다른 상담사 연결」로 다시 연결됨', d?.agent?.name === '김하영', '김하영', d?.agent?.name);
    await saveState(s);
  }
  {
    const s = step('상담말_실패_입력칸돌려줌');
    await queue('', '', '');
    const n0 = await llmCount();
    await act('mall-say', '포인트 유효기간이 있나요?', 300);
    await waitLlm(n0, 3);
    const d = J(await vars(), '$bm_desk');
    const inp = await page.evaluate(() => document.querySelector('.bd-in input')?.value ?? '');
    check(s, '빈 답: 내 말이 대화에서 빠지고 입력칸에 돌아옴', !d.talk.some((l) => l.text === '포인트 유효기간이 있나요?') && inp === '포인트 유효기간이 있나요?', '입력칸', { inp, talk: d.talk.map((l) => l.text) });
    await saveState(s);
  }
  {
    const s = step('상담말_연타');
    await hold();
    const n0 = await llmCount();
    await act('mall-say', '첫 질문', 50);
    await act('mall-say', '둘째 질문', 50);
    await act('mall-desk-next', '', 50);
    await act('mall-desk-end', '', 300);
    const n = (await llmCount()) - n0;
    await release(DESK_TALK_B);
    await sleep(1500);
    const d = J(await vars(), '$bm_desk');
    check(s, '답 기다리는 중 다시 보내기·다른 상담사·종료는 막힘 (호출 1회, 대화에 둘째 질문 없음, 상담원 그대로)', n === 1 && !d.talk.some((l) => l.text === '둘째 질문') && d.agent?.name === '김하영', '1회', { n, talk: d.talk.map((l) => `${l.who}:${l.text}`), agent: d.agent?.name });
    await saveState(s);
  }
  {
    const s = step('상담_답기다리는중_페이지새로고침');
    await hold();
    await act('mall-say', '대여창고 몇 시까지 해요?', 600);
    const before = J(await vars(), '$bm_desk');
    await reloadPage();
    await openBm();
    await act('mall-ask', '', 600);
    const d = J(await vars(), '$bm_desk');
    const last = d.talk.at(-1);
    const inp = await page.evaluate(() => document.querySelector('.bd-in input')?.value ?? '');
    note(s, '새로고침 전 저장된 끝줄', before.talk.at(-1));
    check(s, '답을 못 받은 내 말이 대화 끝에 홀로 남지 않음(실패 때처럼 빠지거나 입력칸에)', !(last?.who === 'me' && last.text === '대여창고 몇 시까지 해요?'), '빠짐', { last, inp }, '같은 함수의 실패 처리 malls.ts deskRun catch(내 말을 지우고 입력칸에), 지침 4절 페이지 새로고침');
    await closeWin(page);
    const inv = inventoryOf(await peekMain('자리로 돌아간다.'));
    note(s, '그 상태로 다음 본편 상담 줄', /chatted by text with a counselor[^;\n]*/.exec(inv)?.[0] ?? '');
    await saveState(s);
  }
  {
    const s = step('같은턴_창닫았다열기');
    await openBm();
    const a0 = J(await vars(), '$bm_desk').agent;
    await act('mall-ask-close', '', 200);
    const n0 = await llmCount();
    await act('mall-ask', '', 600);
    const a1 = J(await vars(), '$bm_desk').agent;
    note(s, '같은 턴에 창만 닫았다 열면 같은 상담사로 이어짐(호출 없음) — 코드 설계(deskOpen 주석), 사용자 결정은 <end/> 때만 「다른 상담사」', { calls: (await llmCount()) - n0, same: a0?.id === a1?.id });
    await saveState(s);
  }
  {
    const s = step('상담종료_단추뒤_본편');
    // 새 턴에 상담 → 말 한 번 → 「상담 종료」 → 다음 본편
    await botReply(B2, 'c2');
    await openBm();
    await queue(DESK_MAKE('이수진', '재무팀'));
    let n0 = await llmCount();
    await act('mall-ask', '', 200);
    await waitLlm(n0);
    const d0 = J(await vars(), '$bm_desk');
    check(s, '본편이 넘어간 뒤 열면 새 상담사(앞 상담은 지난 목록으로)', d0.agent?.name === '이수진' && d0.past.some((p) => p.name === '김하영'), '이수진', { agent: d0.agent?.name, past: d0.past.map((p) => p.name) }, 'deskOpen 주석 「본편이 넘어갔으면 끝내고 새로」');
    await queue(DESK_TALK_B);
    n0 = await llmCount();
    await act('mall-say', '수면 마스크 재고 더 들어와요?', 200);
    await waitLlm(n0);
    await act('mall-desk-end', '', 500);
    const d1 = J(await vars(), '$bm_desk');
    check(s, '「상담 종료」: 상담원이 지난 목록으로, 창 닫힘', !d1.agent && d1.past[0]?.name === '이수진', '종료', { agent: d1.agent, past: d1.past.map((p) => p.name) });
    await closeWin(page);
    const out = await mainRequest('업무를 이어 간다.', 'u3');
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '「상담 종료」를 누른 뒤에도 이번 턴 상담이 본편에 한 번 감', inv.includes('수면 마스크 재고 더 들어와요?'), '상담 줄', /chatted by text with a counselor[^;\n]*/.exec(inv)?.[0] ?? '(없음)', 'shopctx.ts 머리 주석·설정 「메인 요청에 붙이는 것 · 1:1 상담」(기본 켬). 종료 단추에 「본편에 안 넘김」 안내 없음');
    await saveState(s);
  }
  // B3 산 턴 다시 굴리기·지우기, 받은 턴 다시 굴리기, 수령
  await bootChat(firstChat(LOGIN));
  {
    const s = step('산턴_다시굴리기');
    await loadShelf();
    await act('mall-buy', await idOf('현장용 소형 응급 키트'), 700);
    check(s, '구매 직후 3,800', (await pts()) === 3800, 3800, await pts());
    await closeWin(page);
    // c1 을 다시 굴림: 리수는 c1 을 지우고 같은 유저 메시지로 다시 요청
    await page.evaluate(() => { window.__chat.message.pop(); });
    const out = await rerollRequest();
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '다시 굴린 요청: 수령 대기 줄이 없음(산 응답이 죽어 구매가 없던 일)', !inv.includes('not collected yet'), '없음', /Bought at[^\n]*/.exec(inv)?.[0] ?? '');
    await botReply(B1, 'c1b');
    await openBm();
    const txt = await screen();
    check(s, '다시 굴린 뒤: 보유 5,000 P, 키트가 진열에 되살아나 다시 살 수 있음, 주문 조회 비어 있음', txt.includes('5,000 P') && txt.includes('현장용 소형 응급 키트') && !(J(await vars(), '$bm_orders') ?? []).filter((o) => o.anchor === 'c1b').length, '5,000 P', txt.slice(0, 300), '지침 3-D 다시 굴리기 기대값(거래 되돌아감, 산 물건 진열대에 되살아남)');
    await act('mall-page', 'orders');
    const ot = await screen();
    check(s, '주문 조회에 죽은 주문이 안 보임', !ot.includes('현장용 소형 응급 키트'), '없음', ot.slice(0, 300));
    await act('mall-page', '');
    await act('mall-buy', await idOf('현장용 소형 응급 키트'), 700);
    check(s, '다시 살 수 있음 → 3,800', (await pts()) === 3800, 3800, await pts());
    await saveState(s);
  }
  {
    const s = step('받기즉시_받은턴_지우기');
    await closeWin(page);
    await mainRequest('오후 업무.', 'u2');
    await botReply(B2, 'c2');
    await openBm();
    await act('mall-page', 'orders');
    const o = J(await vars(), '$bm_orders').find((x) => !x.taken);
    await act('mall-pickup', o.id, 700);
    const k = J(await vars(), '$st_items').list.find((x) => x.name === '현장용 소형 응급 키트');
    check(s, '인물 기록 끔: 받기 → 바로 소지품(store bm, 기준 c2)', k?.store === 'bm' && k.anchor === 'c2', 'c2', k && { store: k.store, anchor: k.anchor }, 'items.ts bmPickupConfirm: 판단할 곳 없으면 바로');
    // c2 지우기 (응답 삭제)
    await closeWin(page);
    await page.evaluate(() => { window.__chat.message.pop(); });
    await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); }).catch(() => {});
    await sleep(400);
    const out = await rerollRequest();
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '받은 응답을 지우면 받은 것이 없던 일: 수령 대기 줄로 돌아옴, ARRIVE 없음, 소지품 목록에 키트 없음', inv.includes('not collected yet') && !inv.includes('collects in person') && !/^- 현장용 소형 응급 키트/m.test(inv), '대기', { wait: /Bought at[^\n]*/.exec(inv)?.[0], arrive: inv.includes('collects in person') });
    await botReply(B2, 'c2b');
    await saveState(s);
  }
  {
    const s = step('받으러감_성공_갱신기');
    await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '1'; });
    await openBm();
    await act('mall-page', '');
    await act('mall-buy', await idOf('안대형 수면 마스크'), 700);
    await act('mall-page', 'orders');
    const o2 = J(await vars(), '$bm_orders').find((x) => x.item.name === '안대형 수면 마스크');
    await act('mall-pickup', o2.id, 700);
    const o2b = J(await vars(), '$bm_orders').find((x) => x.item.name === '안대형 수면 마스크');
    check(s, '인물 기록 켬: 받기 → 「수령하러 감」(reqKey c2b), 소지품엔 아직 없음', o2b.reqKey === 'c2b' && !o2b.taken, 'reqKey', o2b);
    // 같은 턴에 「모두 받기」 를 또 누르면 같은 줄을 또 보내지 않음
    await act('mall-pickup-all', '', 600);
    const all2 = J(await vars(), '$bm_orders').filter((x) => x.reqKey === 'c2b').map((x) => x.item.name);
    note(s, '「모두 받기」 뒤 받으러 감 줄', all2);
    await closeWin(page);
    // 보조 호출은 내용으로 골라 답한다: 갱신기(JSON)에는 pickup 이름만, 나머지는 실패
    await page.evaluate(() => {
      const orig = window.risuai.runLLMModel;
      window.risuai.runLLMModel = async (o) => {
        window.__calls.llm = window.__calls.llm || []; window.__calls.llm.push(o);
        const txt = o.messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
        if (/pickup_check/.test(txt)) return { type: 'success', result: '{"people":[],"new_people":[],"pickup":["안대형 수면 마스크"]}' };
        return { type: 'fail', result: 'no mock' };
      };
      window.__origLLM = orig;
    });
    const n0 = await llmCount();
    const out = await mainRequest('대여창고로 내려간다.', 'u3');
    writeReq(s, out, undefined, '', '_본편');
    const inv = inventoryOf(out);
    check(s, '본편: 받으러 감(PICKUP_TRY) 한 번, 수령 대기 줄과 안 겹침', (inv.match(/sets out to collect in person[^;]*안대형 수면 마스크/g) ?? []).length === 1 && !/not collected yet[^\n]*안대형 수면 마스크/.test(inv), 'TRY 1', { try: /this turn the protagonist sets out[^;]*/.exec(inv)?.[0], wait: /Bought at[^\n]*/.exec(inv)?.[0] });
    await botReply(B4, 'c3', 4000);
    const n1 = await llmCount();
    let upd = null;
    for (let i = n0; i < n1; i++) { const m = await llmAt(i); if (/pickup_check/.test(allText(m))) upd = m; }
    if (upd) writeReq(s, upd, '{"people":[],"new_people":[],"pickup":["안대형 수면 마스크"]}', '■ 갱신기 요청\n', '_갱신기');
    check(s, '갱신기 요청에 pickup_check(마스크)와 PICKUP_KEY 가 들어감', !!upd && /pickup_check[\s\S]*안대형 수면 마스크/.test(allText(upd)) && allText(upd).includes('"pickup":["<name from pickup_check.items>"]'), '있음', upd ? /"pickup_check"[^\n]*/.exec(allText(upd))?.[0] : '(갱신기 호출 없음)');
    const o2c = J(await vars(), '$bm_orders').find((x) => x.item.name === '안대형 수면 마스크');
    const got = J(await vars(), '$st_items').list.find((x) => x.name === '안대형 수면 마스크');
    check(s, '갱신기가 받았다고 하면 받음(taken, 기준 c3)·소지품에 산 그대로', o2c?.taken === true && o2c.takenKey === 'c3' && got?.store === 'bm', '받음', { o: o2c, item: got && { store: got.store, from: got.from, anchor: got.anchor } });
    const inv2 = inventoryOf(await peekMain('자리로 돌아간다.'));
    check(s, '다음 턴: TRY·ARRIVE 다시 안 감, 대기 줄에 마스크 없음, 소지품 목록에 마스크', !inv2.includes('sets out to collect') && !inv2.includes('collects in person') && !/not collected yet[^\n]*마스크/.test(inv2) && /안대형 수면 마스크/.test(inv2), '목록만', thisTurn(inv2));
    await page.evaluate(() => { window.risuai.runLLMModel = window.__origLLM; window.__chat.scriptstate.$pp_on = '0'; });
    await saveState(s);
  }
}

// ═════════════════════ part branch2: 설정·소속·자동 호출 갈래 ═════════════════════
if (PARTS.includes('branch2')) {
  part = '설정_'; stepNo = 70;
  await bootChat(firstChat(LOGIN));
  {
    const s = step('상담끔');
    await page.evaluate(() => { window.__chat.scriptstate.$bm_desk_on = '0'; });
    await openBm();
    const n0 = await llmCount();
    const has = !!(await page.$('.bp-desk'));
    await act('mall-ask', '', 500);
    check(s, '1:1 상담 끄면 단추 없고, 눌러도(화면 밖) 호출 없음', !has && (await llmCount()) === n0 && !(await page.$('.bd-win')), '없음', { has, calls: (await llmCount()) - n0 });
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_desk_on; });
    await saveState(s);
  }
  {
    const s = step('상담끊음끔');
    await page.evaluate(() => { window.__chat.scriptstate.$bm_desk_end = '0'; });
    await openBm();
    await queue(DESK_MAKE());
    let n0 = await llmCount();
    await act('mall-ask', '', 200);
    await waitLlm(n0);
    await queue(DESK_END);
    n0 = await llmCount();
    await act('mall-say', '그만 할게요', 200);
    await waitLlm(n0);
    const msgs = await llmAt(n0);
    writeReq(s, msgs, DESK_END);
    const d = J(await vars(), '$bm_desk');
    check(s, '「상담 끊음」 끔: END_OFF 절, <end/> 이 와도 상담이 안 끝남', allText(msgs).includes('never ends the chat themselves') && !allText(msgs).includes('<end/> after the <say>') && !d.ended, 'END_OFF', { ended: d.ended });
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_desk_end; });
    await act('mall-desk-end', '', 300);
    await saveState(s);
  }
  {
    const s = step('맥락반영끔');
    await page.evaluate(() => { window.__chat.scriptstate.$bm_sh_ctx = '0'; });
    await queue(DESK_MAKE());
    const n0 = await llmCount();
    await act('mall-desk-next', '', 200);
    await waitLlm(n0);
    const msgs = await llmAt(n0);
    writeReq(s, msgs, DESK_MAKE());
    const usr = userText(msgs);
    check(s, '맥락 반영 끔: 상담 요청에 [최근 본문]·[상태창] 없음', !usr.includes('[최근 본문]') && !usr.includes('[상태창'), '없음', usr.slice(0, 400));
    await queue(BM_SHELF1);
    const n1 = await llmCount();
    await act('mall-refresh', '', 200);
    await waitLlm(n1);
    const m2 = await llmAt(n1);
    check(s, '맥락 반영 끔: 진열 요청에도 [최근 본문] 없음', !userText(m2).includes('[최근 본문]'), '없음', '');
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_sh_ctx; });
    await saveState(s);
  }
  {
    const s = step('진열_본편에넘김켬');
    await page.evaluate(() => { window.__chat.scriptstate.$bm_sh_main_shelf = '1'; });
    await closeWin(page);
    const out = await mainRequest('잠깐 쉰다.', 'u2');
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '「진열」 켬: 이 턴에 받은 진열(MALL.SHELF)과 몰 공지(MALL.NOTICE)가 한 번씩', (inv.match(/website now lists these/g) ?? []).length === 1 && (inv.match(/front page of the 백일몽 포인트몰 website reads/g) ?? []).length === 1, '한 번씩', thisTurn(inv));
    check(s, '본편으로 가는 공지가 첫 진열 공지 그대로', inv.includes('이달의 복지 상품이 새로 등록되었습니다.'), '공지', '');
    await botReply(B2, 'c2');
    const inv2 = inventoryOf(await peekMain('계속.'));
    check(s, '그다음 턴엔 진열·공지 안 감', !inv2.includes('website now lists') && !inv2.includes('front page of the'), '없음', thisTurn(inv2));
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_sh_main_shelf; });
    await saveState(s);
  }
  {
    const s = step('컨텍스트포함끔');
    await openBm();
    await act('mall-buy', await idOf('안대형 수면 마스크'), 700);
    await page.evaluate(() => { window.__chat.scriptstate.$bm_sh_main = '0'; });
    await closeWin(page);
    const inv = inventoryOf(await peekMain('계속.'));
    note(s, '포인트몰 「컨텍스트 포함」 끔: 수령 대기 줄', /Bought at[^\n]*/.exec(inv)?.[0] ?? '(없음)');
    check(s, '컨텍스트 포함 끔: 상담·진열 사건이 본편에 없음', !inv.includes('chatted by text with a counselor') && !inv.includes('website now lists'), '없음', thisTurn(inv));
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_sh_main; });
    await saveState(s);
  }
  {
    const s = step('자동_창을열때');
    await page.evaluate(() => { window.__chat.scriptstate.$bm_sh_auto = 'open'; });
    await botReply(B3, 'c3');
    await queue(BM_SHELF2);
    const n0 = await llmCount();
    await openBm();
    await sleep(1500);
    const n1 = (await llmCount()) - n0;
    await act('mall-ask-close', '', 100);
    await closeWin(page); await openWin(page); await sleep(800);
    const n2 = (await llmCount()) - n0;
    check(s, '「창을 열 때」: 새 턴에 열면 한 번, 같은 턴에 다시 열면 안 부름', n1 === 1 && n2 === 1, '1·1', { n1, n2 });
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_sh_auto; });
    await saveState(s);
  }
  {
    const s = step('자동_매턴_로그아웃');
    await page.evaluate(() => { window.__chat.scriptstate.$bm_sh_auto = 'turn'; window.__chat.scriptstate.$br_login = '0'; });
    await closeWin(page);
    let n0 = await llmCount();
    await mainRequest('계속.', 'u4');
    await botReply(B3.replace('06:10', '07:10'), 'c4', 1500);
    check(s, '「매 턴」이라도 로그아웃이면 진열 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0, 'malls.ts mallAutoTurn 주석');
    await page.evaluate(() => { window.__chat.scriptstate.$br_login = '1'; });
    await queue(BM_SHELF1);
    n0 = await llmCount();
    await mainRequest('계속.', 'u5');
    await botReply(B3.replace('06:10', '08:10'), 'c5', 2000);
    note(s, '로그인·매 턴: 응답 뒤 진열 호출 수(안 열어 본 진열이 있으면 안 받음, 사용자 11-15)', (await llmCount()) - n0);
    await page.evaluate(() => { delete window.__chat.scriptstate.$bm_sh_auto; });
    await saveState(s);
  }
  // 소속이 관리국으로 바뀜: 열려 있던 포인트몰 탭
  {
    const s = step('소속바뀜_열린탭');
    await openBm();
    await act('mall-page', '');
    await closeWin(page);
    await botReply(`인사 발령이 났다. 사원증을 반납했다.\n${BST('11:00 PM', 3000, '관리국/신입')}`, 'c9', 1200);
    const flag = (await vars())['$st_points_on'];
    check(s, '신분이 관리국이면 포인트 칸 꺼짐($st_points_on 0)', flag === '0', '0', flag);
    await reloadPage();
    await closeWin(page); await openWin(page); await sleep(400);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await act('nav-tab', 'net');
    const bms = await page.evaluate(() => [...document.querySelectorAll('.br-bms [data-action="br-go"]')].map((e) => e.dataset.value));
    const onBm = !!(await page.$('.ms-bm'));
    check(s, '즐겨찾기에 포인트몰 없음', !bms.includes('bm'), '없음', bms);
    const txt = onBm ? await screen() : '';
    const n0 = await llmCount();
    if (onBm) { await queue(BM_SHELF2); await act('br-reload', '', 300); await waitLlm(n0); }
    const n1 = (await llmCount()) - n0;
    let n2 = 0;
    if (onBm) { await queue(DESK_MAKE()); const m0 = await llmCount(); await act('mall-ask', '', 300); await waitLlm(m0); n2 = (await llmCount()) - m0; }
    check(s, '백일몽을 나온 뒤 열려 있던 포인트몰 탭에서 진열 새로고침·1:1 상담이 호출되지 않음', n1 === 0 && n2 === 0, '0·0', { tabStillBm: onBm, shelfCalls: n1, deskCalls: n2, screen: txt.slice(0, 200) }, '사용자 11-08 「포인트: 백일몽 소속일 때만」·「포인트몰(백일몽만)」, points.ts pointsMember 주석 「포인트몰(즐겨찾기·새 탭·서랍·구매·매 턴 진열)은 백일몽 소속일 때만」');
    if (onBm) {
      const id = await idOf('사원증 목걸이 줄') || await idOf('안대형 수면 마스크') || await idOf('B등급 꿈결용액 앰플');
      const p0 = await pts();
      if (id) await act('mall-buy', id, 700);
      const info = await screen();
      check(s, '소속 밖 구매는 막힘(포인트 그대로)', (await pts()) === p0, p0, await pts());
      note(s, '막힐 때 안내 글', /포인트가 부족하거나[^\n]*|구매가 완료[^\n]*/.exec(info)?.[0] ?? '');
    }
    await saveState(s);
  }
}

if (page) { await dumpCalls(part); allErrors.push(...errors); }
writeFileSync(`${OUT}호출목록-${PARTS.join('_')}.txt`, callLog.join('\n'));
writeFileSync(`${OUT}결과-${PARTS.join('_')}.json`, JSON.stringify({ results, notes, pageErrors: allErrors }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과${allErrors.length ? ` · 페이지 오류 ${allErrors.length}: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
