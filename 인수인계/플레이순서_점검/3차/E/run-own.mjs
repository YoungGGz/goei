// 3차 점검 E·G 남은 칸: 「고유 상점 표」(설정 → 상점) · 「시그니처 상품 표」(설정 → 우주 쇼핑몰) 를 설정 화면을 실제로 눌러 고치고, 요청 글에 맞게 들어가는지 본다.
// 사용: source /tmp/t2/t2-env.sh && FAKE_URL=http://192.0.2.2:8793 node 인수인계/플레이순서_점검/3차/E/run-own.mjs [own] [fx]
// 출력 out/OWN-run<RUN>/ (요청 전문·캡처), 결과 out/결과-own<RUN>.json. 시작 상태 ../틀/states/S-상점표식.json
// 단계마다 기대값·근거(코드 줄·결정표 줄)를 먼저 적고(check 의 expect·row) 대조한다. src 는 읽기만.
import { openRun, clickChatCard, sleep, STATES, msgsText, userText } from './lib.mjs';
import { fileURLToPath } from 'node:url';

const RUN = process.env.RUN ? `-${process.env.RUN}` : '';
const OUTROOT = fileURLToPath(new URL('./out/', import.meta.url));
const OUT = `${OUTROOT}OWN-run${RUN}/`;
const W = Number(process.env.W || 1280), H = Number(process.env.H || 800);
const want = new Set(process.argv.slice(2));
const on = (p) => !want.size || want.has(p);

const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: W, height: H });
const { t, check, note } = r;
const NO_ROW = '결정표 맞는 줄 없음';

// ── 도우미 ──
const F = () => t.F();
const actions = (re) => t.feval((src) => { const re = new RegExp(src); return [...document.querySelectorAll('[data-action],[data-change]')].map((e) => `${e.dataset.action ?? 'CH:' + e.dataset.change}|${e.dataset.value ?? e.dataset.key ?? ''}|${(e.value ?? e.innerText ?? '').toString().trim().slice(0, 30)}`).filter((s) => re.test(s)); }, re.source);
/** 설정 창 열기 → 페이지 */
async function openSettings(page) {
  await t.openWindow(); await sleep(1200);
  // 설정 창(편집 창)이 보이지 않으면 연다 (숨은 DOM 은 치지 않음: fclickAction 은 보이는 단추만 누른다)
  const edShown = () => t.feval(() => [...document.querySelectorAll('[data-action="ed-node"]')].some((e) => e.getClientRects().length && e.offsetParent !== null));
  if (!(await edShown())) { await r.fclickAction('ed-open', 'set:screen'); await sleep(1500); }
  const ok = await r.fclickAction('ed-node', `set:${page}`); await sleep(1200);
  if (!ok) throw new Error(`설정 페이지 ${page} 못 엶`);
}
async function closeSettings() {
  await r.fclickAction('ed-close'); await sleep(600);
  await t.closeWindow(); await sleep(500);
}
/** 글칸 고치기: 실제 입력 + Tab (change 이벤트) */
async function typeInto(sel, val) {
  const loc = F().locator(sel).first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.fill(String(val));
  await loc.press('Tab');
  await sleep(700);
}
const ownVar = async () => r.J(await r.vars(), '$sh_own');
const fxVar = async () => r.J(await r.vars(), '$cos_fixed');
const updaterShop = (name, owner) => (body) => {
  const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1];
  return m ? JSON.stringify({ shop: { name, owner, m } }) : '{}';
};
const ownLine = (txt) => (/Shops with their own screen: ([\s\S]*?)\. One counts only/.exec(txt) || [])[1] ?? null;
let turnN = 0;
/** 본편 한 턴: 본편·갱신기 요청을 받아 돌려줌 */
async function turn(tag, say, { upd } = {}) {
  turnN++;
  const off = upd ? r.on('updater', upd) : r.on('updater', () => '{}');
  r.once('main', `블라렛이 계산대 너머로 고개를 끄덕였다. (턴 ${turnN})\n\n${r.status({ place: '서울 서대문구 기독교 상점' })}`);
  const s = r.lastSeq();
  await t.send(say);
  await r.until(async () => r.since(s, 'updater').length, 40000);
  await sleep(2500);
  off();
  const main = r.since(s, 'main')[0];
  const up = r.since(s, 'updater')[0];
  r.save(`OWN-${tag}-본편`, r.since(s, 'main'));
  r.save(`OWN-${tag}-갱신기`, r.since(s, 'updater'));
  return { s, main, up, mt: main ? msgsText(main.body) : '', ut: up ? msgsText(up.body) : '' };
}
const cards = (site) => t.page.locator(`.default-chat-screen [data-goei-shop${site ? `="${site}"` : ''}]`).count();
const lastBotData = async () => { const st = await t.chatState(true); const m = (st.messages ?? st.message ?? []).filter((x) => x.role === 'char').at(-1); return m?.data ?? ''; };

