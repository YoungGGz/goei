import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, setChat, sleep } from './qc-settings-harness.mjs';
const fx = loadFixture(process.argv[2]);
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const browser = await launch();
const NODES = process.env.NODES ? process.env.NODES.split(',') : ['set:screen', 'set:image', 'set:board', 'set:net', 'set:phone', 'set:wiki', 'set:status', 'set:journal', 'set:items', 'set:people', 'set:factions', 'set:lore', 'set:adv', 'manage:flow', 'agent', 'org', 'anomaly', 'site', 'appendix', 'base', 'relations', 'guide:RP', 'guide:Image', 'rule:new', 'install', 'manage:diag', 'manage:log', 'manage:backup'];
const { page } = await boot(browser, fx, { message: [], scriptstate: {} }, 'pc');
const text = async (n) => { const t = await page.evaluate(() => document.body.innerText); writeFileSync(`${out}/${n}.txt`, t); };
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); await text(n); };
await openWin(page); await sleep(400);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) { await shot('start-install'); await closeEditor(page, true); }
await page.waitForSelector('.gx-fac');
await shot('start-0');
if (process.env.TABS_ONLY) {} else for (const f of ['A00','B00','C00','D00','E00']) { await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`)?.click(), f); await sleep(400); await shot(`start-${f}`); }
await closeWin(page);
await setChat(page, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } });
await openWin(page); await sleep(600);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await sleep(300);
await shot('tab-board');
for (const t of ['map','phone','net','items','records']) {
  try { await page.evaluate((t) => document.querySelector(`.gx-nb.desk[data-value="${t}"], .gx-nb:not(.mob)[data-value="${t}"]`)?.click(), t); await sleep(700); await shot(`tab-${t}`); } catch (e) { console.log('tab fail', t, e.message); }
}
for (const s of ['gn','gal','wpf','sm','cos','wk','bm','hs']) {
  try { await page.evaluate((s) => document.querySelector(`[data-action="br-site"][data-value="${s}"]`)?.click(), s); await sleep(700); await shot(`site-${s}`); } catch (e) { console.log('site fail', s, e.message); }
}
if (!process.env.TABS_ONLY) await openEditor(page, 'set:screen');
if (!process.env.TABS_ONLY) for (const n of NODES) {
  try { await goNode(page, n); await sleep(400); await shot(`ed-${n.replace(':','-')}`); } catch (e) { console.log('node fail', n, e.message); }
}
await browser.close();
console.log('done');
