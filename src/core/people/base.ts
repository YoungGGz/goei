// 미리 만든 자료 (src/data/people/relations-base.json · aliases.json): 인물별 가치관·표현 정도·성격 계수·호감 시작값·별명.
// 개발 때 위키·시트를 읽어 만들고 사용자가 검수한다. 실행 중 모델 호출 없음.
import relationsBase from '../../data/people/relations-base.json';
import aliasesBase from '../../data/people/aliases.json';
import addressBase from '../../data/people/address.json';
import type { NameEntry } from './select';
import type { SeedBase } from './seed';
import { relativeRank } from './identity';
import { REGISTERS, type Identity, type Register, type Temper } from './types';
import { placeholderOrgs, relationStage, STAGE_VALUE } from '../world/records';

interface BasePerson { faction: string; values: string; express: 0 | 1 | 2 | 3; temper: Temper; english: string[] }
interface RelationsBase { version: number; people: Record<string, BasePerson>; pairs: Record<string, { aff: number; src: string }>; orgs: Record<string, number> }
interface AliasesBase { version: number; names: Record<string, { aliases: string[]; titles: string[] }>; ambiguous: Record<string, string[]> }
/** 호칭 표 (address.json): 그 인물의 직급 단계, 말투, 자기 호칭, 유저가 상급·동급·하급·외부인일 때 부르는 말 */
interface AddressRow { level: number | null; register: string; self: string; up: string; peer: string; down: string; outsider: string }
interface AddressBase { version: number; names: Record<string, AddressRow> }

export const RELATIONS: RelationsBase = relationsBase as RelationsBase;
export const ALIASES: AliasesBase = aliasesBase as AliasesBase;
export const ADDRESS: AddressBase = addressBase as AddressBase;

/** 유저 신분(상태창)에 따른 시작 호칭. 표에 없는 인물은 undefined (갱신기가 채움) */
export function seedAddress(name: string, faction: string, user: Identity | undefined): { toUser: string; register: Register } | undefined {
  const row = ADDRESS.names[name];
  if (!row) return undefined;
  const rel = relativeRank(user, faction, row.level);
  const register = REGISTERS.includes(row.register as Register) ? (row.register as Register) : '존댓말';
  return { toUser: row[rel] || row.outsider || '', register };
}

/** 명부의 요원 한 줄에서 인물 기록이 쓰는 칸 (host/people.ts rosterOf 가 명부를 읽어 넘긴다. 여기서는 명부를 읽지 않는다) */
export interface RosterRow {
  name: string;
  english: string;
  legacyEnglish: string[];
  /** 명부 별칭. 흔한 낱말이 섞여 있어 글에서 찾는 열쇠로는 쓰지 않고 갱신기 자료(roster)로만 보낸다 */
  aliases: string[];
  /** A00~E00 또는 조직 이름 */
  affiliation: string;
  rank: string;
  department: string;
}

/** 명부 줄에서 글에서 찾는 열쇠가 되는 영문 표기 (지금 표기 + 옛 표기) */
const rosterEnglish = (row: RosterRow): string[] => [row.english, ...row.legacyEnglish].map((x) => x.trim()).filter(Boolean);

/** 처음 등장한 인물의 시작값 한 벌: 소속·표현 정도·호감 시작값·별명·호칭.
 *  미리 만든 자료(relations-base)에 없는 명부 인물은 명부 줄(row)의 소속·영문 표기를 쓴다. 자리 조직(「미분류」)은 소속 없음 */
export function seedBaseFor(name: string, userFaction: string, user: Identity | undefined, row?: RosterRow): SeedBase {
  const b = RELATIONS.people[name];
  const fromRow = !b && row ? row : undefined;
  const faction = b?.faction ?? (fromRow && !placeholderOrgs().has(fromRow.affiliation) ? fromRow.affiliation : '');
  const alias = ALIASES.names[name];
  const address = seedAddress(name, faction, user);
  return {
    faction,
    ...(b ? { express: b.express } : {}),
    affinityBase: userAffinityBase(faction, userFaction),
    aliases: [...new Set([...(alias?.aliases ?? []), ...(b?.english ?? []), ...(fromRow ? rosterEnglish(fromRow) : [])])],
    ...(address ? { address } : {}),
  };
}

export const basePerson = (name: string): BasePerson | undefined => RELATIONS.people[name];
export const valuesOf = (name: string): string => RELATIONS.people[name]?.values ?? '';
export const temperOf = (name: string): Temper | undefined => RELATIONS.people[name]?.temper;

/** 인물 조직 → 유저 조직 시작값: 세력 관계 격자의 단계(사용자 2026-10-27: 격자 값이 평판 시작값). 같은 조직이면 0 */
export function userAffinityBase(personFaction: string, userFaction: string): number {
  if (!personFaction || !userFaction || personFaction === userFaction) return 0;
  return STAGE_VALUE[relationStage(personFaction, userFaction)];
}

/** 세력 → 유저 소속 시작값 (같은 표). 세력 평판 시작값 */
export const factionBase = (code: string, userFaction: string): number => userAffinityBase(code, userFaction);

/** 인물 → 인물 시작값 (위키 근거 쌍). 없으면 0 */
export const pairBase = (from: string, to: string): number => RELATIONS.pairs[`${from}>${to}`]?.aff ?? 0;

/** 이름 표: 미리 만든 별명·호칭 (기록에 있는 사람 + 아직 등장 전 사람 전부) ∪ 명부(roster)의 요원.
 *  명부 줄은 이름·영문 표기·옛 영문 표기만 열쇠가 된다. 초상 태그 <img=영문_표정> 도 영문 표기로 걸린다 (messageText 는 태그를 남긴다) */
export function allNames(roster: RosterRow[] = []): NameEntry[] {
  const out = new Map<string, NameEntry>(Object.entries(ALIASES.names).map(([name, v]) => [name, { name, aliases: [...new Set([...(v.aliases ?? []), ...(RELATIONS.people[name]?.english ?? [])])], titles: v.titles ?? [] }]));
  for (const row of roster) {
    if (!row.name) continue;
    const cur = out.get(row.name);
    if (cur) cur.aliases = [...new Set([...cur.aliases, ...rosterEnglish(row)])];
    else out.set(row.name, { name: row.name, aliases: [...new Set(rosterEnglish(row))], titles: [] });
  }
  return [...out.values()];
}
export const extraNames = (roster: RosterRow[] = []): Record<string, { aliases?: string[]; titles?: string[] }> => Object.fromEntries(allNames(roster).map((e) => [e.name, { aliases: e.aliases, titles: e.titles }]));
