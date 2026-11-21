// 중대 항목 직접 확인용: 도구처럼 scrollIntoView 하지 않고, 화면에 보이는 것만 손가락(폰)·마우스(PC)로 누른다
import { mkdirSync } from 'node:fs';
export function mk(page, vp, tag) {
  const dir = `/tmp/claude-0/vfy/${tag}`; mkdirSync(dir, { recursive: true });
  const touch = vp !== 'pc';
  const notes = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function box(sel, nth = 0) {
    return page.evaluate(([s, n]) => { const el = [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length)[n]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, txt: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40) }; }, [sel, nth]);
  }
  async function tap(sel, nth = 0, label = sel) {
    const b = await box(sel, nth);
    if (!b) { notes.push(`${label}: 없음`); return false; }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const vis = cx >= 0 && cy >= 0 && cx <= b.vw && cy <= b.vh;
    if (!vis) { notes.push(`${label}: 화면 밖(${Math.round(cx)},${Math.round(cy)}) — 사람이 쓸어서 보이게 한 뒤 누른다고 보고 JS로 누름`); await page.evaluate(([s, n]) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length)[n].click(), [sel, nth]); }
    else if (touch) await page.touchscreen.tap(cx, cy); else await page.mouse.click(cx, cy);
    await sleep(700);
    return true;
  }
  async function js(sel, nth = 0) { const ok = await page.evaluate(([s, n]) => { const el = [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length)[n]; el?.click(); return !!el; }, [sel, nth]); await sleep(600); return ok; }
  async function shot(name) { await page.screenshot({ path: `${dir}/${name}.png` }); }
  async function frame() { return page.evaluate(() => { const g = document.querySelector('.gx .gx-panel, .gx-panel') || document.querySelector('.gx'); const r = g?.getBoundingClientRect(); const sc = []; for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0 && getComputedStyle(el).overflowY !== 'visible') sc.push(`${el.className?.toString().slice(0, 30)}:${el.scrollTop}`); return { panelTop: r && Math.round(r.top), docScroll: document.scrollingElement.scrollTop, scrolled: sc.slice(0, 6) }; }); }
  return { tap, js, shot, box, frame, notes, sleep, touch, dir };
}