console.log('setup…');
await t.setup();
const ls = await t.loadState(STATES + 'S-상점표식.json');
console.log('loadState', JSON.stringify(ls));
await t.waitScreenText(8, /블라렛/, 15000).catch(() => {});

// ═════════════════════ 고유 상점 표 ═════════════════════
const DEF_LIST = '우주 쇼핑몰 — online or in person; 백일몽 포인트몰 (also 포인트몰, 복지몰) — online only; 망상홈쇼핑 (also 망상 홈쇼핑, 망상홈쇼핑 라이브) — online only';
let newId = null;
if (on('own')) {
  // ── O0 판단자 메인 모델로 (설정 → 상점 「상점 판단」) ──
  let S = 'O0 판단 메인·기본 표';
  await openSettings('shop');
  note(S, '고유 상점 표 처음 줄 (화면)', await actions(/set-own\|.*:name|CH:set-own\|.*:name/));
  await r.fclickAction('set-shop-judge', 'main'); await sleep(800);
  await t.shot('OWN-O0-settings');
  await closeSettings();
  const v0 = await r.vars();
  check(S, '「메인 모델」 단추 → $sh_judge=main', v0.$sh_judge === 'main', 'main', v0.$sh_judge, 'src/ui/settings.ts set-shop-judge · E-12(판단자 설정)');
  let T = await turn('O0', '진열대 앞에 선다.');
  check(S, '본편 요청에 MAIN_TAG(표식 지침) 들어감', /Shop tag: if there is a shop right now/.test(T.mt), 'MAIN_TAG 있음', /Shop tag:[^\n]{0,60}/.exec(T.mt)?.[0] ?? '없음', 'src/core/shop.ts:1268 shopGuide (by main) · 지침/상점.txt:150');
  check(S, '본편 OWN_SHOPS {list} = 기본 세 줄 (OWN_SHOPS_DEFAULT)', ownLine(T.mt) === DEF_LIST, DEF_LIST, ownLine(T.mt), 'src/core/shop.ts:52-59,1255-1264 · 지침/상점.txt:160 · ' + NO_ROW);
  check(S, '판단 메인일 때 갱신기 요청엔 SHOP_RULE·shop_check 없음', T.up && !/Shops with their own screen/.test(T.ut) && !/"shop_check"/.test(T.ut), '없음', T.up ? { own: !!ownLine(T.ut), shop_check: /"shop_check"/.test(T.ut) } : '갱신기 요청 없음', 'src/host/people.ts:677 (shop 일 때만)');

  // ── O1 줄 추가 + 이름·다른 이름 ──
  S = 'O1 줄 추가·이름';
  await openSettings('shop');
  const before = await actions(/^set-own-del\|/);
  await r.fclickAction('set-own-add'); await sleep(900);
  const after = await actions(/^set-own-del\|/);
  newId = after.map((x) => x.split('|')[1]).find((id) => !before.some((b) => b.split('|')[1] === id)) ?? null;
  check(S, '「고유 상점 추가」 → 새 줄 하나 (켬·직접 가면 기본 상점창)', !!newId && after.length === before.length + 1, '줄 +1', { before: before.length, after: after.length, newId }, 'src/ui/settings.ts:1083 · ' + NO_ROW);
  if (newId) {
    await typeInto(`[data-change="set-own"][data-key="${newId}:name"]`, '기독교 상점');
    await typeInto(`[data-change="set-own"][data-key="${newId}:alias"]`, '기독교상점');
  }
  await t.shot('OWN-O1-settings');
  await closeSettings();
  let ov = await ownVar();
  const row = ov?.find((o) => o.id === newId);
  check(S, '저장: 새 줄 {on:true,name:기독교 상점,alias:기독교상점,web:"",visit:"shop"}', row && row.on === true && row.name === '기독교 상점' && row.alias === '기독교상점' && row.web === '' && row.visit === 'shop' && ov.length === 4, { on: true, name: '기독교 상점', alias: '기독교상점', web: '', visit: 'shop', 줄수: 4 }, { row, 줄수: ov?.length }, 'src/ui/settings.ts:1072-1092');
  T = await turn('O1', '성물을 둘러본다.');
  const L1 = `${DEF_LIST}; 기독교 상점 (also 기독교상점) — in person only`;
  check(S, '본편 OWN_SHOPS 끝에 새 줄 「기독교 상점 (also 기독교상점) — in person only」', ownLine(T.mt) === L1, L1, ownLine(T.mt), 'src/core/shop.ts:1255-1264 OWN_SHOP_ITEM_ALSO·OWN_HOW_VISIT · 지침/상점.txt:336,348');

  // ── O2 인터넷 접속 = 우주 쇼핑몰 → online or in person ──
  S = 'O2 인터넷 접속 고르기';
  await openSettings('shop');
  await r.fclickAction('set-own-web', `${newId}:cos`); await sleep(800);
  await closeSettings();
  ov = await ownVar();
  check(S, '저장: web=cos', ov?.find((o) => o.id === newId)?.web === 'cos', 'cos', ov?.find((o) => o.id === newId)?.web, 'src/ui/settings.ts:1081');
  T = await turn('O2', '계산대 쪽을 본다.');
  check(S, '본편: 새 줄 how = online or in person', /기독교 상점 \(also 기독교상점\) — online or in person/.test(ownLine(T.mt) ?? ''), '— online or in person', ownLine(T.mt), 'src/core/shop.ts:1261 OWN_HOW_BOTH · 지침/상점.txt:340');
  await openSettings('shop');
  await r.fclickAction('set-own-web', `${newId}:none`); await sleep(800);
  await closeSettings();

  // ── O3 끄기: 새 줄·망상홈쇼핑 줄 끔 → 켜진 줄만 ──
  S = 'O3 켜기·끄기';
  await openSettings('shop');
  await r.fclickAction('set-own-on', 'hs:0'); await sleep(800);
  await t.shot('OWN-O3-hs-off');
  await closeSettings();
  ov = await ownVar();
  check(S, '저장: hs 줄 on=false, 새 줄 web 다시 ""', ov?.find((o) => o.id === 'hs')?.on === false && ov?.find((o) => o.id === newId)?.web === '', { hs: false, newWeb: '' }, { hs: ov?.find((o) => o.id === 'hs')?.on, newWeb: ov?.find((o) => o.id === newId)?.web }, 'src/ui/settings.ts:1080');
  T = await turn('O3', '조용히 기다린다.');
  const L3 = '우주 쇼핑몰 — online or in person; 백일몽 포인트몰 (also 포인트몰, 복지몰) — online only; 기독교 상점 (also 기독교상점) — in person only';
  check(S, '본편 OWN_SHOPS 에서 꺼진 망상홈쇼핑 빠짐', ownLine(T.mt) === L3, L3, ownLine(T.mt), 'src/core/shop.ts:1256 (o.on 만) · guides.ts:38 「켜진 줄」');

  // ── O4 판단 갱신기: 갱신기 요청에 켜진 줄만, 본편엔 MAIN_TAG 없음 → 그 가게 열기 ──
  S = 'O4 판단 갱신기·가게 열기';
  await openSettings('shop');
  await r.fclickAction('set-shop-judge', 'updater'); await sleep(800);
  await closeSettings();
  T = await turn('O4', '블라렛에게 다가간다.', { upd: updaterShop('기독교 상점', '블라렛') });
  check(S, '본편 요청에 MAIN_TAG 없음', !/Shop tag: if there is a shop right now/.test(T.mt), '없음', /Shop tag:[^\n]{0,60}/.exec(T.mt)?.[0] ?? '없음', 'src/core/shop.ts:1269 (by updater 면 빈 글)');
  check(S, '갱신기 요청 SHOP_RULE 의 {own} = 켜진 줄만 (hs 빠짐, 새 줄 있음)', ownLine(T.ut) === L3, L3, ownLine(T.ut), 'src/host/people.ts:677 · src/core/shop.ts:1251 · guides.ts:38');
  check(S, '갱신기 요청에 shop_check', /"shop_check":\{"m":"m\d+"/.test(userText(T.up?.body ?? {})), '있음', /"shop_check"[^}]*\}/.exec(T.ut)?.[0] ?? '없음', 'E-12');
  const c4 = await cards('1');
  check(S, '고유 상점(직접 가면 기본 상점창) 표식 → 보통 「상점 열기」 카드 1', c4 === 1, 1, { open: c4, web: await cards('cos') }, 'src/core/shop.ts:528-534 (own.visit=shop → tag 그대로)');
  r.once('shop', `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n<owner>\n천천히 보세요.\n</owner>\n<shelf>\n나무 묵주|12000|손|귀중품/묵주/rosary|0.031|올리브 나무 묵주||\n축성 초|3000|소모3|소모품/초/candle|0.084|흰 초 세 자루||\n</shelf>`);
  const s4 = r.lastSeq();
  await clickChatCard(t, '[data-goei-shop="1"]');
  await r.until(async () => r.since(s4, 'shop').length, 20000);
  await sleep(1500);
  const shopReq = r.since(s4, 'shop')[0];
  r.save('OWN-O4-진열요청', r.since(s4, 'shop'));
  const su = shopReq ? userText(shopReq.body) : '';
  const sall = shopReq ? msgsText(shopReq.body) : '';
  check(S, '열면 진열 요청 1건, 가게·주인 = 기독교 상점·블라렛', !!shopReq && /기독교 상점/.test(su) && /블라렛/.test(su), '기독교 상점·블라렛', su.slice(0, 160), 'E-01');
  note(S, '진열 요청에 고유 상점 줄 설정(다른 이름 「기독교상점」·OWN_SHOPS 글·online/in person)이 가나', { alias: /기독교상점/.test(sall), ownShops: /Shops with their own screen/.test(sall), how: /in person only|online only|online or in person/.test(sall) });
  await t.shot('OWN-O4-shop');
  await r.fclickAction('shop-close'); await sleep(600);
  await t.closeWindow();

  // ── O5 「직접 가면 열지 않음」 (인터넷 없음) → 표식 지움·카드 없음, {own} 에서도 빠짐 ──
  S = 'O5 직접 가면 열지 않음';
  await openSettings('shop');
  await r.fclickAction('set-own-visit', `${newId}:none`); await sleep(800);
  await closeSettings();
  T = await turn('O5', '다시 진열대를 본다.', { upd: updaterShop('기독교 상점', '블라렛') });
  const L5 = '우주 쇼핑몰 — online or in person; 백일몽 포인트몰 (also 포인트몰, 복지몰) — online only';
  check(S, '갱신기 {own} 에서 빠짐 (web·visit 둘 다 없음)', ownLine(T.ut) === L5, L5, ownLine(T.ut), 'src/core/shop.ts:1256 (o.web || o.visit)');
  const c5 = await cards();
  const st5 = r.J(await r.vars(), '$st_shop');
  check(S, '그 가게 표식 → 카드 없음·방문 상태 없음', c5 === 0 && !st5, { cards: 0, st_shop: null }, { cards: c5, st_shop: st5 && { shop: st5.shop } }, 'src/core/shop.ts:531 (own && !own.visit → mine) · settings.ts:120 도움말 「열지 않음이면 안 열림」');
  note(S, '저장된 마지막 응답 끝', String(await lastBotData()).slice(-120));

  // ── O6 인터넷 접속 = 우주 쇼핑몰 (직접 가면 열지 않음) → 「접속하기」 카드 → 우주몰 ──
  S = 'O6 인터넷 접속 줄';
  await openSettings('shop');
  await r.fclickAction('set-own-web', `${newId}:cos`); await sleep(800);
  await closeSettings();
  T = await turn('O6', '휴대폰으로 가게 사이트를 연다.', { upd: updaterShop('기독교 상점', '블라렛') });
  check(S, '갱신기 {own} 새 줄 how = online only', /기독교 상점 \(also 기독교상점\) — online only/.test(ownLine(T.ut) ?? ''), '— online only', ownLine(T.ut), 'src/core/shop.ts:1261 OWN_HOW_WEB');
  const raw6 = String(await lastBotData());
  check(S, '응답 표식이 [shop: 기독교 상점|@web:cos] 로 바뀜', raw6.includes('[shop: 기독교 상점|@web:cos]'), '[shop: 기독교 상점|@web:cos]', raw6.slice(-120), 'src/core/shop.ts:530-534,542-547');
  const c6 = await cards('cos');
  check(S, '「접속하기」 카드(data-goei-shop=cos) 1, 상점 열기 카드 0', c6 === 1 && (await cards('1')) === 0, { cos: 1, open: 0 }, { cos: c6, open: await cards('1') }, 'src/host/shopcard.ts:34');
  if (c6) {
    const s6 = r.lastSeq();
    await clickChatCard(t, '[data-goei-shop="cos"]');
    await sleep(2500);
    const cosOpen = await t.frame('.gx', 8000).then(() => t.feval(() => !!document.querySelector('.ms-cos'))).catch(() => false);
    check(S, '누르면 우주 쇼핑몰 창이 열림, 기본 상점 진열 요청 없음', cosOpen && r.since(s6, 'shop').length === 0, { cos: true, shopReq: 0 }, { cos: cosOpen, shopReq: r.since(s6, 'shop').length, other: r.since(s6).map((x) => x.kind) }, 'settings.ts:120 도움말 「접속하기 → 인터넷 창만 그 사이트로」');
    await t.shot('OWN-O6-web');
    await t.closeWindow();
  }

  // ── O7 줄 끔 → 같은 이름 표식은 보통 가게로 ──
  S = 'O7 줄 끔 → 보통 가게';
  await openSettings('shop');
  await r.fclickAction('set-own-on', `${newId}:0`); await sleep(800);
  await closeSettings();
  T = await turn('O7', '가게 안으로 다시 들어간다.', { upd: updaterShop('기독교 상점', '블라렛') });
  check(S, '갱신기 {own} 에서 빠짐', !/기독교 상점/.test(ownLine(T.ut) ?? ''), '없음', ownLine(T.ut), 'src/core/shop.ts:1256');
  const c7 = await cards('1');
  check(S, '꺼진 줄의 이름 표식 → 보통 「상점 열기」 카드', c7 === 1 && (await cards('cos')) === 0, { open: 1, cos: 0 }, { open: c7, cos: await cards('cos') }, 'src/core/shop.ts:96 ownShopOf (o.on 만)');

  // ── O8 이름 고치기 (다시 켜고 직접 가면 기본 상점창, 인터넷 없음) ──
  S = 'O8 이름 고치기';
  await openSettings('shop');
  await r.fclickAction('set-own-on', `${newId}:1`); await sleep(700);
  await r.fclickAction('set-own-visit', `${newId}:shop`); await sleep(700);
  await r.fclickAction('set-own-web', `${newId}:none`); await sleep(700);
  await typeInto(`[data-change="set-own"][data-key="${newId}:name"]`, '룩키마트');
  await typeInto(`[data-change="set-own"][data-key="${newId}:alias"]`, '');
  await t.shot('OWN-O8-settings');
  await closeSettings();
  ov = await ownVar();
  check(S, '저장: 이름 룩키마트·다른 이름 빈칸·on·visit shop', JSON.stringify(ov?.find((o) => o.id === newId)) === JSON.stringify({ id: newId, on: true, name: '룩키마트', alias: '', web: '', visit: 'shop' }), { name: '룩키마트', alias: '', on: true, web: '', visit: 'shop' }, ov?.find((o) => o.id === newId), 'src/ui/settings.ts:1076-1079');
  T = await turn('O8', '가게를 나와 길을 걷는다.');
  const L8 = `${L5}; 룩키마트 — in person only`;
  check(S, '갱신기 {own}: 새 이름 「룩키마트 — in person only」, 옛 이름 없음', ownLine(T.ut) === L8, L8, ownLine(T.ut), 'src/core/shop.ts:1259-1264 OWN_SHOP_ITEM');

  // ── O9 지우기: 확인 창 → 아니오(남음) → 예(지움) ──
  S = 'O9 지우기·확인 창';
  await openSettings('shop');
  const dlg0 = t.errors.filter((e) => e.startsWith('dialog:')).length;
  await r.fclickAction('set-own-del', newId); await sleep(800);
  const ask = await t.feval(() => { const y = document.querySelector('[data-action="ed-askdel-yes"]'); let box = y; while (box && !/지울까요/.test(box.innerText ?? '') && box.parentElement) box = box.parentElement; return y ? { text: (box?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), no: !!document.querySelector('[data-action="ed-askdel-no"]') } : null; });
  const dlg1 = t.errors.filter((e) => e.startsWith('dialog:')).length;
  await t.shot('OWN-O9-ask');
  check(S, '지우기 → 플러그인 안 가운데 팝업 「이 고유 상점을 지울까요?」(브라우저 dialog 아님)', !!ask && /이 고유 상점을 지울까요/.test(ask.text) && dlg1 === dlg0, { popup: '이 고유 상점을 지울까요?', browserDialog: 0 }, { ask, browserDialog: dlg1 - dlg0 }, 'src/ui/editor/index.ts:1053-1070 ROW_DEL');
  await r.fclickAction('ed-askdel-no'); await sleep(700);
  ov = await ownVar();
  check(S, '「아니오」 → 줄 그대로', !!ov?.find((o) => o.id === newId), '남음', ov?.map((o) => o.name), 'src/ui/editor/index.ts:1069-1074');
  await r.fclickAction('set-own-del', newId); await sleep(700);
  await r.fclickAction('ed-askdel-yes'); await sleep(900);
  const rowsUi = await actions(/^set-own-del\|/);
  await t.shot('OWN-O9-deleted');
  await closeSettings();
  ov = await ownVar();
  check(S, '「예」 → 줄 지워짐 (저장·화면)', !ov?.find((o) => o.id === newId) && !rowsUi.some((x) => x.includes(newId)), '없음', { saved: ov?.map((o) => o.id), ui: rowsUi }, 'src/ui/settings.ts:1084');
  T = await turn('O9', '골목 끝까지 걷는다.');
  check(S, '갱신기 {own}: 지운 줄 없음', ownLine(T.ut) === L5, L5, ownLine(T.ut), 'src/core/shop.ts:1255-1264');

  // ── O10 초기값으로 ──
  S = 'O10 초기값으로';
  await openSettings('shop');
  await r.fclickAction('set-own-reset'); await sleep(800);
  await r.fclickAction('set-shop-judge', 'auto'); await sleep(800);
  await closeSettings();
  const v10 = await r.vars();
  check(S, '「초기값으로」 → $sh_own 빈 글(기본 세 줄로)', (v10.$sh_own ?? '') === '', '', v10.$sh_own, 'src/ui/settings.ts:1085-1089');
  T = await turn('O10', '잠시 숨을 고른다.');
  check(S, '갱신기 {own} = 기본 세 줄 (hs 다시 켬)', ownLine(T.ut) === DEF_LIST, DEF_LIST, ownLine(T.ut), 'src/core/shop.ts:79');
}

