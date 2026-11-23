// 인물 기록 저장·읽기와 「살아 있음」 판정. 저장은 채팅 최상위 키 하나, 값은 매번 다시 계산한다.
// 다시 굴리기·삭제·편집: 항목은 기준 메시지가 채팅에 있고(story 는 인용도 그 메시지에 남아 있어야) 살아 있다.
// 사라진 항목은 지우지 않는다 (화면에서 회색, 되살리기 가능).
import type { Chat, ChatMessage } from '../types';
import { messageText } from '../refs';
import { PP_DEFAULTS, ppNum } from './settings';
import { findStatusTags } from '../world/status';
import { AXES, PEOPLE_KEY, SLOTS, SLOT_META, DOC_TYPES, REGISTERS, DEFAULT_AXES, EXPRESS_TO_AXIS, emptyStore, expressOf, type Candidate, type Change, type Doc, type Entry, type LastRun, type Observation, type PeopleStore, type Person, type Register, type RenameUndo, type SexualProfile, type SexualRecord, type SlotId, SEXUAL_CHARS } from './types';

/** 채팅 마지막 메시지 chatId (없으면 #순번): 기록의 기준 자리 */
export function anchorOf(chat: Chat): string {
  const msgs = Array.isArray(chat.message) ? chat.message as { chatId?: string }[] : [];
  const last = msgs[msgs.length - 1];
  return last?.chatId ? String(last.chatId) : `#${msgs.length}`;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const isEntry = (e: unknown): e is Entry => !!e && typeof (e as Entry).id === 'string' && typeof (e as Entry).text === 'string' && typeof (e as Entry).anchor === 'string';

/** 간단한 해시 (FNV-1a 32bit, 36진수) — 항목 id·읽음 표시용 */
export function hash(text: string): string {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** 저장된 기록을 너그럽게 읽는다 (깨진 항목은 버림) */
export function peopleStore(chat: Chat): PeopleStore {
  const raw = chat[PEOPLE_KEY] as Partial<PeopleStore> | undefined;
  const out = emptyStore();
  if (!raw || typeof raw !== 'object') return out;
  const patternsCap = ppNum(chat.scriptstate, 'patterns_cap');
  for (const [name, p] of Object.entries(raw.people ?? {})) {
    if (!p || typeof p !== 'object' || typeof p.name !== 'string') continue;
    const slots: Person['slots'] = {};
    for (const s of SLOTS) {
      const list = (p.slots as Record<string, unknown> | undefined)?.[s];
      if (Array.isArray(list)) slots[s] = list.filter(isEntry);
    }
    out.people[name] = {
      name: p.name,
      faction: str(p.faction),
      seeded: p.seeded && typeof p.seeded === 'object' ? p.seeded : { from: 'none', at: '' },
      slots,
      affinity: { base: Number(p.affinity?.base) || 0 },
      address: { toUser: str(p.address?.toUser), register: REGISTERS.includes(p.address?.register as Register) ? (p.address!.register as Register) : '존댓말', ...(p.address?.pin ? { pin: true } : {}) },
      express: ([0, 1, 2, 3] as const).includes(p.express as 0) ? (p.express as 0 | 1 | 2 | 3) : 1,
      aliases: Array.isArray(p.aliases) ? p.aliases.filter((a): a is string => typeof a === 'string') : [],
      axes: DEFAULT_AXES(),
      axesFrom: p.axesFrom === 'model' || p.axesFrom === 'manual' ? p.axesFrom : 'default',
      patterns: Array.isArray(p.patterns) ? p.patterns.filter((t): t is string => typeof t === 'string').slice(-patternsCap) : [],
      candidates: readCandidates(p.candidates),
      ...(Number.isInteger(p.reviewTurn) ? { reviewTurn: p.reviewTurn as number } : {}),
      ...(p.sexual && typeof p.sexual === 'object' ? { sexual: readSexual(p.sexual as unknown as Record<string, unknown>) } : {}),
      ...(p.provisional === true ? { provisional: true as const } : {}),
      ...(typeof p.origin === 'string' && p.origin ? { origin: p.origin } : {}),
    };
    const me = out.people[name];
    // 축: 저장된 것이 있으면 읽고, 없으면 express 에서 (감정 표출성만). express 는 늘 축에서 다시 계산
    if (p.axes && typeof p.axes === 'object') {
      for (const a of AXES) if ((p.axes as Record<string, unknown>)[a] !== undefined) me.axes[a] = Math.max(0, Math.min(100, Math.round(Number((p.axes as Record<string, unknown>)[a]) || 0)));
    } else me.axes.emotionalExpressiveness = EXPRESS_TO_AXIS[me.express];
    me.express = expressOf(me.axes);
  }
  for (const [k, d] of Object.entries(raw.docs ?? {})) {
    if (!d || !DOC_TYPES.includes(d.type) || typeof d.key !== 'string') continue;
    out.docs[k] = { type: d.type, key: d.key, entries: Array.isArray(d.entries) ? d.entries.filter(isEntry) : [] };
  }
  for (const [k, f] of Object.entries(raw.factions ?? {})) {
    if (!f || typeof f !== 'object' || typeof f.code !== 'string') continue;
    out.factions[k] = { code: f.code, name: str(f.name), seeded: f.seeded && typeof f.seeded === 'object' ? f.seeded : { at: '' } };
  }
  out.log = Array.isArray(raw.log) ? raw.log.filter((c): c is Change => !!c && typeof c.id === 'string' && typeof c.anchor === 'string' && typeof c.who === 'string' && typeof c.kind === 'string') : [];
  out.folded = raw.folded && typeof raw.folded === 'object' ? Object.fromEntries(Object.entries(raw.folded).filter(([, v]) => typeof v === 'number')) as Record<string, number> : {};
  out.read = raw.read && typeof raw.read === 'object' ? Object.fromEntries(Object.entries(raw.read).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
  out.pending = raw.pending && typeof raw.pending === 'object' ? (raw.pending as PeopleStore['pending']) : {};
  if (raw.lastRun && typeof raw.lastRun === 'object' && Array.isArray(raw.lastRun.entries)) out.lastRun = raw.lastRun as LastRun;
  out.ignored = Array.isArray(raw.ignored) ? raw.ignored.filter((n): n is string => typeof n === 'string') : [];
  if (raw.identity && typeof raw.identity === 'object') out.identity = raw.identity;
  if (Array.isArray(raw.migrated)) out.migrated = raw.migrated.filter((m): m is string => typeof m === 'string');
  if (Array.isArray(raw.renames)) {
    const renames = raw.renames.filter((r): r is RenameUndo => !!r && typeof r.anchor === 'string' && typeof r.from === 'string' && typeof r.to === 'string' && !!r.src && typeof r.src === 'object');
    if (renames.length) out.renames = renames;
  }
  if (raw.scene && typeof raw.scene === 'object') {
    const scene = Object.fromEntries(Object.entries(raw.scene).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).filter((n): n is string => typeof n === 'string')]));
    if (Object.keys(scene).length) out.scene = scene;
  }
  return out;
}

