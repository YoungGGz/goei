// T1(가짜 리스, tests/qc-host.mjs): K2·K3 저장 실패(기기 저장소 goei:prefs 던짐) 때 메모리만 바뀐 채 남는가 / K6 보조 스트리밍 받다 끊김·조각 0개 멈춤(모델 응답 대기)
// fixture: /tmp/t1fx/fixture.json (dist/ 는 리드가 빌드해 둔 것을 씀, 다시 빌드 안 함)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, boot, startChat, open, request, setSaveFail, clearSaveFail, saveFails, queueLlm, releaseStreams } from '../../../../../tests/qc-host.mjs';
import { OUT } from './lib.mjs';

const FX = process.env.T1FX || '/tmp/t1fx/fixture.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rec = { name: 'T1', steps: [], notes: [] };
const step = (title, expect, row) => { const s = { title, expect, row }; rec.steps.push(s); console.log(`\n[T1-${rec.steps.length}] ${title}\n   기대: ${expect}  (${row})`); return { check: (ok, actual) => { s.ok = !!ok; s.actual = actual; console.log(`   ${ok ? 'OK' : 'NG'}  ${JSON.stringify(actual)}`); } }; };
const note = (k, v) => { rec.notes.push({ k, v }); console.log(`   NOTE ${k} ${JSON.stringify(v)}`); };

