// 3차 D·J·M 공용: T2 열기·상태 넣기·대본 본편 한 턴 (make-states.mjs 의 답 짓기 규칙을 그대로 옮김)
// src 는 안 건드림. 결과는 각 구간 out/ (gitignore).
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HERE3 = fileURLToPath(new URL('..', import.meta.url));
export const STATES = HERE3 + '틀/states/';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const redact = (s) => String(s).replace(/(Age:)(?! \[생략\])[^\\"\n]*/g, '$1 [생략]').replace(/(\|age=)[^"\n]*/g, '$1[생략]').replace(/\((late|early|mid) \d+s[^)]*\)/g, '([생략])');
export const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text ?? '').join('') : JSON.stringify(c));
export const reqText = (body) => redact((body.messages ?? []).map((m, i) => `===== [${i}] ${m.role} (${text(m.content).length}자)\n${text(m.content)}`).join('\n\n'));

export function readRequest(body) {
  const msgs = body.messages ?? [];
  const all = msgs.map((m) => text(m.content));
  const lore = all.find((c) => c.includes('## Status')) ?? '';
  const fields = (lore.match(/Fields in order: (.+?)\. Never/) ?? [])[1]?.split('|').map((s) => s.trim()) ?? [];
  const prevBlock = [...all].reverse().find((c) => c.startsWith('[Previous status]')) ?? '';
  const prevLine = (prevBlock.match(/\[▣\|[^\n]*\]/) ?? [])[0] ?? '';
  const start = {};
  for (const m of prevBlock.matchAll(/(Balance|Points) = (\d+)/g)) start[m[1]] = m[2];
  const we0 = lore.indexOf('### World Entries'), we1 = lore.indexOf('#### Mandatory');
  const weText = we0 >= 0 ? lore.slice(we0, we1 > we0 ? we1 : undefined) : '';
  const entries = [...weText.matchAll(/^(NEW )?(\[(AN|IN|MS|AG)\|[^\]\n]*\])/gm)].map((m) => ({ isNew: !!m[1], tag: m[2], kind: m[3] }));
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
  return { all, lore, weText, fields, prevLine, start, entries, nMsgs: msgs.length, lastUser: lastUser ? text(lastUser.content) : '' };
}
const FILL = {
  AN: { '<등급>': 'D', '<배치>': '없음', '<상황>': '이상 징후 신고가 들어왔지만 아직 대응 인원은 없다' },
  IN: { '<배치>': '없음', '<상황>': '대형 추돌 사고로 도로가 통제되고 구급차가 몰려들고 있다' },
  MS: { '<방문자>': '없음', '<상황>': '문을 열어 둔 채 조용히 손님을 기다리고 있다' },
  AG: { '<상태>': '내근', '<상황>': '본부 사무실에서 평소 업무를 보고 있다' },
};
const PICK = { AN: ['명일 아파트', '소라 랜드', '금지된 비디오', '미술관', '강변', '인스피레이션 호텔'], IN: ['중림 지하상가', '기독교 상점', '관리국 본부'] };
export function worldTags(entries, loreText = '') {
  const used = new Set();
  return entries.map((e) => {
    let t = e.tag;
    if (t.includes('<발생지점>') && PICK[e.kind]) {
      const name = PICK[e.kind].find((n) => !loreText.includes(n) && !used.has(n)) ?? PICK[e.kind][0];
      used.add(name); t = t.replace('<발생지점>', name);
    }
    for (const [k, v] of Object.entries(FILL[e.kind] ?? {})) t = t.replaceAll(k, v);
    t = t.replace(/<발생 지역[^>|\]]*>/g, '서울특별시 강서구');
    return t.replace(/<[^>|\]]*>/g, '없음');
  });
}
const pad = (n) => String(n).padStart(2, '0');
function advance(date, time, mins) {
  const m = String(time).match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return { date, time };
  let h = Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  let t = (h * 60 + Number(m[2]) + mins) % (24 * 60);
  h = Math.floor(t / 60);
  return { date, time: `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(t % 60)} ${h >= 12 ? 'PM' : 'AM'}` };
}
export function statusLine(req, s = {}) {
  const prev = req.prevLine ? req.prevLine.slice(1, -1).split('|').slice(1) : null;
  const pv = (label) => (prev ? prev[req.fields.indexOf(label)] : undefined);
  const dt = prev ? advance(pv('날짜') ?? s.date, pv('시각') ?? s.time, 20) : { date: s.date, time: s.time };
  const val = { 날짜: dt.date, 시각: dt.time, 날씨: s.weather, 기온: s.temp, 위치: s.place, 목표: s.target, 동행: s.companions, 투입: s.deployed, 신분: s.identity, 잔고: s.balance, 포인트: s.points };
  return `[▣|${req.fields.map((f) => val[f] ?? pv(f) ?? '없음').join('|')}]`;
}
/** 답: 본문 + (World Entries 줄 채움 | 직접 준 태그) + 상태창. opts.tags 를 주면 그 태그 줄을 쓰고, keepWorld=false 면 World 줄을 빼고 tags 만 */
export function buildReply(req, turn) {
  const parts = [turn.prose.trim(), ''];
  if (turn.world !== false) { let w = worldTags(req.entries, req.lore); if (turn.mutate) w = turn.mutate(w); parts.push(...w); }
  if (turn.tags) parts.push(...turn.tags);
  parts.push(statusLine(req, turn.status ?? {}));
  return parts.join('\n');
}

