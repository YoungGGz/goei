// 3차 점검 E·G · T1 갈래: 저장 실패 스위치 셋(채팅·기기 저장소·카드)과 조립 단계 실패(__goeiFaultSteps)
// 상점 구매·팔기, 우주몰 결제, 망상홈쇼핑 주문, 택배 상자 열기에 저장 실패를 걸고 / 요청 조립의 소지품·망상홈쇼핑·사용 상자·상태창 단계를 하나씩 실패시킨다.
// 사용: (저장소 맨 위에서) npm run build 뒤 node 인수인계/플레이순서_점검/3차/E/t1.mjs [묶음…]   묶음: shop sell cos hs box settle asm
// 가짜 리스: tests/qc-host.mjs (사용법 ../틀/T1_사용법.md). 픽스처 .scratch/fixture/fixture.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, boot, testBodyCode, setSaveFail, clearSaveFail, saveFails, request } from '../../../../tests/qc-host.mjs';
import { distPack } from '../../../../tests/data-init.mjs';
import { SHOW } from '../../../../tests/homeshop-show.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/t1/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const fxPath = process.env.FIXTURE || `${ROOT}.scratch/fixture/fixture.json`;
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const only = process.argv.slice(2);
const want = (g) => !only.length || only.includes(g);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const results = [];
const check = (step, what, ok, expect, actual, row = '') => { results.push({ step, what, ok: !!ok, expect, actual, row }); console.log(`${ok ? 'PASS' : 'FAIL'} [${step}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${String(JSON.stringify(actual)).slice(0, 600)}`}`); };
const note = (step, what, actual) => { results.push({ step, what, note: true, actual }); console.log(`NOTE [${step}] ${what}: ${JSON.stringify(actual).slice(0, 500)}`); };

const PACKS = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-homeshop': distPack('goei-data-homeshop') };
const STATUS = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 서대문구 기독교 상점|없음|없음|없음|관리국/신입|140000]';
const SHOP_REPLY = `블라렛이 진열대 쪽으로 손짓했다.\n${STATUS}\n[shop: 기독교 상점|블라렛]`;
const SHELF = `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원\ncurrency: -\n</shop-identity>\n<owner>천천히 보세요.</owner>\n<shelf>\n나무 묵주|10000|사용|necklace|손때 묻은 묵주|\n작은 성경|8000|-|bible|손바닥만 한 성경|\n성수 병|기도 한 번|소모1|bottle|축성받은 물|\n</shelf>`;
const SELL_OFFER = `<owner>묵주라. 칠천이면 받지요.</owner>\n<change mode="none">\n</change>\n<offer>7000</offer>`;
const COS_SHELF = `<shop-identity>\nsells: 이상한 물건\nnever: 환불\nprices: 원화만\ncurrency: -\n</shop-identity>\n<owner>\n안녕하신가! 새로운 상품, 우리는 진열했다.\n</owner>\n<shelf>\n반짝 걸음 구두약|15000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에.|걸음이 빛남||?\n말 듣는 우산|22000|손·사용|도구/우산/umbrella|0.48|펼친다. 비 멈춘다.|???||?\n</shelf>`;
const BASE = { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' };
const ITEMS0 = { list: [{ id: 'i_old', name: '낡은 손전등', desc: '배터리 반쯤', effect: '', truth: '빛이 닿은 그림자를 붙잡아 둔다', use: true, state: 'damaged', from: 'manual', anchor: '', at: '2025-01-01T00:00:00Z' }], log: [] };

/** 새 페이지: 채팅 하나 (u1·c1) */
async function fresh(reply, extra = {}) {
  const chat = { message: [{ role: 'user', data: '들어간다.', chatId: 'u1' }, { role: 'char', data: reply, chatId: 'c1' }], scriptstate: { ...BASE, ...extra } };
  const { page, errors, logs } = await boot(browser, fixture, chat, { fixtureDir, body: testBodyCode, viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (/^\[goei\]/.test(m.text()) && !logs.includes(m.text())) logs.push(m.text()); });
  await page.evaluate((p) => Object.assign(window.__store, p), PACKS);
  await page.evaluate(() => { const o = window.risuai.pluginStorage.setItem; window.__skeys = []; window.risuai.pluginStorage.setItem = async (k, v) => { window.__skeys.push(k); return o(k, v); }; });
  const act = async (action, value) => {
    await page.evaluate(({ action, value }) => {
      const b = document.createElement('button');
      b.dataset.action = action;
      if (value != null) b.dataset.value = value;
      b.style.display = 'none';
      (document.querySelector('.gx-panel') || document.querySelector('.gx'))?.appendChild(b);
      b.click();
      b.remove();
    }, { action, value });
    await sleep(350);
  };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  const openWin = async () => {
    await page.waitForFunction(() => !!window.__button);
    await page.evaluate(() => window.__button.cb());
    await page.waitForFunction(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none' && !g.querySelector('.gx-empty')?.textContent?.includes('읽는 중'); });
    await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) {
      await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click());
      await page.evaluate(() => document.querySelector('.gw [data-action="ed-close-force"]')?.click());
      await sleep(300);
    }
  };
  const closeWin = async () => {
    if (await page.evaluate(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none'; })) {
      await page.evaluate(() => document.querySelector('.gx-head [data-action="close"], .gx [data-action="close"]')?.click());
      await sleep(400);
    }
  };
  const vars = () => page.evaluate(() => ({ ...window.__chat.scriptstate }));
  const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('.gx-toast, [role="alert"], .gn-notice, .sh-notice, .cs-fail, .hs-note, .gx-notice')].map((e) => e.textContent.trim()).filter(Boolean));
  const counts = () => page.evaluate(() => ({ setChat: window.__counts.setChat, setChar: window.__counts.setChar, storage: window.__saveCalls.storage, chatCalls: window.__saveCalls.chat, skeys: window.__skeys.slice() }));
  const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });
  return { page, errors, logs, act, click, openWin, closeWin, vars, J, toasts, counts, shot };
}

// ── 상점 열기 (응답 처리 → 카드 → 진열) ──
async function shopOpen(P) {
  const { page, act, openWin, closeWin } = P;
  await openWin(); await closeWin();
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), SHOP_REPLY);
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate((t) => window.__calls.handlers.display(t), SHOP_REPLY);
  await page.evaluate((t) => { window.__llm = [{ type: 'success', result: t }]; }, SHELF);
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 8000 }).catch(() => {});
  await sleep(400);
  const st = P.J(await P.vars(), '$st_shop');
  return Object.fromEntries((st?.items ?? []).map((x) => [x.name, x.id]));
}
/** 상점 다시 열기 (창을 닫고 카드로 = 채팅을 새로 읽음) */
async function shopReopen(P) {
  const { page, act } = P;
  await act('shop-close'); await sleep(300);
  await page.evaluate((t) => { document.getElementById('chat-card').style.visibility = ''; return window.__calls.handlers.display(t); }, SHOP_REPLY);
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {});
  await sleep(500);
}
const shopScreen = (P) => P.page.evaluate(() => ({ sold: [...document.querySelectorAll('.sh-c')].filter((c) => c.classList.contains('sold') || /팔림|매진/.test(c.textContent)).map((c) => c.textContent.trim().slice(0, 20)), wallet: document.querySelector('.sh-bal, .sh-wallet, [class*="bal"]')?.textContent?.trim() ?? null }));
const savedShop = async (P) => { const v = await P.vars(); const w = P.J(v, '$st_wallet'); const it = P.J(v, '$st_items'); const st = P.J(v, '$st_shop'); return { walletLog: (w?.log ?? []).map((e) => `${e.memo}:${e.amount}`), items: (it?.list ?? []).filter((x) => !x.soldAt && !x.gone).map((x) => x.name), sold: (st?.items ?? []).filter((x) => x.sold).map((x) => x.name), sales: (st?.sales ?? []).map((x) => `${x.name}:${x.price}`), itemLog: (it?.log ?? []).map((l) => `${l.what}:${l.name}`) }; };

// 기대값 (이 판 결정표·코스 2-1·4절 「저장 실패 (던짐 / 조용히 안 씀) — 다시 시도 없음」):
//  던짐: 저장이 안 됐으니 돈·물건·진열 표시가 한꺼번에 그대로(반쯤 바뀌지 않음), 화면에 「샀어요」가 안 뜨고 무언가 실패가 보임, 다시 시도 없음(setChat 1번), 다시 열면 그대로.
//  조용히 안 씀: 리스AI 가 아무 말 없이 안 씀 → 플러그인은 알 수 없음. 저장된 채팅은 그대로, 화면이 어떻게 보이는지·다시 열면 무엇이 보이는지 기록(판정 없음, 단 반쯤 바뀜이면 버그 후보).
for (const mode of ['throw', 'silent']) {
  if (want('shop')) {
    const S = `T1-상점 구매 · 채팅 저장 ${mode === 'throw' ? '던짐' : '조용히 안 씀'}`;
    const P = await fresh(SHOP_REPLY);
    const ids = await shopOpen(P);
    check(S, '진열 받음', ids['나무 묵주'], '묵주 있음', Object.keys(ids));
    const before = await savedShop(P);
    const c0 = await P.counts();
    await setSaveFail(P.page, 'chat', { from: 1, count: 1, mode });
    await P.act('shop-buy', ids['나무 묵주']); await sleep(500);
    const c1 = await P.counts();
    const after = await savedShop(P);
    const ui = { toasts: await P.toasts(), screen: await shopScreen(P) };
    await P.shot(`T1-shop-buy-${mode}`);
    check(S, '저장된 채팅은 그대로 (돈·물건·팔림 셋 다)', JSON.stringify(after) === JSON.stringify(before), before, after, '코스 4절 저장 실패');
    check(S, '다시 시도 없음 (채팅 쓰기 1번)', c1.setChat - c0.setChat === 1, 1, c1.setChat - c0.setChat, '코스 4절');
    note(S, '그사이 기기 저장소 쓴 열쇠·카드 쓰기', { storage: c1.skeys.slice(c0.skeys.length), setChar: c1.setChar - c0.setChar });
    note(S, '그때 화면 (안내·진열 팔림 표시·잔고)', ui);
    note(S, '오류·기록', { errors: P.errors.slice(-3), logs: P.logs.filter((l) => /저장|실패|error/i.test(l)).slice(-5), saveFails: await saveFails(P.page) });
    check(S, '화면에 「샀어요」가 안 뜸', mode === 'silent' || !ui.toasts.some((t) => /샀어요/.test(t)), '안 뜸', ui.toasts);
    await clearSaveFail(P.page);
    await shopReopen(P);
    const re = { toasts: await P.toasts(), screen: await shopScreen(P), saved: await savedShop(P) };
    await P.shot(`T1-shop-buy-${mode}-reopen`);
    note(S, '다시 연 화면', re);
    // 끈 뒤 다시 사면 한 번만 들어감
    await P.act('shop-buy', ids['나무 묵주']); await sleep(500);
    const again = await savedShop(P);
    check(S, '저장 실패를 끈 뒤 다시 사면 한 번만 들어감', again.items.filter((n) => n === '나무 묵주').length === 1 && again.walletLog.filter((l) => l.startsWith('나무 묵주')).length === 1, '묵주 1개·가계부 1줄', again);
    await P.page.close();
  }
  if (want('sell')) {
    const S = `T1-상점 팔기 · 채팅 저장 ${mode === 'throw' ? '던짐' : '조용히 안 씀'}`;
    const P = await fresh(SHOP_REPLY);
    const ids = await shopOpen(P);
    await P.act('shop-buy', ids['나무 묵주']); await sleep(400);
    const myId = (P.J(await P.vars(), '$st_items')?.list ?? []).find((x) => x.name === '나무 묵주')?.id;
    await P.act('shop-pick'); await P.act('shop-sell-pick', myId);
    await P.page.evaluate((t) => { window.__llm = [{ type: 'success', result: t }]; }, SELL_OFFER);
    await P.page.evaluate(() => { const i = document.querySelector('[data-input="shop-say"]'); if (i) { i.value = '얼마 쳐줘요?'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await P.act('shop-say', '얼마 쳐줘요?');
    await P.page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 8000 }).catch(() => {});
    await sleep(400);
    const offer = P.J(await P.vars(), '$st_shop')?.sell;
    check(S, '팔기 제안 받음 (7,000)', offer?.price === 7000, 7000, offer);
    const before = await savedShop(P);
    const c0 = await P.counts();
    await setSaveFail(P.page, 'chat', { from: 1, count: 1, mode });
    await P.act('shop-sell'); await sleep(500);
    const c1 = await P.counts();
    const after = await savedShop(P);
    const ui = { toasts: await P.toasts(), screen: await shopScreen(P) };
    await P.shot(`T1-shop-sell-${mode}`);
    check(S, '저장된 채팅은 그대로 (가계부·소지품·판 것)', JSON.stringify(after) === JSON.stringify(before), before, after, '코스 4절');
    check(S, '다시 시도 없음', c1.setChat - c0.setChat === 1, 1, c1.setChat - c0.setChat);
    note(S, '그때 화면', ui);
    note(S, '오류·기록', { errors: P.errors.slice(-3), logs: P.logs.filter((l) => /저장|실패|error/i.test(l)).slice(-5) });
    check(S, '화면에 「팔았어요」가 안 뜸', mode === 'silent' || !ui.toasts.some((t) => /팔았/.test(t)), '안 뜸', ui.toasts);
    await clearSaveFail(P.page);
    await P.act('shop-sell'); await sleep(500);
    const again = await savedShop(P);
    check(S, '끈 뒤 다시 팔면 한 번만', again.sales.length === 1 && !again.items.includes('나무 묵주') && again.walletLog.filter((l) => l.endsWith(':7000')).length === 1, '판 것 1·가계부 +7000 1줄', again);
    await P.page.close();
  }
  if (want('cos')) {
    const S = `T1-우주몰 결제 · 채팅 저장 ${mode === 'throw' ? '던짐' : '조용히 안 씀'}`;
    const P = await fresh(`조용한 아침이다.\n${STATUS}`);
    await P.openWin();
    if (!(await P.page.evaluate(() => !!document.querySelector('.br')))) await P.act('nav-tab', 'net');
    if (!(await P.click('[data-action="br-go"][data-value="cos"]'))) if (!(await P.click('[data-action="br-site"][data-value="cos"]'))) await P.click('.br-bm[data-value="cos"]');
    await sleep(600);
    await P.page.evaluate((t) => { window.__llm = [{ type: 'success', result: t }]; }, COS_SHELF);
    await P.act('mall-refresh');
    await P.page.waitForFunction(() => (window.__chat.scriptstate.$cos_shop || '').includes('구두약'), null, { timeout: 8000 }).catch(() => {});
    await sleep(500);
    const cos = P.J(await P.vars(), '$cos_shop');
    const ids = Object.fromEntries((cos?.items ?? []).map((x) => [x.name, x.id]));
    check(S, '진열 받음', ids['반짝 걸음 구두약'], '구두약', Object.keys(ids));
    await P.act('mall-cart', ids['반짝 걸음 구두약']);
    await P.act('mall-page', 'cart'); await P.act('mall-order'); await sleep(300);
    const snap = async () => { const v = await P.vars(); const w = P.J(v, '$st_wallet'); const it = P.J(v, '$st_items'); const c = P.J(v, '$cos_shop'); return { walletLog: (w?.log ?? []).map((e) => `${e.memo}:${e.amount}`), items: (it?.list ?? []).filter((x) => !x.soldAt && !x.gone).map((x) => x.name), sold: (c?.items ?? []).filter((x) => x.sold).map((x) => x.name), cart: c?.cart ?? null }; };
    await sleep(800);
    const before = await snap();
    const v0 = await P.vars();
    const c0 = await P.counts();
    await setSaveFail(P.page, 'chat', { from: 1, count: 1, mode });
    await P.act('mall-pay'); await sleep(800);
    const c1 = await P.counts();
    const after = await snap();
    const v1 = await P.vars();
    note(S, '그사이 바뀐 저장 변수', Object.keys({ ...v0, ...v1 }).filter((k) => v0[k] !== v1[k]));
    const ui = await P.page.evaluate(() => ({ text: (document.querySelector('.ms-cos, .br-page')?.innerText ?? '').split('\n').filter((l) => /결제|실패|저장|잔고|완료|구매/.test(l)).slice(0, 8), toasts: [...document.querySelectorAll('.gx-toast, .cs-fail, [role="alert"]')].map((e) => e.textContent.trim()) }));
    await P.shot(`T1-cos-pay-${mode}`);
    check(S, '저장된 채팅은 그대로 (가계부·소지품·팔림)', JSON.stringify({ ...after, cart: null }) === JSON.stringify({ ...before, cart: null }), before, after, '코스 4절');
    check(S, '다시 시도 없음 (결제 저장 1번 실패 뒤 결제 다시 안 씀)', (await saveFails(P.page)).length === 1, 1, { saveFails: await saveFails(P.page), setChat: c1.setChat - c0.setChat });
    note(S, '그때 화면', ui);
    note(S, '오류·기록', { errors: P.errors.slice(-3), logs: P.logs.filter((l) => /저장|실패|error/i.test(l)).slice(-5) });
    await clearSaveFail(P.page);
    await P.act('mall-pay-close');
    if (mode === 'silent') { note(S, '조용히 안 쓴 뒤 화면 장바구니', await P.page.evaluate(() => document.querySelector('[data-action="mall-page"][data-value="cart"]')?.textContent?.trim())); await P.act('mall-cart', ids['반짝 걸음 구두약']); }
    await P.act('mall-page', 'cart'); await P.act('mall-order'); await sleep(300); await P.act('mall-pay'); await sleep(800);
    const again = await snap();
    check(S, '끈 뒤 다시 결제하면 한 번만', again.items.filter((n) => n === '반짝 걸음 구두약').length === 1 && again.walletLog.filter((l) => l.includes('구두약')).length === 1, '구두약 1·가계부 1줄', again);
    await P.page.close();
  }
  for (const grp of ['hs', 'box']) if (want(grp)) {
    const S = `T1-망상홈쇼핑 주문 · 채팅 저장 ${mode === 'throw' ? '던짐' : '조용히 안 씀'}`;
    const S2 = `T1-택배 상자 열기 · 채팅 저장 ${mode === 'throw' ? '던짐' : '조용히 안 씀'}`;
    const P = await fresh(`첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]`, { $hs_net: '1', $st_wallet: JSON.stringify({ start: 500000, log: [] }), $st_items: JSON.stringify(ITEMS0) });
    await P.openWin();
    await P.page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
    if (!(await P.page.evaluate(() => !!document.querySelector('.br')))) await P.click('[data-action="nav-tab"][data-value="net"]');
    await P.click('.br-bm[data-value="hs"]');
    await P.page.waitForSelector('.hs-l3', { timeout: 15000 }).catch(() => {});
    await P.page.evaluate(() => { window.__llm = [{ type: 'success', result: '<operator>받았다. 무전기 말이지.</operator>' }]; });
    await P.click('[data-action="hs-pop"][data-value="call"]');
    await P.page.waitForFunction(() => (document.querySelector('.hs-op')?.textContent ?? '').includes('받았다'), null, { timeout: 15000 }).catch(() => {});
    const snap = async () => { const v = await P.vars(); const w = P.J(v, '$st_wallet'); const it = P.J(v, '$st_items'); const o = P.J(v, '$hs_orders'); return { walletLog: (w?.log ?? []).map((e) => `${e.memo}:${e.amount}`), items: (it?.list ?? []).filter((x) => !x.soldAt && !x.gone).map((x) => x.name), orders: (o ?? []).map((x) => `${x.item?.name ?? x.name}:${x.openKey !== undefined ? 'open' : 'closed'}`) }; };
    if (grp === 'hs') {
      const before = await snap();
      const c0 = await P.counts();
      await setSaveFail(P.page, 'chat', { from: 1, count: 1, mode });
      await P.page.evaluate(() => { window.__llm = [{ type: 'success', result: '<operator>됐다. 상자는 곧 간다.</operator>' }]; });
      await P.click('[data-action="hs-order"]');
      await sleep(2500);
      const c1 = await P.counts();
      const after = await snap();
      const ui = await P.page.evaluate(() => ({ op: (document.querySelector('.hs-pop')?.innerText ?? '').split('\n').filter(Boolean).slice(-8), notes: [...document.querySelectorAll('.hs-note, .gx-toast, .hs-pop [role="alert"], .hs-fail')].map((e) => e.textContent.trim()) }));
      await P.shot(`T1-hs-order-${mode}`);
      check(S, '저장된 채팅은 그대로 (가계부·소지품·주문)', JSON.stringify(after) === JSON.stringify(before), before, after, '코스 4절');
      check(S, '다시 시도 없음 (주문 저장 쓰기 1번, 뒤따른 다른 저장은 따로 셈)', (await saveFails(P.page)).length === 1, 1, { saveFails: await saveFails(P.page), setChat: c1.setChat - c0.setChat });
      note(S, '그때 화면 (상담원 말·안내)', { ...ui, llmCalls: await P.page.evaluate(() => window.__calls.llm.length) });
      note(S, '오류·기록', { errors: P.errors.slice(-3), logs: P.logs.filter((l) => /저장|실패|error/i.test(l)).slice(-5) });
      await clearSaveFail(P.page);
      await P.page.evaluate(() => { window.__llm = [{ type: 'success', result: '<operator>됐다. 상자는 곧 간다.</operator>' }]; });
      const okOrder = await P.click('[data-action="hs-order"]');
      await sleep(2500);
      const again = await snap();
      check(S, '끈 뒤 다시 주문하면 한 번만 (단추가 남아 있으면)', !okOrder || (again.orders.length === 1 && again.items.filter((n) => /택배 상자/.test(n)).length === 1), '주문 1·상자 1', { okOrder, again });
    } else {
      await P.page.evaluate(() => { window.__llm = [{ type: 'success', result: '<operator>됐다. 상자는 곧 간다.</operator>' }]; });
      await P.click('[data-action="hs-order"]');
      await sleep(2500);
    }
    if (grp === 'box') {
      const o1 = (P.J(await P.vars(), '$hs_orders') ?? [])[0];
      check(S2, '주문 1건·상자 있음', o1?.boxId, '상자', o1);
      await P.click('.hs-pop footer [data-action="hs-pop"]'); await sleep(300);
      await P.click('[data-action="nav-tab"][data-value="items"]'); await sleep(400);
      await P.click(`[data-action="items-open"][data-value="${o1?.boxId}"]`); await sleep(400);
      const before = await snap();
      const c0 = await P.counts();
      await setSaveFail(P.page, 'chat', { from: 1, count: 1, mode });
      const had = await P.click('[data-action="hs-box-open"]');
      await sleep(800);
      const c1 = await P.counts();
      const after = await snap();
      const ui = await P.page.evaluate(() => ({ detail: document.querySelector('.it-det, .it-detail, .gx-panel')?.innerText?.split('\n').slice(0, 6), toasts: [...document.querySelectorAll('.gx-toast, [role="alert"]')].map((e) => e.textContent.trim()) }));
      await P.shot(`T1-box-open-${mode}`);
      check(S2, '「열기」 단추 있음', had, true, had);
      check(S2, '저장된 채팅은 그대로 (상자·물건·주문)', JSON.stringify(after) === JSON.stringify(before), before, after, '코스 4절');
      check(S2, '다시 시도 없음', c1.setChat - c0.setChat === 1, 1, c1.setChat - c0.setChat);
      note(S2, '그때 화면', ui);
      note(S2, '오류·기록', { errors: P.errors.slice(-3), logs: P.logs.filter((l) => /저장|실패|error/i.test(l)).slice(-5) });
      await clearSaveFail(P.page);
      await P.click(`[data-action="items-open"][data-value="${o1?.boxId}"]`); await sleep(300);
      await P.click('[data-action="hs-box-open"]'); await sleep(800);
      const again = await snap();
      check(S2, '끈 뒤 다시 열면 물건 한 번만', again.items.filter((n) => n === '행운의 무전기' || /무전기/.test(n)).length === 1 && !again.items.some((n) => /택배 상자/.test(n)), '무전기 1·상자 없음', again);
    }
    await P.page.close();
  }
}

// ── 기기 저장소·카드 저장 실패: 사기·팔기는 채팅에만 쓴다 (호출 기록 goei-trace 만 기기 저장소). 기기 저장소를 던지게 해도 거래는 된다 ──
if (want('store')) {
  for (const target of ['storage', 'char']) {
    const S = `T1-상점 구매·팔기 · ${target === 'storage' ? '기기 저장소' : '카드'} 저장 던짐`;
    const P = await fresh(SHOP_REPLY);
    const ids = await shopOpen(P);
    await setSaveFail(P.page, target, { mode: 'throw' });
    const c0 = await P.counts();
    await P.act('shop-buy', ids['나무 묵주']); await sleep(500);
    const a = await savedShop(P);
    const c1 = await P.counts();
    check(S, '구매는 채팅에 저장됨', a.items.includes('나무 묵주') && a.walletLog.length === 1, '묵주·가계부 1줄', a);
    note(S, '걸린 저장 실패·기록', { saveFails: await saveFails(P.page), storageKeys: c1.skeys.slice(c0.skeys.length), setChar: c1.setChar - c0.setChar, logs: P.logs.filter((l) => /실패/.test(l)).slice(-3), toasts: await P.toasts() });
    await P.page.close();
  }
}

// ── 응답 처리 첫 저장 실패: [shop:] 표식 응답 → 상점 상태가 안 생기고, 카드는? (코스 C-7 「응답 처리 첫 저장 실패 → 그 턴 뒤 처리가 통째로 빠지는 자리」) ──
if (want('settle')) {
  for (const mode of ['throw', 'silent']) {
    const S = `T1-상점 표식 응답 처리 · 첫 채팅 저장 ${mode === 'throw' ? '던짐' : '조용히 안 씀'}`;
    const P = await fresh(SHOP_REPLY);
    await P.openWin(); await P.closeWin();
    await P.page.evaluate(() => { const o = window.risuai.setChatToIndex; window.__wlog = []; window.risuai.setChatToIndex = async (a, b, c) => { const prev = window.__chat.scriptstate || {}; const nx = c.scriptstate || {}; window.__wlog.push({ keys: Object.keys({ ...prev, ...nx }).filter((k) => prev[k] !== nx[k]), msgs: (c.message || []).length }); return o(a, b, c); }; });
    await setSaveFail(P.page, 'chat', { from: 1, count: 1, mode });
    const r = await P.page.evaluate(async () => { try { await window.__calls.listeners[0]({ char: window.__clone(window.__char), chat: window.__clone(window.__chat), characterIndex: 0, chatIndex: 0, messageIndex: 1 }); return 'ok'; } catch (e) { return String(e.message); } });
    await sleep(500);
    const st = P.J(await P.vars(), '$st_shop');
    const html = await P.page.evaluate((t) => window.__calls.handlers.display(t), SHOP_REPLY);
    const card = html.includes('data-goei-shop');
    note(S, '응답 처리 중 채팅 쓰기마다 바뀐 변수 (첫 번째가 실패한 쓰기)', await P.page.evaluate(() => window.__wlog));
    note(S, '응답 처리 결과·상점 상태·카드', { listener: r, shop: st ? { shop: st.shop, key: st.key } : null, card, tagLeft: html.includes('[shop:'), saveFails: await saveFails(P.page), logs: P.logs.slice(-4) });
    if (mode === 'throw') check(S, '첫 저장이 던지면 그 턴 뒤 처리가 빠져 상점 상태가 없다', !st, '없음', st, '코스 4절·C-7');
    if (card && !st) {
      // 카드가 남았으면 눌러서 무엇이 뜨는지 (E-가 와 같은 자리인지)
      await P.page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
      await P.page.evaluate((t) => window.__calls.handlers.display(t), SHOP_REPLY);
      await clearSaveFail(P.page);
      await P.page.evaluate((t) => { window.__llm = [{ type: 'success', result: t }]; }, SHELF);
      await P.page.click('#chat-card [data-goei-shop]');
      await sleep(2500);
      const view = await P.page.evaluate(() => ({ solo: !!document.querySelector('.gx-solo'), shop: !!document.querySelector('.sh-wrap'), board: !!document.querySelector('.gx-ops, .gx-board, .gx-op-ln'), none: document.querySelector('.sh-none')?.textContent ?? null }));
      await P.shot(`T1-settle-${mode}-card`);
      note(S, '남은 카드를 누르면', view);
    }
    await P.page.close();
  }
}

// ── 조립 단계 실패 (시험 본체 __goeiFaultSteps): 그 단계만 빠지고 나머지·표식 지침은 그대로 (코스 4절 「그 단계만 건너뜀」, C-7) ──
if (want('asm')) {
  const P = await fresh(SHOP_REPLY);
  const ids = await shopOpen(P);
  await P.act('shop-buy', ids['나무 묵주']); await sleep(400);
  await P.act('shop-close'); await sleep(300);
  const reqText = async () => {
    await P.page.evaluate(() => { window.__chat.message = window.__chat.message.slice(0, 2); window.__chat.message.push({ role: 'user', data: '가게를 나온다', chatId: 'u2' }); });
    const out = await request(P.page, [{ role: 'system', content: '시스템' }, { role: 'user', content: '들어간다.' }, { role: 'assistant', content: SHOP_REPLY }, { role: 'user', content: '가게를 나온다' }]);
    return (Array.isArray(out) ? out : []).map((m) => String(m.content)).join('\n');
  };
  const base = await reqText();
  writeFileSync(`${OUT}T1-asm-base.txt`, base);
  const has = (t) => ({ inv: /\[Inventory\]/.test(t), bought: /just bought 나무 묵주/.test(t), prevStatus: /\[Previous status\]/.test(t), tagRule: /\[shop:/.test(t), tagLeft: /\[shop: 기독교 상점\|블라렛\]/.test(t) });
  note('T1-조립 단계 실패', '실패 없는 요청', has(base));
  for (const step of ['소지품', '상태창', '사용 상자', '망상홈쇼핑']) {
    const S = `T1-조립 단계 실패 · ${step}`;
    const n0 = P.logs.length;
    await P.page.evaluate((s) => { globalThis.__goeiFaultSteps = [s]; }, step);
    const t = await reqText();
    await P.page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
    writeFileSync(`${OUT}T1-asm-${step.replace(/\s/g, '')}.txt`, t);
    const log = P.logs.slice(n0).filter((l) => /조립 실패/.test(l));
    const h = has(t);
    check(S, '로그에 그 단계 실패 한 줄', log.some((l) => l.includes(step)), `단계 ${step}`, log, '코스 4절');
    check(S, '요청은 나감 (빈 요청 아님)', t.length > base.length * 0.5, '나감', t.length);
    if (step === '소지품') check(S, '[Inventory] 만 빠짐, 상태창은 남음', !h.inv && h.prevStatus, { inv: false, prevStatus: true }, h);
    else if (step === '상태창') check(S, '[Inventory] 는 남음', h.inv && h.bought, { inv: true }, h);
    else check(S, '[Inventory]·산 줄·상태창은 남음', h.inv && h.bought && h.prevStatus, '남음', h);
    check(S, '지난 답의 상점 표식·표식 지침은 실패 없는 요청과 같음', h.tagLeft === has(base).tagLeft && h.tagRule === has(base).tagRule, { tagLeft: has(base).tagLeft, tagRule: has(base).tagRule }, h);
  }
  // 조립 전체 실패 (beforeRequest)
  {
    const S = 'T1-조립 단계 실패 · 조립 전체(beforeRequest)';
    const n0 = P.logs.length;
    await P.page.evaluate(() => { globalThis.__goeiFaultSteps = ['beforeRequest']; });
    const t = await reqText().catch((e) => `THROW ${e.message}`);
    await P.page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
    writeFileSync(`${OUT}T1-asm-beforeRequest.txt`, t);
    note(S, '요청·로그', { len: t.length, head: t.slice(0, 120), tagLeft: /\[shop: 기독교 상점\|블라렛\]/.test(t), logs: P.logs.slice(n0).slice(-3) });
  }
  // 다음 요청은 다시 정상
  const back = has(await reqText());
  check('T1-조립 단계 실패', '실패를 끈 다음 요청은 다시 다 들어감', back.inv && back.bought && back.prevStatus, has(base), back);
  await P.page.close();
}

await browser.close();
const tag = only.length ? `-${only.join('')}` : '';
writeFileSync(`${OUT}결과-t1${tag}.json`, JSON.stringify(results, null, 2));
const n = results.filter((r) => !r.note);
console.log(`결과 ${n.filter((r) => r.ok).length}/${n.length} → ${OUT}결과-t1${tag}.json`);