function readSexual(raw: Record<string, unknown>): SexualProfile {
  const rec = (v: unknown): SexualRecord => { const r = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}; return { text: plain(r.text, SEXUAL_CHARS), at: str(r.at), ...(r.manual ? { manual: true } : {}) }; };
  return { desire: rec(raw.desire), paraphilia: rec(raw.paraphilia), desireOn: raw.desireOn !== false, paraphiliaOn: raw.paraphiliaOn !== false, explicit: raw.explicit === true ? true : raw.explicit === false ? false : null };
}

function readCandidates(raw: unknown): Record<string, Candidate> {
  const out: Record<string, Candidate> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, c] of Object.entries(raw as Record<string, Partial<Candidate>>)) {
    if (!c || typeof c !== 'object' || typeof c.pattern !== 'string' || typeof c.axis !== 'string') continue;
    const evidence = Array.isArray(c.evidence) ? (c.evidence as Partial<Observation>[]).filter((e) => e && typeof e.id === 'string' && typeof e.anchor === 'string').map((e) => ({ id: e.id!, anchor: e.anchor!, seq: Number(e.seq) || 0, quote: str(e.quote), reason: str(e.reason), strength: Number(e.strength) || 0, confidence: Number(e.confidence) || 0, ...(e.void ? { void: true } : {}) })) : [];
    out[id] = { id, axis: c.axis as Candidate['axis'], direction: (['up', 'down', 'new', 'weaken', 'replace'] as const).includes(c.direction as 'up') ? (c.direction as Candidate['direction']) : 'up', pattern: c.pattern, evidence, status: (['collecting', 'approved', 'rejected', 'reverted'] as const).includes(c.status as 'collecting') ? (c.status as Candidate['status']) : 'collecting', at: str(c.at), ...(c.applied && typeof c.applied === 'object' ? { applied: c.applied } : {}) };
  }
  return out;
}

export const withPeople = (chat: Chat, store: PeopleStore): Chat => ({ ...chat, [PEOPLE_KEY]: store });

// ── 기준 메시지 ──

const msgs = (chat: Chat): ChatMessage[] => (Array.isArray(chat.message) ? chat.message : []);

/** 기준 → 메시지 위치. chatId 가 없는 메시지는 '#메시지수' 로 적혔으니 그 수만큼 메시지가 있으면 산 것. '#0' 은 첫 응답 전 = 늘 살아 있음 */
export function anchorPositions(chat: Chat): Map<string, number> {
  const at = new Map<string, number>();
  const list = msgs(chat);
  at.set('#0', -1);
  list.forEach((m, i) => {
    const id = (m as { chatId?: unknown }).chatId;
    if (typeof id === 'string' && id) at.set(id, i);
    at.set(`#${i + 1}`, i);
  });
  return at;
}

/** 인용 검사용 정규화: 공백·따옴표·말줄임표 차이를 무시 */
export const norm = (s: string) => String(s ?? '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();

/** 갱신기에 보내는 글 (updater.ts cleanSpan 이 쓴다): 상태창·생각·주석·그림 태그·상점 표식을 지운 것.
 *  모델은 이 글을 보고 인용하므로, 태그를 사이에 둔 인용은 지우기 전 글에는 없고 여기에만 있다 (재검토 11-14 ①-9) */
export function sentText(raw: string): string {
  let t = String(raw ?? '');
  for (const tag of findStatusTags(t)) t = t.replace(tag.raw, '');
  return messageText(t)
    .replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img\s*=[^>]*>/g, '')
    .replace(/\[\s*shop\s*[:：][^\]]*\]/giu, '');
}

export interface Liveness {
  at: Map<string, number>;
  texts: Map<number, string>;
  /** 지운 글(sentText)의 정규화. 지우기 전 글과 다를 때만 담는다 */
  sent?: Map<number, string>;
}
export function liveness(chat: Chat): Liveness {
  const at = anchorPositions(chat);
  const texts = new Map<number, string>();
  const sent = new Map<number, string>();
  msgs(chat).forEach((m, i) => {
    const t = norm(messageText(str(m.data)));
    texts.set(i, t);
    const s = norm(sentText(str(m.data)));
    if (s !== t) sent.set(i, s);
  });
  return { at, texts, sent };
}

