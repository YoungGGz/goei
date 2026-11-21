import { mk } from './vfy-lib.mjs';
export default async function (page, { vp }) {
  const t = mk(page, vp, `fold_${vp}`); const out = { tabs: [] };
  await t.shot('00_start');
  out.layout = await page.evaluate(() => ({ phone: matchMedia('(max-width: 600px), (max-height: 499px) and (pointer: coarse)').matches, w: innerWidth, frame: document.querySelector('[data-frame]')?.dataset.frame }));
  for (const id of ['board', 'map', 'mission', 'net', 'gnet', 'phone', 'wiki', 'items', 'records']) {
    const ok = (await t.js(`[data-action="nav-tab"][data-value="${id}"]`)) || (await t.js(`[data-action="tab"][data-value="${id}"]`));
    out.tabs.push([id, ok]);
    if (ok) { await t.sleep(500); await t.shot(`tab_${id}`); }
  }
  if (await t.js('[data-action="ed-open"][data-value="set:screen"]')) { await t.sleep(800); await t.shot('settings'); }
  out.notes = t.notes; return out;
}
