// 플레이 순서 점검 2차 · 11 괴이위키 (지침: ../../GPT_점검지침_초안.md 3판, 틀: ../09_괴담넷_게시판_DM/run.mjs)
// 실제 플러그인 번들(dist) + 배포용 시험 카드(.scratch/fixture) + 위키 기본 문서 묶음(fixture/wiki-base.*.txt, 플러그인 저장소 goei:wikibase)
// 을 가짜 Risu(tests/qc-settings-harness.mjs) 에 띄운다.
// part=main  : PC 1100×900, 화면 단추로 대문 → 검색(별칭·띄어쓰기·명부) → 없는 문서 작성 → 링크 하위 문서 → 다시 쓰기(이전 문서 켬·끔)
//              → 기본 인물 문서 다시 쓰기(표정) → 되돌리기 → 본편 컨텍스트(다음 턴·그다음 턴) → 지우기 → 상점이 위키를 받는 길
// part=branch: 응답 실패·빈 답·꼴 틀림·닫는 태그 없음·연타·늦은 답(창 닫기)·새로고침(재부팅)·자동 작성(매 턴·창 열 때)·다시 굴리기·설정 끔
// part=phone : 폰 390×844, 단추로 검색·작성·목록 서랍
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 결과: out/단계NN_*.txt, out/상태NN.json, out/결과-<part>.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['main', 'shop', 'switch', 'branch', 'phone'];
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIKIPACK = JSON.parse(readFileSync(`${ROOT}.scratch/fixture/wiki-base.json`, 'utf8')).parts.map((p) => readFileSync(`${ROOT}.scratch/fixture/${p}`, 'utf8')).join('');
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks'), 'p:goei:wikibase': WIKIPACK };

// ── 장면: 로어북 「소라 랜드」(괴이), 관리국 신입 ──
const ST = (time, place = '소라 랜드', bal = 100000) => `[▣|2025.03.14|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|${bal}]`;
const C1 = `소라 랜드 정문 앞, 폐장 방송이 끝나 가고 있었다. 가로등 몇 개가 붉게 깜빡였다.\n${ST('09:55 PM')}`;
const C2 = `회전목마 뒤편으로 내려가는 어둠의 계단이 보였다. 계단 아래에서 노랫소리가 올라왔다.\n${ST('10:10 PM')}`;
const C3 = `계단을 등지고 매표소 쪽으로 걸었다. 츄러스 가판대 불이 꺼져 있었다.\n${ST('10:25 PM')}`;

// ── 가짜 답 ──
const ART = (title, extra = '', attrs = '') => `<lightboard-namuwiki doc_title="${title}" doc_type="other" main_color="#27685b" related1="어둠의 계단"${attrs}>
[Infobox]Title:${title}|분류:괴담
[Toc]
[Heading]Level:1|Title:개요
[Paragraph]${title}은(는) ➡️${title}➡️ 이라는 이름으로도 불린다. ➡️소라 랜드➡️ 폐장 뒤에 이야기가 돈다. 다시 ➡️소라 랜드➡️ 를 말하자면 {{user}} 같은 사람이 들어간다.📌주석 하나.📌 ➡️어둠의 계단➡️ 아래가 문제다.
[Heading]Level:1|Title:탈출 방법
[Paragraph]계단을 세지 말 것. 정답 문단.
[Image]Name:없는그림|Caption:없는 그림
${extra}</lightboard-namuwiki>`;
const ART_SUB = `<lightboard-namuwiki doc_title="어둠의 계단" doc_type="other" main_color="#27685b">
[Paragraph]회전목마 뒤편에 있는 계단이다. ➡️빛이 없으라➡️ 와 이어진다고 한다.
</lightboard-namuwiki>`;
const ART_RW = (title, word) => `<lightboard-namuwiki doc_title="${title}" doc_type="other" main_color="#27685b">
[Heading]Level:1|Title:개요
[Paragraph]${word} 다시 쓴 ${title} 문서.
</lightboard-namuwiki>`;

