// PC 왼쪽 메뉴를 손가락으로 (11-22 사용자): 메뉴 위에서 옆으로 쓸면 접고 펴고, 접은 아이콘 줄을 위아래로 끌면 아이콘 묶음 자리를 옮긴다.
// 폰 배치의 아래 바에서는 하지 않는다. 아이콘 묶음 자리는 남는 높이를 위·아래 빈칸(.gx-nav-top / .gx-nav-gap)이 나눠 갖는 몫(0~100)이다.
import { isPhone, zoomK } from './media';

const FIRE = 40;
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
  const parts = (n: HTMLElement) => ({ top: n.querySelector<HTMLElement>(':scope > .gx-nav-top'), gap: n.querySelector<HTMLElement>(':scope > .gx-nav-gap') });
  root.addEventListener('touchstart', (e) => {
    mode = 'off';
    if (e.touches.length !== 1 || isPhone()) return;
    nav = (e.target as Element).closest<HTMLElement>('.gx-nav');
    if (!nav) return;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    mode = 'wait';
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (mode === 'off' || !nav) return;
    const dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if (mode === 'wait') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.4) mode = 'side';
      else if (nav.classList.contains('folded') && Math.abs(dy) > Math.abs(dx) * 1.4) {
        const { top, gap } = parts(nav);
        const th = top?.offsetHeight ?? 0;
        free = th + (gap?.offsetHeight ?? 0);
        // 아이콘이 칸을 꽉 채워 남는 높이가 없으면 옮길 데가 없다 (그때는 칸이 스크롤된다)
        if (!top || !gap || free < 8) return void (mode = 'off');
        top0 = th;
        at = (th / free) * 100;
        mode = 'move';
      } else return void (mode = 'off');
    }
    if (mode === 'move') {
      if (e.cancelable) e.preventDefault();
      const { top, gap } = parts(nav);
      at = Math.max(0, Math.min(100, ((top0 + dy / zoomK()) / free) * 100));
      if (top) top.style.flexGrow = String(at);
      if (gap) gap.style.flexGrow = String(100 - at);
    }
  }, { passive: false });
  const end = (e: TouchEvent) => {
    const m = mode;
    mode = 'off';
    if (!nav) return;
    if (m === 'move') return acts.place(Math.round(at));
    if (m !== 'side') return;
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
    if (Math.abs(dx) < FIRE) return;
    // 메뉴가 붙은 벽 쪽으로 쓸면 접고, 반대로 쓸면 편다
    const right = root.dataset.nav === 'right' || root.closest<HTMLElement>('[data-nav]')?.dataset.nav === 'right';
    const toWall = right ? dx > 0 : dx < 0;
    if (toWall !== nav.classList.contains('folded')) acts.fold(toWall);
  };
  root.addEventListener('touchend', end, { passive: true });
  root.addEventListener('touchcancel', () => { mode = 'off'; }, { passive: true });
}
