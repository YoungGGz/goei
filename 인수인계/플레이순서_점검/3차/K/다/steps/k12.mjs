// K12 AI 상담 (T2): <set> → 다음 답 <apply> → 되돌리기 → 다시 시도 → 모델 바꾸기 → 채팅 바뀐 뒤 온 <apply>, <open> 한 번 더 묻기(K-17).
// 0.21.34 고침: 「2만」「2억」「5천만」, 0, 최소·최대 짝, 메시지당 변화 상한 글 (결정표 K-13)
import { rec, sleep, save } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k12 ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const log = () => t.F().evaluate(() => [...(document.querySelector('.gw-ai-log')?.children ?? [])].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const busy = () => t.F().evaluate(() => !!document.querySelector('.gw-ai [name="ai-q"]')?.disabled);
  const waitIdle = async (ms = 30000) => { await sleep(400); for (let e = Date.now() + ms; Date.now() < e; await sleep(300)) if (!(await busy())) return true; return false; };
  let n = 0;
  /** 한 번 묻기: reply 문자열, 또는 [[추가 정규식, 답], …, 기본 답] (앞 것이 먼저 맞음) */
  const say = async (q, reply, extra = {}) => {
    const id = 'k12-' + (++n);
    const list = Array.isArray(reply) ? reply : [reply];
    const rules = list.map((x, i) => (Array.isArray(x) ? { id: id + '-' + i, route: 'any', match: 'settings help desk.*' + x[0], reply: x[1], ...extra } : { id: id + '-' + i, route: 'any', match: 'settings help desk', reply: x, ...extra }));
    await t.fake('rules/add', { rules });
    const s0 = await t.fakeSeq(); const before = (await log()).length;
    const inp = t.F().locator('.gw-ai [name="ai-q"]'); await inp.fill(q); await C.act('ai-send');
    await waitIdle();
    for (const r of rules) await t.fake('rules/del', { id: r.id });
    const l = await t.fakeLog(s0);
    return { reqs: l.map((x) => ({ seq: x.seq, route: x.route, rule: x.ruleId })), req: l.map((x) => (x.body?.messages ?? []).map((m) => m.content).join('\n')), added: (await log()).slice(before) };
  };
  const budget = async () => { const v = (await C.vars(/^\$gen_budget$/)).$gen_budget; return v === undefined || v === '' ? '0' : String(v); };
  const actGap = async () => { const v = await C.vars(/^\$it_act_gap_(min|max)$/); return { min: v.$it_act_gap_min ?? '12', max: v.$it_act_gap_max ?? '24' }; };

  await C.openSet(); await C.node('set:adv'); await sleep(500);
  if (!(await t.F().evaluate(() => !!document.querySelector('.gw-ai')))) await C.act('ai-toggle');
  // 앞 대화 지우기 (이 채팅 상담 대화만)
  if (await t.F().locator('.gw-ai [data-action="ai-clear"]:not([disabled])').count()) { await C.act('ai-clear'); await C.act('ai-clear-yes'); }
  await C.node('set:adv'); await C.typeNum('요청 토큰 상한', 0); await sleep(300);
  const r0 = await rulesCheck(t);

  // 1) 2만: <set> → 적용 안 됨(적어만 둠) → 다음 <apply> → 20000, 판
  const a1 = await say('요청 토큰 상한을 2만으로 해줘', '<say>요청 토큰 상한을 20,000으로 바꿀까요?</say><set>adv-set.gen:budget=2만</set>');
  const b1 = await budget();
  const a2 = await say('응 바꿔', '<say>바꿨어요.</say><apply>yes</apply>');
  const b2 = await budget();
  await C.shot('k12-1-2만-적용판');
  const rowBox = await C.row('요청 토큰 상한');
  await step('「2만」 <set> → <apply>', '<set> 뒤엔 그대로(0), <apply> 뒤 20000·판 「제한 없음 → 20000」, 설정 칸도 20,000', 'core/consult.ts consultNum, editor/consult.ts ask (K-13)', async () => ({ actual: { a1: a1.added, b1, a2: a2.added, b2, rowBox: rowBox?.vals }, ok: String(b1 ?? '0') === '0' && String(b2) === '20000' && a2.added.some((x) => /20,?000/.test(x)) }));
  // 2) 되돌리기
  await t.F().locator('.gw-ai [data-action="ai-undo"]').last().click(); await waitIdle(); await sleep(500);
  const b3 = await budget(); const l3 = await log();
  await step('되돌리기', '판 「되돌리기」 → 0(제한 없음), 단추 「되돌렸어요」, 대화 줄이 늘지 않음', 'editor/consult.ts ai-undo (K-13 「되돌리기는 대화에 안 남고」)', async () => ({ actual: { b3, tail: l3.slice(-2), len: l3.length, before: (a2.added.length) }, ok: String(b3 ?? '0') === '0' && l3.some((x) => /되돌렸어요/.test(x)) }));
  // 되돌리기 뒤 다음 요청에 [대화]로 되돌리기가 안 남고 지금 값은 [설정 목록]에
  const a4 = await say('지금 상한은?', '<say>제한 없음이에요.</say>');
  const req4 = a4.req[0] ?? '';
  await step('되돌린 뒤 요청', '요청 [설정 목록]에 budget 지금 「제한 없음」, 대화 줄에 「되돌렸」 글 없음', 'K-13', async () => ({ actual: { line: req4.split('\n').find((s) => s.includes('adv-set.gen:budget')), undoInTalk: /되돌렸/.test(req4) }, ok: /adv-set\.gen:budget\][^\n]*지금: 제한 없음/.test(req4) && !/되돌렸/.test(req4) }));

  // 3) 2억·5천만 (범위 0~200000 밖) → 빠짐
  const a5 = await say('2억으로', '<say>2억으로 할까요?</say><set>adv-set.gen:budget=2억</set>');
  const a6 = await say('그럼 5천만', '<say>5천만으로 할까요?</say><set>adv-set.gen:budget=5천만</set>');
  const a7 = await say('응', '<say>바꿨어요.</say><apply>yes</apply>');
  const b7 = await budget();
  await C.shot('k12-2-2억-5천만');
  await step('「2억」「5천만」 (범위 밖)', '둘 다 「바꿀 수 없는 것은 뺐어요 … 고를 수 없는 값」, 다음 <apply> 는 「바꾸자고 한 것이 없어서」, 값 그대로', 'consultNum 「2억을 2로 읽지 않게」, checkConsult', async () => ({ actual: { a5: a5.added, a6: a6.added, a7: a7.added, b7 }, ok: a5.added.some((x) => /뺐어요/.test(x)) && a6.added.some((x) => /뺐어요/.test(x)) && a7.added.some((x) => /없어서/.test(x)) && String(b7 ?? '0') === '0' }));
  // 4) 0: 먼저 5천으로 → 0(제한 없음)
  await say('5천으로', '<say>5,000으로 할까요?</say><set>adv-set.gen:budget=5천</set>');
  await say('응', '<say>바꿨어요.</say><apply>yes</apply>');
  const b8 = await budget();
  const a9 = await say('다시 제한 없이', '<say>제한 없음으로 할까요?</say><set>adv-set.gen:budget=0</set>');
  const a10 = await say('응', '<say>바꿨어요.</say><apply>yes</apply>');
  const b10 = await budget();
  const a11 = await say('「제한 없음」 글로도', '<say>할까요?</say><set>adv-set.gen:budget=5000</set>');
  await say('응', '<say>바꿨어요.</say><apply>yes</apply>');
  const a12 = await say('제한 없음', '<say>할까요?</say><set>adv-set.gen:budget=제한 없음</set>');
  await say('응', '<say>바꿨어요.</say><apply>yes</apply>');
  const b12 = await budget();
  await step('「5천」 → 0 / 「제한 없음」', '5천=5000, 0 받아 판 「5000 → 제한 없음」, 글 「제한 없음」도 0', 'consultValue zero', async () => ({ actual: { b8, a9: a9.added, a10: a10.added, b10, a12: a12.added, b12 }, ok: String(b8) === '5000' && String(b10 ?? '0') === '0' && a10.added.some((x) => /제한 없음/.test(x)) && String(b12 ?? '0') === '0' }));

  // 5) 최소·최대 짝: 소지품 아바타 동작 간격 최소 30 (최대 24) → 판에 두 줄, 되돌리면 둘 다
  await C.node('set:items'); await sleep(500);
  const g0 = await actGap();
  await say('아바타 동작 간격 최소를 30초로', '<say>최소 30초로 할까요?</say><set>set-items-act-min.n=30</set>');
  const a13 = await say('응', '<say>바꿨어요.</say><apply>yes</apply>');
  const g1 = await actGap();
  await C.shot('k12-3-최소최대-판');
  await t.F().locator('.gw-ai [data-action="ai-undo"]').last().click(); await waitIdle(); await sleep(500);
  const g2 = await actGap();
  await step('최소·최대 짝 (최소 30, 최대 24)', '판에 최소 12→30·최대 24→30 두 줄, 되돌리면 둘 다 처음 값', 'settings.ts:1039-1049 같이 밀기, consult.ts 「같이 바뀐 짝 줄」(2차 AI3)', async () => ({ actual: { g0, a13: a13.added, g1, g2 }, ok: a13.added.some((x) => /최소/.test(x) && /최대/.test(x)) && JSON.stringify(g2) === JSON.stringify(g0) }));
  // 6) 메시지당 변화 상한 글
  const a14 = await say('메시지당 변화 상한 알려줘', '<say>10이에요.</say>');
  const capLine = (a14.req[0] ?? '').split('\n').find((s) => s.startsWith('[pp-cap]'));
  await step('메시지당 변화 상한 글', '요청 줄 「지금: 10」(「10±10」 아님), 고를 수 있는 값 0~100', 'catalog.ts:149 (2차 AI6), people.ts:429', async () => ({ actual: { capLine }, ok: !!capLine && /지금: 10 \|/.test(capLine) && !/±/.test(capLine.split('|')[1]) }));

  // 7) 형식 틀린 답 → 오류 줄 + 다시 시도
  await C.node('set:adv'); await sleep(400);
  const a15 = await say('아무거나', '형식 없는 답');
  const errLine = a15.added.find((x) => /답을 받지 못했어요/.test(x));
  await t.fake('rules/add', { rule: { id: 'k12-retry', route: 'any', match: 'settings help desk', reply: '<say>이제 됐어요.</say>' } });
  const s16 = await t.fakeSeq();
  await t.F().locator('.gw-ai [data-action="ai-retry"]').click(); await waitIdle();
  await t.fake('rules/del', { id: 'k12-retry' });
  const l16 = await log(); const n16 = (await t.fakeLog(s16)).length;
  await C.shot('k12-4-다시시도');
  await step('형식 틀린 답 → 다시 시도', '형식 오류 재시도(생성 공통 1회)까지 틀리면 「답을 받지 못했어요」+「다시 시도」, 누르면 오류 줄이 빠지고 답', 'consult.ts ai-retry', async () => ({ actual: { reqs: a15.reqs.length, errLine, after: l16.slice(-2), n16 }, ok: !!errLine && l16.at(-1).includes('이제 됐어요') && !l16.some((x) => /답을 받지 못했어요/.test(x)) }));

  // 8) 모델 바꾸기: 보조 → 메인 (가짜 서버 /main/ 으로)
  const m0 = (await C.store('goei:prefs')).consultModel;
  await C.act('ai-model'); await sleep(400);
  const m1 = (await C.store('goei:prefs')).consultModel; const lab1 = await t.F().evaluate(() => document.querySelector('.gw-ai .ai-model')?.textContent);
  const a17 = await say('메인으로 묻기', '<say>메인 모델이에요.</say>');
  await C.act('ai-model'); await sleep(400);
  const m2 = (await C.store('goei:prefs')).consultModel;
  const a18 = await say('보조로 묻기', '<say>보조 모델이에요.</say>');
  await step('모델 바꾸기', '기본 보조(prefs 칸 없음) → 누르면 「메인 모델」·consultModel=main·요청이 /main/ → 다시 누르면 칸 빠지고 /aux/', 'consult.ts ai-model, modelOf', async () => ({ actual: { m0, m1, lab1, r17: a17.reqs, m2, r18: a18.reqs }, ok: m0 === undefined && m1 === 'main' && a17.reqs[0]?.route === 'main' && m2 === undefined && a18.reqs[0]?.route === 'aux' }));

  // 9) <open>: 메뉴를 더 달라면 한 번만 더 묻는다 (K-17)
  const a19 = await say('다른 것도 물어볼게', [['\\[pp-cap\\]', '<say>인물 메뉴를 봤어요.</say>'], '<open>인물</open>']);
  await C.node('set:adv'); await sleep(300);
  const a20 = await say('하나 더', '<open>인물</open>');
  await step('<open> 한 번 더 묻기', '<open> 답 뒤 인물 메뉴 줄을 펼쳐 한 번만 더 묻는다(요청 2개). 두 번째도 <open> 뿐이면 더 안 묻고 오류', 'consult.ts ask more (K-17 사용자 결정)', async () => ({ actual: { r19: a19.reqs.length, open2: /\[pp-cap\]/.test(a19.req[1] ?? ''), said19: a19.added, r20: a20.reqs.length, said20: a20.added }, ok: a19.reqs.length === 2 && /\[pp-cap\]/.test(a19.req[1] ?? '') && a19.added.some((x) => /인물 메뉴를 봤어요/.test(x)) && a20.reqs.length === 2 && a20.added.some((x) => /답을 받지 못했어요/.test(x)) }));

  // 10) 채팅이 바뀐 뒤 온 <apply> → steps/k12b.mjs (창을 닫고 채팅을 바꾼다: 창이 열려 있으면 iframe 이 채팅 목록을 덮어 사용자가 못 바꾼다)
  // 정리
  await C.closeSet();
  return { r0, res: R.map((r) => ({ name: r.name, ok: r.ok, err: r.err })) };
}
async function rulesCheck(t) { try { return (await t.fake('rules', undefined))?.length ?? null; } catch { return null; } }
