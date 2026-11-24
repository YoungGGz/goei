// K/다 공용: 실제 리스AI(T2) 브라우저 띄우기·상태 넣기·설정 창 열기·캡처·기록.
import { openT2 } from '../../틀/risu-t2.mjs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = HERE + '/out';
export const STATES = fileURLToPath(new URL('../../틀/states/', import.meta.url));
export const FAKE = process.env.FAKE_URL_K || 'http://192.0.2.2:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

/** 크기별 브라우저 + setup + 상태 하나. 크기 이름: pc 1280×800, phone 344×882(터치), land 882×344(터치), fold 752×749(터치·배율1.8) */
export const SIZES = {
  pc: { w: 1280, h: 800, touch: false, dsf: 1 },
  phone: { w: 344, h: 882, touch: true, dsf: 1 },
  land: { w: 882, h: 344, touch: true, dsf: 1 },
  fold: { w: 752, h: 749, touch: true, dsf: 1.8 },
};

export async function makeCtx(a = {}) {
  const sz = SIZES[a.size || 'pc'] ?? SIZES.pc;
  const w = a.w ?? sz.w, h = a.h ?? sz.h, touch = a.touch ?? sz.touch, dsf = a.dsf ?? sz.dsf;
  mkdirSync(OUT, { recursive: true });
  const t = await openT2({ width: w, height: h, touch, dsf, out: OUT, fake: FAKE, streaming: !!a.streaming });
  await t.setup();
  let ls = null;
  if (a.state !== null) ls = await t.loadState(STATES + (a.state || 'S-관리국-3턴') + '.json');
  if (a.reloadAfter) await t.reload({ settle: true });
  const C = {
    t, info: { w, h, touch, dsf, ls },
    close: () => t.close(),
    shot: async (name) => { const p = `${OUT}/${name}.png`; await t.page.screenshot({ path: p }); return p; },
    /** 플러그인 창 열기 (이미 열렸으면 그대로) */
    open: async () => {
      const isOpen = () => t.page.evaluate(() => [...document.querySelectorAll('iframe')].some((x) => getComputedStyle(x).display !== 'none' && x.offsetWidth > innerWidth * 0.5 && x.offsetHeight > innerHeight * 0.5));
      if (await isOpen() && t.F()) return 'already';
      await t.openWindow('.gx');
      await sleep(800);
      return 'opened';
    },
    /** 설정 창 열기: 창 → 설정 단추(실제 클릭) */
    openSet: async () => {
      await C.open();
      const F = t.F();
      const ok = await F.evaluate(() => {
        const bs = [...document.querySelectorAll('[data-action="ed-open"]')];
        const b = bs.find((x) => x.offsetParent !== null) ?? bs[0];
        if (!b) return false; b.click(); return true;
      });
      await F.waitForSelector('.gw:not([hidden])', { timeout: 10000 });
      await sleep(500);
      return ok;
    },
    /** 설정 창 안에서 페이지로 (트리 단추 click 과 같은 처리기) */
    node: async (id) => {
      const F = t.F();
      const ok = await F.evaluate((id) => { const b = document.querySelector(`.gw [data-action="ed-node"][data-value="${id}"]`); if (b) { b.click(); return true; } return false; }, id);
      if (!ok) await F.evaluate((id) => { const d = document.createElement('button'); d.dataset.action = 'ed-node'; d.dataset.value = id; d.hidden = true; document.querySelector('.gw')?.appendChild(d); d.click(); d.remove(); }, id);
      await sleep(500);
      return ok;
    },
    /** 창(.gx) 안에서 data-action 단추 누르기: 보이는 단추가 있으면 실제 클릭, 없으면 같은 처리기로 */
    act: async (action, value, real = true) => {
      const F = t.F();
      const sel = `[data-action="${action}"]${value !== undefined ? `[data-value="${value}"]` : ''}`;
      const loc = F.locator(sel).filter({ visible: true }).first();
      if (real && (await loc.count())) { await loc.click({ timeout: 8000 }); await sleep(600); return 'click'; }
      await F.evaluate(([a, v]) => { const root = document.querySelector('.gw:not([hidden])') ?? document.querySelector('.gx'); const d = document.createElement('button'); d.dataset.action = a; if (v !== undefined) d.dataset.value = v; d.style.display = 'none'; root.appendChild(d); d.click(); d.remove(); }, [action, value]);
      await sleep(600); return 'dispatch';
    },
    curNode: () => t.F().evaluate(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value ?? document.querySelector('.gw [data-page]')?.dataset.page ?? null),
    closeSet: async () => { await t.F().evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-close"]')].find((x) => x.offsetParent !== null)?.click()); await sleep(400); },
    /** 기기 저장소 값 (리스아이 pluginStorage) */
    store: (key) => t.R(async (k) => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const v = await cs.pluginStorage.getItem(k); try { return JSON.parse(v); } catch { return v; } }, key),
    storeKeys: () => t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return (await cs.pluginStorage.keys?.()) ?? null; }),
    vars: async (re) => { const s = (await t.chatState(true)).scriptstate ?? {}; return re ? Object.fromEntries(Object.entries(s).filter(([k]) => re.test(k))) : s; },
    /** 설정 창 안의 줄 하나: 제목으로 찾아 조작 HTML·값 */
    row: (label) => t.F().evaluate((label) => {
      const r = [...document.querySelectorAll('.gw .ps-row')].find((x) => (x.querySelector('.ps-label b')?.firstChild?.textContent ?? '').trim() === label);
      if (!r) return null;
      return { on: [...r.querySelectorAll('.gx-seg.on')].map((b) => b.textContent.trim()), vals: [...r.querySelectorAll('input')].map((i) => i.value), help: r.querySelector('.ps-label small')?.textContent.trim() ?? '', badge: r.querySelector('.gx-scope')?.textContent.trim() ?? '', note: r.querySelector('.st-frame-note')?.textContent.trim() ?? '' };
    }, label),
    /** 줄 안의 세그 단추 실제 클릭 */
    seg: async (label, text) => {
      const F = t.F();
      const loc = F.locator('.gw .ps-row', { has: F.locator('.ps-label b', { hasText: label }) }).locator('.gx-seg', { hasText: text }).first();
      await loc.scrollIntoViewIfNeeded(); await loc.click({ timeout: 8000 }); await sleep(500);
    },
    /** 수 칸 직접 입력 (사람처럼: 지우고 쳐서 Enter → Tab) */
    typeNum: async (label, val, i = 0) => {
      const F = t.F();
      const loc = F.locator('.gw .ps-row', { has: F.locator('.ps-label b', { hasText: label }) }).locator('input.adv-val').nth(i);
      await loc.scrollIntoViewIfNeeded(); await loc.click(); await loc.fill(''); await loc.type(String(val)); await loc.press('Enter'); await loc.press('Tab').catch(() => {}); await sleep(600);
    },
    stepBtn: async (label, dir, i = 0) => {
      const F = t.F();
      const loc = F.locator('.gw .ps-row', { has: F.locator('.ps-label b', { hasText: label }) }).locator(`button.gx-step[aria-label$="${dir === "+" ? "늘리기" : "줄이기"}"]`).nth(i);
      await loc.scrollIntoViewIfNeeded(); const dis = await loc.isDisabled(); if (!dis) await loc.click(); await sleep(500); return !dis;
    },
  };
  return C;
}

/** 단계 기록: out/steps.jsonl 에 한 줄씩 */
export function rec(name, o) {
  const line = { t: new Date().toISOString(), name, ...o };
  appendFileSync(OUT + '/steps.jsonl', JSON.stringify(line) + '\n');
  return line;
}
export const save = (name, data) => { const p = `${OUT}/${name}`; writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 1)); return p; };
