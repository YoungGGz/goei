// K11 관리 ② 호출 기록: 보관 턴(2), 지우기(확인 팝업), 조립 단계 이름표·「플러그인이 넣은 것」, 턴 밖(수동) 호출, 앞 턴이 시작한 늦은 보조 호출이 그 턴에 적히는지, 긴 글 자르기, 내려받기 단추 유무
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k11b ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const page = () => t.F().evaluate(() => [...document.querySelectorAll('.gw .gw-flow-turn')].map((s) => ({ h: s.querySelector('h3')?.innerText.replace(/\s+/g, ' '), nodes: [...s.querySelectorAll('.gw-flow-node')].map((n) => ({ title: n.querySelector('.gw-flow-top b')?.textContent, state: n.querySelector('.gw-state')?.textContent, meta: n.querySelector('.gw-flow-meta')?.textContent })) })));
  const trace = () => t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const keys = (await cs.pluginStorage.keys()).filter((k) => k.startsWith('goei-trace')); const o = {}; for (const k of keys) { const v = await cs.pluginStorage.getItem(k); o[k] = typeof v === 'string' ? v.length : v; } return o; });

  await C.openSet(); await C.node('set:screen'); await C.typeNum('호출 기록 보관', 2);
  const keep = (await C.store('goei:prefs')).traceKeep;
  await C.node('manage:trace'); await sleep(600);
  const hasDrop = await t.F().locator('.gw [data-action="man-drop-trace"]').count();
  if (hasDrop) { await C.act('man-drop-trace'); await sleep(300); await C.act('man-drop-trace-yes'); await sleep(600); }
  const empty = await t.F().evaluate(() => document.querySelector('.gw .gw-page')?.innerText.includes('아직 기록이 없어요'));
  const dlBtn = await t.F().evaluate(() => [...document.querySelectorAll('.gw .gw-page button')].map((b) => b.textContent.trim()).filter((x) => /내려|다운|받기/.test(x)));
  await C.closeSet(); await t.closeWindow();
  await step('보관 2턴 설정 → 기록 지우기', 'prefs.traceKeep=2, 지우면 「아직 기록이 없어요」', 'setdef trace-keep 1~20, manage.ts:334-342', async () => ({ actual: { keep, hadDrop: hasDrop, empty, dlBtn }, ok: keep === 2 && empty }));

  // 3턴 보내기: 셋째 턴은 아주 긴 답(자르기 확인)
  await t.send('K11 턴 하나.');
  await t.send('K11 턴 둘.');
  await t.send('K11 턴 셋.');
  await C.openSet(); await C.node('manage:trace'); await sleep(1200);
  const p1 = await page();
  await C.shot('k11b-1-호출기록-2턴');
  await step('보관 2턴 → 3턴 보낸 뒤', '턴 2개만 남음(턴 2·턴 1), 각 턴: 메인 요청 조립(「플러그인이 넣은 것 N토큰」)·라우터·디렉터·메인 응답·갱신기', 'trace.ts:215 keepTurns, editor/trace.ts', async () => ({ actual: p1, ok: p1.length === 2 && p1.every((s) => s.nodes.some((n) => n.title === '메인 요청 조립' && /플러그인이 넣은 것/.test(n.meta))) }));
  // 메인 요청 조립 펼치기 → 이름표
  await t.F().locator('.gw .gw-flow-turn').first().locator('[data-action="man-trace-toggle"]').first().click(); await sleep(600);
  const tags = await t.F().evaluate(() => [...document.querySelectorAll('.gw .gw-flow-turn')][0].querySelectorAll('.gw-flow-tag').length ? [...[...document.querySelectorAll('.gw .gw-flow-turn')][0].querySelectorAll('.gw-flow-tag')].map((e) => e.textContent) : []);
  await C.shot('k11b-2-조립단계이름표');
  await step('조립 단계 이름표', '펼친 메시지마다 단계 이름표(로어·상태창 등) 보임', 'editor/trace.ts:5 (사용자 11-15)', async () => ({ actual: { tags: [...new Set(tags)] }, ok: tags.length > 0 }));
  // 긴 글 자르기(40만 자)는 42만 자 답을 넣으면 리스AI 탭이 9분 넘게 멈춰(렌더러 CPU 90%) 이 틀로 돌리지 않음 — 찾은문제.md 「못 돌린 것」
  await C.closeSet();

  // 턴 밖 수동 호출(괴담톡 확인)
  await C.open(); await C.act('tab', 'phone', false); await sleep(800); await C.act('ph-refresh', undefined, false); await sleep(5000);
  await C.openSet(); await C.node('manage:trace'); await sleep(900);
  const p2 = await page();
  await step('턴 밖 수동 호출', '「턴 밖 호출」 묶음에 괴담톡 호출 「(수동)」 — 앞 턴 묶음에는 안 섞임', 'trace.ts:277-281, flowpage.ts:86', async () => ({ actual: p2.map((s) => ({ h: s.h, titles: s.nodes.map((n) => n.title) })), ok: p2.some((s) => /턴 밖/.test(s.h) && s.nodes.some((n) => /수동/.test(n.title))) && !p2.filter((s) => !/턴 밖/.test(s.h)).some((s) => s.nodes.some((n) => /수동/.test(n.title))) }));
  await C.closeSet(); await t.closeWindow();

  R.push(...(await lateOnly(C, true)));
  await C.openSet();
  await C.node('set:wiki'); await C.seg('자동 호출', '수동'); await C.node('set:screen'); await C.typeNum('호출 기록 보관', 5);
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}

