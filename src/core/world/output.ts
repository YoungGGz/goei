// 채팅 변수와 상황판 상태 사이의 다리. 상태는 응답별 결과($goei_turns, core/world/turns.ts)에 두고 살아 있는 마지막 응답의 것을 읽는다.
// $goei_world 는 마지막으로 쓴 상황판(응답별 결과가 아직 없는 채팅의 값), 로어북이 읽는 $an_report 등은 상태에서 매번 다시 만든다.
import { buildClosures, dropTurnRows, journalSettings, readJournal, readReports, recordVars } from '../journal';
import { messageKey } from '../people/store';
import { findFaction } from '../scenarios';
import type { Chat, LoreEntry, ScriptState } from '../types';
import { parseCatalog, type Catalog } from './catalog';
import { worldSettings } from '../settings';
import { applyOutput, bootstrap, cancelMission, parseWorld, reports, serializeWorld, type Rng, type WorldSettings, type WorldState } from './engine';
import { cleanOutput, hasWorldTags } from './tags';
import { splitThoughts } from '../thoughts';
import { guideTxt } from '../guides';
import { hasSceneCard, isUnsent, readScene } from '../dispatch';
import { TURNS_KEY, liveSnap, putTurn, readTurns, serializeTurns, type TurnSnap, type TurnStore } from './turns';

export { TURNS_KEY } from './turns';

export const WORLD_KEY = '$goei_world';

/** 채팅 변수에서 읽은 지금 소속 (응답별 결과가 아직 없는 채팅의 바탕) */
function stateSnap(state: ScriptState): TurnSnap {
  return { k: '', w: String(state[WORLD_KEY] ?? ''), f: String(state['$st_faction'] ?? ''), p: String(state['$st_pick'] ?? ''), a: String(state['$ib_affiliation'] ?? '') };
}

export function worldOn(chat: Chat): boolean {
  return chat.scriptstate?.['$st_anomaly_on'] === '1';
}

/**
 * 지금 상황판: 채팅에 살아 있는 마지막 응답의 결과 (core/world/turns.ts). 응답을 지우거나 ◀▶ 로 바꾸면 그 순간부터 남은 응답의 것이 읽힌다.
 * 응답별 결과가 아직 없는 채팅(막 시작했거나 옛 채팅)은 `$goei_world`.
 */
export function readWorld(chat: Chat): WorldState {
  const snap = liveSnap(readTurns(chat.scriptstate?.[TURNS_KEY]), chat);
  return parseWorld(snap ? snap.w : chat.scriptstate?.[WORLD_KEY]);
}

/**
 * 손으로 상황판을 바꾼 뒤 저장할 변수 (임무 요청·요청 취소·상황 종료). w = 바꾼 지금 상황판.
 * 지금 읽히는 응답의 결과를 w 로 바꾸고, 나머지 응답별 결과·바탕에는 other 로 같은 조작을 옮긴다 —
 * 그 응답을 지우거나 다시 굴려 다른 결과가 읽혀도 손으로 한 일은 남는다 (끝낸 상황이 되살아나지 않고, 걸어 둔 요청이 사라지지 않는다).
 */
export function manualWorldVars(chat: Chat, w: WorldState, c: Catalog, s: WorldSettings, faction: string, other: (p: WorldState) => void): ScriptState {
  const state = chat.scriptstate ?? {};
  const store = readTurns(state[TURNS_KEY]);
  const cur = liveSnap(store, chat);
  const text = serializeWorld(w);
  const move = (snap: TurnSnap): TurnSnap => {
    if (snap === cur) return { ...snap, w: text };
    const p = parseWorld(snap.w);
    try {
      other(p);
    } catch {
      return snap;
    }
    return { ...snap, w: serializeWorld(p) };
  };
  const next: TurnStore = store
    ? { v: 1, base: store.base ? move(store.base) : cur ? null : { ...stateSnap(state), w: text }, list: store.list.map(move), last: store.last }
    : { v: 1, base: { ...stateSnap(state), w: text }, list: [], last: '' };
  return { ...worldVars(w, c, s, faction), [TURNS_KEY]: serializeTurns(next) };
}

