// 재확인 남은칸2 R43: 안 돌린 두 자리 — store.ts:363 (이름 옮겨 합칠 때 호칭) · ui/people.ts:1413 (직접 수정에서 호칭 칸을 비우고 저장)
import { open, responder, people, STATES, OUT, updData, lastTag, tagOf, sleep, recorder, EMPTY_UPD, ctl } from './common.mjs';
import { writeFileSync } from 'node:fs';
const R = recorder('r43b');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-r43b.jsonl');
const ST = (w) => `[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|${w}|없음|관리국/신입|140000]`;
let reply = '';
rsp.plan.main = () => reply;
rsp.plan.router = () => '{"selected":[],"new_characters":[]}';
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(900));
const addrScreen = () => t.feval(() => { const el = [...document.querySelectorAll('.gx .pp-addr')].find((e) => e.querySelector('[data-action="pp-addr-edit"]')); if (el) el.scrollIntoView({ block: 'center' }); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
const openPerson = async (who) => { await t.openWindow('.gx'); await sleep(800); await act('rec-people'); await act('rec-person', who); };
const editAddr = async (who, { to, reg, pin }) => {
  await act('pp-addr-edit', who);
  const r = await t.feval(([to, pin]) => { const i = document.querySelector('.gx [data-input="pp-addr-to"]'); if (!i) return 'no-input'; i.value = to; i.dispatchEvent(new Event('input', { bubbles: true })); const c = document.querySelector('.gx [data-change="pp-addr-pin"]'); if (c && c.checked !== pin) { c.click(); } return { to: i.value, pin: c?.checked ?? null }; }, [to, !!pin]);
  await sleep(500);
  if (reg) await act('pp-addr-reg', 'reg=' + reg);
  const before = await t.feval(() => ({ to: document.querySelector('.gx [data-input="pp-addr-to"]')?.value ?? null, pin: document.querySelector('.gx [data-change="pp-addr-pin"]')?.checked ?? null }));
  await act('pp-addr-save', who);
  return { r, before };
};
const peopleBlock = (rec) => (rec?.body?.messages ?? []).map((m) => String(m.content)).find((c) => c.includes('[People records]')) ?? '';
const linesOf = (blk, re) => blk.split('\n').filter((l) => re.test(l)).slice(0, 6);
try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  const p0 = await people(t);
  R.step('0 시작', '스팡달 기록 없음(명부 인물), 잼트리 시트 호칭', 'states', { names: Object.keys(p0.people).sort(), 잼트리addr: p0.people['잼트리']?.address }, null);

  // ── A. 호칭 기록 → 사용자가 호칭 고정 → 갱신기가 명부 인물 이름으로 옮김 (store.ts:363) ──
  reply = '복도 끝에서 검은 정장의 여자가 입꼬리를 올렸다. "길 잃었어, 꼬마?"\n' + ST('없음');
  rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '검은 정장의 여자', aliases: [], m, quote: '검은 정장의 여자가 입꼬리를 올렸다', identity: '관리국 복도에서 마주친 여자', speech: '반말', provisional: true }] }); };
  let c0 = rsp.maxSeq();
  await t.send('복도 끝을 본다.');
  await waitUpd(c0);
  let p = await people(t);
  R.step('A-1 호칭 기록', '「검은 정장의 여자」 provisional', 'I-06', { has: !!p.people['검은 정장의 여자'], prov: p.people['검은 정장의 여자']?.provisional, addr: p.people['검은 정장의 여자']?.address }, p.people['검은 정장의 여자']?.provisional === true);
  await openPerson('검은 정장의 여자');
  const e1 = await editAddr('검은 정장의 여자', { to: '꼬마', reg: '반말', pin: true });
  const scrA = await addrScreen();
  await t.shot('r43b-A2-고정');
  await t.closeWindow();
  p = await people(t);
  R.step('A-2 호칭 고정', '직접 수정: 「꼬마」·반말·고정 → address {toUser 꼬마, pin}', '사용자 직접 수정', { edit: e1, screen: scrA, addr: p.people['검은 정장의 여자']?.address }, p.people['검은 정장의 여자']?.address?.pin === true);

  reply = '"스팡달. 기억해 둬, 꼬마." 그녀가 손가락으로 사원증을 툭 쳤다.\n' + ST('스팡달');
  rsp.plan.upd = (body) => { const d = updData(body); const m = tagOf(d, '스팡달. 기억해') ?? lastTag(d); return U({ renames: [{ from: '검은 정장의 여자', to: '스팡달', m, quote: '스팡달. 기억해 둬, 꼬마.' }] }); };
  c0 = rsp.maxSeq();
  await t.send('이름을 묻는다.');
  await waitUpd(c0);
  p = await people(t);
  const dgA = await t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const raw = await cs.pluginStorage.getItem('goei-people-diag'); const v = typeof raw === 'string' ? JSON.parse(raw) : raw; const d = (v ?? []).filter((x) => x.reason === 'turn').at(-1); return d?.report ? { renamed: d.report.applied?.renamed, dropped: d.report.dropped } : null; });
  await openPerson('스팡달');
  const scrA3 = await addrScreen();
  await t.shot('r43b-A3-옮긴뒤');
  await t.closeWindow();
  const chA = (p.log ?? []).filter((c) => c.who === '스팡달' && c.kind === 'address').map((c) => `${c.src}:${c.toUser}:${c.register}`);
  R.step('A-3 이름 옮긴 뒤 호칭', '(관찰) 사용자가 고정한 「꼬마」(반말·고정)가 옮겨 간 기록에 남는가. 코드 store.ts:363 은 받는 쪽(시트) 호칭이 있으면 src 호칭을 버림', 'I-08(Claude 판정)·store.ts renamePerson 주석 「호칭 고정은 to 것이 정해져 있으면 그대로」', { diag: dgA, names: Object.keys(p.people).sort(), 스팡달addr: p.people['스팡달']?.address, 스팡달changes: chA, screen: scrA3 }, null);
  // 다음 본편·갱신기에서 읽는 값
  reply = '스팡달이 커피를 홀짝였다.\n' + ST('스팡달');
  let updA4 = null;
  rsp.plan.upd = (body) => { updA4 = updData(body); return U({}); };
  rsp.plan.router = () => '{"selected":["스팡달"],"new_characters":[]}';
  c0 = rsp.maxSeq();
  await t.send('스팡달을 따라간다.');
  await waitUpd(c0);
  const mainA4 = rsp.since(c0).filter((c) => c.kind === 'main').at(-1);
  const blk = peopleBlock(mainA4);
  R.step('A-4 다음 요청이 읽는 호칭', '(관찰) 본편 [People records] 와 갱신기 address_now 의 스팡달 호칭', 'affinity.ts addressOf', { updAddrNow: updA4?.people?.find((x) => x.name === '스팡달')?.address_now ?? null, mainLines: linesOf(blk, /Spangdal|스팡달|꼬마|Address/), blockHas꼬마: blk.includes('꼬마') }, null);

  // ── B. 직접 수정에서 호칭 칸을 비우고 저장 (ui/people.ts:1413) ──
  reply = '잼트리가 웃었다. "이제부터 신입님이라고 부를게요, 신입님."\n' + ST('잼트리');
  rsp.plan.router = () => '{"selected":["잼트리"],"new_characters":[]}';
  rsp.plan.upd = (body) => { const d = updData(body); return U({ address: [{ who: '잼트리', toUser: '신입님', register: '존댓말', m: tagOf(d, '신입님이라고') ?? lastTag(d), quote: '이제부터 신입님이라고 부를게요' }] }); };
  c0 = rsp.maxSeq();
  await t.send('잼트리에게 인사한다.');
  await waitUpd(c0);
  p = await people(t);
  await openPerson('잼트리');
  const scrB1 = await addrScreen();
  const e2 = await editAddr('잼트리', { to: '', reg: '반말', pin: false });
  const scrB2 = await addrScreen();
  await t.shot('r43b-B2-비우고저장');
  await t.closeWindow();
  const p2 = await people(t);
  const chB = (p2.log ?? []).filter((c) => c.who === '잼트리' && c.kind === 'address').map((c) => `${c.src}:${c.toUser}:${c.register}`);
  R.step('B 호칭 칸 비우고 반말로 저장', '(관찰) 지금 호칭 「신입님」에서 칸을 비우고 저장하면 화면은? 코드 1413: 빈 칸이면 시트 첫 값(p.address.toUser) 을 넣은 수동 변경을 만듦', 'ui/people.ts:1413', { sheet: p2.people['잼트리']?.address, before: scrB1, edit: e2, after: scrB2, changes: chB }, null);
  // B-2 고정으로 비우기
  await openPerson('잼트리');
  const e3 = await editAddr('잼트리', { to: '', reg: '반말', pin: true });
  const scrB3 = await addrScreen();
  await t.shot('r43b-B3-비우고고정');
  await t.closeWindow();
  const p3 = await people(t);
  R.step('B-2 칸 비우고 고정', '(관찰) 고정이면 address 를 {toUser:\'\'} 로 덮음', 'ui/people.ts:1409', { sheet: p3.people['잼트리']?.address, edit: e3, after: scrB3 }, null);
  R.step('끝', '', '', { errors: t.errors.filter((e) => !/displayData|\[goei\] (시작|본체|세계|소지품)/.test(e)).slice(-10) }, null);
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1500), false); await t.shot('r43b-error').catch(() => {}); }
finally { await rsp.stop(); await t.close(); }
