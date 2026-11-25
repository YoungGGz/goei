// 재확인 EG · R09(답 기다리는 중 새 채팅 → 몰·상담 상태가 엉뚱한 채팅에) · R14(포인트몰 상담 답이 창 닫고 본편 넘어간 뒤 옴)
// 사용: source /tmp/t2-EG/t2-env.sh && FAKE_URL=http://192.0.2.2:9291 OUT=<dir> node re-away.mjs [cos|bm]
// 원래 G/run-away.mjs·run-away2.mjs 순서를 읽고 줄여 다시 짬. 기대값은 재확인자가 따로 세움:
//   R09 기대: 답은 보낸 채팅(같은 id)에만 저장되거나 버려지고, 다른 id 채팅엔 안 들어간다
//   R14 기대: 늦게 온 상담 답의 줄 키 = 답 저장 때 마지막 응답 키, 다음 본편에 내 말·답이 감
import { openRun, sleep, STATES, msgsText } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = (process.env.OUT || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-EG/away') + '/';
mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const on = (p) => !want.size || want.has(p);

const COS_SHELF = `<shop-identity>
sells: 이상한 물건
never: 환불
prices: 원화
currency: -
</shop-identity>
<owner>
안녕하신가!
</owner>
<shelf>
반짝 걸음 구두약|15000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에.|||?
녹슬지 않는 못|3000|-|도구/못/nail|0.004|박는다.|||?
</shelf>`;
const cosAns = (txt) => `<owner>\n${txt}\n</owner>\n<change mode="none">\n</change>`;
const DESK_MAKE = `<card>
이름: 한서윤
직급: 대리
부서: 총무팀
소개: 복지몰 문의 담당
말투: 짧고 사무적
</card>
<say>네 총무팀입니다. 무슨 일이세요</say>`;
const TALK_RE = /^(?![\s\S]*Create the counselor answering this chat)/;

function helpers(r, tag) {
  const { t } = r;
  const J = (s) => { try { return JSON.parse(s || 'null'); } catch { return null; } };
  const allChats = () => t.R(async () => {
    const st = await import('/src/ts/stores.svelte.ts');
    const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
    const c = st.DBState.db.characters[ci];
    return { page: c.chatPage, chats: c.chats.map((ch, i) => ({ i, id: ch.id, name: ch.name, n: ch.message.length, ss: { ...(ch.scriptstate ?? {}) } })) };
  });
  const idxOf = async (id) => (await allChats()).chats.findIndex((c) => c.id === id);
  const byId = async (id) => (await allChats()).chats.find((c) => c.id === id);
  const where = async (text) => (await allChats()).chats.filter((c) => JSON.stringify(c.ss).includes(text)).map((c) => ({ i: c.i, id: c.id, name: c.name }));
  const lastKey = (id) => t.R(async (id) => { const st = await import('/src/ts/stores.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const ms = st.DBState.db.characters[ci].chats.find((c) => c.id === id).message; for (let j = ms.length - 1; j >= 0; j--) if (ms[j].role === 'char') return ms[j].chatId || `#${j + 1}`; return ''; }, id);
  const openNet = async (site) => {
    const sel = site === 'cos' ? '.ms-cos' : '.ms-bm';
    if (await t.feval((s) => !!document.querySelector(s), sel)) return true;
    if (!(await t.feval(() => !!document.querySelector('.br')))) { await r.fclickAction('nav-tab', 'net'); await sleep(700); }
    if (await t.feval((s) => !!document.querySelector(s), sel)) return true;
    if (!(await r.fclickAction('br-go', site))) await r.fclickAction('br-site', site);
    await sleep(1200);
    return t.feval((s) => !!document.querySelector(s), sel);
  };
  const shot = (n) => t.page.screenshot({ path: `${OUT}${tag}-${n}.png` }).catch(() => {});
  const save = (n, recs) => writeFileSync(`${OUT}${tag}-${n}.txt`, recs.filter(Boolean).map((x) => `######## seq ${x.seq} ${x.route}/${x.kind}\n${msgsText(x.body)}`).join('\n\n'));
  const mainTurn = async (say, reply) => { r.once('main', `${reply}\n\n${r.status()}`); const s = r.lastSeq(); await t.send(say); await r.until(async () => r.since(s, 'main').length, 20000); await sleep(3000); return r.since(s, 'main')[0] ?? null; };
  return { J, allChats, idxOf, byId, where, lastKey, openNet, shot, save, mainTurn };
}

async function runCos() {
  const r = await openRun({ out: OUT + '.dyn-cos', fake: process.env.FAKE_URL });
  const { t, check, note } = r;
  const h = helpers(r, 'COS');
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
  await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
  let L = await h.allChats();
  const ORIG = L.chats[0].id;
  note('C0', '채팅 목록', L.chats.map((c) => [c.i, c.id.slice(0, 8), c.name, c.n]));
  await t.openWindow(); await sleep(1200);
  await h.openNet('cos');
  r.once('cos', COS_SHELF);
  let s = r.lastSeq();
  await r.fclickAction('mall-refresh');
  await r.until(async () => r.since(s, 'cos').length, 15000);
  await sleep(1500);
  check('C0', '원래 채팅 우주몰 진열 받음', !!h.J((await h.byId(ORIG)).ss.$cos_shop)?.items?.length, '진열 있음', h.J((await h.byId(ORIG)).ss.$cos_shop)?.items?.map((x) => x.name));
  const askOnce = async (q) => { await r.fclickAction('mall-ask', ''); await sleep(900); r.hold('cos'); await t.F().fill('.cs-askwin [data-input="mall-say"]', q); await r.fclickAction('mall-say'); await r.until(async () => r.held().length, 10000); await r.fclickAction('mall-ask-close'); await t.closeWindow(); };

  // A: 원래 채팅 0번
  {
    const S = 'R09-A 우주몰·원래 0번·새 채팅';
    const q = '못은 몇 개 묶음이에요?', a = '한 개다 재확인A.';
    await askOnce(q);
    const before = await h.idxOf(ORIG);
    await t.newChat(); await sleep(1500);
    L = await h.allChats();
    const NEW = L.chats[0].id;
    note(S, '새 채팅 뒤 목록 (원래 채팅 번호 before→after)', { before, after: await h.idxOf(ORIG), list: L.chats.map((c) => [c.i, c.id.slice(0, 8), c.name]) });
    r.once('cos', cosAns(a));
    await r.unhold('cos'); await sleep(3500);
    const w = await h.where(a);
    note(S, '답 글이 들어간 채팅', w);
    const n1 = await h.byId(NEW);
    check(S, '기대: 새 채팅에 $cos_shop 이 안 생김', !n1.ss.$cos_shop, '없음', { has: !!n1.ss.$cos_shop, items: h.J(n1.ss.$cos_shop)?.items?.map((x) => x.name), talkTail: (h.J(n1.ss.$cos_shop)?.talk ?? []).slice(-2) }, '공-02');
    check(S, '기대: 원래 채팅 말고 다른 id 채팅에 답 글 없음', w.every((x) => x.id === ORIG), '원래 채팅만 또는 없음', w);
    await h.shot('A-newchat');
  }
  // B: 원래 채팅이 1번 이상 (지금 1번). 그 채팅으로 가서 묻고 새 채팅 → 원래 2번, 1번 자리에는 A 의 새 채팅
  {
    const S = 'R09-B 우주몰·원래 1번·새 채팅';
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1500);
    // 더 밀어 원래 채팅을 3번으로 (원래 보고의 r3 꼴): 새 채팅 두 개 더 만들고 돌아옴
    await t.newChat(); await sleep(1200); await t.newChat(); await sleep(1200);
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1500);
    const before = await h.idxOf(ORIG);
    L = await h.allChats();
    const atBefore = L.chats[before + 1]?.id; // 밀린 뒤 before 자리로 올 채팅은 지금 before-1 번 → 새 채팅 뒤 before 자리
    const sitter = L.chats[before - 1]?.id;
    note(S, '원래 채팅 번호와 그 앞 채팅(새 채팅 뒤 원래 자리에 올 채팅)', { before, sitter: sitter?.slice(0, 8), sitterName: L.chats[before - 1]?.name, list: L.chats.map((c) => [c.i, c.id.slice(0, 8), c.name, c.ss.$cos_shop ? 'cos' : '']) });
    await t.openWindow(); await sleep(1200); await h.openNet('cos');
    const q = '구두약 몇 번 써요?', a = '세 번이다 재확인B.';
    await askOnce(q);
    await t.newChat(); await sleep(1500);
    L = await h.allChats();
    note(S, '새 채팅 뒤 원래 채팅 번호', { after: await h.idxOf(ORIG), atOldIndex: L.chats[before]?.id?.slice(0, 8), atOldIndexName: L.chats[before]?.name });
    r.once('cos', cosAns(a));
    await r.unhold('cos'); await sleep(3500);
    const w = await h.where(a);
    note(S, '답 글이 들어간 채팅', w);
    check(S, '기대: 원래 채팅 말고 다른 id 채팅에 답 글 없음', w.every((x) => x.id === ORIG), '원래 채팅만 또는 없음', { w, sitter: sitter?.slice(0, 8) });
    note(S, '원래 자리(before 번)에 온 채팅 $cos_shop 대화 끝', (h.J((await h.byId(sitter))?.ss?.$cos_shop)?.talk ?? []).slice(-2));
    await h.shot('B-newchat');
  }
  r.writeResults(`${OUT}결과-cos.json`);
  await r.stop(); await t.close();
}

async function runBm() {
  const r = await openRun({ out: OUT + '.dyn-bm', fake: process.env.FAKE_URL });
  const { t, check, note } = r;
  const h = helpers(r, 'BM');
  await t.setup();
  await t.loadState(STATES + 'S-백일몽-3턴.json'); await sleep(1500);
  await t.loadState(STATES + 'S-백일몽-3턴.json'); await sleep(1500);
  let L = await h.allChats();
  const ORIG = L.chats[0].id;
  await t.openWindow(); await sleep(1200);
  await h.openNet('bm');
  if (/로그인이 필요/.test(await r.ftext('.ms-bm'))) { await r.fclickAction('br-login'); await sleep(400); await t.F().fill('input[name="br-nick"]', '현장탐사팀 신입'); await r.fclickAction('br-login-save'); await sleep(900); }
  r.on('desk', DESK_MAKE, /Create the counselor answering this chat/);
  let s = r.lastSeq();
  await r.fclickAction('mall-ask', '');
  await r.until(async () => r.since(s, 'desk').length, 15000);
  await sleep(2000);
  const desk = async (id = ORIG) => h.J((await h.byId(id))?.ss?.$bm_desk);
  const deskInput = () => t.feval(() => { const i = document.querySelector('.bd-win [data-input="mall-say"]'); return i ? { value: i.value, disabled: i.disabled } : null; }).catch(() => null);
  const deskOpenW = async () => { await t.openWindow(); await sleep(1000); await h.openNet('bm'); await r.fclickAction('mall-ask', ''); await sleep(1800); };
  check('B0', '상담 연결', !!(await desk())?.agent, '상담사 있음', (await desk())?.agent?.name);
  const sayHold = async (q) => { if ((await deskInput())?.disabled !== false) await r.until(async () => (await deskInput())?.disabled === false, 15000); r.hold('desk'); await t.F().fill('.bd-win [data-input="mall-say"]', q); await r.fclickAction('mall-say'); await r.until(async () => r.held().length, 10000); await r.fclickAction('mall-ask-close'); await t.closeWindow(); };

  if (on('r14') || !want.size || want.has('bm')) {
    // 대조 K0: 창 닫고 본편 안 넘기고 답 도착 → 줄 키 = 마지막 응답 키
    {
      const S = 'R14-대조 창 닫음·본편 안 넘김';
      const q = '앰플 재입고 언제예요?', a = '다음 주 화요일입니다 재확인K0';
      await sayHold(q);
      r.once('desk', `<say>${a}</say>`, TALK_RE);
      await r.unhold('desk'); await sleep(3000);
      const d = await desk(); const k = await h.lastKey(ORIG);
      check(S, '대조: 답 줄 키 = 지금 마지막 응답 키', d?.talk?.at(-1)?.k === k, k, { tail: d?.talk?.slice(-2), anchor: d?.anchor });
      const m = await h.mainTurn('K0 자리에 앉는다.', '사무실은 조용했다. (K0)');
      h.save('R14-K0-본편', [m]);
      const mt = m ? msgsText(m.body) : '';
      check(S, '대조: 다음 본편에 내 말·답 감', mt.includes(q) && mt.includes(a), '둘 다', { q: mt.includes(q), a: mt.includes(a) });
    }
    // R14: 창 닫고 본편 한 턴 → 그 뒤 답 도착
    {
      const S = 'R14 창 닫음·본편 넘긴 뒤 답 도착';
      await deskOpenW();
      note(S, '시작 상담 창', { inp: await deskInput(), agent: (await desk())?.agent?.name, win: (await r.ftext('.bd-win')).slice(0, 120) });
      const q = '대여창고 몇 시까지 열어요?', a = '평일 여섯 시까지입니다 재확인R14';
      await sayHold(q);
      const keyBefore = await h.lastKey(ORIG);
      const mid = await h.mainTurn('R14 잠깐 졸았다.', '형광등이 깜빡였다. (R14-mid)');
      const keyAfter = await h.lastKey(ORIG);
      r.once('desk', `<say>${a}</say>`, TALK_RE);
      await r.unhold('desk'); await sleep(3000);
      const d = await desk();
      note(S, '답 저장 뒤 상담 줄', { keyBefore, keyAfter, tail: d?.talk?.slice(-3)?.map((l) => ({ who: l.who, text: l.text.slice(0, 30), k: l.k, w: l.w })), anchor: d?.anchor });
      check(S, '기대: 늦게 온 답 줄 키 = 답 저장 때(본편 넘어간 뒤) 마지막 응답 키', d?.talk?.at(-1)?.k === keyAfter, keyAfter, d?.talk?.slice(-2)?.map((l) => l.k), 'G-14 · deskRun 주석');
      // 창을 다시 열면 무엇이 되나
      await deskOpenW();
      const d2 = await desk();
      note(S, '다시 연 뒤 상담', { agent: d2?.agent?.name, talkTail: d2?.talk?.slice(-2)?.map((l) => l.text.slice(0, 30)), doneHas: JSON.stringify(d2?.done ?? []).includes(a), win: (await r.ftext('.bd-win')).slice(0, 200) });
      await h.shot('R14-reopen');
      await r.fclickAction('mall-ask-close'); await t.closeWindow();
      const m = await h.mainTurn('R14 서류를 넘긴다.', '오후가 흘렀다. (R14-next)');
      h.save('R14-본편', [m]);
      const mt = m ? msgsText(m.body) : '';
      check(S, '기대: 다음 본편에 늦게 온 상담(내 말·답) 감', mt.includes(q) && mt.includes(a), '둘 다', { q: mt.includes(q), a: mt.includes(a), line: (/[^\n]{0,60}counselor[^\n]{0,200}/.exec(mt) || ['(줄 없음)'])[0] }, 'G-14 · 업데이트내역 v0.21.34');
    }
  }
  // R09 상담: 원래 0번에서 답 기다리는 중 새 채팅
  {
    const S = 'R09-C 상담·원래 0번·새 채팅';
    await deskOpenW();
    const q = '포인트 유효기간 있어요?', a = '연말에 소멸됩니다 재확인C';
    await sayHold(q);
    await t.newChat(); await sleep(1500);
    L = await h.allChats();
    const NEW = L.chats[0].id;
    r.once('desk', `<say>${a}</say>`, TALK_RE);
    await r.unhold('desk'); await sleep(3500);
    const w = await h.where(a);
    const n1 = await h.byId(NEW);
    note(S, '답 글이 들어간 채팅', w);
    check(S, '기대: 새 채팅에 $bm_desk 안 생김', !n1.ss.$bm_desk, '없음', { has: !!n1.ss.$bm_desk, tail: (h.J(n1.ss.$bm_desk)?.talk ?? []).slice(-2) }, '공-02');
    check(S, '기대: 원래 채팅 말고 다른 id 채팅에 답 글 없음', w.every((x) => x.id === ORIG), '원래 채팅만 또는 없음', w);
    await h.shot('C-newchat');
  }
  r.writeResults(`${OUT}결과-bm.json`);
  await r.stop(); await t.close();
}

if (on('cos')) await runCos().catch((e) => console.error('cos 멈춤', e));
if (on('bm') || on('r14')) await runBm().catch((e) => console.error('bm 멈춤', e));
process.exit(0);
