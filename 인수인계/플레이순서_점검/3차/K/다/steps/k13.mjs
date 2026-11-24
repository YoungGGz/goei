// K13 갈래: 답이 오는 중에 설정 바꾸기 → 늦게 온 답(과 뒤 보조 호출)이 바꾼 값을 덮는지 (K-01), −/+·직접 입력 한 칸 크기(K-02), 슬라이더엔 −/+ 없음(K-11), 아바타 동작 간격 최소·최대 무작위 범위
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k13 ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const pick = async () => { const v = await C.vars(/^\$(gen_reiterate|it_act_gap_min|it_act_gap_max|pp_turn_cap|pp_cap)$/); const p = await C.store('goei:prefs'); return { vars: v, nav: p.nav, mainWait: p.times?.mainWait }; };

  await t.closeWindow().catch(() => {}); await sleep(600);
  // 1) 답이 오는 중 바꾸기
  const v0 = await pick();
  await t.fake('rules/add', { rule: { id: 'k13-hold', route: 'main', matchLast: 'K13 늦은 답', hold: true, reply: 'K13 늦게 온 본편 답.\n\n[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]' } });
  const s0 = await t.fakeSeq();
  await t.send('K13 늦은 답 부탁', { wait: false });
  let held = false; for (let i = 0; i < 60 && !held; i++) { held = (await t.fakeLog(s0, 'main')).some((x) => x.ruleId === 'k13-hold'); if (!held) await sleep(500); }
  const busyNow = await t.isBusy();
  await C.openSet();
  await C.node('set:adv'); await C.typeNum('다시 보기', 1);
  await C.node('set:items'); await C.stepBtn('아바타 동작 간격', '+', 0); await C.stepBtn('아바타 동작 간격', '+', 1);
  await C.node('set:screen'); await C.seg('메뉴 위치', '오른쪽'); await C.typeNum('메인 응답 대기', 5);
  const v1 = await pick();
  await C.shot('k13-1-답기다리는중-설정바꿈');
  await C.closeSet(); await t.closeWindow();
  await t.fake('release', {}); await t.fake('rules/del', { id: 'k13-hold' });
  await t.waitIdle(); await sleep(8000); // 뒤 보조 호출(인물·라우터 등)까지
  const v2 = await pick();
  const last = (await t.chatState(true)).message.at(-1)?.data.slice(0, 30);
  await step('답이 오는 중 바꾼 설정 (채팅 값·기기 값)', '바꾼 값(다시 보기 1, 동작 간격 13/25, 메뉴 오른쪽, 메인 응답 대기 5분)이 늦게 온 답과 뒤 호출이 끝난 뒤에도 그대로', '결정표 K-01 「늦게 온 답이 바꾼 값을 덮는지만」', async () => ({ actual: { held, busyNow, v0, v1, v2, last }, ok: held && JSON.stringify(v1) === JSON.stringify(v2) && String(v2.vars.$gen_reiterate) === '1' && v2.nav === 'right' && v2.mainWait === 5 && /K13 늦게 온/.test(last ?? '') }));

  // 2) 한 칸 크기: 1만 이상 100씩 (K-02)
  await C.openSet(); await C.node('set:adv');
  await C.typeNum('요청 토큰 상한', 10000); const k0 = (await C.row('요청 토큰 상한')).vals[0];
  await C.stepBtn('요청 토큰 상한', '+'); const k1 = (await C.row('요청 토큰 상한')).vals[0];
  await C.stepBtn('요청 토큰 상한', '-'); await C.stepBtn('요청 토큰 상한', '-'); const k2 = (await C.row('요청 토큰 상한')).vals[0];
  await C.stepBtn('요청 토큰 상한', '-'); const k3 = (await C.row('요청 토큰 상한')).vals[0];
  await C.typeNum('요청 토큰 상한', 0); const minus0 = await C.stepBtn('요청 토큰 상한', '-'); const k4 = (await C.row('요청 토큰 상한')).vals[0];
  const bud = (await C.vars(/^\$gen_budget$/)).$gen_budget;
  await step('−/+ 한 칸 (1만 이상 100씩)', '상한 20만인 칸이라 한 칸 100 (stepval.ts 「상한이 1만 이상인 큰 수만 100씩」): 10,000 + → 10,100, − 두 번 → 9,900, − → 9,800, 0 에서 − 막힘', '결정표 K-02', async () => ({ actual: { k0, k1, k2, k3, minus0, k4, bud }, ok: k1 === '10,100' && k3 !== k2 && minus0 === false }));
  // 3) 슬라이더엔 −/+ 없음
  await C.node('set:people'); await sleep(500);
  const sl = await t.F().evaluate(() => [...document.querySelectorAll('.gw .ps-row')].filter((r) => r.querySelector('input[type=range]')).map((r) => ({ name: r.querySelector('.ps-label b')?.firstChild?.textContent.trim(), steps: r.querySelectorAll('button.gx-step').length })));
  await step('슬라이더 줄에 −/+ 없음', '인물 메뉴의 슬라이더 줄(메시지당 변화 상한 등) −/+ 단추 0', '결정표 K-11', async () => ({ actual: sl, ok: sl.length > 0 && sl.every((x) => x.steps === 0) }));
  // 4) 아바타 동작 간격: 최소>최대·최대<최소 같이 밀기, 화면 아바타의 범위
  await C.node('set:items');
  await C.typeNum('아바타 동작 간격', 40, 0); const g1 = (await C.row('아바타 동작 간격')).vals;
  await C.typeNum('아바타 동작 간격', 5, 1); const g2 = (await C.row('아바타 동작 간격')).vals;
  await C.typeNum('아바타 동작 간격', 2, 0); await C.typeNum('아바타 동작 간격', 6, 1); const g3 = (await C.row('아바타 동작 간격')).vals;
  await C.typeNum('아바타 동작 간격', 121, 1); const g4 = (await C.row('아바타 동작 간격')).vals;
  await C.typeNum('아바타 동작 간격', 6, 1);
  await C.closeSet();
  await C.act('tab', 'items', false); await sleep(1200);
  const gapAttr = await t.F().evaluate(() => document.querySelector('[data-gap]')?.dataset.gap ?? null);
  await C.shot('k13-2-소지품-아바타');
  await step('아바타 동작 간격 최소·최대', '최소 40 → 최대도 40, 최대 5 → 최소도 5, 2/6 → 아바타 data-gap 「2-6」(그 사이 무작위, pickLookGap), 121 → 120', 'settings.ts:1039-1049, looks.ts:115-120', async () => ({ actual: { g1, g2, g3, g4, gapAttr }, ok: g1[0] === '40' && g1[1] === '40' && g2[0] === '5' && g2[1] === '5' && g3.join() === '2,6' && g4[1] === '120' && (gapAttr === null || gapAttr === '2-6') }));
  // 되돌림
  await C.openSet(); await C.node('set:items'); await C.typeNum('아바타 동작 간격', 12, 0); await C.typeNum('아바타 동작 간격', 24, 1);
  await C.node('set:adv'); await C.typeNum('다시 보기', 0);
  await C.node('set:screen'); await C.seg('메뉴 위치', '왼쪽'); await C.typeNum('메인 응답 대기', 3);
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
