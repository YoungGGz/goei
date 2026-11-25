// H 구간 run1: 소지품 대표 줄기 (코스 H-1·H-2·H-5·H-7 일부·H-8) — PC 1280×800, 상태 S-요원플레이(에일린, 시작 소지품·명부 소지 한도 30kg)
// 단계마다 기대값·결정표 줄을 먼저 적고(rec.expect) 돌린 뒤 실제값을 적는다(rec.actual). src/ 는 건드리지 않는다.
import { goItems, mdrag, boot, openItems, act, fText, toastText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, auxKind, updaterData, lastAsst, recorder, fake } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run1');
const u = updaterScript();
await baseRules(u.file);
const { t, loaded } = await boot({ state: 'S-요원플레이.json' });
const reqs = {};
const idOf = async (name) => (await invState(t)).items?.list.find((e) => e.name === name && !e.outHow && !e.mergedInto)?.id;
const chip = () => t.page.evaluate(() => {
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent).filter((x) => x.includes('data-gu-label')).join('\n');
  const label = /\[data-gu-label\]::before \{ content: "([^"]+)"/.exec(css)?.[1] ?? null;
  const names = [...css.matchAll(/\[data-gu="\d+"\]::before \{ content: "([^"]+)"/g)].map((m) => m[1]);
  return { label, names };
});
/** 한 턴: 본편 규칙 + 갱신기 대본을 걸고 보낸다. 돌려줌: 이 턴 본편 요청 몸·갱신기 요청 */
async function turn(tag, text, reply, updFn, { hold = false, beforeRelease } = {}) {
  const s0 = await seqNow();
  await mainRule('m-' + tag, text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), reply, hold ? { hold: true } : {});
  if (updFn) u.push(updFn);
  if (hold) {
    await t.send(text, { wait: false });
    await t.waitBusy(15000).catch(() => {});
    for (let i = 0; i < 40; i++) { const p = await fake('pending'); if (p.some((x) => x.route === 'main')) break; await sleep(300); }
    if (beforeRelease) await beforeRelease();
    await fake('release', {});
    await t.waitIdle();
  } else await t.send(text);
  // 갱신기 끝날 때까지
  for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
  const log = await logSince(s0);
  const main = log.filter((x) => x.route === 'main');
  const upd = log.filter((x) => x.route === 'aux' && auxKind(x.body) === 'updater');
  reqs[tag] = { main: main.map((x) => ({ seq: x.seq, inv: invBlock(x.body) })), upd: upd.map((x) => ({ seq: x.seq, data: updaterData(x.body) })) };
  return { main: main.at(-1)?.body, upd: upd.at(-1) ? updaterData(upd.at(-1).body) : null, log };
}
const itemsResp = (items) => (data) => {
  const a = lastAsst(data);
  return { items: items.map((x) => ({ m: a?.m ?? 'm1', ...x })) };
};

