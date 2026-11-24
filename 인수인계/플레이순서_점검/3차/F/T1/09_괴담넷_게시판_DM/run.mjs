// 플레이 순서 점검 2차 · 09 괴담넷·게시판·DM (지침: ../../GPT_점검지침_초안.md 3판, 틀: ../02_우주쇼핑몰/run.mjs)
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄운다.
// part=main  : PC 1100×900 에서 화면 단추를 눌러 새로고침 → 글 열기 → 댓글 → 답글 → 받은 쪽지 답장 → 글쓴이에게 쪽지 → 새 글 → 본편 다음 턴 → 그다음 턴 → 다시 새로고침
// part=branch: 같은 틀에서 상태만 바꿔 갈래 (설정 끔·자동 매 턴·창을 열 때·한 번에 요청·응답 실패·빈 답·꼴 틀린 답·늦게 온 답·연타·새로고침·다시 굴리기·지우기)
// part=phone : 폰 390×844 에서 단추로 새로고침·글 열기·댓글
// part=sites : 괴담갤·세정게·연어 마켓 (지침·변수·본편 이름표가 사이트마다 따로인가)
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과-<part>.json
// 사용법: node 인수인계/플레이순서_점검/2차/09_괴담넷_게시판_DM/run.mjs [main|branch|phone|sites]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main', 'branch', 'phone', 'sites'];
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ── 장면 (로어북 「중림 지하상가」, 관리국 신입) ──
const ST = (time, date = '2025.03.14', place = '중림 지하상가') => `[▣|${date}|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|100000]`;
const C1 = `퇴근길, 중림 지하상가 셔터가 반쯤 내려와 있었다. 휴대폰 알림이 연달아 울렸다.\n${ST('11:20 PM')}`;
const C2 = `숙소로 돌아와 불을 켰다. 지하상가 쪽 하늘이 아직 붉었다.\n${ST('11:50 PM', '2025.03.14', '관리국')}`;
const C3 = `아침, 출근 준비를 하며 휴대폰을 다시 열었다.\n${ST('07:30 AM', '2025.03.15', '관리국')}`;
const C2b = `숙소로 돌아와 샤워를 했다. 지하상가 쪽은 조용했다.\n${ST('11:52 PM', '2025.03.14', '관리국')}`;

