// K6 생성 공통: 형식 오류 재시도·재시도 모델·다시 묻기 글 / 다시 보기 / 모델 오류 재시도·간격 / 동시 요청(묶음 호출과 겹칠 때) / 모델 응답 대기(조각 0개)
//   / 생각 단계(안 씀·속으로만·적고 지움 <lb-process>) / 비망록 / 생성 언어 / 유저 메시지 포함·빼기 / 기능별 전용 모델(없앤 기능)
// 대표 기능: 괴담넷 새로고침(매 턴, 한 번에 요청 끔). 받다 끊김·요청당 사진은 t1.mjs.
import { session, sleep, flat } from './lib.mjs';

const GN = 'Board refresh preserves';
const REFRESH = JSON.stringify({ posts: [
  { author: '야근요정', id: 1846003, tag: '현장', title: '중림 지하상가 B구역 또 셔터 내림', date: '2025.03.14 22:40', views: 1820, upvotes: 64, content: '오늘 B구역 셔터 또 내려감.', mine: false, comments: [{ author: '단가충', content: '그쪽 회사 차 두 대 봄', parent: 0, mine: false, time: '22:51' }] },
  { author: '회수반막내', id: 1846002, tag: '거래', title: '회수물 시세 질문', date: '2025.03.14 21:10', views: 940, upvotes: 21, content: '손거울류 요즘 얼마 쳐줌?', mine: false, comments: [] },
], incoming: [], keyFigures: [] });
const isGn = (r) => r.route === 'aux' && flat(r).includes(GN);

