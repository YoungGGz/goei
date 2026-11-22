// 실제 Chromium에서 플러그인 번들을 Risu와 같은 방식(async 함수 안)으로 실행하고
// 가짜 risuai API로 시작 화면 → 저장까지 확인한다.
// 사용법: node tests/browser.mjs <fixture.json> [screenshot-dir]
import { createRequire } from 'node:module';
import { distPack, distPackFiles, distWorldPack } from '../../../../tests/data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shots = process.argv[3];
const fixtureDir = dirname(resolve(process.argv[2]));
if (shots) mkdirSync(shots, { recursive: true });
const plugin = readFileSync(process.env.PLUGIN || new URL('../../../../dist/goei-plugin.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fixture.globalLore.find((e) => e.comment === 'Plugin manifest').content);

// 본체는 시작기가 pluginStorage에서 꺼낸다. 따로 시험하는 곳(noBody) 말고는 미리 넣어 둔다
const bodyCode = readFileSync(new URL('../../../../dist/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
const worldPack = distWorldPack();
// 아바타 팩: 내 페르소나로 시작하려면 아바타가 있어야 출발 (2026-11-08 사용자)
const looksPack = distPack('goei-data-looks');
function hostScript(char, chat, { rootDom = true, noBody = false, prefs = null } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {} };
    // SafeElement 흉내. Risu와 똑같이 addEventListener는 요소가 아니라 document 전체에 건다.
    const listeners = new Map();
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { if (!k.startsWith('x-')) throw new Error('x- only'); el.setAttribute(k, v); },
      setInnerHTML: async (h) => { el.innerHTML = String(h).replace(/^\\s*(<style[\\s\\S]*?<\\/style>\\s*)+/i, ''); el.querySelectorAll('[class],[style]').forEach((x) => { x.removeAttribute('class'); x.removeAttribute('style'); }); }, // 실제 Risu 처럼 맨 앞 <style> 과 class·style 속성은 지워진다 (11-11 진행 창 안쪽이 모양 없이 나옴)
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
    if (${JSON.stringify(prefs)}) window.__store['p:goei:prefs'] = JSON.stringify(${JSON.stringify(prefs)});
    if (!${noBody}) window.__store['p:goei:body'] = ${JSON.stringify(bodyCode)};
    if (!${noBody}) window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};
    if (!${noBody}) window.__store['p:goei:data-looks'] = ${JSON.stringify(looksPack)};
    window.__rootDoc = ${rootDom} ? { ...wrap(document.documentElement), querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)) } : null;
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
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async (o) => { window.__calls.llm = window.__calls.llm || []; window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 150)); const next = (window.__llm || []).shift(); return next ?? { type: 'fail', result: 'no mock' }; },
      getCurrentLorebookEntries: async () => clone([...(window.__char.globalLore || []), ...(window.__moduleLore || [])]),
      getDatabase: async () => ({ modules: window.__modules || [], enabledModules: (window.__modules || []).map((m) => m.id) }),
      readImage: async (p) => { (window.__calls.read = window.__calls.read || []).push(p); if (window.__assets[p]) return window.__assets[p]; const b64 = await window.__readAsset(p); if (!b64) throw new Error('no asset'); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\{\{user\}\}/g, window.__userName ?? '{{user}}'),
      nativeFetch: async (url) => { (window.__calls.fetch = window.__calls.fetch || []).push(url); const r = window.__fetch && window.__fetch(String(url)); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => (r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r))).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    window.__assets = {};
    // 플러그인이 본편 요청에 끼우는 로어북 덩어리·이미지 지침(2026-10-27~)을 뺀 나머지. 요청 흐름 시험이 그 밖의 것만 보게
    window.__core = (r) => r.filter((m) => !(m.role === 'system' && typeof m.content === 'string' && (m.content.startsWith('<!-- goei:lore -->') || m.content.startsWith('## Inserting Character Visual Images'))));`;
}

const browser = await chromium.launch();
// 실패하면 브라우저를 닫고 바로 끝낸다 (열린 브라우저 때문에 멈춘 채 남지 않게)
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
async function boot(char, chat, viewport = process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : { width: 1920, height: 1080 }, opts = {}) {
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
  await page.click('[x-goei-fab] button:not([data-vs])');
}
// 상황 그림 카드: 띠를 눌러 상세 창을 열고, 창 안의 버튼(지도·목표로 고르기·종료 등)을 누른다
// 상황판(관제실): 일지 행을 눌러 큰 보기로 띄우고, 큰 보기의 버튼을 누른다
async function cardAction(page, name, action, scope = '') {
  if (scope !== '.gx-map' && await page.locator(`.gx-board li.gx-oprow:has-text("${name}")`).count()) {
    await page.click(`.gx-board li.gx-oprow:has-text("${name}")`);
    await page.click(`.gx-opview [data-action="${action}"]`);
    return;
  }
  if (!(await page.locator('.ev-pop').count())) await page.click(`${scope} li.gx-evc:has-text("${name}")`);
  await page.click(`.ev-pop [data-action="${action}"]`);
}
// 커스텀 목록: 그림 띠를 눌러 펼친 뒤 「이 …로 선택」 (2026-10-20 그림 카드)
// 커스텀 임무 화면으로 (2026-10-29: 왼쪽 메뉴의 「커스텀」이 없어져 임무 탭의 전환 단추로)
async function goMission(page) {
  // 시작 전(첫 장면 고르기)의 커스텀 목록도 .gx-mission 이라, 시작 뒤 창(메뉴)이 그려진 다음 지금 탭으로 판단한다
  await page.waitForSelector('.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  if (await page.evaluate(() => document.querySelector('.gx')?.dataset.tab === 'mission' && !!document.querySelector('.gx-mission'))) return;
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  await page.waitForSelector('.gx-mswap[data-value="mission"]');
  await page.click('.gx-mswap[data-value="mission"]');
  await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'mission' && !!document.querySelector('.gx-mission'));
}
async function pickCustom(page, row = '.gx-mlist li.gx-mx') {
  await page.locator(`${row} [data-action="mission-open"]`).first().click();
  const goal = () => page.evaluate(() => document.querySelector('.gx-goal b')?.textContent.trim() ?? null);
  const before = await goal();
  await page.click('.gx-mlist li.gx-mx.open [data-action="mission-pick"]');
  // 잠금 효과(ui/evcard AIM_LOCK_MS) 뒤에 목표가 바뀌고 편성 단계로 (11-07: 1.5초). 시간을 박지 않고 목표가 바뀔 때까지
  await page.waitForFunction((b) => (document.querySelector('.gx-goal b')?.textContent.trim() ?? null) !== b, before);
}

// 설정 창(2026-10-27 개편: 별도 창 .gw 하나, 탭 기능·세계·지침·점검 + 왼쪽 목록의 페이지 노드)
const edTabOf = (n) => (n.startsWith('guide:') || n.startsWith('rule:') ? 'guide' : n === 'install' || n === 'set:update' || n.startsWith('manage:') ? 'manage' : n.startsWith('set:') ? 'set' : 'world');
// 목록은 폰(600px 이하)에서 서랍에 숨으므로 DOM 에서 누른다 (tests/qc-settings-harness.mjs goNode 와 같음)
/** 설정 창 바로 저장(2026-11-08 사용자)이 끝날 때까지: 고친 것 없음 + 저장 중 아님 */
async function edSaved(page) {
  await page.waitForTimeout(50);
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hasAttribute('data-dirty') && !g.querySelector('.gw-top .gw-save-state'); }, null, { timeout: 15000 });
}
async function edGo(page, node) {
  await page.evaluate((t) => { if (!document.querySelector('.gw .gw-tree-item.on')?.closest('.gw-tree')?.querySelector(`[data-action="ed-node"]`) || document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]:not(.on)`)) document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(); }, edTabOf(node));
  await page.waitForFunction((n) => !!document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`), node);
  await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`).click(), node);
  await page.waitForFunction((n) => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === n, node);
}
// 진행 중 채팅: 메뉴의 「설정」 / 시작 전: 「새 채팅 기본 설정」(prefs-open). 열면 화면 페이지에서 시작한다
async function edOpen(page, node, { pre = false } = {}) {
  await page.click(pre ? '.gx [data-action="prefs-open"]' : '.gx-nav .gx-nb.desk[data-action="ed-open"]');
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  if (node) await edGo(page, node);
}
// 2026-10-29 사용자: 각 메뉴의 설정 단추를 없앴다(설정은 메인 설정 창만). 옛 「판 안 설정 켜고 끄기」 자리는 설정 창의 그 기능 페이지를 열고 닫는 것으로
async function featSet(page, node) {
  const open = await page.evaluate(() => { const g = document.querySelector('.gw'); return !!(g && !g.hidden); });
  if (open) {
    await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]').click());
    await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
  } else {
    await edOpen(page, node);
    await page.waitForSelector('.gw .gw-setbody');
  }
}
async function edClose(page) {
  await page.click('.gw .gw-top [data-action="ed-close"]');
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
}
const stepShown = (page, action, key) => page.evaluate(([a, k]) => document.querySelector(`.gw [data-action="${a}"][data-value="${k}:+"]`)?.closest('.st-step')?.querySelector('b')?.textContent ?? '', [action, key]);

