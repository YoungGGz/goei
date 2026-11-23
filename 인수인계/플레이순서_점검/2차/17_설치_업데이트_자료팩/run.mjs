// 플레이 순서 점검 2차 · 17. 설치·업데이트·자료 팩
// 실제 시작기(dist/goei-plugin.js)·본체(dist/goei-body.js)를 Risu 플러그인 칸과 같은 격리(sandbox iframe + nonce CSP) 안에 띄우고,
// 받는 주소(UPDATE_BASE)의 파일은 release/ 폴더에서 그대로 돌려준다 (가짜 nativeFetch). 외부 네트워크는 쓰지 않는다.
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (받은 파일·화면 글·요청), out/상태NN.json, out/결과.json
// 사용법: (release/ 와 dist/ 가 있는 상태에서) node 인수인계/플레이순서_점검/2차/17_설치_업데이트_자료팩/run.mjs [갈래 글자들, 예: ABC]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const rd = (p) => readFileSync(ROOT + p, 'utf8');
const VERSION = JSON.parse(rd('package.json')).version;
const plugin = rd('dist/goei-plugin.js');
const bodyCode = rd('dist/goei-body.js');
const fixture = JSON.parse(rd('.scratch/fixture/fixture.json'));
const relText = (n) => rd(`release/${n}`);
const packText = (name) => JSON.parse(relText(`${name}.json`)).parts.map((n) => relText(n)).join('');
const worldPack = packText('goei-data-world');
const looksPack = packText('goei-data-looks');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = (process.argv[2] || 'ABCDEFG').split('');

const results = [];
let stepNo = 0;
/** 단계 기록: 기대값 목록 [이름, 기대, 실제] 을 비교해 결과에 남긴다 */
function record(name, { pressed, expect, fetched = [], screen = '', extra = '', state = null }) {
  const nn = String(++stepNo).padStart(2, '0');
  const rows = expect.map(([what, want, got, basis]) => ({ what, want, got, basis, ok: typeof want === 'function' ? !!want(got) : JSON.stringify(want) === JSON.stringify(got) }));
  const ok = rows.every((r) => r.ok);
  const show = (v) => (typeof v === 'function' ? v.toString() : JSON.stringify(v));
  const txt = [`# 단계${nn} ${name}`, `누른 순서: ${pressed}`, '', '## 기대값 대조', ...rows.map((r) => `- [${r.ok ? '통과' : '어긋남'}] ${r.what}\n  기대: ${show(r.want)}\n  실제: ${JSON.stringify(r.got)}\n  근거: ${r.basis ?? ''}`), '', '## 받은 파일 (이 단계에서, 순서대로)', fetched.join('\n') || '(없음)', '', '## 화면 글', screen || '(없음)', extra ? `\n## 덧붙임\n${extra}` : ''].join('\n');
  writeFileSync(`${OUT}단계${nn}_${name.replace(/[\\/:*?"<>| ]+/g, '_')}.txt`, txt);
  if (state) writeFileSync(`${OUT}상태${nn}.json`, JSON.stringify(state, null, 1));
  results.push({ step: nn, name, ok, bad: rows.filter((r) => !r.ok).map((r) => r.what) });
  console.log(`${ok ? 'PASS' : 'MISS'} 단계${nn} ${name}${ok ? '' : ' — ' + rows.filter((r) => !r.ok).map((r) => r.what).join(' / ')}`);
}

// ── 가짜 Risu (tests/qc-loader-browser.mjs 의 hostScript 를 줄이고, 받기를 release/ 파일 읽기로 바꿈) ──
function hostScript(chars, charIndex, chat, { store = {} } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {}, fetch: [], setChar: 0 };
    const listeners = new Map();
    const attach = (target, type, fn) => { const id = String(Math.random()); const h = (e) => { const ev = { type: e.type, clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons }; setTimeout(() => fn(ev), 5); }; listeners.set(id, [target, type, h]); target.addEventListener(type, h); return id; };
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { if (!k.startsWith('x-')) throw new Error('x- only'); el.setAttribute(k, v); },
      setInnerHTML: async (h) => { el.innerHTML = h; }, getInnerHTML: async () => el.innerHTML, setTextContent: async (t) => { el.textContent = t; },
      setStyle: async (k, v) => { el.style[k] = v; }, getStyle: async (k) => el.style[k],
      appendChild: async (c) => { el.appendChild(c._el); }, querySelector: async (q) => wrap(el.querySelector(q)),
      querySelectorAll: async (q) => { const a = [...el.querySelectorAll(q)].map(wrap); a.length = async () => a.length; return a; },
      getBoundingClientRect: async () => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
      addEventListener: async (type, fn) => attach(el, type, fn),
      removeEventListener: async (type, id) => { const l = listeners.get(id); if (l) { l[0].removeEventListener(l[1], l[2]); listeners.delete(id); } },
      remove: async () => { el.remove(); }, addClass: async (c) => { el.classList.add(c); }, removeClass: async (c) => { el.classList.remove(c); },
      hasClass: async (c) => el.classList.contains(c), textContent: async () => el.textContent,
    });
    window.__store = ${JSON.stringify(store)};
    window.__rootDoc = { ...wrap(document.documentElement), querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)), addEventListener: async (type, fn) => attach(document, type, fn) };
    window.__chars = ${JSON.stringify(chars)};
    window.__charIndex = ${charIndex};
    Object.defineProperty(window, '__char', { get: () => window.__chars[window.__charIndex], set: (v) => { window.__chars[window.__charIndex] = v; } });
    window.__chat = ${JSON.stringify(chat)};
    window.__buttons = {};
    window.__net = true;            // false 면 모든 받기 404
    window.__fetchHook = null;      // (name, url) => 값 | null(404) | undefined(그대로)
    window.__fetch = async (u) => {
      const name = u.split('?')[0].split('/').pop();
      if (window.__fetchHook) { const r = await window.__fetchHook(name, u); if (r !== undefined) return r; }
      if (!window.__net) return null;
      const sub = u.includes('/pic/') ? 'pic/' + name : name;
      const r = await window.__readRelease(sub);
      if (r == null) return null;
      return r.b ? Uint8Array.from(atob(r.b), (c) => c.charCodeAt(0)) : r.t;
    };
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.__clone = clone;
    const toBytes = (r) => r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r));
    window.risuai = {
      registerButton: async (arg, cb) => { window.__buttons[arg.id || arg.name] = { arg, cb }; return { id: arg.id }; },
      unregisterUIPart: async (id) => { delete window.__buttons[id]; },
      registerSetting: async () => ({ id: 's' }),
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async (m) => true,
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: {
        getItem: async (k) => window.__store['p:' + k] ?? null,
        setItem: async (k, v) => { window.__store['p:' + k] = v; },
        keys: async () => Object.keys(window.__store).filter((k) => k.startsWith('p:')).map((k) => k.slice(2)),
        removeItem: async (k) => { delete window.__store['p:' + k]; },
      },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); }, removeRisuReplacer: async () => {},
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); }, removeRisuChatListener: async () => {},
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; }, removeRisuScriptHandler: async () => {},
      onUnload: async (cb) => { window.__unload = cb; },
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => window.__charIndex,
      getCurrentChatIndex: async () => 0,
      getCharacterFromIndex: async (i) => (window.__chars[i] ? clone(window.__chars[i]) : null),
      setCharacterToIndex: async (i, c) => { window.__calls.setChar++; window.__chars[i] = clone(c); },
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async () => ({ type: 'fail', result: 'no mock' }),
      getCurrentLorebookEntries: async () => clone(window.__char.globalLore || []),
      getDatabase: async () => ({ modules: [], enabledModules: [] }),
      readImage: async (p) => { if (window.__assets[p]) return window.__assets[p]; throw new Error('no asset'); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t),
      nativeFetch: async (url) => { window.__calls.fetch.push(String(url)); const r = await window.__fetch(String(url)); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => toBytes(r).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    window.__assets = {};`;
}

const outer = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><iframe style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>';
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(outer); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const outerUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

async function boot(chars, charIndex, chat, { store = {}, viewport = { width: 1100, height: 900 }, touch = false, net = true, hook = null } = {}) {
  const page = await browser.newPage({ viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  await page.exposeFunction('__readRelease', (sub) => {
    const p = ROOT + 'release/' + sub;
    if (!existsSync(p)) return null;
    return /\.(webp|avif|png|jpe?g)$/i.test(sub) ? { b: readFileSync(p).toString('base64') } : { t: readFileSync(p, 'utf8') };
  });
  const nonce = 'n' + Math.random().toString(36).slice(2);
  const csp = `connect-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; frame-src 'none'; object-src 'none'; style-src * 'unsafe-inline'; default-src 'none'; img-src * data: blob:; font-src * data: blob:; media-src * data: blob:; base-uri 'none';`;
  const pre = `${net ? '' : 'window.__netOff = true;'}`;
  const inner = (hostScript(chars, charIndex, chat, { store }) + `\n${pre}${net ? '' : 'window.__net = false;'}${hook ? `window.__fetchHook = ${hook};` : ''}\n(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });`).replace(/<\/script/gi, '<\\/script');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}" id="csp-meta"></head>`
    + `<body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"></div>`
    + `<script nonce="${nonce}">document.querySelector('meta#csp-meta')?.remove();\n${inner}</script></body></html>`;
  await page.goto(outerUrl);
  await page.evaluate(({ html, csp }) => { const f = document.querySelector('iframe'); f.sandbox.add('allow-scripts'); f.sandbox.add('allow-modals'); f.setAttribute('csp', csp); f.srcdoc = html; }, { html, csp });
  let frame = null;
  for (let i = 0; i < 100 && !frame; i++) { frame = page.frames().find((f) => f !== page.mainFrame()); if (!frame) await page.waitForTimeout(100); }
  await frame.waitForFunction(() => window.__calls?.replacers.length || window.__bootError, null, { timeout: 30000 });
  const be = await frame.evaluate(() => window.__bootError ?? null);
  if (be) throw new Error('boot: ' + be);
  let mark = 0;
  /** 이 단계에서 받은 파일 이름 (앞 단계 뒤부터) */
  const fetchedSince = async () => { const all = await frame.evaluate(() => window.__calls.fetch.map((u) => (u.includes('/pic/') ? 'pic/' : '') + u.split('?')[0].split('/').pop())); const out = all.slice(mark); mark = all.length; return out; };
  return { page, frame, errors, logs, fetchedSince };
}

