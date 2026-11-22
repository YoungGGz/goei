// 플레이 순서 점검 · 2. 우주 쇼핑몰 + 3. 백일몽 포인트몰 (지침: ../GPT_점검지침_초안.md 3판, 틀은 ../1_상점/run.mjs 와 같음)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄우고, 화면 단추(data-action)를 눌러 플레이 순서대로 간다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 사용법: npm run release:prep -- --skip-tests  →  node 인수인계/플레이순서_점검/2_몰/run.mjs
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
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ════════════════ 2. 우주 쇼핑몰 ════════════════
// 장면: 로어북 「관리국」 소속 신입이 숙소에서 휴대폰으로 사이트를 연다. 우주 쇼핑몰은 로어북 「우주 쇼핑몰」(가게 이름만, 운영자 이름 없음).
// 잔고 10,000,000원 (우주몰 값은 100만 원부터: 지침 COMMON).
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
const COS_SELL1 = `<owner>
삼십만. 우리는 그 이상 아니다.
</owner>
<change mode="none">
</change>
<offer>300000</offer>`;

// ════════════════ 3. 백일몽 포인트몰 ════════════════
// 장면: 로어북 「백일몽」 본사(서울 강남구). 신분 백일몽/사원, 포인트 5,000p. 사내 계정 「토끼」로 로그인.
const BST = (time, points, ident = '백일몽/사원') => `[▣|2025.04.02|${time}|☀️|12°C|백일몽 본사|없음|없음|없음|${ident}|140000|${points}]`;
const B1 = `점심시간, 사원증을 찍고 사내망에 접속했다. 복지몰 배너가 반짝였다.\n${BST('12:10 PM', 5000)}`;
const B2 = `오후 업무가 시작됐다. 책상 위 모니터에 결재 알림이 쌓여 있었다.\n${BST('01:30 PM', 3800)}`;
const B3 = `퇴근 무렵, 보안팀 대여창고 앞 복도는 한산했다.\n${BST('06:10 PM', 3800)}`;
const B4 = `야근이 길어졌다. 대여창고는 이미 문을 닫았다는 공지가 떴다.\n${BST('09:40 PM', 3000)}`;
const BM_SHELF1 = `<shop-identity>
sells: 임직원 복지 물품, 가전, 건강 용품, 현장 탐사 보급품
never: 현금 교환, 외부 반출 기밀품
prices: 백일몽 복지 포인트만, 정가
currency: points
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
const DESK_MAKE = `<card>
이름: 김하영
직급: 주임
부서: 인사팀
소개: 내근 4년 차, 월급만큼만 일한다
말투: 짧고 사무적인 존댓말
</card>
<say>안녕하세요. 포인트몰 상담입니다. 무엇을 도와드릴까요?</say>`;
const DESK_TALK = `<say>네, 응급 키트에는 붕대와 소독약이 들어 있어요.

