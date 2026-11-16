// 괴담넷 요청문 만들기 (원본 RC.gnetPrompt + LB makeIntro/makeOutro).
// 지침 문장은 카드의 GNet 로어북 섹션(옛 카드는 LB Backend도)을 그대로 읽고, CBS는 직접 푼다.
// 결과는 언제나 두 메시지: system(틀 + 작업 지침 + 출력 형식) / user(참고 자료 + 최근 본문 + 현재 작업).
import { sitePicList } from './sitepics';
import { hasAttachment } from './attach';
import { BOARD_GUIDE, viewSite, type BoardSite } from './boards';
import { fillVars, guideDefaultSec, guideTxt, GUIDE_LABEL, type GuideName } from './guides';
import { evaluate } from './cbs';
import {
  activityContext, findPost, gnetSettings, gnetVars, keyFigures, HISTORY, incomingTask, LIMITS, protectedPost, countText, trimTokens, postLimit,
  type ActivityPost, type ActivitySnapshot, type GPost, type GState, type GnetSettings, type IncomingPlan, GnetError, dateNow, whenField } from './gnet';
import { applyAdvanced, genSettings } from './advanced';
import { fnHistory, fnNum, fnRefs } from './reffn';
import { craftMessages, craftSettings, memoTexts, retryAnalyze, type CraftMessage } from './craft';
import { trimRelated, trimSecondary, trimTurns } from './budget';
import { cbsEnv, collectRefs, factionCodesToNames, policySections, recentTurns, refText, storyText, type RefSource } from './refs';

export type GnetOp = 'refresh' | 'post' | 'comment' | 'dm';

const REQUIRED_GNET = [
  'LB', 'LB.EXTRA', 'EXTENSION.REQUEST', 'ACTION.REFRESH', 'AUTO.GUIDELINE', 'AUTO.FORMAT', 'REACT.GUIDELINE', 'DM.GUIDELINE', 'DM.FORMAT',
  'INCOMING.GUIDELINE', 'DM.REQUEST', 'DM.NO-ORIGIN', 'TITLE.GUIDELINE', 'MAIN_CONTEXT', 'PUBLIC.GUIDELINE', 'PUBLIC.REACT_FORMAT',
  'PUBLIC.POST_FORMAT', 'ACTIVITY.GUIDELINE', 'BOARD.GUIDELINE', 'ATTACHMENTS', 'INCOMING.COMBINED', 'INCOMING.DISABLED', 'ACTIVITY.DISABLED',
];
const REQUIRED_LB = ['SYSTEM', 'OUTPUT', 'JAILBREAK', 'JOB'];

/** 사이트마다 따로 쓰는 지침 (2026-11-08 사용자: 공용 없이 전부 따로) */
const SITE_GUIDE: Record<BoardSite, GuideName> = BOARD_GUIDE;
/** 사이트 자체의 세계 로어(조직 항목 이름). 있으면 요청마다 「주제 원본」으로 넣는다 — 관점이 그 사이트 사람들 것이 되게 (11-09 사용자: 정보가 아니라 관점) */
const SITE_LORE: Partial<Record<BoardSite, string[]>> = { wpf: ['세계정치 게시판'] };

export interface GnetBooks {
  read(name: string): string;
  /** read 와 같되, 고친 지침에 절이 없거나 비었으면 기본 지침 파일(지침/*.txt)의 절 (2026-11-14 사용자: 모델에 가는 글은 코드에 두지 않는다) */
  txt(name: string): string;
  /** 출력 언어 문장 (고급 설정 → 생성 언어) */
  language: string;
  /** 지침의 __SITE_PICS__ 자리 채우기: 이번 요청의 최근 본문·게시판/쪽지 내용(material)에 이름이 나온 사진만 (사용자 2026-11-14. 참고 기록은 넣지 않는다). read 는 자리를 그대로 두고, 요청문을 묶을 때(pack) 채운다 */
  pics(text: string, material: string): string;
}

