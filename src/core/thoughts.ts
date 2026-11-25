// 생각 모델의 속생각 블록 (전수검사 11-13)
/** 생각 블록으로 치는 태그 이름: 여기 한 곳에만 둔다 (3차 점검 R01: <thinking> 을 못 떼어 그 안의 상태창·상점 표식이 화면에 그려졌다) */
const NAMES = 'thoughts|thinking|think';
const block = () => new RegExp(`<(${NAMES})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>\\s*`, 'gi');
const OPEN_AT_START = new RegExp(`^\\s*<(?:${NAMES})\\b[^>]*>`, 'i');
const HEAD = new RegExp(`^\\s*(?:<(${NAMES})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>\\s*)+`, 'i');

/** Risu 가 생각 모델의 속생각을 응답 앞에 붙여 저장한 블록 (<Thoughts>…</Thoughts>). 저장 본문에서는 지우지 않고 읽을 때만 뗀다.
 *  닫히지 않은 블록은 글 맨 앞에서 시작할 때만 통째로 생각으로 본다 (전수검사 11-13) */
export function stripThoughts(text: string): string {
  const t = text.replace(block(), '');
  return OPEN_AT_START.test(t) ? '' : t;
}

/** 응답 맨 앞의 생각 블록과 나머지로 나눈다 (상황판 태그 처리는 나머지에만, 저장할 때 다시 붙인다) */
export function splitThoughts(text: string): { head: string; body: string } {
  // 이어진 블록 전부, <Thoughts>·<thinking>·<think> (재검토 11-14 ①-5)
  const m = HEAD.exec(text);
  return m ? { head: m[0], body: text.slice(m[0].length) } : { head: '', body: text };
}

/** 생각 블록 밖의 글에만 f 를 적용한다 (블록은 그대로 둔다). 화면 그리기가 생각 속 표식·그림 태그를 카드로 바꾸지 않게 (3차 점검 R01).
 *  stripThoughts 와 같은 기준: 닫히지 않은 블록이 남은 글 맨 앞이면 그 뒤는 통째로 생각이라 손대지 않는다 */
export function outsideThoughts(text: string, f: (part: string) => string): string {
  const re = block();
  let out = '';
  let at = 0;
  let rest = '';
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const part = text.slice(at, m.index);
    rest += part;
    out += (part ? apply(part, rest, f) : '') + m[0];
    at = m.index + m[0].length;
  }
  const tail = text.slice(at);
  rest += tail;
  return out + (tail ? apply(tail, rest, f) : '');
}
/** rest: 지금까지의 블록 밖 글. 그 맨 앞이 닫히지 않은 블록이면 이 조각은 생각 안이다 */
const apply = (part: string, rest: string, f: (part: string) => string): string => (OPEN_AT_START.test(rest) ? part : f(part));