// ── 가짜 답 ──
const REFRESH1 = JSON.stringify({
  posts: [
    { author: '야근요정', id: 1846003, tag: '현장', title: '중림 지하상가 B구역 또 셔터 내림', date: '2025.03.14 22:40', views: 1820, upvotes: 64, content: '오늘 B구역 셔터 또 내려감. 누가 들어갔는지 아는 사람?', mine: false,
      comments: [{ author: '단가충', content: '그쪽 회사 차 두 대 봄', parent: 0, mine: false, time: '22:51' }, { author: 'abc92', content: '단가 얼마래', parent: 1, mine: false, time: '22:58' }] },
    { author: '회수반막내', id: 1846002, tag: '거래', title: '회수물 시세 질문', date: '2025.03.14 21:10', views: 940, upvotes: 21, content: '손거울류 요즘 얼마 쳐줌?', mine: false,
      comments: [{ author: '시세봇', content: '상태 따라 다름. 금 간 건 반값', parent: 0, mine: false, time: '21:30' }] },
    { author: 'ㅇㅇ(118.235)', id: 1846001, tag: '잡담', title: '오늘 회식 메뉴 추천 좀', date: '2025.03.14 20:05', views: 610, upvotes: 9, content: '현장 끝나고 뭐 먹냐', mine: false, comments: [] },
  ],
  incoming: [],
  keyFigures: [],
});
const COMMENT1 = JSON.stringify({
  comments: [{ author: '단가충', content: '봤으면 사진 좀', parent: 3, time: '23:25' }, { author: '야근요정', content: '셔터 다시 올라감?', parent: 4, time: '23:27' }],
  incoming: [{ nick: '브로커K', body: '댓글 보고 연락드립니다. 그 차 번호판 보셨어요?' }],
  activity: [{ id: 1846002, viewsDelta: 12, upvotesDelta: 1, comments: [{ author: '시세봇2', content: '손거울은 요새 안 삼', parent: 0, time: '23:24' }] }],
});
const REPLY1 = JSON.stringify({ comments: [{ author: '시세봇', content: '금 안 갔으면 정가', parent: 0, time: '23:31' }], incoming: [], activity: [] });
const DM1 = JSON.stringify({ body: '번호판 앞자리만이라도 알려 주시면 사례합니다.' });
const DM2 = JSON.stringify({ body: '손거울이면 직접 보고 말씀드릴게요.' });
const POST1 = JSON.stringify({ post: { title: '지하상가 셔터 앞 검은 승합차 본 사람', content: '오늘 밤 11시쯤 B구역 셔터 앞에 검은 승합차 두 대 서 있었음.', tag: '목격' }, comments: [{ author: 'abc92', content: '그거 그쪽 회사 차임', parent: 0, time: '23:41' }], incoming: [], activity: [] });
const REFRESH2 = (mineId) => JSON.stringify({
  posts: [
    { id: mineId, views: 120, upvotes: 4, comments: [{ author: '단가충', content: '아침에 다시 가 봤는데 셔터 올라가 있음', parent: 0, mine: false, time: '07:10' }] },
    { author: '아직안잠', id: 1846010, tag: '현장', title: '지하상가 오늘 정상 영업함', date: '2025.03.15 07:05', views: 300, upvotes: 12, content: '아침에 보니 다 열려 있음', mine: false, comments: [] },
    { author: '감자', id: 1846011, tag: '잡담', title: '출근하기 싫다', date: '2025.03.15 06:50', views: 210, upvotes: 5, content: '진짜로', mine: false, comments: [{ author: 'ㅁㄴㅇㄹ', content: 'ㄹㅇ', parent: 0, mine: false, time: '06:55' }] },
  ],
  incoming: [],
  keyFigures: [{ keyFigure: '송진섭', nickname: '아직안잠', note: '짧게 씀' }],
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
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const allText = (msgs) => msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
const MARK = /%%SCENE_CARD|%%GOEI_|%%SEED|\[shop-ready|\{\{getvar|\{\{#when|__GN_[A-Z_]+__|__LIMIT_\w+__|__SITE_PICS__|\$gn_|\$lb_cfg/;
const gnetBlocks = (out) => out.filter((m) => String(m.content).includes('"feature":"gnet"')).map((m) => String(m.content));

const b = await launch();
let page; let errors;
const allErrors = [];
const vars = () => page.evaluate(() => window.__chat.scriptstate);
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
    (document.querySelector('.bs') || document.querySelector('.gx-panel') || document.querySelector('.gx') || document.body).appendChild(el);
    el.click();
    el.remove();
  }, { action, value });
  await sleep(wait);
};
const vis = (sel) => sel.split(',').map((x) => `${x.trim()}:visible`).join(', ');
const press = async (sel, wait = 500) => { await page.locator(vis(sel)).first().click({ timeout: 5000 }); await sleep(wait); };
const typeDraft = async (text, sel = '[data-input="gn-draft"]') => { await page.locator(vis(sel)).first().fill(text); await sleep(100); };
const waitIdle = async (max = 15000) => { const t0 = Date.now(); let n = -1; let since = Date.now(); while (Date.now() - t0 < max) { const k = await llmCount(); const busy = await page.evaluate(() => !!document.querySelector('.nw-busy')); if (k !== n || busy) { n = k; since = Date.now(); } else if (Date.now() - since > 900) return; await sleep(200); } };
const screen = () => page.evaluate(() => document.querySelector('.bs')?.innerText ?? '');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
/** GN1 저장 형식을 읽는다 (src/core/gnet.ts decode 와 같은 규칙, 점검용 간이판) */
const decodeRaw = (raw) => {
  const st = { posts: [], archive: [], dms: [], sources: {}, seq: 0 };
  const map = new Map();
  const fields = (line) => { const out = []; let cur = ''; let esc = false; for (const c of line) { if (esc) { cur += c === 'n' ? '\n' : c === 'p' ? '|' : c === '\\' ? '\\' : `\\${c}`; esc = false; } else if (c === '\\') esc = true; else if (c === '|') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  for (const line of String(raw ?? '').split('\n')) {
    const p = fields(line);
    if (p[0] === 'Q') st.seq = Number(p[1]);
    else if (p[0] === 'P' || p[0] === 'A') { const post = { id: Number(p[1]), date: p[2], nick: p[3], title: p[4], views: Number(p[5]), votes: Number(p[6]), body: p[7], mine: p[8] === '1', tag: p[9], scrap: p[10] === '1', back: p[13], touch: p[14], comments: [] }; (p[0] === 'A' ? st.archive : st.posts).push(post); map.set(post.id, post); }
    else if (p[0] === 'C' || p[0] === 'AC') map.get(Number(p[1]))?.comments.push({ parent: Number(p[2]), nick: p[3], body: p[4], mine: p[5] === '1', unread: p[6] === '1', time: p[7] });
    else if (p[0] === 'D') st.dms.push({ nick: p[1], side: p[2], body: p[3], unread: p[4] === '1', date: p[5] });
    else if (p[0] === 'T') st.sources[p[1]] = { postid: Number(p[2]), title: p[3], body: p[4], author: p[5], quote: p[6], quoteAuthor: p[7] };
  }
  return st;
};
const board = async (key = '$gn_raw') => decodeRaw((await vars())[key]);
const KEEP = /^\$(gn_|gal_|wpf_|sm_|cooldown_received|st_unread_|lb_cfg_lb-(gn|gal|sm|wpf)\.(lazy|context|incoming|keep))/;
const saveState = async (s) => { const v = await vars(); const keep = {}; for (const [k, val] of Object.entries(v)) if (KEEP.test(k)) keep[k] = /_raw$/.test(k) ? decodeRaw(val) : val; writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: keep, messages: (await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })))) }, null, 2)); };
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
const peekMain = async (userText) => { const c = await snap(); const out = await mainRequest(userText, 'peek'); await page.evaluate((c) => { window.__chat = c; }, c); return out; };
const botReply = async (text, cid, wait = 900) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(wait); };
const rerollLast = async (text, cid) => { await page.evaluate(() => { const m = window.__chat.message; if (m.at(-1)?.role === 'char') m.pop(); }); await botReply(text, cid); };
const setVars = (v) => page.evaluate((v) => { window.__chat.scriptstate = { ...(window.__chat.scriptstate ?? {}), ...v }; }, v);
const openSite = async (site = 'gn') => {
  await closeWin(page); await sleep(200);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await act('nav-tab', 'net');
  if (!(await page.$(`.bs-${site}`))) await act('br-go', site, 600);
};
const BASE_VARS = { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $ib_affiliation: '관리국', $an_report: '', $in_report: '', $ms_report: '', $st_wallet: JSON.stringify({ start: 100000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) };
const firstChat = (extra = {}) => ({ message: [{ role: 'user', data: '지하상가 앞을 지나간다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }], scriptstate: { ...BASE_VARS, ...extra } });
const bootChat = async (chat0, v = 'pc') => {
  if (page) { allErrors.push(...errors); await page.close(); }
  ({ page, errors } = await boot(b, fx, chat0, v, { store: STORE }));
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
};
const lastReq = async () => { const n = await llmCount(); return n ? llmAt(n - 1) : []; };
/** 요청의 [현재 작업] 칸 */
const taskOf = (msgs) => { const t = allText(msgs); const i = t.indexOf('[현재 작업]'); return i >= 0 ? t.slice(i) : ''; };
const jsonAfter = (text, head) => { const i = text.indexOf(head); if (i < 0) return null; const s = text.indexOf('{', i); let d = 0; for (let j = s; j < text.length; j++) { if (text[j] === '{') d++; else if (text[j] === '}') { d--; if (!d) { try { return JSON.parse(text.slice(s, j + 1)); } catch { return null; } } } } return null; };

// ═════════════════════ part main: 대표 경로 (PC, 화면 단추) ═════════════════════
if (PARTS.includes('main')) {
  part = 'PC_';
  await bootChat(firstChat());
  let mineId = 0;
  // 01 인터넷 → 괴담넷 → 빈 게시판에서 새로고침
  {
    const s = step('새로고침_첫목록');
    await openSite('gn');
    const empty = await screen();
    check(s, '빈 게시판에 새로고침 단추가 보임', /새로고침/.test(empty), '새로고침', empty.slice(0, 200));
    await queue(REFRESH1);
    const n0 = await llmCount();
    await press('.bs [data-action="gn-refresh"]');
    await waitIdle();
    const n1 = await llmCount();
    check(s, '보조 호출 1회', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REFRESH1);
    const all = allText(msgs);
    const opt = n1 > n0 ? await llmOpt(n0) : {};
    check(s, '모델 = 보조 모델(기본 mode 2)', opt.mode === 'submodel', 'submodel', opt.mode);
    check(s, '이야기 시각(상태창 2025.03.14 11:20 PM → 23:20)이 들어감', all.includes('Narrative time: 2025.03.14 23:20'), 'Narrative time: 2025.03.14 23:20', /Narrative time:[^\n]*/.exec(all)?.[0]);
    check(s, '내 닉네임(기본 익명) 이 들어감', all.includes('User handle: 익명'), 'User handle: 익명', /User handle:[^\n]*/.exec(all)?.[0]);
    check(s, '최근 본문이 들어감', all.includes('셔터가 반쯤 내려와'), '최근 본문', all.includes('셔터가 반쯤'));
    check(s, '괴담넷 지침(About the board 괴담넷) 이 들어감', /괴담넷 is a closed forum/.test(all), '괴담넷 설명', /About the board\n[^\n]{0,60}/.exec(all)?.[0]);
    check(s, '개수 자리표가 설정값으로 풀림(5-7, 0-6)', all.includes('Target 5-7 posts') && all.includes('0-6 comments per new NPC post'), '5-7 / 0-6', /Target [^\n]{0,60}/.exec(all)?.[0]);
    check(s, '플러그인 내부 표식·풀리지 않은 자리표가 새지 않음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    const extra = /# Additional bot world state[\s\S]*?(?=\n\n|$)/.exec(all)?.[0] ?? '';
    note(s, '현재 발생 상황(LB.EXTRA) 칸', extra.slice(0, 600));
    check(s, 'LB.EXTRA 의 빈 변수가 null 로 새지 않음', !/: null\b/.test(extra), '「null」 없음', extra.match(/[^\n]*: null[^\n]*/g));
    const st = await board();
    check(s, '글 3개가 저장됨(번호·분류·댓글 유지)', st.posts.length === 3 && st.posts[0].id === 1846003 && st.posts[0].tag === '현장' && st.posts[0].comments.length === 2, 3, st.posts.map((p) => `${p.id}:${p.tag}:${p.comments.length}`));
    check(s, '댓글 시각이 「날짜 시각」으로 찍힘', st.posts[0].comments[0].time === '2025.03.14 22:51', '2025.03.14 22:51', st.posts[0].comments[0].time);
    const txt = await screen();
    check(s, '목록에 세 글 제목이 보임', ['B구역 또 셔터', '회수물 시세 질문', '회식 메뉴'].every((t) => txt.includes(t)), '세 제목', txt.slice(0, 400));
    await saveState(s);
  }
  // 02 글 열기 → 댓글 달기
  {
    const s = step('글열기_댓글');
    await press('.bs [data-action="gn-open"][data-value="1846003"]');
    const txt = await screen();
    check(s, '글을 열면 본문·댓글이 보임', txt.includes('누가 들어갔는지') && txt.includes('그쪽 회사 차 두 대'), '본문·댓글', txt.slice(0, 300));
    await typeDraft('나도 봤음. 검은 승합차 두 대');
    await queue(COMMENT1);
    const n0 = await llmCount();
    await press('.bs .gn-composer [data-action="gn-send"]');
    await waitIdle();
    const n1 = await llmCount();
    check(s, '보조 호출 1회', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, COMMENT1);
    const all = allText(msgs);
    const task = jsonAfter(taskOf(msgs), '[현재 작업]');
    check(s, '작업에 글·내 댓글(번호 3)·replyTo 3', task?.post?.id === 1846003 && task?.replyTo === 3 && task?.comments?.some((c) => c.index === 3 && c.mine), { replyTo: 3 }, task && { replyTo: task.replyTo, comments: task.comments });
    check(s, '행동 문장에 내가 쓴 댓글이 들어감', all.includes('The protagonist publicly commented: 나도 봤음'), 'ACTION.COMMENT', /The protagonist publicly commented:[^\n]*/.exec(all)?.[0]);
    check(s, '선쪽지 허용(첫 출처 = 내 댓글, 쉬는 턴 없음)', all.includes('"incomingAllowed":true'), 'incomingAllowed true', /"incomingAllowed":\w+/.exec(all)?.[0]);
    check(s, '다른 글 활동 목록(activityPosts)에 다른 글이 들어감', /"activityPosts":\[[^\]]*"id":1846002/.test(all), '1846002', /"activityPosts":[^\n]{0,120}/.exec(all)?.[0]);
    check(s, '내부 표식이 새지 않음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    const st = await board();
    const p = st.posts.find((x) => x.id === 1846003);
    check(s, '내 댓글이 3번에, 답글 2개가 그 아래(4 → 3, 5 → 4)', p.comments[2]?.mine && p.comments[3]?.parent === 3 && p.comments[4]?.parent === 4, '3 mine, 4→3, 5→4', p.comments.map((c, i) => `${i + 1}:${c.nick}→${c.parent}${c.mine ? '(나)' : ''}`));
    const p2 = st.posts.find((x) => x.id === 1846002);
    check(s, '다른 글 활동: 1846002 에 댓글 1개·조회 +12', p2.comments.length === 2 && p2.views === 952, { comments: 2, views: 952 }, { comments: p2.comments.length, views: p2.views });
    check(s, '선쪽지가 쪽지함에 안 읽음으로 들어감', st.dms.some((d) => d.nick === '브로커K' && d.side === 'npc' && d.unread), '브로커K 안 읽음', st.dms);
    check(s, '선쪽지 원글 = 내 댓글이 달린 글', st.sources['브로커K']?.postid === 1846003, 1846003, st.sources['브로커K']);
    const v = await vars();
    check(s, '선쪽지 쉬는 턴 기록($cooldown_received_gnet = 지금 턴 1)', v.$cooldown_received_gnet === '1', '1', v.$cooldown_received_gnet);
    check(s, '안 읽음 표시 켜짐', v.$st_unread_gnet === '1', '1', v.$st_unread_gnet);
    await saveState(s);
  }
  // 03 다른 글에서 남의 댓글에 답글
  {
    const s = step('답글');
    await press('.bs [data-action="gn-back"]');
    await press('.bs [data-action="gn-open"][data-value="1846002"]');
    await press('.bs [data-action="gn-reply"][data-value="1846002:1"]');
    await typeDraft('금 안 간 건 얼마?', '.gn-c-compose [data-input="gn-draft"]');
    await queue(REPLY1);
    const n0 = await llmCount();
    await press('.bs .gn-c-compose [data-action="gn-send"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REPLY1);
    const all = allText(msgs);
    const task = jsonAfter(taskOf(msgs), '[현재 작업]');
    check(s, 'replyTo = 내 답글 번호(3), 내 답글의 parent=1', task?.replyTo === 3 && task?.comments?.find((c) => c.index === 3)?.parent === 1, { replyTo: 3, parent: 1 }, task && { replyTo: task.replyTo, c: task.comments?.find((c) => c.index === 3) });
    check(s, '쉬는 턴(같은 턴) → 선쪽지 끔', all.includes('"incomingAllowed":false') && all.includes('incomingAllowed=false'), 'incomingAllowed false', /"incomingAllowed":\w+/.exec(all)?.[0]);
    const p = (await board()).posts.find((x) => x.id === 1846002);
    check(s, '모델 답(parent 0)은 내 답글(3) 아래로 붙음', p.comments.at(-1)?.parent === 3 && p.comments.at(-1)?.nick === '시세봇', '→3', p.comments.map((c, i) => `${i + 1}:${c.nick}→${c.parent}`));
    await saveState(s);
  }
  // 04 쪽지함 → 받은 쪽지에 답장
  {
    const s = step('받은쪽지_답장');
    await press('.bs [data-action="gn-sub"][data-value="dm"]');
    await press('[data-action="gn-open-dm"][data-value="브로커K"]');
    const v0 = await vars();
    const st0 = await board();
    check(s, '열면 읽음 처리', !st0.dms.some((d) => d.unread) && v0.$st_unread_gnet === '0', '안 읽음 없음', st0.dms.map((d) => d.unread));
    await typeDraft('앞자리 12까지만 봤어요.', '.gn-dmwin [data-input="gn-draft"], .gn-pane [data-input="gn-draft"]');
    await queue(DM1);
    const n0 = await llmCount();
    await press('.gn-dmwin [data-action="gn-send"], .gn-pane [data-action="gn-send"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, DM1);
    const all = allText(msgs);
    check(s, '원글(1846003 제목) 과 인용한 내 댓글이 들어감', all.includes('Original forum post #1846003') && all.includes('Referenced public comment') && all.includes('나도 봤음'), 'DM.ORIGIN + QUOTE', /Original forum post[^\n]*/.exec(all)?.[0]);
    const hist = /PRIVATE CONVERSATION, OLDEST TO NEWEST:\n(\[[^\n]*\])/.exec(all)?.[1];
    let h = []; try { h = JSON.parse(hist); } catch { /* */ }
    check(s, '대화 기록: 받은 쪽지 → 내 답장(마지막)', h.length === 2 && h[0].speaker === 'npc_correspondent' && h[1].speaker === 'user' && h[1].content.includes('12'), 2, h);
    check(s, '역할 묶음(ROLE BINDING) 에 상대 브로커K·나 익명', all.includes('"handle":"브로커K"') && all.includes('"handle":"익명"'), 'binding', /ROLE BINDING[^\n]*\n[^\n]*/.exec(all)?.[0]);
    check(s, '이야기 시각이 들어감', all.includes('Current story time: 2025.03.14 23:20'), 'Current story time', /Current story time:[^\n]*/.exec(all)?.[0]);
    const pub = jsonAfter(all, 'PUBLIC BOARD REFERENCE:');
    check(s, '공개 글 참고에 원글이 맨 앞(본문은 원글과 같아 생략)', pub?.posts?.[0]?.id === 1846003 && pub.posts[0].content === undefined, '1846003 맨 앞, content 없음', pub?.posts?.map((p) => `${p.id}:${p.content === undefined ? '-' : 'c'}`));
    check(s, '내부 표식이 새지 않음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    const st = await board();
    const rows = st.dms.filter((d) => d.nick === '브로커K');
    check(s, '쪽지 3통(받음·보냄·답장), 답장은 보고 있어 읽음', rows.length === 3 && rows[1].side === 'me' && rows[2].side === 'npc' && !rows[2].unread, 3, rows);
    await saveState(s);
  }
  // 05 글쓴이 닉네임 → 새 쪽지
  {
    const s = step('글쓴이에게_쪽지');
    await act('gn-dm-close');
    await act('gn-home');
    await press('.bs [data-action="gn-open"][data-value="1846002"]');
    await press('.bs .gn-post [data-action="gn-dm-from"][data-value="1846002:0"]');
    await typeDraft('손거울 하나 있는데 보실래요?', '.gn-dmwin [data-input="gn-draft"], .gn-cpane [data-input="gn-draft"], .gn-pane [data-input="gn-draft"]');
    await queue(DM2);
    const n0 = await llmCount();
    await press('.gn-dmwin [data-action="gn-send"], .gn-cpane [data-action="gn-send"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, DM2);
    const all = allText(msgs);
    check(s, '원글 = 회수물 시세 질문(1846002), 인용 없음', all.includes('Original forum post #1846002') && !all.includes('Referenced public comment'), '#1846002', /Original forum post[^\n]*/.exec(all)?.[0]);
    const st = await board();
    check(s, '회수반막내 쪽지 2통, 원글 1846002', st.dms.filter((d) => d.nick === '회수반막내').length === 2 && st.sources['회수반막내']?.postid === 1846002, 2, st.dms.filter((d) => d.nick === '회수반막내'));
    await saveState(s);
  }
  // 06 글쓰기
  {
    const s = step('새글');
    await act('gn-dm-close');
    await act('gn-home');
    await press('.bs [data-action="gn-write"]');
    await typeDraft('오늘 밤 지하상가 B구역 셔터 앞 검은 승합차 두 대 봤다는 글', '.gn-cpane [data-input="gn-draft"]');
    await queue(POST1);
    const n0 = await llmCount();
    await press('.gn-cpane [data-action="gn-send"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, POST1);
    const all = allText(msgs);
    check(s, '[현재 작업]에 내가 적은 내용이 그대로', taskOf(msgs).includes('검은 승합차 두 대 봤다는 글'), '입력', taskOf(msgs).slice(0, 200));
    check(s, '글 쓰기 지침(TITLE.GUIDELINE)·형식(PUBLIC.POST_FORMAT)', all.includes('Write a short natural forum title') && all.includes('"post":{"title"'), 'TITLE + POST_FORMAT', all.includes('Write a short natural forum title'));
    check(s, '같은 턴 → 선쪽지 끔', all.includes('"incomingAllowed":false'), false, /"incomingAllowed":\w+/.exec(all)?.[0]);
    const st = await board();
    const p = st.posts[0];
    mineId = p.id;
    check(s, '내 글이 맨 앞(mine, 번호 > 1846003, 분류 목격, 댓글 1)', p.mine && p.id > 1846003 && p.tag === '목격' && p.comments.length === 1, { mine: true, tag: '목격' }, { id: p.id, mine: p.mine, tag: p.tag, c: p.comments.length });
    check(s, '이번 턴 표시(touch) 가 붙음', p.touch === '1', '1', p.touch);
    const txt = await screen();
    check(s, '올린 글이 열려 보임', txt.includes('검은 승합차 본 사람'), '제목', txt.slice(0, 200));
    await saveState(s);
  }
  // 07 본편 다음 턴 요청
  {
    const s = step('다음턴_본편');
    await closeWin(page);
    const out = await mainRequest('숙소로 돌아간다.', 'u2');
    writeReq(s, out);
    const blocks = gnetBlocks(out);
    check(s, '본편에 게시판 기록 덩어리 1개', blocks.length === 1, 1, blocks.length);
    const blk = blocks[0] ?? '';
    const data = jsonAfter(blk, '[MODULE_CONTEXT_BEGIN]');
    const kinds = (data?.records ?? []).map((r) => `${r.kind}:${r.title ?? r.sender + '→' + r.recipient}`);
    note(s, '넘어간 기록', kinds);
    check(s, '내 글·내가 댓글 단 글이 들어감(이번 턴 표시)', kinds.some((k) => k.includes('검은 승합차 본 사람')) && kinds.some((k) => k.includes('B구역 또 셔터')), '내 글 + 1846003', kinds);
    check(s, '쪽지(브로커K·회수반막내)가 들어감', kinds.some((k) => k.includes('브로커K')) && kinds.some((k) => k.includes('회수반막내')), '쪽지', kinds);
    check(s, '사이트 이름(괴담넷)이 붙음', data?.site === '괴담넷', '괴담넷', data?.site);
    check(s, '안내문(MAIN_CONTEXT) 이 붙음', blk.includes('These saved records are reference data'), 'MAIN_CONTEXT', blk.slice(0, 120));
    check(s, '내부 표식이 새지 않음', !MARK.test(blk), '없음', MARK.exec(blk)?.[0]);
    const idx = out.findIndex((m) => String(m.content).includes('"feature":"gnet"'));
    check(s, '자리 = 마지막 유저 메시지 앞', idx >= 0 && idx < out.map((m) => m.role).lastIndexOf('user'), '앞', { idx, lastUser: out.map((m) => m.role).lastIndexOf('user') });
    await saveState(s);
  }
  // 08 그다음 턴
  {
    const s = step('그다음턴_본편');
    await botReply(C2, 'c2');
    const st = await board();
    note(s, 'touch 표시(본편 응답 뒤 읽을 때 지워짐)', st.posts.map((p) => `${p.id}:${p.touch ?? '-'}`));
    const out = await mainRequest('잔다.', 'u3');
    writeReq(s, out);
    const data = jsonAfter(gnetBlocks(out)[0] ?? '', '[MODULE_CONTEXT_BEGIN]');
    const kinds = (data?.records ?? []).map((r) => `${r.kind}:${r.title ?? r.sender + '→' + r.recipient}`);
    note(s, '그다음 턴 기록(지속 참고 자료 — 관련도·최근으로 고름)', kinds);
    check(s, '기록 덩어리는 계속 붙음(사건이 아니라 기록)', kinds.length > 0, '>0', kinds.length);
    await saveState(s);
  }
  // 09 다시 새로고침 (내 글 보호·내 댓글 단 글 교체·주요 인물)
  {
    const s = step('다시_새로고침');
    await botReply(C3, 'c3');
    await openSite('gn');
    await act('gn-home');
    await queue(REFRESH2(mineId));
    const n0 = await llmCount();
    await press('.bs [data-action="gn-refresh"], [data-action="br-reload"]');
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REFRESH2(mineId));
    const all = allText(msgs);
    check(s, '보호 글 번호 = 내 글', all.includes(`Protected post IDs: ${mineId}`), mineId, /Protected post IDs:[^\n]*/.exec(all)?.[0]);
    check(s, '이야기 시각 = 2025.03.15 07:30', all.includes('Narrative time: 2025.03.15 07:30'), '07:30', /Narrative time:[^\n]*/.exec(all)?.[0]);
    const bj = jsonAfter(all, 'Current persisted board');
    check(s, '지금 게시판 4글을 넘김(내 글 mine:true)', bj?.posts?.length === 4 && bj.posts.find((p) => p.id === mineId)?.mine === true, 4, bj?.posts?.map((p) => `${p.id}:${p.mine}`));
    check(s, '쉬는 턴(받은 턴 1, 지금 3) 지남 → 선쪽지 허용 여부', /"incomingAllowed":(true|false)/.test(all), '있음', /"incomingAllowed":\w+/.exec(all)?.[0]);
    note(s, '선쪽지', /"incomingAllowed":\w+/.exec(all)?.[0]);
    const st = await board();
    const ids = st.posts.map((p) => p.id);
    check(s, '내 글 유지(새 댓글 1 추가), 새 글 2, 옛 남의 글은 빠짐', ids.includes(mineId) && ids.includes(1846010) && ids.includes(1846011) && !ids.includes(1846003) && st.posts.find((p) => p.id === mineId).comments.length === 2, [mineId, 1846010, 1846011], ids);
    check(s, '내 글의 제목·본문은 그대로', st.posts.find((p) => p.id === mineId)?.title === '지하상가 셔터 앞 검은 승합차 본 사람', '그대로', st.posts.find((p) => p.id === mineId)?.title);
    const v = await vars();
    check(s, '주요 인물 닉네임 저장', String(v.$gn_keyfigures ?? '').includes('아직안잠'), '아직안잠', v.$gn_keyfigures);
    check(s, '내 댓글 단 남의 글(1846003): 교체 설정이라 게시판·보관함에서 사라짐(쪽지 원글은 남음)', !st.archive.some((p) => p.id === 1846003) && st.sources['브로커K'], '사라짐', { archive: st.archive.map((p) => p.id), src: st.sources['브로커K']?.postid });
    await saveState(s);
    const out = await peekMain('출근한다.');
    writeReq(s, out, undefined, '', '_본편');
    const kinds = (jsonAfter(gnetBlocks(out)[0] ?? '', '[MODULE_CONTEXT_BEGIN]')?.records ?? []).map((r) => r.title ?? r.sender);
    check(s, '본편에 빠진 글(1846003)은 더 안 들어감', !kinds.some((k) => String(k).includes('B구역 또 셔터')), '없음', kinds);
  }
  // 10 페이지 새로고침 → 같은 화면
  {
    const s = step('페이지새로고침');
    const c = await snap();
    await bootChat(c);
    await openSite('gn');
    const txt = await screen();
    check(s, '저장 상태만으로 목록이 그대로', txt.includes('지하상가 오늘 정상 영업함') && txt.includes('검은 승합차 본 사람'), '두 제목', txt.slice(0, 300));
    await act('gn-sub', 'dm');
    const dm = await page.evaluate(() => document.querySelector('.gn-dmwin, .bs')?.innerText ?? '');
    check(s, '쪽지함 두 상대가 그대로', dm.includes('브로커K') && dm.includes('회수반막내'), '두 상대', dm.slice(0, 300));
    await saveState(s);
  }
}

// ═════════════════════ part branch: 갈래 ═════════════════════
const seeded = async (extra = {}) => {
  // 새로고침까지 해 둔 채팅
  await bootChat(firstChat(extra));
  await openSite('gn');
  await queue(REFRESH1);
  await act('gn-refresh', '', 300);
  await waitIdle();
};
if (PARTS.includes('branch')) {
  part = 'B_';
  // B1 컨텍스트 포함 끔
  {
    const s = step('컨텍스트끔');
    await seeded();
    await setVars({ '$lb_cfg_lb-gn.context': '1' });
    let out = await peekMain('지나간다.');
    writeReq(s, out);
    check(s, '끄면 본편에 게시판 기록이 없음', gnetBlocks(out).length === 0, 0, gnetBlocks(out).length);
    await setVars({ '$lb_cfg_lb-gn.context': '0' });
    out = await peekMain('지나간다.');
    check(s, '다시 켜면 돌아옴', gnetBlocks(out).length === 1, 1, gnetBlocks(out).length);
    await saveState(s);
  }
  // B2 자동 「매 턴」: 응답 뒤 한 번, 다시 굴려도 안 부름(사용자 11-11), 다음 턴엔 또
  {
    const s = step('자동_매턴');
    await seeded({ '$lb_cfg_lb-gn.lazy': '0' });
    await closeWin(page);
    await queue(REFRESH2(1846003));
    let n0 = await llmCount();
    await mainRequest('숙소로 간다.', 'u2');
    await botReply(C2, 'c2', 2500);
    let d = (await llmCount()) - n0;
    check(s, '응답 뒤 자동 새로고침 1회', d === 1, 1, d);
    if (d) writeReq(s, await llmAt(n0), REFRESH2(1846003));
    const st = await board();
    check(s, '자동 결과 저장(새 글 1846010)', st.posts.some((p) => p.id === 1846010), '1846010', st.posts.map((p) => p.id));
    n0 = await llmCount();
    await queue(REFRESH1);
    await rerollLast(C2b, 'c2b');
    await sleep(1500);
    d = (await llmCount()) - n0;
    check(s, '같은 턴 다시 굴리기 → 다시 안 부름(사용자 11-11)', d === 0, 0, d);
    n0 = await llmCount();
    await queue(REFRESH1);
    await mainRequest('잔다.', 'u3');
    await botReply(C3, 'c3', 2500);
    d = (await llmCount()) - n0;
    check(s, '다음 턴엔 다시 1회', d === 1, 1, d);
    await saveState(s);
  }
  // B3 자동 「창을 열 때」: 응답 뒤엔 안 부르고 창을 열면 1회, 다시 열면 안 부름
  {
    const s = step('자동_창을열때');
    await seeded({ '$lb_cfg_lb-gn.lazy': 'open' });
    await closeWin(page);
    let n0 = await llmCount();
    await mainRequest('숙소로 간다.', 'u2');
    await botReply(C2, 'c2', 1500);
    check(s, '응답 뒤엔 안 부름', (await llmCount()) - n0 === 0, 0, (await llmCount()) - n0);
    await queue(REFRESH2(1846003));
    await openSite('gn');
    await sleep(1500); await waitIdle();
    check(s, '게시판을 열면 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await openSite('gn');
    await sleep(1200);
    check(s, '다시 열어도 같은 응답이면 안 부름', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await saveState(s);
  }
  // B4 한 번에 요청: 괴담넷·괴담갤 둘 다 매 턴·같은 모델 → 한 요청
  {
    const s = step('한번에요청');
    await bootChat(firstChat({ '$lb_cfg_lb-gn.lazy': '0', '$lb_cfg_lb-gal.lazy': '0' }));
    const galBoard = JSON.parse(REFRESH1); galBoard.posts = galBoard.posts.map((p) => ({ ...p, author: `갤${p.author}` }));
    const joint = JSON.stringify({ gnet: JSON.parse(REFRESH1), gal: galBoard });
    await queue(joint);
    const n0 = await llmCount();
    await mainRequest('숙소로 간다.', 'u2');
    await botReply(C2, 'c2', 3000);
    const d = (await llmCount()) - n0;
    check(s, '보조 호출 1회(통합)', d === 1, 1, d);
    const msgs = d ? await llmAt(n0) : [];
    writeReq(s, msgs, joint);
    const all = allText(msgs);
    check(s, '통합 요청에 gnet·gal 칸', /"gnet":/.test(all) && /"gal":/.test(all), 'gnet+gal', all.slice(0, 300));
    const gn = await board('$gn_raw'); const gal = await board('$gal_raw');
    check(s, '두 게시판 따로 저장', gn.posts.length === 3 && gal.posts.length === 3 && gal.posts[0].nick.startsWith('갤'), '3 / 3', { gn: gn.posts.length, gal: gal.posts.map((p) => p.nick) });
    await saveState(s);
  }
  // B5 응답 실패 갈래: 실패·빈 답·꼴 틀림(재시도 뒤 성공)·posts 빔
  {
    const s = step('새로고침_실패');
    await seeded();
    const before = (await vars()).$gn_raw;
    await queue({ type: 'fail', result: 'boom' });
    await act('gn-refresh', '', 300); await waitIdle();
    let txt = await screen();
    check(s, '모델 실패: 게시판 그대로·알림', (await vars()).$gn_raw === before && /실패|못/.test(txt), '그대로', txt.slice(0, 200));
    await queue('', '');
    let n0 = await llmCount();
    await act('gn-refresh', '', 300); await waitIdle();
    note(s, '빈 답: 호출 수(재시도 포함)', (await llmCount()) - n0);
    txt = await screen();
    check(s, '빈 답: 게시판 그대로', (await vars()).$gn_raw === before, '그대로', txt.slice(0, 200));
    note(s, '빈 답 화면', txt.slice(0, 200));
    await queue('게시판입니다 {"posts": [ 망가짐', REFRESH2(1846003));
    n0 = await llmCount();
    await act('gn-refresh', '', 300); await waitIdle();
    const dn = (await llmCount()) - n0;
    check(s, '꼴 틀린 답 → 다시 묻고 성공(호출 2)', dn === 2 && (await board()).posts.some((p) => p.id === 1846010), 2, dn);
    if (dn === 2) writeReq(s, await llmAt(n0 + 1), REFRESH2(1846003), '■ 다시 묻는 요청\n', '_재시도');
    const before2 = (await vars()).$gn_raw;
    await queue(JSON.stringify({ posts: [], incoming: [] }));
    await act('gn-refresh', '', 300); await waitIdle();
    txt = await screen();
    check(s, 'posts 빈 배열: 게시판 그대로·알림', (await vars()).$gn_raw === before2 && txt.includes('posts 배열에 게시글이 없어서'), '유지 알림', txt.slice(0, 200));
    await saveState(s);
  }
  // B6 댓글 반응 실패 → 내 댓글은 남음
  {
    const s = step('댓글_실패');
    await seeded();
    await act('gn-open', '1846001');
    await page.evaluate(() => { const t = document.querySelector('.gn-composer [data-input="gn-draft"]'); t.value = '나는 국밥'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await queue({ type: 'fail', result: 'boom' });
    await act('gn-send', '', 300); await waitIdle();
    const p = (await board()).posts.find((x) => x.id === 1846001);
    const txt = await screen();
    check(s, '내 댓글은 저장, 알림 「댓글은 저장했어요」', p.comments.length === 1 && p.comments[0].mine && txt.includes('댓글은 저장했어요'), '1 mine', { c: p.comments, txt: txt.slice(0, 200) });
    await saveState(s);
  }
  // B7 쪽지 실패 → 보낸 쪽지 지우고 입력칸에 돌려놓음
  {
    const s = step('쪽지_실패');
    await seeded();
    await act('gn-open', '1846002');
    await act('gn-dm-from', '1846002:0');
    await page.evaluate(() => { const t = [...document.querySelectorAll('[data-input="gn-draft"]')].at(-1); t.value = '손거울 있어요'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await queue('그냥 글', '또 그냥 글');
    const n0 = await llmCount();
    await act('gn-send', '', 300); await waitIdle();
    const st = await board();
    const draft = await page.evaluate(() => [...document.querySelectorAll('[data-input="gn-draft"]')].map((t) => t.value));
    note(s, '호출 수(형식 재시도 포함)', (await llmCount()) - n0);
    check(s, '보낸 쪽지가 지워지고 입력칸에 글이 돌아옴', !st.dms.some((d) => d.side === 'me') && draft.includes('손거울 있어요'), '돌려놓음', { dms: st.dms, draft });
    if ((await llmCount()) - n0 >= 2) writeReq(s, await llmAt(n0 + 1), '또 그냥 글', '■ 다시 묻는 요청\n');
    await saveState(s);
  }
  // B8 늦게 온 답: 기다리는 동안 추천 → 적용 / 기다리는 동안 내 글 지움 → 버림
  {
    const s = step('늦게온답');
    await seeded();
    await hold();
    await act('gn-refresh', '', 300);
    await act('gn-vote', '1846002', 300);
    await release(REFRESH2(1846003));
    await sleep(800); await waitIdle();
    let st = await board();
    check(s, '기다리는 동안 추천만 → 새로고침 결과 적용', st.posts.some((p) => p.id === 1846010), '적용', st.posts.map((p) => p.id));
    // 기다리는 동안 다른 단추(댓글 쓰기)는 막힘
    await hold();
    await act('gn-refresh', '', 300);
    await act('gn-open', '1846010');
    await page.evaluate(() => { const t = document.querySelector('.gn-composer [data-input="gn-draft"]'); if (t) { t.value = '대기 중 댓글'; t.dispatchEvent(new Event('input', { bubbles: true })); } });
    const n0 = await llmCount();
    await act('gn-send', '', 300);
    const txt = await screen();
    note(s, '기다리는 동안 댓글 등록 → 화면', txt.slice(0, 200));
    await release(REFRESH1);
    await sleep(800); await waitIdle();
    st = await board();
    check(s, '기다리는 동안 등록 막힘 → 댓글 저장 안 됨(호출 늘지 않음)', !st.posts.some((p) => p.comments.some((c) => c.body === '대기 중 댓글')), '없음', st.posts.map((p) => p.comments.filter((c) => c.mine)));
    note(s, '두 번째 새로고침 호출 수', (await llmCount()) - n0);
    await saveState(s);
  }
  // B9 연타: 댓글 등록 두 번 → 한 번만 저장
  {
    const s = step('연타');
    await seeded();
    await act('gn-open', '1846001');
    await page.evaluate(() => { const t = document.querySelector('.gn-composer [data-input="gn-draft"]'); t.value = '짬뽕'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await queue(REPLY1, REPLY1);
    await page.evaluate(() => { const b = document.querySelector('.gn-composer [data-action="gn-send"]'); b.click(); b.click(); });
    await sleep(500); await waitIdle();
    const p = (await board()).posts.find((x) => x.id === 1846001);
    check(s, '내 댓글 1개만', p.comments.filter((c) => c.mine).length === 1, 1, p.comments.map((c) => c.body));
    await queue(REFRESH1, REFRESH1);
    const n0 = await llmCount();
    await page.evaluate(() => { const b = document.querySelector('[data-action="br-reload"]') ; b?.click(); b?.click(); });
    await sleep(500); await waitIdle();
    check(s, '새로고침 두 번 눌러도 호출 1', (await llmCount()) - n0 <= 1, '≤1', (await llmCount()) - n0);
    await saveState(s);
  }
  // B10 자동 새로고침 기다리는 동안 응답을 다시 굴림 / 지움 → 결과 버림
  {
    const s = step('자동_기다리는중_다시굴림');
    await seeded({ '$lb_cfg_lb-gn.lazy': '0' });
    await closeWin(page);
    await hold();
    await mainRequest('숙소로 간다.', 'u2');
    await botReply(C2, 'c2', 600);
    await page.evaluate(() => { const m = window.__chat.message; m.pop(); m.push({ role: 'char', data: '다른 응답\n[▣|2025.03.14|11:55 PM|🌙|6°C|관리국|없음|없음|없음|관리국/신입|100000]', chatId: 'c2x' }); });
    await release(REFRESH2(1846003));
    await sleep(1500);
    let st = await board();
    check(s, '응답이 바뀌면 자동 결과를 버림', !st.posts.some((p) => p.id === 1846010), '버림', st.posts.map((p) => p.id));
    // 지우기: 응답 자체를 지움
    await seeded({ '$lb_cfg_lb-gn.lazy': '0' });
    await closeWin(page);
    await hold();
    await mainRequest('숙소로 간다.', 'u2');
    await botReply(C2, 'c2', 600);
    await page.evaluate(() => { window.__chat.message.pop(); });
    await release(REFRESH2(1846003));
    await sleep(1500);
    st = await board();
    check(s, '응답을 지우면 자동 결과를 버림', !st.posts.some((p) => p.id === 1846010), '버림', st.posts.map((p) => p.id));
    await saveState(s);
  }
  // B11 이번 턴 댓글(touch) 다음 응답을 지우면? — 지운 뒤 다음 본편 요청에 그 글이 다시 고정되는지
  {
    const s = step('댓글턴_응답지우기');
    await seeded();
    await act('gn-open', '1846001');
    await page.evaluate(() => { const t = document.querySelector('.gn-composer [data-input="gn-draft"]'); t.value = '국밥'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await queue(REPLY1);
    await act('gn-send', '', 300); await waitIdle();
    await closeWin(page);
    await mainRequest('간다.', 'u2');
    await botReply(C2, 'c2');
    let st = await board();
    note(s, '응답 뒤 touch', st.posts.find((p) => p.id === 1846001)?.touch);
    await page.evaluate(() => { window.__chat.message.splice(-2, 2); });
    st = await board();
    note(s, '응답·유저 지운 뒤 touch (저장 값)', st.posts.find((p) => p.id === 1846001)?.touch);
    await saveState(s);
  }
  // B12 선쪽지 끔
  {
    const s = step('선쪽지끔');
    await seeded({ '$lb_cfg_lb-gn.incoming': '0' });
    await act('gn-open', '1846001');
    await page.evaluate(() => { const t = document.querySelector('.gn-composer [data-input="gn-draft"]'); t.value = '국밥'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await queue(COMMENT1.replace('"parent":3', '"parent":1').replace('"parent":4', '"parent":0'));
    const n0 = await llmCount();
    await act('gn-send', '', 300); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '(선쪽지 든 답)');
    const all = allText(msgs);
    check(s, '요청에 incomingAllowed=false', all.includes('"incomingAllowed":false'), false, /"incomingAllowed":\w+/.exec(all)?.[0]);
    const st = await board();
    check(s, '모델이 선쪽지를 보내도 저장 안 함', !st.dms.length, 0, st.dms);
    await saveState(s);
  }
  // B13 메인 모델 선택
  {
    const s = step('메인모델');
    await seeded({ '$lb_cfg_lb-gn.mode': '1' });
    const n = await llmCount();
    const o = n ? await llmOpt(n - 1) : {};
    check(s, '모델 = 메인(mode model)', o.mode === 'model', 'model', o.mode);
  }
  // B14 다른 채팅에 갔다 오기: 기다리는 동안 채팅을 바꾸면 늦은 답이 원래 채팅에만
  {
    const s = step('기다리는중_다른채팅');
    await seeded();
    const keep = await snap();
    await hold();
    await act('gn-refresh', '', 300);
    // Risu 가 다른 채팅을 보여 주는 흉내: getChatFromIndex 는 같은 자리(0,0)를 돌려주므로 여기서는 창만 닫고 다시 열기
    await closeWin(page); await sleep(200);
    await release(REFRESH2(1846003));
    await sleep(1200);
    const st = await board();
    check(s, '창을 닫아도 결과는 저장됨(「창을 닫아도 계속돼요」)', st.posts.some((p) => p.id === 1846010), '저장', st.posts.map((p) => p.id));
    void keep;
    await saveState(s);
  }
}


if (PARTS.includes('branch2')) {
  part = 'B2_';
  const comment = async (pid, text, reply) => {
    await act('gn-open', String(pid));
    if (!(await page.$('.gn-composer [data-input="gn-draft"]'))) { console.log('DEBUG no composer', String(pid), (await screen()).slice(0, 600)); await act('gn-open', String(pid)); }
    await page.evaluate((t) => { const x = document.querySelector('.gn-composer [data-input="gn-draft"]'); x.value = t; x.dispatchEvent(new Event('input', { bubbles: true })); }, text);
    await queue(reply);
    const n0 = await llmCount();
    await act('gn-send', '', 300); await waitIdle();
    return (await llmCount()) > n0 ? llmAt(n0) : [];
  };
  // 선쪽지 출처가 남의 글의 내 댓글이고 그 글이 새로고침으로 빠지면?
  {
    const s = step('선쪽지출처글_빠짐');
    await seeded();
    await comment(1846001, '국밥', REPLY1);
    await closeWin(page);
    await mainRequest('간다.', 'u2'); await botReply(C2, 'c2');
    await mainRequest('잔다.', 'u3'); await botReply(C3, 'c3');
    await openSite('gn');
    const reply = JSON.stringify({ posts: JSON.parse(REFRESH2(1)).posts.slice(1), incoming: [{ nick: '국밥러', body: '국밥 어디 거 드세요?' }], keyFigures: [] });
    await queue(reply);
    const n0 = await llmCount();
    await act('gn-refresh', '', 300); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, reply);
    const all = allText(msgs);
    const opt = jsonAfter(all, 'COMBINED OUTPUT OPTIONS:');
    check(s, '요청: 선쪽지 허용, 출처 = 1846001 의 내 댓글', opt?.incomingAllowed === true && opt?.incomingOrigin?.comment?.content === '국밥', '허용·국밥', opt);
    const st = await board();
    const txt = await screen();
    check(s, '모델이 쓴 선쪽지가 저장됨', st.dms.some((d) => d.nick === '국밥러'), '국밥러 쪽지', { dms: st.dms, posts: st.posts.map((p) => p.id), note: txt.match(/[^\n]*(쪽지|불러왔)[^\n]*/g) });
    await saveState(s);
  }
  // 스크랩한 남의 글: 새로고침으로 빠지면 보관함 → 댓글 달면 그 턴만 게시판·본편
  {
    const s = step('스크랩_보관함_되살림');
    await seeded();
    await act('gn-scrap', '1846002');
    await queue(JSON.stringify({ posts: JSON.parse(REFRESH2(1)).posts.slice(1), incoming: [], keyFigures: [] }));
    await act('gn-refresh', '', 300); await waitIdle();
    let st = await board();
    check(s, '스크랩 글은 보관함으로', st.archive.some((p) => p.id === 1846002) && !st.posts.some((p) => p.id === 1846002), '보관함', { posts: st.posts.map((p) => p.id), arc: st.archive.map((p) => p.id) });
    let out = await peekMain('간다.');
    check(s, '보관함 글은 본편에 안 들어감', !allText(out).includes('회수물 시세 질문'), '없음', gnetBlocks(out).length);
    await act('gn-cat', '@scrap');
    const msgs = await comment(1846002, '아직 시세 궁금', REPLY1.replace('"parent":0', '"parent":0'));
    writeReq(s, msgs, REPLY1);
    st = await board();
    check(s, '댓글 달면 게시판 맨 앞으로(back 표시)', st.posts[0]?.id === 1846002 && st.posts[0].back !== undefined && st.posts[0].back !== '', 'back', st.posts.map((p) => `${p.id}:${p.back}`));
    await closeWin(page);
    out = await mainRequest('간다.', 'u2');
    check(s, '그 턴 본편엔 들어감', allText(out).includes('회수물 시세 질문'), '있음', gnetBlocks(out).length);
    await botReply(C2, 'c2');
    out = await peekMain('잔다.');
    check(s, '본편 응답 뒤엔 다시 보관함 → 안 들어감', !allText(out).includes('회수물 시세 질문'), '없음', gnetBlocks(out).map((b) => b.slice(0, 80)));
    await saveState(s);
  }
  // 새 댓글 보기 (글 하나 새로고침)
  {
    const s = step('새댓글보기');
    await seeded();
    await act('gn-open', '1846003');
    await queue(JSON.stringify({ comments: [{ author: '지나가던', content: '오늘은 열려 있던데', parent: 0, time: '23:10' }], incoming: [{ nick: 'x', body: 'y' }], activity: [] }));
    const n0 = await llmCount();
    await act('gn-post-refresh', '1846003', 300); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, '(새 댓글 1 + 선쪽지)');
    const all = allText(msgs);
    check(s, '행동 = 시간이 흘러 다른 독자가 옴(ACTION.POST_REFRESH)', all.includes('Time has passed since this post was last viewed'), 'POST_REFRESH', /"action":"[^"]{0,60}/.exec(all)?.[0]);
    check(s, '선쪽지 끔', all.includes('"incomingAllowed":false'), false, /"incomingAllowed":\w+/.exec(all)?.[0]);
    const st = await board();
    check(s, '새 댓글 1 저장, 선쪽지 저장 안 함', st.posts.find((p) => p.id === 1846003).comments.length === 3 && !st.dms.length, 3, st.posts.find((p) => p.id === 1846003).comments.length);
    await saveState(s);
  }
  // 내 댓글 지우기 → 선쪽지 출처 당김
  {
    const s = step('내댓글지우기');
    await seeded();
    await comment(1846003, '첫 댓글', JSON.stringify({ comments: [], incoming: [], activity: [] }));
    await comment(1846003, '둘째 댓글', JSON.stringify({ comments: [], incoming: [], activity: [] }));
    let v = await vars();
    note(s, '출처', v.$gn_incoming_origin);
    await act('gn-del-comment', '1846003:3', 200);
    await act('gn-del-comment', '1846003:3', 400);
    v = await vars();
    const st = await board();
    check(s, '첫 댓글 지움 → 남은 내 댓글 하나, 출처 번호 4→3', st.posts.find((p) => p.id === 1846003).comments.filter((c) => c.mine).map((c) => c.body).join() === '둘째 댓글' && JSON.parse(v.$gn_incoming_origin).comment === 3, 3, { o: v.$gn_incoming_origin, c: st.posts.find((p) => p.id === 1846003).comments.map((c) => c.body) });
    await saveState(s);
  }
  // 다양성 강화: 두 벌 가운데 확률이 낮은 쪽
  {
    const s = step('다양성강화');
    await bootChat(firstChat({ '$lb_cfg_lb-gn.sampling': '1' }));
    await openSite('gn');
    const r1 = JSON.parse(REFRESH1); const r2 = JSON.parse(REFRESH2(1));
    const reply = JSON.stringify({ posts: r1.posts, postsProb: 0.08, alternativePosts: r2.posts.slice(1), alternativeProb: 0.03, incoming: [], keyFigures: [] });
    await queue(reply);
    const n0 = await llmCount();
    await act('gn-refresh', '', 300); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, reply);
    check(s, '요청에 SAMPLING 절·씨앗', allText(msgs).includes('Diversity sampling is ON') && allText(msgs).includes('<x-output-seed-a>'), 'SAMPLING', allText(msgs).includes('Diversity sampling'));
    const st = await board();
    check(s, '확률 낮은 벌(alternative 0.03) 채택', st.posts.some((p) => p.id === 1846010) && !st.posts.some((p) => p.id === 1846003), '1846010', st.posts.map((p) => p.id));
    await saveState(s);
  }
  // 내 댓글 있는 글 「유지」
  {
    const s = step('내댓글글_유지');
    await seeded({ '$lb_cfg_lb-gn.keepreplied': '1' });
    await comment(1846001, '국밥', JSON.stringify({ comments: [], incoming: [], activity: [] }));
    await queue(JSON.stringify({ posts: JSON.parse(REFRESH2(1)).posts.slice(1), incoming: [], keyFigures: [] }));
    const n0 = await llmCount();
    await act('gn-refresh', '', 300); await waitIdle();
    const all = allText(await llmAt(n0));
    check(s, '보호 글 번호에 1846001', all.includes('Protected post IDs: 1846001'), '1846001', /Protected post IDs:[^\n]*/.exec(all)?.[0]);
    const st = await board();
    check(s, '모델이 빼도 1846001 유지', st.posts.some((p) => p.id === 1846001), '유지', st.posts.map((p) => p.id));
    await saveState(s);
  }
}

// ═════════════════════ part phone ═════════════════════
if (PARTS.includes('phone')) {
  part = 'PH_';
  await bootChat(firstChat(), 'phone');
  {
    const s = step('폰_새로고침_댓글');
    await openSite('gn');
    await queue(REFRESH1);
    const n0 = await llmCount();
    await press('.bs [data-action="gn-refresh"]');
    await waitIdle();
    check(s, '폰: 새로고침 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await press('.bs [data-action="gn-open"][data-value="1846003"]');
    const txt = await screen();
    check(s, '폰: 글이 열림', txt.includes('누가 들어갔는지'), '본문', txt.slice(0, 200));
    await typeDraft('나도 봤음');
    await queue(COMMENT1);
    await press('.bs .gn-composer [data-action="gn-send"]');
    await waitIdle();
    const p = (await board()).posts.find((x) => x.id === 1846003);
    check(s, '폰: 댓글·답글 저장', p.comments.length === 5 && p.comments[2].mine, 5, p.comments.length);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(s, '폰: 가로 넘침 없음', !over, false, over);
    await page.screenshot({ path: `${OUT}폰_글.png` });
    await act('gn-sub', 'dm');
    await press('[data-action="gn-open-dm"][data-value="브로커K"]');
    await typeDraft('12까지 봤어요', '.gn-dm-inline ~ * [data-input="gn-draft"], [data-input="gn-draft"]');
    await queue(DM1);
    const n1 = await llmCount();
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-action="gn-send"]')].at(-1); b?.click(); });
    await sleep(500); await waitIdle();
    check(s, '폰: 쪽지 답장 호출 1·저장', (await llmCount()) - n1 === 1 && (await board()).dms.length === 3, 3, (await board()).dms.length);
    await page.screenshot({ path: `${OUT}폰_쪽지.png` });
    await saveState(s);
  }
}

// ═════════════════════ part sites: 괴담갤·세정게·연어 마켓 ═════════════════════
if (PARTS.includes('sites')) {
  part = 'S_';
  await bootChat(firstChat());
  for (const [site, key, name, about] of [['gal', '$gal_raw', '괴담갤', '괴담갤 \\(괴담 갤러리\\)'], ['wpf', '$wpf_raw', '세정게', '세정게|세계정치'], ['sm', '$sm_raw', '연어 마켓', '연어 마켓 \\(salmon-market']]) {
    const s = step(`${name}_새로고침`);
    await openSite(site);
    await queue(REFRESH1);
    const n0 = await llmCount();
    await act('gn-refresh', '', 300); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, REFRESH1);
    const all = allText(msgs);
    check(s, `${name} 지침이 들어감`, new RegExp(about).test(all), about, /About the board\n[^\n]{0,80}/.exec(all)?.[0]);
    check(s, '다른 사이트 글이 섞이지 않음(빈 게시판)', /"posts":\[\]/.test(all), '빈 board', /Current persisted board[^\n]*\n[^\n]{0,80}/.exec(all)?.[0]);
    check(s, '풀리지 않은 자리표·내부 표식 없음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    const st = await board(key);
    check(s, `${key} 에 따로 저장`, st.posts.length === 3, 3, st.posts.length);
    await saveState(s);
  }
  {
    const s = step('연어_팝니다_글');
    await openSite('sm');
    await act('gn-write');
    await act('gn-wtag', '팝니다');
    await page.evaluate(() => { const t = document.querySelector('.gn-cpane [data-input="gn-draft"]'); t.value = '금 간 손거울 팝니다'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    const reply = JSON.stringify({ post: { title: '금 간 손거울 팝니다', content: '직거래만' }, comments: [], incoming: [], activity: [] });
    await queue(reply);
    const n0 = await llmCount();
    await act('gn-send', '', 300); await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, reply);
    const all = allText(msgs);
    check(s, '말머리 [팝니다] 가 입력에 붙고 post.tag 형식은 안 시킴', taskOf(msgs).includes('[팝니다] 금 간 손거울') && !all.includes('Also give post.tag'), '[팝니다]', taskOf(msgs).slice(0, 120));
    const st = await board('$sm_raw');
    check(s, '글 말머리 = 팝니다', st.posts[0]?.tag === '팝니다' && st.posts[0]?.mine, '팝니다', st.posts[0]);
    await saveState(s);
  }
  {
    const s = step('네게시판_본편');
    await closeWin(page);
    const out = await peekMain('지나간다.');
    writeReq(s, out);
    const blocks = gnetBlocks(out);
    const sites = blocks.map((b) => jsonAfter(b, '[MODULE_CONTEXT_BEGIN]')?.site);
    check(s, '본편에 사이트별 덩어리(이름표 다름)', new Set(sites).size === sites.length && sites.length >= 3, '서로 다른 이름', sites);
    const ruleCount = blocks.filter((b) => b.includes('These saved records are reference data')).length;
    note(s, '안내문 붙은 덩어리 수(같은 글이면 하나)', ruleCount);
    await saveState(s);
  }
}

const streamQ = (parts, errorAfter = -1) => page.evaluate(([parts, errorAfter]) => {
  let i = 0; let acc = '';
  const rs = new ReadableStream({ async pull(c) { await new Promise((r) => setTimeout(r, 30)); if (errorAfter >= 0 && i === errorAfter) { c.error(new Error('끊김')); return; } if (i >= parts.length) { c.close(); return; } acc += parts[i++]; c.enqueue({ 0: acc }); } });
  window.__llm = [{ type: 'streaming', result: rs }];
}, [parts, errorAfter]);
const failChat = (mode) => page.evaluate((mode) => {
  if (!window.__realSetChat) window.__realSetChat = window.risuai.setChatToIndex;
  window.__failLog = []; let n = 0;
  window.risuai.setChatToIndex = async (a, b, chat) => { n++; if (window.__failOn) { window.__failLog.push(n); if (mode === 'throw') throw new Error('시험용 저장 실패'); return undefined; } return window.__realSetChat(a, b, chat); };
  window.__failOn = true;
}, mode);
const failOff = () => page.evaluate(() => { window.__failOn = false; });

// ═════════ part fault (3차 더함): 게시판 새로고침 길에서 스트리밍 조각·끊김, 채팅 저장 실패(던짐/조용히), 생각 블록 답 ═════════
if (PARTS.includes('fault')) {
  part = 'FAULT_'; stepNo = 0;
  const posts = async () => ((await page.evaluate(() => window.__chat.scriptstate.$gn_raw || '')).match(/^P/gm) || []).length;
  const refresh = async () => { await openSite('gn'); const n0 = await llmCount(); await act('gn-refresh', '', 300); await waitIdle(20000); return (await llmCount()) - n0; };
  {
    await bootChat(firstChat()); const s = step('스트림_조각');
    await streamQ([REFRESH1.slice(0, 100), REFRESH1.slice(100, 400), REFRESH1.slice(400)]);
    const calls = await refresh();
    check(s, '조각 답으로 글 3개 저장', (await posts()) === 3, 3, { calls, posts: await posts() });
  }
  {
    await bootChat(firstChat()); const s = step('스트림_끊김');
    await streamQ([REFRESH1.slice(0, 100), REFRESH1.slice(100)], 1);
    const calls = await refresh(); const txt = await screen();
    note(s, '화면', txt.slice(0, 300));
    check(s, '반쪽 답은 저장 안 되고 실패 안내', (await posts()) === 0 && /실패|못|다시/.test(txt), '0·안내', { calls, posts: await posts(), txt: txt.slice(0, 200) });
  }
  for (const mode of ['throw', 'silent']) {
    await bootChat(firstChat()); const s = step(`채팅저장_${mode}`);
    await failChat(mode); await queue(REFRESH1);
    const calls = await refresh(); await failOff();
    const txt = await screen();
    note(s, '걸린 저장 호출', await page.evaluate(() => window.__failLog));
    note(s, '화면', txt.slice(0, 400));
    check(s, '저장 못 했으면 글이 있는 것처럼 보이지 않거나 실패 안내', (await posts()) === 0 && (/실패|못|다시/.test(txt) || !txt.includes('중림 지하상가 B구역')), '안내', { calls, shown: txt.includes('중림 지하상가 B구역'), txt: txt.slice(0, 200) });
    await queue(REFRESH1); await refresh();
    check(s, '실패를 끈 뒤 새로고침은 됨', (await posts()) === 3, 3, await posts());
  }
  {
    await bootChat(firstChat()); const s = step('생각블록_답');
    const fakeIn = REFRESH1.replace('중림 지하상가 B구역 또 셔터 내림', '생각속제목');
    await queue(`<think>${fakeIn}</think>\n${REFRESH1}`);
    await refresh();
    const raw = await page.evaluate(() => window.__chat.scriptstate.$gn_raw || '');
    check(s, '생각 블록 밖 답만 저장', raw.includes('중림 지하상가 B구역') && !raw.includes('생각속제목'), '밖만', raw.slice(0, 200));
  }
}

allErrors.push(...(errors ?? []));
writeFileSync(`${OUT}결과-${PARTS.join('+')}.json`, JSON.stringify({ results, notes, pageErrors: allErrors }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과${allErrors.length ? ` · 페이지 오류 ${allErrors.length}: ${allErrors.slice(0, 4).join(' | ')}` : ''}`);
await b.close();
