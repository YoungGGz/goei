// 인물 인식: 이름 표를 명부에서 받기(초상 태그 포함), 명부 대조 자료, 이름 없는 인물(호칭 기록)과 이름 옮기기, 장면 인물 유지.
// 코드는 형식·근거만 검사한다 — 누가 누구인지, 기록할 만한지, 장면에 남아 있는지는 갱신기 모델이 판단한다 (지침 4절).
// 사람 수·이름은 자료(src/data/install/directory.json, aliases.json)에서 읽는다. 숫자를 적어 두지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initTestData } from './data-init.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-roster-'));
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

test('이름 표: 명부의 요원이 전부 들어가고, 명부 줄은 이름·영문 표기만 열쇠가 된다', () => {
  assert.ok(ROSTER.length > 0 && ROSTER_ONLY.length > 0, '자료: 명부에만 있는 사람이 있다');
  const table = B.allNames(ROSTER);
  assert.equal(table.length, new Set([...Object.keys(B.ALIASES.names), ...ROSTER.map((r) => r.name)]).size);
  const by = new Map(table.map((e) => [e.name, e]));
  for (const r of ROSTER) {
    assert.ok(by.has(r.name), `${r.name} 표에 있음`);
    if (r.english) assert.ok(by.get(r.name).aliases.includes(r.english), `${r.name} 영문 표기`);
  }
  // 명부 별칭은 열쇠가 아니다: 표에만 있는 사람은 영문 표기 말고는 별명이 없다
  const match = Sel.nameMatcher(table);
  for (const r of ROSTER_ONLY) {
    assert.deepEqual(by.get(r.name).aliases, [r.english, ...r.legacyEnglish].filter(Boolean));
    // 이름·영문 표기를 품은 별칭(이름 뒤에 글자가 붙은 꼴)은 이름 열쇠로 잡히니 빼고 본다
    const keys = [r.name, r.english, ...r.legacyEnglish].filter(Boolean).map((k) => k.toLowerCase());
    for (const a of r.aliases.filter((x) => !keys.some((k) => x.toLowerCase().includes(k)))) assert.ok(!match(`${a} 이야기를 했다.`).includes(r.name), `${r.name}: 명부 별칭 「${a}」로는 잡히지 않음`);
    assert.ok(match(`${r.name}이 들어왔다.`).includes(r.name));
    assert.ok(match(`여자는 웃었다.\n<img=${r.english}_smirk>`).includes(r.name), `${r.name}: 초상 태그만으로 잡힘`);
    assert.ok(B.extraNames(ROSTER)[r.name].aliases.includes(r.english));
  }
  // 명부를 넘기지 않으면 미리 만든 표 그대로
  assert.equal(B.allNames().length, Object.keys(B.ALIASES.names).length);
  assert.ok(ROSTER_ONLY.every((r) => !B.allNames().some((e) => e.name === r.name)));
});

test('시작값: 미리 만든 자료에 없는 명부 인물은 명부 줄의 소속·영문 표기로, 자리 조직은 소속 없음', () => {
  const placeholder = Rec.placeholderOrgs();
  for (const r of ROSTER_ONLY) {
    const base = B.seedBaseFor(r.name, 'A00', undefined, r);
    assert.equal(base.faction, placeholder.has(r.affiliation) ? '' : r.affiliation, r.name);
    assert.ok(base.aliases.includes(r.english));
    assert.equal(base.affinityBase, B.userAffinityBase(base.faction, 'A00'));
    assert.deepEqual(B.seedBaseFor(r.name, 'A00', undefined), { faction: '', affinityBase: 0, aliases: [] }, '명부 줄이 없으면 빈 시작값');
  }
  // 미리 만든 자료가 있는 사람은 명부 줄을 넘겨도 그대로
  const known = ROSTER.find((r) => B.RELATIONS.people[r.name]);
  assert.deepEqual(B.seedBaseFor(known.name, 'A00', undefined, known), B.seedBaseFor(known.name, 'A00', undefined));
});

// 명부가 저장되지 않은 카드: 요원 폴더의 로어북에서 줄을 만든다 (영문 표기는 로어북 키의 첫 영문)
const F = (id, name) => ({ comment: name, key: `folder:${id}`, mode: 'folder', content: '' });
const L = (name, folder, key = '') => ({ comment: name, key, content: `${name} 설정`, mode: 'normal', folder: `folder:${folder}` });
const LORE = [F('g', '🙂요원'), L('-----개체-----', 'g'), L('가온누리', 'g', 'Gaonnuri, 가온누리'), L('다솜', 'g', 'Dasom, 다솜')];

test('명부 읽기 → 처음 등장: 초상 태그만 떠도 기록을 만들고, 유저가 연기하는 요원은 만들지 않는다', () => {
  const roster = H.rosterOf(LORE);
  assert.deepEqual(roster.map((r) => [r.name, r.english]), [['가온누리', 'Gaonnuri'], ['다솜', 'Dasom']]);
  assert.deepEqual(H.rosterOf(undefined), []);
  const c = chat(['user', '문을 열었다', 'u1'], ['char', '여자는 웃었다.\n\n<img=Gaonnuri_smirk>', 'c1']);
  const store = T.emptyStore();
  assert.deepEqual(H.seedAppearing(store, c, [1], () => null, {}), [], '명부 없이는 표에 없는 사람을 모른다');
  assert.deepEqual(H.seedAppearing(store, c, [1], () => null, { roster, exclude: ['가온누리'] }), []);
  assert.deepEqual(H.seedAppearing(store, c, [1], (n) => (n === '가온누리' ? SHEET : null), { roster }), ['가온누리']);
  assert.equal(store.people.가온누리.seeded.from, 'lore');
  assert.ok(store.people.가온누리.aliases.includes('Gaonnuri'));
  assert.ok(!store.people.가온누리.provisional);
  // 갱신기: 이름이 글에 없어도 장면 인물로 고르고, 초상이 뜬 응답을 자료로 알린다
  const input = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: Sel.namesWith(store, B.allNames(roster)), roster });
  assert.deepEqual(input.people, ['가온누리']);
  assert.deepEqual(input.data.portraits, [{ m: tagOf(input, 1), who: ['가온누리'] }]);
  assert.ok(!JSON.stringify(input.data.span).includes('<img='), '모델이 보는 글에는 태그가 없다');
  // 메인 요청: 같은 글에서 그 인물의 기록을 고른다
  const req = R.peopleBlockFor(c, { settings: settings(), store, sheetOf: () => null, extraNames: B.extraNames(roster), input: '누구세요?' });
  assert.deepEqual(req.people, ['가온누리']);
  // 유저가 연기하는 요원의 초상은 자료에 싣지 않는다
  const mine = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: Sel.namesWith(store, B.allNames(roster)), roster, exclude: ['가온누리'] });
  assert.deepEqual(mine.people, []);
  assert.equal(mine.data.portraits, undefined);
  assert.deepEqual(Img.imgTagNames('a <img=Gaonnuri_smirk> b <img="Dasom_happy"> <img=Gaonnuri_sad>'), ['Gaonnuri', 'Dasom']);
});

test('호칭으로 적어 둔 인물에게 나중에 초상 태그가 뜬 경우: 두 기록과 초상을 자료로 알리고, 그 응답을 근거로 한 이름 옮기기로 하나가 된다', () => {
  const roster = H.rosterOf(LORE);
  const sheet = (n) => (n === '가온누리' ? SHEET : null);
  const c = chat(['user', '문을 열었다', 'u1'], ['char', '여자가 붉은 눈으로 웃었다. "어서 와."', 'c1'], ['user', '안으로 들어갔다', 'u2'], ['char', '<img=Gaonnuri_smirk>\n여자는 잔을 내밀었다.', 'c2']);
  const store = T.emptyStore();
  store.people.여자 = npc('여자', { provisional: true });
  S.putEntry(store, '여자', 'history', { id: 'e-h', text: '주인공을 맞이했다', src: 'story', anchor: 'c1', seq: 1, quote: '어서 와' });
  S.markRead(store, c, [1]);
  // 글에는 이름이 없고 태그만 떴다: 명부 인물의 기록이 따로 생긴다 (같은 사람인지는 코드가 모른다)
  assert.deepEqual(H.seedAppearing(store, c, [3], sheet, { roster }), ['가온누리']);
  const s = settings();
  const input = U.buildUpdate(c, store, [3], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames(roster)), roster });
  const m = tagOf(input, 3);
  assert.deepEqual([...input.people].sort(), ['가온누리', '여자'].sort());
  assert.deepEqual(input.data.portraits, [{ m, who: ['가온누리'] }]);
  assert.deepEqual(input.data.handles, ['여자']);
  // 모델이 초상을 근거로 같은 사람이라고 답하면 (이름은 글에 없으니 인용은 그 응답에서 그 사람을 가리킨 글)
  const rep = U.applyUpdate(store, c, input, {
    renames: [{ from: '여자', to: '가온누리', m, quote: '여자는 잔을 내밀었다' }],
    entries: [{ who: '가온누리', slot: 'history', op: 'add', text: '잔을 내밀었다', m, quote: '여자는 잔을 내밀었다' }],
    present: ['가온누리'],
  }, { settings: s, sheetOf: sheet, baseOf: (n) => B.seedBaseFor(n, 'A00', undefined, roster.find((r) => r.name === n)) });
  assert.deepEqual(rep.applied.renamed, [{ from: '여자', to: '가온누리' }]);
  assert.deepEqual(rep.dropped, []);
  assert.deepEqual(Object.keys(store.people), ['가온누리']);
  const p = store.people.가온누리;
  assert.ok(!p.provisional && p.seeded.from === 'lore');
  assert.deepEqual(p.slots.history.map((e) => e.text).sort(), ['잔을 내밀었다', '주인공을 맞이했다'].sort());
  assert.ok(!p.aliases.includes('여자'));
  assert.deepEqual(store.scene.c2, ['가온누리']);
});