/** GNet 섹션을 읽는 함수. 섹션이 빠졌으면 바로 알린다. 생성 틀(SYSTEM 등)은 옛 카드면 LB Backend에 있다 */
export function gnetBooks(src: RefSource): GnetBooks {
  const guide = SITE_GUIDE[viewSite(src.chat.scriptstate)];
  const g = { ...policySections(src.char.globalLore, 'LB Backend'), ...policySections(src.char.globalLore, guide) };
  for (const k of [...REQUIRED_GNET, ...REQUIRED_LB]) if (g[k] === undefined) throw new GnetError(`${GUIDE_LABEL[guide]} 지침의 ${k} 섹션이 없어요.`);
  applyAdvanced(src.chat.scriptstate);
  const env = { ...cbsEnv(src), vars: gnetVars(src.chat.scriptstate) };
  const cs = gnetSettings(src.chat.scriptstate).counts;
  const proc = (raw: string): string => evaluate(raw, env)
    .replace(/__GN_POST_RANGE__/g, countText(cs.post))
    .replace(/__GN_CMT_RANGE__/g, countText(cs.cmt))
    .replace(/__GN_ACT_RANGE__/g, countText(cs.act))
    .replace(/__GN_REPLY_RANGE__/g, countText([Math.min(LIMITS.replies_min, LIMITS.replies), LIMITS.replies]))
    .replace(/__LIMIT_(\w+?)__/g, (m, k: string) => (k in LIMITS ? String(LIMITS[k as keyof typeof LIMITS]) : m))
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const def = (k: string): string => guideDefaultSec(guide, k) ?? '';
  // 비우면 기본 글이 쓰이는 절: 고친 지침에 없거나 비었으면 기본 지침 파일의 절
  const withDef = (k: string): string => (g[k]?.trim() ? g[k] : def(k));
  return {
    language: genSettings(src.chat.scriptstate).language ?? withDef('LANGUAGE').trim(),
    // 사진 목록 머리말도 이 사이트 지침의 절 (PICS_*. 전수검사 11-13)
    pics: (text, material) => (text.includes('__SITE_PICS__') ? text.replace(/__SITE_PICS__/g, () => sitePicList(src.char, withDef, material)) : text),
    read: (k: string) => proc(g[k] ?? ''),
    txt: (k: string) => proc(g[k] ?? '') || proc(def(k)),
  };
}

/** %s를 차례로 채운다 (Lua string.format) */
function fmt(template: string, ...args: string[]): string {
  let i = 0;
  return template.replace(/%s/g, () => args[i++] ?? '');
}

/** __GN_KEY__ 채우기 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/__GN_([A-Z_]+)__/g, (m, k: string) => values[k] ?? m);
}

export function systemText(b: GnetBooks, guideline: string, format: string, identity?: unknown, attachments = false): string {
  const head = b.txt('SYSTEM.PROTAGONIST_HEAD');
  const intro = fmt(b.read('SYSTEM'), b.read('JAILBREAK'), b.read('JOB'), `\n\n${b.txt('IMPORTANT_NOTE')}`, 'anonymous forum author', '', '')
    .replace(/## Main Protagonist \([^\n]*\)/, () => head);
  let outro = fmt(b.read('OUTPUT'), '', format, guideline);
  if (identity) outro += `\n${b.txt('DM.ROLE_BINDING')}\n${JSON.stringify(identity)}`;
  outro += `\n${b.language}`;
  return `${intro}\n${outro}${attachments ? `\n\n${b.read('ATTACHMENTS.READ')}` : ''}`;
}

export interface GnetPrompt {
  messages: CraftMessage[];
  /** 형식이 틀렸을 때 다시 묻는 글 (지침 절 RETRY.FORMAT) */
  retryRule: string;
}

