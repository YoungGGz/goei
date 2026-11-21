// 화면 시험용 assert: 틀려도 멈추지 않고 모아 두었다가 끝에 한 번에 보여 준다 (사용자 11-21).
// 한 번 돌리는 데 오래 걸리는 시험이 첫 실패에서 멈춰, 한 번에 한 군데씩만 고치던 것을 막는다.
// 쓰는 법: `import assert from './soft-assert.mjs';` (node:assert/strict 와 같은 이름·인자)
// 끝나면(process.exit 를 부르든 그냥 끝나든) 틀린 것을 모두 찍고 종료 코드를 1 로 만든다.
// 멈추게 하려면 SOFT_ASSERT=0.
import strict from 'node:assert/strict';

const fails = [];
const hard = process.env.SOFT_ASSERT === '0';

function where(err) {
  const line = String(err.stack || '').split('\n').find((l) => /-browser\.mjs:\d+/.test(l) || /tests\/[^/]+\.mjs:\d+/.test(l) && !l.includes('soft-assert.mjs'));
  return line ? line.trim().replace(/^at\s+/, '').replace(/^.*?\((.*)\)$/, '$1').replace(/^file:\/\/.*?\/tests\//, 'tests/') : '';
}

function record(err) {
  if (hard || !(err instanceof strict.AssertionError)) throw err;
  const at = where(err);
  const msg = String(err.message).split('\n').slice(0, 8).join('\n    ');
  fails.push(`${at ? at + '\n    ' : ''}${msg}`);
  console.log(`✗ (${fails.length}) ${String(err.message).split('\n')[0]}${at ? '  — ' + at : ''}`);
}

function wrap(fn) {
  return function (...args) {
    try {
      const r = fn.apply(strict, args);
      if (r && typeof r.then === 'function') return r.catch(record);
      return r;
    } catch (e) { record(e); }
  };
}

const soft = wrap(strict);
for (const k of Object.keys(strict)) soft[k] = typeof strict[k] === 'function' && k !== 'AssertionError' ? wrap(strict[k]) : strict[k];
soft.AssertionError = strict.AssertionError;
soft.strict = soft;
/** 지금까지 틀린 수 */
soft.failCount = () => fails.length;

let reported = false;
function report() {
  if (reported) return;
  reported = true;
  if (!fails.length) return;
  console.log(`\n틀린 곳 ${fails.length}개 (한 번에 모아 보여 줌)`);
  fails.forEach((f, i) => console.log(`${i + 1}. ${f}`));
}
const realExit = process.exit.bind(process);
process.exit = (code) => { report(); realExit(fails.length ? 1 : code); };
process.on('exit', (code) => { report(); if (fails.length && !code) process.exitCode = 1; });

export default soft;