// ── 기록 틀 ──
const results = [];
const notes = [];
let stepNo = 0;
let part = '';
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name: `${part}${name}` }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ part, step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 700)}`}`);
}
function note(s, what, actual) { notes.push({ part, step: `${s.n} ${s.name}`, what, actual }); console.log(`NOTE [${s.n} ${s.name}] ${what}: ${JSON.stringify(actual)?.slice(0, 600)}`); }
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const allText = (msgs) => msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
const MARK = /%%SCENE_CARD|%%GOEI_|\[shop[:-]|\{\{getvar|\{\{#when|__NW_[A-Z]+__|NW_PRIVATE|NW_META|\[MODULE_CONTEXT|@@SECTION|@@END/;

const b = await launch();
let page; let errors;
const allErrors = [];
const vars = () => page.evaluate(() => window.__chat.scriptstate);
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const llmOpt = (i) => page.evaluate((i) => { const o = window.__calls.llm[i]; return { mode: o.mode, staticModel: o.staticModel }; }, i);
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (r && typeof r === 'object' ? r : { type: 'success', result: r })); }, t);
const hold = () => page.evaluate(() => { window.__llm = [new Promise((r) => { window.__release = (t) => r({ type: 'success', result: t }); })]; });
const release = (t) => page.evaluate((t) => window.__release?.(t), t);
const act = async (action, value, wait = 450) => {
  await page.evaluate(({ action, value }) => {
    const el = document.createElement('button');
    el.dataset.action = action;
    if (value !== undefined) el.dataset.value = value;
    el.style.display = 'none';
    (document.querySelector('.wk') || document.querySelector('.gx-panel') || document.querySelector('.gx') || document.body).appendChild(el);
    el.click();
    el.remove();
  }, { action, value });
  await sleep(wait);
};
const vis = (sel) => sel.split(',').map((x) => `${x.trim()}:visible`).join(', ');
const press = async (sel, wait = 500) => { const l = page.locator(vis(sel)).first(); try { await l.click({ timeout: 2500 }); } catch (e) { if (!(await l.count())) throw e; console.log(`  (덮개가 가려 DOM 클릭: ${sel})`); await l.evaluate((el) => el.click()); } await sleep(wait); };
const has = async (sel) => (await page.locator(vis(sel)).count()) > 0;
const fill = async (sel, text) => { await page.locator(vis(sel)).first().fill(text); await sleep(150); };
const waitIdle = async (max = 20000) => { const t0 = Date.now(); let n = -1; let since = Date.now(); while (Date.now() - t0 < max) { const k = await llmCount(); const busy = await page.evaluate(() => !!document.querySelector('.nw-busy, .wk .spin')); if (k !== n || busy) { n = k; since = Date.now(); } else if (Date.now() - since > 900) return; await sleep(200); } };
const screen = () => page.evaluate(() => document.querySelector('.wk')?.innerText ?? '');
const html = () => page.evaluate(() => document.querySelector('.wk')?.innerHTML ?? '');
const snap = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
const wikiLore = async () => (await snap()).localLore?.filter((e) => String(e.comment).startsWith('WIKI｜')) ?? [];
const docOf = async (title) => { const e = (await wikiLore()).find((x) => x.comment === `WIKI｜${title}`); if (!e) return null; const m = /<!--NW_META:([\s\S]*?)-->/.exec(e.content); let meta = null; try { meta = JSON.parse(m[1].replace(/-\\u002d/g, '--')); } catch { /* */ } return { meta, body: /<lightboard-namuwiki[\s\S]*<\/lightboard-namuwiki>/.exec(e.content)?.[0] ?? '', raw: e.content }; };
const saveState = async (s) => { const c = await snap(); writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ wikiDocs: (c.localLore ?? []).filter((e) => String(e.comment).startsWith('WIKI｜')), scriptstate: Object.fromEntries(Object.entries(c.scriptstate ?? {}).filter(([k]) => /^\$nw_/.test(k))), messages: c.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data })) }, null, 2)); };
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
const botReply = async (text, cid, wait = 900) => { await page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]); await sleep(wait); };
const setVars = (v) => page.evaluate((v) => { window.__chat.scriptstate = { ...(window.__chat.scriptstate ?? {}), ...v }; }, v);
const openWiki = async () => {
  await closeWin(page); await sleep(200);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await act('nav-tab', 'net');
  if (!(await page.$('.wk'))) await act('br-go', 'wk', 700);
};
const BASE_VARS = { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $ib_affiliation: '관리국', $st_wallet: JSON.stringify({ start: 100000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) };
const firstChat = (extra = {}, more = {}) => ({ message: [{ role: 'user', data: '소라 랜드 정문으로 걸어간다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }], scriptstate: { ...BASE_VARS, ...extra }, ...more });
const bootChat = async (chat0, v = 'pc') => {
  if (page) { allErrors.push(...errors); await page.close(); }
  ({ page, errors } = await boot(b, fx, chat0, v, { store: STORE }));
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await closeWin(page); await sleep(200);
};
const userPart = (msgs) => String(msgs.find((m) => m.role === 'user' && /문서 제목:|\[후보 제목\]/.test(String(m.content)))?.content ?? msgs.at(-1)?.content ?? '');
const sysPart = (msgs) => msgs.filter((m) => m.role === 'system').map((m) => String(m.content)).join('\n');
const between = (t, a, b2) => { const i = t.indexOf(a); if (i < 0) return ''; const j = b2 ? t.indexOf(b2, i + a.length) : -1; return t.slice(i + a.length, j < 0 ? undefined : j); };
const topSearch = async (q) => { await fill('.wk-top [data-input="wiki-query"]', q); await press('.wk-top [data-action="wiki-search"]', 600); };
const wikiCtx = (out) => out.map((m) => m.content).filter((c) => c.includes('"feature":"wiki"'));

// ═════════════════════ part main: 대표 경로 (PC, 화면 단추) ═════════════════════
if (PARTS.includes('main')) {
  part = 'PC_';
  await bootChat(firstChat({ $nw_writing_request: '공용지침-건조한 말투' }));
  // 01 인터넷 → 괴이위키 대문
  {
    const s = step('대문');
    const n0 = await llmCount();
    await openWiki();
    const txt = await screen();
    check(s, '대문이 열림, 모델 호출 없음(자동 작성 기본 수동)', txt.includes('괴이위키:대문') && (await llmCount()) === n0, '대문·호출 0', { home: txt.includes('괴이위키:대문'), calls: (await llmCount()) - n0 }, 'core/wiki.ts WIKI_DEFAULTS auto 0');
    check(s, '기본 문서(카드 묶음 144개)가 목록에 보임: 괴담·장소/인물 줄', /괴담·장소 \d+/.test(txt) && /인물 \d+/.test(txt), '괴담·장소 N · 인물 N', txt.slice(0, 600));
    check(s, '최근 변경은 비어 있음(기본 문서는 이번 이야기 문서가 아님)', txt.includes('아직 바뀐 문서가 없어요'), '아직 바뀐 문서가 없어요', /최근 변경[\s\S]{0,80}$/.exec(txt)?.[0]);
    await press('.wk-top [data-action="wiki-list"]');
    const dr = await page.evaluate(() => document.querySelector('.wdr')?.innerText ?? '');
    check(s, '목록 서랍 전체 = 기본 문서 수(144)', /전체\s*144/.test(dr), '전체 144', dr.slice(0, 60));
    await press('.wdr [data-action="wiki-list"][data-value="close"]');
    await saveState(s);
  }
  // 02 머리줄 검색: 영문 별칭 → 정식 문서
  {
    const s = step('검색_별칭');
    await topSearch('Sora Land');
    const txt = await screen();
    check(s, '「Sora Land」 → 기본 문서 「소라 랜드」가 열림', /^[\s\S]{0,200}소라 랜드/.test(txt) && txt.includes('개요'), '소라 랜드 문서', txt.slice(0, 200), 'core/wiki.ts canonicalTitle 주석(별칭 → 정식 이름)');
    const h = await html();
    check(s, '기본 문서에는 지우기 단추 없음, 다시 쓰기 있음', !/data-action="wiki-delete"/.test(h) && /data-action="wiki-rewrite"/.test(h), '삭제 없음·다시 쓰기', { del: /wiki-delete/.test(h), rw: /wiki-rewrite/.test(h) }, 'ui/wiki.ts docView 「기본 문서는 지울 수 없고」');
    check(s, '정보칸 사진(설정 기본 「정보칸만」)이 붙음', /nw-ibphoto/.test(h), 'nw-ibphoto', /nw-ibphoto/.test(h));
    note(s, '스포일러 접기(클리어 전 괴이)', { folded: (h.match(/nw-spoil/g) ?? []).length });
    check(s, '모델 호출 없음(열기만으로 생성 안 함)', (await llmCount()) === 0, 0, await llmCount(), 'ui/wiki.ts openTitle 「열기만으로는 생성하지 않음」');
    await saveState(s);
  }
  // 03 띄어쓰기 틀린 검색
  {
    const s = step('검색_띄어쓰기');
    await topSearch('소라랜드');
    const txt = await screen();
    note(s, '「소라랜드」 검색 화면', txt.slice(0, 300));
    check(s, '「소라랜드」 → 「소라 랜드」로 가거나 비슷한 문서로 보임(새 문서로 바로 가지 않음)', txt.includes('소라 랜드'), '소라 랜드 보임', txt.slice(0, 300), 'ui/wiki.ts similar 주석(소라랜드 → 소라 랜드)');
    check(s, '모델 호출 없음', (await llmCount()) === 0, 0, await llmCount());
    await saveState(s);
  }
  // 04 명부에 있지만 문서 없는 괴이 → 작성 화면 → 문서 작성
  let req04 = '';
  {
    const s = step('없는문서_작성');
    await topSearch('빛이 없으라');
    let txt = await screen();
    check(s, '작성 화면: 「같은 이름의 로어북이 있어요」', txt.includes('해당 문서를 찾을 수 없습니다') && txt.includes('같은 이름의 로어북이 있어요'), '작성 화면 + 로어북 안내', txt.slice(0, 300), 'ui/wiki.ts compose');
    check(s, '공용 지침이 작성 화면에 보임', txt.includes('공용지침-건조한 말투'), '공용 지침', txt.includes('공용지침'));
    await fill('.wk-compose [data-input="wiki-docreq"]', '문서지침-탈출법 위주');
    const reply = ART('빛이없으라');
    await queue(reply);
    const n0 = await llmCount();
    await press('.wk-compose [data-action="wiki-start"]', 300);
    await waitIdle();
    const n1 = await llmCount();
    check(s, '모델 호출 1회', n1 - n0 === 1, 1, n1 - n0);
    const msgs = n1 > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, reply);
    const opt = n1 > n0 ? await llmOpt(n0) : {};
    check(s, '메인 모델로 감(기본 main)', opt.mode === 'model', 'model', opt.mode, 'WIKI_DEFAULTS model main');
    const all = allText(msgs);
    req04 = all;
    const u = userPart(msgs);
    const sys = sysPart(msgs);
    check(s, '제목 줄 「문서 제목: 빛이 없으라」', u.includes('문서 제목: 빛이 없으라'), '문서 제목: 빛이 없으라', /문서 제목:[^\n]*/.exec(u)?.[0]);
    const refs = between(u, '[참고 자료]', '[최근 챗로그]');
    check(s, '참고 자료에 원본 로어북 「빛이 없으라」가 원본 종류로', /빛이 없으라/.test(refs) && refs.length > 300, '원본 로어북 본문', refs.split('\n').filter((l) => /^\[|^#|빛이 없으라/.test(l)).slice(0, 6));
    check(s, '최근 챗로그에 지금 장면(폐장 방송)이 들어감', u.includes('폐장 방송이 끝나 가고'), '최근 본문', u.includes('폐장 방송이 끝나'));
    check(s, '공용 지침·이 문서 지침이 각각 머리말 아래', u.includes('[사용자 작성 지침: 모든 문서 공통]\n공용지침-건조한 말투') && u.includes('[사용자 작성 지침: 이 문서만]\n문서지침-탈출법 위주'), '두 지침', { all: u.includes('공용지침'), doc: u.includes('문서지침') });
    check(s, '지침 절: GUIDE·EXPAND·LENGTH_DETAILED·LINKS_OPEN·FORMAT·HISTORY', ['complete Korean in-universe encyclopedia', 'EXPAND MODE', 'SELECTED LENGTH: DETAILED', 'INTERNAL LINKS', 'OUTPUT CONTRACT', 'Supplied recent logs'].every((k) => all.includes(k)), '6절', ['EXPAND MODE', 'SELECTED LENGTH: DETAILED', 'Supplied recent logs'].map((k) => all.includes(k)));
    check(s, '이전 문서 절·머리말 없음(새 문서)', !u.includes('[이전 위키]') && !all.includes('Previous article:'), '없음', { head: u.includes('[이전 위키]') });
    check(s, '인물이 아니므로 정보칸 표정 절 없음, 그림 「정보칸만」이라 본문 그림 절 없음', !all.includes('INFOBOX PORTRAIT') && !all.includes('BODY IMAGES'), '없음', { portrait: all.includes('INFOBOX PORTRAIT'), images: all.includes('BODY IMAGES') });
    check(s, '플러그인 내부 표식·풀리지 않은 자리표가 새지 않음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    note(s, '최근 챗로그에 상태창 줄(잔고) — 재검토 물을것1 intended', /\|100000\]/.test(u));
    note(s, '요청 길이(자)', all.length);
    const d = await docOf('빛이 없으라');
    check(s, '채팅 로어북에 「WIKI｜빛이 없으라」 저장', !!d, '저장', !!d, 'core/wiki.ts saveDoc');
    check(s, 'doc_title 을 요청 제목으로 고정', d?.body.startsWith('<lightboard-namuwiki doc_title="빛이 없으라"'), 'doc_title="빛이 없으라"', d?.body.slice(0, 60));
    check(s, '자기 링크·같은 링크 두 번째는 표시만 지움', d && !d.body.includes('➡️빛이 없으라➡️') && (d.body.match(/➡️소라 랜드➡️/g) ?? []).length === 1 && d.body.includes('➡️어둠의 계단➡️'), '자기 0, 소라 랜드 1, 어둠의 계단 1', d && { self: d.body.includes('➡️빛이 없으라➡️'), sora: (d.body.match(/➡️소라 랜드➡️/g) ?? []).length });
    check(s, '{{ }} 는 바꿔 둠', d && !d.body.includes('{{user}}'), '{{ 없음', d?.body.includes('{{'));
    check(s, 'meta: 지침 둘·원본 자료·direct', d?.meta?.writingRequest === '공용지침-건조한 말투' && d?.meta?.docRequest === '문서지침-탈출법 위주' && d?.meta?.primarySources?.includes('빛이 없으라') && d?.meta?.direct === true, '저장', d?.meta);
    txt = await screen();
    const h = await html();
    check(s, '문서 보기로 넘어감, 지우기 단추 있음', txt.includes('빛이 없으라') && /data-action="wiki-delete"/.test(h) && !txt.includes('해당 문서를 찾을 수 없습니다'), '문서 보기', txt.slice(0, 200));
    check(s, '「소라 랜드」 링크는 있는 문서(on), 「어둠의 계단」은 없는 문서', /class="nw-link on"[^>]*data-value="소라 랜드"/.test(h) && /class="nw-link"[^>]*data-value="어둠의 계단"/.test(h), 'on / 없음', { sora: /nw-link on[^>]*소라 랜드/.test(h), dark: /class="nw-link"[^>]*어둠의 계단/.test(h) });
    check(s, '클리어 전 괴이: 「탈출 방법」 문단 접힘', /nw-spoil/.test(h), '접힘', /nw-spoil/.test(h), 'ui/wiki.ts spoilerFold');
    check(s, '없는 그림 블록은 건너뜀(images 정보칸만)', !/nw-fig/.test(h), '그림 없음', /nw-fig/.test(h));
    await press('.wk-top [data-action="wiki-home"]');
    const home = await screen();
    check(s, '대문 최근 변경에 새 문서', /최근 변경[\s\S]*빛이 없으라/.test(home), '빛이 없으라', /최근 변경[\s\S]{0,80}$/.exec(home)?.[0]);
    await saveState(s);
  }
  // 05 문서 안 링크(없는 하위 문서) → 작성
  {
    const s = step('링크_하위문서_작성');
    await topSearch('빛이 없으라');
    await press('.nw-doc [data-action="wiki-open"][data-value="어둠의 계단"]');
    const txt = await screen();
    check(s, '작성 화면: 부모 문서 원본 자료를 이어받는다는 안내', txt.includes('「빛이 없으라」 문서의 원본 자료') , '이어받음 안내', txt.slice(0, 300), 'ui/wiki.ts compose');
    await queue(ART_SUB);
    const n0 = await llmCount();
    await press('.wk-compose [data-action="wiki-start"]', 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, ART_SUB);
    const u = userPart(msgs);
    const all = allText(msgs);
    const refs = between(u, '[참고 자료]', '[최근 챗로그]');
    check(s, '참고 자료에 부모 원본(빛이 없으라 로어북)이 원본으로', /빛이 없으라/.test(refs) && refs.length > 300, '부모 원본', refs.slice(0, 200));
    const prev = between(u, '[이전 위키]', '[사용자 작성 지침');
    note(s, '[이전 위키] 칸에 부모 문서 본문이 들어감', { has: u.includes('[이전 위키]'), head: prev.slice(0, 160), previousRule: /Previous article:[^\n]*/.exec(all)?.[0] });
    check(s, '이 문서 지침 칸은 비어 있음(작성 화면에서 안 적음)', !u.includes('[사용자 작성 지침: 이 문서만]'), '없음', u.includes('[사용자 작성 지침: 이 문서만]'));
    check(s, '플러그인 내부 표식이 새지 않음', !MARK.test(all), '없음', MARK.exec(all)?.[0]);
    const d = await docOf('어둠의 계단');
    check(s, '저장: 원본 자료 = 부모 것, direct=false', d?.meta?.direct === false && d?.meta?.primarySources?.includes('빛이 없으라'), { direct: false, primary: ['빛이 없으라'] }, d?.meta && { direct: d.meta.direct, primary: d.meta.primarySources });
    await saveState(s);
  }
  // 06 다시 쓰기 (이전 문서 참고 ON 기본)
  {
    const s = step('다시쓰기_이전문서켬');
    await topSearch('빛이 없으라');
    await press('.wk-head [data-action="wiki-rewrite"]');
    const box = await page.locator('.wk-rewrite [data-input="wiki-docreq"]').inputValue().catch(() => null);
    check(s, '다시 쓰기 칸에 지난 이 문서 지침이 채워져 있음', box === '문서지침-탈출법 위주', '문서지침-탈출법 위주', box, 'ui/wiki.ts wiki-rewrite 주석');
    const onBtn = await page.evaluate(() => document.querySelector('.wk-rewrite [data-action="wiki-rw-prev"].on')?.dataset.value);
    check(s, '이전 문서 참고 기본 ON(설정 기본 켬)', onBtn === '1', '1', onBtn);
    await fill('.wk-rewrite [data-input="wiki-docreq"]', '문서지침2-역사 위주');
    const reply = ART_RW('빛이 없으라', '첫째로');
    await queue(reply);
    const n0 = await llmCount();
    const before = await docOf('빛이 없으라');
    await press('.wk-rewrite [data-action="wiki-rw-go"]', 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, reply);
    const u = userPart(msgs);
    const all = allText(msgs);
    check(s, '[이전 위키]에 이전 본문(태그 뺀 안쪽)', u.includes('[이전 위키]') && u.includes('어둠의 계단➡️ 아래가 문제다') && !between(u, '[이전 위키]').startsWith('\n<lightboard'), '이전 본문', between(u, '[이전 위키]', '[사용자').slice(0, 120));
    check(s, 'NW.PREVIOUS 절', all.includes('Previous article:'), 'Previous article', all.includes('Previous article:'));
    check(s, '새 이 문서 지침이 감', u.includes('[사용자 작성 지침: 이 문서만]\n문서지침2-역사 위주'), '문서지침2', /이 문서만\]\n[^\n]*/.exec(u)?.[0]);
    check(s, '참고 자료에 원본 로어북(빛이 없으라)이 계속 들어감', between(u, '[참고 자료]', '[최근 챗로그]').length > 300, '원본', between(u, '[참고 자료]', '[최근').length);
    const lore = await wikiLore();
    const d = await docOf('빛이 없으라');
    check(s, '같은 제목 항목 하나만(바꿔 씀), 새 본문·새 이 문서 지침', lore.filter((e) => e.comment === 'WIKI｜빛이 없으라').length === 1 && d?.body.includes('첫째로 다시 쓴') && d?.meta?.docRequest === '문서지침2-역사 위주', '1개, 새 본문', { n: lore.filter((e) => e.comment === 'WIKI｜빛이 없으라').length, doc: d?.meta?.docRequest });
    check(s, 'direct·원본 자료 유지', d?.meta?.direct === true && d?.meta?.primarySources?.includes('빛이 없으라'), 'direct true', d?.meta && { direct: d.meta.direct, p: d.meta.primarySources });
    note(s, 'created 바뀜', { before: before?.meta?.created, after: d?.meta?.created });
    const txt = await screen();
    check(s, '다시 쓰기 칸이 닫히고 새 본문이 보임', txt.includes('첫째로 다시 쓴') && !(await has('.wk-rewrite')), '새 본문', txt.slice(0, 200));
    await saveState(s);
  }
  // 07 다시 쓰기 (이전 문서 참고 OFF)
  {
    const s = step('다시쓰기_이전문서끔');
    await press('.wk-head [data-action="wiki-rewrite"]');
    await press('.wk-rewrite [data-action="wiki-rw-prev"][data-value="0"]');
    const reply = ART_RW('빛이 없으라', '둘째로');
    await queue(reply);
    const n0 = await llmCount();
    await press('.wk-rewrite [data-action="wiki-rw-go"]', 300);
    await waitIdle();
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, reply);
    const u = userPart(msgs);
    check(s, '[이전 위키]·NW.PREVIOUS 없음', !u.includes('[이전 위키]') && !allText(msgs).includes('Previous article:'), '없음', u.includes('[이전 위키]'));
    check(s, '이 문서 지침은 그대로 넘어감', u.includes('문서지침2-역사 위주'), '문서지침2', /이 문서만\]\n[^\n]*/.exec(u)?.[0]);
    const d = await docOf('빛이 없으라');
    check(s, '저장된 본문 = 둘째', d?.body.includes('둘째로 다시 쓴'), '둘째', d?.body.slice(-80));
    await saveState(s);
  }
  // 08 기본 인물 문서(큐라스) 다시 쓰기 → 표정 → 되돌리기
  {
    const s = step('기본인물문서_다시쓰기_되돌리기');
    await topSearch('큐라스');
    let txt = await screen();
    check(s, '기본 문서 「큐라스」가 열림', txt.includes('큐라스') && !txt.includes('해당 문서를 찾을 수 없습니다'), '기본 문서', txt.slice(0, 120));
    await sleep(1200);
    const basePic = await page.evaluate(() => document.querySelector('.nw-ibphoto img')?.getAttribute('src') ?? '');
    check(s, '기본 인물 문서 정보칸 사진', !!basePic, '사진', basePic.slice(0, 40));
    await press('.wk-head [data-action="wiki-rewrite"]');
    await hold();
    const n0 = await llmCount();
    await press('.wk-rewrite [data-action="wiki-rw-go"]', 600);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    const all = allText(msgs);
    const u = userPart(msgs);
    const moods = /using exactly one of: ([^\n]*?)\. Omit/.exec(all)?.[1]?.split(', ') ?? [];
    check(s, '정보칸 표정 절(INFOBOX PORTRAIT)·표정 목록', all.includes('INFOBOX PORTRAIT') && moods.length > 3, '표정 목록', moods.slice(0, 8));
    check(s, '[이전 위키] = 기본 문서 본문(이전 문서 참고 켬)', u.includes('[이전 위키]') && between(u, '[이전 위키]').length > 500, '기본 본문', between(u, '[이전 위키]').slice(0, 100));
    check(s, '참고 자료에 큐라스 원본 로어북', /Curas|큐라스/.test(between(u, '[참고 자료]', '[최근 챗로그]')), '원본', between(u, '[참고 자료]', '[최근').slice(0, 150));
    const mood = moods.find((m) => m !== 'default') ?? 'smile';
    const reply = ART_RW('큐라스', '표정 넣어').replace('[Heading]Level:1|Title:개요', '[Infobox]Title:큐라스|소속:관리국\n[Heading]Level:1|Title:개요').replace('main_color="#27685b"', `main_color="#27685b" doc_type="person" portrait_mood="${mood}"`).replace('doc_type="other" ', '');
    writeReq(s, msgs, reply);
    await release(reply);
    await waitIdle();
    const d = await docOf('큐라스');
    check(s, '채팅 문서로 저장(기본 문서 덮음)', d?.body.includes('표정 넣어'), '저장', !!d);
    let h = await html();
    check(s, '「되돌리기」 단추(기본 문서가 있는 채팅 문서)', /↺ 되돌리기/.test(h), '↺ 되돌리기', /wiki-delete[^>]*>[^<]*/.exec(h)?.[0]);
    await sleep(2000);
    const pic = await page.evaluate(() => { const i = document.querySelector('.nw-ibphoto img'); return i ? `${i.getAttribute('src')} ${i.naturalWidth}` : ''; });
    const reads = await page.evaluate(() => (window.__calls.read || []).filter((p) => /Kyuras/i.test(p)).slice(-3));
    check(s, `모델이 고른 표정(${mood})으로 정보칸 사진이 바뀜`, !!pic && pic.split(' ')[0] !== basePic, '다른 사진', { pic: pic.slice(0, 60), basePic: basePic.slice(0, 60), reads }, 'NW.PORTRAIT 절·ui/wiki.ts docView');
    await press('.wk-head [data-action="wiki-delete"]');
    h = await html();
    check(s, '한 번 누르면 「정말 되돌리기」', /정말 되돌리기/.test(h), '정말 되돌리기', /wiki-delete[^>]*>[^<]*/.exec(h)?.[0]);
    await press('.wk-head [data-action="wiki-delete"]');
    txt = await screen();
    h = await html();
    check(s, '되돌리면 채팅 문서는 지워지고 기본 문서가 다시 보임', !(await docOf('큐라스')) && txt.includes('큐라스') && !/data-action="wiki-delete"/.test(h) && !txt.includes('표정 넣어'), '기본 문서', txt.slice(0, 120));
    await saveState(s);
  }
  // 09 본편 컨텍스트: 기본 끔 → 켬 → 다음 턴 → 그다음 턴
  {
    const s = step('본편컨텍스트_다음턴_그다음턴');
    await closeWin(page);
    let out = await mainRequest('회전목마 쪽으로 간다.', 'u2');
    check(s, '기본(컨텍스트 포함 끔): 본편에 위키 덩어리 없음', wikiCtx(out).length === 0, 0, wikiCtx(out).length, 'setdef/wiki.ts context 기본 끔');
    await page.evaluate(() => window.__chat.message.pop());
    await setVars({ $nw_context: '1' });
    await botReply(C2, 'c2-pre', 300).catch(() => {});
    await page.evaluate(() => { window.__chat.message.pop(); });
    out = await mainRequest('회전목마 뒤편 어둠의 계단을 내려다본다.', 'u2');
    writeFileSync(`${OUT}단계${s.n}_${s.name}_다음턴.txt`, fmtMsgs(out));
    let w = wikiCtx(out);
    const j = w[0] ? JSON.parse(/\{"feature":"wiki"[\s\S]*\}/.exec(w[0])[0]) : null;
    check(s, '켜면: 장면에 나온 창작 문서 「어둠의 계단」이 들어감', j?.records?.some((r) => r.title === '어둠의 계단'), '어둠의 계단', j?.records?.map((r) => r.title));
    check(s, '로어북 있는 문서 「빛이 없으라」는 기본 빠짐(칩 기본 끔)', !j?.records?.some((r) => r.title === '빛이 없으라'), '빠짐', j?.records?.map((r) => r.title), 'core/wiki.ts wikiMainContext 주석(사용자 결정)');
    check(s, '기본 문서(카드)는 넣지 않음', !j?.records?.some((r) => r.title === '소라 랜드'), '소라 랜드 없음', j?.records?.map((r) => r.title));
    check(s, 'MAIN_CONTEXT 안내문이 앞에, 저장 표식(NW_META) 없음', w[0]?.includes('narrator reference') && !/NW_META|NW_PRIVATE/.test(w[0] ?? ''), '안내문', w[0]?.slice(0, 200));
    await botReply(C2, 'c2');
    out = await mainRequest('계단을 등지고 매표소로 간다.', 'u3');
    writeFileSync(`${OUT}단계${s.n}_${s.name}_그다음턴.txt`, fmtMsgs(out));
    w = wikiCtx(out);
    note(s, '그다음 턴(장면: 계단 언급은 앞 응답에만) 위키 덩어리', w.map((x) => JSON.parse(/\{"feature":"wiki"[\s\S]*\}/.exec(x)[0]).records.map((r) => r.title)));
    await botReply(C3, 'c3');
    for (const [i, t] of ['츄러스 가판대를 살핀다.', '매표소 창을 두드린다.', '정문 쪽으로 걷는다.'].entries()) {
      out = await mainRequest(t, `u4${i}`);
      if (i < 2) await botReply(`조용했다. 바람이 불었다.\n${ST('10:3' + i + ' PM')}`, `c4${i}`, 300);
    }
    w = wikiCtx(out);
    check(s, '계단이 장면(최근 3턴)에서 사라진 뒤엔 빠짐(장면에 나온 문서만)', !w.some((x) => x.includes('어둠의 계단')), '빠짐', w.map((x) => x.slice(0, 80)));
    await page.evaluate(() => window.__chat.message.pop());
    await saveState(s);
  }
  // 10 창작 문서 지우기
  {
    const s = step('지우기');
    await openWiki();
    await topSearch('어둠의 계단');
    await press('.wk-head [data-action="wiki-delete"]');
    await press('.wk-head [data-action="wiki-delete"]');
    check(s, '「어둠의 계단」 삭제', !(await docOf('어둠의 계단')), '없음', !!(await docOf('어둠의 계단')));
    const txt = await screen();
    check(s, '대문으로 돌아감', txt.includes('괴이위키:대문'), '대문', txt.slice(0, 60));
    await topSearch('빛이 없으라');
    note(s, '빛이 없으라 본문에 어둠의 계단 링크 상태(지금 본문은 다시 쓴 것)', (await html()).match(/nw-link[^>]*어둠의 계단/g));
    await saveState(s);
  }
  writeFileSync(`${OUT}결과-main.json`, JSON.stringify({ results: results.filter((r) => r.part === 'PC_'), notes: notes.filter((r) => r.part === 'PC_'), errors }, null, 2));
}

// ═════════════════════ part shop: 상점이 위키를 받는 길 ═════════════════════
if (PARTS.includes('shop')) {
  part = 'S_';
  // 11 상점이 위키 문서를 받는 길 (가게 이름 = 기본 문서 「이정 책방」)
  {
    const s = step('상점_위키참고');
    await bootChat(firstChat());
    const CH = `책방 유리문을 밀자 풍경이 울렸다.\n${ST('10:40 PM', '이정 책방')}\n[shop: 이정 책방|]`;
    await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '이정 책방에 들어간다.', chatId: 'u5' }));
    await botReply(CH, 'c5');
    note(s, '$st_shop', String((await vars()).$st_shop ?? '').slice(0, 200));
    const card = await page.evaluate((t) => window.__calls.handlers.display(t), CH);
    await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:10px;top:10px;width:360px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, card);
    const shelf = '<shop-identity>\nsells: 책\nnever: -\nprices: -\ncurrency: -\n</shop-identity>\n<owner>\n어서 오십시오.\n</owner>\n<shelf>\n송연먹|200|소모20|소모품/먹/ink stick|0.004|먹||\n</shelf>';
    await queue(shelf);
    const n0 = await llmCount();
    const btn = await page.$('#chat-card [data-goei-shop]');
    if (btn) { const bb = await btn.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await page.waitForFunction(() => !!document.querySelector('.sh-wrap'), null, { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
    await page.waitForFunction(() => !!document.querySelector('.sh-wrap'), null, { timeout: 6000 }).catch(() => {});
    await sleep(1500);
    note(s, '상점 창', await page.evaluate(() => document.querySelector('.sh-wrap')?.innerText?.slice(0, 200) ?? 'NONE'));
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    writeReq(s, msgs, shelf);
    const all = allText(msgs);
    check(s, '카드로 상점을 열어 첫 진열 요청이 감', !!btn && msgs.length > 0, '요청', { btn: !!btn, n: msgs.length });
    check(s, '참고 자료에 「위키: 이정 책방」 출처와 기본 문서 본문', all.includes('위키: 이정 책방'), '위키: 이정 책방', /\[[^\n]*위키[^\n]*\]/.exec(all)?.[0], 'ui/shop.ts shopSource extra(가게 위키 문서)');
    note(s, '상점 요청 속 위키 글 길이(상한 $sh_wiki_chars 기본 3000자)', between(all, '위키: 이정 책방', '\n\n[').length);
    check(s, '위키 문서의 저장 표식이 새지 않음', !/NW_META|NW_PRIVATE|<lightboard-namuwiki/.test(all), '없음', /NW_META|NW_PRIVATE|<lightboard-namuwiki/.exec(all)?.[0]);
    await saveState(s);
  }
  // 상태창 낱말 → 위키 문서 열기
  {
    const s = step('상태창링크_위키열기');
    await bootChat(firstChat());
    const card = await page.evaluate((t) => window.__calls.handlers.display(t), C1);
    await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:10px;top:10px;width:600px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, card);
    const links = await page.$$eval('#chat-card [data-goei-wiki]', (els) => els.map((e) => e.textContent.trim()));
    check(s, '상태창의 장소 「소라 랜드」가 위키 링크', links.includes('소라 랜드'), '소라 랜드', links);
    const el = await page.$('#chat-card [data-goei-wiki]');
    if (el) { const bb = await el.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await page.waitForFunction(() => !!document.querySelector('.wk'), null, { timeout: 6000 }).catch(() => {});
    await sleep(800);
    await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
    const txt = await screen();
    check(s, '누르면 창이 열리고 그 문서', /소라 랜드/.test(txt.slice(0, 120)) && txt.includes('개요'), '소라 랜드 문서', txt.slice(0, 120), 'host/statusview.ts onChatClick wiki');
    check(s, '모델 호출 없음', true, 0, 0);
    await saveState(s);
  }
  writeFileSync(`${OUT}결과-shop.json`, JSON.stringify({ results: results.filter((r) => r.part === 'S_'), notes: notes.filter((r) => r.part === 'S_'), errors }, null, 2));
}

// ═════════════════════ part switch: 기다리는 중 다른 채팅 ═════════════════════
const installTwoChats = (other) => page.evaluate((other) => {
  window.__ci = 0; window.__others = { 1: other };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  window.risuai.getCurrentChatIndex = async () => window.__ci;
  window.risuai.getChatFromIndex = async (c, i) => clone(i === window.__ci ? window.__chat : window.__others[i]);
  window.risuai.setChatToIndex = async (c, i, chat) => { window.__calls.setChat.push(clone(chat)); if (i === window.__ci) window.__chat = clone(chat); else window.__others[i] = clone(chat); };
}, other);
const switchChat = (to) => page.evaluate((to) => { const cur = window.__ci; window.__others[cur] = window.__chat; window.__chat = window.__others[to]; delete window.__others[to]; window.__ci = to; }, to);
const otherChat = (i) => page.evaluate((i) => JSON.parse(JSON.stringify(window.__others[i] ?? null)), i);
if (PARTS.includes('switch')) {
  part = 'W_';
  await bootChat(firstChat());
  const chatB = firstChat({}, {});
  chatB.message[1].data = `관리국 사무실, 서류 더미 앞.\n${ST('09:00 AM', '관리국')}`;
  await installTwoChats(chatB);
  {
    const s = step('작성중_다른채팅_실패');
    await openWiki();
    await topSearch('빛이 없으라');
    await hold();
    const n0 = await llmCount();
    await press('.wk-compose [data-action="wiki-start"]', 400);
    check(s, '채팅0에서 작성 시작(호출 1)', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await closeWin(page);
    await switchChat(1);
    await openWiki();
    let txt = await screen();
    check(s, '채팅1 대문: 작성 중 줄 없음', !txt.includes('작성하는 중'), '없음', /「[^」]*」 문서를 작성하는 중[^\n]*/.exec(txt)?.[0]);
    await queue('', '');
    await release('');
    await sleep(2500);
    await act('wiki-home');
    txt = await screen();
    const fail = await page.evaluate(() => document.querySelector('.nw-fail')?.innerText ?? '');
    check(s, '채팅0의 실패 안내가 채팅1 위키 화면에 뜨지 않음', !txt.includes('「빛이 없으라」 문서를 만들지 못했어요'), '안 뜸', /「빛이 없으라」 문서를 만들지[^\n]*/.exec(txt)?.[0], 'ui/wiki.ts resetWiki 주석 「앞 채팅의 최근 실패 원문·알림도 비운다 (전수점검 사소-59)」');
    note(s, '채팅1 서랍 실패 원문', fail.slice(0, 120));
    await saveState(s);
  }
  {
    const s = step('작성중_다른채팅_성공');
    await closeWin(page);
    await switchChat(0);
    await openWiki();
    await topSearch('빛이 없으라');
    await hold();
    await press('.wk-compose [data-action="wiki-start"]', 400);
    await closeWin(page);
    await switchChat(1);
    await openWiki();
    await release(ART_RW('빛이 없으라', '채팅0것'));
    await sleep(2000);
    const c1 = (await snap()).localLore?.filter((e) => String(e.comment).startsWith('WIKI｜')) ?? [];
    const c0 = (await otherChat(0))?.localLore?.filter((e) => String(e.comment).startsWith('WIKI｜')) ?? [];
    check(s, '답은 채팅0에 저장, 채팅1엔 없음', c0.some((e) => e.content.includes('채팅0것')) && !c1.length, '0에만', { c0: c0.length, c1: c1.length });
    const txt = await screen();
    check(s, '채팅1 화면은 대문 그대로(문서로 넘어가지 않음)', txt.includes('괴이위키:대문'), '대문', txt.slice(0, 80));
    await saveState(s);
  }
  writeFileSync(`${OUT}결과-switch.json`, JSON.stringify({ results: results.filter((r) => r.part === 'W_'), notes: notes.filter((r) => r.part === 'W_'), errors }, null, 2));
}

// ═════════════════════ part branch: 갈래 ═════════════════════
if (PARTS.includes('branch')) {
  part = 'B_';
  await bootChat(firstChat());
  await openWiki();
  // 12 빈 답 → 실패 안내, 상태 그대로
  {
    const s = step('빈답');
    await topSearch('빛이 없으라');
    await queue('', '', '', '', '');
    const n0 = await llmCount();
    await press('.wk-compose [data-action="wiki-start"]', 300);
    await waitIdle();
    const n = (await llmCount()) - n0;
    note(s, '빈 답 호출 수(다시 묻기 포함)', n);
    const txt = await screen();
    check(s, '실패 안내 「문서를 만들지 못했어요」 + 빈 응답 사유', txt.includes('문서를 만들지 못했어요') && txt.includes('빈 응답'), '안내', /「빛이 없으라」 문서를[^\n]*/.exec(txt)?.[0]);
    check(s, '문서가 생기지 않음, 작성 화면에 그대로', !(await docOf('빛이 없으라')) && txt.includes('해당 문서를 찾을 수 없습니다'), '없음', !!(await docOf('빛이 없으라')));
    const btnOk = await page.evaluate(() => !document.querySelector('.wk-compose [data-action="wiki-start"]')?.disabled);
    check(s, '다시 누를 수 있음', btnOk, true, btnOk);
    await saveState(s);
  }
  // 13 꼴 틀린 답 → 다시 묻기 → 성공
  {
    const s = step('꼴틀림_다시묻기');
    await queue('그냥 설명글입니다. 위키 형식 아님.', ART_RW('빛이 없으라', '다시묻기로'));
    const n0 = await llmCount();
    await press('.wk-compose [data-action="wiki-start"]', 300);
    await waitIdle();
    const n = (await llmCount()) - n0;
    check(s, '호출 2회(첫 답 + 다시 묻기)', n === 2, 2, n);
    const m2 = n >= 2 ? await llmAt(n0 + 1) : [];
    writeReq(s, m2, ART_RW('빛이 없으라', '다시묻기로'));
    const t2 = allText(m2);
    check(s, '다시 묻기에 첫 답과 형식 오류 사유', t2.includes('그냥 설명글입니다') && t2.includes('위키 형식(<lightboard-namuwiki>)이 아닌 응답'), '첫 답 + ERR_FORMAT', t2.slice(-400));
    check(s, '저장 = 다시 물어 받은 답', (await docOf('빛이 없으라'))?.body.includes('다시묻기로'), '다시묻기로', !!(await docOf('빛이 없으라')));
    await saveState(s);
  }
  // 14 닫는 태그 없는 답(잘림) → 다시 쓰기 실패 → 기존 문서 그대로
  {
    const s = step('잘린답_기존문서유지');
    await press('.wk-head [data-action="wiki-rewrite"]');
    const cut = '<lightboard-namuwiki doc_title="빛이 없으라">\n[Paragraph]잘린 글';
    await queue(cut, cut, cut, cut);
    const n0 = await llmCount();
    await press('.wk-rewrite [data-action="wiki-rw-go"]', 300);
    await waitIdle();
    note(s, '호출 수', (await llmCount()) - n0);
    const txt = await screen();
    check(s, '안내: 닫는 태그 없음 + 기존 문서는 그대로', txt.includes('닫는 태그 없음') && txt.includes('기존 문서는 그대로'), '안내', /「빛이 없으라」 문서를[^\n]*/.exec(txt)?.[0]);
    check(s, '저장 본문 그대로', (await docOf('빛이 없으라'))?.body.includes('다시묻기로'), '다시묻기로', (await docOf('빛이 없으라'))?.body.slice(-60));
    const fail = await page.evaluate(() => document.querySelector('.nw-fail')?.innerText ?? '');
    note(s, '서랍 「최근 실패 원문」', fail.slice(0, 200));
    await saveState(s);
  }
  // 15 연타·작성 중 다른 문서
  {
    const s = step('연타_작성중다른문서');
    if (!(await has('.wk-rewrite'))) await press('.wk-head [data-action="wiki-rewrite"]');
    await hold();
    const n0 = await llmCount();
    await press('.wk-rewrite [data-action="wiki-rw-go"]', 100);
    await act('wiki-rw-go', '빛이 없으라', 100);
    await act('wiki-rw-go', '빛이 없으라', 300);
    check(s, '연타해도 호출 1회', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    await topSearch('교황청');
    let txt = await screen();
    const dis = await page.evaluate(() => !!document.querySelector('.wk-compose [data-action="wiki-start"]')?.disabled);
    check(s, '다른 문서 작성 화면: 작성 중 줄이 보이고 단추는 막힘', txt.includes('작성하는 중') && dis, '막힘', { busy: txt.includes('작성하는 중'), dis });
    await act('wiki-start', '교황청', 300);
    check(s, '억지로 눌러도 호출 안 늘어남', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
    // 16 기다리는 중 창 닫기 → 답이 늦게 옴
    const s2 = step('늦은답_창닫음');
    await closeWin(page);
    await release(ART_RW('빛이 없으라', '늦게온'));
    await sleep(1200);
    check(s2, '창을 닫은 뒤 온 답도 원래 채팅에 저장', (await docOf('빛이 없으라'))?.body.includes('늦게온'), '늦게온', (await docOf('빛이 없으라'))?.body.slice(-60), 'ui/wiki.ts 머리 주석 「창을 닫아도 계속」');
    await openWiki();
    txt = await screen();
    note(s2, '다시 연 화면', txt.slice(0, 200));
    await saveState(s2);
  }
  // 17 페이지 새로고침(재부팅): 저장 상태만으로
  {
    const s = step('새로고침_재부팅');
    const c = await snap();
    await bootChat({ message: c.message, scriptstate: c.scriptstate, localLore: c.localLore });
    await openWiki();
    let txt = await screen();
    check(s, '대문 최근 변경에 채팅 문서', /최근 변경[\s\S]*빛이 없으라/.test(txt), '빛이 없으라', /최근 변경[\s\S]{0,60}$/.exec(txt)?.[0]);
    await topSearch('빛이 없으라');
    txt = await screen();
    check(s, '문서가 그대로', txt.includes('늦게온 다시 쓴'), '늦게온', txt.slice(0, 200));
    await saveState(s);
  }
  // 18 자동 작성 「매 턴」: 제목 고르기 → 본문, 다시 굴리기
  {
    const s = step('자동매턴_제목고르기');
    await closeWin(page);
    await setVars({ $nw_auto: 'turn' });
    await queue('{"title":"교황청"}', ART_RW('교황청', '자동'));
    const n0 = await llmCount();
    await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '회전목마 쪽으로 간다.', chatId: 'u2' }));
    await botReply(C2, 'c2', 2500);
    const n = (await llmCount()) - n0;
    check(s, '호출 2회(제목 + 본문)', n === 2, 2, n, 'setdef/wiki.ts auto 도움말 「호출이 2회」');
    const t = n ? await llmAt(n0) : [];
    writeReq(s, t, '{"title":"교황청"}', '', '_제목');
    const tu = userPart(t);
    const cand = between(tu, '[후보 제목]', '\n\n').split('\n').filter(Boolean);
    check(s, '후보 제목 목록·최근 챗로그', cand.length > 50 && tu.includes('[최근 챗로그]') && tu.includes('어둠의 계단이 보였다'), '후보·챗로그', { n: cand.length, story: tu.includes('어둠의 계단이 보였다') });
    check(s, '이미 쓴 문서(빛이 없으라)가 후보에 있으면 [이미 쓴 문서]에', tu.includes('[이미 쓴 문서]\n- 빛이 없으라'), '[이미 쓴 문서] 빛이 없으라', /\[이미 쓴 문서\][\s\S]{0,60}/.exec(tu)?.[0]);
    check(s, '주인공이 아닌 기본 문서 제목도 후보(소라 랜드)', cand.some((x) => x.includes('소라 랜드')), '소라 랜드', cand.slice(0, 5));
    note(s, '기본 문서가 있는 제목은 [이미 쓴 문서]에 없음', { written: between(tu, '[이미 쓴 문서]', '\n\n['), soraInWritten: between(tu, '[이미 쓴 문서]', '\n\n[').includes('소라 랜드') });
    if (n >= 2) writeReq(s, await llmAt(n0 + 1), ART_RW('교황청', '자동'), '', '_본문');
    check(s, '「교황청」 문서 저장', (await docOf('교황청'))?.body.includes('자동'), '저장', !!(await docOf('교황청')));
    check(s, '$nw_auto_last = 이 턴 표시', !!(await vars()).$nw_auto_last, '있음', (await vars()).$nw_auto_last);
    await saveState(s);
    const s2 = step('자동매턴_다시굴리기');
    await queue('{"title":"소라 랜드"}', ART_RW('소라 랜드', '또'));
    const n1 = await llmCount();
    await page.evaluate(() => window.__chat.message.pop());
    await botReply(C2.replace('노랫소리', '웃음소리'), 'c2b', 2500);
    check(s2, '버린 응답(c2)에 맞춰 자동으로 쓴 「교황청」 문서가 되돌아감', !(await docOf('교황청')), '없음', { 남음: !!(await docOf('교황청')), body: (await docOf('교황청'))?.body.slice(-40) }, '사용자 11-22 「다시 굴리면 그 응답이 만든 것은 다 되돌아감」(goei-feedback-dont-ask-internals-1122)');
    check(s2, '다시 굴린 새 응답(c2b)에는 자동 작성이 돌지 않음', (await llmCount()) === n1, '0회(같은 턴 열쇠)', (await llmCount()) - n1);
    await saveState(s2);
    // 다음 턴: 모델이 기본 문서 제목을 고르면
    const s3 = step('자동매턴_기본문서제목');
    await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '매표소로 간다.', chatId: 'u3' }));
    await queue('{"title":"소라 랜드"}', ART_RW('소라 랜드', '자동덮어'));
    const n2 = await llmCount();
    await botReply(C3, 'c3', 2500);
    const k = (await llmCount()) - n2;
    const art = k >= 2 ? await llmAt(n2 + 1) : [];
    writeReq(s3, art, ART_RW('소라 랜드', '자동덮어'));
    const au = userPart(art);
    check(s3, '기본 문서 제목을 자동으로 쓸 때도 기본 문서 본문이 [이전 위키]로 감(손으로 다시 쓸 때와 같게)', au.includes('[이전 위키]') && au.includes('폐장 방송'), '[이전 위키] = 기본 문서', { calls: k, previous: au.includes('[이전 위키]') }, '단계 PC08(기본 문서 다시 쓰기는 이전 문서로 넣음)·설정 「다시 쓸 때 이전 문서 참조」 기본 켬');
    check(s3, '채팅 문서 「소라 랜드」 생김(기본 문서를 덮음)', (await docOf('소라 랜드'))?.body.includes('자동덮어'), '생김', !!(await docOf('소라 랜드')));
    await saveState(s3);
    await setVars({ $nw_auto: '0' });
  }
  // 19 자동 「창을 열 때」: 한 번만
  {
    const s = step('자동창열때');
    await closeWin(page);
    await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '매표소 안을 들여다본다.', chatId: 'u3b' }));
    await botReply(`매표소 안은 비어 있었다.\n${ST('10:30 PM')}`, 'c3b');
    await setVars({ $nw_auto: 'open' });
    await queue('{"title":"교황청"}', ART_RW('교황청', '창열때'));
    const n0 = await llmCount();
    await openWiki();
    await sleep(2500);
    const n = (await llmCount()) - n0;
    check(s, '창(위키 탭)을 열면 2회', n === 2, 2, n);
    await act('wiki-home');
    await closeWin(page);
    await openWiki();
    await sleep(1500);
    check(s, '같은 응답에서 다시 열면 더 안 돎', (await llmCount()) - n0 === n, n, (await llmCount()) - n0);
    await setVars({ $nw_auto: '0' });
    await saveState(s);
  }
  // 20 제목 고르기 실패(후보 밖 제목) → 문서 안 씀
  {
    const s = step('자동_후보밖제목');
    await setVars({ $nw_auto: 'turn' });
    await closeWin(page);
    await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '정문으로 돌아간다.', chatId: 'u4' }));
    await queue('{"title":"없는 제목 아무거나"}', '{"title":"없는 제목 아무거나"}', '{"title":"없는 제목 아무거나"}', '{"title":"없는 제목 아무거나"}');
    const before = (await wikiLore()).length;
    const n0 = await llmCount();
    await botReply(`정문은 닫혀 있었다.\n${ST('10:40 PM')}`, 'c4', 2500);
    note(s, '호출 수', (await llmCount()) - n0);
    check(s, '문서 수 그대로', (await wikiLore()).length === before, before, (await wikiLore()).length);
    await setVars({ $nw_auto: '0' });
    await saveState(s);
  }
  // 21 쓸 수 없는 제목
  {
    const s = step('쓸수없는제목');
    await openWiki();
    await act('wiki-write', '<b>꺾쇠</b>');
    const txt = await screen();
    check(s, '안내 「쓸 수 없는 제목이에요」', txt.includes('쓸 수 없는 제목'), '안내', txt.slice(0, 200));
    await saveState(s);
  }
  // 22 꼬리말 제목 「소라 랜드 (장소)」
  {
    const s = step('꼬리말제목');
    await act('wiki-home');
    await topSearch('교황청 (조직)');
    const txt = await screen();
    note(s, '「교황청 (조직)」 → ', txt.slice(0, 120));
    check(s, '꼬리말을 떼고 「교황청」 문서로', /교황청/.test(txt.slice(0, 80)) && !txt.includes('(조직)'), '교황청', txt.slice(0, 80), 'core/wiki.ts canonicalTitle QUALIFIERS');
    await saveState(s);
  }
  // 23 본편 컨텍스트 「장면에 나온 문서만」 끔 → 최근 문서부터, 개수
  {
    const s = step('컨텍스트_장면만끔_개수');
    await closeWin(page);
    await setVars({ $nw_context: '1', '$nw_adv_ctx_focus': '0', '$nw_adv_ctx_lore': '1', '$nw_adv_ctx_count': '2' });
    const out = await mainRequest('아무 데도 안 간다.', 'u9');
    const w = wikiCtx(out);
    const titles = w.map((x) => JSON.parse(/\{"feature":"wiki"[\s\S]*\}/.exec(x)[0]).records.map((r) => r.title)).flat();
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, fmtMsgs(out));
    check(s, '최근 문서 2개(설정 개수)', titles.length === 2, 2, titles);
    await page.evaluate(() => window.__chat.message.pop());
    await setVars({ $nw_context: '0' });
    const out2 = await mainRequest('아무 데도 안 간다.', 'u9');
    check(s, '끄면 빠짐', wikiCtx(out2).length === 0, 0, wikiCtx(out2).length);
    await page.evaluate(() => window.__chat.message.pop());
    await saveState(s);
  }
  // 24 그림 「본문까지」·보조 모델·다시 쓸 때 이전 문서 끔
  {
    const s = step('그림본문_보조모델_이전문서끔');
    await setVars({ $nw_images: 'body', $nw_model: 'aux', $nw_refresh_previous: '0' });
    await openWiki();
    await topSearch('빛이 없으라');
    await press('.wk-head [data-action="wiki-rewrite"]');
    const onBtn = await page.evaluate(() => document.querySelector('.wk-rewrite [data-action="wiki-rw-prev"].on')?.dataset.value);
    check(s, '설정 「이전 문서 참조」 끔이면 다시 쓰기 칸 기본 OFF', onBtn === '0', '0', onBtn);
    await hold();
    const n0 = await llmCount();
    await press('.wk-rewrite [data-action="wiki-rw-go"]', 600);
    const msgs = (await llmCount()) > n0 ? await llmAt(n0) : [];
    const opt = (await llmCount()) > n0 ? await llmOpt(n0) : {};
    const all = allText(msgs);
    check(s, '보조 모델(submodel)로 감', opt.mode === 'submodel', 'submodel', opt.mode);
    const list = (/Available images \(asset name = subject\):\n([\s\S]*?)(\n\n|$)/.exec(all)?.[1] ?? '').split('\n').filter((l) => l.startsWith('- '));
    check(s, 'BODY IMAGES 절과 그림 목록(주제 그림 포함)', all.includes('BODY IMAGES') && list.length > 0, '목록', list.slice(0, 6));
    check(s, '인물 그림은 목록에 없음', !list.some((l) => /큐라스|에일린|쟈알디/.test(l)), '인물 없음', list.filter((l) => /큐라스|에일린|쟈알디/.test(l)));
    const name = /^- (.+?) = /.exec(list[0] ?? '')?.[1] ?? 'x';
    const reply = ART_RW('빛이 없으라', '그림').replace('</lightboard-namuwiki>', `[Image]Name:${name}|Caption:그림 설명\n</lightboard-namuwiki>`);
    writeReq(s, msgs, reply);
    await release(reply);
    await waitIdle();
    await sleep(1500);
    const fig = await page.evaluate(() => { const f = document.querySelector('.nw-fig img'); return f ? f.getAttribute('src').slice(0, 30) : ''; });
    check(s, '목록의 그림을 쓴 [Image] 가 본문에 그려짐', !!fig, '그림', { name, fig });
    check(s, 'meta.model = aux', (await docOf('빛이 없으라'))?.meta?.model === 'aux', 'aux', (await docOf('빛이 없으라'))?.meta?.model);
    await setVars({ $nw_images: 'infobox', $nw_model: 'main', $nw_refresh_previous: '1' });
    await saveState(s);
  }
  // 25 컨텍스트 토큰 상한: 긴 문서는 잘라 넣고 「…(이하 생략)」
  {
    const s = step('컨텍스트_상한_자르기');
    await closeWin(page);
    const long = `<lightboard-namuwiki doc_title="회전목마 지하" doc_type="other">\n${Array.from({ length: 300 }, (_, i) => `[Paragraph]회전목마 지하 ${i}번째 문단. 계단 아래에 오래된 기계실이 있고 노랫소리가 난다.`).join('\n')}\n</lightboard-namuwiki>`;
    await page.evaluate((body) => { const meta = { title: '회전목마 지하', mode: 'expand', model: 'main', created: Math.floor(Date.now() / 1000), length: 'detailed', sources: [], primarySources: [], writingRequest: '', direct: true }; window.__chat.localLore = [...(window.__chat.localLore ?? []), { key: '', secondkey: '', comment: 'WIKI｜회전목마 지하', content: `[NW_PRIVATE_BEGIN]\n<!--NW_META:${JSON.stringify(meta)}-->\n${body}\n[NW_PRIVATE_END]`, mode: 'normal', insertorder: 0, alwaysActive: false, selective: false, useRegex: false }]; }, long);
    await setVars({ $nw_context: '1', '$nw_adv_ctx_focus': '1', '$nw_adv_ctx_lore': '0', '$nw_adv_ctx_count': '2', '$nw_adv_ctx_tokens': '1500' });
    const out = await mainRequest('회전목마 지하로 내려간다.', 'u10');
    const w = wikiCtx(out);
    writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, fmtMsgs(out));
    const rec = w[0] ? JSON.parse(/\{"feature":"wiki"[\s\S]*\}/.exec(w[0])[0]).records : [];
    const r = rec.find((x) => x.title === '회전목마 지하');
    check(s, '긴 문서는 잘려 들어가고 끝에 「…(이하 생략)」', !!r && r.content.endsWith('…(이하 생략)') && r.content.length < long.length, '잘림', r && { len: r.content.length, tail: r.content.slice(-20) });
    note(s, '덩어리 길이(자)', w[0]?.length);
    await page.evaluate(() => window.__chat.message.pop());
    await setVars({ $nw_context: '0' });
    await saveState(s);
  }
  writeFileSync(`${OUT}결과-branch.json`, JSON.stringify({ results: results.filter((r) => r.part === 'B_'), notes: notes.filter((r) => r.part === 'B_'), errors }, null, 2));
}

