// I 구간 run6b: W4 입력 상한 넘김 다시 (run6 은 상한을 1000 으로 넣었으나 설정 최솟값 3000 으로 올라가 시험이 성립 안 함). 상한 3000, 응답 약 4000자
import { open, responder, people, diag, OUT, sleep, recorder, setVars, STATES, EMPTY_UPD } from './common.mjs';
const R = recorder('run6b');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run6b.jsonl');
rsp.plan.upd = () => JSON.stringify(EMPTY_UPD);
try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await setVars(t, { '$pp_span_cap': '3000' });
  const readBefore = Object.keys((await people(t))?.read ?? {}).length;
  rsp.plan.main = () => '쟈알디가 긴 이야기를 시작했다. ' + '관리국의 역사는 길고 복잡했다. '.repeat(240) + '\n[▣|2025.03.14|09:30 AM|☀️|12°C|서울 종로구 관리국 본부 면담실|없음|쟈알디|없음|관리국/신입|140000]';
  const c1 = rsp.maxSeq();
  await t.send('이야기를 듣는다.');
  await sleep(6000);
  const dg = (await diag(t)).filter((x) => x.reason === 'turn').at(-1);
  const p = await people(t);
  const n = rsp.since(c1).filter((c) => c.kind === 'upd').length;
  R.step('1 입력 상한 넘김 (W4)', '갱신기 호출 없음, 진단 stage budget, 읽음 표시 안 함', 'I-12(사용자 결정)', { updCalls: n, diag: dg, readBefore, readAfter: Object.keys(p?.read ?? {}).length }, dg?.stage === 'budget' && n === 0);
  await t.openWindow('.gx'); await sleep(800);
  await t.shot('../../I/out/run6b-budget');
  await t.closeWindow();
  await setVars(t, { '$pp_span_cap': '20000' });
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); } finally { await rsp.stop(); await t.close(); }
