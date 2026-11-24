// H 구간 run3: 소지품 설정 → 갱신기 요청 글·[Inventory]·적용이 바뀌는지 (코스 H-6), 이 채팅/새 채팅 기본값 범위 — PC 1280×800, S-요원플레이
import { boot, openItems, act, fText, toastText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, auxKind, updaterData, lastAsst, recorder, fake } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run3');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json' });
const reqs = {};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function turn(tag, text, reply, updFn, more = {}) {
  const s0 = await seqNow();
  await mainRule('m-' + tag, esc(text), reply, more);
  if (updFn) u.push(updFn);
  await t.send(text);
  for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
  const log = await logSince(s0);
  const main = log.filter((x) => x.route === 'main');
  const upd = log.filter((x) => x.route === 'aux' && auxKind(x.body) === 'updater');
  reqs[tag] = { main: main.map((x) => ({ seq: x.seq, inv: invBlock(x.body) })), upd: upd.map((x) => { const d = updaterData(x.body); return { seq: x.seq, items_now: d?.items_now, items_rule: d?.items_rule, items_away: d?.items_away, used_now: d?.used_now, want: d?.want }; }) };
  return { main: main.at(-1)?.body, upd: upd.at(-1) ? updaterData(upd.at(-1).body) : null };
}
const itemsResp = (items) => (d) => ({ items: items.map((x) => ({ m: lastAsst(d)?.m ?? 'm1', ...x })) });
const openSet = async () => { await openItems(t); await act(t, 'ed-open', 'set:screen', { wait: 1500 }); await act(t, 'ed-node', 'set:items', { wait: 1200 }); };
const closeSet = async () => { await act(t, 'ed-close', null, { wait: 800 }); await t.closeWindow(); };
const openAdv = async () => { for (let i = 0; i < 6; i++) { const sm = t.F().locator('details.ps-adv:not([open]) > summary:visible').first(); if (!(await sm.count())) break; await sm.scrollIntoViewIfNeeded().catch(() => {}); await sm.click({ timeout: 4000 }).catch(() => {}); await sleep(500); } };
const fillChange = async (sel, v, last = false) => { const l0 = t.F().locator(sel); const l = last ? l0.last() : l0.first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.fill(v); await l.press('Tab'); await sleep(900); };

