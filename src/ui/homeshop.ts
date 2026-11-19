// 망상홈쇼핑 사이트 화면 (2026-11-11 사용자: 컷 A·B 두 장면으로 방송 화면 구현. 인터넷 즐겨찾기로도, 카드로 연 독립 창(인터넷 창만)으로도 같은 화면).
// 모양은 11-10 도트 시안(site_mock_dot: 도트 글꼴·2px 테두리·판 색)을 그대로. 방송 칸은 재생기(ui/hsplayer.ts)가 그린다.
// 편성 호출은 상점 요청문(core/shop.ts shelfPrompt)에 방송 절(지침 「망상홈쇼핑」 BROADCAST)을 붙여 한 번에: 상품·상품마다 큐시트·채팅.
// 설정은 우주몰·포인트몰과 같은 틀(설정 → 인터넷 → 망상홈쇼핑). 재생 규칙·효과·속도 모두 설정에서 고친다.
import { stepNext } from '../core/stepval';
import { needAttr } from './needfill';
import { shopGive, type ShopFn } from '../core/shopfn';
import { defGroups, type Wire } from './setrow';
import { HOMESHOP_SET, HS_DEF_TEXT, HS_FLAG, HS_PAIRS, HS_RETRY_KEY, HS_TEL_KEY } from '../core/setdef/homeshop';
export { HS_RETRY_KEY, HS_TEL_KEY };
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { generate, type LlmMessage } from '../host/llm';
import { genSettings } from '../core/advanced';
import { broadcastMaterial, emptyShop, lastBot, operatorPrompt, programPrompt, shopBlocked, turnKey, type ShopState } from '../core/shop';
import { addWalletEntry, freshWalletId, readWallet, walletBalance, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { getPrefs } from '../core/settings';
import { traitsText } from '../core/itemtraits';
import { aliveAnchors } from '../core/wallet';
import { addItem, addItemLog, itemId, itemLeft, liveItemsOf, readItems, itemsVars, removeItem, sellItem, type Item } from '../core/items';
import { userTurns } from '../core/request';
import { userInfo } from '../host/user';
import { fillGuide, guideSections, guideTxt } from '../core/guides';
import { defStored } from '../core/deftext';
import { applyShow, boxOrder, CLIP_GROUP_LABEL, CUE_CUT_WORD, CUE_EVENT_WORD, HS_AT_VAR, HS_AUD_VAR, HS_BOX, HS_TEL_DEFAULT, hsHost, HS_KEY, hsName, HS_NUM, hsNumVars, hsPayText, hsReach, hsSettings, hsVars, liveOrders, moodMap, newOrder, openOrder, orderOpened, orderPaid, ordersVars, paidOf, pruneOrders, parseCue, parseOperator, parseShow, stickerLook, readAudience, readOrders, readShow, showVars, termsText, turnStep, type HsCue, type HsOrder, type HsPay, type HsPart, type HsScale, type HsSettings, type HsShow, type HsTerms } from '../core/homeshop';
import { ensureHomeshop, homeshopArt, homeshopStatus, onHomeshopReady } from '../host/homeshop';
import { mountPlayer, playerCut, playerHold, playerPhone, playerRecentChat, playerSay, playerState, playerTake, setPlayerFeed, stopPlayer } from './hsplayer';
import { shopSource } from './shop';
import { itemPic } from './items';
import { isPhone } from './media';
import { playerFlush } from './hsplayer';
import { appendLog, hsLogOperator, hsLogSticker, sameProgram, type HsLogEntry } from '../core/hslog';
import { isWaiting, onWaiting } from '../host/waiting';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface HsEnv {
  render(): void;
  refresh(): Promise<void>;
  current(): ChatContext | null;
}

interface View {
  loading: boolean;
  notice: string;
  failRaw: string;
  page: '' | 'sched' | 'orders';
  /** 자동 다시 연결을 몇 번 했나 (이번 실패 묶음) */
  retried: number;
  /** 떠 있는 창: 전화 주문 · 스티커 보기 · 방청 신청 */
  pop: '' | 'call' | 'peek' | 'aud';
  /** 전화 주문: 결제 방법 · 맞교환으로 내밀 물건 · 상담원에게 할 말 · 상담원 답을 기다리는 중 · 끝난 뒤 상담원 말 */
  pay: HsPay;
  offer: string[];
  opInput: string;
  calling: boolean;
  done: string;
  /** 상담원과의 통화 (지금 부 상품에만. 부가 바뀌면 새로): 주고받은 말 · 상담원이 마지막으로 내놓은 조건 · 마지막으로 감정받은 물건 */
  call: { pid: string; lines: { who: 'me' | 'op'; text: string }[]; terms: HsTerms | null; offered: string[] } | null;
  /** 스티커를 들췄나 · 끌다 놓은 자리(그 자리부터 마저 젖힌다) · 방청 규칙 동의 · 방금 접수한 번호 */
  lifted: boolean;
  peelFrom: number;
  agree: boolean;
  audNo: string;
  /** 채팅 칸 글 · 보내는 중 */
  input: string;
  saying: boolean;
  info: string;
}
const fresh = (): View => ({ loading: false, notice: '', failRaw: '', page: '', retried: 0, pop: '', pay: 'won', offer: [], opInput: '', calling: false, done: '', call: null, lifted: false, peelFrom: 0, agree: false, audNo: '', input: '', saying: false, info: '' });
/** 채팅 칸에 치는 글 (app.ts 가 넘긴다) */
export function homeshopInput(text: string, which = 'hs-say'): void {
  if (which === 'hs-op') ui.opInput = text;
  else ui.input = text;
}
let ui = fresh();
let uiChat = '';
let liveEnv: HsEnv | null = null;
const chatKey = (ctx: ChatContext) => `${ctx.charIndex}:${ctx.chatIndex}`;
function sync(ctx: ChatContext): void {
  const k = chatKey(ctx);
  if (k === uiChat) return;
  uiChat = k;
  ui = fresh();
}
export function resetHomeshop(): void {
  uiChat = '';
  ui = fresh();
  stopPlayer();
}
onHomeshopReady(() => liveEnv?.render());

/** 주문 전화번호 (화면 글, 설정에서 고친다) */

const telOf = (ctx: ChatContext) => String(ctx.chat.scriptstate?.[HS_TEL_KEY] ?? '').trim() || HS_TEL_DEFAULT;
/** 호출 실패 때 자동으로 다시 연결하는 횟수 (0~3, 기본 1) */
const retryOf = (ctx: ChatContext) => { const n = Number(ctx.chat.scriptstate?.[HS_RETRY_KEY] ?? 1); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 1; };

// ── 모델 ──

/** 방송 요청에 넘기는 자료 묶음 (참고 자료·본편은 상점과 같은 길로 모은다) */
function showSource(ctx: ChatContext, show: HsShow, s: HsSettings, fn: ShopFn = 'shelf') {
  const st: ShopState = { ...emptyShop({ raw: '', shop: hsName(), owner: hsHost() }, ''), loaded: true, identity: { sells: hsName(), never: '', prices: guideTxt('Hs', 'IDENTITY_PRICES') }, prev: show.prev.concat(show.parts.map((p) => p.item.name)).slice(-s.keep.prev) };
  return shopSource({ ...ctx, chat: { ...ctx.chat, scriptstate: hsVars(ctx.chat.scriptstate) as typeof ctx.chat.scriptstate } }, st, s.shop, shopGive(ctx.chat.scriptstate, 'hs', fn));
}
/** 지침에 채우는 낱말 (컷·표정·화면 사건) */
function cueWords(): Record<string, string> {
  const art = homeshopArt();
  const names = (cut: 'A' | 'B') => [...new Set((art?.pack.cuts[cut].clips ?? []).filter((c) => c.group !== 'off' && c.group !== 'base').map((c) => c.name))];
  const a = names('A');
  const b = names('B').filter((x) => !a.includes(x));
  // 내 채팅 반응(SAY)에는 매진을 주지 않는다: 매진은 그 상품 대본의 마지막 줄에서만 (11-15 사용자: 매진이 아무 때나 뜬다)
  const words = Object.entries(CUE_EVENT_WORD);
  return { cuts: Object.values(CUE_CUT_WORD).join(', '), moods: a.join(', ') || 'talk', moods_b: b.join(', ') || '-', moods_all: [...a, ...b].join(', ') || 'talk', events: words.map(([, w]) => w).join(', '), say_events: words.filter(([k]) => k !== 'sold').map(([, w]) => w).join(', ') };
}
/** 편성 요청문: 방송 전용 지침(첫 절·물건 줄·방송 꼴·시청자 절·생각 단계). 상점 진열 지침은 빌리지 않는다 (11-12 사용자) */
const range = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : guideTxt('Hs', 'COUNT_RANGE', { lo: r[0], hi: r[1] }));
function showPrompt(ctx: ChatContext, show: HsShow, s: HsSettings): LlmMessage[] {
  return programPrompt(showSource(ctx, show, s), s.shop, { ...cueWords(), cue: range(s.cue), chat: range(s.chat) }) as LlmMessage[];
}

/** 호출 흐름 미리 계산용 (모델은 안 부름). 꺼져 있으면 null */
export function previewHomeshop(ctx: ChatContext): LlmMessage[] | null {
  const s = hsSettings(ctx.chat.scriptstate);
  return s.on ? showPrompt(ctx, readShow(ctx.chat.scriptstate), s) : null;
}

