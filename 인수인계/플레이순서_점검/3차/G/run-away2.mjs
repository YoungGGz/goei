// 3차 점검 G · 쇼핑 갈래 「다른 채팅 다녀오기」 2: (가) 우주몰 장바구니 결제 중·뒤 채팅 바꾸기·새 채팅 (나) 망상홈쇼핑 전화 상담원 답 오는 중 다른 채팅.
// 실제 리스AI(996a553) + 가짜 모델 서버(이 칸 전용 8795).
// 사용: source /tmp/t2/t2-env.sh && FAKE_URL=http://192.0.2.2:8795 node 인수인계/플레이순서_점검/3차/G/run-away2.mjs [pay|hs] [tag]
// 기준: ../E/run.mjs 「E8d」, ./run-away.mjs (hold 로 답 붙잡기 → 채팅 바꾸기/새 채팅 → 답 풀기 → 돌아와 보기). 단계마다 기대값·근거 줄을 먼저 적고(check 의 expect·row) 대조한다.
// 출력: out/AWAY2-<태그>-*.txt·png, 결과 out/결과-away2[-태그].json. 붙잡기 답 파일은 out/.away-dyn/ (다른 G 대본과 안 겹치게).
import { openRun, clickChatCard, sleep, STATES, msgsText, userText } from '../E/lib.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const DYN = `${OUT}.away-dyn`;
mkdirSync(DYN, { recursive: true });
const W = Number(process.env.W || 1280), H = Number(process.env.H || 800);
const args = process.argv.slice(2);
const want = new Set(args.filter((a) => a === 'pay' || a === 'hs'));
const TAG = args.find((a) => a !== 'pay' && a !== 'hs') || 'r1';
const on = (p) => !want.size || want.has(p);
const all = [];
// 망상홈쇼핑 편성 대본은 G/run.mjs 의 것을 그대로 읽어 쓴다 (그 파일은 읽기만)
const HS_SHOW = /const HS_SHOW = `([\s\S]*?)`;/.exec(readFileSync(new URL('./run.mjs', import.meta.url), 'utf8'))[1];

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
const COS_SHELF2 = `<owner>
새것 왔다.
</owner>
<shelf>
식지 않는 차|8000|소모1|음식/차/tea|0.3|마신다. 식지 않는다.|따뜻함||?
접히는 계단|26000|사용|도구/계단/stairs|1.8|편다. 어디든 위로 간다.|높은 곳||?
</shelf>`;
const cosAns = (txt) => `<owner>\n${txt}\n</owner>\n<change mode="none">\n</change>`;
const opAns = (txt) => `<operator>\n${txt}\n</operator>\n<terms>\nnone\n</terms>`;
const LEAK_KEYS = /^\$(cos_|bm_|st_wallet|st_items|hs_)/;

function helpers(r) {
  const { t } = r;
  const cnt = (s, re) => (String(s).match(re) || []).length;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const J = (s) => { try { return JSON.parse(s || 'null'); } catch { return null; } };
  const chatAt = (i) => t.R(async (i) => {
    const st = await import('/src/ts/stores.svelte.ts');
    const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
    const ch = st.DBState.db.characters[ci].chats[i];
    return ch ? { i, id: ch.id, name: ch.name, n: ch.message.length, ss: { ...(ch.scriptstate ?? {}) } } : null;
  }, i);
  const chatList = async () => (await t.chatState()).chats;
  /** 원래 채팅 말고 어느 채팅에든 글(답)·변수가 들어갔나: 번호가 밀리면 새 채팅이 아니라 그 번호에 온 다른 채팅에 쓸 수 있다 */
  const elsewhere = (exceptId, text) => t.R(async ({ exceptId, text }) => {
    const st = await import('/src/ts/stores.svelte.ts');
    const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
    return st.DBState.db.characters[ci].chats.map((c, i) => ({ i, id: c.id, name: c.name, has: JSON.stringify(c.scriptstate ?? {}).includes(text) })).filter((x) => x.id !== exceptId && x.has);
  }, { exceptId, text });
  const idxOf = async (id) => (await chatList()).findIndex((c) => c.id === id);
  const byId = async (id) => chatAt(await idxOf(id));
  /** 몰·가계부·소지품·홈쇼핑 변수만 뽑아 비교용 글로 */
  const leakSnap = (c) => JSON.stringify(Object.fromEntries(Object.entries(c?.ss ?? {}).filter(([k]) => LEAK_KEYS.test(k)).sort()));
  const leakKeys = (c) => Object.keys(c?.ss ?? {}).filter((k) => LEAK_KEYS.test(k));
  const items = (c) => (J(c?.ss?.$st_items)?.list ?? []).filter((x) => !x.gone && !x.soldAt && !x.outAt).map((x) => x.name);
  const wlog = (c) => J(c?.ss?.$st_wallet)?.log ?? [];
  const openNet = async (site) => {
    const sel = site === 'cos' ? '.ms-cos' : '.ms-bm';
    if (await t.feval((s) => !!document.querySelector(s), sel)) return true;
    if (!(await t.feval(() => !!document.querySelector('.br')))) { await r.fclickAction('nav-tab', 'net'); await sleep(700); }
    if (await t.feval((s) => !!document.querySelector(s), sel)) return true;
    if (!(await r.fclickAction('br-go', site))) await r.fclickAction('br-site', site);
    await sleep(1200);
    return t.feval((s) => !!document.querySelector(s), sel);
  };
  const shot = (name) => t.page.screenshot({ path: `${OUT}AWAY2-${TAG}-${name}.png` }).catch(() => {});
  const save = (name, recs) => { const p = `${OUT}AWAY2-${TAG}-${name}.txt`; writeFileSync(p, recs.filter(Boolean).map((x) => `######## seq ${x.seq} ${x.route}/${x.kind} stream=${x.stream}\n${msgsText(x.body)}`).join('\n\n')); return p; };
  const mainTurn = async (say, reply, o = {}) => {
    r.once('main', `${reply}\n\n${r.status(o)}`);
    const s = r.lastSeq();
    await t.send(say);
    await sleep(3000);
    return r.since(s, 'main')[0] ?? null;
  };
  return { cnt, esc, J, chatAt, chatList, elsewhere, idxOf, byId, leakSnap, leakKeys, items, wlog, openNet, shot, save, mainTurn };
}

