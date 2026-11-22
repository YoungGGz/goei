// QC 전수 점검 · 플러그인 창 안 기능 모듈 (괴담넷·괴담톡·위키·상황판·가계부·인물 기록·공통 보조 호출). 보고서 docs/qc/04_modules.md
// 사용법: node tests/qc-modules-browser.mjs <fixture.json> [screenshot-dir]   (fixture: tests/make_fixture.py). ONLY=G1,P2 로 절만 골라 돌린다
// 호스트 흉내(hostScript·boot·open)는 tests/browser.mjs 와 같다. 모델 응답은 window.__llm 큐에 넣어 흉내 낸다.
import { createRequire } from 'node:module';
import { distPack, distWorldPack } from '../../../../tests/data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from '../../../../tests/soft-assert.mjs';
import { gzipSync } from 'node:zlib';

// 설정 창의 괴담넷 페이지 열기/닫기 (2026-10-29: 판 안 설정 단추 없음)
async function featSet(page, node) {
  const open = await page.evaluate(() => { const g = document.querySelector('.gw'); return !!(g && !g.hidden); });
  if (open) {
    await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]').click());
    await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
    return;
  }
  await page.click('.gx-nav .gx-nb.desk[data-action="ed-open"]');
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  await page.evaluate(() => document.querySelector('.gw [data-action="ed-tab"][data-value="set"]')?.click());
  await page.waitForFunction((n) => !!document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`), node);
  await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`).click(), node);
  await page.waitForFunction((n) => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === n, node);
}


const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shots = process.argv[3];
const fixtureDir = dirname(resolve(process.argv[2]));
if (shots) mkdirSync(shots, { recursive: true });
const plugin = readFileSync(process.env.PLUGIN || new URL('../../../../dist/goei-plugin.js', import.meta.url), 'utf8');

// 본체는 시작기가 pluginStorage에서 꺼낸다. 따로 시험하는 곳(noBody) 말고는 미리 넣어 둔다
const bodyCode = readFileSync(new URL('../../../../dist/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
const worldPack = distWorldPack();
// 아바타 팩: 내 페르소나로 시작하려면 아바타가 있어야 출발 (2026-11-08 사용자). browser.mjs 와 같이 저장소에 미리 둔다
const looksPack = distPack('goei-data-looks');
function hostScript(char, chat, { rootDom = true, noBody = false } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {} };
    // SafeElement 흉내. Risu와 똑같이 addEventListener는 요소가 아니라 document 전체에 건다.
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
    if (!${noBody}) window.__store['p:goei:body'] = ${JSON.stringify(bodyCode)};
    if (!${noBody}) window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};
    if (!${noBody}) window.__store['p:goei:data-looks'] = ${JSON.stringify(looksPack)};
    window.__rootDoc = ${rootDom} ? { querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)) } : null;
    window.__char = ${JSON.stringify(char)};
    window.__liteChar = window.__char;
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.risuai = {
      registerButton: async (arg, cb) => { window.__button = { arg, cb }; return { id: arg.id }; },
      registerSetting: async (name, cb) => { window.__setting = cb; return { id: 's' }; },
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async (m) => { (window.__calls.send = window.__calls.send || []).push({ m, last: window.__chat.message?.at(-1)?.data }); if (window.__sendFail) throw new Error('Sending chat with plugin-based model is currently blocked'); return true; },
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: { getItem: async (k) => window.__store['p:' + k] ?? null, setItem: async (k, v) => { window.__store['p:' + k] = v; }, keys: async () => [], removeItem: async (k) => { delete window.__store['p:' + k]; } },
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
      getCharacterFromIndex: async () => clone(window.__char),
      setCharacterToIndex: async (i, c) => { window.__calls.setChar = (window.__calls.setChar || 0) + 1; window.__char = clone(c); },
      // 두 번째 채팅(__chat1)을 두면 채팅 번호 1 은 그쪽 (창이 보는 채팅과 다른 채팅의 자동 확인 시험)
      getChatFromIndex: async (c, i) => { if (i === 1 && window.__chat1) return clone(window.__chat1); window.__calls.reads = (window.__calls.reads ?? 0) + 1; return clone(window.__chat); },
      setChatToIndex: async (a, b, chat) => { if (b === 1 && window.__chat1) { window.__chat1 = clone(chat); return; } window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async (o) => { window.__calls.llm = window.__calls.llm || []; window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 150)); const next = (window.__llm || []).shift(); return next ?? { type: 'fail', result: 'no mock' }; },
      getCurrentLorebookEntries: async () => clone([...(window.__char.globalLore || []), ...(window.__moduleLore || [])]),
      getDatabase: async () => ({ modules: window.__modules || [], enabledModules: (window.__modules || []).map((m) => m.id) }),
      readImage: async (p) => { (window.__calls.read = window.__calls.read || []).push(p); if (window.__assets[p]) return window.__assets[p]; const b64 = await window.__readAsset(p); if (!b64) throw new Error('no asset'); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\{\{user\}\}/g, window.__userName ?? '{{user}}'),
      nativeFetch: async (url) => { (window.__calls.fetch = window.__calls.fetch || []).push(url); const r = window.__fetch && window.__fetch(String(url)); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => (r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r))).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    window.__assets = {};`;
}

const browser = await chromium.launch();
// 실패하면 브라우저를 닫고 바로 끝낸다 (열린 브라우저 때문에 멈춘 채 남지 않게)
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
async function boot(char, chat, viewport = process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : { width: 1100, height: 900 }, opts = {}) {
  const page = await browser.newPage({ viewport, ...(opts.touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.exposeFunction('__readAsset', (p) => {
    try { return readFileSync(new URL(p, `file://${fixtureDir}/`)).toString('base64'); } catch { return null; }
  });
  await import('./observe.mjs').then(m=>m.observe(page)); await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"><button id="other" style="margin:40px">다른 버튼</button></div></body></html>');
  // 실제 Risu 플러그인 창은 allow-forms 없는 iframe이라 form 제출 이벤트가 아예 일어나지 않는다
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(char, chat, opts) });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
  return { page, errors };
}
// 플로팅 버튼이 뜰 때까지 기다렸다가(접속 효과 포함) 누른다
async function open(page) {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 6000 });
  await page.click('[x-goei-fab] button');
}

