// 생성 방식 (라이트보드 5.0.0에서 옮김, 2026-11-06 사용자 「전부 넣어야지」): 괴담넷·괴담톡·위키 요청문에 공통으로 덧붙이는 것.
// - 생각 단계 (원본 「생각보조」 적고 제거 / 생각만 / 안하기): 기능마다 다른 순서표(지침의 THOUGHTS.* 절)를 붙인다.
//   적고 지움이면 모델이 <lb-process> 안에 짧게 적고, 모델 호출(host/llm.ts)이 그 칸을 떼고 결과만 넘긴다.
// - 비망록 (원본 「탈옥 (비망록)」): 지침의 MEMO.* 절. 맨 앞에 인물 글과 작업 문장, 맨 끝에 미리 채운 응답과 사용자 한마디.
// 다시 보기·동시 요청 수·재시도 문구는 모델 호출 쪽(host/llm.ts)에서 한다.
import { advNum, advValue, type AdvFeature } from './advanced';
import { guideTxt } from './guides';

export type ThoughtsMode = 'off' | 'inner' | 'note';
type State = Record<string, unknown> | undefined;
type Feature = Exclude<AdvFeature, 'gen'>;

export interface CraftSettings {
  thoughts: ThoughtsMode;
  memo: boolean;
  /** 다시 보기 횟수. 기능 값이 0이면 공통 값 */
  reiterate: number;
}

export function craftSettings(state: State, f: Feature): CraftSettings {
  const t = advValue(state, f, 'thoughts');
  return {
    thoughts: t === 'inner' || t === 'note' ? t : 'off',
    memo: advValue(state, f, 'memo') === '1',
    reiterate: advNum(state, f, 'reiterate') || advNum(state, 'gen', 'reiterate'),
  };
}

/** 기능별 전용 모델 ID: 없앤 기능 (2026-11-12 사용자). 부르는 곳은 그대로 두고 늘 「없음」을 돌려준다 → 메인·보조 설정대로 */
export function featureModel(_state: State, _f: Feature): string | undefined {
  return undefined;
}

export interface CraftTexts {
  /** 이 작업의 생각 순서표 (없으면 생각 단계를 붙이지 않는다) */
  thoughts?: string;
  memo?: { persona: string; job: string; prefill: string; prefillUser: string };
}

export interface CraftMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 다시 물을 때 붙이는 지시: 원인은 속으로만 따지고 고친 결과만 쓰게 한다 (분석 칸을 쓰게 하면 그 글은 버려진다). 옛 글대로 <lb-process> 칸이 와도 모델 호출이 지운다.
 *  글은 지침 「요청 공통」의 RETRY.ANALYZE 절, 생각 단계 머리말(원본 lb.thoughts, 모드별)은 THOUGHTS.* 절, 비망록 작업 머리는 MEMO.JOB_TITLE 절 (설정 → 지침에서 고침) */
export const retryAnalyze = (): string => guideTxt('Common', 'RETRY.ANALYZE');

/** system 칸 하나를 고친다 (첫 system, 없으면 맨 앞에 새로) */
function editSystem(messages: CraftMessage[], edit: (s: string) => string): CraftMessage[] {
  const i = messages.findIndex((m) => m.role === 'system');
  if (i < 0) return [{ role: 'system', content: edit('') }, ...messages];
  return messages.map((m, j) => (j === i ? { ...m, content: edit(m.content) } : m));
}

/** 요청문에 생각 단계·비망록을 덧붙인다. 설정이 꺼져 있거나 지침에 그 절이 없으면 그대로 */
export function craftMessages<M extends CraftMessage>(messages: M[], s: CraftSettings, texts: CraftTexts): CraftMessage[] {
  let out: CraftMessage[] = messages;
  const steps = texts.thoughts?.trim();
  if (steps && s.thoughts !== 'off') {
    const block = s.thoughts === 'note' ? `${guideTxt('Common', 'THOUGHTS.NOTE_TITLE')}\n${guideTxt('Common', 'THOUGHTS.NOTE_HEAD')}\n\n${steps}\n\n${guideTxt('Common', 'THOUGHTS.NOTE_TAIL')}` : `${guideTxt('Common', 'THOUGHTS.INNER_TITLE')}\n${guideTxt('Common', 'THOUGHTS.INNER_HEAD')}\n\n${steps}`;
    out = editSystem(out, (sys) => `${sys}\n\n${block}`);
  }
  const memo = texts.memo;
  if (s.memo && memo && memo.persona.trim()) {
    out = editSystem(out, (sys) => `${memo.persona.trim()}\n\n${memo.job.trim() ? `${guideTxt('Common', 'MEMO.JOB_TITLE')}\n${memo.job.trim()}\n\n` : ''}${sys}`);
    if (memo.prefill.trim()) {
      out = [...out, { role: 'assistant', content: memo.prefill.trim() }];
      if (memo.prefillUser.trim()) out = [...out, { role: 'user', content: memo.prefillUser.trim() }];
    }
  }
  return out;
}

/** 지침 절 읽기 함수로 비망록 묶음을 만든다 */
export function memoTexts(read: (name: string) => string): CraftTexts['memo'] {
  return { persona: read('MEMO.PERSONA'), job: read('MEMO.JOB'), prefill: read('MEMO.PREFILL'), prefillUser: read('MEMO.PREFILL_USER') };
}
