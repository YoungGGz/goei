// 플레이 순서 점검 2차 · 14 호출 흐름 미리 보기·진행 창 (지침: ../../GPT_점검지침_초안.md)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs)에 띄운다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(종류별 가짜 답·지연), 본편 = beforeRequest 훅, 응답 처리 = output 리스너.
// 화면: 호출 흐름(설정 → 호출 흐름, 줄의 조작 단추를 눌러 설정을 바꿈), 진행 창([x-goei-prog], PC 카드·폰 점 막대).
// 결과: out/단계NN_*.txt (요청 전문·화면 글), out/상태NN.json, out/결과.json
// 사용법: (fixture·dist 가 있으면) node 인수인계/플레이순서_점검/2차/14_호출흐름_진행창/run.mjs [갈래 이름…]
//   갈래: base combo fail late manual mixed phone mainfail · all (없으면 mainfail 빼고 전부. mainfail 은 3분 넘게 기다린다)
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin, openEditor } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const ARGS = process.argv.slice(2);
const want = (k) => (ARGS.includes('all') || (ARGS.length ? ARGS.includes(k) : k !== 'mainfail'));
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 장면 (인물은 카드 명부의 에일린만) ──
const ST = (time, place) => `[▣|2025.03.14|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|1000]`;
const U1 = '사무실을 둘러본다.';
const C1 = `사무실은 조용했다. 형광등이 낮게 울렸다.\n${ST('09:10 PM', '관리국 종합대응팀 사무실')}`;
const U2 = '누가 들어오는지 문 쪽을 본다.';
const C2 = `문이 열리고 에일린이 들어왔다. "신입, 아직 안 갔어?" 에일린이 종이컵 커피를 내밀며 옆자리에 앉았다.\n${ST('09:20 PM', '관리국 종합대응팀 사무실')}`;
const UT = (i) => `에일린에게 ${i}번째로 말을 건다.`;
const CT = (i) => `에일린이 고개를 끄덕였다. "응, ${i}번째 얘기네." 창밖으로 비가 내렸다.\n${ST(`09:${String(30 + i).padStart(2, '0')} PM`, '관리국 종합대응팀 사무실')}`;

const U = (o = {}) => JSON.stringify({ entries: [], axes_init: [], observations: [], cues: [], address: [], identity: { faction: null, rank: null }, new_people: [], renames: [], docs: [], present: [], issues: [{ code: 'no_canonical_change', who: null, reason: '점검용' }], ...o });
const ROUTER = (selected) => JSON.stringify({ selected: selected.map((name) => ({ name })), new_characters: [] });
const DIRECTOR = (notes) => JSON.stringify({ notes });
const DIR1 = DIRECTOR([{ who: '에일린', now: 'Friendly senior.', must_not_reveal: [], uncertain: [] }]);

const results = [];
let stepNo = 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)}`}`);
}
const notes = [];
function note(s, what, actual) { notes.push({ step: `${s.n} ${s.name}`, what, actual }); console.log(`NOTE [${s.n} ${s.name}] ${what}: ${JSON.stringify(actual).slice(0, 300)}`); }
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');

