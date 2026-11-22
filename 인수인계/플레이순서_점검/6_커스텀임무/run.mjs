// 플레이 순서 점검 · 6. 커스텀 임무·시작·첫 장면 (지침: ../GPT_점검지침_초안.md 3판)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄우고, 시작 화면·임무 창 단추(data-action)를 눌러 플레이 순서대로 간다.
// 기록 자리: 본편 = beforeRequest 훅 반환값(window.__calls.replacers[0]), 응답 처리 = output 리스너(window.__calls.listeners[0]), 보조 호출 = risuai.runLLMModel(window.__calls.llm).
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 가짜 응답 본문은 일부러 자리표(【가짜 응답 n】)만 쓴다 (첫 장면 글을 지어 쓰지 않는다는 사용자 규칙. 키워드가 로어북을 켜서 시드 검사를 흐리지 않게).
// 사용법: npm run release:prep -- --skip-tests  →  node 인수인계/플레이순서_점검/6_커스텀임무/run.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeWin, openEditor, setInput } from '../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };

// ── 요청 글에서 찾을 표지 (로어북·지침 원문에서 그대로 딴 줄) ──
const M = {
  SDRA: '### Special Disaster Response Association (특수재난대응협회)', // 특수재난대응협회 로어북 본문 머리 (세력 요약·명단의 짧은 머리와 구분)
  JUNGNIM: '### Jungnim Underground Shopping Center (중림 지하상가)', // 중림 지하상가 로어북 본문 머리
  CHURCH: '##### Church and Intake', // 괴이 「교회」
  SORA: '##### Park and Activation', // 괴이 「소라 랜드」
  JAEMTRI: '### Character - Jaemtri', // A00-2 시드
  SPANGDAL: '### Character - Spangdal', // A00-2 시드
  HYERAN: '### Character - Mun Hye-ran', // 문혜란 로어북 본문 머리
  COMMON: 'The user picked a subject and companions in a menu outside the story.',
  OPENING: 'This is the first message of a new story.',
  CONT: 'The story is already in progress.',
};
const MARKERS = ['%%SCENE_CARD', '%%/SCENE_CARD%%', '%%GOEI_START%%', '%%/GOEI_START%%', '%%GOEI_UNSENT%%', '%%GOEI_SCENE%%', '%%SEED%%', '%%/SEED%%'];
const st = (time, place, aff, target = '없음') => `[▣|2025.03.14|${time}|☀️|8°C|${place}|${target}|없음|없음|${aff}|1000]`;
const FAKE = (n, status, extra = '') => `【가짜 응답 ${n}】${extra ? `\n${extra}` : ''}\n${status}`;

/** 시험 페이지 Math.random 씨앗 (무작위 발생 고정) */
const SEED = 20261122;
const results = [];
let stepNo = 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 400)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const count = (hay, needle) => hay.split(needle).length - 1;
const allText = (out) => out.map((m) => m.content).join('\n');
const leaked = (out) => MARKERS.filter((k) => allText(out).includes(k));

const b = await launch();