/** 걸어 둔 임무 요청(대기·안내)을 다른 응답별 결과에 그대로 옮기는 조작 (manualWorldVars 의 other) */
export const copyPending = (w: WorldState) => (p: WorldState): void => {
  p.pending = { ...w.pending };
  p.notice = w.notice;
};

export function worldVars(w: WorldState, c: Catalog, s: WorldSettings, faction: string): ScriptState {
  const r = reports(w, c, s, faction);
  return {
    ...c.factionVars,
    [WORLD_KEY]: serializeWorld(w),
    $st_anomaly_on: '1',
    $an_report: r.an,
    $in_report: r.in,
    $ms_report: r.ms,
    $ag_report: r.ag,
  };
}

/** 안 보낸 임무 요청 카드를 취소할 때: 걸어 둔 커스텀 임무(an·ms·in)를 함께 거둔 상황판 변수. 걸린 게 없으면 null (전수검사 11-13) */
export function dropPendingVars(chat: Chat, lore: LoreEntry[] | undefined): ScriptState | null {
  const w = readWorld(chat);
  if (!w || !(['an', 'ms', 'in'] as const).some((k) => w.pending?.[k])) return null;
  for (const k of ['an', 'ms', 'in'] as const) cancelMission(w, k);
  try {
    return manualWorldVars(chat, w, parseCatalog(lore), worldSettings(lore, chat.scriptstate), String(chat.scriptstate?.$st_faction ?? ''), copyPending(w));
  } catch {
    return null; // 카탈로그를 못 읽으면 취소(메시지 지우기)만 한다
  }
}

/**
 * 안 보낸 마지막 유저 메시지(자동 전송이 막힌 임무 요청 카드·직접 입력)를 물린 채팅. 임무 요청 카드면 걸어 둔 커스텀 임무도 거둔다 (dropPendingVars).
 * 채팅 속 카드의 「취소」와 임무 창의 「요청 취소」가 같이 쓴다. target 을 주면 그 목표의 임무 요청 카드일 때만 물린다. 물릴 것이 없으면 null.
 * 창의 「요청 취소」(target)는 보냈지만 답 없이 끝난 카드(채팅 끝에 답 없이 남은 카드)도 물린다 — 남기면 다음 글에 취소한 임무 지시가 같이 갔다.
 * 응답을 기다리는 중에는 부르는 쪽이 부르지 않는다 (ui/field.ts cancelRequest).
 */
export function withdrawUnsent(chat: Chat, lore: LoreEntry[] | undefined, target?: string): Chat | null {
  const msgs = chat.message ?? [];
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'user' || typeof last.data !== 'string') return null;
  if (target === undefined && !isUnsent(last.data)) return null;
  const card = hasSceneCard(last.data);
  if (target !== undefined && (!card || readScene(last.data)?.target !== target)) return null;
  const next: Chat = { ...chat, message: msgs.slice(0, -1) };
  // 임무 요청 카드를 물리면 걸어 둔 커스텀 임무도 거둔다 (안 그러면 다음 요청에 NEW 지시가 남았다) (전수검사 11-13)
  const vars = card && worldOn(chat) ? dropPendingVars(chat, lore) : null;
  if (vars) next.scriptstate = { ...(chat.scriptstate ?? {}), ...vars };
  return next;
}

/** START 때 넣을 상황판 변수 (첫 발생 추첨 포함) */
export function startWorldVars(c: Catalog, s: WorldSettings, faction: string, rng: Rng, player = ''): ScriptState {
  // 응답별 결과도 비운다: 새로 시작한 상황판이 곧 지금 상황판 (옛 응답의 결과로 읽히지 않게)
  return { ...worldVars(bootstrap(c, s, rng, player), c, s, faction), [TURNS_KEY]: '' };
}

/**
 * 응답이 지워졌거나 바뀐 뒤의 요청: 지금 읽히는 응답의 결과로 만든 상황판·소속 변수 (요청 조립용, 저장하지 않는다).
 * 마지막으로 반영한 응답이 그대로 읽히면(되돌아간 것이 없으면) null. 소속($st_faction 등)은 채팅 변수에 옛 응답의 값이 남아 있어 여기서 같이 돌려준다.
 * 새 응답이 붙으면 processOutput 이 같은 결과에서 반영한다.
 */