// ── 공통 도우미 ──
// ONLY=G1,P1 처럼 절을 골라 돌릴 수 있다
const want = (id) => !process.env.ONLY || process.env.ONLY.split(',').includes(id);

/** A00으로 시작하고 첫 응답(상황판 태그 포함)을 넣어 「진행 중」 상태로. 창은 닫아 둔다 */
async function startedWithReply(page, { phoneAuto = false, gnetAuto = false, people = false } = {}) {
  await open(page);
  await page.waitForSelector('.gx-fac');
  await page.click('.gx-fac[data-value="A00"]');
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length === 1);
  const world = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_world));
  const preset = world.an.find((e) => e.kind === 'preset');
  const geo = JSON.parse(readFileSync(new URL('../../../../src/data/geo.json', import.meta.url), 'utf8'));
  const [code, idx] = preset.loc.split('-');
  const where = `${geo.sido[code]} ${geo.sigun[code][Number(idx)]}`;
  const reply = [`본문`, `[AN|${where}|${preset.name}|활성|A|P001]`, '[AG|P001|작전투입|현장]', '[AG|P002|휴게|사무실]', '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]'].join('\n');
  await page.evaluate(async ({ reply, phoneAuto, gnetAuto, people }) => {
    if (!phoneAuto) window.__chat.scriptstate.$ph_auto = '0';
    if (!gnetAuto) window.__chat.scriptstate['$lb_cfg_lb-gn.lazy'] = '1';
    // 인물 기록 갱신기는 장면 인물이 없는 응답에도 돈다 (기록에 없는 새 인물을 찾고, 소지품·상점 판단도 읽는다).
    // 인물 기록을 보지 않는 시험은 모델 호출 수에 끼지 않게 자동 호출을 끈다.
    // 보는 시험(people)은 이 첫 응답에 빈 답을 줘서 읽음으로 넘기고, 갱신기가 인물만 읽게 소지품 읽기·상점 판단은 맡기지 않는다
    if (!people) window.__chat.scriptstate.$pp_when = 'manual';
    else {
      window.__chat.scriptstate.$it_auto = '0';
      window.__chat.scriptstate.$sh_judge = 'main';
      window.__llm = [{ type: 'success', result: '{}' }];
    }
    window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: reply });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  }, { reply, phoneAuto, gnetAuto, people });
  return { preset, where, code };
}
// 창은 열 때 채팅을 다시 읽는다: 밖에서(시험이) 채팅 값을 바꾼 뒤엔 닫았다 다시 연다 (마지막 탭으로 열린다)
async function reopen(page) {
  const reads = await page.evaluate(() => window.__calls.reads ?? 0);
  await page.locator('[data-action="close"]:visible').first().click();
  await open(page);
  // 창이 채팅을 다시 읽고 그릴 때까지 (옛 화면에 누르면 클릭이 사라진다)
  await page.waitForFunction((n) => (window.__calls.reads ?? 0) > n, reads);
  await wait(300);
}
// PC 메뉴는 보고 있는 탭을 한 번 더 누르면 상황판으로 간다 (사용자 2026-10-21) → 이미 그 탭이면 누르지 않는다
const nav = async (page, id) => {
  const bm = { gnet: 'gn', wiki: 'wk' }[id];
  if (bm) {
    if (!(await page.locator('.br-bms').count())) await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]');
    await page.click(`.br-bm[data-value="${bm}"]`);
    return;
  }
  const sel = `.gx-nav .gx-nb:not(.mob)[data-value="${id}"]`;
  if (!(await page.locator(`${sel}.on`).count())) await page.click(sel);
};
const llm = (page, list) => page.evaluate((l) => { window.__llm = l; }, list);
const llmCount = (page) => page.evaluate(() => (window.__calls.llm ?? []).length);
const ok = (s) => ({ type: 'success', result: s });
const fail = (s = 'Failed to fetch') => ({ type: 'fail', result: s });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (page) => page.waitForFunction(() => !document.querySelector('.nw-busy'), null, { timeout: 8000 });
/** 다음 본편 응답이 들어온 것처럼 output 처리기를 부른다 */
async function fireOutput(page, text = '다음 장면이 이어졌다.') {
  return page.evaluate(async (t) => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '계속' }, { role: 'char', data: t });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  }, text);
}
const B = 1846000;
const post = (id, over = {}) => ({ author: `n${id}`, id: B + id, title: `제목 ${id}`, time: '02:30', date: '2025.01.01 02:30', views: 10, upvotes: 1, content: `본문 ${id}`, mine: false, comments: [], ...over });

