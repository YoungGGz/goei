// 괴담톡 보기 전용 방 (라이트보드 미니톡 사전설정 셋, 2026-11-06 사용자 「전부 넣어야지」)
// - 사이드스토리: 본편에 안 나온 짧은 대화. 시점 인물 곁 인물들끼리 일상 이야기
// - 혼잣말: 시점 인물 한 명의 속마음을 메시지처럼
// - 다중인격 혼잣말: 시점 인물의 마음속 여러 갈래(1~9)가 단톡처럼 주고받는다
// 내가 끼지 않는 방이라 괴담톡 대화 기록(PState)과 따로 둔다. 선톡·새로고침·채팅 반영에는 섞이지 않는다.
// 방은 참여 인물마다 하나: 같은 인물들이면 그 방에 이어 쓰고, 인물이 다르면 새 방 (matchView).
import { decodeJson, hiddenPause, parseReactions, PH, phoneValue, PhoneError } from './phone';
import { trimRooms } from './budget';
import { guideTxt } from './guides';

export type ViewPreset = 'side' | 'mono' | 'multi';
/** 종류 이름 (화면과, 이름 없는 방의 이름으로 모델에 다시 가는 글이 같이 쓴다): 지침 「괴담톡」 VIEW.NAME.<종류> 절. 부를 때마다 읽는다 */
const viewName = (p: ViewPreset): string => guideTxt('Phone', `VIEW.NAME.${p.toUpperCase()}`);
export const VIEW_PRESETS: Record<ViewPreset, string> = { get side() { return viewName('side'); }, get mono() { return viewName('mono'); }, get multi() { return viewName('multi'); } };
export const PH_VIEWS = PH('views');
export const PH_VIEW_LAST = PH('view_last');
/** 보관: rooms 남겨 두는 방 수, history 한 방에 쌓아 두는 말풍선 수 (같은 인물들의 방에 이어 쓰므로). 고급 설정 값으로 맞춰 둔다 (core/advanced.ts applyAdvanced) */
export const VIEW_STORE = { rooms: 30, history: 300 };
export const VIEW_LIMITS = { messages: 30, text: 600, name: 60, people: 10 };

export interface ViewPerson { id: string; name: string }
/** time: 이어 쓸 때 끼우는 시각 줄 (11-07) */
export interface ViewMsg { sender: string; type: 'text' | 'pause' | 'skip' | 'time'; text: string; reactions?: string }
export interface ViewRoom {
  id: string;
  preset: ViewPreset;
  name: string;
  pov: string;
  people: ViewPerson[];
  messages: ViewMsg[];
  time: string;
  unread: boolean;
}

export interface ViewSettings {
  preset: ViewPreset;
  /** 시점 인물 (비우면 주인공) */
  pov: string;
  /** 시점 인물의 말을 모델이 써도 되는지 (원본 「사칭 허용」) */
  speak: boolean;
  /** 등장인물 범위 (사이드스토리): 0 주요 인물 / 1 장면 안 / 2 장면 안 주요 인물 / 3 자율 */
  scope: '0' | '1' | '2' | '3';
  /** 방 크기 (사이드스토리): 0 자동 / 1 둘이서 / 2 여럿 */
  size: '0' | '1' | '2';
  /** 발동: 수동 / 창을 열 때 / 매 턴 */
  auto: 'manual' | 'open' | 'turn';
}

export function viewSettings(state: Record<string, unknown> | undefined): ViewSettings {
  const v = (k: string) => phoneValue(state, k);
  const preset = v('view_preset');
  const scope = v('view_scope');
  const size = v('view_size');
  const auto = v('view_auto');
  return {
    preset: preset === 'mono' || preset === 'multi' ? preset : 'side',
    pov: v('view_pov').trim().slice(0, 40),
    speak: v('view_speak') === '1',
    scope: scope === '1' || scope === '2' || scope === '3' ? scope : '0',
    size: size === '1' || size === '2' ? size : '0',
    auto: auto === 'open' || auto === 'turn' ? auto : 'manual',
  };
}

export function readViews(state: Record<string, unknown> | undefined): ViewRoom[] {
  try {
    const v = JSON.parse(String(state?.[PH_VIEWS] ?? '[]'));
    return Array.isArray(v) ? v.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.messages) && Array.isArray(r.people)) : [];
  } catch {
    return [];
  }
}

/** added = 새 방을 넣은 저장. 이때만 보관 수를 넘는 오래된 방을 지운다 (방을 열거나 지울 때는 자르지 않는다: 보관 수를 낮춘 뒤 옛 방을 열면 그 방이 사라졌다) */
export const writeViews = (list: ViewRoom[], added = false): Record<string, string> => ({ [PH_VIEWS]: JSON.stringify(added ? list.slice(-VIEW_STORE.rooms) : list) });
export const viewUnread = (list: ViewRoom[]) => list.filter((r) => r.unread).length;