const b = await launch();
const chat0 = {
  message: [],
  // 형식·일시 오류 재시도 0: 호출 수를 기능 수와 바로 맞춰 보려고 (재시도 갈래는 따로)
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_asset_on: '0', $pp_on: '1', $pp_keep_raw: '1', $gen_retries: '0', $gen_transient: '0', $st_wallet: JSON.stringify({ start: 1000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) },
};
const store = { 'p:goei:user-name': '한서준', 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
let vpName = 'pc';
let { page, errors } = await boot(b, fx, chat0, vpName, { store });

// ── 보조 호출 가로채기: 종류별 가짜 답 줄·지연, 입력 기록 ──
const installMock = () => page.evaluate(() => {
  window.__q = {};
  window.__delay = {};
  window.__calls.llm = [];
  const kindOf = (msgs) => {
    const s = String(msgs?.[0]?.content ?? '');
    const all = msgs.map((m) => String(m.content ?? '')).join('\n');
    if (s.startsWith('# Router')) return 'router';
    if (s.includes('# Scene Director')) return 'director';
    if (s.startsWith('# People Record Updater')) return 'update';
    if (s.startsWith('You tidy the per-chat record')) return 'tidy';
    if (/이미지 태그|image tag|<img|Asset/i.test(s.slice(0, 400))) return 'asset';
    if (/통합|combined|JOINT|several tasks/i.test(s.slice(0, 300))) return 'joint';
    if (/괴담톡|messenger|KakaoTalk|phone/i.test(all.slice(0, 600))) return 'phone';
    if (/위키|wiki/i.test(all.slice(0, 600))) return 'wiki';
    if (/쇼핑몰|mall|백일몽 포인트/i.test(all.slice(0, 800))) return 'mall';
    if (/괴담넷|게시판|board|community/i.test(all.slice(0, 600)) || s.startsWith('Treat the supplied setting as fictional world reference')) return 'gnet';
    return 'other';
  };
  window.risuai.runLLMModel = async (o) => {
    const kind = kindOf(o.messages);
    const rec = { kind, mode: o.mode, at: Date.now(), head: String(o.messages?.[0]?.content ?? '').slice(0, 160), messages: JSON.parse(JSON.stringify(o.messages)) };
    window.__calls.llm.push(rec);
    await new Promise((r) => setTimeout(r, window.__delay[kind] ?? 80));
    const next = (window.__q[kind] || []).shift();
    if (next === undefined || next === '!FAIL') { rec.reply = '(실패로 돌려줌)'; return { type: 'fail', result: 'mock fail' }; }
    if (next === '!EMPTY') { rec.reply = '(빈 답)'; return { type: 'success', result: '' }; }
    rec.reply = next;
    return { type: 'success', result: next };
  };
});
await installMock();

const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat.goeiPeopleV1 ?? null)));
const vars = (o) => page.evaluate((o) => { window.__chat.scriptstate = { ...window.__chat.scriptstate, ...o }; }, o);
const queue = (kind, ...t) => page.evaluate(([k, t]) => { (window.__q[k] = window.__q[k] || []).push(...t); }, [kind, t]);
const delay = (kind, ms) => page.evaluate(([k, ms]) => { window.__delay[k] = ms; }, [kind, ms]);
const clearQ = () => page.evaluate(() => { window.__q = {}; window.__delay = {}; });
const llmN = () => page.evaluate(() => window.__calls.llm.length);
const llmFrom = (n) => page.evaluate((n) => window.__calls.llm.slice(n), n);
const kinds = (calls) => calls.map((c) => c.kind);
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
/** 채팅을 되돌리고 가짜 답 줄도 비운다 (앞 갈래에서 안 쓰인 답이 다음 갈래로 밀리지 않게) */
const restore = (c) => page.evaluate((c) => { window.__chat = JSON.parse(JSON.stringify(c)); window.__q = {}; window.__delay = {}; }, c);
const saveState = async (s, extra = {}) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ ...extra, scriptstate: Object.fromEntries(Object.entries(await page.evaluate(() => window.__chat.scriptstate)).filter(([k]) => /^\$(pp_|ph_auto|ph_view|nw_auto|gen_|st_asset|br_login|net_joint)|lazy|:auto|desk/.test(k))), people: Object.keys((await st())?.people ?? {}), messages: await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: String(m.data).slice(0, 60) }))) }, null, 2));
const writeCalls = (s, calls, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${calls.map((c, i) => `════════ 보조 호출 ${i + 1}: ${c.kind} (${c.mode}) ════════\n${fmtMsgs(c.messages)}\n\n════ 넣은 가짜 답 ════\n${c.reply ?? '(아직 답 없음)'}`).join('\n\n')}\n`);

const mainRequest = async (userText, uid, push = true) => page.evaluate(async ([t, id, push]) => {
  if (push) window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid, push]);
/** 본편 응답이 붙음 → output 리스너 (리스너는 인물 갱신까지 기다리고, 인터넷 자동 호출은 뒤에서 돈다: 실제 Risu 와 같음) */
const botReply = async (text, cid, push = true) => { await page.evaluate(async ([t, id, push]) => {
  if (push) window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid, push]); };

/** 진행 창 화면 (host/progwin.ts): 카드 머리·제목·줄(상태)·폰 점 */
const prog = () => page.evaluate(() => {
  const h = document.querySelector('[x-goei-prog]');
  if (!h) return null;
  const card = h.querySelector('[data-card]');
  return {
    show: h.getAttribute('x-goei-show'), open: h.getAttribute('x-goei-open'), run: h.getAttribute('x-goei-run'), fail: h.getAttribute('x-goei-fail'), phone: h.getAttribute('x-goei-phone'),
    visible: getComputedStyle(h).display !== 'none',
    grip: card.querySelector('[data-grip]')?.textContent?.trim(), title: card.querySelector('[data-p="t"]')?.textContent, meta: card.querySelector('[data-p="m"]')?.textContent,
    cells: [...card.querySelectorAll('[data-p="c"]')].map((c) => `${c.textContent}:${c.getAttribute('data-s')}`),
    rows: [...card.querySelectorAll('[data-p="r"]')].map((r) => ({ s: r.getAttribute('data-s'), nm: r.querySelector('[data-p="nm"]')?.childNodes[0]?.textContent, dt: r.querySelector('[data-p="dt"]')?.textContent ?? '', tm: r.querySelector('[data-p="tm"]')?.textContent })),
    dots: [...h.querySelectorAll('[data-dot] [data-p="d"]')].map((d) => `${d.getAttribute('title')}:${d.getAttribute('data-s')}`),
  };
});
const waitTitle = async (re, ms = 20000) => { const t0 = Date.now(); let p; while (Date.now() - t0 < ms) { p = await prog(); if (p && re.test(p.title ?? '')) return p; await sleep(200); } return p; };
const rowsTxt = (p) => (p?.rows ?? []).map((r) => `${r.nm}=${r.s}${r.dt ? `(${r.dt})` : ''}`);

/** 호출 흐름 화면 열기 (창 → 설정 → 호출 흐름). 토큰 셈이 끝날 때까지 기다린다 */
const openFlow = async () => {
  await openWin(page); await sleep(200);
  await openEditor(page, 'manage:flow');
  await page.waitForFunction(() => { const b = document.querySelector('.gw .fl-bar'); return b && !b.innerText.includes('세는 중'); }, null, { timeout: 15000 }).catch(() => {});
  await sleep(300);
};
const closeFlow = async () => { await closeEditor(page, true).catch(() => {}); await closeWin(page).catch(() => {}); await sleep(150); };
/** 호출 흐름 화면 글: 줄마다 이름·호출 글·예상·지난 턴 (PC 는 .fl-pc, 폰은 .fl-ph 카드) */
const flowScreen = () => page.evaluate(() => {
  const bar = document.querySelector('.gw .fl-bar')?.innerText ?? '';
  const pcRows = [...document.querySelectorAll('.gw .fl-pc .fl-line.fl-row')].map((r) => { const st = r.querySelectorAll('.fl-st'); return { name: r.querySelector('.fl-name')?.textContent ?? '', said: r.querySelector('.fl-said')?.innerText.replace(/\n/g, ' ') ?? '', est: st[0]?.textContent ?? '', real: st[1]?.textContent ?? '', on: r.classList.contains('on') }; });
  const phRows = [...document.querySelectorAll('.gw .fl-ph .flc')].map((r) => ({ name: r.querySelector('.fl-name')?.textContent ?? '', said: r.querySelector('.flc-calls')?.textContent ?? '', nums: r.querySelector('.flc-num')?.textContent ?? '', visible: r.getBoundingClientRect().height > 0 }));
  return { bar, pcRows, phRows, all: document.querySelector('.gw .fl-page')?.innerText ?? '' };
});
const rowOf = (fs, name) => fs.pcRows.find((r) => r.name === name);
const barCount = (fs) => { const m = /턴마다 보조 호출\s*(\d+)회(?:\s*\(조건에 따라 최대\s*(\d+)회\))?/.exec(fs.bar); return m ? { sure: Number(m[1]), max: Number(m[2] ?? m[1]) } : null; };
/** 호출 흐름 줄의 조작 단추를 누른다 (fl-do 「동작|값」). 없으면 false */
const flClick = async (value) => {
  const ok = await page.evaluate((v) => { const el = [...document.querySelectorAll('.gw [data-action="fl-do"]')].find((e) => e.dataset.value === v && e.getBoundingClientRect().height > 0); if (!el) return false; el.click(); return true; }, value);
  await sleep(350);
  return ok;
};
const ensureFl = async (s, value) => { const ok = await flClick(value); if (!ok) check(s, `화면에 조작 단추 「${value}」가 있다`, false, '단추 있음', '없음'); return ok; };

/** 한 턴: 본편 요청 → 응답 → 진행 창이 「끝」이 될 때까지 */
async function fullTurn(u, uid, c, cid, { waitEnd = true } = {}) {
  const n0 = await llmN();
  const out = await mainRequest(u, uid);
  const pre = await llmFrom(n0);
  const progMid = await prog();
  await botReply(c, cid);
  const p = waitEnd ? await waitTitle(/^끝/) : await prog();
  await sleep(200);
  const calls = await llmFrom(n0);
  return { out, pre, calls, progMid, prog: p };
}

// 본체를 띄운다 (응답 처리기는 본체가 떠 있어야 돈다)
await openWin(page); await sleep(300);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await closeWin(page); await sleep(200);

// ── 준비: 기록 0명 → 에일린 등장 → 기록 1명 ──
await queue('update', U());
await mainRequest(U1, 'u1'); await botReply(C1, 'c1'); await waitTitle(/^끝/);
await queue('update', U({ entries: [{ who: '에일린', slot: 'state', op: 'upsert', replace: null, text: '사무실에서 신입에게 커피를 건넴', target: null, m: 'c2', quote: '에일린이 종이컵 커피를 내밀며' }], present: ['에일린'] }));
await mainRequest(U2, 'u2'); await botReply(C2, 'c2'); await waitTitle(/^끝/);
await clearQ();
const SNAP1 = await snap();
console.log('준비: 인물', Object.keys((await st())?.people ?? {}));


const tokOf = (v) => Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0;
const pcFlow = {};

// ═══ 갈래 base: 기본 설정 (기록 1명) ═══
if (want('base')) {
  {
    const s = step('기본설정_호출흐름화면');
    await restore(SNAP1);
    await openFlow();
    const fs = await flowScreen();
    pcFlow.base = fs;
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, fs.all);
    const bc = barCount(fs);
    // 기본값: 인물 기록 켬 · Router 모델 · Director 사실형(2차 검색 켬) · 갱신 매 턴 · 인터넷·위키·쇼핑몰 수동 (core/people/settings.ts PP_DEFAULTS, 사용자 11-22 쇼핑몰 자동 호출 기본 수동)
    check(s, '맨 위 띠: 턴마다 보조 3회 (조건에 따라 최대 4회)', bc && bc.sure === 3 && bc.max === 4, { sure: 3, max: 4 }, bc);
    check(s, 'Router 줄 1회 · Director 줄 1회(자료 부족 땐 2회) · 갱신기 1회', /^1회/.test(rowOf(fs, 'Router')?.said) && /^1회/.test(rowOf(fs, 'Director')?.said) && /^1회/.test(rowOf(fs, '갱신기')?.said), '1회·1회·1회', ['Router', 'Director', '갱신기'].map((n) => rowOf(fs, n)?.said));
    check(s, '예상 칸에 Router·Director·갱신기 토큰 숫자', ['Router', 'Director', '갱신기'].every((n) => tokOf(rowOf(fs, n)?.est) > 0), '숫자 셋', ['Router', 'Director', '갱신기'].map((n) => rowOf(fs, n)?.est));
    check(s, '포인트몰 1:1 상담 줄: 관리국(백일몽 아님)이면 호출 없음', /호출 없음/.test(rowOf(fs, '포인트몰 1:1 상담')?.said ?? ''), '호출 없음 (포인트몰은 백일몽 소속만, 사용자 11-08)', rowOf(fs, '포인트몰 1:1 상담')?.said);
    await closeFlow();
    await saveState(s);
  }
  let t;
  {
    const s = step('기본설정_한턴');
    await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', U({ present: ['에일린'] }));
    t = await fullTurn(UT(1), 'u3', CT(1), 'c3');
    writeCalls(s, t.calls, `[본편 요청 뒤 진행 창]\n${JSON.stringify(t.progMid, null, 1)}\n[끝난 뒤 진행 창]\n${JSON.stringify(t.prog, null, 1)}\n\n`);
    check(s, '실제 보조 호출 = 화면 예측 3회 (router·director·update)', kinds(t.calls).join() === 'router,director,update', ['router', 'director', 'update'], kinds(t.calls));
    check(s, '진행 창 칸: 라우터·디렉터·메인·갱신기', t.prog?.cells.map((c) => c.split(':')[0]).join() === '라우터,디렉터,메인,갱신기', ['라우터', '디렉터', '메인', '갱신기'], t.prog?.cells);
    check(s, '본편 요청 뒤: 라우터·디렉터 끝, 메인 도는 중, 갱신기 대기', t.progMid?.cells.join() === '라우터:done,디렉터:done,메인:run,갱신기:wait', '라우터:done,디렉터:done,메인:run,갱신기:wait', t.progMid?.cells);
    check(s, '끝: 제목 「끝」, 호출 4회(보조 3 + 메인 1), 실패 표시 없음', t.prog?.title === '끝' && /호출 4회/.test(t.prog?.meta ?? '') && t.prog?.fail === 'false', '끝 · 호출 4회', [t.prog?.title, t.prog?.meta, t.prog?.fail]);
    await saveState(s);
  }
  {
    const s = step('지난턴_칸');
    await openFlow();
    const fs = await flowScreen();
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, fs.all);
    const reals = ['Router', 'Director', '갱신기'].map((n) => tokOf(rowOf(fs, n)?.real));
    check(s, '지난 턴 칸: Router·Director·갱신기에 실제 보낸 토큰', reals.every((x) => x > 0), '숫자 셋', reals);
    const progSent = (t.prog?.rows ?? []).filter((r) => r.nm !== '메인').map((r) => tokOf(/보냄 ([\d,]+)/.exec(r.dt)?.[1]));
    check(s, '지난 턴 칸 = 진행 창 줄의 「보냄」 (Router·Director·갱신기)', JSON.stringify(reals) === JSON.stringify(progSent), progSent, reals);
    const auxLast = tokOf(/지난 턴: 메인 [\d,]+ \+ 보조 ([\d,]+)/.exec(fs.bar)?.[1]);
    check(s, '맨 위 「보조 지난 턴」 = 줄 합', auxLast === reals.reduce((a, b) => a + b, 0), reals.reduce((a, b) => a + b, 0), auxLast);
    await closeFlow();
  }
  {
    const s = step('미리보기와_실제요청_토큰');
    // 같은 채팅 상태에서: 유저 말을 넣고 화면을 연 뒤 그 상태 그대로 본편 요청 → Router·Director 실제 요청과 비교.
    // 응답을 붙이고(리스너 전) 화면을 연 뒤 리스너 → 갱신기 실제 요청과 비교. (미리 보기는 「마지막 유저 말·마지막 응답」으로 조립: host/people.ts previewPeopleCalls)
    await page.evaluate((u) => window.__chat.message.push({ role: 'user', data: u, chatId: 'u4' }), UT(2));
    await openFlow();
    const f1 = await flowScreen();
    await closeFlow();
    await queue('router', ROUTER(['에일린'])); await queue('director', DIRECTOR([{ who: '에일린', now: 'Friendly senior, second.', must_not_reveal: [], uncertain: [] }])); await queue('update', U({ present: ['에일린'] }));
    const n0 = await llmN();
    await mainRequest(UT(2), 'u4', false);
    await page.evaluate((c) => window.__chat.message.push({ role: 'char', data: c, chatId: 'c4' }), CT(2));
    await openFlow();
    const f2 = await flowScreen();
    await closeFlow();
    await botReply(CT(2), 'c4', false); await waitTitle(/^끝/);
    const calls = await llmFrom(n0);
    writeCalls(s, calls);
    await openFlow();
    const f3 = await flowScreen();
    await closeFlow();
    // 요청 글 전문의 토큰 셈은 미리 보기(메시지마다 셈 합)와 기록([role] 머리 붙여 한 번에 셈)이 조금 다르다 → 몇 토큰 차이는 같은 글로 본다
    const cmp = (name, est, real) => ({ name, est: tokOf(est), real: tokOf(real), diff: tokOf(real) - tokOf(est) });
    const rows = [cmp('Router', rowOf(f1, 'Router')?.est, rowOf(f3, 'Router')?.real), cmp('Director', rowOf(f1, 'Director')?.est, rowOf(f3, 'Director')?.real), cmp('갱신기', rowOf(f2, '갱신기')?.est, rowOf(f3, '갱신기')?.real)];
    writeFileSync(`${OUT}단계${s.n}_${s.name}_비교.txt`, JSON.stringify(rows, null, 1));
    for (const r of rows) check(s, `${r.name}: 미리 보기 예상 ≈ 실제 보낸 토큰 (차 ±8 안)`, r.est > 0 && Math.abs(r.diff) <= 8, `±8 (예상 ${r.est})`, r);
    await saveState(s);
  }
  {
    const s = step('다시굴리기_같은입력');
    // c4 를 빼고 같은 입력으로 다시 요청 (Router·Director 재사용)
    await page.evaluate(() => { window.__chat.message.pop(); });
    await queue('update', U({ present: ['에일린'] }));
    const n0 = await llmN();
    await mainRequest(UT(2), 'u4', false);
    const mid = await prog();
    await botReply(CT(2) + ' (다시)', 'c4b');
    const p = await waitTitle(/^끝/);
    const calls = await llmFrom(n0);
    note(s, '같은 입력 다시 굴리기: Router·Director 재사용(호출 0), 진행 창은 그 칸을 「없음」으로', { calls: kinds(calls), mid: mid?.cells, end: rowsTxt(p) });
    check(s, '다시 굴린 턴의 진행 창: 호출 안 한 라우터·디렉터는 「없음」(skip), 끝', p?.title === '끝' && (p?.cells ?? []).filter((c) => /^(라우터|디렉터):/.test(c)).every((c) => c.endsWith(':skip') || c.endsWith(':done')), '라우터·디렉터 skip(호출 0)', p?.cells);
  }
}

// ═══ 갈래 combo: 호출 흐름 화면 단추로 설정을 바꿔 가며, 화면 예측 = 실제 호출 = 진행 창 칸 ═══
let comboN = 20;
const names = (p) => (p?.rows ?? []).map((r) => r.nm);
async function comboTurn(s, label, clicks, expect) {
  comboN += 1; // 입력을 턴마다 달리 한다 (같은 입력이면 Router·Director 재사용으로 호출이 빠진다)
  await restore(SNAP1);
  await openFlow();
  for (const v of clicks) await ensureFl(s, v);
  const fs = await flowScreen();
  await closeFlow();
  const bc = barCount(fs);
  await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', U({ present: ['에일린'] }));
  const t = await fullTurn(UT(comboN), `u${comboN}`, CT(comboN), `c${comboN}`);
  await sleep(1500);
  const p = await waitTitle(/^끝/, 8000);
  const calls = await llmFrom(0).then((a) => a.slice(-40));
  const turnCalls = t.calls;
  writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `[누른 단추] ${clicks.join(' · ')}\n[호출 흐름 맨 위] ${fs.bar}\n[줄]\n${fs.pcRows.filter((r) => r.said).map((r) => `${r.name}: ${r.said}${r.on ? ' (켜짐)' : ''}`).join('\n')}\n\n[실제 보조 호출] ${kinds(turnCalls).join(', ')}\n${turnCalls.map((c) => `- ${c.kind}: ${c.head.replace(/\n/g, ' ').slice(0, 100)}`).join('\n')}\n\n[진행 창 끝] ${p?.title} / ${p?.meta}\n${rowsTxt(p).join('\n')}\n[폰 점] ${p?.dots?.join(' ')}\n`);
  check(s, `${label}: 화면 맨 위 예측 ${expect.sure}회`, bc?.sure === expect.sure, expect.sure, bc);
  check(s, `${label}: 실제 보조 호출 종류`, JSON.stringify([...new Set(kinds(turnCalls))].sort()) === JSON.stringify([...expect.kinds].sort()), expect.kinds, kinds(turnCalls));
  check(s, `${label}: 진행 창 줄`, JSON.stringify(names(p)) === JSON.stringify(expect.cells), expect.cells, rowsTxt(p));
  if (expect.calls !== undefined) check(s, `${label}: 실제 보조 호출 수 ${expect.calls}`, turnCalls.length === expect.calls, expect.calls, turnCalls.length);
  await saveState(s, { bar: fs.bar });
  return { fs, t, p, turnCalls };
}
if (want('combo')) {
  await comboTurn(step('모두끔_인물기록끔'), '인물 기록 끔(나머지 기본)', ['pp-set|on=0'], { sure: 0, kinds: [], cells: ['메인'], calls: 0 });
  await comboTurn(step('인물켬_코드Router_메모형_수동갱신'), '코드 Router·메모형·수동', ['pp-set|router=code', 'pp-set|director=note', 'pp-set|when=manual'], { sure: 0, kinds: [], cells: ['메인'], calls: 0 });
  // 전부 켬 (같은 보조 모델 → 괴담톡·게시판 넷이 한 요청). 위키는 제목 호출이 실패하면 본문을 안 부르므로 호출 수는 화면 예측 - 1
  const all = ['pp-set|director=scene', 'pp-set|tidy=separate', 'set-asset|1', 'set-asset-model|aux', 'ph-cfg|auto=1', 'fam-set|b:gn:lazy=0', 'fam-set|b:gal:lazy=0', 'fam-set|b:wpf:lazy=0', 'fam-set|b:sm:lazy=0', 'ph-cfg|view_auto=turn', 'wiki-auto|turn', 'fam-set|s:cos:auto=turn'];
  await comboTurn(step('전부켬_한번에요청켬'), '전부 켬·통합', all, { sure: 9, kinds: ['router', 'director', 'update', 'asset', 'phone', 'wiki', 'mall'], cells: ['라우터', '디렉터', '메인', '갱신기', '이미지 태그', '위키', '통합', '관전', '우주 쇼핑몰'] });
  await comboTurn(step('전부켬_한번에요청끔'), '전부 켬·통합 끔', [...all, 'fam-set|b:gn:joint=0'], { sure: 13, kinds: ['router', 'director', 'update', 'asset', 'phone', 'gnet', 'wiki', 'mall'], cells: ['라우터', '디렉터', '메인', '갱신기', '이미지 태그', '위키', '괴담톡', '괴담넷', '괴담갤', '세정게', '연어 마켓', '관전', '우주 쇼핑몰'] });
}

// ═══ 갈래 fail: 시간 초과·꼴 틀린 답·실패·빈 답이 진행 창에 어떻게 보이나 ═══
if (want('fail')) {
  {
    const s = step('Router_시간초과');
    await restore(SNAP1);
    await vars({ $pp_router_timeout: '5' });
    await queue('router', ROUTER(['에일린'])); await delay('router', 7500); await queue('director', DIR1); await queue('update', U({ present: ['에일린'] }));
    const n0 = await llmN();
    const t0 = Date.now();
    const out = await mainRequest(UT(6), 'u6');
    const waited = Date.now() - t0;
    const mid = await prog();
    await botReply(CT(6), 'c6');
    const p1 = await prog();
    const p = await waitTitle(/^끝/, 15000);
    const calls = await llmFrom(n0);
    writeCalls(s, calls, `[본편 요청이 기다린 시간] ${waited}ms (Router 시간 제한 5초)\n[본편 요청 뒤] ${JSON.stringify(mid?.cells)} ${mid?.title}\n[응답 붙은 직후] ${JSON.stringify(rowsTxt(p1))}\n[끝] ${p?.title} ${p?.meta}\n${rowsTxt(p).join('\n')}\n\n`);
    writeFileSync(`${OUT}단계${s.n}_${s.name}_본편.txt`, fmtMsgs(out));
    check(s, '본편은 Router 시간 제한(5초)에서 넘어감 (Router 답 안 씀)', waited >= 4500 && waited < 7400, '5초 안팎', waited);
    check(s, '본편 요청 뒤 진행 창: 라우터 칸이 「시간 초과·실패」로 보인다 (사용자에게 알린 남은 문제 11-22)', /^라우터:(fail)/.test(mid?.cells?.[0] ?? ''), '라우터:fail', mid?.cells);
    check(s, '끝: 라우터 칸이 성공으로 바뀌지 않고 「1건 실패」', /실패/.test(p?.title ?? '') && (p?.cells?.[0] ?? '').endsWith(':fail'), '끝 · 1건 실패, 라우터 fail', [p?.title, p?.cells]);
    await delay('router', 80);
    await vars({ $pp_router_timeout: '' });
  }
  {
    const s = step('Router_꼴틀린답');
    await restore(SNAP1);
    await queue('router', '죄송하지만 고를 수 없습니다.'); await queue('director', DIR1); await queue('update', U({ present: ['에일린'] }));
    const t = await fullTurn(UT(7), 'u7', CT(7), 'c7');
    writeCalls(s, t.calls, `[끝] ${t.prog?.title}\n${rowsTxt(t.prog).join('\n')}\n\n`);
    note(s, 'Router 답을 못 읽어 코드 Router 로 넘어간 턴의 진행 창 (호출은 성공)', { title: t.prog?.title, rows: rowsTxt(t.prog) });
  }
  {
    const s = step('갱신기_꼴틀린답_재시도1');
    await restore(SNAP1);
    await vars({ $gen_retries: '1' });
    await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', '형식 없는 글', '또 형식 없는 글');
    const t = await fullTurn(UT(8), 'u8', CT(8), 'c8');
    writeCalls(s, t.calls, `[끝] ${t.prog?.title} ${t.prog?.meta}\n${rowsTxt(t.prog).join('\n')}\n\n`);
    const up = t.calls.filter((c) => c.kind === 'update').length;
    check(s, '갱신기 2회(첫 요청 + 형식 오류 재시도 1)', up === 2, 2, up);
    note(s, '두 번 다 못 읽어 기록이 안 바뀐 턴의 진행 창', { title: t.prog?.title, rows: rowsTxt(t.prog) });
    await vars({ $gen_retries: '0' });
  }
  {
    const s = step('갱신기_모델실패');
    await restore(SNAP1);
    await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', '!FAIL');
    const t = await fullTurn(UT(9), 'u9', CT(9), 'c9');
    check(s, '진행 창: 갱신기 실패, 「끝 · 1건 실패」, 실패 표시 켬', t.prog?.title === '끝 · 1건 실패' && t.prog?.fail === 'true' && t.prog?.cells?.includes('갱신기:fail'), '끝 · 1건 실패', [t.prog?.title, t.prog?.cells, t.prog?.fail]);
    check(s, '실패 줄에 까닭 글', /실패/.test((t.prog?.rows ?? []).find((r) => r.nm === '갱신기')?.dt ?? ''), '모델 요청에 실패했어요', (t.prog?.rows ?? []).find((r) => r.nm === '갱신기'));
  }
  {
    const s = step('갱신기_빈답');
    await restore(SNAP1);
    await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', '!EMPTY');
    const t = await fullTurn(UT(10), 'u10', CT(10), 'c10');
    check(s, '빈 답: 갱신기 실패로 보임', t.prog?.cells?.includes('갱신기:fail') && /빈 응답/.test((t.prog?.rows ?? []).find((r) => r.nm === '갱신기')?.dt ?? ''), '갱신기:fail (빈 응답)', [t.prog?.cells, (t.prog?.rows ?? []).find((r) => r.nm === '갱신기')]);
  }
}

// ═══ 갈래 late: 앞 턴의 뒤 작업(인터넷·위키·쇼핑몰 자동 호출)이 도는 중에 다음 턴을 보냄 ═══
if (want('late')) {
  const s = step('뒤작업_도는중_다음턴');
  await restore(SNAP1);
  // 인물 기록은 끄고 위키·우주 쇼핑몰만 매 턴 (body.ts: 위키 → 쇼핑몰 차례로, 리스너는 이 둘을 기다리지 않는다)
  await openFlow();
  for (const v of ['pp-set|on=0', 'wiki-auto|turn', 'fam-set|s:cos:auto=turn']) await ensureFl(s, v);
  await closeFlow();
  await delay('wiki', 2500);
  const n0 = await llmN();
  await mainRequest(UT(11), 'u11');
  await botReply(CT(11), 'c11'); // 리스너가 돌아옴 (위키 호출은 도는 중)
  const pA = await prog();
  // 실제 Risu 는 리스너가 끝나면 다음 전송을 받는다 → 바로 다음 턴
  const outB = await mainRequest(UT(12), 'u12');
  const pB0 = await prog();
  await sleep(3500); // 앞 턴의 위키 실패 → 앞 턴의 쇼핑몰 호출이 이 사이에 시작·끝
  const pB1 = await prog();
  const callsMid = await llmFrom(n0);
  await delay('wiki', 80);
  await botReply(CT(12), 'c12');
  const pB2 = await waitTitle(/^끝/, 10000);
  const calls = await llmFrom(n0);
  writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `[턴 A 응답 직후] ${pA?.title} ${JSON.stringify(rowsTxt(pA))}\n[턴 B 본편 요청 직후] ${pB0?.title} ${JSON.stringify(rowsTxt(pB0))}\n[3.5초 뒤 (B 응답 전)] ${pB1?.title} ${JSON.stringify(rowsTxt(pB1))}\n[그때까지 호출] ${callsMid.map((c) => `${c.kind}@${c.at}`).join(', ')}\n[턴 B 끝] ${pB2?.title} ${pB2?.meta}\n${rowsTxt(pB2).join('\n')}\n[모든 호출] ${kinds(calls).join(', ')}\n`);
  const mallB1 = (pB1?.rows ?? []).find((r) => r.nm === '우주 쇼핑몰');
  check(s, '턴 B 응답 전: 턴 B 진행 창의 「우주 쇼핑몰」 칸은 아직 대기 (앞 턴 호출이 붙지 않음)', mallB1 && mallB1.s === 'wait', '우주 쇼핑몰=wait', mallB1);
  const mallB2 = (pB2?.rows ?? []).find((r) => r.nm === '우주 쇼핑몰');
  check(s, '턴 B 끝: 우주 쇼핑몰 칸은 턴 B 호출 1회만', mallB2 && !/· 2회/.test(mallB2.dt), '1회', mallB2);
  check(s, '턴 B 끝: 「호출 N회」 = 턴 B 의 위키 1 + 쇼핑몰 1 + 메인 1 = 3회', /호출 3회/.test(pB2?.meta ?? ''), '호출 3회', pB2?.meta);
  await openFlow();
  const fs = await flowScreen();
  await closeFlow();
  writeFileSync(`${OUT}단계${s.n}_${s.name}_호출흐름.txt`, fs.all);
  note(s, '호출 흐름 「지난 턴」 우주 쇼핑몰 칸', rowOf(fs, '우주 쇼핑몰'));
  await clearQ();
}

// ═══ 갈래 manual: 턴과 상관없는 단추 호출(AI 상담)의 진행 창 ═══
if (want('manual')) {
  const s = step('수동호출_AI상담');
  await restore(SNAP1);
  await sleep(2500); // 앞 턴이 닫힐 시간
  await openWin(page); await sleep(200);
  await openEditor(page, 'manage:flow');
  await page.evaluate(() => document.querySelector('.gw [data-action="ai-toggle"]')?.click()); await sleep(400);
  await delay('other', 1500);
  await queue('other', '<say>호출 흐름 화면에서 Router 를 끄면 메인 요청 전 호출이 줄어요.</say>');
  await page.evaluate(() => { const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = '호출을 줄이고 싶어'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => document.querySelector('.gw-ai [data-action="ai-send"]')?.click());
  await sleep(700);
  const pRun = await prog();
  await sleep(2500);
  const pEnd = await prog();
  writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `[도는 중] ${JSON.stringify(pRun, null, 1)}\n[끝] ${JSON.stringify(pEnd, null, 1)}\n`);
  check(s, '단추 호출은 「수동 호출」 카드', /수동 호출/.test(pRun?.grip ?? ''), '수동 호출', pRun?.grip);
  check(s, '채팅 턴과 상관없는 단추 작업은 폰 막대 점(라우터·디렉터·메인·갱신기·인터넷)을 켜지 않는다 (core/progress.ts StageGroup other 주석, 릴리스 점검 11-09 상점)', (pRun?.dots ?? []).every((d) => d.endsWith(':skip')), '점 모두 skip', pRun?.dots);
  await page.evaluate(() => document.querySelector('.gw [data-action="ai-toggle"]')?.click()).catch(() => {});
  await closeFlow();
  await clearQ();
}

// ═══ 갈래 mixed: 턴이 열려 있는 동안 누른 단추 호출(AI 상담), 채팅을 옮긴 뒤 앞 채팅의 뒤 작업 ═══
if (want('mixed')) {
  {
    const s = step('본편대기중_AI상담');
    await restore(SNAP1);
    await sleep(2000);
    await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', U({ present: ['에일린'] }));
    await queue('other', '<say>Router 를 끄면 호출이 하나 줄어요.</say>');
    const n0 = await llmN();
    await mainRequest(UT(40), 'u40');
    // 본편 응답을 기다리는 동안 설정 창에서 AI 상담에 묻는다
    await openWin(page); await sleep(200);
    await openEditor(page, 'manage:flow');
    await page.evaluate(() => document.querySelector('.gw [data-action="ai-toggle"]')?.click()); await sleep(400);
    await page.evaluate(() => { const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = '호출을 줄이고 싶어'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => document.querySelector('.gw-ai [data-action="ai-send"]')?.click());
    await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === false, null, { timeout: 15000 }).catch(() => {});
    await sleep(300);
    await page.evaluate(() => document.querySelector('.gw [data-action="ai-toggle"]')?.click()).catch(() => {});
    await closeFlow();
    await botReply(CT(40), 'c40');
    const p = await waitTitle(/^끝/);
    const calls = await llmFrom(n0);
    await openFlow();
    const fs = await flowScreen();
    await closeFlow();
    const sumRows = ['Router', 'Director', '갱신기'].map((n) => tokOf(rowOf(fs, n)?.real)).reduce((a, b) => a + b, 0);
    const auxLast = tokOf(/지난 턴: 메인 [\d,]+ \+ 보조 ([\d,]+)/.exec(fs.bar)?.[1]);
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `[호출] ${kinds(calls).join(', ')}\n[진행 창 끝] ${p?.title} / ${p?.meta}\n${rowsTxt(p).join('\n')}\n[폰 점] ${p?.dots?.join(' ')}\n\n[호출 흐름 맨 위] ${fs.bar}\n[Router+Director+갱신기 지난 턴 합] ${sumRows}\n`);
    check(s, '채팅 턴 진행 창에 단추 호출(AI 상담) 줄이 끼지 않음', !names(p).includes('AI 상담'), 'AI 상담 줄 없음', rowsTxt(p));
    check(s, '「호출 N회」 = 이 턴 보조 3 + 메인 1 = 4회', /호출 4회/.test(p?.meta ?? ''), '호출 4회', p?.meta);
    check(s, '호출 흐름 「보조 지난 턴」 = 이 턴 줄(Router·Director·갱신기) 합 (단추 호출은 뺌: flowpage.ts lastTurn·real 주석)', auxLast === sumRows, sumRows, auxLast);
  }
  {
    const s = step('채팅옮김_앞채팅_뒤작업');
    await restore(SNAP1);
    await sleep(2000);
    await openFlow();
    for (const v of ['pp-set|on=0', 'wiki-auto|turn', 'fam-set|s:cos:auto=turn']) await ensureFl(s, v);
    await closeFlow();
    await delay('wiki', 2500);
    await mainRequest(UT(41), 'u41');
    await botReply(CT(41), 'c41');
    // 다른 채팅으로 옮김 (body.ts 감시가 1초마다 채팅 번호를 본다)
    await page.evaluate(() => { window.risuai.getCurrentChatIndex = async () => 1; });
    await sleep(1500);
    const p0 = await prog();
    await sleep(3000);
    const p1 = await prog();
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `[옮긴 직후] ${JSON.stringify(p0)}\n[3초 뒤] ${JSON.stringify(p1)}\n`);
    // 가짜 Risu 에서 채팅 번호만 바꿔서는 본체 감시가 채팅을 옮긴 것으로 보지 않았다(턴이 안 치워짐) → 판정하지 않고 적기만 한다 (찾은문제.md 「못 돌린 것」)
    note(s, '채팅 번호를 바꾼 뒤 진행 창 (가짜 Risu 한계로 판정 안 함)', { 옮긴직후: [p0?.grip, p0?.title], 뒤: [p1?.grip, p1?.title, rowsTxt(p1)] });
    await page.evaluate(() => { window.risuai.getCurrentChatIndex = async () => 0; });
    await delay('wiki', 80);
    await sleep(1500);
  }
}

// ═══ 갈래 phone: 폰 크기 (390×844) — 진행 막대 점·카드, 호출 흐름 카드 ═══
if (want('phone')) {
  const chatP = await snap();
  await page.close();
  ({ page, errors } = await boot(b, fx, SNAP1, 'phone', { store }));
  await installMock();
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(300);
  {
    const s = step('폰_호출흐름_카드');
    await openFlow();
    const fs = await flowScreen();
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, fs.all);
    const card = (n) => fs.phRows.find((r) => r.name === n);
    check(s, '폰 카드: Router·Director·갱신기 호출 글이 PC 와 같은 말', /^1회/.test(card('Router')?.said ?? '') && /^1회/.test(card('Director')?.said ?? '') && /^1회/.test(card('갱신기')?.said ?? ''), '1회…', ['Router', 'Director', '갱신기'].map((n) => card(n)?.said));
    check(s, '폰 맨 위 띠도 3회 (최대 4회)', barCount(fs)?.sure === 3 && barCount(fs)?.max === 4, { sure: 3, max: 4 }, barCount(fs));
    check(s, '폰 카드가 보인다 (PC 줄은 숨김)', fs.phRows.filter((r) => r.visible).length > 5, '>5', fs.phRows.filter((r) => r.visible).length);
    await page.screenshot({ path: `${OUT}단계${s.n}_${s.name}.png` });
    await closeFlow();
  }
  {
    const s = step('폰_진행막대');
    await queue('router', ROUTER(['에일린'])); await queue('director', DIR1); await queue('update', U({ present: ['에일린'] }));
    await delay('update', 1500);
    const n0 = await llmN();
    await mainRequest(UT(13), 'u13');
    const mid = await prog();
    await page.screenshot({ path: `${OUT}단계${s.n}_${s.name}_도는중.png` });
    await botReply(CT(13), 'c13');
    const p = await waitTitle(/^끝/);
    const calls = await llmFrom(n0);
    check(s, '폰: 막대 모양(x-goei-phone true), 카드는 접힘', mid?.phone === 'true' && mid?.open === 'false', 'phone·접힘', [mid?.phone, mid?.open]);
    check(s, '폰 점: 본편 대기 중 라우터·디렉터 done, 메인 run, 갱신기 wait, 인터넷 skip', mid?.dots?.join() === '라우터:done,디렉터:done,메인:run,갱신기:wait,인터넷:skip', '라우터:done,디렉터:done,메인:run,갱신기:wait,인터넷:skip', mid?.dots);
    check(s, '폰 점: 끝나면 다섯 점 상태가 실제 호출과 같음', p?.dots?.join() === '라우터:done,디렉터:done,메인:done,갱신기:done,인터넷:skip' && kinds(calls).join() === 'router,director,update', '네 점 done', [p?.dots, kinds(calls)]);
    const box = await page.locator('[x-goei-prog] [data-dot]').boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + 20);
    await sleep(600);
    const o = await prog();
    await page.screenshot({ path: `${OUT}단계${s.n}_${s.name}_카드.png` });
    check(s, '폰: 막대를 누르면 PC 와 같은 카드(라우터·디렉터·메인·갱신기)', o?.open === 'true' && o?.cells.map((c) => c.split(':')[0]).join() === '라우터,디렉터,메인,갱신기', '펼침·네 칸', [o?.open, o?.cells]);
    await delay('update', 80);
  }
}

// ═══ 갈래 mainfail: 본편 요청이 실패해 응답이 안 붙음 (Risu 는 실패를 알려 주지 않는다) ═══
// 설정 「화면」 시간: 메인 응답 대기 1분(최소), 진행 감시 3분. Risu 입력창에 보내기 단추가 돌아온 상태(.button-icon-send = 만드는 중 아님)
if (want('mainfail')) {
  await page.close();
  ({ page, errors } = await boot(b, fx, SNAP1, 'pc', { store: { ...store, 'p:goei:prefs': JSON.stringify({ times: { mainWait: 1, progWatch: 3 } }) } }));
  await installMock();
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(300);
  const s = step('본편실패_응답안옴');
  await queue('router', ROUTER(['에일린'])); await queue('director', DIR1);
  await mainRequest(UT(30), 'u30');
  // Risu 가 요청 실패를 보여 주고 보내기 단추가 돌아옴
  await page.evaluate(() => { const b = document.createElement('button'); b.className = 'button-icon-send'; b.textContent = '보내기'; document.querySelector('.default-chat-screen').appendChild(b); });
  const p0 = await prog();
  const dot = await page.locator('[x-goei-prog] [data-dot]').boundingBox().catch(() => null);
  if (p0?.open !== 'true' && dot) await page.mouse.click(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await sleep(500);
  const t0 = Date.now();
  await sleep(66000); // 메인 응답 대기(1분)가 지나 기다림이 꺼진 뒤
  const p1 = await prog();
  await page.mouse.click(300, 700); // 창 밖 누르기
  await sleep(600);
  const p1b = await prog();
  await sleep(Math.max(0, 3 * 60000 + 4000 - (Date.now() - t0))); // 진행 감시(3분) 뒤
  const p2 = await prog();
  writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `[요청 직후] ${JSON.stringify(p0)}\n[66초 뒤 (메인 응답 대기 1분 지남)] ${JSON.stringify(p1)}\n[창 밖 누른 뒤] open=${p1b?.open}\n[3분 4초 뒤 (진행 감시)] ${JSON.stringify(p2)}\n`);
  check(s, '응답 없이 기다림이 꺼진 뒤(메인 응답 대기 1분, 보내기 단추 돌아옴) 진행 창도 「응답 없음」으로 닫힌다', !/메인 응답 대기/.test(p1?.title ?? '') && p1?.run === 'false', '응답 없음·도는 중 아님', [p1?.title, p1?.meta, p1?.run]);
  check(s, 'PC: 실패한 턴의 펼친 카드는 창 밖을 누르면 접힌다', p1b?.open === 'false', 'open=false', p1b?.open);
  check(s, '진행 감시(3분)가 지나면 「응답 없음」 실패로 닫힘', /응답 없음|실패/.test(p2?.title ?? '') && p2?.fail === 'true', '응답 없음', [p2?.title, p2?.fail]);
}

writeFileSync(`${OUT}결과.json`, JSON.stringify({ pass: results.filter((r) => r.ok).length, total: results.length, results, notes, errors }, null, 2));
console.log(`\n결과: ${results.filter((r) => r.ok).length}/${results.length} 통과, 페이지 오류 ${errors.length}`);
await b.close();
