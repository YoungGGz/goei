// 파트 b: 모든 수 칸(− 값 +). 사용자 11-19 「한 번에 1씩, 상한 1만 이상만 100씩, 모든 칸 직접 입력」 · 범위 밖 입력은 끝값
import { fx, boot, launch, goNode, sleep, recorder, ss, prefs, settle, openStarted, startedChat, packs } from './lib.mjs';

const NODES = ['manage:flow', 'set:lore', 'set:adv', 'set:screen', 'set:image', 'set:status', 'set:board', 'set:net', 'set:phone', 'set:wiki', 'set:items', 'set:shop', 'set:cos', 'set:bm', 'set:hs', 'set:journal', 'set:people', 'set:factions'];
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
const stepOf = (hi) => (hi >= 10000 ? 100 : 1);

async function boxes(page) {
  return page.evaluate(() => {
    const body = document.querySelector('.gw .gw-setbody') || document.querySelector('.gw .gw-page');
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return [...(body?.querySelectorAll('input.adv-val[data-change]') ?? [])].filter((el) => vis(el) && !el.disabled).map((el) => ({
      action: el.dataset.change, key: el.dataset.key ?? '', min: el.min, max: el.max, step: el.step, value: el.value, ph: el.placeholder,
      row: el.closest('.ps-row, .ck-line, .ck-row, .st-col-row')?.querySelector('.ps-label > b, b, span')?.textContent?.trim().slice(0, 30) ?? '', aria: el.getAttribute('aria-label') ?? '',
    }));
  });
}
const sel = (b) => `.gw input.adv-val[data-change="${b.action}"]${b.key ? `[data-key="${b.key}"]` : ':not([data-key])'}`;
async function read(page, b) {
  return page.evaluate((s) => { const el = [...document.querySelectorAll(s)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0; }); return el ? { v: el.value, ph: el.placeholder, plus: el.parentElement.querySelectorAll('button.gx-step')[1]?.disabled ?? null, minus: el.parentElement.querySelectorAll('button.gx-step')[0]?.disabled ?? null } : null; }, sel(b));
}
async function type(page, b, text) {
  return page.evaluate(([s, t]) => { const el = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0); if (!el) return false; el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [sel(b), text]);
}
async function plus(page, b) {
  return page.evaluate((s) => { const el = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0); const btn = el?.parentElement.querySelectorAll('button.gx-step')[1]; if (!btn || btn.disabled) return false; btn.click(); return true; }, sel(b));
}
const num = (r) => (r ? (r.v === '' ? (r.ph ? 0 : NaN) : Number(String(r.v).replace(/[,\s]/g, ''))) : NaN);

