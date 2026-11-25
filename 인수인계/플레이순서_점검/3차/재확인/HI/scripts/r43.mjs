// 재확인 R43: 호칭이 바뀐 뒤 시트 호칭(p.address)·변경 기록·화면·갱신기 자료·본편 블록이 어느 값을 읽는지 (S-관리국-3턴, 잼트리)
import { open, responder, people, STATES, OUT, updData, lastTag, tagOf, sleep, recorder, EMPTY_UPD } from './common.mjs';
const R = recorder('r43');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-r43.jsonl');
const ST = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
let reply = '잼트리가 웃으며 말했다. "이제부터 신입님이라고 부를게요, 신입님."';
rsp.plan.main = () => reply + '\n' + ST;
rsp.plan.router = () => '{"selected":["잼트리"],"new_characters":[]}';
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(1000));
const who = '잼트리';
let addrBefore = null;
try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  const p0 = (await people(t)).people[who];
  rsp.plan.upd = (body) => { const d = updData(body); addrBefore = d?.people?.find((p) => p.name === who)?.address_now ?? null; return U({ address: [{ who, toUser: '신입님', register: addrBefore?.register ?? '존댓말', m: tagOf(d, '신입님이라고') ?? lastTag(d), quote: '이제부터 신입님이라고 부를게요' }] }); };
  let c0 = rsp.maxSeq();
  await t.send('잼트리에게 인사한다.');
  await waitUpd(c0);
  const st1 = await people(t);
  const p1 = st1.people[who];
  const ch1 = (st1.log ?? []).filter((c) => c.who === who && c.kind === 'address');
  await t.openWindow('.gx'); await sleep(800);
  await act('rec-people'); await act('rec-person', who);
  const scr = await t.feval(() => { const el = [...document.querySelectorAll('.gx .pp-addr')].find((e) => /「/.test(e.innerText)); if (el) el.scrollIntoView({ block: 'center' }); return el ? el.innerText : [...document.querySelectorAll('.gx .pp-addr')].length + '개, 「 없음'; });
  await sleep(500);
  await t.shot('r43-person');
  await t.closeWindow();
  rsp.plan.upd = () => U({});
  reply = '잼트리가 서류를 건넸다. "여기요."';
  c0 = rsp.maxSeq();
  await t.send('서류를 받는다.');
  await waitUpd(c0);
  const u2 = updCalls(c0)[0];
  const main2 = rsp.since(c0).find((c) => c.kind === 'main');
  const pb = (main2?.body?.messages ?? []).map((m) => String(m.content)).find((x) => x.includes('[People records]')) ?? '';
  const addrLine = pb.split('\n').filter((l) => /신입님|calls \{\{user\}\}|addresses|calls the protagonist|부르/.test(l)).slice(0, 4);
  R.step('호칭 바뀐 뒤 읽는 값', '(기대: 화면·갱신기 자료·본편 블록이 모두 바뀐 호칭 「신입님」을 읽음. 시트 p.address 는 시작값 그대로여도 됨)', 'I 「Claude 정할 거리」 마지막 줄 · affinity.ts addressOf', {
    sheetBefore: p0?.address, addrNowBefore: addrBefore, sheetAfter: p1?.address, changeCount: ch1.length, changeLast: ch1.at(-1) ? { toUser: ch1.at(-1).toUser, register: ch1.at(-1).register } : null,
    screen: scr, nextUpdAddressNow: updData(u2?.body)?.people?.find((p) => p.name === who)?.address_now ?? null, mainBlockAddrLines: addrLine, mainBlockHas신입님: pb.includes('신입님'), mainBlockHasPeople: !!pb,
  }, null);
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); await t.shot('r43-error').catch(() => {}); } finally { await rsp.stop(); await t.close(); }
