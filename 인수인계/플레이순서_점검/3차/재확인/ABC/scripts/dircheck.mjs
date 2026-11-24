// 가짜 서버 기록 파일에서 본편 사이마다 Director 요청 수를 센다
import { readFileSync } from 'node:fs';
const L = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const head = (x) => { const m = x.body?.messages ?? []; const s = m.map((y) => typeof y.content === 'string' ? y.content : JSON.stringify(y.content)).join('\n'); return /# Scene Director/.test(s.slice(0, 400)) ? 'director' : /# Router/.test(s.slice(0, 300)) ? 'router' : /People Record Updater/.test(s) ? 'upd' : x.route === 'main' ? 'main' : 'aux'; };
let since = []; let out = [];
for (const x of L) {
  const k = head(x);
  if (k === 'director') since.push(x.seq);
  if (k === 'main') { if (since.length > 1) out.push({ main: x.seq, directors: since, lastUser: String(x.lastUser ?? '').slice(0, 40) }); since = []; }
}
console.log('records', L.length, 'seq', L[0]?.seq, '-', L.at(-1)?.seq, 'director total', L.filter((x) => head(x) === 'director').length);
console.log(JSON.stringify(out, null, 1));
