// I 구간 run11: 처음에 I 에 걸지 않았던 공통 갈래를 인물 기록 쪽에서 본다. PC 1280x800
//  A 메시지 직접 고치기(연필로 인물 이름 바꾸기)  B 내 말만 지우기  C 둘 이상 연달아 지우기
//  D 본편 요청 실패(503 한 번)·리스AI 자동 재시도  E 생각 블록 안에만 나온 이름(스트리밍 끔/켬, <Thoughts>·<think>)
//  F 기능 끔  G 갱신 모델 메인/보조 전환  H 다른 봇 채팅
import { open, responder, people, diag, STATES, OUT, updData, tagOf, lastTag, sleep, ctl, setVars, recorder, EMPTY_UPD } from './common.mjs';
const R = recorder('run11');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run11.jsonl');
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
  await t.shot('../../I/out/run11-A-edited');

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

  // ── D. 본편 요청 실패(503 처음 1번)·리스AI 자동 재시도 ──
  await ctl('rules/add', { rule: { id: 'main503', route: 'main', matchLast: '로비 안내판을 본다', status: 503, failFirst: 1, reply: '안내판 앞에서 남자가 돌아봤다. "서하준입니다. 안내 데스크예요."\n' + ST } });
  rsp.plan.upd = newPerson('서하준', '서하준입니다');
  const sf = await fakeSeq();
  c0 = rsp.maxSeq();
  await t.send('로비 안내판을 본다.');
  await waitUpd(c0, 1, 25000);
  const recs = await fakeSince(sf);
  const mains = recs.filter((x) => x.route === 'main');
  R.step('D 본편 503 → 자동 재시도', '리스AI 가 같은 요청을 다시 보냄. 인물 블록은 두 요청 다 한 번씩, 갱신기는 한 번, 서하준 한 번 등록', '코스 5장 「본편 요청 실패·자동 재시도」', { mains: mains.map((x) => ({ seq: x.seq, status: x.response?.status, dupOf: x.dupOf, peopleBlocks: (x.body?.messages ?? []).filter((m) => String(m.content).includes('[People records]')).length })), updCalls: updCalls(c0).length, routerCalls: recs.filter((x) => x.ruleId === 'router').length, has서하준: (await names()).includes('서하준') }, mains.length >= 2 && updCalls(c0).length === 1 && (await names()).includes('서하준'));
  await ctl('rules/del', { id: 'main503' });

  // ── E. 생각 블록 안에만 나온 이름 (스트리밍 끔 → 켬) ──
  for (const [stream, tag] of [[false, 'Thoughts'], [true, 'think']]) {
    await t.setStreaming(stream);
    const key = stream ? '자판기 앞에 선다' : '정수기 앞에 선다';
    MAIN.set(key, `<${tag}>스팡달을 등장시킬까? 아니, 이번엔 혼자 두자. 고르고디오 이야기도 보류.</${tag}>\n${stream ? '자판기' : '정수기'} 앞은 한산했다.`);
    rsp.plan.upd = () => U({});
    const before = await names();
    c0 = rsp.maxSeq();
    await t.send(key + '.');
    await waitUpd(c0);
    const ue = updCalls(c0)[0];
    const dE = updData(ue?.body);
    const last = (await chatMsgs()).at(-1);
    R.step(`E 생각 블록(${tag}) 안에만 나온 이름 · 스트리밍 ${stream ? '켬' : '끔'}`, '코드 판정이 생각 글의 명부 이름(스팡달)을 새로 기록하지 않음, 갱신기 span 에 생각 글이 없음', '코스 C-5(생각 블록)·store.ts sentText(생각 걷기)', { before, after: await names(), spanHasThought: JSON.stringify(dE?.span ?? []).includes('스팡달'), spanLast: dE?.span?.at(-1)?.text?.slice(0, 40), sceneSent: dE?.people?.map((p) => p.name), savedHasTag: String(last?.data).includes(`<${tag}>`) }, !(await names()).includes('스팡달') && !JSON.stringify(dE?.span ?? []).includes('스팡달'));
  }
  await t.setStreaming(false);

  // ── F. 기능 끔 ──
  await setVars(t, { '$pp_on': '0' });
  MAIN.set('안내 데스크로 간다', '안내 데스크에 여자가 앉아 있었다. "변지아예요."');
  rsp.plan.upd = newPerson('변지아', '변지아예요');
  let sF = await fakeSeq();
  c0 = rsp.maxSeq();
  await t.send('안내 데스크로 간다.');
  await sleep(4000);
  let recsF = await fakeSince(sF);
  const mainF = recsF.filter((x) => x.route === 'main').at(-1);
  R.step('F 인물 기록 끔', '갱신기·Router 안 부름, 본편에 [People records] 없음, 기록 그대로', '설정 「사용」 도움말(끄면 응답을 읽지 않고 메인 요청에도 넣지 않음)', { updCalls: updCalls(c0).length, aux: recsF.filter((x) => x.route === 'aux').map((x) => x.ruleId), mainHasBlock: !!peopleBlock(mainF?.body), has변지아: (await names()).includes('변지아') }, updCalls(c0).length === 0 && !peopleBlock(mainF?.body));
  await t.openWindow('.gx'); await sleep(800);
  await t.feval(() => { const b = document.createElement('button'); b.dataset.action = 'rec-people'; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }); await sleep(1000);
  await t.shot('../../I/out/run11-F-off-window');
  await t.closeWindow();

  // ── G. 갱신 모델 메인 ↔ 보조 ──
  await setVars(t, { '$pp_on': '1', '$pp_model': 'main' });
  await ctl('rules/add', { rule: { id: 'upd', route: 'any', match: 'system: # People Record Updater', hold: true, replyFile: OUT + '/r-upd.txt' } });
  MAIN.set('데스크에 다시 말을 건다', '변지아가 고개를 들었다. "변지아라니까요."');
  rsp.plan.upd = newPerson('변지아', '변지아라니까요');
  sF = await fakeSeq();
  c0 = rsp.maxSeq();
  await t.send('데스크에 다시 말을 건다.');
  await waitUpd(c0);
  recsF = await fakeSince(sF);
  const g1 = recsF.filter((x) => x.ruleId === 'upd').map((x) => x.route);
  await setVars(t, { '$pp_model': 'aux' });
  MAIN.set('고맙다고 한다', '변지아가 웃었다.');
  rsp.plan.upd = () => U({});
  sF = await fakeSeq();
  c0 = rsp.maxSeq();
  await t.send('고맙다고 한다.');
  await waitUpd(c0);
  recsF = await fakeSince(sF);
  const g2 = recsF.filter((x) => x.ruleId === 'upd').map((x) => x.route);
  R.step('G 갱신 모델 메인 → 보조', '메인이면 갱신기 요청이 본편 모델 주소로, 보조면 보조 주소로. 끈 동안의 응답(변지아 첫 등장)도 다시 켜면 읽음', '설정 「모델」(메인 모델·보조 모델)', { mainRoute: g1, auxRoute: g2, has변지아: (await names()).includes('변지아') }, g1.includes('main') && g2.includes('aux'));

  // ── H. 다른 봇 채팅 ──
  const idx = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const i = ch.createNewCharacter(); st.DBState.db.characters[i].name = '보통 봇'; st.DBState.db.characters[i].firstMessage = '안녕하세요.'; return i; });
  await t.selectChar(idx);
  await sleep(2000);
  MAIN.set('인사한다', '스팡달과 한도윤이 손을 흔들었다. "저는 서지훈입니다."');
  rsp.plan.upd = newPerson('서지훈', '저는 서지훈입니다');
  sF = await fakeSeq();
  c0 = rsp.maxSeq();
  await t.send('인사한다.');
  await sleep(5000);
  recsF = await fakeSince(sF);
  const mainH = recsF.filter((x) => x.route === 'main').at(-1);
  const chatH = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); const ch = c.chats[c.chatPage]; return { name: c.name, hasPeople: !!ch.goeiPeopleV1, keys: Object.keys(ch).filter((k) => /goei/i.test(k)), vars: Object.keys(ch.scriptstate ?? {}).filter((k) => /pp_/.test(k)), n: ch.message.length }; });
  await t.shot('../../I/out/run11-H-otherbot');
  R.step('H 다른 봇 채팅', '보조 호출 없음, 본편에 [People records] 없음, 채팅에 인물 기록 없음', '코스 5장 「다른 봇 채팅: 아무것도 안 해야 함」', { aux: recsF.filter((x) => x.route === 'aux').map((x) => x.ruleId), mains: recsF.filter((x) => x.route === 'main').length, mainHasBlock: !!peopleBlock(mainH?.body), mainHasGoei: /괴이|ANOMALY|goei/i.test(JSON.stringify(mainH?.body ?? '')), chat: chatH }, recsF.filter((x) => x.route === 'aux').length === 0 && !peopleBlock(mainH?.body) && !chatH.hasPeople);
  R.step('끝', '', '', { errors: t.errors.filter((e) => !/displayData|\[goei\] (시작|세계|본체|소지품)/.test(e)).slice(-8) }, null);
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); await t.shot('../../I/out/run11-error').catch(() => {}); } finally { await rsp.stop(); await ctl('rules', { rules: (await import('./common.mjs')).BASE_RULES }); await t.close(); }
