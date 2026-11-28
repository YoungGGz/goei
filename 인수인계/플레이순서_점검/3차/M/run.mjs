// 3차 M 구간 (메뉴·창·조작) + D·J 화면 판독(크기별). 사용: FAKE_URL=http://<IP>:<port> node run.mjs [--only d1,d2,...] [--w 1280 --h 800]
// 단계마다 기대값·결정표 줄을 먼저 적고(step 의 want/ref), 실제값을 붙여 자동 대조한다. src 는 안 건드림.
import { open, STATES, sleep, turn, waitMain, readRequest, buildReply, quietAux, world, saveJson, saveText, reqText, text } from '../D/lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const OUT = fileURLToPath(new URL(`./out/run-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), size: `${W}x${H}`, steps: [] };
const step = (id, name, ok, want, ref, got) => { res.steps.push({ id, name, ok, want, ref, got }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 300)); saveJson(OUT + '/result.json', res); };
const on = (k) => !ONLY.length || ONLY.includes(k);
const TOUCH = argv.includes('--touch') || W < 600;
const DSF = Number(opt('--dsf', 1));
const t = await open({ out: OUT, width: W, height: H, touch: TOUCH, dsf: DSF });
const shot = async (n) => { await t.shot(n); return `${OUT}/${n}.png`; };
const F = () => t.F();
const fc = async (sel, i = 0) => { try { await F().locator(sel).locator("visible=true").nth(i).click({ timeout: 3000 }); } catch (e) { const ok = await F().evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, { sel, i }); if (!ok) throw e; res.domClicks = (res.domClicks ?? []).concat(sel); } await sleep(700); };
const ftext = (sel = '.gx') => F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ') ?? null, sel);
const acts = (re) => F().evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r.test(e.dataset.action)).map((e) => ({ a: e.dataset.action, v: e.dataset.value ?? null, t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), dis: !!e.disabled })); }, re.source);
const userMsgs = (body) => (body.messages ?? []).filter((m) => m.role === 'user').map((m) => text(m.content));
const has = (s, sec) => s.includes(sec.slice(0, 60));
const PROSE = '쟈알디가 서류를 덮었다.\n\n<img=Jyaldi_serious>\n\n"출발한다."';
const ST = { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' };
let DIR = {};
{ const raw = (await import('node:fs')).readFileSync(new URL('../../../../지침/이동_임무_지시문.txt', import.meta.url), 'utf8'); for (const m of raw.matchAll(/===([A-Z]+)===\n([\s\S]*?)(?====|$)/g)) DIR[m[1]] = m[2].trim(); }

async function boot(state = 'S-관리국-3턴') {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  await t.openWindow('.gx');
  await sleep(1200);
}
async function openTab(v) { if (!F() || !(await F().$('.gx'))) await t.openWindow('.gx'); const cur = await F().evaluate(() => document.querySelector('[data-action="nav-tab"].on, [data-action="nav-tab"][aria-current="page"], [data-action="nav-tab"].active')?.dataset.value ?? null); if (cur !== v) await fc(`[data-action="nav-tab"][data-value="${v}"]`); if (!(await F().evaluate((v) => !!document.querySelector(`[data-action="nav-tab"][data-value="${v}"].on, [data-action="nav-tab"][data-value="${v}"][aria-current="page"]`), v))) { await fc('[data-action="nav-tab"][data-value="board"]').catch(() => {}); if (v !== 'board') await fc(`[data-action="nav-tab"][data-value="${v}"]`); } }
async function reopen() { await t.closeWindow(); await t.openWindow('.gx'); await sleep(1000); }



const cdp = await t.ctx.newCDPSession(t.page);
const swipe = async (x0, y0, x1, y1, n = 10) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
};
const frameBox = async () => (await (await t.page.$('iframe')).boundingBox());
const rectIn = async (sel) => { const fb = await frameBox(); const r = await F().evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, color: getComputedStyle(e).color }; }, sel); return r ? { ...r, X: fb.x + r.x * (fb.width / (await F().evaluate(() => innerWidth))), Y: fb.y + r.y * (fb.height / (await F().evaluate(() => innerHeight))) } : null; };
const fab = () => t.page.evaluate(() => { const h = document.querySelector('[x-goei-fab]'); const b = h?.querySelector('button') ?? h; const r = b?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, inside: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, saved: Object.fromEntries(Object.keys(localStorage).filter((k) => /fab/.test(k)).map((k) => [k, localStorage.getItem(k)])) } : null; });
const curTab = () => F().evaluate(() => document.querySelector('[data-action="nav-tab"].on, [data-action="tab"].on')?.dataset.value ?? document.querySelector('.gx-head h1, .gx-title')?.innerText ?? null);
try {
  await boot();
  const size = `${W}x${H}${TOUCH ? '-touch' : ''}`;
  if (on('scr')) { // 화면 판독: 구간 D·J·M 이 닿는 화면을 이 크기로
    for (const v of ['board', 'map', 'records']) {
      await reopen();
      if (W < 600 || (TOUCH && H < 500)) await fc(`.gx-mbar [data-value="${v}"]`).catch(() => {}); else await openTab(v);
      await sleep(800);
      const over = await F().evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('.gx *')].filter((e) => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && (r.right > W + 1 || r.left < -1); }).slice(0, 5).map((e) => e.className.toString().slice(0, 40)); });
      step('SCR-' + v, `${size} ${v} 화면`, null, '캡처로 판독 (가로 넘침 요소 수도 기록)', '5장', { over, shot: await shot(`scr-${size}-${v}`) });
    }
    if (W < 600 || (TOUCH && H < 500)) { await reopen(); await fc('[data-action="tab"][data-value="map"]').catch(() => {}); await fc('[data-action="tab"][data-value="mission"]').catch(() => {}); await shot(`scr-${size}-mission`); }
  }
  if (on('m1')) { // 메뉴 접기·닫기·쓸기·끌기·페르소나 띠 (PC 배치 크기에서)
    await reopen();
    const navW0 = await rectIn('.gx-nav');
    const f0 = await rectIn('[data-action="menu-fold"]'); const b0 = await rectIn('[data-action="nav-back"]'); const n0 = await rectIn('[data-action="nav-fwd"]');
    const setR = await rectIn('[data-action="ed-open"][data-value="set:screen"]'); const closeR = await rectIn('.gx-nb.desk[data-action="close"], .gx-nav [data-action="close"]');
    await shot(`m1-${size}-open`);
    await fc('[data-action="menu-fold"]');
    const navW1 = await rectIn('.gx-nav'); const f1 = await rectIn('[data-action="menu-fold"]');
    const div = await F().evaluate(() => { const d = document.querySelector('.gx-nav hr, .gx-nav .gx-nav-sep, .gx-nav-div'); const r = d?.getBoundingClientRect(); return r ? { y: r.y } : null; });
    await shot(`m1-${size}-folded`);
    const mid = f0 && b0 && n0 ? Math.abs((f0.x + f0.w / 2) - ((b0.x + b0.w + n0.x) / 2)) : null;
    step('M1-1', `${size} 메뉴 접기 단추 자리·색, 설정 밑 닫기`, !!f0 && mid !== null && mid < 6 && f0.color === b0.color && !!closeR && closeR.y > setR.y && navW1.w < navW0.w, '펼침: ‹ 와 › 사이 가운데·같은 색 / 접음: 메뉴 폭 줄고 단추는 구분선 위 / 설정 바로 밑 「닫기」 (M-01)', 'M-01 사용자 결정', { f0, b0, n0, mid, setR, closeR, navW0: navW0?.w, navW1: navW1?.w, f1, div });
    // 접은 아이콘 묶음 위아래 끌기 (마우스)
    const nav = await rectIn('.gx-nav.folded [data-action="nav-tab"]');
    const pre = await F().evaluate(() => document.querySelector('.gx-nav-top')?.style.flexGrow ?? null);
    if (nav) { await t.page.mouse.move(nav.X + 10, nav.Y + 10); await t.page.mouse.down(); await t.page.mouse.move(nav.X + 10, nav.Y + 160, { steps: 12 }); await t.page.mouse.up(); await sleep(600); }
    const post = await F().evaluate(() => document.querySelector('.gx-nav-top')?.style.flexGrow ?? null);
    const tabAfterDrag = await curTab();
    await shot(`m1-${size}-navdrag`);
    step('M1-2', `${size} 접은 아이콘 묶음 위아래 끌기`, pre !== post, '끌면 묶음이 내려가고(.gx-nav-top flex-grow 바뀜) 놓은 자리의 메뉴는 안 눌림', 'M-01', { pre, post, tabAfterDrag });
    await fc('[data-action="menu-fold"]');
    // 페르소나 띠 접기
    const idA = await F().evaluate(() => !!document.querySelector('.gx-id img, .gx-id .gx-avatar, .gx-idcard img'));
    await fc('[data-action="id-fold"]');
    const idTxt = (await ftext('.gx-id, .gx-idcard, .gx-nav'))?.slice(0, 160);
    await shot(`m1-${size}-idfold`);
    await fc('[data-action="id-fold"]');
    step('M1-3', `${size} 페르소나 카드 띠 접기`, /잔고|₩/.test(idTxt ?? '') && !/User 관리국/.test(idTxt ?? ''), '띠를 누르면 사진·이름·소속 접히고 잔고·위치·날짜는 남음 (M-03)', 'M-03 사용자 결정', { idTxt });
    // 쓸기 뒤로·앞으로 (손가락 화면에서만) — 메뉴 위에서
    if (TOUCH) {
      await openTab('map'); await openTab('records');
      const a = await curTab();
      const nv = await rectIn('.gx-nav');
      await swipe(nv.X + 10, nv.Y + 300, nv.X + 200, nv.Y + 300);
      const b = await curTab();
      await swipe(nv.X + 200, nv.Y + 300, nv.X + 10, nv.Y + 300);
      const c = await curTab();
      step('M1-4', `${size} 메뉴 위 오른쪽 쓸기 = 뒤로, 왼쪽 = 앞으로`, a === 'records' && b === 'map' && c === 'records', '기록 → (뒤로) 임무 → (앞으로) 기록 (M-01: 메뉴 위에서도 받음)', 'M-01', { a, b, c, hist: await t.page.evaluate(() => history.length) });
    }
  }
  if (on('m2')) { // 유령 단추: 놓은 자리 → 크기 바꾸면 화면 안으로 당김 → 되돌리면 놓은 자리
    await t.closeWindow();
    const f0 = await fab();
    // 끌어서 오른쪽 아래 끝 가까이에 놓기
    const tx = 10, ty = 10; // 왼쪽 위 끝 (오른쪽·아래 거리로 저장되니 작아지면 화면 밖으로 나갈 자리)
    if (TOUCH) await swipe(f0.x + f0.w / 2, f0.y + f0.h / 2, tx + f0.w / 2, ty + f0.h / 2, 15);
    else { await t.page.mouse.move(f0.x + f0.w / 2, f0.y + f0.h / 2); await t.page.mouse.down(); await t.page.mouse.move(tx + f0.w / 2, ty + f0.h / 2, { steps: 15 }); await t.page.mouse.up(); }
    await sleep(800);
    const f1 = await fab();
    const big = { width: W, height: H };
    const small = W >= 1000 ? { width: 752, height: 749 } : { width: H, height: W };
    await t.page.setViewportSize(small); await sleep(1500);
    const f2 = await fab();
    await shot(`m2-${size}-rot`);
    await t.page.setViewportSize(big); await sleep(1500);
    const f3 = await fab();
    step('M2-1', `${size} 유령 단추: 놓은 자리 → 돌리면 화면 안 → 되돌리면 놓은 자리`, f2?.inside && Math.abs(f3.x - f1.x) <= 2 && Math.abs(f3.y - f1.y) <= 2, '돌린 크기에서도 화면 안에 보이고, 원래 크기로 오면 놓은 자리 (M-06, 0.21.34)', 'M-06 Claude 판정', { f0, f1, f2, f3, small });
    // 폰 채팅 화면에서 기본 자리가 전송 단추를 가리는지(답-06) 사실 기록
    const send = await t.page.evaluate(() => { const b = document.querySelector('.default-chat-screen .button-icon-send')?.getBoundingClientRect(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; });
    step('M2-2', `${size} 유령 단추 기본 자리와 전송 단추`, null, '사실 기록 (답-06, 결정표 5장: 기본 오른쪽 16·아래 96)', '답-06', { fab0: f0, send });
  }
  if (on('m3')) { // 폰 하단 바·서랍·빈 칸 보내기 흐림·더 보기
    await reopen();
    const bar = await F().evaluate(() => [...document.querySelectorAll('.gx-mbar [data-value]')].map((e) => ({ a: e.dataset.action, v: e.dataset.value })));
    const mb = await rectIn('.gx-mbar');
    await shot(`m3-${size}-bar`);
    let drawer = null;
    if (mb) { await swipe(mb.X + mb.w / 2, mb.Y + 10, mb.X + mb.w / 2, mb.Y - 250); drawer = await F().evaluate(() => !!document.querySelector('.gx-cdr.open')); await shot(`m3-${size}-drawer`); }
    step('M3-1', `${size} 폰 하단 바·서랍`, bar.length >= 5 && drawer === true, '하단 바 탭 다섯(임무·기록·상황판·괴담톡·소지품), 위로 쓸면 서랍 (M-05)', 'M-05', { bar: bar.map((x) => x.v), drawer });
    if (drawer) await swipe(mb.X + mb.w / 2, mb.Y - 250, mb.X + mb.w / 2, mb.Y + 40);
    // 괴담톡 1:1 방 → 빈 칸이면 보내기 흐림, 치면 켜짐
    await reopen(); await fc('.gx-mbar [data-value="phone"]');
    const c = (await acts(/^ph-dm$/))[0];
    if (c) await fc(`[data-action="${c.a}"][data-value="${c.v}"]`);
    const d0 = await F().evaluate(() => document.querySelector('[data-action="ph-send"]')?.disabled ?? null);
    const inp = await F().evaluate(() => { const b = document.querySelector('[data-action="ph-send"]'); return b?.dataset.need ?? null; });
    if (inp) await F().locator(`[name="${inp}"]`).first().fill('안녕').catch(() => {});
    await sleep(300);
    const d1 = await F().evaluate(() => document.querySelector('[data-action="ph-send"]')?.disabled ?? null);
    await shot(`m3-${size}-phone`);
    step('M3-2', `${size} 빈 칸이면 보내기 흐림, 치면 켜짐`, d0 === true && d1 === false, '빈 칸 disabled → 글 넣으면 켜짐 (needfill)', '코스 M3', { contact: c, need: inp, d0, d1 });
  }
  if (on('m5')) { // 폴드: 손가락으로 접은 아이콘 끌기 / 폰 가로: 진행 창 점과 상황판 단추 겹침
    await reopen();
    if (W >= 700 && H >= 700) {
      await fc('[data-action="menu-fold"]');
      const nav = await rectIn('.gx-nav.folded [data-action="nav-tab"]');
      const before = await curTab();
      await swipe(nav.X + 10, nav.Y + 10, nav.X + 10, nav.Y + 170, 14);
      const post = await F().evaluate(() => document.querySelector('.gx-nav-top')?.style.flexGrow ?? null);
      step('M5-1', `${size} 손가락으로 접은 아이콘 묶음 끌기`, (await curTab()) === before && post !== '' && post !== null, '묶음이 움직이고 놓은 자리 메뉴는 안 눌림 (마우스로 했을 때는 놓은 자리 「기록」이 눌림 → 손가락으로 다시 봄)', 'M-01', { before, after: await curTab(), post });
      await fc('[data-action="menu-fold"]');
    }
    const prog = await t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); const d = h?.querySelector('[data-dot]')?.getBoundingClientRect(); return d ? { x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.width), h: Math.round(d.height), vis: getComputedStyle(h).display } : null; });
    const trash = await rectIn('.gx-evbtn[data-action="end-event"], [data-action="end-event"]');
    const hit = prog && trash && prog.vis !== 'none' && prog.x < trash.X + trash.w && trash.X < prog.x + prog.w && prog.y < trash.Y + trash.h && trash.Y < prog.y + prog.h;
    const top = trash ? await t.page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[x-goei-prog]') ? 'x-goei-prog' : e.tagName) : null; }, { x: trash.X + trash.w / 2, y: trash.Y + trash.h / 2 }) : null;
    await shot(`m5-${size}-prog`);
    step('M5-2', `${size} 진행 창 점과 상황판 「상황 종료」 단추`, null, '사실 기록: 진행 창 점이 iframe 위에서 그 자리를 덮는지 (elementFromPoint)', '코스 M·D8', { prog, trash, overlap: hit, topAtTrash: top });
  }
  if (on('m4')) { // 폰 가로 쓸기와 브라우저 뒤로가기
    await reopen();
    await fc('[data-action="tab"][data-value="map"]').catch(() => openTab('map'));
    await fc('[data-action="tab"][data-value="records"]').catch(() => openTab('records'));
    const h0 = await t.page.evaluate(() => ({ len: history.length, url: location.href }));
    const a = await curTab();
    const vw = await t.page.evaluate(() => innerWidth), vh = await t.page.evaluate(() => innerHeight);
    await swipe(30, vh / 2, 30 + 200, vh / 2);
    const b = await curTab();
    const h1 = await t.page.evaluate(() => ({ len: history.length, url: location.href }));
    await t.page.goBack({ timeout: 3000 }).catch(() => null); await sleep(1500);
    const h2 = await t.page.evaluate(() => ({ len: history.length, url: location.href, gx: !!document.querySelector('iframe') }));
    await shot(`m4-${size}-back`);
    step('M4-1', `${size} 가로 쓸기(뒤로)와 브라우저 뒤로가기`, null, '사실 기록: 플러그인 쓸기는 플러그인 안 뒤로만, 브라우저 기록(history)은 안 늘림. 브라우저 뒤로가기는 리스AI 몫 (popstate 없음)', '코스 M4', { a, b, h0, h1, h2 });
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
