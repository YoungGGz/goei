// 재확인 DJM R08: 진행 창 점이 플러그인 창 단추를 덮는지 (폰 가로 882x344 손가락, 폴드 752x749 dsf1.8 손가락).
// 사용: FAKE_URL=… RISU_URL=… node r08.mjs --w 882 --h 344 [--dsf 1.8]
import { open, STATES, sleep, turn, saveJson } from '../D/lib.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const W = Number(opt('--w', 882)), H = Number(opt('--h', 344)), DSF = Number(opt('--dsf', 1));
const OUT = fileURLToPath(new URL(`./out/r08-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { size: `${W}x${H} dsf${DSF} touch`, views: [] };
const t = await open({ out: OUT, width: W, height: H, touch: true, dsf: DSF });
const F = () => t.F();
const fc = async (sel) => { try { await F().locator(sel).locator('visible=true').first().click({ timeout: 3000 }); } catch { await F().evaluate((s) => document.querySelector(s)?.click(), sel); } await sleep(800); };
const reopen = async () => { await t.closeWindow().catch(() => {}); await t.openWindow('.gx'); await sleep(1200); };
const measure = async (name) => {
  const fe = await F().frameElement(); const fb = await fe.boundingBox();
  const prog = await t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); if (!h) return null; const d = h.querySelector('[data-dot]')?.getBoundingClientRect(); return { phone: h.getAttribute('x-goei-phone'), panel: h.getAttribute('x-goei-panel'), display: getComputedStyle(h).display, dot: d ? { x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.width), h: Math.round(d.height) } : null }; });
  const layout = await F().evaluate(() => { const nav = document.querySelector('.gx-nav'); const mbar = document.querySelector('.gx-mbar'); const vis = (e) => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; return { iw: innerWidth, ih: innerHeight, sideNav: vis(nav), mbar: vis(mbar) }; });
  const scale = fb.width / layout.iw;
  const btns = await F().evaluate(() => [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { a: e.dataset.action, v: (e.dataset.value ?? '').slice(0, 30), t: (e.innerText || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').slice(0, 20), x: r.x, y: r.y, w: r.width, h: r.height }; }).filter((b) => b.w > 0 && b.h > 0));
  const hits = [];
  if (prog?.dot && prog.display !== 'none') {
    const d = prog.dot;
    for (const b of btns) {
      const X = fb.x + b.x * scale, Y = fb.y + b.y * scale, BW = b.w * scale, BH = b.h * scale;
      const x0 = Math.max(X, d.x), x1 = Math.min(X + BW, d.x + d.w), y0 = Math.max(Y, d.y), y1 = Math.min(Y + BH, d.y + d.h);
      if (x1 > x0 && y1 > y0) {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const top = await t.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[x-goei-prog]') ? 'x-goei-prog' : e.tagName) : null; }, [cx, cy]);
        const bc = [X + BW / 2, Y + BH / 2];
        const topAtBtnCenter = await t.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[x-goei-prog]') ? 'x-goei-prog' : e.tagName) : null; }, bc);
        hits.push({ a: b.a, v: b.v, t: b.t, btn: [Math.round(X), Math.round(Y), Math.round(BW), Math.round(BH)], overlapArea: Math.round((x1 - x0) * (y1 - y0)), topAtOverlap: top, topAtBtnCenter });
      }
    }
  }
  await t.shot(`r08-${name}`);
  const v = { name, frame: { x: Math.round(fb.x), y: Math.round(fb.y), w: Math.round(fb.width), h: Math.round(fb.height) }, layout, prog, hits };
  res.views.push(v); console.log(JSON.stringify(v).slice(0, 900)); saveJson(OUT + '/result.json', res);
};
try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await t.reload();
  // 호출이 한 번 있어야 진행 창 점이 뜬다 → 본편 한 턴
  await turn(t, { prose: '쟈알디가 서류를 덮었다.', status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } }, null, '로비를 둘러본다.');
  await sleep(1500);
  res.progBeforeOpen = await t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); const d = h?.querySelector('[data-dot]')?.getBoundingClientRect(); return h ? { phone: h.getAttribute('x-goei-phone'), display: getComputedStyle(h).display, dot: d ? [Math.round(d.x), Math.round(d.y), Math.round(d.width), Math.round(d.height)] : null } : null; });
  await reopen();
  const phoneLayout = (await F().evaluate(() => { const m = document.querySelector('.gx-mbar'); return !!m && m.getBoundingClientRect().width > 0; }));
  const tab = async (v) => { if (phoneLayout) await fc(`.gx-mbar [data-value="${v}"]`); else await fc(`[data-action="nav-tab"][data-value="${v}"]`); };
  // 상황판: 괴이 하나 골라 「상황 종료」 보이게
  await tab('board');
  const key = await F().evaluate(() => [...document.querySelectorAll('[data-action="ops-sel"]')].find((e) => /소라 랜드/.test(e.innerText))?.dataset.value ?? null);
  if (key) await fc(`[data-action="ops-sel"][data-value="${key}"]`);
  await measure('board');
  await tab('map'); await measure('map');
  await tab('phone');
  await fc('[data-action="ph-sub"][data-value="contacts"]');
  await fc('[data-action="ph-dm"][data-value="c_50303034"]');
  await measure('phone-dm');
  await reopen();
  await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="guide"]'); await fc('[data-action="ed-node"][data-value="rule:all"]');
  await measure('settings-rules');
} catch (e) {
  res.err = String(e?.stack ?? e).slice(0, 1200); console.log('ERR', res.err);
  await t.shot('ERR').catch(() => {});
} finally {
  saveJson(OUT + '/result.json', res); console.log('OUT', OUT);
  await t.close();
}
