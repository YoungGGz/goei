// 보조 모델 이미지(에셋) 태그 보충. 원본 imgTagFireCore와 같은 흐름:
// 단락 번호 매김 → Image tag 로어북의 캐릭터 → 등장 캐릭터만 → 보조 모델 JSON 패치 → 단락 뒤에 <img=...> 삽입.
import type { LoreEntry } from './types';
import { guideTxt } from './guides';
import { readDirectory } from './world/directory';
import { termPresent } from './world/registry';
import { splitThoughts, stripThoughts } from './thoughts';

export class AssetError extends Error {}

export const IMAGE_BOOK = 'Image tag';
/** 최근 보조 모델 보충 결과 한 줄 (설정 탭에 보임) */
export const ASSET_NOTE = '$goei_asset_note';

export interface ImageData {
  characters: string[];
  keywords: string[];
  keywordSet: Set<string>;
  /** 소문자 이름·별칭 → 영문명 (둘 이상을 가리키면 false) */
  aliases: Map<string, string | false>;
  /** 「주인공 이미지」 ON: 「{{user}} 태그 금지」 줄을 뺀다 (메인모델 Asset 로어북과 같음) */
  allowUser?: boolean;
  /** 페르소나 이름: 지침의 {{user}}를 이 이름으로 푼다 (보조 모델 요청은 Risu가 CBS를 풀지 않음. 전수검사 11-13) */
  userName?: string;
}

/** 「주인공 이미지」 ON일 때의 자료. self(캐릭터로 플레이하지 않을 때의 페르소나 이름)는 명단에 넣는다 */
export function withUser(d: ImageData, self?: string): ImageData {
  const n = self?.trim() ?? '';
  if (!n || n.includes('_') || d.characters.includes(n)) return { ...d, allowUser: true };
  return { ...d, allowUser: true, characters: [...d.characters, n], aliases: new Map(d.aliases).set(n.toLowerCase(), n) };
}

const fail = (field: string, why: string) => new AssetError(`이미지 자료 오류 (${field}): ${why}`);

/** 보조 모델 이미지 자료: 명부(Directory)의 요원 한글 이름·영문명·별칭 + 출력 대상 목록(설정) + 표정 세트(설정).
 *  v0.16.66: 카드 로어북 「Image tag」 없이 플러그인이 조립한다 (사용자 2026-10-27). characters 가 비면 명부 영문명 전부 */
