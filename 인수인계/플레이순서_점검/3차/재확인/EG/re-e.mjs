// 재확인 EG · R06(방문 없는 상점 카드) · R07(같은 턴 사고 되판 물건). 실제 리스AI + 가짜 모델. 시작 S-상점표식
// 사용: source /tmp/t2-EG/t2-env.sh && OUT=<dir> node re-e.mjs
// 기대값은 재확인자가 따로 세움 (원래 E/run.mjs 를 읽고 순서만 빌림)
import { openRun, clickChatCard, sleep, STATES, msgsText, userText } from './lib.mjs';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-EG/e';
const r = await openRun({ out: OUT, width: Number(process.env.W || 1280), height: Number(process.env.H || 800) });
const { t, check, note } = r;
const SHELF = `<shop-identity>
sells: 성물
never: 무기
prices: 원으로 받는다
currency: -
</shop-identity>
<owner>
천천히 보세요.
</owner>
<shelf>
나무 묵주|12000|손|귀중품/묵주/rosary|0.031|올리브 나무 묵주||
작은 성경|8000|-|서류/성경/bible|0.21|손바닥만 한 신약 성경||
성수 병|기도 한 번|소모1|소모품/성수/holy water|0.105|유리병에 담은 성수||
</shelf>`;
const updaterShop = (name, owner) => (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name, owner, m } }) : '{}'; };
const shopState = async () => r.J(await r.vars(), '$st_shop');
const popup = () => r.ftext('.sh-wrap, .sh-det').catch(() => '');

await t.setup();
const ls = await t.loadState(STATES + 'S-상점표식.json');
note('준비', 'loadState', ls);
await t.waitScreenText(8, /블라렛/, 15000).catch(() => {});

// ── R06 ──
if (!process.env.ONLY7) {
  const S = 'R06';
  const v = await r.vars();
  note(S, '시작 상태 $st_shop·판단자', { st_shop: v.$st_shop ?? null, judge: v.$sh_judge ?? '(기본)' });
  const n = await t.page.locator('.default-chat-screen [data-goei-shop]').count();
  const label = n ? await t.page.locator('.default-chat-screen [data-goei-shop]').last().innerText() : '';
  check(S, '방문 상태 없음인데 카드가 그려짐(재현 조건)', !v.$st_shop && n >= 1, '$st_shop 없음 + 카드 1', { st_shop: !!v.$st_shop, cards: n, label });
  const s0 = r.lastSeq();
  await clickChatCard(t);
  await sleep(2000);
  const txt = await t.frame('.gx', 8000).then(() => r.ftext('.gx')).catch(() => '(창 없음)');
  const shopPopup = await r.fx(() => !!document.querySelector('.sh-wrap')).catch(() => null);
  const panel = await r.fx(() => { const n = document.querySelector('[data-action="nav-tab"]'); return { navTabs: [...document.querySelectorAll('[data-action="nav-tab"]')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()).slice(0, 8) }; }).catch(() => null);
  note(S, '누른 뒤 창 글(앞 400자)', txt.slice(0, 400));
  note(S, '누른 뒤 창 구조', { shopPopup, panel });
  check(S, '기대(재확인자): 방문 없는 카드를 눌러도 상황판이 뜨지 않는다', shopPopup || txt === '(창 없음)', '상점 팝업 또는 창 안 열림', { shopPopup, head: txt.slice(0, 120) }, 'app.ts openShop 11-07 사용자 주석');
  note(S, '그동안 모델 요청', r.since(s0).map((x) => x.kind));
  await t.shot('R06-card-click');
  await t.closeWindow();
  await sleep(500);
}

