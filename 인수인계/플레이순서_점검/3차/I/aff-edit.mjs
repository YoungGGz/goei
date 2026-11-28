// 호감 직접 수정 (사용자 2026-11-28 버그 리포트): 직접 고친 값에 고정되지 않고, 그 뒤 계기가 그 값에서 이어서 더해지는지.
// 사용: FAKE_URL_I=$FAKE_URL node aff-edit.mjs [pc|phone]   pc = 1920x1080, phone = 390x844(터치)
import { open, responder, people, STATES, OUT, updData, lastTag, sleep, recorder, EMPTY_UPD } from './common.mjs';

const mode = process.argv[2] || 'pc';
const phone = mode === 'phone';
const R = recorder('aff-edit-' + mode);
const t = await open(phone ? { width: 390, height: 844, touch: true } : { width: 1920, height: 1080 });
const rsp = responder(OUT + `/calls-aff-edit-${mode}.jsonl`);
const ST = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
rsp.plan.main = () => '잼트리가 웃으며 경계를 풀었다. "후배 덕분에 살았네. 고마워!"\n' + ST;
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= 1) { await sleep(1800); return true; } await sleep(300); } return false; };
const P = '../../I/out/aff-edit-' + mode + '-';
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(900));
const btn = (action) => t.feval((a) => { const b = [...document.querySelectorAll(`.gx [data-action="${a}"]`)].find((e) => e.offsetParent !== null); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }, action).then(async (r) => { await sleep(900); return r; });
const text = () => t.feval(() => document.querySelector('.gx')?.innerText ?? '');
const fillIn = (name, val) => t.feval(([n, v]) => { const e = document.querySelector(`.gx [data-input="${n}"]`); if (!e) return false; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [name, val]);
const affNum = async () => { const m = (await text()).match(/(-?\d+(?:\.\d+)?)\s*· 범위/); return m ? Number(m[1]) : null; };
const overflow = () => t.feval(() => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('.gx *')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > w + 1).length; });
const openPerson = async () => { await t.openWindow('.gx'); await sleep(800); await act('rec-people'); await act('rec-person', '잼트리'); if ((await affNum()) === null) await btn('pp-num-toggle'); };

try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await openPerson();
  const before = await affNum();
  await t.shot(P + '1-고치기전');
  // 직접 수정: 150
  await btn('pp-aff-edit');
  const note = (await text()).match(/저장하면 그 값으로[^\n]*/)?.[0] ?? null;
  await fillIn('pp-aff-num', '150'); await fillIn('pp-aff-reason', '시험');
  await t.shot(P + '2-수정칸');
  await btn('pp-aff-save');
  const info = (await text()).match(/호감을 150[^\n]*/)?.[0] ?? null;
  const after = await affNum();
  const logLine = (await text()).match(/호감 직접 수정 150[^\n]*/)?.[0] ?? null;
  await t.shot(P + '3-저장뒤');
  R.step('1 직접 수정 저장', '값 150, 안내·알림·변경 기록 글', '사용자 2026-11-28', { before, after, note, info, logLine, overflow: await overflow() }, after === 150 && !!note && !!info);
  // 다음 응답에서 계기 「도움」
  rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ cues: [{ who: '잼트리', cue: '도움', m, quote: '후배 덕분에 살았네', reason: '도움' }] }); };
  const c0 = rsp.maxSeq();
  await t.closeWindow(); await t.send('잼트리의 일을 돕는다.');
  await waitUpd(c0);
  await openPerson();
  const moved = await affNum();
  const cues = (await people(t)).log.filter((c) => c.who === '잼트리' && c.kind === 'cue').map((c) => (c.pin !== undefined ? `pin:${c.pin}` : `cue:${c.cue}`));
  await t.shot(P + '4-계기뒤');
  R.step('2 직접 수정 뒤 계기', '150 에 고정되지 않고 그 값에서 이어서 오름', '사용자 2026-11-28', { after, moved, cues, overflow: await overflow() }, moved !== null && moved > 150);
} catch (e) {
  R.step('오류', '', '', String(e?.stack ?? e).slice(0, 600), false);
} finally {
  await rsp.stop(); await t.close?.();
  process.exit(0);
}
