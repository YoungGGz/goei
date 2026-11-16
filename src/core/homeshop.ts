// 망상홈쇼핑 방송 (2026-11-11 사용자: 컷 A 와이드·컷 B 바스트 두 장면으로 구현, 설계 /mnt/project-files/망상홈쇼핑_1109/방송화면_재설계_1109.md).
// 한 번 호출로 편성(상품 n개)·상품마다 큐시트·채팅을 받아, 화면이 큐시트를 차례로 재생한다 (컷|표정|대사|화면 사건).
// 상품 줄·요청문·참고 자료는 상점(core/shop.ts)을 그대로 쓰고, 설정 값만 사이트 것($hs_sh_*, 우주몰·포인트몰과 같은 방식).
// 여기는 순수 계산: 설정·저장 모양·응답 해석·동작 고르기. 화면은 ui/homeshop.ts, 그림은 host/homeshop.ts.
import { expectOf, type PackSpec } from './datapack';
import { costOf, lastBot, lineCells, parseLine, shopSettings, ShopError, SHOP_CTX_VAR, SHOP_SHARED_VARS, type ShopItem, type ShopSettings } from './shop';
import type { Chat } from './types';
import { userTurns, type PromptMessage } from './request';
import { aliveAnchors } from './wallet';
import { fillGuide, guideSections, guideTxt } from './guides';

declare const __HOMESHOP_PACK__: string | undefined;
/** 방송 그림 팩: 방송 화면을 처음 열 때 받는다 (host/homeshop.ts) */
export const HOMESHOP_PACK: PackSpec = { name: 'goei-data-homeshop', label: '망상홈쇼핑 방송 그림', expect: expectOf(typeof __HOMESHOP_PACK__ === 'string' ? __HOMESHOP_PACK__ : undefined) };

export const HS_SITE = 'hs';
/** 방송 이름·진행자 이름 (지침 「망상홈쇼핑」의 CHANNEL_NAME · HOST_NAME 절). 화면과 요청이 같은 절을 부를 때 읽는다 (2026-11-15 사용자) */
export const hsName = (): string => guideTxt('Hs', 'CHANNEL_NAME');
export const hsHost = (): string => guideTxt('Hs', 'HOST_NAME');
/** 편성 상태 (상품·큐시트·채팅·지금 부) */
export const HS_VAR = '$hs_show';
/** 「창을 열 때」 자동 호출: 마지막으로 편성을 받은 응답 */
export const HS_AT_VAR = '$hs_show_at';

type Vars = Record<string, unknown> | undefined;
const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
function numIn(v: unknown, def: number, lo: number, hi: number, round = true): number {
  const n = Number(v);
  if (v === undefined || v === '' || !Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, round ? Math.round(n) : n));
}

// ── 그림 팩 ──

