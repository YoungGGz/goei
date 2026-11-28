// C1·C3 요청 조립 전문: 메시지 순서·덩어리 머리글, 로어 순서 (T1 가짜 리스)
// 사용: node runC1.mjs <fixture.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, boot, startChat, request, chat, setChat, setVars, output, testBodyCode, queueLlm } from '../../../../tests/qc-host.mjs';
const core = await import('../../../../dist-test/core.mjs');
import { OUT } from './lib.mjs';

const fxPath = process.argv[2];
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const B = { fixtureDir: dirname(resolve(fxPath)), body: testBodyCode };
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const asText = (m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
const res = { at: new Date().toISOString() };
const REPLY = '쟈알디가 서류를 넘겼다.\n\n<img=Jyaldi_neutral>\n\n"앉아."\n\n[▣|2025.03.14|09:20 AM|☀️|12°C|서울 종로구 관리국 본부 면담실|없음|쟈알디|없음|관리국/신입|135000]';
const msgsOf = (c, u) => [{ role: 'system', content: 'SYSTEM PROMPT' }, ...c.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: String(m.data) })), { role: 'user', content: u }];
const shape = (msgs) => msgs.map((m, i) => {
  const t = asText(m);
  const heads = [...t.matchAll(/^(?:#{1,3} [^\n]{0,60}|\[[A-Z][A-Za-z ]{2,30}\][^\n]{0,20}|<goei:[a-z]+[^>]*>)/gm)].map((x) => x[0].slice(0, 50));
  return { i, role: m.role, len: t.length, start: t.slice(0, 70).replace(/\n/g, ' '), heads: heads.slice(0, 40) };
});
try {
  const { page, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, B);
  await startChat(page, 'A00', 1);
  const c0 = await chat(page);
  const r1 = await request(page, msgsOf(c0, '첫 행동'));
  res.turn1 = shape(r1);
  writeFileSync(`${OUT}/C1-turn1-request.txt`, r1.map((m, i) => `===== [${i}] ${m.role}\n${asText(m)}`).join('\n\n').replace(/(Age:\s*)[^\n]*/g, '$1[생략]'));
  // 답 붙이고 응답 처리 → 둘째 요청
  const message = [...c0.message, { role: 'user', data: '첫 행동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c2' }];
  await setChat(page, { message });
  await queueLlm(page, '{}', '{}', '{}');
  await output(page, message.length - 1);
  await sleep(2000);
  const c1 = await chat(page);
  const r2 = await request(page, msgsOf(c1, '두 번째 행동'));
  res.turn2 = shape(r2);
  writeFileSync(`${OUT}/C1-turn2-request.txt`, r2.map((m, i) => `===== [${i}] ${m.role}\n${asText(m)}`).join('\n\n').replace(/(Age:\s*)[^\n]*/g, '$1[생략]'));

  // ── C3: 설정 「로어북 확인」 화면 목록 = 다음 요청 로어 ──
  await page.click('[x-goei-fab] button').catch(() => {});
  await sleep(1000);
  await page.click('[data-action="prefs-open"], [data-action="ed-open"]').catch(() => {});
  await sleep(1000);
  await page.click('[data-action="ed-tab"][data-value="set"]').catch(() => {});
  await sleep(500);
  await page.click('[data-action="ed-node"][data-value="set:lore"]').catch(() => {});
  await sleep(1200);
  const screen = await page.evaluate(() => [...document.querySelectorAll('.lc-row')].map((r) => ({ name: r.querySelector('b')?.innerText, kind: r.querySelector('.lc-kind')?.innerText, why: r.querySelector('small')?.innerText })));
  const head = await page.evaluate(() => [...document.querySelectorAll('.gw-page h3')].map((h) => h.innerText));
  const r3 = await request(page, msgsOf(await chat(page), '두 번째 행동'));
  const loreTxt = asText(r3[1]);
  res.C3 = { head, screen, inRequest: screen.map((x) => ({ name: x.name, found: loreTxt.includes(x.name ?? '@@') })) };
  console.log('===== C3 로어북 확인', JSON.stringify(res.C3).slice(0, 1500));

  // ── C2: 참고 기록 여러 개 + 본편 반영 총 상한 ──
  const gn = core.encode({ seq: 1846001, sources: {}, dms: [{ nick: '익명1', side: 'in', body: '쟈알디 봤어?', unread: false, date: '2025.01.01' }], posts: [{ id: 1846001, date: '2025.01.01', nick: '익명7', title: '명일 아파트 소문', views: 3, votes: 1, body: '어젯밤 명일 아파트에서 비명이 들렸다. '.repeat(20), mine: false, comments: [] }] });
  const ph = JSON.stringify({ version: 2, seq: 2, mid: 2, order: ['r1'], rooms: { r1: { id: 'r1', kind: 'dm', members: ['P001'], people: { P001: { name: '쟈알디' } }, messages: [{ id: 1, sender: 'me', text: '부장님 지금 어디세요?', time: '02:00', kind: 'message', audience: ['P001'] }, { id: 2, sender: 'P001', text: '본부다. 빨리 와라.', time: '02:01', kind: 'message', audience: ['P001'] }], draft: '', unread: 0 } } });
  const doc = { key: '', comment: 'WIKI｜명일 아파트', mode: 'normal', insertorder: 0, alwaysActive: false, content: `[NW_PRIVATE_BEGIN]\n<!--NW_META:${JSON.stringify({ title: '명일 아파트', mode: 'create', model: 'aux', created: 1, length: 'short', sources: [], primarySources: [], writingRequest: '', direct: false })}-->\n<lightboard-namuwiki>[Paragraph]${'명일 아파트는 위키 창작 문서다. '.repeat(40)}</lightboard-namuwiki>\n[NW_PRIVATE_END]` };
  await page.evaluate(([gn, ph, doc]) => { window.__chat.scriptstate.$gn_raw = gn; window.__chat.scriptstate.$ph_state = ph; window.__chat.localLore = [doc]; }, [gn, ph, doc]);
  await setVars(page, { $nw_context: '1', $nw_adv_ctx_focus: '0' });
  const ctxOf = (out) => out.map((m, i) => ({ i, role: m.role, t: asText(m) })).filter((x) => x.t.startsWith('[MODULE_CONTEXT_BEGIN]'));
  const feat = (t) => /"feature":"(\w+)"/.exec(t)?.[1];
  const full = await request(page, msgsOf(await chat(page), '두 번째 행동'));
  const cx = ctxOf(full);
  const fullTok = cx.reduce((n, x) => n + core.tokens(x.t), 0);
  const lastUser = full.map((m) => m.role).lastIndexOf('user');
  res.C2 = { all: cx.map((x) => ({ i: x.i, f: feat(x.t), tok: core.tokens(x.t) })), lastUser, order: full.map((m, i) => `${i}:${m.role}:${asText(m).slice(0, 18).replace(/\n/g, ' ')}`) };
  const caps = [];
  for (const ratio of [0.6, 0.3]) {
    const cap = Math.floor(fullTok * ratio);
    await setVars(page, { $gen_ctx_total: String(cap) });
    const c = ctxOf(await request(page, msgsOf(await chat(page), '두 번째 행동')));
    caps.push({ cap, total: c.reduce((n, x) => n + core.tokens(x.t), 0), each: c.map((x) => [feat(x.t), core.tokens(x.t)]) });
  }
  res.C2.caps = caps;
  console.log('===== C2 참고 기록', JSON.stringify(res.C2).slice(0, 2000));
  res.logs = logs.slice(-20);
  for (const [k, v] of [['turn1', res.turn1], ['turn2', res.turn2]]) {
    console.log('=====', k);
    for (const m of v) console.log(m.i, m.role, m.len, '|', m.start, '\n    ', m.heads.join(' · ').slice(0, 900));
  }
  await page.close();
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); }
finally { writeFileSync(`${OUT}/C1-${Date.now()}.json`, JSON.stringify(res, null, 1)); await browser.close(); }
