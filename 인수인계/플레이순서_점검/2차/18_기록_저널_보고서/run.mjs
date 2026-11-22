// 플레이 순서 점검 2차 · 18 기록·일지·보고서 카드 (지침: ../../GPT_점검지침_초안.md 3판)
// 틀: 실제 번들 + .scratch/fixture 카드 + 가짜 Risu(tests/qc-settings-harness.mjs). 2차 15 의 시작·태그 꼴을 그대로 쓴다.
// 기록 자리: 본편 = beforeRequest 반환값, 응답 처리 = output 리스너, 보조 호출 = runLLMModel(인물 갱신기만 가짜 답).
// 저장 위치: 일지 scriptstate.$goei_journal, 보고서 $goei_reports, 설정 $jr_*, 리롤 기준 $goei_prev(made), 알림 본 것 prefs.noticedReports.
// 사용법: node 인수인계/플레이순서_점검/2차/18_기록_저널_보고서/run.mjs [갈래 글자: A R S C P L]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeWin, openEditor, closeEditor } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const ONLY = (process.argv[2] ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks'), 'p:goei:user-name': '한서준' };
const SEED = 20261122;
const resFile = `${OUT}결과.json`;
const results = existsSync(resFile) && ONLY ? JSON.parse(readFileSync(resFile, 'utf8')).filter((r) => !ONLY.includes(r.step[0])) : [];
const step = (n, name) => ({ n, name });
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : why === 'info' ? 'INFO' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)?.slice(0, 700)}`}`);
}
const info = (s, what, actual) => check(s, what, false, '(참고)', actual, 'info');
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const writeReq = (s, msgs, reply, extra = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const allText = (out) => out.map((m) => m.content).join('\n');
// 상태창 [▣|날짜|시각|날씨|기온|위치|목표|동행|투입|신분|잔고]
const ST = (date, time, place, target = '없음', deploy = '없음', bal = '140000') => `[▣|${date}|${time}|☀️|8°C|${place}|${target}|없음|${deploy}|관리국/요원|${bal}]`;
const FAKE = (n, body, status, tags = []) => `【가짜 응답 ${n}】 ${body}\n${tags.join('\n')}\n${status}`;
const U = (o = {}) => JSON.stringify({ entries: [], axes_init: [], observations: [], cues: [], address: [], identity: { faction: null, rank: null }, new_people: [], renames: [], docs: [], present: [], issues: [{ code: 'no_canonical_change', who: null, reason: '점검용' }], ...o });

const b = await launch();

async function session(chat0, vp = 'pc', extra = {}) {
  const { page, errors } = await boot(b, fx, chat0, vp, { store: { ...STORE, ...extra } });
  await page.evaluate((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
  // 보조 호출: 갱신기만 줄에서 꺼내 주고 나머지는 실패
  await page.evaluate(() => {
    window.__q = { update: [] };
    window.__calls.llm = [];
    window.risuai.runLLMModel = async (o) => {
      const s0 = String(o.messages?.[0]?.content ?? '');
      const kind = s0.startsWith('# People Record Updater') ? 'update' : s0.startsWith('# Router') ? 'router' : s0.includes('# Scene Director') ? 'director' : 'other';
      window.__calls.llm.push({ kind, messages: JSON.parse(JSON.stringify(o.messages)) });
      await new Promise((r) => setTimeout(r, 40));
      let next = (window.__q[kind] ?? []).shift();
      if (next === undefined) return { type: 'fail', result: 'mock fail' };
      const t = String(o.messages?.[1]?.content ?? '');
      let d = {};
      try { d = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { /* */ }
      const conf = (d.span ?? []).filter((x) => x.confirmed && x.role === 'assistant').map((x) => x.m);
      if (conf.length) next = next.replaceAll('"@M"', JSON.stringify(conf.at(-1)));
      return { type: 'success', result: next };
    };
  });
  const chat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const vars = async () => (await chat()).scriptstate ?? {};
  const J = (v) => { try { return JSON.parse(v || 'null'); } catch { return null; } };
  const world = async () => J((await vars()).$goei_world);
  const journal = async () => J((await vars()).$goei_journal);
  const reports = async () => J((await vars()).$goei_reports);
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
    await sleep(700);
  };
  const rerollRequest = async () => { await page.evaluate(() => { if (window.__chat.message.at(-1)?.role === 'char') window.__chat.message.pop(); }); return sendExisting(); };
  const deleteLast = () => page.evaluate(() => { if (window.__chat.message.at(-1)?.role === 'char') window.__chat.message.pop(); });
  const display = (text) => page.evaluate((t) => window.__calls.handlers.display(t), text);
  const lastText = async () => (await chat()).message.at(-1).data;
  const textOf = async (id) => (await chat()).message.find((m) => m.chatId === id)?.data ?? '';
  const saveState = async (s) => {
    const v = await vars();
    const w = J(v.$goei_world);
    writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({
      journal: J(v.$goei_journal), reports: J(v.$goei_reports),
      jr: Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('$jr_'))),
      prev: J(v.$goei_prev) && { i: J(v.$goei_prev).i, made: J(v.$goei_prev).made },
      wallet: J(v.$st_wallet),
      world: w && { an: w.an.map((e) => `${e.loc}|${e.name}|${e.state}|${e.deploy}`), ms: w.ms.map((e) => `${e.loc}|${e.name}|${e.state}`), ended: w.ended },
      prefsNoticed: J(await page.evaluate(() => window.__store['p:goei:prefs'] ?? null))?.noticedReports,
      messages: (await chat()).message.map((m) => ({ role: m.role, chatId: m.chatId, data: String(m.data).slice(0, 300) })),
    }, null, 2));
  };
  const start = async (fac = 'A00', fm = 2) => {
    await openWin(page); await sleep(400);
    await page.evaluate((f) => document.querySelector(`.gx-fac[data-value="${f}"]`).click(), fac); await sleep(300);
    await page.evaluate((v) => document.querySelector(`.gx-sc[data-value="${v}"]`).click(), String(fm)); await sleep(300);
    await page.evaluate(() => document.querySelector('.gx-start')?.click());
    await sleep(1800);
    await closeWin(page).catch(() => {});
  };
  // 시험 카드에 빠진 것이 있어 창을 열 때마다 설치 화면(편집 창)이 위에 뜬다 → 닫고 본다
  const dropInstall = async () => { if (await page.evaluate(() => { const g = document.querySelector('.gw'); return !!g && !g.hidden && getComputedStyle(g).display !== 'none'; })) await closeEditor(page, true).catch(() => {}); await sleep(200); };
  const open = async (tab) => {
    await closeWin(page).catch(() => {});
    await openWin(page); await sleep(500);
    await dropInstall();
    if (tab) { if (!(await act('tab', tab, 600))) await act('nav-tab', tab, 600); }
  };
  const queue = (kind, ...t) => page.evaluate(([k, t]) => { (window.__q[k] ??= []).push(...t); }, [kind, t]);
  const llm = () => page.evaluate(() => window.__calls.llm.map((c) => c.kind));
  return { dropInstall, textOf, page, errors, chat, vars, world, journal, reports, act, winText, sendExisting, mainSend, botReply, rerollRequest, deleteLast, display, lastText, saveState, start, open, queue, llm, J };
}

