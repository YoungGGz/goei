// 전수: 플러그인이 고르는 모든 로어북(세력·파밍·괴이·요원)을 제 이름·키·명부의 이름·영문명·별칭으로 불렀을 때 켜지는지.
// 2026-11-12 사용자: 「착한 친구」(명부에서 브라우니 별칭)가 키에 없어 로어북이 안 읽힘 → 항목 하나가 아니라 전부 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lore, withWorldLore, readDirectory, tokens } from '../dist-test/core.mjs';

const books = withWorldLore([{ comment: 'Directory', key: '', mode: 'normal', content: readFileSync(new URL('../src/data/install/directory.json', import.meta.url), 'utf8') }]);
const dir = readDirectory(books);
const entries = lore.managedEntries(books).filter((e) => !e.appendix);
const hangul = (s) => /[가-힣]/.test(s);
const picked = (text) => {
  const chat = { message: [{ role: 'char', data: '사무실은 조용했다.' }, { role: 'user', data: text }], scriptstate: {} };
  return lore.computeLore(books, chat, lore.loreOptions({ globalLore: books }, chat, 'plugin')).picks.map((p) => p.entry.name);
};
const plain = (n) => (hangul(n) ? `어제 ${n}에 대한 이야기를 들었다.` : `I heard about ${n} yesterday.`);
const quoted = (n) => (hangul(n) ? `어제 「${n}」에 대한 이야기를 들었다.` : `I heard about "${n}" yesterday.`);
const honor = (n) => `어제 ${n} 씨를 만났다.`;
const callsOf = (e) => {
  const row = e.kind === 'agent' ? dir.agents.find((x) => x.lore === e.name) : e.kind === 'anomaly' ? dir.anomalies.find((x) => x.lore === e.name) : e.kind === 'site' ? dir.sites.find((x) => x.lore === e.name) : undefined;
  const all = [e.name, ...e.rawKeys, ...(e.kind === 'agent' ? [row?.name] : []), row?.english, ...(row?.aliases ?? [])].filter((t) => typeof t === 'string' && [...t.replace(/\s+/g, '')].length >= 2);
  return [...new Set(all)];
};

test('모든 항목: 부르는 말마다 키가 있고, 그 말로 부르면 켜진다 (확증 키는 따옴표, 두 글자 이름은 호칭과 함께)', () => {
  assert.ok(entries.length >= 140, `항목 ${entries.length}개`);
  const miss = [];
  for (const e of entries) {
    for (const call of callsOf(e)) {
      const key = e.keys.find((k) => k.text.toLowerCase() === call.toLowerCase());
      if (!key) { miss.push(`${e.name}: 「${call}」 키 없음`); continue; }
      const text = key.rule === 'confirm' ? quoted(call) : key.rule === 'alias' ? honor(call) : plain(call);
      if (!picked(text).includes(e.name)) miss.push(`${e.name}: 「${call}」(${key.rule}) 안 켜짐 ← ${text}`);
    }
  }
  assert.deepEqual(miss, []);
});

test('붙여 써도 켜진다: 세 글자 넘는 장소·괴이 이름 (착한친구키링, 여우상담실)', () => {
  const miss = [];
  for (const e of entries.filter((x) => x.kind !== 'agent')) {
    const name = e.name.replace(/\s+/g, '');
    if (!hangul(name) || name === e.name || /[^가-힣\w]/.test(name)) continue;
    const key = e.keys.find((k) => k.text === e.name);
    if (!picked(key?.rule === 'confirm' ? quoted(name) : plain(name)).includes(e.name)) miss.push(`${e.name} → ${name}`);
  }
  assert.deepEqual(miss, []);
});

test('「착한 친구」: 명부 별칭으로 브라우니가 켜지고, 「착한 친구 키링」은 키링이 켜진다', () => {
  assert.ok(picked('착한 친구가 말을 걸었다.').includes('브라우니'));
  assert.ok(picked('착한친구 얘기 들었어?').includes('브라우니'));
  assert.deepEqual(picked('착한 친구 키링을 주웠다.'), ['착한 친구 키링'], '긴 이름이 이긴다');
});

test('확증·두 글자 규칙은 그대로: 흔한 낱말은 그냥 나와서는 켜지지 않는다', () => {
  assert.ok(!picked('브라우니를 구워 먹었다.').includes('브라우니'));
  assert.ok(!picked('병원에 다녀왔다.').includes('병원'));
  assert.ok(!picked('도형을 그렸다.').includes('이도형'));
});

