// 설정 창의 되돌릴 수 없는 일 확인: 모두 같은 가운데 팝업(.gw-confirm)으로 묻는다.
// 저장·불러오기(2026-11-08 사용자: 확인은 전부 팝업)와 달리 기록·규칙·장면·묶음·저장소 지우기는 그 자리 「정말 지우기 / 취소」 칩이라
// 확인 방식이 화면마다 달랐다 (전수점검 눌러-보통-28). 단추가 보내는 값은 예전 칩과 같다
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface AskBtn { action: string; value?: string }
export const askPopup = (msg: string, yes: AskBtn, no: AskBtn, label = '지우기'): string => {
  const v = (b: AskBtn) => (b.value !== undefined ? ` data-value="${esc(b.value)}"` : '');
  return `<div class="gw-confirm"><div class="gw-confirm-box"><p>${esc(msg)}</p><div class="gx-row-btns"><button class="gx-mini danger" data-action="${esc(yes.action)}"${v(yes)}>${esc(label)}</button><button class="gx-mini" data-action="${esc(no.action)}"${v(no)}>취소</button></div></div></div>`;
};
