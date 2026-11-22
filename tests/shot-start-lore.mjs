// 설정 세계 › 조직 › 기본 세력 기록의 「첫 장면에 함께 넣을 로어북」 자리 사진. 사용법: node tests/shot-start-lore.mjs <out-dir> [조직 이름] [pc|fold]
import { mkdirSync } from 'node:fs';
import { boot, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/start-lore-shots';
const org = process.argv[3] ?? '프리랜서';
const vp = process.argv[4] === 'fold' ? { width: 752, height: 749 } : { width: 1600, height: 1000 };
mkdirSync(out, { recursive: true });
const b = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko' } };
const { page, errors } = await boot(b, fx, started, vp);
await openWin(page);
await page.waitForSelector('.gx-tabhead');
await openEditor(page, 'org');
await sleep(400);
// 조직 줄을 연다 (줄의 이름 글자로 찾는다)
const opened = await page.evaluate((name) => {
  const rows = [...document.querySelectorAll('.gw .gw-body [data-action]')].filter((e) => e.textContent.trim().startsWith(name));
  const hit = rows[0];
  hit?.click();
  return hit ? `${hit.dataset.action}=${hit.dataset.value}` : `없음: ${[...new Set([...document.querySelectorAll('.gw .gw-body [data-action]')].map((e) => e.dataset.action))].join(',')}`;
}, org);
console.log('opened', opened);
await sleep(500);
const vals = await page.evaluate(() => [...document.querySelectorAll('.gw [data-key^="seed:"]')].map((e) => `${e.dataset.key} = ${e.value}`));
console.log(vals.join('\n'));
await page.evaluate(() => document.querySelector('.gw [data-key^="seed:"]')?.scrollIntoView({ block: 'center' }));
await sleep(200);
await page.screenshot({ path: `${out}/org_${org}_${process.argv[4] === 'fold' ? 'fold' : 'pc'}.png` });
console.log('errors', errors);
await b.close();
