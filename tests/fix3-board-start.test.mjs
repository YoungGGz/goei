// 전수점검 2차 재확인 고침 (상황판·시작·임무·일지): 06-1~4, 15-1~3, 15-Q2, 18-B1
// - 답을 기다리는 동안에는 시작·임무 카드를 채팅에 놓거나 바꾸지 않는다 (요청 도중 채팅 저장 금지)
// - 창 「요청 취소」는 답 없이 끝난 카드도 물린다
// - 응답을 다시 굴리거나 지우면 그 응답이 만든 것(상황판·요원·일지·고정 보고서)이 같이 되돌아간다. 손으로 끝낸 상황은 그 응답이 띄운 것이어도 끝난 채 남는다
// - 손으로 끝낸 괴이·특수는 모델이 다시 적어도 되살아나지 않는다
// - 요청의 상황판·요원 브리핑은 지금 카드(명부)로 다시 만든다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { worldPackText } from '../scripts/data-pack.mjs';

const bundle = async (contents) => {
  const out = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};

const m = await bundle(`
  export { parseCatalog } from './src/core/world/catalog';
  export { DEFAULT_SETTINGS, requestMission, parseWorld, endEvent, endUpcoming, activeEvents, endedShown } from './src/core/world/engine';
  export { processOutput, rerollRequestVars, requestWorldVars, manualWorldVars, copyPending, withdrawUnsent, startWorldVars, worldVars, readWorld } from './src/core/world/output';
  export { readJournal, readReports, liveJournal, liveReports, pinReport, recordVars, buildClosures, journalSettings } from './src/core/journal';
  export { sceneRecord, setUnsent } from './src/core/dispatch';
  export { unsentOpening, chatPhase, applyStart, planStart } from './src/core/start';
  export { applyWorldPack } from './src/core/datapack';
`);
m.applyWorldPack(worldPackText());

const worldBook = {
  괴이: [
    [true, '소라 랜드', '소라 랜드', 'Sora Land', []],
    [true, '명일 아파트', '명일 아파트', 'Myeongil Apartment', []],
    [true, '어두운 정원', '어두운 정원', 'Dark Garden', []],
  ],
  '미스틱 사이트': [[true, '달빛 서점', '달빛 서점', 'Moon Books', []]],
  랜드마크: [[true, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 52.6, 44.6, []]],
};
const agent = (id, name, roster_for = ['A00']) => ({ id, name, english: name, lore: name, aliases: [], affiliation: 'A00', rank: '요원', department: '종합대응팀', roster_for, phone_tabs: [] });
const loreOf = (agents) => [
  { comment: 'World catalog', content: JSON.stringify(worldBook) },
  { comment: 'Agent roster', content: JSON.stringify({ version: 2, refill: 2, characters: agents }) },
];
const lore = loreOf([agent('P001', '쟈알디'), agent('P002', '스팡달')]);
const catalog = m.parseCatalog(lore);
const S = { ...m.DEFAULT_SETTINGS, agent_limit: 2, extra_cap: 3, preset_p: 0, random_p: 0, incident_p: 0, mystic_p: 0 };
const never = () => 0.99;
const ST = (time) => `[▣|2025.01.01|${time}|☀️|4°C|서울 종로구 거리|없음|없음|없음|관리국/신입|1000]`;

function startChat(message) {
  return { message, scriptstate: { $st_faction: 'A00', $st_pick: 'A00', $ib_affiliation: '관리국', ...m.startWorldVars(catalog, S, 'A00', never) } };
}
/** 응답 하나를 붙이고 반영한다 */
function reply(chat, data, chatId) {
  const message = [...chat.message, { role: 'char', data, chatId }];
  return m.processOutput({ ...chat, message }, message.length - 1, data, catalog, S, never) ?? { ...chat, message };
}
/** ui/field.ts saveWorld 와 같은 길로 손 종료 */
function closeByHand(chat, key) {
  const w = m.readWorld(chat);
  assert.ok(m.endEvent(w, key), '지금 상태에서는 끝난다');
  const next = { ...chat, scriptstate: { ...chat.scriptstate, ...m.manualWorldVars(chat, w, catalog, S, 'A00', (p) => void (m.endEvent(p, key) || m.endUpcoming(p, key))) } };
  const index = chat.message.length - 1;
  const built = m.buildClosures({ chat: next, index, world: w, closed: w.closed, catalog, faction: 'A00', settings: m.journalSettings(chat.scriptstate) });
  next.scriptstate = { ...next.scriptstate, ...m.recordVars(built.journal, built.reports) };
  return next;
}
const msNames = (chat) => m.readWorld(chat).ms.map((e) => `${e.name}|${e.state}`);
const anNames = (chat) => m.readWorld(chat).an.map((e) => `${e.name || e.presetName}|${e.state}`);

