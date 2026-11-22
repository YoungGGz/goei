// 플레이 순서 점검 2차 · 06 시작 화면·첫 장면·커스텀 임무·이동 (지침: ../../GPT_점검지침_초안.md 3판)
// 1차(../../6_커스텀임무/run.mjs)의 틀을 그대로 쓰고 갈래를 늘렸다: 고유 인물 시작(시작 소지품·잔고), 폰 크기 커스텀 임무, 아바타,
// 답을 기다리는 동안 임무 바꾸기·다시 고르기, 채팅 중 기다리는 동안 임무 요청·이동, 지도 「출발」(이동), 페이지 새로고침, 직접 입력 전송 실패 → 취소.
// 기록 자리: 본편 = beforeRequest 훅 반환값(window.__calls.replacers[0]), 응답 처리 = output 리스너(window.__calls.listeners[0]), 자동 전송 = risuai.sendChat 호출.
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt, out/상태NN.json, out/결과.json
// 가짜 응답 본문은 자리표(【가짜 응답 n】)와 상태창·AN 줄만 (첫 장면 글을 지어 쓰지 않는다는 사용자 규칙).
// 사용법: npm run release:prep -- --skip-tests  →  node 인수인계/플레이순서_점검/2차/06_시작_첫장면_커스텀임무/run.mjs [갈래 글자들, 예: PQ]
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeWin, setInput } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const ONLY = (process.argv[2] ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
if (!ONLY) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

const M = {
  SDRA: '### Special Disaster Response Association (특수재난대응협회)',
  JUNGNIM: '### Jungnim Underground Shopping Center (중림 지하상가)',
  CHURCH: '##### Church and Intake',
  COMMON: 'The user picked a subject and companions in a menu outside the story.',
  OPENING: 'This is the first message of a new story.',
  CONT: 'The story is already in progress.',
  JYALDI: '### Character - Jyaldi',
};
const MARKERS = ['%%SCENE_CARD', '%%/SCENE_CARD%%', '%%GOEI_START%%', '%%/GOEI_START%%', '%%GOEI_UNSENT%%', '%%GOEI_SCENE%%', '%%SEED%%', '%%/SEED%%'];
const st = (time, place, aff, target = '없음') => `[▣|2025.03.14|${time}|☀️|8°C|${place}|${target}|없음|없음|${aff}|1000]`;
const FAKE = (n, status, extra = '') => `【가짜 응답 ${n}】${extra ? `\n${extra}` : ''}\n${status}`;
const SEED = 20261122;
const results = [];
const step = (n, name) => ({ n, name });
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : why === 'info' ? 'INFO' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 500)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const count = (hay, needle) => hay.split(needle).length - 1;
const allText = (out) => out.map((m) => m.content).join('\n');
const leaked = (out) => MARKERS.filter((k) => allText(out).includes(k));
const subj = (n) => new RegExp(`Subject: [^\\n]*${n}`);

const b = await launch();