export function rerollRequestVars(chat: Chat, c: Catalog, s: WorldSettings): ScriptState | null {
  if (!worldOn(chat)) return null;
  const store = readTurns(chat.scriptstate?.[TURNS_KEY]);
  const cur = liveSnap(store, chat);
  if (!store || !cur || cur.k === store.last) return null;
  return {
    ...worldVars(parseWorld(cur.w), c, s, cur.f),
    $st_faction: cur.f,
    $st_pick: cur.p,
    $ib_affiliation: cur.a,
  };
}

/**
 * 본편 요청을 만들 때 쓸 상황판·소속 변수 (요청 조립용, 저장하지 않는다). 다시 굴린 요청이면 rerollRequestVars, 아니면 지금 상태에서 다시 만든다.
 * 브리핑($ag_report·$an_report 등)을 늘 지금 카드 로어북·설정으로 만들어, 명부·세계 설정을 고친 직후의 요청에도 바로 맞게 간다
 * (저장된 브리핑은 다음 응답이 붙어야 새로 만들어졌다). 상황판이 꺼져 있으면 null.
 */
export function requestWorldVars(chat: Chat, c: Catalog, s: WorldSettings): ScriptState | null {
  if (!worldOn(chat)) return null;
  return rerollRequestVars(chat, c, s) ?? worldVars(readWorld(chat), c, s, String(chat.scriptstate?.['$st_faction'] ?? ''));
}

