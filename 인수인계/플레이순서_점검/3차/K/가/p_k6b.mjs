// K6 덧(다시 돌림): 생각 단계 「적고 지움」 — p_k6 K6-05 는 앞 턴과 같은 글 번호를 써서(새로고침은 있던 글을 지킴) 저장 여부를 못 봤다 → 새 글 번호로
import { session, flat } from './lib.mjs';

const GN = 'Board refresh preserves';
const post = (id, title) => ({ author: '야근요정', id, tag: '현장', title, date: '2025.03.14 22:40', views: 5, upvotes: 1, content: '셔터 이야기.', mine: false, comments: [] });

export async function k6b() {
  const S = await session('K6b');
  const { t, step } = S;
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');
    await S.ed('manage:flow');
    await S.click('.gw [data-action="fl-do"][data-value="fam-set|b:gn:lazy=0"]', 900);
    if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await S.click('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]', 900);
    await S.ed('set:net');
    await S.click('.gw [data-action="adv-set"][data-value="gn:thoughts=note"]', 900);
    const body = JSON.stringify({ posts: [post(1847101, 'K6B-NOTE-POST 셔터')], incoming: [], keyFigures: [] });
    await S.addRules([{ id: 'k6b-gn', route: 'aux', match: GN, reply: `<lb-process>K6B-THINK 생각 글.</lb-process>\n${body}` }]);
    const st = step('생각 단계 「적고 지움」 + 답 맨 앞 <lb-process> → 생각 글은 떼고 새 글(새 번호)을 게시판에 저장, 다시 묻지 않음', '괴담넷 요청 1건, $gn_raw 에 K6B-NOTE-POST 있음·K6B-THINK 없음', 'craft.ts·llm.ts stripThoughts / K6');
    const tr = await S.turn('게시판을 본다.', { settle: 6000 });
    const gn = tr.all.filter((r) => flat(r).includes(GN));
    const raw = String((await S.ss()).$gn_raw ?? '');
    st.req('적고지움_괴담넷', gn[0]);
    st.check(gn.length === 1 && raw.includes('K6B-NOTE-POST') && !raw.includes('K6B-THINK'), { gn: gn.length, saved: raw.includes('K6B-NOTE-POST'), think: raw.includes('K6B-THINK'), noteBlock: /# Thoughts\n/.test(flat(gn[0] ?? {})), rawLen: raw.length });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 20));
    await S.close();
  }
}