/** 생각 순서표 절 (작업마다) */
type ThoughtsKey = 'THOUGHTS.REFRESH' | 'THOUGHTS.ACTION' | 'THOUGHTS.DM';

/** fn = 기능(요청 종류): 넘길 내용·챗로그 턴 수를 기능 표·양 표의 그 줄에서 읽는다 (core/reffn.ts) */
function pack(src: RefSource, b: GnetBooks, fn: GnetOp, thoughts: ThoughtsKey, guideline: string, format: string, extras: string, factionNames: Record<string, string>, identity?: unknown): GnetPrompt {
  const n = trimTurns(fnNum(src.chat.scriptstate, 'gn', fn, 'turns'));
  const story = n ? storyText(recentTurns(src.chat, n, genSettings(src.chat.scriptstate).userMessages)) : '';
  const t = fnRefs(src.chat.scriptstate, 'gn', fn);
  const rows = collectRefs(src, {
    scope: 'gnet', text: `${extras}\n${story}`, primaryNames: SITE_LORE[viewSite(src.chat.scriptstate)], description: t.description, authors: t.authors, persona: t.persona, active: t.active,
    related: t.related && !trimRelated(), secondary: t.secondary && !trimSecondary(),
    extra: [{ source: b.txt('REFS.SITUATION_SOURCE'), content: b.read('LB.EXTRA') }],
  });
  // 참고 자료 머리말은 이 게시판 지침의 절 (사용자 2026-11-14 C-4 (나): 공통 지침에서 읽지 않음. 같은 날: 모델에 가는 글은 모두 지침 파일로)
  const material = `${b.txt('REQUEST.HEAD_REFS')}\n${refText(rows)}\n${b.txt('REQUEST.HEAD_STORY')}\n${story}\n${b.txt('REQUEST.HEAD_TASK')}\n${extras}`;
  const attachments = hasAttachment(material);
  // 사진 이름은 최근 본문과 게시판·쪽지 내용(현재 작업)에서만 찾는다. 늘 붙는 참고 기록(🙂Roster 등)에는 모든 인물 이름이 있어 거르기가 듣지 않는다 (사용자 2026-11-14 E-14 물음 2)
  const named = `${story}\n${extras}`;
  const messages: CraftMessage[] = [
    { role: 'system', content: factionCodesToNames(b.pics(systemText(b, guideline, format, identity, attachments), named), factionNames) },
    { role: 'user', content: factionCodesToNames(material, factionNames) },
  ];
  return { messages: craftMessages(messages, craftSettings(src.chat.scriptstate, 'gn'), { thoughts: b.read(thoughts), memo: memoTexts((k) => b.read(k)) }), retryRule: b.txt('RETRY.FORMAT') };
}

function incomingRules(b: GnetBooks, plan: IncomingPlan): string {
  return plan.allowed ? `${b.read('INCOMING.GUIDELINE')}\n${b.read('INCOMING.COMBINED')}` : b.read('INCOMING.DISABLED');
}

function activityRules(b: GnetBooks, posts: ActivityPost[]): string {
  return b.read(posts.length ? 'ACTIVITY.GUIDELINE' : 'ACTIVITY.DISABLED');
}

/**
 * 댓글 시각 (v0.16.32): 새 댓글마다 모델이 「HH:MM」을 쓴다. 앱이 글 시각·부모 댓글·지금 사이로 맞추므로(gnet.ts stampComments)
 * 형식만 알려 준다. 글은 게시판 지침의 COMMENT.TIME_RULE 절 (b 가 없으면 괴담넷 지침).
 */
export function commentTimeRule(now: string, b?: GnetBooks): string {
  return fillVars(b ? b.txt('COMMENT.TIME_RULE') : guideTxt('GNet', 'COMMENT.TIME_RULE'), { now: now ? ` (${now})` : '' });
}