const fabShown = (frame) => frame.evaluate(() => document.querySelector('[x-goei-fab]')?.style.display === 'block');
const waitFab = (frame, timeout = 20000) => frame.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout }).then(() => true, () => false);
const text = (frame, sel) => frame.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => e.innerText).join('\n---\n'), sel);
/** 저장 상태 요약 (긴 값은 길이·머리만) */
async function state(frame) {
  return frame.evaluate(() => {
    const store = {};
    for (const [k, v] of Object.entries(window.__store)) store[k] = typeof v === 'string' ? (v.length > 200 ? { length: v.length, head: v.slice(0, 40) } : v) : v;
    const chars = window.__chars.map((c) => {
      let man = null;
      try { man = JSON.parse(c.globalLore.find((e) => e.comment === 'Plugin manifest')?.content ?? 'null'); } catch {}
      return { name: c.name, image: c.image, lore: (c.globalLore || []).map((e) => e.comment), manifestVersion: man?.version ?? null, manifestSource: man?.source ?? null, greetings: (c.alternateGreetings || []).length, assets: (c.additionalAssets || []).length, firstMessageLanding: String(c.firstMessage ?? '').includes('data-goei="landing"'), ccAssets: c.ccAssets ?? null };
    });
    return { store, chars, setChar: window.__calls.setChar, setChat: window.__calls.setChat.length, show: window.__calls.show, hide: window.__calls.hide };
  });
}
const bodyFiles = ['goei-body.json', ...JSON.parse(relText('goei-body.json')).parts];
const worldFiles = ['goei-data-world.json', ...JSON.parse(relText('goei-data-world.json')).parts];
const installFiles = ['goei-data-install.json', ...JSON.parse(relText('goei-data-install.json')).parts];
const otherBot = () => ({ name: '내 봇', chaId: 'mybot-1', firstMessage: '안녕, 나는 내 봇이야.', alternateGreetings: ['두 번째 인사'], globalLore: [{ comment: '내 로어', content: '내가 쓴 설정', key: 'x', mode: 'normal' }], additionalAssets: [], image: 'assets/old-icon.png' });
const goeiCard = () => JSON.parse(JSON.stringify(fixture));
const emptyChat = () => ({ message: [], scriptstate: {} });
const press = (frame) => frame.evaluate(() => window.__buttons['goei-plugin-install'].cb());

async function branch(id, title, fn) {
  if (!only.includes(id)) return;
  stepNo = { A: 0, B: 10, C: 20, D: 40, E: 50, F: 70, G: 80 }[id] ?? 90;
  console.log(`\n== 갈래 ${id}: ${title}`);
  try { await fn(); } catch (e) {
    console.log(`ERROR 갈래 ${id}: ${e?.stack ?? e}`);
    results.push({ step: '-', name: `갈래 ${id} 중단`, ok: false, bad: [String(e?.message ?? e)] });
  }
}

