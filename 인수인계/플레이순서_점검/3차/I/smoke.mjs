// 틀 확인: 상태 넣기 → 한 턴 → 갱신기 요청 꼴 보기
import { open, responder, people, diag, STATES, OUT, updData, lastTag, sleep, ctl } from './common.mjs';
import { writeFileSync } from 'node:fs';
const t = await open();
const rsp = responder();
try {
  await t.setup();
  const r = await t.loadState(STATES + 'S-관리국-3턴.json');
  console.log('loaded', JSON.stringify(r).slice(0, 300));
  const p0 = await people(t);
  console.log('people0', Object.keys(p0?.people ?? {}));
  rsp.plan.main = () => '잼트리가 커피잔을 내려놓았다. "아, 소개할게. 이쪽은 스팡달."\n\n덩치 큰 남자가 손을 들었다. "반가워, 신입."\n[▣|2025.03.14|10:10 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리,스팡달|없음|관리국/신입|140000]';
  await t.send('잼트리에게 인사한다.');
  await sleep(4000);
  console.log('calls', rsp.calls.map((c) => c.seq + ':' + c.kind));
  const u = rsp.last('upd');
  if (u) { const d = updData(u.body); console.log('upd keys', Object.keys(d)); console.log('span', JSON.stringify(d.span.map((x) => ({ m: x.m, role: x.role, c: x.context_only, t: String(x.text).slice(0, 40) })))); console.log('lastTag', lastTag(d), 'people', d.people.map((p) => p.name)); }
  const p1 = await people(t);
  console.log('people1', Object.keys(p1?.people ?? {}));
  console.log('diag', JSON.stringify((await diag(t)).slice(-2)));
  await t.shot('../../I/out/smoke');
} finally { await rsp.stop(); await t.close(); }
