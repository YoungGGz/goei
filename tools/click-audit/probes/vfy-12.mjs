import { mk } from './vfy-lib.mjs';
export default async function (page, { vp }) {
  const t = mk(page, vp, `12_${vp}`); const out = {};
  await t.js('.gx [data-action="nav-tab"][data-value="items"], .gx [data-action="tab"][data-value="items"]');
  await t.js('.gx [data-action="items-sub"][data-value="items"]');
  await t.shot('00');
  const hands = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_items || '{}').list?.map((i) => `${i.name}:${i.slot || i.equip || ''}`));
  out.before = hands;
  const ok = await t.tap('.gx [data-action="items-open"][data-value="i_salt"], .gx [data-value="i_salt"]', 0, '굵은 소금');
  await t.shot('01_open');
  const btns = await page.evaluate(() => [...document.querySelectorAll('.gx button')].filter((b) => /들기|넣기|장착/.test(b.textContent)).map((b) => `${b.textContent.trim()}|${b.dataset.action}|${b.dataset.value}`));
  out.btns = btns;
  await t.tap('.gx [data-action="items-equip"][data-value="i_salt"]', 0, '들기');
  await t.shot('02_after');
  out.toast = await page.evaluate(() => [...document.querySelectorAll('.gx *')].filter((e) => /손 칸이 다 찼/.test(e.textContent) && e.children.length === 0).map((e) => e.textContent.trim()));
  out.after = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_items || '{}').list?.map((i) => `${i.name}:${i.slot || i.equip || ''}`));
  out.ok = ok; out.notes = t.notes; return out;
}
