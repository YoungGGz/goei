import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../tests/data-init.mjs';

const fixture = loadFixture(resolve('.scratch/fixture/fixture.json'));
const output = resolve(process.argv[2] || '.scratch/shop-audit');
const shopTag = '[shop: 을지로 철물점|백사헌]';
const reply = '가게 안에 들어섰다.\n' + shopTag;
const shelf = '<shop-identity>\nsells: 문구\nnever: 식품\nprices: 동네 가격\n</shop-identity>\n<owner>어서 오세요.</owner>\n<shelf>\n연필|300|사용|pencil|연필|\n지우개|200|사용|eraser|지우개|\n</shelf>';
const refresh = '<owner>다른 물건입니다.</owner>\n<shelf>\n공책|400|사용|notebook|공책|\n</shelf>';
const chat = {
  message: [{ role: 'user', data: '가게에 간다.', chatId: 'u1' }, { role: 'char', data: reply, chatId: 'c1' }],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 1000, log: [] }), $st_items: '{"list":[],"log":[]}' }
};

async function settle(page) {
  await page.evaluate(() => window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }));
}
async function openCard(page, raw) {
  await page.evaluate(async (text) => {
    document.getElementById('audit-card')?.remove();
    const card = document.createElement('div');
    card.id = 'audit-card';
    card.style.cssText = 'position:fixed;left:12px;top:12px;z-index:2147483000';
    card.innerHTML = await window.__calls.handlers.display(text);
    document.body.appendChild(card);
    await window.__calls.handlers.display(text);
  }, raw);
  await page.locator('#audit-card [data-goei-shop]').click();
  await page.locator('.sh-wrap:visible').waitFor();
  await page.locator('#audit-card').evaluate(el => { el.hidden = true; });
}
async function nextRequest(page, id) {
  return page.evaluate(async (key) => {
    window.__chat.message.push({ role: 'user', data: '계속한다.', chatId: key });
    const messages = window.__chat.message.map(m => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    return window.__calls.replacers[0](messages, 'model');
  }, id);
}

const paths = process.argv.slice(3);
const failures = [];
const browser = await launch();
try {
  for (const viewport of ['pc', 'phone']) {
    for (const path of (paths.length ? paths : ['immediate', 'reenter', 'partial', 'unbought'])) {
      const dir = resolve(output, viewport + '-' + path);
      mkdirSync(dir, { recursive: true });
      const save = (name, value) => writeFileSync(resolve(dir, name + '.json'), JSON.stringify(value, null, 2));
      const { page } = await boot(browser, fixture, chat, viewport, { store: { 'p:goei:data-items': distPack('goei-data-items') } });
      page.setDefaultTimeout(12000);
      await openWin(page);
      if (await page.locator('.gw:visible').count()) await closeEditor(page, true);
      await settle(page);
      await closeWin(page);
      await page.evaluate((answer) => { window.__llm = [answer]; }, shelf);
      await openCard(page, reply);
      const names = path === 'partial' ? ['연필'] : path === 'unbought' ? [] : ['연필', '지우개'];
      for (const name of names) {
        await page.locator('[data-action="shop-detail"]:visible').filter({ hasText: name }).first().click();
        await page.locator('[data-action="shop-buy"]:visible').click();
      }
      if (names.length < 2) {
        await page.locator('[data-action="shop-detail"]:visible').filter({ hasText: '지우개' }).waitFor();
        save('새로고침전', await page.evaluate(() => window.__chat.scriptstate));
        const repeated = refresh.replace('공책|400|사용|notebook|공책|', '지우개|200|사용|eraser|지우개|\n공책|400|사용|notebook|공책|');
        const count = await page.evaluate(() => window.__calls.llm.length);
        await page.evaluate(answer => { window.__llm = [answer]; }, repeated);
        await page.locator('[data-action="shop-refresh"]:visible').first().click();
        await page.locator('[data-action="shop-detail"]:visible').filter({ hasText: '공책' }).waitFor();
        const calls = await page.evaluate(n => window.__calls.llm.slice(n), count);
        assert.equal(calls.length, 1);
        const text = calls[0].messages.map(m => String(m.content)).join('\n');
        const avoid = text.split('\n').find(l => l.includes('Previously shown here')) || '';
        const visible = await page.locator('[data-action="shop-detail"]:visible').allTextContents();
        save('새로고침', { calls, answer: repeated, avoid, visible });
        console.log(viewport, path, JSON.stringify({ avoid, visible, includesEraser: text.includes('지우개') }));
        if (!['연필', '지우개'].every(n => avoid.includes(n))) failures.push(viewport + ' ' + path + ' 제외 목록 누락');
        await page.close();
        continue;
      }
      await page.getByText('진열대가 비었어요.', { exact: false }).first().waitFor();
      const state = await page.evaluate(() => window.__chat.scriptstate);
      save('구매후', state);
      const wallet = JSON.parse(state.$st_wallet);
      assert.deepEqual(wallet.log.map(e => e.amount), [-300, -200]);
      assert.equal(wallet.start + wallet.log.reduce((v, e) => v + e.amount, 0), 500);
      assert.deepEqual(JSON.parse(state.$st_items).list.map(e => e.name).sort(), ['연필', '지우개']);

      async function checkRefresh() {
        const before = await page.evaluate(() => window.__calls.llm.length);
        await page.evaluate(answer => { window.__llm = [answer]; }, refresh);
        await page.locator('[data-action="shop-refresh"]:visible').first().click();
        await page.locator('[data-action="shop-detail"]:visible').filter({ hasText: '공책' }).waitFor();
        const calls = await page.evaluate(n => window.__calls.llm.slice(n), before);
        save('새로고침', { calls, answer: refresh });
        assert.equal(calls.length, 1);
        const line = calls[0].messages.flatMap(m => String(m.content).split('\n')).find(l => l.includes('Previously shown here (do not repeat):'));
        assert.ok(line?.includes('연필') && line.includes('지우개'), line);
        console.log(viewport, path, line);
      }
      if (path === 'immediate') await checkRefresh();
      await page.locator('button[data-action="shop-close"]:visible').first().click();
      await page.locator('.sh-wrap:visible').waitFor({ state: 'hidden' });
      const first = await nextRequest(page, 'u2');
      save('다음본편', first);
      const purchase = first.flatMap(m => String(m.content).split('\n')).filter(line => line.includes('just bought'));
      assert.equal(purchase.length, 1, JSON.stringify(purchase));
      assert.ok(purchase[0].includes('연필') && purchase[0].includes('지우개'));
      const continued = '가게에 계속 머문다.\n' + shopTag;
      await page.evaluate(data => window.__chat.message.push({ role: 'char', data, chatId: 'c2' }), continued);
      await settle(page);
      if (path === 'reenter') {
        await openCard(page, continued);
        await checkRefresh();
      }
      const second = await nextRequest(page, 'u3');
      save('다다음본편', second);
      assert.ok(!second.some(m => String(m.content).includes('just bought')));
      const inventory = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_items).list);
      assert.deepEqual(inventory.map(e => e.name).sort(), ['연필', '지우개']);
      save('최초진열', { calls: await page.evaluate(() => window.__calls.llm.slice(0, 1)), answer: shelf });
      await page.close();
      console.log('PASS', viewport, path);
    }
  }
} finally {
  await browser.close();
}

assert.deepEqual(failures, [], '지난 목록 피하기 설정에 따른 기대 결과');