수령은 본사 대여창고에서 하시면 됩니다.</say>`;

const results = [];
let stepNo = 0;
let part = '';
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name: `${part}${name}` }; };
/** 기대값 비교: 실행 전에 적은 기대값(expect)과 실제값(actual) */
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
const notes = [];
/** 판정 없이 본 것만 적는다 (기대값 근거가 없는 것) */
function note(s, what, actual) { notes.push({ step: `${s.n} ${s.name}`, what, actual }); console.log(`NOTE [${s.n} ${s.name}] ${what}: ${JSON.stringify(actual)?.slice(0, 300)}`); }
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const inventoryOf = (out) => out.find((m) => m.role === 'system' && m.content.includes('[Inventory]'))?.content ?? '';
const thisTurn = (inv) => /This turn:[^\n]*/.exec(inv)?.[0] ?? '';

const b = await launch();
let page; let errors;
const allErrors = [];

const vars = () => page.evaluate(() => window.__chat.scriptstate);
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
const bal = async (k = '$st_wallet') => { const w = J(await vars(), k); return w ? w.start + w.log.reduce((n, e) => n + e.amount, 0) : null; };
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
/** 보조 호출 n 개가 끝날 때까지 (답 처리·저장까지 조금 더) */
const waitLlm = async (n0, k = 1) => { await page.waitForFunction(([n0, k]) => (window.__calls.llm || []).length >= n0 + k, [n0, k], { timeout: 15000 }).catch(() => {}); await sleep(1100); };
const screen = () => page.evaluate(() => document.querySelector('.ms')?.innerText ?? '');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const KEEP = /^\$(st_(wallet|items|points|item_use)|cos_(shop|shop_note|shop_at|orders)|bm_(shop|shop_note|orders|desk))$/;
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => KEEP.test(k)).map(([k, v]) => [k, J({ v }, 'v') ?? v])), messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2));
/** 본편 요청: 유저 메시지를 채팅에 넣고 beforeRequest 를 돌린다 */
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
/** 본편 요청을 미리 보기만 (채팅·상태는 원래대로 되돌린다) */
const peekMain = async (userText) => { const c = await snap(); const out = await mainRequest(userText, 'peek'); await page.evaluate((c) => { window.__chat = c; }, c); return out; };
/** 본편 응답이 붙음 → output 리스너 */
const botReply = async (text, cid) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(500); };
/** 창을 다시 열고 그 사이트로 (채팅을 새로 읽는다) */
const openSite = async (site) => {
  await closeWin(page); await sleep(200);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await act('nav-tab', 'net');
  if (!(await page.$(`.ms-${site}`))) await act('br-go', site, 600);
};
const bootChat = async (chat0) => {
  if (page) { allErrors.push(...errors); await page.close(); }
  ({ page, errors } = await boot(b, fx, chat0, 'pc', { store: STORE }));
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
};
const allText = (msgs) => msgs.map((m) => m.content).join('\n');
const sit = (all) => /\[진행 중 괴이·사건\]\n([\s\S]*?)(\n\n|$)/.exec(all)?.[1] ?? '';

// ───────────────────────── 우주 쇼핑몰 ─────────────────────────
part = '우주_';
await bootChat({
  message: [{ role: 'user', data: '숙소에 돌아와 쉰다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $cos_fixed: '[]', $st_wallet: JSON.stringify({ start: 10000000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) },
});
await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
await sleep(400);

// 01 사이트 열기 (자동 호출 기본 「수동」)
{
  const s = step('열기_수동');
  const n0 = await llmCount();
  await openSite('cos');
  await sleep(500);
  const txt = await screen();
  check(s, '자동 호출 기본 「수동」: 열어도 보조 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0, '설정 기본값 manual (core/malls.ts mallSettings)');
  check(s, '빈 진열 안내 + 「상품 가져오기」 단추', txt.includes('아직 없다 상품') && !!(await page.$('.ms [data-action="mall-refresh"]')), '아직 없다 상품, 진열대에.', txt.slice(0, 200));
  await saveState(s);
}

// 02 상품 가져오기 → 첫 진열 요청
const ids = {};
{
  const s = step('첫진열');
  await queue(COS_SHELF1);
  const n0 = await llmCount();
  await act('mall-refresh', '');
  await waitLlm(n0);
  const n1 = await llmCount();
  check(s, '보조 호출 1회', n1 - n0 === 1, 1, n1 - n0);
  const msgs = n1 > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, COS_SHELF1);
  const all = allText(msgs);
  check(s, '우주몰 지침 COMMON(왈도체·외계 언급 금지)', all.includes('cosmic-mall.alien') && all.includes('NEVER state or hint that the operator or the goods are alien'), 'COMMON 절', all.includes('cosmic-mall.alien'));
  check(s, '첫 방문: 정체 블록 요구(FIRST)', all.includes('<shop-identity>') && all.includes('First visit'), 'FIRST', all.includes('First visit'));
  check(s, '숨긴 진짜 효과 절(SHELF_SECRET)과 줄 꼴 끝에 진실 칸', all.includes('Two effect columns') && all.includes('이름|값|쓰임|그림|무게|설명|효과|구분|진실'), 'SHELF_SECRET + LINE', all.includes('Two effect columns'));
  check(s, '진실 미리 정하기 기본 「섞음」(TRUTH_MIX)', all.includes('MIX the two') && !all.includes('Give EVERY item a concrete'), 'TRUTH_MIX', all.includes('MIX the two'), 'core/malls.ts cosTruthMode 기본 mix');
  check(s, '이번 진열 배정(장르·값 등급 ₩) 칸이 있음', /\[이번 진열 배정[^\]]*\]\nItem 1 — GENRE: [^|]+\| VALUE TIER: [^(]+\([^)]*\), price ₩/.test(all), 'Item 1 — GENRE … price ₩', /\[이번 진열 배정[^\n]*\n[^\n]*/.exec(all)?.[0]);
  check(s, '처음엔 피할 목록 절이 없음(지난 진열 없음)', !all.includes('Previously shown here'), '없음', all.includes('Previously shown here'));
  check(s, '로어북 「우주 쇼핑몰」이 참고 자료로', all.includes('[관련 로어북: 우주 쇼핑몰]'), '[관련 로어북: 우주 쇼핑몰]', all.includes('[관련 로어북: 우주 쇼핑몰]'));
  check(s, '상태창 칸에서 잔고를 뺌', /\[상태창 — 지금 시각·장소\]\n\[▣[^\n]*관리국\/신입\]/.test(all), '…|관리국/신입]', /\[상태창 — 지금 시각·장소\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '잔고(10000000)를 요청 어디에도 넘기지 않음 (상점 문제 2와 같은 길: [최근 본문])', !all.includes('10000000'), '잔고 없음', (/[^\n]*10000000[^\n]*/.exec(all)?.[0] ?? ''), '지침 COMMON 「Never mention the player\'s money」·ui/shop.ts:374');
  check(s, '진행 중 괴이·사건 칸에 자리표(<등급> 등)가 없음 (상점 문제 3과 같은 길)', !/<[^<>\n]{1,8}>/.test(sit(all)), '자리표 없음', sit(all));
  const st = J(await vars(), '$cos_shop');
  for (const x of st?.items ?? []) ids[x.name] = x.id;
  check(s, '진열 3개, 진실 칸 저장(구두약=글, 우산=?)', st?.items?.length === 3 && st.items.find((x) => x.name === '반짝 걸음 구두약')?.truth?.includes('밑창이 녹는다') && st.items.find((x) => x.name === '말 듣는 우산')?.truth === '?', '3개·truth', st?.items?.map((x) => `${x.name}:${x.price}:${x.truth}`));
  check(s, '특가·희귀 구분 저장(구두약 특가 1,800,000 / 신문 희귀)', st?.items?.find((x) => x.name === '반짝 걸음 구두약')?.was === 1800000 && st.items.find((x) => x.name === '내일 신문 한 장')?.tag === 'rare', 'sale·rare', st?.items?.map((x) => `${x.name}:${x.tag ?? ''}:${x.was ?? ''}`));
  const note = (await vars())['$cos_shop_note'];
  check(s, '진열과 함께 온 한마디는 첫 화면 공지로(문의 대화 아님)', note?.includes('우리는 진열했다') && (st?.talk ?? []).length === 0, '공지 저장·talk 0', { note, talk: st?.talk });
  const txt = await screen();
  check(s, '화면: 광고 문구는 보이고 진실은 안 보임', txt.includes('걸음이 빛남, 당신의') && !txt.includes('밑창이 녹는다') && !txt.includes('기사 내용을 곧 잊는다'), '광고만', txt.slice(0, 400));
  check(s, '화면: 공지 한마디가 보임', txt.includes('우리는 진열했다'), '공지 보임', txt.includes('우리는 진열했다'));
  await saveState(s);
}

// 03 운영자에게 질문 (구두약을 붙여서) → 정보 쪽지 제안
{
  const s = step('운영자문의_쪽지제안');
  await act('mall-ask', ids['반짝 걸음 구두약']);
  await queue(COS_TALK1);
  const n0 = await llmCount();
  await act('mall-say', '이거 진짜 효과 있나요? 부작용은요?', 100);
  await waitLlm(n0);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, COS_TALK1);
  const all = allText(msgs);
  check(s, '지금 진열대 줄 끝에 진실 칸 + 운영자만 안다는 안내(SECRET_NOTE)', /\[지금 진열대\]\n반짝 걸음 구두약\|1500000\|[^\n]*\|밑창이 녹는다/.test(all.replace(/바른 신발로 걸으면 발소리가 사라지지만 한 시간 뒤 /, '')) && all.includes('The 운영자 knows it and never states it'), '진실 칸 + SECRET_NOTE', /\[지금 진열대\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '정보 쪽지(INFO)·맞춤 주문(ORDER) 절과 출력 꼴이 있음', all.includes('This mall also sells INFORMATION') && all.includes('<info>제목|값|내용</info>') && all.includes('<order>이름|값|납기시간'), 'INFO·ORDER', all.includes('<info>'));
  check(s, '마지막 줄이 붙인 물건 + 방금 한 말', /\[주인공\] \[반짝 걸음 구두약\] 이거 진짜 효과 있나요\? 부작용은요\?\s*$/.test(msgs.at(-1)?.content ?? ''), '[주인공] [반짝 걸음 구두약] …', (msgs.at(-1)?.content ?? '').slice(-80));
  check(s, '잔고를 넘기지 않음', !all.includes('10000000'), '없음', /[^\n]*10000000[^\n]*/.exec(all)?.[0] ?? '');
  const st = J(await vars(), '$cos_shop');
  check(s, '쪽지 1장 저장(제목·값), 대화 2줄(기준 c1)', st?.notes?.length === 1 && st.notes[0].price === 500000 && st.talk.length === 2 && st.talk.every((l) => l.k === 'c1'), { notes: 1, talk: 2, k: 'c1' }, { notes: st?.notes, talk: st?.talk });
  const txt = await screen();
  check(s, '화면: 쪽지 카드는 제목·값만, 내용은 안 보임', txt.includes('관리국 앞 발소리') && !txt.includes('지난번 우리 손님이었다'), '제목만', txt.slice(-400));
  await saveState(s);
}

// 04 쪽지 사기
{
  const s = step('쪽지사기');
  const st0 = J(await vars(), '$cos_shop');
  await act('mall-note-buy', st0.notes[0].id, 700);
  const w = await bal();
  const it = J(await vars(), '$st_items');
  const n = it.list.find((x) => x.name === '쪽지: 관리국 앞 발소리');
  check(s, '잔고 10,000,000 → 9,500,000', w === 9500000, 9500000, w);
  check(s, '소지품에 「쪽지: 관리국 앞 발소리」(내용 text, store cos)', !!n && n.text?.includes('지난번 우리 손님') && n.store === 'cos', '쪽지 줄', n);
  check(s, '쪽지 구매 표시(bought, 기준 c1)', J(await vars(), '$cos_shop').notes[0].bought === true, true, J(await vars(), '$cos_shop').notes[0]);
  await saveState(s);
}

// 05 맞춤 주문 견적
{
  const s = step('맞춤주문_견적');
  await queue(COS_TALK2);
  const n0 = await llmCount();
  await act('mall-say', '절대 안 꺼지는 손전등 하나 만들어 줄 수 있나요?', 100);
  await waitLlm(n0);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, COS_TALK2);
  const all = allText(msgs);
  check(s, '이번 방문에 내민 쪽지가 「산 것」으로 넘어감(다시 내밀지 말 것)', /\[이번 방문에 내민 정보 쪽지[^\]]*\]\n관리국 앞 발소리 \(500000, bought\)/.test(all), '관리국 앞 발소리 (500000, bought)', /\[이번 방문에 내민 정보 쪽지[^\n]*\n[^\n]*/.exec(all)?.[0]);
  check(s, '앞 문의 대화가 같이 넘어감', all.includes('[주인] 구두약 진짜다'), '앞 대화', all.includes('구두약 진짜다'));
  const st = J(await vars(), '$cos_shop');
  const q = st?.quotes?.[0];
  check(s, '견적 저장(안 꺼지는 손전등 3,000,000, 5시간, 진실 칸)', q?.price === 3000000 && q.hours === 5 && q.item.truth?.includes('그림자가 주인을 따라온다'), { price: 3000000, hours: 5 }, q);
  const txt = await screen();
  check(s, '화면: 견적 카드는 이름·값·납기만 (설명·효과·진실은 안 보임)', txt.includes('안 꺼지는 손전등') && txt.includes('납기 5시간') && !txt.includes('영원한 빛') && !txt.includes('그림자가'), '이름·값·납기', txt.slice(-400));
  await saveState(s);
}

// 06 선납하고 주문
{
  const s = step('선납');
  const q = J(await vars(), '$cos_shop').quotes[0];
  await act('mall-quote-accept', q.id, 700);
  const w = await bal();
  const ord = J(await vars(), '$cos_orders');
  check(s, '잔고 9,500,000 → 6,500,000', w === 6500000, 6500000, w);
  check(s, '주문 1건(주문 시각 = 상태창 21:00, 5시간, 기준 c1, 진실 포함)', ord?.length === 1 && ord[0].hours === 5 && ord[0].anchor === 'c1' && ord[0].orderedAt !== null && ord[0].item.truth?.includes('그림자'), { n: 1, anchor: 'c1' }, ord);
  check(s, '견적에 선납 표시', J(await vars(), '$cos_shop').quotes[0].accepted === true, true, J(await vars(), '$cos_shop').quotes[0].accepted);
  await act('mall-ask-close');
  await act('mall-page', 'orders');
  const txt = await screen();
  check(s, '주문 조회: 제작 중 · 납기 02:00 AM (5시간 남음)', txt.includes('안 꺼지는 손전등') && /제작 중 · 납기 2025\.03\.15 02:00 AM \(5시간 남음\)/.test(txt), '제작 중 · 납기 2025.03.15 02:00 AM (5시간 남음)', /[^\n]*제작 중[^\n]*/.exec(txt)?.[0]);
  await act('mall-page', '');
  await saveState(s);
}

// 07 장바구니 → 주문하기 → 입금
let snapAfterBuy;
{
  const s = step('장바구니_입금');
  await act('mall-cart', ids['반짝 걸음 구두약']);
  await act('mall-cart', ids['말 듣는 우산']);
  await act('mall-page', 'cart');
  const cart = await screen();
  check(s, '장바구니 합계 ₩3,700,000, 잔고 6,500,000원', cart.includes('₩3,700,000') && /6,500,000/.test(cart), '합계·잔고', /◈ 장바구니 ◈[\s\S]{0,300}/.exec(cart)?.[0]);
  await act('mall-order');
  await act('mall-pay', undefined, 800);
  const w = await bal();
  const it = J(await vars(), '$st_items');
  const st = J(await vars(), '$cos_shop');
  check(s, '잔고 6,500,000 → 2,800,000', w === 2800000, 2800000, w);
  const a = it.list.find((x) => x.name === '반짝 걸음 구두약');
  const u = it.list.find((x) => x.name === '말 듣는 우산');
  check(s, '소지품에 구두약·우산(store cos, 기준 c1, 진실 그대로, 산 값)', a?.store === 'cos' && a.anchor === 'c1' && a.truth?.includes('밑창') && u?.truth === '?' && a.price === 1500000, '두 줄', [a, u].map((x) => x && { name: x.name, store: x.store, anchor: x.anchor, truth: x.truth, price: x.price, use: x.use, uses: x.uses }));
  check(s, '진열대에서 둘 다 팔림, 신문만 남음', st.items.filter((x) => !x.sold).map((x) => x.name).join() === '내일 신문 한 장', '신문만', st.items.map((x) => `${x.name}:${!!x.sold}`));
  const txt = await screen();
  check(s, '화면: 입금 확인 안내', txt.includes('입금 확인!!'), '입금 확인!!', txt.slice(0, 300));
  await saveState(s);
  snapAfterBuy = await snap();
}

// 08 다음 턴 본편 요청 (산 것·받는 법·문의·주문이 한 번)
{
  const s = step('다음턴_본편요청');
  await closeWin(page);
  const out = await mainRequest('상자를 열어 본다.', 'u2');
  writeReq(s, out);
  const inv = inventoryOf(out);
  const tt = thisTurn(inv);
  check(s, '구매 사건: 구두약·우산·쪽지를 방금 삼', /just bought[^;]*반짝 걸음 구두약/.test(tt) && /just bought[^;]*말 듣는 우산/.test(tt) && /just bought[^;]*쪽지: 관리국 앞 발소리/.test(tt), 'just bought …', tt);
  check(s, '받는 법(ARRIVE) 한 번', (inv.match(/website purchase arrives this turn/g) ?? []).length === 1, 1, (inv.match(/website purchase arrives this turn/g) ?? []).length, '지침 우주쇼핑몰 ARRIVE 절');
  check(s, '운영자와 나눈 말(MALL.ASK) 한 번', (inv.match(/chatted by text with the operator/g) ?? []).length === 1 && inv.includes('만든다 우리는'), 1, (inv.match(/chatted by text with the operator/g) ?? []).length);
  check(s, '맞춤 주문 선납 사건(MALL.ORDER) 한 번', (inv.match(/placed a custom order with 우주 쇼핑몰 for 「안 꺼지는 손전등」, paid 3,000,000 won/g) ?? []).length === 1, 1, /placed a custom order[^;]*/.exec(inv)?.[0]);
  check(s, '숨긴 진실은 안 감(쓰지 않은 턴)', !inv.includes('밑창이 녹는다') && !inv.includes('Really'), '없음', inv.includes('밑창'));
  check(s, '맞춤 주문 진실·설명도 안 감', !inv.includes('그림자가 주인을') && !inv.includes('영원한 빛'), '없음', inv.includes('그림자'));
  check(s, '쪽지 내용은 소지품 줄에(읽은 글)', inv.includes('쪽지: 관리국 앞 발소리') && inv.includes('지난번 우리 손님이었다'), 'reads: …', /- 쪽지[^\n]*/.exec(inv)?.[0]);
  const paid = /반짝 걸음 구두약 \(paid with [^)]*\)/.exec(tt)?.[0] ?? '';
  check(s, '구매 줄의 치른 값이 한 번만 읽힘(송금 = 원)', !/bank transfer to 우주 쇼핑몰 \+ [\d,]+ won/.test(paid), '「bank transfer」와 「+ N won」이 겹치지 않음', paid, '지침 메인요청 INVENTORY.BOUGHT.PAID_WON = 「{paid} + {price} won」 (원이 아닌 대가 + 원 몫용)');
  await saveState(s);
}

// 09 그다음 턴: 사건이 되풀이되지 않음 / 진열 새로고침(피할 목록) / 쓰는 턴에 진실
{
  const s = step('그다음턴_새로고침_피할목록');
  await botReply(C2, 'c2');
  await openSite('cos');
  await queue(COS_SHELF2);
  const n0 = await llmCount();
  await act('mall-refresh', '');
  await waitLlm(n0);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, COS_SHELF2);
  const all = allText(msgs);
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '피할 목록에 산 구두약·우산', avoid.includes('반짝 걸음 구두약') && avoid.includes('말 듣는 우산'), ['반짝 걸음 구두약', '말 듣는 우산'], avoid || '(피할 목록 절 없음)');
  check(s, '피할 목록(또는 지금 진열대)에 지금 걸린 신문 (상점 문제 1과 같은 길)', avoid.includes('내일 신문 한 장') || /\[지금 진열대\][\s\S]*내일 신문/.test(all), '내일 신문 한 장', avoid || '(피할 목록 절 없음)', '지침 VARIETY 「Do not repeat items from the previous shelf」');
  check(s, '두 번째 진열은 RESTOCK(정체 고정), FIRST 아님', all.includes('[가게 정체 — 고정]') && !all.includes('First visit'), 'RESTOCK', all.includes('First visit'));
  check(s, '잔고(2800000) 안 넘김', !all.includes('2800000'), '없음', /[^\n]*2800000[^\n]*/.exec(all)?.[0] ?? '');
  const st = J(await vars(), '$cos_shop');
  check(s, '새 진열: 시계·초인종 + 산 것 팔림, 신문은 빠짐', st.items.filter((x) => !x.sold).map((x) => x.name).sort().join() === ['거꾸로 시계', '조용한 초인종'].sort().join(), '시계·초인종', st.items.map((x) => `${x.name}:${!!x.sold}`));
  check(s, '새 진열의 「?」 진실은 ? 로, 글 진실은 글로', st.items.find((x) => x.name === '거꾸로 시계')?.truth === '?' && st.items.find((x) => x.name === '조용한 초인종')?.truth?.includes('문 앞에 온다'), '?·글', st.items.map((x) => `${x.name}:${x.truth}`));
  await saveState(s);
}
{
  const s = step('쓰는턴_진실_본편');
  await closeWin(page);
  const it = J(await vars(), '$st_items');
  const a = it.list.find((x) => x.name === '반짝 걸음 구두약');
  const u = it.list.find((x) => x.name === '말 듣는 우산');
  check(s, '구두약·우산 둘 다 「사용」 가능한 물건으로 들어옴', a?.use && u?.use, 'use true', { a: a?.use, u: u?.use });
  // 소지품 「다음 메시지에 사용」에 넣은 것과 같은 자리 ($st_item_use)
  await page.evaluate(([x, y]) => { window.__chat.scriptstate.$st_item_use = JSON.stringify([{ id: x, n: 1 }, { id: y, n: 1 }]); }, [a.id, u.id]);
  const out = await mainRequest('구두에 구두약을 바르고 우산을 펼쳐 본다.', 'u3');
  writeReq(s, out);
  const inv = inventoryOf(out);
  const tt = thisTurn(inv);
  check(s, '지난 턴 구매·받는 법·문의·주문 사건이 다시 안 나옴', !/just bought/.test(tt) && !inv.includes('arrives this turn') && !inv.includes('chatted by text') && !inv.includes('placed a custom order'), '없음', tt);
  check(s, '소지품 목록엔 구두약·우산이 계속 있음', /^- 반짝 걸음 구두약/m.test(inv) && /^- 말 듣는 우산/m.test(inv), '목록', inv.split('\n').filter((l) => l.startsWith('- ')));
  check(s, '쓰는 사건(uses) 한 번', /uses [^;]*반짝 걸음 구두약/.test(tt), 'uses 반짝 걸음 구두약', tt);
  check(s, '구두약 진실이 「Really」로 감(광고 문구와 함께)', inv.includes('Really') && /- 반짝 걸음 구두약: 바른 신발로 걸으면 발소리가 사라지지만 한 시간 뒤 밑창이 녹는다 \(the label says 「걸음이 빛남, 당신의」\)/.test(inv), 'REALLY_LINE_LABEL', /- 반짝 걸음 구두약:[^\n]*/.exec(inv)?.[0]);
  check(s, '우산(진실 ?)은 「지금 정하라」 줄', /- 말 듣는 우산: not even its seller knows/.test(inv), 'REALLY_UNKNOWN', /- 말 듣는 우산:[^\n]*/.exec(inv)?.[0]);
  check(s, '이번 턴에 받은 새 진열은 본편에 안 감(설정 「진열」 기본 끔)', !inv.includes('now lists these'), '없음', inv.includes('now lists these'));
  await saveState(s);
}

// 10 납기 지남 → 완성 알림 → 받기
{
  const s = step('납기지남_완성알림');
  await botReply(C3, 'c3');
  const msg = await page.evaluate(() => window.__chat.message.at(-1).data);
  check(s, '완성 표식이 이 응답 끝에 붙음(카드용)', /\[shop-ready: cos\|안 꺼지는 손전등\]/.test(msg), '[shop-ready: cos|안 꺼지는 손전등]', msg.slice(-60));
  const out = await peekMain('알림을 확인한다.');
  writeReq(s, out, undefined, '■ 받기 전 (미리 보기)\n');
  const inv = inventoryOf(out);
  check(s, '완성 사건(MALL.READY) 한 번, 받기 전이라 받는 법은 없음', (inv.match(/is now finished and waiting/g) ?? []).length === 1 && !inv.includes('custom order, paid for earlier and finished now, arrives'), 1, thisTurn(inv));
  check(s, '완성 표식은 본편 요청에 새지 않음', !allText(out).includes('[shop-ready'), '없음', allText(out).includes('[shop-ready'));
  check(s, '지난 턴 「uses」가 되풀이되지 않음', !/uses [^;]*반짝/.test(thisTurn(inv)), '없음', thisTurn(inv));
  await saveState(s);
}
{
  const s = step('주문받기_팔기_본편');
  await openSite('cos');
  await act('mall-page', 'orders');
  const t0 = await screen();
  check(s, '주문 조회: 완성 카드 + 받기 단추', t0.includes('★완성★') && !!(await page.$('.ms [data-action="mall-custom-take"]')), '★완성★', /◈ 주문 조회 ◈[\s\S]{0,200}/.exec(t0)?.[0]);
  const ord = J(await vars(), '$cos_orders')[0];
  await act('mall-custom-take', ord.id, 800);
  const it = J(await vars(), '$st_items');
  const f = it.list.find((x) => x.name === '안 꺼지는 손전등');
  check(s, '소지품에 손전등(store cos-order, 기준 c3, 진실 그대로)', f?.store === 'cos-order' && f.anchor === 'c3' && f.truth?.includes('그림자'), 'cos-order', f && { store: f.store, anchor: f.anchor, truth: f.truth, price: f.price, paidWith: f.paidWith });
  check(s, '잔고는 그대로 2,800,000 (선납 끝)', (await bal()) === 2800000, 2800000, await bal());
  const t1 = await screen();
  check(s, '받은 카드에 설명·광고 문구가 보이고 진실은 안 보임', t1.includes('켠다. 꺼지지 않는다.') && t1.includes('영원한 빛') && !t1.includes('그림자가'), '설명·광고', /받음[\s\S]{0,120}/.exec(t1)?.[0]);
  const msgNow = await page.evaluate(() => window.__chat.message.at(-1).data);
  check(s, '받았으니 완성 표식이 지워짐', !msgNow.includes('[shop-ready'), '없음', msgNow.slice(-60));
  // 팔기: 우산을 운영자에게
  await act('mall-page', '');
  await act('mall-ask', '');
  await act('mall-sell-open');
  const um = it.list.find((x) => x.name === '말 듣는 우산');
  await act('mall-sell-pick', um.id, 600);
  await queue(COS_SELL1);
  const n0 = await llmCount();
  await act('mall-say', '이 우산 얼마에 사요?', 100);
  await waitLlm(n0);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, COS_SELL1, '■ 팔기 요청\n', '_팔기');
  const all = allText(msgs);
  check(s, '팔기 지시(SELL)·팔려는 물건·산 값 2,200,000', all.includes('[팔려는 물건') && all.includes('bought earlier for 2200000 won'), 'SELL + paid', /bought earlier[^\n]*/.exec(all)?.[0]);
  check(s, '팔기 중엔 쪽지·주문 절(INFO·ORDER) 없음', !all.includes('This mall also sells INFORMATION'), '없음', all.includes('sells INFORMATION'));
  check(s, '지금까지 산 것 줄(산 때|이름|값|효과)에 구두약·우산', /\[지금까지 산 것[^\]]*\]\n[^\n]*반짝 걸음 구두약\|1500000\|걸음이 빛남/.test(all), 'BOUGHT_LINE', /\[지금까지 산 것[^\n]*\n[^\n]*\n?[^\n]*/.exec(all)?.[0]);
  check(s, '진행 중 주문 칸: 받은 주문은 빠짐', !all.includes('[진행 중 맞춤 주문'), '없음', /\[진행 중 맞춤 주문[^\n]*\n[^\n]*/.exec(all)?.[0]);
  check(s, '잔고 안 넘김', !all.includes('2800000'), '없음', /[^\n]*2800000[^\n]*/.exec(all)?.[0] ?? '');
  const st = J(await vars(), '$cos_shop');
  check(s, '부른 값 300,000', st.sell?.price === 300000, 300000, st.sell);
  await act('mall-sell', undefined, 800);
  const w = await bal();
  check(s, '판매: 잔고 2,800,000 → 3,100,000, 판 것 목록(기준 c3)', w === 3100000 && J(await vars(), '$cos_shop').sales?.some((x) => x.name === '말 듣는 우산' && x.price === 300000 && x.k === 'c3'), 3100000, { w, sales: J(await vars(), '$cos_shop').sales });
  await closeWin(page);
  const out = await mainRequest('손전등을 켜 본다.', 'u4');
  writeReq(s, out, undefined, '', '_본편');
  const inv = inventoryOf(out);
  const tt = thisTurn(inv);
  check(s, '맞춤 주문 받는 법(ARRIVE_ORDER) 한 번', (inv.match(/custom order, paid for earlier and finished now, arrives this turn/g) ?? []).length === 1, 1, (inv.match(/finished now, arrives/g) ?? []).length, '지침 우주쇼핑몰 ARRIVE_ORDER');
  check(s, '일반 구매 받는 법(ARRIVE)은 안 붙음(이번 턴 송금 구매 없음)', !inv.includes('website purchase arrives'), '없음', inv.includes('website purchase arrives'));
  check(s, '완성 사건(READY)은 받았으니 안 붙음', !inv.includes('is now finished and waiting'), '없음', inv.includes('finished and waiting'));
  check(s, '판 사건(우주 쇼핑몰에 우산) 한 번', (tt.match(/just sold 말 듣는 우산 to 우주 쇼핑몰/g) ?? []).length === 1, 1, tt);
  const got = /just bought ([^;]*)/.exec(tt)?.[1] ?? '';
  check(s, '받은 주문품이 「다시 산 것」으로 읽히지 않음(값은 주문 때 이미 냄)', !/안 꺼지는 손전등[^;]*\+ 3,000,000 won/.test(got), '「+ 3,000,000 won」 없음', got || '(just bought 없음)', 'MALL.ORDER 가 이미 「paid 3,000,000 won in advance」를 넘김(단계08)');
  check(s, '지난 턴 쓴 사건(uses)이 되풀이되지 않음', !/uses /.test(tt), '없음', tt);
  await saveState(s);
}

// 11 그다음 턴: 받기·팔기 사건이 되풀이되지 않음
{
  const s = step('그다음턴_되풀이없음');
  await botReply(C4, 'c4');
  const out = await mainRequest('잠을 청한다.', 'u5');
  writeReq(s, out);
  const inv = inventoryOf(out);
  const tt = thisTurn(inv);
  check(s, '받는 법·판 사건·문의가 다시 안 나옴', !inv.includes('arrives this turn') && !tt.includes('just sold') && !inv.includes('chatted by text'), '없음', tt || '(This turn 없음)');
  check(s, '목록: 구두약·손전등·쪽지 있음, 우산 없음', /^- 반짝 걸음 구두약/m.test(inv) && /^- 안 꺼지는 손전등/m.test(inv) && !/^- 말 듣는 우산/m.test(inv), '목록', inv.split('\n').filter((l) => l.startsWith('- ')));
  await saveState(s);
}

// 12 다시 열기 (자동 호출 수동: 열어도 안 부름, 진열 그대로)
{
  const s = step('다시열기');
  const n0 = await llmCount();
  await openSite('cos');
  await sleep(500);
  const txt = await screen();
  check(s, '다시 열어도 보조 호출 없음, 새 진열(시계·초인종)이 그대로', (await llmCount()) === n0 && txt.includes('거꾸로 시계') && txt.includes('조용한 초인종'), '그대로', { calls: (await llmCount()) - n0, txt: txt.slice(0, 200) });
  await act('mall-page', 'cart');
  await act('mall-cart', J(await vars(), '$cos_shop').items.find((x) => x.name === '거꾸로 시계').id);
  await act('mall-page', 'cart');
  const c = await screen();
  check(s, '장바구니 화면 잔고 3,100,000', /3,100,000/.test(c), '3,100,000', /당신의 잔고[^\n]*/.exec(c)?.[0]);
  await act('mall-cart', J(await vars(), '$cos_shop').items.find((x) => x.name === '거꾸로 시계').id);
  await act('mall-page', '');
  await saveState(s);
}

// ── 갈래 ──
// A. 문의 응답 실패 (owner 블록 없음): 내 말이 되돌아가고 상태가 반쯤 저장되지 않음
{
  const s = step('갈래_문의응답실패');
  await act('mall-ask', '');
  const talk0 = J(await vars(), '$cos_shop').talk.length;
  await queue('그냥 아무 말', '그냥 아무 말', '그냥 아무 말', '그냥 아무 말');
  const n0 = await llmCount();
  await act('mall-say', '시계는 몇 번 돌릴 수 있어?', 100);
  await waitLlm(n0);
  await sleep(1500);
  const st = J(await vars(), '$cos_shop');
  const txt = await screen();
  check(s, '실패 안내가 보임', /owner|주인|대사|받은 글/.test(await page.evaluate(() => document.querySelector('.q-fail')?.innerText ?? '')), '실패 안내', await page.evaluate(() => document.querySelector('.q-fail')?.innerText ?? ''));
  check(s, '내 말이 대화에서 빠짐(되돌림)', st.talk.length === talk0, talk0, st.talk.length);
  const inp = await page.evaluate(() => document.querySelector('[data-input="mall-say"]')?.value ?? '');
  note(s, '실패 뒤 입력칸 글 (포인트몰 상담은 돌려줌 ui/malls.ts:693, 우주몰 문의는 코드상 안 돌려줌 ui/malls.ts:226-236)', inp);
  void txt;
  await act('mall-ask-close');
  await saveState(s);
}

// B. 산 턴의 본편 응답을 다시 굴림 → 쪽지·선납·구매가 같이 되돌아가나
{
  const s = step('갈래_산턴_다시굴리기');
  const c = JSON.parse(JSON.stringify(snapAfterBuy));
  c.message[1] = { role: 'char', data: C1, chatId: 'c1b' };
  await page.evaluate((c) => { window.__chat = c; }, c);
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(400);
  await openSite('cos');
  const st = J(await vars(), '$cos_shop');
  const txt = await screen();
  // 화면 잔고: 장바구니 화면으로 (물건이 하나 있어야 잔고 줄이 보인다)
  await act('mall-cart', st.items.find((x) => x.name === '내일 신문 한 장').id);
  await act('mall-page', 'cart');
  const cart = await screen();
  check(s, '화면 잔고 10,000,000 으로 돌아옴(쪽지·선납·구매 거래가 죽음)', /10,000,000/.test(cart), '10,000,000', /당신의 잔고[^\n]*/.exec(cart)?.[0]);
  await act('mall-cart', st.items.find((x) => x.name === '내일 신문 한 장').id);
  await act('mall-page', '');
  check(s, '진열대에 구두약·우산이 다시 보임', txt.includes('반짝 걸음 구두약') && txt.includes('말 듣는 우산'), '보임', txt.slice(0, 300));
  await act('mall-page', 'orders');
  const ot = await screen();
  check(s, '주문 조회: 선납한 주문이 없어짐(돈이 돌아왔으니)', ot.includes('주문의 존재는 없다'), '주문 없음', /◈ 주문 조회 ◈[\s\S]{0,120}/.exec(ot)?.[0]);
  await act('mall-page', '');
  await act('mall-ask', '');
  const at = await screen();
  check(s, '쪽지·견적 카드가 다시 살 수 있게(구매·선납 단추)', !!(await page.$('.ms [data-action="mall-note-buy"]')) && !!(await page.$('.ms [data-action="mall-quote-accept"]')), '두 단추', at.slice(-300));
  await act('mall-ask-close');
  await closeWin(page);
  const out = await peekMain('다시 생각해 본다.');
  const inv = inventoryOf(out);
  writeReq(s, out);
  check(s, '다시 굴린 뒤 본편: 구매·주문 사건이 안 감(산 일이 없던 일)', !/just bought/.test(thisTurn(inv)) && !inv.includes('placed a custom order'), '없음', thisTurn(inv));
  note(s, '다시 굴린 뒤 본편의 문의 대화 줄', (inv.match(/chatted by text[^;]*/) ?? ['(없음)'])[0].slice(0, 200));
  await saveState(s);
}

// C. 설정 끔 (소지품·가계부 끔 → 몰 닫힘, 본편에도 몰 일 없음)
{
  const s = step('갈래_소지품가계부끔');
  await page.evaluate(() => { Object.assign(window.__chat.scriptstate, { $it_on: '0', $st_col_wallet: 'off' }); });
  await openSite('cos');
  const txt = await screen();
  check(s, '화면: 영업 아님 안내', txt.includes('지금 영업 아님'), '지금 영업 아님', txt.slice(0, 200));
  const n0 = await llmCount();
  await act('mall-refresh', '');
  await sleep(600);
  check(s, '새로고침해도 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
  await page.evaluate(() => { Object.assign(window.__chat.scriptstate, { $it_on: '1', $st_col_wallet: '' }); delete window.__chat.scriptstate.$st_col_wallet; });
  await saveState(s);
}

// D. 자동 호출 「창을 열 때」: 열면 한 번, 같은 턴에 다시 열면 안 부름
{
  const s = step('갈래_자동호출_열때');
  await page.evaluate(() => { window.__chat.scriptstate.$cos_sh_auto = 'open'; window.__chat.scriptstate.$cos_truth = 'all'; });
  // 이 채팅(다시 굴린 c1b)은 이미 이 턴에 진열을 받았다 → 새 턴으로 넘긴 뒤 연다 (자동 호출은 턴마다 한 번)
  await closeWin(page);
  await mainRequest('잠깐 다른 일을 한다.', 'u2d');
  await botReply(C2.replace('2800000', '10000000'), 'c2d');
  const n0 = await llmCount();
  await openSite('cos');
  await waitLlm(n0);
  const n1 = await llmCount();
  const heads = async (a, z) => { const o = []; for (let i = a; i < z; i++) { const m = await llmAt(i); o.push(String(m[0]?.content ?? '').slice(0, 70)); } return o; };
  note(s, '열 때 나간 보조 호출 머리', await heads(n0, n1));
  note(s, '열고 난 뒤 화면 실패 안내·저장된 진열 턴', { fail: await page.evaluate(() => document.querySelector('.cs-fail')?.innerText ?? ''), at: (await vars())['$cos_shop_at'], turn: await page.evaluate(() => window.__chat.message.map((m) => m.chatId).join(',')) });
  const cosCalls = (await heads(n0, n1)).filter((h) => h.includes('우주 쇼핑몰')).length;
  check(s, '열자 우주몰 진열 호출 1회', cosCalls === 1, 1, cosCalls);
  const msgs = n1 > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, COS_SHELF2);
  const all = allText(msgs);
  check(s, '설정 「진실 미리 정하기: 전부」→ TRUTH_ALL 절', all.includes('Give EVERY item a concrete') && !all.includes('MIX the two'), 'TRUTH_ALL', all.includes('Give EVERY item'));
  await openSite('cos');
  await sleep(800);
  const again = (await heads(n1, await llmCount())).filter((h) => h.includes('우주 쇼핑몰')).length;
  note(s, '다시 열 때 나간 보조 호출 머리', await heads(n1, await llmCount()));
  check(s, '같은 턴에 다시 열면 우주몰은 안 부름', again === 0, 0, again);
  await saveState(s);
}

// E. 다른 소속(관리국)에서 포인트몰이 안 보임
{
  const s = step('갈래_관리국_포인트몰없음');
  await act('br-home', '', 600);
  const has = await page.evaluate(() => !!document.querySelector('[data-action="br-go"][data-value="bm"]'));
  const sites = await page.evaluate(() => [...document.querySelectorAll('[data-action="br-go"]')].map((e) => e.dataset.value));
  check(s, '브라우저 첫 화면에 포인트몰 없음', !has && sites.includes('cos'), 'cos 있고 bm 없음', sites);
  await saveState(s);
}

// ───────────────────────── 백일몽 포인트몰 ─────────────────────────
part = '포인트_';
await bootChat({
  message: [{ role: 'user', data: '점심을 먹고 자리로 돌아온다.', chatId: 'u1' }, { role: 'char', data: B1, chatId: 'c1' }],
  scriptstate: { $st_look: '7.1', $st_faction: 'C00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_points_on: '1', $br_login: '1', $br_nick: '토끼', $st_items: JSON.stringify({ list: [], log: [] }), $st_points: JSON.stringify({ start: 0, log: [{ id: 'p1', anchor: 'c1', amount: 5000, memo: '이번 달 복지 포인트', src: 'story', at: '2026-11-08T00:00:00Z' }] }) },
});
await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
await sleep(400);
const bids = {};
{
  const s = step('열기_수동');
  const n0 = await llmCount();
  await closeWin(page); await openWin(page); await sleep(300);
  await act('nav-tab', 'net');
  await act('br-home', '', 500);
  const sites = await page.evaluate(() => [...document.querySelectorAll('[data-action="br-go"]')].map((e) => e.dataset.value));
  check(s, '백일몽 소속: 브라우저에 포인트몰이 보임', sites.includes('bm'), 'bm 있음', sites);
  await act('br-go', 'bm', 600);
  const txt = await screen();
  check(s, '자동 호출 수동: 열어도 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
  check(s, '로그인 닉네임·보유 포인트 5,000 P, 빈 진열 안내', txt.includes('토끼') && txt.includes('5,000 P') && txt.includes('등록된 상품이 없습니다'), '토끼 · 5,000 P', txt.slice(0, 300));
  await saveState(s);
}
{
  const s = step('첫진열');
  await queue(BM_SHELF1);
  const n0 = await llmCount();
  await act('mall-refresh', '');
  await waitLlm(n0);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, BM_SHELF1);
  const all = allText(msgs);
  check(s, '포인트몰 지침 COMMON·POINT_SHOP', all.includes('point.baekilmong.intra') && all.includes("This is Baekilmong's point shop"), 'COMMON + POINT_SHOP', all.includes('point.baekilmong.intra'));
  check(s, '진열 배정 값이 포인트(p)', /price [\d,]+-[\d,]+p|price [\d,]+p/.test(all) || /VALUE TIER[^\n]*p\b/.test(all), 'p', /Item 1 —[^\n]*/.exec(all)?.[0]);
  check(s, '진실 칸·SHELF_SECRET 없음(우주몰만)', !all.includes('Two effect columns') && !all.includes('|진실'), '없음', all.includes('Two effect columns'));
  check(s, '상태창 칸에서 잔고·포인트를 뺌', /\[상태창 — 지금 시각·장소\]\n\[▣[^\n]*백일몽\/사원\]/.test(all), '…|백일몽/사원]', /\[상태창 — 지금 시각·장소\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '포인트(5000)를 요청 어디에도 넘기지 않음 (지침 COMMON 「Never mention the player\'s points」)', !/\|5000\]/.test(all), '없음', /[^\n]*\|5000\][^\n]*/.exec(all)?.[0] ?? '');
  check(s, '로어북 「백일몽」이 참고 자료로', all.includes('Baekilmong corporation'), 'Baekilmong corporation', all.includes('Baekilmong corporation'));
  check(s, '진행 중 괴이·사건 칸에 자리표 없음', !/<[^<>\n]{1,8}>/.test(sit(all)), '없음', sit(all));
  const st = J(await vars(), '$bm_shop');
  for (const x of st?.items ?? []) bids[x.name] = x.id;
  check(s, '진열 3개(1200·800·9000p), 포인트 가게', st?.items?.length === 3 && st.identity.points === true && st.items.find((x) => x.name === 'B등급 꿈결용액 앰플')?.price === 9000, '3개', st?.items?.map((x) => `${x.name}:${x.price}`));
  const txt = await screen();
  check(s, '화면: 9000p 앰플은 「포인트 부족」 단추(눌러지지 않음)', await page.evaluate((id) => { const b = document.querySelector(`.ms [data-action="mall-buy"][data-value="${id}"]`); return !!b && b.disabled && b.textContent.includes('포인트 부족'); }, bids['B등급 꿈결용액 앰플']), '포인트 부족(disabled)', txt.slice(0, 300));
  await saveState(s);
}
{
  const s = step('사기_부족');
  await act('mall-buy', bids['현장용 소형 응급 키트'], 700);
  let p = await bal('$st_points');
  const ord = J(await vars(), '$bm_orders');
  const it = J(await vars(), '$st_items');
  check(s, '포인트 5,000 → 3,800, 원 가계부는 그대로', p === 3800 && !J(await vars(), '$st_wallet')?.log?.some((e) => e.src === 'store'), 3800, p);
  check(s, '물건은 소지품이 아니라 수령 대기(주문 1건, 기준 c1)', ord?.length === 1 && !ord[0].taken && ord[0].anchor === 'c1' && !it.list.some((x) => x.name === '현장용 소형 응급 키트'), '수령 대기 1', ord);
  const txt = await screen();
  check(s, '화면: 구매 완료 · 수령 대기 안내, 보유 3,800 P', txt.includes('수령 대기 중') && txt.includes('3,800 P'), '3,800 P', txt.slice(0, 300));
  await act('mall-buy', bids['B등급 꿈결용액 앰플'], 700);
  p = await bal('$st_points');
  check(s, '포인트 부족(9000p): 아무것도 안 바뀜', p === 3800 && J(await vars(), '$bm_orders').length === 1, 3800, { p, orders: J(await vars(), '$bm_orders').length });
  check(s, '화면: 부족 안내', (await screen()).includes('포인트가 부족'), '포인트가 부족', (await screen()).slice(0, 200));
  await saveState(s);
}
{
  const s = step('다음턴_본편_수령대기');
  await closeWin(page);
  const out = await mainRequest('오후 업무를 시작한다.', 'u2');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '수령 대기 줄(PICKUP_WAIT)에 응급 키트', /Bought at 백일몽 포인트몰, not collected yet[^:]*: 현장용 소형 응급 키트/.test(inv), 'PICKUP_WAIT', /Bought at 백일몽[^\n]*/.exec(inv)?.[0]);
  check(s, '「방금 삼」·받는 법(ARRIVE)은 안 감(아직 안 받음)', !/just bought/.test(thisTurn(inv)) && !inv.includes('collects in person'), '없음', thisTurn(inv));
  check(s, '소지품 목록에 응급 키트 없음', !/^- 현장용 소형 응급 키트/m.test(inv), '없음', inv.split('\n').filter((l) => l.startsWith('- ')));
  await botReply(B2, 'c2');
  const out2 = await peekMain('메일을 확인한다.');
  const inv2 = inventoryOf(out2);
  check(s, '그다음 턴에도 수령 대기 줄은 계속(계속 남는 것)', /not collected yet[^:]*: 현장용 소형 응급 키트/.test(inv2), 'PICKUP_WAIT', /Bought at 백일몽[^\n]*/.exec(inv2)?.[0]);
  await saveState(s);
}
{
  const s = step('받기_즉시');
  await closeWin(page); await openWin(page); await sleep(300);
  if (!(await page.$('.ms-bm'))) { await act('nav-tab', 'net'); await act('br-go', 'bm', 600); }
  await act('mall-page', 'orders');
  const t0 = await screen();
  check(s, '주문 조회: 수령 대기 + 받기 단추, 본사 대여창고 안내', t0.includes('수령 대기') && t0.includes('본사 대여창고') && !!(await page.$('.ms [data-action="mall-pickup"]')), '수령 대기', /주문 조회[\s\S]{0,200}/.exec(t0)?.[0]);
  const ord = J(await vars(), '$bm_orders')[0];
  await act('mall-pickup', ord.id, 700);
  const it = J(await vars(), '$st_items');
  const k = it.list.find((x) => x.name === '현장용 소형 응급 키트');
  check(s, '인물 기록 꺼짐 → 판단할 곳이 없어 바로 소지품에(store bm, 기준 c2)', k?.store === 'bm' && k.anchor === 'c2' && J(await vars(), '$bm_orders')[0].taken === true, 'bm·c2', k && { store: k.store, anchor: k.anchor });
  await closeWin(page);
  const out = await mainRequest('대여창고에 들러 상자를 받는다.', 'u3');
  writeReq(s, out);
  const inv = inventoryOf(out);
  check(s, '받는 법(ARRIVE, 이름 포함) 한 번', (inv.match(/collects in person[^;]*현장용 소형 응급 키트/g) ?? []).length === 1, 1, /this turn the protagonist collects[^;]*/.exec(inv)?.[0]);
  check(s, '수령 대기 줄은 빠짐', !inv.includes('not collected yet'), '없음', /Bought at 백일몽[^\n]*/.exec(inv)?.[0] ?? '');
  check(s, '「방금 삼」으로는 안 감', !/just bought[^;]*응급 키트/.test(thisTurn(inv)), '없음', thisTurn(inv));
  await saveState(s);
}

// 받으러 감 (PICKUP_TRY): 인물 기록 켬(매 턴) → 받기를 누르면 「수령하러 감」만, 본편에 한 번, 못 받으면 다음 턴 수령 대기로
{
  const s = step('받으러감_PICKUP_TRY');
  await botReply(B3, 'c3');
  await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '1'; });
  await closeWin(page); await openWin(page); await sleep(300);
  if (!(await page.$('.ms-bm'))) { await act('nav-tab', 'net'); await act('br-go', 'bm', 600); }
  await act('mall-page', '');
  await act('mall-buy', bids['안대형 수면 마스크'], 700);
  check(s, '포인트 3,800 → 3,000', (await bal('$st_points')) === 3000, 3000, await bal('$st_points'));
  await act('mall-page', 'orders');
  const o2 = J(await vars(), '$bm_orders').find((x) => x.item.name === '안대형 수면 마스크');
  await act('mall-pickup', o2.id, 700);
  const o2b = J(await vars(), '$bm_orders').find((x) => x.item.name === '안대형 수면 마스크');
  const t = await screen();
  check(s, '누르면 「수령하러 감」만(소지품엔 아직 없음)', o2b.reqKey === 'c3' && !o2b.taken && !J(await vars(), '$st_items').list.some((x) => x.name === '안대형 수면 마스크') && t.includes('수령하러 감'), 'reqKey c3', { o: o2b, screen: /수령하러 감/.test(t) });
  await closeWin(page);
  const n0 = await llmCount();
  const out = await mainRequest('대여창고로 내려간다.', 'u4');
  writeReq(s, out, undefined, `■ 본편 요청 (이 요청 중 보조 호출 ${(await llmCount()) - n0}회 — 인물 기록 Router 등, 가짜 답 없음)\n`);
  const inv = inventoryOf(out);
  check(s, '받으러 감(PICKUP_TRY) 한 번, 마스크', (inv.match(/sets out to collect in person[^;]*안대형 수면 마스크/g) ?? []).length === 1, 1, /this turn the protagonist sets out[^;]*/.exec(inv)?.[0]);
  check(s, '수령 대기 줄에 같은 물건이 겹치지 않음', !/not collected yet[^\n]*안대형 수면 마스크/.test(inv), '없음', /Bought at 백일몽[^\n]*/.exec(inv)?.[0] ?? '');
  // 응답: 대여창고가 닫혀 못 받음. 갱신기 답은 주지 않는다(실패) → 못 받은 것으로
  await botReply(B4, 'c4');
  await sleep(1500);
  const o2c = J(await vars(), '$bm_orders').find((x) => x.item.name === '안대형 수면 마스크');
  check(s, '못 받았으면 소지품에 안 들어옴', !o2c.taken && !J(await vars(), '$st_items').list.some((x) => x.name === '안대형 수면 마스크'), '안 받음', o2c);
  const out2 = await peekMain('내일 다시 가기로 한다.');
  const inv2 = inventoryOf(out2);
  writeReq(s, out2, undefined, '■ 다음 턴 미리 보기\n', '_다음턴');
  check(s, '다음 턴: PICKUP_TRY 다시 안 감, 수령 대기 줄로 돌아옴', !inv2.includes('sets out to collect') && /not collected yet[^\n]*안대형 수면 마스크/.test(inv2), 'PICKUP_WAIT', /Bought at 백일몽[^\n]*/.exec(inv2)?.[0] ?? thisTurn(inv2));
  await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '0'; });
  await saveState(s);
}

// 1:1 상담
{
  const s = step('일대일상담');
  await closeWin(page); await openWin(page); await sleep(300);
  if (!(await page.$('.ms-bm'))) { await act('nav-tab', 'net'); await act('br-go', 'bm', 600); }
  await act('mall-page', '');
  await queue(DESK_MAKE);
  let n0 = await llmCount();
  await act('mall-ask', '', 100);
  await waitLlm(n0);
  let msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, DESK_MAKE, '■ 상담원 만들기\n', '_연결');
  let all = allText(msgs);
  check(s, '연결 요청: MAKE·MANUAL·주사위·손님(계정·남은 포인트 3,000p)', all.includes('Create the counselor') && /사내 계정: 토끼\n남은 포인트: 3,000p/.test(all), 'CUSTOMER 토끼 · 3,000p', /\[손님\][^\n]*\n[^\n]*\n[^\n]*/.exec(all)?.[0]);
  check(s, '지금 진열 상품 목록(이름|값p|설명)', /\[지금 진열된 상품\]\n[^\n]*\|\d+p\|/.test(all), 'SHELF_LINE', /\[지금 진열된 상품\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '진행 중 괴이·사건 칸에 자리표 없음', !/<[^<>\n]{1,8}>/.test(sit(all)), '없음', sit(all));
  const d0 = J(await vars(), '$bm_desk');
  const txt0 = await screen();
  check(s, '상담원 저장, 화면엔 번호 호칭만(실명·부서 안 보임)', d0?.agent?.name === '김하영' && /상담원 \d{4}/.test(txt0) && !txt0.includes('김하영') && !txt0.includes('인사팀'), '상담원 NNNN', txt0.slice(-300));
  await queue(DESK_TALK);
  n0 = await llmCount();
  await act('mall-say', '응급 키트에 뭐 들어 있어요?', 100);
  await waitLlm(n0);
  msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, DESK_TALK, '■ 상담 대화\n', '_대화');
  all = allText(msgs);
  check(s, '대화 요청: 카드 + 대화(마지막 줄이 방금 한 말)', all.includes('손님에게 보이는 호칭: 상담원') && /응급 키트에 뭐 들어 있어요\?/.test(all), '카드·대화', all.includes('손님에게 보이는 호칭'));
  const d1 = J(await vars(), '$bm_desk');
  check(s, '답 말풍선 2개(빈 줄로 나눔) 저장', d1.talk.filter((l) => l.who === 'op').length === 3, 'op 3줄(인사1+답2)', d1.talk);
  await act('mall-ask-close');
  await closeWin(page);
  const out = await mainRequest('상담을 마치고 업무로 돌아간다.', 'u5');
  writeReq(s, out, undefined, '', '_본편');
  const inv = inventoryOf(out);
  check(s, '본편에 상담(MALL.DESK) 한 번', (inv.match(/chatted by text with a counselor on the 백일몽 포인트몰 1:1 상담/g) ?? []).length === 1, 1, /chatted by text with a counselor[^;]*/.exec(inv)?.[0]);
  await botReply(`업무가 이어졌다.\n${BST('10:20 PM', 3000)}`, 'c5');
  const inv2 = inventoryOf(await peekMain('퇴근한다.'));
  check(s, '그다음 턴엔 상담 사건이 안 감', !inv2.includes('chatted by text with a counselor'), '없음', thisTurn(inv2));
  await saveState(s);
}

// 다시 열기·새로고침 (피할 목록)
{
  const s = step('새로고침_피할목록');
  await openSite('bm');
  await act('mall-page', '');
  await queue(BM_SHELF2);
  const n0 = await llmCount();
  await act('mall-refresh', '');
  await waitLlm(n0);
  const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
  writeReq(s, msgs, BM_SHELF2);
  const all = allText(msgs);
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '피할 목록에 산 응급 키트·마스크', avoid.includes('현장용 소형 응급 키트') && avoid.includes('안대형 수면 마스크'), '두 개', avoid || '(없음)');
  check(s, '피할 목록(또는 지금 진열대)에 지금 걸린 앰플 (상점 문제 1과 같은 길)', avoid.includes('B등급 꿈결용액 앰플') || /\[지금 진열대\][\s\S]*앰플/.test(all), '앰플', avoid || '(없음)');
  check(s, 'RESTOCK, 정체 고정, 포인트', all.includes('[가게 정체 — 고정]') && all.includes('currency: points') && !all.includes('First visit'), 'RESTOCK', all.includes('First visit'));
  check(s, '포인트(3000) 안 넘김', !/\|3000\]/.test(all), '없음', /[^\n]*\|3000\][^\n]*/.exec(all)?.[0] ?? '');
  const st = J(await vars(), '$bm_shop');
  check(s, '새 진열 2개(목걸이 줄·손난로)', st.items.filter((x) => !x.sold).map((x) => x.name).sort().join() === ['사원증 목걸이 줄', '휴대용 손난로'].sort().join(), '두 개', st.items.map((x) => `${x.name}:${!!x.sold}`));
  await saveState(s);
}

// 갈래: 산 턴을 다시 굴림 → 포인트·수령 대기가 같이 되돌아가나
{
  const s = step('갈래_산턴_다시굴리기');
  const c = await snap();
  const i = c.message.findIndex((m) => m.chatId === 'c3');
  c.message = c.message.slice(0, i + 1);
  c.message[i] = { role: 'char', data: B3, chatId: 'c3b' };
  await page.evaluate((c) => { window.__chat = c; }, c);
  await page.evaluate(async (i) => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: i }); }, i);
  await sleep(400);
  await openSite('bm');
  const txt = await screen();
  check(s, '마스크 산 턴(c3)이 지워짐 → 보유 3,800 P 로', txt.includes('3,800 P'), '3,800 P', /보유 포인트[^\n]*\n?[^\n]*/.exec(txt)?.[0]);
  await act('mall-page', 'orders');
  const ot = await screen();
  check(s, '주문 조회에서 마스크가 빠짐, 응급 키트는 받음으로', !ot.includes('안대형 수면 마스크') && ot.includes('현장용 소형 응급 키트'), '키트만', /주문 조회[\s\S]{0,300}/.exec(ot)?.[0]);
  await saveState(s);
}

// 갈래: 백일몽을 나와 관리국 신분이 됨 (포인트 기록이 있으면 몰이 남나)
{
  const s = step('갈래_소속바뀜');
  await botReply(`인사 발령이 났다. 사원증을 반납했다.\n${BST('11:00 PM', 3000, '관리국/신입')}`, 'c9');
  await closeWin(page); await openWin(page); await sleep(300);
  await act('nav-tab', 'net');
  await act('br-home', '', 500);
  const sites = await page.evaluate(() => [...document.querySelectorAll('[data-action="br-go"]')].map((e) => e.dataset.value));
  const flag = (await vars())['$st_points_on'];
  check(s, '신분이 관리국으로 바뀌면 포인트 칸 자동 꺼짐($st_points_on 0)', flag === '0', '0', flag);
  note(s, '관리국 신분이 된 뒤 브라우저에 포인트몰이 남나 (기대값 근거 없음 → 사용자에게 물음)', { bm: sites.includes('bm'), sites });
  await saveState(s);
}

allErrors.push(...errors);
writeFileSync(`${OUT}결과.json`, JSON.stringify({ commit: process.env.GIT_COMMIT ?? '', results, notes, pageErrors: allErrors }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과${allErrors.length ? ` · 페이지 오류 ${allErrors.length}: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
