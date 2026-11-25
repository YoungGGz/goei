// 재확인 EG · R09 나머지: 괴담톡 1:1 답 오는 중 새 채팅(F P4), 이미지 보충(보조 방식) 오는 중 새 채팅(L 단계 15)
// 사용: source /tmp/t2-EG/t2-env.sh && FAKE_URL=… OUT=<dir> node re-phone-asset.mjs [phone|asset]
// 기대값(재확인자): 답·메모는 보낸 채팅(같은 id)에 들어가거나 버려지고, 다른 id 채팅엔 안 들어간다. 받은 답을 버리면 원래 채팅에서 다시 할 길이 보인다
import { openRun, sleep, STATES, msgsText } from './lib.mjs';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-EG/pa';
const want = new Set(process.argv.slice(2));
const on = (p) => !want.size || want.has(p);
const r = await openRun({ out: OUT, fake: process.env.FAKE_URL });
const { t, check, note } = r;
const E = 'c_50303034';
const patch = (...texts) => `<lb-minitalk-patch>${JSON.stringify(texts.map((content) => ({ op: 'add', path: '/messages/-', value: { content, sender: E, type: 'text' } })))}</lb-minitalk-patch>`;
const PHONE = /Append NPC communication/;
const IMG = /Insert <img> tags into a finished narrative/;
const all = () => t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const c = st.DBState.db.characters[ci]; return c.chats.map((ch, i) => ({ i, id: ch.id, name: ch.name, n: ch.message.length, ss: { ...(ch.scriptstate ?? {}) }, last: String(ch.message.at(-1)?.data ?? '').slice(0, 400) })); });
const where = async (text) => (await all()).filter((c) => JSON.stringify(c.ss).includes(text) || c.last.includes(text)).map((c) => ({ i: c.i, id: c.id.slice(0, 8), name: c.name }));

await t.setup();
await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
let L = await all();
const ORIG = L[0].id;
note('준비', '채팅', L.map((c) => [c.i, c.id.slice(0, 8), c.name, c.n]));

if (on('phone') && !process.env.NOPHONE) {
  const S = 'R09-D 괴담톡 1:1 답 오는 중 새 채팅';
  const openDm = async () => {
    await t.openWindow(); await sleep(1500);
    await t.fclick('.gx [data-action="nav-tab"][data-value="phone"]:visible'); await sleep(800);
    await t.F().locator('[data-action="ph-sub"][data-value="contacts"]').first().click().catch(() => {}); await sleep(400);
    await t.fclick(`[data-action="ph-dm"][data-value="${E}"]`).catch(() => {}); await sleep(800);
  };
  // 대조: 보통 답
  r.on('aux', patch('또 무슨 일이야?'), PHONE);
  await openDm();
  await t.F().locator('[data-input=ph-draft]').fill('아까 본 사람 누구예요?'); await t.F().locator('[data-action=ph-send]').click(); await sleep(4000);
  const ph0 = JSON.stringify((await all()).find((c) => c.id === ORIG).ss.$ph_state ?? '');
  check(S, '대조: 보통 답은 원래 채팅 방에 붙음', ph0.includes('또 무슨 일이야?'), '붙음', ph0.slice(-200));
  // 붙잡고 새 채팅
  r.clearHandlers();
  r.on('aux', patch('번호 밀린 뒤 온 답장 재확인.'), PHONE);
  r.hold('aux');
  await t.F().locator('[data-input=ph-draft]').fill('새 채팅 시험.'); await t.F().locator('[data-action=ph-send]').click();
  await r.until(async () => r.held().length, 15000);
  await t.closeWindow();
  await t.newChat(); await sleep(1500);
  L = await all();
  note(S, '새 채팅 뒤 목록', L.map((c) => [c.i, c.id.slice(0, 8), c.name]));
  await r.unhold('aux'); await sleep(4000);
  const w = await where('번호 밀린 뒤 온 답장 재확인.');
  note(S, '답 글이 들어간 채팅', w);
  check(S, '기대: 다른 id 채팅에 답 없음', w.every((x) => x.id === ORIG.slice(0, 8)), '없음 또는 원래만', w);
  check(S, '기대(재확인자): 받은 답이 원래 채팅에 들어감 (버려지지 않음)', w.some((x) => x.id === ORIG.slice(0, 8)), '원래 채팅', w, '공-02');
  await t.switchChat((await all()).findIndex((c) => c.id === ORIG)); await sleep(1500);
  await openDm();
  const logTxt = await t.feval(() => document.querySelector('.ph-log')?.innerText ?? '');
  note(S, '원래 채팅으로 돌아와 연 방 끝', logTxt.slice(-160));
  await t.shot('R09-D-phone-back');
  await t.feval(() => document.querySelector('[data-action="ph-skip"]')?.click());
  await t.closeWindow();
  await t.switchChat((await all()).findIndex((c) => c.id === ORIG)); await sleep(1200);
}

