// 플레이 순서 점검 2차 · 20 메뉴·창·조작(PC/폰) (지침: ../../GPT_점검지침_초안.md 3판)
// 틀: 실제 번들(dist/goei-plugin.js·goei-body.js) + .scratch/fixture 카드 + 가짜 Risu(tests/qc-settings-harness.mjs).
// 이 기능은 보조 호출(runLLMModel)을 하지 않는다 → 호출 0 인지만 본다. 본편 요청에 플러그인 화면 표식이 새는지는 마지막에 한 번 본다.
// 저장 위치: 기기 설정 pluginStorage 'goei:prefs'(navFold·navAt·foldZoom·fold), 유령 단추 자리 safeLocalStorage 'goei-plugin:fab-pos'.
// 손가락 조작은 CDP Input.dispatchTouchEvent(터치·포인터 이벤트 둘 다 생김), 마우스는 page.mouse.
// 사용법: node 인수인계/플레이순서_점검/2차/20_메뉴_조작_폰/run.mjs [갈래 글자, 예: ABC]  A=PC B=폰 C=폴드 펼침 D=유령 단추 E=채팅 바꾸기
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const ONLY = (process.argv[2] ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PACKS = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
const results = [];
let N = 0;
const step = (name) => ({ n: String(++N).padStart(2, '0'), name });
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 500)}`}`);
}
const STATUS = '[▣|2025.03.14|11:20 PM|🌙|6°C|관리국 본부|없음|없음|없음|관리국/신입|1000]';
const chatOf = (extra = {}) => ({
  message: [
    { role: 'user', data: '사무실에 들어간다.', chatId: 'u1' },
    { role: 'char', data: `형광등이 깜빡이는 관리국 사무실.\n${STATUS}`, chatId: 'c1' },
  ],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_wallet: JSON.stringify({ start: 1000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }), ...extra },
});

const VP = {
  pc: { width: 1280, height: 900, touch: false },
  phone: { width: 390, height: 844, touch: true },
  fold: { width: 752, height: 749, touch: true }, // 폴드 펼침 실측 (기억 goei-real-risu-shots)
  cover: { width: 344, height: 882, touch: true },
};

const b = await launch();

async function session(vp, { store = {}, chat = chatOf() } = {}) {
  const { page, errors } = await boot(b, fx, chat, vp, { store: { ...PACKS, ...store } });
  const cdp = await page.context().newCDPSession(page);
  const S = {
    page, errors,
    tab: () => page.evaluate(() => document.querySelector('.gx')?.dataset.tab ?? ''),
    shown: () => page.evaluate(() => { const g = document.querySelector('.gx'); return !!g && g.style.display !== 'none'; }),
    hides: () => page.evaluate(() => window.__calls.hide),
    prefs: () => page.evaluate(() => JSON.parse(window.__store['p:goei:prefs'] || '{}')),
    store: () => page.evaluate(() => ({ ...window.__store, 'p:goei:body': undefined, 'p:goei:data-world': undefined, 'p:goei:data-items': undefined, 'p:goei:data-looks': undefined })),
    llm: () => page.evaluate(() => (window.__calls.llm || []).length),
    edOpen: () => page.evaluate(() => { const g = document.querySelector('.gw'); return !!g && !g.hidden; }),
    edNode: () => page.evaluate(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value ?? ''),
    async click(sel) { const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel); await sleep(350); return ok; },
    async open() {
      await openWin(page);
      await page.waitForSelector('.gx-tabhead, .gx-nav', { timeout: 15000 }).catch(() => {});
      await sleep(300);
      if (await S.edOpen()) await closeEditor(page, true);
      await sleep(200);
    },
    rect: (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }; }, sel),
    /** 손가락 끌기: 점 목록 (화면 px) */
    async touch(pts, gap = 16) {
      const [x0, y0] = pts[0];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (const [x, y] of pts.slice(1)) { await sleep(gap); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); }
      await sleep(gap);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(450);
    },
    line: (x0, y0, x1, y1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]),
    async state(s) { writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ tab: await S.tab(), shown: await S.shown(), editor: await S.edOpen(), prefs: await S.prefs(), fabPos: (await S.store())['goei-plugin:fab-pos'] ?? null, hides: await S.hides(), errors: errors.slice(-5) }, null, 2)); },
    note(s, text) { writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, text); },
  };
  return S;
}
const navItem = (v, cls = '') => `.gx-nav > .gx-nb${cls}[data-value="${v}"]`;

