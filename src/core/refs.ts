// 참고 자료 모으기 (원본 REFERENCE_CORE). 위키·괴담넷·괴담톡이 같이 쓴다.
// 봇 설명, 작가 노트, 제목과 같은 이름의 로어북, 글에 이름이 나온 로어북, 상시 로어북(고른 것, 기본 📜Faction·🙂Roster),
// 그 로어북들 속 이름으로 한 번 더 찾은 2차 참조를 모아 "[종류: 출처]\n내용" 블록으로 만든다.
import { guidePrompt, guideTxt, isGuideName } from './guides';
import { evaluate, type CbsEnv } from './cbs';
import { readScene, stripSceneCard, stripSceneMark, stripStartCard, stripUnsentMark } from './dispatch';
import { hasCall, stripCall } from './phone';
import type { Chat, LoreEntry } from './types';
import { cleanOutput, hasWorldTags } from './world/tags';
import { buildRegistry, referenceEntries, type Registry } from './world/registry';
import { stripThoughts } from './thoughts';
import { auxLoreRisu, keyedHits, outsideEntries } from './auxlore';

export type RefKind = 'base' | 'primary' | 'active' | 'direct' | 'secondary';

export interface RefRow {
  kind: RefKind;
  sources: string[];
  content: string;
  required: boolean;
}

export interface RefSource {
  /** moduleLore: 켜진 모듈의 로어북. 「보조 호출 로어북 = 로어북 포함」일 때만 host/risu.ts 가 채운다 */
  char: { name?: string; desc?: string; globalLore?: LoreEntry[]; moduleLore?: LoreEntry[] };
  chat: Chat;
  /** 사용자 페르소나 설명 ({{persona}}, 창을 열 때 읽어 둔 값) */
  persona?: string;
}

/** 참고 자료로 쓰면 안 되는 내부 로어북 */
const INTERNAL = new Set([
  'World catalog', 'Agent roster', 'Directive', 'Faction display', 'Start trigger', 'LB Backend', 'GNet', 'Wiki', 'Phone',
  'Phone tabs', 'Visit', 'Settings', '⚙️설정', '괴이봇 플러그인 매니페스트', '괴이봇 명부', 'Plugin manifest', 'Directory', 'WIKI_DIAGNOSTIC',
]);
/** 「상시 로어북」 기본값 (사용자가 고르지 않았을 때) */
export const ACTIVE_BOOKS = ['📜Faction', '🙂Roster'];
/** 고른 「상시 로어북」 이름 목록 (JSON 배열). 비어 있으면 기본값. 설정 → 로어북 호출 (ui/advanced.ts), 새 채팅 기본값에도 담긴다 ($gen_) */
export const ACTIVE_BOOKS_VAR = '$gen_active_books';
const bookKey = (name: string) => name.trim().toLowerCase();
/** 이름 목록 다듬기: 빈 이름·같은 이름(대소문자 무시)은 한 번만 */
function cleanNames(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const name = typeof x === 'string' ? x.trim() : '';
    if (!name || seen.has(bookKey(name))) continue;
    seen.add(bookKey(name));
    out.push(name);
  }
  return out;
}
/** 지금 고른 「상시 로어북」. 저장된 값이 없거나 읽을 수 없으면 기본값 */
export function activeBooks(state: Record<string, unknown> | undefined): string[] {
  const raw = state?.[ACTIVE_BOOKS_VAR];
  if (typeof raw !== 'string' || !raw.trim()) return [...ACTIVE_BOOKS];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? cleanNames(list) : [...ACTIVE_BOOKS];
  } catch {
    return [...ACTIVE_BOOKS];
  }
}
/** 저장할 값: 기본값과 같으면 빈 글(= 기본값) */
export function activeBooksValue(names: string[]): string {
  const list = cleanNames(names);
  const same = list.length === ACTIVE_BOOKS.length && ACTIVE_BOOKS.every((n) => list.some((x) => bookKey(x) === bookKey(n)));
  return same ? '' : JSON.stringify(list);
}
/** 이름 하나를 넣거나 뺀 뒤 저장할 값 */
export function toggleActiveBook(state: Record<string, unknown> | undefined, name: string): string {
  const cur = activeBooks(state);
  const key = bookKey(name);
  if (!key) return activeBooksValue(cur);
  return activeBooksValue(cur.some((n) => bookKey(n) === key) ? cur.filter((n) => bookKey(n) !== key) : [...cur, name.trim()]);
}
/* 기본 자료의 출처 이름. 코드가 견주는 이름이고(phonePrompt 등), 요청에 적을 때는 지침 「요청 공통」 REFS.SOURCE.* 절의 글로 바꾼다 */
export const PERSONA_SOURCE = '사용자 페르소나';
const DESC_SOURCE = '봇 설명';
const NOTE_SOURCE = '작가 노트';
const SOURCE_SECTION = new Map<string, string>([[DESC_SOURCE, 'REFS.SOURCE.DESC'], [NOTE_SOURCE, 'REFS.SOURCE.NOTE'], [PERSONA_SOURCE, 'REFS.SOURCE.PERSONA']]);
/** 요청에서 {{user}} 대신 쓰는 이름 (지침 「요청 공통」 REFS.USER_NAME 절) */
const userName = (): string => guideTxt('Common', 'REFS.USER_NAME');

