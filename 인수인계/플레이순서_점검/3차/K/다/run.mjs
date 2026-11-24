// K/다 다시 돌리기: 크기마다 새 브라우저(실제 리스AI T2 + 가짜 모델 서버) → 단계 파일 차례로, 끝에 T1 두 개.
// 먼저: 가짜 서버 node ../../틀/fake-llm.mjs --port 8803 --log out/fake.jsonl (백그라운드), 그다음
//   curl -X POST http://<IP>:8803/_ctl/rules --data-binary @rules-base.json
// 사용: FAKE_URL_K=http://<IP>:8803 node run.mjs [단계 이름 일부…]   (이름을 주면 그것만)
// 결과: out/steps.jsonl (단계마다 한 줄), out/*.png, out/*.json
import { makeCtx } from './lib.mjs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const want = (n) => !only.length || only.some((o) => n.includes(o));
const PLAN = [
  { size: 'pc', steps: [['k9-pc'], ['k9-pc2'], ['k08'], ['k10'], ['k10-auxlore'], ['k11a'], ['k11b'], ['k11c'], ['k11c2'], ['k12'], ['k12b', { mode: 'closed' }], ['k13'], ['kcommon']] },
  { size: 'phone', steps: [['k9-size', { tag: 'phone' }]] },
  { size: 'land', steps: [['k9-size', { tag: 'land' }]] },
  { size: 'fold', steps: [['k9-size', { tag: 'fold' }], ['k9-fold']] },
  { w: 1600, h: 1000, steps: [['k9-wide']] },
];
for (const p of PLAN) {
  const steps = p.steps.filter(([n]) => want(n));
  if (!steps.length) continue;
  const C = await makeCtx(p);
  try {
    for (const [n, arg] of steps) {
      try { const m = await import(`./steps/${n}.mjs`); console.log(n, JSON.stringify(await m.default(C, arg))); } catch (e) { console.log(n, 'ERR', e.message); }
    }
  } finally { await C.close(); }
}
for (const f of ['t1-k10.mjs', 't1-kfail.mjs']) if (want(f)) { try { console.log(execFileSync('node', [`${HERE}/${f}`, '/tmp/t1fx/fixture.json'], { encoding: 'utf8', timeout: 600000 })); } catch (e) { console.log(f, 'ERR', e.message); } }
