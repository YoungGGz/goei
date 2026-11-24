// H 구간 run2: 가계부·상태창 잔고·칸 구성·포인트 자동·끄고 켜기·생각 블록 (코스 H-3·H-4, 결정표 H-01·H-02·H-16, 공통 갈래 「기능 끔」「생각 블록」) — PC 1280×800, S-요원플레이
import { goItems, boot, openItems, act, fText, toastText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, prevStatus, auxKind, updaterData, lastAsst, recorder, fake } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run2');
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
  reqs[tag] = { main: main.map((x) => ({ seq: x.seq, inv: invBlock(x.body), prev: prevStatus(x.body), statusRule: (x.body.messages ?? []).map((m) => String(m.content)).join('\n').match(/Fields in order: [^\n]+/)?.[0] ?? null })), upd: upd.map((x) => ({ seq: x.seq, wallet_now: updaterData(x.body)?.wallet_now, want: updaterData(x.body)?.want })) };
  return { main: main.at(-1)?.body, upd: upd.at(-1) ? updaterData(upd.at(-1).body) : null };
}
const fieldsOf = (body) => (body?.messages ?? []).map((m) => String(m.content)).join('\n').match(/Fields in order: ([^\n]+?)\. Never/)?.[1] ?? null;
const bal = async () => { const s = await invState(t); const w = s.wallet; const alive = new Set(s.s.message.map((m, i) => m.chatId ?? i)); return { start: w?.start, log: w?.log?.map((e) => `${e.src}:${e.amount}:${e.memo}`), sum: (w?.start ?? 0) + (w?.log ?? []).reduce((n, e) => n + e.amount, 0) }; };
const openSet = async (node) => { await act(t, 'ed-open', 'set:screen', { wait: 1500 }); await act(t, 'ed-node', node, { wait: 1200 }); };