export function allowedBook(e: LoreEntry): boolean {
  const name = String(e.comment ?? '');
  const text = String(e.content ?? '');
  if (!name || INTERNAL.has(name) || name.startsWith('WIKI｜') || /^lightboard/i.test(name) || name.startsWith('toon.')) return false;
  return !text.includes('@@SECTION') && !text.includes('[NW_PRIVATE_BEGIN]');
}

/** 다른 기능의 표식을 지운다 (원본 RC.strip) */
export function stripModules(text: string): string {
  return text
    .replace(/\[MODULE_CONTEXT_BEGIN\][\s\S]*?\[MODULE_CONTEXT_END\]/g, '')
    .replace(/\[NW_PRIVATE_BEGIN\][\s\S]*?\[NW_PRIVATE_END\]/g, '')
    .replace(/<lightboard-namuwiki[\s>][\s\S]*?<\/lightboard-namuwiki>/g, '')
    .replace(/\[LBDATA START\][\s\S]*?\[LBDATA END\]/g, '')
    .replace(/<gnet-data>[\s\S]*?<\/gnet-data>/g, '')
    .replace(/<lb-[\w-]+[\s\S]*?<\/lb-[\w-]+>/g, '')
    .replace(/◈[^◈\n]*◈/g, '')
    .trim();
}

export function cbsEnv(src: RefSource): CbsEnv {
  return { vars: src.chat.scriptstate ?? {}, char: src.char.name, charDesc: src.char.desc, user: userName() };
}

function allBooks(src: RefSource): LoreEntry[] {
  const local = Array.isArray(src.chat.localLore) ? (src.chat.localLore as LoreEntry[]) : [];
  return [...(src.char.globalLore ?? []), ...local];
}

/** 이 카드에서 고를 수 있는 로어북 이름 (폴더·내부 로어북 빼고, 같은 이름은 한 번만) */
export function bookNames(src: RefSource): string[] {
  return cleanNames(allBooks(src).filter((e) => e.mode !== 'folder' && allowedBook(e)).map((e) => String(e.comment ?? '')));
}

/** 이름이 정확히 같은 로어북 내용 (CBS 해석, 표식 제거) */
function readBook(books: LoreEntry[], name: string, env: CbsEnv): string[] {
  const key = name.trim().toLowerCase();
  return books
    .filter((e) => String(e.comment ?? '').trim().toLowerCase() === key && allowedBook(e))
    // 첫 줄의 Risu 표식 @@dont_activate 는 모델에게 뜻 없는 줄이라 뗀다 (전수검사 11-13)
    .map((e) => stripModules(evaluate(String(e.content ?? '').replace(/^\s*@@dont_activate[ \t]*\r?\n?/, ''), env)))
    .filter(Boolean);
}

/** 이름이 정확히 같은 로어북 내용 (괴담톡 인물 원문) */
export function bookText(src: RefSource, name: string): string {
  return name.trim() ? readBook(allBooks(src), name, cbsEnv(src)).join('\n\n') : '';
}

export function hasBook(src: RefSource, name: string): boolean {
  return readBook(allBooks(src), name, cbsEnv(src)).length > 0;
}

export interface CollectOptions {
  /** 제목과 같은 이름의 로어북 (위키) */
  primaryNames?: string[];
  /** 이름을 찾아볼 글 (제목, 작성 지침, 최근 본문) */
  text: string;
  description?: boolean;
  authors?: boolean;
  persona?: boolean;
  active?: boolean;
  related?: boolean;
  secondary?: boolean;
  /** 위키: base·primary·active가 필수. 그 밖: direct가 필수 */
  scope: 'wiki' | 'gnet' | 'phone';
  registry?: Registry;
  /** 활성 로어북 앞에 넣는 앱 자료 (괴담넷 "현재 발생 상황" 등) */
  extra?: { source: string; content: string }[];
}

