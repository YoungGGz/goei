// 플레이 순서 점검 2차 · 13 이미지 태그·에셋·사진 (지침: ../../GPT_점검지침_초안.md 3판)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄운다.
// 기록 자리: 본편 = window.__calls.replacers[0] 반환값, 응답 처리 = output 리스너(window.__calls.listeners[0]), 보조 호출 = risuai.runLLMModel(window.__calls.llm),
//            화면 = display 처리기(window.__calls.handlers.display) 결과 HTML, 본 화면 style(.gim 규칙).
// 갈래 (argv[2] 글자): A 메인 모델 방식(PC, 시작 화면부터) — 지침·태그 그리기·옛 태그 지우기·에셋 끔/켬(설정 단추)·주인공 이미지
//                       B 보조 모델 방식 — 보충 요청·답 처리·실패/빈 답/꼴 틀림/늦은 답/다시 굴리기/연타·새로고침
//                       P 폰 크기 — 시작·설정 단추로 끔/켬·그리기
// 결과: out/단계NN_*.txt, out/상태NN.json, out/결과-<갈래>.json
// 사용법: (fixture 가 있을 때) node 인수인계/플레이순서_점검/2차/13_이미지태그_에셋/run.mjs [ABP]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeWin, closeEditor, openEditor } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const OUT = `${HERE}out/`;
const ONLY = (process.argv[2] ?? 'ABPGK').toUpperCase();
const want = (k) => ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
const SEED = 20261122;
const MARKERS = ['%%SCENE_CARD', '%%GOEI_START%%', '%%GOEI_UNSENT%%', '%%GOEI_SCENE%%', '%%SEED%%', '[shop-ready', '[shop:', '@@dont_activate', '@@depth', '{{getvar', '{{#if', '{{#when', '$st_', '{{user}}', '{{char}}'];

const results = [];
let group = '';
const step = (n, name) => ({ n, name });
function check(s, what, ok, expect, actual, why = '') {
  results.push({ group, step: `${s.n} ${s.name}`, what, ok: !!ok, info: why === 'info', expect, actual, why });
  console.log(`${ok ? 'PASS' : why === 'info' ? 'INFO' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 700)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeTxt = (s, body, suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, body);
const writeReq = (s, msgs, extra = '', suffix = '') => writeTxt(s, `${extra}${fmtMsgs(msgs)}\n`, suffix);
const allText = (out) => out.map((m) => m.content).join('\n');
const tagsIn = (t) => [...String(t).matchAll(/<img=[^>]*>/g)].map((m) => m[0]);
const IMG_HEAD = '## Inserting Character Visual Images';

const b = await launch();

async function session(chat0, vp = 'pc', o = {}) {
  const store = { ...STORE, ...(o.store ?? {}) };
  const { page, errors } = await boot(b, fx, chat0, vp, { store });
  await page.evaluate((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
  if (o.userName) await page.evaluate((n) => { window.__userName = n; }, o.userName);
  // 보조 호출 가르기: 이미지 태그 보충 요청이면 window.__imgq 에서, 그 밖(인물 기록 갱신 등)은 기록만 하고 실패를 돌려준다 (이 점검 밖)
  await page.evaluate(() => {
    window.__slow = 0;
    window.risuai.runLLMModel = async (o) => {
      window.__calls.llm = window.__calls.llm || [];
      window.__calls.llm.push(o);
      const img = JSON.stringify(o.messages ?? o).includes('Insert <img> tags');
      if (img) { window.__imgCalls = (window.__imgCalls || 0) + 1; if (window.__slow) await new Promise((r) => setTimeout(r, window.__slow)); }
      await new Promise((r) => setTimeout(r, 150));
      if (!img) return { type: 'fail', result: 'not in this audit' };
      const next = (window.__imgq || []).shift();
      return next ?? { type: 'fail', result: 'no mock' };
    };
  });
  const chat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const vars = async () => (await chat()).scriptstate ?? {};
  const setVars = (v) => page.evaluate((v) => { window.__chat.scriptstate = { ...(window.__chat.scriptstate ?? {}), ...v }; }, v);
  const sendExisting = (pre = [{ role: 'system', content: 'SYSTEM PROMPT' }]) => page.evaluate(async (pre) => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const out = await window.__calls.replacers[0]([...pre, ...hist], 'model');
    return out.map((m) => ({ role: m.role, content: String(m.content) }));
  }, pre);
  const mainSend = async (text, id) => { await page.evaluate(([t, id]) => { window.__chat.message.push({ role: 'user', data: t, chatId: id }); }, [text, id]); return sendExisting(); };
  /** 본편 응답이 붙음 → output 리스너. wait=false 면 리스너를 기다리지 않는다 (늦은 답 갈래) */
  const botReply = async (text, id, { wait = true, replaceLast = false } = {}) => {
    const p = page.evaluate(async ([t, id, rl]) => {
      if (rl) window.__chat.message[window.__chat.message.length - 1] = { role: 'char', data: t, chatId: id };
      else window.__chat.message.push({ role: 'char', data: t, chatId: id });
      window.__lp = window.__calls.listeners[0]({ char: window.__char, chat: JSON.parse(JSON.stringify(window.__chat)), characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
      await window.__lp;
    }, [text, id, replaceLast]);
    if (wait) { await p; await sleep(400); }
    return p;
  };
  const display = (text) => page.evaluate((t) => window.__calls.handlers.display(t), text);
  const saveState = async (s) => {
    const c = await chat();
    const keep = Object.fromEntries(Object.entries(c.scriptstate ?? {}).filter(([k]) => /^\$(st_asset_.*|goei_asset_note|st_faction|st_player.*)$/.test(k)));
    writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: keep, prefs: JSON.parse((await page.evaluate(() => window.__store['p:goei:prefs'])) || '{}'), messages: c.message.map((m) => ({ role: m.role, chatId: m.chatId, data: String(m.data) })) }, null, 2));
  };
  const pick = async ({ fac, fm, player }) => {
    await openWin(page); await sleep(400);
    await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`).click(), fac); await sleep(300);
    if (player !== undefined) { await page.evaluate((p) => document.querySelector(`.gx-whoc[data-action="player"][data-value="${p}"]`)?.click(), player); await sleep(300); }
    await page.evaluate((v) => document.querySelector(`.gx-sc[data-value="${v}"]`).click(), String(fm)); await sleep(300);
    await page.evaluate(() => document.querySelector('.gx-start')?.click());
    await sleep(1800);
  };
  const llmCount = () => page.evaluate(() => window.__imgCalls || 0);
  const imgCallAt = (i) => page.evaluate((i) => (window.__calls.llm || []).filter((o) => JSON.stringify(o.messages ?? o).includes('Insert <img> tags'))[i], i);
  const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i], i);
  const queue = (...t) => page.evaluate((t) => { window.__imgq = t.map((r) => (r && typeof r === 'object' ? r : { type: 'success', result: r })); }, t);
  /** 본 화면 style 의 그림 칸 규칙 */
  const imgCssNow = () => page.evaluate(() => [...document.querySelectorAll('style')].map((x) => x.textContent).filter((t) => t.includes('.gim')).map((t) => (/:is\(\.gim[^{]*\{[^}]*\}/.exec(t) ?? [''])[0]).join('\n'));
  /** 설정 창 「이미지」 페이지에서 단추 누르기 (채팅 설정) */
  const imagePage = async () => {
    await openWin(page); await sleep(300);
    await openEditor(page, 'set:image'); await sleep(400);
  };
  const clickAct = async (action, value) => {
    const ok = await page.evaluate(([a, v]) => {
      const el = [...document.querySelectorAll(`[data-action="${a}"]`)].find((x) => v === undefined || x.dataset.value === v);
      if (!el) return false;
      el.click();
      return true;
    }, [action, value]);
    await sleep(500);
    return ok;
  };
  return { page, errors, chat, vars, setVars, sendExisting, mainSend, botReply, display, saveState, pick, llmCount, llmAt: imgCallAt, queue, imgCssNow, imagePage, clickAct };
}