test('갱신기 장면 인물: 표에 없는 기록(갱신기가 등록한 인물)도 글에 나오면 고른다', () => {
  const c = chat(['user', '복도로 나갔다', 'u1'], ['char', '김철수가 손을 들었다. 붉은 코트의 여자는 말이 없었다.', 'c1']);
  const store = T.emptyStore();
  store.people.김철수 = npc('김철수');
  store.people['붉은 코트의 여자'] = npc('붉은 코트의 여자', { provisional: true });
  const tableOnly = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: B.allNames(ROSTER) });
  assert.deepEqual(tableOnly.people, [], '표만으로는 잡히지 않는다');
  const input = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: Sel.namesWith(store, B.allNames(ROSTER)) });
  assert.deepEqual([...input.people].sort(), ['김철수', '붉은 코트의 여자'].sort());
  // 호칭 기록은 자료에 표시가 붙는다
  const rows = Object.fromEntries(input.data.people.map((p) => [p.name, p]));
  assert.equal(rows['붉은 코트의 여자'].provisional, true);
  assert.ok(!('provisional' in rows.김철수));
  // 표의 겹치는 호칭 규칙은 그대로 (표 전체에서 한 사람만 가진 호칭일 때만)
  const table = B.allNames(ROSTER);
  assert.deepEqual(Sel.namesWith(store, table).filter((e) => table.some((t) => t.name === e.name)).map((e) => e.titles), table.map((e) => e.titles));
});

test('갱신기 자료: 명부 대조(roster)·호칭 기록(handles)·대기 이름(held_names)', () => {
  const c = chat(['user', '복도로 나갔다', 'u1'], ['char', '여자가 고개를 돌렸다.', 'c1']);
  const store = T.emptyStore();
  const recorded = ROSTER[0];
  store.people[recorded.name] = npc(recorded.name);
  store.people['붉은 코트의 여자'] = npc('붉은 코트의 여자', { provisional: true });
  store.pending['모자 쓴 남자'] = { anchor: 'c1', aliases: [], provisional: true };
  store.pending['박 대리'] = { anchor: 'c1', aliases: [] };
  store.pending['지운 응답의 이름'] = { anchor: 'gone', aliases: [] };
  const excluded = ROSTER[1];
  const build = (s, extra = {}) => U.buildUpdate(c, store, [1], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames(ROSTER)), roster: ROSTER, exclude: [excluded.name], ...extra }).data;
  const data = build(settings());
  // 기록이 없고 유저가 연기하지 않는 명부 줄 전부 (코드가 후보를 추리지 않는다)
  assert.deepEqual(data.roster.map((r) => r.name), ROSTER.filter((r) => r !== recorded && r !== excluded).map((r) => r.name));
  for (const row of data.roster) {
    const src = ROSTER.find((r) => r.name === row.name);
    assert.deepEqual(Object.keys(row), ['name', 'names', 'affiliation', 'rank', 'department']);
    assert.deepEqual(row.names, [...new Set([src.english, ...src.aliases].filter(Boolean))]);
    assert.equal(row.rank, src.rank);
  }
  // 호칭: 장면 인물로 뽑히지 않은 호칭 기록 + 호칭으로 올라와 기다리는 이름 (이름 옮기기의 from 이 될 수 있는 것을 모델이 가려 본다)
  assert.deepEqual(data.handles, ['붉은 코트의 여자', '모자 쓴 남자']);
  // 대기 이름: 근거 응답이 채팅에 있는 줄만 (지운 응답에서만 나온 이름은 싣지 않는다)
  assert.deepEqual(data.held_names, ['모자 쓴 남자', '박 대리']);
  assert.ok(data.known_names.includes('붉은 코트의 여자'));
  // 세력 코드는 명부의 세력 이름으로 싣는다
  const coded = ROSTER.find((r) => r !== recorded && r !== excluded && /^[A-Z]\d\d$/.test(r.affiliation));
  if (coded) assert.equal(build(settings(), { factionNames: { [coded.affiliation]: '이름' } }).roster.find((r) => r.name === coded.name).affiliation, '이름');
  // 설정을 끄면 싣지 않는다
  assert.equal(build(settings({ $pp_roster_hint: '0' })).roster, undefined);
  const named = build(settings({ $pp_new_unnamed: '0' }));
  assert.equal(named.handles, undefined);
  assert.deepEqual(named.held_names, ['박 대리'], '호칭으로 올라온 줄은 다시 와도 받지 않으니 싣지 않는다');
  // 다시 읽기(only)는 새 인물을 받지 않으니 그 자료도 없다
  const only = build(settings(), { only: [recorded.name] });
  assert.equal(only.roster, undefined);
  assert.equal(only.handles, undefined);
  assert.equal(only.held_names, undefined);
});

// 토큰 점검 (11-15): 명부 대조 인원 상한 (기본 0 = 제한 없음)
test('명부 대조 인원 상한: 기본은 전원, 상한을 두면 글에 소속·직급·부서가 나온 사람부터 그 수만큼', () => {
  const store = T.emptyStore();
  const all = (s) => U.buildUpdate(chat(['user', '안녕', 'u1'], ['char', '복도에 누군가 서 있었다.', 'c1']), store, [1], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames(ROSTER)), roster: ROSTER }).data.roster;
  assert.equal(St.PP_DEFAULTS.roster_cap, '0');
  assert.equal(all(settings()).length, ROSTER.length, '기본: 전원');
  const cap = Math.min(5, ROSTER.length - 1);
  const cut = all(settings({ $pp_roster_cap: String(cap) }));
  assert.deepEqual(cut.map((r) => r.name), ROSTER.slice(0, cap).map((r) => r.name), '글에 단서가 없으면 명부 차례대로');
  // 글에 직급이나 부서가 나온 사람이 앞에 온다
  const target = ROSTER.slice(cap).find((r) => (r.department || r.rank) && !ROSTER.slice(0, cap).some((x) => [x.affiliation, x.rank, x.department].includes(r.department || r.rank)));
  assert.ok(target, '자료: 상한 뒤쪽에 부서·직급이 다른 사람이 있다');
  const word = target.department || target.rank;
  const near = U.buildUpdate(chat(['user', '안녕', 'u1'], ['char', `${word} 사람이 서류를 들고 왔다.`, 'c1']), store, [1], { settings: settings({ $pp_roster_cap: String(cap) }), system: '', values: {}, names: Sel.namesWith(store, B.allNames(ROSTER)), roster: ROSTER }).data.roster;
  assert.equal(near.length, cap);
  assert.ok(near.some((r) => r.name === target.name), `${target.name}(${word})이 들어감`);
  const row = Def.PEOPLE_SET.groups.flatMap((g) => g.rows).find((r) => r.key === 'roster_cap');
  assert.ok(row && row.help && row.ctl.opts[0][0] === '0', '정의표: 첫 선택지가 제한 없음');
  for (const k of ['docs_inject', 'axes_obs_inject']) {
    assert.equal(St.PP_DEFAULTS[k], k === 'docs_inject' ? '1' : '0', `${k} 기본값`);
    assert.deepEqual(Def.PEOPLE_SET.groups.flatMap((g) => g.rows).find((r) => r.key === k)?.ctl, { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] });
  }
});

// 2026-11-17: 갱신기 자료의 문서 항목은 메인 요청과 같은 규칙으로 고른다 (상한 설정은 없앰)
test('갱신기 자료 문서: 장면과 관련된 항목만, 몫을 넘으면 최근 것부터', () => {
  const store = T.emptyStore();
  store.people.나루 = npc('나루');
  const c = chat(['user', '안녕', 'u1'], ['char', '옛일.', 'c1'], ['user', '다음', 'u2'], ['char', '나루가 창고 열쇠를 꺼냈다.', 'c2']);
  const doc = (type, key, id, anchor, extra = {}) => ((store.docs[`${type}:${key}`] ??= { type, key, entries: [] }).entries.push({ id, text: `${key} 기록 ${id}`, src: 'story', anchor, seq: 1, ...extra }));
  doc('event', '정전 사고', 'd1', 'c1');
  doc('event', '회의', 'd2', 'c1', { who: ['나루'] });
  doc('location', '옥상', 'd3', 'c1');
  doc('item', '창고 열쇠', 'd4', 'c1');
  doc('faction', '상인회', 'd5', 'c2');
  doc('event', '지워진 일', 'd6', 'gone');
  const now = (s) => U.buildUpdate(c, store, [3], { settings: s, system: '', values: {}, names: Sel.namesWith(store, []) }).data.docs_now.map((d) => d.id);
  // 2026-11-17: 메인 요청과 같은 규칙. 장면 인물(나루)이 얽힌 d2, 이름이 글에 나온 d4 만. 관련 없는 줄(d1·d3·d5)과 죽은 줄(d6)은 안 보낸다
  assert.deepEqual(now(settings()), ['d2', 'd4']);
  // 꺼진 종류는 빠진다
  assert.deepEqual(now(settings({ $pp_docs_item: '0' })), ['d2']);
  // 몫(컨텍스트 글자 상한 ÷ (장면 인물 수 + 1))을 넘으면 최근 것부터 남긴다
  for (let i = 0; i < 200; i++) doc('event', '회의', `x${i}`, 'c2', { who: ['나루'] });
  const many = now(settings());
  assert.ok(many.length < 200 && many.at(-1) === 'x199' && !many.includes('d2'), '오래된 줄부터 빠짐');
  assert.equal(St.PP_DEFAULTS.docs_cap, undefined);
  assert.equal(Def.PEOPLE_SET.groups.flatMap((g) => g.rows).find((r) => r.key === 'docs_cap'), undefined, '상한 설정은 없앰');
});