const jobs = new Set<string>();
async function ask(ctx: ChatContext, env: HsEnv): Promise<void> {
  const job = chatKey(ctx);
  if (jobs.has(job)) return;
  jobs.add(job);
  ui.loading = true;
  ui.notice = '';
  ui.failRaw = '';
  env.render();
  let failed = false;
  try {
    // 그림 팩을 아직 안 받았으면 기다린다: 없으면 표정 목록이 talk 하나로 나간다 (전수검사 11-13)
    if (!homeshopArt() && !homeshopStatus().failed) {
      await ensureHomeshop();
      // 기다리는 사이 채팅을 옮겼으면 그만둔다. 요청문은 기다린 뒤의 채팅 값으로 만든다 (재검토 11-14)
      const now = env.current();
      if (!now || chatKey(now) !== job) return;
      ctx = now;
    }
    const s = hsSettings(ctx.chat.scriptstate);
    const show = readShow(ctx.chat.scriptstate);
    const g = genSettings(ctx.chat.scriptstate);
    const moods = moodMap(homeshopArt()?.pack ?? null);
    // 값: 원 값(돈으로 주문)·출연 횟수(무이자 할부) 둘 다 받는다. 원 값 주문은 가계부에서 빠진다 (11-15 사용자: 결제 네 가지)
    const { value } = await generate(showPrompt(ctx, show, s), s.shop.model, (raw) => parseShow(raw, moods), { retries: g.retries, retryModel: g.retryModel, concurrent: g.concurrent, state: ctx.chat.scriptstate, label: `${hsName()} 편성` });
    const cur = env.current();
    if (!cur || chatKey(cur) !== chatKey(ctx)) return;
    const key = lastBot(cur.chat)?.key ?? '';
    await updateChat(cur.charIndex, cur.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...applyShow(readShow(chat.scriptstate), value, key, hsSettings(chat.scriptstate).keep.prev), tk: turnKey(chat) }), [HS_AT_VAR]: turnKey(chat) } }));
    ui.retried = 0;
  } catch (error) {
    failed = true;
    ui.notice = error instanceof Error ? error.message : String(error);
    ui.failRaw = String((error as { raw?: string }).raw ?? '').slice(0, 4000);
  } finally {
    ui.loading = false;
    jobs.delete(job);
  }
  // 신호 없음: 설정한 횟수만큼 스스로 다시 연결 (11-09 사용자: 망상만)
  if (failed && ui.retried < retryOf(ctx)) {
    ui.retried++;
    const cur = env.current();
    if (cur && chatKey(cur) === chatKey(ctx)) return ask(cur, env);
  }
  await env.refresh();
}

/** 사이트를 열 때: 「창을 열 때」이고 마지막 응답 뒤로 아직 안 받았으면 한 번 (처음이면 늘) */
export function homeshopOpenCheck(ctx: ChatContext, env: HsEnv): void {
  liveEnv = env;
  sync(ctx);
  // 사이트에 들어오면 늘 방송 화면부터
  ui.page = '';
  const s = hsSettings(ctx.chat.scriptstate);
  // 닿지 않는 동안은 편성을 넘기지도 새로 받지도 않는다 (화면은 「신호 없음」)
  if (!s.on || ui.loading || !hsReach(ctx.chat)) return;
  const show = readShow(ctx.chat.scriptstate);
  // 턴 열쇠: 응답을 다시 굴린 것은 턴이 넘어간 것이 아니다 (11-11 사용자)
  const key = turnKey(ctx.chat);
  // 본편 턴이 넘어갔으면 편성 한 칸 (보던 부는 지나간다). 모델 호출이 없으니 수동이어도 넘긴다 (전수검사 11-13)
  if (turnStep(show, s.turn, key)) {
    void updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readShow(chat.scriptstate);
      if (!cur.loaded || cur.tk === turnKey(chat)) return null;
      return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...cur, at: Math.min(cur.at + 1, cur.parts.length), tk: turnKey(chat) }) } };
    }).then(() => env.refresh()).then(() => { const c = env.current(); if (c) homeshopOpenCheck(c, env); });
    return;
  }
  // 새 편성 호출만 수동에서 막는다
  if (s.auto === 'manual') return;
  if (show.loaded && String(ctx.chat.scriptstate?.[HS_AT_VAR] ?? '') === key) return;
  if (show.loaded && show.at < show.parts.length) return;
  void ask(ctx, env);
}

// ── 동작 ──

export async function homeshopAction(action: string, value: string | undefined, ctx: ChatContext, env: HsEnv): Promise<boolean> {
  if (!action.startsWith('hs-')) return false;
  liveEnv = env;
  sync(ctx);
  switch (action) {
    case 'hs-next': {
      // 다음 상품은 내가 넘긴다 (11-12 사용자: 꼭 자동일 필요 없다)
      const now = readShow(ctx.chat.scriptstate);
      if (hsReach(ctx.chat) && now.loaded && now.at < now.parts.length) advance(now.at + 1);
      return true;
    }
    case 'hs-refresh':
      if (!hsReach(ctx.chat) || ui.loading) return true;
      ui.retried = 0;
      await ask(ctx, env);
      return true;
    case 'hs-page':
      ui.page = value === 'sched' || value === 'orders' ? value : '';
      ui.pop = '';
      env.render();
      return true;
    case 'hs-pop': {
      ui.pop = (value === 'call' || value === 'peek' || value === 'aud') && hsReach(ctx.chat) ? value : '';
      ui.done = '';
      ui.lifted = false;
      ui.peelFrom = 0;
      ui.agree = false;
      ui.audNo = '';
      // 통화는 같은 상품이면 이어 간다 (창을 닫았다 열어도 흥정이 남는다). 상품이 바뀌었으면 새 통화
      const { show, part, ordered } = nowPart(ctx);
      if (ui.call && ui.call.pid !== part?.item.id) ui.call = null;
      if (ui.pop === 'call' && part) {
        const s = hsSettings(ctx.chat.scriptstate);
        if (!payOk(ctx, part, s, ui.pay)) ui.pay = firstPay(ctx, part, s);
        // 전화를 걸면 상담원의 첫 말이 화면에 나온다: 시청 기록에 적는다 (설정 「스티커·상담원」을 켠 때만 메인 요청에 간다)
        if (!ui.call) {
          ui.call = { pid: part.item.id, lines: show.ops?.hello ? [{ who: 'op', text: show.ops.hello }] : [], terms: null, offered: [] };
          if (!ordered && show.ops?.hello) saveLog(ctx.charIndex, ctx.chatIndex, [{ k: 'aside', p: show.at, who: hsLogOperator(), text: show.ops.hello }], show);
        }
      }
      env.render();
      return true;
    }
    case 'hs-pay':
      if (value === 'won' || value === 'appear' || value === 'barter' || value === 'talk') ui.pay = value;
      env.render();
      return true;
    case 'hs-offer':
      ui.offer = ui.offer.includes(value ?? '') ? ui.offer.filter((x) => x !== value) : [...ui.offer, value ?? ''].filter(Boolean);
      env.render();
      return true;
    case 'hs-appraise':
      await operatorAsk(ctx, env, 'barter', ui.opInput.trim());
      return true;
    case 'hs-op':
      await operatorAsk(ctx, env, 'talk', (value ?? ui.opInput).trim());
      return true;
    case 'hs-lift': {
      if (ui.lifted) return true;
      ui.lifted = true;
      // PC 에서 끌다 놓았으면 그 자리부터 마저 젖힌다 (homeshopMounted 가 끈 만큼을 넘긴다)
      const from = Number(value);
      ui.peelFrom = Number.isFinite(from) && from > 0 && from < 1 ? from : 0;
      env.render();
      // 들춰 보인 글자도 시청 기록에 적는다: 젖힌 자리에 실제로 드러난 글자만 (homeshopMounted 가 화면에서 잰다)
      const { show, part } = nowPart(ctx);
      const frag = part && hsSettings(ctx.chat.scriptstate).peek ? peeked : '';
      if (frag) saveLog(ctx.charIndex, ctx.chatIndex, [{ k: 'aside', p: show.at, who: hsLogSticker(), text: frag }], show);
      return true;
    }
    case 'hs-agree':
      ui.agree = !ui.agree;
      env.render();
      return true;
    case 'hs-order':
      await order(ctx, env);
      return true;
    case 'hs-aud':
      await audience(ctx, env);
      return true;
    case 'hs-say':
      await say(ctx, env, (value ?? ui.input).trim());
      return true;
    case 'hs-box-open':
      await openBox(ctx, env, value ?? '');
      return true;
    case 'hs-raw':
      if (ui.failRaw) ui.notice = `${ui.notice.split('\n')[0]}\n${ui.failRaw.slice(0, 1500)}`;
      ui.failRaw = '';
      env.render();
      return true;
    default:
      return homeshopSettingsAction(action, value, ctx, env);
  }
}

/** 큐시트가 끝나 다음 부로: 저장하고 다시 그린다 */
function advance(at: number): void {
  const env = liveEnv;
  const ctx = env?.current();
  if (!env || !ctx) return;
  // 부가 넘어가기 전에 지금까지 본 것을 적는다 (시청 기록)
  playerFlush();
  void updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const show = readShow(chat.scriptstate);
    if (!show.loaded || show.at >= at) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...show, at: Math.min(at, show.parts.length) }) } };
  }).then(() => env.refresh());
}

/** 본편 응답 대기가 풀릴 때까지 (host/people.ts waitNotBusy 와 같은 방식) */
function whenIdle(): Promise<void> {
  if (!isWaiting()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = onWaiting((w) => {
      if (w) return;
      off();
      resolve();
    });
  });
}

/**
 * 시청 기록 저장 (core/hslog.ts): 재생기가 모아 준 「화면에 나온 줄」 묶음을 그 채팅의 `$hs_log` 에 덧붙인다. 본편 요청이 참고 기록으로 읽는다 (body.ts moduleContext).
 * 줄마다가 아니라 묶음으로만 부른다 (재생기 playerFlush). 그 채팅의 편성이 그사이 바뀌었으면 버린다
 */
function saveLog(charIndex: number, chatIndex: number, entries: HsLogEntry[], show: HsShow): void {
  if (!entries.length) return;
  // 본편 응답을 기다리는 동안에는 채팅을 쓰지 않고, 대기가 풀리면 차례로 적는다 (응답과 겹쳐 덮지 않게, 전수검사 11-13)
  void whenIdle().then(() => updateChat(charIndex, chatIndex, (chat) => {
    const cur = readShow(chat.scriptstate);
    if (!sameProgram(cur, show)) return null;
    const vars = appendLog(chat.scriptstate, cur, entries, turnKey(chat));
    return Object.keys(vars).length ? { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } } : null;
  })).catch((error) => console.log(`[goei] ${hsName()} 시청 기록 저장 실패: ${error instanceof Error ? error.message : String(error)}`));
}

