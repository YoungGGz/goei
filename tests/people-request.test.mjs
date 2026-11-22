import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWithData } from './data-init.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-req-'));
await buildWithData({
  entryPoints: ['src/core/people/request.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/seed.ts', 'src/core/people/base.ts', 'src/core/people/store.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const R = await mod('request');
const T = await mod('types');
const St = await mod('settings');
const Seed = await mod('seed');
const Base = await mod('base');
const Store = await mod('store');

const SHEET = ['### Character - Jyaldi', '#### Identity', '- Role: Chief', '#### Voice', '- Short orders.'].join('\n');

test('요청 가공: 장면 인물 블록을 마지막 유저 메시지 앞에, split 이면 시트 원문은 뺀다', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = Seed.seedPerson('쟈알디', SHEET, { faction: 'A00', address: { toUser: '요원', register: '반말' }, aliases: ['Jyaldi'] });
  const chat = { message: [{ role: 'user', data: '안녕', chatId: 'u1' }, { role: 'char', data: '쟈알디가 왔다.', chatId: 'c1' }, { role: 'user', data: '부장님께 인사', chatId: 'u2' }], scriptstate: {} };
  const msgs = [{ role: 'system', content: `카드\n${SHEET}\n끝` }, { role: 'user', content: '안녕' }, { role: 'assistant', content: '쟈알디가 왔다.' }, { role: 'user', content: '부장님께 인사' }];
  const o = { settings: St.peopleSettings({}), store, sheetOf: () => SHEET, user: '주인공' };
  const out = R.withPeopleBlock(msgs, chat, o);
  assert.equal(out.length, 5);
  assert.equal(out[3].role, 'system');
  assert.match(out[3].content, /\[People records\][\s\S]*## 쟈알디/);
  assert.match(out[3].content, /Voice:\n- Short orders\./, '고정 절은 블록 안에');
  assert.doesNotMatch(out[0].content, /Short orders/, '시트 원문은 요청에서 빠짐');
  assert.match(out[3].content, /Relationship → 주인공/);
  // append 모드: 시트 전체가 블록 안에 있으므로 원래 시트는 빼서 두 번 안 들어간다 (전수검사 11-13)
  const out2 = R.withPeopleBlock(msgs, chat, { ...o, settings: St.peopleSettings({ $pp_inject: 'append' }) });
  assert.doesNotMatch(out2[0].content, /Short orders/, '시트 원문은 요청에서 빠짐');
  assert.equal(out2[3].content.split('Short orders').length - 1, 1, '블록 안에 시트가 한 번');
  // 끔
  // 2026-11-11 사용자: 넣지 않는 선택지(off)는 뺐다. 옛 값이 남아 있으면 기본 방식으로 넣는다
  assert.equal(R.withPeopleBlock(msgs, chat, { ...o, settings: St.peopleSettings({ $pp_inject: 'off' }) }).length, 5);
  // 장면에 없는 인물은 안 넣음
  const chat2 = { message: [{ role: 'user', data: '혼자 걷는다', chatId: 'u1' }], scriptstate: {} };
  assert.equal(R.withPeopleBlock(msgs.slice(0, 2), chat2, o).length, 2);
});

test('미리 만든 자료: 52명, 조직 시작값, 별명 표', () => {
  assert.equal(Object.keys(Base.RELATIONS.people).length, 52);
  assert.equal(Base.userAffinityBase('A00', 'A00'), 0);
  assert.ok(Base.userAffinityBase('A00', 'B00') < 0);
  assert.ok(Base.userAffinityBase('A00', 'E00') < 0, '기본 표(2026-10-27 채움): 관리국 → 프리랜서 경계');
  assert.equal(Base.userAffinityBase('C00', 'E00'), 0, '표에 없는 쌍은 중립');
  const names = Base.allNames();
  const j = names.find((n) => n.name === '쟈알디');
  assert.ok(j.aliases.includes('Jyaldi') && j.titles.includes('부장'));
  assert.ok(Base.valuesOf('쟈알디').length > 10);
});

// 11-14 재검토 ①-1: 몫은 칸 글자만 세고 머리말·관계 줄은 안 세어, 기록이 찬 인물이 둘만 있어도 합이 상한을 넘어 마지막 인물이 통째로 빠졌다
test('상한: 기록이 가득한 2~4명 → 지난 일부터 줄여 전원이 들어가고 합이 상한 이하', () => {
  for (const [count, each] of [[2, 80], [3, 50], [4, 30], [4, 80]]) {
    const store = T.emptyStore();
    const names = ['가람', '나루', '다솜', '라온'].slice(0, count);
    for (const n of names) {
      const p = Seed.seedPerson(n, null, { address: { toUser: '요원', register: '반말' } });
      p.slots.state = [{ id: `${n}-s`, text: `${n} 현재 상태 기록`, anchor: 'c1' }];
      p.slots.history = Array.from({ length: each }, (_, i) => ({ id: `${n}-h${i}`, text: `${n} 지난 일 ${i} ` + '가'.repeat(200), anchor: 'c1' }));
      store.people[n] = p;
    }
    const chat = { message: [{ role: 'user', data: '안녕', chatId: 'u1' }, { role: 'char', data: `${names.join(', ')}가 모였다.`, chatId: 'c1' }], scriptstate: {} };
    const settings = St.peopleSettings({});
    const r = R.peopleBlockFor(chat, { settings, store, sheetOf: () => null, user: '주인공' });
    assert.deepEqual(r.people, names);
    const body = r.text.slice(r.text.indexOf('## '));
    for (const n of names) {
      assert.match(body, new RegExp(`## ${n} `), `${count}명·${each}개: ${n} 블록이 들어감`);
      assert.match(body, new RegExp(`- ${n} 현재 상태 기록`), `${n} 현재 상태가 남음`);
      assert.match(body, new RegExp(`- ${n} 지난 일 ${each - 1} `), `${n} 가장 새 지난 일이 남음`);
    }
    assert.ok(body.length <= settings.blockCap, `${count}명·${each}개: 합 ${body.length} ≤ 상한 ${settings.blockCap}`);
    assert.ok(body.length > settings.blockCap * 0.85, `${count}명·${each}개: 상한을 거의 다 씀 (${body.length})`);
  }
});

// 11-14 재검토 ①-1 검증: 넘친 글자가 항목 하나보다 작으면 몫을 그만큼만 깎아 블록이 그대로였고, 뒤 인물이 통째로 빠졌다
const capPeople = (spec) => {
  const store = T.emptyStore();
  const names = ['가람', '나루', '다솜', '라온', '마루', '바다'].slice(0, spec.length);
  names.forEach((n, k) => {
    const p = Seed.seedPerson(n, null, { address: { toUser: '요원', register: '반말' } });
    p.slots.state = [{ id: `${n}-s`, text: `${n} 현재 상태 기록`, anchor: 'c1' }];
    p.slots.history = Array.from({ length: spec[k][0] }, (_, i) => ({ id: `${n}-h${i}`, text: `${n} 지난 일 ${i} ` + '가'.repeat(spec[k][1]), anchor: 'c1' }));
    store.people[n] = p;
  });
  const chat = { message: [{ role: 'user', data: '안녕', chatId: 'u1' }, { role: 'char', data: `${names.join(', ')}가 모였다.`, chatId: 'c1' }], scriptstate: {} };
  const settings = St.peopleSettings({});
  const r = R.peopleBlockFor(chat, { settings, store, sheetOf: () => null, user: '주인공' });
  return { names, r, body: r.text.slice(r.text.indexOf('## ')), cap: settings.blockCap };
};

test('상한: 2자만 넘쳐도(60×180 과 34×192) 뒤 인물이 통째로 빠지지 않는다', () => {
  const { names, r, body, cap } = capPeople([[60, 180], [34, 192]]);
  assert.deepEqual(r.people, names);
  for (const n of names) assert.match(body, new RegExp(`## ${n} `), `${n} 블록이 들어감`);
  assert.match(body, /- 나루 지난 일 33 /, '나루 가장 새 지난 일이 남음');
  assert.ok(body.length <= cap, `합 ${body.length} ≤ 상한 ${cap}`);
  assert.ok(body.length > cap * 0.95, `한 항목쯤만 줄임 (${body.length})`);
});

test('상한: 무작위 2~6명 — 줄일 지난 일이 남아 있으면 아무도 통째로 빠지지 않는다', () => {
  let seed = 20261114;
  const rnd = (n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
  for (let t = 0; t < 400; t++) {
    const spec = Array.from({ length: 2 + rnd(5) }, () => [1 + rnd(80), 20 + rnd(220)]);
    const { names, body, cap } = capPeople(spec);
    for (const n of names) assert.match(body, new RegExp(`## ${n} `), `${JSON.stringify(spec)}: ${n} 블록이 들어감`);
    assert.ok(body.length <= cap, `${JSON.stringify(spec)}: 합 ${body.length} ≤ 상한 ${cap}`);
  }
});

// ── 토큰 점검 (11-15): 기록 문서 포함·성격 관찰 포함·시트 전체 방식의 겹침·Router 호출 건너뛰기 ──
const twStore = (names) => {
  const store = T.emptyStore();
  for (const n of names) store.people[n] = Seed.seedPerson(n, null, { address: { toUser: '요원', register: '반말' } });
  return store;
};
const twChat = (text) => ({ message: [{ role: 'user', data: '안녕', chatId: 'u1' }, { role: 'char', data: text, chatId: 'c1' }], scriptstate: {} });
const twDoc = (type, key, entries) => ({ type, key, entries: entries.map(([id, text, who], i) => ({ id, text, src: 'story', anchor: 'c1', seq: i + 1, ...(who ? { who } : {}) })) });

test('기록 문서 포함: 기본은 넣지 않고, 켜면 장면과 관련된 문서만 컨텍스트 글자 상한 안에서 넣는다', () => {
  const store = twStore(['나루', '도윤']);
  store.docs['event:정전 사건'] = twDoc('event', '정전 사건', [['d1', '3층 전체가 정전됐다'], ['d2', '비상 발전기로 복구됐다']]);
  store.docs['item:은색 열쇠'] = twDoc('item', '은색 열쇠', [['d3', '나루가 주워서 보관 중', ['나루']]]);
  store.docs['location:옥상'] = twDoc('location', '옥상', [['d4', '출입문이 잠겼다']]);
  store.docs['rhythm:scene'] = twDoc('rhythm', 'scene', [['d5', '준비 국면']]);
  const chat = twChat('나루가 정전 사건 보고서를 들고 왔다.');
  const o = (vars = {}) => ({ settings: St.peopleSettings({ $pp_rhythm: '0', ...vars }), store, sheetOf: () => null, user: '주인공' });
  assert.equal(St.PP_DEFAULTS.docs_inject, '1');
  const off = R.peopleBlockFor(chat, o({ $pp_docs_inject: '0' })).text;
  assert.doesNotMatch(off, /Scene-related records|정전됐다|보관 중/, '끔: 문서는 메인 요청에 없다');
  const on = R.peopleBlockFor(chat, o({ $pp_docs_inject: '1' })).text;
  const docLines = on.slice(on.indexOf('## Scene-related records')).split('\n').slice(1);
  assert.deepEqual([...docLines].sort(), ['- event · 정전 사건: 3층 전체가 정전됐다', '- event · 정전 사건: 비상 발전기로 복구됐다', '- item · 은색 열쇠: 나루가 주워서 보관 중'].sort(), '글에 이름이 나온 문서와 장면 인물이 얽힌 항목');
  assert.ok(docLines.indexOf('- event · 정전 사건: 3층 전체가 정전됐다') < docLines.indexOf('- event · 정전 사건: 비상 발전기로 복구됐다'), '일어난 차례로');
  assert.doesNotMatch(on, /출입문이 잠겼다|준비 국면/, '장면과 무관한 문서·리듬 문서는 안 넣음');
  assert.ok(on.indexOf('## 나루') < on.indexOf('## Scene-related records'), '인물 기록 뒤에');
  // 꺼진 문서 종류는 안 넣는다
  assert.doesNotMatch(R.peopleBlockFor(chat, o({ $pp_docs_inject: '1', $pp_docs_event: '0' })).text, /정전됐다/);
  // 관련 문서가 없으면 블록도 없다
  assert.doesNotMatch(R.peopleBlockFor(twChat('도윤이 혼자 왔다.'), o({ $pp_docs_inject: '1' })).text, /Scene-related records/);
  // 상한: 문서 몫은 「상한 ÷ (장면 인물 수 + 1)」, 최근 항목부터 남기고 전체는 컨텍스트 글자 상한을 넘지 않는다
  store.docs['event:정전 사건'] = twDoc('event', '정전 사건', Array.from({ length: 60 }, (_, i) => [`e${i}`, `기록 ${i} ` + '가'.repeat(200)]));
  store.people.나루.slots.history = Array.from({ length: 80 }, (_, i) => ({ id: `h${i}`, text: `지난 일 ${i} ` + '나'.repeat(200), anchor: 'c1' }));
  const s = o({ $pp_docs_inject: '1' });
  const full = R.peopleBlockFor(chat, s);
  const docsPart = full.text.slice(full.text.indexOf('## Scene-related records'));
  assert.ok(docsPart.length <= Math.floor(s.settings.blockCap / (full.people.length + 1)), `문서 몫 ${docsPart.length}`);
  assert.match(docsPart, /기록 59 /, '가장 새 항목이 남음');
  assert.doesNotMatch(docsPart, /기록 0 /, '오래된 항목부터 빠짐');
  assert.ok(full.text.slice(full.text.indexOf('## ')).length <= s.settings.blockCap, '인물 기록 + 문서 ≤ 컨텍스트 글자 상한');
  assert.match(full.text, /## 나루 /, '인물 기록은 남는다');
});

test('성격 관찰 포함: 기본은 승인한 것만, 켜면 모으는 중인 관찰도 넣는다 (성적 축·거절한 후보 제외)', () => {
  const store = twStore(['나루']);
  const ev = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, anchor: 'c1', seq: i + 1, quote: '왔다', reason: 'r', strength: 50, confidence: 80 }));
  store.people.나루.candidates = {
    k1: { id: 'k1', axis: 'guardedness', direction: 'down', pattern: '먼저 속내를 털어놓았다', evidence: ev(2), status: 'collecting', at: '' },
    k2: { id: 'k2', axis: 'pattern', direction: 'new', pattern: '위기에서 농담으로 넘긴다', evidence: ev(1), status: 'collecting', at: '' },
    k3: { id: 'k3', axis: 'impulsivity', direction: 'up', pattern: '거절한 후보', evidence: ev(3), status: 'rejected', at: '' },
    k4: { id: 'k4', axis: 'sexual_desire', direction: 'replace', pattern: '성적 축 후보', evidence: ev(3), status: 'collecting', at: '' },
    k5: { id: 'k5', axis: 'impulsivity', direction: 'up', pattern: '근거가 사라진 후보', evidence: [{ ...ev(1)[0], anchor: 'gone' }], status: 'collecting', at: '' },
  };
  const chat = twChat('나루가 왔다.');
  const o = (vars = {}) => ({ settings: St.peopleSettings(vars), store, sheetOf: () => null, user: '주인공' });
  assert.equal(St.PP_DEFAULTS.axes_obs_inject, '0');
  assert.doesNotMatch(R.peopleBlockFor(chat, o()).text, /Seen in recent scenes|속내를/, '기본: 승인 전 관찰은 메인 요청에 없다');
  const on = R.peopleBlockFor(chat, o({ $pp_axes_obs_inject: '1' })).text;
  assert.match(on, /Seen in recent scenes[^\n]*\n- guardedness \(down\): 먼저 속내를 털어놓았다\n- pattern \(new\): 위기에서 농담으로 넘긴다\n/, '관찰이 많은 것부터');
  assert.doesNotMatch(on, /거절한 후보|성적 축 후보|근거가 사라진 후보/);
  assert.doesNotMatch(R.peopleBlockFor(chat, o({ $pp_axes_obs_inject: '1', $pp_axes: '0' })).text, /Seen in recent scenes/, '성격 6축이 꺼져 있으면 안 넣음');
});

test('시트 전체+기록: 시트에서 옮긴 시작값 항목은 다시 넣지 않고, 이야기에서 생긴 항목은 남긴다', () => {
  const sheet = ['### Character - Jyaldi', '#### Identity', '- Role: Chief', '- Age band: adult', '#### Character', '[Flaws]', '- Stubborn', '#### Voice', '- Short orders.'].join('\n');
  const store = T.emptyStore();
  store.people.쟈알디 = Seed.seedPerson('쟈알디', sheet, { address: { toUser: '요원', register: '반말' } });
  store.people.쟈알디.slots.identity.push({ id: 'i9', text: '최근 승진했다', src: 'story', anchor: 'c1', seq: 9, quote: '왔다' });
  const chat = twChat('쟈알디가 왔다.');
  const block = (inject) => R.peopleBlockFor(chat, { settings: St.peopleSettings({ $pp_inject: inject }), store, sheetOf: () => sheet, user: '주인공' }).text;
  const count = (t, w) => t.split(w).length - 1;
  const append = block('append');
  assert.equal(count(append, 'Role: Chief'), 1, '시트 원문에 한 번만');
  assert.equal(count(append, 'Stubborn'), 1);
  assert.match(append, /Identity:\n- 최근 승진했다/, '이야기 항목은 기록으로 남음');
  assert.doesNotMatch(append, /Personality:\n/, '시작값뿐인 칸은 제목도 없음');
  // 절 단위 혼합·기록만 방식은 전과 같다 (시트의 그 절이 블록에 없으니 시작값 항목이 그 내용을 싣는다)
  assert.match(block('split'), /Identity:\n- Role: Chief\n- Age band: adult\n- 최근 승진했다/);
  assert.match(block('record'), /Personality:\n- \[Flaws\] Stubborn/);
});

test('모델 Router: 고른 사람은 글에 나온 사람 뒤, 장면에 남아 있는 사람 앞 (남아 있는 사람이 Router 몫을 밀어내지 않는다)', () => {
  const names = ['가람', '나루', '다온', '라온', '마루', '바다', '사랑'];
  const store = twStore(names);
  const o = (vars = {}) => ({ settings: St.peopleSettings({ $pp_router: 'model', ...vars }), store, sheetOf: () => null });
  const six = twChat(`${names.slice(0, 6).join(', ')}가 모였다.`);
  assert.deepEqual(R.peopleBlockFor(six, { ...o(), people: ['사랑'] }).people, names.slice(0, 6), '글에 이름이 나온 사람만으로 찼으면 그대로');
  const five = twChat(`${names.slice(0, 5).join(', ')}가 모였다.`);
  assert.deepEqual(R.peopleBlockFor(five, { ...o(), people: ['사랑'] }).people, [...names.slice(0, 5), '사랑']);
  // 장면에 남아 있는 사람(갱신기가 적어 둔 목록)이 자리를 다 채워도 Router 가 고른 사람이 먼저 든다
  const one = twChat('가람이 문을 열었다.');
  const last = one.message.length - 1;
  const key = Store.messageKey(one.message[last], last);
  const kept = { ...store, read: { [key]: Store.messageHash(one.message[last]) }, scene: { [key]: ['나루', '다온', '라온', '마루', '바다'] } };
  assert.deepEqual(R.peopleBlockFor(one, { ...o(), store: kept }).people, ['가람', '나루', '다온', '라온', '마루', '바다'], 'Router 가 없으면 남아 있는 사람으로 채운다');
  assert.deepEqual(R.peopleBlockFor(one, { ...o(), store: kept, people: ['사랑'] }).people, ['가람', '사랑', '나루', '다온', '라온', '마루'], '글에 나온 사람 → Router → 남아 있는 사람');
});

test('시트 전체+기록: 넘침 줄이기도 블록에서 뺀 시작값 항목을 세지 않아, 줄일 지난 일이 남아 있는 동안 뒤 인물을 통째로 빼지 않는다', () => {
  const sheetOf = (n) => ['### Character - ' + n, '#### Identity', ...Array.from({ length: 10 }, (_, i) => `- Fact ${i} ` + 'x'.repeat(90)), '#### Character', ...Array.from({ length: 10 }, (_, i) => `- Trait ${i} ` + 'y'.repeat(90))].join('\n');
  const store = T.emptyStore();
  for (const n of ['가람', '나루']) {
    store.people[n] = Seed.seedPerson(n, sheetOf(n), { address: { toUser: '요원', register: '반말' } });
    store.people[n].slots.history = Array.from({ length: 20 }, (_, i) => ({ id: `${n}h${i}`, text: `${n} 지난 일 ${i} ` + '가'.repeat(190), src: 'story', anchor: 'c1', seq: i + 1, quote: '왔다' }));
  }
  const r = R.peopleBlockFor(twChat('가람과 나루가 왔다.'), { settings: St.peopleSettings({ $pp_inject: 'append', $pp_block_cap: '4000' }), store, sheetOf, user: '주인공' });
  assert.deepEqual(r.people, ['가람', '나루']);
  assert.ok(r.text.includes('### Character - 나루'), '뒤 인물도 블록에 남는다');
  const hist = (n) => (r.text.match(new RegExp(`${n} 지난 일`, 'g')) ?? []).length;
  assert.ok(hist('가람') > 0 && hist('나루') > 0, `두 인물 모두 지난 일이 줄어서 남는다 (${hist('가람')}, ${hist('나루')})`);
});
