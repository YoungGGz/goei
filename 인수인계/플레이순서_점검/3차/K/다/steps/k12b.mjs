// K12 채팅이 바뀐 뒤 온 <apply> — 리스AI changeChatTo 로 채팅 바꾸기 (k12 10번을 리스AI 정식 경로로 다시)
import { rec, sleep } from '../lib.mjs';
export default async function (C, arg = {}) {
  const { t } = C;
  const log = () => t.F().evaluate(() => [...(document.querySelector('.gw-ai-log')?.children ?? [])].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const budgets = () => t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return { page: c.chatPage, b: c.chats.map((x) => (x.scriptstate || {}).$gen_budget ?? null) }; });
  const busy = () => t.F().evaluate(() => !!document.querySelector('.gw-ai [name="ai-q"]')?.disabled);
  await C.openSet(); await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 0); await sleep(300);
  if (!(await t.F().evaluate(() => !!document.querySelector('.gw-ai')))) await C.act('ai-toggle');
  await t.fake('rules/add', { rule: { id: 'k12b-1', route: 'any', match: 'settings help desk', reply: '<say>30,000으로 할까요?</say><set>adv-set.gen:budget=3만</set>' } });
  await t.F().locator('.gw-ai [name="ai-q"]').fill('상한 3만'); await C.act('ai-send');
  for (let i = 0; i < 40 && (await busy()); i++) await sleep(300);
  await t.fake('rules/del', { id: 'k12b-1' });
  const b0 = await budgets();
  await t.fake('rules/add', { rule: { id: 'k12b-hold', route: 'any', match: 'settings help desk', hold: true, reply: '<say>바꿨어요.</say><apply>yes</apply>' } });
  const s0 = await t.fakeSeq();
  await t.F().locator('.gw-ai [name="ai-q"]').fill('응 바꿔'); await C.act('ai-send');
  for (let i = 0; i < 40 && !(await t.fakeLog(s0)).length; i++) await sleep(300);
  const orig = b0.page, other = orig === 0 ? 1 : 0;
  const closed = arg.mode === 'closed';
  if (closed) { await t.closeWindow(); await sleep(800); }
  await t.switchChat(other); await sleep(1500);
  if (closed) { await C.open(); await sleep(800); }
  const mid = { budgets: await budgets(), log: (await log()).slice(-2), gw: await t.F().evaluate(() => !!document.querySelector('.gw:not([hidden])')) };
  await C.shot((closed?'k12c':'k12')+'-6-채팅바꿈-답기다림');
  await t.fake('release', {}); await sleep(2500);
  await t.fake('rules/del', { id: 'k12b-hold' });
  const after = { budgets: await budgets(), log: (await log()).slice(-3) };
  await C.shot((closed?'k12c':'k12')+'-7-채팅바꿈-답온뒤');
  if (closed) { await t.closeWindow(); await sleep(800); }
  await t.switchChat(orig); await sleep(1500);
  if (closed) { await C.openSet(); await sleep(800); if (!(await t.F().evaluate(() => !!document.querySelector('.gw-ai')))) await C.act('ai-toggle'); await sleep(500); }
  const back = { budgets: await budgets(), log: (await log()).slice(-3) };
  await C.shot((closed?'k12c':'k12')+'-8-원래채팅');
  const ok = after.budgets.b.every((x) => x === null || String(x) === '0' || x === '') && back.log.some((x) => /채팅이 바뀌어서/.test(x));
  const r = rec('k12 채팅이 바뀐 뒤 온 <apply> (changeChatTo' + (closed ? ', 창 닫고 바꿈' : ', 창 연 채로') + ')', { expect: '답을 기다리는 동안 다른 채팅으로 → 답의 <apply> 는 아무것도 안 바꾸고 원래 채팅 상담 대화에 「채팅이 바뀌어서 아무것도 바꾸지 않았어요」, 두 채팅 상한 그대로', src: 'editor/consult.ts ask same', actual: { b0, mid, after, back }, ok });
  // 정리: 상한 0
  await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 0); await C.closeSet();
  return { ok, b0, mid, after, back };
}
