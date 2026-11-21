// −/+ 수 칸 공통 (src/core/stepval.ts): 1씩(상한 1만 이상은 100씩), 직접 입력은 「열쇠=수」, 범위로 맞춤
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/core/stepval.ts', 'src/core/looks.ts'], bundle: true, format: 'esm', target: 'es2022', outdir: 'dist-test/stepval', logLevel: 'silent' });
const { stepOf, stepNext } = await import('../dist-test/stepval/stepval.js');
const { lookActGap, pickLookGap } = await import('../dist-test/stepval/looks.js');

test('한 번에 1, 상한이 1만 이상이면 100', () => {
  assert.equal(stepOf(120), 1);
  assert.equal(stepOf(2000), 1);
  assert.equal(stepOf(10000), 100);
  assert.equal(stepNext('n:+', 20, 0, 120), 21);
  assert.equal(stepNext('n:-', 20, 0, 120), 19);
  assert.equal(stepNext('-', 12, 12, 100), 12);
  assert.equal(stepNext('+', 8000, 0, 20000), 8100);
});

test('직접 입력: 열쇠=수 · 수만 · 범위 밖은 맞추고 빈 칸은 그대로', () => {
  assert.equal(stepNext('n=37', 20, 0, 120), 37);
  assert.equal(stepNext('37', 20, 0, 120), 37);
  assert.equal(stepNext('cos:3=7', 1, 0, 99), 7);
  assert.equal(stepNext('n=999', 20, 0, 120), 120);
  assert.equal(stepNext('n=-5', 20, 0, 120), 0);
  assert.equal(stepNext('n=8192', 0, 0, 20000), 8192);
  assert.equal(stepNext('n=', 20, 0, 120), null);
  assert.equal(stepNext('abc', 20, 0, 120), null);
});

test('아바타 동작 간격: 최소~최대 사이, 최소가 최대를 넘지 않음', () => {
  assert.deepEqual(lookActGap(undefined), [12, 24]);
  assert.deepEqual(lookActGap({ $it_act_gap_min: '7', $it_act_gap_max: '9' }), [7, 9]);
  assert.deepEqual(lookActGap({ $it_act_gap_min: '50', $it_act_gap_max: '9' }), [9, 9]);
  assert.equal(pickLookGap([7, 9], 0), 7);
  assert.equal(pickLookGap([7, 9], 1), 9);
  assert.equal(pickLookGap([7, 9], 0.5), 8);
});
