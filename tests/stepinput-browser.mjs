// 설정의 −/+ 수 칸 전부 (2026-11-19 사용자): 칸마다 직접 적는 칸이 있고, + 는 1(상한 1만 이상은 100)만큼, 직접 적은 수는 그대로 들어가는지.
// 설정 창의 모든 페이지를 돌며 눌러 본다. 사용법: node tests/stepinput-browser.mjs [out-dir]   (VP=pc|phone)
import { mkdirSync } from 'node:fs';
import { boot, launch, loadFixture, openWin, openEditor, sleep, tabOfNode } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/stepinput-shots';
mkdirSync(out, { recursive: true });
const phone = process.env.VP === 'phone';
const vp = phone ? { width: 412, height: 915, touch: true } : { width: 1280, height: 800, touch: false };
const chat = {
  message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동 손길 의원 회복실|목표]', chatId: 'c1' }],
  scriptstate: { $st_look: '6.54', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1' },
};
const b = await launch();
const { page, errors } = await boot(b, fx, chat, vp, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });
await openWin(page); await sleep(300);
if (!(await page.evaluate(() => document.querySelector('.gw')?.hidden === false))) await openEditor(page, 'set:items');
const fails = [];
const bad = (m) => { fails.push(m); console.log('  ✗', m); };

// 페이지 목록: 탭마다 왼쪽 목록의 노드 전부
const nodes = [];
for (const t of ['set', 'guide', 'manage', 'world']) {
  await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), t);
  await sleep(250);
  for (const n of await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((e) => e.dataset.value))) if (!nodes.includes(n) && tabOfNode(n) === t && t !== 'guide') nodes.push(n);
}
const boxes = () => page.evaluate(() => [...document.querySelectorAll('.gw .gw-main .st-step, .gw .st-step')].filter((e) => e.getClientRects().length).map((box) => {
  const inp = box.querySelector('input.adv-val');
  const plus = [...box.querySelectorAll('button.gx-step')].pop();
  const row = box.closest('[data-key], .st-row, .set-row, tr, .ck-row')?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 30) ?? '';
  return { has: !!inp, id: inp ? `${inp.dataset.change}|${inp.dataset.key ?? ''}` : '', n: inp ? inp.value.replace(/[,\s]/g, '') : '', min: Number(inp?.min), max: Number(inp?.max), step: Number(inp?.step), plusOff: !!plus?.disabled, off: !!inp?.disabled, row, text: box.textContent.trim().slice(0, 20) };
}));
const byId = async (id) => (await boxes()).find((x) => x.id === id);
let total = 0, tried = 0;
for (const node of nodes) {
  await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tabOfNode(node));
  await sleep(150);
  if (!(await page.evaluate((n) => { const e = document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`); e?.click(); return !!e; }, node))) continue;
  await sleep(350);
  const list = await boxes();
  if (!list.length) continue;
  total += list.length;
  const seen = new Set();
  for (const x of list) {
    if (!x.has) { bad(`${node}: 직접 적는 칸이 없는 −/+ 칸 「${x.row}」 ${x.text}`); continue; }
    const want = x.max >= 10000 ? 100 : 1;
    if (x.step !== want) bad(`${node}: ${x.id} 한 번에 ${x.step} (기대 ${want})`);
    if (x.off || seen.has(x.id)) continue;
    seen.add(x.id);
    tried++;
    // 앞 칸을 누르며 같이 밀린 값일 수 있으니 지금 값을 다시 읽는다 (최소를 올리면 최대도 같이 오른다)
    const now = await byId(x.id);
    if (!now || now.off) continue;
    const n0 = now.n === '' ? 0 : Number(now.n);
    // + 한 번
    if (!now.plusOff) {
      await page.evaluate((id) => { const inp = [...document.querySelectorAll('.gw input.adv-val')].find((i) => `${i.dataset.change}|${i.dataset.key ?? ''}` === id && i.getClientRects().length); [...inp.closest('.st-step').querySelectorAll('button.gx-step')].pop().click(); }, x.id);
      await sleep(260);
      const a = await byId(x.id);
      const n1 = a ? (a.n === '' ? 0 : Number(a.n)) : NaN;
      if (a && n1 !== n0 + want && n1 !== n0) bad(`${node}: ${x.id} + 눌러 ${n0} → ${n1} (기대 ${n0 + want})`);
    }
    // 직접 적기: 범위 안에서 지금 값과 다른 수
    const cur = await byId(x.id);
    if (!cur || cur.off) continue;
    const c = cur.n === '' ? 0 : Number(cur.n);
    const hi = Number.isFinite(cur.max) && cur.max > 0 ? cur.max : c + 50;
    const lo = Number.isFinite(cur.min) ? cur.min : 0;
    let t = Math.min(hi, c + 3); if (t === c) t = Math.max(lo, c - 3);
    if (t === c) continue;
    await page.evaluate(([id, t]) => { const inp = [...document.querySelectorAll('.gw input.adv-val')].find((i) => `${i.dataset.change}|${i.dataset.key ?? ''}` === id && i.getClientRects().length); inp.value = String(t); inp.dispatchEvent(new Event('change', { bubbles: true })); }, [x.id, t]);
    await sleep(260);
    const d = await byId(x.id);
    const n2 = d ? (d.n === '' ? 0 : Number(d.n)) : NaN;
    if (d && n2 !== t) console.log(`  · ${node}: ${x.id} 직접 ${t} → ${n2} (다른 값에 묶인 칸일 수 있음)`), (x.loose = true);
    if (d && n2 === c) bad(`${node}: ${x.id} 직접 적은 ${t} 이 안 들어감 (${c} 그대로)`);
    // 되돌림
    await page.evaluate(([id, t]) => { const inp = [...document.querySelectorAll('.gw input.adv-val')].find((i) => `${i.dataset.change}|${i.dataset.key ?? ''}` === id && i.getClientRects().length); if (inp) { inp.value = String(t); inp.dispatchEvent(new Event('change', { bubbles: true })); } }, [x.id, n0]);
    await sleep(200);
  }
  const over = await page.evaluate(() => { const m = document.querySelector('.gw .gw-main') ?? document.querySelector('.gw'); return [...m.querySelectorAll('.st-step')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || r.right <= innerWidth + 1) return false; for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return false; } return true; }).length; });
  if (over) bad(`${node}: 화면 밖으로 나간 수 칸 ${over}개`);
  if (['set:items', 'set:journal', 'set:shop', 'set:world', 'manage:flow', 'set:homeshop'].includes(node)) await page.screenshot({ path: `${out}/${phone ? '폰' : 'pc'}_${node.replace(':', '_')}.png` });
  console.log(`${node}: 수 칸 ${list.length}`);
}
if (errors.length) bad(`콘솔 오류 ${errors.slice(0, 3).join(' / ')}`);
await b.close();
console.log(`페이지 ${nodes.length} · 수 칸 ${total} · 눌러 본 칸 ${tried} · ${fails.length ? `실패 ${fails.length}` : '통과'}`);
process.exit(fails.length ? 1 : 0);
