// 플레이 순서 점검 2차 · 07 본편 요청 조립 (매 턴) (지침: ../../GPT_점검지침_초안.md 3판)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄우고, 본편 요청(beforeRequest 훅)에 들어가는 덧붙임 전부를 한 번에 본다.
// 기록 자리: 본편 = window.__calls.replacers[0] 반환값, 응답 처리 = output 리스너(window.__calls.listeners[0]), 보조 호출 = risuai.runLLMModel(window.__calls.llm).
// 갈래 (argv[2] 글자): A 시작 화면(PC)→여러 턴(상점 사건·사용·다시 굴리기·자동 재시도·검색 깊이)
//                       B 여러 기능이 다 찬 채팅(인물 기록 + 망상홈쇼핑 기록) → 설정 갈래(토큰 상한·컨텍스트 끔·넘기는 기간·인물 끔·소지품 끔·에셋 끔·세력/명단 끔·잔고 칸 끔·로어북 예산)
//                       C 단계 하나씩 실패(시험 본체 dist-test 의 예외 주입) → 나머지·표식
//                       D 폰 크기 시작 화면 → 첫 요청이 PC 와 같은가
//                       E 잔고 칸 끔 첫 턴
// 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과-<갈래>.json
// 사용법: (fixture 가 있을 때) node 인수인계/플레이순서_점검/2차/07_본편요청조립/run.mjs [ABCDE]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack, distWorldPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const OUT = `${HERE}out/`;
const ONLY = (process.argv[2] ?? 'ABCDEF').toUpperCase();
const want = (k) => ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
const SEED = 20261122;

