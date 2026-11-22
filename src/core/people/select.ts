// 장면 인물 고르기 (리수폿 Router 를 코드로): 최근 글에 이름·별명이 나온 인물 + 상태창 동행 칸. 모델은 부르지 않는다.
// 이름 찾기는 로어북 고르기와 같은 한국어 경계 규칙(core/lore.ts keyRegex). 겹치는 호칭(「부장」)은 후보가 하나일 때만.
import type { Chat } from '../types';
import { messageText } from '../refs';
import { keyRegex, nameEndsAt } from '../lore';
import { findStatusTags } from '../world/status';
import { messageHash, messageKey } from './store';
import type { PeopleStore } from './types';
import { PP_DEFAULTS } from './settings';

export interface NameEntry {
  name: string;
  aliases: string[];
  /** 여러 사람에게 겹칠 수 있는 호칭 */
  titles: string[];
}

const isEnglish = (s: string) => /^[A-Za-z][A-Za-z0-9 .'-]*$/.test(s);

/** 글에서 이름을 찾는 함수. titles 는 그 호칭을 가진 사람이 하나뿐일 때만 그 사람으로 본다 */
export function nameMatcher(entries: NameEntry[]): (text: string) => string[] {
  const pats: { name: string; re: RegExp; en: boolean }[] = [];
  const titleOwners = new Map<string, Set<string>>();
  for (const e of entries) for (const t of e.titles) (titleOwners.get(t) ?? titleOwners.set(t, new Set()).get(t)!).add(e.name);
  for (const e of entries) {
    const keys = [e.name, ...e.aliases, ...e.titles.filter((t) => titleOwners.get(t)?.size === 1)];
    for (const k of keys) {
      const en = isEnglish(k);
      const re = keyRegex(k, en, true);
      if (re) pats.push({ name: e.name, re, en });
    }
  }
  return (text: string) => {
    const found = new Set<string>();
    for (const p of pats) {
      if (found.has(p.name)) continue;
      // 한국어 열쇠는 뒤 경계도 본다 (keyRegex 는 앞만 본다): 「탐미주의적」「여자친구」는 그 사람이 아니다. 영어 열쇠는 식이 앞뒤를 다 본다
      for (const m of text.matchAll(p.re)) {
        if (p.en || nameEndsAt(text, (m.index ?? 0) + m[0].length)) {
          found.add(p.name);
          break;
        }
      }
    }
    return [...found];
  };
}

export interface SceneOpts {
  /** 최근 몇 마디를 볼지 (기본 2: 마지막 유저 입력과 마지막 응답) */
  recent?: number;
  max?: number;
  /** 지금 쓰려는 유저 입력 (아직 채팅에 없을 때) */
  input?: string;
  /** 장면에 남아 있는 인물 (carriedScene). 글에 나온 사람·동행 칸 뒤에 넣는다 */
  carry?: string[];
}

/** 장면 인물: 기록이 있는 사람 중 최근 글에 나온 사람 + 동행 칸. 나온 순서 (최근 글 먼저) */
export function scenePeople(chat: Chat, store: PeopleStore, match: (text: string) => string[], o: SceneOpts = {}): string[] {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const recent = list.slice(-(o.recent ?? 2)).reverse().map((m) => messageText(String(m.data ?? '')));
  if (o.input) recent.unshift(o.input);
  const out: string[] = [];
  const push = (n: string) => {
    if (store.people[n] && !out.includes(n)) out.push(n);
  };
  for (const t of recent) for (const n of match(t)) push(n);
  // 상태창 동행 칸 (마지막 응답)
  const lastBot = [...list].reverse().find((m) => m.role === 'char');
  if (lastBot) {
    const tags = findStatusTags(String(lastBot.data ?? ''));
    for (const c of tags.at(-1)?.companions ?? []) for (const n of match(c)) push(n);
  }
  return out.slice(0, o.max ?? Number(PP_DEFAULTS.scene_max));
}

/** 장면에 남아 있는 인물 (설정 「장면 인물 유지」): before 앞의 마지막 응답에 갱신기가 적어 둔 이름 가운데 기록이 있는 사람.
 *  before 가 없으면 채팅의 마지막 응답. 그 응답의 읽음 해시가 지금 내용과 같을 때만 쓴다
 *  (다시 굴리거나 고친 응답, 갱신기가 아직 읽지 않은 응답이면 빈 목록 → 글에 나온 이름만으로 고른다) */
export function carriedScene(store: PeopleStore, chat: Chat, before?: number): string[] {
  const list = Array.isArray(chat.message) ? chat.message : [];
  for (let i = Math.min(before ?? list.length, list.length) - 1; i >= 0; i--) {
    if (list[i].role !== 'char') continue;
    const key = messageKey(list[i], i);
    if (store.read[key] !== messageHash(list[i])) return [];
    return (store.scene?.[key] ?? []).filter((n) => !!store.people[n]);
  }
  return [];
}

/** 기록에 있는 사람들로 이름 표를 만든다 (relations-base aliases 와 합쳐 쓴다) */
export function entriesOf(store: PeopleStore, extra: Record<string, { aliases?: string[]; titles?: string[] }> = {}): NameEntry[] {
  return Object.values(store.people).map((p) => ({
    name: p.name,
    aliases: [...new Set([...p.aliases, ...(extra[p.name]?.aliases ?? [])])],
    titles: extra[p.name]?.titles ?? [],
  }));
}

/** 갱신기용 이름 표: 미리 만든 표(table, base.ts allNames) 전체 + 표에 없는 기록의 인물. 기록이 있는 사람은 기록의 별명도 열쇠가 된다.
 *  표만 쓰면 갱신기가 등록한 표 밖 인물(이름 없는 인물 포함)이 글에 나와도 다음 갱신의 장면 인물로 잡히지 않는다 */
export function namesWith(store: PeopleStore, table: NameEntry[]): NameEntry[] {
  const inTable = new Set(table.map((e) => e.name));
  return [
    ...table.map((e) => (store.people[e.name] ? { ...e, aliases: [...new Set([...store.people[e.name].aliases, ...e.aliases])] } : e)),
    ...Object.values(store.people).filter((p) => !inTable.has(p.name)).map((p) => ({ name: p.name, aliases: [...p.aliases], titles: [] })),
  ];
}
