import assert from 'node:assert/strict';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin } from '../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../tests/data-init.mjs';
import { SHOW } from '../../../tests/homeshop-show.mjs';

const fx = loadFixture(new URL('../../../.scratch/fixture/fixture.json', import.meta.url).pathname);
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const items0 = { list: [{ id: 'i_old', name: '낡은 손전등', desc: '', effect: '', use: false, state: 'ok', from: 'manual', anchor: '', at: '2025-01-01T00:00:00Z' }], log: [] };
const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $hs_net: '1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_items: JSON.stringify(items0) } };
const { page, errors } = await boot(browser, fx, chat, { width: 1280, height: 800, touch: false }, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
const ss = () => page.evaluate(() => window.__chat.scriptstate);
const liveNames = async () => page.evaluate(() => { const keys = new Set(window.__chat.message.map((m) => m.chatId)); const j = JSON.parse(window.__chat.scriptstate.$st_items || '{"list":[]}'); return j.list.filter((x) => (!x.anchor || [...keys].some((k) => x.anchor.includes(k))) && !(x.soldAt && [...keys].some((k) => x.soldAt.includes(k)))).map((x) => x.name); });
const reopen = async () => { await closeWin(page); await openWin(page); await page.waitForTimeout(400); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await page.waitForTimeout(300); };
// 이미 소지품을 보고 있으면 누르지 않는다 (PC 는 같은 탭을 다시 누르면 상황판으로 간다)
const toItems = async () => { await page.waitForTimeout(400); if (!(await page.locator('[data-input="items-q"]').count())) await page.click('[data-action="nav-tab"][data-value="items"]'); await page.waitForSelector('[data-input="items-q"]', { timeout: 5000 }); await page.waitForTimeout(300); };
const goHs = async () => { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); await page.waitForTimeout(400); };
const reroll = async (id) => { await page.evaluate((i) => { window.__chat.message[window.__chat.message.length - 1].chatId = i; }, id); await reopen(); await toItems(); };
await openWin(page); await page.waitForTimeout(300);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
await goHs();
await page.waitForSelector('.hs-l3', { timeout: 15000 });
console.log('anchor sample', JSON.stringify(await page.evaluate(() => window.__chat.scriptstate.$hs_show_at)));
// ① 출연으로 주문 확정 두 번 누르기 → 한 건
await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(200);
await click('[data-action="hs-pay"][data-value="appear"]'); await page.waitForTimeout(200);
await page.evaluate(() => { const b = document.querySelector('[data-action="hs-order"]'); b.click(); b.click(); });
await page.waitForFunction(() => (window.__chat.scriptstate.$hs_orders || '').includes('무전기')); await page.waitForTimeout(500);
let st = await ss();
assert.equal(JSON.parse(st.$hs_orders).length, 1, '주문 한 건');
assert.equal(JSON.parse(st.$st_items).list.filter((x) => x.name.includes('택배 상자')).length, 1, '상자 한 개');
const o1 = JSON.parse(st.$hs_orders)[0];
assert.deepEqual([o1.pay, o1.n, o1.dues.length], ['appear', 1, 0], '시연은 상자를 열 때 걸린다 (2026-11-16)');
console.log('① ok', o1.anchor, o1.boxId);
// ② 응답 다시 굴리기 → 주문·상자 사라짐, 다시 주문 가능
await click('.hs-pop header [data-action="hs-pop"]');
const atA = JSON.parse((await ss()).$hs_show).at;
await reroll('c1b');
assert.equal(await page.locator(`[data-action="items-open"][data-value="${o1.boxId}"]`).count(), 0, '다시 굴리면 상자 없음');
await goHs();
assert.equal(await page.locator('[data-action="hs-pop"][data-value="call"]:not([disabled])').count(), 1, '다시 주문할 수 있음');
await click('[data-action="hs-page"][data-value="orders"]'); await page.waitForTimeout(300);
assert.ok(!(await page.textContent('.hs-wrap')).includes('무전기'), '주문 조회에 없음');
await click('[data-action="hs-page"][data-value=""]'); await page.waitForTimeout(300);
assert.equal(JSON.parse((await ss()).$hs_show).at, atA, '다시 굴린 것은 턴이 아니다: 편성 그대로 (11-11 사용자)');
console.log('② ok');
// ③ 맞교환 주문 → 물건 빠짐·호출 없음, 다시 굴리면 물건 돌아옴
await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(200);
await click('[data-action="hs-pay"][data-value="barter"]'); await page.waitForTimeout(200);
const order = page.locator('button[data-action="hs-order"]');
await order.waitFor();
if (await order.isEnabled()) {
  await order.click();
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$hs_orders || '[]').some(o => o.anchor === 'c1b'));
  const actual = JSON.parse((await ss()).$hs_orders).find(o => o.anchor === 'c1b');
  console.log('감정 전 확정된 주문', { pay: actual.pay, how: actual.how, n: actual.n, boxId: actual.boxId }, await liveNames());
  await browser.close();
  assert.fail('다시 굴린 뒤 이전 출연 조건으로 맞교환 주문이 저장됨');
}
await browser.close();
console.log('PASS: 감정 전 주문 버튼 비활성');
