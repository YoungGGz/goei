// 본편 요청에 넣는 인물 기록 블록 (리수폿 Director 의 사실 전달을 코드로). 모델이 쓴 인용·숫자는 넣지 않는다.
// 절 단위 혼합: 시트의 고정 절(Voice·Background·Abilities·Appearance)은 원문, 나머지는 기록.
import { addressOf, affinityView, opennessOf, tasteOf, type AffinityOpts } from './affinity';
import { liveEntries, plain, type Liveness } from './store';
import { fixedSections, seedTexts } from './seed';
import { norm } from './store';
import { OPENNESS_MAX, OPENNESS_STAGES, REGISTERS, SEXUAL_CHARS, STAGES, opennessStage, slotsFor, type Change, type OpennessStage, type Stage, type Entry, type PeopleStore, type Person, type SlotId } from './types';
import { axesLinesEn, liveEvidence } from './axes';
import { SEXUAL_POLICY, isSexualAxis, sexualDirectorPolicy } from './sexual';
import { guideTxt } from '../guides';
import { SPEECH_ENTRY_CHARS, parseSpeechMarker } from './speech';

/* 모델에 가는 글(머리·칸 이름표·꼬리 글·단계별 행동 글)은 전부 지침 「메인 요청에 붙는 글」(Main) 절에서 읽는다. 코드에는 글을 두지 않는다 (2026-11-14 사용자).
   단계 이름(한국어)·경계값은 types.ts 표에 그대로 */
const main = (section: string, vars?: Record<string, string | number>): string => guideTxt('Main', section, vars);
const expressTail = (n: 0 | 1 | 2 | 3): string => main(`PEOPLE.EXPRESS_${n}`);
const stageBehavior = (st: Stage): string => main(`PEOPLE.AFFINITY.${STAGES.indexOf(st)}`);
const tasteText = (band: number): string => main(`PEOPLE.TASTE.${band}`);
const contraceptionText = (st: OpennessStage): string => main(`PEOPLE.OPENNESS.${OPENNESS_STAGES.indexOf(st)}`);
/** 말높임 영어 표기: PEOPLE.REGISTER.<REGISTERS 번호>, 모르는 값은 PEOPLE.REGISTER.OTHER */
const registerEn = (r: string): string => { const i = (REGISTERS as string[]).indexOf(r); return main(i >= 0 ? `PEOPLE.REGISTER.${i}` : 'PEOPLE.REGISTER.OTHER'); };

export interface BlockOpts extends AffinityOpts {
  /** 시트 원문 (고정 절을 넣을 때). 없으면 기록만 */
  sheet?: string | null;
  /** 'split' = 고정 절 + 기록 (기본), 'append' = 시트 전체 + 기록, 'record' = 기록만 */
  mode?: 'split' | 'append' | 'record';
  /** 모르는 것 목록 (unknownTo) */
  unknown?: string[];
  /** 유저 표기 (기본 {{user}}) */
  user?: string;
  /** 사실형 Director 메모 (갱신기가 미리 써 둔 것) */
  note?: { now?: string; mustNot?: string[] } | null;
  maxChars?: number;
  /** 켜진 선택 기능 (taste·openness 줄을 넣을지) */
  taste?: boolean;
  openness?: boolean;
  /** 정성 모드(수치 끔)인 기능: 단계·숫자 줄 대신 전용 칸 */
  qual?: Set<string>;
  /** 성격 6축 줄을 넣을지 (기능 axes) */
  axes?: boolean;
  /** 승인 전 성격 관찰(모으는 중인 후보)도 6축 줄 아래에 넣을지 (설정 「성격 관찰 포함」). 성적 축 후보는 넣지 않는다 */
  axesObserved?: boolean;
  /** 블록에서 뺄 칸 (Director 가 같은 칸을 `slots` 로 따로 받을 때) */
  omitSlots?: Set<SlotId>;
  /** 켜진 기능 (전용 칸을 넣을지 정함). 없으면 기본 칸만 */
  features?: Set<string>;
  /** 성적 욕망·이상성욕 글 (sexual.ts sexualTexts, 켜져 있고 글이 있을 때만). sexual_context_only 정책과 함께 넣는다 */
  sexual?: Partial<Record<'desire' | 'paraphilia', string>>;
  /** 성적 프로필 줄에 SEXUAL.POLICY 긴 글을 붙일지 (기본 붙임). 여러 인물 블록에서는 처음 한 번만 (전수검사 11-13) */
  sexualPolicy?: boolean;
  /** 유저 대상 말투 항목에 갱신기 표지([말투 변화 조짐 …])를 남길지. Director 만 (지침이 표지를 설명함). 기본은 뗀다 (전수검사 11-13) */
  speechMarks?: boolean;
}