// ─────────────── A. 처음 설치: 괴이 카드(배포 카드)를 가져와 처음 엶, 저장소 빔 (PC) ───────────────
let storeAfterA = null;
await branch('A', '처음 설치 (괴이 카드, 빈 저장소, PC)', async () => {
  const { page, frame, errors, fetchedSince } = await boot([goeiCard()], 0, emptyChat());
  const fab = await waitFab(frame);
  const f1 = await fetchedSince();
  record('A_카드열기_본체와세계자료받기', {
    pressed: '괴이 카드 채팅을 연다 (저장소 빔)',
    fetched: f1,
    expect: [
      ['받기 창 없이 유령 단추가 뜸', true, fab, 'release 안내 4번 「괴이 카드를 열면 나머지 파일을 자동으로 받습니다」'],
      ['본체 목록·조각 다음 세계 자료 목록·조각을 한 번씩 받음', [...bodyFiles, ...worldFiles], f1.filter((n) => /goei-body|goei-data-world/.test(n)), 'src/main.ts load · src/host/datapack.ts loadWorldData'],
      ['받기 창(.gl-card) 없음', 0, await frame.locator('.gl-card').count(), 'src/main.ts load (받기 성공이면 창 없음)'],
      ['본체 저장 (판 줄)', `// goei-body ${VERSION}`, await frame.evaluate(() => String(window.__store['p:goei:body'] ?? '').split('\n')[0]), 'src/main.ts save'],
      ['세계 자료 저장', worldPack.length, await frame.evaluate(() => (window.__store['p:goei:data-world'] ?? '').length), 'src/host/datapack.ts keepWorldData'],
    ],
    state: await state(frame),
  });
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac', { timeout: 15000 }).catch(() => {});
  const f2 = await fetchedSince();
  record('A_유령단추_시작화면', {
    pressed: '유령 단추',
    fetched: f2,
    expect: [
      ['시작 화면(소속 고르기)이 뜸', true, (await frame.locator('.gx-fac').count()) > 0, 'release 안내 5번'],
      ['새 버전 확인으로 version.json 을 한 번 받음', 1, f2.filter((n) => n === 'version.json').length, 'src/ui/app.ts openApp → checkLatest (세션에 한 번)'],
      ['새 버전 띠 없음 (같은 판)', 0, await frame.locator('.upd-banner').count(), 'src/ui/update.ts updateBanner'],
    ],
    screen: (await text(frame, '.gx')).slice(0, 1500),
  });
  await press(frame);
  await frame.waitForSelector('.gw-install', { timeout: 20000 }).catch(() => {});
  const f3 = await fetchedSince();
  const scr3 = await text(frame, '.gw-install');
  record('A_햄버거_설치업데이트_점검', {
    pressed: '리스 사이드바 「괴이 ː ANOMALY 설치·업데이트」',
    fetched: f3,
    screen: scr3,
    expect: [
      ['점검 화면이 뜸', true, (await frame.locator('.gw-install').count()) > 0, 'src/main.ts registerButton 주석 「괴이 카드에서는 같은 단추가 점검 화면」'],
      ['설치 자료 팩을 받음', installFiles, f3.filter((n) => n.startsWith('goei-data-install')), 'src/host/datapack.ts ensureInstallData'],
      ['플러그인·카드 둘 다 「최신이에요」', 2, (scr3.match(/최신이에요/g) || []).length, 'src/ui/update.ts updateGroup'],
      ['빠진 것 = 위키·토크나이저 (카드에 없는 것만)', true, /빠진 것이 2개/.test(scr3), 'qc-loader-browser 12절과 같은 기대'],
    ],
    state: await state(frame),
  });
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /끝났어요|안 된 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 120000 });
  const f4 = await fetchedSince();
  const scr4 = await text(frame, '.gw-install');
  record('A_빠진것전부채우기', {
    pressed: '「빠진 것 전부 채우기」',
    fetched: f4.length > 40 ? [...f4.slice(0, 40), `… (모두 ${f4.length}개)`] : f4,
    screen: scr4,
    expect: [
      ['안 된 것 없음', 0, await frame.locator('.gw-install .gx-err').count(), 'src/ui/editor/install.ts installAction'],
      ['점검 결과 모두 갖춰짐', true, /모두 갖춰져 있어요/.test(scr4), 'src/ui/editor/install.ts installPage allDone'],
      ['카드 사진은 받지 않음 (이미 카드에 있음)', 0, f4.filter((n) => n.startsWith('pic/')).length, 'src/core/install.ts installCheck (정식 카드는 카드 업데이트가 맡음)'],
      ['위키·토크나이저 저장', [true, true], await frame.evaluate(() => [!!window.__store['p:goei:wikibase'], !!window.__store['p:goei:tok-o200k']]), 'src/host/install.ts'],
    ],
    state: await state(frame),
  });
  storeAfterA = await frame.evaluate(() => window.__store);
  await page.close();
  // 페이지 새로고침: 같은 저장소로 다시 띄움
  const r = await boot([goeiCard()], 0, emptyChat(), { store: storeAfterA });
  const fab2 = await waitFab(r.frame);
  const f5 = await r.fetchedSince();
  record('A_페이지새로고침', {
    pressed: '리스 페이지 새로고침 (같은 저장소)',
    fetched: f5,
    expect: [
      ['유령 단추', true, fab2, ''],
      ['본체·세계 자료를 다시 받지 않음', [], f5.filter((n) => /goei-body|goei-data-world/.test(n)), 'src/main.ts load(저장된 본체) · src/host/datapack.ts loadWorldData(저장소에서)'],
    ],
    state: await state(r.frame),
  });
  // 다시 점검: 이미 받은 위키·토크나이저가 남아 있음
  await press(r.frame);
  await r.frame.waitForSelector('.gw-install', { timeout: 20000 }).catch(() => {});
  await r.frame.waitForFunction(() => /갖춰져|빠진 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
  const f6 = await r.fetchedSince();
  const scr6 = await text(r.frame, '.gw-install');
  record('A_새로고침뒤_다시점검', {
    pressed: '새로고침 뒤 「설치·업데이트」',
    fetched: f6,
    screen: scr6,
    expect: [
      ['모두 갖춰져 있음', true, /모두 갖춰져 있어요/.test(scr6), '저장소(goei:wikibase·goei:tok-o200k·goei:data-install)에 있음'],
      ['설치 자료 팩을 다시 받지 않음 (저장소에서)', [], f6.filter((n) => n.startsWith('goei-data-install')), 'src/host/datapack.ts ensureInstallData 주석 「지문이 맞으면 읽기만」'],
    ],
  });
  if (errors.length || r.errors.length) console.log('페이지 오류', errors, r.errors);
  await r.page.close();
});

