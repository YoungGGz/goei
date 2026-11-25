// 재확인 KL R60 — T2: 위키 「매 턴」 + 위키 제목 답 7초 늦게 → 턴 A 끝나자마자 턴 B → 호출 기록에서 위키 호출이 어느 턴에 적히나 (두 번)
import { session, sleep, flat, BASE_RULES } from './lib.mjs';

const S = await session('reR60');
const { t, step } = S;
const trace = () => S.fe(() => [...document.querySelectorAll('.gw .gw-flow-turn')].map((s) => ({ h: s.querySelector('h3')?.innerText.replace(/\s+/g, ' '), nodes: [...s.querySelectorAll('.gw-flow-node')].map((n) => n.querySelector('.gw-flow-top b')?.textContent) })));
try {
  await S.fakeReset([{ id: 'wikislow', route: 'any', match: 'Pick one wiki article title', delayMs: 7000, reply: '명일 아파트' }]);
  await t.setup();
  await S.loadState('S-관리국-3턴.json');
  await S.ed('set:wiki');
  await S.fe(() => { const row = [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label b')?.textContent.includes('자동 호출')); [...row.querySelectorAll('.gx-seg')].find((b) => b.textContent.includes('매 턴')).click(); });
  await sleep(800);
  for (const k of [1, 2]) {
    const st = step(`R60 (${k}) 턴 A → 본편 답 오자마자 턴 B → 16초 뒤 호출 기록`, '앞 턴(A)이 시작한 위키 제목·위키 글 호출은 턴 A 묶음에만 (D-06)', 'D-06');
    const s0 = await S.seq();
    await S.winClose().catch(() => {});
    await t.send(`R60-${k} 턴 A (위키 늦게).`);
    const tA = Date.now();
    await t.send(`R60-${k} 턴 B.`);
    const tB = Date.now();
    await sleep(16000);
    const lg = await S.log(s0);
    const calls = lg.map((r) => ({ seq: r.seq, t: r.t, route: r.route, rule: r.ruleId, kind: /Pick one wiki article title/.test(flat(r)) ? '위키제목' : /wiki/i.test(String(r.body?.messages?.[0]?.content ?? '').slice(0, 300)) ? '위키글?' : String(r.body?.messages?.[0]?.content ?? '').slice(0, 30) }));
    await S.ed('manage:trace');
    await sleep(900);
    const p = await trace();
    await st.shot(`호출기록${k}`);
    const turns = p.filter((s) => !/턴 밖/.test(s.h ?? ''));
    st.check(turns.length >= 2 && !turns[0].nodes.some((n) => /위키/.test(n ?? '')), { sendGapMs: tB - tA, turns: turns.slice(0, 2), calls });
    await S.winClose();
  }
} catch (e) {
  S.note('예외', String(e?.stack ?? e));
  await t.shot('reR60_예외').catch(() => {});
} finally {
  await S.close();
  process.exit(0);
}