// ── 주문·상자·방청·채팅 (설계 8-4 ~ 8-10) ──

/** 지금 방송 중인 부와, 이미 주문했는지 */
function nowPart(ctx: ChatContext): { show: HsShow; part: HsShow['parts'][number] | null; ordered: HsOrder | null } {
  const show = readShow(ctx.chat.scriptstate);
  // 방송에 닿지 않는 동안(core/homeshop.ts hsReach)은 지금 상품이 없다: 전화 주문·상담원·채팅·스티커가 모두 여기서 막힌다
  const part = show.loaded && hsReach(ctx.chat) ? show.parts[show.at] ?? null : null;
  const ordered = part ? liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)).find((o) => o.id === `ho_${part.item.id}`) ?? null : null;
  return { show, part, ordered };
}
/** 맞교환으로 내밀 수 있는 내 물건 (택배 상자는 뺀다) */
const barterItems = (ctx: ChatContext): Item[] => {
  const alive = aliveAnchors(ctx.chat);
  return liveItemsOf(readItems(ctx.chat.scriptstate), ctx.chat).filter((x) => !boxOrder(ctx.chat.scriptstate, x.id, alive));
};

/** 지금 방송 중인 상품이 매진됐나: 저장된 매진(out) 또는 재생기의 매진 딱지. 매진이면 주문을 받지 않는다 (11-15) */
const soldNow = (show: HsShow): boolean => {
  if (show.parts[show.at]?.out) return true;
  const st = playerState();
  return !!st && st.part === show.at && st.flags.sold;
};
/** 재생기가 매진을 알렸을 때: 바로 다시 그리고(주문 단추·전화 창 잠금), 그 부에 매진을 적는다 (다시 열어도 매진) */
function soldOut(at: number): void {
  const env = liveEnv;
  const ctx = env?.current();
  if (!env || !ctx) return;
  env.render();
  const key = readShow(ctx.chat.scriptstate).key;
  void whenIdle().then(() => updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const show = readShow(chat.scriptstate);
    const part = show.parts[at];
    if (!show.loaded || show.key !== key || !part || part.out) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...showVars({ ...show, parts: show.parts.map((p, i) => (i === at ? { ...p, out: true as const } : p)) }) } };
  })).then(() => env.refresh()).catch(() => undefined);
}

/** 원 값을 낼 수 있나: 가계부가 켜져 있을 때만 (상점과 같은 조건) */
const walletOn = (ctx: ChatContext): boolean => { const b = shopBlocked(ctx.chat.scriptstate); return b !== 'wallet' && b !== 'both'; };
const itemsOn = (ctx: ChatContext): boolean => { const b = shopBlocked(ctx.chat.scriptstate); return b !== 'items' && b !== 'both'; };
const balance = (ctx: ChatContext): number => walletBalance(readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT), aliveAnchors(ctx.chat));
/** 이 상품에 이 결제 방법이 있나 (원 값 0 = 돈으로 안 팖, 출연 0 = 출연으로 안 팖, 맞교환·흥정은 설정) */
function payOk(ctx: ChatContext, part: HsPart, s: HsSettings, pay: HsPay): boolean {
  if (pay === 'won') return part.item.price > 0 && walletOn(ctx);
  if (pay === 'appear') return (part.inst ?? 0) > 0;
  if (pay === 'barter') return s.barter && itemsOn(ctx);
  return s.talk;
}
const PAYS: HsPay[] = ['won', 'barter', 'talk', 'appear'];
const firstPay = (ctx: ChatContext, part: HsPart, s: HsSettings): HsPay => PAYS.find((p) => payOk(ctx, part, s, p)) ?? 'won';
/** 지금 결제 방법으로 주문할 조건 (원·출연은 상품 값 그대로, 맞교환·흥정은 상담원이 내놓은 조건). 없으면 null */
function termsFor(part: HsPart, pay: HsPay): HsTerms | null {
  if (pay === 'won') return part.item.price > 0 ? { money: part.item.price, items: [], appear: 0, other: '' } : null;
  if (pay === 'appear') return part.inst ? { money: 0, items: [], appear: part.inst, other: '' } : null;
  return ui.call?.pid === part.item.id ? ui.call.terms : null;
}
/** 조건으로 지금 주문할 수 없는 까닭 (없으면 빈 글): 잔고 · 가계부 꺼짐 · 내민 물건이 없어짐 */
function termsBlock(ctx: ChatContext, t: HsTerms): string {
  if (t.money > 0 && !walletOn(ctx)) return '가계부가 꺼져 있어 돈으로 낼 수 없습니다.';
  if (t.money > 0 && balance(ctx) < t.money) return '잔고가 모자랍니다.';
  const mine = new Set(barterItems(ctx).map((x) => x.id));
  if (t.items.some((x) => !mine.has(x.id))) return '내민 물건 가운데 이제 없는 것이 있습니다. 다시 감정을 받으세요.';
  return '';
}

/** 상담원에게 묻기: 맞교환 감정(내민 물건) 또는 흥정(한 말). 한 번에 1회 호출. 답과 조건은 통화에, 말은 시청 기록에 */
async function operatorAsk(ctx: ChatContext, env: HsEnv, mode: 'barter' | 'talk', said: string): Promise<void> {
  const s = hsSettings(ctx.chat.scriptstate);
  const { show, part, ordered } = nowPart(ctx);
  if (!part || ordered || ui.calling || soldNow(show)) return;
  if (mode === 'talk' && (!s.talk || !said)) return;
  if (mode === 'barter' && (!s.barter || !ui.offer.length)) return;
  if (!ui.call || ui.call.pid !== part.item.id) ui.call = { pid: part.item.id, lines: show.ops?.hello ? [{ who: 'op', text: show.ops.hello }] : [], terms: null, offered: [] };
  const call = ui.call;
  const mine = barterItems(ctx);
  // 내민 물건: 맞교환은 지금 고른 것, 흥정은 마지막으로 감정받은 것 (흥정 중에 다른 물건을 원하면 상담원이 내밀라고 말한다)
  const offered = (mode === 'barter' ? ui.offer : call.offered).map((id) => mine.find((x) => x.id === id)).filter((x): x is Item => !!x);
  const meLine = mode === 'barter' ? guideTxt('Hs', 'CALL_OFFER', { names: offered.map((x) => x.name).join(', ') }) + (said ? ` ${said}` : '') : said;
  call.lines.push({ who: 'me', text: meLine.slice(0, 200) });
  const offeredBefore = call.offered;
  if (mode === 'barter') call.offered = offered.map((x) => x.id);
  ui.opInput = '';
  ui.calling = true;
  env.render();
  playerFlush();
  try {
    const items = readItems(ctx.chat.scriptstate);
    const alive = aliveAnchors(ctx.chat);
    const g = (k: string, v: Record<string, string | number> = {}) => guideTxt('Hs', k, v);
    const offerText = offered.map((x) => {
      const left = itemLeft(items, x, alive);
      const state = g(x.state === 'damaged' ? 'OFFERED_DAMAGED' : x.state === 'broken' ? 'OFFERED_BROKEN' : 'OFFERED_INTACT');
      const truth = x.truth && x.truth !== '?' ? `\n${g('OFFERED_TRUTH', { truth: x.truth })}` : '';
      return `${g('OFFERED_LINE', { name: x.name, traits: traitsText(x) + (left !== undefined ? ` (${left})` : ''), state, desc: x.desc || '-', effect: x.effect || '-' })}${truth}`;
    }).join('\n');
    const src = showSource(ctx, show, s, 'talk');
    const keep = src.talkMax === undefined ? call.lines : call.lines.slice(-Math.max(1, src.talkMax));
    const body = [
      g('HEAD_ON_AIR', { name: part.item.name, pay: hsPayText(part) || '-', desc: part.item.desc || '-', effect: part.item.effect || '-' }),
      `${g('HEAD_OFFERED')}\n${offerText || '-'}`,
      `${g('HEAD_TERMS')}\n${call.terms ? termsText(call.terms) : g('TERMS_NONE')}`,
      `${g('HEAD_CALL')}\n${keep.map((l) => g(l.who === 'me' ? 'CALL_LINE_ME' : 'CALL_LINE_OP', { text: l.text })).join('\n')}`,
    ].join('\n\n');
    const gs = genSettings(ctx.chat.scriptstate);
    const { value } = await generate(operatorPrompt(src, s.shop, mode, body, !walletOn(ctx)) as LlmMessage[], s.shop.model, (raw) => parseOperator(raw, offered.map((x) => ({ id: x.id, name: x.name }))), { retries: gs.retries, retryModel: gs.retryModel, concurrent: gs.concurrent, state: ctx.chat.scriptstate, label: `${hsName()} 상담원` });
    // 그사이 상품이 바뀌었으면 버린다
    if (ui.call !== call) return;
    call.lines.push({ who: 'op', text: value.line });
    if (call.lines.length > s.keep.talk) call.lines.splice(0, call.lines.length - s.keep.talk);
    call.terms = value.terms && !walletOn(ctx) ? (value.terms.money > 0 ? null : value.terms) : value.terms;
    const buyer = userInfo().name || guideTxt('Hs', 'SAY_ME_NICK');
    saveLog(ctx.charIndex, ctx.chatIndex, [{ k: 'aside', p: show.at, who: buyer, text: meLine, me: 1 }, { k: 'aside', p: show.at, who: hsLogOperator(), text: value.line }], show);
  } catch (error) {
    // 실패하면 내 말과 내민 물건을 되돌린다 (다시 보낼 수 있게)
    if (ui.call === call) {
      call.lines.pop();
      call.offered = offeredBefore;
      ui.opInput = said;
    }
    ui.info = `상담원과 연결되지 않았어요. ${error instanceof Error ? error.message.split('\n')[0] : ''}`;
  } finally {
    ui.calling = false;
    env.render();
  }
}

