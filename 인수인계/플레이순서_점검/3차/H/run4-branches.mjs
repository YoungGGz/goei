// H 구간 run4: 공통 갈래 (코스 5장) — 다시 굴리기·◀▶·지우고 다시 보내기·가운데 지우기·이어 쓰기·메시지 고치기·다른 채팅·답 오는 중 번호 밀기·새로고침·본편 실패
// PC 1280×800, S-요원플레이. 결정표 공-01·공-02·H-17b·H-18
import { boot, openItems, act, fText, toastText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, prevStatus, auxKind, updaterData, lastAsst, recorder, fake } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run4');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json' });
const reqs = {};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const waitUpd = async (s0) => { for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); } await sleep(1500); };
const collect = async (tag, s0) => {
  const log = await logSince(s0);
  const main = log.filter((x) => x.route === 'main');
  const upd = log.filter((x) => x.route === 'aux' && auxKind(x.body) === 'updater');
  reqs[tag] = { main: main.map((x) => ({ seq: x.seq, dupOf: x.dupOf, status: x.response?.status, inv: invBlock(x.body) })), upd: upd.map((x) => { const d = updaterData(x.body); return { seq: x.seq, items_now: d?.items_now, used_now: d?.used_now }; }) };
  return { main: main.at(-1)?.body, mains: main, upd: upd.at(-1) ? updaterData(upd.at(-1).body) : null };
};
async function turn(tag, text, reply, updFn, more = {}) {
  const s0 = await seqNow();
  await mainRule('m-' + tag, esc(text), reply, more);
  if (updFn) u.push(updFn);
  await t.send(text);
  await waitUpd(s0);
  return collect(tag, s0);
}
const itemsResp = (items) => (d) => ({ items: items.map((x) => ({ m: lastAsst(d)?.m ?? 'm1', ...x })) });
const aliveOf = (s) => new Set(s.s.message.map((m, i) => (typeof m.chatId === 'string' && m.chatId ? m.chatId : `#${i + 1}`)));
const leftOf = (s, name) => { const e = s.items?.list.find((x) => x.name === name && !x.outHow && !x.mergedInto); if (!e) return null; const alive = aliveOf(s); const logs = s.items.log.filter((l) => l.item === e.id && l.what === 'use'); const used = logs.filter((l) => !l.anchor || alive.has(l.anchor)).reduce((n, l) => n + (l.n ?? 1), 0); return { uses: e.uses, usedLogs: logs.map((l) => `${l.anchor.slice(0, 8)}×${l.n ?? 1}${alive.has(l.anchor) ? '' : '(dead)'}`), left: (e.uses ?? 0) - used }; };
const chatRaw = (id) => t.R(async (id) => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); const ch = c.chats.find((x) => x.id === id); if (!ch) return null; const ss = ch.scriptstate ?? {}; return { idx: c.chats.indexOf(ch), page: c.chatPage, msgs: ch.message.map((m) => `${m.role}:${m.data.slice(0, 30)}`), items: ss.$st_items ?? null, use: ss.$st_item_use ?? null, useAt: ss.$st_item_use_at ?? null, wallet: ss.$st_wallet ?? null }; }, id);
const curChatId = () => t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return c.chats[c.chatPage]?.id ?? null; });
const chip = () => t.page.evaluate(() => { const slot = document.querySelector('.chat-message-container:first-child [data-goei-card="use"]'); const lastRole = document.querySelector('.chat-message-container:first-child')?.innerText?.slice(0, 30) ?? null; const css = [...document.querySelectorAll('style')].map((s) => s.textContent).filter((x) => x.includes('data-gu-label')).join('\n'); return { slotInLast: !!slot, slotShown: slot ? getComputedStyle(slot).display !== 'none' : false, lastTxt: lastRole, label: /\[data-gu-label\]::before \{ content: "([^"]+)"/.exec(css)?.[1] ?? null, names: [...css.matchAll(/\[data-gu="\d+"\]::before \{ content: "([^"]+)"/g)].map((m) => m[1]) }; });
const useItem = async (name) => { await openItems(t); const id = (await invState(t)).items?.list.find((e) => e.name === name && !e.outHow)?.id; await act(t, 'items-open', id); const r = await act(t, 'items-use', id); const msg = await toastText(t); await act(t, 'items-close'); await t.closeWindow(); return { r, msg }; };
const addManual = async (name, uses, weight = '0.2') => { await openItems(t); await act(t, 'items-add'); await t.F().locator('[name="name"]').fill(name); if (uses) await t.F().locator('[name="uses"]').fill(String(uses)); await t.F().locator('[name="weight"]').fill(weight); const r = await act(t, 'items-save', ''); await t.closeWindow(); return r; };