// ── 06-1·06-2: 답을 기다리는 동안 첫 카드는 「보낸 것」 ──

test('06-1·2: 첫 커스텀 임무 카드는 답을 기다리는 동안 다시 고를 수 없고(시작됨), 다시 출발해도 지워지지 않는다. 기다림이 끝나면(실패) 다시 고를 수 있다', () => {
  const card = { role: 'user', data: m.sceneRecord({ target: '소라 랜드', party: '나' }, '지시문'), chatId: 'u1' };
  const chat = { message: [card], scriptstate: { $st_faction: 'E00' } };
  assert.equal(m.unsentOpening(chat), true, '기다림이 끝났으면(실패) 다시 고를 수 있다');
  assert.equal(m.chatPhase(chat), 'staged');
  assert.equal(m.unsentOpening(chat, true), false);
  assert.equal(m.chatPhase(chat, true), 'started', '기다리는 동안에는 시작된 채팅');
  const plan = { fmIndex: -1, scriptstate: { $st_faction: 'E00' }, seedMissing: [], kind: 'direct' };
  assert.deepEqual(m.applyStart(chat, plan, '', true).message, [card], '기다리는 동안 다시 출발해도 보낸 카드는 남는다');
  assert.deepEqual(m.applyStart(chat, plan).message, [], '실패한 뒤 다시 고르면 바꾼다');
  // 플러그인이 넣은 첫 장면(아직 안 보냄)은 기다림과 상관없이 다시 고를 수 있다
  const scene = { message: [{ role: 'char', data: '%%GOEI_SCENE%%\n첫 장면', chatId: 's' }], scriptstate: { $st_faction: 'A00' } };
  assert.equal(m.unsentOpening(scene, true), m.unsentOpening(scene));
});

// ── 06-1·06-3: 임무 창의 작전 개시·임무 요청·출발은 기다리는 동안 채팅을 건드리지 않는다 ──

test('06-1·3: 답을 기다리는 동안 임무 요청·출발을 누르면 채팅을 저장하지 않고 기다리라는 안내만 띄운다', async () => {
  const ui = await bundle(`export { sendMission, depart, field, WAIT_SEND_NOTE } from './src/ui/field'; export { setWaiting } from './src/host/waiting';`);
  const calls = [];
  globalThis.risuai = new Proxy({}, { get: (_, k) => async () => (calls.push(String(k)), null) });
  let notice = '';
  const env = { setBusy() {}, setNotice: (n) => (notice = n), render() {}, close: async () => {}, refresh: async () => {} };
  const ctx = { charIndex: 0, chatIndex: 0, char: { name: 'x', globalLore: lore }, chat: startChat([{ role: 'user', data: '복도로', chatId: 'u1' }]) };
  ui.field.mpick = 'an';
  ui.field.mname = '소라 랜드';
  ui.field.team = [];
  ui.field.support = 0;
  ui.setWaiting(true);
  try {
    await ui.sendMission(ctx, env, false);
    assert.equal(notice, ui.WAIT_SEND_NOTE);
    notice = '';
    ui.field.target = { type: 'region', loc: '02-종로구' };
    await ui.depart(ctx, env);
    assert.equal(notice, ui.WAIT_SEND_NOTE);
    assert.ok(!calls.includes('setChat') && !calls.includes('setChatToIndex'), calls.join(','));
    assert.ok(!calls.includes('sendChat'), '보내지도 않는다');
  } finally {
    ui.setWaiting(false);
    delete globalThis.risuai;
  }
});

// ── 06-4: 답 없이 끝난 카드의 「요청 취소」 ──