/** 전화 주문 확정: 고른 결제 방법의 조건대로 치르고(원은 가계부, 물건은 소지품에서 빠짐), 소지품에 미개봉 택배 상자가 바로 들어온다. 출연은 상자를 열 때 걸린다 (2026-11-16 사용자) */
async function order(ctx: ChatContext, env: HsEnv): Promise<void> {
  const s = hsSettings(ctx.chat.scriptstate);
  const pre = nowPart(ctx);
  if (!pre.part || soldNow(pre.show)) return env.render();
  // 화면(callPop)이 보이는 결제 방법 그대로: 고른 방법이 이 상품에 안 맞으면 되는 첫 방법
  const pay = payOk(ctx, pre.part, s, ui.pay) ? ui.pay : firstPay(ctx, pre.part, s);
  if (!payOk(ctx, pre.part, s, pay)) return env.render();
  ui.pay = pay;
  const terms = termsFor(pre.part, pay);
  if (!terms || termsBlock(ctx, terms)) return env.render();
  let ok = false;
  // 시청 기록: 주문 전에 본 것을 먼저 적고, 주문 줄은 아래 저장에 같이 적는다
  playerFlush();
  const buyer = userInfo().name || guideTxt('Hs', 'SAY_ME_NICK');
  const start = getPrefs().walletStart ?? WALLET_START_DEFAULT;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const show = readShow(chat.scriptstate);
    const part = show.loaded ? show.parts[show.at] : null;
    if (!part || part.out || part.item.id !== pre.part!.item.id) return null;
    const alive = aliveAnchors(chat);
    if (liveOrders(chat.scriptstate, alive).some((o) => o.id === `ho_${part.item.id}`)) return null;
    let items = readItems(chat.scriptstate);
    const anchor = lastBot(chat)?.key ?? '';
    // 내민 물건이 그사이 없어졌으면 주문하지 않는다
    const live = liveItemsOf(items, chat);
    if (terms.items.some((x) => !live.some((y) => y.id === x.id))) return null;
    let wallet: Record<string, string> = {};
    let walletId = '';
    if (terms.money > 0) {
      const w0 = readWallet(chat.scriptstate, start);
      if (walletBalance(w0, alive) < terms.money) return null;
      walletId = freshWalletId(w0, `hs_${part.item.id}`, anchor);
      wallet = walletVars(addWalletEntry(w0, { id: walletId, anchor, amount: -terms.money, memo: `${part.item.name} (${hsName()})`, src: 'store' }, alive));
    }
    const o = newOrder(chat, part.item, pay, terms);
    // 기록 글은 지침 「망상홈쇼핑」의 ORDER_* 절 (본편에 판 것·산 것으로 간다)
    const barterNote = guideTxt('Hs', 'ORDER_BARTER_NOTE');
    for (const g of terms.items) items = anchor ? sellItem(items, g.id, anchor, barterNote) : removeItem(items, g.id, 'sell', 'store', '', { note: barterNote });
    // 같은 이름의 상자가 이미 있으면(같은 상품을 다시 주문) 한 줄로 합쳐져 못 열게 되므로 번호를 붙인다
    const mine = liveItemsOf(items, chat);
    let name = HS_BOX.name(part.item.name);
    for (let k = 2; k < 20 && mine.some((x) => x.id === itemId(anchor, name) || x.name === name); k++) name = `${HS_BOX.name(part.item.name).slice(0, 27)} ${k}`;
    // 상자: 원 몫은 값으로(가계부와 이어짐), 나머지 대가(물건·그 밖)는 결제 글로. 출연은 상자를 열 때 걸리므로 여기 적지 않는다
    items = addItem(items, alive, { name, desc: HS_BOX.desc, icon: HS_BOX.icon, weight: part.item.weight, from: 'store', store: 'hs', anchor, paidWith: orderPaid(o, false) || hsName(), ...(terms.money > 0 ? { price: terms.money, walletId } : {}) });
    o.boxId = itemId(anchor, name);
    ok = true;
    // 시청 기록의 주문 줄 (본편 참고 기록, core/hslog.ts). 주문 id 를 달아 두어 주문이 없던 일이 되면 본편에도 안 간다
    // 상담원의 확정 말도 같이 적는다 (맞교환·흥정의 통화 말은 조건을 내미는 말이라 확정 말이 아니다)
    const opSaid = show.ops?.done ?? '';
    const bought = appendLog(chat.scriptstate, show, [{ k: 'buy', p: show.at, who: buyer, text: guideTxt('Hs', 'ORDER_LOG', { item: part.item.name, how: o.how }), ref: o.id }, ...(opSaid ? [{ k: 'aside' as const, p: show.at, who: hsLogOperator(), text: opSaid }] : [])], turnKey(chat));
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...wallet, ...itemsVars(items), ...ordersVars(pruneOrders([...readOrders(chat.scriptstate).filter((x) => x.id !== o.id), o], hsSettings(chat.scriptstate).keep.orders, { alive, turn: userTurns(chat), last: anchor })), ...bought } };
  });
  if (ok) {
    const ops = readShow(ctx.chat.scriptstate).ops;
    ui.done = ops?.done || '주문이 접수되었습니다.';
    ui.offer = [];
    playerSay(guideTxt('Hs', 'PLAYER_SYS_NICK'), guideTxt('Hs', 'PLAYER_SYS_ORDER'), 'sys'); // 안내 줄도 흐른 채팅으로 반응 요청에 간다 (playerRecentChat)
    playerTake(1);
  } else ui.info = '주문이 되지 않았어요. 잔고나 내민 물건을 확인해 주세요.';
  await env.refresh();
}

/** 소지품에서 택배 상자 열기: 상자가 빠지고 실제 물건이 들어간다 (모델 호출 없음). 여는 것이 곧 구매를 받아들이는 것이라, 출연이 걸린 주문은 이때 호출 턴이 잡힌다 */
async function openBox(ctx: ChatContext, env: HsEnv, boxId: string): Promise<void> {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const alive = aliveAnchors(chat);
    const o = boxOrder(chat.scriptstate, boxId, alive);
    if (!o) return null;
    let items = readItems(chat.scriptstate);
    const box = items.list.find((x) => x.id === boxId);
    if (!box) return null;
    const anchor = lastBot(chat)?.key ?? '';
    // 상자는 지우지 않고 연 응답에 묶어 숨긴다: 그 응답을 다시 굴리면 상자가 미개봉으로 돌아온다
    items = anchor
      ? addItemLog({ ...items, list: items.list.map((x) => (x.id === boxId ? { ...x, soldAt: anchor } : x)) }, { name: box.name, item: boxId, ...(box.icon ? { icon: box.icon } : {}), what: 'use', by: 'manual', anchor, note: '상자를 열었다' })
      : removeItem(items, boxId, 'use', 'manual', '', { note: '상자를 열었다' });
    const it = o.item;
    items = addItem(items, alive, { name: it.name, desc: it.desc, effect: it.effect, truth: it.truth, use: it.use, uses: it.uses, equip: it.equip, icon: it.icon, weight: it.weight, from: 'store', store: 'hs', anchor, paidWith: orderPaid(o, true) || box.paidWith || hsName(), ...(box.price !== undefined ? { price: box.price } : {}), ...(box.walletId ? { walletId: box.walletId } : {}) });
    const s = hsSettings(chat.scriptstate);
    const orders = readOrders(chat.scriptstate).map((x) => (x.id === o.id ? openOrder(chat, x, s, anchor) : x));
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemsVars(items), ...ordersVars(orders) } };
  });
  await env.refresh();
}

/** 방청 신청: 접수 번호를 주고, 다음 턴 본편에 한 줄만 넘긴다 (그 뒤는 저절로 풀린다) */
async function audience(ctx: ChatContext, env: HsEnv): Promise<void> {
  if (!ui.agree || !hsSettings(ctx.chat.scriptstate).aud || !hsReach(ctx.chat)) return;
  const no = String(1000 + Math.floor(Math.random() * 9000));
  const name = userInfo().name || '';
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [HS_AUD_VAR]: JSON.stringify({ anchor: lastBot(chat)?.key ?? '', no, name }) } }));
  ui.audNo = no;
  playerSay(guideTxt('Hs', 'PLAYER_SYS_NICK'), guideTxt('Hs', 'PLAYER_SYS_AUDIENCE', { no }), 'sys');
  await env.refresh();
}

