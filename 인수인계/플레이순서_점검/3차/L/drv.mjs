// L 구간 점검용 조종 (세션 하나를 띄워 두고 run.mjs 의 단계 함수를 차례로 부른다).
// node drv.mjs [--port 7114] [--w 1280 --h 800]   → POST http://127.0.0.1:7114  body = {"js":"async (t, L) => ..."} 또는 {"step":"이름"}
import http from 'node:http';
import { openT2 } from '../틀/risu-t2.mjs';
import * as L from './run.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const port = Number(opt('--port', 7114));
const w = Number(opt('--w', 1280)), h = Number(opt('--h', 800));
const t = await openT2({ via: opt('--via', 'plain'), width: w, height: h, dsf: Number(opt('--dsf', 1)), touch: w < 600 || h < 500, out: L.OUT });
let mod = L;
http.createServer(async (q, s) => {
  let b = ''; for await (const c of q) b += c;
  let a = {}; try { a = JSON.parse(b || '{}'); } catch {}
  try {
    if (a.reload) mod = await import('./run.mjs?v=' + Date.now());
    let v;
    if (a.js) v = await (new Function('return (' + a.js + ')')())(t, mod);
    else if (a.step) v = await mod.STEPS[a.step](t, a.arg ?? {});
    s.end(JSON.stringify({ ok: true, v: v ?? null }, null, 1));
  } catch (e) { s.end(JSON.stringify({ ok: false, error: String(e?.stack ?? e).slice(0, 2000) })); }
}).listen(port, '127.0.0.1', () => console.log('[L drv] ready', port));
