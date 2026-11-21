// 지도 확대: 지도 칸(.gx-canvas)은 그대로 두고 안쪽 그림(.gx-mapzoom)만 키우고 옮긴다.
// 휴대폰은 두 손가락 벌리기·한 손가락 끌기, PC는 Ctrl+휠(트랙패드 오므리기)·끌기, 어디서나 +/− 버튼.
// 핀은 그림과 함께 자리를 옮기고, 크기는 조금만 커지도록 되돌려 줄인다(--pz).

const MAX = 4;
const MOVE = 6;

interface View { z: number; x: number; y: number }

/** 지역별 확대 상태. 다시 그려도 보던 자리를 지킨다 */
const views = new Map<string, View>();

/** 지도 칸 크기가 바뀌면(창 크기·늦게 잡히는 배치) 지금 그려진 지도의 채우기·자리를 다시 맞춘다. 관찰자는 하나만 둔다 */
let reapply: (() => void) | null = null;
let sizeWatch: ResizeObserver | null = null;

/** nation: 지역 지도일 때 맨 아래 「전국」 (v0.16.17: 지도 위 줄에 있던 ← 전국을 확대 버튼 밑으로).
 *  원래 크기 버튼은 맨 위: 확대하면 생기는데 아래에 두면 +/− 가 한 칸씩 밀려 올라갔다 (v0.16.18) */
export function mapZoomControls(nation = false): string {
  return `<div class="gx-zoom" aria-label="지도 확대">
      <button class="gx-zbtn reset" data-zoom="reset" aria-label="원래 크기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      <button class="gx-zbtn" data-zoom="in" aria-label="확대">+</button>
      <button class="gx-zbtn" data-zoom="out" aria-label="축소">−</button>
      ${nation ? '<button class="gx-zbtn txt" data-action="map-region" data-value="01" aria-label="전국 지도">전국</button>' : ''}
    </div>`;
}

/** 보이는 칸(cw·ch) 안에서 그림(lw·lh × z)이 빈틈없이 덮게. 그림이 칸보다 작은 쪽은 가운데 */
function clamp(v: View, cw: number, ch: number, lw: number, lh: number): View {
  const z = Math.min(MAX, Math.max(1, v.z));
  const fit = (p: number, c: number, l: number) => (l * z <= c ? (c - l * z) / 2 : Math.min(0, Math.max(c - l * z, p)));
  return { z, x: fit(v.x, cw, lw), y: fit(v.y, ch, lh) };
}

type Box = { l: number; t: number; r: number; b: number };
const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const box = (el: Element): Box => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
const grow = (b: Box, n: number): Box => ({ l: b.l - n, t: b.t - n, r: b.r + n, b: b.b + n });
/** 이름표와 남의 점 사이 최소 틈(px) */
const DOT_GAP = 5;
const rank = (el: Element) => (el.classList.contains('sel') ? 0 : /\bhot/.test(el.className) ? 1 : 2);

/** 이름표끼리 겹치거나 남의 점을 덮으면 그 이름표를 점 위·오른쪽·왼쪽·귀퉁이로 옮겨 보고, 어디에도 자리가 없을 때만 숨기고 점만 남긴다
 *  (11-09 점검 13: 서울 이름표를 인천이 덮어 안 눌림). 앞선 핀(고른 곳 → 사건 난 곳 → 원래 순서)이 먼저 자리를 잡는다.
 *  확대해 자리가 나면 제자리로 돌아온다. 점은 따로 그린 겹(gx-pdot)이라 이름표를 옮겨도 그대로. 숨긴 핀은 점 쪽이 대신 눌리고 읽힌다 */
