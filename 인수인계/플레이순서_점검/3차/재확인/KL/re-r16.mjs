// 재확인 KL R16 — T1: goei:prefs 쓰기가 던질 때 (가) 지침 글 고침 (나) 추가 규칙 「사용」 끄기 (다) 메뉴 위치
// node re-r16.mjs [fixture.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, boot, startChat, open, request, setSaveFail, clearSaveFail, saveFails } from '../../../../../tests/qc-host.mjs';

const FX = process.argv[2] || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/fx/fixture.json';
const OUT = '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-KL/out-r16';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const rec = (id, v) => { res.push({ id, ...v }); console.log(id, JSON.stringify(v).slice(0, 900)); };
const fixture = JSON.parse(readFileSync(FX, 'utf8'));
const fixtureDir = dirname(resolve(FX));
const browser = await launch();
const msgs = [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: '주위를 본다.' }];
const store = (page) => page.evaluate(() => { try { return JSON.parse(window.__store['p:goei:prefs'] || '{}'); } catch { return {}; } });
const edOpen = async (page, node) => {
  if (!(await page.$('.gw')) || !(await page.isVisible('.gw'))) {
    await open(page);
    await page.waitForSelector('.gx [data-action="ed-open"], .gx [data-action="prefs-open"]', { state: 'attached', timeout: 8000 });
    await page.evaluate(() => { const q = [...document.querySelectorAll('.gx [data-action="ed-open"], .gx [data-action="prefs-open"]')]; (q.find((e) => e.offsetParent) ?? q[0]).click(); });
    await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  }
  const tab = node.startsWith('guide:') || node.startsWith('rule:') ? 'guide' : node.startsWith('manage:') ? 'manage' : 'set';
  await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tab); await sleep(300);
  await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`)?.click(), node); await sleep(500);
};
const edClose = async (page) => { await page.evaluate(() => document.querySelector('.gw [data-action="ed-close"]')?.click()); await sleep(200); await page.evaluate(() => document.querySelector('.gw-confirm [data-action="ed-close-yes"]')?.click()); await sleep(300); };
const started = async (page) => {
  await startChat(page, 'A00', 2);
  await page.evaluate(async () => {
    window.__chat.scriptstate.$pp_when = 'manual';
    window.__chat.scriptstate.$ph_auto = '0';
    window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: '본문.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]' });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  });
  await sleep(500);
};
const uiNotes = (page) => page.evaluate(() => [...document.querySelectorAll('.gw .gx-err, .gx-toast, [role="alert"], .gw .gx-hint')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4));
try {
  // (가) 지침 글
  {
    const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
    await started(page);
    await edOpen(page, 'guide:RP');
    await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
    const ta = '.gw textarea[data-input="ed-guide-sec"]';
    await page.waitForSelector(ta);
    await page.$eval(ta, (e) => { e.focus(); e.value += '\n- RE16-GUIDE-MARK.'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(2000);
    const ui = await uiNotes(page);
    const head = await page.evaluate(() => document.querySelector('.gw .gw-head small')?.textContent ?? null);
    await page.screenshot({ path: `${OUT}/가_지침_저장실패.png` });
    await edClose(page);
    const inReq = JSON.stringify(await request(page, msgs)).includes('RE16-GUIDE-MARK');
    const stored = JSON.stringify(await store(page)).includes('RE16-GUIDE-MARK');
    const fails = await saveFails(page);
    const p2 = await store(page);
    await page.close();
    const b = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, prefs: Object.keys(p2).length ? p2 : null });
    await started(b.page);
    const inReq2 = JSON.stringify(await request(b.page, msgs)).includes('RE16-GUIDE-MARK');
    await b.page.close();
    rec('가 지침 글 고침 + prefs 던짐', { expect: '알림이 있거나, 저장 안 된 고침이 이 세션 요청에 안 쓰임', ui, head, inReqNow: inReq, stored, inReqAfterReboot: inReq2, fails: fails.length, pageErrors: errors.slice(0, 3), logs: logs.filter((l) => /실패|저장/.test(l)).slice(0, 4) });
  }
  // (나) 추가 규칙: 정상 저장으로 RP 에 붙는 규칙을 만든 뒤, 던지게 하고 「사용」 끄기
  {
    const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
    await started(page);
    await edOpen(page, 'rule:all');
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-rule-new"]')?.click()); await sleep(800);
    await page.$eval('.gw [data-input="ed-rule-text"]', (e) => { e.focus(); e.value = 'RE16-RULE-MARK 규칙 글'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(1200);
    const chips = await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-rule-to"]')].map((e) => [e.dataset.value, e.classList.contains('on'), e.textContent.trim()]));
    // RP(본편 역할극) 칩이 꺼져 있으면 켬
    const rp = chips.find((c) => /\|rp$/i.test(c[0]) || /RP|역할/.test(c[2]));
    if (rp && !rp[1]) { await page.evaluate((v) => document.querySelector(`.gw [data-action="ed-rule-to"][data-value="${v}"]`).click(), rp[0]); await sleep(800); }
    await edClose(page);
    const base = JSON.stringify(await request(page, msgs)).includes('RE16-RULE-MARK');
    const storedBase = JSON.stringify(await store(page)).includes('RE16-RULE-MARK');
    await edOpen(page, 'rule:all');
    await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-rule-on"]')?.click()); await sleep(1200);
    const sw = await page.evaluate(() => { const b = document.querySelector('.gw [data-action="ed-rule-on"]'); return b ? { aria: b.getAttribute('aria-checked'), on: b.classList.contains('on') } : null; });
    const ui = await uiNotes(page);
    await page.screenshot({ path: `${OUT}/나_규칙끄기_저장실패.png` });
    await edClose(page);
    const now = JSON.stringify(await request(page, msgs)).includes('RE16-RULE-MARK');
    const p2 = await store(page);
    const storedOn = (p2.rules ?? []).map((r) => r.on);
    await page.close();
    const b = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, prefs: p2 });
    await started(b.page);
    const after = JSON.stringify(await request(b.page, msgs)).includes('RE16-RULE-MARK');
    await b.page.close();
    rec('나 규칙 「사용」 끄기 + prefs 던짐', { expect: '알림, 그리고 화면 스위치·이번 요청·다시 켠 뒤가 같은 상태', chips, base, storedBase, switchAfter: sw, ui, ruleInReqNow: now, storedOn, ruleInReqAfterReboot: after, pageErrors: errors.slice(0, 3), logs: logs.filter((l) => /실패|ed-rule/.test(l)).slice(0, 3) });
  }
  // (다) 메뉴 위치 (기기 값)
  {
    const { page, errors } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
    await started(page);
    await edOpen(page, 'set:screen');
    const segOn = () => page.evaluate(() => { const row = [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label b')?.textContent.includes('메뉴 위치')); return row ? [...row.querySelectorAll('.gx-seg.on, .gx-seg[aria-pressed="true"]')].map((e) => e.textContent.trim()) : null; });
    const before = await segOn();
    await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
    await page.locator('.gw .ps-row', { has: page.locator('.ps-label b', { hasText: '메뉴 위치' }) }).locator('.gx-seg', { hasText: '오른쪽' }).click(); await sleep(900);
    const after = await segOn();
    const ui = await uiNotes(page);
    const stored = (await store(page)).nav ?? null;
    const navAttr = await page.evaluate(() => document.querySelector('.gx')?.dataset.nav ?? null);
    await page.screenshot({ path: `${OUT}/다_메뉴위치_저장실패.png` });
    await page.close();
    rec('다 메뉴 위치 오른쪽 + prefs 던짐', { expect: '알림 글이 기기 값에 맞고, 화면 값 = 저장 값', before, after, ui, stored, navAttr, pageErrors: errors.slice(0, 2) });
  }
} catch (e) {
  rec('예외', { e: String(e?.stack ?? e).slice(0, 1500) });
} finally {
  writeFileSync(`${OUT}/결과_R16.json`, JSON.stringify(res, null, 1));
  await browser.close();
}
