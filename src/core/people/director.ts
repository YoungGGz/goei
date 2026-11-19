// Director (본편 앞). 사실형(facts)은 기록에서 사실·지식 한계만, 연출형(scene)은 거기에 이번 턴 반응 방향(react)을 더한다 — 둘 다 본편 앞 보조 1회 (원본 directorRole facts/directing).
// 메모형(note)은 호출 없이 갱신기가 뒤에서 next_note 로 써 둔 메모를 끼운다 (2026-11-07 전까지 「사실형」이라 불렀던 방식).
// 리수폿 B·C (2026-11-06 사용자 결정): 자료가 모자라면 검색을 요청해 2차 호출(need → found), 켜진 기능마다 Director 적용 지침을 얹는다.
import type { Chat, LoreEntry } from '../types';
import { messageText } from '../refs';
import { listDocs } from '../wiki';
import { addressOf, affinityView } from './affinity';
import { axesLinesEn } from './axes';
import { temperOf } from './base';
import { personBlock, unknownTo, suspicionShown } from './inject';
import { liveChanges, liveEntries, liveness, plain, hash } from './store';
import { rhythmClock, rhythmClockLines, rhythmNow } from './rhythm';
import { speechVarietyBlock } from './speech';
import { SEXUAL_POLICY, sexualAnyOn, sexualDirectorPolicy, sexualTexts } from './sexual';
import type { PeopleSettings } from './settings';
import { guideTxt } from '../guides';
import { SLOT_META, slotsFor, type PeopleStore, type SlotId } from './types';

/** 2026-11-07 (전수검사 2 의 E): 메모 상한 120 → 400자, 모르는 것 ≤8, 불확실한 점(uncertain) 추가 (원본 note ≤12,000 + uncertainties) */
export interface DirectorNote { who: string; now: string; react?: string; mustNot: string[]; uncertain?: string[] }
export const NOTE_CHARS = 400;
export type SearchKind = 'chat' | 'lore' | 'wiki';
export interface DirectorSearch { kind: SearchKind; query: string; reason: string }
export interface SearchHit { ref: string; text: string }
export interface SearchResult { kind: SearchKind; query: string; hits: SearchHit[] }
export const SEARCH_MAX = 4;

/** 기능별 Director 적용 지침 (리수폿 Director Application 요약)은 지침 「Director」 APPLY.<기능> 절. 켜진 기능만 이 차례로 */
const GUIDE_ORDER = ['axes', 'affinity', 'register', 'perception', 'perception_ext', 'suspicion', 'openness', 'rhythm'];

export interface DirectorInput { system: string; data: Record<string, unknown>; key: string; people: string[]; search: boolean }

