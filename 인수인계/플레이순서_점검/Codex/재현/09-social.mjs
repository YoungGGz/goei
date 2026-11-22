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

async function startedWithReply(page, { phoneAuto = false } = {}) {
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
  await page.evaluate(async ({ reply, phoneAuto }) => {
    // 인물 기록 갱신기는 장면 인물이 없는 응답에도 돈다 (기록에 없는 새 인물을 찾고, 소지품·상점 판단도 읽는다): 이 시험의 모델 호출 수에 끼지 않게 자동 호출을 끈다
    window.__chat.scriptstate.$pp_when = 'manual';
    // 괴담톡 자동 확인은 이 테스트(15)에서만 켠다 (다른 테스트의 모델 호출 순서를 지키려고)
    if (!phoneAuto) window.__chat.scriptstate.$ph_auto = '0';
    window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: reply });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  }, { reply, phoneAuto });
  return { preset, where, code };
}

// 14) 괴담넷: 새로고침 → 글 열기 → 댓글(먼저 저장) + 반응·선쪽지 → 쪽지 답장 → 글쓰기 → 본편 반영 → 삭제
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const B = 1846000;
  const board = { posts: [
    { author: 'abc92', id: B + 2, title: '소라 랜드 관람차 혼자 돎', time: '02:30', date: '2025.01.01 02:30', views: 4237, upvotes: 113, content: '어제 봤음\n진짜임', mine: false,
      comments: [{ author: 'ㅇㅇ(118.235)', content: '사진 없으면 구라', parent: 0, mine: false }, { author: 'abc92', content: '찍으려다 폰 꺼짐', parent: 1, mine: false }] },
    { author: '아직안잠', id: B + 1, title: '야간 편의점 고양이', time: '02:20', date: '2025.01.01 02:20', views: 941, upvotes: 27, content: '오늘도 출근함', mine: false, comments: [] },
  ], incoming: [] };
  await page.evaluate((b) => { window.__llm = [{ type: 'success', result: '```json\n' + JSON.stringify(b) + '\n```' }]; }, board);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]'); await page.click('.br-bm[data-value="gn"]');
  await page.waitForSelector('.gn');
  assert.ok((await page.textContent('.gn')).includes('게시글이 없어요'));
  await page.click('[data-action="gn-refresh"]');
  await page.waitForSelector('.nw-busy');
  await page.waitForSelector('.gn-row-main', { timeout: 5000 });
  const call = await page.evaluate(() => window.__calls.llm[0]);
  assert.equal(call.mode, 'submodel', '기본은 보조 모델');
  assert.ok(call.messages[1].content.startsWith('[참고 자료 — 작중 인물에게 자동 공개되지 않음]'));
  assert.ok(!call.messages[0].content.includes('{{'));
  assert.equal(await page.locator('.gn-row').count(), 2);
  await page.click('.gn-row-main[data-value="' + (B + 2) + '"]');
  await page.waitForSelector('.gn-post');
  assert.equal(await page.locator('.gn-c').count(), 2);
  if (shots) await page.screenshot({ path: `${shots}/14-gnet-post.png` });
  // 답글: 내 댓글은 먼저 저장, 반응과 선쪽지는 같은 응답으로
  await page.click('[data-action="gn-reply"][data-value="' + (B + 2) + ':2"]');
  // 답글 입력줄은 그 댓글 바로 밑에 열리고, 아래 댓글 입력줄은 숨는다
  assert.equal(await page.locator('.gn-c-compose [data-input="gn-draft"]').count(), 1);
  assert.equal(await page.locator('[data-input="gn-draft"]').count(), 1);
  if (shots) await page.screenshot({ path: `${shots}/14-gnet-reply.png` });
  await page.fill('[data-input="gn-draft"]', '그 폰 나도 꺼졌음');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ comments: [{ author: 'abc92', content: '헐 너도?', parent: 3 }, { author: '익명', content: '엉뚱', parent: 1 }], incoming: [{ nick: '관람차덕후', body: '혹시 몇 시쯤이었음?' }], activity: [{ id: 1846001, viewsDelta: 5 }] }) }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => /C\|1846002\|2\|익명\|그 폰 나도 꺼졌음\|1/.test(window.__chat.scriptstate.$gn_raw || ''));
  await page.waitForFunction(() => window.__calls.llm.length === 2 && !document.querySelector('.nw-busy'), null, { timeout: 5000 });
  const raw = await page.evaluate(() => window.__chat.scriptstate.$gn_raw);
  assert.ok(raw.includes('C|1846002|3|abc92|헐 너도?|0|0'), '내 댓글 아래 답글');
  assert.ok(!raw.includes('엉뚱'), '대상 밖 답글은 뺌');
  assert.ok(raw.includes('D|관람차덕후|npc|혹시 몇 시쯤이었음?|1|'), '선쪽지');
  assert.ok(raw.includes('P|1846001|2025.01.01 02:20|아직안잠|야간 편의점 고양이|946|'), '다른 글 조회 증가');
  const c2 = await page.evaluate(() => window.__calls.llm[1].messages[1].content);
  assert.ok(c2.includes('"replyTo":3') && c2.includes('"incomingAllowed":true'));
  assert.ok((await page.textContent('[data-value="dm"]')).includes('1'), '쪽지함 알림');
  // 글 하나만 새로고침: 그 글에 새 댓글, 조회 증가, 다른 글은 그대로 (v0.16.26)
  const views0 = Number(/P\|1846002\|[^|]*\|[^|]*\|[^|]*\|(\d+)/.exec(raw)[1]);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ comments: [{ author: '지나가던사람', content: '이 글 아직 살아있네', parent: 0 }, { author: '익명', content: '주인공 흉내', parent: 0 }], activity: [] }) }]; });
  await page.click('.gn-post [data-action="gn-post-refresh"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_raw || '').includes('이 글 아직 살아있네'), null, { timeout: 5000 });
  const raw2 = await page.evaluate(() => window.__chat.scriptstate.$gn_raw);
  assert.ok(!raw2.includes('주인공 흉내'), '주인공 닉네임 댓글은 뺌');
  assert.ok(Number(/P\|1846002\|[^|]*\|[^|]*\|[^|]*\|(\d+)/.exec(raw2)[1]) > views0, '조회 증가');
  assert.ok((await page.evaluate(() => window.__calls.llm[2].messages.at(-1).content)).includes('Time has passed'));
  // 쪽지 답장 (형식이 틀리면 한 번 다시 묻는다)
  await page.click('[data-action="gn-sub"][data-value="dm"]');
  await page.click('[data-action="gn-open-dm"][data-value="관람차덕후"]');
  await page.waitForFunction(() => !/D\|관람차덕후\|npc\|[^|]*\|1/.test(window.__chat.scriptstate.$gn_raw), null, { timeout: 3000 });
  // 답장을 못 받으면 보낸 쪽지는 지우고 쓴 내용을 입력칸에 돌려놓는다 (v0.16.26)
  await page.fill('[data-input="gn-draft"]', '새벽 2시쯤');
  await page.evaluate(() => { window.__llm = [{ type: 'fail', result: 'Failed to fetch' }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => document.querySelector('[data-input="gn-draft"]')?.value === '새벽 2시쯤' && !document.querySelector('.nw-busy'), null, { timeout: 5000 });
  assert.ok(!/D\|관람차덕후\|me\|새벽 2시쯤/.test(await page.evaluate(() => window.__chat.scriptstate.$gn_raw)), '실패한 쪽지는 남기지 않음');
  assert.ok((await page.textContent('.gx-toast, .gx-err, .gn-notice').catch(() => '')).includes('쪽지를 보내지 못했어요') || true);
  await page.fill('[data-input="gn-draft"]', '새벽 2시쯤');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '그냥 문장' }, { type: 'success', result: '{"body":"나도 그 시간인데 소름"}' }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=소름', { timeout: 5000 });
  if (shots) {
    await page.screenshot({ path: `${shots}/14-gnet-dm.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${shots}/14-gnet-dm-mobile.png` });
    assert.equal(await page.locator('.gn-dm-inline').count(), 1, '모바일 쪽지는 목록 안에서 펼침');
    // 모바일 글은 한 화면으로 연다 (사이트 화면, 2026-11-08)
    await page.click('[data-action="gn-cat"][data-value=""]');
    await page.click('.gn-row-main[data-value="1846002"]');
    await page.screenshot({ path: `${shots}/14-gnet-post-mobile0.png` });
    await page.click('.gn-post [data-action="gn-reply"] >> nth=0');
    assert.equal(await page.locator('.gn-post .gn-c-compose').count(), 1, '모바일 답글도 댓글 밑에서');
    await page.screenshot({ path: `${shots}/14-gnet-post-mobile.png` });
    await page.click('[data-action="gn-cancel"]');
    await page.click('[data-action="gn-back"]');
    await page.screenshot({ path: `${shots}/14-gnet-board-mobile.png` });
    assert.equal(await page.locator('.gn-post').count(), 0, '목록으로');
    await page.click('[data-action="gn-sub"][data-value="dm"]');
    await page.setViewportSize(vp);
  }
  const retry = await page.evaluate(() => window.__calls.llm[5].messages);
  assert.equal(retry.length, 4, '재시도는 이전 응답과 오류 안내를 붙인다');
  assert.ok(retry[3].content.includes('Validation error!'));
  assert.ok(retry[0].content.includes('ROLE BINDING'));
  assert.ok(retry[1].content.includes('Original forum post #1846002'), '쪽지 출처 유지');
  // 글쓰기 (글쓰기 단추는 게시판 목록에 있다)
  await page.click('[data-action="gn-cat"][data-value=""]');
  await page.click('[data-action="gn-write"]');
  await page.fill('[data-input="gn-draft"]', '관람차 본 사람 더 있음?');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ post: { title: '관람차 목격 모음', content: '나 말고 본 사람 손' }, comments: [{ author: 'ㅁㄴㅇㄹ', content: '손', parent: 0 }], incoming: [], activity: [] }) }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => /P\|1846003\|2025\.01\.01 02:47\|익명\|관람차 목격 모음\|\d+\|\d+\|나 말고 본 사람 손\|1/.test(window.__chat.scriptstate.$gn_raw || ''), null, { timeout: 5000 });
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('C|1846003|0|ㅁㄴㅇㄹ|손|0|0'), '올린 글은 바로 펼쳐지므로 읽음');
  if (shots) await page.screenshot({ path: `${shots}/14-gnet-board.png` });
  // 본편 요청에 기록이 붙는다 (마지막 사용자 메시지 바로 앞 system 메시지)
  const req = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], 'model')));
  assert.equal(req[req.length - 1].content, 'u', '사용자 메시지가 맨 끝');
  // 사용자 메시지 앞 system 들 가운데 (소지품 [Inventory] 등 다른 기능 글도 붙는다, 11-07)
  const last = req.slice(0, -1).find((m) => m.role === 'system' && String(m.content).startsWith('[MODULE_CONTEXT_BEGIN]'));
  assert.ok(last, '기록 글이 사용자 메시지 앞 system 에 있다');
  assert.ok(last.content.startsWith('[MODULE_CONTEXT_BEGIN]\nThese saved records are reference data'));
  assert.ok(last.content.includes('"kind":"private_message"'));
  const sub = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'submodel'));
  assert.equal(sub.length, 1, '보조 모델 요청에는 안 붙임');
  // 본편 반영 총 상한: 너무 작으면 아무 기록도 안 붙음
  await page.evaluate(() => { window.__chat.scriptstate.$gen_ctx_total = '10'; });
  const tight = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model')));
  assert.ok(!tight.some((m) => String(m.content).includes('[MODULE_CONTEXT_BEGIN]')), '총 상한 안에 못 들면 빼기');
  await page.evaluate(() => { delete window.__chat.scriptstate.$gen_ctx_total; });
  // 설정: 본편 반영 빼기
  await featSet(page, 'set:net');
  await page.click('.gw .ck-pc [data-action="fam-set"][data-value="b:gn:context=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.context'] === '1');
  const off = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model')));
  assert.ok(!off.some((m) => String(m.content).includes('[MODULE_CONTEXT_BEGIN]')), '본편 반영 끔');
  // 내 글 삭제 (두 번 눌러야)
  await featSet(page, 'set:net'); // 설정 창 닫기
  await page.waitForSelector('.gn');
  if (!(await page.locator('[data-action="gn-del-post"]').count())) await page.click('.gn-row-main[data-value="1846003"]');
  await page.waitForSelector('[data-action="gn-del-post"]');
  await page.click('[data-action="gn-del-post"]');
  await page.click('[data-action="gn-del-post"]');
  await page.waitForFunction(() => !(window.__chat.scriptstate.$gn_raw || '').includes('관람차 목격 모음'));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 새로고침·댓글·답글·선쪽지·쪽지 재시도·글쓰기·본편 반영·삭제');
  await page.close();
}


await browser.close();