// 공용: 띄우기·기록·대조
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, openEditor, goNode, closeEditor, closeWin, setInput, sleep, prefsOf, chatOf } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
export const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
export { boot, launch, openWin, openEditor, goNode, closeEditor, closeWin, setInput, sleep, prefsOf, chatOf };

export const STATUS = '[▣|2025.03.14|11:20 PM|🌙|6°C|관리국 본부|없음|없음|없음|관리국/신입|1000]';
/** 시작한 채팅 (본편 두 턴) */
export const startedChat = () => ({
  message: [
    { role: 'user', data: '사무실에 들어간다.', chatId: 'u1' },
    { role: 'char', data: `형광등이 깜빡이는 관리국 사무실. 책상 위에 서류가 쌓여 있다.\n${STATUS}`, chatId: 'c1' },
  ],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_wallet: JSON.stringify({ start: 1000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) },
});
export const packs = () => ({ 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') });

export function recorder(name) {
  const results = [];
  let n = 0;
  const step = (title) => { n += 1; return { n: String(n).padStart(2, '0'), name: title }; };
  const check = (s, what, ok, expect, actual, why = '') => {
    results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
    console.log(`${ok ? 'PASS' : 'FAIL'} [${name} ${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)?.slice(0, 600)}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
  };
  const save = () => writeFileSync(`${OUT}결과_${name}.json`, JSON.stringify({ pass: results.filter((r) => r.ok).length, total: results.length, results }, null, 2));
  return { results, step, check, save, file: (s, body) => writeFileSync(`${OUT}${name}_단계${s.n}_${s.name}.txt`, body), state: (s, obj) => writeFileSync(`${OUT}${name}_상태${s.n}.json`, JSON.stringify(obj, null, 2)) };
}

export const ss = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat.scriptstate ?? {})));
export const prefs = (page) => page.evaluate(() => JSON.parse(window.__store['p:goei:prefs'] || '{}'));
export async function settle(page) {
  await sleep(160);
  await page.waitForFunction(() => !document.querySelector('.gw .gw-setbody .gx-spin'), null, { timeout: 3000 }).catch(() => {});
  await sleep(60);
}
/** 본체를 띄우고(응답 처리기 등록) 편집 창을 연다 */
export async function openStarted(page, node) {
  await openWin(page);
  await page.waitForSelector('.gx-tabhead', { timeout: 15000 }).catch(() => {});
  await openEditor(page, node);
}
/** 점검 → 저장·불러오기의 기본값 단추 + 확인 팝업 */
export async function barAct(page, what) {
  await goNode(page, 'manage:backup');
  await page.evaluate((w) => document.querySelector(`.gw [data-action="set-bar"][data-value="${w}"]`).click(), what);
  await page.waitForSelector(`.gw .gw-confirm [data-action="set-bar-yes"][data-value="${what}"]`, { timeout: 5000 });
  await page.evaluate((w) => document.querySelector(`.gw .gw-confirm [data-action="set-bar-yes"][data-value="${w}"]`).click(), what);
  await page.waitForFunction(() => !document.querySelector('.gw .gw-confirm'), null, { timeout: 5000 });
  await settle(page);
}
export const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
