// 채팅 변수와 상황판 상태 사이의 다리. 상태는 채팅 변수 $goei_world(JSON) 하나에 두고,
// 로어북이 읽는 $an_report 등은 상태에서 매번 다시 만든다.
import { buildClosures, journalSettings, readJournal, readReports, recordVars, rewindClosures } from '../journal';
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

export const WORLD_KEY = '$goei_world';
const LAST_KEY = '$goei_last';
/** 마지막으로 반영한 응답 직전의 상태. 같은 자리에 다른 응답이 오면(리롤) 여기서 다시 시작한다 */
const PREV_KEY = '$goei_prev';

interface PrevState {
  i: number;
  world: string;
  faction: string;
  pick: string;
  aff: string;
  /** 그 자리의 응답이 만든 일지 줄 id (리롤 되감기 대상. 없으면 옛 저장 → 번호로 되감는다) */
  made?: string[];
  /** 그 응답 바로 앞 메시지의 열쇠(messageKey). 같은 번호라도 앞 메시지가 다르면(앞 메시지를 지운 뒤 새 턴) 리롤이 아니다 */
  pk?: string;
  /** 반영한 그 응답의 열쇠(messageKey). 이 응답이 채팅에서 지워졌으면 다음 응답은 이 응답 전 상태에서 반영한다 (지운 응답이 만든 것은 되돌아간다) */
  k?: string;
}

function readPrev(raw: unknown): PrevState | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const p = JSON.parse(raw) as PrevState;
    return typeof p?.i === 'number' && typeof p.world === 'string' ? p : null;
  } catch {
    return null;
  }
}

export function worldOn(chat: Chat): boolean {
  return chat.scriptstate?.['$st_anomaly_on'] === '1';
}

export function readWorld(chat: Chat): WorldState {
  return parseWorld(chat.scriptstate?.[WORLD_KEY]);
}

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
    return worldVars(w, parseCatalog(lore), worldSettings(lore, chat.scriptstate), String(chat.scriptstate?.$st_faction ?? ''));
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
  return worldVars(bootstrap(c, s, rng, player), c, s, faction);
}

/** index 자리 바로 앞 메시지의 열쇠 (리롤 판정용) */
function prevKey(messages: Chat['message'], index: number): string {
  const m = messages?.[index - 1];
  return index > 0 && m ? messageKey(m, index - 1) : '';
}

/**
 * index 자리에 오는 응답이 마지막으로 반영한 응답을 되돌려야 하는 자리면 그 응답이 반영되기 전 상태, 아니면 null.
 * - 리롤: 같은 자리의 이전 응답을 갈아 끼움. 「같은 자리」 = 같은 번호 + 바로 앞 메시지가 같은 것(열쇠).
 * - 지움: 마지막으로 반영한 응답이 채팅에 없다 (지우고 새로 보냄). 소지품·가계부·인물 기록처럼 지운 응답이 만든 것도 되돌아간다.
 *   앞 메시지만 지우고 그 응답은 남았으면 되돌리지 않는다.
 * 응답 처리(processOutput)와 다시 굴린 요청 조립(rerollRequestVars)이 같이 쓴다.
 */
function rerollBase(chat: Chat, index: number): PrevState | null {
  const prev = readPrev(chat.scriptstate?.[PREV_KEY]);
  if (!prev) return null;
  const messages = chat.message ?? [];
  if (prev.i === index && (prev.pk === undefined || prev.pk === prevKey(messages, index))) return prev;
  if (prev.k && !messages.some((m, i) => i !== index && messageKey(m, i) === prev.k)) return prev;
  return null;
}

/**
 * 다시 굴린 요청: 버린 응답이 상황판·소속에 반영한 것을 되감은 채팅 변수 (요청 조립용, 저장하지 않는다).
 * 버린 응답은 이미 채팅에서 빠졌고 새 응답은 채팅 끝 다음 자리에 온다. 그 자리가 리롤이 아니면 null.
 * 새 응답이 붙으면 processOutput 이 같은 기준 상태에서 다시 반영한다.
 */
