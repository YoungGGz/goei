// K11 관리 ③ 상태 점검: 토크나이저·위키 기본 문서 받기 → 저장소에서 지우기(확인 팝업) → 다시 받기. 토큰 수가 어림값일 때 「요청 토큰 상한」이 지켜지는지(리스AI o200k 로 실제 토큰을 다시 셈)
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k11c ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const rowTxt = (label) => t.F().evaluate((l) => [...document.querySelectorAll('.gw .ps-row')].find((r) => (r.querySelector('.ps-label b')?.firstChild?.textContent ?? '').trim() === l)?.innerText.replace(/\s+/g, ' ') ?? null, label);
  const size = (k) => t.R(async (k) => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const v = await cs.pluginStorage.getItem(k); return v ? (typeof v === 'string' ? v.length : JSON.stringify(v).length) : 0; }, k);
  const waitRow = async (label, re, ms = 60000) => { for (let e = Date.now() + ms; Date.now() < e; await sleep(800)) { const x = await rowTxt(label); if (re.test(x ?? '')) return x; } return rowTxt(label); };

  await C.openSet(); await C.node('manage:diag'); await sleep(800);
  const d0 = { tok: await rowTxt('토크나이저'), wiki: await rowTxt('위키 기본 문서'), sTok: await size('goei:tok-o200k'), sWiki: await size('goei:wikibase') };
  await C.shot('k11c-1-상태점검-처음');
  // 받기 (없을 때만 단추가 있다)
  if (await t.F().locator('.gw [data-action="man-get-tok"]').count()) { await C.act('man-get-tok'); }
  const tok1 = await waitRow('토크나이저', /o200k_base/);
  if (await t.F().locator('.gw [data-action="man-get-wiki"]').count()) { await C.act('man-get-wiki'); }
  const wiki1 = await waitRow('위키 기본 문서', /있음/);
  await C.shot('k11c-2-상태점검-받은뒤');
  await step('받기 (토크나이저·위키 기본 문서)', '받기 단추 → 「o200k…」·「있음」, 저장소에 들어감', 'manage.ts diagPage getBtn (사용자 11-06 승인)', async () => ({ actual: { d0, tok1, wiki1, sTok: await size('goei:tok-o200k'), sWiki: await size('goei:wikibase') }, ok: /o200k/i.test(tok1 ?? '') && /있음/.test(wiki1 ?? '') && (await size('goei:tok-o200k')) > 0 && (await size('goei:wikibase')) > 0 }));

  // 정확한 셈에서 요청 토큰 상한 3000 → 괴담톡 확인 요청의 실제 토큰
  const measure = async (tag) => {
    const s0 = await t.fakeSeq();
    await C.closeSet(); await C.open(); await C.act('tab', 'phone', false); await sleep(700); await C.act('ph-refresh', undefined, false);
    for (let i = 0; i < 40; i++) { if ((await t.fakeLog(s0, 'aux')).length) break; if (i % 10 === 9) await C.act('ph-refresh', undefined, false); await sleep(500); }
    await sleep(1500);
    const l = (await t.fakeLog(s0, 'aux'))[0];
    const text = (l?.body?.messages ?? []).map((m) => String(m.content)).join('\n');
    const exact = await t.R(async (s) => { const tk = await import('/src/ts/tokenizer.ts'); return (await tk.encodeWithTokenizer(s, 'o200k_base')).length; }, text);
    await C.openSet();
    return { tag, seq: l?.seq, chars: text.length, exactTokens: exact };
  };
  await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 13000); const bud = await C.vars(/budget/);
  const mExact = await measure('정확');
  // 저장소에서 토크나이저 지우기
  await C.node('manage:backup'); await sleep(800);
  await C.act('man-drop-tok'); await sleep(300); const pop = await t.F().evaluate(() => document.querySelector('.gw .gw-confirm')?.textContent.trim().slice(0, 80) ?? null);
  const yes = await t.F().evaluate(() => document.querySelector('.gw .gw-confirm [data-action^="man-drop"]')?.dataset.action ?? document.querySelector('.gw .gw-confirm button.danger')?.dataset.action);
  if (yes) await C.act(yes); await sleep(800);
  await C.node('manage:diag'); await sleep(600);
  const tok2 = await rowTxt('토크나이저');
  await C.shot('k11c-3-토크나이저-지운뒤');
  await step('토크나이저 지우기', '확인 팝업 → 지우면 상태 점검 「어림값」 + 받기 단추, 저장소 0', 'manage.ts STORE man-drop-tok', async () => ({ actual: { pop, yes, tok2, s: await size('goei:tok-o200k') }, ok: !!pop && /어림값/.test(tok2 ?? '') && (await size('goei:tok-o200k')) === 0 }));
  const mEst = await measure('어림');
  await step('요청 토큰 상한 13000: 정확 셈 vs 어림 셈', '두 경우 모두 실제 o200k 토큰이 상한(13000) 이하 — 3000 은 「참고 자료를 줄여도 약 11,616토큰」 안내로 막혀 보내지 않음(설계)', 'core/advanced.ts gen.budget, tokenizer.ts 어림값', async () => ({ actual: { bud, mExact, mEst }, ok: mExact.chars > 0 && mExact.exactTokens <= 13000 * 1.01 && (mEst.chars === 0 || mEst.exactTokens <= 13000) /* 어림은 크게 세어 막힐 수 있음 → k11c2 */ }));
  // 위키 기본 문서 지우기 → 다시 받기
  await C.node('manage:backup'); await sleep(700);
  await C.act('man-drop-wiki'); await sleep(300);
  const yes2 = await t.F().evaluate(() => document.querySelector('.gw .gw-confirm button.danger')?.dataset.action);
  if (yes2) await C.act(yes2); await sleep(800);
  await C.node('manage:diag'); await sleep(600); const wiki2 = await rowTxt('위키 기본 문서');
  await C.act('man-get-wiki'); const wiki3 = await waitRow('위키 기본 문서', /있음/);
  await C.act('man-get-tok').catch(() => {}); const tok3 = await waitRow('토크나이저', /o200k/);
  await step('위키 기본 문서 지우기 → 다시 받기 / 토크나이저 다시 받기', '지우면 「없음」+받기, 받으면 「있음」. 토크나이저도 다시 o200k', '', async () => ({ actual: { wiki2, wiki3, tok3 }, ok: /없음/.test(wiki2 ?? '') && /있음/.test(wiki3 ?? '') && /o200k/i.test(tok3 ?? '') }));
  await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 0);
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
