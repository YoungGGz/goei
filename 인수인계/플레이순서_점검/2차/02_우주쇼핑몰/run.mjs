// 플레이 순서 점검 2차 · 우주 쇼핑몰 (지침: ../../GPT_점검지침_초안.md, 1차 틀: ../../2_몰/run.mjs 를 복사해 갈래를 늘림)
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄운다.
// 대표 경로(part=main)는 화면 단추를 Playwright 로 직접 누른다(PC 1100×900). 갈래(part=branch)는 같은 틀에서 상태만 바꿔 data-action 으로 빠르게. part=phone 은 폰 390×844 에서 단추를 눌러 산다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 사용법: (fixture 가 있으면) node 인수인계/플레이순서_점검/2차/02_우주쇼핑몰/run.mjs [main|branch|phone]  (안 주면 셋 다, 브라우저는 하나만)
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main', 'branch', 'phone'];
if (PARTS.length === 3) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ── 장면 (로어북 「관리국」 신입, 숙소. 「우주 쇼핑몰」은 로어북에 가게 이름만) ──
const ST = (time, wallet, date = '2025.03.14', place = '관리국') => `[▣|${date}|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|${wallet}]`;
const C1 = `퇴근한 뒤 숙소 침대에 누워 휴대폰을 켰다. 즐겨찾기 맨 끝에 처음 보는 초록 UFO 그림이 깜빡였다.\n${ST('09:00 PM', 10000000)}`;
const C2 = `입금 버튼을 누르자마자 방 한가운데 공기가 찢어지듯 갈라지더니 작은 상자 두 개가 이불 위로 떨어졌다.\n${ST('10:05 PM', 2800000)}`;
const C3 = `새벽, 휴대폰이 짧게 울렸다. 「주문 완성. 받아라.」 한 줄짜리 알림이었다.\n${ST('03:30 AM', 2800000, '2025.03.15')}`;
const C4 = `방 안이 다시 조용해졌다. 손전등 불빛만 벽에 동그랗게 남았다.\n${ST('04:00 AM', 3100000, '2025.03.15')}`;

const COS_SHELF1 = `<shop-identity>
sells: 출처를 모르는 이상한 물건, 정보, 맞춤 제작
never: 환불, 반품, 흥정
prices: 계좌 이체 원화만 받는다, 모든 상품 비싸다
currency: won
</shop-identity>
<owner>
안녕하신가! 새로운 상품, 우리는 진열했다.
</owner>
<shelf>
반짝 걸음 구두약|1500000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에. 걸음 반짝인다.|걸음이 빛남, 당신의|특가:1800000|바른 신발로 걸으면 발소리가 사라지지만 한 시간 뒤 밑창이 녹는다
말 듣는 우산|2200000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다, 위에서만.|???||?
내일 신문 한 장|1200000|소모1|서류/신문/newspaper|0.05|읽는다. 내일이 쓰여 있다.|정확함 백 퍼센트|희귀|읽은 사람만 기사 내용을 곧 잊는다
</shelf>`;
const COS_TALK1 = `<owner>
구두약 진짜다. 써 있는 그대로. 더 알고 싶으면, 쪽지 있다.
</owner>
<change mode="none">
</change>
<info>관리국 앞 발소리|500000|관리국 건물 앞 골목에 밤마다 발소리만 지나간다. 우리는 안다 그 발소리 주인, 지난번 우리 손님이었다.</info>`;
const COS_TALK2 = `<owner>
만든다 우리는. 비싸다. 선불이다. 다섯 시간.
</owner>
<change mode="none">
</change>
<order>안 꺼지는 손전등|3000000|5|손·사용|도구/손전등/flashlight|0.31|켠다. 꺼지지 않는다.|영원한 빛, 당신 손에|켜면 끌 수 없고 빛이 닿은 그림자가 주인을 따라온다</order>`;
const COS_SHELF2 = `<owner>
새 상품 왔다. 우리는 골랐다.
</owner>
<shelf>
거꾸로 시계|1100000|사용|기기/시계/clock|0.2|돌린다 바늘을 뒤로.|시간 되돌림 (아마도)||?
조용한 초인종|1700000|사용|기기/초인종/doorbell|0.3|문에 단다. 누른다.|손님 부른다, 원하는 손님||누르면 그날 처음 떠올린 사람이 문 앞에 온다
</shelf>`;
const COS_TALK_READY = `<owner>
손전등 다 됐다. 받아라, 주문 조회에서.
</owner>
<change mode="none">
</change>`;
const COS_SELL1 = `<owner>
삼십만. 우리는 그 이상 아니다.
</owner>
<change mode="none">
</change>
<offer>300000</offer>`;
const COS_SHELF3 = `<owner>
또 왔다 새것.
</owner>
<shelf>
접히는 계단|2600000|사용|도구/계단/stairs|1.8|편다. 어디든 위로 간다.|높은 곳, 당신의 것||?
마른 거울|1300000|사용|기기/거울/mirror|0.4|본다. 어제가 보인다.|어제를 본다||어제의 자기 모습이 거울 밖으로 손을 내민다
</shelf>`;

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
const inventoryOf = (out) => out.find((m) => m.role === 'system' && /\[Inventory\]|\[Shop\]/.test(m.content))?.content ?? '';
const thisTurn = (inv) => /This turn:[^\n]*/.exec(inv)?.[0] ?? '';
const allText = (msgs) => msgs.map((m) => m.content).join('\n');