/** 내가 채팅을 썼을 때만 한 번 더 부른다: 진행자 큐 1~3줄 + 다른 시청자 반응 몇 줄 */
async function say(ctx: ChatContext, env: HsEnv, text: string): Promise<void> {
  const s = hsSettings(ctx.chat.scriptstate);
  const { show, part } = nowPart(ctx);
  if (!text || ui.saying || !s.say || !part) return;
  // 새로 보낼 때 지난 실패 안내를 지운다 (전수검사 11-13)
  ui.info = '';
  const nick = userInfo().name || guideTxt('Hs', 'SAY_ME_NICK'); // 이름이 없을 때 내 닉네임 (방송 채팅·반응 요청·시청 기록으로 모델에 간다)
  ui.input = '';
  ui.saying = true;
  playerHold(true);
  playerSay(nick, text.slice(0, 80), 'me');
  env.render();
  try {
    if (!homeshopArt() && !homeshopStatus().failed) await ensureHomeshop();
    const art = homeshopArt();
    const g = guideSections('Hs');
    const w = cueWords();
    const system = [fillGuide(g.COMMON ?? '', {}), fillGuide(g.KNOWS ?? '', {}), fillGuide(g.SAY ?? '', { say_cue: range(s.sayCue), say_chat: range(s.sayChat), cuts: w.cuts, moods: w.moods_all, events: w.say_events }), fillGuide(g.HOST ?? '', {}), fillGuide(g.VIEWERS ?? '', {}), genSettings(ctx.chat.scriptstate).language ?? ''].filter(Boolean).join('\n\n'); // 생성 언어 줄 (방송 편성과 같게, 전수검사 11-13)
    const st = playerState();
    // 요청 글은 지침 「망상홈쇼핑」의 SAY_* 절
    const recent = part.cues.slice(Math.max(0, (st?.cue ?? 0) - (s.sayHost - 1)), (st?.cue ?? 0) + 1).map((c) => guideTxt('Hs', 'SAY_HOST_LINE', { text: c.text })).join('\n');
    // 방금까지 흐른 채팅 (내 줄은 playerSay 로 이미 맨 끝에 있다): 같은 닉네임·말투를 잇게
    const flowed = playerRecentChat(s.sayFlow).slice(0, -1).map((c) => guideTxt('Hs', 'SAY_CHAT_LINE', { nick: c.nick, text: c.text })).join('\n');
    const now = { title: show.title, part: show.at + 1, item: part.item.name, pay: hsPayText(part), desc: part.item.desc };
    const user = guideTxt('Hs', 'SAY_USER', {
      material: broadcastMaterial(showSource(ctx, show, s, 'say'), s.shop),
      now: guideTxt('Hs', show.title ? 'SAY_NOW_TITLED' : 'SAY_NOW', now),
      recent: recent || '-',
      flowed: flowed ? `\n\n${guideTxt('Hs', 'SAY_FLOWED', { flowed })}` : '',
      said: guideTxt('Hs', 'SAY_CHAT_LINE', { nick, text: text.slice(0, 200) }),
    });
    const gs = genSettings(ctx.chat.scriptstate);
    const moods = moodMap(art?.pack ?? null);
    const { value } = await generate([{ role: 'system', content: system }, { role: 'user', content: user }] as LlmMessage[], s.shop.model, (raw) => {
      const cueText = /<cue[^>]*>([\s\S]*?)<\/cue\s*>/i.exec(raw)?.[1] ?? '';
      const cues = cueText.split('\n').map((l) => parseCue(l, moods)).filter((c): c is HsCue => !!c).slice(0, s.sayCue[1]);
      const chat = (/<chat[^>]*>([\s\S]*?)<\/chat\s*>/i.exec(raw)?.[1] ?? '').split('\n').map((l) => { const k = l.indexOf('|'); return k > 0 ? { nick: l.slice(0, k).trim().slice(0, 16), text: l.slice(k + 1).trim().slice(0, 80) } : null; }).filter((c): c is { nick: string; text: string } => !!c && !!c.text).slice(0, s.sayChat[1]);
      if (!cues.length && !chat.length) throw new Error(guideTxt('Hs', 'ERR_NO_SAY'));
      return { cues, chat };
    }, { retries: gs.retries, retryModel: gs.retryModel, concurrent: gs.concurrent, state: ctx.chat.scriptstate, label: `${hsName()} 채팅` });
    playerCut(value.cues, value.chat);
  } catch (error) {
    ui.info = `채팅이 전달되지 않았어요. ${error instanceof Error ? error.message.split('\n')[0] : ''}`;
  } finally {
    ui.saying = false;
    playerHold(false);
    // 시청 기록: 내 줄과 그때까지 본 것을 바로 적는다 (반응 줄은 화면에 다 나온 뒤 재생기가 넘긴다)
    playerFlush();
  }
  env.render();
}

// ── 화면 (목업 기획 C안 바탕: 빨간 머리띠 · 방송 칸 + 채팅 · 상품 칸 · 주문 단추 줄 · 그림 든 편성 카드) ──

function scaleOf(s: HsSettings, phone: boolean): number {
  const v: HsScale = phone ? s.scalePhone : s.scalePc;
  // -1 = 폭 맞춤: 높이 제한 없이 칸 폭에 꼭 맞춘다 (ui/hsplayer.ts, 전수검사 11-13)
  if (v === 'fit') return -1;
  if (v !== 'auto') return Number(v);
  // 자동 = 보이는 자리에 맞춤 (PC·폰 모두, ui/hsplayer.ts fitScale)
  void phone;
  return 0;
}

const failBox = () => (ui.notice ? `<div class="hs-err" role="alert"><span>${esc(ui.notice).replace(/\n/g, '<br>')}</span>${ui.failRaw ? '<button data-action="hs-raw">받은 글 보기</button>' : ''}<button data-action="hs-refresh">다시 연결</button></div>` : '');
/** 스티커 밑에 보이는 글자 수: 젖힌 모서리 크기에 맞춘다 (폰은 모서리가 조금 작다) */

/** 편성 카드 줄. 아직 방송 안 한 부는 가린다 (11-09 사용자: 다음 상품은 방송에서 공개) */
function lineup(show: HsShow, s: HsSettings, col = false): string {
  return `<div class="hs-lu${col ? ' col' : ''}">${show.parts.map((p, i) => {
    const past = i < show.at;
    const now = i === show.at;
    const open = past || now;
    // 「매진」은 방송에서 정말 다 팔린 상품에만. 지난 부는 잠그기를 켰으면 「판매 종료」, 아니면 「방송 종료」 (11-15 사용자: 매진이 거의 모든 상품에 뜬다)
    const state = p.out ? `<span class="st off">매진</span>` : now ? '<span class="st on">방송 중</span>' : past ? `<span class="st off">${s.lock ? '판매 종료' : '방송 종료'}</span>` : '<span class="st">곧 방송</span>';
    const pic = open ? itemPic(p.item) : '<span class="q">?</span>';
    const body = `<span class="pic">${pic}</span><span class="tx"><small>${i + 1}부</small><b>${open ? esc(p.item.name) : '방송에서 공개'}</b>${open ? `<em>${esc(hsPayText(p))}</em>` : ''}${col && past ? `<i>${esc(p.item.desc)}</i>` : ''}</span>${state}`;
    return now && col ? `<button class="hs-lc now" data-action="hs-page" data-value="">${body}</button>` : `<div class="hs-lc${now ? ' now' : past ? ' past' : ' soon'}">${body}</div>`;
  }).join('')}</div>`;
}

function onAir(ctx: ChatContext, show: HsShow, s: HsSettings, mobile: boolean): string {
  const { part, ordered } = nowPart(ctx);
  const ended = show.loaded && show.at >= show.parts.length;
  // 접속 카드가 없어 방송에 닿지 않는 동안 (core/homeshop.ts hsReach): 화면의 「신호 없음」과 같은 말로
  const lost = s.on && !hsReach(ctx.chat);
  const bar = `<div class="hs-bar"><span class="hs-on${show.loaded && !ended ? '' : ' off'}">${show.loaded && !ended ? 'LIVE' : 'OFF'}</span><b>${esc(show.title || hsName())}</b>${part ? `<span class="hs-pt">${show.at + 1}부 <i>/ ${show.parts.length}부</i></span><button class="hs-nx" data-action="hs-next">${show.at + 1 < show.parts.length ? '다음 상품 ▶' : '방송 마치기 ■'}</button>` : ''}</div>`;
  const tv = `<div class="hs-tv">${bar}<div class="hs-mount" data-hs-mount="stage"></div></div>`;
  const prod = part
    ? `<div class="hs-prod"><button class="hs-icon" data-action="hs-pop" data-value="peek" aria-label="상품 스티커 보기">${itemPic(part.item)}<span class="hs-stk" aria-hidden="true"></span></button>
<div class="tx"><small>지금 방송 중 · ${show.at + 1}부</small><b>${esc(part.item.name)}</b><p>${esc(part.item.desc)}</p></div>
<div class="pr"><small>오늘 방송에서만</small><b>${esc(hsPayText(part))}</b></div></div>`
    : `<div class="hs-prod none"><div class="tx"><b>${ended ? '오늘 방송은 끝났습니다' : lost ? '신호가 없습니다' : '방송 준비 중입니다'}</b><p>${ended ? '새 편성은 새로 고침으로 받아요.' : lost ? '지금은 방송이 잡히지 않습니다.' : '잠시만 기다려 주세요.'}</p></div></div>`;
  const sold = !!part && !ordered && soldNow(show);
  const ord = `<div class="hs-ord"><button class="call" data-action="hs-pop" data-value="call" ${part && !ordered && !sold ? '' : 'disabled'}>☎ ${ordered ? '주문 완료' : sold ? '매진' : '전화 주문'}</button><button data-action="hs-pop" data-value="peek" ${part ? '' : 'disabled'}>상품 스티커 보기</button>${s.aud ? '<button class="aud" data-action="hs-pop" data-value="aud">★ 방청 신청</button>' : ''}</div>`;
  const chatIn = s.say ? `<div class="hs-in"><input name="hs-say" data-input="hs-say" data-enter="hs-say" value="${esc(ui.input)}" maxlength="80" placeholder="${ui.saying ? '보내는 중…' : '채팅 보내기'}" aria-label="채팅 보내기"${ui.saying || !part ? ' disabled' : ''}><button data-action="hs-say"${ui.saying || !part ? ' disabled' : ''}>보내기</button></div>` : '';
  const chat = `<aside class="hs-chat"><h5>실시간 채팅</h5><div class="hs-mount ch-b" data-hs-mount="chat"></div>${chatIn}</aside>`;
  const sched = show.loaded ? `<section class="hs-sec"><h4>오늘 편성<small>지난 상품은 다시 주문할 수 없습니다 · 다음 상품은 방송에서 공개</small></h4>${lineup(show, s)}</section>` : '';
  const info = ui.info ? `<div class="hs-info" role="status">${esc(ui.info)}</div>` : '';
  return mobile
    ? `<div class="hs-main">${tv}${prod}${ord}</div>${info}${chat}${sched}`
    : `<div class="hs-bd"><div class="hs-main">${tv}${prod}${ord}</div>${chat}</div>${info}${sched}`;
}

function schedPage(show: HsShow, s: HsSettings): string {
  if (!show.loaded) return '<section class="hs-sec"><h4>편성표</h4><p class="hs-none">아직 받은 편성이 없습니다.</p></section>';
  return `<section class="hs-sec"><h4>편성표<small>${esc(show.title)}</small></h4>${lineup(show, s, true)}</section>`;
}

