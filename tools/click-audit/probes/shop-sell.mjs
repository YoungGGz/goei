import { mk } from './vfy-lib.mjs';
export default async function (page, { vp }) {
  const t = mk(page, vp, `shopsell_${vp}`); const out = {};
  const card = () => page.evaluate(() => { const c = document.querySelector('.sh-wrap-card')?.getBoundingClientRect(); const b = document.querySelector('.sh-body'); return c && { top: Math.round(c.top), h: Math.round(c.height), bodyH: Math.round(b.getBoundingClientRect().height), scroll: b.scrollHeight > b.clientHeight }; });
  await t.sleep(800); await t.shot('01_buy'); out.buy = await card();
  await t.tap('[data-action="shop-pick"]', 0, '판매'); await t.sleep(600); await t.shot('02_sell'); out.sell = await card();
  await t.tap('[data-action="shop-pick"]', 0, '구매'); await t.sleep(600); await t.shot('03_back'); out.back = await card();
  out.notes = t.notes; return out;
}
