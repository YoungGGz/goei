// H 구간 run9: 그림 대체 말 · 다른 봇 채팅 · 답 오는 중 채팅 지우기/가져오기로 번호 밀기
// PC 1280×800, S-요원플레이
import { boot, openItems, act, fText, invState, itemNames, sleep, OUT, STATES, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, auxKind, recorder, fake } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run9');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json' });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const openAdv = async () => { for (let i = 0; i < 8; i++) { const sm = t.F().locator('details.ps-adv:not([open]) > summary:visible').first(); if (!(await sm.count())) break; await sm.scrollIntoViewIfNeeded().catch(() => {}); await sm.click({ timeout: 4000 }).catch(() => {}); await sleep(500); } };
const fillLast = async (sel, v) => { const l = t.F().locator(sel).last(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.fill(v); await l.press('Tab'); await sleep(900); };
const addManual = async (name, uses) => { await openItems(t); await act(t, 'items-add'); await t.F().locator('[name="name"]').fill(name); if (uses) await t.F().locator('[name="uses"]').fill(String(uses)); await t.F().locator('[name="weight"]').fill('0.3'); const r = await act(t, 'items-save', ''); await t.closeWindow(); return r; };
const useItem = async (name) => { await openItems(t); const id = (await invState(t)).items?.list.find((e) => e.name === name && !e.outHow)?.id; await act(t, 'items-open', id); const r = await act(t, 'items-use', id); await act(t, 'items-close'); await t.closeWindow(); return r; };
const aliveOf = (s) => new Set(s.s.message.map((m, i) => (typeof m.chatId === 'string' && m.chatId ? m.chatId : `#${i + 1}`)));
const leftOf = (s, name) => { const e = s.items?.list.find((x) => x.name === name && !x.outHow); if (!e) return null; const a = aliveOf(s); return (e.uses ?? 0) - s.items.log.filter((l) => l.item === e.id && l.what === 'use' && (!l.anchor || a.has(l.anchor))).reduce((n, l) => n + (l.n ?? 1), 0); };
const curChatId = () => t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return c.chats[c.chatPage]?.id ?? null; });
const chatsInfo = () => t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return { page: c.chatPage, chats: c.chats.map((ch, i) => ({ i, id: ch.id, name: ch.name, n: ch.message.length, last: ch.message.at(-1) ? `${ch.message.at(-1).role}:${ch.message.at(-1).data.slice(0, 24)}` : null, use: ch.scriptstate?.$st_item_use ?? null, useAt: ch.scriptstate?.$st_item_use_at ?? null, items: ch.scriptstate?.$st_items ? JSON.parse(ch.scriptstate.$st_items).list.length : null })) }; });

