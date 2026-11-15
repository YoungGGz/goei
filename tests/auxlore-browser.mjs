// 보조 호출 로어북 「Risu와 같게」: 설정 → 로어북 호출의 고르기 줄, 켜면 모듈 로어북이 괴담톡 확인 요청에 들어가고 끄면(기본) 안 들어간다
// 사용법: node tests/auxlore-browser.mjs <fixture.json>
import { boot, closeEditor, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const browser = await launch();
let pass = 0; const fails = [];
const ok = (cond, name, info = '') => { if (cond) pass++; else { fails.push(name); console.log('FAIL', name, info); } };
const chat = () => ({ message: [{ role: 'user', data: '달빛 등대로 간다', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1' } });
const MOD = [
  { key: '', comment: '모듈 상시 글', content: 'MODULE_ALWAYS_TEXT', alwaysActive: true, mode: 'normal' },
  { key: '달빛 등대', comment: '모듈 열쇠 글', content: 'MODULE_KEYED_TEXT', alwaysActive: false, mode: 'normal' },
  { key: '안 나오는 말', comment: '모듈 다른 글', content: 'MODULE_OTHER_TEXT', alwaysActive: false, mode: 'normal' },
];
const OUT = '/mnt/project-files/작업_1115/';
for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(browser, fx, chat(), vp);
  await page.evaluate((m) => { window.__moduleLore = m; }, MOD);
  await openWin(page); await closeEditor(page, true).catch(() => {}); await sleep(300);
  // 설정 → 로어북 호출: 「보조 호출 로어북」 줄이 있고 기본은 「플러그인 기준」
  await openEditor(page, 'set:lore'); await sleep(400);
  const row = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.gw .gw-body *')].find((x) => x.children.length === 0 && x.textContent.trim() === '보조 호출 로어북');
    const box = el?.closest('.ps-row, .adv-row, .st-row, li, section > div') ?? el?.parentElement?.parentElement;
    const on = [...(box?.querySelectorAll('button.on, button[aria-pressed="true"]') ?? [])].map((b) => b.textContent.trim());
    return { found: !!el, on, btns: [...(box?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) };
  });
  ok(row.found && row.btns.includes('플러그인 기준') && row.btns.includes('Risu와 같게') && row.on.includes('플러그인 기준'), `${vp} 설정 줄과 기본값`, JSON.stringify(row));
  await page.evaluate(() => [...document.querySelectorAll('.gw .gw-body *')].find((x) => x.children.length === 0 && x.textContent.trim() === '보조 호출 로어북')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await page.screenshot({ path: `${OUT}로어북호출_설정_${vp}.png` });
  await closeEditor(page, true); await sleep(300);
  await page.evaluate(() => (document.querySelector('.gx [data-action="tab"][data-value="phone"]') || document.querySelector('.gx [data-value="phone"]')).click()); await sleep(800);
  const request = async () => {
    const n0 = await page.evaluate(() => (window.__calls.llm ?? []).length);
    await page.evaluate(() => document.querySelector('[data-action="ph-refresh"]').click());
    await page.waitForFunction((n) => (window.__calls.llm ?? []).length > n, n0, { timeout: 15000 });
    await sleep(1200);
    return page.evaluate((n) => JSON.stringify(window.__calls.llm.slice(n)), n0);
  };
  const base = await request();
  ok(!base.includes('MODULE_ALWAYS_TEXT') && !base.includes('MODULE_KEYED_TEXT'), `${vp} 기본값: 모듈 로어북은 요청에 없다`);
  // 「Risu와 같게」로 바꾼다 (채팅 변수) → 다시 읽은 뒤의 요청에는 항상 활성화 글과 키가 걸린 글이 들어간다
  await openEditor(page, 'set:lore'); await sleep(400);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.gw .gw-body *')].find((x) => x.children.length === 0 && x.textContent.trim() === '보조 호출 로어북');
    const box = el?.closest('.ps-row, .adv-row, .st-row, li, section > div') ?? el?.parentElement?.parentElement;
    [...(box?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === 'Risu와 같게')?.click();
  });
  await sleep(900);
  ok((await page.evaluate(() => window.__chat.scriptstate.$gen_aux_lore)) === 'risu', `${vp} 설정에서 고르면 이 채팅에 저장된다`);
  await page.screenshot({ path: `${OUT}로어북호출_설정_${vp}.png` });
  await closeEditor(page, true); await sleep(500);
  const on = await request();
  ok(on.includes('MODULE_ALWAYS_TEXT'), `${vp} Risu와 같게: 항상 활성화 모듈 글이 들어간다`);
  ok(on.includes('MODULE_KEYED_TEXT'), `${vp} Risu와 같게: 활성화 키가 대화에 나온 모듈 글이 들어간다`);
  ok(!on.includes('MODULE_OTHER_TEXT'), `${vp} Risu와 같게: 키가 안 나온 모듈 글은 없다`);
  ok(errors.length === 0, `${vp} 콘솔 오류 없음`, errors.slice(0, 2).join(' | '));
  await page.close();
}
console.log(`auxlore-browser: ${pass} pass, ${fails.length} fail`);
await browser.close();
process.exit(fails.length ? 1 : 0);
