// 지침 (2026-11-14 사용자: 지침 하나 = 파일 하나). 기본 글은 저장소 맨 위 지침/*.txt 그대로이고, 코드가 자르거나 바꾸지 않는다.
// 사용자가 설정 「지침」 탭에서 고친 글(기기 설정)은 setGuideOverride 로 덮는다.
import gGNet from '../../지침/괴담넷.txt';
import gGal from '../../지침/괴담갤.txt';
import gWpf from '../../지침/세정게.txt';
import gSalmon from '../../지침/연어마켓.txt';
import gCos from '../../지침/우주쇼핑몰.txt';
import gBm from '../../지침/백일몽포인트몰.txt';
import gBmDesk from '../../지침/포인트몰_1대1상담.txt';
import gHs from '../../지침/망상홈쇼핑.txt';
import gPhone from '../../지침/괴담톡.txt';
import gWiki from '../../지침/괴이위키.txt';
import gDirective from '../../지침/이동_임무_지시문.txt';
import gRP from '../../지침/RP지침.txt';
import gTag from '../../지침/상태창_태그.txt';
import gShop from '../../지침/상점.txt';
import gUpdater from '../../지침/갱신기_자세히.txt';
import gUpdaterCompact from '../../지침/갱신기_간결.txt';
import gDirector from '../../지침/Director.txt';
import gRouter from '../../지침/Router.txt';
import gConsult from '../../지침/AI상담.txt';
import gCommon from '../../지침/요청공통.txt';
import gMain from '../../지침/메인요청_덧붙임.txt';
import gUpdaterExtra from '../../지침/갱신기_덧붙임.txt';
import gAsset from '../../지침/이미지_보조모델.txt';

export type GuideName = 'GNet' | 'Gal' | 'Wpf' | 'Salmon' | 'Cos' | 'Bm' | 'BmDesk' | 'Hs' | 'Phone' | 'Wiki' | 'Directive' | 'RP' | 'Tag' | 'Shop' | 'Updater' | 'UpdaterCompact' | 'Director' | 'Router' | 'Consult' | 'Common' | 'Main' | 'UpdaterExtra' | 'Asset';
export const GUIDE_NAMES: GuideName[] = ['GNet', 'Gal', 'Wpf', 'Salmon', 'Cos', 'Bm', 'BmDesk', 'Hs', 'Phone', 'Wiki', 'Directive', 'RP', 'Tag', 'Shop', 'Updater', 'UpdaterCompact', 'Director', 'Router', 'Consult', 'Common', 'Main', 'UpdaterExtra', 'Asset'];
export const GUIDE_LABEL: Record<GuideName, string> = { GNet: '괴담넷', Gal: '괴담갤', Wpf: '세정게', Salmon: '연어 마켓', Cos: '우주 쇼핑몰', Bm: '백일몽 포인트몰', BmDesk: '포인트몰 1:1 상담', Hs: '망상홈쇼핑', Phone: '괴담톡', Wiki: '괴이위키', Directive: '이동·임무 지시문', RP: 'RP 지침(봇 설명)', Tag: '상태창·태그', Shop: '상점', Updater: '인물 기록 갱신기(자세히)', UpdaterCompact: '인물 기록 갱신기(간결)', Director: 'Director(이번 턴 연기 지시)', Router: 'Router(장면 인물 고르기)', Consult: 'AI 상담', Common: '요청 공통', Main: '메인 요청에 붙는 글', UpdaterExtra: '갱신기(덧붙임·정리)', Asset: '이미지(보조 모델)' };

const DEFAULTS: Record<GuideName, string> = {
  GNet: gGNet.replace(/\r/g, ''),
  Gal: gGal.replace(/\r/g, ''),
  Wpf: gWpf.replace(/\r/g, ''),
  Salmon: gSalmon.replace(/\r/g, ''),
  Cos: gCos.replace(/\r/g, ''),
  Bm: gBm.replace(/\r/g, ''),
  BmDesk: gBmDesk.replace(/\r/g, ''),
  Hs: gHs.replace(/\r/g, ''),
  Phone: gPhone.replace(/\r/g, ''),
  Wiki: gWiki.replace(/\r/g, ''),
  Directive: gDirective.replace(/\r/g, ''),
  RP: gRP.replace(/\r/g, ''),
  Tag: gTag.replace(/\r/g, ''),
  Shop: gShop.replace(/\r/g, ''),
  Updater: gUpdater.replace(/\r/g, ''),
  UpdaterCompact: gUpdaterCompact.replace(/\r/g, ''),
  Director: gDirector.replace(/\r/g, ''),
  Router: gRouter.replace(/\r/g, ''),
  Consult: gConsult.replace(/\r/g, ''),
  Common: gCommon.replace(/\r/g, ''),
  Main: gMain.replace(/\r/g, ''),
  UpdaterExtra: gUpdaterExtra.replace(/\r/g, ''),
  Asset: gAsset.replace(/\r/g, ''),
};