const lines = (list: Entry[]) => list.map((e) => `- ${plain(e.text, 300)}`).join('\n');
/** 대상 칸: 유저 대상은 그대로, 다른 인물 대상은 「→ 이름:」 */
const targetedLines = (list: Entry[], user: string) => list.map((e) => `- ${e.target && e.target !== '@user' ? `→ ${e.target}: ` : ''}${plain(e.text, 300)}`).join('\n');
/** 기능별 전용 칸 묶음 (2026-11-06 「I」): 켜진 기능의 칸만, 비어 있으면 뺀다. 묶음 제목은 PEOPLE.GROUP.<key>, 칸 이름은 PEOPLE.SLOT.<칸> 절 */
const FEATURE_GROUPS: { key: string; slots: SlotId[] }[] = [
  { key: 'AFFINITY', slots: ['affinity.profile', 'affinity.values', 'affinity.appraisal', 'affinity.current_appraisal', 'affinity.intent', 'affinity.stance', 'affinity.bind', 'affinity.private', 'affinity.approach', 'affinity.surface_actual'] },
  { key: 'REGISTER', slots: ['register.context', 'register.stage_assessment', 'register.knowledge_gap', 'register.restraint'] },
  { key: 'PERCEPTION', slots: ['perception.profile', 'perception.modifiers', 'perception.channels', 'perception.reading', 'perception.secret'] },
  { key: 'OPENNESS', slots: ['openness.context'] },
  { key: 'AFFINITY_QUAL', slots: ['affinity.regard', 'affinity.speech', 'affinity.behavior'] },
  { key: 'SUSPICION_QUAL', slots: ['suspicion.concern', 'suspicion.speech', 'suspicion.behavior'] },
  { key: 'OPENNESS_QUAL', slots: ['openness.attitude', 'openness.speech', 'openness.behavior'] },
];

/** 예산을 넘으면 오래된 항목부터 뺀다: 지난 일 → 아는 것 → 행동 → 장면 → 목표 순. 다른 절은 그대로 */
export const TRIM_ORDER: (keyof Person['slots'])[] = ['history', 'knowledge', 'behavior', 'scene', 'threads'];
/** 인물마다 메인 요청에 넣는 승인 전 성격 관찰 수 */
export const OBSERVED_MAX = 4;

/** 블록에 실을 칸 항목 (글자 예산으로 줄이기 전). request.ts 의 넘침 줄이기도 이 항목으로 글자를 센다 */
export function blockEntries(p: Person, live: Liveness, o: Pick<BlockOpts, 'sheet' | 'mode' | 'omitSlots'> = {}): Partial<Record<keyof Person['slots'], Entry[]>> {
  const kept: Partial<Record<keyof Person['slots'], Entry[]>> = {};
  for (const k of Object.keys(p.slots) as (keyof Person['slots'])[]) kept[k] = o.omitSlots?.has(k as SlotId) ? [] : liveEntries(p.slots[k], live);
  // 시트 전체를 넣는 방식이면 그 시트의 Identity·Character 절에서 옮긴 시작값 항목은 뺀다 (시트 원문에 같은 줄이 있다). 이야기에서 생긴 항목·고친 항목은 남긴다
  if (o.sheet && (o.mode ?? 'split') === 'append') {
    const dup = seedTexts(o.sheet);
    for (const k of ['identity', 'personality'] as const) if (kept[k]) kept[k] = kept[k]!.filter((e) => !(e.src === 'seed' && dup.has(e.text)));
  }
  return kept;
}

