// 출시 전 QC 공용 가짜 Risu (tests/browser.mjs 의 hostScript 를 복사해 읽기 횟수 세기·예외 주입을 더한 것).
// 다른 qc-*-browser.mjs 가 import 해서 쓴다. 사용법: import { launch, boot, startChat, hostScript } from './qc-host.mjs'
import { createRequire } from 'node:module';
import { distPack, distWorldPack } from './data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
export const { chromium } = require('playwright');

export const plugin = readFileSync(process.env.PLUGIN || new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
export const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');
/** 시험 본체(scripts/build.mjs): 배포 본체와 같되 예외 주입 블록(globalThis.__goeiFaultSteps)만 남긴 것. 요청 조립 실패 절(qc-pipeline 8절)만 쓴다 */
export const testBodyCode = readFileSync(new URL('../dist-test/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
export const worldPack = distWorldPack();
// 아바타 팩: 내 페르소나로 시작하려면 아바타가 있어야 출발 (2026-11-08 사용자). browser.mjs 와 같이 저장소에 미리 둔다
const looksPack = distPack('goei-data-looks');

/** 가짜 risuai. window.__counts 에 getChatFromIndex·getCharacterFromIndex 호출 수를 센다 */
export function hostScript(char, chat, { rootDom = true, noBody = false, prefs = null, body = bodyCode } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {} };
    window.__counts = { chat: 0, char: 0, setChat: 0, setChar: 0 };
    const listeners = new Map();
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { if (!k.startsWith('x-')) throw new Error('x- only'); el.setAttribute(k, v); },
      setInnerHTML: async (h) => { el.innerHTML = h; },
      getInnerHTML: async () => el.innerHTML,
      setTextContent: async (t) => { el.textContent = t; },
      setStyle: async (k, v) => { el.style[k] = v; },
      appendChild: async (c) => { el.appendChild(c._el); },
      querySelector: async (q) => wrap(el.querySelector(q)),
      getBoundingClientRect: async () => { await new Promise((r) => setTimeout(r, 10)); const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
      addEventListener: async (type, fn) => { const id = String(Math.random()); const h = (e) => { const ev = { type: e.type, clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons }; setTimeout(() => fn(ev), 5); }; listeners.set(id, [type, h]); document.addEventListener(type, h); return id; },
      removeEventListener: async (type, id) => { await new Promise((r) => setTimeout(r, 30)); const l = listeners.get(id); if (l) { document.removeEventListener(l[0], l[1]); listeners.delete(id); } },
      remove: async () => { el.remove(); },
      addClass: async (c) => { el.classList.add(c); },
      removeClass: async (c) => { el.classList.remove(c); },
      hasClass: async (c) => el.classList.contains(c),
      textContent: async () => el.textContent,
    });
    window.__store = {};
    // ── T1 스위치 (전수점검 3차 코스 2-1, 사용법: 인수인계/플레이순서_점검/3차/틀/T1_사용법.md) ──
    // 저장 실패: window.__saveFail = { chat|storage|char: { from: n번째 호출(1부터), count: m회(없으면 끝까지), mode: 'throw'|'silent', key: 'goei:prefs'(storage 만, 앞부분 맞춤) } }
    // 'silent' = 실제 리스AI setChatToIndex·setCharacterToIndex 가 dbWrite 권한 거절·없는 번호일 때처럼 아무것도 안 쓰고 undefined 로 돌아옴
    window.__saveCalls = { chat: 0, storage: 0, char: 0 };
    window.__calls.saveFail = [];
    window.__saveGate = (target, key) => {
      const f = window.__saveFail && window.__saveFail[target];
      if (f && f.key && !String(key ?? '').startsWith(f.key)) return null;
      const n = ++window.__saveCalls[target];
      if (!f) return null;
      const from = f.from ?? 1;
      const count = f.count ?? Infinity;
      if (n < from || n >= from + count) return null;
      const mode = f.mode === 'silent' ? 'silent' : 'throw';
      window.__calls.saveFail.push({ target, n, mode, key: key ?? null });
      if (mode === 'throw') throw new Error('시험용 저장 실패(' + target + ' ' + n + '번째)');
      return 'silent';
    };
    // 기다림 붙잡기: 리스AI 입력창의 멈춤 단추(.loadmove, 만드는 중)·보내기 단추(.button-icon-send, 쉬는 중)를 .default-chat-screen 에 넣고 뺀다 (src/host/usebox.ts risuBusy)
    window.__risuBusy = (state) => {
      document.querySelectorAll('[x-t1-risu-btn]').forEach((e) => e.remove());
      const screen = document.querySelector('.default-chat-screen');
      if (!screen || (state !== 'busy' && state !== 'idle')) return;
      const b = document.createElement('button');
      b.setAttribute('x-t1-risu-btn', state);
      if (state === 'busy') { const d = document.createElement('div'); d.className = 'loadmove chat-process-stage-0'; b.appendChild(d); }
      else b.className = 'button-icon-send';
      screen.appendChild(b);
    };
    // 보조 호출 스트리밍: window.__llm 에 { stream: ['조각', ...], form: 'object'|'string', gapMs, stallAfter: k, errorAfter: k } 를 넣으면
    // 리스AI 처럼 { type: 'streaming', result: ReadableStream } 을 돌려준다. 조각은 누적 글 {"0": 지금까지 글} (리스AI request.ts 와 같은 꼴, form 'string' 이면 글 그대로).
    // stallAfter: k 조각 뒤 멈춤(닫지 않음, window.__llmStreamRelease() 로 나머지를 보내고 닫음) · errorAfter: k 조각 뒤 끊김(controller.error)
    window.__llmHeld = [];
    window.__llmStreamRelease = () => { const h = window.__llmHeld.splice(0); h.forEach((f) => f()); return h.length; };
    window.__makeStream = (spec) => {
      const pieces = spec.stream || [];
      const gap = spec.gapMs ?? 30;
      let full = '';
      const log = { spec, sent: 0, state: 'open' };
      (window.__calls.llmStream = window.__calls.llmStream || []).push(log);
      return new ReadableStream({
        async start(c) {
          const push = (i) => { full += pieces[i]; c.enqueue(spec.form === 'string' ? full : { 0: full }); log.sent = i + 1; };
          for (let i = 0; i < pieces.length; i++) {
            if (spec.errorAfter === i) { log.state = 'error'; c.error(new Error('시험용 스트림 끊김')); return; }
            if (spec.stallAfter === i) {
              log.state = 'stalled';
              await new Promise((r) => window.__llmHeld.push(r));
              log.state = 'released';
            }
            await new Promise((r) => setTimeout(r, gap));
            push(i);
          }
          if (spec.errorAfter != null && spec.errorAfter >= pieces.length) { log.state = 'error'; c.error(new Error('시험용 스트림 끊김')); return; }
          if (spec.stallAfter != null && spec.stallAfter >= pieces.length) { log.state = 'stalled'; await new Promise((r) => window.__llmHeld.push(r)); }
          log.state = 'closed';
          c.close();
        },
      });
    };
    if (!${noBody}) window.__store['p:goei:body'] = ${JSON.stringify(body)};
    if (!${noBody}) window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};
    if (!${noBody}) window.__store['p:goei:data-looks'] = ${JSON.stringify(looksPack)};
    if (${JSON.stringify(prefs)}) window.__store['p:goei:prefs'] = ${JSON.stringify(JSON.stringify(prefs))};
    window.__rootDoc = ${rootDom} ? { ...wrap(document.documentElement), querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)) } : null;
    window.__char = ${JSON.stringify(char)};
    window.__liteChar = window.__char;
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.__clone = clone;
    window.risuai = {
      registerButton: async (arg, cb) => { window.__button = { arg, cb }; return { id: arg.id }; },
      registerSetting: async (name, cb) => { window.__setting = cb; return { id: 's' }; },
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async (m) => { (window.__calls.send = window.__calls.send || []).push({ m, last: window.__chat.message?.at(-1)?.data }); if (window.__sendFail) throw new Error('Sending chat with plugin-based model is currently blocked'); return true; },
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: { getItem: async (k) => window.__store['p:' + k] ?? null, setItem: async (k, v) => { if (window.__saveGate('storage', k)) return; window.__store['p:' + k] = v; }, keys: async () => [], removeItem: async (k) => { delete window.__store['p:' + k]; } },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); },
      removeRisuReplacer: async () => {},
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); },
      removeRisuChatListener: async () => {},
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; },
      removeRisuScriptHandler: async () => {},
      onUnload: async () => {},
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => 0,
      getCurrentChatIndex: async () => 0,
      getCharacterFromIndex: async () => { window.__counts.char++; return clone(window.__char); },
      setCharacterToIndex: async (i, c) => { window.__counts.setChar++; if (window.__saveGate('char')) return; window.__calls.setChar = (window.__calls.setChar || 0) + 1; window.__char = clone(c); },
      getChatFromIndex: async () => { window.__counts.chat++; if (window.__chatFail) throw new Error('chat read failed'); await (window.__chatDelay ? new Promise((r) => setTimeout(r, window.__chatDelay)) : 0); return clone(window.__chat); },
      setChatToIndex: async (a, b, chat) => { window.__counts.setChat++; if (window.__saveGate('chat')) return; window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async (o) => { window.__calls.llm = window.__calls.llm || []; window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 150)); const next = (window.__llm || []).shift(); if (next && Array.isArray(next.stream)) return { type: 'streaming', result: window.__makeStream(next) }; return next ?? { type: 'fail', result: 'no mock' }; },
      getCurrentLorebookEntries: async () => clone([...(window.__char.globalLore || []), ...(window.__moduleLore || [])]),
      getDatabase: async () => ({ modules: window.__modules || [], enabledModules: (window.__modules || []).map((m) => m.id) }),
      readImage: async (p) => { (window.__calls.read = window.__calls.read || []).push(p); if (window.__assets[p]) return window.__assets[p]; const b64 = await window.__readAsset(p); if (!b64) throw new Error('no asset'); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\\{\\{user\\}\\}/g, window.__userName ?? '{{user}}').replace(/\\{\\{persona\\}\\}/g, window.__persona ?? ''),
      nativeFetch: async (url) => { (window.__calls.fetch = window.__calls.fetch || []).push(url); const r = window.__fetch && window.__fetch(String(url)); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => (r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r))).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    window.__assets = {};`;
}

export async function launch() {
  const browser = await chromium.launch();
  process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
  return browser;
}

export async function boot(browser, char, chat, { viewport = { width: 1100, height: 900 }, touch = false, rootDom = true, noBody = false, fixtureDir = '', prefs = null, body = bodyCode, clock = false } = {}) {
  const page = await browser.newPage({ viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  // clock: Playwright 가짜 시계 (page.clock.fastForward 로 「메인 응답 대기」 3분·「모델 응답 대기」 같은 긴 시간을 건너뛴다). 시간은 그대로 흐른다
  if (clock) await page.clock.install();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const logs = [];
  page.on('console', (m) => { if (m.text().startsWith('[goei]')) logs.push(m.text()); });
  await page.exposeFunction('__readAsset', (p) => {
    try { return fixtureDir ? readFileSync(new URL(p, `file://${fixtureDir}/`)).toString('base64') : null; } catch { return null; }
  });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"><button id="other" style="margin:40px">다른 버튼</button></div></body></html>');
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(char, chat, { rootDom, noBody, prefs, body }) });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
  return { page, errors, logs };
}

