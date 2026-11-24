// K10 보조 호출 로어북 「플러그인 기준」(기본) / 「로어북 포함」 — 실제 리스AI 채팅 로어북에 항목 둘(상시·열쇠 「로비」)과 카드에 사용자 항목 하나를 넣고 괴담톡 확인 요청 글을 본다
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k10-aux ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  await t.R(async () => {
    const db = await import('/src/ts/storage/database.svelte.ts');
    const ch = db.getCurrentCharacter(); const chat = ch.chats[ch.chatPage];
    chat.localLore = [...(chat.localLore ?? []).filter((l) => !/^K10/.test(l.comment)),
      { key: '', comment: 'K10 채팅 상시', content: 'K10_CHAT_ALWAYS_TEXT', mode: 'normal', insertorder: 100, alwaysActive: true, secondkey: '', selective: false },
      { key: '로비', comment: 'K10 채팅 열쇠', content: 'K10_CHAT_KEYED_TEXT', mode: 'normal', insertorder: 100, alwaysActive: false, secondkey: '', selective: false },
      { key: '나오지않는말', comment: 'K10 채팅 다른', content: 'K10_CHAT_OTHER_TEXT', mode: 'normal', insertorder: 100, alwaysActive: false, secondkey: '', selective: false }];
    ch.globalLore = [...ch.globalLore.filter((l) => !/^K10/.test(l.comment)), { key: '', comment: 'K10 카드 사용자 상시', content: 'K10_CARD_USER_TEXT', mode: 'normal', insertorder: 100, alwaysActive: true, secondkey: '', selective: false }];
  });
  await sleep(1200);
  const ask = async (tag) => {
    const s0 = await t.fakeSeq();
    await C.open(); await C.act('tab', 'phone', false); await sleep(1000);
    await C.act('ph-refresh', undefined, false);
    for (let i = 0; i < 40; i++) { const l = await t.fakeLog(s0, 'aux'); if (l.length) break; await sleep(500); }
    await sleep(2500);
    const l = await t.fakeLog(s0, 'aux');
    const txt = l.map((x) => JSON.stringify(x.body?.messages ?? '')).join('\n');
    await C.shot(`k10-aux-${tag}`);
    return { n: l.length, seqs: l.map((x) => x.seq), always: txt.includes('K10_CHAT_ALWAYS_TEXT'), keyed: txt.includes('K10_CHAT_KEYED_TEXT'), other: txt.includes('K10_CHAT_OTHER_TEXT'), card: txt.includes('K10_CARD_USER_TEXT'), sys0: String(l[0]?.body?.messages?.[0]?.content ?? '').slice(0, 80) };
  };
  await C.openSet(); await C.node('set:lore'); const row0 = await C.row('보조 호출 로어북'); await C.closeSet();
  const a = await ask('플러그인기준');
  await step('플러그인 기준(기본)', '줄 기본 「플러그인 기준」, 괴담톡 확인 요청에 채팅 로어북·카드 사용자 항목 안 들어감', 'core/advanced.ts:79, auxlore.ts', async () => ({ actual: { row0, a }, ok: JSON.stringify(row0?.on) === '["플러그인 기준"]' && a.n > 0 && !a.always && !a.keyed && !a.card }));
  await C.openSet(); await C.node('set:lore'); await C.seg('보조 호출 로어북', '로어북 포함'); const v = await C.vars(/aux_lore/); await C.closeSet();
  const b = await ask('로어북포함');
  await step('로어북 포함', '$gen_aux_lore=risu, 요청에 상시 항목·카드 사용자 항목·열쇠(로비)가 글에 나온 항목은 들어가고 열쇠가 안 나온 항목은 안 들어감', 'advanced.ts:79 hint', async () => ({ actual: { v, b }, ok: v.$gen_aux_lore === 'risu' && b.always && b.card && b.keyed && !b.other }));
  await C.openSet(); await C.node('set:lore'); await C.seg('보조 호출 로어북', '플러그인 기준'); await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