// ═════════════════════ 시그니처 상품 표 (우주 쇼핑몰) ═════════════════════
if (on('fx')) {
  let cosN = 0;
  // 우주몰 진열 답: 새로고침마다 이름을 바꿔 「지난 목록 피하기」에 안 걸리게. 모델이 시그니처와 같은 이름을 낸 경우도 하나 넣는다(xDup)
  const cosShelf = (xDup = '') => () => {
    cosN++;
    return `<shop-identity>\nsells: 출처를 모르는 이상한 물건\nnever: 환불\nprices: 원화만\ncurrency: -\n</shop-identity>\n<owner>\n안녕하신가! 새로운 상품, 우리는 진열했다. (${cosN})\n</owner>\n<shelf>\n녹슬지 않는 못 ${cosN}|3000|-|도구/못/nail|0.004|박는다. 녹슬지 않는다.|||?\n말 듣는 우산 ${cosN}|22000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다.|???||?\n${xDup ? `${xDup}|1000|-|기타/인형/doll|0.05|모델이 낸 같은 이름|||?\n` : ''}</shelf>`;
  };
  const shelfNow = async () => (r.J(await r.vars(), '$cos_shop')?.items ?? []).filter((x) => !x.sold).map((x) => ({ name: x.name, price: x.price, was: x.was, tag: x.tag, truth: x.truth, desc: x.desc, effect: x.effect }));
  const openCos = async () => {
    await t.openWindow(); await sleep(1200);
    if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) {
      if (!(await t.feval(() => !!document.querySelector('.br')))) await r.fclickAction('nav-tab', 'net');
      await sleep(700);
      if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos');
      await sleep(1200);
    }
    return t.feval(() => !!document.querySelector('.ms-cos'));
  };
  /** 새로고침: 진열이 비었으면 「상품 가져오기」, 아니면 주소줄 ↻ */
  const refreshCos = async (tag, xDup) => {
    r.once('cos', cosShelf(xDup));
    const s = r.lastSeq();
    const empty = await t.feval(() => !!document.querySelector('[data-action="mall-refresh"]'));
    await r.fclickAction(empty ? 'mall-refresh' : 'br-reload');
    await r.until(async () => r.since(s, 'cos').length, 20000);
    await sleep(2500);
    const req = r.since(s, 'cos')[0];
    r.save(`OWN-${tag}-우주몰진열`, r.since(s, 'cos'));
    return { req, txt: req ? msgsText(req.body) : '', shelf: await shelfNow(), ui: await r.ftext('.ms-cos').catch(() => '') };
  };
  const fxRows = async () => (await actions(/^ms-fx-del\|/)).map((x) => x.split('|')[1]);

  // ── X0 기본 표: 우리가 도움! 0%, 착한 친구 100% (화면에서 확률 고침) ──
  let S = 'X0 기본 줄 확률';
  await openSettings('cos');
  note(S, '시그니처 표 처음 줄', await fxRows());
  await typeInto('[data-change="ms-fx"][data-key="f_wehelp:pct"]', '0');
  await typeInto('[data-change="ms-fx"][data-key="f_friend:pct"]', '100');
  await t.shot('OWN-X0-settings');
  await closeSettings();
  let fx = await fxVar();
  check(S, '저장: f_wehelp pct 0 · f_friend pct 100 (나머지 기본 그대로)', fx?.find((f) => f.id === 'f_wehelp')?.pct === 0 && fx?.find((f) => f.id === 'f_friend')?.pct === 100 && fx?.find((f) => f.id === 'f_friend')?.price === 44444, { f_wehelp: 0, f_friend: 100, price: 44444 }, fx?.map((f) => `${f.id}:${f.pct}:${f.price}`), 'src/ui/malls.ts:1414-1426 · src/core/malls.ts:225-228 COS_FIXED_DEFAULT');
  check(S, '우주몰 창 열림', await openCos(), true, await r.ftext('.gx').then((x) => x.slice(0, 120)).catch(() => ''));
  let R = await refreshCos('X0', '착한 친구');
  check(S, '진열 요청 1건', !!R.req, 1, R.req ? 1 : 0);
  check(S, '진열 요청 글에 시그니처 이름 없음 (착한 친구·우리가 도움!)', R.req && !/착한 친구|우리가 도움/.test(R.txt), '없음', (/.{30}(착한 친구|우리가 도움).{30}/.exec(R.txt) || ['없음'])[0], 'src/ui/malls.ts:1209 도움말 「모델에게는 이름을 알리지 않고」 · malls.ts:193-198 · ' + NO_ROW);
  const friend = R.shelf.filter((x) => x.name === '착한 친구');
  check(S, '진열: 착한 친구 하나 (설정 값 44,444 · 할인 전 44,444,444 · sale · 진실 ?), 모델이 낸 같은 이름(1000원)은 버림', friend.length === 1 && friend[0].price === 44444 && friend[0].was === 44444444 && friend[0].tag === 'sale' && friend[0].truth === '?', { n: 1, price: 44444, was: 44444444, tag: 'sale', truth: '?' }, friend, 'src/ui/malls.ts:129 fixedItem · 196-197 dropItemsNamed+appendItems');
  check(S, '진열: 우리가 도움!(0%) 없음', !R.shelf.some((x) => x.name === '우리가 도움!'), '없음', R.shelf.map((x) => x.name), 'src/core/malls.ts:250 cosFixedRoll (rnd*100 < pct)');
  check(S, '화면 진열에 착한 친구 보임', /착한 친구/.test(R.ui), '보임', R.ui.slice(0, 200));
  await t.shot('OWN-X0-shelf');
  await t.closeWindow();

  // ── X1 상품 추가 (모든 칸 화면에서) ──
  S = 'X1 상품 추가';
  await openSettings('cos');
  const b1 = await fxRows();
  await r.fclickAction('ms-fx-add'); await sleep(900);
  const a1 = await fxRows();
  const nid = a1.find((id) => !b1.includes(id));
  check(S, '「상품 추가」 → 줄 +1 (기본 켬·25%·999,999원)', !!nid && a1.length === b1.length + 1, '줄 +1', { before: b1, after: a1 }, 'src/ui/malls.ts:1427 · src/core/malls.ts:249 newCosFixed');
  if (nid) {
    await typeInto(`[data-change="ms-fx"][data-key="${nid}:name"]`, '시험 시그니처 거울');
    await typeInto(`[data-change="ms-fx"][data-key="${nid}:pct"]`, '100');
    await typeInto(`[data-change="ms-fx"][data-key="${nid}:price"]`, '12345');
    await typeInto(`[data-change="ms-fx"][data-key="${nid}:desc"]`, '비춘다. 뒤가 보인다.');
    await typeInto(`[data-change="ms-fx"][data-key="${nid}:effect"]`, '등 뒤 확인 백 퍼센트');
    await typeInto(`[data-change="ms-fx"][data-key="${nid}:truth"]`, '비춘 사람의 그림자가 하루 늦게 따라온다');
  }
  await t.shot('OWN-X1-settings');
  await closeSettings();
  fx = await fxVar();
  const nf = fx?.find((f) => f.id === nid);
  check(S, '저장: 새 줄 칸 값 그대로', nf && nf.on && nf.pct === 100 && nf.price === 12345 && nf.name === '시험 시그니처 거울' && nf.desc === '비춘다. 뒤가 보인다.' && nf.effect === '등 뒤 확인 백 퍼센트' && nf.truth === '비춘 사람의 그림자가 하루 늦게 따라온다' && !nf.was, { on: true, pct: 100, price: 12345, was: '없음' }, nf, 'src/ui/malls.ts:1414-1426');
  await openCos();
  R = await refreshCos('X1');
  check(S, '진열 요청 글에 새 시그니처 이름·진실 없음', R.req && !/시험 시그니처 거울|하루 늦게 따라온다/.test(R.txt), '없음', (/.{30}(시험 시그니처 거울|하루 늦게).{30}/.exec(R.txt) || ['없음'])[0], 'src/ui/malls.ts:1209 도움말');
  const mir = R.shelf.find((x) => x.name === '시험 시그니처 거울');
  check(S, '진열: 새 상품 12,345원·설명·효과·진실(숨김) 그대로, 할인 딱지 없음', mir && mir.price === 12345 && mir.desc === '비춘다. 뒤가 보인다.' && mir.effect === '등 뒤 확인 백 퍼센트' && mir.truth === '비춘 사람의 그림자가 하루 늦게 따라온다' && !mir.tag, { price: 12345, truth: '설정 글', tag: '없음' }, mir, 'src/ui/malls.ts:129');
  check(S, '진열: 착한 친구도 다시 (새로고침마다 굴림, 100%)', R.shelf.filter((x) => x.name === '착한 친구').length === 1, 1, R.shelf.map((x) => x.name), 'src/ui/malls.ts:194-197');
  check(S, '화면에 진실 글 안 보임', !/하루 늦게 따라온다/.test(R.ui) && /시험 시그니처 거울/.test(R.ui), { name: '보임', truth: '안 보임' }, R.ui.slice(0, 300), 'malls.ts:1206 「숨긴 진짜 효과 — 메인 모델만」');
  await t.shot('OWN-X1-shelf');
  await t.closeWindow();

  // ── X2 고치기: 값·할인 전 ──
  S = 'X2 고치기';
  await openSettings('cos');
  await typeInto(`[data-change="ms-fx"][data-key="${nid}:price"]`, '20000');
  await typeInto(`[data-change="ms-fx"][data-key="${nid}:was"]`, '50000');
  await closeSettings();
  fx = await fxVar();
  check(S, '저장: 값 20000·할인 전 50000', fx?.find((f) => f.id === nid)?.price === 20000 && fx?.find((f) => f.id === nid)?.was === 50000, { price: 20000, was: 50000 }, fx?.find((f) => f.id === nid), 'src/ui/malls.ts:1420-1424');
  await openCos();
  R = await refreshCos('X2');
  const mir2 = R.shelf.filter((x) => x.name === '시험 시그니처 거울');
  check(S, '진열: 고친 값 20,000·할인 전 50,000·sale 하나', mir2.length === 1 && mir2[0].price === 20000 && mir2[0].was === 50000 && mir2[0].tag === 'sale', { n: 1, price: 20000, was: 50000, tag: 'sale' }, mir2, 'src/ui/malls.ts:129');
  await t.closeWindow();

  // ── X3 끄기: 착한 친구 OFF (100% 그대로), 새 상품 확률 0 ──
  S = 'X3 끄기·확률 0';
  await openSettings('cos');
  await r.fclickAction('ms-cfg', 'cos:fx_on:f_friend=0'); await sleep(800);
  await typeInto(`[data-change="ms-fx"][data-key="${nid}:pct"]`, '0');
  await t.shot('OWN-X3-settings');
  await closeSettings();
  fx = await fxVar();
  check(S, '저장: f_friend on=false (pct 100 그대로) · 새 줄 pct 0', fx?.find((f) => f.id === 'f_friend')?.on === false && fx?.find((f) => f.id === 'f_friend')?.pct === 100 && fx?.find((f) => f.id === nid)?.pct === 0, { f_friend: 'off/100', new: 0 }, fx?.map((f) => `${f.id}:${f.on}:${f.pct}`), 'src/ui/malls.ts:1376-1377');
  await openCos();
  R = await refreshCos('X3', '착한 친구');
  check(S, '진열: 착한 친구 없음 (끈 줄은 모델이 같은 이름을 내도 버림)', !R.shelf.some((x) => x.name === '착한 친구'), '없음', R.shelf.map((x) => x.name), 'src/ui/malls.ts:196 dropItemsNamed (fixed 전부, on 무관) · 250 cosFixedRoll(on 만)');
  check(S, '진열: 확률 0 상품 없음', !R.shelf.some((x) => x.name === '시험 시그니처 거울'), '없음', R.shelf.map((x) => x.name), 'src/core/malls.ts:250');
  await t.closeWindow();

  // ── X4 지우기: 확인 창 → 아니오 → 예 ──
  S = 'X4 지우기·확인 창';
  await openSettings('cos');
  const dlg0 = t.errors.filter((e) => e.startsWith('dialog:')).length;
  await r.fclickAction('ms-fx-del', nid); await sleep(800);
  const ask = await t.feval(() => { const y = document.querySelector('[data-action="ed-askdel-yes"]'); let box = y; while (box && !/지울까요/.test(box.innerText ?? '') && box.parentElement) box = box.parentElement; return y ? { text: (box?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), no: !!document.querySelector('[data-action="ed-askdel-no"]') } : null; });
  const dlg1 = t.errors.filter((e) => e.startsWith('dialog:')).length;
  await t.shot('OWN-X4-ask');
  check(S, '지우기 → 플러그인 안 팝업 「이 시그니처 상품을 지울까요?」(브라우저 dialog 아님)', !!ask && /이 시그니처 상품을 지울까요/.test(ask.text) && dlg1 === dlg0, { popup: '이 시그니처 상품을 지울까요?', browserDialog: 0 }, { ask, browserDialog: dlg1 - dlg0 }, 'src/ui/editor/index.ts:1058,1067-1070');
  await r.fclickAction('ed-askdel-no'); await sleep(700);
  check(S, '「아니오」 → 줄 남음', (await fxVar())?.some((f) => f.id === nid), '남음', (await fxVar())?.map((f) => f.id));
  await r.fclickAction('ms-fx-del', nid); await sleep(700);
  await r.fclickAction('ed-askdel-yes'); await sleep(900);
  const ui4 = await fxRows();
  await closeSettings();
  fx = await fxVar();
  check(S, '「예」 → 줄 지워짐 (저장·화면)', !fx?.some((f) => f.id === nid) && !ui4.includes(nid), '없음', { saved: fx?.map((f) => f.id), ui: ui4 }, 'src/ui/malls.ts:1428');

  // ── X5 다 지우기 → 「[]」 저장, 진열에 시그니처 없음 ──
  S = 'X5 다 지우기';
  await openSettings('cos');
  for (const id of ['f_wehelp', 'f_friend']) { await r.fclickAction('ms-fx-del', id); await sleep(500); await r.fclickAction('ed-askdel-yes'); await sleep(800); }
  const ui5 = await t.feval(() => [...document.querySelectorAll('.ps-group')].map((g) => g.innerText).find((x) => /시그니처 상품/.test(x))?.replace(/\s+/g, ' ').slice(0, 200) ?? null);
  await closeSettings();
  const v5 = await r.vars();
  check(S, '저장 $cos_fixed = "[]" (기본값으로 안 돌아감), 화면 「없음.」', v5.$cos_fixed === '[]' && /없음\./.test(ui5 ?? ''), { saved: '[]', ui: '없음.' }, { saved: v5.$cos_fixed, ui: ui5 }, 'src/core/malls.ts:229-232 (「[]」이면 없음) · malls.ts:1209');
  await openCos();
  R = await refreshCos('X5', '착한 친구');
  check(S, '진열: 시그니처 없음, 모델이 낸 「착한 친구」는 이제 버리지 않음', !R.shelf.some((x) => x.name === '우리가 도움!') && R.shelf.some((x) => x.name === '착한 친구' && x.price === 1000), { 우리가도움: '없음', 착한친구: '모델 것 1000원' }, R.shelf.map((x) => `${x.name}:${x.price}`), 'src/ui/malls.ts:195-197 (fixed 가 비면 거르지 않음)');
  await t.closeWindow();
}

r.writeResults(`${OUTROOT}결과-own${RUN}.json`);
await r.stop();
await t.close();
