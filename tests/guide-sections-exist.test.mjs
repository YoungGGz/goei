// 2026-11-14 사용자: 모델에게 가는 글은 전부 지침 파일에. 코드가 guideTxt('지침', '절') 로 읽는 절이 기본 파일(지침/*.txt)에 다 있는지 본다
// (없으면 요청에 빈 글이 들어간다. 코드에 예비 글을 두지 않으므로 이 시험이 막는다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const guidesSrc = readFileSync(join(ROOT, 'src/core/guides.ts'), 'utf8');
const FILE_OF = Object.fromEntries([...guidesSrc.matchAll(/^import g(\w+) from '\.\.\/\.\.\/지침\/(.+?)'/gm)].map((m) => [m[1], m[2]]));
const sections = (file) => new Set([...readFileSync(join(ROOT, '지침', file), 'utf8').replace(/\r/g, '').matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)].filter((m) => m[2].trim()).map((m) => m[1].trim()));

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('guideTxt 로 읽는 절은 기본 지침 파일에 글이 있다', () => {
  const missing = [];
  let n = 0;
  for (const f of walk(join(ROOT, 'src'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/guideTxt\('(\w+)', '([^']+)'/g)) {
      n++;
      const file = FILE_OF[m[1]];
      if (!file) { missing.push(`${f}: 모르는 지침 ${m[1]}`); continue; }
      if (!sections(file).has(m[2])) missing.push(`${f.slice(ROOT.length)}: ${m[1]}(${file}) 에 ${m[2]} 절 없음`);
    }
  }
  assert.ok(n > 100, `읽는 곳을 찾았다 (${n})`);
  assert.deepEqual(missing, []);
});

test('코드에 지침 예비 글(guideOr)이 없다', () => {
  const hits = walk(join(ROOT, 'src')).filter((f) => /\bguideOr\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});
