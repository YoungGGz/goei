// 재확인 KL — T2: R03(다른 봇 채팅 태그) · R63(주인공 이미지 빈 칸) · R65(보충 메모 경우) · R64(보충 중 새로고침) · R67(882×344 칸 크기)
// RISU_URL=… FAKE_URL=… node re-l.mjs   (L/run.mjs 의 순수 도우미만 가져옴, 기록은 scratchpad re-KL/out-l)
import { openT2 } from '../../틀/risu-t2.mjs';
import { imgScreen, gimStyle, openEd, edClick, edClose, chat, isImgAux, text, REPLY_MAIN, REPLY_PLAIN, AUX_BASE, STATUS } from '../../L/run.mjs';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-KL/out-l';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scrub = (s) => String(s).replace(/((?:Age|나이)\s*[:=]\s*)[^\n|,]+/gi, '$1[생략]');
const note = (id, v) => { appendFileSync(OUT + '/steps.jsonl', JSON.stringify({ id, at: new Date().toISOString(), ...v }) + '\n'); console.log(id, JSON.stringify(v).slice(0, 900)); };
const saveReq = (name, r) => { if (!r) return; writeFileSync(`${OUT}/req-${name}.txt`, scrub((r.body?.messages ?? []).map((m, i) => `===== [${i}] ${m.role} =====\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n'))); };
const IMG = 'Insert <img> tags into a finished narrative';
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);

const t = await openT2({ via: 'plain', width: 1280, height: 800, out: OUT, fake: process.env.FAKE_URL });
const rules = (mainRule, auxOver = []) => t.fake('rules', { rules: [mainRule, ...auxOver, ...AUX_BASE] });
const main = (reply, extra = {}) => ({ id: 'main', route: 'main', reply, ...extra });
const turn = async (name, userText, mainRule, auxOver = [], waitAfter = 4500) => {
  const s0 = await t.fakeSeq();
  await rules(mainRule, auxOver);
  await t.send(userText);
  await sleep(waitAfter);
  const lg = await t.fakeLog(s0);
  const m = lg.find((r) => r.route === 'main');
  saveReq(name + '-main', m);
  lg.filter(isImgAux).forEach((r, i) => saveReq(`${name}-aux-img${i || ''}`, r));
  const c = await chat(t);
  return { lg, m, c, last: c.msgs.at(-1)?.data, scr: (await imgScreen(t)).at(-1), calls: lg.map((r) => `${r.route}${isImgAux(r) ? ':IMG' : ''}:${r.seq}`) };
};
const screenOf = () => t.R(() => [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].map((e) => ({ idx: Number(e.dataset.chatIndex), text: (e.querySelector('.chattext')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160), boxes: e.querySelectorAll('.x-risu-gim, .gim').length })).sort((a, b) => a.idx - b.idx));
const charIdx = () => t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); });
const change = async (i) => { await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, i); await sleep(3500); };

try {
  await t.fake('reset', {});
  await rules(main(REPLY_MAIN(0)));
  await t.setup();
  await t.loadState('/home/user/goei/인수인계/플레이순서_점검/3차/틀/states/S-관리국-3턴.json');
  await sleep(6000);
  const goei = await charIdx();
  note('setup', { goei, screen: (await imgScreen(t)).filter((m) => m.boxes).map((m) => `${m.idx}:${m.visible}`) });

  if (want('R03')) {
    const other = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const c = ch.createBlankChar(); c.name = '다른봇'; c.firstMessage = '안녕. <img=Jyaldi_smile> 그리고 <img=Alice_smile> 끝.'; c.chaId = crypto.randomUUID(); c.chats = [{ message: [], note: '', name: 'Chat 1', localLore: [], fmIndex: -1, id: crypto.randomUUID() }]; st.DBState.db.characters.push(c); return st.DBState.db.characters.length - 1; });
    // 1회: 괴이 → 다른봇
    await change(other);
    let s1 = await screenOf();
    await t.shot('R03-1-들어감');
    note('R03-1 괴이→다른봇 첫 메시지', { expect: '「<img=Jyaldi_smile>」「<img=Alice_smile>」 글 그대로, 칸 0 (공-22)', screen: s1 });
    // 사용자 메시지 (가짜 본편 답에도 태그)
    await rules(main('다른봇 답 <img=Alice_smile> 과 <img=Jaemtri_smile> 끝.'));
    const s0 = await t.fakeSeq();
    await t.send('[OTHER] 안녕 <img=Jaemtri_smile> 끝.');
    await sleep(4000);
    const lg = await t.fakeLog(s0);
    saveReq('R03-otherbot-main', lg.find((r) => r.route === 'main'));
    const s2 = await screenOf();
    await t.shot('R03-2-보낸뒤');
    note('R03-2 다른봇에서 보낸 뒤', { calls: lg.map((r) => r.route + ':' + r.seq), screen: s2 });
    for (let k = 2; k <= 4; k++) {
      await change(goei);
      await change(other);
      const s = await screenOf();
      await t.shot(`R03-${k + 1}-다시들어감${k - 1}`);
      note(`R03-${k + 1} 괴이→다른봇 다시 (${k - 1})`, { screen: s });
    }
    // 대조: 다른봇에 있는 채로 새로고침(괴이 채팅을 거치지 않고 그림)
    await t.reload({ settle: true, reselect: false });
    await sleep(3000);
    if ((await charIdx()) !== other) await change(other);
    note('R03-6 다른봇 상태로 새로고침(대조)', { now: await charIdx(), screen: await screenOf() });
    await t.shot('R03-6-새로고침대조');
    await change(goei);
    await sleep(3000);
  }

  if (want('R63')) {
    const persona = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const db = st.DBState.db; return { userIcon: db.userIcon ? String(db.userIcon).slice(0, 40) : null, sel: db.selectedPersona, personas: (db.personas ?? []).map((p) => ({ name: p.name, icon: p.icon ? String(p.icon).slice(0, 30) : null })) }; });
    const ssPlayer = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const c = st.DBState.db.characters[st.DBState.db.characters.length - 1]; return null; });
    await openEd(t, 'set:image');
    const playerRow = await (await t.frame('.gx', 5000)).evaluate(() => document.querySelector('.gw [data-action="set-asset-player"]')?.closest('.ps-row')?.innerText?.replace(/\s+/g, ' ').slice(0, 200) ?? null);
    await edClick(t, 'set-asset-player', '1');
    await edClose(t);
    const r = await turn('R63-player', '[R63] 거울을 본다.', main(`나는 거울 속 나를 본다.\n\n<img=User_smile>\n\n잼트리가 웃었다.\n\n<img=Jaemtri_smile>\n\n${STATUS('10:50 AM')}`));
    const tx = text(r.m);
    const names = (tx.match(/Characters?[^\n]*:\s*\n?([^\n]{0,400})/) ?? [])[0];
    await t.page.evaluate(() => { const b = [...document.querySelectorAll('.default-chat-screen .x-risu-gim, .default-chat-screen .gim')].at(-2); b?.scrollIntoView({ block: 'center' }); });
    await sleep(800);
    const boxes = await t.R(() => { const m = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].sort((a, b) => b.dataset.chatIndex - a.dataset.chatIndex)[0]; return [...m.querySelectorAll('.x-risu-gim, .gim, img')].map((b) => { const s = getComputedStyle(b); const rc = b.getBoundingClientRect(); return { tag: b.tagName, cls: b.className, w: Math.round(rc.width), h: Math.round(rc.height), bg: s.backgroundImage.slice(0, 50), src: (b.getAttribute('src') ?? '').slice(0, 50) }; }); });
    await t.shot('R63-주인공이미지');
    note('R63 주인공 이미지 켬 + <img=User_smile>', { expect: '사진 없으면 칸을 그리지 않음 (imgtag.ts 주석, 사용자 2026-10-26)', persona, playerRow, reqHasUserName: /\bUser\b/.test(names ?? ''), doNotUser: /Do not create tags for User/.test(tx), namesLine: names?.slice(0, 300), saved: (r.last ?? '').match(/<img=[^>]+>/g), boxes, stPlayer: r.c.ss });
    await openEd(t, 'set:image'); await edClick(t, 'set-asset-player', '0'); await edClose(t);
  }

  if (want('R67')) {
    await t.page.setViewportSize({ width: 882, height: 344 });
    await sleep(1500);
    await t.page.evaluate(() => { const b = [...document.querySelectorAll('.default-chat-screen .x-risu-gim, .default-chat-screen .gim')].pop(); b?.scrollIntoView({ block: 'center' }); });
    await sleep(800);
    const st = await gimStyle(t);
    const all = await t.R(() => [...document.querySelectorAll('.default-chat-screen .x-risu-gim, .default-chat-screen .gim')].map((b) => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]));
    await t.shot('R67-882x344');
    note('R67 882×344 (같은 세션 창 크기만 바꿈, 터치 아님)', { vh: 344, first: st, all: all.slice(-4) });
    await t.page.setViewportSize({ width: 1280, height: 800 });
    await sleep(1000);
  }

  if (want('R65') || want('R64')) { await openEd(t, 'set:image'); await edClick(t, 'set-asset-model', 'aux'); await edClose(t); }
  if (want('R65')) {
    const cases = [['ok', {}], ['prose', { reply: '잼트리와 쟈알디에게 태그를 붙이면 좋겠습니다.' }], ['emptyArr', { reply: '[]' }], ['badtags', { reply: '[{"line":1,"tag":"<img=\\"Nobody_smile\\">"},{"line":9,"tag":"<img=\\"Jaemtri_smile\\">"},{"line":2,"tag":"<img=\\"Jyaldi_neutral\\">"}]' }]];
    let n = 60;
    for (const [k, o] of cases) {
      const over = k === 'ok' ? [] : [{ id: 'aux-img-x', route: 'aux', match: IMG, ...o }];
      const r = await turn('R65-' + k, `[R65 ${k}] 잠시 기다린다.`, main(REPLY_PLAIN(n++, '11:30 AM')), over);
      note('R65 ' + k, { calls: r.calls, note: r.c.ss.$goei_asset_note ?? null, tags: (r.last ?? '').match(/<img=[^>]+>/g) });
    }
  }

  if (want('R64')) {
    // 보조 방식 그대로 (R65 에서 aux). 보충 호출을 붙잡고 새로고침
    const s0 = await t.fakeSeq();
    await rules(main(REPLY_PLAIN(80, '12:00 PM')), [{ id: 'aux-img-hold', route: 'aux', match: IMG, hold: true, reply: '[{"line":1,"tag":"<img=\\"Jaemtri_curious\\">"}]' }]);
    await t.send('[R64] 보충 중 새로고침.', { wait: false });
    let pend = [];
    for (let i = 0; i < 40; i++) { pend = await t.fake('pending'); if ((pend.pending ?? pend).some?.((p) => p.ruleId === 'aux-img-hold')) break; await sleep(500); }
    note('R64 붙잡힘', { pending: pend });
    await t.reload({ settle: true });
    await sleep(2000);
    await t.fake('release', {});
    await sleep(6000);
    const lg = await t.fakeLog(s0);
    const c = await chat(t);
    await t.shot('R64-새로고침뒤');
    const after = await t.fakeLog(s0);
    note('R64 보충 중 새로고침 → 풀기', { calls: after.map((r) => `${r.route}${isImgAux(r) ? ':IMG' : ''}:${r.seq}:${r.response?.closedByClient ? 'closed' : r.response?.status}`), lastTags: (c.msgs.at(-1)?.data ?? '').match(/<img=[^>]+>/g), note: c.ss.$goei_asset_note ?? null, lastHead: (c.msgs.at(-1)?.data ?? '').slice(0, 60) });
    // 새로고침 뒤 다시 보충하지 않는지 조금 더 봄
    await sleep(5000);
    const later = await t.fakeLog(after.at(-1)?.seq ?? s0);
    note('R64 그 뒤 5초', { more: later.map((r) => `${r.route}${isImgAux(r) ? ':IMG' : ''}:${r.seq}`) });
  }
} catch (e) {
  note('예외', { e: String(e?.stack ?? e).slice(0, 1500) });
  await t.shot('re-l-예외').catch(() => {});
} finally {
  note('콘솔 오류', { errs: t.errors.filter((x) => !/displayData/.test(x)).slice(0, 20) });
  await t.close();
  process.exit(0);
}
