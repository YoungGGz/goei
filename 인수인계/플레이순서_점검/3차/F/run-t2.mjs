// 3차 점검 F(폰) · T2(실제 리스AI + 가짜 모델 서버) 다시 돌리기.
// 손으로 돈 순서(메모.md)를 그대로 자동으로. 단계마다 기대값·결정표 번호를 먼저 적고 대조한다.
// 쓰는 법 (저장소 맨 위에서, t2-setup.sh 로 리스AI 를 띄운 뒤):
//   node 인수인계/플레이순서_점검/3차/틀/fake-llm.mjs --port 8797 --log 인수인계/플레이순서_점검/3차/F/out/fake-run.jsonl &
//   FAKE_URL=http://<컨테이너IP>:8797 node 인수인계/플레이순서_점검/3차/F/run-t2.mjs [portrait|landscape|all]
// 결과: F/out/run-t2-<갈래>-<시각>.json, 캡처 F/out/r-*.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openT2 } from '../틀/risu-t2.mjs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const STATES = fileURLToPath(new URL('../틀/states/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const which = process.argv[2] ?? 'all';
const E = 'c_50303034'; // 에일린 P004
const patch = (...texts) => `<lb-minitalk-patch>${JSON.stringify(texts.map((content) => ({ op: 'add', path: '/messages/-', value: { content, sender: E, type: 'text' } })))}</lb-minitalk-patch>`;
const PHONE = 'Append NPC communication';

async function session(name, opts, body) {
  const t = await openT2({ via: 'plain', out: OUT, ...opts });
  const res = { name, opts, steps: [], at: new Date().toISOString() };
  const step = (id, expect, table, ok, actual) => { res.steps.push({ id, expect, table, ok: !!ok, actual }); console.log(ok ? 'ok  ' : 'FAIL', id, JSON.stringify(actual).slice(0, 200)); };
  const rules = (r) => t.fake('rules', { rules: [...r, { id: 'default-aux', route: 'aux', reply: '{}' }, { id: 'default-main', route: 'main', reply: '가짜 본편 답 #{{seq}}.\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]' }] });
  const phState = () => t.R(async () => {
    const st = await import('/src/ts/stores.svelte.ts');
    const ch = st.DBState.db.characters[0];
    return ch.chats.map((c) => { let p = null; try { p = JSON.parse(c.scriptstate?.['$ph_state'] || 'null'); } catch {} return { name: c.name, rooms: p ? Object.values(p.rooms).map((r) => ({ id: r.id, msgs: r.messages.map((m) => String(m.text ?? m.content)), pending: r.pending?.status ?? null })) : [] }; });
  });
  const openPhoneDm = async () => {
    await t.openWindow(); await sleep(1500);
    await t.fclick('.gx [data-action="nav-tab"][data-value="phone"]:visible'); await sleep(800);
    await t.F().locator('[data-action="ph-sub"][data-value="contacts"]').first().click().catch(() => {}); await sleep(400);
    await t.fclick(`[data-action="ph-dm"][data-value="${E}"]`); await sleep(800);
  };
  const sendDm = async (text) => { const f = t.F(); await f.locator('[data-input=ph-draft]').fill(text); await f.locator('[data-action=ph-send]').click(); await sleep(1500); };
  const release = () => t.fake('release', {});
  try {
    await t.fake('reset', {});
    await t.setup();
    await body({ t, step, rules, phState, openPhoneDm, sendDm, release });
  } catch (e) {
    step('예외', '', '', false, String(e?.stack ?? e).slice(0, 800));
    try { await t.shot(`r-${name}-FAIL`); } catch {}
  } finally {
    res.errors = t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습)/.test(x)).slice(-40);
    const f = `${OUT}run-t2-${name}-${Date.now()}.json`;
    writeFileSync(f, JSON.stringify(res, null, 1));
    console.log('결과', f, res.steps.filter((s) => s.ok).length, '/', res.steps.length);
    await t.close();
  }
}

