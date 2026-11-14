// 소지품 판정 칸 (장착 갈래·상태·소모 횟수·쓰임 글). 다른 데에 기대지 않는 순수 함수만 — 명부(world/directory)·시작 소지품이 소지품 전체를 끌어오지 않게 (core/items.ts 가 다시 내보냄)
// 쓰임 낱말(손·장비·사용·소모N)은 지침 「상점」의 TRAIT_* 절 (guides 는 지침 글만 가져와 돌고 도는 import 가 없다)
import { guideTxt } from './guides';

/** 장착 갈래 (2026-11-07 사용자: 부위 나누지 않고 둘만). 칸: 손 2 · 장비 6 (2026-11-12 사용자: 장비 칸 둘 더).
 *  'weapon' = 손에 드는 것 전부(무기·도구·불빛·우산…), 'gear' = 몸에 입거나 차는 것. 저장된 채팅이 그대로 읽히게 안쪽 값은 'weapon' 그대로 (사용자 2026-11-14) */
export type ItemEquip = 'weapon' | 'gear';
export const EQUIP_SLOTS: Record<ItemEquip, number> = { weapon: 2, gear: 6 };
/** 칸 이름 = 쓰임 낱말 (지침 「상점」의 TRAIT_HAND · TRAIT_GEAR 절). 화면과 요청(상점 진열 줄의 쓰임 칸)이 같은 절을 읽는다 */
export const EQUIP_LABEL: Record<ItemEquip, string> = { get weapon() { return guideTxt('Shop', 'TRAIT_HAND'); }, get gear() { return guideTxt('Shop', 'TRAIT_GEAR'); } };
export const itemEquip = (v: unknown): ItemEquip | undefined => (v === 'weapon' || v === 'gear' ? v : undefined);

/** 상태 (파괴는 목록에서 빠지고 기록 「파괴」) */
export type ItemState = 'ok' | 'damaged' | 'broken';
export const STATE_LABEL: Record<ItemState, string> = { ok: '멀쩡', damaged: '손상', broken: '고장' };
export const itemState = (v: unknown): ItemState => (v === 'damaged' || v === 'broken' ? v : 'ok');

/** 소모성 횟수 (1~999). 아니면 undefined = 비소모 */
export const itemUses = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.trim()) : Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(999, n) : undefined;
};

/** 무게 kg (2026-11-08 사용자: 칸 수에 더해 무게도). 물건을 만드는 모델이 정한다. 0 이상, 소수 셋째 자리까지. 없으면 undefined */
export const itemWeight = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.trim().replace(/,/g, '.').replace(/\s*(kg|킬로그램|킬로)$/i, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(9999, Math.round(n * 1000) / 1000) : undefined;
};
/** 무게 글: 1kg 밑은 g, 그 위는 10g 단위까지 kg (「250g」「1.24kg」「12.4kg」). 2026-11-13 사용자: 어림수로만 보여 현실감이 없다 */
export const weightText = (kg: number): string => (kg < 1 ? `${Math.max(1, Math.round(kg * 1000))}g` : `${Number(kg.toFixed(2))}kg`);

/** 판정 칸 (상점 줄·보조 모델·시작 소지품·직접 넣기가 같은 꼴로) */
export interface ItemTraits {
  /** 사용 가능 (소모성이면 늘 참) */
  use: boolean;
  /** 소모성: 처음 횟수 */
  uses?: number;
  equip?: ItemEquip;
  /** 그림 찾기용 낱말 (영어, 물건 만드는 모델이 적음) */
  icon?: string;
  /** 무게 kg */
  weight?: number;
}

