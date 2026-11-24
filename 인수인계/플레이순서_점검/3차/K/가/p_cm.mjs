// 닿는 공통 갈래: 답 오는 중 설정 바꾸기(늦은 답이 바꾼 값을 덮나) · ◀▶ 뒤 설정 · 폰/폰 가로/폴드 크기의 지침·추가 규칙·이미지 지침·호출 흐름 페이지
//   (다시 굴리기·새로고침·다른 채팅은 K2-05~07, 생각 블록은 K6, 시작 전/새 채팅은 K1 에서 돌림)
import { session, sleep, flat } from './lib.mjs';

export async function cm() {
  const S = await session('CM');
  const { t, step } = S;
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    let st = step('본편 답을 기다리는 동안 설정 창에서 생성 공통 재시도 1→0(안 함)·괴담넷 자동 「매 턴」으로 바꿈 → 답이 온 뒤에도 바꾼 값 그대로', '$gen_retries 0(안 함), 괴담넷 매 턴 유지, 다음 턴에 괴담넷 요청', '공통 갈래 「답 오는 중 그 기능 조작」 / 설정은 채팅 변수 (settings.ts)');
    await S.addRules([{ id: 'cm-hold', route: 'main', hold: true, reply: '잠시 뒤 답. (CM)\n\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]' }]);
    const s0 = await S.seq();
    await t.send('잠깐 기다린다.', { wait: false });
    await sleep(2500);
    await S.ed('set:adv');
    await S.click('.gw [data-action="adv-set"][data-value="gen:retries=0"]', 900);
    await S.ed('manage:flow');
    await S.click('.gw [data-action="fl-do"][data-value="fam-set|b:gn:lazy=0"]', 900);
    const mid = await S.ss();
    await S.winClose();
    await t.fake('release', {});
    await t.waitIdle?.().catch(() => {});
    await sleep(5000);
    const ss1 = await S.ss();
    await S.delRule('cm-hold');
    const gnState = (o) => Object.entries(o).filter(([k]) => /gn.*lazy|\$gn_cfg|gn_auto/.test(k));
    S.note('기다리는 중 값', { retries: mid.$gen_retries, gn: gnState(mid) });
    st.check(String(ss1.$gen_retries) === '0' && JSON.stringify(gnState(ss1)) === JSON.stringify(gnState(mid)), { during: mid.$gen_retries, after: ss1.$gen_retries, gnDuring: gnState(mid), gnAfter: gnState(ss1), calls: (await S.log(s0)).map((r) => r.route) });

    st = step('◀▶(스와이프)로 앞 답으로 넘겨도 설정값은 채팅 변수 그대로 (답마다 따로 아님)', '◀ 뒤에도 $gen_retries 0', '공통 갈래 「◀▶」 / settings.ts v0.16.23 「설정은 하나(지금 채팅)」');
    await t.reroll().catch(() => {});
    await sleep(4000);
    await t.swipePrev().catch(() => {});
    await sleep(1500);
    const ss2 = await S.ss();
    st.check(String(ss2.$gen_retries) === '0', { after: ss2.$gen_retries });
    await S.ed('set:adv');
    await S.click('.gw [data-action="adv-set"][data-value="gen:retries=1"]', 700);
    await S.ed('manage:flow');
    await S.click('.gw [data-action="fl-do"][data-value="fam-set|b:gn:lazy=1"]', 700);
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('CM_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 30));
    await S.close();
  }

  // ── 크기 흉내 (실기 아님) ──
  for (const [nm, o] of [['폰', { w: 344, h: 882, touch: true }], ['폰가로', { w: 882, h: 344, touch: true }], ['폴드', { w: 752, h: 749, touch: true, dsf: 1.8 }]]) {
    const P = await session(`CM-${nm}`, o);
    try {
      await P.fakeReset();
      await P.t.setup();
      await P.loadState('S-관리국-3턴.json');
      const st = P.step(`${nm} 크기(${o.w}×${o.h}) 지침 RP·추가 규칙·이미지(메인 모델)·호출 흐름 페이지: 가로 넘침 없음, 글칸·단추가 화면 안`, '가로 스크롤 없음, 주요 조작이 화면 안', 'CLAUDE.md 「PC와 폰 배치를 똑같이 만들지 않는다」 / common.md 크기');
      const res = {};
      for (const node of ['guide:RP', 'rule:all', 'guide:Image', 'manage:flow']) {
        await P.ed(node).catch((e) => { res[node] = '열기 실패 ' + String(e).slice(0, 80); });
        if (res[node]) continue;
        await sleep(600);
        res[node] = await P.fe(() => {
          const w = document.documentElement.clientWidth;
          const over = [...document.querySelectorAll('.gw textarea, .gw button, .gw input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1); }).map((e) => (e.dataset.action || e.dataset.input || e.dataset.change || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right)).slice(0, 6);
          return { sw: document.documentElement.scrollWidth, w, over };
        });
        await st.shot(`${node.replace(':', '_')}`);
      }
      st.check(Object.values(res).every((r) => typeof r === 'object' && r.sw <= r.w + 1 && !r.over.length), res);
    } catch (e) {
      P.note('예외', String(e?.stack ?? e));
    } finally {
      await P.close();
    }
  }
}