/** 요청 자료. people 은 장면 인물(request.ts 가 고른 것) */
/** base = FACTS·SCENE 덮어쓰기(시험용). 없거나 비면 지침 「Director」 FACTS·SCENE 절 */
export function buildDirector(chat: Chat, store: PeopleStore, people: string[], input: string, s: PeopleSettings, values: Record<string, string>, memory: string[] = [], base: { facts?: string; scene?: string } = {}): DirectorInput | null {
  if (!people.length) return null;
  const live = liveness(chat);
  const changes = liveChanges(store, live);
  const list = Array.isArray(chat.message) ? chat.message : [];
  const recent = (s.recentMsgs > 0 ? list.slice(-s.recentMsgs) : []).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: messageText(String(m.data ?? '')).slice(0, 3000) }));
  const featureSlots = s.directorFeatures ? slotsFor(s.features, s.qualitative).filter((x) => SLOT_META[x].feature) : [];
  // 기록 전문(본편이 받는 인물 블록과 같은 글)을 `record` 로 준다 (2026-11-07 E: 꼬리 6개만 주던 것 → 전문). 인물 수로 예산을 나눈다
  const recordCap = Math.max(1500, Math.floor(s.blockCap / Math.max(1, people.length)));
  const tails: Record<string, { state: string[]; threads: string[] }> = {};
  const persons = people.map((n) => {
    const p = store.people[n];
    const slot = (k: 'state' | 'threads') => liveEntries(p.slots[k], live).map((e) => e.text).slice(-6);
    // 성격 계수(temper)도 본편·화면과 같이 넣는다 (전수검사 11-13)
    const aff = affinityView(p, changes, store.folded[n] ?? 0, { temper: temperOf(n), speed: s.speed, speedDown: s.speedDown, turnCap: s.turnCap });
    const slots: Record<string, { text: string; target?: string; kind?: string }[]> = {};
    for (const k of featureSlots) {
      // 기능 전용 칸은 여기(`slots`)에만 싣는다: `record` 에서는 같은 칸을 뺀다 (같은 글이 두 번 나가지 않게). 그래서 최근 몇 개가 아니라 살아 있는 항목 전부
      const all = liveEntries(p.slots[k as SlotId], live);
      const es = (k === 'suspicion' ? suspicionShown(all) : all).map((e) => ({ text: e.text, ...(e.target ? { target: e.target } : {}), ...(e.kind ? { kind: e.kind } : {}) }));
      if (es.length) slots[k] = es;
    }
    // record 의 글자 몫은 slots 에 실은 글자만큼 줄인다 (record 가 전용 칸을 싣던 때와 같은 총량: personBlock 과 같은 셈으로 항목당 글자 + 3)
    const slotChars = Object.values(slots).reduce((m, l) => m + l.reduce((k, e) => k + e.text.length + 3, 0), 0);
    // 꼬리(state·threads)는 재사용 열쇠 계산에만 쓴다. 자료(data)에는 `record` 전문이 같은 글을 싣고 있어 넣지 않는다 (11-14 재검토 gupdp#1)
    tails[n] = { state: slot('state'), threads: slot('threads') };
    return {
      name: n,
      values: values[n] ?? '',
      ...(s.qualitative.has('affinity') ? {} : { affinity: aff.stage.label }),
      address: addressOf(p, changes),
      express: p.express,
      ...(s.directorFeatures && s.features.has('axes') ? { axes: axesLinesEn(p.axes), ...(p.patterns?.length ? { patterns: p.patterns } : {}) } : {}),
      // 성적 욕망·이상성욕 (원본 director people_profile: text + policy sexual_context_only)
      ...(() => { const t = sexualTexts(p, s); return { ...(t.desire ? { sexual_desire: { text: t.desire, policy: SEXUAL_POLICY } } : {}), ...(t.paraphilia ? { paraphilia: { text: t.paraphilia, policy: SEXUAL_POLICY } } : {}) }; })(),
      record: personBlock(p, store, live, changes, { mode: 'record', unknown: [], speechMarks: true, temper: temperOf(n), speed: s.speed, speedDown: s.speedDown, turnCap: s.turnCap, maxChars: Math.max(1, recordCap - slotChars), taste: s.features.has('taste'), openness: s.features.has('openness'), axes: false, features: s.features, qual: s.qualitative, omitSlots: new Set(featureSlots) }),
      ...(Object.keys(slots).length ? { slots } : {}),
      unknown_to: unknownTo(p, store, live, s.unknownMax),
    };
  });
  const rhythm = s.directorFeatures && s.features.has('rhythm')
    ? rhythmNow(store, live).map((r) => ({ key: r.doc.key, text: r.entry.text }))
    : [];
  // 자료가 실린 기능 절만 붙인다 (11-14 재검토 gtoken#5): 의심 칸이 빈 장면·리듬 기록이 없는 채팅·성적 글이 없는 인물에게 그 절은 요청에 없는 자료를 설명한다
  const hasData: Record<string, boolean> = {
    suspicion: persons.some((p) => Object.keys(p.slots ?? {}).some((k) => SLOT_META[k as SlotId].feature === 'suspicion')),
    rhythm: rhythm.length > 0,
  };
  const hasSexual = persons.some((p) => 'sexual_desire' in p || 'paraphilia' in p);
  const guides = s.directorFeatures ? GUIDE_ORDER.filter((f) => (s.features as Set<string>).has(f) && hasData[f] !== false).flatMap((f) => ['', guideTxt('Director', `APPLY.${f.toUpperCase()}`), ...(f === 'register' && speechVarietyBlock(s, 'director') ? [speechVarietyBlock(s, 'director')] : []), ...(f === 'axes' && sexualAnyOn(s) && hasSexual ? [guideTxt('Director', 'APPLY.SEXUAL', { policy: sexualDirectorPolicy() })] : [])]) : [];
  // 기본 지침은 지침 탭 「Director」 FACTS·SCENE 절 (리수폿 J-1). base 는 시험용 덮어쓰기
  const facts = base.facts?.trim() || guideTxt('Director', 'FACTS');
  const scene = base.scene?.trim() || guideTxt('Director', 'SCENE');
  const system = [facts, ...(s.director === 'scene' ? [scene] : []), ...guides, '', ...(s.directorSearch ? [guideTxt('Director', 'SEARCH', { max: SEARCH_MAX })] : []), guideTxt('Director', 'OUTPUT'), s.directorRules.trim() ? `${guideTxt('Director', 'USER_RULES.HEAD')}\n${s.directorRules.trim()}` : '']
    .join('\n')
    .replace('{{LANG}}', () => guideTxt('Director', s.directorLang === 'ko' ? 'LANG.KO' : 'LANG.EN'))
    .replace('{{LINES}}', s.directorLen === 'normal' ? '3' : '1');
  const data = { people: persons, ...(rhythm.length ? { rhythm, rhythm_clock: rhythmClockLines(rhythmClock(store, chat, live)) } : {}), ...(memory.length ? { memory } : {}), recent, input: input.slice(0, 4000) };
  // 최근 글도 열쇠에 넣는다: 같은 입력을 두 번 보내도 장면이 나아갔으면 다시 묻는다. 리롤은 최근 글이 같아 그대로 재사용 (전수검사 11-13)
  const key = hash(JSON.stringify({ people: persons.map((p) => [p.name, p.affinity, tails[p.name].state, tails[p.name].threads, p.unknown_to, p.slots]), input, recent: recent.map((r) => r.text.slice(0, 400)) }));
  return { system, data, key, people, search: s.directorSearch };
}

