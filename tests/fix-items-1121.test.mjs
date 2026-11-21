// 전수점검(11-20) 소지품·가계부 고침: 다시 굴리기에 묶인 횟수·합치기·포인트몰 받기·잔고 읽기·그림 대체 말
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/items'; export { parseWon } from './src/core/wallet'; export { statusClock24 } from './src/core/world/status';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.txt': 'text', '.css': 'text' }, logLevel: 'silent' });
const I = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const empty = { list: [], log: [] };
const alive = new Set(['c1', 'c2', 'c3']);
const without = (k) => new Set([...alive].filter((x) => x !== k));
const ch = (c) => ({ desc: '', effect: '', quote: '', ...c });

test('중대-5: 가진 소모품을 본문에서 더 얻으면(got) 그 응답에 묶여 남은 횟수가 는다', () => {
  let it = I.addItem(empty, alive, { name: '생수', uses: 3, from: 'story', anchor: 'c1' });
  it = I.applyItemChanges(it, alive, [ch({ anchor: 'c2', name: '생수', action: 'update', got: 2 })]);
  const row = it.list[0];
  assert.equal(I.itemLeft(it, row, alive), 5);
  assert.equal(I.itemLeft(it, row, without('c2')), 3, '다시 굴리면 받은 수가 빠진다');
});

test('중대-6: 남은 0(다 씀)을 다시 굴리면 소모품이 돌아온다 (기본 설정 빼기)', () => {
  let it = I.addItem(empty, alive, { name: '붕대', uses: 2, from: 'story', anchor: 'c1' });
  it = I.applyItemChanges(it, alive, [ch({ anchor: 'c2', name: '붕대', action: 'update', uses: 0 })]);
  assert.equal(I.liveItems(it, alive).length, 0);
  const back = I.liveItems(it, without('c2'));
  assert.equal(back.length, 1);
  assert.equal(I.itemLeft(it, back[0], without('c2')), 2);
  // 남은 횟수를 늘리는 update 도 그 응답에 묶인다
  let up = I.addItem(empty, alive, { name: '붕대', uses: 2, from: 'story', anchor: 'c1' });
  up = I.applyItemChanges(up, alive, [ch({ anchor: 'c2', name: '붕대', action: 'update', uses: 4 })]);
  assert.equal(I.itemLeft(up, up.list[0], alive), 4);
  assert.equal(I.itemLeft(up, up.list[0], without('c2')), 2);
});

test('중대-7: 포인트몰 받기는 같은 이름 물건이 있어도 새 줄, 숨긴 진실이 가진 물건에 옮겨 붙지 않는다', () => {
  const it0 = I.addItem(empty, alive, { name: '손전등', desc: '낡은 것', from: 'manual', anchor: '' });
  const order = { id: 'o1', anchor: 'c1', price: 100, item: { name: '손전등', desc: '산 것', effect: '밝다', truth: '괴이를 부른다', use: true } };
  const r = I.confirmBmPickups(it0, [order], [order], ['손전등'], alive, 'c2', []);
  assert.equal(r.it.list.length, 2);
  assert.equal(r.it.list[0].desc, '낡은 것');
  assert.equal(r.it.list[0].truth, undefined);
  assert.equal(r.it.list[1].truth, '괴이를 부른다');
});

test('보통-24: 합친 뒤 어느 쪽 응답을 다시 굴려도 그쪽 몫만 돌아간다', () => {
  let it = I.addItem(empty, alive, { name: '회복 물약', uses: 2, from: 'store', anchor: 'c1' });
  it = I.addItem(it, alive, { name: '회복 물약', uses: 2, from: 'store', anchor: 'c2' });
  const [a, b] = it.list;
  // B 줄을 남김 → B 를 다시 굴리면 A 의 2개가 돌아온다 (전에는 4개가 다 사라졌다)
  const keepB = I.mergeItems(it, alive, b.id, a.id, 'c2');
  assert.deepEqual(I.liveItems(keepB, alive).map((e) => I.itemLeft(keepB, e, alive)), [4]);
  const rerollB = I.liveItems(keepB, without('c2'));
  assert.deepEqual(rerollB.map((e) => [e.id, I.itemLeft(keepB, e, without('c2'))]), [[a.id, 2]]);
  // A 줄을 남김 → B 를 다시 굴리면 B 의 2개만 빠진다 (전에는 4개 그대로였다)
  const keepA = I.mergeItems(it, alive, a.id, b.id, 'c2');
  assert.deepEqual(I.liveItems(keepA, without('c2')).map((e) => I.itemLeft(keepA, e, without('c2'))), [2]);
  // 남는 줄을 삭제하면 합쳐 들어간 줄도 같이 지운다
  assert.equal(I.purgeItem(keepA, a.id).list.length, 0);
});

