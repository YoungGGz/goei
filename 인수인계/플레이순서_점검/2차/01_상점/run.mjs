// 플레이 순서 점검 2차 · 01 상점 (지침: ../../GPT_점검지침_초안.md 3판 · 1차: ../../1_상점/run.mjs 를 늘림)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄우고 화면 단추를 눌러 간다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 단계마다 기대값(근거)을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 사용법: npm run release:prep -- --skip-tests  →  node 인수인계/플레이순서_점검/2차/01_상점/run.mjs [pc|phone|all]
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PART = process.argv[2] ?? 'all';
if (PART === 'all' || PART === 'pc') rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 장면: 로어북 「이정 책방」(주인 이름 없음 — 구슬발 뒤 손만 보이는 존재, 손글씨로만 말함. 값은 돈·금·물건·일·책으로도 받음) ──
const ST = (time, place, bal) => `[▣|2025.03.14|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|${bal}]`;
const CHAR1 = `불이 켜진 책방 유리문을 밀자 책갈피 풍경이 맑게 울렸다. 계산대 너머 구슬발 사이로 하얀 손 하나가 나와 쪽지를 내밀었다. 「어서 오십시오.」\n${ST('11:20 PM', '이정 책방', 10000)}\n[shop: 이정 책방|]`;
const CHAR2 = `쪽지를 받아 든 손이 잠시 머뭇거리다 구슬발을 흔들었다. 책방 안은 여전히 조용했다.\n${ST('11:34 PM', '이정 책방', 2950)}\n[shop: 이정 책방|]`;
const CHAR2B = `손이 쪽지 위에 짧게 무언가를 적어 내밀었다. 「또 오십시오.」\n${ST('11:35 PM', '이정 책방', 2950)}\n[shop: 이정 책방|]`;
const CHAR3 = `책방을 나서자 풍경이 한 번 더 울렸다. 골목은 어두웠다.\n${ST('11:50 PM', '이정 책방 앞 골목', 3230)}`;

// 첫 진열: 보통 2 · 희귀 1 · 특가 1 · 원이 아닌 대가 1 · 원+대가 1 (지침 SHELF·SHELF_FEATURE 꼴)
const SHELF1 = `<shop-identity>
sells: 옛 책과 새 책, 부적을 쓰는 종이·먹·붓, 손본 기물
never: 무기, 약, 먹을 것
prices: 손님과 물건에 따라 값이 바뀐다. 돈·금·물건·책·일로도 받는다
currency: -
</shop-identity>
<owner>
어서 오십시오. 천천히 보십시오.
</owner>
<shelf>
누런 부적지 묶음|300|소모10|부적/종이/paper|0.012|오래 묵은 한지, 귀퉁이가 바랬다|부적을 쓰면 값이 덜 든다|
송연먹|200|소모20|소모품/먹/ink stick|0.004|그을음 냄새가 진한 먹||
은 책갈피|5000|-|귀중품/책갈피/bookmark|0.018|조선 말 장인이 두드린 은 책갈피, 가장자리가 닳았다||희귀
족제비털 붓|500|손|도구/붓/brush|0.021|털끝이 조금 갈라졌다|부적을 그릴 때 번짐이 적다|특가:800
손때 묻은 필사첩|옛 책 한 권|-|서류/책/book|0.31|누군가 베껴 쓴 경전 필사첩||
수리한 향로|필사 한 장 + 400|사용|도구/향로/censer|0.86|금 간 자리를 불로 메운 놋 향로|피운 향이 오래 남는다|
</shelf>`;
const ASK1 = `<owner>
경상도 어느 절에서 온 먹입니다. 오래 묵어 향이 깊습니다.
</owner>
<change mode="none">
</change>`;
const HAGGLE1 = `<owner>
그럼 백오십에 드리지요.
</owner>
<change mode="partial">
~ 송연먹|150
</change>`;
const BARTER1 = `<owner>
돈 대신 먹을 한 자루 갈아 주시면 붓을 드리겠습니다.
</owner>
<change mode="partial">
~ 족제비털 붓|먹 한 자루 갈아 드리기
</change>`;
const REFUSE1 = `<owner>
그 책갈피는 깎아 드릴 수 없습니다.
</owner>
<change mode="none">
</change>`;
const FETCH1 = `<owner>
안쪽에 하나 남아 있습니다. 꺼내 드리지요.
</owner>
<change mode="partial">
+ 한지 노트|1200|-|서류/노트/notebook|0.24|손으로 묶은 한지 노트||
</change>`;
const KICK1 = `<owner>
더는 거래하지 않겠습니다. 나가 주십시오.
</owner>
<change mode="none">
</change>
<closed/>`;
const SHELF2 = `<owner>
새로 꺼낸 것입니다.
</owner>
<shelf>
낡은 필사본|400|-|서류/책/book|0.42|표지가 없는 손 필사본||
</shelf>`;
const SELL_OFFER = (n) => `<owner>
${n}이면 받겠습니다.
</owner>
<change mode="none">
</change>
<offer>${n}</offer>`;
const SELL_NONE = `<owner>
그런 것은 사지 않습니다.
</owner>
<change mode="none">
</change>
<offer>none</offer>`;
const SELL_DEAL = (n) => `<owner>
그럼 놓고 가십시오. 값은 여기 있습니다.
</owner>
<change mode="none">
</change>
<offer>${n}</offer>
<deal/>`;

const results = [];
let stepNo = 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
/** 기대값 비교: 실행 전에 적은 기대값(expect)과 실제값(actual). why = 기대값 근거 */
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)}`}`);
}
const fmtMsgs = (msgs, mode) => (mode ? `(mode: ${mode})\n` : '') + msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };

let page, errors;
const b = await launch();

async function start(chat0, vp = 'pc') {
  if (page) await page.close();
  ({ page, errors } = await boot(b, fx, chat0, vp, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } }));
  // 가짜 모델: 호출을 적고, 함수(__llmFn) → 줄(__llm) 순으로 답한다. __gate 가 있으면 그 약속이 풀릴 때까지 답을 붙잡는다 (늦게 온 답)
  await page.evaluate(() => {
    window.risuai.runLLMModel = async (o) => {
      window.__calls.llm = window.__calls.llm || [];
      window.__calls.llm.push(o);
      const gate = window.__gate;
      if (gate) { window.__gate = null; await gate; }
      await new Promise((r) => setTimeout(r, window.__llmDelay ?? 150));
      const f = window.__llmFn && window.__llmFn(o);
      if (f) return f;
      const next = (window.__llm || []).shift();
      return next ?? { type: 'fail', result: 'no mock' };
    };
  });
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
}
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const setVars = (o) => page.evaluate((o) => { Object.assign(window.__chat.scriptstate, o); }, o);
const shopSt = async () => J(await vars(), '$st_shop');
const ledger = async (k = '$st_wallet') => { const w = J(await vars(), k) ?? { start: 0, log: [] }; return { start: w.start, log: w.log, bal: w.start + w.log.reduce((n, e) => n + e.amount, 0) }; };
const items = async () => J(await vars(), '$st_items');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const restore = (c) => page.evaluate((c) => { window.__chat = JSON.parse(JSON.stringify(c)); }, c);
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => /^\$st_(shop|shop_last|wallet|items|points)$/.test(k)).map(([k, v]) => [k, J({ v }, 'v')])), messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2));
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => ({ messages: window.__calls.llm[i].messages, mode: window.__calls.llm[i].mode }), i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (typeof r === 'string' ? { type: 'success', result: r } : r)); }, t);
/** 화면 단추를 실제로 누른다. 화면에 없으면(숨은 단추) false */
const click = async (action, value) => {
  const sel = `.sh-wrap [data-action="${action}"]${value !== undefined ? `[data-value="${value}"]` : ''}, .sh-det [data-action="${action}"]${value !== undefined ? `[data-value="${value}"]` : ''}`;
  const el = await page.$(sel);
  if (!el || !(await el.isVisible()) || (await el.isDisabled())) return false;
  try { await el.click({ timeout: 3000 }); } catch { return false; }
  await sleep(350);
  return true;
};
/** 숨은 단추로 동작만 부른다 (갈래에서 빠르게, 또는 막힌 단추를 억지로 누를 때) */
const act = async (action, value) => {
  await page.evaluate(({ action, value }) => {
    const el = document.createElement('button');
    el.dataset.action = action;
    if (value !== undefined) el.dataset.value = value;
    el.style.display = 'none';
    (document.querySelector('.sh-wrap') || document.querySelector('.gx-panel') || document.body).appendChild(el);
    el.click();
    el.remove();
  }, { action, value });
  await sleep(350);
};
const waitIdle = () => page.waitForFunction(() => !document.querySelector('.sh-spin') && ![...document.querySelectorAll('.sh-dlg-box .dim')].some((p) => p.textContent === '…'), null, { timeout: 15000 }).catch(() => {});
const popupText = () => page.evaluate(() => document.querySelector('.sh-wrap')?.innerText ?? '');
const detText = () => page.evaluate(() => document.querySelector('.sh-det')?.innerText ?? '');
/** 말하기: 입력칸에 글을 치고 실제 보내기(↵) 단추를 누른다 */
const say = async (text, { viaButton = true } = {}) => {
  await page.fill('[data-input="shop-say"]', text).catch(() => {});
  await page.evaluate(() => { const i = document.querySelector('[data-input="shop-say"]'); i?.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(100);
  if (viaButton && (await page.$('.sh-go:not([disabled])'))) { try { await page.click('.sh-go', { timeout: 3000 }); } catch { await act('shop-say', text); } }
  else await act('shop-say', text);
  await sleep(300);
  await waitIdle(); await sleep(300);
};
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
/** 다시 굴리기 요청: 마지막 응답을 지운 채(Risu 가 먼저 지운다) beforeRequest */
const rerollRequest = async () => page.evaluate(async () => {
  window.__chat.message.pop();
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
});
const botReply = async (text, cid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]);
const settle = (i) => page.evaluate(async (i) => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: i }); }, i);
/** 채팅 카드: 마지막 응답을 display 로 그려 붙이고, 「상점 열기」를 실제로 누른다 */
const showCard = async (charText) => {
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), charText ?? (await page.evaluate(() => window.__chat.message.at(-1).data)));
  await page.evaluate((h) => { document.getElementById('chat-card')?.remove(); const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:10px;top:10px;width:360px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
  return html;
};
const openCard = async (charText) => {
  const html = await showCard(charText);
  const btn = await page.$('#chat-card [data-goei-shop]');
  const label = btn ? (await btn.innerText()).trim() : '';
  if (btn) await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.sh-wrap'), null, { timeout: 6000 }).catch(() => {});
  await sleep(300);
  return { html, card: !!btn, label };
};
/** 바꾼 채팅 변수를 화면이 다시 읽게 (칩 떼기 = env.refresh) */
const reread = async () => { await act('shop-chip-x'); await sleep(200); };
const ensurePick = async () => { if (!(await page.$('.sh-mine'))) { if (!(await click('shop-pick'))) await act('shop-pick'); } };
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const closeShop = async () => { await act('shop-detail-close'); if (!(await click('shop-close'))) await act('shop-close'); await sleep(200); };
const writeReq = (s, msgs, reply, extra = '', mode, suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs, mode)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const inventoryOf = (out) => out.find((m) => m.role === 'system' && (m.content.includes('[Inventory]') || m.content.startsWith('[Shop]')))?.content ?? '';
const thisTurn = (inv) => /This turn:[^\n]*/.exec(inv)?.[0] ?? '(This turn 없음)';
const joined = (r) => r.messages.map((m) => m.content).join('\n');
const idOf = async (name) => (await shopSt()).items.find((x) => x.name === name && !x.sold)?.id;

const chatBase = (extra = {}) => ({
  message: [{ role: 'user', data: '불이 켜진 걸 확인하고 이정 책방 문을 연다.', chatId: 'u1' }, { role: 'char', data: CHAR1, chatId: 'c1' }],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 10000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }), ...extra },
});

