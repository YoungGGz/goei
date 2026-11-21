// 폴드 펼침(752×749(실기 폴드 펼침 CSS px, 11-21 실기 캡처로 잼)) 괴담넷·연어 마켓 화면을 한 장씩 찍는다 (11-21 스레드 「폴드 펼침 괴담넷·연어 마켓 고치기」).
// node tools/click-audit/click-audit.mjs --vp fold_i --start gnet --probe tools/click-audit/probes/fold-boards.mjs --out <폴더>
// 캡처는 PROBE_OUT(기본 /tmp/claude-0/vfy/fold-boards) 아래 <크기>/<이름>.png. 각 화면에서 가로로 넘친 요소도 적는다.
import { mkdirSync } from 'node:fs';

const BOARD = (site) => ({ posts: [
  { author: site === 'sm' ? '당근아님' : 'abc92', id: 1846002, title: site === 'sm' ? '부적 세트 팝니다 (거의 새것, 직거래만)' : '소라 랜드 관람차 혼자 돎 — 어제 새벽 두 시 반쯤 봤는데 진짜로 아무도 안 탔음', time: '02:30', date: '2025.01.01 02:30', views: 4237, upvotes: 113, content: '어제 봤음\n진짜임\n'.repeat(4), mine: false, ...(site === 'sm' ? { tag: '판매', price: '35,000원' } : {}),
    comments: [{ author: 'ㅇㅇ(118.235)', content: '사진 없으면 구라', parent: 0, mine: false }, { author: 'abc92', content: '찍으려다 폰 꺼짐', parent: 1, mine: false }] },
  { author: '아직안잠', id: 1846001, title: site === 'sm' ? '소금 한 포대 삽니다' : '야간 편의점 고양이', time: '02:20', date: '2025.01.01 02:20', views: 941, upvotes: 27, content: '오늘도 출근함', mine: false, comments: [], ...(site === 'sm' ? { tag: '구매' } : {}) },
  { author: '새벽세시', id: 1846000, title: site === 'sm' ? '손전등 무료 나눔' : '엘리베이터 13층 버튼 누른 사람', time: '02:10', date: '2025.01.01 02:10', views: 120, upvotes: 3, content: '누구임', mine: false, comments: [], ...(site === 'sm' ? { tag: '나눔' } : {}) },
] });

export default async function (page, { vp }) {
  const root = process.env.PROBE_OUT || '/tmp/claude-0/vfy/fold-boards';
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = async (sel, nth = 0) => { const ok = await page.evaluate(([s, n]) => { const el = [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length)[n]; el?.click(); return !!el; }, [sel, nth]); await sleep(500); return ok; };
  const over = () => page.evaluate(() => {
    const bad = [];
    const vw = innerWidth;
    for (const el of document.querySelectorAll('.gx *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      if (r.right > vw + 1 || r.left < -1) bad.push(`화면 밖 ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${Math.round(r.left)}~${Math.round(r.right)}`);
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis' && el.clientWidth > 0 && !/^(svg|path|img)$/i.test(el.tagName)) bad.push(`넘침 ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${el.clientWidth}<${el.scrollWidth} 「${(el.innerText || '').trim().slice(0, 20)}」`);
    }
    return [...new Set(bad)].slice(0, 40);
  });
  async function site(id, sizeTag, dir) {
    const res = {};
    const shot = async (name) => { await page.screenshot({ path: `${dir}/${id}_${name}.png` }); res[name] = await over(); };
    // 창이 닫혔으면 둥근 단추로 다시 연다
    if (!(await page.evaluate(() => { const g = document.querySelector('.gx'); return g && g.getClientRects().length && getComputedStyle(g).display !== 'none'; }))) { await page.evaluate(() => document.querySelector('[x-goei-fab]')?.click()); await sleep(900); }
    // 인터넷 탭 → 사이트
    await click('[data-action="nav-tab"][data-value="net"], [data-action="tab"][data-value="net"]');
    await click('[data-action="br-login-guest"]');
    if (!(await click(`[data-action="br-go"][data-value="${id}"]`))) await click(`[data-action="br-site"][data-value="${id}"]`);
    await sleep(400);
    res._where = await page.evaluate(() => ({ title: document.querySelector('.gx-title, .gx h1, .gx header')?.textContent?.trim().slice(0, 30), url: document.querySelector('.br-url, [class*=url]')?.textContent?.trim().slice(0, 60) }));
    if (!(await page.$('.gn-row-main'))) {
      await page.evaluate((b) => { window.__llm.push({ type: 'success', result: '```json\n' + JSON.stringify(b) + '\n```' }); }, BOARD(id));
      await click('[data-action="gn-refresh"]');
      await page.waitForSelector('.gn-row-main', { timeout: 8000 }).catch(() => {});
      await sleep(300);
    }
    await shot('01_목록');
    await page.evaluate(() => { const s = document.querySelector('.gx .bs-body, .gx .br-view, .gx-body'); if (s) s.scrollTop = 99999; });
    await sleep(200); await shot('02_목록_아래');
    await page.evaluate(() => { for (const s of document.querySelectorAll('.gx *')) if (s.scrollTop) s.scrollTop = 0; });
    if (await click('[data-action="gn-open"]')) { await sleep(300); await shot('03_글'); await click('[data-action="gn-back"]'); }
    if (await click('[data-action="gn-write"]')) { await sleep(300); await shot('04_글쓰기'); await click('[data-action="gn-cancel"]') || await click('[data-action="gn-back"]'); }
    if (await click('[data-action="gn-sub"][data-value="dm"]')) { await sleep(300); await shot('05_쪽지함'); }
    if (await click('[data-action="gn-newdm"]')) { await sleep(300); await shot('06_새쪽지'); await click('[data-action="gn-cancel"]'); }
    await click('[data-action="gn-dm-close"]') || await click('[data-action="gn-sub"][data-value="dm"]');
    if (await click('[data-action="gn-open-side"]')) { await sleep(300); await shot('07_옆글'); }
    await click('[data-action="gn-dm-close"]');
    await click('[data-action="gn-home"]');
    return res;
  }
  for (const tag of (process.env.PROBE_SIZES || '752x749').split(',')) {
    const [w, h] = tag.split('x').map(Number); const size = { width: w, height: h };
    await page.setViewportSize(size); await sleep(400);
    const dir = `${root}/${tag}`; mkdirSync(dir, { recursive: true });
    out[tag] = {};
    for (const id of (process.env.PROBE_SITES || 'gn,sm').split(',')) out[tag][id] = await site(id, tag, dir);
  }
  return out;
}
