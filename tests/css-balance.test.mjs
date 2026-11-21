// CSS 중괄호 짝 검사 (11-22: 합치다 닫는 괄호 셋이 빠져 그 뒤 규칙 전부가 @media 601~860 안에 갇혔다 — 빌드·형 검사·다른 단위 시험은 못 잡는다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['src/ui/style.css', 'src/ui/editor/style.css']) {
  test(`${file}: braces are balanced and no merge markers remain`, () => {
    const raw = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    let min = 0;
    for (const ch of css) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth < min) min = depth; }
    }
    assert.equal(min, 0, 'a closing brace has no opener');
    assert.equal(depth, 0, 'an opening brace is never closed');
    assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(raw), 'merge conflict marker left in the file');
  });
}