/** NEW 줄을 채운 태그 (가짜 응답용) */
function fillNew(report, kind) {
  return String(report ?? '').split('\n').filter((l) => l.startsWith('NEW [')).map((l) => l.slice(4)
    .replace('<발생지점>', '부둣가 창고').replace('<등급>', 'C').replace('<배치>', '없음').replace('<상황>', '가짜 상황')
    .replace('<방문자>', '없음').replace('<상태>', kind === 'AG' ? '내근' : '진행')).join('\n');
}
const ST = (time, place = '관리국 본부 사무실', who = '잼트리') => `[▣|2025.03.14|${time}|☀️|8°C|${place}|없음|${who}|없음|관리국/신입|140000]`;

// ════════ A: 메인 모델 방식 ════════
if (want('A')) {
  group = 'A';
  const S = await session({ message: [], scriptstate: {} }, 'pc', { userName: '한여름' });
  let s = step('A01', '시작_첫전송_이미지지침');
  await S.pick({ fac: 'A00', fm: 2 });
  await closeWin(S.page).catch(() => {});
  let out = await S.mainSend('잼트리에게 코드네임을 보여 준다.', 'u1');
  writeReq(s, out);
  const last = out.at(-1);
  const v0 = await S.vars();
  check(s, '기본값: 에셋 출력 켬·메인 모델 (사용자 2026-10-26 설정 기본)', v0.$st_asset_on === '1' && v0.$st_asset_model === 'main', { on: '1', model: 'main' }, { on: v0.$st_asset_on, model: v0.$st_asset_model });
  check(s, '이미지 지침이 요청 맨 끝(유저 글 뒤)', last.role === 'system' && last.content.startsWith(IMG_HEAD), '맨 끝 system', last.content.slice(0, 60));
  const chars = /- Characters \{name\}: ([^\n]*)/.exec(last.content)?.[1]?.split(', ') ?? [];
  check(s, '대상 명단 = 명부 요원 영문명(Jaemtri·Spangdal·Aileen 포함)', ['Jaemtri', 'Spangdal', 'Aileen'].every((n) => chars.includes(n)), '포함', chars.length);
  check(s, '표정 세트 42종(지침 MAIN_KEYWORDS)', (/- Available \{keyword\}: ([^\n]*)/.exec(last.content)?.[1]?.split(', ').length ?? 0) === 42, 42, /- Available \{keyword\}: ([^\n]*)/.exec(last.content)?.[1]?.split(', ').length);
  check(s, '주인공 이미지 끔(기본): 주인공 태그 금지 줄이 있고 {{user}} 가 이름으로 풀림', /Do not create tags for 한여름\./.test(last.content) && !last.content.includes('{{user}}'), '한여름', /Do not create tags for [^\n]*/.exec(last.content)?.[0]);
  check(s, '이미지 지침이 한 번만', out.filter((m) => m.content.includes(IMG_HEAD)).length === 1, 1, out.filter((m) => m.content.includes(IMG_HEAD)).length);
  const sys = await S.vars();
  await S.saveState(s);

  // ── A02 응답에 태그 → 그림 칸 ──
  s = step('A02', '응답태그_그림칸');
  const tags1 = [fillNew(sys.$an_report, 'AN'), fillNew(sys.$ms_report, 'MS'), fillNew(sys.$ag_report, 'AG')].filter(Boolean).join('\n');
  const R1 = `잼트리가 요원증을 들여다보았다.\n\n<img=Jaemtri_curious>\n\n에일린이 문가에서 손을 흔들었다.\n\n<img="Aileen_smile">\n\n스팡달이 웃었다.\n\n<img=Spangdal_forced_smiling>\n\n누군가 지나갔다.\n\n<img=Jaemtri_neutral>\n\n<img=Nobody_smile>\n\n<img=한여름_smile>\n\n${ST('09:10 AM')}\n${tags1}`;
  await S.botReply(R1, 'c1');
  const saved1 = (await S.chat()).message.at(-1).data;
  const html = await S.display(saved1);
  writeTxt(s, `════ 가짜 응답 ════\n${R1}\n\n════ 저장된 본문 ════\n${saved1}\n\n════ 화면 HTML ════\n${html}\n`);
  const boxesAll = [...html.matchAll(/class="gim"[^>]*url\('([^']*)'\)/g)].map((m) => m[1]);
  const boxes = boxesAll.filter((u) => !u.includes('source::user'));
  check(s, '알려진 태그 3개가 그림 칸(따옴표 꼴·밑줄 표정 포함), 세트 밖 표정·없는 이름은 칸 없음', boxes.length === 3 + 0 && boxes.some((u) => u.includes('Jaemtri_curious')) && boxes.some((u) => u.includes('Aileen_smile')) && boxes.some((u) => u.includes('Spangdal_forced smiling')), ['Jaemtri_curious', 'Aileen_smile', 'Spangdal_forced smiling'], boxes);
  check(s, '페르소나 태그(<img=한여름_smile>)는 주인공 이미지 끔이어도 그리면 유저 사진', true, '기록', boxesAll.filter((u) => u.includes('source::user')), 'info');
  check(s, '화면에 태그 원문이 남지 않음', !/<img=/.test(html.replace(/<img [^>]*>/g, '')), '없음', tagsIn(html));
  check(s, '최근 6개 조건(CBS chat_index)이 칸에 붙음(설정 imgShow 기본 6)', /lastmessageid}}-5/.test(html), '-5', /lastmessageid}}-\d+/.exec(html)?.[0]);
  await S.saveState(s);

  // ── A03 여러 턴 → 옛 태그 지우기 ──
  s = step('A03', '여러턴_옛태그지우기');
  for (let k = 2; k <= 5; k++) {
    await S.page.evaluate(([k, st]) => {
      window.__chat.message.push({ role: 'user', data: `행동 ${k}`, chatId: `u${k}` });
      window.__chat.message.push({ role: 'char', data: `잼트리가 고개를 끄덕였다 ${k}.\n\n<img=Jaemtri_smile>\n\n${st}`, chatId: `c${k}` });
    }, [k, ST(`09:${10 + k} AM`)]);
  }
  out = await S.mainSend('에일린에게 인사한다.', 'u6');
  writeReq(s, out);
  const hist = out.filter((m) => m.role !== 'system');
  const withTag = hist.map((m, i) => ({ i, n: hist.length - i, tags: tagsIn(m.content).length })).filter((x) => x.tags);
  check(s, '태그는 끝에서 6개 메시지(유저 글 포함) 안에만 남음(설정 imgSend 기본 6)', withTag.every((x) => x.n <= 6) && withTag.length > 0, '끝 6개 안', withTag);
  check(s, '이미지 지침은 맨 끝 그대로', out.at(-1).content.startsWith(IMG_HEAD), '맨 끝', out.at(-1).content.slice(0, 40));
  await S.saveState(s);

  // ── A04 설정 창 이미지 페이지 → 에셋 출력 끔 (채팅 설정 단추) ──
  s = step('A04', '설정_에셋출력_끔');
  await S.imagePage();
  const pageHtml = await S.page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  const offOk = await S.clickAct('set-asset', '0');
  await sleep(500);
  const v4 = await S.vars();
  const css4 = await S.imgCssNow();
  check(s, '이미지 페이지가 열리고 끔 단추가 있음', offOk, true, { offOk, page: pageHtml.slice(0, 300) });
  check(s, '채팅 변수 $st_asset_on=0', v4.$st_asset_on === '0', '0', v4.$st_asset_on);
  check(s, '채팅 속 그림 칸 숨김(display:none)', /display:none/.test(css4), 'display:none', css4.slice(0, 200));
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  out = await S.mainSend('잼트리에게 묻는다.', 'u7');
  writeReq(s, out);
  check(s, '끈 뒤 요청: 이미지 지침 없음', !allText(out).includes(IMG_HEAD), '없음', allText(out).includes(IMG_HEAD));
  check(s, '끈 뒤 요청: 최근 것까지 태그 전부 지움(전수검사 11-13)', tagsIn(allText(out)).length === 0, 0, tagsIn(allText(out)));
  const hidden4 = await S.display((await S.chat()).message.at(-2).data);
  check(s, '[참고] 끈 채팅에서도 화면 처리기는 칸을 만들고 style 로 숨김', true, '기록', (hidden4.match(/class="gim"/g) ?? []).length, 'info');
  await S.saveState(s);

  // ── A05 다시 켬 ──
  s = step('A05', '설정_에셋출력_켬');
  await S.page.evaluate(() => { window.__chat.message.pop(); });
  await S.imagePage();
  const onOk = await S.clickAct('set-asset', '1');
  await sleep(500);
  const css5 = await S.imgCssNow();
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  out = await S.sendExisting();
  writeReq(s, out);
  check(s, '켬: 변수 1·칸 보임·지침 돌아옴·최근 태그 남음', onOk && (await S.vars()).$st_asset_on === '1' && !/display:none/.test(css5) && out.at(-1).content.startsWith(IMG_HEAD) && tagsIn(allText(out)).length > 0, '모두', { onOk, css: css5.slice(0, 80), last: out.at(-1).content.slice(0, 30), tags: tagsIn(allText(out)).length });
  await S.saveState(s);

  // ── A06 주인공 이미지 켬 (페르소나로 플레이) ──
  s = step('A06', '주인공이미지_켬');
  await S.imagePage();
  const pOk = await S.clickAct('set-asset-player', '1');
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  out = await S.sendExisting();
  writeReq(s, out);
  const last6 = out.at(-1).content;
  const chars6 = /- Characters \{name\}: ([^\n]*)/.exec(last6)?.[1]?.split(', ') ?? [];
  check(s, '켬: 주인공 금지 줄 빠짐, 페르소나 이름(한여름)이 명단에', pOk && !/Do not create tags for/.test(last6) && chars6.includes('한여름'), '한여름 포함·금지 없음', { pOk, has: chars6.includes('한여름'), rule: /Do not create tags for[^\n]*/.exec(last6)?.[0] ?? null, tail: chars6.slice(-3) });
  const h6 = await S.display('한여름이 웃었다.\n\n<img=한여름_smile>\n\n' + ST('09:30 AM'));
  check(s, '페르소나 태그는 유저 사진({{source::user}})', /source::user/.test(h6), 'source::user', /url\('([^']*)'\)/.exec(h6)?.[1]);
  await S.saveState(s);

  // ── A07 장면 인물만 (설정) ──
  s = step('A07', '장면인물만');
  await S.imagePage();
  const scOk = await S.clickAct('set-img-scene', '1') || await S.clickAct('img-scene', '1');
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  out = await S.sendExisting();
  writeReq(s, out);
  const chars7 = /- Characters \{name\}: ([^\n]*)/.exec(out.at(-1).content)?.[1]?.split(', ') ?? [];
  check(s, '장면 인물만: 최근 대화에 나온 잼트리·에일린 + 주인공만', !scOk || (chars7.includes('Jaemtri') && chars7.includes('한여름') && !chars7.includes('Kyuras')), '좁아짐', { scOk, chars7 });
  await S.saveState(s);

  // ── A08 페이지 새로고침 (같은 채팅·저장소로 다시 띄움) ──
  s = step('A08', '새로고침_다시그리기');
  const keep = await S.chat();
  const store = await S.page.evaluate(() => ({ ...window.__store }));
  await S.page.close();
  const S2 = await session(keep, 'pc', { store, userName: '한여름' });
  await sleep(1500);
  const lastChar = keep.message.filter((m) => m.role === 'char').at(-1).data;
  const h8 = await S2.display(lastChar);
  check(s, '새로고침 뒤에도 태그가 그림 칸으로(에셋 목록 첫 읽기를 기다림)', /class="gim"/.test(h8) && !/<img=/.test(h8.replace(/<img [^>]*>/g, '')), '칸', tagsIn(h8));
  check(s, '[참고] 새로고침 뒤 채팅을 다시 저장해 다시 그리게 함(redrawAfterLoad)', true, '기록', (await S2.page.evaluate(() => window.__calls.setChat.length)), 'info');
  await S2.page.close();
  writeFileSync(`${OUT}결과-A.json`, JSON.stringify(results.filter((r) => r.group === 'A'), null, 2));
}

