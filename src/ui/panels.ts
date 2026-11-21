// 접는 칸(<details data-keep>)이 다시 그려도 열린 채로 남게 기억한다 (설정을 하나 바꿀 때마다 닫히지 않게)
const open = new Set<string>();

export const keepOpen = (key: string, fallback = false) => (open.has(key) || (fallback && !open.has(`!${key}`)) ? ' open' : '');

/** app.ts가 toggle 이벤트(버블링 안 함)를 잡아 넘긴다 */
export function rememberPanel(el: HTMLDetailsElement): void {
  const key = el.dataset.keep;
  if (!key) return;
  open.delete(key);
  open.delete(`!${key}`);
  open.add(el.open ? key : `!${key}`);
}

/** 코드가 칸을 열어 두기 (예: 새로 만든 규칙 칸) */
export function markOpen(key: string): void {
  open.delete(`!${key}`);
  open.add(key);
}

/** 가장 가까운 스크롤 칸만 움직여 el 을 보이게 한다. scrollIntoView 는 overflow hidden 틀(창·본문 틀)까지 밀어 머리줄이 잘렸다 (전수점검 눌러-중대-1) */
export function scrollInside(el: HTMLElement | null | undefined, block: 'start' | 'center' | 'nearest' = 'nearest', smooth = false): void {
  if (!el) return;
  let box = el.parentElement;
  while (box) {
    const oy = getComputedStyle(box).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) break;
    box = box.parentElement;
  }
  if (!box) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const off = r.top - b.top;
  let top = box.scrollTop;
  if (block === 'start') top += off;
  else if (block === 'center') top += off - (box.clientHeight - r.height) / 2;
  else if (off < 0) top += off;
  else if (off + r.height > box.clientHeight) top += off + r.height - box.clientHeight;
  box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}
