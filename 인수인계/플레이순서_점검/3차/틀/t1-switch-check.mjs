// 전수점검 3차 0단계 · T1 스위치가 실제로 도는지 짧게 본다 (tests/qc-host.mjs 의 저장 실패·기다림 붙잡기·보조 호출 스트리밍·조립 단계 실패).
// 사용법: node 인수인계/플레이순서_점검/3차/틀/t1-switch-check.mjs <fixture.json>
//   fixture.json: python3 tools/build_lite_card.py 카드/원본_봇카드.jpeg <dir>/lite.charx && python3 tests/make_fixture.py <dir>/lite.charx <dir>/fixture.json
//   먼저 npm run build (dist/·dist-test/ 가 있어야 한다)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import {
  launch, boot, startChat, open, request, runner, testBodyCode,
  setSaveFail, clearSaveFail, saveFails, setRisuBusy, queueLlm, releaseStreams,
} from '../../../../tests/qc-host.mjs';

const fxPath = process.argv[2];
if (!fxPath) throw new Error('사용법: node t1-switch-check.mjs <fixture.json>');
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const core = await import('../../../../dist-test/core.mjs');
const browser = await launch();
const R = runner();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1) 저장 실패 스위치: 세 자리 × 두 꼴, n번째부터 m회, 열쇠 거르기 ──
{
  const { page } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  const call = (fn, ...a) => page.evaluate(async ([fn, a]) => {
    const [o, m] = fn.includes('.') ? fn.split('.') : [null, fn];
    try { const r = await (o ? window.risuai[o][m](...a) : window.risuai[m](...a)); return { ok: true, r: r ?? null }; }
    catch (e) { return { ok: false, e: String(e.message) }; }
  }, [fn, a]);

  await R.section('1-1 setChatToIndex throw: 2번째부터 1회만 던지고 그때는 안 씀', async () => {
    await setSaveFail(page, 'chat', { from: 2, count: 1, mode: 'throw' });
    const r1 = await call('setChatToIndex', 0, 0, { message: [{ role: 'user', data: 'a' }] });
    const r2 = await call('setChatToIndex', 0, 0, { message: [{ role: 'user', data: 'b' }] });
    const mid = await page.evaluate(() => window.__chat.message[0].data);
    const r3 = await call('setChatToIndex', 0, 0, { message: [{ role: 'user', data: 'c' }] });
    const end = await page.evaluate(() => window.__chat.message[0].data);
    assert.ok(r1.ok && !r2.ok && r3.ok, JSON.stringify([r1, r2, r3]));
    assert.match(r2.e, /시험용 저장 실패\(chat 2번째\)/);
    assert.equal(mid, 'a');
    assert.equal(end, 'c');
    assert.deepEqual((await saveFails(page)).map((f) => [f.target, f.n, f.mode]), [['chat', 2, 'throw']]);
  });
  await R.section('1-2 setChatToIndex silent: undefined 로 돌아오고 안 씀 (리스AI dbWrite 거절·없는 번호와 같은 꼴)', async () => {
    await setSaveFail(page, 'chat', { mode: 'silent' });
    const r = await call('setChatToIndex', 0, 0, { message: [{ role: 'user', data: 'z' }] });
    assert.deepEqual(r, { ok: true, r: null });
    assert.equal(await page.evaluate(() => window.__chat.message[0].data), 'c');
    await clearSaveFail(page, 'chat');
    await call('setChatToIndex', 0, 0, { message: [{ role: 'user', data: 'y' }] });
    assert.equal(await page.evaluate(() => window.__chat.message[0].data), 'y', '끄면 다시 씀');
  });
  await R.section('1-3 pluginStorage.setItem: key 거르기(goei:prefs 만) · throw / silent', async () => {
    await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'throw' });
    const a = await call('pluginStorage.setItem', 'goei:other', 'x');
    const b = await call('pluginStorage.setItem', 'goei:prefs', '{"a":1}');
    assert.ok(a.ok && !b.ok, JSON.stringify([a, b]));
    assert.equal(await page.evaluate(() => window.__store['p:goei:other']), 'x');
    await setSaveFail(page, 'storage', { key: 'goei:prefs', mode: 'silent' });
    const before = await page.evaluate(() => window.__store['p:goei:prefs'] ?? null);
    const c = await call('pluginStorage.setItem', 'goei:prefs', '{"a":2}');
    assert.ok(c.ok);
    assert.equal(await page.evaluate(() => window.__store['p:goei:prefs'] ?? null), before, 'silent: 안 씀');
    await clearSaveFail(page, 'storage');
  });
  await R.section('1-4 setCharacterToIndex throw / silent', async () => {
    const name0 = await page.evaluate(() => window.__char.name);
    await setSaveFail(page, 'char', { mode: 'throw', count: 1 });
    const a = await call('setCharacterToIndex', 0, { name: 'X1', globalLore: [] });
    assert.ok(!a.ok);
    assert.equal(await page.evaluate(() => window.__char.name), name0);
    await setSaveFail(page, 'char', { mode: 'silent' });
    const b = await call('setCharacterToIndex', 0, { name: 'X2', globalLore: [] });
    assert.ok(b.ok);
    assert.equal(await page.evaluate(() => window.__char.name), name0);
    await clearSaveFail(page);
  });
  await page.close();
}

