// K/다 조종 서버: 브라우저 하나를 띄워 두고 steps/*.mjs 를 차례로 부른다 (run.mjs 가 같은 단계를 새 브라우저로 처음부터 돌린다).
// 사용: FAKE_URL=http://<IP>:8803 node server.mjs [--port 7133]
//   POST /step  {"file":"steps/01-xxx.mjs"}   그 파일의 default(ctx) 를 부르고 결과 JSON
//   POST /open  {"w":1280,"h":800,"touch":false,"dsf":1}   브라우저를 새로 띄워 setup → loadState(S-관리국-3턴)
//   POST /eval  {"code":"return await t.chatState()"}   ctx 변수(t, page, ctx...)로 바로 돌림
import http from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { makeCtx } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const PORT = Number(argv[argv.indexOf('--port') + 1] || 7133);
let C = null;

const run = async (fn) => { try { return { ok: true, r: await fn() }; } catch (e) { return { ok: false, err: String(e?.stack ?? e) }; } };
http.createServer(async (q, s) => {
  let b = ''; for await (const c of q) b += c;
  const a = b ? JSON.parse(b) : {};
  let out;
  if (q.url === '/open') out = await run(async () => { if (C) await C.close().catch(() => {}); C = await makeCtx(a); return C.info; });
  else if (q.url === '/close') out = await run(async () => { if (C) await C.close(); C = null; return 'closed'; });
  else if (q.url === '/step') out = await run(async () => { const m = await import(pathToFileURL(resolve(HERE, a.file)).href + '?v=' + Date.now()); return m.default(C, a.arg); });
  else if (q.url === '/eval') out = await run(async () => { const f = new Function('C', 't', 'page', `return (async()=>{${a.code}})()`); return f(C, C?.t, C?.t?.page); });
  else out = { ok: false, err: 'unknown' };
  s.writeHead(200, { 'content-type': 'application/json' });
  s.end(JSON.stringify(out, null, 1));
}).listen(PORT, '127.0.0.1', () => console.log('K다 server', PORT));
