// 3차 점검 T2 조종: 실제 리스AI(vite dev) + 괴이 플러그인·카드(이 판 release/) + 가짜 모델 서버(fake-llm.mjs).
// 사용:
//   node risu-t2.mjs check [--stream both|on|off] [--via plain|proxy2] [--w 1280 --h 800 | --w 344 --h 882]   0단계 확인 (a)~(e) 를 돌려 out/check-<via>-<WxH>-*.json·png 에 적는다 (폭 600 미만이면 터치)
//   node risu-t2.mjs serve [--port 7101] [--via plain|proxy2]            브라우저를 띄워 둔 채 HTTP 로 조종 (POST /op {op, ...args})
//   다른 점검 스크립트에서:  import { openT2 } from './risu-t2.mjs'; const t = await openT2({...}); await t.setup(); await t.start(); await t.send('…');
// 환경: RISU_URL (기본 http://127.0.0.1:5180), FAKE_URL (기본 http://<컨테이너IP>:8790), GOEI_REL (기본 /home/user/goei/release/)
// 모델 길 (리스AI 소스 996a553 로 확인, T2_사용법.md 참고):
//   본편 aiModel=reverse_proxy, forceReplaceUrl=FAKE_URL/main/v1/chat/completions
//   보조 subModel=xcustom:::t2-aux, customModels[0].url=FAKE_URL/aux/v1/chat/completions
//   --via plain : usePlainFetch 켬 → 브라우저가 가짜 서버로 바로 요청(스트리밍 조각이 실제로 조각으로 옴). 플러그인 nativeFetch 도 바로 감.
//   --via proxy2: usePlainFetch 끔(실제 웹 사용자와 같음) → 모든 nativeFetch 가 ${hubURL}/proxy2(risu-url 헤더)로 감 → 여기서 가로채 가짜 서버·release/ 로 돌림.
//                 이 길은 playwright route.fulfill 이 본문을 한 번에 넘겨 스트리밍 조각이 한 덩어리로 온다(늦게 답하기는 그대로 됨).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
let require0;
try { require0 = createRequire(import.meta.url); require0.resolve('playwright'); } catch { require0 = createRequire(execSync('npm root -g').toString().trim() + '/'); }
const { chromium } = require0('playwright');