/** 플로팅 버튼이 뜰 때까지(Lite 판정) 기다린다 */
export async function waitLite(page) {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
}

export async function open(page) {
  await waitLite(page);
  await page.click('[x-goei-fab] button');
}

/** 시작 화면으로 채팅을 시작한다 (소속·상황 번호). 저장된 채팅을 돌려준다 */
export async function startChat(page, faction = 'A00', fm = 2, { player } = {}) {
  await open(page);
  await page.waitForSelector('.gx-fac');
  await page.click(`.gx-fac[data-value="${faction}"]`);
  if (fm) await page.click(`.gx-sc[data-value="${fm}"]`);
  if (player) {
    await page.waitForSelector(`[data-action="pick-player"][data-value="${player}"], .gx-player [data-value="${player}"]`, { timeout: 3000 }).catch(() => {});
    const sel = (await page.$(`[data-action="pick-player"][data-value="${player}"]`)) ? `[data-action="pick-player"][data-value="${player}"]` : `.gx-player [data-value="${player}"]`;
    await page.click(sel);
  }
  const n = await page.evaluate(() => window.__calls.setChat.length);
  await page.click('.gx-start');
  await page.waitForFunction((n) => window.__calls.setChat.length > n, n);
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none' || window.__calls.hide >= 1).catch(() => {});
  return page.evaluate(() => window.__clone(window.__chat));
}

