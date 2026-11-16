/**
 * 호출 기록 › 메인 요청 조립의 줄 이름표 (사용자 2026-11-15: 어느 단계가 넣은 줄인지 보이게).
 * 단계 하나가 메시지 배열을 바꿀 때마다 앞뒤를 비교해 줄마다 이름표를 붙인다.
 * - 플러그인이 새로 넣은 줄: 그 단계 이름 (참고 기록은 「참고 기록 · 괴담넷」처럼 어느 기능 것인지까지)
 * - 원래 있던 줄을 고친 경우: 원래 이름표 뒤에 「○○ 고침」
 * - 그대로인 줄: 원래 이름표 그대로 (Risu 가 보낸 줄이면 빈 글)
 */
import type { PromptMessage } from './request';

const str = (m: PromptMessage | undefined): string => (typeof m?.content === 'string' ? m.content : '');
const join = (a: string, b: string): string => (a ? `${a} · ${b}` : b);

/** 참고 기록 덩어리 이름: 「참고 기록 · 괴담넷」. 어느 기능 것인지 못 읽으면 「참고 기록」 */
const FEATURE_NAME: Record<string, string> = { phone: '괴담톡', wiki: '위키', homeshop: '망상홈쇼핑' };
export function contextTag(content: string): string {
  const m = /\{"feature":"(\w+)"(?:,"site":"((?:[^"\\]|\\.)*)")?/.exec(content);
  if (!m) return '참고 기록';
  const name = m[1] === 'gnet' ? (m[2] ? (JSON.parse(`"${m[2]}"`) as string) : '') : FEATURE_NAME[m[1]] ?? '';
  return name ? `참고 기록 · ${name}` : '참고 기록';
}

/**
 * 단계 하나를 지난 뒤의 이름표. prev·prevTags 는 단계 전 배열과 그 이름표, next 는 단계 뒤 배열.
 * name 은 단계 이름, 또는 새로 넣은 줄마다 이름을 정하는 함수 (참고 기록)
 */
export function tagStep(prev: readonly PromptMessage[], prevTags: readonly string[], next: readonly PromptMessage[], name: string | ((m: PromptMessage) => string)): string[] {
  if (prev === next) return [...prevTags];
  const nameOf = (m: PromptMessage) => (typeof name === 'string' ? name : name(m));
  const stepName = typeof name === 'string' ? name : '';
  const used = new Set<number>();
  const out: (string | undefined)[] = new Array(next.length);
  // 1) 같은 메시지(그대로 넘어온 것)
  next.forEach((m, i) => {
    const j = prev.indexOf(m);
    if (j >= 0 && !used.has(j)) {
      used.add(j);
      out[i] = prevTags[j] ?? '';
    }
  });
  // 2) 같은 역할·같은 글 (새 객체로 다시 만든 것)
  next.forEach((m, i) => {
    if (out[i] !== undefined) return;
    const t = str(m);
    const j = prev.findIndex((p, k) => !used.has(k) && p?.role === m?.role && str(p) === t);
    if (j >= 0) {
      used.add(j);
      out[i] = prevTags[j] ?? '';
    }
  });
  // 3) 고친 줄: 남은 앞 줄 가운데 같은 역할이고 앞뒤가 가장 많이 같은 것. 같은 곳이 20자 이상이거나 짧은 쪽의 절반 이상이면 고친 것.
  //    그 역할의 줄 수가 단계 앞뒤로 같으면(넣거나 빼지 않았으면) 남은 같은 역할 줄은 고친 것으로 본다
  const count = (ms: readonly PromptMessage[], role: unknown) => ms.reduce((n, x) => n + (x?.role === role ? 1 : 0), 0);
  next.forEach((m, i) => {
    if (out[i] !== undefined) return;
    const t = str(m);
    let best = -1;
    let score = -1;
    let short = 0;
    prev.forEach((p, k) => {
      if (used.has(k) || p?.role !== m?.role) return;
      const o = str(p);
      const lim = Math.min(o.length, t.length);
      let a = 0;
      while (a < lim && o[a] === t[a]) a++;
      let b = 0;
      while (b < lim - a && o[o.length - 1 - b] === t[t.length - 1 - b]) b++;
      if (a + b > score) {
        best = k;
        score = a + b;
        short = lim;
      }
    });
    if (best >= 0 && (score >= 20 || (score > 0 && score * 2 >= short) || count(prev, m?.role) === count(next, m?.role))) {
      used.add(best);
      out[i] = join(prevTags[best] ?? '', `${stepName || nameOf(m)} 고침`);
    } else out[i] = nameOf(m);
  });
  return out as string[];
}
