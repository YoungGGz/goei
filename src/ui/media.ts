// 폰 화면(아래 바·서랍) 기준 하나. 폭 600px 이하 (11-21 사용자: 폴드 펼친 화면은 PC 배치), 또는 손가락 화면에서 짧은 쪽(가로로 든 폰의 높이)이 500px 미만이면 폰 화면.
// 2026-11-06 사용자: 폰을 가로로 들면(844×390) PC 화면으로 나와 줄이 잘리던 것 → 가로도 폰 화면으로. CSS 의 @media 도 같은 글을 쓴다.
// 11-22 사용자: 펼친 폴드 같은 중간 폭(601~860)은 설정 「펼친 폴드 화면 배치」로 PC·모바일을 고른다. 모바일이면 기준 폭을 860 으로 올린다.
import { FOLD_FILL_DEFAULT, FOLD_ZOOM_DEFAULT, getPrefs } from '../core/settings';

/** 중간 폭의 위 끝 */
export const FOLD_MAX = 860;
const BASE = 600;
/** 중간 폭(펼친 폴드)에서 PC 배치를 그대로 줄여 넣는 배율 (11-22 사용자: 화면마다 구조를 바꾸지 말고 글자·UI 를 통째로 줄인다).
 *  0.7 이면 752 폭 화면이 752 / 0.7 = 1074 폭 PC 창처럼 짜이고 0.7 배로 그려진다. 값은 설정 「펼친 폴드 화면 배율」(prefs.foldZoom, %) */
const foldZoom = (): number => (getPrefs().foldZoom ?? FOLD_ZOOM_DEFAULT) / 100;
const MID = `(min-width: ${BASE + 1}px) and (max-width: ${FOLD_MAX}px)`;
const LAND = '(max-height: 499px) and (pointer: coarse)'; // 가로로 든 폰: 늘 폰 배치
type Mode = 'base' | 'phone' | 'zoom';
/** 지금 CSS 를 어떻게 넣을지: 중간 폭이 아니면 그대로, 중간 폭 + 모바일 설정이면 폰 기준을 860 으로, 중간 폭 + PC 설정이면 통째로 줄임 */
function mode(): Mode {
  if (getPrefs().fold === 'phone') return 'phone';
  return typeof matchMedia === 'function' && matchMedia(MID).matches && !matchMedia(LAND).matches ? 'zoom' : 'base';
}
/** 화면 좌표(px)를 줄인 화면 안의 길이로: 줄이지 않았으면 1 */
export const zoomK = (): number => (mode() === 'zoom' ? foldZoom() : 1);
/** 지금 폰 배치로 치는 폭 한도 */
export const phoneMax = (): number => (getPrefs().fold === 'phone' ? FOLD_MAX : BASE);
export const phoneMq = (): string => (mode() === 'zoom' ? 'not all' : `(max-width: ${phoneMax()}px), (max-height: 499px) and (pointer: coarse)`);
export const isPhone = (): boolean => matchMedia(phoneMq()).matches;
/** 같은 기준을 화면 크기 숫자로 (본 화면에 붙는 호출 진행 창 host/progwin.ts 가 쓴다: 그쪽은 리스 화면 크기를 숫자로만 안다).
 *  가로로 든 폰(손가락 화면, 높이 500 미만)은 늘 폰, 폭은 phoneMax() 까지. 중간 폭(펼친 폴드)의 PC 배치는 폰이 아니다 (3차 점검 R08) */
