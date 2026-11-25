// 3차 점검 H 구간(소지품·가계부) 공용 도구. run*.mjs 가 import 한다. src/ 는 건드리지 않는다.
// 가짜 모델 서버는 H 전용 8801 (FAKE_URL), 리스AI 는 5180 (RISU_URL).
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HERE = fileURLToPath(new URL('.', import.meta.url));
export const OUT = HERE + 'out';
export const STATES = fileURLToPath(new URL('../틀/states/', import.meta.url));
export const FAKE = process.env.H_FAKE_URL || 'http://192.0.2.2:8801';
export const RISU = process.env.RISU_URL || 'http://127.0.0.1:5180';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/** 단계 기록: 먼저 expect 를 적고(before), 돌린 뒤 actual 을 적는다(after) */
export function recorder(name) {
  const file = `${OUT}/${name}-steps.jsonl`;
  writeFileSync(file, '');
  const steps = [];
  return {
    steps,
    expect(id, expect, rows) {
      const s = { id, expect, rows, t: new Date().toISOString() };
      steps.push(s);
      console.log(`\n[기대 ${id}] ${expect} (${rows})`);
      return s;
    },
    actual(id, ok, actual, extra = {}) {
      const s = steps.find((x) => x.id === id) ?? { id };
      Object.assign(s, { ok, actual, ...extra });
      appendFileSync(file, JSON.stringify(s) + '\n');
      console.log(`[실제 ${id}] ${ok === true ? '맞음' : ok === false ? '어긋남' : '기록'} — ${typeof actual === 'string' ? actual : JSON.stringify(actual).slice(0, 600)}`);
    },
  };
}

