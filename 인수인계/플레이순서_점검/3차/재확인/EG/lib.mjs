// 3차 점검 E·G 공용 도구 (실제 리스AI + 가짜 모델 서버, ../틀/risu-t2.mjs 위에)
// - 가짜 서버에 「붙잡아 두고 요청을 읽은 뒤 답을 지어 푸는」 규칙 하나(dyn)를 맨 앞에 깔고, 이 파일의 responder 가 답을 고른다.
//   답 고르기 차례: 단계가 걸어 둔 한 번짜리 답(queue) → 단계가 걸어 둔 늘 답(handlers) → 기본 답(본편·Router·Director·갱신기).
// - 단계마다 기대값을 먼저 적고(expect) 실제값과 대조한다(check). 요청 전문은 out/<단계>.txt 로 남긴다.
import { openT2 } from '/home/user/goei/인수인계/플레이순서_점검/3차/틀/risu-t2.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const STATES = fileURLToPath(new URL('file:///home/user/goei/인수인계/플레이순서_점검/3차/틀/states/'));

/** 메시지 배열 → 한 글 (role 머리 붙임) */
export const msgsText = (body) => (body?.messages ?? []).map((m) => `──── ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
// 리스AI 가 보조 모델(xcustom) 요청에서는 system 을 user 「system: …」 로 바꿔 보낸다 (가짜 서버 기록으로 확인). 둘 다 system 으로 본다
const isSys = (m) => m.role === 'system' || (m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('system: '));
export const sysText = (body) => (body?.messages ?? []).filter(isSys).map((m) => m.content).join('\n');
export const userText = (body) => (body?.messages ?? []).filter((m) => !isSys(m)).map((m) => m.content).join('\n');

/** 요청 종류 가르기 (가짜 서버가 받은 본문으로) */
export function kindOf(route, body) {
  const s = sysText(body);
  const all = msgsText(body);
  if (route === 'main') return 'main';
  if (/# People Record Updater/.test(all)) return 'updater';
  if (/# Router/.test(s.slice(0, 200))) return 'router';
  if (/# Scene Director/.test(s.slice(0, 200))) return 'director';
  if (/You run a shop in the roleplay/.test(s)) return 'shop';
  if (/You run 우주 쇼핑몰/.test(s)) return 'cos';
  if (/You run 백일몽 포인트몰/.test(s)) return 'bm';
  if (/You play one 백일몽 employee answering the 1:1/.test(s)) return 'desk';
  if (/You run the live feed of 망상홈쇼핑/.test(s)) return /A 괴이 has picked up the phone/.test(s) ? 'hsop' : 'hs';
  if (/A 괴이 has picked up the phone/.test(s)) return 'hsop';
  return 'aux';
}

export async function openRun({ out, fake, width = 1280, height = 800, touch, dsf, via = 'plain', streaming = false } = {}) {
  mkdirSync(out, { recursive: true });
  const t = await openT2({ via, width, height, touch: touch ?? width < 600, dsf, streaming, out, ...(fake ? { fake } : {}) });
  const results = [];
  const replyFile = `${out}/.dyn-reply.txt`;
  writeFileSync(replyFile, '');
  const queue = [];        // [{ kind, match?: RegExp, reply: string|fn, once:true }]
  const handlers = [];     // 늘 답
  const seen = [];         // 받은 요청 {seq, route, kind, body}
  let mainN = 0;
  let stopped = false;
  let holdKinds = new Set();   // 이 종류는 풀지 않고 붙잡아 둠 (늦은 답 만들기)
  const held = [];             // 붙잡아 둔 {seq, kind, body}

  // 기본 답
  const STATUS = { date: '2025.03.14', min: 10 * 60 + 20, weather: '☀️', temp: '12°C', place: '서울 서대문구 기독교 상점', a: '없음', b: '없음', c: '없음', rank: '관리국/신입', bal: '140000', extra: '' };
  const hhmm = (m) => { const h = Math.floor(m / 60) % 24; const mm = m % 60; const ap = h >= 12 ? 'PM' : 'AM'; const h12 = ((h + 11) % 12) + 1; return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`; };
  const statusNow = (o = {}) => { Object.assign(STATUS, o); STATUS.min += 10; return `[▣|${STATUS.date}|${hhmm(STATUS.min)}|${STATUS.weather}|${STATUS.temp}|${STATUS.place}|${STATUS.a}|${STATUS.b}|${STATUS.c}|${STATUS.rank}|${STATUS.bal}${STATUS.extra}]`; };
  // 본편 답의 상태창 줄은 요청의 [Previous status] 를 이어 받는다 (실제 모델처럼: 지침 「Copy it from [Previous status]」). 답 글에는 자리표로 두고 풀 때 채운다
  const status = (o = {}) => `{{STATUS ${JSON.stringify(o)}}}`;
  const fillStatus = (reply, body) => String(reply).replace(/\{\{STATUS (\{.*?\})\}\}/g, (_, j) => {
    const o = JSON.parse(j);
    const prev = /\[Previous status\][^\n]*\n(\[▣\|[^\n]*\])/.exec(msgsText(body))?.[1];
    if (!prev) return statusNow(o);
    const f = prev.slice(3, -1).split('|');
    const m = /(\d+):(\d+) (AM|PM)/.exec(f[1]);
    if (m) { let h = Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0); let mm = h * 60 + Number(m[2]) + 10; f[1] = hhmm(mm); }
    if (o.place) f[4] = o.place;
    if (o.bal != null) f[9] = String(o.bal);
    if (o.rank) f[8] = o.rank;
    if (o.pts != null) f[10] = String(o.pts);
    return `[▣|${f.join('|')}]`;
  });
  const def = (kind, body) => {
    if (kind === 'main') { mainN++; return `블라렛은 조용히 고개를 끄덕였다. (본편 #${mainN})\n\n${status()}`; }
    if (kind === 'router') return '{"selected":[],"new_characters":[]}';
    if (kind === 'director') return '{"notes":[]}';
    if (kind === 'updater') return '{}';
    return '(가짜 보조 답)';
  };
  const pick = (kind, body) => {
    const txt = msgsText(body);
    const qi = queue.findIndex((q) => (q.kind === kind || q.kind === 'any') && (!q.match || q.match.test(txt)));
    if (qi >= 0) { const q = queue.splice(qi, 1)[0]; return typeof q.reply === 'function' ? q.reply(body, txt) : q.reply; }
    const h = handlers.find((q) => (q.kind === kind || q.kind === 'any') && (!q.match || q.match.test(txt)));
    if (h) return typeof h.reply === 'function' ? h.reply(body, txt) : h.reply;
    return def(kind, body);
  };
  const release = async (seq, kind, body) => {
    const reply = pick(kind, body);
    if (reply && typeof reply === 'object' && reply.status) { // 오류 답: 규칙으로는 못 줘서 빈 글로 (단계가 따로 규칙을 건다)
      writeFileSync(replyFile, '');
    } else writeFileSync(replyFile, kind === 'main' ? fillStatus(reply ?? '', body) : String(reply ?? ''));
    await t.fake('release', { seq });
    await sleep(120);
  };
  await t.fake('reset', {});
  await t.fake('rules', { rules: [{ id: 'dyn', route: 'any', hold: true, replyFile }] });
  const loop = (async () => {
    let last = 0;
    while (!stopped) {
      try {
        const pend = await t.fake('pending');
        for (const p of pend.filter((x) => x.held && x.seq > last).sort((a, b) => a.seq - b.seq)) {
          const rec = (await t.fake(`log?since=${p.seq - 1}`)).find((x) => x.seq === p.seq);
          if (!rec) continue;
          last = p.seq;
          const kind = kindOf(rec.route, rec.body);
          seen.push({ seq: p.seq, route: rec.route, kind, body: rec.body, stream: rec.stream, t: Date.now() });
          if (holdKinds.has(kind)) { held.push({ seq: p.seq, kind, body: rec.body }); continue; }
          await release(p.seq, kind, rec.body);
        }
      } catch (e) { /* 서버 잠깐 안 됨 */ }
      await sleep(150);
    }
  })();

  const api = {
    t, results, seen, out, status, STATUS,
    /** 한 번짜리 답 걸기 */
    once: (kind, reply, match) => queue.push({ kind, reply, match }),
    on: (kind, reply, match) => { handlers.unshift({ kind, reply, match }); return () => { const i = handlers.findIndex((h) => h.reply === reply); if (i >= 0) handlers.splice(i, 1); }; },
    dropOnce: (kind) => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === kind) queue.splice(i, 1); },
    clearHandlers: () => { handlers.length = 0; queue.length = 0; },
    hold: (kind) => holdKinds.add(kind),
    unhold: async (kind) => { holdKinds.delete(kind); for (const h of held.splice(0).filter((x) => x.kind === kind)) await release(h.seq, h.kind, h.body); },
    held: () => held.slice(),
    /** seq 이후 받은 요청 (kind 로 거름) */
    since: (seq, kind) => seen.filter((x) => x.seq > seq && (!kind || x.kind === kind)),
    lastSeq: () => (seen.length ? seen.at(-1).seq : 0),
    /** 요청 전문 남기기 */
    save: (name, recs) => { const txt = recs.map((r) => `######## seq ${r.seq} ${r.route}/${r.kind} stream=${r.stream}\n${msgsText(r.body)}`).join('\n\n'); writeFileSync(`${out}/${name}.txt`, txt); return `${out}/${name}.txt`; },
    saveJson: (name, v) => { writeFileSync(`${out}/${name}.json`, JSON.stringify(v, null, 1)); return `${out}/${name}.json`; },
    check(step, what, ok, expect, actual, row = '') {
      results.push({ step, what, ok: !!ok, expect, actual, row });
      console.log(`${ok ? 'PASS' : 'FAIL'} [${step}] ${what}${ok ? '' : `\n   기대: ${String(JSON.stringify(expect)).slice(0, 400)}\n   실제: ${String(JSON.stringify(actual)).slice(0, 600)}`}`);
      return !!ok;
    },
    note(step, what, actual) { results.push({ step, what, note: true, actual }); console.log(`NOTE [${step}] ${what}: ${String(JSON.stringify(actual)).slice(0, 400)}`); },
    /** 기다림: 조건 함수가 참일 때까지 */
    async until(fn, ms = 20000, gap = 250) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(gap); } return null; },
    /** 채팅 변수 읽기 */
    vars: async () => (await t.chatState(true)).scriptstate ?? {},
    J: (v, k) => { try { return JSON.parse(v?.[k] || 'null'); } catch { return null; } },
    /** 채팅 변수 바로 쓰기 (설정 화면 대신. 설정 화면 자체는 K 구간 몫) */
    setVars: (o) => t.R(async (o) => { const st = await import('/src/ts/stores.svelte.ts'); const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const c = st.DBState.db.characters[ci]; const ch = c.chats[c.chatPage]; ch.scriptstate = { ...(ch.scriptstate ?? {}), ...o }; }, o),
    /** 플러그인 창 안 단추 */
    fx: (fn, arg) => t.feval(fn, arg),
    async fclickAction(action, value, i = 0) {
      const ok = await t.feval(({ action, value, i }) => { const els = [...document.querySelectorAll(`[data-action="${action}"]${value != null ? `[data-value="${CSS.escape(value)}"]` : ''}`)].filter((e) => e.offsetParent !== null || e.getClientRects().length); const el = els[i]; if (!el) return false; el.click(); return true; }, { action, value, i });
      await sleep(350);
      return ok;
    },
    async ftext(sel = 'body') { return t.feval((sel) => (document.querySelector(sel)?.innerText ?? '').replace(/\s+/g, ' ').trim(), sel); },
    async stop() { stopped = true; await loop.catch(() => {}); },
    writeResults(file = `${out}/결과.json`) { const pass = results.filter((r) => !r.note && r.ok).length; const all = results.filter((r) => !r.note).length; writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), pass, all, results }, null, 1)); console.log(`결과 ${pass}/${all} → ${file}`); return { pass, all }; },
  };
  return api;
}

/** 채팅 속 카드 단추(리스AI 화면, iframe 밖) 누르기 */
export async function clickChatCard(t, sel = '[data-goei-shop]') {
  const loc = t.page.locator(`.default-chat-screen ${sel}`).last();
  if (!(await loc.count())) return false;
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout: 5000 });
  await sleep(800);
  return true;
}
export const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