/** 출력 검증 실패 뒤 고침 요청 (원본 repairDirectorPrompt): 같은 지침 + 오류·이전 답을 붙여 1회 더 */
export function repairDirector(built: DirectorInput, invalid: string, error: string): DirectorInput {
  // 글은 지침 「Director」 REPAIR 절
  const fix = guideTxt('Director', 'REPAIR', { error: plain(error, 200) });
  return { ...built, system: `${built.system}\n\n${fix}`, data: { ...built.data, invalid_previous_response: invalid.slice(0, 6000) } };
}

/** 2차 호출 자료: 같은 지침 + 「2차」 안내 + found */
export function buildDirectorPass2(built: DirectorInput, found: SearchResult[]): DirectorInput {
  return { ...built, system: `${built.system}\n\n${guideTxt('Director', 'PASS2')}`, data: { ...built.data, found }, search: false };
}

function jsonOf(raw: string): Record<string, unknown> {
  let t = raw.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  // 검증 오류 글은 고침 요청(REPAIR 절의 {error})과 진단 화면에 같이 간다: 지침 「Director」 ERR.* 절
  if (a < 0 || b <= a) throw new Error(guideTxt('Director', 'ERR.NO_JSON'));
  return JSON.parse(t.slice(a, b + 1)) as Record<string, unknown>;
}

const KINDS: SearchKind[] = ['chat', 'lore', 'wiki'];
/** 응답 → 메모 또는 검색 요청. allowSearch=false 면 need 는 오류 */
export function parseDirectorAny(raw: string, people: string[], scene: boolean, allowSearch: boolean): { notes: DirectorNote[] } | { need: DirectorSearch[] } {
  const v = jsonOf(raw);
  // 빈 need 는 없는 것으로 친다. need 와 notes 가 같이 오면 2차·검색 요청이 비었을 때 notes 를 쓴다 (전수검사 11-13)
  const hasNotes = Array.isArray(v.notes);
  if (Array.isArray(v.need) && v.need.length && !(hasNotes && !allowSearch)) {
    if (!allowSearch) throw new Error(guideTxt('Director', 'ERR.SEARCH_IN_PASS2'));
    const need: DirectorSearch[] = [];
    for (const x of v.need as Record<string, unknown>[]) {
      const kind = KINDS.includes(x?.kind as SearchKind) ? (x.kind as SearchKind) : null;
      const query = plain(x?.query, 60);
      if (!kind || !query || need.some((n) => n.kind === kind && n.query === query)) continue;
      need.push({ kind, query, reason: plain(x?.reason, 60) });
      if (need.length >= SEARCH_MAX) break;
    }
    if (need.length) return { need };
    if (!hasNotes) throw new Error(guideTxt('Director', 'ERR.EMPTY_NEED'));
  }
  if (!Array.isArray(v.notes)) throw new Error(guideTxt('Director', 'ERR.NO_NOTES'));
  const out: DirectorNote[] = [];
  for (const n of v.notes as Record<string, unknown>[]) {
    const who = typeof n?.who === 'string' ? n.who : '';
    if (!people.includes(who)) continue;
    const now = plain(n.now, NOTE_CHARS);
    const react = scene ? plain(n.react, NOTE_CHARS) : '';
    const mustNot = Array.isArray(n.must_not_reveal) ? n.must_not_reveal.map((x) => plain(x, 120)).filter(Boolean).slice(0, 8) : [];
    const uncertain = Array.isArray(n.uncertain) ? n.uncertain.map((x) => plain(x, 160)).filter(Boolean).slice(0, 3) : [];
    if (!now && !react && !mustNot.length) continue;
    out.push({ who, now, ...(react ? { react } : {}), mustNot, ...(uncertain.length ? { uncertain } : {}) });
  }
  return { notes: out };
}

