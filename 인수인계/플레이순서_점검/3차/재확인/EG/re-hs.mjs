// 재확인 EG · R10 망상홈쇼핑 전화 상담원 답이 오는 중 다른 채팅에서 창을 열거나 새 채팅을 만들면
// 사용: source /tmp/t2-EG/t2-env.sh && FAKE_URL=… OUT=<dir> node re-hs.mjs
// 원래 G/run-away2.mjs runHs(H1b·H3·H4) 순서를 읽고 줄여 다시 짬. 편성 대본은 G/run.mjs 의 HS_SHOW 를 읽기만.
// 재확인자가 본 것(판정 기준): 늦은 답이 ① 원래 채팅 시청 기록·통화에 붙는지 ② 버려지면 내 말이 입력칸으로 돌아오는지 ③ 다른 채팅에 새는지
import { openRun, clickChatCard, sleep, STATES, msgsText, userText } from './lib.mjs';
import { readFileSync } from 'node:fs';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-EG/hs';
const HS_SHOW = /const HS_SHOW = `([\s\S]*?)`;/.exec(readFileSync('/home/user/goei/인수인계/플레이순서_점검/3차/G/run.mjs', 'utf8'))[1];
const r = await openRun({ out: OUT, fake: process.env.FAKE_URL });
const { t, check, note } = r;
const opAns = (txt) => `<operator>\n${txt}\n</operator>\n<terms>\nnone\n</terms>`;
const J = (s) => { try { return JSON.parse(s || 'null'); } catch { return null; } };
const all = () => t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); return st.DBState.db.characters[ci].chats.map((ch, i) => ({ i, id: ch.id, name: ch.name, ss: { ...(ch.scriptstate ?? {}) } })); });
const idxOf = async (id) => (await all()).findIndex((c) => c.id === id);
const byId = async (id) => (await all()).find((c) => c.id === id);
const where = async (text) => (await all()).filter((c) => JSON.stringify(c.ss).includes(text)).map((c) => ({ i: c.i, id: c.id.slice(0, 8), name: c.name }));

await t.setup();
await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
let L = await all();
const ORIG = L[0].id, OTHER = L[1].id;
note('준비', '채팅', L.map((c) => [c.i, c.id.slice(0, 8), c.name]));
r.on('hs', HS_SHOW);
const updaterHs = (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name: '망상홈쇼핑', owner: '@web', m } }) : '{}'; };
const connect = async (nm) => { const off = r.on('updater', updaterHs); r.once('main', `휴대폰이 혼자 켜졌다. (${nm})\n[shop: 망상홈쇼핑|@web]\n\n${r.status()}`); await t.send(`${nm} 휴대폰을 본다.`); await sleep(6000); off(); };
const openHs = async () => { await clickChatCard(t, '[data-goei-shop="hs"]'); await sleep(2500); await r.until(async () => t.feval(() => !!document.querySelector('.hs')).catch(() => false), 15000); await sleep(800); };
const opInput = () => t.feval(() => { const i = document.querySelector('[data-input="hs-op"]'); return i ? { value: i.value, disabled: i.disabled } : null; }).catch(() => null);
const callTxt = () => r.ftext('.hs-callog').catch(() => '');
const callOpen = async () => {
  r.once('hsop', opAns('네에, 주문 전화 감사합니다.'));
  const okPop = await r.fclickAction('hs-pop', 'call');
  await r.until(() => t.feval(() => !!document.querySelector('[data-action="hs-pay"][data-value="talk"]')).catch(() => false), 15000);
  const okTalk = await r.fclickAction('hs-pay', 'talk'); await sleep(600);
  if (!(await opInput())) note('callOpen', '말 칸 없음', { okPop, okTalk, pays: await t.feval(() => [...document.querySelectorAll('[data-action="hs-pay"]')].map((b) => b.dataset.value + (b.disabled ? '(꺼짐)' : ''))).catch(() => null), pop: (await r.ftext('.hs-pop').catch(() => '')).slice(0, 300) });
  return !!(await opInput());
};
const callClose = async () => { await r.fclickAction('hs-pop', ''); await sleep(300); await t.closeWindow(); };
const ask = async (q) => { r.hold('hsop'); await t.F().fill('[data-input="hs-op"]', q); await r.fclickAction('hs-op'); await r.until(async () => r.held().length, 10000); };
const hsLog = async (id = ORIG) => String((await byId(id)).ss.$hs_log ?? '');
const backView = async (S, q, a) => {
  await t.switchChat(await idxOf(ORIG)); await sleep(1200);
  await openHs(); r.once('hsop', opAns('여보세요, 망상홈쇼핑입니다.')); await r.fclickAction('hs-pop', 'call'); await sleep(2000); r.dropOnce('hsop');
  await r.until(() => t.feval(() => !!document.querySelector('[data-action="hs-pay"][data-value="talk"]')).catch(() => false), 10000);
  await r.fclickAction('hs-pay', 'talk'); await sleep(600);
  const v = { logQ: (await hsLog()).includes(q), logA: (await hsLog()).includes(a), call: (await callTxt()).slice(-200), input: await opInput(), callHasQ: (await callTxt()).includes(q), callHasA: (await callTxt()).includes(a) };
  note(S, '원래 채팅으로 돌아와 연 전화 창·시청 기록', v);
  await t.shot(`${S.split(' ')[0]}-back`);
  await callClose();
  return v;
};

