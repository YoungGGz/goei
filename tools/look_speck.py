#!/usr/bin/env python3
"""페르소나 아바타 그림의 윤곽선 밖 회색 찌꺼기 지우기 (2026-11-19 사용자: 코드로 제거).

PixelLab 이 뽑은 장은 검은 윤곽선 바깥에 회색 점·줄·작은 덩이가 붙어 나온다. 장마다 차례로 지운다.
  1. 테두리 줄: 투명에 닿은 무채색 점이 바로 안쪽 이웃보다 25 이상 밝으면 지움 (3회).
  2. 덩이: 윤곽선에만 붙은 작은 회색 덩이(3~40점, 둘레 60% 이상 투명)와, 지운 탓에 떨어져 나온 4점 이하 조각.
  3. 남은 점: 투명에 닿은 작은 회색 조각(40점 이하)이 어두운 것(윤곽선·옷)에만 붙어 있으면 지움.
흰 것(셔츠·소매·담배) 둘레 2점, 몸과 떨어진 밝은 조각(연기)은 건드리지 않는다. 큰 회색(폰·컵·연기)은 3에 안 걸린다.

tools/look_acts_persona.py 가 동작 장을 받아 올 때 부르고, 이미 있는 그림에는 직접 돌린다.

  python3 tools/look_speck.py            # 그림/모습/페르소나/* 의 대기·동작 그림을 그 자리에서 고침
  python3 tools/look_speck.py --check    # 고치지 않고 지울 점 수만

scipy 가 있어야 한다 (pip install scipy).
"""
import glob, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, '그림', '모습', '페르소나')
K8 = np.ones((3, 3), bool)
K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
RIM_MIN, RIM_GAP, RIM_SAT, RIM_PASSES = 60, 25, 30, 3
CLUMP_MIN, CLUMP_MAX, CLUMP_L, CLUMP_CLEAR = 3, 40, 90, 0.6
ISLAND = 4
BIT_MAX, BIT_L, BIT_SAT, BIT_DARK, BIT_PASSES = 40, 90, 14, 60, 4
WHITE = 200


def lum(a):
    return (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) / 1000.0


def sat(a):
    return a[..., :3].max(2) - a[..., :3].min(2)


def nbmax(v):
    """8 이웃의 최댓값 (자기 빼고)."""
    f = K8.copy()
    f[1, 1] = False
    return nd.maximum_filter(v, footprint=f, mode='constant', cval=-1.0)


def rim(a, prot):
    tot = np.zeros(a.shape[:2], bool)
    for _ in range(RIM_PASSES):
        A = a[..., 3] > 0
        L = lum(a)
        edge = A & nd.binary_dilation(~A, K8, border_value=1)
        cand = edge & (L >= RIM_MIN) & (L <= WHITE) & (sat(a) <= RIM_SAT) & ~prot
        inner = nbmax(np.where(A & ~edge, L, -1.0))
        other = nbmax(np.where(A & ~cand, L, -1.0))
        ref = np.where(inner >= 0, inner, other)
        k = cand & (ref >= 0) & (ref <= L - RIM_GAP)
        if not k.any():
            break
        a[k] = 0
        tot |= k
    return tot


def effects(o):
    """몸과 떨어진 밝은 조각(연기 같은 것): 건드리지 않는다."""
    A = o[..., 3] > 0
    lab, n = nd.label(A, K8)
    size = np.bincount(lab.ravel())
    size[0] = 0
    prot = np.zeros_like(A)
    if n:
        L = lum(o)
        for i in range(1, n + 1):
            if i == size.argmax() or size[i] < 5:
                continue
            m = lab == i
            if (L[m] < 50).mean() < 0.1:
                prot |= m
    return prot, lab, size


def in_halo(a, m, halo):
    c = a[m][:, :3]
    return sum(tuple(int(t) for t in x) in halo for x in c) >= 0.8 * len(c)


def clumps(a, prot, halo):
    A = a[..., 3] > 0
    L = lum(a)
    lab, n = nd.label(A & (L >= CLUMP_L) & (L <= WHITE) & (sat(a) <= 30) & ~prot, K8)
    kill = np.zeros_like(A)
    size = np.bincount(lab.ravel())
    for i, sl in enumerate(nd.find_objects(lab), 1):
        if not CLUMP_MIN <= size[i] <= CLUMP_MAX:
            continue
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if min(h, w) < 3 or size[i] < 0.5 * h * w:      # 가는 줄(머리카락·끈)은 그림
            continue
        box = (slice(max(ys.start - 1, 0), ys.stop + 1), slice(max(xs.start - 1, 0), xs.stop + 1))
        m = lab[box] == i
        ring = nd.binary_dilation(m, K8) & ~m
        clear = ~A[box][ring]
        op = L[box][ring][~clear]
        if clear.mean() >= CLUMP_CLEAR and (op.size == 0 or op.max() <= 60) and in_halo(a[box], m, halo):
            kill[box] |= m
    return kill


