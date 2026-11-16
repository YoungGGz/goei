// 이름 맞추기의 뒤 경계 (v0.21.19 에 있던 고장): 이름·호칭이 더 긴 낱말의 앞부분일 때는 그 사람으로 잡지 않는다.
// 뒤 경계 규칙은 로어북 고르기와 같다 (core/lore.ts rightOk: 조사·호칭은 붙어도 된다).
// 사람 수·이름은 자료(src/data/install/directory.json, aliases.json)에서 읽는다. 숫자를 적어 두지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initTestData } from './data-init.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-tail-'));
const outfile = join(dir, 'bundle.mjs');
const ENTRY = `
export * as U from './src/core/people/updater';
export * as S from './src/core/people/store';
export * as T from './src/core/people/types';
export * as St from './src/core/people/settings';
export * as Sel from './src/core/people/select';
export * as B from './src/core/people/base';
export * as R from './src/core/people/request';
export * as Ro from './src/core/people/router';
export * as Seed from './src/core/people/seed';
export * as Inj from './src/core/people/inject';
export * as Img from './src/core/imgtag';
export * as P from './src/core/people/prompt/index';
export * as Def from './src/core/setdef/people';
export * as Rec from './src/core/world/records';
export * as G from './src/core/guides';
export * as H from './src/host/people';
export * as Pack from './src/core/datapack';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { U, S, T, St, Sel, B, R, Ro, Seed, Inj, Img, P, Def, Rec, G, H, Pack } = await import(pathToFileURL(outfile));
initTestData(Pack);

// 기본 명부의 요원 줄 → 인물 기록이 쓰는 칸 (host/people.ts rosterOf 와 같은 꼴)
const DIRECTORY = JSON.parse(await readFile(new URL('../src/data/install/directory.json', import.meta.url), 'utf8'));
const ROSTER = Object.values(DIRECTORY.요원).map((a) => ({ name: a.name, english: a.english ?? '', legacyEnglish: a.legacy_english ?? [], aliases: a.aliases ?? [], affiliation: a.affiliation ?? '', rank: a.rank ?? '', department: a.department ?? '' }));
/** 명부에는 있고 미리 만든 표(aliases.json)에는 없는 사람들 */
const ROSTER_ONLY = ROSTER.filter((r) => !B.ALIASES.names[r.name]);

const settings = (vars = {}, over = {}) => ({ ...St.peopleSettings({ $pp_prev_pairs: '1', ...vars }), ...over });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const npc = (name, extra = {}) => ({ ...Seed.seedPerson(name, null, {}, '2026-01-01T00:00:00Z'), ...extra });
const tagOf = (input, index) => [...input.tags].find(([, i]) => i === index)[0];
const SHEET = ['### Character - Someone', '#### Identity', '- Role: Chief', '#### Voice', '- Short orders.'].join('\n');

const AESTHETE = ROSTER.find((r) => r.name === '탐미주의');

test('명부 이름이 더 긴 낱말의 앞부분이면 그 인물로 보지 않는다 (탐미주의적·탐미주의자), 조사가 붙은 이름은 본다', () => {
  assert.ok(AESTHETE, '명부에 「탐미주의」가 있다');
  const seed = (text) => H.seedAppearing(T.emptyStore(), chat(['user', '문을 열었다', 'u1'], ['char', text, 'c1']), [1], () => null, { roster: ROSTER });
  assert.deepEqual(seed('그의 탐미주의적 취향이 방에 가득했다.'), []);
  assert.deepEqual(seed('탐미주의자 같은 말투였다.'), []);
  assert.deepEqual(seed('탐미주의가 고개를 들었다.'), ['탐미주의']);
  assert.deepEqual(seed('「탐미주의」, 그 이름을 들었다.'), ['탐미주의']);
  assert.deepEqual(seed('탐미주의에게서 편지가 왔다.'), ['탐미주의']);
  // 기록이 이미 있어도 메인 요청·갱신기 장면 인물로 끌려오지 않는다
  const store = T.emptyStore();
  store.people.탐미주의 = npc('탐미주의');
  const c = chat(['user', '전시를 봤다', 'u1'], ['char', '탐미주의적이라는 평이 붙은 그림이었다.', 'c1']);
  assert.deepEqual(R.peopleBlockFor(c, { settings: settings(), store, sheetOf: () => null, extraNames: B.extraNames(ROSTER) }).people, []);
  assert.deepEqual(U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: Sel.namesWith(store, B.allNames(ROSTER)), roster: ROSTER }).people, []);
});

test('짧은 호칭 기록(「여자」)은 「여자친구」 같은 낱말에 끌려오지 않는다, 조사가 붙은 호칭은 본다', () => {
  const store = T.emptyStore();
  store.people.여자 = npc('여자', { provisional: true });
  const scene = (text) => R.peopleBlockFor(chat(['user', '걸었다', 'u1'], ['char', text, 'c1']), { settings: settings({ $pp_scene_carry: '0' }), store, sheetOf: () => null, extraNames: B.extraNames(ROSTER) }).people;
  assert.deepEqual(scene('그는 여자친구 이야기를 꺼냈다.'), []);
  assert.deepEqual(scene('여자들이 지나갔다.'), []);
  assert.deepEqual(scene('여자가 고개를 들었다.'), ['여자']);
  assert.deepEqual(scene('여자는 말이 없었다.'), ['여자']);
});

test('뒤 경계: 이름 뒤 호칭·서술은 그대로 잡는다', () => {
  const m = Sel.nameMatcher([{ name: '김철수', aliases: ['철수'], titles: [] }, { name: 'Jay', aliases: [], titles: [] }]);
  for (const t of ['김철수였다.', '철수 씨가 왔다.', '철수야, 어디 가?', '김철수님께', '철수한테 물었다', '"철수"', '철수.']) assert.deepEqual(m(t), ['김철수'], t);
  assert.deepEqual(m('철수세미를 샀다.'), []);
  assert.deepEqual(m("Jay's coat"), ['Jay']);
});

test('호칭으로 올라온 이름이 이름 표의 인물(별명 포함)이면 이름 있는 인물로 등록한다 (「이름 아님」 표시 없이)', () => {
  const c = chat(['user', '가게에 들어갔다', 'u1'], ['char', '사장님이 고개를 들었다.', 'c1']);
  const names = [{ name: '사장', aliases: ['사장님'], titles: [] }];
  const store = T.emptyStore();
  const input = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names });
  const rep = U.applyUpdate(store, c, input, { new_people: [{ name: '사장님', aliases: [], m: tagOf(input, 1), quote: '사장님이 고개를 들었다', identity: '미확인', provisional: true }] }, { settings: settings() });
  assert.deepEqual(rep.applied.newPeople, ['사장']);
  assert.ok(!store.people.사장.provisional);
  // 표에 없는 호칭은 그대로 호칭 기록
  const s2 = T.emptyStore();
  const in2 = U.buildUpdate(c, s2, [1], { settings: settings(), system: '', values: {}, names: [] });
  U.applyUpdate(s2, c, in2, { new_people: [{ name: '사장님', aliases: [], m: tagOf(in2, 1), quote: '사장님이 고개를 들었다', identity: '미확인', provisional: true }] }, { settings: settings() });
  assert.equal(s2.people.사장님.provisional, true);
});
