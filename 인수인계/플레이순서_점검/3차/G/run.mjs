// 3차 점검 G · 쇼핑 (우주 쇼핑몰 · 백일몽 포인트몰 · 망상홈쇼핑). 실제 리스AI(996a553) + 가짜 모델 서버(이 구간 전용 8791)
// 사용: source /tmp/t2/t2-env.sh && FAKE_URL=http://<IP>:8791 node 인수인계/플레이순서_점검/3차/G/run.mjs [g1|g2|g3 …]
// 단계마다 기대값·결정표 줄을 먼저 적고(check 의 expect·row) 대조한다. 결과 out/결과-<묶음>.json, 요청 전문 out/*.txt
import { openRun, clickChatCard, sleep, STATES, msgsText, userText, sysText } from '../E/lib.mjs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const W = Number(process.env.W || 1280), H = Number(process.env.H || 800);
const want = new Set(process.argv.slice(2));
const on = (p) => !want.size || want.has(p);
const won = (n) => `${n.toLocaleString('en-US')}`;

// ═════════════════════ G1 우주 쇼핑몰 ═════════════════════
const COS_SHELF1 = `<shop-identity>
sells: 출처를 모르는 이상한 물건, 정보, 맞춤 제작
never: 환불, 반품, 흥정
prices: 계좌 이체 원화만 받는다, 모든 상품 비싸다
currency: -
</shop-identity>
<owner>
안녕하신가! 새로운 상품, 우리는 진열했다.
</owner>
<shelf>
반짝 걸음 구두약|15000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에. 걸음 반짝인다.|걸음이 빛남, 당신의|특가:18000|바른 신발로 걸으면 발소리가 사라지지만 한 시간 뒤 밑창이 녹는다
말 듣는 우산|22000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다, 위에서만.|???||?
내일 신문 한 장|900000|소모1|서류/신문/newspaper|0.05|읽는다. 내일이 쓰여 있다.|정확함 백 퍼센트|희귀|읽은 사람만 기사 내용을 곧 잊는다
녹슬지 않는 못|3000|-|도구/못/nail|0.004|박는다. 녹슬지 않는다.|||?
</shelf>`;
const COS_INFO = `<owner>
구두약 진짜다. 더 알고 싶으면, 쪽지 있다.
</owner>
<change mode="none">
</change>
<info>관리국 앞 발소리|5000|관리국 건물 앞 골목에 밤마다 발소리만 지나간다. 우리는 안다 그 발소리 주인.</info>`;
const COS_ORDER = `<owner>
만든다 우리는. 선불이다. 다섯 시간.
</owner>
<change mode="none">
</change>
<order>안 꺼지는 손전등|30000|5|손·사용|도구/손전등/flashlight|0.31|켠다. 꺼지지 않는다.|영원한 빛, 당신 손에|켜면 끌 수 없고 빛이 닿은 그림자가 주인을 따라온다</order>`;
const COS_HAGGLE = `<owner>
깎지 않는다 우리는. 값은 값이다.
</owner>
<change mode="none">
</change>`;
const COS_CLOSE = `<owner>
더 묻지 마라. 우리는 바쁘다.
</owner>
<change mode="none">
</change>
<closed/>`;
const COS_SELL = `<owner>
만 원. 우리는 그 이상 아니다.
</owner>
<change mode="none">
</change>
<offer>10000</offer>`;