// ── 1b) 플러그인 길: 시작 단추 저장이 조용히 안 쓰이면 채팅이 그대로이고, 던지면 화면이 죽지 않는다 ──
{
  const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  await R.section('1-5 시작 저장(setChatToIndex) silent → 실패 기록, 채팅 그대로, 페이지 오류 없음', async () => {
    await open(page);
    await page.waitForSelector('.gx-fac');
    await page.click('.gx-fac[data-value="A00"]');
    await page.click('.gx-sc[data-value="2"]');
    await setSaveFail(page, 'chat', { mode: 'silent' });
    await page.click('.gx-start');
    await sleep(2500);
    const f = await saveFails(page);
    const n = await page.evaluate(() => (window.__chat.message ?? []).length);
    console.log('  silent 시작: 실패', f.length, '회, 메시지', n, '개, 화면', await page.evaluate(() => document.querySelector('.gx')?.style.display));
    assert.ok(f.length >= 1 && f.every((x) => x.target === 'chat' && x.mode === 'silent'), JSON.stringify(f));
    assert.equal(n, 0, '조용히 안 쓰였으니 채팅은 비어 있다');
    assert.deepEqual(errors, []);
  });
  await R.section('1-6 같은 화면에서 throw → 페이지 오류 없음, 실패 기록', async () => {
    await clearSaveFail(page);
    await page.evaluate(() => { window.__calls.saveFail.length = 0; });
    if (await page.evaluate(() => document.querySelector('.gx')?.style.display === 'none')) await page.click('[x-goei-fab] button');
    await page.waitForSelector('.gx-start', { timeout: 5000 }).catch(() => {});
    await setSaveFail(page, 'chat', { mode: 'throw' });
    if (await page.$('.gx-start')) await page.click('.gx-start');
    await sleep(2500);
    const f = await saveFails(page);
    const txt = await page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
    const note = (txt.match(/[^\n]*(실패|저장)[^\n]*/) || [''])[0];
    console.log('  throw 시작: 실패', f.length, '회, 화면 안내:', note.slice(0, 80), '| 로그', logs.filter((l) => /실패/.test(l)).slice(0, 2).join(' / ').slice(0, 160));
    assert.ok(f.length >= 1, '던지기가 한 번은 걸린다');
    assert.deepEqual(errors, []);
    await clearSaveFail(page);
  });
  await page.close();
}