/** 항목·변경이 살아 있나: 기준 메시지가 있고, story 인용은 그 메시지에 아직 있어야 */
export function isAlive(x: { anchor: string; quote?: string; src?: string; void?: boolean; folded?: boolean }, live: Liveness): boolean {
  if (x.void || x.folded) return false;
  const pos = live.at.get(x.anchor);
  if (pos === undefined) return false;
  if (x.src === 'story' && x.quote) {
    // 인용은 지우기 전 글이나 갱신기에 보낸(지운) 글 중 하나에 있으면 된다 (재검토 11-14 ①-9)
    const q = norm(x.quote);
    if (!live.texts.get(pos)?.includes(q) && !live.sent?.get(pos)?.includes(q)) return false;
  }
  return true;
}

/** 칸의 살아 있는 항목. 대체 항목이 죽으면 그것이 대체했던 이전 항목이 되살아난다 */
export function liveEntries(list: Entry[] | undefined, live: Liveness): Entry[] {
  if (!list?.length) return [];
  const alive = new Set(list.filter((e) => isAlive(e, live)).map((e) => e.id));
  const replaced = new Set(list.filter((e) => alive.has(e.id)).flatMap((e) => [...(e.replaces ? [e.replaces] : []), ...(e.from ?? [])]));
  return list.filter((e) => alive.has(e.id) && !replaced.has(e.id));
}

export type EntryState = 'alive' | 'replaced' | 'folded' | 'void' | 'gone';
/** 항목이 왜 안 살아 있나 (화면용): 새 항목이 대체 / 요약에 합쳐짐 / 사용자가 취소 / 근거 메시지가 사라지거나 고쳐짐 */
export function entryStates(list: Entry[] | undefined, live: Liveness): Map<string, EntryState> {
  const out = new Map<string, EntryState>();
  if (!list?.length) return out;
  const alive = new Set(liveEntries(list, live).map((e) => e.id));
  const replaced = new Set(list.filter((e) => isAlive(e, live)).flatMap((e) => [...(e.replaces ? [e.replaces] : []), ...(e.from ?? [])]));
  for (const e of list) out.set(e.id, alive.has(e.id) ? 'alive' : e.void ? 'void' : e.folded ? 'folded' : replaced.has(e.id) ? 'replaced' : 'gone');
  return out;
}

/** 살아 있는 변경 기록 (기준 메시지 순서 → seq 순서) */
export function liveChanges(store: PeopleStore, live: Liveness): Change[] {
  return store.log
    .filter((c) => isAlive(c, live))
    .map((c) => ({ c, pos: live.at.get(c.anchor) ?? -1 }))
    .sort((a, b) => a.pos - b.pos || a.c.seq - b.c.seq)
    .map((x) => x.c);
}

// ── 쓰기 ──

export const entryId = (who: string, slot: string, anchor: string, seq: number, text: string) => `e${hash(`${who}|${slot}|${anchor}|${seq}|${text}`)}`;
export const changeId = (who: string, kind: string, anchor: string, seq: number, text: string) => `c${hash(`${who}|${kind}|${anchor}|${seq}|${text}`)}`;

/** 요청 글에 들어갈 수 있으니 템플릿 기호·줄바꿈을 막는다 */
export const plain = (s: unknown, max = 200) =>
  String(s ?? '').replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％').replace(/\s+/g, ' ').trim().slice(0, max);

/** 항목 하나를 칸에 더한다 (같은 id 무시). 상한을 넘으면 오래된 살아 있는 항목을 합친다 */
export function putEntry(store: PeopleStore, who: string, slot: SlotId, entry: Entry): boolean {
  const p = store.people[who];
  if (!p) return false;
  const list = (p.slots[slot] ??= []);
  if (list.some((e) => e.id === entry.id)) return false;
  // 말투 항목은 다변화(speech.ts) 때 450자 + 표지가 붙을 수 있어 상한을 더 준다
  list.push({ ...entry, text: plain(entry.text, slot === 'speech' ? 600 : 300), ...(entry.quote ? { quote: plain(entry.quote, 60) } : {}) });
  return true;
}

export function putDoc(store: PeopleStore, type: Doc['type'], key: string, entry: Entry): boolean {
  const k = `${type}:${key}`;
  const d = (store.docs[k] ??= { type, key, entries: [] });
  if (d.entries.some((e) => e.id === entry.id)) return false;
  d.entries.push({ ...entry, text: plain(entry.text) });
  return true;
}

// ── 마지막 갱신 되돌리기 (리수폿 J-4): 갱신 전후 id 를 비교해 새로 생긴 것을 적어 두고, 되돌리면 전부 취소(void) ──
export interface RunSnapshot { entries: Set<string>; docs: Set<string>; changes: Set<string>; observations: Set<string>; people: Set<string> }
export function snapshotRun(store: PeopleStore): RunSnapshot {
  const entries = new Set<string>();
  const observations = new Set<string>();
  for (const p of Object.values(store.people)) {
    for (const [slot, list] of Object.entries(p.slots)) for (const e of list ?? []) entries.add(`${p.name}|${slot}|${e.id}`);
    for (const c of Object.values(p.candidates ?? {})) for (const o of c.evidence) observations.add(`${p.name}|${c.id}|${o.id}`);
  }
  const docs = new Set<string>();
  // 문서 열쇠는 저장 열쇠(`${type}:${key}`)로: 이름이 같은 다른 종류 문서를 가른다 (전수점검 사소-12)
  for (const [k, d] of Object.entries(store.docs)) for (const e of d.entries) docs.add(`${k}|${e.id}`);
  return { entries, docs, changes: new Set(store.log.map((c) => c.id)), observations, people: new Set(Object.keys(store.people)) };
}
/** 갱신 뒤: 전과 비교해 새로 생긴 것을 lastRun 에 적는다 (하나도 없으면 지움).
 *  renamed: 이 갱신에서 이름을 옮긴 기록 (renamePerson). 갱신 전 목록의 열쇠를 새 이름으로 바꿔 놓고 비교한다 —
 *  옮겨 온 항목·관찰이 새것으로 적히면 되돌리기가 그것들을 취소하고 옮긴 기록을 통째로 지운다.
 *  이름을 옮긴 것 자체는 되돌리지 않는다 */
