// I 구간 run1: 관리국 3턴 상태에서 새 인물(이름·호칭)·이름 옮기기·다시 굴려 되돌림·사라진 응답의 인물·실패 갈래·Router 재질문 (PC 1280x800)
// 각 단계는 먼저 기대값과 결정표 줄을 적고 돌린 뒤 실제값을 적는다 (recorder.step).
import { open, responder, people, diag, STATES, updData, lastTag, tagOf, sleep, ctl, setVars, getVars, recorder, EMPTY_UPD, kst } from './common.mjs';

const R = recorder('run1');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(t.cfg.out.replace(/틀\/out$/, 'I/out') + '/calls-run1.jsonl');
const ST = (place, with_) => `[▣|2025.03.14|10:30 AM|☀️|12°C|${place}|없음|${with_}|없음|관리국/신입|140000]`;
const MAIN = new Map();
rsp.plan.main = (body) => {
  const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  for (const [k, v] of MAIN) if (String(last).includes(k)) return typeof v === 'function' ? v(body) : v;
  return '잠시 조용한 시간이 흘렀다.\n' + ST('서울 종로구 관리국 본부 로비', '없음');
};
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const names = async () => Object.keys((await people(t))?.people ?? {}).sort();
const routerCalls = (from) => rsp.since(from).filter((c) => c.kind === 'router');
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const mainReq = async (from) => (await ctl(`log?since=${from}&route=main`)).at(-1);
const peopleBlock = (rec) => (rec?.body?.messages ?? []).map((m) => String(m.content)).find((c) => c.includes('[People records]')) ?? '';
const fseq = async () => { const l = await ctl('log?full=0'); return l.length ? l.at(-1).seq : 0; };
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1500); return true; } await sleep(300); } return false; };