// ── 방은 참여 인물로 가른다 (11-15 사용자: 「같은 인물들이 매번 새 방을 파니까」 이어 쓰라고 한 것 — 인물이 다르면 다른 방) ──
// 사이드스토리: 참여 인물 이름이 모두 같으면 같은 방. 혼잣말·다중인격 혼잣말: 시점 인물이 같으면 같은 방 (갈래 이름은 그때그때 달라도 한 사람의 마음속).
const nameKey = (s: string) => s.replace(/\s+/g, ' ').trim();
const povName = (r: Pick<ViewRoom, 'pov' | 'people'>) => nameKey(r.people.find((p) => p.id === r.pov)?.name ?? '');
const roomKey = (r: Pick<ViewRoom, 'preset' | 'pov' | 'people'>) =>
  r.preset === 'side' ? [...new Set(r.people.map((p) => nameKey(p.name)))].sort().join('\n') : povName(r);

/** 새로 만든 방(value)을 이어 붙일 기존 방. 없으면 undefined (새 방). 같은 것이 여럿이면 가장 최근 방 */
export function matchView(list: ViewRoom[], value: Pick<ViewRoom, 'preset' | 'pov' | 'people'>): ViewRoom | undefined {
  const key = roomKey(value);
  return key ? [...list].reverse().find((x) => x.preset === value.preset && roomKey(x) === key) : undefined;
}

/** 같은 종류의 기존 방들 (모델에 보낼 모양, 최근 방부터). 모델이 인물 이름을 그대로 다시 쓰고 앞 내용을 되풀이하지 않게.
 *  limit = 방마다 넘길 말풍선 수 (양 표 「보기 전용 방」 줄의 지난 기록) */
export function viewRooms(list: ViewRoom[], preset: ViewPreset, limit = VIEW_LIMITS.messages): unknown[] {
  // 최근 방부터. 요청 토큰 상한에 걸리면 오래된 방부터 덜 싣는다 (core/budget.ts trimRooms)
  const all = list.filter((x) => x.preset === preset).reverse();
  const rooms = all.slice(0, trimRooms(all.length));
  const each = Math.max(1, limit);
  return rooms.map((r) => ({
    name: r.name, pov: r.pov, participants: r.people,
    messages: r.messages.filter((m) => m.type !== 'time').slice(-each).map((m) => ({ sender: m.type === 'text' ? m.sender : '-', type: m.type, content: m.type === 'text' ? m.text : m.type === 'pause' ? m.text : '-' })),
  }));
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** 응답 {name, pov, participants:[{id,name}], messages:[{sender,type,content,reactions}]} → 방. 틀린 말풍선만 빼고, 남는 게 없으면 실패 */
export function parseView(raw: string, preset: ViewPreset): Omit<ViewRoom, 'id' | 'time' | 'unread'> {
  const value = decodeJson(raw) as Record<string, unknown>;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PhoneError(guideTxt('Phone', 'ERR.VIEW_FORMAT'), raw);
  const people: ViewPerson[] = [];
  for (const p of (Array.isArray(value.participants) ? value.participants : []) as Record<string, unknown>[]) {
    const id = str(p?.id).slice(0, 40);
    const name = str(p?.name).slice(0, VIEW_LIMITS.name);
    if (id && name && id !== '-' && !people.some((x) => x.id === id)) people.push({ id, name });
  }
  const pov = str(value.pov);
  if (!people.length || !people.some((p) => p.id === pov)) throw new PhoneError(guideTxt('Phone', 'ERR.VIEW_POV'), raw);
  if (preset === 'mono' && people.length !== 1) people.splice(0, people.length, people.find((p) => p.id === pov)!);
  const ids = new Set(people.slice(0, VIEW_LIMITS.people).map((p) => p.id));
  const messages: ViewMsg[] = [];
  for (const m of (Array.isArray(value.messages) ? value.messages : []) as Record<string, unknown>[]) {
    const type = str(m?.type);
    const content = str(m?.content);
    if (type === 'text' && ids.has(str(m?.sender)) && content) {
      const cap = ids.size - 1;
      const reactions = cap > 0 ? parseReactions(m?.reactions).map((r) => `${r.emoji}${Math.min(r.count, cap)}`).join(' ') : '';
      messages.push({ sender: str(m.sender), type: 'text', text: content.slice(0, VIEW_LIMITS.text), ...(reactions ? { reactions } : {}) });
    } else if (type === 'pause' && content !== '-' && !hiddenPause(content)) messages.push({ sender: '-', type: 'pause', text: content });
    else if (type === 'skip' && messages.length && messages[messages.length - 1].type !== 'skip') messages.push({ sender: '-', type: 'skip', text: '' });
    if (messages.length >= VIEW_LIMITS.messages) break;
  }
  while (messages.length && messages[messages.length - 1].type !== 'text') messages.pop();
  if (!messages.some((m) => m.type === 'text')) throw new PhoneError(guideTxt('Phone', 'ERR.VIEW_EMPTY'), raw);
  const name = str(value.name).slice(0, VIEW_LIMITS.name) || VIEW_PRESETS[preset];
  return { preset, name, pov, people: people.filter((p) => ids.has(p.id)), messages };
}
