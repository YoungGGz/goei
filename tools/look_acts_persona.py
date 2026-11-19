#!/usr/bin/env python3
"""페르소나 아바타(남·여 A)의 동작 그림 넣기 (2026-11-19 사용자: PixelLab 에 뽑아 둔 것을 쓴다).

PixelLab 서버의 그 캐릭터(look.json pixellab_id)에서 이미 뽑아 둔 동작의 장을 받아 오기만 한다 (새로 뽑지 않는다).
「그림/모습/동작_고른것.json」이 쓰기로 둔 줄만(이름 앞의 「v3 <줄>」로 찾음) 그림/모습/페르소나/<이름>/act_<줄>.webp 로 넣고
look.json 의 acts 에 측정값을 적는다. 같은 줄을 두 번 뽑아 둔 것은 둘 다 넣는다 (act_<줄>.webp, act_<줄>_2.webp).
자르기는 tools/look_acts.py 와 같다 (대기 칸과 동작 모든 장을 함께 덮는 상자, dx·dy = 그 안의 대기 칸 자리).

  python3 tools/look_acts_persona.py
"""
import io, json, os, re, glob, urllib.request
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, '그림', '모습', '페르소나')
API = 'https://api.pixellab.ai/v2/characters/'


def get(url, auth=False):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ.get('PIXELLAB_KEY', 'proxy')} if auth else {'User-Agent': 'look-acts'})
    return urllib.request.urlopen(req, timeout=120).read()


def main():
    pick = json.load(open(os.path.join(ROOT, '그림', '모습', '동작_고른것.json'), encoding='utf-8'))['동작']
    total = 0
    for d in sorted(glob.glob(os.path.join(BASE, '*'))):
        lj = os.path.join(d, 'look.json')
        look = json.load(open(lj, encoding='utf-8'))
        ch = json.loads(get(API + look['pixellab_id'], True))
        for f in glob.glob(os.path.join(d, 'act_*.webp')):
            os.remove(f)
        acts, seen = {}, {}
        for a in sorted(ch['animations'], key=lambda a: a['animation_group_id']):
            m = re.match(r'v3 (\d+) ', a.get('display_name') or '')
            south = next((x for x in a['directions'] if x['direction'] == 'south'), None)
            if not m or not south or m.group(1) not in pick:
                continue
            k = m.group(1)
            p = pick[k]
            if p['뺌'] or look['id'] in p['못씀']:
                continue
            seen[k] = seen.get(k, 0) + 1
            key = k if seen[k] == 1 else f'{k}_{seen[k]}'
            fr = [Image.open(io.BytesIO(get(u))).convert('RGBA') for u in south['frames']]
            cw = fr[0].width
            # 대기 칸의 캔버스 자리 (look.json 의 ox 는 128 칸 기준)
            ix, iy = (cw - look['w']) // 2 + look['ox'], look['oy']
            al = np.max([np.asarray(f)[..., 3] for f in fr], axis=0)
            xs = np.where(al.max(axis=0) > 0)[0]
            ys = np.where(al.max(axis=1) > 0)[0]
            x0, x1 = min(int(xs.min()), ix), max(int(xs.max()) + 1, ix + look['cw'])
            y0, y1 = min(int(ys.min()), iy), max(int(ys.max()) + 1, iy + look['ch'])
            w, h = x1 - x0, y1 - y0
            sheet = Image.new('RGBA', (w * len(fr), h), (0, 0, 0, 0))
            for i, f in enumerate(fr):
                sheet.paste(f.crop((x0, y0, x1, y1)), (i * w, 0))
            name = f'act_{key}.webp'
            sheet.save(os.path.join(d, name), lossless=True, method=6)
            acts[key] = {'name': p['이름'], 'file': name, 'n': len(fr), 'cw': w, 'ch': h, 'dx': ix - x0, 'dy': iy - y0, 'sec': round(1 / p['초당장'], 3), 'pixellab_group': a['animation_group_id']}
            total += 1
        if acts:
            look['acts'] = acts
        else:
            look.pop('acts', None)
        json.dump(look, open(lj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(os.path.basename(d), sorted(acts))
    print(f'동작 시트 {total}개')


if __name__ == '__main__':
    main()
