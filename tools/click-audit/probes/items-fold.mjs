// 폴드 펼침(안쪽 화면) 소지품·상점 팔기: 장착 띠·사용 칸·격자가 세로로 얼마씩 차지하는지 재고 사진을 남긴다.
// 사용법: GOEI_SHOT_SCALE=2 FOLD_TAG=before node tools/click-audit/click-audit.mjs --vp fold_i --start items --probe tools/click-audit/probes/items-fold.mjs
//         (--start shop 이면 상점 팔기 화면을 잰다. FOLD_SIZES="677x674,673x841" 로 크기를 바꾼다. FOLD_OUT 은 사진 폴더)
import { mkdirSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = (sel) => `(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((x) => x.getClientRects().length)[0]; if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }; })()`;
export default async function (page, { vp }) {
  const out = {}; const dir = process.env.FOLD_OUT || '.scratch/fold'; mkdirSync(dir, { recursive: true });
  const tag = process.env.FOLD_TAG || 'now';
  const sizes = (process.env.FOLD_SIZES || '677x674,673x841').split(',').map((s) => s.split('x').map(Number));
  const shop = await page.evaluate(() => !!document.querySelector('.sh-wrap-card'));
  if (shop) { await page.evaluate(() => [...document.querySelectorAll('[data-action="shop-pick"]')].find((b) => /판매/.test(b.textContent))?.click()); await sleep(600); }
  else { await page.evaluate(() => document.querySelector('[data-action="nav-tab"][data-value="items"], [data-action="tab"][data-value="items"]')?.click()); await sleep(500); }
  // FOLD_USE=1: 사용 칸에 물건 둘을 놓은 모습 (칩이 들어간 사용 칸 높이)
  if (!shop && process.env.FOLD_USE) { for (const n of [0, 1]) { await page.dragAndDrop(`.it-scroll .it-c >> nth=${n}`, '[data-drop="use"]').catch((e) => { out.useErr = String(e).slice(0, 120); }); await sleep(350); } }
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h }); await sleep(500);
    if (shop && process.env.FOLD_TOP) { await page.evaluate(() => { const b = document.querySelector('.sh-body'); if (b) b.scrollTop = 0; }); await sleep(200); }
    const m = await page.evaluate(`({
      vp: [innerWidth, innerHeight], bodyScroll: document.querySelector('.sh-body')?.scrollTop ?? null, owner: ${r('.sh-owner')},
      panel: ${r('.gx-panel')}, card: ${r('.sh-wrap-card')}, body: ${r('.sh-body')},
      tabs: ${r('.gx-items .gx-tabs, .gx-items .gx-subtabs')}, tools: ${r('.it-tools')},
      eqbox: ${r('.it-eqbox')}, av: ${r('.it-av')}, stats: ${r('.it-stats')}, slots: ${r('.it-eqslots')}, slot: ${r('.it-slot')}, use: ${r('.it-usebox')},
      scroll: ${r('.it-scroll')}, mine: ${r('.sh-mine')}, grid: ${r('.it-scroll .it-grid, .sh-mine .it-grid')}, cell: ${r('.it-scroll .it-c, .sh-mine .it-c')},
      scrollers: [...document.querySelectorAll('.gx *, .sh-wrap *')].filter((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map((e) => String(e.className).slice(0, 40) + ' ' + e.clientHeight + '/' + e.scrollHeight),
      hover: matchMedia('(hover: hover)').matches, coarse: matchMedia('(pointer: coarse)').matches,
    })`);
    // 보이는 격자 높이: 격자가 스크롤 칸(또는 상점 본문) 안에서 실제로 보이는 세로
    const box = m.scroll || m.body; const bottom = Math.min(box ? box.y + box.h : h, m.panel ? m.panel.y + m.panel.h : h, m.card ? m.card.y + m.card.h : h, h);
    m.gridVisible = m.grid ? Math.max(0, bottom - Math.max(m.grid.y, box ? box.y : 0)) : null;
    m.rowsVisible = m.cell && m.gridVisible != null ? +(m.gridVisible / (m.cell.h + 8)).toFixed(2) : null;
    out[`${w}x${h}`] = m;
    await page.screenshot({ path: `${dir}/${shop ? 'sell' : 'items'}_${tag}${process.env.FOLD_USE ? '_use' : ''}_${w}x${h}.png` });
  }
  return out;
}
