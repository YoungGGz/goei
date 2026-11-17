// 저장 정리 (2026-11-17 사용자: 원본처럼). 응답마다 쌓이는 인물 기록·문서 줄 가운데 죽은 것을 치운다.
// 원본 리수폿은 문서마다 지금 상태 하나 + 지난 이력 60개(WIKI_RETENTION history)만 둔다.
import type { Chat } from '../types';
import { anchorPositions, changeId, foldLog, FOLD_KEEP_MSGS, isAlive, liveChanges, liveEntries, liveness, SCENE_KEEP, type Liveness } from './store';
import { opennessOf, sumCues, type AffinityOpts } from './affinity';
import { factionBase } from './base';
import { userFactionOf } from './faction';
import { AFF_MAX, AFF_MIN, FACTION_MAX, FACTION_MIN, factionOfWho, type Temper } from './types';
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

/** 오래된 호감·세력 평판 계기를 사람(세력)마다 숫자 하나(store.folded)로 합치고 줄은 버린다 (store.ts foldLog 의 규칙 그대로).
 *  합친 값은 지금 화면·요청이 쓰는 계산과 같게 낸다: 인물은 성격 계수 + 설정 속도·상한, 세력은 설정 속도·상한 (affinity.ts affinityOf·factionOf).
 *  합친 뒤에는 그 구간의 응답을 지워도 값이 되돌아가지 않는다 (원본도 이력 60개 밖은 같다) */
export function foldCues(store: PeopleStore, chat: Chat, o: { speed: number; speedDown: number; turnCap: number }, temperOf: (name: string) => Temper | undefined): void {
  const uf = userFactionOf(store, chat);
  foldLog(store, chat, (who, cues, folded) => {
    const code = factionOfWho(who);
    if (code !== null) {
      if (!code) return null;
      const base = factionBase(code, uf);
      return sumCues(who, base, cues, folded, FACTION_MIN, FACTION_MAX, o) - base;
    }
    const p = store.people[who];
    if (!p) return null;
    const opts: AffinityOpts = { ...o, temper: temperOf(who) };
    return sumCues(who, p.affinity.base, cues, folded, AFF_MIN, AFF_MAX, opts) - p.affinity.base;
  });
}

/** 오래된 음란도 변화 줄을 인물마다 시작값 줄 하나로 합친다 (호감 계기 합치기와 같은 경계: 채팅 뒤쪽 FOLD_KEEP_MSGS 밖).
 *  합친 줄은 기준 '#0'(늘 살아 있음)의 시작값(init)이라 계산(affinity.ts opennessOf)은 그대로다. 버린 줄 수 */
export function foldOpenness(store: PeopleStore, chat: Chat): number {
  const cut = (Array.isArray(chat.message) ? chat.message.length : 0) - FOLD_KEEP_MSGS;
  if (cut <= 0) return 0;
  const live = liveness(chat);
  const pos = (c: { anchor: string }) => live.at.get(c.anchor) ?? -1;
  const old = liveChanges(store, live).filter((c) => c.kind === 'openness' && pos(c) < cut);
  let dropped = 0;
  for (const who of new Set(old.map((c) => c.who))) {
    const p = store.people[who];
    const mine = old.filter((c) => c.who === who);
    if (!p || mine.length < 2) continue;
    const value = opennessOf(p, mine);
    if (value === null) continue;
    const gone = new Set(mine.map((c) => c.id));
    // 같은 사람의 오래된 죽은 줄도 함께 버린다
    for (const c of store.log) if (c.who === who && c.kind === 'openness' && !isAlive(c, live) && (live.at.get(c.anchor) ?? cut) < cut) gone.add(c.id);
    store.log = store.log.filter((c) => !gone.has(c.id));
    store.log.push({ id: changeId(who, 'openness', '#0', 0, `fold${value}`), anchor: '#0', seq: 0, src: 'seed', who, kind: 'openness', init: value, reason: '오래된 변화를 합친 값' });
    dropped += gone.size - 1;
  }
  return dropped;
}
