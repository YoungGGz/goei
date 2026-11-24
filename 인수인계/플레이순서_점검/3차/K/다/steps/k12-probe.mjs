import { sleep, save } from '../lib.mjs';
export default async function (C, arg = {}) {
  const { t } = C;
  await C.openSet(); await C.node(arg.node || 'set:items'); await sleep(600);
  const open = await t.F().evaluate(() => !!document.querySelector('.gw-ai'));
  if (!open) await C.act('ai-toggle');
  await t.fake('rules/add', { rule: { id: 'k12p', route: 'any', match: 'settings help desk', reply: '<say>알겠어요.</say>' } });
  const s0 = await t.fakeSeq();
  const inp = t.F().locator('.gw-ai [name="ai-q"]'); await inp.fill(arg.q || '아바타 동작 간격과 메시지당 변화 상한, 요청 토큰 상한 알려줘'); await C.act('ai-send');
  for (let i = 0; i < 30; i++) { if ((await t.fakeLog(s0)).length) break; await sleep(500); }
  await sleep(1500);
  await t.fake('rules/del', { id: 'k12p' });
  const l = await t.fakeLog(s0);
  const txt = l.map((x) => (x.body?.messages ?? []).map((m) => m.content).join('\n')).join('\n=====\n');
  save('k12-probe-req.txt', txt);
  return { n: l.length, routes: l.map((x) => x.route), lines: txt.split('\n').filter((s) => /동작 간격|변화 상한|요청 토큰 상한|items-act|pp-cap/.test(s)).slice(0, 20) };
}
