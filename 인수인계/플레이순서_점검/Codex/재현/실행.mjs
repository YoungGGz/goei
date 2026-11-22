import { spawnSync } from 'node:child_process';
import { globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const plan = JSON.parse(readFileSync(resolve(here, '목록.json'), 'utf8'));

export async function run(number) {
  const {unit, jobs} = plan[number - 1];
  const scratch = resolve(root, '.scratch');
  mkdirSync(scratch, {recursive:true});
  const output = mkdtempSync(resolve(scratch, 'play-audit-' + number + '-'));
  console.log('실행 기록', output);
  function execute(name, args, extra = {}) {
    const result = spawnSync(process.execPath, args, {
      cwd: root, encoding:'utf8', maxBuffer:64 * 1024 * 1024,
      env: {...process.env, ...extra, AUDIT_LOG:output, AUDIT_NAME:name},
    });
    const text = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
    writeFileSync(resolve(output, name + '.log'), text);
    process.stdout.write(text);
    if (result.status !== 0 || (name.includes('claude-shop') && /^FAIL /m.test(text))) process.exitCode = 1;
  }
  const tests = unit.flatMap(p => globSync('tests/' + p + '.test.mjs', {cwd:root}));
  execute('단위시험', ['--import','./tests/world-preload.mjs','--test','--test-concurrency=1',...new Set(tests)]);
  for (const [index, job] of jobs.entries()) {
    const path = job.script.startsWith('@') ? resolve(here, job.script.slice(1)) : resolve(root,job.script);
    const name = (index + 1) + '-' + basename(path,'.mjs') + (job.env?.ONLY || '');
    const args = ['--import',resolve(here,'hooks.mjs'),path];
    if (job.arg === 'fixture') args.push(resolve(scratch,'fixture/fixture.json'));
    if (job.arg === 'dir') args.push(resolve(output,name));
    execute(name,args,job.env);
  }
}