// ───────────────────────── A. PC 1280×900, 마우스 ─────────────────────────
if (want('A')) {
  const S = await session(VP.pc);
  const { page } = S;
  await S.open();
  let s = step('PC_창열기_메뉴');
  const order = await page.evaluate(() => [...document.querySelectorAll('.gx-nav > .gx-navhist > button')].map((x) => x.dataset.action));
  const navSeq = await page.evaluate(() => [...document.querySelectorAll('.gx-nav > .gx-nb.desk, .gx-nav > .gx-nb:not(.mob)')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.action + ':' + (e.dataset.value ?? '')));
  check(s, '‹ 접기 › 순서 (사용자 11-22: 접는 단추는 ‹ 와 › 사이 가운데)', JSON.stringify(order) === JSON.stringify(['nav-back', 'menu-fold', 'nav-fwd']), ['nav-back', 'menu-fold', 'nav-fwd'], order);
  const iSet = navSeq.indexOf('ed-open:set:screen');
  check(s, '설정 바로 밑에 닫기 (사용자 11-22)', iSet >= 0 && navSeq[iSet + 1] === 'close:', 'ed-open → close', navSeq);
  const foldCls = await page.evaluate(() => document.querySelector('[data-action="menu-fold"]')?.className);
  check(s, '접기 단추가 ‹ › 와 같은 모양(.gx-nh)', /\bgx-nh\b/.test(foldCls ?? ''), 'gx-nh', foldCls);
  check(s, '보조 호출 0', (await S.llm()) === 0, 0, await S.llm());
  S.note(s, `메뉴 줄: ${navSeq.join(', ')}\n‹ › 줄: ${order.join(', ')}`);
  await S.state(s);

  s = step('PC_탭_뒤로_앞으로');
  await S.click(navItem('map', '.desk'));
  const t1 = await S.tab();
  await S.click(navItem('phone'));
  const t2 = await S.tab();
  await S.click('.gx-navhist [data-action="nav-back"]');
  const t3 = await S.tab();
  await S.click('.gx-navhist [data-action="nav-fwd"]');
  const t4 = await S.tab();
  await S.click(navItem('phone'));
  const t5 = await S.tab();
  check(s, '임무→괴담톡→‹→›→괴담톡 한 번 더(상황판, 10-21 사용자)', [t1, t2, t3, t4, t5].join() === 'map,phone,map,phone,board', 'map,phone,map,phone,board', [t1, t2, t3, t4, t5].join());
  await S.state(s);

  s = step('PC_메뉴_접기');
  const navW0 = (await S.rect('.gx-nav')).w;
  await S.click('.gx-nav [data-action="menu-fold"]');
  const p1 = await S.prefs();
  const folded = await page.evaluate(() => document.querySelector('.gx-nav')?.classList.contains('folded'));
  const fb = await S.rect('.gx-nav > .gx-navfold');
  const hist = await S.rect('.gx-nav > .gx-navhist');
  const histKids = await page.evaluate(() => [...document.querySelectorAll('.gx-nav > .gx-navhist > button')].map((x) => x.dataset.action));
  check(s, '접힘 저장(prefs.navFold) · .folded', p1.navFold === true && folded, { navFold: true, folded: true }, { navFold: p1.navFold, folded });
  check(s, '접으면 접기 단추가 구분선 위로 (‹ › 줄 밖, 바로 위)', !!fb && !!hist && fb.vis && fb.y + fb.h <= hist.y + 1 && JSON.stringify(histKids) === '["nav-back","nav-fwd"]', '단추 아래끝 ≤ ‹ › 줄 위끝', { fb, hist, histKids });
  const navW1 = (await S.rect('.gx-nav')).w;
  check(s, '메뉴 폭이 줄어듦', navW1 < navW0 - 60, `< ${navW0 - 60}`, navW1);
  const face = await page.evaluate(() => !!document.querySelector('.gx-nav .gx-nav-face') && !document.querySelector('.gx-nav .gx-idcard, .gx-nav .gx-nav-brand .gx-id'));
  check(s, '접으면 카드 대신 얼굴 단추', face, true, face);
  await S.state(s);

  s = step('PC_접은메뉴_얼굴_누름');
  await S.click('.gx-nav .gx-nav-face');
  const pop = await page.evaluate(() => !!document.querySelector('.gx-agpop'));
  check(s, '얼굴을 누르면 ID카드 작은 창', pop, true, pop);
  await page.keyboard.press('Escape');
  await sleep(300);
  check(s, 'Esc 는 작은 창만 닫고 상황판은 남음', !(await page.evaluate(() => !!document.querySelector('.gx-agpop'))) && (await S.shown()), true, { pop: await page.evaluate(() => !!document.querySelector('.gx-agpop')), shown: await S.shown() });

  s = step('PC_접은메뉴_위아래_끌기');
  const tBefore = await S.tab();
  const ic = await S.rect(navItem('items', '.desk'));
  const sx = ic.x + ic.w / 2;
  const sy = ic.y + ic.h / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + 1, sy + i * 12); await sleep(10); }
  await page.mouse.up();
  await sleep(500);
  const p2 = await S.prefs();
  const tAfter = await S.tab();
  check(s, '끌면 자리(navAt) 저장, 끌다 놓은 자리의 메뉴는 안 눌림', (p2.navAt ?? 0) > 0 && tAfter === tBefore, { navAtGt0: true, tab: tBefore }, { navAt: p2.navAt, tab: tAfter });
  await S.click(navItem('items', '.desk'));
  check(s, '끌고 난 뒤 다음 누름은 정상으로 먹음', (await S.tab()) === 'items', 'items', await S.tab());
  await S.state(s);

  s = step('PC_마우스제스처_뒤로');
  const g0 = await S.rect('.gx-content');
  const gx = g0.x + g0.w / 2;
  const gy = g0.y + 200;
  await page.mouse.move(gx, gy);
  await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 10; i++) { await page.mouse.move(gx - i * 14, gy); await sleep(10); }
  await page.mouse.up({ button: 'right' });
  await sleep(500);
  check(s, '오른쪽 단추 ← 끌기 = 뒤로 (소지품 → 앞 화면 상황판)', (await S.tab()) === 'board', 'board', await S.tab());
  await S.state(s);

  s = step('PC_Esc_닫기_다시열기');
  const h0 = await S.hides();
  await page.keyboard.press('Escape');
  await sleep(300);
  check(s, 'Esc 로 창 닫힘', (await S.hides()) === h0 + 1 && !(await S.shown()), h0 + 1, await S.hides());
  await S.open();
  const stillFold = await page.evaluate(() => document.querySelector('.gx-nav')?.classList.contains('folded'));
  check(s, '다시 열어도 접힘 유지', stillFold, true, stillFold);
  await S.state(s);

  s = step('PC_메뉴_닫기줄');
  const h1 = await S.hides();
  await S.click('.gx-nav > .gx-nb[data-action="close"]');
  check(s, '접은 메뉴의 닫기 줄로 닫힘', (await S.hides()) === h1 + 1, h1 + 1, await S.hides());
  await S.open();

  s = step('PC_바깥누름_닫기');
  const h2 = await S.hides();
  await page.mouse.click(3, 3);
  await sleep(400);
  check(s, '창 바깥(어두운 막)을 누르면 닫힘', (await S.hides()) === h2 + 1, h2 + 1, await S.hides());
  await S.open();

  s = step('PC_설정_마지막페이지');
  await S.click('.gx-nav [data-action="ed-open"]');
  await page.waitForSelector('.gw .gw-win');
  await page.evaluate(() => document.querySelector('.gw [data-action="ed-tab"][data-value="set"]')?.click());
  await sleep(200);
  const other = await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((e) => e.dataset.value).find((v) => v.startsWith('set:') && v !== 'set:screen'));
  await page.evaluate((v) => document.querySelector(`.gw [data-action="ed-node"][data-value="${v}"]`)?.click(), other);
  await sleep(400);
  await page.keyboard.press('Escape');
  await sleep(400);
  const edAfterEsc = await S.edOpen();
  const shownAfterEsc = await S.shown();
  check(s, 'Esc 는 설정 창만 닫음 (상황판 남음)', !edAfterEsc && shownAfterEsc, { editor: false, shown: true }, { editor: edAfterEsc, shown: shownAfterEsc });
  await S.click('.gx-nav [data-action="ed-open"]');
  await sleep(300);
  check(s, '설정을 다시 열면 닫기 전 페이지 (사용자 11-22 「닫기전 페이지가 열려야」)', (await S.edNode()) === other, other, await S.edNode());
  await closeEditor(page, true);
  await S.state(s);

  s = step('PC_새로고침_뒤_접힘_자리');
  const keep = await page.evaluate(() => ({ 'p:goei:prefs': window.__store['p:goei:prefs'] }));
  const navAtSaved = (await S.prefs()).navAt;
  await page.close();
  const R = await session(VP.pc, { store: keep });
  await R.open();
  const re = await R.page.evaluate(() => ({ folded: document.querySelector('.gx-nav')?.classList.contains('folded'), grow: document.querySelector('.gx-nav > .gx-nav-top')?.style.flexGrow ?? '' }));
  check(s, '페이지 새로고침 뒤 접힘·묶음 자리 그대로', re.folded && String(re.grow) === String(navAtSaved), { folded: true, grow: String(navAtSaved) }, re);
  await R.click('.gx-nav [data-action="menu-fold"]');
  const un = await R.page.evaluate(() => ({ folded: document.querySelector('.gx-nav')?.classList.contains('folded'), card: !!document.querySelector('.gx-nav .gx-nav-brand') && !document.querySelector('.gx-nav .gx-nav-face') }));
  const unp = await R.prefs();
  check(s, '펴면 카드가 돌아오고 navFold 지워짐', !un.folded && un.card && unp.navFold === undefined, { folded: false, card: true }, { ...un, navFold: unp.navFold });
  check(s, '보조 호출 0', (await R.llm()) === 0, 0, await R.llm());
  await R.state(s);
  check(s, '화면 오류 없음', !R.errors.length && !S.errors.length, [], [...S.errors, ...R.errors]);
  await R.page.close();
}