/** 저장된 글을 출력 형식(AUTO.FORMAT)과 같은 모양으로 */
export function boardJson(posts: GPost[]): string {
  return JSON.stringify({
    posts: posts.map((p) => ({
      author: p.nick, id: p.id, ...(p.tag ? { tag: p.tag } : {}), title: p.title, date: p.date, views: p.views, upvotes: p.votes,
      content: p.body, mine: p.mine, comments: p.comments.map((c) => ({ author: c.nick, ...whenField(p, c), content: c.body, parent: c.parent, mine: c.mine })),
    })),
  });
}

/** 주요 인물 닉네임 (write = 이번 응답에 갱신을 쓰게 함). 라이트보드 미니보드 (2026-11-06) */
function boardExtras(src: RefSource, b: GnetBooks, write: boolean): { guideline: string; format: string } {
  const s = gnetSettings(src.chat.scriptstate);
  const parts: string[] = [];
  let format = '';
  if (s.keyFigures) {
    const kept = keyFigures(src.chat.scriptstate);
    if (kept.length) parts.push(fill(b.read('KEYFIGURES.PREVIOUS'), { KEYFIGURES: JSON.stringify(kept) }));
    if (write) {
      parts.push(b.read('KEYFIGURES'));
      format = `\n${b.txt('KEYFIGURES.FORMAT')}`;
    }
  }
  return { guideline: parts.filter(Boolean).join('\n\n'), format };
}

/** 「다른 글 활동」을 끈 요청: 지난 글을 넣지 않는다 (지침은 ACTIVITY.DISABLED 절) */
const noActivity = (): ReturnType<typeof activityContext> => ({ posts: [], snapshots: new Map() });

const seed = () => Math.floor(Math.random() * 2147483647).toString(36);

// ── 작업별 ──

export function refreshPrompt(src: RefSource, st: GState, plan: IncomingPlan, nick: string, factionNames: Record<string, string>): GnetPrompt {
  const s = gnetSettings(src.chat.scriptstate);
  const b = gnetBooks(src);
  const guideline = [
    `${b.read('LB')}\n\n${b.read('BOARD.GUIDELINE')}`,
    b.read('AUTO.GUIDELINE'),
    `${b.read('ATTACHMENTS')}\n${incomingRules(b, plan)}`,
  ];
  const ex = boardExtras(src, b, true);
  if (ex.guideline) guideline.push(ex.guideline);
  let format = `${b.read('AUTO.FORMAT')}\n${commentTimeRule(dateNow(src.chat), b)}\n${b.txt('POST.TAG_RULE')}${ex.format}`;
  if (s.sampling) {
    // 원본 미니보드 5.0.0: 두 벌 각각 확률을 적게 하고, 요청마다 무작위 씨앗 둘을 넣는다 (씨앗 줄 꼴은 SAMPLING.SEED 절)
    format += `\n${b.txt('SAMPLING')}`
      + `\n${fillVars(b.txt('SAMPLING.SEED'), { a: seed(), b: seed() })}`;
  }
  const protectedIds: number[] = [];
  const reference = st.posts.filter((p, i) => {
    const prot = protectedPost(s, p);
    if (prot) protectedIds.push(p.id);
    return prot || i < HISTORY.refresh;
  });
  const action = b.read('ACTION.REFRESH');
  const extras = fill(b.read('EXTENSION.REQUEST'), {
    TIME: dateNow(src.chat), USER_NICK: nick, KEEP_OWN: String(s.keepOwn), KEEP_REPLIED: String(s.keepReplied), PROTECTED: protectedIds.join(','),
    POST_LIMIT: String(postLimit(s)), NEXT_ID: String(st.seq || 100000), ACTION: action, BOARD: boardJson(reference),
  }) + incomingTask(plan, b.txt('INCOMING.OPTIONS_HEAD'));
  return pack(src, b, 'refresh', 'THOUGHTS.REFRESH', guideline.join('\n\n'), format, extras, factionNames);
}