test('06-4: 창 「요청 취소」는 보냈지만 답 없이 끝난 카드도 물리고 대기도 거둔다. 답이 붙은 카드·다른 목표·카드 「취소」(안 보낸 것만)는 그대로', () => {
  const prev = { role: 'char', data: '앞 응답', chatId: 'c0' };
  const card = { role: 'user', data: m.sceneRecord({ target: '소라 랜드', party: '나' }, '지시문'), chatId: 'u1' };
  const base = startChat([prev, card]);
  const w = m.readWorld(base);
  assert.equal(m.requestMission(w, catalog, S, 'an', '소라 랜드'), null);
  const chat = { ...base, scriptstate: { ...base.scriptstate, ...m.worldVars(w, catalog, S, 'A00') } };
  const out = m.withdrawUnsent(chat, lore, '소라 랜드');
  assert.ok(out, '답 없이 끝난 카드를 물린다');
  assert.deepEqual(out.message, [prev]);
  assert.equal(m.readWorld(out).pending.an, undefined);
  assert.equal(m.withdrawUnsent(chat, lore, '명일 아파트'), null, '다른 목표의 카드는 그대로');
  assert.equal(m.withdrawUnsent(chat, lore), null, '채팅 속 카드 「취소」는 안 보낸 카드만');
  assert.equal(m.withdrawUnsent({ ...chat, message: [prev, card, { role: 'char', data: '답', chatId: 'c2' }] }, lore, '소라 랜드'), null, '답이 붙은 카드는 그대로');
});

// ── 15-1: 응답이 띄운 것을 손으로 끝낸 뒤 그 응답을 다시 굴림 ──

test('15-1: 응답이 처음 띄운 특수·괴이를 손으로 끝낸 뒤 그 응답을 다시 굴리면 끝난 채 남고(새 답이 다시 적어도), 손 종료 일지 줄도 남아 상황판과 맞는다', () => {
  const u1 = { role: 'user', data: '나간다', chatId: 'u1' };
  const first = `본문\n[MS|서울특별시 종로구|달빛 서점|출현|없음|문이 열렸다]\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:00 AM')}`;
  let chat = reply(startChat([u1]), first, 'c1');
  assert.deepEqual(msNames(chat), ['달빛 서점|출현']);
  assert.ok(anNames(chat).includes('어두운 정원|활성'));
  for (const name of ['달빛 서점', '어두운 정원']) chat = closeByHand(chat, m.activeEvents(m.readWorld(chat)).find((e) => e.name === name).key);
  assert.equal(m.readJournal(chat.scriptstate).rows.filter((r) => r.cause === 'manual').length, 2);
  const locOf = m.readWorld(reply(startChat([u1]), first, 'cx')).ms[0].loc;
  // 자동 발생 예정이던 특수를 응답이 띄운 경우 (기준 상태에는 발생 시각이 빈 발생 예정으로 있다): 손으로 끝내면 기준 상태의 예정도 거둔다
  {
    const st0 = startChat([u1]);
    const w0 = m.readWorld(st0);
    w0.ms.push({ loc: locOf, name: '달빛 서점', state: '발생대기', visitors: '', origin: 'auto', since: null, born: null });
    let c = reply({ ...st0, scriptstate: { ...st0.scriptstate, ...m.worldVars(w0, catalog, S, 'A00') } }, `본문\n[MS|서울특별시 종로구|달빛 서점|출현|없음|문]\n${ST('10:00 AM')}`, 'c1');
    assert.deepEqual(msNames(c), ['달빛 서점|출현']);
    c = closeByHand(c, m.activeEvents(m.readWorld(c))[0].key);
    const rq = m.rerollRequestVars({ ...c, message: [u1] }, catalog, S);
    assert.ok(!rq.$ms_report.includes('달빛 서점'), rq.$ms_report);
  }
  // 다시 굴린 요청: 끝낸 것이 다시 발생 예정(NEW)으로 가지 않는다
  const req = m.rerollRequestVars({ ...chat, message: [u1] }, catalog, S);
  assert.ok(req && !req.$ms_report.includes('달빛 서점') && !req.$an_report.includes('어두운 정원'), `${req?.$ms_report}\n${req?.$an_report}`);
  // 다시 굴림: 같은 꼴의 새 답 (새 chatId)
  const again = first.replace('본문', '본문 다시');
  const re = m.processOutput({ ...chat, message: [u1, { role: 'char', data: again, chatId: 'c1b' }] }, 1, again, catalog, S, never);
  assert.deepEqual(msNames(re), [], '손으로 끝낸 특수는 다시 굴려도 끝난 채');
  assert.ok(!anNames(re).some((n) => n.startsWith('어두운 정원')), anNames(re).join());
  assert.equal(m.readJournal(re.scriptstate).rows.filter((r) => r.cause === 'manual').length, 2, '손 종료 일지 줄은 남는다 (상황판과 같은 말)');
  // 이미 있던 것을 손으로 끝냈으면 다시 굴려도 끝난 채 (기존 동작)
  let c0 = reply(startChat([u1]), `본문\n[MS|서울특별시 종로구|달빛 서점|출현|없음|문]\n${ST('10:00 AM')}`, 'c1');
  const u2 = { role: 'user', data: '다음', chatId: 'u2' };
  let c2 = reply({ ...c0, message: [...c0.message, u2] }, `본문2\n${ST('10:30 AM')}`, 'c2');
  const key2 = m.activeEvents(m.readWorld(c2)).find((e) => e.name === '달빛 서점').key;
  c2 = closeByHand(c2, key2);
  const r2 = `본문2 다시\n${ST('10:30 AM')}`;
  const re2 = m.processOutput({ ...c2, message: [...c2.message.slice(0, -1), { role: 'char', data: r2, chatId: 'c2b' }] }, c2.message.length - 1, r2, catalog, S, never);
  assert.deepEqual(msNames(re2), [], '앞 응답이 띄운 것을 손으로 끝냈으면 끝난 채');
  assert.equal(m.readJournal(re2.scriptstate).rows.filter((r) => r.cause === 'manual').length, 1);
});

