// 3차 J 구간 2차 이어서: 폰·폴드 크기 기록 화면 조작 + 공통 갈래 표 칸 (기록·보고서 기준).
// 사용: FAKE_URL=http://<IP>:<port> node run2.mjs --only <갈래> [--w 344 --h 882 --touch --dsf 1]
//   크기 갈래: size (폰 세로·폰 가로·폴드는 --w/--h/--touch 로), fold (752x749 에서 설정 기본값·끝값)
//   공통 갈래: c-swipe c-del c-mid c-multi c-cont c-edit c-push c-reload c-5xx c-wait c-think c-off c-other
// 단계마다 기대값·결정표 줄을 먼저 적고(step 의 want/ref), 실제값을 붙여 대조한다. src 는 안 건드림. lib 은 import 만.
import { open, STATES, sleep, waitMain, readRequest, buildReply, quietAux, world, saveJson, saveText, reqText, text } from '../D/lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const TOUCH = argv.includes('--touch') || W < 600;
const DSF = Number(opt('--dsf', 1));
const SIZE = `${W}x${H}${TOUCH ? '-touch' : ''}`;
const OUT = fileURLToPath(new URL(`./out/run2-${ONLY.join('+') || 'all'}-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), size: SIZE, dsf: DSF, only: ONLY, note: '폰·폴드는 실기가 아니라 크기·터치 흉내(playwright viewport + hasTouch/isMobile)', steps: [] };
const step = (id, name, ok, want, ref, got) => { res.steps.push({ id, name, ok, want, ref, got }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 400)); saveJson(OUT + '/result.json', res); };
const on = (k) => ONLY.includes(k);
const t = await open({ out: OUT, width: W, height: H, touch: TOUCH, dsf: DSF });
const shot = async (n) => { await t.shot(n); return `${OUT}/${n}.png`; };
const F = () => t.F();
const fc = async (sel, i = 0) => { try { await F().locator(sel).locator('visible=true').nth(i).click({ timeout: 3000 }); } catch (e) { const ok = await F().evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, { sel, i }); if (!ok) throw e; res.domClicks = (res.domClicks ?? []).concat(sel); } await sleep(700); };
// 손가락 탭: 실패하면 기록하고(안 눌림 신호) DOM 클릭으로 넘어간다
const tap = async (sel, i = 0) => {
  if (!TOUCH) return fc(sel, i);
  try { await F().locator(sel).locator('visible=true').nth(i).tap({ timeout: 4000 }); }
  catch (e) { res.tapFails = (res.tapFails ?? []).concat({ sel, err: String(e.message).split('\n').slice(0, 3).join(' | ').slice(0, 300) }); await fc(sel, i); return false; }
  await sleep(700); return true;
};
const ftext = (sel = '.gx') => F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ') ?? null, sel);
const acts = (re) => F().evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r.test(e.dataset.action)).map((e) => ({ a: e.dataset.action, v: e.dataset.value ?? null, t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), dis: !!e.disabled })); }, re.source);
const PROSE = '쟈알디가 서류를 덮었다.\n\n<img=Jyaldi_serious>\n\n"출발한다."';
const ST = { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' };
/** AN 줄 하나를 격리로 바꾸는 mutate */
const closeAN = (name, why = '현관이 봉인되고 상황이 끝났다') => (w) => w.map((x) => x.startsWith('[AN|') && x.includes(name) ? x.replace('|활성|', '|격리|').replace(/\|[^|]*\]$/, `|${why}]`) : x);
const dropAN = (name) => (w) => w.filter((x) => !(x.startsWith('[AN|') && x.includes(name)));
const T = (prose, mutate) => ({ prose, status: ST, ...(mutate ? { mutate } : {}) });

async function boot(state = 'S-관리국-3턴') {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  await sleep(800);
}
const isMbar = async () => F().evaluate(() => { const b = document.querySelector('.gx-mbar'); return !!b && b.offsetParent !== null && getComputedStyle(b).display !== 'none'; }).catch(() => false);
async function ensureWin() { if (!F() || !(await F().$('.gx').catch(() => null))) { await t.openWindow('.gx'); await sleep(1000); } }
async function navTo(v) {
  await ensureWin();
  if (await isMbar()) { const ok = await F().evaluate((v) => !!document.querySelector(`.gx-mbar [data-value="${v}"]`), v); if (ok) return tap(`.gx-mbar [data-value="${v}"]`); }
  const sel = `[data-action="nav-tab"][data-value="${v}"]`;
  const onNow = () => F().evaluate((s) => !!document.querySelector(s + '.on, ' + s + '[aria-current="page"]'), sel);
  if (TOUCH) {
    // 손가락: 보이는 자리(getBoundingClientRect, 줄인 화면이면 줄인 px)에 CDP 터치를 직접 보낸다 (playwright tap 과 따로 기록)
    const fb = await (await t.page.$('iframe')).boundingBox();
    const r = await F().evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, iw: innerWidth }; }, sel);
    if (r) {
      const k = fb.width / r.iw; const X = fb.x + r.x * k, Y = fb.y + r.y * k;
      const cdp = await t.ctx.newCDPSession(t.page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X, y: Y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(900);
      if (await onNow()) return true;
      res.navFails = (res.navFails ?? []).concat({ v, how: 'cdp-touch', at: [Math.round(X), Math.round(Y)], top: await F().evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[data-action]')?.dataset.action + '=' + (e.closest('[data-action]')?.dataset.value ?? '')) : null; }, r) });
    }
  }
  const ok = await tap(sel);
  if (!(await onNow())) { res.navFails = (res.navFails ?? []).concat({ v, how: 'tap-then-dom' }); await F().evaluate((s) => document.querySelector(s)?.click(), sel); await sleep(800); }
  return ok;
}
const closeSettings = async () => { for (let i = 0; i < 3; i++) { const ok = await F()?.evaluate(() => { const b = [...document.querySelectorAll('[data-action="ed-close"]')].find((e) => e.offsetParent !== null); if (!b) return false; b.click(); return true; }).catch(() => false); if (!ok) break; await sleep(600); } };
async function reopen() { await closeSettings(); await t.closeWindow(); await t.openWindow('.gx'); await sleep(1000); await closeSettings(); }
const rows = async () => { const st = await t.chatState(true); let j = null, r = null; try { j = JSON.parse(st.scriptstate?.$goei_journal ?? 'null'); } catch {} try { r = JSON.parse(st.scriptstate?.$goei_reports ?? 'null'); } catch {}
  // 플러그인이 보여 주는 것과 같게 (2026-11-28 liveJournal·liveReports): 사라진 응답($goei_turns 에 결과가 있지만 채팅에 없는 응답)이 만든 자동 종료 줄은 가린다. 저장값에는 남아 있다 (◀ 로 돌아오면 다시 보임)
  try { const tn = JSON.parse(st.scriptstate?.$goei_turns || 'null'); const alive = new Set(st.message.map((m, i) => m.chatId || `#${i + 1}`)); const dead = new Set((tn?.list ?? []).map((x) => x.k).filter((k) => !k.startsWith('#') && !alive.has(k))); const hide = (x) => (x.cause === 'model' || x.cause === 'ttl') && dead.has(x.anchor); if (dead.size) { if (j?.rows) j = { ...j, rows: j.rows.filter((x) => !hide(x)) }; if (r?.items) r = { ...r, items: r.items.filter((x) => !hide(x)) }; } } catch {}
  return { j, r, st }; };
const sumRows = (j) => (j?.rows ?? []).map((x) => `${x.name}/${x.cause}/idx${x.idx}${x.rpt ? '/rpt' : ''}`);
const sumRpts = (r) => (r?.items ?? []).map((x) => `${x.head?.name}/${x.cause}/idx${x.idx}${x.pin ? '/PIN' : ''}`);
const anStates = async () => { const w = await world(t); const o = Object.fromEntries((w?.ended ?? []).map((e) => [e.name, '끝남'])); for (const e of w?.an ?? []) o[e.name] = e.state; return o; };
const snap = async (label) => { const { j, r, st } = await rows(); return { label, journal: sumRows(j), reports: sumRpts(r), an: await anStates(), nMsg: st.message.length, chatId: st.chatId, chatPage: st.chatPage, last: st.message.at(-1)?.data?.slice(0, 160), lastRole: st.message.at(-1)?.role }; };
/** 채팅 화면 메시지별 보고서 카드 */
const screenCards = () => t.page.evaluate(() => [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].map((m) => ({ idx: Number(m.dataset.chatIndex), cards: [...m.querySelectorAll('[data-goei-card="report"]')].map((c) => c.innerText.replace(/\s+/g, ' ').match(/사건 보고서\s*\S+\s*\S+\s*(.+?)\s(?:대기|내|그 외|미투입|참여)/)?.[1] ?? c.innerText.replace(/\s+/g, ' ').slice(0, 60)), raw: /\[(AN|IN|MS|AG)\|/.test(m.querySelector('.chattext')?.innerText ?? ''), status: !!m.querySelector('[data-goei-status]'), text: (m.querySelector('.chattext')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 80) })).filter((m) => m.idx >= 0).sort((a, b) => a.idx - b.idx));
const cardsBrief = async () => (await screenCards()).filter((m) => m.cards.length || m.raw).map((m) => ({ idx: m.idx, cards: m.cards, raw: m.raw }));

/** 대본 한 턴 (lib.turn 과 같되 첫 요청을 돌려줌). sendFn 없으면 입력칸 보내기 */
async function turn(def, sendFn, userText = '다음으로 간다.', o = {}) {
  writeFileSync(t.REPLY, '(아직)');
  const seq0 = await t.fakeSeq();
  if (sendFn) await sendFn(); else { await t.closeWindow().catch(() => {}); await t.send(userText, { wait: false }); }
  const rec = await waitMain(t, seq0);
  if (!rec) return { ok: false, error: '본편 요청 안 옴', seq0 };
  const req = readRequest(rec.body);
  const d = typeof def === 'function' ? def(req) : def;
  const reply = typeof d === 'string' ? d : buildReply(req, d);
  writeFileSync(t.REPLY, reply);
  if (o.beforeRelease) await o.beforeRelease(rec, req, reply);
  await t.fake('release', { seq: rec.seq });
  if (o.noWait) return { ok: true, rec, req, reply, seq0 };
  await t.waitBusy(5000).catch(() => {});
  await t.waitIdle();
  await quietAux(t);
  return { ok: true, rec, req, reply, seq0, aux: await t.fakeLog(seq0, 'aux') };
}
async function setCardsAll() {
  await reopen();
  await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="set"]').catch(() => {}); await fc('[data-action="ed-node"][data-value="set:journal"]');
  await fc('[data-action="jr-set"][data-value="chat_card=all"]'); await sleep(800);
  await closeSettings(); await t.closeWindow(); await sleep(800);
}
async function handClose(name = '소라 랜드') {
  await reopen(); await navTo('board');
  const key = (await acts(/^ops-sel$/)).find((x) => x.t.includes(name))?.v;
  if (!key) return { error: 'ops-sel 없음 ' + name };
  await fc(`[data-action="ops-sel"][data-value="${key}"]`); await fc(`[data-action="end-event"][data-value="${key}"]`); await fc(`[data-action="end-event"][data-value="${key}"]`);
  await sleep(1000); await t.closeWindow();
  return { key };
}
const lastIdx = async () => (await t.chatState()).message.length - 1;

