// 2차 점검 고침 20-1: 창 크기가 바뀌면 떠 있는 유령 단추를 화면 안으로 다시 당긴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clampPos, FAB_SIZE, FAB_MARGIN } from '../dist-test/core.mjs';

const overlay = await readFile(new URL('../src/host/overlay.ts', import.meta.url), 'utf8');
const body = await readFile(new URL('../src/body.ts', import.meta.url), 'utf8');

test('20-1: 창 크기가 바뀌면 떠 있는 유령 단추를 화면 안으로 다시 당긴다', () => {
  assert.deepEqual(clampPos({ right: 16, bottom: 700 }, 844, 390), { right: 16, bottom: 390 - FAB_SIZE - FAB_MARGIN });
  const vis = overlay.slice(overlay.indexOf('async setVisible(next, intro = false) {'));
  assert.match(vis, /if \(shown === next && !intro\) \{\s*\/\/[^\n]*\n\s*if \(next && !drag\) \{[\s\S]*?clampPos\(want, vw, vh\)[\s\S]*?await applyPos\(\);[\s\S]*?return;\s*\}/);
  // 당긴 자리는 놓은 자리(want)를 덮지 않는다: 창을 되돌리면 놓은 자리로 돌아온다. 끌면 놓은 자리가 바뀐다
  assert.doesNotMatch(overlay, /clampPos\(pos,/);
  assert.match(overlay, /pos = dragTo\(d\.start, dx, dy, hit\.vw, hit\.vh\);\s*want = \{ \.\.\.pos \};/);
  assert.deepEqual(clampPos(clampPos({ right: 16, bottom: 780 }, 752, 749) && { right: 16, bottom: 780 }, 344, 882), { right: 16, bottom: 780 });
  assert.match(body, /if \(next\.changed\) await fab\?\.setVisible\(next\.fabVisible, next\.intro\);\s*\/\/[^\n]*\n\s*else if \(next\.fabVisible\) await fab\?\.setVisible\(true\)/);
});