function declutter(layer: HTMLElement, frame: HTMLElement, z: number): void {
  const labs = [...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-plab')];
  const dots = [...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-pdot')];
  if (!labs.length) return;
  for (const el of labs) el.style.removeProperty('--lx'), el.style.removeProperty('--ly');
  // 칸 테두리(1px)에서 1px 더 안쪽까지만 (이름표가 칸 위 끝을 3px 넘어 검색 칸을 덮었다, 752×749 실리수)
  const F = grow(box(frame), -2);
  const inFrame = (r: Box) => r.l >= F.l && r.r <= F.r && r.t >= F.t && r.b <= F.b;
  const dotBox = dots.map((d) => { const dot = d.querySelector('.gx-dot'); return dot ? box(dot) : null; });
  const order = labs.map((el, i) => ({ el, i })).sort((a, b) => rank(a.el) - rank(b.el) || a.i - b.i);
  // 확대 단추 밑에도 이름표를 두지 않는다
  const placed: Box[] = [...frame.querySelectorAll('.gx-zbtn')].map(box);
  for (const { el, i } of order) {
    const name = el.querySelector('.gx-pname');
    const D = dotBox[i];
    if (!name || !D) continue;
    const N0 = box(name);
    const w = N0.r - N0.l, h = N0.b - N0.t;
    // 점이 칸 안에 보이는데 제자리 이름표가 칸 밖으로 삐져나가면 칸 안으로 밀어 넣는다 (확대해 칸 밖으로 나간 점은 그대로)
    const dIn = D.l >= F.l && D.r <= F.r && D.t >= F.t && D.b <= F.b;
    const nl = dIn && w <= F.r - F.l ? Math.min(Math.max(N0.l, F.l), F.r - w) : N0.l;
    const nt = dIn && h <= F.b - F.t ? Math.min(Math.max(N0.t, F.t), F.b - h) : N0.t;
    const N = { l: nl, t: nt, r: nl + w, b: nt + h };
    const my = (D.t + D.b) / 2 - h / 2;
    // 아래(제자리) → 위 → 오른쪽 → 왼쪽 → 네 귀퉁이 → 옆 반 칸 위아래
    // (옆 반 칸: 귀퉁이까지 막혀 이름표 없는 점이 여럿 남았다, 전수점검 눌러-사소-1·눌러2-보통-7. 점에 닿는 자리만이라 어느 점 이름인지는 그대로 읽힌다)
    const up = D.t - 2 - h, dn = D.b + 2, rt = D.r + 1, lt = D.l - 1 - w, hh = h / 2 + 1;
    const spots: [number, number][] = [[N.l, N.t], [N.l, up], [D.r + 3, my], [D.l - 3 - w, my], [rt, up], [lt, up], [rt, dn], [lt, dn],
      [D.r + 3, my - hh], [D.r + 3, my + hh], [D.l - 3 - w, my - hh], [D.l - 3 - w, my + hh]];
    // 남의 점과는 조금 띄운다: 맞닿기만 해도 그 점의 이름표로 읽혔다 (전수점검 눌러2-보통-7: 「경남」 이름표가 전남 점에 붙어 있었다)
    const free = (r: Box) => !placed.some((p) => hit(p, r)) && !dotBox.some((d, j) => j !== i && d && hit(grow(d, DOT_GAP), r));
    let at = -1;
    spots.some(([l, t], k) => {
      const r = { l, t, r: l + w, b: t + h };
      if ((k === 0 || inFrame(r)) && free(r)) return (at = k), placed.push(r), true;
      return false;
    });
    // 고른 핀은 숨기지 않는다: 빈자리가 없을 때만 제자리 (전에는 늘 제자리라 옆 점이 「중구」 이름표를 덮어 「ㅇ구」로 읽혔다, 눌러3-PC-2)
    if (at < 0 && rank(el) === 0) at = 0, placed.push({ l: N.l, t: N.t, r: N.r, b: N.b });
    const blocked = at < 0;
    el.classList.toggle('lab-off', blocked);
    if (at >= 0 && (spots[at][0] !== N0.l || spots[at][1] !== N0.t)) {
      el.style.setProperty('--lx', `${(spots[at][0] - N0.l) / z}px`);
      el.style.setProperty('--ly', `${(spots[at][1] - N0.t) / z}px`);
    }
    const d = dots[i];
    d.toggleAttribute('title', blocked);
    if (blocked) d.title = el.getAttribute('aria-label') ?? '';
    d.tabIndex = blocked ? 0 : -1;
    d.setAttribute('aria-hidden', String(!blocked));
  }
}

/** 확대 단추 줄을 오른쪽·왼쪽 아래 중 점을 덜 덮는 쪽에 둔다. 고른 곳·사건 난 곳의 점은 무겁게 센다
 *  (전수점검 눌러-중대-2: 오른쪽 아래 +/− 가 울릉·독도 확대창의 목표 핀과 서울 동쪽 구 핀을 덮었다) */
function placeZoom(canvas: HTMLElement, layer: HTMLElement): void {
  const zoom = canvas.querySelector<HTMLElement>('.gx-zoom');
  if (!zoom) return;
  canvas.classList.remove('zl');
  const Z = box(zoom);
  const C = box(canvas);
  const w = Z.r - Z.l;
  const right = Z;
  const left = { l: C.l + (C.r - Z.r), t: Z.t, r: C.l + (C.r - Z.r) + w, b: Z.b };
  const weight = (el: Element) => (el.classList.contains('sel') ? 100 : /\bhot/.test(el.className) ? 10 : 1);
  // 점과 함께 고른 곳·사건 난 곳의 이름표도 센다 (점은 비켜도 바로 밑 목표 이름표를 덮었다)
  const marks = [...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-pdot')].map((d) => [d, d.querySelector('.gx-dot')] as const)
    .concat([...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-plab')].filter((l) => rank(l) < 2).map((l) => [l, l.querySelector('.gx-pname')] as const));
  const score = (z: Box) => marks.reduce((n, [pin, el]) => (el && hit(box(el), z) ? n + weight(pin) : n), 0);
  canvas.classList.toggle('zl', score(left) < score(right));
}

/** 이름표가 칸 끝에 잘리지 않게 핀 범위 양쪽에 두는 여유(px) */
const PIN_PAD = 16;
/** 지금 지도의 핀 점 좌우 범위 (겹 폭에 대한 비율 0~1). 핀은 field.ts 가 left:% 로 놓는다 */
function pinSpan(layer: HTMLElement): { l: number; r: number } | null {
  const xs = [...layer.querySelectorAll<HTMLElement>('.gx-pin.gx-pdot')].map((p) => parseFloat(p.style.left) / 100).filter((n) => Number.isFinite(n));
  return xs.length ? { l: Math.min(...xs), r: Math.max(...xs) } : null;
}

/** render() 뒤에 부른다. 지도 칸이 없으면 아무것도 안 한다 */
export function bindMapZoom(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLElement>('.gx-canvas[data-map]');
  const layer = canvas?.querySelector<HTMLElement>('.gx-mapzoom');
  if (!canvas || !layer) return;
  const key = canvas.dataset.map ?? '';
  // 처음엔 가운데 (PC 임무 탭은 칸이 그림보다 낮아 위아래가 잘린다. 2026-10-21 사용자: 끌어서 본다)
  let v = views.get(key) ?? { z: 1, x: Number.NaN, y: Number.NaN };
  const canPan = () => layer.offsetWidth * v.z > canvas.clientWidth + 1 || layer.offsetHeight * v.z > canvas.clientHeight + 1;

  const img = canvas.querySelector<HTMLImageElement>('.gx-mapimg');
  let placed = false;
  const apply = () => {
    // 그림이 불리기 전엔 크기가 0이라 가운데를 못 잰다. 저장하지 않고 load 뒤에 맞춘다 (전수검사 11-13)
    if (Number.isNaN(v.y) && img && !img.complete) {
      layer.style.transform = '';
      return;
    }
    // 폴드 펼침 폭(601~860, CSS --gx-mapfill: 1): 칸이 남은 높이를 다 쓰므로 그림을 칸 높이까지 키운다.
    // 칸보다 넓어진 그림은 좌우로 끌어서 본다. 핀은 겹(.gx-mapzoom) 기준 %라 겹 폭만 바꾸면 제자리를 지킨다
    const fill = getComputedStyle(canvas).getPropertyValue('--gx-mapfill').trim() === '1';
    // 단, 처음 화면에 모든 핀이 보이게 겹 폭에 상한을 둔다: 핀 좌우 범위(+이름표 여유 PIN_PAD 양쪽)가 칸 폭 안에 들어오게.
    // 상한에 걸려 그림이 칸보다 낮아지면 위아래는 clamp 가 가운데에 둔다(남는 띠는 칸 배경색)
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const span = pinSpan(layer);
    if (fill && img?.naturalWidth && img.naturalHeight) {
      const cap = span && span.r > span.l ? (cw - PIN_PAD * 2) / (span.r - span.l) : Number.POSITIVE_INFINITY;
      const w = Math.max(cw, Math.min((ch * img.naturalWidth) / img.naturalHeight, cap));
      layer.style.width = `${Math.floor(w)}px`;
    } else layer.style.removeProperty('width');
    if (Number.isNaN(v.y)) v = { ...v, y: (ch - layer.offsetHeight) / 2 };
    // 처음엔 좌우도 가운데: 그림이 칸보다 넓으면 그림 가운데가 아니라 핀 범위 가운데를 칸 가운데에
    if (Number.isNaN(v.x)) {
      const lw = layer.offsetWidth;
      v = { ...v, x: lw > cw && span ? cw / 2 - ((span.l + span.r) / 2) * lw : (cw - lw) / 2 };
    }
    v = clamp(v, canvas.clientWidth, canvas.clientHeight, layer.offsetWidth, layer.offsetHeight);
    views.set(key, v);
    layer.style.transform = v.z === 1 && !v.x && !v.y ? '' : `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    layer.style.setProperty('--pz', String(Math.pow(v.z, 0.25) / v.z));
    canvas.classList.toggle('zoomed', v.z > 1);
    canvas.classList.toggle('pan', canPan());
    // 단추 쪽은 그릴 때 한 번만 고른다. 확대·옮길 때마다 고르면 + 를 누른 뒤 단추 줄이 반대쪽으로 뛰어
    // 다음 누름이 핀에 떨어진다 (검토 지적: 눌러-중대-2)
    if (!placed) (placed = true), placeZoom(canvas, layer);
    declutter(layer, canvas, v.z);
  };
  /** 칸 안의 한 점(px)을 붙잡은 채 배율을 바꾼다 */
  const zoomAt = (z: number, cx: number, cy: number) => {
    const nz = Math.min(MAX, Math.max(1, z));
    v = { z: nz, x: cx - ((cx - v.x) / v.z) * nz, y: cy - ((cy - v.y) / v.z) * nz };
    apply();
  };
  const local = (px: number, py: number) => {
    const r = canvas.getBoundingClientRect();
    return [px - r.left - canvas.clientLeft, py - r.top - canvas.clientTop] as const;
  };
  if (img && !img.complete) img.addEventListener('load', apply, { once: true });
  apply();
  reapply = apply;
  if (typeof ResizeObserver !== 'undefined') {
    sizeWatch ??= new ResizeObserver(() => reapply?.());
    sizeWatch.disconnect();
    sizeWatch.observe(canvas);
  }

  canvas.querySelector('.gx-zoom')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom]');
    if (!b) return;
    e.stopPropagation();
    const w = canvas.clientWidth / 2, h = canvas.clientHeight / 2;
    if (b.dataset.zoom === 'reset') (v = { z: 1, x: Number.NaN, y: Number.NaN }), apply();
    else zoomAt(v.z * (b.dataset.zoom === 'in' ? 1.6 : 1 / 1.6), w, h);
  });

  // 끌고 나서 손을 떼면 그 자리 핀이 눌리지 않게
  let dragged = false;
  canvas.addEventListener('click', (e) => {
    if (dragged && !(e.target as HTMLElement).closest('.gx-zoom')) e.stopPropagation(), e.preventDefault();
    dragged = false;
  }, true);

  // 휴대폰: 터치
  let start: { d: number; mx: number; my: number; v: View; x: number; y: number } | null = null;
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches;
    dragged = false;
    if ((e.target as HTMLElement).closest('.gx-zoom')) return (start = null);
    if (t.length === 2) {
      const [mx, my] = local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      start = { d: dist(t), mx, my, v: { ...v }, x: t[0].clientX, y: t[0].clientY };
    } else if (t.length === 1) start = { d: 0, mx: 0, my: 0, v: { ...v }, x: t[0].clientX, y: t[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches;
    if (!start) return;
    if (t.length === 2 && start.d) {
      e.preventDefault();
      dragged = true;
      const [mx, my] = local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      const nz = Math.min(MAX, Math.max(1, (start.v.z * dist(t)) / start.d));
      // 두 손가락 가운데가 잡은 지점을 따라가게
      v = { z: nz, x: mx - ((start.mx - start.v.x) / start.v.z) * nz, y: my - ((start.my - start.v.y) / start.v.z) * nz };
      apply();
    } else if (t.length === 1 && canPan() && !start.d) {
      // 확대했을 때만 한 손가락으로 지도를 옮긴다(아니면 화면 스크롤)
      e.preventDefault();
      const dx = t[0].clientX - start.x, dy = t[0].clientY - start.y;
      if (Math.hypot(dx, dy) > MOVE) dragged = true;
      v = { ...start.v, x: start.v.x + dx, y: start.v.y + dy };
      apply();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    // 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 옮기기
    const t = e.touches;
    start = t.length === 1 ? { d: 0, mx: 0, my: 0, v: { ...v }, x: t[0].clientX, y: t[0].clientY } : null;
  }, { passive: true });

  // PC: Ctrl+휠(트랙패드 오므리기)로만 확대·축소, 마우스 끌기.
  // 그냥 휠은 창 스크롤 (v0.16.18: v0.16.17에서 그냥 휠로 확대하게 했더니 불편했다)
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const [cx, cy] = local(e.clientX, e.clientY);
    zoomAt(v.z * Math.exp(-e.deltaY / 200), cx, cy);
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !canPan() || (e.target as HTMLElement).closest('.gx-zoom')) return;
    const sx = e.clientX, sy = e.clientY, sv = { ...v };
    dragged = false;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - sx, dy = m.clientY - sy;
      if (Math.hypot(dx, dy) > MOVE) dragged = true;
      if (dragged) (v = { ...sv, x: sv.x + dx, y: sv.y + dy }), apply();
    };
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up));
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}