// ── R07 ──
{
  const S = 'R07';
  r.on('updater', updaterShop('기독교 상점', '블라렛'));
  r.once('main', `블라렛이 진열대를 가리켰다.\n\n${r.status()}`);
  let s = r.lastSeq();
  await t.send('진열대를 본다.');
  await r.until(async () => r.since(s, 'updater').length, 30000);
  await sleep(2500);
  const st0 = await shopState();
  check(S, '갱신기 판단으로 방문 생김', st0?.shop === '기독교 상점', '기독교 상점', st0?.shop);
  r.once('shop', SHELF);
  s = r.lastSeq();
  await clickChatCard(t);
  await r.until(async () => r.since(s, 'shop').length, 20000);
  await sleep(1500);
  let st = await shopState();
  const id = (n) => st.items.find((x) => x.name === n)?.id;
  note(S, '진열', st?.items?.map((x) => `${x.name}:${x.price}${x.pay ? '+' + x.pay : ''}`));
  // 흥정: 묵주 10000
  r.once('shop', `<owner>\n만 원에 드릴게요.\n</owner>\n<change mode="partial">\n~ 나무 묵주|10000\n</change>`);
  await r.fclickAction('shop-ask', id('나무 묵주'));
  await t.F().fill('[data-input="shop-say"]', '묵주 만 원에 될까요?');
  s = r.lastSeq();
  await r.fclickAction('shop-say');
  await r.until(async () => r.since(s, 'shop').length, 15000);
  await sleep(1500);
  st = await shopState();
  note(S, '흥정 뒤 묵주 값', st.items.find((x) => x.name === '나무 묵주')?.price);
  // 사기: 묵주, 성수 병(대가), 작은 성경(대조: 안 팔 것)
  for (const n of ['나무 묵주', '성수 병', '작은 성경']) { await r.fclickAction('shop-detail', id(n)); await r.fclickAction('shop-buy', id(n)); await sleep(800); }
  let v = await r.vars();
  const w0 = JSON.stringify(r.J(v, '$st_wallet'));
  note(S, '산 뒤 가계부(끝 300자)', w0.slice(-300));
  // 팔기 1: 성수 병 → 운영자 5000 제안 → 판매 단추
  const itemsId = (n) => (JSON.stringify(r.J(v, '$st_items')).match(new RegExp(`"id":"([^"]+)"[^{}]*"name":"${n}"`)) || [])[1];
  await r.fclickAction('shop-pick');
  await r.fclickAction('shop-sell-pick', itemsId('성수 병'));
  r.once('shop', `<owner>\n5,000원이면 받을게요.\n</owner>\n<change mode="none">\n</change>\n<offer>5000</offer>`);
  await t.F().fill('[data-input="shop-say"]', '이거 얼마에 사세요?');
  s = r.lastSeq();
  await r.fclickAction('shop-say');
  await r.until(async () => r.since(s, 'shop').length, 15000);
  await sleep(1500);
  await r.fclickAction('shop-sell');
  await sleep(1000);
  // 팔기 2: 묵주 → <deal/> 7000
  v = await r.vars();
  const pickOpen = await r.fx(() => !!document.querySelector('[data-action="shop-sell-pick"]'));
  if (!pickOpen) await r.fclickAction('shop-pick');
  const okPick = await r.fclickAction('shop-sell-pick', itemsId('나무 묵주'));
  note(S, '묵주 팔기 고름', { pickOpen, okPick, chip: await r.ftext('.sh-wrap').then((x) => (/판매[^\n]{0,40}/.exec(x) || [''])[0]).catch(() => '') });
  r.once('shop', `<owner>\n그럼 두고 가세요.\n</owner>\n<change mode="none">\n</change>\n<offer>7000</offer>\n<deal/>`);
  await t.F().fill('[data-input="shop-say"]', '7천 원이면 팔게요.');
  s = r.lastSeq();
  await r.fclickAction('shop-say');
  await r.until(async () => r.since(s, 'shop').length, 15000);
  await sleep(1500);
  v = await r.vars();
  const items = JSON.stringify(r.J(v, '$st_items'));
  const wal = JSON.stringify(r.J(v, '$st_wallet'));
  check(S, '판 둘은 소지품에서 빠지고 성경은 남음', !/나무 묵주/.test(items) && !/"성수 병"/.test(items) && /작은 성경/.test(items), '성경만', items.slice(0, 300));
  note(S, '가계부(끝 500자)', wal.slice(-500));
  await t.shot('R07-after-sell');
  await r.fclickAction('shop-close');
  await sleep(600);
  // 다음 본편
  r.once('main', `블라렛이 손을 흔들었다.\n\n${r.status({ place: '서울 서대문구 기독교 상점 앞' })}`);
  r.on('updater', () => JSON.stringify({ shop: null }));
  s = r.lastSeq();
  await t.send('상점을 나선다.');
  await r.until(async () => r.since(s, 'main').length, 20000);
  await sleep(2000);
  const m = r.since(s, 'main')[0];
  r.save('R07-본편1', r.since(s, 'main'));
  const mt = m ? msgsText(m.body) : '';
  const thisTurn = (/^This turn:.*$/m.exec(mt) || [''])[0];
  const recently = (/^Recently:.*$/m.exec(mt) || [''])[0];
  note(S, 'This turn 줄', thisTurn);
  note(S, 'Recently 줄', recently);
  const bought = (/just bought (.*?)(; just sold|; talked|$)/.exec(thisTurn) || [])[1] ?? '';
  check(S, '대조: 안 판 작은 성경은 just bought 에 값과 함께', /작은 성경/.test(bought), '작은 성경 (8,000 won)', bought);
  check(S, '기대(재확인자): 사서 되판 묵주·성수 병의 산 일(10,000원·기도 한 번)이 본편 어딘가에 간다', /나무 묵주[^;\n]{0,40}10,?000|10,?000[^;\n]{0,40}나무 묵주/.test(mt) && /성수 병[^;\n]{0,60}기도 한 번/.test(mt), '묵주 10,000 / 성수 병 기도 한 번', { bought, recently, hits10000: (mt.match(/.{0,40}10,000.{0,20}/g) || []).slice(0, 5), hitsPray: (mt.match(/.{0,40}기도 한 번.{0,20}/g) || []).slice(0, 5) }, 'E-02');
}
await r.stop();
r.writeResults();
note('끝', 'errors', (t.errors ?? []).slice?.(0, 20));
process.exit(0);
