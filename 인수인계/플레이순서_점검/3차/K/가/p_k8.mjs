// K8 호출 흐름 화면: 미리 센 호출 수·순서·토큰 ↔ 가짜 서버 기록, 여기서 바꾼 값 = 기능 페이지 값, 2차 16 문제2(범위 밖 수 칸) 고쳐졌나
import { session, sleep, flat } from './lib.mjs';

const GN = 'Board refresh preserves';
const REFRESH = JSON.stringify({ posts: [{ author: '야근요정', id: 1846003, tag: '현장', title: 'K8 셔터', date: '2025.03.14 22:40', views: 10, upvotes: 1, content: '셔터.', mine: false, comments: [] }], incoming: [], keyFigures: [] });
const kindOf = (r) => { const f = flat(r); return r.route === 'main' && !f.includes(GN) ? '메인' : /# Router/.test(f) ? 'Router' : /# Scene Director/.test(f) ? 'Director' : /People Record Updater/.test(f) ? '갱신기' : f.includes(GN) ? '괴담넷' : /Insert <img> tags/.test(f) ? '이미지' : '기타:' + String(r.body?.messages?.[0]?.content ?? '').slice(0, 30); };

export async function k8() {
  const S = await session('K8');
  const { t, step } = S;
  const flow = async () => { await S.ed('manage:flow'); return S.fe(() => [...document.querySelectorAll('.gw .fl-row')].map((r) => ({ name: r.querySelector('.fl-name')?.textContent.trim(), on: r.classList.contains('on'), said: r.querySelector('.fl-said')?.textContent.replace(/\s+/g, ' ').trim() ?? '', est: r.querySelectorAll('.fl-st')[0]?.textContent.trim() ?? '', real: r.querySelectorAll('.fl-st')[1]?.textContent.trim() ?? '' }))); };
  const flowDo = async (v) => { await S.ed('manage:flow'); await S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900); };
  const num = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;
  try {
    await S.fakeReset([{ id: 'k8-gn', route: 'any', match: GN, reply: REFRESH }]);
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    let st = step('기본 흐름 + 괴담넷 매 턴(보조, 한 번에 요청 끔) → 한 턴 뒤 흐름 페이지 「켬」 줄의 호출 수 합 = 가짜 서버가 받은 수', '켬 줄(호출 있는 것) 수 = 가짜 서버 요청 수, 종류가 같음', 'flowpage.ts 「지난 턴」·flow.ts 미리 셈 / K8');
    await flowDo('fam-set|b:gn:lazy=0');
    if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await flowDo('fam-set|b:gn:joint=0');
    const before = await flow();
    await st.shot('흐름_턴전');
    const tr = await S.turn('주위를 둘러본다.', { settle: 7000 });
    const after = await flow();
    await st.shot('흐름_턴뒤');
    const kinds = tr.all.map(kindOf);
    const onRows = before.filter((r) => r.on && r.said && !/호출 없음|수동|창 열 때|열 때/.test(r.said));
    S.note('흐름 페이지(턴 전)', before);
    S.note('흐름 페이지(턴 뒤)', after);
    S.note('가짜 서버 순서', tr.all.map((r) => ({ seq: r.seq, route: r.route, kind: kindOf(r), promptTok: r.response?.usage?.prompt_tokens ?? null, chars: JSON.stringify(r.body?.messages ?? '').length })));
    st.check(true, { flowOnRows: onRows.map((r) => `${r.name}:${r.said}`), fakeKinds: kinds, fakeN: tr.all.length });

    st = step('순서: 가짜 서버가 받은 차례가 흐름 페이지 줄 차례(① 메인 전 Router·Director → ② 메인 → ③ 갱신기 → … → 괴담넷)와 같음', '받은 차례 = 페이지 차례 (동시에 나가는 것은 앞뒤 바뀔 수 있음)', 'flowpage.ts ③ 주석 「부르는 순서 (src/body.ts) 갱신기 → 이미지 태그 → 괴담톡·게시판 → 관전 → 위키 → 쇼핑몰」');
    const order = ['Router', 'Director', '메인', '갱신기', '이미지', '괴담넷'];
    const seen = kinds.filter((k) => order.includes(k));
    const sorted = [...seen].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    st.check(JSON.stringify(seen) === JSON.stringify(sorted), { seen, pageOrder: after.filter((r) => r.on).map((r) => r.name) });

    st = step('토큰: 흐름 페이지 「예상」·「지난 턴」 칸 ↔ 가짜 서버가 받은 요청 크기(글자/3 어림)', '같은 자릿수 (예상은 어림이라 차이 있음, 「지난 턴」은 실제 보낸 요청과 맞아야)', 'flowpage.ts est/real 칸');
    const gnReq = tr.all.find((r) => kindOf(r) === '괴담넷');
    const gnRow = after.find((r) => r.name === '괴담넷');
    const mainReq = tr.all.find((r) => kindOf(r) === '메인');
    const mainRow = after.find((r) => r.name === '메인 모델');
    const approx = (r) => Math.round(JSON.stringify(r?.body?.messages ?? '').length / 3);
    const ratio = (a, b) => (b ? +(a / b).toFixed(2) : null);
    st.check(!!gnRow && num(gnRow.real) > 0 && ratio(num(gnRow.real), approx(gnReq)) > 0.3 && ratio(num(gnRow.real), approx(gnReq)) < 3, { gn: { est: gnRow?.est, real: gnRow?.real, fakeApprox: approx(gnReq), fakeUsage: gnReq?.response?.usage?.prompt_tokens }, main: { real: mainRow?.real, fakeApprox: approx(mainReq) } });

    st = step('흐름 페이지에서 괴담넷 모델 「메인」 → 기능 페이지(인터넷) 격자 「모델 메인」에 표시, 기능 페이지에서 「보조」 → 흐름 페이지 「보조」', '두 페이지가 한 값 ($gn 설정 mode)', 'flowpage.ts model2 ↔ famtable boardTable call 띠 (같은 b:gn:mode)');
    await flowDo('fam-set|b:gn:mode=1');
    await S.ed('set:net');
    const netMark = await S.fe(() => { const b = document.querySelector('.gw [data-value="b:gn:mode=1"]'); return b ? { pressed: b.getAttribute('aria-pressed') ?? b.getAttribute('aria-checked'), cls: b.className, checked: b.checked ?? null } : null; });
    await S.click('.gw [data-value="b:gn:mode=2"]', 900);
    const fl2 = await S.fe(() => { const b = document.querySelector('.gw [data-action="fl-do"][data-value="fam-set|b:gn:mode=2"]'); return b ? { pressed: b.getAttribute('aria-pressed'), cls: b.className } : null; });
    st.check(!!netMark && /true|on/.test(JSON.stringify(netMark)) && !!fl2 && fl2.pressed === 'true', { netMark, flowAfterNetChange: fl2 });

    st = step('흐름 페이지에서 괴담톡 자동 호출 「매 턴」 → 괴담톡 페이지 자동 호출 「매 턴」', '괴담톡 페이지도 매 턴', 'flowpage.ts 괴담톡 auto3 ↔ 괴담톡 페이지 r:자동 호출');
    await flowDo('ph-cfg|auto=1');
    await S.ed('set:phone');
    const phMark = await S.fe(() => [...document.querySelectorAll('.gw [aria-pressed="true"], .gw .on')].map((e) => e.textContent.trim()).filter((x) => /매 턴/.test(x)).slice(0, 3));
    st.check(phMark.length > 0, { phMark, ss: (await S.ss()).$ph_auto ?? Object.entries(await S.ss()).filter(([k]) => /^\$ph_.*auto/.test(k)) });
    await flowDo('ph-cfg|auto=0');

    st = step('2차 16 문제2: 흐름 페이지 수 칸에 범위 밖 수(형식 오류 재시도 1003·다시 보기 1002·자동 다시 연결 -5) → 칸이 끝값(3·2·0)으로 바뀌고 저장도 끝값', '칸 = 저장값 = 끝값', '2차 16_설정화면 문제2 / 사용자 11-19 「모든 칸 직접 입력」');
    await S.ed('manage:flow');
    const sel = (k) => `.gw input[data-change="fl-do"][data-key="${k}"]`;
    const res = {};
    for (const [k, v] of [['adv-set|gen:retries', '1003'], ['adv-set|gen:reiterate', '1002'], ['hs-retry|n', '-5']]) {
      if (!(await S.has(sel(k)))) { res[k] = '칸 없음'; continue; }
      await S.setVal(sel(k), v, 'enter', 1200);
      res[k] = { box: await S.fe((s) => document.querySelector(s)?.value ?? null, sel(k)) };
    }
    const ssNow = await S.ss();
    res.saved = { retries: ssNow.$gen_retries, reiterate: ssNow.$gen_reiterate, hs_retry: ssNow.$hs_retry };
    await st.shot('범위밖_수칸');
    const okBox = res['adv-set|gen:retries']?.box === '3' && res['adv-set|gen:reiterate']?.box === '2' && (res['hs-retry|n'] === '칸 없음' || ['0', ''].includes(res['hs-retry|n']?.box));
    st.check(okBox && String(ssNow.$gen_retries) === '3' && String(ssNow.$gen_reiterate) === '2', res);
    await flowDo('adv-set|gen:retries=1');
    await flowDo('adv-set|gen:reiterate=0');
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K8_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 40));
    await S.close();
  }
}
