// H 구간 run6: run4 에서 어긋난 칸 다시 보기 — (1) 사용 걸고 보낸 답을 지운 뒤 채팅 칩, (2) 메시지 직접 고치기(상태창 잔고)
// PC 1280×800, S-요원플레이
import { boot, openItems, act, fText, invState, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, prevStatus, auxKind, recorder } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run6');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json' });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function turn(tag, text, reply) {
  const s0 = await seqNow();
  await mainRule('m-' + tag, esc(text), reply);
  u.push(() => ({}));
  await t.send(text);
  for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
  const main = (await logSince(s0)).filter((x) => x.route === 'main');
  return main.at(-1)?.body;
}
const chip = () => t.page.evaluate(() => {
  const slot = document.querySelector('.chat-message-container:first-child [data-goei-card="use"]');
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent).filter((x) => x.includes('data-gu-label')).join('\n');
  return { slotShown: slot ? getComputedStyle(slot).display !== 'none' : false, label: /\[data-gu-label\]::before \{ content: "([^"]+)"/.exec(css)?.[1] ?? null, names: [...css.matchAll(/\[data-gu="\d+"\]::before \{ content: "([^"]+)"/g)].map((m) => m[1]) };
});
const addManual = async (name, uses) => { await openItems(t); await act(t, 'items-add'); await t.F().locator('[name="name"]').fill(name); await t.F().locator('[name="uses"]').fill(String(uses)); await t.F().locator('[name="weight"]').fill('0.2'); const r = await act(t, 'items-save', ''); await t.closeWindow(); return r; };
const useItem = async (name) => { await openItems(t); const id = (await invState(t)).items?.list.find((e) => e.name === name && !e.outHow)?.id; await act(t, 'items-open', id); const r = await act(t, 'items-use', id); await act(t, 'items-close'); await t.closeWindow(); return r; };

try {
  await addManual('구급약', 9);
  // ── (1) 지운 뒤 칩 ──
  rec.expect('R-chip', '구급약 사용을 걸고 보낸 답을 지우면(마지막이 내 말) 채팅 칩 「다음 메시지에 사용 · 구급약」이 다시 보임 — 바로/4초 뒤/소지품 창을 열고 닫은 뒤/새로고침 뒤 각각 기록', 'H-17b (Claude 판정, 0.21.34) + usebox.ts 주석 「보냈는데 그 답이 지워진 자리는 … 칩·창에 다시 보이고」');
  const u1 = await useItem('구급약');
  const c0 = await chip();
  await turn('C1', 'C1 응급처치', `에일린은 구급약을 발랐다.\n${st({ time: '10:20 AM' })}`);
  const n = (await invState(t)).s.message.length;
  await t.deleteMessage(n - 1);
  await sleep(1200);
  const cA = await chip();
  await sleep(4000);
  const cB = await chip();
  await t.shot('run6-지운뒤-칩-pc');
  await openItems(t);
  const win = await fText(t, '.gx-items');
  await t.closeWindow();
  await sleep(1200);
  const cC = await chip();
  await t.reload({ settle: true });
  await sleep(3000);
  const cD = await chip();
  await t.shot('run6-지운뒤-새로고침-칩-pc');
  const sv = await invState(t);
  rec.actual('R-chip', cB.slotShown && cB.names.includes('구급약'), { u1, beforeSend: c0, now: cA, after4s: cB, afterWindow: cC, afterReload: cD, win: win?.match(/사용[^가]*예정[^\s]*\s*\S+/)?.[0] ?? win?.slice(0, 200), use: sv.use, useAt: sv.useAt, last: sv.s.message.at(-1).role }, { shot: 'out/run6-지운뒤-칩-pc.png' });
  const body2 = await turn('C2', 'C2 다시 처치', `에일린은 다시 구급약을 발랐다.\n${st({ time: '10:20 AM' })}`);
  rec.actual('R-chip-send', /This turn: uses 구급약/.test(invBlock(body2) ?? ''), { thisTurn: invBlock(body2)?.match(/This turn:[^\n]*/)?.[0] ?? null });

  // ── (2) 메시지 직접 고치기 ──
  rec.expect('R-edit', '마지막 답의 상태창 잔고 140000 을 연필로 90000 으로 고침 → 장부·머리 잔고가 따라가는지, 다음 본편 [Previous status] 잔고가 무엇인지 기록 (처리 코드를 못 찾았다 했던 자리)', '코스 5장 「메시지 직접 고치기」 — 결정표 줄 없음');
  await turn('C3', 'C3 서류', `에일린은 서류를 봤다.\n${st({ time: '10:40 AM', bal: 140000 })}`);
  const s3 = await invState(t);
  const li = s3.s.message.length - 1;
  const edited = s3.s.message[li].data.split('|140000]').join('|90000]');
  let editErr = null;
  try { await t.editMessage(li, edited); } catch (e) { editErr = String(e.message).slice(0, 160); }
  await sleep(2500);
  const s4 = await invState(t);
  const head = await t.page.evaluate(() => document.querySelector('.chat-message-container:first-child .gst-cash')?.innerText ?? null);
  await openItems(t, 'wallet');
  const wTx = await fText(t, '.gx');
  await t.shot('run6-고친뒤-가계부-pc');
  await t.closeWindow();
  const body5 = await turn('C4', 'C4 고친 뒤', `에일린은 고개를 들었다.\n${st({ time: '11:00 AM', bal: 90000 })}`);
  const s5 = await invState(t);
  rec.actual('R-edit', null, { editErr, editedTail: s4.s.message[li].data.slice(-40), walletAfterEdit: s4.wallet, cardCash: head, walletWin: wTx?.match(/잔고 ₩ [\d,]+/)?.[0] ?? null, prevStatus: prevStatus(body5)?.match(/\[▣[^\n]*\]/)?.[0] ?? null, walletAfterNext: s5.wallet });
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run6-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run6-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
