// 공통 갈래 (코스 5장) 중 K 에 닿는 것: AI 상담 답 기다리는 중 새로고침 / 채팅 설정 값 다른 채팅 다녀오기
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k-common ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const log = () => t.F().evaluate(() => [...(document.querySelector('.gw-ai-log')?.children ?? [])].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const aiOpen = async () => { if (!(await t.F().evaluate(() => !!document.querySelector('.gw-ai')))) await C.act('ai-toggle'); await sleep(400); };
  // 1) 상담 답 기다리는 중 새로고침: <set> 적어 둔 뒤 <apply> 답을 붙잡고 새로고침
  await t.closeWindow().catch(() => {});
  await C.openSet(); await C.node('set:adv'); await aiOpen();
  await t.fake('rules/add', { rule: { id: 'kc-1', route: 'any', match: 'settings help desk', reply: '<say>4만으로 할까요?</say><set>adv-set.gen:budget=4만</set>' } });
  await t.F().locator('.gw-ai [name="ai-q"]').fill('상한 4만'); await C.act('ai-send'); await sleep(2500);
  await t.fake('rules/del', { id: 'kc-1' });
  await t.fake('rules/add', { rule: { id: 'kc-hold', route: 'any', match: 'settings help desk', hold: true, reply: '<say>바꿨어요.</say><apply>yes</apply>' } });
  const s0 = await t.fakeSeq();
  await t.F().locator('.gw-ai [name="ai-q"]').fill('응 바꿔'); await C.act('ai-send');
  for (let i = 0; i < 30 && !(await t.fakeLog(s0)).length; i++) await sleep(300);
  await t.reload({ settle: false });
  await t.fake('release', {}); await t.fake('rules/del', { id: 'kc-hold' }); await sleep(1500);
  await C.openSet(); await C.node('set:adv'); await aiOpen(); await sleep(800);
  const l1 = await log(); const b1 = (await C.vars(/^\$gen_budget$/)).$gen_budget;
  const busy1 = await t.F().evaluate(() => !!document.querySelector('.gw-ai [name="ai-q"]')?.disabled);
  await C.shot('kc-1-상담중-새로고침');
  // 새로고침 뒤 다시 「응」: 적어 둔 것(4만)이 남아 있으면 적용된다
  await t.fake('rules/add', { rule: { id: 'kc-2', route: 'any', match: 'settings help desk', reply: '<say>바꿨어요.</say><apply>yes</apply>' } });
  const s2 = await t.fakeSeq();
  await t.F().locator('.gw-ai [name="ai-q"]').fill('응 바꿔줘'); await C.act('ai-send'); await sleep(2500);
  await t.fake('rules/del', { id: 'kc-2' });
  const req2 = ((await t.fakeLog(s2))[0]?.body?.messages ?? []).map((m) => m.content).join('\n');
  const l2 = (await log()).slice(-3); const b2 = (await C.vars(/^\$gen_budget$/)).$gen_budget;
  await step('상담 답 기다리는 중 새로고침', '새로고침 뒤 상담 창이 「보내는 중」에 멈춰 있지 않음, 붙잡혔던 답은 버려짐(값 그대로). 앞 턴의 대화·「바꾸자고 한 것」은 저장된 만큼 남음', '코스 5장 「작업 중 새로고침 — 진행 중 작업은 메모리라 사라짐」, consult.ts persist', async () => ({ actual: { l1: l1.slice(-3), b1, busy1, pendingInReq: /4만|40,000|40000/.test(req2.split('\n').filter((s) => /PENDING|바꾸자고|budget/i.test(s)).join('\n')), l2, b2 }, ok: !busy1 && (b1 === undefined || b1 === '' || String(b1) === '0') }));
  // 정리
  await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 0);
  R.push(...(await part2(C, true)));
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}

export async function part2(C, inner = false) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k-common ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  await C.openSet(); await C.node('set:adv');
  // 2) 채팅 설정 값 다른 채팅 다녀오기 (다른 채팅은 시작 전이라 설정 창 대신 그 채팅 변수를 본다)
  await C.typeNum('다시 보기', 2);
  await C.closeSet(); await t.closeWindow();
  const page0 = (await t.chatState(false)).chatPage ?? 0;
  await t.switchChat(page0 === 0 ? 1 : 0); await sleep(1000);
  const other = (await C.vars(/^\$gen_reiterate$/)).$gen_reiterate ?? null;
  await t.switchChat(page0); await sleep(1000);
  await C.openSet(); await C.node('set:adv'); const back = await C.row('다시 보기');
  await C.shot('kc-2-다른채팅-다녀옴');
  await C.typeNum('다시 보기', 0); await C.closeSet();
  await step('채팅 설정 값: 다른 채팅 다녀오기', '「이 채팅」 값(다시 보기 2)은 다른 채팅 변수에 없음, 돌아오면 칸에 2', '코스 5장 「다른 채팅 다녀오기」', async () => ({ actual: { other, back }, ok: other !== '2' && JSON.stringify(back).includes('2') }));
  return inner ? R : R.map((r) => ({ name: r.name, ok: r.ok }));
}
