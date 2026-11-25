// 3차 F 구간 T1 · 2차가 못 돌린 괴담톡 갈래 (보기 전용 사전설정 셋·이어 보기, 연락처 추가·삭제, 보관 한도·초대받은 단톡방 정리, 확률 100 미만·쉬는 턴,
// 저장 실패(던짐/조용히), 보조 호출 스트리밍(조각·끊김), 생각 블록 답, 모델·생각 단계·비망록·언어)
// 틀: 2차 10_괴담톡/run.mjs 의 도움 함수 그대로(가짜 Risu tests/qc-settings-harness.mjs + dist 번들 + .scratch/fixture). src·tests 는 안 고침.
// 기대값은 단계마다 check() 의 셋째 인자, 결정표 번호는 단계 이름 옆 주석.
// 사용법: node 인수인계/플레이순서_점검/3차/F/T1/더한갈래/run.mjs [ph|fail|stream|think|opts]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const OUT = '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-F/t1-더한갈래/';
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['ph', 'gn', 'pic', 'attach', 'fail', 'stream', 'think', 'opts'];
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

const viewsOf = async () => JSON.parse((await vars()).$ph_views || '[]');
const openPhoneTab = async () => { await closeWin(page); await sleep(200); await openWin(page); await sleep(300); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); if (!(await page.$('.ph-app'))) await act('nav-tab', 'phone', 700); };
const VIEWJ = (name, who, line) => JSON.stringify({ name, pov: 'p1', participants: [{ id: 'p1', name: '주인공' }, { id: 'p2', name: who }], messages: [{ sender: 'p2', type: 'text', content: line }] });
const dmRoom = (cid, n, extra = {}) => ({ id: `dm_${cid}`, kind: 'dm', members: [cid], people: {}, messages: Array.from({ length: n }, (_, i) => ({ id: i + 1, sender: i % 2 ? cid : 'me', kind: 'message', text: `말${i + 1}`, time: '2025.03.14 23:00' })), draft: '', unread: 0, readThrough: n, ...extra });

