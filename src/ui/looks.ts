// 아바타 고르기 (2026-11-07~08 사용자): 시작 패널(내 페르소나)과 시작한 뒤가 같은 팝업을 쓴다.
// 남·여를 고르면 그 성별 일반 NPC 프리셋 전부가 정면 대기 동작으로 움직이는 격자에서 하나를 꼭 고른다.
// 대기 동작은 1배(픽셀 그대로)로 CSS steps 로 돌린다. 고른 것은 이 채팅 변수 $st_look 에 둔다 (core/looks.ts).
import { LOOK_ACT_GAP_SEC, LOOK_GENDERS, LOOK_KEY, lookId, looksOf, pickLookAct, type LookGender, type LookRow } from '../core/looks';
import { playerAgent } from '../core/player';
import { idleOf, lookActs, looksStatus, lookRows, ensureLooks, type ActLook, type IdleLook } from '../host/looks';
import { savePrefs } from '../host/prefs';
import { updateChat, type ChatContext } from '../host/risu';
import { ICONS } from './icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 아바타 팝업 (시작 패널·시작한 뒤 같은 창) */
export const lookUi: { open: boolean; g: LookGender | ''; notice: string } = { open: false, g: '', notice: '' };

let rerender: () => void = () => {};
/** 창을 다시 그리는 함수 (ui/app.ts 가 둔다) */
export function setLookRender(fn: () => void): void {
  rerender = fn;
}

/** 아바타 고르기 팝업을 연다 (시작 패널의 아바타 칸, 장착 상자 인물 자리 등에서 부른다) */
export function openLookPicker(): void {
  lookUi.open = true;
  lookUi.notice = '';
  lookUi.g = '';
  rerender();
}

export function closeLookPicker(): void {
  lookUi.open = false;
  rerender();
}

/** 정면 대기 동작 한 칸 (1배, steps 반복). cls 로 크기 칸을 덧붙인다 */
export function lookSprite(look: IdleLook, cls = ''): string {
  const style = `--lw:${look.w}px;--lh:${look.h}px;--ln:${look.frames};--ld:${(look.frames * look.sec).toFixed(2)}s;background-image:url('${look.url}')`;
  return `<span class="gx-look${cls ? ` ${cls}` : ''}" style="${style}" aria-hidden="true"></span>`;
}

// ── 대기 사이에 끼우는 동작 (2026-11-19 사용자): 소지품·상점의 내 아바타(.it-look)가 대기를 돌다가 가끔 고른 동작 하나를 한 번 하고 대기로 돌아온다 ──
// 대기 한 바퀴가 끝나는 순간에 동작 시트로 바꾸고(첫 장이 대기 자세에서 이어지게), 동작이 끝나면 대기 시트로 되돌린다.
// 동작 장은 대기 칸보다 넓어서, 대기 칸이 있던 자리에 그대로 겹치도록 바깥 여백을 음수로 준다 (자리·발밑이 안 움직인다).

/** 내 아바타 칸: 동작을 끼울 수 있게 모습 번호를 달아 둔다 */
export function avatarSprite(look: IdleLook): string {
  const html = lookSprite(look, 'it-look');
  // 동작 그림을 미리 받아 둔다 (첫 차례에 바로 나오게)
  if (look.acts) void lookActs(look.id);
  return look.acts ? html.replace('<span ', `<span data-look="${esc(look.id)}" `) : html;
}

let actTimer: ReturnType<typeof setTimeout> | undefined;
let lastAct = '';

const actGapMs = () => (LOOK_ACT_GAP_SEC[0] + Math.random() * (LOOK_ACT_GAP_SEC[1] - LOOK_ACT_GAP_SEC[0])) * 1000;
const stillMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function playAct(el: HTMLElement, a: ActLook): void {
  const idle = el.getAttribute('style') ?? '';
  const iw = parseFloat(el.style.getPropertyValue('--lw')) || a.w;
  const ih = parseFloat(el.style.getPropertyValue('--lh')) || a.h;
  const back = () => {
    el.removeEventListener('animationend', back);
    el.classList.remove('act');
    el.setAttribute('style', idle);
  };
  el.style.setProperty('--lw', `${a.w}px`);
  el.style.setProperty('--lh', `${a.h}px`);
  el.style.setProperty('--ln', String(a.frames));
  el.style.setProperty('--ld', `${(a.frames * a.sec).toFixed(2)}s`);
  el.style.backgroundImage = `url('${a.url}')`;
  el.style.margin = `${-a.dy}px ${-(a.w - a.dx - iw)}px ${-(a.h - a.dy - ih)}px ${-a.dx}px`;
  el.classList.add('act');
  el.addEventListener('animationend', back);
}

const avatarEl = () => document.querySelector<HTMLElement>('.gx-look.it-look[data-look]:not(.act)');

