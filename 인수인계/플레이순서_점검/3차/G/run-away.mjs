// 3차 점검 G · 쇼핑 갈래 「다른 채팅 다녀오기」 (우주몰 문의·포인트몰 1:1 상담 답 오는 중). 실제 리스AI(996a553) + 가짜 모델 서버(이 칸 전용 8795)
// 사용: source /tmp/t2/t2-env.sh && FAKE_URL=http://192.0.2.2:8795 node 인수인계/플레이순서_점검/3차/G/run-away.mjs [cos|bm] [tag]
// 기준: ../E/run.mjs 「E8d 다른 채팅 다녀오기」 (hold 로 답 붙잡기 → 채팅 바꾸기 → 답 풀기 → 돌아와 입력칸·대화 보기).
// 단계마다 기대값·근거 줄을 먼저 적고(check 의 expect·row) 대조한다.
// 출력: out/AWAY-<태그>-*.txt·png, 결과 out/결과-away[-태그].json. lib 의 붙잡기 답 파일(.dyn-reply.txt)은 다른 G 대본과 안 겹치게 out/.away-dyn/ 에 둔다.
import { openRun, sleep, STATES, msgsText } from '../E/lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const DYN = `${OUT}.away-dyn`;
mkdirSync(DYN, { recursive: true });
const W = Number(process.env.W || 1280), H = Number(process.env.H || 800);
const args = process.argv.slice(2);
const want = new Set(args.filter((a) => a === 'cos' || a === 'bm'));
const TAG = args.find((a) => a !== 'cos' && a !== 'bm') || 'r1';
const on = (p) => !want.size || want.has(p);
const all = [];   // 두 판의 결과 모음

const COS_SHELF = `<shop-identity>
sells: 출처를 모르는 이상한 물건, 정보, 맞춤 제작
never: 환불, 반품, 흥정
prices: 계좌 이체 원화만 받는다, 모든 상품 비싸다
currency: -
</shop-identity>
<owner>
안녕하신가! 새로운 상품, 우리는 진열했다.
</owner>
<shelf>
반짝 걸음 구두약|15000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에. 걸음 반짝인다.|걸음이 빛남, 당신의||?
말 듣는 우산|22000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다, 위에서만.|???||?
녹슬지 않는 못|3000|-|도구/못/nail|0.004|박는다. 녹슬지 않는다.|||?
</shelf>`;
const cosAns = (txt) => `<owner>\n${txt}\n</owner>\n<change mode="none">\n</change>`;
const DESK_MAKE = `<card>
이름: 한서윤
직급: 대리
부서: 총무팀
소개: 복지몰 문의를 맡은 총무팀 대리
말투: 짧고 사무적
</card>
<say>네 총무팀 한서윤입니다. 무슨 일이세요</say>`;