test('새 인물: 역할·묘사로 된 이름을 코드가 걸러내지 않는다. 호칭(provisional)은 설정이 켜져 있을 때만 받는다', () => {
  const c = chat(['user', '택시를 탔다', 'u1'], ['char', '택시 기사가 백미러로 이쪽을 봤다. 붉은 코트의 여자가 옆자리에 앉았다.', 'c1']);
  const mk = () => {
    const store = T.emptyStore();
    const input = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: [] });
    return { store, input, m: tagOf(input, 1) };
  };
  const item = (m, name, quote, extra = {}) => ({ name, aliases: [], m, quote, identity: '미확인', ...extra });
  // 켬: 이름으로 올린 것도 호칭으로 올린 것도 등록한다 (어떤 낱말인지는 보지 않는다)
  let x = mk();
  let rep = U.applyUpdate(x.store, c, x.input, { new_people: [item(x.m, '택시 기사', '택시 기사가 백미러로'), item(x.m, '붉은 코트의 여자', '붉은 코트의 여자가', { provisional: true })] }, { settings: settings() });
  assert.deepEqual(rep.applied.newPeople, ['택시 기사', '붉은 코트의 여자']);
  assert.deepEqual(rep.dropped, []);
  assert.ok(!x.store.people['택시 기사'].provisional);
  assert.equal(x.store.people['붉은 코트의 여자'].provisional, true);
  assert.equal(S.peopleStore({ [T.PEOPLE_KEY]: JSON.parse(JSON.stringify(x.store)) }).people['붉은 코트의 여자'].provisional, true, '저장 뒤 다시 읽어도 남는다');
  // 끔: 호칭으로 올린 것만 버린다
  x = mk();
  rep = U.applyUpdate(x.store, c, x.input, { new_people: [item(x.m, '택시 기사', '택시 기사가 백미러로'), item(x.m, '붉은 코트의 여자', '붉은 코트의 여자가', { provisional: true })] }, { settings: settings({ $pp_new_unnamed: '0' }) });
  assert.deepEqual(rep.applied.newPeople, ['택시 기사']);
  assert.deepEqual(rep.dropped.map((d) => [d.who, d.reason]), [['붉은 코트의 여자', '이름 없는 인물 기록 꺼짐']]);
  // 확인 뒤 등록: 대기 줄에 호칭 표시가 남는다 (등록 화면이 기록으로 옮긴다)
  x = mk();
  rep = U.applyUpdate(x.store, c, x.input, { new_people: [item(x.m, '붉은 코트의 여자', '붉은 코트의 여자가', { provisional: true }), item(x.m, '택시 기사', '택시 기사가 백미러로')] }, { settings: settings({ $pp_newpeople: 'confirm' }) });
  assert.deepEqual(rep.applied.newPeople, []);
  assert.equal(x.store.pending['붉은 코트의 여자'].provisional, true);
  assert.ok(!('provisional' in x.store.pending['택시 기사']));
  // 2턴 규칙: 호칭도 이름과 같은 규칙 (처음엔 대기, 다른 응답에서 다시 오면 등록) — 따로 강제하는 횟수 없음
  x = mk();
  rep = U.applyUpdate(x.store, c, x.input, { new_people: [item(x.m, '붉은 코트의 여자', '붉은 코트의 여자가', { provisional: true })] }, { settings: settings({ $pp_twoturn: '1' }) });
  assert.ok(rep.held.some((h) => h.who === '붉은 코트의 여자' && /2턴/.test(h.reason)));
  assert.equal(x.store.pending['붉은 코트의 여자'].provisional, true);
  const c2 = { message: [...c.message, { role: 'user', data: '말을 걸었다', chatId: 'u2' }, { role: 'char', data: '붉은 코트의 여자가 대답했다.', chatId: 'c2' }] };
  const input2 = U.buildUpdate(c2, x.store, [3], { settings: settings(), system: '', values: {}, names: [] });
  assert.deepEqual(input2.data.held_names, ['붉은 코트의 여자']);
  rep = U.applyUpdate(x.store, c2, input2, { new_people: [item(tagOf(input2, 3), '붉은 코트의 여자', '붉은 코트의 여자가 대답했다', { provisional: true })] }, { settings: settings({ $pp_twoturn: '1' }) });
  assert.deepEqual(rep.applied.newPeople, ['붉은 코트의 여자']);
  assert.equal(x.store.people['붉은 코트의 여자'].provisional, true);
  assert.ok(!x.store.pending['붉은 코트의 여자']);
});

/** 호칭 기록 하나(항목·계기·후보·다른 인물의 대상·문서·장면 목록)가 있는 채팅 */
function handleSetup() {
  const c = chat(
    ['user', '지하철을 탔다', 'u1'],
    ['char', '붉은 코트의 여자가 맞은편에 앉았다. 김철수는 졸고 있었다.', 'c1'],
    ['user', '이름을 물었다', 'u2'],
    ['char', '여자가 웃었다. "한서린이라고 해요." 김철수가 눈을 떴다.', 'c2'],
  );
  const store = T.emptyStore();
  const h = '붉은 코트의 여자';
  store.people[h] = npc(h, { provisional: true, aliases: ['붉은 코트'] });
  store.people.김철수 = npc('김철수');
  S.putEntry(store, h, 'identity', { id: 'e-id', text: '미확인', src: 'story', anchor: 'c1', seq: 1, quote: '붉은 코트의 여자가' });
  S.putEntry(store, h, 'state', { id: 'e-st', text: '지하철 맞은편 자리', src: 'story', anchor: 'c1', seq: 2, quote: '맞은편에 앉았다' });
  S.putEntry(store, '김철수', 'relationship', { id: 'e-rel', text: '낯선 사람', src: 'story', anchor: 'c1', seq: 3, quote: '졸고 있었다', target: h });
  S.putChange(store, { id: 'c-cue', anchor: 'c1', seq: 4, src: 'story', who: h, kind: 'cue', cue: T.CUES[0], quote: '맞은편에 앉았다', reason: '첫 만남' });
  S.putDoc(store, 'event', '지하철', { id: 'd-1', text: '지하철에서 마주침', src: 'story', anchor: 'c1', seq: 5, who: [h, '김철수'] });
  store.folded[h] = 3;
  store.scene = { c1: [h, '김철수'] };
  S.markRead(store, c, [1]);
  const s = settings();
  const input = U.buildUpdate(c, store, [3], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames()) });
  return { c, store, h, s, input, m: tagOf(input, 3) };
}

test('이름 옮기기: 호칭 기록을 이름으로 옮기고, 이름으로 가리키던 곳을 전부 고친다', () => {
  const { c, store, h, s, input, m } = handleSetup();
  assert.deepEqual(input.data.handles, [h]);
  const before = S.snapshotRun(store);
  const rep = U.applyUpdate(store, c, input, {
    renames: [{ from: h, to: '한서린', m, quote: '한서린이라고 해요' }],
    entries: [{ who: '한서린', slot: 'state', op: 'add', text: '이름을 밝힘', m, quote: '한서린이라고 해요' }, { who: h, slot: 'knowledge', op: 'add', text: '주인공이 이름을 물었다', m, quote: '여자가 웃었다' }],
    present: [h, '김철수'],
  }, { settings: s, sheetOf: () => null, baseOf: () => ({}) });
  assert.deepEqual(rep.applied.renamed, [{ from: h, to: '한서린' }]);
  assert.deepEqual(rep.dropped, []);
  assert.ok(!store.people[h]);
  const p = store.people.한서린;
  assert.equal(p.name, '한서린');
  assert.ok(!p.provisional, '이름이 밝혀지면 호칭 표시는 없어진다');
  assert.deepEqual(p.aliases, [], '옛 호칭과 그 별명은 이름의 별명이 되지 않는다');
  assert.deepEqual(p.slots.identity.map((e) => e.id), ['e-id']);
  assert.ok(p.slots.state.some((e) => e.id === 'e-st'));
  // 같은 응답의 다른 항목은 새 이름으로도 옛 호칭으로도 그 기록에 붙는다 (옛 호칭은 이 응답 안에서만 풀린다)
  assert.ok(p.slots.state.some((e) => e.text === '이름을 밝힘'));
  assert.equal(p.slots.knowledge.length, 1);
  assert.equal(rep.applied.entries, 2);
  // 이름으로 가리키던 곳
  assert.equal(store.log.find((x) => x.id === 'c-cue').who, '한서린');
  assert.equal(store.people.김철수.slots.relationship[0].target, '한서린');
  assert.deepEqual(store.docs['event:지하철'].entries[0].who, ['한서린', '김철수']);
  assert.equal(store.folded.한서린, 3);
  assert.ok(!(h in store.folded));
  assert.deepEqual(store.scene.c1, ['한서린', '김철수']);
  assert.deepEqual(store.scene.c2, ['한서린', '김철수'], '옛 호칭으로 답한 장면 인물도 새 이름으로');
  // 되돌리기 목록: 옮겨 온 항목은 새것이 아니다. 이 갱신이 쓴 두 항목만 적힌다
  const run = S.recordRun(store, before, '2026-01-02T00:00:00Z', rep.applied.renamed);
  assert.deepEqual(run.newPeople, []);
  assert.deepEqual(run.entries.map((e) => [e.who, e.slot]).sort(), [['한서린', 'knowledge'], ['한서린', 'state']]);
  assert.ok(S.undoLastRun(store) > 0);
  assert.ok(store.people.한서린, '되돌려도 옮긴 기록은 남는다');
  assert.ok(!store.people.한서린.slots.state.find((e) => e.id === 'e-st').void, '옮겨 온 항목은 취소되지 않는다');
  assert.ok(store.people.한서린.slots.state.find((e) => e.text === '이름을 밝힘').void);
  // 이름을 넘기지 않으면(옛 방식) 옮겨 온 것이 전부 새것으로 적힌다 — 그래서 넘긴다
  const again = handleSetup();
  const b2 = S.snapshotRun(again.store);
  U.applyUpdate(again.store, again.c, again.input, { renames: [{ from: h, to: '한서린', m: again.m, quote: '한서린이라고 해요' }] }, { settings: again.s });
  assert.deepEqual(S.recordRun(again.store, b2, 'x').newPeople, ['한서린']);
});