// ════════════════════════════ PC 대표 경로 ════════════════════════════
if (PART === 'all' || PART === 'pc') {
await start(chatBase(), 'pc');
const snaps = {};

// 01 응답 처리: 표식 → 상점 상태, 카드
{
  const s = step('표식_응답처리_카드');
  await settle(1);
  await sleep(300);
  const st = await shopSt();
  check(s, '표식으로 상점 상태 생김 (가게 이정 책방, 주인 빈칸, 기준 c1)', st?.shop === '이정 책방' && st?.owner === '' && st?.key === 'c1', { shop: '이정 책방', owner: '', key: 'c1' }, st && { shop: st.shop, owner: st.owner, key: st.key }, 'core/shop.ts settleShop');
  const html = await showCard(CHAR1);
  check(s, '카드: 표식 글자는 지우고 「상점 열기」 단추', !html.includes('[shop:') && html.includes('상점 열기'), '표식 없음 + 상점 열기', html.slice(-200), '사용자 11-07 구조 (goei-store-thread)');
  await saveState(s);
}

// 02 카드 「상점 열기」 → 첫 진열 요청
{
  const s = step('열기_첫진열');
  await queue(SHELF1);
  const n0 = await llmCount();
  const { card } = await openCard(CHAR1);
  await waitIdle(); await sleep(300);
  check(s, '카드를 실제로 눌러 열림', card, true, card);
  const n1 = await llmCount();
  check(s, '보조 호출 1회 (보조 모델 submodel)', n1 - n0 === 1, 1, n1 - n0);
  const r = n1 > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, SHELF1, '', r.mode);
  const all = joined(r);
  check(s, '보조 모델로 감 (설정 기본 aux)', r.mode === 'submodel', 'submodel', r.mode, 'shopSettings model 기본 aux');
  check(s, '가게 로어북(이정 책방) 본문이 참고 자료에', /Yijeong Bookstore/.test(all), 'Yijeong Bookstore', /Yijeong/.test(all), '2-A 판단에 필요한 정보');
  check(s, '지금 장소·시각(상태창)이 들어감, 잔고 칸은 없음', all.includes('11:20 PM') && !/\|10000\]/.test(all), '11:20 PM, |10000] 없음', { time: all.includes('11:20 PM'), bal: /\|10000\]/.test(all) }, '사용자 11-22 21:28 잔고 숨김');
  const story = /\[최근 본문\]\n([\s\S]*?)\n\n\[현재 작업\]/.exec(r.messages.at(-1)?.content ?? '')?.[1] ?? '';
  check(s, '[최근 본문]에 플러그인 표식 [shop: …] 이 새지 않음', !/\[shop:/.test(story), '표식 없음', story.split('\n').filter((l) => l.includes('[shop')), '점검지침 3-A 「넣지 말아야 할 것(플러그인 내부 표식)」, 1차 문제2 둘째 줄');
  check(s, 'FIRST·정체 블록 요구, 희귀·특가 구획 규칙(SHELF_FEATURE)', all.includes('<shop-identity>') && all.includes('First visit') && all.includes('Mark exactly ONE item 「희귀」'), 'FIRST + SHELF_FEATURE', all.includes('First visit'));
  check(s, '지난 진열이 없으니 「Previously shown」 절이 없음', !all.includes('Previously shown here'), '없음', all.includes('Previously shown here'));
  const st = await shopSt();
  const by = (n) => st?.items.find((x) => x.name === n);
  check(s, '진열 6개를 꼴대로 받음 (희귀 1·특가 1·대가 2)', st?.loaded && st.items.length === 6 && by('은 책갈피')?.tag === 'rare' && by('족제비털 붓')?.tag === 'sale' && by('족제비털 붓')?.was === 800 && by('손때 묻은 필사첩')?.pay === '옛 책 한 권' && by('손때 묻은 필사첩')?.price === 0 && by('수리한 향로')?.pay === '필사 한 장' && by('수리한 향로')?.price === 400, '6개', st?.items?.map((x) => `${x.name}:${x.price}${x.pay ? `+${x.pay}` : ''}${x.tag ? `:${x.tag}` : ''}`));
  const txt = await popupText();
  check(s, '화면: 희귀 구획·특가 구획(-38%)·대가 글이 보임', txt.includes('희귀') && txt.includes('특가') && txt.includes('-38%') && txt.includes('옛 책 한 권'), '희귀·특가·-38%·옛 책 한 권', txt.slice(0, 400));
  check(s, '주인 첫 말이 대화 칸에', txt.includes('어서 오십시오. 천천히 보십시오.'), '첫 말', txt.includes('천천히'));
  await saveState(s);
  snaps.shelf1 = await snap();
}

// 03 물건 눌러 묻기 → 문의 요청
{
  const s = step('물건묻기_문의요청');
  const id = await idOf('송연먹');
  const okDetail = await click('shop-detail', id);
  const det = await detText();
  check(s, '물건을 누르면 상세 창(값·잔고·잔액, 구매·묻기)', okDetail && det.includes('송연먹') && det.includes('구매') && det.includes('묻기') && det.includes('10,000'), '상세 창', det.slice(0, 200));
  const okAsk = await click('shop-ask', id);
  check(s, '묻기 → 입력칸에 「묻기: 송연먹」 칩', okAsk && (await popupText()).includes('묻기: 송연먹'), '칩', (await popupText()).includes('묻기: 송연먹'));
  await queue(ASK1);
  const n0 = await llmCount();
  await say('이 먹은 어디서 났어요?');
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, ASK1, '', r.mode);
  const all = joined(r);
  const user = r.messages.at(-1)?.content ?? '';
  check(s, '[지금 진열대] 6줄이 화면 값 그대로 (대가 포함)', /\[지금 진열대\]\n[\s\S]*손때 묻은 필사첩\|옛 책 한 권\|/.test(user) && /수리한 향로\|필사 한 장 \+ 400\|/.test(user) && /족제비털 붓\|500\|[^\n]*\|특가:800/.test(user) && /은 책갈피\|5000\|[^\n]*\|희귀/.test(user), '대가·특가·희귀 칸', /\[지금 진열대\][\s\S]*?\n\n/.exec(user)?.[0]);
  check(s, '마지막 줄 = 방금 한 말 (묻는 물건 표시)', /\[주인공\] \[송연먹\] 이 먹은 어디서 났어요\?\s*$/.test(user), '[주인공] [송연먹] 이 먹은 어디서 났어요?', user.slice(-60));
  check(s, '문의 지침(TALK)·구분 안내(TALK_FEATURE)·끊기 켬(KICK_ON)·출력 꼴', all.includes('The protagonist speaks to the owner') && all.includes('「희귀」 marks') && all.includes('add <closed/>') && all.includes('<closed/> only if the owner ends'), 'TALK·TALK_FEATURE·KICK_ON·TALK_OUTPUT_END', { talk: all.includes('The protagonist speaks'), kick: all.includes('add <closed/>') });
  check(s, '[최근 본문]에 플러그인 표식 [shop: …] 이 새지 않음', !/\[최근 본문\][\s\S]*\[shop:/.test(user), '없음', /\[shop:[^\]]*\]/.exec(user)?.[0] ?? '', '3-A 내부 표식');
  const st = await shopSt();
  check(s, '대화: 내 말 + 주인 답, 진열 그대로', st.talk.length === 3 && st.talk[1].who === 'me' && st.talk[2].text.includes('경상도') && st.items.length === 6, 3, st.talk.map((l) => `${l.who}:${l.text.slice(0, 12)}`));
  await saveState(s);
}