// ───────────────────────── B. 폰 390×844, 손가락 ─────────────────────────
if (want('B')) {
  const S = await session(VP.phone);
  const { page } = S;
  await S.open();
  let s = step('폰_창열기_하단바');
  const bar = await page.evaluate(() => [...document.querySelectorAll('.gx-mbar .gx-nb')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.dataset.value));
  const hidden = await page.evaluate(() => ['.gx-navhist', '.gx-nav > .gx-navfold', '.gx-nav > .gx-nb.desk[data-action="close"]'].map((q) => { const e = document.querySelector(q); return !e || e.getBoundingClientRect().width === 0 || getComputedStyle(e).display === 'none'; }));
  check(s, '하단 바 다섯(임무·기록·상황판·괴담톡·소지품, 11-07 사용자)', JSON.stringify(bar) === '["map","records","board","phone","items"]', ['map', 'records', 'board', 'phone', 'items'], bar);
  check(s, 'PC 전용 ‹ ›·접기·닫기 줄은 폰에서 안 보임', hidden.every(Boolean), [true, true, true], hidden);
  await S.state(s);

  s = step('폰_탭_쓸어서_뒤로_앞으로');
  await S.click('.gx-mbar .gx-nb[data-value="records"]');
  await S.click('.gx-mbar .gx-nb[data-value="phone"]');
  const c = await S.rect('.gx-content');
  const y = c.y + Math.min(300, c.h / 2);
  await S.touch(S.line(40, y, 300, y));
  const back = await S.tab();
  await S.touch(S.line(330, y, 70, y));
  const fwd = await S.tab();
  check(s, '오른쪽으로 쓸면 뒤로, 왼쪽으로 쓸면 앞으로 (지도 칸은 지도 끌기라 비켜 감 — 기록·괴담톡에서)', back === 'records' && fwd === 'phone', 'records → phone', `${back} → ${fwd}`);
  await S.click('.gx-mbar .gx-nb[data-value="map"]');
  check(s, '폰 하단 바에서 같은 탭을 또 누르면 그대로 (10-21 규칙은 PC 메뉴만)', (await S.tab()) === 'map', 'map', await S.tab());
  await S.state(s);

  s = step('폰_하단바_위로쓸기_서랍');
  const mb = await S.rect('.gx-mbar');
  const mx = mb.x + mb.w / 2;
  const my = mb.y + mb.h / 2;
  await S.touch(S.line(mx, my, mx, my - 80, 6));
  const cdr = await page.evaluate(() => !!document.querySelector('.gx-cdr.open'));
  const tabAfterSwipe = await S.tab();
  check(s, '바를 위로 쓸면 서랍이 열리고, 놓은 자리 메뉴는 안 눌림', cdr && tabAfterSwipe === 'map', { open: true, tab: 'map' }, { open: cdr, tab: tabAfterSwipe });
  const sites = await page.evaluate(() => [...document.querySelectorAll('.gx-cdr .gx-cpanel [data-action]')].map((e) => `${e.dataset.action}:${e.dataset.value}`));
  S.note(s, `서랍 단추: ${sites.join(', ')}`);
  await S.click('.gx-cdr .gx-cpanel [data-action="br-site"][data-value="wk"]');
  await sleep(300);
  const t = await S.tab();
  const cdr2 = await page.evaluate(() => !!document.querySelector('.gx-cdr.open'));
  check(s, '서랍에서 위키 → 위키 화면, 서랍 닫힘', t === 'wiki' && !cdr2, { tab: 'wiki', open: false }, { tab: t, open: cdr2 });
  await S.state(s);

  s = step('폰_서랍_설정_하단바로_나가기');
  await S.touch(S.line(mx, my, mx, my - 80, 6));
  await S.click('.gx-cdr .gx-cpanel [data-action="ed-open"]');
  await page.waitForSelector('.gw .gw-win', { timeout: 5000 }).catch(() => {});
  const ed1 = await S.edOpen();
  await S.click('.gw .gx-mbar .gx-nb[data-value="phone"]');
  await sleep(300);
  const ed2 = await S.edOpen();
  check(s, '설정 창 하단 바의 괴담톡 → 설정 닫히고 괴담톡', ed1 && !ed2 && (await S.tab()) === 'phone', { before: true, after: false, tab: 'phone' }, { before: ed1, after: ed2, tab: await S.tab() });
  await S.state(s);

  s = step('폰_설정창_쓸어서_닫기');
  await S.touch(S.line(mx, my, mx, my - 80, 6));
  await S.click('.gx-cdr .gx-cpanel [data-action="ed-open"]');
  await page.waitForSelector('.gw .gw-win', { timeout: 5000 }).catch(() => {});
  let tries = 0;
  while ((await S.edOpen()) && tries < 6) {
    const gb = await S.rect('.gw .gw-body');
    const yy = gb.y + Math.min(200, gb.h / 2);
    await S.touch(S.line(40, yy, 300, yy));
    tries++;
  }
  check(s, '설정 창에서 오른쪽으로 쓸면 앞 페이지 → 끝에 닫힘', !(await S.edOpen()) && (await S.shown()), { editor: false, shown: true }, { editor: await S.edOpen(), shown: await S.shown(), tries });
  await S.state(s);

  s = step('폰_하단바_당겨_닫기');
  const h0 = await S.hides();
  await S.touch(S.line(mx - 60, my, mx + 160, my, 12));
  check(s, '하단 바를 옆으로 당겨 놓으면 닫힘', (await S.hides()) === h0 + 1, h0 + 1, await S.hides());
  await S.open();
  const h1 = await S.hides();
  await S.touch(S.line(mx, my, mx + 25, my, 4));
  check(s, '조금만 당기면 닫히지 않음', (await S.hides()) === h1, h1, await S.hides());
  await S.state(s);
  check(s, '화면 오류 없음', !S.errors.length, [], S.errors);
  await page.close();
}

