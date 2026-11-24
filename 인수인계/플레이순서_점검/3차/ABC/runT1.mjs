// 3차 A·B·C 의 T1 갈래 (가짜 리스 tests/qc-host.mjs, 시험 본체 dist-test)
// 사용: node runT1.mjs <fixture.json> [구간...]   구간: fault save-out save-start save-prefs save-char busy stream
//  fault     : C7 조립 단계 하나씩 실패(로어·주인공·상태창·소지품·인물 기록·시드·참고 기록·이미지 지침) → 그 단계만 빠지고 표식은 지워지는지
//  save-out  : C7 응답 처리 첫 저장(setChatToIndex) 실패(throw/silent) → 그 턴 뒤 처리(가계부·인물 기록 갱신·다음 턴 로어)가 어떻게 되는지
//  save-start: B 시작 저장 실패(throw) → 화면 안내·채팅
//  save-prefs: 설정 저장(goei:prefs) 실패 → 화면·다시 열었을 때
//  save-char : 카드 저장(setCharacterToIndex) 실패 → 명부 저장(세계 기록 쓰기)
//  busy      : B5 기다리는 틈(직접 입력 막힘) — 기다리는 중 취소 두 번·3분 넘김·응답 다시 확인
//  stream    : 보조 호출 스트리밍(인물 기록 갱신기) — 정상 / 멈춤 → 모델 응답 대기 넘김 / 끊김 → 재전송(C-07)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  launch, boot, startChat, open, request, output, chat, setChat, setVars, testBodyCode,
  setSaveFail, clearSaveFail, saveFails, setRisuBusy, queueLlm, releaseStreams,
} from '../../../../tests/qc-host.mjs';
import { OUT } from './lib.mjs';

