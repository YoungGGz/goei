// B2·B4·요원으로 플레이 (실제 리스아이, 시작 패널 실제 단추)
// 사용: FAKE_URL=… node runB2.mjs <pre|b4|player>
//  pre   : 시작 전 설정 창(기본값 범위) — 범위 표시, 시작 전 AI 상담(보조 호출·답 표시·대화가 본편에 안 섞임)
//  b4    : 아바타 남 고르기 + 시작 잔고 50,000 으로 고쳐 직접 입력 출발 → 첫 본편 요청 잔고·성별 말 없음·아바타 저장
//  player: 관리국 요원으로 플레이(첫 요원) + 직접 입력 → 첫 본편 요청: 주인공 자리 = 그 요원 로어 본문(B-16)·{{user}}·User 낱말
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { OUT, sleep, baseRules, turn, text } from './lib.mjs';

const which = process.argv[2] ?? 'b4';
const tag = `B2-${which}`;
const t = await openT2({ via: 'plain' });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 700)); };
const directReply = (req) => `평범한 아침이었다.\n\n[▣|${req.fields.map((x) => ({ 날짜: '2025.03.14', 시각: '09:00 AM', 위치: '사무실', 신분: '-', 잔고: req.start.Balance ?? '0', 포인트: req.start.Points ?? '0' })[x] ?? '없음').join('|')}]`;
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: [{ id: 'consult', route: 'aux', match: '시험 상담 질문', reply: '<say>시작 잔고는 설정 › 소지품에서 바꿀 수 있어요.</say>' }, ...baseRules()] });
  await t.setup();
  await t.fabReady();
  await t.openWindow('.gx-fac');
  if (which === 'pre') {
    await t.F().click('[data-action="prefs-open"]');
    await sleep(1500);
    const scope = await t.feval(() => ({ scope: [...document.querySelectorAll('.gx-scope, .gw-scope, [data-action="set-scope"], .gw-head small')].map((e) => e.innerText).slice(0, 6), head: document.querySelector('.gw-page h2')?.innerText ?? null, tabs: [...document.querySelectorAll('[data-action="ed-tab"]')].map((b) => b.innerText.trim()) }));
    step('시작 전 설정 창', '기본값 범위만(채팅 범위 없음)', scope, null);
    await t.shot(`${tag}-01-prefs`);
    const s0 = await t.fakeSeq();
    await t.F().click('[data-action="ai-toggle"]');
    await sleep(800);
    await t.F().fill('[data-input="ai-q"]', '시험 상담 질문: 시작 잔고는 어디서 바꿔?');
    await t.F().click('[data-action="ai-send"]');
    let lines = []; for (let i = 0; i < 30; i++) { await sleep(500); lines = await t.feval(() => [...document.querySelectorAll('.gw-ai-log .ai-m, .gw-ai-log .ai-err')].map((e) => e.className.split(' ').pop() + ':' + e.innerText.slice(0, 80))); if (lines.some((l) => /ai-op|ai-err/.test(l))) break; }
    const aux = await t.fakeLog(s0, 'aux');
    step('시작 전 AI 상담', '보조 호출 1번, 상담원 답이 창에 뜸', { lines, aux: aux.map((x) => text(x.body.messages?.[0]?.content).slice(0, 40)) }, lines.some((l) => /ai-op/.test(l)) && aux.length >= 1);
    await t.shot(`${tag}-02-consult`);
    await t.F().click('[data-action="ai-close"]').catch(() => {});
    await t.F().click('[data-action="ed-close"]').catch(() => {});
    await sleep(800);
    // 직접 입력으로 출발 → 첫 본편 요청에 상담 대화가 없는지
    await t.F().click('.gx-fac[data-value="A00"]'); await sleep(300);
    const fm = await t.feval(() => [...document.querySelectorAll('[data-action="fm"]')].find((b) => /직접 입력/.test(b.innerText))?.dataset.value);
    await t.F().click(`[data-action="fm"][data-value="${fm}"]`); await sleep(300);
    await t.F().fill('[data-input="start-note"]', '평소처럼 출근한 아침, 사무실 자리에 앉는다.');
    const r = await turn(t, null, () => t.F().click('.gx-foot .gx-start'), { replyFn: directReply });
    const all = (r.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
    step('출발 뒤 첫 본편 요청', '상담 대화 글 없음', { consultInMain: /시험 상담 질문|설정 › 소지품/.test(all) }, !/시험 상담 질문|설정 › 소지품/.test(all));
  }
  if (which === 'b4') {
    await t.F().click('.gx-fac[data-value="A00"]'); await sleep(300);
    await t.F().click('[data-action="look-open"]'); await sleep(800);
    await t.F().click('[data-action="look-g"][data-value="남"]').catch(() => {}); await sleep(800);
    const looks = await t.feval(() => [...document.querySelectorAll('[data-action="look"]')].map((b) => b.dataset.value).slice(0, 5));
    if (looks[0]) await t.F().click(`[data-action="look"][data-value="${looks[0]}"]`);
    await sleep(600);
    await t.F().click('.gx-lookpop-head [data-action="look-close"]').catch(() => {});
    await sleep(400);
    const fm = await t.feval(() => [...document.querySelectorAll('[data-action="fm"]')].find((b) => /직접 입력/.test(b.innerText))?.dataset.value);
    await t.F().click(`[data-action="fm"][data-value="${fm}"]`); await sleep(300);
    await t.F().fill('[data-input="start-note"]', '평소처럼 출근한 아침, 사무실 자리에 앉는다.');
    await t.F().fill('.st-won', '50,000');
    await t.F().dispatchEvent('.st-won', 'change');
    await sleep(500);
    const panel = await t.feval(() => ({ won: document.querySelector('.st-won')?.value, look: document.querySelector('.gx-look .on, .gx-lookc.on')?.getAttribute('aria-label') ?? null }));
    step('출발 전 패널', '잔고 50,000, 아바타 고름', { panel, looks }, panel.won === '50,000');
    await t.shot(`${tag}-01-panel`);
    const r = await turn(t, null, () => t.F().click('.gx-foot .gx-start'), { replyFn: directReply });
    const all = (r.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
    const st = await t.chatState(true);
    const ss = st.scriptstate ?? {};
    step('첫 본편 요청 잔고', '50000', r.req.start, String(r.req.start.Balance ?? '').replace(/,/g, '') === '50000');
    step('성별·아바타가 본편에 안 감', '「Persona Male」·남성 아바타 말 없음', { male: /Persona Male|male avatar|남성 아바타/i.test(all) }, !/Persona Male|male avatar|남성 아바타/i.test(all));
    step('채팅에 아바타 저장', '(관찰) 아바타 변수', Object.fromEntries(Object.entries(ss).filter(([k]) => /look|ava/i.test(k))), null);
    const st2 = await t.chatState(true);
    step('답 뒤 상태창 잔고', '(관찰) 50000 이 이어짐', String(st2.message.at(-1)?.data ?? '').match(/\[▣[^\]]*\]/)?.[0], null);
  }
  if (which === 'player') {
    await t.F().click('.gx-fac[data-value="A00"]'); await sleep(300);
    const players = await t.feval(() => [...document.querySelectorAll('[data-action="player"]')].map((b) => ({ id: b.dataset.value, name: b.querySelector('b')?.innerText })));
    const p = players.find((x) => x.id);
    await t.F().click(`[data-action="player"][data-value="${p.id}"]`); await sleep(500);
    const sc = await t.feval(() => [...document.querySelectorAll('[data-action="fm"]')].map((b) => ({ fm: b.dataset.value, label: b.innerText.replace(/\s+/g, ' ').trim() })));
    const lookLocked = await t.feval(() => document.querySelector('.gx-body section:nth-of-type(3)')?.innerText?.replace(/\s+/g, ' ').slice(0, 120));
    step('요원 고른 뒤 시작 방식·아바타 칸', '첫 장면(있으면)·직접 입력·커스텀 임무, 아바타는 그 인물로 잠김', { p, sc: sc.map((x) => x.label), lookLocked }, null);
    const fm = sc.find((x) => /직접 입력/.test(x.label)).fm;
    await t.F().click(`[data-action="fm"][data-value="${fm}"]`); await sleep(300);
    await t.F().fill('[data-input="start-note"]', '평소처럼 출근한 아침, 사무실 자리에 앉는다.');
    await t.shot(`${tag}-01-panel`);
    const r = await turn(t, null, () => t.F().click('.gx-foot .gx-start'), { replyFn: directReply });
    const msgs = r.rec.body.messages ?? [];
    const all = msgs.map((m) => text(m.content)).join('\n');
    const persona = msgs.map((m, i) => ({ i, role: m.role, t: text(m.content) })).filter((x) => /Protagonist|주인공|\[Player\]|You play/i.test(x.t.slice(0, 200)));
    step('첫 본편 요청 주인공 자리', 'B-16: 페르소나 설명 자리에 그 요원 로어 본문만', { personaBlocks: persona.map((x) => ({ i: x.i, role: x.role, head: x.t.slice(0, 160) })), nameCount: (all.match(new RegExp(p.name, 'g')) ?? []).length }, null);
    step('{{user}}·User 낱말', '{{user}} 0, 「User」 이름 0', { userTag: (all.match(/\{\{user\}\}/g) ?? []).length, User: (all.match(/\bUser\b/g) ?? []).length }, (all.match(/\{\{user\}\}/g) ?? []).length === 0);
    writeFileSync(`${OUT}/${tag}-request.txt`, msgs.map((m, i) => `===== [${i}] ${m.role}\n${text(m.content)}`).join('\n\n').replace(/(Age:\s*)[^\n]*/g, '$1[생략]'));
  }
  await t.shot(`${tag}-end`);
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-40);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
