// I 구간 run11: 처음에 I 에 걸지 않았던 공통 갈래를 인물 기록 쪽에서 본다. PC 1280x800
//  A 메시지 직접 고치기(연필로 인물 이름 바꾸기)  B 내 말만 지우기  C 둘 이상 연달아 지우기
//  D 본편 요청 실패(503 한 번)·리스AI 자동 재시도  E 생각 블록 안에만 나온 이름(스트리밍 끔/켬, <Thoughts>·<think>)
//  F 기능 끔  G 갱신 모델 메인/보조 전환  H 다른 봇 채팅
import { open, responder, people, diag, STATES, OUT, updData, tagOf, lastTag, sleep, ctl, setVars, recorder, EMPTY_UPD } from './common.mjs';
const R = recorder('run11abc');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run11abc.jsonl');
const ST = '[▣|2025.03.14|11:00 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';
const MAIN = new Map();
rsp.plan.main = (body) => {
  const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  for (const [k, v] of MAIN) if (String(last).includes(k)) return v + '\n' + ST;
  return '로비는 조용했다.\n' + ST;
};
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const names = async () => Object.keys((await people(t))?.people ?? {}).sort();
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const peopleBlock = (body) => (body?.messages ?? []).map((m) => String(m.content)).find((c) => c.includes('[People records]')) ?? '';
const fakeSeq = async () => Math.max(0, ...(await ctl('log?since=0&full=0')).map((x) => x.seq));
const fakeSince = async (s) => (await ctl(`log?since=${s}`));
const newPerson = (name, quote) => (body) => { const d = updData(body); return U({ new_people: [{ name, aliases: [], m: tagOf(d, quote) ?? lastTag(d), quote, identity: '미확인', speech: '존댓말' }] }); };
const chatMsgs = async () => (await t.chatState(true)).message;

try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');

  // ── A. 메시지 직접 고치기 ──
  MAIN.set('복도로 간다', '복도에서 남자가 인사했다. "저는 권도현입니다. 시설팀이에요."');
  rsp.plan.upd = newPerson('권도현', '저는 권도현입니다');
  let c0 = rsp.maxSeq();
  await t.send('복도로 간다.');
  await waitUpd(c0);
  const a0 = await names();
  let msgs = await chatMsgs();
  const ia = msgs.findLastIndex((m) => m.role === 'char' && String(m.data).includes('권도현'));
  await t.editMessage(ia, String(msgs[ia].data).replaceAll('권도현', '권도윤'));
  await sleep(1500);
  const a1 = await names();
  msgs = await chatMsgs();
  rsp.plan.upd = () => U({});
  MAIN.set('시설팀 사무실로 간다', '시설팀 사무실은 비어 있었다.');
  c0 = rsp.maxSeq();
  await t.send('시설팀 사무실로 간다.');
  await waitUpd(c0);
  const ua = updCalls(c0)[0];
  const pa = await people(t);
  R.step('A 연필로 인물 이름 바꾸기', '(기대값 없음 — 코스 5장: 처리 코드 못 찾음) 고친 뒤 기록·다음 갱신 자료를 사실로', '코스 5장 「리스AI에서 메시지 직접 고치기」·공-02(되돌림 세부는 Claude 판정)', { afterTurn: a0, editedText: String(msgs[ia]?.data).slice(0, 60), afterEdit: a1, afterNextUpd: Object.keys(pa.people).sort(), 권도현quote: pa.people['권도현'] ? Object.values(pa.people['권도현'].slots).flat().map((e) => e.quote).filter(Boolean).slice(0, 2) : null, nextSpan: updData(ua?.body)?.span?.map((x) => `${x.m}${x.context_only ? 'c' : ''}:${String(x.text).slice(0, 24)}`), nextPeople: updData(ua?.body)?.people?.map((p) => p.name), routerCatalogHas권도현: (() => { const r = rsp.since(c0).find((c) => c.kind === 'router'); try { return JSON.parse(r.body.messages[1].content).catalog.map((x) => x.name).includes('권도현'); } catch { return null; } })() }, null);
  await t.shot('run11-A-edited');

  // ── B. 내 말만 지우기 ──
  msgs = await chatMsgs();
  const ib = msgs.findIndex((m) => m.role === 'user' && String(m.data).includes('복도로 간다'));
  const b0 = await names();
  await t.deleteMessage(ib);
  await sleep(1500);
  const b1 = await names();
  MAIN.set('창밖을 본다', '창밖에는 비가 내리기 시작했다.');
  c0 = rsp.maxSeq();
  await t.send('창밖을 본다.');
  await waitUpd(c0);
  R.step('B 내 말만 지우기', '인물 기록은 응답에 걸려 있으므로 그대로(권도현 남음)', '공-02·코드 Liveness(기준은 응답 메시지)', { deleted: ib, before: b0, afterDelete: b1, afterNextUpd: await names(), msgCountNow: (await chatMsgs()).length }, b0.join() === (await names()).join());

  // ── C. 둘 이상 연달아 지우기 ──
  MAIN.set('엘리베이터를 탄다', '엘리베이터 안에 여자가 있었다. "남궁별이에요. 홍보팀."');
  rsp.plan.upd = newPerson('남궁별', '남궁별이에요');
  c0 = rsp.maxSeq();
  await t.send('엘리베이터를 탄다.');
  await waitUpd(c0);
  rsp.plan.upd = () => U({});
  MAIN.set('3층에서 내린다', '3층 복도는 밝았다.');
  c0 = rsp.maxSeq();
  await t.send('3층에서 내린다.');
  await waitUpd(c0);
  const cBefore = await names();
  // 남궁별 응답과 그다음 내 말을 연달아 지움 (뒤 것부터)
  msgs = await chatMsgs();
  const ic = msgs.findIndex((m) => m.role === 'char' && String(m.data).includes('남궁별'));
  await t.deleteMessage(ic + 1);
  await t.deleteMessage(ic);
  await sleep(1500);
  const cAfterDel = await names();
  MAIN.set('회의실로 간다', '회의실은 잠겨 있었다.');
  c0 = rsp.maxSeq();
  await t.send('회의실로 간다.');
  await waitUpd(c0);
  const uc = updCalls(c0)[0];
  R.step('C 둘 이상 연달아 지우기 (남궁별 응답 + 다음 내 말)', '남궁별은 지운 응답에서만 나왔으므로 빠짐 (지운 직후 / 다음 갱신 뒤 사실로)', 'I-05·공-01(사용자 결정)·공-02 · 코스 5장(둘 이상은 알고 넘긴 한계)', { before: cBefore, deleted: [ic, ic + 1], afterDelete: cAfterDel, afterNextUpd: await names(), routerCatalogHas남궁별: (() => { const r = rsp.since(c0).find((c) => c.kind === 'router'); try { return JSON.parse(r.body.messages[1].content).catalog.map((x) => x.name).includes('남궁별'); } catch { return null; } })(), nextUpdPeople: updData(uc?.body)?.people?.map((p) => p.name) }, !(await names()).includes('남궁별'));

} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); await t.shot('run11-error').catch(() => {}); } finally { await rsp.stop(); await ctl('rules', { rules: (await import('./common.mjs')).BASE_RULES }); await t.close(); }
