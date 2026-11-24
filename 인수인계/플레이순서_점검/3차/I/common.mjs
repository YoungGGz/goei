// 3차 점검 I 구간(인물 기록) 공용: T2 열기 + 가짜 서버(8802) 대본 응답기.
// 보조(갱신기·Router·Director·정리)와 본편을 hold+replyFile 로 붙잡고, 요청 글을 본 뒤 plan 함수가 답을 지어 넣고 푼다.
// 나이 줄 값은 기록에 남기지 않는다(scrub).
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = HERE + '/out';
mkdirSync(OUT, { recursive: true });
export const FAKE = process.env.FAKE_URL_I || 'http://192.0.2.2:8802';
export const STATES = HERE + '/../틀/states/';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' KST';
/** 나이 줄 값 지우기 (요청 전문을 남길 때) */
export const scrub = (s) => String(s).replace(/(Age|나이)\s*[:：]\s*[^"\\\n,]*/g, '$1: [생략]');

export const ctl = async (path, body) => {
  const r = await fetch(FAKE + '/_ctl/' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return r.json();
};
const F = { upd: OUT + '/r-upd.txt', router: OUT + '/r-router.txt', dir: OUT + '/r-dir.txt', tidy: OUT + '/r-tidy.txt', main: OUT + '/r-main.txt' };
for (const f of Object.values(F)) writeFileSync(f, '');
export const BASE_RULES = [
  { id: 'upd', route: 'aux', match: 'system: # People Record Updater', hold: true, replyFile: F.upd },
  { id: 'router', route: 'aux', match: 'system: # Router — scene people selection', hold: true, replyFile: F.router },
  { id: 'dir', route: 'aux', match: 'system: # Scene Director', hold: true, replyFile: F.dir },
  { id: 'tidy', route: 'aux', match: 'system: You tidy the per-chat record', hold: true, replyFile: F.tidy },
  { id: 'aux-other', route: 'aux', reply: '{}' },
  { id: 'main', route: 'main', hold: true, replyFile: F.main },
];

export const EMPTY_UPD = { entries: [], cues: [], address: [], identity: { faction: null, rank: null }, new_people: [], renames: [], docs: [], present: [], issues: [] };
/** 갱신기 요청 user JSON */
export const updData = (body) => { try { return JSON.parse(body.messages[1].content); } catch { return null; } };
/** span 에서 글(sub)이 든 메시지의 m 꼬리표 */
export const tagOf = (data, sub) => (data?.span ?? []).filter((x) => String(x.text ?? '').includes(sub)).map((x) => x.m).at(-1) ?? null;
export const lastTag = (data) => (data?.span ?? []).filter((x) => x.role === 'assistant' && !x.context_only).map((x) => x.m).at(-1) ?? null;

/** 응답기: plan = { upd(body,rec)→글|{hold:true}|null, router, dir, tidy, main }. 기록은 calls 배열에 */
export function responder(log = OUT + '/calls.jsonl') {
  const plan = {
    upd: () => JSON.stringify(EMPTY_UPD),
    router: () => '{"selected":[],"new_characters":[]}',
    dir: () => '{"notes":[]}',
    tidy: () => '{"slots":{}}',
    main: () => '가짜 본편 답.\n[▣|2025.03.14|10:10 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]',
  };
  const calls = [];
  const handled = new Set();
  let stop = false;
  let paused = new Set(); // 이 종류는 풀지 않고 붙잡아 둔다 (답 오는 중)
  const loop = (async () => {
    while (!stop) {
      try {
        const pend = await ctl('pending');
        for (const p of pend) {
          if (!p.held || handled.has(p.seq)) continue;
          const kind = p.ruleId;
          if (!plan[kind] || paused.has(kind)) continue;
          const recs = await ctl(`log?since=${p.seq - 1}`);
          const rec = recs.find((x) => x.seq === p.seq);
          if (!rec) continue;
          let out = plan[kind](rec.body, rec);
          if (out && typeof out === 'object' && out.hold) continue;
          if (out == null) out = '';
          handled.add(p.seq);
          writeFileSync(F[kind], typeof out === 'string' ? out : JSON.stringify(out));
          await ctl('release', { seq: p.seq });
          for (let i = 0; i < 50; i++) { const r2 = (await ctl(`log?since=${p.seq - 1}&full=0`)).find((x) => x.seq === p.seq); if (r2?.response) break; await sleep(60); }
          const c = { seq: p.seq, kind, t: kst(), out: String(typeof out === 'string' ? out : JSON.stringify(out)).slice(0, 3000) };
          calls.push({ ...c, body: rec.body });
          appendFileSync(log, scrub(JSON.stringify({ ...c, sys: String(rec.body?.messages?.[0]?.content ?? '').slice(0, 120), data: String(rec.body?.messages?.[1]?.content ?? '').slice(0, 20000) })) + '\n');
        }
      } catch (e) { /* 다시 */ }
      await sleep(250);
    }
  })();
  return {
    plan, calls,
    pause: (k) => paused.add(k), resume: (k) => paused.delete(k),
    since: (n) => calls.filter((c) => c.seq > n),
    last: (kind) => calls.filter((c) => c.kind === kind).at(-1),
    maxSeq: () => Math.max(0, ...calls.map((c) => c.seq)),
    stop: async () => { stop = true; await loop; },
  };
}

export async function open(o = {}) {
  await ctl('rules', { rules: BASE_RULES });
  const t = await openT2({ via: 'plain', fake: FAKE, ...o });
  return t;
}

/** 지금 채팅의 인물 기록 저장값 */
export const people = (t) => t.R(async () => {
  const db = await import('/src/ts/storage/database.svelte.ts');
  const c = db.getCurrentCharacter();
  const chat = c.chats[c.chatPage];
  return JSON.parse(JSON.stringify(chat.goeiPeopleV1 ?? null));
});
/** 채팅 변수 넣기 ($pp_* 등). 리스AI DB 에 바로 */
export const setVars = (t, vars) => t.R(async (vars) => {
  const db = await import('/src/ts/storage/database.svelte.ts');
  const c = db.getCurrentCharacter();
  const chat = c.chats[c.chatPage];
  chat.scriptstate = { ...(chat.scriptstate ?? {}), ...vars };
  return Object.keys(vars);
}, vars);
export const getVars = (t, keys) => t.R(async (keys) => {
  const db = await import('/src/ts/storage/database.svelte.ts');
  const c = db.getCurrentCharacter();
  const s = c.chats[c.chatPage].scriptstate ?? {};
  return Object.fromEntries(keys.map((k) => [k, s[k]]));
}, keys);
/** 기기 저장소의 인물 진단 */
export const diag = (t) => t.R(async () => {
  const cs = await import('/src/ts/process/coldstorage.svelte.ts');
  const raw = await cs.pluginStorage.getItem('goei-people-diag');
  const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return (Array.isArray(v) ? v : []).map((d) => ({ at: d.at, reason: d.reason, ok: d.ok, stage: d.stage, error: d.error, people: d.people, report: d.report ? { applied: d.report.applied, dropped: (d.report.dropped ?? []).map((x) => `${x.kind}:${x.who ?? ''}:${x.reason}`), held: (d.report.held ?? []).map((x) => `${x.kind}:${x.who ?? ''}:${x.reason}`) } : undefined }));
});

/** 결과 적기 */
export function recorder(name) {
  const file = `${OUT}/${name}-${Date.now()}.json`;
  const res = { name, at: kst(), steps: [] };
  const step = (id, expect, ref, actual, ok, extra = {}) => {
    res.steps.push({ id, expect, ref, actual, ok, ...extra, t: kst() });
    console.log(`${ok === true ? 'OK ' : ok === false ? 'NG ' : '-- '} ${id} | ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`.slice(0, 600));
    writeFileSync(file, scrub(JSON.stringify(res, null, 1)));
  };
  return { res, step, file, save: () => writeFileSync(file, scrub(JSON.stringify(res, null, 1))) };
}