export async function t1() {
  const fixture = JSON.parse(readFileSync(FX, 'utf8'));
  const fixtureDir = dirname(resolve(FX));
  const browser = await launch();
  const msgs = [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: '주위를 본다.' }];
  const edOpen = async (page, node) => {
    if (!(await page.$('.gw')) || !(await page.isVisible('.gw'))) { await open(page); await page.waitForSelector('.gx-nav .gx-nb.desk[data-action="ed-open"], .gx [data-action="prefs-open"]', { state: 'attached', timeout: 8000 }); const sel = (await page.isVisible('.gx-nav .gx-nb.desk[data-action="ed-open"]').catch(() => false)) ? '.gx-nav .gx-nb.desk[data-action="ed-open"]' : '.gx [data-action="prefs-open"]'; await page.evaluate((q) => [...document.querySelectorAll(q)].find((e) => e.offsetParent)?.click() ?? document.querySelector(q).click(), sel); await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); }); await page.waitForSelector('.gw'); }
    const tab = node.startsWith('guide:') || node.startsWith('rule:') ? 'guide' : node === 'manage:flow' ? 'set' : node.startsWith('manage:') ? 'manage' : 'set';
    await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tab); await sleep(300);
    await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`)?.click(), node); await sleep(500);
  };
  /** 시작 + 첫 응답 한 번 (tests/browser.mjs startedWithReply 와 같은 길: 리스너를 직접 부름) */
  const started = async (page) => {
    await startChat(page, 'A00', 2);
    await page.evaluate(async () => {
      window.__chat.scriptstate.$pp_when = 'manual';
      window.__chat.scriptstate.$ph_auto = '0';
      window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: '본문.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]' });
      const c = window.__chat;
      await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
      const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
    });
    await sleep(500);
  };
  const store = (page) => page.evaluate(() => { try { return JSON.parse(window.__store['p:goei:prefs'] || '{}'); } catch { return {}; } });
  try {
    // ── 1. 지침 고침 + 저장 실패 ──
    {
      const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
      await started(page);
      const st = step('지침 탭 RP 절 고침 중 기기 저장소(goei:prefs) 쓰기가 던짐 → 저장 실패를 알리고, 저장 안 된 고침이 요청에 몰래 쓰이지 않음', '알림이 뜨거나(저장 실패) 메모리도 되돌림. 「요청엔 쓰이는데 저장은 안 됨·알림 없음」이면 어긋남', 'K-12 지침 바로 저장 / guides.ts guideAction(setGuideOverride → savePrefs) / T1_사용법 「pluginStorage.setItem 은 큰 값에 던진다」');
      await edOpen(page, 'guide:RP');
      await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
      const ta = '.gw textarea[data-input="ed-guide-sec"]';
      await page.waitForSelector(ta);
      await page.click(ta);
      await page.keyboard.press('End');
      await page.$eval(ta, (e) => { e.value += '\n- T1-SAVEFAIL-MARK.'; e.dispatchEvent(new Event('input', { bubbles: true })); });
      await sleep(1800);
      const ui = await page.evaluate(() => ({ head: document.querySelector('.gw .gw-head small, .gw-head small')?.textContent ?? null, err: [...document.querySelectorAll('.gw .gx-err, .gx-toast, [role="alert"]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3) }));
      await page.click(`.gw [data-action="ed-node"][data-value="guide:Directive"]`).catch(() => {}); await sleep(400);
      await page.click(`.gw [data-action="ed-node"][data-value="guide:RP"]`).catch(() => {}); await sleep(400);
      const head2 = await page.evaluate(() => document.querySelector('.gw .gw-head small, .gw-head small')?.textContent ?? null);
      const saved = JSON.stringify(await store(page)).includes('T1-SAVEFAIL-MARK');
      const fails = await saveFails(page);
      await page.click('.gw [data-action="ed-close"]').catch(() => {}); await page.click('.gw-confirm [data-action="ed-close-yes"]').catch(() => {}); await sleep(300);
      const out = await request(page, msgs);
      const inReq = JSON.stringify(out).includes('T1-SAVEFAIL-MARK');
      await clearSaveFail(page);
      await page.screenshot({ path: `${OUT}/T1_저장실패_지침.png` });
      st.check(!(inReq && !saved && !ui.err.length), { saved, inReq, ui, headAfterReopen: head2, fails: fails.length, pageErrors: errors.slice(0, 3), logs: logs.filter((l) => /저장|실패|prefs/.test(l)).slice(0, 5) });
      // 다시 켜면(같은 저장소로) 고침이 사라지나
      const st2 = step('위 상태에서 플러그인을 다시 켬(같은 기기 저장소) → 고침이 남았나', '저장이 안 됐으니 사라짐 (그 사이 알림이 없었다면 사용자는 모름)', 'T1 boot prefs = 저장소 값');
      const prefsNow = await store(page);
      await page.close();
      const b = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, prefs: Object.keys(prefsNow).length ? prefsNow : null });
      await started(b.page);
      const out2 = await request(b.page, msgs);
      st2.check(true, { stillInReq: JSON.stringify(out2).includes('T1-SAVEFAIL-MARK') });
      await b.page.close();
    }
    // ── 2. 추가 규칙 만들기 + 저장 실패 ──
    {
      const { page, errors } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
      await started(page);
      const st = step('추가 규칙 새로 만들고 글을 적는 중 goei:prefs 쓰기가 던짐 → 알림 또는 되돌림', '「저장 실패」 알림, 또는 규칙이 요청에 안 쓰임', 'K-13 추가 규칙 / rules saveRules(setUserRules → savePrefs)');
      await edOpen(page, 'rule:all');
      await page.evaluate(() => document.querySelector('.gw [data-action="ed-rule-new"]')?.click());
      await sleep(900);
      await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
      const txt = await page.$('.gw textarea[data-input="ed-rule-text"], .gw [data-input="ed-rule-text"]');
      if (txt) { await txt.click(); await txt.evaluate((e) => { e.value = 'T1-RULE-MARK 규칙 글'; e.dispatchEvent(new Event('input', { bubbles: true })); }); }
      await sleep(1500);
      const ui = await page.evaluate(() => [...document.querySelectorAll('.gw .gx-err, .gx-toast, [role="alert"]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3));
      const saved = JSON.stringify(await store(page)).includes('T1-RULE-MARK');
      await page.click('.gw [data-action="ed-close"]').catch(() => {}); await page.click('.gw-confirm [data-action="ed-close-yes"]').catch(() => {}); await sleep(300);
      const out = await request(page, msgs);
      const inReq = JSON.stringify(out).includes('T1-RULE-MARK');
      await page.screenshot({ path: `${OUT}/T1_저장실패_규칙.png` });
      st.check(!!txt && !(inReq && !saved && !ui.length), { textBox: !!txt, saved, inReq, ui, pageErrors: errors.slice(0, 3) });
      await page.close();
    }
    // ── 3. 보조 스트리밍 받다 끊김 (괴담넷 새로고침) ──
    const board = { posts: [{ author: 'abc92', id: 1846002, title: 'T1 관람차', time: '02:30', date: '2025.01.01 02:30', views: 10, upvotes: 1, content: '어제 봤음', mine: false, comments: [] }], incoming: [] };
    const full = '```json\n' + JSON.stringify(board) + '\n```';
    const gnOpen = async (page) => { await open(page); await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]'); await page.click('.br-bm[data-value="gn"]'); await page.waitForSelector('.gn'); };
    {
      const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
      await started(page);
      const st = step('괴담넷 새로고침 답을 스트리밍으로 받다 끊김(1조각 뒤 error) → 연결 오류(일시 오류)로 같은 요청을 다시 보내 둘째에 성공', '보조 호출 2회, 글 목록이 뜸, 형식 재시도 글(영어 원문 오류) 아님', 'llm.ts 「받는 도중 끊기면 모델 연결 오류(일시 오류)」(전수점검 보통-8)');
      await queueLlm(page, { stream: [full.slice(0, 40), full.slice(40)], errorAfter: 1 }, full);
      await gnOpen(page);
      await page.click('[data-action="gn-refresh"]');
      await page.waitForSelector('.gn-row-main', { timeout: 15000 }).catch(() => {});
      const calls = await page.evaluate(() => window.__calls.llm.length);
      const streams = await page.evaluate(() => window.__calls.llmStream.map((s) => s.state));
      const rows = await page.$$eval('.gn-row-main', (e) => e.length).catch(() => 0);
      await page.screenshot({ path: `${OUT}/T1_스트림끊김_괴담넷.png` });
      st.check(calls === 2 && rows > 0, { calls, streams, rows, logs: logs.slice(-4), pageErrors: errors.slice(0, 3) });
      await page.close();
    }
    // ── 4. 조각 0개로 멈춤 + 모델 응답 대기(기본 5분) ──
    {
      const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, clock: true });
      await started(page);
      const st = step('괴담넷 새로고침 답이 조각 0개로 멈춤 → 「모델 응답 대기」(기본 5분) 뒤 실패, 같은 요청을 다시 안 보냄', '보조 호출 1회, 화면에 실패 글(「…분 동안 응답하지 않아」)', 'llm.ts idleLimit·markTransientDone / K6 모델 응답 대기');
      await queueLlm(page, { stream: [full], stallAfter: 0 }, full);
      await gnOpen(page);
      await page.click('[data-action="gn-refresh"]');
      await sleep(1500);
      await page.clock.fastForward(301_000);
      await sleep(2500);
      const calls = await page.evaluate(() => window.__calls.llm.length);
      const txt = await page.evaluate(() => document.querySelector('.gn')?.innerText.slice(0, 400) ?? '');
      await page.screenshot({ path: `${OUT}/T1_조각0_멈춤.png` });
      st.check(calls === 1 && /응답하지 않아|멈췄/.test(txt + logs.join(' ')), { calls, txt: txt.replace(/\s+/g, ' ').slice(0, 200), logs: logs.slice(-4), pageErrors: errors.slice(0, 3) });
      await releaseStreams(page).catch(() => {});
      // 1조각 받고 멈춤 → 시간 뒤 다시 보냄
      const st2 = step('1조각 받고 멈춤 → 응답 대기 뒤 「받는 도중 멈춤」이라 같은 요청을 한 번 더(일시 오류 재시도)', '보조 호출 +2 (멈춘 것 1 + 다시 1), 둘째 답으로 글 목록', 'llm.ts 「받는 도중 멈춘 것만 raw timeout 으로 일시 오류로 다시 보낸다」');
      await page.evaluate(() => { window.__llm = []; });
      const c0 = await page.evaluate(() => window.__calls.llm.length);
      await queueLlm(page, { stream: [full.slice(0, 30), full.slice(30)], stallAfter: 1 }, full);
      await page.click('[data-action="gn-refresh"]').catch(() => {});
      await sleep(1500);
      await page.clock.fastForward(301_000);
      await sleep(3000);
      const c1 = await page.evaluate(() => window.__calls.llm.length);
      const rows = await page.$$eval('.gn-row-main', (e) => e.length).catch(() => 0);
      st2.check(c1 - c0 === 2, { added: c1 - c0, rows, logs: logs.slice(-4) });
      await page.close();
    }
  } catch (e) {
    note('예외', String(e?.stack ?? e));
  } finally {
    writeFileSync(`${OUT}/결과_T1.json`, JSON.stringify(rec, null, 1));
    await browser.close();
  }
}
