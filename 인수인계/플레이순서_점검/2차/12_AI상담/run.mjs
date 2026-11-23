// 플레이 순서 점검 2차 · 12 AI 상담(설정 편집) (지침: ../../GPT_점검지침_초안.md 3판, 틀: tests/flow-consult-browser.mjs)
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄우고
// 설정 창 머리의 「AI 상담」 단추 → 글칸에 쳐서 「보내기」 → 판의 「되돌리기」 순으로 화면 단추를 누른다.
// 기록 자리: 상담 요청 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅(replacers[0]).
// 저장 자리: 상담 대화·바꾸자고 한 것 = 플러그인 저장소 goei:consult[채팅키] (lines·pending·at), 바꾼 설정 = chat.scriptstate / goei:prefs.
// part: main(PC 1920×1080) · reload(페이지 새로고침) · other(다른 채팅) · phone(390×844)
// 사용법: node 인수인계/플레이순서_점검/2차/12_AI상담/run.mjs [main|reload|other|phone]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, openEditor, goNode, clickSel, sleep } from '../../../../tests/qc-settings-harness.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main', 'reload', 'other', 'phone'];
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const PC = { width: 1920, height: 1080, touch: false };
const PHONE = { width: 390, height: 844, touch: true };

// ── 장면 ──
const MARK = 'ZZ본문표식';
const STATUS = '[▣|2025.03.14|11:20 PM|🌙|6°C|중림 지하상가|없음|없음|없음|관리국/신입|140000]';
const chatA = () => ({ id: 'chatA', message: [{ role: 'user', data: '지하상가로 내려간다.', chatId: 'u1' }, { role: 'char', data: `${MARK} 셔터가 반쯤 내려와 있었다.\n${STATUS}`, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_wallet: JSON.stringify({ start: 140000, log: [] }) } });
const chatB = () => ({ ...chatA(), id: 'chatB' });
// 지난 턴 호출 기록 (다른 채팅에서 쌓인 것으로 쓴다). 원문은 ZZ 표식 — 상담 요청에 들어가면 안 된다
const TURN = { id: 't1', at: '2026-11-22T10:00:00.000Z', main: { at: '2026-11-22T10:00:01.000Z', shape: [{ role: 'user', chars: 20 }], tail: [{ role: 'user', content: 'ZZ트레이스본편원문' }], failed: [], totalChars: 40000, totalTokens: 12345 }, reply: { at: '2026-11-22T10:00:30.000Z', text: 'ZZ트레이스응답원문', chars: 900, tokens: 800 },
  calls: [
    { label: '인물 Director', at: '2026-11-22T10:00:01.000Z', ms: 42000, model: 'aux', ok: false, error: 'timeout', request: 'ZZ디렉터요청원문', requestChars: 9000, requestTokens: 5000, response: '', responseChars: 0, responseTokens: 0, phase: 'before' },
    { label: '인물 갱신', at: '2026-11-22T10:00:31.000Z', ms: 8000, model: 'aux', ok: true, request: 'ZZ갱신요청원문', requestChars: 9000, requestTokens: 6000, response: 'ZZ갱신응답원문', responseChars: 900, responseTokens: 700, phase: 'after' },
  ] };
const TRACE_STORE = { 'p:goei-trace': JSON.stringify(['t1']), 'p:goei-trace:t1': JSON.stringify(TURN) };

const results = [];
let stepNo = 0;
let tag = 'main';
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ part: tag, step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${tag} ${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)}`}`);
}
const fmt = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');

