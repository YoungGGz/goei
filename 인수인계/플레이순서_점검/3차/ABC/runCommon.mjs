// 공통 갈래 (A·B·C 몫, 실제 리스아이 단추): S-관리국-3턴에서 시작.
//  표지 답 = 중림 지하상가 사건을 새로 여는 답([IN|서울특별시 중구|중림 지하상가|진행|…]) → 상황판에 생기는지로 「그 답이 만든 변경」을 본다 (공-01·공-02).
// 사용: FAKE_URL=… node runCommon.mjs <del-last|del-mid|del-user|continue|edit|other-chat|shift|reload-now|other-bot>
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OUT, sleep, baseRules, turn, text, quietAux, buildReply, readRequest, REPLY_FILE } from './lib.mjs';

const which = process.argv[2] ?? 'del-last';
const tag = `CM-${which}`;
const t = await openT2({ via: 'plain' });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 400)); };
const ST = (n) => fileURLToPath(new URL(`../틀/states/${n}.json`, import.meta.url));
const world = async () => JSON.parse((await t.chatState(true)).scriptstate?.$goei_world ?? 'null');
const incOf = (w, name) => w?.inc?.find((e) => e.name === name)?.state ?? null;
const MARK = '[IN|서울특별시 중구|중림 지하상가|진행|없음|지하상가 통로에서 정체불명의 소동이 벌어졌다]';
const T1 = { user: '잼트리에게 지하상가 소식을 묻는다.', prose: '잼트리가 휴대폰 화면을 내밀었다.\n\n<img=Jaemtri_neutral>\n\n"중림 지하상가 쪽이 시끄러워."', status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } };
const T2 = { user: '고개를 끄덕이고 자리로 돌아간다.', prose: '로비는 다시 조용해졌다.', status: { place: '서울 종로구 관리국 본부 로비', companions: '없음', identity: '관리국/신입' } };
const markReply = (req) => buildReply(req, T1).replace(/\n\[▣/, `\n${MARK}\n[▣`);
const lastStatus = (st) => (String(st.message.at(-1)?.data ?? '').match(/\[▣\|[^\]\n]*\]/) ?? [])[0] ?? null;
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await t.fabReady();
  await t.loadState(ST('S-관리국-3턴'));
  await sleep(2000);
  const w0 = await world();
  step('시작', '중림 지하상가 사건 없음', incOf(w0, '중림 지하상가'), incOf(w0, '중림 지하상가') === null);
  const n0 = (await t.chatState()).message.length;
  // 표지 턴
  const r1 = await turn(t, T1, null, { replyFn: markReply });
  const w1 = await world();
  step('표지 답 뒤', '중림 지하상가 진행', incOf(w1, '중림 지하상가'), incOf(w1, '중림 지하상가') === '진행');
  if (which === 'del-last') {
    const st = await t.chatState(true);
    await t.deleteMessage(st.message.length - 1);
    await sleep(2500);
    const w2 = await world();
    const st2 = await t.chatState(true);
    step('마지막 응답 지움', '메시지 -1, 중림 지하상가 사건 사라짐(공-01)', { n: st2.message.length, inc: incOf(w2, '중림 지하상가') }, st2.message.length === st.message.length - 1 && incOf(w2, '중림 지하상가') === null);
    // 그 자리에서 새로 보내기(리스아이: 마지막이 user 면 입력칸 비운 채 보내기 = 다시 생성)
    const r2 = await turn(t, T2, () => t.page.click('.default-chat-screen .button-icon-send'));
    step('지운 뒤 다시 보낸 요청의 [Previous status]', '지운 답 전(S-관리국-3턴 마지막 줄 10:00 AM)', r2.req.prevLine, /10:00 AM/.test(r2.req.prevLine));
    step('지운 뒤 다시 보낸 요청의 상황판', '중림 지하상가 사건 없음', /중림 지하상가\|진행/.test(r2.req.lore), !/중림 지하상가\|진행/.test(r2.req.lore));
  }
  if (which === 'del-mid') {
    const r2 = await turn(t, T2);
    const st = await t.chatState(true);
    const mid = st.message.length - 3; // 표지 답
    step('가운데 지울 메시지', '표지 답', String(st.message[mid]?.data).slice(0, 30), /휴대폰/.test(String(st.message[mid]?.data)));
    await t.deleteMessage(mid);
    await sleep(2500);
    const w2 = await world();
    const st2 = await t.chatState(true);
    step('가운데 응답(표지 답) 지움', '중림 지하상가 사건 사라짐(0.21.34 가운데 응답 따로 다룸)', { n: st2.message.length, inc: incOf(w2, '중림 지하상가'), lastStatus: lastStatus(st2) }, incOf(w2, '중림 지하상가') === null);
    const r3 = await turn(t, { ...T2, user: '창밖을 본다.' });
    step('그 뒤 요청의 [Previous status]', '마지막 답(T2) 상태창 줄', r3.req.prevLine, /없음\|없음\|관리국\/신입/.test(r3.req.prevLine));
  }
  if (which === 'del-user') {
    const st = await t.chatState(true);
    const u = st.message.length - 2;
    await t.deleteMessage(u);
    await sleep(2500);
    const w2 = await world();
    const st2 = await t.chatState(true);
    step('내 말만 지움(표지 답 앞 user)', '(관찰) 표지 답이 남으니 사건도 남는지', { n: st2.message.length, roles: st2.message.slice(-3).map((m) => m.role), inc: incOf(w2, '중림 지하상가') }, null);
    const r2 = await turn(t, T2);
    step('그 뒤 요청', '(관찰) [Previous status]·상황판', { prev: r2.req.prevLine, inc: /중림 지하상가\|진행/.test(r2.req.lore) }, null);
  }
  if (which === 'continue') {
    // 이어 쓰기: 이어 쓴 글에 상태창 줄을 새로 줌 → 상태창 줄이 둘이 되는지, 다음 턴 [Previous status]
    const s0 = await t.fakeSeq();
    writeFileSync(REPLY_FILE, '잼트리는 말을 잇다 멈췄다.\n\n[▣|2025.03.14|10:40 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]');
    await t.fake('rules/add', { rule: { id: 'cont', route: 'main', match: 'Continue the last response', replyFile: REPLY_FILE } });
    await t.continueReply();
    await quietAux(t);
    const reqs = await t.fakeLog(s0, 'main');
    const st = await t.chatState(true);
    const all = st.message.slice(-2).map((m) => [m.role, String(m.data).slice(0, 60), (String(m.data).match(/\[▣\|/g) ?? []).length]);
    step('이어 쓰기 뒤 끝 두 메시지', '(관찰) 상태창 줄 수·자리', all, null);
    const req = reqs[0] ? readRequest(reqs[0].body) : null;
    step('이어 쓰기 요청', '(관찰) 이미지 지침 자리·[Previous status]', req ? { prev: req.prevLine, lastMsg: text(reqs[0].body.messages.at(-1)?.content).slice(0, 80) } : null, null);
    await t.fake('rules/del', { id: 'cont' });
    const r2 = await turn(t, T2);
    step('이어 쓰기 다음 턴 [Previous status]', '이어 쓴 글의 10:40 AM 줄', r2.req.prevLine, /10:40 AM/.test(r2.req.prevLine));
  }
  if (which === 'edit') {
    // 리스아이 연필로 마지막 답을 고쳐 표지 줄을 지움 → 상황판은?
    const st = await t.chatState(true);
    const i = st.message.length - 1;
    const edited = String(st.message[i].data).replace(/\n?\[IN\|[^\]]*\]/, '').replace('10:20 AM', '10:30 AM');
    await t.editMessage(i, edited);
    await sleep(2000);
    const w2 = await world();
    step('연필로 답을 고쳐 사건 줄·시각 바꿈', '(관찰) 상황판·상태창은 그대로인지', { inc: incOf(w2, '중림 지하상가'), saved: lastStatus(await t.chatState(true)) }, null);
    const r2 = await turn(t, T2);
    step('고친 뒤 다음 요청 [Previous status]', '(관찰) 고친 줄(10:30)인지', r2.req.prevLine, null);
  }
  if (which === 'other-chat') {
    const before = await t.chatState();
    await t.newChat();
    await sleep(1500);
    await t.switchChat(1);
    await sleep(2500);
    const r2 = await turn(t, T2);
    step('다른 채팅 다녀온 뒤 보냄', '상황판에 중림 지하상가 진행 줄·[Previous status] 표지 답 줄', { prev: r2.req.prevLine, inc: /중림 지하상가\|진행/.test(r2.req.lore), people: (r2.rec.body.messages ?? []).some((m) => text(m.content).startsWith('[People records]')) }, /중림 지하상가\|진행/.test(r2.req.lore));
    const st = await t.chatState();
    step('답이 붙은 채팅', '원래 채팅(번호 1)', { chatPage: st.chatPage, n: st.message.length, before: before.message.length }, st.chatPage === 1 && st.message.length === before.message.length + 2);
  }
  if (which === 'shift') {
    // 답 오는 중(붙잡음) 새 채팅을 만들어 번호를 밀고, 원래 채팅으로 돌아간 뒤 답을 푼다
    const st0 = await t.chatState();
    writeFileSync(REPLY_FILE, '(아직)');
    const s0 = await t.fakeSeq();
    await t.send(T2.user, { wait: false });
    let rec = null; for (let i = 0; i < 40 && !rec; i++) { await sleep(400); rec = (await t.fakeLog(s0, 'main')).find((x) => x.action === 'hold' && !x.response); }
    await t.newChat();
    await sleep(1200);
    writeFileSync(REPLY_FILE, buildReply(readRequest(rec.body), T2));
    await t.fake('release', { seq: rec.seq });
    await sleep(4000);
    await quietAux(t);
    const all = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return c.chats.map((ch, i) => ({ i, id: ch.id, name: ch.name, n: ch.message.length, last: String(ch.message.at(-1)?.data ?? '').slice(0, 30), world: !!ch.scriptstate?.$goei_world })); });
    step('답 오는 중 새 채팅(번호 +1) 뒤 답', '(관찰) 답이 원래 채팅(이제 1번)에 붙는지, 새 채팅(0번)에 붙는지', all.slice(0, 3), null);
    const w = JSON.parse((await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); return db.getCurrentCharacter().chats[1]?.scriptstate?.$goei_world ?? 'null'; })));
    step('원래 채팅 상황판', '(관찰) 응답 처리가 원래 채팅에 됐는지(시각 이어짐)', { minute: w?.minute, inc: incOf(w, '중림 지하상가') }, null);
    await t.switchChat(1); await sleep(2000);
    await t.shot(`${tag}-orig`);
  }
  if (which === 'reload-now') {
    writeFileSync(REPLY_FILE, '(아직)');
    const s0 = await t.fakeSeq();
    await t.send(T2.user, { wait: false });
    let rec = null; for (let i = 0; i < 40 && !rec; i++) { await sleep(400); rec = (await t.fakeLog(s0, 'main')).find((x) => x.action === 'hold' && !x.response); }
    await t.reload({ settle: false });
    await sleep(3000);
    writeFileSync(REPLY_FILE, buildReply(readRequest(rec.body), T2));
    await t.fake('release', { seq: rec.seq });
    await sleep(3000);
    const st = await t.chatState(true);
    step('답 오는 중 바로 새로고침', '(관찰) 내 말은 남고 답은 없음, 다음 보내기 됨', { n: st.message.length, roles: st.message.slice(-2).map((m) => m.role), prog: await t.progText() }, null);
    const r2 = await turn(t, T2, () => t.page.click('.default-chat-screen .button-icon-send'));
    const st2 = await t.chatState(true);
    step('새로고침 뒤 다시 보냄', '본편 1건·답 붙음', { n: st2.message.length, prev: r2.req.prevLine }, st2.message.at(-1)?.role === 'char');
  }
  if (which === 'other-bot') {
    // 다른 봇(카드 없이 새 캐릭터)에서: 요청에 로어·표식 없음, 답의 상태창·상황판 태그는 그대로 남음, 화면 그리기 안 바뀜
    const idx = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const before = st.DBState.db.characters.length; await ch.createNewCharacter?.('다른봇'); return { before, after: st.DBState.db.characters.length }; });
    step('다른 봇 만들기', '캐릭터 +1', idx, idx.after === idx.before + 1);
    await t.selectChar(idx.after - 1);
    await sleep(2500);
    const fab = await t.R(() => document.querySelector('[x-goei-fab]')?.style.display ?? null);
    step('다른 봇: 유령 단추', '안 보임(공-22)', fab, fab !== 'block');
    await t.fake('rules/add', { rule: { id: 'ob', route: 'main', match: '다른 봇 인사', reply: '안녕.\n\n[▣|2025.03.14|10:00 AM|☀️|12°C|어딘가|없음|없음|없음|무소속|0]\n[AN|서울특별시 노원구|명일 아파트|활성|D|없음|무엇]' } });
    const s0 = await t.fakeSeq();
    await t.send('다른 봇 인사');
    await quietAux(t);
    const req = (await t.fakeLog(s0, 'main'))[0];
    const all = JSON.stringify(req?.body ?? {});
    step('다른 봇: 요청', '로어·[Inventory]·이미지 지침 없음', { lore: all.includes('goei:lore'), inv: all.includes('[Inventory]'), img: all.includes('Inserting Character Visual'), msgs: req?.body?.messages?.length }, !all.includes('goei:lore') && !all.includes('[Inventory]'));
    const st = await t.chatState(true);
    step('다른 봇: 저장된 답', '태그 그대로(손 안 댐)', String(st.message.at(-1)?.data).slice(-120), /\[AN\|/.test(String(st.message.at(-1)?.data)) && /\[▣\|/.test(String(st.message.at(-1)?.data)));
    const scr = (await t.screenMessages()).at(-1)?.text ?? '';
    step('다른 봇: 화면', '(관찰) 상태창 줄 [▣ 이 카드로 그려지는지(표식만으로 그리는 길)', scr.slice(-160), null);
    const aux = await t.fakeLog(s0, 'aux');
    step('다른 봇: 보조 호출', '없음', aux.length, aux.length === 0);
    await t.shot(`${tag}`);
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-50);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
