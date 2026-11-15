// 망상홈쇼핑 시청 기록 → 본편 참고 기록 (2026-11-12 사용자: 기능에서 본 것·친 것은 전부 본편 모델에 닿아야 한다).
// 미리 받아 둔 편성 전체가 아니라 **화면에 실제로 나온 것만** 적는다: 진행자 대사(큐가 시작된 것) · 흐른 시청자 채팅 · 내가 친 채팅과 돌아온 반응 · 전화 주문·맞교환.
// 지금 편성 하나의 기록만 둔다 (새 편성을 받으면 갈아 끼운다). 여기는 순수 계산: 저장 모양 · 덧붙이기 · 본편에 넘길 글. 모으기·저장은 ui/hsplayer.ts · ui/homeshop.ts.
import { tokens } from './gnet';
import { related, type Focus } from './focus';
import { guideTxt } from './guides';
import { aliveAnchors } from './wallet';
import { HS_KEY, liveOrders, type HsShow } from './homeshop';
import { messageKey } from './people/store';
import type { Chat } from './types';

/** 시청 기록 (채팅 변수, JSON) */
export const HS_LOG_VAR = '$hs_log';
/** 기록 줄 수 한계: 넘으면 오래된 줄부터 버린다 (변수가 끝없이 자라지 않게. 내 채팅·주문은 맨 나중에 버린다) */
export const HS_LOG_MAX = 400;
/** 진행자 줄의 who: 지침 「망상홈쇼핑」의 LOG_HOST_NICK 절. 적는 쪽(ui/hsplayer.ts)과 가려내는 쪽(여기)이 같은 절을 읽는다 */
export const hsLogHost = (): string => guideTxt('Hs', 'LOG_HOST_NICK');
const TEXT_MAX = 200;

type Vars = Record<string, unknown> | undefined;

/** show = 진행자 대사(와 편성 제목·상품) · chat = 시청자 채팅 · say = 내 채팅과 그 반응 · buy = 전화 주문·맞교환 · aside = 들춰 본 스티커 밑 한 줄과 전화 주문 상담원의 말 */
export type HsLogKind = 'show' | 'chat' | 'say' | 'buy' | 'aside';
export const HS_LOG_KINDS: HsLogKind[] = ['show', 'chat', 'say', 'buy', 'aside'];
/** 따로 정하지 않았을 때 넘기는 종류: 스티커·상담원 말(aside)은 전에는 메인 요청에 가지 않던 것이라 켠 때만 넘긴다 */
export const HS_LOG_DEF: HsLogKind[] = ['show', 'chat', 'say', 'buy'];
/** aside 줄의 who: 스티커 밑 한 줄은 지침 「망상홈쇼핑」의 LOG_STICKER_NICK 절, 상담원 말은 LOG_OPERATOR_NICK 절 */
export const hsLogSticker = (): string => guideTxt('Hs', 'LOG_STICKER_NICK');
export const hsLogOperator = (): string => guideTxt('Hs', 'LOG_OPERATOR_NICK');
export interface HsLogEntry {
  k: HsLogKind;
  /** 몇 부 (0부터) */
  p: number;
  /** 닉네임 또는 「진행자」 */
  who: string;
  text: string;
  /** say: 내가 친 줄 (없으면 돌아온 반응) */
  me?: 1;
  /** buy: 주문 id (그 주문이 없던 일이 되면 본편에 넘기지 않는다) */
  ref?: string;
}
export interface HsLogItem { name: string; pay: string; desc: string }
export interface HsLog {
  /** 편성 열쇠(받은 응답 키) · 첫 상품 id (같은 턴에 새로 받은 편성도 가려내게) */
  key: string;
  pid: string;
  title: string;
  /** 화면에 나온 부의 상품 (부 번호 → 상품) */
  items: Record<string, HsLogItem>;
  entries: HsLogEntry[];
  /** 마지막으로 줄을 적은 턴 (core/shop.ts turnKey). 「최근 N턴만 넘기기」가 이 턴부터 센다. 없는 옛 기록은 세지 않는다 */
  at?: string;
}
export const emptyLog = (): HsLog => ({ key: '', pid: '', title: '', items: {}, entries: [] });

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isKind = (k: unknown): k is HsLogKind => (HS_LOG_KINDS as unknown[]).includes(k);
function entryOf(e: unknown): HsLogEntry | null {
  if (!e || typeof e !== 'object') return null;
  const x = e as Partial<HsLogEntry>;
  const text = clean(x.text, TEXT_MAX);
  if (!isKind(x.k) || !text) return null;
  return { k: x.k, p: Math.max(0, Math.floor(Number(x.p) || 0)), who: clean(x.who, 24), text, ...(x.me ? { me: 1 as const } : {}), ...(typeof x.ref === 'string' && x.ref ? { ref: x.ref } : {}) };
}