export type ClipGroup = 'base' | 'filler' | 'event' | 'rare' | 'off';
export const CLIP_GROUPS: ClipGroup[] = ['base', 'filler', 'event', 'rare', 'off'];
export const CLIP_GROUP_LABEL: Record<ClipGroup, string> = { base: '기본', filler: '가끔', event: '대사·사건', rare: '드물게', off: '안 씀' };
export interface HsClip { name: string; ko: string; ver: string; group: ClipGroup; frames: number; file: string }
export type CutId = 'A' | 'B';
export interface HsCutArt {
  plate: string;
  /** 불 꺼진 판 (전구 반짝임: 전구 자리만 이 판의 점으로 바꾼다. 영업 안 함 화면) */
  off?: string;
  host: string;
  x: number;
  y: number;
  /** 이 줄부터 아래는 배경 판을 진행자 위에 다시 덮는다 (진열대) */
  over?: number;
  /** 가림 판: 배경 판과 같은 크기, 진행자를 가리는 곳(진열대 윤곽 그대로)만 판의 점이 있다. 진행자를 다 그린 뒤 덮는다. 없으면 over 줄로 (tools/homeshop/over_mask.py) */
  mask?: string;
  /** 뒷벽 화면 칸 [x0,y0,x1,y1] */
  screen?: [number, number, number, number];
  /** 전구 [x, y, 반지름] */
  bulbs?: [number, number, number][];
  clips: HsClip[];
}
export interface HsPack {
  w: number;
  h: number;
  box: number;
  cuts: Record<CutId, HsCutArt>;
  files: Record<string, string>;
  font: string;
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 방송 그림 팩 글을 푼다 (scripts/data-pack.mjs homeshopPackText). 형식이 다르면 던진다 */
export function parseHomeshopPack(text: string): HsPack {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('방송 그림 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'homeshop' || !obj(j.meta) || !obj(j.files)) throw new Error('방송 그림 팩 형식이 달라요.');
  const m = j.meta as Record<string, unknown>;
  const files = j.files as Record<string, string>;
  const cut = (v: unknown): HsCutArt => {
    if (!obj(v) || typeof v.plate !== 'string' || typeof v.host !== 'string' || !Array.isArray(v.clips)) throw new Error('방송 그림 팩 형식이 달라요 (컷).');
    const clips = (v.clips as unknown[]).filter((c): c is HsClip => obj(c) && typeof c.name === 'string' && typeof c.file === 'string' && typeof files[c.file as string] === 'string' && Number(c.frames) > 0)
      .map((c) => ({ name: c.name, ko: String(c.ko ?? c.name), ver: String(c.ver ?? '1'), group: (CLIP_GROUPS as string[]).includes(String(c.group)) ? (c.group as ClipGroup) : 'event', frames: Number(c.frames), file: c.file }));
    return {
      plate: v.plate, host: v.host, x: Number(v.x) || 0, y: Number(v.y) || 0, clips,
      ...(typeof v.off === 'string' ? { off: v.off } : {}),
      ...(typeof v.over === 'number' ? { over: v.over } : {}),
      ...(typeof v.mask === 'string' && typeof files[v.mask] === 'string' ? { mask: v.mask } : {}),
      ...(Array.isArray(v.screen) && v.screen.length === 4 ? { screen: v.screen.map(Number) as [number, number, number, number] } : {}),
      ...(Array.isArray(v.bulbs) ? { bulbs: (v.bulbs as unknown[]).filter(Array.isArray).map((b) => [Number(b[0]), Number(b[1]), Number(b[2]) || 4] as [number, number, number]) } : {}),
    };
  };
  if (!obj(m.cuts)) throw new Error('방송 그림 팩 형식이 달라요 (cuts).');
  return { w: Number(m.w) || 512, h: Number(m.h) || 384, box: Number(m.box) || 256, cuts: { A: cut(m.cuts.A), B: cut(m.cuts.B) }, files, font: typeof j.font === 'string' ? j.font : '' };
}

// ── 설정 (채팅마다, 전부 설정 → 인터넷 → 망상홈쇼핑에서 고친다. 여기 값은 기본값일 뿐) ──

/** 상점 설정 이름($sh_*) → 망상홈쇼핑 이름($hs_sh_*) */
export const hsKey = (shKey: string): string => `$hs_${shKey.slice(1)}`;
/** 상점 설정 함수에 넘길 변수: $hs_sh_* 를 $sh_* 로 비춘다 (core/malls.ts mallVars 와 같은 방식)
 *  맥락 반영은 제 값($hs_sh_ctx)이 '1'/'0'이면 그 값, 없으면 기본 상점 값 (가게 표와 맞춤, 전수검사 11-13) */
export function hsVars(vars: Vars): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (!k.startsWith('$sh_') || SHOP_SHARED_VARS.includes(k)) out[k] = v;
  for (const [k, v] of Object.entries(vars ?? {})) {
    if (!k.startsWith('$hs_sh_')) continue;
    const sh = `$sh_${k.slice(7)}`;
    if (sh === SHOP_CTX_VAR ? v !== '1' && v !== '0' : SHOP_SHARED_VARS.includes(sh)) continue;
    out[sh] = v;
  }
  return out;
}

export const HS_KEY = {
  on: '$hs_on', net: '$hs_net', auto: '$hs_sh_auto',
  chatMin: '$hs_chat_min', chatMax: '$hs_chat_max', chatGap: '$hs_chat_gap',
  cueMin: '$hs_cue_min', cueMax: '$hs_cue_max',
  sayCueMin: '$hs_say_cue_min', sayCueMax: '$hs_say_cue_max', sayChatMin: '$hs_say_chat_min', sayChatMax: '$hs_say_chat_max',
  speed: '$hs_speed', hold: '$hs_hold', frame: '$hs_frame',
  cut: '$hs_fx_cut', bulb: '$hs_fx_bulb', tear: '$hs_fx_tear', tearP: '$hs_tear_p', scan: '$hs_fx_scan',
  fillLo: '$hs_fill_lo', fillHi: '$hs_fill_hi', fillCool: '$hs_fill_cool', rareP: '$hs_rare_p', rareCool: '$hs_rare_cool',
  clips: '$hs_clips', read: '$hs_read', scalePc: '$hs_scale_pc', scalePhone: '$hs_scale_ph',
  next: '$hs_next', turn: '$hs_turn', lock: '$hs_lock', left: '$hs_left',
  drop: '$hs_drop', dropRate: '$hs_drop_rate', dropFast: '$hs_drop_fast', dropStep: '$hs_drop_step', soonAt: '$hs_soon_at', endLo: '$hs_end_lo', endHi: '$hs_end_hi',
  callLo: '$hs_call_lo', callHi: '$hs_call_hi', shipLo: '$hs_ship_lo', shipHi: '$hs_ship_hi', forms: '$hs_forms', aud: '$hs_aud_on', peek: '$hs_peek', say: '$hs_say', barter: '$hs_barter', talk: '$hs_talk',
} as const;
/** 숫자 칸 범위·기본값 (설정 화면과 읽기가 같이 쓴다) */
export const HS_NUM: Record<string, { key: string; lo: number; hi: number; def: number; unit: string }> = {
  chatMin: { key: HS_KEY.chatMin, lo: 0, hi: 120, def: 30, unit: '줄' },
  chatMax: { key: HS_KEY.chatMax, lo: 0, hi: 120, def: 40, unit: '줄' },
  chatGap: { key: HS_KEY.chatGap, lo: 5, hi: 100, def: 22, unit: '×0.1초' },
  cueMin: { key: HS_KEY.cueMin, lo: 2, hi: 20, def: 12, unit: '줄' },
  cueMax: { key: HS_KEY.cueMax, lo: 2, hi: 20, def: 16, unit: '줄' },
  sayCueMin: { key: HS_KEY.sayCueMin, lo: 1, hi: 6, def: 1, unit: '줄' },
  sayCueMax: { key: HS_KEY.sayCueMax, lo: 1, hi: 6, def: 3, unit: '줄' },
  sayChatMin: { key: HS_KEY.sayChatMin, lo: 0, hi: 12, def: 2, unit: '줄' },
  sayChatMax: { key: HS_KEY.sayChatMax, lo: 0, hi: 12, def: 5, unit: '줄' },
  speed: { key: HS_KEY.speed, lo: 3, hi: 40, def: 11, unit: '자/초' },
  hold: { key: HS_KEY.hold, lo: 0, hi: 50, def: 12, unit: '×0.1초' },
  frame: { key: HS_KEY.frame, lo: 50, hi: 250, def: 110, unit: 'ms' },
  tearP: { key: HS_KEY.tearP, lo: 0, hi: 100, def: 6, unit: '%' },
  fillLo: { key: HS_KEY.fillLo, lo: 1, hi: 30, def: 3, unit: '번' },
  fillHi: { key: HS_KEY.fillHi, lo: 1, hi: 30, def: 6, unit: '번' },
  fillCool: { key: HS_KEY.fillCool, lo: 0, hi: 60, def: 8, unit: '번' },
  rareP: { key: HS_KEY.rareP, lo: 0, hi: 100, def: 10, unit: '%' },
  rareCool: { key: HS_KEY.rareCool, lo: 0, hi: 120, def: 20, unit: '번' },
  next: { key: HS_KEY.next, lo: 0, hi: 60, def: 0, unit: '초' },
  left: { key: HS_KEY.left, lo: 1, hi: 999, def: 30, unit: '개' },
  dropRate: { key: HS_KEY.dropRate, lo: 10, hi: 400, def: 100, unit: '%' },
  dropFast: { key: HS_KEY.dropFast, lo: 10, hi: 50, def: 20, unit: '×0.1배' },
  dropStep: { key: HS_KEY.dropStep, lo: 1, hi: 20, def: 3, unit: '개' },
  soonAt: { key: HS_KEY.soonAt, lo: 0, hi: 99, def: 5, unit: '개' },
  endLo: { key: HS_KEY.endLo, lo: 1, hi: 99, def: 2, unit: '개' },
  endHi: { key: HS_KEY.endHi, lo: 1, hi: 99, def: 8, unit: '개' },
  callLo: { key: HS_KEY.callLo, lo: 1, hi: 60, def: 6, unit: '턴' },
  callHi: { key: HS_KEY.callHi, lo: 1, hi: 60, def: 12, unit: '턴' },
  shipLo: { key: HS_KEY.shipLo, lo: 0, hi: 30, def: 0, unit: '턴' },
  shipHi: { key: HS_KEY.shipHi, lo: 0, hi: 30, def: 3, unit: '턴' },
};
/** 출연 형태 기본 목록 (설정에서 고친다, 쉼표·줄바꿈으로 나눔) */
/** 주문 전화번호 기본값 */
export const HS_TEL_DEFAULT = '080-404-0000';
/** 내 채팅을 읽는 동안 진행자 컷에서 대기와 번갈아 트는 동작 (이름은 영문·우리말 어느 쪽이든) */
export const HS_READ_DEFAULT = '고개 꺾기, 굳은 응시';
/** 출연 형태 기본값 (지침 「망상홈쇼핑」의 FORMS_DEFAULT 절, 호출 CALL 절의 {form} 으로 간다) */
export const hsFormsDefault = (): string => guideTxt('Hs', 'FORMS_DEFAULT');
export type HsAuto = 'manual' | 'open';
export type HsScale = 'auto' | 'fit' | '0.5' | '1' | '2';
export interface HsRules {
  /** 대기 동작을 몇 번 돌린 뒤 「가끔」 동작을 하나 끼울지 [최소, 최대] */
  fill: [number, number];
  /** 같은 「가끔」 동작이 다시 나오기까지 대기 반복 수 */
  fillCool: number;
  /** 「가끔」 자리에서 「드물게」 동작이 대신 나올 확률 (0~1) */
  rareP: number;
  /** 「드물게」 동작이 다시 나오기까지 대기 반복 수 */
  rareCool: number;
}
/** 남은 수량이 저절로 줄기: 빠르기(1 = 큐시트 끝에 맞춤) · 가격 공개·주문 폭주 뒤 배수 · 매진 임박 기준 수(0 = 안 붙임) · 끝날 때 남기는 수 [최소, 최대] */
export interface HsDrop {
  on: boolean;
  rate: number;
  fast: number;
  /** 한 번에 줄어드는 수 최대 */
  step: number;
  soon: number;
  end: [number, number];
}
export interface HsSettings {
  on: boolean;
  /** 인터넷 즐겨찾기에 상시 노출 */
  net: boolean;
  auto: HsAuto;
  shop: ShopSettings;
  chat: [number, number];
  /** 채팅 한 줄 간격 (초) */
  chatGap: number;
  cue: [number, number];
  /** 내 채팅 한 번에 돌아오는 진행자 줄 수 · 다른 시청자 줄 수 */
  sayCue: [number, number];
  sayChat: [number, number];
  /** 자막 속도 (글자/초) · 대사 뒤 쉼 (초) · 동작 한 장 길이 (ms) */
  speed: number;
  hold: number;
  frame: number;
  fx: { cut: boolean; bulb: boolean; tear: boolean; scan: boolean; tearP: number };
  rules: HsRules;
  /** 동작 분류 고침 (「컷:이름=분류」 줄) */
  clipsText: string;
  /** 내 채팅을 읽는 동안 트는 동작 이름들 */
  read: string[];
  scalePc: HsScale;
  scalePhone: HsScale;
  /** 큐시트가 끝난 뒤 다음 부로 넘어가기까지 (초, 0 = 안 넘어감) */
  next: number;
  /** 본편 턴이 넘어가면 편성 한 칸 넘기기 · 지난 부 잠그기 */
  turn: boolean;
  lock: boolean;
  /** 남은 수량 시작 값 */
  left: number;
  drop: HsDrop;
  /** 할부 호출: 다음 호출까지 턴 [최소, 최대] · 출연 형태 목록 */
  call: [number, number];
  forms: string[];
  /** 전화 주문한 상자가 닿기까지 턴 [최소, 최대] (0 = 주문한 턴) */
  ship: [number, number];
  /** 방청 신청 · 스티커 들추기 · 채팅 보내기 · 물건 맞교환 · 상담원과 흥정 */
  aud: boolean;
  peek: boolean;
  say: boolean;
  barter: boolean;
  talk: boolean;
}
/** 수 칸 하나를 적을 값. 최소·최대 줄(pair)이면 최소가 최대를 넘을 때 짝도 같이 맞춘다 (가게 표·게시판 표와 같은 방식, 전수검사 11-13) */
export function hsNumVars(vars: Vars, k: string, raw: number, pair?: readonly [string, string]): Record<string, string> {
  const d = HS_NUM[k];
  if (!d || !Number.isFinite(raw)) return {};
  const v = Math.max(d.lo, Math.min(d.hi, Math.round(raw)));
  const out: Record<string, string> = { [d.key]: String(v) };
  if (!pair || !pair.includes(k)) return out;
  const [a, b] = pair;
  const other = HS_NUM[k === a ? b : a];
  if (!other) return out;
  const cur = numIn(vars?.[other.key], other.def, other.lo, other.hi);
  if ((k === a && v > cur) || (k === b && v < cur)) out[other.key] = String(v);
  return out;
}
const n = (vars: Vars, k: keyof typeof HS_NUM) => numIn(vars?.[HS_NUM[k].key], HS_NUM[k].def, HS_NUM[k].lo, HS_NUM[k].hi);
const scaleOf = (v: unknown, def: HsScale): HsScale => (v === '0.5' || v === '1' || v === '2' || v === 'auto' || v === 'fit' ? v : def);
export function hsSettings(vars: Vars): HsSettings {
  const shop = shopSettings(hsVars(vars));
  const pair = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];
  // 상품 수 기본 3~5 (상점 기본 대신): 따로 고치지 않았을 때만
  const size: [number, number] = vars?.[hsKey('$sh_min')] === undefined && vars?.[hsKey('$sh_max')] === undefined ? [3, 5] : shop.size;
  return {
    on: vars?.[HS_KEY.on] !== '0',
    net: vars?.[HS_KEY.net] !== '0',
    auto: vars?.[HS_KEY.auto] === 'manual' ? 'manual' : 'open',
    shop: { ...shop, on: true, size, feature: false, kick: false },
    chat: pair(n(vars, 'chatMin'), n(vars, 'chatMax')),
    chatGap: n(vars, 'chatGap') / 10,
    cue: pair(n(vars, 'cueMin'), n(vars, 'cueMax')),
    sayCue: pair(n(vars, 'sayCueMin'), n(vars, 'sayCueMax')),
    sayChat: pair(n(vars, 'sayChatMin'), n(vars, 'sayChatMax')),
    speed: n(vars, 'speed'),
    hold: n(vars, 'hold') / 10,
    frame: n(vars, 'frame'),
    fx: { cut: vars?.[HS_KEY.cut] !== '0', bulb: vars?.[HS_KEY.bulb] !== '0', tear: vars?.[HS_KEY.tear] !== '0', scan: vars?.[HS_KEY.scan] !== '0', tearP: n(vars, 'tearP') / 100 },
    rules: { fill: pair(n(vars, 'fillLo'), n(vars, 'fillHi')), fillCool: n(vars, 'fillCool'), rareP: n(vars, 'rareP') / 100, rareCool: n(vars, 'rareCool') },
    clipsText: String(vars?.[HS_KEY.clips] ?? ''),
    read: (() => { const f = String(vars?.[HS_KEY.read] ?? '').split(/[,\n]/).map((x) => x.trim().slice(0, 30)).filter(Boolean); return f.length ? f : HS_READ_DEFAULT.split(',').map((x) => x.trim()); })(),
    scalePc: scaleOf(vars?.[HS_KEY.scalePc], 'auto'),
    scalePhone: scaleOf(vars?.[HS_KEY.scalePhone], 'auto'),
    next: n(vars, 'next'),
    turn: vars?.[HS_KEY.turn] !== '0',
    lock: vars?.[HS_KEY.lock] !== '0',
    left: n(vars, 'left'),
    drop: { on: vars?.[HS_KEY.drop] !== '0', rate: n(vars, 'dropRate') / 100, fast: n(vars, 'dropFast') / 10, step: n(vars, 'dropStep'), soon: n(vars, 'soonAt'), end: pair(n(vars, 'endLo'), n(vars, 'endHi')) },
    call: pair(n(vars, 'callLo'), n(vars, 'callHi')),
    ship: pair(n(vars, 'shipLo'), n(vars, 'shipHi')),
    forms: (() => { const f = String(vars?.[HS_KEY.forms] ?? '').split(/[,\n]/).map((x) => x.trim().slice(0, 30)).filter(Boolean); return f.length ? f : hsFormsDefault().split(',').map((x) => x.trim()); })(),
    aud: vars?.[HS_KEY.aud] !== '0',
    peek: vars?.[HS_KEY.peek] !== '0',
    say: vars?.[HS_KEY.say] !== '0',
    barter: vars?.[HS_KEY.barter] !== '0',
    talk: vars?.[HS_KEY.talk] !== '0',
  };
}