const fxPath = process.argv[2];
const only = process.argv.slice(3);
const want = (k) => !only.length || only.includes(k);
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const core = await import('../../../../dist-test/core.mjs');
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = { at: new Date().toISOString(), steps: [] };
const step = (sec, name, expect, actual, ok) => { res.steps.push({ sec, name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', `[${sec}]`, name, '|', JSON.stringify(actual).slice(0, 600)); };
const B = { fixtureDir, body: testBodyCode };
const asText = (m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
const flat = (msgs) => (msgs ?? []).map(asText).join('\n');
const parts = (msgs) => {
  const a = flat(msgs);
  return {
    n: msgs?.length, len: a.length,
    lore: /goei:lore|\[Faction\]|\[Roster\]/.test(a), roster: /\[Roster\]/.test(a), status: /\[▣\|/.test(a) || /Status window/i.test(a),
    inv: a.includes('[Inventory]'), people: a.includes('[People records]'), seed: /Jyaldi|쟈알디/.test(a), img: a.includes('Inserting Character Visual Images'),
    refs: /\[Reference|참고 기록|\[Board|\[Wiki/.test(a), prev: (a.match(/\[Previous status\]\s*\n(\[▣[^\n]*|No status[^\n]*)/) ?? [, ''])[1].slice(0, 140),
    markers: [...new Set(a.match(/%%[A-Z_\/]+[%:]/g) ?? [])],
  };
};
// 시작한 채팅 + 첫 답(상태창·사건 태그) 붙이기
const REPLY = '쟈알디가 서류를 넘겼다.\n\n<img=Jyaldi_neutral>\n\n"앉아."\n\n[IN|서울특별시 중구|중림 지하상가|진행|없음|지하상가 소동]\n[▣|2025.03.14|09:20 AM|☀️|12°C|서울 종로구 관리국 본부 면담실|없음|쟈알디|없음|관리국/신입|135000]';
async function started(opts = {}) {
  const b = await boot(browser, fixture, { message: [], scriptstate: {} }, { ...B, ...opts });
  const saved = await startChat(b.page, 'A00', 1);
  return { ...b, saved };
}
const msgsOf = (c, extraUser) => [{ role: 'system', content: 'SYSTEM PROMPT' }, ...c.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: String(m.data) })), ...(extraUser ? [{ role: 'user', content: extraUser }] : [])];
const world = (c) => { try { return JSON.parse(c.scriptstate?.$goei_world ?? 'null'); } catch { return null; } };
const inc = (c, name) => world(c)?.inc?.find((e) => e.name === name)?.state ?? null;
async function addTurn(page, user, reply) {
  const c = await chat(page);
  const message = [...c.message, { role: 'user', data: user, chatId: 'u' + c.message.length }, { role: 'char', data: reply, chatId: 'c' + (c.message.length + 1) }];
  await setChat(page, { message });
  return message.length - 1;
}

try {
  // ── C7: 조립 단계 하나씩 실패 ──
  if (want('fault')) {
    const { page, logs, errors } = await started();
    const c0 = await chat(page);
    const base = parts(await request(page, msgsOf(c0, '첫 행동')));
    step('fault', '기준(실패 없음) 첫 요청', '(관찰)', base, null);
    for (const s of ['로어', '주인공', '상태창', '소지품', '인물 기록', '시드', '참고 기록', '이미지 지침', '유저 이름', '명부 다듬기', '시작 카드 표식', 'beforeRequest']) {
      logs.length = 0;
      await page.evaluate((s) => { globalThis.__goeiFaultSteps = [s]; }, s);
      let r = null, err = null;
      try { r = await request(page, msgsOf(c0, '첫 행동')); } catch (e) { err = String(e?.message ?? e).slice(0, 120); }
      await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
      const p = r ? parts(r) : null;
      const diff = p ? Object.fromEntries(Object.entries(p).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(base[k]))) : null;
      step('fault', `단계 「${s}」 실패`, '그 단계만 빠지고 표식 0, 요청은 나감', { err, diff, markers: p?.markers, log: logs.filter((l) => /실패/.test(l)).slice(0, 2) }, !!p && p.markers.length === 0);
    }
    step('fault', '페이지 오류', '없음', errors, errors.length === 0);
    await page.close();
  }

  // ── C7: 응답 처리 첫 저장 실패 ──
  if (want('save-out')) {
    for (const mode of ['none', 'throw', 'silent']) {
      const { page, logs, errors } = await started();
      await queueLlm(page, '{}', '{}', '{}');
      const i = await addTurn(page, '고개를 든다.', REPLY);
      if (mode !== 'none') await setSaveFail(page, 'chat', { from: 1, count: 1, mode });
      await page.evaluate(() => { window.__calls.llm = []; });
      await output(page, i).catch((e) => logs.push('output throw ' + e.message));
      await sleep(2500);
      const c = await chat(page);
      const st = c.scriptstate ?? {};
      step('save-out', `${mode}: 응답 처리 첫 저장 실패 뒤`, '(관찰) 상황판 반영·가계부·저장 본문 태그·뒤 처리', {
        inc: inc(c, '중림 지하상가'), tagLeft: /\[IN\|/.test(String(c.message.at(-1)?.data)), wallet: (st.$goei_wallet ?? '').slice(0, 80) || null,
        llmCalls: (await page.evaluate(() => (window.__calls.llm ?? []).map((x) => String(x.messages?.[0]?.content ?? '').slice(0, 30)))),
        fails: await saveFails(page), log: logs.filter((l) => /실패|throw/.test(l)).slice(0, 3),
      }, null);
      await clearSaveFail(page);
      // 다음 턴 요청: 상황판에 사건이 있는지, [Previous status]
      const r = parts(await request(page, msgsOf(await chat(page), '다음 행동')));
      step('save-out', `${mode}: 다음 턴 요청`, '(관찰) 저장 실패한 턴의 반영이 다음 턴에 빠지는지', { prev: r.prev, incInLore: null, markers: r.markers }, null);
      const r2 = await request(page, msgsOf(await chat(page), '다음 행동'));
      step('save-out', `${mode}: 다음 턴 상황판에 중림 지하상가`, '(관찰)', /중림 지하상가\|진행/.test(flat(r2)), null);
      step('save-out', `${mode}: 페이지 오류`, '없음', errors, errors.length === 0);
      await page.close();
    }
  }

  // ── B: 시작 저장 실패 ──
  if (want('save-start')) {
    const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, B);
    await open(page);
    await page.waitForSelector('.gx-fac');
    await page.click('.gx-fac[data-value="A00"]');
    await page.click('.gx-sc[data-value="1"]');
    await setSaveFail(page, 'chat', { mode: 'throw', count: 1 });
    await page.click('.gx-start');
    await sleep(2500);
    const txt = await page.evaluate(() => document.querySelector('.gx')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? '');
    const c = await chat(page);
    step('save-start', '시작 저장 throw 한 번', '안내 글, 채팅 그대로(빈), 다시 누르면 됨', { shown: txt, n: c.message.length, fails: await saveFails(page) }, c.message.length === 0);
    await clearSaveFail(page);
    if (await page.$('.gx-start')) { await page.click('.gx-start'); await sleep(2500); }
    const c2 = await chat(page);
    step('save-start', '다시 출발', '첫 장면 메시지 1', { n: c2.message.length }, c2.message.length === 1);
    step('save-start', '페이지 오류', '없음', errors, errors.length === 0);
    await page.close();
  }

  // ── 설정 저장(goei:prefs) 실패 ──
  if (want('save-prefs')) {
    const { page, errors, logs } = await started();
    await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
    const before = await page.evaluate(() => window.__store['p:goei:prefs'] ?? null);
    // 설정 › 화면 › 테마 (savePrefs 로 goei:prefs 에 씀)
    await page.click('[x-goei-fab] button').catch(() => {});
    await sleep(1000);
    await page.click('[data-action="prefs-open"]').catch(() => {});
    await sleep(1200);
    const theme0 = await page.evaluate(() => document.querySelector('.gx')?.dataset.theme ?? document.documentElement.dataset.theme ?? null);
    const seg = await page.$('[data-action="set-theme"]:not(.on):not([aria-pressed="true"])');
    if (seg) await seg.click();
    await sleep(1000);
    res.theme = [theme0, await page.evaluate(() => document.querySelector('.gx')?.dataset.theme ?? null)];
    const after = await page.evaluate(() => window.__store['p:goei:prefs'] ?? null);
    const txt = await page.evaluate(() => [...document.querySelectorAll('.gx-err, .gx-notice, [role="alert"]')].map((e) => e.innerText).join(' / ').slice(0, 300));
    step('save-prefs', 'goei:prefs 쓰기 throw 중 설정 바꿈', '(관찰) 안내·화면', { theme: res.theme, clicked: !!seg, changed: before !== after, alert: txt, fails: (await saveFails(page)).length, log: logs.filter((l) => /prefs|설정|실패/.test(l)).slice(0, 3) }, null);
    step('save-prefs', '페이지 오류', '없음', errors, errors.length === 0);
    await clearSaveFail(page);
    await page.close();
  }

  // ── 카드 저장 실패: 명부(세계 기록) 저장 ──
  if (want('save-char')) {
    const { page, errors, logs } = await started();
    await setSaveFail(page, 'char', { mode: 'throw' });
    // 세계 편집에서 글 칸 하나를 고쳐 저장(updateCharacterLore → setCharacterToIndex)
    await page.click('[x-goei-fab] button').catch(() => {});
    await sleep(1000);
    await page.click('[data-action="prefs-open"]').catch(() => {});
    await sleep(1000);
    await page.click('[data-action="ed-tab"][data-value="world"]').catch(() => {});
    await sleep(800);
    const nodes = await page.evaluate(() => [...document.querySelectorAll('[data-action="ed-node"]')].map((b) => b.dataset.value).slice(0, 12));
    let edited = null;
    for (const n of nodes) {
      await page.click(`[data-action="ed-node"][data-value="${n}"]`).catch(() => {});
      await sleep(700);
      const cands = await page.$$('.gw-page input[type="text"]:not([disabled]), .gw-page textarea:not([disabled])'); let inp = null; for (const c of cands) if (await c.isVisible()) { inp = c; break; }
      if (inp) { try { const v = await inp.inputValue({ timeout: 2000 }); await inp.fill(v + ' 시험', { timeout: 3000 }); await inp.dispatchEvent('change'); await page.keyboard.press('Tab'); edited = n; break; } catch (e) { edited = 'ERR ' + n + ' ' + String(e.message).slice(0, 60); } }
    }
    await sleep(3000);
    const note = await page.evaluate(() => [...document.querySelectorAll('.gx-err, .gw-notice, .gx-notice, [role="alert"]')].map((e) => e.innerText).join(' / ').slice(0, 300));
    step('save-char', '세계 편집 저장 중 카드 저장 throw', '저장 못 함 안내(index.ts saveNow 「저장하지 못했어요」)', { nodes, edited, note, fails: await saveFails(page), log: logs.filter((l) => /저장|실패/.test(l)).slice(0, 3) }, /저장하지 못했어요/.test(note));
    step('save-char', '페이지 오류', '없음', errors, errors.length === 0);
    await clearSaveFail(page);
    await page.close();
  }

  // ── B5: 기다리는 틈 ──
  if (want('busy')) {
    const unsentChat = () => ({ message: [{ role: 'user', data: core.setUnsent('평소처럼 출근한 아침', true), chatId: 'u0' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '8' } });
    const send = (page) => request(page, [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: '평소처럼 출근한 아침' }]);
    const { page, errors } = await boot(browser, fixture, unsentChat(), { ...B, clock: true });
    await setRisuBusy(page, 'busy');
    await send(page);
    await open(page); await sleep(800);
    const cancel = async () => { const b = await page.$('.gx [data-action="unsent-cancel"], .gx button:has-text("취소")'); if (b) await b.click(); await sleep(500); return b ? await page.evaluate(() => document.querySelector('.gx')?.innerText?.match(/[^\n]*취소[^\n]*/)?.[0] ?? null) : 'no-button'; };
    const c1 = await cancel();
    const n1 = (await chat(page)).message.length;
    step('busy', '만드는 중 취소 한 번', '「한 번 더 누르면 취소」, 메시지 그대로', { c1, n1 }, n1 === 1);
    await page.clock.fastForward(6000); await sleep(500);
    const c2 = await cancel();
    const n2 = (await chat(page)).message.length;
    step('busy', '5초 넘긴 뒤 다시 한 번', '(관찰) 두 번 누름 창(5초)이 지났으니 다시 「한 번 더」', { c2, n2 }, null);
    const c3 = await cancel();
    const n3 = (await chat(page)).message.length;
    step('busy', '곧바로 한 번 더', '물림(메시지 0)', { c3, n3 }, n3 === 0);
    step('busy', '페이지 오류', '없음', errors, errors.length === 0);
    await page.close();
  }

  // ── 보조 호출 스트리밍: 인물 기록 갱신기 ──
  if (want('stream')) {
    const cases = [
      ['정상 스트림', [{ stream: ['{"peo', 'ple":[]', '}'] }]],
      ['1조각 뒤 끊김 → 재전송', [{ stream: ['{"pe'], errorAfter: 1 }, '{}']],
      ['계속 끊김(3번)', [{ stream: ['{'], errorAfter: 1 }, { stream: ['{'], errorAfter: 1 }, { stream: ['{'], errorAfter: 1 }]],
      ['1조각 뒤 멈춤 → 모델 응답 대기 넘김', [{ stream: ['{"pe', 'x'], stallAfter: 1 }, '{}']],
    ];
    for (const [name, answers] of cases) {
      const { page, logs, errors } = await started({ clock: name.includes('멈춤') });
      const i = await addTurn(page, '고개를 든다.', REPLY);
      await page.evaluate(() => { window.__calls.llm = []; window.__llm = []; });
      await queueLlm(page, ...answers);
      const p = output(page, i);
      if (name.includes('멈춤')) { await sleep(3000); await page.clock.fastForward(5 * 60_000 + 5000); }
      await Promise.race([p, sleep(20000)]);
      await sleep(1500);
      const calls = await page.evaluate(() => (window.__calls.llm ?? []).map((x) => String(x.messages?.[0]?.content ?? '').slice(0, 28)));
      const streams = await page.evaluate(() => (window.__calls.llmStream ?? []).map((s) => s.state));
      step('stream', name, '정상은 1번, 끊김은 같은 요청 재전송(C-07 2회까지), 멈춤은 시간 제한 뒤 재전송', { calls, streams, log: logs.filter((l) => /갱신|실패|재/.test(l)).slice(0, 3) }, null);
      step('stream', `${name}: 페이지 오류`, '없음', errors, errors.length === 0);
      await page.close();
    }
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); }
finally {
  writeFileSync(`${OUT}/T1-${only.join('_') || 'all'}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await browser.close();
}
