// 성적 욕망·이상성욕 (리수폿 원본 sexualDesire·paraphilia·explicitSexualStyle 이식, 2026-11-07 사용자 지시 「성적 축은 왜 안넣어」).
// 원본 구조 그대로: 인물마다 글 기록 두 개(≤700자), 전체 설정 3개(성적 욕망 기록·이상성욕 기록·발정모드) + 인물별 켬/끔·발정 버전 덮어쓰기.
//   - 처음 글은 갱신기가 `sexual_init` 으로 한 번 쓴다 (성격 6축 시작값과 같은 자리). 비어 있는 인물만.
//   - 그 뒤엔 직접 고쳐 쓰지 못한다: `observations` 의 축 `sexual_desire|paraphilia`, 방향 `replace`, pattern = 바꿀 전체 글.
//     코드가 모아 관찰 6개·장면 4개·확신 75 이상이면 검토로 띄우고, 사용자가 승인하면 글이 바뀐다 (원본 applyPeopleOperations 의 sexualAxis).
//   - 본편·Director 에는 `sexual_context_only` 정책과 함께 넘긴다: 일상 대화·일·데이트·추파·손잡기·포옹·가벼운 입맞춤에선 쓰지 않는다.
//   - 어휘: 발정 버전이면 원본 0.10.9 (노골적 한국어 비속어 필수), 아니면 0.10.7 (직설적이되 강한 어휘를 강요하지 않음).
import type { PeopleSettings } from './settings';
import type { Person, SexualAxis, SexualField, SexualProfile, SexualRecord } from './types';
import { SEXUAL_CHARS } from './types';
import { plain } from './store';
import { guideTxt } from '../guides';

export const SEXUAL_FIELDS: SexualField[] = ['desire', 'paraphilia'];
export const SEXUAL_AXIS_OF: Record<SexualField, SexualAxis> = { desire: 'sexual_desire', paraphilia: 'paraphilia' };
export const SEXUAL_FIELD_OF: Record<SexualAxis, SexualField> = { sexual_desire: 'desire', paraphilia: 'paraphilia' };
export const SEXUAL_LABEL: Record<SexualField, string> = { desire: '성적 욕망', paraphilia: '이상성욕' };
export const isSexualAxis = (v: unknown): v is SexualAxis => v === 'sexual_desire' || v === 'paraphilia';

export const emptySexualRecord = (): SexualRecord => ({ text: '', at: '' });
export const emptySexual = (): SexualProfile => ({ desire: emptySexualRecord(), paraphilia: emptySexualRecord(), desireOn: true, paraphiliaOn: true, explicit: null });
export function ensureSexual(p: Person): SexualProfile {
  if (!p.sexual) p.sexual = emptySexual();
  return p.sexual;
}

type Flags = Pick<PeopleSettings, 'features' | 'sexualDesire' | 'paraphilia' | 'explicitStyle'>;
/** 전체 설정에서 켠 칸 (성격 6축 기능이 꺼지면 둘 다 꺼짐 — 원본도 People profile 안의 칸) */
export const sexualGlobal = (s: Flags): Record<SexualField, boolean> => ({ desire: s.features.has('axes') && s.sexualDesire, paraphilia: s.features.has('axes') && s.paraphilia });
export const sexualAnyOn = (s: Flags): boolean => { const g = sexualGlobal(s); return g.desire || g.paraphilia; };
/** 이 인물에서 이 칸을 쓰는가 (전체 켬 + 인물 켬). 원본 peopleSexualFieldEnabled */
export const sexualFieldOn = (p: Person, field: SexualField, s: Flags): boolean => sexualGlobal(s)[field] && (p.sexual?.[field === 'desire' ? 'desireOn' : 'paraphiliaOn'] ?? true);
/** 발정 버전: 인물 덮어쓰기(true/false) 가 있으면 그것, 없으면 전체 설정. 원본 peopleExplicitStyleEnabled */
export const explicitOn = (p: Person, s: Flags): boolean => (p.sexual?.explicit === true ? true : p.sexual?.explicit === false ? false : s.explicitStyle);
/** 본편·Director 에 넘길 글 (켜져 있고 글이 있을 때만) */
export function sexualTexts(p: Person, s: Flags): Partial<Record<SexualField, string>> {
  const out: Partial<Record<SexualField, string>> = {};
  for (const f of SEXUAL_FIELDS) { const t = p.sexual?.[f]?.text?.trim(); if (t && sexualFieldOn(p, f, s)) out[f] = t; }
  return out;
}
/** 사용자·갱신기가 글을 둔다 (≤700자). 비면 지움 */
export function setSexualText(p: Person, field: SexualField, text: string, at: string, manual: boolean): void {
  const sx = ensureSexual(p);
  const t = plain(text, SEXUAL_CHARS);
  sx[field] = t ? { text: t, at, ...(manual ? { manual: true } : {}) } : emptySexualRecord();
}