async function g1() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const kindReqs = (seq, k) => r.since(seq, k);
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  const S0 = 'G1 우주몰';
  const v0 = await r.vars();
  note(S0, '시작: 잔고·자동 호출 설정', { wallet: r.J(v0, '$st_wallet'), auto: v0.$cos_auto ?? '(기본)' });
  // 열기: 상황판 → 인터넷 → 우주 쇼핑몰 (자동 호출 기본 「수동」이면 진열 요청 없음)
  await t.openWindow();
  await sleep(1200);
  const s0 = r.lastSeq();
  await r.fclickAction('nav-tab', 'net');
  await sleep(800);
  const hasCos = await t.feval(() => !!document.querySelector('.ms-cos'));
  if (!hasCos) await r.fclickAction('br-go', 'cos');
  if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) await r.fclickAction('br-site', 'cos');
  await sleep(1500);
  check(S0, '우주몰 창 열림', await t.feval(() => !!document.querySelector('.ms-cos')), true, await r.ftext('.gx').then((x) => x.slice(0, 200)));
  await sleep(1500);
  check(S0, '자동 호출 기본 「수동」: 열기만으로 진열 요청 없음', kindReqs(s0, 'cos').length === 0, 0, kindReqs(s0, 'cos').length, 'G-01');
  await t.shot('G1-open');
  // 새로고침 → 진열
  r.once('cos', COS_SHELF1);
  let s = r.lastSeq();
  await r.fclickAction('mall-refresh');
  await r.until(async () => kindReqs(s, 'cos').length, 15000);
  await sleep(1500);
  const shelfReq = kindReqs(s, 'cos')[0];
  r.save('G1-진열요청', kindReqs(s, 'cos'));
  const su = shelfReq ? userText(shelfReq.body) : '';
  check(S0, '진열 요청: 잔고 숨김', !/140,?000/.test(su + sysText(shelfReq?.body ?? {})), '없음', (/.{30}140,?000.{10}/.exec(su) || [''])[0], 'E-06');
  check(S0, '진열 요청: 우주몰 로어(sites.json 팝업 스토어·배송 곁에 바로) 들어감', /우주 쇼핑몰/.test(su), '있음', '', 'G-03');
  const cs = r.J(await r.vars(), '$cos_shop');
  const ids = Object.fromEntries((cs?.items ?? []).map((x) => [x.name, x.id]));
  check(S0, '진열 4개 저장', (cs?.items ?? []).length === 4, 4, (cs?.items ?? []).map((x) => x.name));
  await t.shot('G1-shelf');
  // 문의 → 정보 쪽지 → 사기
  r.once('cos', COS_INFO);
  s = r.lastSeq();
  await r.fclickAction('mall-ask', ids['반짝 걸음 구두약']);
  await sleep(500);
  await t.F().fill('.cs-askwin [data-input], .cs-askwin input[type="text"], .cs-askwin textarea', '구두약 진짜예요?');
  await r.fclickAction('mall-say');
  await r.until(async () => kindReqs(s, 'cos').length, 15000);
  await sleep(1500);
  const askReq = kindReqs(s, 'cos')[0];
  r.save('G1-문의', kindReqs(s, 'cos'));
  check(S0, '문의 요청: 상품 카드(구두약) 붙음', /반짝 걸음 구두약/.test(userText(askReq?.body ?? {}).slice(-800)), '붙음', userText(askReq?.body ?? {}).slice(-300), 'G-05');
  const askTxt = await r.ftext('.cs-askwin');
  check(S0, '문의 창: 정보 쪽지 보임', /관리국 앞 발소리/.test(askTxt), '쪽지', askTxt.slice(0, 200), 'G-06');
  await r.fclickAction('mall-note-buy');
  await sleep(1000);
  note(S0, '쪽지 산 뒤 문의 창', (await r.ftext('.cs-askwin')).slice(0, 200));
  // 흥정 → 고정값
  r.once('cos', COS_HAGGLE);
  s = r.lastSeq();
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '우산 좀 깎아 주세요');
  await r.fclickAction('mall-say');
  await r.until(async () => kindReqs(s, 'cos').length, 15000);
  await sleep(800);
  const hagReq = kindReqs(s, 'cos')[0];
  r.save('G1-흥정', kindReqs(s, 'cos'));
  note(S0, '흥정 요청: 지침이 값 고정(깎지 않음)을 말하나', (/(fixed|never haggle|no haggling|not negotiable)[^\n]{0,120}/i.exec(sysText(hagReq?.body ?? {})) || ['(못 찾음)'])[0]);
  // 맞춤 주문 견적 → 선납
  r.once('cos', COS_ORDER);
  s = r.lastSeq();
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '안 꺼지는 손전등 만들어 줄 수 있어요?');
  await r.fclickAction('mall-say');
  await r.until(async () => kindReqs(s, 'cos').length, 15000);
  await sleep(1200);
  await r.fclickAction('mall-quote-accept');
  await sleep(1200);
  const v1 = await r.vars();
  note(S0, '선납 뒤 주문·가계부', { orders: String(v1.$cos_orders ?? '').slice(0, 300), wallet: JSON.stringify(r.J(v1, '$st_wallet')?.log?.slice(-2)) });
  await r.fclickAction('mall-ask-close');
  await sleep(400);
  // 장바구니 2개 → 주문 → 입금
  await r.fclickAction('mall-cart', ids['반짝 걸음 구두약']);
  await r.fclickAction('mall-cart', ids['말 듣는 우산']);
  await r.fclickAction('mall-page', 'cart');
  await sleep(500);
  await r.fclickAction('mall-order');
  await sleep(600);
  await t.shot('G1-paywin');
  await r.fclickAction('mall-pay');
  await sleep(1500);
  const v2 = await r.vars();
  const items2 = (r.J(v2, '$st_items')?.list ?? []).map((x) => x.name);
  check(S0, '입금 뒤 소지품에 구두약·우산', items2.includes('반짝 걸음 구두약') && items2.includes('말 듣는 우산'), '둘 다', items2, 'G-05');
  // 잔고 모자람: 내일 신문 900,000
  await r.fclickAction('mall-page', '');
  await r.fclickAction('mall-cart', ids['내일 신문 한 장']);
  await r.fclickAction('mall-page', 'cart');
  await sleep(400);
  const cartTxt = await r.ftext('.ms-cos');
  const orderDisabled = await t.feval(() => { const b = document.querySelector('[data-action="mall-order"]'); return b ? b.disabled || b.getAttribute('aria-disabled') === 'true' : null; });
  note(S0, '잔고 모자람: 장바구니 화면·주문 단추', { orderDisabled, txt: cartTxt.slice(0, 200) });
  await r.fclickAction('mall-order');
  await sleep(500);
  await r.fclickAction('mall-pay');
  await sleep(1000);
  const items3 = (r.J(await r.vars(), '$st_items')?.list ?? []).map((x) => x.name);
  check(S0, '잔고 모자라면 안 삼', !items3.includes('내일 신문 한 장'), '안 삼', items3, 'G 4 갈래');
  await r.fclickAction('mall-pay-close');
  await r.fclickAction('mall-cart', ids['내일 신문 한 장']);
  await r.fclickAction('mall-page', '');
  await t.shot('G1-poor');
  await t.closeWindow();

  // 다음 본편: 산 것 한 번
  const S1 = 'G1 다음 본편';
  r.once('main', `휴대폰 화면이 꺼지자 방 안에 작은 상자 두 개가 떨어졌다.\n\n${r.status({ place: '관리국 숙소' })}`);
  s = r.lastSeq();
  await t.send('상자를 연다.');
  await sleep(2500);
  const m1 = r.since(s, 'main')[0];
  r.save('G1-본편1', r.since(s, 'main'));
  const tt = (/^This turn:.*$/m.exec(msgsText(m1?.body ?? {})) || [''])[0];
  check(S1, 'This turn: 구두약·우산 산 일 (송금으로)', /반짝 걸음 구두약/.test(tt) && /말 듣는 우산/.test(tt), '둘 다', tt.slice(0, 400), 'G-05·G-34');
  check(S1, '같은 줄에 맞춤 주문 선납 (custom order … paid in advance)', /안 꺼지는 손전등|custom order/.test(msgsText(m1?.body ?? {})), '있음', (/[^\n]{0,80}(custom order|손전등)[^\n]{0,120}/.exec(msgsText(m1?.body ?? {})) || [''])[0]);
  const m1u = msgsText(m1?.body ?? {});
  note(S1, '본편: 정보 쪽지(관리국 앞 발소리)가 가나', (/[^\n]{0,80}관리국 앞 발소리[^\n]{0,160}/.exec(m1u) || ['(없음)'])[0]);

  // 납기: 다섯 시간 뒤 본편 → [shop-ready] 카드
  const S2 = 'G1 납기·받기';
  r.once('main', `밤이 깊었다.\n\n${r.status({ place: '관리국 숙소' })}`);
  s = r.lastSeq();
  // 시각을 5시간 넘게 밀어 주는 답 (상태창 시각 칸)
  r.once('main', (body) => { const prev = /\[Previous status\][^\n]*\n(\[▣\|[^\n]*\])/.exec(msgsText(body))?.[1] ?? ''; const f = prev.slice(3, -1).split('|'); f[1] = '11:50 PM'; return `새벽이 되었다.\n\n[▣|${f.join('|')}]`; });
  await t.send('잠깐 눈을 붙인다.');
  await sleep(2000);
  await t.send('일어난다.');
  await sleep(2500);
  const readyCard = await t.page.locator('.default-chat-screen [data-goei-shop="cos"]').count();
  const lastTxt = (await t.screenMessages()).at(-1)?.text ?? '';
  check(S2, '납기 지나 본편 응답 아래 「받으러 가기」 카드', readyCard >= 1 && /완성|받으러/.test(lastTxt), '카드', { readyCard, lastTxt: lastTxt.slice(-120) }, 'G 1');
  await t.shot('G1-ready');
  if (readyCard) {
    await clickChatCard(t, '[data-goei-shop="cos"]');
    await sleep(1500);
    await r.fclickAction('mall-page', 'orders');
    await sleep(600);
    await r.fclickAction('mall-custom-take');
    await sleep(1200);
    const items4 = (r.J(await r.vars(), '$st_items')?.list ?? []).map((x) => x.name);
    check(S2, '받기 → 소지품에 손전등', items4.includes('안 꺼지는 손전등'), '있음', items4);
    await t.shot('G1-took');
  }
  // 팔기 (문의 창 → 판매)
  const S3 = 'G1 팔기·문의 끊음';
  await r.fclickAction('mall-page', '');
  await r.fclickAction('mall-ask', '');
  await sleep(500);
  await r.fclickAction('mall-sell-open');
  await sleep(500);
  const umb = (r.J(await r.vars(), '$st_items')?.list ?? []).find((x) => x.name === '말 듣는 우산');
  if (umb) {
    await r.fclickAction('mall-sell-pick', umb.id);
    await sleep(500);
    const emptySend = await t.feval(() => { const b = document.querySelector('.cs-askwin [data-action="mall-say"]'); const i = document.querySelector('.cs-askwin [data-input="mall-say"]'); return { disabled: b?.disabled ?? null, ph: i?.placeholder ?? '' }; });
    note(S3, '팔 물건 고른 뒤 빈 입력칸: 안내 글·전송 단추', emptySend);
    await t.shot('G1-sellcard');
    await t.F().fill('.cs-askwin [data-input="mall-say"]', '이 우산 얼마에 사요?');
    r.once('cos', COS_SELL);
    s = r.lastSeq();
    await r.fclickAction('mall-say');
    await r.until(async () => kindReqs(s, 'cos').length, 15000);
    await sleep(1200);
    r.save('G1-팔기', kindReqs(s, 'cos'));
    await r.fclickAction('mall-sell');
    await sleep(1000);
    const items5 = (r.J(await r.vars(), '$st_items')?.list ?? []).filter((x) => !x.gone && !x.soldAt).map((x) => x.name);
    check(S3, '1만 원에 팔기 → 소지품에서 우산 빠짐', !items5.includes('말 듣는 우산'), '빠짐', items5, 'G-05');
    note(S3, '판 뒤 가계부 마지막 줄', (r.J(await r.vars(), '$st_wallet')?.log ?? []).slice(-1));
  }
  // 문의 끊음 → 구매는 됨 → 새로고침해야 풀림
  r.once('cos', COS_CLOSE);
  s = r.lastSeq();
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '그 발소리 주인 누구예요?');
  await r.fclickAction('mall-say');
  await r.until(async () => kindReqs(s, 'cos').length, 15000);
  await sleep(1200);
  const askDisabled = await t.feval(() => { const i = document.querySelector('.cs-askwin [data-input="mall-say"]'); return i ? i.disabled : null; });
  check(S3, '문의 끊음 → 입력 막힘', askDisabled === true, true, askDisabled, 'G-07');
  await r.fclickAction('mall-ask-close');
  const csNow = r.J(await r.vars(), '$cos_shop');
  const anyOpen = (csNow?.items ?? []).find((x) => !x.sold && x.name === '녹슬지 않는 못');
  if (anyOpen) {
    await r.fclickAction('mall-cart', anyOpen.id); await r.fclickAction('mall-page', 'cart'); await r.fclickAction('mall-order'); await r.fclickAction('mall-pay'); await sleep(1000);
  }
  check(S3, '문의 끊긴 뒤에도 구매는 됨 (못 3,000원)', (r.J(await r.vars(), '$st_items')?.list ?? []).some((x) => x.name === '녹슬지 않는 못'), '삼', anyOpen?.name, 'G-07');
  r.once('cos', `<owner>\n새것 왔다.\n</owner>\n<shelf>\n접히는 계단|26000|사용|도구/계단/stairs|1.8|편다. 어디든 위로 간다.|높은 곳||?\n우는 거울|41000|-|잡동사니/거울/mirror|0.62|본다. 운다.|슬픔을 대신||?\n식지 않는 차|8000|소모1|음식/차/tea|0.3|마신다. 식지 않는다.|따뜻함||?\n</shelf>`);
  s = r.lastSeq();
  await r.fclickAction('mall-page', '');
  // 「쇼핑몰 새로고침」= 브라우저 주소줄 ↻ (진열이 남아 있으면 「상품 가져오기」 단추는 없다)
  note(S3, '진열이 남은 동안 「상품 가져오기」 단추', await t.feval(() => !!document.querySelector('.ms-cos [data-action="mall-refresh"]')));
  const chrome = await t.feval(() => ({ reload: [...document.querySelectorAll('[data-action="br-reload"]')].filter((e) => e.offsetParent !== null).length, tabs: !!document.querySelector('[data-action="br-tab"]'), nav: !!document.querySelector('[data-action="nav-tab"]') }));
  note(S3, '지금 창 (주소줄 ↻ 수·탭·메뉴) — 「받으러 가기」 카드로 연 단독 창인가', chrome);
  await t.shot('G1-closed-solo');
  if (!chrome.reload) {
    check(S3, '단독 창에서도 문의 끊음을 풀 길(↻ 또는 상품 가져오기)이 있다', false, '있음', chrome, 'G-07');
    await t.closeWindow(); await sleep(600); await t.openWindow(); await sleep(1000);
    if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net'); await sleep(500); if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); await sleep(800); }
  }
  await r.fclickAction('br-reload');
  await r.until(async () => kindReqs(s, 'cos').length, 15000);
  await sleep(2500);
  r.save('G1-끊긴뒤-새로고침', kindReqs(s, 'cos'));
  note(S3, '새로고침 뒤: 안내·실패 글·진열', { info: await r.ftext('.cs-info'), fail: await r.ftext('.cs-fail'), items: (r.J(await r.vars(), '$cos_shop')?.items ?? []).map((x) => `${x.name}${x.sold ? '(팔림)' : ''}`), closed: r.J(await r.vars(), '$cos_shop')?.closed });
  await r.fclickAction('mall-ask', '');
  await sleep(500);
  const askDisabled2 = await t.feval(() => { const i = document.querySelector('.cs-askwin [data-input="mall-say"]'); return i ? i.disabled : null; });
  check(S3, '쇼핑몰 새로고침 → 문의 풀림, 그 전 대화 남음', askDisabled2 === false && /발소리/.test(await r.ftext('.cs-askwin')), '풀림·대화 남음', { askDisabled2 }, 'G-07');
  await t.shot('G1-reopen');

  // 갈래: 문의 답 기다리다 새로고침 → 친 말이 입력칸으로
  const S4 = 'G1 갈래';
  if (await t.feval(() => document.querySelector('.cs-askwin [data-input="mall-say"]')?.disabled !== false)) { note(S4, '건너뜀', '문의가 아직 막혀 있어 이 갈래를 못 돎'); r.writeResults(`${OUT}결과-g1.json`); await r.stop(); await t.close(); return; }
  r.hold('cos');
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '계단 몇 층까지 돼요?');
  await r.fclickAction('mall-say');
  await r.until(async () => r.held().length, 10000);
  await t.reload();
  await r.unhold('cos');
  await sleep(1500);
  await t.openWindow();
  await sleep(1200);
  await r.fclickAction('nav-tab', 'net');
  await sleep(800);
  await r.fclickAction('mall-ask', '');
  await sleep(800);
  const back = await t.feval(() => document.querySelector('.cs-askwin [data-input="mall-say"]')?.value ?? null).catch(() => null);
  check(S4, '문의 답 기다리다 새로고침 → 친 말이 입력칸으로', back === '계단 몇 층까지 돼요?', '계단 몇 층까지 돼요?', back, '업데이트내역 v0.21.34·코스 G4');
  await r.fclickAction('mall-ask-close');
  await t.closeWindow();
  // 갈래: 산 턴 다시 굴리기 → 돈 오간 것만 되돌고 쪽지·견적 남음 (G-06)
  r.writeResults(`${OUT}결과-g1.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ G2 백일몽 포인트몰 ═════════════════════
const BM_SHELF1 = `<shop-identity>
sells: 임직원 복지 생활용품, 가전, 건강식품, 현장탐사 보급품
never: 현금, 무기
prices: 생활용품 수십~수백 p, 가전 수백 p, 특수 보급품은 수천 p
</shop-identity>
<owner>
3월 신규 입고 상품을 안내드립니다.
</owner>
<shelf>
휴대용 손난로|40|소모5|소모품/손난로/hand warmer|0.052|5개 묶음 손난로||특가:60
무선 전기주전자|380|사용|기기/주전자/kettle|1.12|1.2L 무선 주전자||
현장용 방진 마스크|900p|소모3|의료/마스크/mask|0.031|현장탐사용 3매||
정체불명 앰플|1200|소모1|의료/앰플/ampoule|0.012|연구부 미공개 시약|피로가 가신다|희귀
사내 식권|사진 한 장|소모1|서류/식권/meal ticket|0.004|구내식당 식권||
고급 안마의자|12000|사용|기기/안마의자/massage chair|38.5|임원 휴게실 반출품||
</shelf>`;
const DESK_MAKE = `<card>
이름: 한서윤
직급: 대리
부서: 총무팀
소개: 복지몰 문의를 맡은 총무팀 대리
말투: 짧고 사무적
</card>
<say>네 총무팀 한서윤입니다. 무슨 일이세요</say>`;
const DESK_MAKE2 = `<card>
이름: 오태민
직급: 사원
부서: 보안팀 대여창고
소개: 대여창고 근무 중 상담을 떠맡은 사원
말투: 느릿하고 귀찮은 티
</card>
<say>네… 보안팀 오태민입니다.</say>`;

async function g2() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const kindReqs = (seq, k) => r.since(seq, k);
  const openBm = async () => { if (await t.feval(() => !!document.querySelector('.ms-bm'))) return; await r.fclickAction('nav-tab', 'net'); await sleep(600); if (await t.feval(() => !!document.querySelector('.ms-bm'))) return; if (!(await r.fclickAction('br-go', 'bm'))) await r.fclickAction('br-site', 'bm'); await sleep(1000); };
  const ptsUI = async () => { const m = /([\d,]+)\s*P/i.exec(await r.ftext('.bp-pt')); return m ? Number(m[1].replace(/,/g, '')) : null; };
  await t.setup();
  await t.loadState(STATES + 'S-백일몽-3턴.json');
  await sleep(1500);
  const S0 = 'G2 포인트몰';
  const v0 = await r.vars();
  note(S0, '시작: 포인트·장부·자동 호출', { points: r.J(v0, '$st_points'), on: v0.$st_points_on, auto: v0.$bm_auto ?? '(기본)' });
  await t.openWindow();
  await sleep(1200);
  const s0 = r.lastSeq();
  await r.fclickAction('nav-tab', 'net');
  await sleep(800);
  const fav = await t.feval(() => [...document.querySelectorAll('[data-action="br-go"],[data-action="br-site"]')].map((e) => e.getAttribute('data-value')));
  note(S0, '인터넷 즐겨찾기·사이트 단추', fav);
  if (!(await r.fclickAction('br-go', 'bm'))) await r.fclickAction('br-site', 'bm');
  await sleep(1500);
  check(S0, '포인트몰 창 열림', await t.feval(() => !!document.querySelector('.ms-bm')), true, (await r.ftext('.gx')).slice(0, 200));
  check(S0, '자동 호출 기본 「수동」: 열기만으로 진열 요청 없음', kindReqs(s0, 'bm').length === 0, 0, kindReqs(s0, 'bm').length, 'G-01');
  const before = await r.ftext('.ms-bm');
  note(S0, '로그인 전 화면', before.slice(0, 200));
  if (/로그인이 필요/.test(before)) {
    await r.fclickAction('br-login');
    await sleep(500);
    await t.F().fill('input[name="br-nick"]', '현장탐사팀 신입');
    await r.fclickAction('br-login-save');
    await sleep(1000);
  }
  check(S0, '로그인 뒤 보유 포인트 5,000P 보임', (await ptsUI()) === 5000, 5000, await r.ftext('.bp-me'), 'G-08');
  await t.shot('G2-open');
  // 진열
  r.once('bm', BM_SHELF1);
  let s = r.lastSeq();
  await r.fclickAction('mall-refresh');
  await r.until(async () => kindReqs(s, 'bm').length, 15000);
  await sleep(1500);
  const req = kindReqs(s, 'bm')[0];
  r.save('G2-진열요청', kindReqs(s, 'bm'));
  const all = req ? msgsText(req.body) : '';
  check(S0, '진열 요청: 원 잔고 없음', !/140,?000/.test(all), '없음', (/.{30}140,?000.{10}/.exec(all) || [''])[0], 'E-06·G-16');
  check(S0, '진열 요청: 포인트 잔고 칸 없음 (상태창 포인트 칸·「남은 포인트」 줄 X. 이야기 본문 속 「5,000 포인트 들어갔을 거예요」는 이야기라 셈하지 않음)', !/\|5000\]|남은 포인트|points?:\s*5,?000/i.test(all), '없음', (/.{30}(\|5000\]|남은 포인트).{10}/.exec(all) || [''])[0], 'G-08·지침 COMMON');
  check(S0, '진열 요청: 「포인트 지급」 말 없음 (몰이 지급 X)', !/포인트[^\n]{0,6}지급|grant(s|ed)? points|hands? out points/i.test(all.replace(/never hands out, grants or pays points|never about points being issued or granted/g, '')), '없음', (/.{40}지급.{20}/.exec(all) || [''])[0], 'G-08');
  note(S0, '진열 요청: 값 배정 최고가 줄 (손-03)', (/최고가[^\n]{0,120}/.exec(all) || /3000[^\n]{0,40}9999[^\n]{0,60}/.exec(all) || ['(배정 줄 없음)'])[0]);
  note(S0, '진열 요청: COMMON 「owner = 몰 공지」와 FIRST 절 (손-10)', { common: (/the "owner" line is[^\n]{0,160}/.exec(all) || [''])[0], first: (/<owner>\n[^\n]{0,120}/.exec(all) || [''])[0] });
  const bs = r.J(await r.vars(), '$bm_shop');
  const names = (bs?.items ?? []).map((x) => `${x.name}:${x.price}${x.pay ? '+' + x.pay : ''}${x.tag ? '/' + x.tag : ''}`);
  note(S0, '저장된 진열', names);
  check(S0, '현물 값 줄(사내 식권 「사진 한 장」) 버림', !names.some((x) => x.startsWith('사내 식권')), '없음', names, 'G-12');
  check(S0, '「900p」 값은 900 포인트로', names.some((x) => x.startsWith('현장용 방진 마스크:900') && !x.includes('+')), '900', names, 'G-12');
  note(S0, '9,999p 넘는 값(안마의자 12,000p)', names.find((x) => x.startsWith('고급 안마의자')) ?? '(없음)');
  const page = await r.ftext('.ms-bm');
  check(S0, '첫 화면 공지는 몰 공지 띠에 (주인 대사 아님)', /3월 신규 입고 상품을 안내드립니다/.test(await r.ftext('.bp-ban')), '띠에 있음', (await r.ftext('.bp-ban')).slice(0, 120), 'G-10');
  const acts = await t.feval(() => [...new Set([...document.querySelectorAll('.ms-bm [data-action]')].map((e) => e.getAttribute('data-action')))]);
  check(S0, '말하기·흥정·팔기 단추 없음 (1:1 상담만)', !acts.some((a) => /mall-say|mall-sell|mall-note|mall-quote/.test(a)), '없음', acts, 'G-09');
  check(S0, '분류: 전체·이달의 한정·특가·주문 조회', /이달의 한정/.test(page) && /특가/.test(page) && /주문 조회/.test(page), '있음', page.slice(0, 200), 'G-35');
  await t.shot('G2-shelf');
  // 사기
  const id = (n) => (bs?.items ?? []).find((x) => x.name === n)?.id;
  const chairBtn = await t.feval((i) => { const b = document.querySelector(`.ms-bm [data-action="mall-buy"][data-value="${i}"]`); return b ? { dis: b.disabled, txt: b.textContent } : null; }, id('고급 안마의자'));
  check(S0, '포인트 모자란 물건은 「포인트 부족」·못 누름', chairBtn?.dis === true && /포인트 부족/.test(chairBtn?.txt ?? ''), '포인트 부족', chairBtn);
  s = r.lastSeq();
  await r.fclickAction('mall-buy', id('정체불명 앰플'));
  await sleep(1200);
  check(S0, '앰플 1,200p 구매 → 3,800P', (await ptsUI()) === 3800, 3800, await ptsUI(), 'G-08');
  check(S0, '구매에 모델 호출 없음', kindReqs(s, 'bm').length === 0, 0, kindReqs(s, 'bm').length, 'G-09');
  note(S0, '구매 뒤 안내', await r.ftext('.bp-info'));
  const v1 = await r.vars();
  note(S0, '포인트 장부·소지품', { points: r.J(v1, '$st_points'), items: (r.J(v1, '$st_items')?.list ?? []).map((x) => x.name) });
  check(S0, '구매 직후 소지품엔 아직 없음 (본사에서 수령)', !(r.J(v1, '$st_items')?.list ?? []).some((x) => x.name === '정체불명 앰플'), '없음', '', 'G-13');
  await r.fclickAction('mall-page', 'orders');
  await sleep(600);
  const ord = await r.ftext('.bp-main');
  check(S0, '주문 조회: 앰플 수령 대기·본사 대여창고 안내', /정체불명 앰플/.test(ord) && /수령 대기/.test(ord) && /대여창고/.test(ord), '수령 대기', ord.slice(0, 200), 'G-13');
  await t.shot('G2-orders');
  // 소지품 기록 화면 (G-33): 「1,200 P · 백일몽 포인트몰」
  await t.closeWindow();
  // 다음 본편: PICKUP_WAIT 줄
  r.once('main', `진나솔이 서류를 넘겼다.\n\n${r.status({ pts: 3800 })}`);
  s = r.lastSeq();
  await t.send('서류를 정리한다.');
  await sleep(3000);
  let mr = kindReqs(s, 'main')[0];
  r.save('G2-본편-수령전', kindReqs(s, 'main'));
  let mt = mr ? msgsText(mr.body) : '';
  check(S0, '본편: 산 일 한 번 + 안 받은 물건 줄(PICKUP_WAIT)', /정체불명 앰플/.test(mt) && /not collected yet/.test(mt), '둘 다', (/[^\n]{0,80}not collected yet[^\n]{0,120}/.exec(mt) || [''])[0], 'G-13');
  note(S0, '본편: 포인트 구매 줄', (/[^\n]{0,60}1,?200[^\n]{0,80}/.exec(mt) || ['(없음)'])[0]);
  check(S0, '본편: 「paid … won」 아닌 포인트로', !/정체불명 앰플[^\n]{0,80}won/.test(mt), '원 아님', (/정체불명 앰플[^\n]{0,120}/.exec(mt) || [''])[0], 'G-08');
  // 받기 → 수령하러 감 → 다음 본편 PICKUP_TRY → 갱신기 pickup
  await t.openWindow();
  await sleep(1000);
  note(S0, '창 다시 열면 마지막 탭(포인트몰) 그대로', await t.feval(() => !!document.querySelector('.ms-bm')));
  await openBm();
  await r.fclickAction('mall-page', 'orders');
  await sleep(500);
  const ordId = (r.J(await r.vars(), '$bm_orders') ?? []).find?.((o) => o.item?.name === '정체불명 앰플')?.id;
  if (ordId) await r.fclickAction('mall-pickup', ordId); else await r.fclickAction('mall-pickup-all');
  await sleep(800);
  const ord2 = await r.ftext('.bp-main');
  check(S0, '받기 → 「수령하러 감」', /수령하러 감/.test(ord2), '수령하러 감', ord2.slice(0, 200), 'G-13');
  await t.closeWindow();
  r.once('main', `대여창고 직원이 상자를 건넸다. 정체불명 앰플이 들어 있었다.\n\n${r.status({ pts: 3800, place: '서울 강남구 백일몽 본사 보안팀 대여창고' })}`);
  r.on('updater', (body) => (/pickup_check/.test(msgsText(body)) ? JSON.stringify({ pickup: ['정체불명 앰플'] }) : '{}'));
  s = r.lastSeq();
  await t.send('대여창고에 가서 받는다.');
  await sleep(6000);
  mr = kindReqs(s, 'main')[0];
  r.save('G2-본편-받으러감', [...kindReqs(s, 'main'), ...kindReqs(s, 'updater')]);
  mt = mr ? msgsText(mr.body) : '';
  check(S0, '받으러 간 턴 본편에 PICKUP_TRY 한 번', (mt.match(/sets out to collect in person/g) || []).length === 1, 1, (/[^\n]{0,40}sets out to collect[^\n]{0,160}/.exec(mt) || [''])[0], 'G-13');
  const up = kindReqs(s, 'updater').find((x) => /pickup_check/.test(msgsText(x.body)));
  check(S0, '갱신기에 pickup_check 감', !!up, '감', kindReqs(s, 'updater').length, 'G-13');
  await r.until(async () => (r.J(await r.vars(), '$st_items')?.list ?? []).some((x) => x.name === '정체불명 앰플'), 15000);
  const v2 = await r.vars();
  check(S0, '갱신기가 받았다고 하면 소지품에 앰플', (r.J(v2, '$st_items')?.list ?? []).some((x) => x.name === '정체불명 앰플'), '있음', (r.J(v2, '$st_items')?.list ?? []).map((x) => x.name), 'G-13');
  // 소지품 화면 기록 줄 (G-33)
  await t.openWindow();
  await sleep(1000);
  const navs = await t.feval(() => [...document.querySelectorAll('[data-action="nav-tab"]')].map((e) => e.getAttribute('data-value')));
  note(S0, '탭', navs);
  await r.fclickAction('nav-tab', 'items');
  await sleep(600);
  await r.fclickAction('items-sub', 'items');
  await r.fclickAction('items-view', 'log');
  await sleep(600);
  const invTxt = await r.ftext('.gx');
  check(S0, '소지품 기록에 「1,200 P · 백일몽 포인트몰」', /1,200 P · 백일몽 포인트몰/.test(invTxt), '1,200 P · 백일몽 포인트몰', (/[^ ]{0,20}1,200[^·]{0,10}·[^\n]{0,20}/.exec(invTxt) || [invTxt.slice(0, 160)])[0], 'G-33');
  await t.shot('G2-inventory');

  // ── 1:1 상담 ──
  const S1 = 'G2 1:1 상담';
  await openBm();
  r.once('desk', DESK_MAKE);
  s = r.lastSeq();
  await r.fclickAction('mall-ask', '');
  await r.until(async () => kindReqs(s, 'desk').length, 15000);
  await sleep(1200);
  const mk = kindReqs(s, 'desk')[0];
  const mkt = mk ? msgsText(mk.body) : '';
  r.save('G2-상담-연결', kindReqs(s, 'desk'));
  check(S1, '상담 연결 요청: 원 잔고 없음', !/140,?000/.test(mkt), '없음', (/.{30}140,?000.{10}/.exec(mkt) || [''])[0], 'G-16');
  note(S1, '상담 연결 요청: 손님 칸', (/\[손님\][^\n]*\n[^\n]*\n[^\n]*/.exec(mkt) || ['(손님 칸 없음 — 연결 요청엔 안 붙음?)'])[0]);
  check(S1, '상담 창: 상담사 이름표·첫 인사', /한서윤/.test(await r.ftext('.bd-win')) && /무슨 일이세요/.test(await r.ftext('.bd-win')), '한서윤', (await r.ftext('.bd-win')).slice(0, 160), 'G-09');
  r.once('desk', `<say>네 수령은 대여창고에서만 됩니다</say>`);
  s = r.lastSeq();
  await t.F().fill('.bd-win [data-input="mall-say"]', '택배로 받을 수는 없나요?');
  await r.fclickAction('mall-say');
  await r.until(async () => kindReqs(s, 'desk').length, 15000);
  await sleep(1200);
  const tk = kindReqs(s, 'desk')[0];
  const tkt = tk ? msgsText(tk.body) : '';
  r.save('G2-상담-말', kindReqs(s, 'desk'));
  check(S1, '상담 말 요청: 손님 칸에 남은 포인트 3800p, 원 잔고 없음', /남은 포인트: 3,?800p/.test(tkt) && !/140,?000/.test(tkt), '3800p·원 없음', (/\[손님\][^\n]*\n[^\n]*\n[^\n]*/.exec(tkt) || [''])[0], 'G-16');
  // × 닫았다 열면 같은 상담사
  await r.fclickAction('mall-ask-close');
  s = r.lastSeq();
  await r.fclickAction('mall-ask', '');
  await sleep(1500);
  check(S1, '× 닫았다 다시 열면 같은 상담사 (새 연결 요청 없음)', /한서윤/.test(await r.ftext('.bd-win')) && kindReqs(s, 'desk').length === 0, '한서윤·요청 0', { win: (await r.ftext('.bd-win')).slice(0, 80), reqs: kindReqs(s, 'desk').length }, 'G-14');
  // 상담사가 끊음 <end/>
  r.once('desk', `<say>그건 제 소관이 아니라서요. 이만 끊겠습니다</say>\n<end/>`);
  s = r.lastSeq();
  await t.F().fill('.bd-win [data-input="mall-say"]', '그럼 대신 받아 주실 수 있어요?');
  await r.fclickAction('mall-say');
  await r.until(async () => kindReqs(s, 'desk').length, 15000);
  await sleep(1200);
  const endWin = await r.ftext('.bd-win');
  note(S1, '끊은 뒤 창', endWin.slice(-160));
  check(S1, '끊은 뒤 입력칸 막힘', await t.feval(() => document.querySelector('.bd-win [data-input="mall-say"]')?.disabled === true), true, '', 'G-14');
  await r.fclickAction('mall-ask-close');
  r.once('desk', DESK_MAKE2);
  s = r.lastSeq();
  await r.fclickAction('mall-ask', '');
  await r.until(async () => kindReqs(s, 'desk').length, 15000).catch(() => {});
  await sleep(1500);
  const w2 = await r.ftext('.bd-win');
  check(S1, '끊긴 뒤 다시 열면 다른 상담사', /오태민/.test(w2), '오태민', w2.slice(0, 120), 'G-14');
  const mk2 = kindReqs(s, 'desk')[0];
  note(S1, '두 번째 연결 요청: 지난 상담사 줄', (/한서윤[^\n]{0,120}/.exec(mk2 ? msgsText(mk2.body) : '') || ['(없음)'])[0]);
  r.once('desk', `<say>네…</say>`);
  await t.F().fill('.bd-win [data-input="mall-say"]', '앰플 효과가 뭔가요?');
  await r.fclickAction('mall-say');
  await sleep(2500);
  // 「상담 종료」로 끝냄 → 다음 본편에 MALL.DESK
  await r.fclickAction('mall-desk-end');
  await sleep(800);
  await t.closeWindow();
  r.once('main', `오후가 지나갔다.\n\n${r.status({ pts: 3800 })}`);
  s = r.lastSeq();
  await t.send('자리로 돌아온다.');
  await sleep(4000);
  mr = kindReqs(s, 'main')[0];
  r.save('G2-본편-상담뒤', kindReqs(s, 'main'));
  mt = mr ? msgsText(mr.body) : '';
  const deskLines = (mt.match(/chatted by text with a counselor[^\n]*/g) || []);
  note(S1, '본편의 상담 줄', deskLines);
  check(S1, '끊긴 상담·종료한 상담 둘 다 다음 본편에 (각 한 번)', (mt.match(/택배로 받을 수는 없나요/g) || []).length === 1 && (mt.match(/앰플 효과가 뭔가요/g) || []).length === 1, '각 1', deskLines.map((x) => x.slice(0, 200)), 'G-14 (0.21.34)');

  // ── 백일몽을 나온 뒤 (G-15) ──
  const S2 = 'G2 백일몽 나옴';
  r.once('main', `사직서가 수리되었다. 이제 프리랜서다.\n\n${r.status({ rank: '프리랜서/5급', pts: 3800 })}`);
  s = r.lastSeq();
  await t.send('사직서를 낸다.');
  await sleep(4000);
  r.once('main', `거리로 나왔다.\n\n${r.status({ rank: '프리랜서/5급' })}`);
  await t.send('밖으로 나간다.');
  await sleep(4000);
  const v3 = await r.vars();
  note(S2, '나온 뒤 포인트 칸 표시', { on: v3.$st_points_on });
  await t.openWindow();
  await sleep(1000);
  const stillBm = await t.feval(() => !!document.querySelector('.ms-bm'));
  note(S2, '창 열면 남아 있던 포인트몰 탭', stillBm);
  if (!stillBm) { await r.fclickAction('nav-tab', 'net'); await sleep(800); }
  const fav2 = await t.feval(() => [...document.querySelectorAll('[data-action="br-go"]')].map((e) => e.getAttribute('data-value')));
  check(S2, '즐겨찾기에서 포인트몰 빠짐', !fav2.includes('bm'), '없음', fav2, 'G-15');
  if (!(await t.feval(() => !!document.querySelector('.ms-bm')))) { const tabs = await t.feval(() => [...document.querySelectorAll('[data-action="br-tab"]')].map((e) => e.innerText)); note(S2, '브라우저 탭', tabs); }
  note(S2, '남은 포인트몰 탭 (있으면)', (await r.ftext('.ms-bm')).slice(0, 200));
  if (await t.feval(() => !!document.querySelector('.ms-bm'))) {
    s = r.lastSeq();
    await r.fclickAction('br-reload');
    await sleep(1500);
    check(S2, '진열 새로고침 막힘·「임직원만」', kindReqs(s, 'bm').length === 0 && /임직원/.test(await r.ftext('.ms-bm')), '막힘', (await r.ftext('.bp-info, .ms-bm')).slice(0, 160), 'G-15');
    await r.fclickAction('mall-ask', '');
    await sleep(800);
    check(S2, '1:1 상담 막힘', kindReqs(s, 'desk').length === 0, 0, kindReqs(s, 'desk').length, 'G-15');
  }
  await t.shot('G2-left');
  await t.closeWindow();
  r.writeResults(`${OUT}결과-g2.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ G3 망상홈쇼핑 ═════════════════════
// 편성: 1부 원+시연(100,000원) · 2부 시연만 · 3부 원만(30,000원). 지침 BROADCAST 꼴. 매진 줄 없음
const HS_SHOW = `<title>
금요 심야 특가
</title>
<shelf>
붉은 리본 손전등|100000|손|도구/손전등/flashlight|0.246|켜면 붉은 빛이 납니다. 스티커: 사람에게 비추지 말 것.|어둠 속 길이 보인다|O|빛에 닿은 그림자를 떼어 낸다. 사람 그림자에 세 번 비추면 풀린다
따뜻한 손난로|-|소모3|소모품/손난로/hand warmer|0.054|쥐면 금방 따뜻해집니다. 스티커: 남의 손에 쥐여 주지 말 것.|손이 따뜻해진다|O|체온을 옮기는 주머니. 남이 쥐면 그 사람 체온이 넘어온다
세 번 우는 벽시계|30000|사용|기기/벽시계/wall clock|1.84|정각마다 세 번 웁니다. 스티커: 네 번째를 세지 말 것.|시간을 알려 준다|-|부르는 종. 네 번째 울음을 세면 따라간다
</shelf>
<cue>
#1
wide|talk|고객님들, 오늘도 잠 못 드셨죠? 잘 오셨습니다.|-
product|talk|첫 상품, 붉은 리본 손전등입니다.|-
bust|talk|어두운 골목도 이 빛 하나면 길이 열립니다.|-
wide|talk|오늘만 십만 원, 시연 참여도 됩니다!|price
bust|talk|전화가 몰리고 있어요, 서두르세요.|rush
wide|talk|남은 수량이 줄고 있습니다.|left -3
#2
wide|talk|다음은 따뜻한 손난로입니다.|-
bust|talk|시연 참여로만 드려요.|price
#3
wide|talk|마지막, 세 번 우는 벽시계!|-
bust|talk|정각마다 세 번, 꼭 세 번만 웁니다.|price
</cue>
<chat>
#1
야식왕|저거 진짜 켜져요?
???|여기 안에 있어요
#2
하루|손난로 귀엽다
#3
rose|시계 소리 왜 이럼
</chat>`;

async function g3() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const kindReqs = (seq, k) => r.since(seq, k);
  const show = async () => r.J(await r.vars(), '$hs_show');
  const orders = async () => r.J(await r.vars(), '$hs_orders') ?? [];
  const liveItemNames = async () => (r.J(await r.vars(), '$st_items')?.list ?? []).filter((x) => !x.soldAt && !x.outAt && !x.gone).map((x) => x.name);
  const balUI = async () => { const m = /₩\s*([\d,]+)/.exec(await r.ftext('.gx')); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const updaterHs = (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name: '망상홈쇼핑', owner: '@web', m } }) : '{}'; };
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  const S0 = 'G3 망상홈쇼핑';
  note(S0, '시작 설정', { auto: (await r.vars()).$hs_sh_auto ?? '(기본)', net: (await r.vars()).$hs_net ?? '(기본)' });
  // 본편: 휴대폰에 앱이 켜짐 → 접속 표식
  const offU = r.on('updater', updaterHs);
  r.once('main', `로비 소파에 앉자 휴대폰이 혼자 켜졌다. 깔지 않은 앱 「망상홈쇼핑 라이브」가 붉은 화면을 띄웠다.\n[shop: 망상홈쇼핑|@web]\n\n${r.status()}`);
  let s = r.lastSeq();
  await t.send('휴대폰을 본다.');
  await sleep(6000);
  offU();
  const cardSel = '[data-goei-shop="hs"]';
  const hasCard = await t.page.evaluate((sel) => { const q = (d) => d.querySelector(sel); if (q(document)) return true; for (const f of document.querySelectorAll('iframe')) { try { if (q(f.contentDocument)) return true; } catch {} } return false; }, cardSel).catch(() => false);
  check(S0, '본편 응답 아래 「접속하기」 카드', hasCard, true, (await t.page.evaluate(() => document.body.innerText.slice(-300)).catch(() => '')), 'G-17');
  await t.shot('G3-card');
  r.once('hs', HS_SHOW);
  s = r.lastSeq();
  await clickChatCard(t, cardSel);
  await sleep(2000);
  await r.until(async () => kindReqs(s, 'hs').length, 15000).catch(() => {});
  await sleep(2500);
  const solo = await t.feval(() => ({ hs: !!document.querySelector('.hs'), tabs: !!document.querySelector('[data-action="br-tab"]'), addr: !!document.querySelector('.br-addr, [data-action="br-reload"]'), fav: !!document.querySelector('[data-action="br-go"]'), nav: !!document.querySelector('[data-action="nav-tab"]'), close: [...document.querySelectorAll('[data-action="close"], [data-action="br-solo-close"]')].length }));
  check(S0, '단독 창: 탭·주소줄·즐겨찾기·메뉴 없이 사이트만', solo.hs && !solo.tabs && !solo.addr && !solo.fav && !solo.nav, '사이트만', solo, 'G-17');
  await t.shot('G3-solo');
  const req = kindReqs(s, 'hs')[0];
  r.save('G3-편성요청', kindReqs(s, 'hs'));
  note(S0, '열자마자 편성 요청 수 (자동 호출 기본값)', kindReqs(s, 'hs').length);
  const all = req ? msgsText(req.body) : '';
  check(S0, '편성 요청에 잔고 없음', !/140,?000/.test(all), '없음', (/.{30}140,?000.{10}/.exec(all) || [''])[0], 'E-06');
  const sh = await show();
  check(S0, '편성 3부 저장, 지금 1부', sh?.parts?.length === 3 && sh.at === 0, '3부·1부', sh && { n: sh.parts?.length, at: sh.at });
  // 방송 흐름: 전화 창 열린 동안 멈춤 (G-18)
  await sleep(4000);
  const before = await t.feval(() => document.querySelector('.hs-cap, .hs-line, .hs-sub')?.innerText ?? '');
  r.once('hsop', '<operator>\n네에, 붉은 리본 손전등 주문 전화 감사합니다.\n</operator>');
  s = r.lastSeq();
  await r.fclickAction('hs-pop', 'call');
  await r.until(async () => kindReqs(s, 'hsop').length, 15000).catch(() => {});
  await sleep(1500);
  const hello = kindReqs(s, 'hsop')[0];
  r.save('G3-상담원첫말', kindReqs(s, 'hsop'));
  const ht = hello ? msgsText(hello.body) : '';
  check(S0, '상담원 첫 말 요청: 잔고 없음', !/140,?000/.test(ht), '없음', '', 'G-20·E-06');
  const pcLayout = await t.feval(() => { const p = document.querySelector('.hs-pop'); const side = p?.querySelector('.hs-side'); const log = p?.querySelector('.hs-callog'); if (!p || !side || !log) return null; const a = side.getBoundingClientRect(); const b = log.getBoundingClientRect(); return { sideX: Math.round(a.x), logX: Math.round(b.x) }; });
  check(S0, 'PC 전화 창 좌우 분할 (상담원 통화 칸 오른쪽)', !!pcLayout && pcLayout.logX > pcLayout.sideX, '통화 칸 오른쪽', pcLayout, 'G-18');
  await t.shot('G3-call-pc');
  const atA = (await show())?.at;
  const capA = await t.feval(() => document.querySelector('.hs')?.innerText.slice(0, 400) ?? '');
  await sleep(9000);
  const atB = (await show())?.at;
  const capB = await t.feval(() => document.querySelector('.hs')?.innerText.slice(0, 400) ?? '');
  check(S0, '전화 창 열린 9초 동안 방송 안 넘어감 (부·화면 글 그대로)', atA === atB && capA === capB, '그대로', { atA, atB, same: capA === capB }, 'G-18');
  note(S0, '전화 열기 전 화면 줄', before.slice(0, 80));
  // 흥정 → 조건 → 단추로 주문 (원 70,000 + 시연)
  await r.fclickAction('hs-pay', 'talk');
  r.once('hsop', `<operator>\n칠만 원에 다음 방송 시연 한 번. 그 이하는 안 됩니다.\n</operator>\n<terms>\nmoney|70000\ndemo|yes\n</terms>`);
  s = r.lastSeq();
  await t.F().fill('[data-input="hs-op"]', '좀 깎아 주세요.');
  await r.fclickAction('hs-op');
  await r.until(async () => kindReqs(s, 'hsop').length, 15000).catch(() => {});
  await sleep(1500);
  r.save('G3-흥정', kindReqs(s, 'hsop'));
  const termsTxt = await r.ftext('.hs-pop');
  check(S0, '조건 칸: 70,000원 + 시연', /70,000/.test(termsTxt) && /시연/.test(termsTxt), '보임', termsTxt.slice(0, 200), 'G-20');
  r.once('hsop', '<operator>\n주문 들어갔습니다. 상자는 이미 곁에 있어요.\n</operator>');
  s = r.lastSeq();
  await r.fclickAction('hs-order');
  await sleep(3000);
  r.save('G3-주문뒤말', kindReqs(s, 'hsop'));
  const o1 = (await orders()).find((x) => x.item?.name === '붉은 리본 손전등');
  note(S0, '주문 1', o1 && { pay: o1.pay, how: o1.how, boxId: o1.boxId });
  const names1 = await liveItemNames();
  check(S0, '주문하자마자 소지품에 미개봉 상자', names1.some((n) => /택배 상자/.test(n) && /손전등/.test(n)), '상자', names1, 'G-29');
  check(S0, '잔고 140,000 → 70,000', r.J(await r.vars(), '$st_wallet')?.log?.some((e) => e.amount === -70000), '-70000', (r.J(await r.vars(), '$st_wallet')?.log ?? []).slice(-2), 'G-20');
  await r.fclickAction('hs-pop', '');
  // 3부로: 상담원이 끊음 (G-26)
  await r.fclickAction('hs-next'); await sleep(1200);
  await r.fclickAction('hs-next'); await sleep(1200);
  note(S0, '지금 부', (await show())?.at);
  r.once('hsop', '<operator>\n벽시계 주문이시죠.\n</operator>');
  await r.fclickAction('hs-pop', 'call');
  await sleep(2500);
  await r.fclickAction('hs-pay', 'talk');
  r.once('hsop', `<operator>\n그런 말씀이면 더 들을 것 없네요. 끊겠습니다.\n</operator>\n<terms>\nnone\n</terms>\n<hangup/>`);
  s = r.lastSeq();
  await t.F().fill('[data-input="hs-op"]', '공짜로 주세요.');
  await r.fclickAction('hs-op');
  await sleep(3000);
  check(S0, '상담원이 끊음 → 「상담원이 전화를 끊었습니다」', /전화를 끊었습니다/.test(await r.ftext('.hs-pop')), '끊음', (await r.ftext('.hs-pop')).slice(0, 160), 'G-26');
  await r.fclickAction('hs-pop', '');
  await sleep(500);
  const callBtn = await t.feval(() => { const b = document.querySelector('[data-action="hs-pop"][data-value="call"]'); return b ? { dis: b.disabled, txt: b.innerText } : null; });
  s = r.lastSeq();
  await r.fclickAction('hs-pop', 'call');
  await sleep(1500);
  const again = await r.ftext('.hs-pop');
  check(S0, '같은 부 다시 걸면 끊긴 그대로 (새 통화 없음)', kindReqs(s, 'hsop').length === 0, '요청 0', { callBtn, again: again.slice(0, 120), reqs: kindReqs(s, 'hsop').length }, 'G-26');
  await r.fclickAction('hs-pop', '');
  await t.closeWindow();
  // 다음 본편: ARRIVE 한 번, 통화 기록
  r.once('main', `휴대폰 화면이 꺼졌다. 발치에 상자 하나가 놓여 있었다.\n\n${r.status({ bal: 70000 })}`);
  s = r.lastSeq();
  await t.send('주위를 둘러본다.');
  await sleep(4000);
  let mr = kindReqs(s, 'main')[0];
  r.save('G3-본편-주문턴', kindReqs(s, 'main'));
  let mt = mr ? msgsText(mr.body) : '';
  check(S0, '주문 턴 본편: ARRIVE 한 번', (mt.match(/phone order has reached the protagonist/g) || []).length === 1, 1, (mt.match(/phone order has reached the protagonist/g) || []).length, 'G-29');
  check(S0, '상담원 통화 내용이 본편에 (깎아 달라는 말·조건 말)', /좀 깎아 주세요/.test(mt) && /칠만 원에 다음 방송 시연/.test(mt), '둘 다', '', 'G-24');
  check(S0, '숨은 진실 전문이 본편에 안 감', !/사람 그림자에 세 번 비추면 풀린다/.test(mt), '없음', '', 'G-21');
  // 상자 열기 → 다음 본편 just bought (G-23)
  await t.openWindow(); await sleep(1000);
  await r.fclickAction('nav-tab', 'items'); await sleep(600);
  const box = (r.J(await r.vars(), '$st_items')?.list ?? []).find((x) => /택배 상자/.test(x.name) && /손전등/.test(x.name));
  if (box) { await r.fclickAction('items-open', box.id); await sleep(500); }
  const hadOpen = await r.fclickAction('hs-box-open');
  await sleep(1000);
  const names2 = await liveItemNames();
  check(S0, '상자 열기 → 손전등 들어오고 상자 빠짐', hadOpen && names2.includes('붉은 리본 손전등') && !names2.some((n) => /택배 상자/.test(n) && /손전등/.test(n)), '물건만', names2, 'G-23');
  await t.shot('G3-opened');
  await t.closeWindow();
  r.once('main', `상자 안에는 붉은 리본이 감긴 손전등이 있었다.\n\n${r.status({ bal: 70000 })}`);
  s = r.lastSeq();
  await t.send('손전등을 꺼내 본다.');
  await sleep(4000);
  mr = kindReqs(s, 'main')[0];
  r.save('G3-본편-연턴', kindReqs(s, 'main'));
  mt = mr ? msgsText(mr.body) : '';
  check(S0, '연 턴: 손전등이 just bought 로 (설정 그대로)', /just bought[^\n]*붉은 리본 손전등/.test(mt), 'just bought', (/This turn:[^\n]{0,200}/.exec(mt) || [''])[0], 'G-23');
  check(S0, '연 턴: ARRIVE 다시 안 감', !/phone order has reached the protagonist/.test(mt), '없음', '', 'G-29');
  r.writeResults(`${OUT}결과-g3.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ G4 갈래: 산 응답 다시 굴리기 (G-06) · 가계부 끔 ═════════════════════
async function g4() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const kindReqs = (seq, k) => r.since(seq, k);
  const liveNames = async () => { const v = await r.vars(); const alive = new Set((await t.chatState().catch(() => ({ message: [] }))).message?.map?.((m) => m.chatId) ?? []); return (r.J(v, '$st_items')?.list ?? []).filter((x) => !x.soldAt && !x.outAt && !x.gone && (!x.anchor || !alive.size || alive.has(x.anchor))).map((x) => x.name); };
  const balUI = async () => { const m = /₩\s*([\d,]+)/.exec(await r.ftext('.gx')); return m ? Number(m[1].replace(/,/g, '')) : null; };
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  const S0 = 'G4 산 응답 다시 굴리기';
  await t.openWindow(); await sleep(1000);
  if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net');
  await sleep(600);
  if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos');
  await sleep(1000);
  r.once('cos', COS_SHELF1);
  await r.fclickAction('mall-refresh');
  await sleep(4000);
  const ids = Object.fromEntries((r.J(await r.vars(), '$cos_shop')?.items ?? []).map((x) => [x.name, x.id]));
  r.once('cos', COS_INFO);
  await r.fclickAction('mall-ask', ids['반짝 걸음 구두약']);
  await sleep(500);
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '구두약 진짜예요?');
  await r.fclickAction('mall-say');
  await sleep(3000);
  await r.fclickAction('mall-note-buy');
  await sleep(800);
  r.once('cos', COS_ORDER);
  await t.F().fill('.cs-askwin [data-input="mall-say"]', '안 꺼지는 손전등 만들어 줄 수 있어요?');
  await r.fclickAction('mall-say');
  await sleep(3000);
  await r.fclickAction('mall-quote-accept');
  await sleep(1000);
  await r.fclickAction('mall-ask-close');
  await r.fclickAction('mall-cart', ids['반짝 걸음 구두약']);
  await r.fclickAction('mall-page', 'cart'); await r.fclickAction('mall-order'); await sleep(400); await r.fclickAction('mall-pay'); await sleep(1200);
  const b0 = await balUI();
  const n0 = await liveNames();
  note(S0, '산 뒤 잔고·소지품', { bal: b0, items: n0 });
  check(S0, '산 뒤 잔고 140,000 − 5,000 − 30,000 − 15,000 = 90,000', b0 === 90000, 90000, b0, 'G-05');
  await t.closeWindow();
  // 산 때의 마지막 응답을 다시 굴림
  {
    r.once('main', `잼트리가 다른 이야기를 꺼냈다. (다시 굴린 답)\n\n${r.status()}`);
    await t.reroll();
    await sleep(3500);
  }
  await t.openWindow(); await sleep(1200);
  const b1 = await balUI();
  const n1 = await liveNames();
  check(S0, '다시 굴리면 돈 오간 것 되돌아감: 잔고 140,000', b1 === 140000, 140000, b1, 'G-06');
  check(S0, '다시 굴리면 산 물건(구두약·쪽지)도 빠짐', !n1.includes('반짝 걸음 구두약') && !n1.some((n) => /쪽지/.test(n)), '빠짐', n1, 'G-06');
  if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net'); await sleep(500); if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); await sleep(800); }
  await r.fclickAction('mall-ask', '');
  await sleep(800);
  const ask = await r.ftext('.cs-askwin');
  check(S0, '대화·쪽지·견적 카드는 남음', /구두약 진짜예요/.test(ask) && /관리국 앞 발소리/.test(ask) && /안 꺼지는 손전등/.test(ask), '셋 다', ask.slice(0, 300), 'G-06');
  note(S0, '쪽지·견적 카드 상태 글', (/(구매 완료|선납 완료|다시 사기|사기)[^\n]{0,40}/g.exec(ask) || ['(없음)'])[0]);
  await t.shot('G4-reroll-ask');
  await r.fclickAction('mall-ask-close');
  await t.closeWindow();
  r.once('main', `오후가 흘렀다.\n\n${r.status()}`);
  const s = r.lastSeq();
  await t.send('자리로 돌아간다.');
  await sleep(3500);
  const mr = kindReqs(s, 'main')[0];
  r.save('G4-다시굴린뒤-본편', kindReqs(s, 'main'));
  const mt = mr ? msgsText(mr.body) : '';
  check(S0, '다시 굴린 뒤 본편: 지운 응답 때의 구매·선납·쪽지 안 감', !/반짝 걸음 구두약|안 꺼지는 손전등|관리국 앞 발소리/.test(mt), '없음', (/[^\n]{0,60}(반짝 걸음 구두약|안 꺼지는 손전등|관리국 앞 발소리)[^\n]{0,60}/.exec(mt) || [''])[0], 'G-06');
  // 가계부 끔 → 우주몰 「영업 아님」
  const S1 = 'G4 가계부 끔';
  await t.openWindow(); await sleep(1000);
  await r.fclickAction('ed-open', 'set:screen'); await sleep(1200);
  await r.fclickAction('ed-node', 'set:items'); await sleep(1200);
  const wbtn = await t.feval(() => [...document.querySelectorAll('[data-action]')].map((e) => `${e.dataset.action}|${e.dataset.value ?? ''}`).filter((x) => /wallet-on/.test(x)));
  note(S1, '가계부 켬·끔 단추', wbtn);
  const off = wbtn.find((x) => /\|0$/.test(x));
  if (off) { const [a, v] = off.split('|'); await r.fclickAction(a, v); await sleep(800); }
  await r.fclickAction('ed-close'); await sleep(600);
  note(S1, '끈 뒤 $st_col_wallet', (await r.vars()).$st_col_wallet);
  if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net');
  await sleep(500);
  if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos');
  await sleep(1000);
  const cosTxt = await r.ftext('.ms-cos');
  check(S1, '가계부 끄면 우주몰 「영업 아님」', /영업 아님/.test(cosTxt), '영업 아님', cosTxt.slice(0, 200), 'G 4 갈래');
  await t.shot('G4-wallet-off');
  await t.closeWindow();
  r.writeResults(`${OUT}결과-g4.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ G5 망상홈쇼핑 약조·시연 호출·방청 (G-24·G-28) ═════════════════════
async function g5() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const kindReqs = (seq, k) => r.since(seq, k);
  const orders = async () => r.J(await r.vars(), '$hs_orders') ?? [];
  const updaterHs = (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name: '망상홈쇼핑', owner: '@web', m } }) : '{}'; };
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  const S0 = 'G5 약조·시연·방청';
  // 호출 간격 설정(기본 6턴~)을 1~1 로: 네 턴 안에 다 오게. 설정 화면 「시연 호출 간격」 칸과 같은 변수
  await r.setVars({ $hs_call_lo: '1', $hs_call_hi: '1' });
  const offU = r.on('updater', updaterHs);
  r.once('main', `휴대폰이 혼자 켜졌다. 「망상홈쇼핑 라이브」가 붉은 화면을 띄웠다.\n[shop: 망상홈쇼핑|@web]\n\n${r.status()}`);
  await t.send('휴대폰을 본다.');
  await sleep(6000);
  offU();
  r.once('hs', HS_SHOW);
  await clickChatCard(t, '[data-goei-shop="hs"]');
  await sleep(7000);
  // 1부 손전등: 시연 참여로 주문
  r.once('hsop', '<operator>\n시연 참여요? 좋아요.\n</operator>');
  await r.fclickAction('hs-pop', 'call');
  await sleep(3000);
  await r.fclickAction('hs-pay', 'appear');
  r.once('hsop', '<operator>\n주문 들어갔습니다. 다음 방송에서 뵙죠.\n</operator>');
  await r.fclickAction('hs-order');
  await sleep(3000);
  await r.fclickAction('hs-pop', '');
  // 2부 손난로: 흥정, 약조 「그림자 한 뼘」 + <deal/> (말로 수락)
  await r.fclickAction('hs-next'); await sleep(1200);
  r.once('hsop', '<operator>\n손난로요. 손이 차시군요.\n</operator>');
  await r.fclickAction('hs-pop', 'call');
  await sleep(3000);
  await r.fclickAction('hs-pay', 'talk');
  r.once('hsop', `<operator>\n돈은 필요 없어요. 손님 그림자 한 뼘이면 됩니다. 주문 받았습니다.\n</operator>\n<terms>\nother|그림자 한 뼘\n</terms>\n<deal/>`);
  await t.F().fill('[data-input="hs-op"]', '돈 말고 다른 걸로 할 수 있어요? 좋아요, 주문해 주세요.');
  await r.fclickAction('hs-op');
  await sleep(3500);
  const os1 = await orders();
  note(S0, '주문 둘', os1.map((o) => ({ item: o.item?.name, pay: o.pay, how: o.how, terms: o.terms, dues: o.dues, owe: o.owe })));
  check(S0, '말로 수락(<deal/>) → 약조 주문 들어감', os1.some((o) => o.item?.name === '따뜻한 손난로' && /그림자 한 뼘/.test(o.how ?? '')), '그림자 한 뼘', os1.map((o) => o.how), 'G-24');
  await r.fclickAction('hs-pop', '');
  // 방청 신청
  await r.fclickAction('hs-pop', 'aud'); await sleep(500);
  await r.fclickAction('hs-agree'); await r.fclickAction('hs-aud'); await sleep(800);
  const audTxt = await r.ftext('.hs-pop');
  note(S0, '방청 신청 뒤 창', audTxt.slice(0, 120));
  await r.fclickAction('hs-pop', '');
  await t.closeWindow();
  const turns = [];
  const runTurn = async (say, reply) => { r.once('main', `${reply}\n\n${r.status()}`); const s = r.lastSeq(); await t.send(say); await sleep(3500); const m = kindReqs(s, 'main')[0]; const txt = m ? msgsText(m.body) : ''; turns.push({ say, arrive: (txt.match(/phone order has reached the protagonist/g) || []).length, promise: (txt.match(/comes to collect what the user promised/g) || []).length, call: (txt.match(/calls the user in for the demonstration/g) || []).length, aud: (txt.match(/applied for a studio audience seat/g) || []).length }); return m; };
  const m1 = await runTurn('휴대폰을 끈다.', '발치에 상자 두 개가 놓여 있었다.');
  // 상자 둘 다 열기
  await t.openWindow(); await sleep(1000);
  await r.fclickAction('nav-tab', 'items'); await sleep(600);
  for (const b of (r.J(await r.vars(), '$st_items')?.list ?? []).filter((x) => /택배 상자/.test(x.name) && !x.gone && !x.outAt)) { await r.fclickAction('items-open', b.id); await sleep(400); await r.fclickAction('hs-box-open'); await sleep(800); await r.fclickAction('items-close'); await sleep(300); }
  note(S0, '연 뒤 주문 (시연 호출 턴·약조 턴)', (await orders()).map((o) => ({ item: o.item?.name, openKey: !!o.openKey, dues: o.dues, owe: o.owe })));
  await t.closeWindow();
  const m2 = await runTurn('상자 속 물건을 꺼낸다.', '손전등과 손난로가 나왔다.');
  const m3 = await runTurn('길을 걷는다.', '골목이 조용했다.');
  const m4 = await runTurn('계속 걷는다.', '바람이 불었다.');
  r.save('G5-본편-네턴', [m1, m2, m3, m4].filter(Boolean));
  note(S0, '턴마다 붙은 절 수', turns);
  const sum = (k) => turns.reduce((n, x) => n + x[k], 0);
  check(S0, '약조(PROMISE)는 받으러 오는 턴에 한 번만', sum('promise') === 1, '합 1', turns.map((x) => x.promise), 'G-24');
  check(S0, 'PROMISE 에 약조 글 「그림자 한 뼘」', [m2, m3, m4].some((m) => /comes to collect what the user promised[^\n]*그림자 한 뼘/.test(m ? msgsText(m.body) : '')), '있음', '', 'G-24');
  check(S0, '시연 호출(CALL)은 네 턴 안에 한 번만', sum('call') === 1, 1, turns.map((x) => x.call), 'G-28 (호출 턴 수는 설정 구간)');
  check(S0, '방청(AUDIENCE)은 한 번만', sum('aud') === 1, 1, turns.map((x) => x.aud), '2차 04 방청');
  check(S0, 'ARRIVE 는 주문 턴에 한 번만', turns[0].arrive === 1 && sum('arrive') === 1, '첫 턴 1', turns.map((x) => x.arrive), 'G-29');
  r.writeResults(`${OUT}결과-g5.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ G6 포인트몰 상담 답 기다리다 새로고침 (코스 G-4) ═════════════════════
async function g6() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  const openBm = async () => { if (await t.feval(() => !!document.querySelector('.ms-bm'))) return; if (!(await t.feval(() => !!document.querySelector('.br')))) { await r.fclickAction('nav-tab', 'net'); await sleep(600); } if (await t.feval(() => !!document.querySelector('.ms-bm'))) return; if (!(await r.fclickAction('br-go', 'bm'))) await r.fclickAction('br-site', 'bm'); await sleep(1000); };
  await t.setup();
  await t.loadState(STATES + 'S-백일몽-3턴.json');
  await sleep(1500);
  const S0 = 'G6 상담 답 기다리다 새로고침';
  await t.openWindow(); await sleep(1000);
  await openBm();
  if (/로그인이 필요/.test(await r.ftext('.ms-bm'))) { await r.fclickAction('br-login'); await sleep(400); await t.F().fill('input[name="br-nick"]', '현장탐사팀 신입'); await r.fclickAction('br-login-save'); await sleep(800); }
  r.once('desk', DESK_MAKE);
  await r.fclickAction('mall-ask', '');
  await sleep(3500);
  r.hold('desk');
  await t.F().fill('.bd-win [data-input="mall-say"]', '앰플 재입고 언제예요?');
  await r.fclickAction('mall-say');
  await r.until(async () => r.held().length, 10000);
  await t.reload();
  await r.unhold('desk');
  await sleep(1500);
  await t.openWindow(); await sleep(1200);
  await openBm();
  await r.fclickAction('mall-ask', '');
  await sleep(1200);
  const back = await t.feval(() => document.querySelector('.bd-win [data-input="mall-say"]')?.value ?? null).catch(() => null);
  const win = await r.ftext('.bd-win');
  check(S0, '다시 열면 답 못 받은 내 말이 입력칸으로', back === '앰플 재입고 언제예요?', '앰플 재입고 언제예요?', back, '업데이트내역 v0.21.34 12줄');
  check(S0, '상담 기록엔 답 없는 내 말이 안 남음', (win.match(/앰플 재입고 언제예요/g) || []).length === 0, 0, win.slice(-160), '업데이트내역 v0.21.34 12줄');
  await t.shot('G6-desk-after-reload');
  await r.fclickAction('mall-ask-close');
  await t.closeWindow();
  r.once('main', `진나솔이 고개를 들었다.\n\n${r.status()}`);
  const s = r.lastSeq();
  await t.send('자리에 앉는다.');
  await sleep(3500);
  const mt = r.since(s, 'main')[0] ? msgsText(r.since(s, 'main')[0].body) : '';
  check(S0, '본편에 답 없는 내 말 안 감', !/앰플 재입고 언제예요/.test(mt), '없음', (/[^\n]{0,60}앰플 재입고[^\n]{0,40}/.exec(mt) || [''])[0], '업데이트내역 v0.21.34 12줄');
  r.writeResults(`${OUT}결과-g6.json`);
  await r.stop();
  await t.close();
}

// ═════════════════════ G7 우주몰 자동 호출 「매 턴」: 안 열어 본 진열은 다시 안 받음 (G-02) ═════════════════════
async function g7() {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
  const { t, check, note } = r;
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  const S0 = 'G7 매 턴 자동 호출';
  // 설정 화면의 「자동 호출」 칸과 같은 변수 ($cos_sh_auto). 이 값은 바꿀 때 다른 처리가 붙지 않아 변수로 바꿈
  await r.setVars({ $cos_sh_auto: 'turn' });
  const openCos = async () => { await t.openWindow(); await sleep(1000); if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net'); await sleep(500); if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); } await sleep(1500); };
  await openCos();
  r.once('cos', COS_SHELF1);
  await r.fclickAction('mall-refresh');
  await sleep(4000);
  await t.closeWindow();
  const turn = async (say, i) => { r.once('cos', COS_SHELF1.replace(/<shop-identity>[\s\S]*?<\/shop-identity>\n/, '').replace('반짝 걸음 구두약', `반짝 걸음 구두약 ${i}호`)); r.once('main', `시간이 흘렀다.\n\n${r.status()}`); const s = r.lastSeq(); await t.send(say); await sleep(6000); return r.since(s, 'cos').length; };
  const n1 = await turn('잠깐 쉰다.', 1);
  check(S0, '본 진열이 있으면 다음 턴 뒤 새 진열을 받음', n1 === 1, 1, n1, 'G-02');
  const n2 = await turn('창밖을 본다.', 2);
  check(S0, '받아 둔 진열을 안 열어 봤으면 그다음 턴엔 안 받음', n2 === 0, 0, n2, 'G-02');
  await openCos();
  await sleep(1000);
  await t.closeWindow();
  const n3 = await turn('다시 걷는다.', 3);
  check(S0, '열어 본 뒤 다음 턴엔 다시 받음', n3 === 1, 1, n3, 'G-02');
  r.writeResults(`${OUT}결과-g7.json`);
  await r.stop();
  await t.close();
}

if (on('g1')) await g1();
if (on('g2')) await g2();
if (on('g3')) await g3();
if (on('g4')) await g4();
if (on('g5')) await g5();
if (on('g6')) await g6();
if (on('g7')) await g7();