// ── 15-2: 손으로 끝낸 괴이·특수를 모델이 다시 적음 ──

test('15-2: 손으로 끝낸 괴이·특수는 다음 응답이 다시 적어도 진행 중으로 돌아오지 않고 흐린 종료 카드가 남는다', () => {
  const u1 = { role: 'user', data: '나간다', chatId: 'u1' };
  let chat = reply(startChat([u1]), `본문\n[MS|서울특별시 종로구|달빛 서점|출현|없음|문]\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:00 AM')}`, 'c1');
  assert.deepEqual(msNames(chat), ['달빛 서점|출현']);
  assert.ok(anNames(chat).includes('어두운 정원|활성'), anNames(chat).join());
  for (const name of ['달빛 서점', '어두운 정원']) chat = closeByHand(chat, m.activeEvents(m.readWorld(chat)).find((e) => e.name === name).key);
  const u2 = { role: 'user', data: '다음', chatId: 'u2' };
  chat = reply({ ...chat, message: [...chat.message, u2] }, `본문2\n[MS|서울특별시 종로구|달빛 서점|출현|없음|또 문]\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|또 정원]\n${ST('10:20 AM')}`, 'c2');
  assert.deepEqual(msNames(chat), []);
  assert.ok(!anNames(chat).some((n) => n.startsWith('어두운 정원')), anNames(chat).join());
  assert.deepEqual(m.endedShown(m.readWorld(chat)).map((e) => e.name).sort(), ['달빛 서점', '어두운 정원']);
});

// ── 15-Q2: 응답을 지우고 다른 말을 보냄 ──

test('15-Q2: 괴이를 끝내고 요원을 사망으로 적은 응답을 지우고 새로 보내면 상황판·요원·일지가 그 응답 전으로 돌아간다 (요청과 반영 둘 다)', () => {
  const u1 = { role: 'user', data: '간다', chatId: 'u1' };
  let chat = reply(startChat([u1]), `본문1\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:00 AM')}`, 'c1');
  const before = chat;
  const u2 = { role: 'user', data: '싸운다', chatId: 'u2' };
  chat = reply({ ...chat, message: [...chat.message, u2] }, `본문2\n[AN|부산광역시 연제구|어두운 정원|격리|C|없음|끝]\n[AG|P001|사망|순직]\n${ST('10:30 AM')}`, 'c2');
  assert.ok(!anNames(chat).some((n) => n.startsWith('어두운 정원')));
  assert.equal(m.readJournal(chat.scriptstate).rows.length, 1);
  // 응답2 를 지우고 다른 말
  const u3 = { role: 'user', data: '아니, 사무실에 남는다.', chatId: 'u3' };
  const del = { ...chat, message: [u1, before.message[1], u2, u3] };
  const vars = m.rerollRequestVars(del, catalog, S);
  assert.ok(vars, '요청은 지운 응답 전 상태로');
  assert.equal(vars.$goei_world, before.scriptstate.$goei_world);
  assert.equal(vars.$ag_report, before.scriptstate.$ag_report);
  const r3 = `본문3\n${ST('10:40 AM')}`;
  const after = m.processOutput({ ...del, message: [...del.message, { role: 'char', data: r3, chatId: 'c3' }] }, 4, r3, catalog, S, never);
  assert.ok(anNames(after).includes('어두운 정원|활성'), anNames(after).join());
  assert.notDeepEqual(m.readWorld(chat).agents.P001, m.readWorld(before).agents.P001, '지운 응답은 요원을 바꿨다');
  assert.deepEqual(m.readWorld(after).agents.P001, m.readWorld(before).agents.P001, '요원도 그 응답 전으로');
  assert.equal(m.liveJournal(after).rows.length, 0, '지운 응답의 종료 줄도 없다');
  // 그다음 턴은 평소대로 (방금 반영한 응답은 살아 있다)
  const u4 = { role: 'user', data: '다음', chatId: 'u4' };
  assert.equal(m.rerollRequestVars({ ...after, message: [...after.message, u4] }, catalog, S), null);
  // 앞 메시지만 지우고 그 응답은 남으면 되돌리지 않는다
  assert.equal(m.rerollRequestVars({ ...chat, message: [chat.message[1], u2, chat.message[3], u4] }, catalog, S), null);
});