test('이름 옮기기: 이미 기록이 있는 이름이면 합치고(그쪽 값이 이긴다), 시트가 있는 이름이면 시트로 시작한다', () => {
  // 기록이 있는 이름에 합침
  let x = handleSetup();
  x.store.people.한서린 = npc('한서린', { faction: 'A00', aliases: ['서린'], address: { toUser: '선배', register: '반말' } });
  S.putEntry(x.store, '한서린', 'state', { id: 'e-own', text: '본부 근무', src: 'story', anchor: 'c1', seq: 9, quote: '졸고 있었다' });
  x.store.folded.한서린 = 2;
  // 서로를 대상으로 적어 둔 항목: 합치면 자기 자신이 대상이 되니 어느 쪽 것도 남기지 않는다
  S.putEntry(x.store, '한서린', 'relationship', { id: 'e-to-handle', text: '수상한 사람', src: 'story', anchor: 'c1', seq: 10, quote: '졸고 있었다', target: x.h });
  S.putEntry(x.store, x.h, 'relationship', { id: 'e-to-name', text: '아는 사이', src: 'story', anchor: 'c1', seq: 11, quote: '맞은편에 앉았다', target: '한서린' });
  let rep = U.applyUpdate(x.store, x.c, x.input, { renames: [{ from: x.h, to: '서린', m: x.m, quote: '한서린이라고 해요' }] }, { settings: x.s });
  assert.deepEqual(rep.applied.renamed, [{ from: x.h, to: '한서린' }], '별명으로 답해도 그 기록으로');
  let p = x.store.people.한서린;
  assert.deepEqual(p.slots.relationship ?? [], []);
  assert.equal(x.store.people.김철수.slots.relationship[0].target, '한서린', '다른 인물 항목의 대상은 새 이름으로');
  assert.equal(p.faction, 'A00');
  assert.deepEqual(p.address, { toUser: '선배', register: '반말' });
  assert.deepEqual(p.slots.state.map((e) => e.id).sort(), ['e-own', 'e-st']);
  assert.deepEqual(p.aliases, ['서린'], '받는 쪽 별명만 남는다');
  assert.equal(x.store.folded.한서린, 5);
  // 시트가 있는 이름 (명부 인물): 시트·명부 시작값으로 기록을 만들고 이야기 기록을 옮긴다. 이야기에서 적은 신원은 옮기지 않는다
  x = handleSetup();
  const row = ROSTER_ONLY[0];
  const c = { message: x.c.message.map((msg, i) => (i === 3 ? { ...msg, data: `여자가 웃었다. "${row.name}이라고 해요."` } : msg)) };
  const input = U.buildUpdate(c, x.store, [3], { settings: x.s, system: '', values: {}, names: Sel.namesWith(x.store, B.allNames(ROSTER)), roster: ROSTER });
  rep = U.applyUpdate(x.store, c, input, { renames: [{ from: x.h, to: row.name, m: tagOf(input, 3), quote: `${row.name}이라고 해요` }] }, { settings: x.s, sheetOf: (n) => (n === row.name ? SHEET : null), baseOf: (n) => B.seedBaseFor(n, 'A00', undefined, ROSTER.find((r) => r.name === n)) });
  assert.deepEqual(rep.applied.renamed, [{ from: x.h, to: row.name }]);
  p = x.store.people[row.name];
  assert.equal(p.seeded.from, 'lore');
  assert.ok(p.aliases.includes(row.english) && !p.aliases.includes(x.h) && !p.aliases.includes('붉은 코트'));
  assert.ok(p.slots.identity.every((e) => e.src === 'seed'), '신원은 시트 것만');
  assert.ok(p.slots.state.some((e) => e.id === 'e-st'));
  // 시트로 만든 시작값 항목은 되돌리기 목록에 들지 않는다
  const y = handleSetup();
  const before = S.snapshotRun(y.store);
  const rep2 = U.applyUpdate(y.store, c, input, { renames: [{ from: y.h, to: row.name, m: tagOf(input, 3), quote: `${row.name}이라고 해요` }] }, { settings: y.s, sheetOf: (n) => (n === row.name ? SHEET : null) });
  assert.equal(S.recordRun(y.store, before, 'x', rep2.applied.renamed), undefined);
});

test('이름 옮기기: 형식·근거가 맞지 않으면 버린다', () => {
  const { c, store, h, s, input, m } = handleSetup();
  const run = (renames, ctx = {}) => U.applyUpdate(store, c, input, { renames }, { settings: s, ...ctx });
  const reasons = (rep) => rep.dropped.map((d) => [d.kind, d.reason]);
  assert.deepEqual(reasons(run([{ from: '김철수', to: '한서린', m, quote: '한서린이라고 해요' }])), [['rename', '호칭으로 적어 둔 인물이 아님']]);
  assert.deepEqual(reasons(run([{ from: '없는 사람', to: '한서린', m, quote: '한서린이라고 해요' }])), [['rename', '호칭으로 적어 둔 인물이 아님']]);
  assert.deepEqual(reasons(run([{ from: h, to: '한서린', m, quote: '글에 없는 문장입니다' }])), [['rename', '인용이 원문에 없음']]);
  assert.deepEqual(reasons(run([{ from: h, to: '한서린', m: tagOf(input, 1), quote: '붉은 코트의 여자가' }])), [['rename', '확정 구간 밖 메시지']]);
  assert.deepEqual(reasons(run([{ from: h, to: '붉은 코트', m, quote: '한서린이라고 해요' }])), [['rename', '같은 이름']]);
  assert.deepEqual(reasons(run([{ from: h, to: '한서린', m, quote: '한서린이라고 해요' }], { exclude: ['한서린'] })), [['rename', '주인공']]);
  store.ignored.push('한서린');
  assert.deepEqual(reasons(run([{ from: h, to: '한서린', m, quote: '한서린이라고 해요' }])), [['rename', '사용자가 무시한 이름']]);
  assert.ok(store.people[h].provisional && !store.people.한서린, '버린 것은 아무것도 바꾸지 않는다');
  // 다시 읽기(only)에서는 받지 않는다
  store.ignored = [];
  const rep = run([{ from: h, to: '한서린', m, quote: '한서린이라고 해요' }], { only: ['김철수'], keepRead: true });
  assert.deepEqual(rep.applied.renamed, []);
  assert.ok(store.people[h]);
  // 형식이 목록이 아니면 응답 오류
  assert.throws(() => U.parseUpdate('{"renames":{"from":"a"}}'));
  assert.deepEqual(U.parseUpdate('{"renames":null,"present":null}'), {});
});

test('이름 옮기기: 등록을 기다리던 호칭이면 기다리던 줄을 이름으로 옮긴다', () => {
  const mk = () => {
    const x = handleSetup();
    delete x.store.people[x.h];
    x.store.pending[x.h] = { anchor: 'c1', aliases: ['붉은 코트'], provisional: true };
    const input = U.buildUpdate(x.c, x.store, [3], { settings: x.s, system: '', values: {}, names: Sel.namesWith(x.store, B.allNames()) });
    return { ...x, input, m: tagOf(input, 3) };
  };
  const rename = (x) => [{ from: x.h, to: '한서린', m: x.m, quote: '한서린이라고 해요' }];
  // 확인 뒤 등록: 이름으로 대기 (호칭은 별명으로 넘기지 않고, 호칭 표시도 없음)
  let x = mk();
  assert.deepEqual(x.input.data.held_names, [x.h]);
  let rep = U.applyUpdate(x.store, x.c, x.input, { renames: rename(x) }, { settings: settings({ $pp_newpeople: 'confirm' }) });
  assert.deepEqual(rep.applied.newPeople, []);
  assert.ok(!x.store.pending[x.h]);
  assert.deepEqual(x.store.pending.한서린, { anchor: 'c2', aliases: [] });
  assert.ok(!('provisional' in x.store.pending.한서린));
  // 자동: 그 이름으로 등록 (대기 줄의 응답과 다른 응답에서 밝혀졌으니 2턴 규칙도 지난다)
  for (const vars of [{}, { $pp_twoturn: '1' }]) {
    x = mk();
    rep = U.applyUpdate(x.store, x.c, x.input, { renames: rename(x) }, { settings: settings(vars), sheetOf: () => null, baseOf: () => ({}) });
    assert.deepEqual(rep.applied.newPeople, ['한서린']);
    assert.deepEqual(rep.applied.renamed, [], '기록을 옮긴 것이 아니라 새로 등록한 것');
    assert.ok(!x.store.people.한서린.provisional);
    assert.deepEqual(x.store.people.한서린.aliases, []);
    assert.deepEqual(x.store.pending, {});
  }
  // 이름에 기록이 이미 있으면 기다리던 줄만 없앤다. 같은 응답의 항목은 옛 호칭으로 와도 그 기록에 붙는다
  x = mk();
  rep = U.applyUpdate(x.store, x.c, x.input, { renames: [{ from: x.h, to: '김철수', m: x.m, quote: '김철수가 눈을 떴다' }], entries: [{ who: x.h, slot: 'state', op: 'add', text: '눈을 떴다', m: x.m, quote: '김철수가 눈을 떴다' }] }, { settings: x.s });
  assert.deepEqual(x.store.people.김철수.aliases, []);
  assert.deepEqual(x.store.pending, {});
  assert.equal(rep.applied.entries, 1);
  assert.ok(x.store.people.김철수.slots.state.some((e) => e.text === '눈을 떴다'));
  // 이름으로 올라온 대기 줄은 옮길 수 없다
  x = mk();
  delete x.store.pending[x.h].provisional;
  rep = U.applyUpdate(x.store, x.c, x.input, { renames: rename(x) }, { settings: x.s });
  assert.deepEqual(rep.dropped.map((d) => d.reason), ['호칭으로 적어 둔 인물이 아님']);
});