/** 주문 조회: 위 출연 장부(무이자 출연. 상자를 연 주문만 — 열기 전에는 걸리지 않는다), 아래 배송(배송 완료 · 미개봉 → 수령 확인). 방청 접수가 있으면 맨 위 한 줄. 누르는 것 없음 */
function ordersPage(ctx: ChatContext): string {
  const alive = aliveAnchors(ctx.chat);
  const list = liveOrders(ctx.chat.scriptstate, alive).slice().reverse();
  const turn = userTurns(ctx.chat);
  const aud = readAudience(ctx.chat.scriptstate);
  const audRow = aud && (!aud.anchor || alive.has(aud.anchor)) ? `<div class="hs-audrow">★ 방청 신청 접수 · 접수번호 <b>${esc(aud.no)}</b></div>` : '';
  const debts = list.filter((o) => o.n > 0 && orderOpened(o, alive));
  const debtRows = debts.map((o) => {
    const left = paidOf(o, turn) < 1;
    return `<li class="${left ? '' : 'done'}"><span class="pic">${itemPic(o.item)}</span><span class="tx"><b>${esc(o.item.name)}</b><small>${esc(guideTxt('Hs', 'PAY_APPEAR'))}</small></span><span class="st${left ? ' on' : ''}">${left ? '대기' : '다녀옴'}</span></li>`;
  }).join('');
  // 돈·물건·시연이 아닌 약조: 상자를 열면 걸리고, 채널이 받으러 오는 턴이 지나면 「받아 감」
  const oweRows = list.filter((o) => !!o.terms?.other && orderOpened(o, alive)).map((o) => {
    const left = (o.owe ?? 0) > turn;
    return `<li class="${left ? '' : 'done'}"><span class="pic">${itemPic(o.item)}</span><span class="tx"><b>${esc(o.item.name)}</b><small>${esc(o.terms?.other ?? '')}</small></span><span class="st${left ? ' on' : ''}">${left ? '대기' : '받아 감'}</span></li>`;
  }).join('');
  const shipRows = list.map((o) => {
    const opened = orderOpened(o, alive);
    return `<li><span class="pic">${itemPic(o.item)}</span><span class="tx"><b>${esc(o.item.name)}</b><small>${esc(o.how)}</small></span><span class="st${opened ? '' : ' on'}">${opened ? '수령 확인' : '배송 완료 · 미개봉'}</span></li>`;
  }).join('');
  return `<section class="hs-sec"><h4>주문 조회</h4>${audRow}
<h5>시연 참여 내역</h5>${debtRows ? `<ul class="hs-ol">${debtRows}</ul>` : '<p class="hs-none">시연 참여 내역이 없습니다.</p>'}
${oweRows ? `<h5>약조 내역</h5><ul class="hs-ol">${oweRows}</ul>` : ''}
<h5>배송</h5>${shipRows ? `<ul class="hs-ol">${shipRows}</ul><p class="hs-tip">택배 상자는 소지품에서 「열기」로 엽니다.</p>` : '<p class="hs-none">주문 내역이 없습니다.</p>'}</section>`;
}

// ── 창 (전화 주문 · 스티커 보기 · 방청 신청: 같은 틀) ──

const popShell = (title: string, body: string, foot = '', cls = '') =>
  `<div class="hs-dim"><button class="hs-dimx" data-action="hs-pop" data-value="" aria-label="닫기"></button><div class="hs-pop${cls ? ` ${cls}` : ''}" role="dialog" aria-label="${esc(title)}"><header><b>${esc(title)}</b><button data-action="hs-pop" data-value="" aria-label="닫기">✕</button></header><div class="pb">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div></div>`;

/** 결제 방법 네 가지의 이름·설명. 폰 칩은 짧은 이름 (설명은 PC 단추의 풍선 글) */
function payInfo(part: HsPart, pay: HsPay): { title: string; short: string; sub: string } {
  if (pay === 'won') { const t = part.item.price > 0 ? `${part.item.price.toLocaleString('en-US')}원` : '돈으로 결제'; return { title: t, short: t, sub: '가계부에서 바로 결제' }; }
  if (pay === 'appear') return { title: guideTxt('Hs', 'PAY_APPEAR'), short: '시연 참여', sub: '지금 내는 돈 없음 · 다음 방송에서 시연' };
  if (pay === 'barter') return { title: '물건 맞교환', short: '맞교환', sub: '가진 물건을 내밀고 감정' };
  return { title: '상담원과 흥정', short: '흥정', sub: '조건을 말로 정하기' };
}
/** 상담원과 정한 조건 카드 */
const termsCard = (t: HsTerms | null): string => (t ? `<div class="hs-terms"><small>상담원 조건</small><b>${esc(termsText(t))}</b></div>` : '');

/** 전화 주문 창 (11-15 사용자: 통화 칸이 너무 작다) — 창을 높이 가득 띄우고 통화 칸이 남는 자리를 다 쓴다.
 *  PC: 좌우로 나눔 — 왼쪽 상품·결제 방법·맞교환 물건·조건·주문, 오른쪽 상담원 통화 칸(위에서 아래까지) + 입력칸.
 *  폰: 화면 가득, 결제 칩 한 줄 → (맞교환이면 물건 가로 줄) → 통화 칸이 끝까지 → 입력칸 → 조건 · 주문 단추 */
function callPop(ctx: ChatContext, s: HsSettings): string {
  const { show, part, ordered } = nowPart(ctx);
  if (!part) return '';
  const mobile = isPhone();
  const title = `☎ ${part.item.name}`;
  const head = `<div class="hs-pi"><span class="pic">${itemPic(part.item)}</span><span class="tx"><b>${esc(part.item.name)}</b><small>${esc(hsPayText(part))}</small></span></div>`;
  const op = (t: string) => (t ? `<p class="hs-op"><i>상담원</i>${esc(t)}</p>` : '');
  if (ui.done || ordered) {
    return popShell('☎ 전화 주문', `${head}${op(ui.done || '주문이 접수되었습니다.')}<p class="hs-ok">택배 상자가 소지품에 도착했습니다.</p>`, '<button class="pri" data-action="hs-pop" data-value="">확인</button><button data-action="hs-page" data-value="orders">주문 조회</button>');
  }
  if (soldNow(show)) return popShell('☎ 전화 주문', `${head}<p class="hs-none">매진되어 더 이상 주문을 받지 않습니다.</p>`, '<button class="pri" data-action="hs-pop" data-value="">끊기</button>');
  const call = ui.call?.pid === part.item.id ? ui.call : null;
  const pay = payOk(ctx, part, s, ui.pay) ? ui.pay : firstPay(ctx, part, s);
  const payWhy = (p: HsPay) => (p === 'won' && part.item.price > 0 ? '가계부가 꺼져 있음' : '이 상품은 안 됨');
  const btn = (p: HsPay) => {
    const ok = payOk(ctx, part, s, p);
    const i = payInfo(part, p);
    const why = ok ? i.sub : payWhy(p);
    return mobile
      ? `<button class="${pay === p ? 'on' : ''}" data-action="hs-pay" data-value="${p}" aria-pressed="${pay === p}" title="${esc(why)}"${ok ? '' : ' disabled'}>${esc(i.short)}</button>`
      : `<button class="${pay === p ? 'on' : ''}" data-action="hs-pay" data-value="${p}" aria-pressed="${pay === p}"${ok ? '' : ' disabled'}><b>${esc(i.title)}</b><small>${esc(why)}</small></button>`;
  };
  // 통화: 상담원 첫 말부터 주고받은 말. 값·출연만 고른 동안에도 상담원 인사가 여기 있다
  const said = call?.lines.length ? call.lines : show.ops?.hello ? [{ who: 'op' as const, text: show.ops.hello }] : [];
  const lines = said.map((l) => (l.who === 'op' ? op(l.text) : `<p class="hs-me">${esc(l.text)}</p>`)).join('') + (ui.calling ? '<p class="hs-op wait"><i>상담원</i>…</p>' : '');
  const dealPanel = pay === 'barter' || pay === 'talk';
  const talkIn = dealPanel ? `<div class="hs-in op"><input name="hs-op" data-input="hs-op" data-enter="${pay === 'barter' ? 'hs-appraise' : 'hs-op'}" value="${esc(ui.opInput)}" maxlength="200" placeholder="${pay === 'barter' ? '한마디 덧붙이기 (없어도 됨)' : '상담원에게 할 말'}" aria-label="상담원에게 할 말"${ui.calling ? ' disabled' : ''}>${pay === 'talk' ? `<button data-action="hs-op"${needAttr('hs-op', ui.opInput, ui.calling)}>말하기</button>` : ''}</div>` : '';
  const mine = pay === 'barter' ? barterItems(ctx) : [];
  const pick = pay === 'barter' ? (mine.length ? `<div class="hs-pick">${mine.map((x) => `<button class="${ui.offer.includes(x.id) ? 'on' : ''}" data-action="hs-offer" data-value="${esc(x.id)}" aria-pressed="${ui.offer.includes(x.id)}"><span class="pic">${itemPic(x)}</span><span class="nm">${esc(x.name)}</span></button>`).join('')}</div><button class="hs-appraise" data-action="hs-appraise"${ui.calling || !ui.offer.length ? ' disabled' : ''}>감정 받기</button>` : '<p class="hs-none">내밀 물건이 없습니다.</p>') : '';
  const log = `<div class="hs-callog" aria-live="polite">${lines}</div>`;
  const terms = termsFor(part, pay);
  const block = terms ? termsBlock(ctx, terms) : '';
  const label = pay === 'won' ? `${part.item.price.toLocaleString('en-US')}원 결제` : pay === 'appear' ? '시연 참여로 주문' : '이 조건으로 주문';
  const orderBtn = `<button class="pri" data-action="hs-order"${terms && !block && !ui.calling ? '' : ' disabled'}>${esc(label)}</button>`;
  const warn = block ? `<p class="hs-warn">${esc(block)}</p>` : '';
  if (mobile) {
    // 폰 칩은 좁아 까닭을 못 적는다(누름 풍선도 없다): 꺼진 칩의 까닭을 칩 줄 아래 한 줄로
    const off = PAYS.filter((p) => !payOk(ctx, part, s, p)).map((p) => `${payInfo(part, p).short}: ${payWhy(p)}`).join(' · ');
    const body = `<div class="hs-pays chips">${PAYS.map(btn).join('')}</div>${off ? `<p class="hs-payno">${esc(off)}</p>` : ''}${pick ? `<div class="hs-offer">${pick}</div>` : ''}${log}${talkIn}`;
    return popShell(title, body, `${dealPanel ? termsCard(terms) : ''}${warn}<div class="hs-ft">${orderBtn}<button data-action="hs-pop" data-value="">끊기</button></div>`, 'call m');
  }
  // PC: 좌우로 나눈다 (11-15 사용자) — 왼쪽 [상품 · 결제 방법 · 맞교환 물건 · 조건 · 주문], 오른쪽 상담원 통화 칸이 위에서 아래까지
  const side = `<div class="hs-side"><div class="sc">${head}<div class="hs-pays list">${PAYS.map(btn).join('')}</div>${pick ? `<div class="hs-offer">${pick}</div>` : ''}</div><div class="ft">${dealPanel ? termsCard(terms) || '<div class="hs-terms none"><small>상담원 조건</small><b>아직 없음</b></div>' : ''}${warn}<div class="hs-ft">${orderBtn}<button data-action="hs-pop" data-value="">끊기</button></div></div></div>`;
  const line = `<div class="hs-line"><h5>상담원</h5>${log}${talkIn}</div>`;
  return popShell(title, `<div class="hs-split">${side}${line}</div>`, '', 'call');
}

