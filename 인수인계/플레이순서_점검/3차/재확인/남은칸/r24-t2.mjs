// 재확인 남은칸 R24 — T2 실제 리스AI: 「데이터베이스 수정」 권한(dbWrite, 3일마다 다시 물음)을 거절한 뒤
// 출동 「출발」·커스텀 임무 요청·응답 처리·손으로 종료·명부 순서 저장이 조용히 안 써질 때 화면과 요청.
// 거절 만들기는 재확인/F/re-f-t2.mjs R23 과 같음(권한 저장소 lastGrantTime 4일 전 → 새로고침 → no). PC 1280×800.
// 쓰는 법: source /tmp/t2-remain/t2-env.sh; OUT=<폴더> node r24-t2.mjs
import { readFileSync } from 'node:fs';
import { session, sleep, flat, MAIN_REPLY } from './lib.mjs';

const DIR = {};
{ const raw = readFileSync(new URL('../../../../../지침/이동_임무_지시문.txt', import.meta.url), 'utf8'); for (const m of raw.matchAll(/===([A-Z]+)===\n([\s\S]*?)(?====|$)/g)) DIR[m[1]] = m[2].trim(); }
const hasDir = (s) => String(s).includes(DIR.COMMON.slice(0, 60));
const lastUser = (rec) => { const ms = rec?.body?.messages ?? []; const u = [...ms].reverse().find((m) => m.role === 'user'); return typeof u?.content === 'string' ? u.content : JSON.stringify(u?.content ?? ''); };
const agLine = (rec, pid) => (flat(rec).match(new RegExp(`(NEW )?\\[AG\\|${pid}\\|[^\\]\\n]*\\]`)) ?? [null])[0];
const st2 = (bal) => `[▣|2025.03.14|10:40 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|${bal}]`;

const S = await session('R24');
const { t, step, note } = S;
const world = async () => { const ss = await S.ss(); try { return JSON.parse(ss.$goei_world); } catch { return null; } };
const walletLog = async () => { const ss = await S.ss(); try { return JSON.parse(ss.$st_wallet).log.map((e) => e.amount); } catch { return null; } };
const notice = () => S.fe(() => [...document.querySelectorAll('.gx .gx-err, .gx .gx-note, .gx-toast, .gx [role="alert"], .gx .gx-notice, .gw .gx-err')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4)).catch(() => []);
const winShown = () => t.R(() => { const c = document.querySelector('[x-goei-container]') ?? document.querySelector('iframe'); return !!c && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 10; }).catch(() => false);
const msgs = async () => (await t.chatState(false)).message ?? [];
/** 실제 마우스 누름 (el.click() 으로는 지도 팝업·목표 고르기가 안 먹음) */
const rc = async (sel, wait = 700, nth = 'first') => { const F = await S.frame(); await F.locator(sel)[nth]().click({ timeout: 10000 }); await sleep(wait); };
const goMap = async () => { await S.winOpen(); if (!(await S.has('.gx-canvas'))) { await rc('.gx-nav .gx-nb:not(.mob)[data-value="map"]', 900); } };
async function pickDepart(agent, avoid = []) {
  await goMap();
  const evs = await S.fe(() => [...document.querySelectorAll('[data-action="ev-pop"]')].map((e) => e.dataset.value).filter((v) => v.startsWith('an|')));
  const ev = evs.find((v) => !avoid.includes(v)) ?? evs[0];
  await rc(`[data-action="ev-pop"][data-value="${ev}"]`, 600);
  await rc('.ev-pop [data-action="pick-event"]', 2500, 'last');
  await rc(`.gx-acard.pick[data-value="${agent}"]`, 500);
  return { ev, goal: await S.fe(() => document.querySelector('.gx-goal b')?.textContent.trim() ?? null) };
}
async function goMission() {
  await S.winOpen();
  if (!(await S.fe(() => document.querySelector('.gx')?.dataset.tab === 'mission' && !!document.querySelector('.gx-mission')))) {
    if (!(await S.has('.gx-mswap[data-value="mission"]'))) await rc('.gx-nav .gx-nb:not(.mob)[data-value="map"]', 900);
    await rc('.gx-mswap[data-value="mission"]', 900);
  }
}
async function pickMission(q = '금지된 비디오') {
  await goMission();
  await rc('[data-action="mission-kind"][data-value="an"]', 700);
  await S.setVal('.gx-search', q, 'input', 900);
  await rc('.gx-mlist li.gx-mx [data-action="mission-open"]', 600);
  await rc('.gx-mlist li.gx-mx.open [data-action="mission-pick"]', 2500);
  return S.fe(() => document.querySelector('.gx-goal b')?.textContent.trim() ?? null);
}
async function endPress(name) {
  await S.winOpen();
  if (!(await S.has('.gx-board'))) await rc('.gx-nav .gx-nb:not(.mob)[data-value="board"]', 900);
  if (!(await S.has('.gx-opview [data-action="end-event"]'))) { const F = await S.frame(); await F.locator('.gx-board li.gx-oprow', { hasText: name }).first().click(); }
  await sleep(400);
  await rc('.gx-opview [data-action="end-event"]', 700);
  return S.fe(() => document.querySelector('.gx-opview [data-action="end-event"]')?.getAttribute('aria-label') ?? null);
}
const listed = (name) => S.fe((n) => [...document.querySelectorAll('.gx-board li.gx-oprow')].some((li) => li.textContent.includes(n)), name);
const rosterOrder = () => S.fe(() => [...document.querySelectorAll('.gw [data-action="dir-move"][data-value^="up|"]')].map((e) => e.dataset.value.slice(3)));
const charAgentOrder = () => t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const ch = st.DBState.db.characters.at(-1); const e = (ch.globalLore ?? []).find((x) => /명부|Directory|directory/.test(String(x.comment ?? '')) && String(x.content ?? '').includes('잼트리')); if (!e) return null; const s = String(e.content); return ['쟈알디', '스팡달', '잼트리'].map((n) => [n, s.indexOf(n)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); });
/** 출동·임무 단추를 누른 뒤 전송·답·저장까지 기다림 */
const afterSend = async (s0) => { await sleep(2500); try { await t.waitIdle(60000); } catch {} await sleep(2500); const l = await S.log(s0); return { main: l.filter((r) => r.route === 'main'), aux: l.filter((r) => r.route === 'aux') }; };

