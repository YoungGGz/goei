// 에셋용 사본: 카드 로어북을 직접 읽는 다른 플러그인(에셋 메이드 등)이 요원 설정을 볼 수 있게,
// 플러그인이 만든 요원 로어북의 사본을 카드 로어북의 전용 폴더에 넣는다 (사용자 2026-11-15).
// 이 플러그인은 그 폴더를 읽지 않는다: 읽을 때 빼고(withWorldLore), 저장할 때 그대로 다시 붙인다.
// Risu 도 넣지 않는다: 본문 첫 줄이 @@dont_activate 다.
import type { LoreEntry } from '../types';

export const ASSET_COPY_NAME = '🖼️에셋용 사본';
export const ASSET_COPY_KEY = 'folder:goei-asset-0000-0000-0000-copy00000001';

const isCopy = (e: LoreEntry) => (e.mode === 'folder' ? e.key === ASSET_COPY_KEY : e.folder === ASSET_COPY_KEY);

/** 카드 로어북을 플러그인이 읽는 것(rest)과 에셋용 사본(copy: 폴더 + 항목)으로 가른다 */
export function splitAssetCopy(lore: LoreEntry[] | undefined): { rest: LoreEntry[]; copy: LoreEntry[] } {
  const all = lore ?? [];
  if (!all.some(isCopy)) return { rest: all, copy: [] };
  return { rest: all.filter((e) => !isCopy(e)), copy: all.filter(isCopy) };
}

/** 사본에 든 요원 수 (폴더 빼고) */
export const assetCopyCount = (copy: LoreEntry[] | undefined): number => (copy ?? []).filter((e) => e.mode !== 'folder').length;

/** 세계 로어북(withWorldLore 결과)의 요원 항목으로 사본을 만든다. 요원이 없으면 빈 목록 */
export function makeAssetCopy(worldLore: LoreEntry[]): LoreEntry[] {
  const agents = worldLore.filter((e) => e.mode !== 'folder' && (e as { goeiKind?: string }).goeiKind === 'agent');
  if (!agents.length) return [];
  const folder: LoreEntry = { key: ASSET_COPY_KEY, comment: ASSET_COPY_NAME, content: '', mode: 'folder', insertorder: 100, alwaysActive: false, secondkey: '', selective: false, bookVersion: 2 };
  return [
    folder,
    ...agents.map((e): LoreEntry => {
      const body = String(e.content ?? '');
      return {
        key: String(e.key ?? ''), secondkey: '', comment: String(e.comment ?? ''), content: body.startsWith('@@dont_activate') ? body : `@@dont_activate\n${body}`,
        mode: 'normal', insertorder: Number(e.insertorder) || 100, alwaysActive: false, selective: false, useRegex: false, bookVersion: 2, folder: ASSET_COPY_KEY,
      };
    }),
  ];
}

/** 사본이 지금 플러그인 자료와 같은가 (이름·열쇠·본문) */
export function sameAssetCopy(a: LoreEntry[], b: LoreEntry[]): boolean {
  const sig = (l: LoreEntry[]) => l.filter((e) => e.mode !== 'folder').map((e) => `${e.comment}\u0000${e.key}\u0000${e.content}`).join('\u0001');
  return sig(a) === sig(b);
}