// ── 화면 조작 ──
const logOf = (page) => page.evaluate(() => [...document.querySelectorAll('.gw-ai .gw-ai-log > *')].map((e) => `${e.className.replace('ai-m ', '')}: ${e.textContent.replace(/\s+/g, ' ').trim()}`));
const llmN = (page) => page.evaluate(() => (window.__calls.llm || []).length);
const llmFrom = (page, i) => page.evaluate((i) => (window.__calls.llm || []).slice(i).map((c) => ({ mode: c.mode, messages: c.messages })), i);
const ss = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat.scriptstate)));
const prefs = (page) => page.evaluate(() => JSON.parse(window.__store['p:goei:prefs'] || '{}'));
const consult = (page, key = 'c0:chatA') => page.evaluate((k) => { const s = JSON.parse(window.__store['p:goei:consult'] || '{}'); return s[k] ?? null; }, key);
const typeSend = (page, text) => page.evaluate((t) => { const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.gw-ai [data-action="ai-send"]').click(); }, text);
async function idle(page) {
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === false, null, { timeout: 20000 });
  await sleep(200);
}
/** 글칸에 쳐서 보내기. replies = 가짜 답(차례로). 돌아오는 것 = 이번에 간 요청들 */
async function send(page, s, text, replies) {
  const n0 = await llmN(page);
  await page.evaluate((r) => { window.__llm = r; }, replies);
  await typeSend(page, text);
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === true, null, { timeout: 3000 }).catch(() => {});
  await idle(page);
  const reqs = await llmFrom(page, n0);
  writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `${reqs.map((r, i) => `════════ 요청 ${i + 1} (mode=${r.mode}) ════════\n${fmt(r.messages)}`).join('\n\n')}\n\n════ 넣은 가짜 답 ════\n${replies.join('\n---\n')}\n\n════ 화면 대화 ════\n${(await logOf(page)).join('\n')}\n`);
  return reqs;
}
const userOf = (req) => req?.messages?.find((m) => m.role === 'user')?.content ?? '';
const sysOf = (req) => req?.messages?.find((m) => m.role === 'system')?.content ?? '';
const section = (u, name) => new RegExp(`\\[${name}\\]\\n([\\s\\S]*?)(?:\\n\\n\\[|$)`).exec(u)?.[1] ?? '';
async function saveState(page, s, key = 'c0:chatA') {
  const st = await ss(page);
  writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ consult: await consult(page, key), scriptstate: Object.fromEntries(Object.entries(st).filter(([k]) => !/^\$st_(look|fixed_theme)$/.test(k))), prefs: await prefs(page) }, null, 2));
}
const cardRows = (page) => page.evaluate(() => [...document.querySelectorAll('.gw-ai .ai-card')].map((c) => ({ head: c.querySelector('b')?.textContent, rows: [...c.querySelectorAll('.ai-ch')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()), btns: [...c.querySelectorAll('button')].map((b) => b.textContent) })));
const lastSys = async (page) => (await logOf(page)).filter((l) => l.startsWith('ai-sys')).at(-1) ?? '';
async function undoLast(page) {
  const i = await page.evaluate(() => [...document.querySelectorAll('.gw-ai [data-action="ai-undo"]')].length);
  if (!i) return false;
  await page.evaluate(() => [...document.querySelectorAll('.gw-ai [data-action="ai-undo"]')].at(-1).click());
  await sleep(300);
  await page.waitForFunction(() => !document.querySelector('.gw-ai [name="ai-q"]')?.disabled, null, { timeout: 20000 });
  await sleep(200);
  return true;
}
async function openConsult(page, node = 'set:people') {
  await openWin(page);
  await openEditor(page, node);
  await sleep(500);
  await clickSel(page, '.gw [data-action="ai-toggle"]');
  await page.waitForSelector('.gw-ai');
  await sleep(500); // 저장소에서 대화를 읽는 동안
}
const SAY = (t) => `<say>${t}</say>`;
const b = await launch();

