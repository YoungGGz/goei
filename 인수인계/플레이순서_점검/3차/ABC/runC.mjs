// C 평소 턴: S-관리국-3턴에서 시작. C5 생각 블록(본문 속 태그 / reasoning_content, 스트리밍 끔·켬), C6 본편 5xx 자동 재시도,
// C9 Router 시간 제한(늦은 답 버림), C8 보조 기능을 메인 모델로 둔 호출의 지문.
// 사용: FAKE_URL=http://192.0.2.2:8796 node runC.mjs <think|reason|reason-stream|retry|router-timeout|main-model>
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OUT, sleep, baseRules, turn, redact, reqText, text, quietAux, readRequest, buildReply, REPLY_FILE } from './lib.mjs';

const which = process.argv[2] ?? 'think';
const tag = `C-${which}`;
const t = await openT2({ via: 'plain', streaming: which === 'reason-stream' });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 400)); };
const ST = (n) => fileURLToPath(new URL(`../틀/states/${n}.json`, import.meta.url));
const world = (st) => JSON.parse(st.scriptstate?.$goei_world ?? 'null');
// 생각 글에 넣을 가짜 표식: 끝난 괴이(명일 아파트 종료), 다른 상태창 줄(잔고 999), 상점 표식, 그림 태그
const FAKE_THOUGHT = '계획: [AN|서울특별시 노원구|명일 아파트|종료|D|없음|생각 속 종료] 그리고 [▣|2025.03.14|11:11 PM|☀️|12°C|생각 속 장소|없음|없음|없음|관리국/신입|999] [shop: 생각 상점|생각 주인] <img=Kyuras_angry>';
const BODY = { user: '잼트리에게 오후 일정을 묻는다.', prose: '잼트리가 서류철을 넘겼다.\n\n<img=Jaemtri_neutral>\n\n"오후엔 현장 견학이야. 늦지 마."', status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } };
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await t.fabReady();
  await t.loadState(ST('S-관리국-3턴'));
  await sleep(2000);
  const st0 = await t.chatState(true);
  const w0 = world(st0);
  const anName = w0?.an?.find((e) => e.state === '활성')?.name;
  res.start = { msgs: st0.message.length, an: w0?.an?.map((e) => [e.name, e.state]) };
  if (which === 'think') {
    // 본문 속 <think> 블록에 표식을 넣는다 (명일 아파트가 활성이 아니면 활성 괴이 이름으로 바꿈)
    const thought = FAKE_THOUGHT.replace('명일 아파트', anName ?? '명일 아파트');
    for (const tagName of ['think', 'Thoughts', 'thinking']) {
      const s0 = await t.fakeSeq();
      const r = await turn(t, BODY, null, { replyFn: (req) => `<${tagName}>${thought}</${tagName}>\n` + buildReply(req, BODY) });
      const st = await t.chatState(true);
      const w = world(st);
      const last = String(st.message.at(-1)?.data);
      const scr = (await t.screenMessages()).at(-1)?.text ?? '';
      const lastStatus = (last.match(/\[▣\|[^\]\n]*\]/g) ?? []);
      step(`C5 <${tagName}> 상황판 태그`, `생각 속 「${anName} 종료」 무시(활성 그대로)`, w?.an?.find((e) => e.name === anName)?.state ?? '(없어짐)', w?.an?.find((e) => e.name === anName)?.state === '활성');
      step(`C5 <${tagName}> 상태창 줄`, '본문 줄(로비·140000)만 상태창으로, 생각 속 999 줄은 상태창 아님', { statusInSaved: lastStatus.length, screenHas999: /999/.test(scr), screenHasLobby: /로비/.test(scr) }, null);
      step(`C5 <${tagName}> 상점 표식`, '상점 카드 없음', /상점 열기/.test(scr), !/상점 열기/.test(scr));
      const thoughtShown = await t.R(() => { const b = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].sort((a, b) => Number(b.dataset.chatIndex) - Number(a.dataset.chatIndex))[0]; return { imgs: [...(b?.querySelectorAll('img') ?? [])].map((i) => (i.getAttribute('src') ?? '').slice(0, 40)).length, details: !!b?.querySelector('details') }; });
      step(`C5 <${tagName}> 화면`, '(관찰) 그림 칸·생각 접기', thoughtShown, null);
      // 다음 턴 요청의 [Previous status]
      const s1 = await t.fakeSeq();
      const r2 = await turn(t, { ...BODY, user: '고개를 끄덕인다.' });
      step(`C5 <${tagName}> 다음 턴 [Previous status]`, '본문 줄(140000, 로비)', r2.req.prevLine, /140000\]$/.test(r2.req.prevLine) && !/999/.test(r2.req.prevLine));
      const all2 = (r2.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
      step(`C5 <${tagName}> 다음 턴 요청 속 지난 답`, '(관찰) 생각 블록이 그대로 가는지', { thoughtInReq: all2.includes(thought.slice(0, 20)), tagWord: all2.includes(`<${tagName}>`) }, null);
      await t.shot(`${tag}-${tagName}`);
    }
    const aux = await t.fakeLog(0, 'aux');
    const upd = aux.filter((x) => /People Record Updater/.test(text(x.body.messages?.[0]?.content)));
    step('C5 인물 기록 갱신기 요청에 생각 글', '빠짐(sentText)', upd.map((x) => JSON.stringify(x.body).includes('생각 속 종료')), upd.every((x) => !JSON.stringify(x.body).includes('생각 속 종료')));
  }
  if (which === 'reason' || which === 'reason-stream') {
    await t.fake('rules/add', { rule: { id: 'main-reason', route: 'main', match: '오후 일정', replyFile: REPLY_FILE, reasoning: FAKE_THOUGHT.replace('명일 아파트', anName ?? '명일 아파트') } });
    // hold 없이 바로 답하게: 답 글을 먼저 짓는다 (요청을 볼 수 없으니 지난 상태창 줄로)
    const prev = (String(st0.message.at(-1)?.data).match(/\[▣\|[^\]\n]*\]/) ?? [])[0];
    const fields = ['날짜', '시각', '날씨', '기온', '위치', '목표', '동행', '투입', '신분', '잔고'];
    writeFileSync(REPLY_FILE, buildReply({ fields, prevLine: prev, start: {}, entries: [], lore: '' }, BODY));
    await t.send(BODY.user);
    await quietAux(t);
    const st = await t.chatState(true);
    const last = String(st.message.at(-1)?.data);
    const w = world(st);
    step(`C5 reasoning_content(${which}) 저장 꼴`, '(관찰) <Thoughts> 가 본문 앞에 붙는지', last.slice(0, 160), null);
    step(`C5 reasoning(${which}) 상황판`, `${anName} 활성 그대로`, w?.an?.find((e) => e.name === anName)?.state ?? '(없어짐)', w?.an?.find((e) => e.name === anName)?.state === '활성');
    const scr = (await t.screenMessages()).at(-1)?.text ?? '';
    step(`C5 reasoning(${which}) 상점·999`, '상점 카드 없음, 999 상태창 없음', { shop: /상점 열기/.test(scr), s999: /999/.test(scr) }, !/상점 열기/.test(scr));
    const s1 = await t.fakeSeq();
    await t.fake('rules/del', { id: 'main-reason' });
    const r2 = await turn(t, { ...BODY, user: '고개를 끄덕인다.' });
    step(`C5 reasoning(${which}) 다음 턴 [Previous status]`, '본문 줄', r2.req.prevLine, !/999/.test(r2.req.prevLine) && /140000\]$/.test(r2.req.prevLine));
    await t.shot(`${tag}`);
  }
  if (which === 'retry') {
    // 본편 첫 요청만 503 → 리스아이 자동 재시도 → 두 번째는 붙잡아 답
    await t.fake('rules/add', { rule: { id: 'main-503', route: 'main', status: 503, failFirst: 1, match: '오후 일정', replyFile: REPLY_FILE, hold: true } });
    const s0 = await t.fakeSeq();
    // 첫 요청(503 될 것)은 hold 로 잡힘 → 풀면 503 → 리스아이 재시도가 오면 그것을 turn 처럼 답
    await t.send(BODY.user, { wait: false });
    const waitHold = async (after) => { for (let i = 0; i < 200; i++) { await sleep(400); const l = await t.fakeLog(after, 'main'); const h = l.find((x) => x.action === 'hold' && !x.response); if (h) return h; } return null; };
    const h1 = await waitHold(s0);
    await t.fake('release', { seq: h1.seq });
    const h2 = await waitHold(h1.seq);
    if (h2) { const req = readRequest(h2.body); writeFileSync(REPLY_FILE, buildReply(req, BODY)); await t.fake('release', { seq: h2.seq }); }
    await t.waitBusy(5000).catch(() => {}); await t.waitIdle().catch(() => {}); await quietAux(t);
    const errText = await t.R(() => document.body.innerText.match(/503|오류|Error[^\n]{0,80}/)?.[0] ?? null);
    step('C6 재시도 요청 옴', '503 뒤 리스아이가 다시 보냄', { h1: h1?.seq, h2: h2?.seq ?? null, errText }, !!h2);
    const mains = await t.fakeLog(s0, 'main');
    step('C6 본편 요청 수', '503 1번 + 재시도 1번', mains.map((x) => ({ seq: x.seq, status: x.response?.status, dupOf: x.dupOf, len: JSON.stringify(x.body).length })), mains.length === 2);
    const a = mains[0]?.body, b = mains[1]?.body;
    step('C6 재시도 요청 = 첫 요청', '같은 글(참고 기록·인물 기록 두 번 안 낌)', { same: JSON.stringify(a) === JSON.stringify(b), peopleBlocks: (b?.messages ?? []).filter((m) => text(m.content).startsWith('[People records]')).length, invBlocks: (b?.messages ?? []).filter((m) => text(m.content).startsWith('[Inventory]')).length }, JSON.stringify(a) === JSON.stringify(b));
    const aux = await t.fakeLog(s0, 'aux');
    step('C6 보조 호출', '(관찰) Router·Director 가 두 번 안 감', aux.map((x) => text(x.body.messages?.[0]?.content).slice(0, 30)), null);
    const st = await t.chatState(true);
    step('C6 답 붙음', '메시지 +2', st.message.length - st0.message.length, st.message.length - st0.message.length === 2);
  }
  if (which === 'router-timeout') {
    // Router 시간 제한을 가장 짧게(30초) 두고 Router 답을 40초 늦춤 → 본편은 코드 고르기로 나가고, 늦은 답은 버림
    await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const db = st.DBState.db; const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const c = db.characters[ci].chats[db.characters[ci].chatPage]; c.scriptstate = { ...c.scriptstate, $pp_router_timeout: '30' }; });
    await t.fake('rules/add', { rule: { id: 'router-slow', route: 'aux', match: '# Router — scene people selection', delayMs: 40000, reply: '{"selected":["큐라스"],"new_characters":[]}' } });
    const s0 = await t.fakeSeq();
    const t0 = Date.now();
    const r = await turn(t, BODY);
    const waited = Date.now() - t0;
    const all = (r.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
    step('C9 Router 시간 넘김 → 본편 나감', '30초쯤 뒤 본편, 큐라스 기록 안 낌', { mainAfterSec: Math.round((r.rec.t ? Date.parse(r.rec.t) - t0 : waited) / 1000), kyurasInPeople: /## 큐라스/.test(all) }, !/## 큐라스/.test(all));
    const prog = await t.progText();
    step('C9 진행 창', '라우터 실패 표시', prog, /실패|시간/.test(prog ?? ''));
    await sleep(15000);
    const s1 = await t.fakeSeq();
    const r2 = await turn(t, { ...BODY, user: '고개를 끄덕인다.' });
    step('C9 늦은 답 버림 → 다음 턴', '(관찰) 다음 턴 Router 를 다시 부르고 그 답대로', { kyuras: /## 큐라스/.test((r2.rec.body.messages ?? []).map((m) => text(m.content)).join('\n')) }, null);
  }
  if (which === 'main-model') {
    // 인물 기록 갱신기·Router·Director 를 메인 모델로 → 그 호출이 리스아이 본편 길(beforeRequest)을 지남 → 로어·참고 기록이 붙지 않아야 함
    await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const db = st.DBState.db; const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const c = db.characters[ci].chats[db.characters[ci].chatPage]; c.scriptstate = { ...c.scriptstate, $pp_model: 'main' }; });
    await t.fake('rules', { rules: [
      { id: 'mm-router', route: 'main', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
      { id: 'mm-director', route: 'main', match: '# Scene Director', reply: '{"notes":[]}' },
      { id: 'mm-upd', route: 'main', match: '# People Record Updater', reply: '{}' },
      ...baseRules(),
    ] });
    const s0 = await t.fakeSeq();
    const r = await turn(t, BODY);
    const mains = await t.fakeLog(s0, 'main');
    const rows = mains.map((x) => { const all = JSON.stringify(x.body); return { seq: x.seq, head: text(x.body.messages?.[0]?.content).slice(0, 40), lore: all.includes('goei:lore'), inv: all.includes('[Inventory]'), people: all.includes('[People records]'), img: all.includes('Inserting Character Visual Images'), n: x.body.messages?.length }; });
    step('C8 메인 모델로 간 보조 호출의 지문', '보조 호출엔 로어·[Inventory]·이미지 지침 없음', rows, rows.filter((x) => /Router|Director|Updater/.test(x.head)).every((x) => !x.lore && !x.inv && !x.img));
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