// ════════ B: 보조 모델 방식 ════════
if (want('B')) {
  group = 'B';
  const S = await session({ message: [], scriptstate: {} }, 'pc', { userName: '한여름' });
  let s = step('B01', '출발직후_설정_보조모델');
  await S.pick({ fac: 'A00', fm: 2 });
  await closeWin(S.page).catch(() => {});
  // 출발 뒤 첫 장면만 있고 아직 보내지 않은 때(staged) 설정 창에서 보조 모델을 누름
  await S.imagePage();
  const auxOk0 = await S.clickAct('set-asset-model', 'aux');
  const pageTxt0 = await S.page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  let out = await S.mainSend('잼트리에게 코드네임을 보여 준다.', 'u1');
  const prefs0 = JSON.parse((await S.page.evaluate(() => window.__store['p:goei:prefs'])) || '{}');
  writeReq(s, out, `════ 출발 직후 이미지 페이지 글 ════\n${pageTxt0}\n\n`);
  check(s, '[물을것] 출발 직후(첫 전송 전) 이미지 페이지는 「새 채팅 기본값 (시작 전)」 범위 → 이 채팅 변수는 main 그대로, 첫 요청에 메인 이미지 지침', true, '기록', { auxOk0, scopeLabel: /새 채팅 기본값[^\n]*/.exec(pageTxt0)?.[0], chatVar: (await S.vars()).$st_asset_model, prefsBasic: prefs0.basic, mainPrompt: allText(out).includes(IMG_HEAD) }, 'info');
  await S.saveState(s);
  // 첫 응답(메인 방식) → 그 뒤 채팅 설정에서 보조 모델
  s = step('B01b', '첫턴뒤_설정_보조모델로');
  const sys0 = await S.vars();
  const tags0 = [fillNew(sys0.$an_report, 'AN'), fillNew(sys0.$ms_report, 'MS'), fillNew(sys0.$ag_report, 'AG')].filter(Boolean).join('\n');
  await S.botReply(`잼트리가 요원증을 받아 들었다.\n\n<img=Jaemtri_curious>\n\n${ST('09:05 AM')}\n${tags0}`, 'c0');
  await S.imagePage();
  const auxOk = await S.clickAct('set-asset-model', 'aux');
  const pageTxt = await S.page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  out = await S.mainSend('잼트리에게 인사한다.', 'u1b');
  writeReq(s, out, `════ 이미지 페이지 글 ════\n${pageTxt}\n\n`);
  check(s, '보조 모델 단추 → 이 채팅 $st_asset_model=aux', auxOk && (await S.vars()).$st_asset_model === 'aux', 'aux', { auxOk, v: (await S.vars()).$st_asset_model });
  check(s, '본편 요청에 이미지 지침 없음·지난 태그 지움', !allText(out).includes(IMG_HEAD) && tagsIn(allText(out)).length === 0, '없음', { head: allText(out).includes(IMG_HEAD), tags: tagsIn(allText(out)) });
  check(s, '캐릭터당 이미지 수 칸이 보임(기본 2)', /캐릭터당/.test(pageTxt), '보임', /캐릭터당[^\n]*/.exec(pageTxt)?.[0]);
  const sys = await S.vars();
  await S.saveState(s);

  // ── B02 첫 응답 → 보조 보충 요청 ──
  s = step('B02', '첫응답_보충요청');
  const tags1 = [fillNew(sys.$an_report, 'AN'), fillNew(sys.$ms_report, 'MS'), fillNew(sys.$ag_report, 'AG')].filter(Boolean).join('\n');
  const R1 = `<Thoughts>잼트리 장면 구상</Thoughts>\n잼트리가 요원증을 들여다보며 웃었다. "신입이네?"\n\n한여름은 고개를 숙였다.\n\n<!-- 메모 -->\n스팡달 선배가 뒤에서 어깨를 툭 쳤다. "넌 언제 죽을까?"\n\n에일린은 서류만 넘겼다.\n\n${ST('09:10 AM')}\n${tags1}\n[shop: 관리국 매점|]`;
  const AUX1 = '```json\n[{"line":1,"tag":"<img=\\"Jaemtri_smile\\">"},{"line":3,"tag":"<img=\\"Spangdal_smirk\\">"},{"line":4,"tag":"<img=\\"Aileen_indifferent\\">"}]\n```';
  const n0 = await S.llmCount();
  await S.setVars({ $sh_judge: 'main' });
  await S.queue(AUX1, AUX1, AUX1);
  await S.botReply(R1, 'c1');
  await sleep(800);
  const n1 = await S.llmCount();
  const calls = [];
  for (let i = n0; i < n1; i++) calls.push(await S.llmAt(i));
  const auxCall = calls[0];
  const auxText = auxCall ? auxCall.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n') : '';
  writeTxt(s, `════ 가짜 본편 응답 ════\n${R1}\n\n════ 보조 호출 ${n1 - n0}회 (이미지 태그 보충 요청 전문) ════\n${auxText}\n\n════ 넣은 가짜 답 ════\n${AUX1}\n`);
  check(s, '이미지 태그 보충 보조 호출 1회', calls.filter((c) => JSON.stringify(c).includes('Insert <img> tags')).length === 1, 1, calls.length);
  const names = /## Allowed Character Names \(use exactly as written\)\n([^\n]*)/.exec(auxText)?.[1] ?? '';
  check(s, '명단 = 본문에 나온 잼트리·스팡달·에일린만', ['Jaemtri', 'Spangdal', 'Aileen'].every((n) => names.includes(n)) && names.split(' | ').length === 3, 'Jaemtri | Spangdal | Aileen', names);
  check(s, '별칭 줄(한글 이름) 있음', /- Jaemtri \([^)]*잼트리/.test(auxText), '잼트리', /- Jaemtri \([^)]*\)/.exec(auxText)?.[0]);
  check(s, '주인공 금지 줄의 {{user}} 가 이름(한여름)으로 풀림', /DO NOT tag 한여름/.test(auxText) && !auxText.includes('{{user}}'), '한여름', /DO NOT tag [^\n]*/.exec(auxText)?.[0]);
  check(s, '본문 번호: 생각 칸·주석·상태창·상황판 태그·상점 표식이 빠짐', !/Thoughts|메모|\[▣\||\[AN\||\[AG\||\[shop:/.test(auxText.split('## Narrative')[1] ?? ''), '없음', (auxText.split('## Narrative')[1] ?? '').slice(0, 400));
  check(s, '단락 4개 번호([1]~[4])', /\[4\] 에일린/.test(auxText) && !/\[5\]/.test(auxText.split('## Narrative')[1] ?? ''), '[1]~[4]', (auxText.split('## Narrative')[1] ?? '').match(/\[\d+\]/g));
  check(s, '캐릭터당 장수 2가 지침에(설정 기본)', /The limit is 2 tags PER character/.test(auxText), 2, /The limit is [^\n]*/.exec(auxText)?.[0]);
  const saved = (await S.chat()).message.at(-1).data;
  writeTxt(s, `${saved}\n`, '_저장본문');
  check(s, '저장 본문: 단락 뒤 태그 3개(따옴표 없는 꼴)', tagsIn(saved).join(',') === '<img=Jaemtri_smile>,<img=Spangdal_smirk>,<img=Aileen_indifferent>', 3, tagsIn(saved));
  check(s, '저장 본문: 생각 칸·주석·상태창 그대로, 상점 표식 끝에 남음', saved.startsWith('<Thoughts>') && saved.includes('<!-- 메모 -->') && saved.includes('[▣|') && /\[shop: 관리국 매점\|\]\s*$/.test(saved), '그대로', saved.slice(-200));
  check(s, '태그는 그 단락 바로 뒤', /"신입이네\?"\n\n<img=Jaemtri_smile>/.test(saved) && /"넌 언제 죽을까\?"\n\n<img=Spangdal_smirk>/.test(saved), '바로 뒤', saved.slice(0, 400));
  check(s, '최근 보충 메모 비움', (await S.vars()).$goei_asset_note === '', '', (await S.vars()).$goei_asset_note);
  await S.saveState(s);

  // ── B03 다음 턴 본편: 보조 방식이면 태그 전부 지움 ──
  s = step('B03', '다음턴_본편');
  out = await S.mainSend('스팡달에게 대꾸한다.', 'u2');
  writeReq(s, out);
  check(s, '보조 방식: 본편 요청에 태그 없음·지침 없음', tagsIn(allText(out)).length === 0 && !allText(out).includes(IMG_HEAD), '없음', tagsIn(allText(out)));
  await S.saveState(s);

  // ── B04 답 거르기: 한도 초과·세트 밖 표정·없는 이름·범위 밖 줄·밑줄 표정·한 단락 두 태그 ──
  s = step('B04', '답거르기');
  const R2 = `잼트리가 웃었다.\n\n잼트리가 울었다.\n\n잼트리가 화냈다.\n\n스팡달이 억지로 웃었다.\n\n에일린이 걸어왔다.\n\n${ST('09:20 AM')}`;
  const AUX2 = JSON.stringify([
    { line: 1, tag: '<img="Jaemtri_smile">' }, { line: 2, tag: '<img="Jaemtri_crying">' }, { line: 3, tag: '<img="Jaemtri_angry">' },
    { line: 4, tag: '<img="Spangdal_forced_smiling">' }, { line: 5, tag: '<img="Aileen_neutral">' }, { line: 5, tag: '<img="Aileen_default">' },
    { line: 9, tag: '<img="Aileen_sad">' }, { line: 2, tag: '<img="Kyuras_sad">' },
  ]);
  await S.queue(AUX2);
  await S.botReply(R2, 'c2');
  await sleep(600);
  const saved2 = (await S.chat()).message.at(-1).data;
  writeTxt(s, `════ 가짜 본편 ════\n${R2}\n\n════ 가짜 보조 답 ════\n${AUX2}\n\n════ 저장 ════\n${saved2}\n`);
  check(s, '잼트리 2장까지(3번째 버림), 밑줄 표정 고침, 세트 밖 neutral 버리고 같은 줄 다음 default 받음, 범위 밖·명단 밖 버림', tagsIn(saved2).join(',') === '<img=Jaemtri_smile>,<img=Jaemtri_crying>,<img=Spangdal_forced smiling>,<img=Aileen_default>', ['Jaemtri_smile', 'Jaemtri_crying', 'Spangdal_forced smiling', 'Aileen_default'], tagsIn(saved2));
  await S.saveState(s);

  // ── B05 빈 답 / [] / 꼴 틀림 / 실패 ──
  const variants = [['B05', '빈답', ''], ['B06', '빈배열', '[]'], ['B07', '꼴틀림', '잼트리에게 smile 태그를 붙이세요.'], ['B08', '호출실패', { type: 'fail', result: 'rate limit 429' }]];
  for (const [n, name, reply] of variants) {
    s = step(n, name);
    const R = `잼트리가 서류를 내밀었다 (${name}).\n\n${ST('09:30 AM')}`;
    await S.queue(reply);
    const before = await S.llmCount();
    await S.botReply(R, `c-${n}`);
    await sleep(500);
    const v = await S.vars();
    const sv = (await S.chat()).message.at(-1).data;
    writeTxt(s, `════ 가짜 보조 답 ════\n${JSON.stringify(reply)}\n\n════ 저장 ════\n${sv}\n\n════ 메모 ════\n${v.$goei_asset_note}\n`);
    check(s, '본문은 그대로(태그 없음)', tagsIn(sv).length === 0 && sv.includes(R.split('\n')[0]), R, sv);
    check(s, '보조 호출 1회', (await S.llmCount()) - before === 1, 1, (await S.llmCount()) - before);
    const noteExpect = name === '호출실패' ? /보조 모델 호출 실패/ : /붙일 이미지가 없었/;
    if (name === '빈답' || name === '꼴틀림') check(s, `[물을것] ${name} 일 때 「최근 보충」 메모`, true, '기록', v.$goei_asset_note, 'info');
    else check(s, `설정 탭 「최근 보충」 메모: ${name === '호출실패' ? '실패 이유' : '붙일 이미지 없음'}`, noteExpect.test(v.$goei_asset_note ?? ''), name, v.$goei_asset_note);
    await S.saveState(s);
  }
  // 설정 페이지에 메모가 보이나
  s = step('B09', '설정탭_메모');
  await S.imagePage();
  const t9 = await S.page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  check(s, '이미지 페이지에 「최근 보충: …」', /최근 보충:/.test(t9), '보임', /최근 보충:[^\n]*/.exec(t9)?.[0]);
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});

  // ── B10 늦은 답 + 그새 다시 굴리기 ──
  s = step('B10', '늦은답_그새다시굴림');
  await S.page.evaluate(() => { window.__slow = 1500; });
  const R3 = `잼트리가 커피를 건넸다.\n\n${ST('09:40 AM')}`;
  const R3b = `잼트리가 녹차를 건넸다.\n\n${ST('09:40 AM')}`;
  await S.queue('[{"line":1,"tag":"<img=\\"Jaemtri_happy\\">"}]', '[{"line":1,"tag":"<img=\\"Jaemtri_smile\\">"}]');
  const pA = S.botReply(R3, 'c-r1', { wait: false });
  await sleep(400);
  // 다시 굴리기: 마지막 응답이 새 글로 바뀜 → 리스너 다시
  const pB = S.botReply(R3b, 'c-r2', { wait: false, replaceLast: true });
  await Promise.all([pA, pB]); await sleep(2500);
  const c10 = await S.chat();
  const sv10 = c10.message.at(-1).data;
  writeTxt(s, `════ 처음 응답 ════\n${R3}\n════ 다시 굴린 응답 ════\n${R3b}\n════ 저장 ════\n${sv10}\n════ 메모 ════\n${c10.scriptstate.$goei_asset_note}\n`);
  check(s, '처음 응답 답(happy)이 새 응답에 붙지 않음', !sv10.includes('Jaemtri_happy'), '없음', tagsIn(sv10));
  check(s, '다시 굴린 응답도 태그를 받음(보충이 돌던 중이라 건너뛰지 않음)', sv10.includes('<img=Jaemtri_smile>'), '<img=Jaemtri_smile>', { tags: tagsIn(sv10), note: c10.scriptstate.$goei_asset_note });
  await S.saveState(s);

  // ── B11 다시 굴리기(평소 속도): 같은 자리 새 응답 → 한 번 더 보충 ──
  s = step('B11', '다시굴리기_한번더');
  await S.page.evaluate(() => { window.__slow = 0; });
  const R4 = `에일린이 총을 점검했다.\n\n${ST('09:50 AM')}`;
  await S.queue('[{"line":1,"tag":"<img=\\"Aileen_serious\\">"}]');
  const b11 = await S.llmCount();
  await S.botReply(R4, 'c-r3', { replaceLast: true });
  await sleep(500);
  const sv11 = (await S.chat()).message.at(-1).data;
  check(s, '다시 굴린 응답에 보충 1회, 태그 붙음', (await S.llmCount()) - b11 === 1 && sv11.includes('<img=Aileen_serious>'), '1·태그', { n: (await S.llmCount()) - b11, tags: tagsIn(sv11) });
  await S.saveState(s);

  // ── B12 명단 인물 없는 응답 → 호출 없음 ──
  s = step('B12', '인물없음_호출없음');
  const b12 = await S.llmCount();
  await S.botReply(`복도에 바람이 불었다.\n\n${ST('10:00 AM', '복도', '없음')}`, 'c-n');
  await sleep(400);
  check(s, '명단 인물이 없으면 보조 호출 없음', (await S.llmCount()) - b12 === 0, 0, (await S.llmCount()) - b12);
  await S.saveState(s);

  // ── B13 응답에 이미 태그가 있음(메인 모델이 써 버림) → 옛 태그 빼고 새로 ──
  s = step('B13', '응답속기존태그');
  await S.queue('[{"line":1,"tag":"<img=\\"Jaemtri_shy\\">"}]');
  await S.botReply(`잼트리가 얼굴을 붉혔다.\n\n<img=Jaemtri_angry>\n\n${ST('10:10 AM')}`, 'c-t');
  await sleep(500);
  const sv13 = (await S.chat()).message.at(-1).data;
  check(s, '옛 태그 빠지고 보조 답 태그만', tagsIn(sv13).join(',') === '<img=Jaemtri_shy>', '<img=Jaemtri_shy>', tagsIn(sv13));
  await S.saveState(s);

  // ── B14 상태창 없는 응답에 상점 표식만 → 표식이 보조 요청에 새나 ──
  s = step('B14', '상태창없음_상점표식');
  await S.queue('[{"line":1,"tag":"<img=\\"Jaemtri_smile\\">"}]');
  const b14 = await S.llmCount();
  const R14 = `잼트리가 매점을 가리켰다.\n\n[shop: 관리국 매점|]`;
  await S.botReply(R14, 'c-s');
  await sleep(500);
  const c14 = await S.llmCount() > b14 ? await S.llmAt(b14) : null;
  const t14 = c14 ? c14.messages.map((m) => m.content).join('\n') : '';
  const sv14 = (await S.chat()).message.at(-1).data;
  writeTxt(s, `════ 보조 요청 ════\n${t14}\n\n════ 저장 ════\n${sv14}\n`);
  check(s, '보조 요청 본문에 상점 표식([shop:)이 단락으로 실리지 않음', !/\[\d+\] \[shop:/.test(t14), '없음', /\[\d+\] \[shop:[^\n]*/.exec(t14)?.[0]);
  check(s, '저장 본문 표식 하나만 남음', (sv14.match(/\[shop:/g) ?? []).length === 1, 1, sv14);
  await S.saveState(s);

  // ── B15 연타: 두 응답 리스너가 겹침(첫 보충 중 다음 응답) ──
  s = step('B15', '겹친응답_두번째');
  await S.page.evaluate(() => { window.__slow = 1200; });
  await S.queue('[{"line":1,"tag":"<img=\\"Jaemtri_happy\\">"}]', '[{"line":1,"tag":"<img=\\"Aileen_smile\\">"}]');
  const b15 = await S.llmCount();
  const q1 = S.botReply(`잼트리가 손을 흔들었다.\n\n${ST('10:20 AM')}`, 'c-p1', { wait: false });
  await sleep(300);
  await S.page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '다음', chatId: 'u-p' }); });
  const q2 = S.botReply(`에일린이 웃었다.\n\n${ST('10:21 AM')}`, 'c-p2', { wait: false });
  await Promise.all([q1, q2]); await sleep(2500);
  await S.page.evaluate(() => { window.__slow = 0; });
  const c15 = await S.chat();
  writeTxt(s, `${c15.message.slice(-3).map((m) => m.data).join('\n----\n')}\n\n메모: ${c15.scriptstate.$goei_asset_note}\n`);
  check(s, '[참고] 보충이 도는 중 다음 응답이 붙으면 다음 응답은 보충 안 됨(running)', true, '기록', { calls: (await S.llmCount()) - b15, last: tagsIn(c15.message.at(-1).data) }, 'info');
  await S.saveState(s);

  // ── B16 새로고침(다시 띄움) → 저장 태그가 그대로 그려짐, 보충 다시 안 돎 ──
  s = step('B16', '새로고침');
  const keep = await S.chat();
  const store = await S.page.evaluate(() => ({ ...window.__store }));
  await S.page.close();
  const S2 = await session(keep, 'pc', { store, userName: '한여름' });
  await sleep(1500);
  const firstTagged = keep.message.find((m) => m.role === 'char' && tagsIn(m.data).length);
  const h16 = await S2.display(firstTagged.data);
  check(s, '저장된 태그가 그림 칸으로', (h16.match(/class="gim"/g) ?? []).length === tagsIn(firstTagged.data).length, tagsIn(firstTagged.data).length, (h16.match(/class="gim"/g) ?? []).length);
  check(s, '띄우기만으로 보조 호출 없음', (await S2.llmCount()) === 0, 0, await S2.llmCount());
  await S2.page.close();
  writeFileSync(`${OUT}결과-B.json`, JSON.stringify(results.filter((r) => r.group === 'B'), null, 2));
}

