// 2차 점검 16 (설정 화면): 초대받은 단톡방 정리 기본값(문제1), 관제 칸 다시 그리기(문제2) · 17 (설치·업데이트): 업데이트 단추(17-2·17-3)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/fix3d/settings';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
await build({ stdin: { contents: `export { PREF_VAR } from './src/core/settings';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const C = await import(pathToFileURL(outfile));
const src = async (p) => readFile(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('16-문제1: 「초대받은 단톡방 정리」도 기본값 저장·불러오기·초기화 대상', () => {
  for (const k of ['dm', 'group', 'notice', 'invited']) {
    assert.ok(C.PREF_VAR.test(`$ph_storage_auto_${k}`), k);
    assert.ok(C.PREF_VAR.test(`$ph_storage_limit_${k}`), k);
  }
});

test('16-문제2: 관제(호출 흐름) 화면도 패널을 다시 그릴 때 같이 그린다', async () => {
  assert.match(await src('ui/editor/index.ts'), /export const editorOnSettings = \(\) => edUi\.open && \(isSetNode\(edUi\.node\) \|\| edUi\.node === 'manage:flow'\);/);
});

test('17-2·17-3: 업데이트 단추는 커스텀 임무 첫 장면 전·다른 봇 설치 화면에서도 처리한다', async () => {
  const app = await src('ui/app.ts');
  assert.match(app, /const updCtx = view\.kind === 'started' \|\| view\.kind === 'picker' \|\| view\.kind === 'opening' \? view\.ctx : installCtx;\n\s+if \(updCtx && \(await handleUpdate\(action, updCtx, settingsEnv\)\)\) return;/);
  assert.doesNotMatch(app, /action\.startsWith\('upd-'\) && \(view\.kind === 'started' \|\| view\.kind === 'picker'\)/);
});
