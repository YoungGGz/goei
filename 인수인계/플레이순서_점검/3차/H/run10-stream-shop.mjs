// H 구간 run10: (가) 스트리밍 켬에서 생각 블록 응답·사용 정리, (나) 상점 방문 중 소지품 끔 → 방문 닫기
// PC 1280×800. (가) S-요원플레이 streaming, (나) S-상점표식
import { boot, openItems, act, fText, invState, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, invBlock, auxKind, recorder, goItems } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run10');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bal = async (t) => { const w = (await invState(t)).wallet; const a = new Set((await invState(t)).s.message.map((m, i) => m.chatId || `#${i + 1}`)); return { log: (w?.log ?? []).map((e) => `${e.src}:${e.amount}:${e.memo}`), sum: (w?.start ?? 0) + (w?.log ?? []).filter((e) => e.src === 'manual' || !e.anchor || a.has(e.anchor)).reduce((n, e) => n + e.amount, 0) }; };
const aliveOf = (s) => new Set(s.s.message.map((m, i) => (typeof m.chatId === 'string' && m.chatId ? m.chatId : `#${i + 1}`)));
const leftOf = (s, name) => { const e = s.items?.list.find((x) => x.name === name && !x.outHow); if (!e) return null; const a = aliveOf(s); return (e.uses ?? 0) - s.items.log.filter((l) => l.item === e.id && l.what === 'use' && (!l.anchor || a.has(l.anchor))).reduce((n, l) => n + (l.n ?? 1), 0); };

// ── (가) 스트리밍 켬 ──
{
  const u = updaterScript();
  await baseRules(u.file);
  const { t } = await boot({ state: 'S-요원플레이.json', streaming: true });
  async function turn(tag, text, reply, more = {}) {
    const s0 = await seqNow();
    await mainRule('m-' + tag, esc(text), reply, more);
    u.push(() => ({}));
    await t.send(text);
    for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
    await sleep(1500);
    return (await logSince(s0)).filter((x) => x.route === 'main');
  }
  try {
    await openItems(t); await act(t, 'items-add'); await t.F().locator('[name="name"]').fill('구급약'); await t.F().locator('[name="uses"]').fill('5'); await t.F().locator('[name="weight"]').fill('0.3'); await act(t, 'items-save', ''); await t.closeWindow();
    rec.expect('S-use', '스트리밍 켬: 구급약 사용을 싣고 보낸 답이 조각으로 와도 [Inventory] uses 한 번, 횟수 한 번만 빠짐(5→4), 칩 사라짐', 'H-17b (Claude 판정), 코스 5장 「생각 블록 응답 (스트리밍 켬/끔)」');
    await openItems(t);
    const id = (await invState(t)).items.list.find((e) => e.name === '구급약').id;
    await act(t, 'items-open', id); await act(t, 'items-use', id); await act(t, 'items-close'); await t.closeWindow();
    const m1 = await turn('S1', 'S1 스트림 처치', `에일린은 구급약을 발랐다.\n${st({ time: '10:20 AM' })}`);
    const s1 = await invState(t);
    const chip1 = await t.page.evaluate(() => { const el = document.querySelector('.chat-message-container:first-child [data-goei-card="use"]'); return { shown: el ? getComputedStyle(el).display !== 'none' : false }; });
    rec.actual('S-use', m1.at(-1)?.stream === true && /uses 구급약/.test(invBlock(m1.at(-1)?.body) ?? '') && leftOf(s1, '구급약') === 4 && !!s1.useAt && !chip1.shown, { stream: m1.map((x) => x.stream), thisTurn: invBlock(m1.at(-1)?.body)?.match(/This turn:[^\n]*/)?.[0], left: leftOf(s1, '구급약'), use: s1.use, useAt: s1.useAt, chip: chip1 });

    rec.expect('S-think', '스트리밍 켬: 생각 글(reasoning)에 잔고 1 상태창 줄, 본문 끝에 140000 → 장부 그대로(140,000)', '공-21 (Claude 판정)');
    await turn('S2', 'S2 스트림 생각', `에일린은 생각했다.\n${st({ time: '10:40 AM' })}`, { reasoning: `정리: ${st({ time: '10:40 AM', bal: 1 })}` });
    const b2 = await bal(t);
    const d2 = (await invState(t)).s.message.at(-1).data.slice(0, 120);
    rec.actual('S-think', b2.sum === 140000, { b2, lastStart: d2 });

    rec.expect('S-think2', '스트리밍 켬: 생각 글에만 잔고 7 상태창 줄, 본문엔 상태창 없음 → 장부를 맞추지 않음(끔에서 본 진짜 버그 ①이 스트리밍에서도 나는지)', '공-21 (Claude 판정)');
    await turn('S3', 'S3 스트림 생각만', '에일린은 말없이 걸었다.', { reasoning: `정리: ${st({ time: '11:00 AM', bal: 7 })}` });
    const b3 = await bal(t);
    const d3 = (await invState(t)).s.message.at(-1).data.slice(0, 160);
    await t.shot('run10-스트리밍-생각만-pc');
    rec.actual('S-think2', b3.sum === 140000, { b3, lastStart: d3 });
  } catch (e) {
    rec.actual('예외(가)', false, String(e?.stack ?? e).slice(0, 1500));
    await t.shot('run10-error-a').catch(() => {});
  } finally {
    writeFileSync(`${OUT}/run10a-errors.json`, JSON.stringify(t.errors.slice(-60), null, 1));
    await u.stop();
    await t.close();
  }
}

