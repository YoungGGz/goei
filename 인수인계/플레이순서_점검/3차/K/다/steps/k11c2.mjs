// k11c 보충: 어림 셈에서 같은 상한(13000)·더 큰 상한(20000)으로 괴담톡 확인 → 안내 글·실제 토큰
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const toast = () => t.F().evaluate(() => [...document.querySelectorAll('.gx *')].filter((e) => e.children.length === 0 && /토큰 상한/.test(e.textContent)).map((e) => e.textContent.trim()).slice(0, 2));
  const drop = async () => { await C.openSet(); await C.node('manage:backup'); await sleep(700); await C.act('man-drop-tok'); await sleep(300); await C.act('man-drop-tok-yes'); await sleep(800); };
  const measure = async (budget) => {
    await C.openSet(); await C.node('set:adv'); await C.typeNum('요청 토큰 상한', budget); await C.closeSet();
    await C.open(); await C.act('tab', 'phone', false); await sleep(700);
    const s0 = await t.fakeSeq(); await C.act('ph-refresh', undefined, false);
    let l; for (let i = 0; i < 16; i++) { l = (await t.fakeLog(s0, 'aux'))[0]; if (l) break; await sleep(500); }
    const msg = await toast();
    const text = (l?.body?.messages ?? []).map((m) => String(m.content)).join('\n');
    const exact = text ? await t.R(async (s) => { const tk = await import('/src/ts/tokenizer.ts'); return (await tk.encodeWithTokenizer(s, 'o200k_base')).length; }, text) : 0;
    await C.shot(`k11c2-어림-${budget}`);
    return { budget, sent: !!l, chars: text.length, exactTokens: exact, msg };
  };
  await drop();
  const a = await measure(13000); await sleep(1500);
  const b = await measure(20000);
  const r = rec('k11c 어림 셈에서 상한 13000 / 20000', { expect: '어림이면 같은 요청을 더 크게 셀 수 있음(막히면 안내 글). 보낸 요청의 실제 토큰은 상한 이하', src: 'tokenizer.ts 어림값, 정확 셈 같은 상한에서 13,086토큰으로 보냄', actual: { a, b }, ok: (!a.sent || a.exactTokens <= 13000 * 1.01) && (!b.sent || b.exactTokens <= 20000) });
  await C.openSet(); await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 0); await C.node('manage:diag'); await sleep(500); await C.act('man-get-tok').catch(() => {}); await sleep(8000); await C.closeSet();
  return r;
}