// ── 화면 판독 도우미 ──
const metrics = () => F().evaluate(() => {
  const W = innerWidth, H = innerHeight, se = document.scrollingElement;
  const d = (e) => (e.dataset?.action ? `[${e.dataset.action}${e.dataset.value ? '=' + e.dataset.value : ''}]` : '') + e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.');
  const inScroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const out = [], clip = [];
  for (const e of document.querySelectorAll('.gx *')) {
    if (e.closest('.gx-mclose')) continue; // 하단 바 쓸어 닫기 X (일부러 화면 밖, aria-hidden)
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if ((r.right > W + 1 || r.left < -1) && !inScroller(e)) out.push(d(e) + ` x${Math.round(r.left)}..${Math.round(r.right)}`);
    if (!e.children.length && (e.innerText ?? '').trim() && e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') clip.push(d(e) + ':' + e.innerText.trim().slice(0, 24));
  }
  return { W, H, hOver: se.scrollWidth - se.clientWidth, nOut: out.length, out: out.slice(0, 6), nClip: clip.length, clip: clip.slice(0, 6) };
});
/** 보이는 단추들 가운데 가운데 점이 화면 밖이거나 다른 것에 덮인 것 */
const hitTest = (re) => F().evaluate((src) => {
  const r0 = new RegExp(src), W = innerWidth, H = innerHeight;
  return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r0.test(e.dataset.action)).map((e) => {
    const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const inView = x >= 0 && y >= 0 && x <= W && y <= H; const top = inView ? document.elementFromPoint(x, y) : null;
    return { a: e.dataset.action, v: e.dataset.value ?? null, inView, hit: !!top && (top === e || e.contains(top)), by: top && !(top === e || e.contains(top)) ? (top.dataset?.action ?? top.className?.toString().slice(0, 30)) : null, h: Math.round(r.height) };
  }).filter((x) => !x.inView || !x.hit);
}, re.source);