// ── 15-3: 명부를 고친 직후의 요청 ──

test('15-3: 요청의 요원 브리핑은 지금 카드 명부로 만든다 (명부에서 뺀 요원이 다음 요청에 안 간다)', () => {
  const chat = reply(startChat([{ role: 'user', data: '간다', chatId: 'u1' }]), `본문\n${ST('10:00 AM')}`, 'c1');
  assert.match(chat.scriptstate.$ag_report, /P002/);
  const edited = m.parseCatalog(loreOf([agent('P001', '쟈알디'), agent('P002', '스팡달', [])]));
  const next = { ...chat, message: [...chat.message, { role: 'user', data: '다음', chatId: 'u2' }] };
  const vars = m.requestWorldVars(next, edited, S);
  assert.ok(vars);
  assert.doesNotMatch(vars.$ag_report, /P002/);
  assert.match(vars.$ag_report, /P001/);
  assert.equal(m.requestWorldVars({ ...next, scriptstate: { ...next.scriptstate, $st_anomaly_on: '0' } }, edited, S), null);
});

// ── 18-B1: 고정한 보고서와 다시 굴리기 ──

test('18-B1: 보고서를 고정해도 그 응답을 다시 굴리면 보고서·일지 줄이 되돌아가고, 다시 끝나도 한 줄만 남는다', () => {
  const u1 = { role: 'user', data: '간다', chatId: 'u1' };
  let chat = reply(startChat([u1]), `본문1\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:00 AM')}`, 'c1');
  const u2 = { role: 'user', data: '격리', chatId: 'u2' };
  chat = reply({ ...chat, message: [...chat.message, u2] }, `본문2\n[AN|부산광역시 연제구|어두운 정원|격리|C|없음|끝]\n${ST('10:30 AM')}`, 'c2');
  const rep = m.readReports(chat.scriptstate).items;
  assert.equal(rep.length, 1);
  chat = { ...chat, scriptstate: { ...chat.scriptstate, ...m.recordVars(m.readJournal(chat.scriptstate), m.pinReport(m.readReports(chat.scriptstate), rep[0].id, true)) } };
  // 다시 굴림: 안 끝나는 새 답
  const r2 = `본문2 다시\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|버틴다]\n${ST('10:30 AM')}`;
  chat = m.processOutput({ ...chat, message: [...chat.message.slice(0, 3), { role: 'char', data: r2, chatId: 'c2b' }] }, 3, r2, catalog, S, never);
  assert.ok(anNames(chat).includes('어두운 정원|활성'));
  assert.equal(m.liveJournal(chat).rows.length, 0, '일지도 진행 중과 맞게');
  assert.equal(m.liveReports(chat).items.length, 0, '고정한 보고서도 버린 응답의 것이면 되돌아간다');
  // 다음 턴에 다시 격리 → 한 줄
  const u3 = { role: 'user', data: '다시 격리', chatId: 'u3' };
  chat = reply({ ...chat, message: [...chat.message, u3] }, `본문3\n[AN|부산광역시 연제구|어두운 정원|격리|C|없음|끝]\n${ST('11:00 AM')}`, 'c3');
  assert.equal(m.liveJournal(chat).rows.length, 1);
  assert.equal(m.liveReports(chat).items.length, 1);
});

// ── 검토에서 찾은 것: 지운 응답 되돌리기의 빈틈 ──

