import { mk } from './vfy-lib.mjs';
export default async function (page, { vp }) {
  const t = mk(page, vp, `17_${vp}`); const out = {};
  out.navs = await page.evaluate(() => [...document.querySelectorAll('.gx [data-action="nav-tab"]')].map((e) => e.dataset.value));
  await t.js('.gx [data-action="ed-open"][data-value="set:screen"]');
  await t.sleep(500);
  await t.js('.gw [data-action="ed-tab"][data-value="feature"], .gw [data-action="ed-tab"][data-value="func"]');
  await t.js('.gw [data-action="ed-node"][data-value="set:shop"]');
  await t.sleep(500); await t.shot('shop');
  out.tables = await page.evaluate(() => [...document.querySelectorAll('.gw table, .gw [class*="grid"], .gw [class*="tbl"]')].filter((e) => e.getClientRects().length).map((e) => { let p = e; const anc = []; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) anc.push(`${p.className.toString().slice(0, 25)}:${s.overflowX}:${p.scrollWidth}/${p.clientWidth}`); p = p.parentElement; } return { cls: e.className.toString().slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth, anc: anc.slice(0, 3), head: e.innerText.slice(0, 80).replace(/\n/g, ' ') }; }).slice(0, 6));
  out.over = await page.evaluate(() => [...document.querySelectorAll('.gw-body *')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 100).map((e) => ({ cls: e.className.toString().slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth, ox: getComputedStyle(e).overflowX, txt: e.innerText.slice(0, 60).replace(/\n/g, ' ') })).slice(0, 8));
  out.notes = t.notes; return out;
}
