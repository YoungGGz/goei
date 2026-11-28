// 재확인 KL: K/나/run-t2.mjs 사본 (OUT 만 바꿈)
// 3차 K4 세계 탭 편집기 · T2 (실제 리스AI 996a553 vite dev + 가짜 모델 서버 8802). 사용: FAKE_URL=http://<IP>:8802 node run-t2.mjs [절 글자] [--w 1280 --h 800]
// 시작 상태: setup() → loadState(S-관리국-3턴). 실제 단추(플러그인 창 iframe 안 data-action)로 고치고, 리스아이 입력칸으로 보내 가짜 서버가 받은 본편 요청을 본다.
import { openT2 } from '../../틀/risu-t2.mjs';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const HERE = fileURLToPath(new URL('./', import.meta.url));
const OUT = '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-rest2/out-kl/';
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = (argv.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const SIZE = `${W}x${H}`;
const touch = W < 600 || (Math.min(W, H) < 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, what, expect, ref, ok, actual, evidence = '') {
  results.push({ id: `${id}@${SIZE}`, what, expect, ref, ok: ok === null ? 'info' : !!ok, actual, evidence });
  console.log(`${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'} [${id}] ${what}${ok ? '' : `\n   기대: ${expect}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
const AGE = /^(\s*[-*]?\s*(?:Age|나이)\s*[:：]).*$/gim;
const scrub = (t) => String(t).replace(AGE, '$1 [생략]').replace(/\((\d+|early \d+s|mid \d+s|late \d+s)\//g, '([생략]/');

const t = await openT2({ via: 'plain', width: W, height: H, touch, out: OUT });
const STATUS = '[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';
await t.fake('reset', {});
await t.fake('rules', { rules: [
  { id: 'router', route: 'aux', match: 'Router|selected', reply: '{"selected":[],"new_characters":[]}' },
  { id: 'director', route: 'aux', match: 'Director|notes', reply: '{"notes":[]}' },
  { id: 'aux', route: 'aux', reply: '{}' },
  { id: 'hold', route: 'main', matchLast: '늦은답', hold: true, reply: `늦게 온 답이다. #{{seq}}\n\n${STATUS}` },
  { id: 'main', route: 'main', reply: `장면이 이어진다. #{{seq}}\n\n${STATUS}` },
] });
const card = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
  const e = st.DBState.db.characters[ci].globalLore.find((x) => x.comment === 'Directory');
  return e ? JSON.parse(e.content) : null;
});
const mainReqs = async (since) => (await t.fakeLog(since, 'main'));
const lastMain = async (since) => { const l = await t.fake(`log?since=${since}&route=main&full=1`); return l.at(-1); };
const reqText = (rec) => (rec?.body?.messages ?? []).map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const dumpReq = (name, rec) => { writeFileSync(`${OUT}${name}`, scrub(reqText(rec))); return `out/${name}`; };

// 플러그인 창 안 도우미
const fe = (fn, arg) => t.feval(fn, arg);
const act = async (action, value, wait = 400) => { const ok = await fe(([a, v]) => { const e = [...document.querySelectorAll(`[data-action="${a}"]`)].find((x) => v === undefined || x.dataset.value === v); if (e) { e.click(); return true; } return false; }, [action, value]); await sleep(wait); return ok; };
const typeIn = async (sel, v) => { const F = t.F(); const loc = F.locator(sel).first(); await loc.scrollIntoViewIfNeeded().catch(() => {}); await loc.fill(v); await sleep(100); };
const val = (sel) => fe((s) => document.querySelector(s)?.value ?? null, sel);
const openEd = async (node) => {
  await t.openWindow('.gx');
  await sleep(600);
  await fe(() => (document.querySelector('.gx [data-action="ed-open"]') ?? document.querySelector('.gx [data-action="prefs-open"]'))?.click());
  await t.frame('.gw .gw-win');
  await sleep(500);
  if (node) {
    await fe(() => document.querySelector('.gw [data-action="ed-tab"][data-value="world"]')?.click());
    await sleep(300);
    await fe((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`)?.click(), node);
    await sleep(500);
  }
};
const selRec = async (name) => {
  // 폰에서는 목록 대신 드롭다운
  const ok = await act('ed-sel', name, 500);
  if (!ok) await fe((n) => { const s = document.querySelector('.gw select.gw-list-pick'); if (s) { s.value = n; s.dispatchEvent(new Event('change', { bubbles: true })); } }, name);
  await sleep(500);
};
const closeEd = async () => { await fe(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click()); await sleep(800); await t.closeWindow(); await sleep(300); };
const shot = (name) => t.page.screenshot({ path: `${OUT}${name}-${SIZE}.png` });
const waitCard = async (pred, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const c = await card(); if (pred(c)) return c; await sleep(300); } return card(); };

await t.setup();
const r0 = await t.loadState(fileURLToPath(new URL('../../틀/states/S-관리국-3턴.json', import.meta.url)));
await sleep(1500);
check('T2-00', 'setup → S-관리국-3턴 넣기', '메시지 7', 'states/README.md', r0.messages === 7 || r0.messages?.length === 7, { messages: r0.messages });
const gxText = () => fe(() => document.querySelector('.gx')?.innerText ?? '');
const gwText = () => fe(() => document.querySelector('.gw')?.innerText ?? '');
const hints = () => fe(() => [...document.querySelectorAll('.gw .gw-notice, .gw .gx-err, .gw [role="status"]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 6));
try {
// ═══ R57 괴이 표시 이름 ═══
if (want('A')) {
  await t.openWindow('.gx'); await sleep(800);
  await act('tab', 'board', 900);
  const b0 = await gxText();
  await shot('R57-0_상황판_고치기전');
  await t.closeWindow(); await sleep(400);
  await openEd('anomaly');
  await selRec('명일 아파트');
  await typeIn('.gw [data-input="dir"][data-key="label|명일 아파트"]', '명일 아파트 시험');
  const c1 = await waitCard((c) => c?.괴이?.['명일 아파트']?.label === '명일 아파트 시험');
  await shot('R57-1_표시이름');
  await closeEd();
  await t.openWindow('.gx'); await sleep(800);
  await act('tab', 'board', 900);
  const b1 = await gxText();
  await shot('R57-2_상황판_고친뒤');
  await act('tab', 'map', 900);
  const m1 = await gxText();
  await shot('R57-3_지도_고친뒤');
  await t.closeWindow();
  const s0 = await t.fakeSeq();
  await t.send('주변을 둘러본다.');
  const rec = await lastMain(s0);
  const p = dumpReq(`R57-4_본편요청-${SIZE}.txt`, rec);
  const an = reqText(rec).split('\n').filter((l) => /명일 아파트/.test(l) && /^\[AN\|/.test(l));
  await t.openWindow('.gx'); await sleep(800); await act('tab', 'board', 900);
  const b2 = await gxText();
  await shot('R57-5_상황판_한턴뒤');
  await t.closeWindow();
  const pick = (s) => (s.match(/명일 아파트[^\n]{0,6}/g) ?? []).slice(0, 6);
  check('R57', '실제 리스아이: 괴이 「표시 이름」을 바꾸면 이미 상황판에 뜬 항목 이름은?', '화면 설명 「상황판과 지도에 보이는 이름」 → 새 이름', '화면 설명 · catalog.ts:89', /명일 아파트 시험/.test(b1), { saved: c1?.괴이?.['명일 아파트']?.label, before: pick(b0), boardAfter: pick(b1), mapAfter: pick(m1), boardNextTurn: pick(b2), reqAN: an }, p);
}
// ═══ R58 조직 이름 바꾼 뒤 안내 줄 ═══
if (want('B')) {
  await openEd('org');
  await act('ed-add-toggle', undefined, 500);
  await typeIn('.gw [name="ed-new-name"]', '시험조직1');
  await act('ed-add', undefined, 900);
  const c1 = await waitCard((c) => !!c && JSON.stringify(c).includes('시험조직1'));
  const h1 = await hints();
  await shot('R58-1_조직추가');
  await selRec('시험조직1');
  const h2 = await hints();
  await typeIn('.gw [name="dir-org-name"]', '시험조직2');
  await act('dir-org-rename', undefined, 900);
  const c2 = await waitCard((c) => !!c && JSON.stringify(c).includes('시험조직2'));
  await sleep(800);
  const h3 = await hints();
  const title = await fe(() => document.querySelector('.gw .gw-detail h2')?.textContent ?? '');
  await shot('R58-2_이름바꾼뒤');
  await closeEd();
  check('R58', '실제 리스아이: 조직 「시험조직1」 추가 → 이름 「시험조직2」로 바꾼 뒤 위 안내 줄', '옛 이름 안내(「시험조직1」 기록을 만들었어요)가 남지 않음', '11-05 QC 기준(결과.md R58)', !h3.some((x) => x.includes('시험조직1')), { afterAdd: h1, afterSel: h2, afterRename: h3, title, saved1: !!c1, saved2: !!c2 });
}
// ═══ R59 요원 목록 「소속 미정」 경고 줄 ═══
if (want('C')) {
  await openEd('agent');
  await selRec('고그니쟈');
  await act('dir-org-pick', '|고그니쟈', 700);
  const c1 = await waitCard((c) => c?.요원?.['고그니쟈'] && !c.요원['고그니쟈'].affiliation);
  await closeEd();
  await openEd('agent');
  const ag = await gwText();
  await shot('R59-1_세계편집기_요원목록');
  const listBadge = await fe(() => [...document.querySelectorAll('.gw [data-action="ed-sel"]')].filter((e) => /고그니쟈/.test(e.textContent)).map((e) => e.innerText.replace(/\s+/g, ' ')));
  await fe(() => document.querySelector('.gw [data-action="ed-node"][data-value="base"]')?.click()); await sleep(800);
  const bs = await gwText();
  await shot('R59-2_거점페이지');
  await closeEd();
  // 명부(상황판 「명부」/요원 목록 창) — 창 안 명부 탭
  await t.openWindow('.gx'); await sleep(800);
  const tabs = await fe(() => [...document.querySelectorAll('.gx [data-action="tab"], .gx [data-action="nav-tab"]')].map((e) => `${e.dataset.action}:${e.dataset.value}`));
  let dirTxt = null;
  for (const v of ['directory', 'roster', 'dir', 'agents']) { if (await act('tab', v, 900) || await act('nav-tab', v, 900)) { dirTxt = await gxText(); break; } }
  await shot('R59-3_명부');
  await t.closeWindow();
  const re = /소속을 정하지 않은 요원[^\n]*/;
  check('R59', '실제 리스아이: 고그니쟈 소속 「미정」 뒤 세계 편집기 요원 목록·거점 페이지·명부의 경고', '(관찰) 요원 목록에 경고 줄? 거점 페이지 경고 줄, 명부 배지', '결과.md R59 (시키지 않은 UI)', null, { saved: c1?.요원?.['고그니쟈']?.affiliation ?? null, agentPage: (ag.match(re) ?? [null])[0], agentListItem: listBadge, basePage: (bs.match(re) ?? [null])[0], tabs, directory: dirTxt ? { warn: (dirTxt.match(/(소속[^\n]{0,40})/g) ?? []).slice(0, 5), 고그니쟈: (dirTxt.match(/고그니쟈[^\n]{0,40}/g) ?? []).slice(0, 3) } : null });
}
} catch (e) { check('예외', String(e?.stack ?? e).slice(0, 800), '', '', false, null); await shot('error').catch(() => {}); }
writeFileSync(`${OUT}결과_R57-59-${SIZE}.json`, JSON.stringify(results, null, 1));
await t.close();
