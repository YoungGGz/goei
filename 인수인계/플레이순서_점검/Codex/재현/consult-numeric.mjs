// AI 상담: 모든 설정 (2026-11-12 사용자 결정 — 호출 흐름 50줄만이 아니라 설정 메뉴 전부를 묻고 바꾼다).
// 1) 메뉴마다: 그 화면의 모든 줄 이름이 상담 목록에 있는지, id 가 겹치지 않는지, 요청에 채팅 글이 없는지
// 2) 메뉴마다: 바꿀 수 있는 줄을 전부 한 번에 바꾸자고 하고(한 답에 10개 한도 없음) → 동의 → 화면을 다시 읽어 값 대조 → 되돌리기 → 저장소가 처음과 같은지.
//    한 번에 못 바뀐 줄(다른 줄에 묶여 잠긴 것 등)은 하나씩 다시 해 본다
// 3) 시작 전(새 채팅 기본 설정)에도 같은 일
// 4) 상담 전용 통로(ai-do): 지우기·초기화·없는 값·범위 밖 수·꺾쇠가 든 글은 받지 않는다
// 5) 글 칸(길이·줄바꿈·꺾쇠·기본값과 같으면 저장 안 함), 못 바꾸는 줄·잠긴 줄, <open> 은 한 번만, <go>, 대화 지우기(다른 채팅·설정은 그대로),
//    요청 토큰 상한, 증상 지식의 줄 이름이 목록에 있는지, 폰
// 사용법: node tests/consult-all-browser.mjs <fixture.json> [결과 폴더]
import assert from '../../../../tests/soft-assert.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boot, chatOf, clickSel, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, setChat, sleep } from '../../../../tests/qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const OUT = process.argv[3] || '';
if (OUT) mkdirSync(OUT, { recursive: true });
let browser = await launch();
// 절마다 브라우저를 새로 띄운다 (전수 두 번 뒤 같은 브라우저로 이어 가면 Chromium 탭이 죽는 일이 있었다)
const renew = async () => { await browser.close().catch(() => {}); browser = await launch(); };
const MARK = 'ZZ메인본문표식';
const started = (extra = {}) => ({ message: [{ role: 'user', data: 'hi' }, { role: 'char', data: `${MARK}\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]` }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1', ...extra } });
const fresh = () => ({ message: [], scriptstate: {} });
const PC = { width: 1920, height: 1080, touch: false };
const PHONE = { width: 390, height: 844, touch: true };
let checks = 0;
// PART=sweep,fresh,misc,shots 로 절을 고른다 (없으면 전부)
const PART = (process.env.PART || 'sweep,fresh,misc,shots').split(',');
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };
const report = { menus: [], fresh: [], sizes: {}, notes: [] };
process.on('exit', () => { if (OUT) writeFileSync(`${OUT}/consult-all${process.env.PART ? `-${process.env.PART.replace(/,/g, '-')}` : ''}.json`, JSON.stringify(report, null, 1)); });

// 상담 대화와 호출 기록(부를 때마다 쌓임)은 설정이 아니다
const NOISE = (process.env.NOISE || 'p:goei:consult,p:goei-trace').split(',');
/** 저장소(채팅 변수 + 플러그인 저장소)가 같은가. 다르면 다른 열쇠만 보인다 */
const same = (a, b, msg) => { const d = a === b ? [] : diffKeys(a, b); assert.equal(d.slice(0, 8).join(', '), '', msg); checks++; };
const SAY = (t) => `<say>${t}</say>`;
const snap = (page) => page.evaluate((NOISE) => JSON.stringify({ chat: window.__chat.scriptstate ?? {}, store: Object.fromEntries(Object.entries(window.__store).filter(([k, v]) => !NOISE.includes(k) && String(v).length < 200000)) }), NOISE);
const logOf = (page) => page.evaluate(() => [...document.querySelectorAll('.gw-ai .gw-ai-log > *')].map((e) => `${e.className.replace('ai-m ', '')}: ${e.textContent.replace(/\s+/g, ' ').trim()}`));
const calls = (page) => page.evaluate(() => (window.__calls.llm ?? []).length);
const lastReq = (page) => page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content));
async function send(page, text, replies) {
  await page.evaluate((r) => { window.__llm = r; }, replies);
  await page.evaluate((t) => { const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  await clickSel(page, '.gw-ai [data-action="ai-send"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === true).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === false, null, { timeout: 120000 });
  await sleep(120);
}
async function openConsult(page) {
  if (!(await page.evaluate(() => !!document.querySelector('.gw-ai')))) { await clickSel(page, '.gw [data-action="ai-toggle"]'); await page.waitForSelector('.gw-ai'); }
}
/** 대화 지우기 (물음에 「대화 지우기」) */
async function clearTalk(page) {
  if (await page.evaluate(() => document.querySelector('.gw-ai [data-action="ai-clear"]')?.disabled !== false)) return;
  await clickSel(page, '.gw-ai [data-action="ai-clear"]');
  await page.waitForSelector('.gw-ai [data-action="ai-clear-yes"]');
  await clickSel(page, '.gw-ai [data-action="ai-clear-yes"]');
  await page.waitForFunction(() => !document.querySelector('.gw-ai [data-action="ai-clear-yes"]'));
}

/** 요청문의 [설정 목록]을 읽는다: 메뉴 이름 → 줄들 */
function parseList(user) {
  const at = user.indexOf('[설정 목록]');
  const end = user.indexOf('\n[바꾸자고 한 것]');
  const out = new Map();
  let cur = null;
  for (const line of user.slice(at, end).split('\n')) {
    const h = /^## (.+)$/.exec(line);
    if (h) { cur = []; out.set(h[1], cur); continue; }
    const m = /^\[([^\]\s]+)\] (.*)$/.exec(line);
    if (!m || !cur) continue;
    const parts = m[2].split(' | ');
    const get = (k) => { const p = parts.find((x) => x.startsWith(`${k}: `)); return p === undefined ? null : p.slice(k.length + 2); };
    const can = get('고를 수 있는 값');
    const row = { id: m[1], label: parts[0], cur: get('지금'), can, no: get('바꾸기'), where: get('저장') };
    row.stride = Number(/지금 값에서 (\d+)씩/.exec(can ?? '')?.[1] ?? 1);
    const num = can && /^(-?\d+)~(-?\d+).* \(정수\)$/.exec(can);
    row.kind = !can ? 'info' : num ? 'num' : /^정수( \(.+\))?, (화면의|지금 값에서)/.test(can) ? 'step' : /^글( \(최대 \d+자\))?, (한 줄|여러 줄은)/.test(can) ? 'text' : 'pick';
    if (num) { row.lo = Number(num[1]); row.hi = Number(num[2]); }
    if (row.kind === 'text') { row.max = Number(/최대 (\d+)자/.exec(can)?.[1] ?? 0); row.multi = can.includes('여러 줄'); }
    if (row.kind === 'pick') row.opts = can.split(' / ');
    cur.push(row);
  }
  return out;
}
const numOf = (s) => { const n = Number.parseInt(String(s ?? '').replace(/,/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const FORM = {
  'ms-roll.cos:tiers': (c) => `${c}\\n시험가|test tier|1|2|1`,
  'ms-roll.bm:tiers': (c) => `${c}\\n시험가|test tier|1|2|1`,
  'ms-desk.axes': (c) => `${c}\\n시험: 가, 나`,
  'pp-bounds': () => '70,30,-10,-50',
  'set-wallet-start': () => '12345',
};
/** 그 줄을 바꿀 새 값 (모델이 적을 글) */
function target(r, alt = false) {
  if (r.kind === 'pick') { const others = r.opts.filter((o) => o !== r.cur); return alt ? others.at(-1) : others[0]; }
  if (r.kind === 'num') { const c = numOf(r.cur); return String(c + 1 <= r.hi && !alt ? c + 1 : c - 1 >= r.lo ? c - 1 : c + 1); }
  if (r.kind === 'step') return String(numOf(r.cur) + (alt ? -1 : 1) * r.stride);
  // 꼴이 정해진 글 칸: 그 꼴에 맞는 글 (틀린 꼴은 원래 처리기가 받지 않는다)
  if (FORM[r.id]) return FORM[r.id](r.cur);
  const base = r.cur === '(빈 글)' ? '' : r.cur;
  const add = r.multi && base ? `${base}\\n시험` : base ? `${base} 시험` : '시험';
  return r.max && add.replace(/\\n/g, '\n').length > r.max ? `시험 ${base}`.slice(0, Math.max(2, r.max - 4)) : add;
}
const reached = (r, now, want) => (r.kind === 'pick' ? now.cur === want : r.kind === 'text' ? now.cur !== r.cur : numOf(now.cur) === Number(want));
/** 지금 보는 메뉴의 목록을 읽는다 (그 메뉴 화면을 열어 두면 코드가 그 메뉴를 펼친다) */
async function readMenu(page, name) {
  await send(page, '무엇을 바꿀 수 있어?', [SAY('네')]);
  const [system, user] = await lastReq(page);
  ok(!system.includes(MARK) && !user.includes(MARK), `${name}: 상담 요청에 채팅 글이 없다`);
  const list = parseList(user);
  ok(list.has(name), `${name}: 지금 보는 메뉴가 펼쳐진다`);
  return { rows: list.get(name), system, user, opened: [...list.keys()] };
}
/** 바꾸자고 함 → 동의. 돌아오는 것: 판에 적힌 줄 수, 알림 줄들 */
async function propose(page, rows, alt = false) {
  const set = rows.map((r) => `${r.id}=${target(r, alt)}`).join('\n');
  const n0 = (await logOf(page)).length;
  await send(page, '그렇게 바꾸자', [`${SAY('이렇게 바꿀까요?')}\n<set>\n${set}\n</set>`]);
  const mid = (await logOf(page)).slice(n0);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  const log = (await logOf(page)).slice(n0);
  const card = await page.evaluate(() => { const c = [...document.querySelectorAll('.gw-ai .ai-card')].at(-1); return c ? [...c.querySelectorAll('.ai-ch')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) : []; });
  const isNew = log.some((l) => l.startsWith('ai-card'));
  return { card: isNew ? card : [], dropped: mid.filter((l) => l.startsWith('ai-sys') && l.includes('뺐어요')), failed: log.filter((l) => l.includes('바꾸지 못했어요')) };
}
async function undoLast(page) {
  const n = await page.evaluate(() => document.querySelectorAll('.gw-ai .ai-card').length);
  if (!n) return 'no-card';
  await page.evaluate(() => [...document.querySelectorAll('.gw-ai .ai-card')].at(-1).querySelector('[data-action="ai-undo"]').click());
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('.gw-ai .ai-card')].at(-1); const b = c.querySelector('button'); const last = document.querySelector('.gw-ai .gw-ai-log > :last-child'); return (b?.textContent === '되돌렸어요' && !document.querySelector('.gw-ai [name="ai-q"]').disabled) || last?.textContent.includes('되돌리지 못했어요'); }, null, { timeout: 120000 });
  await sleep(150);
  const last = (await logOf(page)).at(-1);
  return last.includes('되돌리지 못했어요') ? last : 'ok';
}
function diffKeys(a, b, vals = false) {
  const A = JSON.parse(a); const B = JSON.parse(b);
  const flat = (o) => { const out = {}; for (const [k, v] of Object.entries(o.chat)) out[`chat ${k}`] = v; for (const [k, v] of Object.entries(o.store)) { let j = null; try { j = JSON.parse(v); } catch { /* 글 그대로 */ } if (j && typeof j === 'object') { const walk = (p, x) => { if (x && typeof x === 'object' && !Array.isArray(x)) for (const [kk, vv] of Object.entries(x)) walk(`${p}.${kk}`, vv); else out[p] = JSON.stringify(x); }; walk(k, j); } else out[k] = v; } return out; };
  const fa = flat(A); const fb = flat(B);
  // 빈 값과 없는 값은 같은 것으로 본다 (기본값으로 돌아간 변수)
  const empty = (v) => v === undefined || v === '' || v === '""' || v === 'null';
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter((k) => fa[k] !== fb[k] && !(empty(fa[k]) && empty(fb[k])));
  return vals ? keys.map((k) => `${k}: ${String(fa[k] ?? '(없음)').slice(0, 40)} → ${String(fb[k] ?? '(없음)').slice(0, 40)}`) : keys;
}

/** 메뉴 하나를 전수로: 읽기 → 전부 바꾸기 → 대조 → 되돌리기 → 못 바뀐 줄은 하나씩 */
async function sweepMenu(page, node, name, into) {
  await goNode(page, node);
  await sleep(250);
  await clearTalk(page);
  const before = await snap(page);
  const first = await readMenu(page, name);
  const rows = first.rows;
  eq(new Set(rows.map((r) => r.id)).size, rows.length, `${name}: id 가 겹치지 않는다`);
  // 화면의 줄 이름이 모두 목록에 있다
  const labels = await page.evaluate(() => {
    const own = (h) => (h ? [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '');
    return [...new Set([...document.querySelectorAll('.gw .gw-body .ps-row')].filter((r) => !r.closest('.ck-ph, .fl-ph, [hidden]') && !r.classList.contains('lc-row') /* 로어북 점검 결과 줄: 설정이 아니다 */).map((r) => own(r.querySelector('.ps-label > b'))).filter(Boolean))];
  });
  const missing = labels.filter((l) => !rows.some((r) => r.label.split(' · ').includes(l) || r.label.includes(l)));
  eq(missing.join(', '), '', `${name}: 화면의 줄 이름이 모두 목록에 있다`);
  const can = rows.filter((r) => r.kind !== 'info' && !r.no);
  // 「사용」 같은 큰 스위치는 맨 뒤에 (먼저 끄면 딸린 줄이 잠긴다)
  const master = (r) => /(^|· )사용$/.test(r.label);
  // 큰 스위치는 한 번에 바꾸는 묶음에 넣지 않고 따로 하나씩 한다 (끄면 딸린 줄이 화면에서 사라져 대조할 수 없다)
  const order = can.filter((r) => !master(r));
  const alone = can.filter(master);
  const res = { menu: name, node, rows: rows.length, info: rows.filter((r) => r.no && !r.no.includes('잠김')).length, locked: rows.filter((r) => r.no?.includes('잠김')).length, kinds: {}, changed: 0, single: [], cannot: [], undo: 'ok', leftover: [], screen: [] };
  for (const r of can) res.kinds[r.kind] = (res.kinds[r.kind] ?? 0) + 1;
  into.push(res);
  let doneIds = new Set();
  if (order.length) {
    const p = await propose(page, order);
    const after = await readMenu(page, name);
    for (const r of order) {
      const now = after.rows.find((x) => x.id === r.id);
      if (now && reached(r, now, target(r))) doneIds.add(r.id);
    }
    res.changed = doneIds.size;
    res.card = p.card.length;
    res.dropped = p.dropped;
    ok((await snap(page)) !== before || !doneIds.size, `${name}: 바꾼 값이 저장소에 적혔다`);
    res.undo = await undoLast(page);
    // 되돌린 뒤: 화면의 값이 처음과 같은가 (screen), 저장소 글자까지 같은가 (leftover — 「없음」이 「기본값을 적음」으로 바뀐 것은 값은 같고 글자만 다르다)
    const back = await readMenu(page, name);
    res.screen = rows.filter((r) => back.rows.find((x) => x.id === r.id)?.cur !== r.cur).map((r) => `${r.label}: ${r.cur} → ${back.rows.find((x) => x.id === r.id)?.cur}`);
    res.leftover = diffKeys(before, await snap(page), true);
  }
  // 한 번에 못 바뀐 줄: 처음 상태에서 하나씩 (다른 값으로도 한 번)
  for (const r of [...order.filter((x) => !doneIds.has(x.id)), ...alone]) {
    let okOne = false;
    let why = '';
    for (const alt of [false, true]) {
      await clearTalk(page);
      const cur = (await readMenu(page, name)).rows.find((x) => x.id === r.id);
      if (!cur || cur.no || cur.kind === 'info') { why = cur ? `지금 잠김 (${cur.no})` : '화면에 없음'; break; }
      const want = target(cur, alt);
      if (want === undefined || want === cur.cur) { why = '고를 다른 값이 없음'; continue; }
      const p = await propose(page, [cur], alt);
      const now = (await readMenu(page, name)).rows.find((x) => x.id === r.id);
      if (now && reached(cur, now, want)) { okOne = true; const u = await undoLast(page); if (u !== 'ok') why = u; break; }
      why = [...p.dropped, ...p.failed].join(' / ') || `값이 그대로 (${cur.cur} → ${want})`;
      if (p.card.length) await undoLast(page);
    }
    if (okOne) res.single.push(why ? `${r.label} (되돌리기: ${why})` : r.label);
    else res.cannot.push(`${r.label} [${r.id}]: ${why}`);
  }
  if (res.single.length || res.cannot.length) { const end = await readMenu(page, name); res.screen2 = rows.filter((r) => end.rows.find((x) => x.id === r.id)?.cur !== r.cur).map((r) => `${r.label}: ${r.cur} → ${end.rows.find((x) => x.id === r.id)?.cur}`); res.leftover2 = diffKeys(before, await snap(page), true); }
  console.log(`  ${name}: 줄 ${res.rows} (안내 ${res.info}, 잠김 ${res.locked}) · 한 번에 ${res.changed}/${order.length} (판 ${res.card ?? 0}줄) · 하나씩 ${res.single.length} · 못 바꿈 ${res.cannot.length} · 되돌린 뒤 화면 값 다름 ${res.screen.length + (res.screen2?.length ?? 0)} · 저장소 글자 다름 ${res.leftover.length}${res.undo === 'ok' ? '' : ` · ${res.undo}`}`);
  return res;
}
const menuNodes = (page) => page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((e) => ({ node: e.dataset.value, name: (e.querySelector(':scope > span')?.textContent ?? '').trim() })).filter((x) => x.node.startsWith('set:')));

/* ── 1·2. 시작 뒤: 모든 메뉴 ── */
let allRows = [];
let menuNames = [];
try {
 const {page}=await boot(browser,fx,started(),PC);await openWin(page);await openEditor(page,'set:cos');await sleep(350);await openConsult(page);
 const list=await readMenu(page,'우주 쇼핑몰');const id='ms-tier.cos:0:lo';
 const before=list.rows.find(r=>r.id===id);
 console.log('변경 전',JSON.stringify(before));
 await send(page,'최저가 하한을 백만원으로', [SAY('바꿀까요?')+'\n<set>\n'+id+'=백만원\n</set>']);
 console.log('제안',JSON.stringify((await logOf(page)).slice(-3)));
 await send(page,'적용', [SAY('적용했습니다.')+'\n<apply>yes</apply>']);
 console.log('적용 결과',JSON.stringify((await logOf(page)).slice(-3)));
 const after=(await readMenu(page,'우주 쇼핑몰')).rows.find(r=>r.id===id);
 console.log('변경 후',JSON.stringify(after));
 if (after.cur === '(빈 글)') throw Error('기존 숫자 하한이 빈 글로 저장됨');
}finally{await browser.close();}