export function recordRun(store: PeopleStore, before: RunSnapshot, at: string, renamed: { from: string; to: string }[] = []): LastRun | undefined {
  const after = snapshotRun(store);
  if (renamed.length) {
    const to = new Map(renamed.map((r) => [r.from, r.to]));
    const rekey = (set: Set<string>) => new Set([...set].map((k) => { const i = k.indexOf('|'); const who = i < 0 ? k : k.slice(0, i); return to.has(who) ? `${to.get(who)!}${i < 0 ? '' : k.slice(i)}` : k; }));
    before = { ...before, entries: rekey(before.entries), observations: rekey(before.observations), people: rekey(before.people) };
    // 옮길 이름에 기록이 없어 새로 만든 경우, 그 기록의 시작값 항목(시트)은 이 갱신이 쓴 것이 아니라 적지 않는다
    for (const name of new Set(to.values())) {
      for (const [slot, list] of Object.entries(store.people[name]?.slots ?? {})) for (const e of list ?? []) if (e.src === 'seed') before.entries.add(`${name}|${slot}|${e.id}`);
    }
  }
  const diff = (a: Set<string>, b: Set<string>) => [...b].filter((x) => !a.has(x));
  const run: LastRun = {
    at,
    entries: diff(before.entries, after.entries).map((k) => { const [who, slot, id] = k.split('|'); return { who, slot, id }; }),
    docs: diff(before.docs, after.docs).map((k) => { const i = k.lastIndexOf('|'); return { key: k.slice(0, i), id: k.slice(i + 1) }; }),
    changes: diff(before.changes, after.changes),
    observations: diff(before.observations, after.observations).map((k) => { const [who, cand, id] = k.split('|'); return { who, cand, id }; }),
    newPeople: diff(before.people, after.people),
  };
  const n = run.entries.length + run.docs.length + run.changes.length + run.observations.length + run.newPeople.length;
  if (n) store.lastRun = run;
  else delete store.lastRun;
  return store.lastRun;
}
/** 되돌리기: 마지막 갱신이 만든 항목·변경·관찰을 취소하고 새 인물을 지운다. 취소한 개수 */
export function undoLastRun(store: PeopleStore): number {
  const run = store.lastRun;
  if (!run) return 0;
  let n = 0;
  for (const x of run.entries) {
    const e = store.people[x.who]?.slots[x.slot as SlotId]?.find((e) => e.id === x.id);
    if (e && !e.void) { e.void = true; n++; }
  }
  for (const x of run.docs) {
    const e = store.docs[x.key]?.entries.find((e) => e.id === x.id);
    if (e && !e.void) { e.void = true; n++; }
  }
  for (const id of run.changes) {
    const c = store.log.find((c) => c.id === id);
    if (c && !c.void) { c.void = true; n++; }
  }
  for (const x of run.observations) {
    const o = store.people[x.who]?.candidates?.[x.cand]?.evidence.find((o) => o.id === x.id);
    if (o && !o.void) { o.void = true; n++; }
  }
  for (const name of run.newPeople) if (store.people[name]) { delete store.people[name]; n++; }
  delete store.lastRun;
  return n;
}

// ── 이름 옮기기 (이름 없는 인물의 이름이 밝혀졌을 때) ──

/** 호칭으로 적어 둔 기록(from)을 이름(to)의 기록으로 옮긴다. to 에 기록이 있으면 거기에 합치고, 없으면 seed(시트·시작값으로 만든 새 기록)에 옮긴다.
 *  옮기는 것: 칸 항목, 성격 변화 후보, 변경 기록(계기·호칭·메모)의 주인, 접힌 호감 합, 다른 인물 항목의 대상, 문서의 등장 인물, 장면 인물 목록.
 *  to 쪽 값이 이긴다: 시작값·호칭 고정·축은 to 것이 정해져 있으면 그대로, 비어 있을 때만 from 것을 받는다.
 *  from 이름과 그 별명은 to 의 별명으로 넘기지 않는다. 이름을 모를 때 글이 그 사람을 가리킨 말이라, 별명(글에서 인물을 찾고 응답의 이름을 푸는 열쇠)이 되면
 *  같은 말로 적힌 다른 사람의 글에 이 기록이 골라지고 그 사람 항목이 이 기록에 적힌다. to 도 호칭 기록이면(호칭끼리 합침) 받는다: 호칭 기록은 갱신기가 한 사람의 것으로 알고 읽는다.
 *  글 속에 적힌 옛 호칭(다른 항목 본문·인용)은 바꾸지 않는다.
 *  호칭 표시(provisional)는 from 과 함께 없어진다 (to 가 원래 호칭 기록이면 to 것은 남는다) */
