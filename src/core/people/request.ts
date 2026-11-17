// 본편 요청에 인물 기록 블록을 끼운다 (beforeRequest). 모델은 부르지 않는다.
// 절 단위 혼합(split)이면 요원 자리에 들어간 그 인물의 시트 원문을 요청에서 빼고 기록 블록으로 대신한다.
import { sexualTexts } from './sexual';
import type { Chat } from '../types';
import { blockEntries, peopleBlock, personBlock, rhythmBlock, unknownTo, TRIM_ORDER } from './inject';
import { nameMatcher, scenePeople, carriedScene, entriesOf } from './select';
import { liveChanges, liveness, type Liveness } from './store';
import { latestNote, relatedDocs } from './updater';
import { rhythmClock, rhythmClockLines, rhythmNow } from './rhythm';
import { factionNow, factionsBlock, sceneFactionCodes, userFactionOf } from './faction';
import { messageText } from '../refs';
import { fixedSections } from './seed';
import type { PeopleSettings } from './settings';
import type { PeopleStore, Temper } from './types';
import { guideTxt } from '../guides';

export interface PromptMessage {
  role?: string;
  content?: unknown;
}

export interface RequestOpts {
  settings: PeopleSettings;
  store: PeopleStore;
  /** 인물 시트 (로어북) */
  sheetOf: (name: string) => string | null;
  temperOf?: (name: string) => Temper | undefined;
  extraNames?: Record<string, { aliases?: string[]; titles?: string[] }>;
  /** 지금 쓰려는 유저 입력 */
  input?: string;
  user?: string;
  /** 세력 코드 → 이름 (명부) */
  factionNames?: Record<string, string>;
  /** 모델 Router 가 고른 장면 인물 (있으면 코드 Router 대신). 기록에 있는 이름만 */
  people?: string[];
}

/** 코드가 고르는 장면 인물: 항상 포함(always) + 글에 이름이 나온 사람·동행·장면 유지(byCode). 자리 수는 6명(항상 포함이 더 많으면 그 수) */
function codePeople(chat: Chat, o: RequestOpts): { always: string[]; byCode: string[]; max: number } {
  const match = nameMatcher(entriesOf(o.store, o.extraNames ?? {}));
  const always = o.settings.always.filter((n) => o.store.people[n]);
  const byCode = scenePeople(chat, o.store, match, { input: o.input, carry: o.settings.sceneCarry ? carriedScene(o.store, chat) : [] }).filter((n) => !always.includes(n));
  return { always, byCode, max: Math.max(6, always.length) };
}

/** 코드가 고른 인물만으로 장면 인물 자리가 찼나. 차 있으면 모델 Router 가 고른 인물은 전부 잘리므로 그 호출을 건너뛴다 */
export function sceneFullByCode(chat: Chat, o: RequestOpts): boolean {
  if (!o.settings.on) return false;
  const c = codePeople(chat, o);
  return c.always.length + c.byCode.length >= c.max;
}

/** 기록 문서 블록 (설정 「기록 문서 포함」): 사건·장소·세력·물건 문서 가운데 장면과 관련된 것(문서 이름이 입력·최근 글에 나왔거나 장면 인물이 얽힌 항목)을
 *  최근 것부터 maxChars 안에서 고르고, 일어난 차례로 적는다. 관련 문서가 없으면 빈 문자열 */
export function docsBlockFor(chat: Chat, o: RequestOpts, people: string[], live: Liveness, maxChars: number): string {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const texts = [...(o.input ? [o.input] : []), ...list.slice(-2).map((m) => messageText(String(m.data ?? '')))];
  const head = guideTxt('Main', 'DOCS.HEAD');
  const line = (d: { type: string; key: string }, e: { text: string }) => guideTxt('Main', 'DOCS.ITEM', { type: d.type, key: d.key, text: e.text });
  // 고르는 규칙은 갱신기 자료(docs_now)와 같다 (updater.ts relatedDocs)
  const kept = relatedDocs(o.store, live, o.settings, texts, people, maxChars, (d, e) => line(d, e).length + 1, head.length).map((r) => line(r.doc, r.entry));
  return kept.length ? [head, ...kept].join('\n') : '';
}

