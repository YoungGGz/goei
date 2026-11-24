// 3차 점검 T2 가짜 모델 서버 (OpenAI 호환 /v1/chat/completions, 스트리밍 SSE·비스트리밍).
// 사용: node fake-llm.mjs [--port 8790] [--host 0.0.0.0] [--log <jsonl>] [--rules <json>]
//   본편 주소: http://<컨테이너IP>:<port>/main/v1/chat/completions  (리스AI reverse_proxy forceReplaceUrl)
//   보조 주소: http://<컨테이너IP>:<port>/aux/v1/chat/completions   (리스AI customModels xcustom::: url)
//   그 밖 경로로 온 것은 route='other'.
// 조종 끝점 (모두 JSON):
//   GET  /_ctl/health                      살아 있나·포트·기록 수
//   GET  /_ctl/log?since=<seq>&route=main   기록 읽기 (since 보다 큰 seq 만)
//   POST /_ctl/reset                        기록·내용별 횟수·붙잡은 요청 비움 (규칙은 그대로)
//   GET  /_ctl/rules                        지금 규칙
//   POST /_ctl/rules      {rules:[...]}     규칙 통째 바꾸기
//   POST /_ctl/rules/add  {rule:{...}} 또는 {rules:[...]}  맨 앞에 끼우기 (먼저 맞는 규칙이 이김)
//   POST /_ctl/rules/del  {id:"..."}        그 id 규칙 빼기
//   GET  /_ctl/pending                      아직 답 안 한 요청(늦게 답하기·hold 중)
//   POST /_ctl/release    {seq?:n}          hold 로 붙잡은 요청 풀기 (seq 없으면 전부)
// 규칙 꼴 (위에서부터 먼저 맞는 것):
//   { id, route:'main'|'aux'|'other'|'any'(기본 any),
//     match:'정규식'      — 요청 메시지 전체 글(role: content 줄들)에 대고 검사 (플래그 s),
//     matchLast:'정규식'  — 마지막 user 메시지 글에만,
//     matchSystem:'정규식'— system 메시지 글에만,
//     stream:true|false   — 스트리밍 요청에만/비스트리밍에만,
//     reply:'답 글'  (또는 replyFile:'경로'),  reasoning:'reasoning_content 로 줄 생각 글',
//     delayMs:n  — 첫 바이트 전 기다림,  hold:true — /_ctl/release 까지 붙잡기,
//     status:429|500|502|503 …  — 오류 답 (errorBody 로 본문 지정),
//     failFirst:n — 같은 내용(본문 해시)의 처음 n 번만 status 로 실패, 그다음은 정상 답 (자동 재시도 시험),
//     empty:true — 빈 답(content ''),  malformed:true — JSON 이 아닌 본문,
//     chunkChars:n (스트리밍 조각 크기, 기본 40), chunkDelayMs:n (조각 사이, 기본 15),
//     stallAfterChars:n — 스트리밍에서 n 글자 보낸 뒤 멈춤(연결은 열어 둠, release 로 끊음),
//     cutAfterChars:n — 스트리밍에서 n 글자 보낸 뒤 연결 끊기 }
//   답 글 안의 {{seq}}·{{route}}·{{hash}} 는 바꿔 넣는다.
// 기록(JSONL) 한 줄: {seq,t,route,path,method,stream,model,hash,dupOf,ruleId,action,headers,body,lastUser,response:{status,content,reasoning,ms}}
//   같은 내용이 두 번 오면 dupOf 에 앞 seq. 답은 규칙과 내용으로만 정해져 두 번 와도 같다(failFirst 만 횟수를 본다).
import http from 'node:http';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(opt('--port', process.env.FAKE_LLM_PORT || 8790));
const HOST = opt('--host', '0.0.0.0');
const LOG = opt('--log', HERE + '/out/fake-llm.jsonl');
const RULES_FILE = opt('--rules', '');
mkdirSync(dirname(LOG), { recursive: true });

const DEFAULT_RULES = [
  { id: 'default-aux', route: 'aux', reply: '(가짜 보조 답 #{{seq}})' },
  { id: 'default-main', route: 'main', reply: '가짜 본편 답 #{{seq}}.' },
  { id: 'default-other', route: 'any', reply: '(가짜 답 #{{seq}})' },
];
let rules = RULES_FILE ? JSON.parse(readFileSync(RULES_FILE, 'utf8')) : DEFAULT_RULES.slice();
let seq = 0;
const records = [];          // 메모리 사본 (log 끝점용)
const hashSeen = new Map();  // hash -> {first, count}
const pending = new Map();   // seq -> {rec, release()}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-expose-headers': '*',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readBody = (q) => new Promise((res, rej) => { const a = []; q.on('data', (c) => a.push(c)); q.on('end', () => res(Buffer.concat(a).toString('utf8'))); q.on('error', rej); });
const json = (s, code, v) => { s.writeHead(code, { ...cors, 'content-type': 'application/json; charset=utf-8' }); s.end(JSON.stringify(v)); };

