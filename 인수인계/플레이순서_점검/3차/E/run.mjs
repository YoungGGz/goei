// 3차 점검 E · 장면 속 가게 (상점). 실제 리스AI(996a553) + 가짜 모델 서버. 시작 상태 ../틀/states/S-상점표식.json
// 사용: source /tmp/t2/t2-env.sh && node 인수인계/플레이순서_점검/3차/E/run.mjs [phase...]
// 단계마다 기대값·결정표 줄을 먼저 적고(check 의 expect·row) 대조한다. 결과 out/결과.json, 요청 전문 out/*.txt
import { openRun, clickChatCard, sleep, STATES, msgsText, userText, sysText } from './lib.mjs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const W = Number(process.env.W || 1280), H = Number(process.env.H || 800);
const r = await openRun({ out: OUT, width: W, height: H });
const { t, check, note } = r;
const want = new Set(process.argv.slice(2));
const on = (p) => !want.size || want.has(p);

// ── 가짜 답 ──
const SHELF1 = `<shop-identity>
sells: 성물(십자가·묵주·성경·초), 성수, 기도서, 작은 성화
never: 무기, 술, 부적·굿 용품
prices: 원으로 받는다. 정가는 붙어 있지만 주인이 손님을 보고 덤을 얹거나 기도 한 번으로 값을 깎아 주기도 한다
currency: -
</shop-identity>
<owner>
천천히 보세요. 필요한 게 있으면 말씀하시고요.
</owner>
<shelf>
나무 묵주|12000|손|귀중품/묵주/rosary|0.031|올리브 나무 알을 꿴 묵주||
축성 초|3000|소모3|소모품/초/candle|0.084|성당에서 축성받은 흰 초 세 자루|켜 두면 잡귀가 가까이 오지 않는다|
은 십자가 목걸이|85000|장비|귀중품/십자가/cross|0.012|순은 십자가, 뒷면에 라틴어가 새겨졌다|품은 사람을 한 번 지켜 준다|희귀
작은 성경|8000|-|서류/성경/bible|0.21|손바닥만 한 신약 성경, 모서리가 닳았다||특가:12000
성수 병|기도 한 번|소모1|소모품/성수/holy water|0.105|유리병에 담은 성수|뿌리면 약한 괴이가 물러난다|
성화 카드|기도 한 번 + 2000|-|서류/성화/holy card|0.004|성모 성화가 인쇄된 카드||
</shelf>`;
const ASK = `<owner>
그 묵주는 제가 직접 꿴 거예요. 오래 쓰셔도 알이 빠지지 않아요.
</owner>
<change mode="none">
</change>`;
const HAGGLE = `<owner>
만 원에 드릴게요. 대신 오늘 저녁 기도에 나와 주세요.
</owner>
<change mode="partial">
~ 나무 묵주|10000
</change>`;
const BARTER = `<owner>
돈 대신 이 초를 성당까지 옮겨 주시면 드릴게요.
</owner>
<change mode="partial">
~ 축성 초|성당까지 짐 옮겨 주기
</change>`;
const SELL_OFFER = (n) => `<owner>
${n.toLocaleString()}원이면 받을게요.
</owner>
<change mode="none">
</change>
<offer>${n}</offer>`;
const SELL_DEAL = (n) => `<owner>
그럼 두고 가세요. 값은 여기 있어요.
</owner>
<change mode="none">
</change>
<offer>${n}</offer>
<deal/>`;
const KICK = `<owner>
더는 팔지 않겠어요. 돌아가 주세요.
</owner>
<change mode="none">
</change>
<closed/>`;
const SHELF2 = `<owner>
새로 꺼내 온 것들이에요.
</owner>
<shelf>
양초 받침|4000|-|도구/받침/candle holder|0.32|놋쇠 양초 받침||
기도서|9000|-|서류/기도서/prayer book|0.28|가죽 표지 기도서||
</shelf>`;