try {
  // ── 그림 대체 말 ──
  rec.expect('H6-alias', '직접 넣은 「손풍금」은 그림 표에 없어 기본 상자 그림. 그림 대체 말에 「손풍금 → 우산」을 더하면 같은 물건이 우산 그림으로 바뀜(이름·자료는 그대로)', '코스 H-6 (설정 설명 글 「그림 대체 말」)');
  await addManual('손풍금', 0);
  await openItems(t);
  const picOf = () => t.F().evaluate(() => { const b = [...document.querySelectorAll('[data-action="items-open"]')].find((e) => e.getAttribute('aria-label')?.startsWith('손풍금')); return b ? (b.querySelector('img')?.getAttribute('src') ?? 'svg:' + (b.querySelector('svg') ? 'box' : 'none')) : null; });
  const pic0 = await picOf();
  await t.shot('run9-대체말-전-pc');
  await act(t, 'ed-open', 'set:screen', { wait: 1500 });
  await act(t, 'ed-node', 'set:items', { wait: 1200 });
  await openAdv();
  const aa = await act(t, 'set-items-alias-add');
  await openAdv();
  await fillLast('[data-change="set-items-alias-cell"][data-key$=":a"]', '손풍금');
  await fillLast('[data-change="set-items-alias-cell"][data-key$=":b"]', '우산');
  const aliasVar = (await invState(t)).ss.$it_icon_alias ?? null;
  await t.shot('run9-대체말-설정-pc');
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  await openItems(t);
  const pic1 = await picOf();
  await t.shot('run9-대체말-뒤-pc');
  await t.closeWindow();
  const row = (await invState(t)).items.list.find((e) => e.name === '손풍금');
  rec.actual('H6-alias', aa === 'ok' && pic0 !== pic1 && /우산|umbrella|asset|blob|data:/i.test(String(pic1)), { pic0: String(pic0).slice(0, 120), pic1: String(pic1).slice(0, 120), aliasTail: String(aliasVar ?? '').slice(-80), row: { name: row?.name, icon: row?.icon ?? null } });

  // ── 다른 봇 채팅 ──
  rec.expect('B-otherbot', '괴이 봇 채팅에 구급약 사용을 걸어 둔 채, 리스AI 에 새로 만든 빈 캐릭터 채팅에서 보내면: 그 본편 요청에 [Inventory]·로어·[Previous status] 가 없고 갱신기 요청도 없다. 답 끝의 상태창 줄·[shop:] 같은 글을 건드리지 않는다. 괴이 채팅으로 돌아오면 사용 자리·구급약 횟수 그대로', '코스 5장 「다른 봇 채팅: 아무것도 안 해야 함」');
  await addManual('구급약', 5);
  await useItem('구급약');
  const sA = await invState(t);
  const goeiIdx = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); });
  const otherIdx = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const i = ch.createNewCharacter(); st.DBState.db.characters[i].name = '평범한 봇'; st.DBState.db.characters[i].firstMessage = '안녕하세요.'; return i; });
  await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, otherIdx);
  await t.page.waitForSelector('.default-chat-screen', { timeout: 60000 });
  await sleep(2500);
  const s0 = await seqNow();
  const plainReply = '평범한 답입니다.\n[shop: 기독교 상점|블라렛]\n[▣|2025.03.14|10:00 AM|☀️|12°C|어딘가|없음|없음|없음|관리국/신입|999]';
  await mainRule('m-other', esc('다른 봇 인사'), plainReply);
  await t.send('다른 봇 인사');
  await sleep(4000);
  const log = await logSince(s0);
  const mainReq = log.filter((x) => x.route === 'main').at(-1)?.body;
  const allTxt = (mainReq?.messages ?? []).map((m) => String(m.content)).join('\n');
  const auxKinds = log.filter((x) => x.route === 'aux').map((x) => auxKind(x.body));
  const otherChat = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); const ch = c.chats[c.chatPage]; return { name: c.name, last: ch.message.at(-1)?.data ?? null, ss: Object.keys(ch.scriptstate ?? {}) }; });
  const dom = await t.page.evaluate(() => { const last = document.querySelector('.chat-message-container:first-child'); return { cards: [...(last?.querySelectorAll('[data-goei-card]') ?? [])].map((e) => e.getAttribute('data-goei-card') + ':' + getComputedStyle(e).display), text: last?.innerText?.slice(0, 160) ?? null, fab: !!document.querySelector('[x-goei-fab]') && getComputedStyle(document.querySelector('[x-goei-fab]')).display }; });
  await t.shot('run9-다른봇-pc');
  await t.selectChar(goeiIdx);
  await sleep(2500);
  const sB = await invState(t);
  rec.actual('B-otherbot', !!mainReq && !/\[Inventory\]|goei:lore|\[Previous status\]/.test(allTxt) && !auxKinds.includes('updater') && otherChat.last === plainReply && sB.use === sA.use && leftOf(sB, '구급약') === leftOf(sA, '구급약'), { mainSent: !!mainReq, hasInv: /\[Inventory\]/.test(allTxt), hasLore: /goei:lore/.test(allTxt), hasPrev: /\[Previous status\]/.test(allTxt), auxKinds, otherChat, dom, useBefore: sA.use, useAfter: sB.use, leftBefore: leftOf(sA, '구급약'), leftAfter: leftOf(sB, '구급약') });

  // ── 답 오는 중 채팅 지우기로 번호 밀기 ──
  rec.expect('B-busydel', '앞 번호 채팅(0번)이 있는 상태에서 1번(괴이 채팅)에서 구급약 사용을 싣고 보낸 뒤 답을 기다리는 동안 0번 채팅을 지우면(번호 −1): 리스AI 가 답을 어디에 쓰는지와, 플러그인이 사용·물건을 어느 채팅에 적는지를 가른다', '코스 5장 「답 오는 중 다른 채팅 + 번호 밀기(지우기)」, 공-02');
  const origId = await curChatId();
  await t.newChat();
  await t.switchChat(origId);
  await sleep(1200);
  const k0 = leftOf(await invState(t), '구급약');
  const before = await chatsInfo();
  const sd = await seqNow();
  await mainRule('m-del', esc('지우기 기다림'), `에일린은 구급약을 발랐다.\n${st({ time: '10:40 AM' })}`, { hold: true });
  u.push(() => ({}));
  await t.send('지우기 기다림', { wait: false });
  for (let i = 0; i < 40; i++) { const p = await fake('pending'); if (p.some((x) => x.route === 'main')) break; await sleep(300); }
  const sentInv = invBlock((await logSince(sd)).filter((x) => x.route === 'main').at(-1)?.body)?.match(/This turn:[^\n]*/)?.[0] ?? null;
  await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const g = await import('/src/ts/globalApi.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const chara = st.DBState.db.characters[ci]; g.changeChatTo(0); const chats = chara.chats; chats.splice(0, 1); chara.chats = chats; });
  await sleep(1000);
  const mid = await chatsInfo();
  await fake('release', {});
  await sleep(6000);
  for (let i = 0; i < 30; i++) { const l = await logSince(sd, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
  const after = await chatsInfo();
  await t.switchChat(origId);
  await sleep(1200);
  const sD = await invState(t);
  rec.actual('B-busydel', null, { sentInv, k0, kAfter: leftOf(sD, '구급약'), use: sD.use, useAt: sD.useAt, before, mid, after });

  // ── 답 오는 중 가져오기로 번호 밀기 ──
  rec.expect('B-busyimport', '괴이 채팅에서 구급약 사용을 싣고 보낸 뒤 답을 기다리는 동안 리스AI 「가져오기」로 채팅 하나를 넣으면(맨 앞에 끼워 번호 +1): 답이 어디에 붙는지, 플러그인 사용 기록·물건이 어디에 생기는지 가른다', '코스 5장 「답 오는 중 다른 채팅 + 번호 밀기(가져오기)」, 공-02');
  await useItem('구급약');
  const k1 = leftOf(await invState(t), '구급약');
  const si = await seqNow();
  await mainRule('m-imp', esc('가져오기 기다림'), `에일린은 다시 구급약을 발랐다.\n${st({ time: '11:00 AM' })}`, { hold: true });
  u.push(() => ({}));
  await t.send('가져오기 기다림', { wait: false });
  for (let i = 0; i < 40; i++) { const p = await fake('pending'); if (p.some((x) => x.route === 'main')) break; await sleep(300); }
  let impErr = null;
  try { await t.loadState(STATES + 'S-start.json', { select: false, storage: false }); } catch (e) { impErr = String(e.message).slice(0, 120); }
  const midI = await chatsInfo();
  await fake('release', {});
  await sleep(6000);
  for (let i = 0; i < 30; i++) { const l = await logSince(si, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
  const afterI = await chatsInfo();
  await t.switchChat(origId);
  await sleep(1200);
  const sI = await invState(t);
  await t.shot('run9-가져오기뒤-원래채팅-pc');
  rec.actual('B-busyimport', null, { impErr, k1, kAfter: leftOf(sI, '구급약'), use: sI.use, useAt: sI.useAt, last2: sI.s.message.slice(-2).map((m) => `${m.role}:${m.data.slice(0, 24)}`), midI, afterI });
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run9-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run9-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