/** 요청 통과 (beforeRequest) */
export const request = (page, messages, type = 'model') => page.evaluate(([m, t]) => window.__calls.replacers[0](m, t), [messages, type]);
/** 응답 처리 (output 리스너). 채팅은 지금 window.__chat */
export const output = (page, messageIndex) => page.evaluate(async (i) => {
  const c = window.__chat;
  await window.__calls.listeners[0]({ char: window.__clone(window.__char), chat: window.__clone(c), characterIndex: 0, chatIndex: 0, messageIndex: i ?? c.message.length - 1 });
}, messageIndex);
/** 플러그인이 넣은 첫 장면 메시지(char, %%GOEI_SCENE%%)의 글. 없으면 '' (2026-11-05: 첫 장면은 카드 인사말이 아니라 플러그인 메시지) */
export const sceneOf = (saved) => (saved?.message?.[0]?.role === 'char' && String(saved.message[0].data).includes('%%GOEI_SCENE%%') ? String(saved.message[0].data).replace(/\r?\n?%%GOEI_SCENE%%/g, '') : '');
export const display = (page, text) => page.evaluate((t) => window.__calls.handlers.display(t), text);
export const input = (page, text) => page.evaluate((t) => window.__calls.handlers.input(t), text);
export const chat = (page) => page.evaluate(() => window.__clone(window.__chat));
export const setChat = (page, patch) => page.evaluate((p) => { Object.assign(window.__chat, p); }, patch);
export const setVars = (page, vars) => page.evaluate((v) => { window.__chat.scriptstate = { ...(window.__chat.scriptstate ?? {}), ...v }; }, vars);
export const counts = (page) => page.evaluate(() => ({ ...window.__counts }));
export const resetCounts = (page) => page.evaluate(() => { window.__counts = { chat: 0, char: 0, setChat: 0, setChar: 0 }; });