// 5) 시드 수명: beforeRequest 리플레이서
{
  const { page } = await boot(fixture, { message: [{ role: 'user', data: 'a' }], scriptstate: {} });
  const msgs = [{ role: 'system', content: 'x %%SEED%%\nS\n%%/SEED%%\ny' }];
  const first = await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs);
  assert.equal(first[0].content, 'x S\ny');
  const sub = await page.evaluate((m) => window.__calls.replacers[0](m, 'submodel'), msgs);
  assert.equal(sub[0].content, msgs[0].content, '보조 모델 요청은 건드리지 않음');
  await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: 'b' }, { role: 'user', data: 'c' }); });
  const second = await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs);
  assert.equal(second[0].content, 'x y');
  assert.equal(await page.evaluate(() => window.__calls.setChat.length), 0, '요청 중에는 저장하지 않음');
  console.log('PASS 시드: 첫 전송 유지, 두 번째 전송부터 제거');
  await page.close();
}

// 12) 커스텀 임무로 시작: 빈 인사말 → 목표 고르기 → 첫 장면 지시문, 진행 중 채팅의 커스텀 임무 요청
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.click('.gx-fac[data-value="A00"]');
  await page.click('.gx-sc[data-value="9"]');
  await page.click('.gx-start');
  await page.waitForSelector('.gx-search');
  const saved = await page.evaluate(() => window.__chat);
  assert.equal(fixture.alternateGreetings[saved.fmIndex], '', '빈 첫 장면');
  assert.equal(saved.message.length, 0);
  assert.equal(await page.isDisabled('[data-action="mission-send"]'), true);
  // 검색은 괴이·특수·거점을 한꺼번에: 괴이 칸에서 거점 이름을 찾아도 나온다
  await page.click('[data-action="mission-kind"][data-value="lm"]');
  const lmName = (await page.textContent('.gx-mlist li.gx-ev b')).trim();
  await page.click('[data-action="mission-kind"][data-value="an"]');
  await page.fill('.gx-search', lmName);
  await page.waitForFunction(() => [...document.querySelectorAll('.gx-mlist li.gx-mgrp')].some((h) => h.textContent.startsWith('거점')));
  await page.fill('.gx-search', '소라');
  await page.waitForFunction(() => document.querySelector('.gx-mlist li.gx-mgrp')?.textContent.startsWith('괴이'));
  await pickCustom(page);
  // 위 종류 버튼을 바꿔 봐도 고른 목표는 그대로
  await page.click('[data-action="mission-kind"][data-value="lm"]');
  assert.equal((await page.textContent('.gx-goal b')).trim(), '소라 랜드');
  assert.equal(await page.isDisabled('[data-action="mission-send"]'), false);
  assert.equal((await page.textContent('[data-action="mission-send"]')).trim(), '작전 개시');
  if (shots) await page.screenshot({ path: `${shots}/12-mission-opening.png` });
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 1);
  const chat = await page.evaluate(() => window.__chat);
  assert.ok(chat.message[0].data.includes('This is the first message of a new story') && chat.message[0].data.includes('Subject: 소라 랜드'), chat.message[0].data);
  const w = JSON.parse(chat.scriptstate.$goei_world);
  assert.equal(w.pending.an, '소라 랜드');
  assert.match(chat.scriptstate.$an_report, /NEW \[AN\|<발생 지역: 시도와 시군구>\|소라 랜드\|활성/);
  // 보내기 전(지시문만 놓임)에는 다시 열면 고르기 화면: 다른 대상으로 바꾸면 지시문·요청이 새 것으로
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.waitForSelector('.gx-search');
  assert.equal(await page.locator('.gx-nav').count(), 0, '아직 플레이 화면 아님');
  await page.click('[data-action="mission-kind"][data-value="ms"]');
  await pickCustom(page);
  const site0 = (await page.textContent('.gx-goal b')).trim();
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction((n) => window.__chat.message.length === 1 && window.__chat.message[0].data.includes(n), site0);
  {
    const w2 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_world));
    assert.equal(w2.pending.an, undefined, '바꾼 뒤 예전 요청은 취소');
    assert.equal(w2.pending.ms, site0);
  }
  // 일반 첫 장면으로 다시 고르면 지시문은 지워진다
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.waitForSelector('[data-action="repick"]');
  await page.click('[data-action="repick"]');
  await page.waitForSelector('.gx-fac.on');
  await page.click('.gx-sc[data-value="1"]');
  await page.click('.gx-start');
  // 일반 첫 장면은 플러그인이 첫 장면 메시지 하나를 넣는다 (2026-11-05, 추가 인사말 대신)
  await page.waitForFunction(() => window.__chat.message.length === 1 && window.__chat.message[0].data.includes('%%GOEI_SCENE%%') && window.__chat.scriptstate.$st_fm === '1');
  // 다시 커스텀 임무로 (아래 시험을 이어가려고): 첫 장면이 들어간 채팅은 「다시 고르기」를 거친다
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.waitForSelector('[data-action="repick"], .gx-sc');
  if (await page.locator('[data-action="repick"]').count()) await page.click('[data-action="repick"]');
  await page.waitForSelector('.gx-sc');
  await page.click('.gx-sc[data-value="9"]');
  await page.click('.gx-start');
  await page.waitForSelector('.gx-search');
  await page.fill('.gx-search', '소라');
  await page.waitForFunction(() => document.querySelector('.gx-mlist li.gx-mgrp')?.textContent.startsWith('괴이'));
  // 찾기 결과가 다시 그려지기 전의 목록을 고를 수 있어 (가끔 실패), 소라 랜드 줄이 보일 때까지 기다린다
  await page.waitForFunction(() => [...document.querySelectorAll('.gx-mlist li.gx-mx')].every((li) => li.textContent.includes('소라')));
  await pickCustom(page);
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 1 && window.__chat.message[0].data.includes('소라 랜드'));
  // 첫 전송은 시드를 유지 (지시문 + 덧붙인 글 = 한 번)
  await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '더' }));
  const seeded = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'system', content: 'x %%SEED%%\nS\n%%/SEED%%\ny' }], 'model'));
  assert.equal(seeded[0].content, 'x S\ny');
  // 진행 중 채팅: 커스텀 임무 탭에서 미스틱 사이트 요청
  await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '응답' }); const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await goMission(page);
  await page.click('[data-action="mission-kind"][data-value="ms"]');
  await pickCustom(page);
  const site = (await page.textContent('.gx-goal b')).trim();
  // 다른 탭에 다녀와도 고른 목표 유지
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]'); await page.click('.br-bm[data-value="wk"]');
  await goMission(page);
  assert.equal((await page.textContent('.gx-goal b')).trim(), site, '탭 이동 뒤에도 목표 유지');
  if (shots) await page.screenshot({ path: `${shots}/12-mission-tab.png` });
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 4);
  const after = await page.evaluate(() => window.__chat);
  assert.ok(after.message[3].data.includes('Continue the current scene') && after.message[3].data.includes(site));
  assert.equal(JSON.parse(after.scriptstate.$goei_world).pending.ms, site);
  // 요청 취소
  await open(page);
  // 이미 커스텀 탭이면 다시 누르지 않는다 (한 번 더 누르면 상황판으로 간다)
  await goMission(page);
  // 호출 진행 창은 상황판 위에도 뜬다 (11-11). 도는 동안 펼쳐진 창이 1100px 화면에서 이 단추를 가리므로 머리줄을 눌러 접고 누른다 (사용자도 그렇게 한다)
  if (await page.evaluate(() => document.querySelector('[x-goei-prog]')?.getAttribute('x-goei-open') === 'true')) {
    const g = await page.locator('[x-goei-prog] [data-grip]').boundingBox();
    await page.mouse.click(g.x + 40, g.y + 6);
    await page.waitForFunction(() => document.querySelector('[x-goei-prog]').getAttribute('x-goei-open') === 'false');
    await page.waitForTimeout(300);
  }
  await page.click('[data-action="mission-cancel"][data-value="ms"]');
  await page.waitForFunction(() => !JSON.parse(window.__chat.scriptstate.$goei_world).pending.ms);
  // 목록의 「위키」: 위키 탭의 그 제목으로
  await page.click('.gx-mlist li:first-child [data-action="wiki-goto"]');
  await page.waitForSelector('.wk-compose, .wk-docp .wk-head'); // 카드 기본 문서가 있으면 바로 문서, 없으면 작성 화면
  assert.equal((await page.textContent('.gx-nb.on:not(.mob)')).trim(), '인터넷');
  assert.equal((await page.textContent('.wk-h1')).trim(), site);
  assert.deepEqual(errors, []);
  console.log('PASS 커스텀 임무: 시작 첫 장면 지시문, 진행 중 요청, 요청 취소');
  await page.close();
}


await browser.close();console.log('PASS 시작 시드·커스텀 임무·플레이 중 목표 전환');