/** 장면 인물의 기록 블록 (본편용). 대상이 없으면 빈 문자열 */
export function peopleBlockFor(chat: Chat, o: RequestOpts): { text: string; people: string[]; sheets: string[] } {
  if (!o.settings.on) return { text: '', people: [], sheets: [] };
  // 코드 Router(이름이 직접 나온 인물·동행)는 늘 들어가고, 모델 Router 가 더 고른 인물(이름 없이 가리킨 제3자 등)을 뒤에 합친다.
  // 2026-11-07 전수검사 2 의 B: 모델 결과가 코드 결과를 대체하면 모델이 빠뜨린 인물이 그 턴 기록에서 사라졌다 (원본 includeMentionedCharacters 와 같게)
  // 항상 포함할 인물(설정 always, 원본 tracked)은 맨 앞에: 글에 안 나와도 그 턴 기록·Director 자료에 든다
  // 장면에 남아 있는 인물(설정 「장면 인물 유지」)은 글에 나온 사람·동행 칸 뒤, 모델 Router 가 고른 사람 앞
  const { always, byCode, max } = codePeople(chat, o);
  const byModel = (o.people ?? []).filter((n) => o.store.people[n] && !always.includes(n) && !byCode.includes(n));
  const people = [...always, ...byCode, ...byModel].slice(0, max);
  if (!people.length) return { text: '', people: [], sheets: [] };
  const live: Liveness = liveness(chat);
  // 기록 문서 (설정 「기록 문서 포함」, 기본 끔): 컨텍스트 글자 상한을 「장면 인물 수 + 1」로 나눈 한 몫까지 쓰고, 쓴 만큼 인물 기록의 상한에서 뺀다
  const docsText = o.settings.docsInject ? docsBlockFor(chat, o, people, live, Math.floor(o.settings.blockCap / (people.length + 1))) : '';
  const blockCap = o.settings.blockCap - docsText.length;
  const changes = liveChanges(o.store, live);
  /** 인물마다: 시트 원문(요청에서 뺄 것)과 상한 밖 길이(시트 고정 절) */
  const own: { sheet: string | null; exempt: number }[] = [];
  // 성적 프로필 정책 글(SEXUAL.POLICY)은 처음 프로필이 있는 인물 블록에만. 뒤에서부터 빼므로 첫 블록이 남는다 (전수검사 11-13)
  let policyShown = false;
  /** 인물마다 블록을 만드는 함수 (글자 몫만 바꿔 다시 만들 수 있게) */
  const make: ((maxChars: number) => string)[] = [];
  // 본편 전체 예산을 장면 인물 수로 나눈다 (고정 절 원문은 예산 밖)
  const share = Math.max(1, Math.floor(blockCap / people.length));
  for (const n of people) {
    const p = o.store.people[n];
    const sheet = o.sheetOf(n);
    const exempt = !sheet ? 0 : o.settings.inject === 'split' ? fixedSections(sheet).reduce((s, x) => s + x.name.length + x.body.length + 2, 0) : o.settings.inject === 'append' ? sheet.trim().length : 0;
    own.push({ sheet: sheet || null, exempt });
    const note = o.settings.director === 'note' ? latestNote(o.store, n, live) : null;
    const sx = sexualTexts(p, o.settings);
    const sexualPolicy = !policyShown;
    const unknown = o.settings.features.has('perception') ? unknownTo(p, o.store, live) : [];
    make.push((maxChars) =>
      personBlock(p, o.store, live, changes, {
        sheet,
        mode: o.settings.inject,
        unknown,
        user: o.user,
        note,
        temper: o.temperOf?.(n),
        speed: o.settings.speed,
        speedDown: o.settings.speedDown,
        turnCap: o.settings.turnCap,
        maxChars,
        taste: o.settings.features.has('taste'),
        openness: o.settings.features.has('openness'),
        axes: o.settings.features.has('axes'),
        axesObserved: o.settings.axesObsInject,
        features: o.settings.features,
        qual: o.settings.qualitative,
        sexual: sx,
        sexualPolicy,
      }),
    );
    if (sx.desire || sx.paraphilia) policyShown = true;
  }
  const blocks: string[] = make.map((f) => f(share));
  // 상한(본문 전체 글자 수)은 기록에만 건다 (고정 절 원문은 상한 밖).
  const lenOf = (i: number) => blocks[i].length + 2 - own[i].exempt;
  const sizeOf = (k: number) => blocks.slice(0, k).reduce((s, _b, i) => s + lenOf(i), 0);
  // 넘치면 먼저 인물별 몫을 줄여 블록을 다시 만든다 (personBlock 이 지난 일부터 뺀다). 몫은 칸 글자만 세고 머리말·관계 줄·제목은 안 세므로,
  // 기록이 찬 인물이 둘만 있어도 합이 상한을 조금 넘어 마지막 인물이 통째로 빠졌다 (11-14 재검토 ①-1).
  // 넘친 만큼을 지금 가장 긴 인물부터 「항목 단위」로 줄인다. 몫을 글자 수로만 깎으면 넘친 글자가 항목 하나(150~200자)보다 작을 때
  // 블록이 그대로라 뒤 인물이 통째로 빠졌다 (11-14 재검토 ①-1 검증). 줄일 항목이 남아 있는 한 아무도 통째로 빼지 않는다.
  /** 인물마다: 칸 글자 합(personBlock 과 같은 셈)과 줄일 수 있는 항목 길이(빼는 순서대로) */
  const trim = people.map((n, i) => {
    const kept = blockEntries(o.store.people[n], live, { sheet: own[i].sheet, mode: o.settings.inject });
    const counted = Object.values(kept).reduce((s, l) => s + (l ?? []).reduce((m, e) => m + e.text.length + 3, 0), 0);
    const items = TRIM_ORDER.flatMap((k) => (kept[k] ?? []).map((e) => e.text.length + 3));
    // 처음 블록(몫 = share)에서 이미 빠진 항목 수
    let left = counted;
    let drop = 0;
    while (left > share && drop < items.length) left -= items[drop++];
    return { items, left, drop };
  });
  for (;;) {
    const over = sizeOf(blocks.length) - blockCap;
    if (over <= 0) break;
    const can = trim.map((t, i) => i).filter((i) => trim[i].drop < trim[i].items.length);
    if (!can.length) break;
    const i = can.reduce((a, c) => (lenOf(c) > lenOf(a) ? c : a));
    const t = trim[i];
    // 한 번에 넘친 글자를 줄일 수 있는 인물 수로 나눈 만큼(적어도 항목 하나)
    const want = Math.ceil(over / can.length);
    let cut = 0;
    do cut += t.items[t.drop++];
    while (cut < want && t.drop < t.items.length);
    t.left -= cut;
    blocks[i] = make[i](Math.max(1, t.left));
  }
  // 그래도 넘치면 글 중간에서 자르지 않고 뒤 인물부터 통째로 뺀다 (모델이 고른 인물 → 글에 나온 인물, 항상 포함은 끝까지).
  // 뺀 인물의 원래 시트는 요청에 남긴다 (전수검사 11-13: 4명부터 뒤 인물이 블록에서도 시트에서도 사라졌다)
  let keep = blocks.length;
  while (keep > 1 && sizeOf(keep) > blockCap) keep--;
  blocks.length = keep;
  const sheets = own.slice(0, keep).map((x) => x.sheet).filter((x): x is string => !!x);
  // 서사 리듬 (선택): 장면 전체 기록과 메모를 맨 앞에
  if (o.settings.features.has('rhythm')) {
    const docs = rhythmNow(o.store, live).map((r) => ({ key: r.doc.key, text: r.entry.text }));
    const note = o.settings.director === 'note' ? latestNote(o.store, '@rhythm', live)?.now : null;
    const rb = rhythmBlock(docs, note, rhythmClockLines(rhythmClock(o.store, chat, live)));
    if (rb) blocks.unshift(rb);
  }
  if (docsText) blocks.push(docsText);
  // 세력 평판 (기본 켬): 장면 세력(인물 소속 ∪ 최근 글에 나온 세력) 가운데 중립이 아닌 것만 한 줄씩, 맨 뒤에
  if (o.settings.features.has('faction_rep')) {
    const list = Array.isArray(chat.message) ? chat.message : [];
    const texts = [...(o.input ? [o.input] : []), ...list.slice(-2).map((m) => messageText(String(m.data ?? '')))];
    const codes = sceneFactionCodes(o.store, people, texts, o.factionNames);
    const uf = userFactionOf(o.store, chat);
    const fb = factionsBlock(codes.map((c) => factionNow(o.store, c, changes, uf, o.settings, o.factionNames)), o.user);
    if (fb) blocks.push(fb);
  }
  return { text: peopleBlock(blocks), people, sheets };
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 요청에서 시트 원문을 뺀다 (모든 모드: split 은 고정 절, append 는 시트 전체를 블록에 넣고, record 는 일부러 뺀다). 로어북 고르기가 넣은 글에 그대로 들어 있을 때만.
 *  공백·줄바꿈 차이는 무시한다 (낱말 사이를 `\s+` 로 맞춘 정규식. 예전 「첫 낱말 ~ 끝 낱말」 자르기는 첫 `###` 부터 엉뚱한 범위를 지웠다. QC 2026-10-28) */
export function stripSheets<M extends PromptMessage>(messages: M[], sheets: string[]): M[] {
  if (!sheets.length) return messages;
  const escRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targets = sheets.map(squash).filter(Boolean).map((t) => ({ t, re: new RegExp(t.split(' ').map(escRe).join('\\s+')) }));
  return messages.map((m) => {
    if (typeof m?.content !== 'string') return m;
    let text = m.content;
    let changed = false;
    for (const { t, re } of targets) {
      const i = text.indexOf(t);
      const next = i >= 0 ? text.slice(0, i) + text.slice(i + t.length) : text.replace(re, '');
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
    return changed ? { ...m, content: text.replace(/\n{3,}/g, '\n\n') } : m;
  });
}

/** 마지막 사용자 메시지 바로 앞에 시스템 메시지로 (상태창 블록과 같은 자리) */
export function insertBlock<M extends PromptMessage>(messages: M[], text: string): M[] {
  if (!text) return messages;
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const add = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, add] : [...messages.slice(0, at), add, ...messages.slice(at)];
}

/** 요청 가공 한 번에: 블록 만들기 → 시트 빼기 → 끼우기 */
export function withPeopleBlock<M extends PromptMessage>(messages: M[], chat: Chat, o: RequestOpts): M[] {
  const r = peopleBlockFor(chat, o);
  if (!r.text) return messages;
  const out = stripSheets(messages, r.sheets); // 덧붙임도 블록에 시트가 있으므로 원래 시트를 뺀다 (전수검사 11-13)
  return insertBlock(out, r.text);
}