// ── 2) 기다림 붙잡기: .loadmove / .button-icon-send ──
// 판정 화면: 보내지 못한 직접 입력 하나만 있는 채팅은 기다리는 중이면 「진행 중」, 기다림이 풀리면 시작 화면(다시 고르기)이 열린다 (core/start.ts unsentOpening, ui/app.ts refresh)
{
  const unsentChat = () => ({ message: [{ role: 'user', data: core.setUnsent('직접 입력 첫 상황', true), chatId: 'u0' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } });
  const send = (page) => request(page, [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: '직접 입력 첫 상황' }]);
  // 시작 화면 = 소속 고르기 칸(.gx-fac)이 보임. 진행 중 화면에도 .gx-start(상황판 켜기)가 있어 그것으로는 못 가른다
  const startShown = (page) => page.evaluate(() => document.querySelector('.gx')?.style.display !== 'none' && [...document.querySelectorAll('.gx-fac')].some((e) => e.offsetParent !== null));

  await R.section('2-1 DOM: 스위치가 플러그인이 읽는 자리(.default-chat-screen 안)에 단추를 넣고 뺀다', async () => {
    const { page } = await boot(browser, fixture, unsentChat(), { fixtureDir });
    const q = () => page.evaluate(async () => {
      const s = await window.__rootDoc.querySelector('.default-chat-screen');
      return { busy: !!(await s.querySelector('.loadmove')), idle: !!(await s.querySelector('.button-icon-send')) };
    });
    await setRisuBusy(page, 'busy'); const a = await q();
    await setRisuBusy(page, 'idle'); const b = await q();
    await setRisuBusy(page, 'none'); const c = await q();
    assert.deepEqual([a, b, c], [{ busy: true, idle: false }, { busy: false, idle: true }, { busy: false, idle: false }]);
    await page.close();
  });

  await R.section('2-2 기다리는 중 .loadmove 있으면 진행 중 유지, .button-icon-send 로 바꾸면 창 열 때 바로 풀림', async () => {
    const { page, errors } = await boot(browser, fixture, unsentChat(), { fixtureDir });
    await setRisuBusy(page, 'busy');
    await send(page);
    await open(page);
    await sleep(800);
    const busyStart = await startShown(page);
    await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()); // 창 닫기
    await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none', null, { timeout: 5000 });
    await setRisuBusy(page, 'idle');
    await page.click('[x-goei-fab] button'); // 다시 열기: ui/app.ts refresh 가 freeUseLock 으로 리스AI 화면을 본다
    await sleep(1200);
    const idleStart = await startShown(page);
    console.log('  busy 일 때 시작 화면', busyStart, '/ idle 로 바꾼 뒤', idleStart);
    assert.equal(busyStart, false, '만드는 중이면 다시 고르기 화면이 안 열린다');
    assert.equal(idleStart, true, '쉬는 중이면 기다림이 풀려 다시 고르기 화면');
    assert.deepEqual(errors, []);
    await page.close();
  });

  await R.section('2-3 가짜 시계: 3분 넘겨도 .loadmove 면 그대로, 단추를 뺀 뒤 다시 확인(30초)에서 풀려 창이 시작 화면으로', async () => {
    const { page, errors } = await boot(browser, fixture, unsentChat(), { fixtureDir, clock: true });
    await setRisuBusy(page, 'busy');
    await send(page);
    await open(page);
    await sleep(800);
    const s0 = await startShown(page);
    await page.clock.fastForward(181_000);
    await sleep(800);
    const s1 = await startShown(page);
    await setRisuBusy(page, 'none');
    await page.clock.fastForward(31_000);
    await sleep(1500);
    const s2 = await startShown(page);
    console.log('  보낸 직후', s0, '/ 3분 뒤(busy)', s1, '/ 단추 뺀 뒤 30초', s2);
    assert.deepEqual([s0, s1, s2], [false, false, true]);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

// ── 3) 보조 호출 스트리밍: 리스AI 꼴 {type:'streaming', result: ReadableStream<{"0": 누적 글}>} ──
{
  const { page } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  // src/host/llm.ts readStream 과 같은 읽기 (값이 글이면 그대로, 객체면 첫 값, 마지막 것을 답으로)
  const readVia = (wait) => page.evaluate(async (wait) => {
    const res = await window.risuai.runLLMModel({ messages: [{ role: 'user', content: 'q' }], mode: 'submodel' });
    if (res.type !== 'streaming') return { type: res.type };
    const reader = res.result.getReader();
    const seen = [];
    let last = '';
    const loop = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        seen.push(value);
        last = typeof value === 'string' ? value : String(Object.values(value)[0] ?? last);
      }
      return 'done';
    })().catch((e) => 'error:' + e.message);
    const out = await Promise.race([loop, new Promise((r) => setTimeout(() => r('pending'), wait))]);
    window.__pendingLoop = loop;
    return { type: res.type, out, seen, last };
  }, wait);

  await R.section('3-1 조각으로 돌려주기 (객체 꼴 누적)', async () => {
    await queueLlm(page, { stream: ['가나', '다라', '마'] });
    const r = await readVia(3000);
    assert.equal(r.type, 'streaming');
    assert.equal(r.out, 'done');
    assert.deepEqual(r.seen, [{ 0: '가나' }, { 0: '가나다라' }, { 0: '가나다라마' }]);
    assert.equal(r.last, '가나다라마');
  });
  await R.section('3-2 글 꼴 (form string)', async () => {
    await queueLlm(page, { stream: ['A', 'B'], form: 'string' });
    const r = await readVia(3000);
    assert.deepEqual(r.seen, ['A', 'AB']);
  });
  await R.section('3-3 조각 받다 멈추기 (stallAfter) → 풀면 마저 받고 닫힘', async () => {
    await queueLlm(page, { stream: ['하나', '둘', '셋'], stallAfter: 1 });
    const r = await readVia(1200);
    assert.equal(r.out, 'pending');
    assert.deepEqual(r.seen, [{ 0: '하나' }]);
    assert.equal(await releaseStreams(page), 1);
    const end = await page.evaluate(() => window.__pendingLoop);
    assert.equal(end, 'done');
    const log = await page.evaluate(() => window.__calls.llmStream.at(-1));
    assert.equal(log.state, 'closed');
    assert.equal(log.sent, 3);
  });
  await R.section('3-4 조각 받다 끊기 (errorAfter) → 읽기가 오류', async () => {
    await queueLlm(page, { stream: ['하나', '둘'], errorAfter: 1 });
    const r = await readVia(2000);
    assert.match(r.out, /^error:시험용 스트림 끊김/);
    assert.deepEqual(r.seen, [{ 0: '하나' }]);
  });
  await R.section('3-5 글 답 줄 세우기와 섞기 · 기록', async () => {
    await queueLlm(page, '그냥 글');
    const r = await page.evaluate(() => window.risuai.runLLMModel({ messages: [], mode: 'model' }));
    assert.deepEqual(r, { type: 'success', result: '그냥 글' });
    assert.equal(await page.evaluate(() => window.__calls.llm.length), 5);
  });
  await page.close();
}

