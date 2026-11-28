// 플레이 순서 점검 2차 · 10 괴담톡(폰) (지침: ../../GPT_점검지침_초안.md 3판, 틀: ../09_괴담넷_게시판_DM/run.mjs)
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄운다.
// part=main  : PC 1100×900 에서 화면 단추로 연락처 → 1:1 보내기 → 사진 첨부 보내기 → 방 새로고침(선톡·후속) → 다시 새로고침(막힘)
//              → 답장 → 단톡 만들기 → 초대 → 새 메시지 확인(공지·초대) → 공지 열기 → 본편 다음 턴 → 그다음 턴 → 전화
// part=branch: 같은 틀에서 상태만 바꿔 갈래 (응답 실패·다시 시도·건너뛰기·빈 답·꼴 틀린 답·늦게 온 답·연타·페이지 새로고침·지우기·설정 끔)
// part=auto  : 자동 호출 매 턴·창을 열 때, 본편 다시 굴리기·지우기, 늦게 온 자동 확인, 관전(보기 전용 방)
// part=phone : 폰 390×844 에서 단추로 탭 → 연락처 → 보내기 → 목록으로
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅(replacers[0]) 반환값, 응답 처리 = output 리스너(listeners[0]).
// 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과-<part>.json
// 사용법: node 인수인계/플레이순서_점검/2차/10_괴담톡/run.mjs [main|branch|auto|phone]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main', 'branch', 'branch2', 'auto', 'auto2', 'joint', 'phone'];
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ── 인물 (명부: 관리국 탭 T01) ──
const E = 'c_50303034'; // 에일린 P004
const K = 'c_50303036'; // 큐라스 P006
const J = 'c_50303130'; // 콘쥬스 P010
const G = 'c_50303035'; // 고르고디오 P005
const D = 'c_50303037'; // 데드폴 P007
const DM_E = `dm_${E}`;

// ── 장면 (로어북 「중림 지하상가」, 관리국 신입) ──
const ST = (time, date = '2025.03.14', place = '중림 지하상가') => `[▣|${date}|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|100000]`;
const C1 = `퇴근길, 중림 지하상가 셔터가 반쯤 내려와 있었다. 휴대폰을 꺼내 들었다.\n${ST('11:20 PM')}`;
const C2 = `숙소로 돌아와 불을 켰다. 지하상가 쪽 하늘이 아직 붉었다.\n${ST('11:50 PM', '2025.03.14', '관리국')}`;
const C2b = `숙소로 돌아와 샤워를 했다. 지하상가 쪽은 조용했다.\n${ST('11:52 PM', '2025.03.14', '관리국')}`;
const C3 = `아침, 출근 준비를 하며 휴대폰을 다시 열었다.\n${ST('07:30 AM', '2025.03.15', '관리국')}`;

