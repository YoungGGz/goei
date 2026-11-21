import { mk } from './vfy-lib.mjs';
export default async function (page, { vp }) {
  const t = mk(page, vp, `1_${vp}`); const out = {};
  await t.shot('00_board'); out.f0 = await t.frame();
  const rows = await page.evaluate(() => [...document.querySelectorAll('.gx [data-action="ops-sel"]')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.value, Math.round(r.top), Math.round(r.height)]; }));
  out.rows = rows;
  // 고르지 않은 둘째 줄을 손가락으로
  await t.tap('.gx [data-action="ops-sel"]', 1, '둘째 사건 줄'); await t.shot('01_after_row2'); out.f1 = await t.frame();
  await t.tap('.gx [data-action="ops-sel"]', 2, '셋째 줄'); await t.shot('02_after_row3'); out.f2 = await t.frame();
  out.notes = t.notes; return out;
}
