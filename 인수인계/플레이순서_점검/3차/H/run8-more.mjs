// H 구간 run8: 남은 소지품 설정 칸 — 장착 해제 표시어, 치운 물건 기억, 그리고 공통 갈래 「둘 이상 연달아 지우기」
// PC 1280×800, S-요원플레이
import { boot, openItems, act, fText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, auxKind, updaterData, lastAsst, recorder } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run8');
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
const itemsResp = (items) => (d) => ({ items: items.map((x) => ({ m: lastAsst(d)?.m ?? 'm1', ...x })) });
const fillChange = async (sel, v) => { const l = t.F().locator(sel).last(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.fill(v); await l.press('Tab'); await sleep(900); };
const openAdv = async () => { for (let i = 0; i < 6; i++) { const sm = t.F().locator('details.ps-adv:not([open]) > summary:visible').first(); if (!(await sm.count())) break; await sm.scrollIntoViewIfNeeded().catch(() => {}); await sm.click({ timeout: 4000 }).catch(() => {}); await sleep(500); } };
const openSet = async () => { await openItems(t); await act(t, 'ed-open', 'set:screen', { wait: 1500 }); await act(t, 'ed-node', 'set:items', { wait: 1200 }); await openAdv(); };
const closeSet = async () => { await act(t, 'ed-close', null, { wait: 800 }); await t.closeWindow(); };
const aliveOf = (s) => new Set(s.s.message.map((m, i) => (typeof m.chatId === 'string' && m.chatId ? m.chatId : `#${i + 1}`)));
const shown = (s) => { const a = aliveOf(s); return s.items.list.filter((e) => (!e.anchor || a.has(e.anchor)) && !e.outHow).map((e) => e.name); };

try {
  // ── 장착 해제 표시어 ──
  rec.expect('H6-off', '장착 해제 표시어에 「집어넣」 더함 → 갱신기가 update 로 권총 설명만 「권총집에 집어넣음」으로 바꾸면 손 칸에서 빠져 가방으로(목록엔 남음). 기본 말에 없는 말이라 더하기 전엔 그대로 손', '코스 H-6 (설정 설명 글 「장착 해제 표시어」)');
  const q1 = '에일린은 권총을 권총집에 집어넣었다.';
  await turn('O1', 'O1 집어넣기 전', `${q1}\n${st({ time: '10:00 AM' })}`, itemsResp([{ name: '권총', action: 'update', desc: '권총집에 집어넣음', quote: q1 }]));
  const s1 = await invState(t);
  const before = itemNames(s1.items);
  await openSet();
  await fillChange('[data-change="set-items-off-words"]', '벗어, 벗고, 내려놓, 풀어, 집어넣');
  const offVar = (await invState(t)).ss.$it_off_words;
  await closeSet();
  const q2 = '에일린은 소총을 가방에 집어넣었다.';
  await turn('O2', 'O2 집어넣기 뒤', `${q2}\n${st({ time: '10:20 AM' })}`, itemsResp([{ name: '소총', action: 'update', desc: '가방에 집어넣음', quote: q2 }]));
  const s2 = await invState(t);
  const after = itemNames(s2.items);
  rec.actual('H6-off', before.includes('권총@weapon0') && !after.some((x) => x.startsWith('소총@')) && after.includes('소총'), { before, offVar, after });

  // ── 치운 물건 기억 ──
  rec.expect('H6-away', '「치운 물건 기억」 1턴 → 방탄조끼를 두고 온(left) 다음 턴엔 갱신기 items_away 에 있고, 2턴 지나면 items_away 와 목록에서 빠짐(기록 줄은 남음)', 'H-15 (Claude 판정: 치운 물건 기억 30턴 기본, 설정 수)');
  await openSet();
  for (let i = 0; i < 40; i++) { const v = await t.F().evaluate(() => document.querySelector('[data-change="set-items-away-turns"]')?.value ?? null); if (v === '1') break; if ((await act(t, 'set-items-away-turns', 'n:-', { wait: 150 })) !== 'ok') break; }
  const awayVar = (await invState(t)).ss.$it_away_turns;
  await closeSet();
  const q3 = '에일린은 방탄조끼를 사물함에 두고 나왔다.';
  await turn('A1', 'A1 조끼 두고 옴', `${q3}\n${st({ time: '10:40 AM' })}`, itemsResp([{ name: '방탄조끼', action: 'left', place: '사물함', quote: q3 }]));
  const d2 = await turn('A2', 'A2 한 턴 뒤', `에일린은 복도를 걸었다.\n${st({ time: '11:00 AM' })}`);
  const d3 = await turn('A3', 'A3 두 턴 뒤', `에일린은 계단을 내려갔다.\n${st({ time: '11:20 AM' })}`);
  const d4 = await turn('A4', 'A4 세 턴 뒤', `에일린은 로비에 섰다.\n${st({ time: '11:40 AM' })}`);
  const s4 = await invState(t);
  rec.actual('H6-away', awayVar === '1' && (d2?.items_away ?? []).some((x) => x.name === '방탄조끼') && !(d4?.items_away ?? []).some((x) => x.name === '방탄조끼') && !s4.items.list.some((e) => e.name === '방탄조끼'), { awayVar, away2: d2?.items_away, away3: d3?.items_away, away4: d4?.items_away, listEnd: itemNames(s4.items), logVest: s4.items.log.filter((l) => l.name === '방탄조끼').map((l) => l.what) });

  // ── 둘 이상 연달아 지우기 ──
  rec.expect('B-del2', '물건을 얻은 응답 둘(손전등, 라이터)을 끝에서부터 연달아 지우면 둘 다 목록에서 빠짐(소지품은 응답마다 기준 응답으로 묶여 있어 되돌아감). 상황판의 「마지막 하나만」 한계(공-23)가 소지품에도 있는지 기록', '공-02 (Claude 판정: 지운 응답이 만든 것은 되돌아감), 공-23 (알고 넘긴 한계: 상황판)');
  const q5 = '에일린은 서랍에서 손전등을 꺼냈다.';
  await turn('D1', 'D1 손전등', `${q5}\n${st({ time: '12:00 PM' })}`, itemsResp([{ name: '손전등', action: 'new', desc: '작은 손전등', usable: true, uses: null, equip: 'hand', equipped: false, icon: 'tool/손전등/flashlight', weight: 0.2, quote: q5 }]));
  const q6 = '에일린은 책상 위 라이터를 주머니에 넣었다.';
  await turn('D2', 'D2 라이터', `${q6}\n${st({ time: '12:20 PM' })}`, itemsResp([{ name: '라이터', action: 'new', desc: '은색 라이터', usable: true, uses: null, equip: 'none', icon: 'tool/라이터/lighter', weight: 0.05, quote: q6 }]));
  const s5 = await invState(t);
  const n = s5.s.message.length;
  await t.deleteMessage(n - 1); await sleep(1200); // 라이터 응답
  await t.deleteMessage(n - 2); await sleep(1200); // D2 내 말
  await t.deleteMessage(n - 3); await sleep(1500); // 손전등 응답
  const s6 = await invState(t);
  await openItems(t);
  const grid = await fText(t, '.gx-items');
  await t.shot('run8-연달아지운뒤-pc');
  await t.closeWindow();
  rec.actual('B-del2', !shown(s6).includes('손전등') && !shown(s6).includes('라이터') && !/손전등|라이터/.test(grid ?? ''), { shownBefore: shown(s5), shownAfter: shown(s6), last: s6.s.message.slice(-2).map((m) => `${m.role}:${m.data.slice(0, 24)}`), grid: grid?.slice(0, 200) });
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run8-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run8-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
