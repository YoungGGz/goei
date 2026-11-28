// 저장 정리 (2026-11-17 사용자: 원본처럼). 응답마다 쌓이는 인물 기록·문서 줄 가운데 죽은 것을 치운다.
// 원본 리수폿은 지금 상태 + 지난 이력 60개(WIKI_RETENTION history)만 둔다. 우리는 응답을 지우면 기록이 되돌아가야 하므로 개수가 아니라
// 「채팅 뒤쪽 FOLD_KEEP_MSGS 메시지」를 경계로 쓴다 (호감 계기 합치기·음란도 합치기와 같은 경계).
import type { Chat } from '../types';
import { anchorPositions, changeId, foldLog, FOLD_KEEP_MSGS, isAlive, liveChanges, liveEntries, liveness, SCENE_KEEP, type Liveness } from './store';
import { opennessOf, sumCues, type AffinityOpts } from './affinity';
import { factionBase } from './base';
import { userFactionOf } from './faction';
import { AFF_MAX, AFF_MIN, FACTION_MAX, FACTION_MIN, factionOfWho, type Temper } from './types';
import { hookActive, parseHookHead } from './rhythm';
import type { Entry, PeopleStore } from './types';

/** 죽은 줄을 치운다. 버린 줄 수.
 *  ① 다시 굴리거나 지워서 채팅에서 사라진 응답의 줄은 버린다 (변경 기록의 dropGoneChanges 와 같은 규칙:
 *     직접 고친 줄(manual)·시작값(seed)·'#N' 기준은 남긴다).
 *  ② 그 밖의 지난 줄(새 줄로 고쳐진 것·정리로 합쳐진 것·취소한 것)은 밀려난 때가 채팅 뒤쪽 FOLD_KEEP_MSGS 메시지 밖이면 버린다.
 *     호감 계기 합치기와 같은 경계다: 그 안의 응답은 지우거나 다시 굴려도 옛 줄이 정확히 되살아난다.
 *     「밀려난 때」 = 그 줄을 고친(합친) 줄의 응답 위치. 정리 줄처럼 기준이 '#0' 이면 밀려난 줄 자신의 위치.
 *     어떤 줄을 버리면 그 줄이 가리고 있던 줄(replaces·from)도 같이 버린다: 가운데 줄만 없어져 더 옛 줄이 되살아나지 않게.
 *  진행 중인 떡밥의 지난 줄은 남긴다: 심은 턴을 그 사슬에서 읽는다 (rhythm.ts rootPos) */
export function pruneEntries(store: PeopleStore, chat: Chat, keepMsgs = FOLD_KEEP_MSGS): number {
  const at = anchorPositions(chat);
  const live: Liveness = liveness(chat);
  const cut = (Array.isArray(chat.message) ? chat.message.length : 0) - keepMsgs;
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
  for (const l of lists) {
    const all = l.get();
    let kept = all.filter((e) => e.src === 'manual' || e.src === 'seed' || e.anchor.startsWith('#') || at.has(e.anchor));
    if (!l.keepAll && cut > 0) {
      const alive = new Set(liveEntries(kept, live).map((e) => e.id));
      const byId = new Map(kept.map((e) => [e.id, e]));
      const hides = (e: Entry) => [...(e.replaces ? [e.replaces] : []), ...(e.from ?? [])];
      const pushedAt = new Map<string, number>();
      for (const e of kept) {
        if (!isAlive(e, live)) continue;
        const pos = live.at.get(e.anchor) ?? -1;
        for (const id of hides(e)) {
          const own = live.at.get(byId.get(id)?.anchor ?? '') ?? -1;
          pushedAt.set(id, Math.max(pushedAt.get(id) ?? -1, pos >= 0 ? pos : own));
        }
      }
      const out = new Set(kept.filter((e) => !alive.has(e.id) && (pushedAt.get(e.id) ?? live.at.get(e.anchor) ?? -1) < cut).map((e) => e.id));
      for (let grew = true; grew; ) {
        grew = false;
        for (const id of [...out]) for (const h of hides(byId.get(id)!)) if (byId.has(h) && !alive.has(h) && !out.has(h)) { out.add(h); grew = true; }
      }
      if (out.size) kept = kept.filter((e) => !out.has(e.id));
    }
    if (kept.length !== all.length) { dropped += all.length - kept.length; l.set(kept); }
  }
  return dropped;
}