test('이름 옮기기: 옮긴 뒤에는 옛 호칭으로 그 기록을 고르지도 풀지도 않는다 (같은 말로 적힌 다른 사람은 새 인물)', () => {
  const c = chat(['user', '골목으로 들어갔다', 'u1'], ['char', '여자가 다가왔다. "따라와."', 'c1'], ['user', '이름을 물었다', 'u2'], ['char', '여자는 자신을 한소라라고 소개하고 떠났다.', 'c2']);
  const store = T.emptyStore();
  const s = settings();
  const ctx = { settings: s, sheetOf: () => null, baseOf: () => ({}) };
  const build = (ch, at) => U.buildUpdate(ch, store, [at], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames()) });
  let input = build({ message: c.message.slice(0, 2) }, 1);
  U.applyUpdate(store, { message: c.message.slice(0, 2) }, input, { new_people: [{ name: '여자', aliases: ['낯선 여자'], m: tagOf(input, 1), quote: '여자가 다가왔다', identity: '미확인', provisional: true }], present: ['여자'] }, ctx);
  assert.equal(store.people.여자.provisional, true);
  input = build(c, 3);
  assert.deepEqual(input.people, ['여자']);
  let rep = U.applyUpdate(store, c, input, { renames: [{ from: '여자', to: '한소라', m: tagOf(input, 3), quote: '한소라라고 소개하고' }], present: [] }, ctx);
  assert.deepEqual(rep.applied.renamed, [{ from: '여자', to: '한소라' }]);
  assert.deepEqual(store.people.한소라.aliases, []);
  // 다음 응답: 같은 말로 적힌 다른 사람
  const c3 = { message: [...c.message, { role: 'user', data: '시장으로 갔다', chatId: 'u3' }, { role: 'char', data: '시장에서 처음 보는 여자가 말을 걸었다. "길 좀 물을게요."', chatId: 'c3' }] };
  assert.deepEqual(Sel.scenePeople(c3, store, Sel.nameMatcher(Sel.entriesOf(store, B.extraNames()))), [], '본편 요청의 장면 인물로 고르지 않는다');
  input = build(c3, 5);
  assert.deepEqual(input.people, [], '갱신기의 장면 인물로도 고르지 않는다');
  assert.equal(input.data.handles, undefined);
  assert.equal(U.resolveName('여자', store, input.names), null);
  const m = tagOf(input, 5);
  rep = U.applyUpdate(store, c3, input, { new_people: [{ name: '여자', aliases: [], m, quote: '처음 보는 여자가 말을 걸었다', identity: '미확인', provisional: true }], entries: [{ who: '여자', slot: 'state', op: 'add', text: '시장에서 길을 묻는 중', m, quote: '길 좀 물을게요' }], present: ['여자'] }, ctx);
  assert.deepEqual(rep.dropped, []);
  assert.deepEqual(rep.applied.newPeople, ['여자']);
  assert.equal(store.people.여자.provisional, true);
  assert.ok(store.people.여자.slots.state.some((e) => e.text === '시장에서 길을 묻는 중'));
  assert.ok(!(store.people.한소라.slots.state ?? []).some((e) => e.text === '시장에서 길을 묻는 중'));
  assert.deepEqual(store.scene.c3, ['여자']);
});

test('이름 옮기기: 호칭끼리 합치면(받는 쪽도 호칭 기록) 옛 호칭과 그 별명을 별명으로 받는다', () => {
  const x = handleSetup();
  x.store.people['모자 쓴 사람'] = npc('모자 쓴 사람', { provisional: true });
  const rep = U.applyUpdate(x.store, x.c, x.input, { renames: [{ from: x.h, to: '모자 쓴 사람', m: x.m, quote: '여자가 웃었다' }] }, { settings: x.s });
  assert.deepEqual(rep.applied.renamed, [{ from: x.h, to: '모자 쓴 사람' }]);
  const p = x.store.people['모자 쓴 사람'];
  assert.equal(p.provisional, true);
  assert.deepEqual([...p.aliases].sort(), [x.h, '붉은 코트'].sort());
  // 그 기록의 이름이 밝혀지면 모아 둔 호칭은 넘어가지 않는다
  assert.ok(S.renamePerson(x.store, '모자 쓴 사람', '한서린', npc('한서린')));
  assert.deepEqual(x.store.people.한서린.aliases, []);
});

test('이름 옮기기: 같은 응답의 다음 턴 메모는 새 이름으로도 옛 호칭으로도 받는다', () => {
  const x = handleSetup();
  x.store.people.이영호 = npc('이영호');
  const s = settings({ $pp_director: 'note' });
  const input = U.buildUpdate(x.c, x.store, [3], { settings: s, system: '', values: {}, names: Sel.namesWith(x.store, B.allNames()) });
  assert.ok(input.people.includes(x.h) && !input.people.includes('이영호'));
  const rep = U.applyUpdate(x.store, x.c, input, {
    renames: [{ from: x.h, to: '한서린', m: tagOf(input, 3), quote: '한서린이라고 해요' }],
    next_note: [{ who: '한서린', now: '이름을 밝히고 웃고 있다' }, { who: x.h, now: '맞은편에 앉아 있다' }, { who: '이영호', now: '자리에 없다' }],
  }, { settings: s });
  assert.equal(rep.applied.notes, 2);
  assert.deepEqual(rep.dropped.map((d) => [d.kind, d.who, d.reason]), [['note', '이영호', '장면 인물이 아님']]);
  assert.ok(x.store.log.filter((c) => c.kind === 'note').every((c) => c.who === '한서린'));
});

test('새 인물·이름 옮기기: 이름 표의 다른 표기(영문 표기)로 온 이름은 표의 이름으로 받는다', () => {
  const roster = H.rosterOf(LORE);
  const [a, b] = roster;
  const c = chat(['user', '문을 열었다', 'u1'], ['char', '붉은 눈의 여자가 서 있었다. "들어와."', 'c1']);
  const mk = (exclude = []) => {
    const store = T.emptyStore();
    store.people['붉은 눈의 여자'] = npc('붉은 눈의 여자', { provisional: true });
    const input = U.buildUpdate(c, store, [1], { settings: settings(), system: '', values: {}, names: Sel.namesWith(store, B.allNames(roster)), roster, exclude });
    const ctx = { settings: settings(), exclude, sheetOf: () => null, baseOf: (n) => B.seedBaseFor(n, 'A00', undefined, roster.find((r) => r.name === n)) };
    return { store, input, m: tagOf(input, 1), ctx };
  };
  // 새 인물: 영문 표기로 올려도 명부의 이름으로 기록을 만든다 (나중에 이름·초상 태그로 나와도 기록이 하나)
  let x = mk();
  let rep = U.applyUpdate(x.store, c, x.input, { new_people: [{ name: a.english, aliases: [], m: x.m, quote: '붉은 눈의 여자가', identity: '미확인' }] }, x.ctx);
  assert.deepEqual(rep.applied.newPeople, [a.name]);
  assert.ok(x.store.people[a.name].aliases.includes(a.english) && !x.store.people[a.english]);
  assert.deepEqual(H.seedAppearing(x.store, chat(...c.message.map((msg) => [msg.role, msg.data, msg.chatId]), ['user', '?', 'u2'], ['char', `<img=${a.english}_smirk>`, 'c2']), [3], () => null, { roster }), [], '초상 태그가 떠도 기록을 또 만들지 않는다');
  // 유저가 연기하는 요원은 영문 표기로 와도 받지 않는다
  x = mk([a.name]);
  rep = U.applyUpdate(x.store, c, x.input, { new_people: [{ name: a.english, aliases: [], m: x.m, quote: '붉은 눈의 여자가', identity: '미확인' }] }, x.ctx);
  assert.deepEqual(rep.dropped.map((d) => d.reason), ['주인공']);
  assert.deepEqual(Object.keys(x.store.people), ['붉은 눈의 여자']);
  // 이름 옮기기의 to 도 같다
  x = mk();
  rep = U.applyUpdate(x.store, c, x.input, { renames: [{ from: '붉은 눈의 여자', to: b.english, m: x.m, quote: '붉은 눈의 여자가' }] }, x.ctx);
  assert.deepEqual(rep.applied.renamed, [{ from: '붉은 눈의 여자', to: b.name }]);
  assert.deepEqual(Object.keys(x.store.people), [b.name]);
  x = mk([b.name]);
  rep = U.applyUpdate(x.store, c, x.input, { renames: [{ from: '붉은 눈의 여자', to: b.english, m: x.m, quote: '붉은 눈의 여자가' }] }, x.ctx);
  assert.deepEqual(rep.dropped.map((d) => d.reason), ['주인공']);
  assert.deepEqual(Object.keys(x.store.people), ['붉은 눈의 여자']);
});