export async function open(o = {}) {
  const out = o.out;
  mkdirSync(out, { recursive: true });
  const t = await openT2({ via: 'plain', streaming: false, width: 1280, height: 800, out, ...o });
  const REPLY = out + '/reply-now.txt';
  writeFileSync(REPLY, '(아직)');
  await t.fake('reset', {});
  await t.fake('rules', { rules: [
    { id: 'm-hold', route: 'main', hold: true, replyFile: REPLY },
    { id: 'a-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
    { id: 'a-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
    { id: 'a-any', route: 'aux', reply: '{}' },
  ] });
  t.REPLY = REPLY;
  return t;
}

export async function quietAux(t, ms = 3000, max = 60000) {
  const end = Date.now() + max;
  let last = await t.fakeSeq(), since = Date.now();
  while (Date.now() < end) {
    await sleep(600);
    const pend = await t.fake('pending');
    const s = await t.fakeSeq();
    if (s !== last) { last = s; since = Date.now(); continue; }
    if (!pend.length && Date.now() - since >= ms) return true;
  }
  return false;
}
/** 붙잡힌 본편 요청 하나를 기다림 (since seq 뒤) */
export async function waitMain(t, seq0, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const log = await t.fakeLog(seq0, 'main');
    const rec = log.find((x) => x.action === 'hold' && !x.response);
    if (rec) return rec;
    await sleep(400);
  }
  return null;
}
/** 한 턴: sendFn(없으면 입력칸 보내기) → 본편 요청 잡기 → turnDef(req) 로 답 짓기 → 풀기 → 끝날 때까지 */
export async function turn(t, turnDef, sendFn, userText) {
  writeFileSync(t.REPLY, '(아직)');
  const seq0 = await t.fakeSeq();
  if (sendFn) await sendFn(); else { await t.closeWindow().catch(() => {}); await t.send(userText, { wait: false }); }
  const rec = await waitMain(t, seq0);
  if (!rec) return { ok: false, error: '본편 요청 안 옴', seq0 };
  const req = readRequest(rec.body);
  const def = typeof turnDef === 'function' ? turnDef(req) : turnDef;
  const reply = buildReply(req, def);
  writeFileSync(t.REPLY, reply);
  await t.fake('release', { seq: rec.seq });
  await t.waitBusy(5000).catch(() => {});
  await t.waitIdle();
  await quietAux(t);
  const aux = await t.fakeLog(seq0, 'aux');
  return { ok: true, rec, req, reply, seq0, aux };
}
// 지금 상황판: 플러그인의 readWorld 와 같은 길 (2026-11-28 응답별 결과 $goei_turns — 채팅에 살아 있는 마지막 응답의 결과, 없으면 바탕, 그것도 없으면 $goei_world).
// 저장값 $goei_world 는 「마지막으로 쓴 상황판」이라 응답을 지운 직후에는 지금 상황판과 다르다. raw=true 면 그 저장값 그대로.
export const world = async (t, raw = false) => {
  const st = await t.chatState(true);
  try {
    const turns = raw ? null : JSON.parse(st.scriptstate?.$goei_turns || 'null');
    if (turns?.v === 1) {
      const by = new Map((turns.list ?? []).map((x) => [x.k, x]));
      for (let i = st.message.length - 1; i >= 0; i--) { const hit = by.get(st.message[i].chatId || `#${i + 1}`); if (hit) return JSON.parse(hit.w); }
      if (turns.base) return JSON.parse(turns.base.w);
    }
    return JSON.parse(st.scriptstate?.$goei_world ?? 'null');
  } catch { return null; }
};
export function saveJson(file, v) { writeFileSync(file, JSON.stringify(v, (k, x) => (typeof x === 'string' ? redact(x) : x), 1)); }
export function saveText(file, s) { writeFileSync(file, redact(s)); }
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