/** 응답 → 메모. 장면 인물만, 길이 제한, 템플릿 기호 제거 (검색 요청은 오류) */
export function parseDirector(raw: string, people: string[], scene: boolean): DirectorNote[] {
  const r = parseDirectorAny(raw, people, scene, false);
  return 'notes' in r ? r.notes : [];
}

const norm = (t: string) => String(t ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
const excerpt = (text: string, q: string, span = 200): string => {
  const i = norm(text).indexOf(q);
  if (i < 0) return text.slice(0, span * 2);
  const a = Math.max(0, i - span);
  return `${a ? '…' : ''}${text.slice(a, i + q.length + span)}${i + q.length + span < text.length ? '…' : ''}`;
};

/** 검색 실행 (코드, 모델 호출 없음): 채팅은 글에 그 말이 있는 메시지(최근 것부터 3개), 로어북은 이름·키·본문, 위키는 제목·본문 */
export function runSearches(searches: DirectorSearch[], src: { chat: Chat; lore?: unknown }, perKind = 3): SearchResult[] {
  const list = Array.isArray(src.chat.message) ? src.chat.message : [];
  const lore = Array.isArray(src.lore) ? (src.lore as LoreEntry[]) : [];
  return searches.slice(0, SEARCH_MAX).map((s) => {
    const q = norm(s.query);
    const hits: SearchHit[] = [];
    if (s.kind === 'chat') {
      for (let i = list.length - 2; i >= 0 && hits.length < perKind; i--) {
        const text = messageText(String(list[i].data ?? ''));
        if (norm(text).includes(q)) hits.push({ ref: `m#${i + 1}`, text: excerpt(text, q) });
      }
      hits.reverse();
    } else if (s.kind === 'lore') {
      for (const e of lore) {
        if (hits.length >= perKind) break;
        const name = String(e.comment ?? '');
        const keys = String(e.key ?? '');
        const content = String(e.content ?? '');
        if (!content.trim()) continue;
        if (norm(name).includes(q) || norm(keys).includes(q) || norm(content).includes(q)) hits.push({ ref: `lore:${name || keys || '?'}`.slice(0, 60), text: norm(content).includes(q) ? excerpt(content, q, 300) : content.slice(0, 600) });
      }
    } else {
      for (const d of listDocs(src.chat, src.lore)) {
        if (hits.length >= perKind) break;
        if (norm(d.title).includes(q) || norm(d.body).includes(q)) hits.push({ ref: `wiki:${d.title}`.slice(0, 60), text: norm(d.body).includes(q) ? excerpt(d.body, q, 300) : d.body.slice(0, 600) });
      }
    }
    return { kind: s.kind, query: s.query, hits };
  });
}

/** 본편에 넣는 글. 머리·줄 꼴은 지침 「Director」 MAIN_NOTE.* 절 */
export function directorBlock(notes: DirectorNote[], user: string): string {
  if (!notes.length) return '';
  const lines = notes.map((n) => [guideTxt('Director', 'MAIN_NOTE.ITEM', { who: n.who, now: n.now }), n.react ? `  ${guideTxt('Director', 'MAIN_NOTE.REACT', { react: n.react })}` : '', ...n.mustNot.map((m) => `  ${guideTxt('Director', 'MAIN_NOTE.MUST_NOT', { text: m })}`), ...(n.uncertain ?? []).map((u) => `  ${guideTxt('Director', 'MAIN_NOTE.UNCERTAIN', { text: u })}`)].filter(Boolean).join('\n'));
  // 머리말은 지침 「Director」 MAIN_NOTE 절. 지식 경계 규칙은 같이 들어가는 인물 기록 머리말(PEOPLE.RULE)에만 (전수검사 11-13 가-13, 사용자 승인)
  const head = guideTxt('Director', 'MAIN_NOTE', { user });
  return `${guideTxt('Director', 'MAIN_NOTE.HEAD')}\n${head}\n${lines.join('\n')}`;
}

/** 화면 「지침 편집」용 기본 지침 원문 (연출형 기준) */