export default async function (part) {
  const R = recorder(part);
  const browser = await launch();
  const { page, errors } = await boot(browser, fx, startedChat(), 'pc', { store: packs() });
  await openStarted(page, 'set:screen');
  await settle(page);
  const bad = { step: [], hi: [], lo: [], stored: [] };
  for (const node of NODES) {
    const s = R.step(`수칸_${node.replace(':', '_')}`);
    await goNode(page, node); await settle(page);
    const list = await boxes(page);
    const seen = new Set();
    const lines = [];
    for (const b of list) {
      const id = `${b.action}|${b.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const lo = Number(b.min); const hi = Number(b.max);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || b.max === '') { lines.push(`범위 없음  ${b.row}/${b.aria} ${id} min=${b.min} max=${b.max}`); continue; }
      const name = `${b.row}/${b.aria} (${id}, ${lo}~${hi})`;
      // 1) + 한 번
      const r0 = await read(page, b);
      const v0 = num(r0);
      if (await plus(page, b)) {
        await settle(page);
        const v1 = num(await read(page, b));
        const want = Math.min(hi, (Number.isFinite(v0) ? v0 : lo) + stepOf(hi));
        if (v1 !== want) { bad.step.push(`${node} ${name}: ${v0} → + → ${v1} (기대 ${want}, 폭 ${stepOf(hi)})`); lines.push(`+폭 틀림 ${name}: ${v0}→${v1} 기대 ${want}`); }
      }
      // 2) 최대보다 큰 수
      const a0 = await ss(page); const p0 = await prefs(page);
      await type(page, b, String(hi + 1000)); await settle(page);
      const rh = await read(page, b);
      const a1 = await ss(page); const p1 = await prefs(page);
      const dh = [...diff(a0, a1).map((k) => `${k}=${String(a1[k]).slice(0, 60)}`), ...diff(p0, p1).map((k) => `기기.${k}=${JSON.stringify(p1[k]).slice(0, 80)}`)];
      if (num(rh) !== hi) { bad.hi.push(`${node} ${name}: ${hi + 1000} 입력 → 칸 「${rh?.v}」 (기대 ${hi}) 저장[${dh.join(', ')}]`); lines.push(`최대 넘김 틀림 ${name}: 칸 ${rh?.v} 저장 ${dh.join(', ')}`); }
      else lines.push(`최대 OK ${name}: 저장 ${dh.join(', ') || '(변화 없음: 이미 최대)'}`);
      // 3) 최소보다 작은 수
      const tooLow = lo > 0 ? Math.max(0, lo - 1) === lo - 1 && lo - 1 >= 0 ? lo - 1 : -1 : -5;
      const c0 = await ss(page); const q0 = await prefs(page);
      await type(page, b, String(tooLow)); await settle(page);
      const rl = await read(page, b);
      const c1 = await ss(page); const q1 = await prefs(page);
      const dl = [...diff(c0, c1).map((k) => `${k}=${String(c1[k]).slice(0, 60)}`), ...diff(q0, q1).map((k) => `기기.${k}=${JSON.stringify(q1[k]).slice(0, 80)}`)];
      if (num(rl) !== lo) { bad.lo.push(`${node} ${name}: ${tooLow} 입력 → 칸 「${rl?.v}」${rl?.ph ? `(빈칸 글 ${rl.ph})` : ''} (기대 ${lo}) 저장[${dl.join(', ')}]`); lines.push(`최소 밑 틀림 ${name}: 칸 ${rl?.v} 저장 ${dl.join(', ')}`); }
      else lines.push(`최소 OK ${name}: 저장 ${dl.join(', ') || '(변화 없음)'}`);
      // 저장값이 칸과 같은지: 바뀐 변수가 수 하나면 그 수
      for (const [d, want] of [[dh, hi], [dl, lo]]) for (const x of d) { const m = /=(-?\d+)$/.exec(x); if (m && Number(m[1]) !== want && !x.startsWith('기기.')) bad.stored.push(`${node} ${name}: 칸 ${want} 인데 저장 ${x}`); }
      // 원래 값으로 돌려 둔다
      if (Number.isFinite(v0)) { await type(page, b, String(v0)); await settle(page); }
    }
    R.file(s, `${node} 수 칸 ${seen.size}개\n\n${lines.join('\n')}\n`);
  }
  const s = R.step('수칸_모음');
  R.file(s, `+ 한 번의 폭이 틀린 칸\n${bad.step.join('\n')}\n\n최대보다 큰 수가 최대로 안 맞춰진 칸\n${bad.hi.join('\n')}\n\n최소보다 작은 수가 최소로 안 맞춰진 칸\n${bad.lo.join('\n')}\n\n칸과 저장값이 다른 칸\n${bad.stored.join('\n')}\n`);
  R.check(s, '+ 한 번 = 1 (상한 1만 이상 100) (사용자 11-19, core/stepval.ts)', !bad.step.length, [], bad.step);
  R.check(s, '최대보다 큰 수 → 최대', !bad.hi.length, [], bad.hi);
  R.check(s, '최소보다 작은 수 → 최소', !bad.lo.length, [], bad.lo);
  R.check(s, '칸에 보이는 값 = 저장값', !bad.stored.length, [], bad.stored);
  R.check(R.step('오류'), '페이지 오류 없음', errors.length === 0, [], errors.slice(0, 10));
  R.save();
  await browser.close();
}
