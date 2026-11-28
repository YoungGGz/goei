// B 대표 줄기 1: 관리국 · 인물 장면(면접). 새 채팅(setup 의 Chat 1)에서 시작 패널 → 출발 → 첫 장면 힌트 → 새로고침 뒤 힌트 → 창 안 열고 바로 보내기(B-8)
//  → 첫 요청 글(시드·NEW 줄·잔고·User 이름) → 인물 기록 갱신기 요청의 표식(0단계 1) → 저장된 첫 장면의 {{user}}(0단계 2) → 둘째 전송 시드 빠짐(B-10)
// 사용: FAKE_URL=http://192.0.2.2:8796 node runB1.mjs [--w 1280 --h 800]
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { OUT, sleep, baseRules, turn, FLOWS, redact, reqText, text } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const tag = `B1-${W}x${H}`;
const t = await openT2({ via: 'plain', width: W, height: H, touch: W < 600 });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok, extra) => { res.steps.push({ name, expect, actual, ok, ...(extra ? { extra } : {}) }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 300)); };
const hintOn = () => t.R(() => { const b = document.querySelector('.default-chat-screen .risu-chat[data-chat-index="0"]'); const c = b?.querySelector('[data-goei-card="opening"]'); return c ? { shown: c.offsetParent !== null, text: c.innerText.replace(/\s+/g, ' ') } : null; });
const allMain = async (since) => (await t.fakeLog(since, 'main'));
const allAux = async (since) => (await t.fakeLog(since, 'aux'));
const F = FLOWS['가'];
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await t.fabReady();
  // ── 시작 패널 → 출발 ──
  const picked = await t.startPanel(F.start);
  await sleep(2500);
  let st = await t.chatState(true);
  const m0 = String(st.message[0]?.data ?? '');
  step('출발 뒤 첫 장면 메시지', 'char 1개, 끝에 %%GOEI_SCENE%%, {{user}} 그대로', { n: st.message.length, role: st.message[0]?.role, sceneMark: m0.includes('%%GOEI_SCENE%%'), userTag: (m0.match(/\{\{user\}\}/g) ?? []).length }, st.message.length === 1 && st.message[0]?.role === 'char' && m0.includes('%%GOEI_SCENE%%'));
  await t.closeWindow();
  await sleep(1000);
  const h1 = await hintOn();
  step('첫 장면 힌트(첫 행동·재선택)', '보임', h1, !!h1?.shown && /첫 행동/.test(h1.text) && /재선택/.test(h1.text));
  const scrM0 = await t.waitScreenText(0, /\S/, 5000);
  step('첫 장면 화면 글에 표식 없음', '%%·{{user}} 안 보임', scrM0?.slice(0, 120), !!scrM0 && !/%%|\{\{user\}\}/.test(scrM0));
  await t.shot(`${tag}-01-opening`);
  // ── 새로고침 뒤 힌트 ──
  await t.reload({ settle: true });
  await sleep(4000);
  const h2 = await hintOn();
  step('새로고침 뒤 힌트 다시 붙음', '보임', h2, !!h2?.shown);
  await t.shot(`${tag}-02-reload-opening`);
  // ── B-8: 새로고침 뒤 창을 열지 않고 바로 보내기 ──
  const s0 = await t.fakeSeq();
  const r1 = await turn(t, F.turns[0]);
  const all1 = (r1.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
  writeFileSync(`${OUT}/${tag}-turn1-main.txt`, redact(reqText(r1.rec.body)));
  step('B-8 첫 요청: 유저 이름 자리', '{{user}}·빈 이름(「\'s current」) 없음', { userTag: (all1.match(/\{\{user\}\}/g) ?? []).length, emptyName: /(^|\s)'s current|\bAddress → \s/.test(all1), UserWord: (all1.match(/\bUser\b/g) ?? []).length }, !/\{\{user\}\}/.test(all1) && !/(^|\s)'s current/.test(all1));
  step('B-8 첫 요청: 상태창 지침·명부', '## Status · ## Roster 있음', { status: all1.includes('## Status'), roster: all1.includes('## Roster'), fields: r1.req.fields }, all1.includes('## Status') && all1.includes('## Roster'));
  step('B-7 첫 요청: 시드(A00-1 = 관리국·쟈알디·잼트리·큐라스·고르고디오)', '넷 다 Character 머리로 들어감', ['Jyaldi', 'Jaemtri', 'Kyuras', 'Gorgodio'].map((n) => [n, all1.includes(`### Character - ${n}`)]), ['Jyaldi', 'Jaemtri', 'Kyuras', 'Gorgodio'].every((n) => all1.includes(`### Character - ${n}`)));
  step('B-7 첫 요청: 상황판 NEW 줄', '있음(B-08 정상)', r1.req.entries.filter((e) => e.isNew).length, r1.req.entries.some((e) => e.isNew));
  step('B-7 첫 요청: 잔고 시작값', 'Starting values: Balance = 140000', r1.req.start, r1.req.start.Balance === '140000');
  step('첫 요청에 플러그인 표식 없음', '%%…%% 없음', (all1.match(/%%[A-Z_\/]+[:%]/g) ?? []), !/%%(SEED|GOEI_SCENE|SCENE_CARD|GOEI_UNSENT|GOEI_START)/.test(all1));
  st = await t.chatState(true);
  const m0b = String(st.message[0]?.data ?? '');
  step('0단계 2: 첫 전송 뒤 저장된 첫 장면', '(관찰) {{user}} → 페르소나 이름으로 바뀌는지', { userTag: (m0b.match(/\{\{user\}\}/g) ?? []).length, User: (m0b.match(/User/g) ?? []).length, sceneMark: m0b.includes('%%GOEI_SCENE%%') }, null);
  const aux1 = await allAux(s0);
  const upd = aux1.filter((x) => /People Record Updater|인물 기록 갱신/.test(JSON.stringify(x.body).slice(0, 4000)));
  const marks = aux1.map((x) => ({ seq: x.seq, kind: (JSON.stringify(x.body).match(/# ([A-Z][A-Za-z ]+?)(?:\\n| —)/) ?? [])[1] ?? '?', marks: [...new Set(JSON.stringify(x.body).match(/%%[A-Z_\/]+%%?/g) ?? [])] }));
  step('0단계 1: 보조 요청의 플러그인 표식', '없어야 함', marks, marks.every((m) => !m.marks.length));
  if (upd[0]) writeFileSync(`${OUT}/${tag}-turn1-updater.json`, redact(JSON.stringify(upd[0].body, null, 1)));
  // ── 둘째 전송: 시드 빠짐 ──
  const s1 = await t.fakeSeq();
  const r2 = await turn(t, F.turns[1]);
  const all2 = (r2.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
  writeFileSync(`${OUT}/${tag}-turn2-main.txt`, redact(reqText(r2.rec.body)));
  step('B-10 둘째 요청: 시드 빠짐', 'Kyuras·Gorgodio Character 머리 없음', { Kyuras: all2.includes('### Character - Kyuras'), Gorgodio: all2.includes('### Character - Gorgodio') }, !all2.includes('### Character - Kyuras') && !all2.includes('### Character - Gorgodio'));
  step('둘째 요청: [Previous status] 가 첫 답 상태창 줄', '09:20 AM 면담실', r2.req.prevLine, /09:20 AM/.test(r2.req.prevLine));
  const aux2 = await allAux(s1);
  step('둘째 턴 보조 호출 종류', '(관찰) Router 가 본편 앞에', aux2.map((x) => ({ seq: x.seq, head: text(x.body.messages?.[0]?.content).slice(0, 50) })), null);
  // ── 다시 굴리기 (공통 갈래) ──
  const s2 = await t.fakeSeq();
  const before = (await t.chatState(true)).scriptstate;
  const rr = await turn(t, null, () => t.reroll({ wait: false }), { replyFn: (req) => F.turns[1].prose.replace('합격이다', '보류다') + '\n\n' + `[▣|${req.fields.map((f) => ({ 날짜: '2025.03.14', 시각: '09:40 AM', 위치: '서울 종로구 관리국 본부 면담실', 동행: '쟈알디', 신분: '관리국/신입', 잔고: '140000' })[f] ?? '없음').join('|')}]` });
  const allR = (rr.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
  step('다시 굴리기 요청 = 둘째 요청과 같은 [Previous status]', '09:20 AM', rr.req.prevLine, rr.req.prevLine === r2.req.prevLine);
  step('다시 굴리기 요청에 시드 없음', 'Kyuras 없음', allR.includes('### Character - Kyuras'), !allR.includes('### Character - Kyuras'));
  const after = (await t.chatState(true));
  step('다시 굴린 뒤 마지막 답', '보류다 글·상태창 09:40', String(after.message.at(-1)?.data).slice(0, 200), /보류다/.test(String(after.message.at(-1)?.data)));
  // ◀ 로 앞 답
  await t.swipePrev(); await sleep(1500);
  const sw = await t.chatState(true);
  const scr = await t.screenMessages();
  step('◀ 뒤 저장 답·화면 답', '(관찰) 리스AI 가 글만 갈아 끼움', { saved: String(sw.message.at(-1)?.data).slice(0, 60), screen: scr.at(-1)?.text?.slice(0, 60), statusRendered: !/\[▣\|/.test(scr.at(-1)?.text ?? '') }, null);
  await t.swipeNext().catch(() => {}); await sleep(1500);
  await t.shot(`${tag}-03-end`);
  res.world = JSON.parse(after.scriptstate?.$goei_world ?? 'null');
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  res.alerts = await t.alerts().catch(() => null);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