const T = (d, t) => ({ date: d, time: t });
const R1 = FAKE(1, '본부 사무실. 에일린이 서류를 넘긴다.', ST('2025.03.14', '10:00 AM', '관리국 본부'), [
  '[AN|부산광역시 북구|가짜괴이|활성|C|P004|역사 안에서 기침 소리가 들린다]',
  '[AN|인천광역시 서구|어두운 정원|활성|B|없음|울타리 너머로 사람이 사라졌다]',
  '[MS|부산광역시 연제구|얼굴 없는 장터 맨홀|출현|없음|맨홀 뚜껑이 열려 있다]',
]);
// 2턴: 어두운 정원에 투입 (목표·투입 칸) + 잔고 1000→800, 에일린 동행 장면
const R2 = FAKE(2, '에일린과 함께 정원 울타리를 넘었다. 택시비를 냈다.', ST('2025.03.14', '11:30 AM', '인천 서구 정원', '어두운 정원', '투입', '139800'), [
  '[AN|인천광역시 서구|어두운 정원|활성|B|P001|현장 진입, 울타리 안쪽 수색]',
]);
// 3턴: 격리 종료 + 잔고 800→700
const R3 = FAKE(3, '에일린이 마지막 뿌리를 잘라 냈다. 장비 대여료를 냈다.', ST('2025.03.14', '01:10 PM', '인천 서구 정원', '어두운 정원', '투입', '139700'), [
  '[AN|인천광역시 서구|어두운 정원|격리|B|P001|격리 완료, 실종자 2명 구조]',
]);
const R3_NOCLOSE = FAKE('3b', '뿌리가 다시 자랐다. 아직 끝나지 않았다.', ST('2025.03.14', '01:10 PM', '인천 서구 정원', '어두운 정원', '투입', '139800'), [
  '[AN|인천광역시 서구|어두운 정원|활성|B|P001|뿌리가 다시 자라 대치 중]',
]);
const R3_CLOSE2 = FAKE('3c', '두 번째로 굴린 답. 정원이 조용해졌다.', ST('2025.03.14', '01:20 PM', '인천 서구 정원', '어두운 정원', '투입', '139650'), [
  '[AN|인천광역시 서구|어두운 정원|격리|B|P001|격리 완료(다시 굴린 답)]',
]);
const UPD2 = U({ cues: [{ who: '에일린', cue: '작은친절', m: '@M', quote: '에일린과 함께 정원 울타리를 넘었다', reason: '같이 가 줌' }], present: ['에일린'] });
const UPD3 = U({ cues: [{ who: '에일린', cue: '큰도움', m: '@M', quote: '에일린이 마지막 뿌리를 잘라 냈다', reason: '목숨을 구함' }], present: ['에일린'] });

/** 대표 경로를 종료 직후까지 만든다 (갈래들이 같이 씀). 결과 채팅을 돌려준다 */
async function toClose(S, s, record = true) {
  await S.start('A00', 2);
  const o1 = await S.mainSend('복도를 따라 걷는다.', 'u1');
  await S.botReply(R1, 'c1');
  const o2 = await S.mainSend('어두운 정원으로 출동한다. 에일린이 따라온다.', 'u2');
  await S.queue('update', UPD2);
  await S.botReply(R2, 'c2');
  const o3 = await S.mainSend('뿌리를 끊는다.', 'u3');
  if (record) writeReq(s, o3, R3, '(3턴 본편 요청 — 종료 직전)\n');
  await S.queue('update', UPD3);
  await S.botReply(R3, 'c3');
  await sleep(600);
  return { o1, o2, o3 };
}

let snapClosed = null;
let storeClosed = null;

