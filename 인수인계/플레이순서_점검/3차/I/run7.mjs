// I 구간 run7: 성격 축 변경 후보 승인 → 되돌림 → 거절 (run4 pc 끝 상태는 다시 읽기로 관찰이 비었으므로 관찰 4번을 새로 쌓음). PC 1280x800
import { open, responder, people, OUT, updData, lastTag, sleep, recorder, EMPTY_UPD } from './common.mjs';
const R = recorder('run7');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run7.jsonl');
const ST = '[▣|2025.03.14|10:40 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
rsp.plan.main = () => '잼트리가 웃으며 경계를 풀었다. "후배는 믿을 만하네."\n' + ST;
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(1000));
const btn = (action) => t.feval((a) => { const b = [...document.querySelectorAll(`.gx [data-action="${a}"]`)].find((e) => e.offsetParent !== null); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); return b.dataset.value ?? ''; }, action).then(async (v) => { await sleep(1000); return v; });
const toastText = () => t.feval(() => [...document.querySelectorAll('.gx .gx-toast, .gx [role="status"], .gx .gx-err')].map((e) => e.innerText).join(' | ').slice(0, 200));
const cand = async () => { const p = await people(t); const j = p.people['잼트리']; return { guardedness: j.axes?.guardedness, axesFrom: j.axesFrom, cands: Object.values(j.candidates ?? {}).map((c) => `${c.axis}/${c.direction}/${c.status}/${c.evidence.length}`) }; };
try {
  await t.setup();
  await t.loadState(OUT + '/run4-state.json');
  for (const say of ['잼트리를 믿는다고 말한다.', '잼트리와 서류를 정리한다.', '잼트리에게 커피를 건넨다.', '잼트리의 보고서를 대신 들어 준다.']) {
    rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return JSON.stringify({ ...EMPTY_UPD, observations: [{ who: '잼트리', axis: 'guardedness', direction: 'down', pattern: '도움을 받으면 경계를 푼다', reason: '믿음에 경계를 풂', strength: 70, confidence: 80, m, quote: '잼트리가 웃으며 경계를 풀었다' }] }); };
    const c0 = rsp.maxSeq();
    await t.send(say);
    for (let i = 0; i < 60 && !rsp.since(c0).some((c) => c.kind === 'upd'); i++) await sleep(500);
    await sleep(2000);
  }
  R.step('1 관찰 4번 쌓음', '후보 evidence ≥4, 장면 ≥3 → 검토 대상', 'axes.ts CANDIDATE_READY(리수폿 이식)', await cand(), null);
  await t.openWindow('.gx'); await sleep(800);
  await act('rec-people'); await act('rec-person', '잼트리');
  await t.shot('../../I/out/run7-candidate');
  const ap = await btn('pp-axis-approve');
  const a1 = await cand();
  const msg1 = await toastText();
  await t.shot('../../I/out/run7-approved');
  const rv = await btn('pp-axis-revert');
  const a2 = await cand();
  R.step('2 축 변경 승인 → 되돌림', '승인: guardedness 50→내려감, 후보 applied / 되돌림: 50 으로', '코스 I-1 축 변경 승인·되돌림', { approve: ap, afterApprove: a1, msg1, revert: rv, afterRevert: a2, msg2: await toastText() }, ap !== null && a1.guardedness < 50);
  const rj = await btn('pp-axis-reject');
  R.step('3 거절', '되돌린 뒤 후보가 다시 검토 대상이면 거절 → rejected', '코스 I-1', { reject: rj, after: await cand(), msg: await toastText() }, null);
  await t.shot('../../I/out/run7-after');
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); } finally { await rsp.stop(); await t.close(); }