if (on('asset')) {
  const S = 'R09-E 이미지 보충 오는 중 새 채팅';
  r.clearHandlers();
  // 설정 → 캐릭터 이미지 → 보조 방식 (L 구간과 같은 화면 길)
  const F0 = await t.openWindow('.gx');
  const F = await t.frame('.gx');
  const gwVis = await F.evaluate(() => !!document.querySelector('.gw')?.getClientRects().length);
  if (!gwVis) { await F.locator('[data-action="ed-open"]:visible').first().click({ timeout: 8000 }); await sleep(900); }
  if (!(await F.evaluate(() => !!document.querySelector('.gw [data-action="ed-node"][data-value="set:image"]')))) { await F.locator('.gw [data-action="ed-tab"][data-value="set"]').first().click({ timeout: 8000 }); await sleep(600); }
  await F.locator('.gw [data-action="ed-node"][data-value="set:image"]').first().click({ timeout: 8000 }); await sleep(700);
  await F.locator('.gw [data-action="set-asset-model"][data-value="aux"]').first().click({ timeout: 8000 }); await sleep(700);
  await F.locator('.gw [data-action="ed-close"]').first().click({ timeout: 5000 }).catch(() => {}); await sleep(500);
  await t.closeWindow();
  const STATUS = (time) => `[▣|2025.03.14|${time}|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]`;
  const REPLY = (n, time) => `잼트리가 고개를 갸웃했다. "벌써 가려고?" (보조 ${n})\n\n쟈알디가 로비 반대편에서 걸어왔다. 짧게 고개를 끄덕였다.\n\n창밖으로 오후 햇빛이 길게 들었다.\n\n${STATUS(time)}`;
  const PATCH_OK = '[{"line":1,"tag":"<img=\\"Jaemtri_curious\\">"},{"line":2,"tag":"<img=\\"Jyaldi_serious\\">"}]';
  // 대조: 보통 턴
  r.on('aux', PATCH_OK, IMG);
  r.once('main', REPLY(1, '10:30 AM'));
  let s = r.lastSeq();
  await t.send('[E1] 둘러본다.');
  await r.until(async () => r.since(s, 'aux').some((x) => IMG.test(msgsText(x.body))), 25000); await sleep(3000);
  const c1 = (await all()).find((c) => c.id === ORIG);
  check(S, '대조: 보통 턴은 원래 채팅 응답에 태그 붙음', /Jaemtri_curious/.test(c1.last), '태그 있음', c1.last.slice(0, 200));
  // (가) 정상 답 붙잡고 새 채팅
  for (const [k, reply] of [['가', PATCH_OK], ['나', '']]) {
    r.clearHandlers();
    r.on('aux', reply, IMG);
    r.once('main', REPLY(k === '가' ? 2 : 3, k === '가' ? '10:40 AM' : '10:50 AM'));
    // 원래 채팅으로
    await t.switchChat((await all()).findIndex((c) => c.id === ORIG)); await sleep(1500);
    const holdUntil = r.lastSeq();
    r.hold('aux');
    await t.send(`[E-${k}] 기다린다.`, { wait: false });
    await r.until(async () => r.held().some((x) => IMG.test(msgsText(x.body))), 30000);
    // 이미지 말고 붙잡힌 다른 보조(Router·갱신기 등)는 먼저 풀어 줌
    note(S + k, '붙잡힌 보조 요청 종류', r.held().map((x) => (IMG.test(msgsText(x.body)) ? 'img' : x.kind)));
    await t.waitIdle?.().catch?.(() => {});
    await sleep(1500);
    await t.newChat(); await sleep(1500);
    const before = await all();
    await r.unhold('aux'); await sleep(5000);
    const after = await all();
    const o = after.find((c) => c.id === ORIG);
    const newC = after[0];
    const changed = after.filter((c) => c.id !== ORIG).map((c) => { const b = before.find((x) => x.id === c.id); return { i: c.i, id: c.id.slice(0, 8), name: c.name, note: c.ss.$goei_asset_note ?? null, noteBefore: b?.ss?.$goei_asset_note ?? null, lastChanged: b?.last !== c.last }; }).filter((x) => x.note !== x.noteBefore || x.lastChanged);
    note(S + k, '원래 채팅 마지막 응답 태그·메모', { tag: /<img=/.test(o.last), note: o.ss.$goei_asset_note ?? null });
    note(S + k, '다른 채팅에 생긴 변화(메모·마지막 글)', changed);
    if (k === '가') check(S + k, '기대(재확인자): 응답 글이 그대로면 원래 채팅 응답에 태그가 붙는다', /Jaemtri_curious/.test(o.last), '태그', o.last.slice(0, 160), 'L-06');
    check(S + k, '기대: 다른 id 채팅에 메모·글 변화 없음', changed.length === 0, '없음', changed);
    note(S + k, '새 채팅(0번)', { id: newC.id.slice(0, 8), name: newC.name, note: newC.ss.$goei_asset_note ?? null });
    await t.shot(`R09-E${k}`);
  }
}
note('끝', '[goei] 로그', (t.errors ?? []).filter((e) => /goei\] (이미지|조작|괴담)/.test(e)).slice(-10));
await r.stop();
r.writeResults();
process.exit(0);
