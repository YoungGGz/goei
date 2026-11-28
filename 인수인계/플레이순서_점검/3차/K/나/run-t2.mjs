// 3차 K4 세계 탭 편집기 · T2 (실제 리스AI 996a553 vite dev + 가짜 모델 서버 8802). 사용: FAKE_URL=http://<IP>:8802 node run-t2.mjs [절 글자] [--w 1280 --h 800]
// 시작 상태: setup() → loadState(S-관리국-3턴). 실제 단추(플러그인 창 iframe 안 data-action)로 고치고, 리스아이 입력칸으로 보내 가짜 서버가 받은 본편 요청을 본다.
import { openT2 } from '../../틀/risu-t2.mjs';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const HERE = fileURLToPath(new URL('./', import.meta.url));
const OUT = `${HERE}out/`;
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = (argv.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const SIZE = `${W}x${H}`;
const touch = W < 600 || (Math.min(W, H) < 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, what, expect, ref, ok, actual, evidence = '') {
  results.push({ id: `${id}@${SIZE}`, what, expect, ref, ok: ok === null ? 'info' : !!ok, actual, evidence });
  console.log(`${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'} [${id}] ${what}${ok ? '' : `\n   기대: ${expect}\n   실제: ${JSON.stringify(actual)?.slice(0, 600)}`}`);
}
const AGE = /^(\s*[-*]?\s*(?:Age|나이)\s*[:：]).*$/gim;
const scrub = (t) => String(t).replace(AGE, '$1 [생략]').replace(/\((\d+|early \d+s|mid \d+s|late \d+s)\//g, '([생략]/');

const t = await openT2({ via: 'plain', width: W, height: H, touch, out: OUT });
const STATUS = '[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';
await t.fake('reset', {});
await t.fake('rules', { rules: [
  { id: 'router', route: 'aux', match: 'Router|selected', reply: '{"selected":[],"new_characters":[]}' },
  { id: 'director', route: 'aux', match: 'Director|notes', reply: '{"notes":[]}' },
  { id: 'aux', route: 'aux', reply: '{}' },
  { id: 'hold', route: 'main', matchLast: '늦은답', hold: true, reply: `늦게 온 답이다. #{{seq}}\n\n${STATUS}` },
  { id: 'main', route: 'main', reply: `장면이 이어진다. #{{seq}}\n\n${STATUS}` },
] });
const card = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
  const e = st.DBState.db.characters[ci].globalLore.find((x) => x.comment === 'Directory');
  return e ? JSON.parse(e.content) : null;
});
const mainReqs = async (since) => (await t.fakeLog(since, 'main'));
const lastMain = async (since) => { const l = await t.fake(`log?since=${since}&route=main&full=1`); return l.at(-1); };
const reqText = (rec) => (rec?.body?.messages ?? []).map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const dumpReq = (name, rec) => { writeFileSync(`${OUT}${name}`, scrub(reqText(rec))); return `out/${name}`; };

// 플러그인 창 안 도우미
const fe = (fn, arg) => t.feval(fn, arg);
const act = async (action, value, wait = 400) => { const ok = await fe(([a, v]) => { const e = [...document.querySelectorAll(`[data-action="${a}"]`)].find((x) => v === undefined || x.dataset.value === v); if (e) { e.click(); return true; } return false; }, [action, value]); await sleep(wait); return ok; };
const typeIn = async (sel, v) => { const F = t.F(); const loc = F.locator(sel).first(); await loc.scrollIntoViewIfNeeded().catch(() => {}); await loc.fill(v); await sleep(100); };
const val = (sel) => fe((s) => document.querySelector(s)?.value ?? null, sel);
const openEd = async (node) => {
  await t.openWindow('.gx');
  await sleep(600);
  await fe(() => (document.querySelector('.gx [data-action="ed-open"]') ?? document.querySelector('.gx [data-action="prefs-open"]'))?.click());
  await t.frame('.gw .gw-win');
  await sleep(500);
  if (node) {
    await fe(() => document.querySelector('.gw [data-action="ed-tab"][data-value="world"]')?.click());
    await sleep(300);
    await fe((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`)?.click(), node);
    await sleep(500);
  }
};
const selRec = async (name) => {
  // 폰에서는 목록 대신 드롭다운
  const ok = await act('ed-sel', name, 500);
  if (!ok) await fe((n) => { const s = document.querySelector('.gw select.gw-list-pick'); if (s) { s.value = n; s.dispatchEvent(new Event('change', { bubbles: true })); } }, name);
  await sleep(500);
};
const closeEd = async () => { await fe(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click()); await sleep(800); await t.closeWindow(); await sleep(300); };
const shot = (name) => t.page.screenshot({ path: `${OUT}${name}-${SIZE}.png` });
const waitCard = async (pred, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const c = await card(); if (pred(c)) return c; await sleep(300); } return card(); };

await t.setup();
const r0 = await t.loadState(fileURLToPath(new URL('../../틀/states/S-관리국-3턴.json', import.meta.url)));
await sleep(1500);
check('T2-00', 'setup → S-관리국-3턴 넣기', '메시지 7', 'states/README.md', r0.messages === 7 || r0.messages?.length === 7, { messages: r0.messages, chatId: r0.chatId });

// ═══ A. 대표 줄기: 요원 소개 고침 → 실제 보내기 → 본편 요청 Roster ═══
if (want('A')) {
  await openEd('agent');
  await selRec('스팡달');
  const k = '.gw [data-input="ed-field"][data-key="agent|스팡달|intro"]';
  const v0 = await val(k);
  await typeIn(k, `${v0} 시험소개T2`);
  const c1 = await waitCard((c) => String(c?.세계?.agent?.['스팡달']?.fields?.intro ?? '').includes('시험소개T2'));
  await shot('T2-A1_요원편집');
  check('T2-A1', '실제 리스아이: 스팡달 「소개」에 글을 치면 0.7초 뒤 카드 로어북 Directory 에 저장', '세계.agent.스팡달.fields.intro 에 시험소개T2', 'K-01 (사용자 결정)', String(c1?.세계?.agent?.['스팡달']?.fields?.intro ?? '').includes('시험소개T2'), String(c1?.세계?.agent?.['스팡달']?.fields?.intro ?? '').slice(-30));
  await closeEd();
  const s0 = await t.fakeSeq();
  await t.send('복도 끝 사무실 문을 연다.');
  const rec = await lastMain(s0);
  const p = dumpReq(`T2-A2_본편요청-${SIZE}.txt`, rec);
  const line = reqText(rec).split('\n').find((l) => l.startsWith('- Spangdal ')) ?? '';
  check('T2-A2', '바로 다음 실제 본편 요청(가짜 서버가 받은 것) Roster 스팡달 줄에 시험소개T2', '있음', '코스 K4', line.includes('시험소개T2'), scrub(line), p);
  // 다시 굴리기: 세계 값은 카드 설정이라 되감기 대상 아님
  const s1 = await t.fakeSeq();
  await t.reroll();
  const rec2 = await lastMain(s1);
  check('T2-A3', '다시 굴리기 요청에도 고친 소개가 그대로(카드 설정은 응답이 만든 변경이 아니라 되감지 않음)', '있음', '공-01 은 응답이 만든 변경만 (Claude 판정)', reqText(rec2).includes('시험소개T2'), { dupOf: rec2?.dupOf, has: reqText(rec2).includes('시험소개T2') });
}

// ═══ B. 직급을 친 직후 「거점」 페이지로 (T1 B-12 재현) ═══
if (want('B')) {
  await openEd('agent');
  await selRec('큐라스');
  const before = (await card())?.요원?.['큐라스']?.rank;
  await typeIn('.gw [data-input="dir"][data-key="rank|큐라스"]', '시험직급T2');
  await fe(() => document.querySelector('.gw [data-action="ed-node"][data-value="base"]')?.click());
  await sleep(3000);
  const after = (await card())?.요원?.['큐라스']?.rank;
  await fe(() => document.querySelector('.gw [data-action="ed-node"][data-value="agent"]')?.click());
  await sleep(500);
  await selRec('큐라스');
  const ui = await val('.gw [data-key="rank|큐라스"]');
  await shot('T2-B1_거점다녀온뒤');
  check('T2-B1', '실제 리스아이: 큐라스 직급을 치고 바로(0.7초 안) 왼쪽 「거점」을 누르면', '카드에 시험직급T2 저장(바로 저장)', 'K-01 (사용자 결정)', after === '시험직급T2', { before, after, uiAfterReturn: ui }, 'src/ui/editor/index.ts:1128');
  // 비교: 0.7초 넘게 기다린 뒤 거점
  await typeIn('.gw [data-input="dir"][data-key="rank|큐라스"]', '시험직급T2');
  await sleep(1500);
  await fe(() => document.querySelector('.gw [data-action="ed-node"][data-value="base"]')?.click());
  await sleep(1500);
  check('T2-B2', '비교: 친 뒤 1.5초 기다렸다 「거점」', '저장됨', 'K-01', (await card())?.요원?.['큐라스']?.rank === '시험직급T2', (await card())?.요원?.['큐라스']?.rank);
  await closeEd();
}

// ═══ C. 조직 기본 정보 「지우기」 (T1 C-04 재현) ═══
if (want('C')) {
  await openEd('org');
  await act('ed-add-toggle');
  await typeIn('.gw [name="ed-new-name"]', '시험조직T2');
  await act('ed-add', undefined, 600);
  await fe(() => { const b = document.querySelector('.gw [data-action="ed-add"]'); b?.click(); });
  await sleep(1500);
  await closeEd();
  await openEd('org');
  await selRec('시험조직T2');
  await typeIn('.gw [data-input="ed-field"][data-key="org|시험조직T2|intro"]', '시험조직T2 소개.');
  await waitCard((c) => !!c?.조직?.['시험조직T2'] && !!c?.세계?.org?.['시험조직T2']?.fields?.intro);
  await act('dir-org-del', '시험조직T2', 800);
  const c1 = await waitCard((c) => !c?.조직?.['시험조직T2'], 4000);
  await closeEd();
  await openEd('org');
  await selRec('시험조직T2');
  const head = await fe(() => document.querySelector('.gw .gw-detail .gw-head')?.innerText ?? '');
  const listed = await fe(() => [...document.querySelectorAll('.gw .gw-row b, .gw select.gw-list-pick option')].some((e) => e.textContent.startsWith('시험조직T2')));
  await shot('T2-C1_조직지운뒤');
  await closeEd();
  const s0 = await t.fakeSeq();
  await t.send('회의실을 나선다.');
  const rec = await lastMain(s0);
  const p = dumpReq(`T2-C2_본편요청-${SIZE}.txt`, rec);
  check('T2-C1', '실제 리스아이: 직접 만든 조직의 기본 정보 「지우기」를 누르고 다시 열면', '목록에 없음 · 다음 본편 요청 세력 지침에 없음', '화면 단추 이름 「지우기」 · K-19 「지운 조직은 되살아나지 않는다」(사용자 결정)', !listed && !reqText(rec).includes('시험조직T2'), { dirRowAfterDel: !!c1?.조직?.['시험조직T2'], record: !!c1?.세계?.org?.['시험조직T2'], listed, head: head.slice(0, 80), inReq: reqText(rec).includes('시험조직T2') }, p);
  // 치우기: 머리 「삭제」
  await openEd('org');
  await selRec('시험조직T2');
  await act('ed-delete');
  await act('ed-delete-yes', undefined, 1500);
  await closeEd();
}

// ═══ D. 답 오는 중 세계 편집 (늦은 답이 바꾼 값을 덮는지) ═══
if (want('D')) {
  const s0 = await t.fakeSeq();
  await t.send('늦은답 을 기다린다.', { wait: false });
  await t.waitBusy(15000).catch(() => {});
  await sleep(1500);
  const pend = await t.fake('pending');
  await openEd('agent');
  await selRec('게슈간');
  const k = '.gw [data-input="ed-field"][data-key="agent|게슈간|intro"]';
  const v0 = await val(k);
  await typeIn(k, `${v0} 시험중편집`);
  const c1 = await waitCard((c) => String(c?.세계?.agent?.['게슈간']?.fields?.intro ?? '').includes('시험중편집'));
  await closeEd();
  await t.fake('release', {});
  await t.waitIdle(60000).catch(() => {});
  await sleep(1500);
  const c2 = await card();
  const s1 = await t.fakeSeq();
  await t.send('보고서를 정리한다.');
  const rec = await lastMain(s1);
  const line = reqText(rec).split('\n').find((l) => l.startsWith('- Geshugan ')) ?? '';
  check('T2-D1', '본편 답을 기다리는 중 요원 소개를 고침 → 바로 카드 저장, 늦게 온 답 처리 뒤에도 그대로, 다음 요청 Roster 에', '저장·유지·요청에 시험중편집', 'K-01 · 코스 K13 (늦게 온 답이 바꾼 값을 덮는지만)', String(c1?.세계?.agent?.['게슈간']?.fields?.intro ?? '').includes('시험중편집') && String(c2?.세계?.agent?.['게슈간']?.fields?.intro ?? '').includes('시험중편집') && line.includes('시험중편집'), { pending: pend?.length ?? pend, saved: !!c1, kept: String(c2?.세계?.agent?.['게슈간']?.fields?.intro ?? '').includes('시험중편집'), line: scrub(line) });
}

// ═══ E. 다른 채팅 다녀오기 · 새 채팅 시작 패널 반영 ═══
if (want('E')) {
  await openEd('start');
  await act('dir-start-open', 'A00', 600);
  await typeIn('.gw [data-input="dir"][data-key="org:title|관리국"]', '시험관리국T2');
  await waitCard((c) => c?.조직?.['관리국']?.title === '시험관리국T2');
  await closeEd();
  const before = await t.chatState();
  await t.newChat();
  await sleep(1000);
  await t.openWindow('.gx-fac');
  await sleep(600);
  const facs = await fe(() => [...document.querySelectorAll('.gx .gx-fac')].map((e) => `${e.dataset.value}:${e.innerText.replace(/\s+/g, ' ').slice(0, 16)}`));
  await shot('T2-E1_새채팅시작패널');
  check('T2-E1', '새 채팅 시작 패널에 시작 화면 이름 「시험관리국T2」', 'A00 칸 이름', '코스 K4 「시작 패널 반영」', facs.some((f) => f.startsWith('A00') && f.includes('시험관리국T2')), facs);
  await t.closeWindow();
  await t.switchChat(1);
  await sleep(1000);
  const s0 = await t.fakeSeq();
  await t.send('사무실로 돌아온다.');
  const rec = await lastMain(s0);
  const after = await t.chatState();
  check('T2-E2', '새 채팅을 다녀와(번호 0→1 밀림) 원래 채팅에서 보내도 고친 세계 값(스팡달 소개)이 그대로 감', '요청에 시험소개T2, 같은 채팅 id', '코스 5장 「다른 채팅 다녀오기」', reqText(rec).includes('시험소개T2') && after.chatId === before.chatId, { before: before.chatId, after: after.chatId, has: reqText(rec).includes('시험소개T2') });
}

// ═══ F. 새로고침: 저장 끝난 뒤 / 친 직후 바로 ═══
if (want('F')) {
  await openEd('agent');
  await selRec('로제몬');
  await typeIn('.gw [data-input="dir"][data-key="department|로제몬"]', (await val('.gw [data-key="department|로제몬"]')) ?? '');
  await typeIn('.gw [data-input="dir"][data-key="rank|로제몬"]', '시험직급R1');
  await sleep(2000);
  await t.reload({ settle: true });
  const c1 = await card();
  check('T2-F1', '직급을 치고 2초 뒤(플러그인·리스아이 저장 끝) 새로고침 → 카드에 남음', 'rank=시험직급R1', '코스 5장 「새로고침(저장 끝난 뒤)」', c1?.요원?.['로제몬']?.rank === '시험직급R1', c1?.요원?.['로제몬']?.rank);
  await openEd('agent');
  await selRec('로제몬');
  await typeIn('.gw [data-input="dir"][data-key="rank|로제몬"]', '시험직급R2');
  await t.reload({ settle: false });
  const c2 = await card();
  check('T2-F2', '직급을 치자마자(0.7초 모음 전) 새로고침 → 그 글자', '참고: 진행 중 작업은 메모리라 사라짐(코스 5장)', '코스 5장', null, c2?.요원?.['로제몬']?.rank);
  await openEd('agent');
  await selRec('로제몬');
  await typeIn('.gw [data-input="dir"][data-key="rank|로제몬"]', '시험직급R3');
  await sleep(1000);
  await t.reload({ settle: false });
  const c3 = await card();
  check('T2-F3', '직급을 치고 1초 뒤(플러그인 저장은 끝, 리스아이 0.5초 모음 직후) 바로 새로고침', '참고', '코스 2-2 「리스AI 는 저장을 0.5초 모아서」', null, c3?.요원?.['로제몬']?.rank);
}

// ═══ G. 화면: 세계 편집기 페이지 캡처 ═══
if (want('G')) {
  await openEd('agent');
  await selRec('쟈알디');
  await shot('T2-G1_요원');
  for (const n of ['org', 'relations', 'base', 'start']) {
    await fe((x) => document.querySelector(`.gw [data-action="ed-node"][data-value="${x}"]`)?.click(), n);
    await sleep(700);
    if (n === 'start') await act('dir-start-open', 'A00', 600);
    if (n === 'base') await act('dir-open', '관리국 본부', 900);
    await shot(`T2-G_${n}`);
  }
  const ov = await fe(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, over: [...document.querySelectorAll('.gw *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > window.innerWidth + 1); }).slice(0, 5).map((e) => e.className) }));
  check('T2-G2', '세계 편집기 가로 넘침', '넘침 없음', '—', ov.sw <= ov.w + 1 && !ov.over.length, ov);
  await closeEd();
}

// ═══ H. 점검 「초기화」가 명부 칸까지 되돌리는지 (T1 K03-03 재현) ═══
if (want('H')) {
  await openEd('agent');
  await selRec('스팡달');
  const k = '.gw [data-input="ed-field"][data-key="agent|스팡달|intro"]';
  const v0 = await val(k);
  await typeIn(k, `${v0} 시험소개H`);
  await typeIn('.gw [data-input="dir"][data-key="rank|스팡달"]', '시험직급H');
  const c0 = await waitCard((c) => c?.요원?.['스팡달']?.rank === '시험직급H' && String(c?.세계?.agent?.['스팡달']?.fields?.intro ?? '').includes('시험소개H'));
  await fe(() => document.querySelector('.gw [data-action="ed-tab"][data-value="manage"]')?.click()); await sleep(400);
  await fe(() => document.querySelector('.gw [data-action="ed-node"][data-value="manage:backup"]')?.click()); await sleep(700);
  await act('set-bar', 'reset', 600);
  await act('set-bar-yes', 'reset', 600);
  const c1 = await waitCard((c) => !String(c?.세계?.agent?.['스팡달']?.fields?.intro ?? '').includes('시험소개H'), 8000);
  await sleep(1500);
  const c2 = await card();
  await shot('T2-H1_초기화뒤');
  await closeEd();
  const s0 = await t.fakeSeq();
  await t.send('스팡달에게 인사한다.');
  const rec = await lastMain(s0);
  const line = reqText(rec).split('\n').find((l) => l.startsWith('- Spangdal ')) ?? '';
  const p = dumpReq(`T2-H2_본편요청-${SIZE}.txt`, rec);
  check('T2-H1', '실제 리스아이: 점검 「초기화」 → 고친 세계 덧쓰기(소개)는 비워지고, 명부 칸(직급)은?', '도움말 「고친 세계(카드 명부)를 플러그인 원래 값으로」 → 직급도 원래 값', '11-08 사용자 「초기화는 전체 초기화」(src/ui/editor/index.ts:959) · 도움말 src/ui/editor/manage.ts:187', !String(c2?.세계?.agent?.['스팡달']?.fields?.intro ?? '').includes('시험소개H') && c2?.요원?.['스팡달']?.rank !== '시험직급H', { before: { rank: c0?.요원?.['스팡달']?.rank }, after: { rank: c2?.요원?.['스팡달']?.rank, intro: String(c2?.세계?.agent?.['스팡달']?.fields?.intro ?? '').includes('시험소개H') }, reqLineHasRank: line.includes('시험직급H') }, p);
}

const errs = t.errors.filter((e) => !/displayData/.test(e));
check('T2-Z', '리스아이·플러그인 콘솔 오류(displayData 알려진 것 뺌)', '참고', 'T2_사용법 리스AI 동작 3', null, errs.slice(0, 10));
writeFileSync(`${OUT}결과_T2-${ONLY ? ONLY + "-" : ""}${SIZE}.json`, JSON.stringify(results, null, 2));
const n = results.filter((r) => r.ok !== 'info');
console.log(`\n== T2 ${SIZE} ${n.filter((r) => r.ok).length}/${n.length} 통과 (참고 ${results.length - n.length})`);
await t.close();