// ── 4) 조립 단계 실패: 시험 본체(dist-test/goei-body.js) + globalThis.__goeiFaultSteps ──
{
  const { page, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, body: testBodyCode });
  await startChat(page, 'A00', 2);
  await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '첫 행동', chatId: 'u1' }); });
  await R.section('4-1 「주인공」 단계만 실패 → 요청은 나가고 실패 로그 한 줄', async () => {
    await page.evaluate(() => { globalThis.__goeiFaultSteps = ['주인공']; });
    logs.length = 0;
    const out = await request(page, [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: '첫 행동' }]);
    const line = logs.find((l) => l.includes('요청 조립 실패'));
    console.log('  ', line);
    assert.ok(Array.isArray(out) && out.length >= 2);
    assert.match(line ?? '', /주인공\(시험용 예외 주입\)/);
    await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  });
  await page.close();
  // 배포 본체에는 주입 블록이 없다
  await R.section('4-2 배포 본체(dist/goei-body.js)에는 __goeiFaultSteps 가 없음', async () => {
    const dist = readFileSync(new URL('../../../../dist/goei-body.js', import.meta.url), 'utf8');
    assert.ok(!dist.includes('__goeiFaultSteps'));
    assert.ok(testBodyCode.includes('__goeiFaultSteps'));
  });
}

await browser.close();
console.log(`\n${R.results.length - R.failed()}/${R.results.length} 통과`);
process.exit(R.failed() ? 1 : 0);
