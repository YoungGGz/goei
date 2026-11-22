// 11-22 플레이 순서 점검 「5. 인물 기록」 고침 시험 (인수인계/플레이순서_점검/5_인물기록/찾은문제.md 문제 1·3b·4·5·6)
// 이름·별명은 자료(src/data/people/aliases.json)에서 읽는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initTestData } from './data-init.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-1122-'));
const outfile = join(dir, 'bundle.mjs');
const ENTRY = `
export * as U from './src/core/people/updater';
export * as S from './src/core/people/store';
export * as T from './src/core/people/types';
export * as St from './src/core/people/settings';
export * as Sel from './src/core/people/select';
export * as B from './src/core/people/base';
export * as C from './src/core/people/consolidate';
export * as D from './src/core/people/director';
export * as H from './src/host/people';
export * as Pack from './src/core/datapack';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { U, S, T, St, Sel, B, C, D, H, Pack } = await import(pathToFileURL(outfile));
initTestData(Pack);

const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {}, ...extra });
const englishOf = (name) => B.RELATIONS.people[name]?.english?.[0];

// ── 문제 1: 흔한 낱말·별명만으로는 처음 등록하지 않는다 ──

test('자료: corroborate 는 그 사람의 이름이나 별명이고, 사장·동물 별명·가면 이름·연지가 들어 있다', () => {
  const marked = Object.entries(B.ALIASES.names).filter(([, v]) => v.corroborate?.length);
  assert.ok(marked.length > 0);
  for (const [name, v] of marked) for (const k of v.corroborate) assert.ok(k === name || v.aliases.includes(k), `${name}: ${k}`);
  for (const [name, k] of [['사장', '사장'], ['사장', '사장님'], ['백사헌', '독사'], ['고영은', '산양'], ['강이학', '조랑말'], ['박민성', '오소리'], ['백석주', '청둥오리'], ['은하제', '송골매'], ['제이', '늑대 가면'], ['고연지', '연지']]) assert.ok(B.corroborateKeys(name).includes(k), `${name}: ${k}`);
  assert.deepEqual(B.corroborateKeys('에일린'), []);
});

test('처음 등장: 「사장님」「독사」만 나온 관리국 글로는 사장·백사헌 기록이 생기지 않는다', () => {
  const c = chat(['user', '사무실로 갔다', 'u1'], ['char', '관리국 사무실. 직원이 "사장님이 부르신대"라고 말했다. 선반에는 독사 표본과 산양 뿔이 있었다.', 'c1']);
  const store = T.emptyStore();
  assert.deepEqual(H.seedAppearing(store, c, [1], () => null), []);
  assert.deepEqual(Object.keys(store.people), []);
  // 확인 뒤 등록이어도 대기에 올리지 않는다
  const held = [];
  assert.deepEqual(H.seedAppearing(store, c, [1], () => null, { confirm: true, held }), []);
  assert.deepEqual(held, []);
});

test('처음 등장: 같은 글에 소속이나 초상 태그가 같이 있으면 별명으로도 기록한다', () => {
  // 소속: 사장은 가짜 관리국, 백사헌은 백일몽 (relations-base)
  assert.equal(B.RELATIONS.people.사장.faction, 'B00');
  assert.equal(B.RELATIONS.people.백사헌.faction, 'C00');
  let store = T.emptyStore();
  const c1 = chat(['user', '가짜 관리국 본사에 들어갔다', 'u1'], ['char', '비서가 "사장님이 기다리십니다"라고 했다.', 'c1']);
  assert.deepEqual(H.seedAppearing(store, c1, [1], () => null), ['사장']);
  assert.equal(store.people.사장.origin, 'c1');
  store = T.emptyStore();
  const c2 = chat(['user', '복도를 걸었다', 'u1'], ['char', '백일몽 사원 하나가 웃었다. 다들 그를 독사라고 불렀다.', 'c1']);
  assert.deepEqual(H.seedAppearing(store, c2, [1], () => null), ['백사헌']);
  // 초상 태그: 태그의 이름 부분이 그 사람의 영문 표기
  store = T.emptyStore();
  const en = englishOf('고영은');
  assert.ok(en);
  const c3 = chat(['user', '돌아봤다', 'u1'], ['char', `산양이 손을 흔들었다.\n\n<img=${en}_smile>`, 'c1']);
  assert.deepEqual(H.seedAppearing(store, c3, [1], () => null), ['고영은']);
  // 다른 사람의 소속으로는 안 된다 (백일몽 글에 사장님)
  store = T.emptyStore();
  const c4 = chat(['user', '백일몽 지부', 'u1'], ['char', '"사장님은 안 계세요."', 'c1']);
  assert.deepEqual(H.seedAppearing(store, c4, [1], () => null), []);
  // 이름은 예전처럼 그것만으로 기록한다
  store = T.emptyStore();
  const c5 = chat(['user', '복도', 'u1'], ['char', '백사헌이 지나갔다.', 'c1']);
  assert.deepEqual(H.seedAppearing(store, c5, [1], () => null), ['백사헌']);
});

test('기록된 사람은 별명만으로도 장면 인물로 잡힌다 (예전 그대로)', () => {
  const store = T.emptyStore();
  const base = B.seedBaseFor('백사헌', 'A00', undefined);
  store.people.백사헌 = person('백사헌', { faction: 'C00', aliases: base.aliases });
  const c = chat(['user', '복도', 'u1'], ['char', '독사가 웃었다.', 'c1']);
  const match = Sel.nameMatcher(Sel.namesWith(store, B.allNames()));
  assert.deepEqual(Sel.scenePeople(c, store, match), ['백사헌']);
});

// ── 문제 3b: 글에 없는 이름으로 새 기록을 만들지 않는다 ──

const upSetup = (text, over = {}) => {
  const c = chat(['user', '시장에 갔다', 'u1'], ['char', text, 'c1']);
  const store = T.emptyStore();
  const s = settings({ twoTurn: false, ...over });
  const input = U.buildUpdate(c, store, [1], { settings: s, system: '', values: {}, names: B.allNames(over.roster ?? []), roster: over.roster });
  const m = [...input.tags].find(([, i]) => i === 1)[0];
  return { c, store, input, m, ctx: { settings: s, sheetOf: () => null } };
};

test('갱신기 새 인물: 인용은 원문에 있어도 이름이 글에 없으면 버리고, 이름이 있으면 받는다', () => {
  let x = upSetup('노점 앞에서 도준이라는 청년이 손을 흔들었다.');
  let rep = U.applyUpdate(x.store, x.c, x.input, { new_people: [{ name: '김철수', provisional: false, m: x.m, quote: '노점 앞에서 도준이라는 청년이' }] }, x.ctx);
  assert.deepEqual(rep.applied.newPeople, []);
  assert.deepEqual(rep.dropped.map((d) => [d.who, d.reason]), [['김철수', '이름이 원문에 없음']]);
  assert.ok(!x.store.people.김철수);
  x = upSetup('노점 앞에서 도준이라는 청년이 손을 흔들었다.');
  rep = U.applyUpdate(x.store, x.c, x.input, { new_people: [{ name: '도준', m: x.m, quote: '노점 앞에서 도준이라는 청년이' }] }, x.ctx);
  assert.deepEqual(rep.applied.newPeople, ['도준']);
  assert.equal(x.store.people.도준.origin, 'c1', '처음 만든 응답을 적는다');
});

test('갱신기 새 인물: 이름 없는 인물(호칭 기록)과 명부 대조로 올린 명부 줄은 이름 검사를 하지 않는다', () => {
  let x = upSetup('노점 주인이 고개를 끄덕였다.');
  let rep = U.applyUpdate(x.store, x.c, x.input, { new_people: [{ name: '노점 할머니', provisional: true, m: x.m, quote: '노점 주인이 고개를' }] }, x.ctx);
  assert.deepEqual(rep.applied.newPeople, ['노점 할머니'], '호칭 처리는 그대로');
  const roster = [{ name: '가온누리', english: 'Gaonnuri', legacyEnglish: [], aliases: [], affiliation: 'A00', rank: '요원', department: '' }];
  x = upSetup('붉은 눈의 여자가 서 있었다.', { roster });
  assert.ok(x.input.data.roster.some((r) => r.name === '가온누리'));
  rep = U.applyUpdate(x.store, x.c, x.input, { new_people: [{ name: '가온누리', m: x.m, quote: '붉은 눈의 여자가' }] }, x.ctx);
  assert.deepEqual(rep.applied.newPeople, ['가온누리']);
});

// ── 문제 4: 다시 굴려 사라진 응답이 처음 만든 기록은 같이 없앤다 ──

test('저장: origin 을 읽어 들인다', () => {
  const store = T.emptyStore();
  store.people.도준 = person('도준', { origin: 'c4' });
  assert.equal(S.peopleStore({ message: [], goeiPeopleV1: store }).people.도준.origin, 'c4');
});

test('다시 굴리기: 사라진 응답만 근거였던 기록은 없애고, 살아 있는 글에 나오거나 사용자가 고친 기록은 남긴다', () => {
  const mk = () => {
    const store = T.emptyStore();
    store.people.에일린 = person('에일린', { aliases: ['Aileen'] });
    store.people.도준 = person('도준', { faction: '', origin: 'c4' });
    store.people.큐라스 = person('큐라스', { aliases: ['Kyuras'], origin: 'c4' });
    S.putEntry(store, '도준', 'history', { id: 'h1', text: '노점에서 만남', src: 'story', anchor: 'c4', seq: 1, quote: '도준' });
    S.putChange(store, { id: 'x1', anchor: 'c4', seq: 1, src: 'story', who: '도준', kind: 'cue', reason: 'r' });
    store.scene = { c3: ['에일린', '도준'] };
    return store;
  };
  // c4 를 다시 굴려 c4b 가 됨: 새 응답엔 아무도 없다
  const after = chat(['user', '출근', 'u1'], ['char', '에일린이 말했다.', 'c3'], ['user', '시장에 갔다', 'u4'], ['char', '아무도 없었다.', 'c4b']);
  const appears = (st) => (names) => H.liveAppearing(st, after, names);
  let store = mk();
  assert.deepEqual(S.dropGonePeople(store, after, appears(store)).sort(), ['도준', '큐라스'].sort());
  assert.deepEqual(Object.keys(store.people), ['에일린']);
  assert.ok(!store.log.some((c) => c.who === '도준'));
  assert.deepEqual(store.scene.c3, ['에일린']);
  // 살아 있는 메시지(유저 입력)에 이름이 나오면 남긴다
  store = mk();
  const mentioned = chat(['user', '출근', 'u1'], ['char', '에일린이 말했다.', 'c3'], ['user', '큐라스 선배를 찾았다', 'u4'], ['char', '아무도 없었다.', 'c4b']);
  assert.deepEqual(S.dropGonePeople(store, mentioned, (n) => H.liveAppearing(store, mentioned, n)), ['도준']);
  assert.ok(store.people.큐라스);
  // 사용자가 고친 기록(호칭 고정)·항상 포함할 인물·살아 있는 다른 응답의 항목이 있는 기록은 남긴다
  store = mk();
  store.people.도준.address.pin = true;
  assert.deepEqual(S.dropGonePeople(store, after, appears(store), ['큐라스']), []);
  store = mk();
  S.putEntry(store, '도준', 'state', { id: 's1', text: '시장에 있음', src: 'story', anchor: 'c3', seq: 2, quote: '에일린이' });
  assert.deepEqual(S.dropGonePeople(store, after, appears(store)), ['큐라스']);
  // 처음 만든 응답이 살아 있으면 그대로, origin 이 없는 기록(사용자가 만든 것·옛 저장)도 그대로
  store = mk();
  const alive = chat(['user', '출근', 'u1'], ['char', '에일린이 말했다.', 'c3'], ['user', '시장', 'u4'], ['char', '아무도 없었다.', 'c4']);
  assert.deepEqual(S.dropGonePeople(store, alive, (n) => H.liveAppearing(store, alive, n)), []);
  store = mk();
  delete store.people.도준.origin;
  assert.deepEqual(S.dropGonePeople(store, after, appears(store)), ['큐라스']);
});

test('다시 굴리기: 별명만 남은 글은 「나온 것」으로 치지 않는다 (처음 등장과 같은 규칙)', () => {
  const store = T.emptyStore();
  store.people.백사헌 = person('백사헌', { faction: 'C00', aliases: B.seedBaseFor('백사헌', 'A00', undefined).aliases, origin: 'c2' });
  const c = chat(['user', '관리국 사무실', 'u1'], ['char', '독사 표본이 있었다.', 'c1'], ['user', '?', 'u2'], ['char', '조용했다.', 'c2b']);
  assert.deepEqual(S.dropGonePeople(store, c, (n) => H.liveAppearing(store, c, n)), ['백사헌']);
});

// ── 문제 5: Director 재사용 열쇠 ──

test('Director 재사용 열쇠: 방식·언어·길이·덧붙인 지침이 바뀌면 열쇠가 달라진다 (같은 입력·기록이면 같다)', () => {
  const c = chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 서류를 건넸다.', 'c1']);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const key = (state) => D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', St.peopleSettings({ $pp_rhythm: '0', ...state }), {}).key;
  const k0 = key({});
  assert.equal(key({}), k0);
  assert.notEqual(key({ $pp_director: 'scene' }), k0);
  assert.notEqual(key({ $pp_director_lang: 'ko' }), k0);
  assert.notEqual(key({ $pp_director_len: 'normal' }), k0);
  assert.notEqual(key({ $pp_director_rules: '짧게 써라' }), k0);
});

// ── 문제 6: 정리는 최근 응답의 항목을 합치지 않는다 ──

test('정리: 채팅 뒤쪽 keepMsgs 메시지 안 응답의 항목은 입력에서 빠지고, 다시 굴리면 그 항목은 사라진다', () => {
  const msgs = [];
  for (let i = 1; i <= 30; i++) msgs.push([i % 2 ? 'user' : 'char', `글 ${i}`, `m${i}`]);
  const c = chat(...msgs);
  const store = T.emptyStore();
  store.people.큐라스 = person('큐라스');
  S.putEntry(store, '큐라스', 'history', { id: 'old1', text: '손전등을 켬', src: 'field', anchor: 'm2', seq: 1 });
  S.putEntry(store, '큐라스', 'history', { id: 'old2', text: '앞장섬', src: 'field', anchor: 'm4', seq: 1 });
  S.putEntry(store, '큐라스', 'history', { id: 'new1', text: '전단지를 챙김', src: 'field', anchor: 'm30', seq: 1 });
  const s = settings({ keepMsgs: 20 });
  const input = C.buildConsolidate(store, c, '큐라스', s);
  assert.deepEqual(input.data.slots.history.map((e) => e.id), ['old1', 'old2']);
  C.applyConsolidate(store, '큐라스', input, { slots: { history: [{ text: '손전등을 켜고 앞장섬', from: ['old1', 'old2'] }] } }, S.liveness(c), s);
  // m30 을 다시 굴림
  const rerolled = { message: c.message.map((m) => (m.chatId === 'm30' ? { ...m, chatId: 'm30b', data: '다른 글' } : m)) };
  const texts = S.liveEntries(store.people.큐라스.slots.history, S.liveness(rerolled)).map((e) => e.text);
  assert.deepEqual(texts, ['손전등을 켜고 앞장섬']);
  // 최근 응답만 있는 짧은 채팅: 합칠 것이 없다 (호감 계기 접기와 같다)
  const short = chat(['user', 'a', 'u1'], ['char', 'b', 'c1'], ['user', 'c', 'u2'], ['char', 'd', 'c2']);
  const st2 = T.emptyStore();
  st2.people.큐라스 = person('큐라스');
  S.putEntry(st2, '큐라스', 'history', { id: 'a', text: 'x', src: 'field', anchor: 'c1', seq: 1 });
  S.putEntry(st2, '큐라스', 'history', { id: 'b', text: 'y', src: 'field', anchor: 'c2', seq: 1 });
  assert.equal(C.buildConsolidate(st2, short, '큐라스', settings()), null);
});
