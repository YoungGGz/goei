// 에셋용 사본: 점검 → 저장·불러오기의 「요원 로어북 사본」 줄. 넣으면 카드 로어북에 전용 폴더가 생기고,
// 본편 요청은 넣기 전과 글자 하나 다르지 않다. 다른 설정을 저장해도 사본은 남고, 빼면 카드가 넣기 전으로 돌아간다
// 사용법: node tests/assetcopy-browser.mjs <fixture.json>
import { boot, closeEditor, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const browser = await launch();
let pass = 0; const fails = [];
const ok = (cond, name, info = '') => { if (cond) pass++; else { fails.push(name); console.log('FAIL', name, info); } };
const chat = () => ({ message: [{ role: 'user', data: '에일린을 만난다', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1' } });
const OUT = '/mnt/project-files/작업_1115/';
const KEY = 'folder:goei-asset-0000-0000-0000-copy00000001';
for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(browser, fx, chat(), vp);
  await openWin(page); await closeEditor(page, true).catch(() => {}); await sleep(300);
  const main = () => page.evaluate(async () => JSON.stringify(await window.__calls.replacers[0]([{ role: 'system', content: 'S' }, { role: 'user', content: '에일린을 만난다' }, { role: 'assistant', content: '본문' }, { role: 'user', content: '에일린에게 말을 건다' }], 'model')));
  const card = () => page.evaluate((k) => { const l = window.__char.globalLore || []; return { all: l.length, folder: l.filter((e) => e.mode === 'folder' && e.key === k).map((e) => e.comment), kids: l.filter((e) => e.folder === k), json: JSON.stringify(l.filter((e) => e.key !== k && e.folder !== k)) }; }, KEY);
  const rowOf = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('.gw .gw-body b')].find((x) => x.textContent.trim() === '요원 로어북 사본');
    const box = el?.closest('.ps-row');
    box?.scrollIntoView({ block: 'center' });
    return { found: !!el, state: box?.querySelector('.gw-tokens')?.textContent.trim(), btns: [...(box?.querySelectorAll('button') ?? [])].map((b) => `${b.textContent.trim()}${b.disabled ? '(꺼짐)' : ''}`), help: box?.querySelector('small')?.textContent ?? '' };
  });
  const press = (label) => page.evaluate((t) => { const el = [...document.querySelectorAll('.gw .gw-body b')].find((x) => x.textContent.trim() === '요원 로어북 사본'); [...el.closest('.ps-row').querySelectorAll('button')].find((b) => b.textContent.trim() === t).click(); }, label);
  const before = await main();
  const card0 = await card();
  await openEditor(page, 'manage:backup'); await sleep(500);
  let row = await rowOf();
  ok(row.found && row.state === '없음' && row.btns.join() === '넣기,빼기(꺼짐)', `${vp} 처음: 없음, 넣기만 눌림`, JSON.stringify(row));
  ok(row.help.includes('에셋 메이드') && row.help.includes('토큰도 늘지 않아요'), `${vp} 설명`);
  await sleep(200); await page.screenshot({ path: `${OUT}에셋용사본_없음_${vp}.png` });
  await press('넣기'); await sleep(900);
  const card1 = await card();
  row = await rowOf();
  ok(card1.folder.join() === '🖼️에셋용 사본' && card1.kids.length > 0, `${vp} 넣기: 카드에 폴더와 요원 사본`, `${card1.folder} ${card1.kids.length}`);
  ok(card1.kids.every((e) => String(e.content).startsWith('@@dont_activate\n') && e.key && !e.alwaysActive && !e.goeiVirtual), `${vp} 사본: Risu 가 넣지 않는 첫 줄·열쇠 있음`);
  ok(card1.json === card0.json, `${vp} 넣기: 다른 로어북은 그대로`);
  ok(row.state === `${card1.kids.length}명` && row.btns.join() === '다시 넣기(꺼짐),빼기', `${vp} 넣은 뒤 줄`, JSON.stringify(row));
  await sleep(200); await page.screenshot({ path: `${OUT}에셋용사본_넣음_${vp}.png` });
  await closeEditor(page, true); await sleep(400);
  ok((await main()) === before, `${vp} 본편 요청이 넣기 전과 같다`);
  // 다른 설정이 카드 로어북을 저장해도 사본은 남는다: 세계 편집(명부 저장)을 한 번 일으킨다
  const n0 = await page.evaluate(() => window.__calls.setChar);
  await openEditor(page, 'manage:backup'); await sleep(400);
  await page.evaluate(() => { const t = document.querySelector('[data-input="man-import-text"]'); t.value = JSON.stringify({ directory: JSON.parse((window.__char.globalLore.find((e) => e.comment === 'Directory')).content) }); t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(300);
  await page.evaluate(() => document.querySelector('[data-action="man-import"]').click()); await sleep(300);
  await page.evaluate(() => document.querySelector('[data-action="man-import-yes"]').click()); await sleep(900);
  const card2 = await card();
  ok((await page.evaluate(() => window.__calls.setChar)) > n0 && card2.kids.length === card1.kids.length && JSON.stringify(card2.kids) === JSON.stringify(card1.kids), `${vp} 카드 로어북을 저장해도 사본이 남는다`, `${card2.kids.length}`);
  await press('빼기'); await sleep(900);
  const card3 = await card();
  row = await rowOf();
  ok(card3.folder.length === 0 && card3.kids.length === 0 && card3.all === card0.all, `${vp} 빼기: 폴더와 사본만 사라진다`, JSON.stringify([card3.all, card0.all]));
  ok(row.state === '없음', `${vp} 뺀 뒤 줄`, JSON.stringify(row));
  await closeEditor(page, true); await sleep(300);
  ok((await main()) === before, `${vp} 뺀 뒤 본편 요청도 같다`);
  ok(errors.length === 0, `${vp} 콘솔 오류 없음`, errors.slice(0, 2).join(' | '));
  await page.close();
}
console.log(`assetcopy-browser: ${pass} pass, ${fails.length} fail`);
await browser.close();
process.exit(fails.length ? 1 : 0);