/** 한 인물의 블록. 비어 있는 절은 빼고, 보통(무관심) 단계면 관계 줄을 짧게 */
export function personBlock(p: Person, store: PeopleStore, live: Liveness, changes: Change[], o: BlockOpts = {}): string {
  const user = o.user ?? '{{user}}';
  const kept = blockEntries(p, live, o);
  const mode = o.mode ?? 'split';
  // 글자 예산: 넘치면 오래된 항목부터 뺀다 (글자 수 기준, 항목 수 상한 없음)
  if (o.maxChars) {
    const size = () => Object.values(kept).reduce((n, l) => n + (l ?? []).reduce((m, e) => m + e.text.length + 3, 0), 0);
    for (const k of TRIM_ORDER) while (size() > o.maxChars && kept[k]?.length) kept[k]!.shift();
  }
  const slot = (k: keyof Person['slots']) => kept[k] ?? [];
  const out: string[] = [main('PEOPLE.BLOCK.HEAD', { name: p.name })];
  // 호칭으로 적어 둔 기록: 머리의 이름이 이름이 아니라는 것을 알린다 (본편이 호칭을 이름처럼 부르지 않게)
  if (p.provisional) out.push(main('PEOPLE.BLOCK.PROVISIONAL', { name: p.name }));
  if (o.sheet && mode === 'append') out.push(o.sheet.trim());
  const id = slot('identity');
  if (id.length) out.push(main('PEOPLE.BLOCK.IDENTITY') + '\n' + lines(id));
  const per = slot('personality');
  if (per.length) out.push(main('PEOPLE.BLOCK.PERSONALITY') + '\n' + lines(per));
  if (o.axes) out.push(main('PEOPLE.BLOCK.AXES') + '\n' + axesLinesEn(p.axes).join('\n') + (p.patterns?.length ? '\n' + main('PEOPLE.BLOCK.PATTERNS') + '\n' + p.patterns.map((t) => `- ${plain(t, 300)}`).join('\n') : ''));
  if (o.axes && o.axesObserved) {
    // 모으는 중인 후보 가운데 살아 있는 관찰이 있는 것, 관찰이 많은 것부터 넷까지
    const seen = Object.values(p.candidates ?? {})
      .filter((c) => c.status === 'collecting' && !isSexualAxis(c.axis))
      .map((c) => ({ c, n: liveEvidence(c, live).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, OBSERVED_MAX);
    if (seen.length) out.push(main('PEOPLE.BLOCK.AXES_OBSERVED') + '\n' + seen.map(({ c }) => main('PEOPLE.BLOCK.AXES_OBSERVED_ITEM', { axis: c.axis === 'pattern' ? 'pattern' : main(`PEOPLE.AXIS_LABEL.${c.axis}`), direction: c.direction, pattern: plain(c.pattern, 120) })).join('\n'));
  }
  // 성적 욕망·이상성욕 (원본 people_profile 의 sexual_desire/paraphilia + policy sexual_context_only)
  if (o.sexual && (o.sexual.desire || o.sexual.paraphilia)) out.push((o.sexualPolicy === false ? main('PEOPLE.BLOCK.SEXUAL', { policy: SEXUAL_POLICY }) : main('PEOPLE.BLOCK.SEXUAL_POLICY', { policy: SEXUAL_POLICY, policy_text: sexualDirectorPolicy() })) + '\n' + [o.sexual.desire ? `- ${main('PEOPLE.BLOCK.SEXUAL_DESIRE', { text: plain(o.sexual.desire, SEXUAL_CHARS) })}` : '', o.sexual.paraphilia ? `- ${main('PEOPLE.BLOCK.PARAPHILIA', { text: plain(o.sexual.paraphilia, SEXUAL_CHARS) })}` : ''].filter(Boolean).join('\n'));
  if (o.sheet && mode === 'split') for (const s of fixedSections(o.sheet)) out.push(`${s.name}:\n${s.body}`);
  const st = slot('state');
  if (st.length) out.push(main('PEOPLE.BLOCK.STATE') + '\n' + lines(st));
  const kn = slot('knowledge');
  if (kn.length) out.push(main('PEOPLE.BLOCK.KNOWS') + '\n' + lines(kn));
  if (o.unknown?.length) out.push(main('PEOPLE.BLOCK.UNKNOWN') + '\n' + o.unknown.map((u) => `- ${plain(u, 120)}`).join('\n'));
  const rel = slot('relationship');
  const relUser = rel.filter((e) => !e.target || e.target === '@user');
  const relOther = rel.filter((e) => e.target && e.target !== '@user');
  const aff = affinityView(p, changes, store.folded[p.name] ?? 0, o);
  const addr = addressOf(p, changes);
  // 정성 모드면 단계 없이 (호감은 전용 칸의 글로만)
  const relLine = [o.qual?.has('affinity') ? main('PEOPLE.BLOCK.RELATION_QUAL', { user }) : main('PEOPLE.BLOCK.RELATION', { user, stage: aff.stage.label, behavior: stageBehavior(aff.stage) }), expressTail(p.express)].filter(Boolean).join(' ');
  out.push(relLine + (relUser.length ? '\n' + lines(relUser) : ''));
  if (o.taste) {
    const band = tasteOf(p, changes);
    if (band !== null) out.push(main('PEOPLE.BLOCK.TASTE', { user, band: `${band > 0 ? '+' : ''}${band}`, taste: tasteText(band), note: main('PEOPLE.TASTE_NOTE') }));
  }
  if (o.openness && !o.qual?.has('openness')) {
    const v = opennessOf(p, changes);
    if (v !== null) {
      const st = opennessStage(v);
      out.push(main('PEOPLE.BLOCK.OPENNESS', { stage: st.en, value: Math.round(v), max: OPENNESS_MAX, contraception: contraceptionText(st), note: main('PEOPLE.OPENNESS_NOTE') }));
    }
  }
  if (relOther.length) out.push(main('PEOPLE.BLOCK.OTHERS') + '\n' + relOther.map((e) => `- → ${e.target}: ${plain(e.text, 300)}`).join('\n'));
  if (addr.toUser) out.push(main('PEOPLE.BLOCK.ADDRESS', { user, address: addr.toUser, register: registerEn(addr.register) }));
  // 유저 대상 말투 항목 (갱신기가 쓰는 말버릇·말투의 다변화 기록). 전에는 다른 인물 대상만 넣어 이 기록이 작가·Director 에 안 갔다 (전수검사 11-13)
  const spUser = slot('speech').filter((e) => !e.target || e.target === '@user');
  if (spUser.length) out.push(main('PEOPLE.BLOCK.SPEECH_USER', { user }) + '\n' + spUser.map((e) => `- ${plain(o.speechMarks ? e.text : parseSpeechMarker(e.text).base, SPEECH_ENTRY_CHARS)}`).join('\n'));
  // 기능별 전용 칸 (켜진 기능만)
  const enabled = new Set(slotsFor(o.features ?? new Set(), o.qual));
  for (const g of FEATURE_GROUPS) {
    const parts = g.slots.filter((s) => enabled.has(s)).map((s) => ({ s, list: slot(s) })).filter((x) => x.list.length);
    if (!parts.length) continue;
    out.push(`${main(`PEOPLE.GROUP.${g.key}`)}:\n` + parts.map((x) => `${main(`PEOPLE.SLOT.${x.s}`)}:\n${targetedLines(x.list, user)}`).join('\n'));
  }
  const sp = slot('speech').filter((e) => e.target && e.target !== '@user');
  if (sp.length) out.push(main('PEOPLE.BLOCK.SPEECH_OTHERS') + '\n' + sp.map((e) => `- → ${e.target}: ${plain(e.text, 300)}`).join('\n'));
  const be = slot('behavior');
  if (be.length) out.push(main('PEOPLE.BLOCK.BEHAVIOR') + '\n' + lines(be));
  const th = slot('threads');
  if (th.length) out.push(main('PEOPLE.BLOCK.THREADS') + '\n' + lines(th));
  const su = o.qual?.has('suspicion') ? [] : slot('suspicion');
  if (su.length) out.push(main('PEOPLE.BLOCK.SUSPICION') + '\n' + su.map((e) => `- ${e.target ? main('PEOPLE.BLOCK.SUSPICION_ABOUT', { target: e.target === '@user' ? user : e.target }) : ''}${e.kind ? ` [${e.kind}]` : ''}: ${plain(e.text, 200)}`).join('\n'));
  const hi = slot('history');
  if (hi.length) out.push(main('PEOPLE.BLOCK.HISTORY') + '\n' + lines(hi));
  const sc = slot('scene');
  if (sc.length) out.push(main('PEOPLE.BLOCK.SCENE') + '\n' + lines(sc));
  if (o.note?.now || o.note?.mustNot?.length) {
    out.push([main('PEOPLE.BLOCK.NOTE'), o.note.now ? `- ${plain(o.note.now, 160)}` : '', ...(o.note.mustNot ?? []).map((m) => `- ${main('PEOPLE.BLOCK.MUST_NOT', { text: plain(m, 100) })}`)].filter(Boolean).join('\n'));
  }
  return out.join('\n');
}

/**
 * 이 인물이 모르는 것: 다른 인물의 「아는 정보」에 있지만 이 인물의 아는 정보에 없는 사실 (최근 것 우선, 최대 5).
 * 리수폿 Director 의 지식 경계를 코드로 흉내 내는 가장 싼 방법.
 */
export function unknownTo(p: Person, store: PeopleStore, live: Liveness, max = 5): string[] {
  const mine = liveEntries(p.slots.knowledge, live).map((e) => norm(e.text));
  const seen = new Set<string>();
  const out: { text: string; pos: number }[] = [];
  for (const other of Object.values(store.people)) {
    if (other.name === p.name) continue;
    for (const e of liveEntries(other.slots.knowledge, live)) {
      const n = norm(e.text);
      if (seen.has(n) || mine.some((m) => m.includes(n) || n.includes(m))) continue;
      seen.add(n);
      out.push({ text: e.text, pos: live.at.get(e.anchor) ?? -1 });
    }
  }
  return out.sort((a, b) => b.pos - a.pos).slice(0, max).map((x) => x.text);
}

/** 기록 블록 머리 (지침 Main PEOPLE.HEAD) */
export const peopleHead = (): string => main('PEOPLE.HEAD');
/** 지식 경계 규칙 (원본 DIRECTOR_KNOWLEDGE_RULE): Director 가 꺼져 있거나 실패해도 기록 블록이 들어가면 늘 함께 간다 (2026-11-07 전수검사 2 의 C).
 *  글은 지침 「메인 요청에 붙는 글」 PEOPLE.KNOWLEDGE_RULE · PEOPLE.RULE 절 */
export const knowledgeRule = (): string => main('PEOPLE.KNOWLEDGE_RULE');
export const peopleRule = (): string => main('PEOPLE.RULE', { knowledge_rule: knowledgeRule() });

/** 여러 인물의 블록을 한 덩어리로. 상한 맞추기는 부르는 쪽(request.ts peopleBlockFor)이 인물 단위로 한다 (글 중간에서 자르지 않는다) */
export function peopleBlock(blocks: string[]): string {
  if (!blocks.length) return '';
  const body = blocks.join('\n\n');
  return `${peopleHead()}\n${peopleRule()}\n\n${body}`;
}

/** 서사 리듬 블록 (문서 종류 rhythm + '@rhythm' 메모). 기록이 없으면 빈 문자열 */
export function rhythmBlock(docs: { key: string; text: string }[], note: string | null | undefined, clock: string[] = []): string {
  if (!docs.length && !note) return '';
  const order = (k: string) => (k === 'scene' ? 0 : k === 'chapter' ? 1 : k === 'arc' ? 2 : k.startsWith('hook:') ? 3 : 4);
  const lines = [...docs].sort((a, b) => order(a.key) - order(b.key)).map((d) => `- ${d.key}: ${plain(d.text, 300)}`);
  return [main('RHYTHM.HEAD'), ...lines, ...(clock.length && docs.some((d) => d.key.startsWith('hook:')) ? [main('RHYTHM.CLOCK_HEAD'), ...clock] : []), ...(note ? [`- ${main('RHYTHM.DIRECTION', { note: plain(note, 200) })}`] : [])].join('\n');
}