const ctl = async (path, body) => {
  const r = await fetch(FAKE + '/_ctl/' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return r.json();
};
export const fake = ctl;
export const seqNow = async () => { const l = await ctl('log?full=0'); return l.length ? l.at(-1).seq : 0; };
export const logSince = (since, route = '') => ctl(`log?since=${since}${route ? '&route=' + route : ''}`);

/** 보조 요청 종류 */
export const auxKind = (body) => {
  const all = (body?.messages ?? []).map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  if (/# Router — scene people selection/.test(all)) return 'router';
  if (/# Scene Director/.test(all)) return 'director';
  if (/You update the per-chat record of named characters/.test(all)) return 'updater';
  return 'other';
};
/** 갱신기 요청의 자료 JSON (messages[1]) */
export const updaterData = (body) => { try { return JSON.parse(body.messages[1].content); } catch { return null; } };
/** 본편 요청의 [Inventory]/[Shop] 블록 */
export const invBlock = (body) => (body?.messages ?? []).map((m) => (typeof m.content === 'string' ? m.content : '')).find((c) => /^\[(Inventory|Shop)\]/.test(c)) ?? null;
export const prevStatus = (body) => (body?.messages ?? []).map((m) => (typeof m.content === 'string' ? m.content : '')).filter((c) => c.startsWith('[Previous status]')).at(-1) ?? null;

/** 갱신기 대본: 다음 갱신기 요청에 줄 답(함수 (data) => 답 객체)을 차례로 건다. 없으면 {} */
export function updaterScript() {
  const queue = [];
  let stopped = false;
  const seen = [];
  const file = `${OUT}/updater-reply.json`;
  writeFileSync(file, '{}');
  const loop = (async () => {
    while (!stopped) {
      try {
        const pend = await ctl('pending');
        for (const p of pend) {
          if (!p.held || p.route !== 'aux' || p.ruleId !== 'h-aux-updater') continue;
          const [rec] = await logSince(p.seq - 1);
          if (!rec || rec.seq !== p.seq) continue;
          const data = updaterData(rec.body);
          const fn = queue.shift();
          const reply = fn ? fn(data, rec) : {};
          seen.push({ seq: p.seq, data, reply });
          writeFileSync(file, JSON.stringify(reply));
          await ctl('release', { seq: p.seq });
          await sleep(150);
        }
      } catch (e) { console.log('updater loop', String(e).slice(0, 120)); }
      await sleep(250);
    }
  })();
  return { file, push: (fn) => queue.push(fn), clear: () => (queue.length = 0), seen, pending: () => queue.length, stop: async () => { stopped = true; await loop; } };
}

/** span 에서 가장 마지막 assistant 메시지의 m 과 글 */
export const lastAsst = (data) => {
  const sp = (data?.span ?? []).filter((x) => x.role === 'assistant');
  return sp.at(-1) ?? null;
};

/** 기본 규칙: Router·Director 빈 답, 갱신기 붙잡기(대본), 그 밖 보조 {} , 본편 기본 답 */
export async function baseRules(updFile, extra = []) {
  await ctl('rules', { rules: [
    ...extra,
    { id: 'h-aux-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
    { id: 'h-aux-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
    { id: 'h-aux-updater', route: 'aux', match: 'You update the per-chat record of named characters', hold: true, replyFile: updFile },
    { id: 'h-aux', route: 'aux', reply: '{}' },
    { id: 'h-main', route: 'main', reply: '가짜 본편 답 #{{seq}}.\n[▣|2025.03.14|10:00 AM|☀️|12°C|서울 종로구 관리국 본부 사무실|없음|쟈알디|없음|관리국/선임 요원|140000]' },
  ] });
}
/** 본편 답 규칙 하나 더하기 (matchLast 로 이 턴의 내 말을 집음) */
export const mainRule = (id, matchLast, reply, more = {}) => ctl('rules/add', { rule: { id, route: 'main', matchLast, reply, ...more } });

/** 상태창 줄 (요원플레이 기준 칸 차례) */
export const st = ({ time = '10:00 AM', place = '서울 종로구 관리국 본부 사무실', comp = '쟈알디', mission = '없음', aff = '관리국/선임 요원', bal = 140000, extra = '' } = {}) => `[▣|2025.03.14|${time}|☀️|12°C|${place}|없음|${comp}|${mission}|${aff}|${bal}${extra}]`;

/** T2 열기 + setup + 상태 넣기 */
export async function boot({ state = 'S-요원플레이.json', width = 1280, height = 800, touch, streaming = false } = {}) {
  const t = await openT2({ via: 'plain', fake: FAKE, risu: RISU, width, height, touch: touch ?? width < 600, streaming, out: OUT });
  await t.setup();
  const r = state ? await t.loadState(STATES + state) : null;
  return { t, loaded: r };
}

/** 플러그인 창을 열고 소지품 탭으로 */
export async function openItems(t, sub = 'items') {
  await t.openWindow('.gx');
  await sleep(1200);
  for (let i = 0; i < 8; i++) {
    if (await t.F().evaluate(() => !!document.querySelector('.gx-items'))) break;
    if ((await act(t, 'nav-tab', 'items', { wait: 1000 })) !== 'ok') await act(t, 'tab', 'items', { wait: 1000 });
  }
  if (sub !== 'items') await act(t, 'items-sub', sub, { wait: 800 });
  return t.F();
}
/** 창 안 data-action 단추 누르기 (실제 마우스 클릭, 보이는 것) */
export async function act(t, action, value, { wait = 700, force = false } = {}) {
  const F = t.F();
  const sel = `[data-action="${action}"]${value != null ? `[data-value="${String(value).replace(/"/g, '\\"')}"]` : ''}`;
  let loc = F.locator(`button${sel}:visible`).first();
  if (!(await loc.count())) loc = F.locator(`${sel}:visible`).first();
  if (!(await loc.count())) return (await F.locator(sel).count()) ? 'hidden' : 'none';
  if (await loc.isDisabled().catch(() => false)) return 'disabled';
  try { await loc.click({ timeout: 6000, force }); } catch (e) { return 'err:' + String(e.message).slice(0, 80); }
  await sleep(wait);
  return 'ok';
}
export const fText = (t, sel = '.gx') => t.F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ').trim() ?? null, sel);
export const toastText = (t) => t.F().evaluate(() => [...document.querySelectorAll('.gx-toast, [role="status"], .gx-err')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));
/** 지금 채팅 scriptstate 의 소지품·가계부 */
export async function invState(t) {
  const s = await t.chatState(true);
  const ss = s.scriptstate ?? {};
  let items = null, wallet = null;
  try { items = ss.$st_items ? JSON.parse(ss.$st_items) : null; } catch {}
  try { wallet = ss.$st_wallet ? JSON.parse(ss.$st_wallet) : null; } catch {}
  return { s, ss, items, wallet, use: ss.$st_item_use, useAt: ss.$st_item_use_at, usePrev: ss.$st_item_use_prev };
}
export const itemNames = (items) => (items?.list ?? []).map((e) => `${e.name}${e.slot !== undefined ? `@${e.held ? 'h' : e.equip}${e.slot}` : ''}${e.uses ? `(u${e.uses})` : ''}${e.outHow ? `[out:${e.outHow}]` : ''}${e.mergedInto ? '[merged]' : ''}${e.state && e.state !== 'ok' ? `[${e.state}]` : ''}`);

/** PC 끌어다 놓기 (실제 마우스, HTML5 끌기). to 는 [data-drop] 고르개, at 은 그 칸 안 자리('center' | 'topleft') */
export async function mdrag(t, fromSel, toSel, at = 'center') {
  const F = t.F();
  const a = await F.locator(fromSel).first().boundingBox();
  const b = await F.locator(toSel).first().boundingBox();
  if (!a || !b) return 'nobox';
  const to = at === 'topleft' ? { x: b.x + 50, y: b.y + 40 } : { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await t.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await t.page.mouse.down();
  await t.page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 5 });
  await t.page.mouse.move(to.x, to.y, { steps: 10 });
  await t.page.mouse.up();
  await sleep(1200);
  return 'ok';
}
/** 창이 열린 채 소지품 탭으로 (설정 편집기를 닫은 뒤 등) */
export async function goItems(t, sub) {
  for (let i = 0; i < 8; i++) {
    if (await t.F().evaluate(() => !!document.querySelector('.gx-items'))) break;
    if ((await act(t, 'nav-tab', 'items', { wait: 1000 })) !== 'ok') await act(t, 'tab', 'items', { wait: 1000 });
  }
  if (sub) await act(t, 'items-sub', sub, { wait: 800 });
}
