// 호출 기록 › 메인 요청 조립: 줄마다 어느 단계가 넣었는지 이름표 (사용자 2026-11-15).
// 실제 본편 요청을 한 번 보내고 호출 기록을 연다. 플러그인이 넣은 줄은 단계 이름, Risu 줄을 고쳤으면 「○○ 고침」, 그대로인 줄은 이름표 없음.
// PC 는 역할 바로 뒤, 폰은 미리보기 위 한 줄
// 사용법: node tests/trace-tags-browser.mjs <fixture.json>
import { boot, clickSel, closeEditor, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const browser = await launch();
let pass = 0; const fails = [];
const ok = (cond, name, info = '') => { if (cond) pass++; else { fails.push(name); console.log('FAIL', name, info); } };
const chat = () => ({ message: [{ role: 'user', data: '에일린을 만난다', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1' } });
const OUT = '/mnt/project-files/작업_1115/';
for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(browser, fx, chat(), vp);
  await openWin(page); await closeEditor(page, true).catch(() => {}); await sleep(300);
  const sent = await page.evaluate(async () => window.__calls.replacers[0]([{ role: 'system', content: 'Risu 프리셋 글' }, { role: 'user', content: '에일린을 만난다' }, { role: 'assistant', content: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]' }, { role: 'user', content: '에일린에게 말을 건다' }], 'model'));
  await openEditor(page, 'manage:trace'); await sleep(500);
  await clickSel(page, '.gw [data-action="man-trace-toggle"][data-value$=":main"]'); await sleep(400);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.gw .gw-flow-msg summary')].map((s) => ({ role: s.querySelector('small')?.textContent ?? '', tag: s.querySelector('.gw-flow-tag')?.textContent ?? '', top: !!s.querySelector('.gw-flow-tag.top'), first: s.firstElementChild?.className ?? '', br: s.firstElementChild?.nextElementSibling?.tagName === 'BR', text: s.textContent.slice(0, 60) })));
  ok(rows.length === sent.length, `${vp} 줄 수 = 보낸 메시지 수`, `${rows.length} ${sent.length}`);
  // 프리셋·첫 사용자 글은 Risu 가 보낸 그대로 → 이름표 없음
  ok(rows[0]?.role === '[system]' && rows[0]?.tag === '', `${vp} Risu 프리셋 줄은 이름표 없음`, JSON.stringify(rows[0]));
  ok(rows.some((r) => r.tag && !r.tag.includes('고침')), `${vp} 플러그인이 넣은 줄에 단계 이름`, JSON.stringify(rows.map((r) => r.tag)));
  ok(rows.every((r) => !r.tag || /^[가-힣 ·]+$/.test(r.tag)), `${vp} 이름표는 단계 이름만`, JSON.stringify(rows.map((r) => r.tag)));
  const tagged = rows.filter((r) => r.tag);
  ok(tagged.length > 0 && tagged.every((r) => (vp === 'phone' ? r.top && r.first.includes('gw-flow-tag') && r.br : !r.top && r.first === '')), `${vp} 이름표 자리 (PC 역할 뒤, 폰 위 한 줄)`, JSON.stringify(tagged.slice(0, 3)));
  const colors = await page.evaluate(() => { const s = document.querySelector('.gw .gw-flow-msg summary small'); const t = document.querySelector('.gw .gw-flow-tag'); return [getComputedStyle(s).color, t ? getComputedStyle(t).color : '']; });
  ok(colors[1] && colors[0] !== colors[1], `${vp} 이름표 색이 역할 글과 다름`, colors.join(' / '));
  console.log(vp, rows.map((r) => `${r.role} ${r.tag}`).join(' | '));
  await page.evaluate(() => document.querySelector('.gw [data-action="man-trace-toggle"][data-value$=":main"]')?.closest('.gw-flow-node')?.scrollIntoView({ block: 'start' }));
  await sleep(200); await page.screenshot({ path: `${OUT}호출기록_이름표_${vp}.png` });
  ok(!errors.length, `${vp} 오류 없음`, errors.join(' | '));
  await page.close();
}
await browser.close();
console.log(`${pass} pass, ${fails.length} fail`);
if (fails.length) process.exit(1);
