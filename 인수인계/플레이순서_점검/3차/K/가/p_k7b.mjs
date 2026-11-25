// K7 덧(다시 돌림): ① 요청 토큰 상한에 걸린 자동 새로고침이 어디에 알려지나 ② 우주 쇼핑몰 매 턴 2건이 형식 재시도인가 ③ 망상홈쇼핑 줄 조작 값
import { session, sleep, flat } from './lib.mjs';

const GN = 'Board refresh preserves';
const COS = 'cosmic-mall.alien';

export async function k7b() {
  const S = await session('K7b');
  const { t, step } = S;
  const flowDo = async (v) => { await S.ed('manage:flow'); await S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900); };
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    let st = step('요청 토큰 상한(생성 공통) 1500 + 괴담넷 매 턴 → 상한을 못 맞춰 안 보낸 일이 화면 어딘가(진행 창·괴담넷 창·실패 기록)에 알려짐', '「토큰 상한」 글이 진행 창·괴담넷 창·점검 → 실패 기록 중 한 곳 이상에', 'budget.ts BudgetError 글 「설정 → 생성 공통…에서 요청 토큰 상한을 올려 주세요」 / gnet.ts run·jobUi(detached)');
    await flowDo('fam-set|b:gn:lazy=0');
    if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await flowDo('fam-set|b:gn:joint=0');
    await S.ed('set:adv');
    await S.setVal('.gw input[data-change="adv-set"][data-key="gen:budget"]', '1500', 'change', 900);
    const tr = await S.turn('게시판을 본다.', { settle: 6000 });
    const gnN = tr.all.filter((r) => flat(r).includes(GN)).length;
    const prog = String(await t.progText().catch(() => '') ?? '');
    await S.ed('manage:log');
    const logPage = await S.fe(() => document.querySelector('.gw .gw-page')?.innerText.replace(/\s+/g, ' ').slice(0, 400) ?? '');
    await st.shot('실패기록');
    await S.winClose(); await S.winOpen();
    await S.tryClick('.gx-nav .gx-nb:not(.mob)[data-value="net"]', 800);
    await S.tryClick('.br-bm[data-value="gn"]', 1200);
    const gnWin = await S.fe(() => document.querySelector('.gn')?.innerText.replace(/\s+/g, ' ').slice(0, 300) ?? null);
    await st.shot('괴담넷창');
    const seen = [prog, logPage, gnWin ?? ''].some((x) => /토큰 상한/.test(x));
    st.check(gnN === 0 && seen, { gnCalls: gnN, prog: prog.slice(0, 160), logPage: logPage.slice(0, 200), gnWin: gnWin?.slice(0, 200), consoleHits: t.errors.filter((e) => /상한/.test(e)).slice(-2) });
    await S.winClose();
    await S.ed('set:adv');
    await S.setVal('.gw input[data-change="adv-set"][data-key="gen:budget"]', '0', 'change', 900);
    await flowDo('fam-set|b:gn:lazy=1');

    st = step('우주 쇼핑몰 매 턴: 진열 요청 2건이면 둘째가 형식 오류 다시 묻기(가짜 답 「{}」 탓)인가', '둘째 요청 끝 user 에 「previous reply was rejected」(다시 묻기) → 흐름 예상 1회와 어긋남 아님', 'K7-12 / llm.ts 형식 오류 재시도 1(기본)');
    await flowDo('fam-set|s:cos:auto=turn');
    const t2 = await S.turn('잠깐 쉰다.', { settle: 6000 });
    const cos = t2.all.filter((r) => flat(r).includes(COS));
    const tails = cos.map((r) => String(r.body?.messages?.at(-1)?.content ?? '').slice(0, 90));
    st.check(cos.length <= 1 || /rejected|Validation error/i.test(tails[1] ?? ''), { n: cos.length, tails });
    await flowDo('fam-set|s:cos:auto=manual');

    st = step('흐름 페이지 망상홈쇼핑 줄의 조작 값 확인 → 켬 후 「창을 열 때」면 본편 턴에 홈쇼핑 요청 없음', '본편 턴에 홈쇼핑 요청 0건', 'flowpage.ts 망상홈쇼핑 줄');
    await S.ed('manage:flow');
    const hsActs = await S.fe(() => [...document.querySelectorAll('.gw [data-action="fl-do"]')].map((e) => e.dataset.value).filter((v) => /hs/.test(v)));
    S.note('흐름 페이지 홈쇼핑 단추', hsActs);
    const on = hsActs.find((v) => /s:hs:on=1/.test(v));
    if (on) await flowDo(on);
    const open = hsActs.find((v) => /s:hs:auto=open/.test(v)) ?? 'fam-set|s:hs:auto=open';
    await S.tryClick(`.gw [data-action="fl-do"][data-value="${open}"]`, 900);
    const t3 = await S.turn('텔레비전을 켠다.', { settle: 5000 });
    const hsN = t3.all.filter((r) => /live feed of 망상홈쇼핑/.test(flat(r))).length;
    st.check(hsN === 0, { hsActs, hsCalls: hsN });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K7b_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 20));
    await S.close();
  }
}
