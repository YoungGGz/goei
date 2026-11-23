// 2차 점검 12 (AI 상담): 0(안 함·제한 없음) 적용 판정(AI1), 「2만」을 2로 읽음(AI2), 같이 바뀐 짝 줄(AI3), 막대 옆 글을 단위로 읽음(AI6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/fix3d/consult';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
await build({ stdin: { contents: `export * from './src/core/consult'; export { PREF_VAR } from './src/core/settings';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const C = await import(pathToFileURL(outfile));
const src = async (p) => readFile(new URL(`../src/${p}`, import.meta.url), 'utf8');

const budget = { id: 'adv-set.gen:budget', menu: '생성 공통', group: '', name: '요청 토큰 상한', kind: 'num', cur: '0', lo: 0, hi: 200000, unit: '토큰', zero: '제한 없음' };
const reit = { id: 'adv-set.gen:reiterate', menu: '생성 공통', group: '', name: '다시 보기', kind: 'num', cur: '1', lo: 0, hi: 2, unit: '회', zero: '안 함' };

test('AI2: 「2만」「2만 토큰」「20k」「20,000」은 20000, 단위가 아닌 글이 붙으면 받지 않는다', () => {
  for (const raw of ['2만', '2만 토큰', '2만토큰', '20k', '20K', '20,000', '20000', '20000토큰', '2.0만']) assert.equal(C.consultValue(budget, raw), '20000', raw);
  assert.equal(C.consultValue(budget, '1.5천'), '1500');
  assert.equal(C.consultValue(budget, '2만원'), null);
  assert.equal(C.consultValue(budget, '2개'), null);
  assert.equal(C.consultValue(budget, '30만'), null, '범위 밖');
  assert.equal(C.consultValue(reit, '2회'), '2');
  assert.equal(C.consultValue(reit, '1.5'), null);
  const { ok, bad } = C.checkConsult([budget], [{ id: budget.id, raw: '2만원' }]);
  assert.deepEqual(ok, []);
  assert.equal(bad.length, 1, '못 받으면 알린다');
});

test('AI1: 0의 뜻(「제한 없음」「안 함」)을 받고, 0인 줄은 그 말로 보인다', () => {
  assert.equal(C.consultValue(budget, '제한 없음'), '0');
  assert.equal(C.consultValue(reit, '안 함'), '0');
  assert.equal(C.consultValue(reit, '0'), '0');
  assert.equal(C.consultLabel(reit, '0'), '안 함');
  assert.match(C.itemLine({ ...reit, cur: '0' }), /안 함/);
});

test('AI1·AI6: 설정 목록은 빈 수 칸을 0으로, 자리 글·data-zero 를 0의 뜻으로, 수로 시작하지 않는 막대 옆 글은 단위로 읽지 않는다', async () => {
  const cat = await src('ui/editor/catalog.ts');
  assert.match(cat, /const zero = isNum \? input\.getAttribute\('placeholder'\) \|\| input\.dataset\.zero \|\| undefined : undefined;/);
  assert.match(cat, /cur: isNum && raw === '' && zero \? '0' : raw/);
  assert.match(cat, /\{ lo, hi, unit, zero \}/);
  assert.match(cat, /const outUnit = \/\^-\?\[\\d,\.\]\+\\s\*\(\\D\*\)\$\/\.exec\(out\)/);
  assert.doesNotMatch(cat, /querySelector\(':scope > output'\)\)\.replace\(/);
  // 막대 옆 글 꼴: 수로 시작하면 단위만, 「±10」「한도 없음」은 단위가 아니다
  const unitOf = (out) => /^-?[\d,.]+\s*(\D*)$/.exec(out)?.[1].trim() ?? '';
  assert.equal(unitOf('30%'), '%');
  assert.equal(unitOf('±10'), '');
  assert.equal(unitOf('한도 없음'), '');
  assert.match(await src('ui/people.ts'), /data-change="pp-cap" data-zero="한도 없음"/);
});

test('AI3: 적용할 때 바꾸는 메뉴의 줄을 다 적어 두고, 같이 바뀐 줄도 판에 넣어 되돌린다', async () => {
  const ui = await src('ui/editor/consult.ts');
  assert.match(ui, /const before = pages\.flatMap\(\(pg\) => catalogPage\(pg\)\);/);
  assert.match(ui, /for \(const e of before\) \{\n\s+if \(!consultCan\(e\) \|\| pending\.some\(\(p\) => p\.id === e\.id\) \|\| rows\.some\(\(r\) => r\.id === e\.id\)\) continue;\n\s+const now = rowAt\(e\.page, e\.id\);\n\s+if \(now && now\.cur !== e\.cur\) rows\.push\(cardOf\(e, now\)\);/);
});
