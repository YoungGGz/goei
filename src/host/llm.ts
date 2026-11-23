// 모델 호출 (위키·괴담넷·괴담톡 생성). 본편 요청과 따로, 사용자가 그 화면에서 누를 때만 부른다.
import { timeMs, timeOf } from '../core/timing';
import { prepareAttachments } from '../core/attach';
import { clip, requestText, traceCall, traceMark } from './trace';
import { tokens } from '../core/gnet';
import { photoData } from './photo';
import { advNum, applyAdvanced, applyGenLimits } from '../core/advanced';
import { setItemRules } from '../core/itemrules';
import { retryAnalyze } from '../core/craft';
import { guideTxt } from '../core/guides';
import { imageMissingLine } from '../core/attach';
import { progressCallChunk, progressCallEnd, progressCallStart, progressCallTokens } from '../core/progress';
export type ModelChoice = 'main' | 'aux';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(message: string, readonly raw = '') {
    super(message);
  }
}

/** 생각 블록 제거 (생각 단계 「적고 지움」의 <lb-process> 포함). <thinking> 도 (전수검사 11-13) */
export function stripThoughts(s: string): string {
  let t = s.replace(/<(thoughts|thinking|think|lb-process)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  // 여는 태그 없이 닫는 태그만 남은 생각 글 (일부 추론 모델은 여는 태그를 떼고 보낸다): 마지막 닫는 태그까지가 생각이다 (전수점검 사소-10)
  const close = [...t.matchAll(/<\/(?:thoughts|thinking|think|lb-process)\s*>/gi)].pop();
  if (close && close.index !== undefined) t = t.slice(close.index + close[0].length);
  // 맨 앞의 닫히지 않은 칸: 「{」「[」나 생각 칸이 아닌 태그로 시작하는 줄부터는 답으로 남긴다. 그런 줄이 없으면 전처럼 다 지운다 (전수검사 11-13)
  const head = /^\s*<(?:thoughts|thinking|think|lb-process)\b[^>]*>/i.exec(t);
  if (head) {
    const rest = t.slice(head[0].length);
    const ans = /^[ \t]*(?:[{[]|<(?!\/?(?:thoughts|thinking|think|lb-process)\b))/m.exec(rest);
    return ans ? rest.slice(ans.index) : '';
  }
  return t.replace(/<(?:thoughts|thinking|think|lb-process)\b[^>]*>[\s\S]*$/gi, '');
}

async function readStream(stream: ReadableStream<unknown>, onChunk?: (chars: number) => void): Promise<string> {
  const reader = stream.getReader();
  let last = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (typeof value === 'string') last = value;
      else if (value && typeof value === 'object') last = String(Object.values(value as Record<string, unknown>)[0] ?? last);
      onChunk?.(last.length); // 진행 창: 받는 중인 글자 수 (Risu 가 스트리밍으로 돌려줄 때만)
    }
  } finally {
    reader.releaseLock();
  }
  return last;
}

/** ATTACHMENT DATA 메시지의 사진 경로를 실제 사진(multimodals)으로 바꾼다. 못 읽은 사진은 그렇다고 적는다 */
async function withPhotos(messages: (LlmMessage & { images?: string[] })[]): Promise<unknown[]> {
  return Promise.all(
    messages.map(async (m) => {
      if (!m.images?.length) return m;
      const { images, ...rest } = m;
      const data = await Promise.all(images.map(photoData));
      const missing = data.map((d, i) => (d ? 0 : i + 1)).filter(Boolean);
      return {
        ...rest,
        content: missing.length ? `${rest.content}\n${imageMissingLine(missing.join(', '))}` : rest.content,
        multimodals: data.filter((d): d is string => !!d).map((base64) => ({ type: 'image', base64 })),
      };
    }),
  );
}

/** 모델 호출 시간 제한 (전수검사 11-13 나-7, 사용자 결정 (2)): 응답이 이만큼 오지 않으면(받는 중이면 마지막 조각부터) 실패로 본다.
 * 모델 연결이 멈춰도 응답 뒤 처리(갱신기·이미지 태그 보충)가 채팅을 영영 묶어 두지 않게. */
// 시간은 설정 「화면 → 모델 응답 대기」 (core/timing.ts, 전수점검 보통-5: 5분이 박혀 있어 느린 모델이 끊기고 같은 요청이 다시 나갔다)
// 조각을 하나도 받지 못하고 끊긴 것은 모델이 느린 것이라 같은 요청을 다시 보내도 또 끊긴다: 일시 오류 재시도에서 뺀다 (markTransientDone).
// 받는 도중 멈춘 것(연결이 끊긴 것)만 raw 'timeout' 으로 일시 오류로 다시 보낸다
function idleLimit<T>(run: (tick: () => void) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticked = false;
  const ms = timeMs('modelIdle');
  return new Promise<T>((resolve, reject) => {
    const fire = () => {
      const error = new LlmError(`모델이 ${timeOf('modelIdle')}분 동안 응답하지 않아 멈췄어요. Risu의 모델 연결을 확인하거나, 설정 → 화면의 「모델 응답 대기」를 늘려 주세요.`, 'timeout');
      if (!ticked) markTransientDone(error);
      reject(error);
    };
    timer = setTimeout(fire, ms);
    const tick = () => {
      ticked = true;
      clearTimeout(timer);
      timer = setTimeout(fire, ms);
    };
    run(tick).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** staticModel: 기능별 전용 모델 ID (있으면 메인·보조 대신 그 모델).
 *  limitSec: 시간 제한(초, Router·Director 설정). 넘으면 그때 실패로 적고 던진다. 늦게 온 답은 버린다 (2차 점검 14-1: 늦게 와도 「완료」로 적혔다) */
export async function runModel(messages: LlmMessage[], model: ModelChoice, staticModel?: string, label = '기타', limitSec?: number): Promise<string> {
  // 호출 흐름 기록 (host/trace.ts): 성공·실패 모두 한 건으로 남긴다
  const at = new Date().toISOString();
  const t0 = Date.now();
  const mark = traceMark(label); // 시작할 때의 턴에 적는다 (전수점검 보통-7)
  const req = requestText(messages);
  // 진행 창 (core/progress.ts): 시작할 때 모델을 알리고, 끝나면 응답 토큰·시간을
  const pid = progressCallStart(label, staticModel || model, 0);
  // 기록용 요청 토큰은 요청을 보낸 뒤에 센다. 긴 요청은 세는 데 1초 가까이 걸려 호출이 늦게 나갔다 (전수검사 11-13)
  let reqTokens: number | undefined;
  const countReq = (): number => {
    if (reqTokens === undefined) {
      reqTokens = tokens(req);
      progressCallTokens(pid, reqTokens);
    }
    return reqTokens;
  };
  setTimeout(countReq, 0);
  let finished = false;
  const done = (ok: boolean, response: string, error?: string) => {
    if (finished) return;
    finished = true;
    const ms = Date.now() - t0;
    countReq();
    const responseTokens = tokens(response);
    progressCallEnd(pid, { ok, ms, respTokens: responseTokens, ...(error ? { error } : {}) });
    void traceCall({ label, at, ms, model: staticModel || model, ok, ...(error ? { error } : {}), request: clip(req), requestChars: req.length, requestTokens: countReq(), response: clip(response), responseChars: response.length, responseTokens }, mark).catch(() => {});
  };
  try {
    const run = idleLimit((tick) => runModelRaw(messages, model, staticModel, (n) => {
      tick();
      progressCallChunk(pid, n);
    }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const text = limitSec !== undefined && limitSec > 0
      ? await Promise.race([run, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`시간 제한 ${limitSec}초`)), limitSec * 1000); })]).finally(() => clearTimeout(timer))
      : await run;
    done(true, text);
    return text;
  } catch (error) {
    done(false, error instanceof LlmError ? error.raw ?? '' : '', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// 메인 모델로 보내는 보조 호출의 표시. Risu 가 이 요청도 본편 조립기(beforeRequest, body.ts)에 넘기면
// 본편용 로어·참고 기록·소지품이 붙지 않게, 보내는 동안 첫 글과 마지막 글을 적어 두고 조립기가 알아본다.
const ownMain = new Map<string, number>();
const callPrint = (ms: readonly unknown[]): string => {
  const text = (m: unknown) => { const c = (m as { content?: unknown } | null)?.content; return typeof c === 'string' ? c : ''; };
  return `${text(ms[0])}\n\u0000\n${text(ms[ms.length - 1])}`;
};
/** 지금 플러그인이 메인 모델로 보내고 있는 요청인가 */
export const isOwnMainCall = (messages: readonly unknown[]): boolean => ownMain.size > 0 && Array.isArray(messages) && messages.length > 0 && ownMain.has(callPrint(messages));

async function runModelRaw(messages: LlmMessage[], model: ModelChoice, staticModel?: string, onChunk?: (chars: number) => void): Promise<string> {
  let res: unknown;
  try {
    // allowPlugins: 사용자가 플러그인이 제공하는 모델(pluginmodel:::)을 메인·보조로 쓰면 이게 없을 때 Risu가 막는다.
    // 이 플러그인은 모델 제공 플러그인이 아니라서 서로 부르는 고리가 생기지 않는다.
    const sent = await withPhotos(prepareAttachments(messages));
    const print = model === 'aux' ? '' : callPrint(sent);
    if (print) ownMain.set(print, (ownMain.get(print) ?? 0) + 1);
    try {
      res = await risuai.runLLMModel({ messages: sent, mode: model === 'aux' ? 'submodel' : 'model', allowPlugins: true, ...(staticModel ? { staticModel } : {}) });
    } finally {
      if (print) {
        const n = (ownMain.get(print) ?? 1) - 1;
        if (n > 0) ownMain.set(print, n);
        else ownMain.delete(print);
      }
    }
  } catch (error) {
    throw new LlmError(`모델 요청에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
  let text = '';
  if (typeof res === 'string') text = res;
  else if (res && typeof res === 'object') {
    const r = res as { type?: string; result?: unknown };
    if (r.type === 'fail' && /Plugin calls are blocked/i.test(String(r.result ?? ''))) {
      throw new LlmError('Risu가 플러그인 모델 호출을 막았어요. 이 버전의 Risu는 플러그인이 제공하는 모델을 다른 플러그인에서 쓸 수 없어요. Risu를 최신으로 업데이트하거나, 이 기능이 쓰는 모델(또는 Risu의 메인·보조 모델)을 플러그인 모델이 아닌 것으로 바꿔 보세요.', String(r.result));
    }
    if (r.type === 'fail') throw new LlmError(`모델 요청에 실패했어요. Risu의 모델 연결을 확인해 주세요.\n${String(r.result ?? '').slice(0, 300)}`, String(r.result ?? ''));
    if (r.type === 'multiline' && Array.isArray(r.result)) text = (r.result as [string, string][]).filter(([role]) => role === 'char').map(([, t]) => t).join('\n');
    else if (r.type === 'streaming' && r.result && typeof (r.result as ReadableStream).getReader === 'function') {
      // 받는 도중 끊기면 모델 연결 오류(일시 오류)로 본다. 그냥 두면 형식 재시도로 가고 영어 원문 오류가 그대로 떴다 (전수점검 보통-8)
      try {
        text = await readStream(r.result as ReadableStream<unknown>, onChunk);
      } catch (error) {
        throw new LlmError('모델 응답을 받는 중에 연결이 끊겼어요. Risu의 모델 연결을 확인해 주세요.', `connection lost: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    else if (typeof r.result === 'string') text = r.result;
  }
  text = stripThoughts(text).trim();
  if (!text) throw new LlmError('모델이 빈 응답을 보냈어요.');
  return text;
}

/** 형식 오류 재시도 (원본 백엔드 「실패 시 재시도」·「재시도 모델」). 고급 설정 → 생성 공통 */
export interface RetryOptions {
  retries: number;
  retryModel: 'same' | ModelChoice;
  /** 다시 물을 요청문 (없으면 같은 요청에 오류를 덧붙임) */
  fix?: (raw: string, reason: string) => LlmMessage[];
  /** 응답을 검사하기 전에 이 채팅의 고급 설정(길이 제한 등)으로 다시 맞춘다. 기다리는 동안 창이 다른 채팅을 열었을 수 있다 */
  state?: Record<string, unknown>;
  /** 첫 요청을 대신 보낼 곳 (괴담넷·괴담톡 자동 확인 한 번에 묶기, host/joint.ts). 다시 묻기는 따로 보낸다 */
  first?: (messages: LlmMessage[]) => Promise<string>;
  /** 다시 보기 횟수 (라이트보드 Reiteration). 첫 응답 뒤에만 */
  reiterate?: number;
  /** 동시 요청 수에 셀지 (괴담넷·괴담톡·위키). 0이면 제한 없음 */
  concurrent?: number;
  /** 기능별 전용 모델 ID. 다시 물을 때도 그대로 쓴다 */
  staticModel?: string;
  /** 호출 흐름 기록에 적을 이름 (host/trace.ts) */
  label?: string;
  /** 모델 쪽 일시 오류에 같은 요청을 다시 보내는 횟수 (설정 「모델 오류 재시도」). 없으면 state 의 설정, 그것도 없으면 2 */
  transientRetries?: number;
}

// ── 동시 요청 수 (라이트보드 「동시요청수」, 2026-11-06). 괴담넷·괴담톡·위키 요청만 센다. 인물 기록은 세지 않는다 (리수폿 스레드 요청) ──
let running = 0;
const waiting: (() => void)[] = [];
/** 동시 요청 칸 하나를 잡고 run. 통합 요청(host/joint.ts)도 요청 한 건마다 이걸로 감싼다 (전수검사 11-13) */
export async function limited<T>(limit: number | undefined, run: () => Promise<T>): Promise<T> {
  if (!limit || limit < 1) return run();
  while (running >= limit) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await run();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** 다시 보기 문장 (지침 「요청 공통」 REITERATE 절) */
export const reiterationText = (i: number, n: number): string => guideTxt('Common', 'REITERATE', { i, n });


/** 원본과 같이 응답 형식이 틀렸을 때만 다시 묻는다. 모델 연결 실패(LlmError)는 다시 불러도 대개 같다 */
const retryable = (error: unknown) => !(error instanceof LlmError);
/** 모델 쪽 일시 오류 (빈 응답·Gemini MALFORMED_RESPONSE·과부하·429/5xx): 같은 요청을 그대로 다시 보낸다 (2026-11-07 사용자: 상점에서 빈 응답·오류가 잦음) */
const TRANSIENT = /빈 응답|MALFORMED|finishReason|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|rate ?limit|\b(429|500|502|503|504)\b|timeout|timed out|ECONNRESET|fetch failed|connection lost/i;
const transient = (error: unknown) => error instanceof LlmError && !(error as { transientDone?: boolean }).transientDone && TRANSIENT.test(`${error.message}\n${error.raw}`);
/** 모델 쪽 일시 오류인가 (통합 요청이 묶음째 다시 보낼 때, host/joint.ts) */
export const isTransient = transient;
/** 이미 일시 오류 재시도를 다 한 오류: generate 가 같은 요청을 또 다시 보내지 않게 표시한다 */
export function markTransientDone(error: unknown): void {
  if (error && typeof error === 'object') {
    try {
      Object.defineProperty(error, 'transientDone', { value: true, configurable: true });
    } catch {
      /* 표시를 못 붙여도 오류는 그대로 */
    }
  }
}
const TRANSIENT_RETRIES = 2;

export const defaultFix = (messages: LlmMessage[]) => (raw: string, reason: string): LlmMessage[] => [
  ...messages,
  ...(raw ? [{ role: 'assistant' as const, content: raw }] : []),
  { role: 'user', content: guideTxt('Common', 'RETRY.DEFAULT', { reason: reason.slice(0, 600), analyze: retryAnalyze() }) },
];

/** 실패 화면에 원문을 보여 주도록 오류에 응답 원문을 붙인다 (이미 있으면 그대로) */
function withRawText(error: unknown, raw: string): unknown {
  if (raw && error && typeof error === 'object' && !(error as { raw?: string }).raw) {
    try {
      Object.defineProperty(error, 'raw', { value: raw, configurable: true });
    } catch {
      /* 원문을 못 붙여도 오류는 그대로 */
    }
  }
  return error;
}

/** 모델을 부르고 parse로 검사한다. 형식이 틀리면 설정한 횟수만큼 다시 묻는다. 끝까지 실패하면 오류에 원문을 붙여 던진다 */
export async function generate<T>(messages: LlmMessage[], model: ModelChoice, parse: (raw: string) => T, o: RetryOptions): Promise<{ raw: string; value: T }> {
  const fix = o.fix ?? defaultFix(messages);
  let ask = messages;
  let use = model;
  let earlier: unknown = null;
  const transientMax = o.transientRetries ?? (o.state ? advNum(o.state, 'gen', 'transient') : TRANSIENT_RETRIES);
  let transientLeft = transientMax;
  // 요청을 보낼 때마다 이 채팅의 요청당 사진 수로 맞춘다 (기다리는 사이 다른 채팅 값으로 바뀌었을 수 있다)
  const send = (m: LlmMessage[], label?: string) => { if (o.state) applyGenLimits(o.state); return runModel(m, use, o.staticModel, label); };
  for (let attempt = 0; ; attempt++) {
    let raw = '';
    try {
      try {
        // 통합 요청(first = Joint.ask)은 동시 요청 칸 밖에서: 칸이 1이면 한쪽이 칸을 잡고 다른 쪽을 기다려 둘 다 멈췄다 (11-09 점검)
        raw = attempt === 0 && o.first ? await o.first(ask) : await limited(o.concurrent, () => send(ask, attempt ? `${o.label ?? '기타'} 다시 묻기 ${attempt}` : o.label));
      } catch (error) {
        // 모델 쪽 일시 오류면 형식 재시도 횟수와 무관하게 같은 요청을 다시 (설정 「모델 오류 재시도」, 기본 2회)
        if (!transient(error) || transientLeft <= 0) throw error;
        transientLeft--;
        console.log(`[goei] 모델 일시 오류, 다시 보냄 (${transientMax - transientLeft}/${transientMax}): ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        await new Promise((r) => setTimeout(r, timeMs('retryGap')));
        attempt--;
        continue;
      }
      // 다시 보기: 첫 응답을 다시 읽고 고치게 한다. 실패하면 첫 응답을 쓴다 (원본과 같음)
      for (let i = 1; attempt === 0 && i <= (o.reiterate ?? 0); i++) {
        const again: LlmMessage[] = [...ask, { role: 'assistant', content: raw }, { role: 'user', content: reiterationText(i, o.reiterate ?? 0) }];
        try {
          const next = await limited(o.concurrent, () => send(again, `${o.label ?? '기타'} 다시 보기 ${i}`));
          if (next.trim()) raw = next;
        } catch {
          break;
        }
      }
      // 응답을 읽기 직전에 이 채팅의 값으로: 길이 제한과 소지품 판정 표 (상점·쇼핑몰 진열 줄의 쓰임을 다른 채팅 표로 읽지 않게)
      if (o.state) { applyAdvanced(o.state); setItemRules(o.state); }
      return { raw, value: parse(raw) };
    } catch (error) {
      // 다시 물었는데 연결이 실패하면 처음 형식 오류(원문 포함)를 보여 준다
      if (earlier && !retryable(error)) throw earlier;
      if (attempt >= o.retries || !retryable(error)) throw withRawText(error, raw);
      earlier = withRawText(error, raw);
      ask = raw ? fix(raw, error instanceof Error ? error.message : String(error)) : messages;
      use = o.retryModel === 'same' ? model : o.retryModel;
    }
  }
}
