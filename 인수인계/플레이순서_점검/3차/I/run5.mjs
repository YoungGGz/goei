// I 구간 run5: 다시 굴린 직후(갱신기 전·갱신기 실패 뒤) 인물 창에 사라진 응답이 만든 인물이 보이는지 — PC·폰 화면
// 사용: node run5.mjs [pc|phone]
import { open, responder, people, STATES, OUT, updData, lastTag, sleep, ctl, recorder, EMPTY_UPD } from './common.mjs';
const mode = process.argv[2] || 'pc';
const phone = mode === 'phone';
const R = recorder('run5-' + mode);
const t = await open(phone ? { width: 344, height: 882, touch: true } : { width: 1280, height: 800 });
const rsp = responder(OUT + `/calls-run5-${mode}.jsonl`);
const ST = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';
let reply = '로비 의자에서 남자가 일어났다. "처음 뵙네요, 저는 서지훈입니다."';
rsp.plan.main = () => reply + '\n' + ST;
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(1000));
const listNames = () => t.feval(() => [...document.querySelectorAll('.gx [data-action="rec-person"]')].map((b) => b.dataset.value));
try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  rsp.plan.upd = (body) => { const d = updData(body); return U({ new_people: [{ name: '서지훈', aliases: [], m: lastTag(d), quote: '저는 서지훈입니다', identity: '미확인', speech: '존댓말' }] }); };
  let c0 = rsp.maxSeq();
  await t.send('로비를 둘러본다.');
  await waitUpd(c0);
  // 다시 굴림: 새 답엔 서지훈 없음, 갱신기는 500 (자동 재전송 뒤 실패)
  reply = '로비는 텅 비어 있었다.';
  await ctl('rules/add', { rule: { id: 'upd500', route: 'aux', match: 'system: # People Record Updater', status: 500 } });
  await t.reroll();
  await sleep(2000);
  await t.openWindow('.gx'); await sleep(800);
  await act('rec-people');
  await t.shot(`../../I/out/run5-${mode}-after-reroll-failed`);
  const shown = await listNames();
  const scr = await t.screenMessages();
  R.step('1 다시 굴림 + 갱신기 실패 뒤 인물 창', '사라진 응답에서만 나온 서지훈은 창 목록에서 빠져야 함', 'I-05(사용자 결정)·공-01', { list: shown, has서지훈InStore: !!(await people(t)).people['서지훈'], screenLast: scr.at(-1)?.text?.slice(0, 40) }, !shown.includes('서지훈'));
  await t.closeWindow();
  await ctl('rules/del', { id: 'upd500' });
  R.step('끝', '', '', { errors: t.errors.filter((e) => !/displayData|\[goei\] (시작|세계|본체|소지품)/.test(e)).slice(-8) }, null);
} catch (e) {
  R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false);
} finally { await rsp.stop(); await t.close(); }
