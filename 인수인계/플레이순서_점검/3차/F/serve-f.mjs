// F 구간 조종 서버: 틀/risu-t2.mjs openT2 를 감싸 out 을 F/out 으로, 크기·터치를 인자로.
// node serve-f.mjs --port 7111 --w 344 --h 882 [--touch 1] [--dsf 1] [--via plain]
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { openT2 } from '../틀/risu-t2.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const port = Number(opt('--port', 7111));
const w = Number(opt('--w', 344)), h = Number(opt('--h', 882));
const t = await openT2({ via: opt('--via', 'plain'), width: w, height: h, touch: opt('--touch', w < 600 ? '1' : '0') === '1', dsf: Number(opt('--dsf', 1)), out: fileURLToPath(new URL('./out/', import.meta.url)) });
globalThis.T = t;
const ops = {
  setup: () => t.setup(), state: (a) => t.chatState(!!a.full), screen: () => t.screenMessages(), send: (a) => t.send(a.text, { wait: a.wait !== false }),
  reroll: (a) => t.reroll({ wait: a.wait !== false }), prev: () => t.swipePrev(), next: (a) => t.swipeNext({ wait: a.wait !== false }), cont: (a) => t.continueReply({ wait: a.wait !== false }),
  edit: (a) => t.editMessage(a.idx, a.text), del: (a) => t.deleteMessage(a.idx), stop: () => t.stop(), newChat: () => t.newChat(), switchChat: (a) => t.switchChat(a.to),
  reload: (a) => t.reload({ settle: a.settle !== false }), loadState: (a) => t.loadState(a.file, { select: a.select !== false, storage: a.storage !== false }), stream: (a) => t.setStreaming(!!a.on), busy: () => t.isBusy(), idle: (a) => t.waitIdle(a.ms), prog: () => t.progText(),
  open: (a) => t.openWindow(a.sel).then(() => true), closeWin: () => t.closeWindow(), frame: (a) => t.frame(a.sel).then(() => true), fclick: (a) => t.fclick(a.sel, a.i), feval: (a) => t.feval(new Function('return (' + a.js + ')')(), a.arg),
  eval: (a) => t.R(new Function('return (' + a.js + ')')(), a.arg), page: (a) => new Function('t', 'return (async () => {' + a.js + '})()')(t),
  shot: (a) => t.shot(a.name).then(() => a.name), errors: () => t.errors.splice(0), alerts: () => t.alerts(), answer: (a) => t.setAnswer(a.v), fake: (a) => t.fake(a.path, a.body),
};
http.createServer(async (q, s) => {
  let b = ''; for await (const c of q) b += c;
  let a = {}; try { a = JSON.parse(b || '{}'); } catch {}
  try { const v = await ops[a.op]?.(a); s.end(JSON.stringify({ ok: !!ops[a.op], v: v ?? null })); }
  catch (e) { s.end(JSON.stringify({ ok: false, error: String(e?.stack ?? e).slice(0, 1500) })); }
}).listen(port, '127.0.0.1', () => console.log('[serve-f] ready', port, w, h));