export interface PublicPrompt extends GnetPrompt {
  activity: { posts: ActivityPost[]; snapshots: Map<number, ActivitySnapshot> };
}

/** 새 글: 사용자가 적은 내용(아이디어 또는 본문)으로 제목·본문을 다듬고, 같은 응답에 댓글·선쪽지·다른 글 활동.
 *  tag: 글쓴이가 고른 말머리 (연어 마켓 팝니다·삽니다). 있으면 POST.INPUT_TAG 절 꼴로 붙인다 */
export function postPrompt(src: RefSource, st: GState, input0: string, plan: IncomingPlan, factionNames: Record<string, string>, tag = ''): PublicPrompt {
  const b = gnetBooks(src);
  const input = tag ? fillVars(b.txt('POST.INPUT_TAG'), { tag, input: input0 }) : input0;
  const activity = HISTORY.activity ? activityContext(st, null, fnHistory(src.chat.scriptstate, 'gn', 'post')) : noActivity();
  const guideline = [b.read('LB'), b.read('ATTACHMENTS'), b.read('TITLE.GUIDELINE'), b.read('REACT.GUIDELINE'), b.read('PUBLIC.GUIDELINE'), incomingRules(b, plan), activityRules(b, activity.posts), boardExtras(src, b, false).guideline].filter(Boolean).join('\n\n');
  // 선쪽지의 출처가 지금 쓰는 글(번호 0)이면 그 내용은 위 input 에 이미 있다
  const extras = input + incomingTask(plan, b.txt('INCOMING.OPTIONS_HEAD'), activity.posts, plan.post?.id === 0 ? 'draft' : undefined);
  // 말머리를 글쓴이가 골랐으면(연어 마켓) 그 말머리를 쓰므로 모델에게 post.tag 를 쓰게 하지 않는다
  const tagFormat = tag ? '' : `\n${b.txt('POST.TAG_FORMAT')}`;
  return { ...pack(src, b, 'post', 'THOUGHTS.ACTION', guideline, `${b.read('PUBLIC.POST_FORMAT')}\n${commentTimeRule(dateNow(src.chat), b)}${tagFormat}`, extras, factionNames), activity };
}

export interface CommentPrompt extends PublicPrompt {
  supplied: Set<number>;
  total: number;
}