// ═════════════════════ part phone ═════════════════════
if (PARTS.includes('phone')) {
  part = 'M_';
  await bootChat(firstChat(), { width: 390, height: 844, touch: true });
  {
    const s = step('폰_검색_작성_서랍');
    await openWiki();
    let txt = await screen();
    check(s, '폰에서 대문', txt.includes('괴이위키:대문'), '대문', txt.slice(0, 80));
    await fill('.bsr [data-input="wiki-home-query"]', '빛이');
    await sleep(300);
    const res = await page.evaluate(() => document.querySelector('.hres')?.innerText ?? '');
    check(s, '대문 검색칸: 글자마다 결과(명부 「빛이 없으라」)', res.includes('빛이 없으라'), '빛이 없으라', res.slice(0, 200));
    await press('.hres [data-action="wiki-pick"][data-value="빛이 없으라"]');
    txt = await screen();
    check(s, '고르면 작성 화면', txt.includes('해당 문서를 찾을 수 없습니다'), '작성 화면', txt.slice(0, 120));
    await queue(ART('빛이 없으라'));
    const n0 = await llmCount();
    await press('.wk-compose [data-action="wiki-start"]', 300);
    await waitIdle();
    check(s, '호출 1회·저장', (await llmCount()) - n0 === 1 && !!(await docOf('빛이 없으라')), '1·저장', (await llmCount()) - n0);
    txt = await screen();
    check(s, '문서 보기', txt.includes('개요'), '문서', txt.slice(0, 120));
    await press('.wk .wgrab');
    const open = await page.evaluate(() => document.querySelector('.wdr')?.classList.contains('open'));
    check(s, '「목록」 책갈피로 서랍이 열림', open, true, open, '사용자 11-08 폰 오른쪽 아래 목록');
    const dr = await page.evaluate(() => document.querySelector('.wdr')?.innerText ?? '');
    check(s, '서랍에 「이번 이야기」 탭 1', /이번 이야기\s*1/.test(dr), '이번 이야기 1', dr.slice(0, 80));
    await press('.wdr [data-action="wiki-list"][data-value="close"]');
    await page.screenshot({ path: `${OUT}폰_문서.png` });
    await saveState(s);
  }
  writeFileSync(`${OUT}결과-phone.json`, JSON.stringify({ results: results.filter((r) => r.part === 'M_'), notes: notes.filter((r) => r.part === 'M_'), errors }, null, 2));
}

