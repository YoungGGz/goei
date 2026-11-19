// 아바타 동작 (2026-11-19 사용자): 소지품의 내 아바타가 대기를 돌다가 고른 동작 하나를 한 번 하고 대기로 돌아오는지.
// 동작 중에도 대기 칸이 있던 자리(발밑)가 그대로인지, 동작 그림을 저장소에서 읽는 길과 받아 오는 길 둘 다 본다.
// 사용법: node tests/lookacts-browser.mjs [out-dir]
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/lookacts-shots';
mkdirSync(out, { recursive: true });
const ID = process.env.LOOK ?? '6.54';
const dist = new URL('../dist/', import.meta.url);
const partNames = readdirSync(dist).filter((f) => f.startsWith(`goei-look-${ID}.`)).sort((a, b) => Number(a.split('.').at(-2)) - Number(b.split('.').at(-2)));
const parts = Object.fromEntries(partNames.map((f) => [f, readFileSync(new URL(f, dist), 'utf8')]));
const actsText = partNames.map((f) => parts[f]).join('');
const base = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
const chat = {
  message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동 손길 의원 회복실|목표]', chatId: 'c1' }],
  scriptstate: { $st_look: ID, $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_items: JSON.stringify({ list: [], log: [] }) },
};
const b = await launch();
const fails = [];
const bad = (m) => { fails.push(m); console.log('  ✗', m); };

const state = (page) => page.evaluate(() => {
  const e = document.querySelector('.gx-look.it-look');
  if (!e) return null;
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  const m = (k) => parseFloat(cs[k]) || 0;
  // 바깥 여백까지 친 상자 = 대기 칸이 있던 자리여야 한다
  return { act: e.classList.contains('act'), tag: e.dataset.look ?? '', box: [Math.round(r.left - m('marginLeft')), Math.round(r.top - m('marginTop')), Math.round(r.width + m('marginLeft') + m('marginRight')), Math.round(r.height + m('marginTop') + m('marginBottom'))], size: [Math.round(r.width), Math.round(r.height)], over: document.documentElement.scrollWidth > innerWidth };
});

async function run(name, vp, store, serve) {
  console.log(`[${name}]`);
  const { page, errors } = await boot(b, fx, chat, vp, { store });
  if (serve) await page.evaluate((files) => { Object.assign(window.__files, files); }, parts);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.evaluate(() => document.querySelector('[data-action="tab"][data-value="items"], [data-action="nav-tab"][data-value="items"]')?.click());
  await sleep(900);
  const idle = await state(page);
  if (!idle) { bad(`${name}: 아바타가 없음`); return; }
  if (idle.tag !== ID) bad(`${name}: 동작 표시(data-look)가 없음`);
  await page.screenshot({ path: `${out}/${name}_1_대기.png` });
  const t0 = Date.now();
  let act = null;
  while (Date.now() - t0 < 32_000) {
    const s = await state(page);
    if (s?.act) { act = s; break; }
    await sleep(60);
  }
  if (!act) { bad(`${name}: 동작이 안 나옴`); return; }
  console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}초 뒤 동작, 장 ${act.size.join('×')} (대기 ${idle.size.join('×')})`);
  if (act.box.join() !== idle.box.join()) bad(`${name}: 동작 중 자리가 바뀜 ${idle.box} → ${act.box}`);
  if (act.over) bad(`${name}: 동작 중 가로 넘침`);
  await sleep(350);
  await page.screenshot({ path: `${out}/${name}_2_동작.png` });
  let back = null;
  const t1 = Date.now();
  while (Date.now() - t1 < 15_000) {
    const s = await state(page);
    if (s && !s.act) { back = s; break; }
    await sleep(60);
  }
  if (!back) bad(`${name}: 대기로 안 돌아옴`);
  else if (back.box.join() !== idle.box.join() || back.size.join() !== idle.size.join()) bad(`${name}: 돌아온 뒤 자리·크기가 다름 ${idle.box} → ${back.box}`);
  if (serve && !(await page.evaluate((id) => String(window.__store['p:goei:look-acts'] ?? '').startsWith(id + '\n'), ID))) bad(`${name}: 받은 동작을 저장소에 두지 않음`);
  if (errors.length) bad(`${name}: 콘솔 오류 ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

// 한 창씩: 뒤에 깔린 창은 브라우저가 움직임을 멈춰 동작이 안 나온다
const stored = { ...base, 'p:goei:look-acts': `${ID}\n${actsText}` };
await run('pc_저장소', { width: 1280, height: 800, touch: false }, stored, false);
await run('폰_저장소', { width: 412, height: 915, touch: true }, stored, false);
await run('pc_받기', { width: 1280, height: 800, touch: false }, base, true);
await b.close();
console.log(fails.length ? `실패 ${fails.length}` : '통과');
process.exit(fails.length ? 1 : 0);
