import { stripVirtual, withWorldLore } from '../core/world/virtual';
import { makeAssetCopy, splitAssetCopy } from '../core/world/assetcopy';
import { setStatusColumns } from '../core/world/statuscols';
import { setIconAliases, setIconPool } from '../core/iconmatch';
import { ITEM_ICON_ALIAS_VAR, itemIconPoolOn, setItemRules } from '../core/items';
import { setWalletCap } from '../core/wallet';
import type { Chat, LoreEntry } from '../core/types';
import { applyAdvanced, applyGenLimits } from '../core/advanced';
import { auxLoreRisu } from '../core/auxlore';

export interface CharacterSnapshot {
  name?: string;
  type?: string;
  chaId?: string;
  alternateGreetings?: string[];
  globalLore?: LoreEntry[];
  /** 켜진 모듈의 로어북 (「보조 호출 로어북 = 로어북 포함」일 때만 채운다. core/auxlore.ts) */
  moduleLore?: LoreEntry[];
  /** 카드에 든 에셋용 사본 (폴더 + 요원 항목). globalLore 에는 없다 (core/world/assetcopy.ts) */
  assetCopy?: LoreEntry[];
  [key: string]: unknown;
}

export interface ChatContext {
  charIndex: number;
  chatIndex: number;
  char: CharacterSnapshot;
  chat: Chat;
}

/** 켜진 모듈의 로어북. Risu 가 주는 「지금 봇 + 이 채팅 + 켜진 모듈」 목록에서 봇·채팅 것을 뺀 나머지.
 *  그 기능이 없는 Risu 면 전역으로 켠 모듈의 로어북을 읽는다. 못 읽으면 빈 목록 (참고 자료가 줄 뿐 요청은 그대로 간다) */
async function moduleLore(char: CharacterSnapshot, chat: Chat): Promise<LoreEntry[]> {
  const isEntry = (e: unknown): e is LoreEntry => !!e && typeof e === 'object';
  const print = (e: LoreEntry) => `${String(e.key ?? '')}\u0000${String(e.comment ?? '')}\u0000${String(e.content ?? '')}`;
  try {
    if (typeof risuai.getCurrentLorebookEntries === 'function') {
      const all = ((await risuai.getCurrentLorebookEntries()) ?? []).filter(isEntry);
      const mine = new Map<string, number>();
      for (const e of [...(char.globalLore ?? []), ...(Array.isArray(chat.localLore) ? (chat.localLore as LoreEntry[]) : [])]) mine.set(print(e), (mine.get(print(e)) ?? 0) + 1);
      return all.filter((e) => {
        const n = mine.get(print(e)) ?? 0;
        if (n > 0) mine.set(print(e), n - 1);
        return n <= 0;
      });
    }
    const db = await risuai.getDatabase(['modules', 'enabledModules']);
    const on = new Set(db?.enabledModules ?? []);
    return (db?.modules ?? []).filter((m) => on.has(m.id)).flatMap((m) => (Array.isArray(m.lorebook) ? m.lorebook.filter(isEntry) : []));
  } catch {
    return [];
  }
}

