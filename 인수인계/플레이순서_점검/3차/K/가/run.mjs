// 3차 K/가 (K1·K2·K3·K5·K6·K7·K8 + 닿는 공통 갈래). 다시 돌리기:
//   node 인수인계/플레이순서_점검/3차/틀/fake-llm.mjs --port 8801 --log 인수인계/플레이순서_점검/3차/K/가/out/fake.jsonl &
//   FAKE_URL=http://<컨테이너IP>:8801 node 인수인계/플레이순서_점검/3차/K/가/run.mjs [k1 k2 k3 k5 k6 k7 k8 cm t1 ...]   (빼면 전부, 한 번에 브라우저 하나)
//   T1 갈래(저장 실패·보조 스트리밍·모델 응답 대기)는 t1.mjs (fixture /tmp/t1fx/fixture.json).
const parts = process.argv.slice(2);
const all = ['k1', 'k2', 'k3', 'k3b', 'k5', 'k6', 'k6b', 'k7', 'k7b', 'k8', 'k8b', 'cm', 'k9', 'k9b'];
for (const p of parts.length ? parts : all) {
  if (p === 't1') { await (await import('./t1.mjs')).t1(); continue; }
  const mod = await import(`./p_${p}.mjs`);
  console.log(`\n════════ ${p} ════════`);
  await mod[p]();
}
process.exit(0);
