// 상태창의 위키 이름 밑줄: 띄어쓰기가 달라도 같은 이름 (2026-11-19 사용자: 「화요 퀴즈쇼」라고 쓰면 위키 연결이 안 됨). ui/status.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export { linkTerms, looseTerm, sameTerm } from './src/ui/status';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', loader: { '.txt': 'text', '.css': 'text' } });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const link = (t) => `<span class="gst-link" data-goei-wiki="1">${t}</span>`;
const terms = [
  { term: '화요퀴즈쇼', title: '화요퀴즈쇼', loose: true },
  { term: '여우 상담실', title: '여우 상담실', loose: true },
  { term: '이도형', title: '이도형' },
  { term: '관리국', title: '초자연 재난관리국', loose: true },
];

test('띄어 쓴 이름에도 밑줄을 긋는다', () => {
  assert.equal(M.linkTerms('화요 퀴즈쇼 스튜디오', terms), `${link('화요 퀴즈쇼')} 스튜디오`);
  assert.equal(M.linkTerms('화요퀴즈쇼 스튜디오', terms), `${link('화요퀴즈쇼')} 스튜디오`);
  assert.equal(M.linkTerms('여우상담실 앞', terms), `${link('여우상담실')} 앞`);
  assert.equal(M.linkTerms('여우 상담실 앞', terms), `${link('여우 상담실')} 앞`);
});

test('사람 이름(loose 아님)은 글자가 똑같을 때만', () => {
  assert.equal(M.linkTerms('이 도형은 뭐지', terms), '이 도형은 뭐지');
  assert.equal(M.linkTerms('이도형 요원', terms), `${link('이도형')} 요원`);
});

test('줄이 바뀌면 같은 이름으로 보지 않는다', () => {
  assert.equal(M.linkTerms('화요\n퀴즈쇼', terms), '화요\n퀴즈쇼');
});

test('누른 밑줄 글로 문서를 찾는다', () => {
  const find = (name) => (terms.find((t) => t.term === name) ?? terms.find((t) => M.sameTerm(t, name)))?.title;
  assert.equal(find('화요 퀴즈쇼'), '화요퀴즈쇼');
  assert.equal(find('여우상담실'), '여우 상담실');
  assert.equal(find('이 도형'), undefined);
});

test('띄어쓰기를 봐주는 이름: 한글이 든 세 글자 이상', () => {
  assert.equal(M.looseTerm('화요퀴즈쇼'), true);
  assert.equal(M.looseTerm('소라'), false);
  assert.equal(M.looseTerm('Tuesday Quiz Show'), false);
});