def islands(a, prot, olab, osize, halo):
    A = a[..., 3] > 0
    lab, n = nd.label(A, K8)
    kill = np.zeros_like(A)
    if not n:
        return kill
    size = np.bincount(lab.ravel())
    S, L = sat(a), lum(a)
    near = nd.binary_dilation(olab == osize.argmax(), K8, iterations=2)
    for i in np.nonzero(size <= ISLAND)[0]:
        if i == 0:
            continue
        m = lab == i
        if (m & prot).any() or not in_halo(a, m, halo):
            continue
        grown = osize[np.unique(olab[m])].sum() > size[i]      # 지운 탓에 떨어져 나온 조각
        grey = (S[m] <= 40).all() and (L[m] <= WHITE).all()
        if (grown and (size[i] <= 2 or grey)) or (size[i] <= 2 and grey and (m & near).any()):
            kill |= m
    return kill


def bits(a, prot):
    """투명에 닿은 작은 회색 조각이 어두운 것에만 붙어 있으면 지운다."""
    tot = np.zeros(a.shape[:2], bool)
    for _ in range(BIT_PASSES):
        A = a[..., 3] > 0
        L = lum(a)
        dark = A & (L <= BIT_DARK)
        grey = A & (L >= BIT_L) & (sat(a) <= BIT_SAT)      # 흰 것까지 한 덩이로 세어 큰 것(셔츠·폰·컵)을 가른다
        lab, n = nd.label(grey, K8)
        size = np.bincount(lab.ravel())
        kill = np.zeros_like(A)
        for i, sl in enumerate(nd.find_objects(lab), 1):
            if size[i] > BIT_MAX:
                continue
            box = tuple(slice(max(s.start - 1, 0), s.stop + 1) for s in sl)
            m = lab[box] == i
            if (m & prot[box]).any() or (L[box][m] > WHITE).any():
                continue
            ring = nd.binary_dilation(m, K8) & ~m
            op = ring & A[box]
            if not (ring & ~A[box]).any() or not op.any() or not dark[box][op].all():
                continue
            kill[box] |= m
        if not kill.any():
            break
        a[kill] = 0
        tot |= kill
    return tot


def clean_frame(o):
    """한 장(RGBA 배열) → (고친 배열, 지운 자리)."""
    o = o.astype(np.int32)
    a = o.copy()
    eff, olab, osize = effects(o)
    white = (o[..., 3] > 0) & (lum(o) > WHITE)
    prot = nd.binary_dilation(white, K8, iterations=2)
    r = rim(a, prot)
    halo = {tuple(int(t) for t in c) for c in o[r][:, :3]}
    k = clumps(a, eff, halo)
    a[k] = 0
    k = islands(a, eff, olab, osize, halo)
    a[k] = 0
    bits(a, prot | eff)
    a[eff] = o[eff]
    return a.astype(np.uint8), (o[..., 3] > 0) & (a[..., 3] == 0)


def clean_sheet(im, cw, n):
    """가로로 n 장 붙은 그림 → (고친 그림, 지운 점 수)."""
    a = np.array(im.convert('RGBA'))
    cnt = 0
    for f in range(n):
        sl = np.s_[:, f * cw:(f + 1) * cw]
        a[sl], gone = clean_frame(a[sl])
        cnt += int(gone.sum())
    return Image.fromarray(a, 'RGBA'), cnt


def main():
    check = '--check' in sys.argv
    for d in sorted(glob.glob(os.path.join(BASE, '*'))):
        look = json.load(open(os.path.join(d, 'look.json'), encoding='utf-8'))
        sheets = [('대기', look)] + [(m['name'], m) for m in look.get('acts', {}).values()]
        for name, m in sheets:
            p = os.path.join(d, m['file'])
            im, cnt = clean_sheet(Image.open(p), m['cw'], m['n'])
            if cnt and not check:
                im.save(p, lossless=True, method=6)
            print(os.path.basename(d), m['file'], name, cnt)


if __name__ == '__main__':
    main()
