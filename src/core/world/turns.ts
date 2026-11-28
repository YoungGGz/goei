// 응답별 상황판 결과 (2026-11-28 사용자 「상황판부터」, 인수인계/2026-11-26_상황판_인물기록_개편_설계.md 1부).
// 「지금 상황판」 한 덩어리를 쌓아 두고 되감는 대신, 응답마다 「이 응답까지 반영한 상황판」을 그 응답의 열쇠로 적어 둔다.
// 읽을 때는 채팅에 살아 있는 마지막 응답의 것을 쓴다 — 응답을 지우거나 ◀▶ 로 바꿔도 되돌리는 코드 없이 맞는다 (소지품·가계부와 같은 방식).
import { messageKey } from '../people/store';
import type { Chat } from '../types';

export const TURNS_KEY = '$goei_turns';
/** 응답별 결과를 몇 개 두나 (오래된 것부터 밀려 「바탕」이 된다) */
export const TURNS_MAX = 10;

/** 응답 하나까지 반영한 상황판과 소속 */
export interface TurnSnap {
  /** 그 응답의 열쇠 (messageKey). 바탕은 '' 이거나 밀려난 응답의 열쇠 */
  k: string;
  /** 상황판 (serializeWorld) */
  w: string;
  /** 소속 ($st_faction·$st_pick·$ib_affiliation) */
  f: string;
  p: string;
  a: string;
  /** 같은 응답을 두 번 처리하지 않기 위한 지문 */
  fp?: string;
}

export interface TurnStore {
  v: 1;
  /** 살아 있는 응답별 결과가 하나도 없을 때의 상황판 (채팅 시작 때, 또는 밀려난 가장 오래된 응답의 결과) */
  base: TurnSnap | null;
  /** 응답별 결과. 적은 순서 */
  list: TurnSnap[];
  /** 마지막으로 반영한 응답의 열쇠. 지금 읽히는 결과가 이것과 다르면 응답이 지워졌거나 바뀐 것이다 */
  last: string;
}

const isSnap = (x: unknown): x is TurnSnap => !!x && typeof x === 'object' && typeof (x as TurnSnap).k === 'string' && typeof (x as TurnSnap).w === 'string';

let memoRaw = '';
let memo: TurnStore | null = null;

/** 저장값 읽기. 없거나 깨졌으면 null (옛 채팅·막 시작한 채팅: `$goei_world` 가 곧 지금 상황판) */
export function readTurns(raw: unknown): TurnStore | null {
  if (typeof raw !== 'string' || !raw) return null;
  if (raw === memoRaw && memo) return memo;
  try {
    const t = JSON.parse(raw) as TurnStore;
    if (!t || t.v !== 1 || !Array.isArray(t.list)) return null;
    const out: TurnStore = { v: 1, base: isSnap(t.base) ? t.base : null, list: t.list.filter(isSnap), last: typeof t.last === 'string' ? t.last : '' };
    memoRaw = raw;
    memo = out;
    return out;
  } catch {
    return null;
  }
}

/**
 * 지금 읽을 결과: 채팅 끝에서부터 거슬러 올라가며 처음 만나는, 결과가 적힌 응답의 것. 없으면 바탕. 저장값이 없으면 null.
 * skip: 그 자리의 메시지는 건너뛴다 (응답을 처리할 때 자기 자신)
 */
export function liveSnap(store: TurnStore | null, chat: Chat, skip = -1): TurnSnap | null {
  if (!store) return null;
  const list = chat.message ?? [];
  if (store.list.length) {
    const by = new Map(store.list.map((s) => [s.k, s]));
    for (let i = list.length - 1; i >= 0; i--) {
      if (i === skip) continue;
      const hit = by.get(messageKey(list[i], i));
      if (hit) return hit;
    }
    // 번호 열쇠(#n, chatId 없는 옛 메시지)는 앞 메시지를 지우면 번호가 밀려 「사라졌다」고 잘못 볼 수 있다 — 마지막으로 반영한 응답이 번호 열쇠면 살아 있는 것으로 본다
    if (store.last.startsWith('#') && !(skip >= 0 && list[skip] && messageKey(list[skip], skip) === store.last)) {
      const last = by.get(store.last);
      if (last) return last;
    }
  }
  return store.base;
}

/** 결과가 적혀 있지만 채팅에 없는 응답의 열쇠 (지웠거나 다시 굴린 것). 번호 열쇠(#n, chatId 없는 옛 메시지)는 가릴 수 없어 뺀다 */
export function deadTurnKeys(chat: Chat): Set<string> {
  const store = readTurns(chat.scriptstate?.[TURNS_KEY]);
  const dead = new Set<string>();
  if (!store?.list.length) return dead;
  const list = chat.message ?? [];
  const alive = new Set(list.map((m, i) => messageKey(m, i)));
  for (const s of store.list) if (!s.k.startsWith('#') && !alive.has(s.k)) dead.add(s.k);
  return dead;
}

/**
 * 응답 하나의 결과를 적는다 (같은 열쇠는 바꿔 끼움). 상한을 넘으면 가장 오래된 것부터 뺀다:
 * 살아 있는 응답의 것이면 바탕으로 삼고, 사라진 응답의 것이면 버린다 (dropped 에 그 열쇠 — 그 응답이 만든 일지 줄을 지울 때 쓴다).
 */
export function putTurn(store: TurnStore, snap: TurnSnap, chat: Chat): { store: TurnStore; dropped: string[] } {
  const list = store.list.filter((s) => s.k !== snap.k);
  list.push(snap);
  let base = store.base;
  const dropped: string[] = [];
  if (list.length > TURNS_MAX) {
    const msgs = chat.message ?? [];
    const alive = new Set(msgs.map((m, i) => messageKey(m, i)));
    while (list.length > TURNS_MAX) {
      const old = list.shift()!;
      if (alive.has(old.k)) base = old;
      else dropped.push(old.k);
    }
  }
  return { store: { v: 1, base, list, last: snap.k }, dropped };
}

export const serializeTurns = (store: TurnStore): string => JSON.stringify(store);