try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  R.step('0 시작', '기록 4명(고르고디오·잼트리·쟈알디·큐라스)', 'states/README', await names(), null);

  // ── 1. 지침 꼴 답: 이름 있는 새 인물(명부 밖) + 명부 인물(코드 등록) + 항목·호칭 ──
  MAIN.set('커피를 받아 든다', '잼트리가 손짓했다. "인사해, 이쪽은 스팡달. 그리고 저쪽은 외부 협력자 한도윤 씨."\n\n한도윤이 안경을 고쳐 쓰며 고개를 숙였다. "처음 뵙겠습니다. 한도윤입니다. 앞으로 자주 뵐 겁니다."\n\n스팡달은 커피를 단숨에 비우고 말했다. "신입, 말 편하게 해. 나도 그럴게."\n' + ST('서울 종로구 관리국 본부 로비', '잼트리,스팡달'));
  rsp.plan.upd = (body) => {
    const d = updData(body); const m = lastTag(d);
    return U({
      new_people: [{ name: '한도윤', aliases: [], m, quote: '처음 뵙겠습니다. 한도윤입니다.', identity: '외부 협력자', speech: '존댓말, 「처음 뵙겠습니다」' }],
      entries: [
        { who: '스팡달', slot: 'state', op: 'add', replace: null, text: '관리국 본부 로비에서 커피를 마심', target: null, m, quote: '스팡달은 커피를 단숨에 비우고' },
        { who: '한도윤', slot: 'state', op: 'add', replace: null, text: '관리국 본부 로비에서 신입에게 인사함', target: null, m, quote: '한도윤이 안경을 고쳐 쓰며' },
      ],
      address: [{ who: '스팡달', toUser: '신입', register: '반말', m, quote: '신입, 말 편하게 해. 나도 그럴게.' }],
      issues: [{ code: 'no_canonical_change', who: '잼트리', reason: '소개만 함' }],
    });
  };
  let s0 = await fseq(); let c0 = rsp.maxSeq();
  await t.send('잼트리에게서 커피를 받아 든다.');
  await waitUpd(c0);
  let p = await people(t);
  R.step('1-1 새 인물 등록', '한도윤 기록 생김(origin=이 응답), 스팡달 기록 생김(명부 이름이 글에 나옴), 한도윤 state 항목·스팡달 호칭 반말/신입', 'I-02(Claude 판정)·지침 갱신기 4절', { names: Object.keys(p.people).sort(), 한도윤origin: p.people['한도윤']?.origin, 한도윤state: p.people['한도윤']?.slots?.state?.map((e) => e.text), 스팡달addr: p.people['스팡달']?.address }, !!p.people['한도윤'] && !!p.people['스팡달']);
  R.step('1-2 진단', '갱신기 ok, 반영 수', 'I-12', (await diag(t)).filter((d) => d.reason === 'turn').at(-1), null);

  // ── 2. 이름 없는 인물(호칭) 등록 ──
  MAIN.set('경비실 쪽을 본다', '로비 입구 경비실에서 경비원 아저씨가 고개를 내밀었다. "신입이야? 출입증은 목에 걸고 다녀. 안 그러면 내가 못 들여보내."\n\n경비원 아저씨는 사람 좋게 웃었다.\n' + ST('서울 종로구 관리국 본부 로비', '잼트리'));
  rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '경비원 아저씨', aliases: [], m, quote: '경비원 아저씨가 고개를 내밀었다', identity: '관리국 본부 로비 경비원', speech: '반말', provisional: true }], entries: [{ who: '경비원 아저씨', slot: 'state', op: 'add', replace: null, text: '로비 입구 경비실에 있음', target: null, m, quote: '로비 입구 경비실에서' }] }); };
  c0 = rsp.maxSeq();
  await t.send('경비실 쪽을 본다.');
  await waitUpd(c0);
  p = await people(t);
  R.step('2 호칭 기록', '「경비원 아저씨」 기록 provisional=true', 'I-06(Claude 판정)', { has: !!p.people['경비원 아저씨'], provisional: p.people['경비원 아저씨']?.provisional, handles: updData(updCalls(c0)[0]?.body)?.handles }, p.people['경비원 아저씨']?.provisional === true);

  // ── 3. 이름 옮기기 ──
  MAIN.set('경비원에게 이름을 묻는다', '"내 이름? 마수철이야. 다들 수철이 아저씨라고 부르지."\n\n마수철은 출입 명부에 신입의 이름을 적어 넣었다.\n' + ST('서울 종로구 관리국 본부 로비', '마수철'));
  rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ renames: [{ from: '경비원 아저씨', to: '마수철', m, quote: '내 이름? 마수철이야.' }], entries: [{ who: '마수철', slot: 'knowledge', op: 'add', replace: null, text: '신입의 이름을 출입 명부에 적음', target: null, m, quote: '출입 명부에 신입의 이름을 적어 넣었다' }] }); };
  c0 = rsp.maxSeq();
  await t.send('경비원에게 이름을 묻는다.');
  await waitUpd(c0);
  p = await people(t);
  const handlesSent = updData(updCalls(c0)[0]?.body)?.handles;
  R.step('3 이름 옮기기', '「경비원 아저씨」→「마수철」(provisional 빠짐, 항목 옮김, renames 되돌림 기록 1)', 'I-08(Claude 판정)', { names: Object.keys(p.people).sort(), 마수철: { prov: p.people['마수철']?.provisional, state: p.people['마수철']?.slots?.state?.map((e) => e.text), knowledge: p.people['마수철']?.slots?.knowledge?.map((e) => e.text), aliases: p.people['마수철']?.aliases }, renames: (p.renames ?? []).map((r) => `${r.from}->${r.to}`), handlesSent }, !!p.people['마수철'] && !p.people['경비원 아저씨']);

  // ── 4. 다시 굴리기: 이름 옮기기 되돌림 (0.21.34) ──
  // 다시 굴린 답에는 이름이 없다. Router 명단·본편 [People records]·창 목록을 갱신기 전/후로 본다
  MAIN.set('경비원에게 이름을 묻는다', '경비원 아저씨는 대답 대신 손을 저었다. "이름은 됐고, 출입증이나 잘 챙겨."\n' + ST('서울 종로구 관리국 본부 로비', '없음'));
  rsp.pause('upd');
  s0 = await fseq(); c0 = rsp.maxSeq();
  await t.reroll({ wait: false });
  for (let i = 0; i < 60 && !(await ctl(`log?since=${s0}&route=main&full=0`)).length; i++) await sleep(500);
  await sleep(1500);
  p = await people(t);
  const rc = routerCalls(c0).at(-1);
  const rcat = rc ? JSON.parse(rc.body.messages[1].content).catalog.map((x) => x.name) : null;
  const mreq = await mainReq(s0);
  R.step('4-1 다시 굴린 요청 (갱신기 전)', 'Router 명단·본편 기록 블록에 사라진 응답이 만든 이름 「마수철」이 없어야 함(다시 굴린 응답의 변경은 버림)', 'I-08·I-05·공-01(사용자 결정)', { routerCalled: !!rc, routerCatalog: rcat, peopleBlockHas마수철: peopleBlock(mreq).includes('마수철'), peopleBlockHas경비원: peopleBlock(mreq).includes('경비원 아저씨'), store: Object.keys(p.people).sort() }, rcat ? !rcat.includes('마수철') : null);
  rsp.plan.upd = () => U({});
  rsp.resume('upd');
  await waitUpd(c0);
  await t.waitIdle(60000).catch(() => {});
  p = await people(t);
  R.step('4-2 갱신기 뒤', '「마수철」 → 「경비원 아저씨」로 되돌아감, 마수철 knowledge 항목 없어짐, renames 비움', 'I-08(Claude 판정, 0.21.34)', { names: Object.keys(p.people).sort(), 경비원: { prov: p.people['경비원 아저씨']?.provisional, knowledge: p.people['경비원 아저씨']?.slots?.knowledge?.map((e) => e.text) }, renames: p.renames ?? null }, !!p.people['경비원 아저씨'] && !p.people['마수철']);

  // ── 5. ◀ 로 옛 답(이름 밝힌 답)으로 돌아가기 ──
  s0 = await fseq(); c0 = rsp.maxSeq();
  await t.swipePrev();
  await sleep(2500);
  p = await people(t);
  const st5 = await t.chatState();
  R.step('5 ◀ 옛 답으로', '리스AI 는 모델 없이 글만 바꿈. 플러그인 상태: 화면 답(마수철 이름)과 기록(경비원 아저씨)이 갈릴 수 있음 — 사실로 적음', '코스 5장 ◀▶', { lastMsg: st5.message.at(-1)?.data.slice(0, 60), lastChatId: st5.message.at(-1)?.chatId, names: Object.keys(p.people).sort(), auxCalls: rsp.since(c0).map((c) => c.kind) }, null);
  // ▶ 로 다시 새 답 쪽으로
  await t.swipeNext({ wait: false }).catch(() => {});
  await sleep(2500);

  // ── 6. 사라진 응답이 만든 인물 (I-05) + 갱신기 실패 뒤 ──
  MAIN.set('엘리베이터를 기다린다', '엘리베이터 문이 열리자 붉은 머리의 여자가 내렸다. "아, 네가 새로 온 애구나. 오세린이야, 격리팀."\n\n오세린은 짧게 손을 흔들고 복도로 사라졌다.\n' + ST('서울 종로구 관리국 본부 엘리베이터 앞', '없음'));
  rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '오세린', aliases: [], m, quote: '오세린이야, 격리팀.', identity: '격리팀', speech: '반말' }] }); };
  c0 = rsp.maxSeq();
  await t.send('엘리베이터를 기다린다.');
  await waitUpd(c0);
  p = await people(t);
  R.step('6-1 오세린 등록', '오세린 기록(origin=이 응답)', 'I-02', { has: !!p.people['오세린'], origin: p.people['오세린']?.origin }, !!p.people['오세린']);
  // 다시 굴린 답에는 오세린 없음. 갱신기가 3번 다 실패(500)하면?
  MAIN.set('엘리베이터를 기다린다', '엘리베이터는 한참 동안 내려오지 않았다.\n' + ST('서울 종로구 관리국 본부 엘리베이터 앞', '없음'));
  await ctl('rules/add', { rule: { id: 'upd500', route: 'aux', match: 'system: # People Record Updater', status: 500 } });
  s0 = await fseq(); c0 = rsp.maxSeq();
  await t.reroll();
  await sleep(8000);
  const fl = (await ctl(`log?since=${s0}&full=0`)).filter((x) => x.ruleId === 'upd500');
  p = await people(t);
  const r6 = routerCalls(c0).at(-1);
  R.step('6-2 다시 굴림 + 갱신기 500', '자동 재전송 2회(같은 요청 3번). 실패라 저장 없음 → 오세린이 기록에 남는지 사실로', 'C-07(Claude 판정)·I-05(사용자 결정)', { upd500: fl.length, names: Object.keys(p.people).sort(), routerCatalogHas오세린: r6 ? JSON.parse(r6.body.messages[1].content).catalog.some((x) => x.name === '오세린') : null, diag: (await diag(t)).filter((d) => d.reason === 'turn').at(-1) }, null);
  await ctl('rules/del', { id: 'upd500' });
  // 다음 턴: 오세린이 Router 명단에 들어가는지, 갱신기가 성공하면 빠지는지
  MAIN.set('계단으로 내려간다', '계단은 어둡고 조용했다.\n' + ST('서울 종로구 관리국 본부 계단', '없음'));
  rsp.plan.upd = () => U({});
  s0 = await fseq(); c0 = rsp.maxSeq();
  await t.send('계단으로 내려간다.');
  await waitUpd(c0);
  const r6b = routerCalls(c0).at(-1);
  const u6b = updCalls(c0).at(-1);
  p = await people(t);
  R.step('6-3 다음 턴', '이 턴 Router 명단에 오세린? 갱신기는 앞 실패 응답까지 읽음(span), 성공 뒤 오세린 기록 빠짐', 'I-05(사용자 결정)·공-01', { routerCatalogHas오세린: r6b ? JSON.parse(r6b.body.messages[1].content).catalog.some((x) => x.name === '오세린') : null, updPeople: updData(u6b?.body)?.people?.map((x) => x.name), updSpanTags: updData(u6b?.body)?.span?.map((x) => x.m + (x.context_only ? 'c' : '')), names: Object.keys(p.people).sort() }, !p.people['오세린']);

  // ── 7. 갱신기 빈 답·꼴 틀린 답 ──
  MAIN.set('복도를 걷는다', '복도 끝에서 큐라스가 서류 뭉치를 들고 걸어왔다. "신입, 이거 좀 들어 줄래?"\n' + ST('서울 종로구 관리국 본부 복도', '큐라스'));
  await ctl('rules/add', { rule: { id: 'updEmpty', route: 'aux', match: 'system: # People Record Updater', empty: true } });
  s0 = await fseq();
  await t.send('복도를 걷는다.');
  await sleep(8000);
  const e7 = (await ctl(`log?since=${s0}&full=0`)).filter((x) => x.ruleId === 'updEmpty');
  R.step('7-1 빈 답', '같은 요청 2회 더(총 3), 실패 진단(model/parse), 읽음 표시 안 함', 'C-07(Claude 판정)', { n: e7.length, diag: (await diag(t)).filter((d) => d.reason === 'turn').at(-1) }, e7.length === 3);
  await ctl('rules/del', { id: 'updEmpty' });
  rsp.plan.upd = () => '이건 JSON 이 아닙니다. 인물 변화 없음.';
  c0 = rsp.maxSeq();
  MAIN.set('서류를 받아 든다', '큐라스가 고맙다는 듯 고개를 끄덕였다.\n' + ST('서울 종로구 관리국 본부 복도', '큐라스'));
  await t.send('서류를 받아 든다.');
  await sleep(8000);
  R.step('7-2 꼴 틀린 답', '형식 오류 다시 묻기(생성 공통 재시도), 실패 진단 stage parse', 'C-07·I-12', { updCalls: updCalls(c0).length, diag: (await diag(t)).filter((d) => d.reason === 'turn').at(-1) }, null);
  rsp.plan.upd = (body) => { const d = updData(body); return U({ entries: [], issues: [{ code: 'no_canonical_change', who: '큐라스', reason: `span ${d.span.filter((x) => !x.context_only).length}` }] }); };
  c0 = rsp.maxSeq();
  MAIN.set('사무실로 간다', '사무실 문을 열자 쟈알디가 고개를 들었다.\n' + ST('서울 종로구 관리국 본부 사무실', '쟈알디'));
  await t.send('사무실로 간다.');
  await waitUpd(c0);
  const u7 = updCalls(c0).at(-1);
  R.step('7-3 다음 턴이 밀린 응답 읽기', '앞 두 턴 실패한 응답(큐라스 등장 두 개)도 이번 span 확정 구간에 들어감', '코드 runOnce splitUnread(Claude 판정)', { confirmed: updData(u7?.body)?.span?.filter((x) => !x.context_only).map((x) => x.m + ':' + String(x.text).slice(0, 14)) }, null);

  // ── 8. Router 재질문 (0.21.34): 덧붙일 지침 바꾸고 다시 굴리기 ──
  MAIN.set('쟈알디에게 보고한다', '쟈알디가 서류를 훑었다. "수고했다. 오늘은 여기까지."\n' + ST('서울 종로구 관리국 본부 사무실', '쟈알디'));
  c0 = rsp.maxSeq();
  await t.send('쟈알디에게 보고한다.');
  await waitUpd(c0);
  const rA = routerCalls(c0).length;
  c0 = rsp.maxSeq();
  await t.reroll();
  await waitUpd(c0);
  const rB = routerCalls(c0).length;
  await setVars(t, { '$pp_router_rules': '쟈알디는 늘 고른다.' });
  c0 = rsp.maxSeq();
  await t.reroll();
  await waitUpd(c0);
  const rC = routerCalls(c0);
  R.step('8 Router 재질문', '보통 턴 Router 1회 / 그대로 다시 굴리면 재사용(0회일 수 있음) / 덧붙일 지침을 바꾼 뒤 다시 굴리면 다시 물음(1회, 지침에 새 글)', 'C-10(Claude 판정, 0.21.34)·C-01', { normal: rA, rerollSame: rB, rerollAfterRules: rC.length, newRuleInSystem: rC.at(-1) ? String(rC.at(-1).body.messages[0].content).includes('쟈알디는 늘 고른다') : null }, rC.length >= 1);
  await setVars(t, { '$pp_router_rules': '' });

  // ── 9. Router 시간 제한 ──
  await setVars(t, { '$pp_router_timeout': '5' });
  rsp.pause('router');
  MAIN.set('창밖을 본다', '창밖으로 해가 지고 있었다.\n' + ST('서울 종로구 관리국 본부 사무실', '쟈알디'));
  c0 = rsp.maxSeq();
  await t.send('창밖을 본다.', { wait: false });
  await sleep(4000);
  const prog1 = await t.progText();
  await sleep(4000);
  const prog2 = await t.progText();
  await t.shot('../../I/out/run1-9-router-timeout');
  await t.waitIdle(60000).catch(() => {});
  await sleep(1500);
  const prog3 = await t.progText();
  rsp.resume('router');
  await sleep(1000);
  R.step('9 Router 시간 제한(5초)', '5초 뒤 Router 실패로 보이고 코드 Router 로 본편 진행', 'C-10(Claude 판정, 0.21.34)', { prog1, prog2, prog3, diag: (await diag(t)).filter((d) => d.reason === 'router').at(-1) }, null);
  await setVars(t, { '$pp_router_timeout': '60' });
  // 늦게 온 Router 답은 버려졌나 (붙잡은 것 정리)
  await ctl('release', {});

  R.step('끝', '', '', { names: await names(), errors: t.errors.filter((e) => !/displayData/.test(e)).slice(-15) }, null);
} catch (e) {
  R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1500), false);
} finally {
  await rsp.stop();
  await t.close();
}
