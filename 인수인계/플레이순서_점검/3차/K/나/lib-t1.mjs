// 3차 K4 (세계 탭 편집기) T1 공용 도우미. 틀: tests/qc-host.mjs (가짜 리스 + 저장 실패 스위치), fixture /tmp/t1fx (release 카드).
// 상태: 3차/틀/states/S-관리국-3턴.json 의 채팅을 그대로 window.__chat 에 넣는다.
import { boot, launch, startChat } from '../../../../../tests/qc-host.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HERE = fileURLToPath(new URL('./', import.meta.url));
export const OUT = `${HERE}out/`;
mkdirSync(OUT, { recursive: true });
export const FX = JSON.parse(readFileSync('/tmp/t1fx/fixture.json', 'utf8'));
export const STATE = (n) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../틀/states/${n}.json`, import.meta.url)), 'utf8'));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const results = [];
export function check(id, what, expect, ref, ok, actual, evidence = '') {
  results.push({ id, what, expect, ref, ok: ok === null ? 'info' : !!ok, actual, evidence });
  const tag = ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL';
  console.log(`${tag} [${id}] ${what}${ok ? '' : `\n   기대: ${expect}\n   실제: ${JSON.stringify(actual)?.slice(0, 700)}`}`);
}
export function dump(name, data) {
  writeFileSync(`${OUT}${name}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return `out/${name}`;
}
const AGE = /^(\s*[-*]?\s*(?:Age|나이)\s*[:：]).*$/gim;
export const scrubAge = (t) => String(t).replace(AGE, '$1 [생략]');
export const fmt = (msgs) => scrubAge(msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${m.content}`).join('\n\n'));

export async function session(b, { chat, prefs = null, vp = { width: 1280, height: 800 }, touch = false } = {}) {
  const { page, errors, logs } = await boot(b, FX, chat ?? { message: [], scriptstate: {} }, { fixtureDir: '/tmp/t1fx', viewport: vp, touch, prefs });
  const S = { page, errors, logs };
  S.char = () => page.evaluate(() => window.__clone(window.__char));
  S.dir = () => page.evaluate(() => { try { return JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content); } catch (e) { return { err: String(e) }; } });
  S.chat = () => page.evaluate(() => window.__clone(window.__chat));
  S.setChar = () => page.evaluate(() => window.__counts.setChar);
  S.charWrites = () => page.evaluate(() => window.__calls.setChar || 0);
  S.act = async (action, value, { scope = '.gw', wait = 350, nth = 0 } = {}) => {
    const ok = await page.evaluate(({ action, value, scope, nth }) => {
      const all = [...document.querySelectorAll(`${scope} [data-action="${action}"]`)].filter((e) => value === undefined || e.dataset.value === value);
      const r = all[nth];
      if (r) { r.click(); return true; }
      return false;
    }, { action, value, scope, nth });
    await sleep(wait);
    return ok;
  };
  S.type = async (sel, value, { ev = 'input', wait = 150 } = {}) => {
    const ok = await page.evaluate(([s, v, e]) => { const el = document.querySelector(s); if (!el) return false; el.value = v; el.dispatchEvent(new Event(e, { bubbles: true })); return true; }, [sel, value, ev]);
    await sleep(wait);
    return ok;
  };
  S.take = async (name, value, action) => { await S.type(`.gw [name="${name}"]`, value, { ev: 'input' }); return S.act(action); };
  S.val = (sel) => page.evaluate((s) => document.querySelector(s)?.value ?? null, sel);
  S.text = (sel = '.gw') => page.evaluate((s) => document.querySelector(s)?.innerText ?? '', sel);
  S.has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  /** 자동 저장(700ms)이 카드에 닿을 때까지 */
  S.waitSave = async (before, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if ((await S.setChar()) > before) { await sleep(400); return true; }
      await sleep(100);
    }
    return false;
  };
  S.openWin = async () => { await page.evaluate(() => window.__button.cb()); await sleep(700); };
  S.closeWin = async () => { await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()); await sleep(300); };
  S.openEd = async (node) => {
    await S.openWin();
    const picker = await page.$('.gx [data-action="prefs-open"]');
    await page.evaluate((p) => document.querySelector(p ? '.gx [data-action="prefs-open"]' : '.gx [data-action="ed-open"]')?.click(), !!picker);
    await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
    await sleep(300);
    if (node) await S.node(node);
  };
  S.node = async (n) => {
    const tab = ['agent', 'org', 'anomaly', 'site', 'appendix', 'base', 'relations', 'start'].includes(n) ? 'world' : n.startsWith('guide:') ? 'guide' : 'set';
    await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tab);
    await sleep(200);
    await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`)?.click(), n);
    await sleep(400);
  };
  S.closeEd = async () => {
    await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click());
    await sleep(300);
    const c = await page.$('.gw [data-action="ed-close-force"]');
    if (c) { await page.evaluate(() => document.querySelector('.gw [data-action="ed-close-force"]').click()); await sleep(300); }
  };
  /** 지금 채팅 기록으로 본편 요청 하나를 조립 (user 글을 더하고). 돌려준 메시지 [{role, content}] */
  S.request = async (userText, { push = true } = {}) => {
    if (push && userText) await page.evaluate((t) => { window.__chat.message.push({ role: 'user', data: t, chatId: 't1u' + window.__chat.message.length }); }, userText);
    return page.evaluate(async () => {
      const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
      const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
      return out.map((m) => ({ role: m.role, content: String(m.content) }));
    });
  };
  /** 가짜 답을 붙이고 output 처리 */
  S.reply = async (text) => {
    await page.evaluate(async (t) => {
      window.__chat.message.push({ role: 'char', data: t, chatId: 't1c' + window.__chat.message.length });
      await window.__calls.listeners[0]({ char: window.__clone(window.__char), chat: window.__clone(window.__chat), characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
    }, text);
    await sleep(600);
  };
  S.startChat = (fac, fm, opt) => startChat(page, fac, fm, opt);
  return S;
}

export const all = (msgs) => msgs.map((m) => m.content).join('\n');
/** 요청 글에서 「### 제목」 절 하나 (다음 ### 또는 --- 까지) */
export function section(text, head) {
  const i = text.indexOf(head);
  if (i < 0) return '';
  const rest = text.slice(i);
  const j = rest.indexOf('\n---', head.length);
  return rest.slice(0, j < 0 ? 4000 : j);
}
export { launch };
