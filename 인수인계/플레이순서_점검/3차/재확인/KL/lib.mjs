// 재확인 KL 공용 (K/가/lib.mjs 사본, OUT 만 scratchpad 로 바꿈)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openT2 } from '../../틀/risu-t2.mjs';

export const HERE = fileURLToPath(new URL('.', import.meta.url));
export const OUT = '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-KL/out/';
export const STATES = fileURLToPath(new URL('../../틀/states/', import.meta.url));
mkdirSync(OUT, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const STATUS = '[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
export const MAIN_REPLY = `로비의 형광등 아래에서 잼트리가 서류를 넘긴다. (K가 본편 #{{seq}})\n\n${STATUS}`;
export const BASE_RULES = [
  { id: 'k-aux-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
  { id: 'k-aux-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
  { id: 'k-aux', route: 'aux', reply: '{}' },
  { id: 'k-main', route: 'main', reply: MAIN_REPLY },
];

/** 나이 줄 값 지우기 (공통 규칙: 요청 전문을 남길 때 나이 줄 값은 [생략]) */
export const scrub = (s) => String(s).replace(/((?:^|\n)[^\n]*(?:나이|Age|age)\s*[:：=|]\s*)[^\n|,]+/g, '$1[생략]').replace(/\d{1,2}\s*(세|살)(?![가-힣])/g, '[생략]').replace(/\b\d{1,2}[- ]years?[- ]old\b/gi, '[생략]').replace(/\baged? \d{1,2}\b/gi, 'age [생략]');
const textOf = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p?.text ?? '').join('') : JSON.stringify(c ?? ''));
export const flat = (rec) => (rec?.body?.messages ?? []).map((m) => `${m.role}: ${textOf(m.content)}`).join('\n');
export const fmtReq = (rec) => `# seq ${rec.seq} route ${rec.route} stream ${rec.stream} model ${rec.model} rule ${rec.ruleId}\n` + (rec.body?.messages ?? []).map((m, i) => `──── [${i}] ${m.role} ────\n${textOf(m.content)}`).join('\n\n') + `\n\n════ 가짜 답 (${rec.response?.status}) ════\n${rec.response?.content ?? ''}`;

export async function session(name, { w = 1280, h = 800, touch, dsf } = {}) {
  const t = await openT2({ via: 'plain', width: w, height: h, touch: touch ?? w < 600, dsf: dsf ?? 1, out: OUT.replace(/\/$/, ''), fake: process.env.FAKE_URL || 'http://192.0.2.2:8801' });
  const rec = { name, at: new Date().toISOString(), steps: [], notes: [] };
  const save = () => writeFileSync(`${OUT}결과_${name}.json`, JSON.stringify({ ...rec, pass: rec.steps.filter((s) => s.ok).length, total: rec.steps.length }, null, 1));
  let n = 0;
  /** 단계: 먼저 기대값·결정표 줄을 적고, check 로 대조 */
  const step = (title, expect, row) => {
    n += 1;
    const s = { n: `${name}-${String(n).padStart(2, '0')}`, title, expect, row, ok: null, actual: null, evidence: [] };
    rec.steps.push(s);
    console.log(`\n[${s.n}] ${title}\n   기대: ${expect}  (${row})`);
    return {
      s,
      check(ok, actual, ...evidence) { s.ok = !!ok; s.actual = actual; s.evidence.push(...evidence); console.log(`   ${ok ? 'OK' : 'NG'}  ${JSON.stringify(actual).slice(0, 700)}`); save(); return ok; },
      file(suffix, body) { const p = `${OUT}${s.n}_${suffix}`; writeFileSync(p, scrub(body)); s.evidence.push(`out/${s.n}_${suffix}`); return p; },
      req(suffix, r) { if (!r) return null; return this.file(`${suffix}.txt`, fmtReq(r)); },
      shot: async (suffix) => { const nm = `${s.n}_${suffix}`; await t.shot(nm); s.evidence.push(`out/${nm}.png`); return nm; },
    };
  };
  const note = (what, v) => { rec.notes.push({ what, v }); console.log('   NOTE', what, JSON.stringify(v).slice(0, 400)); save(); };

  // ── 가짜 서버 ──
  const fakeReset = async (extra = []) => { await t.fake('reset', {}); await t.fake('rules', { rules: [...extra, ...BASE_RULES] }); };
  const addRules = (rules) => t.fake('rules/add', { rules });
  const delRule = (id) => t.fake('rules/del', { id });
  const seq = () => t.fakeSeq();
  const log = async (since = 0, route = '') => { const l = await t.fakeLog(since, route); return Array.isArray(l) ? l : l.records ?? []; };

  // ── 플러그인 창·설정 창 ──
  let F = null;
  const frame = async () => (F = await t.frame('.gx, .gw'));
  const fe = async (fn, arg) => { if (!F) await frame(); try { return await F.evaluate(fn, arg); } catch (e) { if (/detached|destroyed|context/i.test(String(e))) { await frame(); return F.evaluate(fn, arg); } throw e; } };
  const has = (sel) => fe((s) => !!document.querySelector(s), sel);
  /** 보이는 설정 창 (닫은 창도 DOM 에 남아 있어 보이는지로 가린다) */
  const edShown = () => fe(() => { const g = document.querySelector('.gw'); if (!g) return false; const r = g.getBoundingClientRect(); return r.width > 10 && r.height > 10 && getComputedStyle(g).display !== 'none' && getComputedStyle(g).visibility !== 'hidden'; });
  const click = async (sel, wait = 500) => { const ok = await fe((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel); if (!ok) throw new Error('누를 것 없음: ' + sel); await sleep(wait); return ok; };
  const tryClick = async (sel, wait = 500) => { const ok = await fe((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel); if (ok) await sleep(wait); return ok; };
  /** 입력 칸 값 넣기 + input/change */
  const setVal = async (sel, value, ev = 'change', wait = 500) => {
    const ok = await fe(([s, v, ev]) => { const e = document.querySelector(s); if (!e) return false; e.focus(); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); if (ev === 'change') e.dispatchEvent(new Event('change', { bubbles: true })); if (ev === 'enter') { e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } return true; }, [sel, value, ev]);
    if (!ok) throw new Error('입력 칸 없음: ' + sel);
    await sleep(wait);
  };
  const winOpen = async () => {
    const vis = await t.R(() => { const c = document.querySelector('[x-goei-container], iframe'); return !!c && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 10; }).catch(() => false);
    if (!vis) { await t.openWindow('.gx, .gw'); await sleep(800); }
    await frame();
  };
  /** 설정 창 노드 열기 (ed-tab → ed-node). 창이 없으면 유령 단추 → 설정 */
  const ed = async (node) => {
    await winOpen();
    if (!(await edShown())) {
      if (!(await tryClick('.gx [data-action="ed-open"]', 900))) await click('[data-action="prefs-open"]', 900);
    }
    if (!(await edShown())) throw new Error('설정 창이 안 열림');
    const tab = node.startsWith('guide:') || node.startsWith('rule:') ? 'guide' : node === 'install' || (node.startsWith('manage:') && node !== 'manage:flow') ? 'manage' : node.startsWith('set:') || node === 'manage:flow' ? 'set' : 'world';
    await click(`.gw [data-action="ed-tab"][data-value="${tab}"]`, 500);
    await click(`.gw [data-action="ed-node"][data-value="${node}"]`, 800);
  };
  const edClose = async () => { if (await edShown()) { await tryClick('.gw [data-action="ed-close"]', 700); await tryClick('.gw-confirm [data-action="ed-close-yes"]', 500); } };
  const winClose = async () => { await edClose(); await t.closeWindow(); F = null; await sleep(300); };

  // ── 저장 상태 ──
  const prefs = () => t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const v = await cs.pluginStorage.getItem('goei:prefs'); try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } });
  const ss = async () => (await t.chatState(true)).scriptstate ?? {};

  /** 본편 한 턴: 보내고 끝날 때까지, 그 사이 가짜 서버 기록 */
  const turn = async (text, { wait = true, settle = 2500 } = {}) => {
    const s0 = await seq();
    await winClose().catch(() => {});
    await t.send(text, { wait });
    if (wait) await sleep(settle);
    const l = await log(s0);
    return { since: s0, all: l, main: l.filter((r) => r.route === 'main'), aux: l.filter((r) => r.route === 'aux') };
  };
  const loadState = async (file) => { await winClose().catch(() => {}); const r = await t.loadState(STATES + file); F = null; return r; };

  return { t, rec, step, note, save, edShown, fakeReset, addRules, delRule, seq, log, frame, fe, has, click, tryClick, setVal, winOpen, ed, edClose, winClose, prefs, ss, turn, loadState, close: async () => { save(); await t.close(); } };
}
