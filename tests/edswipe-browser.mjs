// 설정 창의 폰 쓸기 (11-15 사용자: 상황판과 같은 뜻으로): 오른쪽 = 뒤로(열린 목록 닫기 → 앞서 본 페이지 → 더 없으면 설정 닫기), 왼쪽 = 앞으로
// 설정 창 전용 서랍(기능·세계·지침·점검·닫기): 하단 바를 위로 쓸면 올라오고, 갈래를 누르면 왼쪽 목록이 그 갈래가 눌린 채로 열린다
// 사용법: node tests/edswipe-browser.mjs <fixture.json>
import { boot, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const browser = await launch();
let pass = 0; const fails = [];
const ok = (cond, name, info = '') => { if (cond) pass++; else { fails.push(name); console.log('FAIL', name, info); } };
const chat = { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1' } };
const { page, errors } = await boot(browser, fx, chat, 'phone');
await openWin(page);
await openEditor(page, 'set:screen');
await goNode(page, 'set:phone');
await goNode(page, 'set:wiki');
const node = () => page.evaluate(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value ?? '');
const open = () => page.evaluate(() => document.querySelector('.gw')?.hidden === false);
const swipe = async (dx, sel = '.gw-body') => {
  await page.evaluate(([dx, sel]) => {
    const el = document.querySelector(`.gw ${sel}`); const r = el.getBoundingClientRect();
    const x0 = dx > 0 ? r.left + 40 : r.right - 40, y = r.top + r.height / 2;
    const fire = (type, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y }); el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
    fire('touchstart', x0); fire('touchmove', x0 + dx / 3); fire('touchmove', x0 + dx); fire('touchend', x0 + dx);
  }, [dx, sel]);
  await sleep(500);
};
await swipe(160);
ok((await node()) === 'set:phone', '오른쪽으로 쓸면 앞서 본 페이지로', await node());
await swipe(160);
ok((await node()) === 'set:screen', '한 번 더 쓸면 그 앞 페이지로', await node());
await swipe(-160);
ok((await node()) === 'set:phone', '왼쪽으로 쓸면 앞으로', await node());
await swipe(-160); await swipe(-160);
ok((await node()) === 'set:wiki' && (await open()), '앞으로 갈 곳이 없으면 그대로', await node());
// 목록이 열려 있으면 뒤로 = 목록 닫기 (페이지는 그대로)
await page.evaluate(() => document.querySelector('.gw [data-action="ed-drawer"]').click()); await sleep(300);
await swipe(160);
ok(!(await page.evaluate(() => document.querySelector('.gw-win').classList.contains('drawer'))) && (await node()) === 'set:wiki', '목록이 열려 있으면 목록만 닫힌다');
// 짧게 쓸면 아무 일 없다
await swipe(40);
ok((await node()) === 'set:wiki', '짧은 쓸기는 무시');
await swipe(160); await swipe(160);
ok((await node()) === 'set:screen' && (await open()), '맨 앞 페이지까지');
// 목록이 떠 있을 때 바깥(본문)을 누르면 목록만 닫히고, 눌린 자리의 단추는 안 눌린다
await page.evaluate(() => document.querySelector('.gw [data-action="ed-drawer"]').click()); await sleep(300);
const before = await page.evaluate(() => document.querySelector('.gw-body').innerHTML.length);
await page.mouse.click(330, 300); await sleep(400);
ok(!(await page.evaluate(() => document.querySelector('.gw-win').classList.contains('drawer'))) && (await node()) === 'set:screen', '목록 바깥을 누르면 목록이 닫힌다');
ok((await page.evaluate(() => document.querySelector('.gw-body').innerHTML.length)) === before, '바깥을 누른 자리의 설정은 안 바뀐다');
for (let i = 0; i < 4 && (await open()); i++) await swipe(160);
ok(!(await open()), '더 뒤로 갈 곳이 없으면 설정이 닫힌다');
// 설정 창 전용 서랍: 닫혀 있다가 하단 바를 위로 쓸면 올라온다. 단추 다섯(갈래 넷 + 닫기)이 가로로 고르게
await openEditor(page, 'set:screen');
const cdrOpen = () => page.evaluate(() => document.querySelector('.gw .gw-cdr').classList.contains('open'));
ok(!(await cdrOpen()), '서랍은 처음에 닫혀 있다');
const nb = await page.locator('.gw .gw-nav').boundingBox();
const drag = async (x, y, dy) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy / 2, { steps: 3 }); await page.mouse.move(x, y + dy, { steps: 3 }); await page.mouse.up(); await sleep(500); };
await drag(60, nb.y + 30, -50);
ok(await cdrOpen(), '하단 바를 위로 쓸면 서랍이 올라온다');
const tools = await page.evaluate(() => [...document.querySelectorAll('.gw .gw-cdr .ph-tool')].map((b) => { const r = b.getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), t: b.textContent.trim(), b: Math.round(r.bottom) }; }));
const navTop = Math.round(nb.y);
ok(tools.length === 5 && tools.map((x) => x.t).join() === '기능,세계,지침,점검,닫기', '단추 다섯: 기능·세계·지침·점검·닫기', JSON.stringify(tools));
ok(new Set(tools.map((x) => x.w)).size <= 2 && tools[0].l <= 12 && 390 - (tools[4].l + tools[4].w) <= 12 && tools.every((x) => x.b <= navTop), '다섯 개가 가로로 고르게, 하단 바 위에', JSON.stringify([tools, navTop]));
await page.screenshot({ path: '/mnt/project-files/작업_1115/설정서랍_폰_열림.png' });
await drag(60, nb.y + 20, 40);
ok(!(await cdrOpen()), '아래로 쓸면 내려간다');
await page.screenshot({ path: '/mnt/project-files/작업_1115/설정서랍_폰_닫힘.png' });
await drag(60, nb.y + 30, -50);
const drawer = () => page.evaluate(() => ({ open: document.querySelector('.gw-win').classList.contains('drawer'), tab: document.querySelector('.gw-tree .gw-tab.on')?.dataset.value ?? '' }));
await page.evaluate(() => document.querySelector('.gw .gw-cdr [data-action="ed-tab"][data-value="guide"]').click()); await sleep(500);
ok(JSON.stringify(await drawer()) === JSON.stringify({ open: true, tab: 'guide' }), '아래 「지침」: 목록이 지침 갈래로 열린다', JSON.stringify(await drawer()));
await page.evaluate(() => document.querySelector('.gw .gw-tree [data-action="ed-tab"][data-value="set"]').click()); await sleep(500);
ok(JSON.stringify(await drawer()) === JSON.stringify({ open: true, tab: 'set' }), '목록 안에서 갈래를 바꿔도 목록은 열린 채', JSON.stringify(await drawer()));
await page.evaluate(() => document.querySelector('.gw .gw-cdr [data-action="ed-tab"][data-value="set"]').click()); await sleep(400);
ok((await drawer()).open && (await node()) === 'set:screen', '지금 갈래를 눌러도 목록이 열리고 페이지는 그대로', await node());
ok(!(await cdrOpen()), '갈래를 누르면 서랍은 내려간다');
await page.screenshot({ path: '/mnt/project-files/작업_1115/설정서랍_폰_목록.png' });
await page.mouse.click(330, 300); await sleep(300);
await drag(60, nb.y + 30, -50);
await page.evaluate(() => document.querySelector('.gw .gw-cdr [data-action="ed-close"]').click()); await sleep(500);
ok(!(await open()), '서랍의 닫기: 설정이 닫힌다');
ok(errors.length === 0, '콘솔 오류 없음', errors.slice(0, 2).join(' | '));
console.log(`edswipe-browser: ${pass} pass, ${fails.length} fail`);
await browser.close();
process.exit(fails.length ? 1 : 0);
