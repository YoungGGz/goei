// 3차 D 구간 (상황판·지도·출동·임무). 사용: FAKE_URL=http://<IP>:<port> node run.mjs [--only d1,d2,...] [--w 1280 --h 800]
// 단계마다 기대값·결정표 줄을 먼저 적고(step 의 want/ref), 실제값을 붙여 자동 대조한다. src 는 안 건드림.
import { open, STATES, sleep, turn, waitMain, readRequest, buildReply, quietAux, world, saveJson, saveText, reqText, text } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const OUT = fileURLToPath(new URL(`./out/run-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), size: `${W}x${H}`, steps: [] };
const step = (id, name, ok, want, ref, got) => { res.steps.push({ id, name, ok, want, ref, got }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 300)); saveJson(OUT + '/result.json', res); };
const on = (k) => !ONLY.length || ONLY.includes(k);
const t = await open({ out: OUT, width: W, height: H, touch: W < 600 });
const shot = async (n) => { await t.shot(n); return `${OUT}/${n}.png`; };
const F = () => t.F();
const fc = async (sel, i = 0) => { try { await F().locator(sel).locator("visible=true").nth(i).click({ timeout: 3000 }); } catch (e) { const ok = await F().evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, { sel, i }); if (!ok) throw e; res.domClicks = (res.domClicks ?? []).concat(sel); } await sleep(700); };
const ftext = (sel = '.gx') => F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ') ?? null, sel);
const acts = (re) => F().evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r.test(e.dataset.action)).map((e) => ({ a: e.dataset.action, v: e.dataset.value ?? null, t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), dis: !!e.disabled })); }, re.source);
const userMsgs = (body) => (body.messages ?? []).filter((m) => m.role === 'user').map((m) => text(m.content));
const has = (s, sec) => s.includes(sec.slice(0, 60));
const PROSE = '쟈알디가 서류를 덮었다.\n\n<img=Jyaldi_serious>\n\n"출발한다."';
const ST = { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' };
let DIR = {};
{ const raw = (await import('node:fs')).readFileSync(new URL('../../../../지침/이동_임무_지시문.txt', import.meta.url), 'utf8'); for (const m of raw.matchAll(/===([A-Z]+)===\n([\s\S]*?)(?====|$)/g)) DIR[m[1]] = m[2].trim(); }

async function boot(state = 'S-관리국-3턴') {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  await t.openWindow('.gx');
  await sleep(1200);
}
async function openTab(v) { if (!F() || !(await F().$('.gx'))) await t.openWindow('.gx'); const cur = await F().evaluate(() => document.querySelector('[data-action="nav-tab"].on, [data-action="nav-tab"][aria-current="page"], [data-action="nav-tab"].active')?.dataset.value ?? null); if (cur !== v) await fc(`[data-action="nav-tab"][data-value="${v}"]`); if (!(await F().evaluate((v) => !!document.querySelector(`[data-action="nav-tab"][data-value="${v}"].on, [data-action="nav-tab"][data-value="${v}"][aria-current="page"]`), v))) { await fc('[data-action="nav-tab"][data-value="board"]').catch(() => {}); if (v !== 'board') await fc(`[data-action="nav-tab"][data-value="${v}"]`); } }
async function reopen() { await t.closeWindow(); await t.openWindow('.gx'); await sleep(1000); }

try {
  await boot();
  const w0 = await world(t);
  saveJson(OUT + '/world0.json', w0);

  // ───── D1 지도 ─────
  if (on('d1')) {
    await openTab('map');
    const all = await acts(/^ev-pop$/);
    await fc('[data-action="map-region"][data-value="12"]');
    const r12 = await acts(/^(ev-pop|map-place)$/);
    await shot('d1-region12');
    await fc('[data-action="map-place"][data-value="12-10"]');
    const p12 = await acts(/^(ev-pop|pick-place)$/);
    step('D1-1', '지역(충북) → 장소(영동군) → 그 장소 사건만', r12.some((x) => x.a === 'map-place' && /영동군/.test(x.t)) && p12.filter((x) => x.a === 'ev-pop').length === 1 && /명일 아파트/.test(p12.find((x) => x.a === 'ev-pop')?.t ?? ''), '지역 누르면 시군구 핀, 영동군 누르면 사건 카드가 명일 아파트 하나(목록은 장소를 고를 때만 거름 — field.ts situations)', '코스 D1', { before: all.map((x) => x.t), region: r12.filter((x) => x.a === 'ev-pop').length, place: p12.map((x) => `${x.a}:${x.t}`), shot: await shot('d1-place') });
    await fc('[data-action="map-unplace"]');
    for (const f of ['an', 'in', 'ms', 'all']) {
      await fc(`[data-action="map-filter"][data-value="${f}"]`);
      const l = await acts(/^ev-pop$/);
      step('D1-2', `걸러 보기 ${f}`, f === 'all' ? true : l.every((x) => x.v.startsWith(f + '|')), `${f} 만 남음`, '코스 D1', l.map((x) => x.v));
    }
    // 확대: + 두 번 → 끌기 → Ctrl+휠 → 다시 그리기(걸러 보기) 뒤 유지
    const tf = () => F().evaluate(() => document.querySelector('.gx-canvas[data-map] .gx-mapzoom')?.style.transform ?? null);
    await fc('[data-zoom="in"]'); await fc('[data-zoom="in"]');
    const z1 = await tf();
    const cv = await F().locator('.gx-canvas[data-map]').boundingBox();
    const fr = await t.page.$('iframe'); const fb = await fr.boundingBox();
    const cx = fb.x + cv.x + cv.width / 2, cy = fb.y + cv.y + cv.height / 2;
    await t.page.mouse.move(cx, cy); await t.page.mouse.down(); await t.page.mouse.move(cx - 80, cy - 40, { steps: 8 }); await t.page.mouse.up();
    await sleep(400);
    const z2 = await tf();
    await t.page.keyboard.down('Control'); await t.page.mouse.move(cx, cy); await t.page.mouse.wheel(0, -300); await t.page.keyboard.up('Control');
    await sleep(500);
    const z3 = await tf();
    await fc('[data-action="map-filter"][data-value="an"]');
    const z4 = await tf();
    await fc('[data-action="map-filter"][data-value="all"]');
    step('D1-3', '확대(+)·끌기·Ctrl+휠, 다시 그린 뒤 확대 유지', !!z1 && z2 !== z1 && z3 !== z2 && z4 === z3, '+ 두 번에 scale>1, 끌면 translate 바뀜, Ctrl+휠로 더 커짐, 걸러 보기(다시 그림) 뒤 같은 transform', '코스 D1', { z1, z2, z3, z4, shot: await shot('d1-zoom') });
    // 카드 그림: 상황판 항목 art 기록, 같은 항목은 그림이 안 바뀜
    const arts = (w) => Object.fromEntries((['an', 'in', 'ms']).flatMap((k) => (w?.[k] ?? []).map((e) => [`${k}:${e.name}`, e.art ?? null])));
    step('D1-4', '괴이·사건 카드 공용 그림이 항목 art 에 기록', Object.values(arts(w0)).every((a) => a), '모든 항목에 art 가 있음 (D-02)', 'D-02 사용자 결정', arts(w0));
    const imgs = await F().evaluate(() => [...document.querySelectorAll('[data-action="ev-pop"] img, .gx-evthumb img, [data-action="ev-pop"] [style*="background"]')].map((e) => (e.getAttribute('src') || e.style.backgroundImage || '').slice(-80)));
    step('D1-5', '지도 사건 카드 그림 (낱말로 고른 공용 그림)', null, '카드마다 그림, 엉뚱한 그림 아님(눈으로)', 'D-02', { imgs, shot: await shot('d1-cards') });
  }

  // ───── D2 편성 → 출동 ─────
  if (on('d2')) {
    await reopen();
    await openTab('map');
    await fc('[data-action="ev-pop"][data-value^="an|12-10|명일 아파트"]');
    const pop = await acts(/^(pick-event|end-event|wiki-goto|ev-pop)$/);
    await shot('d2-pop');
    await fc('[data-action="pick-event"]');
    await fc('[data-action="team-toggle"][data-value="P001"]');
    await fc('[data-action="team-toggle"][data-value="P003"]');
    await fc('[data-action="support"][data-value="1"]');
    const teamTxt = await ftext('.gx');
    await shot('d2-team');
    const seq0 = await t.fakeSeq();
    writeFileSync(t.REPLY, '(아직)');
    await fc('[data-action="depart"]');
    const rec = await waitMain(t, seq0);
    const req = rec ? readRequest(rec.body) : null;
    if (rec) saveText(OUT + '/d2-depart-request.txt', reqText(rec.body));
    const lastU = req ? userMsgs(rec.body).at(-1) : '';
    step('D2-1', '출발 → 본편 user 칸에 COMMON+CONTINUATION+CONTEXT', !!rec && has(lastU, DIR.COMMON) && has(lastU, DIR.CONTINUATION) && !has(lastU, DIR.OPENING) && /Subject: .*명일 아파트/.test(lastU) && /쟈알디|Jyaldi/.test(lastU) && /잼트리|Jaemtri/.test(lastU) && /one support person/.test(lastU), '지시문 셋 + Subject 명일 아파트(충북 영동군) + Companions 쟈알디·잼트리·지원 1', '코스 D2, B-10', { pop: pop.map((x) => x.a), teamTxt: teamTxt?.slice(0, 200), lastUser: lastU.slice(0, 1500) });
    // 답: 명일 아파트 배치 P001,P003
    const reply = buildReply(req, { prose: PROSE, status: { ...ST, place: '충청북도 영동군 명일 아파트 앞', companions: '쟈알디,잼트리', deployed: '투입' }, mutate: (w) => w.map((x) => x.startsWith('[AN|') && x.includes('명일 아파트') ? x.replace(/\|없음\|([^|\]]*)\]$/, '|P001,P003|$1]') : x.startsWith('[AG|P001|') || x.startsWith('[AG|P003|') ? x.replace(/\|내근\|[^\]]*\]/, '|작전투입|명일 아파트 현장에 투입됐다]') : x) });
    writeFileSync(t.REPLY, reply);
    await t.fake('release', { seq: rec.seq });
    await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t);
    const w1 = await world(t);
    const scr = await t.screenMessages();
    step('D2-2', '출동 답 뒤 상황판: 명일 아파트 배치·요원 작전투입', JSON.stringify(w1).includes('작전투입'), '요원 P001·P003 작전투입, 화면 채팅 속 출동 카드(목표·투입)', '코스 D2', { agents: (w1?.ag ?? []).filter((a) => /P001|P003/.test(a.code ?? a.id ?? '')), screenLastUser: scr.at(-2)?.text?.slice(0, 200), shot: await shot('d2-after') });
    // 다음 턴: 지난 지시문은 CONTEXT 만
    const tr = await turn(t, { prose: '현관 문턱을 넘자 5층 복도였다.\n\n<img=Jyaldi_thinking>\n\n"계단은 없다. 조심해."', status: { ...ST, place: '명일 아파트 5층 복도', companions: '쟈알디,잼트리', deployed: '투입' } }, null, '쟈알디 뒤를 따라 복도를 살핀다.');
    saveText(OUT + '/d2-next-request.txt', reqText(tr.rec.body));
    const us = userMsgs(tr.rec.body);
    const prevDir = us.find((u) => /Subject: .*명일 아파트/.test(u)) ?? '';
    step('D2-3', '다음 턴: 지난 지시문은 CONTEXT 만', !!prevDir && !has(prevDir, DIR.COMMON) && !has(prevDir, DIR.CONTINUATION), '앞 출동 메시지는 Subject·Companions 만 남고 COMMON·CONTINUATION 빠짐', '코스 D2', { prevDir: prevDir.slice(0, 600) });
  }

  // ───── D3 커스텀 임무 보내기·취소 (갈래마다 따로 돌림: --only d3a / d3b / d3c / d3d) ─────
  const pend = async () => (await world(t))?.pending ?? null;
  const lastMsg = async () => { const st = await t.chatState(true); return { n: st.message.length, last: st.message.at(-1), roles: st.message.slice(-3).map((m) => m.role + ':' + String(m.data).slice(0, 50)) }; };
  const pickMission = async (name) => {
    await openTab('map');
    if (!(await acts(/^mission-kind$/)).length) await fc('[data-action="tab"][data-value="mission"]');
    await fc('[data-action="mission-kind"][data-value="an"]');
    await fc(`[data-action="mission-open"][data-value="an:${name}"]`);
    const picks = await acts(/^mission-pick$/);
    await fc(`[data-action="mission-pick"][data-value="${picks[0].v}"]`);
  };
  const cancelBar = async () => { await reopen(); await openTab('map'); if (!(await acts(/^mission-kind$/)).length) await fc('[data-action="tab"][data-value="mission"]'); return acts(/^mission-cancel$/); };
  const anNames = async () => ((await world(t))?.an ?? []).map((a) => a.name);
  if (on('d3a')) { // 보냄 → 503 실패(답 없이 끝남) → 다시 고르기·요청 취소
    const n0 = (await lastMsg()).n;
    await t.fake('rules/add', { rule: { id: 'm-fail', route: 'main', status: 503 } });
    await pickMission('금지된 비디오');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="mission-send"]');
    await sleep(3000); await t.waitIdle(60000).catch(() => {});
    await sleep(2000);
    const tries = (await t.fakeLog(seq0, 'main')).length;
    await t.fake('rules/del', { id: 'm-fail' });
    const afterFail = await lastMsg();
    const p1 = await pend();
    await shot('d3a-fail-chat');
    const bar = await cancelBar();
    await shot('d3a-bar');
    await fc('[data-action="mission-cancel"][data-value="an"]').catch(() => {});
    await sleep(1500);
    const afterCancel = await lastMsg();
    step('D3a-1', '503 실패로 답 없이 끝난 뒤 요청 취소 → 카드째 물림·대기 지움', afterFail.n === n0 + 1 && !!p1?.an && bar.length > 0 && afterCancel.n === n0 && !(await pend())?.an, '실패 뒤 채팅 끝에 임무 카드(user) 하나·pending.an 있음 → 취소하면 카드가 빠지고 pending 비움 (0.21.34)', '코스 D3·D7, withdrawUnsentAt', { n0, tries, afterFail: afterFail.roles, pendingAfterFail: p1, bar, afterCancel: afterCancel.roles, pendingEnd: await pend(), alerts: (await t.alerts()).slice(-2) });
    // 실패 뒤 다시 보내기 막히지 않음
    await pickMission('교회');
    const s2 = await t.fakeSeq();
    await fc('[data-action="mission-send"]');
    const rec = await waitMain(t, s2, 30000);
    step('D3a-2', '실패 뒤 다시 임무 요청이 막히지 않음', !!rec, '본편 요청이 나감 (0.21.34)', '코스 D7', { notice: rec ? null : (await ftext('.gx-sidecol'))?.slice(0, 120) });
    if (rec) { writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST })); await t.fake('release', { seq: rec.seq }); await t.waitIdle().catch(() => {}); }
  }
  if (on('d3b') || on('d3e')) { // 리스AI 중지 (d3e = 스트리밍 켬)
    if (on('d3e')) await t.setStreaming(true);
    await pickMission('금지된 비디오');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="mission-send"]');
    const rec = await waitMain(t, seq0);
    await t.stop(); await sleep(1500);
    const afterStop = await lastMsg();
    const busyAfterStop = { busy: await t.isBusy(), idle: await t.isIdle(), prog: await t.progText() };
    await shot('d3b-stopped');
    const bar = await cancelBar();
    await fc('[data-action="mission-cancel"][data-value="an"]').catch(() => {});
    await sleep(1500);
    const afterCancel = await lastMsg();
    const pc = await pend();
    writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: '(중지 뒤 온 답)', status: ST }));
    await t.fake('release', { seq: rec.seq }); await sleep(3000); await t.waitIdle().catch(() => {});
    const late = await lastMsg();
    step('D3b-1', '리스AI 중지 직후 요청 취소 → 카드째 물림', bar.length > 0 && afterCancel.n === afterStop.n - 1 && !pc?.an, '중지 = 답 없이 끝남 → 취소하면 카드가 빠짐 (0.21.34)', '코스 D7', { busyAfterStop, afterStop: afterStop.roles, bar, afterCancel: afterCancel.roles, pc });
    step('D3b-2', '중지 뒤 붙잡힌 답이 늦게 오면 (리스AI 동작 기록)', null, '판정 밖: 비스트리밍 요청은 중지해도 답이 오면 붙는지', '틀 기록', { late: late.roles, an: await anNames(), pending: await pend() });
  }
  if (on('d3c')) { // 기다리는 중 요청 취소 = 대기만 지움 → 답이 NEW 를 채워 옴
    await pickMission('금지된 비디오');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="mission-send"]');
    const rec = await waitMain(t, seq0);
    const bar = await cancelBar();
    await fc('[data-action="mission-cancel"][data-value="an"]').catch(() => {});
    await sleep(1200);
    const mid = await lastMsg(); const pm = await pend();
    writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST }));
    await t.fake('release', { seq: rec.seq }); await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t);
    step('D3c-1', '답 기다리는 중 요청 취소 → 대기만 지움(카드 그대로)', bar.length > 0 && mid.last?.role === 'user' && !pm?.an, '카드 안 건드리고 pending.an 만 비움', '코스 D3, cancelRequest', { bar, mid: mid.roles, pm });
    step('D3c-2', '취소한 뒤 온 답이 NEW 줄(금지된 비디오)을 채우면', null, '사실 기록: 요청은 이미 NEW 줄을 싣고 나갔다. 취소한 대상이 상황판에 생기는지', '공-02 (Claude 가 일관되게 정할 거리)', { an: await anNames(), pending: await pend() });
  }
  if (on('d3d')) { // 임무 → 답(NEW 채움) → 답 지움 → 되돌아간 상태에 요청이 남는지 / 답이 NEW 를 안 채움
    await pickMission('금지된 비디오');
    const tr = await turn(t, { prose: PROSE, status: ST }, async () => fc('[data-action="mission-send"]'));
    const an1 = await anNames(); const p1 = await pend();
    const n1 = (await lastMsg()).n;
    await t.deleteMessage(n1 - 1); await sleep(1500);
    const an2 = await anNames(); const p2 = await pend(); const m2 = await lastMsg();
    step('D3d-1', '임무 답(대상 생김) → 그 답 지움 → 대상은 사라지고 요청은 대기로 남음', an1.includes('금지된 비디오') && !an2.includes('금지된 비디오') && p2?.an === '금지된 비디오', '답이 만든 금지된 비디오는 되돌아가고, 임무 창에서 건 요청(pending.an)은 남음 (0.21.34, output.ts:126-131)', '코스 D3, 공-01', { an1, p1, an2, p2, chat: m2.roles });
    const bar = await cancelBar();
    await shot('d3d-bar');
    // 다음 보내기: 남은 카드가 답 없는 끝 메시지 → 리스아이 보내기 = 새 user 하나. NEW 줄 다시 감?
    const tr2 = await turn(t, { prose: PROSE, status: ST, mutate: (w) => w.filter((x) => !x.includes('금지된 비디오')) }, null, '주변을 둘러본다.');
    const nl = tr2.req.entries.filter((e) => e.isNew).map((e) => e.tag);
    step('D3d-2', '지운 뒤 다음 요청에 NEW 줄 다시 감, 답이 안 채우면 대기 유지', nl.some((x) => x.includes('금지된 비디오')) && (await pend())?.an === '금지된 비디오', 'NEW [AN|…|금지된 비디오|…] 다시 실림, 모델이 안 채우면 pending 그대로', '코스 D3', { bar, nl, pending: await pend(), an: await anNames() });
  }

  if (on('d3f')) { // 입력칸으로 보낸 본편을 리스AI 중지 → 임무 요청·요청 취소가 막히지 않는지
    const seq0 = await t.fakeSeq();
    await t.closeWindow(); await t.send('창밖을 본다.', { wait: false });
    const rec = await waitMain(t, seq0);
    await sleep(800); await t.stop(); await sleep(1500);
    const b = { busy: await t.isBusy(), idle: await t.isIdle(), prog: await t.progText() };
    const m0 = await lastMsg();
    await t.openWindow('.gx'); await sleep(600);
    await pickMission('금지된 비디오');
    const s2 = await t.fakeSeq();
    await fc('[data-action="mission-send"]');
    const rec2 = await waitMain(t, s2, 30000);
    const note = rec2 ? null : (await ftext('.gx-sidecol').catch(() => null))?.slice(0, 160);
    step('D3f-1', '입력칸 보낸 본편을 중지한 뒤 임무 요청이 막히지 않음', b.idle && !!rec2, '중지하면 리스아이 쉬는 중, 임무 요청이 바로 나감(「답을 기다리는 중」 안내 없이) (0.21.34)', '코스 D7', { b, chat: m0.roles, note });
    if (rec) await t.fake('release', { seq: rec.seq }).catch(() => {});
    if (rec2) { writeFileSync(t.REPLY, buildReply(readRequest(rec2.body), { prose: PROSE, status: ST })); await t.fake('release', { seq: rec2.seq }); await t.waitIdle().catch(() => {}); }
  }

  // ───── D6 명부: 순서 바꾸기 → 다음 턴 요청·연락처·지도 ─────
  const agOrder = (body) => { const r = readRequest(body); return (r.weText.match(/^\[AG\|P\d+/gm) ?? []).map((x) => x.slice(4)); };
  const boardOrder = async () => { await reopen(); await openTab('board'); return (await acts(/^agent-info$/)).map((x) => x.v); };
  const mapOrder = async () => { await openTab('map'); return (await acts(/^team-toggle$/)).map((x) => x.v); };
  const openRoster = async () => { await reopen(); await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="world"]'); await fc('[data-action="ed-node"][data-value="agent"]'); };
  if (on('d6')) {
    const b0 = await boardOrder(), m0 = await mapOrder();
    await openRoster();
    await fc('[data-action="ed-sel"][data-value="잼트리"]');
    const panel = await F().evaluate(() => [...document.querySelectorAll('[data-input],[data-key]')].filter((e) => e.offsetParent !== null).map((e) => `${e.dataset.input ?? ''}:${e.dataset.key ?? ''}=${(e.value ?? '').slice(0, 20)}`).slice(0, 40));
    await shot('d6-jaemtri');
    await fc('[data-action="dir-move"][data-value="up|잼트리"]');
    await sleep(1500);
    const b1 = await boardOrder(), m1 = await mapOrder();
    await openTab('phone');
    const contacts = (await ftext('.gx'))?.slice(0, 400);
    await shot('d6-phone');
    const tr = await turn(t, { prose: PROSE, status: ST }, null, '다음 일을 준비한다.');
    const o = agOrder(tr.rec.body);
    step('D6-1', '명부 순서(잼트리 위로) → 상황판·임무 편성·다음 요청 순서', b1.indexOf('P003') < b1.indexOf('P002') && m1.indexOf('P003') < m1.indexOf('P002') && o.indexOf('P003') < o.indexOf('P002'), '잼트리(P003)가 스팡달(P002) 앞: 상황판 요원 칸, 임무 편성 목록, 다음 본편 요청 #### Agent 줄 차례', '코스 D6', { b0, b1, m0, m1, reqOrder: o });
    step('D6-2', '명부 요원 이름 칸 (이름 바꾸기 가능한지 사실 기록)', null, '요원 기록 창의 입력칸 목록', '코스 D6', { panel, contacts });
  }

  // ───── D7 갈래 ─────
  if (on('d7a')) { // 답 오는 중 출동·종료·명부 저장
    const seq0 = await t.fakeSeq();
    await t.closeWindow(); await t.send('창밖을 본다.', { wait: false });
    const rec = await waitMain(t, seq0);
    await t.openWindow('.gx'); await sleep(800);
    // 출동
    await openTab('map');
    await fc('[data-action="ev-pop"][data-value^="an|12-10|명일 아파트"]');
    await fc('[data-action="pick-event"]');
    await fc('[data-action="depart"]');
    await sleep(1200);
    const note = await F().evaluate(() => document.querySelector('.gx-err, [role="alert"]')?.innerText ?? null);
    const nAfterDepart = (await t.chatState()).message.length;
    // 종료
    await reopen(); await openTab('board');
    const key = (await acts(/^ops-sel$/)).find((x) => /꿈과 희망의 극단/.test(x.t))?.v;
    await fc(`[data-action="ops-sel"][data-value="${key}"]`);
    await fc(`[data-action="end-event"][data-value="${key}"]`); await fc(`[data-action="end-event"][data-value="${key}"]`);
    await sleep(1000);
    const wMid = await world(t);
    // 명부
    await openRoster(); await fc('[data-action="dir-move"][data-value="up|잼트리"]'); await sleep(1500);
    const req = readRequest(rec.body);
    writeFileSync(t.REPLY, buildReply(req, { prose: PROSE, status: ST }));
    await t.fake('release', { seq: rec.seq }); await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t);
    const w2 = await world(t);
    const b2 = await boardOrder();
    step('D7a-1', '답 오는 중 출동 → 막고 안내, 채팅에 카드 안 놓음', /기다리는 중/.test(note ?? '') && nAfterDepart === 7 + 1, '「답을 기다리는 중이라 지금은 보낼 수 없어요」, 메시지 수 그대로(보낸 user 1개만 늘어 8)', '코스 D7, field.ts WAIT_SEND_NOTE', { note, nAfterDepart });
    step('D7a-2', '답 오는 중 손 종료 → 바로 끝나고, 늦게 온 답(그 괴이 태그 포함)이 되살리지 않음', !(wMid?.an ?? []).some((a) => a.name === '꿈과 희망의 극단') && !(w2?.an ?? []).some((a) => a.name === '꿈과 희망의 극단'), '종료 즉시 빠지고, 답(요청 때 목록 그대로 꿈과 희망의 극단 태그를 다시 적음) 뒤에도 끝난 채 (D-04, K-01 늦게 온 답이 덮는지)', 'D-04, K-01', { mid: (wMid?.an ?? []).map((a) => a.name), after: (w2?.an ?? []).map((a) => a.name), ended: w2?.ended?.map((e) => e.name) });
    step('D7a-3', '답 오는 중 명부 순서 저장 → 답 뒤에도 남음', b2.indexOf('P003') < b2.indexOf('P002'), '잼트리가 스팡달 앞 그대로', 'K-01', { b2 });
  }
  if (on('d7b')) { // 메시지를 다 지우고 같은 채팅에서 다시 시작 → 옛 기준 상태 비움
    const st0 = await t.chatState(true);
    const prevBefore = !!st0.scriptstate?.$goei_prev;
    await t.closeWindow();
    for (let k = st0.message.length; k > 0; k--) { await t.deleteMessage(k - 1); await sleep(700); }
    const st1 = await t.chatState(true);
    await t.openWindow('.gx'); await sleep(1200);
    const view = (await ftext('.gx'))?.slice(0, 200);
    const startPanel = await F().evaluate(() => !!document.querySelector('.gx-fac'));
    await shot('d7b-empty');
    step('D7b-1', '메시지를 다 지운 채팅 → 창을 열면 시작 패널, 옛 기준 상태 비움', startPanel, '빈 채팅이면 시작 패널(새 작전 준비). 그 뒤 출발하면 지난 판 $goei_prev 가 첫 응답 되감기에 쓰이지 않음 (0.21.34)', '코스 D7', { prevBefore, nMsgs: st1.message.length, prevAfterDelete: !!st1.scriptstate?.$goei_prev, keys: Object.keys(st1.scriptstate ?? {}).length, view });
    if (startPanel) {
      const old = (await world(t))?.an?.map((a) => a.name) ?? [];
      const seq0 = await t.fakeSeq();
      await t.closeWindow();
      await t.startPanel({ fac: 'A00', player: '', scene: '직접 입력', situation: '관리국 본부 사무실, 아침. 서류를 정리한다.' });
      const rec = await waitMain(t, seq0, 60000);
      const st2 = await t.chatState(true);
      let prev2 = null; try { prev2 = JSON.parse(st2.scriptstate?.$goei_prev ?? 'null'); } catch {}
      const nowAn = (() => { try { return JSON.parse(st2.scriptstate.$goei_world).an.map((a) => a.name); } catch { return null; } })();
      const req = rec ? readRequest(rec.body) : null;
      if (rec) saveText(OUT + '/d7b-first-request.txt', reqText(rec.body));
      const reqAn = req ? (req.weText.match(/^(?:NEW )?\[AN\|[^|]*\|([^|]*)\|/gm) ?? []).map((x) => x.split('|')[2]) : [];
      if (rec) { writeFileSync(t.REPLY, buildReply(req, { prose: PROSE, status: ST })); await t.fake('release', { seq: rec.seq }); await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t); }
      const st3 = await t.chatState(true);
      const afterAn = (() => { try { return JSON.parse(st3.scriptstate.$goei_world).an.map((a) => a.name); } catch { return null; } })();
      let prev3 = null; try { prev3 = JSON.parse(st3.scriptstate?.$goei_prev ?? 'null'); } catch {}
      step('D7b-2', '다 지운 채팅에서 다시 출발 → 첫 요청·첫 응답이 새 판 상황판으로', !!rec && JSON.stringify(reqAn) === JSON.stringify(nowAn) && JSON.stringify(afterAn.filter(Boolean)).length > 2, '출발이 새 상황판을 깔고, 옛 판 기준($goei_prev: i·k 가 지운 메시지)이 첫 요청·첫 응답 처리에 쓰이지 않음 (0.21.34 「옛 기준 상태 비움」)', '코스 D7', { old, prevAfterStart: prev2 ? { i: prev2.i, k: prev2.k } : null, worldAfterStart: nowAn, firstReqAn: reqAn, afterReplyAn: afterAn, prevAfterReply: prev3 ? { i: prev3.i, k: prev3.k } : null, n: st3.message.length });
    }
  }
  if (on('d7d')) { // 덧붙일 규칙에 [[…]] 가 든 채 출동
    await reopen(); await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="guide"]'); await fc('[data-action="ed-node"][data-value="rule:all"]');
    await fc('[data-action="ed-rule-new"]');
    const id = await F().evaluate(() => document.querySelector('[data-input="ed-rule-text"]')?.dataset.key);
    await F().fill(`[data-input="ed-rule-text"][data-key="${id}"]`, '대사 끝에 [[TIP]] 같은 꺾쇠 표시를 쓰지 않는다.');
    await F().fill(`[data-input="ed-rule-title"][data-key="${id}"]`, '표시');
    await sleep(500);
    const toOn = await F().evaluate((id) => document.querySelector(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`)?.getAttribute('aria-pressed'), id);
    if (toOn !== 'true') await fc(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`);
    await shot('d7d-rule');
    await reopen(); await openTab('map');
    await fc('[data-action="ev-pop"][data-value^="an|12-10|명일 아파트"]');
    await fc('[data-action="pick-event"]');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="depart"]');
    const rec = await waitMain(t, seq0, 15000);
    const note = rec ? null : await F().evaluate(() => document.querySelector('.gx-err, [role="alert"]')?.innerText ?? null);
    await shot('d7d-depart');
    step('D7d-1', '덧붙일 규칙 글에 [[TIP]] → 출동', !!rec, '규칙 글은 플레이어 글이라 출동이 막히지 않고 COMMON 끝에 그대로 붙는다 (Claude 판정)', '코스 D7', { toOnBefore: toOn, sent: !!rec, note, lastUser: rec ? userMsgs(rec.body).at(-1).slice(0, 300) : null });
    if (rec) { writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST })); await t.fake('release', { seq: rec.seq }); await t.waitIdle().catch(() => {}); }
  }

  // ───── D8 진행 창 ─────
  if (on('d8')) {
    const P = () => t.page.evaluate(() => { const h = document.querySelector('[x-goei-prog]'); if (!h) return null; const card = h.shadowRoot ?? h; const r = h.getBoundingClientRect(); const g = (h.shadowRoot ?? h).querySelector('[data-grip]')?.getBoundingClientRect(); const d = (h.shadowRoot ?? h).querySelector('[data-dot]')?.getBoundingClientRect(); return { open: h.getAttribute('x-goei-open'), run: h.getAttribute('x-goei-run'), vis: getComputedStyle(h).display, r: [r.x, r.y, r.width, r.height].map(Math.round), grip: g ? [g.x, g.y, g.width, g.height].map(Math.round) : null, dot: d ? [d.x, d.y, d.width, d.height].map(Math.round) : null, text: h.innerText.replace(/\s+/g, ' ').slice(0, 400), pos: localStorage.getItem('goei-plugin:prog-pos') ?? (window.safeLocalStorage ? null : null) }; });
    const ls = () => t.R(async () => { try { const m = await import('/src/ts/globalApi.svelte.ts'); } catch {} return Object.fromEntries(Object.keys(localStorage).filter((k) => /prog/.test(k)).map((k) => [k, localStorage.getItem(k)])); });
    await t.closeWindow();
    const seq0 = await t.fakeSeq();
    await t.send('창밖을 본다.', { wait: false });
    const rec = await waitMain(t, seq0);
    await sleep(1500);
    const p0 = await P();
    await shot('d8-wait');
    let p1 = null, p2 = null;
    if (p0?.grip) {
      const [gx, gy, gw, gh] = p0.grip; const sx = gx + gw / 2, sy = gy + gh / 2;
      await t.page.mouse.move(sx, sy); await t.page.mouse.down(); await t.page.mouse.move(sx - 250, sy + 200, { steps: 10 }); await t.page.mouse.up();
      await sleep(800); p1 = await P();
      const g = p1.grip; await t.page.mouse.click(g[0] + 30, g[1] + g[3] / 2); await sleep(800); p2 = await P();
      await shot('d8-folded');
    }
    step('D8-1', '진행 창: 메인 응답 대기 뜸 → 머리글 끌어 옮김 → 머리글 눌러 접음', p0?.open === 'true' && /메인 응답 대기/.test(p0.text) && p1 && (p1.r[0] !== p0.r[0] || p1.r[1] !== p0.r[1]) && p2?.open === 'false', '끌면 자리가 바뀌고, 누르면 접혀 점 단추만', '코스 D8', { p0, p1, p2, ls: await ls() });
    writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST }));
    await t.fake('release', { seq: rec.seq }); await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t);
    const p3 = await P();
    // 둘째 턴: Router 답을 꼴 틀리게
    await t.fake('rules/add', { rule: { id: 'a-router-bad', route: 'aux', match: '# Router — scene people selection', malformed: true } });
    const tr = await turn(t, { prose: PROSE, status: ST }, null, '서류를 넘긴다.');
    await t.fake('rules/del', { id: 'a-router-bad' });
    // 접혀 있으면 펼쳐서 글 읽기
    let p4 = await P();
    if (p4?.open !== 'true' && p4?.dot) { await t.page.mouse.click(p4.dot[0] + p4.dot[2] / 2, p4.dot[1] + p4.dot[3] / 2); await sleep(800); p4 = await P(); }
    await shot('d8-turn2');
    step('D8-2', '둘째 턴(라우터 꼴 틀린 답): 호출 단위로 끝, 앞 턴 호출 안 섞임', /라우터/.test(p4?.text ?? '') && !/메인 응답 대기/.test(p4?.text ?? ''), '라우터 줄이 실패/끝으로, 줄 수는 이번 턴 것만(라우터·디렉터·메인·갱신기) (D-06)', 'D-06 Claude 판정', { p3: p3?.text, p4: p4?.text, auxSeqs: tr.aux.map((x) => `${x.seq}:${x.ruleId}`) });
    await t.reload();
    await sleep(1500);
    const p5 = await P();
    step('D8-3', '새로고침 뒤 진행 창 자리 유지', !!p5 && !!p1 && Math.abs(p5.r[0] + p5.r[2] - (p1.r[0] + p1.r[2])) < 30, '옮긴 자리(오른쪽·위 거리) 그대로 (goei-plugin:prog-pos)', '코스 D8', { p5, ls: await ls() });
    await t.newChat(); await sleep(1500);
    const p6 = await P();
    await t.switchChat(1); await sleep(1500);
    const p7 = await P();
    step('D8-4', '채팅 옮긴 뒤 진행 창', null, '사실 기록: 새 채팅·다시 돌아온 뒤 진행 창 모양', '코스 D8', { newChat: p6, back: p7 });
  }

  // ───── D4 손 종료·다시 적기·요원 사망과 되돌림 ─────
  if (on('d4')) {
    await reopen(); await openTab('board');
    const key = (await acts(/^ops-sel$/)).find((x) => /소라 랜드/.test(x.t))?.v;
    await fc(`[data-action="ops-sel"][data-value="${key}"]`);
    await fc(`[data-action="end-event"][data-value="${key}"]`);
    const confirmTxt = await ftext('.gx');
    const wMid = await world(t);
    await shot('d4-confirm');
    await fc(`[data-action="end-event"][data-value="${key}"]`);
    await sleep(1200);
    const w1 = await world(t);
    const st1 = await t.chatState(true);
    const jr = st1.scriptstate?.$goei_journal ?? '';
    const rp = st1.scriptstate?.$goei_reports ?? '';
    step('D4-1', '상황 종료 두 번 → 첫 번은 확인, 둘째에 끝남·일지·보고서', (wMid?.an ?? []).some((a) => a.name === '소라 랜드') && !(w1?.an ?? []).some((a) => a.name === '소라 랜드') && /소라 랜드/.test(jr) && /소라 랜드/.test(rp), '첫 누름은 확인 상태(아직 남음), 둘째에 목록에서 빠지고 ended·일지·보고서에 소라 랜드', '코스 D4, D-04', { ended: w1?.ended, journal: String(jr).slice(0, 400), reports: String(rp).slice(0, 400), confirmHint: /한 번 더|확인/.test(confirmTxt ?? '') });
    // 다음 턴: 모델이 끝난 괴이를 다시 적음
    const tr = await turn(t, { prose: PROSE, status: ST, tags: ['[AN|충청남도 보령시|소라 랜드|활성|D|없음|관람차가 다시 돌기 시작했다]'] }, null, '보고서를 정리한다.');
    saveText(OUT + '/d4-after-end-request.txt', reqText(tr.rec.body));
    const w2 = await world(t);
    step('D4-2', '손으로 끝낸 괴이를 모델이 다시 적어도 끝난 채', !(w2?.an ?? []).some((a) => a.name === '소라 랜드'), '소라 랜드 안 살아남 (D-04)', 'D-04 Claude 판정', { an: (w2?.an ?? []).map((a) => a.name) });
    step('D4-3', '끝낸 다음 본편 요청에 소라 랜드 줄 없음 (손-04: 모델에게 알리는 글 있나)', !tr.req.weText.includes('소라 랜드'), 'World Entries 에서 빠짐. 끝났다고 알리는 글이 있는지 사실로 적음', '손-04', { mention: tr.req.all.filter((c) => c.includes('소라 랜드')).map((c) => c.slice(Math.max(0, c.indexOf('소라 랜드') - 200), c.indexOf('소라 랜드') + 100)) });
    // 다시 굴리기: 손 종료는 그 전 일이라 남아야 함
    const rr = await turn(t, { prose: PROSE + ' (다시)', status: ST }, () => t.reroll({ wait: false }));
    const w3 = await world(t);
    step('D4-4', '다시 굴려도 손으로 끝낸 것은 끝난 채', !(w3?.an ?? []).some((a) => a.name === '소라 랜드') && !rr.req.weText.includes('소라 랜드'), '되감기 기준에도 끝남이 들어가 있음 (field.ts saveWorld onPrev)', 'D-04', { an: (w3?.an ?? []).map((a) => a.name) });
    // 요원 사망 → 다시 굴리기로 되돌림
    const td = await turn(t, { prose: PROSE, status: ST, mutate: (w) => w.map((x) => x.startsWith('[AG|P002|') ? '[AG|P002|사망|현장에서 연락이 끊긴 뒤 숨진 채 발견됐다]' : x) }, null, '스팡달의 소식을 듣는다.');
    const w4 = await world(t);
    await reopen(); await openTab('map');
    const lock = await F().evaluate(() => { const c = document.querySelector('[data-action="team-toggle"][data-value="P002"]'); return c ? { cls: c.className, text: c.innerText.replace(/\s+/g, ' ').slice(0, 60) } : null; });
    const rr2 = await turn(t, { prose: PROSE + ' (다시)', status: ST }, () => t.reroll({ wait: false }));
    const w5 = await world(t);
    const agLine = rr2.req.weText.split('\n').find((l) => l.includes('[AG|P002|')) ?? '';
    step('D4-5', '요원 사망 → 다시 굴리면 되돌아감', w4?.agents?.P002?.st === '사망' && w5?.agents?.P002?.st !== '사망' && !agLine.includes('사망'), '사망 답 뒤 P002 사망·편성 잠김, 다시 굴리면 요청부터 내근으로, 답 뒤에도 사망 아님 (D-04)', 'D-04 Claude 판정', { dead: w4?.agents?.P002, lock, rerollReqLine: agLine, after: w5?.agents?.P002 });
  }

  // ───── D5 요원 정보 → 괴담톡·위키·인물 ─────
  if (on('d5')) {
    const goes = {};
    for (const a of ['agent-talk', 'wiki-goto', 'people-goto']) {
      await reopen(); await openTab('board');
      await fc('[data-action="agent-info"][data-value="P003"]');
      const btns = await acts(/^(agent-talk|wiki-goto|people-goto)$/);
      if (!goes.btns) { goes.btns = btns; await shot('d5-info'); }
      const b = btns.find((x) => x.a === a && /잼트리|P003|Jaemtri/.test(x.v ?? ''));
      if (!b) { goes[a] = '단추 없음'; continue; }
      await fc(`[data-action="${a}"][data-value="${b.v}"]`);
      await sleep(1200);
      goes[a] = { tab: await F().evaluate(() => document.querySelector('[data-action="nav-tab"].on')?.dataset.value ?? null), head: (await ftext('.gx'))?.slice(0, 200) };
      await shot('d5-' + a);
    }
    step('D5-1', '요원 정보 → 괴담톡 방·위키 문서·기록 인물', goes['agent-talk']?.tab === 'phone' && goes['wiki-goto']?.tab === 'net' && goes['people-goto']?.tab === 'records', '괴담톡 탭(잼트리 방), 인터넷 위키(잼트리), 기록 인물(잼트리)', '코스 D5', goes);
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