try {
  // ── H3-a 상태창 잔고 맞추기 + 갱신기 거래 ──
  rec.expect('H3-a', '본문 「택시비로 3만 원」 + 상태창 잔고 110000 → 장부 합 −30,000 (상태창 맞춤 줄과 갱신기 거래가 두 번 빠지지 않음), 머리 잔고 ₩110,000', 'H-16·K(가계부) — 상태창 잔고 따르기 기본 켬 (코드 주석 2026-11-05 사용자)');
  const q1 = '에일린은 택시비로 3만 원을 냈다.';
  const r1 = await turn('W1', 'W1 택시를 탄다', `${q1}\n${st({ time: '10:00 AM', bal: 110000 })}`, (d) => ({ transactions: [{ amount: -30000, memo: '택시비', m: lastAsst(d)?.m, quote: q1 }] }));
  const b1 = await bal();
  await openItems(t, 'wallet');
  await t.shot('run2-H3a-가계부-pc');
  const wtx = await fText(t, '.gx-items');
  rec.actual('H3-a', b1.sum === 110000 && /₩ 110,000/.test(wtx), { b1, wallet_now: r1.upd?.wallet_now, want: r1.upd?.want, screen: wtx.slice(0, 300) }, { shot: 'out/run2-H3a-가계부-pc.png' });

  // ── H3-b 지우기·고치기 (잔고 직접 수정 기본 끔) ──
  rec.expect('H3-b', '잔고 직접 수정 끔(기본): 거래 ✕·잔고 연필 없음. 켜면 생김 → 거래 하나 지우기, 잔고를 200,000 으로 고치기 → 다음 본편 [Previous status] 잔고 200000', 'K(가계부) 코드 주석 「2026-10-27 사용자: 기본 끔」 — 결정표에 줄 없음(코드 주석 근거)');
  const before = { pen: await t.F().locator('[data-action="wallet-edit"]').count(), del: await t.F().locator('[data-action="wallet-del"]').count() };
  await openSet('set:items');
  const edOn = await act(t, 'set-wallet-edit', '1', { wait: 1000 });
  const recentClicks = [await act(t, 'set-wallet-recent', 'n:+', { wait: 500 }), await act(t, 'set-wallet-recent', 'n:+', { wait: 500 })];
  await act(t, 'ed-close', null, { wait: 800 });
  await goItems(t);
  await act(t, 'items-sub', 'wallet');
  const after = { pen: await t.F().locator('[data-action="wallet-edit"]:visible').count(), del: await t.F().locator('[data-action="wallet-del"]').count() };
  await t.shot('run2-H3b-수정켬-pc');
  // 갱신기 거래(택시비) 지우기
  const w0 = (await invState(t)).wallet;
  const taxi = w0.log.find((e) => e.memo === '택시비') ?? w0.log[0];
  const openR = taxi ? await act(t, 'wallet-open', taxi.id) : 'no-entry';
  const delR = taxi ? await act(t, 'wallet-del', taxi.id) : 'no-entry';
  const b2 = await bal();
  const penR = await act(t, 'wallet-edit');
  const hasAdj = await t.F().locator('[name="wt-adj"]').count();
  if (hasAdj) await t.F().locator('[name="wt-adj"]').fill('200000');
  const adjR = await act(t, 'wallet-adj');
  const b3 = await bal();
  await t.shot('run2-H3b-고친뒤-pc');
  await t.closeWindow();
  const r2 = await turn('W2', 'W2 사무실에 앉는다', `에일린은 사무실에 앉았다.\n${st({ time: '10:20 AM', bal: 200000 })}`, () => ({}));
  const p2 = prevStatus(r2.main);
  rec.actual('H3-b', before.pen === 0 && before.del === 0 && edOn === 'ok' && after.pen > 0 && b3.sum === 200000 && /200000/.test(p2 ?? ''), { before, after, openR, delR, penR, hasAdj, b2, adjR, b3, prev: p2?.slice(0, 600) });

  // ── H3-c 최근 거래 넘기기 ──
  rec.expect('H3-c', '설정 「최근 거래 줄 수」 2 → [Previous status] 아래 최근 거래 2줄(상태창 맞춤 줄은 뺌)', 'K(가계부) 설정 설명 글 — 결정표에 줄 없음');
  rec.actual('H3-c', /won/.test(p2 ?? '') || /수동|조정|adjust/i.test(p2 ?? ''), { recentClicks, prev: p2 });

  // ── H3-d 상태창 잔고 따르기 끔 ──
  rec.expect('H3-d', '「상태창 잔고 따르기」 끔 → 모델이 상태창 잔고를 999999 로 써도 장부 그대로(200,000), 다음 본편 [Previous status] 잔고는 장부 값 200000', 'H 코스 3, 코드 주석(WALLET_SYNC_VAR) — 결정표에 줄 없음');
  await openItems(t, 'wallet');
  await openSet('set:items');
  const syncOff = await act(t, 'set-wallet-sync', '0', { wait: 1000 });
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  await turn('W3', 'W3 커피를 마신다', `에일린은 커피를 마셨다.\n${st({ time: '10:40 AM', bal: 999999 })}`, () => ({}));
  const b4 = await bal();
  const r4 = await turn('W4', 'W4 서류를 본다', `에일린은 서류를 봤다.\n${st({ time: '11:00 AM', bal: 200000 })}`, () => ({}));
  const p4 = prevStatus(r4.main);
  rec.actual('H3-d', syncOff === 'ok' && b4.sum === 200000 && /\|200000\]/.test(p4 ?? '') && !/999999/.test(p4 ?? ''), { b4, prev: p4?.slice(0, 400) });

  // ── H3-e 생각 블록 안의 상태창 줄 ──
  rec.expect('H3-e', '따르기를 다시 켜고, 생각 글(reasoning → <Thoughts>)에만 잔고 1 짜리 상태창 줄, 본문엔 200000 → 장부는 본문 줄로(바뀌지 않음)', '공-21 (Claude 판정: 생각 블록 안 표식은 본문 표식이 아님)');
  await openItems(t, 'wallet');
  await openSet('set:items');
  await act(t, 'set-wallet-sync', '1', { wait: 1000 });
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  await turn('W5', 'W5 생각에 잠긴다', `에일린은 잠시 생각했다.\n${st({ time: '11:20 AM', bal: 200000 })}`, () => ({}), { reasoning: `상태 정리: ${st({ time: '11:20 AM', bal: 1 })}` });
  const b5 = await bal();
  const s5 = await invState(t);
  const last5 = s5.s.message.at(-1).data;
  rec.actual('H3-e', b5.sum === 200000, { b5, lastStart: last5.slice(0, 200) });
  // 본문 안 <think> 꼴
  rec.expect('H3-e2', '본문 속 <think>…</think> 안에만 잔고 5 상태창 줄, 본문 끝엔 200000 → 장부 그대로', '공-21 (Claude 판정)');
  await turn('W6', 'W6 다시 생각한다', `<think>${st({ time: '11:40 AM', bal: 5 })}</think>\n에일린은 다시 생각했다.\n${st({ time: '11:40 AM', bal: 200000 })}`, () => ({}));
  const b6 = await bal();
  rec.actual('H3-e2', b6.sum === 200000, { b6 });
  rec.expect('H3-e3', '생각 블록 안에만 상태창 줄이 있고 본문엔 없음(<think> 안 잔고 7) → 장부가 7 로 맞춰지지 않음', '공-21 (Claude 판정)');
  await turn('W7', 'W7 말없이 걷는다', `<think>${st({ time: '12:00 PM', bal: 7 })}</think>\n에일린은 말없이 걸었다.`, () => ({}));
  const b7 = await bal();
  rec.actual('H3-e3', b7.sum === 200000, { b7 });

  // ── H4-a 상태창 칸 구성 바꾸기 (잔고 칸 사용 안 함) ──
  rec.expect('H4-a', '설정 상태창 잔고 칸 「사용 안 함」 → 다음 본편 상태 칸 규칙에서 잔고 빠짐, 옛 응답의 상태창 상자는 옛 모양(잔고 칸 포함)으로 읽힘, 장부 그대로', 'H-02 「가계부 끄면 그때부터 잔고 칸만 빠짐」 (사용자 결정), 코스 H-4');
  await openItems(t);
  await openSet('set:status');
  const colOff = await act(t, 'set-col', 'wallet:use:0', { wait: 1000 });
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  const r8 = await turn('W8', 'W8 복도로 나간다', `에일린은 복도로 나갔다.\n[▣|2025.03.14|12:20 PM|☀️|12°C|서울 종로구 관리국 본부 복도|없음|쟈알디|없음|관리국/선임 요원]`, () => ({}));
  const f8 = fieldsOf(r8.main);
  const ss8 = (await invState(t)).ss;
  const cards = await t.page.evaluate(() => [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].map((e) => ({ idx: Number(e.dataset.chatIndex), cash: (e.querySelector('.gst-cash')?.innerText ?? null), status: (e.querySelector('.gst-top')?.closest('div:not(.gst-top)')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160) })).sort((a, b) => a.idx - b.idx));
  await t.shot('run2-H4a-잔고칸끔-채팅-pc');
  const b8 = await bal();
  rec.actual('H4-a', colOff === 'ok' && !!f8 && !/잔고|Balance|wallet/i.test(f8) && b8.sum === b7.sum, { fields: f8, colLog: ss8.$st_col_log, cards, b8 }, { shot: 'out/run2-H4a-잔고칸끔-채팅-pc.png' });
  // 되돌리기
  await openItems(t);
  await openSet('set:status');
  await act(t, 'set-col', 'wallet:use:1', { wait: 1000 });
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();

  // ── H4-b 포인트 칸 「자동」이 소속 따라 ──
  rec.expect('H4-b', '포인트 칸 「자동」(기본): 상태창 소속이 백일몽/사원 이 되면 $st_points_on 1 → 다음 본편 상태 칸에 포인트, 소지품 창에 포인트 탭. 다시 관리국이 되면 꺼짐(포인트 거래가 없으면 탭도 빠짐)', 'G-08 「상태창 칸은 백일몽일 때만」·E-10 (사용자 결정, 출처 표시 약함), 코스 H-4');
  await turn('W9', 'W9 백일몽으로 옮긴다', `에일린은 백일몽 주식회사로 자리를 옮겼다.\n${st({ time: '12:40 PM', bal: 200000, aff: '백일몽/사원' })}`, () => ({}));
  const pOn = (await invState(t)).ss.$st_points_on;
  await openItems(t);
  const tabs1 = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="items-sub"]')].map((e) => e.dataset.value));
  await t.shot('run2-H4b-포인트탭-pc');
  await t.closeWindow();
  const r10 = await turn('W10', 'W10 관리국으로 돌아간다', `에일린은 관리국으로 돌아왔다.\n${st({ time: '01:00 PM', bal: 200000, extra: '' })}`, () => ({}));
  const f10 = fieldsOf(r10.main);
  const pOff = (await invState(t)).ss.$st_points_on;
  await openItems(t);
  const tabs2 = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="items-sub"]')].map((e) => e.dataset.value));
  await t.closeWindow();
  rec.actual('H4-b', pOn === '1' && /포인트|Points/i.test(f10 ?? '') && tabs1.includes('points') && pOff === '0' && !tabs2.includes('points'), { pOn, fieldsAfterBm: f10, tabs1, pOff, tabs2 });

  // ── H-02 소지품 끔/켬 ──
  rec.expect('H6-off', '소지품 끔(사용에 구급상자 대신 권총 넣어 둔 채): 「다음 메시지에 사용」 비움, 다음 본편에 [Inventory] 없음, 목록은 그대로. 다시 켬 → 다음 본편 [Inventory] This turn 에 「item tracking was switched off for a while…」 한 줄, 그다음 턴엔 없음', 'H-02 (사용자 결정)');
  await openItems(t);
  await act(t, 'items-open', 'i_fj8jo8');
  await act(t, 'items-use', 'i_fj8jo8');
  await act(t, 'items-close');
  const useBefore = (await invState(t)).use;
  await openSet('set:items');
  const invOff = await act(t, 'set-inv-on', '0', { wait: 1200 });
  await act(t, 'ed-close', null, { wait: 800 });
  const menuItems = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="nav-tab"]')].map((e) => e.dataset.value));
  await t.shot('run2-H6off-메뉴-pc');
  const sOff = await invState(t);
  await t.closeWindow();
  const r11 = await turn('W11', 'W11 소지품 없이 걷는다', `에일린은 걸었다.\n${st({ time: '01:20 PM', bal: 200000 })}`, () => ({}));
  const inv11 = invBlock(r11.main);
  const upd11 = r11.upd;
  await openItems(t, 'wallet');
  await openSet('set:items');
  const invOn = await act(t, 'set-inv-on', '1', { wait: 1200 });
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  const r12 = await turn('W12', 'W12 소지품을 다시 본다', `에일린은 가방을 열었다.\n${st({ time: '01:40 PM', bal: 200000 })}`, () => ({}));
  const inv12 = invBlock(r12.main);
  const r13 = await turn('W13', 'W13 다음 일', `에일린은 다음 일을 했다.\n${st({ time: '02:00 PM', bal: 200000 })}`, () => ({}));
  const inv13 = invBlock(r13.main);
  rec.actual('H6-off', /i_fj8jo8/.test(useBefore ?? '') && invOff === 'ok' && !sOff.use && sOff.items?.list?.length >= 3 && !inv11 && /switched off for a while/.test(inv12 ?? '') && !/switched off/.test(inv13 ?? ''), { useBefore, useAfterOff: sOff.use, menuItems, inv11, updWantItems: upd11?.want?.items, items_now11: upd11?.items_now, inv12, inv13 });

  // ── H-02 가계부 끔 ──
  rec.expect('H6-woff', '가계부 끔(set-wallet-on 0) → 상태 칸 규칙에서 잔고 빠짐, 상점 스위치 잠김(상점 꺼짐), 소지품·물건은 그대로, 장부 기록 그대로', 'H-01·H-02 (사용자 결정)');
  await openItems(t);
  await openSet('set:items');
  const wOff = await act(t, 'set-wallet-on', '0', { wait: 1200 });
  await act(t, 'ed-node', 'set:shop', { wait: 1200 });
  const shopCtl = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="set-shop-on"]')].map((e) => ({ v: e.dataset.value, dis: e.disabled || e.hasAttribute('disabled') || e.getAttribute('aria-disabled') })));
  const shopTx = await fText(t, '.gx-ed, .gx');
  await t.shot('run2-H6woff-상점잠김-pc');
  await act(t, 'ed-close', null, { wait: 800 });
  const tabsW = await t.F().evaluate(() => [...document.querySelectorAll('[data-action="items-sub"]')].map((e) => e.dataset.value));
  await t.closeWindow();
  const r14 = await turn('W14', 'W14 가계부 없이', `에일린은 걸었다.\n[▣|2025.03.14|02:20 PM|☀️|12°C|서울 종로구 관리국 본부 사무실|없음|쟈알디|없음|관리국/선임 요원]`, () => ({}));
  const f14 = fieldsOf(r14.main);
  const b14 = await bal();
  rec.actual('H6-woff', wOff === 'ok' && !/잔고|Balance/i.test(f14 ?? '') && b14.sum === 200000 && !!invBlock(r14.main), { shopCtl, shopHint: (shopTx ?? '').match(/상점[^。]{0,120}/)?.[0], tabsW, fields: f14, b14, inv: invBlock(r14.main)?.slice(0, 200), wantTx: r14.upd?.want?.transactions });

  writeFileSync(`${OUT}/run2-reqs.json`, JSON.stringify(reqs, null, 1));
  writeFileSync(`${OUT}/run2-final-state.json`, JSON.stringify((await invState(t)).ss, null, 1));
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run2-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run2-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