export function readLog(vars: Vars): HsLog {
  const raw = vars?.[HS_LOG_VAR];
  if (typeof raw !== 'string' || !raw) return emptyLog();
  try {
    const j = JSON.parse(raw) as Partial<HsLog>;
    if (!j || typeof j !== 'object' || !Array.isArray(j.entries)) return emptyLog();
    const items: Record<string, HsLogItem> = {};
    for (const [p, it] of Object.entries(j.items && typeof j.items === 'object' ? j.items : {})) {
      if (it && typeof it === 'object' && typeof it.name === 'string') items[p] = { name: it.name, pay: String(it.pay ?? ''), desc: String(it.desc ?? '') };
    }
    return { key: String(j.key ?? ''), pid: String(j.pid ?? ''), title: String(j.title ?? ''), items, entries: j.entries.map(entryOf).filter((e): e is HsLogEntry => !!e), ...(typeof j.at === 'string' && j.at ? { at: j.at } : {}) };
  } catch {
    return emptyLog();
  }
}
export const logVars = (log: HsLog): Record<string, string> => ({ [HS_LOG_VAR]: log.entries.length ? JSON.stringify(log) : '' });

/** 이 편성의 것인가 (열쇠와 첫 상품 id) */
const showPid = (show: Pick<HsShow, 'parts'>): string => String(show.parts[0]?.item.id ?? '');
export const sameProgram = (a: Pick<HsShow, 'key' | 'parts'>, b: Pick<HsShow, 'key' | 'parts'>): boolean => a.key === b.key && showPid(a) === showPid(b);

/** 내 채팅·주문: 한계·상한에 걸려도 맨 나중에 버린다 */
const mine = (e: HsLogEntry) => e.k === 'buy' || (e.k === 'say' && !!e.me);

/**
 * 화면에 나온 줄을 덧붙인다. 다른 편성이면 기록을 갈아 끼운다 (지금 편성 하나만).
 * 대본 줄(진행자 대사·시청자 채팅)과 스티커·상담원 말은 같은 부를 다시 틀어도 한 번만 적는다. 돌려주는 것은 채팅 변수 조각 (바뀐 것이 없으면 빈 것).
 * turn: 적는 때의 턴 열쇠 (core/shop.ts turnKey). 주면 기록에 남겨 「최근 N턴만 넘기기」가 이 턴부터 센다
 */
export function appendLog(vars: Vars, show: Pick<HsShow, 'key' | 'title' | 'parts'>, entries: HsLogEntry[], turn = ''): Record<string, string> {
  const add = entries.map(entryOf).filter((e): e is HsLogEntry => !!e);
  if (!add.length) return {};
  const old = readLog(vars);
  const same = old.key === show.key && old.pid === showPid(show);
  const log: HsLog = same ? { ...old, title: clean(show.title, 60), items: { ...old.items }, entries: [...old.entries] } : { key: show.key, pid: showPid(show), title: clean(show.title, 60), items: {}, entries: [] };
  const id = (e: HsLogEntry) => `${e.k}\u0001${e.p}\u0001${e.who}\u0001${e.text}`;
  const once = (e: HsLogEntry) => e.k === 'show' || e.k === 'chat' || e.k === 'aside';
  const seen = new Set(log.entries.filter(once).map(id));
  let changed = !same;
  for (const e of add) {
    if (once(e)) {
      if (seen.has(id(e))) continue;
      seen.add(id(e));
    }
    log.entries.push(e);
    changed = true;
    const it = show.parts[e.p]?.item;
    if (it && !log.items[e.p]) log.items[e.p] = { name: clean(it.name, 60), pay: clean(it.pay || (it.price > 0 ? guideTxt('Hs', 'LOG_PAY_WON', { price: it.price.toLocaleString('en-US') }) : ''), 40), desc: clean(it.desc, 200) };
  }
  // 같은 줄을 다시 본 것뿐이어도 본 턴은 새로 적는다 (「넘기는 기간」이 마지막으로 본 턴부터 세게)
  if (turn && log.at !== turn) { log.at = turn; changed = true; }
  if (!changed) return {};
  // 한계: 내 채팅·주문이 아닌 오래된 줄부터, 그래도 넘으면 가장 오래된 줄부터
  let over = log.entries.length - HS_LOG_MAX;
  if (over > 0) {
    log.entries = log.entries.filter((e) => mine(e) || over-- <= 0);
    if (log.entries.length > HS_LOG_MAX) log.entries = log.entries.slice(-HS_LOG_MAX);
  }
  return logVars(log);
}

// ── 설정 (채팅 변수. 설정 화면은 다른 곳에서 이 표를 읽어 만든다) ──