const ip = () => Object.values(networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address || '127.0.0.1';
export const DEFAULTS = {
  risu: process.env.RISU_URL || 'http://127.0.0.1:5180',
  fake: process.env.FAKE_URL || `http://${ip()}:8790`,
  rel: process.env.GOEI_REL || '/home/user/goei/release/',
  out: HERE + '/out',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openT2(o = {}) {
  const cfg = { ...DEFAULTS, via: 'plain', width: 1280, height: 800, touch: false, streaming: false, ...o };
  mkdirSync(cfg.out, { recursive: true });
  const t0 = Date.now();
  const log = (...a) => console.log(`[t2 ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
  const fakeOrigin = new URL(cfg.fake).origin;
  const risuOrigin = new URL(cfg.risu).origin;

  // 카드(약 146MB)는 route.fulfill 로 못 넘겨 따로 띄운 작은 HTTP 서버로 준다 (shots.mjs 와 같음)
  const cardPath = cfg.rel + '괴이_ANOMALY.charx';
  const cardSrv = http.createServer((q, s) => { s.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'application/octet-stream' }); s.end(readFileSync(cardPath)); });
  await new Promise((r) => cardSrv.listen(0, '127.0.0.1', r));
  const cardUrl = `http://127.0.0.1:${cardSrv.address().port}/card.charx`;
  cfg.cardUrl = cardUrl;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: cfg.dsf || 1, ...(cfg.touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  const served = { release: 0, releaseMiss: [], proxy2Release: 0, proxy2Model: 0, aborted: [] };
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const tx = m.text();
    if (/\[goei\]/.test(tx) || (m.type() === 'error' && !/DEPRECATION|Failed to load resource|Error processing block/.test(tx))) errors.push(`${m.type()}: ${tx.slice(0, 400)}`);
  });
  page.on('dialog', (d) => { errors.push('dialog: ' + d.message().slice(0, 200)); d.accept().catch(() => {}); });
  await ctx.addInitScript(() => { globalThis.__RISU_LEGAL_CONFIGURED__ = true; try { localStorage.setItem('tos4', 'true'); } catch {} });

  const relFile = (url) => {
    const f = decodeURIComponent(url.split('/ygberserk/goei/release/')[1].split('?')[0]);
    const p = cfg.rel + f;
    return existsSync(p) ? readFileSync(p) : null;
  };
  // 모델 요청을 가짜 서버로 넘겨 받은 그대로 돌려준다 (proxy2 길)
  const forward = (url, method, headers, body) => new Promise((res, rej) => {
    const u = new URL(url);
    const h = { ...headers }; delete h['risu-url']; delete h.host; delete h['content-length'];
    const q = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: h }, (r) => {
      const a = []; r.on('data', (c) => a.push(c)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(a) })); r.on('error', rej);
    });
    q.on('error', rej);
    if (body) q.write(body);
    q.end();
  });
  await ctx.route((u) => !u.href.startsWith(risuOrigin) && !u.href.startsWith('http://127.0.0.1') && !(cfg.via === 'plain' && u.href.startsWith(fakeOrigin)), async (r) => {
    const req = r.request();
    let url = req.url();
    const viaProxy = url.includes('/proxy2');
    if (viaProxy) url = decodeURIComponent(req.headers()['risu-url'] || '');
    if (url.includes('raw.githubusercontent.com/ygberserk/goei/release/')) {
      // 플러그인은 risuFetch(plainFetchForce, 직접 받기)를 먼저 쓰고 안 되면 nativeFetch(/proxy2)로 받는다 (src/host/datapack.ts·ui/update.ts).
      // cfg.releaseDirect='fail' 이면 직접 받기를 끊어 /proxy2 길을 타게 한다
      if (!viaProxy && cfg.releaseDirect === 'fail') { served.directBlocked = (served.directBlocked ?? 0) + 1; return r.abort(); }
      const b = relFile(url);
      if (b) { served.release++; if (viaProxy) served.proxy2Release++; return r.fulfill({ status: 200, body: b, headers: { 'access-control-allow-origin': '*' } }); }
      served.releaseMiss.push(url.slice(-80));
      return r.fulfill({ status: 404, body: '', headers: { 'access-control-allow-origin': '*' } });
    }
    if (viaProxy && url.startsWith(fakeOrigin)) {
      served.proxy2Model++;
      try {
        const x = await forward(url, req.method(), req.headers(), req.postDataBuffer());
        return r.fulfill({ status: x.status, body: x.body, headers: { ...Object.fromEntries(Object.entries(x.headers).map(([k, v]) => [k, String(v)])), 'access-control-allow-origin': '*' } });
      } catch (e) { return r.fulfill({ status: 502, body: String(e) }); }
    }
    if (served.aborted.length < 200) served.aborted.push(url.slice(0, 120));
    return r.abort();
  });

  // ── 리스AI 쪽 ─────────────────────────────────────
  const R = (fn, arg) => page.evaluate(fn, arg);
  /** 리스AI 의 alert 에 자동 답 (권한 묻기·지우기 확인). window.__t2Answer 로 'yes'/'no' 바꿈 */
  const hookAlerts = () => R(async () => {
    const st = await import('/src/ts/stores.svelte.ts');
    if (window.__t2Hooked) return;
    window.__t2Hooked = true; window.__t2Answer ??= 'yes'; window.__t2Alerts = [];
    st.alertStore.subscribe((v) => {
      if (v && !['none', 'wait', 'progress', 'waitAlert', 'toast'].includes(v.type)) {
        window.__t2Alerts.push({ t: Date.now(), type: v.type, msg: String(v.msg).slice(0, 300) });
        setTimeout(() => st.alertStore.set({ type: 'none', msg: window.__t2Answer }), 30);
      }
    });
  });
  const waitRisu = async () => {
    await page.waitForFunction(() => document.querySelector('.default-chat-screen, button') || /Accept/.test(document.body?.innerText ?? ''), null, { timeout: 180000 });
    await hookAlerts();
  };
  /** 서비스 워커가 이 페이지를 맡을 때까지. 리스AI 는 첫 방문에 sw.js 를 등록하고 fetch('/sw/init') 가 2xx 가 아니면 새로고침하는데(bootstrap.ts registerSw),
   *  vite dev 는 /sw/init 에 index.html 을 200 으로 줘서 새로고침이 안 일어난다 → 페이지가 SW 밖에 남고, getFileSrc(globalApi.svelte.ts:139-175)가
   *  /sw/check 에서 HTML 을 받아 JSON 읽기에 실패한 채 fileCache 를 'loading' 으로 남겨, 같은 그림을 다시 찾는 호출이 영원히 돈다.
   *  그러면 그림({{source::user}}·캐릭터 사진)이 걸린 메시지는 ParseMarkdown 이 끝나지 않아 화면 .chattext 가 빈다 (2026-11-24 확인). 한 번 새로고침해 SW 가 맡게 한다 */
  const ensureSw = async () => {
    if (await R(() => !!navigator.serviceWorker?.controller)) return true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitRisu();
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 60000 });
    await sleep(2000);
    await hookAlerts();
    return true;
  };
  /** 모델 설정을 DB 에 넣는다 (shots.mjs 처럼 모듈 import) */
  const applyModelSettings = (streaming = cfg.streaming) => R(async ({ fake, via, streaming }) => {
    const st = await import('/src/ts/stores.svelte.ts');
    const db = st.DBState.db;
    db.aiModel = 'reverse_proxy';
    db.forceReplaceUrl = `${fake}/main/v1/chat/completions`;
    db.customProxyRequestModel = 't2-main';
    db.proxyRequestModel = 'custom';
    db.customAPIFormat = 0; // LLMFormat.OpenAICompatible
    db.proxyKey = 't2-key';
    db.subModel = 'xcustom:::t2-aux';
    db.customModels = [{ id: 'xcustom:::t2-aux', internalId: 't2-aux', url: `${fake}/aux/v1/chat/completions`, format: 0, tokenizer: 2, key: 't2-aux-key', name: 't2-aux', params: '', flags: [] }];
    db.seperateModelsForAxModels = false;
    db.usePlainFetch = via === 'plain';
    db.useStreaming = !!streaming;
    db.swipe = true;
    return { aiModel: db.aiModel, url: db.forceReplaceUrl, subModel: db.subModel, aux: db.customModels[0].url, usePlainFetch: db.usePlainFetch, useStreaming: db.useStreaming };
  }, { fake: cfg.fake, via: cfg.via, streaming });

  const charIndex = () => R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return st.DBState.db.characters.findIndex((c) => (c.globalLore ?? []).some((l) => /goei|괴이/i.test(String(l.comment ?? '') + String(l.key ?? '')))); });
  let myChar = null; // setup 에서 가져온 괴이 캐릭터 번호
  const selectChar = async (idx) => {
    if (idx == null) idx = myChar ?? await charIndex();
    myChar = idx;
    // 리스AI 캐릭터 목록 단추와 같은 changeChar (characterFormatUpdate 가 chat.id·fmIndex 를 채운다. selectedCharID.set 만 하면 첫 채팅 id 가 비고 fmIndex 가 없어 보내기가 risuChatParser 에서 깨진다)
    await R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, idx);
    await page.waitForSelector('.default-chat-screen', { timeout: 60000 });
    return idx;
  };

  // ── 플러그인 창 (iframe) ─────────────────────────────
  let F = null;
  const frame = async (sel = '.gx', ms = 60000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      for (const f of page.frames()) { if (f === page.mainFrame()) continue; try { if (await f.$(sel)) return (F = f); } catch {} }
      await sleep(200);
    }
    throw new Error('plugin frame with ' + sel + ' not found');
  };
  const fclick = async (sel, i = 0) => { if (!F) await frame(sel); await F.locator(sel).nth(i).click({ timeout: 8000 }); };
  const feval = async (fn, arg) => { if (!F) await frame(); return F.evaluate(fn, arg); };
  const fabReady = () => page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 120000 });
  const openWindow = async (sel = '.gx') => { await fabReady(); await page.click('[x-goei-fab] button'); return frame(sel); };
  const closeWindow = async () => { if (F) await F.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()).catch(() => {}); await sleep(400); };

  // ── 채팅 상태 ───────────────────────────────────────
  const chatState = (full = false) => R(async (full) => {
    const st = await import('/src/ts/stores.svelte.ts');
    const db = st.DBState.db;
    const ci = Number(st.selectedCharID && (await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); })));
    const char = db.characters[ci];
    if (!char) return { ci, none: true };
    const chat = char.chats[char.chatPage];
    return {
      ci, chatPage: char.chatPage, chats: char.chats.map((c) => ({ id: c.id, name: c.name, n: c.message.length })),
      chatId: chat.id, fmIndex: chat.fmIndex,
      message: chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: full ? m.data : String(m.data).slice(0, 600), len: String(m.data).length })),
      scriptKeys: Object.keys(chat.scriptstate ?? {}).length,
      scriptstate: full ? chat.scriptstate : undefined,
      people: full ? chat.goeiPeopleV1 : undefined,
    };
  }, full);
  const isBusy = () => R(() => !!document.querySelector('.default-chat-screen .loadmove'));
  const isIdle = () => R(() => !document.querySelector('.default-chat-screen .loadmove') && !!document.querySelector('.default-chat-screen .button-icon-send'));
  const waitBusy = (ms = 15000) => page.waitForFunction(() => !!document.querySelector('.default-chat-screen .loadmove'), null, { timeout: ms });
  const waitIdle = async (ms = 180000) => { await page.waitForFunction(() => !document.querySelector('.default-chat-screen .loadmove') && !!document.querySelector('.default-chat-screen .button-icon-send'), null, { timeout: ms }); await sleep(700); /* 리스AI 저장 0.5초 모음 */ };
  /** 화면에 그려진 메시지(실제 DOM): 번호·.chattext 글. idx -1 은 인사말(첫 메시지) 칸 */
  const screenMessages = () => R(() => [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].map((e) => ({ idx: Number(e.dataset.chatIndex), text: (e.querySelector('.chattext')?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) })).sort((a, b) => a.idx - b.idx));
  /** 화면의 n 번 메시지 .chattext 에 글(정규식)이 보일 때까지 (기본 10초). 보이면 그 글, 아니면 null */
  const waitScreenText = async (idx, re, ms = 10000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = (await screenMessages()).find((x) => x.idx === idx);
      if (m && re.test(m.text)) return m.text;
      await sleep(300);
    }
    return null;
  };
  /** 플러그인 호출 진행 창(리스AI 화면 위 [x-goei-prog]) 글 */
  const progText = () => R(() => document.querySelector('[x-goei-prog]')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? null);

  // ── 리스AI 채팅 조작 (실제 단추) ───────────────────────
  const lastIdx = () => R(() => Math.max(-1, ...[...document.querySelectorAll('.risu-chat[data-chat-index]')].map((e) => Number(e.dataset.chatIndex))));
  /** 메시지 칸의 단추 누르기. 폭 640 미만(폰)에서는 리스AI 가 휴지통·TTS 등을 ☰(.button-icon-menu, PopupButton) 안에 넣고 그 메뉴를 칸 밖(popupStore)에 그리므로, 칸에 없으면 ☰ 를 눌러 열린 메뉴에서 찾는다 (Chat.svelte:603-617) */
  const clickIn = async (idx, sel) => {
    const r = await R(({ idx, sel }) => { const box = document.querySelector(`.risu-chat[data-chat-index="${idx}"]`); if (!box) return 'nobox'; const b = box.querySelector(sel); if (b) { b.click(); return 'ok'; } const m = box.querySelector('.button-icon-menu'); if (!m) return 'none'; m.click(); return 'menu'; }, { idx, sel });
    if (r === 'ok') return true;
    if (r !== 'menu') return false;
    await sleep(400);
    return R((sel) => { const b = [...document.querySelectorAll(sel)].find((e) => !e.closest('.risu-chat') && e.offsetParent !== null); if (!b) return false; b.click(); return true; }, sel);
  };
  /** 메시지 보내기: 입력칸에 쓰고 보내기 단추. wait=true 면 답이 끝날 때까지 */
  const send = async (text, { wait = true } = {}) => {
    await page.fill('.default-chat-screen textarea.text-input-area', text);
    await page.click('.default-chat-screen .button-icon-send');
    if (wait) { await waitBusy().catch(() => {}); await waitIdle(); }
  };
  /** 다시 굴리기 = 마지막 답의 ▶(swipe 켬) 단추. 가장 끝 답이면 새로 만들고, 앞 답을 보고 있으면 다음 답으로 넘김 */
  const reroll = async ({ wait = true } = {}) => { const i = await lastIdx(); if (!(await clickIn(i, '.button-icon-reroll'))) throw new Error('reroll 단추 없음'); if (wait) { await waitBusy(5000).catch(() => {}); await waitIdle(); } };
  const swipeNext = (o) => reroll(o);
  const swipePrev = async () => { const i = await lastIdx(); if (!(await clickIn(i, '.button-icon-unreroll'))) throw new Error('◀ 단추 없음'); await sleep(800); };
  /** 이어 쓰기: 입력칸 옆 메뉴 → 「이어 쓰기」(StepForward 아이콘) */
  const continueReply = async ({ wait = true } = {}) => {
    await R(() => { const send = document.querySelector('.default-chat-screen .button-icon-send'); send?.nextElementSibling?.click(); });
    await sleep(300);
    const ok = await R(() => { const ic = document.querySelector('.default-chat-screen svg.lucide-step-forward, svg.lucide-step-forward'); const d = ic?.closest('div'); if (!d) return false; d.click(); return true; });
    if (!ok) throw new Error('이어 쓰기 메뉴 없음');
    if (wait) { await waitBusy(5000).catch(() => {}); await waitIdle(); }
  };
  /** 메시지 고치기: 연필 → 글 바꿈 → 연필 (리스AI 원문 고치기) */
  const editMessage = async (idx, text) => {
    if (!(await clickIn(idx, '.button-icon-edit'))) throw new Error('연필 단추 없음');
    await sleep(300);
    const ta = page.locator(`.risu-chat[data-chat-index="${idx}"] textarea`).first();
    await ta.fill(text);
    if (!(await clickIn(idx, '.button-icon-edit'))) throw new Error('연필 단추(저장) 없음');
    await sleep(800);
  };
  /** 메시지 지우기: 휴지통 → 확인(자동 yes) */
  const deleteMessage = async (idx) => { if (!(await clickIn(idx, '.button-icon-remove'))) throw new Error('휴지통 단추 없음'); await sleep(900); };
  /** 리스AI 중지 (만드는 중 멈춤 단추) */
  const stop = async () => { await R(() => document.querySelector('.default-chat-screen .loadmove')?.closest('button')?.click()); await sleep(500); };
  /** 새 채팅: 리스AI 채팅 목록 「새 채팅」 단추와 같은 코드 (맨 앞에 끼우고 changeChatTo(0) — 기존 채팅 번호가 +1 밀림) */
  const newChat = () => R(async () => {
    const st = await import('/src/ts/stores.svelte.ts');
    const g = await import('/src/ts/globalApi.svelte.ts');
    const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
    const chara = st.DBState.db.characters[ci];
    const len = chara.chats.length;
    const chats = chara.chats;
    chats.unshift({ message: [], note: '', name: `New Chat ${len + 1}`, localLore: [], fmIndex: -1, id: crypto.randomUUID() });
    chara.chats = chats;
    g.changeChatTo(0);
    return { chatPage: chara.chatPage, n: chara.chats.length };
  }).then(async (r) => { await sleep(800); return r; });
  /** 채팅 바꾸기: 리스AI 채팅 목록 단추와 같은 changeChatTo(번호 또는 id) */
  const switchChat = (idOrIndex) => R(async (x) => { const g = await import('/src/ts/globalApi.svelte.ts'); g.changeChatTo(x); }, idOrIndex).then(() => sleep(800));
  /** 새로고침. settle=true 면 리스AI 저장(0.5초 모음)이 끝난 뒤, false 면 바로 */
  const reload = async ({ settle = true, reselect = true } = {}) => {
    const idx = myChar ?? await charIndex().catch(() => null);
    if (settle) await sleep(1500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    F = null;
    await waitRisu();
    await ensureSw();
    // DB 를 다 읽을 때까지 (캐릭터가 다시 보일 때까지)
    await page.waitForFunction(async (i) => { const st = await import('/src/ts/stores.svelte.ts'); return (st.DBState.db?.characters?.length ?? 0) > i; }, idx ?? 0, { timeout: 120000, polling: 500 });
    await applyModelSettings(cfg.streaming); // 모델 설정은 DB 에 저장돼 있지만 같은 값으로 다시 넣어 둔다
    if (reselect && idx != null && idx >= 0) await selectChar(idx);
  };
  /** 받는 주소 직접 받기를 끊거나('fail') 되살림('ok') */
  const setReleaseDirect = (v) => { cfg.releaseDirect = v; };
  const setStreaming = async (on) => { cfg.streaming = !!on; return applyModelSettings(!!on); };

  // ── 가짜 모델 서버 ───────────────────────────────────
  const fake = async (path, body) => {
    const r = await fetch(cfg.fake + '/_ctl/' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    return r.json();
  };
  const fakeLog = (since = 0, route = '') => fake(`log?since=${since}${route ? '&route=' + route : ''}`);
  const fakeSeq = async () => { const l = await fake('log?full=0'); return l.length ? l.at(-1).seq : 0; };

  // ── 설치·시작 ───────────────────────────────────────
  /** 리스AI 열기 → 카드 가져오기 → 플러그인 넣기 → 모델 설정 → 캐릭터 고르기 */
  const setup = async () => {
    // vite dev 첫 실행은 의존성 최적화 뒤 페이지를 한 번 다시 읽는다: 조용해질 때까지 기다린다
    for (let i = 0; ; i++) {
      try {
        await page.goto(cfg.risu + '/', { waitUntil: 'domcontentloaded', timeout: 180000 });
        await waitRisu();
        await sleep(3000);
        await R(() => 1);
        await hookAlerts();
        await ensureSw();
        break;
      } catch (e) { if (i >= 3) throw e; log('risu reload during start, retry', String(e.message).slice(0, 80)); await sleep(3000); }
    }
    log('risu up', 'sw', await R(() => !!navigator.serviceWorker?.controller));
    const plugin = readFileSync(cfg.rel + 'goei-plugin.js', 'utf8');
    const res = await R(async ({ plugin, cardUrl }) => {
      const st = await import('/src/ts/stores.svelte.ts');
      st.DBState.db.didFirstSetup = true;
      const cc = await import('/src/ts/characterCards.ts');
      const buf = new Uint8Array(await (await fetch(cardUrl)).arrayBuffer());
      await cc.importCharacterProcess({ name: 'goei.charx', data: buf });
      const pl = await import('/src/ts/plugins/plugins.svelte.ts');
      await pl.importPlugin(plugin);
      return { chars: st.DBState.db.characters.length, plugins: st.DBState.db.plugins.map((x) => x.name + '@' + (x.version ?? '')) };
    }, { plugin, cardUrl });
    log('imported', JSON.stringify(res));
    const m = await applyModelSettings(cfg.streaming);
    log('model', JSON.stringify(m));
    const idx = await selectChar(res.chars - 1);
    return { ...res, model: m, charIndex: idx };
  };
  /** 시작 패널: 소속(기본 관리국 A00) → 출발. 첫 장면(인물 장면)은 자동 전송 없음 */
  const start = async (fac = 'A00') => {
    await openWindow('.gx-fac');
    await F.click(`.gx-fac[data-value="${fac}"]`);
    await sleep(300);
    await F.click('.gx-start');
    const end = Date.now() + 60000;
    while (Date.now() < end) {
      const ok = await R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const c = st.DBState.db.characters[ci]; return !!c.chats[c.chatPage || 0]?.scriptstate?.$goei_world; });
      if (ok) { log('started', fac); await sleep(800); return true; }
      await sleep(300);
    }
    throw new Error('start did not write $goei_world');
  };
  const shot = (name) => page.screenshot({ path: `${cfg.out}/${name}.png` });
  const alerts = () => R(() => window.__t2Alerts ?? []);
  const setAnswer = (a) => R((a) => { window.__t2Answer = a; }, a);
  const close = async () => { await browser.close(); cardSrv.close(); };

  return { cfg, page, ctx, browser, log, errors, served, R, F: () => F, frame, fclick, feval, openWindow, closeWindow, fabReady,
    setup, start, applyModelSettings, setStreaming, setReleaseDirect, selectChar, charIndex, chatState, screenMessages, waitScreenText, ensureSw, isBusy, isIdle, waitBusy, waitIdle, progText,
    send, reroll, swipeNext, swipePrev, continueReply, editMessage, deleteMessage, stop, newChat, switchChat, reload, lastIdx,
    fake, fakeLog, fakeSeq, shot, alerts, setAnswer, close };
}