/** 내 댓글(이미 저장됨)에 대한 반응. replyTo: 방금 저장한 내 댓글 번호 (원본 react의 commentIndex) */
export function commentPrompt(
  src: RefSource, st: GState, postId: number, replyTo: number, body: string, plan: IncomingPlan, nick: string, factionNames: Record<string, string>,
  action0?: string,
  /** 글 하나만 새로고침은 「새로고침」 줄을 따른다 */
  fn: GnetOp = 'comment',
): CommentPrompt {
  const b = gnetBooks(src);
  // 글 하나만 새로고침(POST_REFRESH_ACTION)과 내 댓글 알림 문장은 지침 절 ACTION.POST_REFRESH · ACTION.COMMENT
  const action = action0 === undefined ? fillVars(b.txt('ACTION.COMMENT'), { body })
    : action0 === POST_REFRESH_ACTION ? b.txt('ACTION.POST_REFRESH') : action0;
  const p = findPost(st, postId);
  if (!p) throw new GnetError('대상 글이 없어졌어요.');
  // 원본과 같이: 글에 단 댓글은 "글" 범위(전체 댓글), 답글은 "댓글" 범위(최근 30개)
  const limit = replyTo > 0 ? HISTORY.comment : HISTORY.post;
  const total = p.comments.length;
  const selected = new Set<number>();
  for (let i = Math.max(1, total - limit + 1); i <= total; i++) selected.add(i);
  if (replyTo > 0) selected.add(replyTo);
  // 선쪽지의 출처가 이 글의 댓글이면 그 댓글은 comments 에만 싣고 incomingOrigin 에는 index 만 넣는다
  const fromHere = plan.allowed && plan.post?.id === p.id;
  if (fromHere && plan.commentIndex && p.comments[plan.commentIndex - 1]) selected.add(plan.commentIndex);
  for (const i of [...selected]) {
    let n = i;
    const seen = new Set<number>();
    while (p.comments[n - 1] && !seen.has(n)) {
      seen.add(n);
      selected.add(n);
      n = p.comments[n - 1].parent;
    }
  }
  const comments = p.comments.map((c, i) => ({ index: i + 1, parent: c.parent, author: c.nick, ...whenField(p, c), content: c.body, mine: c.mine })).filter((c) => selected.has(c.index));
  const task = JSON.stringify({
    post: { id: p.id, author: p.nick, title: p.title, content: p.body }, comments, commentCount: total, replyTo,
    action, userHandle: nick,
  });
  const activity = HISTORY.activity ? activityContext(st, p.id) : noActivity();
  const guideline = [b.read('LB'), b.read('ATTACHMENTS'), b.read('REACT.GUIDELINE'), b.read('PUBLIC.GUIDELINE'), incomingRules(b, plan), activityRules(b, activity.posts), boardExtras(src, b, false).guideline].filter(Boolean).join('\n\n');
  // 선쪽지의 출처가 이 글이면 본문은 위 task 의 post 에 이미 있다
  const extras = task + incomingTask(plan, b.txt('INCOMING.OPTIONS_HEAD'), activity.posts, fromHere ? 'post' : undefined);
  return { ...pack(src, b, fn, 'THOUGHTS.ACTION', guideline, `${b.read('PUBLIC.REACT_FORMAT')}\n${commentTimeRule(dateNow(src.chat), b)}`, extras, factionNames), activity, supplied: selected, total };
}

/** 글 하나만 새로고침: 시간이 흘러 다른 사람들이 이 글에 댓글을 더 단다 (주인공은 아무것도 하지 않음).
 *  commentPrompt 의 action0 으로 넘기는 표시일 뿐이고, 모델에 가는 글은 지침 절 ACTION.POST_REFRESH */
export const POST_REFRESH_ACTION = '__POST_REFRESH__';

/** 공개 글 참고의 안내 글 (지금 보는 게시판 지침의 PUBLIC.ACCESS 절, 비었으면 기본 지침 파일의 절) */
export const publicAccess = (src: RefSource): string => guideTxt(SITE_GUIDE[viewSite(src.chat.scriptstate)], 'PUBLIC.ACCESS');

/** 공개 글 참고 (원본 RC.gnetPublic): 쪽지에서 언급된 글을 앞에, 최대 max 개(0이면 넣지 않음). access = PUBLIC.ACCESS 절 글.
 *  origin: 같은 요청에 원글로 이미 실린 글 (쪽지 답장의 PUBLIC ORIGIN). 그 글의 본문이 원글과 같으면 여기서는 본문을 빼고 번호·제목·댓글만 넘긴다 */
export function publicBoard(st: GState, query: string, access: string, max = 8, origin?: { postid: number; body: string }): { access: string; posts: unknown[] } | null {
  const ranked = st.posts.map((p, i) => ({ p, i, hit: (!!p.title && query.includes(p.title)) || new RegExp(`#${p.id}(?![\\d.])`).test(query) }));
  ranked.sort((a, b) => (a.hit !== b.hit ? (a.hit ? -1 : 1) : a.i - b.i));
  const rows: unknown[] = [];
  let used = 0;
  const cap = 6000;
  for (const { p } of ranked) {
    if (rows.length >= max) break;
    const comments = p.comments.slice(-12).map((c, j, arr) => ({ id: p.comments.length - arr.length + j + 1, parent: c.parent, author: c.nick, ...whenField(p, c), content: trimTokens(c.body, LIMITS.quote_tokens) }));
    const content = trimTokens(p.body, LIMITS.origin_tokens);
    const row = { id: p.id, title: p.title, author: p.nick, date: p.date, ...(origin && origin.postid === p.id && origin.body === content ? {} : { content }), comments };
    while (JSON.stringify(row).length > (cap - used) * 2 && row.comments.length) row.comments.shift();
    const n = Math.ceil(JSON.stringify(row).length / 2);
    if (used + n <= cap) {
      rows.push(row);
      used += n;
    }
  }
  if (!rows.length) return null;
  return {
    access: access.trim(),
    posts: rows,
  };
}

