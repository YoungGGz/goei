// 플레이 순서 점검 6(커스텀 임무) 고침 점검:
// ① 다시 굴린 요청은 버린 응답이 상황판·소속에 반영한 것을 되감은 변수로 만든다 (rerollRequestVars)
// ② 임무 창 「요청 취소」와 채팅 속 카드 「취소」가 같은 물리기(withdrawUnsent)를 쓴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { worldPackText } from '../scripts/data-pack.mjs';

const dir = '/tmp/audit_1122/fix-reroll-cancel';
await mkdir(dir, { recursive: true });
const src = (p) => JSON.stringify(resolve('src', p));
await writeFile(join(dir, 'entry.ts'), [
  `export { parseCatalog } from ${src('core/world/catalog.ts')};`,
  `export { DEFAULT_SETTINGS, requestMission, parseWorld, serializeWorld } from ${src('core/world/engine.ts')};`,
  `export { processOutput, rerollRequestVars, withdrawUnsent, startWorldVars, worldVars, readWorld } from ${src('core/world/output.ts')};`,
  `export { sceneRecord, setUnsent } from ${src('core/dispatch.ts')};`,
  `export { applyWorldPack } from ${src('core/datapack.ts')};`,
].join('\n'));
await build({ entryPoints: [join(dir, 'entry.ts')], outfile: join(dir, 'entry.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const m = await import(pathToFileURL(join(dir, 'entry.mjs')));
m.applyWorldPack(worldPackText());

const worldBook = {
  괴이: [
    [true, '소라 랜드', '소라 랜드', 'Sora Land', []],
    [true, '명일 아파트', '명일 아파트', 'Myeongil Apartment', []],
  ],
  '미스틱 사이트': [[true, '달빛 서점', '달빛 서점', 'Moon Books', []]],
  랜드마크: [[true, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 52.6, 44.6, []]],
};
const roster = {
  version: 2,
  refill: 2,
  characters: [
    { id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [], affiliation: 'A00', rank: '팀장', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P010', name: '사장', english: 'Sajang', lore: '사장', aliases: [], affiliation: 'C00', rank: '', department: '', roster_for: ['C00'], phone_tabs: [] },
  ],
};
const lore = [
  { comment: 'World catalog', content: JSON.stringify(worldBook) },
  { comment: 'Agent roster', content: JSON.stringify(roster) },
];
const catalog = m.parseCatalog(lore);
const S = { ...m.DEFAULT_SETTINGS, agent_limit: 2, extra_cap: 3, preset_p: 0, random_p: 0, incident_p: 0, mystic_p: 0 };
const never = () => 0.99;

/** 명일 아파트를 커스텀 임무로 걸어 둔 채팅 (첫 요청 전) */
function pendingChat(message) {
  const vars = m.startWorldVars(catalog, S, 'A00', never);
  const w = m.readWorld({ scriptstate: vars });
  assert.equal(m.requestMission(w, catalog, S, 'an', '명일 아파트'), null);
  return { message, scriptstate: { $st_faction: 'A00', $st_pick: 'A00', $ib_affiliation: '관리국', ...m.worldVars(w, catalog, S, 'A00') } };
}

test('다시 굴린 요청: 버린 응답이 반영한 상황판·소속을 되감고 NEW 줄이 다시 간다', () => {
  const user = { role: 'user', data: '작전 개시', chatId: 'u1' };
  const chat0 = pendingChat([user]);
  const firstAn = chat0.scriptstate.$an_report;
  assert.match(firstAn, /NEW \[AN\|[^\n]*명일 아파트\|활성/);
  assert.equal(m.rerollRequestVars(chat0, catalog, S), null, '첫 요청은 되감을 것이 없다');
  const A = '본문 A\n[AN|서울특별시 종로구|명일 아파트|활성|C|없음|가짜 상황 글 1]\n[AC|C00]';
  const afterA = m.processOutput({ ...chat0, message: [user, { role: 'char', data: A, chatId: 'c1' }] }, 1, A, catalog, S, never);
  assert.ok(afterA.scriptstate.$an_report.includes('가짜 상황 글 1'));
  assert.equal(afterA.scriptstate.$st_faction, 'C00');
  // Risu 다시 굴리기: 버린 응답은 채팅에서 빠지고 같은 요청을 다시 만든다
  const rerollChat = { ...afterA, message: [user] };
  const vars = m.rerollRequestVars(rerollChat, catalog, S);
  assert.ok(vars);
  assert.equal(vars.$an_report, firstAn, '첫 요청과 같은 상황판 칸');
  assert.ok(!vars.$an_report.includes('가짜 상황 글 1'));
  assert.equal(vars.$st_faction, 'A00');
  assert.equal(vars.$st_pick, 'A00');
  assert.equal(vars.$ib_affiliation, '관리국');
  assert.equal(m.parseWorld(vars.$goei_world).pending.an, '명일 아파트');
  // 되감은 변수로 요청을 만든 뒤 새 응답이 붙으면 응답 처리는 전처럼 같은 기준에서 반영한다
  const B = '본문 B';
  const afterB = m.processOutput({ ...afterA, message: [user, { role: 'char', data: B, chatId: 'c2' }] }, 1, B, catalog, S, never);
  const fresh = m.processOutput({ ...chat0, message: [user, { role: 'char', data: B, chatId: 'c2' }] }, 1, B, catalog, S, never);
  assert.deepEqual(m.readWorld(afterB), m.readWorld(fresh));
});

test('다시 굴린 요청이 아니면 되감지 않는다 (다음 턴·앞 메시지를 지운 뒤 새 턴·상황판 꺼짐)', () => {
  const user = { role: 'user', data: '작전 개시', chatId: 'u1' };
  const chat0 = pendingChat([user]);
  const A = '본문 A\n[AN|서울특별시 종로구|명일 아파트|활성|C|없음|가짜 상황 글 1]';
  const afterA = m.processOutput({ ...chat0, message: [user, { role: 'char', data: A, chatId: 'c1' }] }, 1, A, catalog, S, never);
  // 다음 턴: 응답 뒤에 새 유저 메시지
  assert.equal(m.rerollRequestVars({ ...afterA, message: [...afterA.message, { role: 'user', data: '다음', chatId: 'u2' }] }, catalog, S), null);
  // 응답과 유저 메시지를 지우고 같은 자리에 새 유저 메시지: 지운 응답이 만든 것은 되돌아간다 (전수점검 2차 15-Q2)
  assert.equal(m.rerollRequestVars({ ...afterA, message: [{ role: 'user', data: '새로', chatId: 'u9' }] }, catalog, S).$goei_world, chat0.scriptstate.$goei_world);
  // 상황판 꺼짐
  assert.equal(m.rerollRequestVars({ ...afterA, message: [user], scriptstate: { ...afterA.scriptstate, $st_anomaly_on: '0' } }, catalog, S), null);
});

test('안 보낸 임무 카드 물리기: 카드를 빼고 걸어 둔 임무를 거둔다 (카드 「취소」·창 「요청 취소」 공용)', () => {
  const card = m.setUnsent(m.sceneRecord({ target: '명일 아파트', party: '나' }, '지시문'), true);
  const prev = { role: 'char', data: '앞 응답' };
  const chat = pendingChat([prev, { role: 'user', data: card }]);
  // 카드의 「취소」 (목표를 따지지 않음)
  const a = m.withdrawUnsent(chat, lore);
  assert.deepEqual(a.message, [prev]);
  assert.equal(m.parseWorld(a.scriptstate.$goei_world).pending.an, undefined);
  assert.ok(!a.scriptstate.$an_report.includes('명일 아파트'));
  // 창의 「요청 취소」: 그 목표의 카드일 때만
  const b = m.withdrawUnsent(chat, lore, '명일 아파트');
  assert.deepEqual(b, a, '카드의 취소와 같은 결과');
  assert.equal(m.withdrawUnsent(chat, lore, '소라 랜드'), null, '다른 목표의 카드는 물리지 않는다');
  // 보냈지만 답 없이 끝난 카드(안 보냄 표시 없음): 창 「요청 취소」는 물리고, 채팅 속 카드 「취소」(안 보낸 것만)는 아니다 (전수점검 2차 06-4)
  const sent = pendingChat([prev, { role: 'user', data: m.sceneRecord({ target: '명일 아파트', party: '나' }, '지시문') }]);
  assert.deepEqual(m.withdrawUnsent(sent, lore, '명일 아파트').message, [prev]);
  assert.equal(m.withdrawUnsent(sent, lore), null);
  // 직접 입력(카드 없음)은 카드 취소로만 빠지고 상황판은 그대로, 창 취소로는 안 빠진다
  const direct = pendingChat([{ role: 'user', data: m.setUnsent('직접 입력', true) }]);
  const d = m.withdrawUnsent(direct, lore);
  assert.deepEqual(d.message, []);
  assert.equal(d.scriptstate.$goei_world, direct.scriptstate.$goei_world);
  assert.equal(m.withdrawUnsent(direct, lore, '명일 아파트'), null);
});

test('채팅 중 커스텀 임무 턴·보통 턴의 다시 굴리기, 상황판이 안 바뀐 턴, 응답을 지우고 새로 보낸 턴', () => {
  const S0 = { ...S };
  const u0 = { role: 'user', data: '시작', chatId: 'u0' };
  let chat = { message: [u0], scriptstate: { $st_faction: 'A00', $st_pick: 'A00', $ib_affiliation: '관리국', ...m.startWorldVars(catalog, S0, 'A00', never) } };
  const start = chat.scriptstate;
  const r1 = '본문 1';
  chat = m.processOutput({ ...chat, message: [u0, { role: 'char', data: r1, chatId: 'c1' }] }, 1, r1, catalog, S0, never);
  // 태그 없는 턴을 다시 굴림: 상황판 칸은 지금과 같고, 상태는 그 응답 전(첫 요청 때) 그대로
  const same = m.rerollRequestVars({ ...chat, message: [u0] }, catalog, S0);
  assert.equal(same.$an_report, chat.scriptstate.$an_report);
  assert.equal(same.$goei_world, start.$goei_world);
  // 채팅 중 커스텀 임무: 창에서 걸고 카드를 보냄 (sendMission 과 같게 지금 상태에만)
  const w = m.readWorld(chat);
  assert.equal(m.requestMission(w, catalog, S0, 'an', '명일 아파트'), null);
  chat = { ...chat, scriptstate: { ...chat.scriptstate, ...m.worldVars(w, catalog, S0, 'A00') } };
  const pendingAn = chat.scriptstate.$an_report;
  const card = { role: 'user', data: m.sceneRecord({ target: '명일 아파트', party: '나' }, '지시문'), chatId: 'u2' };
  const c1 = chat.message[1];
  const r3 = '본문 3\n[AN|경기도 용인시|명일 아파트|활성|B|없음|버린 상황 글]';
  const after3 = m.processOutput({ ...chat, message: [u0, c1, card, { role: 'char', data: r3, chatId: 'c3' }] }, 3, r3, catalog, S0, never);
  assert.ok(after3.scriptstate.$an_report.includes('버린 상황 글'));
  const v3 = m.rerollRequestVars({ ...after3, message: [u0, c1, card] }, catalog, S0);
  assert.equal(v3.$an_report, pendingAn, '카드 턴을 다시 굴리면 NEW 줄이 다시 간다');
  assert.match(v3.$an_report, /NEW \[AN\|[^\n]*명일 아파트/);
  assert.ok(!v3.$an_report.includes('버린 상황 글'));
  // 보통 턴(카드 없음)에서 상황판이 바뀐 응답을 다시 굴림
  const u4 = { role: 'user', data: '살핀다', chatId: 'u4' };
  const c3 = after3.message[3];
  const r5 = '본문 5\n[AN|경기도 용인시|명일 아파트|활성|A|없음|두 번째 버린 글]';
  const after5 = m.processOutput({ ...after3, message: [u0, c1, card, c3, u4, { role: 'char', data: r5, chatId: 'c5' }] }, 5, r5, catalog, S0, never);
  assert.ok(after5.scriptstate.$an_report.includes('두 번째 버린 글'));
  const v5 = m.rerollRequestVars({ ...after5, message: [u0, c1, card, c3, u4] }, catalog, S0);
  assert.equal(v5.$an_report, after3.scriptstate.$an_report, '앞 턴이 반영한 상태로 되감는다');
  // 응답을 지우고 새 메시지를 보냄: 지운 응답이 만든 것은 되돌아간다 (다시 굴리기와 같은 기준, 전수점검 2차 15-Q2)
  assert.equal(m.rerollRequestVars({ ...after5, message: [u0, c1, card, c3, u4, { role: 'user', data: '다른 말', chatId: 'u6' }] }, catalog, S0).$an_report, after3.scriptstate.$an_report);
  assert.equal(m.rerollRequestVars({ ...after5, message: [u0, c1, card, c3, { role: 'user', data: '바꾼 말', chatId: 'u7' }] }, catalog, S0).$an_report, after3.scriptstate.$an_report);
});
