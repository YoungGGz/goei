// 스티커 모서리 접기의 셈 (2026-11-22 사용자: 정해진 세모로만 떼지지 않게 — 끄는 방향대로 접힌다).
// 스티커는 왼쪽 위가 (0,0) 인 W×H 네모. 모서리 C 를 d 만큼 끌면 접는 선은 C 와 C+d 의 수직이등분선이고,
// 선의 C 쪽 조각이 들린다(lifted). 그 조각을 선에 대칭시킨 것이 접힌 종이의 뒷면(flap), 나머지가 붙어 있는 앞면(face).
// 화면(ui/homeshop.ts)은 이 다각형들을 px 좌표 그대로 clip-path 에 넣는다.
export type Pt = [number, number];
export type PeelCorner = 'br' | 'bl' | 'tr' | 'tl';

export interface Fold {
  /** 붙어 있는 앞면 */
  face: Pt[];
  /** 들린 조각 (바닥이 드러나는 자리). 안 들렸으면 빈 목록 */
  lifted: Pt[];
  /** 접힌 종이 뒷면 (들린 조각을 접는 선에 대칭) */
  flap: Pt[];
  /** 들린 넓이 / 스티커 넓이 */
  frac: number;
  /** 접는 선 위의 한 점 · 선에 수직이고 앞면 쪽을 보는 단위 벡터 (안 들렸으면 null) */
  line: { m: Pt; n: Pt } | null;
}

export const cornerPt = (c: PeelCorner, W: number, H: number): Pt => [c === 'br' || c === 'tr' ? W : 0, c === 'br' || c === 'bl' ? H : 0];

/** 끈 만큼을 스티커 안쪽 방향으로만 (바깥으로 끈 몫은 버린다) */
export function inward(c: PeelCorner, dx: number, dy: number): Pt {
  const sx = c === 'br' || c === 'tr' ? -1 : 1;
  const sy = c === 'br' || c === 'bl' ? -1 : 1;
  // + 0: 버린 몫이 -0 으로 남지 않게
  return [sx * Math.max(0, sx * dx) + 0, sy * Math.max(0, sy * dy) + 0];
}

const area = (p: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

/** 볼록 다각형을 반평면 { X : (X-m)·n >= 0 } (keep) 또는 그 반대쪽으로 자른다 */
function clip(poly: Pt[], m: Pt, n: Pt, keep: boolean): Pt[] {
  const side = ([x, y]: Pt) => ((x - m[0]) * n[0] + (y - m[1]) * n[1]) * (keep ? 1 : -1);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** 모서리 c 를 (dx, dy) 만큼 끌었을 때의 접힘. 바깥으로 끈 몫은 치지 않는다 */
export function foldAt(W: number, H: number, c: PeelCorner, dx: number, dy: number): Fold {
  const rect: Pt[] = [[0, 0], [W, 0], [W, H], [0, H]];
  const [ix, iy] = inward(c, dx, dy);
  const len = Math.hypot(ix, iy);
  if (!(W > 0) || !(H > 0) || len < 0.5) return { face: rect, lifted: [], flap: [], frac: 0, line: null };
  const [cx, cy] = cornerPt(c, W, H);
  const m: Pt = [cx + ix / 2, cy + iy / 2];
  const n: Pt = [ix / len, iy / len];
  const face = clip(rect, m, n, true);
  const lifted = clip(rect, m, n, false);
  const flap = lifted.map(([x, y]): Pt => {
    const k = (x - m[0]) * n[0] + (y - m[1]) * n[1];
    return [x - 2 * k * n[0], y - 2 * k * n[1]];
  });
  return { face, lifted, flap, frac: area(lifted) / (W * H), line: { m, n } };
}

/** 들린 넓이가 한도(max, 0~1)를 넘지 않게 끈 만큼을 줄인다 (방향은 그대로) */
export function limitDrag(W: number, H: number, c: PeelCorner, dx: number, dy: number, max: number): Pt {
  const d = inward(c, dx, dy);
  if (foldAt(W, H, c, d[0], d[1]).frac <= max) return d;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    if (foldAt(W, H, c, d[0] * t, d[1] * t).frac <= max) lo = t;
    else hi = t;
  }
  return [d[0] * lo, d[1] * lo];
}

/** 그 방향으로 한도까지 젖힌 자리. dir 은 가로·세로 크기 비 (부호는 모서리가 정한다) */
export function fullDrag(W: number, H: number, c: PeelCorner, dir: readonly [number, number], max: number): Pt {
  const sx = c === 'br' || c === 'tr' ? -1 : 1;
  const sy = c === 'br' || c === 'bl' ? -1 : 1;
  const k = 2 * (W + H) / (Math.hypot(dir[0], dir[1]) || 1);
  return limitDrag(W, H, c, sx * Math.abs(dir[0]) * k, sy * Math.abs(dir[1]) * k, max);
}

/** 누르기만 했을 때 젖혀지는 자리: dir 방향으로 한도까지. 접힌 뒷면이 스티커 밖으로 나가면(넓게 떼지는 상품) 스티커 안에 들어올 때까지
 *  방향을 한쪽 축으로 눕힌다 — dir 의 큰 쪽 축으로 (끝까지 눕히면 띠로 접혀 늘 안에 든다) */
export function pressDrag(W: number, H: number, c: PeelCorner, dir: readonly [number, number], max: number): Pt {
  const inside = (d: Pt) => foldAt(W, H, c, d[0], d[1]).flap.every(([x, y]) => x >= -0.5 && x <= W + 0.5 && y >= -0.5 && y <= H + 0.5);
  const ax = Math.abs(dir[0]);
  const ay = Math.abs(dir[1]);
  let d = fullDrag(W, H, c, [ax, ay], max);
  for (let i = 1; i <= 10 && !inside(d); i++) {
    const k = 1 - i / 10;
    d = fullDrag(W, H, c, ax >= ay ? [ax, ay * k] : [ax * k, ay], max);
  }
  return d;
}

/** 점이 들린 조각 안에 있는지 (바닥 글자가 드러났는지) */
export function liftedAt(f: Fold, x: number, y: number): boolean {
  return !!f.line && (x - f.line.m[0]) * f.line.n[0] + (y - f.line.m[1]) * f.line.n[1] < 0;
}

/** 화면에서 끈 만큼(확대를 푼 px) → 기울여 붙인 스티커의 제자리 좌표 (tilt 는 CSS rotate 의 도) */
export function unTilt(sx: number, sy: number, tilt: number): Pt {
  const r = (tilt * Math.PI) / 180;
  return [sx * Math.cos(r) + sy * Math.sin(r), -sx * Math.sin(r) + sy * Math.cos(r)];
}
