// 플레이 순서 점검 2차 · 16. 설정 화면 전체
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄우고 설정 창 단추를 누른다.
// 갈래(파트)마다 따로 돈다: node run.mjs a|b|c|d|e   (인자 없으면 전부 차례로, 브라우저는 한 번에 하나)
//   a = 모든 설정 페이지의 조작을 한 번씩 눌러 「바로 저장」 확인 → 점검 「기본값으로 저장」 → 새 채팅처럼 비운 뒤 「불러오기」 → 「초기화」 가 바꾼 값을 모두 다루는지
//   b = 모든 수 칸(− 값 +): + 한 번의 폭, 최대보다 큰 수·최소보다 작은 수 직접 입력 → 저장값·보이는 값
//   c = 지침 탭: 기본 글 = 지침/ 파일, 고치면 바로 저장되고 요청에 들어감, 초기화로 돌아옴
//   d = 설정값이 실제 요청 글·호출에 반영되는지 (본편 beforeRequest, 상점 보조 호출)
//   e = 폰 크기 갈래 (− + · 직접 입력 · 다시 열기)
// 결과: out/단계NN_*.txt, out/상태NN.json, out/결과_<파트>.json
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = fileURLToPath(new URL('./', import.meta.url));
const part = process.argv[2];
if (!part) {
  for (const p of ['a1', 'a2', 'b', 'c', 'd', 'e']) {
    const r = spawnSync(process.execPath, [`${HERE}run.mjs`, p], { stdio: 'inherit' });
    if (r.status) console.log(`파트 ${p} 끝 상태 ${r.status}`);
  }
  process.exit(0);
}
const mod = await import(`./part_${part[0]}.mjs`);
await mod.default(part);
