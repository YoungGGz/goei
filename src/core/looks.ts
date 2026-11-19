// 내 모습 (2026-11-07 사용자): 페르소나로 시작할 때 꼭 고르는 필드 인물 모습 = 일반 NPC 프리셋 하나의 정면(남쪽) 대기 동작.
// 고유 인물로 시작하면 고르지 않고 그 인물 모습. 고른 것은 채팅 변수 $st_look(인물 팩 번호, 예 '6.54')에 둔다.
// 성별은 격자를 거르는 데만 쓰고 본편 모델에 넘기지 않는다 (사용자: 페르소나 시트에 이미 있다).
// 그림·측정값은 내 모습 팩(scripts/data-pack.mjs looksPackText)에서 온다. 여기는 순수 계산.
import { expectOf, type PackSpec } from './datapack';
import type { ScriptState } from './types';

declare const __LOOKS_PACK__: string | undefined;

/** 내 모습 팩: 고를 때 처음 받는다 (host/looks.ts) */
export const LOOKS_PACK: PackSpec = { name: 'goei-data-looks', label: '인물 모습', expect: expectOf(typeof __LOOKS_PACK__ === 'string' ? __LOOKS_PACK__ : undefined) };

export const LOOK_KEY = '$st_look';
/** 대기 동작 한 장 길이. 필드 FIELD_CLIP idle(0.6초)의 1.5배 빠르기 (사용자 2026-11-08) */
export const LOOK_FRAME_SEC = 0.4;

export type LookGender = '남' | '여';
export const LOOK_GENDERS: LookGender[] = ['남', '여'];

export interface LookRow {
  /** 인물 팩 번호 (char-6.54 → '6.54') */
  id: string;
  /** 프리셋 이름(시민남3) 또는 고유 인물 이름(에일린) */
  name: string;
  /** 일반 NPC 성별 (필드 신상표). 고유 인물은 '' */
  g: LookGender | '';
  unique: boolean;
  /** 장 수 */
  n: number;
  /** 원래 칸 크기 (128×256) */
  w: number;
  h: number;
  /** 잘린 장 크기 · 원래 칸 안의 자리 */
  cw: number;
  ch: number;
  ox: number;
  oy: number;
  /** 장 하나 길이 (초) */
  sec: number;
  /** 대기 사이에 끼우는 동작 파일(goei-look-<id>.N.txt)의 조각 수·길이·지문. 동작이 없는 모습은 없음 */
  acts?: { parts: number; length: number; hash: string };
  /** 정면 대기 줄 시트 base64 webp (가로로 n장, 장마다 cw×ch) */
  img: string;
}

/** 대기 사이에 한 번씩 끼우는 동작 하나 (2026-11-19 사용자: 이미 뽑아 둔 서서 정면 동작 중 고른 것) */
export interface LookAct {
  /** 동작 줄 번호 ('143') */
  k: string;
  name: string;
  /** 장 수 · 장 크기 */
  n: number;
  cw: number;
  ch: number;
  /** 이 장 안에서 대기 칸의 왼쪽 위 자리: 대기 그림 위에 발밑을 맞춰 겹친다 */
  dx: number;
  dy: number;
  /** 장 하나 길이 (초) */
  sec: number;
  /** 시트 base64 webp (가로로 n장) */
  img: string;
}

/** 아바타 동작 간격 설정 (2026-11-19 사용자: 간격을 코드에 박지 않는다, 구간 랜덤, 1초 단위).
 *  한 동작이 끝나고 다음 동작까지 대기로 서 있는 초 = 최소~최대 사이에서 매번 새로 뽑는다. 최대가 0이면 동작 없이 대기만 */
export const LOOK_ACT_MIN_VAR = '$it_act_gap_min';
export const LOOK_ACT_MAX_VAR = '$it_act_gap_max';
export const LOOK_ACT_GAP_DEFAULT: [number, number] = [12, 24];
export const LOOK_ACT_GAP_HI = 120;
/** [최소, 최대] 초 (0~LOOK_ACT_GAP_HI, 최소 ≤ 최대) */
export const lookActGap = (vars: Record<string, unknown> | undefined): [number, number] => {
  const one = (key: string, def: number) => {
    const raw = vars?.[key];
    const n = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
    return Number.isInteger(n) ? Math.min(LOOK_ACT_GAP_HI, Math.max(0, n)) : def;
  };
  const hi = one(LOOK_ACT_MAX_VAR, LOOK_ACT_GAP_DEFAULT[1]);
  return [Math.min(one(LOOK_ACT_MIN_VAR, LOOK_ACT_GAP_DEFAULT[0]), hi), hi];
};
/** 이번에 서 있을 초 (rnd = 0~1) */
export const pickLookGap = ([lo, hi]: [number, number], rnd: number): number => lo + rnd * (hi - lo);