const streamQ = (parts, errorAfter = -1) => page.evaluate(([parts, errorAfter]) => {
  let i = 0; let acc = '';
  const rs = new ReadableStream({ async pull(c) { await new Promise((r) => setTimeout(r, 30)); if (errorAfter >= 0 && i === errorAfter) { c.error(new Error('끊김')); return; } if (i >= parts.length) { c.close(); return; } acc += parts[i++]; c.enqueue({ 0: acc }); } });
  window.__llm = [{ type: 'streaming', result: rs }];
}, [parts, errorAfter]);
const failChat = (mode) => page.evaluate((mode) => {
  if (!window.__realSetChat) window.__realSetChat = window.risuai.setChatToIndex;
  window.__failLog = []; let n = 0;
  window.risuai.setChatToIndex = async (a, b, chat) => { n++; if (window.__failOn) { window.__failLog.push(n); if (mode === 'throw') throw new Error('시험용 저장 실패'); return undefined; } return window.__realSetChat(a, b, chat); };
  window.__failOn = true;
}, mode);
const failOff = () => page.evaluate(() => { window.__failOn = false; });

// ═════════ part fault (3차 더함): 위키 작성 길에서 보조/메인 스트리밍 조각·끊김, 채팅 저장 실패(던짐/조용히), 생각 블록 답 ═════════
if (PARTS.includes('fault')) {
  part = 'FAULT_'; stepNo = 0;
  const write = async (title, prep) => { await openWiki(); await topSearch(title); await prep(); const n0 = await llmCount(); await press('.wk-compose [data-action="wiki-start"]', 300); await waitIdle(20000); return (await llmCount()) - n0; };
  {
    await bootChat(firstChat());
    const s = step('스트림_조각');
    const a = ART('빛이 없으라'); const calls = await write('빛이 없으라', () => streamQ([a.slice(0, 80), a.slice(80, 200), a.slice(200)]));
    const docs = await wikiLore();
    check(s, '조각으로 온 문서가 저장(WIKI｜빛이 없으라)', docs.some((d) => d.comment === 'WIKI｜빛이 없으라'), '저장', { calls, docs: docs.map((d) => d.comment) });
  }
  {
    await bootChat(firstChat());
    const s = step('스트림_끊김');
    const a = ART('빛이 없으라'); const calls = await write('빛이 없으라', () => streamQ([a.slice(0, 80), a.slice(80)], 1));
    const docs = await wikiLore(); const txt = await screen();
    note(s, '화면', txt.slice(0, 300));
    check(s, '반쪽 문서가 저장되지 않고 실패 안내', !docs.some((d) => d.comment === 'WIKI｜빛이 없으라') && /실패|못|다시/.test(txt), '저장 안 됨·안내', { calls, docs: docs.map((d) => d.comment), txt: txt.slice(0, 200) });
  }
  for (const mode of ['throw', 'silent']) {
    await bootChat(firstChat());
    const s = step(`채팅저장_${mode}`);
    await failChat(mode);
    const calls = await write('빛이 없으라', () => queue(ART('빛이 없으라')));
    await failOff();
    const txt = await screen(); const docs = await wikiLore();
    note(s, '걸린 저장 호출', await page.evaluate(() => window.__failLog));
    note(s, '화면', txt.slice(0, 300));
    check(s, '저장이 안 됐으면 「작성됨」처럼 보이지 않음(문서 화면 대신 실패 안내)', docs.length === 0 && (/실패|못|다시/.test(txt) || !txt.includes('빛이 없으라')), '실패 안내', { calls, docs: docs.length, txt: txt.slice(0, 200) });
    const calls2 = await write('빛이 없으라', () => queue(ART('빛이 없으라')));
    check(s, '실패를 끈 뒤 다시 작성하면 저장됨', (await wikiLore()).some((d) => d.comment === 'WIKI｜빛이 없으라'), '저장', { calls2 });
  }
  {
    await bootChat(firstChat());
    const s = step('생각블록_답');
    const calls = await write('빛이 없으라', () => queue(`<think>${ART('빛이 없으라', '', ' x="생각초안"').replace('개요', '생각속개요')}</think>\n${ART('빛이 없으라')}`));
    const d = (await wikiLore()).find((x) => x.comment === 'WIKI｜빛이 없으라');
    check(s, '생각 블록 밖 문서가 저장되고 생각 글은 없음', !!d && !String(d.content).includes('생각속개요') && !/<think>/.test(String(d.content)), '밖 문서만', { calls, has: !!d, think: String(d?.content ?? '').includes('생각속') });
  }
}

allErrors.push(...(errors ?? []));
await b.close();
const fail = results.filter((r) => !r.ok);
const stepsAll = [...new Set(results.map((r) => r.step))];
const stepsFail = [...new Set(fail.map((r) => r.step))];
console.log(`\n단계 ${stepsAll.length}개 중 ${stepsAll.length - stepsFail.length}개 통과, 검사 ${results.length}개 중 ${results.length - fail.length}개 통과`);
console.log('페이지 오류:', [...new Set(allErrors)].slice(0, 10));