test('보통-25·26: 합침 기록은 남는 물건 이름으로, 조사는 받침에 맞게', () => {
  let it = I.addItem(empty, alive, { name: '작은 물약', uses: 1, from: 'manual', anchor: '' });
  it = I.addItem(it, alive, { name: '물약', uses: 1, from: 'manual', anchor: '' });
  const [small, big] = it.list;
  it = I.mergeItems(it, alive, big.id, small.id, 'c3');
  assert.equal(it.log.at(-1).note, '물약과 합침');
  assert.deepEqual(I.mergedNow(it, 'c3'), ['combined 작은 물약 into 물약']);
  const chat = { message: [{ role: 'user', data: 'x', chatId: 'u1' }, { role: 'char', data: 'y', chatId: 'c3' }] };
  assert.deepEqual(I.recentItemLog(chat, it, 3, {}).filter((l) => l.startsWith('combined')), ['combined into 물약']);
});

test('사소-26: 많이 쓴 소모품도 더 넣거나 합치면 남은 횟수가 는다 (상한 999 는 남은 횟수에)', () => {
  let it = I.addItem(empty, alive, { name: '탄창', uses: 999, from: 'manual', anchor: '' });
  it = I.addItemLog(it, { name: '탄창', item: it.list[0].id, what: 'use', by: 'manual', anchor: '', n: 990 });
  it = I.addItem(it, alive, { name: '탄창', uses: 5, from: 'manual', anchor: '' });
  assert.equal(I.itemLeft(it, it.list[0], alive), 14);
  it = I.setItemLeft(it, alive, it.list[0].id, 500);
  assert.equal(I.itemLeft(it, it.list[0], alive), 500);
  assert.equal(I.readItems(I.itemsVars(it)).list[0].uses > 999, true, '저장된 처음 횟수는 999 를 넘을 수 있다');
});

test('보통-28: 고치기에서 남은 0 은 다 씀 (한 번도 안 쓴 물건도)', () => {
  let it = I.addItem(empty, alive, { name: '부적', uses: 3, from: 'manual', anchor: '' });
  it = I.setItemLeft(it, alive, it.list[0].id, 0);
  assert.equal(it.list[0].uses, 3, '소모성 그대로');
  assert.equal(I.itemLeft(it, it.list[0], alive), 0);
});

test('사소-25: 무게 0 은 0g', () => {
  assert.equal(I.weightText(0), '0g');
  assert.equal(I.weightText(0.0004), '1g');
});

test('사소-30: 숫자 없는 만·천, ₩ 뒤 부호도 읽는다', () => {
  assert.equal(I.parseWon('만원'), 10000);
  assert.equal(I.parseWon('천원'), 1000);
  assert.equal(I.parseWon('₩-5,000'), -5000);
  assert.equal(I.parseWon('−₩5,000'), -5000);
  assert.equal(I.parseWon('12만5천원'), 125000);
  assert.equal(I.parseWon('원'), null);
});

test('눌러-보통-22: 상태줄 시각은 24시간 HH:MM', () => {
  assert.equal(I.statusClock24('02:47 AM'), '02:47');
  assert.equal(I.statusClock24('02:47 PM'), '14:47');
  assert.equal(I.statusClock24('오후 9시 5분'), '21:05');
  assert.equal(I.statusClock24(''), '');
});
