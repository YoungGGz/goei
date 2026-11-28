// K9 크기별 판독: 상황판 창·설정 화면 페이지 캡처, 폰 배치 여부, 설정 창 크기, 프레임, 메뉴 위치가 PC 창에서만 먹는지
import { rec, sleep } from '../lib.mjs';
export default async function (C, arg = {}) {
  const { t } = C;
  const tag = arg.tag ?? 'x';
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec(`k9-${tag} ` + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const look = () => t.F().evaluate(() => {
    const g = document.querySelector('.gx'); const p = g?.querySelector('.gx-panel'); const r = p?.getBoundingClientRect();
    const vis = (s) => { const e = g?.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(e).visibility !== 'hidden' ? [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)] : null; };
    return { vw: innerWidth, vh: innerHeight, zoom: getComputedStyle(document.documentElement).zoom, theme: g?.dataset.theme, nav: g?.dataset.nav, frame: g?.dataset.frame, frameHidden: g?.dataset.frameHidden ?? null,
      panel: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
      sideNav: vis('.gx-nav:not(.gx-mbar)'), idcard: vis('.gx-nav-brand'), mbar: vis('.gx-mbar, .gx-mnav, nav.gx-nav.mob, .gx-bottom'), navCls: g?.querySelector('.gx-nav')?.className ?? null };
  });
  const lookSet = () => t.F().evaluate(() => { const w = document.querySelector('.gw .gw-win'); const r = w?.getBoundingClientRect(); return r ? { win: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight, tree: !!document.querySelector('.gw .gw-tree')?.getBoundingClientRect().width } : null; });
  await C.open(); await sleep(600);
  const L0 = await look(); await C.shot(`k9-${tag}-01-상황판`);
  await C.openSet(); await C.node('set:screen'); await sleep(400);
  const S0 = await lookSet(); await C.shot(`k9-${tag}-02-설정화면`);
  await t.F().evaluate(() => { const el = [...document.querySelectorAll('.gw *')].find((e) => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)); el?.scrollBy(0, 900); });
  await sleep(300); await C.shot(`k9-${tag}-03-설정화면-아래`);
  const rows = {}; for (const l of ['펼친 폴드 화면 배치', '펼친 폴드 화면 배율', '외부 프레임', '설정 창 폭', '메뉴 위치']) rows[l] = await C.row(l);
  await step('기본 판독', arg.expect ?? '', arg.src ?? '', async () => ({ actual: { L0, S0, rows }, ok: arg.check ? arg.check(L0, S0) : true }));
  // 메뉴 위치 오른쪽: 폰 배치면 안 먹음(「PC 창에서」)
  await C.seg('메뉴 위치', '오른쪽'); await C.closeSet(); await sleep(400);
  const L1 = await look(); await C.shot(`k9-${tag}-04-메뉴오른쪽`);
  await step('메뉴 위치 오른쪽', '폰 배치: 아래 바 그대로(바뀜 없음). PC 배치(폴드 줄임 포함): 메뉴가 오른쪽', 'setdef 메뉴 위치 「PC 창에서」', async () => ({ actual: { L1 }, ok: true }));
  await C.openSet(); await C.node('set:screen'); await C.seg('메뉴 위치', '왼쪽');
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
