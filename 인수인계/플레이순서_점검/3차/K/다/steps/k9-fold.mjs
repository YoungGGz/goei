// K9 펼친 폴드 752×749(배율 1.8, 터치) — 크기 흉내. 배치 PC(기본)·배율 70 기본 → 50·88·100, 창 가로·세로 50·100, 배치 모바일. 결정표 K-10, 답-02
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k9-fold ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const look = () => t.F().evaluate(() => {
    const g = document.querySelector('.gx'); const p = g?.querySelector('.gx-panel'); const r = p?.getBoundingClientRect();
    const vis = (s) => { const e = g?.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return q.width > 1 && q.height > 1 && getComputedStyle(e).display !== 'none' ? [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)] : null; };
    const nb = [...(g?.querySelectorAll('.gx-nav .gx-nb') ?? [])].filter((b) => b.getBoundingClientRect().width > 0);
    return { vw: innerWidth, vh: innerHeight, zoom: getComputedStyle(document.documentElement).zoom, panel: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
      idcard: vis('.gx-nav-brand .gx-idc, .gx-nav-brand > *'), face: vis('.gx-nav-face'), nav: vis('.gx-nav'), navLabelsShown: nb.filter((b) => { const s = b.querySelector('span'); return s && s.getBoundingClientRect().width > 0; }).length, navBtns: nb.length,
      phoneBar: !!g?.querySelector('.gx-nav') && (g.querySelector('.gx-nav').getBoundingClientRect().y > innerHeight * 0.7) };
  });
  const lookSet = () => t.F().evaluate(() => { const w = document.querySelector('.gw .gw-win'); const r = w?.getBoundingClientRect(); return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null; });
  const prog = () => t.page.evaluate(() => { const e = document.querySelector('[x-goei-prog]'); return e ? { phone: e.getAttribute('x-goei-phone'), panel: e.getAttribute('x-goei-panel'), d: getComputedStyle(e).display } : null; });
  const setNum = async (label, v) => { await C.typeNum(label, v); };
  const shotBoth = async (name) => { await C.closeSet(); await sleep(500); const L = await look(); await C.shot(`k9-fold-${name}-상황판`); await C.openSet(); await C.node('set:screen'); await sleep(300); const S = await lookSet(); await C.shot(`k9-fold-${name}-설정`); return { L, S }; };

  await C.open(); await sleep(800);
  const L0 = await look(); await C.shot('k9-fold-01-기본-상황판');
  await C.openSet(); await C.node('set:screen'); const S0 = await lookSet(); await C.shot('k9-fold-01-기본-설정');
  await step('기본 PC·70%·95%·95%', 'html zoom 0.7, 상황판 창·설정 창 둘 다 화면의 약 95%×95%, PC 배치(왼쪽 메뉴·ID카드)', 'K-10 (사용자 11-22), media.ts foldCss', async () => ({ actual: { L0, S0, prog: await prog() }, ok: Number(L0.zoom) === 0.7 && Math.abs(L0.panel[2] / L0.vw - 0.95) < 0.03 && Math.abs(L0.panel[3] / L0.vh - 0.95) < 0.03 && !L0.phoneBar }));

  for (const z of [50, 88, 100]) {
    await setNum('펼친 폴드 화면 배율', z);
    const v = (await C.store('goei:prefs')).foldZoom;
    const { L, S } = await shotBoth(`02-배율${z}`);
    await step(`배율 ${z}%`, `prefs.foldZoom=${z}, html zoom ${z / 100}. 88% 이상은 줄인 폭(752/${z / 100}≈${Math.round(752 / (z / 100))})이 601~860 이라 PC 메뉴가 아이콘 줄로 바뀌고 ID카드가 사라짐(답-02 — 사용자 답 없음, 사실만 적음)`, 'K-10, 답-02', async () => ({ actual: { v, L, S }, ok: v === z && Math.abs(Number(L.zoom) - z / 100) < 0.001 }));
  }
  // 범위 밖 직접 입력 → 끝값
  await setNum('펼친 폴드 화면 배율', 30); const lo = { store: (await C.store('goei:prefs')).foldZoom, box: (await C.row('펼친 폴드 화면 배율')).vals[0] };
  await setNum('펼친 폴드 화면 배율', 130); const hi = { store: (await C.store('goei:prefs')).foldZoom, box: (await C.row('펼친 폴드 화면 배율')).vals[0] };
  await step('배율 범위 밖 30 / 130 직접 입력', '저장 50 / 100, 칸도 50 / 100', 'core/settings.ts:188, settings.ts:1012', async () => ({ actual: { lo, hi }, ok: lo.store === 50 && lo.box === '50' && hi.store === 100 && hi.box === '100' }));
  // − / + 끝에서 막힘
  const minusAtLo = await (async () => { await setNum('펼친 폴드 화면 배율', 50); return C.stepBtn('펼친 폴드 화면 배율', '-'); })();
  const plus1 = await (async () => { await C.stepBtn('펼친 폴드 화면 배율', '+'); return (await C.store('goei:prefs')).foldZoom; })();
  await step('배율 −/+ (끝 50에서 − 막힘, + 한 번에 1)', '− 비활성, + 뒤 51', 'K-02', async () => ({ actual: { minusClickable: minusAtLo, after: plus1 }, ok: minusAtLo === false && plus1 === 51 }));
  await setNum('펼친 폴드 화면 배율', 70);

  for (const [w, h] of [[50, 50], [100, 100]]) {
    await setNum('펼친 폴드 창 가로', w); await setNum('펼친 폴드 창 세로', h);
    const p = await C.store('goei:prefs');
    const { L, S } = await shotBoth(`03-창${w}x${h}`);
    await step(`창 가로·세로 ${w}%×${h}%`, `상황판 창·설정 창 ≈ 화면 ${w}%×${h}%`, 'K-10, media.ts:47', async () => ({ actual: { foldW: p.foldW, foldH: p.foldH, L, S }, ok: Math.abs(L.panel[2] / L.vw - w / 100) < 0.04 && Math.abs(L.panel[3] / L.vh - h / 100) < 0.04 && Math.abs(S[2] / L.vw - w / 100) < 0.04 }));
  }
  await setNum('펼친 폴드 창 가로', 95); await setNum('펼친 폴드 창 세로', 95);

  // 배치 모바일
  await C.seg('펼친 폴드 화면 배치', '모바일');
  const rowsHidden = { zoom: await C.row('펼친 폴드 화면 배율'), w: await C.row('펼친 폴드 창 가로') };
  const { L: Lm, S: Sm } = await shotBoth('04-모바일');
  await step('배치 모바일', '344 폰 배치 그대로(아래 바), zoom 1, 창 전체, 배율·창 크기 줄 숨김(PC 배치일 때만 보임)', 'K-10, settings.ts:422', async () => ({ actual: { Lm, Sm, rowsHidden, prog: await prog() }, ok: Number(Lm.zoom) === 1 && Lm.phoneBar && !rowsHidden.zoom && !rowsHidden.w }));
  await C.seg('펼친 폴드 화면 배치', 'PC');
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
