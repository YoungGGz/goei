// 폰 화면(아래 바·서랍) 기준 하나. 폭 600px 이하 (11-21 사용자: 폴드 펼친 화면은 PC 배치), 또는 손가락 화면에서 짧은 쪽(가로로 든 폰의 높이)이 500px 미만이면 폰 화면.
// 2026-11-06 사용자: 폰을 가로로 들면(844×390) PC 화면으로 나와 줄이 잘리던 것 → 가로도 폰 화면으로. CSS 의 @media 도 같은 글을 쓴다.
// 11-22 사용자: 펼친 폴드 같은 중간 폭(601~860)은 설정 「펼친 폴드 화면 배치」로 PC·모바일을 고른다. 모바일이면 기준 폭을 860 으로 올린다.
import { getPrefs } from '../core/settings';

/** 중간 폭의 위 끝 (style.css 의 601~860 묶음과 같은 값) */
export const FOLD_MAX = 860;
const BASE = 600;
/** 지금 폰 배치로 치는 폭 한도 */
export const phoneMax = (): number => (getPrefs().fold === 'phone' ? FOLD_MAX : BASE);
export const phoneMq = (): string => `(max-width: ${phoneMax()}px), (max-height: 499px) and (pointer: coarse)`;
export const isPhone = (): boolean => matchMedia(phoneMq()).matches;
/** 기준 폭이 바뀌는 두 경계를 다 지켜본다 (설정을 바꿔도 다시 걸 필요가 없게) */
export const PHONE_WATCH = [`(max-width: ${BASE}px)`, `(max-width: ${FOLD_MAX}px)`, '(max-height: 499px) and (pointer: coarse)'];
/** CSS 글의 @media 머리에서 폰 기준 폭을 지금 설정에 맞춘다: 모바일이면 600→860, 601→861 (중간 폭 전용 묶음 601~860 은 저절로 안 걸린다) */
export function foldCss(css: string): string {
  const max = phoneMax();
  if (max === BASE) return css;
  return css.replace(/@media[^{]*\{/g, (head) => head.replace(/max-width:\s*600px/g, `max-width: ${max}px`).replace(/min-width:\s*601px/g, `min-width: ${max + 1}px`));
}

const styles: { el: HTMLStyleElement; css: string; max: number }[] = [];
/** <style> 에 CSS 를 넣고 기억해 둔다: 설정이 바뀌면 syncFoldStyles 가 같은 글을 새 기준 폭으로 다시 넣는다 */
export function foldStyle(el: HTMLStyleElement, css: string): void {
  el.textContent = foldCss(css);
  styles.push({ el, css, max: phoneMax() });
}
/** 설정 「펼친 폴드 화면 배치」가 바뀌었으면 넣어 둔 CSS 를 다시 맞춘다. 바뀐 게 있으면 true */
export function syncFoldStyles(): boolean {
  const max = phoneMax();
  let changed = false;
  for (const s of styles) if (s.max !== max) { s.el.textContent = foldCss(s.css); s.max = max; changed = true; }
  return changed;
}
