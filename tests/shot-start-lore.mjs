// 설정 세계 › 시작 화면 › 소속 칸의 「첫 장면」 자리 사진. 사용법: node tests/shot-start-lore.mjs <out-dir> [소속 코드]
import { mkdirSync } from 'node:fs';
import { boot, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/start-lore-shots';
const code = process.argv[3] ?? 'E00';
mkdirSync(out, { recursive: true });
const b = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko' } };
const { page, errors } = await boot(b, fx, started, { width: 1600, height: 1000 });
await openWin(page);
await page.waitForSelector('.gx-tabhead');
await openEditor(page, 'start');
await sleep(400);
const acts = await page.evaluate(() => [...document.querySelectorAll('.st-slots [data-action]')].map((e) => `${e.dataset.action}=${e.dataset.value}`));
console.log(acts.join('\n'));
await page.evaluate((c) => [...document.querySelectorAll('.st-slots [data-action]')].find((e) => e.dataset.value === c && !/show|move|drag/.test(e.dataset.action))?.click(), code);
await sleep(500);
await page.evaluate(() => document.querySelector('.st-sel')?.scrollIntoView({ block: 'start' }));
await sleep(200);
await page.screenshot({ path: `${out}/start_${code}.png` });
console.log('errors', errors);
await b.close();
