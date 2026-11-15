// 보조 호출 로어북 「Risu와 같게」 (2026-11-15 사용자): 괴담넷·괴담톡·위키·상점 요청의 참고 자료에
// 플러그인이 아는 틀(명부·세계 자료) 밖의 로어북도 본편처럼 넣는다. 대상은 카드에 사용자가 넣은 항목, 채팅 로어북, 켜진 모듈의 로어북.
// 고르는 규칙은 Risu 와 같다: 「항상 활성화」는 늘, 그 밖에는 활성화 키가 글에 나올 때 (선택적이면 보조 키도, 정규식 키는 정규식으로).
// 플러그인 세계 자료(가상 항목)와 네 폴더 항목은 여기서 다루지 않는다 — 지금 방식(상시 로어북·관련 로어북)이 그대로 고른다.
import { DONT_ACTIVATE, LORE_KINDS, SLOTS, managedEntries, stripDecorators } from './lore';
import type { LoreEntry } from './types';
import { isVirtual } from './world/virtual';

/** 설정 → 로어북 호출 「보조 호출 로어북」 (core/advanced.ts gen.aux_lore) */
export const AUX_LORE_VAR = '$gen_aux_lore';
export const auxLoreRisu = (state: Record<string, unknown> | undefined): boolean => state?.[AUX_LORE_VAR] === 'risu';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
// lore.ts 와 서로 불러오므로(lore → refs → 여기) 모듈을 읽는 때에는 lore.ts 의 값을 쓰지 않는다. 부를 때 만든다
/** 본문 앞 장식 줄에 @@dont_activate 가 있으면 Risu 는 켜지 않는다 */
function dontActivate(content: string): boolean {
  for (const line of content.split('\n')) {
    if (!/^\s*@@/.test(line)) return false;
    if (line.trim() === DONT_ACTIVATE) return true;
  }
  return false;
}

export interface OutsideEntry {
  /** 참고 자료에 적을 출처 이름 (로어북 이름, 없으면 첫 키) */
  name: string;
  /** 장식 줄을 뗀 본문 (CBS 는 부르는 쪽이 푼다) */
  content: string;
  always: boolean;
  keys: string[];
  /** 선택적일 때 함께 나와야 하는 보조 키 (비면 조건 없음) */
  second: string[];
  regex: boolean;
}

export interface OutsideSources {
  /** 카드 로어북 (가상 항목이 붙어 있어도 된다) */
  card?: LoreEntry[];
  /** 채팅 로어북 */
  local?: LoreEntry[];
  /** 켜진 모듈의 로어북 (host/risu.ts 가 읽어 둔다) */
  modules?: LoreEntry[];
}

const split = (v: unknown) => str(v).split(',').map((k) => k.trim()).filter(Boolean);

/** 플러그인 틀 밖의 로어북 항목. usable = 참고 자료로 써도 되는 항목인지 (core/refs.ts allowedBook: 내부 로어북·위키 문서 등을 뺀다) */
export function outsideEntries(src: OutsideSources, usable: (e: LoreEntry) => boolean): OutsideEntry[] {
  const card = src.card ?? [];
  const managed = new Set(managedEntries(card).map((e) => e.index));
  const slots = new Set(LORE_KINDS.map((k) => SLOTS[k].comment));
  const rows: LoreEntry[] = [
    ...card.filter((e, i) => !managed.has(i) && !isVirtual(e) && !slots.has(str(e.comment))),
    ...(src.local ?? []),
    ...(src.modules ?? []),
  ];
  const out: OutsideEntry[] = [];
  for (const e of rows) {
    if (!e || typeof e !== 'object' || e.mode === 'folder') continue;
    const raw = str(e.content);
    if (!raw.trim() || dontActivate(raw)) continue;
    const keys = split(e.key);
    const name = str(e.comment).trim() || keys[0] || '';
    if (!name || !usable({ ...e, comment: name })) continue;
    const always = e.alwaysActive === true;
    if (!always && !keys.length) continue;
    out.push({ name, content: stripDecorators(raw), always, keys, second: e.selective === true ? split(e.secondkey) : [], regex: e.useRegex === true });
  }
  return out;
}

/** 정규식 키: /식/깃발 꼴 (Risu 와 같다). 꼴이 아니거나 잘못된 식이면 안 맞은 것으로 */
function regexHit(key: string, text: string): boolean {
  const m = /^\/(.+)\/([a-z]*)$/s.exec(key);
  if (!m) return false;
  try {
    return new RegExp(m[1], m[2]).test(text);
  } catch {
    return false;
  }
}

/** 활성화 키가 글에 나온 항목 (항상 활성화 항목은 빼고). Risu 처럼 소문자로, 띄어쓰기를 지우고 포함 검사 */
export function keyedHits(entries: OutsideEntry[], text: string): OutsideEntry[] {
  if (!text.trim()) return [];
  const flat = squash(text);
  const has = (k: string, regex: boolean) => (regex ? regexHit(k, text) : !!squash(k) && flat.includes(squash(k)));
  return entries.filter((e) => !e.always && e.keys.some((k) => has(k, e.regex)) && (!e.second.length || e.second.some((k) => has(k, false))));
}