// ─────────────── B. 다른 봇(내 봇)에 설치 (PC) ───────────────
let storeAfterB = null;
let charAfterB = null;
await branch('B', '다른 봇에 설치 (PC)', async () => {
  const store = { 'p:goei:body': bodyCode, 'p:goei:data-world': worldPack, 'p:goei:data-looks': looksPack };
  const chat = { message: [{ role: 'char', data: '안녕, 나는 내 봇이야.' }, { role: 'user', data: '반가워' }], scriptstate: {} };
  const { page, frame, errors, fetchedSince } = await boot([otherBot()], 0, chat, { store });
  await sleep(2500);
  const req = await frame.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '반가워' }], 'model'));
  record('B_다른봇열기', {
    pressed: '내 봇 채팅을 연다 (본체는 저장소에 있음)',
    fetched: await fetchedSince(),
    expect: [
      ['유령 단추 안 뜸', false, await fabShown(frame), 'src/main.ts 머리 주석 「다른 봇에서는 아무것도 하지 않는다」'],
      ['요청 그대로', [{ role: 'user', content: '반가워' }], req, 'src/main.ts onBeforeRequest'],
    ],
  });
  await press(frame);
  await frame.waitForSelector('.gw-install', { timeout: 20000 }).catch(() => {});
  await frame.waitForFunction(() => /카드가 아니에요/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
  await sleep(500);
  const scr = await text(frame, '.gw-install');
  const f2 = await fetchedSince();
  record('B_햄버거_설치화면', {
    pressed: '「괴이 ː ANOMALY 설치·업데이트」',
    fetched: f2,
    screen: scr,
    expect: [
      ['「아직 … 카드가 아니에요」', true, /아직 괴이 ː ANOMALY 카드가 아니에요/.test(scr), 'src/ui/editor/install.ts installPage'],
      ['업데이트 칸 카드 줄 「괴이 카드 아님」', true, /괴이 카드 아님/.test(scr), 'src/ui/update.ts updateGroup'],
      ['설치 자료·version.json 받음', true, f2.includes('goei-data-install.json') && f2.includes('version.json'), 'ensureInstallData · checkLatest'],
    ],
  });
  // 「새 버전 확인」 단추
  const n0 = (await frame.evaluate(() => window.__calls.fetch.length));
  await frame.click('[data-action="upd-check"]');
  await sleep(1500);
  const f3 = await fetchedSince();
  record('B_설치화면_새버전확인', {
    pressed: '설치 화면 업데이트 칸 「새 버전 확인」',
    fetched: f3,
    screen: await text(frame, '.gw-install .ps-group'),
    expect: [
      ['version.json 을 다시 받음 (단추가 동작)', true, f3.includes('version.json'), 'src/ui/update.ts handleUpdate upd-check → checkLatest(force)'],
    ],
    extra: `누르기 전 받기 수 ${n0}`,
  });
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /끝났어요|안 된 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 300000 });
  const f4 = await fetchedSince();
  const scr4 = await text(frame, '.gw-install');
  const st4 = await state(frame);
  const ch = await frame.evaluate(() => window.__chars[0]);
  record('B_설치', {
    pressed: '「괴이 ː ANOMALY 설치」',
    fetched: [`사진 ${f4.filter((n) => n.startsWith('pic/')).length}장`, ...f4.filter((n) => !n.startsWith('pic/'))],
    screen: scr4,
    state: st4,
    expect: [
      ['안 된 것 없음', 0, await frame.locator('.gw-install .gx-err').count(), 'installAction'],
      ['모두 갖춰짐', true, /모두 갖춰져 있어요/.test(scr4), 'installPage'],
      ['봇 이름이 괴이 ː ANOMALY (기본: 바꿈)', '괴이 ː ANOMALY', ch.name, 'src/ui/editor/install.ts setName 기본 = 괴이 카드 아니면 켬'],
      ['첫 메시지 = 시작 안내', true, String(ch.firstMessage).includes('data-goei="landing"'), 'host/install.ts installLoreAndGreetings (사용자 2026-11-08)'],
      ['원래 첫 메시지는 추가 인사말 끝으로', '안녕, 나는 내 봇이야.', ch.alternateGreetings.at(-1), '같은 곳 주석 「원래 글은 지우지 않고 추가 인사말 끝으로」'],
      ['원래 인사말·로어북 보존', [true, true], [ch.alternateGreetings[0] === '두 번째 인사', ch.globalLore.some((e) => e.comment === '내 로어')], 'installPage 안내 「기존 로어북·인사말·에셋은 그대로」'],
      ['카드 사진 전부', JSON.parse(fixture.globalLore.find((e) => e.comment === 'Plugin manifest').content).pictures.length, ch.additionalAssets.length, 'installPictures'],
      ['아이콘 = 플러그인 아이콘, 이전 아이콘은 목록에', true, ch.image !== 'assets/old-icon.png' && (ch.ccAssets || []).some((a) => a.uri === 'assets/old-icon.png'), 'installIcon (사용자 2026-10-27·11-15)'],
    ],
  });
  storeAfterB = await frame.evaluate(() => window.__store);
  charAfterB = ch;
  // 창 닫기 → 유령 단추
  await frame.click('.gw [data-action="ed-close"]').catch(() => {});
  await frame.click('.gx [data-action="close"]').catch(() => {});
  const fab = await waitFab(frame, 10000);
  let pick = false;
  if (fab) { await frame.click('[x-goei-fab] button'); pick = await frame.waitForSelector('.gx-fac', { timeout: 6000 }).then(() => true, () => false); }
  record('B_설치뒤_유령단추_시작화면', {
    pressed: '설정 창 닫기 → 패널 닫기 → 유령 단추 (설치 전 메시지 2개가 있던 그 채팅)',
    screen: '',
    fetched: await fetchedSince(),
    expect: [
      ['유령 단추가 뜸', true, fab, 'qc-loader 10절 「설치로 괴이 카드가 됨」'],
      ['기존 메시지가 있는 이 채팅은 시작 화면이 아니라 상황판 화면 (새 채팅을 열어야 시작 화면)', [false, true], [pick, /상황판/.test(await text(frame, '.gx'))], 'src/ui/editor/install.ts 안내 「설치 뒤 새 채팅을 열면 시작 화면이 떠요」'],
    ],
  });
  if (errors.length) console.log('페이지 오류', errors);
  await page.close();
});