export function renamePerson(store: PeopleStore, from: string, to: string, seed: Person | null, patternsCap = Number(PP_DEFAULTS.patterns_cap), anchor = ''): boolean {
  const src = store.people[from];
  const target = store.people[to] ?? seed;
  if (!src || !target || from === to) return false;
  // 응답이 한 옮기기는 옮기기 전 모습을 그 응답에 묶어 둔다: 그 응답이 사라지면 undoGoneRenames 가 되돌린다 (사용자 2026-11-22: 다시 굴리면 그 응답이 만든 것은 다 되돌아간다)
  if (anchor) {
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
    const targets: RenameUndo['targets'] = [];
    for (const p of Object.values(store.people)) {
      if (p === src || p === target) continue;
      for (const slot of SLOTS) for (const e of p.slots[slot] ?? []) if (e.target === from) targets.push({ who: p.name, slot, id: e.id });
    }
    const docs: RenameUndo['docs'] = [];
    for (const [key, d] of Object.entries(store.docs)) for (const e of d.entries) if (e.who?.includes(from)) docs.push({ key, id: e.id, who: [...e.who] });
    const pending: PeopleStore['pending'] = {};
    for (const k of [from, to]) if (store.pending[k]) pending[k] = copy(store.pending[k]);
    (store.renames ??= []).push({
      anchor, from, to, src: copy(src), before: store.people[to] ? copy(store.people[to]) : null,
      log: store.log.filter((c) => c.who === from).map((c) => c.id),
      had: [...store.log.filter((c) => c.who === to).map((c) => c.id), ...[src, store.people[to]].flatMap((p) => (p ? SLOTS.flatMap((slot) => (p.slots[slot] ?? []).map((e) => e.id)) : []))],
      touched: userTouched(store, from) || userTouched(store, to),
      ...(store.folded[from] !== undefined ? { folded: store.folded[from] } : {}),
      targets, docs,
      scene: Object.fromEntries(Object.entries(store.scene ?? {}).filter(([, list]) => list.includes(from)).map(([k, list]) => [k, [...list]])),
      pending,
    });
  }
  store.people[to] = target;
  // 칸 항목. 시트로 시작한 기록에는 이야기에서 적은 신원 항목을 옮기지 않는다 (새 인물 등록과 같다: 시트가 있으면 신원은 시트 것).
  // 한 번만 쓰는 칸(첫인상)은 같은 대상에 이미 있으면 옮기지 않고, 옮기면 자기 자신이 대상이 되는 항목도 옮기지 않는다
  for (const slot of SLOTS) {
    for (const e of src.slots[slot] ?? []) {
      if (e.target === to) continue;
      if (slot === 'identity' && e.src === 'story' && target.seeded.from === 'lore') continue;
      if (SLOT_META[slot].once && (target.slots[slot] ?? []).some((x) => (x.target ?? '@user') === (e.target ?? '@user'))) continue;
      const list = (target.slots[slot] ??= []);
      if (!list.some((x) => x.id === e.id)) list.push(e);
    }
  }
  for (const [id, c] of Object.entries(src.candidates ?? {})) {
    const cur = target.candidates[id];
    if (!cur) target.candidates[id] = c;
    else cur.evidence = [...cur.evidence, ...c.evidence.filter((o) => !cur.evidence.some((x) => x.id === o.id))];
  }
  if (target.axesFrom === 'default' && src.axesFrom !== 'default') {
    target.axes = { ...src.axes };
    target.axesFrom = src.axesFrom;
    target.express = src.express;
  }
  target.patterns = [...new Set([...target.patterns, ...src.patterns])].slice(-patternsCap);
  if (!target.sexual && src.sexual) target.sexual = src.sexual;
  if (!target.faction) target.faction = src.faction;
  if (!target.address.toUser && !target.address.pin && src.address.toUser) target.address = { ...src.address };
  if (src.reviewTurn !== undefined) target.reviewTurn = Math.max(target.reviewTurn ?? -1, src.reviewTurn);
  if (target.provisional) target.aliases = [...new Set([...target.aliases, from, ...src.aliases])].filter((a) => a !== to);
  delete store.people[from];
  // 이름으로 가리키는 곳들
  for (const c of store.log) if (c.who === from) c.who = to;
  if (store.folded[from] !== undefined) {
    store.folded[to] = (store.folded[to] ?? 0) + store.folded[from];
    delete store.folded[from];
  }
  // 다른 인물 항목의 대상은 새 이름으로. 받는 쪽 기록이 옛 호칭을 대상으로 적어 둔 항목은 자기 자신이 대상이 되니 버린다 (위에서 「대상 = to」 항목을 옮기지 않는 것과 같다)
  for (const p of Object.values(store.people)) {
    for (const slot of SLOTS) {
      const list = p.slots[slot];
      if (!list) continue;
      if (p === target) p.slots[slot] = list.filter((e) => e.target !== from);
      else for (const e of list) if (e.target === from) e.target = to;
    }
  }
  for (const d of Object.values(store.docs)) for (const e of d.entries) if (e.who?.includes(from)) e.who = [...new Set(e.who.map((w) => (w === from ? to : w)))];
  for (const [k, list] of Object.entries(store.scene ?? {})) if (list.includes(from)) store.scene![k] = [...new Set(list.map((n) => (n === from ? to : n)))];
  // 같은 이름으로 등록을 기다리던 후보는 기록이 생겼으니 없앤다. 별명은 to 로 기다리던 줄 것만 받는다 (옛 호칭 줄의 별명은 위와 같은 이유로 호칭끼리 합칠 때만)
  for (const k of [from, to]) {
    const pend = store.pending[k];
    if (!pend) continue;
    if (k === to || target.provisional) target.aliases = [...new Set([...target.aliases, ...(pend.aliases ?? [])])].filter((a) => a !== to);
    delete store.pending[k];
  }
  return true;
}