/** 대기 한 바퀴가 끝날 때 동작으로 바꾼다. 그 사이 화면이 다시 그려져 칸이 바뀌었으면 새 칸에서 다시 기다린다 (tries 번까지) */
function armAct(id: string, a: ActLook, tries: number): void {
  const el = avatarEl();
  if (!el || el.dataset.look !== id) return;
  let done = false;
  const go = () => {
    done = true;
    if (el.isConnected && !el.classList.contains('act')) playAct(el, a);
  };
  el.addEventListener('animationiteration', go, { once: true });
  const wait = (parseFloat(el.style.getPropertyValue('--ld')) || 2) * 1000 + 300;
  setTimeout(() => {
    if (done) return;
    el.removeEventListener('animationiteration', go);
    if (tries > 0) armAct(id, a, tries - 1);
  }, wait);
}

function actTick(): void {
  actTimer = setTimeout(actTick, actGapMs());
  if (stillMotion() || document.hidden) return;
  const el = avatarEl();
  if (!el || !el.getClientRects().length) return;
  const id = el.dataset.look ?? '';
  const acts = lookActs(id);
  const a = acts && pickLookAct(acts, lastAct, Math.random());
  if (!a) return;
  lastAct = a.k;
  // 그림을 먼저 읽어 둔다 (안 읽힌 채 바꾸면 빈 장이 보인다)
  const img = new Image();
  img.onload = () => armAct(id, a, 2);
  img.src = a.url;
}

/** 동작 끼우기를 켠다 (ui/app.ts 가 한 번 부른다). 아바타가 화면에 없으면 아무 일도 없다 */
export function startLookActs(): void {
  if (actTimer) return;
  actTimer = setTimeout(actTick, actGapMs());
}

const genderOf = (rows: LookRow[] | null, id: string): LookGender | '' => rows?.find((r) => r.id === id)?.g ?? '';

/**
 * 성별 단추 + 아바타 격자. sel = 고른 번호, g = 보고 있는 성별('' 이면 고른 것의 성별).
 * 단추: look-g(성별) · look(아바타) · look-retry(팩 다시 받기)
 */
function chooser(sel: string, g: LookGender | '', withSegs: boolean): string {
  const rows = lookRows();
  const shown = g || genderOf(rows, sel);
  const segs = !withSegs ? '' : `<div class="gx-segs">${LOOK_GENDERS.map((x) => `<button class="gx-seg${x === shown ? ' on' : ''}" data-action="look-g" data-value="${x}" aria-pressed="${x === shown}">${x}</button>`).join('')}</div>`;
  if (!rows) {
    const st = looksStatus();
    const msg = st.failed
      ? `아바타 그림을 받지 못했어요. ${esc(st.failed)} <button class="gx-chip" data-action="look-retry">다시 받기</button>`
      : `아바타 그림을 받는 중…${st.progress ? ` ${esc(st.progress)}` : ''}`;
    return `${segs}<div class="gx-hint">${msg}</div>`;
  }
  if (!shown) return `${segs}<div class="gx-hint">성별을 고르면 고를 수 있는 아바타가 보여요.</div>`;
  const cells = looksOf(rows, shown)
    .map((r) => `<button class="gx-whoc gx-lookc${r.id === sel ? ' on' : ''}" data-action="look" data-value="${esc(r.id)}" aria-pressed="${r.id === sel}" aria-label="아바타 ${esc(r.id)}">${lookSprite(idleOf(r))}</button>`)
    .join('');
  return `${segs}<div class="gx-lookg">${cells}</div>`;
}

/** 아바타 팝업. sel = 지금 고른 번호, lockedName = 고유 인물로 플레이 중이면 그 이름(고를 수 없음).
 *  g 를 주면(시작 패널에서 성별을 고른 뒤) 그 성별만, 안 주면(시작한 뒤) 팝업 안에 성별 단추 */
export function lookPopup(sel: string, lockedName = '', g: LookGender | '' = ''): string {
  if (!lookUi.open) return '';
  const inner = lockedName ? `<p class="gx-hint">${esc(lockedName)}(으)로 플레이 중이라 그 인물 모습을 써요.</p>` : chooser(sel, g || lookUi.g, !g);
  return `<div class="gx-agpop gx-lookpop" data-action="look-close" role="dialog" aria-label="아바타"><div class="gx-agpop-card gx-lookpop-card" data-action="look-keep">
    <div class="gx-lookpop-head"><b>아바타</b><button class="gx-x" data-action="look-close" aria-label="닫기">${ICONS.close}</button></div>
    ${inner}${lookUi.notice ? `<div class="gx-err" role="alert">${esc(lookUi.notice)}</div>` : ''}
  </div></div>`;
}

/** 시작한 뒤의 아바타 팝업 (이 채팅 값) */
export function chatLookPopup(ctx: ChatContext): string {
  if (!lookUi.open) return '';
  const s = ctx.chat.scriptstate;
  return lookPopup(lookId(s), playerAgent(ctx.char.globalLore, s)?.name ?? '');
}