try {
  await S.fakeReset([{ id: 'r24-main', route: 'main', reply: `잼트리가 현장으로 간다. (R24 본편 #{{seq}})\n[AG|P002|작전투입|명일 아파트 현장]\n\n${st2(120000)}` }]);
  note('setup', await t.setup());
  note('load', await S.loadState('S-관리국-3턴.json'));
  await sleep(2000);
  const w0 = await world();
  note('처음 상황판', { an: w0?.an?.map((a) => [a.name, a.state]), P002: w0?.agents?.P002?.st, P003: w0?.agents?.P003?.st });

  let firstEv = null;
  // ── 대조: 권한 있을 때 출동 ──
  {
    const pk = await pickDepart('P002');
    firstEv = pk.ev;
    const n0 = (await msgs()).length; const s0 = await S.seq();
    await rc('[data-action="depart"]', 500);
    const r = await afterSend(s0);
    const m = await msgs(); const w = await world();
    step('대조 출동(권한 있음)', '카드가 놓이고 자동 전송, 요청 마지막 user 에 지시문, 응답 처리로 P002 작전투입', '-').check(r.main.length === 1 && hasDir(lastUser(r.main[0])) && w?.agents?.P002?.st === '작전투입', { pick: pk, addedMsgs: m.length - n0, main: r.main.length, directive: r.main.map((x) => hasDir(lastUser(x))), P002: w?.agents?.P002?.st, wallet: await walletLog() });
  }

  // ── 권한 거절 만들기 ──
  const pname = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return st.DBState.db.plugins.map((p) => p.name); });
  note('권한 저장소', await t.R(async (name) => new Promise((resolve) => { const rq = indexedDB.open('plugin_permissions'); rq.onsuccess = () => { const tx = rq.result.transaction('plugin_permissions', 'readwrite'); const os = tx.objectStore('plugin_permissions'); os.put(Date.now() - 4 * 24 * 3600 * 1000, `${name}_dbWrite_lastGrantTime`); tx.oncomplete = () => resolve('ok'); tx.onerror = () => resolve(String(tx.error)); }; rq.onerror = () => resolve(String(rq.error)); }), pname[0]));
  await t.ctx.addInitScript(() => { window.__t2Answer = 'no'; });
  await t.reload();
  await sleep(3000);
  await S.fakeReset([{ id: 'r24-main2', route: 'main', reply: `스팡달이 움직인다. (R24 거절 뒤 본편 #{{seq}})\n[AG|P003|작전투입|소라 랜드 현장]\n\n${st2(100000)}` }]);

  // ── C2 출동 「출발」 ──
  let afterDepart;
  {
    const w0b = await world();
    const pk = await pickDepart('P003', [firstEv]);
    const n0 = (await msgs()).length; const s0 = await S.seq();
    await rc('[data-action="depart"]', 1500);
    const nt = await notice(); const open = await winShown();
    await t.shot('R24-C2-출동-거절뒤');
    const r = await afterSend(s0);
    const m = await msgs(); const w = await world();
    const al = await t.alerts();
    afterDepart = { m, w, r };
    step('C2 출동 「출발」(권한 거절 뒤)', '저장이 안 됐으면 보내지 않거나 안내 (R24 기대)', 'R24').check(false, {
      pick: pk, noticeRightAfter: nt, windowOpenRightAfter: open, addedMsgs: m.length - n0, cardInChat: m.some((x) => String(x.data).startsWith('%%SCENE_CARD')),
      mainSent: r.main.length, lastUser: r.main.map((x) => lastUser(x).slice(0, 160)), directive: r.main.map((x) => hasDir(lastUser(x))),
      dbWriteAsked: al.filter((a) => /modify your database|데이터베이스/.test(a.msg)).length, P003before: w0b?.agents?.P003?.st,
    });
    // ── C4 응답 처리 ──
    const last = m.filter((x) => x.role === 'char').at(-1);
    step('C4 응답 처리(권한 거절 뒤)', '답의 상황판 변경(P003 작전투입)이 반영되거나 안내', 'R24').check(w?.agents?.P003?.st === '작전투입', { P003: w?.agents?.P003?.st, tagLeftInStored: /\[AG\|P003\|/.test(String(last?.data ?? '')), wallet: await walletLog() });
    const s1 = await S.seq();
    const tr = await S.turn('현장을 살핀다.');
    const w2 = await world();
    step('C4 다음 턴', '다음 요청에 P003 작전투입', 'R24').check(/작전투입/.test(agLine(tr.main[0], 'P003') ?? ''), { nextP003Line: agLine(tr.main[0], 'P003'), afterNextP003: w2?.agents?.P003?.st, since: s1 });
    await t.shot('R24-C4-다음턴');
  }
  // ── C6 커스텀 임무 요청 ──
  {
    const goal = await pickMission();
    const n0 = (await msgs()).length; const s0 = await S.seq();
    await rc('[data-action="mission-send"]', 1500);
    const nt = await notice(); const open = await winShown();
    await t.shot('R24-C6-임무-거절뒤');
    const r = await afterSend(s0);
    const m = await msgs(); const w = await world();
    const all = r.main.map(flat).join('\n');
    step('C6 임무 요청(권한 거절 뒤)', '저장이 안 됐으면 보내지 않거나 안내 (R24 기대)', 'R24').check(false, { goal, noticeRightAfter: nt, windowOpenRightAfter: open, addedMsgs: m.length - n0, mainSent: r.main.length, lastUser: r.main.map((x) => lastUser(x).slice(0, 160)), directive: r.main.map((x) => hasDir(lastUser(x))), newLine: /NEW \[AN\|[^\n]*금지된 비디오/.test(all), pending: w?.pending ?? null });
  }
  // ── C8 손으로 종료(두 번) ──
  {
    const w = await world();
    const target = w.an.find((a) => a.state === '활성')?.name;
    const l1 = await endPress(target);
    const l2 = await endPress(target);
    await sleep(1200);
    const nt = await notice();
    const w2 = await world();
    const ls = await listed(target);
    await t.shot('R24-C8-종료-거절뒤');
    step('C8 손으로 종료(권한 거절 뒤)', '끝나지 않았으면 화면도 남고 안내 (R24 기대: 안내)', 'R24').check(nt.length > 0, { target, firstLabel: l1, secondLabel: l2, notice: nt, stillActive: (w2?.an ?? []).some((a) => a.name === target && a.state === '활성'), listed: ls });
  }
  // ── H1 명부 순서 ──
  {
    await S.winClose().catch(() => {});
    await S.ed('agent');
    const o0 = await rosterOrder(); const c0 = await charAgentOrder();
    await rc('.gw [data-action="dir-move"][data-value="up|잼트리"]', 2500);
    const o1 = await rosterOrder(); const nt = await S.fe(() => [...document.querySelectorAll('.gw .gx-err, .gw .gx-hint, .gw .gw-note, .gx-toast')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4));
    const c1 = await charAgentOrder();
    await t.shot('R24-H1-명부-거절뒤');
    await S.edClose();
    await sleep(800);
    await S.ed('agent');
    const o2 = await rosterOrder();
    await S.edClose();
    step('H1 명부 순서(권한 거절 뒤)', '저장이 안 됐으면 안내, 화면 순서 = 카드 순서', 'R24').check(nt.length > 0, { before: o0, rightAfter: o1, reopened: o2, cardBefore: c0, cardAfter: c1, notice: nt });
  }
  note('알림 전부', await t.alerts());
} catch (e) {
  step('예외', '', '-').check(false, String(e?.stack ?? e).slice(0, 1500));
  try { await t.shot('R24-FAIL'); } catch {}
} finally {
  S.rec.errors = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  await S.close();
}