/** 다음 턴 메모(변경 기록의 note) 정리. 버린 줄 수.
 *  쓰이는 것은 인물마다 가장 최근의 살아 있는 메모 하나다 (updater.ts latestNote).
 *  마지막 응답들을 지우거나 다시 굴려도 그 앞 응답의 메모가 있도록, 장면 인물 목록과 같이 채팅 뒤쪽 SCENE_KEEP 개 응답의 메모만 남긴다 (2026-11-17 사용자) */
export function pruneNotes(store: PeopleStore, chat: Chat, keepScene = SCENE_KEEP): number {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const bots = list.map((m, i) => (m.role === 'char' ? i : -1)).filter((i) => i >= 0);
  if (bots.length <= keepScene) return 0;
  const cut = bots[bots.length - keepScene];
  const at = anchorPositions(chat);
  const before = store.log.length;
  store.log = store.log.filter((c) => c.kind !== 'note' || (at.get(c.anchor) ?? cut) >= cut);
  return before - store.log.length;
}

/** 오래된 호감·세력 평판 계기를 사람(세력)마다 숫자 하나(store.folded)로 합치고 줄은 버린다 (store.ts foldLog 의 규칙 그대로).
 *  합친 값은 지금 화면·요청이 쓰는 계산과 같게 낸다: 인물은 성격 계수 + 설정 속도·상한, 세력은 설정 속도·상한 (affinity.ts affinityOf·factionOf).
 *  합친 뒤에는 그 구간의 응답을 지워도 값이 되돌아가지 않는다 (원본도 이력 60개 밖은 같다) */
export function foldCues(store: PeopleStore, chat: Chat, o: { speed: number; speedDown: number; turnCap: number; logCap?: number }, temperOf: (name: string) => Temper | undefined, keepMsgs = FOLD_KEEP_MSGS): void {
  const uf = userFactionOf(store, chat);
  foldLog(store, chat, (who, cues, folded) => {
    const code = factionOfWho(who);
    if (code !== null) {
      if (!code) return null;
      const base = factionBase(code, uf);
      return sumCues(who, base, cues, folded, FACTION_MIN, FACTION_MAX, { ...o, hold: true }) - base;
    }
    const p = store.people[who];
    if (!p) return null;
    const opts: AffinityOpts = { speed: o.speed, speedDown: o.speedDown, turnCap: o.turnCap, temper: temperOf(who) };
    return sumCues(who, p.affinity.base, cues, folded, AFF_MIN, AFF_MAX, opts) - p.affinity.base;
  }, keepMsgs, o.logCap);
}

/** 오래된 음란도 변화 줄을 인물마다 시작값 줄 하나로 합친다 (호감 계기 합치기와 같은 경계: 채팅 뒤쪽 FOLD_KEEP_MSGS 밖).
 *  합친 줄은 기준 '#0'(늘 살아 있음)의 시작값(init)이라 계산(affinity.ts opennessOf)은 그대로다. 버린 줄 수 */
/** 접은 음란도 줄의 표식 (다시 읽기 비우기가 이 줄을 찾는다) */
export const OPENNESS_FOLD_REASON = '오래된 변화를 합친 값';
export function foldOpenness(store: PeopleStore, chat: Chat, keepMsgs = FOLD_KEEP_MSGS): number {
  const cut = (Array.isArray(chat.message) ? chat.message.length : 0) - keepMsgs;
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
    store.log.push({ id: changeId(who, 'openness', '#0', 0, `fold${value}`), anchor: '#0', seq: 0, src: 'seed', who, kind: 'openness', init: value, reason: OPENNESS_FOLD_REASON });
    dropped += gone.size - 1;
  }
  return dropped;
}
