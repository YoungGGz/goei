// 전수점검 2차 재확인 「05 인물 기록」 P5-2-2·P5-2-3·P5-2-4 고침 시험
// P5-2-2: 이름을 밝힌 응답을 다시 굴리면 이름 옮기기도 되돌아간다 (사용자 2026-11-22: 다시 굴리면 그 응답이 만든 것은 다 되돌아간다)
// P5-2-3: 주인공(페르소나) 이름은 기록하지 않는다 (지침 Router 「never list the user's own character」)
// P5-2-4: Router 재사용 열쇠는 모델과 지침 글 전체를 본다 (Director 와 같다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initTestData } from './data-init.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-3b-'));
const outfile = join(dir, 'bundle.mjs');
const ENTRY = `
export * as U from './src/core/people/updater';
export * as S from './src/core/people/store';
export * as T from './src/core/people/types';
export * as St from './src/core/people/settings';
export * as Sel from './src/core/people/select';
export * as B from './src/core/people/base';
export * as Seed from './src/core/people/seed';
export * as R from './src/core/people/router';
export * as H from './src/host/people';
export * as Pack from './src/core/datapack';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { U, S, T, St, Sel, B, Seed, R, H, Pack } = await import(pathToFileURL(outfile));
initTestData(Pack);

const settings = (vars = {}) => St.peopleSettings({ $pp_prev_pairs: '1', ...vars });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const npc = (name, extra = {}) => ({ ...Seed.seedPerson(name, null, {}, '2026-01-01T00:00:00Z'), ...extra });
const tagOf = (input, index) => [...input.tags].find(([, i]) => i === index)[0];

function setup() {
  const c = chat(
    ['user', '노점에 갔다', 'u1'],
    ['char', '노점 주인이 꼬치를 굽고 있었다. 김철수는 졸고 있었다.', 'c1'],
    ['user', '이름을 물었다', 'u2'],
    ['char', '노점 주인이 웃었다. "제 이름은 대식입니다." 김철수가 눈을 떴다.', 'c2'],
  );
  const store = T.emptyStore();
  const h = '노점 주인';
  store.people[h] = npc(h, { provisional: true });
  store.people.김철수 = npc('김철수');
  S.putEntry(store, h, 'state', { id: 'e-st', text: '꼬치를 굽는 중', src: 'story', anchor: 'c1', seq: 1, quote: '꼬치를 굽고 있었다' });
  S.putEntry(store, '김철수', 'relationship', { id: 'e-rel', text: '단골', src: 'story', anchor: 'c1', seq: 2, quote: '졸고 있었다', target: h });
  S.putChange(store, { id: 'c-cue', anchor: 'c1', seq: 3, src: 'story', who: h, kind: 'cue', cue: T.CUES[0], quote: '꼬치를 굽고 있었다', reason: '첫 만남' });
  S.putDoc(store, 'event', '노점', { id: 'd-1', text: '노점에서 마주침', src: 'story', anchor: 'c1', seq: 4, who: [h, '김철수'] });
  store.folded[h] = 3;
  store.scene = { c1: [h, '김철수'] };
  S.markRead(store, c, [1]);
  const s = settings();
  const input = U.buildUpdate(c, store, [3], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames()) });
  return { c, store, h, s, input, m: tagOf(input, 3) };
}

test('P5-2-2: 이름을 밝힌 응답을 다시 굴리면 이름 옮기기가 되돌아가고, 항상 포함할 인물도 옛 호칭으로', () => {
  const { c, store, h, s, input, m } = setup();
  const rep = U.applyUpdate(store, c, input, { renames: [{ from: h, to: '대식', m, quote: '제 이름은 대식입니다' }] }, { settings: s });
  assert.deepEqual(rep.applied.renamed, [{ from: h, to: '대식' }]);
  assert.ok(store.people.대식 && !store.people[h]);
  const always = H.renameAlways(`${h}, 김철수`, rep.applied.renamed);
  assert.equal(always, '대식, 김철수');
  // 살아 있으면 그대로
  assert.deepEqual(S.undoGoneRenames(store, c), []);
  assert.ok(store.people.대식);
  // c2 를 다시 굴림 (c2b: 이름 안 나옴)
  const c2 = chat(...c.message.slice(0, 3).map((x) => [x.role, x.data, x.chatId]), ['char', '노점 주인이 웃기만 했다.', 'c2b']);
  const back = S.undoGoneRenames(store, c2);
  assert.deepEqual(back, [{ from: '대식', to: h }]);
  assert.ok(!store.people.대식, '사라진 응답에서만 나온 이름의 기록은 없어진다');
  assert.ok(store.people[h]?.provisional, '호칭 기록이 돌아온다');
  assert.ok(store.people[h].slots.state.some((e) => e.id === 'e-st'));
  assert.equal(store.people.김철수.slots.relationship[0].target, h, '다른 인물 항목의 대상도 돌아온다');
  assert.equal(store.log.find((x) => x.id === 'c-cue').who, h);
  assert.equal(store.folded[h], 3);
  assert.equal(store.folded.대식, undefined);
  assert.deepEqual(store.docs['event:노점'].entries[0].who, [h, '김철수']);
  assert.deepEqual(store.scene.c1, [h, '김철수']);
  assert.equal(H.renameAlways(always, back), `${h}, 김철수`);
  assert.equal(store.renames, undefined);
  // 저장했다 읽어도 되돌림 기록이 남는다
  const x = setup();
  U.applyUpdate(x.store, x.c, x.input, { renames: [{ from: x.h, to: '대식', m: x.m, quote: '제 이름은 대식입니다' }] }, { settings: x.s });
  const saved = S.peopleStore(S.withPeople({ message: x.c.message, scriptstate: {} }, x.store));
  assert.deepEqual(S.undoGoneRenames(saved, c2), [{ from: '대식', to: x.h }]);
  assert.ok(saved.people[x.h] && !saved.people.대식);
});

test('P5-2-2: 이미 있던 기록으로 옮긴 것도 되돌리면 그 기록은 옮기기 전 모습으로', () => {
  const { c, store, h, s, input, m } = setup();
  store.people.대식 = npc('대식');
  const rep = U.applyUpdate(store, c, input, { renames: [{ from: h, to: '대식', m, quote: '제 이름은 대식입니다' }] }, { settings: s });
  assert.deepEqual(rep.applied.renamed, [{ from: h, to: '대식' }]);
  assert.ok(store.people.대식.slots.state?.some((e) => e.id === 'e-st'));
  const c2 = chat(...c.message.slice(0, 3).map((x) => [x.role, x.data, x.chatId]), ['char', '조용했다.', 'c2b']);
  S.undoGoneRenames(store, c2);
  assert.ok(store.people.대식 && !store.people.대식.slots.state?.some((e) => e.id === 'e-st'));
  assert.ok(store.people[h].slots.state.some((e) => e.id === 'e-st'));
});

// ── 반박 검토 (11-23): 되돌리면 옮긴 뒤에 쌓인 것이 사라지는 경우는 새 이름으로 둔다 (사라진 응답이 만든 인물을 남기는 기준과 같다) ──
test('P5-2-2: 이름을 밝힌 응답만 지웠는데 뒤의 살아 있는 응답이 그 이름으로 기록을 더했으면 되돌리지 않는다', () => {
  const { c, store, h, s, input, m } = setup();
  U.applyUpdate(store, c, input, { renames: [{ from: h, to: '대식', m, quote: '제 이름은 대식입니다' }] }, { settings: s });
  S.putEntry(store, '대식', 'state', { id: 'e-late', text: '불을 끄는 중', src: 'story', anchor: 'c3', seq: 9, quote: '불을 껐다' });
  // c2 만 지움, c3 는 살아 있음
  const c3 = chat(...c.message.slice(0, 3).map((x) => [x.role, x.data, x.chatId]), ['char', '그가 불을 껐다.', 'c3']);
  assert.deepEqual(S.undoGoneRenames(store, c3), []);
  assert.ok(store.people.대식?.slots.state.some((e) => e.id === 'e-late'), '뒤 응답이 적은 항목이 남는다');
  assert.ok(!store.people[h]);
  assert.equal(store.renames, undefined, '되돌림 기록은 치운다');
});

test('P5-2-2: 옮긴 뒤 사용자가 손댄 기록, 살아 있는 글에 새 이름이 나오는 기록은 되돌리지 않는다', () => {
  const c2 = (text) => chat(['user', '노점에 갔다', 'u1'], ['char', '노점 주인이 꼬치를 굽고 있었다. 김철수는 졸고 있었다.', 'c1'], ['user', '이름을 물었다', 'u2'], ['char', text, 'c2b']);
  const a = setup();
  U.applyUpdate(a.store, a.c, a.input, { renames: [{ from: a.h, to: '대식', m: a.m, quote: '제 이름은 대식입니다' }] }, { settings: a.s });
  S.putEntry(a.store, '대식', 'state', { id: 'e-man', text: '손으로 적음', src: 'manual', anchor: '#0', seq: 9 });
  assert.deepEqual(S.undoGoneRenames(a.store, c2('조용했다.')), []);
  assert.ok(a.store.people.대식 && !a.store.people[a.h]);
  const b = setup();
  U.applyUpdate(b.store, b.c, b.input, { renames: [{ from: b.h, to: '대식', m: b.m, quote: '제 이름은 대식입니다' }] }, { settings: b.s });
  const appears = (names) => new Set(names.filter((n) => n === '대식'));
  assert.deepEqual(S.undoGoneRenames(b.store, c2('"대식이라고 합니다." 그가 다시 말했다.'), undefined, appears), []);
  assert.ok(b.store.people.대식 && !b.store.people[b.h]);
});

test('P5-2-3: 주인공 이름은 페르소나 이름 (캐릭터로 플레이하지 않을 때), 새 인물·이름 힌트·Router 힌트에서 빠진다', () => {
  assert.deepEqual(H.ownNames([], {}, '한서준'), ['한서준']);
  assert.deepEqual(H.ownNames([], {}, ''), []);
  const c = chat(['user', '돌아왔다', 'u1'], ['char', '"한서준 씨, 이제 왔어요?" 한서준은 가방을 내려놓았다. 김철수가 웃었다.', 'c1']);
  const store = T.emptyStore();
  store.people.김철수 = npc('김철수');
  const s = settings();
  const exclude = H.ownNames([], {}, '한서준');
  const input = U.buildUpdate(c, store, [1], { settings: s, system: '', values: {}, names: Sel.namesWith(store, B.allNames()), hints: [{ name: '한서준', aliases: [], quote: '한서준 씨' }], exclude });
  assert.equal(input.data.name_hints, undefined, '주인공은 이름 힌트로 가지 않는다');
  const rep = U.applyUpdate(store, c, input, { new_people: [{ name: '한서준', m: tagOf(input, 1), quote: '한서준은 가방을 내려놓았다' }] }, { settings: s, exclude });
  assert.ok(!store.people.한서준);
  assert.deepEqual(rep.dropped.map((d) => d.reason), ['주인공']);
  const r = R.parseRouter('{"selected":[{"name":"김철수"}],"new_characters":[{"name":"한서준","aliases":[],"quote":"한서준 씨"}]}', store, [], 6, exclude);
  assert.deepEqual(r.newCharacters, [], 'Router 힌트에서도 빠진다');
});

test('P5-2-4: Router 재사용 열쇠는 같은 길이의 다른 덧붙일 지침·다른 모델이면 달라진다', () => {
  const c = chat(['user', '출근', 'u1'], ['char', '김철수가 인사했다.', 'c1']);
  const store = T.emptyStore();
  store.people.김철수 = npc('김철수');
  const key = (rules) => R.buildRouter(c, store, [], '인사했다', { rules }).key;
  assert.equal(key('큐라스는 늘 고른다.'), key('큐라스는 늘 고른다.'));
  assert.notEqual(key('큐라스는 늘 고른다.'), key('에일린은 늘 고른다.'));
  const k = key('');
  assert.notEqual(H.routerCacheKey(k, St.peopleSettings({})), H.routerCacheKey(k, St.peopleSettings({ $pp_model_router: St.peopleSettings({}).stageModel.router === 'main' ? 'aux' : 'main' })));
});
