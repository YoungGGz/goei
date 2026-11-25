// K9 외부 프레임이 실제로 그려지는 넓은 PC 창(1600×1000): 일반 태블릿(기본) / 전술 / 없음
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const g = () => t.F().evaluate(() => { const x = document.querySelector('.gx'); const f = x.querySelector('.gx-frame'); return { frame: x.dataset.frame, hidden: x.dataset.frameHidden ?? null, el: f ? f.dataset.kind : null }; });
  await C.open(); await sleep(600);
  for (const [txt, kind] of [['일반 태블릿', 'tablet'], ['전술 태블릿', 'tactical'], ['없음', 'none']]) {
    await C.openSet(); await C.node('set:screen'); await C.seg('외부 프레임', txt); await C.closeSet(); await sleep(500);
    const a = await g(); await C.shot(`k9-wide-프레임-${kind}`);
    R.push(rec(`k9-wide 외부 프레임 ${txt}`, { expect: `1600 폭: data-frame=${kind}, 틀 요소 ${kind === 'none' ? '없음' : kind}`, src: 'ui/frame.ts', actual: a, ok: a.frame === kind && (kind === 'none' ? !a.el : a.el === kind) && !a.hidden }));
  }
  await C.openSet(); await C.node('set:screen'); await C.seg('외부 프레임', '일반 태블릿'); await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok }));
}