/** 상담 말 요청만 (상담사 만들기 요청이 아닌 것) */
const TALK_RE = /^(?![\s\S]*Create the counselor answering this chat)/;
/** 공용 도우미 (이 파일 안) */
function helpers(r) {
  const { t } = r;
  const cnt = (s, re) => (String(s).match(re) || []).length;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** 지금 캐릭터의 i 번 채팅 (바꾸지 않고 DB 에서 바로 읽음) */
  const chatAt = (i) => t.R(async (i) => {
    const st = await import('/src/ts/stores.svelte.ts');
    const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
    const c = st.DBState.db.characters[ci];
    const ch = c.chats[i];
    if (!ch) return null;
    return { i, id: ch.id, name: ch.name, n: ch.message.length, chatPage: c.chatPage, ss: { ...(ch.scriptstate ?? {}) } };
  }, i);
  const chatList = async () => (await t.chatState()).chats;
  /** i 번 채팅의 마지막 응답(char) 키 = chatId (core/people/store.ts messageKey) */
  const lastKeyAt = (i) => t.R(async (i) => { const st = await import('/src/ts/stores.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const ms = st.DBState.db.characters[ci].chats[i].message; for (let j = ms.length - 1; j >= 0; j--) if (ms[j].role === 'char') return ms[j].chatId || `#${j + 1}`; return ''; }, i);
  const J = (s) => { try { return JSON.parse(s || 'null'); } catch { return null; } };
  /** 플러그인 창 → 인터넷 → 사이트 (이미 인터넷이면 메뉴 탭을 다시 누르지 않음: 다시 누르면 상황판으로 감) */
  const openSite = async (site) => {
    const sel = site === 'cos' ? '.ms-cos' : '.ms-bm';
    if (await t.feval((s) => !!document.querySelector(s), sel)) return true;
    if (!(await t.feval(() => !!document.querySelector('.br')))) { await r.fclickAction('nav-tab', 'net'); await sleep(700); }
    if (await t.feval((s) => !!document.querySelector(s), sel)) return true;
    if (!(await r.fclickAction('br-go', site))) await r.fclickAction('br-site', site);
    await sleep(1200);
    return t.feval((s) => !!document.querySelector(s), sel);
  };
  const shot = (name) => t.page.screenshot({ path: `${OUT}AWAY-${TAG}-${name}.png` }).then(() => `${OUT}AWAY-${TAG}-${name}.png`).catch(() => '');
  const save = (name, recs) => { const p = `${OUT}AWAY-${TAG}-${name}.txt`; writeFileSync(p, recs.filter(Boolean).map((x) => `######## seq ${x.seq} ${x.route}/${x.kind} stream=${x.stream}\n${msgsText(x.body)}`).join('\n\n')); return p; };
  /** 본편 한 턴 보내고 그 본편 요청 (그 턴의 Router·갱신기는 기본 답) */
  const mainTurn = async (say, reply) => {
    r.once('main', `${reply}\n\n${r.status()}`);
    const s = r.lastSeq();
    await t.send(say);
    await sleep(2500);
    return r.since(s, 'main')[0] ?? null;
  };
  return { cnt, esc, chatAt, chatList, lastKeyAt, J, openSite, shot, save, mainTurn };
}

// ═════════════════════ 우주 쇼핑몰 문의 ═════════════════════
async function runCos() {
  const r = await openRun({ out: DYN, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const h = helpers(r);
  const { cnt, esc, chatAt, J, openSite, shot, save, mainTurn } = h;
  await t.setup();
  // 같은 상태를 두 번 넣는다: 0번 = 이 판의 채팅, 1번 = 시작된 다른 괴이 채팅(먼저 넣은 사본), 2번 = setup 의 빈 Chat 1 (importChat 은 맨 앞에 끼움)
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  const ld = await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  note('A0 준비', '상태 두 번 넣은 뒤 채팅 목록 (0번=이 판, 1번=시작된 다른 채팅, 2번=빈 Chat 1)', { ld, chats: await h.chatList() });
  // 진열 받기 (문의는 진열이 있어야 됨: malls.ts mall-say `!st.loaded` 거름)
  await t.openWindow(); await sleep(1200);
  check('A0 준비', '우주몰 창 열림', await openSite('cos'), true, '', 'G-01 (열기)');
  r.once('cos', COS_SHELF);
  let s = r.lastSeq();
  await r.fclickAction('mall-refresh');
  await r.until(async () => r.since(s, 'cos').length, 15000);
  await sleep(1500);
  const cs0 = J((await chatAt(0)).ss.$cos_shop);
  // 시그니처 상품(설정 기본 「착한 친구」, 25%)이 끼면 4개 (G 찾은문제 「의도」: COS_FIXED_DEFAULT)
  check('A0 준비', '진열에 대본 3개 저장 (시그니처 상품이 더 낄 수 있음)', ['반짝 걸음 구두약', '말 듣는 우산', '녹슬지 않는 못'].every((n) => (cs0?.items ?? []).some((x) => x.name === n)), '대본 3개 포함', (cs0?.items ?? []).map((x) => x.name), 'G-03 진열 · malls.ts cosFixedRoll');
  const talkAt = async (i) => J((await chatAt(i))?.ss?.$cos_shop)?.talk ?? [];
  const askOpen = async () => { await r.fclickAction('mall-ask', ''); await sleep(900); };
  const askInput = () => t.feval(() => { const i = document.querySelector('.cs-askwin [data-input="mall-say"]'); return i ? { value: i.value, disabled: i.disabled } : null; }).catch(() => null);
  const askSay = async (q) => { await t.F().fill('.cs-askwin [data-input="mall-say"]', q); await r.fclickAction('mall-say'); };
  /** 돌아와서: 받아 둠(대화에 내 말+답, 입력칸 빔) 또는 버림(대화에 내 말 없음, 입력칸에 내 말) — 반쯤(답 없는 내 말이 대화에 남음) 아님 */
  const judgeBack = async (S, q, a, i0) => {
    const talk = await talkAt(i0);
    const inp = await askInput();
    const win = await r.ftext('.cs-askwin');
    const qIn = talk.filter((l) => l.who === 'me' && l.text.includes(q)).length;
    const aIn = talk.filter((l) => l.who !== 'me' && l.text.includes(a)).length;
    const kept = qIn === 1 && aIn === 1 && !inp?.value;
    const dropped = qIn === 0 && aIn === 0 && inp?.value === q;
    check(S, '돌아온 뒤: 받아 둠(대화에 내 말+답 한 번, 입력칸 빔) 또는 버림(대화에 없음, 내 말이 입력칸) — 반쯤 안 남음', kept || dropped, '둘 중 하나', { kept, dropped, qIn, aIn, input: inp, talkTail: talk.slice(-3) }, '공-02 · 업데이트내역 v0.21.34 12줄 · malls.ts ask「같은 채팅을 보고 있을 때만 저장」+ mall-ask dropPending');
    check(S, '창 글과 저장이 같음 (창에 답 있음 ⇔ 저장에 답 있음)', (/\S/.test(a) && win.includes(a)) === (aIn > 0), aIn > 0 ? '창에 답' : '창에 답 없음', win.slice(-200));
    return { kept, dropped, talk, inp };
  };
  /** 다음 본편에 문의가 한 번만 (받아 뒀으면 그 본편에 한 번, 버렸으면 다시 보내 답 받은 뒤 본편에 한 번) */
  const judgeNextMain = async (S, q, a, back, nm) => {
    let m1 = await mainTurn(`${nm} 주위를 둘러본다.`, `조용한 오후였다. (${nm})`);
    let mt = m1 ? msgsText(m1.body) : '';
    save(`${S.split(' ')[0]}-본편1`, [m1]);
    if (back.kept) {
      check(S, '받아 둔 경우: 다음 본편에 내 말·답 각 한 번', cnt(mt, new RegExp(esc(q), 'g')) === 1 && cnt(mt, new RegExp(esc(a), 'g')) === 1, '각 1', (/[^\n]{0,80}우주 쇼핑몰[^\n]{0,300}/.exec(mt) || ['(줄 없음)'])[0], 'core/malls.ts mallEvents (lineNow·answeredTalk) · 업데이트내역 v0.21.34 12줄');
    } else {
      check(S, '버린 경우: 다음 본편에 내 말 안 감', cnt(mt, new RegExp(esc(q), 'g')) === 0, 0, (/[^\n]{0,60}우주 쇼핑몰[^\n]{0,200}/.exec(mt) || ['(줄 없음)'])[0], '업데이트내역 v0.21.34 12줄 「답을 못 받은 내 말은 본편에 가지 않고」');
      // 입력칸 글 그대로 다시 보냄 → 답 → 다음 본편 한 번
      await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
      const inp = await askInput();
      note(S, '다시 열었을 때 입력칸 (본편 한 턴 뒤)', inp);
      if (inp?.value !== q) await t.F().fill('.cs-askwin [data-input="mall-say"]', q);
      r.once('cos', cosAns(a));
      const s2 = r.lastSeq();
      await r.fclickAction('mall-say');
      await r.until(async () => r.since(s2, 'cos').length, 15000);
      await sleep(1500);
      await r.fclickAction('mall-ask-close'); await t.closeWindow();
      m1 = await mainTurn(`${nm} 휴대폰을 내려놓는다.`, `해가 기울었다. (${nm}b)`);
      mt = m1 ? msgsText(m1.body) : '';
      save(`${S.split(' ')[0]}-본편1b`, [m1]);
      check(S, '버린 뒤 다시 보낸 문의: 다음 본편에 내 말·답 각 한 번', cnt(mt, new RegExp(esc(q), 'g')) === 1 && cnt(mt, new RegExp(esc(a), 'g')) === 1, '각 1', (/[^\n]{0,80}우주 쇼핑몰[^\n]{0,300}/.exec(mt) || ['(줄 없음)'])[0], 'core/malls.ts mallEvents');
    }
    const m2 = await mainTurn(`${nm} 기지개를 켠다.`, `저녁이 왔다. (${nm}c)`);
    const mt2 = m2 ? msgsText(m2.body) : '';
    check(S, '그다음 본편엔 같은 문의 다시 안 감', cnt(mt2, new RegExp(esc(q), 'g')) === 0, 0, (/[^\n]{0,60}우주 쇼핑몰[^\n]{0,200}/.exec(mt2) || ['(줄 없음)'])[0], 'core/malls.ts mallEvents 「마지막 응답 뒤에 한 것만」');
  };

  // ── A1 그동안 도착: 문의 답 기다리는 중 다른 채팅(기존 1번)으로 → 답 도착 → 돌아옴 ──
  {
    const S = 'A1 우주몰·다른 채팅에 있는 동안 답 도착';
    const q = '오늘 배송 몇 시까지 돼요?', a = '오늘 배송 끝났다. 내일 아침이다.';
    const other0 = await chatAt(1);
    note(S, '다른 채팅(1번) 처음 몰 변수', { name: other0?.name, cos: other0?.ss?.$cos_shop ?? null, bm: other0?.ss?.$bm_shop ?? null, n: other0?.n });
    await askOpen();
    r.hold('cos');
    s = r.lastSeq();
    await askSay(q);
    await r.until(async () => r.held().length, 10000);
    const t0 = await talkAt(0);
    check(S, '보낸 뒤 답 기다리는 중: 대화 끝에 내 말(답 없음)', t0.at(-1)?.who === 'me' && t0.at(-1)?.text === q, q, t0.slice(-2), 'malls.ts mall-say (내 말 먼저 저장)');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.switchChat(1);
    await sleep(800);
    note(S, '바꾼 뒤 지금 채팅', { chatPage: (await t.chatState()).chatPage });
    r.once('cos', cosAns(a));
    await r.unhold('cos');
    await sleep(2500);
    const other = await chatAt(1);
    check(S, '다른 채팅에 몰 상태가 안 생김 ($cos_shop 그대로)', (other?.ss?.$cos_shop ?? null) === (other0?.ss?.$cos_shop ?? null), other0?.ss?.$cos_shop ?? null, String(other?.ss?.$cos_shop ?? '(없음)').slice(0, 200), '맞는 줄 없음 (malls.ts ask: 같은 채팅을 보고 있을 때만 저장)');
    check(S, '다른 채팅에 답 글이 어디에도 안 들어감', !JSON.stringify(other?.ss ?? {}).includes(a), '없음', '');
    note(S, '원래 채팅(0번) 저장: 다른 채팅에 있는 동안 답이 붙었나', (await talkAt(0)).slice(-3));
    await t.switchChat(0);
    await sleep(1000);
    note(S, '돌아온 직후 대화 끝 (창 열기 전)', (await talkAt(0)).slice(-3));
    await t.openWindow(); await sleep(1000);
    note(S, '창 다시 열면 우주몰 그대로', await t.feval(() => !!document.querySelector('.ms-cos')));
    await openSite('cos'); await askOpen();
    const back = await judgeBack(S, q, a, 0);
    await shot('A1-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'A1');
  }

  // ── A1b 그동안 도착 + 다른 채팅에서 플러그인 창을 엶 (플러그인이 다른 채팅을 보고 있는 동안 답 도착) ──
  {
    const S = 'A1b 우주몰·다른 채팅에서 창 연 동안 답 도착';
    const q = '구두약 한 통 몇 번 써요?', a = '세 번이다. 네 번째는 없다.';
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    const other0 = await chatAt(1);
    r.hold('cos');
    await askSay(q);
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.switchChat(1); await sleep(1000);
    await t.openWindow(); await sleep(1500);
    note(S, '다른 채팅에서 연 창 (첫 글)', (await r.ftext('.gx')).slice(0, 120));
    await shot('A1b-other-open');
    r.once('cos', cosAns(a));
    await r.unhold('cos');
    await sleep(2500);
    const other = await chatAt(1);
    check(S, '다른 채팅에 몰 상태가 안 생김 ($cos_shop 그대로)', (other?.ss?.$cos_shop ?? null) === (other0?.ss?.$cos_shop ?? null), String(other0?.ss?.$cos_shop ?? null).slice(0, 80), String(other?.ss?.$cos_shop ?? '(없음)').slice(0, 300), '맞는 줄 없음 (malls.ts ask 「같은 채팅을 보고 있을 때만 저장」)');
    check(S, '다른 채팅에 답 글이 어디에도 안 들어감', !JSON.stringify(other?.ss ?? {}).includes(a), '없음', '');
    note(S, '원래 채팅(0번) 저장: 다른 채팅을 보는 동안', (await talkAt(0)).slice(-3));
    await t.closeWindow();
    await t.switchChat(0); await sleep(1000);
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    const back = await judgeBack(S, q, a, 0);
    await shot('A1b-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'A1b');
  }

  // ── A2 돌아온 뒤 도착: 답 기다리는 중 다른 채팅 갔다가 돌아옴 → 그 뒤 답 도착 (그사이 본편 한 턴) ──
  {
    const S = 'A2 우주몰·돌아온 뒤 답 도착';
    const q = '우산 비 올 때만 써요?', a = '비 없어도 쓴다. 해도 멈춘다.';
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    r.hold('cos');
    await askSay(q);
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.switchChat(1); await sleep(800);
    const other0 = await chatAt(1);
    await t.switchChat(0); await sleep(1000);
    const t1 = await talkAt(0);
    note(S, '돌아온 뒤(답 아직) 대화 끝', t1.slice(-2));
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    const inp = await askInput();
    const win = await r.ftext('.cs-askwin');
    check(S, '답 아직 오는 중에 다시 열면: 기다리던 내 말을 떼지 않음(입력칸 비고 대화에 내 말)', !inp?.value && (await talkAt(0)).at(-1)?.text === q, '입력칸 빔·대화 끝 내 말', { inp, win: win.slice(-160) }, 'malls.ts mall-ask 「!jobs.has(...) && dropPending」(돌고 있는 요청이 있으면 안 뗌)');
    note(S, '답 오는 중 다시 연 창: 입력칸 막힘·기다림 표시 (ui 상태는 채팅 바뀔 때 비워짐: resetMalls)', { inp, loadingMark: await t.feval(() => !!document.querySelector('.cs-askwin .cs-wait, .cs-askwin [aria-busy="true"], .cs-askwin .cs-dots')) });
    await shot('A2-waiting-reopen');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    // 답 기다리는 동안 본편 한 턴
    const mid = await mainTurn('잠깐 창밖을 본다.', '비가 그쳤다. (A2-mid)');
    save('A2-본편-답기다리는중', [mid]);
    check(S, '답 기다리던 동안 가는 본편에 짝 없는 내 말 안 감', cnt(mid ? msgsText(mid.body) : '', new RegExp(esc(q), 'g')) === 0, 0, (/[^\n]{0,60}우주 쇼핑몰[^\n]{0,200}/.exec(mid ? msgsText(mid.body) : '') || ['(줄 없음)'])[0], 'core/malls.ts mallEvents 「답 없는 내 말은 넘기지 않는다」 · 업데이트내역 v0.21.34 12줄');
    r.once('cos', cosAns(a));
    await r.unhold('cos');
    await sleep(2500);
    const other = await chatAt(1);
    check(S, '다른 채팅에 몰 상태가 안 생김', (other?.ss?.$cos_shop ?? null) === (other0?.ss?.$cos_shop ?? null), other0?.ss?.$cos_shop ?? null, String(other?.ss?.$cos_shop ?? '(없음)').slice(0, 200), '맞는 줄 없음');
    const t2 = await talkAt(0);
    note(S, '답 도착 뒤 대화 끝 (키·w 표시)', t2.slice(-2));
    const kNow = await h.lastKeyAt(0);
    check(S, '늦게 온 답의 줄 키 = 지금 마지막 응답 키 (다음 본편에 실리는 키)', t2.at(-1)?.k === kNow && t2.at(-2)?.k === kNow, kNow, t2.slice(-2).map((l) => l.k), 'core/shop.ts stampReply 「답을 저장할 때 지금 본편 응답 키」 · 업데이트내역 v0.21.34 12줄');
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    const back = await judgeBack(S, q, a, 0);
    check(S, '이 경우(같은 채팅에서 도착)는 받아 둠', back.kept, '받아 둠', { kept: back.kept }, 'malls.ts ask: env.current() 가 같은 채팅이면 저장 + stampReply');
    await shot('A2-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'A2');
  }

  // ── A3 새 채팅을 만들고 답 도착 (리스AI 「새 채팅」은 맨 앞에 끼워 번호가 밀림) ──
  {
    const S = 'A3 우주몰·새 채팅 만든 동안 답 도착';
    const q = '못은 몇 개 묶음이에요?', a = '한 개다. 하나면 충분하다.';
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    r.hold('cos');
    await askSay(q);
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    const origId = (await chatAt(0)).id;
    const nc = await t.newChat();
    await sleep(1200);
    const list = await h.chatList();
    note(S, '새 채팅 뒤 목록 (0번=새 채팅, 원래 채팅은 1번으로 밀림)', { nc, list });
    const new0 = await chatAt(0);
    r.once('cos', cosAns(a));
    await r.unhold('cos');
    await sleep(3000);
    const newNow = await chatAt(0);
    check(S, '새 채팅에 몰 상태가 안 생김 ($cos_shop 없음)', !newNow?.ss?.$cos_shop, '없음', { before: new0?.ss?.$cos_shop ?? null, after: String(newNow?.ss?.$cos_shop ?? '').slice(0, 300), id: newNow?.id }, '맞는 줄 없음 (malls.ts ask 「같은 채팅을 보고 있을 때만 저장」)');
    check(S, '새 채팅에 답 글이 안 들어감', !JSON.stringify(newNow?.ss ?? {}).includes(a), '없음', '');
    const oi = list.findIndex((c) => c.id === origId);
    note(S, '원래 채팅 저장(밀린 번호에서): 대화 끝', { oi, tail: (await talkAt(oi)).slice(-3) });
    await shot('A3-newchat');
    await t.switchChat(oi); await sleep(1200);
    await t.openWindow(); await sleep(1000); await openSite('cos'); await askOpen();
    const back = await judgeBack(S, q, a, oi);
    await shot('A3-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'A3');
    // 뒤따름: 몰 상태가 샌 새 채팅에서 새 게임을 시작하면 그 채팅 우주몰에 무엇이 보이나 (사용자가 겪는 모습)
    const S2 = 'A3+ 샌 새 채팅에서 시작';
    const li = await h.chatList();
    const ni = li.findIndex((c) => c.id === newNow?.id);
    if (ni >= 0 && newNow?.ss?.$cos_shop) {
      await t.switchChat(ni); await sleep(1200);
      try {
        await t.start('A00');
        await sleep(1500);
        const ss = (await chatAt(ni)).ss;
        const cs = J(ss.$cos_shop);
        note(S2, '새 게임 시작 뒤 그 채팅 $cos_shop (남았나)', { has: !!cs, items: (cs?.items ?? []).map((x) => x.name), talk: (cs?.talk ?? []).slice(-2) });
        await t.openWindow(); await sleep(1200); await openSite('cos'); await sleep(800);
        const page = await r.ftext('.ms-cos');
        await askOpen();
        const win = await r.ftext('.cs-askwin');
        note(S2, '새 게임의 우주몰 화면·문의 창 (다른 채팅에서 받은 진열·대화가 보이나)', { page: page.slice(0, 260), win: win.slice(-200) });
        await shot('A3plus-newgame-cos');
        await r.fclickAction('mall-ask-close'); await t.closeWindow();
      } catch (e) { note(S2, '새 게임 시작 못 함', String(e?.message ?? e).slice(0, 200)); }
    } else note(S2, '건너뜀 (새 채팅에 샌 상태 없음)', { ni });
  }
  note('끝', '콘솔 오류 (플러그인 [goei])', t.errors.filter((e) => /goei/.test(e)).slice(-10));
  all.push(...r.results.map((x) => ({ site: 'cos', ...x })));
  r.writeResults(`${OUT}결과-away-cos-${TAG}.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ 백일몽 포인트몰 1:1 상담 ═════════════════════
async function runBm() {
  const r = await openRun({ out: DYN, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const h = helpers(r);
  const { cnt, esc, chatAt, J, openSite, shot, save, mainTurn } = h;
  await t.setup();
  await t.loadState(STATES + 'S-백일몽-3턴.json');
  await sleep(1500);
  const ld = await t.loadState(STATES + 'S-백일몽-3턴.json');
  await sleep(1500);
  note('B0 준비', '상태 두 번 넣은 뒤 채팅 목록 (0번=이 판, 1번=시작된 다른 채팅, 2번=빈 Chat 1)', { ld, chats: await h.chatList() });
  await t.openWindow(); await sleep(1200);
  check('B0 준비', '포인트몰 창 열림', await openSite('bm'), true, '', 'G-09');
  if (/로그인이 필요/.test(await r.ftext('.ms-bm'))) { await r.fclickAction('br-login'); await sleep(400); await t.F().fill('input[name="br-nick"]', '현장탐사팀 신입'); await r.fclickAction('br-login-save'); await sleep(900); }
  r.once('desk', DESK_MAKE);
  let s = r.lastSeq();
  await r.fclickAction('mall-ask', '');
  await r.until(async () => r.since(s, 'desk').length, 15000);
  await sleep(1800);
  check('B0 준비', '상담사 연결 (첫 인사)', /무슨 일이세요/.test(await r.ftext('.bd-win')), '연결', (await r.ftext('.bd-win')).slice(0, 120), 'G-09·G-14');
  // 본편이 넘어간 뒤 창을 열면 새 상담사 연결(make)이 다시 온다(malls.ts deskOpen). 그 요청엔 늘 상담사 카드로 답한다
  r.on('desk', DESK_MAKE, /Create the counselor answering this chat/);
  const desk = async (i) => J((await chatAt(i))?.ss?.$bm_desk) ?? null;
  const deskInput = () => t.feval(() => { const i = document.querySelector('.bd-win [data-input="mall-say"]'); return i ? { value: i.value, disabled: i.disabled } : null; }).catch(() => null);
  const deskSay = async (q) => { await t.F().fill('.bd-win [data-input="mall-say"]', q); await r.fclickAction('mall-say'); };
  const deskOpenW = async () => { await t.openWindow(); await sleep(1000); await openSite('bm'); await r.fclickAction('mall-ask', ''); await sleep(1500); };
  const deskAll = (d) => [...(d?.done ?? []), ...(d?.talk ?? [])];
  const judgeBack = async (S, q, a, i0) => {
    const d = await desk(i0);
    const inp = await deskInput();
    const win = await r.ftext('.bd-win');
    const lines = deskAll(d);
    const qIn = lines.filter((l) => l.who === 'me' && l.text.includes(q)).length;
    const aIn = lines.filter((l) => l.who === 'op' && l.text.includes(a)).length;
    const kept = qIn === 1 && aIn === 1 && !inp?.value;
    const dropped = qIn === 0 && aIn === 0 && inp?.value === q;
    check(S, '돌아온 뒤: 받아 둠(상담에 내 말+답 한 번, 입력칸 빔) 또는 버림(상담에 없음, 내 말이 입력칸) — 반쯤 안 남음', kept || dropped, '둘 중 하나', { kept, dropped, qIn, aIn, input: inp, talkTail: (d?.talk ?? []).slice(-3), agent: d?.agent?.name ?? null }, '공-02 · 업데이트내역 v0.21.34 12줄 · malls.ts deskRun 「같은 채팅을 보고 있을 때만 저장」+ deskOpen dropPending');
    note(S, '돌아온 뒤 상담 창 글', win.slice(-200));
    return { kept, dropped, d, inp };
  };
  const judgeNextMain = async (S, q, a, back, nm) => {
    let m1 = await mainTurn(`${nm} 자리에 앉는다.`, `사무실은 조용했다. (${nm})`);
    let mt = m1 ? msgsText(m1.body) : '';
    save(`${S.split(' ')[0]}-본편1`, [m1]);
    const deskLine = (x) => (/[^\n]{0,60}counselor[^\n]{0,300}/.exec(x) || /[^\n]{0,60}포인트몰[^\n]{0,300}/.exec(x) || ['(줄 없음)'])[0];
    if (back.kept) {
      check(S, '받아 둔 경우: 다음 본편에 내 말·답 각 한 번', cnt(mt, new RegExp(esc(q), 'g')) === 1 && cnt(mt, new RegExp(esc(a), 'g')) === 1, '각 1', deskLine(mt), 'core/malls.ts mallEvents MALL.DESK · G-14 (0.21.34)');
    } else {
      check(S, '버린 경우: 다음 본편에 내 말 안 감', cnt(mt, new RegExp(esc(q), 'g')) === 0, 0, deskLine(mt), '업데이트내역 v0.21.34 12줄');
      await deskOpenW();
      const inp = await deskInput();
      note(S, '본편 한 턴 뒤 상담 창 다시 열기: 입력칸·상담사', { inp, win: (await r.ftext('.bd-win')).slice(0, 160) });
      if (!inp || inp.disabled) { note(S, '다시 보내기 못 함', inp); }
      else {
        if (inp.value !== q) await t.F().fill('.bd-win [data-input="mall-say"]', q);
        r.once('desk', `<say>${a}</say>`, TALK_RE);
        const s2 = r.lastSeq();
        await r.fclickAction('mall-say');
        await r.until(async () => r.since(s2, 'desk').filter((x) => /You play one 백일몽 employee answering the 1:1/.test(msgsText(x.body))).length, 15000);
        await sleep(1800);
        await r.fclickAction('mall-ask-close'); await t.closeWindow();
        m1 = await mainTurn(`${nm} 서류를 넘긴다.`, `오후가 흘렀다. (${nm}b)`);
        mt = m1 ? msgsText(m1.body) : '';
        save(`${S.split(' ')[0]}-본편1b`, [m1]);
        check(S, '버린 뒤 다시 보낸 상담: 다음 본편에 내 말·답 각 한 번', cnt(mt, new RegExp(esc(q), 'g')) === 1 && cnt(mt, new RegExp(esc(a), 'g')) === 1, '각 1', deskLine(mt), 'core/malls.ts mallEvents MALL.DESK');
      }
    }
    const m2 = await mainTurn(`${nm} 커피를 마신다.`, `퇴근 시간이 다가왔다. (${nm}c)`);
    const mt2 = m2 ? msgsText(m2.body) : '';
    check(S, '그다음 본편엔 같은 상담 다시 안 감', cnt(mt2, new RegExp(esc(q), 'g')) === 0, 0, deskLine(mt2), 'core/malls.ts mallEvents (lineNow)');
  };

  // ── B1 그동안 도착 ──
  {
    const S = 'B1 상담·다른 채팅에 있는 동안 답 도착';
    const q = '앰플 재입고 언제예요?', a = '다음 주 화요일 입고 예정입니다';
    const other0 = await chatAt(1);
    note(S, '다른 채팅(1번) 처음 상담·몰 변수', { name: other0?.name, desk: other0?.ss?.$bm_desk ?? null, bm: other0?.ss?.$bm_shop ?? null });
    r.hold('desk');
    await deskSay(q);
    await r.until(async () => r.held().length, 10000);
    const d0 = await desk(0);
    check(S, '보낸 뒤 답 기다리는 중: 상담 끝에 내 말(답 없음)', d0?.talk?.at(-1)?.who === 'me' && d0.talk.at(-1).text === q, q, d0?.talk?.slice(-2), 'malls.ts mall-say bm (내 말 먼저 저장)');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.switchChat(1); await sleep(800);
    r.once('desk', `<say>${a}</say>`, TALK_RE);
    await r.unhold('desk');
    await sleep(2500);
    const other = await chatAt(1);
    check(S, '다른 채팅에 상담 상태가 안 생김 ($bm_desk 그대로)', (other?.ss?.$bm_desk ?? null) === (other0?.ss?.$bm_desk ?? null), other0?.ss?.$bm_desk ?? null, String(other?.ss?.$bm_desk ?? '(없음)').slice(0, 200), '맞는 줄 없음 (malls.ts deskRun 「같은 채팅을 보고 있을 때만 저장」)');
    check(S, '다른 채팅에 답 글이 어디에도 안 들어감', !JSON.stringify(other?.ss ?? {}).includes(a), '없음', '');
    note(S, '원래 채팅(0번) 저장: 다른 채팅에 있는 동안', (await desk(0))?.talk?.slice(-3));
    await t.switchChat(0); await sleep(1000);
    await deskOpenW();
    const back = await judgeBack(S, q, a, 0);
    await shot('B1-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'B1');
  }

  // ── B1b 그동안 도착 + 다른 채팅에서 플러그인 창을 엶 ──
  {
    const S = 'B1b 상담·다른 채팅에서 창 연 동안 답 도착';
    const q = '마스크 언제 다시 들어와요?', a = '이번 달 말 입고됩니다';
    await deskOpenW();
    if ((await deskInput())?.disabled !== false) await r.until(async () => (await deskInput())?.disabled === false, 15000);
    const other0 = await chatAt(1);
    r.hold('desk');
    await deskSay(q);
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.switchChat(1); await sleep(1000);
    await t.openWindow(); await sleep(1500);
    note(S, '다른 채팅에서 연 창 (첫 글)', (await r.ftext('.gx')).slice(0, 120));
    r.once('desk', `<say>${a}</say>`, TALK_RE);
    await r.unhold('desk');
    await sleep(2500);
    const other = await chatAt(1);
    check(S, '다른 채팅에 상담 상태가 안 생김 ($bm_desk 그대로)', (other?.ss?.$bm_desk ?? null) === (other0?.ss?.$bm_desk ?? null), String(other0?.ss?.$bm_desk ?? null).slice(0, 80), String(other?.ss?.$bm_desk ?? '(없음)').slice(0, 300), '맞는 줄 없음 (malls.ts deskRun 「같은 채팅을 보고 있을 때만 저장」)');
    check(S, '다른 채팅에 답 글이 어디에도 안 들어감', !JSON.stringify(other?.ss ?? {}).includes(a), '없음', '');
    note(S, '원래 채팅(0번) 상담 끝: 다른 채팅을 보는 동안', (await desk(0))?.talk?.slice(-3));
    await t.closeWindow();
    await t.switchChat(0); await sleep(1000);
    await deskOpenW();
    const back = await judgeBack(S, q, a, 0);
    await shot('B1b-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'B1b');
  }

  // ── B2 돌아온 뒤 도착 (그사이 본편 한 턴) ──
  {
    const S = 'B2 상담·돌아온 뒤 답 도착';
    const q = '대여창고는 몇 시까지 열어요?', a = '평일 여섯 시까지입니다';
    await deskOpenW();
    const st0 = await deskInput();
    note(S, '시작 때 상담 창 (B1 뒤)', { inp: st0, win: (await r.ftext('.bd-win')).slice(0, 120) });
    if (!st0 || st0.disabled) {
      // 상담사가 없으면 새로 연결 (B1 뒤 본편이 넘어가 새 상담일 수 있음 — deskOpen)
      note(S, '입력칸이 막혀 연결을 기다림', st0);
      await r.until(async () => (await deskInput())?.disabled === false, 15000);
    }
    r.hold('desk');
    await deskSay(q);
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.switchChat(1); await sleep(800);
    const other0 = await chatAt(1);
    await t.switchChat(0); await sleep(1000);
    await deskOpenW();
    const inp = await deskInput();
    const dNow = await desk(0);
    check(S, '답 아직 오는 중에 다시 열면: 기다리던 내 말을 떼지 않음(입력칸 비고 상담 끝 내 말)', !inp?.value && dNow?.talk?.at(-1)?.text === q, '입력칸 빔·상담 끝 내 말', { inp, tail: dNow?.talk?.slice(-2) }, 'malls.ts deskOpen 「v.dl || jobs.has(...) 이면 기다리던 말을 떼지 않는다」');
    note(S, '답 오는 중 다시 연 창 글', (await r.ftext('.bd-win')).slice(-160));
    await shot('B2-waiting-reopen');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    const mid = await mainTurn('잠깐 졸았다.', '형광등이 깜빡였다. (B2-mid)');
    save('B2-본편-답기다리는중', [mid]);
    check(S, '답 기다리던 동안 가는 본편에 짝 없는 내 말 안 감', cnt(mid ? msgsText(mid.body) : '', new RegExp(esc(q), 'g')) === 0, 0, (/[^\n]{0,60}counselor[^\n]{0,200}/.exec(mid ? msgsText(mid.body) : '') || ['(줄 없음)'])[0], 'core/malls.ts mallEvents 「답 없는 끝의 내 말은 빼고」 · 업데이트내역 v0.21.34 12줄');
    r.once('desk', `<say>${a}</say>`, TALK_RE);
    await r.unhold('desk');
    await sleep(2500);
    const other = await chatAt(1);
    check(S, '다른 채팅에 상담 상태가 안 생김', (other?.ss?.$bm_desk ?? null) === (other0?.ss?.$bm_desk ?? null), other0?.ss?.$bm_desk ?? null, String(other?.ss?.$bm_desk ?? '(없음)').slice(0, 200), '맞는 줄 없음');
    note(S, '답 도착 뒤 상담 저장 (키·w)', { anchor: (await desk(0))?.anchor, tail: (await desk(0))?.talk?.slice(-3), done: (await desk(0))?.done?.slice?.(-3) });
    const dk = await desk(0);
    const kNow = await h.lastKeyAt(0);
    check(S, '늦게 온 상담 답의 줄 키 = 지금 마지막 응답 키 (다음 본편에 실리는 키)', dk?.talk?.at(-1)?.k === kNow && dk?.talk?.at(-2)?.k === kNow, kNow, (dk?.talk ?? []).slice(-2).map((l) => l.k), 'malls.ts deskRun 주석 「상담 줄의 응답 키는 답을 저장할 때의 마지막 응답으로」 · 업데이트내역 v0.21.34 12줄');
    await deskOpenW();
    const back = await judgeBack(S, q, a, 0);
    check(S, '이 경우(같은 채팅에서 도착)는 받아 둠', back.kept, '받아 둠', { kept: back.kept }, 'malls.ts deskRun: env.current() 가 같은 채팅이면 저장');
    await shot('B2-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'B2');
  }

  // ── B3 새 채팅을 만들고 답 도착 (번호 밀림) ──
  {
    const S = 'B3 상담·새 채팅 만든 동안 답 도착';
    const q = '포인트 유효기간 있어요?', a = '연말에 소멸됩니다';
    await deskOpenW();
    if ((await deskInput())?.disabled !== false) await r.until(async () => (await deskInput())?.disabled === false, 15000);
    r.hold('desk');
    await deskSay(q);
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    const origId = (await chatAt(0)).id;
    await t.newChat(); await sleep(1200);
    const list = await h.chatList();
    note(S, '새 채팅 뒤 목록', list);
    r.once('desk', `<say>${a}</say>`, TALK_RE);
    await r.unhold('desk');
    await sleep(3000);
    const newNow = await chatAt(0);
    check(S, '새 채팅에 상담 상태가 안 생김 ($bm_desk 없음)', !newNow?.ss?.$bm_desk, '없음', String(newNow?.ss?.$bm_desk ?? '').slice(0, 300), '맞는 줄 없음 (malls.ts deskRun 「같은 채팅을 보고 있을 때만 저장」)');
    check(S, '새 채팅에 답 글이 안 들어감', !JSON.stringify(newNow?.ss ?? {}).includes(a), '없음', '');
    const oi = list.findIndex((c) => c.id === origId);
    note(S, '원래 채팅(밀린 번호) 상담 끝', { oi, tail: (await desk(oi))?.talk?.slice(-3) });
    await shot('B3-newchat');
    await t.switchChat(oi); await sleep(1200);
    await deskOpenW();
    const back = await judgeBack(S, q, a, oi);
    await shot('B3-back');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await judgeNextMain(S, q, a, back, 'B3');
  }
  note('끝', '콘솔 오류 (플러그인 [goei])', t.errors.filter((e) => /goei/.test(e)).slice(-10));
  all.push(...r.results.map((x) => ({ site: 'bm', ...x })));
  r.writeResults(`${OUT}결과-away-bm-${TAG}.json`);
  await r.stop();
  await t.close();
}

if (on('cos')) await runCos().catch((e) => { console.error('cos 판 멈춤', e); all.push({ site: 'cos', step: '멈춤', what: String(e?.stack ?? e).slice(0, 600), ok: false }); });
if (on('bm')) await runBm().catch((e) => { console.error('bm 판 멈춤', e); all.push({ site: 'bm', step: '멈춤', what: String(e?.stack ?? e).slice(0, 600), ok: false }); });
const pass = all.filter((x) => !x.note && x.ok).length, n = all.filter((x) => !x.note).length;
writeFileSync(`${OUT}결과-away${TAG === 'r1' ? '' : '-' + TAG}.json`, JSON.stringify({ at: new Date().toISOString(), tag: TAG, pass, all: n, results: all }, null, 1));
console.log(`모두 ${pass}/${n}`);
process.exit(0);