// 04 흥정: 깎아 달라 → 수락(값 바뀜)
{
  const s = step('흥정_깎기_수락');
  await queue(HAGGLE1);
  await say('백오십에 안 될까요?');
  const st = await shopSt();
  const it = st.items.find((x) => x.name === '송연먹');
  check(s, '송연먹 150, 원래 값 200 기록, 화면에 ▾', it?.price === 150 && it?.orig === 200 && (await popupText()).includes('150'), { price: 150, orig: 200 }, it && { price: it.price, orig: it.orig }, '지침 TALK haggling accept → ~ 이름|값');
  await saveState(s);
}

// 05 흥정: 다른 대가 제안 → 주인이 다른 대가를 받음 (특가 물건)
{
  const s = step('흥정_다른대가_특가물건');
  await queue(BARTER1);
  await say('돈 대신 먹을 갈아 드리면 붓을 주실래요?');
  const st = await shopSt();
  const it = st.items.find((x) => x.name === '족제비털 붓');
  check(s, '붓 값이 「먹 한 자루 갈아 드리기」(원 0)로 바뀜', it?.pay === '먹 한 자루 갈아 드리기' && it?.price === 0, { pay: '먹 한 자루 갈아 드리기', price: 0 }, it && { pay: it.pay, price: it.price, tag: it.tag, was: it.was });
  const html = await page.evaluate(() => [...document.querySelectorAll('.sh-c')].find((b) => b.innerText.includes('족제비털 붓'))?.innerText ?? '');
  // 근거: 특가 = 원래 값에서 깎아 원으로 내놓은 것(사용자 11-07, core/shop.ts ShopItem.tag 주석). 읽을 때는 대가가 붙은 줄을 특가로 받지 않는다(parseLine `!cost.pay`)
  check(s, '대가로 바뀐 물건이 「-100%」 특가로 보이지 않음 (특가는 원 값만)', !html.includes('-100%') && !(it?.tag === 'sale' && it?.pay), '-100% 없음, 특가 딱지 떨어짐', { cell: html.replace(/\n/g, ' '), tag: it?.tag, was: it?.was }, '사용자 11-07 특가 정의 · parseLine 은 대가 줄을 특가로 안 받음');
  await saveState(s);
}

// 06 흥정: 주인이 거절 (진열 그대로)
{
  const s = step('흥정_거절');
  const before = canon((await shopSt()).items);
  await queue(REFUSE1);
  await say('책갈피 사천에 주세요');
  const st = await shopSt();
  check(s, '거절이면 진열·값 그대로', canon(st.items) === before, before, canon(st.items));
  await saveState(s);
}

// 07 없는 물건 찾기 → 들여옴 (문의로 물건 바꾸기 켬)
{
  const s = step('없는물건_들여옴');
  await queue(FETCH1);
  const n0 = await llmCount();
  await say('노트 같은 건 없나요?');
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, FETCH1, '', r.mode);
  const all = joined(r);
  check(s, '문의 요청에 진열 규칙(줄 꼴·값)이 들어감 (설정 켬)', all.includes('Shelf size:') && all.includes('이름|값|쓰임|그림|무게|설명|효과|구분') && !all.includes('In this reply the stock on the shelf is fixed'), 'SHELF_RULES, TALK_NO_STOCK 없음', all.includes('Shelf size:'), '설정 「문의로 물건 바꾸기」 기본 켬');
  const st = await shopSt();
  check(s, '한지 노트 1200 이 진열에 더해짐', st.items.some((x) => x.name === '한지 노트' && x.price === 1200 && !x.sold), '한지 노트', st.items.map((x) => x.name));
  await saveState(s);
  snaps.beforeBuy = await snap();
}

// 08 하나 사기: 원(깎은 값) / 대가만 / 원+대가 / 희귀 / 잔고 부족
{
  const s = step('사기_여러값');
  const buy = async (name) => { const id = await idOf(name); await click('shop-detail', id); const det = await detText(); const ok = await click('shop-buy', id); return { det, ok }; };
  const b1 = await buy('송연먹');
  check(s, '상세 창: 깎은 값(취소선 200)·잔액 9,850', b1.det.includes('200') && b1.det.includes('150') && b1.det.includes('9,850'), '200→150, 9,850', b1.det.replace(/\n/g, ' ').slice(0, 200));
  const b2 = await buy('손때 묻은 필사첩');
  check(s, '상세 창: 대가 「옛 책 한 권」, 원 값 줄 없음', b2.det.includes('대가') && b2.det.includes('옛 책 한 권'), '대가 줄', b2.det.replace(/\n/g, ' ').slice(0, 200));
  await buy('수리한 향로');
  await buy('족제비털 붓');
  await buy('누런 부적지 묶음');
  await buy('은 책갈피');
  const w = await ledger();
  const it = await items();
  // 150 + 0 + 400 + 0 + 300 + 5000 = 5850 → 4150
  check(s, '잔고 10000 → 4150 (원 몫만 빠짐), 거래 4건(원 몫 있는 것만)', w.bal === 4150 && w.log.filter((e) => e.src === 'store').length === 4, { bal: 4150, n: 4 }, { bal: w.bal, log: w.log.map((e) => `${e.amount}:${e.memo}`) }, 'ui/shop.ts shop-buy 주석: 원 몫이 있을 때만 가계부');
  const pw = (n) => it.list.find((e) => e.name === n)?.paidWith;
  check(s, '대가로 산 물건엔 무엇으로 치렀는지 적힘', pw('손때 묻은 필사첩') === '옛 책 한 권' && pw('수리한 향로') === '필사 한 장' && pw('족제비털 붓') === '먹 한 자루 갈아 드리기', '대가 셋', { a: pw('손때 묻은 필사첩'), b: pw('수리한 향로'), c: pw('족제비털 붓') });
  // 잔고 부족: 한지 노트 1200 은 살 수 있으니, 잔고를 낮춘 갈래에서 본다
  await saveState(s);
  snaps.afterBuy6 = await snap();
}

// 09 잔고 부족 (갈래: 잔고 100 으로)
{
  const s = step('사기_잔고부족');
  const c = await snap();
  await setVars({ $st_wallet: JSON.stringify({ start: 5950, log: J(await vars(), '$st_wallet').log }) }); // 잔고 100
  await act('shop-detail-close'); await reread();
  const id = await idOf('한지 노트');
  await act('shop-detail', id);
  const disabled = await page.evaluate(() => document.querySelector('.sh-det [data-action="shop-buy"]')?.disabled ?? null);
  const det = await detText();
  check(s, '잔고가 모자라면 구매 단추가 막히고 「부족 1,100」', disabled === true && det.includes('부족') && det.includes('1,100'), '막힘 + 부족 1,100', { disabled, det: det.replace(/\n/g, ' ').slice(0, 160) });
  await act('shop-buy', id);
  const w = await ledger();
  const info = await page.evaluate(() => document.querySelector('.sh-wrap')?.innerText ?? '');
  check(s, '억지로 눌러도 사지 않음, 안내가 뜸', w.bal === 100 && info.includes('잔고가 모자라'), { bal: 100 }, { bal: w.bal, info: /잔고가 모자라[^\n]*/.exec(info)?.[0] });
  await restore(c);
  await act('shop-detail-close'); await reread();
  await saveState(s);
}

// 10 남은 것 다 사기 → 빈 진열대
{
  const s = step('남은것_다사기_빈진열대');
  const id = await idOf('한지 노트');
  await click('shop-detail', id); await click('shop-buy', id);
  const st = await shopSt();
  const txt = await popupText();
  const w = await ledger();
  check(s, '모두 팔림 + 「진열대가 비었어요」 + 잔고 2950', st.items.every((x) => x.sold) && txt.includes('진열대가 비었어요') && w.bal === 2950, { empty: true, bal: 2950 }, { sold: st.items.filter((x) => !x.sold).map((x) => x.name), bal: w.bal, txt: txt.slice(0, 120) });
  await saveState(s);
  snaps.allBought = await snap();
}

// 11 다음 턴 본편 요청: 산 것·나눈 말이 한 번
{
  const s = step('다음턴_본편요청');
  await closeShop();
  const out = await mainRequest('고맙다는 쪽지를 남긴다.', 'u2');
  writeReq(s, out);
  const inv = inventoryOf(out);
  const tt = thisTurn(inv);
  check(s, '구매 사건 한 줄에 7개 모두, 대가는 「paid with」로', ['송연먹', '손때 묻은 필사첩 (paid with 옛 책 한 권)', '수리한 향로 (paid with 필사 한 장 + 400 won)', '족제비털 붓 (paid with 먹 한 자루 갈아 드리기)', '누런 부적지 묶음', '은 책갈피', '한지 노트'].every((x) => tt.includes(x)), '7개 + paid with', tt, '지침 메인요청_덧붙임 INVENTORY.BOUGHT.PAID/PAID_WON');
  check(s, '나눈 말(묻기·흥정·대가·거절·들여옴)이 이번 턴 한 번', (tt.match(/경상도/g) ?? []).length === 1 && tt.includes('갈아 주시면') && tt.includes('꺼내 드리지요'), '한 번', (tt.match(/경상도/g) ?? []).length, '사용자 11-07 「이번 방문 대화 전부」');
  check(s, '「Recently: got」 줄에 방금 산 것이 겹치지 않음', !/Recently:[^\n]*got[^\n]*송연먹/.test(inv), '겹침 없음', /Recently:[^\n]*/.exec(inv)?.[0] ?? '(Recently 없음)', '사용자 11-22 21:28 (고친뒤_대조 1절)');
  check(s, '본편 요청에 잔고 숫자가 [Inventory] 에 없음, 상점 표식 지침(MAIN_TAG) 있음', !/\b2,?950\b/.test(inv) && inv.includes('[shop: 가게 이름|주인 이름]'), 'MAIN_TAG', inv.includes('[shop:'));
  check(s, '이번 방문 안 산 물건 목록(진열)은 기본 끔이라 없음', !inv.includes('now offers these'), '없음', inv.includes('now offers these'), 'shopctx SHOP_MAIN_OFF shelf 기본 끔');
  await saveState(s);
  snaps.req2 = await snap();
}