export async function lateOnly(C, inner = false) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k11b ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const page = () => t.F().evaluate(() => [...document.querySelectorAll('.gw .gw-flow-turn')].map((s) => ({ h: s.querySelector('h3')?.innerText.replace(/\s+/g, ' '), nodes: [...s.querySelectorAll('.gw-flow-node')].map((n) => ({ title: n.querySelector('.gw-flow-top b')?.textContent, state: n.querySelector('.gw-state')?.textContent, meta: n.querySelector('.gw-flow-meta')?.textContent })) })));
  // 늦은 보조 호출: 위키 자동 「매 턴」 + 위키 답 6초 늦게 → 턴 A 뒤 바로 턴 B
  await C.openSet(); await C.node('set:wiki'); await C.seg('자동 호출', '매 턴'); await C.closeSet(); await t.closeWindow();
  await t.fake('rules/add', { rule: { id: 'k11-wikislow', route: 'any', match: 'Pick one wiki article title', delayMs: 7000, reply: '명일 아파트' } });
  await t.send('K11 턴 A (위키 늦게).');
  await t.send('K11 턴 B.');
  await sleep(16000);
  await t.fake('rules/del', { id: 'k11-wikislow' });
  await C.openSet(); await C.node('manage:trace'); await sleep(900);
  const p3 = await page();
  await C.shot('k11b-3-늦은보조호출');
  const log = (await t.fakeLog(0)).filter((x) => x.ruleId === 'k11-wikislow').map((x) => ({ seq: x.seq, t: x.t, last: x.lastUser.slice(0, 40) }));
  await step('앞 턴이 시작한 늦은 위키 호출', '위키 호출은 턴 A(앞 턴) 묶음에만, 턴 B 묶음엔 위키 없음 (D-06, 0.21.34)', '결정표 D-06, 2차 14-문제2', async () => ({ actual: { turns: p3.map((s) => ({ h: s.h, titles: s.nodes.map((n) => n.title) })), wikiReq: log }, ok: (() => { const tb = p3.filter((s) => !/턴 밖/.test(s.h)); return tb.length >= 2 && !tb[0].nodes.some((n) => /위키/.test(n.title)) && tb[1].nodes.some((n) => /위키/.test(n.title)); })() }));
  await C.closeSet();
  return inner ? R : R.map((r) => ({ name: r.name, ok: r.ok }));
}
