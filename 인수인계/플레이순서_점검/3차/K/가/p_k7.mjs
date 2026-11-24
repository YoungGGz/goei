// K7 기능마다 메인/보조 모델·자동 호출·컨텍스트 포함·토큰 상한 → 요청 글에 실제로 들어가나 (괴담넷·괴담톡·위키·우주 쇼핑몰·망상홈쇼핑)
//   조작은 호출 흐름 페이지(fl-do)와 기능 페이지(set:net 등) 두 길. 값이 같은 칸인지는 K8 이 본다.
import { session, sleep, flat } from './lib.mjs';

const GN = 'Board refresh preserves';
const PH = 'Append NPC communication';
const NW = /NW\.AUTO_TITLE|Pick one wiki article title|in-universe encyclopedia/;
const COS = 'cosmic-mall.alien';
const HS = 'live feed of 망상홈쇼핑';
const REFRESH = JSON.stringify({ posts: [
  { author: '야근요정', id: 1846003, tag: '현장', title: 'K7-POST 중림 지하상가 셔터', date: '2025.03.14 22:40', views: 1820, upvotes: 64, content: '오늘 B구역 셔터 또 내려감. K7-BODY', mine: false, comments: [{ author: '단가충', content: '그쪽 회사 차 두 대 봄', parent: 0, mine: false, time: '22:51' }] },
], incoming: [], keyFigures: [] });
const is = (m) => (r) => (m instanceof RegExp ? m.test(flat(r)) : flat(r).includes(m));
const tokApprox = (r) => Math.round(JSON.stringify(r?.body?.messages ?? '').length / 3);