// ════════ A: 대표 경로 (PC, 화면 단추) ════════
if (want('A') || want('S') || want('C') || want('P') || want('L') || want('R')) {
  const S = await session({ message: [], scriptstate: {} });
  let s = step('A01', '출동_종료_응답처리');
  await toClose(S, s);
  const jr = await S.journal();
  const rp = await S.reports();
  const row = jr?.rows?.find((r) => r.name === '어두운 정원');
  const rep = rp?.items?.find((r) => r.id === row?.rpt);
  check(s, '일지에 어두운 정원 1줄 (격리 = model 종료, 내 사건)', jr?.rows?.filter((r) => r.name === '어두운 정원').length === 1 && row?.cause === 'model' && row?.mine === true, 'model · mine', jr?.rows?.map((r) => `${r.name}|${r.cause}|mine:${r.mine}`));
  check(s, '보고서 1건, 전체 보고서(full), 번호 RPT-0314-01', rep?.full === true && rep?.no === 'RPT-0314-01', 'full RPT-0314-01', rep && { full: rep.full, no: rep.no });
  check(s, '투입 요원 P001 → 명부 이름', rep?.agents?.length === 1 && rep.agents[0].id === 'P001', 'P001', rep?.agents);
  check(s, '결과 = 마지막 상황 글 「격리 완료, 실종자 2명 구조」', /격리 완료, 실종자 2명 구조/.test(rep?.result ?? ''), '격리 완료…', rep?.result);
  check(s, '경과: 발견→진입→격리 3줄 이상', (rep?.trail?.length ?? 0) >= 3, '≥3', rep?.trail?.map((t) => t.text));
  check(s, '가계부: 사건 동안 거래 2건(-200, -100) · 종료 잔고 139,700 (응답 뒤 다시 셈 refreshClosures)', rep?.wallet?.length === 2 && rep.wallet.some((t) => t.amount === -200) && rep.wallet.some((t) => t.amount === -100) && rep.balance === 139700, { trades: [-200, -100], balance: 139700 }, { wallet: rep?.wallet, balance: rep?.balance });
  check(s, '인물 변화: 에일린 호감 + (2턴 작은친절 + 3턴 큰도움, 종료 응답 뒤 다시 셈)', rep?.people?.some((p) => p.who === '에일린' && p.delta > 0), '에일린 +', rep?.people);
  info(s, '인물 변화 원문', rep?.people);
  info(s, '보조 호출 종류', await S.llm());
  check(s, '저장 상태창 원문이 statusKey 로 (카드 자리표)', !!rep?.statusKey && (await S.lastText()).includes(rep.statusKey), '있음', rep?.statusKey);
  const prev = S.J((await S.vars()).$goei_prev);
  check(s, '리롤 기준에 이 응답이 만든 일지 줄 id(made)', prev?.made?.includes(row?.id), row?.id, prev?.made);
  await S.saveState(s);

  s = step('A02', '채팅_보고서카드');
  const html = await S.display(await S.lastText());
  writeFileSync(`${OUT}화면A02_카드.html`, html);
  check(s, '종료 응답 상태창 아래 보고서 카드 (기본 「내가 출동한 사건만」)', html.includes('data-goei-card="report"') && html.includes('어두운 정원'), '카드', html.slice(0, 200));
  check(s, '카드에 번호·「내 사건」 딱지·투입·결과·「기록에서 보기」', /RPT-0314-01/.test(html) && /내 사건/.test(html) && /투입 /.test(html) && /격리 완료/.test(html) && /기록에서 보기/.test(html), '모두', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
  const html2 = await S.display(await S.textOf('c2'));
  check(s, '앞 응답(2턴) 상태창 아래엔 카드 없음', !html2.includes('data-goei-card="report"'), '없음', html2.includes('data-goei-card="report"'));
  await S.saveState(s);

  s = step('A03', '종료알림_창열기');
  await S.open();
  const toast = await S.page.evaluate(() => document.querySelector('.gx-rectoast')?.innerText ?? '');
  await S.page.screenshot({ path: `${OUT}화면A03_종료알림_PC.png` });
  check(s, '창을 열면 「보고서가 기록에 저장됐어요 · 어두운 정원」 알림', /보고서가 기록에 저장됐어요/.test(toast) && toast.includes('어두운 정원'), '알림', toast);
  const pf = S.J(await S.page.evaluate(() => window.__store['p:goei:prefs'] ?? null));
  check(s, '본 알림이 기기 설정 noticedReports 에 남음 (새로 고침 뒤 또 안 뜨게, 2026-11-05)', (pf?.noticedReports ?? []).includes(row?.rpt), row?.rpt, pf?.noticedReports);
  await S.act('rec-open', row?.rpt, 700);
  const pop = await S.page.evaluate(() => document.querySelector('.gx-rptpop')?.innerText ?? '');
  check(s, '알림 「보기」 → 기록 탭 위 보고서 창', pop.includes('어두운 정원') && pop.includes('경과'), '보고서 창', pop.slice(0, 200));
  writeFileSync(`${OUT}화면A03_보고서창.txt`, pop);
  await S.page.screenshot({ path: `${OUT}화면A03_보고서창_PC.png` });
  check(s, '보고서 창: 투입 요원·결과·인물 기록 변화·가계부·종료 시점 잔고 139,700', /투입 요원/.test(pop) && /인물 기록 변화/.test(pop) && /가계부/.test(pop) && /139,700/.test(pop), '모두', pop.replace(/\s+/g, ' ').slice(0, 600));
  check(s, '보고서 창: 「직접 종료」·「시간 경과」 표시 없음 (model 종료)', !/직접 종료|시간 경과/.test(pop), '없음', pop.match(/괴이 · 종료[^\n]*/)?.[0]);
  await S.saveState(s);

  s = step('A04', '이미지로저장_PNG');
  const dl = S.page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await S.act('rec-png', rep?.id, 2500);
  const d = await dl;
  const png = await S.page.evaluate(() => ({ modal: !!document.querySelector('.gx-pngpop'), src: document.querySelector('.gx-png-img')?.getAttribute('src') ?? '', err: document.querySelector('.gx-err')?.innerText ?? '' }));
  check(s, 'PNG 내려받기 시작 + 미리보기 창', !!d && png.modal, '내려받기·창', { file: d?.suggestedFilename(), ...png });
  const pname = await S.page.evaluate(() => document.querySelector('.gx-png-title')?.closest('.gx-pngcard')?.innerText ?? '');
  const toastName = await S.winText();
  check(s, '파일 이름: 소속 세력 이름_보고서_RPT-0314-01.png (안내 글로 확인 — headless 는 한글 파일 이름을 download 로 바꿔 보여 줌)', /관리국_보고서_RPT-0314-01\.png/.test(toastName), '관리국_보고서_RPT-0314-01.png', (toastName.match(/[^\s]*보고서_RPT[^\s]*/) ?? [])[0]);
  void pname;
  if (d) { const p = `${OUT}화면A04_보고서.png`; await d.saveAs(p).catch(() => {}); }
  await S.act('rec-png-x', undefined, 300);
  await S.saveState(s);

  s = step('A05', '고정');
  await S.act('rec-pin', rep?.id, 700);
  const rp5 = await S.reports();
  check(s, '고정 → 보고서 pin true, 일지 줄에 고정 표시', rp5?.items?.find((x) => x.id === rep?.id)?.pin === true, true, rp5?.items?.map((x) => `${x.id}:${x.pin}`));
  await S.act('rec-pin', rep?.id, 700);
  check(s, '다시 누르면 고정 풀림', !(await S.reports())?.items?.find((x) => x.id === rep?.id)?.pin, '풀림', (await S.reports())?.items?.map((x) => `${x.id}:${x.pin}`));
  await S.act('rec-back', undefined, 400);
  const list = await S.page.evaluate(() => [...document.querySelectorAll('.gx-jr-row')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  writeFileSync(`${OUT}화면A05_일지.txt`, list.join('\n'));
  check(s, '일지 목록 1줄 (어두운 정원 · 내 사건 · 에일린 호감 · 지출 −₩300)', list.length === 1 && /어두운 정원/.test(list[0]) && /내 사건/.test(list[0]), '1줄', list);
  info(s, '일지 줄 요약', list);
  await S.page.screenshot({ path: `${OUT}화면A05_일지_PC.png` });
  await S.saveState(s);
  snapClosed = await S.chat();
  storeClosed = await S.page.evaluate(() => ({ ...window.__store }));

  s = step('A06', '다음턴_본편요청');
  await closeWin(S.page).catch(() => {});
  const o4 = await S.mainSend('본부로 돌아가 보고한다.', 'u4');
  writeReq(s, o4);
  const t4 = allText(o4);
  check(s, '본편 요청에 일지·보고서 글이 안 들어감 (2026-10-29 사용자: 넘기지 않음)', !/RPT-\d{4}|사건 보고서|보고서가 기록에|기록에서 보기|\$goei_(journal|reports)/.test(t4), '없음', (t4.match(/RPT-\d{4}[^\n]*|사건 보고서[^\n]*/g) ?? []).slice(0, 3));
  check(s, '본편 요청에 카드 HTML(data-goei-card)이 안 들어감', !/data-goei-card|data-goei-rec/.test(t4), '없음', /data-goei/.test(t4));
  const histC3 = o4.find((m) => m.role === 'assistant' && m.content.includes('가짜 응답 3'))?.content ?? '';
  check(s, '지난 종료 응답 본문엔 격리 태그가 지워져 있음 (저장 본문 정리)', histC3 && !/\[AN\|/.test(histC3), '태그 없음', histC3.slice(0, 200));
  info(s, '요청 World Entries 에 어두운 정원 줄이 있나 (끝났다는 말은 없음 — 15 물을 것 1)', (t4.match(/[^\n]*어두운 정원[^\n]*/g) ?? []).slice(0, 4));
  await S.botReply(FAKE(4, '본부. 보고서를 쓴다.', ST('2025.03.14', '03:00 PM', '관리국 본부')), 'c4');
  const jr6 = await S.journal();
  check(s, '다음 턴 응답 뒤에도 일지 1줄 그대로 (두 번 안 적힘)', jr6?.rows?.length === 1, 1, jr6?.rows?.map((r) => r.name));
  await S.open();
  const toast6 = await S.page.evaluate(() => document.querySelector('.gx-rectoast')?.innerText ?? '');
  check(s, '다음 턴 뒤 창을 열어도 종료 알림 다시 안 뜸', !toast6, '없음', toast6);
  const html6 = await S.display(await S.textOf('c3'));
  check(s, '다음 턴 뒤에도 종료 응답의 카드는 그대로', html6.includes('data-goei-card="report"'), '카드', html6.includes('data-goei-card="report"'));
  await S.saveState(s);
  check(s, '페이지 오류 없음', S.errors.length === 0, [], S.errors.slice(0, 5));
  await S.page.close();
}

// ════════ R: 다시 굴리기·지우기 ════════
if (want('R') && snapClosed) {
  const S = await session(JSON.parse(JSON.stringify(snapClosed)), 'pc', storeClosed);
  // 저장 채팅은 c3 까지 (A05 시점)
  let s = step('R01', '종료응답_다시굴림_안끝남');
  const oR = await S.rerollRequest();
  writeReq(s, oR, R3_NOCLOSE);
  check(s, '다시 굴린 요청: 어두운 정원이 진행 중 줄로 되감김', /어두운 정원/.test(allText(oR)), '있음', (allText(oR).match(/[^\n]*어두운 정원[^\n]*/g) ?? []).slice(0, 3));
  await S.queue('update', U());
  await S.botReply(R3_NOCLOSE, 'c3b');
  const jr = await S.journal();
  const rp = await S.reports();
  check(s, '일지·보고서에서 버린 응답의 종료 줄이 빠짐', !jr?.rows?.length && !rp?.items?.length, '0·0', { rows: jr?.rows?.map((r) => r.name), items: rp?.items?.map((r) => r.no) });
  const w = await S.world();
  check(s, '상황판: 어두운 정원 활성', w.an.some((e) => e.name === '어두운 정원' && e.state === '활성'), '활성', w.an.map((e) => `${e.name}|${e.state}`));
  const html = await S.display(await S.lastText());
  check(s, '새 응답 아래 카드 없음', !html.includes('data-goei-card="report"'), '없음', html.includes('data-goei-card="report"'));
  const oldHtml = await S.display(snapClosed.message.find((m) => m.chatId === 'c3').data);
  check(s, '버린 응답 글로 그려도 카드 없음 (열쇠 표에서 빠짐)', !oldHtml.includes('data-goei-card="report"'), '없음', oldHtml.includes('data-goei-card="report"'));
  await S.open('records');
  const txt = await S.winText();
  check(s, '기록 › 일지: 「아직 종료된 상황이 없어요」', /아직 종료된 상황이 없어요/.test(txt), '빈 안내', txt.slice(0, 300));
  await S.saveState(s);

  s = step('R02', '다시굴림_다시끝남');
  await closeWin(S.page).catch(() => {});
  await S.rerollRequest();
  await S.queue('update', U());
  await S.botReply(R3_CLOSE2, 'c3c');
  const jr2 = await S.journal();
  const rp2 = await S.reports();
  check(s, '일지 1줄·보고서 1건 (결과는 새 답 글)', jr2?.rows?.length === 1 && rp2?.items?.length === 1 && /다시 굴린 답/.test(rp2.items[0].result), '1·1 새 글', { rows: jr2?.rows?.map((r) => `${r.name}|${r.result}`), items: rp2?.items?.map((r) => `${r.no}|${r.result}`) });
  check(s, '새 보고서 잔고 139,650 · 거래 -200, -150', rp2?.items?.[0]?.balance === 139650 && rp2.items[0].wallet?.some((t) => t.amount === -150), { balance: 139650 }, { balance: rp2?.items?.[0]?.balance, wallet: rp2?.items?.[0]?.wallet });
  const html2 = await S.display(await S.lastText());
  check(s, '새 응답 아래 카드', html2.includes('data-goei-card="report"'), '카드', html2.includes('data-goei-card="report"'));
  await S.open();
  const toast = await S.page.evaluate(() => document.querySelector('.gx-rectoast')?.innerText ?? '');
  info(s, '다시 끝난 응답 뒤 알림 (같은 id 면 이미 본 것으로 안 뜸)', { toast, id: jr2?.rows?.[0]?.rpt, sameAsBefore: jr2?.rows?.[0]?.rpt === S.J(snapClosed.scriptstate.$goei_journal).rows[0].rpt });
  await S.saveState(s);

  s = step('R03', '고정한뒤_다시굴림_안끝남');
  const id2 = rp2?.items?.[0]?.id;
  await S.open('records');
  await S.act('rec-open', id2, 600);
  await S.act('rec-pin', id2, 700);
  check(s, '고정됨', (await S.reports())?.items?.[0]?.pin === true, true, (await S.reports())?.items?.map((x) => x.pin));
  await closeWin(S.page).catch(() => {});
  await S.rerollRequest();
  await S.queue('update', U());
  await S.botReply(R3_NOCLOSE, 'c3d');
  const jr3 = await S.journal();
  const w3 = await S.world();
  info(s, '고정한 보고서는 다시 굴려도 남음 (store.ts:118 「고정한 보고서도 둔다」)', { rows: jr3?.rows?.map((r) => `${r.name}|${r.cause}`), an: w3.an.map((e) => `${e.name}|${e.state}`) });
  check(s, '일지(종료)와 상황판(활성)이 같은 말', !(jr3?.rows?.some((r) => r.name === '어두운 정원') && w3.an.some((e) => e.name === '어두운 정원' && e.state === '활성')), '어긋나지 않음', { rows: jr3?.rows?.map((r) => r.name), an: w3.an.map((e) => `${e.name}|${e.state}`) });
  const html3 = await S.display(await S.lastText());
  info(s, '새(안 끝난) 응답 아래 카드', html3.includes('data-goei-card="report"'));
  await S.saveState(s);

  s = step('R04', '고정상태_다음에_다시끝남');
  await S.mainSend('다시 뿌리를 끊는다.', 'u5');
  await S.queue('update', U());
  await S.botReply(FAKE(5, '이번엔 정말 끝났다.', ST('2025.03.14', '02:00 PM', '인천 서구 정원', '어두운 정원', '투입', '139800'), ['[AN|인천광역시 서구|어두운 정원|격리|B|P001|두 번째 격리]']), 'c5');
  const jr4 = await S.journal();
  info(s, '같은 괴이 일지 줄 수 (고정 줄 + 새 종료)', jr4?.rows?.map((r) => `${r.name}|${r.result}|${r.rpt}`));
  check(s, '같은 사건이 일지에 두 번 끝난 것으로 남지 않음', (jr4?.rows ?? []).filter((r) => r.name === '어두운 정원').length <= 1, '≤1', (jr4?.rows ?? []).filter((r) => r.name === '어두운 정원').map((r) => r.result));
  await S.saveState(s);
  check(s, '페이지 오류 없음', S.errors.length === 0, [], S.errors.slice(0, 5));
  await S.page.close();

  // 지우기: 종료 응답을 지우고 다른 말을 보냄 (15 물을 것 2 와 같은 길 — 기록 쪽만 본다)
  const S2 = await session(JSON.parse(JSON.stringify(snapClosed)), 'pc', storeClosed);
  s = step('R05', '종료응답_지우기_다른말');
  await S2.deleteLast();
  await S2.page.evaluate(() => { window.__chat.message.pop(); }); // 유저 u3 도 지움
  const o5 = await S2.mainSend('정원을 떠나 본부로 간다.', 'u3x');
  writeReq(s, o5);
  await S2.queue('update', U());
  await S2.botReply(FAKE('3x', '본부로 돌아왔다.', ST('2025.03.14', '01:30 PM', '관리국 본부')), 'c3x');
  const jr5 = await S2.journal();
  const w5 = await S2.world();
  info(s, '지운 응답의 종료 줄 (일지는 영구 보관 — store.ts:2)', { rows: jr5?.rows?.map((r) => `${r.name}|${r.anchor}`), an: w5.an.map((e) => `${e.name}|${e.state}`) });
  await S2.open('records');
  const lst = await S2.page.evaluate(() => [...document.querySelectorAll('.gx-jr-row')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  info(s, '기록 일지 화면', lst);
  await S2.act('rec-open', jr5?.rows?.[0]?.rpt, 600);
  const pop = await S2.page.evaluate(() => document.querySelector('.gx-rptpop')?.innerText ?? '');
  info(s, '지운 응답의 보고서 창', pop.replace(/\s+/g, ' ').slice(0, 300));
  await S2.saveState(s);
  await S2.page.close();
}

// ════════ S: 설정 갈래 (카드 표시 off/all, 남의 사건) ════════
if (want('S') && snapClosed) {
  const S = await session(JSON.parse(JSON.stringify(snapClosed)), 'pc', storeClosed);
  let s = step('S01', '남의사건_종료');
  // 가짜괴이(부산 북구, P004 투입, 나는 안 감)를 모델이 격리로 끝냄
  await S.mainSend('사무실에서 대기한다.', 'u4');
  await S.queue('update', U());
  const R4 = FAKE(4, '무전으로 부산 쪽 소식이 들어왔다.', ST('2025.03.14', '03:00 PM', '관리국 본부'), ['[AN|부산광역시 북구|가짜괴이|격리|C|P004|부산 팀이 격리 완료]']);
  await S.botReply(R4, 'c4');
  const jr = await S.journal();
  const row = jr?.rows?.find((r) => r.name === '가짜괴이');
  const rep = (await S.reports())?.items?.find((r) => r.id === row?.rpt);
  check(s, '남의 사건: 일지 줄 mine false, 간이 보고서(full false, 인물·가계부 없음)', row && !row.mine && rep && rep.full === false && !rep.people && !rep.wallet, 'bg 간이', { row: row && { mine: row.mine }, rep: rep && { full: rep.full, people: rep.people, wallet: rep.wallet } });
  const h = await S.display(await S.lastText());
  check(s, '기본(내가 출동한 사건만): 카드 안 뜸', !h.includes('data-goei-card="report"'), '없음', h.includes('data-goei-card="report"'));
  await S.open();
  const toast = await S.page.evaluate(() => document.querySelector('.gx-rectoast')?.innerText ?? '');
  check(s, '남의 사건은 종료 알림 없음', !toast, '없음', toast);
  await S.saveState(s);

  s = step('S02', '카드표시_전부');
  await openWin(S.page); await sleep(400);
  await openEditor(S.page, 'set:journal'); await sleep(600);
  const pane2 = await S.page.evaluate(() => document.querySelector('.jr-set')?.innerText ?? '');
  check(s, '설정 › 기록 › 일지 설정 화면이 열림', /보고서 카드 표시/.test(pane2), '보고서 카드 표시', pane2.replace(/\s+/g, ' ').slice(0, 200));
  const clicked = await S.act('jr-set', 'chat_card=all', 1200, '.gw');
  check(s, '「전부」 단추 → $jr_chat_card all', clicked && (await S.vars()).$jr_chat_card === 'all', 'all', { clicked, v: (await S.vars()).$jr_chat_card });
  const hAll = await S.display(await S.lastText());
  const hMine = await S.display(await S.textOf('c3'));
  check(s, '전부: 남의 사건 카드도 바로 뜸 (「그 외」 딱지)', hAll.includes('data-goei-card="report"') && /그 외/.test(hAll), '카드·그 외', hAll.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
  check(s, '전부: 내 사건 카드도 그대로', hMine.includes('data-goei-card="report"'), '카드', hMine.includes('data-goei-card="report"'));
  await S.saveState(s);

  s = step('S03', '카드표시_안띄움');
  await S.act('jr-set', 'chat_card=off', 1200, '.gw');
  check(s, '「안 띄움」 단추 → $jr_chat_card off', (await S.vars()).$jr_chat_card === 'off', 'off', (await S.vars()).$jr_chat_card);
  const hOff1 = await S.display(await S.lastText());
  const hOff2 = await S.display(await S.textOf('c3'));
  check(s, '안 띄움: 이미 뜬 카드도 바로 사라짐 (설명 「안 띄움으로 바꾸면 이미 뜬 카드도 사라져요」)', !hOff1.includes('data-goei-card="report"') && !hOff2.includes('data-goei-card="report"'), '없음', { bg: hOff1.includes('data-goei-card="report"'), mine: hOff2.includes('data-goei-card="report"') });
  await closeEditor(S.page, true).catch(() => {});
  await closeWin(S.page).catch(() => {});
  await S.mainSend('계속 대기한다.', 'u5');
  await S.queue('update', U());
  await S.botReply(FAKE(5, '조용하다.', ST('2025.03.14', '04:00 PM', '관리국 본부')), 'c5');
  const hOff3 = await S.display(await S.textOf('c3'));
  check(s, '안 띄움: 다음 응답 뒤에도 카드 없음', !hOff3.includes('data-goei-card="report"'), '없음', hOff3.includes('data-goei-card="report"'));
  const jr3 = await S.journal();
  check(s, '안 띄움이어도 일지·보고서는 그대로 쌓임', jr3?.rows?.length === 2, 2, jr3?.rows?.map((r) => r.name));
  const t5 = allText(await S.mainSend('보고서를 정리한다.', 'u6'));
  check(s, '설정과 상관없이 본편 요청엔 기록이 안 감', !/RPT-\d{4}|data-goei-card/.test(t5), '없음', /RPT-/.test(t5));
  await S.page.evaluate(() => { window.__chat.message.pop(); });
  await S.saveState(s);

  s = step('S04', '설정창_일지상한_단추');
  await openWin(S.page); await sleep(400);
  await openEditor(S.page, 'set:journal'); await sleep(600);
  await S.act('jr-set', 'chat_card=mine', 1200, '.gw');
  const hm = await S.display(await S.textOf('c3'));
  check(s, '「내가 출동한 사건만」으로 되돌리면 지난 종료 응답 카드가 바로 다시 뜸', hm.includes('data-goei-card="report"'), '카드', hm.includes('data-goei-card="report"'));
  const before = (await S.vars()).$jr_journal_cap;
  await S.act('jr-step', 'journal_cap:-', 800, '.gw');
  const stepBtns = await S.page.evaluate(() => [...document.querySelectorAll('.gw [data-action="jr-step"]')].map((e) => e.dataset.value).slice(0, 6));
  info(s, '일지 상한 단추 값들·누른 뒤 값', { before, after: (await S.vars()).$jr_journal_cap, stepBtns });
  await S.page.screenshot({ path: `${OUT}화면S04_일지설정_PC.png` });
  await S.saveState(s);
  check(s, '페이지 오류 없음', S.errors.length === 0, [], S.errors.slice(0, 5));
  await S.page.close();
}

// ════════ C: 상한 ════════
if (want('C') && snapClosed) {
  const base = JSON.parse(JSON.stringify(snapClosed));
  const J = (v) => JSON.parse(v);
  const jr = J(base.scriptstate.$goei_journal);
  const rp = J(base.scriptstate.$goei_reports);
  const proto = jr.rows[0];
  const rproto = rp.items[0];
  // 옛 종료 줄 20개를 앞에 채운다 (보고서 상한 최소 20)
  const oldRows = [];
  const oldReps = [];
  for (let i = 0; i < 21; i++) {
    const id = `old${i}`;
    oldRows.push({ ...proto, id: `j${id}`, name: `옛 사건 ${i}`, rpt: `r${id}`, at: proto.at - 1000 + i, mine: false });
    oldReps.push({ ...rproto, id: `r${id}`, no: `RPT-0313-${String(i + 1).padStart(2, '0')}`, full: false, mine: false, head: { ...rproto.head, name: `옛 사건 ${i}` }, people: undefined, wallet: undefined, balance: undefined, pin: i === 0 ? true : undefined });
  }
  base.scriptstate.$goei_journal = JSON.stringify({ v: 1, rows: oldRows });
  base.scriptstate.$goei_reports = JSON.stringify({ v: 1, items: oldReps });
  base.scriptstate.$jr_report_cap = '20';
  base.message = base.message.slice(0, base.message.findIndex((m) => m.chatId === 'c3')); // c3 앞까지 (u3 포함)
  const S = await session(base, 'pc', storeClosed);
  let s = step('C01', '보고서상한_넘침');
  // u3 다음 응답을 다시 붙인다 — 리롤 기준(prev.i)이 같은 자리라 리롤로 처리됨. 그래도 made 의 줄만 지우므로 옛 줄은 남아야 한다
  await S.queue('update', U());
  await S.botReply(R3, 'c3');
  const j = await S.journal();
  const r = await S.reports();
  check(s, '일지: 옛 21 + 새 1 = 22줄 (일지 상한 500 안)', j?.rows?.length === 22, 22, j?.rows?.length);
  check(s, '보고서: 고정 1 + 안 고정 21 → 상한 20 넘침, 가장 오래된 안 고정 1건(rold1) 빠져 21건 (고정은 셈 밖)', r?.items?.length === 21 && !r.items.some((x) => x.id === 'rold1') && r.items.some((x) => x.id === 'rold0'), '21 · rold1 빠짐 · rold0(고정) 남음', r?.items?.map((x) => x.id));
  const row1 = j?.rows?.find((x) => x.id === 'jold1');
  check(s, '보고서가 지워진 일지 줄은 rpt 가 끊김 (줄은 남음)', row1 && !row1.rpt, 'rpt 없음', row1);
  await S.open('records');
  const txt = await S.page.evaluate(() => [...document.querySelectorAll('.gx-jr-row')].map((e) => `${e.tagName}:${e.innerText.replace(/\s+/g, ' ').slice(0, 160)}`));
  check(s, '보고서 없는 줄은 눌리지 않는 줄(div)로 그림', txt.some((t) => t.startsWith('DIV:') && / 옛 사건 1 /.test(t)), 'DIV', txt.filter((t) => / 옛 사건 1 /.test(t)));
  info(s, '첫 화면 줄 수(한 번에 보일 줄 수 30)', txt.length);
  await S.saveState(s);

  s = step('C02', '일지상한_낮추기');
  await S.page.evaluate(() => { window.__chat.scriptstate.$jr_journal_cap = '100'; });
  const n0 = (await S.journal())?.rows?.length;
  info(s, '상한을 줄여도 다음 종료 전엔 줄을 안 지움 (설명 「넘치면 오래된 줄부터 지워요」)', { before: n0 });
  await S.saveState(s);
  check(s, '페이지 오류 없음', S.errors.length === 0, [], S.errors.slice(0, 5));
  await S.page.close();
}

// ════════ P: 폰 크기 ════════
if (want('P') && snapClosed) {
  const S = await session(JSON.parse(JSON.stringify(snapClosed)), 'phone', storeClosed);
  const s = step('P01', '폰_기록탭_보고서');
  await openWin(S.page); await sleep(600);
  await S.dropInstall();
  const tabbed = (await S.act('tab', 'records', 700)) || (await S.act('nav-tab', 'records', 700));
  const rows = await S.page.evaluate(() => [...document.querySelectorAll('.gx-jr-row')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  check(s, '폰: 기록 탭 → 일지 1줄', tabbed && rows.length === 1, 1, { tabbed, rows });
  await S.page.screenshot({ path: `${OUT}화면P01_일지_폰.png` });
  const rid = S.J(snapClosed.scriptstate.$goei_journal).rows[0].rpt;
  await S.page.evaluate(() => document.querySelector('.gx-jr-row')?.click()); await sleep(700);
  const pop = await S.page.evaluate(() => { const e = document.querySelector('.gx-rptpop .gx-rptcard'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: r.width, left: r.left, right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, text: e.innerText.slice(0, 120) }; });
  check(s, '폰: 줄 누르면 보고서 창, 화면 폭 안 (가로 넘침 없음)', pop && pop.left >= 0 && pop.right <= pop.vw + 1 && pop.sw <= pop.vw + 1, '폭 안', pop);
  await S.page.screenshot({ path: `${OUT}화면P01_보고서_폰.png` });
  const btn = await S.page.evaluate(() => { const e = document.querySelector('.gx-rptpop [data-action="rec-png"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, w: r.width }; });
  check(s, '폰: 「이미지로 저장」 단추가 보임', !!btn && btn.w > 0, '보임', btn);
  const dl = S.page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await S.act('rec-png', rid, 2500);
  const d = await dl;
  const modal = await S.page.evaluate(() => { const e = document.querySelector('.gx-pngpop .gx-pngcard'); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, vw: innerWidth }; });
  check(s, '폰: PNG 내려받기 + 미리보기 창 폭 안', !!d && modal && modal.right <= modal.vw + 1, '창', { file: d?.suggestedFilename(), modal });
  await S.page.screenshot({ path: `${OUT}화면P01_PNG_폰.png` });
  await S.act('rec-png-x', undefined, 300);
  await S.act('rec-back', undefined, 400);
  const still = await S.page.evaluate(() => !!document.querySelector('.gx-rptpop'));
  check(s, '폰: 닫기 → 보고서 창 닫힘', !still, '닫힘', still);
  await S.saveState(s);
  check(s, '페이지 오류 없음', S.errors.length === 0, [], S.errors.slice(0, 5));
  await S.page.close();
}

// ════════ L: 페이지 새로 고침·채팅 다시 열기 ════════
if (want('L') && snapClosed) {
  // 같은 채팅·같은 저장소(prefs 포함)로 새 페이지 = 새로 고침
  const S = await session(JSON.parse(JSON.stringify(snapClosed)), 'pc', storeClosed);
  let s = step('L01', '새로고침_뒤');
  const h0 = await S.display(snapClosed.message.find((m) => m.chatId === 'c3').data);
  info(s, '새로 고침 직후(창 열기 전) 카드 (열쇠 표는 채팅 전환·응답 때 모음)', h0.includes('data-goei-card="report"'));
  await S.open();
  const toast = await S.page.evaluate(() => document.querySelector('.gx-rectoast')?.innerText ?? '');
  check(s, '새로 고침 뒤 종료 알림이 다시 안 뜸 (noticedReports)', !toast, '없음', toast);
  const h1 = await S.display(snapClosed.message.find((m) => m.chatId === 'c3').data);
  check(s, '창을 연 뒤 종료 응답 카드가 그려짐', h1.includes('data-goei-card="report"'), '카드', h1.includes('data-goei-card="report"'));
  await S.act('tab', 'records', 600);
  const rows = await S.page.evaluate(() => [...document.querySelectorAll('.gx-jr-row')].length);
  check(s, '기록 일지 1줄 그대로', rows === 1, 1, rows);
  await S.saveState(s);
  await S.page.close();

  // 새 기기(prefs 없음) = 같은 채팅을 다른 기기에서 열기
  const store2 = { ...storeClosed };
  delete store2['p:goei:prefs'];
  const S2 = await session(JSON.parse(JSON.stringify(snapClosed)), 'pc', store2);
  s = step('L02', '다른기기_같은채팅');
  await S2.open();
  const t2 = await S2.page.evaluate(() => document.querySelector('.gx-rectoast')?.innerText ?? '');
  info(s, '알림 본 기록은 기기 설정이라 다른 기기에선 마지막 응답의 종료 알림이 한 번 뜸', t2);
  await S2.saveState(s);
  await S2.page.close();

  // 열쇠 표: 앞 채팅의 카드가 다른 채팅에 새지 않나 (채팅 전환)
  const S3 = await session(JSON.parse(JSON.stringify(snapClosed)), 'pc', storeClosed);
  s = step('L03', '다른채팅으로_전환');
  await S3.open();
  const other = { message: [{ role: 'char', data: snapClosed.message.find((m) => m.chatId === 'c3').data, chatId: 'zz' }], scriptstate: { ...snapClosed.scriptstate, $goei_journal: '', $goei_reports: '' } };
  await S3.page.evaluate((c) => { window.__chat = c; }, other);
  await closeWin(S3.page).catch(() => {});
  await S3.page.evaluate(async () => { for (const f of window.__calls.chatChange ?? []) await f?.(); });
  await S3.open();
  const hz = await S3.display(snapClosed.message.find((m) => m.chatId === 'c3').data);
  info(s, '(틀 한계) 같은 채팅 번호에 채팅만 바꿔 끼운 것이라 플러그인 감시(번호 변화)가 전환으로 못 봄 — 실제 전환은 body.ts:1021 resetStatusContext', hz.includes('data-goei-card="report"'));
  await S3.saveState(s);
  await S3.page.close();
}

writeFileSync(resFile, JSON.stringify(results, null, 2));
const real = results.filter((r) => r.why !== 'info');
const steps = [...new Set(real.map((r) => r.step))];
const bad = new Set(real.filter((r) => !r.ok).map((r) => r.step));
console.log(`\n검사 ${real.length}개 중 ${real.filter((r) => r.ok).length}개 통과 · 단계 ${steps.length}개 중 ${steps.length - bad.size}개 통과 · 어긋난 단계: ${[...bad].join(', ') || '없음'}`);
await b.close();
