// 파트 c: 지침 탭. 기본 글 = 지침/ 파일(CLAUDE.md), 고치면 바로 저장(사용자 11-08), 요청에 들어감, 초기화로 원래 글(사용자 11-08)
// 「비우면 기본 글이 쓰여요」 표시 = 실제로 기본 글을 쓰는 절 (전수검사 11-13 나-51 사용자)
import { readFileSync, readdirSync } from 'node:fs';
import { ROOT, fx, boot, launch, goNode, sleep, recorder, ss, prefs, settle, openStarted, barAct, startedChat, packs, fmtMsgs, closeEditor, closeWin } from './lib.mjs';

const FILES = { GNet: '괴담넷', Gal: '괴담갤', Wpf: '세정게', Salmon: '연어마켓', Cos: '우주쇼핑몰', Bm: '백일몽포인트몰', BmDesk: '포인트몰_1대1상담', Hs: '망상홈쇼핑', Phone: '괴담톡', Wiki: '괴이위키', Directive: '이동_임무_지시문', RP: 'RP지침', Tag: '상태창_태그', Shop: '상점', Updater: '갱신기_자세히', UpdaterCompact: '갱신기_간결', Director: 'Director', Router: 'Router', Consult: 'AI상담', Common: '요청공통', Main: '메인요청_덧붙임', UpdaterExtra: '갱신기_덧붙임', Asset: '이미지_보조모델' };

function srcFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...srcFiles(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

export default async function (part) {
  const R = recorder(part);
  const core = await import(`${ROOT}dist-test/core.bundle.mjs`);
  // ── 01 기본 글 = 파일, 절 나눔이 글을 바꾸지 않음 ──
  {
    const s = R.step('기본글_파일대조');
    const bad = []; const round = [];
    for (const n of core.GUIDE_NAMES) {
      const file = readFileSync(`${ROOT}지침/${FILES[n]}.txt`, 'utf8').replace(/\r/g, '');
      if (core.guideDefault(n) !== file) bad.push(n);
      if (core.joinGuide(core.splitGuide(file)) !== file) round.push(n);
    }
    R.check(s, '지침 23개 기본 글이 지침/ 파일과 같음', bad.length === 0 && core.GUIDE_NAMES.length === 23, [], { bad, n: core.GUIDE_NAMES.length });
    R.check(s, '절 칸으로 나눴다 합쳐도 글이 그대로 (편집 화면이 글을 바꾸지 않음)', round.length === 0, [], round);
  }
  // ── 02 「비우면 기본 글」 표시 대조 (코드 읽기) ──
  {
    const s = R.step('빈칸표시_대조');
    const used = new Map();
    const add = (n, sec, f) => { const k = `${n}|${sec}`; if (!used.has(k)) used.set(k, f); };
    for (const f of srcFiles(`${ROOT}src`)) {
      const t = readFileSync(f, 'utf8');
      const rel = f.slice(ROOT.length);
      for (const m of t.matchAll(/guideTxt\('([A-Za-z]+)', *'([A-Z0-9_.]+)'/g)) add(m[1], m[2], rel);
      // 같은 파일 안 짧은 이름 감싸개: guideTxt('Hs', k) · guideTxt('Consult', section)
      for (const w of t.matchAll(/const (\w+) = \((?:k|section)[^)]*\)[^=]*=> guideTxt\('([A-Za-z]+)', (?:k|section)/g)) {
        for (const m of t.matchAll(new RegExp(`\\b${w[1]}\\('([A-Z0-9_.]+)'`, 'g'))) add(w[2], m[1], rel);
      }
      // 상점·몰 공용: guideTxt(guide, 'X') 는 Shop·Cos·Bm 셋
      for (const m of t.matchAll(/guideTxt\((?:guide|rollGuide\(site\)), *'([A-Z0-9_.]+)'/g)) for (const n of ['Shop', 'Cos', 'Bm']) if (core.guideDefaultSec(n, m[1]) !== null) add(n, m[1], rel);
    }
    const miss = [];
    for (const [k, f] of used) {
      const [n, sec] = k.split('|');
      if (core.guideDefaultSec(n, sec) === null) continue; // 그 지침에 없는 절
      if (!core.blankUsesDefault(n, sec)) miss.push(`${n} ${sec}  (${f})`);
    }
    R.file(s, `guideTxt 로 읽어 비우면 기본 글이 쓰이는데 편집 화면에 「비우면 기본 글이 쓰여요」가 안 붙는 절 ${miss.length}개\n${miss.join('\n')}\n`);
    R.check(s, 'guideTxt 로 읽는 절은 모두 「비우면 기본 글이 쓰여요」 표시 대상', miss.length === 0, [], miss);
  }
  // ── 브라우저: 고치기 → 바로 저장 → 요청 → 초기화 ──
  const browser = await launch();
  const chat = startedChat();
  chat.message[1].data += '\n[shop: 편의점|]';
  chat.scriptstate.$sh_judge = 'main';
  const { page, errors } = await boot(browser, fx, chat, 'pc', { store: packs() });
  await openStarted(page, 'guide:Shop');
  await settle(page);
  const MARK = '점검표식-가게-말투-0000';
  {
    const s = R.step('상점지침_고치기');
    const before = await page.evaluate(() => [...document.querySelectorAll('.gw textarea[data-input="ed-guide-sec"]')].map((t) => t.dataset.key));
    // FIRST 절(첫 진열 지시)을 찾는다
    const idx = await page.evaluate(() => { const heads = [...document.querySelectorAll('.gw .gw-field')]; return heads.findIndex((h) => /FIRST/.test(h.querySelector('.gw-field-head b, .gw-field-head input')?.textContent || h.querySelector('.gw-field-head input')?.value || '')); });
    const key = before[idx >= 0 ? idx : 0];
    await page.evaluate(([k, mark]) => { const t = document.querySelector(`.gw textarea[data-key="${k}"]`); t.value = `${t.value.replace(/^\n/, '')}\n${mark}`; t.dispatchEvent(new Event('input', { bubbles: true })); }, [key, MARK]);
    await sleep(1800);
    const p = await prefs(page);
    R.check(s, '손을 떼면 바로 기기 설정에 저장 (사용자 11-08 「지침도 바로 저장」)', (p.guides?.Shop ?? '').includes(MARK), MARK, (p.guides?.Shop ?? '').slice(0, 80));
    const file = readFileSync(`${ROOT}지침/상점.txt`, 'utf8').replace(/\r/g, '');
    const saved = p.guides?.Shop ?? '';
    const restored = saved.replace(`\n${MARK}`, '');
    R.check(s, '고친 절 말고 다른 글은 그대로', restored === file, '파일과 같음', restored === file ? '같음' : `다른 곳 ${[...restored].findIndex((c, i) => c !== file[i])}`);
    R.state(s, { key, guideKeys: Object.keys(p.guides ?? {}) });
  }
  // 상점을 열어 요청에 들어가는지
  {
    const s = R.step('고친지침_요청반영');
    await closeEditor(page, true).catch(() => {});
    await closeWin(page).catch(() => {});
    await sleep(300);
    await page.evaluate(async (i) => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: i }); }, 1);
    await sleep(300);
    { let last = -1; for (let i = 0; i < 40; i++) { const n = await page.evaluate(() => (window.__calls.llm || []).length); if (n === last) break; last = n; await sleep(500); } }
    await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<shop-identity>\nsells: 과자\nnever: -\nprices: -\ncurrency: -\n</shop-identity>\n<owner>\n어서 오세요.\n</owner>\n<shelf>\n새우깡|1500|소모1|음식/과자/snack|0.09|봉지 과자|\n</shelf>' }]; });
    const n0 = await page.evaluate(() => (window.__calls.llm || []).length);
    // 카드의 「상점 열기」
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), chat.message[1].data);
    await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
    await page.evaluate((t) => window.__calls.handlers.display(t), chat.message[1].data);
    const has = await page.$('#chat-card [data-goei-shop]');
    if (has) await page.click('#chat-card [data-goei-shop]');
    await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
    await page.waitForFunction((n) => (window.__calls.llm || []).length > n, n0, { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 15000 }).catch(() => {});
    const msgs = await page.evaluate((n) => { const L = (window.__calls.llm || []).slice(n); const c = L.find((x) => JSON.stringify(x.messages ?? []).includes('shop-identity')) || L[0]; return c?.messages ?? []; }, n0);
    R.file(s, fmtMsgs(msgs));
    const all = msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
    R.check(s, '상점 열기 카드가 뜸', !!has, true, !!has);
    R.check(s, '고친 상점 지침(FIRST 절)이 첫 진열 요청에 들어감', all.includes(MARK), MARK, all.includes(MARK));
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'shop-close'; b.style.display = 'none'; (document.querySelector('.gx-panel') || document.querySelector('.gx') || document.body).appendChild(b); b.click(); b.parentNode?.removeChild(b); });
    await sleep(300);
  }
  // 초기화
  {
    const s = R.step('초기화_지침원래대로');
    await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 15000 }).catch(() => {});
    await closeWin(page).catch(() => {});
    await openStarted(page, 'guide:Shop');
    await settle(page);
    await barAct(page, 'reset');
    const p = await prefs(page);
    R.check(s, '초기화 뒤 고친 지침이 기기 설정에서 빠짐', !p.guides || !p.guides.Shop, '없음', Object.keys(p.guides ?? {}));
    await goNode(page, 'guide:Shop');
    await settle(page);
    const txt = await page.evaluate(() => [...document.querySelectorAll('.gw textarea[data-input="ed-guide-sec"]')].map((t) => t.value).join('\n'));
    R.check(s, '지침 화면에 표식이 없음 (원래 글)', !txt.includes(MARK), '없음', txt.includes(MARK));
    const head = await page.evaluate(() => document.querySelector('.gw .gw-head h2, .gw .gw-head h3')?.textContent ?? '');
    R.check(s, '머리에 「기본값」 표시', head.includes('기본값'), '기본값', head);
  }
  R.check(R.step('오류'), '페이지 오류 없음', errors.length === 0, [], errors.slice(0, 10));
  R.save();
  await browser.close();
}