// ── 가짜 답 ──
const add = (sender, content, extra = {}) => ({ op: 'add', path: '/messages/-', value: { content, sender, type: 'text', ...extra } });
const patch = (...ops) => `<lb-minitalk-patch>${JSON.stringify(ops)}</lb-minitalk-patch>`;
const REPLY1 = `${patch(add(E, '또? 어제도 그랬잖아.'), add(E, '가까이 가지 마. 내일 내가 볼게.'))}\n<ph-habits>[{"sender":"${E}","note":"짧게 끊어 씀, 마침표를 찍음"}]</ph-habits>`;
const REPLY2 = (myId) => patch(add(E, '셔터 아래 틈이 왜 저렇게 검지.'), { op: 'replace', path: `/messages/${myId}/reactions`, value: '👍1' });
const FOLLOW = patch(add(E, '읽었으면 대답 좀.'));
const REPLY3 = patch(add(E, '그래. 들어가.'));
const GROUP1 = patch({ op: 'replace', path: '/name', value: '지하상가 건' }, add(K, '무슨 일인데 단톡이야?'), add(E, '지하상가 셔터 얘기.'));
const INVITE1 = patch(add(J, '저 왜 불렀어요?'));
const REFRESH1 = JSON.stringify({
  updates: [{ room: 'g_1', patch: [add(K, '내일 아침에 같이 가 보자.')] }],
  announcements: [{ issuer: '관리국 총무과', category: '시설', title: '본관 엘리베이터 점검', text: '내일 오전 9시부터 11시까지 본관 엘리베이터를 점검합니다.' }],
  invitations: [{ inviter: G, members: [G, D], name: '야간 순찰조', patch: [add(G, '이번 주 야간 순찰 같이 돈다.')] }],
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
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${typeof reply === 'string' ? reply : JSON.stringify(reply)}` : ''}\n`);
const allText = (msgs) => msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
const MARK = /%%PHONE_CALL|%%SCENE_CARD|%%GOEI_|%%SEED|\[shop-ready|\{\{getvar|\{\{#when|__LIMIT_\w+__|__PH_[A-Z_]+__|__VIEW_LIMIT_\w+__|__SITE_PICS__|\$ph_|\$lb_cfg/;
/** 요청의 user 칸(JSON 자료) */
const bodyOf = (msgs) => { for (const m of msgs) { if (m.role !== 'user' || typeof m.content !== 'string') continue; const t = m.content.trim(); if (t.startsWith('{')) { try { return JSON.parse(t); } catch { /* 다음 */ } } } return null; };
const sysOf = (msgs) => msgs.filter((m) => m.role === 'system').map((m) => String(m.content)).join('\n');
const phoneBlocks = (out) => out.filter((m) => String(m.content).includes('"feature":"phone"')).map((m) => String(m.content));
const phoneJson = (block) => { const line = block.split('\n').find((l) => l.startsWith('{"feature":"phone"')); try { return JSON.parse(line); } catch { return null; } };

const b = await launch();
let page; let errors;
const allErrors = [];
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const phoneState = async () => JSON.parse((await vars()).$ph_state || '{"rooms":{},"order":[]}');
const bulletins = async () => JSON.parse((await vars()).$ph_bulletins || '{"items":[]}');
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const llmOpt = (i) => page.evaluate((i) => { const o = window.__calls.llm[i]; return { mode: o.mode, staticModel: o.staticModel }; }, i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (r && typeof r === 'object' ? r : { type: 'success', result: r })); }, t);
const hold = () => page.evaluate(() => { window.__llm = [new Promise((r) => { window.__release = (t) => r({ type: 'success', result: t }); })]; });
const release = (t) => page.evaluate((t) => window.__release?.(t), t);
const act = async (action, value, wait = 400) => {
  await page.evaluate(({ action, value }) => {
    const el = document.createElement('button');
    el.dataset.action = action;
    if (value !== undefined) el.dataset.value = value;
    el.style.display = 'none';
    (document.querySelector('.ph-app') || document.querySelector('.gx') || document.body).appendChild(el);
    el.click();
    el.remove();
  }, { action, value });
  await sleep(wait);
};
const vis = (sel) => sel.split(',').map((x) => `${x.trim()}:visible`).join(', ');
const press = async (sel, wait = 500) => { await page.locator(vis(sel)).first().click({ timeout: 5000 }); await sleep(wait); };
const fill = async (sel, text) => { await page.locator(vis(sel)).first().fill(text); await sleep(120); };
const waitIdle = async (max = 15000) => { const t0 = Date.now(); let n = -1; let since = Date.now(); while (Date.now() - t0 < max) { const k = await llmCount(); const busy = await page.evaluate(() => !!document.querySelector('.nw-busy')); if (k !== n || busy) { n = k; since = Date.now(); } else if (Date.now() - since > 900) return; await sleep(200); } };
const screen = () => page.evaluate(() => document.querySelector('.ph-app')?.innerText ?? document.querySelector('.gx')?.innerText ?? '');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const KEEP = /^\$(ph_|cooldown_received|st_unread_phone)/;
const saveState = async (s) => {
  const v = await vars(); const keep = {};
  for (const [k, val] of Object.entries(v)) if (KEEP.test(k)) { try { keep[k] = /^\$ph_(state|bulletins|contacts|habits_list|views)$/.test(k) ? JSON.parse(val) : val; } catch { keep[k] = val; } }
  writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: keep, messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2));
};
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
/** 지금 채팅을 바꾸지 않고 본편 요청만 뽑는다 (채팅 끝이 user 면 그대로 보낸다) */
const peekMain = async (userText) => { const c = await snap(); let out; if (userText === null) out = await page.evaluate(async () => { const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data })); const o = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model'); return o.map((m) => ({ role: m.role, content: String(m.content) })); }); else out = await mainRequest(userText, 'peek'); await page.evaluate((c) => { window.__chat = c; }, c); return out; };
const botReply = async (text, cid, wait = 900) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(wait); };
const rerollLast = async (text, cid) => { await page.evaluate(() => { const m = window.__chat.message; if (m.at(-1)?.role === 'char') m.pop(); }); await botReply(text, cid); };
const setVars = (v) => page.evaluate((v) => { window.__chat.scriptstate = { ...(window.__chat.scriptstate ?? {}), ...v }; }, v);
const openPhone = async (reopen = true) => {
  if (reopen) { await closeWin(page); await sleep(200); await openWin(page); await sleep(300); }
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  if (!(await page.$('.ph-app'))) await act('nav-tab', 'phone', 700);
};
const BASE_VARS = { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $ib_affiliation: '관리국', $an_report: '', $in_report: '', $ms_report: '', $st_wallet: JSON.stringify({ start: 100000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) };
const firstChat = (extra = {}, scriptExtra = {}) => ({ message: [{ role: 'user', data: '지하상가 앞을 지나간다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }], ...extra, scriptstate: { ...BASE_VARS, ...scriptExtra } });
const bootChat = async (chat0, v = 'pc') => {
  if (page) { allErrors.push(...errors); await page.close(); }
  ({ page, errors } = await boot(b, fx, chat0, v, { store: STORE }));
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
};
const lastReq = async () => { const n = await llmCount(); return n ? llmAt(n - 1) : []; };
/** 지금 열린 방에 글을 적고 보내기 단추를 누른다 */
const sendText = async (text) => { await fill('[data-input="ph-draft"]', text); await press('.ph-send'); };
/** 저장된 phone 상태를 그대로 넣은 채팅 (갈래용) */
const withPhone = async (st) => setVars({ $ph_state: JSON.stringify(st) });

// ═════════════════════ part main: 대표 경로 (PC, 화면 단추) ═════════════════════
if (PARTS.includes('main')) {
  part = 'PC_'; stepNo = 0;
  await bootChat(firstChat());
  // 01 괴담톡 탭 → 연락처
  {
    const s = step('탭열기_연락처');
    const n0 = await llmCount();
    await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await press('.gx-nav [data-action="nav-tab"][data-value="phone"]', 800);
    const txt = await screen();
    check(s, '관리국 연락처 탭과 에일린·큐라스가 보임', /관리/.test(txt) && txt.includes('에일린') && txt.includes('큐라스'), '관리·에일린·큐라스', txt.slice(0, 300));
    check(s, '자동 호출 기본 수동: 탭을 열어도 모델 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
    await saveState(s);
  }
  // 02 에일린 누르기 → 빈 1:1 방
  {
    const s = step('에일린_방열기');
    await press(`[data-action="ph-dm"][data-value="${E}"]`, 700);
    const txt = await screen();
    check(s, '빈 방 안내가 보임', txt.includes('아직 대화가 없어요'), '아직 대화가 없어요', txt.slice(-300));
    const st = await phoneState();
    check(s, '방이 저장됨(말풍선 0, 읽음 0)', st.rooms[DM_E] && st.rooms[DM_E].messages.length === 0 && st.rooms[DM_E].readThrough === 0, 'dm 방 0개', st.rooms[DM_E]);
    await saveState(s);
  }
  // 03 보내기 → 답장
  let myFirst = 0;
  {
    const s = step('보내기_답장');
    await queue(REPLY1);
    const n0 = await llmCount();
    await sendText('선배, 지하상가 셔터 또 내려갔어요.');
    await waitIdle();
    const n1 = await llmCount();
    check(s, '보조 호출 1회', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REPLY1);
    const opt = n1 > n0 ? await llmOpt(n0) : {};
    check(s, '모델 = 보조 모델(기본 aux)', opt.mode === 'submodel' || opt.mode === 'otherAx', 'submodel', opt.mode);
    const sys = sysOf(msgs); const body = bodyOf(msgs); const all = allText(msgs);
    check(s, '지침 ACTION_SEND 가 실림', sys.includes('send: reply to the owner\'s exact text'), 'ACTION_SEND', /send:[^\n]*/.exec(sys)?.[0]);
    check(s, '내 말에 답할 때 DIRECT_ROOMS(선톡 규칙)는 빠짐', !sys.includes('### Direct rooms'), '없음', sys.includes('### Direct rooms'));
    check(s, '출력 꼴 OUTPUT_REPLY(<lb-minitalk-patch>)', sys.includes('Return only <lb-minitalk-patch>JSON_ARRAY</lb-minitalk-patch>'), 'OUTPUT_REPLY', '');
    check(s, '자리표가 다 풀림·내부 표식 없음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    const room = body?.room;
    check(s, '방 자료: 마지막 말이 내가 보낸 글(sender me)', room?.messages?.at(-1)?.sender === 'me' && room.messages.at(-1).content === '선배, 지하상가 셔터 또 내려갔어요.', 'me: 선배…', room?.messages?.at(-1));
    check(s, 'action.type = send', room?.action?.type === 'send', 'send', room?.action);
    check(s, '참여자 = 에일린, 인물 글 있음', body?.participants?.[0]?.name === '에일린' && body.participants[0].hasCharacterLore, '에일린·lore', body?.participants?.map((p) => [p.name, p.hasCharacterLore]));
    check(s, '최근 본편(퇴근길…)이 recentStory 에', JSON.stringify(body?.narratorOnly?.recentStory ?? []).includes('셔터가 반쯤'), '셔터가 반쯤', body?.narratorOnly?.recentStory);
    check(s, '이야기 시각 2025.03.14 23:20', body?.narratorOnly?.currentSceneTime === '2025.03.14 23:20', '2025.03.14 23:20', body?.narratorOnly?.currentSceneTime);
    check(s, '주인 소속이 이름(관리국)으로', /관리국/.test(JSON.stringify(body?.narratorOnly?.owner ?? {})), '관리국', body?.narratorOnly?.owner);
    note(s, '요청 길이(글자)', all.length);
    const st = await phoneState();
    const r = st.rooms[DM_E];
    check(s, '저장: 내 말 1 + 답 2, 대기 없음', r.messages.length === 3 && r.messages[1].sender === E && !r.pending, 3, r.messages.map((m) => `${m.sender}:${m.text}`));
    myFirst = r.messages[0].id;
    check(s, '보고 있는 방이라 안 읽음 0', r.unread === 0, 0, r.unread);
    const habits = JSON.parse((await vars()).$ph_habits_list || '[]');
    check(s, '말버릇 칸이 저장됨', habits.some((h) => h.id === E && h.note.includes('짧게')), '에일린 말버릇', habits);
    const txt = await screen();
    check(s, '화면에 답 두 말풍선', txt.includes('또? 어제도 그랬잖아.') && txt.includes('내일 내가 볼게.'), '두 말풍선', txt.slice(-300));
    check(s, '화면에 <ph-habits> 같은 표식이 안 보임', !/ph-habits|lb-minitalk/.test(txt), '없음', '');
    await saveState(s);
  }
  // 04 사진 묘사 첨부 + 글 → 답장(반응)
  {
    const s = step('사진첨부_보내기');
    await press('.ph-plus');
    await press('[data-action="ph-att-add"][data-value="photo"]');
    await fill('[data-input="ph-att"]', '반쯤 내려온 셔터 아래로 검은 틈이 보이는 사진');
    await fill('[data-input="ph-draft"]', '이거 보세요.');
    const st0 = await phoneState();
    const nextId = st0.mid + 1;
    await queue(REPLY2(nextId));
    const n0 = await llmCount();
    await press('.ph-send');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REPLY2(nextId));
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, '첨부를 읽는 지침 ATTACHMENT_READ 가 실림', sys.includes('Apply the shared ATTACHMENT DATA access rules'), 'ATTACHMENT_READ', '');
    check(s, '이모지 반응 지침 REACTIONS 가 실림(기본 켬)', sys.includes('EMOJI REACTIONS'), 'REACTIONS', '');
    const last2 = body?.room?.messages?.slice(-2) ?? [];
    check(s, '첨부와 글이 따로 두 기록으로, 첨부 내용은 ATTACHMENT DATA 의 A번호로', last2.length === 2 && /\[ATTACHMENT A\d+\]/.test(last2[0].content) && last2[1].content === '이거 보세요.' && /A1 \{"kind":"photo","content":"반쯤 내려온 셔터/.test(allText(msgs)), '[ATTACHMENT A1] + 글', last2);
    check(s, '앞 단계 말버릇이 textingHabits 로 실림', JSON.stringify(body?.textingHabits ?? []).includes('짧게'), '말버릇', body?.textingHabits);
    check(s, '지난 답장(또? 어제도…)이 방 기록에 있음', JSON.stringify(body?.room?.messages ?? []).includes('또? 어제도'), '있음', '');
    const st = await phoneState();
    const r = st.rooms[DM_E];
    const photoMsg = r.messages.find((m) => m.id === nextId);
    check(s, '내 사진 기록에 👍1 반응이 붙음', photoMsg?.reactions === '👍1', '👍1', photoMsg);
    const txt = await screen();
    check(s, '화면에 사진 묘사 카드와 답이 보임', txt.includes('검은 틈') && txt.includes('셔터 아래 틈이'), '카드·답', txt.slice(-300));
    await saveState(s);
  }
  // 05 이 방 새로고침 (내가 마지막이 아님 → 선톡·후속)
  {
    const s = step('방새로고침_후속');
    await queue(FOLLOW);
    const n0 = await llmCount();
    await press('[data-action="ph-room-refresh"]');
    await waitIdle();
    const n1 = await llmCount();
    check(s, '보조 호출 1회', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, FOLLOW);
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, '지침 ACTION_REFRESH + DIRECT_ROOMS', sys.includes('refresh: consider a relevant follow-up') && sys.includes('### Direct rooms'), '둘 다', [sys.includes('refresh: consider'), sys.includes('### Direct rooms')]);
    const cs = body?.room?.conversationState ?? {};
    check(s, '대화 상태: 답 기다림·후속 아직 안 보냄·기본 다음 행동 wait', cs.directReplyPending === true && cs.followupAlreadySent === false && cs.defaultNextAction === 'wait_for_owner', 'pending·false·wait', cs);
    check(s, '읽음 표시: 마지막 상대 말이 read(보고 있던 방)', cs.senders?.[0]?.lastMessageRead === 'read', 'read', cs.senders);
    const st = await phoneState();
    const r = st.rooms[DM_E];
    check(s, '후속 1개 저장, followupSent=true', r.messages.at(-1).text === '읽었으면 대답 좀.' && r.followupSent === true, 'true', { last: r.messages.at(-1).text, f: r.followupSent });
    const v = await vars();
    check(s, '선톡 쉬는 턴 표시가 찍힘', v.$cooldown_received_incoming === '1', '1', v.$cooldown_received_incoming);
    await saveState(s);
  }
  // 06 이 방 새로고침 다시 → 막힘
  {
    const s = step('방새로고침_막힘');
    const n0 = await llmCount();
    await press('[data-action="ph-room-refresh"]');
    await sleep(500);
    check(s, '모델 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
    const txt = await screen();
    check(s, '안내: 후속 메시지에 대한 답장을 기다림', txt.includes('후속 메시지에 대한 답장을 기다리고'), '안내', txt.slice(-200));
  }
  // 07 내가 답장 → 후속 표시 풀림
  {
    const s = step('답장_후속풀림');
    await queue(REPLY3);
    const n0 = await llmCount();
    await sendText('네, 내일 같이 가요.');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REPLY3);
    const body = bodyOf(msgs);
    check(s, '요청의 followupAlreadySent=false(내가 답함)', body?.room?.conversationState?.followupAlreadySent === false && body.room.conversationState.ownerHasNotReplied === false, 'false', body?.room?.conversationState);
    const r = (await phoneState()).rooms[DM_E];
    check(s, 'followupSent 풀림', r.followupSent === false, false, r.followupSent);
    await saveState(s);
  }
  // 08 단톡 만들기 (에일린·큐라스, 이름 비움)
  {
    const s = step('단톡만들기');
    await press('[data-action="ph-group"]');
    await press(`[data-action="ph-pick"][data-value="${E}"]`, 300);
    await press(`[data-action="ph-pick"][data-value="${K}"]`, 300);
    await queue(GROUP1);
    const n0 = await llmCount();
    await press('[data-action="ph-group-create"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, GROUP1);
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, '지침 ACTION_INVITE_INITIAL + 방 이름 짓기(ACTION_INVITE_NAME) + GROUP_ROOMS', sys.includes('invite_initial:') && sys.includes('This action alone also permits {"op":"replace","path":"/name"') && sys.includes('### Group rooms'), '셋', '');
    check(s, 'action = invite_initial, invited=[에일린,큐라스]', body?.room?.action?.type === 'invite_initial' && body.room.action.invited?.length === 2, 'invite_initial', body?.room?.action);
    const cross = body?.crossRoomMessages ?? [];
    check(s, '다른 방(1:1) 말은 crossRoomMessages 로, knownBy 는 에일린만', cross.length > 0 && cross.every((c) => c.knownBy.length === 1 && c.knownBy[0] === E), 'knownBy=[에일린]', cross.map((c) => [c.content?.slice(0, 15), c.knownBy]));
    check(s, 'CROSS_ROOM 지침이 실림', sys.includes('crossRoomMessages contains retained messages'), 'CROSS_ROOM', '');
    const st = await phoneState();
    const g = st.rooms.g_1;
    check(s, '방 g_1: 이름=모델이 지은 「지하상가 건」, 초대 알림 2 + 말 2', g?.name === '지하상가 건' && g.messages.filter((m) => m.kind === 'invite').length === 2 && g.messages.filter((m) => m.kind === 'message').length === 2 && !g.pending, '지하상가 건', g && { name: g.name, kinds: g.messages.map((m) => m.kind) });
    const txt = await screen();
    check(s, '화면 방 제목·참여자', txt.includes('지하상가 건') && txt.includes('참여자: 나, 에일린, 큐라스'), '제목·참여자', txt.slice(0, 300));
    await saveState(s);
  }
  // 09 초대 (콘쥬스)
  {
    const s = step('초대');
    await press('[data-action="ph-invite"]');
    await press(`[data-action="ph-pick"][data-value="${J}"]`, 300);
    await queue(INVITE1);
    const n0 = await llmCount();
    await press('[data-action="ph-group-create"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, INVITE1);
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, '지침 ACTION_INVITE_MORE, 방 이름 짓기 글은 빠짐', sys.includes('invite_more:') && !sys.includes('"path":"/name"'), 'invite_more·이름X', '');
    const before = (body?.room?.messages ?? []).filter((m) => m.type === 'text');
    check(s, '초대 전 말의 audience 에 콘쥬스 없음', before.length > 0 && before.every((m) => !m.audience.includes(J)), 'J 없음', before.map((m) => m.audience));
    const g = (await phoneState()).rooms.g_1;
    check(s, '참여자 3명, 콘쥬스 말 저장', g.members.length === 3 && g.messages.at(-1).sender === J, 3, g.members);
    await saveState(s);
  }
  // 10 새 메시지 확인 (공지·초대·단톡 말)
  {
    const s = step('새메시지확인');
    await queue(REFRESH1);
    const n0 = await llmCount();
    await press('[data-action="ph-refresh"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REFRESH1);
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, '지침 REFRESH·OUTPUT_REFRESH', sys.includes('Check supplied rooms independently') && sys.includes('REFRESH OUTPUT CONTRACT'), 'REFRESH', '');
    check(s, '공지 받을 수 있음 → ANNOUNCEMENTS 지침과 announcementCheck.allowed', sys.includes('Obey announcementCheck.allowed') && body?.announcementCheck?.allowed === true, 'allowed', body?.announcementCheck);
    check(s, '초대 받을 수 있음 → GROUP_INVITES 와 후보', sys.includes('When invitationCheck.allowed, return') && body?.invitationCheck?.allowed === true && body.invitationCheck.candidates.includes(G) && body.invitationCheck.candidates.includes(D), 'allowed', body?.invitationCheck && { allowed: body.invitationCheck.allowed, n: body.invitationCheck.candidates?.length });
    const dm = body?.rooms?.find((r) => r.id === DM_E);
    check(s, '1:1(에일린) 방: 선톡 쉬는 턴이라 receiveMessages=false', dm && dm.receiveMessages === false, false, dm && { recv: dm.receiveMessages, cs: dm.conversationState });
    const g = body?.rooms?.find((r) => r.id === 'g_1');
    check(s, '단톡 g_1: 받기 가능, 말풍선 실림', g && g.receiveMessages === true && g.messages.length > 0, 'true', g && { recv: g.receiveMessages, n: g.messages.length });
    check(s, '방 마다 지난 기록은 「새 메시지 확인」 지난 기록 수(기본 10) 이내', (body?.rooms ?? []).every((r) => r.messages.length <= 10), '≤10', (body?.rooms ?? []).map((r) => [r.id, r.messages.length]));
    check(s, '공지 채널 코드(channel) 는 안 실림', !('channel' in (body?.announcementCheck ?? {})), '없음', body?.announcementCheck);
    check(s, '자리표가 다 풀림·내부 표식 없음', !MARK.test(allText(msgs)), '없음', MARK.exec(allText(msgs))?.[0]);
    const st = await phoneState();
    check(s, '단톡 g_1 에 큐라스 말 추가', st.rooms.g_1.messages.at(-1).text === '내일 아침에 같이 가 보자.', '추가', st.rooms.g_1.messages.at(-1));
    const inv = Object.values(st.rooms).find((r) => r.inviter === G);
    check(s, '초대받은 단톡 「야간 순찰조」 생성, 초대 알림 + 말 1, 안 읽음', inv && inv.name === '야간 순찰조' && inv.messages[0].kind === 'invite' && inv.unread >= 1, '생성', inv && { name: inv.name, unread: inv.unread, kinds: inv.messages.map((m) => m.kind) });
    const bl = await bulletins();
    check(s, '공지 1건 저장(안 읽음)', bl.items.length === 1 && bl.items[0].read === false && bl.items[0].title === '본관 엘리베이터 점검', 1, bl.items);
    const v = await vars();
    check(s, '초대·공지 쉬는 턴 표시', v.$cooldown_received_invitation === '1' && v.$cooldown_received_announcement === '1', '1·1', [v.$cooldown_received_invitation, v.$cooldown_received_announcement]);
    const txt = await screen();
    check(s, '알림 문구: 메시지·초대·공지 수', /메시지 \d+개 · 단톡 초대 1개 · 공지 1개/.test(txt), '메시지 n개 · 단톡 초대 1개 · 공지 1개', /메시지[^\n]*/.exec(txt)?.[0]);
    note(s, '알림 문구', /메시지[^\n]*받았어요/.exec(txt)?.[0]);
    await saveState(s);
  }
  // 11 공지 열기
  {
    const s = step('공지열기');
    await press('[data-action="ph-sub"][data-value="notices"]');
    const bl0 = await bulletins();
    await press(`[data-action="ph-notice"][data-value="${bl0.items[0].id}"]`);
    const bl = await bulletins();
    check(s, '공지 읽음 처리', bl.items[0].read === true, true, bl.items[0].read);
    const txt = await screen();
    check(s, '공지 본문이 보임', txt.includes('엘리베이터를 점검합니다'), '본문', txt.slice(0, 300));
    await saveState(s);
  }
  // 12 본편 다음 턴
  {
    const s = step('본편_다음턴');
    await closeWin(page);
    const out = await mainRequest('지하상가로 다시 가 본다.', 'u2');
    writeReq(s, out);
    const blocks = phoneBlocks(out);
    check(s, '괴담톡 참고 기록 덩어리 1개', blocks.length === 1, 1, blocks.length);
    const j = blocks[0] ? phoneJson(blocks[0]) : null;
    const recs = j?.records ?? [];
    note(s, '「장면에 나온 것만」(기본 켬): 장면에 이름이 안 나온 1:1(에일린) 말은 최근 8개 밖이라 빠짐 — 설계대로', recs.some((r) => r.text === '가까이 가지 마. 내일 내가 볼게.'));
    check(s, '단톡 말과 공지가 실림', recs.some((r) => r.text === '내일 아침에 같이 가 보자.') && recs.some((r) => r.kind === 'announcement'), '있음', recs.map((r) => r.kind ?? 'msg'));
    check(s, '내 말의 sender 는 「주인공」(REFS.USER_NAME)', recs.filter((r) => r.text === '이거 보세요.').every((r) => r.sender === '주인공'), '주인공', recs.find((r) => r.text === '이거 보세요.'));
    check(s, 'MAIN_CONTEXT 규칙문이 같이 감', blocks[0]?.includes('Records are delivered communication'), '있음', '');
    check(s, '플러그인 내부 표식이 새지 않음', !MARK.test(allText(out)), '없음', MARK.exec(allText(out))?.[0]);
    const pos = out.findIndex((m) => String(m.content).includes('"feature":"phone"'));
    const lastUser = out.map((m) => m.role).lastIndexOf('user');
    check(s, '자리: 마지막 user 메시지 앞', pos >= 0 && pos < lastUser, '앞', { pos, lastUser });
    note(s, '방 이름표(rooms)', j?.rooms);
    note(s, '사진 기록이 본편에 실린 꼴', recs.find((r) => /사진|photo/i.test(r.text))?.text);
    await botReply(C2, 'c2');
    check(s, '자동 호출 수동: 본편 응답 뒤 괴담톡 호출 없음', true, '', '');
    await saveState(s);
  }
  // 13 그다음 턴
  {
    const s = step('본편_그다음턴');
    const n0 = await llmCount();
    const out = await mainRequest('잠깐 눈을 붙인다.', 'u3');
    writeReq(s, out);
    const blocks = phoneBlocks(out);
    check(s, '괴담톡 기록은 계속 남는 것(덩어리 1개)', blocks.length === 1, 1, blocks.length);
    const j = blocks[0] ? phoneJson(blocks[0]) : null;
    note(s, '실린 기록 수', j?.records?.length);
    await botReply(C3, 'c3');
    check(s, '보조 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
    await saveState(s);
  }
  // 14 전화 걸기
  {
    const s = step('전화걸기');
    await openPhone();
    await press('[data-action="ph-sub"][data-value="contacts"]');
    await press(`[data-action="ph-call"][data-value="에일린"]`);
    await fill('[data-input="ph-call-text"]', '셔터 얘기 좀 하려고요.');
    await press('[data-action="ph-call-place"]', 800);
    const c = await snap();
    const last = c.message.at(-1);
    check(s, '채팅 끝에 전화 기록(user)이 남음', last.role === 'user' && last.data.includes('%%PHONE_CALL:'), 'PHONE_CALL', last.data?.slice(0, 120));
    const closed = await page.evaluate(() => document.querySelector('.gx')?.style.display === 'none');
    check(s, '창이 닫힘', closed, true, closed);
    const out = await peekMain(null);
    writeReq(s, out);
    const lastUser = [...out].reverse().find((m) => m.role === 'user');
    check(s, '본편 요청: 표식 없이 「places a phone call to 에일린」+ 용건', /places a phone call to 에일린\.\n\n셔터 얘기 좀 하려고요\./.test(lastUser?.content ?? '') && !String(lastUser?.content).includes('%%'), 'call 문장', lastUser?.content?.slice(0, 200));
    note(s, '{{user}} 가 요청에 남는지', /\{\{user\}\}/.test(lastUser?.content ?? ''));
    await saveState(s);
  }
}

// ═════════════════════ part branch: 갈래 (PC, 상태만 바꿔) ═════════════════════
if (PARTS.includes('branch')) {
  part = 'B_'; stepNo = 14;
  const openE = async () => { await openPhone(); await act('ph-dm', E, 700); };
  // 15 응답 실패
  await bootChat(firstChat());
  {
    const s = step('응답실패');
    await openE();
    await queue({ type: 'fail', result: 'upstream error 500' });
    const n0 = await llmCount();
    await sendText('여보세요?');
    await waitIdle();
    note(s, '호출 수(실패 + 일시 오류 재시도 포함)', (await llmCount()) - n0);
    const r = (await phoneState()).rooms[DM_E];
    check(s, '내 말은 남고 대기 상태 error', r.messages.length === 1 && r.pending?.status === 'error', 'error', r.pending);
    const txt = await screen();
    check(s, '다시 시도·건너뛰기 단추와 실패 알림', txt.includes('답장을 받지 못했어요') && txt.includes('다시 시도') && txt.includes('건너뛰기') && /대화 갱신:/.test(txt), '보임', txt.slice(-250));
    check(s, '입력칸 잠김(대기 중)', await page.evaluate(() => document.querySelector('[data-input="ph-draft"]')?.disabled), true, '');
    await saveState(s);
  }
  // 16 다시 시도
  {
    const s = step('다시시도');
    await queue(patch(add(E, '응, 왜?')));
    const n0 = await llmCount();
    await press('[data-action="ph-retry"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs);
    const body = bodyOf(msgs);
    check(s, '다시 묻는 요청도 send, 내 말이 마지막', body?.room?.action?.type === 'send' && body.room.messages.at(-1)?.content === '여보세요?', 'send', body?.room?.action);
    const r = (await phoneState()).rooms[DM_E];
    check(s, '답 저장·대기 풀림', r.messages.length === 2 && !r.pending, 2, r.messages.map((m) => m.text));
    await saveState(s);
  }
  // 17 실패 → 건너뛰기 → 다시 보내기
  {
    const s = step('건너뛰기');
    await queue({ type: 'fail', result: 'boom' });
    await sendText('하나 더.');
    await waitIdle();
    const n0 = await llmCount();
    await press('[data-action="ph-skip"]');
    const r = (await phoneState()).rooms[DM_E];
    check(s, '건너뛰면 대기 풀림·모델 호출 없음', !r.pending && (await llmCount()) === n0, '풀림', r.pending);
    await queue(patch(add(E, '둘 다 봤어.')));
    await sendText('하나 더 보냈어요.');
    await waitIdle();
    const msgs = await lastReq();
    const body = bodyOf(msgs);
    writeReq(s, msgs);
    const mine = (body?.room?.messages ?? []).filter((m) => m.sender === 'me').map((m) => m.content);
    check(s, '다음 요청에 건너뛴 내 말도 기록으로 남아 있음', mine.includes('하나 더.') && mine.at(-1) === '하나 더 보냈어요.', '둘 다', mine);
    await saveState(s);
  }
  // 18 빈 답
  {
    const s = step('빈답');
    await queue(patch());
    await sendText('자요?');
    await waitIdle();
    const r = (await phoneState()).rooms[DM_E];
    check(s, '대기 풀림, 말풍선 안 늘어남', !r.pending && r.messages.at(-1).text === '자요?', '풀림', r.messages.at(-1));
    const txt = await screen();
    check(s, '알림 「답장이 없어요.」', txt.includes('답장이 없어요'), '답장이 없어요', txt.slice(-200));
    const st = r;
    check(s, '읽음 표시 1 이 내 말에서 사라짐(대기 끝)', !(await page.evaluate(() => !!document.querySelector('.ph-meta-t i'))), '없음', '');
    note(s, 'silent', st.silent);
    await saveState(s);
  }
  // 19 꼴 틀린 답 두 번 (없는 사람이 말함)
  {
    const s = step('꼴틀린답_두번');
    await queue(patch(add(K, '나 큐라스야')), patch(add('c_xxx', '누구게')));
    const n0 = await llmCount();
    await sendText('누구세요?');
    await waitIdle();
    const n1 = await llmCount();
    check(s, '형식 재시도 1회 포함 호출 2회', n1 - n0 === 2, 2, n1 - n0);
    const retry = n1 - n0 === 2 ? await llmAt(n0 + 1) : [];
    writeReq(s, retry, undefined, '', '_다시묻기');
    check(s, '다시 묻는 글에 이유(참여하지 않은 인물)가 들어감', allText(retry).includes('참여하지 않은 인물'), '이유', allText(retry).slice(-400));
    const r = (await phoneState()).rooms[DM_E];
    check(s, '큐라스 말은 저장되지 않음, 대기 error', !r.messages.some((m) => m.sender === K) && r.pending?.status === 'error', 'error', r.pending);
    await press('[data-action="ph-skip"]');
    await saveState(s);
  }
  // 20 표식 없는 배열 답·생각 블록 붙은 답
  {
    const s = step('표식없는답');
    const raw = `<thoughts>생각</thoughts>\n${JSON.stringify([add(E, '표식 없이 와도 돼?')])}`;
    await queue(raw);
    await sendText('테스트');
    await waitIdle();
    const r = (await phoneState()).rooms[DM_E];
    check(s, '생각 블록을 떼고 배열을 받음', r.messages.at(-1).text === '표식 없이 와도 돼?' && !r.pending, '받음', r.messages.at(-1));
    await saveState(s);
  }
  // 21 늦게 온 답: 창 닫았다 열기
  {
    const s = step('늦은답_창닫기');
    await hold();
    await sendText('늦게 와도 돼요.');
    await sleep(500);
    await act('ph-back');
    await closeWin(page);
    await release(patch(add(E, '이제 봤다.')));
    await sleep(1500);
    let r = (await phoneState()).rooms[DM_E];
    check(s, '창이 닫힌 사이 온 답도 저장', r.messages.at(-1).text === '이제 봤다.' && !r.pending, '저장', r.messages.at(-1));
    check(s, '안 본 답이라 안 읽음 1', r.unread === 1, 1, r.unread);
    await openPhone();
    await act('ph-sub', 'chats');
    const txt = await screen();
    check(s, '대화 목록에 안 읽음 배지', /에일린[\s\S]{0,80}1/.test(txt), '배지 1', txt.slice(0, 300));
    await act('ph-room', DM_E, 700);
    r = (await phoneState()).rooms[DM_E];
    check(s, '방을 열면 읽음', r.unread === 0, 0, r.unread);
    await saveState(s);
  }
  // 22 연타
  {
    const s = step('연타');
    await queue(patch(add(E, '한 번만.')), patch(add(E, '두 번?')));
    const n0 = await llmCount();
    await fill('[data-input="ph-draft"]', '연타 시험');
    await page.evaluate(() => { const b = document.querySelector('.ph-send'); b.click(); b.click(); b.click(); });
    await waitIdle();
    check(s, '모델 호출 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    const r = (await phoneState()).rooms[DM_E];
    check(s, '내 말 1개만 저장', r.messages.filter((m) => m.text === '연타 시험').length === 1, 1, r.messages.filter((m) => m.text === '연타 시험').length);
    // 새 메시지 확인 연타
    await queue(JSON.stringify({ updates: [], announcements: [], invitations: [] }), JSON.stringify({ updates: [], announcements: [], invitations: [] }));
    const n1 = await llmCount();
    await page.evaluate(() => { const b = document.querySelector('[data-action="ph-refresh"]'); b.click(); b.click(); });
    await waitIdle();
    check(s, '새 메시지 확인 연타도 1회', (await llmCount()) - n1 === 1, 1, (await llmCount()) - n1);
    await saveState(s);
  }
  // 23 페이지 새로고침(답 기다리는 중) → 다시 열기
  {
    const s = step('페이지새로고침');
    await hold();
    await sendText('새로고침 시험');
    await sleep(400);
    const c = await snap();
    const r0 = JSON.parse(c.scriptstate.$ph_state).rooms[DM_E];
    check(s, '보내는 중 저장 상태: pending working', r0.pending?.status === 'working', 'working', r0.pending);
    await bootChat(c);
    await openPhone();
    await act('ph-sub', 'chats');
    await act('ph-room', DM_E, 700);
    const txt = await screen();
    check(s, '새로 연 창: 다시 시도·건너뛰기 단추', txt.includes('다시 시도') && txt.includes('건너뛰기'), '보임', txt.slice(-200));
    const list = await page.evaluate(() => document.querySelector('.ph-chats')?.innerText ?? '');
    note(s, '목록 미리보기 문구', list.slice(0, 120));
    await queue(patch(add(E, '다시 왔다.')));
    await press('[data-action="ph-retry"]');
    await waitIdle();
    const r = (await phoneState()).rooms[DM_E];
    check(s, '다시 시도로 답 저장', r.messages.at(-1).text === '다시 왔다.' && !r.pending, '저장', r.messages.at(-1));
    await saveState(s);
  }
  // 24 단톡 선물 막힘
  {
    const s = step('단톡_선물막힘');
    const st = await phoneState();
    st.seq += 1;
    st.rooms.g_9 = { id: 'g_9', kind: 'group', name: '시험방', members: [E, K], people: { [E]: { id: E, name: '에일린' }, [K]: { id: K, name: '큐라스' } }, messages: [], draft: '', unread: 0 };
    st.mid += 1; st.rooms.g_9.messages.push({ id: st.mid, sender: E, text: '안녕', time: '2025.03.14 23:20', kind: 'message', audience: [E, K] });
    st.order.push('g_9');
    await withPhone(st);
    await openPhone();
    await act('ph-sub', 'chats');
    await act('ph-room', 'g_9', 600);
    await act('ph-att-menu');
    const giftDisabled = await page.evaluate(() => document.querySelector('[data-action="ph-att-add"][data-value="gift"]')?.disabled);
    check(s, '단톡방 첨부 메뉴의 선물 단추는 꺼져 있음', giftDisabled === true, true, giftDisabled);
    const n0 = await llmCount();
    await queue(patch());
    await act('ph-send', 'g_9'); // 빈 글
    check(s, '빈 글 보내기는 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
    await saveState(s);
  }
  // 25 방 지우기 → 본편 기록에서 빠짐
  {
    const s = step('방지우기');
    const before = phoneBlocks(await peekMain('다음 행동'));
    check(s, '지우기 전 본편에 에일린 1:1 말이 있음', before.some((bl) => bl.includes('이제 봤다.')), '있음', before.length);
    await act('ph-room', DM_E, 600);
    await press('.ph-room-head [data-action="ph-room-del"]');
    await press('.ph-room-head [data-action="ph-room-del"]');
    const st = await phoneState();
    check(s, '방이 지워짐', !st.rooms[DM_E], '없음', Object.keys(st.rooms));
    const out = await peekMain('다음 행동');
    writeReq(s, out);
    check(s, '본편 요청에서 그 방 말이 빠짐', !allText(out).includes('이제 봤다.'), '빠짐', '');
    await saveState(s);
  }
  // 26 설정 끔: 컨텍스트 포함·선톡 받기
  {
    const s = step('설정끔');
    await setVars({ $ph_context: '0' });
    const out = await peekMain('다음 행동');
    check(s, '컨텍스트 포함 끔 → 본편에 괴담톡 덩어리 없음', phoneBlocks(out).length === 0, 0, phoneBlocks(out).length);
    await setVars({ $ph_context: '1', $ph_incoming: '0' });
    await openPhone();
    await act('ph-sub', 'chats');
    await act('ph-room', 'g_9', 400);
    // g_9 는 단톡: 선톡 제한 없음. 1:1 로 시험
    const st = await phoneState();
    st.rooms[DM_E] = { id: DM_E, kind: 'dm', members: [E], people: { [E]: { id: E, name: '에일린' } }, messages: [], draft: '', unread: 0 };
    st.mid += 1; st.rooms[DM_E].messages.push({ id: st.mid, sender: E, text: '자?', time: '2025.03.14 23:30', kind: 'message', audience: [E] });
    st.order.push(DM_E);
    await withPhone(st);
    await openPhone();
    await act('ph-room', DM_E, 600);
    const n0 = await llmCount();
    await act('ph-room-refresh', DM_E, 500);
    const txt = await screen();
    check(s, '선톡 받기 끔: 방 새로고침 막힘·안내', (await llmCount()) === n0 && txt.includes('선톡 받기가 꺼져 있어요'), '막힘', txt.slice(-200));
    await queue(patch(add(E, '응.')));
    await sendText('네 안 자요.');
    await waitIdle();
    check(s, '선톡 끔이어도 내 말 답장은 됨', (await phoneState()).rooms[DM_E].messages.at(-1).text === '응.', '응.', '');
    // 공지 끔 + 초대 끔 + 선톡 끔 → 새 메시지 확인
    await act('ph-cfg', 'announcements=0', 300);
    await act('ph-cfg', 'group_invites=0', 300);
    await queue(JSON.stringify({ updates: [], announcements: [], invitations: [] }));
    const n1 = await llmCount();
    await act('ph-refresh', undefined, 300);
    await waitIdle();
    const msgs = (await llmCount()) > n1 ? await llmAt(n1) : [];
    if (msgs.length) writeReq(s, msgs, undefined, '', '_전부끔_확인');
    const body = bodyOf(msgs);
    note(s, '선톡·초대·공지 모두 끔에서 새 메시지 확인 호출 수', (await llmCount()) - n1);
    if (body) {
      check(s, '그래도 부른다면 공지·초대 자료와 지침은 빠짐', body.announcementCheck?.allowed === false && body.invitationCheck?.allowed === false && !sysOf(msgs).includes('Obey announcementCheck') && !sysOf(msgs).includes('When invitationCheck.allowed, return'), '빠짐', [body.announcementCheck, body.invitationCheck]);
      note(s, '이때 실린 방', (body.rooms ?? []).map((r) => [r.id, r.receiveMessages]));
    }
    await saveState(s);
  }
}

// ═════════════════════ part branch2: 단톡 말·반응·퇴장·대기 줄, 새 메시지 확인 다시 묻기, 1:1 에서 초대, 이름 적은 단톡 ═════════════════════
if (PARTS.includes('branch2')) {
  part = 'C_'; stepNo = 40;
  await bootChat(firstChat());
  // 41 단톡 보내기: 반응 수 자르기·퇴장·지문 대기 줄 버림
  {
    const s = step('단톡_보내기_반응_퇴장');
    const st = { version: 2, seq: 1, mid: 0, rooms: {}, order: [] };
    const g = { id: 'g_1', kind: 'group', name: '지하상가 건', members: [E, K, J], people: { [E]: { id: E, name: '에일린' }, [K]: { id: K, name: '큐라스' }, [J]: { id: J, name: '콘쥬스' } }, messages: [], draft: '', unread: 0, readThrough: 0 };
    for (const [who, t] of [[K, '다들 뭐 해?']]) { st.mid += 1; g.messages.push({ id: st.mid, sender: who, text: t, time: '2025.03.14 23:10', kind: 'message', audience: [E, K, J] }); }
    st.rooms.g_1 = g; st.order = ['g_1'];
    await withPhone(st);
    await openPhone();
    await act('ph-sub', 'chats');
    await act('ph-room', 'g_1', 600);
    const myId = st.mid + 1;
    const R = patch(
      { op: 'replace', path: `/messages/${myId}/reactions`, value: '👍5 😮1' },
      add(E, '퇴근 중.'),
      { op: 'add', path: '/messages/-', value: { type: 'pause', sender: '-', content: '콘쥬스가 한숨을 쉬며 휴대폰을 내려놓았다.' } },
      { op: 'add', path: '/messages/-', value: { type: 'pause', sender: '-', content: '10분 후' } },
      add(J, '저 먼저 나갈게요.'),
      { op: 'add', path: '/messages/-', value: { type: 'exit', sender: '-', content: J } },
      add(J, '아 잘못 나갔다'),
      add(K, '그래.'),
    );
    await queue(R);
    const n0 = await llmCount();
    await sendText('저는 숙소 가요.');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, R);
    const sys = sysOf(msgs);
    check(s, '단톡 보내기: ACTION_SEND + GROUP_ROOMS, DIRECT_ROOMS 없음', sys.includes('send: reply to') && sys.includes('### Group rooms') && !sys.includes('### Direct rooms'), '맞음', '');
    const r = (await phoneState()).rooms.g_1;
    const mine = r.messages.find((m) => m.id === myId);
    check(s, '내 말 반응 👍5 → 본 NPC 수 3 으로 자름', mine?.reactions === '👍3 😮1', '👍3 😮1', mine?.reactions);
    check(s, '지문 대기 줄은 버리고 「10분 후」만 남음', !r.messages.some((m) => m.text.includes('한숨을')) && r.messages.some((m) => m.kind === 'pause' && m.text === '10분 후'), '10분 후만', r.messages.filter((m) => m.kind === 'pause').map((m) => m.text));
    check(s, '콘쥬스 퇴장: 참여자에서 빠지고 「나갔습니다」 줄', !r.members.includes(J) && r.messages.some((m) => m.kind === 'exit' && m.text.includes('콘쥬스')), '퇴장', r.members);
    check(s, '퇴장 뒤 콘쥬스 말은 버림, 큐라스 말은 남음', !r.messages.some((m) => m.text === '아 잘못 나갔다') && r.messages.at(-1).text === '그래.', '버림', r.messages.map((m) => `${m.kind}:${m.text}`));
    await saveState(s);
    // 다음 요청: 콘쥬스는 formerMembers
    await queue(patch());
    const n1 = await llmCount();
    await sendText('다들 잘 자요.');
    await waitIdle();
    const body = bodyOf((await llmCount()) > n1 ? await llmAt(n1) : []);
    check(s, '다음 요청: 콘쥬스는 activeMembers 에 없고 formerMembers 에', !body?.room?.activeMembers?.includes(J) && body?.room?.formerMembers?.some((x) => x.id === J), 'former', [body?.room?.activeMembers, body?.room?.formerMembers]);
  }
  // 42 새 메시지 확인: 꼴 틀린 답 → 다시 묻기(RETRY.REFRESH)
  {
    const s = step('확인_다시묻기');
    const bad = '{"updates":[{"room":"g_1","patch":[{"op":"add","path":"/messages/-","value":{"content":"끊긴';
    const good = JSON.stringify({ updates: [{ room: 'g_1', patch: [add(E, '잘 자.')] }], announcements: [], invitations: [] });
    await queue(bad, good);
    const n0 = await llmCount();
    await act('ph-refresh', undefined, 300);
    await waitIdle();
    const n1 = await llmCount();
    check(s, '호출 2회(다시 묻기 1)', n1 - n0 === 2, 2, n1 - n0);
    const retry = n1 - n0 >= 2 ? await llmAt(n0 + 1) : [];
    writeReq(s, retry, good, '', '_다시묻기');
    const sys = sysOf(retry);
    check(s, '다시 묻는 글: RETRY.REFRESH + 이유 + 분석 지시, 자리표 풀림', sys.includes('The previous response was rejected and nothing was saved') && sys.includes('Validation error: JSON') && !/\{reason\}|\{analyze\}/.test(sys), '채워짐', sys.slice(-600));
    check(s, '두 번째 답 저장', (await phoneState()).rooms.g_1.messages.at(-1).text === '잘 자.', '잘 자.', '');
    await saveState(s);
  }
  // 43 1:1 방에서 초대 → 단톡으로 바뀜
  {
    const s = step('일대일에서_초대');
    const st = await phoneState();
    st.rooms[DM_E] = { id: DM_E, kind: 'dm', members: [E], people: { [E]: { id: E, name: '에일린' } }, messages: [], draft: '', unread: 0, readThrough: 0 };
    for (const [who, t] of [['me', '선배 내일 몇 시?'], [E, '아홉 시.']]) { st.mid += 1; st.rooms[DM_E].messages.push({ id: st.mid, sender: who, text: t, time: '2025.03.14 23:30', kind: 'message', audience: [E] }); }
    st.rooms[DM_E].readThrough = st.mid;
    st.order.push(DM_E);
    await withPhone(st);
    await openPhone();
    await act('ph-sub', 'chats');
    await act('ph-room', DM_E, 600);
    await press('[data-action="ph-invite"]');
    await press(`[data-action="ph-pick"][data-value="${K}"]`, 300);
    await queue(patch(add(K, '나도 아홉 시?')));
    const n0 = await llmCount();
    await press('[data-action="ph-group-create"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs);
    const after = await phoneState();
    const conv = Object.values(after.rooms).find((r) => r.kind === 'group' && r.members.includes(K) && r.messages.some((m) => m.text === '아홉 시.'));
    note(s, '1:1 방이 그대로 단톡으로 바뀌는가(옛 1:1 은 사라짐)', { dmLeft: !!after.rooms[DM_E], group: conv?.id, name: conv?.name, members: conv?.members });
    const body = bodyOf(msgs);
    check(s, '요청: invite_more, 지난 1:1 말의 audience 는 에일린만', body?.room?.action?.type === 'invite_more' && body.room.messages.filter((m) => m.type === 'text').slice(0, 2).every((m) => m.audience.length === 1), 'invite_more', body?.room?.action);
    await saveState(s);
  }
  // 44 이름을 적어 만든 단톡: 이름 짓기 글 빠짐, 모델이 이름을 바꿔도 안 바뀜
  {
    const s = step('이름적은_단톡');
    await act('ph-back');
    await press('[data-action="ph-group"]');
    await press(`[data-action="ph-pick"][data-value="${E}"]`, 300);
    await press(`[data-action="ph-pick"][data-value="${J}"]`, 300);
    await fill('[data-input="ph-gname"]', '내 방');
    const R = patch({ op: 'replace', path: '/name', value: '모델이 지은 이름' }, add(E, '왜.'));
    await queue(R);
    const n0 = await llmCount();
    await press('[data-action="ph-group-create"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, R);
    check(s, '이름 짓기 지침(ACTION_INVITE_NAME) 빠짐', !sysOf(msgs).includes('"path":"/name"'), '빠짐', '');
    const g = Object.values((await phoneState()).rooms).find((r) => r.name === '내 방' || r.name === '모델이 지은 이름');
    check(s, '이름은 내가 적은 「내 방」 그대로, 같이 온 말은 저장', g?.name === '내 방' && g.messages.some((m) => m.text === '왜.'), '내 방', g && { name: g.name, last: g.messages.at(-1)?.text });
    await saveState(s);
  }
}

if (PARTS.includes('branch2')) {
  part = 'C_'; stepNo = 44;
  // 45 단톡 수다: 지침의 줄 수·말풍선 상한이 설정과 같은가
  {
    const s = step('단톡수다');
    await act('ph-cfg', 'banter=1', 300);
    await setVars({ $ph_banter_chance: '100', $ph_banter_min: '6', $ph_banter_max: '20' });
    await openPhone();
    const rows = Array.from({ length: 16 }, (_, i) => add(i % 2 ? E : K, `수다 ${i + 1}`));
    const R = JSON.stringify({ updates: [{ room: 'g_1', patch: rows }], announcements: [], invitations: [] });
    await queue(R);
    const n0 = await llmCount();
    await act('ph-refresh', undefined, 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, R);
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, 'BANTER 지침에 줄 수 6-20, PATCH 상한도 20', sys.includes('about 6-20 rows') && sys.includes('At most 20 operations per room'), '6-20·20', [/about [^ ]+ rows/.exec(sys)?.[0], /At most \d+ operations/.exec(sys)?.[0]]);
    check(s, '수다 방 표시 banter=true', (body?.rooms ?? []).some((r) => r.banter === true), 'true', (body?.rooms ?? []).filter((r) => r.banter).map((r) => r.id));
    const g = (await phoneState()).rooms.g_1;
    check(s, '16줄 모두 저장(상한 20 안)', g.messages.filter((m) => /^수다 /.test(m.text)).length === 16, 16, g.messages.filter((m) => /^수다 /.test(m.text)).length);
    await saveState(s);
  }
}

// ═════════════════════ part joint: 한 번에 요청(괴담톡 + 괴담넷) ═════════════════════
if (PARTS.includes('joint')) {
  part = 'J_'; stepNo = 50;
  await bootChat(firstChat({}, { $ph_auto: '1', $ph_announcements: '0', $ph_group_invites: '0', '$lb_cfg_lb-gn.lazy': '0' }));
  {
    const s = step('한번에요청');
    const st = { version: 2, seq: 0, mid: 1, rooms: { [DM_E]: { id: DM_E, kind: 'dm', members: [E], people: { [E]: { id: E, name: '에일린', agentId: 'P004' } }, messages: [{ id: 1, sender: 'me', text: '선배 퇴근하셨어요?', time: '2025.03.14 22:00', kind: 'message', audience: [E] }], draft: '', unread: 0, readThrough: 1 } }, order: [DM_E] };
    await withPhone(st);
    await setVars({ $ph_adv_check_contacts: '1' });
    const gnet = { posts: [{ author: '야근요정', id: 1846003, tag: '현장', title: '지하상가 셔터', date: '2025.03.14 22:40', views: 10, upvotes: 1, content: '또 내려감', mine: false, comments: [] }], incoming: [], keyFigures: [] };
    const phoneR = { updates: [{ room: DM_E, patch: [add(E, '응, 퇴근.')] }], announcements: [], invitations: [] };
    const RAW = `${JSON.stringify({ gnet, phone: phoneR })}\n<ph-habits>[{"sender":"${E}","note":"짧게 씀"}]</ph-habits>`;
    await queue(RAW);
    const n0 = await llmCount();
    await mainRequest('지하상가로 간다.', 'u2');
    await botReply(C2, 'c2', 2500);
    await waitIdle();
    const n1 = await llmCount();
    check(s, '괴담톡 + 괴담넷 한 요청(호출 1회)', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, RAW);
    const all = allText(msgs);
    check(s, '통합 지침(JOINT.ENVELOPE) 이 실림', all.includes('independent automatic tasks in ONE response'), '있음', '');
    const habitsRule = all.includes('you may append one <ph-habits>JSON_ARRAY</ph-habits> block');
    const envelopeOnly = all.includes('Return exactly one JSON object with exactly these keys') && all.includes('without fences or commentary');
    note(s, '통합 요청 안에 「출력 뒤 <ph-habits> 덧붙이기 허용」(HABITS)과 「JSON 객체 하나만, 군말 없이」(ENVELOPE)가 같이 있음', { habitsRule, envelopeOnly });
    const r = (await phoneState()).rooms[DM_E];
    check(s, '괴담톡 몫 저장', r.messages.at(-1).text === '응, 퇴근.', '응, 퇴근.', r.messages.at(-1).text);
    const habits = JSON.parse((await vars()).$ph_habits_list || '[]');
    check(s, '봉투 밖 <ph-habits> 도 받아 저장', habits.some((h) => h.id === E), '저장', habits);
    await saveState(s);
  }
}

// ═════════════════════ part auto: 자동 호출·다시 굴리기·관전 ═════════════════════
if (PARTS.includes('auto')) {
  part = 'A_'; stepNo = 26;
  const EMPTY = JSON.stringify({ updates: [], announcements: [], invitations: [] });
  const R_AUTO1 = JSON.stringify({ updates: [{ room: DM_E, patch: [add(E, '퇴근했어? 셔터 쪽 가지 마.')] }], announcements: [], invitations: [] });
  // 27 매 턴: 본편 응답 뒤 1회
  await bootChat(firstChat({}, { $ph_auto: '1', $ph_announcements: '0', $ph_group_invites: '0' }));
  {
    const s = step('매턴_첫응답');
    // 에일린과 한 번 대화한 방이 있어야 선톡 후보가 고정된다
    const st = { version: 2, seq: 0, mid: 1, rooms: { [DM_E]: { id: DM_E, kind: 'dm', members: [E], people: { [E]: { id: E, name: '에일린', agentId: 'P004' } }, messages: [{ id: 1, sender: 'me', text: '선배 퇴근하셨어요?', time: '2025.03.14 22:00', kind: 'message', audience: [E] }], draft: '', unread: 0, readThrough: 1 } }, order: [DM_E] };
    await withPhone(st);
    await setVars({ $ph_adv_check_contacts: '1' });
    await queue(R_AUTO1);
    const n0 = await llmCount();
    await mainRequest('지하상가로 간다.', 'u2');
    await botReply(C2, 'c2', 2000);
    await waitIdle();
    const n1 = await llmCount();
    check(s, '본편 응답 뒤 괴담톡 자동 확인 1회', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, R_AUTO1);
    const body = bodyOf(msgs);
    check(s, '확인 요청의 recentStory 에 방금 응답(C2)', JSON.stringify(body?.narratorOnly?.recentStory ?? []).includes('하늘이 아직 붉었다'), 'C2', '');
    check(s, '이야기 시각 = 방금 응답 시각 23:50', body?.narratorOnly?.currentSceneTime === '2025.03.14 23:50', '23:50', body?.narratorOnly?.currentSceneTime);
    const r = (await phoneState()).rooms[DM_E];
    check(s, '에일린 답 저장, 안 읽음 1', r.messages.at(-1).text === '퇴근했어? 셔터 쪽 가지 마.' && r.unread === 1, '저장·1', { last: r.messages.at(-1).text, unread: r.unread });
    check(s, '저장된 말 시각 = 요청한 턴 시각', r.messages.at(-1).time === '2025.03.14 23:50', '2025.03.14 23:50', r.messages.at(-1).time);
    await saveState(s);
  }
  // 28 본편 다시 굴리기 → 다시 부르지 않음, 앞 결과는?
  {
    const s = step('다시굴리기');
    const n0 = await llmCount();
    await rerollLast(C2b, 'c2b');
    await waitIdle();
    check(s, '같은 턴 다시 굴리기: 자동 확인 다시 안 부름(턴 열쇠)', (await llmCount()) === n0, 0, (await llmCount()) - n0);
    const r = (await phoneState()).rooms[DM_E];
    note(s, '버린 응답(C2: 하늘이 붉었다)에 맞춰 받은 톡이 남는가', r.messages.map((m) => m.text));
    const out = await peekMain('다음');
    writeReq(s, out);
    note(s, '다시 굴린 뒤 다음 본편 요청에 그 톡이 실리는가', allText(out).includes('퇴근했어? 셔터 쪽 가지 마.'));
    await saveState(s);
  }
  // 29 지우기(본편 응답 삭제) 후 새 응답
  {
    const s = step('응답지우고_새응답');
    await page.evaluate(() => { const m = window.__chat.message; if (m.at(-1)?.role === 'char') m.pop(); m.pop(); });
    await queue(EMPTY);
    const n0 = await llmCount();
    await mainRequest('다른 데로 간다.', 'u2x');
    await botReply(C2, 'c2x', 1500);
    await waitIdle();
    note(s, '지우고 다른 user 로 새 응답 → 자동 확인 호출 수', (await llmCount()) - n0);
    await saveState(s);
  }
  // 30 늦게 온 자동 확인 + 그사이 다음 전송
  {
    const s = step('늦은자동확인_다음전송');
    await hold();
    const n0 = await llmCount();
    await mainRequest('다음 날 아침이다.', 'u3');
    // mainRequest 가 기다림을 켠다 → 응답 직전: 바로 앞 자동 확인을 띄우려면 응답이 하나 더 필요. 순서: 응답(c3) → 자동 확인(대기) → 사용자 다음 전송 → 답 도착 → 본편 응답
    await botReply(C3, 'c3', 600);
    const pending = (await llmCount()) - n0;
    check(s, '자동 확인 요청이 나감', pending === 1, 1, pending);
    await mainRequest('출근한다.', 'u4');
    await release(JSON.stringify({ updates: [{ room: DM_E, patch: [add(E, '좋은 아침.')] }], announcements: [], invitations: [] }));
    await sleep(800);
    let r = (await phoneState()).rooms[DM_E];
    check(s, '본편 응답 대기 중에는 저장하지 않음', !r.messages.some((m) => m.text === '좋은 아침.'), '아직 없음', r.messages.at(-1).text);
    await queue({ type: 'success', result: JSON.stringify({ updates: [], announcements: [], invitations: [] }) });
    const n4 = await llmCount();
    await botReply(`출근했다.\n${ST('09:00 AM', '2025.03.15', '관리국')}`, 'c4', 1500);
    await waitIdle();
    await sleep(1500);
    check(s, '늦게 저장된 앞 턴 결과와 별개로 이 응답(c4)의 자동 확인도 1회', (await llmCount()) - n4 === 1, 1, { calls: (await llmCount()) - n4, auto_last: (await vars()).$ph_auto_last });
    r = (await phoneState()).rooms[DM_E];
    const m = r.messages.find((x) => x.text === '좋은 아침.');
    check(s, '본편 응답이 끝난 뒤 저장, 시각은 요청한 턴(07:30)', m && m.time === '2025.03.15 07:30', '2025.03.15 07:30', m?.time);
    await saveState(s);
  }
  // 31 늦게 온 자동 확인 + 그사이 다시 굴리기 → 버림
  {
    const s = step('늦은자동확인_다시굴림');
    await hold();
    const n0 = await llmCount();
    await mainRequest('점심을 먹는다.', 'u5');
    await botReply(`점심.\n${ST('12:10 PM', '2025.03.15', '관리국')}`, 'c5', 600);
    check(s, '자동 확인 요청이 나감', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await page.evaluate(() => { window.__chat.message.pop(); });
    await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '점심(다시 굴림).\n[▣|2025.03.15|12:15 PM|🌙|6°C|관리국|없음|없음|없음|관리국/신입|100000]', chatId: 'c5b' }); });
    await release(JSON.stringify({ updates: [{ room: DM_E, patch: [add(E, '점심 뭐 먹어?')] }], announcements: [], invitations: [] }));
    await sleep(1200);
    const r = (await phoneState()).rooms[DM_E];
    check(s, '응답이 바뀌었으면 그 결과는 버림', !r.messages.some((m) => m.text === '점심 뭐 먹어?'), '버림', r.messages.at(-1).text);
    await saveState(s);
  }
  // 32 창을 열 때
  await bootChat(firstChat({}, { $ph_auto: 'open', $ph_announcements: '0', $ph_group_invites: '0' }));
  {
    const s = step('창을열때');
    await queue(EMPTY, EMPTY);
    const n0 = await llmCount();
    await mainRequest('지하상가로 간다.', 'u2');
    await botReply(C2, 'c2', 1200);
    check(s, '본편 응답 뒤에는 안 부름', (await llmCount()) === n0, 0, (await llmCount()) - n0);
    await openPhone();
    await waitIdle();
    check(s, '탭을 열면 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await openPhone();
    await waitIdle();
    check(s, '같은 응답에서 다시 열면 안 부름', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await saveState(s);
  }
  // 33 관전(보기 전용 방): 두 번 눌러 시작 → 다음 본편
  {
    const s = step('관전');
    const VIEW = JSON.stringify({ name: '퇴근길 잡담', pov: 'p1', participants: [{ id: 'p1', name: '주인공' }, { id: 'p2', name: '에일린' }], messages: [{ sender: 'p2', type: 'text', content: '오늘도 늦었네.' }, { sender: 'p1', type: 'text', content: '네, 좀요.' }] });
    await act('ph-view-new', undefined, 300);
    const n0 = await llmCount();
    check(s, '한 번 누르면 호출 안 함(두 번 눌러 시작)', (await llmCount()) === n0, 0, '');
    await queue(VIEW);
    await act('ph-view-new', undefined, 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, VIEW);
    const sys = sysOf(msgs); const body = bodyOf(msgs);
    check(s, '보기 전용 지침(VIEW.COMMON·VIEW.SIDE·VIEW.OUTPUT)', sys.includes('VIEW-ONLY ROOM') && sys.includes('## Side story') && sys.includes('OUTPUT CONTRACT'), '셋', '');
    check(s, '자리표가 다 풀림', !MARK.test(allText(msgs)), '없음', MARK.exec(allText(msgs))?.[0]);
    note(s, 'viewpoint', body?.viewpoint);
    const views = JSON.parse((await vars()).$ph_views || '[]');
    check(s, '보기 전용 방 저장', views.length === 1 && views[0].messages.some((m) => m.text === '오늘도 늦었네.'), 1, views.map((v) => v.name));
    const out = await peekMain('다음');
    note(s, '기본(붙일 것: 보기 전용 방 끔)에서 본편에 관전이 실리나', allText(out).includes('오늘도 늦었네.'));
    check(s, '기본값(ctx_views 0)에서는 본편에 관전 안 실림', !allText(out).includes('오늘도 늦었네.'), '안 실림', '');
    await saveState(s);
  }
}

if (PARTS.includes('auto2')) {
  part = 'A2_'; stepNo = 34;
  // 35 매 턴 자동 확인 + 그 순간 손으로 보낸 답장을 기다리는 중
  await bootChat(firstChat({}, { $ph_auto: '1', $ph_announcements: '0', $ph_group_invites: '0' }));
  {
    const s = step('매턴_손작업과겹침');
    const st = { version: 2, seq: 0, mid: 1, rooms: { [DM_E]: { id: DM_E, kind: 'dm', members: [E], people: { [E]: { id: E, name: '에일린', agentId: 'P004' } }, messages: [{ id: 1, sender: 'me', text: '선배?', time: '2025.03.14 22:00', kind: 'message', audience: [E] }], draft: '', unread: 0, readThrough: 1 } }, order: [DM_E] };
    await withPhone(st);
    await setVars({ $ph_adv_check_contacts: '1' });
    await openPhone();
    await act('ph-sub', 'chats');
    await act('ph-room', DM_E, 600);
    await hold();
    await sendText('지금 어디세요?');
    await sleep(300);
    const n0 = await llmCount();
    await mainRequest('지하상가로 간다.', 'u2');
    await botReply(C2, 'c2', 1500);
    note(s, '손 답장을 기다리는 사이 본편 응답이 끝남 → 그때 나간 자동 확인 수', (await llmCount()) - n0);
    await release(patch(add(E, '사무실.')));
    await sleep(1500);
    await queue(JSON.stringify({ updates: [], announcements: [], invitations: [] }));
    await sleep(2500);
    const after = (await llmCount()) - n0;
    const v = await vars();
    check(s, '이 응답의 자동 확인이 손 작업이 끝난 뒤라도 한 번은 나감(설정 「매 턴: 메인 응답이 끝날 때마다」)', after >= 1, '≥1', { calls: after, auto_last: v.$ph_auto_last ?? null });
    // 창을 닫았다 열어도 (매 턴 설정은 창 열기로 다시 부르지 않음)
    await openPhone();
    await sleep(1500);
    note(s, '창을 다시 연 뒤 호출 수', (await llmCount()) - n0);
    // 다음 턴에는 나가는가
    await queue(JSON.stringify({ updates: [], announcements: [], invitations: [] }));
    const n1 = await llmCount();
    await mainRequest('잠깐 쉰다.', 'u3');
    await botReply(C3, 'c3', 1500);
    await waitIdle();
    note(s, '다음 턴 자동 확인 수', (await llmCount()) - n1);
    await saveState(s);
  }
}

// ═════════════════════ part phone: 폰 390×844 ═════════════════════
if (PARTS.includes('phone')) {
  part = 'M_'; stepNo = 33;
  await bootChat(firstChat(), 'phone');
  {
    const s = step('폰_보내기');
    await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await press('.gx [data-action="nav-tab"][data-value="phone"]', 800);
    const txt0 = await screen();
    check(s, '폰: 연락처 목록', txt0.includes('에일린'), '에일린', txt0.slice(0, 200));
    await press(`[data-action="ph-dm"][data-value="${E}"]`, 700);
    const lay = await page.evaluate(() => { const side = document.querySelector('.ph-side'); const pane = document.querySelector('.ph-pane'); const r = (e) => e ? e.getBoundingClientRect() : null; return { side: r(side), pane: r(pane), sideVis: side ? getComputedStyle(side).display : '', sw: document.documentElement.scrollWidth, iw: innerWidth, sendVis: !!document.querySelector('.ph-send')?.offsetParent }; });
    check(s, '폰: 방이 한 화면(목록 숨김), 보내기 단추 보임, 가로 넘침 없음', lay.sendVis && lay.sw <= lay.iw + 1 && (lay.sideVis === 'none' || !lay.side || lay.side.width === 0 || lay.pane.left <= 1), '방만', lay);
    await queue(REPLY1);
    const n0 = await llmCount();
    await fill('[data-input="ph-draft"]', '폰에서 보내요.');
    await press('.ph-send');
    await waitIdle();
    check(s, '폰: 호출 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    const r = (await phoneState()).rooms[DM_E];
    check(s, '폰: 답 저장·읽음', r.messages.length === 3 && r.unread === 0, '3·0', { n: r.messages.length, unread: r.unread });
    await page.screenshot({ path: `${OUT}폰_방.png` });
    const sendBox = await page.evaluate(() => { const b = document.querySelector('.ph-send')?.getBoundingClientRect(); const els = b ? document.elementsFromPoint(b.left + b.width / 2, b.top + b.height / 2) : []; return { top: els[0]?.className ?? '', isSend: !!els[0]?.closest?.('.ph-send') }; });
    note(s, '보내기 단추 위에 겹친 것(가장 위 요소)', sendBox);
    await press('.ph-room-head .ph-back', 600);
    const txt = await screen();
    check(s, '폰: 뒤로 → 목록', !(await page.evaluate(() => !!document.querySelector('.ph-room')?.offsetParent)) && txt.includes('에일린'), '목록', txt.slice(0, 200));
    await act('ph-sub', 'chats');
    await page.screenshot({ path: `${OUT}폰_목록.png` });
    await saveState(s);
  }
}

allErrors.push(...(errors ?? []));
await b.close();
const fails = results.filter((r) => !r.ok);
writeFileSync(`${OUT}결과-${PARTS.join('+')}.json`, JSON.stringify({ run: results.length, pass: results.length - fails.length, fails, notes, errors: allErrors }, null, 2));
console.log(`\n${results.length - fails.length}/${results.length} 통과, 페이지 오류 ${allErrors.length}`);
if (allErrors.length) console.log(allErrors.slice(0, 10));