/** 접힌 종이(뒷면) 모양: 들린 세모를 접는 선에 대어 뒤집은 자리. 상자(.flapw)는 가로 2·px, 세로 2·py 이고 좌표는 그 안의 % (젖힌 정도가 바뀌어도 그대로) */
function flapStyle(look: ReturnType<typeof stickerLook>): string {
  const { rx, ry } = look;
  const right = look.corner === 'br' || look.corner === 'tr';
  const bottom = look.corner === 'br' || look.corner === 'bl';
  const q = rx * rx + ry * ry;
  // 모서리에서 잰 자리 (상자 크기에 대한 비): 접는 선의 두 끝 · 뒤집힌 꼭짓점
  const pts: [number, number][] = [[0.5, 0], [0, 0.5], [(ry * ry) / q, (rx * rx) / q]];
  const at = ([u, v]: [number, number]): [number, number] => [right ? 1 - u : u, bottom ? 1 - v : v];
  const poly = pts.map((p) => at(p).map((n) => `${(n * 100).toFixed(2)}%`).join(' ')).join(', ');
  // 종이 결: 접는 선에서 꼭짓점 쪽으로 밝아졌다 어두워진다
  const dx = (right ? -1 : 1) * ry;
  const dy = (bottom ? -1 : 1) * rx;
  const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const L = Math.abs(2 * rx * ux) + Math.abs(2 * ry * uy);
  const pos = (p: [number, number]) => { const [x, y] = at(p); return 0.5 + ((x - 0.5) * 2 * rx * ux + (y - 0.5) * 2 * ry * uy) / L; };
  const t0 = pos(pts[0]);
  const t1 = pos(pts[2]);
  const st = (k: number) => `${((t0 + (t1 - t0) * k) * 100).toFixed(1)}%`;
  return `clip-path:polygon(${poly});background:linear-gradient(${ang.toFixed(1)}deg,#a89a52 ${st(0)},#e9dfa8 ${st(0.1)},#fffbe6 ${st(0.32)},#f4ecc2 ${st(0.7)},#d9cd8f ${st(1)})`;
}

/** 상품 스티커 (11-20 사용자): 스티커 밑 바닥에 숨은 효과 글 전체가 찍혀 있고, 모서리가 조금 들린 자리만큼만 그 글이 보인다 (조각을 골라 따로 쓰지 않는다). PC 끌기·누르기, 폰 누르기. 숨은 효과가 없으면 바닥에 글이 없다 */
function peekPop(ctx: ChatContext, s: HsSettings): string {
  const { part } = nowPart(ctx);
  if (!part) return '';
  const it = part.item;
  const mobile = isPhone();
  const look = stickerLook(it.id);
  const truth = String(it.truth ?? '').replace(/\s+/g, ' ').trim();
  const emb = truth && truth !== '?' ? `<p class="emb">${Array.from(truth).map((ch) => `<i>${esc(ch)}</i>`).join('')}</p>` : '';
  const under = s.peek ? `<div class="hs-und" aria-hidden="true">${emb}</div>` : '';
  const corner = s.peek ? `<span class="flapw" aria-hidden="true"><span class="flap" style="${flapStyle(look)}"></span></span><button class="corner" data-action="hs-lift" aria-label="스티커 모서리 들추기"${ui.lifted ? ' disabled' : ''}></button>` : '';
  const cls = `hs-sticker c-${look.corner}${ui.lifted ? ' lifted anim' : ''}`;
  const hint = s.peek && !ui.lifted ? `<p class="hs-peelhint">${mobile ? '스티커를 <i>눌러</i> 들춰 보세요' : '모서리를 <i>잡아 끌거나 눌러</i> 들춰 보세요'}</p>` : '';
  // 폰은 모서리가 작고 화면 끝이라 스티커 어디를 눌러도 모서리부터 젖힌다
  const tap = mobile && s.peek && !ui.lifted ? ' data-action="hs-lift"' : '';
  return popShell('상품 스티커', `<div class="${cls}"${tap} style="--from:${ui.peelFrom || 0.12};--lim:${look.lim};--tilt:${look.tilt}deg;--rx:${look.rx};--ry:${look.ry}">${under}<div class="face"><span class="pic">${itemPic(it)}</span><b>${esc(it.name)}</b><p>${esc(it.desc)}</p>${it.effect ? `<p class="ef">${esc(it.effect)}</p>` : ''}</div>${corner}</div>${hint}`);
}

/** 젖힌 자리에 실제로 드러난 글자 (화면에서 잰 것). 시청 기록에 적는다 */
let peeked = '';
/** 바닥 글: 스티커 넓이에 꽉 차게 글자 크기를 맞추고, 다 젖힌 세모 안에 드는 글자를 모은다 (스티커 기울기와 무관한 제자리 좌표) */
function fitUnder(st: HTMLElement): void {
  const emb = st.querySelector<HTMLElement>('.hs-und .emb');
  peeked = '';
  if (!emb) return;
  const cells = [...emb.querySelectorAll<HTMLElement>('i')];
  const W = emb.clientWidth;
  const H = emb.clientHeight;
  if (!cells.length || !W || !H) return;
  let size = Math.max(14, Math.min(22, Math.floor(Math.sqrt((W * H) / (cells.length * 1.45)))));
  emb.style.fontSize = `${size}px`;
  while (size > 12 && emb.scrollHeight > H) emb.style.fontSize = `${--size}px`;
  if (!st.classList.contains('lifted')) return;
  const cs = getComputedStyle(st);
  const p = (parseFloat(cs.getPropertyValue('--pmax')) || 96) * (parseFloat(cs.getPropertyValue('--lim')) || 1);
  const px = p * (parseFloat(cs.getPropertyValue('--rx')) || 1);
  const py = p * (parseFloat(cs.getPropertyValue('--ry')) || 1);
  const right = st.classList.contains('c-br') || st.classList.contains('c-tr');
  const bottom = st.classList.contains('c-br') || st.classList.contains('c-bl');
  const out: string[] = [];
  let last = -2;
  cells.forEach((c, i) => {
    const x = emb.offsetLeft + c.offsetLeft + c.offsetWidth / 2;
    const y = emb.offsetTop + c.offsetTop + c.offsetHeight / 2;
    const dx = right ? st.offsetWidth - x : x;
    const dy = bottom ? st.offsetHeight - y : y;
    if (dx / px + dy / py > 0.94 || !(c.textContent ?? '').trim()) return;
    if (out.length && i !== last + 1) out.push(' … ');
    out.push(c.textContent ?? '');
    last = i;
  });
  peeked = out.join('').trim();
}

function audPop(): string {
  if (ui.audNo) return popShell('★ 방청 신청', `<p class="hs-ok">접수되었습니다.</p><p class="hs-no">접수번호 <b>${esc(ui.audNo)}</b></p>`, '<button class="pri" data-action="hs-pop" data-value="">확인</button>');
  return popShell('★ 방청 신청', `<label class="hs-f"><span>이름</span><input value="${esc(userInfo().name || '')}" readonly></label>
<button class="hs-chk${ui.agree ? ' on' : ''}" data-action="hs-agree" aria-pressed="${ui.agree}"><i></i>객석 규칙에 동의합니다</button>`, `<button class="pri" data-action="hs-aud" ${ui.agree ? '' : 'disabled'}>신청</button><button data-action="hs-pop" data-value="">취소</button>`);
}

/** 사이트 화면. 그린 뒤 homeshopMounted(root) 로 방송 칸을 꽂는다 */
export function homeshopTab(ctx: ChatContext, env: HsEnv): string {
  liveEnv = env;
  sync(ctx);
  const mobile = isPhone();
  // 방송에 닿지 않는 동안(core/homeshop.ts hsReach): 방송 칸은 「신호 없음」(편성을 못 받은 때와 같은 화면), 방청 신청은 숨기고, 주문 조회는 그대로 보인다
  const reach = hsReach(ctx.chat);
  const s0 = hsSettings(ctx.chat.scriptstate);
  const s = reach ? s0 : { ...s0, aud: false };
  const show0 = readShow(ctx.chat.scriptstate);
  const show = reach || !s0.on ? show0 : { ...show0, loaded: false };
  const stt = homeshopStatus();
  const art = homeshopArt();
  const note = !s.on ? '방송 없음' : !reach ? '신호 없음' : stt.failed ? '신호 없음' : !art ? stt.progress || '방송 준비 중' : ui.loading ? '방송 연결 중' : ui.notice ? '신호 없음' : show.loaded ? '' : '신호 없음';
  setPlayerFeed({ art, show: s.on && !ui.loading ? show : { ...show, loaded: false }, s, note, scale: scaleOf(s, mobile), tel: telOf(ctx) }, { advance, redraw: () => liveEnv?.render(), log: (entries, shown) => saveLog(ctx.charIndex, ctx.chatIndex, entries, shown), soldOut });
  playerPhone(ui.pop === 'call');
  const pending = liveOrders(ctx.chat.scriptstate, aliveAnchors(ctx.chat)).length;
  const tabs: [View['page'], string][] = [['', 'ON AIR'], ['sched', '편성표'], ['orders', `주문 조회${pending ? ` ${pending}` : ''}`]];
  const menu = `<nav class="hs-menu">${tabs.map(([k, l]) => `<button class="${ui.page === k ? 'on' : ''}" data-action="hs-page" data-value="${k}" aria-pressed="${ui.page === k}">${l}</button>`).join('')}${s.aud ? '<button data-action="hs-pop" data-value="aud">방청 신청</button>' : ''}</nav>`;
  const head = `<header class="hs-gnb"><span class="hs-logo">망상<i>홈쇼핑</i></span>${menu}<span class="hs-tel"><small>주문 전화</small>☎ ${esc(telOf(ctx))}</span></header>`;
  const err = `${failBox()}${stt.failed ? `<div class="hs-err" role="alert"><span>방송 그림을 받지 못했어요. ${esc(stt.failed)}</span></div>` : ''}`;
  const page = ui.page === 'sched' ? schedPage(show0, s) : ui.page === 'orders' ? ordersPage(ctx) : onAir(ctx, show, s, mobile);
  const pop = ui.pop === 'call' ? callPop(ctx, s) : ui.pop === 'peek' ? peekPop(ctx, s) : ui.pop === 'aud' && s.aud ? audPop() : '';
  return `<div class="hs${mobile ? ' hs-m' : ''}">${head}<div class="hs-wrap">${err}${page}</div>${pop}</div>`;
}

