// K9 화면 설정 · PC 1280×800: 기본값 읽기 → 하나씩 실제 클릭으로 바꾸고 저장 자리·창 변화·캡처 → 기본값으로 되돌림
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const gx = () => t.F().evaluate(() => { const g = document.querySelector('.gx'); const p = g?.querySelector('.gx-panel'); const r = p?.getBoundingClientRect(); return g ? { theme: g.dataset.theme, nav: g.dataset.nav, wikiSide: g.dataset.wikiSide, frame: g.dataset.frame, frameHidden: g.dataset.frameHidden ?? null, bg: g.style.background, panel: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null, navX: (() => { const n = g.querySelector('.gx-nav'); const q = n?.getBoundingClientRect(); return q ? Math.round(q.x) : null; })(), agents: g.querySelector('.ag-wall, .ag-list, [class*="ag-"]')?.className ?? null } : null; });
  const gw = () => t.F().evaluate(() => { const w = document.querySelector('.gw .gw-win'); const r = w?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight } : null; });
  const prefs = () => C.store('goei:prefs');
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k9-pc ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };

  // 0. 기본 상황판·설정 화면
  await C.open();
  await C.shot('k9-pc-01-상황판-기본');
  const g0 = await gx();
  await C.openSet();
  await C.node('set:screen');
  await C.shot('k9-pc-02-설정화면-기본-위');
  await t.F().evaluate(() => { const b = document.querySelector('.gw .gw-body, .gw .gw-main, .gw [class*="scroll"]'); const el = [...document.querySelectorAll('.gw *')].find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible'); (el ?? b)?.scrollBy(0, 700); });
  await sleep(300); await C.shot('k9-pc-03-설정화면-기본-중간');
  await t.F().evaluate(() => { const el = [...document.querySelectorAll('.gw *')].find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible'); el?.scrollBy(0, 2000); });
  await sleep(300); await C.shot('k9-pc-04-설정화면-기본-아래');
  const labels = ['테마', '메뉴 위치', '펼친 폴드 화면 배치', '펼친 폴드 화면 배율', '펼친 폴드 창 가로', '펼친 폴드 창 세로', '위키 목록 위치', '요원 칸', '창 바깥 불투명도', '호출 진행 창', '외부 프레임', '설정 창 폭'];
  const rows = {}; for (const l of labels) rows[l] = await C.row(l);
  await step('기본값 읽기', '테마 다크(이 채팅), 메뉴 왼쪽, 폴드 PC·70·95·95, 위키 오른쪽, 요원 모니터, 불투명도 50, 진행 창 ON, 프레임 일반 태블릿, 설정 창 폭 90 — 테마 말고 모두 「이 기기」', 'core/settings.ts 185-190 기본값, setdef/settings.ts; K-10', async () => {
    const want = { '테마': ['다크'], '메뉴 위치': ['왼쪽'], '펼친 폴드 화면 배치': ['PC'], '위키 목록 위치': ['오른쪽'], '요원 칸': ['모니터'], '호출 진행 창': ['ON'], '외부 프레임': ['일반 태블릿'], '설정 창 폭': ['90%'] };
    const okSeg = Object.entries(want).every(([k, v]) => JSON.stringify(rows[k]?.on) === JSON.stringify(v));
    const okNum = rows['펼친 폴드 화면 배율']?.vals[0] === '70' && rows['펼친 폴드 창 가로']?.vals[0] === '95' && rows['펼친 폴드 창 세로']?.vals[0] === '95' && rows['창 바깥 불투명도']?.vals[0] === '50';
    return { actual: { rows, gx: g0, gw: await gw(), prefs: await prefs() }, ok: okSeg && okNum };
  });
  // 설정 창 폭 90% 기본 → 실제 폭
  await step('설정 창 폭 기본 90%', '창 폭 ≈ 화면 90% (상한 있으면 그 값)', 'setdef 설정 창 폭 help', async () => { const g = await gw(); return { actual: g, ok: !!g && Math.abs(g.w / g.vw - 0.9) < 0.03 }; });

  // 1. 메뉴 위치 → 오른쪽
  await C.seg('메뉴 위치', '오른쪽');
  const p1 = await prefs();
  await C.closeSet(); await sleep(500);
  const g1 = await gx(); await C.shot('k9-pc-05-메뉴오른쪽');
  await step('메뉴 위치 오른쪽', 'prefs.nav=right, 창 data-nav=right, 메뉴가 창 오른쪽', 'setdef 메뉴 위치', async () => ({ actual: { prefsNav: p1.nav, gx: g1 }, ok: p1.nav === 'right' && g1.nav === 'right' && g1.navX > g1.panel[0] + g1.panel[2] / 2 }));
  await C.openSet(); await C.node('set:screen'); await C.seg('메뉴 위치', '왼쪽');
  await step('메뉴 위치 왼쪽으로 되돌림', 'prefs.nav 칸 없음(기본)', '', async () => { const p = await prefs(); return { actual: p.nav ?? null, ok: p.nav === undefined }; });

  // 2. 요원 칸 → 목록
  await C.seg('요원 칸', '목록'); const p2 = await prefs(); await C.closeSet(); await sleep(500);
  await C.shot('k9-pc-06-요원칸목록');
  const ag2 = await t.F().evaluate(() => [...document.querySelectorAll('.gx [class*="ag-"]')].slice(0, 6).map((e) => e.className));
  await step('요원 칸 목록', 'prefs.agents=list, 상황판 요원 칸이 목록 모양', 'setdef 요원 칸', async () => ({ actual: { agents: p2.agents, classes: ag2 }, ok: p2.agents === 'list' }));
  await C.openSet(); await C.node('set:screen'); await C.seg('요원 칸', '모니터');

  // 3. 창 바깥 불투명도 0 / 100 (끝값)
  const dimSet = async (v) => { const loc = t.F().locator('.gw input[type="range"][data-change="set-dim"]'); await loc.scrollIntoViewIfNeeded(); await loc.fill(String(v)); await sleep(600); };
  await dimSet(0); const p30 = await prefs(); await C.closeSet(); await sleep(400); const g30 = await gx(); await C.shot('k9-pc-07-불투명도0');
  await step('불투명도 0', 'prefs.dim=0, 창 바깥 막 투명(rgba …, 0)', 'setdef 창 바깥 불투명도', async () => ({ actual: { dim: p30.dim, bg: g30.bg }, ok: p30.dim === 0 && /,\s*0\)$/.test(g30.bg) }));
  await C.openSet(); await C.node('set:screen'); await dimSet(100); const p31 = await prefs(); await C.closeSet(); await sleep(400); const g31 = await gx(); await C.shot('k9-pc-08-불투명도100');
  await step('불투명도 100', 'prefs.dim=100, 막 rgba(…, 1) — 뒤 채팅 다 가림', '', async () => ({ actual: { dim: p31.dim, bg: g31.bg }, ok: p31.dim === 100 && (/,\s*1\)$/.test(g31.bg) || /^rgb\(/.test(g31.bg)) }));
  await C.openSet(); await C.node('set:screen'); await dimSet(50);

  // 4. 외부 프레임: 1280 폭은 「창 최대 폭 1280 + 틀 두께」가 안 들어가 틀을 숨기고 설정 줄에 안내 (ui/frame.ts:36). 틀이 보이는 것은 k9-wide 에서
  for (const [txt, kind] of [['없음', 'none'], ['전술 태블릿', 'tactical'], ['일반 태블릿', 'tablet']]) {
    await C.seg('외부 프레임', txt); const p = await prefs(); const row = await C.row('외부 프레임'); await C.closeSet(); await sleep(400); const g = await gx();
    await step(`외부 프레임 ${txt} (1280 폭)`, kind === 'none' ? 'data-frame=none, 숨김 표시 없음' : 'data-frame=none + data-frame-hidden=1, 설정 줄에 「지금 창 폭이 좁아 프레임을 숨겼어요」', 'ui/frame.ts:29-40, settings.ts:433', async () => ({ actual: { prefsFrame: p.frame ?? null, frame: g.frame, hidden: g.frameHidden, note: row?.note }, ok: kind === 'none' ? g.frame === 'none' && !g.frameHidden : g.frame === 'none' && g.frameHidden === '1' }));
    await C.openSet(); await C.node('set:screen');
    if (kind !== 'none') { const r2 = await C.row('외부 프레임'); R.at(-1).actual.noteAfterReopen = r2?.note; R.at(-1).ok = R.at(-1).ok && /좁아/.test(r2?.note ?? ''); }
  }

  // 5. 설정 창 폭 끝값 60 / 100
  for (const v of ['60', '100', '90']) {
    await C.seg('설정 창 폭', v + '%'); await sleep(400); const g = await gw(); const p = await prefs();
    if (v !== '90') await C.shot(`k9-pc-10-설정창폭-${v}`);
    await step(`설정 창 폭 ${v}%`, `창 폭 ≈ 화면 ${v}% (help: 높이 90%)`, 'setdef 설정 창 폭', async () => ({ actual: { g, editorWidth: p.editorWidth }, ok: Math.abs(g.w / g.vw - Number(v) / 100) < 0.03 && Math.abs(g.h / g.vh - 0.9) < 0.03 }));
  }

  // 6. 위키 목록 위치 왼쪽 → 위키 화면
  await C.seg('위키 목록 위치', '왼쪽'); const p6 = await prefs(); await C.closeSet();
  await C.act('br-go', 'wk', false); await sleep(1500);
  const g6 = await gx(); await C.shot('k9-pc-11-위키목록왼쪽');
  await step('위키 목록 위치 왼쪽', 'prefs.wikiSide=left, 창 data-wiki-side=left, 위키 세로바가 왼쪽', 'setdef 위키 목록 위치', async () => {
    const side = await t.F().evaluate(() => { const b = document.querySelector('.gx [class*="wk-rail"], .gx [class*="wk-side"], .gx .wk-bar'); const r = b?.getBoundingClientRect(); return r ? { cls: b.className, x: Math.round(r.x) } : null; });
    return { actual: { wikiSide: p6.wikiSide, data: g6.wikiSide, side, panel: g6.panel }, ok: p6.wikiSide === 'left' && g6.wikiSide === 'left' };
  });
  await C.openSet(); await C.node('set:screen'); await C.seg('위키 목록 위치', '오른쪽'); await C.closeSet();
  await C.act('tab', 'board', false).catch(() => {});

  // 7. 테마: 이 채팅만 (채팅마다)
  await C.openSet(); await C.node('set:screen');
  await C.seg('테마', '라이트'); await sleep(400);
  const v7 = await C.vars(/theme/); const p7 = await prefs(); await C.closeSet(); await sleep(400); const g7 = await gx(); await C.shot('k9-pc-12-테마라이트');
  await step('테마 라이트 (이 채팅)', '채팅 변수 $st_fixed_theme=light, 기기 prefs 안 바뀜, 창 data-theme=light', 'setdef 테마(scope 없음 = 채팅), settings.ts:419 주석', async () => ({ actual: { vars: v7, prefs: p7, theme: g7.theme }, ok: Object.values(v7).includes('light') && g7.theme === 'light' && !JSON.stringify(p7).includes('light') }));
  await C.openSet(); await C.node('set:screen'); await C.seg('테마', '페이퍼'); await C.closeSet(); await sleep(400);
  const g7b = await gx(); await C.shot('k9-pc-13-테마페이퍼');
  await step('테마 페이퍼', 'data-theme=paper', '', async () => ({ actual: g7b.theme, ok: g7b.theme === 'paper' }));
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