const overrides = new Map<GuideName, string>();

/** 기기 설정에서 고친 글을 올린다 (빈 글이면 기본으로). 편집 창이 부른다 */
export function setGuideOverride(name: GuideName, text: string | undefined | null): void {
  if (text && text.trim()) overrides.set(name, text.replace(/\r/g, ''));
  else overrides.delete(name);
}

export const isGuideName = (name: string): name is GuideName => (GUIDE_NAMES as string[]).includes(name);
export const guideDefault = (name: GuideName): string => DEFAULTS[name];
export const guideText = (name: GuideName): string => overrides.get(name) ?? DEFAULTS[name];
export const guideOverridden = (name: GuideName): boolean => overrides.has(name);

/** 카드 description 이 아직 RP 지침을 들고 있는지 (경량 카드 v0.16.65 까지). 들고 있으면 플러그인이 다시 넣지 않는다 */
export const RP_HEAD = '## RP Guidance';

/* ── 지침을 절 단위로 (2026-10-27 사용자: 통째 글칸이 아니라 항목별로). 쪼갠 뒤 그대로 합치면 원문과 같다 ──
   GNet·Phone·Wiki·Visit: @@SECTION 이름 … @@END / Directive: ===이름=== / RP·Tag: ##·### 머리글. 절 앞의 머리글(제목 줄 등)은 「머리」 절 */
export interface GuidePart {
  title: string;
  /** 절 머리 (구분 줄 포함, 글칸에 안 보임) */
  head: string;
  /** 글칸에 보이는 본문 (끝 빈 줄 뺀 것) */
  body: string;
  /** 본문 뒤 (끝 빈 줄·@@END·절 사이 간격, 글칸에 안 보임) */
  tail: string;
}

function splitBy(text: string, re: RegExp, headOf: (m: RegExpMatchArray) => { title: string; head: string }): GuidePart[] {
  const hits = [...text.matchAll(re)];
  if (!hits.length) return [{ title: '전체', head: '', body: text.replace(/\s+$/, ''), tail: text.match(/\s+$/)?.[0] ?? '' }];
  const out: GuidePart[] = [];
  const pre = text.slice(0, hits[0].index);
  if (pre.trim()) out.push({ title: '머리', head: '', body: pre.replace(/\s+$/, ''), tail: pre.match(/\s+$/)?.[0] ?? '' });
  else if (pre) out.push({ title: '머리', head: pre, body: '', tail: '' });
  hits.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : text.length;
    const raw = text.slice(start, end);
    const tail = raw.match(/\s+$/)?.[0] ?? '';
    out.push({ ...headOf(m), body: raw.slice(0, raw.length - tail.length), tail });
  });
  return out;
}