// 갱신기가 상점을 판단할 때(기본 「자동」→ 갱신기가 매 턴 돌면 갱신기) 답: 요청의 shop_check.m 을 읽어 그 응답에 가게
const updaterShop = (name, owner) => (body) => {
  const u = userText(body);
  const m = /"shop_check":\{"m":"(m\d+)"/.exec(u)?.[1];
  return m ? JSON.stringify({ shop: { name, owner, m } }) : '{}';
};
const shopReqs = (seq) => r.since(seq, 'shop');
const mainReqs = (seq) => r.since(seq, 'main');
const lastUserOf = (rec) => { const ms = rec.body.messages.filter((m) => m.role === 'user'); return ms.at(-1)?.content ?? ''; };
const popupText = () => r.ftext('.sh-wrap, .sh-det').catch(() => '');
const shopState = async () => r.J(await r.vars(), '$st_shop');

console.log('setup…');
await t.setup();
const ls = await t.loadState(STATES + 'S-상점표식.json');
console.log('loadState', JSON.stringify(ls));
await t.waitScreenText(8, /블라렛/, 15000);

// ═════ E0 시작 상태의 카드 (갱신기 판단 + 갱신기 답 {} 로 만든 상태: 표식은 글에 남고 방문 상태 없음) ═════
if (on('e0')) {
  const S = 'E0 시작 상태 카드';
  const v = await r.vars();
  note(S, '상태: $st_shop 있음?', { st_shop: !!v.$st_shop, judge: v.$sh_judge ?? '(기본)', pp_on: v.$pp_on ?? '(기본)', pp_when: v.$pp_when ?? '(기본)' });
  const card = await t.page.locator('.default-chat-screen [data-goei-shop]').count();
  note(S, '채팅 속 상점 카드 수', card);
  const s0 = r.lastSeq();
  if (card) {
    await clickChatCard(t);
    await sleep(1500);
    const frameTxt = await t.frame('.gx', 8000).then(() => r.ftext('.gx')).catch(() => '(창 없음)');
    note(S, '카드 누른 뒤 창 글', frameTxt.slice(0, 300));
    check(S, '방문 상태 없는 카드를 누르면 상황판이 뜨지 않는다', !/상황판|잔고 ₩/.test(frameTxt) || /지금 열 수 있는 상점이 없어요/.test(frameTxt), '상점 없음 안내 또는 아무 일 없음 (상황판 X)', frameTxt.slice(0, 200), 'E-01 / 2차 01 문제4');
    await t.shot('E0-card-click');
    await t.closeWindow();
  }
  note(S, '그동안 보조 요청', r.since(s0).map((x) => x.kind));
}

// ═════ E1 가게 장면 한 턴 → 표식 → 카드 → 열기 → 진열 요청 ═════
let s1;
if (on('e1') || on('e2') || on('e3')) {
  const S = 'E1 열기·진열';
  // 기대: 기본 상점 판단(자동→갱신기). 갱신기 요청에 shop_check, 답의 shop 대로 응답 끝에 [shop: 기독교 상점|블라렛] → 카드 → 열면 상점 팝업만
  r.on('updater', updaterShop('기독교 상점', '블라렛'));
  r.once('main', `블라렛이 진열대 쪽으로 손짓했다. "천천히 둘러보세요."\n\n<img=Blaret_smile>\n\n${r.status()}`);
  s1 = r.lastSeq();
  await t.send('진열대를 둘러본다.');
  await r.until(async () => r.since(s1, 'updater').length, 30000);
  await sleep(2500);
  const main = mainReqs(s1)[0];
  r.save('E1-본편', mainReqs(s1));
  r.save('E1-갱신기', r.since(s1, 'updater'));
  check(S, '본편 요청에 상점 표식 지침(MAIN_TAG) 없음 (갱신기가 판단)', main && !/\[shop: /.test(sysText(main.body) + '') , 'MAIN_TAG 없음', main ? (/\[shop:/.test(msgsText(main.body)) ? '본편 요청에 [shop: 글자 있음' : '없음') : '본편 요청 없음', 'E-12 / shopJudgeBy');
  const up = r.since(s1, 'updater')[0];
  check(S, '갱신기 요청에 shop_check', up && /"shop_check":\{"m":"m\d+"/.test(userText(up.body)), 'shop_check 있음', up ? /"shop_check"[^}]*\}/.exec(userText(up.body))?.[0] : '갱신기 요청 없음', 'E-12');
  const st = await shopState();
  check(S, '갱신기 답 뒤 방문 상태(기독교 상점·블라렛)', st?.shop === '기독교 상점' && st?.owner === '블라렛', { shop: '기독교 상점', owner: '블라렛' }, st && { shop: st.shop, owner: st.owner, loaded: st.loaded }, 'E-01');
  const cards = await t.page.locator('.default-chat-screen [data-goei-shop]').count();
  check(S, '카드는 마지막 응답 아래 하나', cards === 1, 1, cards, 'E-01·E-13');
  const lastShot = await t.screenMessages();
  note(S, '화면 마지막 응답 글', lastShot.at(-1)?.text);
  await t.shot('E1-card');

  // 열기 → 진열 요청
  r.once('shop', SHELF1);
  const s1b = r.lastSeq();
  await clickChatCard(t);
  await r.until(async () => shopReqs(s1b).length, 20000);
  await sleep(1500);
  const req = shopReqs(s1b)[0];
  r.save('E1-진열요청', shopReqs(s1b));
  const u = req ? userText(req.body) : '';
  const sy = req ? sysText(req.body) : '';
  check(S, '진열 요청 1건', shopReqs(s1b).length === 1, 1, shopReqs(s1b).length);
  check(S, '진열 요청: 가게·주인 이름', /기독교 상점/.test(u) && /블라렛/.test(u), '기독교 상점·블라렛', u.slice(0, 200), 'E-01');
  check(S, '진열 요청: 첫 방문(FIRST·TASK_FIRST)', /First visit/.test(sy + u) && /가게 정체·주인 첫 대사·진열대/.test(u), 'FIRST·TASK_FIRST', '', '지침 상점 FIRST');
  check(S, '진열 요청: 잔고 숨김 (140000 / 140,000 없음)', !/140,?000/.test(u + sy), '잔고 없음', (/.{40}140,?000.{20}/.exec(u + sy) || [''])[0], 'E-06');
  note(S, '진열 요청: 최근 본문 마지막 응답의 [shop: 표식 (2차 결과 ④ misread 로 걸러 낸 것)', (/[\s\S]{0,40}\[shop:[^\]]*\]/.exec(u) || ['없음'])[0]);
  const stLine = (/\[상태창[^\n]*\]\n(\[▣[^\n]*)/.exec(u) || [])[1] ?? '';
  check(S, '진열 요청: [상태창] 줄에 잔고 칸 없음 (상태창 줄 자체는 감)', stLine && !/140000/.test(stLine), '[▣|…|관리국/신입] (잔고 없이)', stLine, 'E-06');
  check(S, '진열 요청: [최근 본문]에 상태창 줄 안 감', !/\[▣/.test(u.split('[최근 본문]')[1] ?? ''), '없음', '', 'E-06');
  check(S, '진열 요청: 기독교 상점 로어북(참고) 들어감', /기독교 상점/.test(u.split(/\[현재 작업\]/)[0]) , '가게 위키/로어북', '', '말이 되나 (E9)');
  const pop = await popupText();
  check(S, '창: 상점 팝업만 (상황판 탭 없이)', /나무 묵주/.test(pop), '진열 6개', pop.slice(0, 300), 'E-01');
  const tabs = await r.fx(() => !!document.querySelector('.gx-nav, .gx-tabs, [data-action="nav-tab"]:not([hidden])') && [...document.querySelectorAll('[data-action="nav-tab"]')].some((e) => e.offsetParent));
  check(S, '창: 메뉴·탭 안 보임', !tabs, false, tabs, 'E-01');
  await t.shot('E1-shelf');
  const st2 = await shopState();
  check(S, '진열 6개 저장 (희귀1·특가1·대가2)', st2?.items?.length === 6, 6, st2?.items?.map((x) => `${x.name}:${x.price}${x.pay ? '+' + x.pay : ''}${x.tag ? ':' + x.tag : ''}`));
}

// ═════ E2 사기·문의·흥정·대가·팔기·쫓겨남 ═════
if (on('e2') || on('e3')) {
  const S = 'E2 거래';
  const st = await shopState();
  const id = (n) => st.items.find((x) => x.name === n)?.id;
  // 사기: 작은 성경(특가 8000)
  await r.fclickAction('shop-detail', id('작은 성경'));
  await sleep(300);
  const det = await popupText();
  note(S, '상세 글(작은 성경)', det.slice(0, 200));
  await r.fclickAction('shop-buy', id('작은 성경'));
  await sleep(800);
  let v = await r.vars();
  const w = r.J(v, '$st_wallet');
  const items = r.J(v, '$st_items');
  note(S, '가계부 마지막 줄', (w?.entries ?? w?.list ?? []).slice?.(-1));
  check(S, '특가 성경 사면 소지품에 들어감', JSON.stringify(items).includes('작은 성경'), '소지품에 작은 성경', JSON.stringify(items).slice(0, 300), 'E-02');
  check(S, '가계부 -8000', JSON.stringify(w).includes('-8000'), -8000, JSON.stringify(w).slice(-300));
  // 대가 물건: 성수 병(기도 한 번)
  await r.fclickAction('shop-detail', id('성수 병'));
  await r.fclickAction('shop-buy', id('성수 병'));
  await sleep(800);
  v = await r.vars();
  const it2 = r.J(v, '$st_items');
  const holy = JSON.stringify(it2).match(/\{[^{}]*성수 병[^{}]*\}/)?.[0];
  check(S, '대가 물건: 가계부 안 건드림, 소지품에 paidWith', holy && /기도 한 번/.test(holy) && !JSON.stringify(r.J(v, '$st_wallet')).includes('성수'), 'paidWith 기도 한 번', holy, 'E-04');
  // 문의
  const s2 = r.lastSeq();
  r.once('shop', ASK);
  await r.fclickAction('shop-ask', id('나무 묵주'));
  await t.F().fill('[data-input="shop-say"]', '이거 직접 만드신 건가요?');
  await r.fclickAction('shop-say');
  await r.until(async () => shopReqs(s2).length, 15000);
  await sleep(1200);
  const ask = shopReqs(s2)[0];
  r.save('E2-문의', shopReqs(s2));
  const au = ask ? userText(ask.body) : '';
  check(S, '문의 요청: 마지막 줄이 방금 한 말(칩 포함)', /나무 묵주/.test(au.slice(-400)) && /직접 만드신/.test(au.slice(-400)), '묵주·말', au.slice(-300), '지침 ASK_CHIP');
  check(S, '문의 요청: 산 물건(성경·성수) 목록', /작은 성경/.test(au) && /성수 병/.test(au), 'HEAD_BOUGHT 에 둘', '', '지침 HEAD_BOUGHT');
  check(S, '문의 요청: 잔고 숨김', !/140,?000|132,?000/.test(au), '없음', (/.{30}13\d,?000.{10}/.exec(au) || [''])[0], 'E-06');
  // 흥정
  const s3 = r.lastSeq();
  r.once('shop', HAGGLE);
  await t.F().fill('[data-input="shop-say"]', '묵주 만 원에 안 될까요?');
  await r.fclickAction('shop-say');
  await r.until(async () => shopReqs(s3).length, 15000);
  await sleep(1200);
  const st3 = await shopState();
  const ros = st3.items.find((x) => x.name === '나무 묵주');
  check(S, '흥정 수락 → 값 10000, 원래 값 기억(▾)', ros?.price === 10000 && ros?.orig === 12000, { price: 10000, orig: 12000 }, ros && { price: ros.price, orig: ros.orig, tag: ros.tag });
  // 대가 흥정 (특가 아닌 물건이 대가로)
  const s4 = r.lastSeq();
  r.once('shop', BARTER);
  await t.F().fill('[data-input="shop-say"]', '돈 말고 다른 걸로 초를 살 수 있을까요?');
  await r.fclickAction('shop-say');
  await r.until(async () => shopReqs(s4).length, 15000);
  await sleep(1200);
  const st4 = await shopState();
  const can = st4.items.find((x) => x.name === '축성 초');
  check(S, '대가 흥정 → 값 0 + 대가 글, 특가 딱지 없음', can?.pay === '성당까지 짐 옮겨 주기' && can?.price === 0 && can?.tag !== 'sale', { pay: '성당까지 짐 옮겨 주기', price: 0 }, can, 'E-09');
  const popTxt = await popupText();
  check(S, '화면: -100% 없음', !/-100%/.test(popTxt), '없음', (/.{20}-100%.{20}/.exec(popTxt) || [''])[0], 'E-09');
  await r.fclickAction('shop-detail', id('축성 초'));
  await r.fclickAction('shop-buy', id('축성 초'));
  await sleep(800);
  await t.shot('E2-after-buys');
  // 팔기: 성수 병(대가로 산 것) 팔기 → 제안 → 「판매」 단추
  const s5 = r.lastSeq();
  await r.fclickAction('shop-pick');
  const v5 = await r.vars();
  const holyId = r.J(v5, '$st_items')?.list?.find?.((x) => x.name === '성수 병')?.id ?? (JSON.stringify(r.J(v5, '$st_items')).match(/"id":"([^"]+)"[^{}]*"name":"성수 병"/) || [])[1];
  const pickTxt = await popupText();
  check(S, '판매 고르기 칸: 대가로 산 물건에 「산 값 0」 없음', !/성수 병[^가-힣]{0,40}산 값 0/.test(pickTxt), '0원 표시 없음', pickTxt.slice(0, 300), 'E-09');
  await r.fclickAction('shop-sell-pick', holyId);
  r.once('shop', SELL_OFFER(5000));
  await r.fclickAction('shop-say');
  await r.until(async () => shopReqs(s5).length, 15000);
  await sleep(1200);
  const sellReq = shopReqs(s5)[0];
  r.save('E2-팔기', shopReqs(s5));
  const su = sellReq ? userText(sellReq.body) : '';
  check(S, '팔기 요청: 「0 won」으로 안 감, 치른 대가가 감', !/for 0 won/.test(su) && /기도 한 번/.test(su), '대가 「기도 한 번」', (/\[팔려는 물건\][\s\S]{0,400}/.exec(su) || [''])[0], 'E-09 / 지침 SELLING_PAID');
  const stS = await shopState();
  check(S, '제안 5000 저장', stS?.sell?.price === 5000, 5000, stS?.sell);
  // 「판매」 단추 (상세 창)
  await r.fclickAction('shop-sell');
  await sleep(800);
  const v6 = await r.vars();
  check(S, '판매 뒤 가계부 +5000', JSON.stringify(r.J(v6, '$st_wallet')).includes('5000') , '+5000', JSON.stringify(r.J(v6, '$st_wallet')).slice(-300));
  check(S, '비소속 일반 상점 판매로 포인트 안 생김', !v6.$st_points || !/성수/.test(v6.$st_points), '포인트 장부 변화 없음', String(v6.$st_points ?? '').slice(0, 200), 'E-10b');
  // 말로 판매 (<deal/>) : 묵주를 사서 다시 팔기? → 같은 턴 사고 되팔기 (2차 문제6)
  await r.fclickAction('shop-pick'); // 판매 화면 닫기 (토글)
  const stB = await shopState();
  await r.fclickAction('shop-detail', stB.items.find((x) => x.name === '나무 묵주').id);
  await r.fclickAction('shop-buy', stB.items.find((x) => x.name === '나무 묵주').id);
  await sleep(700);
  await r.fclickAction('shop-pick');
  const v7 = await r.vars();
  const rosId = (JSON.stringify(r.J(v7, '$st_items')).match(/"id":"([^"]+)"[^{}]*"name":"나무 묵주"/) || [])[1];
  await r.fclickAction('shop-sell-pick', rosId);
  const s6 = r.lastSeq();
  r.once('shop', SELL_DEAL(7000));
  await t.F().fill('[data-input="shop-say"]', '7천 원이면 팔게요.');
  await r.fclickAction('shop-say');
  await r.until(async () => shopReqs(s6).length, 15000);
  await sleep(1500);
  const v8 = await r.vars();
  check(S, '<deal/> → 판매 성립(+7000), 소지품에서 빠짐', JSON.stringify(r.J(v8, '$st_wallet')).includes('7000'), '+7000', JSON.stringify(r.J(v8, '$st_wallet')).slice(-300));
  await t.shot('E2-after-sell');
  r.saveJson('E2-상태', { shop: await shopState(), wallet: r.J(v8, '$st_wallet'), items: r.J(v8, '$st_items') });
}

// ═════ E3 다음 턴 본편 [Inventory] ═════
if (on('e3')) {
  const S = 'E3 다음 턴';
  await r.fclickAction('shop-close');
  await sleep(600);
  r.once('main', `블라렛이 계산대 뒤에서 손을 흔들었다.\n\n${r.status({ place: '서울 서대문구 기독교 상점 앞' })}`);
  r.on('updater', () => JSON.stringify({ shop: null }));
  const s = r.lastSeq();
  await t.send('상점을 나선다.');
  await sleep(2000);
  const m = mainReqs(s)[0];
  r.save('E3-본편1', mainReqs(s));
  const mt = m ? msgsText(m.body) : '';
  const inv = (/\[Inventory\][\s\S]{0,3000}/.exec(mt) || [''])[0];
  r.saveJson('E3-inventory1', { inv });
  const once = (re) => (mt.match(re) || []).length;
  check(S, '산 것(성경) just bought 한 번', once(/just bought[^\n]*작은 성경|작은 성경[^\n]*just bought/g) === 1 || (/This turn/.test(inv) && once(/작은 성경/g) >= 1), '한 번', inv.slice(0, 800), 'E-02');
  check(S, '대가로 산 것(축성 초): 무엇으로 치르고 샀다', /축성 초 \(paid with 성당까지 짐 옮겨 주기\)/.test(inv), 'paid with 성당까지 짐 옮겨 주기', (/^This turn:.*$/m.exec(inv) || [''])[0].slice(0, 300), 'E-04');
  check(S, '판 것·이번 방문 대화 전부', /성수 병/.test(inv) && /나무 묵주/.test(inv) && /직접 만드신/.test(mt), '판 것 둘 + 대화', '', 'E-02');
  const thisTurn = (/^This turn:.*$/m.exec(inv) || [''])[0];
  const boughtPart = (/just bought (.*?)(; just sold|; talked|$)/.exec(thisTurn) || [])[1] ?? '';
  check(S, '같은 턴 사고 되판 물건(묵주 10,000원·성수 병 기도 한 번): 산 일이 This turn 에 값과 함께', /나무 묵주/.test(boughtPart) && /성수 병/.test(boughtPart), 'just bought 에 묵주·성수 병 (값·대가)', { thisTurnBought: boughtPart, recently: (/^Recently:.*$/m.exec(inv) || [''])[0] }, '2차 01 S2-6(misread)·02 되팔기(버그) 판정 갈림');
  check(S, '본편 요청에 잔고 칸은 있음 (본편은 숨김 대상 아님)', /Previous status/.test(mt), '있음', '', 'E-06 범위');
  // 그다음 턴: 사건 다시 안 감
  r.once('main', `골목은 조용했다.\n\n${r.status({ place: '서울 서대문구 골목' })}`);
  const s2 = r.lastSeq();
  await t.send('골목을 걷는다.');
  await sleep(2000);
  const m2 = mainReqs(s2)[0];
  r.save('E3-본편2', mainReqs(s2));
  const mt2 = m2 ? msgsText(m2.body) : '';
  check(S, '그다음 턴엔 This turn 줄 없음 (목록·Recently 만)', !/^This turn:/m.test(mt2), '없음', (/\[Inventory\][\s\S]{0,600}/.exec(mt2) || [''])[0], 'E-02');
  check(S, '방문 끝난 뒤 카드 없음', (await t.page.locator('.default-chat-screen [data-goei-shop]').count()) === 0, 0, await t.page.locator('.default-chat-screen [data-goei-shop]').count());
}


// ── 가게에 들어가 카드로 여는 길 (E4~E8 공용) ──
async function enterShop(S, { name = '기독교 상점', owner = '블라렛', shelf = SHELF1, say = '상점에 다시 들어간다.' } = {}) {
  r.on('updater', updaterShop(name, owner));
  r.once('main', `${owner}이(가) 고개를 들었다.\n\n${r.status({ place: '서울 서대문구 ' + name })}`);
  const s = r.lastSeq();
  await t.send(say);
  await r.until(async () => r.since(s, 'updater').length, 30000);
  await sleep(2500);
  if (shelf) r.once('shop', shelf);
  const s2 = r.lastSeq();
  const ok = await clickChatCard(t);
  if (shelf) await r.until(async () => shopReqs(s2).length, 20000);
  await sleep(1200);
  return { ok, seq: s2 };
}
async function leaveShop() { await r.fclickAction('shop-close'); await sleep(500); }

// ═════ E4 다 사고 새로고침 → 피할 목록 ═════
if (on('e4')) {
  const S = 'E4 다 사고 새로고침';
  await enterShop(S, { shelf: `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n${SHELF2}` });
  let st = await shopState();
  for (const it of st.items) { await r.fclickAction('shop-detail', it.id); await r.fclickAction('shop-buy', it.id); await sleep(500); }
  const shelfAgain = `<owner>\n또 꺼내 왔어요.\n</owner>\n<shelf>\n양초 받침|4000|-|도구/받침/candle holder|0.32|놋쇠 양초 받침||\n성가집|6000|-|서류/성가집/hymnal|0.3|낡은 성가집||\n</shelf>`;
  const fresh = `<owner>\n이번엔 이것들이에요.\n</owner>\n<shelf>\n성모상|30000|-|잡동사니/성모상/statue|1.2|작은 석고 성모상||\n향|2000|소모10|소모품/향/incense|0.002|유향 열 개||\n</shelf>`;
  r.once('shop', shelfAgain);
  r.once('shop', fresh);
  const s = r.lastSeq();
  await r.fclickAction('shop-refresh');
  await r.until(async () => shopReqs(s).length >= 1, 15000);
  await sleep(4000);
  const reqs = shopReqs(s);
  r.save('E4-새로고침', reqs);
  const u = reqs[0] ? userText(reqs[0].body) + sysText(reqs[0].body) : '';
  check(S, 'RESTOCK 요청 (TASK_RESTOCK)', /진열대 새로 짜기/.test(u), 'TASK_RESTOCK', '', '지침 상점 RESTOCK');
  const avoid = (/Previously shown here \(do not repeat\):[^\n]*/.exec(u) || [''])[0];
  check(S, '피할 목록에 산 것(양초 받침·기도서) 둘 다', /양초 받침/.test(avoid) && /기도서/.test(avoid), '둘 다', avoid.slice(0, 300), 'E-08');
  r.note(S, `피할 목록은 이번 방문 것만 (앞 방문에서 산 작은 성경 등은 ${/작은 성경|축성 초/.test(avoid) ? '있음' : '없음'}) — 방문마다 새로 시작`);
  st = await shopState();
  const left = st.items.filter((x) => !x.sold).map((x) => x.name);
  check(S, '일부 겹친 진열: 겹친 양초 받침만 빠지고 성가집은 걸림 (다시 안 물음)', !left.includes('양초 받침') && left.includes('성가집'), '성가집만', st.items.map((x) => `${x.name}${x.sold ? '(팔림)' : ''}`), 'E-08 (26edc4a: 전부 겹칠 때만 다시 물음)');
  // 전부 겹침 → 버리고 다시 물음
  for (const it of st.items.filter((x) => !x.sold)) { await r.fclickAction('shop-detail', it.id); await r.fclickAction('shop-buy', it.id); await sleep(500); }
  const allSame = `<owner>\n또 꺼내 왔어요.\n</owner>\n<shelf>\n양초 받침|4000|-|도구/받침/candle holder|0.32|놋쇠 양초 받침||\n성가집|6000|-|서류/성가집/hymnal|0.3|낡은 성가집||\n</shelf>`;
  r.dropOnce('shop');
  r.once('shop', allSame);
  r.once('shop', fresh);
  const s2 = r.lastSeq();
  await r.fclickAction('shop-refresh');
  await r.until(async () => shopReqs(s2).length >= 1, 15000);
  await sleep(5000);
  const reqs2 = shopReqs(s2);
  r.save('E4-새로고침-전부겹침', reqs2);
  st = await shopState();
  const left2 = st.items.filter((x) => !x.sold).map((x) => x.name);
  check(S, '전부 겹친 진열 → 버리고 한 번 더 물음 → 성모상·향', reqs2.length === 2 && left2.join(',') === '성모상,향', '요청 2건, 성모상,향', { reqs: reqs2.length, left: left2 }, 'E-08');
  await leaveShop();
}

// ═════ E5 판단자 셋 ═════
if (on('e5')) {
  const S = 'E5 판단자';
  // 메인: $sh_judge=main → 본편 요청에 MAIN_TAG(SHOP_RULE), 본편 답의 표식대로 상태
  await r.setVars({ $sh_judge: 'main' });
  r.on('updater', () => '{}');
  r.once('main', `블라렛이 계산대를 닦았다.\n\n${r.status()}\n[shop: 기독교 상점|블라렛]`);
  let s = r.lastSeq();
  await t.send('계산대 앞에 선다.');
  await sleep(3000);
  let m = mainReqs(s)[0];
  r.save('E5-메인판단-본편', mainReqs(s));
  const mt = m ? msgsText(m.body) : '';
  check(S, '메인 판단: 본편 요청에 [shop: 표식 지침', /\[shop: /.test(sysText(m?.body ?? {})), '있음', (/.{0,80}\[shop: [^\n]{0,80}/.exec(mt) || [''])[0], 'E-12');
  let up = r.since(s, 'updater')[0];
  check(S, '메인 판단: 갱신기 요청에 shop_check 없음', !up || !/"shop_check"/.test(userText(up.body)), '없음', up ? 'shop_check 있음' : '갱신기 없음', 'E-12');
  let st = await shopState();
  check(S, '메인 판단: 표식대로 방문 상태', st?.shop === '기독교 상점', '기독교 상점', st?.shop);
  // 생각 블록 안 표식 (메인 판단): 본문엔 없고 <Thoughts> 안에만 → 상점 안 열림 (공-21)
  r.once('main', `<think>[shop: 가짜 가게|아무개]</think>\n가게를 나와 길을 걸었다.\n\n${r.status({ place: '서울 서대문구 골목' })}`);
  s = r.lastSeq();
  await t.send('밖으로 나간다.');
  await sleep(3000);
  st = await shopState();
  check(S, '생각 블록 안 표식만 있으면 상점 안 열림 (방문 비움)', !st, null, st && st.shop, '공-21');
  // 갱신기 + 사람 기록 끔 → 메인이 대신 (fallback)
  await r.setVars({ $sh_judge: 'updater', $pp_on: '0' });
  r.once('main', `골목 끝 노점 할머니가 손짓했다.\n\n${r.status()}\n[shop: 골목 노점|]`);
  s = r.lastSeq();
  await t.send('노점에 다가간다.');
  await sleep(3000);
  m = mainReqs(s)[0];
  const mt2 = m ? msgsText(m.body) : '';
  check(S, '갱신기 골랐는데 인물 기록 끔 → 본편에 표식 지침 (메인이 대신)', /\[shop: /.test(sysText(m?.body ?? {})), '있음', '', 'shopJudgeBy fallback');
  st = await shopState();
  check(S, 'fallback: 표식대로 상태(골목 노점)', st?.shop === '골목 노점', '골목 노점', st?.shop);
  // 자동 + 인물 기록 켬(매 턴) → 갱신기
  await r.setVars({ $sh_judge: 'auto', $pp_on: '1' });
  r.on('updater', updaterShop('골목 노점', ''));
  r.once('main', `할머니가 귤을 내밀었다.\n\n${r.status()}`);
  s = r.lastSeq();
  await t.send('귤을 본다.');
  await r.until(async () => r.since(s, 'updater').length, 30000);
  await sleep(2500);
  m = mainReqs(s)[0];
  check(S, '자동+갱신기 매 턴: 본편 system 에 표식 지침 없음', m && !/\[shop: /.test(sysText(m.body)), '없음', '', 'E-12');
  note(S, '자동+갱신기: 본편 대화 기록 속 지난 응답의 [shop: 표식 (갱신기가 붙인 것)', (/[^\n]{0,40}\[shop: [^\]]*\]/.exec(userText(m?.body ?? {}) + (m?.body?.messages ?? []).filter((x) => x.role === 'assistant').map((x) => x.content).join('\n')) || ['없음'])[0]);
  up = r.since(s, 'updater')[0];
  check(S, '자동: 갱신기 요청에 shop_check', up && /"shop_check"/.test(userText(up.body)), '있음', '', 'E-12');
  st = await shopState();
  check(S, '자동: 갱신기 답대로 같은 가게 이어짐', st?.shop === '골목 노점', '골목 노점', st?.shop);
  await r.setVars({ $sh_judge: '' });
}

// ═════ E6 포인트 가게 (비소속) ═════
if (on('e6')) {
  const S = 'E6 포인트 가게 비소속';
  const PSHELF = `<shop-identity>\nsells: 사내 매점 물품\nnever: 술\nprices: 백일몽 복지 포인트\ncurrency: points\n</shop-identity>\n<owner>\n어서 오세요.\n</owner>\n<shelf>\n사원증 줄|300|-|잡동사니/줄/lanyard|0.02|파란 사원증 줄||\n</shelf>`;
  await enterShop(S, { name: '백일몽 사내 매점', owner: '', shelf: PSHELF, say: '근처 사내 매점에 들어간다.' });
  const st = await shopState();
  note(S, '정체 points 로 받은 뒤 상태', { points: st?.identity?.points, shop: st?.shop });
  const pop = await popupText();
  note(S, '창 글', pop.slice(0, 200));
  await r.fclickAction('shop-detail', st?.items?.[0]?.id);
  await r.fclickAction('shop-buy', st?.items?.[0]?.id);
  await sleep(700);
  const v = await r.vars();
  check(S, '비소속: currency: points 를 받아도 포인트 가게가 아님 (원 가게로, 0.21.34)', !st?.identity?.points, 'identity.points 없음', st?.identity, 'E-10 / 업데이트내역 v0.21.34');
  note(S, '비소속: 「300」(모델은 포인트로 적음)이 300원으로 팔림', { bought: JSON.stringify(r.J(v, '$st_items')).includes('사원증 줄'), wallet: JSON.stringify(r.J(v, '$st_wallet')).slice(-160) });
  // 팔기 → 제안 → 판매 단추
  await r.fclickAction('shop-pick');
  const it = r.J(v, '$st_items')?.list?.find((x) => x.name === '사원증 줄');
  if (it) {
    await r.fclickAction('shop-sell-pick', it.id);
    r.once('shop', `<owner>\n200 포인트에 받을게요.\n</owner>\n<change mode="none">\n</change>\n<offer>200</offer>`);
    const s = r.lastSeq();
    await r.fclickAction('shop-say');
    await r.until(async () => shopReqs(s).length, 15000);
    await sleep(1000);
    await r.fclickAction('shop-sell');
    await sleep(700);
    const v2 = await r.vars();
    check(S, '비소속: 팔아도 포인트 안 생김', !String(v2.$st_points ?? '').includes(it.name), '포인트 장부 변화 없음', String(v2.$st_points ?? '').slice(0, 200), 'E-10b');
    note(S, '판매 뒤 안내', (await popupText()).slice(0, 200));
  } else note(S, '팔 물건 없음', null);
  await t.shot('E6-points');
  await leaveShop();
}

// ═════ E7 상점 설정 → 진열 요청 글 ═════
if (on('e7')) {
  const S = 'E7 설정';
  await r.setVars({ $sh_min: '3', $sh_max: '3', $sh_feature: '0', $sh_price: '전부 아주 싸게', $sh_diverse: '1', $sh_ctx: '0', $sh_thoughts: 'inner' });
  const { seq } = await enterShop(S, { name: '설정 시험 가게', owner: '', shelf: `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n${SHELF2}`, say: '다른 가게에 들어간다.' });
  const req = shopReqs(seq)[0];
  r.save('E7-설정진열', shopReqs(seq));
  const all = req ? msgsText(req.body) : '';
  check(S, '진열 개수 3', /Shelf size: exactly 3 items/.test(all), 'Shelf size: exactly 3', (/Shelf size:[^\n]{0,30}/.exec(all) || [''])[0]);
  check(S, '희귀·특가 끔 → SHELF_PLAIN', /구분: always leave it empty/.test(all), 'SHELF_PLAIN', '');
  check(S, '값 기준 글', /전부 아주 싸게/.test(all), '있음', '');
  check(S, '다양성 → VARIETY', /Variety:/.test(all), '있음', '');
  check(S, '맥락 반영 끔 → 최근 본문·상태창 안 감', !/\[최근 본문\]/.test(all) && !/\[▣/.test(all), '없음', '');
  check(S, '생각 단계 「inner」 → THOUGHTS_SHELF 순서표 붙음', /What kind of place is this shop/.test(all), '있음', '');
  await r.setVars({ $sh_min: '', $sh_max: '', $sh_feature: '', $sh_price: '', $sh_diverse: '', $sh_ctx: '', $sh_thoughts: '' });
  await leaveShop();
}

// ═════ E8 갈래 ═════
const SH8 = `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n<owner>\n어서 오세요.\n</owner>\n<shelf>\n묵주 팔찌|5000|장비|귀중품/팔찌/bracelet|0.02|나무 묵주 팔찌||\n향초|3000|소모2|소모품/초/candle|0.1|라벤더 향초 두 개||\n성경 책갈피|1000|-|서류/책갈피/bookmark|0.003|가죽 책갈피||\n</shelf>`;
// 잔고: 플러그인이 살아 있는 응답만 세어 보여 주는 값 (상점 팝업 머리). 팝업이 열려 있어야 한다
const balUI = async () => { const tx = await r.ftext('.sh-wrap').catch(() => ''); const m = /₩\s*([\d,]+)/.exec(tx); return m ? Number(m[1].replace(/,/g, '')) : null; };
const bal = balUI;
const itemNames = async () => { const v = await r.vars(); return (r.J(v, '$st_items')?.list ?? []).filter((x) => !x.gone && !x.sold && !x.soldAt).map((x) => x.name); };
if (on('e8')) {
  let S = 'E8a 다시 굴리기·◀▶';
  await enterShop(S, { name: '성물 가게', owner: '', shelf: SH8, say: '성물 가게에 들어간다.' });
  let st = await shopState();
  const bracelet = st.items.find((x) => x.name === '묵주 팔찌');
  await r.fclickAction('shop-detail', bracelet.id); await r.fclickAction('shop-buy', bracelet.id); await sleep(600);
  const b0 = await bal();
  const w0 = r.J(await r.vars(), '$st_wallet');
  await leaveShop();
  r.on('updater', updaterShop('성물 가게', ''));
  r.once('main', `주인이 포장지를 접었다. (답 A)\n\n${r.status()}`);
  let s = r.lastSeq();
  await t.send('팔찌를 차 본다.');
  await sleep(2500);
  const mA = mainReqs(s)[0];
  r.once('main', `주인이 웃었다. (답 B, 다시 굴림)\n\n${r.status()}`);
  s = r.lastSeq();
  await t.reroll();
  await sleep(2500);
  const mB = mainReqs(s)[0];
  r.save('E8a-다시굴림-본편', [mA, mB].filter(Boolean));
  const inv = (x) => (/^This turn:.*$/m.exec(x ? msgsText(x.body) : '') || [''])[0];
  check(S, '다시 굴린 요청에도 산 일(묵주 팔찌) This turn 한 번', /just bought 묵주 팔찌/.test(inv(mB)) && (inv(mB).match(/묵주 팔찌/g) || []).length === 1, '한 번', inv(mB).slice(0, 200), 'E-02·공-01');
  const w1 = r.J(await r.vars(), '$st_wallet');
  await clickChatCard(t); await sleep(1200);
  const b1 = await bal();
  await leaveShop();
  r.saveJson('E8a-가계부-전후', { before: w0, after: w1, items: r.J(await r.vars(), '$st_items') });
  check(S, '다시 굴려도 잔고 그대로 (구매는 앞 응답에서 한 것)', b1 === b0, b0, { now: b1, dropped: (w0?.log ?? []).filter((e) => !(w1?.log ?? []).some((x) => x.id === e.id)).map((e) => `${e.memo} ${e.amount} @${String(e.anchor).slice(0, 8)}`) }, '공-01');
  // ◀ 로 답 A 보기 → 플러그인 상태(가게·카드) 와 화면
  const sPrev = r.lastSeq();
  await t.swipePrev();
  await sleep(1200);
  const scr = await t.screenMessages();
  note(S, '◀ 뒤 화면 마지막 글', scr.at(-1)?.text?.slice(0, 120));
  check(S, '◀ 동안 모델 요청 없음', r.since(sPrev).length === 0, 0, r.since(sPrev).map((x) => x.kind), 'T2 사용법 (d)');
  const cardAfterPrev = await t.page.locator('.default-chat-screen [data-goei-shop]').count();
  const stPrev = await shopState();
  note(S, '◀ 뒤 카드 수·방문 상태', { cards: cardAfterPrev, shop: stPrev?.shop, key: stPrev?.key });
  await t.swipeNext(); // ▶ (다음 답 B 로)
  await sleep(1500);
  note(S, '▶ 뒤 요청', r.since(sPrev).map((x) => x.kind));
  await t.shot('E8a-swipe');

  // 늦은 문의 답: 보내고 창 닫고 본편 넘김 → 답이 뒤에 옴 → 다음 본편에 한 번
  S = 'E8b 늦은 문의 답';
  await enterShop(S, { name: '성물 가게', owner: '', shelf: null, say: '다시 가게 안을 둘러본다.' });
  r.hold('shop');
  st = await shopState();
  await r.fclickAction('shop-ask', st.items.find((x) => x.name === '향초').id);
  await t.F().fill('[data-input="shop-say"]', '향초 하나만 덤으로 주실래요?');
  await r.fclickAction('shop-say');
  await r.until(async () => r.held().length, 10000);
  await leaveShop();
  r.once('main', `주인이 대답 없이 웃었다.\n\n${r.status()}`);
  s = r.lastSeq();
  await t.send('잠깐 기다린다.');
  await sleep(2500);
  const mid = mainReqs(s)[0];
  r.once('shop', `<owner>\n하나 더 넣어 드릴게요.\n</owner>\n<change mode="none">\n</change>`);
  await r.unhold('shop');
  await sleep(2000);
  r.once('main', `주인이 봉투를 건넸다.\n\n${r.status()}`);
  s = r.lastSeq();
  await t.send('봉투를 받는다.');
  await sleep(2500);
  const after = mainReqs(s)[0];
  r.save('E8b-늦은답-본편', [mid, after].filter(Boolean));
  const ma = after ? msgsText(after.body) : '';
  check(S, '답 오기 전 본편엔 이 대화가 아직 안 감 (말·답 한 쌍으로 다음에)', !/덤으로 주실래요|하나 더 넣어/.test(msgsText(mid?.body ?? {})), '둘 다 없음', (/talked with[^\n]{0,200}/.exec(msgsText(mid?.body ?? {})) || [''])[0], '2차 01 문제7 (0.21.34)');
  check(S, '늦게 온 주인 답이 내 말과 함께 다음 본편에 한 번', (ma.match(/하나 더 넣어 드릴게요/g) || []).length === 1 && (ma.match(/덤으로 주실래요/g) || []).length === 1, 1, (/talked with[^\n]{0,300}/.exec(ma) || [''])[0], '업데이트내역 v0.21.34 12줄');

  // 새로고침: 답 기다리는 중 새로고침 → 다시 열면 내 말이 입력칸으로, 본편에 안 감
  S = 'E8c 답 기다리다 새로고침';
  await enterShop(S, { name: '성물 가게', owner: '', shelf: null, say: '가게에 다시 들어간다.' });
  r.hold('shop');
  st = await shopState();
  await t.F().fill('[data-input="shop-say"]', '책갈피 색 다른 것도 있나요?');
  await r.fclickAction('shop-say');
  await r.until(async () => r.held().length, 10000);
  await t.reload();
  await sleep(2000);
  // 붙잡은 요청은 버린다 (브라우저가 끊음)
  await r.unhold('shop');
  await clickChatCard(t);
  await sleep(1500);
  const inVal = await t.feval(() => document.querySelector('[data-input="shop-say"]')?.value ?? null).catch(() => null);
  check(S, '다시 열면 답 못 받은 내 말이 입력칸으로', inVal === '책갈피 색 다른 것도 있나요?', '책갈피 색 다른 것도 있나요?', inVal, '업데이트내역 v0.21.34 12줄');
  st = await shopState();
  check(S, '방문 대화에 답 없는 내 말이 안 남음', !JSON.stringify(st?.talk ?? []).includes('책갈피 색'), '없음', st?.talk?.slice?.(-2));
  await leaveShop();
  r.once('main', `가게 안은 조용했다.\n\n${r.status()}`);
  s = r.lastSeq();
  await t.send('주인을 부른다.');
  await sleep(2500);
  check(S, '본편에 답 없는 내 말 안 감', !/책갈피 색 다른 것도/.test(msgsText(mainReqs(s)[0]?.body ?? {})), '없음', '');

  // 다른 채팅 다녀오기: 답 기다리는 중 다른 채팅으로 → 답 도착 → 돌아옴
  S = 'E8d 다른 채팅 다녀오기';
  await enterShop(S, { name: '성물 가게', owner: '', shelf: null, say: '가게 안을 다시 본다.' });
  r.hold('shop');
  await t.F().fill('[data-input="shop-say"]', '오늘 몇 시까지 하세요?');
  await r.fclickAction('shop-say');
  await r.until(async () => r.held().length, 10000);
  await leaveShop();
  const cs0 = await t.chatState();
  await t.switchChat(1);   // 0번은 지금 채팅, 1번은 setup 이 만든 빈 Chat 1
  await sleep(800);
  r.once('shop', `<owner>\n저녁 아홉 시까지요.\n</owner>\n<change mode="none">\n</change>`);
  await r.unhold('shop');
  await sleep(1500);
  const other = await t.chatState(true);
  check(S, '다른 채팅에 상점 상태가 안 생김', !other.scriptstate?.$st_shop, '없음', String(other.scriptstate?.$st_shop ?? '').slice(0, 100));
  await t.switchChat(0);
  await sleep(800);
  st = await shopState();
  note(S, '돌아온 뒤 방문 대화 끝 두 줄', st?.talk?.slice?.(-2));
  await clickChatCard(t);
  await sleep(1200);
  const inVal2 = await t.feval(() => document.querySelector('[data-input="shop-say"]')?.value ?? null).catch(() => null);
  const st2 = await shopState();
  const got = JSON.stringify(st2?.talk ?? []).includes('아홉 시까지');
  check(S, '답이 다른 채팅에 있는 동안 와도: 받아 두거나(대화에 답) 버리고 내 말을 입력칸으로 (반쯤 남지 않음)', got || inVal2 === '오늘 몇 시까지 하세요?', '둘 중 하나', { got, inVal2, last: st2?.talk?.slice?.(-2) }, '공-02');
  await t.shot('E8d-back');
  await leaveShop();

  // 쫓겨남 → 다시 굴리기 (손-01)
  S = 'E8e 쫓겨남·다시 굴리기';
  r.once('main', `주인이 계산대 너머에서 노려봤다.\n\n${r.status()}`);
  await enterShop(S, { name: '성물 가게', owner: '', shelf: null, say: '주인에게 시비를 건다.' });
  r.once('shop', KICK);
  s = r.lastSeq();
  await t.F().fill('[data-input="shop-say"]', '이딴 걸 누가 사요?');
  await r.fclickAction('shop-say');
  await r.until(async () => shopReqs(s).length, 10000);
  await sleep(1200);
  st = await shopState();
  check(S, '쫓겨남 → closed', !!st?.closed, true, st?.closed);
  await leaveShop();
  r.once('main', `주인이 문을 가리켰다. (다시 굴린 답)\n\n${r.status()}`);
  await t.reroll();
  await sleep(3000);
  st = await shopState();
  note(S, '방문을 연 응답을 다시 굴린 뒤 closed (손-01: 남음이 알려진 상태)', { closed: st?.closed, shop: st?.shop });

  // 상점 끔 → 카드
  S = 'E8f 상점 끔';
  await enterShop(S, { name: '성물 가게2', owner: '', shelf: null, say: '옆 가게로 간다.' });
  await leaveShop();
  // 설정 화면으로 끔 (2차 S2-4 는 틀이 설정 처리를 건너뛰어 misread 였다 → 실제 설정 단추로)
  const setShop = async (v) => { await t.openWindow(); await sleep(1200); await r.fclickAction('ed-open', 'set:screen'); await sleep(1200); await r.fclickAction('ed-node', 'set:shop'); await sleep(1200); const ok = await r.fclickAction('fam-set', `s:shop:on=${v}`); if (!ok) note(S, '설정 상점 페이지 단추들', await t.feval(() => [...document.querySelectorAll('[data-action]')].map((e) => `${e.dataset.action}|${e.dataset.value ?? ''}`).filter((x) => /shop/.test(x)).slice(0, 30))); await sleep(800); await r.fclickAction('ed-close'); await sleep(500); await t.closeWindow(); await sleep(500); const still = await t.page.locator('iframe').evaluateAll((fs) => fs.some((f) => f.getBoundingClientRect().width > 300 && getComputedStyle(f).display !== 'none' && getComputedStyle(f).visibility !== 'hidden')); note(S, '설정 닫은 뒤 큰 창 남음?', still); return ok; };
  note(S, '설정 「상점」 끔 단추', await setShop('0'));
  note(S, '끈 뒤 $sh_on', (await r.vars()).$sh_on);
  const c1 = await t.page.locator('.default-chat-screen [data-goei-shop]').count();
  check(S, '설정 화면으로 끄면 채팅에 남은 카드가 지워짐', c1 === 0, 0, c1, '2차 01 S2-4 (misread 판정과 같음)');
  await t.shot('E8f-off-click');
  await t.closeWindow();
  r.once('main', `가게를 나왔다.\n\n${r.status()}\n[shop: 성물 가게2|]`);
  r.on('updater', () => '{}');
  s = r.lastSeq();
  await t.send('밖으로 나간다.');
  await sleep(2500);
  const m8 = mainReqs(s)[0];
  check(S, '끈 뒤 본편 system 에 표식 지침 없음', !/\[shop: /.test(sysText(m8?.body ?? {})), '없음', '');
  check(S, '끈 뒤 응답의 표식은 지워짐(카드 없음)', (await t.page.locator('.default-chat-screen [data-goei-shop]').count()) === 0, 0, await t.page.locator('.default-chat-screen [data-goei-shop]').count(), 'settleShop');
  note(S, '다시 켬', await setShop('1'));
  // 소지품 끔 → 상점 꺼짐
  await r.setVars({ $it_on: '0' });
  r.once('main', `노점이 보였다.\n\n${r.status()}\n[shop: 노점|]`);
  s = r.lastSeq();
  await t.send('노점을 본다.');
  await sleep(2500);
  check(S, '소지품 끔 → 상점 꺼짐 (본편 표식 지침 없음·카드 없음)', !/\[shop: /.test(sysText(mainReqs(s)[0]?.body ?? {})) && (await t.page.locator('.default-chat-screen [data-goei-shop]').count()) === 0, '꺼짐', '', 'H-01');
  await r.setVars({ $it_on: '' });
}

// ═════ E9 본편 요청 실패 뒤 다시 보냄: 산 일이 두 번 실리지 않나 (코스 E-3, 공통 갈래 「본편 요청 실패·자동 재시도」) ═════
if (on('e9')) {
  const S = 'E9 본편 실패 뒤 다시 보냄';
  const SH9 = `<shop-identity>\nsells: 양초\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n<owner>\n어서 오세요.\n</owner>\n<shelf>\n밀랍 초|2000|소모1|소모품/초/candle|0.08|밀랍으로 만든 초||\n촛대|7000|-|도구/촛대/candlestick|0.4|놋쇠 촛대||\n성냥|500|소모20|소모품/성냥/matches|0.001|성냥 한 갑||\n</shelf>`;
  await enterShop(S, { name: '양초 가게', owner: '', shelf: SH9, say: '양초 가게에 들어간다.' });
  const st = await shopState();
  const it = st.items.find((x) => x.name === '촛대');
  await r.fclickAction('shop-detail', it.id); await r.fclickAction('shop-buy', it.id); await sleep(600);
  await leaveShop();
  // 이 말로 가는 첫 본편 요청만 503
  const replyFile = `${OUT}/.dyn-reply.txt`;
  await t.fake('rules', { rules: [{ id: 'fail9', route: 'main', matchLast: '촛대를 가방에 넣는다', failFirst: 1, status: 503, hold: true, replyFile }, { id: 'dyn', route: 'any', hold: true, replyFile }] });
  let s = r.lastSeq();
  await t.send('촛대를 가방에 넣는다.').catch(() => {});
  await sleep(3000);
  const failLog = (await t.fake(`log?since=${s}`)).filter((x) => x.ruleId === 'fail9');
  note(S, '503 으로 끊긴 본편 요청 수', failLog.length);
  const failTurn = failLog[0] ? (/^This turn:.*$/m.exec(msgsText(failLog[0].body)) || [''])[0] : '';
  note(S, '끊긴 요청의 This turn', failTurn.slice(0, 160));
  const screen = await t.screenMessages().catch(() => []);
  note(S, '실패 뒤 화면 마지막 두 줄', screen.slice(-2).map((m) => `${m.role ?? ''}:${String(m.text ?? m.data ?? '').slice(0, 60)}`));
  // 리스AI 가 같은 요청을 스스로 다시 보낸다 (자동 재시도). 두 번째 것이 성공(가짜 서버가 붙잡았다 기본 답)
  const retry = failLog[1];
  note(S, '두 번째 요청이 첫 요청과 같은 글인가 (dupOf)', failLog.map((x) => ({ seq: x.seq, dupOf: x.dupOf ?? null, action: x.action, status: x.response?.status })));
  r.save('E9-실패-재시도-본편', failLog.map((x) => ({ seq: x.seq, route: 'main', kind: `main(${x.response?.status ?? '?'})`, body: x.body, stream: x.stream })));
  const okTurn = retry ? (/^This turn:.*$/m.exec(msgsText(retry.body)) || [''])[0] : '';
  check(S, '자동 재시도 요청: 촛대 just bought 한 번 (두 번 아님)', (okTurn.match(/촛대/g) || []).length === 1, 1, okTurn.slice(0, 200), 'E-02·코스 E-3');
  const okAll = retry ? msgsText(retry.body) : '';
  check(S, '자동 재시도 요청: Recently 에 같은 구매 되풀이 없음', !/Recently:[^\n]*got 촛대/.test(okAll), '없음', (/Recently:[^\n]*/.exec(okAll) || [''])[0].slice(0, 200), 'E-02');
  r.once('main', `밖으로 나왔다.\n\n${r.status()}`);
  s = r.lastSeq();
  await t.send('가게를 나선다.');
  await sleep(3000);
  const next = mainReqs(s)[0];
  note(S, '그다음 턴 Recently', (/Recently:[^\n]*/.exec(next ? msgsText(next.body) : '') || ['(없음)'])[0].slice(0, 160));
  check(S, '그다음 턴: This turn 에 촛대 없음', !/^This turn:.*촛대/m.test(next ? msgsText(next.body) : ''), '없음', (/^This turn:.*$/m.exec(next ? msgsText(next.body) : '') || ['(줄 없음)'])[0].slice(0, 160), 'E-02');
  await t.fake('rules', { rules: [{ id: 'dyn', route: 'any', hold: true, replyFile }] });
}

r.writeResults(want.size ? `${OUT}결과-${[...want].join("-")}.json` : `${OUT}결과.json`);
await r.stop();
await t.close();