export function imageDataFrom(lore: LoreEntry[] | undefined, characters: string[], keywords: string[]): ImageData {
  const d: ImageData = { characters: [], keywords: [], keywordSet: new Set(), aliases: new Map() };
  const alias = (term: string, target: string) => {
    const k = term.trim().toLowerCase();
    if (!k) return;
    const cur = d.aliases.get(k);
    d.aliases.set(k, cur !== undefined && cur !== target ? false : target);
  };
  const agents = readDirectory(lore).agents.filter((x) => x.english);
  const want = characters.length ? new Set(characters.map((c) => c.toLowerCase())) : null;
  const seen = new Set<string>();
  const add = (name: string) => {
    const n = name.trim();
    if (!n || /[<>"{}_]/.test(n) || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    d.characters.push(n);
    alias(n, n);
  };
  for (const x of agents) {
    if (want && !want.has(x.english.toLowerCase())) continue;
    add(x.english);
    alias(x.name, x.english);
    for (const al of x.aliases) alias(al, x.english);
  }
  // 명부에 없는 임의 추가 이름: 영문명 자체만 별칭
  for (const c of characters) if (!seen.has(c.toLowerCase())) add(c);
  if (!d.characters.length) throw fail('characters', '출력 대상이 없습니다. 명부에 요원이 있는지, 설정에서 전부 끄지 않았는지 확인하세요.');
  for (const k of keywords) {
    const kw = k.trim();
    if (kw && !d.keywordSet.has(kw)) {
      d.keywordSet.add(kw);
      d.keywords.push(kw);
    }
  }
  if (!d.keywords.length) throw fail('keywords', '표정 세트가 비어 있습니다.');
  return d;
}

/** 본문에서 기존 <img=...> 태그를 지운다 (다시 생성·재호출 때 겹치지 않게) */
export function stripImageTags(content: string): string {
  return content.replace(/\n\s*\n\s*<img\s*=[^>]*>\s*\n\s*\n/g, '\n\n').replace(/<img\s*=[^>]*>\s*/g, '');
}

/** 이미지 태그를 붙일 본문과, 건드리지 않을 앞쪽(Risu 생각 칸 <Thoughts>·<think>)·뒤쪽(상태창 [▣| / [◎| 블록부터) */
/** narrative: 번호를 매겨 보조 모델에 보낼 본문(주석·생각 칸 뺌), raw: 태그를 끼워 저장할 본문(주석·생각 칸·빈 줄 그대로, 옛 태그만 뺌) */
export function splitNarrative(content: string): { leading: string; narrative: string; trailing: string; raw: string } {
  // 맨 앞 생각 칸은 번호·인물 판정에서 빼고 저장 본문에는 그대로 둔다 (전수검사 11-13)
  // 상황판 쪽과 같은 기준: 이어진 블록 전부, <Thoughts>·<think> 둘 다, 대소문자 안 가림 (재검토 11-14 F-7)
  const { head: leading, body: rest } = splitThoughts(content);
  const cut = ['[▣|', '[◎|'].map((p) => rest.indexOf(p)).filter((i) => i >= 0);
  const at = cut.length ? Math.min(...cut) : -1;
  const narrative = at >= 0 ? rest.slice(0, at) : rest;
  const trailing = at >= 0 ? rest.slice(at) : '';
  return {
    leading,
    narrative: stripImageTags(stripThoughts(narrative).replace(/<!--[\s\S]*?-->/g, '')).trim(),
    trailing,
    raw: stripImageTags(narrative).trim(),
  };
}

/** 빈 줄로 나눈 단락 */
export function paragraphs(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const line of `${text}\n`.split('\n').slice(0, -1)) {
    if (/^\s*$/.test(line)) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

export function activeCharacters(narrative: string, d: ImageData): string[] {
  return d.characters.filter((name) => [...d.aliases].some(([alias, target]) => target === name && termPresent(narrative, alias)));
}

/** 보조 모델 요청 (원본 imgBuildPrompt 그대로) */
export function assetPrompt(active: string[], paras: string[], d: ImageData, limit: number): { role: 'user'; content: string }[] {
  // 예시 줄의 이름: 첫 등장 인물 (없으면 지침 EXAMPLE_NAME 절)
  const first = active[0] ?? guideTxt('Asset', 'EXAMPLE_NAME');
  const n = String(limit);
  const aliasLines = active
    .map((name) => {
      const names = [...d.aliases].filter(([, t]) => t === name).map(([a]) => a).sort();
      return names.length ? guideTxt('Asset', 'ALIASES_LINE', { name, aliases: names.join(', ') }) : '';
    })
    .filter(Boolean);
  // 글은 지침 「이미지(보조 모델)」 PROMPT · NO_TAG · NO_TAG_USER · ALIASES_HEAD · ALIASES_LINE · NARRATIVE_LINE 절 (설정 → 지침에서 고침)
  const noTag0 = d.allowUser ? guideTxt('Asset', 'NO_TAG') : guideTxt('Asset', 'NO_TAG_USER');
  // 이름을 알면 {{user}}를 푼다 (모르면 그대로. 전수검사 11-13)
  const noTag = d.userName?.trim() ? noTag0.replace(/\{\{user\}\}/g, () => d.userName!.trim()) : noTag0;
  const aliasHead = guideTxt('Asset', 'ALIASES_HEAD');
  const narrative = paras.map((p, i) => guideTxt('Asset', 'NARRATIVE_LINE', { n: i + 1, text: p })).join('\n\n');
  return [{ role: 'user', content: guideTxt('Asset', 'PROMPT', {
    no_tag_rule: noTag, limit: n, plural: n === '1' ? '' : 's', limit_x3: limit * 3, names: active.join(' | '),
    aliases: aliasLines.length ? `${aliasHead}\n${aliasLines.join('\n')}\n\n` : '', keywords: d.keywords.join(', '), first, narrative,
  }) }];
}

/** 응답에서 JSON 배열만 (앞뒤 글·코드 펜스가 있어도) */
export function parsePatches(raw: string): { line: number; tag: string }[] {
  const text = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const s = text.indexOf('[');
  const e = text.lastIndexOf(']');
  if (s < 0 || e <= s) return [];
  let v: unknown;
  try {
    v = JSON.parse(text.slice(s, e + 1));
  } catch {
    try {
      v = JSON.parse(text.slice(s, e + 1).replace(/,\s*([\]}])/g, '$1'));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is { line: unknown; tag: unknown } => !!p && typeof p === 'object')
    .map((p) => ({ line: Number(p.line), tag: typeof p.tag === 'string' ? p.tag : '' }));
}

/** 원래 본문(raw)에서 단락마다 끝난 자리를 찾아 그 뒤에 태그를 끼운다. 주석·생각 칸·빈 줄 수를 그대로 둔다. 단락을 못 찾으면 null */
function placeTags(raw: string, paras: string[], inserts: Map<number, string>): string | null {
  let out = '';
  let at = 0;
  for (let i = 0; i < paras.length; i++) {
    const tag = inserts.get(i + 1);
    if (!tag) continue;
    // 그 단락의 줄들을 차례로 찾아 마지막 줄 끝으로 간다
    let end = at;
    for (const line of paras[i].split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const found = raw.indexOf(t, end);
      if (found < 0) return null;
      end = found + t.length;
    }
    const nl = raw.indexOf('\n', end);
    end = nl < 0 ? raw.length : nl;
    out += `${raw.slice(at, end)}\n\n${tag}`;
    at = end;
  }
  return out + (at < raw.length ? (raw.slice(at).startsWith('\n\n') ? '' : '\n') + raw.slice(at) : '');
}

/** 단락 뒤에 태그를 끼운다. 단락당 하나, 캐릭터별 limit개까지, 목록에 있는 이름·키워드만. raw 를 주면 그 본문 그대로에 끼운다 */
export function applyPatches(paras: string[], patches: { line: number; tag: string }[], limit: number, d: ImageData, raw?: string): string {
  const sorted = [...d.characters].sort((a, b) => b.length - a.length);
  const inserts = new Map<number, string>();
  const count = new Map<string, number>();
  for (const p of patches) {
    const ln = p.line;
    if (!Number.isInteger(ln) || ln < 1 || ln > paras.length || inserts.has(ln)) continue;
    const m = /<img\s*=\s*"([^"]+)"/.exec(p.tag) ?? /<img\s*=\s*([^>]+)>/.exec(p.tag);
    const inner = m?.[1]?.trim();
    if (!inner) continue;
    const name = sorted.find((c) => inner.startsWith(`${c}_`));
    // 띄어쓰기 표정을 밑줄로 쓴 것(forced_smiling)도 받아 띄어쓰기 꼴로 넣는다 (전수검사 11-13)
    const kw = name ? inner.slice(name.length + 1).trim() : '';
    const kwFix = d.keywordSet.has(kw) ? kw : kw.replace(/_/g, ' ');
    if (!name || !d.keywordSet.has(kwFix)) continue;
    const cur = count.get(name) ?? 0;
    if (cur >= limit) continue;
    inserts.set(ln, `<img=${name}_${kwFix}>`);
    count.set(name, cur + 1);
  }
  const placed = raw ? placeTags(raw, paras, inserts) : null;
  if (placed !== null) return placed;
  const out: string[] = [];
  paras.forEach((para, i) => {
    out.push(para);
    const tag = inserts.get(i + 1);
    if (tag) out.push(tag);
  });
  return out.join('\n\n');
}

