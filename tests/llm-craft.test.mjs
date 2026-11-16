// 모델 호출: 다시 보기·동시 요청 수·생각 칸 지우기·재시도 원인 분석 (라이트보드 5.0.0, 2026-11-06)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

await build({ entryPoints: ['src/host/llm.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/llm.mjs', logLevel: 'silent' });
const { generate, isOwnMainCall } = await import('../dist-test/llm.mjs');

test('llm: 다시 보기는 첫 응답 뒤 n번, 고친 응답을 쓴다. 생각 칸은 지운다', async () => {
  const calls = [];
  let n = 0;
  globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: n++ === 0 ? '<lb-process>짧은 생각</lb-process>첫답' : `고친답${n}` }) };
  const { raw } = await generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same', reiterate: 2 });
  assert.equal(calls.length, 3);
  assert.equal(raw, '고친답3');
  assert.equal(calls[1].messages.at(-2).content, '첫답', '생각 칸을 뗀 응답으로 다시 묻는다');
  assert.match(calls[1].messages.at(-1).content, /Reiteration phase \(1\/2\)/);
});

test('llm: 재시도 문구에 원인 분석, 동시 요청 수를 넘지 않는다', async () => {
  const calls = [];
  globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: calls.length === 1 ? 'bad' : 'ok' }) };
  await generate([{ role: 'user', content: 'Q' }], 'aux', (r) => { if (r === 'bad') throw new Error('형식'); return r; }, { retries: 1, retryModel: 'same' });
  assert.match(calls[1].messages.at(-1).content, /analyze the error source/);

  let live = 0;
  let peak = 0;
  globalThis.risuai = { runLLMModel: async () => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 20)); live--; return { type: 'success', result: 'x' }; } };
  const o = { retries: 0, retryModel: 'same', concurrent: 2 };
  await Promise.all([1, 2, 3, 4, 5].map(() => generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, o)));
  assert.equal(peak, 2);
  peak = 0;
  await Promise.all([1, 2, 3].map(() => generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same' })));
  assert.equal(peak, 3, '0이면 제한 없음');
});

test('llm: 전용 모델 ID는 staticModel로, 다시 물을 때도 그대로', async () => {
  const calls = [];
  globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: calls.length === 1 ? 'bad' : 'ok' }) };
  await generate([{ role: 'user', content: 'Q' }], 'aux', (r) => { if (r === 'bad') throw new Error('형식'); return r; }, { retries: 1, retryModel: 'main', staticModel: 'gpt-4o' });
  assert.equal(calls[0].staticModel, 'gpt-4o');
  assert.equal(calls[1].staticModel, 'gpt-4o');
  assert.equal(calls[1].mode, 'model');
  calls.length = 0;
  await generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same' });
  assert.equal('staticModel' in calls[0], false, '비우면 보내지 않는다');
});

test('llm: 모델 일시 오류에 다시 보내는 횟수는 설정을 따른다 (없으면 2, 0이면 다시 보내지 않음)', async () => {
  let n = 0;
  const empty = { runLLMModel: async () => (n++, { type: 'success', result: '' }) };
  globalThis.risuai = empty;
  await assert.rejects(generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 3, retryModel: 'same', transientRetries: 0 }), /빈 응답/);
  assert.equal(n, 1, '0회: 한 번만 보낸다 (형식 오류 재시도 횟수와 무관)');
  n = 0;
  await assert.rejects(generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same', state: { $gen_transient: '0' } }), /빈 응답/);
  assert.equal(n, 1, '채팅 설정에서 읽는다');
  n = 0;
  await assert.rejects(generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same', transientRetries: 1 }), /빈 응답/);
  assert.equal(n, 2, '1회: 한 번 더');
  n = 0;
  await assert.rejects(generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same' }), /빈 응답/);
  assert.equal(n, 3, '설정이 없으면 전과 같이 2회 더');
});

test('llm: 메인 모델로 보내는 보조 호출은 보내는 동안만 자기 호출로 알아본다', async () => {
  const seen = [];
  globalThis.risuai = { runLLMModel: async (o) => (seen.push([o.mode, isOwnMainCall(o.messages), isOwnMainCall([{ role: 'system', content: '본편' }, { role: 'user', content: 'Q' }])]), { type: 'success', result: 'ok' }) };
  const msgs = [{ role: 'system', content: 'S' }, { role: 'user', content: 'Q' }];
  await generate(msgs, 'main', (r) => r, { retries: 0, retryModel: 'same' });
  await generate(msgs, 'aux', (r) => r, { retries: 0, retryModel: 'same' });
  assert.deepEqual(seen, [['model', true, false], ['submodel', false, false]]);
  assert.equal(isOwnMainCall(msgs), false, '끝난 뒤에는 아님');
  assert.equal(isOwnMainCall([]), false);
});
