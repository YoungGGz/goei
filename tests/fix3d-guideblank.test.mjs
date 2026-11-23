// 2차 점검 16-문제3: guideTxt 로 읽어 비우면 기본 글이 쓰이는 절은 편집 화면에 「비우면 기본 글이 쓰여요」 표시가 붙어야 한다
// (전수검사 11-13 나-51 사용자: 표시 = 실제로 기본 글을 쓰는 절). 코드를 읽어 guideTxt 로 읽는 절을 모두 모아 표시 목록과 대조한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/fix3d/guideblank';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
await build({ stdin: { contents: `export * from './src/core/guides';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const G = await import(pathToFileURL(outfile));

async function srcFiles(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...(await srcFiles(p)));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
/** 여는 괄호 다음부터 짝이 맞는 닫는 괄호까지 */
function argsAt(t, i) {
  let depth = 1;
  let j = i;
  for (; j < t.length && depth > 0; j++) {
    const c = t[j];
    if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  return t.slice(i, j - 1);
}
/** 첫 쉼표(괄호 밖) 뒤의 둘째 인자 */
function secondArg(args) {
  let depth = 0;
  const parts = [];
  let cur = '';
  for (const c of args) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((s) => s.trim());
}
const GUIDE_VARS = { guide: ['Shop', 'Cos', 'Bm', 'Hs'], 'rollGuide(site)': ['Cos', 'Bm'], 'SITE_GUIDE[viewSite(src.chat.scriptstate)]': ['GNet', 'Gal', 'Wpf', 'Salmon'], 'BOARD_GUIDE[site]': ['GNet', 'Gal', 'Wpf', 'Salmon'] };

test('guideTxt 로 읽는 절은 모두 「비우면 기본 글이 쓰여요」 표시 대상 (16-문제3)', async () => {
  const used = new Map();
  const add = (names, sec, f) => { for (const n of names) if (G.guideDefaultSec(n, sec) !== null) used.set(`${n}|${sec}`, f); };
  const addPrefix = (names, pre, f) => {
    for (const n of names) for (const m of G.guideDefault(n).matchAll(/@@SECTION ([^\n]+)\n/g)) if (m[1].trim().startsWith(pre)) used.set(`${n}|${m[1].trim()}`, f);
  };
  const take = (names, arg, f) => {
    // 글자 그대로의 절 이름 (삼항 둘 다), 꼴 글자 「X.${…}」 은 그 앞부분으로 시작하는 절 전부
    for (const m of arg.matchAll(/'([A-Z][A-Z0-9_.]*)'/g)) add(names, m[1], f);
    for (const m of arg.matchAll(/`([A-Z][A-Z0-9_.]*)\$\{/g)) addPrefix(names, m[1], f);
  };
  for (const f of await srcFiles(join(process.cwd(), 'src'))) {
    if (f.endsWith('/core/guides.ts')) continue;
    const t = await readFile(f, 'utf8');
    const wrappers = [];
    for (const m of t.matchAll(/guideTxt\(/g)) {
      const [g, s] = secondArg(argsAt(t, m.index + m[0].length));
      const names = /^'([A-Za-z]+)'$/.exec(g)?.[1] ? [g.slice(1, -1)] : GUIDE_VARS[g] ?? null;
      if (!names || s === undefined) continue;
      if (/^[a-z]\w*$/.test(s)) {
        // 감싸개: const X = (s…) => guideTxt('Name', s …)
        const head = t.slice(Math.max(0, m.index - 160), m.index);
        const w = new RegExp(`(?:const|let) (\\w+) = \\(${s}\\b[^)]*\\)[^=]*=> *$`).exec(head);
        if (w) wrappers.push([w[1], names]);
        continue;
      }
      take(names, s, f);
    }
    for (const [w, names] of wrappers) for (const m of t.matchAll(new RegExp(`\\b${w}\\(`, 'g'))) take(names, secondArg(argsAt(t, m.index + m[0].length))[0] ?? '', f);
  }
  assert.ok(used.size > 300, `모은 절 수 ${used.size}`);
  const miss = [...used].filter(([k]) => { const [n, s] = k.split('|'); return !G.blankUsesDefault(n, s); }).map(([k, f]) => `${k.replace('|', ' ')} (${f.split('/src/')[1]})`);
  assert.deepEqual(miss, []);
});

test('2차 점검이 찾은 절 18개에 표시가 붙는다', () => {
  for (const [n, s] of [['Hs', 'ORDERS_OPENED'], ['Hs', 'ORDERS_BOX_GONE'], ['Hs', 'ORDERS_SEALED'], ['Hs', 'ORDERS_LINE'], ['Hs', 'ORDERS_AND'], ['Hs', 'HEAD_ORDERS'], ['Hs', 'ORDERS_NONE'], ['Bm', 'PICKUP_TRY'], ['Bm', 'PICKUP_WAIT'], ['Director', 'FACTS'], ['Director', 'SCENE'], ['Router', 'ROLE'], ['Router', 'RULES'], ['Phone', 'ANNOUNCEMENTS'], ['Phone', 'MAIN_CONTEXT.VIEWS'], ['Phone', 'MAIN_CONTEXT.HABITS'], ['Cos', 'BOUGHT_LINE'], ['Bm', 'BOUGHT_LINE']]) {
    assert.equal(G.blankUsesDefault(n, s), true, `${n} ${s}`);
  }
  // guideSec 로만 읽는 절(비우면 요청에서 빠짐)에는 표시가 없다
  assert.equal(G.blankUsesDefault('Router', 'NO_SUCH_SECTION'), false);
});