export interface AssetJob {
  /** 이 본문으로 요청했다 (저장 전에 그대로인지 다시 확인) */
  original: string;
  paras: string[];
  /** 앞에 그대로 붙일 생각 칸 */
  leading: string;
  trailing: string;
  /** 태그를 끼워 저장할 본문 (주석·생각 칸 그대로) */
  raw?: string;
  messages: { role: 'user'; content: string }[];
}

/** 태그를 붙일 것이 없으면 null */
/** exclude: 태그하지 않을 영문명 (주인공 이미지를 끈 채 캐릭터로 플레이할 때 그 요원) */
export function planAsset(content: string, d: ImageData, limit: number, exclude: string[] = []): AssetJob | null {
  const { leading, narrative, trailing, raw } = splitNarrative(content);
  if (!narrative) return null;
  const active = activeCharacters(narrative, d).filter((name) => !exclude.includes(name));
  if (!active.length) return null;
  const paras = paragraphs(narrative);
  if (!paras.length) return null;
  return { original: content, paras, leading, trailing, raw, messages: assetPrompt(active, paras, d, limit) };
}

export function finishAsset(job: AssetJob, response: string, d: ImageData, limit: number): string | null {
  const patches = parsePatches(response);
  if (!patches.length) return null;
  const body = applyPatches(job.paras, patches, limit, d, job.raw);
  const out = job.trailing ? `${body}\n${job.trailing}` : body;
  return (job.leading ?? '') + out;
}