export const isPhoneSize = (vw: number, vh: number): boolean =>
  (vh < 500 && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || vw <= phoneMax();
/** 기준이 바뀌는 경계를 다 지켜본다 (설정을 바꿔도 다시 걸 필요가 없게) */
export const PHONE_WATCH = [`(max-width: ${BASE}px)`, `(max-width: ${FOLD_MAX}px)`, LAND];
/** 펼친 폴드에서 창이 차지하는 화면 몫(%): 설정 「펼친 폴드 창 가로·세로」(prefs.foldW·foldH) */
const foldFill = (): [number, number] => [getPrefs().foldW ?? FOLD_FILL_DEFAULT, getPrefs().foldH ?? FOLD_FILL_DEFAULT];
/** 펼친 폴드를 PC 배치로 줄여 보는 중인지 (손가락 화면이라 쓸기는 폰처럼 받는다) */
export const isFoldPc = (): boolean => mode() === 'zoom';
const r2 = (n: number): number => Math.round(n * 100) / 100;
/** CSS 글을 지금 방식에 맞춘다.
 *  phone: @media 머리의 폰 기준 폭 600→860, 601→861.
 *  zoom: @media 머리의 폭·높이 기준을 배율만큼 줄이고(752 폭이 PC 규칙에 걸리게), 화면 단위(vw·vh)는 배율만큼 키우고, 문서를 통째로 줄인다 */
// @media 머리만 고친다: 주석 안의 「@media」 글자에서 시작해 다음 @container 머리까지 삼키지 않게 * 와 } 에서 끊는다
// (11-22: 주석 뒤의 @container gwbody 1001px 가 700px 로 줄어 폴드 설정의 호출 흐름 표가 카드로 안 바뀌고 잘렸다)
export function foldCss(css: string): string {
  const m = mode();
  if (m === 'base') return css;
  if (m === 'phone') { const max = FOLD_MAX; return css.replace(/@media[^{}*]*\{/g, (head) => head.replace(/max-width:\s*600px/g, `max-width: ${max}px`).replace(/min-width:\s*601px/g, `min-width: ${max + 1}px`)); }
  const k = foldZoom();
  return css
    .replace(/(\d*\.?\d+)(vw|vh|dvw|dvh|svh|lvh)\b/g, (_, n: string, u: string) => `${r2(Number(n) / k)}${u}`)
    .replace(/@media[^{}*]*\{/g, (head) => head.replace(/((?:min|max)-(?:width|height):\s*)(\d*\.?\d+)px/g, (_, a: string, n: string) => `${a}${r2(Number(n) * k)}px`))
    + `\nhtml { zoom: ${k}; }\n`
    // 펼친 폴드에서는 상황판 창과 설정 창을 화면 가로·세로 95% 로 (사용자 11-22: 설정 창이 상황판보다 좁아 다 잘린다 → 둘 다 95%). 「설정 창 폭」 값과 상한(1280·950·1340)은 이 화면에서 쓰지 않는다.
    // 따로 뜨는 상점 창(.solo)과 AI 상담을 연 설정 창은 원래 규칙 그대로
    + `.gx .gx-panel:not(.solo), .gw:not(.ai-on) .gw-win { width: ${r2(foldFill()[0] / k)}vw; height: ${r2(foldFill()[1] / k)}vh; }\n`;
}

/** 넣은 방식의 표: 배율이 바뀌어도 다시 넣게 배율까지 적는다 */
const modeKey = (): string => { const m = mode(); return m === 'zoom' ? `zoom:${foldZoom()}:${foldFill().join('x')}` : m; };
const styles: { el: HTMLStyleElement; css: string; mode: string }[] = [];
/** <style> 에 CSS 를 넣고 기억해 둔다: 방식이 바뀌면 syncFoldStyles 가 같은 글을 다시 맞춰 넣는다 */
export function foldStyle(el: HTMLStyleElement, css: string): void {
  el.textContent = foldCss(css);
  styles.push({ el, css, mode: modeKey() });
}
/** 설정 「펼친 폴드 화면 배치」나 화면 폭이 바뀌었으면 넣어 둔 CSS 를 다시 맞춘다. 바뀐 게 있으면 true */
export function syncFoldStyles(): boolean {
  const m = modeKey();
  let changed = false;
  for (const s of styles) if (s.mode !== m) { s.el.textContent = foldCss(s.css); s.mode = m; changed = true; }
  return changed;
}

/** 줄여 넣은 화면(zoom)에서 getBoundingClientRect·clientX 는 화면 px, style·offsetWidth·scrollTop 은 안쪽 px 다.
 *  화면 좌표로 style 을 정하는 코드는 아래 셋으로 안쪽 px 를 받는다 (줄이지 않았으면 그대로) */
export function zrect(el: Element): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  const r = el.getBoundingClientRect();
  const k = zoomK();
  return k === 1 ? r : { left: r.left / k, top: r.top / k, right: r.right / k, bottom: r.bottom / k, width: r.width / k, height: r.height / k };
}
/** 화면 px 길이·좌표(clientX, innerWidth 등)를 안쪽 px 로 */
export const zpx = (n: number): number => n / zoomK();
/** zrect 의 「없으면 undefined」 꼴 (a?.getBoundingClientRect() 자리) */
export const zrectQ = (el: Element | null | undefined): ReturnType<typeof zrect> | undefined => (el ? zrect(el) : undefined);