// ═════════ part ph: 괴담톡 갈래 (PC) ═════════
if (PARTS.includes('ph')) {
  part = 'PH_'; stepNo = 0;
  await bootChat(firstChat());
  await openPhoneTab();
  // 01 연락처 추가 (결정표 없음, 기대값 = 설정 도움말·화면 안내 「기타 탭에 들어가요」)
  let cid = '';
  {
    const s = step('연락처추가');
    await act('ph-add', undefined, 500);
    await fill('[data-input="ph-add-name"]', '박하늘');
    await fill('[data-input="ph-add-note"]', '편의점 야간 알바, 지하상가에서 알게 됨');
    await press('[data-action="ph-add-save"]', 700);
    const v = await vars();
    const data = JSON.parse(v.$ph_contacts || '{"items":[]}');
    check(s, '직접 추가한 연락처가 $ph_contacts 에 저장', data.items?.some((x) => x.name === '박하늘' && x.note?.includes('편의점')), '박하늘', data);
    cid = data.items?.find((x) => x.name === '박하늘')?.id ?? '';
    const txt = await screen();
    check(s, '「기타」 탭 목록에 보이고 안내가 뜸', txt.includes('박하늘') && /추가했어요/.test(txt), '박하늘·추가했어요', txt.slice(0, 400));
    check(s, '삭제 단추가 직접 추가한 연락처에만', await page.evaluate((c) => !!document.querySelector(`[data-action="ph-contact-del"][data-value="${c}"]`) && document.querySelectorAll('[data-action="ph-contact-del"]').length === 1, cid), '1개', '');
    await saveState(s);
  }
  // 02 그 사람과 1:1 → 보내기 (요청에 인물 메모가 가는지)
  {
    const s = step('추가연락처_1대1');
    await act('ph-dm', cid, 700);
    await queue(patch(add(cid, '어 무슨 일이야?')));
    const n0 = await llmCount();
    await sendText('하늘아 지하상가 셔터 봤어?');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '');
    const body = bodyOf(msgs);
    check(s, '참여자 = 박하늘, 메모가 실림', JSON.stringify(body?.participants ?? []).includes('편의점'), '편의점 메모', body?.participants);
    const st = await phoneState();
    check(s, '1:1 방 저장(내 말+답)', st.rooms[`dm_${cid}`]?.messages.length === 2, 2, st.rooms[`dm_${cid}`]?.messages);
  }
  // 03 연락처 삭제(두 번 눌러 확인) → 1:1 기록까지 지움 (코스 F-1 「삭제면 1:1 기록까지」)
  {
    const s = step('연락처삭제_두번');
    await act('ph-sub', 'contacts', 500);
    await act('ph-contact-del', cid, 400);
    const mid = await page.evaluate((c) => document.querySelector(`[data-action="ph-contact-del"][data-value="${c}"]`)?.textContent, cid);
    check(s, '첫 번째 누름은 「정말 삭제」로 바뀌기만', mid?.includes('정말'), '정말 삭제', mid);
    check(s, '첫 누름 뒤 아직 지워지지 않음', !!(await phoneState()).rooms[`dm_${cid}`], '방 남음', '');
    await act('ph-contact-del', cid, 700);
    const st = await phoneState(); const v = await vars();
    check(s, '1:1 방이 지워짐', !st.rooms[`dm_${cid}`] && !st.order.includes(`dm_${cid}`), '없음', Object.keys(st.rooms));
    check(s, '연락처 목록에서 빠짐', !JSON.parse(v.$ph_contacts || '{"items":[]}').items.some((x) => x.id === cid), '없음', v.$ph_contacts);
    const txt = await screen();
    check(s, '안내 「연락처와 1:1 대화 기록을 지웠어요」', txt.includes('1:1 대화 기록을 지웠어요'), '안내', txt.slice(0, 300));
    // 본편에 지운 방이 남지 않는지
    const out = await peekMain('다음.');
    check(s, '다음 본편 요청에 지운 방 말이 없음', !allText(out).includes('하늘아 지하상가'), '없음', '');
    await saveState(s);
  }
  // 04 보기 전용 방 사전설정 셋 (결정표 F-01: 대화 목록 안 평범한 단톡방, 같은 방 이어 붙임)
  const presets = [['side', '## Side story', '에일린'], ['mono', '## Soliloquy', '큐라스'], ['multi', '## Inner voices', '콘쥬스']];
  for (const [pre, head, who] of presets) {
    const s = step(`관전_${pre}`);
    await act('ph-cfg', `view_preset=${pre}`, 500);
    await act('ph-sub', 'chats', 400);
    await act('ph-view-new', undefined, 300);
    await queue(pre === 'side' ? VIEWJ(`${pre} 방`, who, `${pre} 첫 줄`) : JSON.stringify({ name: `${pre} 방`, pov: 'p1', participants: [{ id: 'p1', name: who }, { id: 'p2', name: `${who}의 다른 목소리` }], messages: [{ sender: 'p1', type: 'text', content: `${pre} 첫 줄` }, { sender: 'p2', type: 'text', content: `${pre} 둘째 줄` }] }));
    const n0 = await llmCount();
    await act('ph-view-new', undefined, 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '');
    const sys = sysOf(msgs);
    check(s, `지침 VIEW.COMMON + ${head}`, sys.includes('VIEW-ONLY ROOM') && sys.includes(head), head, '');
    const others = presets.filter((p) => p[0] !== pre).map((p) => p[1]);
    check(s, '다른 사전설정 절은 안 실림', others.every((h) => !sys.includes(h)), '없음', others.filter((h) => sys.includes(h)));
    const views = await viewsOf();
    check(s, '보기 전용 방 하나 더 생김(인물이 달라서)', views.some((x) => x.preset === pre && x.messages.some((m) => m.text === `${pre} 첫 줄`)), pre, views.map((x) => [x.name, x.preset]));
    check(s, '탭이 늘지 않음: 대화 목록 안(F-01)', await page.evaluate(() => [...document.querySelectorAll('[data-action="ph-sub"]')].length) <= 4, '탭 그대로', await page.evaluate(() => [...document.querySelectorAll('[data-action="ph-sub"]')].map((x) => x.textContent.trim())));
  }
  // 05 이어 보기 → 같은 방에 이어 붙임 (F-01)
  {
    const s = step('이어보기');
    const views0 = await viewsOf();
    const side = views0.find((x) => x.preset === 'side');
    await queue(VIEWJ('다른 이름', '에일린', '이어진 줄'));
    const n0 = await llmCount();
    await act('ph-view-new', side.id, 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '');
    check(s, '이어 보기 요청에 앞 줄(side 첫 줄)이 실림', allText(msgs).includes('side 첫 줄'), '앞 줄', '');
    const views = await viewsOf();
    const cur = views.find((x) => x.id === side.id);
    check(s, '같은 방에 이어 붙음·방 수 그대로·이름 그대로', views.length === views0.length && cur?.messages.some((m) => m.text === '이어진 줄') && cur.name === side.name, '같은 방', views.map((x) => [x.name, x.messages.length]));
    check(s, '이어 쓴 방이 목록 맨 뒤(맨 위로 보임)', views.at(-1)?.id === side.id, side.id, views.map((x) => x.id));
    // 지우기 두 번
    await act('ph-view-del', side.id, 300);
    const still = (await viewsOf()).some((x) => x.id === side.id);
    await act('ph-view-del', side.id, 500);
    check(s, '보기 전용 방 지우기도 두 번 눌러야', still && !(await viewsOf()).some((x) => x.id === side.id), '첫 누름 남음·둘째 지움', '');
  }
  // 06 보관 한도: 1:1 정리 켬·3개 (설정 도움말 「최근 기록만 남기고」, 기본 100 = 사용자 11-17 STORAGE 주석)
  {
    const s = step('보관한도_1대1');
    await bootChat(firstChat({}, { $ph_storage_auto_dm: '1', $ph_storage_limit_dm: '3', $ph_state: JSON.stringify({ rooms: { [DM_E]: dmRoom(E, 6) }, order: [DM_E], mid: 6 }) }));
    await openPhoneTab();
    await act('ph-room', DM_E, 600);
    await queue(patch(add(E, '응.')));
    await sendText('정리 시험.');
    await waitIdle();
    const r = (await phoneState()).rooms[DM_E];
    check(s, '말풍선이 3개로 줄고 trimmedRecords 가 셈', r.messages.filter((m) => m.kind === 'message').length <= 3 && r.trimmedRecords > 0, '≤3·정리 수', { n: r.messages.length, t: r.trimmedRecords, texts: r.messages.map((m) => m.text) });
    const txt = await screen();
    check(s, '화면에 「보관 상한으로 정리됐어요」', txt.includes('보관 상한으로 정리'), '안내', txt.slice(-300));
    // 정리 끔이면 안 줄어듦
    await bootChat(firstChat({}, { $ph_storage_auto_dm: '0', $ph_storage_limit_dm: '3', $ph_state: JSON.stringify({ rooms: { [DM_E]: dmRoom(E, 6) }, order: [DM_E], mid: 6 }) }));
    await openPhoneTab(); await act('ph-room', DM_E, 600);
    await queue(patch(add(E, '응.')));
    await sendText('정리 끔.');
    await waitIdle();
    check(s, '정리 끔이면 그대로 쌓임(8)', (await phoneState()).rooms[DM_E].messages.length === 8, 8, (await phoneState()).rooms[DM_E].messages.length);
    await saveState(s);
  }
  // 07 초대받은 단톡방 정리 기본값(20·켬, 사용자 11-17) 화면 표시 + 상한 1 로 새 초대
  {
    const s = step('초대방정리');
    const quiet = { id: 'g_9', kind: 'group', name: '옛 초대방', inviter: G, members: [G, D], people: {}, messages: [{ id: 1, sender: G, kind: 'message', text: '옛말', time: '2025.03.10 10:00' }], draft: '', unread: 0, readThrough: 1 };
    await bootChat(firstChat({}, { $ph_state: JSON.stringify({ rooms: { g_9: quiet }, order: ['g_9'], mid: 1 }) }));
    await openPhoneTab();
    await act('ed-open', 'set:phone', 1200);
    const shown = await page.evaluate(() => { const lab = [...document.querySelectorAll('.gw *')].filter((x) => x.children.length === 0 && x.textContent.trim() === '초대받은 단톡방 정리')[0]; let row = lab; for (let i = 0; i < 4 && row && !/\d/.test(row.innerText.replace('초대받은 단톡방 정리', '')); i++) row = row.parentElement; const inp = row?.querySelector('input'); return { all: [...document.querySelectorAll('.gw input[aria-label="남길 수"]')].map((x) => x.value), text: row?.innerText.replace(/\s+/g, ' ').slice(-120) ?? null, inp: inp?.value ?? null }; });
    await closeEditor(page, true); await openPhoneTab();
    note(s, '설정 화면 「초대받은 단톡방 정리」 줄', shown);
    check(s, '기본값 켬·20 이 보임', Array.isArray(shown?.all) && shown.all[3] === '20', '[100,100,20,20] 중 넷째 20', shown?.all);
    await setVars({ $ph_storage_auto_invited: '1', $ph_storage_limit_invited: '1', $ph_group_invites: '1', $ph_group_invite_chance: '100', $ph_incoming: '0' });
    await openPhoneTab();
    await act('ph-sub', 'chats', 400);
    await queue(JSON.stringify({ updates: [], announcements: [], invitations: [{ inviter: K, members: [K, J], name: '새 초대방', patch: [add(K, '새로 왔어')] }] }));
    const n0 = await llmCount();
    await press('[data-action="ph-refresh"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '');
    const st = await phoneState();
    const names2 = Object.values(st.rooms).map((r) => r.name);
    check(s, '상한 1: 오래 조용한 옛 초대방이 지워지고 새 초대방이 남음', !st.rooms.g_9 && names2.includes('새 초대방'), '새 초대방만', names2);
    await saveState(s);
  }
  // 08 선톡 확률 100 미만·쉬는 턴 (설정: 선톡 받기 확률, 선톡 받은 뒤 쉬는 턴 기본 1)
  {
    const s = step('선톡확률_쉬는턴');
    await bootChat(firstChat({}, { $ph_state: JSON.stringify({ rooms: { [DM_E]: dmRoom(E, 2) }, order: [DM_E], mid: 2 }), $ph_incoming: '1', $ph_incoming_chance: '30', $ph_group_invites: '0', $ph_announcements: '0' }));
    await openPhoneTab(); await act('ph-sub', 'chats', 400);
    await page.evaluate(() => { window.__realRandom = window.__realRandom || Math.random; Math.random = () => 0.95; });
    let n0 = await llmCount();
    await press('[data-action="ph-refresh"]'); await waitIdle();
    const miss = (await llmCount()) - n0;
    const t1 = await screen();
    check(s, '확률 30·주사위 96: 받을 방 없음 → 호출 없이 「건너뛰었어요」', miss === 0 && /건너뛰었어요/.test(t1), '0회·건너뜀', { calls: miss, text: t1.slice(0, 200) });
    await page.evaluate(() => { Math.random = () => 0.1; });
    await queue(JSON.stringify({ updates: [{ room: DM_E, patch: [add(E, '자?')] }], announcements: [], invitations: [] }));
    n0 = await llmCount();
    await press('[data-action="ph-refresh"]'); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '');
    check(s, '주사위 11: 요청 1회, 방 receiveMessages true', (await llmCount()) - n0 === 1 && bodyOf(msgs)?.rooms?.some((r) => r.id === DM_E && r.receiveMessages), 'true', bodyOf(msgs)?.rooms?.map((r) => [r.id, r.receiveMessages]));
    const v = await vars();
    check(s, '선톡 받은 뒤 쉬는 턴 표시', !!v.$cooldown_received_incoming, '찍힘', v.$cooldown_received_incoming);
    n0 = await llmCount();
    await press('[data-action="ph-refresh"]'); await waitIdle();
    const t3 = await screen();
    check(s, '쉬는 턴 안: 다시 눌러도 호출 없음', (await llmCount()) - n0 === 0, 0, { calls: (await llmCount()) - n0, text: t3.slice(0, 200) });
    await page.evaluate(() => { Math.random = window.__realRandom; });
    await saveState(s);
  }
}