// 12 같은 가게 표식이 다시 붙음 → 다시 열기 (상태 이어짐) → 그다음 턴
{
  const s = step('같은가게_다시열기_그다음턴');
  await botReply(CHAR2, 'c2');
  await sleep(300);
  const st = await shopSt();
  check(s, '같은 가게: 상태 이어짐, 기준 c2, 옛 응답 표식은 지워짐', st?.key === 'c2' && st.items.length === 7 && !(await page.evaluate(() => window.__chat.message[1].data)).includes('[shop:'), { key: 'c2' }, st && { key: st.key, n: st.items.length });
  const { card } = await openCard(CHAR2);
  check(s, '다시 열면 빈 진열대 그대로', card && (await popupText()).includes('진열대가 비었어요'), '비었어요', (await popupText()).slice(0, 120));
  await closeShop();
  const out = await mainRequest('필사본이 더 있는지 둘러본다.', 'u3');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '그다음 턴엔 구매 사건·나눈 말이 다시 안 나옴', !/just bought/.test(inv) && !inv.includes('경상도'), '없음', thisTurn(inv));
  check(s, '소지품 목록엔 7개가 남음', ['송연먹', '은 책갈피', '한지 노트'].every((n) => new RegExp(`^- ${n}`, 'm').test(inv)), '목록', inv.split('\n').filter((l) => l.startsWith('- ')).length);
  await saveState(s);
}

// 13 빈 진열대에서 새로고침 (산 것·지난 진열 피하기, 이번 방문 대화 기억)
{
  const s = step('빈진열대_새로고침');
  await page.evaluate(() => window.__chat.message.pop()); // u3 는 아직 안 보낸 것으로
  await openCard(CHAR2);
  await queue(SHELF2);
  const n0 = await llmCount();
  await click('shop-refresh');
  await waitIdle(); await sleep(300);
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, SHELF2, '', r.mode);
  const all = joined(r);
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '피할 목록에 산 7개 모두', ['송연먹', '은 책갈피', '한지 노트', '손때 묻은 필사첩', '수리한 향로', '족제비털 붓', '누런 부적지 묶음'].every((x) => avoid.includes(x)), '7개', avoid, '사용자 11-22 (다 사고 새로고침하면 같은 물건)');
  check(s, 'RESTOCK·고정 정체·이번 방문 대화(지난 턴 것 포함)', all.includes('Re-stock') && all.includes('[가게 정체 — 고정]') && all.includes('[이번 방문 대화]') && all.includes('경상도'), 'RESTOCK·정체·대화', { restock: all.includes('Re-stock'), talk: all.includes('경상도') }, '사용자 11-07 새로고침에도 대화 전부');
  const st = await shopSt();
  check(s, '새 진열(낡은 필사본) + 산 것은 팔림으로 남음', st.items.filter((x) => !x.sold).map((x) => x.name).join() === '낡은 필사본', '낡은 필사본', st.items.filter((x) => !x.sold).map((x) => x.name));
  await saveState(s);
  snaps.restocked = await snap();
}

// 14 팔기: 소지품 고름 → 값 묻기 → 흥정 → 「판매」 단추
{
  const s = step('팔기_값묻기_흥정_판매단추');
  const okPick = await click('shop-pick');
  const txt = await popupText();
  check(s, '「판매」 → 진열대 자리에 내 소지품', okPick && txt.includes('팔 물건을 고르세요'), '소지품 격자', txt.slice(0, 160));
  const a = (await items()).list.find((e) => e.name === '은 책갈피');
  await click('shop-sell-pick', a.id);
  check(s, '고르면 입력칸에 「판매: 은 책갈피」 칩', (await popupText()).includes('판매: 은 책갈피'), '칩', (await popupText()).includes('판매: 은 책갈피'));
  await queue(SELL_OFFER(3000));
  let n0 = await llmCount();
  await say('');
  let r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, SELL_OFFER(3000), '■ 첫 요청: 물건만 내밀기\n', r.mode);
  let all = joined(r);
  check(s, 'SELL 지침·[팔려는 물건]·산 값 5000', all.includes('[팔려는 물건') && all.includes('bought earlier for 5000 won') && all.includes('Output <offer>N</offer>'), 'SELL', /bought earlier[^\n]*/.exec(all)?.[0]);
  check(s, '마지막 줄 = [판매: 은 책갈피]', /\[주인공\] \[판매: 은 책갈피\]\s*$/.test(r.messages.at(-1)?.content ?? ''), '[판매: 은 책갈피]', (r.messages.at(-1)?.content ?? '').slice(-40));
  const det = await detText();
  check(s, '부른 값 3000 → 판매 상세 창 [판매][흥정][그만]', (await shopSt()).sell?.price === 3000 && det.includes('판매') && det.includes('흥정') && det.includes('그만'), 3000, det.replace(/\n/g, ' ').slice(0, 160));
  await click('shop-sell-haggle');
  await queue(SELL_OFFER(3500));
  n0 = await llmCount();
  await say('사천은 받아야겠어요');
  r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, SELL_OFFER(3500), '■ 둘째 요청: 흥정\n', r.mode, '_2');
  all = joined(r);
  check(s, '흥정 요청에 지난번 부른 값 3000', all.includes('your last offer: 3000 won'), '3000', /your last offer[^\n]*/.exec(all)?.[0]);
  const okSell = await click('shop-sell');
  const w = await ledger();
  const st = await shopSt();
  check(s, '「판매」 → 잔고 2950 → 6450, 판 것 목록 3500', okSell && w.bal === 6450 && st.sales.some((x) => x.name === '은 책갈피' && x.price === 3500) && !st.sell, { bal: 6450 }, { ok: okSell, bal: w.bal, sales: st.sales });
  await saveState(s);
}

// 15 팔기: 대가로 산 물건을 내밀기 (산 값이 0원으로 가지 않나)
{
  const s = step('팔기_대가로산물건_산값');
  await act('shop-detail-close'); await ensurePick();
  const p = (await items()).list.find((e) => e.name === '손때 묻은 필사첩');
  await click('shop-sell-pick', p.id);
  const cell = await page.evaluate(() => document.querySelector('.sh-mine .sh-c.sel')?.innerText ?? '');
  await queue(SELL_NONE);
  const n0 = await llmCount();
  await say('');
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, SELL_NONE, '', r.mode);
  const all = joined(r);
  // 근거: 지침 SELL 「what the protagonist paid if known」 — 이 물건은 「옛 책 한 권」으로 샀다(원 0). 「0 won 에 샀다」는 사실이 아니다
  check(s, '대가로 산 물건을 「bought earlier for 0 won」으로 알리지 않음', !all.includes('bought earlier for 0 won'), '0 won 없음 (대가 또는 생략)', /bought earlier[^\n]*/.exec(all)?.[0] ?? '(없음)', '지침 상점 SELL·SELLING_PAID, 소지품 paidWith');
  check(s, '판매 고르기 칸에 「산 값 0」이 보이지 않음', !/산 값\s*0\b/.test(cell), '산 값 0 없음', cell.replace(/\n/g, ' '));
  const det = await detText();
  check(s, '주인이 안 사면(<offer>none</offer>) 「사지 않겠대요」, 판매 단추 없음', (await shopSt()).sell?.price === null && det.includes('사지 않겠대요') && !det.includes('흥정'), 'null', det.replace(/\n/g, ' ').slice(0, 140));
  await click('shop-sell-cancel');
  check(s, '「그만」 → 팔기 상태 비움', !(await shopSt()).sell, null, (await shopSt()).sell);
  await saveState(s);
}

// 16 팔기: 말로 수락(<deal/>)
{
  const s = step('팔기_말로수락');
  await act('shop-detail-close'); await ensurePick();
  const a = (await items()).list.find((e) => e.name === '누런 부적지 묶음');
  await click('shop-sell-pick', a.id);
  await queue(SELL_OFFER(200));
  await say('');
  await queue(SELL_DEAL(200));
  await say('그 값에 팔게요');
  const w = await ledger();
  const st = await shopSt();
  check(s, '말로 수락 → 판매 완료: 잔고 6450 → 6650', w.bal === 6650 && st.sales.length === 2 && !st.sell, 6650, { bal: w.bal, sales: st.sales.map((x) => `${x.name}:${x.price}`) }, '지침 SELL <deal/>');
  await saveState(s);
}

// 17 나가기 → 다음 턴 본편 요청 → 표식 없는 응답 → 그다음 턴
{
  const s = step('나가기_다음턴_그다음턴');
  await closeShop();
  const out = await mainRequest('인사하고 책방을 나간다.', 'u3');
  writeReq(s, out);
  const inv = inventoryOf(out);
  const tt = thisTurn(inv);
  check(s, '판 사건 한 번(은 책갈피 3500, 부적지 200)', (tt.match(/은 책갈피 \(3,500 won\)/g) ?? []).length === 1 && tt.includes('누런 부적지 묶음 (200 won)'), '판 것 둘', tt);
  check(s, '이번 턴 나눈 말(새로고침 첫 말·팔기 흥정)이 한 번, 지난 턴 말은 없음', tt.includes('사천은 받아야겠어요') && !tt.includes('경상도'), '이번 턴만', tt.slice(0, 400));
  await botReply(CHAR3, 'c3');
  await sleep(300);
  check(s, '표식 없는 응답 → 상점 상태 비움', !(await shopSt()), null, (await shopSt())?.shop);
  const out2 = await mainRequest('골목을 걷는다.', 'u4');
  writeReq(s, out2, undefined, '', undefined, '_2');
  const tt2 = thisTurn(inventoryOf(out2));
  check(s, '그다음 턴엔 판 사건·대화가 다시 안 나옴', !tt2.includes('just sold') && !tt2.includes('talked with'), '없음', tt2);
  await saveState(s);
}

