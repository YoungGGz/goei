// I 구간 run3: 공통 갈래 — 답 오는 중(기다림)·병렬·다른 채팅(건너뜀·번호 밀림)·새로고침·이어 쓰기·가운데 응답 지우기·수동/매 턴·2턴·언어 영어 (PC 1280x800)
import { open, responder, people, diag, STATES, updData, lastTag, tagOf, sleep, ctl, setVars, recorder, EMPTY_UPD } from './common.mjs';

const R = recorder('run3');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(t.cfg.out.replace(/틀\/out$/, 'I/out') + '/calls-run3.jsonl');
const MAIN = new Map();
const ST = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';
rsp.plan.main = (body) => {
  const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  for (const [k, v] of MAIN) if (String(last).includes(k)) return v + '\n' + ST;
  return '잠시 조용한 시간이 흘렀다.\n' + ST;
};
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const names = async () => Object.keys((await people(t))?.people ?? {}).sort();
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const waitPending = async (rule, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { const p = (await ctl('pending')).find((x) => x.ruleId === rule && x.held); if (p) return p; await sleep(300); } return null; };
const newPerson = (nm, quote) => (body) => { const d = updData(body); const m = tagOf(d, quote) ?? lastTag(d); return U({ new_people: [{ name: nm, aliases: [], m, quote, identity: '미확인', speech: null }] }); };
const lastDiag = async () => (await diag(t)).filter((d) => d.reason === 'turn' || d.reason === 'manual').at(-1);
const chatsInfo = () => t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return { page: c.chatPage, chats: c.chats.map((x) => ({ name: x.name, n: x.message.length, people: Object.keys(x.goeiPeopleV1?.people ?? {}) })) }; });