test('플러그인 설정의 검색 깊이·토큰 예산: 0이면 카드 설정, 값이 있으면 플러그인이 고를 때만 그 값', () => {
  const chat = { message: [], scriptstate: {} };
  const card = { globalLore: [], loreSettings: { scanDepth: 7, tokenBudget: 5000 } };
  const base = lore.loreOptions(card, chat, 'plugin');
  assert.deepEqual([base.depth, base.budget], [7, 4500]);
  assert.deepEqual(lore.loreOptions(card, chat, 'plugin', '', { depth: 0, budget: 0 }), base, '0 = 전과 같음');
  const own = lore.loreOptions(card, chat, 'plugin', '', { depth: 3, budget: 2000 });
  assert.deepEqual([own.depth, own.budget], [3, 2000], '설정값이 그대로 상한');
  const risu = lore.loreOptions(card, chat, 'risu', '', { depth: 3, budget: 2000 });
  assert.deepEqual([risu.depth, risu.budget], [7, 4500], 'Risu가 직접 고를 때는 카드 설정');
  const none = lore.loreOptions({ globalLore: [] }, chat, 'plugin');
  assert.deepEqual([none.depth, none.budget], [lore.DEFAULT_DEPTH, Math.floor(lore.DEFAULT_BUDGET * 0.9)]);
  // 깊이를 줄이면 오래된 메시지의 이름으로는 고르지 않는다
  const name = entries.find((e) => hangul(e.name) && e.name.length >= 3)?.name;
  const old = { message: [{ role: 'user', data: plain(name) }, { role: 'char', data: '조용했다.' }, { role: 'user', data: '계속.' }], scriptstate: {} };
  const got = (over) => lore.computeLore(books, old, lore.loreOptions({ globalLore: books }, old, 'plugin', '', over)).picks.map((p) => p.entry.name);
  assert.ok(got(undefined).includes(name), name);
  assert.ok(!got({ depth: 2 }).includes(name), '깊이 2: 세 번째 전 메시지는 보지 않는다');
});

test('로어북 토큰 예산 설정: 늘 켜진 가상 항목이 있어도 설정값이 그대로 고른 로어북의 상한이다', () => {
  const chat = { message: [{ role: 'char', data: '사무실은 조용했다.' }, { role: 'user', data: '관리국 건물로 들어갔다.' }], scriptstate: {} };
  const run = (over) => {
    const o = lore.loreOptions({ globalLore: books }, chat, 'plugin', '', over);
    return { budget: o.budget, picks: lore.computeLore(books, chat, o).picks };
  };
  const all = run(undefined);
  assert.ok(all.picks.length > 0, '카드 설정으로는 골라진다');
  const size = (p) => tokens(p.entry.content);
  const small = Math.min(...all.picks.map(size));
  for (const budget of [3000, 5000, 8000]) {
    const r = run({ budget });
    assert.equal(r.budget, budget);
    if (small <= budget) assert.ok(r.picks.length > 0, `예산 ${budget}: 들어갈 수 있는 로어북은 골라진다`);
    assert.ok(r.picks.reduce((n, p) => n + size(p), 0) <= budget, `예산 ${budget} 안`);
  }
  assert.ok(small <= 3000, '작은 로어북은 3000 안에 든다');
  assert.deepEqual(run({ budget: 0 }).budget, all.budget, '0 = 카드 설정');
});

test('로어북 토큰 예산 설정: 자리 항목이 있는 카드에서는 카드 예산 몫을 넘지 않는다 (Risu가 자리 항목을 빼지 않게)', () => {
  const chat = { message: [], scriptstate: {} };
  const slots = Object.values(lore.SLOTS).map((s) => ({ comment: s.comment, key: '', mode: 'normal', content: '' }));
  const card = { globalLore: slots, loreSettings: { tokenBudget: 20000 } };
  const base = lore.loreOptions(card, chat, 'plugin').budget;
  assert.equal(base, 18000);
  assert.equal(lore.loreOptions(card, chat, 'plugin', '', { budget: 50000 }).budget, base, '카드 몫보다 크게 적어도 카드 몫');
  assert.equal(lore.loreOptions(card, chat, 'plugin', '', { budget: 5000 }).budget, 5000, '작게 적으면 그 값');
  const free = { globalLore: [], loreSettings: { tokenBudget: 20000 } };
  assert.equal(lore.loreOptions(free, chat, 'plugin', '', { budget: 50000 }).budget, 50000, '자리 항목 없는 카드는 설정값 그대로');
});