// ── 지침 (원본 글: base.writer.txt 6A 의 성적 항목 4줄 + peopleSexualPromptRules + people_profile_policy) ──
export const SEXUAL_POLICY = 'sexual_context_only';
/** 글은 지침 절에서 읽는다 (설정 → 지침): SEXUAL.POLICY 는 「메인 요청에 붙는 글」, 나머지는 「인물 기록 갱신기(덧붙임)」 */
/** Director·본편 정책 한 줄 (원본 people_profile_policy 의 성적 부분) */
export const sexualDirectorPolicy = (): string => guideTxt('Main', 'SEXUAL.POLICY');
const contextRule = (): string => guideTxt('UpdaterExtra', 'SEXUAL.CONTEXT_RULE');
const explicitStyle = (): string => guideTxt('UpdaterExtra', 'SEXUAL.EXPLICIT_STYLE');
const plainStyle = (): string => guideTxt('UpdaterExtra', 'SEXUAL.PLAIN_STYLE');
/** 원본 peopleSexualPromptRules. 말씨 규칙은 인물별 문장(SEXUAL.WRITER 의 plain_false·explicit_true)에만 (전수검사 11-13 가-3, 사용자 승인) */
export function sexualPromptRules(_explicit?: boolean): string {
  return guideTxt('UpdaterExtra', 'SEXUAL.PROMPT_RULES');
}

/** 갱신기 지침 절 (설정에 따라 조립; 원본 6A 의 4줄 + 어휘 규칙). 둘 다 꺼져 있으면 '' */
export function sexualWriterSection(s: Flags): string {
  const g = sexualGlobal(s);
  if (!g.desire && !g.paraphilia) return '';
  const fields = [g.desire ? '`sexual_desire`' : '', g.paraphilia ? '`paraphilia`' : ''].filter(Boolean).join(' and ');
  const initDesire = g.desire ? `${guideTxt('UpdaterExtra', 'SEXUAL.INIT_DESIRE')} ` : '';
  const initParaphilia = g.paraphilia ? `${guideTxt('UpdaterExtra', 'SEXUAL.INIT_PARAPHILIA')} ` : '';
  // 지침의 첫 구절을 고쳐도 「거짓일 때」 조건이 빠지지 않게 (전수검사 11-13). 찾을 구절·바꿀 구절·머리는 SEXUAL.PLAIN_FALSE.*·SEXUAL.EXPLICIT_TRUE.* 절
  const plain0 = plainStyle();
  const plainFind = guideTxt('UpdaterExtra', 'SEXUAL.PLAIN_FALSE.FIND');
  const plainFalse = /^when false\b/i.test(plain0) ? plain0 : plain0.includes(plainFind) ? plain0.replace(plainFind, () => guideTxt('UpdaterExtra', 'SEXUAL.PLAIN_FALSE.REPLACE')) : `${guideTxt('UpdaterExtra', 'SEXUAL.PLAIN_FALSE.PREFIX')} ${plain0}`;
  const explicit0 = explicitStyle();
  const explicitFind = guideTxt('UpdaterExtra', 'SEXUAL.EXPLICIT_TRUE.FIND');
  const explicitTrue = explicit0.startsWith(explicitFind) ? explicit0.replace(explicitFind, () => guideTxt('UpdaterExtra', 'SEXUAL.EXPLICIT_TRUE.REPLACE')) : explicit0;
  const axis = `${g.desire ? '`sexual_desire`' : ''}${g.desire && g.paraphilia ? ' or ' : ''}${g.paraphilia ? '`paraphilia`' : ''}`;
  return guideTxt('UpdaterExtra', 'SEXUAL.WRITER', { fields, init_desire: initDesire, init_paraphilia: initParaphilia, plain_false: plainFalse, explicit_true: explicitTrue, axis, context_rule: contextRule(), prompt_rules: sexualPromptRules(s.explicitStyle) });
}
