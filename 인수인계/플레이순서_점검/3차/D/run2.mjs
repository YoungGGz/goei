// 3차 D 구간 2차: 공통 갈래 표 칸(◀▶·이어 쓰기·직접 고치기·지우기·번호 밀기·새로고침·생각 블록) + D7 상황판 껐다 켜기·발생 후보 끔 + D8 0.21.34 고친 셋.
// 사용: FAKE_URL=http://<IP>:<port> node run2.mjs --only e1 [--w 1280 --h 800]. 갈래마다 새 브라우저(따로 돌림). src 는 안 건드림.
// 단계마다 기대값(want)·결정표 줄(ref)을 먼저 적고 실제값(got)을 붙인다. ok=null 은 판독·사실 기록.
import { open, STATES, sleep, waitMain, readRequest, buildReply, quietAux, world, saveJson, saveText, reqText, text } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const OUT = fileURLToPath(new URL(`./out/run2-${ONLY.join('_') || 'all'}-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), size: `${W}x${H}`, only: ONLY, steps: [] };
const step = (id, name, ok, want, ref, got) => { res.steps.push({ id, name, ok, want, ref, got }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 400)); saveJson(OUT + '/result.json', res); };
const on = (k) => ONLY.includes(k);
const t = await open({ out: OUT, width: W, height: H, touch: W < 600 });
const shot = async (n) => { await t.shot(n); return `${OUT}/${n}.png`; };
const F = () => t.F();
const fc = async (sel, i = 0) => { try { await F().locator(sel).locator('visible=true').nth(i).click({ timeout: 3000 }); } catch (e) { const ok = await F().evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, { sel, i }); if (!ok) throw e; } await sleep(700); };
const ftext = (sel = '.gx') => F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ') ?? null, sel);
const acts = (re) => F().evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r.test(e.dataset.action)).map((e) => ({ a: e.dataset.action, v: e.dataset.value ?? null, t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), on: e.getAttribute('aria-pressed') ?? (e.classList.contains('on') ? 'on' : null), dis: !!e.disabled })); }, re.source);
const ST = { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' };
const PROSE = (s) => `${s}\n\n<img=Jaemtri_smile>\n\n"알겠어요."`;
const agent = (w, c) => w?.agents?.[c] ?? null;
const sit = (code, st, s) => (w) => w.map((x) => (x.startsWith(`[AG|${code}|`) ? x.replace(/\|내근\|[^\]]*\]$/, `|${st}|${s}]`) : x));
const anNames = (w) => (w?.an ?? []).map((a) => `${a.name || '(이름 없음)'}:${a.state}`);
const ss = async () => (await t.chatState(true)).scriptstate ?? {};
const prevOf = async () => { try { const p = JSON.parse((await ss()).$goei_prev ?? 'null'); return p ? { i: p.i, k: p.k, pk: p.pk } : null; } catch { return null; } };
const sendFn = (txt) => async () => { await t.closeWindow().catch(() => {}); await t.send(txt, { wait: false }); };
async function hold(fn, ms) { writeFileSync(t.REPLY, '(아직)'); const seq0 = await t.fakeSeq(); await fn(); const rec = await waitMain(t, seq0, ms); return { rec, seq0, req: rec ? readRequest(rec.body) : null }; }
async function release(rec, reply, { settle = true } = {}) { writeFileSync(t.REPLY, reply); await t.fake('release', { seq: rec.seq }); if (!settle) return; await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t); }
async function full(fn, def, tag) { const h = await hold(fn); if (!h.rec) return { ...h, ok: false }; if (tag) saveText(`${OUT}/${tag}-request.txt`, reqText(h.rec.body)); const reply = typeof def === 'string' ? def : buildReply(h.req, typeof def === 'function' ? def(h.req) : def); await release(h.rec, reply); return { ...h, reply, ok: true }; }
const reqAll = (rec) => (rec ? (rec.body.messages ?? []).map((m) => text(m.content)).join('\n') : '');
const lastAssist = async () => { const st = await t.chatState(true); const m = [...st.message].reverse().find((x) => x.role === 'char'); return String(m?.data ?? ''); };

async function gotoAnomaly() {
  await fc('[data-action="ed-open"][data-value="set:screen"]').catch(() => {});
  for (const n of ['set:screen', 'set:board', 'set:status', 'set:adv']) { if ((await acts(/^set-anomaly$/)).length) return n; await fc(`[data-action="ed-node"][data-value="${n}"]`).catch(() => {}); }
  return (await acts(/^set-anomaly$/)).length ? 'found' : null;
}
async function boot(state = 'S-관리국-3턴') {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  await sleep(1500);
}

try {
  await boot(on('e9') || on('e8') ? 'S-관리국-3턴' : 'S-관리국-3턴');

  // ───── E1 다시 굴린 답 사이 ◀▶ 오가기 ─────
  // 가르는 기준(먼저 적음): 리스AI ◀▶ 는 모델 호출·output 처리 없이 화면 글만 갈아 끼운다(리스AI 동작). 그래서 ◀ 직후 플러그인 저장 상태가 R2 로 남는 것은 리스AI 동작 탓.
  // 플러그인 몫은 「그 뒤 다음 요청·다음 응답 처리」가 화면에 보이는 답(R1)과 맞느냐.
  if (on('e1')) {
    const r1 = await full(sendFn('잼트리에게 오늘 일정을 묻는다.'), { prose: PROSE('잼트리가 수첩을 펼쳤다. R1'), status: { ...ST, place: '서울 종로구 관리국 본부 로비 R1' }, mutate: sit('P005', '내근', '서류 더미를 정리하고 있다 R1') }, 'e1-r1');
    const w1 = await world(t);
    const r2 = await full(() => t.reroll({ wait: false }), { prose: PROSE('잼트리가 고개를 저었다. R2'), status: { ...ST, place: '서울 종로구 관리국 지하 창고 R2' }, mutate: sit('P005', '작전투입', '창고에서 장비를 점검하고 있다 R2') }, 'e1-r2');
    const w2 = await world(t);
    step('E1-1', '다시 굴리기(R2) → 상태는 R2', /R2/.test(agent(w2, 'P005')?.situation ?? '') && agent(w2, 'P005')?.st === '작전투입', 'R1 을 되감고 R2 만 반영 (J-03·공-01)', '공통 갈래 「다시 굴리기」', { w1P005: agent(w1, 'P005'), w2P005: agent(w2, 'P005'), r2req: r2.ok });
    await t.swipePrev(); await sleep(1500);
    const scr = await t.screenMessages();
    const wPrev = await world(t);
    const lastTxt = await lastAssist();
    step('E1-2', '◀ 로 R1 보기 → 화면 R1, 플러그인 저장 상태', null, '리스아이 동작: 화면·저장 본문은 R1, 플러그인 상태는 R2 그대로(output 이 안 돎). 사실 기록', '공통 갈래 「◀▶ 오가기」(코드에서 짚은 자리: 화면 답과 플러그인 상태가 갈림)', { screenLast: scr.at(-1)?.text?.slice(0, 120), storedLast: lastTxt.slice(0, 160), P005: agent(wPrev, 'P005'), shot: await shot('e1-prev') });
    // 다음 턴: 화면에 보이는 답은 R1. 요청의 이전 상태·요원 상황이 R1 이어야 화면과 맞음
    const r3 = await full(sendFn('잼트리를 따라간다.'), { prose: PROSE('복도를 걸었다. R3'), status: ST }, 'e1-r3');
    const all3 = reqAll(r3.rec);
    const w3 = await world(t);
    step('E1-3', '◀ 뒤 다음 턴 요청: 화면의 R1 과 맞나', /R1/.test(all3) && !/R2\]|R2\n|R2$/m.test(all3.replace(/잼트리가 고개를 저었다\. R2/g, '')), '이전 상태 줄·요원 상황이 화면에 보이는 R1 (Claude 판정: 플레이어는 R1 을 골랐다)', '공통 갈래 「◀▶ 오가기」', { prevStatus: r3.req?.prevLine, hasR1: (all3.match(/[^\n]{0,60}R1[^\n]{0,20}/g) ?? []).slice(0, 6), hasR2: (all3.match(/[^\n]{0,60}R2[^\n]{0,20}/g) ?? []).slice(0, 6), P005after: agent(w3, 'P005') });
    // ▶ 로 R2 로 다시 가서(마지막 답이 아님 → 리스아이는 마지막 칸만 ◀▶) 는 생략. 대신 R3 를 다시 굴려 ◀ 해도 같은지 한 번 더
  }

  // ───── E2 이어 쓰기 ─────
  // 기준: 이어 쓰기는 리스아이가 마지막 답 뒤에 이어 붙인다. 플러그인은 이미지 지침 자리·시작 카드·사용 정리만 다룸(코드). 이어 붙은 답의 태그·상태창은 한 번 처리돼야 함.
  if (on('e2')) {
    const h = await hold(sendFn('잼트리에게 커피를 건넨다.'));
    saveText(`${OUT}/e2-first-request.txt`, reqText(h.rec.body));
    const tags = buildReply(h.req, { prose: '', status: { ...ST, place: '서울 종로구 관리국 본부 탕비실' }, mutate: sit('P005', '내근', '탕비실에서 커피를 받아 들었다 C2') }).trim();
    await release(h.rec, '잼트리가 컵을 받아 들었다.\n\n"고마워요. 마침 졸렸는데…"');
    const w1 = await world(t); const st1 = await lastAssist();
    const h2 = await hold(() => t.continueReply({ wait: false }));
    saveText(`${OUT}/e2-cont-request.txt`, h2.rec ? reqText(h2.rec.body) : '(안 옴)');
    const contMsgs = h2.rec ? (h2.rec.body.messages ?? []).slice(-2).map((m) => `${m.role}:${text(m.content).slice(-200)}`) : null;
    if (h2.rec) await release(h2.rec, `\n\n그녀가 한 모금 마시고 웃었다.\n\n${tags}`);
    const w2 = await world(t); const st2 = await lastAssist(); const scr = await t.screenMessages();
    const nStatus = (st2.match(/\[▣\|/g) ?? []).length;
    step('E2-1', '이어 쓰기 요청이 나가고, 이어 붙은 태그·상태창이 반영', !!h2.rec && /C2/.test(agent(w2, 'P005')?.situation ?? '') && nStatus <= 1, '이어 쓰기 본편 요청 1회, 이어 붙은 AG 줄이 상태에 반영, 저장 본문에서 태그는 걷히고 상태창은 한 번만', '공통 갈래 「이어 쓰기」(Claude 판정)', { sent: !!h2.rec, contMsgs, P005before: agent(w1, 'P005'), P005after: agent(w2, 'P005'), stored1: st1.slice(-120), stored2: st2.slice(-300), nStatus, screen: scr.at(-1)?.text?.slice(-150), shot: await shot('e2-after') });
    const r3 = await full(sendFn('잼트리와 사무실로 돌아간다.'), { prose: PROSE('사무실. E2'), status: ST }, 'e2-next');
    step('E2-2', '이어 쓰기 뒤 다음 턴 요청의 이전 상태', /탕비실/.test(r3.req?.prevLine ?? ''), '이전 상태 줄이 이어 붙은 상태창(탕비실)', '공통 갈래 「이어 쓰기」', { prevLine: r3.req?.prevLine });
  }

  // ───── E3 리스AI 에서 메시지 직접 고치기 ─────
  // 기준: 플러그인은 고친 메시지를 다시 처리하는 코드가 없다(코스 표). 사실 기록 + 다음 요청이 화면 글과 맞는지.
  if (on('e3')) {
    const st0 = await t.chatState(true);
    const idx = st0.message.length - 1;
    const old = String(st0.message[idx].data);
    const w0 = await world(t);
    const edited = old.replace(/\[▣\|[^\]]*\]/, (m) => m.replace('서울 종로구 관리국 본부 로비', '서울 중구 시청 앞 광장 E3')) + '\n\n[AG|P005|스팡달|작전투입|시청 앞 광장으로 달려갔다 E3]';
    await t.editMessage(idx, edited); await sleep(1500);
    const w1 = await world(t); const st1 = await t.chatState(true);
    step('E3-1', '마지막 답의 상태창·태그를 손으로 고침 → 플러그인 상태', null, '사실 기록: 고친 글을 다시 처리하는지(코드엔 없음). 고친 저장 본문', '공통 갈래 「메시지 직접 고치기」', { hadStatus: /\[▣\|/.test(old), stored: String(st1.message[idx].data).slice(-260), P005before: agent(w0, 'P005'), P005after: agent(w1, 'P005'), shot: await shot('e3-edited') });
    const r = await full(sendFn('광장을 둘러본다.'), { prose: PROSE('광장. E3'), status: ST }, 'e3-next');
    const w2 = await world(t);
    step('E3-2', '고친 뒤 다음 턴 요청', /시청 앞 광장 E3/.test(r.req?.prevLine ?? ''), '이전 상태 줄은 화면에 보이는 고친 상태창(시청 앞 광장). AG 손 태그는 반영 안 돼도 사실만 (Claude 판정)', '공통 갈래 「메시지 직접 고치기」', { prevLine: r.req?.prevLine, agInReq: (reqAll(r.rec).match(/[^\n]{0,40}E3[^\n]{0,30}/g) ?? []).slice(0, 5), P005after: agent(w2, 'P005') });
  }

  // ───── E4 가운데 응답 지우기 / 내 말만 지우기 / 둘 이상 연달아 ─────
  if (on('e4a') || on('e4b') || on('e4c')) {
    const r1 = await full(sendFn('잼트리에게 서류를 넘긴다.'), { prose: PROSE('서류를 받았다. M1'), status: ST, mutate: sit('P005', '작전투입', '소라 랜드로 출동했다 M1') }, 'e4-m1');
    const r2 = await full(sendFn('창밖을 본다.'), { prose: PROSE('비가 내렸다. M2'), status: ST, mutate: sit('P006', '작전투입', '꿈과 희망의 극단으로 출동했다 M2') }, 'e4-m2');
    const st = await t.chatState(true); const n = st.message.length; // ... u(n-4) a(n-3: M1) u(n-2) a(n-1: M2)
    const w0 = await world(t);
    const roles = st.message.map((m, i) => `${i}:${m.role}:${String(m.data).slice(0, 18)}`).slice(-5);
    await t.closeWindow().catch(() => {});
    if (on('e4a')) { // 가운데 응답(M1) 지우기 → 상태는 그대로(마지막 응답 M2 는 남아 있음) → 다음 턴
      await t.deleteMessage(n - 3); await sleep(1200);
      const w1 = await world(t);
      step('E4a-1', '가운데 응답(M1) 지움 → 상황판', agent(w1, 'P006')?.st === '작전투입', '마지막으로 반영한 응답(M2)이 남아 있으니 되돌리지 않음. M1 이 만든 것은 그대로 (0.21.34 가운데 응답 따로, rerollBase 주석)', '공통 갈래 「가운데 응답 지우기」, 0.21.34', { roles, P005: [agent(w0, 'P005'), agent(w1, 'P005')], P006: agent(w1, 'P006') });
      const r = await full(sendFn('잼트리를 부른다.'), { prose: PROSE('대답이 없다. M3'), status: ST }, 'e4a-next');
      const w2 = await world(t);
      step('E4a-2', '가운데 지운 뒤 새 턴 → 상태 유지·처리', agent(w2, 'P006')?.st === '작전투입' && /M2/.test(agent(w2, 'P006')?.situation ?? ''), '새 턴이 되감기 없이 그대로 쌓임', '공통 갈래, 0.21.34', { P005: agent(w2, 'P005'), P006: agent(w2, 'P006'), prev: await prevOf() });
    }
    if (on('e4b')) { // 내 말(마지막 user)만 지우기 → 다음 턴
      await t.deleteMessage(n - 2); await sleep(1200);
      const w1 = await world(t);
      step('E4b-1', '내 말만 지움 → 상황판', agent(w1, 'P006')?.st === '작전투입', '앞 메시지만 지우고 응답은 남았으면 되돌리지 않음 (rerollBase 주석)', '공통 갈래 「내 말만 지우기」', { roles, P006: agent(w1, 'P006') });
      const r = await full(sendFn('다시 말을 건다.'), { prose: PROSE('M4'), status: ST }, 'e4b-next');
      const w2 = await world(t);
      step('E4b-2', '내 말 지운 뒤 새 턴', agent(w2, 'P006')?.st === '작전투입', 'M2 가 만든 것 유지', '공통 갈래', { P006: agent(w2, 'P006'), prev: await prevOf() });
    }
    if (on('e4c')) { // 둘 이상 연달아 지우기(M2 → M1) → 새로 보냄
      await t.deleteMessage(n - 1); await sleep(900); await t.deleteMessage(n - 3); await sleep(1200);
      const w1 = await world(t);
      const r = await full(sendFn('새로 말을 건다.'), { prose: PROSE('M5'), status: ST }, 'e4c-next');
      const w2 = await world(t);
      step('E4c-1', '응답 둘(M2·M1) 연달아 지우고 새로 보냄', null, '알고 넘긴 한계(0.21.34 남은 한계): 마지막으로 반영한 응답 하나만 되돌아감 → M2(P006) 는 되돌아가고 M1(P005) 은 남을 것으로 봄. 사실 기록', '공통 갈래 「둘 이상 연달아 지우기」, 결정됨', { roles, beforeDel: { P005: agent(w0, 'P005')?.st, P006: agent(w0, 'P006')?.st }, afterDel: { P005: agent(w1, 'P005')?.st, P006: agent(w1, 'P006')?.st }, afterSend: { P005: agent(w2, 'P005'), P006: agent(w2, 'P006') } });
    }
  }

  // ───── E5 답 오는 중 다른 채팅 + 번호 밀기 ─────
  // 기준(먼저 적음): 리스아이는 보낼 때 잡은 채팅 번호로 답을 써 넣는다(리스아이 동작). 새 채팅을 맨 앞에 끼우면 번호가 밀려 답이 엉뚱한 채팅에 들어갈 수 있는데 그건 리스아이 탓.
  // 플러그인 몫: 답 처리(output)가 「답이 실제로 들어간 채팅」에 반영되고, 다른 채팅의 상황판을 건드리지 않는지.
  if (on('e5a') || on('e5b')) {
    const st0 = await t.chatState(true);
    const id0 = st0.chatId; const n0 = st0.message.length;
    const h = await hold(sendFn('잼트리에게 지도를 보여 준다.'));
    let note;
    if (on('e5a')) { await t.newChat(); note = 'newChat(맨 앞에 끼움, 번호 +1)'; }
    else { await t.newChat(); await sleep(800); await t.switchChat(1); note = 'newChat 뒤 원래 채팅(이제 번호 1)으로 돌아감'; }
    await sleep(1500);
    await release(h.rec, buildReply(h.req, { prose: PROSE('지도를 보았다. N1'), status: { ...ST, place: '서울 종로구 관리국 본부 상황실 N1' }, mutate: sit('P005', '작전투입', '지도를 들고 나갔다 N1') }), { settle: false });
    await sleep(6000); await quietAux(t);
    const chats = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return c.chats.slice(0, 3).map((ch, i) => { let p5 = null; try { p5 = JSON.parse(ch.scriptstate?.$goei_world ?? 'null')?.agents?.P005 ?? null; } catch {} return { i, id: ch.id, n: ch.message?.length ?? 0, last: String(ch.message?.at(-1)?.data ?? '').slice(0, 80), hasWorld: !!ch.scriptstate?.$goei_world, P005: p5 }; }); });
    const orig = chats.find((c) => c.id === id0); const fresh = chats.find((c) => c.id !== id0 && c.i === 0);
    step(on('e5a') ? 'E5a-1' : 'E5b-1', `답 오는 중 ${note} → 답과 상황판이 어디로`, null, '리스아이: 답은 보낸 때 번호(0)에 씀 → 새 채팅에 들어갈 수 있음(리스아이 동작). 플러그인: 답이 들어간 채팅에만 반영, 다른 채팅 상황판 안 건드림. 사실 기록 후 판정', '공통 갈래 「답 오는 중 다른 채팅 + 번호 밀기」', { id0, n0, chats, orig, fresh, errors: t.errors.slice(-5), shot: await shot(on('e5a') ? 'e5a' : 'e5b') });
  }

  // ───── E6 작업 중 새로고침 ─────
  if (on('e6a')) { // 답 기다리는 중 새로고침 → 그 뒤
    const h = await hold(sendFn('잼트리에게 인사한다.'));
    await t.reload({ settle: true }); await sleep(2000);
    await t.fake('release', { seq: h.rec.seq });
    await sleep(3000);
    const st1 = await t.chatState(true); const w1 = await world(t);
    await t.openWindow('.gx').catch(() => {}); await sleep(1200);
    const prog = await t.progText();
    step('E6a-1', '답 기다리는 중 새로고침', null, '리스아이: 진행 중 요청은 메모리라 사라짐(답 안 붙음). 플러그인: 남은 「대기」·진행 창 「메인 응답 대기」가 영영 남지 않는지, 다음 전송이 막히지 않는지', '공통 갈래 「작업 중 새로고침」', { n: st1.message.length, last: String(st1.message.at(-1)?.data ?? '').slice(0, 80), pending: w1?.pending, prog, view: (await ftext('.gx'))?.slice(0, 160), shot: await shot('e6a-after') });
    const r = await full(sendFn('다시 인사한다.'), { prose: PROSE('안녕. R6'), status: ST }, 'e6a-next');
    step('E6a-2', '새로고침 뒤 다음 전송', r.ok, '정상 전송·처리', '공통 갈래', { ok: r.ok, n: (await t.chatState(true)).message.length });
  }
  if (on('e6b')) { // 답 처리 직후 바로 새로고침(리스아이 0.5초 저장 모음 전)
    const h = await hold(sendFn('잼트리에게 지도를 건넨다.'));
    writeFileSync(t.REPLY, buildReply(h.req, { prose: PROSE('지도를 펼쳤다. Q1'), status: { ...ST, place: '서울 종로구 관리국 본부 상황실 Q1' }, mutate: sit('P005', '작전투입', '지도를 들고 나갔다 Q1') }));
    await t.fake('release', { seq: h.rec.seq });
    await t.waitBusy(5000).catch(() => {});
    await t.R(() => new Promise((r) => { const iv = setInterval(() => { if (!document.querySelector('.default-chat-screen .loadmove')) { clearInterval(iv); r(); } }, 20); }));
    await t.reload({ settle: false }); await sleep(2500);
    const st1 = await t.chatState(true); const w1 = await world(t);
    const last = String(st1.message.at(-1)?.data ?? '');
    step('E6b-1', '답이 붙자마자 새로고침(저장 모음 전)', null, '저장된 채팅 글과 플러그인 상태가 서로 맞아야 함: 답이 남았으면 Q1 반영·태그 걷힘, 답이 없으면 Q1 미반영. 사실 기록 후 판정', '공통 갈래 「작업 중 새로고침(바로)」', { n: st1.message.length, lastHasQ1: /Q1/.test(last), lastHasTags: /\[AG\|/.test(last), P005: agent(w1, 'P005'), last: last.slice(-200) });
    const r = await full(sendFn('지도를 본다.'), { prose: PROSE('Q2'), status: ST }, 'e6b-next');
    step('E6b-2', '그 뒤 다음 턴 요청 이전 상태', null, '이전 상태 줄이 화면 마지막 답과 맞음', '공통 갈래', { prevLine: r.req?.prevLine });
  }

  // ───── E7 생각 블록 ─────
  // 기대: 생각 블록 안의 태그 초안은 안 읽고(output.ts splitThoughts, 전수검사 11-13), 본문 태그만 반영. 스트리밍 켬/끔, reasoning_content 꼴과 본문 <think> 꼴.
  if (on('e7a') || on('e7b') || on('e7c') || on('e7d')) {
    const stream = on('e7b') || on('e7d');
    if (stream) await t.setStreaming(true);
    const useReasoning = on('e7a') || on('e7b');
    const think = 'Draft:\n[AG|P006|에일린|작전투입|생각 속 초안 TH]\n[▣|2025.03.14|11:00 AM|☀️|12°C|생각 속 장소 TH|없음|없음|없음|관리국/신입|1]';
    if (useReasoning) await t.fake('rules', { rules: [{ id: 'm-hold', route: 'main', hold: true, replyFile: t.REPLY, reasoning: think }, { id: 'a-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' }, { id: 'a-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' }, { id: 'a-any', route: 'aux', reply: '{}' }] });
    const h = await hold(sendFn('잼트리에게 계획을 묻는다.'));
    const body = buildReply(h.req, { prose: PROSE('잼트리가 계획을 말했다. TB'), status: { ...ST, place: '서울 종로구 관리국 본부 회의실 TB' }, mutate: sit('P005', '작전투입', '회의실에서 계획을 세웠다 TB') });
    await release(h.rec, useReasoning ? body : `<think>\n${think}\n</think>\n\n${body}`);
    const w = await world(t); const last = await lastAssist(); const scr = await t.screenMessages();
    const r = await full(sendFn('계획대로 한다.'), { prose: PROSE('TC'), status: ST }, `${ONLY[0]}-next`);
    step(`${ONLY[0].toUpperCase()}-1`, `생각 블록 (${useReasoning ? 'reasoning_content' : '본문 <think>'}, 스트리밍 ${stream ? '켬' : '끔'})`, agent(w, 'P006')?.st !== '작전투입' && /TB/.test(agent(w, 'P005')?.situation ?? '') && /회의실 TB/.test(r.req?.prevLine ?? ''), '생각 속 AG·상태창 초안은 무시, 본문 태그(P005 TB)·상태창(회의실 TB)만 반영, 다음 요청 이전 상태 = 본문 상태창', '공통 갈래 「생각 블록 응답」, 전수검사 11-13', { P005: agent(w, 'P005'), P006: agent(w, 'P006'), storedHead: last.slice(0, 200), storedTail: last.slice(-200), screen: scr.at(-1)?.text?.slice(0, 200), prevLine: r.req?.prevLine, thoughtInNextReq: /생각 속/.test(reqAll(r.rec)), shot: await shot(`${ONLY[0]}`) });
  }

  // ───── E8 상황판 껐다 켜기 (D7) ─────
  if (on('e8')) {
    const r0 = await full(sendFn('잼트리에게 보고서를 넘긴다.'), { prose: PROSE('K1'), status: ST, mutate: sit('P005', '작전투입', '소라 랜드로 출동했다 K1') }, 'e8-k1');
    const w0 = await world(t); const s0 = await ss();
    await t.openWindow('.gx'); await sleep(1000);
    const where = await gotoAnomaly();
    const seg = await acts(/^set-anomaly$/);
    if (!seg.length) { await shot('e8-nofind'); }
    await fc('[data-action="set-anomaly"][data-value="off"]');
    await sleep(1500);
    const sOff = await ss();
    step('E8-1', '상황판 끄기 → 상태·기준 비움', sOff.$st_anomaly_on === '0' && !sOff.$goei_world && !sOff.$goei_prev, '끄면 $goei_world·$goei_prev·보고 비움 (settings.ts worldOffVars, 원본 clearIntegratedControlState)', '결정표 3-1 기능 끔, 0.21.34', { where, seg, before: { on: s0.$st_anomaly_on, world: !!s0.$goei_world, prev: !!s0.$goei_prev }, after: { on: sOff.$st_anomaly_on, world: !!sOff.$goei_world, prev: !!sOff.$goei_prev }, shot: await shot('e8-off') });
    const rOff = await full(sendFn('창밖을 본다.'), { prose: PROSE('K2'), status: ST }, 'e8-off-turn');
    const allOff = reqAll(rOff.rec);
    step('E8-2', '끈 채 한 턴: 요청에 상황판 글 없음', !/### World Entries/.test(allOff) && !/\[AN\|/.test(allOff), '상황판 꺼짐 → World Entries·AN 줄 안 감', '결정표 3-1', { hasWE: /### World Entries/.test(allOff), an: (allOff.match(/\[AN\|[^\]]*\]/g) ?? []).slice(0, 3) });
    await t.openWindow('.gx'); await sleep(800);
    await gotoAnomaly();
    await fc('[data-action="set-anomaly"][data-value="on"]');
    await sleep(2500);
    const sOn = await ss(); const wOn = await world(t);
    step('E8-3', '다시 켜기 → 새 상황판, 끄기 전 것 안 되살아남', !!sOn.$goei_world && agent(wOn, 'P005')?.st !== '작전투입', '새로 깔린 상황판(다시 켜도 복원 안 함). 끄기 전 K1 의 P005 작전투입 없음', '결정표 3-1, 0.21.34', { an: anNames(wOn), P005: agent(wOn, 'P005'), prev: !!sOn.$goei_prev });
    await t.closeWindow().catch(() => {});
    const rr = await full(() => t.reroll({ wait: false }), { prose: PROSE('K2 다시'), status: ST }, 'e8-reroll');
    const wR = await world(t);
    step('E8-4', '켠 뒤 마지막 답 다시 굴리기 → 끄기 전 상황판이 되살아나지 않음', agent(wR, 'P005')?.st !== '작전투입' && JSON.stringify(anNames(wR)) !== JSON.stringify(anNames(w0)) || anNames(wR).length > 0 && agent(wR, 'P005')?.st !== '작전투입', '되감기 기준이 비어 있어 옛 상태(K1) 복원 없음 (worldOffVars 주석)', '0.21.34', { an0: anNames(w0), anOn: anNames(wOn), anR: anNames(wR), P005: agent(wR, 'P005'), reqAN: (reqAll(rr.rec).match(/\[AN\|[^\]]*\]/g) ?? []).slice(0, 6) });
  }

  // ───── E9 발생 후보 끔 (D7) ─────
  // 추첨은 확률. 판정: 끈 후보 이름이 요청 글의 NEW AN 줄·상황판에 안 들어감. 후보를 모두 끄고 프리셋 상한·확률을 올리면 프리셋 발생은 0 이어야 함(결정적).
  if (on('e9')) {
    await t.openWindow('.gx'); await sleep(1000);
    await fc('[data-action="ed-open"][data-value="set:screen"]');
    await fc('[data-action="ed-tab"][data-value="world"]');
    const nodes = await acts(/^ed-node$/);
    await fc('[data-action="ed-node"][data-value="anomaly"]');
    let pre = await acts(/^dir-set$/);
    const onList = pre.filter((x) => /^preset\|0\|/.test(x.v)).map((x) => x.v.split('|')[2]);
    for (const name of onList) { const p = (await acts(/^dir-set$/)).find((x) => x.v === `preset|0|${name}`); if (p) await fc(`[data-action="dir-set"][data-value="${p.v.replace(/"/g, '\\"')}"]`); }
    pre = await acts(/^dir-set$/);
    const save = await acts(/^dir-save$/);
    await shot('e9-off');
    if (save.length) await fc('[data-action="dir-save"]');
    await sleep(1200);
    step('E9-1', '괴이 발생 후보 모두 끔 → 저장', pre.every((x) => !/^preset\|0\|/.test(x.v)), '목록의 「발생 켬」이 모두 「발생 끔」으로, 저장 단추로 명부에 저장', '코스 D7', { nodes: nodes.map((x) => `${x.v}:${x.t}`).slice(0, 20), turnedOff: onList, remainOn: pre.filter((x) => /^preset\|0\|/.test(x.v)).map((x) => x.v), save });
    // 프리셋 상한·확률 올리기: 세계 설정 숫자 칸 (설정 화면) — 직접 입력
    await t.closeWindow().catch(() => {});
    await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); const ch = c.chats[c.chatPage]; ch.scriptstate.$wg_preset_cap = '9'; ch.scriptstate.$wg_preset_p = '100'; ch.scriptstate.$wg_random_p = '0'; });
    const seen = [];
    for (let k = 0; k < 3; k++) {
      const r = await full(sendFn(`서류를 정리한다 ${k}.`), { prose: PROSE(`P${k}`), status: ST }, `e9-t${k}`);
      const newAn = (r.req?.weText.match(/^NEW \[AN\|[^\]]*\]/gm) ?? []);
      seen.push({ k, newAn, an: anNames(await world(t)) });
    }
    const leaked = seen.flatMap((s) => s.newAn).filter((x) => onList.some((n) => x.includes(n)));
    step('E9-2', '후보를 모두 끈 채 3턴(프리셋 상한 9·확률 100, 랜덤 0)', leaked.length === 0 && seen.every((s) => !s.newAn.length || s.newAn.every((x) => /<발생지점>|\|\|/.test(x) || !onList.some((n) => x.includes(n)))), '끈 후보 이름이 요청 NEW AN 줄에 안 들어감(프리셋 발생 0)', '코스 D7 (추첨은 확률 → 요청 글로 판정)', { seen, leaked });
  }

  // ───── E10 D8: Router 시간 제한이 실패로 보임 ─────
  if (on('e10')) {
    await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); const ch = c.chats[c.chatPage]; ch.scriptstate.$pp_router_timeout = '5'; });
    await t.fake('rules/add', { rule: { id: 'a-router-slow', route: 'aux', match: '# Router — scene people selection', delayMs: 12000, reply: '{"selected":[],"new_characters":[]}' }, first: true });
    const rules = await t.fake('rules');
    const r = await full(sendFn('잼트리를 부른다.'), { prose: PROSE('T10'), status: ST }, 'e10');
    await sleep(2000);
    const P = await t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); return h ? { open: h.getAttribute('x-goei-open'), text: (h.shadowRoot ?? h).textContent.replace(/\s+/g, ' ').slice(0, 500) } : null; });
    step('E10-1', 'Router 시간 제한(5초, 답 12초) → 진행 창에 실패', /라우터/.test(P?.text ?? '') && /실패/.test(P?.text ?? ''), '라우터 줄이 실패로, 머리 「끝 · 1건 실패」 (0.21.34 진행 창)', '0.21.34 고친 것', { rulesHead: JSON.stringify(rules).slice(0, 200), prog: P, auxRouter: r.ok, shot: await shot('e10') });
  }

  // ───── E11 D8: 앞 턴 위키·몰 자동 호출이 새 턴 합계에 안 섞임 ─────
  if (on('e11')) {
    const SHELF = (n) => `<owner>\n새로운 상품, 우리는 진열했다.\n</owner>\n<shelf>\n반짝 걸음 구두약 ${n}|15000|소모3|소모품/구두약/shoe polish|0.12|바른다 구두에. 걸음 반짝인다.|걸음이 빛남, 당신의||?\n녹슬지 않는 못|3000|-|도구/못/nail|0.004|박는다. 녹슬지 않는다.|||?\n</shelf>`;
    await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); const ch = c.chats[c.chatPage]; ch.scriptstate.$nw_auto = 'turn'; ch.scriptstate.$nw_model = 'aux'; ch.scriptstate.$cos_sh_auto = 'turn'; });
    // 우주 쇼핑몰 한 번 열어 진열 받기(빠른 답) — 「매 턴」은 받아 둔 진열이 있을 때만 돈다 (malls.ts mallTurnRefresh)
    await t.fake('rules/add', { rule: { id: 'cos-fast', match: 'cosmic-mall\\.alien', reply: `<shop-identity>\nsells: 출처를 모르는 이상한 물건\nnever: 환불\nprices: 원화만\ncurrency: -\n</shop-identity>\n${SHELF(0)}` } });
    await t.openWindow('.gx'); await sleep(1000);
    await fc('[data-action="nav-tab"][data-value="net"]').catch(() => {});
    if (!(await F().evaluate(() => !!document.querySelector('.ms-cos')))) await fc('[data-action="br-go"][data-value="cos"]').catch(() => {});
    await sleep(1200);
    await fc('[data-action="mall-refresh"]').catch(() => {});
    await sleep(4000);
    const loaded = await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return String(c.chats[c.chatPage].scriptstate.$cos_shop ?? '').slice(0, 120); });
    await t.closeWindow().catch(() => {});
    await t.fake('rules', { rules: [
      { id: 'm-hold', route: 'main', hold: true, replyFile: t.REPLY },
      { id: 'a-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
      { id: 'a-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
      { id: 'a-upd', route: 'aux', match: 'People Record Updater', reply: '{}' },
      { id: 'cos-slow', match: 'cosmic-mall\\.alien', delayMs: 25000, reply: SHELF(1) },
      { id: 'a-slow', route: 'aux', delayMs: 25000, reply: '{}' },
    ] });
    const cut = (x) => String(x ?? '').replace(/\[x-goei-prog\][\s\S]*/, '');
    const prog = () => t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); return h ? (h.shadowRoot ?? h).textContent.replace(/\s+/g, ' ').slice(0, 900) : null; });
    // 1턴: 본편 답 뒤 위키·몰이 25초 걸림. 그 사이에 2턴을 보냄 (quietAux 를 기다리지 않음)
    const h1 = await hold(sendFn('잼트리와 위키를 본다.'));
    await release(h1.rec, buildReply(h1.req, { prose: PROSE('W1'), status: ST }), { settle: false });
    await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await sleep(2500);
    const P1 = cut(await prog());
    const h2 = await hold(sendFn('잼트리에게 다시 묻는다.'));
    await sleep(1500);
    const P2wait = cut(await prog());
    await release(h2.rec, buildReply(h2.req, { prose: PROSE('W2'), status: ST }), { settle: false });
    await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await sleep(1500);
    const P2 = cut(await prog());
    await sleep(30000); await quietAux(t);
    const P3 = cut(await prog());
    const log = await t.fakeLog(h1.seq0);
    step('E11-1', '앞 턴 위키·몰 호출(25초)이 도는 중 새 턴 → 새 턴 합계에 안 섞임', null, '새 턴 진행 창 「호출 n회·보냄」은 이번 턴 것만, 앞 턴 위키·몰 줄·토큰은 앞 턴에 남음 (0.21.34, progress callOwner prev). 판독', '0.21.34 고친 것', { loaded, P1, P2wait, P2, P3, log: log.map((x) => `${x.seq}:${x.route}:${x.ruleId}:${x.response?.ms ?? '-'}ms`), shot: await shot('e11') });
  }

  // ───── E12 D8: AI 상담 토큰이 「보조 지난 턴」에 안 더해짐 + 단추만 써도 「인터넷」 점 안 켜짐 ─────
  if (on('e12')) {
    const r1 = await full(sendFn('잼트리에게 묻는다.'), { prose: PROSE('A1'), status: ST }, 'e12-t1');
    await t.openWindow('.gx'); await sleep(1000);
    await fc('[data-action="ed-open"][data-value="set:screen"]');
    await fc('[data-action="ed-tab"][data-value="set"]').catch(() => {});
    const flowNode = (await acts(/^ed-node$/)).find((x) => x.v === 'manage:flow' || /호출 흐름/.test(x.t));
    if (flowNode) await fc(`[data-action="ed-node"][data-value="${flowNode.v}"]`);
    const bar0 = await ftext('.fl-bar');
    await fc('[data-action="ai-toggle"]');
    await F().fill('[data-input="ai-q"]', '상황판 끄는 법 알려 줘');
    const s0 = await t.fakeSeq();
    await fc('[data-action="ai-send"]');
    await sleep(4000); await quietAux(t);
    const consultCalls = await t.fakeLog(s0, 'aux');
    await fc('[data-action="ai-close"]').catch(() => {});
    if (flowNode) { await fc('[data-action="ed-node"][data-value="' + flowNode.v + '"]').catch(() => {}); }
    const bar1 = await ftext('.fl-bar');
    step('E12-1', 'AI 상담 한 번 → 호출 흐름 「보조 지난 턴」 그대로', !!bar0 && bar0 === bar1 && consultCalls.length > 0, '상담 호출은 「보조 지난 턴」에 안 더해짐 (0.21.34)', '0.21.34 고친 것', { flowNode, bar0, bar1, consultCalls: consultCalls.length, shot: await shot('e12-flow') });
    // 단추로 부른 호출(괴담톡 답장 등) 뒤 진행 창 인터넷 점
    await t.closeWindow().catch(() => {});
    const dots = () => t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); const r = h?.shadowRoot ?? h; return r ? { dots: [...r.querySelectorAll('[data-p="dots"] *, [data-g]')].map((e) => `${e.getAttribute('data-g') ?? e.tagName}:${e.getAttribute('data-s') ?? ''}`), text: r.textContent.replace(/\s+/g, ' ').slice(0, 300) } : null; });
    const d0 = await dots();
    await t.openWindow('.gx'); await sleep(800);
    await fc('[data-action="nav-tab"][data-value="phone"]').catch(() => {});
    const dm = (await acts(/^ph-dm$/))[0];
    let sentBtn = null;
    if (dm) { await fc(`[data-action="ph-dm"][data-value="${dm.v}"]`); await F().fill('[name="ph-draft"]', '오늘 몇 시에 와?').catch(() => {}); const sendB = (await acts(/^ph-send/))[0]; if (sendB) { sentBtn = sendB.a; await fc(`[data-action="${sendB.a}"]`); } }
    await sleep(5000); await quietAux(t);
    await t.closeWindow().catch(() => {});
    const d1 = await dots();
    step('E12-2', '단추로만 괴담톡 호출 → 진행 창 「인터넷」 점 안 켜짐', null, '채팅 턴 없이 단추로 부른 호출은 수동 턴, 「인터넷」 점 안 켜짐 (0.21.34). 판독', '0.21.34 고친 것', { dm, sentBtn, d0, d1, shot: await shot('e12-dot') });
  }

  saveJson(OUT + '/world-end.json', await world(t));
} catch (e) {
  step('ERR', '예외', false, null, null, String(e?.stack ?? e).slice(0, 1500));
  await shot('ERR').catch(() => {});
} finally {
  res.errors = t.errors.filter((e) => !/displayData|\[goei\] (시작|본체|세계)/.test(e)).slice(0, 40);
  saveJson(OUT + '/result.json', res);
  console.log('OUT', OUT);
  await t.close();
}