/** 동작 분류 고침 글 → { 'B:grin': 'off' }. 한 줄에 「컷:이름=분류」(분류: 기본·가끔·대사·드물게·안씀 또는 base·filler·event·rare·off) */
const GROUP_WORD: Record<string, ClipGroup> = { base: 'base', 기본: 'base', filler: 'filler', 가끔: 'filler', event: 'event', 대사: 'event', 사건: 'event', rare: 'rare', 드물게: 'rare', off: 'off', 안씀: 'off' };
export function parseClipGroups(text: string): Record<string, ClipGroup> {
  const out: Record<string, ClipGroup> = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*([AB])\s*[:：]\s*([^=＝]+?)\s*[=＝]\s*(\S+)\s*$/i.exec(line);
    const g = m ? GROUP_WORD[m[3].replace(/\s/g, '').toLowerCase()] : undefined;
    if (m && g) out[`${m[1].toUpperCase()}:${m[2].trim().toLowerCase()}`] = g;
  }
  return out;
}
/** 설정에서 고친 분류를 입힌 동작 목록 (이름은 영문·우리말 어느 쪽으로 적어도 됨) */
export function clipsOf(art: HsCutArt, cut: CutId, over: Record<string, ClipGroup>): HsClip[] {
  return art.clips.map((c) => ({ ...c, group: over[`${cut}:${c.name.toLowerCase()}`] ?? over[`${cut}:${c.ko.toLowerCase()}`] ?? c.group }));
}

