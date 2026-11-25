// 3차 점검 0번: 상태 파일을 새 브라우저(빈 리스AI 저장소)에서 하나씩 넣어 화면(PC 1280)에 채팅 글이 보이고 플러그인 창이 열리는지 본다 (2026-11-24).
// 사용: FAKE_URL=http://<IP>:<port> node verify-states.mjs [--states <dir>] [--w 1280 --h 800] [--send]
//   --send : S-관리국-3턴 을 넣은 채로 한 번 보내 [Previous status]·대화 기록이 이어지는지도 본다 (가짜 서버 규칙을 바꾸므로 전용 서버에서만)
// 결과: out/s0/verify-<WxH>-<시각>.json, 캡처 out/s0/verify-<WxH>-<상태>.png
import { openT2 } from './risu-t2.mjs';
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const STATES = opt('--states', HERE + 'states');
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const size = `${W}x${H}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ORDER = ['S-start', 'S-관리국-3턴', 'S-상점표식', 'S-백일몽-3턴', 'S-프리랜서-임무', 'S-요원플레이'];
const names = ORDER.filter((n) => readdirSync(STATES).includes(n + '.json'));

const out = { at: new Date().toISOString(), size, states: [], errors: [] };
const t = await openT2({ via: 'plain', streaming: false, width: W, height: H, touch: W < 600, out: HERE + 'out/s0' });
try {
  await t.fake('rules', { rules: [
    { id: 'v-main', route: 'main', reply: '확인용 답.\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]' },
    { id: 'v-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
    { id: 'v-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
    { id: 'v-aux', route: 'aux', reply: '{}' },
  ] });
  out.setup = await t.setup();
  for (const name of names) {
    const file = `${STATES}/${name}.json`;
    const body = JSON.parse(readFileSync(file, 'utf8'));
    const want = body.data.message.length;
    await t.closeWindow();
    const r = await t.loadState(file);
    const st = await t.chatState(true);
    // 메시지 칸 글: 마지막 메시지(있으면)·첫 메시지
    const lastScr = want ? await t.waitScreenText(want - 1, /\S/, 15000) : null;
    const firstScr = want ? await t.waitScreenText(0, /\S/, 5000) : null;
    const scr = await t.screenMessages();
    await t.shot(`verify-${size}-${name}-chat`);
    // 플러그인 창: 시작 전이면 시작 패널(.gx-fac), 시작 뒤면 진행 화면(.gx-nb 탭)
    let win = null, winErr = null;
    try {
      await t.openWindow('.gx');
      await sleep(1200);
      win = await t.feval(() => ({ picker: !!document.querySelector('.gx-fac'), tabs: [...document.querySelectorAll('.gx-nb')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 12), header: document.querySelector('.gx')?.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
    } catch (e) { winErr = String(e.message); }
    await t.shot(`verify-${size}-${name}-window`);
    const shopCard = name === 'S-상점표식' ? await t.R(() => [...document.querySelectorAll('.risu-chat[data-chat-index]')].some((b) => /상점 열기/.test(b.innerText))) : undefined;
    const row = {
      name, load: r, wantMessages: want, gotMessages: st.message.length, sameData: body.data.message.every((m, i) => st.message[i]?.data === m.data),
      scriptstateSame: JSON.stringify(Object.keys(body.data.scriptstate ?? {}).sort()) === JSON.stringify(Object.keys(st.scriptstate ?? {}).sort()),
      faction: st.scriptstate?.$st_faction ?? null, lastScreen: lastScr?.slice(0, 100) ?? null, firstScreen: firstScr?.slice(0, 80) ?? null,
      screenIdx: scr.map((m) => m.idx), emptyText: scr.filter((m) => m.idx >= 0 && !m.text).map((m) => m.idx), win, winErr, shopCard,
      ok: st.message.length === want && (!want || (!!lastScr && !!firstScr)) && !!win && !winErr,
      shots: [`out/s0/verify-${size}-${name}-chat.png`, `out/s0/verify-${size}-${name}-window.png`],
    };
    out.states.push(row);
    console.log(row.ok ? 'OK ' : 'NG ', name, JSON.stringify({ load: r, got: row.gotMessages, last: row.lastScreen?.slice(0, 40), win: win?.picker ? 'picker' : win?.tabs?.slice(0, 4), winErr, shopCard }));
  }
  if (argv.includes('--send')) {
    await t.closeWindow();
    const r = await t.loadState(`${STATES}/S-관리국-3턴.json`);
    const seq0 = await t.fakeSeq();
    await t.send('확인: 넣은 상태에서 한 번 보낸다.');
    await sleep(3000);
    const log = (await t.fakeLog(seq0, 'main'));
    const m = log[0]?.body?.messages ?? [];
    const prev = m.map((x) => String(x.content)).find((c) => c.startsWith('[Previous status]')) ?? null;
    const st = await t.chatState();
    out.send = { load: r, mainRequests: log.length, previousStatus: prev?.slice(0, 300) ?? null, msgsInRequest: m.length, chatMessages: st.message.length, last: st.message.at(-1)?.data?.slice(0, 80) };
    console.log('send', JSON.stringify(out.send).slice(0, 600));
  }
} catch (e) {
  out.errors.push(String(e?.stack ?? e));
  console.error(e);
  try { await t.shot(`verify-${size}-FAIL`); } catch {}
} finally {
  out.console = t.errors.filter((e) => !/displayData|조각 받기|본체/.test(e)).slice(-40);
  const of = `${HERE}out/s0/verify-${size}-${Date.now()}.json`;
  writeFileSync(of, JSON.stringify(out, null, 1));
  console.log('결과:', of, '통과', out.states.filter((s) => s.ok).length, '/', out.states.length);
  await t.close();
}