test('등록 대기: 호칭 표시는 다시 올 때 빠져도 남고, 근거 응답이 사라진 줄은 버린다', () => {
  const h = '모자 쓴 남자';
  const c1 = chat(['user', '역으로 갔다', 'u1'], ['char', '모자 쓴 남자가 길을 막았다.', 'c1']);
  const c2 = chat(...c1.message.map((m) => [m.role, m.data, m.chatId]), ['user', '비키라고 했다', 'u2'], ['char', '모자 쓴 남자가 웃었다.', 'c2']);
  const item = (input, i, quote, extra = {}) => ({ name: h, aliases: [], m: tagOf(input, i), quote, identity: '미확인', ...extra });
  const first = (vars) => {
    const store = T.emptyStore();
    const s = settings(vars);
    const input = U.buildUpdate(c1, store, [1], { settings: s, system: '', values: {}, names: [] });
    U.applyUpdate(store, c1, input, { new_people: [item(input, 1, '모자 쓴 남자가 길을', { provisional: true })] }, { settings: s });
    assert.equal(store.pending[h].provisional, true);
    return { store, s };
  };
  const second = (x, c, i, quote, s = x.s) => {
    const input = U.buildUpdate(c, x.store, [i], { settings: s, system: '', values: {}, names: [] });
    return { input, rep: U.applyUpdate(x.store, c, input, { new_people: [item(input, i, quote)] }, { settings: s }) };
  };
  // 2턴 규칙: 두 번째에 표시 없이 와도 호칭 기록으로 등록한다
  let x = first({ $pp_twoturn: '1' });
  let r = second(x, c2, 3, '모자 쓴 남자가 웃었다');
  assert.deepEqual(r.input.data.held_names, [h]);
  assert.deepEqual(r.input.data.handles, [h], '기다리는 호칭도 호칭 목록에 있다');
  assert.deepEqual(r.rep.applied.newPeople, [h]);
  assert.equal(x.store.people[h].provisional, true);
  // 확인 뒤 등록: 다시 와도 대기 줄의 표시가 남는다 (등록 화면이 기록으로 옮긴다)
  x = first({ $pp_newpeople: 'confirm' });
  r = second(x, c2, 3, '모자 쓴 남자가 웃었다');
  assert.deepEqual(x.store.pending[h], { anchor: 'c2', aliases: [], provisional: true });
  // 그 사이 설정을 끄면 기다리던 호칭도 받지 않는다
  x = first({ $pp_twoturn: '1' });
  r = second(x, c2, 3, '모자 쓴 남자가 웃었다', settings({ $pp_twoturn: '1', $pp_new_unnamed: '0' }));
  assert.equal(r.input.data.held_names, undefined);
  assert.deepEqual(r.rep.dropped.map((d) => d.reason), ['이름 없는 인물 기록 꺼짐']);
  // 다시 굴림 (같은 턴의 응답이 새 chatId 로 바뀜): 사라진 응답은 「처음 본 것」으로 세지 않는다 — 다시 대기
  x = first({ $pp_twoturn: '1' });
  const rolled = chat(['user', '역으로 갔다', 'u1'], ['char', '모자 쓴 남자가 길을 막았다. 다시.', 'c1b']);
  r = second(x, rolled, 1, '모자 쓴 남자가 길을');
  assert.equal(r.input.data.held_names, undefined, '지운 응답에서만 나온 이름은 자료에 싣지 않는다');
  assert.deepEqual(r.rep.applied.newPeople, []);
  assert.ok(r.rep.held.some((d) => d.who === h && d.reason === '2턴 규칙: 대기'));
  assert.equal(x.store.pending[h].anchor, 'c1b');
  // 응답을 지우고 다른 이야기가 이어짐: 대기 줄이 없어진다
  x = first({ $pp_twoturn: '1' });
  const other = chat(['user', '집으로 갔다', 'u9'], ['char', '집은 조용했다.', 'c9']);
  const input = U.buildUpdate(other, x.store, [1], { settings: x.s, system: '', values: {}, names: [] });
  assert.equal(input.data.held_names, undefined);
  U.applyUpdate(x.store, other, input, {}, { settings: x.s });
  assert.deepEqual(x.store.pending, {});
});

test('처음 등장: 같은 이름으로 등록을 기다리던 줄은 기록이 생길 때 없어진다', () => {
  const roster = H.rosterOf(LORE);
  const name = roster[0].name;
  const c = chat(['user', '문을 열었다', 'u1'], ['char', '붉은 눈의 여자가 서 있었다.', 'c1'], ['user', '누구냐고 물었다', 'u2'], ['char', `"${name}." 여자가 말했다.`, 'c2']);
  const store = T.emptyStore();
  // 명부 대조로 먼저 올라와 기다리던 줄 (2턴 규칙·확인 뒤 등록)
  store.pending[name] = { anchor: 'c1', aliases: ['붉은 눈'] };
  assert.deepEqual(H.seedAppearing(store, c, [3], () => null, { roster }), [name]);
  assert.deepEqual(store.pending, {});
  assert.ok(store.people[name].aliases.includes('붉은 눈') && store.people[name].aliases.includes(roster[0].english));
  const input = U.buildUpdate(c, store, [3], { settings: settings(), system: '', values: {}, names: Sel.namesWith(store, B.allNames(roster)), roster });
  assert.equal(input.data.held_names, undefined);
});

test('설정 「항상 포함할 인물」: 옮긴 호칭을 새 이름으로 고쳐 적는다', () => {
  const renamed = [{ from: '붉은 코트의 여자', to: '한서린' }];
  assert.equal(H.renameAlways('쟈알디, 붉은 코트의 여자', renamed), '쟈알디, 한서린');
  assert.equal(H.renameAlways('붉은 코트의 여자\n한서린', renamed), '한서린', '겹치면 하나로');
  assert.equal(H.renameAlways('쟈알디', renamed), null, '적혀 있지 않으면 그대로');
  assert.equal(H.renameAlways('', renamed), null);
  assert.equal(H.renameAlways('붉은 코트의 여자', []), null);
});

test('장면 인물 유지: 갱신기가 답한 장면 인물을 응답에 적어 두고, 다음 요청·다음 갱신에 넣는다', () => {
  const c = chat(['user', '지하철을 탔다', 'u1'], ['char', '한서린이 맞은편에 앉았다. 김철수는 졸고 있었다.', 'c1'], ['user', '창밖을 봤다', 'u2']);
  const store = T.emptyStore();
  store.people.한서린 = npc('한서린', { aliases: ['서린'] });
  store.people.김철수 = npc('김철수');
  store.people.이영호 = npc('이영호');
  const s = settings();
  const names = () => Sel.namesWith(store, B.allNames());
  const input = U.buildUpdate(c, store, [1], { settings: s, system: '', values: {}, names: names() });
  assert.equal(input.data.scene_before, undefined, '앞 응답이 없으면 싣지 않는다');
  const rep = U.applyUpdate(store, c, input, { present: ['서린', '없는 사람', '한서린'] }, { settings: s });
  assert.deepEqual(rep.dropped, []);
  assert.deepEqual(store.scene, { c1: ['한서린'] }, '기록 이름으로 풀고, 기록이 없는 이름은 뺀다');
  assert.deepEqual(Sel.carriedScene(store, c), ['한서린']);
  // 다음 메인 요청: 요청이 훑는 최근 글에 이름이 없어도 들어간다 (글에 나온 사람 뒤)
  const next = { message: [...c.message, { role: 'char', data: '여자는 말없이 창밖을 봤다. 김철수는 졸고 있었다.', chatId: 'c2' }, { role: 'user', data: '김철수를 깨웠다', chatId: 'u3' }] };
  const st = S.peopleStore({ [T.PEOPLE_KEY]: JSON.parse(JSON.stringify(store)) });
  const inNext = U.buildUpdate(next, st, [3], { settings: s, system: '', values: {}, names: Sel.namesWith(st, B.allNames()) });
  U.applyUpdate(st, next, inNext, { present: ['한서린', '김철수'] }, { settings: s });
  const o = { settings: s, store: st, sheetOf: () => null, input: '김철수를 깨웠다' };
  assert.deepEqual(R.peopleBlockFor(next, o).people, ['김철수', '한서린']);
  assert.deepEqual(R.peopleBlockFor(next, { ...o, settings: settings({ $pp_scene_carry: '0' }) }).people, ['김철수']);
  // 다음 갱신: 이름 없이 이어지는 응답에서도 그 인물을 읽고, 앞 응답의 장면 인물을 자료로 알린다
  const c2 = { message: [...c.message, { role: 'char', data: '여자는 말없이 창밖을 봤다. 이영호가 올라탔다.', chatId: 'c2' }] };
  const input2 = U.buildUpdate(c2, store, [3], { settings: s, system: '', values: {}, names: names() });
  assert.deepEqual(input2.people, ['이영호', '한서린'], '글에 나온 사람 뒤에 넣는다');
  assert.deepEqual(input2.data.scene_before, ['한서린']);
  const off = U.buildUpdate(c2, store, [3], { settings: settings({ $pp_scene_carry: '0' }), system: '', values: {}, names: names() });
  assert.deepEqual(off.people, ['이영호']);
  assert.equal(off.data.scene_before, undefined);
  // 빈 목록도 답이다 (아무도 남지 않음). 답에 present 가 없으면 적지 않는다
  U.applyUpdate(store, c2, input2, {}, { settings: s });
  assert.ok(!('c2' in store.scene));
  assert.deepEqual(Sel.carriedScene(store, c2), [], '마지막 응답에 적힌 것이 없으면 이어 가지 않는다');
  U.applyUpdate(store, c2, input2, { present: [] }, { settings: s });
  assert.deepEqual(store.scene.c2, []);
  // 설정을 끄면 적지 않는다. 다시 읽기(only)도 적지 않는다
  const store2 = S.peopleStore({ [T.PEOPLE_KEY]: JSON.parse(JSON.stringify(store)) });
  delete store2.scene;
  U.applyUpdate(store2, c2, input2, { present: ['한서린'] }, { settings: settings({ $pp_scene_carry: '0' }) });
  U.applyUpdate(store2, c2, input2, { present: ['한서린'] }, { settings: s, only: ['한서린'], keepRead: true });
  assert.equal(store2.scene, undefined);
});

