// I 구간 run7c: 성격 축 변경 후보 거절만 (run7 은 되돌린 후보에 거절 단추가 없어 거절을 못 봄). 축 impulsivity/up 으로 관찰 4번 → 거절
// (아래는 run7 을 바탕으로 함) run7: 성격 축 변경 후보 승인 → 되돌림 → 거절 (run4 pc 끝 상태는 다시 읽기로 관찰이 비었으므로 관찰 4번을 새로 쌓음). PC 1280x800
import { open, responder, people, OUT, updData, lastTag, sleep, recorder, EMPTY_UPD } from './common.mjs';
const R = recorder('run7c');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run7c.jsonl');
const ST = '[▣|2025.03.14|10:40 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
rsp.plan.main = () => '잼트리가 웃으며 경계를 풀었다. "후배는 믿을 만하네."\n' + ST;
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(1000));
const btn = (action) => t.feval((a) => { const b = [...document.querySelectorAll(`.gx [data-action="${a}"]`)].find((e) => e.offsetParent !== null); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); return b.dataset.value ?? ''; }, action).then(async (v) => { await sleep(1000); return v; });
const toastText = () => t.feval(() => [...document.querySelectorAll('.gx .gx-toast, .gx [role="status"], .gx .gx-err')].map((e) => e.innerText).join(' | ').slice(0, 200));
const cand = async () => { const p = await people(t); const j = p.people['잼트리']; return { impulsivity: j.axes?.impulsivity, axesFrom: j.axesFrom, cands: Object.values(j.candidates ?? {}).map((c) => `${c.axis}/${c.direction}/${c.status}/${c.evidence.length}`) }; };
try {
  await t.setup();
  await t.loadState(OUT + '/run4-state.json');
  for (const say of ['잼트리를 믿는다고 말한다.', '잼트리와 서류를 정리한다.', '잼트리에게 커피를 건넨다.', '잼트리의 보고서를 대신 들어 준다.']) {
    rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return JSON.stringify({ ...EMPTY_UPD, observations: [{ who: '잼트리', axis: 'impulsivity', direction: 'up', pattern: '생각보다 먼저 몸이 나간다', reason: '즉흥적으로 행동함', strength: 70, confidence: 80, m, quote: '잼트리가 웃으며 경계를 풀었다' }] }); };
    const c0 = rsp.maxSeq();
    await t.send(say);
    for (let i = 0; i < 60 && !rsp.since(c0).some((c) => c.kind === 'upd'); i++) await sleep(500);
    await sleep(2000);
  }
  R.step('1 관찰 4번 쌓음', '후보 evidence ≥4, 장면 ≥3 → 검토 대상', 'axes.ts CANDIDATE_READY(리수폿 이식)', await cand(), null);
  await t.openWindow('.gx'); await sleep(800);
  await act('rec-people'); await act('rec-person', '잼트리');
  await t.shot('../../I/out/run7c-candidate');
  const rj = await btn('pp-axis-reject');
  R.step('3 거절', '후보 rejected, 축 50 그대로', '코스 I-1 축 변경 거절', { reject: rj, after: await cand(), msg: await toastText() }, rj !== null);
  await t.shot('../../I/out/run7c-after');
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); } finally { await rsp.stop(); await t.close(); }
