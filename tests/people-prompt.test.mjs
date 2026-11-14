import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-prompt-'));
await build({ entryPoints: ['src/core/people/prompt/index.ts', 'src/core/people/updater.ts', 'src/core/people/settings.ts', 'src/core/people/types.ts', 'src/core/people/store.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const P = await mod('prompt/index');
const U = await mod('updater');
const St = await mod('settings');
const T = await mod('types');
const S = await mod('store');

const sections = (t) => [...t.matchAll(/<<SECTION:([a-z_]+)>>/g)].map((m) => m[1]).sort();

test('지침 두 벌: 절 표식이 같고 짝이 맞고, 조립하면 표식이 남지 않는다', () => {
  assert.deepEqual(sections(P.UPDATER_DETAILED), sections(P.UPDATER_COMPACT));
  for (const t of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const open = [...t.matchAll(/<<SECTION:([a-z_]+)>>/g)].length;
    const close = [...t.matchAll(/<<END:([a-z_]+)>>/g)].length;
    assert.equal(open, close);
    assert.ok(!t.includes('{{') && !t.includes('}}'), 'CBS 기호 없음');
  }
  const s = St.peopleSettings({});
  const full = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '');
  assert.ok(!/<<[A-Z_:a-z]+>>/.test(full));
  assert.ok(!/User rules/.test(full), '규칙이 없으면 user_rules 절은 빠진다');
  const withRules = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '한국어 존댓말로만 판정한다');
  assert.match(withRules, /User rules[\s\S]*한국어 존댓말로만/);
  const off = U.assemblePrompt(P.promptFor(s), new Set(), '');
  assert.ok(off.length < full.length);
  assert.ok(!/<<[A-Z_:a-z]+>>/.test(off));
  // 간결판이 자세히판보다 짧고, 둘 다 출력 계약을 담는다
  assert.ok(P.UPDATER_COMPACT.length < P.UPDATER_DETAILED.length);
  for (const t of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) assert.match(t, /"new_people"[\s\S]*"docs"[\s\S]*"suspicion"[\s\S]*"next_note"/);
});