// ───────────────────────── C. 폴드 펼침 752×749 (PC 배치 줄임) ─────────────────────────
if (want('C')) {
  const S = await session(VP.fold);
  const { page } = S;
  await S.open();
  let s = step('폴드_PC배치_배율');
  const lay = await page.evaluate(() => ({ zoom: getComputedStyle(document.documentElement).zoom, hasNav: !!document.querySelector('.gx-panel.has-nav'), mbarVis: (() => { const e = document.querySelector('.gx-mbar'); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; })(), hist: (() => { const e = document.querySelector('.gx-navhist'); return !!e && getComputedStyle(e).display !== 'none'; })(), brand: (() => { const e = document.querySelector('.gx-nav > .gx-nav-brand'); return !!e && getComputedStyle(e).display !== 'none'; })() }));
  check(s, '펼친 폴드 = PC 배치를 0.7배 (11-22 사용자)', lay.zoom === '0.7' && lay.hasNav && !lay.mbarVis && lay.hist && lay.brand, { zoom: '0.7', hasNav: true, mbarVis: false, hist: true, brand: true }, lay);
  await S.state(s);

  s = step('폴드_메뉴위에서_쓸기_뒤로');
  await S.click(navItem('records', '.desk'));
  await S.click(navItem('phone'));
  const t0 = await S.tab();
  const it = await S.rect(navItem('net'));
  const yy = it.y + it.h / 2;
  await S.touch(S.line(it.x + 4, yy, it.x + 200, yy));
  const t1 = await S.tab();
  check(s, '메뉴 영역에서 오른쪽으로 쓸면 뒤로 (11-22 사용자: 뒤로가기 쓸기를 메뉴 영역까지), 쓸기 시작한 메뉴는 안 눌림', t0 === 'phone' && t1 === 'records', 'phone → records', `${t0} → ${t1}`);
  await S.state(s);

  s = step('폴드_접기단추_누름');
  await S.click('.gx-nav [data-action="menu-fold"]');
  const f = await page.evaluate(() => document.querySelector('.gx-nav')?.classList.contains('folded'));
  check(s, '폴드에서도 접기 단추로 접힘', f, true, f);
  const fn = await S.rect(navItem('net'));
  await S.touch(S.line(fn.x + fn.w / 2, fn.y + fn.h / 2, fn.x + fn.w / 2 + 200, fn.y + fn.h / 2));
  check(s, '접은 메뉴 위에서도 오른쪽 쓸기 = 뒤로', (await S.tab()) === 'board', 'board', await S.tab());
  const nb = await S.rect(navItem('phone'));
  const tb = await S.tab();
  await S.touch(S.line(nb.x + nb.w / 2, nb.y + nb.h / 2, nb.x + nb.w / 2, nb.y + nb.h / 2 + 150));
  const at = (await S.prefs()).navAt;
  check(s, '접은 메뉴를 손가락으로 위아래 끌면 자리 옮김(navAt), 메뉴 안 눌림', (at ?? 0) > 0 && (await S.tab()) === tb, { navAtGt0: true, tab: tb }, { navAt: at, tab: await S.tab() });
  await S.state(s);
  check(s, '화면 오류 없음', !S.errors.length, [], S.errors);
  await page.close();

  // 배율 갈래: 설정 「펼친 폴드 화면 배율」을 높이면(90%) — PC 배치 그대로 줄이기만 하나
  s = step('폴드_배율90_갈래');
  const Z = await session(VP.fold, { store: { 'p:goei:prefs': JSON.stringify({ foldZoom: 90 }) } });
  await Z.open();
  const z90 = await Z.page.evaluate(() => {
    const nav = document.querySelector('.gx-nav');
    const brand = document.querySelector('.gx-nav > .gx-nav-brand');
    const label = document.querySelector('.gx-nav > .gx-nb > span');
    return { zoom: getComputedStyle(document.documentElement).zoom, folded: nav.classList.contains('folded'), navW: nav.getBoundingClientRect().width, brandShown: !!brand && getComputedStyle(brand).display !== 'none', labelClipped: !!label && label.getBoundingClientRect().width <= 1, histDir: getComputedStyle(document.querySelector('.gx-navhist')).flexDirection, foldAria: document.querySelector('[data-action="menu-fold"]')?.getAttribute('aria-label') };
  });
  Z.note(s, JSON.stringify(z90, null, 2));
  check(s, '배율 90%: 펼친 상태면 ID카드·메뉴 글자가 보여야 함 (PC 배치를 줄이기만)', z90.brandShown && !z90.labelClipped && !z90.folded, { brandShown: true, labelClipped: false }, z90);
  await Z.click('.gx-nav [data-action="menu-fold"]');
  const z90f = await Z.page.evaluate(() => ({ face: (() => { const e = document.querySelector('.gx-nav .gx-nav-face'); return !!e && e.getBoundingClientRect().width > 0; })(), navW: document.querySelector('.gx-nav').getBoundingClientRect().width }));
  check(s, '배율 90% 접은 상태: 얼굴 단추 보임 (사용자 11-22 「접으면 얼굴만 작게」)', z90f.face, true, z90f);
  await Z.state(s);
  await Z.page.close();
}