// 18 다른 가게 표식 → 새 방문 (이정 책방 대화·피할 목록이 섞이지 않나)
{
  const s = step('다른가게_새방문');
  const c = JSON.parse(JSON.stringify(snaps.restocked));
  await restore(c);
  const other = `책방 옆 문구점으로 들어갔다. 계산대의 노인이 고개를 들었다.\n${ST('11:52 PM', '문구점', 2950)}\n[shop: 행운 문구|]`;
  await closeShop();
  await mainRequest('옆 문구점에 들어간다.', 'u3');
  await botReply(other, 'c3');
  await sleep(300);
  const st = await shopSt();
  check(s, '다른 가게면 새 상태 (진열·대화·피할 목록 비움)', st?.shop === '행운 문구' && !st.loaded && !st.items.length && !st.talk.length && !st.prev.length, '새 상태', st && { shop: st.shop, items: st.items.length, talk: st.talk.length, prev: st.prev.length });
  await queue(SHELF1.replace('currency: -', 'currency: -'));
  const n0 = await llmCount();
  await openCard(other);
  await waitIdle();
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, SHELF1, '', r.mode);
  const all = joined(r);
  check(s, '새 가게 첫 진열 요청에 이정 책방 대화·피할 목록 없음', !all.includes('경상도') && !all.includes('Previously shown here') && all.includes('First visit'), '없음', { talk: all.includes('경상도'), avoid: all.includes('Previously shown here') });
  await closeShop();
  await saveState(s);
}

// ════════ 갈래 (같은 틀에서 상태만 바꿔) ════════

// 19 끊기 켬: <closed/> → 잠김 → 다음 턴 REFUSED 한 번 → 같은 가게 표식이 또 붙으면
{
  const s = step('갈래_끊기켬');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  await queue(KICK1);
  await say('이딴 걸 누가 사요, 다 쓰레기네');
  const st = await shopSt();
  const txt = await popupText();
  check(s, '주인이 끊으면 잠김 + 안내', st.closed && txt.includes('거래를 끊었어요'), 'closed', { closed: st.closed });
  const dis = await page.evaluate(() => ({ refresh: document.querySelector('.sh-wrap [data-action="shop-refresh"]')?.disabled, input: document.querySelector('[data-input="shop-say"]')?.disabled }));
  check(s, '새로고침·말하기 막힘', dis.refresh && dis.input, { refresh: true, input: true }, dis);
  await closeShop();
  const out = await mainRequest('쫓겨나듯 책방을 나온다.', 'u2');
  writeReq(s, out);
  const tt = thisTurn(inventoryOf(out));
  check(s, '다음 턴 본편에 「was refused service」 한 번', (tt.match(/refused service/g) ?? []).length === 1, 1, tt);
  await botReply(CHAR2, 'c2');
  const out2 = await mainRequest('다시 들어가 본다.', 'u3');
  check(s, '그다음 턴엔 REFUSED 가 다시 안 나옴', !thisTurn(inventoryOf(out2)).includes('refused'), '없음', thisTurn(inventoryOf(out2)));
  await saveState(s);
}

// 20 끊기 끔: KICK_OFF, <closed/> 무시
{
  const s = step('갈래_끊기끔');
  await restore(snaps.shelf1);
  await setVars({ $sh_kick: '0' });
  await openCard(CHAR1);
  await queue(KICK1);
  const n0 = await llmCount();
  await say('이딴 걸 누가 사요');
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, KICK1, '', r.mode);
  const all = joined(r);
  check(s, '끄면 KICK_OFF, 출력 꼴에 <closed/> 줄 없음', all.includes('The owner never ends the dealing') && !all.includes('<closed/> only if'), 'KICK_OFF', { off: all.includes('never ends'), end: all.includes('<closed/> only if') }, '설정 「거래 끊음」 11-07');
  check(s, '답에 <closed/> 가 와도 잠기지 않음', !(await shopSt()).closed, false, (await shopSt()).closed);
  await closeShop();
  await saveState(s);
}

// 21 문의로 물건 바꾸기 끔: TALK_NO_STOCK, + 줄·all 무시
{
  const s = step('갈래_문의로물건바꾸기끔');
  await restore(snaps.shelf1);
  await setVars({ $sh_talk_stock: '0' });
  await openCard(CHAR1);
  await queue(FETCH1);
  const n0 = await llmCount();
  await say('노트 같은 건 없나요?');
  const r = (await llmCount()) > n0 ? await llmAt(n0) : { messages: [] };
  writeReq(s, r.messages, FETCH1, '', r.mode);
  const all = joined(r);
  check(s, '끄면 TALK_NO_STOCK, 진열 규칙 없음', all.includes('In this reply the stock on the shelf is fixed') && !all.includes('Shelf size:'), 'NO_STOCK', { nostock: all.includes('stock on the shelf is fixed'), rules: all.includes('Shelf size:') });
  check(s, '답의 「+」 줄은 받지 않음', !(await shopSt()).items.some((x) => x.name === '한지 노트'), '안 더함', (await shopSt()).items.map((x) => x.name));
  await closeShop();
  await saveState(s);
}

// 22 전부 바꿔 달라 (mode all)
{
  const s = step('갈래_전부바꿔');
  await restore(snaps.afterBuy6);
  await openCard(CHAR1);
  await queue(`<owner>\n다른 것들을 내놓지요.\n</owner>\n<change mode="all">\n낡은 필사본|400|-|서류/책/book|0.42|표지가 없는 손 필사본||\n송연먹|250|소모20|소모품/먹/ink stick|0.004|다른 통에서 꺼낸 먹||\n</change>`);
  await say('다른 물건 전부 보여 주세요');
  const st = await shopSt();
  check(s, '산 것은 팔림으로 남고, 안 팔린 것(한지 노트)은 빠지고 새 진열', st.items.filter((x) => !x.sold).map((x) => x.name).sort().join() === ['낡은 필사본', '송연먹'].sort().join() && st.items.filter((x) => x.sold).length === 6, '낡은 필사본·송연먹', st.items.map((x) => `${x.name}${x.sold ? '(산)' : ''}`));
  await closeShop();
  await saveState(s);
}

// 23 응답 실패: 첫 진열 꼴 틀림(재시도 1회) → 끝내 실패 → 새로고침으로 다시 받기
{
  const s = step('갈래_첫진열_꼴틀림');
  await restore(chatBase());
  await settle(1);
  await queue('진열대입니다: 먹, 붓', '<owner>\n어서 오십시오\n</owner>\n물건 없음');
  const n0 = await llmCount();
  await openCard(CHAR1);
  await waitIdle(); await sleep(300);
  const n1 = await llmCount();
  check(s, '형식 오류 재시도 1회 (호출 2회)', n1 - n0 === 2, 2, n1 - n0, '고급 설정 「형식 오류 재시도」 기본 1');
  const r2 = n1 - n0 >= 2 ? await llmAt(n0 + 1) : { messages: [] };
  writeReq(s, r2.messages, '(둘째 답도 <shelf> 없음)', '■ 다시 묻는 요청\n', r2.mode);
  const txt = await popupText();
  const st = await shopSt();
  check(s, '실패 안내 + 원문 보기, 상태는 안 받은 채(반쯤 저장 없음)', txt.includes('<shelf>') && txt.includes('원문 보기') && !st.loaded && !st.items.length, '안내', { txt: txt.slice(0, 160), loaded: st.loaded });
  const refreshOn = await page.evaluate(() => !document.querySelector('.sh-wrap [data-action="shop-refresh"]')?.disabled);
  check(s, '다시 받을 수 있게 새로고침 단추가 살아 있음', refreshOn, true, refreshOn);
  await queue(SHELF1);
  await click('shop-refresh');
  await waitIdle(); await sleep(300);
  const st2 = await shopSt();
  check(s, '새로고침 → 첫 진열로 받음 (정체 블록 요구한 첫 요청 꼴)', st2.loaded && st2.items.length === 6 && st2.identity.sells.includes('옛 책'), 6, st2.items.length);
  await closeShop();
  await saveState(s);
}

// 24 응답 실패: 빈 답 → 같은 요청 다시 (모델 오류 재시도) → 성공
{
  const s = step('갈래_빈답_재전송');
  await restore(chatBase());
  await settle(1);
  await queue('', SHELF1);
  const n0 = await llmCount();
  await openCard(CHAR1);
  await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 15000 }).catch(() => {});
  await sleep(500);
  const n1 = await llmCount();
  const st = await shopSt();
  check(s, '빈 답 → 같은 요청 다시 보내 성공 (호출 2회, 진열 6)', n1 - n0 === 2 && st.loaded && st.items.length === 6, { calls: 2, items: 6 }, { calls: n1 - n0, items: st.items.length }, 'host/llm.ts TRANSIENT (사용자 11-07)');
  await closeShop();
  await saveState(s);
}