export async function loadContext(): Promise<ChatContext | null> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const chatIndex = await risuai.getCurrentChatIndex();
  if (!Number.isInteger(charIndex) || charIndex < 0 || !Number.isInteger(chatIndex) || chatIndex < 0) return null;
  const char = (await risuai.getCharacterFromIndex(charIndex)) as CharacterSnapshot | null;
  const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  if (!char || !chat) return null;
  if (auxLoreRisu(chat.scriptstate)) char.moduleLore = await moduleLore(char, chat);
  // 세계 데이터(기본 + 카드 덧쓰기)를 가상 로어북으로 붙인다. 저장할 때는 updateCharacterLore 가 뺀다
  char.assetCopy = splitAssetCopy(char.globalLore).copy;
  char.globalLore = withWorldLore(char.globalLore);
  chat.message ??= [];
  // 상태창 파서에 이 채팅의 칸 구성을 알린다 (core/world/statuscols.ts)
  setStatusColumns(chat.scriptstate);
  // 소지품 그림 대체 말 표 (core/iconmatch.ts)
  setIconAliases(String(chat.scriptstate?.[ITEM_ICON_ALIAS_VAR] ?? ''));
  setIconPool(itemIconPoolOn(chat.scriptstate));
  // 소지품 판정 표·「두고 옴」 말·「벗음」 말 (core/itemrules.ts)
  setItemRules(chat.scriptstate);
  // 요청당 사진 수 (core/advanced.ts)
  applyGenLimits(chat.scriptstate);
  // 거래 줄 상한 (core/wallet.ts)
  setWalletCap(chat.scriptstate);
  shown = { key: `${charIndex}:${chatIndex}`, state: chat.scriptstate };
  return { charIndex, chatIndex, char, chat };
}

/** 지금 열려 있는 채팅(마지막으로 읽은 채팅)과 그 채팅 변수. 다른 채팅을 저장한 뒤 보관 수·길이 제한을 이 채팅 값으로 되돌리는 데 쓴다 */
let shown: { key: string; state: Chat['scriptstate'] } | null = null;
/** 채팅마다 다른 수(고급 설정 길이 제한·보관 수, 거래 줄 상한, 소지품 표와 줄 상한)를 그 채팅 값으로 맞춘다 */
function applyChatLimits(state: Chat['scriptstate']): void {
  applyAdvanced(state);
  setWalletCap(state);
  setItemRules(state);
}

/** 이미 그려진 메시지를 Risu 가 다시 그리게 한다: 같은 글을 그대로 저장하면 Risu(Chats.svelte, 글 해시로 그린 것을 재사용)가 다시 그리지 않으므로
 *  고를 메시지의 끝 줄바꿈을 붙였다 뗐다 해 글이 바뀌게 한다. 보이는 것·요청은 그대로이고 읽음 해시도 공백은 안 본다 (core/people/store.ts).
 *  전수점검 보통-11: 보고서 카드·상태창을 다시 그리려 같은 글을 그대로 저장해 Risu 가 다시 그리지 않을 수 있었다 */
export function nudgeMessages(chat: Chat, pick: (data: string, index: number) => boolean = () => true): Chat {
  return { ...chat, message: (chat.message ?? []).map((m, i) => (typeof m.data === 'string' && pick(m.data, i) ? { ...m, data: m.data.endsWith('\n') ? m.data.slice(0, -1) : `${m.data}\n` } : m)) };
}

// 같은 채팅 저장은 차례로 (읽고 쓰는 사이에 다른 저장이 끼면 그 변경이 사라진다. 괴담넷·괴담톡 자동 확인이 동시에 저장할 수 있다)
const queues = new Map<string, Promise<unknown>>();

/** 저장 직전에 최신 채팅을 다시 읽고 변경을 적용한다. 다른 곳의 변경을 덮어쓰지 않기 위해서다. */
export function updateChat(charIndex: number, chatIndex: number, mutate: (chat: Chat) => Chat | null): Promise<Chat | null> {
  const key = `${charIndex}:${chatIndex}`;
  const run = (queues.get(key) ?? Promise.resolve()).then(() => saveChat(charIndex, chatIndex, mutate));
  const tail = run.catch(() => {});
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}

