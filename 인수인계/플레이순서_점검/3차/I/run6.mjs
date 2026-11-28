// I 구간 run6: 새 채팅 인물 장면(면접)으로 출발 → 첫 턴 갱신기 요청의 첫 장면 글에 %%GOEI_SCENE%% 가 가는지 (0단계 본것 1번 재현)
import { open, responder, people, diag, OUT, updData, sleep, recorder, setVars, EMPTY_UPD } from './common.mjs';
const R = recorder('run6');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run6.jsonl');
rsp.plan.main = () => '쟈알디가 고개를 끄덕였다. "좋다."\n[▣|2025.03.14|09:20 AM|☀️|12°C|서울 종로구 관리국 본부 면담실|없음|쟈알디|없음|관리국/신입|140000]';
rsp.plan.upd = () => JSON.stringify(EMPTY_UPD);
try {
  await t.setup();
  const st = await t.startPanel({ fac: 'A00', scene: '면접' });
  await sleep(3000);
  R.step('0 출발', '인물 장면 면접', 'B-02', st, null);
  const c0 = rsp.maxSeq();
  await t.send('자리에 앉는다.');
  for (let i = 0; i < 60 && !rsp.since(c0).some((c) => c.kind === 'upd'); i++) await sleep(500);
  const u = rsp.since(c0).find((c) => c.kind === 'upd');
  const d = updData(u?.body);
  const m1 = d?.span?.find((x) => String(x.text).includes('%%'));
  R.step('1 첫 턴 갱신기 요청', '플러그인 표식(%%GOEI_SCENE%%)은 보조 모델에 가지 않아야 함', '코스 2-4(넣지 말 것)·0단계 본것 1', { marker: !!m1, m: m1?.m, tail: m1 ? String(m1.text).slice(-40) : null, routerOrDirHas: rsp.since(c0).filter((c) => c.kind !== 'upd' && JSON.stringify(c.body).includes('%%GOEI_SCENE')).map((c) => c.kind) }, !m1);
  R.step('2 기록', '첫 장면에 나온 인물 기록', 'I-02', Object.keys((await people(t))?.people ?? {}), null);
  // W4: 확정 응답 글이 입력 상한을 넘으면 보내지 않고 거부(읽음 표시 안 함)
  await setVars(t, { '$pp_span_cap': '1000' });
  rsp.plan.main = () => '쟈알디가 긴 이야기를 시작했다. ' + '관리국의 역사는 길고 복잡했다. '.repeat(120) + '\n[▣|2025.03.14|09:30 AM|☀️|12°C|서울 종로구 관리국 본부 면담실|없음|쟈알디|없음|관리국/신입|140000]';
  const c1 = rsp.maxSeq();
  await t.send('이야기를 듣는다.');
  await sleep(5000);
  const dg = (await diag(t)).filter((x) => x.reason === 'turn').at(-1);
  const p = await people(t);
  R.step('3 입력 상한 넘김 (W4)', '갱신기 호출 없음, 진단 stage budget, 읽음 표시 안 함', 'I-12(사용자 결정)', { updCalls: rsp.since(c1).filter((c) => c.kind === 'upd').length, diag: dg, readN: Object.keys(p?.read ?? {}).length }, dg?.stage === 'budget' && rsp.since(c1).filter((c) => c.kind === 'upd').length === 0);
  await setVars(t, { '$pp_span_cap': '20000' });
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); } finally { await rsp.stop(); await t.close(); }
