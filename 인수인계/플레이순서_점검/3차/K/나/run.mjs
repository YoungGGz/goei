// 3차 K4 세계 탭 편집기 · 다시 돌리기 진입점.
//   node run.mjs t1 [절]                 T1(가짜 리스) 절 A~L  → run-t1.mjs
//   node run.mjs cap                     T1 폰 가로 882×344 · 폴드 752×749 dsf1.8 캡처 → cap-t1.mjs
//   node run.mjs k03                     T1 점검 「초기화」 대조 → k03-t1.mjs
//   FAKE_URL=http://<IP>:8802 node run.mjs t2 [절] [--w 1280 --h 800]   T2(실제 리스AI) 절 A~H → run-t2.mjs
// 가짜 서버: node ../../틀/fake-llm.mjs --port 8802 --log out/fake.jsonl (백그라운드)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('./', import.meta.url));
const [what = 't1', ...rest] = process.argv.slice(2);
const file = { t1: 'run-t1.mjs', t2: 'run-t2.mjs', cap: 'cap-t1.mjs', k03: 'k03-t1.mjs' }[what];
if (!file) { console.error('t1 | t2 | cap | k03'); process.exit(2); }
process.exit(spawnSync(process.execPath, [`${HERE}${file}`, ...rest], { stdio: 'inherit', cwd: HERE }).status ?? 1);
