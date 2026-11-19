// −/+ 수 칸 공통 (2026-11-19 사용자): 한 번에 1씩 바뀐다. 상한이 1만 이상인 큰 수만 100씩. 모든 −/+ 칸은 가운데 수를 직접 적을 수 있다.
// 단추는 「열쇠:-」「열쇠:+」(열쇠가 없으면 「-」「+」), 직접 입력은 「열쇠=수」(열쇠가 없으면 「수」)를 같은 처리기로 보낸다.

/** −/+ 한 번에 움직이는 폭 */
export const stepOf = (hi: number): number => (hi >= 10000 ? 100 : 1);

/** 단추·직접 입력이 보낸 값으로 다음 수를 정한다 (lo~hi 로 맞춤). 읽을 수 없으면 null (바꾸지 않음) */
export function stepNext(v: string | undefined, cur: number, lo: number, hi: number): number | null {
  const s = String(v ?? '').trim();
  let n: number;
  if (!s.includes('=') && s.endsWith('+')) n = cur + stepOf(hi);
  else if (!s.includes('=') && s.endsWith('-')) n = cur - stepOf(hi);
  else {
    const m = /(?:^|=)\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
    if (!m) return null;
    n = Math.trunc(Number(m[1]));
  }
  return Math.max(lo, Math.min(hi, n));
}