try {
  // ═══════════ 1. 폰·폴드 크기에서 기록 화면 조작 ═══════════
  if (on('size') || on('fold')) {
    await boot();
    const hc = await handClose('소라 랜드');
    const tr = await turn(T('쟈알디가 무전기를 내려놓았다.\n\n<img=Jyaldi_serious>\n\n"명일 아파트 격리 끝."', closeAN('명일 아파트', '현관이 봉인되고 입주민 대피가 끝났다')), null, '현장 정리를 지켜본다.');
    await setCardsAll();
    await t.page.evaluate(() => document.querySelector('.default-chat-screen [data-goei-card="report"]')?.scrollIntoView({ block: 'center' }));
    await sleep(500);
    const cardShot = await shot(`s0-${SIZE}-chatcard`);
    const cardBox = await t.page.evaluate(() => { const c = document.querySelector('.default-chat-screen [data-goei-card="report"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), vw: innerWidth, over: r.right > innerWidth + 1 || r.left < -1 }; });
    step('S0', `${SIZE} 채팅 속 보고서 카드`, cardBox ? !cardBox.over : false, '카드가 화면 폭 안 (가로 넘침 없음), 캡처 판독', '코스 J1·5장 화면, Claude 판정', { hc, turnOk: tr.ok, cardBox, cardShot, cards: await cardsBrief() });

    const sizeRound = async (tag) => {
      const got = { tag };
      await reopen(); await navTo('records'); await sleep(600);
      got.layout = (await isMbar()) ? 'phone(mbar)' : 'pc(nav)';
      got.views = {};
      for (const sub of ['journal', 'chronicle', 'people', 'factions']) {
        const tapped = await tap(`[data-action="rec-sub"][data-value="${sub}"]`);
        const cur = await F().evaluate(() => document.querySelector('[data-action="rec-sub"].on')?.dataset.value ?? null);
        got.views[sub] = { tapped, cur, m: await metrics(), bad: await hitTest(/^rec-/), shot: await shot(`s1-${tag}-${sub}`) };
      }
      await tap('[data-action="rec-sub"][data-value="journal"]');
      got.filters = {};
      for (const f of ['mine', 'bg', 'all']) { const tapped = await tap(`[data-action="rec-filter"][data-value="${f}"]`); got.filters[f] = { tapped, on: await F().evaluate(() => document.querySelector('[data-action="rec-filter"].on')?.dataset.value ?? null), n: (await acts(/^rec-open$/)).length }; }
      const opens = await acts(/^rec-open$/);
      const target = opens.find((x) => /명일/.test(x.t)) ?? opens[0];
      got.open = { target: target?.t, tapped: target ? await tap(`[data-action="rec-open"][data-value="${target.v}"]`) : false };
      got.report = { m: await metrics(), shotTop: await shot(`s2-${tag}-report-top`) };
      await F().evaluate(() => { const c = document.querySelector('.gx-rptcard'); if (c) { const s = [c, ...c.querySelectorAll('*')].find((x) => x.scrollHeight > x.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(x).overflowY)); (s ?? c).scrollTop = 99999; } });
      await sleep(400);
      got.report.bad = await hitTest(/^rec-(pin|png|back)$/);
      got.report.shotEnd = await shot(`s2-${tag}-report-end`);
      if (target) {
        got.pin = { tapped: await tap(`[data-action="rec-pin"][data-value="${target.v}"]`) }; await sleep(600);
        got.pin.saved = sumRpts((await rows()).r);
        got.pin.pressed = await F().evaluate(() => document.querySelector('[data-action="rec-pin"]')?.getAttribute('aria-pressed'));
        got.png = { tapped: await tap(`[data-action="rec-png"][data-value="${target.v}"]`) }; await sleep(3500);
        got.png.img = await F().evaluate(() => { const i = document.querySelector('.gx-pngcard img'); return i ? { w: i.naturalWidth, h: i.naturalHeight } : null; });
        got.png.m = await metrics(); got.png.bad = await hitTest(/^rec-png/); got.png.shot = await shot(`s3-${tag}-png`);
        const x = await F().evaluate(() => !!document.querySelector('.gx-pngcard [data-action="rec-png-x"]'));
        if (x) await tap('.gx-pngcard .gx-agpop-x[data-action="rec-png-x"]');
        got.png.closed = !(await F().evaluate(() => !!document.querySelector('.gx-pngcard')));
        // 고정 풀기 (다음 라운드도 같은 출발)
        await tap(`[data-action="rec-pin"][data-value="${target.v}"]`); await sleep(500);
      }
      // 보고서 닫기 → 상황판 → 기록 (오가기)
      const back = await F().evaluate(() => !!document.querySelector('.gx-rptcard .gx-agpop-x'));
      if (back) await tap('.gx-rptcard .gx-agpop-x');
      got.afterBack = { report: await F().evaluate(() => !!document.querySelector('.gx-rptcard')), sub: await F().evaluate(() => document.querySelector('[data-action="rec-sub"].on')?.dataset.value ?? null) };
      await tap('[data-action="rec-sub"][data-value="people"]');
      await navTo('board'); await sleep(500);
      const boardShot = await shot(`s4-${tag}-board`);
      await navTo('records'); await sleep(500);
      got.revisit = { sub: await F().evaluate(() => document.querySelector('[data-action="rec-sub"].on')?.dataset.value ?? null), list: (await acts(/^rec-open$/)).length, boardShot, shot: await shot(`s4-${tag}-records-again`) };
      // 보고서를 연 채 앞뒤(뒤로) 단추
      const o2 = (await acts(/^rec-open$/))[0];
      if (o2) { await tap(`[data-action="rec-open"][data-value="${o2.v}"]`); const nb = (await acts(/^nav-back$/))[0]; got.navBack = { has: !!nb }; if (nb) { await tap('[data-action="nav-back"]'); got.navBack.report = await F().evaluate(() => !!document.querySelector('.gx-rptcard')); got.navBack.tab = await F().evaluate(() => document.querySelector('[data-action="nav-tab"].on, .gx-mbar .on')?.dataset.value ?? null); got.navBack.shot = await shot(`s5-${tag}-navback`); } }
      return got;
    };
    if (on('size')) {
      const g = await sizeRound(SIZE);
      const viewsOk = Object.values(g.views).every((v) => v.cur && v.m.hOver <= 1 && v.m.nOut === 0 && v.bad.length === 0);
      step('S1', `${SIZE} 일지·연대기·인물·세력 보기 바꾸기·걸러 보기`, viewsOk && g.filters.mine.on === 'mine' && g.filters.all.n >= 2, '네 보기 모두 눌리고(탭) 그 보기로 바뀜, 가로 넘침·화면 밖 요소 0, 덮인 단추 0 / 걸러 보기 내 것 0건·전체 2건 (캡처 판독)', '코스 J1·2-3, 공-13(배치 다름은 버그 아님)', { layout: g.layout, views: g.views, filters: g.filters, tapFails: res.tapFails ?? [] });
      step('S2', `${SIZE} 보고서 열기·고정·PNG`, !!g.open.tapped && g.pin.pressed === 'true' && g.pin.saved.some((x) => /PIN/.test(x)) && g.png.img?.w === 900 && g.report.bad.length === 0 && g.png.closed, '보고서 창이 화면 안, 끝까지 내리면 고정·이미지로 저장 단추가 덮이지 않고 눌림 → 고정 저장, 900×1200 PNG 미리보기·닫기', '코스 J1, J-02', { open: g.open, report: g.report, pin: g.pin, png: g.png });
      step('S3', `${SIZE} 기록 화면 오가기`, g.afterBack.report === false && g.revisit.list >= 2, '보고서 닫기 → 목록, 상황판 다녀오면 기록은 일지 목록으로 (app.ts 탭 들어올 때 journal/list)', 'Claude 판정 (코드 ui/app.ts:1263)', { afterBack: g.afterBack, revisit: g.revisit, navBack: g.navBack });
    }
    if (on('fold')) {
      // 설정 「펼친 폴드 화면 배치」·배율·창 가로·세로: 기본값과 끝값
      const prefs = () => t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return cs.pluginStorage.getItem('goei:prefs'); });
      const setFold = async (kv) => {
        await reopen();
        await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="set"]').catch(() => {}); await fc('[data-action="ed-node"][data-value="set:screen"]').catch(() => {});
        await shot(`fold-set-${Object.entries(kv).map(([k, v]) => k + v).join('-')}`);
        const found = {};
        for (const [k, v] of Object.entries(kv)) {
          if (k === 'fold') { const b = await F().evaluate((v) => [...document.querySelectorAll('[data-action]')].find((e) => /fold/.test(e.dataset.action) && !/zoom|-w|-h/.test(e.dataset.action) && (e.dataset.value === v || e.dataset.value?.endsWith('=' + v) || e.dataset.value?.endsWith(':' + v)))?.outerHTML.slice(0, 160) ?? null, v); found[k] = b; const m = b?.match(/data-action="([^"]+)" data-value="([^"]+)"|data-value="([^"]+)"[^>]*data-action="([^"]+)"/); if (m) await fc(`[data-action="${m[1] ?? m[4]}"][data-value="${m[2] ?? m[3]}"]`); continue; }
          const sel = `input[data-change="set-fold-${k}"]`;
          found[k] = await F().evaluate((s) => !!document.querySelector(s), sel);
          if (found[k]) { await F().locator(sel).first().fill(String(v)); await F().locator(sel).first().dispatchEvent('change'); await sleep(900); }
        }
        await closeSettings(); await t.closeWindow(); await sleep(800);
        return { found, prefs: await prefs() };
      };
      const variants = [
        ['default', {}],
        ['zoom50', { zoom: 50 }], ['zoom100', { zoom: 100 }],
        ['wh50', { zoom: 70, w: 50, h: 50 }], ['wh100', { w: 100, h: 100 }],
        ['phone', { w: 95, h: 95, fold: 'phone' }],
      ];
      const fres = {};
      for (const [tag, kv] of variants) {
        const set = Object.keys(kv).length ? await setFold(kv) : { prefs: await prefs() };
        const g = await sizeRound(`${SIZE}-${tag}`);
        fres[tag] = { set, g };
        const viewsOk = Object.values(g.views).every((v) => v.cur && v.m.hOver <= 1 && v.m.nOut === 0 && v.bad.length === 0);
        step('F-' + tag, `${SIZE} 폴드 ${tag}: 기록 보기·보고서·PNG·오가기`, viewsOk && !!g.open.tapped && g.pin?.pressed === 'true' && g.png?.img?.w === 900 && g.report.bad.length === 0 && g.afterBack.report === false, `설정 ${JSON.stringify(kv)} 에서 네 보기·보고서·고정·PNG 가 화면 안에서 눌림 (캡처 판독). 기본: PC 배치·배율 70·창 95% / phone: 344 폰 배치 그대로`, 'K-10 사용자 결정, M-08, 코스 2-3', { set, layout: g.layout, views: Object.fromEntries(Object.entries(g.views).map(([k, v]) => [k, { cur: v.cur, m: v.m, bad: v.bad, shot: v.shot }])), report: g.report, pin: g.pin, png: g.png, afterBack: g.afterBack, revisit: g.revisit, tapFails: (res.tapFails ?? []).splice(0), navFails: (res.navFails ?? []).splice(0) });
      }
      await setFold({ fold: 'pc', zoom: 70, w: 95, h: 95 });
    }
  }

  // ═══════════ 2. 공통 갈래 ═══════════
  if (on('c-swipe')) {
    // A: 아무것도 안 끝냄 → 다시 굴려 B: 명일 격리 → ◀ A / ▶ B / ◀ A 에서 새로 보내기
    await boot(); await setCardsAll();
    const a = await turn(T(PROSE + ' (A: 안 끝냄)'), null, '현장을 둘러본다.');
    const iA = await lastIdx();
    const sA = await snap('A 뒤');
    const b = await turn(T('쟈알디가 무전기를 내려놓았다. (B: 명일 격리)', closeAN('명일 아파트')), () => t.reroll({ wait: false }));
    const sB = await snap('B(다시 굴림) 뒤');
    const cB = await cardsBrief();
    step('SW-0', '다시 굴린 B 가 명일을 끝냄 → 일지·보고서·카드', sB.journal.some((x) => /명일/.test(x)) && sB.an['명일 아파트'] !== '활성', 'B 의 종료가 일지·보고서·상황판에 반영, 카드는 B 아래', '공-01, J-03', { sA, sB, cards: cB });
    const seq0 = await t.fakeSeq();
    const idA = (await t.chatState()).message[iA]?.chatId;
    await t.swipePrev(); await sleep(1500);
    const sP = await snap('◀ A');
    const scrP = (await t.screenMessages()).find((m) => m.idx === iA)?.text ?? '';
    const cP = await cardsBrief();
    const reqP = await t.fakeLog(seq0);
    await shot('sw-prev');
    step('SW-1', '◀ 로 A 를 보면: 화면은 A(안 끝냄), 기록·상황판·카드는 B 그대로 (모델·플러그인 처리 없음)', /A: 안 끝냄/.test(scrP) && reqP.length === 0 && sP.journal.some((x) => /명일/.test(x)), '리스AI 가 글만 갈아 끼움 → 요청 0건, 일지·보고서·상황판은 마지막으로 처리한 B 기준 (기준 1: 리스AI 동작). 카드는 상태창 원문으로 붙어 A 아래에도 보일 수 있음 → 사실 기록', '코스 5장 ◀▶ 칸, Claude 판정', { screenA: scrP.slice(0, 100), requests: reqP.map((x) => x.route), sP, cards: cP, chatIdBefore: idA, chatIdAfter: (await t.chatState()).message[iA]?.chatId });
    await t.swipeNext({ wait: false }); await sleep(1500);
    const sN = await snap('▶ B');
    const reqN = await t.fakeLog(seq0);
    step('SW-2', '▶ 로 B 로 돌아오면 요청 0건, 기록 그대로', reqN.length === 0 && /B: 명일/.test((await t.screenMessages()).find((m) => m.idx === iA)?.text ?? ''), '글만 다시 B, 요청 0건, 기록 그대로', '코스 5장', { sN, requests: reqN.map((x) => x.route), cards: await cardsBrief() });
    await t.swipePrev(); await sleep(1200);
    const c = await turn(T(PROSE + ' (C)'), null, '다음 일을 묻는다.');
    const sC = await snap('◀ A 에서 새로 보냄 → C 뒤');
    const reqC = readRequest(c.rec.body);
    const histHasA = reqC.all.some((x) => /A: 안 끝냄/.test(x)), histHasB = reqC.all.some((x) => /B: 명일/.test(x));
    const mingInReq = reqC.entries.find((e) => /명일/.test(e.tag))?.tag ?? null;
    saveText(OUT + '/sw-C-request.txt', reqText(c.rec.body));
    step('SW-3', '◀ A 를 둔 채 새로 보내면: B 가 만든 종료·보고서는 되돌아가고(A 가 채팅에 남음) 다음 요청 상황판도 B 전 상태', !sC.journal.some((x) => /명일/.test(x)) && sC.an['명일 아파트'] === '활성' && histHasA && !histHasB, '플러그인은 B(마지막 처리 응답)가 채팅에 없으면 지운 응답으로 보고 B 전 상태로 되감음(output.ts rerollBase 「지움」). 다음 요청 히스토리엔 A, World Entries 에 명일 활성', '공-01·공-02(되감기 기준 Claude 판정), D-04', { sC, histHasA, histHasB, mingInReq, req: OUT + '/sw-C-request.txt' });
  }

  if (on('c-del')) {
    await boot(); await setCardsAll();
    const a = await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const sA = await snap('A 뒤');
    // 보고서 고정 (기록 창)
    await reopen(); await navTo('records');
    const o = (await acts(/^rec-open$/)).find((x) => /명일/.test(x.t));
    if (o) { await fc(`[data-action="rec-open"][data-value="${o.v}"]`); await fc(`[data-action="rec-pin"][data-value="${o.v}"]`); }
    await t.closeWindow();
    const sPin = await snap('고정 뒤');
    const iA = await lastIdx();
    await t.deleteMessage(iA); await sleep(1500);
    const sDel = await snap('A 지운 직후');
    await reopen(); await navTo('records'); const recDel = (await ftext('.gx-body, main'))?.slice(0, 300); await shot('del-records-after-delete'); await t.closeWindow();
    step('DEL-1', '마지막 응답 A 를 지운 직후: 기록은 아직 그대로', null, '사실 기록: 되감기는 다음 응답이 처리될 때(output.ts rerollBase 「지움」). 지운 직후엔 일지·보고서·상황판 그대로', 'Claude 판정 (코드 core/world/output.ts:111)', { sPin, sDel, recDel });
    const d = await turn(T(PROSE + ' (D)'), null, '다시 말을 건다.');
    const sD = await snap('새로 보낸 D 뒤');
    step('DEL-2', '지우고 새로 보내면 A 가 만든 일지·보고서(고정한 것도)·종료가 되돌아감', !sD.journal.some((x) => /명일/.test(x)) && !sD.reports.some((x) => /명일/.test(x)) && sD.an['명일 아파트'] === '활성', '명일 일지·고정 보고서 빠지고 상황판 명일 활성', 'J-03, D-04, 공-01', { sD, cards: await cardsBrief() });
  }

  if (on('c-mid')) {
    await boot(); await setCardsAll();
    await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const iA = await lastIdx();
    await turn(T('잼트리가 보고했다. (B: 꿈과 희망의 극단 격리)', closeAN('꿈과 희망의 극단')), null, '다음 현장 소식을 듣는다.');
    const sB = await snap('A·B 뒤');
    await t.deleteMessage(iA); await sleep(1500);
    const sDel = await snap('가운데 A 지운 직후');
    const cDel = await cardsBrief();
    await shot('mid-after-delete');
    const c = await turn(T(PROSE + ' (C)'), null, '정리하고 돌아간다.');
    const sC = await snap('C 뒤');
    step('MID-1', '가운데 응답 A 를 지우고 새로 보내도 마지막 응답 B 의 종료·보고서는 그대로(잘못 되감지 않음)', sC.journal.some((x) => /꿈과/.test(x)) && sC.an['꿈과 희망의 극단'] !== '활성', 'B(마지막 처리) 것은 남음 (0.21.34 가운데 응답 따로)', '코스 5장, 업데이트내역 v0.21.34', { sB, sDel, cardsAfterDel: cDel, sC });
    step('MID-2', '지운 가운데 응답 A 가 만든 명일 종료·보고서', null, '사실 기록: 기준 상태가 하나라 가운데 응답의 것은 되돌아가지 않음(공-23 과 같은 뿌리). 남는지 확인', '공-23 (Claude 판정·알고 넘긴 한계), store.ts 머리 「일지는 영구 보관」', { journal: sC.journal, reports: sC.reports, an: sC.an });
    // 내 말만 지우기: C 앞 내 말
    const iU = (await lastIdx()) - 1;
    const um = (await t.chatState()).message[iU];
    await t.deleteMessage(iU); await sleep(1500);
    const sU = await snap('내 말만 지운 직후');
    const e = await turn(T(PROSE + ' (E)'), null, '한숨 돌린다.');
    const sE = await snap('E 뒤');
    const reqE = readRequest(e.rec.body);
    step('MID-3', '내 말만 지우고 새로 보내면 아무것도 되감기지 않음', sE.journal.some((x) => /꿈과/.test(x)) && sE.an['꿈과 희망의 극단'] !== '활성' && JSON.stringify(sE.journal) === JSON.stringify(sU.journal), '일지·보고서·상황판 그대로, 다음 요청 정상', '공-02 (Claude 판정)', { deletedRole: um?.role, sU, sE, reqMsgs: reqE.nMsgs });
    // 그 뒤 마지막 응답 다시 굴리기: E 것만 되감김
    const r = await turn(T(PROSE + ' (E2: 명일과 무관)', closeAN('소라 랜드')), () => t.reroll({ wait: false }));
    const sR = await snap('E 다시 굴림(소라 격리) 뒤');
    step('MID-4', '내 말을 지운 뒤 마지막 응답 다시 굴리기: 새 답의 종료만 반영, 앞 것 그대로', sR.an['소라 랜드'] !== '활성' && sR.an['꿈과 희망의 극단'] !== '활성', '소라 격리 반영, 꿈 그대로', 'J-03, 공-01', { sR });
  }

  if (on('c-multi')) {
    await boot(); await setCardsAll();
    await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const iA = await lastIdx();
    await turn(T('잼트리가 보고했다. (B: 꿈과 희망의 극단 격리)', closeAN('꿈과 희망의 극단')), null, '다음 현장 소식을 듣는다.');
    const iB = await lastIdx();
    const s0 = await snap('A·B 뒤');
    await t.deleteMessage(iB); await sleep(1200); await t.deleteMessage(iB - 1); await sleep(1200); await t.deleteMessage(iA); await sleep(1500);
    const sDel = await snap('B·내 말·A 연달아 지운 뒤');
    const c = await turn(T(PROSE + ' (C)'), null, '처음부터 다시 묻는다.');
    const sC = await snap('C 뒤');
    step('MULTI-1', '응답 둘(A·B)을 연달아 지우고 새로 보내면: 마지막 B 만 되돌아가고 A 의 명일 종료·보고서는 남음', sC.an['꿈과 희망의 극단'] === '활성' && !sC.journal.some((x) => /꿈과/.test(x)) && sC.journal.some((x) => /명일/.test(x)), '알고 넘긴 한계 그대로(상황판은 마지막 하나만): 꿈 되돌아감, 명일은 남음', '공-23 (Claude 판정, 알고 넘긴 한계)', { s0, sDel, sC, cards: await cardsBrief() });
  }

  if (on('c-cont')) {
    await boot(); await setCardsAll();
    const a = await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const sA = await snap('A 뒤');
    const c1 = await turn(T('(이어 씀) 잼트리가 덧붙였다. 꿈과 희망의 극단도 정리됐다.', closeAN('꿈과 희망의 극단')), () => t.continueReply({ wait: false }));
    const s1 = await snap('이어 쓰기(스트리밍 끔) 뒤');
    const st1 = await t.chatState(true);
    step('CONT-1', '이어 쓰기(스트리밍 끔): 이어 쓴 답의 종료가 일지·보고서에 들어가고 저장 본문에서 태그가 빠짐', s1.journal.some((x) => /꿈과/.test(x)) && s1.an['꿈과 희망의 극단'] !== '활성' && !/\[AN\|/.test(st1.message.at(-1).data), '리스AI 가 char 「*says nothing*+답」 을 새 칸으로 넣음 → 평소 응답처럼 처리 (명일·꿈 둘 다)', '코스 5장 이어 쓰기 칸, T2 사용법 리스AI 동작 1, Claude 판정', { sA, s1, last2: st1.message.slice(-2).map((m) => m.role + ': ' + String(m.data).slice(0, 120)), cards: await cardsBrief(), lastReqTail: c1.rec?.body?.messages?.slice(-2).map((m) => m.role + ': ' + text(m.content).slice(0, 80)) });
    await t.setStreaming(true);
    await turn(T(PROSE + ' (B)'), null, '잠깐 쉰다.');
    const c2 = await turn(T('(이어 씀2) 소라 랜드도 끝났다.', closeAN('소라 랜드')), () => t.continueReply({ wait: false }));
    const s2 = await snap('이어 쓰기(스트리밍 켬) 뒤');
    const st2 = await t.chatState(true);
    const scr2 = await screenCards();
    await shot('cont-stream');
    step('CONT-2', '이어 쓰기(스트리밍 켬): 리스아이가 이어 쓴 글을 user 「*says nothing*」 칸 끝에 붙임 → 그 종료 표식', null, '사실 기록: 붙은 칸 role, 소라 종료 반영 여부, 저장 본문·화면에 태그가 남는지, 다음 요청에 태그가 가는지', '코스 5장, T2 사용법 리스AI 동작 1', { s2, last2: st2.message.slice(-2).map((m) => m.role + ': ' + String(m.data).slice(0, 200)), screenLast: scr2.slice(-2) });
    const n = await turn(T(PROSE + ' (N)'), null, '다음으로.');
    const reqN = n.rec.body.messages.map((m) => m.role + ': ' + text(m.content)).filter((x) => /\[AN\|/.test(x) && /소라/.test(x)).map((x) => x.slice(0, 200));
    saveText(OUT + '/cont-next-request.txt', reqText(n.rec.body));
    const sN = await snap('그다음 턴 뒤');
    step('CONT-3', '스트리밍 켬 이어 쓰기 다음 턴: 남은 태그가 요청 히스토리에 가는지·상황판', null, '사실 기록 (요청 히스토리에서 상황판 태그는 assistant 만 걷음: body.ts stripHistoryTags)', 'Claude 판정', { tagLinesInReq: reqN, sN, req: OUT + '/cont-next-request.txt' });
  }

  if (on('c-edit')) {
    await boot(); await setCardsAll();
    await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const iA = await lastIdx();
    const s0 = await snap('A 뒤'); const c0 = await cardsBrief();
    const data0 = (await t.chatState(true)).message[iA].data;
    // ① 본문만 고침 (상태창 그대로)
    await t.editMessage(iA, data0.replace('쟈알디가', '쟈알디는 천천히')); await sleep(1500);
    const c1 = await cardsBrief(); const s1 = await snap('본문 고침 뒤');
    step('EDIT-1', '리스AI 에서 응답 본문만 고침: 기록·카드 그대로', JSON.stringify(s1.journal) === JSON.stringify(s0.journal) && c1.some((m) => m.idx === iA && m.cards.length), '처리 코드 없음 → 일지·보고서·카드 그대로 (카드는 상태창 원문 열쇠)', '코스 5장 「처리 코드 못 찾음」, Claude 판정', { s0, c0, s1, c1 });
    // ② 상태창 줄을 고침 (위치 칸)
    const data1 = (await t.chatState(true)).message[iA].data;
    await t.editMessage(iA, data1.replace('관리국 본부 로비', '관리국 본부 옥상')); await sleep(1500);
    const c2 = await cardsBrief(); const s2 = await snap('상태창 고침 뒤');
    await shot('edit-status');
    step('EDIT-2', '상태창 줄을 고치면 그 응답 아래 보고서 카드', null, '사실 기록: 카드 열쇠가 상태창 원문이라 고치면 카드가 사라질 수 있음. 보고서 자체·일지는 그대로', 'Claude 판정 (host/statusview.ts collectCards)', { s2, c2 });
    // ③ 손으로 종료 표식을 넣음
    const data2 = (await t.chatState(true)).message[iA].data;
    const tagLine = (s0 && (await t.chatState(true)).scriptstate) ? null : null;
    const req0 = (await t.fakeLog(0, 'main')).at(-1); const entries = readRequest(req0.body).entries;
    const kkum = entries.find((e) => /꿈과 희망/.test(e.tag));
    const injected = kkum ? kkum.tag.replace(/<[^>]+>/g, '없음').replace('|활성|', '|격리|') : null;
    if (injected) { await t.editMessage(iA, data2.replace(/(\[▣\|)/, injected + '\n$1')); await sleep(1500); }
    const s3 = await snap('표식 넣어 고친 뒤'); const scr3 = await screenCards();
    const n = await turn(T(PROSE + ' (N)'), null, '다음으로.');
    const sN = await snap('다음 턴 뒤');
    const reqHas = n.rec.body.messages.some((m) => m.role === 'assistant' && /꿈과 희망의 극단\|[^\]]*격리/.test(text(m.content)));
    step('EDIT-3', '고친 글에 종료 표식을 넣어도 상황판·일지는 안 바뀌고 다음 요청 히스토리에서 걷힘', sN.an['꿈과 희망의 극단'] === '활성' && !sN.journal.some((x) => /꿈과/.test(x)) && !reqHas, '고치기는 처리하지 않음(종료 반영 없음), 요청 히스토리 assistant 칸의 태그는 stripHistoryTags 로 걷힘. 화면에 표식 글이 보이는지는 사실 기록', 'Claude 판정', { injected, s3, screenA: scr3.find((m) => m.idx === iA), sN, reqHas });
  }

  if (on('c-push')) {
    // 답 오는 중 새 채팅(번호 +1) / 가져오기(번호 +1, 고른 번호 그대로)
    await boot(); await setCardsAll();
    const before = await t.chatState();
    writeFileSync(t.REPLY, '(아직)');
    const seq0 = await t.fakeSeq();
    await t.send('현장 정리를 지켜본다. (P1)', { wait: false });
    const rec = await waitMain(t, seq0);
    const req = readRequest(rec.body);
    writeFileSync(t.REPLY, buildReply(req, T('쟈알디가 무전기를 내려놓았다. (P1: 명일 격리)', closeAN('명일 아파트'))));
    const nc = await t.newChat();
    await sleep(800);
    await t.fake('release', { seq: rec.seq });
    await t.waitIdle().catch(() => {}); await quietAux(t);
    const all = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return { chatPage: c.chatPage, chats: c.chats.map((ch, i) => ({ i, name: ch.name, id: ch.id, n: ch.message.length, last: String(ch.message.at(-1)?.data ?? '').slice(0, 90), lastRole: ch.message.at(-1)?.role ?? null, goeiKeys: Object.keys(ch.scriptstate ?? {}).filter((k) => /goei|st_anomaly/.test(k)), journal: (() => { try { return JSON.parse(ch.scriptstate?.$goei_journal ?? 'null')?.rows?.map((r) => r.name) ?? null; } catch { return 'bad'; } })(), mingState: (() => { try { return JSON.parse(ch.scriptstate?.$goei_world ?? 'null')?.an?.find((e) => e.name === '명일 아파트')?.state ?? null; } catch { return 'bad'; } })() })) }; });
    await shot('push-newchat-after');
    const prog = await t.progText();
    step('PUSH-1', '답 오는 중 새 채팅(맨 앞, 번호 +1): 답이 어디 붙고 플러그인 기록은 어디에', null, '기준: 리스AI 는 보낼 때 잡은 채팅 번호(0)에 답을 씀 → 새 채팅에 답이 붙으면 리스AI 동작. 플러그인 탓은 (가) 답이 없는 채팅에 일지·상황판을 쓰거나 (나) 새 채팅에 괴이 상태를 반쯤 쓰거나 (다) 진행 창·기다림이 안 풀리는 것', '코스 5장 번호 밀기 칸, Claude 판정', { before: { chatPage: before.chatPage, chats: before.chats }, newChat: nc, after: all, prog });
    // 원래 채팅(이제 1번)으로 돌아가 보기
    await t.switchChat(1); await sleep(1200);
    const sOrig = await snap('원래 채팅(1번)');
    await reopen(); await navTo('records'); const recTxt = (await ftext('.gx-body, main'))?.slice(0, 300); await shot('push-orig-records'); await t.closeWindow();
    step('PUSH-2', '원래 채팅으로 돌아가면: 답 없는 내 말, 기록·상황판은 보내기 전 그대로', sOrig.lastRole === 'user' && !sOrig.journal.some((x) => /명일/.test(x)) && sOrig.an['명일 아파트'] === '활성', '원래 채팅엔 답이 없으니 명일 종료·보고서도 없음 (플러그인이 다른 채팅에 쓰지 않음)', 'Claude 판정', { sOrig, recTxt });
    // 그 상태에서 보내면 (답 없는 내 말이 둘)
    const n = await turn(T('쟈알디가 다시 무전기를 들었다. (P2: 명일 격리)', closeAN('명일 아파트')), null, '다시 묻는다. (P2)');
    const sN = await snap('원래 채팅에서 다시 보낸 뒤');
    step('PUSH-3', '원래 채팅에서 다시 보내면 정상 처리', sN.journal.some((x) => /명일/.test(x)) && sN.an['명일 아파트'] !== '활성', '명일 종료·일지 정상', 'Claude 판정', { sN });
    // 가져오기(번호 +1, 고른 번호 유지) 중 답
    writeFileSync(t.REPLY, '(아직)');
    const seq1 = await t.fakeSeq();
    await t.send('다음 현장으로. (P3)', { wait: false });
    const rec3 = await waitMain(t, seq1);
    writeFileSync(t.REPLY, buildReply(readRequest(rec3.body), T('잼트리가 보고했다. (P3: 꿈과 희망의 극단 격리)', closeAN('꿈과 희망의 극단'))));
    const pageBefore = (await t.chatState()).chatPage;
    const imp = await t.loadState(STATES + 'S-백일몽-3턴.json', { select: false, storage: false });
    await t.fake('release', { seq: rec3.seq });
    await t.waitIdle().catch(() => {}); await quietAux(t);
    const all3 = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return { chatPage: c.chatPage, chats: c.chats.map((ch, i) => ({ i, name: ch.name, n: ch.message.length, last: String(ch.message.at(-1)?.data ?? '').slice(0, 90), lastRole: ch.message.at(-1)?.role ?? null, journal: (() => { try { return JSON.parse(ch.scriptstate?.$goei_journal ?? 'null')?.rows?.map((r) => r.name) ?? null; } catch { return 'bad'; } })(), kkum: (() => { try { return JSON.parse(ch.scriptstate?.$goei_world ?? 'null')?.an?.find((e) => e.name === '꿈과 희망의 극단')?.state ?? null; } catch { return 'bad'; } })() })) }; });
    await shot('push-import-after');
    step('PUSH-4', '답 오는 중 다른 채팅 가져오기(번호 +1, 고른 번호 그대로): 답·기록이 어디에', null, '같은 기준 (리스AI 는 잡은 번호에 씀). 플러그인이 답 없는 채팅에 꿈 종료·일지를 쓰면 플러그인 탓', '코스 5장, states/README 넣는 차례', { pageBefore, imp, after: all3 });
  }

  if (on('c-reload')) {
    await boot(); await setCardsAll();
    await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const sA = await snap('A 뒤');
    await t.reload(); await sleep(1500);
    const sR = await snap('저장 끝난 뒤 새로고침');
    const cR = await cardsBrief();
    await reopen(); await navTo('records'); const recR = (await ftext('.gx-body, main'))?.slice(0, 200); await t.closeWindow();
    step('RL-1', '저장 끝난 뒤 새로고침: 일지·보고서·카드 그대로', JSON.stringify(sR.journal) === JSON.stringify(sA.journal) && cR.some((m) => m.cards.length), '그대로 남고 카드도 다시 그려짐', 'Claude 판정', { sA, sR, cR, recR });
    // 답을 풀자마자 새로고침 (리스아이가 답을 받기 전/처리 중)
    const b = await turn(T('잼트리가 보고했다. (B: 꿈과 희망의 극단 격리)', closeAN('꿈과 희망의 극단')), null, '다음 현장. (B)', { noWait: true });
    await t.reload({ settle: false }); await sleep(2000);
    const sB = await snap('답 풀자마자 새로고침');
    const fb = (await t.fakeLog(b.seq0, 'main')).map((x) => ({ seq: x.seq, action: x.action, closed: x.response?.closedByClient }));
    step('RL-2', '답을 받기 직전·직후 바로 새로고침', null, '사실 기록: 답이 채팅에 남았는지, 남았으면 태그가 걷혔는지(처리됐는지)와 일지·상황판이 같은 쪽인지. 둘이 갈리면(글엔 종료가 있는데 기록 없음, 또는 반대) 문제 후보', '코스 5장 새로고침 칸 「진행 중 작업은 메모리라 사라짐」, Claude 판정', { sB, fake: fb });
    // 답이 붙고 보내기 단추가 돌아오자마자 (리스아이 0.5초 저장 모음 전)
    const c = await turn(T('큐라스가 말했다. (C: 소라 랜드 격리)', closeAN('소라 랜드')), null, '다음. (C)', { noWait: true });
    await t.waitBusy(5000).catch(() => {});
    await t.page.waitForFunction(() => !document.querySelector('.default-chat-screen .loadmove') && !!document.querySelector('.default-chat-screen .button-icon-send'), null, { timeout: 60000 }).catch(() => {});
    await t.reload({ settle: false }); await sleep(2000);
    const sC = await snap('답 붙은 즉시 새로고침');
    const lastC = (await t.chatState(true)).message.at(-1);
    step('RL-3', '답이 붙은 즉시 새로고침(저장 모음 전)', null, '사실 기록: 저장 본문 태그 여부·소라 상황판·일지가 같은 쪽인지', '코스 5장, Claude 판정', { sC, lastRaw: /\[AN\|/.test(String(lastC?.data ?? '')), lastRole: lastC?.role });
    // 손으로 종료 누르고 바로 새로고침
    await reopen(); await navTo('board');
    const key = (await acts(/^ops-sel$/)).find((x) => /꿈과 희망|명일|소라/.test(x.t) && true)?.v;
    const live = await anStates();
    const pick = (await acts(/^ops-sel$/)).find((x) => Object.entries(live).some(([n, s]) => s === '활성' && x.t.includes(n)));
    if (pick) { await fc(`[data-action="ops-sel"][data-value="${pick.v}"]`); await fc(`[data-action="end-event"][data-value="${pick.v}"]`); await F().evaluate((v) => document.querySelector(`[data-action="end-event"][data-value="${v}"]`)?.click(), pick.v); }
    await t.reload({ settle: false }); await sleep(2000);
    const sH = await snap('손 종료 누르고 바로 새로고침');
    step('RL-4', '손으로 종료 두 번째 누르고 바로 새로고침', null, '사실 기록: 종료와 일지 줄이 같이 남거나 같이 없거나', 'Claude 판정', { pick: pick?.t, live, sH });
  }

  if (on('c-5xx')) {
    await boot(); await setCardsAll();
    await t.fake('rules/add', { rule: { id: 'm-5xx', route: 'main', hold: true, replyFile: t.REPLY, status: 503, failFirst: 1 } });
    writeFileSync(t.REPLY, '(아직)');
    const seq0 = await t.fakeSeq();
    await t.send('현장 정리를 지켜본다. (R)', { wait: false });
    const r1 = await waitMain(t, seq0);
    writeFileSync(t.REPLY, buildReply(readRequest(r1.body), T('쟈알디가 무전기를 내려놓았다. (R: 명일 격리)', closeAN('명일 아파트'))));
    await t.fake('release', { seq: r1.seq });
    const r2 = await waitMain(t, r1.seq, 30000);
    let progMid = await t.progText();
    if (r2) await t.fake('release', { seq: r2.seq });
    await t.waitIdle().catch(() => {}); await quietAux(t);
    await t.fake('rules/del', { id: 'm-5xx' });
    const log = await t.fakeLog(seq0);
    const sR = await snap('5xx 한 번 뒤 자동 재시도 성공');
    const st = await t.chatState(true);
    step('5XX-1', '본편 503 → 리스AI 자동 재시도: 같은 요청 그대로 한 번 더, 일지·보고서 한 번만', !!r2 && r2.hash === r1.hash && sR.journal.filter((x) => /명일/.test(x)).length === 1 && sR.reports.filter((x) => /명일/.test(x)).length === 1, '두 번째 본편 요청은 dupOf 첫 요청, 명일 일지·보고서 1건, 응답 1개', '코스 5장 「조립된 요청 그대로 다시 보냄」, Claude 판정', { main: log.filter((x) => x.route === 'main').map((x) => ({ seq: x.seq, status: x.response?.status, dupOf: x.dupOf })), aux: log.filter((x) => x.route === 'aux').map((x) => ({ seq: x.seq, sys: String(x.body?.messages?.[0]?.content ?? '').slice(0, 50) })), sR, chars: st.message.filter((m) => m.role === 'char').length, progMid, progEnd: await t.progText(), cards: await cardsBrief() });
  }

  if (on('c-wait')) {
    await boot(); await setCardsAll();
    await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    writeFileSync(t.REPLY, '(아직)');
    const seq0 = await t.fakeSeq();
    await t.send('다음 현장 소식을 듣는다. (B)', { wait: false });
    const rec = await waitMain(t, seq0);
    writeFileSync(t.REPLY, buildReply(readRequest(rec.body), T('잼트리가 보고했다. (B: 꿈과 희망의 극단 격리)', closeAN('꿈과 희망의 극단'))));
    // 답 오는 중: 보고서 고정 + 소라 손 종료
    await reopen(); await navTo('records');
    const o = (await acts(/^rec-open$/)).find((x) => /명일/.test(x.t));
    let pinBtn = null;
    if (o) { await fc(`[data-action="rec-open"][data-value="${o.v}"]`); pinBtn = (await acts(/^rec-pin$/))[0] ?? null; await fc(`[data-action="rec-pin"][data-value="${o.v}"]`).catch(() => {}); }
    const pinMid = sumRpts((await rows()).r);
    await shot('wait-pin');
    await navTo('board');
    const key = (await acts(/^ops-sel$/)).find((x) => x.t.includes('소라 랜드'))?.v;
    let endBtn = null;
    if (key) { await fc(`[data-action="ops-sel"][data-value="${key}"]`); endBtn = (await acts(/^end-event$/)).find((x) => x.v === key) ?? null; await fc(`[data-action="end-event"][data-value="${key}"]`).catch(() => {}); await fc(`[data-action="end-event"][data-value="${key}"]`).catch(() => {}); }
    await sleep(800);
    const sMid = await snap('답 오는 중 고정·손 종료 뒤');
    await shot('wait-end');
    await t.closeWindow();
    await t.fake('release', { seq: rec.seq });
    await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t);
    const sB = await snap('B 답 처리 뒤');
    step('WAIT-1', '본편 답 오는 중 보고서 고정·상황 종료: 답이 처리된 뒤에도 남음', sB.reports.some((x) => /명일.*PIN/.test(x)) && sB.an['소라 랜드'] !== '활성' && sB.journal.some((x) => /소라.*manual/.test(x)) && sB.an['꿈과 희망의 극단'] !== '활성', '고정·손 종료는 바로 저장(기다리지 않는 곳), 늦게 온 답 처리가 덮지 않음, 꿈 종료도 반영', '코스 5장 「본편 답 오는 중 그 기능 단추」, K-01 의 「늦게 온 답이 바꾼 값을 덮는지」 기준, Claude 판정', { pinBtn, endBtn, pinMid, sMid, sB });
    const rr = await turn(T(PROSE + ' (B2: 안 끝냄)'), () => t.reroll({ wait: false }));
    const sR = await snap('B 다시 굴림 뒤');
    step('WAIT-2', '그 B 를 다시 굴리면 B 의 꿈 종료만 되감기고 고정·손 종료는 남음', sR.an['꿈과 희망의 극단'] === '활성' && sR.an['소라 랜드'] !== '활성' && sR.reports.some((x) => /명일.*PIN/.test(x)), '꿈 활성, 소라 손 종료·명일 고정 남음', 'D-04, J-03', { sR });
  }

  if (on('c-think')) {
    await boot(); await setCardsAll();
    const t0 = await turn(T(PROSE + ' (T0)'), null, '주변을 살핀다.');
    const ming = t0.req.entries.find((e) => /명일 아파트/.test(e.tag));
    // 명일 종료 초안 줄 (생각 안에만 둠). World Entries 줄을 대본 규칙대로 채운 것
    const { worldTags } = await import('../D/lib.mjs');
    const mingLine = worldTags(t0.req.entries, t0.req.lore).find((x) => x.includes('명일 아파트')).replace('|활성|', '|격리|').replace(/\|[^|]*\]$/, '|생각 속 초안: 격리 끝]');
    const thoughtStatus = '[▣|2025.03.14|11:59 PM|☀️|12°C|생각 속 장소|없음|없음|없음|관리국/신입|999999]';
    const draft = `초안을 짠다.\n${mingLine}\n${thoughtStatus}\n이건 쓰지 말자.`;
    const combos = [['reasoning', false], ['reasoning', true], ['think', false], ['think', true]];
    const out = [];
    for (const [form, stream] of combos) {
      await t.setStreaming(stream);
      const last = form === 'think' && stream;
      if (form === 'reasoning') await t.fake('rules/add', { rule: { id: 'm-think', route: 'main', hold: true, replyFile: t.REPLY, reasoning: draft } });
      const r = await turn((req) => {
        const body = buildReply(req, T(`잼트리가 고개를 저었다. (${form}/${stream ? 'stream' : 'nostream'})`, last ? (w) => closeAN('꿈과 희망의 극단')(dropAN('명일 아파트')(w)) : dropAN('명일 아파트')));
        return form === 'think' ? `<think>\n${draft}\n</think>\n${body}` : body;
      }, null, `생각 갈래 ${form} ${stream}`);
      await t.fake('rules/del', { id: 'm-think' });
      const s = await snap(`${form}/${stream}`);
      const st = await t.chatState(true);
      const scr = (await screenCards()).at(-1);
      const statusBox = await t.page.evaluate(() => { const ms = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')]; const m = ms.sort((a, b) => b.dataset.chatIndex - a.dataset.chatIndex)[0]; return m?.querySelector('[data-goei-status]')?.innerText?.replace(/\s+/g, ' ').slice(0, 160) ?? null; });
      await shot(`think-${form}-${stream ? 's' : 'n'}`);
      const rep = last ? (await rows()).r?.items?.find((x) => x.head?.name === '꿈과 희망의 극단') : null;
      out.push({ form, stream, s, stored: String(st.message.at(-1).data).slice(0, 260), statusBox, screen: scr, rep: rep ? { place: rep.head?.place, result: rep.result, trail: JSON.stringify(rep.trail).slice(0, 300) } : null });
      step(`TH-${form}-${stream ? 'stream' : 'nostream'}`, `생각 블록(${form}, 스트리밍 ${stream ? '켬' : '끔'}) 안 명일 종료 초안·상태창 초안은 안 읽음${last ? ', 본문 꿈 종료는 반영' : ''}`,
        s.an['명일 아파트'] === '활성' && !s.journal.some((x) => /명일/.test(x)) && !/생각 속 장소/.test(statusBox ?? '') && (!last || (s.an['꿈과 희망의 극단'] !== '활성' && !!rep && !/생각 속/.test(JSON.stringify(rep)))),
        '상황판 태그·상태창·보고서가 생각 글을 읽지 않음 (공-21 이 C5 에서 보라고 한 칸, 처리 코드 output.ts splitThoughts)', '공-21 (Claude 판정), L-07(같은 기준)', out.at(-1));
    }
    await t.setStreaming(false);
  }

  if (on('c-off')) {
    await boot(); await setCardsAll();
    await turn(T('쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const sA = await snap('A 뒤');
    // 상황판 끄기 (기록은 상황판 종료로만 생김 — 기록 자체 스위치는 없음)
    await reopen();
    await fc('[data-action="ed-open"][data-value="set:screen"]');
    let found = null;
    for (const node of await acts(/^ed-node$/)) { if (await F().evaluate(() => !!document.querySelector('[data-action="set-anomaly"]'))) break; await fc(`[data-action="ed-node"][data-value="${node.v}"]`).catch(() => {}); }
    found = await F().evaluate(() => [...document.querySelectorAll('[data-action="set-anomaly"]')].map((e) => e.dataset.value));
    await fc('[data-action="set-anomaly"][data-value="off"]').catch(() => {}); await sleep(1000);
    await t.closeWindow();
    const sOff = await snap('상황판 끈 뒤');
    const cOff = await cardsBrief();
    const b = await turn(T('잼트리가 보고했다. (B: 꿈과 희망의 극단 격리)', closeAN('꿈과 희망의 극단')), null, '다음 현장. (B)');
    const sB = await snap('끈 채 B 뒤');
    const scrB = (await screenCards()).at(-1);
    await reopen(); await navTo('records'); const recB = (await ftext('.gx-body, main'))?.slice(0, 300); await shot('off-records'); await t.closeWindow();
    await shot('off-chat');
    step('OFF-1', '상황판(기록의 원천)을 끄면 새 일지·보고서가 안 생기고, 이미 쌓인 기록·카드는 남음, 기록 탭 열림', !sB.journal.some((x) => /꿈과/.test(x)) && sB.journal.some((x) => /명일/.test(x)), '끈 뒤 응답의 종료 표식은 처리 안 함. 일지는 영구 보관(store.ts 머리)이라 명일 줄 남음', 'Claude 판정 (기록 자체 끄는 스위치는 없음 — 결정표 J-02 「안 만듦」 목록에도 없음), 공-03', { found, sA, sOff, cOff, sB, lastScreen: scrB, recB, lastStoredRaw: /\[AN\|/.test((await t.chatState(true)).message.at(-1).data) });
  }

  if (on('foldwh')) { // 폴드 창 가로·세로 50% 에서 창이 안 보인 것 다시: 하나씩 바꿔 가름
    await boot();
    const prefs = () => t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return cs.pluginStorage.getItem('goei:prefs'); });
    const setIn = async (k, v) => { await reopen(); await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="set"]').catch(() => {}); await fc('[data-action="ed-node"][data-value="set:screen"]').catch(() => {}); const sel = `input[data-change="set-fold-${k}"]`; await F().locator(sel).first().fill(String(v)); await F().locator(sel).first().dispatchEvent('change'); await sleep(900); await closeSettings(); await t.closeWindow(); await sleep(800); };
    const probe = async (tag) => { await reopen(); await sleep(600); const p = await F().evaluate(() => { const e = document.querySelector('.gx .gx-panel'); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), styleW: cs.width, styleH: cs.height, display: cs.display, vis: cs.visibility, op: cs.opacity, iw: innerWidth, ih: innerHeight }; }); const fr = await t.page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => { const r = f.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vis: getComputedStyle(f).visibility, disp: getComputedStyle(f).display }; })); return { tag, prefs: await prefs(), panel: p, frames: fr, shot: await shot('fwh-' + tag) }; };
    const out = [];
    out.push(await probe('base'));
    await setIn('w', 50); out.push(await probe('w50'));
    await setIn('w', 95); await setIn('h', 50); out.push(await probe('h50'));
    await setIn('h', 60); out.push(await probe('h60'));
    await setIn('h', 95); await setIn('w', 60); out.push(await probe('w60'));
    await setIn('w', 95); out.push(await probe('back95'));
    await setIn('w', 50); await setIn('h', 50); out.push(await probe('both50'));
    await setIn('zoom', 100); await setIn('zoom', 70); out.push(await probe('both50-after-zoom'));
    await t.reload(); out.push(await probe('both50-after-reload'));
    await handClose('소라 랜드');
    await reopen(); await navTo('records'); await sleep(700);
    const vis = async () => ({ panel: await F().evaluate(() => { const e = document.querySelector('.gx .gx-panel'); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), op: cs.opacity, vis: cs.visibility, tr: cs.transform, gxDisp: getComputedStyle(document.querySelector('.gx')).display, gxOp: getComputedStyle(document.querySelector('.gx')).opacity, cls: document.querySelector('.gx').className }; }), frames: await t.page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => { const r = f.getBoundingClientRect(); const cs = getComputedStyle(f); return { w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, disp: cs.display, op: cs.opacity, z: cs.zIndex, pe: cs.pointerEvents }; })) });
    const dbg = { afterReopen: await vis() };
    await t.page.click('[x-goei-fab] button').catch(() => {}); await sleep(1200); dbg.afterFab = await vis(); await shot('fwh-both50-fabagain');
    await t.page.click('[x-goei-fab] button').catch(() => {}); await sleep(1200); dbg.afterFab2 = await vis();
    res.dbg50 = dbg;
    dbg.nav = await F().evaluate(() => { const t = document.querySelector('[data-action="nav-tab"][data-value="records"]'); const r = t.getBoundingClientRect(); const chain = []; for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowY !== 'visible' || p.scrollHeight > p.clientHeight + 2) chain.push({ cls: String(p.className).slice(0, 30), oy: cs.overflowY, sh: p.scrollHeight, ch: p.clientHeight, b: Math.round(p.getBoundingClientRect().bottom) }); } return { tab: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }, chain }; });
    // 메뉴 위를 손가락으로 위로 쓸어 기록 메뉴가 보이는지
    { const fb = await (await t.page.$('iframe')).boundingBox(); const nb = await F().evaluate(() => { const n = document.querySelector('.gx-nav'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.7, iw: innerWidth }; }); const k = fb.width / nb.iw; const cdp = await t.ctx.newCDPSession(t.page); const X = fb.x + nb.x * k, Y = fb.y + nb.y * k; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X, y: Y }] }); for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: X, y: Y - 15 * i }] }); await sleep(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(800); dbg.navAfterSwipe = await F().evaluate(() => { const r = document.querySelector('[data-action="nav-tab"][data-value="records"]').getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: Math.round(r.top), hit: !!top?.closest('[data-action="nav-tab"][data-value="records"]') }; }); await shot('fwh-both50-navswipe'); }
    const r50 = { dbg, onRec: await F().evaluate(() => !!document.querySelector('[data-action="nav-tab"][data-value="records"].on')), m: await metrics(), bad: await hitTest(/^rec-/), shot: await shot('fwh-both50-records') };
    const o = (await acts(/^rec-open$/))[0];
    if (o) { r50.open = await tap(`[data-action="rec-open"][data-value="${o.v}"]`); r50.rep = { m: await metrics(), bad: await hitTest(/^rec-(pin|png|back)$/), shot: await shot('fwh-both50-report') }; r50.pin = await tap(`[data-action="rec-pin"][data-value="${o.v}"]`); r50.pinSaved = sumRpts((await rows()).r); r50.png = await tap(`[data-action="rec-png"][data-value="${o.v}"]`); await sleep(3000); r50.pngImg = await F().evaluate(() => { const i = document.querySelector('.gx-pngcard img'); return i ? i.naturalWidth : null; }); r50.pngShot = await shot('fwh-both50-png'); }
    r50.tapFails = (res.tapFails ?? []).splice(0); r50.navFails = (res.navFails ?? []).splice(0);
    step('FWH-2', '폴드 창 가로·세로 50%: 기록 보기·보고서·고정·PNG', r50.onRec && !!r50.open && r50.pinSaved?.some((x) => /PIN/.test(x)) && r50.pngImg === 900, '끝값에서도 기록 화면이 열리고 보고서·고정·PNG 가 눌림 (캡처 판독)', 'K-10 사용자 결정', r50);
    step('FWH-1', '폴드 창 가로·세로를 50% 쪽으로 내렸을 때 창이 보이는지', out.every((x) => x.panel && x.panel.w > 100 && x.panel.h > 100), '설정 범위 50~100% 어디서든 창이 그 비율로 보임', 'K-10 사용자 결정 (폴드 창 가로·세로 %)', out);
  }

  if (on('land')) { // 폰 가로: 일지 목록이 첫 화면에서 안 보일 때 내려서 닿는지, PNG 창 아래 단추
    await boot();
    await handClose('소라 랜드');
    await turn(T('쟈알디가 무전기를 내려놓았다. (A)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    await reopen(); await navTo('records'); await sleep(600);
    const info = await F().evaluate(() => { const o = document.querySelector('[data-action="rec-open"]'); const r = o.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 1, r.top + r.height / 2)); const sc = []; for (let p = o.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) sc.push({ cls: String(p.className).slice(0, 40), sh: p.scrollHeight, ch: p.clientHeight, top: Math.round(p.getBoundingClientRect().top), bottom: Math.round(p.getBoundingClientRect().bottom) }); } return { row: { top: Math.round(r.top), bottom: Math.round(r.bottom) }, H: innerHeight, coveredBy: top ? (top.closest('[data-action]')?.dataset.action ?? String(top.className).slice(0, 40)) : null, scrollers: sc }; });
    await shot('land-0');
    // 손가락으로 목록 위를 위로 쓸기 (내리기)
    const fb = await (await t.page.$('iframe')).boundingBox();
    const cdp = await t.ctx.newCDPSession(t.page);
    const sw = async (x, y0, y1) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] }); for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 10 }] }); await sleep(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(800); };
    await sw(fb.x + fb.width / 2, fb.y + 180, fb.y + 60);
    const after = await F().evaluate(() => { const o = [...document.querySelectorAll('[data-action="rec-open"]')]; return o.map((e) => { const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20)); return { top: Math.round(r.top), bottom: Math.round(r.bottom), hit: !!top && (top === e || e.contains(top)) }; }); });
    await shot('land-1-swiped');
    const tapped = await tap('[data-action="rec-open"]');
    await shot('land-2-report');
    await sw(fb.x + fb.width / 2, fb.y + 280, fb.y + 40);
    const rep = await F().evaluate(() => { const c = document.querySelector('.gx-rptcard'); const b = document.querySelector('.gx-rptcard [data-action="rec-pin"]')?.getBoundingClientRect(); return { cardTop: Math.round(c?.getBoundingClientRect().top ?? -1), pinTop: b ? Math.round(b.top) : null }; });
    await shot('land-3-report-swiped');
    step('LAND-1', '폰 가로: 일지 목록이 첫 화면 밖이면 쓸어 내려 닿고 눌림', after.some((x) => x.hit) && tapped, '목록 줄이 쓸기로 화면 안에 들어와 탭으로 보고서가 열림 (캡처 판독)', 'M-09 (가로도 폰 배치), Claude 판정', { info, after, tapped, rep });
  }

  if (on('c-reload2') || on('c-reload2img')) { // RL-1 다시: 새로고침 뒤 보고서 카드가 다시 그려지는지 (시간을 두고, 채팅 오간 뒤). img 판은 종료 응답에 <img=> 를 넣음
    await boot(); await setCardsAll();
    await turn(T(on('c-reload2img') ? '쟈알디가 무전기를 내려놓았다.\n\n<img=Jyaldi_serious>\n\n"명일 격리 끝." (A)' : '쟈알디가 무전기를 내려놓았다. (A: 명일 격리)', closeAN('명일 아파트')), null, '현장 정리를 지켜본다.');
    const look = async () => t.page.evaluate(() => { const ms = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')]; const m = ms.sort((a, b) => b.dataset.chatIndex - a.dataset.chatIndex)[0]; return { idx: m?.dataset.chatIndex, status: !!m?.querySelector('[data-goei-status]'), card: m?.querySelectorAll('[data-goei-card="report"]').length ?? 0, rawStatus: /\[▣\|/.test(m?.querySelector('.chattext')?.innerText ?? '') }; });
    const b0 = await look(); await shot('rl2-before');
    await t.reload();
    const a1 = await look(); await sleep(8000); const a2 = await look(); await shot('rl2-after-8s');
    await sleep(15000); const a3 = await look();
    await t.switchChat(1); await sleep(1500); await t.switchChat(0); await sleep(2500);
    const a4 = await look(); await shot('rl2-after-switch');
    step('RL-1b', '저장 끝난 뒤 새로고침: 종료 응답 아래 보고서 카드가 다시 보이는지', a2.card > 0 || a3.card > 0, '새로고침 뒤에도 카드(설정 「전부」)가 보임. 안 보이면 채팅을 오가야 보이는지', 'Claude 판정 (코드 body.ts redrawAfterLoad 는 <img= 있는 글만 다시 그림), 코스 L3', { b0, a1, a2, a3, afterSwitch: a4 });
  }

  if (on('c-think2')) { // 생각 블록 안 상태창 줄: 화면 상자·잔고 차이·다음 요청 [Previous status]
    await boot();
    const t0 = await turn(T(PROSE + ' (T0)'), null, '주변을 살핀다.');
    const thoughtStatus = '[▣|2025.03.14|11:59 PM|☀️|12°C|생각 속 장소|없음|없음|없음|관리국/신입|999999]';
    const r = await turn((req) => `<think>\n초안.\n${thoughtStatus}\n</think>\n` + buildReply(req, T('잼트리가 고개를 저었다. (think)')), null, '생각 갈래.');
    const boxes = await t.page.evaluate(() => { const ms = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')]; const m = ms.sort((a, b) => b.dataset.chatIndex - a.dataset.chatIndex)[0]; return [...m.querySelectorAll('[data-goei-status]')].map((b) => b.innerText.replace(/\s+/g, ' ').slice(0, 120)); });
    await shot('think2-boxes');
    const wallet = (await t.chatState(true)).scriptstate?.$goei_wallet ?? null;
    const n = await turn(T(PROSE + ' (N)'), null, '다음.');
    const prev = readRequest(n.rec.body);
    const prevBlock = prev.all.filter((x) => x.startsWith('[Previous status]'));
    saveText(OUT + '/think2-next-request.txt', reqText(n.rec.body));
    step('TH2-1', '본문 <think> 안 상태창 줄: 화면 상자·잔고 차이·다음 요청 [Previous status] 가 생각 글을 읽는지', boxes.length === 1 && !boxes.some((b) => /생각 속/.test(b)) && !/생각 속|999999/.test(prevBlock.join('\n')), '생각 글의 상태창 줄은 상자로 그리지 않고, 본문 상자의 잔고 차이·다음 요청 [Previous status] 에도 안 들어감', '공-21 (Claude 판정), L-07 (이미지 보조도 생각 블록을 뗀다는 사용자 결정과 같은 기준)', { boxes, wallet: String(wallet).slice(0, 300), prevBlock, prevLine: prev.prevLine, req: OUT + '/think2-next-request.txt' });
  }

  if (on('c-other')) {
    await boot();
    const goei = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); return db.getDatabase().characters.length; });
    const idx = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const i = ch.createNewCharacter(); const c = st.DBState.db.characters[i]; c.name = 'T2 다른 봇'; c.firstMessage = '안녕하세요. 저는 평범한 봇입니다.'; return i; });
    await t.selectChar(idx); await sleep(1500);
    writeFileSync(t.REPLY, '(아직)');
    const seq0 = await t.fakeSeq();
    const reply = '평범한 답입니다.\n\n[AN|D|명일 아파트|12-10|격리|끝났다]\n[shop: 기독교 상점|블라렛]\n[▣|2025.03.14|10:20 AM|☀️|12°C|어딘가|없음|없음|없음|없음|1000]';
    writeFileSync(t.REPLY, reply);
    await t.send('안녕?', { wait: false });
    const rec = await waitMain(t, seq0);
    await t.fake('release', { seq: rec?.seq });
    await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await sleep(3000);
    const st = await t.chatState(true);
    const log = await t.fakeLog(seq0);
    const scr = await t.screenMessages();
    const goeiDom = await t.page.evaluate(() => ({ status: document.querySelectorAll('.default-chat-screen [data-goei-status]').length, card: document.querySelectorAll('.default-chat-screen [data-goei-card]').length }));
    await t.page.click('[x-goei-fab] button', { timeout: 3000 }).catch((e) => null); await sleep(1200);
    const win = await t.page.evaluate(() => !!document.querySelector('iframe') && [...document.querySelectorAll('iframe')].some((f) => f.offsetParent !== null && f.getBoundingClientRect().width > 100));
    await shot('other-bot');
    const mainBody = JSON.stringify(rec?.body?.messages ?? []);
    step('OTHER-1', '다른 봇 채팅: 답 글을 그대로 두고(표식 안 걷음) 기록·상태를 안 씀, 보조 호출 없음, 요청에 괴이 글 없음', st.message.at(-1)?.data === reply && !Object.keys(st.scriptstate ?? {}).some((k) => /goei|jr_|st_anomaly/.test(k)) && log.filter((x) => x.route === 'aux').length === 0 && !/Router|Anomaly|괴이|World Entries/.test(mainBody) && goeiDom.status === 0, '아무것도 안 함 (공-22). 유령 단추를 눌러도 창 없음', '공-22 (Claude 판정)', { idx, nChars: goei, stored: st.message.at(-1)?.data, scriptKeys: Object.keys(st.scriptstate ?? {}), aux: log.filter((x) => x.route === 'aux').length, mainLen: mainBody.length, screen: scr.slice(-1), goeiDom, fabWindow: win });
  }
} catch (e) {
  step('ERR', '예외', false, null, null, String(e?.stack ?? e).slice(0, 1500));
  await shot('ERR').catch(() => {});
} finally {
  res.errors = t.errors.filter((e) => !/displayData|\[goei\] (시작|본체|세계)/.test(e)).slice(0, 40);
  saveJson(OUT + '/result.json', res);
  console.log('OUT', OUT);
  await t.close();
}
