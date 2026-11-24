// 3차 D 구간 · T1(가짜 리스) 칸: 저장 실패 셋(chat·storage·char × throw·silent)과 조립 단계 실패(__goeiFaultSteps).
// 사용: node 인수인계/플레이순서_점검/3차/D/t1/run-t1.mjs <fixture.json> [--only c1,c2,...]
//   fixture.json 만들기·빌드는 3차/틀/T1_사용법.md. 본체는 시험 본체(dist-test/goei-body.js, 배포 본체와 같고 주입 블록만 남김).
// 단계마다 기대값·결정표 줄을 먼저 적고(step 의 want/ref) 실제값을 붙인다. src·tests/qc-host.mjs 는 안 건드림. 결과는 out/(gitignore).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launch, boot, startChat, request, output, testBodyCode,
  setSaveFail, clearSaveFail, saveFails,
} from '../../../../../tests/qc-host.mjs';
import { readRequest, buildReply, redact } from '../lib.mjs';

const argv = process.argv.slice(2);
const fxPath = argv.find((a) => !a.startsWith('--'));
if (!fxPath) throw new Error('사용법: node run-t1.mjs <fixture.json> [--only c1,c2]');
const ONLY = (argv[argv.indexOf('--only') + 1] && argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '').split(',').filter(Boolean);
const on = (k) => !ONLY.length || ONLY.includes(k);
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const OUT = fileURLToPath(new URL(`./out/run-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), body: 'dist-test/goei-body.js', steps: [] };
const save = () => writeFileSync(OUT + '/result.json', JSON.stringify(res, null, 1));
/** ok: true(기대대로) / false(어긋남) / null(사실 기록) */
const step = (id, name, ok, want, ref, got) => {
  res.steps.push({ id, name, ok, want, ref, got });
  console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 400));
  save();
};
/** lib.mjs redact() 위에 한 겹 더: 지침·로어 속 「N years old」·「N-year-old」 꼴 나이도 지운다 */
const scrub = (t) => t.replace(/\b(approximately |about |around )?[a-z]+(-[a-z]+)? years? old\b/gi, '[생략]').replace(/\b\d+-year-old\b/gi, '[생략]').replace(/\b\d+ years? old\b/gi, '[생략]');
const saveReq = (name, msgs) => {
  const p = `${OUT}/${name}-request.txt`;
  writeFileSync(p, scrub(redact(msgs.map((m, i) => `===== [${i}] ${m.role} (${String(m.content).length}자)\n${m.content}`).join('\n\n'))));
  return p.replace(OUT + '/', '');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DIR = {};
{ const raw = readFileSync(new URL('../../../../../지침/이동_임무_지시문.txt', import.meta.url), 'utf8'); for (const m of raw.matchAll(/===([A-Z]+)===\n([\s\S]*?)(?====|$)/g)) DIR[m[1]] = m[2].trim(); }
const has = (s, sec) => String(s).includes(sec.slice(0, 60));
const PROSE = '쟈알디가 서류를 덮었다.\n\n"출발한다."';
const ST = { date: '2025.01.01', time: '02:47 AM', weather: '☀️', temp: '4°C', place: '서울 종로구 관리국 본부 로비', companions: '없음', identity: '관리국/신입' };
/** 출동 턴 답: P002 작전투입 + 잔고를 바꿔 가계부 맞춤 저장이 한 번 더 일어나게 */
const DEP_REPLY = { status: { ...ST, balance: '120000' }, tags: ['[AG|P002|작전투입|현장으로 이동 중]'], mutate: (w) => w.filter((x) => !x.startsWith('[AG|P002|')) };

const browser = await launch();
let nid = 0;
const id = (p) => `${p}${++nid}`;

// ── 공용 도우미 ──
async function fresh(opts = {}) {
  const b = await boot(browser, opts.char ?? fixture, opts.chat ?? { message: [], scriptstate: {} }, { fixtureDir, body: testBodyCode, viewport: { width: 1280, height: 800 }, ...(opts.prefs ? { prefs: opts.prefs } : {}) });
  return b;
}
const getChat = (page) => page.evaluate(() => window.__clone(window.__chat));
const world = async (page) => { const c = await getChat(page); try { return JSON.parse(c.scriptstate.$goei_world); } catch { return null; } };
const toMsgs = (chat) => [{ role: 'system', content: 'SYSTEM' }, ...(chat.message ?? []).map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: String(m.data) }))];
const lastUser = (msgs) => [...msgs].reverse().find((m) => m.role === 'user')?.content ?? '';
const agLine = (msgs, pid) => (msgs.map((m) => m.content).join('\n').match(new RegExp(`^(NEW )?\\[AG\\|${pid}\\|[^\\]\\n]*\\]`, 'm')) ?? [null])[0];
const sends = (page) => page.evaluate(() => (window.__calls.send ?? []).length);
const setChats = (page) => page.evaluate(() => window.__counts.setChat);
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; }, sel);
const winOpen = (page) => page.evaluate(() => { const g = document.querySelector('.gx'); return !!g && g.style.display !== 'none'; });
const notice = (page) => page.evaluate(() => [...document.querySelectorAll('.gx .gx-err, .gx .gx-notice')].filter((e) => e.offsetParent !== null).map((e) => e.innerText.trim()).join(' / ') || null);
const gwNotice = (page) => page.evaluate(() => { const t = document.querySelector('.gw')?.innerText ?? ''; return (t.match(/[^\n]*(저장하지 못|실패|못했)[^\n]*/g) ?? []).join(' / ') || null; });
async function openWin(page) {
  if (await winOpen(page)) return;
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 15000 });
  await page.click('[x-goei-fab] button');
  await page.waitForFunction(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none' && !g.querySelector('.gx-empty')?.textContent?.includes('읽는 중'); });
  await sleep(300);
}
async function closeWin(page) {
  if (!(await winOpen(page))) return;
  await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click());
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none', null, { timeout: 15000 }).catch(() => {});
}
async function reopen(page) { await closeWin(page); await openWin(page); }
const click = async (page, sel) => { const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel); if (!ok) throw new Error('없음: ' + sel); await sleep(400); };

/** 한 턴: (user 글을 채팅에 넣고) 요청 조립 → 답 짓기 → 채팅에 답 → 응답 처리 */
async function turn(page, { user, reply = {}, beforeOutput } = {}) {
  if (user) await page.evaluate(([d, i]) => window.__chat.message.push({ role: 'user', data: d, chatId: i }), [user, id('u')]);
  const msgs = toMsgs(await getChat(page));
  const out = await request(page, msgs);
  const req = readRequest({ messages: out });
  const text = typeof reply === 'function' ? reply(req) : buildReply(req, { prose: PROSE, status: ST, ...reply });
  await page.evaluate(([d, i]) => window.__chat.message.push({ role: 'char', data: d, chatId: i }), [text, id('c')]);
  if (beforeOutput) await beforeOutput();
  const n0 = await setChats(page);
  await output(page);
  await sleep(600);
  return { out, req, text, saves: (await setChats(page)) - n0 };
}
/** 시작(관리국, 상황 2) + 한 턴 (NEW 줄을 다 채운 답) */
async function played(page) {
  await startChat(page, 'A00', 2);
  await page.evaluate(() => { window.__chat.scriptstate.$pp_when = 'manual'; window.__chat.scriptstate.$ph_auto = '0'; });
  return turn(page, { user: '쟈알디에게 말을 건다.' });
}
/** 지도 탭에서 첫 활성 괴이를 목표로, P002 편성 */
async function pickDepart(page) {
  await openWin(page);
  await click(page, '.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  await page.waitForSelector('.gx-canvas');
  const ev = await page.evaluate(() => [...document.querySelectorAll('[data-action="ev-pop"]')].map((e) => e.dataset.value).find((v) => v.startsWith('an|')));
  await click(page, `[data-action="ev-pop"][data-value="${ev}"]`);
  await click(page, '.ev-pop [data-action="pick-event"]');
  await page.waitForFunction(() => (document.querySelector('.gx-goal b')?.textContent.trim() ?? '미정') !== '미정', null, { timeout: 15000 });
  await sleep(300);
  await click(page, '.gx-acard.pick[data-value="P002"]');
  const goal = (await page.textContent('.gx-goal b')).trim();
  return { ev, goal };
}
async function goMission(page) {
  await openWin(page);
  if (!(await page.evaluate(() => document.querySelector('.gx')?.dataset.tab === 'mission' && !!document.querySelector('.gx-mission')))) {
    await click(page, '.gx-nav .gx-nb:not(.mob)[data-value="map"]');
    await page.waitForSelector('.gx-mswap[data-value="mission"]');
    await click(page, '.gx-mswap[data-value="mission"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'mission' && !!document.querySelector('.gx-mission'));
  }
}
async function pickMission(page, q = '금지된 비디오') {
  await goMission(page);
  await click(page, '[data-action="mission-kind"][data-value="an"]');
  await page.fill('.gx-search', q);
  await page.waitForFunction((q) => [...document.querySelectorAll('.gx-mlist li.gx-mx')].length > 0 && [...document.querySelectorAll('.gx-mlist li.gx-mx')].every((li) => li.textContent.includes(q)), q, { timeout: 15000 });
  await click(page, '.gx-mlist li.gx-mx [data-action="mission-open"]');
  const before = await page.evaluate(() => document.querySelector('.gx-goal b')?.textContent.trim() ?? null);
  await click(page, '.gx-mlist li.gx-mx.open [data-action="mission-pick"]');
  await page.waitForFunction((b) => (document.querySelector('.gx-goal b')?.textContent.trim() ?? null) !== b, before, { timeout: 15000 });
  return (await page.textContent('.gx-goal b')).trim();
}
/** 상황판에서 그 이름의 상황을 고르고 종료 단추를 한 번 누른다 */
async function endPress(page, name) {
  await openWin(page);
  if (!(await page.locator('.gx-board').count())) await click(page, '.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  if (!(await page.locator('.gx-opview [data-action="end-event"]').count())) await page.click(`.gx-board li.gx-oprow:has-text("${name}")`);
  await sleep(300);
  await page.click('.gx-opview [data-action="end-event"]');
  await sleep(600);
  return page.getAttribute('.gx-opview [data-action="end-event"]', 'aria-label').catch(() => null);
}
async function openRoster(page) {
  await openWin(page);
  await click(page, '.gx [data-action="ed-open"]');
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  await click(page, '.gw [data-action="ed-tab"][data-value="world"]');
  await page.waitForFunction(() => !!document.querySelector('.gw [data-action="ed-node"][data-value="agent"]'));
  await click(page, '.gw [data-action="ed-node"][data-value="agent"]');
  await sleep(500);
}
const rosterOrder = (page) => page.evaluate(() => [...document.querySelectorAll('.gw [data-action="dir-move"][data-value^="up|"]')].map((e) => e.dataset.value.slice(3)));
const charAgentOrder = (page) => page.evaluate(() => { const e = (window.__char.globalLore ?? []).find((x) => /명부|Directory|directory/.test(String(x.comment ?? '')) && String(x.content ?? '').includes('잼트리')); if (!e) return null; const s = String(e.content); return ['쟈알디', '스팡달', '잼트리'].map((n) => [n, s.indexOf(n)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); });
async function closeEditor(page) {
  await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click());
  await sleep(400);
  if (await page.$('.gw [data-action="ed-close-force"]')) await page.evaluate(() => document.querySelector('.gw [data-action="ed-close-force"]').click());
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true, null, { timeout: 15000 }).catch(() => {});
}
const boardAgents = async (page) => { await reopen(page); if (!(await page.locator('.gx-board').count())) await click(page, '.gx-nav .gx-nb:not(.mob)[data-value="board"]'); return page.evaluate(() => [...document.querySelectorAll('[data-action="agent-info"]')].map((e) => e.dataset.value)); };
const failLogs = (logs) => logs.filter((l) => /실패/.test(l));

// ── 기준: 실패 없는 출동 한 턴 (뒤 갈래와 대조) ──
let BASE = null;
if (on('t0') || on('c3') || on('c4') || on('c5')) {
  const { page, logs, errors } = await fresh();
  await played(page);
  const { goal } = await pickDepart(page);
  const s0 = await sends(page);
  await click(page, '[data-action="depart"]');
  await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  const chat1 = await getChat(page);
  // 응답 처리 저장을 하나하나 기록 (몇 번째 저장이 무엇을 바꾸는지)
  const snap0 = await page.evaluate(() => window.__calls.setChat.length);
  const tr = await turn(page, { reply: DEP_REPLY });
  const saves = await page.evaluate((n) => window.__calls.setChat.slice(n), snap0);
  const diffKeys = saves.map((c, i) => { const p = i ? saves[i - 1] : chat1; const ks = Object.keys(c.scriptstate ?? {}).filter((k) => JSON.stringify(c.scriptstate[k]) !== JSON.stringify(p.scriptstate?.[k])); const msgChanged = JSON.stringify(c.message) !== JSON.stringify(p.message); return { n: i + 1, vars: ks, message: msgChanged }; });
  const w = await world(page);
  BASE = { directive: lastUser(tr.out), saves: tr.saves, diffKeys, p002: w?.agents?.P002 ?? null };
  const lu = lastUser(tr.out);
  step('T0-1', '기준: 출동 → 다음 본편 요청 마지막 user 칸 지시문', has(lu, DIR.COMMON) && has(lu, DIR.CONTINUATION) && /Subject: /.test(lu) && /Companions: /.test(lu) && !has(lu, DIR.OPENING) && (await sends(page)) === s0 + 1,
    'COMMON + CONTINUATION + CONTEXT(Subject·Companions), OPENING 없음, 자동 전송 1회', '코스 D2, B-10 Claude 판정', { goal, sends: (await sends(page)) - s0, req: saveReq('t0-depart', tr.out) });
  step('T0-2', '기준: 응답 처리 저장 차례 (뒤 갈래 대조용)', null, '응답 처리 한 번의 setChatToIndex 수와 저장마다 바뀐 칸', 'Claude 판정(기록)', { saves: tr.saves, diffKeys, p002: BASE.p002 });
  const t2 = await turn(page, { user: '현장을 살핀다.' });
  step('T0-3', '기준: 다음 턴 요청의 P002 줄', /\[AG\|P002\|작전투입/.test(agLine(t2.out, 'P002') ?? ''), '[AG|P002|작전투입|…]', '코스 D2', { line: agLine(t2.out, 'P002'), errors });
  await page.close();
}

// ── C1·C2 출동 놓기(compose updateChat) 저장 실패 ──
for (const mode of ['throw', 'silent']) {
  const k = mode === 'throw' ? 'c1' : 'c2';
  if (!on(k)) continue;
  const { page, logs, errors } = await fresh();
  await played(page);
  await pickDepart(page);
  const n0 = (await getChat(page)).message.length;
  const s0 = await sends(page);
  await setSaveFail(page, 'chat', { from: 1, count: 1, mode });
  await page.click('[data-action="depart"]');
  await sleep(1500);
  const c = await getChat(page);
  const got = { mode, notice: await notice(page), windowOpen: await winOpen(page), msgs: c.message.length - n0, sends: (await sends(page)) - s0, fails: await saveFails(page), teamKept: await page.evaluate(() => !!document.querySelector('.gx-acard.pick.on[data-value="P002"], .gx-acard.pick[data-value="P002"][aria-pressed="true"]')), errors: [...errors] };
  if (mode === 'throw') {
    step('C1-1', '출동 「출발」 저장이 던짐 → 안내, 카드 안 놓음, 안 보냄, 창·편성 유지', /시험용 저장 실패/.test(got.notice ?? '') && got.msgs === 0 && got.sends === 0 && got.windowOpen,
      '창에 실패 안내(오류 글), 채팅 메시지 그대로, 자동 전송 없음, 창이 열린 채 고른 목표·편성이 남아 다시 누를 수 있음', 'Claude 판정 (결정표에 줄 없음, 공-18 막지 않고 알림)', got);
    await clearSaveFail(page);
    await page.click('[data-action="depart"]');
    await sleep(1500);
    const c2 = await getChat(page);
    const lu = String(c2.message.at(-1)?.data ?? '');
    step('C1-2', '실패 뒤 그대로 다시 「출발」 → 카드 놓이고 보냄', lu.startsWith('%%SCENE_CARD:') && (await sends(page)) - s0 === 1, '두 번째 누름에 카드 1개, 자동 전송 1회', 'Claude 판정', { msgs: c2.message.length - n0, sends: (await sends(page)) - s0, notice: await notice(page) });
  } else {
    // 리스AI 권한 거절(dbWrite)·채팅 번호 밀림이면 setChatToIndex 가 조용히 안 쓴다. 그때 sendChat('') 은 지금 채팅을 그대로 보낸다 (v3.svelte.ts sendChat → processSendChat)
    const tr = await turn(page, {});
    const lu = lastUser(tr.out);
    step('C2-1', '출동 「출발」 저장이 조용히 안 써짐 → 플러그인이 알아채는지, 무엇이 보내지는지', got.msgs === 0 && got.sends === 0 ? true : false,
      '(Claude 판정) 저장이 안 됐으면 보내지 않거나 안내한다 — 카드 없이 sendChat 을 부르면 리스AI 는 직전 채팅을 그대로 다시 보낸다', 'Claude 판정 (결정표에 줄 없음)', { ...got, nextLastUser: lu.slice(0, 120), directiveInRequest: has(lu, DIR.COMMON), req: saveReq('c2-silent-next', tr.out) });
  }
  await page.close();
}

// ── C3·C4·C5 출동 뒤 응답 처리 저장 실패 ──
for (const [k, mode, from] of [['c3', 'throw', 1], ['c4', 'silent', 1], ['c5', 'throw', 2]]) {
  if (!on(k)) continue;
  const { page, logs, errors } = await fresh();
  await played(page);
  await pickDepart(page);
  await click(page, '[data-action="depart"]');
  await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  logs.length = 0;
  const tr = await turn(page, { reply: DEP_REPLY, beforeOutput: () => setSaveFail(page, 'chat', { from, count: 1, mode }) });
  const fails = await saveFails(page);
  await clearSaveFail(page);
  const c = await getChat(page);
  const w = await world(page);
  const lastData = String(c.message.at(-1)?.data ?? '');
  const shown = await page.evaluate((t) => window.__calls.handlers.display(t), lastData);
  const got = {
    mode, from, fails, logs: failLogs(logs), savesInOutput: tr.saves, baseSaves: BASE?.saves, baseDiff: BASE?.diffKeys,
    p002: w?.agents?.P002?.st ?? null,
    tagsLeftInStored: /\[AG\|P00\d\|/.test(lastData), tagsShown: /\[AG\|/.test(shown),
    prevKeyIdx: (() => { try { return JSON.parse(c.scriptstate.$goei_prev).i; } catch { return null; } })(), msgs: c.message.length,
    walletLog: (() => { try { return JSON.parse(c.scriptstate.$st_wallet).log.map((e) => e.amount); } catch { return null; } })(),
  };
  // 다음 턴의 요청: P002 줄, 직전 상태 잔고
  const t2 = await turn(page, { user: '현장을 살핀다.' });
  const w2 = await world(page);
  got.nextP002Line = agLine(t2.out, 'P002');
  got.nextPrevStatus = (t2.out.find((m) => m.content.startsWith('[Previous status]'))?.content.match(/\[▣[^\n]*\]/) ?? [null])[0];
  got.afterNextTurnP002 = w2?.agents?.P002?.st ?? null;
  got.nextReq = saveReq(`${k}-next`, t2.out);
  got.errors = [...errors];
  if (k === 'c5') {
    step('C5-1', '응답 처리 둘째 저장(가계부 맞춤)만 던짐 → 첫 저장(상황판)은 남음', got.p002 === '작전투입' && /작전투입/.test(got.nextP002Line ?? '') && got.logs.length === 0,
      '둘째 저장(기준 T0-2 의 2번째, 가계부)만 빠지고 P002 작전투입은 남음, 「응답 처리 실패」 로그 없음(.catch 로 삼킴)', 'Claude 판정', got);
  } else {
    step(k === 'c3' ? 'C3-1' : 'C4-1', `응답 처리 첫 저장(상황판 반영) ${mode} → 뒤 처리·다음 요청`, got.p002 === '작전투입' || /작전투입/.test(got.nextP002Line ?? ''),
      '(Claude 판정, 공-02 일관) 첫 저장이 실패해도 그 응답의 상황판 변경(P002 작전투입)이 다시 시도되거나 다음 요청까지는 반영되고, 가계부·사용·상점·로어 고르기 등 뒤 처리는 따로 돈다', 'Claude 판정 (결정표에 줄 없음) · 코스 5장 「다시 시도 없음, 첫 저장 실패 시 뒤 처리 빠짐」', got);
  }
  await page.close();
}

// ── C6 커스텀 임무 요청 저장 실패 ──
for (const mode of ['throw', 'silent']) {
  if (!on('c6')) break;
  const { page, errors } = await fresh();
  await played(page);
  const name = await pickMission(page);
  const n0 = (await getChat(page)).message.length;
  const s0 = await sends(page);
  await setSaveFail(page, 'chat', { from: 1, count: 1, mode });
  await page.click('[data-action="mission-send"]');
  await sleep(1500);
  const c = await getChat(page);
  const w = await world(page);
  const got = { mode, name, notice: await notice(page), windowOpen: await winOpen(page), msgs: c.message.length - n0, sends: (await sends(page)) - s0, pending: w?.pending ?? null, fails: await saveFails(page), errors: [...errors] };
  await clearSaveFail(page);
  if (mode === 'throw') {
    step('C6-1', '임무 요청 저장이 던짐 → 안내, 카드·대기 없음, 안 보냄', /시험용 저장 실패/.test(got.notice ?? '') && got.msgs === 0 && got.sends === 0 && !got.pending?.an, '창에 실패 안내, 카드·pending 없음, 전송 없음', 'Claude 판정 (결정표에 줄 없음)', got);
  } else {
    const tr = await turn(page, {});
    const lu = lastUser(tr.out);
    got.nextHasDirective = has(lu, DIR.COMMON);
    got.nextHasNew = /NEW \[AN\|[^\n]*금지된 비디오/.test(tr.out.map((m) => m.content).join('\n'));
    got.req = saveReq('c6-silent-next', tr.out);
    step('C6-2', '임무 요청 저장이 조용히 안 써짐 → 무엇이 보내지는지', got.sends === 0, '(Claude 판정) 저장 안 된 것을 알아채고 안 보냄. 실제: C2 와 같은 꼴인지', 'Claude 판정', got);
  }
  await page.close();
}

// ── C7 요청 취소 저장 실패: (a) 답 없는 카드째 물림 (b) 답 붙은 뒤 대기만 지움 ──
for (const mode of ['throw', 'silent']) {
  if (!on('c7')) break;
  // (a) 카드를 놓고(보낸 것으로 기록만, 요청 조립 안 함 = 답 없이 끝남) 「요청 취소」
  {
    const { page, errors } = await fresh();
    await played(page);
    const name = await pickMission(page);
    await page.click('[data-action="mission-send"]');
    await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
    await goMission(page);
    const n0 = (await getChat(page)).message.length;
    await setSaveFail(page, 'chat', { from: 1, count: 1, mode });
    await click(page, '[data-action="mission-cancel"][data-value="an"]');
    await sleep(1200);
    const c = await getChat(page);
    const w = await world(page);
    const got = { mode, name, notice: await notice(page), msgs: c.message.length - n0, cardLast: String(c.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), pending: w?.pending ?? null, cancelBar: await page.evaluate(() => !!document.querySelector('[data-action="mission-cancel"]')), fails: await saveFails(page), errors: [...errors] };
    await clearSaveFail(page);
    step(mode === 'throw' ? 'C7a-1' : 'C7a-2', `답 없는 임무 카드 「요청 취소」 저장 ${mode}`, mode === 'throw' ? (/시험용 저장 실패/.test(got.notice ?? '') && got.cardLast && got.pending?.an === name && got.cancelBar) : (got.cardLast && got.cancelBar),
      mode === 'throw' ? '창에 실패 안내, 카드·대기 그대로, 취소 띠가 남아 다시 누를 수 있음' : '(Claude 판정) 안 지워졌으면 화면도 카드·대기가 남은 것으로 보임(지운 척 안 함)', 'Claude 판정 (field.ts cancelRequest 설계)', got);
    // 다음 요청: 카드가 남아 있으면 지시문이 다시 가는지
    const tr = await turn(page, {});
    step(mode === 'throw' ? 'C7a-3' : 'C7a-4', `취소 실패(${mode}) 뒤 다음 요청`, null, '사실 기록: 남은 카드의 지시문·NEW 줄이 그대로 가는지', 'Claude 판정(기록)', { directive: has(lastUser(tr.out), DIR.COMMON), newRow: /NEW \[AN\|[^\n]*금지된 비디오/.test(tr.out.map((m) => m.content).join('\n')), req: saveReq(`c7a-${mode}-next`, tr.out) });
    await page.close();
  }
  // (b) 카드에 답이 붙음(NEW 줄은 안 채운 답) → 대기만 지우는 길
  {
    const { page, errors } = await fresh();
    await played(page);
    const name = await pickMission(page);
    await page.click('[data-action="mission-send"]');
    await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
    await turn(page, { reply: { mutate: (w) => w.filter((x) => !x.includes(name)) } });
    const w0 = await world(page);
    await goMission(page);
    await setSaveFail(page, 'chat', { from: 1, count: 1, mode });
    await click(page, '[data-action="mission-cancel"][data-value="an"]');
    await sleep(1200);
    const w = await world(page);
    const got = { mode, name, pendingBefore: w0?.pending ?? null, pendingAfter: w?.pending ?? null, notice: await notice(page), cancelBar: await page.evaluate(() => !!document.querySelector('[data-action="mission-cancel"]')), fails: await saveFails(page), errors: [...errors] };
    await clearSaveFail(page);
    step(mode === 'throw' ? 'C7b-1' : 'C7b-2', `답 붙은 임무의 「요청 취소」(대기만 지움) 저장 ${mode}`, mode === 'throw' ? (/시험용 저장 실패/.test(got.notice ?? '') && got.pendingAfter?.an === name && got.cancelBar) : (got.pendingAfter?.an === name && got.cancelBar),
      mode === 'throw' ? '창에 실패 안내, 대기·취소 띠 그대로' : '(Claude 판정) 안 지워졌으면 화면도 대기가 남음', 'Claude 판정 (field.ts saveWorld)', got);
    await page.close();
  }
}

// ── C8 손으로 종료(두 번) 저장 실패 ──
for (const mode of ['throw', 'silent']) {
  if (!on('c8')) break;
  const { page, errors } = await fresh();
  await played(page);
  const w0 = await world(page);
  const target = w0.an.find((a) => a.state === '활성')?.name;
  const l1 = await endPress(page, target);
  await setSaveFail(page, 'chat', { from: 1, count: 1, mode });
  const l2 = await endPress(page, target);
  await sleep(800);
  const w = await world(page);
  const c = await getChat(page);
  const listed = await page.evaluate((n) => [...document.querySelectorAll('.gx-board li.gx-oprow')].some((li) => li.textContent.includes(n)), target);
  const got = { mode, target, firstLabel: l1, afterLabel: l2, notice: await notice(page), stillActive: (w?.an ?? []).some((a) => a.name === target), listed, journal: (() => { try { return JSON.parse(c.scriptstate.$goei_journal).rows.filter((r) => r.name === target).length; } catch { return 0; } })(), fails: await saveFails(page), errors: [...errors] };
  await clearSaveFail(page);
  // 다시 한 번(두 번) 누르면 끝나는지
  await endPress(page, target); await endPress(page, target); await sleep(800);
  const w2 = await world(page);
  got.retryEnded = !(w2?.an ?? []).some((a) => a.name === target);
  step(mode === 'throw' ? 'C8-1' : 'C8-2', `손으로 종료 둘째 누름 저장 ${mode}`, mode === 'throw' ? (/시험용 저장 실패/.test(got.notice ?? '') && got.stillActive && got.listed && got.retryEnded) : (got.stillActive && got.listed && got.retryEnded),
    mode === 'throw' ? '창에 실패 안내, 상황 그대로·일지 없음, 다시 두 번 누르면 끝남' : '(Claude 판정) 화면에도 상황이 그대로 남음(끝난 척 안 함), 다시 누르면 끝남', 'D-04 · Claude 판정', got);
  await page.close();
}

// ── G1 기기 저장소(goei:prefs): 덧붙일 규칙(이동·임무) 끄기 저장 실패 → 출동 지시문 · 새로 연 뒤 ──
for (const mode of ['throw', 'silent']) {
  if (!on('g1')) break;
  const { page, errors, logs } = await fresh();
  await played(page);
  // 규칙 하나를 정상 저장: 새 규칙 → 본문 → 붙일 곳 RP 끄고 이동·임무 켬
  await openWin(page);
  await click(page, '.gx [data-action="ed-open"]');
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  await click(page, '.gw [data-action="ed-tab"][data-value="guide"]');
  await page.waitForFunction(() => !!document.querySelector('.gw [data-action="ed-node"][data-value="rule:all"]'));
  await click(page, '.gw [data-action="ed-node"][data-value="rule:all"]');
  await click(page, '.gw [data-action="ed-rule-new"]');
  const rid = await page.evaluate(() => document.querySelector('.gw [data-input="ed-rule-text"]')?.dataset.key);
  await page.evaluate(([k, v]) => { const e = document.querySelector(`.gw [data-input="ed-rule-text"][data-key="${k}"]`); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [rid, 'T1RULE keep the companions quiet.']);
  await sleep(900);
  await click(page, `.gw [data-action="ed-rule-to"][data-value="${rid}|RP"]`);
  await click(page, `.gw [data-action="ed-rule-to"][data-value="${rid}|Directive"]`);
  const stored0 = await page.evaluate(() => window.__store['p:goei:prefs']);
  // 실패를 켜고 끄기
  await setSaveFail(page, 'storage', { key: 'goei:prefs', mode });
  await click(page, `.gw [data-action="ed-rule-on"][data-value="${rid}"]`);
  await sleep(600);
  const stateTxt = await page.evaluate(() => document.querySelector('.gw .gw-rule .gw-state')?.textContent ?? null);
  const gwn = await gwNotice(page);
  const editLog = logs.filter((l) => /편집 창 조작 실패|실패/.test(l));
  const stored1 = await page.evaluate(() => window.__store['p:goei:prefs']);
  await closeEditor(page);
  // 출동 → 지시문에 규칙이 붙는지 (지금 세션)
  await pickDepart(page);
  await click(page, '[data-action="depart"]');
  await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  const tr = await turn(page, {});
  const fails = await saveFails(page);
  const chatNow = await getChat(page);
  const prefsNow = await page.evaluate(() => window.__store['p:goei:prefs']);
  await page.close();
  // 새로 열기(리스AI 새로고침과 같은 꼴): 같은 저장소 값·채팅으로 다시 띄움
  const b2 = await fresh({ chat: chatNow, prefs: JSON.parse(prefsNow) });
  await b2.page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '다시 출동 준비.', chatId: 'ux' }); });
  await pickDepart(b2.page);
  await click(b2.page, '[data-action="depart"]');
  await b2.page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  const tr2 = await turn(b2.page, {});
  const got = { mode, ruleStateOnScreen: stateTxt, editorNotice: gwn, editLog, storageChanged: stored0 !== stored1, fails: fails.length, ruleInDirectiveNow: lastUser(tr.out).includes('T1RULE'), ruleInDirectiveAfterReload: lastUser(tr2.out).includes('T1RULE'), errors: [...errors, ...b2.errors], req: saveReq(`g1-${mode}-now`, tr.out), reqReload: saveReq(`g1-${mode}-reload`, tr2.out) };
  step(mode === 'throw' ? 'G1-1' : 'G1-2', `규칙 「사용」 끄기 저장(goei:prefs) ${mode} → 화면·지금 출동·새로 연 뒤`, mode === 'throw' ? (!!got.editorNotice && got.ruleInDirectiveNow === got.ruleInDirectiveAfterReload) : got.ruleInDirectiveNow === got.ruleInDirectiveAfterReload,
    mode === 'throw' ? '(Claude 판정, K-01 바로 저장) 저장 실패를 화면에 알리고, 지금 세션과 새로 연 뒤의 규칙 상태가 같다' : '(silent 는 이 판 리스AI 에 없는 길 — 기록) 지금 세션과 새로 연 뒤가 같은지', 'K-01 · Claude 판정', got);
  await b2.page.close();
}

// ── G2 기기 저장소 전부 던짐 + C9 카드(char) 전부 던짐: 출동 한 턴이 그대로 도는지 ──
for (const [k, target] of [['g2', 'storage'], ['h2', 'char']]) {
  if (!on(k)) continue;
  const { page, logs, errors } = await fresh();
  await played(page);
  await setSaveFail(page, target, { mode: 'throw' });
  await pickDepart(page);
  await click(page, '[data-action="depart"]');
  await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  logs.length = 0;
  const tr = await turn(page, { reply: DEP_REPLY });
  const fails = await saveFails(page);
  const w = await world(page);
  const lu = lastUser(tr.out);
  const got = { target, fails: fails.length, failKeys: [...new Set(fails.map((f) => f.key))], directive: has(lu, DIR.COMMON) && has(lu, DIR.CONTINUATION), p002: w?.agents?.P002?.st ?? null, logs: failLogs(logs), errors: [...errors], req: saveReq(`${k}-depart`, tr.out) };
  step(k === 'g2' ? 'G2-1' : 'H2-1', `${target} 저장이 모두 던지는 채 출동 한 턴`, got.directive && got.p002 === '작전투입' && got.errors.length === 0,
    '요청 지시문 그대로, 응답 처리(P002 작전투입) 그대로, 페이지 오류 없음 (그 저장소에 쓰는 부수 기록만 빠짐)', 'Claude 판정', got);
  await clearSaveFail(page);
  await page.close();
}

// ── H1 명부(카드 로어북) 순서 저장 실패 ──
for (const mode of ['throw', 'silent']) {
  if (!on('h1')) break;
  const { page, errors } = await fresh();
  await played(page);
  const board0 = await boardAgents(page);
  await openRoster(page);
  const o0 = await rosterOrder(page);
  const c0 = await charAgentOrder(page);
  const charJson0 = await page.evaluate(() => JSON.stringify(window.__char));
  const chatV0 = (await getChat(page)).scriptstate;
  await setSaveFail(page, 'char', { mode });
  await click(page, '.gw [data-action="dir-move"][data-value="up|잼트리"]');
  await sleep(2500);
  const o1 = await rosterOrder(page);
  const n1 = await gwNotice(page);
  const c1 = await charAgentOrder(page);
  const charSame = charJson0 === (await page.evaluate(() => JSON.stringify(window.__char)));
  const chatV1 = (await getChat(page)).scriptstate;
  const chatChanged = Object.keys({ ...chatV0, ...chatV1 }).filter((k) => JSON.stringify(chatV0[k]) !== JSON.stringify(chatV1[k])).map((k) => [k, String(chatV0[k] ?? '').slice(0, 80), String(chatV1[k] ?? '').slice(0, 80)]);
  const fails = await saveFails(page);
  await clearSaveFail(page);
  await closeEditor(page);
  await sleep(800);
  // 실패를 끈 뒤 설정 창을 닫을 때 남은 초안이 다시 저장되는지 (재시도 길)
  const savedOnClose = charJson0 !== (await page.evaluate(() => JSON.stringify(window.__char)));
  const board1 = await boardAgents(page);
  await openRoster(page);
  const o2 = await rosterOrder(page);
  await closeEditor(page);
  // 새로 열기(같은 카드·채팅으로 다시 띄움) 뒤 상황판 순서
  const after = { char: await page.evaluate(() => window.__clone(window.__char)), chat: await getChat(page) };
  const b2 = await fresh(after);
  const boardReload = (await boardAgents(b2.page)).slice(0, 4);
  await b2.page.close();
  const got = { mode, charSame, savedOnClose, chatChanged, boardReload, roster0: o0.slice(0, 4), rosterAfterMove: o1.slice(0, 4), notice: n1, char0: c0, char1: c1, board0: board0.slice(0, 4), board1: board1.slice(0, 4), rosterReopen: o2.slice(0, 4), fails: fails.length, errors: [...errors] };
  const moved = o1.indexOf('잼트리') < o1.indexOf('스팡달');
  step(mode === 'throw' ? 'H1-1' : 'H1-2', `명부 「위로」 저장 ${mode}`, mode === 'throw' ? (!!n1 && JSON.stringify(c0) === JSON.stringify(c1)) : (moved ? !!n1 : true),
    mode === 'throw' ? '설정 창에 「저장하지 못했어요」, 카드 로어북 그대로 (K-01 바로 저장)' : '(Claude 판정) 안 써졌는데 바뀐 순서를 보여 주면 알림이 있어야 함. 순서가 되돌아가면 알림 없이도 화면은 맞음', 'K-01 · Claude 판정', got);
  await page.close();
}

// ── F 조립 단계 실패: 출동 지시문이 실린 턴에서 단계 하나씩 ──
if (on('f')) {
  const { page, logs, errors } = await fresh();
  await played(page);
  // 인물 기록이 요청에 들어가게 쟈알디 기록 하나를 넣는다 (core/people/store.ts 꼴)
  await page.evaluate(() => {
    const c = window.__chat;
    const anchor = [...c.message].reverse().find((m) => m.role === 'char')?.chatId ?? '';
    c.goeiPeopleV1 = { people: { 쟈알디: { name: '쟈알디', faction: 'A00', seeded: { from: 'none', at: '' }, slots: { state: [{ id: 'e1', text: 'T1PEOPLE 쟈알디는 오늘 서류 정리에 지쳐 있다', anchor }] } } } };
  });
  await pickDepart(page);
  await click(page, '[data-action="depart"]');
  await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  const msgs = toMsgs(await getChat(page));
  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + '\n\n쟈알디와 함께 간다.' };
  await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '쟈알디와 함께 간다.', chatId: 'uf' }); });
  // 위 줄은 실제로 덧붙여 보낸 글 (지시문 뒤 Situation 으로 합쳐짐)
  const msgs2 = [...toMsgs(await getChat(page))];
  const base = await request(page, msgs2);
  const baseDir = lastUser(base);
  step('F0', '조립 기준(실패 없음): 출동 턴 요청', has(baseDir, DIR.COMMON) && has(baseDir, DIR.CONTINUATION) && /Subject: /.test(baseDir), '마지막 user 칸 = COMMON+CONTINUATION+CONTEXT(+Situation)', '코스 D2', { n: base.length, roles: base.map((m) => m.role).join(','), people: base.some((m) => m.content.includes('T1PEOPLE')), req: saveReq('f0-base', base) });
  const marks = {
    로어: (o) => o.some((m) => m.content.startsWith('<!-- goei:lore -->')),
    주인공: (o) => null,
    상태창: (o) => o.some((m) => m.content.startsWith('[Previous status]')),
    소지품: (o) => o.some((m) => m.content.startsWith('[Inventory]')),
    '인물 기록': (o) => o.some((m) => m.content.includes('T1PEOPLE')),
  };
  for (const s of ['로어', '주인공', '상태창', '소지품', '인물 기록']) {
    await page.evaluate((s) => { globalThis.__goeiFaultSteps = [s]; }, s);
    logs.length = 0;
    const out = await request(page, msgs2);
    await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
    const line = logs.find((l) => l.includes('요청 조립 실패')) ?? null;
    const sameDir = lastUser(out) === baseDir;
    const baseHas = marks[s](base), outHas = marks[s](out);
    // 그 단계가 넣은 메시지를 뺀 나머지가 기준과 같은지
    const strip = (o) => o.filter((m) => !(s === '로어' && m.content.startsWith('<!-- goei:lore -->')) && !(s === '상태창' && m.content.startsWith('[Previous status]')) && !(s === '소지품' && m.content.startsWith('[Inventory]')) && !(s === '인물 기록' && m.content.includes('T1PEOPLE'))).map((m) => `${m.role}:${m.content}`);
    const restSame = JSON.stringify(strip(out)) === JSON.stringify(strip(base));
    const diffIdx = strip(out).map((x, i) => (x === strip(base)[i] ? null : i)).filter((x) => x !== null);
    // 그 단계가 넣은 것 밖의 차이(restSame=false)는 아래 diffIdx 의 메시지를 열어 그 단계가 원래 하던 일인지 따로 본다 (찾은문제_T1.md)
    step(`F-${s}`, `「${s}」 단계만 실패 (출동 턴)`, !!line && line.includes(s) && sameDir && (baseHas === null || outHas === false),
      '로그 한 줄, 그 단계가 넣는 것만 빠지고 마지막 user 칸 지시문(COMMON+CONTINUATION+CONTEXT+Situation)은 기준과 글자 하나 다르지 않음. 그 밖의 차이는 기록(restSame·diffIdx)', '코스 5장 「그 단계만 건너뜀」 · src/body.ts 조립 정책 주석(QC 나3) · Claude 판정', { line, sameDir, baseHas, outHas, restSame, diffIdx: diffIdx.slice(0, 5), n: [base.length, out.length], req: saveReq(`f-${s}`, out) });
  }
  // 응답을 붙여 기다림을 푼다
  await page.evaluate(() => window.__chat.message.push({ role: 'char', data: '본문\n[▣|2025.01.01|03:00 AM|☀️|4°C|현장|없음|없음|없음|관리국/신입|140000]', chatId: 'cf' }));
  await output(page);
  step('F-오류', '조립 실패 갈래 동안 페이지 오류', errors.length === 0, '없음', 'Claude 판정', errors);
  await page.close();
}

// ── F 주인공: 캐릭터로 플레이 채팅의 출동 턴에서 「주인공」 단계 실패 ──
if (on('fp')) {
  const { page, logs, errors } = await fresh();
  // qc-host startChat 의 player 고르기 선택자가 지금 시작 화면과 안 맞아(.gx-player 없음) 채팅 변수 $st_player 로 켠다 (core/player.ts PLAYER_KEY)
  await startChat(page, 'A00', 2);
  let via = 'start-ui';
  if ((await getChat(page)).scriptstate.$st_player !== 'P004') { via = 'var'; await page.evaluate(() => { window.__chat.scriptstate.$st_player = 'P004'; }); }
  await page.evaluate(() => { window.__chat.scriptstate.$pp_when = 'manual'; window.__chat.scriptstate.$ph_auto = '0'; });
  await turn(page, { user: '쟈알디에게 말을 건다.' });
  await pickDepart(page);
  await click(page, '[data-action="depart"]');
  await page.waitForFunction(() => (window.__chat.message.at(-1)?.data ?? '').startsWith('%%SCENE_CARD:'), null, { timeout: 15000 });
  const msgs = toMsgs(await getChat(page));
  const base = await request(page, msgs);
  await page.evaluate(() => { globalThis.__goeiFaultSteps = ['주인공']; });
  logs.length = 0;
  const out = await request(page, msgs);
  await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  const line = logs.find((l) => l.includes('요청 조립 실패')) ?? null;
  const diff = out.map((m, i) => (m.content === base[i]?.content ? null : i)).filter((x) => x !== null);
  const sameDir = lastUser(out) === lastUser(base);
  step('F-주인공(캐릭터 플레이)', '「주인공」 단계만 실패 (캐릭터로 플레이 채팅의 출동 턴)', !!line && sameDir && diff.length > 0,
    '로그 한 줄, 주인공 틀(요원 로어북·이름 바꾸기)만 빠지고 마지막 user 칸 지시문은 기준과 같음', '코스 5장 · Claude 판정', { via, line, sameDir, diff, n: [base.length, out.length], base: saveReq('fp-base', base), req: saveReq('fp-fault', out), errors: [...errors] });
  await page.close();
}

// ── F 시드: 첫 전송(시드가 실린 요청)에서 「시드」 단계 실패 ──
if (on('fs')) {
  const { page, logs, errors } = await fresh();
  await startChat(page, 'A00', 2);
  await page.evaluate(() => { window.__chat.scriptstate.$pp_when = 'manual'; window.__chat.scriptstate.$ph_auto = '0'; window.__chat.message.push({ role: 'user', data: '쟈알디의 손을 잡는다.', chatId: 'u1' }); });
  const msgs = toMsgs(await getChat(page));
  const base = await request(page, msgs);
  await page.evaluate(() => { globalThis.__goeiFaultSteps = ['시드']; });
  logs.length = 0;
  const out = await request(page, msgs);
  await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  const line = logs.find((l) => l.includes('요청 조립 실패')) ?? null;
  const all = (o) => o.map((m) => m.content).join('\n');
  const same = JSON.stringify(out) === JSON.stringify(base);
  const diff = out.map((m, i) => (m.content === base[i]?.content ? null : i)).filter((x) => x !== null);
  step('F-시드', '「시드」 단계만 실패 (첫 전송)', !!line && /%%SEED%%/.test(all(out)) === false && !/%%/.test(all(out)),
    '로그 한 줄, 표식(%%SEED%%)은 마지막 정리가 지워 모델에 안 감, 시드 글은 첫 전송 수명대로 실림(기준과 같거나 표식만 다름)', '코스 5장 · src/body.ts 조립 정책 주석 · Claude 판정', { line, same, diff, seedInBase: /\{\{#if|Start Lore|SEED/.test(all(base)), markers: (all(out).match(/%%[A-Z_/]+%%/g) ?? []).slice(0, 5), req: saveReq('fs-seed-fault', out), base: saveReq('fs-seed-base', base), errors });
  // 「beforeRequest」 전체가 던질 때 (시작기 sanitize 로) — 기록만
  await page.evaluate(() => { globalThis.__goeiFaultSteps = ['beforeRequest']; });
  let thrown = null, out2 = null;
  try { out2 = await request(page, msgs); } catch (e) { thrown = String(e.message).slice(0, 160); }
  await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  step('F-전체', '「beforeRequest」 전체가 던짐 (기록)', null, '시작기 main.ts 가 표식만 지워 보냄(요청이 막히지 않음)', 'src/body.ts 주석 · Claude 판정(기록)', { thrown, n: out2?.length ?? null, markers: out2 ? (all(out2).match(/%%[A-Z_/]+%%/g) ?? []).slice(0, 5) : null });
  await page.close();
}

await browser.close();
const n = (v) => res.steps.filter((s) => s.ok === v).length;
console.log(`\nOK ${n(true)} · NG ${n(false)} · 기록 ${n(null)} → ${OUT}/result.json`);
