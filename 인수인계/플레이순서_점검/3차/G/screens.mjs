// 3차 E·G 화면 크기별 확인: 장면 속 가게 · 우주 쇼핑몰(+문의 창) · 망상홈쇼핑 단독 창(+전화 창) · 백일몽 포인트몰(+1:1 상담)
// 사용: source /tmp/t2/t2-env.sh && FAKE_URL=http://<IP>:8792 SIZE=phone node 인수인계/플레이순서_점검/3차/G/screens.mjs
// SIZE: pc 1280×800 · phone 344×882(터치) · land 882×344(터치) · fold 752×749 dsf1.8(터치, 실기 아님 — 크기만 흉내)
import { openRun, clickChatCard, sleep, STATES, userText } from '../E/lib.mjs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/screens/', import.meta.url));
const SIZES = { pc: [1280, 800, false, 1], phone: [344, 882, true, 2], land: [882, 344, true, 2], fold: [752, 749, true, 1.8] };
const size = process.env.SIZE || 'phone';
const [W, H, touch, dsf] = SIZES[size];

const SHOP_SHELF = `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n<owner>\n천천히 보세요.\n</owner>\n<shelf>\n은 십자가 목걸이|85000|장비|귀중품/목걸이/necklace|0.012|순은 십자가|품은 사람을 한 번 지켜 준다|희귀\n작은 성경|8000|-|서류/성경/bible|0.21|손바닥만 한 성경||특가:12000\n축성 초|짐 옮겨 주기|소모1|소모품/초/candle|0.09|축성받은 초||\n</shelf>`;
const COS_SHELF = `<shop-identity>\nsells: 이상한 물건\nnever: 환불\nprices: 원화만\ncurrency: -\n</shop-identity>\n<owner>\n안녕하신가! 새로운 상품, 우리는 진열했다.\n</owner>\n<shelf>\n반짝 걸음 구두약|15000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에.|걸음이 빛남|특가:18000|?\n말 듣는 우산|22000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다.|???||?\n내일 신문 한 장|900000|소모1|서류/신문/newspaper|0.05|읽는다. 내일이 쓰여 있다.|정확함|희귀|?\n</shelf>`;
const BM_SHELF = `<shop-identity>\nsells: 복지 생활용품\nnever: 현금\nprices: 수십~수천 p\n</shop-identity>\n<owner>\n3월 신규 입고 상품을 안내드립니다.\n</owner>\n<shelf>\n휴대용 손난로|40|소모5|소모품/손난로/hand warmer|0.052|5개 묶음||특가:60\n무선 전기주전자|380|사용|기기/주전자/kettle|1.12|1.2L||\n정체불명 앰플|1200|소모1|의료/앰플/ampoule|0.012|연구부 시약|피로가 가신다|희귀\n</shelf>`;
const HS_SHOW = `<title>\n금요 심야 특가\n</title>\n<shelf>\n붉은 리본 손전등|100000|손|도구/손전등/flashlight|0.246|켜면 붉은 빛이 납니다. 스티커: 사람에게 비추지 말 것.|어둠 속 길이 보인다|O|빛에 닿은 그림자를 떼어 낸다\n세 번 우는 벽시계|30000|사용|기기/벽시계/wall clock|1.84|정각마다 세 번 웁니다.|시간을 알려 준다|-|부르는 종\n</shelf>\n<cue>\n#1\nwide|talk|고객님들, 오늘도 잠 못 드셨죠?|-\nbust|talk|오늘만 십만 원, 시연 참여도 됩니다!|price\n#2\nwide|talk|마지막, 세 번 우는 벽시계!|price\n</cue>\n<chat>\n#1\n야식왕|저거 진짜 켜져요?\n???|여기 안에 있어요\n#2\nrose|시계 소리 왜 이럼\n</chat>`;

const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H, touch, dsf });
const { t, note } = r;
const shot = (n) => t.shot(`${size}-${n}`);
const overflow = (sel) => t.feval((sel) => { const el = document.querySelector(sel); if (!el) return null; const vw = document.documentElement.clientWidth; const bad = [...el.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 1 || b.left < -1); }).slice(0, 5).map((e) => `${e.className || e.tagName}`); return { sw: el.scrollWidth, cw: el.clientWidth, bad }; }, sel);
const upd = (name, owner) => (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name, owner, m } }) : '{}'; };