/** 팝업 공통 단추 (닫기·성별·다시 받기). 처리했으면 true. 아바타를 고르는 「look」은 부르는 쪽이 따로 */
export function lookCommon(action: string, value: string | undefined): boolean {
  switch (action) {
    case 'look-open':
      openLookPicker();
      return true;
    case 'look-close':
      closeLookPicker();
      return true;
    case 'look-keep':
      return true;
    case 'look-retry':
      void ensureLooks();
      rerender();
      return true;
    case 'look-g':
      if (value === '남' || value === '여') lookUi.g = value;
      rerender();
      return true;
  }
  return false;
}

/** 고른 칸을 바로 「고름」으로 보이고 잠깐 뒤에 닫는다 (11-08 눌러 보기 점검: 바로 닫혀 고른 표시를 볼 틈이 없음) */
export const LOOK_CLOSE_MS = 350;
export function flashPick(value: string, then: () => void | Promise<void>): void {
  document.querySelectorAll<HTMLElement>('.gx-lookc').forEach((b) => {
    const on = b.dataset.value === value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  setTimeout(() => void then(), LOOK_CLOSE_MS);
}

/** 시작한 뒤 팝업의 단추: 고르면 이 채팅에 바로 적고 닫는다. 처리했으면 true */
export async function lookAction(action: string, value: string | undefined, ctx: ChatContext, refresh: () => Promise<void>): Promise<boolean> {
  if (lookCommon(action, value)) return true;
  if (action !== 'look' || !lookUi.open || !value) return false;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (String(chat.scriptstate?.[LOOK_KEY] ?? '') === value ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [LOOK_KEY]: value } })).catch((error) => {
    lookUi.notice = error instanceof Error ? error.message : String(error);
    return null;
  });
  // 마지막에 고른 아바타 = 다음 새 채팅 기본
  await savePrefs((p) => ({ ...p, look: value })).catch(() => {});
  if (lookUi.notice) {
    await refresh();
    return true;
  }
  flashPick(value, async () => {
    lookUi.open = false;
    await refresh();
  });
  return true;
}

/**
 * 시작 패널 「아바타」 단계: 주인공 칸과 같은 크기의 아바타 칸 하나(얼굴 1배로 움직임). 누르면 팝업(맨 위 남·여, 아래 격자)에서 꼭 고른다.
 * player 를 주면(기존 인물로 시작) 그 인물 모습·성별이 들어간 채 잠긴다
 */
export function lookStep(sel: string, player = ''): string {
  const rows = lookRows();
  const r = player ? rows?.find((x) => x.unique && x.name === player) : sel ? rows?.find((x) => x.id === sel) : undefined;
  const face = r ? `<span class="gx-ava gx-lookface">${lookSprite(idleOf(r))}</span>` : `<span class="gx-ava"><span>${ICONS.person}</span></span>`;
  const label = player ? `${player} 모습` : r ? '바꾸기' : '눌러서 고르기';
  return `<div class="gx-who"><button class="gx-whoc gx-lookchip${r ? ' on' : ''}" data-action="look-open" data-look="${r?.id ?? ''}" ${player ? 'disabled' : ''} aria-pressed="${!!r}">${face}<span class="gx-whot"><b>아바타</b><small>${esc(label)}</small></span></button></div>`;
}

/** 이 채팅의 대기 동작 (host/looks.ts idleLook). 화면 쪽에서 한 곳에서 가져다 쓰게 */
export { idleLook } from '../host/looks';

/** 아바타 CSS (ui/app.ts 가 style.css 뒤에 붙인다) */
export const LOOK_CSS = `
.gx-look { display: block; flex: none; width: var(--lw); height: var(--lh); background-repeat: no-repeat; background-position: 0 0; image-rendering: pixelated; animation: gx-look var(--ld) steps(var(--ln)) infinite; }
@keyframes gx-look { to { background-position: calc(var(--lw) * var(--ln) * -1) 0; } }
.gx-look.act { animation: gx-look-act var(--ld) steps(var(--ln)) 1; }
@keyframes gx-look-act { to { background-position: calc(var(--lw) * var(--ln) * -1) 0; } }
.it-av:has(.gx-look.act) { overflow: visible; }
.gx-lookg { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; max-height: min(560px, calc(100vh - 200px)); overflow: auto; padding: 2px; }
.gx-lookc { position: relative; justify-content: center; align-items: flex-end; height: 268px; padding: 6px 4px; overflow: hidden; }
.gx-lookpop-card { width: min(720px, calc(100vw - 40px)); min-width: 0; align-items: stretch; }
.gx-lookpop-card .gx-segs { align-self: flex-start; }
.gx-lookpop-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.gx-lookpop-head b { font-size: 16px; }
.gx-lookchip:disabled { cursor: default; opacity: .75; }
.gx-lookface { width: 34px; height: 34px; border-radius: 9px; }
.gx-lookface .gx-look { position: absolute; left: 50%; top: 0; translate: -50% 0; }
@media (max-width: 760px), (max-height: 499px) and (pointer: coarse) {
  .gx-lookg { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
  .gx-lookc { height: 262px; padding: 4px 2px; }
}
@media (prefers-reduced-motion: reduce) { .gx-look { animation: none; } }
`;
