// Real RisuAI (vite dev at RISU_URL, default http://127.0.0.1:5174) + 괴이 plugin + card → 상황판 screenshots.
// usage: node tools/risu-real/shots.mjs <outdir> <W>x<H> [--no-touch]
// 실제 RisuAI 웹(소스 github kwaroran/RisuAI, pnpm install 뒤 VITE_RISU_LEGAL_CONFIGURED=TRUE npx vite --port 5174)에 플러그인·카드를 얹어 상황판을 찍는다 (11-21 폴드 펼침 점검).
// Needs: Risu dev server running; release/ built (npm run release:prep: charx + body/data packs).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const REL = process.env.GOEI_REL || ROOT + 'release/';
const RISU = process.env.RISU_URL || 'http://127.0.0.1:5174';
const [outdir, size = '752x749'] = process.argv.slice(2);
if (!outdir) { console.error('usage: shots.mjs <outdir> <W>x<H>'); process.exit(2); }
const [W, H] = size.split('x').map(Number);
const touch = !process.argv.includes('--no-touch');
mkdirSync(outdir, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// charx is ~146MB: too big for route.fulfill (kills the page) → plain local HTTP server
const cardBytes = readFileSync(REL + '괴이_ANOMALY.charx');
const srv = http.createServer((q, s) => { s.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'application/octet-stream' }); s.end(cardBytes); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const CARD = `http://127.0.0.1:${srv.address().port}/card.charx`;

const browser = await chromium.launch();
let page;
const fail = async (e) => { console.error('FAIL', e?.stack ?? e); try { await page.screenshot({ path: `${outdir}/FAIL.png` }); writeFileSync(`${outdir}/FAIL.html`, await (F || page).evaluate(() => document.querySelector('.gx')?.outerHTML ?? document.body.innerHTML.slice(0, 200000))); writeFileSync(`${outdir}/FAIL-errors.txt`, errors.join('\n')); } catch {} await browser.close(); srv.close(); process.exit(1); };
process.on('unhandledRejection', fail); process.on('uncaughtException', fail);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  const t = m.text();
  if (/\[goei\]/.test(t) || (m.type() === 'error' && !/DEPRECATION|Failed to load resource|Error processing block/.test(t))) { errors.push(`${m.type()}: ${t.slice(0, 300)}`); }
  if (t.startsWith('ALERT ')) log(t.slice(0, 160));
});
await ctx.addInitScript(() => { globalThis.__RISU_LEGAL_CONFIGURED__ = true; try { localStorage.setItem('tos4', 'true'); } catch {} });
// Web Risu sends nativeFetch through `${hubURL}/proxy2` with the real URL in the risu-url header.
let served = 0;
await ctx.route((u) => !u.href.startsWith('http://127.0.0.1'), async (r) => {
  const req = r.request();
  let url = req.url();
  if (url.includes('/proxy2')) url = decodeURIComponent(req.headers()['risu-url'] || '');
  if (url.includes('raw.githubusercontent.com/ygberserk/goei/release/')) {
    const f = decodeURIComponent(url.split('/release/')[1].split('?')[0]);
    try { const body = readFileSync(REL + f); served++; return r.fulfill({ status: 200, body, headers: { 'access-control-allow-origin': '*' } }); }
    catch { log('MISS', f); return r.fulfill({ status: 404, body: '' }); }
  }
  return r.abort();
});