/** 화면을 그린 뒤 (app render 끝): 방송 칸에 캔버스·채팅을 꽂는다. 사이트가 안 보이면 멈춘다 */
export function homeshopMounted(root: HTMLElement): void {
  if (root.querySelector('[data-hs-mount="stage"]')) mountPlayer(root);
  else stopPlayer();
  // 스티커 모서리 끌기 (PC 만. 폰은 누르기만): 끄는 만큼 젖히고, 절반 넘게 끌고 놓으면 그 자리부터 마저 젖힌다(hs-lift 에 끈 만큼을 넘김). 덜 끌면 도로 붙는다
  // 통화 기록: 다시 그리면 맨 위로 돌아가므로 늘 마지막 말(방금 상담원 답)이 보이게 맨 아래로
  root.querySelectorAll<HTMLElement>('.hs .hs-callog').forEach((el) => { el.scrollTop = el.scrollHeight; });
  const stk = root.querySelector<HTMLElement>('.hs .hs-sticker');
  if (stk) fitUnder(stk);
  const corner = root.querySelector<HTMLButtonElement>('.hs .hs-sticker .corner');
  if (corner && !isPhone() && !corner.dataset.drag) peelDrag(corner);
}
function peelDrag(corner: HTMLButtonElement): void {
  corner.dataset.drag = '1';
  const st = corner.closest<HTMLElement>('.hs-sticker');
  if (!st) return;
  let start: { x: number; y: number } | null = null;
  let peel = 0;
  let moved = false;
  corner.addEventListener('pointerdown', (e) => {
    if (corner.disabled) return;
    start = { x: e.clientX, y: e.clientY };
    peel = 0;
    moved = false;
    corner.setPointerCapture(e.pointerId);
    st.classList.add('drag');
  });
  corner.addEventListener('pointermove', (e) => {
    if (!start) return;
    // 들리는 모서리에서 스티커 안쪽(대각선)으로 간 거리 / 젖힐 수 있는 최대
    const sx = st.classList.contains('c-br') || st.classList.contains('c-tr') ? 1 : -1;
    const sy = st.classList.contains('c-br') || st.classList.contains('c-bl') ? 1 : -1;
    const d = (sx * (start.x - e.clientX) + sy * (start.y - e.clientY)) / Math.SQRT2;
    if (Math.abs(d) > 4) moved = true;
    const cs = getComputedStyle(st);
    const max = (parseFloat(cs.getPropertyValue('--pmax')) || 96) * (parseFloat(cs.getPropertyValue('--lim')) || 1);
    peel = Math.max(0.12, Math.min(1, 0.12 + d / max));
    st.style.setProperty('--peel', String(peel));
  });
  const end = () => {
    if (!start) return;
    start = null;
    st.classList.remove('drag');
    if (!moved) return; // 그냥 누른 것: 아래 click 이 hs-lift 로 젖힌다
    if (peel >= 0.5) corner.dataset.value = String(peel);
    else {
      st.style.removeProperty('--peel');
      // 덜 끌었으면 이번 click 은 들추기가 아니다
      const eat = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      corner.addEventListener('click', eat, { once: true, capture: true });
      setTimeout(() => corner.removeEventListener('click', eat, { capture: true }), 400);
    }
  };
  corner.addEventListener('pointerup', end);
  corner.addEventListener('pointercancel', end);
}

/** 소지품 상세의 「열기」 단추: 이 물건이 안 연 택배 상자일 때만 (ui/items.ts 가 부른다) */
export function boxButton(ctx: ChatContext, itemIdOf: string): string {
  return boxOrder(ctx.chat.scriptstate, itemIdOf, aliveAnchors(ctx.chat)) ? `<button class="gx-chip" data-action="hs-box-open" data-value="${esc(itemIdOf)}">열기</button>` : '';
}

// ── 설정 페이지 (우주 쇼핑몰·포인트몰과 같은 규칙: 이 페이지에는 망상홈쇼핑에만 있는 줄만. 재생 규칙·효과·속도·줄 수 전부 여기서) ──
// 사용·자동 호출·모델·상품 수·값 기준과 상점 넷이 같이 쓰는 값은 설정 → 상점에 있다 (ui/famtable.ts shopTable → ui/settings.ts shopFamSet)

export function homeshopSettingsPane(ctx: ChatContext): string {
  const vars = ctx.chat.scriptstate;
  const s = hsSettings(vars);
  const art = homeshopArt();
  const clipHelp = art
    ? (['A', 'B'] as const).map((c) => `${c === 'A' ? '와이드' : '바스트'}: ${[...new Map(art.pack.cuts[c].clips.map((k) => [k.name, `${k.ko}(${CLIP_GROUP_LABEL[k.group]})`])).values()].join(', ')}`).join('<br>')
    : '방송 그림을 받으면 동작 목록이 보여요.';
  // 줄·묶음·차례는 정의표(core/setdef/homeshop.ts)에서 온다. 여기는 값을 읽어 주는 선만 잇는다
  const b = (x: boolean) => (x ? '1' : '0');
  const n = (k: string) => { const raw = vars?.[HS_NUM[k].key]; return raw === undefined || raw === '' ? HS_NUM[k].def : Number(raw); };
  const vals: Record<string, string> = {
    net: b(s.net), retry: String(retryOf(ctx)), say: b(s.say), turn: b(s.turn), lock: b(s.lock), drop: b(s.drop.on), barter: b(s.barter), talk: b(s.talk), peek: b(s.peek), aud: b(s.aud),
    clips: s.clipsText, cut: b(s.fx.cut), bulb: b(s.fx.bulb), tear: b(s.fx.tear), scan: b(s.fx.scan), scalePc: s.scalePc, scalePh: s.scalePhone,
    ...Object.fromEntries(Object.entries(HS_DEF_TEXT).map(([k, [name]]) => [k, String(vars?.[name] ?? '')])),
  };
  const wire: Wire = {
    cur: (k) => vals[k] ?? String(n(k)),
    minmax: (k) => [n(HS_PAIRS[k][0]), n(HS_PAIRS[k][1])],
    // 동작 분류에는 글로 된 기본값이 없다 (기본 분류는 방송 그림 팩에 있다): 칸은 비워 두고 적는 꼴은 설명에
    help: { clips: () => `동작이 나오는 때를 바꿔요. 한 줄에 「컷:동작=분류」로 적어요(예: B:웃음=드물게). 컷은 A(와이드)·B(바스트), 분류는 기본·가끔·대사·드물게·안씀. 비워 두면 아래 분류 그대로예요.<br>${clipHelp}` },
  };
  const body = defGroups(HOMESHOP_SET, wire);
  return `<div class="ph-form"><header class="ph-room-head"><div class="ph-room-title"><b>${esc(hsName())} 설정</b></div></header><div class="ph-form-body ps">${body}</div></div>`;
}

/** hs-cfg 「키=값」 · hs-num 「키=숫자」 · hs-text 「키=글」 · hs-retry */
async function homeshopSettingsAction(action: string, value: string | undefined, ctx: ChatContext, env: HsEnv): Promise<boolean> {
  if (!['hs-cfg', 'hs-num', 'hs-text', 'hs-retry'].includes(action)) return false;
  const set = async (vars: Record<string, string>) => {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (Object.entries(vars).every(([k, v]) => String(chat.scriptstate?.[k] ?? '') === v) ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
    await env.refresh();
    return true;
  };
  if (action === 'hs-retry') {
    const n = stepNext(value, retryOf(ctx), 0, 3);
    return n === null ? true : set({ [HS_RETRY_KEY]: String(n) });
  }
  const m = /^([\w:]+)=([\s\S]*)$/.exec(value ?? '');
  if (!m) return true;
  const [, k, v] = m;
  if (action === 'hs-cfg') {
    // 상시 노출만 기본이 꺼짐이라 켠 값을 적는다 (나머지는 기본이 켜짐: 끈 값만 적는다)
    if (k === 'net') return set({ [HS_KEY.net]: v === '0' ? '' : '1' });
    if (HS_FLAG[k]) return set({ [HS_FLAG[k]]: v === '0' ? '0' : '' });
    if (k === 'scalePc' || k === 'scalePh') return ['auto', 'fit', '0.5', '1', '2'].includes(v) ? set({ [k === 'scalePc' ? HS_KEY.scalePc : HS_KEY.scalePhone]: v }) : true;
    return true;
  }
  if (action === 'hs-num') {
    const d = HS_NUM[k];
    const n = Math.round(Number(v));
    if (!d || !Number.isFinite(n) || v.trim() === '') return env.render(), true;
    // 최소·최대 줄은 짝도 같이 맞춘다 (전수검사 11-13)
    return set(hsNumVars(ctx.chat.scriptstate, k, n, Object.values(HS_PAIRS).find((p) => p.includes(k))));
  }
  // hs-text
  if (HS_DEF_TEXT[k]) { const [name, def, max] = HS_DEF_TEXT[k]; return set({ [name]: defStored(v.replace(/\s+/g, ' '), def, undefined, max) }); }
  if (k === 'clips') return set({ [HS_KEY.clips]: v.trim().slice(0, 2000) });
  return true;
}