// 갈래: 폰 가로(844×390)는 폰 배치, 펼친 폴드 「모바일」 설정은 폰 배치
if (want('C')) {
  for (const [name, vp, store] of [['폰가로_844x390', { width: 844, height: 390, touch: true }, {}], ['폴드_모바일설정', VP.fold, { 'p:goei:prefs': JSON.stringify({ fold: 'phone' }) }]]) {
    const s = step(`배치갈래_${name}`);
    const S = await session(vp, { store });
    await S.open();
    const r = await S.page.evaluate(() => ({ mbar: (() => { const e = document.querySelector('.gx-mbar'); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; })(), hist: (() => { const e = document.querySelector('.gx-navhist'); return !!e && getComputedStyle(e).display !== 'none'; })(), zoom: getComputedStyle(document.documentElement).zoom }));
    check(s, '폰 배치(하단 바, ‹ › 없음, 배율 없음)', r.mbar && !r.hist && r.zoom === '1', { mbar: true, hist: false, zoom: '1' }, r);
    await S.state(s);
    await S.page.close();
  }
}

// ───────────────────────── D. 유령 단추: 화면 크기가 바뀔 때 ─────────────────────────
if (want('D')) {
  for (const [name, from, to, pos] of [
    ['폴드_커버에서_펼침', VP.cover, VP.fold, { right: 16, bottom: 780 }],
    ['폰_세로에서_가로', VP.phone, { width: 844, height: 390, touch: true }, { right: 16, bottom: 700 }],
  ]) {
    const s = step(`유령단추_${name}`);
    const S = await session(from, { store: { 'goei-plugin:fab-pos': JSON.stringify(pos) } });
    const { page } = S;
    await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 }).catch(() => {});
    const r0 = await S.rect('[x-goei-fab] button');
    await page.setViewportSize({ width: to.width, height: to.height });
    await sleep(3000); // 감시는 1초마다
    const r1 = await S.rect('[x-goei-fab] button');
    const inView = (r, v) => !!r && r.x >= 0 && r.y >= 0 && r.x + r.w <= v.width && r.y + r.h <= v.height;
    S.note(s, `저장된 자리 ${JSON.stringify(pos)}\n${from.width}x${from.height}: ${JSON.stringify(r0)}\n${to.width}x${to.height}: ${JSON.stringify(r1)}`);
    check(s, `${from.width}x${from.height} 에서 화면 안`, inView(r0, from), true, r0);
    check(s, `${to.width}x${to.height} 로 바뀐 뒤에도 유령 단추가 화면 안 (fab.ts: 창 크기가 바뀌어도 모서리 기준으로 남는다 · clampPos)`, inView(r1, to), true, r1);
    // 채팅 화면을 떠났다 오면(감시가 다시 보임 처리) 맞춰지는지
    await page.evaluate(() => { const d = document.querySelector('.default-chat-screen'); d.className = 'x-away'; });
    await sleep(1600);
    await page.evaluate(() => { const d = document.querySelector('.x-away'); d.className = 'default-chat-screen'; });
    await sleep(2000);
    const r2 = await S.rect('[x-goei-fab] button');
    check(s, '채팅 화면을 떠났다 돌아오면 화면 안으로 돌아옴', inView(r2, to), true, r2);
    await S.state(s);
    await page.close();
  }
}