/** 인물별 동작 파일 이름 */
export const lookActsParts = (id: string, parts: number): string[] => Array.from({ length: parts }, (_, i) => `goei-look-${id}.${i + 1}.txt`);

/** 인물별 동작 글을 푼다. 형식이 다르면 던진다 */
export function parseLookActs(text: string, id: string): LookAct[] {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('아바타 동작이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'look-acts' || j.id !== id || !Array.isArray(j.acts)) throw new Error('아바타 동작 형식이 달라요.');
  const out: LookAct[] = [];
  for (const r of j.acts as unknown[]) {
    if (!obj(r) || typeof r.k !== 'string' || typeof r.img !== 'string' || !r.img) continue;
    const n = num(r.n), cw = num(r.cw), ch = num(r.ch), sec = num(r.sec);
    if (!(n >= 1 && cw > 0 && ch > 0 && sec > 0)) continue;
    out.push({ k: r.k, name: String(r.name ?? ''), n, cw, ch, dx: num(r.dx) || 0, dy: num(r.dy) || 0, sec, img: r.img });
  }
  return out;
}

/** 다음에 보일 동작: 바로 앞 것만 피해 아무거나 (rnd = 0~1) */
export function pickLookAct<T extends { k: string }>(acts: T[], last: string, rnd: number): T | undefined {
  const pool = acts.length > 1 ? acts.filter((a) => a.k !== last) : acts;
  return pool[Math.min(pool.length - 1, Math.floor(rnd * pool.length))];
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/** 내 모습 팩 글을 푼다. 형식이 다르면 던진다 */
export function parseLooksPack(text: string): LookRow[] {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('인물 모습 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'looks' || !Array.isArray(j.looks)) throw new Error('인물 모습 팩 형식이 달라요.');
  const out: LookRow[] = [];
  for (const r of j.looks as unknown[]) {
    if (!obj(r) || typeof r.id !== 'string' || typeof r.img !== 'string' || !r.img) continue;
    const n = num(r.n), cw = num(r.cw), ch = num(r.ch);
    if (!(n >= 1 && cw > 0 && ch > 0)) continue;
    const g = r.g === '남' || r.g === '여' ? r.g : '';
    const a = obj(r.acts) && num(r.acts.parts) >= 1 && num(r.acts.length) > 0 && typeof r.acts.hash === 'string' ? { parts: num(r.acts.parts), length: num(r.acts.length), hash: r.acts.hash } : undefined;
    out.push({ id: r.id, name: String(r.name ?? ''), g, unique: r.unique === true, n, w: num(r.w) || 128, h: num(r.h) || 256, cw, ch, ox: num(r.ox) || 0, oy: num(r.oy) || 0, sec: num(r.sec) > 0 ? num(r.sec) : LOOK_FRAME_SEC, ...(a ? { acts: a } : {}), img: r.img });
  }
  return out;
}

/** 이 채팅에서 고른 모습 번호 ('' = 고르지 않음) */
export const lookId = (state: ScriptState | Record<string, unknown> | undefined): string => {
  const v = String(state?.[LOOK_KEY] ?? '').trim();
  return /^\d+\.\d+$/.test(v) ? v : '';
};

/** 고르기 격자에 보일 모습: 그 성별의 일반 NPC 프리셋 전부 (팩 순서 그대로, 세력 구분 없음 — 2026-11-08 사용자) */
export const looksOf = (rows: LookRow[], g: LookGender): LookRow[] => rows.filter((r) => !r.unique && r.g === g);

/** 한 번도 고른 적 없을 때 기본 아바타 (2026-11-08 사용자: PixelLab 페르소나 여자 A) */
export const LOOK_FIRST = '페르소나여A';

/** 시작 패널 기본 아바타: 마지막에 고른 것 → 처음 기본 */
export function defaultLook(rows: LookRow[], last: string | undefined): string {
  if (last && rows.some((r) => r.id === last && !r.unique && !!r.g)) return last;
  return rows.find((r) => !r.unique && r.name === LOOK_FIRST)?.id ?? '';
}


/**
 * 이 채팅의 플레이 인물 모습: 고유 인물로 플레이하면 그 인물(명부 이름으로 찾음), 아니면 고른 프리셋. 없으면 undefined
 * @param playerName 고유 인물로 플레이할 때 그 인물 이름 (core/player.ts playerAgent().name)
 */
export function lookFor(rows: LookRow[], state: ScriptState | Record<string, unknown> | undefined, playerName?: string): LookRow | undefined {
  if (playerName) return rows.find((r) => r.unique && r.name === playerName);
  const id = lookId(state);
  return id ? rows.find((r) => r.id === id && !r.unique) : undefined;
}