// ════════ P: 폰 크기 ════════
if (want('P')) {
  group = 'P';
  const S = await session({ message: [], scriptstate: {} }, 'phone', { userName: '한여름' });
  let s = step('P01', '폰_출발직후_끔');
  await S.pick({ fac: 'A00', fm: 2 });
  await closeWin(S.page).catch(() => {});
  await S.imagePage();
  const t0 = await S.page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  const off0 = await S.clickAct('set-asset', '0');
  await S.page.screenshot({ path: `${OUT}P01_폰_출발직후_이미지설정.png` });
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  let out = await S.mainSend('잼트리에게 인사한다.', 'u1');
  writeReq(s, out, `════ 이미지 페이지 ════\n${t0}\n\n`);
  check(s, '[물을것] 폰·출발 직후 끔 → 「새 채팅 기본값」에만 적히고 이 채팅 첫 요청엔 이미지 지침이 그대로', true, '기록', { off0, chatVar: (await S.vars()).$st_asset_on, prefs: JSON.parse((await S.page.evaluate(() => window.__store['p:goei:prefs'])) || '{}').basic, mainPrompt: allText(out).includes(IMG_HEAD) }, 'info');
  await S.saveState(s);
  s = step('P02', '폰_첫턴뒤_끔켬');
  const sys0 = await S.vars();
  const tags0 = [fillNew(sys0.$an_report, 'AN'), fillNew(sys0.$ms_report, 'MS'), fillNew(sys0.$ag_report, 'AG')].filter(Boolean).join('\n');
  await S.botReply(`잼트리가 웃었다.\n\n<img=Jaemtri_smile>\n\n${ST('09:10 AM')}\n${tags0}`, 'c1');
  await S.imagePage();
  const t = await S.page.evaluate(() => document.querySelector('.gw')?.innerText ?? '');
  const offOk = await S.clickAct('set-asset', '0');
  const cssOff = await S.imgCssNow();
  const onOk = await S.clickAct('set-asset', '1');
  const cssOn = await S.imgCssNow();
  await S.page.screenshot({ path: `${OUT}P02_폰_이미지설정.png` });
  await closeEditor(S.page, true).catch(() => {}); await closeWin(S.page).catch(() => {});
  out = await S.mainSend('에일린에게 인사한다.', 'u2');
  writeReq(s, out, `════ 이미지 페이지 ════\n${t}\n\n`);
  check(s, '폰: 이미지 페이지 단추로 끔 → 숨김, 켬 → 보임, 요청 끝 지침', offOk && onOk && /display:none/.test(cssOff) && !/display:none/.test(cssOn) && out.at(-1).content.startsWith(IMG_HEAD), '모두', { offOk, onOk, cssOff: cssOff.slice(0, 90), cssOn: cssOn.slice(0, 90) });
  const h = await S.display(`잼트리가 웃었다.\n\n<img=Jaemtri_smile>\n\n${ST('09:10 AM')}`);
  check(s, '폰: 태그 그림 칸', /class="gim"/.test(h), '칸', tagsIn(h));
  await S.saveState(s);
  await S.page.close();
  writeFileSync(`${OUT}결과-P.json`, JSON.stringify(results.filter((r) => r.group === 'P'), null, 2));
}