export function splitGuide(text: string): GuidePart[] {
  if (text.includes('@@SECTION')) {
    const re = /@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g;
    const hits = [...text.matchAll(re)];
    const out: GuidePart[] = [];
    const pre = text.slice(0, hits[0]?.index ?? 0);
    if (pre.trim()) out.push({ title: '머리', head: '', body: pre.replace(/\s+$/, ''), tail: pre.match(/\s+$/)?.[0] ?? '' });
    else if (pre) out.push({ title: '머리', head: pre, body: '', tail: '' });
    hits.forEach((m, i) => {
      const end = m.index! + m[0].length;
      const gap = text.slice(end, i + 1 < hits.length ? hits[i + 1].index! : text.length);
      out.push({ title: m[1].trim(), head: `@@SECTION ${m[1]}\n`, body: m[2], tail: `\n@@END${gap}` });
    });
    return out;
  }
  if (/^===[^=\n]+===$/m.test(text)) return splitBy(text, /^===([^=\n]+)===\n/gm, (m) => ({ title: m[1].trim(), head: m[0] }));
  if (/^#{2,3} /m.test(text)) return splitBy(text, /^#{2,3} ([^\n]*)\n/gm, (m) => ({ title: m[1].trim(), head: m[0] }));
  return splitBy(text, /$^/g, () => ({ title: '전체', head: '' }));
}

export const joinGuide = (parts: GuidePart[]): string => parts.map((p) => p.head + p.body + p.tail).join('');

/* ── 내가 추가한 규칙 (2026-10-27 리수폿식 「프롬프트」 탭): 기기 설정에 두고, 붙일 지침의 늘 쓰이는 절 끝에 넣는다 ──
   RP: 글 끝 / 이동·임무(Directive): COMMON 절 / 괴담넷: LB 절 / 괴담톡: COMMON / 위키: NW.GUIDE / 필드: COMMON */
export type RuleTarget = 'RP' | 'Directive' | 'GNet' | 'Gal' | 'Wpf' | 'Salmon' | 'Phone' | 'Wiki';
export const RULE_TARGETS: RuleTarget[] = ['RP', 'Directive', 'GNet', 'Gal', 'Wpf', 'Salmon', 'Phone', 'Wiki'];
export const RULE_TARGET_LABEL: Record<RuleTarget, string> = { RP: 'RP', Directive: '이동·임무', GNet: '괴담넷', Gal: '괴담갤', Wpf: '세정게', Salmon: '연어 마켓', Phone: '괴담톡', Wiki: '위키' };
export interface UserRule {
  id: string;
  title: string;
  text: string;
  to: RuleTarget[];
  on: boolean;
}
const RULE_SECTION: Record<RuleTarget, string | null> = { RP: null, Directive: 'COMMON', GNet: 'LB', Gal: 'LB', Wpf: 'LB', Salmon: 'LB', Phone: 'COMMON', Wiki: 'NW.GUIDE' };

let userRules: UserRule[] = [];
export function setUserRules(rules: UserRule[] | undefined | null): void {
  userRules = Array.isArray(rules) ? rules.filter((r) => r && typeof r.id === 'string') : [];
}
export const getUserRules = (): UserRule[] => userRules;

/** 이 지침에 붙을 규칙 글 (없으면 빈 글) */
export function rulesFor(name: GuideName): string {
  if (!(RULE_TARGETS as string[]).includes(name)) return '';
  const hit = userRules.filter((r) => r.on && r.text.trim() && r.to.includes(name as RuleTarget));
  if (!hit.length) return '';
  return `${guideTxt('Common', 'USER_RULES.HEAD')}\n${hit.map((r) => guideTxt('Common', 'USER_RULES.ITEM', { title: r.title.trim() || '규칙', text: r.text.trim() })).join('\n\n')}`;
}

/** 요청에 쓰는 지침 글: 고친 글(또는 기본) + 내가 추가한 규칙. 편집 창은 guideText(규칙 없는 글)를 쓴다 */
export function guidePrompt(name: GuideName): string {
  const base = guideText(name);
  const rules = rulesFor(name);
  if (!rules) return base;
  const at = RULE_SECTION[name as RuleTarget];
  if (!at) return `${base.replace(/\s+$/, '')}\n\n${rules}\n`;
  const parts = splitGuide(base);
  const i = parts.findIndex((p) => p.title === at);
  if (i < 0) return base;
  parts[i] = { ...parts[i], body: `${parts[i].body}\n\n${rules}` };
  return joinGuide(parts);
}

/** 지침의 @@SECTION 절들 (고친 글 + 내가 추가한 규칙 반영). 상점처럼 로어북 없이 플러그인 지침만 쓰는 곳 */
export function guideSections(name: GuideName): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of guidePrompt(name).matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)) out[m[1].trim()] = m[2];
  return out;
}

/** 절 글의 {이름} 자리를 채운다. 모르는 이름은 그대로 둔다 */
export const fillGuide = (text: string | undefined, vars: Record<string, string>): string =>
  String(text ?? '').replace(/\{([a-z_]+)\}/g, (all, k: string) => (k in vars ? vars[k] : all)).trim();

/* ── 코드에 박혀 있던 지침을 지침 절로 (2026-11-13 사용자: 「설정 지침칸으로 안 빠지고 하드코딩 돼 있는 것을 지침으로」) ──
   부르는 쪽은 guideOr(지침, 절, 옛 글, 자리 값) 로 읽는다. 절이 없으면(옛 글로 고쳐 저장해 둔 지침) 코드에 남긴 옛 글을 그대로 쓴다 (hslog.ts hsMainRules 와 같은 길). */