const MARKERS = ['%%SCENE_CARD', '%%/SCENE_CARD%%', '%%PHONE_CALL', '%%GOEI_START%%', '%%/GOEI_START%%', '%%GOEI_UNSENT%%', '%%GOEI_SCENE%%', '%%SEED%%', '%%/SEED%%', '[shop-ready', '@@dont_activate', '@@depth', '{{getvar', '{{#if', '{{/if', '{{#when', '{status_section}', '$st_', '$hs_', '$it_'];
const results = [];
let group = '';
const step = (n, name) => ({ n, name });
function check(s, what, ok, expect, actual, why = '') {
  results.push({ group, step: `${s.n} ${s.name}`, what, ok: !!ok, info: why === 'info', expect, actual, why });
  console.log(`${ok ? 'PASS' : why === 'info' ? 'INFO' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}\n`);
const allText = (out) => out.map((m) => m.content).join('\n');
const leaked = (out) => MARKERS.filter((k) => allText(out).includes(k));
const sysOf = (out, head) => out.find((m) => m.role === 'system' && m.content.startsWith(head))?.content ?? '';
const idxOf = (out, head) => out.findIndex((m) => m.role === 'system' && m.content.startsWith(head));
const lastUserIdx = (out) => out.map((m) => m.role).lastIndexOf('user');
const count = (hay, needle) => hay.split(needle).length - 1;
const loreBlock = (out) => out.find((m) => m.role === 'system' && m.content.includes('## Tag System Directive'))?.content ?? '';
const statusLinesIn = (out) => out.filter((m) => m.role === 'assistant').map((m) => (m.content.match(/\[▣\|[^\]]*\]/g) ?? []).length).reduce((a, b) => a + b, 0);
const worldTagsIn = (out) => out.filter((m) => m.role === 'assistant').some((m) => /^\[(AN|IN|MS|AG|AC)\|/m.test(m.content));
const tok = (s) => Math.ceil(s.length / 2.5);

const b = await launch();

async function session(chat0, vp = 'pc', o = {}) {
  const store = { ...STORE, ...(o.store ?? {}) };
  const { page, errors } = await boot(b, fx, chat0, vp, { store, ...(o.noBody ? { noBody: true } : {}) });
  await page.evaluate((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
  const chat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const vars = async () => (await chat()).scriptstate ?? {};
  const setVars = (v) => page.evaluate((v) => { window.__chat.scriptstate = { ...(window.__chat.scriptstate ?? {}), ...v }; }, v);
  /** 지금 채팅 그대로 본편 요청 (Risu 처럼 SYSTEM + 채팅 전부, 마지막이 유저 글) */
  const sendExisting = (pre = [{ role: 'system', content: 'SYSTEM PROMPT' }]) => page.evaluate(async (pre) => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const out = await window.__calls.replacers[0]([...pre, ...hist], 'model');
    return out.map((m) => ({ role: m.role, content: String(m.content) }));
  }, pre);
  const replay = (msgs) => page.evaluate(async (m) => (await window.__calls.replacers[0](m, 'model')).map((x) => ({ role: x.role, content: String(x.content) })), msgs);
  const mainSend = async (text, id) => { await page.evaluate(([t, id]) => { window.__chat.message.push({ role: 'user', data: t, chatId: id }); }, [text, id]); return sendExisting(); };
  const botReply = async (text, id) => {
    await page.evaluate(async ([t, id]) => {
      window.__chat.message.push({ role: 'char', data: t, chatId: id });
      await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
    }, [text, id]);
    await sleep(500);
  };
  const saveState = async (s, keys = /^\$(st_wallet|st_items|st_item_use|st_item_use_at|st_shop|st_shop_last|hs_log|hs_orders|seed_lore|an_report|ms_report|ag_report|gen_.*|hs_main.*|st_col_.*)$/) => {
    const c = await chat();
    const keep = Object.fromEntries(Object.entries(c.scriptstate ?? {}).filter(([k]) => keys.test(k)).map(([k, v]) => { try { return [k, JSON.parse(v)]; } catch { return [k, v]; } }));
    writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: keep, goeiPeopleV1: c.goeiPeopleV1 ? Object.keys(c.goeiPeopleV1.people ?? {}) : undefined, messages: c.message.map((m) => ({ role: m.role, chatId: m.chatId, data: String(m.data).slice(0, 300) })) }, null, 2));
  };
  const pick = async ({ fac, fm, player }) => {
    await openWin(page); await sleep(400);
    await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`).click(), fac); await sleep(300);
    if (player !== undefined) { await page.evaluate((p) => document.querySelector(`.gx-whoc[data-action="player"][data-value="${p}"]`)?.click(), player); await sleep(300); }
    await page.evaluate((v) => document.querySelector(`.gx-sc[data-value="${v}"]`).click(), String(fm)); await sleep(300);
    const disabled = await page.evaluate(() => document.querySelector('.gx-start')?.disabled);
    await page.evaluate(() => document.querySelector('.gx-start')?.click());
    await sleep(1800);
    return { disabled };
  };
  const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
  const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => ({ type: 'success', result: r })); }, t);
  return { page, errors, chat, vars, setVars, sendExisting, replay, mainSend, botReply, saveState, pick, llmCount, queue };
}

/** NEW 줄을 채운 태그 (가짜 응답용): 자리표를 그럴듯한 값으로 바꾼다 */
function fillNew(report, kind) {
  return String(report ?? '').split('\n').filter((l) => l.startsWith('NEW [')).map((l) => l.slice(4)
    .replace('<발생지점>', '부둣가 창고').replace('<등급>', 'C').replace('<배치>', '없음').replace('<상황>', '가짜 상황')
    .replace('<방문자>', '없음').replace('<상태>', kind === 'AG' ? '내근' : '진행')).join('\n');
}

// ════════ A: 시작 화면(PC) → 여러 턴 ════════
if (want('A')) {
  group = 'A';
  const S = await session({ message: [], scriptstate: {} });
  let s = step('A01', '시작화면_관리국_코드네임_출발');
  const { disabled } = await S.pick({ fac: 'A00', fm: 2 });
  let c = await S.chat();
  check(s, '출발 단추 켜짐 · 첫 장면 메시지 1개', disabled === false && c.message.length === 1 && c.message[0].role === 'char', '첫 장면 1', { disabled, n: c.message.length });
  await S.saveState(s);
  await closeWin(S.page).catch(() => {});

  // ── A02 첫 전송 ──
  s = step('A02', '첫전송_요청');
  const llm0 = await S.llmCount();
  let out = await S.mainSend('잼트리에게 코드네임을 보여 준다.', 'u1');
  writeReq(s, out);
  let all = allText(out);
  let lu = lastUserIdx(out);
  const lb = loreBlock(out);
  check(s, '로어 덩어리 하나, 첫 장면(assistant) 앞', out.filter((m) => m.content.includes('## Tag System Directive')).length === 1 && out.findIndex((m) => m.content.includes('## Tag System Directive')) < out.findIndex((m) => m.role === 'assistant'), '하나·앞', out.filter((m) => m.content.includes('## Tag System Directive')).length);
  check(s, '시드(첫 장면 강제 로어: 관리국·잼트리·스팡달)가 첫 전송에 들어감', lb.includes('[Affiliation code: A00]') && lb.includes('### Character - Jaemtri'), '시드', [lb.includes('[Affiliation code: A00]'), lb.includes('### Character - Jaemtri')]);
  check(s, '[Previous status] 첫 턴 블록(시작 잔고 140000)이 마지막 유저 글 바로 앞 묶음에', idxOf(out, '[Previous status]') > -1 && idxOf(out, '[Previous status]') < lu && sysOf(out, '[Previous status]').includes('140000'), '있음·앞', sysOf(out, '[Previous status]'));
  check(s, '[Inventory] 블록이 마지막 유저 글 앞', idxOf(out, '[Inventory]') > -1 && idxOf(out, '[Inventory]') < lu, '앞', idxOf(out, '[Inventory]'));
  check(s, '이미지 지침은 맨 끝(유저 글 뒤, 로어북 Asset depth 0 자리)', out.at(-1).content.startsWith('## Inserting Character Visual Images') && lu === out.length - 2, '맨 끝', out.at(-1).content.slice(0, 40));
  check(s, '플러그인 표식·풀리지 않은 CBS 없음', leaked(out).length === 0, [], leaked(out));
  check(s, '보조 호출 없음(인물 기록 0명 → Router·Director 안 부름)', (await S.llmCount()) - llm0 === 0, 0, (await S.llmCount()) - llm0);
  check(s, '첫 턴 상황판 NEW 줄이 Tag 에 들어감(사용자 11-22 21:42 상황판 채우기)', /NEW \[AN\|/.test(lb), 'NEW 줄', /NEW \[AN[^\n]*/.exec(lb)?.[0]);
  // 덧붙임 블록 사이 겹침: 상태창 규칙은 로어 Tag 의 Status 절에, 칸 줄(Fields:) 은 [Previous status] 에 다시 오지 않아야 (statusctx fieldsTold)
  check(s, '[Previous status] 에 Fields 줄이 겹쳐 오지 않음(Tag 상태창 절에 이미 있음)', !sysOf(out, '[Previous status]').includes('Fields:'), '없음', sysOf(out, '[Previous status]'));
  const sys = await S.vars();
  await S.saveState(s);

  // ── A03 첫 응답 (상태창 + NEW 줄 채움) → 둘째 턴 ──
  s = step('A03', '첫응답_둘째턴');
  const ST1 = '[▣|2025.03.14|09:10 AM|☀️|8°C|관리국 본부 사무실|없음|잼트리|없음|관리국/신입|140000]';
  const tags1 = [fillNew(sys.$an_report, 'AN'), fillNew(sys.$ms_report, 'MS'), fillNew(sys.$ag_report, 'AG')].filter(Boolean).join('\n');
  const R1 = `【가짜 응답 1】 잼트리가 요원증을 들여다보았다. 에일린이 문가에서 손을 흔들었다.\n\n<img=Jaemtri_curious>\n\n${ST1}\n${tags1}`;
  await S.botReply(R1, 'c1');
  out = await S.mainSend('에일린에게 인사한다.', 'u2');
  writeReq(s, out, `════ 앞 응답(가짜) ════\n${R1}\n\n`);
  all = allText(out);
  lu = lastUserIdx(out);
  const lb2 = loreBlock(out);
  check(s, '둘째 전송: 시드 빠짐(스팡달 글 없음, 글에 안 나옴)', !lb2.includes('### Character - Spangdal'), '없음', lb2.includes('### Character - Spangdal'));
  check(s, '지난 응답의 상황판 태그는 history 에서 지움', !worldTagsIn(out), '없음', worldTagsIn(out));
  check(s, '지난 응답의 상태창 줄은 history 에서 지우고 [Previous status] 하나로', statusLinesIn(out) === 0 && sysOf(out, '[Previous status]').includes('09:10 AM'), '0줄·블록', { lines: statusLinesIn(out), block: sysOf(out, '[Previous status]').split('\n')[1] });
  check(s, 'Tag 의 Anomaly 칸: 응답이 채운 줄은 보통 줄로(같은 지역 NEW 가 남지 않음, 새로 생긴 NEW 는 따로)', /^\[AN\|[^\n]*부둣가 창고/m.test(lb2) && !(sys.$an_report.split('\n').filter((l) => l.startsWith('NEW [AN|')).some((l) => lb2.includes(l))), '채운 줄',  /#### Anomaly\n([\s\S]*?)\n\n/.exec(lb2)?.[1]);
  check(s, '이미지 태그(최근 것)는 history 에 남음', all.includes('<img=Jaemtri_curious>'), '남음', all.includes('<img=Jaemtri_curious>'));
  check(s, '플러그인 표식 없음', leaked(out).length === 0, [], leaked(out));
  const elapsedLeft = /\{elapsed\}|\{유지 기한 MM\.DD/.test(lb2.replace(/Each active entry line ends with \{elapsed\}[^\n]*/, ''));
  check(s, '상황판 줄의 {elapsed} 자리표가 풀림', !elapsedLeft, '풀림', /\[AN\|[^\n]*/.exec(lb2)?.[0]);
  check(s, '[Previous status] 첫 턴 문구(No status line yet)가 사라짐', !sysOf(out, '[Previous status]').includes('No status line yet'), '없음', sysOf(out, '[Previous status]'));
  await S.saveState(s);

  // ── A04 둘째 응답에 상점 표식 → 카드 → 열기 → 두 물건 사기 ──
  s = step('A04', '상점표식_열기_사기');
  const ST2 = '[▣|2025.03.14|11:20 PM|🌙|6°C|이정 책방|없음|없음|없음|관리국/신입|140000]';
  const R2 = `【가짜 응답 2】 퇴근길, 불이 켜진 책방 유리문을 밀자 풍경이 울렸다. 구슬발 사이로 하얀 손이 쪽지를 내밀었다. 「어서 오십시오.」\n${ST2}\n[shop: 이정 책방|]`;
  // 기본 「상점 판단: 자동」은 인물 기록이 매 턴이면 갱신기(보조 호출)가 표식을 붙인다. 이 갈래는 메인 모델 판단으로 둔다 (상점 판단 갈래는 01_상점)
  await S.setVars({ $sh_judge: 'main' });
  await S.botReply(R2, 'c2');
  const SHELF = `<shop-identity>\nsells: 옛 책과 새 책, 부적 종이·먹\nnever: 무기\nprices: 손님과 물건에 따라 바뀐다\ncurrency: -\n</shop-identity>\n<owner>\n어서 오십시오. 천천히 보십시오.\n</owner>\n<shelf>\n누런 부적지 묶음|30000|-|부적/종이/paper|0.012|오래 묵은 한지|\n송연먹|20000|소모20|소모품/먹/ink stick|0.004|그을음 냄새가 진한 먹|\n</shelf>`;
  await S.queue(SHELF);
  const html = await S.page.evaluate((t) => window.__calls.handlers.display(t), R2);
  await S.page.evaluate((h) => { document.getElementById('chat-card')?.remove(); const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
  const hasCard = !!(await S.page.$('#chat-card [data-goei-shop]'));
  if (hasCard) await S.page.click('#chat-card [data-goei-shop]');
  await S.page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
  await S.page.waitForFunction(() => !!document.querySelector('.sh-wrap') && document.querySelectorAll('.sh-wrap [data-action="shop-detail"], .sh-wrap [data-value]').length > 0, null, { timeout: 10000 }).catch(() => {});
  await sleep(800);
  const shop = JSON.parse((await S.vars()).$st_shop || 'null');
  const ids = Object.fromEntries((shop?.items ?? []).map((x) => [x.name, x.id]));
  const act = async (action, value) => {
    await S.page.evaluate(({ action, value }) => { const el = document.createElement('button'); el.dataset.action = action; if (value !== undefined) el.dataset.value = value; el.style.display = 'none'; (document.querySelector('.sh-wrap') || document.body).appendChild(el); el.click(); el.remove(); }, { action, value });
    await sleep(400);
  };
  await act('shop-detail', ids['누런 부적지 묶음']); await act('shop-buy', ids['누런 부적지 묶음']);
  await act('shop-detail', ids['송연먹']); await act('shop-buy', ids['송연먹']);
  const it = JSON.parse((await S.vars()).$st_items || '{}');
  check(s, '카드 뜸·진열 2·두 물건 소지품에', hasCard && (shop?.items?.length === 2) && (it.list ?? []).length === 2, '카드·2·2', { hasCard, shelf: shop?.items?.length, items: (it.list ?? []).map((x) => x.name) });
  await act('shop-close');
  await S.saveState(s);

  // ── A05 송연먹을 「다음 메시지에 사용」 + 셋째 턴 요청 ──
  s = step('A05', '사용넣고_셋째턴');
  const inkId = (it.list ?? []).find((x) => x.name === '송연먹')?.id;
  await S.setVars({ $st_item_use: JSON.stringify([{ id: inkId, n: 1 }]) });
  out = await S.mainSend('송연먹을 갈아 쪽지에 답장을 쓴다.', 'u3');
  writeReq(s, out);
  let inv = sysOf(out, '[Inventory]');
  const thisTurn = /This turn:[^\n]*/.exec(inv)?.[0] ?? '';
  check(s, '[Inventory] This turn 에 산 것 두 개(just bought)', /just bought/.test(thisTurn) && thisTurn.includes('누런 부적지 묶음') && thisTurn.includes('송연먹'), 'just bought 둘', thisTurn);
  check(s, '[Inventory] This turn 에 송연먹 사용', /송연먹[^;]*(use|used)|uses?[^;]*송연먹/i.test(thisTurn), '사용 줄', thisTurn);
  check(s, '산 물건이 Recently 줄에 겹쳐 오지 않음(사용자 11-22 21:28)', !/Recently:[^\n]*(누런 부적지|송연먹)/.test(inv), '없음', /Recently:[^\n]*/.exec(inv)?.[0] ?? '(없음)');
  check(s, '[Inventory] 블록 안 금액이 [Previous status] 잔고와 맞음(140000-50000=90000)', sysOf(out, '[Previous status]').includes('|90000]'), '|90000]', sysOf(out, '[Previous status]').split('\n')[1]);
  check(s, '지난 응답의 상점 표식([shop: …])은 마지막 응답 것만 history 에 남음', count(all = allText(out), '[shop:') - count(inv, '[shop:') <= 1, '≤1', count(all, '[shop:'));
  const recentCash = /Recent cash transactions[^\n]*/.exec(sysOf(out, '[Previous status]'))?.[0] ?? '';
  check(s, '[참고] 최근 거래 줄(설정 「최근 거래 넘기기」 기본)과 [Inventory] 산 것 줄의 값 표기', true, '기록', { recentCash, thisTurn }, 'info');
  check(s, '플러그인 표식 없음', leaked(out).length === 0, [], leaked(out));
  await S.saveState(s);
  const beforeR3 = await S.chat();

  // ── A06 셋째 응답(가게를 나옴) → 넷째 턴: 사건 줄이 다시 안 옴 ──
  s = step('A06', '넷째턴_사건되풀이없음');
  const ST3 = '[▣|2025.03.14|11:50 PM|🌙|5°C|이정 책방 앞 골목|없음|없음|없음|관리국/신입|90000]';
  const R3 = `【가짜 응답 3】 먹 향이 번졌다. 답장을 받은 손이 구슬발 뒤로 사라졌다. 책방을 나서자 골목은 어두웠다.\n${ST3}`;
  await S.botReply(R3, 'c3');
  out = await S.mainSend('골목을 걸어 지하철역으로 간다.', 'u4');
  writeReq(s, out, `════ 앞 응답(가짜) ════\n${R3}\n\n`);
  inv = sysOf(out, '[Inventory]');
  const tt4 = /This turn:[^\n]*/.exec(inv)?.[0] ?? '';
  check(s, '넷째 턴: 구매 사건 줄 없음', !/just bought/.test(inv), '없음', tt4);
  check(s, '넷째 턴: 사용 사건 줄 없음', !/송연먹[^;\n]*(use|used)/i.test(tt4), '없음', tt4);
  check(s, '넷째 턴: 상점 대화 사건 없음', !inv.includes('어서 오십시오'), '없음', inv.includes('어서 오십시오'));
  check(s, '넷째 턴: 목록에는 두 물건이 남음(송연먹 남은 횟수 19)', /^- 누런 부적지 묶음/m.test(inv) && /^- 송연먹[^\n]*19/m.test(inv), '두 줄·19', inv.split('\n').filter((l) => l.startsWith('- ')));
  check(s, '[참고] 넷째 턴 Recently 줄', true, '기록', /Recently:[^\n]*/.exec(inv)?.[0] ?? '(없음)', 'info');
  const rec4 = /Recently:[^\n]*/.exec(inv)?.[0] ?? '';
  check(s, 'Recently 에 지난 턴 사건이 한 번씩만(같은 물건이 두 번 적히지 않음)', !(count(rec4, '송연먹') > 1 && count(rec4, '누런 부적지') > 1), '한 번씩', rec4);
  check(s, '플러그인 표식 없음', leaked(out).length === 0, [], leaked(out));
  await S.saveState(s);

  // ── A07 다섯째 턴: 사건 줄 계속 없음, Recently 기간 ──
  s = step('A07', '다섯째턴');
  await S.botReply('【가짜 응답 4】 역 계단을 내려갔다.\n[▣|2025.03.15|12:05 AM|🌙|5°C|을지로입구역|없음|없음|없음|관리국/신입|90000]', 'c4');
  out = await S.mainSend('막차를 탄다.', 'u5');
  writeReq(s, out);
  inv = sysOf(out, '[Inventory]');
  check(s, '다섯째 턴: just bought·used 없음', !/just bought/.test(inv) && !/This turn:[^\n]*송연먹/.test(inv), '없음', /This turn:[^\n]*/.exec(inv)?.[0] ?? '(This turn 없음)');
  check(s, '[참고] 다섯째 턴 Recently', true, '기록', /Recently:[^\n]*/.exec(inv)?.[0] ?? '(없음)', 'info');
  await S.saveState(s);

  // ── A08 넷째 응답 다시 굴리기 → 다섯째 요청이 아니라, 셋째 응답 다시 굴리기 (사건 턴) ──
  s = step('A08', '셋째응답_다시굴리기');
  // 채팅을 셋째 응답 직전(u3 까지)으로 되돌린 모양: Risu 는 다시 굴릴 때 옛 응답을 먼저 지우고 요청한다
  await S.page.evaluate((c) => { window.__chat = c; }, beforeR3);
  out = await S.sendExisting();
  writeReq(s, out);
  inv = sysOf(out, '[Inventory]');
  const ttR = /This turn:[^\n]*/.exec(inv)?.[0] ?? '';
  check(s, '다시 굴린 셋째 턴: 구매 두 개·사용이 다시 실림', /just bought/.test(ttR) && ttR.includes('누런 부적지 묶음') && /송연먹/.test(ttR), '다시 실림', ttR);
  check(s, '다시 굴린 셋째 턴: [Previous status] 는 둘째 응답 줄(11:20 PM, 잔고 90000)', sysOf(out, '[Previous status]').includes('11:20 PM'), '11:20 PM', sysOf(out, '[Previous status]').split('\n')[1]);
  await S.saveState(s);

  // ── A09 자동 재시도: 조립한 요청이 다시 들어오면 그대로 ──
  s = step('A09', '자동재시도_같은요청');
  const again = await S.replay(out);
  check(s, '이미 조립한 요청이 다시 오면 덧붙임이 두 번 끼지 않음', JSON.stringify(again) === JSON.stringify(out), '같음', { before: out.length, after: again.length });
  const fresh = await S.sendExisting();
  check(s, '그다음 진짜 요청은 다시 조립(재시도로 오인 안 함)', JSON.stringify(fresh) === JSON.stringify(out), '같은 조립 결과', { n: fresh.length });
  await S.saveState(s);

  // ── A10 검색 깊이: 에일린은 u2·R1 에만 나옴 → 깊이 2 면 다섯째 턴에서 빠져야 ──
  s = step('A10', '설정_검색깊이_로어북예산');
  await S.page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '【가짜 응답 3b】 책방을 나섰다.\n[▣|2025.03.14|11:50 PM|🌙|5°C|이정 책방 앞 골목|없음|없음|없음|관리국/신입|90000]', chatId: 'c3b' }, { role: 'user', data: '골목을 걷는다.', chatId: 'u4b' }, { role: 'char', data: '【가짜 응답 4b】 역에 닿았다.\n[▣|2025.03.15|12:05 AM|🌙|5°C|을지로입구역|없음|없음|없음|관리국/신입|90000]', chatId: 'c4b' }, { role: 'user', data: '막차를 탄다.', chatId: 'u5b' }); });
  const def = await S.sendExisting();
  await S.setVars({ $gen_lore_depth: '2' });
  const shallow = await S.sendExisting();
  writeReq(s, shallow, '', '_깊이2');
  const hasAileen = (o) => loreBlock(o).includes('### Character - Aileen');
  check(s, '[참고] 기본(카드 설정 깊이)일 때 에일린 로어북', true, '기록', hasAileen(def), 'info');
  check(s, '검색 깊이 2: 최근 2메시지에 안 나온 에일린 로어북은 빠짐', !hasAileen(shallow), '빠짐', hasAileen(shallow));
  await S.setVars({ $gen_lore_depth: '0', $gen_lore_budget: '300' });
  const small = await S.sendExisting();
  writeReq(s, small, '', '_예산300');
  const picks = (o) => (loreBlock(o).match(/^### Character - [^\n]+/gm) ?? []);
  check(s, '로어북 토큰 예산 300: 고른 로어북(요원 글)이 줄어듦', picks(small).length < Math.max(1, picks(def).length) || tok(loreBlock(small)) < tok(loreBlock(def)), '줄어듦', { def: picks(def), small: picks(small), tokDef: tok(loreBlock(def)), tokSmall: tok(loreBlock(small)) });
  await S.setVars({ $gen_lore_budget: '0' });
  await S.saveState(s);
  if (S.errors.length) console.log('A 페이지 오류', S.errors.slice(0, 5));
  await S.page.close();
  writeFileSync(`${OUT}결과-A.json`, JSON.stringify(results.filter((r) => r.group === 'A'), null, 2));
}

// ════════ B: 여러 기능이 찬 채팅 → 설정 갈래 ════════
function compositeChat() {
  const P = JSON.parse(readFileSync(`${HERE}../05_인물기록/out/상태09.json`, 'utf8'));
  const H = JSON.parse(readFileSync(`${HERE}../04_망상홈쇼핑/out/상태10.json`, 'utf8'));
  const str = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const hs = Object.fromEntries(Object.entries(H.scriptstate).map(([k, v]) => [k, str(v)]));
  return {
    message: P.messages.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })),
    goeiPeopleV1: P.goeiPeopleV1,
    scriptstate: { $st_look: '7.1', $st_faction: 'A00', $ib_affiliation: '관리국', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $st_asset_on: '1', $st_asset_model: 'main', $st_asset_player: '0', ...hs, $hs_show_at: 't:u1' },
  };
}
if (want('B') || want('C')) {
  // 경로가 없으면 B·C 를 건너뛴다
  try { compositeChat(); } catch (e) { console.log('B/C 건너뜀: 앞 점검 상태 파일이 없음', e.message); }
}
if (want('B')) {
  group = 'B';
  const S = await session(compositeChat());
  await openWin(S.page); await sleep(300); await closeWin(S.page).catch(() => {});
  const base = await S.chat();
  const userText = '큐라스와 함께 계단을 내려가며 손전등을 켠다.';
  const run = async (s, patch, name) => {
    await S.page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(base)));
    if (patch) await S.setVars(patch);
    const out = await S.mainSend(userText, 'u7');
    writeReq(s, out, patch ? `════ 바꾼 설정 ════\n${JSON.stringify(patch)}\n\n` : '', name ? `_${name}` : '');
    return out;
  };
  let s = step('B01', '다찬채팅_기본설정');
  const llm0 = await S.llmCount();
  const out0 = await run(s);
  const lu = lastUserIdx(out0);
  const heads = out0.map((m, i) => `${i}:${m.role}:${m.content.split('\n')[0].slice(0, 40)}`);
  const iRef = out0.findIndex((m) => m.role === 'system' && m.content.includes('[MODULE_CONTEXT_BEGIN]'));
  const iSt = idxOf(out0, '[Previous status]');
  const iInv = idxOf(out0, '[Inventory]');
  const iPeople = idxOf(out0, '[People records]');
  check(s, '[참고] 요청 메시지 머리 차례', true, '기록', heads, 'info');
  check(s, '참고 기록(시청 기록)·상태·소지품·인물 기록이 모두 마지막 유저 글 앞, 이 차례', iRef > -1 && iSt > iRef && iInv > iSt && iPeople > iInv && iPeople < lu, '참고<상태<소지품<인물<유저', { iRef, iSt, iInv, iPeople, lu });
  check(s, '이미지 지침은 맨 끝', out0.at(-1).content.startsWith('## Inserting Character Visual Images'), '맨 끝', out0.at(-1).content.slice(0, 40));
  check(s, '플러그인 표식 없음', leaked(out0).length === 0, [], leaked(out0));
  const all0 = allText(out0);
  check(s, '시청 기록 덩어리의 주문 줄과 [Inventory] 의 상자가 서로 다른 물건 이름을 말하지 않음', true, '기록', { inv: sysOf(out0, '[Inventory]').split('\n').filter((l) => l.startsWith('- ')), hsOrder: /user_order[^\n]{0,200}/.exec(all0)?.[0] }, 'info');
  check(s, '인물 기록 블록에 Router 실패 시에도 장면 인물(큐라스)', sysOf(out0, '[People records]').includes('## 큐라스'), '큐라스', sysOf(out0, '[People records]').match(/^## [^\n]+/gm));
  check(s, '[참고] 이 요청에서 부른 보조 호출 수(Router·Director, 가짜 답 없음 → 실패)', true, '기록', (await S.llmCount()) - llm0, 'info');
  const hsTok0 = tok(out0.find((m) => m.content.includes('[MODULE_CONTEXT_BEGIN]'))?.content ?? '');
  await S.saveState(s);

  s = step('B02', '설정_컨텍스트총상한');
  const o2 = await run(s, { $gen_ctx_total: '200' });
  const hs2 = o2.find((m) => m.content.includes('[MODULE_CONTEXT_BEGIN]'))?.content ?? '';
  check(s, '컨텍스트 총 상한 200: 시청 기록 덩어리가 줄거나 빠짐', tok(hs2) < hsTok0, `< ${hsTok0}`, tok(hs2));
  const o2b = await run(s, { $hs_main_tokens: '300' }, '기능상한300');
  const hs2b = o2b.find((m) => m.content.includes('[MODULE_CONTEXT_BEGIN]'))?.content ?? '';
  check(s, '망상홈쇼핑 컨텍스트 토큰 상한 300: 덩어리가 줄거나 빠짐', tok(hs2b) < hsTok0, `< ${hsTok0}`, tok(hs2b));
  check(s, '[참고] 상한 300 일 때 덩어리 크기(글자/2.5)', true, '기록', { full: hsTok0, cap300: tok(hs2b), total200: tok(hs2) }, 'info');

  s = step('B03', '설정_시청기록넘기기끔_넘기는기간');
  const o3 = await run(s, { $hs_main: '0' });
  check(s, '「시청 기록을 메인 요청에 넘기기」 끔: 덩어리 없음', !allText(o3).includes('[MODULE_CONTEXT_BEGIN]'), '없음', allText(o3).includes('[MODULE_CONTEXT_BEGIN]'));
  const o3b = await run(s, { $hs_main_turns: '1' }, '넘기는기간1');
  check(s, '넘기는 기간 1턴: 방송 본 턴(u1) 뒤 본편 응답이 여러 번 지났으니 덩어리 없음', !allText(o3b).includes('[MODULE_CONTEXT_BEGIN]'), '없음', allText(o3b).includes('[MODULE_CONTEXT_BEGIN]'));

  s = step('B04', '설정_인물기록끔');
  const o4 = await run(s, { $pp_on: '0' });
  check(s, '인물 기록 끔: [People records]·[Director note] 없음', idxOf(o4, '[People records]') < 0 && idxOf(o4, '[Director note]') < 0, '없음', [idxOf(o4, '[People records]'), idxOf(o4, '[Director note]')]);

  s = step('B05', '설정_소지품끔');
  const o5 = await run(s, { $it_on: '0' });
  check(s, '소지품 끔: [Inventory] 없음', idxOf(o5, '[Inventory]') < 0, '없음', sysOf(o5, '[Inventory]').slice(0, 100));
  check(s, '[참고] 소지품 끔일 때 [Shop] 블록', true, '기록', o5.find((m) => m.role === 'system' && m.content.startsWith('[Shop]'))?.content ?? '(없음)', 'info');

  s = step('B06', '설정_에셋출력끔');
  // 옛 이미지 태그가 history 에 있는 채팅
  await S.page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(base)));
  await S.page.evaluate(() => { const m = window.__chat.message; const i = m.map((x) => x.role).lastIndexOf('char'); m[i] = { ...m[i], data: m[i].data.replace(/\n/, '\n\n<img=Kyuras_smile>\n\n') }; });
  const withImg = JSON.parse(JSON.stringify(await S.chat()));
  await S.setVars({ $st_asset_on: '0' });
  let o6 = await S.mainSend(userText, 'u7');
  writeReq(s, o6, '════ 바꾼 설정 ════\n{"$st_asset_on":"0"}\n\n');
  check(s, '에셋 끔: 이미지 지침 없음', !allText(o6).includes('## Inserting Character Visual Images'), '없음', allText(o6).includes('Inserting Character Visual'));
  check(s, '에셋 끔: history 의 이미지 태그 지움', !allText(o6).includes('<img='), '없음', /<img=[^>]*>/.exec(allText(o6))?.[0]);
  await S.page.evaluate((c) => { window.__chat = c; }, withImg);
  await S.setVars({ $st_asset_model: 'aux' });
  o6 = await S.mainSend(userText, 'u7');
  writeReq(s, o6, '════ 바꾼 설정 ════\n{"$st_asset_model":"aux"}\n\n', '_보조모델');
  check(s, '에셋 보조 모델: 이미지 지침 없음·history 태그도 지움(메인이 따라 쓰지 않게)', !allText(o6).includes('## Inserting Character Visual Images') && !allText(o6).includes('<img='), '둘 다 없음', [allText(o6).includes('Inserting Character Visual'), /<img=[^>]*>/.exec(allText(o6))?.[0]]);

  s = step('B07', '설정_세력요약_요원명단끔');
  const o7 = await run(s, { $gen_lore_faction: '0', $gen_lore_roster: '0' });
  const lb7 = loreBlock(o7);
  check(s, '세력 요약 끔: ## Faction 절 없음', !/^## Faction\n/m.test(lb7) && !lb7.includes('## Faction Relations'), '없음', [/^## Faction\n/m.test(lb7), lb7.includes('## Faction Relations')]);
  check(s, '요원 명단 끔: ## Roster 절 없음', !/^## Roster/m.test(lb7), '없음', /^## Roster/m.test(lb7));
  check(s, '[참고] 세력 요약을 끄면 Tag 의 Faction pool 줄은 남음', true, '기록', /Faction pool:[^\n]*/.exec(lb7)?.[0], 'info');

  s = step('B08', '설정_잔고칸끔');
  const o8 = await run(s, { $st_col_wallet: 'off' });
  const prev8 = sysOf(o8, '[Previous status]');
  const lb8 = loreBlock(o8);
  check(s, '잔고 칸 끔: [Previous status] 줄에 잔고 칸 없음', !/\|\d+\]\s*$/m.test(prev8.split('\n')[1] ?? '') || !(prev8.split('\n')[1] ?? '').includes('|1000]'), '잔고 칸 없음', prev8.split('\n')[1]);
  check(s, '잔고 칸 끔: Tag 상태창 절에 Balance 규칙 없음', !lb8.includes('Balance = '), '없음', /Balance = [^\n]{0,40}/.exec(lb8)?.[0]);
  check(s, '잔고 칸 끔: 최근 거래 줄도 안 감', !prev8.includes('Recent cash transactions'), '없음', /Recent cash[^\n]*/.exec(prev8)?.[0]);
  check(s, '[참고] 잔고 칸 끔: [Inventory]·시청 기록에 남는 원 금액', true, '기록', { inv: /This turn:[^\n]*|Recently:[^\n]*/.exec(sysOf(o8, '[Inventory]'))?.[0], hsPay: /"pay":"[^"]*"/.exec(allText(o8))?.[0] }, 'info');
  await S.saveState(s);

  s = step('B09', '다음턴_그다음턴_시청기록');
  await S.page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(base)));
  const t1 = await S.mainSend(userText, 'u7');
  await S.botReply('【가짜 응답 7】 계단 아래는 어두웠다.\n[▣|2025.03.14|10:30 PM|🌙|6°C|중림 지하상가 계단|없음|큐라스|없음|관리국/신입|1000]', 'c7');
  const t2 = await S.mainSend('계속 내려간다.', 'u8');
  writeReq(s, t2);
  const ref1 = t1.find((m) => m.content.includes('[MODULE_CONTEXT_BEGIN]'))?.content ?? '';
  const ref2 = t2.find((m) => m.content.includes('[MODULE_CONTEXT_BEGIN]'))?.content ?? '';
  check(s, '[참고] 시청 기록은 넘기는 기간(기본 0=다음 편성까지) 동안 매 턴 같은 덩어리로 감', true, '기록', { same: ref1 === ref2, len1: ref1.length, len2: ref2.length }, 'info');
  check(s, '플러그인 표식 없음', leaked(t2).length === 0, [], leaked(t2));
  await S.saveState(s);
  if (S.errors.length) console.log('B 페이지 오류', S.errors.slice(0, 5));
  await S.page.close();
  writeFileSync(`${OUT}결과-B.json`, JSON.stringify(results.filter((r) => r.group === 'B'), null, 2));
}

// ════════ C: 단계 하나씩 실패 ════════
if (want('C')) {
  group = 'C';
  const testBody = readFileSync(`${ROOT}dist-test/goei-body.js`, 'utf8');
  const S = await session(compositeChat(), 'pc', { noBody: true, store: { 'p:goei:body': testBody, 'p:goei:data-world': distWorldPack() } });
  await openWin(S.page); await sleep(300); await closeWin(S.page).catch(() => {});
  const base = await S.chat();
  const userText = '큐라스와 함께 계단을 내려가며 손전등을 켠다.';
  await S.page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(base)));
  const ok = await S.mainSend(userText, 'u7');
  const has = (o) => ({ lore: !!loreBlock(o), status: idxOf(o, '[Previous status]') > -1, inv: idxOf(o, '[Inventory]') > -1, people: idxOf(o, '[People records]') > -1, img: allText(o).includes('## Inserting Character Visual Images'), ref: allText(o).includes('[MODULE_CONTEXT_BEGIN]') });
  const okHas = has(ok);
  let s = step('C00', '실패없음_기준');
  check(s, '기준 요청에 덧붙임 여섯 가지가 다 있음', Object.values(okHas).every(Boolean), '다 있음', okHas);
  const own = { '로어': 'lore', '상태창': 'status', '소지품': 'inv', '인물 기록': 'people', '이미지 지침': 'img', '참고 기록': 'ref' };
  const stepsToFail = ['로어', '주인공', '명부 다듬기', '참고 기록', '상태창', '소지품', '망상홈쇼핑', '인물 기록', '이미지 지침', '기록 태그 정리', '옛 이미지 태그', '채팅 읽기', 'beforeRequest'];
  let i = 0;
  for (const name of stepsToFail) {
    i += 1;
    s = step(`C${String(i).padStart(2, '0')}`, `실패_${name.replace(/\s/g, '')}`);
    await S.page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(base)));
    await S.page.evaluate((n) => { globalThis.__goeiFaultSteps = [n]; }, name);
    let out;
    try {
      out = await S.mainSend(userText, 'u7');
    } catch (e) {
      check(s, '요청이 던지지 않음', false, '안 던짐', String(e).slice(0, 200));
      continue;
    } finally {
      await S.page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
    }
    writeReq(s, out);
    const h = has(out);
    const lost = Object.entries(okHas).filter(([k, v]) => v && !h[k]).map(([k]) => k);
    const expectLost = name === '채팅 읽기' ? ['lore', 'status', 'inv', 'people', 'img', 'ref'] : name === 'beforeRequest' ? ['lore', 'status', 'inv', 'people', 'img', 'ref'] : own[name] ? [own[name]] : [];
    check(s, `「${name}」 실패: 그 단계 것만 빠지고 나머지는 그대로`, JSON.stringify(lost.sort()) === JSON.stringify(expectLost.sort()), expectLost, lost);
    check(s, `「${name}」 실패: 플러그인 표식·상황판 태그가 모델에 안 감`, leaked(out).length === 0 && !worldTagsIn(out), '없음', { leaked: leaked(out), world: worldTagsIn(out) });
    check(s, `[참고] 「${name}」 실패 때 history 상태창 줄 수`, true, '기록', statusLinesIn(out), 'info');
  }
  if (S.errors.length) console.log('C 페이지 오류', S.errors.slice(0, 5));
  await S.page.close();
  writeFileSync(`${OUT}결과-C.json`, JSON.stringify(results.filter((r) => r.group === 'C'), null, 2));
}

// ════════ D: 폰 크기 시작 → 첫 요청이 PC 와 같은가 ════════
if (want('D')) {
  group = 'D';
  const reqOf = async (vp) => {
    const S = await session({ message: [], scriptstate: {} }, vp);
    const r = await S.pick({ fac: 'A00', fm: 2 });
    await closeWin(S.page).catch(() => {});
    const out = await S.mainSend('잼트리에게 코드네임을 보여 준다.', 'u1');
    await S.page.close();
    return { out, r };
  };
  const pc = await reqOf('pc');
  const ph = await reqOf('phone');
  const s = step('D01', '폰_시작화면_첫요청');
  writeReq(s, ph.out);
  check(s, '폰: 출발 단추가 눌림', ph.r.disabled === false, false, ph.r.disabled);
  check(s, '폰과 PC 의 첫 본편 요청이 같다(배치만 다름)', JSON.stringify(ph.out) === JSON.stringify(pc.out), '같음', { pc: pc.out.length, phone: ph.out.length, diff: ph.out.findIndex((m, i) => m.content !== pc.out[i]?.content) });
  writeFileSync(`${OUT}결과-D.json`, JSON.stringify(results.filter((r) => r.group === 'D'), null, 2));
}

// ════════ E: 잔고 칸 끔 첫 턴 ════════
if (want('E')) {
  group = 'E';
  const S = await session({ message: [], scriptstate: {} });
  await S.pick({ fac: 'A00', fm: 2 });
  await closeWin(S.page).catch(() => {});
  await S.setVars({ $st_col_wallet: 'off' });
  const out = await S.mainSend('잼트리에게 코드네임을 보여 준다.', 'u1');
  const s = step('E01', '잔고칸끔_첫턴');
  writeReq(s, out);
  const lb = loreBlock(out);
  const ruleSaysBlock = lb.includes('provided in a `[Previous status]` block');
  const block = idxOf(out, '[Previous status]') > -1;
  check(s, '상태창 절이 「[Previous status] 블록이 온다」고 하면 첫 턴에도 그 블록이 있다(지침과 조립이 같은 말)', !ruleSaysBlock || block, '블록 있음 또는 규칙 없음', { ruleSaysBlock, block });
  check(s, '[참고] 잔고 칸 끔 첫 턴의 Fields 줄', true, '기록', /Fields in order:[^\n]*/.exec(lb)?.[0], 'info');
  await S.page.close();
  writeFileSync(`${OUT}결과-E.json`, JSON.stringify(results.filter((r) => r.group === 'E'), null, 2));
}


// ════════ F: 인터넷 몰 접속 표식(@web) 뒤 다음 본편 요청 ════════
if (want('F')) {
  group = 'F';
  const S = await session({ message: [], scriptstate: {} });
  await S.pick({ fac: 'A00', fm: 2 });
  await closeWin(S.page).catch(() => {});
  await S.setVars({ $sh_judge: 'main' });
  await S.mainSend('휴대폰으로 우주 쇼핑몰에 들어간다.', 'u1');
  const R = '【가짜 응답 1】 화면에 우주 쇼핑몰 첫 화면이 떴다.\n[▣|2025.03.14|09:10 AM|☀️|8°C|관리국 본부 사무실|없음|없음|없음|관리국/신입|140000]\n[shop: 우주 쇼핑몰|@web]';
  await S.botReply(R, 'c1');
  const saved = (await S.chat()).message.at(-1).data;
  const out = await S.mainSend('장바구니를 본다.', 'u2');
  const s = step('F01', '접속표식_다음요청');
  writeReq(s, out, `════ 앞 응답(가짜) ════\n${R}\n\n════ 저장된 앞 응답 ════\n${saved}\n\n`);
  const hist = out.filter((m) => m.role === 'assistant').map((m) => m.content).join('\n');
  check(s, '[참고] 저장 본문의 접속 표식', true, '기록', /\[shop:[^\]]*\]/.exec(saved)?.[0], 'info');
  check(s, '다음 본편 요청 history 에 지침에 없는 내부 꼴(@web:사이트 id)이 안 감', !/@web:/.test(hist), '@web 만 또는 없음', /\[shop:[^\]]*\]/.exec(hist)?.[0]);
  await S.saveState(s);
  // F02: 응답에 상태창 줄이 빠진 채 몇 턴 (모델이 줄을 빼먹음) → 다음 요청의 [Previous status]
  const s2 = step('F02', '상태창줄없는응답뒤_요청');
  const S2 = await session({ message: [], scriptstate: {} });
  await S2.pick({ fac: 'A00', fm: 2 });
  await closeWin(S2.page).catch(() => {});
  await S2.mainSend('잼트리에게 인사한다.', 'u1');
  await S2.botReply('【가짜 응답 1】 잼트리가 웃었다. (상태창 줄을 빼먹은 응답)', 'c1');
  const o2 = await S2.mainSend('사무실을 둘러본다.', 'u2');
  writeReq(s2, o2);
  const prev = sysOf(o2, '[Previous status]');
  check(s2, '둘째 턴인데 [Previous status] 가 「첫 턴이다」라고 하지 않음', !/this is the first turn/.test(prev), '첫 턴 문구 없음', prev);
  await S2.page.close();
  await S.page.close();
  writeFileSync(`${OUT}결과-F.json`, JSON.stringify(results.filter((r) => r.group === 'F'), null, 2));
}

await b.close();
const n = results.filter((r) => !r.info).length;
const pass = results.filter((r) => !r.info && r.ok).length;
console.log(`\n== ${ONLY}: ${pass}/${n} 통과 (참고 ${results.filter((r) => r.info).length})`);