export async function k7() {
  const S = await session('K7');
  const { t, step } = S;
  const flowDo = async (v) => { await S.ed('manage:flow'); await S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900); };
  const flowRow = async (name) => { await S.ed('manage:flow'); return S.fe((n) => { const r = [...document.querySelectorAll('.gw .fl-row, .gw .flc')].find((e) => e.querySelector('.fl-name')?.textContent.trim() === n); return r ? { said: r.querySelector('.fl-said, .flc-nm small, .flc-nm')?.textContent.replace(/\s+/g, ' ').trim() ?? null, st: [...r.querySelectorAll('.fl-st')].map((x) => x.textContent.trim()) } : null; }, name); };
  const mainCtx = (r) => { const s = flat(r); const i = s.indexOf('"feature":"gnet"'); return i < 0 ? '' : s.slice(Math.max(0, s.lastIndexOf('[MODULE_CONTEXT_BEGIN]', i)), s.indexOf('[MODULE_CONTEXT_END]', i) + 20); };
  try {
    await S.fakeReset([{ id: 'k7-gn', route: 'any', match: GN, reply: REFRESH }, { id: 'k7-nwt', route: 'any', match: 'Pick one wiki article title', reply: '{"title":"관리국"}' }]);
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    // ── 괴담넷 ──
    let st = step('괴담넷 자동 호출 「매 턴」·모델 「보조」(한 번에 요청 끔) → 본편 뒤 보조 길로 새로고침 1건', '보조(aux) 괴담넷 요청 1건, 메인 길 괴담넷 0건', 'L 기능별 모델 / flowpage.ts 격자 (fam-set b:gn:lazy=0·mode=2)');
    await flowDo('fam-set|b:gn:lazy=0');
    if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await flowDo('fam-set|b:gn:joint=0');
    await flowDo('fam-set|b:gn:mode=2');
    let tr = await S.turn('휴대폰으로 괴담넷을 연다.', { settle: 6000 });
    let gnA = tr.all.filter(is(GN));
    st.req('괴담넷_보조', gnA[0]);
    st.check(gnA.length === 1 && gnA[0].route === 'aux', { routes: gnA.map((r) => r.route), tok: gnA.map(tokApprox) });

    st = step('괴담넷 컨텍스트 포함(기본 켬) → 받은 글이 다음 본편 요청에 「feature":"gnet"」 덩어리로', '다음 본편에 K7-POST 글 덩어리', 'body.ts moduleContext / famtable 「메인 요청 · 컨텍스트 포함」');
    await flowDo('fam-set|b:gn:lazy=1');
    tr = await S.turn('주변을 살핀다.');
    const ctx1 = mainCtx(tr.main[0]);
    st.req('본편_괴담넷덩어리', tr.main[0]);
    st.check(/K7-POST/.test(ctx1), { hasBlock: !!ctx1, post: /K7-POST/.test(ctx1), len: ctx1.length, gnCalls: tr.all.filter(is(GN)).length });

    st = step('괴담넷 자동 호출 「수동」 → 본편 뒤 괴담넷 요청 없음 (위 턴)', '괴담넷 요청 0건', 'flowpage.ts auto3 수동');
    st.check(tr.all.filter(is(GN)).length === 0, { gnCalls: tr.all.filter(is(GN)).length });

    st = step('괴담넷 컨텍스트 토큰 상한을 작게(100) → 본편 덩어리가 상한 안으로 줄거나 빠짐', '덩어리 길이 줄거나 없음 (글 1개라 통째 빠질 수 있음)', 'advanced.ts gn ctx_tokens / gnet.ts mainContext fits');
    await S.ed('set:net');
    const ctxSel = await S.fe(() => { const e = document.querySelector('.gw input[data-key="gn:ctx_tokens"]'); return e ? '.gw input[data-key="gn:ctx_tokens"]' : null; });
    S.note('컨텍스트 토큰 상한 칸', ctxSel);
    if (ctxSel) await S.setVal(ctxSel, '100', 'change', 900);
    tr = await S.turn('서류를 넘긴다.');
    const ctx2 = mainCtx(tr.main[0]);
    st.check(!!ctxSel && ctx2.length < ctx1.length, { before: ctx1.length, after: ctx2.length, saved: (await S.ss())['$gn_ctx_tokens'] ?? Object.entries(await S.ss()).filter(([k]) => /ctx_tokens/.test(k)) });
    if (ctxSel) { await S.ed('set:net'); await S.setVal(ctxSel, '3000', 'change', 900); }

    st = step('괴담넷 컨텍스트 포함 끔 → 본편 덩어리 없음', '본편에 feature gnet 없음', 'famtable 「메인 요청 · 컨텍스트 포함」 b:gn:context');
    await S.ed('set:net');
    const ctxAct = await S.fe(() => [...document.querySelectorAll('.gw [data-value^="b:gn:context="]')].map((e) => e.dataset.action + '|' + e.dataset.value));
    S.note('컨텍스트 포함 칸', ctxAct);
    await S.click('.gw [data-value^="b:gn:context="]', 900);
    tr = await S.turn('창밖을 본다.');
    st.req('본편_컨텍스트끔', tr.main[0]);
    st.check(!mainCtx(tr.main[0]), { block: !!mainCtx(tr.main[0]), saved: Object.entries(await S.ss()).filter(([k]) => /context/.test(k)) });
    await S.ed('set:net'); await S.click('.gw [data-value^="b:gn:context="]', 900);

    st = step('괴담넷 모델 「메인」 → 새로고침 요청이 메인 길로', '괴담넷 요청이 main 길, 보조 길 0', 'flowpage.ts model2 (fam-set b:gn:mode=1)');
    await flowDo('fam-set|b:gn:lazy=0');
    await flowDo('fam-set|b:gn:mode=1');
    tr = await S.turn('게시판을 새로 고친다.', { settle: 6000 });
    gnA = tr.all.filter(is(GN));
    st.req('괴담넷_메인', gnA[0]);
    st.check(gnA.length >= 1 && gnA.every((r) => r.route === 'main'), { routes: gnA.map((r) => r.route), mainAll: tr.main.length });
    await flowDo('fam-set|b:gn:mode=2');

    st = step('요청 토큰 상한(생성 공통) 1500 → 괴담넷 요청이 상한 안으로 줄거나(참조 덜기), 안 되면 보내지 않고 알림', '요청 길이 ≤ 약 1500토큰, 또는 요청 없음 + 「토큰 상한」 알림', 'advanced.ts budget / budget.ts 줄이는 순서·BudgetError');
    const fullTok = tokApprox(tr.all.filter(is(GN))[0]);
    await S.ed('set:adv');
    await S.setVal('.gw input[data-change="adv-set"][data-key="gen:budget"]', '1500', 'change', 900);
    tr = await S.turn('게시판을 한 번 더 본다.', { settle: 6000 });
    gnA = tr.all.filter(is(GN));
    const prog = await t.progText().catch(() => null);
    st.req('괴담넷_토큰상한', gnA[0]);
    st.check(gnA.length === 0 ? /토큰 상한/.test(String(prog) + t.errors.join(' ')) : tokApprox(gnA[0]) < fullTok, { n: gnA.length, before: fullTok, after: gnA.map(tokApprox), prog: String(prog ?? '').slice(0, 200), budget: (await S.ss()).$gen_budget, errs: t.errors.filter((e) => /상한|budget/i.test(e)).slice(-3) });
    await S.ed('set:adv');
    await S.setVal('.gw input[data-change="adv-set"][data-key="gen:budget"]', '0', 'change', 900);
    await flowDo('fam-set|b:gn:lazy=1');

    // ── 괴담톡 ──
    st = step('괴담톡 자동 호출 「매 턴」·모델 「보조」 → 본편 뒤 괴담톡 요청(보조), 흐름 페이지 「선톡·초대」 둘 다 꺼져 있으면 확인할 방 없는 턴엔 건너뜀', '괴담톡 요청 0~1건, 있으면 aux. 흐름 페이지 예상과 같음', 'flowpage.ts 괴담톡 줄·선톡·초대 안내');
    await flowDo('ph-cfg|auto=1');
    await flowDo('ph-cfg|model=aux');
    const phFlow = await flowRow('괴담톡');
    tr = await S.turn('휴대폰을 확인한다.', { settle: 6000 });
    let ph = tr.all.filter(is(PH));
    st.req('괴담톡_보조', ph[0]);
    st.check(ph.every((r) => r.route === 'aux'), { n: ph.length, routes: ph.map((r) => r.route), flow: phFlow });

    st = step('괴담톡 모델 「메인」 → 괴담톡 요청이 메인 길', '괴담톡 요청 main 길', 'ph-cfg model=main');
    await flowDo('ph-cfg|model=main');
    tr = await S.turn('메시지를 다시 확인한다.', { settle: 6000 });
    ph = tr.all.filter(is(PH));
    st.check(ph.length === 0 || ph.every((r) => r.route === 'main'), { n: ph.length, routes: ph.map((r) => r.route) });
    await flowDo('ph-cfg|model=aux');
    await flowDo('ph-cfg|auto=0');

    // ── 위키 ──
    st = step('위키 자동 호출 「매 턴」·모델 「보조」 → 본편 뒤 위키 제목 요청(보조)', '위키 요청 ≥1, 모두 aux', 'flowpage.ts 위키 줄 (wiki-auto turn, wiki-model aux)');
    await flowDo('wiki-auto|turn');
    await flowDo('wiki-model|aux');
    tr = await S.turn('위키를 떠올린다.', { settle: 8000 });
    let nw = tr.all.filter(is(NW));
    st.req('위키_보조', nw[0]);
    st.check(nw.length >= 1 && nw.every((r) => r.route === 'aux'), { n: nw.length, routes: nw.map((r) => r.route) });

    st = step('위키 모델 「메인」 → 위키 요청이 메인 길', '위키 요청 main 길', 'wiki-model main');
    await flowDo('wiki-model|main');
    tr = await S.turn('위키를 다시 떠올린다.', { settle: 8000 });
    nw = tr.all.filter(is(NW));
    st.req('위키_메인', nw[0]);
    st.check(nw.length >= 1 && nw.every((r) => r.route === 'main'), { n: nw.length, routes: nw.map((r) => r.route) });
    await flowDo('wiki-model|aux');
    await flowDo('wiki-auto|0');

    // ── 우주 쇼핑몰 ──
    st = step('우주 쇼핑몰 자동 호출 「매 턴」 → 흐름 페이지 예상(로그인 조건)과 실제 진열 요청 수가 같음', '흐름 페이지가 「로그아웃」이라 하면 0건, 「1회」면 1건(보조)', 'flow.ts 우주 쇼핑몰 진열 줄 「로그인했을 때 1회」');
    await flowDo('fam-set|s:cos:auto=turn');
    const cosFlow = await flowRow('우주 쇼핑몰');
    tr = await S.turn('잠깐 쉰다.', { settle: 6000 });
    const cos = tr.all.filter(is(COS));
    const expectCos = /로그아웃|호출 없음/.test(cosFlow?.said ?? '') ? 0 : 1;
    st.check(cos.length === expectCos, { flow: cosFlow, n: cos.length, routes: cos.map((r) => r.route) });
    await flowDo('fam-set|s:cos:auto=manual');

    // ── 망상홈쇼핑 ──
    st = step('망상홈쇼핑 켬·자동 호출 「창을 열 때」 → 턴마다는 부르지 않음 (흐름 페이지 「창을 열 때 1회」)', '본편 턴에 홈쇼핑 요청 0건', 'flowpage.ts 망상홈쇼핑 줄 (수동/창을 열 때만)');
    await flowDo('fam-set|s:hs:on=1');
    await flowDo('fam-set|s:hs:auto=open');
    const hsFlow = await flowRow('망상홈쇼핑');
    tr = await S.turn('텔레비전을 켠다.', { settle: 5000 });
    st.check(tr.all.filter(is(HS)).length === 0, { flow: hsFlow, n: tr.all.filter(is(HS)).length });
    await st.shot('흐름페이지_끝');
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K7_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 40));
    await S.close();
  }
}