// ───────────────────────── E. 채팅 바꾸기: 앞 채팅에서 보던 탭 ─────────────────────────
if (want('E')) {
  const s = step('채팅바꿈_소지품꺼진채팅');
  const S = await session(VP.pc);
  const { page } = S;
  await S.open();
  await S.click(navItem('items', '.desk'));
  const t0 = await S.tab();
  await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click());
  await sleep(300);
  // 다른 채팅: 소지품·가계부를 끈 채팅 (소지품 메뉴가 없음)
  const other = chatOf({ $it_on: '0', $st_col_wallet: 'off' });
  await page.evaluate((c) => { window.__chat = c; window.risuai.getCurrentChatIndex = async () => 1; }, other);
  await S.open();
  const res = await page.evaluate(() => ({ tab: document.querySelector('.gx')?.dataset.tab, menuItems: !!document.querySelector('.gx-nav > .gx-nb[data-value="items"]'), head: document.querySelector('.gx-tabhead')?.textContent?.trim().slice(0, 40) }));
  S.note(s, `앞 채팅 탭: ${t0}\n새 채팅: ${JSON.stringify(res)}`);
  check(s, '소지품 끈 채팅으로 바꾸면 상황판으로 열리고 소지품 메뉴 없음', res.tab === 'board' && !res.menuItems, { tab: 'board', menuItems: false }, res);
  await S.state(s);
  await page.close();
}

await b.close();
const pass = results.filter((r) => r.ok).length;
writeFileSync(`${OUT}결과.json`, JSON.stringify({ pass, total: results.length, results }, null, 2));
console.log(`\n${pass}/${results.length} 통과`);