async function saveChat(charIndex: number, chatIndex: number, mutate: (chat: Chat) => Chat | null): Promise<Chat | null> {
  const latest = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  if (!latest) throw new Error('채팅을 찾을 수 없어요. 채팅을 다시 열어 주세요.');
  latest.message ??= [];
  // 저장 직전에 이 채팅의 값으로 맞춘다 (길이 제한·보관 수·거래 줄 상한·소지품 표와 줄 상한을 다른 채팅 값으로 쓰지 않게.
  // 응답이 끝나기 전에 다른 채팅을 열었어도 그 채팅 값으로 정리하지 않는다)
  applyChatLimits(latest.scriptstate);
  const key = `${charIndex}:${chatIndex}`;
  const read = latest.scriptstate;
  let next: Chat | null = null;
  try {
    next = mutate(latest);
  } finally {
    // mutate 가 끝나면 열려 있는 채팅의 값으로 되돌린다. 열려 있는 채팅이면 방금 읽은 값이 그 값이다
    if (shown && shown.key === key) shown = { key, state: read };
    if (shown) applyChatLimits(shown.state);
  }
  if (!next) return null;
  await risuai.setChatToIndex(charIndex, chatIndex, next);
  // 열려 있는 채팅을 저장했으면 쓰기가 된 뒤에 저장한 값을 그 채팅 값으로 삼는다 (쓰기가 실패하면 읽은 값 그대로)
  if (shown && shown.key === key) {
    shown = { key, state: next.scriptstate };
    applyChatLimits(shown.state);
  }
  return next;
}

// 플러그인이 로어북을 바꿨을 때 알림 (본체의 지침·등록부 캐시를 비운다. QC 2026-10-28: 세계·지침 편집 뒤에도 캐릭터를 바꿀 때까지 옛 규칙이 요청에 들어갔다)
const loreListeners = new Set<(charIndex: number) => void>();
export function onLoreSaved(f: (charIndex: number) => void): () => void {
  loreListeners.add(f);
  return () => loreListeners.delete(f);
}
export function notifyLoreSaved(charIndex: number): void {
  for (const f of loreListeners) f(charIndex);
}

/** 캐릭터 로어북을 바꾼다. 저장 직전에 최신 캐릭터를 다시 읽어 다른 곳의 변경을 덮어쓰지 않는다. */
export async function updateCharacterLore(charIndex: number, mutate: (lore: LoreEntry[]) => LoreEntry[] | null): Promise<boolean> {
  const latest = (await risuai.getCharacterFromIndex(charIndex)) as CharacterSnapshot | null;
  if (!latest) throw new Error('캐릭터를 찾을 수 없어요.');
  // 에셋용 사본은 고치는 쪽에 보이지 않게 떼어 두었다가 그대로 다시 붙인다
  const { rest, copy } = splitAssetCopy(stripVirtual(latest.globalLore ?? []));
  const next = mutate(rest);
  if (!next) return false;
  await risuai.setCharacterToIndex(charIndex, { ...latest, globalLore: [...splitAssetCopy(stripVirtual(next)).rest, ...copy] });
  notifyLoreSaved(charIndex);
  return true;
}

/** 에셋용 사본을 넣거나(지금 플러그인 자료로 새로 만든다) 뺀다. 다른 로어북은 건드리지 않는다. 카드에 남은 사본을 돌려준다 */
export async function setAssetCopy(charIndex: number, put: boolean): Promise<LoreEntry[]> {
  const latest = (await risuai.getCharacterFromIndex(charIndex)) as CharacterSnapshot | null;
  if (!latest) throw new Error('캐릭터를 찾을 수 없어요.');
  const { rest } = splitAssetCopy(stripVirtual(latest.globalLore ?? []));
  const copy = put ? makeAssetCopy(withWorldLore(rest)) : [];
  await risuai.setCharacterToIndex(charIndex, { ...latest, globalLore: [...rest, ...copy] });
  return copy;
}

/** 캐릭터 읽기 (로어북에 세계 데이터 가상 항목을 붙여서). 읽기 전용 — 저장은 updateCharacterLore 로 */
export async function getChar<T extends { globalLore?: LoreEntry[] } = CharacterSnapshot>(charIndex: number): Promise<T | null> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as T | null;
  if (char) char.globalLore = withWorldLore(char.globalLore);
  return char;
}