// ════════ G: 괴담넷 [사진:이름] (에셋 사진, 사용자 11-08) ════════
if (want('G')) {
  group = 'G';
  const STG = (time) => `[▣|2025.03.14|${time}|🌙|6°C|중림 지하상가|없음|잼트리|없음|관리국/신입|100000]`;
  const C1 = `퇴근길, 중림 지하상가에서 잼트리가 휴대폰으로 셔터 사진을 찍었다. 스팡달 선배는 먼저 갔다.\n${STG('11:20 PM')}`;
  const chat0 = { message: [{ role: 'user', data: '지하상가 앞을 지나간다.', chatId: 'u1' }, { role: 'char', data: C1, chatId: 'c1' }], scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $ib_affiliation: '관리국', $an_report: '', $in_report: '', $ms_report: '', $st_wallet: JSON.stringify({ start: 100000, log: [] }), $st_items: JSON.stringify({ list: [], log: [] }) } };
  const { page } = await boot(b, fx, chat0, 'pc', { store: STORE });
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  const act = async (action, value, wait = 500) => { await page.evaluate(({ action, value }) => { const el = document.createElement('button'); el.dataset.action = action; if (value !== undefined) el.dataset.value = value; el.style.display = 'none'; (document.querySelector('.bs') || document.querySelector('.gx') || document.body).appendChild(el); el.click(); el.remove(); }, { action, value }); await sleep(wait); };
  await act('nav-tab', 'net');
  if (!(await page.$('.bs-gn'))) await act('br-go', 'gn', 800);
  const REFRESH = JSON.stringify({
    posts: [{ author: '야근요정', id: 1846003, tag: '현장', title: '지하상가 셔터 사진', date: '2025.03.14 22:40', views: 1820, upvotes: 64, mine: false,
      content: '방금 찍은 거\n[사진:잼트리_smile]\n이건 옆에 있던 분\n[사진:Spangdal_forced_smiling]\n장소\n[사진:중림 지하상가]\n모르는 사람\n[사진:박철수_smile]\n세트 밖 표정\n[사진:잼트리_neutral]',
      comments: [{ author: '단가충', content: '[사진:에일린]', parent: 0, mine: false, time: '22:51' }] }],
    incoming: [], keyFigures: [],
  });
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, REFRESH);
  const n0 = await page.evaluate(() => (window.__calls.llm || []).length);
  await page.locator('.bs [data-action="gn-refresh"]:visible').first().click({ timeout: 5000 }).catch(() => act('gn-refresh', ''));
  await sleep(2500);
  const req = await page.evaluate((i) => window.__calls.llm[i]?.messages ?? [], n0);
  let s = step('G01', '괴담넷_새로고침_사진목록');
  writeReq(s, req, '', '');
  writeTxt(s, `${fmtMsgs(req)}\n\n════ 넣은 가짜 답 ════\n${REFRESH}\n`);
  const all = allText(req);
  const picsLine = /Real photos:[^\n]*\n([\s\S]*?)(?:\n\n|\n#|$)/.exec(all)?.[1] ?? '';
  check(s, '사진 목록: 최근 본문에 나온 잼트리·스팡달(인물, 표정 가능)이 들어감 (사용자 11-14: 요청에 나온 이름만)', /People \(may add _expression\):[^\n]*잼트리/.test(all) && /People \(may add _expression\):[^\n]*스팡달/.test(all), '잼트리·스팡달', picsLine.slice(0, 600));
  check(s, '[참고] 장소(중림 지하상가) 사진 목록 줄', true, '기록', /Anomalies, people and places[^\n]*/.exec(all)?.[0] ?? '(없음)', 'info');
  check(s, '자리표 __SITE_PICS__ 가 남지 않음', !all.includes('__SITE_PICS__'), '없음', all.includes('__SITE_PICS__'));
  await act('gn-open', '1846003', 1500);
  const imgs = await page.evaluate(() => [...document.querySelectorAll('.bs img')].map((i) => ({ src: i.getAttribute('src')?.slice(0, 30), alt: i.alt })));
  const frames = await page.evaluate(() => [...document.querySelectorAll('.bs .ax-ph p')].map((p) => p.textContent));
  const txt = await page.evaluate(() => document.querySelector('.bs')?.innerText ?? '');
  await page.screenshot({ path: `${OUT}G02_글_사진.png` });
  s = step('G02', '글열기_사진그림');
  writeTxt(s, `════ 화면 글 ════\n${txt}\n\n════ img ════\n${JSON.stringify(imgs, null, 1)}\n\n════ 사진 설명 틀 ════\n${JSON.stringify(frames)}\n`);
  check(s, '[사진:잼트리_smile]·[사진:Spangdal_forced_smiling]·[사진:에일린] 은 실제 그림, 표식 원문이 화면에 남지 않음', imgs.filter((i) => /^blob:|^data:/.test(i.src ?? '')).length >= 3 && !/\[사진:/.test(txt), '그림 3+', { imgs, raw: /\[사진:[^\]]*\]/.exec(txt)?.[0] });
  check(s, '목록에 없는 이름(박철수)은 사진 설명 틀(표정 꼬리 떼고)', frames.some((f) => f.trim() === '박철수'), '박철수 틀', frames);
  check(s, '[참고] 세트 밖 표정(잼트리_neutral)·장소(중림 지하상가)', true, '기록', { frames, n: imgs.length }, 'info');
  await page.close();
  writeFileSync(`${OUT}결과-G.json`, JSON.stringify(results.filter((r) => r.group === 'G'), null, 2));
}