/** 다시 굴리거나 지워서 채팅에서 사라진 응답이 한 이름 옮기기를 되돌린다 (늦게 한 것부터). 되돌린 옮기기 {from: 새 이름, to: 옛 호칭} — 부르는 쪽이 설정 「항상 포함할 인물」도 되돌린다.
 *  채팅 뒤쪽 keepMsgs 개 메시지 밖의 살아 있는 응답이 한 것은 되돌릴 일이 없어 기록을 지운다. '#N' 기준은 사라졌는지 가릴 수 없어 그대로 둔다.
 *  되돌리지 않고 새 이름으로 두는 것 (사라진 응답이 만든 인물을 없앨 때 dropGonePeople 이 남기는 것과 같은 기준): appears(이름들) 가 돌려준 이름(살아 있는 메시지에도 나옴),
 *  옮긴 뒤 살아 있는 다른 응답이 항목·변경을 더한 기록, 옮긴 뒤 사용자가 손댄 기록 — 되돌리면 그 뒤에 쌓인 것이 옮기기 전 모습에 덮여 사라진다 */
export function undoGoneRenames(store: PeopleStore, chat: Chat, keepMsgs = FOLD_KEEP_MSGS, appears?: (names: string[]) => Set<string>): { from: string; to: string }[] {
  if (!store.renames?.length) return [];
  const at = anchorPositions(chat);
  const cut = msgs(chat).length - keepMsgs;
  const out: { from: string; to: string }[] = [];
  for (let i = store.renames.length - 1; i >= 0; i--) {
    const r = store.renames[i];
    if (r.anchor.startsWith('#')) continue;
    const pos = at.get(r.anchor);
    if (pos !== undefined) {
      if (pos < cut) store.renames.splice(i, 1);
      continue;
    }
    store.renames.splice(i, 1);
    if (store.people[r.from]) continue; // 옛 호칭으로 이미 다시 기록됨: 손대지 않는다
    const now = store.people[r.to];
    if (now) {
      const had = new Set([...(r.had ?? []), ...r.log]);
      const liveNew = (id: string, anchor: string, src: string) => !had.has(id) && src !== 'seed' && anchor !== r.anchor && anchor !== '#0' && at.has(anchor);
      if (SLOTS.some((s) => (now.slots[s] ?? []).some((e) => liveNew(e.id, e.anchor, e.src)))) continue;
      if (store.log.some((c) => c.who === r.to && liveNew(c.id, c.anchor, c.src))) continue;
      if (!r.touched && userTouched(store, r.to)) continue;
      if (appears?.([r.to]).has(r.to)) continue;
    }
    if (r.before) store.people[r.to] = r.before;
    else delete store.people[r.to];
    store.people[r.from] = r.src;
    const logIds = new Set(r.log);
    for (const c of store.log) if (logIds.has(c.id)) c.who = r.from;
    if (r.folded !== undefined) {
      store.folded[r.from] = r.folded;
      const rest = (store.folded[r.to] ?? 0) - r.folded;
      if (r.before && rest) store.folded[r.to] = rest;
      else delete store.folded[r.to];
    }
    for (const x of r.targets) {
      const e = store.people[x.who]?.slots[x.slot as SlotId]?.find((e) => e.id === x.id);
      if (e && e.target === r.to) e.target = r.from;
    }
    for (const x of r.docs) {
      const e = store.docs[x.key]?.entries.find((e) => e.id === x.id);
      if (e) e.who = x.who;
    }
    for (const [k, list] of Object.entries(r.scene)) if (store.scene?.[k]) store.scene[k] = list;
    for (const [k, row] of Object.entries(r.pending)) if (!store.people[k] && !store.pending[k]) store.pending[k] = row;
    out.push({ from: r.to, to: r.from });
  }
  if (!store.renames.length) delete store.renames;
  return out;
}

/** 등록 대기 줄(pending)에서 근거 응답이 채팅에 없는 것을 버린다 (다시 굴리거나 지운 응답에서만 나온 이름).
 *  남겨 두면 사라진 응답이 2턴 규칙의 「처음 본 것」으로 세어지고, 그 이름이 갱신기 자료(held_names)로 계속 나간다.
 *  expire: 근거 응답이 채팅 뒤쪽 FOLD_KEEP_MSGS 메시지 밖인 줄도 버린다 (한 번 스치고 다시 안 나온 이름이 끝없이 남아 요청마다 실리지 않게, 2026-11-17).
 *  그 뒤에 다시 나오면 처음 본 것으로 다시 센다. 「확인 뒤 등록」은 사용자가 고를 목록이라 expire 를 주지 않는다 */
export function prunePending(store: PeopleStore, chat: Chat, expire = false, keepMsgs = FOLD_KEEP_MSGS): void {
  const at = anchorPositions(chat);
  const cut = expire ? msgs(chat).length - keepMsgs : -1;
  for (const [name, row] of Object.entries(store.pending)) {
    const pos = at.get(row.anchor);
    if (pos === undefined || (pos >= 0 && pos < cut)) delete store.pending[name];
  }
}

/** 장면 인물 목록(scene)에서 채팅에 없는 응답의 것을 버린다 (다시 굴리거나 지운 응답) */
export function pruneScene(store: PeopleStore, chat: Chat): void {
  if (!store.scene) return;
  const keep = new Set(msgs(chat).map((m, i) => messageKey(m, i)));
  for (const k of Object.keys(store.scene)) if (!keep.has(k)) delete store.scene[k];
  if (!Object.keys(store.scene).length) delete store.scene;
}

/** 장면 인물 목록을 남겨 두는 응답 수. 쓰는 것은 요청 바로 앞 응답의 목록 하나다 (select.ts carriedScene) —
 *  마지막 응답들을 지우거나 다시 굴려도 그 앞 응답의 목록이 있도록 채팅 뒤쪽 몇 개만 둔다 */