// ─────────────── C. 본체 받기 실패 · 다시 받기 · 파일로 넣기 · 판 어긋남 ───────────────
await branch('C', '본체 받기 실패 갈래', async () => {
  // C-1 네트워크 막힘
  const chat = { message: [{ role: 'char', data: '첫 장면 글\n%%GOEI_SCENE%%' }, { role: 'user', data: '안녕' }], scriptstate: {} };
  let { page, frame, errors, fetchedSince } = await boot([goeiCard()], 0, chat, { net: false });
  await frame.waitForSelector('.gl-card', { timeout: 15000 }).catch(() => {});
  record('C_받기실패_받기창', {
    pressed: '괴이 카드 채팅을 연다 (받기 404)',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gl-card'),
    expect: [
      ['받기 창이 뜸', 1, await frame.locator('.gl-card').count(), 'src/loader/panel.ts showPanel'],
      ['단추 셋 (다시 받기·파일로 넣기·닫기)', ['get', 'file', 'close'], await frame.evaluate(() => [...document.querySelectorAll('.gl-card [data-gl]')].map((b) => b.dataset.gl)), 'panel.ts'],
    ],
  });
  // 요청: 본체 없이 보낸 본편 요청에 플러그인 표식이 남는가
  const msgs = [{ role: 'system', content: '시스템' }, { role: 'assistant', content: '첫 장면 글\n%%GOEI_SCENE%%' }, { role: 'assistant', content: '상태 [▣|2025.03.14|11:20 PM|🌙|6°C|중림 지하상가|없음|없음|없음|관리국/신입|1000]' }, { role: 'user', content: '안녕' }];
  const out = await frame.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs);
  const leak = JSON.stringify(out).match(/%%GOEI_SCENE%%|\[▣/g) || [];
  record('C_본체없이_본편요청', {
    pressed: '받기 창을 닫지 않은 채 채팅에서 메시지 보냄 (본체 실패 1분 안)',
    fetched: await fetchedSince(),
    extra: '요청 전문(돌아온 값):\n' + JSON.stringify(out, null, 1),
    expect: [
      ['모델에 가는 요청에 플러그인 표식(%%GOEI_SCENE%%·[▣ 상태 줄)이 남지 않음', 0, leak.length, '점검지침 3-A 「플러그인 내부 표식이 새나」 · src/body.ts 머리 주석 「모델이 표식 글자를 보지 않게」 · src/main.ts onBeforeRequest (본체가 던지면 sanitize)'],
    ],
  });
  // 다시 받기 (아직 막힘)
  await frame.click('.gl-card [data-gl="get"]');
  await frame.waitForFunction(() => !document.querySelector('.gl-card button[disabled]'), null, { timeout: 15000 }).catch(() => {});
  const m1 = await frame.evaluate(() => document.querySelector('.gl-msg')?.textContent ?? '');
  record('C_다시받기_아직막힘', {
    pressed: '「다시 받기」 (아직 404)',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gl-card'),
    expect: [
      ['까닭 글이 보임', true, m1.length > 0, 'panel.ts run catch'],
      ['단추 다시 켜짐', 0, await frame.locator('.gl-card button[disabled]').count(), 'panel.ts'],
    ],
  });
  // 다시 받기 (열림)
  await frame.evaluate(() => { window.__net = true; });
  await frame.click('.gl-card [data-gl="get"]');
  const fab = await waitFab(frame, 30000);
  record('C_다시받기_성공', {
    pressed: '네트워크가 돌아온 뒤 「다시 받기」',
    fetched: await fetchedSince(),
    expect: [
      ['받기 창 닫힘', 0, await frame.locator('.gl-card').count(), 'src/main.ts install → closePanel'],
      ['유령 단추', true, fab, ''],
      ['본체·세계 자료 저장', [true, true], await frame.evaluate(() => [!!window.__store['p:goei:body'], !!window.__store['p:goei:data-world']]), ''],
    ],
  });
  await page.close();

  // C-2 다른 봇에서 햄버거 → 받기 실패 → 다시 받기 성공 → 설치 화면이 이어서 뜨나
  ({ page, frame, errors, fetchedSince } = await boot([otherBot()], 0, emptyChat(), { net: false }));
  await sleep(1500);
  await press(frame);
  await frame.waitForSelector('.gl-card', { timeout: 15000 }).catch(() => {});
  const hadPanel = await frame.locator('.gl-card').count();
  await frame.evaluate(() => { window.__net = true; });
  await frame.click('.gl-card [data-gl="get"]');
  await frame.waitForFunction(() => !document.querySelector('.gl-card'), null, { timeout: 30000 }).catch(() => {});
  await sleep(3000);
  record('C_다른봇_햄버거_받기실패후_다시받기', {
    pressed: '내 봇에서 「설치·업데이트」 → 받기 창 → (네트워크 복구) 「다시 받기」',
    fetched: await fetchedSince(),
    screen: (await text(frame, '.gw-install, .gx, .gl-card')).slice(0, 600),
    expect: [
      ['받기 창이 떴었음', 1, hadPanel, ''],
      ['받은 뒤 설치 화면이 이어서 뜸 (누른 단추의 목적)', true, (await frame.locator('.gw-install').count()) > 0, '근거 없음 — 물을 것 (src/main.ts registerButton 콜백은 ensure 가 null 이면 install() 을 부르지 않음)'],
    ],
  });
  await page.close();

  // C-3 파일로 넣기 (본체 → 세계 자료)
  ({ page, frame, errors, fetchedSince } = await boot([goeiCard()], 0, emptyChat(), { net: false }));
  await frame.waitForSelector('.gl-card', { timeout: 15000 });
  const fc1 = frame.page().waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await frame.click('.gl-card [data-gl="file"]');
  let chooser = await fc1;
  const tmpBody = '/tmp/claude/t17/goei-body.js';
  writeFileSync(tmpBody, bodyCode);
  if (chooser) await chooser.setFiles(tmpBody);
  await frame.waitForFunction(() => document.querySelector('[data-gl-world]') || /넣지 못|아니에요/.test(document.querySelector('.gl-msg')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
  const worldPanel = await frame.locator('[data-gl-world]').count();
  const panels = await frame.locator('.gl-card').count();
  record('C_파일로넣기_본체', {
    pressed: '받기 창 「파일로 넣기」 → goei-body.js',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gl-card'),
    expect: [
      ['파일 고르기 창이 열림', true, !!chooser, 'panel.ts picker'],
      ['세계 자료 받기 창으로 바뀜 (창 하나)', [1, 1], [worldPanel, panels], 'src/host/datapanel.ts · src/main.ts install (두 창이 겹치지 않게)'],
      ['본체 저장', true, await frame.evaluate(() => !!window.__store['p:goei:body']), 'main.ts install → save'],
    ],
  });
  const tmpWorld = '/tmp/claude/t17/goei-data-world.txt';
  writeFileSync(tmpWorld, worldPack);
  const fc2 = frame.page().waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await frame.click('[data-gl-world] [data-gl="file"]');
  chooser = await fc2;
  if (chooser) await chooser.setFiles(tmpWorld);
  const fab3 = await waitFab(frame, 30000);
  record('C_파일로넣기_세계자료', {
    pressed: '세계 자료 창 「파일로 넣기」 → goei-data-world.txt',
    fetched: await fetchedSince(),
    expect: [
      ['창 닫히고 유령 단추', [0, true], [await frame.locator('.gl-card').count(), fab3], 'datapanel.ts done → __goeiRelaunch'],
    ],
  });
  // 네트워크 막힌 채로 유령 단추 → 시작 화면 (인물 모습 팩은 못 받음)
  if (fab3) {
    await frame.click('[x-goei-fab] button');
    await frame.waitForSelector('.gx-fac', { timeout: 15000 }).catch(() => {});
    await frame.click('.gx-fac >> nth=0').catch(() => {});
    await sleep(2500);
    const scr = await text(frame, '.gx');
    record('C_파일로넣은뒤_시작화면', {
      pressed: '(네트워크 막힘 그대로) 유령 단추 → 첫 소속 누름',
      fetched: await fetchedSince(),
      screen: scr.slice(0, 1500),
      expect: [
        ['시작 화면이 뜸', true, (await frame.locator('.gx-fac').count()) > 0, 'release 안내 「자동으로 받지 못할 때」: 본체·세계 자료 둘만 넣으면 됨'],
        ['출발 단추가 막히지 않음 (아바타 팩을 못 받아도 출발, 전수검사 11-13)', false, await frame.evaluate(() => !!document.querySelector('.gx-start')?.disabled), 'src/ui/app.ts picker lookFailed'],
      ],
    });
  }
  await page.close();

  // C-4 올라온 본체가 다른 판
  for (const [label, v, want] of [['새판', '9.9.9', /플러그인이 옛 판/], ['옛판', '0.0.1', /아직 이 판의 본체가 올라오지 않았어요/]]) {
    const hook = `(n) => n === 'goei-body.json' ? JSON.stringify({ ...JSON.parse(${JSON.stringify(relText('goei-body.json'))}), version: ${JSON.stringify(v)} }) : undefined`;
    ({ page, frame, errors, fetchedSince } = await boot([goeiCard()], 0, emptyChat(), { hook }));
    await frame.waitForSelector('.gl-card', { timeout: 15000 }).catch(() => {});
    await frame.click('.gl-card [data-gl="get"]').catch(() => {});
    await frame.waitForFunction(() => /판|올라오지/.test(document.querySelector('.gl-msg')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {});
    const msg = await frame.evaluate(() => document.querySelector('.gl-msg')?.textContent ?? '');
    record(`C_올라온본체_${label}`, {
      pressed: `goei-body.json 의 판이 ${v} → 받기 창 → 「다시 받기」`,
      fetched: await fetchedSince(),
      screen: await text(frame, '.gl-card'),
      expect: [[`안내 ${want}`, true, want.test(msg), 'src/loader/body.ts fetchBody · core/stalever.ts (11-14 D-4)']],
    });
    await page.close();
  }

  // C-5 닫기 → 다른 카드 → 다시 괴이 카드
  ({ page, frame, errors, fetchedSince } = await boot([goeiCard(), otherBot()], 0, emptyChat(), { net: false }));
  await frame.waitForSelector('.gl-card', { timeout: 15000 });
  await frame.click('.gl-card [data-gl="close"]');
  const closed = await frame.locator('.gl-card').count();
  await frame.evaluate(() => { window.__charIndex = 1; });
  await sleep(1600);
  await frame.evaluate(() => { window.__charIndex = 0; });
  await frame.waitForSelector('.gl-card', { timeout: 8000 }).catch(() => {});
  record('C_닫기_다른카드_돌아오기', {
    pressed: '받기 창 「닫기」 → 다른 봇 → 괴이 카드로 돌아옴',
    fetched: await fetchedSince(),
    expect: [
      ['닫으면 창 없음', 0, closed, ''],
      ['카드를 다시 열면 받기 창이 다시 뜸', 1, await frame.locator('.gl-card').count(), 'src/main.ts failedAt 주석 「카드를 다시 열거나 1분이 지나야 다시 시도」'],
    ],
  });
  await page.close();
});

// ─────────────── D. 플러그인 업데이트 뒤 첫 시작 (저장소에 옛 본체·옛 세계 자료) ───────────────
await branch('D', '플러그인 업데이트 뒤 첫 시작', async () => {
  const oldBody = bodyCode.replace(/^\/\/ goei-body \S+/, '// goei-body 0.21.32');
  const oldWorld = worldPack.replace('"kind"', '"x":1,"kind"');
  const store = { 'p:goei:body': oldBody, 'p:goei:data-world': oldWorld, 'p:goei:data-install': 'old', 'p:goei:wikibase-digest': 'old-digest' };
  const { page, frame, fetchedSince } = await boot([goeiCard()], 0, emptyChat(), { store });
  const fab = await waitFab(frame, 30000);
  const f1 = await fetchedSince();
  record('D_옛본체_옛세계자료', {
    pressed: '플러그인을 새 판으로 바꾼 뒤 괴이 카드를 연다',
    fetched: f1,
    expect: [
      ['새 본체·새 세계 자료를 받아 뜸', true, fab, 'src/main.ts load (판이 다르면 다시 받는다)'],
      ['받은 것 = 본체 + 세계 자료', [...bodyFiles, ...worldFiles], f1.filter((n) => /goei-body|goei-data-world/.test(n)), ''],
      ['새 본체로 저장됨', `// goei-body ${VERSION}`, await frame.evaluate(() => window.__store['p:goei:body'].split('\n')[0]), ''],
    ],
    state: await state(frame),
  });
  await press(frame);
  await frame.waitForSelector('.gw-install', { timeout: 20000 }).catch(() => {});
  await frame.waitForFunction(() => /빠진 것|갖춰져/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
  const f2 = await fetchedSince();
  record('D_업데이트뒤_점검', {
    pressed: '「설치·업데이트」',
    fetched: f2,
    screen: await text(frame, '.gw-install'),
    expect: [['옛 설치 자료 대신 새 설치 자료를 받음', true, f2.includes('goei-data-install.json'), 'ensureInstallData (판이 다르면 다시 받기)']],
  });
  await page.close();
});

// ─────────────── E. 카드 업데이트 (괴이 카드 판이 낮음) ───────────────
await branch('E', '카드 업데이트', async () => {
  const card = goeiCard();
  const man = card.globalLore.find((e) => e.comment === 'Plugin manifest');
  man.content = JSON.stringify({ ...JSON.parse(man.content), version: '0.21.30' });
  const dir = card.globalLore.find((e) => e.comment === 'Directory');
  dir.content = dir.content.replace('"schema"', '"내가 고친 값": 1, "schema"');
  card.globalLore.push({ comment: '내가 넣은 로어북', content: '메모', key: '', mode: 'normal' });
  const store = { 'p:goei:body': bodyCode, 'p:goei:data-world': worldPack, 'p:goei:data-looks': looksPack };
  let { page, frame, fetchedSince } = await boot([card], 0, emptyChat(), { store });
  await waitFab(frame);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.upd-banner', { timeout: 15000 }).catch(() => {});
  record('E_유령단추_새버전띠', {
    pressed: '유령 단추 (카드 판 0.21.30, 올라온 판 0.21.33)',
    fetched: await fetchedSince(),
    screen: await text(frame, '.upd-banner'),
    expect: [['띠 「새 버전이 있어요 카드 v0.21.33」', true, /카드 v0\.21\.33/.test(await text(frame, '.upd-banner')), 'src/ui/update.ts updateBanner']],
  });
  await frame.click('[data-action="upd-go"]');
  await frame.waitForSelector('[data-action="upd-prepare"]', { timeout: 20000 }).catch(() => {});
  record('E_업데이트단추_설치페이지', {
    pressed: '띠의 「업데이트」',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gw-install .ps-group'),
    expect: [['카드 줄 v0.21.30 → v0.21.33 과 「카드 업데이트 준비」', 1, await frame.locator('[data-action="upd-prepare"]').count(), 'src/ui/update.ts updateGroup']],
  });
  await frame.click('[data-action="upd-prepare"]');
  await frame.waitForSelector('.upd-plan', { timeout: 60000 }).catch(() => {});
  record('E_준비', {
    pressed: '「카드 업데이트 준비」',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gw-install .ps-group'),
    expect: [
      ['계획 요약이 뜸', 1, await frame.locator('.upd-plan').count(), 'handleUpdate upd-prepare'],
      ['「카드에 적용」 단추', 1, await frame.locator('[data-action="upd-apply"]').count(), ''],
    ],
  });
  // 연타
  await frame.click('[data-action="upd-apply"]');
  await frame.click('[data-action="upd-apply"]', { force: true, timeout: 1000 }).catch(() => {});
  await frame.waitForFunction(() => /바꿨어요|못|않았어요/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
  const ch = await frame.evaluate(() => window.__chars[0]);
  const v = JSON.parse(ch.globalLore.find((e) => e.comment === 'Plugin manifest').content).version;
  record('E_적용_연타', {
    pressed: '「카드에 적용」 두 번 빠르게',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gw-install .ps-group'),
    state: await state(frame),
    expect: [
      ['카드 저장 한 번', 1, await frame.evaluate(() => window.__calls.setChar), 'handleUpdate busy'],
      ['카드 판 0.21.33', '0.21.33', v, ''],
      ['고친 명부 보존', true, /내가 고친 값/.test(ch.globalLore.find((e) => e.comment === 'Directory')?.content ?? ''), 'core/update.ts PROTECTED_LORE'],
      ['직접 넣은 로어북 유지', true, ch.globalLore.some((e) => e.comment === '내가 넣은 로어북'), 'mergeByName'],
      ['다 끝나면 준비 단추 없음 · 「최신이에요」', [0, true], [await frame.locator('[data-action="upd-prepare"]').count(), /최신이에요/.test(await text(frame, '.gw-install .ps-group'))], ''],
    ],
  });
  await page.close();

  // E-2 건너뛰기 → 페이지 새로고침해도 띠 안 뜸 (설정 점은 남음)
  ({ page, frame, fetchedSince } = await boot([card], 0, emptyChat(), { store }));
  await waitFab(frame);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.upd-banner', { timeout: 15000 }).catch(() => {});
  await frame.click('[data-action="upd-skip"]').catch(() => {});
  const gone = await frame.locator('.upd-banner').count();
  const skipStore = await frame.evaluate(() => window.__store);
  await page.close();
  ({ page, frame, fetchedSince } = await boot([card], 0, emptyChat(), { store: skipStore }));
  await waitFab(frame);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac, .gx-content', { timeout: 15000 }).catch(() => {});
  await sleep(2000);
  record('E_건너뛰기_새로고침', {
    pressed: '띠 「건너뛰기」 → 페이지 새로고침 → 유령 단추',
    fetched: await fetchedSince(),
    expect: [
      ['건너뛰면 띠 사라짐', 0, gone, 'updateBanner skipped'],
      ['새로고침 뒤에도 띠 없음', 0, await frame.locator('.upd-banner').count(), 'SKIP_KEY 저장 (goei:update-skip)'],
    ],
  });
  await page.close();

  // E-3 card-update 받기 실패 → 오류, 카드 그대로, 다시 누를 수 있음
  ({ page, frame, fetchedSince } = await boot([card], 0, emptyChat(), { store, hook: `(n) => /^card-update/.test(n) ? null : undefined` }));
  await waitFab(frame);
  await press(frame);
  await frame.waitForSelector('[data-action="upd-prepare"]', { timeout: 20000 }).catch(() => {});
  await frame.click('[data-action="upd-prepare"]').catch(() => {});
  await frame.waitForSelector('.gw-install .gx-err', { timeout: 150000 }).catch(() => {});
  record('E_준비_받기실패', {
    pressed: '「카드 업데이트 준비」 (card-update.json 404)',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gw-install .ps-group'),
    expect: [
      ['오류 글', 1, await frame.locator('.gw-install .gx-err').count(), 'handleUpdate catch'],
      ['카드 그대로', 0, await frame.evaluate(() => window.__calls.setChar), ''],
      ['다시 누를 수 있음', 1, await frame.locator('[data-action="upd-prepare"]:not([disabled])').count(), ''],
    ],
  });
  await page.close();

  // E-4 커스텀 임무로 출발 → 첫 지시문을 보내기 전(커스텀 임무 · 첫 장면 고르기 화면)에 「설치·업데이트」 → 준비
  ({ page, frame, fetchedSince } = await boot([card], 0, emptyChat(), { store }));
  await waitFab(frame);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac', { timeout: 15000 });
  await frame.click('.gx-fac >> nth=0');
  await frame.click('.gx-sc:has-text("커스텀 임무")');
  await sleep(500);
  await frame.click('.gx-start');
  await sleep(3000);
  if (!(await frame.evaluate(() => /커스텀 임무 · 첫 장면 고르기/.test(document.querySelector('.gx')?.innerText ?? '')))) {
    await frame.click('[x-goei-fab] button').catch(() => {});
    await sleep(2000);
  }
  const viewNow = await frame.evaluate(() => (document.querySelector('.gx')?.innerText ?? '').slice(0, 80));
  await fetchedSince();
  await press(frame);
  await frame.waitForSelector('[data-action="upd-check"]', { timeout: 20000 }).catch(() => {});
  const hasPrep = await frame.locator('[data-action="upd-prepare"]').count();
  if (hasPrep) await frame.click('[data-action="upd-prepare"]');
  else await frame.click('[data-action="upd-check"]').catch(() => {});
  await sleep(4000);
  const f = (await fetchedSince()).filter((n) => !n.startsWith('goei-data-install'));
  record('E_첫장면고르기화면에서_업데이트', {
    pressed: '시작 화면에서 「커스텀 임무」로 출발 → (커스텀 임무 · 첫 장면 고르기 화면) 「설치·업데이트」 → 「카드 업데이트 준비」(없으면 「새 버전 확인」)',
    fetched: f,
    screen: `열린 화면 머리: ${viewNow}\n` + (await text(frame, '.gw-install .ps-group')),
    expect: [['커스텀 임무 고르기 화면이었음', true, /커스텀 임무/.test(viewNow), 'src/ui/app.ts view opening'], ['「카드 업데이트 준비」가 동작 (card-update.json 받음)', true, f.includes('card-update.json'), 'src/ui/update.ts handleUpdate']],
  });
  await page.close();
});

// ─────────────── F. 폰 크기: 다른 봇에서 설치 · 받기 창 ───────────────
await branch('F', '폰 크기 (412×915, 터치)', async () => {
  const vp = { width: 412, height: 915 };
  let { page, frame, fetchedSince } = await boot([goeiCard()], 0, emptyChat(), { net: false, viewport: vp, touch: true });
  await frame.waitForSelector('.gl-card', { timeout: 15000 }).catch(() => {});
  const box = await frame.evaluate(() => { const c = document.querySelector('.gl-card')?.getBoundingClientRect(); const bs = [...document.querySelectorAll('.gl-act button')].map((b) => b.getBoundingClientRect()); return c ? { w: c.width, right: c.right, bottom: c.bottom, col: bs.length === 3 && bs[0].top < bs[1].top } : null; });
  await page.screenshot({ path: `${OUT}폰_받기창.png` });
  record('F_폰_받기창', {
    pressed: '폰에서 괴이 카드 열기 (받기 404)',
    fetched: await fetchedSince(),
    screen: JSON.stringify(box),
    expect: [
      ['창이 화면 안 (가로 넘침 없음)', true, !!box && box.right <= vp.width && box.w <= vp.width, 'panel.ts @media (max-width:520px)'],
      ['단추 세로로 쌓임', true, !!box?.col, 'panel.ts .gl-act column'],
    ],
  });
  await frame.evaluate(() => { window.__net = true; });
  await frame.tap('.gl-card [data-gl="get"]');
  const fab = await waitFab(frame, 30000);
  record('F_폰_다시받기', { pressed: '「다시 받기」 탭', fetched: await fetchedSince(), expect: [['유령 단추', true, fab, '']] });
  await page.close();
  ({ page, frame, fetchedSince } = await boot([otherBot()], 0, emptyChat(), { viewport: vp, touch: true, store: { 'p:goei:body': bodyCode, 'p:goei:data-world': worldPack, 'p:goei:data-looks': looksPack } }));
  await sleep(1500);
  await press(frame);
  await frame.waitForSelector('[data-action="ed-inst-all"]', { timeout: 20000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}폰_설치화면.png` });
  const over = await frame.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await frame.tap('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /끝났어요|안 된 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 300000 }).catch(() => {});
  const scr = await text(frame, '.gw-install');
  await page.screenshot({ path: `${OUT}폰_설치끝.png` });
  record('F_폰_다른봇설치', {
    pressed: '폰에서 내 봇 「설치·업데이트」 → 「괴이 ː ANOMALY 설치」 탭',
    fetched: [`(받은 파일 ${(await fetchedSince()).length}개)`],
    screen: scr,
    expect: [
      ['가로 넘침 없음', false, over, 'CLAUDE.md 폰 배치'],
      ['모두 갖춰짐', true, /모두 갖춰져 있어요/.test(scr), ''],
    ],
  });
  await page.close();
});

// ─────────────── G. 내 봇에 설치한 카드의 카드 업데이트 · 받는 도중 창 닫기 ───────────────
await branch('G', '내 봇 카드 업데이트 · 위키 새 판', async () => {
  if (!charAfterB || !storeAfterB) { console.log('B 갈래가 먼저 돌아야 함 — 건너뜀'); return; }
  const card = JSON.parse(JSON.stringify(charAfterB));
  const man = card.globalLore.find((e) => e.comment === 'Plugin manifest');
  man.content = JSON.stringify({ ...JSON.parse(man.content), version: '0.21.30' });
  card.desc = '내가 쓴 봇 설명';
  let { page, frame, fetchedSince } = await boot([card], 0, emptyChat(), { store: storeAfterB });
  await waitFab(frame);
  await press(frame);
  await frame.waitForSelector('[data-action="upd-prepare"]', { timeout: 20000 }).catch(() => {});
  await frame.click('[data-action="upd-prepare"]').catch(() => {});
  await frame.waitForSelector('[data-action="upd-apply"]', { timeout: 60000 }).catch(() => {});
  const plan = await text(frame, '.upd-plan');
  await frame.click('[data-action="upd-apply"]').catch(() => {});
  await frame.waitForFunction(() => /바꿨어요/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
  const ch = await frame.evaluate(() => window.__chars[0]);
  const m2 = JSON.parse(ch.globalLore.find((e) => e.comment === 'Plugin manifest').content);
  record('G_내봇_카드업데이트', {
    pressed: '내 봇(설치한 봇, 판 0.21.30) 「설치·업데이트」 → 준비 → 적용',
    fetched: await fetchedSince(),
    screen: plan,
    state: await state(frame),
    expect: [
      ['봇 설명·첫 메시지·인사말 그대로', [card.desc, card.firstMessage, card.alternateGreetings.length], [ch.desc, ch.firstMessage, ch.alternateGreetings.length], 'core/update.ts 사용자 2026-11-14 D-1 (가)'],
      ['판만 올림, source 없음', ['0.21.33', undefined], [m2.version, m2.source], 'ownManifest'],
      ['이름 그대로', card.name, ch.name, ''],
    ],
  });
  await page.close();
  // 위키 기본 문서 새 판 (받아 둔 지문이 다름)
  const st2 = { ...storeAfterB, 'p:goei:wikibase-digest': 'old' };
  ({ page, frame, fetchedSince } = await boot([charAfterB], 0, emptyChat(), { store: st2 }));
  await waitFab(frame);
  await press(frame);
  await frame.waitForFunction(() => /빠진 것|갖춰져/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
  const scr = await text(frame, '.gw-install');
  record('G_위키새판', {
    pressed: '위키 지문이 다른 저장소로 「설치·업데이트」',
    fetched: await fetchedSince(),
    screen: scr,
    expect: [['위키 기본 문서 「새 판 있음」', true, /새 판 있음/.test(scr), 'src/ui/editor/install.ts (사용자 11-14 D-3)']],
  });
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /끝났어요|안 된 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
  record('G_위키새판_다시받기', {
    pressed: '「빠진 것 전부 채우기」',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gw-install'),
    expect: [['모두 갖춰짐', true, /모두 갖춰져 있어요/.test(await text(frame, '.gw-install')), '']],
  });
  await page.close();
});

// ─────────────── H. 세계 자료만 못 받음 (본체는 저장소에 있음) ───────────────
await branch('H', '세계 자료 받기 갈래', async () => {
  const store = { 'p:goei:body': bodyCode };
  const hook = `(n) => n === 'goei-data-world.json' ? JSON.stringify({ ...JSON.parse(${JSON.stringify(relText('goei-data-world.json'))}), version: '9.9.9', hash: 'ffffffff' }) : undefined`;
  let { page, frame, fetchedSince } = await boot([goeiCard()], 0, emptyChat(), { store, hook });
  await frame.waitForSelector('[data-gl-world]', { timeout: 20000 }).catch(() => {});
  const msg = await frame.evaluate(() => document.querySelector('[data-gl-world] .gl-msg')?.textContent ?? '');
  record('H_세계자료_새판만올라옴', {
    pressed: '괴이 카드 열기 (본체는 저장소, 세계 자료 목록은 새 판 9.9.9)',
    fetched: await fetchedSince(),
    screen: await text(frame, '.gl-card'),
    expect: [
      ['본체의 세계 자료 받기 창 하나', [1, 1], [await frame.locator('[data-gl-world]').count(), await frame.locator('.gl-card').count()], 'src/host/datapanel.ts'],
      ['까닭 = 플러그인 업데이트 안내', true, /플러그인이 옛 판/.test(msg), 'src/host/datapack.ts fetchPack (11-14 D-4)'],
    ],
  });
  // 닫기 → 메시지 표시(조용한 재시작) 1분 뒤 → 창 안 뜸, 카드 다시 열기 → 뜸
  await frame.click('[data-gl-world] [data-gl="close"]');
  await frame.evaluate(() => { window.__fetchHook = null; window.__net = false; });
  await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">ANOMALY SIMULATION</div>'));
  await sleep(500);
  record('H_닫기_표시', {
    pressed: '「닫기」 → 채팅 메시지가 다시 그려짐(1분 안)',
    fetched: await fetchedSince(),
    expect: [['창이 다시 뜨지 않음', 0, await frame.locator('.gl-card').count(), 'datapanel.ts showWorldDataPanel (닫은 뒤 조용한 재시작은 띄우지 않음)']],
  });
  await frame.evaluate(() => { window.__net = true; });
  await press(frame);
  await waitFab(frame, 8000);
  await frame.waitForSelector('.gw-install', { timeout: 4000 }).catch(() => {});
  const fH = await fetchedSince();
  record('H_네트워크복구_햄버거', {
    pressed: '(네트워크 복구, 닫은 지 1분 안) 「설치·업데이트」',
    fetched: fH,
    screen: await text(frame, '.gl-card'),
    expect: [
      ['세계 자료를 다시 받으려 함 (사용자가 누른 시작)', true, fH.some((n) => n.startsWith('goei-data-world')), '근거 없음 — 물을 것 (host/datapack.ts loadWorldData: 1분 억제를 넘는 것은 받기 창의 「다시 받기」만)'],
    ],
  });
  if (await frame.locator('[data-gl-world] [data-gl="get"]').count()) {
    await frame.click('[data-gl-world] [data-gl="get"]');
    await waitFab(frame, 20000);
    await frame.waitForSelector('.gw-install', { timeout: 5000 }).catch(() => {});
  }
  record('H_받기창_다시받기', {
    pressed: '받기 창 「다시 받기」',
    fetched: await fetchedSince(),
    expect: [
      ['세계 자료를 받고 본체가 뜸', true, await fabShown(frame), 'datapanel.ts done → __goeiRelaunch'],
      ['설치 화면이 이어서 뜸 (처음 누른 단추의 목적)', 1, await frame.locator('.gw-install').count(), '근거 없음 — 물을 것 (C_다른봇 단계와 같은 질문)'],
    ],
  });
  await page.close();
});

await browser.close();
server.close();
const prev = existsSync(`${OUT}결과.json`) ? JSON.parse(readFileSync(`${OUT}결과.json`, 'utf8')) : [];
writeFileSync(`${OUT}결과_${only.join('')}.json`, JSON.stringify(results, null, 1));
console.log(`\n단계 ${results.length} · 통과 ${results.filter((r) => r.ok).length}`);
