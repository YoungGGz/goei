// 쓰는 법(저장소 맨 위): node --import ./tests/world-preload.mjs 인수인계/플레이순서_점검/3차/재확인/남은칸/r05-fuzz.mjs <결과.json>
// R05: processOutput 이 모델 답 글만으로 던지는 꼴이 있는지 (src 는 읽기만, dist-test/core.mjs 사용)
import { readFileSync, writeFileSync } from 'node:fs';
const G = '/home/user/goei';
const core = await import(G + '/dist-test/core.mjs');
const { parseCatalog, withWorldLore, processOutput, startWorldVars, worldSettings, DEFAULT_SETTINGS } = core;
const m = JSON.parse(readFileSync(G + '/dist-test/real-module.json', 'utf8'));
const lore = withWorldLore ? withWorldLore(m.lorebook ?? m.module?.lorebook) : (m.lorebook ?? m.module?.lorebook);
const c = parseCatalog(lore);
const S = worldSettings ? worldSettings(lore, {}) : DEFAULT_SETTINGS;
const people = c.people.filter((p) => p.rosterFor.includes('A00'));
const anNames = c.anomalies.map((a) => a.name);
const msNames = c.mysticSites.map((a) => a.name);
const lmNames = c.landmarks.map((a) => a.name);
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const weird = ['', ' ', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '<발생지점>', '<배치>', '(종료 13.45 99:99)', '(종료 02.30 23:59)', '(종료 01.01 00:00)', 'P001', 'P39611', 'p-001', '없음', 'none', '-', '$&', '$1', '{{getvar::x}}', '\\', '[', ']]', '|||', '서울 종로구', '부산 기장군', '세광특별시', '중구', '9'.repeat(400), '활성', '소멸', '격리', '클리어', '진행', '종료', '출현', '소실', '사망', '부상', '실종', 'A00', 'B00', 'C00', 'NaN', 'Infinity', '-1', '1e309', '\u0000', '😀', 'Grade SS', 'SSS'];
const regions = ['서울특별시 종로구', '부산광역시 기장군', '세광특별시', '강원특별자치도 춘천시', '서울 중구', '중구', ''];
const val = () => (rnd() < 0.5 ? pick(weird) : rnd() < 0.5 ? pick(regions) : pick([...anNames, ...msNames, ...lmNames, ...people.map((p) => p.name), ...people.map((p) => p.id)]));
const tag = () => {
  const k = pick(['AN', 'IN', 'MS', 'AG', 'AC']);
  if (k === 'AC') return `[AC|${pick(['A00', 'B00', 'C00', 'D00', 'Z99', '__proto__', 'constructor'])}]`;
  const n = 1 + Math.floor(rnd() * 8);
  return `[${k}|${Array.from({ length: n }, val).join('|')}]`;
};
const status = () => pick([
  `[▣|2025.03.${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}|${1 + Math.floor(rnd() * 12)}:${String(Math.floor(rnd() * 60)).padStart(2, '0')} ${pick(['AM', 'PM'])}|☀️|4°C|${pick(regions)}|${pick([...anNames, '없음', ''])}|없음]`,
  `[▣|9999.12.31|11:59 PM|☀️|4°C|x|없음]`, `[▣|0001.01.01|12:00 AM|☀️|4°C|x|없음]`, `[▣|2025.13.40|25:99|x|x|x|x]`, `[▣|2025.02.30|10:20 AM|☀️|12°C|서울|${pick(anNames)}]\n[▣|2024.01.01|1:00 AM|x|x|x|x]`, '',
]);
const errs = new Map();
let runs = 0;
for (const fac of ['A00', 'B00', 'C00']) {
  for (let g = 0; g < 400; g++) {
    let chat = { id: 'c', message: [{ role: 'user', data: 'hi', chatId: 'u0' }], scriptstate: { $st_faction: fac, $st_pick: fac, $ib_affiliation: 'x', ...startWorldVars(c, S, fac, rnd) } };
    for (let i = 0; i < 12; i++) {
      const lines = Array.from({ length: Math.floor(rnd() * 10) }, tag);
      const text = `본문 ${i}\n${lines.join(rnd() < 0.5 ? '\n' : ' ')}\n${status()}${rnd() < 0.1 ? '\n<Thoughts>[AN|x|y|활성|A|없음]</Thoughts>' : ''}`;
      const reroll = rnd() < 0.2 && chat.message.length > 2;
      const msgs = reroll ? chat.message.slice(0, -1) : [...chat.message, { role: 'user', data: `u${i}`, chatId: `u${g}-${i}` }];
      chat = { ...chat, message: [...msgs, { role: 'char', data: text, chatId: `c${g}-${i}-${rnd()}` }] };
      runs++;
      try {
        const next = processOutput(chat, chat.message.length - 1, text, c, S, rnd);
        if (next) chat = next;
      } catch (e) {
        const k = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ');
        if (!errs.has(k)) errs.set(k, { n: 0, text });
        errs.get(k).n++;
      }
    }
  }
}
const out = { runs, catalog: { an: anNames.length, ms: msNames.length, people: people.length }, errors: [...errs].map(([k, v]) => ({ err: k, n: v.n, sample: v.text })) };
writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));
console.log('runs', runs, 'distinct errors', errs.size);