// ═════════ part gn: 게시판 갈래 (닉네임·참조 칩 6·선쪽지 확률·쉬는 턴·쪽지 자동 정리, 코스 F-2) ═════════
if (PARTS.includes('gn')) {
  part = 'GN_'; stepNo = 0;
  const GREFRESH = JSON.stringify({ posts: [{ author: '야근요정', id: 1846003, tag: '현장', title: '중림 지하상가 B구역 또 셔터 내림', date: '2025.03.14 22:40', views: 1820, upvotes: 64, content: '오늘 B구역 셔터 또 내려감.', mine: false, comments: [] }], incoming: [], keyFigures: [] });
  const openSite = async (site = 'gn') => { await closeWin(page); await sleep(200); await openWin(page); await sleep(300); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await act('nav-tab', 'net'); if (!(await page.$(`.bs-${site}`))) await act('br-go', site, 600); };
  const gref = async () => { await queue(GREFRESH); const n0 = await llmCount(); await act('gn-refresh', '', 300); await waitIdle(); return (await llmCount()) > n0 ? await llmAt(n0) : []; };
  // 닉네임: 비우면 「익명」(지침 GNET.ANON_NICK), 저장하면 그 닉, 다시 비우면 익명
  {
    await bootChat(firstChat()); await openSite();
    const s = step('닉네임_익명_저장_비움');
    let t = allText(await gref());
    check(s, '닉네임 없으면 요청 속 내 닉 = 익명', /"(userHandle|nick|myNick|handle)":"익명"|익명/.test(t), '익명', (/.{0,40}익명.{0,40}/.exec(t) || [])[0]);
    await act('gn-nick-save', '하늘바라기', 400);
    t = allText(await gref());
    check(s, '게시판 안에서 저장한 닉이 요청에 감', t.includes('하늘바라기') && (await vars()).$gn_nick === '하늘바라기', '하늘바라기', (await vars()).$gn_nick);
    await act('gn-nick-save', '', 400);
    t = allText(await gref());
    check(s, '비우면 다시 익명', !t.includes('하늘바라기') && t.includes('익명'), '익명', (await vars()).$gn_nick);
    // 브라우저 로그인 창: 페르소나 이름(가짜 Risu 는 이름 없음)이나 지난 닉이 미리 채워짐
    await act('br-login', undefined, 400);
    const pre = await page.evaluate(() => document.querySelector('[name="br-nick"]')?.value ?? null);
    note(s, '로그인 창 닉 칸 미리 채운 값(가짜 Risu 페르소나 이름)', pre);
    await page.fill('[name="br-nick"]', '로그인닉'); await press('[data-action="br-login-save"]', 500);
    const v = await vars();
    check(s, '브라우저 로그인 = 게시판 닉도 같이 바뀜', v.$br_login === '1' && v.$br_nick === '로그인닉' && v.$gn_nick === '로그인닉', '로그인닉 셋', { l: v.$br_login, b: v.$br_nick, g: v.$gn_nick });
  }
  // 참조 칩 6개 (봇 설명·작가 노트·페르소나·상시 로어북·관련 로어북·2차 참조, 기본 앞 다섯 켬·2차 끔)
  {
    await bootChat(firstChat()); await openSite();
    const s0 = step('참조칩_기준');
    const base = allText(await gref());
    writeReq(s0, [{ role: 'all', content: base }]);
    note(s0, '기준 요청 길이·봇 설명/작가 노트 표지', { len: base.length, desc: base.includes('봇 설명'), note: base.includes('작가 노트'), persona: base.includes('사용자 페르소나') });
    for (const [k, flip] of [['desc', '0'], ['authors', '0'], ['persona', '0'], ['active', '0'], ['related', '0'], ['secondary', '1']]) {
      await bootChat(firstChat({}, { [`$lb_cfg_lb-gn.adv_${k}`]: flip })); await openSite();
      const s = step(`참조칩_${k}_${flip === '0' ? '끔' : '켬'}`);
      const t = allText(await gref());
      writeReq(s, [{ role: 'all', content: t }]);
      const label = { desc: '봇 설명', authors: '작가 노트', persona: '사용자 페르소나' }[k];
      if (label && base.includes(label)) check(s, `${label} 칩 끄면 그 자료가 빠짐`, !t.includes(label), '없음', t.length - base.length);
      else note(s, `길이 차이(기준 대비) — ${label ? '기준에도 이 자료가 없음(가짜 Risu)' : '표지 없는 칩'}`, t.length - base.length);
    }
  }
  // 선쪽지 확률 0·100, 쉬는 턴 (기본 확률 100, 쉬는 턴 HISTORY.cooldown 2)
  {
    await bootChat(firstChat({}, { '$lb_cfg_lb-gn.incoming_chance': '0' })); await openSite();
    const s = step('선쪽지_확률0');
    await gref();
    await press('.bs [data-action="gn-open"][data-value="1846003"]');
    await queue(JSON.stringify({ comments: [], incoming: [{ nick: '브로커K', body: '연락 주세요' }], activity: [] }));
    const n0 = await llmCount();
    await fill('.bs .gn-composer [data-input="gn-draft"]', '저도 봤어요');
    await press('.bs .gn-composer [data-action="gn-send"]'); await waitIdle();
    const t = (await llmCount()) > n0 ? allText(await llmAt(n0)) : '';
    writeReq(s, [{ role: 'all', content: t }]);
    check(s, '확률 0: 댓글 요청의 incomingAllowed=false', /incomingAllowed"?\s*[:=]\s*false/.test(t), 'false', (/incomingAllowed.{0,12}/.exec(t) || [])[0]);
    const raw = (await vars()).$gn_raw || '';
    check(s, '확률 0이면 모델이 쪽지를 써도 저장 안 함', !/브로커K/.test(raw), '없음', raw.split('\n').filter((l) => l.startsWith('D')).slice(0, 3));
  }
  {
    await bootChat(firstChat()); await openSite();
    const s = step('선쪽지_쉬는턴');
    await gref();
    await press('.bs [data-action="gn-open"][data-value="1846003"]');
    await queue(JSON.stringify({ comments: [], incoming: [{ nick: '브로커K', body: '연락 주세요' }], activity: [] }));
    await fill('.bs .gn-composer [data-input="gn-draft"]', '첫 댓글'); await press('.bs .gn-composer [data-action="gn-send"]'); await waitIdle();
    const cd = (await vars()).$cooldown_received_gnet;
    check(s, '선쪽지 받으면 쉬는 턴 표시', cd !== undefined && cd !== '', '찍힘', cd);
    await queue(JSON.stringify({ comments: [], incoming: [], activity: [] }));
    const n0 = await llmCount();
    await fill('.bs .gn-composer [data-input="gn-draft"]', '둘째 댓글'); await press('.bs .gn-composer [data-action="gn-send"]'); await waitIdle();
    const t = (await llmCount()) > n0 ? allText(await llmAt(n0)) : '';
    check(s, '같은 턴 안 다음 댓글: incomingAllowed=false', /incomingAllowed"?\s*[:=]\s*false/.test(t), 'false', (/incomingAllowed.{0,12}/.exec(t) || [])[0]);
  }
  // 폰 주소창 오른쪽 끝 ↻ (결정표 F-08): 게시판 새로고침과 같은 동작
  {
    await bootChat(firstChat(), 'phone'); await openSite();
    const s = step('폰_주소창_새로고침');
    const info = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-action="br-reload"]')].find((x) => x.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); const bar = b.parentElement.getBoundingClientRect(); return { right: Math.round(bar.right - r.right), w: Math.round(r.width) }; });
    check(s, '폰에서 주소창 줄 오른쪽 끝에 ↻ 가 보임', !!info && info.right < 24, '보임·오른쪽 끝', info);
    await queue(GREFRESH);
    const n0 = await llmCount();
    if (info) await press('[data-action="br-reload"]');
    await waitIdle();
    check(s, '↻ 누르면 게시판 새로고침 호출 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await page.screenshot({ path: `${OUT}폰_주소창.png` });
  }
  // 쪽지 자동 정리: 상대별 최근 n통만 (설정 도움말 「상대마다 최근 쪽지를 이 수만큼만 남기고」, 기본 켬·40)
  {
    await bootChat(firstChat({}, { $gn_storage_auto_dm: '1', $gn_storage_limit_dm: '3' })); await openSite();
    const s = step('쪽지자동정리_상한3');
    await gref();
    await press('.bs [data-action="gn-open"][data-value="1846003"]');
    await queue(JSON.stringify({ comments: [], incoming: [{ nick: '브로커K', body: '쪽지1' }], activity: [] }));
    await fill('.bs .gn-composer [data-input="gn-draft"]', '댓글'); await press('.bs .gn-composer [data-action="gn-send"]'); await waitIdle();
    await act('gn-sub', 'dm', 600);
    await page.evaluate(() => document.querySelector('[data-action="gn-open-dm"][data-value="브로커K"]')?.click()); await sleep(700);
    for (let i = 2; i <= 4; i++) {
      await queue(JSON.stringify({ body: `답${i}` }));
      await fill('.gn-dmwin [data-input="gn-draft"], .gn-pane [data-input="gn-draft"]', `내 쪽지${i}`);
      await press('.gn-dmwin [data-action="gn-send"], .gn-pane [data-action="gn-send"]'); await waitIdle();
    }
    const raw = (await vars()).$gn_raw || '';
    const dl = raw.split('\n').filter((l) => /^D/.test(l));
    note(s, 'D 줄', dl.map((l) => l.slice(0, 60)));
    check(s, '상대(브로커K)별 쪽지가 3통 이하로 정리', dl.length > 0 && dl.length <= 3, '≤3', dl.length);
    const shownN = await page.evaluate(() => (document.querySelector('.gn-dmwin, .gn-pane')?.innerText.match(/내 쪽지\d|답\d|쪽지1/g) || []).length);
    note(s, '쪽지 창에 보이는 쪽지 수', shownN);
  }
}

// ═════════ part pic: 사진 표식 [사진:이름]·[사진:이름_표정] 이 쪽지·톡에서 (코스 F-3, 결정표 F-19·F-02, 톡은 답-11: 사실만 적음) ═════════
if (PARTS.includes('pic')) {
  part = 'PIC_'; stepNo = 0;
  const openSite = async (site = 'gn') => { await closeWin(page); await sleep(200); await openWin(page); await sleep(300); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await act('nav-tab', 'net'); if (!(await page.$(`.bs-${site}`))) await act('br-go', site, 600); };
  {
    await bootChat({ message: [{ role: 'user', data: '지하상가 앞.', chatId: 'u1' }, { role: 'char', data: `잼트리가 셔터 앞에 서 있었다.\n${ST('11:20 PM')}`, chatId: 'c1' }], scriptstate: { ...BASE_VARS } });
    await openSite();
    const s = step('선쪽지_사진표식');
    await queue(JSON.stringify({ posts: [{ author: '야근요정', id: 1846003, tag: '현장', title: '셔터', date: '2025.03.14 22:40', views: 1, upvotes: 0, content: '셔터 또', mine: false, comments: [] }], incoming: [], keyFigures: [] }));
    await act('gn-refresh', '', 300); await waitIdle();
    await press('.bs [data-action="gn-open"][data-value="1846003"]');
    await queue(JSON.stringify({ comments: [], incoming: [{ nick: '브로커K', body: '이 사람 맞죠?\n[사진:잼트리_smile]' }], activity: [] }));
    await fill('.bs .gn-composer [data-input="gn-draft"]', '봤어요'); await press('.bs .gn-composer [data-action="gn-send"]'); await waitIdle();
    await act('gn-sub', 'dm', 600);
    await page.evaluate(() => document.querySelector('[data-action="gn-open-dm"][data-value="브로커K"]')?.click()); await sleep(800);
    const r = await page.evaluate(() => { const box = document.querySelector('.gn-dmwin, .gn-pane, .bs'); return { imgs: [...(box?.querySelectorAll('img') ?? [])].map((i) => i.getAttribute('src')?.slice(0, 20)), text: box?.innerText.slice(0, 400) }; });
    note(s, '쪽지 화면', r);
    check(s, '쪽지의 [사진:잼트리_smile] 은 그림으로(표식 원문이 안 보임)', !/\[사진:/.test(r.text ?? '') && r.imgs.some((x) => /^blob:|^data:/.test(x ?? '')), '그림', r);
    await page.screenshot({ path: `${OUT}쪽지_사진.png` });
  }
  {
    await bootChat(firstChat()); await openPhoneTab(); await act('ph-dm', E, 600);
    const s = step('톡_사진표식_사실만');
    await queue(patch(add(E, '[사진:에일린_smile]'), add(E, '[사진:중림 지하상가]')));
    await sendText('사진 보내 줘요.'); await waitIdle();
    const r = await page.evaluate(() => { const box = document.querySelector('.ph-log'); return { imgs: [...(box?.querySelectorAll('img') ?? [])].map((i) => i.getAttribute('src')?.slice(0, 20)), text: box?.innerText.slice(-300) }; });
    note(s, '답-11: 괴담톡 [사진:] 표시 꼴(판정 안 함)', r);
    await page.screenshot({ path: `${OUT}톡_사진.png` });
  }
}

// ═════════ part attach: 실제 사진 첨부 (코스 F-4: 보조 요청엔 사진, 본편엔 설명 글만, 못 읽으면 「n번 사진을 못 읽음」 줄) ═════════
if (PARTS.includes('attach')) {
  part = 'ATT_'; stepNo = 0;
  const { deflateSync } = await import('node:zlib');
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc(8 * (1 + 8 * 3)); for (let y = 0; y < 8; y++) { raw[y * 25] = 0; for (let x = 0; x < 8; x++) raw.set([200, 30 * y, 30 * x], y * 25 + 1 + x * 3); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(8, 0); ih.writeUInt32BE(8, 4); ih[8] = 8; ih[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const PNG = `${OUT}att.png`; writeFileSync(PNG, png);
  await bootChat(firstChat());
  await openPhoneTab(); await act('ph-dm', E, 600);
  {
    const s = step('빈방_사진올리기');
    await press('.ph-plus');
    const [fc0] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.locator('[data-pick-photo]:visible').first().click()]);
    await page.evaluate(() => { window.__cib = 0; window.__chg = 0; const o = window.createImageBitmap; window.createImageBitmap = (...a) => { window.__cib++; return o(...a); }; document.querySelectorAll('input[type=file]').forEach((i) => i.addEventListener('change', () => { window.__chg++; window.__chgFiles = [...i.files].map((f) => [f.name, f.type, f.size]); }, true)); });
    await fc0.setFiles([PNG]); await sleep(1500);
    note(s, '고르기 change·파일·createImageBitmap', await page.evaluate(() => ({ chg: window.__chg, files: window.__chgFiles, cib: window.__cib })));
    const n0 = await page.evaluate(() => document.querySelectorAll('.at-item').length);
    note(s, '빈 1:1 방(대화 0)에서 사진 고른 뒤 첨부 수', n0);
    note(s, '화면 글(사진·첨부 줄)', (await page.evaluate(() => document.querySelector('.gx')?.innerText ?? '')).split('\n').filter((l) => /사진|첨부|저장|못/.test(l)));
    note(s, 'view 상태', await page.evaluate(() => ({ room: JSON.parse(window.__chat.scriptstate.$ph_state || '{}').rooms })));
    // 붙여넣기 길로도 (같은 addPhotos)
    const b64 = png.toString('base64');
    await page.evaluate(() => { window.__cib = 0; const o = window.createImageBitmap; window.createImageBitmap = (...a) => { window.__cib++; return o(...a); }; });
    await page.evaluate((b64) => { const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], 'p.png', { type: 'image/png' })); const ta = document.querySelector('[data-input="ph-draft"]'); ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, b64);
    await sleep(1500);
    note(s, '붙여넣기 뒤 첨부 수·createImageBitmap 호출·저장된 에셋', await page.evaluate(() => ({ items: document.querySelectorAll('.at-item').length, cib: window.__cib, assets: Object.keys(window.__assets || {}) })));
    await press('.ph-plus').catch(() => {});
    await queue(REPLY3); await sendText('먼저 글.'); await waitIdle();
  }
  {
    const s = step('사진올리기_보내기');
    // 고르기 창(filechooser) 길은 가짜 Risu 에서 change 가 플러그인 고르기 칸에 닿지 않아(틀 문제, 위 단계 note) 붙여넣기 길로 넣는다. 고르기 창 길은 T2 몫
    const b64 = png.toString('base64');
    await page.evaluate((b64) => { const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const dt = new DataTransfer(); for (let i = 0; i < 4; i++) dt.items.add(new File([bytes], `p${i}.png`, { type: 'image/png' })); document.querySelector('[data-input="ph-draft"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, b64);
    await sleep(2000);
    const nThumb = await page.evaluate(() => document.querySelectorAll('.at-item-image').length);
    check(s, '사진은 한 번에 최대 3(ATTACH_MAX)', nThumb === 3, 3, nThumb);
    await queue(REPLY3);
    const n0 = await llmCount();
    await sendText('이 사진 봐요.'); await waitIdle();
    const req = (await llmCount()) > n0 ? await page.evaluate((i) => window.__calls.llm[i].messages, n0) : [];
    writeFileSync(`${OUT}단계${s.n}_${s.name}.json`, JSON.stringify(req, (k, v) => (k === 'base64' ? `${String(v).slice(0, 40)}…(${String(v).length})` : v), 2));
    const mm = req.flatMap((m) => m.multimodals ?? []);
    check(s, '보조 요청에 실제 사진(multimodals): 방 기록 속 사진 넷(앞 턴 1 + 이번 3)', mm.length === 4 && mm.every((x) => x.type === 'image' && /^data:image/.test(x.base64)), 4, mm.length);
    check(s, '못 읽은 사진 줄 없음', !allText(req).includes('could not be loaded'), '없음', '');
    const out = await peekMain('다음 장면.');
    const t = allText(out);
    check(s, '본편 요청엔 사진 데이터 없이 설명 글만', !/data:image|base64/.test(t) && !out.some((m) => m.multimodals), '글만', (/.{0,80}ATTACHMENT.{0,80}/.exec(t) || [])[0]);
    await saveState(s);
  }
  {
    const s = step('사진못읽음');
    await page.evaluate(() => { for (const k of Object.keys(window.__assets)) delete window.__assets[k]; window.__readAsset = async () => null; });
    await queue(REPLY3);
    const n0 = await llmCount();
    await sendText('아까 사진 다시 봐요.'); await waitIdle();
    const req = (await llmCount()) > n0 ? await page.evaluate((i) => window.__calls.llm[i].messages, n0) : [];
    const t = allText(req);
    note(s, '못 읽음 줄', (/Image [0-9, ]+ could not be loaded[^\n]*/.exec(t) || [])[0]);
    check(s, '저장소에서 못 읽은 사진은 「Image n could not be loaded」 줄로', /Image 1, 2, 3, 4 could not be loaded/.test(t), 'Image 1, 2, 3, 4', (/Image [^\n]{0,60}/.exec(t) || [])[0]);
    const txt = await screen();
    note(s, '창의 깨진 사진 틀 수(이 창에서 올린 사진은 미리보기 주소가 남아 그대로 보일 수 있음)', await page.evaluate(() => document.querySelectorAll('.at-card-image.broken, .ax-img.broken').length));
  }
}

// ═════════ part fail: 저장 실패 (던짐 / 조용히 안 씀) — 코스 5장 「저장 실패」, 기대값: 실패가 화면에 알려지고 대기 상태가 남지 않음(공-02 일관된 쪽) ═════════
if (PARTS.includes('fail')) {
  part = 'FAIL_'; stepNo = 0;
  for (const mode of ['throw', 'silent']) {
    await bootChat(firstChat());
    await openPhoneTab();
    await act('ph-dm', E, 600);
    const s = step(`톡보내기_채팅저장${mode}`);
    await page.evaluate((mode) => {
      const real = window.risuai.setChatToIndex; let n = 0; window.__failLog = [];
      window.risuai.setChatToIndex = async (a, b, chat) => { n++; if (window.__failOn) { window.__failLog.push(n); if (mode === 'throw') throw new Error('시험용 저장 실패'); return undefined; } return real(a, b, chat); };
      window.__failOn = true;
    }, mode);
    await queue(REPLY1);
    const n0 = await llmCount();
    await sendText('저장 실패 시험.');
    await waitIdle();
    const calls = (await llmCount()) - n0;
    await page.evaluate(() => { window.__failOn = false; });
    const txt = await screen();
    const st = await phoneState();
    note(s, '걸린 저장 호출 번호', await page.evaluate(() => window.__failLog));
    note(s, '보조 호출 수', calls);
    note(s, '화면 글(끝)', txt.slice(-300));
    note(s, '저장된 1:1 방', st.rooms[DM_E] ?? null);
    check(s, '보낸 글이 사라지지 않음: 저장 안 됐으면 입력칸·화면에 남거나 실패 안내', !!st.rooms[DM_E]?.messages?.length || /실패|못|다시/.test(txt) || (await page.evaluate(() => document.querySelector('[data-input="ph-draft"]')?.value)) === '저장 실패 시험.', '남음/안내', { saved: st.rooms[DM_E]?.messages?.length ?? 0, draft: await page.evaluate(() => document.querySelector('[data-input="ph-draft"]')?.value) });
    // 실패를 끈 뒤 같은 방에서 다시 보내기가 되는지 (막힘 없음)
    await queue(REPLY3);
    const n1 = await llmCount();
    await sendText('다시 보냄.');
    await waitIdle();
    const st2 = await phoneState();
    check(s, '실패 뒤 다시 보내기가 막히지 않음', (await llmCount()) - n1 === 1 && st2.rooms[DM_E]?.messages?.some((m) => m.text === '다시 보냄.'), '보내짐', { calls: (await llmCount()) - n1, msgs: st2.rooms[DM_E]?.messages?.map((m) => m.text), text: (await screen()).slice(-200) });
    await saveState(s);
  }
  // 기기 저장소 실패: 괴담톡 화면 상태(goei:prefs) 쓰기 던짐 → 기능이 멈추지 않는지
  {
    await bootChat(firstChat());
    const s = step('기기저장소던짐_탭열기');
    await page.evaluate(() => { const real = window.risuai.pluginStorage.setItem; window.risuai.pluginStorage.setItem = async (k, v) => { if (String(k).startsWith('goei:prefs')) throw new Error('시험용 기기 저장 실패'); return real(k, v); }; });
    await openPhoneTab();
    await act('ph-dm', E, 600);
    await queue(REPLY1);
    await sendText('기기 저장 실패 중.');
    await waitIdle();
    const st = await phoneState();
    check(s, '기기 저장소가 던져도 톡 보내기·저장은 됨', st.rooms[DM_E]?.messages?.length >= 2, '2+', st.rooms[DM_E]?.messages?.map((m) => m.text));
  }
}

// ═════════ part stream: 보조 호출 스트리밍 (리스AI 꼴 {"0": 누적 글}) — T1_사용법 3 「기능 길은 구간이 확인」 ═════════
if (PARTS.includes('stream')) {
  part = 'STREAM_'; stepNo = 0;
  await bootChat(firstChat());
  await openPhoneTab();
  await act('ph-dm', E, 600);
  const streamQ = (parts, errorAfter = -1) => page.evaluate(([parts, errorAfter]) => {
    let i = 0; let acc = '';
    const rs = new ReadableStream({ async pull(c) { await new Promise((r) => setTimeout(r, 30)); if (errorAfter >= 0 && i === errorAfter) { c.error(new Error('끊김')); return; } if (i >= parts.length) { c.close(); return; } acc += parts[i++]; c.enqueue({ 0: acc }); } });
    window.__llm = [{ type: 'streaming', result: rs }];
  }, [parts, errorAfter]);
  {
    const s = step('조각으로_온_답');
    const full = REPLY3; const cut = [full.slice(0, 20), full.slice(20, 50), full.slice(50)];
    await streamQ(cut);
    await sendText('스트림 시험.');
    await waitIdle();
    const r = (await phoneState()).rooms[DM_E];
    check(s, '조각을 이어 붙인 답이 저장(그래. 들어가.)', r?.messages?.some((m) => m.text === '그래. 들어가.') && !r.pending, '저장', r?.messages?.map((m) => m.text));
  }
  {
    const s = step('조각_받다_끊김');
    await streamQ([REPLY1.slice(0, 30), REPLY1.slice(30)], 1);
    await sendText('끊김 시험.');
    await waitIdle(20000);
    const r = (await phoneState()).rooms[DM_E];
    const txt = await screen();
    note(s, '화면 끝', txt.slice(-300));
    note(s, '대기 상태', r?.pending ?? null);
    check(s, '반쪽 답이 말풍선으로 들어가지 않음', !r?.messages?.some((m) => /lb-minitalk|\{"op"/.test(m.text)), '없음', r?.messages?.map((m) => m.text));
    check(s, '실패로 보이고 다시 시도/건너뛰기 단추가 있음', /실패|다시|건너/.test(txt) && await page.evaluate(() => !!document.querySelector('[data-action="ph-retry"],[data-action="ph-skip"]')), '다시 시도', txt.slice(-200));
  }
}

// ═════════ part think: 생각 블록 답 (공-21: 생각 블록 안 표식은 본문 표식으로 치지 않음) ═════════
if (PARTS.includes('think')) {
  part = 'THINK_'; stepNo = 0;
  await bootChat(firstChat());
  await openPhoneTab();
  await act('ph-dm', E, 600);
  {
    const s = step('생각블록_안_가짜패치');
    const ans = `<think>초안: ${patch(add(E, '생각 속 초안'))}</think>\n${patch(add(E, '진짜 답'))}`;
    await queue(ans);
    await sendText('생각 블록 시험.');
    await waitIdle();
    const texts = (await phoneState()).rooms[DM_E]?.messages?.map((m) => m.text) ?? [];
    check(s, '생각 블록 밖 패치만 저장(진짜 답), 생각 속 초안은 없음', texts.includes('진짜 답') && !texts.includes('생각 속 초안'), '진짜 답만', texts);
  }
  {
    const s = step('Thoughts꼴_리스AI');
    const ans = `<Thoughts>\n${patch(add(E, '생각 속 둘째'))}\n</Thoughts>\n\n${patch(add(E, '둘째 진짜'))}`;
    await queue(ans);
    await sendText('Thoughts 꼴.');
    await waitIdle();
    const texts = (await phoneState()).rooms[DM_E]?.messages?.map((m) => m.text) ?? [];
    check(s, '<Thoughts> 안 패치는 무시', texts.includes('둘째 진짜') && !texts.includes('생각 속 둘째'), '둘째 진짜만', texts);
  }
}

// ═════════ part opts: 메인/보조 모델·생각 단계·비망록·생성 언어·기능 끔 ═════════
if (PARTS.includes('opts')) {
  part = 'OPTS_'; stepNo = 0;
  const sendOnce = async (s, vars0, text) => {
    await bootChat(firstChat({}, vars0));
    await openPhoneTab(); await act('ph-dm', E, 600);
    await queue(REPLY3);
    const n0 = await llmCount();
    await sendText(text); await waitIdle();
    const i = (await llmCount()) > n0 ? n0 : -1;
    const msgs = i >= 0 ? await llmAt(i) : []; const opt = i >= 0 ? await llmOpt(i) : {};
    writeReq(s, msgs, '');
    return { msgs, opt, sys: sysOf(msgs), all: allText(msgs) };
  };
  {
    const s = step('메인모델');
    const { opt } = await sendOnce(s, { $ph_model: 'main' }, '메인.');
    check(s, '「메인 모델」이면 mode model', opt.mode === 'model', 'model', opt);
  }
  {
    const s = step('보조모델_기본');
    const { opt } = await sendOnce(s, {}, '보조.');
    check(s, '기본 보조 모델(submodel)', opt.mode === 'submodel' || opt.mode === 'otherAx', 'submodel', opt);
  }
  {
    const s = step('생성언어_영어');
    const { sys, all } = await sendOnce(s, { $gen_lang: 'en' }, 'English.');
    check(s, '고급 「생성 언어」 영어($gen_lang en): Write all output in English.', all.includes('Write all output in English.'), 'LANGUAGE.EN', (/Write all output in \w+/.exec(all) || [])[0]);
    void sys;
  }
  {
    const s = step('생성언어_대화언어_기본');
    const { all } = await sendOnce(s, {}, '기본.');
    check(s, '기본(대화 언어): LANGUAGE.KO/EN 줄 없이 괴담톡 LANGUAGE 절', !/Write all output in/.test(all) && all.includes('dominant language of the actual conversation'), '괴담톡 LANGUAGE', (/Write all output in \w+/.exec(all) || [])[0]);
  }
  {
    const s = step('생각단계_적고지움');
    const { sys } = await sendOnce(s, { $ph_adv_thoughts: 'note' }, '생각 적기.');
    check(s, '생각 단계 「적고 지움」: 요청에 # Thoughts 머리', sys.includes('# Thoughts'), '# Thoughts', '');
  }
  {
    const s = step('생각단계_속으로');
    const { sys } = await sendOnce(s, { $ph_adv_thoughts: 'inner' }, '속으로.');
    check(s, '「속으로만」: # Thoughts Guideline', sys.includes('# Thoughts Guideline'), 'Guideline', '');
  }
  {
    const s = step('비망록');
    const { msgs } = await sendOnce(s, { $ph_adv_memo: '1' }, '비망록.');
    const first = String(msgs[0]?.content ?? '');
    note(s, '첫 system 앞 200자', first.slice(0, 200));
    check(s, '비망록 켬: system 앞에 긴 앞글(비망록 페르소나)', first.length > 3000 && msgs.some((m) => m.role === 'assistant'), '앞글+prefill', { len: first.length, roles: msgs.map((m) => m.role) });
  }
}

allErrors.push(...(errors ?? []));
await b.close();
const fails = results.filter((r) => !r.ok);
writeFileSync(`${OUT}결과-${PARTS.join('+')}.json`, JSON.stringify({ run: results.length, pass: results.length - fails.length, fails, notes, errors: allErrors }, null, 2));
console.log(`\n${results.length - fails.length}/${results.length} 통과, 페이지 오류 ${allErrors.length}`);
if (allErrors.length) console.log(allErrors.slice(0, 10));
