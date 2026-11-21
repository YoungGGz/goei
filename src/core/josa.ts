// 이름 뒤 조사: 마지막 글자에 받침이 있으면 앞의 것(을·이·은·과), 없으면 뒤의 것(를·가·는·와).
// 숫자·영문 끝은 읽는 소리로 본다 (전수점검 사소-2: 「v0.21.23가」「goei-body.3.txt을」): 숫자는 영·일·삼·육·칠·팔에 받침,
// 영문 글자는 이름(엘·엠·엔·알)에 받침. 그 밖의 글자(기호 등)는 받침을 알 수 없어 「을(를)」처럼 둘 다 적는다.
const DIGIT_BATCHIM = '013678';
const LATIN_BATCHIM = 'lmnr';
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) return `${word}${code % 28 ? withBatchim : without}`;
  if (/[0-9]/.test(last)) return `${word}${DIGIT_BATCHIM.includes(last) ? withBatchim : without}`;
  if (/[a-z]/i.test(last)) return `${word}${LATIN_BATCHIM.includes(last.toLowerCase()) ? withBatchim : without}`;
  return `${word}${withBatchim}(${without})`;
}
/** 「으로/로」: ㄹ 받침(일·칠·팔, l)과 받침 없는 말은 「로」 */
export function josaRo(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  const fin = code >= 0 && code <= 11171 ? code % 28 : /[0-9]/.test(last) ? ('0369'.includes(last) ? 1 : '178'.includes(last) ? 8 : 0) : /[a-z]/i.test(last) ? ('mnr'.includes(last.toLowerCase()) ? 1 : last.toLowerCase() === 'l' ? 8 : 0) : -1;
  if (fin < 0) return `${word}(으)로`;
  return `${word}${fin && fin !== 8 ? '으로' : '로'}`;
}