try {
  // 준비: 직접 넣기 둘 (구급약 3회, 빈 꿈결 수집기)
  const add1 = await addManual('구급약', 9);
  const add2 = await addManual('빈 꿈결 수집기', 0, '0.3');
  rec.expect('준비', '직접 넣기로 구급약(9회)·빈 꿈결 수집기가 들어감', 'H-08');
  rec.actual('준비', add1 === 'ok' && add2 === 'ok', itemNames((await invState(t)).items));

  // ── 다시 굴리기: 고장·설명·장착·꿈결 수집기·사용 ──
  rec.expect('B-reroll', '사용(구급약) 싣고 보낸 답에서 갱신기가 권총 손상·설명 바꿈, 방탄조끼 벗음, 꿈결 수집기 참 → 다시 굴리기(갱신기 빈 답) → 권총 멀쩡·옛 설명, 방탄조끼 다시 장비 칸, 수집기 「빈 꿈결 수집기」로, 구급약 사용은 한 번만(남은 8), 다시 굴린 요청에도 uses 구급약 (8 left after this)', 'H-18 (Claude 판정, 0.21.34)·H-17b·공-01 (사용자 결정)');
  const u1 = await useItem('구급약');
  const q1 = '총격 끝에 권총 총열에 금이 갔다. 에일린은 방탄조끼를 벗었다. 꿈결 수집기에 푸른 꿈결이 가득 찼다.';
  const r1 = await turn('R1', 'R1 총격전', `${q1}\n${st({ time: '10:00 AM' })}`, itemsResp([
    { name: '권총', action: 'update', desc: '총열에 금이 감', condition: 'damaged', quote: q1 },
    { name: '방탄조끼', action: 'unequip', quote: q1 },
    { name: '가득 찬 꿈결 수집기', action: 'new', desc: '푸른 꿈결이 가득 참', usable: true, uses: null, equip: 'none', icon: 'device/꿈결 수집기/dream collector', weight: 0.3, quote: q1 },
  ]));
  const sA = await invState(t);
  const before = { list: itemNames(sA.items), pistol: sA.items.list.find((e) => e.name === '권총'), kit: leftOf(sA, '구급약') };
  const s0 = await seqNow();
  await mainRule('m-R1b', esc('R1 총격전'), `총격은 싱겁게 끝났다.\n${st({ time: '10:00 AM' })}`);
  await fake('rules/del', { id: 'm-R1' });
  u.push(() => ({}));
  await t.reroll();
  await waitUpd(s0);
  const rr = await collect('R1-reroll', s0);
  const sB = await invState(t);
  const after = { list: itemNames(sB.items), pistol: sB.items.list.find((e) => e.name === '권총'), kit: leftOf(sB, '구급약') };
  await openItems(t);
  await t.shot('run4-reroll-뒤-pc');
  await t.closeWindow();
  rec.actual('B-reroll', after.pistol?.state === 'ok' && /홀스터/.test(after.pistol?.desc ?? '') && after.list.includes('방탄조끼@gear0') && after.list.some((x) => x.startsWith('빈 꿈결 수집기')) && after.kit?.left === 8 && /uses 구급약 \(8 left after this\)/.test(invBlock(rr.main) ?? ''), { u1, before, after, rerollInv: invBlock(rr.main)?.match(/This turn:[^\n]*/)?.[0], firstInv: invBlock(r1.main)?.match(/This turn:[^\n]*/)?.[0] });

  // ── ◀▶ 오가기 ──
  rec.expect('B-swipe', '◀ 로 첫 답(권총 금 간 글)을 보면: 리스AI 가 글만 바꿈(요청 0건). 플러그인 상태는 다시 굴린 답 기준 그대로인지, 화면 글과 갈리는지 기록. ▶ 로 돌아오면 다시 굴린 답', '공-02 (되돌림 세부는 Claude 판정), 코스 5장 「◀▶ 오가기」(코드에서 짚은 자리: 화면 답과 플러그인 상태가 갈림)');
  const sq = await seqNow();
  await t.swipePrev();
  await sleep(1500);
  const sC = await invState(t);
  const swipeReqs = (await logSince(sq)).map((x) => `${x.route}:${auxKind(x.body)}`);
  const lastTxt = sC.s.message.at(-1).data.slice(0, 60);
  await openItems(t);
  const gridPrev = await fText(t, '.gx-items');
  await t.shot('run4-swipe-앞답-pc');
  await t.closeWindow();
  await t.swipeNext({ wait: false });
  await sleep(1500);
  const sD = await invState(t);
  rec.actual('B-swipe', null, { swipeReqs, lastTxtPrev: lastTxt, listPrev: itemNames(sC.items), pistolPrev: sC.items.list.find((e) => e.name === '권총')?.state, kitPrev: leftOf(sC, '구급약'), gridPrev: gridPrev?.slice(0, 200), lastTxtNext: sD.s.message.at(-1).data.slice(0, 60), listNext: itemNames(sD.items), kitNext: leftOf(sD, '구급약') });

  // ── 마지막 응답 지우고 새로 보내기 (사용 걸어 둔 채) ──
  rec.expect('B-delresend', '구급약 사용을 걸고 보낸 뒤 그 답을 지우면 칩이 다시 「다음 메시지에 사용」으로 보이고, 새 말을 보내면 그 요청에 uses 구급약 이 실리고 횟수는 한 번만 빠짐', 'H-17b (Claude 판정, 0.21.34)');
  const k0 = leftOf(await invState(t), '구급약');
  await useItem('구급약');
  await turn('R2', 'R2 응급처치', `에일린은 구급약을 발랐다.\n${st({ time: '10:20 AM' })}`, () => ({}));
  const k1 = leftOf(await invState(t), '구급약');
  const n = (await invState(t)).s.message.length;
  await t.deleteMessage(n - 1);
  await sleep(1200);
  const k2 = leftOf(await invState(t), '구급약');
  const chipAfterDel = await chip();
  await sleep(3000);
  const chipAfterDel2 = await chip();
  const varsAfterDel = await invState(t);
  await t.shot('run4-지운뒤-칩-pc');
  await openItems(t);
  const winAfterDel = await fText(t, '.gx-items');
  await t.shot('run4-지운뒤-창-pc');
  await t.closeWindow();
  const r3 = await turn('R3', 'R3 다시 처치', `에일린은 다시 구급약을 발랐다.\n${st({ time: '10:20 AM' })}`, () => ({}));
  const k3 = leftOf(await invState(t), '구급약');
  rec.actual('B-delresend', k1.left === k0.left - 1 && k2.left === k0.left && (chipAfterDel2.slotShown && chipAfterDel2.label === '다음 메시지에 사용') && /uses 구급약/.test(invBlock(r3.main) ?? '') && k3.left === k0.left - 1, { k0, k1, k2, chipAfterDel, chipAfterDel2, use: varsAfterDel.use, useAt: varsAfterDel.useAt, lastMsgs: varsAfterDel.s.message.slice(-2).map((m) => `${m.role}:${m.data.slice(0, 20)}`), win: winAfterDel?.slice(0, 260), k3, inv: invBlock(r3.main)?.match(/This turn:[^\n]*/)?.[0] });

  // ── 가운데 응답 지우기 / 내 말만 지우기 ──
  rec.expect('B-delmid', '열쇠를 얻은 응답(가운데)을 지우면 열쇠가 목록에서 빠짐(기준 응답이 사라짐), 그 뒤 응답의 물건·사용은 그대로. 내 말만 지우면 물건 변화 없음', '공-02 (Claude 판정: 지운 응답이 만든 것은 되돌아감), 공-23 (둘 이상 연달아는 알고 넘긴 한계 — 상황판 이야기)');
  const q4 = '에일린은 책상 서랍에서 사물함 열쇠를 꺼냈다.';
  await turn('R4', 'R4 서랍', `${q4}\n${st({ time: '10:40 AM' })}`, itemsResp([{ name: '사물함 열쇠', action: 'new', desc: '작은 쇠 열쇠', usable: true, uses: null, equip: 'none', icon: 'tool/열쇠/key', weight: 0.02, quote: q4 }]));
  const q5 = '에일린은 자판기에서 캔커피를 뽑았다.';
  await turn('R5', 'R5 자판기', `${q5}\n${st({ time: '11:00 AM' })}`, itemsResp([{ name: '캔커피', action: 'new', desc: '따뜻한 캔커피', usable: true, uses: 1, equip: 'none', icon: 'food/커피/coffee', weight: 0.3, quote: q5 }]));
  const sE = await invState(t);
  const msgs = sE.s.message;
  const midIdx = msgs.length - 3; // R4 응답 (…, user R4, char R4, user R5, char R5)
  const midTxt = msgs[midIdx].data.slice(0, 40);
  await t.deleteMessage(midIdx);
  await sleep(1500);
  const sF = await invState(t);
  const userIdx = sF.s.message.length - 2; // R5 내 말
  const userTxt = sF.s.message[userIdx].data.slice(0, 30);
  await t.deleteMessage(userIdx);
  await sleep(1500);
  const sG = await invState(t);
  rec.actual('B-delmid', !sF.items.list.some((e) => e.name === '사물함 열쇠' && sF.s.message.some((m) => m.chatId === e.anchor)) && itemNames(sF.items).some((x) => x.startsWith('캔커피')) && itemNames(sG.items).some((x) => x.startsWith('캔커피')), { midTxt, listAfterMid: itemNames(sF.items), keyRow: sF.items.list.find((e) => e.name === '사물함 열쇠'), userTxt, listAfterUser: itemNames(sG.items), msgsAfter: sG.s.message.length });
  await openItems(t);
  await t.shot('run4-가운데지운뒤-pc');
  const gridMid = await fText(t, '.gx-items');
  await t.closeWindow();
  rec.actual('B-delmid-화면', !/사물함 열쇠/.test(gridMid ?? ''), { grid: gridMid?.slice(0, 300) });

  // ── 이어 쓰기 ──
  rec.expect('B-cont', '구급약 사용을 싣고 보낸 답을 이어 쓰기 → 이어 쓰기 요청에 uses 구급약 이 다시 안 실림, 횟수는 한 번만 빠짐', 'H-17b (Claude 판정), 코드 주석 useCarried(11-14 재검토)');
  const c0 = leftOf(await invState(t), '구급약');
  await useItem('구급약');
  await turn('R6', 'R6 붕대질', `에일린은 상처에 구급약을 발랐다.\n${st({ time: '11:20 AM' })}`, () => ({}));
  const c1 = leftOf(await invState(t), '구급약');
  const sc = await seqNow();
  await mainRule('m-cont', '.', ` 그리고 숨을 돌렸다.\n${st({ time: '11:30 AM' })}`, { match: 'Continue the last response' });
  u.push(() => ({}));
  let contErr = null;
  try { await t.continueReply(); } catch (e) { contErr = String(e.message).slice(0, 120); }
  await waitUpd(sc);
  const rc = await collect('R6-cont', sc);
  await fake('rules/del', { id: 'm-cont' });
  const c2 = leftOf(await invState(t), '구급약');
  rec.actual('B-cont', !contErr && c1.left === c0.left - 1 && c2.left === c1.left && !/uses 구급약/.test(invBlock(rc.main) ?? ''), { contErr, c0, c1, c2, contInv: invBlock(rc.main)?.match(/This turn:[^\n]*/)?.[0] ?? null, nMain: rc.mains.length, lastMsg: (await invState(t)).s.message.at(-1).data.slice(0, 80) });

  // ── 리스AI 에서 메시지 직접 고치기 ──
  rec.expect('B-edit', '마지막 답의 상태창 잔고를 연필로 90000 으로 고침 → 플러그인 장부가 따라가는지(처리 코드 없음이라 그대로일 것) 기록. 다음 본편 [Previous status] 잔고 값 기록', '코스 5장 「메시지 직접 고치기」(코드에서 짚은 자리: 처리 코드 못 찾음) — 결정표 줄 없음');
  const sH = await invState(t);
  const li = sH.s.message.length - 1;
  const edited = sH.s.message[li].data.replace(/\|140000\]/, '|90000]');
  let editErr = null;
  try { await t.editMessage(li, edited); } catch (e) { editErr = String(e.message).slice(0, 120); }
  await sleep(1500);
  const wE = (await invState(t)).wallet;
  const r7 = await turn('R7', 'R7 고친 뒤', `에일린은 고개를 들었다.\n${st({ time: '11:40 AM', bal: 90000 })}`, () => ({}));
  const prev7 = prevStatus(r7.main);
  const wE2 = (await invState(t)).wallet;
  rec.actual('B-edit', null, { editErr, walletAfterEdit: wE, prevStatus: prev7?.match(/\[▣[^\n]*\]/)?.[0] ?? prev7?.slice(0, 200), walletAfterNext: wE2 });

  // ── 다른 채팅 다녀오기 ──
  rec.expect('B-otherchat', '구급약 사용을 걸어 둔 채 새 채팅을 열었다가(번호 +1 밀림) 원래 채팅으로 돌아오면: 소지품·사용 자리 그대로, 새 채팅 창은 시작 화면(소지품 섞이지 않음)', '코스 5장 「다른 채팅 다녀오기」(저장 열쇠: 채팅 번호), 공-02');
  await useItem('구급약');
  const useBefore = (await invState(t)).use;
  const listBefore = itemNames((await invState(t)).items);
  const origId = await curChatId();
  await t.newChat();
  await t.openWindow('.gx');
  await sleep(1500);
  const newWin = (await fText(t))?.slice(0, 120);
  await t.closeWindow();
  const newState = await invState(t);
  await t.switchChat(origId);
  await sleep(1500);
  const back = await invState(t);
  await openItems(t);
  const gridBack = await fText(t, '.gx-items');
  await t.closeWindow();
  const chipBack = await chip();
  rec.actual('B-otherchat', back.use === useBefore && JSON.stringify(itemNames(back.items)) === JSON.stringify(listBefore) && !newState.items?.list?.length && chipBack.names.some((x) => /구급약/.test(x)), { useBefore, useBack: back.use, newWin, newItems: newState.items, chipBack, gridBack: gridBack?.slice(0, 160) });

  // ── 새로고침 (저장 뒤 / 바로) ──
  rec.expect('B-reload', '사용을 걸어 둔 채 새로고침(저장 끝난 뒤) → 사용 자리·칩 그대로. 버리기 직후 바로 새로고침 → 버린 것이 남는지 기록', '코스 5장 「작업 중 새로고침」');
  await t.reload({ settle: true });
  await sleep(2500);
  const rl = await invState(t);
  const chipRl = await chip();
  await openItems(t);
  const coffee = rl.items.list.find((e) => e.name === '캔커피' && !e.outHow)?.id;
  await act(t, 'items-open', coffee);
  await act(t, 'items-drop-ask', coffee);
  const dropR = await act(t, 'items-drop', coffee, { wait: 100 });
  await t.reload({ settle: false });
  await sleep(3000);
  const rl2 = await invState(t);
  rec.actual('B-reload', rl.use === useBefore && chipRl.names.some((x) => /구급약/.test(x)), { useAfterReload: rl.use, chipRl, dropR, coffeeAfterQuickReload: rl2.items.list.find((e) => e.name === '캔커피') });

  // ── 답 오는 중 다른 채팅 + 번호 밀기 ──
  rec.expect('B-busyswitch', '구급약 사용을 싣고 보낸 뒤 답을 기다리는 동안 새 채팅을 만들어(번호 +1 밀림) 그 채팅을 보고 있다가 답이 오면: 사용 기록·답은 원래 채팅에 붙고 새 채팅엔 아무것도 안 생김. 리스AI 자신도 시작 때 번호로 답을 쓰므로 리스AI 쪽 동작과 가른다', '코스 5장 「답 오는 중 다른 채팅 + 번호 밀기」, 공-02');
  const k5 = leftOf(await invState(t), '구급약');
  const sb = await seqNow();
  await mainRule('m-R8', esc('R8 기다리는 중'), `에일린은 기다렸다.\n${st({ time: '12:00 PM' })}`, { hold: true });
  u.push(() => ({}));
  await t.send('R8 기다리는 중', { wait: false });
  for (let i = 0; i < 40; i++) { const p = await fake('pending'); if (p.some((x) => x.route === 'main')) break; await sleep(300); }
  await t.newChat();
  await sleep(1000);
  await fake('release', {});
  await sleep(6000);
  await waitUpd(sb);
  const viewNew = await invState(t);
  const chats = viewNew.s.chats;
  const others = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return c.chats.map((ch, i) => ({ i, id: ch.id, name: ch.name, n: ch.message.length, last: ch.message.at(-1) ? `${ch.message.at(-1).role}:${ch.message.at(-1).data.slice(0, 24)}` : null, hasItems: !!ch.scriptstate?.$st_items, use: ch.scriptstate?.$st_item_use ?? null })); });
  const origRaw = await chatRaw(origId);
  await t.switchChat(origId);
  await sleep(1500);
  const orig = await invState(t);
  const k6 = leftOf(orig, '구급약');
  rec.actual('B-busyswitch', null, { others, origRaw: { ...origRaw, items: undefined }, chats, newChatMsgs: viewNew.s.message.map((m) => `${m.role}:${m.data.slice(0, 30)}`), newChatItems: viewNew.items, origLast: orig.s.message.slice(-2).map((m) => `${m.role}:${m.data.slice(0, 40)}`), k5, k6, useAt: orig.useAt, use: orig.use });

  // ── 본편 요청 실패·리스AI 자동 재시도 ──
  rec.expect('B-fail', '사용을 걸고 보낸 본편이 503(처음 1번) → 리스AI 가 다시 보내면(또는 사용자가 다시 보내면) [Inventory] uses 가 그대로 한 번 실리고, 횟수는 한 번만 빠짐. 리스AI 자동 재시도 여부 기록', '코스 5장 「본편 요청 실패·자동 재시도」, H-17b');
  await useItem('구급약');
  const k7 = leftOf(await invState(t), '구급약');
  const sf = await seqNow();
  await mainRule('m-R9', esc('R9 실패 시험'), `에일린은 약을 발랐다.\n${st({ time: '12:20 PM' })}`, { status: 503, failFirst: 1 });
  u.push(() => ({}));
  await t.send('R9 실패 시험');
  await sleep(4000);
  let rf = await collect('R9', sf);
  const afterFail = await invState(t);
  const alertsF = (await t.alerts()).slice(-3);
  let resend = 'none';
  if (rf.mains.length < 2) {
    // 리스AI 가 자동으로 다시 보내지 않았으면 사용자가 다시 굴리기(▶)로 다시 보냄
    try { await t.reroll(); resend = 'reroll'; } catch (e) { resend = 'reroll-err:' + String(e.message).slice(0, 80); }
    await waitUpd(sf);
    rf = await collect('R9', sf);
  }
  const k8 = leftOf(await invState(t), '구급약');
  rec.actual('B-fail', null, { k7, k8, mains: rf.mains.map((x) => ({ seq: x.seq, status: x.response?.status, dupOf: x.dupOf, uses: invBlock(x.body)?.match(/This turn:[^\n]*/)?.[0] ?? null })), resend, alertsF, msgsAfterFail: afterFail.s.message.slice(-2).map((m) => `${m.role}:${m.data.slice(0, 40)}`), chip: await chip() });

  writeFileSync(`${OUT}/run4-reqs.json`, JSON.stringify(reqs, null, 1));
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run4-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run4-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