try {
  // 기준 턴: 물건 하나 얻기 (Recently 가 생기게)
  const q0 = '에일린은 매점에서 진통제 한 알을 샀다.';
  await turn('S0', 'S0 매점', `${q0}\n${st({ time: '10:00 AM' })}`, itemsResp([{ name: '진통제', action: 'new', desc: '하얀 알약 한 알', usable: true, uses: 1, equip: 'none', icon: 'medicine/알약/pill', weight: 0.01, quote: q0 }]));

  // ── 넘길 내용(이름만·이름·판정) ──
  rec.expect('H6-detail', '「넘길 내용」 이름만 → [Inventory] 줄이 「- 권총」처럼 이름만(꼬리표·설명 없음). 「이름·판정」 → 설명 없이 [in hand] 같은 꼬리표만', 'H-06 코스 6 (설정 설명 글) — 결정표 줄 없음, C-05 「전부 넘김 그대로」(사용자 결정)는 기본값');
  await openSet();
  const d1 = await act(t, 'set-items-detail', 'name');
  await fillChange('[data-change="set-items-limit"]', '배낭 하나와 두 손');
  const lt = [];
  for (let i = 0; i < 3; i++) lt.push(await act(t, 'set-items-logturns', 'n:-', { wait: 400 }));
  const carryClicks = [await act(t, 'set-items-carry', 'n:+', { wait: 400 })];
  const carryHelp = await t.F().evaluate(() => [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /이 채팅은 명부 값/.test(e.textContent ?? ''))?.textContent ?? null);
  await t.shot('run3-설정-소지품-pc');
  await closeSet();
  const r1 = await turn('S1', 'S1 이름만', `에일린은 걸었다.\n${st({ time: '10:20 AM' })}`, () => ({}));
  const inv1 = invBlock(r1.main);
  rec.actual('H6-detail', d1 === 'ok' && /^- 권총$/m.test(inv1 ?? '') && !/\[in hand\]/.test(inv1 ?? ''), { inv: inv1 });

  rec.expect('H6-limit', '「지닐 수 있는 한계」 글 → Carry limit: 배낭 하나와 두 손', '코스 H-6 (설정 설명 글)');
  rec.actual('H6-limit', /Carry limit: 배낭 하나와 두 손/.test(inv1 ?? ''), { line: (inv1 ?? '').match(/Carry limit:[^\n]*/)?.[0] });
  rec.expect('H6-logturns', '「기록 턴 수」 3→0 → Recently 줄 없음(진통제를 얻은 턴이 최근인데도)', '코스 H-6 (설정 설명 글)');
  rec.actual('H6-logturns', !/Recently:/.test(inv1 ?? ''), { lt, recent: (inv1 ?? '').match(/Recently:[^\n]*/)?.[0] ?? null });
  rec.expect('H6-carry', '명부 인물(에일린 30kg)로 시작한 채팅은 설정 소지 한도를 바꿔도 Weight 줄 한도 30 그대로, 설정 설명에 「이 채팅은 명부 값 30kg」', 'H-05 (사용자 결정)');
  rec.actual('H6-carry', /\/ 30 kg/.test(inv1 ?? '') && /30kg/.test(carryHelp ?? ''), { carryClicks, carryHelp, weight: (inv1 ?? '').match(/Weight:[^\n]*/)?.[0] });

  await openSet();
  await act(t, 'set-items-detail', 'state');
  await closeSet();
  const r1b = await turn('S1b', 'S1b 이름과 판정', `에일린은 멈췄다.\n${st({ time: '10:30 AM' })}`, () => ({}));
  const inv1b = invBlock(r1b.main);
  rec.expect('H6-detail2', '「이름·판정」 → 「- 권총 [in hand]」 (설명 「홀스터에…」 없음)', '코스 H-6');
  rec.actual('H6-detail2', /^- 권총 \[in hand\]$/m.test(inv1b ?? '') && !/홀스터/.test(inv1b ?? ''), { inv: inv1b });

  // ── 물건으로 만드는 범위·만들지 않을 것·상태 바꾸기·판정 표·두고 온 말·다 쓴 물건 ──
  rec.expect('H6-scope', '범위 「좁게」+만들지 않을 것 「영수증」 → 갱신기 요청 items_rule 에 두 내용. 답의 new 샌드위치(food) 는 만들지 않음, 손망치(tool)는 들어옴', '코스 H-6 (설정 설명 글: 좁게 = 쓰임이 있는 것만)');
  rec.expect('H6-state', '「상태 바꾸기」 끔 → 갱신기 update 권총 condition damaged 를 받지 않음(권총 멀쩡)', '코스 H-6 (설정 설명 글), H-08 (상태 4단계는 보조 모델만 바꿈)');
  rec.expect('H6-rules', '판정 표에 「우산 → 손」 → 갱신기가 equip none 으로 준 우산이 손 칸 갈래(weapon)', '코스 H-6 (판정 표, 설정 설명 글)');
  rec.expect('H6-left', '두고 온 말에 「잠가」 더함 → update 소총 설명 「사물함에 잠가 둠」 → 두고 옴(목록에서 빠짐, This turn left …)', '코스 H-6 (설정 설명 글)');
  await openSet();
  await act(t, 'set-items-detail', 'full');
  const sc = await act(t, 'set-items-scope', 'narrow');
  await fillChange('[data-change="set-items-skip"]', '영수증, 명함');
  const so = await act(t, 'set-items-state', '0');
  await openAdv();
  const rowsBefore = await t.F().locator('[data-change="set-items-rules-cell"]').count();
  const ra = await act(t, 'set-items-rules-add');
  await openAdv();
  await fillChange('[data-change="set-items-rules-cell"][data-key$=":a"]', '우산', true);
  await fillChange('[data-change="set-items-rules-cell"][data-key$=":b"]', '손', true);
  const rowsAfter = await t.F().locator('[data-change="set-items-rules-cell"]').count();
  await openAdv();
  await fillChange('[data-change="set-items-left-words"]', '두고, 놓고, 보관해, 맡겨, 반납, 압수, 버리고, 잃어, 잠가');
  const sp = await act(t, 'set-items-spent', 'keep');
  await t.shot('run3-설정-바꾼뒤-pc');
  const ss2 = (await invState(t)).ss;
  await closeSet();
  const q2 = '에일린은 샌드위치와 손망치, 우산을 챙겼다. 권총 손잡이에 흠집이 났다. 소총은 사물함에 잠가 두었다.';
  const r2 = await turn('S2', 'S2 장비 정리', `${q2}\n${st({ time: '10:40 AM' })}`, itemsResp([
    { name: '샌드위치', action: 'new', desc: '햄 샌드위치', usable: true, uses: 1, equip: 'none', icon: 'food/샌드위치/sandwich', weight: 0.2, quote: q2 },
    { name: '손망치', action: 'new', desc: '작은 망치', usable: true, uses: null, equip: 'hand', equipped: false, icon: 'tool/망치/hammer', weight: 0.6, quote: q2 },
    { name: '우산', action: 'new', desc: '검은 장우산', usable: false, uses: null, equip: 'none', icon: 'misc/우산/umbrella', weight: 0.5, quote: q2 },
    { name: '권총', action: 'update', desc: '손잡이에 흠집', condition: 'damaged', quote: q2 },
  ]));
  const s2 = await invState(t);
  const pistol = s2.items.list.find((e) => e.name === '권총');
  const umb = s2.items.list.find((e) => e.name === '우산');
  rec.actual('H6-scope', /영수증/.test(r2.upd?.items_rule ?? '') && !s2.items.list.some((e) => e.name === '샌드위치') && s2.items.list.some((e) => e.name === '손망치'), { items_rule: r2.upd?.items_rule, list: itemNames(s2.items), sc, vars: { scope: ss2.$it_scope, skip: ss2.$it_skip } });
  rec.actual('H6-state', so === 'ok' && pistol?.state === 'ok', { pistol, stateVar: ss2.$it_state });
  rec.actual('H6-rules', umb?.equip === 'weapon', { ra, rowsBefore, rowsAfter, rules: ss2.$it_rules, umb });
  // 두고 옴은 update 한 줄 더
  const q3 = '에일린은 소총을 사물함에 잠가 두었다.';
  const r3 = await turn('S3', 'S3 사물함', `${q3}\n${st({ time: '11:00 AM' })}`, itemsResp([{ name: '소총', action: 'update', desc: '사물함에 잠가 둠', quote: q3 }]));
  const s3 = await invState(t);
  const r4 = await turn('S4', 'S4 다음', `에일린은 복도로 나갔다.\n${st({ time: '11:20 AM' })}`, () => ({}));
  const inv4 = invBlock(r4.main);
  rec.actual('H6-left', s3.items.list.find((e) => e.name === '소총')?.outHow === 'left' && /left 소총/.test(inv4 ?? ''), { rifle: s3.items.list.find((e) => e.name === '소총'), leftWords: ss2.$it_left_words, inv: inv4 });

  // ── 다 쓴 물건 「남겨 두기」 ──
  rec.expect('H6-spent', '「다 쓴 물건」 남겨 두기 → 진통제(1회)를 사용해 다 쓰면 목록에 남고 [Inventory] 에 [used up] 꼬리표', '코스 H-6 (설정 설명 글)');
  await openItems(t);
  const pill = (await invState(t)).items.list.find((e) => e.name === '진통제')?.id;
  await act(t, 'items-open', pill);
  const useP = await act(t, 'items-use', pill);
  await act(t, 'items-close');
  await t.closeWindow();
  await turn('S5', 'S5 진통제를 먹는다', `에일린은 진통제를 삼켰다.\n${st({ time: '11:40 AM' })}`, () => ({}));
  const r6 = await turn('S6', 'S6 다음2', `에일린은 숨을 골랐다.\n${st({ time: '12:00 PM' })}`, () => ({}));
  const inv6 = invBlock(r6.main);
  await openItems(t);
  const gridTx = await fText(t, '.gx-items');
  await t.shot('run3-다쓴물건-남김-pc');
  await t.closeWindow();
  rec.actual('H6-spent', useP === 'ok' && /진통제[^\n]*\[used up\]/.test(inv6 ?? '') && /진통제/.test(gridTx ?? ''), { useP, inv: inv6, grid: gridTx?.slice(0, 300) });

  // ── 새 채팅 기본값 범위 · 시작 소지품 끔 ──
  rec.expect('H6-scope2', '이 채팅에서 바꾼 소지품 설정(칸 수·넘길 내용 등)은 새 채팅 기본값을 바꾸지 않음. 시작 화면 「새 채팅 기본 설정」에서 시작 소지품 끔 → 에일린으로 새 채팅 시작해도 소지품 비어 있음, 옛 채팅 설정은 그대로', '코스 H-6 「이 채팅/새 채팅 기본값 범위 따로」, K-01 (설정은 바로 저장)');
  const prefs0 = await t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return cs.pluginStorage.getItem('goei:prefs'); });
  await t.newChat();
  await t.openWindow('.gx');
  await sleep(1500);
  const pickActs = await t.F().evaluate(() => [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null).map((e) => `${e.dataset.action}=${e.dataset.value ?? ''}`).filter((x) => /set|ed-|pref|cfg/.test(x)));
  let defStart = 'none';
  const edR = await act(t, 'ed-open', 'set:screen', { wait: 1500 });
  if (edR !== 'ok') { const alt = pickActs.find((x) => /^ed-open/.test(x)); if (alt) await act(t, 'ed-open', alt.split('=')[1], { wait: 1500 }); }
  await act(t, 'ed-node', 'set:items', { wait: 1200 });
  const defVals = await t.F().evaluate(() => ({ detail: [...document.querySelectorAll('[data-action="set-items-detail"]')].find((e) => e.classList.contains('on'))?.dataset.value, slots: document.querySelector('[data-change="set-items-slots"]')?.value, start: document.querySelector('[data-action="set-items-start"]')?.dataset.value }));
  defStart = await act(t, 'set-items-start', '0', { wait: 1000 });
  await t.shot('run3-새채팅기본값-pc');
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  const prefs1 = await t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return cs.pluginStorage.getItem('goei:prefs'); });
  await mainRule('m-start', '.', `에일린은 사무실에 출근했다.\n${st({ time: '09:00 AM' })}`);
  let started = null;
  try { started = await t.startPanel({ fac: 'A00', player: 'P004', scene: '직접 입력', situation: '출근 첫날 아침' }); await t.waitIdle(); } catch (e) { started = 'err:' + String(e.message).slice(0, 200); }
  await sleep(2500);
  const sNew = await invState(t);
  rec.actual('H6-scope2', defVals.detail === 'full' && defStart === 'ok' && (!sNew.items || sNew.items.list.length === 0) && /"\$it_start":"0"/.test(prefs1 ?? ''), { pickActs, defVals, defStart, prefs0, prefs1, started, newItems: itemNames(sNew.items), carry_pc: sNew.ss.$it_carry_pc, player: sNew.ss.$st_player });

  writeFileSync(`${OUT}/run3-reqs.json`, JSON.stringify(reqs, null, 1));
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run3-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run3-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