// ── 편성 (저장 모양) ──

/** 큐시트의 컷: A 와이드 · B 바스트 · C 상품 클로즈업(A 를 코드로 2배) · D 전화 연결(B 위 그래픽) */
export type CueCut = 'A' | 'B' | 'C' | 'D';
/** 모델에 주고 받는 컷 낱말 (11-12 사용자: 고르는 낱말은 영어로. 읽을 때는 우리말도 받는다) */
export const CUE_CUT_WORD: Record<CueCut, string> = { A: 'wide', B: 'bust', C: 'product', D: 'phone' };
export type CueEvent = '' | 'price' | 'left' | 'rush' | 'soon' | 'sold' | 'call' | 'tear' | 'look';
/** 화면 사건 낱말 (모델에 주는 것과 읽는 것이 같게) */
export const CUE_EVENT_WORD: Record<Exclude<CueEvent, ''>, string> = { price: 'price', left: 'left -N', rush: 'rush', soon: 'soon', sold: 'sold', call: 'call', tear: 'tear', look: 'look' };
/** 화면에 띄우는 사건 딱지 글 */
export const CUE_EVENT_LABEL: Record<Exclude<CueEvent, ''>, string> = { price: '가격 공개', left: '남은 수량', rush: '주문 폭주', soon: '매진 임박', sold: '매진', call: '전화 연결', tear: '신호 찢김', look: '응시' };
export interface HsCue {
  cut: CueCut;
  /** 표정 = 동작 이름 (팩의 name. 모르는 말이면 talk) */
  mood: string;
  text: string;
  ev: CueEvent;
  /** 남은 수량 -N 의 N */
  n?: number;
}
export interface HsPart {
  item: ShopItem;
  cues: HsCue[];
  /** 무이자 할부: 값 대신 채널에 출연하는 횟수 (상품 줄의 출연 칸, 없으면 출연으로는 안 판다). 원 값은 item.price (0 이면 돈으로는 안 판다) */
  inst?: number;
  /** 방송에서 정말 매진됐다 (큐시트의 sold 줄이 나온 뒤). 다시 열어도 매진 그대로, 주문을 받지 않는다 (11-15 사용자) */
  out?: true;
  /** 이 부가 방송되는 동안 흐르는 시청자 채팅 (11-12 사용자: 상품마다) */
  chat?: HsChatLine[];
}
/** 전화 주문 상담원의 말 (편성과 같이 받는다): 전화를 받을 때 · 값이나 출연으로 주문이 확정될 때. 맞교환·흥정은 상담원 요청이 따로 (operatorPrompt) */
export interface HsOps { hello: string; done: string }
export interface HsChatLine { nick: string; text: string }
export interface HsShow {
  loaded: boolean;
  /** 받은 응답 키 */
  key: string;
  title: string;
  parts: HsPart[];
  /** 부 머리(#n) 없이 온 채팅 (부마다 채팅이 없을 때만 쓴다) */
  chat: HsChatLine[];
  /** 지금 방송 중인 부 (0부터). parts.length 이면 방송 끝 */
  at: number;
  /** 지난 편성의 상품 이름 (새로 받을 때 피하기) */
  prev: string[];
  ops?: HsOps;
  /** 마지막으로 본 본편 응답 키 (본편 턴이 넘어가면 편성 한 칸) */
  tk?: string;
}
export const emptyShow = (): HsShow => ({ loaded: false, key: '', title: '', parts: [], chat: [], at: 0, prev: [] });

const CUT_IN: [RegExp, CueCut][] = [[/^(a|와이드|wide|전체|스튜디오)/i, 'A'], [/^(b|바스트|bust|정면|진행자)/i, 'B'], [/^(c|상품|클로즈|close|product)/i, 'C'], [/^(d|전화|call|phone)/i, 'D']];
/** 화면 사건 칸 → 사건. 칸 전체가 사건 낱말(영어 낱말 또는 화면 딱지 글)과 똑같을 때만 받는다.
 *  낱말 일부만 맞춰 「곧 매진」「매진 직전」「nearly sold out」까지 매진으로 읽던 것을 막는다 (11-15 사용자: 매진이 거의 모든 상품에 뜬다) */