// ═══════════ 괴담넷 ═══════════

if (want('WL2')) {
  const chat = { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|출근|-|-|관리국/요원|₩ 140,000]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $ph_auto: '0', $pp_on: '0' } };
  const { page, errors } = await boot(fixture, chat, { width: 390, height: 844 }, { touch: true });
  await open(page);
  await page.waitForSelector('.gx-hwallet');
  assert.ok((await page.textContent('.gx-hwallet')).includes('140,000'), '머리 잔고 = 시작 잔고 14만');
  await page.tap('.gx-hwallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-hwallet').count(), 1, '가계부 화면 안에서도 머리 단추 유지 (2026-11-05 사용자)');
  assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.tab), 'items', '가계부는 소지품 탭 안 (2026-11-07 사용자: 가계부는 소지품 메뉴의 하위 탭)');
  await page.tap('.gx-nav .gx-nb.home[data-value="board"]');
  await page.tap('.gx-idbtn');
  await page.waitForSelector('.gx-idpop .gx-wallet');
  await page.tap('.gx-idpop .gx-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-idpop').count(), 0, 'ID카드 창은 닫힘');
  // 잔고 칸 끔
  await page.evaluate(() => { window.__chat.scriptstate.$st_col_wallet = 'off'; });
  await page.tap('.gx-nav .gx-nb.home[data-value="board"]');
  await reopen(page);
  await page.waitForSelector('.gx-head'); // (이 채팅은 상황판 없이 시작해 상황판 자리엔 「상황판 켜기」 안내)
  assert.equal(await page.locator('.gx-hwallet').count(), 0, '잔고 칸을 끄면 머리 잔고 없음');
  assert.equal(await page.locator('.gx-nb[data-value="wallet"]').count(), 0, '가계부 메뉴 없음');
  assert.deepEqual(errors, []);
  console.log('PASS 가계부: 모바일 머리 잔고·ID카드 칩');
  await page.close();
}
await browser.close();
