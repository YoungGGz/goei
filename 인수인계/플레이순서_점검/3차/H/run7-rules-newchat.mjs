// H 구간 run7: run3 에서 막힌 두 칸 — (1) 판정 표 「우산 → 손」(범위 넓게로, 좁게가 우산을 거르지 않게), (2) 새 채팅 기본값(시작 화면 설정 단추)에서 시작 소지품 끔
// PC 1280×800, S-요원플레이
import { boot, openItems, act, fText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, auxKind, updaterData, lastAsst, recorder } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run7');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json' });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function turn(tag, text, reply, updFn) {
  const s0 = await seqNow();
  await mainRule('m-' + tag, esc(text), reply);
  u.push(updFn ?? (() => ({})));
  await t.send(text);
  for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
  const upd = (await logSince(s0)).filter((x) => x.route === 'aux' && auxKind(x.body) === 'updater');
  return upd.at(-1) ? updaterData(upd.at(-1).body) : null;
}
const openAdv = async () => { for (let i = 0; i < 6; i++) { const sm = t.F().locator('details.ps-adv:not([open]) > summary:visible').first(); if (!(await sm.count())) break; await sm.scrollIntoViewIfNeeded().catch(() => {}); await sm.click({ timeout: 4000 }).catch(() => {}); await sleep(500); } };
const fillChange = async (sel, v) => { const l = t.F().locator(sel).last(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.fill(v); await l.press('Tab'); await sleep(900); };

try {
  // ── (1) 판정 표 ──
  rec.expect('H6-rules', '범위 넓게 + 판정 표 「우산 → 손」 → 갱신기가 equip none 으로 준 우산이 손 칸 갈래(equip weapon)로 들어오고, 본문에 든다는 말이 없으니 장착은 안 함', '코스 H-6 (판정 표 설명 「표에 적은 종류·물건만 이 표대로」), H-10 (말이 없으면 얻기만, 사용자 결정)');
  await openItems(t);
  await act(t, 'ed-open', 'set:screen', { wait: 1500 });
  await act(t, 'ed-node', 'set:items', { wait: 1200 });
  const sc = await act(t, 'set-items-scope', 'wide');
  await act(t, 'set-items-detail', 'name');
  await openAdv();
  const ra = await act(t, 'set-items-rules-add');
  await openAdv();
  await fillChange('[data-change="set-items-rules-cell"][data-key$=":a"]', '우산');
  await fillChange('[data-change="set-items-rules-cell"][data-key$=":b"]', '손');
  const ss = (await invState(t)).ss;
  await t.shot('run7-판정표-pc');
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  const q = '에일린은 우산꽂이에서 검은 장우산 하나를 챙겼다.';
  await turn('U1', 'U1 우산', `${q}\n${st({ time: '10:20 AM' })}`, (d) => ({ items: [{ name: '우산', action: 'new', desc: '검은 장우산', usable: false, uses: null, equip: 'none', icon: 'misc/우산/umbrella', weight: 0.5, m: lastAsst(d)?.m ?? 'm1', quote: q }] }));
  const s1 = await invState(t);
  const umb = s1.items.list.find((e) => e.name === '우산');
  rec.actual('H6-rules', sc === 'ok' && umb?.equip === 'weapon' && umb?.slot === undefined, { sc, ra, rules: ss.$it_rules, scope: ss.$it_scope, umb, list: itemNames(s1.items) });

  // ── (2) 새 채팅 기본값 ──
  rec.expect('H6-scope2', '이 채팅에서 바꾼 넘길 내용(이름만)·판정 표는 새 채팅에 안 넘어감. 새 채팅 시작 화면의 설정 단추(새 채팅 기본값)에서 시작 소지품 끔 → 에일린으로 시작해도 소지품 비어 있음', '코스 H-6 「이 채팅/새 채팅 기본값 범위 따로」, K-01 (설정은 바로 저장)');
  await t.newChat();
  await t.openWindow('.gx');
  await sleep(1500);
  const po = await act(t, 'prefs-open', null, { wait: 1500 });
  const n1 = await act(t, 'ed-node', 'set:items', { wait: 1200 });
  const scopeTx = await fText(t, '.gx');
  const startBtn = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="set-items-start"]')].map((e) => ({ v: e.dataset.value, checked: e.getAttribute('aria-checked'), vis: e.offsetParent !== null })));
  const defDetail = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="set-items-detail"]')].find((e) => e.classList.contains('on'))?.dataset.value ?? null);
  const so = await act(t, 'set-items-start', '0', { wait: 1000 });
  await t.shot('run7-새채팅기본값-pc');
  await act(t, 'ed-close', null, { wait: 800 });
  const prefs = await t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return cs.pluginStorage.getItem('goei:prefs'); }).catch((e) => 'err:' + String(e.message).slice(0, 80));
  await t.closeWindow();
  await mainRule('m-start', '.', `에일린은 사무실에 출근했다.\n${st({ time: '09:00 AM' })}`);
  let started = null;
  try { started = await t.startPanel({ fac: 'A00', player: 'P004', scene: '직접 입력', situation: '출근 첫날 아침' }); await t.waitIdle(); } catch (e) { started = 'err:' + String(e.message).slice(0, 200); }
  await sleep(2500);
  const sNew = await invState(t);
  rec.actual('H6-scope2', po === 'ok' && so === 'ok' && defDetail === 'full' && (!sNew.items || sNew.items.list.length === 0), { po, n1, scopeHint: scopeTx?.match(/(새 채팅[^.。]{0,60})/)?.[1] ?? null, startBtn, defDetail, so, prefs, started, newItems: itemNames(sNew.items), detail: sNew.ss.$it_detail ?? null, rules: sNew.ss.$it_rules ?? null, carry_pc: sNew.ss.$it_carry_pc, player: sNew.ss.$st_player });
  await openItems(t);
  await t.shot('run7-새채팅-소지품-pc');
  await t.closeWindow();
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run7-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run7-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
