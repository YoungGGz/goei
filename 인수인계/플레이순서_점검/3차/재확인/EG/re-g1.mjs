// 재확인 EG · R11(「받으러 가기」 단독 창에서 문의 끊김을 풀 길) · R12(「내 물건 팔기」 고른 뒤 빈 입력칸 전송)
// 사용: source /tmp/t2-EG/t2-env.sh && FAKE_URL=… OUT=<dir> node re-g1.mjs
// 원래 G/run.mjs g1 순서를 읽고 줄여 다시 짬. 기대값은 재확인자가 따로 세움:
//   R12 기대: 안내 「값을 부르거나 그냥 보내라」대로 빈칸 전송이 눌리고, 누르면 운영자에게 판매 요청이 간다
//   R11 기대: 문의 끊김(G-07 「쇼핑몰 새로고침으로 풀림」)을 그 창 안에서 풀 길(↻ 또는 상품 가져오기)이 있다
import { openRun, clickChatCard, sleep, STATES, msgsText } from './lib.mjs';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-EG/g1';
const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: Number(process.env.W || 1280), height: Number(process.env.H || 800) });
const { t, check, note } = r;
const SHELF = `<shop-identity>
sells: 이상한 물건, 맞춤 제작
never: 환불
prices: 원화
currency: -
</shop-identity>
<owner>
안녕하신가!
</owner>
<shelf>
말 듣는 우산|22000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다.|||?
녹슬지 않는 못|3000|-|도구/못/nail|0.004|박는다.|||?
</shelf>`;
const ORDER = `<owner>\n만든다 우리는. 선불이다. 다섯 시간.\n</owner>\n<change mode="none">\n</change>\n<order>안 꺼지는 손전등|30000|5|손·사용|도구/손전등/flashlight|0.31|켠다. 꺼지지 않는다.|영원한 빛|켜면 끌 수 없다</order>`;
const CLOSE = `<owner>\n더 묻지 마라.\n</owner>\n<change mode="none">\n</change>\n<closed/>`;
const chrome = () => t.feval(() => ({
  reload: [...document.querySelectorAll('[data-action="br-reload"]')].filter((e) => e.offsetParent !== null).length,
  refreshBtn: [...document.querySelectorAll('[data-action="mall-refresh"]')].filter((e) => e.offsetParent !== null).length,
  tabs: !!document.querySelector('[data-action="br-tab"]'),
  nav: [...document.querySelectorAll('[data-action="nav-tab"]')].filter((e) => e.offsetParent !== null).length,
  actions: [...new Set([...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-action')))],
}));
const sendState = () => t.feval(() => { const b = document.querySelector('.cs-askwin [data-action="mall-say"]'); const i = document.querySelector('.cs-askwin [data-input="mall-say"]'); return { disabled: b?.disabled ?? null, ph: i?.placeholder ?? '', value: i?.value ?? null }; });

await t.setup();
await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
await t.openWindow(); await sleep(1200);
await r.fclickAction('nav-tab', 'net'); await sleep(800);
if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); }
await sleep(1200);
r.once('cos', SHELF);
let s = r.lastSeq();
await r.fclickAction('mall-refresh');
await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(1500);
const cs = r.J(await r.vars(), '$cos_shop');
const ids = Object.fromEntries((cs?.items ?? []).map((x) => [x.name, x.id]));
note('준비', '진열', Object.keys(ids));
// 우산 사 두기 (팔 물건)
await r.fclickAction('mall-cart', ids['말 듣는 우산']); await r.fclickAction('mall-page', 'cart'); await sleep(400); await r.fclickAction('mall-order'); await sleep(600); await r.fclickAction('mall-pay'); await sleep(1500);
await r.fclickAction('mall-pay-close').catch(() => {});
await r.fclickAction('mall-page', '');
note('준비', '소지품', (r.J(await r.vars(), '$st_items')?.list ?? []).map((x) => x.name));

// ── R12 일반 창에서 ──
{
  const S = 'R12 일반 창';
  await r.fclickAction('mall-ask', ''); await sleep(600);
  await r.fclickAction('mall-sell-open'); await sleep(500);
  const umb = (r.J(await r.vars(), '$st_items')?.list ?? []).find((x) => x.name === '말 듣는 우산');
  await r.fclickAction('mall-sell-pick', umb?.id); await sleep(600);
  const st = await sendState();
  note(S, '고른 뒤 입력칸·전송', st);
  await t.shot('R12-sellpick');
  check(S, '기대: 안내가 「그냥 보내라」면 빈칸 전송이 눌린다', st.ph.includes('그냥 보내') ? st.disabled === false : true, '전송 켜짐', st, '안내 글 · needfill.ts');
  // 억지로 눌러 보기 (단추 꺼짐을 넘어서도 요청이 가나: 처리기도 빈 말을 거르나)
  s = r.lastSeq();
  await t.feval(() => { const b = document.querySelector('.cs-askwin [data-action="mall-say"]'); if (b) { b.disabled = false; b.click(); } });
  await sleep(2500);
  note(S, '단추를 억지로 켜고 눌렀을 때 운영자 요청 수', r.since(s, 'cos').length);
  // 비교: 장면 속 상점은 팔 물건 고른 뒤 빈칸 전송을 허용(shop.ts needAttr other) — 코드만 읽음
  await r.fclickAction('mall-ask-close');
}

// ── 맞춤 주문 → 납기 → 「받으러 가기」 카드 ──
await r.fclickAction('mall-ask', ''); await sleep(600);
r.once('cos', ORDER);
s = r.lastSeq();
await t.F().fill('.cs-askwin [data-input="mall-say"]', '안 꺼지는 손전등 만들어 줄 수 있어요?');
await r.fclickAction('mall-say');
await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(1200);
await r.fclickAction('mall-quote-accept'); await sleep(1200);
note('주문', '$cos_orders', String((await r.vars()).$cos_orders ?? '').slice(0, 200));
await r.fclickAction('mall-ask-close'); await t.closeWindow();
r.once('main', `밤이 깊었다.\n\n${r.status({ place: '관리국 숙소' })}`);
r.once('main', (body) => { const prev = /\[Previous status\][^\n]*\n(\[▣\|[^\n]*\])/.exec(msgsText(body))?.[1] ?? ''; const f = prev.slice(3, -1).split('|'); f[1] = '11:50 PM'; return `새벽이 되었다.\n\n[▣|${f.join('|')}]`; });
await t.send('잠깐 눈을 붙인다.'); await sleep(3000);
await t.send('일어난다.'); await sleep(3500);
const ready = await t.page.locator('.default-chat-screen [data-goei-shop="cos"]').count();
const label = ready ? await t.page.locator('.default-chat-screen [data-goei-shop="cos"]').last().innerText() : '';
check('R11', '「받으러 가기」 카드 있음(재현 조건)', ready >= 1, '카드', { ready, label });

// ── R11 단독 창 ──
if (ready) {
  const S = 'R11 단독 창';
  await clickChatCard(t, '[data-goei-shop="cos"]'); await sleep(1800);
  const c0 = await chrome();
  note(S, '카드로 연 창 구조', c0);
  await r.fclickAction('mall-page', 'orders'); await sleep(600);
  await r.fclickAction('mall-custom-take'); await sleep(1200);
  await r.fclickAction('mall-page', ''); await sleep(400);
  // R12 단독 창에서도
  await r.fclickAction('mall-ask', ''); await sleep(600);
  await r.fclickAction('mall-sell-open'); await sleep(500);
  const tor = (r.J(await r.vars(), '$st_items')?.list ?? []).find((x) => x.name === '안 꺼지는 손전등');
  await r.fclickAction('mall-sell-pick', tor?.id); await sleep(600);
  const st2 = await sendState();
  note('R12 단독 창', '고른 뒤 입력칸·전송', st2);
  check('R12 단독 창', '기대: 「그냥 보내라」면 빈칸 전송이 눌린다', st2.ph.includes('그냥 보내') ? st2.disabled === false : true, '전송 켜짐', st2);
  await r.fclickAction('mall-sell-open'); await sleep(300); // 팔기 닫기 (토글)
  // 문의 끊음
  r.once('cos', CLOSE);
  s = r.lastSeq();
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '그 손전등 누가 만들었어요?');
  await r.fclickAction('mall-say');
  await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(1200);
  const dis = await t.feval(() => document.querySelector('.cs-askwin [data-input="mall-say"]')?.disabled ?? null);
  check(S, '문의 끊김(입력 막힘, 재현 조건)', dis === true, true, dis);
  await r.fclickAction('mall-ask-close'); await sleep(400);
  const c1 = await chrome();
  note(S, '끊긴 뒤 창 구조', c1);
  await t.shot('R11-closed-solo');
  check(S, '기대: 그 창 안에 풀 길(주소줄 ↻ 또는 「상품 가져오기」)이 있다', c1.reload > 0 || c1.refreshBtn > 0, '있음', { reload: c1.reload, refreshBtn: c1.refreshBtn, nav: c1.nav, tabs: c1.tabs }, 'G-07 · app.ts openShop 단독 창(11-09)');
  // 다른 길: 창 닫고 상황판 → 인터넷 → 우주몰 → ↻
  await t.closeWindow(); await sleep(600); await t.openWindow(); await sleep(1200);
  const c2 = await chrome();
  note(S, '창을 닫고 다시 연 모습(단독 창이 풀렸나)', { reload: c2.reload, nav: c2.nav, tabs: c2.tabs });
  if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net'); await sleep(600); if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); await sleep(900); }
  r.once('cos', `<owner>\n새것.\n</owner>\n<shelf>\n식지 않는 차|8000|소모1|음식/차/tea|0.3|마신다.|||?\n</shelf>`);
  s = r.lastSeq();
  const okR = await r.fclickAction('br-reload');
  await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(2000);
  await r.fclickAction('mall-ask', ''); await sleep(600);
  const dis2 = await t.feval(() => document.querySelector('.cs-askwin [data-input="mall-say"]')?.disabled ?? null);
  check(S, '대조: 일반 창 ↻ 로는 풀림', okR && dis2 === false, '풀림', { okR, dis2 });
  await t.shot('R11-normal-unlocked');
}
await r.stop();
r.writeResults();
process.exit(0);