// 25 문의 실패: 내 말 되돌림·칩 되살림 → 다시 보내면 한 줄만
{
  const s = step('갈래_문의실패_다시보내기');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  const id = await idOf('송연먹');
  await act('shop-ask', id);
  await queue({ type: 'fail', result: 'network error' });
  await say('이 먹은 어디서 났어요?');
  const st = await shopSt();
  const txt = await popupText();
  check(s, '실패하면 저장된 대화에서 내 말이 빠짐, 화면엔 보낸 말과 안내, 칩 되살아남', st.talk.length === 1 && txt.includes('이 먹은 어디서 났어요?') && txt.includes('묻기: 송연먹') && txt.includes('모델 요청에 실패'), { talk: 1, chip: true }, { talk: st.talk.length, chip: txt.includes('묻기: 송연먹') });
  await queue(ASK1);
  await say('이 먹은 어디서 났어요?');
  const st2 = await shopSt();
  check(s, '다시 보내면 내 말 한 줄 + 답', st2.talk.length === 3 && st2.talk.filter((l) => l.who === 'me').length === 1, 3, st2.talk.map((l) => l.who));
  await closeShop();
  await saveState(s);
}

// 26 연타: 구매 두 번 / 새로고침 두 번 / 보내기 두 번
{
  const s = step('갈래_연타');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  const id = await idOf('누런 부적지 묶음');
  await act('shop-detail', id);
  await page.evaluate(() => { const b = document.querySelector('.sh-det [data-action="shop-buy"]'); b.click(); b.click(); });
  await sleep(800);
  const w = await ledger();
  check(s, '구매 두 번 눌러도 한 번만 (잔고 9700, 거래 1)', w.bal === 9700 && w.log.length === 1 && (await items()).list.length === 1, { bal: 9700 }, { bal: w.bal, n: w.log.length });
  await queue(SHELF2, SHELF2);
  let n0 = await llmCount();
  await page.evaluate(() => { const b = document.querySelector('.sh-wrap [data-action="shop-refresh"]'); b.click(); b.click(); });
  await sleep(300); await waitIdle(); await sleep(300);
  check(s, '새로고침 두 번 눌러도 호출 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
  await queue(ASK1, HAGGLE1);
  n0 = await llmCount();
  await page.fill('[data-input="shop-say"]', '안녕하세요');
  await page.evaluate(() => { const b = document.querySelector('.sh-go'); b.click(); setTimeout(() => b.click(), 60); });
  await sleep(600); await waitIdle(); await sleep(400);
  const calls = (await llmCount()) - n0;
  const st = await shopSt();
  check(s, '보내기 두 번(60ms) 눌러도 호출 1회·내 말 1줄', calls === 1 && st.talk.filter((l) => l.who === 'me').length === 1, { calls: 1, me: 1 }, { calls, talk: st.talk.map((l) => `${l.who}:${l.text.slice(0, 10)}`) }, '점검지침 3-D 연타');
  await closeShop();
  await saveState(s);
}

// 27 답 기다리는 동안 창 닫기 → 답 도착 → 다시 열기
{
  const s = step('갈래_기다리는중_창닫기');
  await restore(chatBase());
  await settle(1);
  await page.evaluate(() => { window.__gate = new Promise((r) => { window.__open = r; }); });
  await queue(SHELF1);
  await openCard(CHAR1);
  await sleep(200);
  await closeShop();
  await page.evaluate(() => window.__open());
  await sleep(1200);
  const st = await shopSt();
  check(s, '닫은 뒤 도착한 답도 저장됨', st.loaded && st.items.length === 6, 6, st.items.length);
  const n0 = await llmCount();
  await openCard(CHAR1);
  check(s, '다시 열면 호출 없이 그 진열', (await llmCount()) === n0 && (await popupText()).includes('은 책갈피'), '호출 0', (await llmCount()) - n0);
  await closeShop();
  await saveState(s);
}

// 28 늦게 온 답 ①: 문의 답을 기다리는 동안 표식 없는 응답이 옴(가게를 떠남) → 늦은 답이 상태를 되살리지 않음
{
  const s = step('갈래_늦은답_가게떠난뒤');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  await page.evaluate(() => { window.__gate = new Promise((r) => { window.__open = r; }); });
  await queue(HAGGLE1);
  await page.fill('[data-input="shop-say"]', '송연먹 백오십에 안 될까요?');
  await page.click('.sh-go');
  await sleep(300);
  await closeShop();
  await mainRequest('그냥 나간다.', 'u2');
  await botReply(CHAR3, 'c2');
  await page.evaluate(() => window.__open());
  await sleep(1200);
  check(s, '가게를 떠난 뒤 늦게 온 답은 버림 (상태 없음)', !(await shopSt()), null, (await shopSt())?.shop);
  await saveState(s);
}

// 29 늦게 온 답 ②: 문의 답을 기다리는 동안 같은 가게 표식 응답이 옴 → 그 말이 다음 턴 본편에 가나
{
  const s = step('갈래_늦은답_같은가게_다음턴');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  await page.evaluate(() => { window.__gate = new Promise((r) => { window.__open = r; }); });
  await queue(HAGGLE1);
  await page.fill('[data-input="shop-say"]', '송연먹 백오십에 안 될까요?');
  await page.click('.sh-go');
  await sleep(300);
  await closeShop();
  const outA = await mainRequest('대답을 기다린다.', 'u2');
  writeReq(s, outA, undefined, '■ 답 오기 전에 보낸 본편 요청\n');
  await botReply(CHAR2, 'c2');
  await page.evaluate(() => window.__open());
  await sleep(1200);
  const st = await shopSt();
  check(s, '늦은 답 저장 (송연먹 150)', st?.items.find((x) => x.name === '송연먹')?.price === 150, 150, st?.items.find((x) => x.name === '송연먹')?.price);
  const out = await mainRequest('그럼 그 값에 사겠다고 적는다.', 'u3');
  writeReq(s, out, undefined, '■ 늦은 답 뒤 본편 요청\n', undefined, '_2');
  const tt = thisTurn(inventoryOf(out));
  const ttA = thisTurn(inventoryOf(outA));
  // 기대: 주인의 「백오십에 드리지요」는 앞 요청에 못 실렸으니(답 전) 다음 요청에 한 번 실려야 한다 (사용자 11-07 「이번 방문 대화 전부」를 다음 턴에)
  check(s, '주인의 늦은 답(백오십에 드리지요)이 본편에 한 번은 감', ttA.includes('백오십에 드리지요') || tt.includes('백오십에 드리지요'), '어느 한 요청에', { before: ttA, after: tt });
  await saveState(s);
}

// 30 본편 다시 굴리기: 산 다음 턴(c2)을 다시 굴림 → 구매·대화가 다시 한 번 실림
{
  const s = step('갈래_다음턴_다시굴리기');
  await restore(snaps.req2);
  await botReply(CHAR2, 'c2');
  await sleep(300);
  const out = await rerollRequest();
  writeReq(s, out);
  const tt = thisTurn(inventoryOf(out));
  check(s, '다시 굴린 요청에 구매 사건·대화가 한 번씩', (tt.match(/just bought/g) ?? []).length === 1 && (tt.match(/경상도/g) ?? []).length === 1, '한 번', tt.slice(0, 300), '점검지침 3-D 다시 굴리기');
  await botReply(CHAR2B, 'c2b');
  await sleep(300);
  const st = await shopSt();
  check(s, '새 응답(c2b)으로 상태 이어짐, 산 것은 그대로 팔림', st?.key === 'c2b' && st.items.every((x) => x.sold), { key: 'c2b' }, st && { key: st.key });
  const w = await ledger();
  check(s, '돈은 그대로 (구매는 c1 에 묶임)', w.bal === 2950, 2950, w.bal);
  await saveState(s);
}

// 31 본편 응답 지우기: 다시 연 방문(c2)에서 산 뒤 c2 를 지움 → 돈·진열 되돌림 → 다음 응답에서 다시 살 수 있나
{
  const s = step('갈래_산응답_지우기');
  await restore(snaps.req2);
  await botReply(CHAR2, 'c2');
  await sleep(300);
  await openCard(CHAR2);
  await queue(SHELF2);
  await click('shop-refresh'); await waitIdle(); await sleep(300);
  const id = await idOf('낡은 필사본');
  await click('shop-detail', id); await click('shop-buy', id);
  check(s, 'c2 방문에서 낡은 필사본 삼 (2950 → 2550)', (await ledger()).bal === 2550, 2550, (await ledger()).bal);
  await closeShop();
  await page.evaluate(() => { window.__chat.message.pop(); window.__chat.message.pop(); }); // c2, u2 지움
  const w = await ledger();
  // 화면 잔고 계산은 살아 있는 응답만 셈
  check(s, 'c2 를 지우면 그 구매는 셈에서 빠짐 (살아 있는 거래 합 2950)', w.log.filter((e) => e.anchor !== 'c2').reduce((n, e) => n + e.amount, w.start) === 2950, 2950, w.log.map((e) => `${e.amount}@${e.anchor}`));
  const html = await showCard();
  check(s, '지운 뒤 남은 마지막 응답(c1)에 상점 카드가 다시 보이나 (지난 표식은 지워져 있음)', html.includes('상점 열기'), '카드', html.includes('상점 열기'), '점검지침 4 「본편 응답 지우기: 다시 살 수 있나」');
  await mainRequest('다시 둘러본다.', 'u2x');
  await botReply(CHAR2, 'c2x');
  await sleep(300);
  await openCard(CHAR2);
  const txt = await popupText();
  check(s, '다음 응답에서 다시 열면 낡은 필사본을 다시 살 수 있음', txt.includes('낡은 필사본') && (await shopSt()).items.some((x) => x.name === '낡은 필사본' && !x.sold), '살 수 있음', txt.slice(0, 160));
  await closeShop();
  await saveState(s);
}

// 32 설정 끔 (방문 중): 카드·요청·다시 켬
{
  const s = step('갈래_설정끔');
  await restore(snaps.allBought);
  await closeShop();
  await setVars({ $sh_on: '0' });
  const html = await showCard(CHAR1);
  const hasCard = html.includes('상점 열기');
  let shown = '';
  if (hasCard) {
    await page.click('#chat-card [data-goei-shop]');
    await sleep(800);
    shown = await page.evaluate(() => ({ shop: !!document.querySelector('.sh-wrap'), win: document.querySelector('.gx')?.style.display !== 'none', text: (document.querySelector('.gx')?.innerText ?? '').slice(0, 80) }));
    await closeWin(page).catch(() => {});
  }
  // 기대: 상점이 꺼지면 카드가 눌려도 아무 일 없는 채로 남지 않는다 (core/shop.ts settleShop 주석 「카드가 남아 눌리지 않게」, 사용자 11-07 「상황판이 배경으로 뜨면 안 됨」)
  check(s, '끈 뒤 지금 응답의 카드가 남지 않음 (남으면 누를 때 상황판이 뜨지 않음)', !hasCard || (shown && !shown.win), '카드 없음 또는 눌러도 창 안 뜸', { hasCard, shown });
  const out = await mainRequest('나간다.', 'u2');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '끄면 본편 요청에 상점 표식 지침·상점 대화가 빠짐, 산 것 사건은 남음', !inv.includes('Shop tag:') && !inv.includes('talked with the owner') && inv.includes('just bought'), '표식 지침 없음 · 산 것 있음', { tag: inv.includes('Shop tag:'), talk: inv.includes('talked with'), bought: inv.includes('just bought') });
  await botReply(CHAR2, 'c2');
  check(s, '끈 채 표식 응답이 오면 표식 지우고 상태 비움', !(await shopSt()) && !(await page.evaluate(() => window.__chat.message.at(-1).data)).includes('[shop:'), '비움', (await shopSt())?.shop);
  await setVars({ $sh_on: '1' });
  const out2 = await mainRequest('다시 들어간다.', 'u3');
  check(s, '다시 켜면 표식 지침이 돌아옴', inventoryOf(out2).includes('Shop tag:'), '있음', inventoryOf(out2).includes('Shop tag:'));
  await saveState(s);
}

