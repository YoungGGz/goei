// click-audit --probe: 위키 기본 문서마다 정보표 그림이 붙는지, 문서 안 링크가 어디로 가는지 (11-20 사용자: 협회 문서 그림 안 붙음)
// 쓰기 예: --start board --from 'nav-tab|net>br-go|wk' --probe .scratch/ca-tool/probes/wiki-pics.mjs
import { readFileSync } from 'node:fs';
const TITLES = Object.keys(JSON.parse(readFileSync(new URL('../../../카드/wiki-base.json', import.meta.url), 'utf8')));

export default async function (page, { log }) {
  const out = [];
  for (const t of TITLES) {
    const r = await page.evaluate(async (t) => {
      const wk = document.querySelector('.wk');
      if (!wk) return { err: 'no wiki' };
      const b = document.createElement('button');
      b.dataset.action = 'wiki-pick'; b.dataset.value = t; b.style.display = 'none';
      wk.appendChild(b); b.click();
      await new Promise((r) => setTimeout(r, 120));
      for (let i = 0; i < 40 && !document.querySelector('.wk .nw-doc img[src]'); i++) await new Promise((r) => setTimeout(r, 60));
      const doc = document.querySelector('.wk .nw-doc');
      const h1 = document.querySelector('.wk h1')?.textContent?.trim() ?? '';
      const img = doc?.querySelector('img');
      const links = [...(doc?.querySelectorAll('[data-action="wiki-open"]') ?? [])].map((a) => a.dataset.value);
      // 기본 문서 바깥 사진(asset_src)·정보표 칸 표시
      return { h1, hasDoc: !!doc, img: img ? (img.getAttribute('src') || '').slice(0, 40) : '', imgAlt: img?.getAttribute('alt') ?? '', links: [...new Set(links)] };
    }, t);
    out.push({ title: t, ...r });
  }
  // 링크 대상: 각 링크가 문서로 열리는지
  const allLinks = [...new Set(out.flatMap((o) => o.links || []))];
  const linkRes = [];
  for (const l of allLinks) {
    const r = await page.evaluate(async (t) => {
      const wk = document.querySelector('.wk');
      const b = document.createElement('button');
      b.dataset.action = 'wiki-pick'; b.dataset.value = t; b.style.display = 'none';
      wk.appendChild(b); b.click();
      await new Promise((r) => setTimeout(r, 80));
      return { h1: document.querySelector('.wk h1')?.textContent?.trim() ?? '', doc: !!document.querySelector('.wk .nw-doc'), compose: !!document.querySelector('.wk .nodoc, .wk [data-action="wiki-gen"]') };
    }, l);
    linkRes.push({ link: l, ...r });
  }
  log(`위키 문서 ${out.length}, 그림 없음 ${out.filter((o) => !o.img).length}, 링크 ${linkRes.length}, 문서로 안 열림 ${linkRes.filter((x) => !x.doc).length}`);
  return { docs: out, links: linkRes };
}