export const HS_MAIN_KEY = { on: '$hs_main', kinds: '$hs_main_kinds', tokens: '$hs_main_tokens', turns: '$hs_main_turns' } as const;
/** 설정 표: 변수 이름 · 기본값 · 범위 · 화면 이름 (제안) */
export const HS_MAIN_SET = {
  on: { key: HS_MAIN_KEY.on, def: '1', values: ['1', '0'], label: '시청 기록을 메인 요청에 넘기기', hint: '방송에서 본 것·친 채팅·주문을 메인 요청의 참고 기록으로 넣어요' },
  kinds: {
    key: HS_MAIN_KEY.kinds, def: HS_LOG_DEF.join(','), values: HS_LOG_KINDS, label: '넘길 기록',
    labels: { show: '방송 내용(편성 제목·상품·진행자 대사)', chat: '시청자 채팅', say: '내 채팅과 반응', buy: '전화 주문·맞교환', aside: '스티커·상담원 말' } as Record<HsLogKind, string>,
  },
  tokens: { key: HS_MAIN_KEY.tokens, def: 3000, lo: 0, hi: 200000, unit: '토큰', label: '컨텍스트 토큰 상한', zero: '제한 없음' },
  /** 마지막으로 방송을 본 턴부터 몇 턴 동안 넘기나. 0 = 다음 편성을 받을 때까지 (전과 같은 동작) */
  turns: { key: HS_MAIN_KEY.turns, def: 0, lo: 0, hi: 99, unit: '턴', label: '넘기는 기간', zero: '제한 없음' },
} as const;
export interface HsMainSettings { on: boolean; kinds: HsLogKind[]; tokens: number; turns: number }
export function hsMainSettings(vars: Vars): HsMainSettings {
  const rawKinds = vars?.[HS_MAIN_KEY.kinds];
  const picked = typeof rawKinds === 'string' && rawKinds !== '' ? rawKinds.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(isKind) : null;
  const t = HS_MAIN_SET.tokens;
  const n = Number(vars?.[t.key]);
  const raw = vars?.[t.key];
  const u = HS_MAIN_SET.turns;
  const un = Number(vars?.[u.key]);
  const uraw = vars?.[u.key];
  return {
    on: vars?.[HS_MAIN_KEY.on] !== '0',
    // 「none」처럼 아는 종류가 하나도 없는 글이면 아무것도 안 넘긴다 (비었거나 없으면 기본 = 전부)
    kinds: picked ? HS_LOG_KINDS.filter((k) => picked.includes(k)) : [...HS_LOG_DEF],
    tokens: raw === undefined || raw === '' || !Number.isFinite(n) ? t.def : Math.max(t.lo, Math.min(t.hi, Math.round(n))),
    turns: uraw === undefined || uraw === '' || !Number.isFinite(un) ? u.def : Math.max(u.lo, Math.min(u.hi, Math.round(un))),
  };
}
/** 본편에 넘길 것이 있나 (기록이 있고 켜져 있을 때) */
/** 망상홈쇼핑에서 산 물건을 메인 요청에 넘기나: 망상홈쇼핑 줄 「컨텍스트 포함」과 「구매」 칸 (전수검사 11-13) */
export const hsBuyPasses = (vars: Vars): boolean => { const m = hsMainSettings(vars); return m.on && m.kinds.includes('buy'); };
/** 망상홈쇼핑을 꺼 두었으면 남아 있는 옛 시청 기록도 넘기지 않는다 */
export const hsMainOn = (vars: Vars): boolean => !!vars?.[HS_LOG_VAR] && vars?.[HS_KEY.on] !== '0' && hsMainSettings(vars).on && hsMainSettings(vars).kinds.length > 0;

/** 기록을 마지막으로 적은 턴 뒤로 본편 응답이 몇 번 더 나왔나. 그 턴을 못 찾으면(옛 기록·지워진 메시지) 0 */
export function hsLogAge(chat: Chat, log: Pick<HsLog, 'at'>): number {
  const m = /^t:(.+)$/.exec(log.at ?? '');
  if (!m) return 0;
  const list = chat.message ?? [];
  // 't:first:N' = 앞 메시지가 없는 N번 자리의 응답 (core/shop.ts turnKeyAt). 그 응답 바로 앞 자리부터 센다
  const first = /^first:(\d+)$/.exec(m[1]);
  if (first && list[Number(first[1])]?.role !== 'char') return 0;
  const from = first ? Number(first[1]) - 1 : list.findIndex((x, i) => messageKey(x, i) === m[1]);
  if (!first && from < 0) return 0;
  let bots = 0;
  for (let i = from + 1; i < list.length; i++) if (list[i].role === 'char') bots++;
  return Math.max(0, bots - 1);
}

/** 머리말: 지침 「망상홈쇼핑」의 MAIN_CONTEXT 절 (고친 지침에 없거나 비었으면 기본 지침 파일의 절. 2026-11-14 사용자: 코드에 글을 두지 않는다) */
export const hsMainRules = (): string => guideTxt('Hs', 'MAIN_CONTEXT');