export function collectRefs(src: RefSource, o: CollectOptions): RefRow[] {
  const env = cbsEnv(src);
  const books = allBooks(src);
  const registry = o.registry ?? buildRegistry(src.char.globalLore);
  const rows: RefRow[] = [];
  const add = (kind: RefKind, source: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    const rank: RefKind[] = ['base', 'primary', 'active', 'direct', 'secondary'];
    const same = rows.find((r) => r.content === text);
    if (same) {
      if (!same.sources.includes(source)) same.sources.push(source);
      if (o.scope === 'wiki' && rank.indexOf(kind) < rank.indexOf(same.kind)) same.kind = kind;
      same.required = same.required || required(kind);
      return;
    }
    rows.push({ kind, sources: [source], content: text, required: required(kind) });
  };
  const required = (kind: RefKind) => (o.scope === 'wiki' ? kind === 'base' || kind === 'primary' || kind === 'active' : kind === 'base' || kind === 'direct');

  if (o.description !== false && src.char.desc) add('base', DESC_SOURCE, stripModules(evaluate(src.char.desc, env)));
  const note = typeof src.chat.note === 'string' ? src.chat.note : '';
  if (o.authors !== false && note.trim()) add('base', NOTE_SOURCE, stripModules(evaluate(note, env)));
  if (o.persona !== false && src.persona?.trim()) add('base', PERSONA_SOURCE, stripModules(evaluate(src.persona, env)));
  const seen = new Set<string>();
  const pull = (kind: RefKind, name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    for (const c of readBook(books, name, env)) add(kind, name, c);
  };
  for (const n of o.primaryNames ?? []) pull('primary', n);
  for (const x of o.extra ?? []) add('active', x.source, x.content);
  if (o.active !== false) for (const n of activeBooks(src.chat.scriptstate)) pull('active', n);
  if (o.related !== false) for (const e of referenceEntries(registry, o.text)) if (e.lore) pull('direct', e.lore);
  // 「로어북 포함」: 플러그인 틀 밖의 로어북(카드에 넣은 항목·채팅·모듈)을 Risu 규칙으로 더한다 (core/auxlore.ts). 위의 고르기는 그대로다
  const outside = auxLoreRisu(src.chat.scriptstate)
    ? outsideEntries({ card: src.char.globalLore, local: Array.isArray(src.chat.localLore) ? (src.chat.localLore as LoreEntry[]) : [], modules: src.char.moduleLore }, allowedBook)
    : [];
  const put = (kind: RefKind, name: string, content: string) => {
    if (seen.has(name.trim().toLowerCase())) return;
    add(kind, name, stripModules(evaluate(content, env)));
  };
  if (o.active !== false) for (const e of outside) if (e.always) put('active', e.name, e.content);
  if (o.related !== false) for (const e of keyedHits(outside, o.text)) put('direct', e.name, e.content);
  if (o.secondary) {
    const hop = rows.filter((r) => r.kind === 'primary' || r.kind === 'direct').map((r) => r.content).join('\n');
    for (const e of referenceEntries(registry, hop)) if (e.lore) pull('secondary', e.lore);
    for (const e of keyedHits(outside, hop)) put('secondary', e.name, e.content);
  }
  return rows;
}

/** 개수 제한 (원본 reference_count): 추가 참조(관련·2차)만 센다. 필수가 아닌 2차 참조, 그다음 관련 로어북부터 뺀다.
 *  o.hard (상점 요청만, 2026-11-12 사용자: 「참조 로어북」 수가 실제로 듣게): 필수인 관련 로어북도 수에 맞춰 뺀다.
 *  빼는 차례 = 2차 참조 → o.first 가 아닌 관련 로어북 → o.first 인 관련 로어북, 저마다 뒤에서부터. o 를 안 주면 예전 그대로 */
export interface LimitOptions {
  hard?: boolean;
  /** 끝까지 남길 줄 (가게 이름·주인 이름에 걸린 로어북) */
  first?: (r: RefRow) => boolean;
}
export function limitRefs(rows: RefRow[], max: number, o?: LimitOptions): RefRow[] {
  const out = rows.slice();
  const extra = () => out.filter((r) => r.kind === 'direct' || r.kind === 'secondary').length;
  if (o?.hard) {
    const first = o.first ?? (() => false);
    const steps: ((r: RefRow) => boolean)[] = [(r) => r.kind === 'secondary', (r) => r.kind === 'direct' && !first(r), (r) => r.kind === 'direct'];
    for (const hit of steps) for (let i = out.length - 1; i >= 0 && extra() > max; i--) if (hit(out[i])) out.splice(i, 1);
    return out;
  }
  for (const kind of ['secondary', 'direct'] as RefKind[]) {
    for (let i = out.length - 1; i >= 0 && extra() > max; i--) if (out[i].kind === kind && !out[i].required) out.splice(i, 1);
  }
  return out;
}