await page.goto(RISU + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => /call you|Accept/.test(document.body?.innerText ?? '') || document.querySelector('.default-chat-screen, button'), null, { timeout: 120000 });
log('risu up');
const res = await page.evaluate(async ({ plugin, CARD }) => {
  const st = await import('/src/ts/stores.svelte.ts');
  // auto-answer every Risu alert (plugin permission asks → yes)
  st.alertStore.subscribe((v) => { if (v && !['none', 'wait', 'progress', 'waitAlert'].includes(v.type)) { console.log('ALERT', v.type, String(v.msg).slice(0, 120)); setTimeout(() => st.alertStore.set({ type: 'none', msg: 'yes' }), 30); } });
  st.DBState.db.didFirstSetup = true;
  const cc = await import('/src/ts/characterCards.ts');
  const buf = new Uint8Array(await (await fetch(CARD)).arrayBuffer());
  await cc.importCharacterProcess({ name: 'goei.charx', data: buf });
  const pl = await import('/src/ts/plugins/plugins.svelte.ts');
  await pl.importPlugin(plugin);
  st.selectedCharID.set(st.DBState.db.characters.length - 1);
  return { chars: st.DBState.db.characters.length, plugins: st.DBState.db.plugins.map((x) => x.name) };
}, { plugin: readFileSync(REL + 'goei-plugin.js', 'utf8'), CARD });
log('imported', JSON.stringify(res));

const fab = async () => {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 60000 });
  await page.click('[x-goei-fab] button');
};
// v3 plugins run in an iframe; showContainer('fullscreen') makes it position:fixed 100%×100% over Risu. The window (.gx) lives in that frame.
let F = null;
const pluginFrame = async (sel = '.gx') => {
  for (let i = 0; i < 300; i++) {
    for (const f of page.frames()) { if (f === page.mainFrame()) continue; try { if (await f.$(sel)) return (F = f); } catch {} }
    await page.waitForTimeout(200);
  }
  throw new Error('plugin frame with ' + sel + ' not found');
};
const winOpen = async () => !!F && await F.evaluate(() => { const g = document.querySelector('.gx'); return !!g && g.style.display !== 'none' && getComputedStyle(g).display !== 'none'; }).catch(() => false);
await fab();
log('fab clicked');
await pluginFrame('.gx-fac');
await F.click('.gx-fac[data-value="A00"]');
await page.waitForTimeout(300);
await F.click('.gx-start');
for (let i = 0; ; i++) {
  const ok = await page.evaluate(async () => { const st = await import('/src/ts/stores.svelte.ts'); const c = st.DBState.db.characters.at(-1); return !!c.chats[c.chatPage || 0]?.scriptstate?.$goei_world; });
  if (ok) break;
  if (i > 200) throw new Error('start did not write $goei_world');
  await page.waitForTimeout(300);
}
log('started');

// fake model reply with board tags, then run Risu's own chat-output listeners (what Risu does after a real reply)
const geo = JSON.parse(readFileSync(ROOT + 'src/data/geo.json', 'utf8'));
await page.evaluate(async (geo) => {
  const st = await import('/src/ts/stores.svelte.ts');
  const { pluginV2 } = await import('/src/ts/plugins/plugins.svelte.ts');
  const ci = st.DBState.db.characters.length - 1;
  const char = st.DBState.db.characters[ci];
  const chatIndex = char.chatPage || 0;
  const chat = char.chats[chatIndex];
  const world = JSON.parse(chat.scriptstate.$goei_world);
  const preset = world.an.find((e) => e.kind === 'preset') || world.an[0];
  let where = '관리국 본부';
  if (preset?.loc) { const [code, idx] = preset.loc.split('-'); where = `${geo.sido[code]} ${geo.sigun[code][Number(idx)]}`; }
  const reply = ['본문', preset ? `[AN|${where}|${preset.name}|활성|A|P001]` : '', '[AG|P001|작전투입|현장]', '[AG|P002|휴게|사무실]', '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]'].filter(Boolean).join('\n');
  chat.scriptstate.$ph_auto = '0';
  chat.message.push({ role: 'user', data: '시작', chatId: 'u1' }, { role: 'char', data: reply, chatId: 'c1' });
  const snap = (v) => JSON.parse(JSON.stringify(v));
  for (const f of pluginV2.chatOutput) { try { await f({ char: snap(char), chat: snap(chat), characterIndex: ci, chatIndex, messageIndex: chat.message.length - 1 }); } catch (e) { console.error(e); } }
}, geo);
log('reply injected');
await page.waitForTimeout(1500);