export function dmPrompt(src: RefSource, st: GState, nick: string, latest: string, userHandle: string, factionNames: Record<string, string>): GnetPrompt {
  const b = gnetBooks(src);
  const source = st.sources[nick];
  let anchor = b.read('DM.NO-ORIGIN');
  if (source) {
    // 원글 줄 꼴은 지침 절 DM.ORIGIN · DM.ORIGIN_QUOTE, 작성자 모름 문장은 DM.QUOTE_UNKNOWN (전수검사 11-13)
    anchor = [
      fillVars(b.txt('DM.ORIGIN'), { postid: source.postid, title: source.title, author: source.author, body: source.body }),
      source.quote ? fillVars(b.txt('DM.ORIGIN_QUOTE'), { author: source.quoteAuthor.trim() || b.txt('DM.QUOTE_UNKNOWN'), quote: source.quote }) : '',
    ].join('\n');
  }
  const lines: unknown[] = [];
  for (let i = st.dms.length - 1; i >= 0 && lines.length < HISTORY.dmHistory; i--) {
    const d = st.dms[i];
    if (d.nick !== nick) continue;
    lines.unshift({
      speaker: d.side === 'me' ? 'user' : 'npc_correspondent', handle: d.side === 'me' ? userHandle : nick, date: d.date,
      content: d.side === 'me' ? d.body : trimTokens(d.body, LIMITS.history_tokens),
    });
  }
  let task = `${fillVars(b.txt('DM.STORY_TIME'), { time: dateNow(src.chat) })}\n${fill(b.read('DM.REQUEST'), { NICK: nick, ORIGIN: anchor, HISTORY: JSON.stringify(lines) })}`;
  const pub = publicBoard(st, `${latest}\n${anchor}`, b.txt('PUBLIC.ACCESS'), HISTORY.dmPublic, source);
  if (pub) task += `\n${b.txt('DM.PUBLIC_HEAD')}\n${JSON.stringify(pub)}`;
  const identity = { speaker: { role: 'npc_correspondent', handle: nick }, owner: { role: 'user', handle: userHandle, personaName: guideTxt('Common', 'REFS.USER_NAME'), referenceOnly: true } };
  const about = /^## About the board\n[^\n]+/m.exec(b.read('LB'))?.[0] ?? '';
  return pack(src, b, 'dm', 'THOUGHTS.DM', [about, b.read('DM.GUIDELINE'), b.read('ATTACHMENTS')].filter(Boolean).join('\n\n'), b.read('DM.FORMAT'), task, factionNames, identity);
}

/** 쪽지 답장이 형식에 안 맞을 때 한 번 더 (원본 재시도 문구, 지침 절 RETRY.FORMAT) */
export function retryMessages(prompt: GnetPrompt, raw: string, error: string, rule: string = prompt.retryRule): CraftMessage[] {
  return [
    ...prompt.messages,
    { role: 'assistant', content: raw },
    { role: 'user', content: fillVars(rule.trim(), { error, analyze: retryAnalyze() }) },
  ];
}

/** 본편 요청에 붙이는 기록 앞의 안내문 */
export function mainContextRules(src: RefSource): string | null {
  const g = policySections(src.char.globalLore, SITE_GUIDE[viewSite(src.chat.scriptstate)]);
  return g.MAIN_CONTEXT?.trim() || null;
}

export type { GnetSettings };
