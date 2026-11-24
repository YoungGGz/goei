// 공통 갈래 「저장 실패」 (T1 스위치): 설정 창에서 값을 바꿀 때 기기 저장소(goei:prefs)·채팅 저장이 실패하면 화면이 무엇을 보여 주나
// 기대: 실패를 알리거나, 적어도 화면 값이 저장된 값과 어긋나지 않는다(다시 열면 같은 값). 코스 5장 「저장 실패 — 다시 시도 없음」
// 사용: node t1-kfail.mjs /tmp/t1fx/fixture.json
import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, boot, open, setSaveFail, clearSaveFail, saveFails } from '../../../../../tests/qc-host.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const fxPath = process.argv[2] || '/tmp/t1fx/fixture.json';
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rec = (name, o) => { const l = { t: new Date().toISOString(), name, ...o }; appendFileSync(HERE + '/out/steps.jsonl', JSON.stringify(l) + '\n'); console.log(o.ok ? 'OK ' : 'NG ', name, JSON.stringify(o.actual)); };
const chat = () => ({ message: [{ role: 'user', data: '시작', chatId: 'm0' }, { role: 'char', data: '로비는 조용했다.\n\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]', chatId: 'm1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } });
const segOn = (page, label) => page.evaluate((l) => { const r = [...document.querySelectorAll('.gw .ps-row')].find((x) => (x.querySelector('.ps-label b')?.firstChild?.textContent ?? '').trim() === l); return r ? [...r.querySelectorAll('.gx-seg.on')].map((b) => b.textContent.trim()) : null; }, label);
const box = (page, label) => page.evaluate((l) => { const r = [...document.querySelectorAll('.gw .ps-row')].find((x) => (x.querySelector('.ps-label b')?.firstChild?.textContent ?? '').trim() === l); return r ? [...r.querySelectorAll('input.adv-val')].map((i) => i.value) : null; }, label);
const notes = (page) => page.evaluate(() => [...document.querySelectorAll('.gx-toast, .gw .gx-err, .gw .gx-hint, [class*="toast"]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 5));
const node = async (page, id) => { await page.evaluate((id) => document.querySelector(`.gw [data-action="ed-node"][data-value="${id}"]`)?.click(), id); await sleep(500); };
const openSet = async (page) => { await page.evaluate(() => [...document.querySelectorAll('[data-action="ed-open"]')].find((x) => x.offsetParent !== null)?.click()); await page.waitForSelector('.gw:not([hidden])'); await sleep(400); };
const closeAll = async (page) => { await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-close"]')].find((x) => x.offsetParent !== null)?.click()); await sleep(300); await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()); await sleep(400); };
const typeNum = async (page, label, v) => { const loc = page.locator('.gw .ps-row', { has: page.locator('.ps-label b', { hasText: label }) }).locator('input.adv-val').first(); await loc.click(); await loc.fill(''); await loc.type(String(v)); await loc.press('Enter'); await loc.press('Tab').catch(() => {}); await sleep(600); };

for (const mode of ['throw', 'silent']) {
  // A. 기기 값 (메뉴 위치) — goei:prefs 저장 실패
  const { page, errors } = await boot(browser, fixture, chat(), { fixtureDir });
  await open(page); await sleep(900); await openSet(page); await node(page, 'set:screen');
  await setSaveFail(page, 'storage', { key: 'goei:prefs', mode });
  await page.locator('.gw .ps-row', { has: page.locator('.ps-label b', { hasText: '메뉴 위치' }) }).locator('.gx-seg', { hasText: '오른쪽' }).click(); await sleep(800);
  const a1 = { on: await segOn(page, '메뉴 위치'), notes: await notes(page), gxNav: await page.evaluate(() => document.querySelector('.gx')?.dataset.nav ?? null), stored: await page.evaluate(() => { try { return JSON.parse(window.__store['p:goei:prefs'] ?? 'null')?.nav ?? null; } catch { return 'x'; } }) };
  await page.screenshot({ path: `${HERE}/out/t1-kfail-prefs-${mode}.png` });
  await closeAll(page); await clearSaveFail(page); await open(page); await sleep(800); await openSet(page); await node(page, 'set:screen');
  const a2 = { on: await segOn(page, '메뉴 위치') };
  const fails = await saveFails(page);
  rec(`k-common 저장 실패: 기기 값 (${mode})`, { expect: '메뉴 위치 「오른쪽」 저장 실패 → 실패 안내가 있거나, 다시 열었을 때 화면 값=저장 값(왼쪽). 저장 안 된 값을 저장된 것처럼 계속 보이지 않음', src: '코스 5장 저장 실패, host/prefs.ts savePrefs', actual: { a1, a2, fails, errors: errors.slice(0, 3) }, ok: a1.notes.length > 0 || JSON.stringify(a1.on) === JSON.stringify([a1.stored === 'right' ? '오른쪽' : '왼쪽']) });
  await page.close();
  // B. 채팅 값 (다시 보기) — 채팅 저장 실패
  const b = await boot(browser, fixture, chat(), { fixtureDir });
  await open(b.page); await sleep(900); await openSet(b.page); await node(b.page, 'set:adv');
  await setSaveFail(b.page, 'chat', { mode });
  await typeNum(b.page, '다시 보기', 2);
  const b1 = { box: await box(b.page, '다시 보기'), notes: await notes(b.page) };
  await b.page.screenshot({ path: `${HERE}/out/t1-kfail-chat-${mode}.png` });
  await closeAll(b.page); await clearSaveFail(b.page); await open(b.page); await sleep(800); await openSet(b.page); await node(b.page, 'set:adv');
  const b2 = { box: await box(b.page, '다시 보기') };
  const savedChat = await b.page.evaluate(() => window.__calls.setChat.at(-1)?.scriptstate?.$gen_reiterate ?? null);
  rec(`k-common 저장 실패: 채팅 값 (${mode})`, { expect: '다시 보기 2 저장 실패 → 실패 안내가 있거나 화면 값이 저장 값(안 함)으로 돌아감', src: '코스 5장 저장 실패', actual: { b1, b2, savedChat, fails: await saveFails(b.page), errors: b.errors.slice(0, 3) }, ok: b1.notes.length > 0 || (b1.box?.[0] === '' || b1.box?.[0] === '0') });
  await b.page.close();
}
await browser.close();
