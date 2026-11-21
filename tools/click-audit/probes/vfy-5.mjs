import { mk } from './vfy-lib.mjs';
export default async function (page, { vp }) {
  const t = mk(page, vp, `5_${vp}`); const out = {};
  await t.shot('00');
  // 사람이 손가락으로 옆으로 민 것처럼: 세력 줄의 스크롤 칸 scrollLeft 를 옮긴다
  out.row = await page.evaluate(() => { const c = document.querySelector('.gx-fac')?.parentElement; let el = c; while (el && el.scrollWidth <= el.clientWidth) el = el.parentElement; if (!el) return null; el.scrollLeft = el.scrollWidth; return { cls: el.className, sl: el.scrollLeft, sw: el.scrollWidth, cw: el.clientWidth }; });
  await t.sleep(400); await t.shot('01_swiped');
  const facs = await page.evaluate(() => [...document.querySelectorAll('.gx-fac')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.value, Math.round(r.left), Math.round(r.width)]; }));
  out.facs = facs;
  const vis = facs.filter((f) => f[1] >= 0 && f[1] + f[2] / 2 < 344 && f[0] !== 'A00').at(-1);
  if (vis) { const i = facs.findIndex((f) => f[0] === vis[0]); await t.tap('.gx-fac', i, `세력 ${vis[0]}`); }
  await t.shot('02_after');
  out.after = await page.evaluate(() => { const c = document.querySelector('.gx-fac')?.parentElement; let el = c; while (el && el.scrollWidth <= el.clientWidth) el = el.parentElement; return { sl: el?.scrollLeft, sel: document.querySelector('.gx-fac.on, .gx-fac[aria-pressed="true"], .gx-fac.sel')?.dataset.value }; });
  out.picked = vis; out.notes = t.notes; return out;
}
