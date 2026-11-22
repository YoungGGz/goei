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

// 15) 괴담톡: 연락처 → 1:1 보내기·답장 → 새 메시지 확인(선톡·단톡 초대·공지) → 단톡 만들기 → 전화 → 본편 반영 → 자동 확인
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.waitForSelector('.ph');
  const tabs = await page.$$eval('.ph-tabs .ph-tab', (b) => b.map((x) => x.firstChild.textContent));
  assert.ok((await page.$$eval('.ph-tabs .ph-tab small', (b) => b.map((x) => Number(x.textContent))))[0] > 0, '소속 칩 옆 연락처 수');
  assert.deepEqual(tabs, ['관리', '중립', '기타'], '관리국 소속에 공개된 탭');
  const first = await page.getAttribute('.ph-list [data-action="ph-dm"]', 'data-value');
  assert.equal(first, 'c_50303031', 'P001 쟈알디');
  // 검색: 목록만 다시 그린다
  await page.fill('.ph-search', '스팡달');
  assert.equal(await page.locator('.ph-content [data-action="ph-dm"]').count(), 1);
  assert.ok((await page.textContent('.ph-content .ph-sec')).startsWith('연락처'), '통합 검색: 연락처 묶음');
  await page.fill('.ph-search', '');
  if (shots) await page.screenshot({ path: `${shots}/15-phone-contacts.png` });
  // 1:1 대화: 내 말은 먼저 저장, 답장은 패치로
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.waitForSelector('.ph-room');
  await page.fill('[data-input="ph-draft"]', '팀장님, 현장 도착했습니다.');
  const patch = '<lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"확인. 무리하지 마.","sender":"c_50303031","type":"text"}},{"op":"add","path":"/messages/-","value":{"content":"[[ATTACH:photo]]현장 약도[[/ATTACH]]","sender":"c_50303031","type":"text"}}]</lb-minitalk-patch>';
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, patch);
  await page.click('[data-action="ph-send"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$ph_state || '').includes('현장 도착했습니다'));
  await page.waitForSelector('.ph-msg.npc >> text=무리하지 마', { timeout: 5000 });
  assert.equal(await page.locator('.ph-msg.npc .at-card-photo').count(), 1, '첨부는 따로 한 말풍선');
  let st = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  const dm = st.rooms.dm_c_50303031;
  assert.deepEqual(dm.messages.map((m) => m.sender), ['me', 'c_50303031', 'c_50303031']);
  assert.equal(dm.unread, 0, '보고 있는 방은 바로 읽음');
  assert.equal(dm.pending, undefined);
  assert.equal(dm.messages[0].time, '2025.01.01 02:47');
  const call0 = await page.evaluate(() => window.__calls.llm[0]);
  assert.equal(call0.mode, 'submodel');
  assert.ok(call0.messages[0].content.includes('send: reply to the owner'));
  assert.ok(!call0.messages[0].content.includes('__LIMIT_'));
  const body0 = JSON.parse(call0.messages[1].content);
  assert.equal(body0.room.action.type, 'send');
  assert.equal(body0.participants[0].narratorOnlyAgentStatus.state, '작전투입', '요원 상태 참고');
  assert.ok(!/\b[A-E]00\b/.test(call0.messages[1].content), '소속 코드는 이름으로');
  if (shots) await page.screenshot({ path: `${shots}/15-phone-room.png` });
  // 답장 실패: 기록은 남고 다시 시도
  await page.fill('[data-input="ph-draft"]', '알겠습니다');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '알았다고 말함' }]; });
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('[data-action="ph-retry"]', { timeout: 5000 });
  assert.ok((await page.textContent('.nw-fail')).includes('알았다고 말함'), '실패 원문 보관');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<lb-minitalk-patch>[]</lb-minitalk-patch>' }]; });
  await page.click('[data-action="ph-retry"]');
  await page.waitForFunction(() => !JSON.parse(window.__chat.scriptstate.$ph_state).rooms.dm_c_50303031.pending, null, { timeout: 5000 });
  // 전체 새 메시지 확인: 선톡 + 단톡 초대 + 공지 한 번에
  await page.click('[data-action="ph-back"]');
  const refresh = JSON.stringify({
    updates: [{ room: 'dm_c_50303032', patch: [{ op: 'add', path: '/messages/-', value: { content: '선배 지금 어디예요?', sender: 'c_50303032', type: 'text' } }] }],
    announcements: [{ issuer: '관리국 총무과', category: '시설', title: '지하 2층 출입 통제', text: '배관 공사로 오늘 하루 통제합니다.' }],
    invitations: [{ inviter: 'c_50303032', members: ['c_50303032', 'c_50303033'], name: '야간조 수다방', patch: [{ op: 'add', path: '/messages/-', value: { content: '선배도 초대했어요ㅋㅋ', sender: 'c_50303032', type: 'text' } }] }],
  });
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, refresh);
  await page.click('[data-action="ph-refresh"]');
  await page.waitForSelector('.gn-notice >> text=메시지 2개 · 단톡 초대 1개 · 공지 1개', { timeout: 5000 });
  const call2 = await page.evaluate(() => window.__calls.llm[window.__calls.llm.length - 1]);
  const body2 = JSON.parse(call2.messages[1].content);
  assert.ok(body2.rooms.length > 10, '공개된 연락처 전체를 후보로');
  assert.ok(body2.crossRoomMessages === undefined || Array.isArray(body2.crossRoomMessages));
  assert.ok(call2.messages[0].content.includes('REFRESH OUTPUT CONTRACT'));
  st = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  assert.equal(st.rooms.dm_c_50303032.unread, 1);
  const group = Object.values(st.rooms).find((r) => r.kind === 'group');
  assert.equal(group.name, '야간조 수다방');
  assert.equal(group.messages[0].kind, 'invite');
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  assert.equal(ss.$cooldown_received_incoming, '1');
  assert.equal(ss.$cooldown_received_invitation, '1');
  assert.equal(ss.$cooldown_received_announcement, '1');
  assert.ok((await page.textContent('[data-action="ph-sub"][data-value="chats"]')).includes('3'), '대화 탭 안 읽음 수 (선톡 1 + 초대 1 + 단톡 말풍선 1)');
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  assert.ok((await page.textContent('.ph-list')).includes('야간조 수다방'));
  assert.ok((await page.$$('.ph-chats .ph-rdel')).length >= 2, '대화 목록 휴지통');
  if (shots) {
    await page.screenshot({ path: `${shots}/15-phone-chats.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${shots}/15-phone-chats-mobile.png` });
    await page.setViewportSize(vp);
  }
  // 공지: 열면 읽음
  await page.click('[data-action="ph-sub"][data-value="notices"]');
  await page.click('[data-action="ph-notice"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$ph_bulletins).items[0].read === true);
  assert.ok((await page.textContent('.ph-ndoc-text, .ph-notice-body')).includes('배관 공사'));
  // 받은 직후 다시 확인: 대기 중인 선톡·초대·공지는 빼고, 이미 대화 중인 방(내가 마지막에 말한 방·단톡)만 묻는다
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{"updates":[],"announcements":[],"invitations":[]}' }]; });
  await page.click('[data-action="ph-refresh"]');
  await page.waitForSelector('.gn-notice >> text=새 메시지가 없어요', { timeout: 5000 });
  const again = JSON.parse(await page.evaluate(() => window.__calls.llm[window.__calls.llm.length - 1].messages[1].content));
  assert.deepEqual(again.rooms.map((r) => r.id).sort(), [group.id, 'dm_c_50303031'].sort());
  assert.equal(again.announcementCheck.allowed, false);
  assert.equal(again.invitationCheck.allowed, false);
  // 단톡 만들기: 이름·주제와 함께. 모델이 이름을 바꾸려 해도 정한 이름이 남고, 지문 같은 대기 줄은 버린다
  await page.click('[data-action="ph-sub"][data-value="contacts"]');
  await page.click('[data-action="ph-group"]');
  await page.click('[data-action="ph-pick"][data-value="c_50303031"]');
  await page.click('[data-action="ph-pick"][data-value="c_50303034"]');
  await page.fill('[data-input="ph-topic"]', '내일 합동 조사 준비');
  await page.fill('[data-input="ph-gname"]', '야간조');
  if (shots) {
    await page.screenshot({ path: `${shots}/14-group-new.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${shots}/14-group-new-mobile.png` });
    await page.setViewportSize(vp);
  }
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<lb-minitalk-patch>[{"op":"replace","path":"/name","value":"합동 조사"},{"op":"add","path":"/messages/-","value":{"content":"-","sender":"-","type":"pause"}},{"op":"add","path":"/messages/-","value":{"content":"송주익이 기겁하며 급하게 메시지를 연타한다.","sender":"-","type":"pause"}},{"op":"add","path":"/messages/-","value":{"content":"자료는 내가 올릴게.","sender":"c_50303034","type":"text"}}]</lb-minitalk-patch>' }]; });
  await page.click('[data-action="ph-group-create"]');
  await page.waitForSelector('.ph-room-title b >> text=야간조', { timeout: 5000 });
  assert.ok(!(await page.textContent('.ph-room')).includes('기겁하며'), '지문 대기 줄은 보이지 않는다');
  const call3 = JSON.parse(await page.evaluate(() => window.__calls.llm[window.__calls.llm.length - 1].messages[1].content));
  assert.equal(call3.room.action.type, 'invite_initial');
  assert.equal(call3.room.privateDirection, '내일 합동 조사 준비');
  assert.ok(call3.crossRoomMessages.some((m) => m.content.includes('무리하지 마')), '같은 사람의 다른 방 대화를 기억');
  // 전화: 기록을 남기고 창을 닫는다 → 화면은 카드, 요청은 본문
  await page.click('[data-action="ph-back"]');
  await page.click('[data-action="ph-sub"][data-value="contacts"]');
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.click('.ph-room [data-action="ph-call"]');
  await page.fill('[data-input="ph-call-text"]', '현장 상황 보고');
  await page.click('[data-action="ph-call-place"]');
  await page.waitForFunction(() => window.__chat.message.at(-1).data.includes('%%PHONE_CALL:'));
  await page.waitForFunction(() => document.querySelector('.gx').style.display === 'none');
  const rec = await page.evaluate(() => window.__chat.message.at(-1).data);
  const card = await page.evaluate((r) => window.__calls.handlers.display(r), rec);
  assert.ok(card.includes('쟈알디') && card.includes('전화를 걸었다') && !card.includes('현장 상황 보고'));
  // 전화 기록 뒤 user 글은 채팅에 실제로 덧붙인 글일 때만 통화 내용으로 합친다 (전수검사 11-13 pipeline#7: 기록이 채팅 마지막이면 뒤 글은 프리셋)
  const req = await page.evaluate(async (r) => {
    window.__chat.message.push({ role: 'user', data: '빨리 받아' });
    try {
      return window.__core(await window.__calls.replacers[0]([{ role: 'user', content: r }, { role: 'user', content: '빨리 받아' }], 'model'));
    } finally {
      if (window.__chat.message.at(-1)?.data === '빨리 받아') window.__chat.message.pop();
    }
  }, rec);
  assert.equal(req[req.length - 1].content, '{{user}} places a phone call to 쟈알디.\n\n현장 상황 보고\n\n빨리 받아');
  // 본편 반영: 대화·공지가 마지막 사용자 메시지 바로 앞 system 메시지로
  // 사용자 메시지 앞 system 들 가운데 (소지품 [Inventory] 등 다른 기능 글도 붙는다, 11-07)
  const ctx = req.slice(0, -1).find((m) => m.role === 'system' && String(m.content).includes('"feature":"phone"'));
  assert.ok(ctx, '괴담톡 기록이 사용자 메시지 앞 system 에 있다');
  assert.ok(ctx.content.includes('"feature":"phone"') && ctx.content.includes('선배 지금 어디예요?') && ctx.content.includes('지하 2층 출입 통제'));
  // 자동 확인: 본편 응답이 끝나면 한 번 (같은 응답에는 다시 안 함)
  // 인물 기록(기본 켬)도 응답마다 보조 모델을 부르므로 이 절은 괴담톡 호출만 세게 끈다
  await page.evaluate(() => { window.__chat.scriptstate.$ph_auto = '1'; window.__chat.scriptstate.$cooldown_received_incoming = '-5'; window.__chat.scriptstate.$pp_on = '0'; });
  const n0 = await page.evaluate(() => window.__calls.llm.length);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{"updates":[],"announcements":[],"invitations":[]}' }]; });
  const fire = () => page.evaluate(async () => {
    const c = window.__chat;
    if (c.message.at(-1).role !== 'char') c.message.push({ role: 'char', data: '통화가 연결됐다.' });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  await fire();
  await page.waitForFunction((n) => window.__calls.llm.length === n + 1, n0, { timeout: 5000 });
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_auto_last);
  await new Promise((r) => setTimeout(r, 400));
  await fire();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 1, '같은 응답에는 한 번만');
  // 창을 열 때: 본편 응답 뒤에는 안 부르고, 괴담톡 탭을 열 때 한 번
  await page.evaluate(() => {
    const c = window.__chat;
    c.scriptstate.$ph_auto = 'open';
    c.scriptstate.$cooldown_received_incoming = '-5';
    c.message.push({ role: 'user', data: '다음' }, { role: 'char', data: '새 장면이 열렸다.' });
    window.__llm = [{ type: 'success', result: '{"updates":[],"announcements":[],"invitations":[]}' }];
  });
  await fire();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 1, '창을 열 때 모드는 본편 응답 뒤에 안 부름');
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.waitForFunction((n) => window.__calls.llm.length === n + 2, n0, { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 2, '같은 응답에는 한 번만');
  await page.waitForSelector('.ph');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/15-phone-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('PASS 괴담톡: 연락처·1:1 답장·재시도·새 메시지 확인(선톡·초대·공지)·단톡·전화·본편 반영·자동 확인(매 턴·창을 열 때)');
  await page.close();
}


await browser.close();