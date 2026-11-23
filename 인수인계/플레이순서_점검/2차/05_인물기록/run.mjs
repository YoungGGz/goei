// 플레이 순서 점검 2차 · 05 인물 기록 (1차 5_인물기록/run.mjs 를 복사해 갈래를 늘림. 지침: ../../GPT_점검지침_초안.md)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄우고 플레이 순서대로 간다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm, 종류별 가짜 답 줄), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 가짜 답은 종류(Router·Director·갱신기·정리)마다 줄을 따로 둔다. 다른 보조 호출이 끼어도 줄이 밀리지 않게.
// 가짜 답 안의 "@M" 은 그 요청 자료(span)의 마지막 확정 응답 꼬리표로, "@FROM:칸" 은 정리 요청의 그 칸 항목 id 목록으로 바꿔 돌려준다.
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 사용법: (fixture 가 있으면) node 인수인계/플레이순서_점검/2차/05_인물기록/run.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin, openEditor } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 장면 (인물은 카드 로어북 명부 「🙂요원」과 로어북 「성자의 도시」의 도준·대식만) ──
const ST = (time, place) => `[▣|2025.03.14|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|1000]`;
const U1 = '사무실을 둘러본다.';
const C1 = `사무실은 조용했다. 형광등이 낮게 울렸고 책상 위 서류철만 바람에 들썩였다.\n${ST('09:10 PM', '관리국 종합대응팀 사무실')}`;
const U2 = '누가 들어오는지 문 쪽을 본다.';
const C2 = `문이 열리고 에일린이 들어왔다. "신입, 아직 안 갔어?" 에일린이 종이컵 커피를 내밀며 옆자리에 앉았다. 그녀는 오늘 현장 보고서를 대신 써 주겠다고 했다.\n${ST('09:20 PM', '관리국 종합대응팀 사무실')}`;
const U3 = '선배, 이 커피 어디서 났어요?';
// 호칭·흔한 낱말만 나오는 응답: 선배·아저씨·직원·주인·의사·사장님·독사 (이름은 하나도 없음)
const C3 = `선배는 대답 대신 어깨를 으쓱했다. "1층 자판기. 직원 아저씨가 채워 놨더라." 복도에서는 누군가 정육점 주인 이야기를 하고 있었다. 내일 회의 전에 의사를 밝혀 두라는 말도 들렸다. "사장님이 부르신대." 누군가 전화를 받으며 중얼거렸다. 책상 위에는 독사 표본이 든 병이 놓여 있었다.\n${ST('09:31 PM', '관리국 종합대응팀 사무실')}`;
const U4 = '대식이 말했던 지하상가로 간다.';
// 명부 인물(큐라스) + 명부 밖 이름 있는 인물(도준, 로어북 성자의 도시) + 이름 없는 노점 주인
const C4 = `지하상가 입구에서 큐라스가 손을 흔들었다. "후배, 여기야." 옆 노점의 주인이 고개를 숙였다. "어서 오세요." 노점 앞에서 도준이라는 청년이 큐라스에게 길을 물었다. "성당이 어디죠?" 큐라스는 손가락으로 계단 아래를 가리켰다.\n${ST('10:05 PM', '중림 지하상가')}`;
const U5 = '큐라스 선배한테 따뜻한 캔커피를 건넨다.';
const C5 = `Kyuras는 캔커피를 받아 들고 눈을 가늘게 떴다. "고맙다, 후배님. 오늘은 내가 신세 졌네." 선배는 처음으로 말을 놓았다. "이제부터 편하게 말할게."\n${ST('10:12 PM', '중림 지하상가')}`;
const U6 = '큐라스와 함께 계단을 내려간다.';
const C6 = `계단 아래는 눅눅했다. 큐라스가 앞장서서 손전등을 켰다. "여기서부터는 조용히."\n${ST('10:20 PM', '중림 지하상가')}`;
const U7 = '손전등 불빛을 따라 걷는다.';
const C7 = `벽에 낡은 전단지가 붙어 있었다. 큐라스는 전단지를 떼어 주머니에 넣었다. "나중에 보고서에 붙이자."\n${ST('10:31 PM', '중림 지하상가')}`;

/** 갱신기 가짜 답 (지침 「갱신기_간결」 출력 꼴. 빈 목록 기본) */
const U = (o = {}) => JSON.stringify({ entries: [], axes_init: [], observations: [], cues: [], address: [], identity: { faction: null, rank: null }, new_people: [], renames: [], docs: [], present: [], issues: [{ code: 'no_canonical_change', who: null, reason: '점검용' }], ...o });
const ROUTER = (selected, fresh = []) => JSON.stringify({ selected: selected.map((name) => ({ name })), new_characters: fresh });
const DIRECTOR = (notes) => JSON.stringify({ notes });

const results = [];
let stepNo = 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)}`}`);
}
/** DO NOT CHANGE·misread 로 판정된 것: 실제값만 적고 통과/실패로 세지 않는다 */
const notes = [];
function note(s, what, actual, why) { notes.push({ step: `${s.n} ${s.name}`, what, actual, why }); console.log(`NOTE [${s.n} ${s.name}] ${what}: ${JSON.stringify(actual).slice(0, 160)}`); }
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');