export async function k6() {
  const S = await session('K6');
  const { t, step } = S;
  const flowDo = async (v) => S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900);
  const adv = async (v) => { await S.ed('set:adv'); await S.click(`.gw [data-action="adv-set"][data-value="${v}"]`, 900); };
  /** 생성 공통 수 칸 직접 입력 */
  const advIn = async (key, n) => { await S.ed('set:adv'); await S.setVal(`.gw input[data-action="adv-set"][data-key="gen:${key}"], .gw input[data-change="adv-set"][data-key="gen:${key}"]`, String(n), 'change', 900); };
  const gnRule = (o) => S.addRules([{ id: 'k6-gn', route: 'aux', match: GN, ...o }]);
  const gnTurn = async (text, settle = 6000) => { const tr = await S.turn(text, { settle }); return { ...tr, gn: tr.aux.filter(isGn) }; };
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');
    await S.ed('manage:flow');
    await flowDo('fam-set|b:gn:lazy=0');
    if (await S.fe(() => !!document.querySelector('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]'))) await flowDo('fam-set|b:gn:joint=0');
    await gnRule({ reply: REFRESH });

    let st = step('기준: 괴담넷 매 턴 → 본편 뒤 괴담넷 보조 요청 1회, 생각 단계·비망록 없음, 다시 보기 없음', '괴담넷 요청 1건, 「# Thoughts」 없음', 'advanced.ts 기본값 (생각 off·비망록 끔·다시 보기 0)');
    let tr = await gnTurn('휴대폰으로 괴담넷을 본다.');
    st.req('기준_괴담넷', tr.gn[0]);
    const f0 = tr.gn[0] ? flat(tr.gn[0]) : '';
    st.check(tr.gn.length === 1 && !/# Thoughts/.test(f0), { gn: tr.gn.length, thoughts: /# Thoughts/.test(f0), userText: f0.includes('휴대폰으로 괴담넷을 본다') });

    st = step('유저 메시지 「빼기」 → 괴담넷 요청의 최근 대화에 내가 쓴 말 없음 (포함일 땐 있음)', '포함: 내 말 있음 / 빼기: 없음', 'advanced.ts user_msgs 안내 (사용자 2026-11-06 「전부 넣어야지」로 옮긴 항목)');
    await adv('gen:user_msgs=0');
    tr = await gnTurn('K6-USER-SECRET 을 메모한다.');
    st.req('유저메시지빼기_괴담넷', tr.gn[0]);
    st.check(f0.includes('휴대폰으로 괴담넷을 본다') && tr.gn[0] && !flat(tr.gn[0]).includes('K6-USER-SECRET'), { includedBefore: f0.includes('휴대폰으로 괴담넷을 본다'), excludedNow: tr.gn[0] ? !flat(tr.gn[0]).includes('K6-USER-SECRET') : null });
    await adv('gen:user_msgs=1');

    st = step('생성 언어 영어 → 괴담넷 요청에 「Write all output in English.」', '요청에 LANGUAGE.EN 글', '지침 요청공통 LANGUAGE.* / advanced.ts lang');
    await adv('gen:lang=en');
    tr = await gnTurn('밖을 본다.');
    const fl = tr.gn[0] ? flat(tr.gn[0]) : '';
    st.check(/Write all output in English\./.test(fl), { en: /Write all output in English\./.test(fl), ko: /Write all output in Korean\./.test(fl) });
    await adv('gen:lang=auto');

    st = step('생각 단계 「속으로만」(괴담넷) → 요청 system 에 「# Thoughts Guideline」 순서표', '「# Thoughts Guideline」 있음, 「# Thoughts\\n」(적고 지움) 없음', 'craft.ts craftMessages (사용자 2026-11-06 라이트보드에서 옮김)');
    await S.ed('set:net'); // 괴담넷 페이지(인터넷 묶음)
    const gnThought = await S.fe(() => [...document.querySelectorAll('.gw [data-action="adv-set"]')].map((e) => e.dataset.value).filter((v) => /thoughts|memo|reiterate/.test(v)));
    S.note('괴담넷 생성 방식 단추', gnThought);
    await S.click('.gw [data-action="adv-set"][data-value="gn:thoughts=inner"]', 900);
    tr = await gnTurn('잠깐 생각한다.');
    const fi = tr.gn[0] ? flat(tr.gn[0]) : '';
    st.check(/# Thoughts Guideline/.test(fi), { inner: /# Thoughts Guideline/.test(fi) });

    st = step('생각 단계 「적고 지움」 → 요청에 「# Thoughts」, 답 맨 앞 <lb-process>…</lb-process> 를 떼고 글 목록을 저장', '요청에 # Thoughts·<lb-process> 안내, 답의 게시판 글이 상태에 들어감(생각 글은 안 들어감)', 'craft.ts·llm.ts stripThoughts');
    await S.click('.gw [data-action="adv-set"][data-value="gn:thoughts=note"]', 900).catch(async () => { await S.ed('set:net'); await S.click('.gw [data-action="adv-set"][data-value="gn:thoughts=note"]', 900); });
    await S.delRule('k6-gn');
    await gnRule({ reply: `<lb-process>K6-THINK 생각 글: 셔터 이야기를 이어간다.</lb-process>\n${REFRESH.replace('중림 지하상가 B구역 또 셔터 내림', 'K6-NOTE-POST 셔터 내림')}` });
    tr = await gnTurn('메모를 정리한다.');
    const fn = tr.gn[0] ? flat(tr.gn[0]) : '';
    const ss = await S.ss();
    const gnState = Object.entries(ss).filter(([k]) => /^\$gn_|^\$lb_/.test(k)).map(([k, v]) => k + '=' + String(v).length).slice(0, 10);
    const stateStr = JSON.stringify(ss);
    st.req('적고지움_괴담넷', tr.gn[0]);
    st.check(/# Thoughts\n/.test(fn) && stateStr.includes('K6-NOTE-POST') && !stateStr.includes('K6-THINK'), { noteBlock: /# Thoughts\n/.test(fn), postSaved: stateStr.includes('K6-NOTE-POST'), thinkLeaked: stateStr.includes('K6-THINK'), gnState });
    await S.ed('set:net');
    await S.click('.gw [data-action="adv-set"][data-value="gn:thoughts=off"]', 700);
    await S.delRule('k6-gn'); await gnRule({ reply: REFRESH });

    st = step('비망록 켬(괴담넷) → system 맨 앞에 MEMO 인물 글·「# Job Note」, 끝에 미리 채운 assistant(+user)', 'system 첫머리 바뀜, 「# Job Note」 있음, 마지막 메시지가 assistant 또는 그 뒤 user', 'craft.ts craftMessages memo');
    await S.ed('set:net');
    const memoOn = gnThought.find((v) => /memo=1/.test(v)) ?? 'gn:memo=1';
    await S.click(`.gw [data-action="adv-set"][data-value="${memoOn}"]`, 900);
    tr = await gnTurn('숨을 고른다.');
    const msgs = tr.gn[0]?.body?.messages ?? [];
    st.req('비망록_괴담넷', tr.gn[0]);
    st.check(/# Job Note/.test(flat(tr.gn[0] ?? {})) && ['assistant', 'user'].includes(msgs.at(-1)?.role) && msgs.some((m) => m.role === 'assistant'), { jobNote: /# Job Note/.test(flat(tr.gn[0] ?? {})), tailRoles: msgs.slice(-2).map((m) => m.role), n: msgs.length });
    await S.ed('set:net');
    await S.click(`.gw [data-action="adv-set"][data-value="${memoOn.replace('=1', '=0')}"]`, 700);

    st = step('다시 보기 1회(생성 공통) → 첫 답 뒤 같은 요청 + 「Reiteration phase (1/1)」 한 번 더', '괴담넷 호출 2회, 둘째 마지막 user 에 Reiteration phase (1/1)', 'llm.ts generate reiterate / advanced.ts (사용자 2026-11-06)');
    await adv('gen:reiterate=1');
    tr = await gnTurn('다시 확인한다.');
    st.req('다시보기_둘째', tr.gn[1]);
    st.check(tr.gn.length === 2 && /Reiteration phase \(1\/1\)/.test(tr.gn[1]?.lastUser ?? flat(tr.gn[1] ?? {})), { gn: tr.gn.length, lastUser: String(tr.gn[1]?.lastUser ?? '').slice(0, 80) });
    await adv('gen:reiterate=0');

    st = step('형식 오류 재시도 2·재시도 모델 「메인」 → 꼴 틀린 답이면 3번 부름(처음 보조, 다시 묻기 2번은 메인), 다시 묻기 글에 앞 답·오류·<lb-process> 분석 지시', '괴담넷 보조 1 + 메인 2, 다시 묻기 요청에 앞 답과 RETRY 글', 'llm.ts generate / advanced.ts retries·retry_model / 2차 16 「상점: 재시도 3·보조면 4회, 첫 번째만 메인」');
    await adv('gen:retries=2');
    await S.click('.gw [data-action="adv-set"][data-value="gen:retry_model=main"]', 900);
    await S.delRule('k6-gn');
    await S.addRules([{ id: 'k6-gn-bad', route: 'any', match: GN, reply: '게시판입니다 {"posts": [ 망가짐' }]);
    const s0 = await S.seq();
    await S.turn('글을 새로 고친다.', { settle: 9000 });
    const l = await S.log(s0);
    const gnAll = l.filter((r) => flat(r).includes(GN));
    const retry = gnAll[1];
    st.req('재시도_둘째', retry);
    const rf = retry ? JSON.stringify(retry.body.messages.slice(-2)) : '';
    st.check(gnAll.length === 3 && gnAll[0].route === 'aux' && gnAll.slice(1).every((r) => r.route === 'main') && /망가짐/.test(rf) && /lb-process/.test(rf), { routes: gnAll.map((r) => r.route), retryHasRaw: /망가짐/.test(rf), retryHasAnalyze: /lb-process/.test(rf), retryTail: rf.slice(0, 400) });
    await S.delRule('k6-gn-bad');
    await adv('gen:retry_model=same');

    st = step('모델 오류 재시도 2(기본)·재시도 간격 3초 → 503 이 두 번 오면 같은 요청을 다시 보내 셋째에 성공, 사이 간격 ≥3초', '괴담넷 요청 3건(같은 hash), 간격 ≥ 3000ms', 'llm.ts TRANSIENT·timeMs(retryGap) / timing.ts (전수점검 보통-5·사소-9: 박힌 시간을 설정으로)');
    await S.ed('set:screen');
    const gapSel = await S.fe(() => { const e = [...document.querySelectorAll('.gw input')].find((x) => x.dataset.key === 'retryGap' || /retryGap/.test(x.dataset.key ?? '')); return e ? `.gw input[data-key="${e.dataset.key}"]` : null; });
    S.note('재시도 간격 칸', gapSel);
    if (gapSel) await S.setVal(gapSel, '3000', 'change', 900);
    const pr = await S.prefs();
    await S.addRules([{ id: 'k6-gn-503', route: 'aux', match: GN, status: 503, failFirst: 2, reply: REFRESH }]);
    const s1 = await S.seq();
    await S.turn('다시 새로 고친다.', { settle: 12000 });
    const l1 = (await S.log(s1)).filter(isGn);
    const gaps = l1.slice(1).map((r, i) => Date.parse(r.t) - Date.parse(l1[i].t) - (l1[i].response?.ms ?? 0));
    st.check(l1.length === 3 && l1.every((r) => r.hash === l1[0].hash) && gaps.every((g) => g >= 2900), { n: l1.length, statuses: l1.map((r) => r.response?.status), sameHash: l1.every((r) => r.hash === l1[0].hash), gaps, times: pr?.times });
    await S.delRule('k6-gn-503');

    st = step('모델 오류 재시도 0 → 503 한 번에 끝(다시 안 보냄)', '괴담넷 요청 1건', 'advanced.ts transient zero 「안 함」');
    await advIn('transient', 0).catch(async () => { await adv('gen:transient=1'); await adv('gen:transient=0'); });
    await S.addRules([{ id: 'k6-gn-503b', route: 'aux', match: GN, status: 503, reply: 'x' }]);
    const s2 = await S.seq();
    await S.turn('또 새로 고친다.', { settle: 9000 });
    const l2 = (await S.log(s2)).filter(isGn);
    st.check(l2.length === 1, { n: l2.length, transient: (await S.ss()).$gen_transient });
    await S.delRule('k6-gn-503b');
    await adv('gen:transient=1'); await adv('gen:transient=2');

    st = step('동시 요청 1 + 「한 번에 요청」 켬 + 위키 매 턴 → 묶음 요청과 위키 요청이 겹치지 않고(앞이 끝난 뒤 시작) 둘 다 끝남(멈춤 없음)', '묶음 요청·위키 요청 시간 구간이 안 겹침, 둘 다 응답 받음', 'llm.ts limited 주석 (11-09 점검: 칸이 1이면 둘 다 멈췄다 → 통합은 칸 밖)');
    await adv('gen:concurrent=1');
    await S.ed('manage:flow');
    await flowDo('fam-set|b:gn:joint=1');
    await flowDo('ph-cfg|auto=1');
    await flowDo('wiki-auto|turn');
    await S.addRules([{ id: 'k6-slow', route: 'aux', match: 'Board refresh preserves|NW\\.|wiki', delayMs: 4000, reply: '{}' }]);
    const s3 = await S.seq();
    await S.turn('천천히 둘러본다.', { settle: 20000 });
    const l3 = (await S.log(s3)).filter((r) => r.route === 'aux' && r.ruleId === 'k6-slow');
    const span = l3.map((r) => ({ seq: r.seq, start: Date.parse(r.t), end: Date.parse(r.t) + (r.response?.ms ?? 0), sys: String(r.body?.messages?.[0]?.content ?? '').slice(0, 50) }));
    const overlap = span.some((a, i) => span.some((b, j) => i < j && a.start < b.end && b.start < a.end));
    st.check(l3.length >= 2 && !overlap && l3.every((r) => r.response?.status === 200), { n: l3.length, overlap, span });
    await S.delRule('k6-slow');
    await adv('gen:concurrent=0');

    st = step('모델 응답 대기 1분 + 괴담넷 요청이 조각 0개로 멈춤 → 1분 뒤 실패로 보고 같은 요청을 다시 보내지 않음', '1분 뒤 괴담넷 실패(진행 창/호출 기록), 같은 hash 요청 1건만', 'llm.ts idleLimit markTransientDone 「조각을 하나도 받지 못하고 끊긴 것은 다시 보내지 않는다」 / setdef 모델 응답 대기 안내');
    await S.ed('manage:flow');
    await flowDo('fam-set|b:gn:joint=0');
    await flowDo('ph-cfg|auto=0');
    await flowDo('wiki-auto|0');
    await S.ed('set:screen');
    const idleSel = await S.fe(() => { const e = [...document.querySelectorAll('.gw input')].find((x) => /modelIdle/.test(x.dataset.key ?? '')); return e ? `.gw input[data-key="${e.dataset.key}"]` : null; });
    if (idleSel) await S.setVal(idleSel, '1', 'change', 900);
    await S.addRules([{ id: 'k6-hold', route: 'aux', match: GN, hold: true, reply: REFRESH }]);
    const s4 = await S.seq();
    await S.turn('기다린다.', { settle: 1000 });
    await sleep(75000);
    const l4 = (await S.log(s4)).filter(isGn);
    const prog = await t.progText();
    await t.fake('release', {});
    await sleep(1500);
    st.check(l4.length === 1, { n: l4.length, prog, pending: (await t.fake('pending')).length ?? null, idleSel });
    await S.delRule('k6-hold');

    st = step('기능별 전용 모델: 없앤 기능(2026-11-12 사용자) → 설정 어디에도 칸이 없고 요청은 메인/보조 설정대로', '설정 창 전체에 「전용 모델」 칸 없음', 'craft.ts featureModel 「없앤 기능 (2026-11-12 사용자)」');
    const pages = ['set:adv', 'set:net', 'set:phone', 'set:wiki', 'set:shop'];
    const found = [];
    for (const pg of pages) { await S.ed(pg).catch(() => {}); if (await S.fe(() => /전용 모델|staticModel|모델 ID/.test(document.querySelector('.gw')?.innerText ?? ''))) found.push(pg); }
    st.check(found.length === 0, { found });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K6_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 40));
    await S.close();
  }
}