if (which === 'portrait' || which === 'all') await session('portrait', { width: 344, height: 882, touch: true }, async ({ t, step, rules, phState, openPhoneDm, sendDm, release }) => {
  await t.loadState(STATES + 'S-관리국-3턴.json'); // 0 S-관리국-3턴, 1 Chat 1
  // P1 연락처 칩
  await t.openWindow(); await sleep(1500);
  await t.fclick('.gx [data-action="nav-tab"][data-value="phone"]:visible'); await sleep(800);
  const chips = await t.feval(() => [...document.querySelectorAll('[data-action="ph-ctab"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  await t.shot('r-portrait-contacts');
  step('P1 연락처 탭 이름', '세력 묶음 탭 이름이 「이면의 주민들」(「중립」 아님)', '공-20 (사용자 결정)', chips.some((c) => /이면의 주민들/.test(c)) && !chips.some((c) => /^중립/.test(c)), chips);
  await t.closeWindow();
  // P2 1:1 보내기
  await rules([{ id: 'ph', route: 'aux', match: PHONE, reply: patch('또 무슨 일이야?') }]);
  await openPhoneDm(); await sendDm('아까 로비에서 본 사람 누구예요?'); await sleep(2500);
  let s = await phState();
  step('P2 1:1 보내기 → 답 붙음', '내 말 + 에일린 답이 0번 채팅 방에 저장', '—', s[0].rooms[0]?.msgs.join('/') === '아까 로비에서 본 사람 누구예요?/또 무슨 일이야?', s[0].rooms);
  // P3 답 붙잡은 채 다른 채팅(번호 안 밀림)
  await rules([{ id: 'ph-hold', route: 'aux', match: PHONE, hold: true, reply: patch('늦은 답장 하나.') }]);
  await sendDm('그 손님 이름 알아요?'); await t.closeWindow(); await t.switchChat(1); await release(); await sleep(4000);
  s = await phState();
  step('P3 늦은 답 중 다른 채팅(번호 그대로)', '답은 보낸 채팅(S-관리국)에, 다른 채팅엔 아무것도 없음', '공통 「다른 채팅 다녀오기」', s[0].rooms[0]?.msgs.at(-1) === '늦은 답장 하나.' && !s[1].rooms.length, s.map((c) => [c.name, c.rooms.map((r) => r.msgs.length + ':' + r.pending)]));
  // P4 답 붙잡은 채 새 채팅(번호 +1)
  await t.switchChat(0); await openPhoneDm();
  await rules([{ id: 'ph-hold2', route: 'aux', match: PHONE, hold: true, reply: patch('번호 밀린 뒤 온 답장.') }]);
  await sendDm('새 채팅 시험.'); await t.closeWindow(); await t.newChat(); await release(); await sleep(4000);
  s = await phState();
  const orig = s.find((c) => c.name === 'S-관리국-3턴');
  step('P4 늦은 답 중 새 채팅(번호 +1 밀림)', '[기준을 먼저 적음] 리스AI 본편은 이때 밀려 들어온 채팅에 답을 씀(리스AI 동작). 플러그인은 엉뚱한 채팅에 쓰지 않아야 함. 답이 원래 채팅에 들어가면 가장 좋음', '공통 「답 오는 중 다른 채팅 + 번호 밀기」', !s[0].rooms.length, { orig: orig?.rooms.map((r) => ({ last: r.msgs.at(-1), pending: r.pending })), newChat0: s[0].rooms });
  step('P4b 그 답이 원래 채팅에 들어갔나', '(정보) 들어갔으면 true', '—', orig?.rooms[0]?.msgs.at(-1) === '번호 밀린 뒤 온 답장.', orig?.rooms[0]?.pending);
  // P5 답 붙잡은 채 새로고침 → 다시 시도
  await t.switchChat(1); await openPhoneDm();
  // P4 에서 남은 「답장을 받지 못했어요」를 건너뛰어야 입력칸이 풀린다
  const skipped = await t.feval(() => { const b = document.querySelector('[data-action="ph-skip"]'); b?.click(); return !!b; }); await sleep(800);
  step('P4c 원래 채팅으로 돌아오면 「다시 시도·건너뛰기」가 떠 있음', '버려진 답 자리에 다시 시도·건너뛰기', '—', skipped, skipped);
  await rules([{ id: 'ph-hold3', route: 'aux', match: PHONE, hold: true, reply: patch('안 올 답.') }]);
  await sendDm('새로고침 시험.'); await t.reload(); await release();
  await rules([{ id: 'ph-ok', route: 'aux', match: PHONE, reply: patch('다시 시도로 온 답장.') }]);
  await openPhoneDm();
  const logTxt = await t.feval(() => document.querySelector('.ph-log')?.innerText ?? '');
  step('P5 답 받는 중 새로고침', '「답장을 받지 못했어요」 + 다시 시도·건너뛰기', '2차 10 통과 줄(T2 로 다시)', /답장을 받지 못했어요/.test(logTxt) && /다시 시도/.test(logTxt), logTxt.slice(-120));
  await t.fclick('[data-action="ph-retry"]'); await sleep(3000);
  const logTxt2 = await t.feval(() => document.querySelector('.ph-log')?.innerText ?? '');
  step('P5b 다시 시도', '답이 붙음', '—', /다시 시도로 온 답장/.test(logTxt2), logTxt2.slice(-80));
  await t.closeWindow();
});

if (which === 'landscape' || which === 'all') await session('landscape', { width: 882, height: 344, touch: true }, async ({ t, step, openPhoneDm }) => {
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await openPhoneDm(); await sleep(800);
  await t.shot('r-landscape-dm');
  const del = await t.feval(() => { const e = [...document.querySelectorAll('.ph-room-head [data-action=ph-room-del]')].find((x) => x.offsetParent); const r = e?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
  const hit = del ? await t.R(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[x-goei-prog]') ? 'progwin' : e.tagName) : null; }, del) : null;
  step('L1 폰 가로 괴담톡 방 머리 삭제 단추', '단추 가운데를 누르면 플러그인 창(IFRAME)이 받음, 진행 창이 덮지 않음', 'M-09 (사용자 결정: 폰 가로도 폰 배치)', hit === 'IFRAME', { del, hit });
});
