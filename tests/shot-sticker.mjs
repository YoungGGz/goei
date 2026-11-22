// 망상홈쇼핑 상품 스티커 캡처 (작업용): node tests/shot-sticker.mjs <사진 폴더>
// PC(1280×900)·폰(갤럭시 폴드 접은 화면 344×882)에서 스티커 창을 「가만히」「옆으로 끌어 접음」「위로 끌어 접음」「눌러 젖힘」으로 찍는다 (2배 선명도).
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';
import { SHOW } from './homeshop-show.mjs';

const OUT = process.argv[2] || '.scratch/shot-sticker';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const VPS = [['pc', { width: 1280, height: 900, touch: false, scale: 2 }], ['phone', { width: 344, height: 882, touch: true, scale: 2 }]];
for (const [vp, size] of VPS) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $hs_net: '1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' } };
  const { page } = await boot(browser, fx, chat, size, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
  if (vp !== 'phone') { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); }
  else { await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="hs"]'); }
  await page.waitForSelector('.hs-l3', { timeout: 15000 });
  const shot = async (tag) => { const el = page.locator('.hs-pop').first(); await el.screenshot({ path: `${OUT}/${vp}_${tag}.png` }); };
  const open = async () => { await click('.hs-pop header [data-action="hs-pop"]'); await page.waitForTimeout(150); await click('[data-action="hs-pop"][data-value="peek"]'); await page.waitForTimeout(400); };
  // 모서리 단추 한가운데를 잡아 끈다 (스티커가 기울어 있어 바깥 네모의 귀퉁이는 스티커 밖일 수 있다)
  const drag = async (corner, dx, dy) => {
    const b = await page.locator(`.hs-sticker .corner.c-${corner}`).boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx / 3, y + dy / 3, { steps: 4 }); await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up(); await page.waitForTimeout(700);
  };
  await open(); await shot('1_가만히');
  const w = (await page.locator('.hs-sticker').boundingBox()).width;
  await drag('tl', w * 0.45, 4); await shot('2_옆으로_끌어_접음');
  await open(); await drag('br', -6, -150); await shot('3_위로_끌어_접음');
  await open(); await drag('tr', -w * 0.3, 70); await shot('4_비스듬히_끌어_접음');
  await open(); await click('.hs-sticker .corner'); await page.waitForTimeout(900); await shot('5_눌러_젖힘');
  console.log(vp, await page.evaluate(() => { const st = document.querySelector('.hs-sticker'); return JSON.stringify({ lim: st.dataset.lim, corner: st.dataset.corner, w: st.offsetWidth, h: st.offsetHeight, font: st.querySelector('.emb')?.style.fontSize }); }));
  await page.close();
}
await browser.close();
