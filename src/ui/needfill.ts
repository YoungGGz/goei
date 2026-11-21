// 칸이 비면 그 칸을 보내는 단추를 흐리게 (2026-11-09 사용자: 빈 칸으로 눌러도 아무 말 없던 것 — 로그인 닉네임·이미지 지침 임의 추가·쇼핑몰 문의)
// 단추에 data-need="칸 name" 을 달고, 그릴 때 빈 칸이면 disabled 로 그린다. 치는 동안은 아래 처리기가 바로 켜고 끈다.
// data-busy 가 달린 단추(불러오는 중 등)는 건드리지 않는다.
let bound = false;

/** 그릴 때: 값이 비었으면 ' disabled' */
/** other: 글이 없어도 보낼 거리가 있다(첨부·팔 물건 등) → 흐리게 하지 않는다 */
export const needAttr = (name: string, value: string, busy = false, other = false): string =>
  other ? (busy ? ' disabled' : '') : ` data-need="${name}"${busy ? ' data-busy="1"' : ''}${busy || !value.trim() ? ' disabled' : ''}`;

export function bindNeedFill(doc: Document = document): void {
  if (bound) return;
  bound = true;
  doc.addEventListener(
    'input',
    (ev) => {
      const el = ev.target as HTMLInputElement | null;
      const name = el?.getAttribute?.('name');
      if (!name) return;
      // data-need 에 칸 이름을 여럿(띄어 쓴) 달면 그 칸이 모두 차야 켠다 (괴담넷 새 쪽지: 받는 사람·내용)
      doc.querySelectorAll<HTMLButtonElement>(`button[data-need~="${CSS.escape(name)}"]:not([data-busy])`).forEach((b) => {
        const names = (b.getAttribute('data-need') ?? '').split(/\s+/).filter(Boolean);
        b.disabled = names.some((n) => {
          const f = n === name ? el : doc.querySelector<HTMLInputElement>(`[name="${CSS.escape(n)}"]`);
          return !!f && !f.value.trim();
        });
      });
    },
    true,
  );
}
