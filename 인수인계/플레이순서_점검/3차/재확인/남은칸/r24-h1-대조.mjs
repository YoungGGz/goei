// 재확인 남은칸 R24 H1 대조: 권한이 있을 때 같은 누름(실제 마우스)으로 명부 순서가 바뀌는지. r24-t2.mjs H1 판정의 대조.
import { session, sleep } from '/home/user/goei/인수인계/플레이순서_점검/3차/재확인/남은칸/lib.mjs';
const S = await session('R24-H1대조'); const { t, step } = S;
const rosterOrder = () => S.fe(() => [...document.querySelectorAll('.gw [data-action="dir-move"][data-value^="up|"]')].map((e) => e.dataset.value.slice(3)));
const charAgentOrder = () => t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const ch = st.DBState.db.characters.at(-1); const e = (ch.globalLore ?? []).find((x) => /명부|Directory|directory/.test(String(x.comment ?? '')) && String(x.content ?? '').includes('잼트리')); if (!e) return null; const s = String(e.content); return ['쟈알디', '스팡달', '잼트리'].map((n) => [n, s.indexOf(n)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); });
try {
  await S.fakeReset(); await t.setup(); await S.loadState('S-관리국-3턴.json'); await sleep(2000);
  await S.ed('agent');
  const o0 = await rosterOrder(), c0 = await charAgentOrder();
  const F = await S.frame(); await F.locator('.gw [data-action="dir-move"][data-value="up|잼트리"]').first().click(); await sleep(2500);
  const o1 = await rosterOrder(), c1 = await charAgentOrder();
  await S.edClose(); await sleep(800); await S.ed('agent'); const o2 = await rosterOrder(); await S.edClose();
  step('H1 대조(권한 있음)', '잼트리가 한 칸 위로, 카드에도', '-').check(o1[1] === '잼트리' && c1?.[1] === '잼트리', { before: o0.slice(0, 4), rightAfter: o1.slice(0, 4), reopened: o2.slice(0, 4), cardBefore: c0, cardAfter: c1 });
} catch (e) { step('예외', '', '-').check(false, String(e?.stack ?? e).slice(0, 800)); } finally { await S.close(); }