/* ════════════════ main (PC) ════════════════ */
if (PARTS.includes('main')) {
  tag = 'main';
  const { page, errors } = await boot(b, fx, chatA(), PC, { store: { ...TRACE_STORE } });
  // 01 열기
  {
    const s = step('열기');
    await openWin(page);
    await openEditor(page, 'set:people');
    await sleep(500);
    check(s, '설정 창 머리에 「AI 상담」 단추', await page.evaluate(() => !!document.querySelector('.gw [data-action="ai-toggle"]')), true, null, 'consult.ts 머리 (11-12 시안8)');
    await clickSel(page, '.gw [data-action="ai-toggle"]');
    await page.waitForSelector('.gw-ai');
    await sleep(400);
    const log = await logOf(page);
    check(s, '안내 줄 하나 (메인 요청에 안 들어간다는 말)', log.length === 1 && log[0].includes('메인 요청에 들어가지 않아요'), '안내 1줄', log);
    check(s, '부를 모델 = 보조 모델 (기본)', (await page.evaluate(() => document.querySelector('.gw-ai .ai-model')?.textContent)) === '보조 모델', '보조 모델', await page.evaluate(() => document.querySelector('.gw-ai .ai-model')?.textContent));
    const box = await page.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); return { win: r('.gw-win').right, ai: r('.gw-ai').left, w: r('.gw-ai').width }; });
    check(s, 'PC: 설정 창 옆 380px 창', box.w === 380 && box.ai >= box.win, '옆 380', box);
  }
  // 02 질문 → 답
  let req02;
  {
    const s = step('질문_답');
    const replies = [`${SAY('지난 턴에 Director가 42초 걸리고 실패했어요. 시간 제한을 줄이거나 메모형으로 바꿀 수 있어요.')}\n<go>pp-set.director_timeout</go>`];
    const reqs = await send(page, s, 'Director가 왜 이렇게 느려?', replies);
    req02 = reqs[0];
    check(s, '상담 요청 1회, 보조 모델(submodel)', reqs.length === 1 && reqs[0].mode === 'submodel', '1회 submodel', reqs.map((r) => r.mode));
    const sys = sysOf(req02); const u = userOf(req02); const all = sys + u;
    check(s, 'system = 지침 COMMON·KNOWLEDGE·CHANGE·OUTPUT', /settings help desk/.test(sys) && /Facts that link a symptom/.test(sys) && /A change takes two turns/.test(sys) && /Output these blocks/.test(sys), '네 절', sys.slice(0, 80));
    const last = section(u, '지난 턴 실제');
    check(s, '[지난 턴 실제]에 Director 42초·실패가 숫자로', /인물 Director .*42초.*실패/.test(last), 'Director 42초 실패', last);
    check(s, '[지난 턴 실제]에 호출 원문·본편 원문은 없음 (consult.ts 「채팅 글은 넣지 않는다」)', !/ZZ(트레이스|디렉터|갱신)/.test(all), '원문 없음', (all.match(/ZZ\S+/g) || []).slice(0, 5));
    check(s, '채팅 본문·상태창 줄이 없음 (consult.ts 「채팅 글·로어북·인물 기록은 넘기지 않는다」)', !all.includes(MARK) && !all.includes('11:20 PM'), '없음', { mark: all.includes(MARK), status: all.includes('11:20 PM') });
    check(s, '[설정 목록] = 지금 보는 메뉴(인물)', /## 인물\n\[pp-set\.on\]/.test(u) && !/## 위키/.test(u), '## 인물만', (u.match(/^## .+$/gm) || []));
    check(s, '[이 창의 대화] 마지막 줄 = 방금 한 말', /\[사용자\] Director가 왜 이렇게 느려\?$/.test(u.trim()), '[사용자] …', u.trim().split('\n').at(-1));
    const log = await logOf(page);
    check(s, '답이 화면에 + 「설정으로 가기 →」', log.some((l) => l.startsWith('ai-op') && l.includes('42초')) && log.some((l) => l.includes('설정으로 가기')), 'op 줄·가기 단추', log);
    // 요청 글 꼴: 메시지당 변화 상한 줄 (인물 페이지 range 칸의 output 글이 단위로 읽힘)
    const cap = (u.match(/^\[pp-cap\].*$/m) || [''])[0];
    check(s, '[pp-cap] 줄의 지금 값·범위가 화면 값과 같은 꼴 (화면: 「±10」, 범위 0~100)', !/±10\s*\|\s*고를|0~100±10/.test(cap), '「지금: 10」 또는 「±10」, 범위 0~100', cap);
    // 빈 수 칸 = 화면은 자리 글(「제한 없음」「안 함」)을 보인다
    await saveState(page, s);
  }
  // 03 바꾸자고 함 (적용 안 됨)
  const dir0 = (await ss(page)).$pp_director;
  {
    const s = step('바꾸자고_함');
    await send(page, s, 'Director를 메모형으로 바꿔줘', [`${SAY('인물 · Director 를 사실형(앞)에서 메모형(뒤)로 바꾸면 메인 요청 전 호출이 없어져요. 바꿀까요?')}\n<set>\npp-set.director=메모형(뒤)\n</set>`]);
    const c = await consult(page);
    check(s, '이 턴엔 적용 안 됨 (지침 CHANGE 「Nothing is applied on that turn」)', (await ss(page)).$pp_director === (dir0 ?? 'facts') || (await ss(page)).$pp_director === dir0, dir0 ?? 'facts(기본)', (await ss(page)).$pp_director);
    check(s, '바꾸자고 한 것이 저장소에 (pending)', c?.pending?.length === 1 && c.pending[0].id === 'pp-set.director' && /note$/.test(c.pending[0].value), 'pp-set.director → note', c?.pending);
    check(s, '판 없음', (await cardRows(page)).length === 0, 0, (await cardRows(page)).length);
    await saveState(page, s);
  }
  // 04 동의 → 적용
  {
    const s = step('동의_적용');
    const reqs = await send(page, s, '응 바꿔', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
    const u = userOf(reqs[0]);
    check(s, '요청 [바꾸자고 한 것] = pp-set.director=메모형(뒤) (인물 · Director, 지금 사실형(앞))', section(u, '바꾸자고 한 것').includes('pp-set.director=메모형(뒤) (인물 · Director, 지금 사실형(앞))'), '그 줄', section(u, '바꾸자고 한 것'));
    check(s, '적용됨 $pp_director=note', (await ss(page)).$pp_director === 'note', 'note', (await ss(page)).$pp_director);
    const cards = await cardRows(page);
    check(s, '판 「바꾼 설정 1개」 사실형(앞) → 메모형(뒤)', cards[0]?.head === '바꾼 설정 1개' && /사실형\(앞\)\s*→\s*메모형\(뒤\)/.test(cards[0]?.rows?.[0] ?? ''), '판 1개', cards);
    check(s, 'pending 비움', (await consult(page))?.pending?.length === 0, [], (await consult(page))?.pending);
    await saveState(page, s);
  }
  // 05 되돌리기
  {
    const s = step('되돌리기');
    await undoLast(page);
    check(s, '되돌림 $pp_director=facts', (await ss(page)).$pp_director === (dir0 ?? 'facts') || (await ss(page)).$pp_director === dir0, dir0 ?? 'facts(기본)', (await ss(page)).$pp_director);
    check(s, '판 단추 「되돌렸어요」', (await cardRows(page)).at(-1)?.btns?.[0] === '되돌렸어요', '되돌렸어요', (await cardRows(page)).at(-1)?.btns);
    await saveState(page, s);
  }
  // 06 다음 질문: 지난 일이 요청에 어떻게 가나
  {
    const s = step('다음_질문');
    const reqs = await send(page, s, '지금 Director는 뭐로 돼 있어?', [SAY('지금 사실형(앞)이에요.')]);
    const u = userOf(reqs[0]);
    check(s, '[바꾸자고 한 것] (없음)', section(u, '바꾸자고 한 것').trim() === '(없음)', '(없음)', section(u, '바꾸자고 한 것'));
    check(s, '[설정 목록]의 Director = 지금 값(사실형(앞))', /\[pp-set\.director\][^\n]*지금: 사실형\(앞\)/.test(u), '사실형(앞)', (u.match(/^\[pp-set\.director\][^\n]*/m) || [''])[0].slice(0, 80));
    const talk = section(u, '이 창의 대화 — 마지막 줄이 사용자가 방금 한 말');
    check(s, '[이 창의 대화]에 사용자·상담 줄만 (sys·판 없음)', !/바꾼 설정|되돌렸|바꾸지 못했/.test(talk), 'me/op 만', talk);
    check(s, '(정보) 되돌린 사실이 상담 요청 어디에도 없음 — 대화엔 「바꿨어요」만 남음', true, '-', { 바꿨어요: talk.includes('바꿨어요'), 되돌림: /되돌/.test(u) });
    await saveState(page, s);
  }
  // 07 서로 묶인 줄: 아바타 동작 간격 최소를 최대보다 크게
  {
    const s = step('묶인줄_최소최대');
    const v0 = await ss(page);
    const lo0 = v0.$st_look_act_min; const hi0 = v0.$st_look_act_max;
    await goNode(page, 'set:items');
    await sleep(300);
    const reqs = await send(page, s, '아바타 동작 간격 최소를 30초로', [`${SAY('소지품 · 아바타 동작 간격 최소를 12초에서 30초로 바꿀까요?')}\n<set>\nset-items-act-min.n=30\n</set>`]);
    const u = userOf(reqs[0]);
    check(s, '[설정 목록]에 최소 12초·최대 24초', /\[set-items-act-min\.n\][^\n]*지금: 12초/.test(u) && /\[set-items-act-max\.n\][^\n]*지금: 24초/.test(u), '12·24', [(u.match(/^\[set-items-act-m..\.n\][^\n]*/gm) || []).map((x) => x.slice(0, 70))]);
    await send(page, { n: s.n + 'b', name: s.name + '_동의' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
    const v1 = await ss(page);
    const cards = await cardRows(page);
    const keys = Object.keys(v1).filter((k) => /act_gap/.test(k));
    const vals1 = Object.fromEntries(keys.map((k) => [k, v1[k]]));
    check(s, '(기록) 적용 뒤 값 — 처리기가 최대도 같이 30으로 민다', true, '-', { before: { lo0, hi0 }, after: vals1 });
    check(s, '판이 같이 바뀐 줄(최대 24→30)도 보여 줌', cards.at(-1)?.rows?.some((r) => r.includes('최대')), '최대 줄 있음', cards.at(-1));
    await undoLast(page);
    const v2 = await ss(page);
    const vals2 = Object.fromEntries(keys.map((k) => [k, v2[k]]));
    check(s, '되돌리기 뒤 최소·최대가 바꾸기 전으로 (최대 24초)', String(v2.$it_act_gap_min ?? '12') === '12' && String(v2.$it_act_gap_max ?? '24') === '24', { min: v0.$it_act_gap_min ?? '12(기본)', max: v0.$it_act_gap_max ?? '24(기본)' }, vals2);
    await saveState(page, s);
  }
  // 08 수 칸 0 (화면 자리 글 「안 함」「제한 없음」)
  {
    const s = step('수칸_0');
    await goNode(page, 'set:adv');
    await sleep(300);
    const r1 = await send(page, s, '다시 보기를 1회로', [`${SAY('생성 공통 · 다시 보기를 1회로 바꿀까요?')}\n<set>\nadv-set.gen:reiterate=1\n</set>`]);
    const line = (userOf(r1[0]).match(/^\[adv-set\.gen:reiterate\][^\n]*/m) || [''])[0];
    check(s, '빈 수 칸(값 0)의 지금 값이 화면 자리 글처럼 「안 함」으로 감 (화면 placeholder 「안 함」)', /지금: 안 함/.test(line), '지금: 안 함', line);
    const lineB = (userOf(r1[0]).match(/^\[adv-set\.gen:budget\][^\n]*/m) || [''])[0];
    check(s, '요청 토큰 상한 지금 값 = 「제한 없음」 (화면 placeholder)', /지금: 제한 없음/.test(lineB), '지금: 제한 없음', lineB.slice(0, 120));
    await send(page, { n: s.n + 'b', name: s.name + '_1회적용' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
    check(s, '다시 보기 1회 적용', String((await ss(page)).$gen_reiterate) === '1', '1', (await ss(page)).$gen_reiterate);
    await send(page, { n: s.n + 'c', name: s.name + '_0제안' }, '다시 보기 꺼 줘', [`${SAY('다시 보기를 1회에서 안 함(0)으로 바꿀까요?')}\n<set>\nadv-set.gen:reiterate=0\n</set>`]);
    const p0 = (await consult(page))?.pending;
    await send(page, { n: s.n + 'd', name: s.name + '_0동의' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
    const v = (await ss(page)).$gen_reiterate;
    const sys = await lastSys(page);
    const cards = await cardRows(page);
    check(s, '0 으로 바뀜', String(v ?? '0') === '0' || v === '', '0', { v, pending: p0 });
    check(s, '바뀐 것이 판으로 남고 「바꾸지 못했어요」가 안 뜸', !sys.includes('바꾸지 못했어요') && /1회\s*→/.test(cards.at(-1)?.rows?.[0] ?? ''), '판 「1회 → 안 함」', { sys, card: cards.at(-1) });
    // 「제한 없음」이라고 적은 답
    await send(page, { n: s.n + 'e', name: s.name + '_제한없음' }, '요청 토큰 상한 없애 줘', [`${SAY('요청 토큰 상한을 제한 없음으로 둘까요?')}\n<set>\nadv-set.gen:budget=제한 없음\n</set>`]);
    const sys2 = await lastSys(page);
    check(s, '(기록) 「제한 없음」 값을 받는지', true, '-', { sys: sys2, pending: (await consult(page))?.pending });
    await saveState(page, s);
  }
  // 09 「2만」 꼴 수
  {
    const s = step('수칸_만단위');
    await send(page, s, '요청 토큰 상한을 2만으로', [`${SAY('생성 공통 · 요청 토큰 상한을 2만 토큰으로 바꿀까요?')}\n<set>\nadv-set.gen:budget=2만\n</set>`]);
    const p = (await consult(page))?.pending;
    const sys = await lastSys(page);
    check(s, '「2만」을 2로 받지 않음 (받지 않거나 20000)', !(p?.length === 1 && p[0].value === '2'), '빠짐 또는 20000', { pending: p, sys });
    const r = await send(page, { n: s.n + 'b', name: s.name + '_동의' }, '응', [`${SAY('2만 토큰으로 바꿨어요.')}\n<apply>yes</apply>`]);
    const pl = section(userOf(r[0]), '바꾸자고 한 것');
    const v = (await ss(page)).$gen_budget;
    const cards = await cardRows(page);
    check(s, '(기록) 동의 턴 [바꾸자고 한 것] · 적용된 값 · 판', true, '-', { pending줄: pl, $gen_budget: v, card: cards.at(-1)?.rows });
    check(s, '요청 토큰 상한이 2토큰이 되지 않음', String(v) !== '2', '≠2', v);
    if (cards.length) await undoLast(page);
    check(s, '되돌리기 뒤 빈 칸(제한 없음)', !(await ss(page)).$gen_budget || String((await ss(page)).$gen_budget) === '0', '', (await ss(page)).$gen_budget);
    await saveState(page, s);
  }
  // 10 꼴 틀린 <set> 줄 (글머리표)
  {
    const s = step('set_꼴틀림');
    await goNode(page, 'set:people');
    await sleep(300);
    const when0 = (await ss(page)).$pp_when;
    await send(page, s, '인물 갱신을 수동으로', [`${SAY('인물 · 자동 호출을 매 턴에서 수동으로 바꿀까요?')}\n<set>\n- pp-set.when=수동\n</set>`]);
    const log = await logOf(page);
    const p = (await consult(page))?.pending;
    check(s, '못 읽은 줄이 있으면 화면에 알림 (sys 줄) — 「바꿀까요?」만 남고 아무것도 안 적힘', log.at(-1)?.startsWith('ai-sys'), '알림', { last: log.at(-1), pending: p });
    await send(page, { n: s.n + 'b', name: s.name + '_동의' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
    check(s, '(기록) 동의 뒤', true, '-', { when: (await ss(page)).$pp_when, before: when0, sys: await lastSys(page) });
    await saveState(page, s);
  }
  // 11 꼴 틀린 <apply>
  {
    const s = step('apply_꼴틀림');
    const when0 = (await ss(page)).$pp_when;
    await send(page, s, '인물 갱신을 수동으로', [`${SAY('인물 · 자동 호출을 매 턴에서 수동으로 바꿀까요?')}\n<set>\npp-set.when=수동\n</set>`]);
    const p = (await consult(page))?.pending;
    await send(page, { n: s.n + 'b', name: s.name + '_동의' }, '응', [`${SAY('네, 수동으로 바꿨어요.')}\n<apply>네</apply>`]);
    const log = await logOf(page);
    const v = (await ss(page)).$pp_when;
    check(s, '「바꿨어요」 답인데 안 바뀌면 화면에 알림이 있음', v === 'manual' || log.at(-1)?.startsWith('ai-sys'), '적용 또는 안내', { before: when0, after: v, pendingBefore: p, pendingAfter: (await consult(page))?.pending, last: log.at(-1) });
    await saveState(page, s);
  }
  // 12 글 칸
  {
    const s = step('글칸');
    await send(page, s, '항상 포함할 인물에 에일린, 큐라스', [`${SAY('항상 포함할 인물을 바꿀까요?')}\n<set>\npp-always=에일린\\n큐라스\n</set>`]);
    const p1 = (await consult(page))?.pending;
    check(s, '한 줄 칸의 \\n 은 빈칸으로 (consultValue)', p1?.[0]?.value === '에일린 큐라스', '에일린 큐라스', p1);
    await send(page, { n: s.n + 'b', name: s.name + '_꺾쇠' }, '<b> 넣어', [`${SAY('바꿀까요?')}\n<set>\npp-always=<b>에일린</b>\n</set>`]);
    check(s, '꺾쇠 글은 뺌 + 알림', (await lastSys(page)).includes('< >'), '< > 알림', await lastSys(page));
    await send(page, { n: s.n + 'c', name: s.name + '_긴글' }, '길게', [`${SAY('바꿀까요?')}\n<set>\npp-always=${'가'.repeat(401)}\n</set>`]);
    check(s, '400자 넘는 글은 뺌 + 알림', (await lastSys(page)).includes('최대 400자'), '최대 400자', await lastSys(page));
    await send(page, { n: s.n + 'd', name: s.name + '_따옴표' }, '에일린만', [`${SAY('항상 포함할 인물을 「에일린」으로 바꿀까요?')}\n<set>\npp-always="에일린"\n</set>`]);
    check(s, '(기록) 따옴표로 감싼 글 값', true, '-', (await consult(page))?.pending);
    await send(page, { n: s.n + 'e', name: s.name + '_동의' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
    check(s, '(기록) 적용된 $pp_always', true, '-', { always: (await ss(page)).$pp_always, card: (await cardRows(page)).at(-1) });
    await undoLast(page);
    check(s, '글 칸 되돌리기 → 빈 글', !(await ss(page)).$pp_always, '', (await ss(page)).$pp_always);
    await saveState(page, s);
  }
  // 13 잠긴 줄 · 목록에 없는 id · 설명 줄 · 범위 밖
  {
    const s = step('못바꾸는줄');
    await send(page, s, '여러 개', [`${SAY('바꿀까요?')}\n<set>\nset-wallet-start=200000\nnope.key=1\nrow.people.1=켬\npp-set.scene_max=7\nadv-set.gen:retries=4\n</set>`]);
    const sys = await lastSys(page);
    check(s, '잠긴 줄·없는 id·고를 수 없는 값·범위 밖을 모두 뺌 + 까닭', sys.includes('잠겨') && sys.includes('nope.key') && sys.includes('장면 인물 수') && sys.includes('형식 오류 재시도'), '네 가지 알림', sys);
    check(s, 'pending 빔', (await consult(page))?.pending?.length === 0, [], (await consult(page))?.pending);
    await saveState(page, s);
  }
  // 14 형식 오류 → 다시 시도 (바꾸자고 한 것 유지)
  {
    const s = step('형식오류_다시시도');
    await send(page, s, 'Router 꺼 줘', [`${SAY('인물 · Router 를 켬에서 끔으로 바꿀까요?')}\n<set>\npp-set.router=끔\n</set>`]);
    const n0 = await llmN(page);
    await send(page, { n: s.n + 'b', name: s.name + '_동의실패' }, '응', ['그냥 글', '또 그냥 글', '또', '또']);
    const tries = (await llmN(page)) - n0;
    const log = await logOf(page);
    check(s, '형식 오류 재시도(1회) 뒤 실패 줄 + 다시 시도', tries === 2 && log.at(-1)?.startsWith('ai-sys ai-err'), '2회 · 실패 줄', { tries, last: log.at(-1) });
    check(s, '실패해도 바꾸자고 한 것은 남음', (await consult(page))?.pending?.[0]?.id === 'pp-set.router', 'pp-set.router', (await consult(page))?.pending);
    check(s, '내 말 「응」이 남음', log.some((l) => l === 'ai-me: 응'), '남음', log.slice(-3));
    await page.evaluate(() => { window.__llm = ['<say>껐어요.</say>\n<apply>yes</apply>']; });
    const n1 = await llmN(page);
    await clickSel(page, '.gw-ai [data-action="ai-retry"]');
    await sleep(300);
    await idle(page);
    const rr = await llmFrom(page, n1);
    writeFileSync(`${OUT}단계${s.n}c_다시시도.txt`, `${fmt(rr[0]?.messages ?? [])}\n\n════ 화면 ════\n${(await logOf(page)).join('\n')}\n`);
    check(s, '다시 시도로 적용 (Router 끔)', (await ss(page)).$pp_router === 'code' || (await ss(page)).$pp_router === '0', 'code', (await ss(page)).$pp_router);
    { const tl = userOf(rr[0]).trim().split('\n').slice(-3); check(s, '다시 시도 요청 끝: 상담 제안 → [사용자] 응 (한 번)', tl.at(-1) === '[사용자] 응' && tl.at(-2).startsWith('[상담]'), '…[상담] 제안 / [사용자] 응', tl); }
    await undoLast(page);
    await saveState(page, s);
  }
  // 15 연타
  {
    const s = step('연타');
    const n0 = await llmN(page);
    const lines0 = (await consult(page))?.lines?.length ?? 0;
    await page.evaluate(() => { window.__llm = ['<say>하나</say>', '<say>둘</say>']; const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = '두 번 눌러'; i.dispatchEvent(new Event('input', { bubbles: true })); const bt = document.querySelector('.gw-ai [data-action="ai-send"]'); bt.click(); bt.click(); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await sleep(300);
    await idle(page);
    const n = (await llmN(page)) - n0;
    const lines = (await consult(page))?.lines ?? [];
    check(s, '호출 1회, 내 말 1줄', n === 1 && lines.slice(lines0).filter((l) => l.who === 'me').length === 1, '1·1', { calls: n, me: lines.slice(lines0).filter((l) => l.who === 'me').length });
    await saveState(page, s);
  }
  // 16 늦게 온 답: 기다리는 동안 상담 창·설정 창 닫기
  {
    const s = step('늦은답_창닫기');
    await page.evaluate(() => {
      const orig = window.risuai.runLLMModel;
      window.__gate = new Promise((r) => { window.__open = r; });
      window.risuai.runLLMModel = async (o) => { await window.__gate; window.risuai.runLLMModel = orig; return orig(o); };
      window.__llm = ['<say>Router는 이름을 고르는 호출이에요.</say>\n<set>\npp-set.router=끔\n</set>'];
      const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = 'Router가 뭐야'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.gw-ai [data-action="ai-send"]').click();
    });
    await sleep(300);
    await page.keyboard.press('Escape'); // 상담 창 닫기
    await sleep(200);
    await clickSel(page, '.gw .gw-top [data-action="ed-close"]');
    await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true).catch(() => {});
    await page.evaluate(() => window.__open());
    await sleep(1200);
    const c = await consult(page);
    check(s, '닫은 사이 온 답이 이 채팅 대화에 붙고 저장됨', c?.lines?.at(-1)?.text?.includes('Router는'), 'op 줄', c?.lines?.slice(-2));
    check(s, '바꾸자고 한 것도 남음', c?.pending?.[0]?.id === 'pp-set.router', 'pp-set.router', c?.pending);
    await clickSel(page, '.gx [data-action="ed-open"]');
    await page.waitForFunction(() => document.querySelector('.gw')?.hidden === false);
    await clickSel(page, '.gw [data-action="ai-toggle"]');
    await page.waitForSelector('.gw-ai');
    await sleep(300);
    const dis = await page.evaluate(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled);
    check(s, '다시 열면 글칸이 풀려 있음', dis === false, false, dis);
    await send(page, { n: s.n + 'b', name: s.name + '_거절' }, '아니 됐어', [SAY('알겠어요.')]);
    check(s, '거절하면 바꾸자고 한 것 버림', (await consult(page))?.pending?.length === 0, [], (await consult(page))?.pending);
    await saveState(page, s);
  }
  // 17 메인 요청·보조 요청에 상담 글 없음
  {
    const s = step('메인요청_누출');
    const chat = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
    const words = ['Director가 왜 이렇게 느려', '메인 요청 전 호출이 없어져요', '바꾼 설정', '두 번 눌러'];
    const msgs = [{ role: 'system', content: 'sys' }, ...chat.message.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.data })), { role: 'user', content: '다음 말' }];
    const main = JSON.stringify(await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs));
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, main.slice(0, 200000));
    check(s, '채팅(메시지·상태값)에 상담 글 없음', words.every((w) => !JSON.stringify(chat).includes(w)), '없음', words.filter((w) => JSON.stringify(chat).includes(w)));
    check(s, '메인 요청에 상담 글 없음', main.length > 500 && words.every((w) => !main.includes(w)), '없음', words.filter((w) => main.includes(w)));
  }
  // 18 대화 지우기
  {
    const s = step('대화지우기');
    const v0 = JSON.stringify(await ss(page));
    await send(page, s, 'Router 꺼 줘', [`${SAY('Router를 끌까요?')}\n<set>\npp-set.router=끔\n</set>`]);
    await clickSel(page, '.gw-ai [data-action="ai-clear"]');
    await sleep(200);
    check(s, '확인 칸이 뜸', await page.evaluate(() => !!document.querySelector('.gw-ai .gw-confirm')), true, null);
    await clickSel(page, '.gw-ai [data-action="ai-clear-yes"]');
    await sleep(400);
    const c = await consult(page);
    check(s, '대화·바꾸자고 한 것 비움, 설정은 그대로', c?.lines?.length === 0 && c?.pending?.length === 0 && JSON.stringify(await ss(page)) === v0, '빈 대화·설정 그대로', { lines: c?.lines?.length, pending: c?.pending });
    await saveState(page, s);
  }
  check({ n: '99', name: '콘솔' }, '콘솔 오류 없음', errors.length === 0, 0, errors.slice(0, 5));
  await page.close();
}

/* ════════════════ reload (페이지 새로고침) ════════════════ */
if (PARTS.includes('reload')) {
  tag = 'reload';
  const s = step('새로고침_이어서적용');
  let store; let chat;
  {
    const { page } = await boot(b, fx, chatA(), PC, { store: { ...TRACE_STORE } });
    await openConsult(page);
    await send(page, s, '인물 갱신을 수동으로', [`${SAY('인물 · 자동 호출을 수동으로 바꿀까요?')}\n<set>\npp-set.when=수동\n</set>`]);
    store = await page.evaluate(() => Object.fromEntries(Object.entries(window.__store).filter(([k]) => !/^p:goei:(body|data-world)$/.test(k))));
    chat = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
    await page.close();
  }
  const { page, errors } = await boot(b, fx, chat, PC, { store });
  await openConsult(page);
  const log = await logOf(page);
  check(s, '새로고침 뒤 대화가 남음', log.some((l) => l.includes('수동으로 바꿀까요')), '남음', log);
  const r = await send(page, { n: s.n + 'b', name: s.name + '_동의' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  check(s, '새로고침 뒤 동의 → 적용', (await ss(page)).$pp_when === 'manual', 'manual', (await ss(page)).$pp_when);
  check(s, '동의 요청에 [바꾸자고 한 것]', section(userOf(r[0]), '바꾸자고 한 것').includes('pp-set.when=수동'), 'pp-set.when=수동', section(userOf(r[0]), '바꾸자고 한 것'));
  await undoLast(page);
  check(s, '새로고침 뒤 판 되돌리기', (await ss(page)).$pp_when !== 'manual', '매 턴', (await ss(page)).$pp_when);
  await saveState(page, s);
  check(s, '콘솔 오류 없음', errors.length === 0, 0, errors.slice(0, 5));
  await page.close();
}

/* ════════════════ other (다른 채팅) ════════════════ */
if (PARTS.includes('other')) {
  tag = 'other';
  const s = step('다른채팅');
  // 채팅 A 에서 상담 대화를 남긴 저장소 + 채팅 A 의 지난 턴 호출 기록 → 채팅 B 를 연다
  const consultA = { 'c0:chatA': { lines: [{ who: 'me', text: 'ZZA채팅상담말' }, { who: 'op', text: 'ZZA채팅상담답' }], pending: [{ id: 'pp-set.when', value: 'manual' }], at: Date.now() } };
  const { page, errors } = await boot(b, fx, chatB(), PC, { store: { ...TRACE_STORE, 'p:goei:consult': JSON.stringify(consultA) } });
  await openConsult(page);
  const log = await logOf(page);
  check(s, '채팅 B 에는 채팅 A 의 상담 대화가 안 보임', !log.some((l) => l.includes('ZZA')), '안 보임', log);
  const r = await send(page, s, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  const u = userOf(r[0]);
  check(s, '채팅 A 의 바꾸자고 한 것이 채팅 B 에서 적용되지 않음', (await ss(page)).$pp_when !== 'manual' && section(u, '바꾸자고 한 것').trim() === '(없음)', '(없음)·미적용', { pend: section(u, '바꾸자고 한 것'), when: (await ss(page)).$pp_when });
  check(s, '(물을 것) 채팅 B 요청의 [지난 턴 실제] — 이 채팅에서 턴을 돈 적이 없는데 채팅 A 의 기록이 들어가는지', true, '-', section(u, '지난 턴 실제'));
  check(s, '콘솔 오류 없음', errors.length === 0, 0, errors.slice(0, 5));
  await saveState(page, s, 'c0:chatB');
  await page.close();
}

/* ════════════════ phone ════════════════ */
if (PARTS.includes('phone')) {
  tag = 'phone';
  const s = step('폰');
  const { page, errors } = await boot(b, fx, chatA(), PHONE, { store: { ...TRACE_STORE } });
  await openConsult(page);
  const sheet = await page.evaluate(() => { const r = document.querySelector('.gw-ai').getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), b: Math.round(r.bottom), t: Math.round(r.top), vw: innerWidth, vh: innerHeight }; });
  check(s, '폰: 아래 판, 화면 폭', sheet.w === sheet.vw && sheet.b === sheet.vh && sheet.t > 100, '폭·아래', sheet);
  await send(page, s, '갱신기를 수동으로', [`${SAY('인물 · 자동 호출을 수동으로 바꿀까요?')}\n<set>\npp-set.when=수동\n</set>`]);
  await send(page, { n: s.n + 'b', name: s.name + '_동의' }, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  check(s, '폰: 적용', (await ss(page)).$pp_when === 'manual', 'manual', (await ss(page)).$pp_when);
  const btn = await page.evaluate(() => { const e = document.querySelector('.gw-ai [data-action="ai-undo"]'); if (!e) return null; e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: r.bottom <= innerHeight && r.top >= 0 }; });
  check(s, '폰: 되돌리기 단추가 화면 안', btn?.vis, true, btn);
  if (btn) { await page.touchscreen.tap(btn.x, btn.y); await sleep(500); await page.waitForFunction(() => !document.querySelector('.gw-ai [name="ai-q"]')?.disabled); }
  check(s, '폰: 되돌리기(손가락)', (await ss(page)).$pp_when !== 'manual', '매 턴', (await ss(page)).$pp_when);
  const over = await page.evaluate(() => [...document.querySelectorAll('.gw-ai *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length);
  check(s, '폰: 가로 넘침 없음', over === 0, 0, over);
  await page.screenshot({ path: `${OUT}폰_상담.png` });
  await saveState(page, s);
  check(s, '콘솔 오류 없음', errors.length === 0, 0, errors.slice(0, 5));
  await page.close();
}

await b.close();
writeFileSync(`${OUT}결과-${PARTS.join('_')}.json`, JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과`);