test('응답을 지운 뒤 임무 창에서 건 요청은 되돌아간 상태에도 남는다 (요청의 NEW 줄·대기)', () => {
  const u1 = { role: 'user', data: '간다', chatId: 'u1' };
  let chat = reply(startChat([u1]), `본문1\n${ST('10:00 AM')}`, 'c1');
  const u2 = { role: 'user', data: '다음', chatId: 'u2' };
  chat = reply({ ...chat, message: [...chat.message, u2] }, `본문2\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:30 AM')}`, 'c2');
  // 응답2 를 지우고 임무 창에서 소라 랜드를 요청 (ui/field.ts sendMission 과 같은 길: 지금 상태에 대기를 걸고 카드를 붙임)
  const gone = { ...chat, message: chat.message.slice(0, 3) };
  const w = m.readWorld(gone);
  assert.ok(!w.an.some((e) => e.name === '어두운 정원'), '지운 직후 창이 읽는 상황판에 지운 응답의 괴이가 없다 (R18)');
  assert.equal(m.requestMission(w, catalog, S, 'an', '소라 랜드'), null);
  const card = { role: 'user', data: m.sceneRecord({ target: '소라 랜드', party: '나' }, '지시문'), chatId: 'u3' };
  const del = { ...gone, message: [...gone.message, card], scriptstate: { ...gone.scriptstate, ...m.manualWorldVars(gone, w, catalog, S, 'A00', m.copyPending(w)) } };
  const vars = m.rerollRequestVars(del, catalog, S);
  assert.ok(vars, '지운 응답 전 상태로');
  assert.ok(!m.parseWorld(vars.$goei_world).an.some((e) => e.name === '어두운 정원'), '지운 응답이 띄운 괴이는 없다');
  assert.equal(m.parseWorld(vars.$goei_world).pending.an, '소라 랜드', '방금 건 요청은 남는다');
  assert.match(vars.$an_report, /소라 랜드/);
  const r3 = `본문3\n[AN|서울특별시 종로구|소라 랜드|활성|C|없음|입구]\n${ST('10:40 AM')}`;
  const after = m.processOutput({ ...del, message: [...del.message, { role: 'char', data: r3, chatId: 'c3' }] }, 4, r3, catalog, S, never);
  const sora = m.readWorld(after).an.find((e) => e.presetName === '소라 랜드');
  assert.equal(sora?.origin, 'manual', '요청한 임무로 등록된다');
  assert.equal(m.readWorld(after).pending.an, undefined);
});

test('메시지를 다 지우고 같은 채팅에서 다시 시작하면 옛 기준 상태가 남지 않는다 (첫 요청이 옛 상황판으로 가지 않음)', () => {
  const u1 = { role: 'user', data: '간다', chatId: 'u1' };
  const old = reply(startChat([u1]), `본문1\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:00 AM')}`, 'c1');
  assert.ok(old.scriptstate.$goei_turns);
  // 다시 시작: applyStart 가 시작 변수를 덮어쓴다 (planStart 의 scriptstate 에 빈 기준 상태가 들어 있다)
  const fresh = m.startWorldVars(catalog, S, 'A00', never);
  const plan = { fmIndex: -1, scriptstate: { $goei_turns: '', ...fresh }, seedMissing: [], kind: 'direct' };
  const again = m.applyStart({ ...old, message: [] }, plan);
  const first = { ...again, message: [{ role: 'user', data: '새 시작', chatId: 'n1' }] };
  assert.equal(m.rerollRequestVars(first, catalog, S), null, '옛 응답이 없다고 옛 상태로 되감지 않는다');
  assert.equal(m.requestWorldVars(first, catalog, S).$goei_world, fresh.$goei_world);
});

test('chatId 없는 옛 메시지(번호 열쇠)는 「지워졌다」고 보지 않는다 (앞 메시지를 지워 번호가 밀려도 되감지 않음)', () => {
  const u1 = { role: 'user', data: '간다' };
  const old = [{ role: 'user', data: '처음' }, { role: 'char', data: '앞 응답' }, { role: 'user', data: '둘째' }, { role: 'char', data: '둘째 응답' }];
  const chat = reply(startChat([...old, u1]), `본문\n[AN|부산광역시 연제구|어두운 정원|활성|C|없음|정원]\n${ST('10:00 AM')}`, undefined);
  // 앞 메시지 셋을 지우고 다음 말을 보냄: 마지막 응답은 그대로 있다 (번호 열쇠만 밀렸다)
  const next = { ...chat, message: [...chat.message.slice(3), { role: 'user', data: '다음' }] };
  assert.equal(m.rerollRequestVars(next, catalog, S), null);
});