/** 페이지 하나에 쓰는 도구 묶음 */
async function session(chat0, vp = 'pc') {
  const { page, errors } = await boot(b, fx, chat0, vp, { store: STORE });
  // 무작위 발생(첫 발생 추첨 등)을 고정한다: 판마다 상황판에 깔리는 괴이가 달라 커스텀 임무 목표(교회·소라 랜드 등)와 겹치면 「이미 발생 중인 괴이예요」로 거절돼 점검이 흔들렸다 (제품 코드는 그대로, 시험 페이지의 Math.random 만)
  await page.evaluate((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
  const chat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const vars = async () => (await chat()).scriptstate ?? {};
  const world = async () => { try { return JSON.parse((await vars()).$goei_world || 'null'); } catch { return null; } };
  const sends = () => page.evaluate(() => (window.__calls.send || []).length);
  const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
  /** 창 안에서 data-action 단추를 누른다 (실제 단추가 없으면 같은 값의 단추를 창 안에 만들어 누름 = 위임 처리기와 같은 길) */
  const act = async (action, value) => {
    await page.evaluate(({ action, value }) => {
      const real = [...document.querySelectorAll(`.gx [data-action="${action}"]`)].find((e) => value === undefined || e.dataset.value === value);
      if (real) { real.click(); return; }
      const el = document.createElement('button');
      el.dataset.action = action;
      if (value !== undefined) el.dataset.value = value;
      el.style.display = 'none';
      (document.querySelector('.gx .gx-body') || document.querySelector('.gx') || document.body).appendChild(el);
      el.click();
      el.remove();
    }, { action, value });
    await sleep(400);
  };
  const isOpen = () => page.evaluate(() => { const g = document.querySelector('.gx'); return !!g && g.style.display !== 'none'; });
  const winText = () => page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
  /** 임무 창(괴이 목록)에 있는 괴이 중 상황판에 이미 있거나 요청 대기가 아닌 것. prefer 를 먼저, avoid 는 뺀다 (무작위 발생과 겹치지 않게) */
  const boardAn = async () => { const w = await world(); return new Set([...(w?.an ?? []).flatMap((a) => [a.name, a.presetName]), w?.pending?.an].filter(Boolean)); };
  const listedAn = () => page.evaluate(() => [...document.querySelectorAll('.gx [data-action="mission-open"], .gx [data-action="mission-pick"]')].map((e) => e.dataset.value ?? '').filter((v) => v.startsWith('an:')).map((v) => v.slice(3)));
  const freeAn = async (prefer, avoid = []) => { const taken = await boardAn(); return [...prefer, ...(await listedAn())].find((n) => !taken.has(n) && !avoid.includes(n)); };
  /** 본편 요청: 지금 채팅(window.__chat)을 그대로 요청 배열로 (Risu 처럼 마지막 유저 메시지가 끝) */
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
    await sleep(400);
  };
  const saveState = async (s) => {
    const c = await chat();
    const keep = Object.fromEntries(Object.entries(c.scriptstate ?? {}).filter(([k]) => /^\$(st_faction|st_fm|st_pick|st_player|st_lang|ib_affiliation|seed_lore|seed_inputs|an_report|goei_world|st_anomaly_on)$/.test(k)).map(([k, v]) => [k, k === '$goei_world' ? (() => { try { const w = JSON.parse(v); return { pending: w.pending, an: w.an?.map((a) => `${a.name || a.presetName}|${a.state}|${a.origin}`) }; } catch { return v; } })() : v]));
    writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: keep, messages: c.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })), sendChat: await sends(), 창열림: await isOpen() }, null, 2));
  };
  /** 시작 화면에서 소속·상황을 고르고 출발 */
  const pick = async (fac, fm, situation) => {
    await openWin(page); await sleep(400);
    await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`).click(), fac); await sleep(300);
    await page.evaluate((v) => document.querySelector(`.gx-sc[data-value="${v}"]`).click(), String(fm)); await sleep(300);
    if (situation !== undefined) await setInput(page, '[data-input="start-note"]', situation, 'input');
    await sleep(200);
    const disabled = await page.evaluate(() => document.querySelector('.gx-start')?.disabled);
    await page.evaluate(() => document.querySelector('.gx-start')?.click());
    await sleep(1600);
    return { disabled };
  };
  return { page, errors, chat, vars, world, sends, boardAn, listedAn, freeAn, llmCount, act, isOpen, winText, sendExisting, mainSend, botReply, saveState, pick };
}

// ════════ 갈래 A: 프리랜서 · 직접 입력 ════════
const SIT = '아침, 집에서 시작한다.';
{
  const A = await session({ message: [], scriptstate: {} });
  let s = step('A_시작화면_프리랜서_직접입력');
  const { disabled } = await A.pick('E00', 3, SIT);
  let c = await A.chat();
  let v = c.scriptstate ?? {};
  check(s, '출발 단추가 눌림(상황을 적었으니 켜짐)', disabled === false, false, disabled);
  check(s, '채팅에 직접 입력 카드 하나(유저)', c.message.length === 1 && c.message[0].role === 'user' && c.message[0].data.includes('%%GOEI_START%%') && c.message[0].data.includes(SIT), '유저 1개 · GOEI_START · 상황 글', c.message.map((m) => `${m.role}:${m.data.slice(0, 60)}`));
  check(s, '소속 E00 · 상황 3 · 모델에 알릴 소속 「프리랜서」', v.$st_faction === 'E00' && v.$st_fm === '3' && v.$ib_affiliation === '프리랜서', { $st_faction: 'E00', $st_fm: '3', $ib_affiliation: '프리랜서' }, { $st_faction: v.$st_faction, $st_fm: v.$st_fm, $ib_affiliation: v.$ib_affiliation });
  check(s, '시드에 특수재난대응협회·중림 지하상가 (명부 시작 로어북 E00-3, 사용자 기본값)', String(v.$seed_lore).includes(M.SDRA) && String(v.$seed_lore).includes(M.JUNGNIM), 'SDRA + Jungnim', String(v.$seed_lore).slice(0, 120));
  check(s, '바로 전송(sendChat 1회)', (await A.sends()) === 1, 1, await A.sends());
  check(s, '창은 닫힘', !(await A.isOpen()), '닫힘', await A.isOpen());
  await A.saveState(s);

  s = step('A_첫요청');
  let out = await A.sendExisting();
  writeReq(s, out);
  let all = allText(out);
  const lastUser = out.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  check(s, '시드: 특수재난대응협회 로어북 1번', count(all, M.SDRA) === 1, 1, count(all, M.SDRA));
  check(s, '시드: 중림 지하상가 로어북 있음', all.includes(M.JUNGNIM), '### Jungnim…', all.includes(M.JUNGNIM));
  check(s, '플러그인 표식이 모델에 안 감', leaked(out).length === 0, [], leaked(out));
  check(s, '마지막 유저 글 = 적은 상황 그대로', lastUser.trim() === SIT, SIT, lastUser);
  check(s, '로어 덩어리는 유저 글 앞(system)', out.findIndex((m) => m.content.includes(M.SDRA)) < out.findIndex((m) => m.role === 'user'), '앞', [out.findIndex((m) => m.content.includes(M.SDRA)), out.findIndex((m) => m.role === 'user')]);
  check(s, '[참고] 직접 입력 첫 요청에 「첫 메시지」 지시(OPENING 같은 길이·평소 하루)가 있나', all.includes(M.OPENING), '물을 것(근거 없음)', all.includes(M.OPENING), 'info');
  await A.saveState(s);

  s = step('A_첫응답');
  await A.botReply(FAKE(1, st('09:10 AM', '집', '프리랜서')), 'c1');
  c = await A.chat();
  check(s, '응답 붙은 뒤 직접 입력 카드는 그대로(안 보냄 표식 없음)', c.message[0].data.includes('%%GOEI_START%%') && !c.message[0].data.includes('%%GOEI_UNSENT%%'), 'GOEI_START, UNSENT 없음', c.message[0].data);
  await A.saveState(s);
  const snapA1 = await A.chat();

  s = step('A_둘째턴_시드빠짐');
  out = await A.mainSend('창밖을 본다.', 'u2');
  writeReq(s, out);
  all = allText(out);
  check(s, '시드(특수재난대응협회) 빠짐', !all.includes(M.SDRA), '없음', count(all, M.SDRA));
  check(s, '시드(중림 지하상가) 빠짐', !all.includes(M.JUNGNIM), '없음', all.includes(M.JUNGNIM));
  check(s, '첫 상황 글은 대화 기록으로 남음', all.includes(SIT), '있음', all.includes(SIT));
  check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
  await A.saveState(s);

  s = step('A_첫전송_다시굴리기');
  await A.page.evaluate((c) => { c.message = c.message.slice(0, 1); window.__chat = c; }, snapA1);
  out = await A.sendExisting();
  writeReq(s, out);
  all = allText(out);
  check(s, '다시 굴려도 시드(특수재난대응협회·중림) 다시 들어감', all.includes(M.SDRA) && all.includes(M.JUNGNIM), '둘 다', [all.includes(M.SDRA), all.includes(M.JUNGNIM)]);
  await A.saveState(s);
  if (A.errors.length) console.log('A 페이지 오류', A.errors.slice(0, 3));
  await A.page.close();
}

// ════════ 갈래 B: 프리랜서 · 커스텀 임무로 시작 ════════
{
  const B = await session({ message: [], scriptstate: {} });
  let s = step('B_시작화면_커스텀임무');
  await B.pick('E00', 4);
  let c = await B.chat();
  let v = c.scriptstate ?? {};
  check(s, '채팅은 비어 있고 창이 목표 고르기로 넘어감', c.message.length === 0 && (await B.isOpen()) && (await B.winText()).includes('커스텀 임무로 시작해요'), '빈 채팅 · 목표 고르기', { n: c.message.length, open: await B.isOpen(), text: (await B.winText()).slice(0, 60) });
  check(s, '시드에 특수재난대응협회·중림 지하상가 (E00-4)', String(v.$seed_lore).includes(M.SDRA) && String(v.$seed_lore).includes(M.JUNGNIM), 'SDRA + Jungnim', String(v.$seed_lore).slice(0, 80));
  check(s, '아직 전송 없음', (await B.sends()) === 0, 0, await B.sends());
  await B.saveState(s);

  s = step('B_창닫고_다시열기');
  await closeWin(B.page); await sleep(200);
  await openWin(B.page); await sleep(500);
  check(s, '다시 열어도 목표 고르기(시작 화면으로 안 돌아감)', (await B.winText()).includes('커스텀 임무로 시작해요'), '목표 고르기', (await B.winText()).slice(0, 80));

  s = step('B_목표교회_작전개시');
  await B.act('mission-kind', 'an');
  await B.act('mission-pick', 'an:교회');
  await B.act('mission-send');
  await sleep(800);
  c = await B.chat();
  const card = c.message.at(-1)?.data ?? '';
  const w = await B.world();
  check(s, '채팅에 지시문 카드 하나(유저)', c.message.length === 1 && c.message[0].role === 'user' && card.includes('%%SCENE_CARD:'), '카드 1개', c.message.map((m) => `${m.role}:${m.data.slice(0, 40)}`));
  check(s, '카드에 OPENING(새 이야기 첫 메시지) 절, CONTINUATION 없음', card.includes(M.OPENING) && !card.includes(M.CONT), 'OPENING', { opening: card.includes(M.OPENING), cont: card.includes(M.CONT) });
  check(s, '상황판에 요청 대기: 교회', w?.pending?.an === '교회', '교회', w?.pending);
  check(s, '바로 전송(sendChat 1회)', (await B.sends()) === 1, 1, await B.sends());
  const html = await B.page.evaluate((t) => window.__calls.handlers.display(t), card);
  check(s, '채팅 화면: 카드로 보이고(목표 교회) 지시문 원문·표식은 안 보임', html.includes('교회') && !html.includes('%%SCENE_CARD') && !html.includes(M.OPENING), '카드', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
  await B.saveState(s);

  s = step('B_첫요청');
  let out = await B.sendExisting();
  writeReq(s, out);
  let all = allText(out);
  check(s, 'OPENING 지시가 감', all.includes(M.OPENING) && all.includes('ordinary day'), 'OPENING', all.includes(M.OPENING));
  check(s, 'CONTINUATION 없음', !all.includes(M.CONT), '없음', all.includes(M.CONT));
  check(s, '대상: 교회', /Subject: [^\n]*교회/.test(all), 'Subject: 교회', /Subject:[^\n]*/.exec(all)?.[0]);
  check(s, '고른 괴이 「교회」 로어북이 감 (v0.21.31 고침)', all.includes(M.CHURCH), M.CHURCH, all.includes(M.CHURCH));
  check(s, '시드: 특수재난대응협회 1번·중림 지하상가', count(all, M.SDRA) === 1 && all.includes(M.JUNGNIM), 'SDRA 1 + Jungnim', [count(all, M.SDRA), all.includes(M.JUNGNIM)]);
  check(s, '상황판 NEW 줄(교회)', /NEW \[AN\|[^\]\n]*\|교회\|활성/.test(all), 'NEW [AN|…|교회|활성…', /NEW \[AN[^\n]*교회[^\n]*/.exec(all)?.[0] ?? '(없음)');
  check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
  await B.saveState(s);
  const firstAn = /[^\n]*\[AN[^\n]*교회[^\n]*/.exec(all)?.[0] ?? '(없음)';

  s = step('B_첫응답');
  const R1 = FAKE(1, st('10:00 AM', '서울특별시 종로구', '프리랜서', '교회'), '[AN|서울특별시 종로구|교회|활성|C|없음|가짜 상황 글 1]');
  await B.botReply(R1, 'c1');
  const w1 = await B.world();
  check(s, '응답의 AN 태그로 교회 등록, 요청 대기 풀림', !w1?.pending?.an && w1?.an?.some((a) => (a.name || a.presetName) === '교회' && a.state === '활성'), '교회 활성 · 대기 없음', { pending: w1?.pending, an: w1?.an?.map((a) => `${a.name || a.presetName}|${a.state}`) });
  await B.saveState(s);
  const snapB1 = await B.chat();

  s = step('B_둘째턴');
  out = await B.mainSend('주위를 둘러본다.', 'u2');
  writeReq(s, out);
  all = allText(out);
  check(s, '시드(특수재난대응협회) 빠짐', !all.includes(M.SDRA), '없음', count(all, M.SDRA));
  check(s, '시드(중림 지하상가) 빠짐', !all.includes(M.JUNGNIM), '없음', all.includes(M.JUNGNIM));
  check(s, '지난 지시문은 OPENING 문장이 빠지고 맥락(Subject)만', !all.includes(M.OPENING) && !all.includes(M.COMMON) && /Subject: [^\n]*교회/.test(all), 'OPENING·COMMON 없음, Subject 있음', { opening: all.includes(M.OPENING), common: all.includes(M.COMMON), subject: /Subject:[^\n]*/.exec(all)?.[0] });
  check(s, 'NEW 교회 줄은 다시 안 나옴(한 번만)', !/NEW \[AN[^\n]*교회/.test(all), '없음', /NEW \[AN[^\n]*교회[^\n]*/.exec(all)?.[0] ?? '(없음)');
  check(s, '[참고] 교회 로어북 계속(상태창 괴이 칸·고른 대상)', all.includes(M.CHURCH), '있음', all.includes(M.CHURCH), 'info');
  await B.saveState(s);

  s = step('B_첫전송_다시굴리기');
  // Risu 다시 굴리기: 첫 응답(c1)을 지우고 같은 요청을 다시 보낸다 (응답 처리 전이라 상황판 되감기는 아직 안 돌았다)
  await B.page.evaluate((c) => { c.message = c.message.slice(0, 1); window.__chat = c; }, snapB1);
  out = await B.sendExisting();
  writeReq(s, out);
  all = allText(out);
  check(s, 'OPENING·교회 로어북·시드가 다시 들어감', all.includes(M.OPENING) && all.includes(M.CHURCH) && all.includes(M.SDRA), '셋 다', [all.includes(M.OPENING), all.includes(M.CHURCH), all.includes(M.SDRA)]);
  check(s, '버린 응답의 상황판 사실(「가짜 상황 글 1」)이 다시 굴린 요청에 안 감', !all.includes('가짜 상황 글 1'), '없음 (첫 요청처럼 NEW 줄)', /\[AN[^\n]*교회[^\n]*/.exec(all)?.[0] ?? '(없음)');
  check(s, '다시 굴린 요청에도 NEW 교회 줄 (첫 요청과 같게)', /NEW \[AN\|[^\]\n]*\|교회\|활성/.test(all), 'NEW 줄', /\[AN[^\n]*교회[^\n]*/.exec(all)?.[0] ?? '(없음)');
  await B.saveState(s);
  // 첫 요청(단계 B_첫요청)과 견줌: 다시 굴린 요청의 상황판 칸이 같은가
  writeFileSync(`${OUT}단계${s.n}_${s.name}_첫요청과비교.txt`, `첫 요청의 교회 줄: ${firstAn}\n다시 굴린 요청의 교회 줄: ${/[^\n]*\[AN[^\n]*교회[^\n]*/.exec(all)?.[0] ?? '(없음)'}\n`);
  {
    const s2 = step('B_보조호출');
    const calls = await B.page.evaluate(() => (window.__calls.llm || []).map((o) => (o.messages || []).map((m) => `[${m.role}] ${String(m.content)}`).join('\n\n')));
    writeFileSync(`${OUT}단계${s2.n}_${s2.name}.txt`, calls.map((t, i) => `════ 보조 호출 ${i + 1} ════\n${t}`).join('\n\n') + '\n');
    // 지시문 흐름 자체는 보조 호출을 하지 않는다. 생기면 무엇인지 적어 둔다 (인물 기록 Router 등, 다른 기능)
    check(s2, '[참고] 보조 호출 수와 첫 줄', true, '기록만', calls.map((t) => t.slice(0, 80)), 'info');
  }
  if (B.errors.length) console.log('B 페이지 오류', B.errors.slice(0, 3));
  await B.page.close();
}

// ════════ 갈래 C: 관리국 · 첫 장면(코드네임) → 채팅 중 커스텀 임무 ════════
{
  const C = await session({ message: [], scriptstate: {} });
  let s = step('C_시작화면_관리국_첫장면');
  await C.pick('A00', 2);
  let c = await C.chat();
  let v = c.scriptstate ?? {};
  check(s, '첫 장면 메시지(char, 표식) 하나', c.message.length === 1 && c.message[0].role === 'char' && c.message[0].data.includes('%%GOEI_SCENE%%'), 'char 1개', c.message.map((m) => `${m.role}:${m.data.slice(0, 40)}`));
  check(s, '시드 A00-2 (잼트리·스팡달)', String(v.$seed_lore).includes('Jaemtri') && String(v.$seed_lore).includes('Spangdal'), 'Jaemtri + Spangdal', String(v.$seed_lore).slice(0, 80));
  check(s, '자동 전송 없음(첫 행동을 적어 보냄)', (await C.sends()) === 0, 0, await C.sends());
  await C.saveState(s);
  const scene = c.message[0].data.replace(/\r?\n?%%GOEI_SCENE%%/g, '');

  s = step('C_첫요청');
  let out = await C.mainSend('인사한다.', 'u1');
  writeReq(s, out);
  let all = allText(out);
  check(s, '시드(잼트리·스팡달) 감', all.includes(M.JAEMTRI) && all.includes(M.SPANGDAL), '둘 다', [all.includes(M.JAEMTRI), all.includes(M.SPANGDAL)]);
  check(s, '첫 장면 글이 표식 없이 감', all.includes(scene.slice(0, 40)) && leaked(out).length === 0, '장면 글 · 표식 없음', leaked(out));
  await C.saveState(s);

  s = step('C_첫응답_둘째턴');
  await C.botReply(FAKE(1, st('09:00 AM', '관리국 본부', '관리국/신입')), 'c1');
  out = await C.mainSend('자리에 앉는다.', 'u2');
  writeReq(s, out);
  all = allText(out);
  check(s, '둘째 턴: 시드(스팡달) 빠짐', !all.includes(M.SPANGDAL), '없음', all.includes(M.SPANGDAL));
  await C.botReply(FAKE(2, st('09:20 AM', '관리국 본부', '관리국/신입')), 'c2');
  await C.saveState(s);

  s = step('C_채팅중_커스텀임무_소라랜드');
  const n0 = (await C.chat()).message.length;
  const sends0 = await C.sends();
  await openWin(C.page); await sleep(500);
  await C.act('tab', 'mission');
  await C.act('mission-kind', 'an');
  await C.act('mission-pick', 'an:소라 랜드');
  await C.page.evaluate(() => { const i = document.querySelector('[data-input="field-note"]'); if (i) { i.value = '조용히 움직인다.'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  await sleep(200);
  await C.act('mission-send');
  await sleep(800);
  c = await C.chat();
  const card = c.message.at(-1)?.data ?? '';
  check(s, '지난 대화는 그대로, 끝에 지시문 카드 하나 붙음', c.message.length === n0 + 1 && c.message.at(-2)?.chatId === 'c2' && card.includes('%%SCENE_CARD:'), `${n0 + 1}개, 끝 카드`, c.message.map((m) => `${m.role}:${(m.chatId ?? '').slice(0, 6)}`));
  check(s, '카드에 CONTINUATION(지금 장면 잇기), OPENING 없음', card.includes(M.CONT) && !card.includes(M.OPENING), 'CONTINUATION', { cont: card.includes(M.CONT), opening: card.includes(M.OPENING) });
  check(s, '작전 메모가 카드 뒤에', card.includes('조용히 움직인다.'), '메모', card.slice(-40));
  check(s, '바로 전송(sendChat +1)', (await C.sends()) === sends0 + 1, sends0 + 1, await C.sends());
  await C.saveState(s);

  s = step('C_커스텀임무_요청');
  out = await C.sendExisting();
  writeReq(s, out);
  all = allText(out);
  const lastU = out.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  check(s, '마지막 유저 글에 CONTINUATION + 대상 소라 랜드 + Situation 메모', lastU.includes(M.CONT) && /Subject: [^\n]*소라 랜드/.test(lastU) && /Situation:\n조용히 움직인다\./.test(lastU), 'CONT · Subject · Situation', lastU.slice(-300));
  check(s, 'OPENING 없음', !all.includes(M.OPENING), '없음', all.includes(M.OPENING));
  check(s, '지금 장면(지난 응답 1·2)이 요청에 그대로', all.includes('【가짜 응답 1】') && all.includes('【가짜 응답 2】'), '둘 다', [all.includes('【가짜 응답 1】'), all.includes('【가짜 응답 2】')]);
  check(s, '고른 괴이 「소라 랜드」 로어북', all.includes(M.SORA), M.SORA, all.includes(M.SORA));
  check(s, '상황판 NEW 줄(소라 랜드)', /NEW \[AN\|[^\]\n]*\|소라 랜드\|활성/.test(all), 'NEW', /NEW \[AN[^\n]*소라[^\n]*/.exec(all)?.[0] ?? '(없음)');
  check(s, '시드 없음(셋째 전송)', !all.includes(M.SPANGDAL), '없음', all.includes(M.SPANGDAL));
  check(s, '표식 없음', leaked(out).length === 0, [], leaked(out));
  await C.saveState(s);

  s = step('C_응답_다음턴');
  await C.botReply(FAKE(3, st('09:40 AM', '관리국 본부', '관리국/신입', '소라 랜드'), '[AN|경기도 용인시|소라 랜드|활성|C|없음|가짜 상황 글 3]'), 'c3');
  out = await C.mainSend('다음 행동.', 'u4');
  writeReq(s, out);
  all = allText(out);
  check(s, 'CONTINUATION·COMMON 문장은 다시 안 감(맥락만)', !all.includes(M.CONT) && !all.includes(M.COMMON), '없음', { cont: all.includes(M.CONT), common: all.includes(M.COMMON) });
  check(s, 'NEW 소라 랜드 줄 다시 안 나옴', !/NEW \[AN[^\n]*소라 랜드/.test(all), '없음', /NEW \[AN[^\n]*소라[^\n]*/.exec(all)?.[0] ?? '(없음)');
  await C.botReply(FAKE(4, st('10:00 AM', '관리국 본부', '관리국/신입', '소라 랜드')), 'c4');
  await C.saveState(s);

  // ── 임무 바꾸기: 전송이 막혀(플러그인 모델 등) 카드가 안 보내진 채로 남았을 때 다른 목표로 다시 요청 ──
  s = step('C_안보낸카드_임무바꾸기');
  await C.page.evaluate(() => { window.__sendFail = true; });
  const n1 = (await C.chat()).message.length;
  await openWin(C.page); await sleep(400);
  await C.act('tab', 'mission');
  // 상황판에 이미 있는 괴이를 고르면 전처럼 거절 (카드·대기 없음)
  const taken = await C.boardAn();
  const busyAn = (await C.listedAn()).find((n) => taken.has(n));
  if (busyAn) {
    await C.act('mission-pick', `an:${busyAn}`);
    await C.act('mission-send');
    await sleep(800);
    const cb = await C.chat();
    check(s, `상황판에 이미 있는 괴이(${busyAn})는 거절: 「이미 발생 중인 괴이예요」, 카드·대기 없음`, cb.message.length === n1 && (await C.winText()).includes('이미 발생 중인 괴이예요') && !(await C.world())?.pending?.an, '거절', { n: cb.message.length, pending: (await C.world())?.pending });
    await openWin(C.page); await sleep(400);
    await C.act('tab', 'mission');
  } else console.log(`   (참고) [${s.n}] 상황판에 임무 창 목록의 괴이가 없어 거절 검사를 건너뜀`);
  const T1 = await C.freeAn(['명일 아파트']);
  await C.act('mission-pick', `an:${T1}`);
  await C.act('mission-send');
  await sleep(1200);
  let cc = await C.chat();
  check(s, `첫 요청(${T1}): 카드가 「안 보냄」으로 남음`, cc.message.length === n1 + 1 && cc.message.at(-1).data.includes('%%SCENE_CARD:'), `${n1 + 1}개`, cc.message.length);
  await openWin(C.page); await sleep(400);
  await C.act('tab', 'mission');
  const T2 = await C.freeAn(['금지된 비디오'], [T1]);
  await C.act('mission-pick', `an:${T2}`);
  await C.act('mission-send');
  await sleep(1200);
  cc = await C.chat();
  const w2 = await C.world();
  const subj = (n) => new RegExp(`Subject: [^\\n]*${n}`);
  check(s, `바꿔 끼움: 새 카드 하나만(${T1} 카드 사라짐 → ${T2})`, cc.message.length === n1 + 1 && cc.message.at(-1).data.includes('CONTINUATION') === false && subj(T2).test(cc.message.at(-1).data) && !cc.message.some((m) => subj(T1).test(m.data)), `${n1 + 1}개 · ${T2}`, cc.message.slice(n1).map((m) => /Subject:[^\n]*/.exec(m.data)?.[0]));
  check(s, `상황판 요청 대기도 ${T2}로 바뀜`, w2?.pending?.an === T2, T2, w2?.pending);
  await C.saveState(s);

  // ── 임무 끄기: 임무 창의 「요청 취소」 ──
  s = step('C_요청취소_뒤_전송');
  await openWin(C.page); await sleep(400);
  await C.act('tab', 'mission');
  const pendBar = await C.winText();
  await C.act('mission-cancel', 'an');
  await sleep(600);
  const w3 = await C.world();
  cc = await C.chat();
  check(s, '요청 취소 → 상황판 대기 비움', !w3?.pending?.an, '대기 없음', w3?.pending, pendBar.includes('요청 대기') ? '' : '(창에 요청 대기 줄이 안 보였음)');
  check(s, '요청 취소 → 안 보낸 지시문 카드도 채팅에서 빠짐 (카드의 「취소」와 같게)', !cc.message.some((m) => subj(T2).test(m.data)), '카드 없음', cc.message.slice(n1).map((m) => `${m.role}:${/Subject:[^\n]*/.exec(m.data)?.[0] ?? m.data.slice(0, 30)}`));
  const left = cc.message.at(-1)?.data ?? '';
  const shown = (await C.page.evaluate((t) => window.__calls.handlers.display(t), left)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  writeFileSync(`${OUT}단계${s.n}_${s.name}_화면.txt`, `■ 요청 취소 뒤 임무 창 글\n${await C.winText()}\n\n■ 채팅 속 마지막 메시지 화면 글\n${shown}\n`);
  check(s, '요청 취소 뒤 채팅 화면에 「전송 대기」 카드가 남지 않음 (창은 대기 없음이라 말함)', !shown.includes(T2), '카드 없음', shown.slice(0, 160));
  await closeWin(C.page);
  out = await C.sendExisting();
  writeReq(s, out, undefined, '■ 요청 취소 뒤 플레이어가 채팅창 전송을 누름\n');
  all = allText(out);
  check(s, '취소한 임무 지시문이 모델에 안 감', !subj(T2).test(all), '없음', new RegExp(`Subject:[^\\n]*${T2}[^\\n]*`).exec(all)?.[0] ?? '(없음)');
  await C.saveState(s);
  if (C.errors.length) console.log('C 페이지 오류', C.errors.slice(0, 3));
  await C.page.close();
}

// ════════ 갈래 D: 설정 「첫 장면에 함께 넣을 로어북」을 바꾸고 시작 / 민간인 빈 줄 ════════
{
  const D = await session({ message: [], scriptstate: {} });
  let s = step('D_설정_첫장면로어북_바꾸기');
  await openWin(D.page); await sleep(400);
  await openEditor(D.page, 'org'); await sleep(400);
  const opened = await D.page.evaluate(() => { const hit = [...document.querySelectorAll('.gw .gw-body [data-action]')].find((e) => e.textContent.trim().startsWith('프리랜서')); hit?.click(); return !!hit; });
  await sleep(500);
  const before = await D.page.evaluate(() => document.querySelector('.gw [data-key="seed:E00-3"]')?.value ?? null);
  check(s, '설정에 E00-3 칸이 기본값(특수재난대응협회, 중림 지하상가)으로 보임', opened && before === '특수재난대응협회, 중림 지하상가', '특수재난대응협회, 중림 지하상가', before);
  if (before !== null) {
    await setInput(D.page, '.gw [data-key="seed:E00-3"]', '문혜란', 'input');
    await sleep(300);
    await D.page.evaluate(() => document.querySelector('.gw [data-action="dir-save"]')?.click());
    await sleep(500);
    // 확인 팝업이 있으면 저장
    await D.page.evaluate(() => document.querySelector('.gw [data-action="dir-save"]')?.click());
    await sleep(800);
  }
  const savedLore = await D.page.evaluate(() => JSON.stringify((window.__char.globalLore || []).filter((e) => String(e.content || '').includes('시작 로어북')).map((e) => e.comment)));
  check(s, '카드 로어북에 저장됨', savedLore !== '[]', '명부 항목', savedLore);
  // 편집 창 닫기 (저장했으니 그냥 닫힘)
  await D.page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click()); await sleep(300);
  await D.page.evaluate(() => document.querySelector('.gw [data-action="ed-close-force"]')?.click()); await sleep(300);
  await closeWin(D.page).catch(() => {});
  await D.pick('E00', 3, SIT);
  const v = await D.vars();
  check(s, '바꾼 값대로 시드 = 문혜란 (특수재난대응협회 없음)', String(v.$seed_lore).includes(M.HYERAN) && !String(v.$seed_lore).includes(M.SDRA), '문혜란만', String(v.$seed_lore).slice(0, 120));
  const out = await D.sendExisting();
  writeReq(s, out);
  const all = allText(out);
  check(s, '첫 요청에도 문혜란, 특수재난대응협회 없음', all.includes(M.HYERAN) && !all.includes(M.SDRA), '문혜란만', [all.includes(M.HYERAN), all.includes(M.SDRA)]);
  await D.saveState(s);
  if (D.errors.length) console.log('D 페이지 오류', D.errors.slice(0, 3));
  await D.page.close();
}
{
  const E = await session({ message: [], scriptstate: {} });
  const s = step('E_민간인_직접입력_빈줄');
  await E.pick('D00', 6, SIT);
  const c = await E.chat();
  const v = c.scriptstate ?? {};
  check(s, '민간인 직접 입력: 시작은 되고 시드는 빔(사용자가 채울 줄)', c.message.length === 1 && !v.$seed_lore, '시작 · 시드 빔', { n: c.message.length, seed: String(v.$seed_lore ?? '').slice(0, 40) });
  const out = await E.sendExisting();
  writeReq(s, out);
  check(s, '첫 요청이 표식 없이 감', leaked(out).length === 0, [], leaked(out));
  await E.saveState(s);
  await E.page.close();
}

writeFileSync(`${OUT}결과.json`, JSON.stringify({ commit: process.env.GIT_COMMIT ?? '', results }, null, 2));
const fail = results.filter((r) => !r.ok && r.why !== 'info');
const info = results.filter((r) => r.why === 'info');
console.log(`\n${results.length - info.length - fail.length}/${results.length - info.length} 통과 (참고 ${info.length}개 따로)`);
await b.close();
