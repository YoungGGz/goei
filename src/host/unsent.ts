// 자동 전송이 막혀 아직 안 보낸 임무 요청·직접 입력: 채팅 속 메시지에 「전송 대기」와 취소 버튼.
// 취소는 그 메시지를 지운다. 이미 보내져 응답을 만드는 중이면 지우지 않는다 (요청 도중 채팅을 저장하면 응답이 사라질 수 있다).
import { isUnsent, setUnsent } from '../core/dispatch';
import type { Chat } from '../core/types';
import { withdrawUnsent } from '../core/world/output';
import type { LoreEntry } from '../core/types';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';
import { getChar, updateChat } from './risu';
import { isWaiting, passWaiting } from './waiting';
import { timeMs } from '../core/timing';
import { openRepick } from './openinghint';

/** 방금 놓은 마지막 유저 메시지(기록 카드·직접 입력)를 「아직 안 보냄」으로 */
export async function markUnsent(charIndex: number, chatIndex: number): Promise<void> {
  await updateChat(charIndex, chatIndex, (chat) => {
    const list = chat.message ?? [];
    const last = list[list.length - 1];
    if (!last || last.role !== 'user' || typeof last.data !== 'string') return null;
    list[list.length - 1] = { ...last, data: setUnsent(last.data, true) };
    return chat;
  });
}

/** 응답이 붙은 뒤: 남은 「아직 안 보냄」 표시를 끈다. 바꿀 게 없으면 null */
export function clearUnsent(chat: Chat): Chat | null {
  const list = chat.message ?? [];
  if (!list.some((m) => typeof m.data === 'string' && isUnsent(m.data))) return null;
  chat.message = list.map((m) => (typeof m.data === 'string' && isUnsent(m.data) ? { ...m, data: setUnsent(m.data, false) } : m));
  return chat;
}

/**
 * 안 보낸 임무 요청 카드·직접 입력을 채팅에서 물린다 (걸어 둔 커스텀 임무도 같이, core/world/output.ts withdrawUnsent). 물렸으면 저장한 채팅, 아니면 null.
 * 채팅 속 카드의 「취소」와 임무 창의 「요청 취소」(target = 그 요청의 목표)가 같이 쓴다.
 * 취소로 채팅이 비면(시작 화면 직접 입력·커스텀 임무를 물린 것) 다시 고르게 시작 화면을 연다 (사용자 11-07: 취소해도 선택 창이 안 열림)
 */
export async function withdrawUnsentAt(charIndex: number, chatIndex: number, lore: LoreEntry[] | undefined, target?: string): Promise<Chat | null> {
  const waiting = isWaiting();
  const saved = await updateChat(charIndex, chatIndex, (chat) => withdrawUnsent(chat, lore, target));
  // 답을 기다리는 중에 물렸다(「취소」 두 번): 그 요청이 살아 있었다면 답이 늦게 온다. 물린 요청의 답이니 붙이지 않게 적어 둔다 (3차 점검 R30)
  if (saved && waiting) withdrawn = { charIndex, chatIndex, id: String(saved.id ?? '') };
  if (saved && !(saved.message ?? []).length) openRepick();
  return saved;
}

/** 답을 기다리는 중에 요청을 물린 채팅. 새 본편 요청이 나가면 잊는다 (body.ts onBeforeRequest) */
let withdrawn: { charIndex: number; chatIndex: number; id: string } | null = null;
export function forgetWithdrawn(): void {
  withdrawn = null;
}
/** 지금 붙은 답이 물린 요청의 답인가 (body.ts onOutput: 그러면 그 답을 지우고 아무 처리도 하지 않는다). 채팅 id 가 있으면 id 로도 맞춘다 */
export function wasWithdrawn(charIndex: number, chatIndex: number, chat: Chat | null | undefined): boolean {
  if (!withdrawn || withdrawn.charIndex !== charIndex || withdrawn.chatIndex !== chatIndex) return false;
  const id = String(chat?.id ?? '');
  return !withdrawn.id || !id || withdrawn.id === id;
}

let busy = false;

onChatClick('unsent', async (_doc, x, y) => {
  if (busy) return false;
  const list = await elements(_doc, '[data-goei-cancel]');
  if (!list.length) return 'idle';
  let on: (typeof list)[number] | null = null;
  for (const el of list) if (await hit(el, x, y)) on = el;
  if (!on) return false;
  // 응답을 기다리는 중이면 정한 시간(설정 「취소 두 번 누르기」) 안에 두 번 눌러야 지운다 (실패한 요청이 3분 동안 취소를 막지 않게, 전수검사 11-13).
  // 첫 번은 단추 글로 알린다 (전수점검 보통-10: 아무 표시가 없어 고장 난 것처럼 보였다)
  if (!passWaiting()) {
    const el = on;
    await el.setInnerHTML('한 번 더 누르면 취소').catch(() => {});
    setTimeout(() => void el.setInnerHTML('취소').catch(() => {}), timeMs('cancelTwice'));
    return true;
  }
  busy = true;
  try {
    const charIndex = await risuai.getCurrentCharacterIndex();
    const chatIndex = await risuai.getCurrentChatIndex();
    await withdrawUnsentAt(charIndex, chatIndex, (await getChar(charIndex))?.globalLore);
  } catch (error) {
    console.log(`[goei] 요청 취소 실패: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    busy = false;
  }
  return true;
});

/** 채팅에 안 보낸 카드를 그릴 때 (body.ts display) */
export function unsentShown(): void {
  armChatClick('unsent');
}
