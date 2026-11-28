// 3차 K4 T1 화면 캡처: 폰 가로 882×344(터치), 폴드 펼침 752×749(dsf 1.8, CDP 로 흉내). 실기가 아니라 크기 흉내.
import { launch, session, STATE, sleep, OUT, check, results, dump } from './lib-t1.mjs';
import { writeFileSync } from 'node:fs';
const SIZES = [{ n: '882x344', vp: { width: 882, height: 344 }, touch: true }, { n: '752x749dsf1.8', vp: { width: 752, height: 749 }, touch: true, dsf: 1.8 }];
const b = await launch();
for (const z of SIZES) {
  const st = STATE('S-관리국-3턴');
  const S = await session(b, { chat: structuredClone(st.data), prefs: JSON.parse(st.t2.pluginStorage['goei:prefs']), vp: z.vp, touch: z.touch });
  if (z.dsf) { const s = await S.page.context().newCDPSession(S.page); await s.send('Emulation.setDeviceMetricsOverride', { width: z.vp.width, height: z.vp.height, deviceScaleFactor: z.dsf, mobile: true }); await sleep(300); }
  await S.openEd('agent');
  const overs = {};
  for (const n of ['agent', 'org', 'relations', 'base', 'start']) {
    await S.node(n);
    if (n === 'start') await S.act('dir-start-open', 'A00', { wait: 500 });
    if (n === 'base') await S.act('dir-open', '관리국 본부', { wait: 700 });
    await S.page.screenshot({ path: `${OUT}CAP_${n}-${z.n}.png` });
    overs[n] = await S.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, vis: [...document.querySelectorAll('.gw *')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.right > innerWidth + 1 && cs.visibility !== 'hidden' && e.offsetParent; }).slice(0, 5).map((e) => e.className || e.tagName) }));
  }
  check(`CAP-${z.n}`, `세계 편집기 5쪽 ${z.n} 가로 넘침(보이는 요소)`, '없음', '—', Object.values(overs).every((o) => o.sw <= o.w + 1 && !o.vis.length), overs, `out/CAP_*-${z.n}.png`);
  check(`CAP-${z.n}-err`, '콘솔 오류', '없음', '—', !S.errors.length, S.errors.slice(0, 5));
  await S.page.close();
}
await b.close();
writeFileSync(`${OUT}결과_CAP.json`, JSON.stringify(results, null, 2));
