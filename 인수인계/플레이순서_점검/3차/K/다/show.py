import json,sys
# 사용: python3 show.py <이름 앞부분> [all]  — steps.jsonl 에서 그 단계들 (실패만 또는 전부) 보여 줌
pre=sys.argv[1]; allp=len(sys.argv)>2
for l in open('out/steps.jsonl'):
  d=json.loads(l)
  if d['name'].startswith(pre) and (allp or not d['ok']):
    print(('OK ' if d['ok'] else 'NG '), d['name'], '|', json.dumps(d.get('actual'),ensure_ascii=False)[:1200], d.get('err') or '')