const textOf = (c) => typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p?.text ?? (p?.type ? `[${p.type}]` : '')).join('') : c == null ? '' : JSON.stringify(c);
function flatten(body) {
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const all = msgs.map((m) => `${m.role}: ${textOf(m.content)}`).join('\n');
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
  const system = msgs.filter((m) => m.role === 'system').map((m) => textOf(m.content)).join('\n');
  return { all, lastUser: lastUser ? textOf(lastUser.content) : '', system };
}
function pickRule(route, body, f) {
  for (const r of rules) {
    const rr = r.route || 'any';
    if (rr !== 'any' && rr !== route) continue;
    if (r.stream === true && !body.stream) continue;
    if (r.stream === false && body.stream) continue;
    try {
      if (r.match && !new RegExp(r.match, 's').test(f.all)) continue;
      if (r.matchLast && !new RegExp(r.matchLast, 's').test(f.lastUser)) continue;
      if (r.matchSystem && !new RegExp(r.matchSystem, 's').test(f.system)) continue;
    } catch { continue; }
    return r;
  }
  return null;
}
function persist(rec) { appendFileSync(LOG, JSON.stringify(rec) + '\n'); }

async function handleCompletion(q, s, route, raw) {
  const t0 = Date.now();
  let body = {};
  try { body = JSON.parse(raw || '{}'); } catch { body = { _unparsed: raw }; }
  const f = flatten(body);
  const hash = createHash('sha256').update(JSON.stringify({ route, messages: body.messages ?? null })).digest('hex').slice(0, 16);
  const seen = hashSeen.get(hash);
  const my = ++seq;
  const count = (seen?.count ?? 0) + 1;
  hashSeen.set(hash, { first: seen?.first ?? my, count });
  const rule = pickRule(route, body, f) || { id: 'none', reply: '' };
  const stream = !!body.stream;
  const rec = {
    seq: my, t: new Date(t0).toISOString(), route, path: q.url, method: q.method, stream, model: body.model ?? null,
    hash, dupOf: seen ? seen.first : null, nth: count, ruleId: rule.id ?? null, action: null,
    headers: q.headers, body, lastUser: f.lastUser.slice(0, 2000), response: null,
  };
  records.push(rec);
  const sub = (t) => String(t ?? '').replaceAll('{{seq}}', String(my)).replaceAll('{{route}}', route).replaceAll('{{hash}}', hash);
  let content = rule.replyFile ? readFileSync(rule.replyFile, 'utf8') : (rule.reply ?? '');
  content = sub(content);
  const reasoning = rule.reasoning != null ? sub(rule.reasoning) : null;
  let closed = false;
  s.on('close', () => { closed = true; });
  const finish = (status, extra = {}) => { rec.response = { status, content: rec.action === 'ok' || rec.action === 'stream' ? content : (extra.content ?? null), reasoning, ms: Date.now() - t0, closedByClient: closed, ...extra }; pending.delete(my); persist(rec); };

  // 붙잡기·늦게
  pending.set(my, { rec: { seq: my, route, ruleId: rule.id, t: rec.t }, release: null });
  if (rule.hold) { rec.action = 'hold'; await new Promise((r) => { pending.get(my).release = r; s.on('close', r); }); }
  if (rule.delayMs) { const end = Date.now() + rule.delayMs; while (Date.now() < end && !closed) await sleep(Math.min(200, end - Date.now())); }
  if (closed) { rec.action = 'client-closed-before-reply'; return finish(0); }

  const failNow = rule.status && (rule.failFirst == null || count <= rule.failFirst);
  if (failNow) {
    rec.action = 'error';
    const eb = rule.errorBody ?? { error: { message: `fake ${rule.status}`, type: 'fake_error', code: rule.status } };
    s.writeHead(rule.status, { ...cors, 'content-type': 'application/json' });
    s.end(typeof eb === 'string' ? eb : JSON.stringify(eb));
    return finish(rule.status, { content: typeof eb === 'string' ? eb : JSON.stringify(eb) });
  }
  if (rule.malformed) {
    rec.action = 'malformed';
    s.writeHead(200, { ...cors, 'content-type': stream ? 'text/event-stream' : 'application/json' });
    s.end(stream ? 'data: {not json\n\n' : '<html>not json</html>');
    return finish(200, { content: 'malformed' });
  }
  if (rule.empty) content = '';
  const id = 'chatcmpl-fake-' + my;
  const created = Math.floor(Date.now() / 1000);
  const model = body.model || 'fake';
  if (!stream) {
    rec.action = 'ok';
    const message = { role: 'assistant', content };
    if (reasoning != null) message.reasoning_content = reasoning;
    s.writeHead(200, { ...cors, 'content-type': 'application/json' });
    s.end(JSON.stringify({ id, object: 'chat.completion', created, model, choices: [{ index: 0, message, finish_reason: 'stop' }], usage: { prompt_tokens: Math.ceil(raw.length / 4), completion_tokens: Math.ceil(content.length / 4), total_tokens: 0 } }));
    return finish(200);
  }
  rec.action = 'stream';
  s.writeHead(200, { ...cors, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
  const send = (delta, fin = null) => s.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta, finish_reason: fin }] })}\n\n`);
  const size = rule.chunkChars || 40, gap = rule.chunkDelayMs ?? 15;
  send({ role: 'assistant', content: '' });
  if (reasoning) for (let i = 0; i < reasoning.length && !closed; i += size) { send({ reasoning_content: reasoning.slice(i, i + size) }); await sleep(gap); }
  let sent = 0;
  for (let i = 0; i < content.length && !closed; i += size) {
    const part = content.slice(i, i + size);
    if (rule.stallAfterChars != null && sent >= rule.stallAfterChars) {
      rec.action = 'stream-stalled';
      await new Promise((r) => { pending.get(my).release = r; s.on('close', r); });
      if (!closed) s.destroy();
      return finish(200, { sentChars: sent });
    }
    if (rule.cutAfterChars != null && sent >= rule.cutAfterChars) { rec.action = 'stream-cut'; s.destroy(); return finish(200, { sentChars: sent }); }
    send({ content: part }); sent += part.length; await sleep(gap);
  }
  if (closed) { rec.action = 'client-closed-mid-stream'; return finish(200, { sentChars: sent }); }
  send({}, 'stop');
  s.write('data: [DONE]\n\n');
  s.end();
  return finish(200);
}

const server = http.createServer(async (q, s) => {
  try {
    const u = new URL(q.url, 'http://x');
    if (q.method === 'OPTIONS') { s.writeHead(204, cors); return s.end(); }
    if (u.pathname.startsWith('/_ctl/')) {
      const p = u.pathname.slice(6);
      const raw = q.method === 'POST' ? await readBody(q) : '';
      const b = raw ? JSON.parse(raw) : {};
      if (p === 'health') return json(s, 200, { ok: true, port: PORT, log: LOG, records: records.length, rules: rules.length, pending: pending.size });
      if (p === 'log') { const since = Number(u.searchParams.get('since') || 0); const r = u.searchParams.get('route'); const full = u.searchParams.get('full') !== '0'; return json(s, 200, records.filter((x) => x.seq > since && (!r || x.route === r)).map((x) => full ? x : { ...x, body: undefined, headers: undefined })); }
      if (p === 'reset') { records.length = 0; hashSeen.clear(); for (const v of pending.values()) v.release?.(); pending.clear(); writeFileSync(LOG, ''); return json(s, 200, { ok: true, seq }); }
      if (p === 'rules' && q.method === 'GET') return json(s, 200, rules);
      if (p === 'rules') { rules = b.rules; return json(s, 200, { ok: true, n: rules.length }); }
      if (p === 'rules/add') { const add = b.rules ?? [b.rule]; rules = [...add, ...rules.filter((r) => !add.some((a) => a.id && a.id === r.id))]; return json(s, 200, { ok: true, n: rules.length }); }
      if (p === 'rules/del') { rules = rules.filter((r) => r.id !== b.id); return json(s, 200, { ok: true, n: rules.length }); }
      if (p === 'pending') return json(s, 200, [...pending.values()].map((v) => ({ ...v.rec, held: !!v.release })));
      if (p === 'release') { let n = 0; for (const [k, v] of pending) if (b.seq == null || b.seq === k) { if (v.release) { v.release(); n++; } } return json(s, 200, { ok: true, released: n }); }
      return json(s, 404, { error: 'no such ctl' });
    }
    if (q.method === 'POST' && /chat\/completions\/?$/.test(u.pathname)) {
      const route = u.pathname.startsWith('/main/') ? 'main' : u.pathname.startsWith('/aux/') ? 'aux' : 'other';
      return await handleCompletion(q, s, route, await readBody(q));
    }
    if (q.method === 'GET' && /\/models\/?$/.test(u.pathname)) return json(s, 200, { object: 'list', data: [{ id: 'fake', object: 'model' }] });
    json(s, 404, { error: 'not found', path: u.pathname });
  } catch (e) { try { json(s, 500, { error: String(e?.stack ?? e) }); } catch {} }
});
server.listen(PORT, HOST, () => console.log(`[fake-llm] http://${HOST}:${PORT} log=${LOG}`));