// R10-1: 다른 채팅에서 창을 연 동안 답 도착 (원래 H1b)
{
  const S = 'R10-1 다른 채팅에서 창 연 동안';
  const q = '두 개 사면 깎아 주나요?', a = '한 분께 하나씩만 드려요 재확인1.';
  await connect('R10-1'); await openHs();
  check(S, '전화 창 말 칸 있음(재현 조건)', await callOpen(), true, (await r.ftext('.gx').catch(() => '')).slice(0, 120));
  await ask(q); await callClose();
  await t.switchChat(await idxOf(OTHER)); await sleep(1000);
  await t.openWindow(); await sleep(1500);
  r.once('hsop', opAns(a));
  await r.unhold('hsop'); await sleep(3000);
  const w = await where(a);
  note(S, '답 글이 들어간 채팅', w);
  await t.closeWindow();
  const v = await backView(S, q, a);
  check(S, '재확인 기준: 늦은 답이 원래 채팅에 받아지거나, 버려지면 내 말이 입력칸으로', (v.logA && v.logQ) || v.input?.value === q, '받아 둠 또는 입력칸', v, 'G-28 · 공-02');
  check(S, '다른 채팅에 안 샘', w.every((x) => x.id === ORIG.slice(0, 8)), '없음', w);
}
// R10-2: 새 채팅을 만든 동안 답 도착 (원래 H3)
{
  const S = 'R10-2 새 채팅 만든 동안';
  const q = '반품 되나요?', a = '저희는 반품을 받지 않아요 재확인2.';
  await connect('R10-2'); await openHs();
  check(S, '전화 창 말 칸 있음(재현 조건)', await callOpen(), true, '');
  await ask(q); await callClose();
  await t.newChat(); await sleep(1500);
  r.once('hsop', opAns(a));
  await r.unhold('hsop'); await sleep(3000);
  const w = await where(a);
  note(S, '답 글이 들어간 채팅', w);
  const v = await backView(S, q, a);
  check(S, '재확인 기준: 늦은 답이 원래 채팅에 받아지거나, 버려지면 내 말이 입력칸으로', (v.logA && v.logQ) || v.input?.value === q, '받아 둠 또는 입력칸', v, 'G-28 · 공-02');
  check(S, '다른 채팅에 안 샘', w.every((x) => x.id === ORIG.slice(0, 8)), '없음', w);
}
// R10-3 대조: 창 닫고 다른 채팅에만 있는 동안 (창 안 엶)
{
  const S = 'R10-3 대조·창 안 열고 다른 채팅';
  const q = '건전지 들어 있어요?', a = '건전지는 필요 없어요 재확인3.';
  await connect('R10-3'); await openHs();
  check(S, '전화 창 말 칸 있음(재현 조건)', await callOpen(), true, '');
  await ask(q); await callClose();
  await t.switchChat(await idxOf(OTHER)); await sleep(1000);
  r.once('hsop', opAns(a));
  await r.unhold('hsop'); await sleep(3000);
  const w = await where(a);
  note(S, '답 글이 들어간 채팅', w);
  const v = await backView(S, q, a);
  check(S, '대조: 원래 채팅에 받아 둠', v.logA && v.logQ, '받아 둠', v);
}
await r.stop();
r.writeResults();
process.exit(0);
