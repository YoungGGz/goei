// K/가 탐색용 조종 서버 (틀/risu-t2.mjs serve 와 같되 out 을 이 폴더로). node serve.mjs --port 7181 [--w --h]
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { openT2 } from '../../틀/risu-t2.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const port = Number(opt('--port', 7181));
const w = Number(opt('--w', 1280)), h = Number(opt('--h', 800));
const t = await openT2({ via: 'plain', streaming: opt('--stream', 'off') === 'on', width: w, height: h, touch: w < 600 || argv.includes('--touch'), dsf: Number(opt('--dsf', 1)), out: fileURLToPath(new URL('./out', import.meta.url)) });
globalThis.t = t;
const ops = {
  setup: () => t.setup(), state: (a) => t.chatState(!!a.full), screen: () => t.screenMessages(), send: (a) => t.send(a.text, { wait: a.wait !== false }),
  reroll: (a) => t.reroll({ wait: a.wait !== false }), prev: () => t.swipePrev(), del: (a) => t.deleteMessage(a.idx), newChat: () => t.newChat(), switchChat: (a) => t.switchChat(a.to),
  reload: (a) => t.reload({ settle: a.settle !== false }), startPanel: (a) => t.startPanel(a), loadState: (a) => t.loadState(a.file, { select: a.select !== false, storage: a.storage !== false }), idle: (a) => t.waitIdle(a.ms), prog: () => t.progText(),
  open: (a) => t.openWindow(a.sel).then(() => true), closeWin: () => t.closeWindow(), fclick: (a) => t.fclick(a.sel, a.i), feval: (a) => t.feval(new Function('return (' + a.js + ')')(), a.arg),
  eval: (a) => t.R(new Function('return (' + a.js + ')')(), a.arg), shot: (a) => t.shot(a.name).then(() => a.name), errors: () => t.errors.splice(0), alerts: () => t.alerts(), fake: (a) => t.fake(a.path, a.body),
  node: async (a) => (new Function('t', 'return (async () => {' + a.js + '})()'))(t),
};
http.createServer(async (q, s) => {
  let b = ''; for await (const c of q) b += c;
  let a = {}; try { a = JSON.parse(b || '{}'); } catch {}
  try { const v = await ops[a.op]?.(a); s.end(JSON.stringify({ ok: !!ops[a.op], v: v ?? null })); }
  catch (e) { s.end(JSON.stringify({ ok: false, error: String(e?.stack ?? e).slice(0, 1500) })); }
}).listen(port, '127.0.0.1', () => console.log('[serve] ready', port));
