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
  return `${guideTxt('Common', 'USER_RULES.HEAD')}\n${hit.map((r) => guideTxt('Common', 'USER_RULES.ITEM', { title: r.title.trim() || guideTxt('Common', 'USER_RULES.DEFAULT_TITLE'), text: r.text.trim() })).join('\n\n')}`;
}

/** 요청에 쓰는 지침 글: 고친 글(또는 기본) + 내가 추가한 규칙. 편집 창은 guideText(규칙 없는 글)를 쓴다 */
/** 규칙을 붙인 지침 글 (지침 글·규칙이 같으면 다시 쪼개고 합치지 않는다, 전수점검 사소-11) */
const promptCache = new Map<GuideName, { base: string; rules: string; out: string }>();
export function guidePrompt(name: GuideName): string {
  const base = guideText(name);
  const rules = rulesFor(name);
  if (!rules) return base;
  const hit = promptCache.get(name);
  if (hit && hit.base === base && hit.rules === rules) return hit.out;
  const out = joinRules(name, base, rules);
  promptCache.set(name, { base, rules, out });
  return out;
}
function joinRules(name: GuideName, base: string, rules: string): string {
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
   부르는 쪽은 guideTxt(지침, 절, 자리 값) 로 읽는다. 고친 지침에 그 절이 없거나 비었으면 기본 파일(지침/*.txt)의 절을 쓴다. 코드에는 글을 두지 않는다 (2026-11-14). */
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
   guideTxt 로 읽는 절이다. 그 밖의 절은 비우면 요청에서 정말로 빠진다 */
const BLANK_DEFAULT_ALL: GuideName[] = ['Common', 'Main', 'UpdaterExtra', 'Asset'];
const BLANK_DEFAULT_GNET = /^(LANGUAGE|IMPORTANT_NOTE|POST\.TAG_RULE|POST\.TAG_FORMAT|COMMENT\.TIME_RULE|KEYFIGURES\.FORMAT|SAMPLING|ACTION\.COMMENT|ACTION\.POST_REFRESH|PUBLIC\.ACCESS|RETRY\.FORMAT|DM\.QUOTE_UNKNOWN|PICS_(NONE|PEOPLE|EXPR|THINGS))$/;
const BLANK_DEFAULT_SHOP = /^(TRUTH_(ALL|MIX|NONE)|SECRET_NOTE|WHERE_(ANY|SHOP)|ASSIGN_(ROLE_USEFUL|ROLE_BROAD|RULE)|HEAD_(REFS|ASSIGN|ORDERS|NOTES))$/;
const BLANK_DEFAULT: Partial<Record<GuideName, RegExp>> = {
  GNet: BLANK_DEFAULT_GNET, Gal: BLANK_DEFAULT_GNET, Wpf: BLANK_DEFAULT_GNET, Salmon: BLANK_DEFAULT_GNET,
  Phone: /^(LANGUAGE|RETRY\.REFRESH)$/,
  Shop: BLANK_DEFAULT_SHOP, Cos: BLANK_DEFAULT_SHOP, Bm: BLANK_DEFAULT_SHOP,
  // 1:1 상담 머리말 (전수검사 11-13)
  BmDesk: /^HEAD_(REFS|PAST|PROTAGONIST|STATUS|SITUATION|STORY)$/,
  Director: /^(SEARCH|PASS2|OUTPUT|APPLY\..+|REPAIR|MAIN_NOTE)$/,
  Hs: /^MAIN_CONTEXT$/,
};
/** 2026-11-14 코드에서 꺼내 지침 절로 옮긴 글 (모두 guideTxt 로 읽어 비우면 기본 글). 빠진 절이 없는지는 tests/fix3d-guideblank.test.mjs 가 코드를 읽어 대조한다 (2차 점검 16-문제3) */
const BLANK_DEFAULT_MOVED: Partial<Record<GuideName, string[]>> = {
  GNet: ['SYSTEM.PROTAGONIST_HEAD', 'DM.ROLE_BINDING', 'REQUEST.HEAD_REFS', 'REQUEST.HEAD_STORY', 'REQUEST.HEAD_TASK', 'REFS.SITUATION_SOURCE', 'SAMPLING.SEED', 'INCOMING.OPTIONS_HEAD', 'DM.ORIGIN', 'DM.ORIGIN_QUOTE', 'DM.STORY_TIME', 'DM.PUBLIC_HEAD', 'MAIN_CONTEXT.ACCESS_POST', 'MAIN_CONTEXT.ACCESS_DM', 'POST.INPUT_TAG', 'SITE.NAME'],
  Gal: ['SYSTEM.PROTAGONIST_HEAD', 'DM.ROLE_BINDING', 'REQUEST.HEAD_REFS', 'REQUEST.HEAD_STORY', 'REQUEST.HEAD_TASK', 'REFS.SITUATION_SOURCE', 'SAMPLING.SEED', 'INCOMING.OPTIONS_HEAD', 'DM.ORIGIN', 'DM.ORIGIN_QUOTE', 'DM.STORY_TIME', 'DM.PUBLIC_HEAD', 'MAIN_CONTEXT.ACCESS_POST', 'MAIN_CONTEXT.ACCESS_DM', 'POST.INPUT_TAG', 'SITE.NAME'],
  Wpf: ['SYSTEM.PROTAGONIST_HEAD', 'DM.ROLE_BINDING', 'REQUEST.HEAD_REFS', 'REQUEST.HEAD_STORY', 'REQUEST.HEAD_TASK', 'REFS.SITUATION_SOURCE', 'SAMPLING.SEED', 'INCOMING.OPTIONS_HEAD', 'DM.ORIGIN', 'DM.ORIGIN_QUOTE', 'DM.STORY_TIME', 'DM.PUBLIC_HEAD', 'MAIN_CONTEXT.ACCESS_POST', 'MAIN_CONTEXT.ACCESS_DM', 'POST.INPUT_TAG', 'SITE.NAME'],
  Salmon: ['SYSTEM.PROTAGONIST_HEAD', 'DM.ROLE_BINDING', 'REQUEST.HEAD_REFS', 'REQUEST.HEAD_STORY', 'REQUEST.HEAD_TASK', 'REFS.SITUATION_SOURCE', 'SAMPLING.SEED', 'INCOMING.OPTIONS_HEAD', 'DM.ORIGIN', 'DM.ORIGIN_QUOTE', 'DM.STORY_TIME', 'DM.PUBLIC_HEAD', 'MAIN_CONTEXT.ACCESS_POST', 'MAIN_CONTEXT.ACCESS_DM', 'POST.INPUT_TAG', 'SITE.NAME', 'POST.TRADE_TAG.SELL', 'POST.TRADE_TAG.BUY', 'POST.TRADE_TAG.FREE', 'POST.TRADE_TAG.INFO'],
  Cos: ['HEAD_SHOP', 'HEAD_SHOP_OWNER', 'HEAD_IDENTITY_WON', 'HEAD_IDENTITY_POINTS', 'HEAD_PROTAGONIST', 'HEAD_STATUS', 'HEAD_SITUATION', 'HEAD_STORY', 'TALK_LINE_ME', 'TALK_LINE_OWNER', 'HEAD_VISIT_TALK', 'TASK_FIRST', 'TASK_RESTOCK', 'HEAD_SHELF_NOW', 'SHELF_EMPTY', 'TAG_RARE', 'TAG_SALE', 'HEAD_BOUGHT', 'HEAD_OWNER_BOUGHT', 'NOTE_ITEM_BOUGHT', 'NOTE_ITEM_OPEN', 'HEAD_QUOTES', 'QUOTE_ITEM_PAID', 'QUOTE_ITEM_OPEN', 'HEAD_SELLING', 'SELLING_TRUTH', 'SELLING_PAID', 'SELLING_OFFER_WON', 'SELLING_OFFER_POINTS', 'HEAD_TALK_NOW', 'SIZE_EXACT', 'SIZE_RANGE', 'LINE', 'ORDERS_ITEM', 'ORDERS_READY', 'ORDERS_DUE', 'ORDERS_DUE_IN', 'ASSIGN_UNIT', 'ASSIGN_UNITS', 'ASSIGN_LINE', 'ASSIGN_LINE_ROLE', 'ASSIGN_PRICE', 'ROLL_GENRES', 'ROLL_TIERS', 'ASK_CHIP', 'ASK_SELL_BARE', 'MALL_NAME', 'OWNER_NAME', 'TALK_NO_STOCK', 'ORDER_COLUMNS', 'ARRIVE', 'ARRIVE_ORDER', 'BOUGHT_LINE'],
  Bm: ['HEAD_SHOP', 'HEAD_SHOP_OWNER', 'HEAD_IDENTITY_WON', 'HEAD_IDENTITY_POINTS', 'HEAD_PROTAGONIST', 'HEAD_STATUS', 'HEAD_SITUATION', 'HEAD_STORY', 'TALK_LINE_ME', 'TALK_LINE_OWNER', 'HEAD_VISIT_TALK', 'TASK_FIRST', 'TASK_RESTOCK', 'HEAD_SHELF_NOW', 'SHELF_EMPTY', 'TAG_RARE', 'TAG_SALE', 'HEAD_BOUGHT', 'HEAD_OWNER_BOUGHT', 'NOTE_ITEM_BOUGHT', 'NOTE_ITEM_OPEN', 'HEAD_QUOTES', 'QUOTE_ITEM_PAID', 'QUOTE_ITEM_OPEN', 'HEAD_SELLING', 'SELLING_TRUTH', 'SELLING_PAID', 'SELLING_OFFER_WON', 'SELLING_OFFER_POINTS', 'HEAD_TALK_NOW', 'SIZE_EXACT', 'SIZE_RANGE', 'LINE', 'HEAD_NOTES', 'ASSIGN_UNIT', 'ASSIGN_UNITS', 'ASSIGN_LINE', 'ASSIGN_LINE_ROLE', 'ASSIGN_PRICE', 'ROLL_GENRES', 'ROLL_TIERS', 'MALL_NAME', 'ARRIVE', 'PICKUP_TRY', 'PICKUP_WAIT', 'BOUGHT_LINE'],
  BmDesk: ['DICE_DEFAULT', 'AGENT_TAG', 'SHELF', 'SHELF_LINE', 'NONE', 'CUSTOMER', 'CARD', 'DICE_LINE', 'PAST_LINE', 'MAKE_USER', 'TALK_USER', 'TALK_ME', 'TALK_OP', 'ERR_NO_CARD', 'ERR_NO_NAME', 'ERR_NO_GREETING', 'ERR_NO_SAY', 'SHOP_NAME'],
  Hs: ['LINE', 'SIZE_EXACT', 'SIZE_RANGE', 'HEAD_CHANNEL', 'HEAD_CHANNEL_HOST', 'TASK_PROGRAM', 'HEAD_REFS', 'HEAD_PROTAGONIST', 'HEAD_STATUS', 'HEAD_SITUATION', 'HEAD_STORY', 'BLOCK_HEAD', 'BOX_NAME', 'BOX_DESC', 'ERR_NO_CUE', 'ERR_CUE_LINES', 'ERR_NO_SAY', 'ERR_NO_OPERATOR', 'COUNT_RANGE', 'SAY_NOW', 'SAY_NOW_TITLED', 'SAY_HOST_LINE', 'SAY_CHAT_LINE', 'SAY_FLOWED', 'SAY_USER', 'ORDER_LOG', 'ORDER_BARTER', 'ORDER_INSTALLMENT', 'ORDER_WON', 'ORDER_OTHER', 'ORDER_JOIN', 'PAY_BOTH', 'PAY_WON', 'PAY_APPEAR', 'ORDER_PAID', 'ORDER_BARTER_NOTE', 'MAIN_CONTEXT_ACCESS', 'SAY_ME_NICK', 'PLAYER_SYS_NICK', 'PLAYER_SYS_ORDER', 'PLAYER_SYS_AUDIENCE', 'CHAT_ANON_NICK', 'CHANNEL_NAME', 'HOST_NAME', 'IDENTITY_PRICES', 'LOG_HOST_NICK', 'LOG_STICKER_NICK', 'LOG_OPERATOR_NICK', 'LOG_HANGUP', 'TASK_OPERATOR', 'HEAD_ON_AIR', 'HEAD_OFFERED', 'OFFERED_LINE', 'OFFERED_TRUTH', 'OFFERED_DAMAGED', 'OFFERED_BROKEN', 'OFFERED_INTACT', 'HEAD_TERMS', 'TERMS_NONE', 'HEAD_CALL', 'CALL_LINE_ME', 'CALL_LINE_OP', 'CALL_OFFER', 'ARRIVE', 'ORDERS_OPENED', 'ORDERS_BOX_GONE', 'ORDERS_SEALED', 'ORDERS_DEMO_WAIT', 'ORDERS_DEMO_DONE', 'ORDERS_OWE_WAIT', 'ORDERS_OWE_DONE', 'ORDERS_LINE', 'ORDERS_AND', 'HEAD_ORDERS', 'ORDERS_NONE', 'TASK_OPERATOR_LINE'],
  Phone: ['ANNOUNCEMENT_ACCESS.CIVILIAN', 'ANNOUNCEMENT_ACCESS.FREELANCER', 'ANNOUNCEMENT_ACCESS.ORG', 'MAIN_CONTEXT.NOTICE_ACCESS', 'FIRST_CONTACT', 'CALL', 'ERR.EMPTY', 'ERR.NOT_JSON', 'ERR.JSON_SYNTAX', 'ERR.PATCH_NOT_ARRAY', 'ERR.OP_NOT_OBJECT', 'ERR.ROOM_NAME', 'ERR.REACTION', 'ERR.ADD_ONLY', 'ERR.MESSAGE_FIELDS', 'ERR.EXIT', 'ERR.PAUSE', 'ERR.MESSAGE_TYPE', 'ERR.TOO_MANY_BUBBLES', 'ERR.NOT_MEMBER', 'ERR.GROUP_GIFT', 'ERR.REPLY_TOKENS', 'ERR.REACT_TARGET', 'ERR.PAUSE_EMPTY', 'ERR.PAUSE_TOKENS', 'ERR.EXIT_MEMBER', 'ERR.NO_PATCH_TAG', 'ERR.NOTICES_NOT_ARRAY', 'ERR.TOO_MANY_NOTICES', 'ERR.NOTICE_FORMAT', 'ERR.NOTICE_CATEGORY', 'ERR.NOTICE_FIELDS', 'ERR.NOTICE_TOKENS', 'ERR.INVITES_NOT_ARRAY', 'ERR.TOO_MANY_INVITES', 'ERR.INVITE_FORMAT', 'ERR.INVITE_NAME', 'ERR.INVITE_SIZE', 'ERR.INVITE_MEMBER', 'ERR.INVITE_INVITER', 'ERR.INVITE_DUP', 'ERR.INVITE_EXISTS', 'ERR.REFRESH_FORMAT', 'ERR.UPDATES_NOT_ARRAY', 'ERR.REFRESH_ROOM', 'ERR.REFRESH_NOT_ALLOWED', 'ROOM.FALLBACK_GROUP', 'ROOM.FALLBACK_DM', 'SYSTEM.INVITED', 'SYSTEM.EXITED', 'SYSTEM.INVITED_ME', 'CONTACT.GROUP_CUSTOM', 'NOTICE_CHANNEL.D00', 'NOTICE_CHANNEL.E00', 'VIEW.NAME.SIDE', 'VIEW.NAME.MONO', 'VIEW.NAME.MULTI', 'ERR.VIEW_FORMAT', 'ERR.VIEW_POV', 'ERR.VIEW_EMPTY', 'ANNOUNCEMENTS', 'MAIN_CONTEXT.VIEWS', 'MAIN_CONTEXT.HABITS'],
  Wiki: ['NW.HEAD_TITLE', 'NW.HEAD_REFS', 'NW.HEAD_STORY', 'NW.HEAD_PREVIOUS', 'NW.HEAD_REQUEST_ALL', 'NW.HEAD_REQUEST_DOC', 'NW.IMAGES_ITEM', 'NW.TITLE_HEAD_CANDIDATES', 'NW.TITLE_HEAD_WRITTEN', 'NW.TITLE_HEAD_STORY', 'NW.TITLE_ITEM', 'MAIN_CONTEXT.CUT', 'NW.ERR_EMPTY', 'NW.ERR_UNCLOSED', 'NW.ERR_FORMAT', 'NW.ERR_NO_PARAGRAPH', 'NW.ERR_TITLE_NOT_CANDIDATE'],
  Shop: ['HEAD_SHOP', 'HEAD_SHOP_OWNER', 'HEAD_IDENTITY_WON', 'HEAD_IDENTITY_POINTS', 'HEAD_PROTAGONIST', 'HEAD_STATUS', 'HEAD_SITUATION', 'HEAD_STORY', 'TALK_LINE_ME', 'TALK_LINE_OWNER', 'HEAD_VISIT_TALK', 'TASK_FIRST', 'TASK_RESTOCK', 'HEAD_SHELF_NOW', 'SHELF_EMPTY', 'TAG_RARE', 'TAG_SALE', 'HEAD_BOUGHT', 'HEAD_OWNER_BOUGHT', 'NOTE_ITEM_BOUGHT', 'NOTE_ITEM_OPEN', 'HEAD_QUOTES', 'QUOTE_ITEM_PAID', 'QUOTE_ITEM_OPEN', 'HEAD_SELLING', 'SELLING_TRUTH', 'SELLING_PAID', 'SELLING_OFFER_WON', 'SELLING_OFFER_POINTS', 'HEAD_TALK_NOW', 'SIZE_EXACT', 'SIZE_RANGE', 'LINE', 'OWN_SHOP_ITEM', 'OWN_SHOP_ITEM_ALSO', 'OWN_HOW_BOTH', 'OWN_HOW_WEB', 'OWN_HOW_VISIT', 'REFS_WIKI_SOURCE', 'ERROR_NO_SHELF', 'ERROR_NO_ITEMS', 'ERROR_NO_IDENTITY', 'ERROR_NO_SELLS', 'ERROR_NO_OWNER', 'ERROR_ALL_EMPTY', 'ASK_CHIP', 'ASK_SELL', 'ASK_SELL_BARE', 'TRAIT_HAND', 'TRAIT_GEAR', 'TRAIT_USE', 'TRAIT_USES', 'TALK_NO_STOCK'],
  Director: ['USER_RULES.HEAD', 'LANG.KO', 'LANG.EN', 'MAIN_NOTE.HEAD', 'MAIN_NOTE.ITEM', 'MAIN_NOTE.REACT', 'MAIN_NOTE.MUST_NOT', 'MAIN_NOTE.UNCERTAIN', 'ERR.NO_JSON', 'ERR.SEARCH_IN_PASS2', 'ERR.EMPTY_NEED', 'ERR.NO_NOTES', 'FACTS', 'SCENE'],
  Router: ['USER_RULES.HEAD', 'ERR.NO_JSON', 'ERR.NO_SELECTED', 'ROLE', 'RULES'],
  Consult: ['USER', 'LIST.MENU', 'LIST.NONE', 'PENDING.LINE', 'PENDING.NONE', 'TALK.ME', 'TALK.OP', 'ERR.NO_SAY', 'LABEL.ON', 'LABEL.OFF', 'LABEL.EMPTY', 'LABEL.BLANK', 'CHOICE.NUM', 'CHOICE.STEP', 'CHOICE.STEP_UNIT', 'CHOICE.STEP_STRIDE', 'CHOICE.STEP_BUTTONS', 'CHOICE.TEXT', 'CHOICE.TEXT_MAX', 'CHOICE.TEXT_MULTI', 'CHOICE.TEXT_SINGLE', 'ITEM.INFO', 'ITEM.LINE', 'ITEM.LOCKED', 'ITEM.CHOICES', 'ITEM.SCOPE', 'ITEM.HELP', 'STATE.SUMMARY', 'STATE.SUMMARY_MAYBE', 'STATE.SUMMARY_TOKENS', 'STATE.NOT_STARTED', 'STATE.PRE', 'STATE.MAIN', 'STATE.POST', 'STATE.MANUAL', 'STATE.NODE', 'STATE.NODE_ON', 'STATE.NODE_OFF', 'STATE.NODE_MODEL', 'STATE.NODE_TOKENS', 'STATE.MAIN_NODE', 'STATE.MANUAL_NODE', 'LAST.NONE', 'LAST.HEAD', 'LAST.TOKENS', 'LAST.NO_RECORD', 'LAST.MODEL_MAIN', 'LAST.MODEL_AUX', 'LAST.MODEL_ID', 'LAST.CALL', 'LAST.OK', 'LAST.FAIL', 'LAST.TOTAL', 'MENUS.LINE', 'MENUS.INTRO', 'MENUS.OTHERS_HEAD', 'CATALOG.FOLDED_COUNT', 'CATALOG.FOLDED_NOTE', 'MENUS.LINE_SHORT'],
};
/** 이 지침의 이 절을 비우면 요청에 기본 글이 쓰이나 (편집 화면 표시용) */
export const blankUsesDefault = (name: GuideName, section: string): boolean =>
  BLANK_DEFAULT_ALL.includes(name) || !!BLANK_DEFAULT[name]?.test(section.trim()) || !!BLANK_DEFAULT_MOVED[name]?.includes(section.trim());
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