export const SCENE_KEEP = 20;
/** 장면 인물 목록을 채팅 뒤쪽 SCENE_KEEP 개 응답 것만 남긴다. keep = 방금 적은 응답 (지난 응답을 뒤늦게 읽은 것이면 다음 묶음이 쓰도록 남긴다) */
export function capScene(store: PeopleStore, chat: Chat, keep?: string, keepScene = SCENE_KEEP): void {
  if (!store.scene) return;
  const keys = Object.keys(store.scene);
  if (keys.length <= keepScene) return;
  const at = new Map(msgs(chat).map((m, i) => [messageKey(m, i), i]));
  const recent = new Set(keys.filter((k) => at.has(k)).sort((a, b) => at.get(b)! - at.get(a)!).slice(0, keepScene));
  for (const k of keys) if (!recent.has(k) && k !== keep) delete store.scene[k];
}

export function putChange(store: PeopleStore, c: Change): boolean {
  if (store.log.some((x) => x.id === c.id)) return false;
  store.log.push({ ...c, reason: plain(c.reason, 80), ...(c.quote ? { quote: plain(c.quote, 60) } : {}) });
  return true;
}

// ── 읽음 표시 (어느 응답을 갱신기가 읽었나) ──

export const messageKey = (m: ChatMessage, index: number) => {
  const id = (m as { chatId?: unknown }).chatId;
  return typeof id === 'string' && id ? id : `#${index + 1}`;
};
/** 읽음 판정용 내용 해시: 이미지 태그·생각(<thoughts>)·HTML 주석·공백 차이는 무시한다.
 *  갱신기 뒤에 보조 모델 이미지 태그 보충(host/asset.ts)이 본문을 다시 쓰며 <img=> 를 끼운다 (core/asset.ts splitNarrative·applyPatches. 주석·생각은 그대로 두지만 단락을 못 찾으면 지운 글로 저장).
 *  그걸 「바뀐 응답」으로 보면 방금 읽은 응답이 턴마다 「지난 응답 안 읽음」으로 쌓였다 (2026-11-07 사용자) */
export const messageHash = (m: ChatMessage) =>
  hash(
    messageText(str(m.data))
      .replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<img\s*=[^>]*>/g, '')
      // 상점 표식 [shop: …] 은 뒤에 지워지거나(지난 응답) 갱신기가 붙인다(상점 판단 갱신기, 11-09) — 내용 변화로 보지 않는다
      .replace(/\[\s*shop\s*[:：][^\]]*\]/giu, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );

/** 아직 읽지 않은(또는 내용이 바뀐) 봇 응답의 위치들 */
export function unreadIndexes(chat: Chat, store: PeopleStore): number[] {
  const out: number[] = [];
  msgs(chat).forEach((m, i) => {
    if (m.role !== 'char') return;
    if (store.read[messageKey(m, i)] !== messageHash(m)) out.push(i);
  });
  return out;
}

/** 안 읽은 응답을 「지금 갱신」이 읽을 새 것(마지막으로 읽은 응답 뒤, 읽은 적이 없으면 마지막 하나)과 「지난 응답 읽기」 몫(그 앞)으로 나눈다.
 *  남은 지난 응답이 첫 장면(채팅 맨 앞의 봇 메시지) 하나뿐이면 새 것과 같이 읽는다: 첫 응답만 읽으면 첫 장면이 「지난 응답 1개 안 읽음」으로 끝까지 남았다 (11-15 사용자) */
export function splitUnread(chat: Chat, store: PeopleStore): { newer: number[]; older: number[] } {
  const all = unreadIndexes(chat, store);
  const list = msgs(chat);
  const lastRead = Math.max(-1, ...list.map((m, i) => (store.read[messageKey(m, i)] !== undefined ? i : -1)));
  const newer = lastRead < 0 ? all.slice(-1) : all.filter((i) => i > lastRead);
  const older = all.filter((i) => !newer.includes(i));
  if (newer.length && older.length === 1 && older[0] === 0) return { newer: [0, ...newer], older: [] };
  return { newer, older };
}

export function markRead(store: PeopleStore, chat: Chat, indexes: number[]): void {
  const list = msgs(chat);
  for (const i of indexes) {
    const m = list[i];
    if (m) store.read[messageKey(m, i)] = messageHash(m);
  }
  // 채팅에 없는 열쇠는 정리 (다시 굴리기로 사라진 응답)
  const keep = new Set(list.map((m, i) => messageKey(m, i)));
  for (const k of Object.keys(store.read)) if (!keep.has(k)) delete store.read[k];
}

// ── 사라진 응답의 변경 버리기 ──

/** 다시 굴리거나 지워서 채팅에서 사라진 응답이 만든 변경 기록 줄만 버린다 (사용자 2026-11-14 F-1 (나)). 버린 개수.
 *  살아 있는 응답의 변경은 전부 남긴다 (접지 않는다). 직접 고친 줄(manual)·시작값(seed)은 응답이 만든 것이 아니라 남긴다.
 *  '#N' 기준은 chatId 가 없는 메시지라 사라졌는지 가릴 수 없어 남긴다 */
export function dropGoneChanges(store: PeopleStore, chat: Chat): number {
  const at = anchorPositions(chat);
  const before = store.log.length;
  store.log = store.log.filter((c) => c.src === 'manual' || c.src === 'seed' || c.anchor.startsWith('#') || at.has(c.anchor));
  return before - store.log.length;
}

/** 사용자가 이 인물 기록을 직접 고쳤거나 고정했나: 수동 항목·고정 항목, 수동 변경(호감 고정·호칭 직접 수정), 호칭 고정,
 *  축 승인·수정, 승인된 장기 변화, 성적 글 직접 씀·켬끔·덮어쓰기 */