const b = await launch();
let page; let errors; let vp = 'pc';
const allErrors = [];
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
const bal = async () => { const w = J(await vars(), '$st_wallet'); return w ? w.start + w.log.reduce((n, e) => n + e.amount, 0) : null; };
const balAlive = async () => page.evaluate(() => { const c = window.__chat; const keys = new Set(c.message.map((m, i) => m.chatId ?? String(i))); const w = JSON.parse(c.scriptstate.$st_wallet || 'null'); return w ? w.start + w.log.filter((e) => !e.anchor || keys.has(e.anchor)).reduce((n, e) => n + e.amount, 0) : null; });
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const llmOpt = (i) => page.evaluate((i) => { const o = window.__calls.llm[i]; return { mode: o.mode, staticModel: o.staticModel }; }, i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (r && typeof r === 'object' ? r : { type: 'success', result: r })); }, t);
/** 답을 붙잡아 두는 가짜 (늦게 온 답·기다리는 중 갈래): release(text) 로 풀어 준다 */
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
/** 화면 단추를 실제로 누른다 (보이는 요소, 스크롤해서) */
const press = async (sel, wait = 500) => { await page.locator(sel).first().click({ timeout: 5000 }); await sleep(wait); };
const typeSay = async (text) => { await page.locator('.ms [data-input="mall-say"]').first().fill(text); await sleep(100); };
const waitLlm = async (n0, k = 1) => { await page.waitForFunction(([n0, k]) => (window.__calls.llm || []).length >= n0 + k, [n0, k], { timeout: 15000 }).catch(() => {}); await sleep(1100); };
/** 답 처리가 다 끝날 때까지: 보조 호출 수가 1.5초 동안 그대로이고 「입력하는 중·진열하는 중」이 없을 때 */
const waitIdle = async (max = 20000) => { const t0 = Date.now(); let n = -1; let since = Date.now(); while (Date.now() - t0 < max) { const k = await llmCount(); const busy = await page.evaluate(() => /입력하는 중|진열하는 중/.test(document.querySelector('.ms')?.innerText ?? '')); if (k !== n || busy) { n = k; since = Date.now(); } else if (Date.now() - since > 1500) return; await sleep(250); } };
const screen = () => page.evaluate(() => document.querySelector('.ms')?.innerText ?? '');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const KEEP = /^\$(st_(wallet|items|item_use)|cos_(shop|shop_note|shop_at|shop_seen|orders))$/;
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => KEEP.test(k)).map(([k, v]) => [k, J({ v }, 'v') ?? v])), messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2));
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
const rerollRequest = async () => page.evaluate(async () => {
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
});
const peekMain = async (userText) => { const c = await snap(); const out = await mainRequest(userText, 'peek'); await page.evaluate((c) => { window.__chat = c; }, c); return out; };
const botReply = async (text, cid) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(600); };
/** 리수 다시 굴리기 흉내: 마지막 응답을 지우고(유저 메시지가 끝) 새 chatId 로 다시 붙인다 */
const rerollLast = async (text, cid) => { await page.evaluate(() => { const m = window.__chat.message; if (m.at(-1)?.role === 'char') m.pop(); }); await botReply(text, cid); };
const openSite = async (site = 'cos') => {
  await closeWin(page); await sleep(200);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await act('nav-tab', 'net');
  if (!(await page.$(`.ms-${site}`))) await act('br-go', site, 600);
};
const callLog = [];
const dumpCalls = async (tag) => { const n = await llmCount(); for (let i = 0; i < n; i++) { const m = await llmAt(i); callLog.push(`${tag} #${i} ${String(m[0]?.content ?? '').slice(0, 60).replace(/\n/g, ' ')}`); } };
const BASE_VARS = { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $cos_fixed: '[]', $st_wallet: JSON.stringify({ start: 10000000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) };
const firstChat = (extra = {}) => ({ message: [{ role: 'user', data: '숙소에 돌아와 쉰다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }], scriptstate: { ...BASE_VARS, ...extra } });
const bootChat = async (chat0, v = 'pc', tag = part) => {
  if (page) { await dumpCalls(tag); allErrors.push(...errors); await page.close(); }
  vp = v;
  ({ page, errors } = await boot(b, fx, chat0, v, { store: STORE }));
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); });
  await sleep(400);
};
/** 진열을 받아 둔다 (갈래 준비용, data-action) */
const loadShelf = async (reply = COS_SHELF1) => { await openSite(); await queue(reply); const n0 = await llmCount(); await act('mall-refresh', ''); await waitLlm(n0); return J(await vars(), '$cos_shop'); };
const idOf = async (name) => J(await vars(), '$cos_shop')?.items?.find((x) => x.name === name && !x.sold)?.id;
const lastReq = async () => { const n = await llmCount(); return n ? llmAt(n - 1) : []; };
const MARK = /\[shop-ready|%%SCENE_CARD|%GNET_|\[▣[^\]]*\|\d{4,}\]/;

// ═════════════════════ part main: 대표 경로 (PC, 화면 단추) ═════════════════════
if (PARTS.includes('main')) {
  part = 'PC_';
  await bootChat(firstChat());
  const ids = {};
  {
    const s = step('열기_수동');
    const n0 = await llmCount();
    await openSite();
    await sleep(500);
    const txt = await screen();
    check(s, '자동 호출 기본 「수동」: 열어도 보조 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0, '사용자 11-22 우주몰 자동 호출 기본 수동 (MEMORY.md)');
    check(s, '빈 진열 안내 + 「상품 가져오기」 단추가 보임', txt.includes('아직 없다 상품') && (await page.locator('.ms [data-action="mall-refresh"]').isVisible()), '보임', txt.slice(0, 200));
    await saveState(s);
  }
  {
    const s = step('첫진열_단추');
    await queue(COS_SHELF1);
    const n0 = await llmCount();
    await press('.ms [data-action="mall-refresh"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COS_SHELF1);
    const all = allText(msgs);
    check(s, '보조 호출 1회, 보조 모델(submodel)', (await llmCount()) - n0 === 1 && (await llmOpt(n0)).mode === 'submodel', 'submodel 1회', { n: (await llmCount()) - n0, opt: await llmOpt(n0) }, '설정 기본 보조 모델 (core/shop.ts shopSettings model aux)');
    check(s, 'FIRST·SHELF_SECRET·TRUTH_MIX·진열 배정 ₩', all.includes('First visit') && all.includes('Two effect columns') && all.includes('MIX the two') && /Item 1 — GENRE: [^\n]*price ₩/.test(all), '절 모두', { first: all.includes('First visit'), secret: all.includes('Two effect columns'), mix: all.includes('MIX the two') });
    check(s, '잔고(10000000)를 요청에 안 넘김', !all.includes('10000000'), '없음', /[^\n]*10000000[^\n]*/.exec(all)?.[0] ?? '', '사용자 11-22 「숨길 수 있으면 숨기고」');
    check(s, '플러그인 표식이 요청에 안 샘', !MARK.test(all), '없음', MARK.exec(all)?.[0] ?? '');
    const st = J(await vars(), '$cos_shop');
    for (const x of st?.items ?? []) ids[x.name] = x.id;
    check(s, '진열 3개 저장, 진실 칸(글·?) 저장', st?.items?.length === 3 && st.items.find((x) => x.name === '말 듣는 우산')?.truth === '?', '3개', st?.items?.map((x) => `${x.name}:${x.truth}`));
    const txt = await screen();
    check(s, '화면: 광고 문구만, 진실은 안 보임, 공지 한마디', txt.includes('걸음이 빛남, 당신의') && !txt.includes('밑창이 녹는다') && txt.includes('우리는 진열했다'), '광고·공지', txt.slice(0, 300));
    await saveState(s);
  }
  {
    const s = step('질문하기_단추_쪽지제안');
    await press(`.ms .cs-it[data-item="${ids['반짝 걸음 구두약']}"] [data-action="mall-ask"]`);
    const chip = await page.evaluate(() => document.querySelector('.cs-askwin .q-card')?.innerText ?? '');
    check(s, '상품에서 「질문 하기」 → 그 상품이 붙음', chip.includes('반짝 걸음 구두약'), '붙인 상품 구두약', chip);
    await typeSay('이거 진짜 효과 있나요? 부작용은요?');
    await queue(COS_TALK1);
    const n0 = await llmCount();
    await press('.ms .cs-askwin [data-action="mall-say"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COS_TALK1);
    const all = allText(msgs);
    check(s, '마지막 줄 = [주인공] [붙인 상품] 한 말', /\[주인공\] \[반짝 걸음 구두약\] 이거 진짜 효과 있나요\? 부작용은요\?\s*$/.test(msgs.at(-1)?.content ?? ''), '마지막 줄', (msgs.at(-1)?.content ?? '').slice(-80));
    check(s, 'INFO·ORDER·SECRET_NOTE 절', all.includes('This mall also sells INFORMATION') && all.includes('CUSTOM ORDERS') && all.includes('The 운영자 knows it and never states it'), '세 절', { info: all.includes('sells INFORMATION'), order: all.includes('CUSTOM ORDERS') });
    check(s, '문의 요청: 지침 COMMON 「값은 고정·흥정 없음」과 출력 꼴이 같은 말', all.includes('Prices are fixed: the 운영자 never haggles') && all.includes('Prices are fixed, so never change one'), '둘 다', '');
    check(s, '잔고 안 넘김·표식 안 샘', !all.includes('10000000') && !MARK.test(all), '없음', MARK.exec(all)?.[0] ?? (/[^\n]*10000000[^\n]*/.exec(all)?.[0] ?? ''));
    const txt = await screen();
    check(s, '화면: 운영자 답 + 쪽지 카드(제목·값만)', txt.includes('구두약 진짜다') && txt.includes('관리국 앞 발소리') && !txt.includes('지난번 우리 손님'), '제목만', txt.slice(-300));
    await saveState(s);
  }
  {
    const s = step('쪽지구매_단추');
    await press('.ms [data-action="mall-note-buy"]', 700);
    check(s, '잔고 9,500,000', (await bal()) === 9500000, 9500000, await bal());
    const it = J(await vars(), '$st_items');
    check(s, '소지품에 쪽지(내용 text)', !!it.list.find((x) => x.name === '쪽지: 관리국 앞 발소리' && x.text?.includes('지난번')), '쪽지 줄', it.list.map((x) => x.name));
    const txt = await screen();
    check(s, '카드가 「구매 완료」로 바뀌고 내용은 여전히 안 보임', txt.includes('구매 완료') && !txt.includes('지난번 우리 손님'), '구매 완료', txt.slice(-200));
    await saveState(s);
  }
  {
    const s = step('맞춤주문_견적');
    await typeSay('절대 안 꺼지는 손전등 하나 만들어 줄 수 있나요?');
    await queue(COS_TALK2);
    const n0 = await llmCount();
    await press('.ms .cs-askwin [data-action="mall-say"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COS_TALK2);
    const all = allText(msgs);
    check(s, '이번 방문 쪽지가 (bought) 로, 앞 대화가 같이', all.includes('관리국 앞 발소리 (500000, bought)') && all.includes('[주인] 구두약 진짜다'), '둘 다', /\[이번 방문에 내민[^\n]*\n[^\n]*/.exec(all)?.[0]);
    const q = J(await vars(), '$cos_shop').quotes?.[0];
    check(s, '견적 저장 3,000,000 · 5시간', q?.price === 3000000 && q.hours === 5, { price: 3000000, hours: 5 }, q && { price: q.price, hours: q.hours });
    await saveState(s);
  }
  {
    const s = step('선납_단추_주문조회');
    await press('.ms [data-action="mall-quote-accept"]', 700);
    check(s, '잔고 6,500,000', (await bal()) === 6500000, 6500000, await bal());
    await press('.ms .cs-askwin .cs-wt [data-action="mall-ask-close"]', 300);
    await press('.ms nav [data-action="mall-page"][data-value="orders"]', 300);
    const txt = await screen();
    check(s, '주문 조회: 제작 중 · 납기 2025.03.15 02:00 AM (5시간 남음)', /제작 중 · 납기 2025\.03\.15 02:00 AM \(5시간 남음\)/.test(txt), '납기 줄', /[^\n]*제작 중[^\n]*/.exec(txt)?.[0]);
    await press('.ms nav [data-action="mall-page"][data-value=""]', 300);
    await saveState(s);
  }
  let snapAfterBuy;
  {
    const s = step('장바구니_입금_단추_연타');
    await press(`.ms .cs-it[data-item="${ids['반짝 걸음 구두약']}"] [data-action="mall-cart"]`, 200);
    await press(`.ms .cs-it[data-item="${ids['말 듣는 우산']}"] [data-action="mall-cart"]`, 200);
    await press('.ms nav [data-action="mall-page"][data-value="cart"]', 300);
    const cart = await screen();
    check(s, '장바구니 합계 ₩3,700,000 · 잔고 6,500,000원', cart.includes('₩3,700,000') && cart.includes('6,500,000'), '합계·잔고', /◈ 장바구니 ◈[\s\S]{0,200}/.exec(cart)?.[0]);
    await press('.ms [data-action="mall-order"]', 300);
    // 「입금 한다」를 연달아 두 번 (손이 미끄러진 연타)
    await page.evaluate(() => { const bt = document.querySelector('.ms .cs-paywin [data-action="mall-pay"]'); bt.click(); bt.click(); });
    await sleep(1200);
    check(s, '연타해도 한 번만 빠짐: 잔고 2,800,000', (await bal()) === 2800000, 2800000, await bal());
    const w = J(await vars(), '$st_wallet');
    check(s, '거래 건수: 쪽지 1 + 선납 1 + 구매 2 = 4건', w.log.length === 4, 4, w.log.map((e) => `${e.memo}:${e.amount}`));
    const it = J(await vars(), '$st_items');
    check(s, '소지품 구두약·우산 각 1줄', it.list.filter((x) => x.name === '반짝 걸음 구두약').length === 1 && it.list.filter((x) => x.name === '말 듣는 우산').length === 1, '각 1', it.list.map((x) => x.name));
    const txt = await screen();
    check(s, '화면: 입금 확인 안내(실패 문구로 덮이지 않음)', txt.includes('입금 확인!!') && !txt.includes('잔고 부족, 또는'), '입금 확인!!', /입금 확인[^\n]*|잔고 부족[^\n]*/.exec(txt)?.[0]);
    await saveState(s);
    snapAfterBuy = await snap();
  }
  let snapU2;
  {
    const s = step('다음턴_본편');
    await closeWin(page);
    const out = await mainRequest('상자를 열어 본다.', 'u2');
    snapU2 = await snap();
    writeReq(s, out);
    const inv = inventoryOf(out);
    const tt = thisTurn(inv);
    check(s, '구매 사건(구두약·우산·쪽지) · ARRIVE 1 · 문의 1 · 주문 1', /just bought[^;]*반짝 걸음 구두약/.test(tt) && (inv.match(/website purchase arrives this turn/g) ?? []).length === 1 && (inv.match(/chatted by text with the operator/g) ?? []).length === 1 && (inv.match(/placed a custom order/g) ?? []).length === 1, '각 1', tt);
    check(s, '숨긴 진실은 안 감', !inv.includes('밑창이 녹는다') && !inv.includes('그림자가 주인을'), '없음', '');
    check(s, '본편 요청에 플러그인 표식이 안 샘', !/\[shop-ready/.test(allText(out)), '없음', /\[shop-ready[^\]]*\]/.exec(allText(out))?.[0] ?? '');
    await saveState(s);
  }
  {
    const s = step('그다음턴_새로고침_주소창단추');
    await botReply(C2, 'c2');
    await openSite();
    await queue(COS_SHELF2);
    const n0 = await llmCount();
    await press('[data-action="br-reload"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COS_SHELF2);
    const all = allText(msgs);
    const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
    check(s, '피할 목록에 산 것 + 지금 걸린 신문', ['반짝 걸음 구두약', '말 듣는 우산', '내일 신문 한 장'].every((n) => avoid.includes(n)), '셋 다', avoid);
    check(s, 'RESTOCK·이번 방문 대화가 같이', all.includes('Re-stock') && all.includes('[이번 방문 대화]') && all.includes('[주인] 만든다 우리는'), '둘 다', all.includes('[이번 방문 대화]'));
    note(s, 'RESTOCK 의 [이번 방문 대화]가 지난 턴(c1) 대화까지 다 실림 — 몰은 방문이 따로 없음', /\[이번 방문 대화\]\n([\s\S]*?)\n\n/.exec(all)?.[1]?.split('\n').length);
    await saveState(s);
  }
  {
    const s = step('쓰는턴_진실');
    await closeWin(page);
    const it = J(await vars(), '$st_items');
    const a = it.list.find((x) => x.name === '반짝 걸음 구두약');
    await page.evaluate((x) => { window.__chat.scriptstate.$st_item_use = JSON.stringify([{ id: x, n: 1 }]); }, a.id);
    const out = await mainRequest('구두에 구두약을 바른다.', 'u3');
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '쓰는 턴에만 진실 Really 줄', /- 반짝 걸음 구두약: 바른 신발로 걸으면[^\n]*the label says/.test(inv), 'Really 줄', /- 반짝 걸음 구두약:[^\n]*/.exec(inv)?.[0]);
    check(s, '지난 턴 사건 되풀이 없음', !/just bought/.test(thisTurn(inv)) && !inv.includes('arrives this turn') && !inv.includes('chatted by text'), '없음', thisTurn(inv));
    await saveState(s);
  }
  {
    const s = step('납기지남_완성표식_문의요청');
    await botReply(C3, 'c3');
    const msg = await page.evaluate(() => window.__chat.message.at(-1).data);
    check(s, '완성 표식이 응답 끝에 붙음(화면 카드용)', msg.includes('[shop-ready: cos|안 꺼지는 손전등]'), '표식', msg.slice(-50));
    await openSite();
    await press('.ms nav [data-action="mall-ask"]', 300);
    await typeSay('손전등 다 됐어?');
    await queue(COS_TALK_READY);
    const n0 = await llmCount();
    await press('.ms .cs-askwin [data-action="mall-say"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COS_TALK_READY);
    const all = allText(msgs);
    check(s, '[진행 중 맞춤 주문] 칸에 「ready for pickup」', /\[진행 중 맞춤 주문[^\n]*\n안 꺼지는 손전등 \(3000000 won, ready for pickup\)/.test(all), 'ready for pickup', /\[진행 중 맞춤 주문[^\n]*\n[^\n]*/.exec(all)?.[0]);
    check(s, '운영자 요청 [최근 본문]에 완성 표식 [shop-ready…] 이 안 샘 (플러그인 내부 표식)', !all.includes('[shop-ready'), '없음', /[^\n]*\[shop-ready[^\n]*/.exec(all)?.[0] ?? '', 'core/orders.ts 주석 「모델에는 보내지 않는다 (core/sanitize.ts)」');
    await press('.ms .cs-askwin .cs-wt [data-action="mall-ask-close"]', 200);
    await saveState(s);
  }
  {
    const s = step('받기_팔기_단추');
    await press('.ms nav [data-action="mall-page"][data-value="orders"]', 300);
    await press('.ms [data-action="mall-custom-take"]', 800);
    const f = J(await vars(), '$st_items').list.find((x) => x.name === '안 꺼지는 손전등');
    check(s, '손전등 소지품(cos-order, 기준 c3), 잔고 그대로', f?.store === 'cos-order' && f.anchor === 'c3' && (await bal()) === 2800000, 'cos-order', f && { store: f.store, anchor: f.anchor });
    check(s, '완성 표식 지워짐', !(await page.evaluate(() => window.__chat.message.at(-1).data)).includes('[shop-ready'), '없음', '');
    await press('.ms nav [data-action="mall-page"][data-value=""]', 200);
    await press('.ms nav [data-action="mall-ask"]', 300);
    await press('.ms .cs-askwin [data-action="mall-sell-open"]', 300);
    const um = J(await vars(), '$st_items').list.find((x) => x.name === '말 듣는 우산');
    await press(`.ms .cs-askwin [data-action="mall-sell-pick"][data-value="${um.id}"]`, 500);
    await typeSay('이 우산 얼마에 사요?');
    await queue(COS_SELL1);
    const n0 = await llmCount();
    await press('.ms .cs-askwin [data-action="mall-say"]', 100);
    await waitLlm(n0);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COS_SELL1, '', '_팔기');
    const all = allText(msgs);
    check(s, '팔기 요청: SELL·산 값 2,200,000·진실(?)', all.includes('[팔려는 물건') && all.includes('bought earlier for 2200000 won'), 'SELL', /\[팔려는 물건[^\n]*\n[^\n]*\n?[^\n]*\n?[^\n]*/.exec(all)?.[0]);
    const txt = await screen();
    check(s, '화면: 우리의 값 ₩300,000 + 판매 단추', txt.includes('우리의 값') && txt.includes('₩300,000') && (await page.locator('.ms [data-action="mall-sell"]').isVisible()), '판매 단추', /파는 물건[\s\S]{0,80}/.exec(txt)?.[0]);
    await press('.ms .cs-askwin [data-action="mall-sell"]', 800);
    check(s, '판매: 잔고 3,100,000, 소지품 기록에 판매(c3) 1줄', (await bal()) === 3100000 && J(await vars(), '$st_items').log.filter((l) => l.what === 'sell' && l.name === '말 듣는 우산' && l.anchor === 'c3').length === 1, 3100000, await bal());
    await saveState(s);
  }
  {
    const s = step('본편_받은턴');
    await closeWin(page);
    const out = await mainRequest('손전등을 켜 본다.', 'u4');
    writeReq(s, out);
    const inv = inventoryOf(out);
    const tt = thisTurn(inv);
    check(s, 'ARRIVE_ORDER 1 · 판 사건 1 · 운영자 대화 1', (inv.match(/finished now, arrives this turn/g) ?? []).length === 1 && (tt.match(/just sold 말 듣는 우산 to 우주 쇼핑몰/g) ?? []).length === 1 && (inv.match(/chatted by text with the operator/g) ?? []).length === 1, '각 1', tt);
    check(s, '본편 요청에 [shop-ready] 표식 안 샘', !allText(out).includes('[shop-ready'), '없음', '');
    await saveState(s);
  }
  {
    const s = step('그다음턴_되풀이없음');
    await botReply(C4, 'c4');
    const out = await mainRequest('잠을 청한다.', 'u5');
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '받기·판매·대화 사건 다시 안 나옴, 목록엔 손전등', !inv.includes('arrives this turn') && !thisTurn(inv).includes('just sold') && !inv.includes('chatted by text') && /^- 안 꺼지는 손전등/m.test(inv), '없음', thisTurn(inv));
    await saveState(s);
  }

  // ── 같은 대표 경로에서 이어지는 갈래 (상태 되돌려 빠르게) ──
  part = 'PC갈래_';
  {
    const s = step('받은턴_다시굴리기');
    // 받은 턴(c3)의 응답 뒤 u4 → c4 가 붙어 있다. c4 를 지우고 u4 까지 남긴 채 c3 를 다시 굴리려면 u4·c4 를 지운다: 채팅 = …u3, c3(받기 기준)
    await page.evaluate(() => { const m = window.__chat.message; while (m.length && m.at(-1).chatId !== 'c3') m.pop(); m.pop(); });
    await botReply(C3.replace('알림이었다.', '알림이었다. (다시)'), 'c3b');
    await openSite();
    await act('mall-page', 'orders');
    const txt = await screen();
    const f = J(await vars(), '$st_items');
    const liveF = await page.evaluate(() => { const c = window.__chat; const keys = new Set(c.message.map((m, i) => m.chatId ?? String(i))); const it = JSON.parse(c.scriptstate.$st_items); return it.list.filter((x) => x.name === '안 꺼지는 손전등' && keys.has(x.anchor)).length; });
    check(s, '받은 응답(c3)을 다시 굴리면 손전등이 소지품에서 죽고 주문은 다시 「완성」', liveF === 0 && txt.includes('★완성★'), '완성 카드', { liveF, txt: /◈ 주문 조회 ◈[\s\S]{0,160}/.exec(txt)?.[0] });
    const msg = await page.evaluate(() => window.__chat.message.at(-1).data);
    check(s, '새 응답(c3b)에 완성 표식이 다시 붙음', msg.includes('[shop-ready: cos|안 꺼지는 손전등]'), '표식', msg.slice(-60));
    check(s, '판매(c3 기준)도 되돌아감: 잔고 2,800,000', (await balAlive()) === 2800000, 2800000, await balAlive());
    void f;
    await act('mall-page', '');
    await saveState(s);
  }
  {
    const s = step('산턴_응답지우기');
    // 산 뒤 보낸 턴의 응답(c2)을 다시 굴리는 대신 지운다(Risu 메시지 삭제): 채팅 = u1,c1,u2 → 다음 요청 = u2 다시
    await page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(snapU2)));
    const out = await rerollRequest();
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, 'c2 를 지우고 다시 보낸 요청에도 구매·ARRIVE·대화·주문 한 번씩', (thisTurn(inv).match(/반짝 걸음 구두약 \(paid/g) ?? []).length === 1 && (inv.match(/website purchase arrives/g) ?? []).length === 1 && (inv.match(/chatted by text/g) ?? []).length === 1 && (inv.match(/placed a custom order/g) ?? []).length === 1, '각 1', thisTurn(inv));
    await saveState(s);
  }
  {
    const s = step('산턴_c1다시굴리기_다시사기');
    await page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(snapAfterBuy)));
    await rerollLast(C1, 'c1b');
    await openSite();
    const ub = J(await vars(), '$cos_shop').items.find((x) => x.name === '반짝 걸음 구두약')?.id;
    const shown = await page.evaluate((id) => !!document.querySelector(`.ms .cs-it[data-item="${id}"]`), ub);
    check(s, '산 응답을 다시 굴리면 진열(화면)에 구두약이 다시 걸림', shown, '있음', shown);
    await act('mall-cart', ub);
    await act('mall-order');
    await act('mall-pay', undefined, 800);
    check(s, '다시 살 수 있고 돈은 한 번만: 잔고 8,500,000', (await balAlive()) === 8500000, 8500000, await balAlive());
    const it = J(await vars(), '$st_items');
    const live = it.list.filter((x) => x.name === '반짝 걸음 구두약' && x.anchor === 'c1b').length;
    check(s, '살아 있는 구두약 1줄', live === 1, 1, it.list.filter((x) => x.name === '반짝 걸음 구두약').map((x) => x.anchor));
    await saveState(s);
  }
}

// ═════════════════════ part branch: 갈래 (data-action, 상태만 바꿈) ═════════════════════
if (PARTS.includes('branch')) {
  part = '갈래_';
  // B1 문의 실패: 빈 답 → 되돌림 / 꼴 틀린 답 뒤 재시도 성공
  await bootChat(firstChat());
  await loadShelf();
  {
    const s = step('문의_빈답');
    const clock = await idOf('말 듣는 우산');
    await act('mall-ask', clock);
    await queue('', '', '', '');
    const n0 = await llmCount();
    await act('mall-say', '우산 몇 번 써?', 100);
    await waitIdle();
    const st = J(await vars(), '$cos_shop');
    const inp = await page.evaluate(() => document.querySelector('[data-input="mall-say"]')?.value ?? '');
    const chip = await page.evaluate(() => document.querySelector('.cs-askwin .q-card:not(.q-sell)')?.innerText ?? '');
    check(s, '빈 답: 내 말 되돌림·입력칸·붙인 상품 돌아옴', st.talk.length === 0 && inp.includes('우산 몇 번') && chip.includes('말 듣는 우산'), '되돌림', { talk: st.talk.length, inp, chip });
    note(s, '빈 답일 때 보조 호출 수(재시도 포함)', (await llmCount()) - n0);
    await saveState(s);
  }
  {
    const s = step('문의_꼴틀림_재시도성공');
    await queue('그냥 아무 말', COS_TALK1);
    const n0 = await llmCount();
    await act('mall-say', '우산 몇 번 써?', 100);
    await waitIdle();
    const st = J(await vars(), '$cos_shop');
    check(s, '재시도 뒤 성공: 호출 2회, 대화 2줄(내 말 1·운영자 1)', (await llmCount()) - n0 === 2 && st.talk.length === 2 && st.talk.filter((l) => l.who === 'me').length === 1, '2회·2줄', { calls: (await llmCount()) - n0, talk: st.talk });
    const second = await lastReq();
    writeReq(s, second, COS_TALK1, '■ 다시 묻기 요청\n');
    note(s, '다시 묻기 요청 끝 말', String(second.at(-1)?.content ?? '').slice(0, 200));
    await saveState(s);
  }
  {
    const s = step('진열_꼴틀림_상태그대로');
    const before = J(await vars(), '$cos_shop');
    const at0 = (await vars())['$cos_shop_at'];
    await act('mall-ask-close');
    await act('mall-cart', before.items.find((x) => x.name === '내일 신문 한 장').id);
    await queue('<owner>새것</owner>', '<owner>새것</owner>', '<owner>새것</owner>');
    const n0 = await llmCount();
    await act('mall-refresh', '');
    await waitIdle();
    const after = J(await vars(), '$cos_shop');
    const fail = await page.evaluate(() => document.querySelector('.cs-fail')?.innerText ?? '');
    check(s, '진열 실패: 안내가 보이고 진열·진열 턴·장바구니 그대로', !!fail && JSON.stringify(after.items) === JSON.stringify(before.items) && (await vars())['$cos_shop_at'] === at0 && (await page.evaluate(() => document.querySelector('.ms nav')?.innerText ?? '')).includes('장바구니 (1)'), '그대로', { fail: fail.slice(0, 80), same: JSON.stringify(after.items) === JSON.stringify(before.items) });
    await act('mall-cart', before.items.find((x) => x.name === '내일 신문 한 장').id);
    await saveState(s);
  }
  {
    const s = step('문의_값바꿈줄_받나');
    // 지침 COMMON 「Prices are fixed: never lowers a price」·TALK_OUTPUT 「Prices are fixed, so never change one」. 모델이 어기고 「~ 이름|값」을 내면?
    await act('mall-ask', '');
    const reply = `<owner>\n좋다. 너에게만. 십만.\n</owner>\n<change mode="partial">\n~ 말 듣는 우산|100000\n</change>`;
    await queue(reply);
    const n0 = await llmCount();
    await act('mall-say', '우산 너무 비싸요 깎아 주세요', 100);
    await waitLlm(n0);
    writeReq(s, await lastReq(), reply);
    const u = J(await vars(), '$cos_shop').items.find((x) => x.name === '말 듣는 우산');
    check(s, '값을 바꾸는 줄은 받지 않음: 우산 2,200,000 그대로', u?.price === 2200000, 2200000, u && { price: u.price, orig: u.orig });
    await act('mall-ask-close');
    await act('mall-cart', u.id);
    await act('mall-order');
    await act('mall-pay', undefined, 800);
    note(s, '그 값으로 산 뒤 잔고(시작 10,000,000)', await bal());
    await saveState(s);
  }
  {
    const s = step('진열_현물값_공짜');
    // 우주몰 COMMON 「Buying is a bank transfer in Korean won」「Prices are Korean won as plain integers」「cheapest about a million won」. 같은 요청의 SHELF 절은 「돈이 아니면 그 가게의 대가 글」을 허락
    const reply = `<owner>\n새것.\n</owner>\n<shelf>\n기억 저금통|기억 한 조각|사용|잡동사니/저금통/piggy bank|0.6|넣는다 기억을.|기억 늘어남||넣은 기억은 돌아오지 않는다\n종이 나침반|1900000|사용|도구/나침반/compass|0.05|접는다. 가리킨다.|길 안다||?\n</shelf>`;
    const w0 = await bal();
    await queue(reply);
    const n0 = await llmCount();
    await act('mall-refresh', '');
    await waitLlm(n0);
    const all = allText(await lastReq());
    writeReq(s, await lastReq(), reply);
    check(s, '진열 요청 안에서 값 칸 규칙이 한 가지(원 정수)', !(all.includes('Prices are Korean won as plain integers') && all.includes('if this shop is not paid in money')), '한 가지', { won: all.includes('Prices are Korean won as plain integers'), other: all.includes('if this shop is not paid in money') }, '지침/우주쇼핑몰.txt COMMON vs SHELF');
    const it = J(await vars(), '$cos_shop').items.find((x) => x.name === '기억 저금통' && !x.sold);
    note(s, '현물 값 줄 저장 꼴', it && { price: it.price, pay: it.pay });
    if (it) {
      await act('mall-cart', it.id);
      await act('mall-page', 'cart');
      note(s, '장바구니 화면', /◈ 장바구니 ◈[\s\S]{0,200}/.exec(await screen())?.[0]);
      await act('mall-order');
      await act('mall-pay', undefined, 800);
    }
    const got = J(await vars(), '$st_items').list.find((x) => x.name === '기억 저금통');
    check(s, '원이 아닌 값(현물) 상품이 0원 「송금」으로 소지품에 들어오지 않음', !it || !got || (await bal()) < w0, '진열에서 버리거나 살 수 없음', { saved: it && { price: it.price, pay: it.pay }, got: got && { price: got.price, mallPaid: got.mallPaid }, wallet: [w0, await bal()] }, '포인트몰은 같은 경우를 진열에서 버림(core/shop.ts pointShelf, 1차 Codex 05 고침)');
    if (got) {
      await closeWin(page);
      const out = await peekMain('저금통을 본다.');
      writeReq(s, out, undefined, '', '_본편');
      note(s, '본편 구매 줄', /just bought[^;\n]*기억 저금통[^;\n]*/.exec(inventoryOf(out))?.[0]);
    }
    await saveState(s);
  }

  // B2 문의 끊음 (켬 기본) / 끔
  await bootChat(firstChat());
  await loadShelf();
  {
    const s = step('끊음_켬');
    await act('mall-ask', '');
    await act('mall-sell-open');
    const reply = `<owner>\n지루하다 너. 우리는 끝낸다 질문.\n</owner>\n<change mode="none">\n</change>\n<closed/>`;
    await queue(reply);
    const n0 = await llmCount();
    await act('mall-say', '아 몰라 아무거나 다 공짜로 줘', 100);
    await waitLlm(n0);
    const req = allText(await lastReq());
    writeReq(s, await lastReq(), reply);
    check(s, '요청에 KICK_ON 절과 <closed/> 꼴', req.includes('it may end the enquiry') && req.includes('<closed/> only if'), '있음', '');
    const st = J(await vars(), '$cos_shop');
    const dis = await page.evaluate(() => ({ input: document.querySelector('.cs-askwin [data-input="mall-say"]')?.disabled, pick: document.querySelector('.cs-askwin [data-action="mall-pick"]')?.disabled }));
    check(s, 'closed 저장, 입력칸·상품 붙이기 꺼짐, 안내 줄', st.closed === true && dis.input && dis.pick && (await screen()).includes('운영자가 문의를 끊었어요'), 'closed', { closed: st.closed, dis });
    await act('mall-ask-close');
    const ub = await idOf('말 듣는 우산');
    await act('mall-cart', ub); await act('mall-order'); await act('mall-pay', undefined, 800);
    check(s, '끊겨도 정가 구매는 됨(KICK_ON 「the page goes on selling」)', (await bal()) === 7800000, 7800000, await bal());
    await closeWin(page);
    const out = await mainRequest('휴대폰을 내려놓는다.', 'u2');
    writeReq(s, out, undefined, '', '_본편');
    const inv = inventoryOf(out);
    check(s, '다음 본편: 끊은 대화가 한 번 넘어감', (inv.match(/chatted by text with the operator/g) ?? []).length === 1 && inv.includes('우리는 끝낸다'), '1', /chatted by text[^;]*/.exec(inv)?.[0]);
    await botReply(C2, 'c2');
    await openSite();
    await act('mall-ask', '');
    const stillShut = J(await vars(), '$cos_shop').closed;
    check(s, '다음 턴에도 문의는 끊긴 채(진열을 새로 받기 전까지)', stillShut === true, true, stillShut, 'core/malls.ts mallSettings 주석 「진열을 새로 받으면 풀린다」');
    await act('mall-ask-close');
    await queue(COS_SHELF2);
    const n1 = await llmCount();
    await act('mall-refresh', '');
    await waitLlm(n1);
    check(s, '진열을 새로 받으면 문의가 다시 열림', J(await vars(), '$cos_shop').closed === false, false, J(await vars(), '$cos_shop').closed);
    await saveState(s);
  }
  {
    const s = step('끊음_끔');
    await page.evaluate(() => { window.__chat.scriptstate.$cos_sh_kick = '0'; });
    await openSite();
    await act('mall-ask', '');
    const reply = `<owner>\n지루하다. 끝.\n</owner>\n<change mode="none">\n</change>\n<closed/>`;
    await queue(reply);
    const n0 = await llmCount();
    await act('mall-say', '아무거나', 100);
    await waitLlm(n0);
    const req = allText(await lastReq());
    writeReq(s, await lastReq(), reply);
    check(s, '끄면 KICK_OFF 절, <closed/> 꼴 없음, 답의 <closed/> 은 무시', req.includes('never ends the enquiry') && !req.includes('<closed/> only if') && J(await vars(), '$cos_shop').closed === false, 'KICK_OFF', { off: req.includes('never ends the enquiry'), closed: J(await vars(), '$cos_shop').closed });
    await act('mall-ask-close');
    await saveState(s);
  }

  // B3 팔기: 안 삼 / 말로 수락(<deal/>) / 판 턴 다시 굴리기
  await bootChat(firstChat());
  await loadShelf();
  {
    const s = step('팔기_안삼_말로수락');
    const ub = await idOf('말 듣는 우산');
    await act('mall-cart', ub); await act('mall-order'); await act('mall-pay', undefined, 800);
    await act('mall-ask', '');
    await act('mall-sell-open');
    const um = J(await vars(), '$st_items').list.find((x) => x.name === '말 듣는 우산');
    await act('mall-sell-pick', um.id, 500);
    const none = `<owner>\n우리는 우산 필요 없다.\n</owner>\n<change mode="none">\n</change>\n<offer>none</offer>`;
    await queue(none);
    let n0 = await llmCount();
    await act('mall-say', '이 우산 사 갈래?', 100);
    await waitLlm(n0);
    const t1 = await screen();
    check(s, '안 산다(<offer>none</offer>): 「우리는 사지 않는다」, 판매 단추 없음', t1.includes('우리는 사지 않는다') && !(await page.$('.ms [data-action="mall-sell"]')), '안 삼', /파는 물건[\s\S]{0,60}/.exec(t1)?.[0]);
    await act('mall-sell-cancel');
    await act('mall-sell-open');
    await act('mall-sell-pick', um.id, 500);
    await queue(COS_SELL1);
    n0 = await llmCount();
    await act('mall-say', '얼마?', 100);
    await waitLlm(n0);
    const deal = `<owner>\n거래다. 우리는 가져간다. 입금했다.\n</owner>\n<change mode="none">\n</change>\n<offer>300000</offer>\n<deal/>`;
    await queue(deal);
    n0 = await llmCount();
    await act('mall-say', '좋아요 그 값에 팔게요', 100);
    await waitLlm(n0);
    const req = allText(await lastReq());
    writeReq(s, await lastReq(), deal);
    check(s, '요청에 (your last offer: 300000 won)·<deal/> 꼴', req.includes('(your last offer: 300000 won)') && req.includes('<deal/>'), '있음', '');
    const sold = (await bal()) === 7800000 + 300000;
    check(s, '말로 수락(<deal/>) → 판매 처리: 잔고 8,100,000, 우산 빠짐', sold && !J(await vars(), '$cos_shop').sell, 8100000, { w: await bal(), sell: J(await vars(), '$cos_shop').sell });
    await act('mall-ask-close');
    await closeWin(page);
    const out = await mainRequest('우산 없이 나간다.', 'u2');
    writeReq(s, out, undefined, '', '_본편');
    const tt = thisTurn(inventoryOf(out));
    check(s, '본편: 산 사건과 판 사건 각 1', (tt.match(/just sold 말 듣는 우산/g) ?? []).length === 1 && (tt.match(/just bought[^;]*말 듣는 우산/g) ?? []).length === 1, '각 1', tt);
    await botReply(C2, 'c2');
    // c1(산·판 기준) 다시 굴리기
    await page.evaluate(() => { const m = window.__chat.message; m.splice(2); });
    await rerollLast(C1, 'c1b');
    await openSite();
    check(s, 'c1 을 다시 굴리면 판매·구매 모두 없던 일: 잔고 10,000,000', (await balAlive()) === 10000000, 10000000, await balAlive());
    const sales = await page.evaluate(() => { const c = window.__chat; const keys = new Set(c.message.map((m, i) => m.chatId ?? String(i))); const st = JSON.parse(c.scriptstate.$cos_shop); return (st.sales ?? []).filter((x) => !x.k || keys.has(x.k)).length; });
    check(s, '판 것 목록(sales)도 빠짐(살아 있는 줄 0)', sales === 0, 0, sales);
    const uid = J(await vars(), '$cos_shop').items.find((x) => x.name === '말 듣는 우산')?.id;
    check(s, '우산이 다시 진열(화면)에 걸림', await page.evaluate((id) => !!document.querySelector(`.ms .cs-it[data-item="${id}"]`), uid), '있음', '');
    await saveState(s);
  }

  // B4 기다리는 동안: 창 닫았다 열기 / 페이지 새로고침 / 늦게 온 답(다음 턴이 먼저)
  await bootChat(firstChat());
  await loadShelf();
  {
    const s = step('기다리는중_창닫기');
    await act('mall-ask', '');
    await hold();
    const n0 = await llmCount();
    await act('mall-say', '구두약 몇 번 발라?', 100);
    await page.waitForFunction((n0) => (window.__calls.llm || []).length > n0, n0);
    await closeWin(page);
    await release(COS_TALK1);
    await sleep(1200);
    await openSite();
    const st = J(await vars(), '$cos_shop');
    check(s, '창을 닫아도 답이 저장됨(대화 2줄, 쪽지 1)', st.talk.length === 2 && (st.notes ?? []).length === 1, '2줄', st.talk);
    await saveState(s);
  }
  {
    const s = step('기다리는중_페이지새로고침');
    await act('mall-ask', '');
    await hold();
    const n0 = await llmCount();
    await act('mall-say', '우산은 어때?', 100);
    await page.waitForFunction((n0) => (window.__calls.llm || []).length > n0, n0);
    await sleep(300);
    // 페이지 새로고침 = 저장된 채팅만 남고 기다리던 답은 사라짐
    const saved = await snap();
    await bootChat(saved);
    await openSite();
    await act('mall-ask', '');
    const st = J(await vars(), '$cos_shop');
    const txt = await screen();
    note(s, '새로고침 뒤 대화 줄', st.talk.map((l) => `${l.who}:${l.text}`));
    check(s, '답을 못 받은 내 말이 대화에 홀로 남지 않음(실패 때처럼 되돌리거나 다시 보낼 수 있게)', !(st.talk.at(-1)?.who === 'me' && st.talk.at(-1)?.text.includes('우산은 어때')), '홀로 남지 않음', st.talk.at(-1), '같은 함수의 실패 처리(src/ui/malls.ts:229-243)는 답이 안 온 내 말을 지움');
    check(s, '화면에 「입력하는 중」이 남지 않음', !txt.includes('운영자가 입력하는 중'), '없음', txt.includes('입력하는 중'));
    await act('mall-ask-close');
    await closeWin(page);
    const out = await peekMain('휴대폰을 본다.');
    writeReq(s, out, undefined, '', '_본편');
    note(s, '다음 본편의 운영자 대화 줄', /chatted by text[^;\n]*/.exec(inventoryOf(out))?.[0]);
    await saveState(s);
  }
  {
    const s = step('늦게온답_다음턴먼저');
    await openSite();
    await act('mall-ask', '');
    await hold();
    const n0 = await llmCount();
    await act('mall-say', '신문 내용 미리 알려 줄 수 있어?', 100);
    await page.waitForFunction((n0) => (window.__calls.llm || []).length > n0, n0);
    // 답이 오기 전에 본편이 한 턴 진행
    await closeWin(page);
    const out1 = await mainRequest('잠깐 씻고 온다.', 'u2');
    writeReq(s, out1, undefined, '■ 답 오기 전 본편 요청\n', '_본편1');
    note(s, '답 오기 전 본편의 운영자 대화 줄', /chatted by text[^;\n]*/.exec(inventoryOf(out1))?.[0]);
    await botReply(C2.replace('2800000', '10000000'), 'c2');
    await release(`<owner>\n못 알려 준다. 쪽지 산다면 모를까.\n</owner>\n<change mode="none">\n</change>`);
    await sleep(1500);
    const st = J(await vars(), '$cos_shop');
    note(s, '늦게 온 답의 줄 기준(k)', st.talk.map((l) => `${l.who}:${l.k}:${l.text.slice(0, 12)}`));
    const out2 = await mainRequest('다시 휴대폰을 본다.', 'u3');
    writeReq(s, out2, undefined, '■ 답 온 뒤 본편 요청\n', '_본편2');
    const inv2 = inventoryOf(out2);
    check(s, '늦게 온 운영자 답이 어느 본편에든 한 번은 넘어감', /못 알려 준다/.test(inv2) || /못 알려 준다/.test(inventoryOf(out1)), '한 번', /chatted by text[^;\n]*/.exec(inv2)?.[0] ?? '(없음)', '지침 3-C 「사건은 그 턴 본편에 한 번」');
    await saveState(s);
  }

  // B5 설정 갈래
  await bootChat(firstChat({ $cos_sh_min: '2', $cos_sh_max: '2', $cos_sh_model: 'main', $cos_truth: 'none', $cos_roll_on: '0', $cos_sh_feature: '0', $sh_diverse: '0', $sh_prev: '0' }));
  {
    const s = step('설정_개수모델진실배정구분');
    await loadShelf();
    const n = await llmCount();
    const all = allText(await llmAt(n - 1));
    writeReq(s, await llmAt(n - 1), COS_SHELF1);
    check(s, '보조/메인 모델 「메인」→ mode model', (await llmOpt(n - 1)).mode === 'model', 'model', await llmOpt(n - 1));
    check(s, '개수 2~2 → 「exactly 2」', all.includes('Shelf size: exactly 2 items'), 'exactly 2', /Shelf size:[^\n.]*/.exec(all)?.[0]);
    check(s, '진실 「전부 ?」→ TRUTH_NONE', all.includes('Write ? for EVERY') && !all.includes('MIX the two'), 'TRUTH_NONE', '');
    check(s, '진열 배정 끔 → 배정 칸 없음', !all.includes('[이번 진열 배정'), '없음', '');
    check(s, '희귀·특가 끔 → SHELF_PLAIN', all.includes('구분: always leave it empty') && !all.includes('Mark exactly ONE item'), 'PLAIN', '');
    check(s, '다양성 끔 → VARIETY 없음', !all.includes('Do not repeat items from the previous shelf'), '없음', '');
    const st = J(await vars(), '$cos_shop');
    note(s, '개수 2인데 답이 3개면 진열 수', st.items.length);
    const txt = await screen();
    check(s, '희귀·특가 끔이면 화면에 딱지 없음', !txt.includes('★굉장한 상품★') && !txt.includes('※세일※'), '딱지 없음', { rare: txt.includes('★굉장한 상품★'), sale: txt.includes('※세일※') }, '설정 「희귀·특가」 끔 (SHELF_PLAIN: 구분 칸 비움)');
    await saveState(s);
  }
  {
    const s = step('설정_지난목록피하기끔');
    await queue(COS_SHELF1.replace(/<shop-identity>[\s\S]*?<\/shop-identity>\n/, ''));
    const n0 = await llmCount();
    await act('mall-refresh', '');
    await waitLlm(n0);
    const all = allText(await llmAt(n0));
    writeReq(s, await llmAt(n0), '(같은 진열)');
    check(s, '「지난 목록 피하기」 끔 → AVOID_PREV 절 없음', !all.includes('Previously shown here'), '없음', '');
    note(s, '끈 채로 같은 진열을 다시 받으면', { calls: (await llmCount()) - n0, items: J(await vars(), '$cos_shop').items.map((x) => x.name) });
    await saveState(s);
  }
  await bootChat(firstChat({ $cos_sh_ctx: '0' }));
  {
    const s = step('설정_맥락반영끔');
    await loadShelf();
    const all = allText(await lastReq());
    writeReq(s, await lastReq(), COS_SHELF1);
    check(s, '맥락 반영 끔 → 상태창·최근 본문·괴이 칸 없음', !all.includes('[최근 본문]') && !all.includes('[상태창') && !all.includes('[진행 중 괴이'), '없음', { story: all.includes('[최근 본문]'), status: all.includes('[상태창') });
    await saveState(s);
  }
  await bootChat(firstChat({ $cos_sh_main: '0' }));
  {
    const s = step('설정_컨텍스트포함끔');
    await loadShelf();
    await act('mall-ask', '');
    await queue(COS_TALK1);
    const n0 = await llmCount();
    await act('mall-say', '안녕', 100);
    await waitLlm(n0);
    await act('mall-ask-close');
    await act('mall-cart', await idOf('말 듣는 우산')); await act('mall-order'); await act('mall-pay', undefined, 800);
    await closeWin(page);
    const out = await mainRequest('잔다.', 'u2');
    writeReq(s, out);
    const inv = inventoryOf(out);
    check(s, '우주몰 「컨텍스트 포함」 끔 → 구매·ARRIVE·대화 사건 없음', !inv.includes('우주 쇼핑몰') || (!/just bought/.test(thisTurn(inv)) && !inv.includes('arrives this turn') && !inv.includes('chatted by text')), '없음', thisTurn(inv));
    check(s, '물건은 소지품 목록엔 있음', /^- 말 듣는 우산/m.test(inv), '목록', inv.split('\n').filter((l) => l.startsWith('- ')));
    await saveState(s);
  }
  await bootChat(firstChat({ $sh_talk_stock: '0' }));
  {
    const s = step('설정_문의로물건바꾸기끔');
    await loadShelf();
    await act('mall-ask', '');
    const reply = `<owner>\n가져왔다.\n</owner>\n<change mode="partial">\n+ 새 우비|1400000|장비|옷/우비/raincoat|0.5|입는다.|젖지 않는다||?\n</change>`;
    await queue(reply);
    const n0 = await llmCount();
    await act('mall-say', '우비도 있어요?', 100);
    await waitLlm(n0);
    const all = allText(await lastReq());
    writeReq(s, await lastReq(), reply);
    check(s, 'TALK_NO_STOCK 절 + ORDER_COLUMNS, 더하기 줄은 무시', all.includes('the stock on the shelf is fixed') && all.includes('Columns of the order line') && !J(await vars(), '$cos_shop').items.some((x) => x.name === '새 우비'), '무시', J(await vars(), '$cos_shop').items.map((x) => x.name));
    check(s, 'TALK_NO_STOCK 이 「Prices stay as listed (no "~" lines)」', all.includes('Prices stay as listed'), '있음', '');
    await saveState(s);
  }
  await bootChat(firstChat({ $cos_ready: 'off' }));
  {
    const s = step('설정_완성알림끔');
    await loadShelf();
    await act('mall-ask', '');
    await queue(COS_TALK2);
    let n0 = await llmCount();
    await act('mall-say', '손전등 만들어 줘', 100);
    await waitLlm(n0);
    await act('mall-quote-accept', J(await vars(), '$cos_shop').quotes[0].id, 700);
    await act('mall-ask-close');
    await closeWin(page);
    await mainRequest('기다린다.', 'u2');
    await botReply(C3, 'c2');
    const msg = await page.evaluate(() => window.__chat.message.at(-1).data);
    check(s, '완성 알림 끔 → 응답에 표식 없음', !msg.includes('[shop-ready'), '없음', msg.slice(-50));
    const out = await peekMain('본다.');
    check(s, '완성 알림 끔 → 본편 READY 줄 없음', !inventoryOf(out).includes('is now finished and waiting'), '없음', '');
    await openSite();
    await act('mall-page', 'orders');
    check(s, '그래도 주문 조회엔 받기 단추', !!(await page.$('.ms [data-action="mall-custom-take"]')), '받기', '');
    void n0;
    await saveState(s);
  }

  // B6 자동 호출 「매 턴」: 턴마다 한 번, 다시 굴려도 또 안 부름, 안 본 진열은 다시 안 받음(사용자 11-15)
  await bootChat(firstChat({ $cos_sh_auto: 'turn' }));
  {
    const s = step('자동매턴');
    await loadShelf();
    await closeWin(page);
    await mainRequest('잔다.', 'u2');
    await queue(COS_SHELF2);
    let n0 = await llmCount();
    await botReply(C2.replace('2800000', '10000000'), 'c2');
    await sleep(1500);
    const cos = async (a, z) => { let k = 0; for (let i = a; i < z; i++) if (String((await llmAt(i))[0]?.content ?? '').includes('cosmic-mall')) k++; return k; };
    check(s, '본 진열이 있고 새 응답이 붙으면 우주몰 진열 1회', (await cos(n0, await llmCount())) === 1, 1, await cos(n0, await llmCount()));
    await queue(COS_SHELF3);
    n0 = await llmCount();
    await rerollLast(C2.replace('2800000', '10000000').replace('떨어졌다.', '떨어졌다!'), 'c2b');
    await sleep(1500);
    check(s, '같은 턴을 다시 굴리면 또 안 부름(턴 열쇠 같음)', (await cos(n0, await llmCount())) === 0, 0, await cos(n0, await llmCount()), 'core/shop.ts turnKeyAt 주석 사용자 11-11');
    await mainRequest('또 잔다.', 'u3');
    n0 = await llmCount();
    await botReply(C3.replace('2800000', '10000000'), 'c3');
    await sleep(1500);
    check(s, '받아 둔 진열을 안 열어 봤으면 다음 턴에 새로 안 받음', (await cos(n0, await llmCount())) === 0, 0, await cos(n0, await llmCount()), '사용자 2026-11-15 (src/ui/malls.ts autoRefreshMall)');
    await saveState(s);
  }
}

// ═════════════════════ part phone: 폰 크기 대표 경로 (화면 단추) ═════════════════════
if (PARTS.includes('phone')) {
  part = '폰_';
  await bootChat(firstChat(), 'phone');
  {
    const s = step('진열_사기_문의');
    await openSite();
    const over0 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await queue(COS_SHELF1);
    let n0 = await llmCount();
    await press('.ms [data-action="mall-refresh"]', 100);
    await waitLlm(n0);
    check(s, '폰: 상품 가져오기 단추로 진열', J(await vars(), '$cos_shop')?.items?.length === 3, 3, J(await vars(), '$cos_shop')?.items?.length);
    const id = await idOf('말 듣는 우산');
    await press(`.ms .cs-it[data-item="${id}"] [data-action="mall-cart"]`, 200);
    await press('.ms nav [data-action="mall-page"][data-value="cart"]', 300);
    await press('.ms [data-action="mall-order"]', 300);
    await press('.ms .cs-paywin [data-action="mall-pay"]', 900);
    check(s, '폰: 장바구니 → 주문 → 입금 단추로 구매, 잔고 7,800,000', (await bal()) === 7800000, 7800000, await bal());
    await press('.ms nav [data-action="mall-ask"]', 300);
    await typeSay('안녕?');
    await queue(COS_TALK1);
    n0 = await llmCount();
    await press('.ms .cs-askwin [data-action="mall-say"]', 100);
    await waitLlm(n0);
    check(s, '폰: 문의 창에서 보내고 답을 받음', J(await vars(), '$cos_shop').talk.length === 2, 2, J(await vars(), '$cos_shop').talk.length);
    const over = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, w: window.innerWidth, win: (() => { const r = document.querySelector('.cs-askwin')?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.right)] : null; })() }));
    check(s, '폰: 가로 넘침 없음, 문의 창이 화면 안', !over0 && over.doc <= over.w + 1 && (!over.win || (over.win[0] >= -1 && over.win[1] <= over.w + 1)), '넘침 없음', over);
    await page.screenshot({ path: `${OUT}폰_문의창.png` });
    await saveState(s);
  }
}

await dumpCalls(part);
writeFileSync(`${OUT}호출목록_${PARTS.join('-')}.txt`, callLog.join('\n'));
allErrors.push(...errors);
const prev = existsSync(`${OUT}결과.json`) && PARTS.length < 3 ? JSON.parse(readFileSync(`${OUT}결과.json`, 'utf8')) : { results: [], notes: [], pageErrors: [] };
const keepOld = (arr) => arr.filter((r) => !PARTS.some((p) => r.part === p));
writeFileSync(`${OUT}결과.json`, JSON.stringify({ commit: '807f994', results: [...keepOld(prev.results), ...results.map((r) => ({ ...r, part: PARTS.join('-') }))], notes: [...keepOld(prev.notes), ...notes.map((r) => ({ ...r, part: PARTS.join('-') }))], pageErrors: [...prev.pageErrors, ...allErrors] }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과${allErrors.length ? ` · 페이지 오류 ${allErrors.length}: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
