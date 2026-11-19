#!/usr/bin/env python3
"""아바타 동작 그림 넣기 (2026-11-19 사용자: 대기 사이에 끼워 넣을 동작을 고르기 도구에서 판정).

옛 필드 인물 팩(char-N/<줄>.webp + char.json A[줄])에서 「그림/모습/동작_고른것.json」이 쓰기로 둔 동작만 꺼내
그림/모습/인물/char-N/act_<줄>.webp 로 넣고, char.json 의 acts 에 측정값을 적는다.

동작 시트는 정면 대기(50) 칸에 맞춰 자른다: 칸 = 대기 칸과 그 동작 모든 장을 함께 덮는 상자.
dx·dy = 그 상자 안에서 대기 칸의 왼쪽 위 자리 → 화면은 대기 그림 자리를 그대로 두고 상자만 겹쳐 그려 발밑이 안 움직인다.

  python3 tools/look_acts.py <옛 팩 폴더(char-N 들이 있는 곳)>
"""
import json, os, sys, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOKS = os.path.join(ROOT, '그림', '모습', '인물')
CANVAS = 256


def frames(d, k, a):
    """줄 시트를 256 캔버스 장들로 편다 (칸 폭 w 는 가운데 정렬, ox·oy 는 칸 안 자리)"""
    im = Image.open(os.path.join(d, f'{k}.webp')).convert('RGBA')
    out = []
    for f in range(a['n']):
        c = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        c.paste(im.crop((f * a['cw'], 0, (f + 1) * a['cw'], a['ch'])), ((CANVAS - a['w']) // 2 + a['ox'], a['oy']))
        out.append(c)
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    pick = json.load(open(os.path.join(ROOT, '그림', '모습', '동작_고른것.json'), encoding='utf-8'))['동작']
    total = 0
    for d in sorted(glob.glob(os.path.join(LOOKS, 'char-*'))):
        ch = os.path.basename(d)[5:]
        sd = os.path.join(src, f'char-{ch}')
        cj = os.path.join(d, 'char.json')
        mine = json.load(open(cj, encoding='utf-8'))
        for f in glob.glob(os.path.join(d, 'act_*.webp')):
            os.remove(f)
        acts = {}
        if os.path.isdir(sd):
            A = json.load(open(os.path.join(sd, 'char.json'), encoding='utf-8'))['A']
            idle = mine['A']['50']
            # 대기 칸의 캔버스 자리
            ix, iy = (CANVAS - idle['w']) // 2 + idle['ox'], idle['oy']
            for k, m in pick.items():
                if m['뺌'] or ch in m['못씀'] or k not in A:
                    continue
                fr = frames(sd, k, A[k])
                al = np.max([np.asarray(f)[..., 3] for f in fr], axis=0)
                xs = np.where(al.max(axis=0) > 0)[0]
                ys = np.where(al.max(axis=1) > 0)[0]
                x0, x1 = min(int(xs.min()), ix), max(int(xs.max()) + 1, ix + idle['cw'])
                y0, y1 = min(int(ys.min()), iy), max(int(ys.max()) + 1, iy + idle['ch'])
                w, h = x1 - x0, y1 - y0
                sheet = Image.new('RGBA', (w * len(fr), h), (0, 0, 0, 0))
                for i, f in enumerate(fr):
                    sheet.paste(f.crop((x0, y0, x1, y1)), (i * w, 0))
                name = f'act_{k}.webp'
                sheet.save(os.path.join(d, name), lossless=True, method=6)
                acts[k] = {'name': m['이름'], 'file': name, 'n': len(fr), 'cw': w, 'ch': h, 'dx': ix - x0, 'dy': iy - y0, 'sec': round(1 / m['초당장'], 3)}
                total += 1
        if acts:
            mine['acts'] = acts
        else:
            mine.pop('acts', None)
        json.dump(mine, open(cj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'동작 시트 {total}개')


if __name__ == '__main__':
    main()
