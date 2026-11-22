// 플레이 순서 점검 · 1. 상점 (지침: ../GPT_점검지침_초안.md 3판)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄우고, 화면 단추(data-action)를 눌러 플레이 순서대로 간다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 사용법: npm run release:prep -- --skip-tests  →  node 인수인계/플레이순서_점검/1_상점/run.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 장면: 로어북 「이정 책방」(주인 이름 없음 — 구슬발 뒤 손만 보이는 존재, 손글씨로만 말함) ──
const STATUS1 = '[▣|2025.03.14|11:20 PM|🌙|6°C|이정 책방|없음|없음|없음|관리국/신입|1000]';
const CHAR1 = '불이 켜진 책방 유리문을 밀자 책갈피 풍경이 맑게 울렸다. 계산대 너머 구슬발 사이로 하얀 손 하나가 나와 쪽지를 내밀었다. 「어서 오십시오.」\n' + STATUS1 + '\n[shop: 이정 책방|]';
const CHAR2 = '쪽지를 받아 든 손이 잠시 머뭇거리다 고개를 끄덕이듯 구슬발을 흔들었다. 책방 안은 여전히 조용했다.\n' + STATUS1.replace('11:20 PM', '11:34 PM').replace('|1000]', '|500]') + '\n[shop: 이정 책방|]';
const CHAR3 = '책방을 나서자 풍경이 한 번 더 울렸다. 골목은 어두웠다.\n' + STATUS1.replace('11:20 PM', '11:50 PM').replace('|이정 책방|', '|이정 책방 앞 골목|').replace('|1000]', '|750]');

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
송연먹|200|소모20|소모품/먹/ink stick|0.004|그을음 냄새가 진한 먹|
</shelf>`;
const SHELF2 = `<owner>
새로 꺼낸 것입니다.
</owner>
<shelf>
낡은 필사본|400|-|서류/책/book|0.42|표지가 없는 손 필사본|
</shelf>`;
const TALK1 = `<owner>
그 값이면 드리겠습니다.
</owner>
<change mode="partial">
~ 낡은 필사본|350
</change>`;
const SHELF3 = `<owner>
오늘은 이것뿐입니다.
</owner>
<shelf>
은 책갈피|500|-|귀중품/책갈피/bookmark|0.018|가장자리가 닳은 은 책갈피|
</shelf>`;
const SELL1 = `<owner>
이백오십이면 받겠습니다.
</owner>
<change mode="none">
</change>
<offer>250</offer>`;
const SELL2 = `<owner>
그럼 놓고 가십시오. 값은 여기 있습니다.
</owner>
<change mode="none">
</change>
<offer>250</offer>
<deal/>`;

const results = [];
let stepNo = 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
/** 기대값 비교: 실행 전에 적은 기대값(expect)과 실제값(actual) */
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');

const b = await launch();
const chat0 = {
  message: [{ role: 'user', data: '불이 켜진 걸 확인하고 이정 책방 문을 연다.', chatId: 'u1' }, { role: 'char', data: CHAR1, chatId: 'c1' }],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 1000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) },
};
const { page, errors } = await boot(b, fx, chat0, 'pc', { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });

const vars = () => page.evaluate(() => window.__chat.scriptstate);
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
const shopSt = async () => J(await vars(), '$st_shop');
const balance = async () => { const w = J(await vars(), '$st_wallet'); return { start: w.start, log: w.log, bal: w.start + w.log.reduce((n, e) => n + e.amount, 0) }; };
const items = async () => J(await vars(), '$st_items');
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => /^\$st_(shop|shop_last|wallet|items)$/.test(k)).map(([k, v]) => [k, J({ v }, 'v')])), messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2));
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => ({ type: 'success', result: r })); }, t);
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
const waitIdle = () => page.waitForFunction(() => !document.querySelector('.sh-spin') && !document.querySelector('.sh-dlg-box .dim:last-child')?.textContent?.includes('…'), null, { timeout: 10000 }).catch(() => {});
const popupText = () => page.evaluate(() => document.querySelector('.sh-wrap')?.innerText ?? '');
const say = async (text) => {
  await page.evaluate((t) => { const i = document.querySelector('[data-input="shop-say"]'); if (i) { i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); } }, text);
  await act('shop-say', text);
  await waitIdle(); await sleep(300);
};
/** 본편 요청: 유저 메시지를 채팅에 넣고 beforeRequest 를 돌린다 (실제 Risu 처럼 요청 배열 마지막이 그 유저 메시지) */
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
/** 본편 응답이 붙음 → output 리스너 */
const botReply = async (text, cid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]);
const openCard = async (charText) => {
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), charText);
  await page.evaluate((h) => { document.getElementById('chat-card')?.remove(); const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate((t) => window.__calls.handlers.display(t), charText);
  const has = await page.$('#chat-card [data-goei-shop]');
  if (has) await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.sh-wrap'), null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  return { html, card: !!has };
};
const writeReq = (s, msgs, reply, extra = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const inventoryOf = (out) => out.find((m) => m.role === 'system' && m.content.includes('[Inventory]'))?.content ?? '';

// 본체를 띄운다 (응답 처리기는 본체가 떠 있어야 돈다)
await openWin(page); await sleep(300);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await closeWin(page); await sleep(200);

// ── 00 응답 처리: 표식 → 상점 상태 ──
{
  const s = step('표식_응답처리');
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  const st = await shopSt();
  check(s, '표식으로 상점 상태가 생김 (가게 이정 책방, 주인 빈칸, 기준 c1)', st?.shop === '이정 책방' && st?.owner === '' && st?.key === 'c1', { shop: '이정 책방', owner: '', key: 'c1' }, st && { shop: st.shop, owner: st.owner, key: st.key });
  const msg1 = await page.evaluate(() => window.__chat.message[1].data);
  check(s, '저장 본문엔 이번 응답 표식이 남는다(카드용)', msg1.includes('[shop: 이정 책방|]'), '표식 남음', msg1.slice(-40));
  await saveState(s);
}

// ── 01 카드에서 「상점 열기」 → 첫 진열 요청 ──
const ids = {};
{
  const s = step('열기_첫진열');
  await queue(SHELF1);
  const n0 = await llmCount();
  const { card } = await openCard(CHAR1);
  await waitIdle(); await sleep(300);
  check(s, '응답 아래 「상점 열기」 카드가 뜸', card, true, card);
  const n1 = await llmCount();
  check(s, '보조 호출 1회', n1 - n0 === 1, 1, n1 - n0);
  const msgs = n1 > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, SHELF1);
  const all = msgs.map((m) => m.content).join('\n');
  check(s, '요청에 가게 로어북(이정 책방) 본문이 들어감', /Yijeong Bookstore/.test(all), 'Yijeong Bookstore 글', /Yijeong/.test(all));
  check(s, '요청에 지금 장소·시각(상태창 줄)이 들어감', all.includes('11:20 PM') && all.includes('이정 책방'), '11:20 PM · 이정 책방', all.includes('11:20 PM'));
  check(s, '요청에 최근 본문이 들어감', all.includes('구슬발'), '구슬발', all.includes('구슬발'));
  check(s, '잔고(1000)를 상점 모델에 넘기지 않음 (11-08 설정 「넘기는 것·남는 것」)', !/\|1000\]/.test(all), '잔고 칸 없음', /\|1000\]/.test(all));
  const sit = /\[진행 중 괴이·사건\]\n([\s\S]*?)\n\n/.exec(all)?.[1] ?? '';
  // 기대 바꿈: 진행 중 괴이·사건 칸의 NEW 줄(자리표째)은 그대로 둔다 (사용자 11-22 21:51 「상관없음」, 재검토 상점 문제3) → 칸이 상황판 브리핑을 받는지만 본다
  check(s, '진행 중 괴이·사건 칸이 상황판 브리핑을 받음(NEW 줄은 사용자 결정으로 그대로 둠)', sit.length > 0, '칸 있음', sit);
  check(s, '첫 방문 지시(FIRST) 와 정체 블록 요구가 있음', all.includes('<shop-identity>') && all.includes('First visit'), 'FIRST 절', all.includes('First visit'));
  const st = await shopSt();
  for (const x of st?.items ?? []) ids[x.name] = x.id;
  check(s, '진열 2개(누런 부적지 묶음 300, 송연먹 200)', st?.loaded && st.items.length === 2 && st.items.find((x) => x.name === '누런 부적지 묶음')?.price === 300, 2, st?.items?.map((x) => `${x.name}:${x.price}`));
  check(s, '주인 첫 말이 대화에 남음', st?.talk?.[0]?.text?.includes('어서 오십시오'), '어서 오십시오', st?.talk);
  await saveState(s);
}
const snapShelf1 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));

// ── 02 A·B 차례로 사기 ──
let snapAfterBuy;
{
  const s = step('A_B_사기');
  await act('shop-detail', ids['누런 부적지 묶음']);
  await act('shop-buy', ids['누런 부적지 묶음']);
  await act('shop-detail', ids['송연먹']);
  await act('shop-buy', ids['송연먹']);
  await sleep(300);
  const w = await balance();
  const it = await items();
  const st = await shopSt();
  check(s, '잔고 1000 → 500', w.bal === 500, 500, w.bal);
  check(s, '가계부 구매 거래 2건(각 -300, -200, 기준 c1)', w.log.filter((e) => e.src === 'store').length === 2 && w.log.some((e) => e.amount === -300) && w.log.some((e) => e.amount === -200) && w.log.every((e) => e.anchor === 'c1'), ['-300 c1', '-200 c1'], w.log.map((e) => `${e.amount} ${e.anchor}`));
  check(s, '소지품에 각 1개 (from store, 기준 c1)', it.list.length === 2 && it.list.every((e) => e.from === 'store' && e.anchor === 'c1'), 2, it.list.map((e) => `${e.name} ${e.from} ${e.anchor}`));
  check(s, '진열대 두 물건 모두 팔림 표시', st.items.every((x) => x.sold), 'sold 둘', st.items.map((x) => `${x.name}:${!!x.sold}`));
  const txt = await popupText();
  check(s, '빈 진열대 안내가 보임', txt.includes('진열대가 비었어요'), '진열대가 비었어요', txt.slice(0, 200));
  await saveState(s);
  snapAfterBuy = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
}

// ── 03 빈 진열대에서 바로 새로고침 (가짜 답을 돌려주기 전에 요청 글 검사) ──
{
  const s = step('바로_새로고침');
  await queue(SHELF2);
  const n0 = await llmCount();
  await act('shop-refresh');
  await waitIdle(); await sleep(300);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, SHELF2);
  const all = msgs.map((m) => m.content).join('\n');
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '「다시 내지 말 것」 목록에 A·B 둘 다', avoid.includes('누런 부적지 묶음') && avoid.includes('송연먹'), ['누런 부적지 묶음', '송연먹'], avoid);
  check(s, '이번 방문 대화(주인 첫 말)를 같이 넘김', all.includes('[이번 방문 대화]') && all.includes('어서 오십시오'), '[이번 방문 대화]', all.includes('[이번 방문 대화]'));
  check(s, '정체 고정 블록이 들어감(다시 정하지 않음)', all.includes('[가게 정체 — 고정]') && !all.includes('First visit'), '고정 정체, FIRST 없음', all.includes('[가게 정체 — 고정]'));
  const st = await shopSt();
  check(s, '새 진열(C 낡은 필사본) + 산 물건은 팔림으로 남음', st.items.filter((x) => !x.sold).map((x) => x.name).join() === '낡은 필사본' && st.items.filter((x) => x.sold).length === 2, '진열 C, sold 2', st.items.map((x) => `${x.name}:${!!x.sold}`));
  await saveState(s);
}

// ── 04 C 흥정 ──
{
  const s = step('C_흥정');
  await act('shop-detail', (await shopSt()).items.find((x) => x.name === '낡은 필사본').id);
  await act('shop-ask', (await shopSt()).items.find((x) => x.name === '낡은 필사본').id);
  await queue(TALK1);
  const n0 = await llmCount();
  await say('삼백오십에 안 될까요?');
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, TALK1);
  const all = msgs.map((m) => m.content).join('\n');
  check(s, '지금 진열대에 C(400)가 있음', /\[지금 진열대\]\n낡은 필사본\|400/.test(all), '낡은 필사본|400', /\[지금 진열대\][^\[]*/.exec(all)?.[0]);
  check(s, '이번 방문에 산 것(A·B)을 알려 줌', /\[이번 방문에 산 것\]\n누런 부적지 묶음, 송연먹/.test(all), '누런 부적지 묶음, 송연먹', /\[이번 방문에 산 것\][^\[]*/.exec(all)?.[0]);
  check(s, '마지막 줄이 방금 한 말(묻는 물건 표시 포함)', /\[주인공\] \[낡은 필사본\] 삼백오십에 안 될까요\?\s*$/.test(msgs.at(-1)?.content ?? ''), '[주인공] [낡은 필사본] 삼백오십에 안 될까요?', (msgs.at(-1)?.content ?? '').slice(-80));
  const st = await shopSt();
  const c = st.items.find((x) => x.name === '낡은 필사본');
  check(s, 'C 값 350, 원래 값 400 기록', c?.price === 350 && c?.orig === 400, { price: 350, orig: 400 }, c && { price: c.price, orig: c.orig });
  await saveState(s);
}

// ── 05 다음 턴 본편 요청 ──
{
  const s = step('다음턴_본편요청');
  await act('shop-close');
  const out = await mainRequest('필사본은 다음에 사기로 하고 쪽지에 감사 인사를 적는다.', 'u2');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '[Inventory] 블록이 있음', !!inv, '있음', !!inv);
  check(s, '구매 사건(방금 산 것) 줄에 A·B', /just bought[^;\n]*누런 부적지 묶음[^;\n]*송연먹|just bought[^;\n]*송연먹[^;\n]*누런 부적지 묶음/.test(inv), 'just bought 누런 부적지 묶음, 송연먹', /This turn:[^\n]*/.exec(inv)?.[0]);
  check(s, '소지품 목록에 A·B', /^- 누런 부적지 묶음/m.test(inv) && /^- 송연먹/m.test(inv), '목록 두 줄', inv.split('\n').filter((l) => l.startsWith('- ')));
  check(s, '이번 턴에 주인과 나눈 말이 넘어감', inv.includes('삼백오십') && inv.includes('그 값이면 드리겠습니다'), '대화 포함', /이정 책방[^\n]*/.exec(inv)?.[0]);
  check(s, '상점 표식 지침이 붙음(다음 응답도 같은 가게면 표식)', inv.includes('[shop: 가게 이름|주인 이름]'), 'MAIN_TAG', inv.includes('[shop:'));
  await saveState(s);
}

// ── 06 같은 가게 표식으로 응답 → 그다음 턴 본편 요청 ──
{
  const s = step('그다음턴_본편요청');
  await botReply(CHAR2, 'c2');
  await sleep(300);
  const st = await shopSt();
  check(s, '같은 가게: 상태가 이어지고 기준만 c2 로', st?.key === 'c2' && st.items.length === 3, { key: 'c2', items: 3 }, st && { key: st.key, items: st.items.length });
  const out = await mainRequest('필사본 값을 다시 묻는다.', 'u3');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '구매 사건이 다시 나오지 않음', !/just bought/.test(inv), 'just bought 없음', /This turn:[^\n]*/.exec(inv)?.[0] ?? '(This turn 없음)');
  check(s, '소지품 목록엔 A·B 가 계속 있음', /^- 누런 부적지 묶음/m.test(inv) && /^- 송연먹/m.test(inv), '목록 두 줄', inv.split('\n').filter((l) => l.startsWith('- ')));
  check(s, '지난 턴 대화가 되풀이되지 않음', !inv.includes('삼백오십'), '대화 없음', inv.includes('삼백오십'));
  await saveState(s);
}

// ── 07 다시 열기 → 새로고침 (다시 들어온 뒤에도 산 것을 피하나) ──
{
  const s = step('다시열기_새로고침');
  const { card } = await openCard(CHAR2);
  check(s, '다시 열면 카드가 있고 진열대가 그대로(C)', card && (await popupText()).includes('낡은 필사본'), 'C 보임', (await popupText()).slice(0, 120));
  await queue(SHELF3);
  const n0 = await llmCount();
  await act('shop-refresh');
  await waitIdle(); await sleep(300);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, SHELF3);
  const all = msgs.map((m) => m.content).join('\n');
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '피할 목록에 A·B·C 모두', ['누런 부적지 묶음', '송연먹', '낡은 필사본'].every((x) => avoid.includes(x)), ['누런 부적지 묶음', '송연먹', '낡은 필사본'], avoid);
  check(s, '이번 방문 대화에 지난 턴 흥정도 들어감(같은 방문)', all.includes('삼백오십'), '삼백오십', all.includes('삼백오십'));
  await saveState(s);
}

// ── 08 팔기: A 를 내밀기 → 값 → 말로 수락 ──
{
  const s = step('팔기_말로수락');
  const it = await items();
  const a = it.list.find((e) => e.name === '누런 부적지 묶음');
  await act('shop-pick');
  await act('shop-sell-pick', a.id);
  await queue(SELL1);
  let n0 = await llmCount();
  await say('');
  let msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, SELL1, '■ 첫 요청: 물건만 내밀기\n');
  let all = msgs.map((m) => m.content).join('\n');
  check(s, '팔기 지시(SELL)와 팔려는 물건 칸이 있음', all.includes('[팔려는 물건') && all.includes('누런 부적지 묶음'), 'SELL', all.includes('[팔려는 물건'));
  check(s, '산 값(300)을 알려 줌', all.includes('bought earlier for 300 won'), '300', /bought earlier[^\n]*/.exec(all)?.[0]);
  check(s, '남은 횟수(10)를 알려 줌', /누런 부적지 묶음\|[^\n]*10/.test(all), '소모10', /\[팔려는 물건[^\n]*\n[^\n]*/.exec(all)?.[0]);
  let st = await shopSt();
  check(s, '부른 값 250 이 상태에', st.sell?.price === 250, 250, st.sell);
  await queue(SELL2);
  n0 = await llmCount();
  await say('그 값에 팔겠습니다.');
  msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeFileSync(`${OUT}단계${s.n}_${s.name}_2.txt`, `■ 둘째 요청: 말로 수락\n${fmtMsgs(msgs)}\n\n════ 넣은 가짜 답 ════\n${SELL2}\n`);
  all = msgs.map((m) => m.content).join('\n');
  check(s, '둘째 요청에 지난번 부른 값(250)이 들어감', all.includes('your last offer: 250 won'), '250', /your last offer[^\n]*/.exec(all)?.[0]);
  const w = await balance();
  const it2 = await items();
  st = await shopSt();
  check(s, '말로 수락 → 판매 완료: 잔고 500 → 750', w.bal === 750, 750, w.bal);
  check(s, '소지품에서 A 빠짐(판매 기록)', !it2.list.some((e) => e.id === a.id && !e.outHow && !e.soldAt) || it2.log.some((l) => l.what === 'sell' && l.name === '누런 부적지 묶음'), 'sell 기록', it2.log.map((l) => `${l.what}:${l.name}`));
  check(s, '판 것 목록에 A 250', st.sales?.some((x) => x.name === '누런 부적지 묶음' && x.price === 250) && !st.sell, 'sales A 250', { sales: st.sales, sell: st.sell });
  await saveState(s);
}

// ── 09 나가기 → 다음 턴 본편 요청 ──
{
  const s = step('나가기_다음턴');
  await act('shop-close');
  const out = await mainRequest('인사하고 책방을 나간다.', 'u4');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '판 사건 한 번(A 250)', (inv.match(/누런 부적지 묶음 \(250/g) ?? []).length === 1, 1, /This turn:[^\n]*/.exec(inv)?.[0]);
  check(s, '소지품 목록에 A 없음, B 있음', !/^- 누런 부적지 묶음/m.test(inv) && /^- 송연먹/m.test(inv), 'B 만', inv.split('\n').filter((l) => l.startsWith('- ')));
  await botReply(CHAR3, 'c3');
  await sleep(300);
  const st = await shopSt();
  check(s, '표식 없는 응답 → 상점 상태 비움', !st, null, st && st.shop);
  const out2 = await mainRequest('골목을 걷는다.', 'u5');
  const inv2 = inventoryOf(out2);
  writeFileSync(`${OUT}단계${s.n}_${s.name}_2.txt`, fmtMsgs(out2));
  check(s, '그다음 턴엔 판 사건이 다시 안 나옴', !inv2.includes('누런 부적지 묶음 (250'), '없음', /This turn:[^\n]*/.exec(inv2)?.[0] ?? '(This turn 없음)');
  await saveState(s);
}

// ── 10 갈래: 사고 바로 다음 턴으로 → 다시 열기 → 새로고침 (03 과 비교) ──
{
  const s = step('갈래_사고바로다음턴_재진입_새로고침');
  await page.evaluate((c) => { window.__chat = c; }, snapAfterBuy);
  await act('shop-close');
  await mainRequest('계산을 마치고 주위를 둘러본다.', 'u2');
  await botReply(CHAR2, 'c2');
  await sleep(300);
  const { card } = await openCard(CHAR2);
  check(s, '다시 열면 빈 진열대', card && (await popupText()).includes('진열대가 비었어요'), '진열대가 비었어요', (await popupText()).slice(0, 120));
  await queue(SHELF2);
  const n0 = await llmCount();
  await act('shop-refresh');
  await waitIdle(); await sleep(300);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, SHELF2);
  const all = msgs.map((m) => m.content).join('\n');
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '재진입 뒤에도 피할 목록에 A·B', avoid.includes('누런 부적지 묶음') && avoid.includes('송연먹'), ['누런 부적지 묶음', '송연먹'], avoid);
  await saveState(s);
}

// ── 11 갈래: 산 턴의 본편 응답을 다시 굴림 → 돈·소지품·진열대가 같이 돌아오나 ──
{
  const s = step('갈래_산턴_다시굴리기');
  const c = JSON.parse(JSON.stringify(snapAfterBuy));
  // 다시 굴리기: 같은 자리 응답이 새 chatId 로 바뀐다 (Risu)
  c.message[1] = { role: 'char', data: CHAR1, chatId: 'c1b' };
  await page.evaluate((c) => { window.__chat = c; }, c);
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  const w = await balance();
  check(s, '잔고 1000 으로 돌아옴(그 응답에 묶인 구매 거래가 죽음)', w.bal === 1000 || w.log.every((e) => e.anchor === 'c1') && w.start + 0 === 1000, 1000, { log: w.log.map((e) => `${e.amount} ${e.anchor}`) });
  const { card } = await openCard(CHAR1);
  const txt = await popupText();
  check(s, '진열대에 A·B 가 다시 살 수 있게 보임', card && txt.includes('누런 부적지 묶음') && txt.includes('송연먹'), 'A·B 보임', txt.slice(0, 200));
  const bal = await page.evaluate(() => document.querySelector('.sh-bal')?.textContent ?? '');
  check(s, '화면 잔고 1,000', bal.replace(/[^\d]/g, '') === '1000', '1,000', bal);
  await saveState(s);
}

// ── 13 갈래: 아무것도 안 사고 바로 새로고침 (지금 진열대를 피하나) ──
{
  const s = step('갈래_안사고_바로새로고침');
  await act('shop-close');
  await page.evaluate((c) => { window.__chat = c; }, snapShelf1);
  await openCard(CHAR1);
  // 고친 뒤(26edc4a, 사용자 11-22 「새로고침해도 같은 물건」): 지금 진열과 모두 겹친 답은 버리고 설정 「재시도」대로 다시 묻는다 → 둘째 답(겹치지 않는 진열)을 줄에 세워 둔다
  await queue(SHELF1.replace(/<shop-identity>[\s\S]*?<\/shop-identity>\n/, ''), SHELF2);
  const n0 = await llmCount();
  await act('shop-refresh');
  await waitIdle(); await sleep(300);
  const nCalls = (await llmCount()) - n0;
  const msgs = nCalls > 0 ? await llmAt(n0) : [];
  writeReq(s, msgs, '(같은 물건 A·B 를 다시 낸 답 → 다시 물어 둘째 답: 낡은 필사본)');
  const all = msgs.map((m) => m.content).join('\n');
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '피할 목록(또는 지금 진열대)에 지금 걸린 A·B 가 들어감', avoid.includes('누런 부적지 묶음') && avoid.includes('송연먹') || /\[지금 진열대\][\s\S]*누런 부적지 묶음/.test(all), ['누런 부적지 묶음', '송연먹'], avoid || '(피할 목록 절이 아예 없음)');
  const st = await shopSt();
  check(s, '모델이 같은 물건을 또 내면 버리고 다시 물음(호출 2회)', nCalls === 2, 2, nCalls);
  check(s, '다시 물은 둘째 진열(낡은 필사본)이 화면 진열대에 뜸', st.items.filter((x) => !x.sold).map((x) => x.name).join() === '낡은 필사본', '낡은 필사본', st.items.map((x) => x.name));
  await saveState(s);
}

writeFileSync(`${OUT}결과.json`, JSON.stringify({ commit: process.env.GIT_COMMIT ?? '', results, pageErrors: errors }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과${errors.length ? ` · 페이지 오류 ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