const secCache = new Map<GuideName, { src: string; secs: Record<string, string> }>();
/** 지침 절 글 (고친 글 반영, 앞뒤 빈칸 뺌). 절이 없거나 비었으면 null */
export function guideSec(name: GuideName, section: string): string | null {
  const src = guidePrompt(name);
  let c = secCache.get(name);
  if (!c || c.src !== src) {
    const secs: Record<string, string> = {};
    for (const m of src.matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)) secs[m[1].trim()] = m[2];
    c = { src, secs };
    secCache.set(name, c);
  }
  return c.secs[section]?.trim() || null;
}
/** 절 글의 {이름} 자리를 채운다 (앞뒤를 다듬지 않는다). 모르는 이름과 {{…}} 는 그대로 둔다. 채운 값은 다시 훑지 않는다 */
export const fillVars = (text: string, vars: Record<string, string | number>): string =>
  text.replace(/(?<!\{)\{([a-z0-9_]+)\}(?!\})/g, (all, k: string) => (k in vars ? String(vars[k]) : all));
/* 비우면 기본 글이 쓰이는 절 (전수검사 11-13 나-51 사용자: 지금처럼 기본 글을 쓰고, 빈 칸에 「비우면 기본 글이 쓰여요」라고 표시).
   guideOr·guideSec 나 「읽은 글 || 옛 글」 꼴로 읽는 절이다. 그 밖의 절은 비우면 요청에서 정말로 빠진다 */
const BLANK_DEFAULT_ALL: GuideName[] = ['Common', 'Main', 'UpdaterExtra', 'Asset'];
const BLANK_DEFAULT_GNET = /^(LANGUAGE|IMPORTANT_NOTE|POST\.TAG_RULE|POST\.TAG_FORMAT|COMMENT\.TIME_RULE|KEYFIGURES\.FORMAT|SAMPLING|ACTION\.COMMENT|ACTION\.POST_REFRESH|PUBLIC\.ACCESS|RETRY\.FORMAT|DM\.QUOTE_UNKNOWN|PICS_(NONE|PEOPLE|EXPR|THINGS))$/;
const BLANK_DEFAULT_SHOP = /^(TRUTH_(ALL|MIX|NONE)|SECRET_NOTE|WHERE_(ANY|SHOP)|ASSIGN_(ROLE_USEFUL|ROLE_BROAD|RULE)|HEAD_(REFS|ASSIGN|ORDERS|NOTES))$/;
const BLANK_DEFAULT: Partial<Record<GuideName, RegExp>> = {
  GNet: BLANK_DEFAULT_GNET, Gal: BLANK_DEFAULT_GNET, Wpf: BLANK_DEFAULT_GNET, Salmon: BLANK_DEFAULT_GNET,
  Phone: /^(LANGUAGE|RETRY\.REFRESH)$/,
  Shop: BLANK_DEFAULT_SHOP, Cos: BLANK_DEFAULT_SHOP, Bm: BLANK_DEFAULT_SHOP,
  // 1:1 상담 머리말 (전수검사 11-13)
  BmDesk: /^HEAD_(REFS|PAST)$/,
  Director: /^(SEARCH|PASS2|OUTPUT|APPLY\..+|REPAIR|MAIN_NOTE)$/,
  Hs: /^MAIN_CONTEXT$/,
};
/** 이 지침의 이 절을 비우면 요청에 기본 글이 쓰이나 (편집 화면 표시용) */
export const blankUsesDefault = (name: GuideName, section: string): boolean =>
  BLANK_DEFAULT_ALL.includes(name) || !!BLANK_DEFAULT[name]?.test(section.trim());
/** 기본 지침 파일(지침/*.txt)의 절 글 (앞뒤 빈칸 뺌). 없으면 null */
const defCache = new Map<GuideName, Record<string, string>>();
export function guideDefaultSec(name: GuideName, section: string): string | null {
  let secs = defCache.get(name);
  if (!secs) {
    secs = {};
    for (const m of DEFAULTS[name].matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)) secs[m[1].trim()] = m[2];
    defCache.set(name, secs);
  }
  return secs[section]?.trim() || null;
}
/** 지침 절 글 (2026-11-14 사용자: 코드에 박힌 모델 글을 전부 지침 파일로). 고친 글의 절 → 없거나 비었으면 기본 파일(지침/*.txt)의 절. 코드에는 글을 두지 않는다 */
export function guideTxt(name: GuideName, section: string, vars?: Record<string, string | number>): string {
  const t = guideSec(name, section) ?? guideDefaultSec(name, section) ?? '';
  return vars ? fillVars(t, vars) : t;
}
/** 지침 절이 있으면 그 글(자리 채움), 없으면 코드에 남긴 옛 글 */
export function guideOr(name: GuideName, section: string, fallback: string | (() => string), vars?: Record<string, string | number>): string {
  const t = guideSec(name, section);
  if (t === null) return typeof fallback === 'function' ? fallback() : fallback;
  return vars ? fillVars(t, vars) : t;
}