// ════════ K: 사진 팩 받기 계획 (core/pictures.ts, 순수 함수 — src 를 /tmp 로 묶어 node 에서) ════════
if (want('K')) {
  group = 'K';
  const { build } = await import(`${ROOT}node_modules/esbuild/lib/main.js`);
  mkdirSync('/tmp/goei13', { recursive: true });
  writeFileSync('/tmp/goei13/kentry.ts', `export * from '${ROOT}src/core/pictures';\n`);
  await build({ entryPoints: ['/tmp/goei13/kentry.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: '/tmp/goei13/k.mjs', logLevel: 'error' });
  const P = await import('/tmp/goei13/k.mjs');
  const s = step('K01', '사진팩_계획');
  const assets = [['A', 'assets/a.png', 'png'], ['B', 'assets/b.png', 'png'], ['C', 'assets/c.png', 'png']];
  const cur = { pictures: [['A', 'a1', 'avif', 10], ['B', 'b1', 'avif', 10]] };
  const next = { pictures: [['A', 'a2', 'avif', 11], ['D', 'd1', 'avif', 12]] };
  const p1 = P.planPictures(assets, cur, next);
  const p2 = P.planPictures(assets, cur, cur);
  writeTxt(s, JSON.stringify({ p1, p2, drop: P.dropAssets(assets, p1.drop) }, null, 1));
  check(s, '지문 바뀐 A 는 바꿈, 새 D 는 받음, 새 카드에서 빠진 B 는 지움, 사용자가 넣은 C 는 그대로', p1.replaced === 1 && p1.added === 1 && p1.drop.join() === 'B' && P.dropAssets(assets, p1.drop).some((r) => r[0] === 'C'), { replaced: 1, added: 1, drop: ['B'] }, p1);
  check(s, '같은 판이면 받을 것 없음', p2.get.length === 0 && p2.drop.length === 0, 0, p2);
}

await b.close();
const fails = results.filter((r) => !r.ok && !r.info);
console.log(`\n${results.filter((r) => !r.info).length} 검사 · 통과 ${results.filter((r) => r.ok && !r.info).length} · 실패 ${fails.length}`);
