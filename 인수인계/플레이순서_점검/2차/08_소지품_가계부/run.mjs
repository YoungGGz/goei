// 플레이 순서 점검 2차 · 08 소지품·가계부·장착 (지침: ../../GPT_점검지침_초안.md 3판)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄우고 화면 단추를 눌러 간다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(갱신기), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 단계마다 기대값(근거)을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과_<갈래>.json
// 사용법: (fixture 가 있으면) node 인수인계/플레이순서_점검/2차/08_소지품_가계부/run.mjs [pc|branch|phone|icon|all]
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PART = process.argv[2] ?? 'all';
if (PART === 'all') rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
let stepNo = { pc: 0, branch: 100, phone: 200, icon: 300 }[PART] ?? 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');

// ── 장면 ──
const ST = (time, bal) => `[▣|2025.03.14|${time}|🌙|6°C|관리국 본부|없음|없음|없음|관리국/신입|${bal}]`;
const R = (text, time, bal) => `${text}\n${ST(time, bal)}`;
const mk = (id, name, x = {}) => ({ id, name, desc: '', effect: '', use: false, state: 'ok', from: 'manual', anchor: '', at: '2026-11-22T00:00:00Z', ...x });
const START_ITEMS = [
  mk('i_pain', '진통제', { desc: '알약 세 알', use: true, uses: 3, weight: 0.012, icon: '의료/진통제/painkiller' }),
  mk('i_flash', '손전등', { desc: '건전지 새것', use: true, equip: 'weapon', weight: 0.35, icon: '기기/손전등/flashlight' }),
  mk('i_vest', '방검 조끼', { desc: '얇은 방검 조끼', equip: 'gear', slot: 0, weight: 2.4, icon: '옷/조끼/vest' }),
  mk('i_mask', '방독면', { desc: '필터 하나 끼움', use: true, equip: 'gear', weight: 0.6, icon: '도구/방독면/gas mask' }),
  mk('i_tal1', '부적 묶음', { desc: '노란 부적 두 장', use: true, uses: 2, weight: 0.005, icon: '부적/부적/talisman' }),
  mk('i_tal2', '낡은 부적', { desc: '귀퉁이가 해진 부적', use: true, uses: 1, weight: 0.005, icon: '부적/부적/talisman' }),
  mk('i_file', '사건 파일', { desc: '유계역 건', weight: 0.3, icon: '서류/파일/file' }),
  mk('i_box', '봉인 상자', { desc: '쇠사슬로 감은 상자', weight: 24, icon: '봉인/상자/box' }),
  mk('i_umb', '검은 우산', { desc: '접이식', use: true, equip: 'weapon', weight: 0.45, icon: '도구/우산/umbrella' }),
  mk('i_bat', '야구방망이', { desc: '나무 방망이', use: true, equip: 'weapon', weight: 0.9, icon: '무기/야구방망이/baseball bat' }),
];
const BASE_VARS = (extra = {}) => ({
  $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_asset_on: '0',
  $pp_on: '1', $pp_router: 'code', $pp_director: 'off', $pp_keep_raw: '1', $st_wallet_edit: '1',
  $st_wallet: JSON.stringify({ start: 140000, log: [] }), $st_items: JSON.stringify({ list: START_ITEMS, log: [] }), ...extra,
});
const C1 = R('관리국 본부 휴게실. 형광등이 깜빡였다. 사물함 앞에 가방이 놓여 있었다.', '09:00 PM', 140000);
const chatBase = (extra = {}) => ({ message: [{ role: 'user', data: '휴게실에서 장비를 점검한다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }], scriptstate: BASE_VARS(extra) });

// 갱신기 가짜 답 (빈 기록 + 소지품·거래). "@M" 은 그 요청 자료의 마지막 확정 응답 꼬리표로 바뀐다
const U = (o = {}) => JSON.stringify({ entries: [], axes_init: [], observations: [], cues: [], address: [], identity: { faction: null, rank: null }, new_people: [], renames: [], docs: [], present: [], issues: [{ code: 'no_canonical_change', who: null, reason: '점검용' }], ...o });

let page, errors = [];
const b = await launch();
async function start(chat0, vp = 'pc') {
  if (page) await page.close();
  ({ page, errors } = await boot(b, fx, chat0, vp, { store: { 'p:goei:user-name': '한서준', 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } }));
  await installMock();
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
}
const installMock = () => page.evaluate(() => {
  window.__q = { update: [], other: [] };
  window.__calls.llm = [];
  const kindOf = (msgs) => (String(msgs?.[0]?.content ?? '').startsWith('# People Record Updater') ? 'update' : 'other');
  const dataOf = (msgs) => { const t = String(msgs?.[1]?.content ?? ''); try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return {}; } };
  window.risuai.runLLMModel = async (o) => {
    const kind = kindOf(o.messages);
    window.__calls.llm.push({ kind, mode: o.mode, messages: JSON.parse(JSON.stringify(o.messages)) });
    if (kind === 'update' && window.__gate) await window.__gate.p;
    await new Promise((r) => setTimeout(r, 40));
    let next = window.__q[kind].shift();
    if (next === undefined || next === '!FAIL') { window.__calls.llm.at(-1).reply = '(실패로 돌려줌)'; return { type: 'fail', result: 'mock fail' }; }
    const d = dataOf(o.messages);
    const conf = (d.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').map((x) => x.m);
    if (conf.length) next = next.replaceAll('"@M"', JSON.stringify(conf.at(-1))).replaceAll('"@MF"', JSON.stringify(conf[0]));
    window.__calls.llm.at(-1).reply = next;
    return { type: 'success', result: next };
  };
});
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const setVars = (o) => page.evaluate((o) => { Object.assign(window.__chat.scriptstate, o); }, o);
const items = async () => J(await vars(), '$st_items');
const useQ = async () => J(await vars(), '$st_item_use') ?? [];
const aliveKeys = () => page.evaluate(() => window.__chat.message.map((m, i) => m.chatId || `#${i + 1}`));
/** 화면 쪽과 같은 셈: 살아 있는 줄·남은 횟수 (core/items.ts liveItems·itemLeft 를 그대로 옮기지 않고 결과만 본다: 화면 칸 글로) */
const ledger = async () => { const w = J(await vars(), '$st_wallet') ?? { start: 0, log: [] }; const alive = new Set(await aliveKeys()); const live = w.log.filter((e) => !e.anchor || alive.has(e.anchor)); return { start: w.start, live, bal: w.start + live.reduce((n, e) => n + e.amount, 0) }; };
const usesLive = async (id) => { const it = await items(); const alive = new Set(await aliveKeys()); return it.log.filter((l) => l.item === id && l.what === 'use' && (!l.anchor || alive.has(l.anchor))); };
const leftOf = async (id) => { const it = await items(); const row = it.list.find((x) => x.id === id); const alive = new Set(await aliveKeys()); let n = 0; for (const l of it.log) if (l.item === id && (!l.anchor || alive.has(l.anchor))) n += l.what === 'use' ? l.n ?? 1 : l.what === 'get' && l.n ? -l.n : 0; for (const k of it.list) if (k.mergedInto === id) n -= Math.max(0, (k.uses ?? 0) - it.log.filter((l) => l.item === k.id && l.what === 'use' && (!l.anchor || alive.has(l.anchor))).reduce((a, l) => a + (l.n ?? 1), 0)); return row?.uses === undefined ? undefined : Math.max(0, row.uses - n); };
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const restore = (c) => page.evaluate((c) => { window.__chat = JSON.parse(JSON.stringify(c)); }, c);
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => /^\$(st_items|st_item_use|st_item_use_at|st_item_use_prev|st_wallet|it_)/.test(k)).map(([k, v]) => [k, J({ v }, 'v') ?? v])), messages: await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: String(m.data).slice(0, 90) }))) }, null, 2));
const queueU = (...t) => page.evaluate((t) => { window.__q.update.push(...t); }, t);
const clearQ = () => page.evaluate(() => { window.__q.update = []; window.__q.other = []; });
const llmN = () => page.evaluate(() => window.__calls.llm.length);
const llmFrom = (n) => page.evaluate((n) => window.__calls.llm.slice(n), n);
const dataOf = (c) => { const t = String(c?.messages?.[1]?.content ?? ''); try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; } };
const writeMain = (s, out, extra = '', suffix = '_본편') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(out)}\n`);
const writeCalls = (s, calls, suffix = '_갱신기') => { if (calls.length) writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, calls.map((c, i) => `════ 보조 호출 ${i + 1}: ${c.kind} (${c.mode}) ════\n${fmtMsgs(c.messages)}\n\n════ 넣은 가짜 답 ════\n${c.reply ?? '(없음)'}`).join('\n\n')); };
/** 본편 요청: 유저 메시지를 채팅에 넣고 beforeRequest 를 돌린다 */
const mainRequest = async (userText, uid, push = true) => page.evaluate(async ([t, id, push]) => {
  if (push) window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid, push]);
/** 다시 굴리기 요청: 마지막 응답을 지운 채(Risu 가 먼저 지운다) beforeRequest */
const rerollRequest = async () => page.evaluate(async () => {
  window.__chat.message.pop();
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
});
/** 본편 응답이 붙음 → output 리스너 (인물 갱신은 설정 「병렬」 끔이라 리스너 안에서 끝까지 기다린다) */
const botReply = async (text, cid) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(300); };
const invOf = (out) => out.find((m) => m.role === 'system' && /^\[(Inventory|Shop)\]/.test(m.content))?.content ?? '';
const thisTurn = (inv) => /This turn:[^\n]*/.exec(inv)?.[0] ?? '';
const recent = (inv) => /Recently:[^\n]*/.exec(inv)?.[0] ?? '';
const statusOf = (out) => out.find((m) => m.role === 'system' && m.content.startsWith('[Previous status]'))?.content ?? '';
const invBeforeLastUser = (out) => { const i = out.findIndex((m) => m.role === 'system' && /^\[Inventory\]/.test(m.content)); const u = out.map((m) => m.role).lastIndexOf('user'); return i >= 0 && i < u && out.slice(i + 1, u).every((m) => m.role === 'system'); };

// ── 화면 ──
const vp = { cur: 'pc' };
const openItems = async () => {
  await openWin(page); await sleep(250);
  // 이미 소지품 탭이면 누르지 않는다 (PC 왼쪽 메뉴는 보고 있는 탭을 한 번 더 누르면 상황판으로 간다, app.ts nav-tab)
  if (!(await page.$('.gx-items'))) { await page.evaluate(() => document.querySelector('[data-action="nav-tab"][data-value="items"], [data-action="tab"][data-value="items"]')?.click()); await sleep(400); }
  if (await page.$('.it-tabs [data-action="items-sub"][data-value="items"]:not(.on)')) { await page.evaluate(() => document.querySelector('.it-tabs [data-action="items-sub"][data-value="items"]')?.click()); await sleep(300); }
};
const clickSel = async (sel) => {
  const el = await page.$(sel);
  if (!el) return false;
  if (await el.isDisabled().catch(() => false)) return 'disabled';
  await page.evaluate((q) => document.querySelector(q)?.click(), sel);
  await sleep(350);
  return true;
};
const openCell = (id) => clickSel(`[data-action="items-open"][data-value="${id}"]`);
const pop = () => page.evaluate(() => document.querySelector('.it-pop')?.innerText ?? '');
const toastText = () => page.evaluate(() => [...document.querySelectorAll('.gx-items ~ * , .gx-toast, [class*="toast"], .gx-err')].map((e) => e.innerText).join(' | '));
const bodyText = () => page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
const closePop = () => clickSel('.it-pop [data-action="items-close"]');
/** 채팅 속 마지막 메시지 아래 「사용」 칩 (display 처리기가 붙인 자리 + 본 화면 style) */
const chipState = () => page.evaluate(async () => {
  document.querySelector('#chatmock')?.remove();
  const list = document.createElement('div');
  list.id = 'chatmock';
  list.style.cssText = 'position:fixed;left:16px;right:16px;top:60px;z-index:1;display:flex;flex-direction:column-reverse';
  for (const m of [...window.__chat.message].reverse()) { const d = document.createElement('div'); d.className = 'chat-message-container'; d.innerHTML = await window.__calls.handlers.display(m.data); list.appendChild(d); }
  document.body.appendChild(list);
  await new Promise((r) => setTimeout(r, 200));
  const last = list.querySelector('[data-goei-card="use"]');
  const vis = (e) => e && getComputedStyle(e).display !== 'none';
  const out = { shown: vis(last), label: last ? getComputedStyle(last.querySelector('[data-gu-label]'), '::before').content : '', names: last ? [...last.querySelectorAll('[data-gu]')].filter(vis).map((e) => getComputedStyle(e, '::before').content.replace(/"/g, '')) : [], x: last ? [...last.querySelectorAll('[data-gu-x]')].some((e) => vis(e) && e.offsetParent) : false };
  list.remove();
  return out;
});

const usesLine = (inv) => /uses [^;\n]*/.exec(thisTurn(inv))?.[0] ?? '';

// ════════════════════════════ PC 대표 경로 ════════════════════════════
if (PART === 'all' || PART === 'pc') {
  vp.cur = 'pc';
  await start(chatBase(), 'pc');
  // 01 소지품 탭
  {
    const s = step('소지품탭_첫화면');
    await openItems();
    const st = await page.evaluate(() => ({ stat: document.querySelector('.it-stat')?.getAttribute('title') ?? '', wgt: document.querySelector('.it-wgt')?.getAttribute('title') ?? '', over: document.querySelector('.it-wgt')?.classList.contains('over'), gear0: document.querySelector('[data-drop="equip:gear:0"]')?.getAttribute('aria-label') ?? '', cells: document.querySelectorAll('.it-grid .it-c:not(.empty)').length, slots: document.querySelectorAll('.it-eqslots .it-slot').length }));
    // 기대: 격자 9칸(조끼는 장착 칸), 칸 수 「9 / 16」, 무게 합 = 0.036+0.35+2.4+0.6+0.01+0.005+0.3+24+0.45+0.9 = 29.051 → 29.1 / 25kg 넘음 (사용자 11-08: 장착 포함 전부 합계, 초과하면 색)
    check(s, '칸 수 9/16 (장착 칸에 놓인 조끼 뺌)', /칸 9 \/ 16/.test(st.stat) && st.cells === 9, '칸 9 / 16', st, '사용자 11-08 칸 수는 격자만');
    check(s, '무게 합 29.1kg / 25kg, 넘음 표시', /무게 29\.1kg \/ 소지 한도 25kg \(4\.1kg 넘음\)/.test(st.wgt) && st.over, '무게 29.1kg / 25kg (4.1kg 넘음)', st.wgt, '사용자 11-08 무게: 장착 포함 합계, 넘으면 색 진하게');
    check(s, '장착 칸 손2·장비6 = 8칸, 조끼는 장비 첫 칸', st.slots === 8 && st.gear0.includes('방검 조끼'), '8칸·조끼', st, 'itemtraits EQUIP_SLOTS 주석 사용자 11-12 장비 6');
    await saveState(s);
  }
  // 02 진통제 사용 두 번
  {
    const s = step('진통제_사용두번');
    await openCell('i_pain');
    const a = await clickSel('.it-pop [data-action="items-use"]');
    const b2 = await clickSel('.it-pop [data-action="items-use"]');
    const q = await useQ();
    const btn = await page.evaluate(() => document.querySelector('.it-pop [data-action="items-use"]')?.innerText ?? '');
    check(s, '사용 자리 진통제 ×2, 단추 「사용 ×2」', a === true && b2 === true && q.length === 1 && q[0].id === 'i_pain' && q[0].n === 2 && btn.includes('×2'), [{ id: 'i_pain', n: 2 }], { q, btn }, 'goei-equip-design: 같은 것 또 놓으면 ×n');
    await closePop();
    await saveState(s);
  }
  // 03 손전등 사용 → 빈 손 칸에 먼저 들고 사용 예정 (사용자 11-14 holdFirst)
  {
    const s = step('손전등_사용_자동들기');
    await openCell('i_flash');
    await clickSel('.it-pop [data-action="items-use"]');
    const it = await items();
    const f = it.list.find((x) => x.id === 'i_flash');
    const q = await useQ();
    check(s, '손 칸 0번에 들고 사용 자리에 들어감', f.slot === 0 && q.some((u) => u.id === 'i_flash'), { slot: 0, queued: true }, { slot: f.slot, q }, 'ui/items.ts holdFirst 주석 사용자 11-14');
    await closePop();
    await saveState(s);
  }
  // 04 방독면(장비, 안 입음) → 사용 단추 막힘
  {
    const s = step('방독면_안입고_사용막힘');
    await openCell('i_mask');
    const r = await clickSel('.it-pop [data-action="items-use"]');
    const title = await page.evaluate(() => document.querySelector('.it-pop [data-action="items-use"]')?.getAttribute('title') ?? '');
    check(s, '안 입은 장비는 사용 단추가 꺼지고 까닭이 보임', r === 'disabled' && title.includes('장착해야'), 'disabled + 장착해야 쓸 수 있어요', { r, title }, '사용자 11-14 「장착 안 하고는 활성화 안 되게」');
    await closePop();
  }
  // 05 칩
  {
    const s = step('창닫기_사용칩');
    await closeWin(page);
    const c = await chipState();
    check(s, '마지막 메시지 아래 「다음 메시지에 사용」: 진통제 ×2, 손전등', c.shown && c.label.includes('다음 메시지에 사용') && c.names.join(',') === '진통제 ×2,손전등', '다음 메시지에 사용 · 진통제 ×2, 손전등', c, 'host/usebox.ts 사용자 11-11·11-12');
  }
  // 06 본편 요청
  let out06;
  {
    const s = step('본편요청_사용실림');
    const out = await mainRequest('진통제 두 알을 삼키고 손전등을 켠다.', 'u2');
    out06 = out;
    writeMain(s, out);
    const inv = invOf(out);
    check(s, '[Inventory] 가 마지막 유저 메시지 바로 앞 system', invBeforeLastUser(out), '마지막 user 앞', out.map((m) => m.role), 'core/items.ts withInventory');
    check(s, 'This turn: uses 진통제 ×2 (1 left after this), 손전등', /This turn: uses 진통제 ×2 \(1 left after this\), 손전등/.test(inv), 'uses 진통제 ×2 (1 left after this), 손전등', thisTurn(inv), '지침 INVENTORY.EVENT.USES · USE.LEFT');
    check(s, '목록 꼬리표: 손전등 [in hand], 방검 조끼 [worn], 진통제 [3 uses left]', /- 손전등 — 건전지 새것 \[in hand\]/.test(inv) && /- 방검 조끼 — 얇은 방검 조끼 \[worn\]/.test(inv) && /- 진통제 — 알약 세 알 \[3 uses left\]/.test(inv), '꼬리표', inv.split('\n').filter((l) => /손전등|조끼|진통제/.test(l)), '사용자 11-14 손 칸 = in hand, 장비 칸 = worn');
    check(s, '칸 줄 [Inventory] 8/16 (손전등도 손 칸으로 빠짐)', inv.startsWith('[Inventory] 8/16'), '[Inventory] 8/16', inv.split('\n')[0]);
    check(s, '무게: Weight: 29.1 kg / 25 kg (4.1 kg over), 「무겁다」 같은 말 없음', /Weight: 29\.1 kg \/ 25 kg \(4\.1 kg over\)/.test(inv) && !/heavy/i.test(inv), 'Weight 줄', /Weight:[^\n]*/.exec(inv)?.[0], '사용자 11-08: 본편엔 초과 여부·얼마나만');
    const c = await chipState();
    check(s, '보낸 뒤 칩은 「보내는 중」, × 숨김', c.shown && c.label.includes('보내는 중') && !c.x, '보내는 중', c, '전수검사 11-13 사용자 결정 · 11-14 B-9');
    await saveState(s);
  }
  // 07 답 기다리는 중 사용 넣기 → 막힘 안내
  {
    const s = step('기다리는중_사용넣기');
    await openItems();
    await openCell('i_tal1');
    await clickSel('.it-pop [data-action="items-use"]');
    const q = await useQ();
    const t = await bodyText();
    check(s, '사용 자리 그대로, 「답을 기다리는 중」 안내', q.length === 2 && !q.some((u) => u.id === 'i_tal1') && t.includes('답을 기다리는 중'), '안내', { q, t: t.slice(0, 120) }, '사용자 11-14 전부 막기');
    await closePop();
    await closeWin(page);
  }
  // 08 응답 붙음 → 사용 기록 + 갱신기 자료
  {
    const s = step('응답정리_갱신기자료');
    await queueU(U());
    const n0 = await llmN();
    await botReply(R('진통제 두 알을 삼켰다. 손전등 불빛이 복도를 갈랐다.', '09:10 PM', 140000), 'c2');
    const calls = await llmFrom(n0);
    writeCalls(s, calls);
    const d = dataOf(calls.find((c) => c.kind === 'update'));
    const v = await vars();
    check(s, '사용 기록: 진통제 n2·손전등 n1 이 c2 에, at=u2, 진통제 남은 1', (await usesLive('i_pain')).map((l) => `${l.anchor}:${l.n}`).join() === 'c2:2' && (await usesLive('i_flash')).length === 1 && v.$st_item_use_at === 'u2' && (await leftOf('i_pain')) === 1, { pain: 'c2:2', at: 'u2', left: 1 }, { pain: (await usesLive('i_pain')).map((l) => `${l.anchor}:${l.n}`), at: v.$st_item_use_at, left: await leftOf('i_pain') }, 'core/items.ts settleItemUse');
    check(s, '갱신기 used_now: 진통제 times 2 consumable uses_left 1 · 손전등 times 1', JSON.stringify(d?.used_now) === JSON.stringify([{ name: '진통제', times: 2, consumable: true, uses_left: 1 }, { name: '손전등', times: 1, consumable: false }]), 'used_now 2줄', d?.used_now, '갱신기 지침 used_now');
    check(s, '갱신기 items_now 진통제 uses_left 1, 손전등 equip hand equipped', d?.items_now?.find((x) => x.name === '진통제')?.uses_left === 1 && d?.items_now?.find((x) => x.name === '손전등')?.equipped === true, 'items_now', d?.items_now?.slice(0, 3));
    const c = await chipState();
    check(s, '답이 붙은 뒤 칩 없음', !c.shown, '숨김', c);
    await saveState(s);
  }
  const snapAfterC2 = await snap();
  // 09·10 다시 굴리기 두 번
  for (const [k, cid] of [[1, 'c2b'], [2, 'c2c']]) {
    const s = step(`다시굴리기_${k}`);
    const out = await rerollRequest();
    writeMain(s, out);
    const inv = invOf(out);
    check(s, `다시 굴린 요청에 같은 사용이 다시 실림 (진통제 ×2, 1 left)`, /uses 진통제 ×2 \(1 left after this\), 손전등/.test(inv), 'uses 진통제 ×2 (1 left after this), 손전등', thisTurn(inv), '점검지침 3-D 다시 굴리기: 사용이 다시 실리나');
    await queueU(U());
    await botReply(R('진통제 두 알을 삼켰다. 손전등을 켰다.', '09:10 PM', 140000), cid);
    check(s, '두 번 쓰이지 않음: 살아 있는 사용 기록 진통제 1줄(n2), 남은 1', (await usesLive('i_pain')).length === 1 && (await leftOf('i_pain')) === 1, { lines: 1, left: 1 }, { lines: (await usesLive('i_pain')).length, left: await leftOf('i_pain') });
    await saveState(s);
  }
  // 11 다음 턴: 사용은 한 번만 (This turn 에 다시 안 감), 최근 기록에는 남음
  {
    const s = step('다음턴_사용사건한번');
    const out = await mainRequest('복도 끝으로 걸어간다.', 'u3');
    writeMain(s, out);
    const inv = invOf(out);
    check(s, 'This turn 에 uses 없음', !/uses /.test(thisTurn(inv)), 'uses 없음', thisTurn(inv), '점검지침 3-C 한 번만 전달');
    check(s, 'Recently: used 진통제 ×2; used 손전등', /Recently:.*used 진통제 ×2.*used 손전등/.test(inv), 'Recently used', recent(inv), '사용자 11-11 기록 3턴');
    check(s, '목록: 진통제 [1 use left]', /- 진통제 — 알약 세 알 \[1 use left\]/.test(inv), '1 use left', inv.split('\n').find((l) => l.includes('진통제')));
    await queueU(U());
    await botReply(R('복도는 길었다.', '09:15 PM', 140000), 'c3');
    const v = await vars();
    check(s, '다음 턴 답 뒤 사용 자리 비움', !v.$st_item_use && !v.$st_item_use_at, '빈 자리', { use: v.$st_item_use, at: v.$st_item_use_at });
    await saveState(s);
  }
  // 12 마지막 한 알 → 다 씀
  {
    const s = step('마지막사용_다씀');
    await openItems();
    await openCell('i_pain');
    await clickSel('.it-pop [data-action="items-use"]');
    const r2 = await clickSel('.it-pop [data-action="items-use"]');
    const q = await useQ();
    check(s, '남은 1 → ×1 까지만 (두 번째 누름은 막힘)', q.find((u) => u.id === 'i_pain')?.n === 1, 1, { q, r2 });
    await closePop(); await closeWin(page);
    const out = await mainRequest('남은 진통제를 먹는다.', 'u4');
    writeMain(s, out);
    const inv = invOf(out);
    check(s, 'uses 진통제 (used up after this)', /uses 진통제 \(used up after this\)/.test(inv), 'used up after this', thisTurn(inv));
    await queueU(U());
    await botReply(R('마지막 알약이었다.', '09:20 PM', 140000), 'c4');
    const out2 = await mainRequest('잠시 숨을 고른다.', 'u5');
    const inv2 = invOf(out2);
    writeMain(s, out2, '', '_다음본편');
    check(s, '다 쓴 진통제는 목록에서 빠짐 (설정 기본 「빼기」)', !/- 진통제/.test(inv2), '목록에 없음', inv2.split('\n').filter((l) => l.includes('진통제')), 'goei-equip-design 0 이면 없앰');
    await queueU(U());
    await botReply(R('숨을 골랐다.', '09:22 PM', 140000), 'c5');
    await saveState(s);
  }
  // 13 장착·해제·손 칸 가득
  {
    const s = step('장착_해제_손칸가득');
    await openItems();
    await openCell('i_mask');
    await clickSel('.it-pop [data-action="items-equip"]');
    let m = (await items()).list.find((x) => x.id === 'i_mask');
    check(s, '방독면 장착 → 장비 칸 1번', m.slot === 1, 1, m.slot);
    await openCell('i_mask');
    const useOn = await clickSel('.it-pop [data-action="items-use"]');
    check(s, '입은 뒤 사용 단추가 켜짐', useOn === true && (await useQ()).some((u) => u.id === 'i_mask'), '사용 자리에 방독면', { useOn, q: await useQ() });
    await openCell('i_mask');
    await clickSel('.it-pop [data-action="items-unequip"]');
    m = (await items()).list.find((x) => x.id === 'i_mask');
    check(s, '해제 → 칸 비고 사용 예정도 빠짐', m.slot === undefined && !(await useQ()).some((u) => u.id === 'i_mask'), '칸 없음·사용 자리 없음', { slot: m.slot, q: await useQ() }, '사용자 11-14 장착해야 쓴다');
    await openCell('i_umb');
    await clickSel('.it-pop [data-action="items-equip"]');
    await openCell('i_bat');
    await clickSel('.it-pop [data-action="items-equip"]');
    const bat = (await items()).list.find((x) => x.id === 'i_bat');
    const t = await bodyText();
    check(s, '손 두 칸(손전등·우산) 다 차면 방망이는 안 들리고 안내', bat.slot === undefined && t.includes('칸이 다 찼어요'), '다 찼어요', { slot: bat.slot, t: t.slice(0, 200) });
    await closePop().catch(() => {});
    await saveState(s);
  }
  // 14 버리기
  {
    const s = step('버리기_다음턴한번');
    await openCell('i_file');
    await clickSel('.it-pop [data-action="items-drop-ask"]');
    await clickSel('.it-pop [data-action="items-drop"]');
    const f = (await items()).list.find((x) => x.id === 'i_file');
    check(s, '사건 파일: 지우지 않고 숨김(drop), 버린 때 = 마지막 메시지 c5', f?.outHow === 'drop' && f?.outKey === 'c5', { outHow: 'drop', outKey: 'c5' }, f && { outHow: f.outHow, outKey: f.outKey }, 'core/items.ts removeItem 사용자 11-12');
    await closeWin(page);
    const out = await mainRequest('복도를 걷는다.', 'u6');
    writeMain(s, out);
    const inv = invOf(out);
    check(s, 'This turn: threw 사건 파일 away 한 번, 목록에 없음', /threw 사건 파일 away/.test(thisTurn(inv)) && !/- 사건 파일/.test(inv), 'threw away', thisTurn(inv), '사용자 11-14 droppedNow');
    await queueU(U());
    await botReply(R('걸었다.', '09:25 PM', 140000), 'c6');
    const out2 = await mainRequest('계속 걷는다.', 'u7');
    writeMain(s, out2, '', '_그다음본편');
    check(s, '그다음 턴엔 버림 사건 없음', !/사건 파일/.test(thisTurn(invOf(out2))), '없음', thisTurn(invOf(out2)));
    await queueU(U());
    await botReply(R('계속 걸었다.', '09:27 PM', 140000), 'c7');
    await saveState(s);
  }
  // 15 합치기
  {
    const s = step('합치기_본편겹침');
    await openItems();
    await openCell('i_tal1');
    await clickSel('.it-pop [data-action="items-merge"]');
    await clickSel('.it-pop [data-action="items-merge-to"][data-value="i_tal2"]');
    const it = await items();
    check(s, '낡은 부적이 부적 묶음에 합쳐짐: 남은 3', it.list.find((x) => x.id === 'i_tal2')?.mergedInto === 'i_tal1' && (await leftOf('i_tal1')) === 3, 3, await leftOf('i_tal1'), '사용자 11-08 합치기: 횟수만 더함');
    await closeWin(page);
    const out = await mainRequest('부적을 정리한다.', 'u8');
    writeMain(s, out);
    const inv = invOf(out);
    check(s, 'This turn: combined 낡은 부적 into 부적 묶음', /combined 낡은 부적 into 부적 묶음/.test(thisTurn(inv)), 'combined', thisTurn(inv), '사용자 11-08 합침이 본편에');
    check(s, '같은 합침이 Recently 에 다시 적히지 않음 (산 물건과 같은 겹침, 사용자 11-22 「두 번 적힘」)', !/combined into/.test(recent(inv)), 'Recently 에 combined 없음', recent(inv), '사용자 11-22 21:28 Recently 겹침 정리 · 재검토 물을것3');
    check(s, '목록: 부적 묶음 [3 uses left]', /- 부적 묶음 — 노란 부적 두 장 \[3 uses left\]/.test(inv), '3 uses left', inv.split('\n').find((l) => l.includes('부적')));
    await saveState(s);
  }
  // 16 본문에서 잃음·두고 옴·새로 얻음 (갱신기)
  {
    const s = step('본문_잃음_두고옴_얻음');
    await queueU(U({ items: [
      { name: '손전등', action: 'gone', m: '@M', quote: '손전등이 손에서 미끄러져 배수구 아래로 사라졌다' },
      { name: '방검 조끼', action: 'left', place: '휴게실 사물함', m: '@M', quote: '방검 조끼를 벗어 휴게실 사물함에 넣고 잠갔다' },
      { name: '붕대 묶음', action: 'new', usable: true, uses: 5, equip: 'none', icon: '의료/붕대/bandage', weight: 0.02, equipped: false, desc: '하얀 붕대 다섯 개', m: '@M', quote: '의무실 선반에서 붕대 묶음을 챙겼다' },
    ] }));
    const n0 = await llmN();
    await botReply(R('손전등이 손에서 미끄러져 배수구 아래로 사라졌다. 방검 조끼를 벗어 휴게실 사물함에 넣고 잠갔다. 의무실 선반에서 붕대 묶음을 챙겼다.', '09:30 PM', 140000), 'c8');
    writeCalls(s, await llmFrom(n0));
    const it = await items();
    const by = (id) => it.list.find((x) => x.id === id);
    const band = it.list.find((x) => x.name === '붕대 묶음');
    check(s, '손전등 gone·조끼 left(휴게실 사물함)·칸에서 내림, 붕대 묶음 소모5 새 줄', by('i_flash')?.outHow === 'gone' && by('i_flash')?.slot === undefined && by('i_vest')?.outHow === 'left' && by('i_vest')?.place === '휴게실 사물함' && by('i_vest')?.slot === undefined && band?.uses === 5 && band?.anchor === 'c8', '세 변화', { flash: by('i_flash') && { o: by('i_flash').outHow, slot: by('i_flash').slot }, vest: by('i_vest') && { o: by('i_vest').outHow, p: by('i_vest').place }, band }, '갱신기 지침 14d');
    const out = await mainRequest('붕대를 주머니에 넣는다.', 'u9');
    writeMain(s, out);
    const inv = invOf(out);
    check(s, 'This turn: no longer has 손전등; left 방검 조끼 at 휴게실 사물함', /no longer has 손전등/.test(thisTurn(inv)) && /left 방검 조끼 at 휴게실 사물함/.test(thisTurn(inv)), '두 사건', thisTurn(inv), '사용자 11-12 본편도 알아야');
    check(s, '같은 사건이 Recently 에 다시 적히지 않음 (lost/left behind)', !/lost 손전등|left behind 방검 조끼/.test(recent(inv)), 'Recently 에 없음', recent(inv), '사용자 11-22 Recently 겹침 정리 (같은 꼴)');
    check(s, '목록: 손전등·조끼 없음, 붕대 묶음 [5 uses left]', !/- 손전등|- 방검 조끼/.test(inv) && /- 붕대 묶음 — 하얀 붕대 다섯 개 \[5 uses left\]/.test(inv), '목록', inv.split('\n').filter((l) => /^- /.test(l)));
    await queueU(U());
    await botReply(R('붕대를 넣었다.', '09:31 PM', 140000), 'c9');
    const out2 = await mainRequest('계단을 내려간다.', 'u10');
    writeMain(s, out2, '', '_그다음본편');
    check(s, '그다음 턴엔 잃음·두고 옴 사건 없음', !/손전등|방검 조끼/.test(thisTurn(invOf(out2))), '없음', thisTurn(invOf(out2)));
    await queueU(U());
    await botReply(R('계단은 어두웠다.', '09:33 PM', 140000), 'c10');
    await saveState(s);
  }
  // 17 갱신기 update 남은 횟수 → 다시 굴리면 돌아옴
  {
    const s = step('본문_남은횟수_다시굴리기');
    await mainRequest('붕대 두 개로 상처를 감는다.', 'u11');
    await queueU(U({ items: [{ name: '붕대 묶음', action: 'update', uses: 3, desc: '하얀 붕대 세 개', m: '@M', quote: '붕대 두 개를 풀어 팔을 감았다. 세 개가 남았다' }] }));
    await botReply(R('붕대 두 개를 풀어 팔을 감았다. 세 개가 남았다.', '09:35 PM', 140000), 'c11');
    const band = (await items()).list.find((x) => x.name === '붕대 묶음');
    check(s, '본문이 말한 남은 3 으로 맞춤', (await leftOf(band.id)) === 3, 3, await leftOf(band.id), 'core/items.ts leftByLog');
    await rerollRequest();
    await queueU(U());
    await botReply(R('팔을 감으려다 그만두었다.', '09:35 PM', 140000), 'c11b');
    check(s, '다시 굴린 답이 안 썼으면 남은 5 로 돌아옴 (설명은?)', (await leftOf(band.id)) === 5, 5, await leftOf(band.id), '점검지침 3-D 다시 굴리기 되돌림 · 전수점검 중대-6');
    const b2 = (await items()).list.find((x) => x.name === '붕대 묶음');
    check(s, '설명도 다시 굴리기 전으로 (갱신기가 바꾼 「세 개」가 남지 않음)', b2.desc === '하얀 붕대 다섯 개', '하얀 붕대 다섯 개', b2.desc, '점검지침 3-D: 그 응답이 만든 것은 되돌아감 (사용자 11-22 「다시 굴리면 그 응답이 만든 것은 다 되돌아간다」)');
    // 상태(고장)도 같은 길(updateItem): 고장 난 응답을 다시 굴려 안 부서진 답을 받으면?
    await mainRequest('우산으로 막는다.', 'u11x');
    await queueU(U({ items: [{ name: '검은 우산', action: 'update', condition: 'broken', desc: '살이 모두 꺾인 우산', m: '@M', quote: '우산살이 전부 꺾여 버렸다' }] }));
    await botReply(R('우산살이 전부 꺾여 버렸다.', '09:36 PM', 140000), 'c11x');
    const u1 = (await items()).list.find((x) => x.id === 'i_umb');
    await rerollRequest();
    await queueU(U());
    await botReply(R('우산으로 가볍게 막아 냈다.', '09:36 PM', 140000), 'c11y');
    const u2 = (await items()).list.find((x) => x.id === 'i_umb');
    const outU = await mainRequest('우산을 펼친다.', 'u11z');
    writeMain(s, outU, '', '_고장뒤다시굴리기_다음본편');
    check(s, '고장 난 응답을 다시 굴리면 고장도 풀림 (다음 요청에 broken 이 안 감)', u1.state === 'broken' && u2.state === 'ok' && !/검은 우산[^\n]*broken/.test(invOf(outU)), { before: 'broken', after: 'ok' }, { before: u1.state, after: u2.state, line: invOf(outU).split('\n').find((l) => l.includes('검은 우산')) }, '점검지침 3-D·4 다시 굴리기 되돌림 · removeItem 은 응답에 묶어 되돌아옴');
    await queueU(U());
    await botReply(R('우산을 폈다.', '09:37 PM', 140000), 'c11z');
    await saveState(s);
  }
  // 18 갱신기 equip (본문에서 듦)
  {
    const s = step('본문_장착');
    await mainRequest('야구방망이를 든다.', 'u12');
    await queueU(U({ items: [{ name: '야구방망이', action: 'equip', m: '@M', quote: '야구방망이를 오른손에 쥐었다' }] }));
    await botReply(R('야구방망이를 오른손에 쥐었다.', '09:40 PM', 140000), 'c12');
    const bat = (await items()).list.find((x) => x.id === 'i_bat');
    check(s, '본문에서 든 방망이 → 빈 손 칸 (손전등을 잃어 한 칸 빔)', bat.slot !== undefined, '손 칸', bat.slot, '사용자 11-22 장착은 본문을 따른다');
    await rerollRequest();
    await queueU(U());
    await botReply(R('방망이는 가방에 그대로 두었다.', '09:40 PM', 140000), 'c12b');
    const bat2 = (await items()).list.find((x) => x.id === 'i_bat');
    check(s, '든 응답을 다시 굴려 안 든 답이면 방망이는 손 칸에서 내려옴', bat2.slot === undefined, '칸 없음', bat2.slot, '점검지침 3-D 다시 굴리기 되돌림 · 사용자 11-22 장착은 본문을 따른다');
    await saveState(s);
  }
  // 19 칸 넘침
  {
    const s = step('칸넘침_요청과화면');
    await setVars({ $it_slots: '8' });
    for (let i = 1; i <= 6; i++) {
      await openItems();
      await clickSel('[data-action="items-add"]');
      await page.fill('.it-form [name="name"]', `돌멩이 ${i}`);
      await page.fill('.it-form [name="weight"]', '0.5');
      await page.evaluate(() => document.querySelector('.it-form [name="name"]')?.dispatchEvent(new Event('input', { bubbles: true })));
      await clickSel('.it-form [data-action="items-save"]');
    }
    const cells = await page.evaluate(() => ({ over: document.querySelectorAll('.it-grid .it-c.over').length, stat: document.querySelector('.it-stat')?.getAttribute('title') ?? '' }));
    await closeWin(page);
    const out = await mainRequest('주머니를 뒤진다.', 'u13');
    writeMain(s, out);
    const inv = invOf(out);
    const head = inv.split('\n')[0];
    const n = Number(/(\d+)\/8/.exec(head)?.[1] ?? 0);
    check(s, '격자 넘친 칸 붉은 테두리, 칸 글에 넘침', cells.over === n - 8 && /넘침/.test(cells.stat), `${n - 8}칸`, cells, '사용자 11-08 넘친 칸 붉은 테두리');
    check(s, '[Inventory] n/8 (over the limit) + This turn: carrying more than the limit', /\(over the limit\)/.test(head) && /carrying more than the limit/.test(thisTurn(inv)), '넘침 두 곳', { head, t: thisTurn(inv) }, '지침 INVENTORY.OVER_LIMIT · EVENT.OVER_LIMIT');
    await queueU(U());
    await botReply(R('주머니가 불룩했다.', '09:42 PM', 140000), 'c13');
    await setVars({ $it_slots: '16' });
    await saveState(s);
  }
  // 20 가계부: 화면 잔고 → 수동 조정 → 본편 [Previous status] → 다시 굴리기에도 그대로
  {
    const s = step('가계부_수동조정');
    await openItems();
    await clickSel('[data-action="items-sub"][data-value="wallet"]');
    const before = await page.evaluate(() => document.querySelector('.gx-wt-tile.bal b')?.innerText ?? '');
    check(s, '가계부 잔고 ₩ 140,000', before.includes('140,000'), '₩ 140,000', before);
    await clickSel('[data-action="wallet-edit"]');
    await page.fill('[name="wt-adj"]', '100000');
    await page.evaluate(() => document.querySelector('[data-action="wallet-adj"]')?.click()); await sleep(400);
    // data-take 로 값이 넘어간다 (app.ts): 직접 눌렀을 때 값이 안 넘어가면 숨은 단추로
    let led = await ledger();
    if (led.bal !== 100000) { await page.evaluate(() => { const el = document.createElement('button'); el.dataset.action = 'wallet-adj'; el.dataset.value = '100000'; document.querySelector('.gx-wallettab')?.appendChild(el); el.click(); el.remove(); }); await sleep(400); led = await ledger(); }
    const after = await page.evaluate(() => document.querySelector('.gx-wt-tile.bal b')?.innerText ?? '');
    check(s, '잔고 100,000 · 수동 줄 하나 (기준 응답 없음)', led.bal === 100000 && led.live.filter((e) => e.src === 'manual').length === 1 && after.includes('100,000'), 100000, { bal: led.bal, after, manual: led.live.filter((e) => e.src === 'manual') });
    await closeWin(page);
    const out = await mainRequest('지갑을 확인한다.', 'u14');
    writeMain(s, out);
    const stx = statusOf(out);
    check(s, '[Previous status] 잔고 칸 = 100000', /\|100000\]/.test(stx), '|100000]', /\[▣[^\]]*\]/.exec(stx)?.[0], 'core/wallet.ts 장부가 진실, [Previous status] 덮어씀');
    await queueU(U());
    await botReply(R('지갑에는 십만 원이 있었다.', '09:45 PM', 100000), 'c14');
    const out2 = await rerollRequest();
    writeMain(s, out2, '', '_다시굴리기');
    await queueU(U());
    await botReply(R('지갑을 열었다.', '09:45 PM', 100000), 'c14b');
    led = await ledger();
    check(s, '다시 굴려도 수동 조정은 그대로 (잔고 100,000)', led.bal === 100000, 100000, led.bal, '점검지침 3-D 수동 잔고 조정(그대로)');
    await saveState(s);
  }
  // 21 본문 거래 (갱신기) + 다시 굴리면 빠짐
  {
    const s = step('본문거래_다시굴리기');
    await mainRequest('택시를 탄다.', 'u15');
    await queueU(U({ transactions: [{ amount: -12000, memo: '택시비', m: '@M', quote: '택시비로 12,000원을 냈다' }] }));
    await botReply(R('택시비로 12,000원을 냈다.', '10:05 PM', 88000), 'c15');
    let led = await ledger();
    check(s, '잔고 88,000 (택시비 −12,000 한 줄, 상태창 맞춤 줄 없음)', led.bal === 88000 && led.live.filter((e) => e.anchor === 'c15').length === 1, { bal: 88000, rows: 1 }, { bal: led.bal, rows: led.live.filter((e) => e.anchor === 'c15') });
    await rerollRequest();
    await queueU(U());
    await botReply(R('택시를 잡지 못하고 걸었다.', '10:05 PM', 100000), 'c15b');
    led = await ledger();
    check(s, '다시 굴리면 택시비가 빠져 100,000', led.bal === 100000, 100000, led.bal);
    await saveState(s);
  }
  writeFileSync(`${OUT}결과_pc.json`, JSON.stringify({ results: results.filter((r) => Number(r.step.slice(0, 3)) < 100), pageErrors: errors }, null, 2));
}

// ════════════════════════════ 갈래 ════════════════════════════
if (PART === 'all' || PART === 'branch') {
  stepNo = Math.max(stepNo, 100);
  vp.cur = 'pc';
  // B 설정 끔
  {
    const s = step('갈래_소지품끔');
    await start(chatBase({ $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]), $it_on: '0' }), 'pc');
    const out = await mainRequest('걷는다.', 'u2');
    writeMain(s, out);
    const c = await chipState();
    await openWin(page); await sleep(250);
    const hasTab = await page.evaluate(() => !!document.querySelector('[data-action="nav-tab"][data-value="items"], [data-action="tab"][data-value="items"]'));
    const tabs = await page.evaluate(() => { document.querySelector('[data-action="nav-tab"][data-value="items"], [data-action="tab"][data-value="items"]')?.click(); return [...document.querySelectorAll('.it-tabs [data-action="items-sub"]')].map((e) => e.dataset.value); });
    await closeWin(page);
    check(s, '끄면 [Inventory] 없음·칩 없음', !invOf(out) && !c.shown, '없음', { inv: invOf(out).slice(0, 80), chip: c });
    check(s, '소지품 하위 탭이 빠짐 (가계부만)', !tabs.includes('items'), '가계부만', { hasTab, tabs }, '사용자 11-07 따로 켜고 끔');
    await setVars({ $it_on: '1', $it_resumed: '3' });
    const out2 = await mainRequest('다시 걷는다.', 'u3');
    writeMain(s, out2, '', '_다시켬');
    check(s, '다시 켠 첫 요청: 꺼져 있던 동안의 변화 안내 + 사용 자리가 다시 실리나?', /switched off for a while/.test(invOf(out2)), 'RESUMED', thisTurn(invOf(out2)), '사용자 11-07 다시 켜면 한 줄');
    // 사용자 11-07: 소지품 끄면 「다음 메시지에 사용」 비움 — 설정 화면으로 끈 게 아니라 변수만 바꿨으므로 여기선 실렸는지만 적는다
    results.push({ step: `${s.n} ${s.name}`, what: '(참고) 변수로만 끄고 켰을 때 사용 자리가 다시 켠 턴에 실렸나', ok: true, expect: '-', actual: usesLine(invOf(out2)), why: '설정 화면으로 끄면 비움 (사용자 11-07). 이 갈래는 화면을 거치지 않음' });
    await saveState(s);
  }
  // B 연타
  {
    const s = step('갈래_사용연타');
    await start(chatBase(), 'pc');
    await openItems();
    await openCell('i_tal1');
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) document.querySelector('.it-pop [data-action="items-use"]')?.click(); });
    await sleep(1200);
    const q = await useQ();
    check(s, '남은 2 인 부적 묶음을 6번 연타해도 ×2 를 넘지 않음', q.find((u) => u.id === 'i_tal1')?.n <= 2, '≤2', q);
    await closePop();
    await closeWin(page); await openItems();
    await openCell('i_tal1');
    const btn = await page.evaluate(() => document.querySelector('.it-pop [data-action="items-use"]')?.innerText ?? '');
    check(s, '창 닫았다 열어도 사용 자리 그대로 (단추 「사용 ×n」)', /사용 ×2/.test(btn), '사용 ×2', btn);
    await closePop(); await closeWin(page);
    await saveState(s);
  }
  // B 응답 실패 → 같은 메시지로 다시 보냄
  {
    const s = step('갈래_응답실패_재전송');
    await start(chatBase({ $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]) }), 'pc');
    const out1 = await mainRequest('진통제를 먹는다.', 'u2');
    // 답 없이 끝남: Risu 가 실패를 알리지 않으니 기다림이 늦게 꺼진다 (host/waiting.ts) — 여기선 같은 유저 메시지로 다시 요청
    const out2 = await mainRequest('진통제를 먹는다.', 'u2', false);
    writeMain(s, out2);
    check(s, '실패 뒤 다시 보낸 요청에도 사용이 실림 (2 left)', /uses 진통제 \(2 left after this\)/.test(invOf(out2)) && /uses 진통제 \(2 left after this\)/.test(invOf(out1)), '두 요청 다 2 left', [usesLine(invOf(out1)), usesLine(invOf(out2))]);
    await queueU(U());
    await botReply(R('알약을 삼켰다.', '09:10 PM', 140000), 'c2');
    check(s, '한 번만 깎임: 남은 2', (await leftOf('i_pain')) === 2, 2, await leftOf('i_pain'));
    await saveState(s);
  }
  // B 페이지 새로고침 (보낸 뒤 답 전에 플러그인이 다시 뜸) → 답 정리
  {
    const s = step('갈래_보낸뒤_새로고침');
    await start(chatBase({ $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]) }), 'pc');
    await mainRequest('진통제를 먹는다.', 'u2');
    const c0 = await snap();
    await start(c0, 'pc'); // 새로고침: 같은 채팅으로 플러그인이 새로 뜸
    await queueU(U());
    await botReply(R('알약을 삼켰다.', '09:10 PM', 140000), 'c2');
    check(s, '새로고침 뒤 붙은 답에도 사용 기록 1줄, 남은 2', (await usesLive('i_pain')).length === 1 && (await leftOf('i_pain')) === 2, 2, { lines: await usesLive('i_pain'), left: await leftOf('i_pain') });
    const c = await chipState();
    check(s, '칩 없음', !c.shown, '숨김', c);
    await saveState(s);
  }
  // B 응답 지우기 (다시 굴리지 않고 지운 뒤 새 메시지)
  {
    const s = step('갈래_응답지우기_새메시지');
    await start(chatBase({ $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]) }), 'pc');
    await mainRequest('진통제를 먹는다.', 'u2');
    await queueU(U());
    await botReply(R('알약을 삼켰다.', '09:10 PM', 140000), 'c2');
    await page.evaluate(() => window.__chat.message.pop()); // 응답 지움
    check(s, '지우면 남은 횟수 돌아옴 (3)', (await leftOf('i_pain')) === 3, 3, await leftOf('i_pain'), '점검지침 4 본편 응답 지우기');
    await openItems();
    await openCell('i_pain');
    const btn = await page.evaluate(() => document.querySelector('.it-pop [data-action="items-use"]')?.innerText ?? '');
    const cell = await page.evaluate(() => document.querySelector('.it-c[data-value="i_pain"]')?.innerText ?? '');
    await closePop(); await closeWin(page);
    const c = await chipState();
    const out = await mainRequest('다른 걸 한다.', 'u3');
    writeMain(s, out);
    // 기대값 근거 없음: 지운 응답의 사용이 아직 「사용 예정」인지 사라지는지는 사용자 결정이 없다 → 실제값만 적는다
    results.push({ step: `${s.n} ${s.name}`, what: '(물을 것) 지운 뒤 화면·칩·새 요청의 사용', ok: true, expect: '사용자 결정 없음', actual: { 팝업단추: btn, 칸: cell.replace(/\n/g, ' '), 칩: c, 새요청: usesLine(invOf(out)) || '(uses 없음)', 변수: (await vars()).$st_item_use, at: (await vars()).$st_item_use_at }, why: 'queueUseVars 주석 「응답을 지워 그 유저 메시지가 끝이면 아직 안 쓰인 자리다」' });
    await saveState(s);
  }
  // B 답이 온 뒤 새로 넣고 다시 굴리기 (사본 다시 보냄)
  {
    const s = step('갈래_새로넣고_다시굴리기');
    await start(chatBase({ $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]) }), 'pc');
    await mainRequest('진통제를 먹는다.', 'u2');
    await queueU(U());
    await botReply(R('알약을 삼켰다.', '09:10 PM', 140000), 'c2');
    await openItems(); await openCell('i_tal1'); await clickSel('.it-pop [data-action="items-use"]'); await closePop(); await closeWin(page);
    const out = await rerollRequest();
    writeMain(s, out);
    check(s, '다시 굴린 요청: 지난 턴 사본(진통제)만, 새로 넣은 부적은 안 감', /uses 진통제 \(2 left after this\)/.test(invOf(out)) && !/부적 묶음 \(/.test(usesLine(invOf(out))), 'uses 진통제만', usesLine(invOf(out)), 'core/items.ts useTurn 11-14 재검토');
    await queueU(U());
    await botReply(R('알약을 다시 삼켰다.', '09:10 PM', 140000), 'c2b');
    check(s, '진통제 한 번만(남은 2), 부적은 아직 사용 예정', (await leftOf('i_pain')) === 2 && (await useQ()).some((u) => u.id === 'i_tal1'), { left: 2, q: 'i_tal1' }, { left: await leftOf('i_pain'), q: await useQ(), at: (await vars()).$st_item_use_at });
    const out2 = await mainRequest('부적을 쓴다.', 'u3');
    writeMain(s, out2, '', '_다음턴');
    check(s, '다음 턴에 부적이 실림', /uses 부적 묶음 \(1 left after this\)/.test(invOf(out2)), 'uses 부적 묶음', usesLine(invOf(out2)));
    await saveState(s);
  }
  // B 보내는 중 버리기 → 답이 붙으면 쓴 것으로 적힘
  {
    const s = step('갈래_보내는중_버리기');
    await start(chatBase({ $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]) }), 'pc');
    await mainRequest('진통제를 먹는다.', 'u2');
    await openItems(); await openCell('i_pain'); await clickSel('.it-pop [data-action="items-drop-ask"]'); await clickSel('.it-pop [data-action="items-drop"]'); await closeWin(page);
    const p = (await items()).list.find((x) => x.id === 'i_pain');
    await queueU(U());
    await botReply(R('알약을 삼키고 통을 버렸다.', '09:10 PM', 140000), 'c2');
    check(s, '버린 물건도 사용 기록 1줄 (모델은 쓴 것으로 받음), 물건은 숨김', p.outHow === 'drop' && (await usesLive('i_pain')).length === 1, '사용 1줄·drop', { out: p.outHow, uses: await usesLive('i_pain') }, '재검토 11-14 B-9');
    await saveState(s);
  }
  // B 갱신기 빈 답·꼴 틀린 답 → 소지품 그대로, 다음 턴에 다시 읽음
  {
    const s = step('갈래_갱신기_빈답_꼴틀림');
    await start(chatBase(), 'pc');
    await mainRequest('주위를 본다.', 'u1b');
    await queueU(U());
    await botReply(R('주위는 조용했다.', '09:05 PM', 140000), 'c1b'); // 한 번은 읽힌 채팅 (첫 갱신이 실패하면 그 응답은 「중간에 켬」으로 보아 안 읽는 것이 설계)
    await mainRequest('붕대를 줍는다.', 'u2');
    await queueU('', '{"items": [ {"name": "붕대", "action": "new", ');
    await botReply(R('바닥에서 붕대를 주웠다.', '09:10 PM', 140000), 'c2');
    const it1 = await items();
    check(s, '빈 답: 소지품 변화 없음', !it1.list.some((x) => x.name === '붕대'), '없음', it1.list.map((x) => x.name));
    await mainRequest('계속 간다.', 'u3');
    const n0 = await llmN();
    await queueU(U({ items: [{ name: '붕대', action: 'new', usable: true, uses: 1, equip: 'none', icon: '의료/붕대/bandage', weight: 0.02, desc: '하얀 붕대', m: '@MF', quote: '바닥에서 붕대를 주웠다' }] }));
    await botReply(R('계속 걸었다.', '09:12 PM', 140000), 'c3');
    const calls = await llmFrom(n0);
    writeCalls(s, calls);
    const conf = calls.filter((c) => c.kind === 'update').map((c) => (dataOf(c)?.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').map((x) => x.text.slice(0, 12)));
    check(s, '다음 갱신이 못 읽은 c2 와 새 c3 를 다 읽음 (꼴 틀린 답 뒤 c2 가 안 읽힘으로 남음)', conf.flat().length === 2, 2, conf, 'host/people.ts unreadIndexes');
    check(s, '밀린 c2 의 붕대가 들어옴', (await items()).list.some((x) => x.name === '붕대'), '붕대', (await items()).list.map((x) => x.name));
    await saveState(s);
  }
  // B 갱신기 늦게 온 답: 갱신 중에 사용자가 같은 물건을 버림
  {
    const s = step('갈래_갱신기_늦은답_그사이버림');
    await start(chatBase(), 'pc');
    await mainRequest('사건 파일을 펼친다.', 'u2');
    await page.evaluate(() => { let r; window.__gate = { p: new Promise((x) => { r = x; }), r: () => r() }; });
    await queueU(U({ items: [{ name: '사건 파일', action: 'update', desc: '커피가 쏟아져 얼룩진 파일', m: '@M', quote: '사건 파일 위로 커피가 쏟아졌다' }] }));
    const p = page.evaluate(async (t) => { window.__chat.message.push({ role: 'char', data: t, chatId: 'c2' }); await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); }, R('사건 파일 위로 커피가 쏟아졌다.', '09:10 PM', 140000));
    await sleep(800);
    await openItems(); await openCell('i_file'); await clickSel('.it-pop [data-action="items-drop-ask"]'); await clickSel('.it-pop [data-action="items-drop"]'); await closeWin(page);
    await page.evaluate(() => { window.__gate.r(); window.__gate = null; });
    await p; await sleep(500);
    const f = (await items()).list.find((x) => x.id === 'i_file');
    check(s, '늦은 갱신기 답이 버린 물건을 되살리지 않음', f?.outHow === 'drop', 'drop 그대로', f && { outHow: f.outHow, desc: f.desc });
    await saveState(s);
  }
  // B 다 쓴 물건 남겨 두기
  {
    const s = step('갈래_다쓴물건_남기기');
    await start(chatBase({ $it_spent: 'keep', $st_item_use: JSON.stringify([{ id: 'i_tal2', n: 1 }]) }), 'pc');
    await mainRequest('부적을 태운다.', 'u2');
    await queueU(U());
    await botReply(R('부적이 타올랐다.', '09:10 PM', 140000), 'c2');
    const out = await mainRequest('재를 털어낸다.', 'u3');
    writeMain(s, out);
    check(s, '「남겨 두기」: 낡은 부적이 목록에 [used up]', /- 낡은 부적 — 귀퉁이가 해진 부적 \[used up\]/.test(invOf(out)), 'used up', invOf(out).split('\n').find((l) => l.includes('낡은 부적')));
    await openItems(); await openCell('i_tal2');
    const btn = await page.evaluate(() => document.querySelector('.it-pop [data-action="items-use"]'));
    const dis = await page.evaluate(() => document.querySelector('.it-pop [data-action="items-use"]')?.disabled ?? null);
    check(s, '다 쓴 부적의 사용 단추는 꺼짐', dis === true, true, { dis, btn: !!btn });
    await closePop(); await closeWin(page);
    await saveState(s);
  }
  // B 수동 조정 뒤 갱신기가 늦게 끝나 상태창 맞춤을 다시 계산
  {
    const s = step('갈래_수동조정_상태창다른값');
    await start(chatBase(), 'pc');
    await mainRequest('지갑을 본다.', 'u2');
    await queueU(U());
    await botReply(R('지갑을 열었다.', '09:10 PM', 140000), 'c2');
    await openItems(); await clickSel('[data-action="items-sub"][data-value="wallet"]');
    await page.evaluate(() => { const el = document.createElement('button'); el.dataset.action = 'wallet-adj'; el.dataset.value = '50000'; document.querySelector('.gx-wallettab')?.appendChild(el); el.click(); el.remove(); }); await sleep(400);
    await closeWin(page);
    const out = await mainRequest('밥을 먹는다.', 'u3');
    writeMain(s, out);
    // 모델이 [Previous status](50000) 를 무시하고 옛 140000 을 쓰면 「상태창 잔고 따르기」(기본 켬)가 장부를 140000 으로 되돌린다
    await queueU(U());
    await botReply(R('국밥 한 그릇을 먹었다.', '09:30 PM', 140000), 'c3');
    const led = await ledger();
    results.push({ step: `${s.n} ${s.name}`, what: '(참고) 수동 조정 50,000 뒤 모델이 옛 잔고 140000 을 쓴 응답 → 장부', ok: true, expect: '설정 「상태창 잔고 따르기」 켬이면 상태창 값을 따름 (설계)', actual: { bal: led.bal, rows: led.live.map((e) => `${e.src}:${e.amount}:${e.memo}`) }, why: 'core/wallet.ts syncWalletToStatus' });
    await saveState(s);
  }
  // B 본문에서 벗음 → 다시 굴리기
  {
    const s = step('갈래_본문벗음_다시굴리기');
    await start(chatBase(), 'pc');
    await mainRequest('조끼를 벗는다.', 'u2');
    await queueU(U({ items: [{ name: '방검 조끼', action: 'unequip', m: '@M', quote: '방검 조끼를 벗어 팔에 걸쳤다' }] }));
    await botReply(R('방검 조끼를 벗어 팔에 걸쳤다.', '09:10 PM', 140000), 'c2');
    const v1 = (await items()).list.find((x) => x.id === 'i_vest');
    await rerollRequest();
    await queueU(U());
    await botReply(R('조끼 끈을 고쳐 맸다.', '09:10 PM', 140000), 'c2b');
    const v2 = (await items()).list.find((x) => x.id === 'i_vest');
    const out = await mainRequest('계속 간다.', 'u3');
    writeMain(s, out);
    check(s, '벗은 응답을 다시 굴려 안 벗은 답이면 조끼는 다시 [worn]', v1.slot === undefined && v2.slot === 0 && /- 방검 조끼[^\n]*\[worn\]/.test(invOf(out)), { before: '칸 없음', after: 0 }, { before: v1.slot, after: v2.slot, line: invOf(out).split('\n').find((l) => l.includes('방검 조끼')) }, '점검지침 3-D 다시 굴리기 되돌림');
    await saveState(s);
  }
  // B 꿈결 수집기: 갱신기가 상태 그림을 고름(이름에서 「빈」을 뗌) → 다시 굴리기
  {
    const s = step('갈래_수집기그림_다시굴리기');
    const list = [...START_ITEMS, mk('i_dc', '빈 꿈결 수집기', { desc: '눈금 실린더 모양 수집기, 비어 있음', use: true, weight: 0.2, icon: '괴이/꿈결 수집기/dream collector' })];
    await start({ ...chatBase(), scriptstate: BASE_VARS({ $st_items: JSON.stringify({ list, log: [] }) }) }, 'pc');
    await openItems(); await closeWin(page); // 그림 팩 읽기
    await mainRequest('수집기를 괴이에 댄다.', 'u2');
    const n0 = await llmN();
    await queueU(U({ items: [{ name: '빈 꿈결 수집기', action: 'update', icon: '꿈결 수집기 B등급', desc: '노란 빛이 짙게 찬 수집기', m: '@M', quote: '수집기 눈금이 짙은 노란빛으로 차올랐다' }] }));
    await botReply(R('수집기 눈금이 짙은 노란빛으로 차올랐다.', '09:10 PM', 140000), 'c2');
    const calls = await llmFrom(n0);
    writeCalls(s, calls);
    const d = dataOf(calls.find((c) => c.kind === 'update'));
    const pics = d?.items_now?.find((x) => x.name === '빈 꿈결 수집기')?.pictures;
    const a = (await items()).list.find((x) => x.id === 'i_dc');
    await rerollRequest();
    await queueU(U());
    await botReply(R('수집기를 댔지만 아무 일도 없었다.', '09:10 PM', 140000), 'c2b');
    const b2 = (await items()).list.find((x) => x.id === 'i_dc');
    check(s, '갱신기 자료에 상태 그림 이름 8장', Array.isArray(pics) && pics.length === 8, 8, pics);
    check(s, '찬 응답: 이름 「꿈결 수집기」·그림 B등급', a.name === '꿈결 수집기' && /B등급/i.test(a.icon ?? ''), { name: '꿈결 수집기' }, { name: a.name, icon: a.icon }, '사용자 11-22 수집기 그림');
    check(s, '그 응답을 다시 굴려 안 찬 답이면 「빈 꿈결 수집기」·빈 그림으로 돌아옴', b2.name === '빈 꿈결 수집기', '빈 꿈결 수집기', { name: b2.name, icon: b2.icon, desc: b2.desc }, '점검지침 3-D 다시 굴리기 되돌림');
    await saveState(s);
  }
  writeFileSync(`${OUT}결과_branch.json`, JSON.stringify({ results: results.filter((r) => Number(r.step.slice(0, 3)) >= 100 && Number(r.step.slice(0, 3)) < 200), pageErrors: errors }, null, 2));
}

// ════════════════════════════ 폰 ════════════════════════════
if (PART === 'all' || PART === 'phone') {
  stepNo = Math.max(stepNo, 200);
  vp.cur = 'phone';
  {
    const s = step('폰_사용_들기_요청');
    await start(chatBase(), 'phone');
    await openWin(page); await sleep(300);
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-value="items"]')?.click()); await sleep(500);
    const noDrag = await page.evaluate(() => !document.querySelector('.it-c[draggable="true"]') && !document.querySelector('.it-usebox'));
    check(s, '폰: 끌기 없음·사용칸 없음', noDrag, true, noDrag, 'goei-equip-design 폰 = 끌기 없음');
    await openCell('i_pain');
    await clickSel('.it-pop [data-action="items-use"]');
    await closePop();
    const tag = await page.evaluate(() => document.querySelector('.it-c[data-value="i_pain"] .it-q8')?.innerText ?? '');
    check(s, '폰: 칸에 「사용 예정」 딱지', tag.includes('사용 예정'), '사용 예정', tag);
    await openCell('i_umb');
    await clickSel('.it-pop [data-action="items-equip"]');
    const umb = (await items()).list.find((x) => x.id === 'i_umb');
    check(s, '폰: 「들기」로 손 칸', umb.slot === 0, 0, umb.slot);
    const vw = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, v: window.innerWidth }));
    check(s, '폰: 가로 넘침 없음', vw.w <= vw.v, vw.v, vw.w);
    await page.screenshot({ path: `${OUT}폰_소지품.png` });
    await closePop().catch(() => {});
    await closeWin(page);
    const out = await mainRequest('진통제를 먹는다.', 'u2');
    writeMain(s, out);
    check(s, '폰: 요청에 uses 진통제', /uses 진통제 \(2 left after this\)/.test(invOf(out)), 'uses 진통제', usesLine(invOf(out)));
    await saveState(s);
  }
  writeFileSync(`${OUT}결과_phone.json`, JSON.stringify({ results: results.filter((r) => Number(r.step.slice(0, 3)) >= 200 && Number(r.step.slice(0, 3)) < 300), pageErrors: errors }, null, 2));
}

await b.close();
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과 · 마지막 단계 ${stepNo}${errors?.length ? ` · 페이지 오류 ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : ''}`);
