// 접은 PC 메뉴의 아이콘 묶음 자리 옮기기 (11-22 사용자): 접은 아이콘 줄을 위아래로 끌면(손가락·마우스) 묶음이 따라 움직인다.
// 옆으로 쓸기는 여기서 받지 않는다 — 메뉴 위에서도 뒤로·앞으로 쓸기(ui/swipeback.ts)가 받는다. 접고 펴기는 ‹ › 줄 끝의 단추.
// 폰 배치의 아래 바에서는 하지 않는다. 아이콘 묶음 자리는 남는 높이를 위·아래 빈칸(.gx-nav-top / .gx-nav-gap)이 나눠 갖는 몫(0~100)이다.
import { isPhone, zoomK } from './media';

/** 손가락을 뗀 뒤 브라우저가 지어내는 마우스 이벤트를 거르는 시간 */
const TOUCH_GHOST_MS = 800;
const bound = new WeakSet<HTMLElement>();

/** place = 접은 아이콘 묶음 자리를 저장 (0 = 맨 위, 100 = 맨 아래) */
export function bindNavSwipe(root: HTMLElement, place: (at: number) => void): void {
  if (bound.has(root)) return;
  bound.add(root);
  let nav: HTMLElement | null = null;
  let x0 = 0;
  let y0 = 0;
  let mode: 'off' | 'wait' | 'move' = 'off';
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
    nav = (t as Element | null)?.closest?.<HTMLElement>('.gx-nav.folded') ?? null;
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
      if (Math.abs(dy) <= Math.abs(dx) * 1.4) return (mode = 'off'), false;
      const { top, gap } = parts(nav);
      const th = top?.offsetHeight ?? 0;
      free = th + (gap?.offsetHeight ?? 0);
      // 아이콘이 칸을 꽉 채워 남는 높이가 없으면 옮길 데가 없다 (그때는 칸이 스크롤된다)
      if (!top || !gap || free < 8) return (mode = 'off'), false;
      top0 = th;
      mode = 'move';
    }
    const { top, gap } = parts(nav);
    at = Math.max(0, Math.min(100, ((top0 + dy / zoomK()) / free) * 100));
    if (top) top.style.flexGrow = String(at);
    if (gap) gap.style.flexGrow = String(100 - at);
    return true;
  };
  /** 끌기로 끝났으면 true */
  const end = (): boolean => {
    const m = mode;
    mode = 'off';
    if (m !== 'move') return false;
    place(Math.round(at));
    return true;
  };

  root.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return void (mode = 'off');
    start(e.target, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
  }, { passive: false });
  root.addEventListener('touchend', () => {
    touchAt = Date.now();
    end();
  }, { passive: true });
  root.addEventListener('touchcancel', () => {
    touchAt = Date.now();
    mode = 'off';
  }, { passive: true });

  // 마우스: 놓는 곳이 메뉴 밖일 수 있어 움직임과 놓기는 문서에서 듣는다
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
  doc.addEventListener('mouseup', () => {
    if (mode === 'off') return;
    eat = end();
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