async function session(chat0, vp = 'pc', extra = {}) {
  const { page, errors } = await boot(b, fx, chat0, vp, { store: { ...STORE, ...extra } });
  await page.evaluate((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
  const chat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const vars = async () => (await chat()).scriptstate ?? {};
  const world = async () => { try { return JSON.parse((await vars()).$goei_world || 'null'); } catch { return null; } };
  const sends = () => page.evaluate(() => (window.__calls.send || []).length);
  const act = async (action, value, wait = 400) => {
    const real = await page.evaluate(({ action, value }) => {
      const r = [...document.querySelectorAll(`.gx [data-action="${action}"]`)].find((e) => value === undefined || e.dataset.value === value);
      if (r) { r.click(); return true; }
      return false;
    }, { action, value });
    await sleep(wait);
    return real;
  };
  /** 화면에 그 단추가 없을 때만 쓰는 대신 누르기 (위임 처리기 같은 길) */
  const actHidden = async (action, value) => {
    await page.evaluate(({ action, value }) => {
      const el = document.createElement('button');
      el.dataset.action = action;
      if (value !== undefined) el.dataset.value = value;
      el.style.display = 'none';
      (document.querySelector('.gx .gx-body') || document.querySelector('.gx')).appendChild(el);
      el.click(); el.remove();
    }, { action, value });
    await sleep(400);
  };
  const isOpen = () => page.evaluate(() => { const g = document.querySelector('.gx'); return !!g && g.style.display !== 'none'; });
  const winText = () => page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
  const headText = () => page.evaluate(() => document.querySelector('.gx .gx-head')?.innerText ?? '');
  const sendExisting = () => page.evaluate(async () => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
    return out.map((m) => ({ role: m.role, content: String(m.content) }));
  });
  const mainSend = async (text, id) => { await page.evaluate(([t, id]) => { window.__chat.message.push({ role: 'user', data: t, chatId: id }); }, [text, id]); return sendExisting(); };
  const botReply = async (text, id) => {
    await page.evaluate(async ([t, id]) => {
      window.__chat.message.push({ role: 'char', data: t, chatId: id });
      await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
    }, [text, id]);
    await sleep(500);
  };
  const saveState = async (s) => {
    const c = await chat();
    const keep = Object.fromEntries(Object.entries(c.scriptstate ?? {}).filter(([k]) => /^\$(st_faction|st_fm|st_pick|st_player|st_lang|st_look|st_wallet|st_items|it_carry_pc|ib_affiliation|seed_lore|goei_world|st_anomaly_on|bm_points_on|pt_on)$/.test(k)).map(([k, v]) => [k, k === '$goei_world' ? (() => { try { const w = JSON.parse(v); return { pending: w.pending, an: w.an?.map((a) => `${a.name || a.presetName}|${a.state}|${a.origin}`) }; } catch { return v; } })() : k === '$seed_lore' ? String(v).slice(0, 200) : v]));
    writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: keep, messages: c.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })), sendChat: await sends(), 창열림: await isOpen() }, null, 2));
  };
  /** 시작 화면: 소속 → (주인공) → 상황 → (상황 글) → (잔고) → 출발 */
  const pick = async ({ fac, player, fm, situation, wallet, look }) => {
    await openWin(page); await sleep(400);
    await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`).click(), fac); await sleep(300);
    if (player !== undefined) { await page.evaluate((p) => document.querySelector(`.gx-whoc[data-action="player"][data-value="${p}"]`)?.click(), player); await sleep(300); }
    if (look) {
      await page.evaluate(() => document.querySelector('.gx [data-action="look-open"]')?.click()); await sleep(400);
      await page.evaluate(() => document.querySelector('.gx [data-action="look-g"][data-value="남"]')?.click()); await sleep(400);
      await page.evaluate(() => [...document.querySelectorAll('.gx [data-action="look"]')][1]?.click()); await sleep(1200);
    }
    await page.evaluate((v) => document.querySelector(`.gx-sc[data-value="${v}"]`).click(), String(fm)); await sleep(300);
    if (situation !== undefined) await setInput(page, '[data-input="start-note"]', situation, 'input');
    if (wallet !== undefined) { await setInput(page, '.gx-wallet-start input', wallet, 'change'); await sleep(300); }
    await sleep(200);
    const disabled = await page.evaluate(() => document.querySelector('.gx-start')?.disabled);
    await page.evaluate(() => document.querySelector('.gx-start')?.click());
    await sleep(1800);
    return { disabled };
  };
  const display = async (t) => (await page.evaluate((t) => window.__calls.handlers.display(t), t)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { page, errors, chat, vars, world, sends, act, actHidden, isOpen, winText, headText, sendExisting, mainSend, botReply, saveState, pick, display };
}

/** 임무 창에서 괴이 하나 고르고 요청 (PC/폰 둘 다 실제 단추) */
async function requestMission(S, name, note) {
  await openWin(S.page); await sleep(500);
  if (!(await S.page.evaluate(() => !!document.querySelector('.gx-mission')))) { await S.act('tab', 'map', 500); await S.act('tab', 'mission', 500); }
  await S.act('mission-kind', 'an');
  await S.act('mission-open', `an:${name}`);
  const picked = await S.act('mission-pick', `an:${name}`, 1500);
  if (!picked) await S.actHidden('mission-pick', `an:${name}`);
  if (note) await S.page.evaluate((n) => { const i = document.querySelector('[data-input="field-note"]'); if (i) { i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); } }, note);
  await sleep(200);
  const sent = await S.act('mission-send', undefined, 1500);
  return { picked, sent };
}

// ════════ P: 관리국 · 고유 인물(쟈알디) · 직접 입력 · 시작 잔고 바꿈 (PC, 화면 단추) ════════
if (want('P')) {
  const P = await session({ message: [], scriptstate: {} });
  let s = step('P01', '시작화면_관리국_쟈알디_직접입력_잔고');
  const SIT = '아침, 사무실에서 시작한다.';
  const { disabled } = await P.pick({ fac: 'A00', player: 'P001', fm: 8, situation: SIT, wallet: '500,000' });
  let c = await P.chat();
  let v = c.scriptstate ?? {};
  const items = (() => { try { return JSON.parse(v.$st_items || '{}'); } catch { return {}; } })();
  check(s, '출발 단추 켜짐', disabled === false, false, disabled);
  check(s, '주인공 = 쟈알디(P001), 소속 관리국', v.$st_player === 'P001' && v.$st_faction === 'A00' && v.$ib_affiliation === '관리국', 'P001 · A00 · 관리국', [v.$st_player, v.$st_faction, v.$ib_affiliation]);
  check(s, '시작 소지품: 명부 start_items 셋(권총·검은 장갑·담배) (사용자 11-07)', ['권총', '검은 장갑', '담배'].every((n) => (items.list ?? []).some((x) => x.name === n)), '셋 다', (items.list ?? []).map((x) => `${x.name}${x.slot ? `@${x.slot}` : ''}${x.worn ? '(착용)' : ''}`));
  check(s, '소지 한도: 명부 carry 30 (사용자 11-08)', v.$it_carry_pc === '30', '30', v.$it_carry_pc);
  check(s, '아바타 칸: 고유 인물은 비움 (그 인물 모습)', (v.$st_look ?? '') === '', '', v.$st_look);
  check(s, '시작 잔고 500,000 (사용자 11-08: 고치면 이 채팅만)', String(v.$st_wallet ?? '').includes('500000'), 'start 500000', String(v.$st_wallet).slice(0, 80));
  check(s, '바로 전송 1회', (await P.sends()) === 1, 1, await P.sends());
  await P.saveState(s);

  s = step('P02', '첫요청');
  let out = await P.sendExisting();
  writeReq(s, out);
  let all = allText(out);
  const lastUser = out.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const inv = out.find((m) => m.role === 'system' && /Inventory/.test(m.content))?.content ?? '';
  check(s, '마지막 유저 글 = 적은 상황', lastUser.trim() === SIT, SIT, lastUser);
  check(s, '소지품 블록에 시작 소지품 셋이 「가진 것」으로', ['권총', '검은 장갑', '담배'].every((n) => inv.includes(n)), '셋 다', inv.slice(0, 600));
  check(s, '[참고] 시작 소지품이 이번 턴 사건(새로 얻음·산 것)으로 적히나', !/Recently|just bought|got:/i.test(inv), '사건 줄 없음', inv.slice(0, 600), 'info');
  check(s, '주인공 글에 쟈알디 (고유 인물 플레이)', all.includes('Jyaldi') || all.includes('쟈알디'), '있음', all.includes('Jyaldi'));
  check(s, '[참고] 잔고 500,000 이 요청에 보이나', /500,000|500000/.test(all), '기록', /[^\n]*500,?000[^\n]*/.exec(all)?.[0] ?? '(없음)', 'info');
  check(s, '아바타·성별이 요청에 안 감 (메모리: 성별 본편 X)', !/st_look|Persona (Fe)?male/i.test(all), '없음', /[^\n]*(st_look|Persona)[^\n]*/i.exec(all)?.[0] ?? '');
  check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
  await P.saveState(s);

  s = step('P03', '첫응답_둘째턴');
  await P.botReply(FAKE(1, st('09:10 AM', '관리국 본부', '관리국/팀장')), 'c1');
  out = await P.mainSend('담배를 문다.', 'u2');
  writeReq(s, out);
  all = allText(out);
  const inv2 = out.find((m) => m.role === 'system' && /Inventory/.test(m.content))?.content ?? '';
  check(s, '둘째 턴에도 시작 소지품 목록 유지', ['권총', '검은 장갑', '담배'].every((n) => inv2.includes(n)), '셋 다', inv2.slice(0, 400));
  check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
  await P.saveState(s);
  if (P.errors.length) console.log('P 페이지 오류', P.errors.slice(0, 3));
  await P.page.close();
}

// ════════ Q: 폰 크기 · 프리랜서 · 내 페르소나 · 아바타 고르기 · 커스텀 임무 → 작전 개시 ════════
if (want('Q')) {
  const Q = await session({ message: [], scriptstate: {} }, 'phone');
  let s = step('Q01', '폰_시작화면_프리랜서_아바타_커스텀임무');
  const { disabled } = await Q.pick({ fac: 'E00', player: '', fm: 4, look: true });
  let c = await Q.chat();
  let v = c.scriptstate ?? {};
  check(s, '출발 단추 켜짐', disabled === false, false, disabled);
  check(s, '아바타 고른 값이 채팅에 ($st_look)', !!v.$st_look, '값 있음', v.$st_look);
  check(s, '채팅 비고 창은 목표 고르기', c.message.length === 0 && (await Q.winText()).includes('커스텀 임무로 시작해요'), '빈 채팅·목표 고르기', { n: c.message.length, t: (await Q.winText()).slice(0, 80) });
  await Q.saveState(s);

  s = step('Q02', '폰_목표교회_편성_작전개시');
  await Q.act('mission-kind', 'an');
  await Q.act('mission-open', 'an:교회');
  const picked = await Q.act('mission-pick', 'an:교회', 1500);
  const stepTeam = await Q.page.evaluate(() => document.querySelector('.gx-field')?.dataset.step);
  const goBtn = await Q.page.evaluate(() => { const b = document.querySelector('.gx-mgo [data-action="mission-send"], .gx [data-action="mission-send"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { txt: b.textContent.trim(), dis: b.disabled, vis: r.width > 0 && r.height > 0, inView: r.bottom <= window.innerHeight + 1 && r.top >= 0 }; });
  check(s, '폰: 목표를 누르면 편성 단계로, 「작전 개시」 단추가 화면 안에 보임', picked && stepTeam === 'team' && goBtn?.vis && goBtn?.inView && !goBtn?.dis, 'team · 보임 · 켜짐', { picked, stepTeam, goBtn });
  const sent = await Q.act('mission-send', undefined, 1500);
  c = await Q.chat();
  const w = await Q.world();
  check(s, '카드 하나 · OPENING · 대기 교회 · 전송 1회', sent && c.message.length === 1 && c.message[0].data.includes(M.OPENING) && w?.pending?.an === '교회' && (await Q.sends()) === 1, '카드 1 · OPENING · 교회 · 1회', { sent, n: c.message.length, pend: w?.pending, sends: await Q.sends() });
  await Q.saveState(s);

  s = step('Q03', '폰_첫요청');
  const out = await Q.sendExisting();
  writeReq(s, out);
  const all = allText(out);
  check(s, 'OPENING·Subject 교회·교회 로어북·NEW 교회·시드', all.includes(M.OPENING) && subj('교회').test(all) && all.includes(M.CHURCH) && /NEW \[AN\|[^\]\n]*\|교회\|활성/.test(all) && all.includes(M.SDRA), '다 있음', [all.includes(M.OPENING), subj('교회').test(all), all.includes(M.CHURCH), /NEW \[AN[^\n]*교회/.test(all), all.includes(M.SDRA)]);
  check(s, '아바타·성별이 요청에 안 감', !/st_look|Persona (Fe)?male/i.test(all), '없음', /[^\n]*(st_look|Persona)[^\n]*/i.exec(all)?.[0] ?? '');
  check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
  await Q.saveState(s);
  if (Q.errors.length) console.log('Q 페이지 오류', Q.errors.slice(0, 3));
  await Q.page.close();
}

// ════════ R: 커스텀 임무 첫 카드를 보낸 뒤, 답을 기다리는 동안 창을 다시 엶 ════════
// 근거: host/unsent.ts 머리 「이미 보내져 응답을 만드는 중이면 지우지 않는다 (요청 도중 채팅을 저장하면 응답이 사라질 수 있다)」,
//       body.ts 시드 단계 「요청 도중에는 채팅을 저장하지 않는다. 응답이 붙기 전에 채팅 객체를 바꾸면 응답이 사라질 수 있다」, field.ts cancelRequest 의 !isWaiting()
if (want('R')) {
  const R = await session({ message: [], scriptstate: {} });
  let s = step('R01', '커스텀임무_첫카드_보냄_답기다림');
  await R.pick({ fac: 'E00', player: '', fm: 4 });
  await R.act('mission-kind', 'an'); await R.act('mission-open', 'an:교회'); await R.act('mission-pick', 'an:교회', 1500);
  await R.act('mission-send', undefined, 1500);
  const out0 = await R.sendExisting(); // 본편 요청이 나감 → 기다리는 중 (응답은 아직)
  writeReq(s, out0);
  const card0 = (await R.chat()).message[0]?.data ?? '';
  check(s, '카드 보냄 · 요청 나감 (답 없음)', subj('교회').test(card0) && (await R.sends()) === 1, '교회 카드', /Subject:[^\n]*/.exec(card0)?.[0]);
  await R.saveState(s);

  s = step('R02', '기다리는중_창다시열기');
  await openWin(R.page); await sleep(500);
  const head = await R.headText();
  writeFileSync(`${OUT}단계${s.n}_${s.name}_화면.txt`, `■ 창 머리\n${head}\n\n■ 창 글\n${await R.winText()}\n`);
  check(s, '[참고] 답을 기다리는 동안 창을 열면 무엇이 보이나', true, '기록', head.replace(/\s+/g, ' '), 'info');
  const canPick = await R.page.evaluate(() => !!document.querySelector('.gx [data-action="mission-open"][data-value="an:명일 아파트"], .gx [data-action="mission-open"]'));
  check(s, '[참고] 보낸 카드가 답을 기다리는 중인데 목표 고르기 화면이 다시 뜸', !canPick, '고르기 화면 아님', { 고르기화면: canPick }, 'info');
  await R.saveState(s);

  s = step('R03', '기다리는중_다른목표로_작전개시');
  const setChat0 = await R.page.evaluate(() => window.__calls.setChat.length);
  await R.act('mission-kind', 'an'); await R.act('mission-open', 'an:명일 아파트');
  const p2 = await R.act('mission-pick', 'an:명일 아파트', 1500);
  if (!p2) await R.actHidden('mission-pick', 'an:명일 아파트');
  await R.act('mission-send', undefined, 1500);
  let c = await R.chat();
  const w = await R.world();
  const setChat1 = await R.page.evaluate(() => window.__calls.setChat.length);
  check(s, '기다리는 동안엔 보낸 카드를 바꿔 끼우지 않음 (요청 도중 채팅 저장 금지 규칙)', subj('교회').test(c.message[0]?.data ?? '') && c.message.length === 1, '교회 카드 그대로', { 카드: c.message.map((m) => /Subject:[^\n]*/.exec(m.data)?.[0]), 저장횟수: setChat1 - setChat0, 대기: w?.pending, 전송: await R.sends() });
  await R.saveState(s);

  s = step('R04', '늦게온_첫답_붙음');
  // 교회 요청의 답(교회 AN 태그)이 이제 도착
  await R.botReply(FAKE(1, st('10:00 AM', '서울특별시 종로구', '프리랜서', '교회'), '[AN|서울특별시 종로구|교회|활성|C|없음|가짜 상황 글 1]'), 'c1');
  c = await R.chat();
  const w2 = await R.world();
  const anNames = (w2?.an ?? []).map((a) => `${a.name || a.presetName}|${a.state}|${a.origin ?? ''}`);
  check(s, '늦게 온 교회 답이 붙은 뒤 채팅 카드와 답이 같은 대상을 말함', subj('교회').test(c.message[0]?.data ?? ''), '카드 = 교회', { 카드: /Subject:[^\n]*/.exec(c.message[0]?.data ?? '')?.[0], 대기: w2?.pending, an: anNames.filter((x) => /교회|명일/.test(x)) });
  check(s, '상황판 대기가 엉뚱한 대상(명일 아파트)으로 남지 않음', !w2?.pending?.an, '대기 없음', w2?.pending);
  await R.saveState(s);
  if (R.errors.length) console.log('R 페이지 오류', R.errors.slice(0, 3));
  await R.page.close();
}

// R2: 같은 상황에서 「뒤로(다시 고르기)」 → 직접 입력으로 다시 출발
if (want('R')) {
  const R = await session({ message: [], scriptstate: {} });
  const s = step('R05', '기다리는중_뒤로_다시고르기_직접입력출발');
  await R.pick({ fac: 'E00', player: '', fm: 4 });
  await R.act('mission-kind', 'an'); await R.act('mission-open', 'an:교회'); await R.act('mission-pick', 'an:교회', 1500);
  await R.act('mission-send', undefined, 1500);
  await R.sendExisting(); // 기다리는 중
  await openWin(R.page); await sleep(400);
  const back = await R.act('repick', undefined, 600);
  const pickerShown = await R.page.evaluate(() => !!document.querySelector('.gx-facs'));
  let fin = null;
  if (pickerShown) {
    await R.page.evaluate(() => document.querySelector('.gx-fac[data-value="E00"]')?.click()); await sleep(300);
    await R.page.evaluate(() => document.querySelector('.gx-sc[data-value="3"]')?.click()); await sleep(300);
    await setInput(R.page, '[data-input="start-note"]', '다른 시작.', 'input');
    await R.page.evaluate(() => document.querySelector('.gx-start')?.click()); await sleep(1800);
    fin = await R.chat();
  }
  const c = fin ?? (await R.chat());
  check(s, '기다리는 동안 보낸 교회 카드가 다시 고르기로 지워지지 않음', c.message.some((m) => subj('교회').test(m.data)), '교회 카드 남음', { 뒤로단추: back, 고르기화면: pickerShown, 메시지: c.message.map((m) => `${m.role}:${(/Subject:[^\n]*/.exec(m.data)?.[0] ?? m.data).slice(0, 40)}`) });
  await R.saveState(s);
  await R.page.close();
}

// ════════ S: 채팅 중, 본편 답을 기다리는 동안 임무 요청·이동 ════════
async function startedChat(vp = 'pc', extra = {}) {
  const S = await session({ message: [], scriptstate: {} }, vp, extra);
  await S.pick({ fac: 'A00', player: '', fm: 2 });
  const first = allText(await S.mainSend('인사한다.', 'u1'));
  // 첫 요청의 NEW 줄 중 이름이 정해진 괴이·특수 장소를 활성 태그로 채워 돌려준다 (지도에 고를 상황이 생기게)
  const tags = [...first.matchAll(/NEW \[(AN|MS)\|([^|\]]+)\|([^<|\]][^|\]]*)\|[^\]]*\]/g)].map((m) => m[1] === 'AN' ? `[AN|${m[2]}|${m[3]}|활성|C|없음|가짜 상황 ${m[3]}]` : `[MS|${m[2]}|${m[3]}|출현|없음|가짜 상황 ${m[3]}]`);
  await S.botReply(FAKE(1, st('09:00 AM', '관리국 본부', '관리국/신입'), tags.join('\n')), 'c1');
  await S.mainSend('자리에 앉는다.', 'u2');
  await S.botReply(FAKE(2, st('09:20 AM', '관리국 본부', '관리국/신입')), 'c2');
  return S;
}
if (want('S')) {
  const S = await startedChat();
  let s = step('S01', '채팅중_보낸뒤_답기다리는동안_임무요청');
  await S.mainSend('복도로 나간다.', 'u3'); // 요청이 나감, 답 아직
  const n0 = (await S.chat()).message.length;
  const free = await (async () => { const w = await S.world(); const taken = new Set((w?.an ?? []).flatMap((a) => [a.name, a.presetName])); return ['소라 랜드', '명일 아파트', '금지된 비디오'].find((n) => !taken.has(n)); })();
  const rq = await requestMission(S, free, '');
  writeFileSync(`${OUT}단계${s.n}_${s.name}_화면.txt`, `■ 누름 ${JSON.stringify(rq)}\n■ 창 글\n${await S.winText()}\n`);
  let c = await S.chat();
  check(s, `기다리는 동안 임무 요청(${free})이 채팅을 바꾸지 않음 (요청 도중 채팅 저장 금지 규칙)`, c.message.length === n0, `${n0}개 그대로`, { 전: n0, 후: c.message.length, 끝: c.message.slice(-2).map((m) => `${m.role}:${(/Subject:[^\n]*/.exec(m.data)?.[0] ?? m.data).slice(0, 40)}`), 전송: await S.sends() });
  await S.saveState(s);

  s = step('S02', '늦게온_답_붙고_다음턴');
  // 「복도로 나간다」의 답이 이제 채팅 끝(카드 뒤)에 붙음
  await S.botReply(FAKE(3, st('09:40 AM', '관리국 본부', '관리국/신입')), 'c3');
  const out = await S.mainSend('다음 행동.', 'u4');
  writeReq(s, out);
  const all = allText(out);
  const w = await S.world();
  check(s, '고른 임무 지시(COMMON·CONTINUATION)가 한 번은 모델에 감', all.includes(M.COMMON) || (await S.page.evaluate(() => (window.__calls.send || []).length)) === 0, '지시가 한 번은 감', { 지시문: all.includes(M.COMMON), 대기: w?.pending, 카드: subj(free).test(all) });
  await S.saveState(s);
  if (S.errors.length) console.log('S 페이지 오류', S.errors.slice(0, 3));
  await S.page.close();
}

// ════════ T: 이동 (임무 탭 지도 → 상황·시설·지역 → 출발) ════════
if (want('T')) {
  const T = await startedChat();
  let s = step('T01', '지도_상황고르기_출발');
  await openWin(T.page); await sleep(500);
  await T.act('tab', 'map', 600);
  const w0 = await T.world();
  const evKey = await T.page.evaluate(() => [...document.querySelectorAll('.gx .gx-sits [data-action="ev-pop"], .gx .gx-sits [data-action="pick-event"]')].map((e) => e.dataset.value)[0] ?? null);
  check(s, '지도 탭에 고를 수 있는 상황이 있음', !!evKey, '있음', { evKey, an: (w0?.an ?? []).map((a) => `${a.name}|${a.state}`) });
  if (evKey) {
    await T.act('ev-pop', evKey, 600);
    if (!(await T.act('pick-event', evKey, 1500))) await T.actHidden('pick-event', evKey);
    await sleep(1200);
    const stepNow = await T.page.evaluate(() => document.querySelector('.gx-field')?.dataset.step);
    const goal = await T.page.evaluate(() => document.querySelector('.gx-goal b')?.innerText ?? '');
    await T.act('depart', undefined, 1500);
    const c = await T.chat();
    const card = c.message.at(-1)?.data ?? '';
    check(s, '출발: 카드 하나(CONTINUATION, OPENING 없음) · 전송', card.includes('%%SCENE_CARD:') && card.includes(M.CONT) && !card.includes(M.OPENING), 'CONTINUATION 카드', { stepNow, goal, sub: /Subject:[^\n]*/.exec(card)?.[0], sends: await T.sends() });
    await T.saveState(s);

    s = step('T02', '이동_요청');
    let out = await T.sendExisting();
    writeReq(s, out, undefined, `■ 고른 상황: ${evKey} (${goal})\n`);
    let all = allText(out);
    const lastU = out.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    const anName = goal.split(/\s/)[0];
    const an = (w0?.an ?? []).find((a) => a.name === goal || goal.includes(a.name));
    check(s, '마지막 유저 글에 COMMON·CONTINUATION·Subject', lastU.includes(M.COMMON) && lastU.includes(M.CONT) && /Subject: /.test(lastU), '셋 다', lastU.slice(0, 200));
    check(s, `[참고] 고른 상황(${goal})의 괴이 로어북이 감`, true, '기록', { goal, presetName: an?.presetName, kind: an ? 'an' : '?' }, 'info');
    check(s, '[참고] CONTINUATION 「same place… Do not move the protagonist elsewhere」 가 「출발」(이동) 요청에도 그대로 감', !lastU.includes('Do not move the protagonist elsewhere'), '물을 것', lastU.includes('Do not move the protagonist elsewhere'), 'info');
    check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
    await T.saveState(s);

    s = step('T03', '이동_응답_다음턴');
    await T.botReply(FAKE(3, st('10:00 AM', '현장', '관리국/신입', anName)), 'c3');
    out = await T.mainSend('살핀다.', 'u4');
    writeReq(s, out);
    all = allText(out);
    check(s, '다음 턴엔 지시 문장 안 감(맥락만)', !all.includes(M.CONT) && !all.includes(M.COMMON), '없음', { cont: all.includes(M.CONT), common: all.includes(M.COMMON) });
    await T.botReply(FAKE(4, st('10:20 AM', '현장', '관리국/신입', anName)), 'c4');
    await T.saveState(s);
  }

  s = step('T04', '지도_지역만_출발');
  await openWin(T.page); await sleep(500);
  await T.act('tab', 'map', 600);
  // 상황이 없는 시·도 칸을 누른다 (지역 이동)
  const reg = await T.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="map-region"]')].map((e) => e.dataset.value).find((v) => v && v !== '01') ?? null);
  if (reg) await T.act('map-region', reg, 600);
  const regionKey = await T.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="map-place"]')].map((e) => e.dataset.value).find((v) => v && !v.startsWith('fac:')) ?? null);
  if (regionKey) {
    await T.act('map-place', regionKey, 600);
    // PC: 지도 칸을 누르면 그 자리가 목표 (같은 칸 카드를 또 누르면 풀림)
    await T.act('depart', undefined, 1500);
    const card = (await T.chat()).message.at(-1)?.data ?? '';
    const out = await T.sendExisting();
    writeReq(s, out, undefined, `■ 고른 자리: ${regionKey}\n`);
    const lastU = out.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    check(s, '지역 이동 카드도 지시문(COMMON + CONTINUATION + Subject 지역)', subj('').test(lastU) && lastU.includes(M.CONT), 'CONTINUATION', /Subject:[^\n]*/.exec(lastU)?.[0]);
    check(s, '[참고] 아무 일도 없는 지역 이동에 「Write an encounter… something that looks wrong」(COMMON) 이 같이 감', !lastU.includes('Write an encounter'), '물을 것', lastU.includes('Write an encounter'), 'info');
    await T.saveState(s);
    void card;
  } else check(s, '지도에 지역 칸이 있음', false, '있음', null);
  if (T.errors.length) console.log('T 페이지 오류', T.errors.slice(0, 3));
  await T.page.close();
}

// ════════ U: 페이지 새로고침·채팅 다시 열기 ════════
if (want('U')) {
  // U1: 커스텀 임무 출발 직후(카드 전) 새로고침
  let U = await session({ message: [], scriptstate: {} });
  let s = step('U01', '커스텀임무_출발직후_새로고침');
  await U.pick({ fac: 'E00', player: '', fm: 4 });
  let saved = await U.chat();
  await U.page.close();
  U = await session(saved);
  await openWin(U.page); await sleep(500);
  check(s, '새로고침 뒤 열어도 목표 고르기', (await U.winText()).includes('커스텀 임무로 시작해요'), '목표 고르기', (await U.winText()).slice(0, 80));
  await U.saveState(s);

  s = step('U02', '새로고침뒤_작전개시_첫요청');
  await U.act('mission-kind', 'an'); await U.act('mission-open', 'an:교회'); await U.act('mission-pick', 'an:교회', 1500);
  await U.act('mission-send', undefined, 1500);
  const out = await U.sendExisting();
  writeReq(s, out);
  const all = allText(out);
  check(s, '새로고침 뒤에도 OPENING·시드·NEW 교회', all.includes(M.OPENING) && all.includes(M.SDRA) && /NEW \[AN\|[^\]\n]*\|교회\|활성/.test(all), '셋 다', [all.includes(M.OPENING), all.includes(M.SDRA), /NEW \[AN[^\n]*교회/.test(all)]);
  await U.saveState(s);
  await U.page.close();

  // U3: 관리국 첫 장면 staged 상태에서 새로고침 → 재선택 안내
  U = await session({ message: [], scriptstate: {} });
  s = step('U03', '관리국첫장면_새로고침_안내');
  await U.pick({ fac: 'A00', player: '', fm: 2 });
  saved = await U.chat();
  await U.page.close();
  U = await session(saved);
  await sleep(800);
  const html = await U.page.evaluate(async (t) => window.__calls.handlers.display(t), saved.message[0].data);
  check(s, '새로고침 뒤에도 첫 장면 아래 「적고 전송」·다시 고르기 안내', /data-goei-repick/.test(html), '안내 있음', html.slice(-300));
  await openWin(U.page); await sleep(500);
  check(s, '창은 「다시 고르기」(첫 전송 전)', (await U.headText()).includes('다시 고르기'), '다시 고르기', (await U.headText()).replace(/\s+/g, ' '));
  await U.saveState(s);
  await U.page.close();
}

// ════════ V: 직접 입력 · 자동 전송 막힘 → 채팅 속 「취소」 → 다시 고르기 ════════
if (want('V')) {
  const V = await session({ message: [], scriptstate: {} });
  await V.page.evaluate(() => { window.__sendFail = true; });
  let s = step('V01', '직접입력_전송막힘');
  const SIT = '편의점 야간 근무 중.';
  await V.pick({ fac: 'E00', player: '', fm: 3, situation: SIT });
  let c = await V.chat();
  const shown = await V.display(c.message[0]?.data ?? '');
  check(s, '카드가 「전송 대기」로 남고 창은 닫힘', c.message.length === 1 && c.message[0].data.includes('%%GOEI_UNSENT%%') && !(await V.isOpen()), '전송 대기', { n: c.message.length, open: await V.isOpen(), shown: shown.slice(0, 120) });
  await V.saveState(s);

  s = step('V02', '창다시열기');
  await openWin(V.page); await sleep(500);
  const head = await V.headText();
  const note = await V.page.evaluate(() => document.querySelector('[data-input="start-note"]')?.value ?? null);
  check(s, '[참고] 안 보낸 직접 입력이 있을 때 창', true, '기록', { head: head.replace(/\s+/g, ' '), note }, 'info');
  await closeWin(V.page);
  await V.saveState(s);

  s = step('V03', '채팅속_취소_다시고르기');
  // 채팅 속 카드의 「취소」 = withdrawUnsentAt (host/unsent.ts)
  await V.page.evaluate(async () => { /* 화면 클릭 대신 같은 처리: 마지막 안 보낸 메시지를 물림 */ });
  const before = (await V.chat()).message.length;
  // 실제 클릭 경로는 Risu 채팅 DOM 이 있어야 해서, 같은 함수가 부르는 결과(채팅 비움 → 시작 화면)를 창으로 확인한다
  await V.page.evaluate(() => { window.__chat.message = []; });
  await openWin(V.page); await sleep(500);
  const note2 = await V.page.evaluate(() => document.querySelector('[data-input="start-note"]')?.value ?? null);
  check(s, '[참고] 취소 뒤 시작 화면에 적던 상황이 남나', true, '기록', { before, head: (await V.headText()).replace(/\s+/g, ' '), note2 }, 'info');
  await V.saveState(s);
  await V.page.close();
}

// ════════ W: 1차 고친 것 다시 확인 (다시 굴리기 NEW 줄 · 요청 취소) ════════
if (want('W')) {
  const W = await session({ message: [], scriptstate: {} });
  let s = step('W01', '커스텀임무_첫전송_다시굴리기');
  await W.pick({ fac: 'E00', player: '', fm: 4 });
  await W.act('mission-kind', 'an'); await W.act('mission-open', 'an:교회'); await W.act('mission-pick', 'an:교회', 1500);
  await W.act('mission-send', undefined, 1500);
  await W.sendExisting();
  await W.botReply(FAKE(1, st('10:00 AM', '서울특별시 종로구', '프리랜서', '교회'), '[AN|서울특별시 종로구|교회|활성|C|없음|가짜 상황 글 1]'), 'c1');
  const snap = await W.chat();
  await W.page.evaluate((c) => { c.message = c.message.slice(0, 1); window.__chat = c; }, snap);
  let out = await W.sendExisting();
  writeReq(s, out);
  let all = allText(out);
  check(s, '다시 굴린 요청: 버린 글 없음 · NEW 교회 · OPENING · 시드', !all.includes('가짜 상황 글 1') && /NEW \[AN\|[^\]\n]*\|교회\|활성/.test(all) && all.includes(M.OPENING) && all.includes(M.SDRA), '다 맞음', [!all.includes('가짜 상황 글 1'), /NEW \[AN[^\n]*교회/.test(all), all.includes(M.OPENING), all.includes(M.SDRA)]);
  await W.saveState(s);

  s = step('W02', '다시굴린답_붙음_둘째턴');
  await W.botReply(FAKE(2, st('10:00 AM', '서울특별시 중구', '프리랜서', '교회'), '[AN|서울특별시 중구|교회|활성|C|없음|가짜 상황 글 2]'), 'c1b');
  out = await W.mainSend('주위를 본다.', 'u2');
  writeReq(s, out);
  all = allText(out);
  const w = await W.world();
  check(s, '둘째 턴: 새 답의 상황(중구·글 2)만, 버린 글 1 없음 · 시드 빠짐', all.includes('가짜 상황 글 2') && !all.includes('가짜 상황 글 1') && !all.includes(M.SDRA), '글 2 · 시드 없음', [all.includes('가짜 상황 글 2'), all.includes('가짜 상황 글 1'), all.includes(M.SDRA), (w?.an ?? []).filter((a) => a.name === '교회').map((a) => a.loc)]);
  await W.saveState(s);
  await W.page.close();
}

// ════════ X: 상황판 끔 · 연타 · 관리국 첫 장면 다시 굴리기 ════════
if (want('X')) {
  // X1: 이 채팅 상황판 끔 상태에서 커스텀 임무로 시작
  const X = await session({ message: [], scriptstate: {} });
  let s = step('X01', '상황판끔_커스텀임무_첫요청');
  await X.pick({ fac: 'E00', player: '', fm: 4 });
  await X.page.evaluate(() => { window.__chat.scriptstate.$st_anomaly_on = '0'; });
  await closeWin(X.page); await openWin(X.page); await sleep(500);
  await X.act('mission-kind', 'an'); await X.act('mission-open', 'an:교회'); await X.act('mission-pick', 'an:교회', 1500);
  await X.act('mission-send', undefined, 1500);
  let c = await X.chat();
  let out = await X.sendExisting();
  writeReq(s, out);
  let all = allText(out);
  check(s, '상황판 끔: 카드·OPENING·교회 로어북은 가고 NEW 줄·상황판 대기는 없음', c.message.length === 1 && all.includes(M.OPENING) && all.includes(M.CHURCH) && !/NEW \[AN/.test(all) && !(await X.world())?.pending?.an, '카드 · OPENING · 교회 · NEW 없음', [c.message.length, all.includes(M.OPENING), all.includes(M.CHURCH), /NEW \[AN[^\n]*/.exec(all)?.[0] ?? '(없음)', (await X.world())?.pending]);
  await X.saveState(s);
  await X.page.close();

  // X2: 작전 개시 연타 (같은 틱에 두 번)
  const Y = await session({ message: [], scriptstate: {} });
  s = step('X02', '작전개시_연타');
  await Y.pick({ fac: 'E00', player: '', fm: 4 });
  await Y.act('mission-kind', 'an'); await Y.act('mission-open', 'an:교회'); await Y.act('mission-pick', 'an:교회', 1500);
  await Y.page.evaluate(() => { const b = document.querySelector('.gx [data-action="mission-send"]'); b.click(); b.click(); });
  await sleep(2000);
  c = await Y.chat();
  check(s, '연타해도 카드 하나 · 전송 한 번', c.message.length === 1 && (await Y.sends()) === 1, '카드 1 · 전송 1', { n: c.message.length, sends: await Y.sends() });
  await Y.saveState(s);
  await Y.page.close();

  // X3: 관리국 첫 장면 → 첫 전송 → 답 → 다시 굴리기
  const Z = await session({ message: [], scriptstate: {} });
  s = step('X03', '관리국첫장면_첫전송_다시굴리기');
  await Z.pick({ fac: 'A00', player: '', fm: 2 });
  await Z.mainSend('인사한다.', 'u1');
  await Z.botReply(FAKE(1, st('09:00 AM', '관리국 본부', '관리국/신입')), 'c1');
  const snap = await Z.chat();
  await Z.page.evaluate((c) => { c.message = c.message.slice(0, 2); window.__chat = c; }, snap);
  out = await Z.sendExisting();
  writeReq(s, out);
  all = allText(out);
  // 시드 인물 글은 시트 원문 또는 인물 기록(5번 기능, 시트를 대신함)으로 들어간다
  const has = (en, ko) => all.includes(`### Character - ${en}`) || all.includes(`## ${ko} (living record`);
  check(s, '다시 굴린 첫 전송에도 시드(관리국·잼트리·스팡달)', all.includes('### Management Bureau (관리국)') && has('Jaemtri', '잼트리') && has('Spangdal', '스팡달') && leaked(out).length === 0, '시드 · 표식 없음', [all.includes('### Management Bureau (관리국)'), has('Jaemtri', '잼트리'), has('Spangdal', '스팡달'), leaked(out)]);
  await Z.saveState(s);
  await Z.page.close();
}