/** 짧은 지문: 같은 응답을 두 번 처리하지 않기 위해 */
function fingerprint(index: number, text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${index}:${text.length}:${(h >>> 0).toString(36)}`;
}

/**
 * 모델 응답이 채팅에 들어간 뒤 한 번: 태그를 상태에 반영하고, 저장 본문에서 태그를 지우고,
 * 다음 턴 브리핑을 만든다. 바꿀 것이 없으면 null.
 * raw: 리스너가 받은 그 응답 본문. 최신 채팅에서 같은 본문을 찾아 고친다.
 */
export function processOutput(chat: Chat, messageIndex: number, raw: string, c: Catalog, s: WorldSettings, rng: Rng): Chat | null {
  if (!worldOn(chat)) return null;
  const messages = chat.message ?? [];
  let index = messageIndex;
  if (messages[index]?.data !== raw) {
    index = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'char' && messages[i].data === raw) {
        index = i;
        break;
      }
    }
  }
  const msg = messages[index];
  if (!msg || msg.role !== 'char') return null;

  const state = chat.scriptstate ?? {};
  // 생각 모델의 속생각(<Thoughts>) 안 태그 초안은 읽지 않는다. 블록은 저장 본문 앞에 그대로 둔다 (전수검사 11-13)
  const th = splitThoughts(raw);
  const clean = th.head + cleanOutput(th.body);
  const store = readTurns(state[TURNS_KEY]);
  const key = messageKey(msg, index);
  const fp = fingerprint(index, clean);
  // 이미 처리한 응답에 리스너가 다시 불린 경우 (태그도 없고, 이 응답의 결과가 같은 지문으로 적혀 있음)
  if (!hasWorldTags(th.body) && store?.list.some((x) => x.k === key && x.fp === fp)) return null;

  // 이 응답을 뺀 채팅에서 지금 읽히는 결과에서 시작한다. 다시 굴렸거나 앞 응답을 지웠으면 그 결과는 남은 응답의 것이라, 버린 응답이 한 일은 저절로 빠진다
  const cur = liveSnap(store, chat, index);
  const before = cur ?? stateSnap(state);
  // 마지막으로 반영한 응답이 아닌 결과에서 시작하면(되돌아감) 소속도 그 결과의 것으로 (채팅 변수에는 버린 응답의 소속이 남아 있다)
  const rewound = !!store && !!cur && cur.k !== store.last;
  const faction = rewound ? before.f : String(state['$st_faction'] ?? '');
  const base = parseWorld(before.w);
  const result = applyOutput(base, c, s, faction, th.body, rng);
  const now = result.faction ?? faction;
  // 이번 응답에서 활성이 된 항목에 시작 메시지 열쇠를 적는다 (엔진은 메시지 번호를 모른다). 옛 저장의 진행 중 항목은 비워 두고 since 로 기간을 잡는다 (journal/mine.ts)
  markStart(base, result.world, key);
  const vars: ScriptState = { ...worldVars(result.world, c, s, now) };
  if (rewound && !result.faction) {
    vars.$st_faction = before.f;
    vars.$st_pick = before.p;
    vars.$ib_affiliation = before.a;
  }
  if (result.faction) {
    vars.$st_faction = result.faction;
    vars.$st_pick = result.faction;
    vars.$ib_affiliation = c.affiliations?.[result.faction] ?? findFaction(result.faction)?.affiliation ?? guideTxt('Main', 'WORLD.AFFILIATION_UNKNOWN');
  }
  const message = messages.slice();
  message[index] = { ...msg, data: clean };
  // 이 응답의 결과를 적는다. 바탕이 없던 채팅은 이 응답 전 상태가 바탕
  const snap: TurnSnap = {
    k: key,
    w: String(vars[WORLD_KEY]),
    f: String(vars.$st_faction ?? (rewound ? before.f : state['$st_faction'] ?? '')),
    p: String(vars.$st_pick ?? (rewound ? before.p : state['$st_pick'] ?? '')),
    a: String(vars.$ib_affiliation ?? (rewound ? before.a : state['$ib_affiliation'] ?? '')),
    fp,
  };
  const put = putTurn(store ?? { v: 1, base: before, list: [], last: '' }, snap, { ...chat, message });
  vars[TURNS_KEY] = serializeTurns(put.store);
  const next: Chat = { ...chat, message, scriptstate: { ...state, ...vars } };
  // 일지·보고서 (core/journal): 이번 응답의 종료를 적는다. 사라진 응답이 만든 줄은 읽을 때 가려지고 (journal/store.ts liveJournal),
  // 그 응답의 결과가 상한에서 밀려 다시 돌아올 수 없게 되면 여기서 지운다
  const closed = result.world.closed ?? [];
  // 같은 응답을 다시 반영하면(같은 열쇠) 그 응답이 앞서 만든 줄도 먼저 지운다
  const again = !!store?.list.some((x) => x.k === key);
  if (again) put.dropped.push(key);
  if (put.dropped.length || closed.length) {
    let journal = readJournal(state);
    let rec = readReports(state);
    let changed = false;
    if (put.dropped.length) {
      const r = dropTurnRows(journal, rec, put.dropped);
      journal = r.journal;
      rec = r.reports;
      changed = r.changed;
    }
    if (closed.length) {
      const built = buildClosures({ chat: { ...next, scriptstate: { ...next.scriptstate, ...recordVars(journal, rec) } }, index, world: result.world, closed, catalog: c, faction: now, settings: journalSettings(state) });
      if (built.rows.length) {
        journal = built.journal;
        rec = built.reports;
        changed = true;
      }
    }
    if (changed) Object.assign(next.scriptstate!, recordVars(journal, rec));
  }
  return next;
}

/** 이번 응답에서 새로 활성·진행·출현이 된 항목에 startKey 를 적는다 (전에도 활성이던 항목은 그대로) */
function markStart(before: WorldState, after: WorldState, key: string) {
  const id = (kind: string, e: { loc: string; name: string; born: number | null }) => `${kind}|${e.loc}|${e.name}|${e.born ?? ''}`;
  const was = new Set<string>();
  for (const e of before.an) if (e.state === '활성') was.add(id('an', e));
  for (const e of before.inc) if (e.state === '진행') was.add(id('in', e));
  for (const e of before.ms) if (e.state === '출현') was.add(id('ms', e));
  const mark = (kind: string, e: { loc: string; name: string; born: number | null; startKey?: string }, active: boolean) => {
    if (active && !e.startKey && !was.has(id(kind, e))) e.startKey = key;
  };
  for (const e of after.an) mark('an', e, e.state === '활성');
  for (const e of after.inc) mark('in', e, e.state === '진행');
  for (const e of after.ms) mark('ms', e, e.state === '출현');
}