/** 소모 낱말의 머리 (TRAIT_USES 절에서 {n} 앞): parseTraits 가 고친 낱말도 읽게 */
const usesHead = (): string => { const t = guideTxt('Shop', 'TRAIT_USES'); const i = t.indexOf('{n}'); return (i >= 0 ? t.slice(0, i) : t).trim().replace(/[:：]+$/, '').toLowerCase(); }; // 끝 「:」은 읽는 틀이 이미 받는다
const reEsc = (x: string): string => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** TRAIT_USES 절의 {n} 뒤에 글이 있으면(「{n}회 소모」처럼) 그 꼴 전체를 읽는 틀: parseTraits 가 「소모N」으로 바꿔 읽는다. 뒤에 글이 없으면(기본 「소모{n}」) 머리만으로 읽으니 null */
const usesTpl = (): RegExp | null => {
  const t = guideTxt('Shop', 'TRAIT_USES');
  const i = t.indexOf('{n}');
  const tail = i >= 0 ? t.slice(i + 3).trim() : '';
  if (!tail) return null;
  const head = t.slice(0, i).trim();
  return new RegExp(`${head ? `${reEsc(head)}\\s*` : ''}(\\d+)\\s*${reEsc(tail)}`, 'gi');
};

/** 「쓰임」 칸 글 → 판정: 손·장비·사용·소모N (옛 글의 「무기」도 손으로 읽는다, 사용자 2026-11-14) (「·」「,」「/」 띄어쓰기 어느 것으로 이어도). 모르는 말은 무시 */
export function parseTraits(text: unknown): Omit<ItemTraits, 'icon' | 'weight'> {
  const out: Omit<ItemTraits, 'icon' | 'weight'> = { use: false };
  // 지침에서 고친 쓰임 낱말도 읽는다 (TRAIT_* 절. 기본 낱말은 아래 목록에 이미 있다)
  const w = { hand: EQUIP_LABEL.weapon.toLowerCase(), gear: EQUIP_LABEL.gear.toLowerCase(), use: guideTxt('Shop', 'TRAIT_USE').toLowerCase() };
  const head = usesHead();
  const usesAlt = `소모|consumable|uses?${head && head !== '소모' ? `|${reEsc(head)}` : ''}`;
  // 「소모 3」「소모3회」「소모(3)」「소모 x3」은 쪼개기 전에 「소모3」으로 붙인다: 띄우면 1회로, 글자가 붙으면 소모가 빠졌다 (전수검사 11-13)
  const tpl = usesTpl();
  const raw = tpl ? String(text ?? '').replace(tpl, '소모$1 ') : String(text ?? '');
  const src = raw.replace(new RegExp(`(${usesAlt})\\s*[:：]?\\s*[(（x×]?\\s*(\\d+)\\s*[)）]?\\s*(?:회|번|개)?`, 'gi'), '$1$2 '); // 끝에 띄어쓰기: 숫자 뒤 띄어쓰기까지 먹어 「소모3 장비」가 한 덩어리로 붙어 버려졌다 (재검토 11-14)
  for (const t0 of src.split(/[\s,，/·+]+/)) {
    const t = t0.trim().toLowerCase();
    if (!t) continue;
    if (/^(손|hand|held|무기|weapon)$/.test(t) || t === w.hand) out.equip = 'weapon';
    else if (/^(장비|gear|wear)$/.test(t) || t === w.gear) out.equip = out.equip ?? 'gear';
    else if (/^(사용|use|usable)$/.test(t) || t === w.use) out.use = true;
    else {
      const m = new RegExp(`^(?:${usesAlt})[:：]?(\\d+)?$`).exec(t);
      if (m) {
        out.use = true;
        out.uses = itemUses(m[1] ?? 1);
      }
    }
  }
  return out;
}

/** 판정 → 「쓰임」 칸 글 (parseTraits 와 거꾸로). 낱말은 지침 「상점」의 TRAIT_* 절 */
export const traitsText = (t: Partial<ItemTraits>): string =>
  [t.equip ? EQUIP_LABEL[t.equip] : '', t.uses ? guideTxt('Shop', 'TRAIT_USES', { n: t.uses }) : t.use ? guideTxt('Shop', 'TRAIT_USE') : ''].filter(Boolean).join('·') || '-';

/** 그림 칸 「종류/물건말/english」: 한글과 「/」를 지우지 않는다 (2026-11-10: 영어·숫자만 남겨 「옷/코트」가 통째로 사라져 그림이 전부 상자로 나왔다) */
export const cleanIcon = (v: unknown): string | undefined => String(v ?? '').toLowerCase().replace(/[／|｜]/g, '/').replace(/[^a-z0-9가-힣 /\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || undefined;