test('장면 인물 유지: 다시 굴리거나 고친 응답의 목록은 쓰지 않고, 사라진 응답의 목록은 버린다', () => {
  const c = chat(['user', '지하철을 탔다', 'u1'], ['char', '한서린이 맞은편에 앉았다.', 'c1'], ['user', '창밖을 봤다', 'u2'], ['char', '여자는 말이 없었다. 김철수가 올라탔다.', 'c2']);
  const store = T.emptyStore();
  store.people.한서린 = npc('한서린');
  store.people.김철수 = npc('김철수');
  store.scene = { c1: ['한서린'], c2: ['한서린', '김철수'] };
  S.markRead(store, c, [1, 3]);
  assert.deepEqual(Sel.carriedScene(store, c), ['한서린', '김철수']);
  assert.deepEqual(Sel.carriedScene(store, c, 3), ['한서린'], '묶음 앞의 마지막 응답');
  // 저장 뒤 다시 읽어도 같다
  assert.deepEqual(S.peopleStore({ [T.PEOPLE_KEY]: JSON.parse(JSON.stringify(store)) }).scene, store.scene);
  // 응답을 고침 (같은 chatId, 다른 글): 읽음 해시가 달라져 쓰지 않는다. 그림 태그만 붙은 것은 같은 글이다
  const edited = { message: c.message.map((m, i) => (i === 3 ? { ...m, data: '아무도 없었다.' } : m)) };
  assert.deepEqual(Sel.carriedScene(store, edited), []);
  const tagged = { message: c.message.map((m, i) => (i === 3 ? { ...m, data: `${m.data}\n<img=Someone_smile>` } : m)) };
  assert.deepEqual(Sel.carriedScene(store, tagged), ['한서린', '김철수']);
  // 갱신기가 아직 읽지 않은 응답
  const unread = { message: [...c.message, { role: 'user', data: '?', chatId: 'u3' }, { role: 'char', data: '새 응답.', chatId: 'c3' }] };
  assert.deepEqual(Sel.carriedScene(store, unread), []);
  // 마지막 응답을 지움(다시 굴리기 전): 그 앞 응답의 목록으로
  const rolled = { message: c.message.slice(0, 3) };
  assert.deepEqual(Sel.carriedScene(store, rolled), ['한서린']);
  S.pruneScene(store, rolled);
  assert.deepEqual(store.scene, { c1: ['한서린'] });
  // 기록이 없어진 이름은 빠진다
  delete store.people.한서린;
  assert.deepEqual(Sel.carriedScene(store, rolled), []);
  S.pruneScene(store, { message: [] });
  assert.equal(store.scene, undefined);
});

test('장면 인물 유지: 응답을 다시 읽으면 옛 목록은 지운다 (답에 present 가 없거나 설정이 꺼져 있어도 옛 내용의 목록이 남지 않는다)', () => {
  const c = chat(['user', '지하철을 탔다', 'u1'], ['char', '한서린이 맞은편에 앉았다.', 'c1'], ['user', '창밖을 봤다', 'u2'], ['char', '여자는 말이 없었다. 김철수가 올라탔다.', 'c2']);
  const edited = { message: c.message.map((m, i) => (i === 3 ? { ...m, data: '여자는 내렸고 객차에는 아무도 없었다.' } : m)) };
  const mk = () => {
    const store = T.emptyStore();
    store.people.한서린 = npc('한서린');
    store.people.김철수 = npc('김철수');
    store.scene = { c1: ['한서린'], c2: ['한서린', '김철수'] };
    S.markRead(store, c, [1, 3]);
    return store;
  };
  const run = (store, batch, result, s = settings(), ctx = {}) => {
    const input = U.buildUpdate(edited, store, batch, { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames()) });
    U.applyUpdate(store, edited, input, result, { settings: s, ...ctx });
  };
  // 고친 응답을 다시 읽었는데 답에 present 가 없다: 옛 목록이 새 내용에 붙지 않는다
  let store = mk();
  assert.deepEqual(Sel.carriedScene(store, edited), [], '읽기 전: 해시가 달라 쓰지 않는다');
  run(store, [3], {});
  assert.deepEqual(store.scene, { c1: ['한서린'] });
  assert.deepEqual(Sel.carriedScene(store, edited), []);
  assert.deepEqual(R.peopleBlockFor(edited, { settings: settings(), store, sheetOf: () => null, input: '둘러봤다' }).people, []);
  // 설정을 끈 채 다시 읽고 나중에 켠 경우도 같다
  store = mk();
  run(store, [3], { present: ['한서린'] }, settings({ $pp_scene_carry: '0' }));
  assert.deepEqual(store.scene, { c1: ['한서린'] });
  assert.deepEqual(Sel.carriedScene(store, edited), []);
  // 여러 응답을 한 묶음으로 다시 읽으면 묶음의 옛 목록을 전부 지우고 마지막 응답에만 새로 적는다
  store = mk();
  run(store, [1, 3], { present: ['김철수'] });
  assert.deepEqual(store.scene, { c2: ['김철수'] });
  store = mk();
  run(store, [1, 3], {});
  assert.equal(store.scene, undefined);
  // 다시 읽기(only)는 읽음 표시를 바꾸지 않으니 목록도 그대로 둔다
  store = mk();
  run(store, [3], { present: [] }, settings(), { only: ['김철수'], keepRead: true });
  assert.deepEqual(store.scene, { c1: ['한서린'], c2: ['한서린', '김철수'] });
});

/** 갱신 한 번을 호스트 길 그대로 돌린다 (가짜 risuai: 채팅 하나, 모델 응답은 answer 가 자료를 보고 만든다). 저장된 채팅과 모델 호출 수를 돌려준다 */
async function hostRun(chat0, answer, o = {}) {
  let saved = JSON.parse(JSON.stringify(chat0));
  let calls = 0;
  globalThis.risuai = {
    getCurrentCharacterIndex: async () => 0,
    getCurrentChatIndex: async () => 0,
    getCharacterFromIndex: async () => ({ chaId: 'host-test', name: 'test', globalLore: o.lore ?? [] }),
    getChatFromIndex: async () => JSON.parse(JSON.stringify(saved)),
    setChatToIndex: async (_c, _i, next) => { saved = JSON.parse(JSON.stringify(next)); },
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
    parseRisuChat: async () => '',
    getRootDocument: async () => null,
    runLLMModel: async (req) => {
      calls++;
      const data = JSON.parse(req.messages.at(-1).content);
      return { type: 'success', result: JSON.stringify(answer(data, data.span.filter((x) => x.confirmed && x.role === 'assistant').at(-1).m)) };
    },
  };
  try {
    const result = await H.requestPeopleUpdate(o.reason ?? 'turn', o.opts ?? {});
    return { result, chat: saved, calls };
  } finally {
    delete globalThis.risuai;
  }
}
// 소지품 읽기·상점 판단은 꺼 둔다 (인물이 없는 응답에서 갱신기를 부르는 다른 까닭을 없앤다)
const HOST_VARS = { $it_auto: '0', $sh_judge: 'main' };

test('호스트: 이름을 옮긴 갱신에 가계부 거래가 같이 있어도 「항상 포함할 인물」이 새 이름으로 저장된다', async () => {
  const h = '붉은 코트의 여자';
  const store = T.emptyStore();
  store.people[h] = npc(h, { provisional: true });
  const c = { ...chat(['user', '지하철을 탔다', 'u1'], ['char', '붉은 코트의 여자가 "한서린이라고 해요." 하고 말했다. 커피값 4,500원을 냈다.', 'c1']), scriptstate: { ...HOST_VARS, $pp_always: `쟈알디, ${h}` }, [T.PEOPLE_KEY]: store };
  const { result, chat: after } = await hostRun(c, (_data, m) => ({ renames: [{ from: h, to: '한서린', m, quote: '한서린이라고 해요' }], transactions: [{ amount: -4500, memo: '커피', m, quote: '커피값 4,500원을 냈다' }] }));
  assert.deepEqual([result.ran, result.errors], [1, []]);
  assert.deepEqual(Object.keys(S.peopleStore(after).people), ['한서린']);
  assert.ok(Object.keys(after.scriptstate).some((k) => !(k in c.scriptstate)), '거래가 장부에 적혔다');
  assert.equal(after.scriptstate.$pp_always, '쟈알디, 한서린');
  assert.deepEqual(St.peopleSettings(after.scriptstate).always.filter((n) => S.peopleStore(after).people[n]), ['한서린']);
});

test('호스트: 장면 인물이 없는 응답도 여느 갱신은 모델을 부르고, 다시 읽기는 부르지 않는다. 이름으로 나온 명부 인물의 대기 줄은 저장에서도 없어진다', async () => {
  // 기록이 하나도 없는 채팅의 첫 응답: 이름 없는 인물을 호칭으로 등록한다
  const c = { ...chat(['user', '역으로 갔다', 'u1'], ['char', '모자 쓴 남자가 길을 막았다.', 'c1']), scriptstate: { ...HOST_VARS } };
  let r = await hostRun(c, (data, m) => {
    assert.deepEqual(data.people, []);
    return { new_people: [{ name: '모자 쓴 남자', aliases: [], m, quote: '모자 쓴 남자가 길을', identity: '미확인', provisional: true }], present: ['모자 쓴 남자'] };
  });
  assert.equal(r.calls, 1);
  let st = S.peopleStore(r.chat);
  assert.equal(st.people['모자 쓴 남자'].provisional, true);
  assert.deepEqual(st.scene, { c1: ['모자 쓴 남자'] });
  // 다시 읽기(only): 그 인물의 기록이 없으면 부르지 않고 읽음 표시도 그대로
  r = await hostRun(c, () => ({}), { reason: 'reread', opts: { manual: true, scope: { indexes: [1], only: ['없는 사람'] } } });
  assert.equal(r.calls, 0);
  assert.deepEqual(r.result.skipped, ['장면 인물 없음']);
  assert.deepEqual(S.unreadIndexes(r.chat, S.peopleStore(r.chat)), [1]);
  // 명부 대조로 올라와 기다리던 이름이 다음 응답에 이름으로 나옴: 기록이 생기고 대기 줄은 저장된 채팅에서도 없어진다
  const name = H.rosterOf(LORE)[0].name;
  const store = T.emptyStore();
  store.pending[name] = { anchor: 'c1', aliases: [] };
  S.markRead(store, c, [1]);
  const c2 = { ...chat(['user', '역으로 갔다', 'u1'], ['char', '모자 쓴 남자가 길을 막았다.', 'c1'], ['user', '이름을 물었다', 'u2'], ['char', `"${name}." 남자가 말했다.`, 'c2']), scriptstate: { ...HOST_VARS, $pp_newpeople: 'auto' }, [T.PEOPLE_KEY]: store };
  r = await hostRun(c2, (data) => {
    assert.deepEqual(data.people.map((p) => p.name), [name]);
    assert.equal(data.held_names, undefined);
    return {};
  }, { lore: LORE });
  assert.equal(r.calls, 1);
  st = S.peopleStore(r.chat);
  assert.ok(st.people[name]);
  assert.deepEqual(st.pending, {});
  // 「확인 뒤 등록」이면 명부 인물도 기록을 만들지 않고 대기 줄에 둔다 (설정 설명대로, 전수점검 보통-17)
  const c3 = { ...c2, scriptstate: { ...HOST_VARS, $pp_newpeople: 'confirm' }, [T.PEOPLE_KEY]: JSON.parse(JSON.stringify(store)) };
  r = await hostRun(c3, () => ({}), { lore: LORE });
  st = S.peopleStore(r.chat);
  assert.equal(st.people[name], undefined);
  assert.ok(st.pending[name]);
  // 무시한 이름은 명부에 있어도 기록·대기 줄을 만들지 않는다
  const ig = T.emptyStore();
  ig.ignored.push(name);
  S.markRead(ig, c, [1]);
  r = await hostRun({ ...c2, scriptstate: { ...HOST_VARS, $pp_newpeople: 'auto' }, [T.PEOPLE_KEY]: ig }, () => ({}), { lore: LORE });
  st = S.peopleStore(r.chat);
  assert.equal(st.people[name], undefined);
  assert.equal(st.pending[name], undefined);
});