/** 참고 자료 묶음. 머리 줄은 지침 「요청 공통」 REFS.HEAD (종류 이름 REFS.KIND.*, 출처 이름 REFS.SOURCE.*) */
export function refText(rows: RefRow[]): string {
  const source = (s: string) => {
    const sec = SOURCE_SECTION.get(s);
    return sec ? guideTxt('Common', sec) : s;
  };
  return rows.map((r) => `${guideTxt('Common', 'REFS.HEAD', { kind: guideTxt('Common', `REFS.KIND.${r.kind}`), sources: r.sources.map(source).join(' / ') })}\n${r.content}`).join('\n\n');
}

// ── 최근 본문 ──

export interface Turn {
  user: string;
  char: string[];
}

export function messageText(data: string): string {
  // 첫 장면 표식(%%GOEI_SCENE%%)도 뗀다: 인물 갱신기·곁 기능 요청에 표식 글이 그대로 갔다 (3차 점검 R04)
  let t = stripSceneMark(stripThoughts(stripStartCard(stripUnsentMark(String(data ?? '')))));
  if (t.includes('%%SCENE_CARD:')) {
    const s = readScene(t);
    // 카드 뒤에 붙은 글은 창의 상황 칸에 적은 것: 같이 남긴다 (거기 적은 사람·장소의 로어북도 찾게. 2026-11-22)
    const END = '%%/SCENE_CARD%%';
    const end = t.lastIndexOf(END);
    const note = end >= 0 ? t.slice(end + END.length).trim() : '';
    t = s ? [guideTxt('Common', 'REFS.MOVE', { target: s.target, party: s.party }), note].filter(Boolean).join('\n') : stripSceneCard(t);
  }
  if (hasCall(t)) t = stripCall(t).replace(/\{\{user\}\}/gi, () => userName());
  if (hasWorldTags(t)) t = cleanOutput(t);
  return stripModules(t);
}

/** 유저 메시지가 턴을 시작하고 뒤따르는 응답이 그 턴에 붙는다. 마지막 n턴 */
/** 최근 n턴. withUser=false면 유저 메시지 글은 비운다 (생성 공통 「유저 메시지 빼기」, 턴 나눔은 그대로) */
export function recentTurns(chat: Chat, n: number, withUser = true): Turn[] {
  const turns: Turn[] = [];
  for (const m of chat.message ?? []) {
    const text = messageText(m.data);
    if (!text || /%GNET_|%LB_SETTINGS|%PHONE_CALL_PENDING%/.test(m.data)) continue;
    if (m.role === 'user') turns.push({ user: withUser ? text : '', char: [] });
    else if (turns.length) turns[turns.length - 1].char.push(text);
    else turns.push({ user: '', char: [text] });
  }
  return turns.slice(-Math.max(1, n));
}

/** 최근 본문. 이름표는 지침 「요청 공통」 REFS.STORY.USER · REFS.STORY.CHAR 절 */
export function storyText(turns: Turn[]): string {
  const user = guideTxt('Common', 'REFS.STORY.USER');
  const char = guideTxt('Common', 'REFS.STORY.CHAR');
  return turns
    .flatMap((t) => [...(t.user ? [`${user}\n${t.user}`] : []), ...t.char.map((c) => `${char}\n${c}`)])
    .join('\n\n');
}

/** 소속 코드(A00~E00, 새 세력 F00~)를 보는 소속 기준 이름으로 (원본 TM.prepareAffiliations) */
export function factionCodesToNames(text: string, names: Record<string, string>): string {
  return text.replace(/(?<![\w])([A-Z]00)(?![\w])/g, (code) => names[code] ?? code);
}

/** 지침의 @@SECTION 이름\n…\n@@END 블록들. GNet·Phone·Wiki·Visit 는 플러그인 내장 지침(core/guides.ts)에서, 그 밖은 로어북에서 */
export function policySections(lore: LoreEntry[] | undefined, comment: string): Record<string, string> {
  const raw = isGuideName(comment) ? guidePrompt(comment) : (lore ?? []).find((e) => e.comment === comment)?.content;
  const out: Record<string, string> = {};
  if (typeof raw !== 'string') return out;
  for (const m of raw.matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)) out[m[1].trim()] = m[2];
  return out;
}