// reopen window so it re-reads chat
if (await winOpen()) { await F.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()); await page.waitForTimeout(600); }
await fab();
await pluginFrame('.gx-board');
log('board shown');

const info = {};
const measure = async (name) => {
  const host = await page.evaluate(() => { const b = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }; const ifr = [...document.querySelectorAll('iframe')].find((f) => f.style.position === 'fixed' && f.style.display !== 'none'); return { iframe: b(ifr), chatScreen: b(document.querySelector('.default-chat-screen')), inner: [innerWidth, innerHeight] }; });
  info[name] = { host, frame: await F.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const gx = document.querySelector('.gx');
    return { inner: [innerWidth, innerHeight], dpr: devicePixelRatio, gx: r('.gx'), gxWin: r('.gx > *'), gxParent: gx ? `${gx.parentElement.tagName}.${gx.parentElement.className}`.slice(0, 120) : null, chatScreen: r('.default-chat-screen'), body: r('.gx-body'), board: r('.gx-board'), nav: r('.gx-nav'), scrollW: document.documentElement.scrollWidth };
  }) };
};
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${outdir}/${name}.png` }); log('shot', name); };
const clickJs = (sel) => F.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const nav = async (v) => (await clickJs(`.gx [data-action="nav-tab"][data-value="${v}"]`)) || (await clickJs(`.gx [data-action="tab"][data-value="${v}"]`));

await measure('board');
await shot('01-board');
// scroll board to bottom (agent wall)
const scrolled = await F.evaluate(() => { const b = document.querySelector('.gx-board'); if (!b || b.scrollHeight <= b.clientHeight) return false; b.scrollTop = b.scrollHeight; return true; });
if (scrolled) await shot('02-board-scrolled');
await F.evaluate(() => { const b = document.querySelector('.gx-board'); if (b) b.scrollTop = 0; });
const back = async () => { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(200); await clickJs('.gx [data-action="pop-close"], .gx [data-action="ev-close"], .gx [data-action="agent-close"]'); await nav('board'); await page.waitForTimeout(400); if (!(await F.$('.gx-board'))) { await nav('map'); await page.waitForTimeout(200); await nav('board'); await page.waitForTimeout(400); } };
// incident detail popup (CCTV big view / row → ev-pop)
if (await clickJs('.gx-board [data-action="ev-pop"]')) { await shot('03-board-event-pop'); await back(); }
// ops log: satellite map mode
if (await clickJs('.gx-board [data-action="ops-mode"][data-value="map"]')) { await page.waitForTimeout(600); await shot('04-board-opsmap'); await clickJs('.gx-board [data-action="ops-mode"][data-value="feed"]'); await page.waitForTimeout(300); }
// agent popup
if (await clickJs('.gx-board [data-action="agent-info"]')) { await shot('05-board-agent-pop'); await back(); }
// agent panel: list mode (scroll to it)
if (await clickJs('.gx-board [data-action="agents-view"][data-value="list"]')) {
  await page.waitForTimeout(400);
  await F.evaluate(() => { const b = document.querySelector('.gx-board'); if (b) b.scrollTop = b.scrollHeight; });
  await shot('06-board-agents-list');
  await clickJs('.gx-board [data-action="agents-view"][data-value="wall"]');
  await F.evaluate(() => { const b = document.querySelector('.gx-board'); if (b) b.scrollTop = 0; });
}
for (const [i, v] of ['map', 'phone', 'net', 'items', 'records'].entries()) {
  if (await nav(v)) { await page.waitForTimeout(500); await measure(v); await shot(`${String(i + 7).padStart(2, '0')}-${v}`); }
}
await nav('board');
await page.waitForTimeout(400);

writeFileSync(`${outdir}/info.json`, JSON.stringify({ size, touch, served, info, errors }, null, 1));
log('done; served', served, 'errors', errors.length);
console.log(JSON.stringify(info.board, null, 1));
await browser.close();
srv.close();