test('설정 세 줄: 기본 켬, 끄면 지침 절이 바뀐다', () => {
  const keys = ['roster_hint', 'new_unnamed', 'scene_carry'];
  const rows = Def.PEOPLE_SET.groups.flatMap((g) => g.rows);
  for (const k of keys) {
    assert.equal(St.PP_DEFAULTS[k], '1', k);
    const row = rows.find((r) => r.key === k);
    assert.ok(row && row.help, `${k} 정의표`);
    assert.deepEqual(row.ctl, { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] });
    assert.match(k, /^[a-z_]+$/, '기본값 저장(PREF_VAR)에 들어가는 꼴');
  }
  const on = St.peopleSettings({});
  assert.deepEqual([on.rosterHint, on.newUnnamed, on.sceneCarry], [true, true, true]);
  const off = St.peopleSettings({ $pp_roster_hint: '0', $pp_new_unnamed: '0', $pp_scene_carry: '0' });
  assert.deepEqual([off.rosterHint, off.newUnnamed, off.sceneCarry], [false, false, false]);
  const pick = (s) => ['new_named', 'new_unnamed', 'new_roster', 'scene_carry'].filter((k) => U.enabledSections(s).has(k));
  assert.deepEqual(pick(on), ['new_unnamed', 'new_roster', 'scene_carry']);
  assert.deepEqual(pick(off), ['new_named']);
});

test('갱신기 지침: 새 절을 어떻게 켜고 꺼도 표식이 남지 않고 출력 예시의 쉼표가 맞는다', () => {
  for (const prompt of ['detailed', 'compact']) for (const un of ['1', '0']) for (const ro of ['1', '0']) for (const sc of ['1', '0']) {
    const s = St.peopleSettings({ $pp_prompt: prompt, $pp_new_unnamed: un, $pp_roster_hint: ro, $pp_scene_carry: sc });
    const text = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '', 'ko', '', '');
    const tag = `${prompt} 이름없는=${un} 명부=${ro} 장면=${sc}`;
    assert.ok(!/<<(SECTION|END):/.test(text), `${tag}: 표식 없음`);
    const a = text.indexOf('{"entries"');
    const b = text.indexOf('\nLimits:');
    assert.ok(a >= 0 && b > a, `${tag}: 출력 절`);
    // 자리표(<…>)를 값으로 바꾸면 JSON 으로 읽혀야 한다
    const json = text.slice(a, b).trim().replace(/<true\|false>/g, 'true').replace(/<[^">]*or null>/g, 'null').replace(/:<[^">]+>/g, ':0');
    let obj;
    assert.doesNotThrow(() => { obj = JSON.parse(json); }, `${tag}: 출력 예시`);
    assert.equal('renames' in obj, un === '1', `${tag}: renames`);
    assert.equal('provisional' in obj.new_people[0], un === '1', `${tag}: provisional`);
    assert.equal('present' in obj, sc === '1', `${tag}: present`);
    assert.equal(/`handles`/.test(text), un === '1', `${tag}: handles 설명`);
    assert.equal(/`renames`/.test(text), un === '1', `${tag}: renames 설명`);
    assert.equal(/`roster`/.test(text), ro === '1', `${tag}: roster 설명`);
    assert.equal(/`scene_before`/.test(text), sc === '1', `${tag}: scene_before 설명`);
    assert.equal(/`present`/.test(text), sc === '1', `${tag}: present 설명`);
    for (const k of ['known_names', 'held_names', 'portraits']) assert.ok(text.includes(`\`${k}\``), `${tag}: ${k} 설명`);
    const four = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'));
    assert.ok(four.length > 0 && !/ [,.;]| {2}|\(\s*\)/.test(four), `${tag}: 4절 문장이 끊기지 않음`);
    assert.equal((four.match(/in `new_people`\. /g) ?? []).length >= 1, true, `${tag}: 새 인물 찾기 문장은 하나는 있다`);
    // 호칭으로 적어 둔 인물에게 초상이 뜬 경우의 이름 옮기기 규칙은 이름 없는 인물 기록이 켜져 있을 때만 있다
    assert.equal(four.split('\n').some((line) => line.includes('`renames`') && line.includes('`portraits`')), un === '1', `${tag}: 초상으로 이름 옮기기`);
  }
});

test('메인 요청·Router: 호칭 기록은 이름이 아니라는 표시가 붙는다', () => {
  const c = chat(['user', '지하철을 탔다', 'u1'], ['char', '붉은 코트의 여자가 맞은편에 앉았다. 김철수는 졸고 있었다.', 'c1']);
  const store = T.emptyStore();
  store.people['붉은 코트의 여자'] = npc('붉은 코트의 여자', { provisional: true });
  store.people.김철수 = npc('김철수');
  const note = G.guideTxt('Main', 'PEOPLE.BLOCK.PROVISIONAL', { name: '붉은 코트의 여자' });
  assert.ok(note.includes('붉은 코트의 여자') && note.trim().length > 20);
  const live = S.liveness(c);
  const block = Inj.personBlock(store.people['붉은 코트의 여자'], store, live, []);
  assert.ok(block.split('\n')[1] === note, '머리 바로 아래 줄');
  assert.ok(!Inj.personBlock(store.people.김철수, store, live, []).includes(G.guideTxt('Main', 'PEOPLE.BLOCK.PROVISIONAL', { name: '김철수' })), '이름으로 적은 기록에는 붙지 않는다');
  const text = R.peopleBlockFor(c, { settings: settings(), store, sheetOf: () => null }).text;
  assert.equal(text.split(note).length - 1, 1);
  const router = Ro.buildRouter(c, store, [], '누구세요?');
  const rows = Object.fromEntries(router.data.catalog.map((r) => [r.name, r]));
  assert.equal(rows['붉은 코트의 여자'].provisional, true);
  assert.ok(!('provisional' in rows.김철수));
  assert.match(router.system, /`provisional`/);
});

test('첫 장면은 첫 응답과 같이 읽는다: 「지난 응답 1개 안 읽음」으로 남지 않는다', () => {
  const m = (role, data, chatId) => ({ role, data, chatId });
  const fresh = { message: [m('char', '첫 장면', 'o'), m('user', '가자', 'u1'), m('char', '첫 응답', 'c1')] };
  const st = T.emptyStore();
  assert.deepEqual(S.splitUnread(fresh, st), { newer: [0, 2], older: [] });
  // 이미 첫 응답만 읽고 첫 장면이 남은 채팅: 다음 새 응답과 같이 읽는다
  S.markRead(st, fresh, [2]);
  assert.deepEqual(S.splitUnread(fresh, st), { newer: [], older: [0] }, '새 응답이 없으면 그대로');
  const next = { message: [...fresh.message, m('user', '다음', 'u2'), m('char', '둘째 응답', 'c2')] };
  assert.deepEqual(S.splitUnread(next, st), { newer: [0, 4], older: [] });
  // 기능을 중간에 켠 긴 채팅: 지난 응답은 사용자가 고르는 몫으로 남는다
  const long = { message: [m('char', '첫 장면', 'o'), m('user', '1', 'u1'), m('char', 'a', 'c1'), m('user', '2', 'u2'), m('char', 'b', 'c2')] };
  assert.deepEqual(S.splitUnread(long, T.emptyStore()), { newer: [4], older: [0, 2] });
  // 맨 앞이 사용자 글이면(첫 장면 없음) 해당 없음
  const noScene = { message: [m('user', '1', 'u1'), m('char', 'a', 'c1'), m('user', '2', 'u2'), m('char', 'b', 'c2')] };
  assert.deepEqual(S.splitUnread(noScene, T.emptyStore()), { newer: [3], older: [1] });
});

test('처음 등장: 호칭(주인·의사)만 나온 글로는 기록을 만들지 않고, 이름이 나오면 만든다 (2026-11-22 사용자: 사망단길 본문에서 마덕희·고연지가 생김)', () => {
  const c = chat(['user', '걸었다', 'u1'], ['char', '정육점 주인은 사람 키를 훌쩍 넘었다. 조용히 의사만 밝히자 손이 거두어졌다. 주인 없는 장갑이 떠다녔다.', 'c1']);
  const store = T.emptyStore();
  assert.deepEqual(H.seedAppearing(store, c, [1], () => null, {}), []);
  assert.deepEqual(Object.keys(store.people), []);
  const named = chat(['user', '걸었다', 'u1'], ['char', '마덕희가 금팔찌를 만지작거렸다.', 'c1']);
  assert.deepEqual(H.seedAppearing(store, named, [1], () => null, {}), ['마덕희']);
});