const b = await launch();
const chat0 = {
  message: [],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_asset_on: '0', $pp_on: '1', $pp_keep_raw: '1', $st_wallet: JSON.stringify({ start: 1000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) },
};
let { page, errors } = await boot(b, fx, chat0, 'pc', { store: { 'p:goei:user-name': '한서준', 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });

// 보조 호출 가로채기: 종류별 줄, 자리표 바꾸기, 입력 기록 (새로고침 뒤에도 다시 건다)
const installMock = () => page.evaluate(() => {
  window.__q = { router: [], director: [], update: [], tidy: [], other: [] };
  window.__calls.llm = [];
  const kindOf = (msgs) => {
    const s = String(msgs?.[0]?.content ?? '');
    if (s.startsWith('# Router')) return 'router';
    if (s.includes('# Scene Director')) return 'director';
    if (s.startsWith('# People Record Updater')) return 'update';
    if (s.startsWith('You tidy the per-chat record')) return 'tidy';
    return 'other';
  };
  const dataOf = (msgs) => { const t = String(msgs?.[1]?.content ?? ''); try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return {}; } };
  window.risuai.runLLMModel = async (o) => {
    const kind = kindOf(o.messages);
    window.__calls.llm.push({ kind, mode: o.mode, messages: JSON.parse(JSON.stringify(o.messages)) });
    await new Promise((r) => setTimeout(r, 60));
    if (kind === 'update' && window.__gate) await window.__gate.p;
    let next = window.__q[kind].shift();
    if (next === undefined || next === '!FAIL') { window.__calls.llm.at(-1).reply = '(실패로 돌려줌)'; return { type: 'fail', result: 'mock fail' }; }
    const d = dataOf(o.messages);
    const conf = (d.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').map((x) => x.m);
    if (conf.length) next = next.replaceAll('"@M"', JSON.stringify(conf.at(-1)));
    next = next.replace(/"@FROM:([\w.]+)"/g, (_, slot) => JSON.stringify((d.slots?.[slot] ?? []).map((e) => e.id)));
    window.__calls.llm.at(-1).reply = next;
    return { type: 'success', result: next };
  };
});
await installMock();

const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat.goeiPeopleV1 ?? null)));
const people = async () => Object.keys((await st())?.people ?? {}).sort();
const vars = (o) => page.evaluate((o) => { window.__chat.scriptstate = { ...window.__chat.scriptstate, ...o }; }, o);
const queue = (kind, ...t) => page.evaluate(([k, t]) => { window.__q[k].push(...t); }, [kind, t]);
const clearQ = () => page.evaluate(() => { for (const k of Object.keys(window.__q)) window.__q[k] = []; });
const llmN = () => page.evaluate(() => window.__calls.llm.length);
const llmFrom = (n) => page.evaluate((n) => window.__calls.llm.slice(n), n);
const kinds = (calls) => calls.map((c) => c.kind);
const dataOf = (c) => { const t = String(c?.messages?.[1]?.content ?? ''); try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; } };
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const restore = (c) => page.evaluate((c) => { window.__chat = c; }, c);
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ goeiPeopleV1: await st(), messages: await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data.slice(0, 80) }))) }, null, 2));
const writeCalls = (s, calls, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${calls.map((c, i) => `════════ 보조 호출 ${i + 1}: ${c.kind} (${c.mode}) ════════\n${fmtMsgs(c.messages)}\n\n════ 넣은 가짜 답 ════\n${c.reply ?? '(없음: 실패로 돌려줌)'}`).join('\n\n')}\n`);
const appendMain = (s, out, suffix = '_본편') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, fmtMsgs(out));

/** 본편 요청: 유저 메시지를 채팅에 넣고 beforeRequest 를 돌린다 */
const mainRequest = async (userText, uid, push = true) => page.evaluate(async ([t, id, push]) => {
  if (push) window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid, push]);
/** 본편 응답이 붙음 → output 리스너 (인물 갱신은 설정 「병렬」 끔이라 리스너 안에서 끝까지 기다린다) */
const botReply = async (text, cid) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(300); };
const blockOf = (out) => out.filter((m) => m.role === 'system' && m.content.startsWith('[People records]'));
const noteOf = (out) => out.filter((m) => m.role === 'system' && m.content.startsWith('[Director note]'));
/** 진행 창 칸 이름 (host/progwin.ts 의 data-p="c") */
const progCells = () => page.evaluate(() => { const el = document.querySelector('[x-goei-prog]'); if (!el) return null; return [...el.querySelectorAll('[data-p="c"]')].map((c) => c.textContent.trim()); });
/** 호출 흐름 화면의 인물 줄 */
const flowRows = async () => {
  await openWin(page); await sleep(200);
  await openEditor(page, 'manage:flow'); await sleep(600);
  const txt = await page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  await closeEditor(page, true); await closeWin(page);
  const line = (k) => txt.split('\n').map((l, i, a) => (l.includes(k) ? `${l} ${a[i + 1] ?? ''} ${a[i + 2] ?? ''}` : null)).filter(Boolean).join(' / ');
  return { router: line('Router'), director: line('Director'), update: line('갱신'), all: txt };
};
/** 인물 화면 (창 → 기록 → 인물): 실제 단추를 누른다 (상단 「기록」 → 「인물」) */
const openPeople = async () => {
  await openWin(page); await sleep(200);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  for (let i = 0; i < 4 && !(await page.$('[data-action="rec-sub"][data-value="people"]:visible')); i++) {
    if (i === 2) { await closeWin(page); await openWin(page); await sleep(300); }
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true).catch(() => {});
    // PC 는 위 메뉴(nav-tab), 폰은 아래 띠(tab)
    await page.click('[data-action="nav-tab"][data-value="records"]:visible, [data-action="tab"][data-value="records"]:visible', { timeout: 3000 }).catch(() => {}); await sleep(350);
  }
  if (!(await page.$('[data-action="rec-sub"][data-value="people"]:visible'))) await page.screenshot({ path: `${OUT}오류_인물화면.png` });
  await page.click('[data-action="rec-sub"][data-value="people"]', { timeout: 5000 }); await sleep(450);
};
const paneText = () => page.evaluate(() => document.querySelector('.pp-pane')?.innerText ?? document.querySelector('.gx')?.innerText ?? '');
const peopleScreen = async () => {
  await openPeople();
  const txt = await paneText();
  await closeWin(page);
  return txt;
};
const act = async (action, value) => {
  await page.evaluate(({ action, value }) => {
    const el = document.createElement('button');
    el.dataset.action = action;
    if (value !== undefined) el.dataset.value = value;
    el.style.display = 'none';
    (document.querySelector('.pp-pane') || document.querySelector('.gx-panel') || document.body).appendChild(el);
    el.click();
    el.remove();
  }, { action, value });
  await sleep(400);
};

// 본체를 띄운다 (응답 처리기는 본체가 떠 있어야 돈다)
await openWin(page); await sleep(300);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await closeWin(page); await sleep(200);

// ── 01 기록 0명 새 채팅 → 첫 본편 요청 ──
{
  const s = step('0명_첫본편요청');
  const flow = await flowRows();
  writeFileSync(`${OUT}단계${s.n}_${s.name}_호출흐름화면.txt`, flow.all);
  check(s, '호출 흐름 화면: Router 줄이 「호출 없음 (이 채팅에 기록된 인물 없음)」', /Router[\s\S]*기록된 인물 없음/.test(flow.router), '기록된 인물 없음', flow.router);
  check(s, '호출 흐름 화면: Director 줄도 「기록된 인물 없음」', /기록된 인물 없음/.test(flow.director), '기록된 인물 없음', flow.director);
  const n0 = await llmN();
  const out = await mainRequest(U1, 'u1');
  appendMain(s, out);
  const calls = await llmFrom(n0);
  check(s, '보조 호출 0 (Router·Director 안 부름)', calls.length === 0, 0, kinds(calls));
  check(s, '본편에 [People records] 없음', blockOf(out).length === 0, 0, blockOf(out).length);
  const cells = await progCells();
  check(s, '진행 창 칸에 라우터·디렉터 없음, 갱신기 있음', cells && !cells.includes('라우터') && !cells.includes('디렉터') && cells.includes('갱신기'), ['메인', '갱신기'], cells);
  await saveState(s);
}

// ── 02 이름 없는 첫 응답 → 갱신기 1회, 기록 0명 ──
{
  const s = step('첫응답_갱신기');
  await queue('update', U());
  const n0 = await llmN();
  await botReply(C1, 'c1');
  const calls = await llmFrom(n0);
  writeCalls(s, calls);
  const up = calls.filter((c) => c.kind === 'update');
  check(s, '갱신기 1회 (매 턴)', up.length === 1, 1, kinds(calls));
  const d = dataOf(up[0]);
  check(s, '갱신기 자료: 장면 인물 없음, 명부(roster)에 에일린', d && d.people.length === 0 && (d.roster ?? []).some((r) => r.name === '에일린'), { people: [], roster: '에일린 포함' }, d && { people: d.people, roster: (d.roster ?? []).length });
  check(s, '장면 인물이 없으면 호감·축 절을 뺀다(dropNoPeople)', up[0] && !String(up[0].messages[0].content).includes('"axes_init"'), 'axes_init 없음', up[0] && String(up[0].messages[0].content).includes('"axes_init"'));
  const p = await st();
  check(s, '기록 0명, 응답 c1 읽음 표시', Object.keys(p?.people ?? {}).length === 0 && !!p?.read?.c1, { people: 0, read: 'c1' }, p && { people: Object.keys(p.people), read: Object.keys(p.read ?? {}) });
  const scr = await peopleScreen();
  check(s, '인물 화면: 「아직 기록된 인물이 없어요」', scr.includes('아직 기록된 인물이 없어요'), '빈 안내', scr.slice(0, 120));
  await saveState(s);
}

// ── 03 이름 있는 명부 인물 등장(에일린) → 코드가 기록을 만들고 갱신기가 채움 ──
let snapAfterC2;
{
  const s = step('에일린_등장');
  const n0 = await llmN();
  const out = await mainRequest(U2, 'u2');
  appendMain(s, out);
  check(s, '본편 요청 때도 기록 0명 → 보조 호출 0', (await llmN()) === n0, 0, kinds(await llmFrom(n0)));
  await queue('update', U({
    entries: [
      { who: '에일린', slot: 'state', op: 'upsert', replace: null, text: '사무실에서 신입에게 커피를 건넴', target: null, m: '@M', quote: '에일린이 종이컵 커피를 내밀며' },
      { who: '에일린', slot: 'history', op: 'add', replace: null, text: '신입의 현장 보고서를 대신 써 주겠다고 함', target: null, m: '@M', quote: '현장 보고서를 대신 써 주겠다고 했다' },
    ],
    cues: [{ who: '에일린', cue: '작은친절', m: '@M', quote: '종이컵 커피를 내밀며', reason: '커피를 줌' }],
    address: [{ who: '에일린', toUser: '신입', register: '반말', m: '@M', quote: '신입, 아직 안 갔어?' }],
    present: ['에일린'],
  }));
  const n1 = await llmN();
  await botReply(C2, 'c2');
  const calls = await llmFrom(n1);
  writeCalls(s, calls);
  const d = dataOf(calls.find((c) => c.kind === 'update'));
  check(s, '갱신기 자료 people 에 에일린 (코드가 먼저 기록을 만듦)', d?.people?.map((x) => x.name).join() === '에일린', ['에일린'], d?.people?.map((x) => x.name));
  check(s, '자료 roster 에서 에일린 빠짐 (이미 기록됨)', d && !(d.roster ?? []).some((r) => r.name === '에일린'), '없음', d && (d.roster ?? []).filter((r) => r.name === '에일린'));
  const p = await st();
  const e = p?.people?.['에일린'];
  check(s, '기록: 에일린 1명, state·history 항목, 호감 계기 1, 호칭 신입', Object.keys(p.people).join() === '에일린' && e.slots.state?.length === 1 && e.slots.history?.length === 1 && p.log.some((c) => c.who === '에일린' && c.kind === 'cue') && p.log.some((c) => c.kind === 'address' && c.toUser === '신입'), { people: ['에일린'], state: 1, history: 1, cue: 1, address: '신입' }, { people: Object.keys(p.people), state: e?.slots?.state?.length, history: e?.slots?.history?.length, log: p.log.map((c) => `${c.who}:${c.kind}:${c.cue ?? c.toUser ?? ''}`) });
  check(s, '장면 인물(present) 기록', JSON.stringify(p.scene?.c2) === '["에일린"]', ['에일린'], p.scene);
  const scr = await peopleScreen();
  check(s, '인물 화면: 에일린 1명', scr.includes('에일린') && /1명/.test(scr), '에일린 · 1명', scr.slice(0, 200));
  await saveState(s);
  snapAfterC2 = await snap();
}

// ── 04 호칭만 나오는 턴: Router·Director 가 돌고, 호칭으로는 기록이 안 생김 ──
{
  const s = step('호칭만_턴');
  const flow = await flowRows();
  check(s, '호출 흐름 화면: 기록 1명 → Router 「보조 1회」', /Router[\s\S]*1회/.test(flow.router) && !/기록된 인물 없음/.test(flow.router), '1회', flow.router);
  await queue('router', ROUTER(['에일린']));
  await queue('director', DIRECTOR([{ who: '에일린', now: 'Friendly senior; just gave the newcomer coffee and offered to write the report.', must_not_reveal: [], uncertain: [] }]));
  const n0 = await llmN();
  const out = await mainRequest(U3, 'u3');
  appendMain(s, out);
  const calls = await llmFrom(n0);
  writeCalls(s, calls, '', '_Router_Director');
  check(s, '보조 호출 순서: Router → Director', kinds(calls).join() === 'router,director', ['router', 'director'], kinds(calls));
  const rd = dataOf(calls[0]);
  check(s, 'Router 자료: catalog 에 에일린(별칭·호칭 포함), input 이 이번 말', rd?.catalog?.map((c) => c.name).join() === '에일린' && rd.input === U3 && (rd.catalog[0].titles ?? []).includes('선배'), { catalog: ['에일린'], input: U3 }, rd && { catalog: rd.catalog, input: rd.input });
  const dd = dataOf(calls[1]);
  check(s, 'Director 자료: people 에 에일린 기록(호칭 신입·state)', dd?.people?.[0]?.name === '에일린' && dd.people[0].address?.toUser === '신입' && /커피/.test(dd.people[0].record ?? ''), '에일린 기록', dd?.people?.[0] && { address: dd.people[0].address, record: String(dd.people[0].record).slice(0, 200) });
  const blk = blockOf(out);
  const nt = noteOf(out);
  check(s, '본편: [People records] 한 번, 에일린, 호칭 신입', blk.length === 1 && blk[0].content.includes('에일린') && blk[0].content.includes('신입'), 1, blk.map((x) => x.content.slice(0, 300)));
  check(s, '본편: [Director note] 한 번', nt.length === 1 && nt[0].content.includes('Friendly senior'), 1, nt.map((x) => x.content.slice(0, 200)));
  const lastUser = out.map((m) => m.role).lastIndexOf('user');
  check(s, '두 블록 모두 마지막 유저 메시지 앞', out.findIndex((m) => m.content.startsWith('[People records]')) < lastUser && out.findIndex((m) => m.content.startsWith('[Director note]')) < lastUser, '앞', lastUser);
  const cells = await progCells();
  check(s, '진행 창 칸: 라우터·디렉터·메인·갱신기', cells && ['라우터', '디렉터', '갱신기'].every((x) => cells.includes(x)), ['라우터', '디렉터', '메인', '갱신기'], cells);
  // 응답: 호칭·흔한 낱말만
  await queue('update', U({ entries: [{ who: '에일린', slot: 'history', op: 'add', replace: null, text: '커피를 1층 자판기에서 가져왔다고 함', target: null, m: '@M', quote: '1층 자판기' }], present: ['에일린'] }));
  const n1 = await llmN();
  await botReply(C3, 'c3');
  const calls2 = await llmFrom(n1);
  writeCalls(s, calls2, '', '_갱신기');
  const p = await st();
  check(s, '호칭·흔한 낱말(선배·직원·아저씨·주인·의사·사장님·독사)로 새 기록이 생기지 않음 (11-22 사용자)', Object.keys(p.people).join() === '에일린', ['에일린'], Object.keys(p.people));
  const d = dataOf(calls2.find((c) => c.kind === 'update'));
  check(s, '갱신기 자료 people: 에일린만 (호칭으로 엉뚱한 인물을 장면에 넣지 않음)', d?.people?.map((x) => x.name).join() === '에일린', ['에일린'], d?.people?.map((x) => x.name));
  await saveState(s);
}
const snapAfterC3 = await snap();

// ── 05 갈래: 「큐라스 선배」처럼 다른 사람을 가리키는 호칭 → 기록된 에일린이 본편 장면 인물로 들어가나 ──
{
  const s = step('갈래_다른사람의_호칭');
  const c = JSON.parse(JSON.stringify(snapAfterC2));
  c.message.push({ role: 'user', data: '복도로 나간다.', chatId: 'xu3' }, { role: 'char', data: `복도 끝에서 큐라스 선배가 손을 흔들었다. 다른 사람은 없었다.\n${ST('09:31 PM', '관리국 복도')}`, chatId: 'xc3' });
  await restore(c);
  await queue('router', ROUTER([]));
  await queue('director', DIRECTOR([]));
  const n0 = await llmN();
  const out = await mainRequest('큐라스 쪽으로 걸어간다.', 'xu4');
  appendMain(s, out);
  writeCalls(s, await llmFrom(n0));
  const blk = blockOf(out)[0]?.content ?? '';
  note(s, '「큐라스 선배」 글에서 에일린이 본편 인물 글에 들어가나 (재검토 문제2 misread, DO NOT CHANGE)', blk.includes('에일린'), '재검토.md 5. 문제2');
  await clearQ();
  await restore(snapAfterC3);
}

// ── 06 갈래: 모델이 호칭을 이름처럼, 글에 없는 이름을 새 인물로 돌려줌 → 받지 않아야 ──
{
  const s = step('갈래_잘못된_새인물');
  const base = await snap();
  await mainRequest(U4, 'u4');
  await clearQ();
  await queue('update', U({ new_people: [
    { name: '주인', aliases: [], m: '@M', quote: '옆 노점의 주인이 고개를 숙였다', identity: '노점 주인', speech: null },
    { name: '김철수', aliases: [], m: '@M', quote: '노점 앞에서 도준이라는 청년이', identity: '청년', speech: null, provisional: false },
  ] }));
  const n0 = await llmN();
  await botReply(C4, 'c4');
  writeCalls(s, (await llmFrom(n0)).filter((c) => c.kind === 'update'));
  const p = await st();
  note(s, 'provisional 없이 온 「주인」 기록 (재검토 문제3a misread, DO NOT CHANGE)', !!p.people['주인'], '재검토.md 5. 문제3a');
  check(s, '글에 없는 이름 「김철수」로 기록을 만들지 않음', !p.people['김철수'], '김철수 없음', Object.keys(p.people), '지침: Never coin a name');
  await saveState(s);
  await restore(base);
}

// ── 07 명부 인물(큐라스)·명부 밖 이름 있는 인물(도준)·이름 없는 노점 주인 ──
let snapBeforeC4;
{
  const s = step('명부_명부밖_이름없는');
  await queue('router', ROUTER(['에일린'], [{ name: '대식', aliases: [], quote: '대식이 말했던' }]));
  await queue('director', DIRECTOR([{ who: '에일린', now: 'Back at the office.', must_not_reveal: [] }]));
  const n0 = await llmN();
  const out = await mainRequest(U4, 'u4');
  appendMain(s, out);
  writeCalls(s, await llmFrom(n0), '', '_Router_Director');
  snapBeforeC4 = await snap();
  await queue('update', U({
    new_people: [{ name: '도준', aliases: [], m: '@M', quote: '도준이라는 청년이 큐라스에게 길을 물었다', identity: '성당을 찾는 청년', speech: '존댓말' , provisional: false }],
    entries: [
      { who: '큐라스', slot: 'state', op: 'upsert', replace: null, text: '지하상가 입구에서 신입을 기다림', target: null, m: '@M', quote: '지하상가 입구에서 큐라스가 손을 흔들었다' },
      { who: '도준', slot: 'state', op: 'upsert', replace: null, text: '성당 가는 길을 물음', target: null, m: '@M', quote: '성당이 어디죠?' },
    ],
    present: ['큐라스', '도준'],
  }));
  const n1 = await llmN();
  await botReply(C4, 'c4');
  const calls = (await llmFrom(n1)).filter((c) => c.kind === 'update');
  writeCalls(s, calls, '', '_갱신기');
  const d = dataOf(calls[0]);
  check(s, '갱신기 자료 name_hints 에 Router 가 본 대식 (앞 단계 결과가 다음 요청에)', (d?.name_hints ?? []).some((h) => h.name === '대식'), '대식', d?.name_hints);
  check(s, '갱신기 자료 people 에 큐라스 (명부 이름이 글에 나와 코드가 기록을 만듦)', d?.people?.some((x) => x.name === '큐라스'), '큐라스', d?.people?.map((x) => x.name));
  const p = await st();
  // 04 단계의 사장·백사헌(문제 1)은 여기서 따지지 않는다
  check(s, '기록: 큐라스·도준이 생기고, 노점 주인·마덕희(호칭 「주인」)는 없음', p.people['큐라스'] && p.people['도준'] && !p.people['마덕희'] && !p.people['주인'] && !Object.keys(p.people).some((n) => n.includes('주인')), { 생김: ['큐라스', '도준'], 없음: ['마덕희', '주인'] }, Object.keys(p.people).sort());
  check(s, '큐라스 기록에 명부 영문 표기(Kyuras)가 별칭으로', p.people['큐라스']?.aliases?.includes('Kyuras'), 'Kyuras', p.people['큐라스']?.aliases);
  check(s, '도준: 명부 밖 인물, provisional 아님, 소속 없음', p.people['도준'] && !p.people['도준'].provisional && !p.people['도준'].faction, { provisional: false, faction: '' }, p.people['도준'] && { provisional: p.people['도준'].provisional, faction: p.people['도준'].faction });
  const scr = await peopleScreen();
  check(s, '인물 화면: 저장 상태와 같은 인원·이름', scr.includes(`${Object.keys(p.people).length}명`) && Object.keys(p.people).every((n) => scr.includes(n)), `${Object.keys(p.people).length}명`, scr.slice(0, 300));
  await saveState(s);
}

// ── 08 같은 인물을 별칭(Kyuras)·호칭(선배)으로: 같은 기록에 붙나, 호감·호칭 변화 ──
{
  const s = step('별칭_호칭_같은인물');
  await queue('router', ROUTER(['Kyuras']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'Waiting at the stairs.', must_not_reveal: [] }]));
  const n0 = await llmN();
  const out = await mainRequest(U5, 'u5');
  appendMain(s, out);
  const calls = await llmFrom(n0);
  writeCalls(s, calls, '', '_Router_Director');
  const blk = blockOf(out)[0]?.content ?? '';
  check(s, 'Router 가 별칭 Kyuras 로 답해도 큐라스로 받음 → 본편 블록에 큐라스', blk.includes('큐라스'), '큐라스', blk.slice(0, 200));
  await queue('update', U({
    entries: [
      { who: 'Kyuras', slot: 'relationship', op: 'upsert', replace: null, text: '신입을 후배님이라 부르며 말을 놓기 시작함', target: '@user', m: '@M', quote: '이제부터 편하게 말할게' },
      { who: '선배', slot: 'state', op: 'upsert', replace: null, text: '캔커피를 받음', target: null, m: '@M', quote: '캔커피를 받아 들고' },
    ],
    cues: [{ who: '큐라스', cue: '큰도움', m: '@M', quote: '오늘은 내가 신세 졌네', reason: '캔커피' }],
    address: [{ who: '큐라스', toUser: '후배님', register: '반말', m: '@M', quote: '이제부터 편하게 말할게' }],
    present: ['큐라스'],
  }));
  const n1 = await llmN();
  await botReply(C5, 'c5');
  writeCalls(s, (await llmFrom(n1)).filter((c) => c.kind === 'update'), '', '_갱신기');
  const p = await st();
  const k = p.people['큐라스'];
  check(s, '별칭 Kyuras 로 온 항목이 큐라스에 붙음', (k?.slots?.relationship ?? []).some((e) => e.text.includes('후배님')), 'relationship 1', k?.slots?.relationship);
  check(s, '여러 사람이 쓰는 호칭 「선배」로 온 항목은 버림', !(k?.slots?.state ?? []).some((e) => e.text === '캔커피를 받음') && !(p.people['에일린']?.slots?.state ?? []).some((e) => e.text === '캔커피를 받음'), '버림', { 큐라스: k?.slots?.state?.map((e) => e.text) });
  check(s, '호감 계기·호칭 변경이 변경 기록에', p.log.some((c) => c.who === '큐라스' && c.cue === '큰도움') && p.log.some((c) => c.who === '큐라스' && c.kind === 'address' && c.toUser === '후배님'), '큰도움·후배님', p.log.filter((c) => c.who === '큐라스').map((c) => `${c.kind}:${c.cue ?? c.toUser ?? ''}`));
  await saveState(s);
}

// ── 09 다음 턴 본편: 호칭·관계 변화가 인물 글에 ──
let snapAfterC5;
{
  const s = step('다음턴_변화반영');
  snapAfterC5 = await snap();
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'Now speaks casually to the newcomer.', must_not_reveal: [] }]));
  const n0 = await llmN();
  const out = await mainRequest(U6, 'u6');
  appendMain(s, out);
  writeCalls(s, await llmFrom(n0));
  const blk = blockOf(out)[0]?.content ?? '';
  const kBlock = blk.slice(blk.indexOf('큐라스'));
  check(s, '큐라스 블록에 새 호칭 「후배님」·반말', /후배님/.test(kBlock) && /informal|반말|banmal/i.test(kBlock), '후배님 · 반말', kBlock.slice(0, 400));
  check(s, '큐라스 블록에 관계 항목', kBlock.includes('말을 놓기 시작함'), '관계 항목', kBlock.slice(0, 400));
  check(s, '본편 블록·Director 메모 각 한 번', blockOf(out).length === 1 && noteOf(out).length === 1, [1, 1], [blockOf(out).length, noteOf(out).length]);
  check(s, '오래 안 나온 도준은 본편 블록에 없음 (글에 이름 없음)', !blk.includes('도준'), '도준 없음', blk.includes('도준'));
  const scr = await peopleScreen();
  const line = scr.split('\n').slice(scr.split('\n').findIndex((l) => l.startsWith('큐라스')), scr.split('\n').findIndex((l) => l.startsWith('큐라스')) + 3).join(' ');
  check(s, '인물 화면(다시 열기): 큐라스 「후배님」 · 반말 (변경 기록에서 계산)', line.includes('후배님') && line.includes('반말'), '「후배님」 · 반말', line);
  await saveState(s);
}

// ── 10 Director 설정 갈래: 사실형 → 연출형 → 끔 (같은 입력) ──
{
  const s = step('갈래_Director_설정');
  const c = await snap();
  // 같은 채팅·같은 입력으로 다시 조립 (본편 다시 보내기)
  await vars({ $pp_director: 'scene' });
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'Casual now.', react: 'Likely to tease the newcomer lightly.', must_not_reveal: [] }]));
  let n0 = await llmN();
  let out = await mainRequest(U6, 'u6', false);
  let calls = await llmFrom(n0);
  writeCalls(s, calls, '■ 연출형(scene) 으로 바꾸고 같은 입력\n', '_연출형');
  check(s, '연출형으로 바꾸면 Director 를 다시 부르고 react 절이 지침에 들어감', calls.some((x) => x.kind === 'director' && String(x.messages[0].content).includes('You may add `react`')), 'Director 1회 (react 절)', kinds(calls), '설정 갈래 E: 설정이 바뀌면 요청 글도 바뀌어야');
  check(s, '본편 메모에 react(Likely reaction)', noteOf(out)[0]?.content?.includes('Likely reaction') ?? false, 'Likely reaction', noteOf(out)[0]?.content?.slice(0, 300) ?? '(메모 없음)');
  await clearQ();
  await vars({ $pp_director: 'off' });
  await queue('router', ROUTER(['큐라스']));
  n0 = await llmN();
  out = await mainRequest(U6, 'u6', false);
  calls = await llmFrom(n0);
  check(s, 'Director 끔: Director 호출 없음, 메모 없음, 인물 블록은 있음', !calls.some((x) => x.kind === 'director') && noteOf(out).length === 0 && blockOf(out).length === 1, { director: 0, note: 0, block: 1 }, { calls: kinds(calls), note: noteOf(out).length, block: blockOf(out).length });
  const cells = await progCells();
  check(s, 'Director 끔: 진행 창에 디렉터 칸 없음', cells && !cells.includes('디렉터'), '디렉터 없음', cells);
  await vars({ $pp_director: 'facts' });
  await clearQ();
  await restore(c);
}

// ── 11 수동 갱신, 한 번에 읽는 응답 수 ──
{
  const s = step('수동갱신_묶음');
  await vars({ $pp_when: 'manual', $pp_batch_turns: '1' });
  let n0 = await llmN();
  await botReply(C6, 'c6');
  check(s, '수동: 응답이 와도 갱신기 안 부름', !(await llmFrom(n0)).some((c) => c.kind === 'update'), 0, kinds(await llmFrom(n0)));
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'x', must_not_reveal: [] }]));
  await mainRequest(U7, 'u7');
  const cells = await progCells();
  check(s, '수동: 진행 창에 갱신기 칸 없음', cells && !cells.includes('갱신기'), '갱신기 없음', cells);
  await clearQ();
  await botReply(C7, 'c7');
  const flow = await flowRows();
  check(s, '호출 흐름 화면: 인물 갱신 「수동」', /수동/.test(flow.update), '수동', flow.update);
  await queue('update', U({ entries: [{ who: '큐라스', slot: 'history', op: 'add', replace: null, text: '손전등을 켜고 앞장섬', target: null, m: '@M', quote: '손전등을 켰다' }], present: ['큐라스'] }), U({ entries: [{ who: '큐라스', slot: 'history', op: 'add', replace: null, text: '전단지를 떼어 챙김', target: null, m: '@M', quote: '전단지를 떼어 주머니에 넣었다' }], present: ['큐라스'] }));
  n0 = await llmN();
  await openPeople();
  await page.click('[data-action="pp-update"]'); await sleep(300);
  await page.waitForFunction(() => !document.querySelector('.pp-upst.busy'), null, { timeout: 15000 }).catch(() => {});
  await sleep(800);
  await closeWin(page);
  const calls = (await llmFrom(n0)).filter((c) => c.kind === 'update');
  writeCalls(s, calls);
  check(s, '「새 응답 읽기」: 묶음 1 → 안 읽은 응답 2개를 2회로', calls.length === 2, 2, calls.length);
  const conf = calls.map((c) => (dataOf(c)?.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').length);
  check(s, '묶음마다 확정 응답 1개', conf.every((n) => n === 1), [1, 1], conf);
  const p = await st();
  check(s, '두 응답 모두 읽음, 두 항목 반영', !!p.read.c6 && !!p.read.c7 && ['손전등을 켜고 앞장섬', '전단지를 떼어 챙김'].every((t) => (p.people['큐라스'].slots.history ?? []).some((e) => e.text === t)), '둘 다', { read: Object.keys(p.read), history: (p.people['큐라스'].slots.history ?? []).map((e) => e.text) });
  await vars({ $pp_when: 'turn', $pp_batch_turns: '6' });
  await saveState(s);
}

// ── 12 정리(consolidate): 인물 화면 「정리」 → 정리 호출 → 항목 수 줄어듦 ──
{
  const s = step('정리');
  // 고친 뒤(5b47f11, 리드 결정·사용자 11-22 22:22): 정리는 다시 굴릴 수 있는 마지막 응답(c7)의 줄만 빼고 앞의 줄을 합친다 → 가짜 답도 c6 줄만 다룬다
  await queue('tidy', JSON.stringify({ slots: { history: [{ text: '지하상가에서 손전등을 켜고 앞장섬', from: '@FROM:history' }] } }));
  const n0 = await llmN();
  await openPeople();
  await page.click('[data-action="rec-person"][data-value="큐라스"]'); await sleep(400);
  if (await page.$('[data-action="pp-tidy"][data-value="큐라스"]')) await page.click('[data-action="pp-tidy"][data-value="큐라스"]'); else await act('pp-tidy', '큐라스');
  await sleep(1200);
  await closeWin(page);
  const calls = (await llmFrom(n0)).filter((c) => c.kind === 'tidy');
  writeCalls(s, calls);
  const d = dataOf(calls[0]);
  const sent = (d?.slots?.history ?? []).map((e) => e.text);
  check(s, '정리 호출 1회, history 는 마지막 응답(c7 전단지) 줄을 빼고 보냄', calls.length === 1 && sent.length === 1 && !sent.some((t) => t.includes('전단지')), ['손전등을 켜고 앞장섬'], calls.length && sent);
  const p = await st();
  const live = (p.people['큐라스'].slots.history ?? []).filter((e) => !e.folded && !e.void);
  check(s, '정리 뒤 마지막 응답(c7)의 줄은 c7 에 묶인 채 남고, 합친 줄(#0)에 전단지가 안 들어감', live.some((e) => e.anchor === 'c7' && e.text.includes('전단지')) && !live.some((e) => e.anchor === '#0' && e.text.includes('전단지')), 'c7:전단지 그대로', live.map((e) => `${e.anchor}:${e.text}`));
  await saveState(s);
}
const snapAfterTidy = await snap();

// ── 13 다시 굴리기: 큐라스·도준을 만든 응답(c4)을 다시 굴림 → 그 응답이 만든 기록이 되돌아가나 ──
{
  const s = step('다시굴리기_c4');
  await restore(snapBeforeC4);
  // c4 를 받고 처리한 상태로 맞춘다 (07 단계 그대로)
  await queue('update', U({ new_people: [{ name: '도준', aliases: [], m: '@M', quote: '도준이라는 청년이 큐라스에게 길을 물었다', identity: '성당을 찾는 청년', speech: null, provisional: false }], entries: [{ who: '큐라스', slot: 'state', op: 'upsert', replace: null, text: '지하상가 입구에서 신입을 기다림', target: null, m: '@M', quote: '지하상가 입구에서 큐라스가 손을 흔들었다' }], present: ['큐라스', '도준'] }));
  await botReply(C4, 'c4');
  const before = await people();
  // 다시 굴리기: 같은 자리 응답이 새 chatId 로 바뀐다 (Risu)
  const C4b = `지하상가 입구는 비어 있었다. 셔터가 반쯤 내려간 가게들만 줄지어 있었다.\n${ST('10:05 PM', '중림 지하상가')}`;
  await page.evaluate((t) => { const m = window.__chat.message; m[m.length - 1] = { role: 'char', data: t, chatId: 'c4b' }; }, C4b);
  await queue('update', U({ present: [] }));
  const n0 = await llmN();
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); });
  await sleep(400);
  writeCalls(s, (await llmFrom(n0)).filter((c) => c.kind === 'update'));
  const p = await st();
  check(s, '다시 굴리기 전 기록에 큐라스·도준 (c4 가 만듦)', before.includes('도준') && before.includes('큐라스'), ['큐라스', '도준'], before);
  check(s, '다시 굴린 뒤 c4 가 만든 큐라스·도준 기록이 사라짐', !p.people['도준'] && !p.people['큐라스'], '큐라스·도준 없음', Object.keys(p.people).sort(), '점검 지침 D: 인물 기록 변화(되돌아감)');
  const scr = await peopleScreen();
  check(s, '인물 화면에 도준이 안 보임', !scr.includes('도준'), '도준 없음', scr.slice(0, 300));
  // 다음 본편: 다시 굴린 응답만 보고도 Router 명단에 도준이 남나
  await queue('router', ROUTER([]));
  await queue('director', DIRECTOR([]));
  const n1 = await llmN();
  const out = await mainRequest('주위를 둘러본다.', 'u5b');
  const calls = await llmFrom(n1);
  writeCalls(s, calls, '', '_다음본편');
  appendMain(s, out, '_다음본편_본편');
  const rd = dataOf(calls.find((c) => c.kind === 'router'));
  check(s, '다음 Router 명단에 도준 없음', rd && !rd.catalog.some((c) => c.name === '도준'), '도준 없음', rd?.catalog?.map((c) => c.name));
  check(s, '다시 굴린 응답(c4)의 항목은 다음 본편 인물 글에 없음 (근거 응답이 사라져 죽은 줄)', !out.some((m) => m.content.includes('지하상가 입구에서 신입을 기다림')), '없음', out.some((m) => m.content.includes('지하상가 입구에서 신입을 기다림')));
  await saveState(s);
}

// ── 14 응답 지우기: 호칭·호감을 바꾼 응답(c5)을 지움 → 다음 본편 인물 글에서 되돌아가나 ──
{
  const s = step('응답지우기_c5');
  const c = JSON.parse(JSON.stringify(snapAfterC5));
  c.message.pop(); // c5 지움
  c.message.pop(); // u5 도 지움 (Risu 에서 한 쌍 지우기)
  await restore(c);
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'x', must_not_reveal: [] }]));
  const out = await mainRequest('큐라스에게 인사한다.', 'u5c');
  appendMain(s, out);
  const blk = blockOf(out)[0]?.content ?? '';
  const kBlock = blk.slice(blk.indexOf('큐라스'));
  check(s, '지운 응답의 호칭(후배님)·관계 항목이 본편 인물 글에서 빠짐', !kBlock.includes('후배님') && !kBlock.includes('말을 놓기 시작함'), '빠짐', kBlock.slice(0, 400));
  const scr = await peopleScreen();
  const line = scr.split('\n').slice(scr.split('\n').findIndex((l) => l.startsWith('큐라스')), scr.split('\n').findIndex((l) => l.startsWith('큐라스')) + 3).join(' ');
  check(s, '인물 화면(다시 열기)도 큐라스 호칭이 「신입」으로 돌아감', !line.includes('후배님'), '후배님 없음', line);
  await saveState(s);
}

// ── 15 정리한 뒤 다시 굴리기: 정리로 합친 줄이 다시 굴린 응답(c7)의 내용을 계속 품나 ──
{
  const s = step('정리뒤_다시굴리기_c7');
  const c = JSON.parse(JSON.stringify(snapAfterTidy));
  const i = c.message.findIndex((m) => m.chatId === 'c7');
  c.message[i] = { role: 'char', data: `벽은 비어 있었다. 큐라스는 말없이 걸었다.\n${ST('10:31 PM', '중림 지하상가')}`, chatId: 'c7b' };
  await restore(c);
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'x', must_not_reveal: [] }]));
  const out = await mainRequest('계속 걷는다.', 'u8');
  appendMain(s, out);
  const blk = blockOf(out)[0]?.content ?? '';
  check(s, '다시 굴려 사라진 「전단지」 내용이 본편 인물 글에 안 남음', !blk.includes('전단지'), '전단지 없음', blk.slice(blk.indexOf('큐라스'), blk.indexOf('큐라스') + 500), '점검 지침 D');
  await saveState(s);
}

// ════════════════════════════ 2차에서 늘린 갈래 ════════════════════════════
const routerOf = (calls) => dataOf(calls.find((c) => c.kind === 'router'));
const catNames = (rd) => rd?.catalog?.map((c) => c.name) ?? null;
const listen = () => page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); });
const replaceLast = (t, id) => page.evaluate(([t, id]) => { const m = window.__chat.message; m[m.length - 1] = { role: 'char', data: t, chatId: id }; }, [t, id]);
const UPD_C4 = () => U({
  new_people: [{ name: '도준', aliases: [], m: '@M', quote: '도준이라는 청년이 큐라스에게 길을 물었다', identity: '성당을 찾는 청년', speech: null, provisional: false }],
  entries: [{ who: '큐라스', slot: 'state', op: 'upsert', replace: null, text: '지하상가 입구에서 신입을 기다림', target: null, m: '@M', quote: '지하상가 입구에서 큐라스가 손을 흔들었다' }],
  present: ['큐라스', '도준'],
});
const C4b = `지하상가 입구는 비어 있었다. 셔터가 반쯤 내려간 가게들만 줄지어 있었다.\n${ST('10:05 PM', '중림 지하상가')}`;

// ── 16 다시 굴리기 요청: 응답을 빼고 다시 보내는 요청에 사라진 응답이 만든 인물이 실리나 ──
let snapAfterC4;
{
  const s = step('다시굴리기_요청에_사라진응답의_인물');
  await clearQ();
  await restore(snapBeforeC4);
  await queue('update', UPD_C4());
  await botReply(C4, 'c4');
  snapAfterC4 = await snap();
  const before = await people();
  // Risu 다시 굴리기: 마지막 응답을 빼고 같은 입력으로 요청한다. 갱신기는 새 응답이 붙은 뒤에야 돈다
  await page.evaluate(() => { window.__chat.message.pop(); });
  const scr = await peopleScreen();
  // Router 가 (사라진 응답에서 본) 도준을 고른 경우
  await queue('router', ROUTER(['도준']));
  await queue('director', DIRECTOR([]));
  const n0 = await llmN();
  const out = await mainRequest(U4, 'u4', false);
  const calls = await llmFrom(n0);
  writeCalls(s, calls);
  appendMain(s, out);
  const rd = routerOf(calls);
  check(s, '다시 굴리기 전: c4 가 큐라스·도준 기록을 만듦', before.includes('큐라스') && before.includes('도준'), ['큐라스', '도준'], before);
  check(s, '다시 굴리는 요청의 Router 명단(catalog)에 사라진 c4 에서만 나온 큐라스·도준이 없음', rd && !catNames(rd).some((n) => ['큐라스', '도준'].includes(n)), '없음', catNames(rd), '사용자 11-14 F-1 (나) 「사라진 응답이 만든 변경은 버린다」, store.ts dropGonePeople 주석 「그 응답이 다시 굴려져 사라지면 기록도 같이 없앤다」');
  check(s, '응답을 뺀 뒤 연 인물 화면에 도준이 안 보임', !scr.includes('도준'), '도준 없음', scr.slice(0, 200));
  const blk16 = blockOf(out)[0]?.content ?? '';
  check(s, '다시 굴리는 요청의 본편 인물 글에 사라진 응답에서만 나온 도준 기록이 안 들어감', !blk16.includes('## 도준'), '도준 없음', blk16.includes('## 도준') ? blk16.slice(blk16.indexOf('## 도준'), blk16.indexOf('## 도준') + 160) : '(없음)', 'F-1 (나)');
  await saveState(s);
}

// ── 17 응답 지우기(한 쌍) → 다음 턴: 다음 응답의 갱신이 저장되기 전까지 남나 ──
{
  const s = step('응답지우기_c4_다음턴');
  await clearQ();
  await restore(snapAfterC4);
  await page.evaluate(() => { window.__chat.message.pop(); window.__chat.message.pop(); });
  const scr = await peopleScreen();
  await queue('router', ROUTER([]));
  await queue('director', DIRECTOR([]));
  const n0 = await llmN();
  const out = await mainRequest('사무실로 돌아간다.', 'u4x');
  const calls = await llmFrom(n0);
  writeCalls(s, calls, '', '_다음본편');
  appendMain(s, out);
  const rd = routerOf(calls);
  check(s, '지운 뒤 인물 화면에 도준이 안 보임', !scr.includes('도준'), '도준 없음', scr.slice(0, 200), 'F-1 (나)');
  check(s, '지운 뒤 다음 본편의 Router 명단에 도준·큐라스 없음', rd && !catNames(rd).some((n) => ['큐라스', '도준'].includes(n)), '없음', catNames(rd), 'F-1 (나)');
  await queue('update', U({ present: ['에일린'] }));
  await botReply(`사무실은 조용했다. 에일린이 서류를 넘겼다.\n${ST('10:40 PM', '관리국 종합대응팀 사무실')}`, 'c4x');
  const p = await st();
  check(s, '다음 응답의 갱신이 저장된 뒤에는 도준·큐라스 기록이 없어짐 (1차 문제4 고침 유지)', !p.people['도준'] && !p.people['큐라스'], '없음', Object.keys(p.people));
  await saveState(s);
}

// ── 18 수동 갱신에서 다시 굴리기: 갱신기를 안 부르면 사라진 응답의 인물이 계속 남나 ──
{
  const s = step('수동갱신_다시굴리기');
  await clearQ();
  await restore(snapAfterC4);
  await vars({ $pp_when: 'manual' });
  await replaceLast(C4b, 'c4b');
  await listen(); await sleep(300);
  const scr = await peopleScreen();
  await queue('router', ROUTER([]));
  await queue('director', DIRECTOR([]));
  const n0 = await llmN();
  const out = await mainRequest('주위를 둘러본다.', 'u5m');
  const calls = await llmFrom(n0);
  writeCalls(s, calls);
  appendMain(s, out);
  const rd = routerOf(calls);
  check(s, '수동: 다시 굴린 뒤 인물 화면에 도준이 안 보임', !scr.includes('도준'), '도준 없음', scr.slice(0, 200), 'F-1 (나)');
  check(s, '수동: 다음 본편 Router 명단에 도준·큐라스 없음', rd && !catNames(rd).some((n) => ['큐라스', '도준'].includes(n)), '없음', catNames(rd), 'F-1 (나)');
  await vars({ $pp_when: 'turn' });
  await saveState(s);
}

// ── 19 갱신기 실패·빈 답·꼴 틀린 답 → 읽음 안 함, 반쪽 저장 없음, 다음 턴에 함께 읽음 ──
{
  const s = step('갱신기_실패_다음턴');
  for (const [label, replies] of [['실패', ['!FAIL', '!FAIL', '!FAIL', '!FAIL']], ['빈 답', ['', '']], ['꼴 틀림', ['{"entries":[{"who":"큐라스","slot":"state"', '{"entries":[{"who":"큐라스","slot":"state"']]]) {
    await clearQ();
    await restore(snapBeforeC4);
    await queue('update', ...replies);
    const n0 = await llmN();
    const t0 = Date.now();
    await botReply(C4, 'c4');
    const calls = (await llmFrom(n0)).filter((c) => c.kind === 'update');
    writeCalls(s, calls, `■ ${label}\n`, `_${label}`);
    const p = await st();
    check(s, `${label}: c4 를 읽음 표시 안 함 (다음에 다시 읽게)`, !p.read?.c4, '읽음 없음', Object.keys(p.read ?? {}));
    check(s, `${label}: 갱신기 결과는 저장 안 됨 (도준·c4 항목 없음)`, !p.people['도준'] && !(p.people['큐라스']?.slots?.state ?? []).some((e) => e.anchor === 'c4'), '없음', { people: Object.keys(p.people), 큐라스state: p.people['큐라스']?.slots?.state });
    note(s, `${label}: 호출 수·걸린 시간 / 코드가 먼저 만든 큐라스 기록`, { calls: calls.length, ms: Date.now() - t0, 큐라스: !!p.people['큐라스'] }, '형식 재시도 1회(생성 공통 기본), 모델 오류 재시도 2회');
    if (label === '실패') {
      const scr = await peopleScreen();
      check(s, '실패 뒤 인물 화면에 안 읽은 응답 1개가 보임', /새 응답 1개/.test(scr), '새 응답 1개', scr.slice(0, 160));
      // 다음 턴: c4 와 c5 를 함께 읽어야 한다
      await clearQ();
      await queue('router', ROUTER(['큐라스']));
      await queue('director', DIRECTOR([]));
      await mainRequest(U5, 'u5');
      await queue('update', U({ new_people: [{ name: '도준', aliases: [], m: 'm4', quote: '도준이라는 청년이 큐라스에게 길을 물었다', identity: '청년', speech: null, provisional: false }], present: ['큐라스'] }));
      const n1 = await llmN();
      await botReply(C5, 'c5');
      const c2 = (await llmFrom(n1)).filter((c) => c.kind === 'update');
      writeCalls(s, c2, '■ 실패 다음 턴\n', '_실패_다음턴');
      const conf = c2.map((c) => (dataOf(c)?.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').length);
      const p2 = await st();
      check(s, '다음 턴 갱신기가 실패한 c4 와 새 c5 를 함께 읽고 둘 다 읽음 표시', conf.reduce((a, b) => a + b, 0) === 2 && !!p2.read?.c4 && !!p2.read?.c5, { confirmed: 2, read: ['c4', 'c5'] }, { conf, read: Object.keys(p2.read ?? {}) });
    }
  }
  await saveState(s);
}

// ── 20 늦게 온 갱신기 답 (병렬 켬): 답이 오기 전에 다시 굴리면 옛 답이 새 응답에 붙지 않나 ──
{
  const s = step('늦은답_병렬_다시굴리기');
  await clearQ();
  await restore(snapBeforeC4);
  await vars({ $pp_parallel: '1' });
  await page.evaluate(() => { let r; const p = new Promise((x) => { r = x; }); window.__gate = { p, r }; });
  await queue('update', UPD_C4(), U({ present: [] }));
  const n0 = await llmN();
  await page.evaluate((t) => { window.__chat.message.push({ role: 'char', data: t, chatId: 'c4' }); window.__p1 = window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); }, C4);
  await sleep(700);
  await page.evaluate((t) => { const m = window.__chat.message; m[m.length - 1] = { role: 'char', data: t, chatId: 'c4b' }; window.__p2 = window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); }, C4b);
  await sleep(500);
  await page.evaluate(() => { window.__gate.r(); window.__gate = null; });
  await page.evaluate(async () => { await window.__p1; await window.__p2; });
  await page.waitForFunction(() => window.__q.update.length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(2500);
  const calls = (await llmFrom(n0)).filter((c) => c.kind === 'update');
  writeCalls(s, calls);
  const p = await st();
  check(s, '갱신기 2회 (옛 응답 c4, 새 응답 c4b)', calls.length === 2, 2, calls.length);
  check(s, '옛 응답 c4 의 답이 저장되지 않음: 도준·c4 항목 없음', !p.people['도준'] && !(p.people['큐라스']?.slots?.state ?? []).length, '없음', Object.keys(p.people));
  check(s, '새 응답 c4b 읽음, c4 에서만 나온 큐라스 기록 없음', !!p.read?.c4b && !p.people['큐라스'], { read: 'c4b', 큐라스: false }, { read: Object.keys(p.read ?? {}), people: Object.keys(p.people) });
  await vars({ $pp_parallel: '0' });
  await saveState(s);
}

// ── 20b 늦게 온 갱신기 답 (병렬 켬): 답이 오기 전에 다른 채팅으로 가면 ──
{
  const s = step('늦은답_다른채팅');
  await clearQ();
  await restore(snapBeforeC4);
  await vars({ $pp_parallel: '1' });
  await page.evaluate(() => { let r; const p = new Promise((x) => { r = x; }); window.__gate = { p, r }; });
  await queue('update', UPD_C4());
  await page.evaluate((t) => { window.__chat.message.push({ role: 'char', data: t, chatId: 'c4' }); window.__p1 = window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); }, C4);
  await sleep(700);
  const mine = await snap();
  const other = { message: [{ role: 'user', data: '다른 채팅', chatId: 'ox1' }, { role: 'char', data: `다른 채팅의 응답이다. 큐라스가 지나갔다.\n${ST('01:00 PM', '관리국 복도')}`, chatId: 'ox2' }], scriptstate: { ...mine.scriptstate } };
  await restore(other);
  await page.evaluate(() => { window.__gate.r(); window.__gate = null; });
  await page.evaluate(async () => { await window.__p1; });
  await sleep(2000);
  const o = await st();
  check(s, '늦게 온 답이 다른 채팅에 붙지 않음', !o || !Object.keys(o.people ?? {}).length, '다른 채팅 기록 없음', o && Object.keys(o.people ?? {}));
  await restore(mine);
  const p = await st();
  check(s, '원래 채팅: 답을 버려 c4 는 안 읽은 채로 (다음 갱신이 다시 읽음)', !p.read?.c4 && !p.people['도준'], { read: 'c4 없음', 도준: false }, { read: Object.keys(p.read ?? {}), people: Object.keys(p.people) });
  await vars({ $pp_parallel: '0' });
  await saveState(s);
}

// ── 21 Router 실패·빈 답·꼴 틀림 → 코드 Router 로, 본편·Director 는 그대로 ──
{
  const s = step('Router_실패_빈답_꼴틀림');
  await clearQ();
  await restore(snapAfterC5);
  let k = 0;
  for (const [label, reply] of [['실패', '!FAIL'], ['빈 답', ''], ['꼴 틀림', 'selected: 큐라스']]) {
    k++;
    await queue('router', reply);
    await queue('director', DIRECTOR([{ who: '큐라스', now: 'Waiting.', must_not_reveal: [] }]));
    const n0 = await llmN();
    const out = await mainRequest(`큐라스를 따라 ${k}층으로 내려간다.`, `ur${k}`);
    const calls = await llmFrom(n0);
    writeCalls(s, calls, `■ ${label}\n`, `_${label}`);
    appendMain(s, out, `_${label}_본편`);
    const blk = blockOf(out)[0]?.content ?? '';
    check(s, `${label}: 코드 Router 로 큐라스가 본편 인물 글에 들어가고 Director 도 불림`, blk.includes('큐라스') && calls.some((c) => c.kind === 'director'), '큐라스·Director', { block: blk.includes('큐라스'), calls: kinds(calls) });
    await page.evaluate(() => { window.__chat.message.pop(); });
    await clearQ();
  }
}

// ── 22 Router 재사용 열쇠: 같은 입력이면 재사용(의도). Router 모델·덧붙일 지침을 바꾸면 다시 부르나 ──
{
  const s = step('Router_재사용_설정바꿈');
  await clearQ();
  await restore(snapAfterC5);
  const ask = async (tag) => {
    await queue('router', ROUTER(['큐라스']));
    await queue('director', DIRECTOR([{ who: '큐라스', now: tag, must_not_reveal: [] }]));
    const n0 = await llmN();
    await mainRequest(U6, 'u6', false);
    const calls = await llmFrom(n0);
    await clearQ();
    return calls;
  };
  await page.evaluate((t) => window.__chat.message.push({ role: 'user', data: t, chatId: 'u6' }), U6);
  const c1 = await ask('a');
  const c2 = await ask('b');
  note(s, '같은 입력 다시 보내기: Router 재사용 (의도, host/people.ts:784)', kinds(c2), '「입력·최근 글·명단이 같으면 재사용」');
  await vars({ $pp_model_router: 'main' });
  const c3 = await ask('c');
  const r3 = c3.filter((c) => c.kind === 'router');
  writeCalls(s, c3, '■ Router 모델을 메인으로\n', '_모델바꿈');
  check(s, 'Router 모델을 보조 → 메인으로 바꾸면 Router 를 다시 부름 (메인 모델로)', r3.length === 1 && r3[0].mode === 'model', { router: 1, mode: 'model' }, { first: kinds(c1), after: kinds(c3), mode: r3[0]?.mode }, 'Director 는 같은 경우 다시 부름(host/people.ts:824 「모델을 바꿔도 다시 묻는다」), 1차 문제5 와 같은 종류');
  await vars({ $pp_model_router: 'same', $pp_router_rules: '큐라스는 늘 고른다.' });
  await ask('d');
  await vars({ $pp_router_rules: '에일린은 늘 고른다.' });
  const c5 = await ask('e');
  writeCalls(s, c5, '■ 덧붙일 지침을 같은 길이의 다른 글로\n', '_지침바꿈');
  check(s, 'Router 덧붙일 지침을 다른 글(같은 길이)로 바꾸면 Router 를 다시 부름', c5.some((c) => c.kind === 'router'), 'Router 1회', kinds(c5), 'router.ts:46 재사용 열쇠에 지침은 길이만 들어감');
  await vars({ $pp_router_rules: '' });
  await page.evaluate(() => { window.__chat.message.pop(); });
}

// ── 23 주인공(페르소나) 이름: 요청에 주인공 이름이 실리나, 갱신기가 주인공을 새 인물로 돌려주면 받나 ──
{
  const s = step('주인공_이름');
  await clearQ();
  await restore(snapAfterC3);
  await queue('router', ROUTER(['에일린'], [{ name: '한서준', aliases: [], quote: '한서준 씨' }]));
  await queue('director', DIRECTOR([{ who: '에일린', now: 'x', must_not_reveal: [] }]));
  const n0 = await llmN();
  const out = await mainRequest('에일린에게 인사한다.', 'up');
  const calls = await llmFrom(n0);
  writeCalls(s, calls, '', '_Router_Director');
  appendMain(s, out);
  const rd = routerOf(calls);
  const nt = noteOf(out)[0]?.content ?? '';
  note(s, '플러그인은 주인공 이름을 앎 (Director 메모 머리)', nt.slice(0, 160), 'host/user.ts userInfo');
  check(s, 'Router 요청에 주인공 이름을 알려 줌 (지침 Router 3 「never list the user\'s own character」)', JSON.stringify(rd ?? {}).includes('한서준') || String(calls.find((c) => c.kind === 'router')?.messages?.[0]?.content ?? '').includes('한서준'), '주인공 이름', rd && Object.keys(rd), '지침 Router.txt RULES 3');
  const CP = `에일린이 고개를 들었다. "한서준 씨, 이제 왔어요?" 한서준은 가방을 내려놓고 자리에 앉았다.\n${ST('09:40 PM', '관리국 종합대응팀 사무실')}`;
  await queue('update', U({ new_people: [{ name: '한서준', aliases: [], m: '@M', quote: '한서준은 가방을 내려놓고', identity: '관리국 신입', speech: null, provisional: false }], present: ['에일린', '한서준'] }));
  const n1 = await llmN();
  await botReply(CP, 'cp');
  const up = (await llmFrom(n1)).filter((c) => c.kind === 'update');
  writeCalls(s, up, '', '_갱신기');
  const d = dataOf(up[0]);
  const p = await st();
  check(s, '갱신기 자료에 주인공 이름을 알려 줌 (span·name_hints·shop_check 밖)', d && JSON.stringify({ ...d, span: undefined, name_hints: undefined, shop_check: undefined }).includes('한서준'), '주인공 이름', d && Object.keys(d), '갱신기 지침 1절 `@user` = the persona');
  check(s, 'Router 가 주인공 이름을 새 인물 힌트로 내도 갱신기 name_hints 로 넘기지 않음', !(d?.name_hints ?? []).some((h) => h.name === '한서준'), '없음', d?.name_hints, '지침 Router 3 「never list the user\'s own character」');
  check(s, '주인공 이름으로 인물 기록을 만들지 않음', !p.people['한서준'], '한서준 없음', Object.keys(p.people), 'host/people.ts:132 「기록하지 않는 이름: 유저가 연기하는 요원」, 상점은 주인공 이름을 뺌(host/people.ts:410)');
  await saveState(s);
}

// ── 24 호칭 기록 → 이름 옮기기 → 그 응답을 다시 굴림 ──
{
  const s = step('호칭기록_이름옮기기_다시굴리기');
  await clearQ();
  await restore(snapBeforeC4);
  await queue('update', U({ new_people: [{ name: '노점 주인', aliases: [], m: '@M', quote: '옆 노점의 주인이 고개를 숙였다', identity: '지하상가 노점 주인', speech: '존댓말', provisional: true }], entries: [{ who: '노점 주인', slot: 'state', op: 'upsert', replace: null, text: '지하상가 입구 노점을 지킴', target: null, m: '@M', quote: '옆 노점의 주인이 고개를 숙였다' }], present: ['큐라스', '노점 주인'] }));
  await botReply(C4, 'c4');
  let p = await st();
  check(s, '이름 없는 노점 주인이 호칭 기록(provisional)으로 생김', p.people['노점 주인']?.provisional === true, true, p.people['노점 주인'] && { provisional: p.people['노점 주인'].provisional });
  await vars({ $pp_always: '노점 주인' });
  await queue('router', ROUTER(['노점 주인']));
  await queue('director', DIRECTOR([{ who: '노점 주인', now: 'x', must_not_reveal: [] }]));
  let n0 = await llmN();
  let out = await mainRequest('노점 주인에게 이름을 묻는다.', 'u5n');
  let calls = await llmFrom(n0);
  writeCalls(s, calls, '', '_Router');
  appendMain(s, out);
  const rd = routerOf(calls);
  check(s, 'Router 명단에 노점 주인이 provisional 로', rd?.catalog?.some((c) => c.name === '노점 주인' && c.provisional === true), 'provisional', rd?.catalog);
  const blk = blockOf(out)[0]?.content ?? '';
  note(s, '본편 인물 글의 노점 주인 줄', blk.slice(blk.indexOf('노점 주인') - 5, blk.indexOf('노점 주인') + 300), '호칭 기록이 본편에 어떻게 보이나');
  const before = await snap();
  const C5n = `노점 주인은 웃으며 말했다. "제 이름은 대식입니다. 다들 그렇게 불러요."\n${ST('10:12 PM', '중림 지하상가')}`;
  await queue('update', U({ renames: [{ from: '노점 주인', to: '대식', m: '@M', quote: '제 이름은 대식입니다' }], present: ['대식'] }));
  await botReply(C5n, 'c5n');
  p = await st();
  const always1 = await page.evaluate(() => window.__chat.scriptstate.$pp_always);
  check(s, '이름 옮기기: 대식 기록에 노점 주인 항목이 옮겨지고, 「항상 포함」도 대식으로', p.people['대식'] && !p.people['노점 주인'] && (p.people['대식'].slots.state ?? []).some((e) => e.text.includes('노점')) && always1 === '대식', { 대식: true, always: '대식' }, { people: Object.keys(p.people), always: always1 });
  await saveState(s);
  // 이름을 밝힌 응답(c5n)을 다시 굴림 → 새 응답에선 이름이 안 나옴
  await replaceLast(`노점 주인은 대답 없이 고개만 저었다.\n${ST('10:12 PM', '중림 지하상가')}`, 'c5n2');
  await queue('update', U({ present: ['노점 주인'] }));
  await listen(); await sleep(400);
  p = await st();
  const always2 = await page.evaluate(() => window.__chat.scriptstate.$pp_always);
  const scr = await peopleScreen();
  check(s, '이름을 밝힌 응답을 다시 굴리면 이름 옮기기도 되돌아감 (노점 주인으로)', !!p.people['노점 주인'] && !p.people['대식'], { 노점주인: true, 대식: false }, { people: Object.keys(p.people), always: always2, screen: scr.slice(0, 160) }, 'F-1 (나) 「사라진 응답이 만든 변경은 버린다」');
  await queue('router', ROUTER([]));
  await queue('director', DIRECTOR([]));
  n0 = await llmN();
  out = await mainRequest('노점 주인을 바라본다.', 'u6n');
  calls = await llmFrom(n0);
  writeCalls(s, calls, '', '_다시굴린뒤');
  appendMain(s, out, '_다시굴린뒤_본편');
  note(s, '다시 굴린 뒤 본편 인물 글에 「대식」', (blockOf(out)[0]?.content ?? '').includes('대식'), '');
  await vars({ $pp_always: '' });
  await restore(before);
}

// ── 25 확인 뒤 등록: 등록 대기 → 화면 「등록」, 근거 응답을 다시 굴리면 대기 줄이 빠지나 ──
{
  const s = step('확인뒤등록');
  await clearQ();
  await restore(snapBeforeC4);
  await vars({ $pp_newpeople: 'confirm' });
  await queue('update', UPD_C4());
  await botReply(C4, 'c4');
  let p = await st();
  check(s, '큐라스(코드)·도준(갱신기)이 기록 대신 등록 대기로', !!p.pending['큐라스'] && !!p.pending['도준'] && !p.people['큐라스'] && !p.people['도준'], { pending: ['큐라스', '도준'] }, { pending: Object.keys(p.pending), people: Object.keys(p.people) });
  const before = await snap();
  // 다시 굴린 직후(갱신 전) 화면
  await replaceLast(C4b, 'c4b');
  const scr0 = await peopleScreen();
  check(s, '근거 응답을 다시 굴린 직후 화면에 도준 등록 단추가 안 남음', !scr0.includes('도준'), '도준 없음', scr0.slice(0, 220), 'store.ts prunePending 「다시 굴리거나 지운 응답에서만 나온 이름」');
  await queue('update', U());
  await listen(); await sleep(400);
  p = await st();
  check(s, '새 응답 갱신 뒤 대기 줄이 빠짐', !p.pending['도준'] && !p.pending['큐라스'], '없음', Object.keys(p.pending));
  // 화면 「등록」 단추
  await restore(before);
  await openPeople();
  await page.click('[data-action="pp-register"][data-value="도준"]'); await sleep(500);
  await closeWin(page);
  p = await st();
  check(s, '화면 「등록」 → 도준 기록이 생기고 대기에서 빠짐', !!p.people['도준'] && !p.pending['도준'], { people: '도준' }, { people: Object.keys(p.people), pending: Object.keys(p.pending) });
  await vars({ $pp_newpeople: 'auto' });
  await saveState(s);
}

// ── 26 설정 끔 → 켬 ──
{
  const s = step('설정끔_켬');
  await clearQ();
  await restore(snapAfterC5);
  await vars({ $pp_on: '0' });
  let n0 = await llmN();
  let out = await mainRequest(U6, 'u6');
  check(s, '끔: 본편 앞 보조 호출 없음, 인물 글 없음', (await llmN()) === n0 && blockOf(out).length === 0, { calls: 0, block: 0 }, { calls: kinds(await llmFrom(n0)), block: blockOf(out).length });
  await botReply(C6, 'c6');
  check(s, '끔: 응답 뒤 갱신기 안 부름', !(await llmFrom(n0)).some((c) => c.kind === 'update'), 0, kinds(await llmFrom(n0)));
  const flow = await flowRows();
  writeFileSync(`${OUT}단계${s.n}_${s.name}_호출흐름화면.txt`, flow.all);
  check(s, '끔: 호출 흐름 화면 Router 줄이 「호출 없음」', /호출 없음|꺼짐|사용 안 함/.test(flow.router), '호출 없음', flow.router);
  const scr = await peopleScreen();
  note(s, '끔: 인물 화면', scr.slice(0, 200), '');
  await vars({ $pp_on: '1' });
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([]));
  await mainRequest(U7, 'u7');
  await queue('update', U());
  n0 = await llmN();
  await botReply(C7, 'c7');
  const up = (await llmFrom(n0)).filter((c) => c.kind === 'update');
  writeCalls(s, up, '■ 다시 켠 뒤 첫 갱신\n');
  const conf = up.map((c) => (dataOf(c)?.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').map((x) => x.m));
  const p = await st();
  check(s, '다시 켬: 마지막으로 읽은 c5 뒤의 c6·c7 을 읽음 (host/people.ts:331 「마지막으로 읽은 것 뒤」)', !!p.read?.c6 && !!p.read?.c7, ['c6', 'c7'], { conf, read: Object.keys(p.read ?? {}) });
  await saveState(s);
}

// ── 27 정리 실패: 꼴 틀린 답 → 기록 그대로, 안내 ──
{
  const s = step('정리_실패');
  await clearQ();
  await restore(snapAfterTidy);
  const before = JSON.stringify((await st()).people['큐라스'].slots);
  await queue('tidy', '{"slots": {"history": [');
  await queue('tidy', '{"slots": {"history": [');
  await openPeople();
  await page.click('[data-action="rec-person"][data-value="큐라스"]'); await sleep(400);
  await page.click('[data-action="pp-tidy"][data-value="큐라스"]').catch(() => act('pp-tidy', '큐라스'));
  await sleep(1500);
  const txt = await paneText();
  await closeWin(page);
  const after = JSON.stringify((await st()).people['큐라스'].slots);
  check(s, '정리 답이 꼴이 틀리면 기록은 그대로', before === after, '그대로', before === after ? '그대로' : '바뀜');
  check(s, '정리 실패 안내가 화면에 보임', /정리 실패|실패/.test(txt), '정리 실패 …', txt.split('\n').filter((l) => /정리|실패/.test(l)).slice(0, 3));
}

// ── 28 누출 검사: 이번 실행의 본편 인물 글·Director 메모에 플러그인 내부 표식이 새나 ──
{
  const s = step('본편_내부표식_누출');
  const { readdirSync, readFileSync } = await import('node:fs');
  const bad = [];
  for (const f of readdirSync(OUT).filter((x) => x.endsWith('_본편.txt'))) {
    const t = readFileSync(`${OUT}${f}`, 'utf8');
    for (const blk of t.split(/──── \[\d+\] \w+ ────\n/).filter((x) => x.startsWith('[People records]') || x.startsWith('[Director note]'))) {
      for (const [label, re] of [['항목 id', /\be(?=[0-9a-z]*\d)[0-9a-z]{5,8}\b/], ['메시지 꼬리표', /\b(?:c|u)\d+[a-z]?\b/], ['@user', /@user/], ['#0', /#\d/], ['provisional 낱말', /provisional/], ['origin/anchor', /\b(origin|anchor)\b/]]) {
        const m = blk.match(re);
        if (m) bad.push(`${f}: ${label} 「${blk.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, ' ')}」`);
      }
    }
  }
  writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, bad.join('\n') || '(없음)');
  check(s, '본편 인물 글·Director 메모에 항목 id·메시지 꼬리표·@user·provisional 같은 내부 표식이 없음', bad.length === 0, 0, bad.slice(0, 6), '점검지침 3-A 「플러그인 내부 표식」');
}

// ── 29 페이지 새로고침: 저장 상태만으로 화면·다음 요청이 이어지나 ──
const storeNow = await page.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
async function reboot(chat, vp) {
  await page.close();
  ({ page, errors } = await boot(b, fx, chat, vp, { store: storeNow }));
  await installMock();
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
}
{
  const s = step('페이지새로고침');
  await clearQ();
  await restore(snapAfterC5);
  const scrA = await peopleScreen();
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'Now speaks casually to the newcomer.', must_not_reveal: [] }]));
  const outA = await mainRequest(U6, 'u6');
  await reboot(snapAfterC5, 'pc');
  const scrB = await peopleScreen();
  await queue('router', ROUTER(['큐라스']));
  await queue('director', DIRECTOR([{ who: '큐라스', now: 'Now speaks casually to the newcomer.', must_not_reveal: [] }]));
  const n0 = await llmN();
  const outB = await mainRequest(U6, 'u6');
  const calls = await llmFrom(n0);
  appendMain(s, outB);
  check(s, '새로고침 뒤 인물 화면이 같음', scrA === scrB, '같음', scrA === scrB ? '같음' : { A: scrA.slice(0, 200), B: scrB.slice(0, 200) });
  check(s, '새로고침 뒤 같은 입력의 본편 인물 글·Director 메모가 같음 (Router·Director 는 다시 부름)', blockOf(outA)[0]?.content === blockOf(outB)[0]?.content && noteOf(outA)[0]?.content === noteOf(outB)[0]?.content && kinds(calls).join() === 'router,director', '같음', { block: blockOf(outA)[0]?.content === blockOf(outB)[0]?.content, note: noteOf(outA)[0]?.content === noteOf(outB)[0]?.content, calls: kinds(calls) });
}

// ── 30 폰 크기: 인물 화면 열기·인물 보기·「새 응답 읽기」 ──
{
  const s = step('폰_인물화면');
  const c = JSON.parse(JSON.stringify(snapAfterC5));
  c.message.push({ role: 'user', data: U6, chatId: 'u6' }, { role: 'char', data: C6, chatId: 'c6' });
  await reboot(c, 'phone');
  await vars({ $pp_when: 'manual' });
  await openPeople();
  const txt = await paneText();
  const vw = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, v: window.innerWidth }));
  await page.screenshot({ path: `${OUT}단계${s.n}_${s.name}.png` });
  check(s, '폰: 기록 → 인물 단추로 열림, 에일린·큐라스·도준, 새 응답 1개', ['에일린', '큐라스', '도준'].every((n) => txt.includes(n)) && /새 응답 1개/.test(txt), '세 사람 · 새 응답 1개', txt.slice(0, 200));
  check(s, '폰: 가로 넘침 없음', vw.w <= vw.v, vw.v, vw.w);
  await queue('update', U({ entries: [{ who: '큐라스', slot: 'history', op: 'add', replace: null, text: '손전등을 켜고 앞장섬', target: null, m: '@M', quote: '손전등을 켰다' }], present: ['큐라스'] }));
  const n0 = await llmN();
  // 연타: 「새 응답 읽기」를 두 번 빠르게
  await page.evaluate(() => { const b = document.querySelector('[data-action="pp-update"]'); b.click(); b.click(); });
  await page.waitForFunction(() => !document.querySelector('.pp-upst.busy'), null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const calls = (await llmFrom(n0)).filter((x) => x.kind === 'update');
  await page.click('[data-action="rec-person"][data-value="큐라스"]').catch(() => {}); await sleep(400);
  const txt2 = await paneText();
  await page.screenshot({ path: `${OUT}단계${s.n}_${s.name}_큐라스.png` });
  await closeWin(page);
  const p = await st();
  check(s, '폰: 「새 응답 읽기」 두 번 연타 → 갱신기 1회, 큐라스 항목 반영·화면에 보임', calls.length === 1 && (p.people['큐라스'].slots.history ?? []).some((e) => e.text === '손전등을 켜고 앞장섬') && txt2.includes('손전등'), { calls: 1, 화면: '손전등' }, { calls: calls.length, screen: txt2.slice(0, 200) });
  await saveState(s);
}

writeFileSync(`${OUT}결과.json`, JSON.stringify({ commit: process.env.GIT_COMMIT ?? '', results, notes, pageErrors: errors }, null, 2));
const fail = results.filter((r) => !r.ok);
const stepsAll = [...new Set(results.map((r) => r.step))];
const stepsBad = new Set(fail.map((r) => r.step));
console.log(`\n검사 ${results.length - fail.length}/${results.length} 통과 · 단계 ${stepsAll.length - stepsBad.size}/${stepsAll.length} 통과${errors.length ? ` · 페이지 오류 ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
