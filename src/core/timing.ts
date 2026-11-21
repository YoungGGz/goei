// 기다리는 시간 설정 (전수점검 보통-5·사소-9: 응답 대기·재시도 간격·진행 창 시간이 코드에 박혀 있었다. 사용자 규칙: 박힌 시간도 설정 값으로).
// 기본값 = 전에 코드에 고정돼 있던 값. 모두 이 기기 공통 값(core/settings.ts Prefs.times)이고, 저장소에서 읽을 때 setTimes 로 넣는다.
// 다른 모듈을 끌어오지 않는다 (core/progress·host/llm·host/waiting 이 같이 쓴다)

export const TIME_SPEC = {
  /** 모델 호출이 아무 응답도 없을 때(받는 중이면 마지막 조각부터) 실패로 보는 시간 */
  modelIdle: { label: '모델 응답 대기', def: 5, lo: 1, hi: 60, unit: '분' },
  /** 모델 일시 오류 뒤 같은 요청을 다시 보내기 전에 쉬는 시간 */
  retryGap: { label: '재시도 간격', def: 1200, lo: 0, hi: 10000, unit: '밀리초' },
  /** 본편 응답을 기다리는 시간 (「사용」 잠금·대기 연출) */
  mainWait: { label: '메인 응답 대기', def: 3, lo: 1, hi: 30, unit: '분' },
  /** 그 시간이 다 됐는데 아직 만드는 중이면 다시 확인할 때까지 */
  mainAgain: { label: '응답 다시 확인', def: 30, lo: 5, hi: 300, unit: '초' },
  /** 응답 대기 중 「취소」를 한 번 더 눌러야 통과하는 시간 */
  cancelTwice: { label: '취소 두 번 누르기', def: 5, lo: 1, hi: 30, unit: '초' },
  /** 호출 진행 창이 본편 응답을 기다리다 실패로 닫는 시간 */
  progWatch: { label: '진행 감시', def: 10, lo: 1, hi: 60, unit: '분' },
  /** 호출 진행 창이 끝난 턴을 펼친 채 두는 시간 (성공 · 실패) */
  progHideOk: { label: '진행 창 펼침 (성공)', def: 5, lo: 1, hi: 60, unit: '초' },
  progHideFail: { label: '진행 창 펼침 (실패)', def: 10, lo: 1, hi: 120, unit: '초' },
} as const;
export type TimeKey = keyof typeof TIME_SPEC;
export const TIME_KEYS = Object.keys(TIME_SPEC) as TimeKey[];

let times: Partial<Record<TimeKey, number>> = {};

/** 저장소 값을 검사해 넣고, 맞는 값만 돌려준다 (틀린 칸은 버림) */
export function setTimes(raw: unknown): Partial<Record<TimeKey, number>> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Partial<Record<TimeKey, number>> = {};
  for (const k of TIME_KEYS) {
    const n = o[k];
    const s = TIME_SPEC[k];
    if (typeof n === 'number' && Number.isInteger(n) && n >= s.lo && n <= s.hi && n !== s.def) out[k] = n;
  }
  times = out;
  return out;
}

/** 설정 값 (단위 그대로) */
export const timeOf = (k: TimeKey): number => times[k] ?? TIME_SPEC[k].def;
/** 밀리초 */
export const timeMs = (k: TimeKey): number => {
  const u = TIME_SPEC[k].unit;
  return timeOf(k) * (u === '분' ? 60_000 : u === '초' ? 1000 : 1);
};