// ───────────────────────── 0단계 확인 ─────────────────────────
const STATUS = '[▣|2025.03.14|09:20 AM|☀️|12°C|관리국 본부|첫 보고]';
async function check(argv) {
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const streamModes = { both: [false, true], on: [true], off: [false] }[opt('--stream', 'both')];
  const via = opt('--via', 'plain');
  const releaseDirect = opt('--release-direct', 'ok');
  const width = Number(opt('--w', 1280)), height = Number(opt('--h', 800));
  const touch = argv.includes('--touch') || width < 600;
  const size = `${width}x${height}`;
  const result = { at: new Date().toISOString(), via, releaseDirect, size, touch, steps: [], shots: [] };
  const step = (name, ok, detail) => { result.steps.push({ name, ok, detail }); console.log(ok ? 'OK  ' : 'NG  ', name, JSON.stringify(detail).slice(0, 400)); };
  const t = await openT2({ via, streaming: streamModes[0], releaseDirect, width, height, touch });
  const outFile = `${t.cfg.out}/check-${via}-${size}-${Date.now()}.json`;
  const shot = async (name) => { const n = `check-${via}-${size}-${name}`; await t.shot(n); result.shots.push(`${t.cfg.out}/${n}.png`); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const lastScreen = async () => (await t.screenMessages()).filter((m) => m.idx >= 0).at(-1) ?? null;
  try {
    await t.fake('reset', {});
    await t.fake('rules', { rules: [
      { id: 'main-A', route: 'main', matchLast: 'T2-A', reply: `T2 대본 A #{{seq}}. 요원들이 본부에 모였다.\n[AG|P001|작전투입|현장]\n${STATUS}` },
      { id: 'main-C-slow', route: 'main', matchLast: 'T2-C', delayMs: 9000, reply: `T2 대본 C(늦게) #{{seq}}.\n${STATUS}` },
      { id: 'main-R', route: 'main', matchLast: 'T2-R', reply: `T2 대본 R #{{seq}}.\n${STATUS}` },
      { id: 'main-default', route: 'main', reply: `T2 기본 본편 #{{seq}}.\n${STATUS}` },
      { id: 'aux-default', route: 'aux', reply: '{}' },
    ] });
    const su = await t.setup();
    const env = await t.R(async () => { const db = (await import('/src/ts/storage/database.svelte.ts')); const c = db.getCurrentCharacter(); return { sw: !!navigator.serviceWorker?.controller, triggers: c?.triggerscript?.length ?? null, chatId: c?.chats?.[c.chatPage]?.id ?? null, fmIndex: c?.chats?.[c.chatPage]?.fmIndex ?? null }; });
    step('setup', su.chars >= 1 && su.plugins.length >= 1 && env.sw && !!env.chatId, { ...su, env });
    const greet = await t.waitScreenText(-1, /\S/, 15000);
    step('화면: 인사말 칸 글 보임', !!greet, { greet: greet?.slice(0, 80) ?? null });
    await t.start('A00');
    const st0 = await t.chatState(true);
    step('start', !!st0.scriptstate?.$goei_world, { messages: st0.message.length, chatPage: st0.chatPage, chatId: st0.chatId });
    await t.closeWindow();
    await wait(1500);
    const scr0 = await t.screenMessages();
    // idx -1(인사말 칸)은 시작 뒤 플러그인이 fmIndex 0·빈 다른 인사말로 바꿔 .chattext 없이 「Type something to start the chat.」만 남는다(2026-11-24 본 것, 판정 밖·기록만)
    const blank = await t.R(() => document.querySelector('.risu-chat[data-chat-index="-1"]')?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? null);
    step('화면: start 뒤 메시지 칸(0번부터)에 글이 있음', scr0.some((m) => m.idx >= 0) && scr0.filter((m) => m.idx >= 0).every((m) => m.text.length > 0), { screen: scr0.map((m) => ({ idx: m.idx, text: m.text.slice(0, 60) })), greetBoxAfterStart: blank, fmIndex: st0.fmIndex });

    for (const streaming of streamModes) {
      const tag = streaming ? 'stream' : 'nostream';
      await t.setStreaming(streaming);
      // (a) 본편 요청 → 답이 붙고 output 처리
      let seq0 = await t.fakeSeq();
      const before = await t.chatState(true);
      await t.send(`T2-A ${tag} 첫 보고를 듣는다.`);
      await wait(4000);
      const logA = await t.fakeLog(seq0);
      const mainA = logA.filter((x) => x.route === 'main');
      const after = await t.chatState(true);
      const last = after.message.at(-1);
      const worldChanged = before.scriptstate?.$goei_world !== after.scriptstate?.$goei_world;
      step(`(a) ${tag} 본편 요청이 본편 주소로`, mainA.length >= 1 && mainA.every((x) => x.stream === streaming), { main: mainA.map((x) => ({ seq: x.seq, path: x.path, stream: x.stream, rule: x.ruleId, msgs: x.body?.messages?.length })) });
      step(`(a) ${tag} 답이 채팅에 붙음`, last?.role === 'char' && /T2 대본 A/.test(last.data), { last: last?.data?.slice(0, 300) });
      step(`(a) ${tag} output 처리(상황판 태그 걷음·$goei_world 바뀜, 상태창 줄은 남음)`, !/\[AG\|/.test(last?.data ?? '') && last?.data?.includes('[▣|') && worldChanged, { agTagLeft: /\[AG\|/.test(last?.data ?? ''), statusKept: last?.data?.includes('[▣|'), worldChanged });
      const n = after.message.length;
      const scrA = await t.waitScreenText(n - 1, /T2 대본 A/);
      const scrU = await t.waitScreenText(n - 2, /T2-A/, 3000);
      await shot(`a-${tag}`);
      step(`(a) ${tag} 화면 .chattext 에 내 말·답 글이 보임`, !!scrA && !!scrU, { user: scrU?.slice(0, 80) ?? null, answer: scrA?.slice(0, 120) ?? null, screenIdx: (await t.screenMessages()).map((m) => m.idx) });
      // (b) 보조 호출
      await wait(6000);
      const logB = await t.fakeLog(seq0);
      const aux = logB.filter((x) => x.route === 'aux');
      step(`(b) ${tag} 보조 호출이 보조 주소로`, aux.length >= 1, { aux: aux.map((x) => ({ seq: x.seq, path: x.path, stream: x.stream, model: x.model, sys: String(x.body?.messages?.[0]?.content ?? '').slice(0, 120) })), prog: await t.progText() });
      // (c) 늦게 답하기 동안
      seq0 = await t.fakeSeq();
      await t.send(`T2-C ${tag} 늦은 답을 기다린다.`, { wait: false });
      await t.waitBusy(15000).catch(() => {});
      await wait(3000);
      const busy = await t.isBusy();
      const prog = await t.progText();
      const pend = await t.fake('pending');
      await shot(`c-${tag}`);
      step(`(c) ${tag} 늦은 답 동안 리스AI 만드는 중·플러그인 기다림`, busy && /메인 응답 대기/.test(prog ?? ''), { risuLoadmove: busy, progWindow: prog, fakePending: pend });
      await t.waitIdle();
      const afterC = await t.chatState();
      const scrC = await t.waitScreenText(afterC.message.length - 1, /T2 대본 C/);
      step(`(c) ${tag} 늦은 답이 붙음·화면에 보임`, /T2 대본 C/.test(afterC.message.at(-1)?.data ?? '') && !!scrC, { last: afterC.message.at(-1)?.data?.slice(0, 120), screen: scrC?.slice(0, 80) ?? null, progAfter: await t.progText() });
      await wait(4000);
      // 이어 쓰기 (입력칸 빈 채 메뉴 → 이어 쓰기). 리스AI(useSayNothing 켬): user '*says nothing*' 를 넣고 sendChat(continue)
      //   스트리밍 켬: 이어 쓴 글이 그 user 메시지 뒤에 붙음(index.svelte.ts streaming: msgIndex-1, prefix) → 마지막이 user '*says nothing*T2…'
      //   스트리밍 끔: 그 자리를 role char '*says nothing*'+답 으로 바꿈(index.svelte.ts 비스트리밍 continue) → 마지막이 char '*says nothing*T2…'
      //   어느 쪽이든 메시지 수는 이어 쓰기 전보다 1 많다
      seq0 = await t.fakeSeq();
      const bc = await t.chatState(true);
      let contOk = true, contErr = null;
      try { await t.continueReply(); } catch (e) { contOk = false; contErr = String(e.message); }
      await wait(1500);
      const ac = await t.chatState(true);
      const logCont = (await t.fakeLog(seq0)).filter((x) => x.route === 'main');
      const lc = ac.message.at(-1);
      const wantRole = streaming ? 'user' : 'char';
      const placeOk = ac.message.length === bc.message.length + 1 && lc?.role === wantRole && /^\*says nothing\*\s*T2 기본 본편/.test(lc?.data ?? '') && bc.message.every((m, i) => m.data === ac.message[i].data);
      const scrCont = await t.waitScreenText(ac.message.length - 1, /T2 기본 본편/);
      step(`(e) ${tag} 이어 쓰기 → 본편 요청·붙은 자리(마지막 ${wantRole} '*says nothing*T2…', 메시지 +1)·화면`, contOk && logCont.length === 1 && placeOk && !!scrCont, { contErr, n: [bc.message.length, ac.message.length], main: logCont.map((x) => ({ seq: x.seq, stream: x.stream, last2: x.body?.messages?.slice(-2).map((m) => m.role + ': ' + String(m.content).slice(0, 60)) })), last2: ac.message.slice(-2).map((m) => m.role + ': ' + String(m.data).slice(0, 80)), screen: scrCont?.slice(0, 80) ?? null });
      await wait(5000);
    }

    // (d) 다시 굴리기·◀▶·새로고침·채팅 바꾸기
    let seq0 = await t.fakeSeq();
    await t.send('T2-R 다시 굴릴 말.');
    const r1 = (await t.chatState()).message.at(-1)?.data;
    await t.reroll();
    const sr = await t.chatState();
    const r2 = sr.message.at(-1)?.data;
    const logR = (await t.fakeLog(seq0)).filter((x) => x.route === 'main');
    const scrR = await t.waitScreenText(sr.message.length - 1, new RegExp(String(r2 ?? '').split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    step('(d) 다시 굴리기 → 본편 요청 한 번 더, 답 바뀜, 화면에 새 답', logR.length >= 2 && r1 !== r2 && /T2 대본 R/.test(r2 ?? '') && !!scrR, { r1: r1?.slice(0, 60), r2: r2?.slice(0, 60), screen: scrR?.slice(0, 60) ?? null, mainSeqs: logR.map((x) => x.seq), sameLastUser: logR.length >= 2 && logR[0].lastUser === logR.at(-1).lastUser, dupOf: logR.map((x) => x.dupOf) });
    await wait(6000); // 다시 굴리기 뒤 보조 호출이 끝나기를 기다린 뒤 ◀▶ 를 센다
    const seqP = await t.fakeSeq();
    await t.swipePrev();
    const r3 = (await t.chatState()).message.at(-1)?.data;
    const scr3 = (await lastScreen())?.text ?? '';
    await t.swipeNext({ wait: false }); await wait(1200);
    const r4 = (await t.chatState()).message.at(-1)?.data;
    const scr4 = (await lastScreen())?.text ?? '';
    await wait(3000);
    const logP = await t.fakeLog(seqP);
    const firstLine = (x) => String(x ?? '').split('\n')[0];
    step('(d) ◀ 앞 답으로, ▶ 다시 뒤 답으로 (모델 요청 0건, 화면도 바뀜)', r3 === r1 && r4 === r2 && logP.length === 0 && scr3.includes(firstLine(r1)) && scr4.includes(firstLine(r2)), { r3: r3?.slice(0, 60), r4: r4?.slice(0, 60), screen3: scr3.slice(0, 60), screen4: scr4.slice(0, 60), requests: logP.map((x) => ({ seq: x.seq, route: x.route, rule: x.ruleId })) });
    // 메시지 고치기·지우기
    const n0 = (await t.chatState()).message.length;
    const li = await t.lastIdx();
    let editOk = true, editErr = null;
    try { await t.editMessage(li, 'T2 손으로 고친 답.\n' + STATUS); } catch (e) { editOk = false; editErr = String(e.message); }
    const ed = (await t.chatState()).message.at(-1)?.data;
    const scrE = await t.waitScreenText(li, /손으로 고친 답/);
    step('(d) 메시지 고치기 (연필)·화면', editOk && /손으로 고친 답/.test(ed ?? '') && !!scrE, { editErr, last: ed?.slice(0, 80), screen: scrE?.slice(0, 60) ?? null, domLastIdx: li, n0 });
    await t.deleteMessage(await t.lastIdx());
    const n1 = (await t.chatState()).message.length;
    step('(d) 메시지 지우기 (휴지통)', n1 === n0 - 1, { n0, n1, alerts: (await t.alerts()).slice(-3) });
    // 새로고침
    const pre = await t.chatState();
    await t.reload({ settle: true });
    const post = await t.chatState();
    await t.fabReady().catch(() => {});
    const fab = await t.R(() => document.querySelector('[x-goei-fab]')?.style.display === 'block');
    const scrRl = await t.waitScreenText(post.message.length - 1, /\S/, 15000);
    step('(d) 새로고침(저장 끝난 뒤) → 채팅 그대로, 플러그인 다시 뜸, 화면에 마지막 글', pre.message.length === post.message.length && pre.chatPage === post.chatPage && pre.message.at(-1)?.data === post.message.at(-1)?.data && fab && !!scrRl, { pre: pre.message.length, post: post.message.length, preChatId: pre.chatId ?? null, postChatId: post.chatId ?? null, fab, screen: scrRl?.slice(0, 60) ?? null });
    // 새로고침 뒤 한 번 더 보내기
    seq0 = await t.fakeSeq();
    await t.send('T2-A 새로고침 뒤 한 번 더.');
    const logRl = (await t.fakeLog(seq0)).filter((x) => x.route === 'main');
    const sRl = await t.chatState();
    const scrRl2 = await t.waitScreenText(sRl.message.length - 1, /T2 대본 A/);
    step('(d) 새로고침 뒤 보내기·화면', logRl.length >= 1 && /T2 대본 A/.test(sRl.message.at(-1)?.data ?? '') && !!scrRl2, { main: logRl.map((x) => x.seq), screen: scrRl2?.slice(0, 60) ?? null });
    // 새 채팅·채팅 바꾸기
    const old = await t.chatState();
    const nc = await t.newChat();
    const inNew = await t.chatState();
    await t.switchChat(old.chatId);
    const back = await t.chatState();
    step('(d) 새 채팅(번호 +1 밀림) → 옛 채팅으로 바꾸기', inNew.chatPage === 0 && inNew.chatId !== old.chatId && back.chatId === old.chatId && back.chatPage === old.chatPage + 1 && back.message.length === old.message.length, { nc, oldPage: old.chatPage, newPage: inNew.chatPage, backPage: back.chatPage, backMsgs: back.message.length });
    // 옛 채팅에서 다시 보내기
    seq0 = await t.fakeSeq();
    await t.send('T2-A 채팅을 바꾼 뒤 보내기.');
    const logSw = (await t.fakeLog(seq0)).filter((x) => x.route === 'main');
    const sSw = await t.chatState();
    const scrSw = await t.waitScreenText(sSw.message.length - 1, /T2 대본 A/);
    await shot('end');
    step('(d) 채팅 바꾼 뒤 보내기·화면', logSw.length >= 1 && /T2 대본 A/.test(sSw.message.at(-1)?.data ?? '') && !!scrSw, { main: logSw.map((x) => x.seq), screen: scrSw?.slice(0, 60) ?? null });
    await wait(4000);
    if (releaseDirect === 'fail') step('받는 주소: 직접 받기 끊음 → /proxy2(risu-url) 길로 release/ 받음', t.served.proxy2Release > 0 && (t.served.directBlocked ?? 0) > 0 && !t.served.releaseMiss.length, { proxy2Release: t.served.proxy2Release, directBlocked: t.served.directBlocked, miss: t.served.releaseMiss });
    else step('받는 주소: raw.githubusercontent.com/ygberserk/goei/release/* → 이 판 release/', t.served.release > 0 && !t.served.releaseMiss.length, { release: t.served.release, proxy2Release: t.served.proxy2Release, miss: t.served.releaseMiss });
    result.served = t.served;
    result.errors = t.errors.slice(-60);
    result.fakeSummary = (await t.fakeLog(0)).map((x) => ({ seq: x.seq, route: x.route, stream: x.stream, rule: x.ruleId, dupOf: x.dupOf, action: x.action, status: x.response?.status, ms: x.response?.ms, lastUser: x.lastUser.slice(0, 60), sys0: String(x.body?.messages?.[0]?.content ?? '').slice(0, 80) }));
  } catch (e) {
    step('예외', false, String(e?.stack ?? e));
    try { await shot('FAIL'); } catch {}
    result.errors = t.errors.slice(-60);
  } finally {
    writeFileSync(outFile, JSON.stringify(result, null, 1));
    console.log('결과:', outFile, '통과', result.steps.filter((s) => s.ok).length, '/', result.steps.length);
    console.log('캡처:', result.shots.join(' '));
    await t.close();
  }
}

// ───────────────────────── 조종 서버 ─────────────────────────
async function serve(argv) {
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const port = Number(opt('--port', 7101));
  const t = await openT2({ via: opt('--via', 'plain'), streaming: opt('--stream', 'off') === 'on', width: Number(opt('--w', 1280)), height: Number(opt('--h', 800)), touch: Number(opt('--w', 1280)) < 600 });
  const ops = {
    setup: () => t.setup(), start: (a) => t.start(a.fac), state: (a) => t.chatState(!!a.full), screen: () => t.screenMessages(), send: (a) => t.send(a.text, { wait: a.wait !== false }),
    reroll: (a) => t.reroll({ wait: a.wait !== false }), prev: () => t.swipePrev(), next: (a) => t.swipeNext({ wait: a.wait !== false }), cont: (a) => t.continueReply({ wait: a.wait !== false }),
    edit: (a) => t.editMessage(a.idx, a.text), del: (a) => t.deleteMessage(a.idx), stop: () => t.stop(), newChat: () => t.newChat(), switchChat: (a) => t.switchChat(a.to),
    reload: (a) => t.reload({ settle: a.settle !== false }), stream: (a) => t.setStreaming(!!a.on), busy: () => t.isBusy(), idle: (a) => t.waitIdle(a.ms), prog: () => t.progText(),
    open: (a) => t.openWindow(a.sel).then(() => true), closeWin: () => t.closeWindow(), fclick: (a) => t.fclick(a.sel, a.i), feval: (a) => t.feval(new Function('return (' + a.js + ')')()),
    eval: (a) => t.R(new Function('return (' + a.js + ')')()), shot: (a) => t.shot(a.name).then(() => a.name), errors: () => t.errors.splice(0), served: () => t.served, alerts: () => t.alerts(), answer: (a) => t.setAnswer(a.v), releaseDirect: (a) => t.setReleaseDirect(a.v), fake: (a) => t.fake(a.path, a.body),
  };
  http.createServer(async (q, s) => {
    let b = ''; for await (const c of q) b += c;
    let a = {}; try { a = JSON.parse(b || '{}'); } catch {}
    try { const v = await ops[a.op]?.(a); s.end(JSON.stringify({ ok: !!ops[a.op], v: v ?? null })); }
    catch (e) { s.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) })); }
  }).listen(port, '127.0.0.1', () => console.log('[t2 serve] ready', port));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'check') await check(rest);
  else if (mode === 'serve') await serve(rest);
  else { console.log('usage: node risu-t2.mjs check|serve [...]'); process.exit(2); }
}