try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');

  // ── 1. 답 오는 중: 갱신기를 붙잡고 리스AI·창 상태 ──
  MAIN.set('인사를 건넨다', '로비 저편에서 윤서가 다가왔다. "안녕, 나는 윤서라고 해. 홍보팀이야."');
  rsp.plan.upd = newPerson('윤서', '나는 윤서라고 해');
  rsp.pause('upd');
  let c0 = rsp.maxSeq();
  await t.send('인사를 건넨다.', { wait: false });
  await waitPending('upd');
  await sleep(1000);
  const busy1 = await t.isBusy();
  await t.openWindow('.gx').catch(() => {});
  await sleep(1200);
  await t.shot('../../I/out/run3-1-waiting-pc');
  const prog = await t.progText();
  await t.closeWindow();
  rsp.resume('upd');
  await waitUpd(c0); await t.waitIdle(60000).catch(() => {});
  R.step('1 갱신기 답 오는 중 (병렬 끔 기본)', '갱신기가 끝날 때까지 리스AI 가 만드는 중(.loadmove)으로 남음 — 병렬 끔의 뜻, 진행 창에 갱신 단계', '코스 I-4 「병렬」·코드 body.ts parallel', { busyWhileUpdater: busy1, prog, names: await names() }, null);

  // ── 2. 병렬 켬: 갱신기 붙잡은 채 다음 본편을 보내고, 본편 답 오는 중에 갱신기 답이 오면 쓰기를 미룸 ──
  await setVars(t, { '$pp_parallel': '1' });
  MAIN.set('홍보팀 이야기를 듣는다', '윤서 옆에 서 있던 남자가 끼어들었다. "저는 강태오예요. 윤서랑 같은 팀."');
  rsp.plan.upd = newPerson('강태오', '저는 강태오예요');
  rsp.pause('upd');
  c0 = rsp.maxSeq();
  await t.send('홍보팀 이야기를 듣는다.', { wait: false });
  await waitPending('upd');
  await sleep(1500);
  const idleWithPending = await t.isIdle();
  // 다음 본편: 본편을 붙잡는다
  MAIN.set('강태오에게 묻는다', '강태오는 어깨를 으쓱했다. "별일 없어요."');
  rsp.pause('main');
  if (idleWithPending) await t.send('강태오에게 묻는다.', { wait: false });
  await waitPending('main', 15000);
  rsp.resume('upd'); // 갱신기 답은 본편 대기 중에 온다 → 쓰기는 본편이 끝날 때까지 미뤄짐 (waitNotBusy)
  await sleep(3000);
  const midNames = await names();
  rsp.resume('main');
  await t.waitIdle(60000).catch(() => {});
  await waitUpd(c0, 2);
  await sleep(2000);
  R.step('2 병렬 켬 + 본편 답 오는 중에 갱신기 답', '갱신기 붙잡은 동안 리스AI 쉼(보내기 가능). 본편 대기 중에는 기록에 안 씀(강태오 없음) → 본편 끝난 뒤 씀. 다음 턴 갱신기도 차례로', '코드 host/people.ts waitNotBusy (Claude 판정)·코스 I-4', { idleWithPending, namesWhileMainPending: midNames, after: await names(), updN: updCalls(c0).length }, idleWithPending && !midNames.includes('강태오') && (await names()).includes('강태오'));

  // ── 3. 다른 채팅으로 옮긴 사이 갱신기 답 (번호 그대로) ──
  MAIN.set('엘리베이터를 탄다', '엘리베이터에 먼저 타 있던 노인이 말했다. "몇 층 가나? 나는 문덕배일세."');
  rsp.plan.upd = newPerson('문덕배', '나는 문덕배일세');
  rsp.pause('upd');
  c0 = rsp.maxSeq();
  await t.send('엘리베이터를 탄다.', { wait: false });
  await waitPending('upd');
  await t.waitIdle(30000).catch(() => {});
  await t.switchChat(1);
  await sleep(1000);
  rsp.resume('upd');
  await waitUpd(c0); await sleep(2000);
  const ci3 = await chatsInfo();
  await t.switchChat(0); await sleep(1000);
  R.step('3 갱신기 답이 다른 채팅을 보는 동안 옴 (번호 안 밀림)', '원래 채팅(0번)에 문덕배 기록, 지금 채팅(1번)에는 안 씀', '코드 runOnce(Claude 판정)·코스 5장', ci3, ci3.chats[0].people.includes('문덕배') && !ci3.chats[1].people.includes('문덕배'));

  // ── 4. 갱신기 답 오는 중 새 채팅(번호 +1 밀림) ──
  MAIN.set('층 버튼을 누른다', '문이 닫히기 직전, 여자가 뛰어들었다. "잠깐만요! 저 지하 3층이요. 아, 저는 유하람이에요."');
  rsp.plan.upd = newPerson('유하람', '저는 유하람이에요');
  rsp.pause('upd');
  c0 = rsp.maxSeq();
  await t.send('층 버튼을 누른다.', { wait: false });
  await waitPending('upd');
  await t.waitIdle(30000).catch(() => {});
  await t.newChat();
  await sleep(1000);
  rsp.resume('upd');
  await waitUpd(c0); await sleep(2500);
  const ci4 = await chatsInfo();
  const d4 = await lastDiag();
  R.step('4 갱신기 답 오는 중 새 채팅(기존 번호 +1)', '새 채팅·밀린 번호의 다른 채팅에 쓰지 않음. 이번 결과는 버리고(저장 직전 채팅 달라짐) 그 응답은 안 읽은 채 남음', '코드 runOnce chatId 대조(Claude 판정)·코스 5장 번호 밀기', { chats: ci4.chats.map((c) => `${c.name}:${c.people.length}:${c.people.includes('유하람')}`), diag: d4 }, !ci4.chats[0].people.includes('유하람') && !ci4.chats[1].people.includes('유하람'));
  // 원래 채팅(이제 1번)으로 돌아가 다음 턴
  await t.switchChat(1); await sleep(1200);
  MAIN.set('지하 3층에서 내린다', '지하 3층 복도는 서늘했다. 유하람은 먼저 걸어갔다.');
  rsp.plan.upd = newPerson('유하람', '저는 유하람이에요');
  c0 = rsp.maxSeq();
  await t.send('지하 3층에서 내린다.');
  await waitUpd(c0);
  const u4 = updData(updCalls(c0)[0]?.body);
  R.step('4-2 돌아와 다음 턴', '앞에서 못 쓴 응답이 이번 확정 구간에 같이 들어가 유하람 기록이 생김', '코드 splitUnread(Claude 판정)', { confirmed: u4?.span?.filter((x) => !x.context_only).map((x) => x.m + ':' + String(x.text).slice(0, 16)), names: await names() }, (await names()).includes('유하람'));

  // ── 5. 본편 답 오는 중 다른 채팅으로 (응답이 붙는 채팅 ≠ 열린 채팅) ──
  await setVars(t, { '$pp_parallel': '0' });
  MAIN.set('복도 끝 문을 연다', '문 너머에는 실험복 차림의 남자가 있었다. "누구시죠? 저는 진무혁입니다."');
  rsp.plan.upd = newPerson('진무혁', '저는 진무혁입니다');
  rsp.pause('main');
  c0 = rsp.maxSeq();
  await t.send('복도 끝 문을 연다.', { wait: false });
  await waitPending('main');
  await t.switchChat(0); await sleep(800);
  rsp.resume('main');
  await sleep(6000);
  await t.waitIdle(30000).catch(() => {});
  const ci5 = await chatsInfo();
  R.step('5 본편 답 오는 중 다른 채팅으로 옮김', '리스AI 가 답을 원래 채팅에 붙이는지(리스AI 동작) / 플러그인 갱신기는 열린 채팅이 달라 건너뜀(호출 0), 원래 채팅 다음 턴에 읽음', '코드 runOnce at 대조(Claude 판정)·코스 5장', { chats: ci5.chats.map((c) => `${c.name}:n${c.n}:${c.people.join('/')}`), updCalls: updCalls(c0).length, diag: await lastDiag() }, null);
  await t.switchChat(1); await sleep(1200);
  MAIN.set('진무혁에게 인사한다', '진무혁이 안경을 밀어 올렸다. "반갑습니다."');
  c0 = rsp.maxSeq();
  await t.send('진무혁에게 인사한다.');
  await waitUpd(c0);
  R.step('5-2 원래 채팅 다음 턴', '진무혁 기록 생김(밀린 응답까지 읽음)', '코드 splitUnread', { names: await names(), confirmed: updData(updCalls(c0)[0]?.body)?.span?.filter((x) => !x.context_only).map((x) => x.m) }, (await names()).includes('진무혁'));

  // ── 6. 갱신기 답 오는 중 새로고침 ──
  MAIN.set('실험실을 둘러본다', '실험실 구석에서 고양이 한 마리가 울었다. 조교 백도하가 고양이를 안아 올렸다. "얘는 실험체 아니에요."');
  rsp.plan.upd = newPerson('백도하', '조교 백도하가 고양이를');
  rsp.pause('upd');
  c0 = rsp.maxSeq();
  await t.send('실험실을 둘러본다.', { wait: false });
  await waitPending('upd');
  await t.reload({ settle: false });
  rsp.resume('upd');
  await sleep(4000);
  const n6 = await names();
  await ctl('release', {});
  MAIN.set('고양이를 쓰다듬는다', '고양이가 골골거렸다. 백도하가 웃었다.');
  c0 = rsp.maxSeq();
  await t.send('고양이를 쓰다듬는다.');
  await waitUpd(c0);
  R.step('6 갱신기 답 오는 중 새로고침', '진행 중 작업은 사라짐(백도하 없음) → 다음 턴에 밀린 응답까지 읽어 백도하 생김', '코스 5장 새로고침(진행 중 작업은 메모리)', { afterReload: n6, nextTurn: await names(), confirmed: updData(updCalls(c0).at(-1)?.body)?.span?.filter((x) => !x.context_only).map((x) => x.m) }, !n6.includes('백도하') && (await names()).includes('백도하'));

  // ── 7. 이어 쓰기 ──
  MAIN.set('[Continue', '');
  rsp.plan.main = (body) => {
    const all = body.messages.map((m) => String(m.content)).join('\n');
    if (all.includes('[Continue the last response]')) return ' 그때 문이 열리고 경비대장 차민준이 들어왔다. "여기 계셨군요."';
    const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    for (const [k, v] of MAIN) if (String(last).includes(k)) return v + '\n' + ST;
    return '잠시 조용한 시간이 흘렀다.\n' + ST;
  };
  rsp.plan.upd = newPerson('차민준', '경비대장 차민준이 들어왔다');
  c0 = rsp.maxSeq();
  await t.continueReply();
  await waitUpd(c0, 1, 20000);
  const st7 = await t.chatState(true);
  R.step('7 이어 쓰기 (스트리밍 끔)', '이어 쓴 글을 갱신기가 읽어 차민준 기록 (리스AI: user *says nothing* 자리를 char 로 바꿈)', '코스 5장 이어 쓰기·T2_사용법 리스AI 동작 1', { updCalls: updCalls(c0).length, last: st7.message.slice(-2).map((m) => `${m.role}:${String(m.data).slice(0, 50)}`), names: await names() }, null);

  // ── 8. 가운데 응답 지우기: 사람을 처음 만든 응답(윤서)을 지움 ──
  const st8 = await t.chatState(true);
  const idx = st8.message.findIndex((m) => m.role === 'char' && String(m.data).includes('나는 윤서라고 해'));
  await t.deleteMessage(idx);
  await sleep(1500);
  const afterDel = await names();
  MAIN.set('복도로 나간다', '복도는 텅 비어 있었다.');
  rsp.plan.upd = () => U({});
  c0 = rsp.maxSeq();
  await t.send('복도로 나간다.');
  await waitUpd(c0);
  const st8b = await t.chatState(true);
  R.step('8 가운데 응답(윤서 첫 등장) 지우기 → 다음 갱신', '윤서는 다른 살아 있는 응답(강태오 대사 「윤서랑 같은 팀」)에도 나오므로 남는 것이 규칙대로. 지운 직후·다음 갱신 뒤 사실로', 'I-05(사용자 결정)·코드 dropGonePeople(살아 있는 메시지에 나오면 남김)', { deletedIdx: idx, afterDelete: afterDel, afterNext: await names(), stillMentioned: st8b.message.some((m) => String(m.data).includes('윤서')) }, null);
  // 사람 하나만 나온 응답(문덕배)을 지움
  const idx2 = st8b.message.findIndex((m) => m.role === 'char' && String(m.data).includes('문덕배'));
  await t.deleteMessage(idx2);
  await sleep(1500);
  const afterDel2 = await names();
  MAIN.set('계단을 오른다', '계단은 길었다.');
  c0 = rsp.maxSeq();
  await t.send('계단을 오른다.');
  await waitUpd(c0);
  R.step('8-2 문덕배만 나온 응답 지우기', '지운 직후엔 기록이 남아 보임(갱신 때 정리) → 다음 갱신 뒤 문덕배 빠짐', 'I-05(사용자 결정)·공-02', { deletedIdx: idx2, afterDelete: afterDel2, afterNext: await names() }, !(await names()).includes('문덕배'));

  // ── 9. 수동 / 매 턴 ──
  await setVars(t, { '$pp_when': 'manual' });
  MAIN.set('옥상에 오른다', '옥상에는 정원사 하은별이 화분에 물을 주고 있었다. "어머, 손님이네. 하은별이에요."');
  rsp.plan.upd = newPerson('하은별', '하은별이에요');
  c0 = rsp.maxSeq();
  await t.send('옥상에 오른다.');
  await sleep(3000);
  const manualCalls = updCalls(c0).length;
  // 인물 기록 점검 → 지금 갱신
  await t.openWindow('.gx');
  await t.feval(() => { const b = document.createElement('button'); b.dataset.action = 'ed-open'; b.dataset.value = 'manage:people'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); });
  await sleep(1500);
  await t.shot('../../I/out/run3-9-manage-people-pc');
  const hasBtn = await t.feval(() => !!document.querySelector('[data-action="pp-update"]'));
  if (hasBtn) await t.fclick('[data-action="pp-update"]');
  await waitUpd(c0, 1, 20000);
  await sleep(1500);
  const info9 = await t.feval(() => document.querySelector('.gx')?.innerText?.match(/갱신 \d+회[^\n]*|읽을 응답[^\n]*|건너뜀[^\n]*/)?.[0] ?? null);
  await t.shot('../../I/out/run3-9-manage-people-after-pc');
  await t.closeWindow();
  R.step('9 자동 호출 수동', '응답 뒤 갱신기 호출 0 → 인물 기록 점검 「지금 갱신」으로 1회, 하은별 기록, 알림 「갱신 1회 · 반영 …」', 'C-11(사용자 결정, 이름)·코스 I-4', { afterReply: manualCalls, button: hasBtn, afterButton: updCalls(c0).length, info: info9, names: await names() }, manualCalls === 0 && (await names()).includes('하은별'));
  await setVars(t, { '$pp_when': 'turn' });

  // ── 10. 2턴 규칙 ──
  await setVars(t, { '$pp_twoturn': '1' });
  MAIN.set('정원을 본다', '정원 한쪽에서 소년이 뛰어왔다. "저 봄이에요! 은별 누나 동생!"');
  rsp.plan.upd = newPerson('봄이', '저 봄이에요!');
  c0 = rsp.maxSeq();
  await t.send('정원을 본다.');
  await waitUpd(c0);
  const p10 = await people(t);
  MAIN.set('봄이와 논다', '봄이가 공을 던졌다. "형, 받아요!"');
  rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '봄이', aliases: [], m, quote: '봄이가 공을 던졌다', identity: '미확인', speech: null }] }); };
  c0 = rsp.maxSeq();
  await t.send('봄이와 논다.');
  await waitUpd(c0);
  R.step('10 2턴 규칙', '첫 턴 등록 대기(pending), 다른 응답에서 다시 나오면 등록', '코드 updater register(Claude 판정)', { first: { pending: Object.keys(p10.pending ?? {}), has: !!p10.people['봄이'] }, second: await names() }, !p10.people['봄이'] && (await names()).includes('봄이'));
  await setVars(t, { '$pp_twoturn': '0' });

  // ── 11. 기록 언어 영어 ──
  await setVars(t, { '$pp_lang': 'en' });
  MAIN.set('내려간다', '계단 아래에서 봄이가 손을 흔들었다.');
  rsp.plan.upd = () => U({});
  c0 = rsp.maxSeq();
  await t.send('내려간다.');
  await waitUpd(c0);
  const sys11 = String(updCalls(c0)[0]?.body?.messages?.[0]?.content ?? '');
  R.step('11 기록 언어 영어', '갱신기 지침의 기록 언어 줄이 영어로 바뀜(이름·인용·호칭은 원문)', '코스 I-4·설정 lang', { koreanLine: /every record text you output is Korean/.test(sys11), englishHint: (sys11.match(/[^.\n]*record text[^.\n]*English[^.\n]*/i) ?? [null])[0] }, null);
  await setVars(t, { '$pp_lang': 'ko' });

  R.step('끝', '', '', { names: await names(), errors: t.errors.filter((e) => !/displayData/.test(e)).slice(-12) }, null);
} catch (e) {
  R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1500), false);
} finally {
  await rsp.stop();
  await t.close();
}