// ── T1 스위치 도우미 (window.__saveFail·__risuBusy·__llm 스트림) ──
/** 저장 실패 켜기. target: 'chat'(setChatToIndex) | 'storage'(pluginStorage.setItem) | 'char'(setCharacterToIndex). from 은 지금부터 센 n번째(1부터) */
export const setSaveFail = (page, target, { from = 1, count, mode = 'throw', key } = {}) => {
  const o = { from, mode, ...(count != null ? { count } : {}), ...(key != null ? { key } : {}) };
  return page.evaluate(([t, o]) => { window.__saveCalls[t] = 0; window.__saveFail = { ...(window.__saveFail || {}), [t]: o }; }, [target, o]);
};
/** 저장 실패 끄기 (target 없으면 전부) */
export const clearSaveFail = (page, target) => page.evaluate((t) => { if (!t) window.__saveFail = null; else if (window.__saveFail) delete window.__saveFail[t]; }, target ?? null);
/** 저장 실패 기록 [{ target, n, mode, key }] */
export const saveFails = (page) => page.evaluate(() => window.__calls.saveFail.slice());
/** 리스AI 입력창 상태: 'busy'(.loadmove) | 'idle'(.button-icon-send) | 'none'(둘 다 없음 = 판정 unknown) */
export const setRisuBusy = (page, state) => page.evaluate((s) => window.__risuBusy(s), state);
/** 보조 호출 답을 줄 세운다. 글이면 { type: 'success', result }, 스트림이면 { stream: [...], ... } 그대로 */
export const queueLlm = (page, ...answers) => page.evaluate((a) => { window.__llm = [...(window.__llm || []), ...a.map((x) => (typeof x === 'string' ? { type: 'success', result: x } : x))]; }, answers);
/** 멈춘 스트림을 마저 보내고 닫는다. 풀린 개수 */
export const releaseStreams = (page) => page.evaluate(() => window.__llmStreamRelease());

/** 시험 묶음 실행기: 실패해도 다음 묶음으로, 끝에 실패 수를 돌려준다 */
export function runner() {
  const results = [];
  return {
    async section(name, fn) {
      const t0 = Date.now();
      try {
        await fn();
        results.push({ name, ok: true, ms: Date.now() - t0 });
        console.log(`PASS ${name} (${Date.now() - t0}ms)`);
      } catch (e) {
        results.push({ name, ok: false, ms: Date.now() - t0, error: e });
        console.log(`FAIL ${name}\n  ${e?.stack ?? e}`);
      }
    },
    results,
    failed: () => results.filter((r) => !r.ok).length,
  };
}