// ═════════════════════ (가) 우주몰 장바구니 결제 ═════════════════════
async function runPay() {
  const r = await openRun({ out: DYN, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const h = helpers(r);
  const { cnt, esc, J, chatAt, byId, leakSnap, leakKeys, items, wlog, openNet, shot, save, mainTurn } = h;
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
  await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
  const list0 = await h.chatList();
  const ORIG = list0[0].id, OTHER = list0[1].id;
  note('P0 준비', '채팅 목록 (0번=이 판, 1번=시작된 다른 채팅)', list0);
  await t.openWindow(); await sleep(1200);
  check('P0 준비', '우주몰 창 열림', await openNet('cos'), true, '', 'G-01');
  r.once('cos', COS_SHELF);
  let s = r.lastSeq();
  await r.fclickAction('mall-refresh');
  await r.until(async () => r.since(s, 'cos').length, 15000);
  await sleep(1500);
  const idOf = async (n) => (J((await byId(ORIG)).ss.$cos_shop)?.items ?? []).find((x) => x.name === n && !x.sold)?.id;
  const bal = (c) => wlog(c).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const paid = (c, n) => wlog(c).filter((e) => String(e.memo ?? '').includes(n)).length;
  const toCart = async (n) => { await r.fclickAction('mall-page', ''); await r.fclickAction('mall-cart', await idOf(n)); await r.fclickAction('mall-page', 'cart'); await sleep(400); await r.fclickAction('mall-order'); await sleep(600); };
  const payOpen = () => t.feval(() => !!document.querySelector('[data-action="mall-pay"]'));
  check('P0 준비', '진열에 대본 3개', !!(await idOf('반짝 걸음 구두약')) && !!(await idOf('말 듣는 우산')) && !!(await idOf('녹슬지 않는 못')), '3개', (J((await byId(ORIG)).ss.$cos_shop)?.items ?? []).map((x) => x.name), 'G-03');

  // ── P1 입금 창을 연 채 다른 채팅으로 바꾸고 「입금」 누름 ──
  {
    const S = 'P1 입금 창 연 채 다른 채팅으로';
    await toCart('반짝 걸음 구두약');
    check(S, '입금 창 열림', await payOpen(), true, '', 'G-05');
    const o0 = await byId(OTHER), m0 = await byId(ORIG);
    await t.switchChat(await h.idxOf(OTHER)); await sleep(1500);
    const still = await payOpen().catch(() => false);
    note(S, '바꾼 뒤 플러그인 창: 입금 창 그대로인가 · 창 글', { still, txt: (await r.ftext('.gx').catch(() => '')).slice(0, 160) });
    await shot('P1-switched');
    if (still) { await r.fclickAction('mall-pay'); await sleep(1500); }
    const o1 = await byId(OTHER), m1 = await byId(ORIG);
    check(S, '다른 채팅의 몰·가계부·소지품 변수 그대로', leakSnap(o1) === leakSnap(o0), '그대로', { before: leakKeys(o0), after: leakKeys(o1), items: items(o1).slice(-3), bal: bal(o1) - bal(o0) }, '맞는 줄 없음 (결제는 연 채팅 ctx 에 씀: malls.ts mall-pay → buy(ctx))');
    note(S, '원래 채팅: 구두약 산 횟수·잔고 변화 (입금을 눌렀다면 원래 채팅에서 결제됨)', { pressed: still, paid: paid(m1, '반짝 걸음 구두약'), items: items(m1).filter((n) => n.includes('구두약')), dBal: bal(m1) - bal(m0) });
    check(S, '두 번 결제 안 됨 (구두약 가계부 줄 ≤ 1)', paid(m1, '반짝 걸음 구두약') <= 1, '≤1', paid(m1, '반짝 걸음 구두약'), 'G-05');
    await t.closeWindow();
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    await t.openWindow(); await sleep(1000); await openNet('cos');
    if (paid(await byId(ORIG), '반짝 걸음 구두약') === 0) {
      note(S, '돌아와서 장바구니·입금 창', { cartPage: (await r.ftext('.ms-cos')).slice(0, 160), pay: await payOpen() });
      await toCart('반짝 걸음 구두약'); await r.fclickAction('mall-pay'); await sleep(1500);
    }
    const m2 = await byId(ORIG);
    check(S, '끝에 원래 채팅에 구두약 한 번 (가계부 1줄·소지품 1개)', paid(m2, '반짝 걸음 구두약') === 1 && items(m2).filter((n) => n === '반짝 걸음 구두약').length === 1, '1·1', { paid: paid(m2, '반짝 걸음 구두약'), items: items(m2).filter((n) => n.includes('구두약')) }, 'G-05');
  }

  // ── P1n 입금 창을 연 채 새 채팅 만들고 「입금」 누름 (새 채팅은 0번에 끼워져 번호가 밀림) ──
  {
    const S = 'P1n 입금 창 연 채 새 채팅';
    await toCart('말 듣는 우산');
    check(S, '입금 창 열림', await payOpen(), true, '', 'G-05');
    const m0 = await byId(ORIG);
    await t.newChat(); await sleep(1500);
    const NEW = (await h.chatList())[0].id;
    const n0 = await byId(NEW);
    const still = await payOpen().catch(() => false);
    note(S, '새 채팅 뒤 플러그인 창: 입금 창 그대로인가', { still, txt: (await r.ftext('.gx').catch(() => '')).slice(0, 160) });
    if (still) { await r.fclickAction('mall-pay'); await sleep(1500); }
    note(S, '입금 누른 뒤 창 안내', (await r.ftext('.gx').catch(() => '')).slice(0, 200));
    await shot('P1n-paid');
    const n1 = await byId(NEW), m1 = await byId(ORIG);
    check(S, '새 채팅에 몰·가계부·소지품 변수가 안 생김', leakKeys(n1).length === 0, '없음', { before: leakKeys(n0), after: leakKeys(n1), items: items(n1), wallet: wlog(n1).slice(-2) }, '맞는 줄 없음 (G-라 와 같은 번호 길: malls.ts chatKey·mall-pay buy(ctx))');
    note(S, '원래 채팅(밀린 번호): 우산 결제 여부', { pressed: still, paid: paid(m1, '말 듣는 우산'), dBal: bal(m1) - bal(m0), items: items(m1).filter((n) => n.includes('우산')) });
    await t.closeWindow();
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    await t.openWindow(); await sleep(1000); await openNet('cos');
    if (paid(await byId(ORIG), '말 듣는 우산') === 0) { await toCart('말 듣는 우산'); await r.fclickAction('mall-pay'); await sleep(1500); }
    const m2 = await byId(ORIG);
    check(S, '끝에 원래 채팅에 우산 한 번', paid(m2, '말 듣는 우산') === 1 && items(m2).filter((n) => n === '말 듣는 우산').length === 1, '1·1', { paid: paid(m2, '말 듣는 우산'), items: items(m2).filter((n) => n.includes('우산')) }, 'G-05');
  }

  // ── P2 결제 직후 새 채팅 ──
  {
    const S = 'P2 결제 직후 새 채팅';
    await toCart('녹슬지 않는 못');
    await r.fclickAction('mall-pay'); await sleep(300);   // 결제 직후 (화면 다시 그리기·소지품 상자 갱신이 남아 있을 틈)
    await t.newChat(); await sleep(2500);
    const NEW = (await h.chatList())[0].id;
    const n1 = await byId(NEW), m1 = await byId(ORIG);
    check(S, '새 채팅에 몰·가계부·소지품 변수가 안 생김', leakKeys(n1).length === 0, '없음', { keys: leakKeys(n1), items: items(n1), wallet: wlog(n1).slice(-2) }, '맞는 줄 없음 (G-라 와 같은 번호 길)');
    check(S, '원래 채팅에 못 한 번 (가계부 1줄·소지품 1개)', paid(m1, '녹슬지 않는 못') === 1 && items(m1).filter((n) => n === '녹슬지 않는 못').length === 1, '1·1', { paid: paid(m1, '녹슬지 않는 못'), items: items(m1) }, 'G-05');
    await t.closeWindow();
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
  }

  // ── P3 운영자 문의 답이 오는 중 결제 (같은 채팅에서 답 도착) ──
  {
    const S = 'P3 문의 답 오는 중 결제';
    await t.openWindow(); await sleep(1000); await openNet('cos');
    // 진열 새로 받기 (주소줄 ↻)
    r.once('cos', COS_SHELF2);
    s = r.lastSeq();
    await r.fclickAction('br-reload');
    await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(1500);
    check(S, '새 진열 받음 (차·계단)', !!(await idOf('식지 않는 차')) && !!(await idOf('접히는 계단')), '있음', (J((await byId(ORIG)).ss.$cos_shop)?.items ?? []).map((x) => `${x.name}${x.sold ? '(팔림)' : ''}`), 'G-07 (↻)');
    const q = '차는 몇 도예요?', a = '언제나 칠십 도다.';
    await r.fclickAction('mall-ask', ''); await sleep(800);
    r.hold('cos');
    await t.F().fill('.cs-askwin [data-input="mall-say"]', q); await r.fclickAction('mall-say');
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close');
    await toCart('식지 않는 차');
    await r.fclickAction('mall-pay'); await sleep(1200);
    const m0 = await byId(ORIG);
    check(S, '답 기다리는 중 결제됨', paid(m0, '식지 않는 차') === 1, 1, paid(m0, '식지 않는 차'), 'G-05');
    r.once('cos', cosAns(a));
    await r.unhold('cos'); await sleep(2500);
    const m1 = await byId(ORIG);
    const cs = J(m1.ss.$cos_shop);
    check(S, '답이 온 뒤에도 결제 그대로 (차 팔림·소지품·가계부 1줄)', !!(cs?.items ?? []).find((x) => x.name === '식지 않는 차')?.sold && items(m1).includes('식지 않는 차') && paid(m1, '식지 않는 차') === 1, '그대로', { sold: (cs?.items ?? []).find((x) => x.name === '식지 않는 차')?.sold, paid: paid(m1, '식지 않는 차') }, 'malls.ts ask mergeLate 「기다리는 동안 결제·판매 취소한 것을 되돌리지 않게」');
    check(S, '문의 대화에 내 말·답 한 번씩', (cs?.talk ?? []).filter((l) => l.text === q).length === 1 && (cs?.talk ?? []).filter((l) => l.text === a).length === 1, '1·1', (cs?.talk ?? []).slice(-2), '업데이트내역 v0.21.34 12줄');
    await t.closeWindow();
    const m = await mainTurn('P3 휴대폰을 내려놓는다.', '택배 상자가 발치에 놓였다. (P3)');
    save('P3-본편', [m]);
    const mt = m ? msgsText(m.body) : '';
    const tt = (/^This turn:.*$/m.exec(mt) || [''])[0];
    note(S, '본편 This turn', tt.slice(0, 500));
    check(S, '다음 본편: 이 판에서 산 넷(구두약·우산·못·차) 각 한 번', ['반짝 걸음 구두약', '말 듣는 우산', '녹슬지 않는 못', '식지 않는 차'].every((n) => cnt(tt, new RegExp(esc(n), 'g')) === 1), '각 1', tt.slice(0, 400), 'G-05·G-34');
    check(S, '다음 본편: 문의 내 말·답 각 한 번', cnt(mt, new RegExp(esc(q), 'g')) === 1 && cnt(mt, new RegExp(esc(a), 'g')) === 1, '각 1', (/[^\n]{0,60}우주 쇼핑몰[^\n]{0,200}/.exec(mt.replace(tt, '')) || [''])[0], 'core/malls.ts mallEvents');
  }

  // ── P4 문의 답 오는 중 결제 → 새 채팅 → 답 도착 ──
  {
    const S = 'P4 문의 답 오는 중 결제 뒤 새 채팅';
    await t.openWindow(); await sleep(1000); await openNet('cos');
    const q = '계단 몇 칸이에요?', a = '필요한 만큼이다.';
    await r.fclickAction('mall-ask', ''); await sleep(800);
    r.hold('cos');
    await t.F().fill('.cs-askwin [data-input="mall-say"]', q); await r.fclickAction('mall-say');
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close');
    await toCart('접히는 계단');
    await r.fclickAction('mall-pay'); await sleep(1200);
    await t.closeWindow();
    await t.newChat(); await sleep(1500);
    const NEW = (await h.chatList())[0].id;
    r.once('cos', cosAns(a));
    await r.unhold('cos'); await sleep(3000);
    const n1 = await byId(NEW), m1 = await byId(ORIG);
    check(S, '새 채팅에 가계부·소지품 변수가 안 생김', !n1.ss.$st_wallet && !n1.ss.$st_items, '없음', { keys: leakKeys(n1), items: items(n1), wallet: wlog(n1).slice(-2) }, '맞는 줄 없음');
    check(S, '새 채팅에 몰 변수가 안 생김 ($cos_shop)', !n1.ss.$cos_shop, '없음', String(n1.ss.$cos_shop ?? '').slice(0, 200), '맞는 줄 없음 (G-라)');
    check(S, '원래 채팅: 계단 결제 그대로 (팔림·소지품·가계부 1줄)', items(m1).includes('접히는 계단') && paid(m1, '접히는 계단') === 1, '그대로', { paid: paid(m1, '접히는 계단'), items: items(m1) }, 'G-05');
    note(S, '원래 채팅 문의 대화 끝', (J(m1.ss.$cos_shop)?.talk ?? []).slice(-2));
    const els = await h.elsewhere(ORIG, a);
    check(S, '원래 채팅 말고 어느 채팅에도 답 글이 안 들어감 (밀린 번호 자리의 다른 채팅 포함)', els.length === 0, '없음', { els, list: await h.chatList(), origIdx: await h.idxOf(ORIG) }, '맞는 줄 없음 (G-라: 번호로 맞춤)');
    await shot('P4-newchat');
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    await t.openWindow(); await sleep(1000); await openNet('cos');
    await r.fclickAction('mall-ask', ''); await sleep(900);
    const talk = J((await byId(ORIG)).ss.$cos_shop)?.talk ?? [];
    const inp = await t.feval(() => document.querySelector('.cs-askwin [data-input="mall-say"]')?.value ?? null).catch(() => null);
    const kept = talk.filter((l) => l.text === q).length === 1 && talk.filter((l) => l.text === a).length === 1 && !inp;
    const dropped = !talk.some((l) => l.text === q || l.text === a) && inp === q;
    check(S, '돌아온 뒤 받아 둠 또는 버림(내 말 입력칸) — 반쯤 안 남음', kept || dropped, '둘 중 하나', { kept, dropped, inp, tail: talk.slice(-2) }, '공-02 · 업데이트내역 v0.21.34 12줄');
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    const m = await mainTurn('P4 계단을 펼친다.', '계단이 위로 뻗었다. (P4)');
    save('P4-본편', [m]);
    const mt = m ? msgsText(m.body) : '';
    const tt = (/^This turn:.*$/m.exec(mt) || [''])[0];
    check(S, '다음 본편: 계단 산 일 한 번', cnt(tt, /접히는 계단/g) === 1, 1, tt.slice(0, 300), 'G-05');
    check(S, '다음 본편: 답 못 받은 문의는 안 감(버렸으면) / 한 번(받아 뒀으면)', cnt(mt, new RegExp(esc(q), 'g')) === (kept ? 1 : 0), kept ? 1 : 0, cnt(mt, new RegExp(esc(q), 'g')), 'core/malls.ts mallEvents');
  }
  // ── P5 대조: 결제 없이 문의 답 오는 중 새 채팅 (run-away.mjs A3 와 같은 순서) — P4 와 비교 ──
  {
    const S = 'P5 대조·결제 없이 새 채팅';
    const q = '차 한 잔 더 있나요?', a = '없다. 하나뿐이었다.';
    await t.openWindow(); await sleep(1000); await openNet('cos');
    await r.fclickAction('mall-ask', ''); await sleep(800);
    r.hold('cos');
    await t.F().fill('.cs-askwin [data-input="mall-say"]', q); await r.fclickAction('mall-say');
    await r.until(async () => r.held().length, 10000);
    await r.fclickAction('mall-ask-close'); await t.closeWindow();
    await t.newChat(); await sleep(1500);
    const NEW = (await h.chatList())[0].id;
    r.once('cos', cosAns(a));
    await r.unhold('cos'); await sleep(3000);
    const n1 = await byId(NEW);
    check(S, '새 채팅에 몰 변수가 안 생김 ($cos_shop)', !n1.ss.$cos_shop, '없음', { keys: leakKeys(n1), talk: (J(n1.ss.$cos_shop)?.talk ?? []).slice(-2) }, '맞는 줄 없음 (G-라)');
    const els = await h.elsewhere(ORIG, a);
    check(S, '원래 채팅 말고 어느 채팅에도 답 글이 안 들어감 (밀린 번호 자리의 다른 채팅 포함)', els.length === 0, '없음', { els, list: await h.chatList(), origIdx: await h.idxOf(ORIG) }, '맞는 줄 없음 (G-라: 번호로 맞춤)');
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
  }
  note('끝', '콘솔 오류 (error)', t.errors.filter((e) => /^error/.test(e) && !/displayData/.test(e)).slice(-8));
  all.push(...r.results.map((x) => ({ part: 'pay', ...x })));
  r.writeResults(`${OUT}결과-away2-pay-${TAG}.json`);
  await r.stop(); await t.close();
}

// ═════════════════════ (나) 망상홈쇼핑 전화 상담원 ═════════════════════
async function runHs() {
  const r = await openRun({ out: DYN, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const h = helpers(r);
  const { cnt, esc, J, byId, leakSnap, leakKeys, items, wlog, shot, save, mainTurn } = h;
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
  await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
  const list0 = await h.chatList();
  const ORIG = list0[0].id, OTHER = list0[1].id;
  note('H0 준비', '채팅 목록', list0);
  const updaterHs = (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name: '망상홈쇼핑', owner: '@web', m } }) : '{}'; };
  r.on('hs', HS_SHOW);   // 편성은 늘 같은 대본
  // 접속: 본편 응답에 [shop: 망상홈쇼핑|@web] → 카드. 접속은 본편이 넘어가면 꺼진다(「신호 없음」, d1 판에서 봄) → 갈래마다 다시 접속
  const connect = async (nm) => {
    const offU = r.on('updater', updaterHs);
    r.once('main', `휴대폰이 혼자 켜졌다. 「망상홈쇼핑 라이브」가 붉은 화면을 띄웠다. (${nm})\n[shop: 망상홈쇼핑|@web]\n\n${r.status()}`);
    await t.send(`${nm} 휴대폰을 본다.`); await sleep(6000);
    offU();
  };
  await connect('H0');
  const cardSel = '[data-goei-shop="hs"]';
  const openHs = async () => { await clickChatCard(t, cardSel); await sleep(2500); await r.until(async () => t.feval(() => !!document.querySelector('.hs')).catch(() => false), 15000); await sleep(800); };
  await openHs();
  check('H0 준비', '망상홈쇼핑 단독 창·편성', await t.feval(() => !!document.querySelector('.hs')), true, (await r.ftext('.gx').catch(() => '')).slice(0, 120), 'G-17');
  const hsLog = async (id = ORIG) => String((await byId(id)).ss.$hs_log ?? '');
  const callTxt = () => r.ftext('.hs-callog').catch(() => '');
  const opInput = () => t.feval(() => { const i = document.querySelector('[data-input="hs-op"]'); return i ? { value: i.value, disabled: i.disabled } : null; }).catch(() => null);
  const callOpen = async (S = '전화') => {
    r.once('hsop', opAns('네에, 주문 전화 감사합니다.'));
    await r.fclickAction('hs-pop', 'call'); await sleep(2500); await r.fclickAction('hs-pay', 'talk'); await sleep(400);
    const ok = !!(await opInput());
    if (!ok) { note(S, '전화 창에 말 칸 없음 — 창 글', { gx: (await r.ftext('.gx').catch(() => '')).slice(0, 400), show: (() => { return null; })() }); await shot(`${S.split(' ')[0]}-nocall`); r.dropOnce('hsop'); }
    return ok;
  };
  const callClose = async () => { await r.fclickAction('hs-pop', ''); await sleep(300); await t.closeWindow(); };
  const ask = async (q) => { r.hold('hsop'); await t.F().fill('[data-input="hs-op"]', q); await r.fclickAction('hs-op'); await r.until(async () => r.held().length, 10000); };
  await callOpen();
  note('H0 준비', '전화 창·첫 말', (await callTxt()).slice(0, 120));
  /** 돌아와서 판정: 통화에 내 말+답(받아 둠) 또는 내 말이 입력칸(버림). 시청 기록($hs_log)도 둘 다 있거나 둘 다 없음 */
  const judge = async (S, q, a) => {
    const log = await hsLog();
    const ct = await callTxt();
    const inp = await opInput();
    const lq = cnt(log, new RegExp(esc(q), 'g')), la = cnt(log, new RegExp(esc(a), 'g'));
    check(S, '시청 기록에 반쯤 안 남음 (내 말·답 둘 다 한 번 또는 둘 다 없음)', (lq === 1 && la === 1) || (lq === 0 && la === 0), '1·1 또는 0·0', { lq, la }, '공-02 · G-24 · G-25 (주고받은 말은 같이 적음: homeshop.ts operatorAsk saveLog(talked))');
    const reach = !!(await t.feval(() => !!document.querySelector('.hs-pop')).catch(() => false));
    note(S, '돌아와 연 전화 창 (본편이 넘어가 신호가 꺼졌으면 창이 안 열림)', { reach, call: ct.slice(-200), input: inp });
    const kept = (reach ? ct.includes(q) && ct.includes(a) : true) && lq === 1 && la === 1;
    const dropped = !ct.includes(a) && la === 0 && inp?.value === q;
    check(S, '돌아온 뒤: 통화에 답이 붙음(받아 둠) 또는 내 말이 입력칸으로(버림)', kept || dropped, '둘 중 하나', { kept, dropped, call: ct.slice(-160), input: inp, lq, la }, '공-02 (조정자 기대값) · 업데이트내역 v0.21.34 12줄은 상점·우주몰·포인트몰만 · G-28 「통화는 저장 안 함」');
    return { kept: lq === 1 && la === 1, lq, la, ct, inp };
  };
  const nextMain = async (S, q, a, kept, nm) => {
    const m = await mainTurn(`${nm} 주위를 둘러본다.`, `휴대폰 화면이 깜빡였다. (${nm})`);
    save(`${nm}-본편`, [m]);
    const mt = m ? msgsText(m.body) : '';
    check(S, `다음 본편: 통화 내용 ${kept ? '한 번' : '안 감'} (내 말 ${kept ? 1 : 0}·답 ${kept ? 1 : 0})`, cnt(mt, new RegExp(esc(q), 'g')) === (kept ? 1 : 0) && cnt(mt, new RegExp(esc(a), 'g')) === (kept ? 1 : 0), kept ? '1·1' : '0·0', { q: cnt(mt, new RegExp(esc(q), 'g')), a: cnt(mt, new RegExp(esc(a), 'g')), line: (/[^\n]{0,80}좀 더|[^\n]{0,60}망상홈쇼핑[^\n]{0,200}/.exec(mt) || [''])[0] }, 'G-24 (통화 내용은 다음 본편에)');
    // 시청 기록은 「넘기는 기간」(기본 0 = 제한 없음, core/hslog.ts HS_MAIN_SET.turns) 동안 참고 기록으로 매 턴 간다 → 그다음 본편에도 있을 수 있음. 겹쳐 두 번 실리지만 않으면 됨
    const m2 = await mainTurn(`${nm} 하품한다.`, `밤이 깊었다. (${nm}b)`);
    const mt2 = m2 ? msgsText(m2.body) : '';
    check(S, '그다음 본편: 같은 통화가 겹쳐 두 번 실리지 않음 (시청 기록은 기간 동안 매 턴 감)', cnt(mt2, new RegExp(esc(q), 'g')) <= 1, '≤1', cnt(mt2, new RegExp(esc(q), 'g')), 'G-24 · core/hslog.ts 「넘기는 기간」 기본 제한 없음');
  };

  // ── H1 창 닫고 다른 채팅에 있는 동안 상담원 답 도착 ──
  {
    const S = 'H1 상담원·다른 채팅에 있는 동안 답 도착';
    const q = '손전등 건전지 들어 있어요?', a = '건전지는 필요 없어요, 고객님.';
    const o0 = await byId(OTHER);
    await ask(q);
    await callClose();
    await t.switchChat(await h.idxOf(OTHER)); await sleep(1000);
    r.once('hsop', opAns(a));
    await r.unhold('hsop'); await sleep(2500);
    const o1 = await byId(OTHER);
    check(S, '다른 채팅에 홈쇼핑·몰·가계부·소지품 변수 그대로', leakSnap(o1) === leakSnap(o0), '그대로', { before: leakKeys(o0), after: leakKeys(o1) }, '맞는 줄 없음 (saveLog: sameProgram 거름)');
    check(S, '다른 채팅에 답 글이 어디에도 안 들어감', !JSON.stringify(o1.ss).includes(a), '없음', '');
    note(S, '원래 채팅 시청 기록에 답이 적혔나 (다른 채팅에 있는 동안)', { q: (await hsLog()).includes(q), a: (await hsLog()).includes(a) });
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    await openHs(); r.once('hsop', opAns('여보세요, 망상홈쇼핑입니다.')); await r.fclickAction('hs-pop', 'call'); await sleep(2000); r.dropOnce('hsop');
    const b = await judge(S, q, a);
    await shot('H1-back');
    await callClose();
    await nextMain(S, q, a, b.kept, 'H1');
  }

  // ── H1b 다른 채팅에서 플러그인 창을 연 동안 답 도착 ──
  {
    const S = 'H1b 상담원·다른 채팅에서 창 연 동안 답 도착';
    const q = '두 개 사면 깎아 주나요?', a = '한 분께 하나씩만 드려요.';
    await connect('H1b'); if (!(await (async () => { await openHs(); return callOpen(S); })())) throw new Error(S + ': 전화 창에 말 칸 없음');
    const o0 = await byId(OTHER);
    await ask(q);
    await callClose();
    await t.switchChat(await h.idxOf(OTHER)); await sleep(1000);
    await t.openWindow(); await sleep(1500);
    note(S, '다른 채팅에서 연 창', (await r.ftext('.gx').catch(() => '')).slice(0, 100));
    r.once('hsop', opAns(a));
    await r.unhold('hsop'); await sleep(2500);
    const o1 = await byId(OTHER);
    check(S, '다른 채팅에 홈쇼핑·몰·가계부·소지품 변수 그대로', leakSnap(o1) === leakSnap(o0), '그대로', { before: leakKeys(o0), after: leakKeys(o1) }, '맞는 줄 없음');
    check(S, '다른 채팅에 답 글이 어디에도 안 들어감', !JSON.stringify(o1.ss).includes(a), '없음', '');
    await t.closeWindow();
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    await openHs(); r.once('hsop', opAns('여보세요, 망상홈쇼핑입니다.')); await r.fclickAction('hs-pop', 'call'); await sleep(2000); r.dropOnce('hsop');
    const b = await judge(S, q, a);
    await shot('H1b-back');
    await callClose();
    await nextMain(S, q, a, b.kept, 'H1b');
  }

  // ── H2 돌아온 뒤 답 도착 (그사이 본편 한 턴) ──
  {
    const S = 'H2 상담원·돌아온 뒤 답 도착';
    const q = '빛이 얼마나 멀리 가요?', a = '닿는 데까지 갑니다.';
    await connect(S.split(' ')[0]); await openHs(); if (!(await callOpen(S))) throw new Error(S + ': 전화 창에 말 칸 없음');
    await ask(q);
    await callClose();
    await t.switchChat(await h.idxOf(OTHER)); await sleep(1000);
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    const mid = await mainTurn('H2 잠깐 창밖을 본다.', '바람이 불었다. (H2-mid)');
    save('H2-본편-답기다리는중', [mid]);
    check(S, '답 기다리던 동안 가는 본편에 짝 없는 내 말 안 감', cnt(mid ? msgsText(mid.body) : '', new RegExp(esc(q), 'g')) === 0, 0, '', 'G-24 · homeshop.ts operatorAsk (말은 답과 함께 저장)');
    r.once('hsop', opAns(a));
    await r.unhold('hsop'); await sleep(2500);
    note(S, '답 도착 뒤 시청 기록', { q: (await hsLog()).includes(q), a: (await hsLog()).includes(a) });
    await openHs(); r.once('hsop', opAns('여보세요, 망상홈쇼핑입니다.')); await r.fclickAction('hs-pop', 'call'); await sleep(2000); r.dropOnce('hsop');
    const b = await judge(S, q, a);
    await shot('H2-back');
    await callClose();
    await nextMain(S, q, a, b.kept, 'H2');
  }

  // ── H3 새 채팅을 만든 동안 답 도착 ──
  {
    const S = 'H3 상담원·새 채팅 만든 동안 답 도착';
    const q = '반품 되나요?', a = '저희는 반품을 받지 않아요.';
    await connect(S.split(' ')[0]); await openHs(); if (!(await callOpen(S))) throw new Error(S + ': 전화 창에 말 칸 없음');
    await ask(q);
    await callClose();
    await t.newChat(); await sleep(1500);
    const NEW = (await h.chatList())[0].id;
    r.once('hsop', opAns(a));
    await r.unhold('hsop'); await sleep(3000);
    const n1 = await byId(NEW);
    check(S, '새 채팅에 홈쇼핑·몰·가계부·소지품 변수가 안 생김', leakKeys(n1).length === 0, '없음', { keys: leakKeys(n1), log: String(n1.ss.$hs_log ?? '').slice(0, 200) }, '맞는 줄 없음 (saveLog sameProgram 거름)');
    check(S, '새 채팅에 답 글이 안 들어감', !JSON.stringify(n1.ss).includes(a), '없음', '');
    note(S, '원래 채팅 시청 기록에 답이 적혔나', { q: (await hsLog()).includes(q), a: (await hsLog()).includes(a) });
    const els = await h.elsewhere(ORIG, a);
    check(S, '원래 채팅 말고 어느 채팅에도 답 글이 안 들어감', els.length === 0, '없음', { els, origIdx: await h.idxOf(ORIG) }, '맞는 줄 없음');
    await shot('H3-newchat');
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    await openHs(); r.once('hsop', opAns('여보세요, 망상홈쇼핑입니다.')); await r.fclickAction('hs-pop', 'call'); await sleep(2000); r.dropOnce('hsop');
    const b = await judge(S, q, a);
    await shot('H3-back');
    await callClose();
    await nextMain(S, q, a, b.kept, 'H3');
  }

  // ── H4 단추로 주문 뒤 상담원 마지막 말(hsop) 오는 중 새 채팅 ──
  {
    const S = 'H4 주문 뒤 마지막 말 오는 중 새 채팅';
    const a = '주문 들어갔습니다. 상자는 이미 곁에 있어요.';
    await connect('H4'); await openHs();
    r.once('hsop', opAns('네에, 주문 전화 감사합니다.'));
    await r.fclickAction('hs-pop', 'call'); await sleep(2500);
    // 지금 부가 돈 결제가 되면 원, 안 되면(시연만 받는 부) 시연 참여로 주문
    const wonOk = await t.feval(() => { const b = document.querySelector('[data-action="hs-pay"][data-value="won"]'); return !!b && !b.disabled; }).catch(() => false);
    const PAY = wonOk ? 'won' : 'appear';
    await r.fclickAction('hs-pay', PAY); await sleep(400);
    const ob = await t.feval(() => { const b = document.querySelector('[data-action="hs-order"]'); return b ? { dis: b.disabled, txt: b.innerText } : null; }).catch(() => null);
    note(S, '주문 단추·전화 창', { ob, pop: (await r.ftext('.hs-pop').catch(() => '')).slice(0, 300), at: J((await byId(ORIG)).ss.$hs_show)?.at });
    await shot('H4-before-order');
    const m0 = await byId(ORIG);
    r.hold('hsop');
    await r.fclickAction('hs-order');
    const gotHold = await r.until(async () => r.held().length, 10000);
    note(S, '주문 뒤 마지막 말 요청 붙잡음', !!gotHold);
    const m1 = await byId(ORIG);
    const boxes = (c) => items(c).filter((n) => /택배 상자/.test(n));
    const dW = PAY === 'won' ? 1 : 0;
    check(S, `주문하자마자 원래 채팅에 상자 +1${dW ? '·가계부 +1' : ' (시연 참여: 가계부 그대로)'}`, boxes(m1).length === boxes(m0).length + 1 && wlog(m1).length === wlog(m0).length + dW, `+1·+${dW}`, { PAY, boxes: boxes(m1), wallet: wlog(m1).slice(-1) }, 'G-29');
    await callClose();
    await t.newChat(); await sleep(1500);
    const NEW = (await h.chatList())[0].id;
    r.once('hsop', `<operator>\n${a}\n</operator>`);
    await r.unhold('hsop'); await sleep(3000);
    const n1 = await byId(NEW), m2 = await byId(ORIG);
    check(S, '새 채팅에 홈쇼핑·몰·가계부·소지품 변수가 안 생김', leakKeys(n1).length === 0, '없음', { keys: leakKeys(n1), items: items(n1), wallet: wlog(n1).slice(-2) }, '맞는 줄 없음 (G-라 와 같은 번호 길: operatorSay → saveLog(ctx 번호))');
    check(S, '원래 채팅: 상자·가계부 줄 한 번 그대로', boxes(m2).length === boxes(m0).length + 1 && wlog(m2).length === wlog(m0).length + dW, `+1·+${dW}`, { boxes: boxes(m2), n: wlog(m2).length - wlog(m0).length }, 'G-29');
    note(S, '원래 채팅 시청 기록에 마지막 말이 적혔나', (await hsLog()).includes(a));
    const els = await h.elsewhere(ORIG, a);
    check(S, '원래 채팅 말고 어느 채팅에도 마지막 말이 안 들어감', els.length === 0, '없음', { els, origIdx: await h.idxOf(ORIG) }, '맞는 줄 없음');
    await shot('H4-newchat');
    await t.switchChat(await h.idxOf(ORIG)); await sleep(1200);
    const m = await mainTurn('H4 발치를 본다.', '상자 하나가 놓여 있었다. (H4)');
    save('H4-본편', [m]);
    const mt = m ? msgsText(m.body) : '';
    check(S, '다음 본편: ARRIVE 한 번', cnt(mt, /phone order has reached the protagonist/g) === 1, 1, cnt(mt, /phone order has reached the protagonist/g), 'G-29');
    note(S, '다음 본편에 상담원 마지막 말 (새 채팅 동안 도착)', cnt(mt, new RegExp(esc(a), 'g')));
  }
  note('끝', '콘솔 오류 (error)', t.errors.filter((e) => /^error/.test(e) && !/displayData/.test(e)).slice(-8));
  all.push(...r.results.map((x) => ({ part: 'hs', ...x })));
  r.writeResults(`${OUT}결과-away2-hs-${TAG}.json`);
  await r.stop(); await t.close();
}

if (on('pay')) await runPay().catch((e) => { console.error('pay 판 멈춤', e); all.push({ part: 'pay', step: '멈춤', what: String(e?.stack ?? e).slice(0, 600), ok: false }); });
if (on('hs')) await runHs().catch((e) => { console.error('hs 판 멈춤', e); all.push({ part: 'hs', step: '멈춤', what: String(e?.stack ?? e).slice(0, 600), ok: false }); });
const pass = all.filter((x) => !x.note && x.ok).length, n = all.filter((x) => !x.note).length;
writeFileSync(`${OUT}결과-away2-run-${TAG}.json`, JSON.stringify({ at: new Date().toISOString(), tag: TAG, pass, all: n, results: all }, null, 1));
console.log(`모두 ${pass}/${n}`);
process.exit(0);