export function rerollRequestVars(chat: Chat, c: Catalog, s: WorldSettings): ScriptState | null {
  if (!worldOn(chat)) return null;
  const before = rerollBase(chat, (chat.message ?? []).length);
  if (!before) return null;
  return {
    ...worldVars(parseWorld(before.world), c, s, before.faction),
    $st_faction: before.faction,
    $st_pick: before.pick,
    $ib_affiliation: before.aff,
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
  // 이미 처리한 응답에 리스너가 다시 불린 경우 (태그도 없고 지문도 같음)
  if (!hasWorldTags(th.body) && state[LAST_KEY] === fingerprint(index, clean)) return null;

  // 리롤·다시 생성: 같은 자리의 이전 응답이 반영되기 전 상태로 돌아가서 이번 응답만 반영한다.
  // 「같은 자리」 = 같은 번호 + 바로 앞 메시지가 같은 것(열쇠). Risu 는 리롤 때 새 chatId 를 주므로 응답 자체는 비교할 수 없고,
  // 앞 메시지를 지운 뒤 새 턴이 같은 번호에 오면 앞 메시지(새 유저 메시지)의 열쇠가 다르다 — 그때 옛 상태로 돌아가거나 옛 일지를 되감으면 안 된다 (2026-10-29)
  const prev = rerollBase(chat, index);
  const pk = prevKey(messages, index);
  const reroll = prev !== null;
  const before: PrevState = prev
    ? prev
    : {
        i: index,
        world: String(state[WORLD_KEY] ?? ''),
        faction: String(state['$st_faction'] ?? ''),
        pick: String(state['$st_pick'] ?? ''),
        aff: String(state['$ib_affiliation'] ?? ''),
        pk,
      };
  const faction = before.faction;
  const base = parseWorld(before.world);
  const result = applyOutput(base, c, s, faction, th.body, rng);
  const now = result.faction ?? faction;
  // 이번 응답에서 활성이 된 항목에 시작 메시지 열쇠를 적는다 (엔진은 메시지 번호를 모른다). 옛 저장의 진행 중 항목은 비워 두고 since 로 기간을 잡는다 (journal/mine.ts)
  markStart(base, result.world, messageKey(msg, index));
  const vars: ScriptState = {
    ...worldVars(result.world, c, s, now),
    [LAST_KEY]: fingerprint(index, clean),
  };
  if (reroll && !result.faction) {
    vars.$st_faction = before.faction;
    vars.$st_pick = before.pick;
    vars.$ib_affiliation = before.aff;
  }
  if (result.faction) {
    vars.$st_faction = result.faction;
    vars.$st_pick = result.faction;
    vars.$ib_affiliation = c.affiliations?.[result.faction] ?? findFaction(result.faction)?.affiliation ?? guideTxt('Main', 'WORLD.AFFILIATION_UNKNOWN');
  }
  const message = messages.slice();
  message[index] = { ...msg, data: clean };
  const next: Chat = { ...chat, message, scriptstate: { ...state, ...vars } };
  // 일지·보고서 (core/journal): 리롤이면 이 자리의 이전 응답이 만든 자동 종료 기록을 먼저 되감고, 이번 응답의 종료를 새로 적는다
  const closed = result.world.closed ?? [];
  let made: string[] = [];
  if (reroll || closed.length) {
    let journal = readJournal(state);
    let rec = readReports(state);
    let changed = false;
    if (reroll) {
      const r = rewindClosures(journal, rec, before.made ?? index);
      journal = r.journal;
      rec = r.reports;
      changed = r.changed;
    }
    if (closed.length) {
      const built = buildClosures({ chat: { ...next, scriptstate: { ...next.scriptstate, ...recordVars(journal, rec) } }, index, world: result.world, closed, catalog: c, faction: now, settings: journalSettings(state) });
      if (built.rows.length) {
        journal = built.journal;
        rec = built.reports;
        made = built.rows.map((r) => r.id);
        changed = true;
      }
    }
    if (changed) Object.assign(next.scriptstate!, recordVars(journal, rec));
  }
  // 리롤 기준 상태에 이번 응답이 만든 일지 줄 id 를 적는다 (다음 리롤이 바로 이 줄들만 되감게). 자리·앞 메시지·응답 열쇠는 이번 응답의 것
  next.scriptstate![PREV_KEY] = JSON.stringify({ ...before, i: index, pk, k: messageKey(msg, index), made });
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

/**
 * 상황판에서 손으로 바꾼 것(사건 종료 등)을 리롤 기준 상태에도 똑같이 반영한다.
 * 안 그러면 그 응답을 리롤할 때 손으로 바꾼 것이 사라진다. 바꿀 기준 상태가 없으면 빈 값.
 * change 가 기준 상태에서 안 됐다고 하면(참 값을 돌려주거나 던짐) 그 대상은 마지막 응답이 만든 것이다 — 손으로 바꾸며 생긴 일지 줄(made)을
 * 그 응답이 만든 줄로 적어, 그 응답을 다시 굴리거나 지우면 대상과 함께 되돌아가게 한다 (상황판과 일지가 서로 다른 말을 하지 않게).
 */
export function prevWorldVars(state: ScriptState | undefined, change: (w: WorldState) => unknown, made: string[] = []): ScriptState {
  const prev = readPrev(state?.[PREV_KEY]);
  if (!prev) return {};
  const w = parseWorld(prev.world);
  let missed = false;
  try {
    missed = !!change(w);
  } catch {
    missed = true;
  }
  if (missed) return made.length ? { [PREV_KEY]: JSON.stringify({ ...prev, made: [...(prev.made ?? []), ...made] }) } : {};
  return { [PREV_KEY]: JSON.stringify({ ...prev, world: serializeWorld(w) }) };
}
