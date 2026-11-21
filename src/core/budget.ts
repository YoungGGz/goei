// 요청 토큰 상한 (원본 request_override_*_tokens + 넘칠 때 줄이는 순서).
// 요청문을 다시 만들면서 한 단계씩 줄인다: 이전 위키 문서 → 2차 참조 → 관련 로어북 → 본편 턴 절반씩.
// 요청문 만들기는 동기 함수라 단계는 모듈 변수 하나로 넘긴다 (만드는 동안에만 0이 아님).
import { tokens } from './gnet';

let level = 0;
const LAST = 6;

/** 지금 단계에서 이 자료를 빼야 하는지 */
export const trimPrevious = () => level >= 1;
export const trimSecondary = () => level >= 2;
export const trimRelated = () => level >= 3;

/** 본편 참고 턴 수: 4단계부터 절반씩 (최소 1). 0이면 본편을 보지 않음 */
export function trimTurns(n: number): number {
  if (n <= 0) return 0;
  return level < 4 ? n : Math.max(1, Math.floor(n / 2 ** (level - 3)));
}

/** 같이 싣는 지난 방 수 (괴담톡 보기 전용 방): 1단계부터 절반씩 (최소 1). 방이 많이 쌓여도 상한 안으로 줄일 수 있게 (전수점검 보통-51) */
export function trimRooms(n: number): number {
  return level < 1 ? n : Math.max(Math.min(n, 1), Math.floor(n / 2 ** level));
}

export class BudgetError extends Error {}

export function promptTokens(p: { messages: { content: string }[] }): number {
  return p.messages.reduce((n, m) => n + tokens(m.content), 0);
}

/** cap이 0이면 그대로. 넘으면 단계를 올려 다시 만든다. 끝까지 줄여도 넘으면 BudgetError */
export function fitPrompt<P extends { messages: { content: string }[] }>(cap: number, build: () => P): P {
  if (!(cap > 0)) return build();
  try {
    for (level = 0; ; level++) {
      const p = build();
      const n = promptTokens(p);
      if (n <= cap) return p;
      if (level >= LAST) throw new BudgetError(`요청이 토큰 상한(${cap.toLocaleString()})을 넘어요. 참고 자료를 줄여도 약 ${n.toLocaleString()}토큰이에요. 설정 → 생성 공통(또는 그 기능의 설정)에서 요청 토큰 상한을 올려 주세요.`);
    }
  } finally {
    level = 0;
  }
}

// ── 본편 반영 총 상한 (v0.16.28, 사용자 요청) ──
// 괴담톡·괴담넷·위키 기록은 본편 요청 하나에 같이 붙어 더해진다. 합이 총 상한을 넘으면
// 각 기능의 반영 상한 비율로 나누되, 몫보다 작게 쓰는 기능의 남는 몫은 나머지에 돌린다.

export interface ContextPart {
  /** 그 기능의 반영 토큰 상한 (0 = 제한 없음) */
  cap: number;
  /** 상한을 주면 그 안에서 기록을 다시 고른다 */
  build: (cap: number) => string;
}

export function fitTotal(parts: ContextPart[], total: number): string[] {
  const texts = parts.map((p) => p.build(p.cap));
  if (total <= 0) return texts;
  const size = texts.map((t) => (t ? tokens(t) : 0));
  if (size.reduce((a, b) => a + b, 0) <= total) return texts;
  const weight = parts.map((p) => (p.cap > 0 ? p.cap : total));
  let remaining = total;
  let left = weight.reduce((a, b) => a + b, 0);
  const alloc: number[] = [];
  for (const i of size.map((_, i) => i).sort((a, b) => size[a] - size[b])) {
    const share = Math.floor((remaining * weight[i]) / left);
    alloc[i] = Math.min(size[i], share);
    remaining -= alloc[i];
    left -= weight[i];
  }
  const out = parts.map((p, i) => (alloc[i] >= size[i] ? texts[i] : alloc[i] > 0 ? p.build(alloc[i]) : ''));
  // 잘린 기능이 몫보다 덜 쓰면(기록 단위로 고르니 몫을 다 못 채운다) 남는 자리를 아직 덜 들어간 기능에 다시 나눠 준다 (전수점검 보통-4).
  // 기능 수만큼만 돈다: 매번 몫이 늘거나 끝나므로 그 안에 멈춘다
  // 처음 나눈 몫으로 이미 총 상한 이하가 아니면(기록 하나가 몫보다 크면) 더 주지 않는다. 더 줄 때도 실제 합이 총 상한을 넘는 몫은 받지 않는다
  const used = out.map((t) => (t ? tokens(t) : 0));
  const capOf = alloc.slice();
  const stuck = new Set<number>();
  for (let round = 0; round < parts.length; round++) {
    const slack = total - used.reduce((a, b) => a + b, 0);
    const open = parts.map((_, i) => i).filter((i) => capOf[i] < size[i] && !stuck.has(i));
    if (slack <= 0 || !open.length) break;
    const w = open.reduce((a, i) => a + weight[i], 0);
    let grew = false;
    for (const i of open) {
      const room = total - used.reduce((a, b) => a + b, 0);
      const more = Math.min(room, Math.floor((slack * weight[i]) / w));
      if (more <= 0) continue;
      const cap = Math.min(size[i], capOf[i] + more);
      const t = cap >= size[i] ? texts[i] : parts[i].build(cap);
      const n = t ? tokens(t) : 0;
      if (n - used[i] > room) {
        stuck.add(i);
        continue;
      }
      capOf[i] = cap;
      if (n > used[i]) grew = true;
      out[i] = t;
      used[i] = n;
    }
    if (!grew) break;
  }
  return out;
}
