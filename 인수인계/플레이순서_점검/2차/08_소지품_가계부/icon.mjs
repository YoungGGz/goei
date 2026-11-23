// 08 소지품 · 그림 고르기 갈래 (브라우저 없이): 실제 그림 팩(scripts/data-pack.mjs itemsPackText) + 배포 코드(dist-test/core.mjs matchItemIcon)로
// 플레이에서 실제로 들어오는 물건(명부 시작 소지품 전부 · 갱신기 지침 예시 그림 말 · 점검 run.mjs 의 물건)의 그림이 무엇으로 고르는지 적는다.
// 기대값: 이름이 그림 이름과 같으면 그 그림 (사용자 11-22 「요원증이 보관증으로」 뒤 새 차례: 이름 그대로가 먼저), 못 찾으면 공통 그림(판지 상자).
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyItemsPack, matchItemIcon, itemPictureNames } from '../../../../dist-test/core.mjs';
import { itemsPackText } from '../../../../scripts/data-pack.mjs';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const pack = applyItemsPack(itemsPackText());
const table = JSON.parse(readFileSync(new URL('../../../../그림/물건/icons.json', import.meta.url), 'utf8'));
const nameOf = (f) => table.icons.filter((r) => r.file === f).map((r) => r.name);
const base = pack.base.misc;
const start = JSON.parse(readFileSync(new URL('../../../../카드/start-items.json', import.meta.url), 'utf8'));
const rows = [];
for (const [who, list] of Object.entries(start)) for (const e of list) rows.push({ who, name: e.name, icon: e.icon ?? '' });
const extra = [['진통제', '의료/진통제/painkiller'], ['손전등', '기기/손전등/flashlight'], ['방검 조끼', '옷/조끼/vest'], ['방독면', '도구/방독면/gas mask'], ['부적 묶음', '부적/부적/talisman'], ['사건 파일', '서류/파일/file'], ['봉인 상자', '봉인/상자/box'], ['검은 우산', '도구/우산/umbrella'], ['야구방망이', '무기/야구방망이/baseball bat'], ['붕대 묶음', '의료/붕대/bandage'], ['요원증', ''], ['관리국 요원증', '서류/요원증/agent id card'], ['돌멩이 1', ''], ['빈 꿈결 수집기', '괴이/꿈결 수집기/dream collector'], ['꿈결 수집기', '괴이/꿈결 수집기/dream collector'], ['꿈결 수집기', '꿈결 수집기 B등급']];
for (const [name, icon] of extra) rows.push({ who: '(점검)', name, icon });
const seen = new Set();
const lines = [];
let toBase = 0, sameName = 0, sameNameMiss = 0;
for (const r of rows) {
  const k = `${r.name}|${r.icon}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const f = matchItemIcon(pack, r.name, r.icon, r.name);
  const names = nameOf(f);
  const isBase = f === base;
  if (isBase) toBase++;
  const exact = table.icons.some((x) => x.name === r.name);
  if (exact) { sameName++; if (!names.includes(r.name)) sameNameMiss++; }
  const pics = itemPictureNames(pack, r.name, r.icon);
  lines.push(`${isBase ? '■공통 ' : exact && !names.includes(r.name) ? '▲이름같은그림아님 ' : ''}${r.who} · ${r.name}${r.icon ? ` [${r.icon}]` : ''} → ${f} (${names.slice(0, 3).join('/')})${pics ? ` · 상태 그림 ${pics.length}장` : ''}`);
}
const head = `그림 고르기 점검 · 물건 ${seen.size}개 · 공통 그림(판지 상자 ${base})으로 간 것 ${toBase} · 이름이 그림 이름과 같은 것 ${sameName} 가운데 다른 그림 ${sameNameMiss}\n`;
writeFileSync(`${OUT}단계301_그림고르기.txt`, head + lines.join('\n') + '\n');
console.log(head + lines.filter((l) => l.startsWith('■') || l.startsWith('▲')).join('\n'));