// ── (나) 상점 방문 중 소지품 끔 ──
{
  const u = updaterScript();
  await baseRules(u.file);
  const { t } = await boot({ state: 'S-상점표식.json' });
  try {
    rec.expect('S-shopclose', '마지막 답의 「상점 열기」로 기독교 상점에 들어간 뒤(방문 기록 생김) 설정에서 소지품을 끄면: 이번 방문이 닫히고($st_shop 비움), 채팅의 상점 표식이 지워져 「상점 열기」 카드가 사라짐. 가게 창이 열려 있었다면 닫힘', 'H-02 「소지품 끄면 … 상점 방문 닫음」 (사용자 결정), H-01');
    await sleep(2000);
    const sq = await seqNow();
    await mainRule('m-shop', esc('가게에 들어간다'), `에일린은 기독교 상점 문을 열었다. 블라렛이 고개를 들었다.\n[▣|2025.03.14|10:40 AM|☀️|12°C|서울 서대문구 기독교 상점|없음|없음|없음|관리국/신입|140000]`);
    // 상점 판단은 갱신기 몫(설정 기본): shop_check 가 오면 가게 하나로 답한다
    u.push((d) => (d?.shop_check ? { shop: { name: '기독교 상점', owner: '블라렛', m: d.shop_check.m, quote: '에일린은 기독교 상점 문을 열었다.' } } : {}));
    await t.send('가게에 들어간다');
    for (let i = 0; i < 40; i++) { const l = await logSince(sq, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
    await sleep(2000);
    const card0 = await t.page.evaluate(() => [...document.querySelectorAll('[data-goei-shop]')].map((e) => e.innerText));
    const clk = await t.page.locator('[data-goei-shop]').last().click({ timeout: 8000 }).then(() => 'ok').catch((e) => 'err:' + String(e.message).slice(0, 80));
    await sleep(8000);
    await t.frame('.gx', 30000).catch(() => {});
    const shopTx = await fText(t, '.gx').catch(() => null);
    const v0 = (await invState(t)).ss.$st_shop ?? '';
    await t.shot('run10-상점-연뒤-pc');
    // 카드로 연 상점은 상점만 뜨는 단독 창이라 설정 단추가 없다 → 상점 창을 닫고(방문은 남음) 플러그인 창을 다시 열어 설정으로
    await act(t, 'shop-close', null, { wait: 1200 });
    await t.closeWindow().catch(() => {});
    const vMid = (await invState(t)).ss.$st_shop ?? '';
    await openItems(t);
    await act(t, 'ed-open', 'set:screen', { wait: 1500 });
    await act(t, 'ed-node', 'set:items', { wait: 1200 });
    const off = await act(t, 'set-inv-on', '0', { wait: 1500 });
    await act(t, 'ed-close', null, { wait: 800 });
    const winTx = await fText(t, '.gx').catch(() => null);
    await t.shot('run10-소지품끈뒤-창-pc');
    await t.closeWindow().catch(() => {});
    await sleep(1500);
    const s1 = await invState(t);
    const lastData = s1.s.message.at(-1).data;
    const card1 = await t.page.evaluate(() => [...document.querySelectorAll('[data-goei-shop]')].map((e) => e.innerText));
    await t.shot('run10-소지품끈뒤-채팅-pc');
    const judge = u.seen.at(-1)?.data?.shop_check ?? null;
    rec.actual('S-shopclose', !!v0 && off === 'ok' && !s1.ss.$st_shop && !/\[shop:/.test(lastData) && card1.length === 0, { judge, visitAfterShopClose: vMid ? 'kept' : '(없음)', card0, clk, visitBefore: v0 ? v0.slice(0, 160) : '(없음)', shopWin: shopTx?.slice(0, 160), off, visitAfter: s1.ss.$st_shop ?? '', invOn: s1.ss.$it_on ?? null, tagLeft: /\[shop:/.test(lastData), card1, winAfter: winTx?.slice(0, 160) });
  } catch (e) {
    rec.actual('예외(나)', false, String(e?.stack ?? e).slice(0, 1500));
    await t.shot('run10-error-b').catch(() => {});
  } finally {
    writeFileSync(`${OUT}/run10b-errors.json`, JSON.stringify(t.errors.slice(-60), null, 1));
    await u.stop();
    await t.close();
  }
}