export function userTouched(store: PeopleStore, name: string): boolean {
  const p = store.people[name];
  if (!p) return false;
  if (SLOTS.some((s) => (p.slots[s] ?? []).some((e) => e.src === 'manual' || e.pin))) return true;
  if (store.log.some((c) => c.who === name && c.src === 'manual')) return true;
  if (p.address.pin || p.axesFrom === 'manual' || p.patterns.length) return true;
  const x = p.sexual;
  return !!x && (!!x.desire?.manual || !!x.paraphilia?.manual || x.desireOn === false || x.paraphiliaOn === false || (x.explicit !== null && x.explicit !== undefined));
}

/** 다시 굴리거나 지워서 채팅에서 사라진 응답이 처음 만든 인물 기록을 없앤다 (사용자 2026-11-14 F-1 (나) — 등록 대기 줄의 prunePending, 변경 줄의 dropGoneChanges 와 같은 규칙). 없앤 이름.
 *  남기는 것: appears(이름들) 가 돌려준 사람(살아 있는 메시지에도 나옴), 살아 있는 다른 응답에 근거한 항목·변경이 있는 사람,
 *  사용자가 고치거나 고정한 사람(userTouched), keep(설정 「항상 포함할 인물」). 처음 만든 응답(origin)이 없는 기록(사용자가 만든 것·옛 저장)과
 *  '#N' 기준(chatId 가 없는 메시지라 사라졌는지 가릴 수 없음)은 남긴다 */
export function dropGonePeople(store: PeopleStore, chat: Chat, appears: (names: string[]) => Set<string>, keep: string[] = []): string[] {
  const at = anchorPositions(chat);
  const liveOther = (anchor: string, origin: string) => anchor !== origin && anchor !== '#0' && at.has(anchor);
  const gone = Object.values(store.people)
    .filter((p) => !!p.origin && !p.origin.startsWith('#') && !at.has(p.origin) && !keep.includes(p.name))
    .filter((p) => !SLOTS.some((s) => (p.slots[s] ?? []).some((e) => e.src !== 'seed' && liveOther(e.anchor, p.origin!))))
    .filter((p) => !store.log.some((c) => c.who === p.name && c.src !== 'seed' && liveOther(c.anchor, p.origin!)))
    .filter((p) => !userTouched(store, p.name))
    .map((p) => p.name);
  if (!gone.length) return [];
  const seen = appears(gone);
  const out = gone.filter((n) => !seen.has(n));
  for (const n of out) {
    delete store.people[n];
    store.log = store.log.filter((c) => c.who !== n);
    delete store.folded[n];
    for (const [k, list] of Object.entries(store.scene ?? {})) if (list.includes(n)) store.scene![k] = list.filter((x) => x !== n);
  }
  return out;
}

// ── 접기 ──

/** 변경 기록 줄 상한 기본값 (설정 「변경 기록 상한」 log_cap) */
export const LOG_CAP = Number(PP_DEFAULTS.log_cap);
/** 합치지 않고 줄로 남겨 두는 채팅 뒤쪽 메시지 수 (이 안의 응답은 지우거나 다시 굴리면 값이 정확히 되돌아간다) */
export const FOLD_KEEP_MSGS = 200;
/** 변경 기록 줄이기. 갱신 저장 때 부른다 (2026-11-17 사용자: 원본처럼 오래된 호감 계기는 숫자 하나로 합친다. 원본은 호감 숫자를 저장하고 이력은 60개만 둔다).
 *  ① 사라진 응답이 만든 변경은 버린다 (dropGoneChanges).
 *  ② 상한을 넘으면 오래된(최근 200개 메시지 밖) 살아 있는 계기를 사람별 값으로 접는다. refold(그 사람, 접을 계기(순서대로), 지금 접힌 값) → 새 접힌 값, null 이면 그 사람은 접지 않는다.
 *  고정(pin)이 든 사람, 묶음이 경계에 걸친 사람은 값이 달라질 수 있어 접지 않는다. 접은 것은 되돌릴 수 없다 */
export function foldLog(store: PeopleStore, chat: Chat, refold: (who: string, cues: Change[], folded: number) => number | null, keepMsgs = FOLD_KEEP_MSGS, logCap = LOG_CAP): void {
  dropGoneChanges(store, chat);
  const live = liveness(chat);
  if (store.log.length <= logCap) return;
  const cut = msgs(chat).length - keepMsgs;
  if (cut <= 0) return;
  const key = (c: Change) => c.group ?? c.anchor;
  const pos = (c: Change) => live.at.get(c.anchor) ?? -1;
  const cues = liveChanges(store, live).filter((c) => c.kind === 'cue');
  const drop = new Set<string>();
  for (const who of new Set(cues.map((c) => c.who))) {
    const mine = cues.filter((c) => c.who === who);
    const old = mine.filter((c) => pos(c) < cut);
    if (!old.length || old.some((c) => c.pin !== undefined)) continue;
    const oldKeys = new Set(old.map(key));
    if (mine.some((c) => pos(c) >= cut && oldKeys.has(key(c)))) continue;
    const v = refold(who, old, store.folded[who] ?? 0);
    if (v === null || !Number.isFinite(v)) continue;
    store.folded[who] = v;
    for (const c of old) drop.add(c.id);
    // 같은 사람의 오래된 죽은 계기도 함께 버린다 (예전 foldLog 와 같다)
    for (const c of store.log) if (c.who === who && c.kind === 'cue' && !isAlive(c, live) && (live.at.get(c.anchor) ?? cut) < cut) drop.add(c.id);
  }
  if (drop.size) store.log = store.log.filter((c) => !drop.has(c.id));
}
