// 숨긴 진짜 효과: 소지품에 저장되고, 본편에는 쓰는 턴(또는 걸친 장비)에만 「Really」로 간다 (11-09 사용자)
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/items'; export { guideTxt } from './src/core/guides';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const I = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const alive = new Set(['a1']);
const base = { slots: 8, limit: '8 items' };

test('truth: 저장되고 updateItem 이 지우지 않으며, 줄(itemLine)에는 절대 안 나온다', () => {
  let it = I.addItem({ list: [], log: [] }, alive, { name: '빛의 돌', desc: '둥근 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 전부 꺼진다', from: 'store', anchor: 'a1' });
  const e = it.list[0];
  assert.equal(e.truth, '쥐면 주변 전등이 전부 꺼진다');
  assert.equal(I.itemLine(e, undefined, false), '- 빛의 돌 — 둥근 돌 (어둠을 밝힌다)', '평소엔 광고 문구만');
  assert.equal(I.updateItem(it, e.id, { desc: '금이 감' }).list[0].truth, e.truth);
});

test('truth: 안 쓰는 턴엔 Really 없음, 쓰는 턴엔 Really 에 진짜, ? 는 「decide now」', () => {
  let it = I.addItem({ list: [], log: [] }, alive, { name: '빛의 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 전부 꺼진다', use: true, from: 'store', anchor: 'a1' });
  it = I.addItem(it, alive, { name: '돌', effect: '???', truth: '?', use: true, from: 'store', anchor: 'a1' });
  const live = I.liveItems(it, alive);
  const quiet = I.itemsBlock(live, base);
  assert.ok(!quiet.includes('Really') && !quiet.includes('전등'), quiet);
  const used = I.itemsBlock(live, { ...base, use: [{ name: '빛의 돌', n: 1 }, { name: '돌', n: 1 }] });
  assert.ok(used.includes('Really') && used.includes('- 빛의 돌: 쥐면 주변 전등이 전부 꺼진다 (the label says 「어둠을 밝힌다」)'), used);
  assert.ok(used.includes('- 돌: not even its seller knows (the label says 「???」 and may be false) — decide what it really does now'), used);
  // Really 설명은 쓰는 턴의 Really 머리줄에만 (11-13 전수검사: INVENTORY_NOTE 에서 뺌)
  assert.ok(used.includes('Really (what these actually do beneath what the label claims'), used);
  // 안내 글은 지침 「메인 요청에 붙는 글」 INVENTORY.NOTE 절 (2026-11-14: 코드 사본 INVENTORY_NOTE 를 없앰)
  assert.ok(!I.guideTxt('Main', 'INVENTORY.NOTE').includes('Really'));
});

test('쪽지 내용(text): 저장되고 본편 줄에 reads 로 간다', () => {
  const it = I.addItem({ list: [], log: [] }, new Set(['a1']), { name: '쪽지: 골목', text: '소리를 내지 마라', from: 'store', anchor: 'a1' });
  assert.equal(it.list[0].text, '소리를 내지 마라');
  assert.ok(I.itemLine(it.list[0], undefined, false).includes('reads: "소리를 내지 마라"'));
});

test('truth: 이름이 같은 물건이 둘이면 쓰는 그 줄의 진실만 간다 (11-15)', () => {
  let it = I.addItem({ list: [], log: [] }, alive, { name: '붕대', effect: '상처를 감싼다', truth: '감은 자리가 다른 사람 것이 된다', use: true, from: 'store', store: 'cos', anchor: 'a1' });
  it = I.addItem(it, alive, { name: '붕대', effect: '상처를 감싼다', use: true, from: 'store', store: 'shop', anchor: 'a1' });
  const live = I.liveItems(it, alive);
  const plain = live.find((e) => !e.truth);
  assert.ok(plain && live.length === 2);
  const block = I.itemsBlock(live, { ...base, use: [{ id: plain.id, name: '붕대', n: 1 }] });
  assert.ok(!block.includes('Really') && !block.includes('다른 사람'), block);
  const real = live.find((e) => e.truth);
  assert.ok(I.itemsBlock(live, { ...base, use: [{ id: real.id, name: '붕대', n: 1 }] }).includes('다른 사람'));
});

test('truth: 진실이 다르면 합치지 않고, 본문에서 주운 같은 이름 물건은 진실 있는 산 물건 줄에 안 합친다 (11-15)', () => {
  let it = I.addItem({ list: [], log: [] }, alive, { name: '은하 붕대', effect: '감싼다', truth: '감은 자리가 사라진다', uses: 3, use: true, from: 'store', store: 'cos', anchor: 'a1' });
  it = I.addItem(it, alive, { name: '붕대', uses: 2, use: true, from: 'manual', anchor: '' });
  const [a, b] = it.list;
  assert.equal(I.canMerge(a, b), false);
  const two = new Set(['a1', 'a2']);
  let s = I.addItem({ list: [], log: [] }, two, { name: '붕대', effect: '감싼다', truth: '감은 자리가 사라진다', from: 'store', store: 'cos', anchor: 'a1' });
  s = I.addItem(s, two, { name: '붕대', desc: '길에서 주운 붕대', from: 'story', anchor: 'a2' });
  assert.equal(I.liveItems(s, two).length, 2);
  assert.equal(I.liveItems(s, two).find((x) => x.from === 'story').truth, undefined);
});