// ── 본편 요청에 넣는 글 (괴담넷·괴담톡·위키와 같은 틀: 머리말 + JSON 기록) ──

type Line = Record<string, string>;
function lineOf(e: HsLogEntry): Line {
  if (e.k === 'show') return { type: 'host', text: e.text };
  if (e.k === 'chat') return { type: 'viewer', nick: e.who, text: e.text };
  if (e.k === 'buy') return { type: 'user_order', text: e.text };
  if (e.k === 'aside') return e.who === hsLogSticker() ? { type: 'under_the_usage_sticker', text: e.text } : { type: 'phone_order_operator', text: e.text };
  if (e.me) return { type: 'user_chat', nick: e.who, text: e.text };
  return e.who === hsLogHost() ? { type: 'host_reply_to_user', text: e.text } : { type: 'viewer_reply_to_user', nick: e.who, text: e.text };
}

/**
 * 시청 기록을 본편 참고 기록 글로. 상품(부)마다 묶고, 넘길 종류($hs_main_kinds)와 토큰 상한을 지킨다.
 * 상한을 넘으면 오래된 시청자 채팅 → 오래된 진행자 대사 → 반응 줄 순서로 버리고, 내 채팅·주문은 맨 나중에야 버린다 (장면과 관련된 줄은 같은 갈래 안에서 더 늦게).
 * cap 을 안 주면 설정 값, 0 이면 제한 없음. 꺼져 있거나 넘길 것이 없으면 빈 글
 */
export function hsMainContext(chat: Chat, rule: string, focus?: Focus | null, cap?: number): string {
  const vars = chat.scriptstate;
  const set = hsMainSettings(vars);
  if (!set.on || !set.kinds.length || vars?.[HS_KEY.on] === '0') return '';
  const log = readLog(vars);
  // 「넘기는 기간」: 마지막으로 방송을 본 턴부터 그 턴 수만큼만 넘긴다 (0 = 다음 편성을 받을 때까지)
  if (set.turns > 0 && hsLogAge(chat, log) >= set.turns) return '';
  // 없던 일이 된 주문(주문한 응답이 지워짐)은 뺀다
  const orders = log.entries.some((e) => e.k === 'buy' && e.ref) ? new Set(liveOrders(vars, aliveAnchors(chat)).map((o) => o.id)) : null;
  const entries = log.entries.filter((e) => set.kinds.includes(e.k) && !(e.k === 'buy' && e.ref && !orders?.has(e.ref)));
  if (!entries.length) return '';
  const limit = cap ?? set.tokens;
  const withShow = set.kinds.includes('show');
  const access = guideTxt('Hs', 'MAIN_CONTEXT_ACCESS');
  const payload = (dropped: Set<number>): string => {
    const records: Record<string, unknown>[] = [];
    let cur: { part: number; lines: Line[] } | null = null;
    entries.forEach((e, i) => {
      if (dropped.has(i)) return;
      if (!cur || cur.part !== e.p) {
        const it = log.items[e.p];
        const lines: Line[] = [];
        cur = { part: e.p, lines };
        records.push({ kind: 'broadcast_item', part: e.p + 1, ...(withShow && it ? { item: it.name, ...(it.pay ? { payment: it.pay } : {}), ...(it.desc ? { description: it.desc } : {}) } : {}), lines });
      }
      cur.lines.push(lineOf(e));
    });
    if (!records.length) return '';
    return `[MODULE_CONTEXT_BEGIN]\n${rule}\n${JSON.stringify({ feature: 'homeshop', ...(withShow && log.title ? { program: log.title } : {}), access, records })}\n[MODULE_CONTEXT_END]`;
  };
  const none = new Set<number>();
  if (!(limit > 0) || tokens(payload(none)) <= limit) return payload(none);
  // 버리는 순서: 갈래(시청자 채팅 → 진행자 대사 → 반응 → 내 채팅·주문), 갈래 안에서는 장면과 무관한 것 먼저 · 오래된 것 먼저
  const rank = (e: HsLogEntry) => (e.k === 'chat' ? 0 : e.k === 'show' ? 1 : mine(e) ? 3 : 2);
  const host = hsLogHost();
  const rel = entries.map((e) => (focus ? related(focus, e.who === host ? [] : [e.who], e.text) : false));
  const order = entries.map((_, i) => i).sort((a, b) => rank(entries[a]) - rank(entries[b]) || Number(rel[a]) - Number(rel[b]) || a - b);
  // 몇 개를 버려야 들어가나 (버릴수록 줄어드니 이분 탐색)
  const fits = (n: number) => tokens(payload(new Set(order.slice(0, n)))) <= limit;
  let lo = 1;
  let hi = order.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo >= order.length ? '' : payload(new Set(order.slice(0, lo)));
}
