// 플레이 순서 점검 2차 · 15 상황판·지도·요원·명부 (지침: ../../GPT_점검지침_초안.md 3판)
// 틀은 2차 06 과 같다: 실제 번들 + .scratch/fixture 카드 + 가짜 Risu(tests/qc-settings-harness.mjs).
// 기록 자리: 본편 = beforeRequest 훅 반환값(window.__calls.replacers[0]), 응답 처리 = output 리스너(window.__calls.listeners[0]),
// 상황판 상태 = scriptstate.$goei_world · $an_report · $in_report · $ms_report · $ag_report, 일지 = $goei_journal · $goei_reports, 리롤 기준 = $goei_prev.
// 이 네 기능은 보조 호출(runLLMModel)을 하지 않는다 → 호출 수가 0 인지만 본다.
// 가짜 응답 본문은 자리표(【가짜 응답 n】)와 상태창·상황판 태그만. 무작위 괴이 이름은 「가짜괴이」로 둔다(로어북에 없는 이름을 지어 쓰지 않으려고).
// 사용법: (fixture 가 있으면) node 인수인계/플레이순서_점검/2차/15_상황판_지도_요원_명부/run.mjs [갈래 글자들, 예: AB]
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeWin, openEditor, goNode, closeEditor } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const ONLY = (process.argv[2] ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
const SEED = 20261122;
const results = [];
const step = (n, name) => ({ n, name });
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : why === 'info' ? 'INFO' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
const info = (s, what, actual) => check(s, what, false, '(참고)', actual, 'info');
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const allText = (out) => out.map((m) => m.content).join('\n');
const MARKERS = ['%%SCENE_CARD', '%%/SCENE_CARD%%', '%%GOEI_START%%', '%%GOEI_UNSENT%%', '%%GOEI_SCENE%%', '%%SEED%%'];
const leaked = (out) => MARKERS.filter((k) => allText(out).includes(k));
/** 요청 글의 Tag 지침 안 World Entries 칸 (Anomaly·Incident·Mystic·Agent 머리 바로 아래 줄들) */
function entries(out) {
  const t = allText(out);
  const pick = (head, next) => { const a = t.indexOf(`#### ${head}\n`); if (a < 0) return null; const b = t.indexOf(next, a + head.length + 6); return t.slice(a + head.length + 6, b < 0 ? undefined : b).split('\n').filter((l) => /^\s*(NEW )?\[(AN|IN|MS|AG)\|/.test(l) || /^- code:/.test(l)); };
  return { an: pick('Anomaly', '\n- 발생지점'), in: pick('Incident', '\n- 발생지점'), ms: pick('Mystic Site', '\n- 명칭'), ag: pick('Agent', '\n- Agent codes') };
}
// 상태창 [▣|날짜|시각|날씨|기온|위치|목표|동행|투입|신분|잔고]
const ST = (date, time, place, target = '없음', aff = '관리국/요원') => `[▣|${date}|${time}|☀️|8°C|${place}|${target}|없음|없음|${aff}|1000]`;
const FAKE = (n, status, tags = []) => `【가짜 응답 ${n}】\n${tags.join('\n')}\n${status}`;

const b = await launch();

async function session(chat0, vp = 'pc', extra = {}) {
  const { page, errors } = await boot(b, fx, chat0, vp, { store: { ...STORE, ...extra } });
  await page.evaluate((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
  const chat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const vars = async () => (await chat()).scriptstate ?? {};
  const J = (v) => { try { return JSON.parse(v || 'null'); } catch { return null; } };
  const world = async () => J((await vars()).$goei_world);
  const journal = async () => J((await vars()).$goei_journal);
  const llm = () => page.evaluate(() => (window.__calls.llm || []).length);
  const act = async (action, value, wait = 450, scope = '.gx') => {
    const real = await page.evaluate(({ action, value, scope }) => {
      const r = [...document.querySelectorAll(`${scope} [data-action="${action}"]`)].find((e) => value === undefined || e.dataset.value === value);
      if (r) { r.click(); return true; }
      return false;
    }, { action, value, scope });
    await sleep(wait);
    return real;
  };
  const winText = () => page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
  const html = (sel) => page.evaluate((s) => document.querySelector(s)?.outerHTML ?? '', sel);
  const sendExisting = (type = 'model') => page.evaluate(async (type) => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], type);
    return out.map((m) => ({ role: m.role, content: String(m.content) }));
  }, type);
  const mainSend = async (text, id) => { await page.evaluate(([t, id]) => { window.__chat.message.push({ role: 'user', data: t, chatId: id }); }, [text, id]); return sendExisting(); };
  const botReply = async (text, id) => {
    await page.evaluate(async ([t, id]) => {
      window.__chat.message.push({ role: 'char', data: t, chatId: id });
      await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
    }, [text, id]);
    await sleep(500);
  };
  /** 다시 굴리기: 마지막 봇 응답을 빼고(리수가 하는 것처럼) 요청을 다시 만든다 */
  const rerollRequest = async () => { await page.evaluate(() => { if (window.__chat.message.at(-1)?.role === 'char') window.__chat.message.pop(); }); return sendExisting(); };
  const saveState = async (s) => {
    const v = await vars();
    const w = J(v.$goei_world);
    const jr = J(v.$goei_journal);
    const prev = J(v.$goei_prev);
    writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({
      faction: v.$st_faction, affiliation: v.$ib_affiliation,
      world: w && { epoch: w.epoch, minute: w.minute, an: w.an.map((e) => `${e.loc}|${e.name || '(이름없음)'}|${e.state}|${e.origin}|${e.grade}|배치:${e.deploy}|${e.situation ?? ''}`), inc: w.inc.map((e) => `${e.loc}|${e.name}|${e.state}|${e.origin}`), ms: w.ms.map((e) => `${e.loc}|${e.name}|${e.state}|${e.origin}`), agents: w.agents, retired: w.retired, promoted: w.promoted, ended: w.ended, blocks: w.blocks, pending: w.pending, notice: w.notice, cleared: w.cleared },
      reports: { an: v.$an_report, in: v.$in_report, ms: v.$ms_report, ag: v.$ag_report },
      journal: jr?.rows?.map((r) => `${r.kind}|${r.name}|${r.cause}|${r.loc ?? ''}`) ?? jr,
      prev: prev && { i: prev.i, faction: prev.faction, made: prev.made, world: (() => { const p = J(prev.world); return p && { an: p.an.map((e) => `${e.name}|${e.state}`), ms: p.ms.map((e) => `${e.name}|${e.state}`) }; })() },
      messages: (await chat()).message.map((m) => ({ role: m.role, data: String(m.data).slice(0, 400) })),
    }, null, 2));
  };
  const start = async (fac = 'A00', fm = 2, player) => {
    await openWin(page); await sleep(400);
    await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`).click(), fac); await sleep(300);
    if (player) { await page.evaluate((p) => document.querySelector(`.gx-whoc[data-action="player"][data-value="${p}"]`)?.click(), player); await sleep(300); }
    await page.evaluate((v) => document.querySelector(`.gx-sc[data-value="${v}"]`).click(), String(fm)); await sleep(300);
    await page.evaluate(() => document.querySelector('.gx-start')?.click());
    await sleep(1800);
    await closeWin(page).catch(() => {});
  };
  const open = async (tab) => {
    // 창을 닫았다 다시 연다 (열린 채로는 응답이 붙어도 다시 그리지 않는 틀 — 실제 리수는 응답 때 다시 그림)
    await closeWin(page).catch(() => {});
    await openWin(page); await sleep(500);
    if (tab) { if (!(await act('tab', tab, 600))) await act('nav-tab', tab, 600); }
  };
  return { page, errors, chat, vars, world, journal, llm, act, winText, html, sendExisting, mainSend, botReply, rerollRequest, saveState, start, open, J };
}
const statusOf = async (S) => (await S.page.evaluate(() => ({ cards: [...document.querySelectorAll('.gx-board .gx-oprow')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()), cnt: document.querySelector('.gx-board .gx-opcnt')?.innerText.replace(/\s+/g, ' ') ?? '', agents: [...document.querySelectorAll('.gx-board .gx-agmon, .gx-board .gx-agrow')].map((e) => `${e.dataset.value}:${e.className.split(' ').pop()}:${e.innerText.replace(/\s+/g, ' ').trim().slice(0, 60)}`), hint: [...document.querySelectorAll('.gx-board .gx-hint')].map((e) => e.innerText) })));

// 무작위 괴이(이름 없는 자리)·프리셋·특수: 시작 추첨이 씨앗 고정으로 늘 같다 (부산 북구 무작위 · 인천 서구 어두운 정원 · 부산 연제구 얼굴 없는 장터 맨홀)
const T1 = { date: '2025.03.14', time: '10:00 AM' };
const R1 = FAKE(1, ST(T1.date, T1.time, '관리국 본부'), [
  '[AN|부산광역시 북구|가짜괴이|활성|C|P004|역사 안에서 기침 소리가 들린다]',
  '[AN|인천광역시 서구|어두운 정원|활성|B|없음|울타리 너머로 사람이 사라졌다]',
  '[MS|부산광역시 연제구|얼굴 없는 장터 맨홀|출현|없음|맨홀 뚜껑이 열려 있다]',
  '[AG|P001|내근|면접 정리]', '[AG|P002|휴게|휴게실]', '[AG|P003|외근|순찰]', '[AG|P004|작전투입|부산 북구로 출동]',
  '[AG|P005|비번|집]', '[AG|P006|내근|서류]', '[AG|P007|사망|교전 중 사망]', '[AG|P008|부상|치료 중]',
  '[AG|P009|실종|연락 끊김]', '[AG|P010|내근|교육]', '[AG|P011|내근|회의]', '[AG|P012|내근|연구실]',
]);

// ════════ A: 상황판 대표 경로 (PC, 화면 단추) ════════
if (want('A')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('A01', '시작_첫요청_상황판');
  await S.start('A00', 2);
  const out1 = await S.mainSend('복도를 따라 걷는다.', 'u1');
  writeReq(s, out1);
  const e1 = entries(out1);
  check(s, '첫 요청: 발생대기 NEW 줄(괴이 2·특수 1)이 그대로 감 (사용자 11-22 21:42 「빼지 않음」)', e1.an?.filter((l) => l.startsWith('NEW')).length === 2 && e1.ms?.filter((l) => l.startsWith('NEW')).length === 1, 'NEW AN 2 · NEW MS 1', e1);
  check(s, '첫 요청: 요원 12명 NEW AG 줄 + code 목록', e1.ag?.filter((l) => l.startsWith('NEW [AG')).length === 12 && e1.ag?.some((l) => l.startsWith('- code: P001')), '12줄', e1.ag?.length);
  check(s, '플러그인 표식 안 샘', leaked(out1).length === 0, [], leaked(out1));
  await S.open('board');
  let bd = await statusOf(S);
  check(s, '상황판: 발생대기는 안 띄움(카드 0), 숫자 괴이0 사건0 특수0 (2026-10-20 사용자)', bd.cards.length === 0 && /괴이\s*0/.test(bd.cnt), '카드 0', bd);
  check(s, '상황판 요원 칸 12명, 상태 미정', bd.agents.length === 12, 12, bd.agents.length);
  info(s, '보조 호출 수', await S.llm());
  await S.saveState(s);

  s = step('A02', '첫응답_태그반영');
  await S.botReply(R1, 'c1');
  const w2 = await S.world();
  check(s, '괴이 2 활성·특수 1 출현', w2.an.filter((e) => ['가짜괴이', '어두운 정원'].includes(e.name)).every((e) => e.state === '활성') && w2.an.filter((e) => e.state === '활성').length === 2 && w2.ms[0]?.state === '출현', '활성·출현', w2.an.map((e) => `${e.name}:${e.state}`).concat(w2.ms.map((e) => `${e.name}:${e.state}`)));
  check(s, '무작위 괴이가 모델이 준 이름(가짜괴이)으로', w2.an.some((e) => e.name === '가짜괴이' && e.kind === 'random'), '가짜괴이', w2.an.map((e) => e.name));
  check(s, '요원 상태 반영 (P004 작전투입, P007 사망)', w2.agents.P004?.st === '작전투입' && w2.agents.P007?.st === '사망', 'P004 작전투입 · P007 사망', { P004: w2.agents.P004, P007: w2.agents.P007 });
  const saved = (await S.chat()).message.at(-1).data;
  check(s, '저장 본문에서 상황판 태그는 지워지고 상태창은 맨 끝', !/\[(AN|IN|MS|AG)\|/.test(saved) && /\[▣\|[^\n]*\]$/.test(saved), '태그 없음', saved);
  await S.open('board');
  bd = await statusOf(S);
  writeFileSync(`${OUT}화면A02_상황판.txt`, JSON.stringify(bd, null, 2));
  check(s, '상황판 카드 3장(가짜괴이·어두운 정원·얼굴 없는 장터 맨홀)', bd.cards.length === 3, 3, bd.cards);
  check(s, '숫자: 괴이2 사건0 특수1', /괴이\s*2/.test(bd.cnt) && /특수\s*1/.test(bd.cnt), '괴이2 특수1', bd.cnt);
  check(s, '요원 칸: P004 작전(op)·P007·P009 잠김(lock)', bd.agents.some((a) => a.startsWith('P004:op')) && bd.agents.some((a) => a.startsWith('P007:lock')) && bd.agents.some((a) => a.startsWith('P009:lock')), 'P004 op · P007/P009 lock', bd.agents);
  const p004 = bd.agents.find((a) => a.startsWith('P004')) ?? '';
  check(s, 'P004 카드에 투입된 상황 이름(가짜괴이) 또는 상황 글', /가짜괴이|부산 북구로 출동/.test(p004), '가짜괴이', p004);
  await S.saveState(s);

  s = step('A03', '둘째요청_진행중줄');
  const out2 = await S.mainSend('보고서를 읽는다.', 'u2');
  writeReq(s, out2);
  const e2 = entries(out2);
  check(s, '둘째 요청: 채운 줄은 진행 중 줄로(괴이 2·특수 1), NEW 는 이번 응답에서 새로 뽑힌 것만', e2.an?.filter((l) => l.startsWith('[AN|')).length === 2 && e2.ms?.filter((l) => l.startsWith('[MS|')).length === 1 && !e2.an.some((l) => l.startsWith('NEW') && /가짜괴이|어두운 정원/.test(l)), 'AN 2 · MS 1', e2);
  check(s, '진행 중 줄에 {N시간 N분 전}·{유지 기한 …} (지침 World Entries 절)', e2.an?.filter((l) => l.startsWith('[')).every((l) => /\{0시간 0분 전\}/.test(l) && /\{유지 기한 03\.16 10:00\}/.test(l)), '{0시간 0분 전} {유지 기한 03.16 10:00}', e2.an);
  check(s, 'AG 줄 12개 상태대로, NEW 없음', e2.ag?.filter((l) => l.startsWith('[AG|')).length === 12 && !e2.ag?.some((l) => l.startsWith('NEW')), 12, e2.ag);
  check(s, '지난 응답(history)에 상황판 태그가 안 남음', !out2.some((m) => m.role === 'assistant' && /\[(AN|MS|AG)\|/.test(m.content)), '없음', out2.filter((m) => m.role === 'assistant').map((m) => m.content.slice(0, 120)));
  await S.saveState(s);

  // 응답 2: 시간 30분 흐름, 상황 글 갱신
  const R2 = FAKE(2, ST(T1.date, '10:30 AM', '관리국 본부'), [
    '[AN|부산광역시 북구|가짜괴이|활성|C|P004|역사 승강장까지 번졌다]',
    '[AN|인천광역시 서구|어두운 정원|활성|B|없음|울타리 너머로 사람이 사라졌다]',
    '[MS|부산광역시 연제구|얼굴 없는 장터 맨홀|출현|없음|맨홀 뚜껑이 열려 있다]',
    '[AG|P004|작전투입|승강장 진입]', '[AG|P007|사망|교전 중 사망]',
  ]);
  await S.botReply(R2, 'c2');

  s = step('A04', '상황판카드_지도열기');
  await S.open('board');
  // CCTV 줄 → 큰 보기 → 그 카드의 지도 열기
  const wA = await S.world();
  const msKey = `ms|${wA.ms[0].loc}|${wA.ms[0].name}|${wA.ms[0].born ?? ''}`;
  await S.act('ops-sel', msKey);
  // 상황판 큰 보기 가운데 과녁(pick-event): 목표로 고르고 임무 지도로 (app.ts:1166 2026-10-21 사용자)
  const opened = await S.act('pick-event', msKey, 2300);
  const mapTxt = await S.winText();
  const onMap = await S.page.evaluate(() => !!document.querySelector('.gx-field:not(.gx-mission)'));
  check(s, '상황판 과녁 → 임무(지도) 탭, 그 지역(부산) 지도와 그 장소가 목표', opened && onMap && /부산/.test(mapTxt) && /얼굴 없는 장터 맨홀/.test(mapTxt), '부산 지도 + 맨홀 목표', { opened, onMap, mapTxt: mapTxt.slice(0, 400) });
  await S.act('pick-event', msKey, 1500); // 다시 눌러 목표 풀기
  await S.saveState(s);

  s = step('A05', '상황종료_수동');
  await S.open('board');
  await S.act('ops-sel', msKey);
  const first = await S.act('end-event', msKey, 400);
  const confirmShown = (await S.winText()).includes('정말 종료');
  await S.act('end-event', msKey, 900);
  const w5 = await S.world();
  const jr5 = await S.journal();
  check(s, '두 번 눌러 종료(첫 번은 확인만)', first && confirmShown, '정말 종료 표시', { first, confirmShown });
  check(s, '특수가 상황판에서 빠지고 막 끝난 목록(ended)에 남음', w5.ms.length === 0 && w5.ended.some((e) => e.name === '얼굴 없는 장터 맨홀'), 'ms 0 · ended 1', { ms: w5.ms, ended: w5.ended });
  check(s, '일지에 직접 종료 1줄', (jr5?.rows ?? []).filter((r) => r.name === '얼굴 없는 장터 맨홀' && r.cause === 'manual').length === 1, 1, jr5?.rows?.map((r) => `${r.name}|${r.cause}`));
  bd = await statusOf(S);
  check(s, '상황판에 종료 카드(흐림)·숫자 특수0', bd.cards.some((c) => /얼굴 없는 장터 맨홀/.test(c) && /종료/.test(c)) && /특수\s*0/.test(bd.cnt), '종료 카드', bd);
  const prev5 = S.J((await S.vars()).$goei_prev);
  const prevW = S.J(prev5?.world);
  info(s, '리롤 기준($goei_prev.world)의 특수 상태', prevW?.ms?.map((e) => `${e.name}|${e.state}`));
  await S.saveState(s);

  s = step('A06', '수동종료_다음요청');
  const out6 = await S.mainSend('맨홀 건은 끝났다고 들었다.', 'u3');
  writeReq(s, out6);
  const e6 = entries(out6);
  check(s, '다음 요청: 끝낸 특수 줄 없음', !(e6.ms ?? []).some((l) => l.includes('얼굴 없는 장터 맨홀')), '없음', e6.ms);
  const closureSaid = /얼굴 없는 장터 맨홀/.test(allText(out6).replace(/맨홀 건은 끝났다고 들었다\./, ''));
  check(s, '지침 「Reflect closures reported in World Entries」: 끝난 항목이 요청 어디엔가 알려지나', closureSaid, '끝난 항목 이름이 어딘가에', closureSaid);
  await S.saveState(s);

  // 응답 3: 모델이 (앞 장면 글만 보고) 끝낸 특수를 다시 적음
  s = step('A07', '끝낸특수를_모델이_다시적음');
  const R3 = FAKE(3, ST(T1.date, '10:40 AM', '관리국 본부'), [
    '[AN|부산광역시 북구|가짜괴이|활성|C|P004|승강장]', '[AN|인천광역시 서구|어두운 정원|활성|B|없음|정원]',
    '[MS|부산광역시 연제구|얼굴 없는 장터 맨홀|출현|없음|맨홀 뚜껑이 열려 있다]',
  ]);
  await S.botReply(R3, 'c3');
  const w7 = await S.world();
  check(s, '방금 손으로 끝낸 특수가 다시 등록되지 않음 (지침 「do not revive closed entries」, 사건(IN)은 이름 막기로 막음 — engine.ts applyIncidents)', !w7.ms.some((e) => e.name === '얼굴 없는 장터 맨홀'), '다시 안 생김', w7.ms.map((e) => `${e.name}|${e.state}|${e.origin}`));
  await S.saveState(s);

  // 응답 3 다시 굴리기: 다시 굴린 요청엔 직접 종료가 그대로?
  s = step('A08', '응답3_다시굴리기');
  const out8 = await S.rerollRequest();
  writeReq(s, out8);
  const e8 = entries(out8);
  check(s, '다시 굴린 요청: 손으로 끝낸 특수가 되살아나지 않음 (output.ts prevWorldVars 주석)', !(e8.ms ?? []).some((l) => l.includes('얼굴 없는 장터 맨홀')), '없음', e8.ms);
  await S.botReply(FAKE('3b', ST(T1.date, '10:40 AM', '관리국 본부'), ['[AN|부산광역시 북구|가짜괴이|활성|C|P004|승강장]', '[AN|인천광역시 서구|어두운 정원|활성|B|없음|정원]']), 'c3b');
  const w8 = await S.world();
  check(s, '새 답 뒤: 끝낸 특수 없음, 일지 직접 종료 줄 1개 그대로', !w8.ms.some((e) => e.name === '얼굴 없는 장터 맨홀') && ((await S.journal())?.rows ?? []).filter((r) => r.name === '얼굴 없는 장터 맨홀').length === 1, 'ms 0 · 일지 1', { ms: w8.ms, jr: (await S.journal())?.rows?.map((r) => `${r.name}|${r.cause}`) });
  await S.saveState(s);

  // 시간 건너뛰기: 이틀 뒤 → 유지 기한 지난 괴이는 기한 시각으로 끝남
  s = step('A09', '시간건너뛰기_기한종료');
  await S.mainSend('이틀 뒤.', 'u4');
  await S.botReply(FAKE(4, ST('2025.03.16', '02:00 PM', '관리국 본부')), 'c4');
  const w9 = await S.world();
  const jr9 = await S.journal();
  check(s, '유지 기한(48시간) 지난 괴이 2개가 끝남 (모델이 안 끝내도 플러그인이 기한에)', w9.an.filter((e) => e.state === '활성').length === 0, '활성 0', w9.an.map((e) => `${e.name}|${e.state}`));
  const ttl = (jr9?.rows ?? []).filter((r) => r.cause === 'ttl');
  check(s, '일지 기한 종료 줄: 괴이 2 + (손으로 끝낸 특수는 제외)', ttl.length === 2 && !ttl.some((r) => r.name === '얼굴 없는 장터 맨홀'), 2, jr9?.rows?.map((r) => `${r.name}|${r.cause}`));
  info(s, '기한 종료 시각(일지 줄 원문)', ttl.map((r) => JSON.stringify(r).slice(0, 300)));
  bd = await statusOf(S);
  writeFileSync(`${OUT}화면A09_상황판.txt`, JSON.stringify(bd, null, 2));
  await S.saveState(s);

  s = step('A10', '모델이_괴이를_격리로끝냄');
  const wb = await S.world();
  const live = wb.an.filter((e) => e.state !== '발생대기');
  const pend = wb.an.find((e) => e.state === '발생대기');
  const out10 = await S.mainSend('다음 상황을 확인한다.', 'u5');
  writeReq(s, out10);
  info(s, '이 턴 요청의 World Entries', entries(out10));
  // 새로 뜬 대기 줄을 채우고, 다음 턴에 격리로 끝낸다
  const nw = entries(out10).an?.find((l) => l.startsWith('NEW')) ?? '';
  const m = /NEW \[AN\|([^|]+)\|([^|]+)\|/.exec(nw);
  if (m) {
    const name = m[2].startsWith('<') ? '가짜괴이둘' : m[2];
    await S.botReply(FAKE(5, ST('2025.03.16', '02:30 PM', '관리국 본부'), [`[AN|${m[1]}|${name}|활성|D|없음|막 나타남]`]), 'c5');
    await S.mainSend('그곳으로 간다.', 'u6');
    await S.botReply(FAKE(6, ST('2025.03.16', '04:00 PM', '관리국 본부'), [`[AN|${m[1]}|${name}|격리|D|없음|격리 완료 (종료 03.16 03:10)]`]), 'c6');
    const w10 = await S.world();
    const row = ((await S.journal())?.rows ?? []).find((r) => r.name === name);
    check(s, '격리 태그로 끝남, 일지 model 줄', !w10.an.some((e) => e.name === name) && row?.cause === 'model', 'model 종료', { an: w10.an.map((e) => e.name), row: row && JSON.stringify(row).slice(0, 300) });
  } else info(s, '새 대기 괴이 없음(추첨 결과)', nw);
  info(s, '보조 호출 수(인물 기록 등 다른 기능 몫, 상황판은 안 부름)', await S.llm());
  check(s, '페이지 오류 없음', S.errors.length === 0, [], S.errors);
  await S.saveState(s);
  void live; void pend;
  await S.page.close();
}

// ════════ R: 수동 종료 → 그 항목을 처음 띄운 응답을 다시 굴림 ════════
if (want('R')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('R01', '첫응답_뒤_특수_수동종료');
  await S.start('A00', 2);
  await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  const w = await S.world();
  const key = `ms|${w.ms[0].loc}|${w.ms[0].name}|${w.ms[0].born ?? ''}`;
  await S.open('board');
  await S.act('ops-sel', key);
  await S.act('end-event', key, 400);
  await S.act('end-event', key, 900);
  const w1 = await S.world();
  check(s, '특수 종료됨, 일지 직접 종료 1줄', !w1.ms.length && ((await S.journal())?.rows ?? []).some((r) => r.cause === 'manual'), '종료', w1.ms);
  const prevW = S.J(S.J((await S.vars()).$goei_prev)?.world);
  info(s, '리롤 기준의 특수(이 응답 전 상태: 발생대기였음)', prevW?.ms?.map((e) => `${e.name}|${e.state}`));
  await S.saveState(s);

  s = step('R02', '첫응답_다시굴림_요청');
  const out = await S.rerollRequest();
  writeReq(s, out);
  const e = entries(out);
  check(s, '다시 굴린 요청에 손으로 끝낸 특수가 다시 NEW 로 오지 않음 (output.ts prevWorldVars: 손으로 바꾼 것을 리롤 기준에도 반영, journal/store.ts:119 「수동 종료는 되살아나지 않으므로 일지 줄을 둔다」)', !(e.ms ?? []).some((l) => l.includes('얼굴 없는 장터 맨홀')), '없음', e.ms);
  await S.saveState(s);

  s = step('R03', '다시굴린_답_반영');
  await S.botReply(R1.replace('【가짜 응답 1】', '【가짜 응답 1-다시】'), 'c1b');
  const w3 = await S.world();
  const rows = (await S.journal())?.rows ?? [];
  check(s, '새 답 뒤: 특수가 상황판에 없음(손으로 끝냄 유지)', !w3.ms.some((x) => x.name === '얼굴 없는 장터 맨홀'), '없음', w3.ms.map((x) => `${x.name}|${x.state}`));
  check(s, '일지와 상황판이 같은 말 (일지 「직접 종료」인데 상황판 「출현」이면 어긋남)', !(rows.some((r) => r.name === '얼굴 없는 장터 맨홀' && r.cause === 'manual') && w3.ms.some((x) => x.name === '얼굴 없는 장터 맨홀' && x.state === '출현')), '어긋나지 않음', { rows: rows.map((r) => `${r.name}|${r.cause}`), ms: w3.ms.map((x) => `${x.name}|${x.state}`) });
  await S.open('board');
  const bd = await statusOf(S);
  writeFileSync(`${OUT}화면R03_상황판.txt`, JSON.stringify(bd, null, 2));
  await S.saveState(s);
  await S.page.close();
}

// ════════ B: 요원 (사망 → 결번 충원, 이름으로 적은 태그, 소속 바뀜 [AC], 표시 인원) ════════
if (want('B')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('B01', '사망_결번충원');
  await S.start('A00', 2);
  const refill = await S.page.evaluate(() => { try { return JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory' || e.comment === '괴이봇 명부')?.content ?? '{}').refill; } catch { return 'parse'; } });
  info(s, '명부 refill(사망 뒤 결번까지 응답 수)', refill);
  await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  let n = 1;
  let w = await S.world();
  while (!w.retired.includes('P007') && n < 6) {
    n += 1;
    await S.mainSend(`턴 ${n}.`, `u${n}`);
    await S.botReply(FAKE(n, ST(T1.date, `10:${String(n * 5).padStart(2, '0')} AM`, '관리국 본부'), ['[AG|P007|사망|교전 중 사망]']), `c${n}`);
    w = await S.world();
  }
  check(s, `P007 결번 처리(사망 태그 응답 ${n}번 뒤)`, w.retired.includes('P007'), 'retired P007', { retired: w.retired, promoted: w.promoted, n });
  await S.open('board');
  let bd = await statusOf(S);
  writeFileSync(`${OUT}화면B01_상황판.txt`, JSON.stringify(bd, null, 2));
  const reserve = await S.page.evaluate(() => { try { const d = JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content); return (d.agents ?? []).filter((a) => (a.rosterFor ?? []).includes('A00')).length; } catch { return 'parse'; } });
  info(s, '명부에서 관리국 목록에 보이는 요원 수(12 넘으면 예비 인원이 있음)', reserve);
  check(s, '상황판 요원 칸: P007 빠짐 (예비가 있으면 충원 안내)', !bd.agents.some((a) => a.startsWith('P007')) && (w.promoted.length ? bd.hint.some((h) => h.includes('결번 충원')) : bd.agents.length === 11), 'P007 없음', bd);
  const out = await S.mainSend('다음 턴.', 'ub1');
  writeReq(s, out);
  const e = entries(out);
  const newbie = w.promoted[0]?.split('(')[0];
  check(s, '다음 요청: code 목록에 P007 없음, 새 요원 NEW [AG|…] 줄', !e.ag.some((l) => l.includes('P007')) && (!newbie || e.ag.some((l) => l.startsWith(`NEW [AG|${newbie}|`))), `P007 없음 · NEW ${newbie}`, e.ag);
  await S.saveState(s);
  // 충원 안내는 다음 응답 뒤 사라짐
  await S.botReply(FAKE(9, ST(T1.date, '11:00 AM', '관리국 본부')), 'cb1');
  bd = await statusOf(S);
  info(s, '한 응답 더 뒤 충원 안내', bd.hint);

  s = step('B02', '이름으로_적은_AG태그');
  await S.mainSend('에일린을 부른다.', 'ub2');
  await S.botReply(FAKE(10, ST(T1.date, '11:10 AM', '관리국 본부'), ['[AG|에일린|외근|현장 지원]', '[AG|Kyuras|부상|팔 골절]']), 'cb2');
  w = await S.world();
  check(s, '이름(에일린)·영문명(Kyuras)으로 적어도 그 요원 상태로', w.agents.P004?.st === '외근' && w.agents.P006?.st === '부상', 'P004 외근 · P006 부상', { P004: w.agents.P004, P006: w.agents.P006 });
  await S.saveState(s);

  s = step('B03', '배치칸_구분자');
  await S.mainSend('출동 현황.', 'ub3');
  await S.botReply(FAKE(11, ST(T1.date, '11:20 AM', '관리국 본부'), ['[AN|부산광역시 북구|가짜괴이|활성|C|P003/P005|역사]', '[AG|P003|작전투입|부산 북구]', '[AG|P005|작전투입|부산 북구]']), 'cb3');
  await S.open('board');
  bd = await statusOf(S);
  const a3 = bd.agents.find((a) => a.startsWith('P003')) ?? '';
  info(s, '배치 칸 「P003/P005」(태그 읽기는 / 도 코드 목록으로 봄 — tags.ts DEPLOY_ONLY)일 때 요원 카드의 투입 상황', a3);
  const cardTxt = bd.cards.find((c) => c.includes('가짜괴이')) ?? '';
  info(s, '상황판 카드의 배치 칩', cardTxt);
  await S.saveState(s);

  s = step('B04', '소속바뀜_AC');
  await S.mainSend('백일몽으로 옮긴다.', 'ub4');
  const rAC = FAKE(12, ST(T1.date, '11:30 AM', '백일몽 본사', '없음', '백일몽/사원'), ['[AG|P001|내근|송별회]', '[AC|C00]']);
  await S.botReply(rAC, 'cb4');
  const v4 = await S.vars();
  w = await S.world();
  check(s, '소속이 C00 으로, $ib_affiliation 백일몽', v4.$st_faction === 'C00' && /백일몽/.test(v4.$ib_affiliation), 'C00 · 백일몽', { f: v4.$st_faction, aff: v4.$ib_affiliation });
  check(s, '바뀌기 전 명단 기준으로 P001 태그를 먼저 반영', w.agents.P001?.situation === '송별회', '송별회', w.agents.P001);
  await S.open('board');
  bd = await statusOf(S);
  writeFileSync(`${OUT}화면B04_상황판.txt`, JSON.stringify(bd, null, 2));
  check(s, '상황판 요원 칸이 백일몽 명단으로 바뀜(P001 없음)', bd.agents.length > 0 && !bd.agents.some((a) => a.startsWith('P001:')), '백일몽 명단', bd.agents);
  const out4 = await S.mainSend('새 사무실을 둘러본다.', 'ub5');
  writeReq(s, out4);
  const e4 = entries(out4);
  check(s, '다음 요청: AG code 목록이 백일몽 명단, 현재 소속 줄 C00', !e4.ag.some((l) => /P001 쟈알디/.test(l)) && /current affiliation: [^\n]*\(Code: C00\)/.test(allText(out4)), '백일몽 명단 · C00', { ag: e4.ag, aff: /current affiliation: [^\n]*/.exec(allText(out4))?.[0] });
  await S.saveState(s);

  s = step('B05', 'AC응답_다시굴리기');
  await S.page.evaluate(() => { window.__chat.message.pop(); }); // 방금 넣은 유저 글 빼고
  const outR = await S.rerollRequest();
  writeReq(s, outR);
  const eR = entries(outR);
  check(s, '다시 굴린 요청: 소속이 관리국(A00)으로 되감김, 명단도 관리국', /current affiliation: [^\n]*\(Code: A00\)/.test(allText(outR)) && eR.ag.some((l) => /P002 스팡달/.test(l)), 'A00', { aff: /current affiliation: [^\n]*/.exec(allText(outR))?.[0], ag: eR.ag?.slice(-1) });
  await S.botReply(FAKE('12b', ST(T1.date, '11:30 AM', '관리국 본부'), ['[AG|P001|내근|그대로 근무]']), 'cb4b');
  const v5 = await S.vars();
  check(s, '[AC] 없는 새 답 뒤 소속 A00 · 관리국', v5.$st_faction === 'A00' && v5.$ib_affiliation === '관리국', 'A00', { f: v5.$st_faction, aff: v5.$ib_affiliation, pick: v5.$st_pick });
  await S.saveState(s);

  s = step('B06', '표시인원_설정3');
  // 설정 창 → 기능 → 요원 표시 인원 (set-agent) 을 3 으로
  await S.open('settings');
  const hid = async (action, value) => { await S.page.evaluate(({ action, value }) => { const el = document.createElement('button'); el.dataset.action = action; el.dataset.value = value; el.style.display = 'none'; (document.querySelector('.gx .gx-body') || document.querySelector('.gx')).appendChild(el); el.click(); el.remove(); }, { action, value }); await sleep(900); };
  const stepper = await S.page.evaluate(() => !!document.querySelector('.gx [data-action="set-agent"]'));
  info(s, '설정 화면에 요원 표시 인원 단추가 보임', stepper);
  await hid('set-agent', '3');
  info(s, '설정 뒤 $st_agent_limit', (await S.vars()).$st_agent_limit);
  await S.open('board');
  bd = await statusOf(S);
  const out6 = await S.mainSend('요원 셋만.', 'ub6');
  writeReq(s, out6);
  const e6 = entries(out6);
  check(s, '설정 3명: 상황판 3명, 요청 AG 줄 3 + code 3', bd.agents.length === 3 && e6.ag.filter((l) => /^(NEW )?\[AG\|/.test(l)).length === 3, 3, { board: bd.agents.length, ag: e6.ag });
  await S.botReply(FAKE(13, ST(T1.date, '11:40 AM', '관리국 본부'), ['[AG|P010|부상|넘어짐]']), 'cb6');
  w = await S.world();
  info(s, '명단 밖(4번째 뒤) 요원 태그 P010 은 버림', w.agents.P010);
  await S.open('settings');
  await hid('set-agent', '0');
  await S.open('board');
  bd = await statusOf(S);
  const out7 = await S.mainSend('요원 없음.', 'ub7');
  const e7 = entries(out7);
  check(s, '설정 0명: 상황판 안내, 요청 code: none', (await S.winText()).includes('0명') && e7.ag.some((l) => l.includes('code: none')), 'none', e7.ag);
  check(s, '오류 없음', S.errors.length === 0, 0, { err: S.errors });
  await S.saveState(s);
  await S.page.close();
}

// ════════ C: 지도 (PC) — 지역·장소·상황 고르기·편성 잠금·출발 카드 ════════
if (want('C')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('C01', '지도_전국핀_숫자');
  await S.start('A00', 2);
  await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  await S.open('map');
  const pins = await S.page.evaluate(() => [...document.querySelectorAll('.gx-pin.gx-plab')].map((e) => `${e.dataset.value}:${e.innerText.replace(/\s+/g, '')}:${/hot/.test(e.className) ? 'hot' : ''}`));
  info(s, '전국 핀', pins.filter((p) => p.includes('hot')));
  const busan = pins.find((p) => p.includes('부산'));
  check(s, '부산 핀에 진행 중 2개(가짜괴이·맨홀) 숫자', /2/.test(busan ?? '') && busan?.endsWith('hot'), '부산 2', busan);
  await S.saveState(s);

  s = step('C02', '지역_장소_상황고르기');
  const busanCode = busan.split(':')[0];
  await S.act('map-region', busanCode, 600);
  const sig = await S.page.evaluate(() => [...document.querySelectorAll('.gx-pin.gx-plab.hot')].map((e) => `${e.dataset.value}:${e.innerText.replace(/\s+/g, '')}`));
  check(s, '부산 지도: 북구·연제구 핀이 뜨거움', sig.length >= 2, '2곳', sig);
  const w = await S.world();
  const anB = w.an.find((e) => e.name === '가짜괴이');
  await S.act('map-place', anB.loc, 600);
  const list = await S.page.evaluate(() => [...document.querySelectorAll('.gx-field .gx-evc, .gx-field .gx-ev')].map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 80)));
  check(s, '북구를 누르면 목록이 그 자리 상황(가짜괴이)으로 좁혀짐', list.some((t) => t.includes('가짜괴이')) && !list.some((t) => t.includes('맨홀')), '가짜괴이만', list);
  const key = `an|${anB.loc}|${anB.name}|${anB.born ?? ''}`;
  let picked = await S.act('pick-event', key, 2300);
  if (!picked) { await S.page.evaluate((k) => { const el = document.createElement('button'); el.dataset.action = 'pick-event'; el.dataset.value = k; el.style.display = 'none'; document.querySelector('.gx .gx-body').appendChild(el); el.click(); el.remove(); }, key); await sleep(900); }
  info(s, 'pick-event 화면 단추 유무', picked);
  await S.saveState(s);

  s = step('C03', '편성_잠긴요원');
  const tiles = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="team-toggle"]')].map((e) => `${e.dataset.value}:${e.disabled || e.getAttribute('aria-disabled') === 'true' || /lock|off|dis/.test(e.className) ? 'locked' : 'ok'}`));
  writeFileSync(`${OUT}화면C03_편성.txt`, JSON.stringify(tiles, null, 2));
  check(s, '편성 목록: P004(작전투입)·P007(사망)·P009(실종) 잠김', ['P004', 'P007', 'P009'].every((id) => tiles.some((t) => t === `${id}:locked`)), '셋 잠김', tiles);
  await S.act('team-toggle', 'P007', 300);
  await S.act('team-toggle', 'P002', 300);
  await S.act('team-toggle', 'P003', 300);
  const team = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="team-toggle"][aria-pressed="true"], .gx [data-action="team-toggle"].on')].map((e) => e.dataset.value));
  check(s, '사망 요원은 눌러도 안 들어가고 P002·P003 은 들어감', !team.includes('P007') && team.includes('P002') && team.includes('P003'), 'P002·P003', team);
  await S.saveState(s);

  s = step('C04', '출발_카드');
  const n0 = (await S.chat()).message.length;
  const went = await S.act('depart', undefined, 1500);
  const c = await S.chat();
  const card = c.message.at(-1);
  check(s, '출발 → 채팅 끝에 지시문 카드 하나(목표 가짜괴이, 투입 나·스팡달·잼트리)', went && c.message.length === n0 + 1 && /가짜괴이/.test(card.data) && /스팡달/.test(card.data) && /잼트리/.test(card.data), '카드', { went, data: String(card?.data).slice(0, 500) });
  const out = await S.sendExisting();
  writeReq(s, out);
  check(s, '본편 요청: Subject 가짜괴이 · Companions 스팡달·잼트리, 표식 안 샘', /Subject: [^\n]*가짜괴이/.test(allText(out)) && /Companions: [^\n]*스팡달/.test(allText(out)) && leaked(out).length === 0, 'Subject·Companions', { subj: /Subject: [^\n]*/.exec(allText(out))?.[0], comp: /Companions: [^\n]*/.exec(allText(out))?.[0], leaked: leaked(out) });
  // 출발한 요원은 상황판에서 무엇으로 보이나 (모델이 AG 태그를 줄 때까지)
  await S.botReply(FAKE(2, ST(T1.date, '10:30 AM', '부산광역시 북구', '가짜괴이'), ['[AN|부산광역시 북구|가짜괴이|활성|C|P004|현장 도착]']), 'c2');
  const w4 = await S.world();
  info(s, '응답이 AG 태그를 안 준 경우 출동한 P002·P003 상태', { P002: w4.agents.P002, P003: w4.agents.P003 });
  check(s, '상태창 목표 칸(가짜괴이) → 그 괴이 탐사 중 표시', w4.an.find((e) => e.name === '가짜괴이')?.exploring === true, 'exploring', w4.an.map((e) => `${e.name}|${e.exploring}`));
  await S.saveState(s);

  s = step('C05', '빈장소_출발');
  await S.open('map');
  await S.act('map-region', '01', 400);
  await S.act('map-region', busanCode, 600);
  // 상황 없는 시군구 하나
  const empty = await S.page.evaluate(() => [...document.querySelectorAll('.gx-pin.gx-plab:not(.hot):not(.fac):not(.sealed)')].map((e) => e.dataset.value)[0]);
  await S.act('map-place', empty, 600);
  const tgt = await S.winText();
  info(s, `빈 시군구(${empty}) 누름 뒤 화면`, tgt.slice(0, 300));
  await S.saveState(s);
  check(s, '오류 없음', S.errors.length === 0, [], S.errors);
  await S.page.close();
}

// ════════ P: 폰 크기 — 상황판 카드 → 지도 → 편성 → 출발 / 상황 종료 ════════
if (want('P')) {
  const S = await session({ message: [], scriptstate: {} }, 'phone');
  let s = step('P01', '폰_상황판');
  await S.start('A00', 2);
  await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  await S.open('board');
  const bd = await statusOf(S);
  writeFileSync(`${OUT}화면P01_폰상황판.txt`, JSON.stringify(bd, null, 2));
  check(s, '폰 상황판: 카드 3장·요원 12', bd.cards.length === 3 && bd.agents.length === 12, '3·12', { c: bd.cards.length, a: bd.agents.length });
  await S.page.screenshot({ path: `${OUT}화면P01_폰상황판.png` });
  s = step('P02', '폰_카드_지도_편성_출발');
  const w = await S.world();
  const anB = w.an.find((e) => e.name === '가짜괴이');
  const key = `an|${anB.loc}|${anB.name}|${anB.born ?? ''}`;
  await S.act('ops-sel', key, 500);
  const toMap = await S.act('pick-event', key, 2300);
  const st1 = await S.page.evaluate(() => document.querySelector('.gx-field')?.dataset.step ?? '');
  // 폰은 지도(목표) 단계를 먼저 보여 주고 위 「편성」으로 넘어간다 (app.ts:1172)
  const picked = await S.act('field-step', 'team', 700);
  const st2 = await S.page.evaluate(() => document.querySelector('.gx-field')?.dataset.step ?? '');
  await S.act('team-toggle', 'P002', 300);
  await S.page.screenshot({ path: `${OUT}화면P02_폰편성.png` });
  const btn = await S.page.evaluate(() => { const d = document.querySelector('.gx [data-action="depart"]'); if (!d) return null; const r = d.getBoundingClientRect(); return { y: r.top, h: r.height, vh: innerHeight, disabled: d.disabled }; });
  check(s, '폰: 카드 과녁 → 지도(목표 단계, 목표 고른 채) → 「편성」 → 출발 단추가 화면 안', toMap && st1 === 'goal' && st2 === 'team' && btn && btn.y + btn.h <= btn.vh && !btn.disabled, 'team · 출발 보임', { toMap, st1, st2, btn, picked });
  await S.act('depart', undefined, 1500);
  const last = (await S.chat()).message.at(-1);
  check(s, '폰 출발 카드: 목표 가짜괴이, 투입 스팡달', /가짜괴이/.test(last.data) && /스팡달/.test(last.data), '카드', String(last.data).slice(0, 300));
  s = step('P03', '폰_상황종료');
  await S.botReply(FAKE(2, ST(T1.date, '10:30 AM', '관리국 본부')), 'c2');
  await S.open('board');
  const w3 = await S.world();
  const mk = `ms|${w3.ms[0].loc}|${w3.ms[0].name}|${w3.ms[0].born ?? ''}`;
  await S.act('ops-sel', mk, 500);
  await S.act('end-event', mk, 400);
  await S.act('end-event', mk, 900);
  check(s, '폰에서도 두 번 눌러 상황 종료', !(await S.world()).ms.length, 'ms 0', (await S.world()).ms);
  check(s, '오류 없음', S.errors.length === 0, [], S.errors);
  await S.saveState(s);
  await S.page.close();
}

// ════════ D: 명부 — 요원 목록 숨김·괴이 발생 후보 끔을 설정 창에서 저장 → 상황판·요청 ════════
if (want('D')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('D01', '명부_요원목록숨김');
  await S.start('A00', 2);
  await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  await S.open('board');
  await S.page.evaluate(() => document.querySelector('.gx [data-action="tab"][data-value="settings"], .gx [data-action="nav-tab"][data-value="settings"]')?.click());
  await sleep(600);
  let ok = true;
  try { await openEditor(S.page, 'agent'); } catch (e) { ok = false; info(s, '설정 창 요원 페이지 열기 실패', String(e).slice(0, 200)); }
  if (ok) {
    // 데쥬레(P012) 기록 고르고 「요원 목록에 보일 세력」 관리국 칩 끄기
    const sel = await S.page.evaluate(() => { const r = [...document.querySelectorAll('.gw [data-action="ed-sel"], .gw [data-action="ed-pick"], .gw .gw-reclist [data-value]')].find((e) => /데쥬레/.test(e.innerText)); if (r) { r.click(); return r.dataset.action + ':' + r.dataset.value; } return null; });
    await sleep(700);
    const chip = await S.page.evaluate(() => { const c = [...document.querySelectorAll('.gw [data-action="dir-toggle"]')].find((e) => e.dataset.value?.startsWith('rosterFor|A00|')); if (c) { const was = c.getAttribute('aria-pressed'); c.click(); return { v: c.dataset.value, was }; } return null; });
    await sleep(500);
    info(s, '고른 기록·누른 칩', { sel, chip });
    const saveBtn = await S.page.evaluate(() => { const b = [...document.querySelectorAll('.gw [data-action="set-bar"][data-value="save"], .gw [data-action="ed-save"]')][0]; if (b) { b.click(); return b.outerHTML.slice(0, 160); } return null; });
    await sleep(1200);
    const confirm = await S.page.evaluate(() => { const b = [...document.querySelectorAll('.gw button, .gx-ask button')].find((e) => /^(덮어쓰기|저장|확인|예)$/.test(e.innerText.trim()) && e.offsetParent); if (b) { b.click(); return b.innerText; } return null; });
    await sleep(1200);
    info(s, '저장 단추·확인', { saveBtn, confirm });
    const dirNow = await S.page.evaluate(() => { const e = window.__char.globalLore.find((x) => x.comment === 'Directory'); try { const d = JSON.parse(e.content); return (d.agents ?? d.요원 ?? []).find?.((a) => /데쥬레|Dejure/.test(JSON.stringify(a))) ?? Object.keys(d); } catch { return e ? 'parse' : 'none'; } });
    writeFileSync(`${OUT}상태D01_명부.json`, JSON.stringify(dirNow, null, 2));
    await closeEditor(S.page, true).catch(() => {});
    await S.open('board');
    const bd = await statusOf(S);
    check(s, '명부에서 데쥬레를 관리국 목록에서 숨기면 상황판 요원 칸에서 빠짐', !bd.agents.some((a) => a.startsWith('P012')), 'P012 없음', bd.agents);
    const out = await S.mainSend('요원 현황.', 'u2');
    writeReq(s, out);
    const e = entries(out);
    check(s, '다음 요청 AG code 목록에서도 빠짐 (directory.ts 머리 「이 카드의 모든 채팅에 바로 적용된다」)', !e.ag.some((l) => /P012/.test(l)), '없음', e.ag);
    info(s, '저장된 $ag_report 에 P012 가 남아 있나(요청은 이 변수를 그대로 씀)', /P012/.test((await S.vars()).$ag_report ?? ''));
    await S.botReply(FAKE(2, ST(T1.date, '10:30 AM', '관리국 본부')), 'c2');
    const out2 = await S.mainSend('다음 턴.', 'u3');
    writeFileSync(`${OUT}단계D01b_응답한번뒤_요청.txt`, fmtMsgs(out2));
    info(s, '응답이 한 번 붙은 뒤 요청엔 P012 가 빠지나', !entries(out2).ag.some((l) => /P012/.test(l)));
  }
  check(s, '오류 없음', S.errors.length === 0, [], S.errors);
  await S.saveState(s);
  await S.page.close();
}

// ════════ G: 본편 응답 지우기 → 새 턴 ════════
if (want('G')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('G01', '응답지우고_새턴');
  await S.start('A00', 2);
  await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  await S.mainSend('정원으로 간다.', 'u2');
  await S.botReply(FAKE(2, ST(T1.date, '11:00 AM', '인천광역시 서구', '어두운 정원'), ['[AN|인천광역시 서구|어두운 정원|격리|B|없음|격리 완료]', '[AG|P001|사망|순직]']), 'c2');
  const w1 = await S.world();
  check(s, '응답2 반영: 어두운 정원 격리로 끝남, P001 사망', !w1.an.some((e) => e.name === '어두운 정원') && w1.agents.P001.st === '사망', '끝남', w1.an.map((e) => e.name));
  // 응답2 를 지우고(리수 「지우기」), 다른 말을 보냄
  await S.page.evaluate(() => { window.__chat.message.pop(); });
  const out = await S.mainSend('아니, 사무실에 남는다.', 'u3');
  writeReq(s, out);
  const e = entries(out);
  check(s, '지운 응답이 끝낸 괴이가 새 요청에 다시 진행 중으로 (응답이 만든 것은 되돌아감 — 다시 굴리기와 같은 기준)', (e.an ?? []).some((l) => l.includes('어두운 정원')), '어두운 정원 줄 있음', e.an);
  check(s, '지운 응답이 정한 P001 사망이 새 요청에 안 남음', !(e.ag ?? []).some((l) => /\[AG\|P001\|사망/.test(l)), 'P001 사망 아님', e.ag?.[0]);
  await S.botReply(FAKE(3, ST(T1.date, '11:00 AM', '관리국 본부')), 'c3');
  const w3 = await S.world();
  const rows = (await S.journal())?.rows ?? [];
  check(s, '새 답 뒤: 어두운 정원 상황판에 있음, 일지에 지운 응답의 종료 줄 없음', w3.an.some((x) => x.name === '어두운 정원') && !rows.some((r) => r.name === '어두운 정원'), '되돌아감', { an: w3.an.map((x) => `${x.name}|${x.state}`), rows: rows.map((r) => `${r.name}|${r.cause}`), P001: w3.agents.P001 });
  await S.saveState(s);
  await S.page.close();
}

// ════════ F: 상황판 끔 → 켜기 / 새로고침·채팅 다시 열기 ════════
if (want('F')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('F01', '상황판끔_채팅');
  await S.start('A00', 2);
  await S.page.evaluate(() => { const v = window.__chat.scriptstate; delete v.$st_anomaly_on; v.$st_anomaly_on = '0'; });
  const out = await S.mainSend('평범한 하루.', 'u1');
  writeReq(s, out);
  check(s, '끈 채팅: 요청에 상황판 지침·World Entries 없음', !/#### Anomaly/.test(allText(out)) && !/\[AN\|/.test(allText(out)), '없음', /#### Anomaly/.test(allText(out)));
  await S.botReply(FAKE(1, ST(T1.date, T1.time, '관리국 본부'), ['[AN|부산광역시 북구|가짜괴이|활성|C|없음|x]']), 'c1');
  const saved = (await S.chat()).message.at(-1).data;
  info(s, '끈 채팅에서 모델이 태그를 적으면 저장 본문', saved);
  await S.open('board');
  const t = await S.winText();
  check(s, '끈 채팅 상황판: 「상황판 켜기」 단추', t.includes('상황판 켜기'), '켜기 단추', t.slice(0, 200));
  s = step('F02', '상황판켜기');
  await S.act('world-on', undefined, 1200);
  const v = await S.vars();
  check(s, '켜면 추첨·브리핑 생김', v.$st_anomaly_on === '1' && /NEW \[AN/.test(v.$an_report ?? ''), 'NEW 줄', v.$an_report);
  const out2 = await S.mainSend('다음.', 'u2');
  writeReq(s, out2);
  check(s, '켠 뒤 요청에 World Entries', /#### Anomaly/.test(allText(out2)) && /NEW \[AN\|/.test(allText(out2)), '있음', entries(out2).an);
  s = step('F03', '새로고침_뒤_같은상태');
  await S.botReply(R1, 'c2');
  const before = await S.vars();
  const c0 = await S.chat();
  const S2 = await session(c0);
  await S2.open('board');
  const bd = await statusOf(S2);
  const out3 = await S2.mainSend('다시 연 뒤.', 'u3');
  writeReq(s, out3);
  check(s, '페이지 새로고침 뒤 상황판 카드·요원 그대로, 요청 World Entries 그대로', bd.cards.length === 3 && entries(out3).an?.filter((l) => l.startsWith('[AN|')).length === 2, '3 카드', { cards: bd.cards.length, an: entries(out3).an });
  void before;
  check(s, '오류 없음', S.errors.length === 0 && S2.errors.length === 0, [], [...S.errors, ...S2.errors]);
  await S2.page.close();
  await S.page.close();
}

await b.close();
const prevRes = existsSync(`${OUT}결과.json`) && ONLY ? JSON.parse(readFileSync(`${OUT}결과.json`, 'utf8')).filter((r) => !ONLY.includes(r.step[0])) : [];
const all = [...prevRes, ...results];
writeFileSync(`${OUT}결과.json`, JSON.stringify(all, null, 2));
const real = all.filter((r) => r.why !== 'info');
console.log(`\n검사 ${real.length}개 중 통과 ${real.filter((r) => r.ok).length} (참고 ${all.length - real.length})`);