try {
  // ── H1-a 보기 ──
  rec.expect('H1-a', '소지품 창: 시작 소지품 셋(권총·소총 손 칸, 방탄조끼 장비 칸), 무게 합 8.4 / 30kg(명부 carry), 칸 0/16, 그림 우하단 무게', 'H-04·H-05·H-08 (사용자 결정)');
  await openItems(t);
  for (let i = 0; i < 30; i++) { const tx = await fText(t, '.gx-items'); if (!/그림 받는 중/.test(tx ?? '')) break; await sleep(1000); }
  await t.shot('run1-H1a-보기-pc');
  const tx1 = await fText(t, '.gx-items');
  rec.actual('H1-a', /8\.4 \/ 30kg/.test(tx1) && /0 \/ 16/.test(tx1) && /900g/.test(tx1) && /3\.5kg/.test(tx1) && /4kg/.test(tx1), tx1.slice(0, 300), { shot: 'out/run1-H1a-보기-pc.png' });
  await t.closeWindow();

  // ── T1 물건 얻기 (갱신기 자동 반영) ──
  rec.expect('H5-a', '갱신기 요청 want.items=true·items_now 에 시작 소지품 셋(equipped)·무게. 답의 new 4개가 소지품에 들어감(구급상자 3회·붕대 묶음 3회·압박 붕대 2회·손전등 손 칸 갈래)', 'H-08·H-10 (사용자 결정)');
  const q1 = '에일린은 비품실에서 구급상자와 붕대 묶음, 압박 붕대, 손전등을 챙겼다.';
  const r1 = await turn('T1', 'H1 비품실에 들른다', `${q1}\n\n<img=Jyaldi_serious>\n\n쟈알디가 고개를 끄덕였다.\n${st({ time: '10:00 AM' })}`, itemsResp([
    { name: '구급상자', action: 'new', desc: '흰 플라스틱 구급상자', usable: true, uses: 3, equip: 'none', icon: 'tool/구급상자/first aid kit', weight: 1.5, quote: q1 },
    { name: '붕대 묶음', action: 'new', desc: '압박용 붕대 여러 개', usable: true, uses: 3, equip: 'none', icon: 'misc/붕대/bandage', weight: 0.3, quote: q1 },
    { name: '압박 붕대', action: 'new', desc: '탄력 압박 붕대', usable: true, uses: 2, equip: 'none', icon: 'misc/붕대/bandage', weight: 0.2, quote: q1 },
    { name: '손전등', action: 'new', desc: '검은 금속 손전등', usable: true, uses: null, equip: 'hand', equipped: false, icon: 'tool/손전등/flashlight', weight: 0.4, quote: q1 },
  ]));
  const s1 = await invState(t);
  rec.actual('H5-a', !!r1.upd?.want?.items && (r1.upd?.items_now ?? []).length === 3 && ['구급상자', '붕대 묶음', '압박 붕대', '손전등'].every((n) => s1.items.list.some((e) => e.name === n)), { want: r1.upd?.want, items_now: r1.upd?.items_now, list: itemNames(s1.items) });

  // ── H1-b 사용 (다음 메시지에) ──
  rec.expect('H1-b', '구급상자 「사용」 → 소지품 창 사용 칸·채팅 마지막 메시지 아래 「다음 메시지에 사용」 칩(구급상자). $st_item_use 에 1개', 'H-08·H-09·H-17b');
  await openItems(t);
  const kit = await idOf('구급상자');
  await act(t, 'items-open', kit);
  await t.shot('run1-H1b-팝업-구급상자-pc');
  const r_use = await act(t, 'items-use', kit);
  const ui1 = await toastText(t);
  await act(t, 'items-close');
  await sleep(800);
  await t.shot('run1-H1b-사용칸-pc');
  const c1 = await chip();
  const s2 = await invState(t);
  rec.actual('H1-b', r_use === 'ok' && c1.label === '다음 메시지에 사용' && c1.names.some((n) => /구급상자/.test(n)) && (s2.use ?? '').includes(kit), { click: r_use, toast: ui1, chip: c1, use: s2.use, useAt: s2.useAt });
  await t.closeWindow();
  await t.shot('run1-H1b-채팅칩-pc');

  // ── T2 사용을 싣고 보냄 + 답 기다리는 동안 잠김 ──
  rec.expect('H7-a', '답 기다리는 동안: 다른 물건(붕대 묶음) 사용 → 막힘 안내(답을 기다리는 중), 구급상자 팝업에 「사용 취소」 없음, 칩 이름표 「보내는 중」', 'H-17 (사용자 결정)·H-17b (Claude 판정)');
  rec.expect('H1-c', '본편 요청 [Inventory] This turn: uses 구급상자 (2 left after this). 답 뒤 구급상자 남은 2, 갱신기 used_now 에 구급상자', 'H-08 (사용자 결정)');
  const busyObs = {};
  const q2 = '에일린은 구급상자를 열어 쓸린 팔에 소독약을 바르고 거즈를 붙였다.';
  const r2 = await turn('T2', 'H2 다친 팔을 치료한다', `${q2}\n${st({ time: '10:20 AM' })}`, () => ({}), {
    hold: true,
    beforeRelease: async () => {
      busyObs.chip = await chip();
      await openItems(t);
      const band = await idOf('붕대 묶음');
      await act(t, 'items-open', band);
      busyObs.useBand = await act(t, 'items-use', band);
      busyObs.toast = await toastText(t);
      await act(t, 'items-close');
      await act(t, 'items-open', kit);
      busyObs.kitPopup = await fText(t, '.it-pop');
      busyObs.unuseBtn = await t.F().locator('[data-action="items-unuse"]:visible').count();
      await t.shot('run1-H7a-기다리는중-구급상자팝업-pc');
      await act(t, 'items-close');
      // 기다리는 동안 합치기 (사용에 안 넣은 붕대 묶음 + 압박 붕대)
      await act(t, 'items-open', band);
      busyObs.mergeBtn = await act(t, 'items-merge');
      busyObs.mergeTo = await act(t, 'items-merge-to', await idOf('압박 붕대'));
      busyObs.mergeToast = await toastText(t);
      busyObs.afterMerge = itemNames((await invState(t)).items);
      await act(t, 'items-close');
      await t.closeWindow();
    },
  });
  const s3 = await invState(t);
  const inv2 = invBlock(r2.main);
  rec.actual('H7-a', busyObs.chip?.label === '보내는 중' && /답을 기다리/.test(busyObs.toast ?? '') && busyObs.unuseBtn === 0, busyObs, { shot: 'out/run1-H7a-기다리는중-구급상자팝업-pc.png' });
  const kitLeft = (() => { const e = s3.items.list.find((x) => x.name === '구급상자'); const used = s3.items.log.filter((l) => l.item === e?.id && l.what === 'use').reduce((n, l) => n + (l.n ?? 1), 0); return (e?.uses ?? 0) - used; })();
  rec.actual('H1-c', /This turn: uses 구급상자 \(2 left after this\)/.test(inv2 ?? '') && kitLeft === 2 && (r2.upd?.used_now ?? []).some((x) => x.name === '구급상자'), { inv: inv2, kitLeft, used_now: r2.upd?.used_now, useAt: s3.useAt });

  // ── H1-e 합치기 결과 확인 (기다리는 동안 합쳐졌으면) ──
  rec.expect('H1-e', '합치기: 붕대 묶음(남김)+압박 붕대 → 붕대 묶음 이름·설명 그대로, 횟수 3+2=5. 다음 요청 This turn 에 combined … 한 줄', 'H-07 (사용자 결정)');
  const merged = s3.items.list.find((e) => e.name === '붕대 묶음');
  const mergedLeft = merged ? (merged.uses ?? 0) + s3.items.list.filter((e) => e.mergedInto === merged.id).reduce((n, e) => n + (e.uses ?? 0), 0) : null;

  // ── H1-d 장착·해제 ──
  rec.expect('H1-d', '손전등 장착 → 손 칸 둘 다 참(권총·소총) → 「다 찼어요」류 안내. 소총 넣기 → 손전등 장착 → 손 칸. 방탄조끼 끌어 격자로(해제) → 다시 장비 칸 1번으로 끌어 장착(PC 끌기)', 'H-08·H-09 (사용자 결정)');
  await openItems(t);
  const fl = await idOf('손전등');
  await act(t, 'items-open', fl);
  const eqFull = await act(t, 'items-equip', fl);
  const fullMsg = await toastText(t);
  await act(t, 'items-close');
  const rifle = await idOf('소총');
  await act(t, 'items-open', rifle);
  const unRifle = await act(t, 'items-unequip', rifle);
  await act(t, 'items-close');
  await act(t, 'items-open', fl);
  const eqFl = await act(t, 'items-equip', fl);
  await act(t, 'items-close');
  const vest = await idOf('방탄조끼');
  let dnd1 = 'ok', dnd2 = 'ok';
  dnd1 = await mdrag(t, `[data-drag="${vest}"]`, '[data-drop="grid"]', 'topleft');
  await sleep(1000);
  const afterDnd1 = itemNames((await invState(t)).items);
  dnd2 = await mdrag(t, `[data-drag="${vest}"]`, '[data-drop="equip:gear:1"]');
  await sleep(1000);
  await t.shot('run1-H1d-장착-pc');
  const s4 = await invState(t);
  rec.actual('H1-d', eqFull === 'ok' && /찼/.test(fullMsg) && s4.items.list.find((e) => e.id === fl)?.slot !== undefined && s4.items.list.find((e) => e.id === rifle)?.slot === undefined && s4.items.list.find((e) => e.id === vest)?.slot === 1, { fullMsg, unRifle, eqFl, dnd1, afterDnd1, dnd2, list: itemNames(s4.items) }, { shot: 'out/run1-H1d-장착-pc.png' });

  // 끌어서 사용 칸으로 (압박붕대/붕대 묶음)
  rec.expect('H1-d2', '붕대 묶음을 사용 칸으로 끌기 → 사용 예정(칩)', 'H-09 (끌어다 놓기 PC 만)');
  const band2 = await idOf('붕대 묶음');
  let dnd3 = 'ok';
  dnd3 = await mdrag(t, `[data-drag="${band2}"]`, '[data-drop="use"]');
  await sleep(800);
  const c3 = await chip();
  rec.actual('H1-d2', c3.names.some((n) => /붕대/.test(n)), { dnd3, chip: c3, use: (await invState(t)).use });
  await t.closeWindow();

  // ── T3: 장착·합침·사용이 다음 본편에 ──
  rec.expect('H1-d3', '다음 본편 [Inventory]: 손전등 [in hand], 방탄조끼 [worn], 소총은 꼬리표 없음, 권총 [in hand]. This turn: uses 붕대 묶음 …, combined 압박 붕대 into 붕대 묶음(기다리는 동안 합친 경우 앞 턴에 묶였으면 Recently 쪽). 무게 줄 Weight: x kg / 30 kg', 'H-04·H-07·H-08 (사용자 결정), H-12 (합침 두 번 실림은 Claude 판정)');
  const q3 = '에일린은 손전등을 켜 들고 붕대를 손목에 감았다.';
  const r3 = await turn('T3', 'H3 손전등을 켜고 붕대를 감는다', `${q3}\n${st({ time: '10:40 AM' })}`, () => ({}));
  const inv3 = invBlock(r3.main);
  rec.actual('H1-d3', /손전등.*\[in hand\]/.test(inv3) && /방탄조끼.*\[worn\]/.test(inv3) && /권총.*\[in hand\]/.test(inv3) && !/소총[^\n]*\[in hand\]/.test(inv3) && /uses 붕대 묶음/.test(inv3), { inv: inv3 });
  rec.actual('H1-e', merged?.name === '붕대 묶음' && merged?.desc === '압박용 붕대 여러 개' && mergedLeft === 5, { merged, mergedLeft, busyMerge: busyObs, invT2: inv2, invT3: inv3 });

  // ── H1-f 버리기·삭제 ──
  rec.expect('H1-f', '소총 버리기 → 목록에서 빠지고 기록에 「버림」, 다음 본편 This turn: threw 소총 away …. 손전등 삭제(휴지통) → 목록·기록에서 지워짐', 'H-08 (사용자 결정, 버림은 숨김으로 남김 코드 주석)');
  await openItems(t);
  await act(t, 'items-open', rifle);
  await act(t, 'items-drop-ask', rifle);
  await t.shot('run1-H1f-버리기확인-pc');
  const drop = await act(t, 'items-drop', rifle);
  const dropMsg = await toastText(t);
  await act(t, 'items-open', fl);
  await act(t, 'items-purge-ask', fl);
  await t.shot('run1-H1f-삭제확인-pc');
  const purge = await act(t, 'items-purge', fl);
  const purgeMsg = await toastText(t);
  await act(t, 'items-view', 'log');
  await t.shot('run1-H1f-기록-pc');
  const logTx = await fText(t, '.gx-items');
  await act(t, 'items-view', 'grid');
  const s5 = await invState(t);
  await t.closeWindow();
  const r4 = await turn('T4', 'H4 사무실로 돌아간다', `에일린은 사무실로 돌아왔다.\n${st({ time: '11:00 AM' })}`, () => ({}));
  const inv4 = invBlock(r4.main);
  rec.actual('H1-f', drop === 'ok' && purge === 'ok' && s5.items.list.find((e) => e.id === rifle)?.outHow === 'drop' && !s5.items.list.some((e) => e.id === fl) && /threw 소총 away/.test(inv4), { dropMsg, purgeMsg, log: logTx.slice(0, 400), inv: inv4, list: itemNames(s5.items) }, { shot: 'out/run1-H1f-기록-pc.png' });

  // ── H1-g 고치기 폼 ──
  rec.expect('H1-g', '고치기 단추: 설정 기본 끔이라 팝업에 없음. 설정 소지품 「고치기」 켬 → 단추가 생기고, 무게를 30kg 로 고쳐 저장 → 「고쳤어요」', 'H-06 (사용자 결정)');
  await openItems(t);
  await act(t, 'items-open', kit);
  const editBefore = await t.F().locator('[data-action="items-edit"]').count();
  await act(t, 'items-close');
  await act(t, 'ed-open', 'set:screen', { wait: 1500 });
  await act(t, 'ed-node', 'set:items', { wait: 1200 });
  const editOn = await act(t, 'set-items-edit', '1', { wait: 1000 });
  await act(t, 'ed-close', null, { wait: 800 });
  await goItems(t);
  await act(t, 'items-open', kit);
  const editAfter = await t.F().locator('[data-action="items-edit"]:visible').count();
  await act(t, 'items-edit');
  await t.shot('run1-H1g-고치기폼-pc');
  await t.F().locator('[name="weight"]').fill('30');
  const save = await act(t, 'items-save', kit);
  const saveMsg = await toastText(t);
  const s6 = await invState(t);
  rec.actual('H1-g', editBefore === 0 && editOn === 'ok' && editAfter === 1 && s6.items.list.find((e) => e.id === kit)?.weight === 30, { editBefore, editOn, editAfter, save, saveMsg, weight: s6.items.list.find((e) => e.id === kit)?.weight });

  // ── H2 무게 넘음 ──
  rec.expect('H2-a', '무게 합이 30kg 를 넘으면(구급상자 30kg×남은 2 = 60 + …) 무게 표시 색이 진해짐(넘은 만큼), 얻기 막지 않음. 다음 본편: Weight: X kg / 30 kg (Y kg over), 「무겁다」 같은 말 없음', 'H-04·H-05 (사용자 결정)');
  await act(t, 'items-close');
  await sleep(500);
  const wt = await t.F().evaluate(() => { const e = document.querySelector('.it-wgt'); if (!e) return null; const cs = getComputedStyle(e); return { text: e.textContent, cls: e.className, style: e.getAttribute('style'), color: cs.color, bg: cs.backgroundColor, title: e.title }; });
  await t.shot('run1-H2a-무게넘음-pc');
  await t.closeWindow();
  const r5 = await turn('T5', 'H5 짐을 정리한다', `에일린은 짐을 정리했다.\n${st({ time: '11:20 AM' })}`, () => ({}));
  const inv5 = invBlock(r5.main);
  rec.actual('H2-a', /Weight: [\d.]+ kg \/ 30 kg \([\d.]+ kg over\)/.test(inv5) && !/heavy/i.test(inv5), { wt, inv: inv5 }, { shot: 'out/run1-H2a-무게넘음-pc.png' });

  // ── H2-b 칸 넘침 (칸 수 8 로 줄이고 직접 넣기로 물건을 늘림) ──
  rec.expect('H2-b', '칸 수 8 로 줄이고 직접 넣기로 격자 물건을 9개 넘김 → 넘친 칸 붉은 테두리(over), 「9/8」, 얻기 안 막음. 본편 [Inventory] n/8 (over the limit) + This turn: carrying more than the limit', 'H-05 (사용자 결정), H-03 (−/+ 한 칸씩)');
  await openItems(t);
  await act(t, 'ed-open', 'set:screen', { wait: 1500 });
  await act(t, 'ed-node', 'set:items', { wait: 1200 });
  const slotClicks = [];
  for (let i = 0; i < 8; i++) slotClicks.push(await act(t, 'set-items-slots', 'n:-', { wait: 400 }));
  const slotVal = await t.F().evaluate(() => document.querySelector('[data-change="set-items-slots"]')?.value ?? null);
  await act(t, 'ed-close', null, { wait: 800 });
  await goItems(t);
  const addRes = [];
  for (const n of ['메모장', '볼펜', '라이터', '껌', '동전 지갑', '사탕', '머리끈']) {
    await act(t, 'items-add');
    await t.F().locator('[name="name"]').fill(n);
    await t.F().locator('[name="weight"]').fill('0.1');
    addRes.push(await act(t, 'items-save', ''));
  }
  await sleep(600);
  const grid = await t.F().evaluate(() => ({ count: document.querySelector('.it-stat')?.textContent ?? null, statCls: document.querySelector('.it-stat')?.className, over: document.querySelectorAll('.it-c.over').length, txt: document.querySelector('.gx-items')?.innerText.replace(/\s+/g, ' ').slice(0, 200) }));
  await t.shot('run1-H2b-칸넘침-pc');
  await t.closeWindow();
  const r6 = await turn('T6', 'H6 주머니를 뒤진다', `에일린은 주머니를 뒤졌다.\n${st({ time: '11:40 AM' })}`, () => ({}));
  const inv6 = invBlock(r6.main);
  rec.actual('H2-b', slotVal === '8' && grid.over > 0 && /\[Inventory\] \d+\/8 \(over the limit\)/.test(inv6) && /carrying more than the limit/.test(inv6), { slotClicks, slotVal, addRes, grid, inv: inv6 }, { shot: 'out/run1-H2b-칸넘침-pc.png' });

  // ── H8 말이 되나 ──
  rec.expect('H8', '시작 소지품(권총·소총·방탄조끼)·소지 한도 30kg 가 카드 명부(카드/start-items.json 에일린, 카드/carry.json 에일린 30)와 같음', 'H-05 (사용자 결정: 명부 인물은 명부 carry)');
  const ss0 = (await invState(t)).ss;
  rec.actual('H8', ss0.$it_carry_pc === '30', { carry_pc: ss0.$it_carry_pc, start: '권총·소총·방탄조끼 (상태 파일 시작 목록, 카드/start-items.json 54~ 줄과 같음)' });

  writeFileSync(`${OUT}/run1-reqs.json`, JSON.stringify(reqs, null, 1));
  writeFileSync(`${OUT}/run1-final-state.json`, JSON.stringify((await invState(t)).ss, null, 1));
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run1-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run1-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