// 33 맥락 반영 끔 · 챗로그 턴 수 · 참조 로어북 수
{
  const s = step('갈래_맥락끔_턴수_로어북수');
  const base = chatBase({ $sh_ctx: '0' });
  base.message = [{ role: 'user', data: '첫 턴 글: 골목을 걷는다.', chatId: 'u0' }, { role: 'char', data: `골목 끝에 불 켜진 책방이 보였다.\n${ST('11:10 PM', '골목', 10000)}`, chatId: 'c0' }, ...base.message];
  await restore(base);
  await settle(3);
  await queue(SHELF1);
  let n0 = await llmCount();
  await openCard(CHAR1); await waitIdle();
  let r = await llmAt(n0); let all = joined(r);
  writeReq(s, r.messages, SHELF1, '■ 맥락 반영 끔\n', r.mode);
  check(s, '맥락 끔: 상태창·진행 중 괴이·최근 본문 없음, 가게 로어북은 있음', !all.includes('[상태창') && !all.includes('[최근 본문]') && !all.includes('[진행 중 괴이') && /Yijeong/.test(all), '없음', { st: all.includes('[상태창'), story: all.includes('[최근 본문]') });
  await closeShop();
  const b2 = JSON.parse(JSON.stringify(base)); b2.scriptstate.$sh_ctx = '1'; b2.scriptstate.$sh_turns = '1'; b2.scriptstate.$sh_refs = '0';
  await restore(b2); await settle(3);
  await queue(SHELF1);
  n0 = await llmCount();
  await openCard(CHAR1); await waitIdle();
  r = await llmAt(n0); all = joined(r);
  writeReq(s, r.messages, SHELF1, '■ 챗로그 1턴 · 참조 로어북 0\n', r.mode, '_2');
  check(s, '챗로그 1턴: 지난 턴 글(첫 턴 글) 없음', !all.includes('첫 턴 글') && all.includes('불이 켜진 걸 확인하고'), '1턴', all.includes('첫 턴 글'));
  const rel = (all.match(/\[관련 로어북: [^\]]*\]/g) ?? []);
  check(s, '참조 로어북 0: 관련 로어북 없음 (가게 이름에 걸린 것도 0 이면 빠짐)', rel.length === 0, 0, rel, '설정 「참조 로어북」 수');
  await closeShop();
  await saveState(s);
}

// 34 메인 모델 선택
{
  const s = step('갈래_메인모델');
  await restore(chatBase({ $sh_model: 'main' }));
  await settle(1);
  await queue(SHELF1);
  const n0 = await llmCount();
  await openCard(CHAR1); await waitIdle();
  const r = await llmAt(n0);
  check(s, '설정 「메인 모델」이면 mode model 로 감', r.mode === 'model', 'model', r.mode);
  await closeShop();
  await saveState(s);
}

// 35 상점 판단을 갱신기가 할 때
{
  const s = step('갈래_상점판단_갱신기');
  const c0 = chatBase({ $pp_on: '1', $sh_judge: 'auto' });
  c0.message[1] = { role: 'char', data: CHAR1.replace('\n[shop: 이정 책방|]', ''), chatId: 'c1' };
  c0.message.pop(); c0.message.pop();
  c0.message.push({ role: 'user', data: '불이 켜진 걸 확인하고 이정 책방 문을 연다.', chatId: 'u1' });
  await restore(c0);
  const out = await page.evaluate(async () => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const o = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
    return o.map((m) => ({ role: m.role, content: String(m.content) }));
  });
  writeReq(s, out, undefined, '■ 갱신기 판단일 때 본편 요청\n');
  const inv = inventoryOf(out);
  check(s, '갱신기가 판단하면 본편 요청에 상점 표식 지침(MAIN_TAG) 없음', !inv.includes('Shop tag:'), '없음', inv.includes('Shop tag:'), '설정 「상점 판단」 11-09');
  // 갱신기 가짜 답: shop_check.m 을 읽어 그 응답에 가게가 있다고 답한다
  await page.evaluate(() => {
    window.__updReq = null;
    window.__llmFn = (o) => {
      const sys = o.messages[0]?.content ?? '';
      if (!/shop_check/.test(sys) && !/shop_check/.test(o.messages.at(-1)?.content ?? '')) return null;
      window.__updReq = o.messages;
      let m = 'm1';
      try { m = JSON.parse(o.messages.at(-1).content).shop_check?.m ?? 'm1'; } catch { /* */ }
      return { type: 'success', result: JSON.stringify(window.__updShop === undefined ? { shop: { name: '이정 책방', owner: '', m } } : window.__updShop === 'omit' ? {} : { shop: window.__updShop }) };
    };
  });
  await botReply(CHAR1.replace('\n[shop: 이정 책방|]', ''), 'c1');
  await sleep(500);
  const upd = await page.evaluate(() => window.__updReq);
  if (upd) writeReq(s, upd, '{"shop":{"name":"이정 책방","owner":"","m":…}}', '■ 갱신기 요청\n', undefined, '_2');
  const updAll = (upd ?? []).map((m) => m.content).join('\n');
  check(s, '갱신기 요청에 상점 절(SHOP_RULE·SHOP_JUDGE)·shop_check', updAll.includes('shop_check') && updAll.includes('A shop = somewhere the protagonist can buy') && updAll.includes('Judge where the response ends'), '상점 절', { has: !!upd, rule: updAll.includes('A shop = somewhere') });
  const st = await shopSt();
  const last = await page.evaluate(() => window.__chat.message.at(-1).data);
  check(s, '갱신기 답대로 표식이 붙고 상태 생김 → 카드', st?.shop === '이정 책방' && last.includes('[shop: 이정 책방|]'), '이정 책방', { st: st?.shop, tail: last.slice(-30) });
  await queue(SHELF1);
  await openCard(); await waitIdle();
  await act('shop-detail', await idOf('송연먹')); await act('shop-buy', await idOf('송연먹'));
  await closeShop();
  await page.evaluate(() => { window.__updShop = undefined; });
  await mainRequest('계속 둘러본다.', 'u2');
  await botReply(CHAR2.replace('\n[shop: 이정 책방|]', ''), 'c2');
  await sleep(500);
  const st2 = await shopSt();
  check(s, '같은 가게로 다시 판단 → 방문 이어짐(산 것 그대로)', st2?.key === 'c2' && st2.items.some((x) => x.name === '송연먹' && x.sold), { key: 'c2' }, st2 && { key: st2.key });
  await page.evaluate(() => { window.__updShop = null; });
  await mainRequest('책방을 나간다.', 'u3');
  await botReply(CHAR3, 'c3');
  await sleep(500);
  check(s, '갱신기가 「상점 없음」(null) → 상태 비움', !(await shopSt()), null, (await shopSt())?.shop);
  await page.evaluate(() => { window.__llmFn = null; window.__updShop = undefined; });
  await saveState(s);
}

