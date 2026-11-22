// PC 왼쪽 메뉴를 끌어서 (11-22 사용자): 메뉴 위에서 옆으로 쓸면(손가락) 또는 끌면(마우스) 접고 펴고,
// 접은 아이콘 줄을 위아래로 끌면 아이콘 묶음 자리를 옮긴다. 표시는 따로 없다.
// 폰 배치의 아래 바에서는 하지 않는다. 아이콘 묶음 자리는 남는 높이를 위·아래 빈칸(.gx-nav-top / .gx-nav-gap)이 나눠 갖는 몫(0~100)이다.
import { isPhone, zoomK } from './media';

const FIRE = 40;
/** 손가락을 뗀 뒤 브라우저가 지어내는 마우스 이벤트를 거르는 시간 */
const TOUCH_GHOST_MS = 800;
const bound = new WeakSet<HTMLElement>();

export interface NavSwipeActs {
  /** 접기(true)·펴기(false) */
  fold: (on: boolean) => void;
  /** 접은 아이콘 묶음 자리 (0 = 맨 위, 100 = 맨 아래) */
  place: (at: number) => void;
}

export function bindNavSwipe(root: HTMLElement, acts: NavSwipeActs): void {
  if (bound.has(root)) return;
  bound.add(root);
  let nav: HTMLElement | null = null;
  let x0 = 0;
  let y0 = 0;
  let mode: 'off' | 'wait' | 'side' | 'move' = 'off';
  let free = 0;
  let top0 = 0;
  let at = 0;
  let touchAt = 0;
  /** 마우스로 끌고 난 바로 뒤의 click 한 번을 삼킨다 (끌다 놓은 자리의 메뉴가 눌리지 않게) */
  let eat = false;
  const parts = (n: HTMLElement) => ({ top: n.querySelector<HTMLElement>(':scope > .gx-nav-top'), gap: n.querySelector<HTMLElement>(':scope > .gx-nav-gap') });

  const start = (t: EventTarget | null, x: number, y: number): void => {
    mode = 'off';
    if (isPhone()) return;
    nav = (t as Element | null)?.closest?.<HTMLElement>('.gx-nav') ?? null;
    if (!nav) return;
    x0 = x;
    y0 = y;
    mode = 'wait';
  };
  /** 끄는 중이면 true (부른 쪽이 기본 동작을 막는다) */
  const move = (x: number, y: number): boolean => {
    if (mode === 'off' || !nav) return false;
    const dx = x - x0;
    const dy = y - y0;
    if (mode === 'wait') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return false;
      if (Math.abs(dx) > Math.abs(dy) * 1.4) mode = 'side';
      else if (nav.classList.contains('folded') && Math.abs(dy) > Math.abs(dx) * 1.4) {
        const { top, gap } = parts(nav);
        const th = top?.offsetHeight ?? 0;
        free = th + (gap?.offsetHeight ?? 0);
        // 아이콘이 칸을 꽉 채워 남는 높이가 없으면 옮길 데가 없다 (그때는 칸이 스크롤된다)
        if (!top || !gap || free < 8) return (mode = 'off'), false;
        top0 = th;
        at = (th / free) * 100;
        mode = 'move';
      } else return (mode = 'off'), false;
    }
    if (mode === 'move') {
      const { top, gap } = parts(nav);
      at = Math.max(0, Math.min(100, ((top0 + dy / zoomK()) / free) * 100));
      if (top) top.style.flexGrow = String(at);
      if (gap) gap.style.flexGrow = String(100 - at);
    }
    return true;
  };
  /** 끌기로 끝났으면 true */
  const end = (x: number): boolean => {
    const m = mode;
    mode = 'off';
    if (!nav) return false;
    if (m === 'move') return acts.place(Math.round(at)), true;
    if (m !== 'side') return false;
    const dx = x - x0;
    if (Math.abs(dx) >= FIRE) {
      // 메뉴가 붙은 벽 쪽으로 끌면 접고, 반대로 끌면 편다
      const right = root.dataset.nav === 'right' || root.closest<HTMLElement>('[data-nav]')?.dataset.nav === 'right';
      const toWall = right ? dx > 0 : dx < 0;
      if (toWall !== nav.classList.contains('folded')) acts.fold(toWall);
    }
    return true;
  };

  root.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return void (mode = 'off');
    start(e.target, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (move(e.touches[0].clientX, e.touches[0].clientY) && mode === 'move' && e.cancelable) e.preventDefault();
  }, { passive: false });
  root.addEventListener('touchend', (e) => {
    touchAt = Date.now();
    end(e.changedTouches[0]?.clientX ?? x0);
  }, { passive: true });
  root.addEventListener('touchcancel', () => {
    touchAt = Date.now();
    mode = 'off';
  }, { passive: true });

  // 마우스: 메뉴에서 누른 채 끌면 같은 일을 한다. 놓는 곳이 메뉴 밖일 수 있어 움직임과 놓기는 문서에서 듣는다
  const doc = root.ownerDocument;
  root.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || Date.now() - touchAt < TOUCH_GHOST_MS) return;
    eat = false;
    start(e.target, e.clientX, e.clientY);
  });
  doc.addEventListener('mousemove', (e) => {
    if (mode === 'off') return;
    if (!(e.buttons & 1)) return void (mode = 'off');
    if (move(e.clientX, e.clientY)) e.preventDefault();
  });
  doc.addEventListener('mouseup', (e) => {
    if (mode === 'off' || mode === 'wait') return void (mode = 'off');
    eat = end(e.clientX);
    // click 이 오지 않는 경우(놓은 곳이 다른 칸)에도 다음 누르기를 삼키지 않게 곧 푼다
    if (eat) setTimeout(() => (eat = false), 0);
  });
  root.addEventListener('click', (e) => {
    if (!eat) return;
    eat = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  // 끄는 동안 그림·글자가 따라 끌려 나오지 않게
  root.addEventListener('dragstart', (e) => {
    if (mode !== 'off' && (e.target as Element | null)?.closest?.('.gx-nav')) e.preventDefault();
  });
}
