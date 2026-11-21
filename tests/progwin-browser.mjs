// 호출 진행 창 모양 확인 (작업용): node tests/progwin-browser.mjs <사진 폴더>
// Risu 의 setInnerHTML 은 class·style 속성을 지운다 (시험 흉내도 그렇게 한다) → 그래도 칸·줄 모양이 살아 있어야 한다
import { mkdirSync } from 'node:fs';
import assert from './soft-assert.mjs';
import { boot, closeWin, launch, loadFixture, openWin } from './qc-settings-harness.mjs';

const OUT = process.argv[2] || '.scratch/progwin';
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const st = (d, t) => `답.\n[▣|${d}|${t}|☀️|4°C|관리국|QC 괴이]`;
const browser = await launch();
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  for (const theme of ['dark', 'paper']) {
    const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: st('2025.01.01', '02:47 AM'), chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: theme } };
    const { page, errors } = await boot(browser, fx, chat, size);
    await page.waitForTimeout(800);
    // 요청 처리(본편 응답 대기) → 진행 창이 뜬다
    await page.evaluate(async () => { const c = window.__chat; await window.__calls.replacers[0](c.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data })), 'model'); });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const h = document.querySelector('[x-goei-prog]');
      if (!h) return null;
      const cs = (sel) => { const e = h.querySelector(sel); return e ? getComputedStyle(e) : null; };
      return { show: h.getAttribute('x-goei-show'), open: h.getAttribute('x-goei-open'), cells: cs('[data-p="cells"]')?.display, cell: h.querySelector('[data-p="c"]')?.offsetHeight, row: cs('[data-p="r"]')?.display, title: cs('[data-p="t"]')?.fontWeight, cls: h.querySelectorAll('[data-card] [class]').length, n: h.querySelectorAll('[data-p="c"]').length, tops: [...h.querySelectorAll('[data-p="c"]')].map((e) => Math.round(e.getBoundingClientRect().top)) };
    });
    console.log(vp, theme, JSON.stringify(info));
    assert.ok(info, '진행 창이 있다');
    if (info.open !== 'true') await page.evaluate(() => document.querySelector('[x-goei-prog] [data-dot]').click()), await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${vp}-${theme}.png` });
    assert.equal(info.cells, 'grid'); assert.equal(info.row, 'grid'); assert.equal(info.title, '600'); assert.equal(info.cell, 18);
    if (info.n > 1) assert.equal(new Set(info.tops).size, 1, '단계 칸은 한 줄에 나란히');
    if (vp === 'pc') {
      // 접힌 단추도 끌어서 옮긴다: 머리줄을 눌러 접고 → 단추를 끌면 자리가 바뀌고 펼쳐지지 않는다
      const g = await page.locator('[x-goei-prog] [data-grip]').boundingBox();
      await page.mouse.click(g.x + 40, g.y + 6);
      await page.waitForFunction(() => document.querySelector('[x-goei-prog]').getAttribute('x-goei-open') === 'false');
      await page.waitForTimeout(400);
      const d = await page.locator('[x-goei-prog] [data-dot]').boundingBox();
      await page.mouse.move(d.x + 20, d.y + 20); await page.mouse.down(); await page.mouse.move(d.x - 180, d.y + 220, { steps: 8 }); await page.waitForTimeout(300); await page.mouse.up();
      await page.waitForTimeout(500);
      const d2 = await page.locator('[x-goei-prog] [data-dot]').boundingBox();
      assert.ok(Math.abs(d2.x - (d.x - 200)) < 12 && Math.abs(d2.y - (d.y + 200)) < 12, `단추가 옮겨짐 ${JSON.stringify([d, d2])}`);
      assert.equal(await page.evaluate(() => document.querySelector('[x-goei-prog]').getAttribute('x-goei-open')), 'false', '끌고 놓아도 펼쳐지지 않음');
      await page.screenshot({ path: `${OUT}/${vp}-${theme}-moved.png` });
    }
    if (vp === 'phone') {
      const host = () => page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); return { open: h.getAttribute('x-goei-open'), shown: getComputedStyle(h).display !== 'none' }; });
      // 펼친 창은 도는 중이어도 바깥을 누르면 접힌다
      if ((await host()).open !== 'true') { const b0 = await page.locator('[x-goei-prog] [data-dot]').boundingBox(); await page.mouse.click(b0.x + 14, b0.y + 20); await page.waitForFunction(() => document.querySelector('[x-goei-prog]').getAttribute('x-goei-open') === 'true'); await page.waitForTimeout(300); }
      await page.mouse.click(60, 760);
      await page.waitForFunction(() => document.querySelector('[x-goei-prog]').getAttribute('x-goei-open') === 'false');
      await page.waitForTimeout(400);
      // 막대는 위아래로만 끌린다 (오른쪽에 붙은 채), 놓아도 펼쳐지지 않고 자리를 기억한다
      const d = await page.locator('[x-goei-prog] [data-dot]').boundingBox();
      await page.mouse.move(d.x + 14, d.y + 20); await page.mouse.down(); await page.mouse.move(d.x - 120, d.y + 320, { steps: 8 }); await page.waitForTimeout(300); await page.mouse.up();
      await page.waitForTimeout(500);
      const d2 = await page.locator('[x-goei-prog] [data-dot]').boundingBox();
      assert.ok(Math.abs(d2.x - d.x) < 1 && Math.abs(d2.y - (d.y + 300)) < 12, `막대가 위아래로만 옮겨짐 ${JSON.stringify([d, d2])}`);
      assert.equal((await host()).open, 'false', '끌고 놓아도 펼쳐지지 않음');
      await page.screenshot({ path: `${OUT}/${vp}-${theme}-moved.png` });
      // 아래쪽에서 펼치면 카드가 화면 안에 있다
      await page.mouse.click(d2.x + 14, d2.y + 20);
      await page.waitForTimeout(500);
      const c = await page.locator('[x-goei-prog] [data-card]').boundingBox();
      assert.ok(c.y >= 0 && c.y + c.height <= 844, `카드가 화면 안 ${JSON.stringify(c)}`);
      await page.screenshot({ path: `${OUT}/${vp}-${theme}-moved-open.png` });
      await page.mouse.click(60, 60);
      await page.waitForFunction(() => document.querySelector('[x-goei-prog]').getAttribute('x-goei-open') === 'false');
      // 상황판을 열면 숨고, 닫으면 같은 자리에 다시 나온다
      await openWin(page);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[x-goei-prog]')).display === 'none', null, { timeout: 5000 });
      await page.screenshot({ path: `${OUT}/${vp}-${theme}-panel.png` });
      await closeWin(page);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[x-goei-prog]')).display !== 'none', null, { timeout: 5000 });
      const d3 = await page.locator('[x-goei-prog] [data-dot]').boundingBox();
      assert.ok(Math.abs(d3.y - d2.y) < 2, `상황판을 닫은 뒤 자리 그대로 ${JSON.stringify([d2, d3])}`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
}
await browser.close();
console.log('progwin ok');