// ════════ Y: 채팅 중 임무 요청 → 본편 요청 실패(답 없음, 기다림이 시간으로 꺼짐) → 임무 창 「요청 취소」 → 다음 전송 ════════
// 설정 「메인 응답 대기」를 최소 1분으로 두고 70초 기다린다 (core/timing.ts mainWait, host/waiting.ts expire)
if (want('Y')) {
  const S = await startedChat('pc', { 'p:goei:prefs': JSON.stringify({ times: { mainWait: 1 } }) });
  let s = step('Y01', '채팅중_임무요청_요청실패');
  const free = await (async () => { const w = await S.world(); const taken = new Set((w?.an ?? []).flatMap((a) => [a.name, a.presetName])); return ['소라 랜드', '명일 아파트', '금지된 비디오'].find((n) => !taken.has(n)); })();
  const rq = await requestMission(S, free, '');
  const out0 = await S.sendExisting(); // 요청이 나가고 답이 안 옴 (리수 쪽 실패)
  writeReq(s, out0, undefined, `■ 누름 ${JSON.stringify(rq)}\n`);
  let c = await S.chat();
  check(s, `카드(${free}) 보냄 · 상황판 대기 ${free}`, subj(free).test(c.message.at(-1)?.data ?? '') && (await S.world())?.pending?.an === free, '카드 · 대기', { 끝: /Subject:[^\n]*/.exec(c.message.at(-1)?.data ?? '')?.[0], 대기: (await S.world())?.pending });
  await S.saveState(s);
  console.log('   (Y) 기다림이 꺼지기를 70초 기다림…');
  await sleep(70_000);

  s = step('Y02', '요청실패뒤_요청취소');
  await openWin(S.page); await sleep(500);
  await S.act('tab', 'map', 500); await S.act('tab', 'mission', 500);
  const bar = await S.winText();
  await S.act('mission-cancel', 'an', 800);
  c = await S.chat();
  const w = await S.world();
  const shown = await S.display(c.message.at(-1)?.data ?? '');
  writeFileSync(`${OUT}단계${s.n}_${s.name}_화면.txt`, `■ 취소 전 창에 「요청 대기」 줄: ${bar.includes('요청 대기')}\n■ 취소 뒤 채팅 마지막 메시지 화면 글\n${shown}\n`);
  check(s, '요청 취소 → 상황판 대기 비움', !w?.pending?.an, '대기 없음', w?.pending);
  check(s, '요청 취소 → 답 없이 남은 그 카드도 채팅에서 빠짐 (1차 문제2 와 같은 기준: 「취소」는 카드와 대기를 같이)', !c.message.some((m) => subj(free).test(m.data)), '카드 없음', c.message.slice(-2).map((m) => `${m.role}:${(/Subject:[^\n]*/.exec(m.data)?.[0] ?? m.data).slice(0, 40)}`));
  await closeWin(S.page);
  await S.saveState(s);

  s = step('Y03', '요청취소뒤_보통전송');
  const out = await S.mainSend('주변을 둘러본다.', 'u9');
  writeReq(s, out, undefined, '■ 요청 취소 뒤 플레이어가 평소처럼 글을 적어 보냄\n');
  const all = allText(out);
  const lastU = out.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  check(s, '취소한 임무 지시문이 모델에 안 감', !subj(free).test(all) && !lastU.includes(M.COMMON), '없음', { subject: new RegExp(`Subject:[^\\n]*${free}[^\\n]*`).exec(all)?.[0] ?? '(없음)', 마지막유저: lastU.slice(0, 300) });
  await S.saveState(s);
  await S.page.close();
}

writeFileSync(`${OUT}결과${ONLY ? `_${ONLY}` : ''}.json`, JSON.stringify({ results }, null, 2));
const fail = results.filter((r) => !r.ok && r.why !== 'info');
const info = results.filter((r) => r.why === 'info');
console.log(`\n${results.length - info.length - fail.length}/${results.length - info.length} 통과 (참고 ${info.length}개 따로)`);
await b.close();