const EVENT_EXACT = new Map<string, Exclude<CueEvent, '' | 'left'>>(
  (Object.keys(CUE_EVENT_WORD) as Exclude<CueEvent, ''>[]).filter((k): k is Exclude<CueEvent, '' | 'left'> => k !== 'left').flatMap((k) => [[CUE_EVENT_WORD[k], k], [CUE_EVENT_LABEL[k].replace(/\s+/g, ''), k]] as [string, Exclude<CueEvent, '' | 'left'>][]),
);
export function eventOf(cell: string): { ev: CueEvent; n?: number } {
  const s = cell.replace(/[\s"'`「」『』\[\]()]+/g, '').toLowerCase();
  if (!s || s === '-') return { ev: '' };
  const left = /^(?:left|남은수량)[-−–]?(\d+)$/.exec(s);
  if (left) return { ev: 'left', n: Math.max(1, Math.min(99, Number(left[1]))) };
  return { ev: EVENT_EXACT.get(s) ?? '' };
}
/** 큐 한 줄 「컷|표정|대사|화면 사건」. 대사가 없으면 null */
export function parseCue(line: string, moods: Map<string, string>): HsCue | null {
  const cells = line.split('|').map((x) => x.trim());
  if (cells.length < 3) return null;
  // 대사 안에 「|」가 섞이면 칸이 밀린다: 사건은 늘 맨 끝 칸, 그 사이는 모두 대사
  const ev = cells.length >= 4 ? cells[cells.length - 1] : '';
  const text = clean(cells.slice(2, cells.length >= 4 ? -1 : undefined).join(' '), 160);
  if (!text) return null;
  const cut = CUT_IN.find(([re]) => re.test(cells[0]))?.[1] ?? 'B';
  // 그림 묶음이 아직 안 왔으면(표정 표가 비었으면) 낱말 그대로 두고 재생 때 찾는다 (moodName)
  const word = cells[1].replace(/\s+/g, '').toLowerCase();
  const mood = moods.get(word) ?? (moods.size ? 'talk' : word || 'talk');
  return { cut, mood, text, ...eventOf(ev) };
}
/** 저장된 표정(동작 이름 또는 그림이 늦어 남은 낱말) → 동작 이름 */
export const moodName = (mood: string, moods: Map<string, string>): string => moods.get(mood.replace(/\s+/g, '').toLowerCase()) ?? (moods.size ? 'talk' : mood);
/** 표정 낱말 → 동작 이름 (팩의 우리말 이름·영문 이름 둘 다 받는다) */
export function moodMap(pack: Pick<HsPack, 'cuts'> | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of [...(pack?.cuts.A.clips ?? []), ...(pack?.cuts.B.clips ?? [])]) {
    m.set(c.name.toLowerCase(), c.name);
    m.set(c.ko.replace(/\s+/g, '').toLowerCase(), c.name);
  }
  return m;
}

export class HsError extends ShopError {}
function block(raw: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(raw);
  return m ? m[1].trim() : '';
}
export interface ShowReply { title: string; items: Omit<ShopItem, 'id'>[]; insts: number[]; cues: HsCue[][]; chat: HsChatLine[]; chats: HsChatLine[][]; ops: HsOps }
/** 상품 줄 「이름|값|쓰임|그림|무게|설명|효과|출연|진실」 → 물건 + 출연 횟수. 값은 원(없으면 「-」), 출연은 정수(없으면 「-」). 둘 다 없으면 null.
 *  값 칸에 「무이자 N회」처럼 횟수가 오면 출연으로 읽는다 (원 값 0 = 돈으로는 안 판다. 공짜가 되지 않게). 원이 아닌 대가 글은 받지 않는다 — 그런 대가는 상담원이 흥정에서 정한다 */
export function hsLine(line: string): { item: Omit<ShopItem, 'id'>; inst: number } | null {
  const cells = lineCells(line);
  if (cells.length < 2) return null;
  const inPrice = /(\d+)\s*회/.exec(cells[1] ?? '');
  const inst = Math.min(99, Number(/\d+/.exec(cells[7] ?? '')?.[0] ?? inPrice?.[1] ?? 0) || 0);
  const price = inPrice ? 0 : costOf(cells[1] ?? '')?.price ?? 0;
  const c = [...cells];
  c[1] = String(price);
  c[7] = '';
  const it = parseLine(c.join('|'));
  if (!it || (price <= 0 && inst <= 0)) return null;
  const { pay: _p, tag: _t, was: _w, ...rest } = it;
  return { item: rest, inst };
}
/** 편성 응답: <title> · <shelf>(상점 줄) · <cue>(「#n」 아래 그 상품의 큐 줄) · <chat>(「#n」 아래 그 상품 동안의 닉|말) */
export function parseShow(raw: string, moods: Map<string, string>): ShowReply {
  const shelfText = block(raw, 'shelf');
  if (!shelfText) throw new HsError(guideTxt('Shop', 'ERROR_NO_SHELF'));
  const rows = shelfText.split('\n').map(hsLine).filter((x): x is NonNullable<ReturnType<typeof hsLine>> => !!x);
  if (!rows.length) throw new HsError(guideTxt('Shop', 'ERROR_NO_ITEMS', { line: guideTxt('Hs', 'LINE') }));
  const shelf = { items: rows.map((r) => r.item) };
  const cueText = block(raw, 'cue');
  if (!cueText) throw new HsError(guideTxt('Hs', 'ERR_NO_CUE'));
  const cues: HsCue[][] = [];
  let cur: HsCue[] | null = null;
  for (const line of cueText.split('\n')) {
    if (/^\s*#\s*\d+/.test(line)) {
      cur = [];
      cues.push(cur);
      continue;
    }
    const c = parseCue(line, moods);
    if (!c) continue;
    if (!cur) {
      cur = [];
      cues.push(cur);
    }
    cur.push(c);
  }
  const items = shelf.items.slice(0, cues.length || shelf.items.length);
  if (items.some((_, i) => !cues[i]?.length)) throw new HsError(guideTxt('Hs', 'ERR_CUE_LINES', { n: shelf.items.length }));
  const { shared: chat, parts: chats } = parseChat(block(raw, 'chat'));
  const opLine = (re: RegExp) => clean(block(raw, 'operator').split('\n').map((x) => re.exec(x)?.[1] ?? '').find(Boolean) ?? '', 120);
  const ops: HsOps = { hello: opLine(/^\s*(?:인사|hello)\s*[|:]\s*(.+)$/i), done: opLine(/^\s*(?:확정|done)\s*[|:]\s*(.+)$/i) };
  return { title: clean(block(raw, 'title'), 40), items, insts: rows.slice(0, items.length).map((r) => r.inst), cues: cues.slice(0, items.length), chat, chats: chats.slice(0, items.length), ops };
}

/** 채팅 줄 「닉|말」. 「#n」 머리 아래 줄은 그 부의 것, 머리 앞 줄은 공용.
 *  머리는 「|」 없는 줄이 꾸밈 뒤 #숫자로 시작하면 (뒤 상품명·「.」·「:」는 버림, 전수검사 11-13) */
export function parseChat(text: string): { shared: HsChatLine[]; parts: HsChatLine[][] } {
  const shared: HsChatLine[] = [];
  const parts: HsChatLine[][] = [];
  let cur: HsChatLine[] = shared;
  for (const line of text.split('\n')) {
    const head = line.includes('|') ? null : /^[\s*_\[(【\-]*[#＃]\s*(\d+)/.exec(line);
    if (head) {
      const n = Math.max(1, Math.min(20, Number(head[1])));
      while (parts.length < n) parts.push([]);
      cur = parts[n - 1];
      continue;
    }
    const i = line.indexOf('|');
    const nick = clean(i >= 0 ? line.slice(0, i) : '', 16);
    const said = clean(i >= 0 ? line.slice(i + 1) : line, 80);
    if (said) cur.push({ nick: nick || guideTxt('Hs', 'CHAT_ANON_NICK'), text: said });
  }
  return { shared, parts };
}

let seq = 0;
const itemId = (key: string, i: number) => `ms${(Date.now() % 1e9).toString(36)}${(seq++).toString(36)}_${i}_${key.slice(-4)}`;
/** 받은 편성을 상태로 (지금 부는 처음부터) */
export function applyShow(st: HsShow, r: ShowReply, key: string): HsShow {
  const parts = r.items.map((it, i) => ({ item: { ...it, id: itemId(key, i) }, cues: r.cues[i], ...(r.insts?.[i] ? { inst: r.insts[i] } : {}), ...(r.chats?.[i]?.length ? { chat: r.chats[i] } : {}) }));
  return { loaded: true, key, title: r.title, parts, chat: r.chat, at: 0, prev: [...st.prev, ...st.parts.map((p) => p.item.name)].slice(-24), ...(r.ops ? { ops: r.ops } : {}), tk: key };
}

/** 본편 턴이 넘어갔으면 편성 한 칸 넘긴 상태, 아니면 null (다시 굴리기는 턴이 아니다). 자동 호출이 수동이어도 넘긴다 (전수검사 11-13) */
export function turnStep(show: HsShow, turnOn: boolean, key: string): HsShow | null {
  if (!turnOn || !show.loaded || show.tk === undefined || show.tk === key || show.at >= show.parts.length) return null;
  return { ...show, at: Math.min(show.at + 1, show.parts.length), tk: key };
}

export function readShow(vars: Vars): HsShow {
  const raw = vars?.[HS_VAR];
  if (typeof raw !== 'string' || !raw) return emptyShow();
  try {
    const j = JSON.parse(raw) as Partial<HsShow>;
    if (!j || !Array.isArray(j.parts)) return emptyShow();
    const lines = (x: unknown): HsChatLine[] => (Array.isArray(x) ? x.filter((c): c is HsChatLine => !!c && typeof c.text === 'string').map((c) => ({ nick: String(c.nick ?? ''), text: c.text })) : []);
    const parts = j.parts.filter((p): p is HsPart => !!p && typeof p === 'object' && !!p.item && typeof p.item.name === 'string' && Array.isArray(p.cues)).map((p) => { const { chat, ...rest } = p; const c = lines(chat); return c.length ? { ...rest, chat: c } : rest; });
    return {
      loaded: j.loaded === true && parts.length > 0, key: String(j.key ?? ''), title: String(j.title ?? ''), parts,
      chat: lines(j.chat),
      at: Math.max(0, Math.min(parts.length, Math.floor(Number(j.at) || 0))),
      prev: Array.isArray(j.prev) ? j.prev.map(String).slice(-24) : [],
      ...(j.ops && typeof j.ops === 'object' ? { ops: { hello: String(j.ops.hello ?? ''), done: String(j.ops.done ?? '') } } : {}),
      ...(typeof j.tk === 'string' ? { tk: j.tk } : {}),
    };
  } catch {
    return emptyShow();
  }
}
export const showVars = (st: HsShow): Record<string, string> => ({ [HS_VAR]: JSON.stringify(st) });

/** 상품 값 글 (방송 가격판·편성 카드·시청 기록·채팅 반응 요청이 같이 쓴다): 지침 「망상홈쇼핑」의 PAY_BOTH · PAY_WON · PAY_APPEAR 절 */
export function hsPayText(part: Pick<HsPart, 'item' | 'inst'>): string {
  const won = part.item.price > 0 ? part.item.price.toLocaleString('en-US') : '';
  const n = part.inst ?? 0;
  return won && n ? guideTxt('Hs', 'PAY_BOTH', { won, n }) : won ? guideTxt('Hs', 'PAY_WON', { won }) : n ? guideTxt('Hs', 'PAY_APPEAR', { n }) : '';
}

/** FNV-1a (같은 상품이면 늘 같은 조각) */
function fnv(t: string): number {
  let h = 2166136261;
  for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
/** 스티커를 들추면 보이는 숨은 효과(진실) 몇 글자 (11-15 사용자: 원래 효과의 일부 문자만 살짝).
 *  어절 하나에서 시작해 cap 글자 안에서 이웃 어절을 붙인다. 진실이 없거나 아무도 모르면(?) 빈 글. seed = 상품 id (다시 열어도 같은 조각) */
export function peelFragment(truth: string | undefined, seed: string, cap: number): string {
  const t = String(truth ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t === '?' || cap <= 0) return '';
  const words = t.split(' ');
  const cand = words.map((w, k) => (Array.from(w).length >= 2 ? k : -1)).filter((k) => k >= 0);
  const pool = cand.length ? cand : words.map((_, k) => k);
  const i = pool[fnv(seed) % pool.length];
  let j = i + 1;
  while (j < words.length && Array.from(words.slice(i, j + 1).join(' ')).length <= cap) j++;
  return Array.from(words.slice(i, j).join(' ')).slice(0, cap).join('');
}

// ── 동작 고르기 (재생 규칙. 기본값은 그림/홈쇼핑/homeshop.json 과 HS_NUM, 전부 설정에서 고친다) ──

export interface IdleState {
  /** 대기 동작을 돈 횟수 (전체) */
  loops: number;
  /** 다음 「가끔」 자리까지 남은 대기 반복 */
  until: number;
  /** 동작 이름 → 마지막으로 쓴 때의 loops */
  last: Record<string, number>;
  /** 동작 이름 → 마지막으로 쓴 판 */
  ver: Record<string, string>;
  lastFill: string;
}
export const idleState = (): IdleState => ({ loops: 0, until: -1, last: {}, ver: {}, lastFill: '' });
const between = (r: [number, number], rnd: () => number) => r[0] + Math.floor(rnd() * (r[1] - r[0] + 1));
/** 같은 이름의 1·2판은 번갈아 */
export function pickVersion(clips: HsClip[], name: string, st: IdleState): HsClip | null {
  const list = clips.filter((c) => c.name === name && c.group !== 'off');
  if (!list.length) return null;
  const c = list.find((x) => x.ver !== st.ver[name]) ?? list[0];
  st.ver[name] = c.ver;
  return c;
}
/** 아무 일 없을 때 다음에 틀 동작: 기본 대기를 돌리다가 정해진 횟수마다 「가끔」 하나, 그 자리에서 확률로 「드물게」 */
export function nextIdle(clips: HsClip[], st: IdleState, rules: HsRules, rnd: () => number = Math.random): HsClip | null {
  const base = clips.find((c) => c.group === 'base') ?? clips.find((c) => c.group !== 'off') ?? null;
  if (st.until < 0) st.until = between(rules.fill, rnd);
  if (st.until > 0) {
    st.until--;
    st.loops++;
    return base;
  }
  st.until = between(rules.fill, rnd);
  st.loops++;
  const ready = (name: string, cool: number) => st.last[name] === undefined || st.loops - st.last[name] > cool;
  const names = (g: ClipGroup) => [...new Set(clips.filter((c) => c.group === g).map((c) => c.name))];
  const rare = names('rare').filter((x) => ready(x, rules.rareCool));
  const lastRare = Math.max(-Infinity, ...names('rare').map((x) => st.last[x] ?? -Infinity));
  let name = '';
  if (rare.length && st.loops - lastRare > rules.rareCool && rnd() < rules.rareP) name = rare[Math.floor(rnd() * rare.length)];
  else {
    const fill = names('filler').filter((x) => x !== st.lastFill && ready(x, rules.fillCool));
    const any = fill.length ? fill : names('filler').filter((x) => x !== st.lastFill);
    if (any.length) {
      name = any[Math.floor(rnd() * any.length)];
      st.lastFill = name;
    }
  }
  if (!name) return base;
  st.last[name] = st.loops;
  return pickVersion(clips, name, st) ?? base;
}
/** 큐의 표정에 맞는 동작. 그 컷에 없으면 말하기, 그것도 없으면 기본 */
export function moodClip(clips: HsClip[], mood: string, st: IdleState): HsClip | null {
  return pickVersion(clips, mood, st) ?? pickVersion(clips, 'talk', st) ?? clips.find((c) => c.group === 'base') ?? null;
}
/** 큐 한 줄의 길이 (ms): 글자 수 ÷ 자막 속도 + 쉼 */
export const cueMs = (c: Pick<HsCue, 'text'>, s: Pick<HsSettings, 'speed' | 'hold'>): number => Math.round((Array.from(c.text).length / s.speed + s.hold) * 1000);

// ── 남은 수량 저절로 줄기 (값은 전부 설정 HsDrop) ──

/** 한 번에 줄이는 수는 1~설정 「한 번에 줄어드는 수」. 너무 잦아지면(DROP_GAP_MS 안쪽, 화면 갱신 한계) 한 번에 더 많이 줄인다 */
const DROP_GAP_MS = 1000;
/** 이번 부에서 끝날 때 남길 수 (시작 값보다 작게, 1 이상) */
export const dropEnd = (left: number, d: HsDrop, rnd: () => number = Math.random): number =>
  Math.max(1, Math.min(left - 1, d.end[0] + Math.floor(rnd() * (d.end[1] - d.end[0] + 1))));
/** 남은 방송 길이(ms. 빨라지는 구간은 배수만큼 길게 친다)와 큐시트가 앞으로 뺄 수. at = 지금 큐 자리, restMs = 지금 큐의 남은 시간 */
export function dropRest(cues: HsCue[], at: number, restMs: number, fast: boolean, s: Pick<HsSettings, 'speed' | 'hold' | 'drop'>): { ms: number; planned: number } {
  let ms = Math.max(0, restMs) * (fast ? s.drop.fast : 1);
  let planned = 0;
  for (let i = at + 1; i < cues.length; i++) {
    const c = cues[i];
    // 매진 뒤로는 줄 것이 없다
    if (c.ev === 'sold') break;
    if (c.ev === 'price' || c.ev === 'rush') fast = true;
    if (c.ev === 'left') planned += c.n ?? 1;
    ms += cueMs(c, s) * (fast ? s.drop.fast : 1);
  }
  return { ms, planned };
}
/** 다음에 줄일 수와 그때까지(ms, 빨라진 동안은 배수만큼 빨리 흐른다). 더 줄일 것이 없으면 null. 끝 수(end, 1 이상) 아래로는 안 내려간다 */
export function nextDrop(left: number, end: number, rest: { ms: number; planned: number }, d: HsDrop, rnd: () => number = Math.random): { n: number; wait: number } | null {
  const room = left - rest.planned - Math.max(1, end);
  if (!d.on || room <= 0 || rest.ms <= 0) return null;
  const unit = rest.ms / room / d.rate;
  const base = Math.max(1, Math.ceil(DROP_GAP_MS / unit));
  const n = Math.min(room, Math.floor(base * (1 + rnd() * Math.max(1, d.step))));
  // 마지막 몫이 방송 끝을 넘겨 버려지지 않게, 남은 시간의 절반 안에 줄인다
  return { n, wait: Math.min(n * unit * (0.6 + rnd() * 0.8), rest.ms / 2) };
}


// ── 주문·할부 장부·택배 상자·방청 (설계 8-4 ~ 8-10) ──
// 할부는 물건이 아니라 사람에게 붙는 장부다 (11-09 사용자: 물건에 붙이면 쓰거나 버릴 때 의무도 사라진다). 가계부는 건드리지 않는다.
// 받는 법 (2026-11-16 사용자): 상자는 주문 때 몰래 뽑은 턴(설정 「상자가 닿기까지」)에 닿는다. 그때까지 「오는 중」이고 본편에는 아무것도 안 간다.
// 계약은 상자를 열 때 맺어진다 (로어북: 여는 사람이 산 사람). 출연 호출 턴은 주문 때가 아니라 열 때 뽑아 적는다. 안 연 상자에는 출연이 걸리지 않는다.
// 「몇 회 냈나」는 저장하지 않고 지금 턴 수로 센다 — 응답을 지우거나 다시 굴리면 저절로 되돌아간다 (가계부 방식).

export const HS_ORDERS_VAR = '$hs_orders';
export const HS_AUD_VAR = '$hs_aud';
export const HS_ORDERS_MAX = 40;
export interface HsOrder {
  id: string;
  /** 상품 (상자를 열면 소지품에 들어갈 것) */
  item: Omit<ShopItem, 'id' | 'sold' | 'soldKey' | 'tag' | 'was' | 'orig'>;
  /** 출연 횟수 (무이자 할부. 출연이 걸리지 않은 결제면 0) */
  n: number;
  /** 치른 것 전부 (주문 조회·본편 기록 글. 지침 ORDER_* 절로 만든다) */
  how: string;
  /** 결제 방법: 원 값 · 출연 · 상담원과 정한 조건(맞교환·흥정) */
  pay: HsPay;
  /** 주문한 응답 키 (그 응답이 지워지면 주문도 없던 일) · 주문 때 턴 */
  anchor: string;
  turn: number;
  /** 불려 가는 턴들 (n 개, 오름차순). 상자를 열 때 뽑는다 — 열기 전에는 빈 목록 */
  dues: number[];
  /** 상담원과 맺은 조건 (상자·물건의 결제 글을 만들 때 쓴다) */
  terms?: HsTerms;
  /** 원 몫의 가계부 거래 id (상자와 물건에 같은 id 로 남긴다) */
  walletId?: string;
  /** 상자가 닿는 턴 (끝난 턴 수 doneTurns 기준). 주문 때 몰래 뽑아 적는다 */
  arrive: number;
  /** 상자를 넣은 응답 키 (아직 안 닿았으면 없음. 그 응답이 지워지면 상자도 없던 일이라 다시 닿는다) */
  boxKey?: string;
  /** 소지품의 택배 상자 id · 연 응답 키 */
  boxId: string;
  openKey?: string;
}
/** 끝난 턴 수: 답까지 받은 유저 전송 횟수 (보내고 아직 답을 못 받은 턴은 빼고) */
export const doneTurns = (chat: Chat): number => {
  const list = chat.message ?? [];
  return userTurns(chat) - (list.length && list[list.length - 1].role === 'user' ? 1 : 0);
};
export function readOrders(vars: Vars): HsOrder[] {
  try {
    const arr: unknown = JSON.parse(String(vars?.[HS_ORDERS_VAR] ?? '') || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((o): o is HsOrder => !!o && typeof o === 'object' && typeof (o as HsOrder).id === 'string' && !!(o as HsOrder).item && typeof (o as HsOrder).item.name === 'string' && Array.isArray((o as HsOrder).dues)).map((o) => ({ ...o, how: String(o.how ?? ''), pay: o.pay ?? 'appear', arrive: typeof o.arrive === 'number' ? o.arrive : Number(o.turn) || 0, ...(o.boxKey === undefined && typeof o.arrive !== 'number' && o.boxId ? { boxKey: String(o.anchor ?? '') } : {}) }));
  } catch {
    return [];
  }
}
export const ordersVars = (list: HsOrder[]): Record<string, string> => ({ [HS_ORDERS_VAR]: list.length ? JSON.stringify(list.slice(-HS_ORDERS_MAX)) : '' });
/** 살아 있는 주문 (주문한 응답이 남아 있는 것) */
export const liveOrders = (vars: Vars, alive: Set<string>): HsOrder[] => readOrders(vars).filter((o) => !o.anchor || alive.has(o.anchor));
/** 상자가 닿았나 (넣은 응답이 살아 있을 때만) */
export const orderArrived = (o: HsOrder, alive: Set<string>): boolean => o.boxKey !== undefined && (!o.boxKey || alive.has(o.boxKey));
/** 이 응답 뒤에 상자가 닿은 주문이 있나 (그 턴의 메인 요청에 받는 법 ARRIVE 를 한 번 붙인다. 같은 턴에 열어 버렸어도 닿은 것은 닿은 것) */
export const boxLanded = (vars: Vars, lastKey: string, alive: Set<string>): boolean => !!lastKey && liveOrders(vars, alive).some((o) => o.boxKey === lastKey);
/** 닿을 턴이 됐는데 아직 상자를 못 넣은 주문 (연 것은 빼고) */
export const dueOrders = (chat: Chat): HsOrder[] => {
  const alive = aliveAnchors(chat);
  const done = doneTurns(chat);
  return liveOrders(chat.scriptstate, alive).filter((o) => !orderArrived(o, alive) && !orderOpened(o, alive) && o.arrive <= done);
};
/** 닿는 턴 뽑기: 지금 끝난 턴에서 설정 「상자가 닿기까지」(최소~최대) 만큼 뒤. 0 이면 주문한 턴 */
export const scheduleArrive = (done: number, ship: [number, number], rnd: () => number = Math.random): number => done + ship[0] + Math.floor(rnd() * (ship[1] - ship[0] + 1));
/** 낸 회차: 예정 턴이 지금 턴 이하인 것 */
export const paidOf = (o: HsOrder, turnNow: number): number => o.dues.filter((d) => d <= turnNow).length;
/** 상자를 열었나 (연 응답이 살아 있을 때만) */
export const orderOpened = (o: HsOrder, alive: Set<string>): boolean => o.openKey !== undefined && (!o.openKey || alive.has(o.openKey));
/** 호출 턴 뽑기: 지금 턴에서 간격(최소~최대)씩. 다른 주문의 호출 턴과 겹치면 한 턴 미룬다 (한 턴에 하나) */
export function scheduleDues(taken: number[], turn: number, n: number, gap: [number, number], rnd: () => number = Math.random): number[] {
  const used = new Set(taken);
  const out: number[] = [];
  let t = turn;
  for (let i = 0; i < n; i++) {
    t += gap[0] + Math.floor(rnd() * (gap[1] - gap[0] + 1));
    while (used.has(t)) t++;
    used.add(t);
    out.push(t);
  }
  return out;
}
/** 결제 방법 (11-15 사용자: 비싼 값을 치르거나, 다른 물건으로 치르거나, 상담원과 흥정하거나, 출연으로 때우거나) */
export type HsPay = 'won' | 'appear' | 'barter' | 'talk';
/** 상담원이 내놓은 조건: 원 · 가져갈 내 물건(id·이름) · 출연 횟수 · 그 밖의 대가 글 */
export interface HsTerms { money: number; items: { id: string; name: string }[]; appear: number; other: string }
/** 조건 → 치른 것 글 (지침 ORDER_WON · ORDER_BARTER · ORDER_INSTALLMENT · ORDER_OTHER, ORDER_JOIN 으로 잇는다). money=false 면 원 몫은 뺀다 (물건에 원 값이 따로 붙을 때) */
export function termsText(t: HsTerms, money = true): string {
  const parts = [
    money && t.money > 0 ? guideTxt('Hs', 'ORDER_WON', { won: t.money.toLocaleString('en-US') }) : '',
    t.items.length ? guideTxt('Hs', 'ORDER_BARTER', { gave: t.items.map((x) => x.name).join(', ') }) : '',
    t.appear > 0 ? guideTxt('Hs', 'ORDER_INSTALLMENT', { n: t.appear }) : '',
    t.other ? guideTxt('Hs', 'ORDER_OTHER', { other: t.other }) : '',
  ].filter(Boolean);
  return parts.join(` ${guideTxt('Hs', 'ORDER_JOIN').trim() || '+'} `);
}
/** 상담원 응답: <operator> 말 + <terms> 조건 (「none」이면 조건 없음). 물건 이름은 내민 물건 가운데서만 찾는다 (모르는 이름은 버림). 값의 크기는 거르지 않는다 — 판단은 상담원(모델) 몫 */
export function parseOperator(raw: string, offered: { id: string; name: string }[]): { line: string; terms: HsTerms | null } {
  const line = clean(block(raw, 'operator'), 300);
  if (!line) throw new HsError(guideTxt('Hs', 'ERR_NO_OPERATOR'));
  const body = block(raw, 'terms');
  if (!body || /^\s*(none|없음|-)\s*$/i.test(body)) return { line, terms: null };
  const t: HsTerms = { money: 0, items: [], appear: 0, other: '' };
  const key = (n: string) => n.replace(/\s+/g, '').toLowerCase();
  for (const l of body.split('\n')) {
    const m = /^\s*[-*•]?\s*(money|돈|원|items?|물건|appear|출연|other|기타)\s*[|:：]\s*(.+)$/i.exec(l);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (/^(money|돈|원)$/.test(k)) t.money = costOf(v)?.price ?? 0;
    else if (/^(appear|출연)$/.test(k)) t.appear = Math.min(99, Number(/\d+/.exec(v)?.[0] ?? 0));
    else if (/^(other|기타)$/.test(k)) t.other = clean(v, 60);
    else for (const n of v.split(/[;；,、]/)) {
      const hit = offered.find((o) => key(o.name) === key(n.replace(/[「」『』"']/g, '')));
      if (hit && !t.items.some((x) => x.id === hit.id)) t.items.push(hit);
    }
  }
  return { line, terms: t.money || t.items.length || t.appear || t.other ? t : null };
}
const boxName = (name: string) => guideTxt('Hs', 'BOX_NAME', { name }).slice(0, 30);
/** 새 주문 (장부 줄). 상자가 닿는 턴만 뽑아 적는다. 상자는 그 턴에 넣고(core/hsship.ts deliverOrders), 출연 호출 턴은 상자를 열 때 뽑는다(openOrder) */
export function newOrder(chat: Chat, item: ShopItem, s: Pick<HsSettings, 'ship'>, pay: HsPay, terms: HsTerms, rnd: () => number = Math.random): HsOrder {
  const { id: _id, sold: _s, soldKey: _k, tag: _t, was: _w, orig: _o, ...rest } = item;
  return { id: `ho_${item.id}`, item: rest, n: terms.appear, how: termsText(terms), pay, terms, anchor: lastBot(chat)?.key ?? '', turn: userTurns(chat), dues: [], arrive: scheduleArrive(doneTurns(chat), s.ship, rnd), boxId: '' };
}
/** 상자를 연 주문: 연 응답 키를 적고, 출연이 걸렸으면 이제 호출 턴을 뽑는다 (다른 연 주문의 호출 턴과 겹치지 않게) */
export function openOrder(chat: Chat, o: HsOrder, s: Pick<HsSettings, 'call'>, openKey: string, rnd: () => number = Math.random): HsOrder {
  const alive = aliveAnchors(chat);
  const taken = liveOrders(chat.scriptstate, alive).filter((x) => x.id !== o.id && orderOpened(x, alive)).flatMap((x) => x.dues);
  return { ...o, openKey, dues: scheduleDues(taken, userTurns(chat), o.n, s.call, rnd) };
}
/** 상자에 적는 결제 글 (출연은 뺀다: 상자를 열기 전에는 걸리지 않는다) · 연 물건에 적는 결제 글 (전부) */
export function orderPaid(o: HsOrder, opened: boolean): string {
  const t = o.terms;
  if (!t) return '';
  const rest = termsText(opened ? t : { ...t, appear: 0 }, false);
  return rest ? guideTxt('Hs', 'ORDER_PAID', { how: rest }) : hsName();
}
/** 택배 상자 물건 (이름·설명 글은 지침 「망상홈쇼핑」의 BOX_NAME·BOX_DESC 절) */
export const HS_BOX = { name: boxName, get desc(): string { return guideTxt('Hs', 'BOX_DESC'); }, icon: 'cardboard box' };
/** 소지품 물건 id → 그 상자의 주문 (안 연 것만) */
export function boxOrder(vars: Vars, itemId: string, alive: Set<string>): HsOrder | null {
  if (!itemId || !String(vars?.[HS_ORDERS_VAR] ?? '').includes(itemId)) return null;
  return liveOrders(vars, alive).find((o) => o.boxId === itemId && !orderOpened(o, alive)) ?? null;
}

export interface HsAudience { anchor: string; no: string; name: string }
export function readAudience(vars: Vars): HsAudience | null {
  try {
    const j = JSON.parse(String(vars?.[HS_AUD_VAR] ?? '') || 'null') as HsAudience | null;
    return j && typeof j.no === 'string' ? { anchor: String(j.anchor ?? ''), no: j.no, name: String(j.name ?? '') } : null;
  } catch {
    return null;
  }
}

/** 본편에 넘기는 글의 머리 (지침 「망상홈쇼핑」의 BLOCK_HEAD 절). 이미 넣었는지도 이 머리로 본다 */
const blockHead = (): string => guideTxt('Hs', 'BLOCK_HEAD');
/** 지금 턴에 불려 가는 주문 (예정 턴 = 지금 턴). 여러 건이어도 하나. 상자를 연 주문만 (안 연 상자에는 출연이 걸리지 않는다) */
export function callNow(chat: Chat): { order: HsOrder; nth: number } | null {
  const t = userTurns(chat);
  const alive = aliveAnchors(chat);
  for (const o of liveOrders(chat.scriptstate, alive)) {
    if (!orderOpened(o, alive)) continue;
    const i = o.dues.indexOf(t);
    if (i >= 0) return { order: o, nth: i + 1 };
  }
  return null;
}
/** 본편에 이번 턴에만 넘길 글: 할부 호출 지시 · 방청 신청 한 줄. 없으면 빈 글 (평소엔 아무것도 안 보낸다, 설계 8-8) */
export function homeshopBlock(chat: Chat): string {
  const s = hsSettings(chat.scriptstate);
  if (!s.on) return '';
  const g = guideSections('Hs');
  const lines: string[] = [];
  const call = callNow(chat);
  if (call && g.CALL) {
    const { order: o, nth } = call;
    const form = s.forms[(o.id.length + nth * 7 + o.turn) % s.forms.length];
    lines.push(fillGuide(g.CALL, { item: o.item.name, nth: String(nth), total: String(o.n), left: String(o.n - nth), form }));
  }
  const aud = readAudience(chat.scriptstate);
  if (aud && s.aud && g.AUDIENCE && aud.anchor === (lastBot(chat)?.key ?? '')) lines.push(fillGuide(g.AUDIENCE, { no: aud.no, name: aud.name }));
  return lines.length ? `${blockHead()}\n${lines.join('\n')}` : '';
}
/** 요청: 위 글을 마지막 유저 메시지 앞에 system 으로 (소지품 블록과 같은 자리). 이미 있으면 그대로 */
export function withHomeshop<M extends PromptMessage>(messages: M[], chat: Chat): M[] {
  const head = blockHead();
  if (messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(head))) return messages;
  const text = homeshopBlock(chat);
  if (!text) return messages;
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const b = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, b] : [...messages.slice(0, at), b, ...messages.slice(at)];
}
