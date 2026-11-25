// K10 (T2 실제 리스AI): 대기 시간 칸 직접 입력·끝값, 관제(호출 흐름) 수 칸 범위 밖 수(0.21.34 고침), 보조 호출 로어북 plugin/risu
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k10 ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const times = async () => (await C.store('goei:prefs')).times ?? {};

  // 1. 대기 시간 칸
  await C.openSet(); await C.node('set:screen');
  await C.typeNum('메인 응답 대기', 0); const a0 = { box: (await C.row('메인 응답 대기')).vals[0], t: await times() };
  await C.typeNum('메인 응답 대기', 31); const a1 = { box: (await C.row('메인 응답 대기')).vals[0], t: await times() };
  await C.typeNum('메인 응답 대기', 3); const a2 = { box: (await C.row('메인 응답 대기')).vals[0], t: await times() };
  await step('메인 응답 대기 0 / 31 / 3(기본) 직접 입력', '0→1분, 31→30분, 3 이면 times 에서 칸이 빠짐(기본값). 칸에 보이는 값 = 저장값', 'timing.ts mainWait 1~30 기본 3, settings.ts:998-1010, K-02', async () => ({ actual: { a0, a1, a2 }, ok: a0.box === '1' && a0.t.mainWait === 1 && a1.box === '30' && a1.t.mainWait === 30 && a2.box === '3' && a2.t.mainWait === undefined }));
  await C.typeNum('응답 다시 확인', 2); const b0 = { box: (await C.row('응답 다시 확인')).vals[0], t: await times() };
  await C.typeNum('응답 다시 확인', 301); const b1 = { box: (await C.row('응답 다시 확인')).vals[0], t: await times() };
  const plus = await C.stepBtn('응답 다시 확인', '+'); const b2 = { box: (await C.row('응답 다시 확인')).vals[0] };
  await C.stepBtn('응답 다시 확인', '-'); const b3 = { box: (await C.row('응답 다시 확인')).vals[0], t: await times() };
  await C.typeNum('응답 다시 확인', 30); const b4 = await times();
  await step('응답 다시 확인 2 / 301 / − + 직접 입력', '2→5초, 301→300초, 300에서 + 막힘, − 한 번에 1(299), 30 이면 기본(칸 빠짐)', 'timing.ts mainAgain 5~300 기본 30, K-02', async () => ({ actual: { b0, b1, plusClickable: plus, b2, b3, b4 }, ok: b0.box === '5' && b0.t.mainAgain === 5 && b1.box === '300' && b1.t.mainAgain === 300 && plus === false && b3.box === '299' && b4.mainAgain === undefined }));
  await C.shot('k10-1-대기시간칸');

  // 2. 관제(호출 흐름) 수 칸에 범위 밖 수
  await C.node('manage:flow'); await sleep(600);
  const flowIn = async (name, v) => {
    const F = t.F();
    const loc = F.locator('.gw input.adv-val').filter({ has: F.locator('xpath=.') }).and(F.locator(`[aria-label*="${name}"]`)).first();
    let l = loc;
    if (!(await l.count())) l = F.locator('.gw .fl-row, .gw tr, .gw li, .gw .ps-row').filter({ hasText: name }).locator('input.adv-val').first();
    await l.scrollIntoViewIfNeeded(); await l.click(); await l.fill(''); await l.type(String(v)); await l.press('Enter'); await l.press('Tab').catch(() => {}); await sleep(700);
    return l.inputValue();
  };
  const f1 = await flowIn('형식 오류 재시도', 1003);
  const f2 = await flowIn('다시 보기', 1002);
  const vars = await C.vars(/^\$gen_(retries|reiterate)$/);
  await C.shot('k10-2-호출흐름-범위밖');
  await step('호출 흐름 수 칸 1003·1002 직접 입력', '칸이 바로 끝값(형식 오류 재시도 3, 다시 보기 2)으로, 저장값도 같음 (2차 16-문제2, 0.21.34 고침)', 'editor/index.ts:163-165 주석, v0.21.34', async () => ({ actual: { box: { retries: f1, reiterate: f2 }, vars }, ok: f1 === '3' && f2 === '2' && String(vars.$gen_retries) === '3' && String(vars.$gen_reiterate) === '2' }));
  // 되돌림
  await flowIn('형식 오류 재시도', 1); await flowIn('다시 보기', 0);
  const backVars = await C.vars(/^\$gen_(retries|reiterate)$/);
  R.at(-1).actual.restored = backVars;
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
