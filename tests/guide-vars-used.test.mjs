// 2026-11-15: 코드가 guideTxt(지침, 절, { 이름: 값 }) 로 넘기는 값의 자리표 {이름} 이 기본 지침 절에 있는지 본다.
// (v0.21.12 때 글을 지침으로 옮기며 Director MAIN_NOTE 의 {knowledge_rule}, 갱신기 SEXUAL.PROMPT_RULES 의 {style} 이 빠져 그 문장이 요청에서 사라졌다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname;
const guidesSrc = readFileSync(join(ROOT, 'src/core/guides.ts'), 'utf8');
const FILE_OF = Object.fromEntries([...guidesSrc.matchAll(/^import g(\w+) from '\.\.\/\.\.\/지침\/(.+?)'/gm)].map((m) => [m[1], m[2]]));
const SECS = {};
for (const [g, f] of Object.entries(FILE_OF)) {
  SECS[g] = Object.fromEntries([...readFileSync(join(ROOT, '지침', f), 'utf8').replace(/\r/g, '').matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)].map((m) => [m[1].trim(), m[2]]));
}
const holes = (t) => new Set([...t.matchAll(/(?<!\{)\{([a-z0-9_]+)\}(?!\})/g)].map((m) => m[1]));

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('guideTxt 로 넘기는 값마다 기본 지침 절에 자리표가 있다', () => {
  const bad = [];
  let n = 0;
  for (const f of walk(join(ROOT, 'src'))) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('guideTxt')) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    // 이 파일의 감싸개: const C = (section, vars) => guideTxt('Consult', section, vars)
    const wrap = {};
    const findWrap = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)) {
        const c = node.initializer.body;
        if (ts.isCallExpression(c) && c.expression.getText() === 'guideTxt' && c.arguments[0] && ts.isStringLiteral(c.arguments[0]) && c.arguments[1] && ts.isIdentifier(c.arguments[1])) wrap[node.name.getText()] = c.arguments[0].text;
      }
      ts.forEachChild(node, findWrap);
    };
    findWrap(sf);
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText();
        let g, sec, vars;
        if (callee === 'guideTxt' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) [g, sec, vars] = [node.arguments[0].text, node.arguments[1], node.arguments[2]];
        else if (wrap[callee]) [g, sec, vars] = [wrap[callee], node.arguments[0], node.arguments[1]];
        if (g && sec && ts.isStringLiteral(sec) && vars && ts.isObjectLiteralExpression(vars)) {
          const text = SECS[g]?.[sec.text];
          const keys = vars.properties.map((p) => (p.name ? p.name.getText().replace(/['"]/g, '') : null));
          if (text != null && !keys.includes(null)) {
            n++;
            const h = holes(text);
            for (const k of keys) if (!h.has(k)) bad.push(`${relative(ROOT, f)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${g} ${sec.text} {${k}}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  assert.ok(n > 50, `값을 넘기는 곳 ${n}`);
  assert.deepEqual(bad, [], '자리표가 없어 값이 버려지는 곳');
});