await t.setup();
// ── 1. 장면 속 가게 ──
await t.loadState(STATES + 'S-관리국-3턴.json');
await sleep(1500);
let off = r.on('updater', upd('기독교 상점', '블라렛'));
r.once('main', `블라렛이 진열대 쪽으로 손짓했다.\n[shop: 기독교 상점|블라렛]\n\n${r.status({ place: '서울 서대문구 기독교 상점' })}`);
await t.send('기독교 상점에 들어간다.');
await sleep(6000);
off();
await shot('E-card');
r.once('shop', SHOP_SHELF);
await clickChatCard(t);
await sleep(5000);
await shot('E-shop');
note(size, '가게 창 가로 넘침', await overflow('.sh-wrap'));
const firstItem = await t.feval(() => document.querySelector('[data-action="shop-detail"]')?.getAttribute('data-value'));
if (firstItem) { await r.fclickAction('shop-detail', firstItem); await sleep(600); await shot('E-shop-detail'); }
await r.fclickAction('shop-close');
await sleep(500);
// ── 2. 우주 쇼핑몰 ──
await t.openWindow();
await sleep(1000);
if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net');
await sleep(600);
if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos');
await sleep(1000);
r.once('cos', COS_SHELF);
await r.fclickAction('mall-refresh');
await sleep(4000);
await shot('G-cos');
note(size, '우주몰 가로 넘침', await overflow('.ms-cos'));
r.once('cos', `<owner>\n구두약 진짜다.\n</owner>\n<change mode="none">\n</change>`);
await r.fclickAction('mall-ask', '');
await sleep(800);
await t.F().fill('.cs-askwin [data-input="mall-say"]', '구두약 진짜예요?');
await r.fclickAction('mall-say');
await sleep(3000);
await shot('G-cos-ask');
note(size, '문의 창 가로 넘침', await overflow('.cs-askwin'));
await r.fclickAction('mall-ask-close');
await t.closeWindow();
// ── 3. 망상홈쇼핑 ──
off = r.on('updater', upd('망상홈쇼핑', '@web'));
r.once('main', `휴대폰이 혼자 켜졌다. 「망상홈쇼핑 라이브」가 붉은 화면을 띄웠다.\n[shop: 망상홈쇼핑|@web]\n\n${r.status()}`);
await t.send('휴대폰을 본다.');
await sleep(6000);
off();
r.once('hs', HS_SHOW);
await clickChatCard(t, '[data-goei-shop="hs"]');
await sleep(7000);
await shot('G-hs');
const chatCol = await t.feval(() => { const c = document.querySelector('.hs-chat, .hs-live, [class*="hs-ch"]'); if (!c) return null; const b = c.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vh: innerHeight, vw: innerWidth }; });
note(size, '홈쇼핑 채팅 칸 자리 (첫 화면 안인가)', chatCol);
note(size, '홈쇼핑 가로 넘침', await overflow('.hs'));
r.once('hsop', '<operator>\n네에, 붉은 리본 손전등 주문 전화 감사합니다.\n</operator>');
await r.fclickAction('hs-pop', 'call');
await sleep(3500);
await shot('G-hs-call');
const pop = await t.feval(() => { const p = document.querySelector('.hs-pop'); if (!p) return null; const b = p.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), vw: innerWidth, vh: innerHeight }; });
note(size, '전화 창 크기 (폰은 화면 가득)', pop);
await r.fclickAction('hs-pop', '');
await r.fclickAction('hs-pop', 'peek');
await sleep(800);
await shot('G-hs-sticker');
await r.fclickAction('hs-pop', '');
await t.closeWindow().catch(() => {});
// ── 4. 백일몽 포인트몰 ──
await t.loadState(STATES + 'S-백일몽-3턴.json');
await sleep(1500);
await t.openWindow();
await sleep(1000);
if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net');
await sleep(600);
if (!(await r.fclickAction('br-go', 'bm'))) await r.fclickAction('br-site', 'bm');
await sleep(1000);
if (/로그인이 필요/.test(await r.ftext('.ms-bm'))) { await r.fclickAction('br-login'); await sleep(400); await t.F().fill('input[name="br-nick"]', '현장탐사팀 신입'); await r.fclickAction('br-login-save'); await sleep(800); }
r.once('bm', BM_SHELF);
await r.fclickAction('mall-refresh');
await sleep(4000);
await shot('G-bm');
note(size, '포인트몰 가로 넘침', await overflow('.ms-bm'));
r.once('desk', `<card>\n이름: 한서윤\n직급: 대리\n부서: 총무팀\n소개: 복지몰 문의 담당\n말투: 짧고 사무적\n</card>\n<say>네 총무팀 한서윤입니다. 무슨 일이세요</say>`);
await r.fclickAction('mall-ask', '');
await sleep(3500);
await shot('G-bm-desk');
note(size, '상담 창 가로 넘침', await overflow('.bd-win'));
r.saveJson(`notes-${size}`, r.results);
await r.stop();
await t.close();
console.log('끝', size);