// 36 고유 상점·자기 가게 표식
{
  const s = step('갈래_고유상점_자기가게');
  const tagged = async (tag, extra = {}) => {
    const c = chatBase(extra);
    c.message[1] = { role: 'char', data: `${CHAR1.replace('\n[shop: 이정 책방|]', '')}\n${tag}`, chatId: 'c1' };
    await restore(c);
    await settle(1);
    const data = await page.evaluate(() => window.__chat.message[1].data);
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), data);
    return { st: await shopSt(), data, card: /data-goei-shop="([^"]*)"[^>]*>([^<]*)</.exec(html)?.slice(1) ?? null };
  };
  const cos = await tagged('[shop: 우주 쇼핑몰|@web]');
  check(s, '우주 쇼핑몰 @web → 접속 표식(@web:cos)·「접속하기」, 상점 방문 없음', !cos.st && cos.data.includes('@web:cos') && cos.card?.[1] === '접속하기', '접속하기', { st: cos.st?.shop, card: cos.card });
  const bm = await tagged('[shop: 임직원 복지몰|]');
  check(s, '「임직원 복지몰」(별칭 포함) → 포인트몰 접속 표식', !bm.st && bm.data.includes('@web:bm'), '@web:bm', { card: bm.card, tail: bm.data.slice(-40) }, '사용자 11-16 다르게 적어도 알아봄');
  const self = await tagged('[shop: 헐값매입|마덕희]', { $st_player: 'P047' });
  check(s, '주인공(마덕희) 자기 가게 → 상점 아님(표식 지움)', !self.st && !self.data.includes('[shop:'), '없음', { st: self.st?.shop, tail: self.data.slice(-40) }, '사용자 11-09 자기 가게는 상점 아님');
  await saveState(s);
}

// 37 포인트: 백일몽 소속이 아닌데 일반 상점이 포인트 가게로 정해짐 → 팔면 포인트가 생기나
{
  const s = step('갈래_포인트_비소속');
  await restore(snaps.req2);
  await botReply(`매점 안쪽 계산대에 백일몽 로고가 박힌 단말기가 있었다.\n${ST('11:40 PM', '백일몽 사내 매점', 2950)}\n[shop: 백일몽 사내 매점|]`, 'c2');
  await sleep(300);
  await queue(`<shop-identity>\nsells: 사내 복지 물품\nnever: 현금 거래\nprices: 백일몽 복지 포인트만 받는다\ncurrency: points\n</shop-identity>\n<owner>\n포인트로 결제됩니다.\n</owner>\n<shelf>\n탈모약|100|소모30|의료/약/medicine|0.002|백일몽 제약 탈모약||\n</shelf>`);
  await openCard(); await waitIdle();
  const st = await shopSt();
  const txt = await popupText();
  check(s, '(사실) 관리국 신입인데 이 가게가 포인트 가게가 됨', st?.identity?.points === true, '— 사실 기록', { points: st?.identity?.points, bal: /[\d,]+p/.exec(txt)?.[0] });
  await ensurePick();
  const a = (await items()).list.find((e) => e.name === '한지 노트');
  await click('shop-sell-pick', a.id);
  await queue(SELL_OFFER(500));
  await say('');
  await click('shop-sell');
  const pts = await ledger('$st_points');
  // 근거: 사용자 11-08 「포인트는 백일몽 소속일 때만·포인트몰에서만 사용·몰이 지급 X」「포인트몰: 팔기 X」, 「포인트는 각자 일해서 버는 것」
  check(s, '백일몽 소속이 아니면 상점에서 포인트가 생기지 않음', pts.bal === 0, 0, { bal: pts.bal, log: pts.log.map((e) => `${e.amount}:${e.memo}`) }, '사용자 11-08 포인트 결정 (goei-baekilmong-points)');
  await closeShop();
  const out = await mainRequest('나간다.', 'u3');
  writeReq(s, out);
  check(s, '(사실) 본편에 「just sold … Baekilmong points」', thisTurn(inventoryOf(out)), '— 사실 기록', thisTurn(inventoryOf(out)));
  await saveState(s);
}

// 39 같은 턴에 사고 바로 되팔기 → 본편에 산 일·판 일이 둘 다 한 번
{
  const s = step('갈래_사고바로되팔기');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  const id = await idOf('누런 부적지 묶음');
  await act('shop-detail', id); await act('shop-buy', id);
  await ensurePick();
  const a = (await items()).list.find((e) => e.name === '누런 부적지 묶음');
  await act('shop-sell-pick', a.id);
  await queue(SELL_OFFER(250));
  await say('');
  await act('shop-sell');
  await closeShop();
  const out = await mainRequest('책방을 나선다.', 'u2');
  writeReq(s, out);
  const tt = thisTurn(inventoryOf(out));
  // 근거: 점검지침 3-C 「사건(샀다·팔았다)은 그 턴 본편에 한 번」 — 산 일도 사건이다. 잔고는 300 빠지고 250 들어왔다
  check(s, '산 일(just bought)과 판 일(just sold)이 둘 다 한 번', /just bought[^;]*누런 부적지 묶음/.test(tt) && /just sold[^;]*누런 부적지 묶음/.test(tt), '둘 다', tt.slice(0, 300), '점검지침 3-C');
  check(s, '(사실) 잔고 10000 → 9950', (await ledger()).bal === 9950, 9950, (await ledger()).bal);
  await saveState(s);
}

// 40 쫓겨난 뒤 그 방문을 연 응답(c1)을 다시 굴림 → 산 것은 되살아나는데 쫓겨남은?
{
  const s = step('갈래_쫓겨난뒤_다시굴리기');
  await restore(snaps.shelf1);
  await openCard(CHAR1);
  const id = await idOf('송연먹');
  await act('shop-detail', id); await act('shop-buy', id);
  await queue(KICK1);
  await say('이딴 걸 누가 사요');
  await closeShop();
  const c = await snap();
  c.message[1] = { role: 'char', data: CHAR1, chatId: 'c1b' };
  await restore(c);
  await settle(1);
  const st = await shopSt();
  const w = await ledger();
  check(s, '(사실) c1 을 다시 굴리면 산 것은 되돌아감 (잔고 10000, 송연먹 다시 진열)', w.log.filter((e) => e.anchor !== 'c1').reduce((n, e) => n + e.amount, w.start) === 10000 && st.items.some((x) => x.name === '송연먹' && !x.sold), '되돌아감', { log: w.log.map((e) => `${e.amount}@${e.anchor}`), sold: st.items.filter((x) => x.sold).map((x) => x.name) });
  check(s, '(물을 것) 같은 응답에서 쫓겨난 것은 남는가', st.closed, '— 사실 기록', { closed: st.closed, talk: st.talk.length });
  await saveState(s);
}

// 38 페이지 새로고침 (저장 상태만으로 이어지나)
{
  const s = step('갈래_페이지새로고침');
  await restore(snaps.restocked);
  const saved = await snap();
  // 기준: 새로 띄우지 않은 같은 상태의 본편 요청
  const base = thisTurn(inventoryOf(await mainRequest('다시 둘러본다.', 'u3')));
  await start(saved, 'pc');
  const n0 = await llmCount();
  const { card } = await openCard(saved.message.at(-1).data);
  const txt = await popupText();
  check(s, '새로 띄워도 카드·진열(낡은 필사본)·대화가 그대로, 호출 없음', card && txt.includes('낡은 필사본') && txt.includes('새로 꺼낸 것입니다') && (await llmCount()) === n0, '그대로', { card, calls: (await llmCount()) - n0 });
  await closeShop();
  const out = await mainRequest('다시 둘러본다.', 'u3');
  const tt = thisTurn(inventoryOf(out));
  check(s, '새로 띄운 뒤 본편 요청의 This turn 이 새로 띄우지 않은 때와 같음', tt === base, base, tt);
  await saveState(s);
}
}

// ════════════════════════════ 폰 크기 갈래 ════════════════════════════
if (PART === 'all' || PART === 'phone') {
  await start(chatBase(), 'phone');
  {
    const s = step('폰_열기_사기_문의_팔기');
    await settle(1);
    await queue(SHELF1);
    const { card } = await openCard(CHAR1);
    await waitIdle(); await sleep(300);
    const st = await shopSt();
    check(s, '폰: 카드 눌러 열림, 진열 6', card && st.items.length === 6, 6, st?.items?.length);
    const vw = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, v: window.innerWidth }));
    check(s, '폰: 가로 넘침 없음', vw.w <= vw.v, vw.v, vw.w);
    const id = await idOf('송연먹');
    const okD = await click('shop-detail', id);
    const okB = await click('shop-buy', id);
    check(s, '폰: 물건 눌러 상세 → 구매', okD && okB && (await ledger()).bal === 9800, 9800, { okD, okB, bal: (await ledger()).bal });
    const okDr = await click('shop-drawer');
    check(s, '폰: 아래 [문의] → 서랍 열림', okDr && !!(await page.$('.sh-drawer')), '서랍', okDr);
    await queue(ASK1);
    await say('먹 말고 붓은 언제 들어와요?');
    const st2 = await shopSt();
    check(s, '폰: 서랍에서 말하기 → 주인 답', st2.talk.length === 3 && (await popupText()).includes('경상도'), 3, st2.talk.length);
    await click('shop-drawer').catch(() => {});
    if (await page.$('.sh-drawer')) await act('shop-drawer');
    const okP = await click('shop-pick');
    const a = (await items()).list[0];
    const okS = await click('shop-sell-pick', a.id);
    check(s, '폰: 아래 [판매] → 소지품 고름 → 서랍에 판매 칩', okP && okS && !!(await page.$('.sh-drawer')) && (await popupText()).includes('판매: 송연먹'), '칩', { okP, okS });
    await queue(SELL_OFFER(120));
    await say('');
    const okSell = await click('shop-sell');
    check(s, '폰: 값 받고 「판매」 → 잔고 9920', okSell && (await ledger()).bal === 9920, 9920, { okSell, bal: (await ledger()).bal });
    await saveState(s);
  }
}

writeFileSync(`${OUT}결과${PART === 'phone' ? '_폰' : ''}.json`, JSON.stringify({ results, pageErrors: errors }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과 · 단계 ${stepNo}${errors?.length ? ` · 페이지 오류 ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
