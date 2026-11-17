// 저장 정리 (2026-11-17 사용자: 원본처럼). 응답마다 쌓이는 인물 기록·문서 줄 가운데 죽은 것을 치운다.
// 원본 리수폿은 문서마다 지금 상태 하나 + 지난 이력 60개(WIKI_RETENTION history)만 둔다.
import type { Chat } from '../types';
import { anchorPositions, isAlive, liveEntries, liveness, SCENE_KEEP, type Liveness } from './store';
import { hookActive, parseHookHead } from './rhythm';
import type { Entry, PeopleStore } from './types';

/** 남겨 두는 지난 줄 수 (원본 이력 보관 기본값) */
export const HISTORY_KEEP = 60;

/** 죽은 줄을 치운다. 버린 줄 수.
 *  ① 다시 굴리거나 지워서 채팅에서 사라진 응답의 줄은 버린다 (변경 기록의 dropGoneChanges 와 같은 규칙:
 *     직접 고친 줄(manual)·시작값(seed)·'#N' 기준은 남긴다).
 *  ② 그 밖의 지난 줄(새 줄로 고쳐진 것·정리로 합쳐진 것·취소한 것)은 채팅 전체에서 최근 HISTORY_KEEP 개만 남긴다.
 *     「최근」은 그 줄이 밀려난 때(고친 줄의 응답 위치) 기준.
 *  진행 중인 떡밥의 지난 줄은 남긴다: 심은 턴을 그 사슬에서 읽는다 (rhythm.ts rootPos) */
export function pruneEntries(store: PeopleStore, chat: Chat): number {
  const at = anchorPositions(chat);
  const live: Liveness = liveness(chat);
  const lists: { get: () => Entry[]; set: (l: Entry[]) => void; keepAll: boolean }[] = [];
  for (const p of Object.values(store.people)) {
    for (const k of Object.keys(p.slots) as (keyof typeof p.slots)[]) {
      lists.push({ get: () => p.slots[k] ?? [], set: (l) => { p.slots[k] = l; }, keepAll: false });
    }
  }
  for (const d of Object.values(store.docs)) {
    const last = d.type === 'rhythm' && d.key.startsWith('hook:') ? liveEntries(d.entries, live).slice(-1)[0] : undefined;
    const head = last ? parseHookHead(last.text) : null;
    lists.push({ get: () => d.entries, set: (l) => { d.entries = l; }, keepAll: !!head && hookActive(head.stage) });
  }
  let dropped = 0;
  const past: { id: string; when: number; seq: number }[] = [];
  for (const l of lists) {
    const all = l.get();
    const kept = all.filter((e) => e.src === 'manual' || e.src === 'seed' || e.anchor.startsWith('#') || at.has(e.anchor));
    dropped += all.length - kept.length;
    if (kept.length !== all.length) l.set(kept);
    if (l.keepAll) continue;
    const alive = new Set(liveEntries(kept, live).map((e) => e.id));
    const pushedAt = new Map<string, number>();
    for (const e of kept) {
      if (!isAlive(e, live)) continue;
      const pos = live.at.get(e.anchor) ?? -1;
      for (const id of [...(e.replaces ? [e.replaces] : []), ...(e.from ?? [])]) pushedAt.set(id, Math.max(pushedAt.get(id) ?? -1, pos));
    }
    for (const e of kept) if (!alive.has(e.id)) past.push({ id: e.id, when: pushedAt.get(e.id) ?? live.at.get(e.anchor) ?? -1, seq: e.seq });
  }
  if (past.length <= HISTORY_KEEP) return dropped;
  past.sort((a, b) => b.when - a.when || b.seq - a.seq);
  const out = new Set(past.slice(HISTORY_KEEP).map((x) => x.id));
  for (const l of lists) {
    if (l.keepAll) continue;
    const all = l.get();
    const kept = all.filter((e) => !out.has(e.id));
    if (kept.length !== all.length) { dropped += all.length - kept.length; l.set(kept); }
  }
  return dropped;
}

/** 다음 턴 메모(변경 기록의 note) 정리. 버린 줄 수.
 *  쓰이는 것은 인물마다 가장 최근의 살아 있는 메모 하나다 (updater.ts latestNote).
 *  마지막 응답들을 지우거나 다시 굴려도 그 앞 응답의 메모가 있도록, 장면 인물 목록과 같이 채팅 뒤쪽 SCENE_KEEP 개 응답의 메모만 남긴다 (2026-11-17 사용자) */
export function pruneNotes(store: PeopleStore, chat: Chat): number {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const bots = list.map((m, i) => (m.role === 'char' ? i : -1)).filter((i) => i >= 0);
  if (bots.length <= SCENE_KEEP) return 0;
  const cut = bots[bots.length - SCENE_KEEP];
  const at = anchorPositions(chat);
  const before = store.log.length;
  store.log = store.log.filter((c) => c.kind !== 'note' || (at.get(c.anchor) ?? cut) >= cut);
  return before - store.log.length;
}
