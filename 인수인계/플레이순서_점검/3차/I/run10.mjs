// I 구간 run10: 말투 변경 거절 (run4 는 승인만 눌렀음). run4 pc 와 같은 세 턴으로 「변경 승인 대기」를 만든 뒤 거절. PC 1280x800
// (아래 머리는 run4 그대로) run4: 인물 창 조작 — 목록·상세·고정·호칭·호감·말투 변경 승인/거절·축 변경 승인/거절/되돌림·마지막 갱신 되돌리기·등록 대기(확인 뒤 등록/무시)·
// 지난 응답 읽기·다시 읽기·정리·세력 저장·인물 기록 점검. PC 1280x800 에서 누르고, 끝 상태를 폰 344x882 에서 다시 열어 화면을 본다.
// 사용: node run4.mjs [pc|phone]   (phone 은 pc 가 남긴 out/run4-state.json 을 넣는다)
import { open, responder, people, diag, STATES, OUT, updData, lastTag, sleep, ctl, setVars, recorder, EMPTY_UPD } from './common.mjs';
import { existsSync } from 'node:fs';

const mode = 'pc';
const phone = mode === 'phone';
const R = recorder('run10');
const t = await open(phone ? { width: 344, height: 882, touch: true } : { width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run10.jsonl');
const MAIN = new Map();
const ST = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
rsp.plan.main = (body) => {
  const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  for (const [k, v] of MAIN) if (String(last).includes(k)) return v + '\n' + ST;
  return '잼트리가 고개를 끄덕였다. "응."\n' + ST;
};
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const P = '../../I/out/run10-';
const act = (action, value) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [action, value ?? null]).then(() => sleep(900));
const actions = () => t.feval(() => [...new Set([...document.querySelectorAll('.gx [data-action^="pp-"], .gx [data-action^="rec-"]')].filter((e) => e.offsetParent !== null).map((e) => e.dataset.action))]);
const btn = (action, valueRe) => t.feval(([a, re]) => { const r = re ? new RegExp(re) : null; const b = [...document.querySelectorAll(`.gx [data-action="${a}"]`)].find((e) => e.offsetParent !== null && (!r || r.test(e.dataset.value ?? ''))); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); return b.dataset.value ?? ''; }, [action, valueRe ?? null]).then(async (v) => { await sleep(1000); return v; });
const text = () => t.feval(() => document.querySelector('.gx')?.innerText ?? '');
const toastText = () => t.feval(() => [...document.querySelectorAll('.gx .gx-toast, .gx [role="status"], .gx .gx-err, .gx .gx-hint')].map((e) => e.innerText).join(' | ').slice(0, 300));
const fillIn = (name, val) => t.feval(([n, v]) => { const e = document.querySelector(`.gx [data-input="${n}"], .gx [data-change="${n}"], .gx [name="${n}"]`); if (!e) return false; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [name, val]);
const overflow = () => t.feval(() => { const root = document.querySelector('.gx'); const w = document.documentElement.clientWidth; const wide = [...root.querySelectorAll('*')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > w + 1).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`); return { docW: w, scrollW: document.documentElement.scrollWidth, wide }; });
const sendW = async (x) => { await t.closeWindow(); await t.send(x); };
const openPeople = async () => { await t.openWindow('.gx'); await sleep(800); await act('rec-people'); await sleep(800); };

try {
  await t.setup();
    await t.loadState(STATES + 'S-관리국-3턴.json');
    await setVars(t, { '$pp_register_variety': 'two', '$pp_register_sign_limit': '3' });
    // 세 턴: 잼트리 관찰(축 후보) + 말투 조짐(SIGN closer)
    const said = ['커피를 같이 마시자고 한다', '잼트리의 일을 돕는다', '잼트리에게 고맙다고 한다'];
    for (let i = 0; i < 3; i++) {
      MAIN.set(said[i], `잼트리가 웃으며 경계를 풀었다. "후배 덕분에 살았네. 고마워${'!'.repeat(i + 1)}"\n\n잼트리는 처음으로 말끝을 흐렸다.`);
      rsp.plan.upd = (body) => {
        const d = updData(body); const m = lastTag(d);
        const sp = d.people.find((p) => p.name === '잼트리')?.entries?.speech?.find((e) => !e.target || e.target === '@user');
        return U({
          entries: [sp ? { who: '잼트리', slot: 'speech', op: 'upsert', replace: sp.id, text: `후배라고 부르며 다정한 존댓말 SIGN closer: 도움을 받고 말끝을 흐림 ${i + 1}`, target: '@user', m, quote: '후배 덕분에 살았네' } : { who: '잼트리', slot: 'speech', op: 'add', replace: null, text: '후배라고 부르며 다정한 존댓말 SIGN closer: 도움을 받고 말끝을 흐림', target: '@user', m, quote: '후배 덕분에 살았네' },
            { who: '잼트리', slot: 'history', op: 'add', replace: null, text: `후배의 도움을 받음 ${i + 1}`, target: null, m, quote: '후배 덕분에 살았네' }],
          observations: [{ who: '잼트리', axis: 'guardedness', direction: 'down', pattern: '도움을 받으면 경계를 푼다', reason: '도움에 경계를 풂', strength: 70, confidence: 80, m, quote: '잼트리가 웃으며 경계를 풀었다' }],
          cues: [{ who: '잼트리', cue: '도움', m, quote: '후배 덕분에 살았네', reason: '도움' }],
        });
      };
      const c0 = rsp.maxSeq();
      await t.send(said[i] + '.');
      await waitUpd(c0);
    }
    let p = await people(t);
    const j = p.people['잼트리'];
    R.step('1 세 턴 뒤 잼트리', '말투 조짐 3/3 → 「변경 승인 대기」 표지, 성격 후보(guardedness down) 쌓임, 호감 계기 3', '코스 I-1·speech.ts(리수폿 이식)', { speech: (j.slots.speech ?? []).map((e) => e.text).slice(-2), candidates: Object.values(j.candidates ?? {}).map((c) => `${c.axis}/${c.direction}/${c.status}/${c.evidence.length}`), cues: p.log.filter((c) => c.who === '잼트리' && c.kind === 'cue').length }, null);

    await t.closeWindow().catch(() => {});
    await openPeople();
    await act('rec-person', '잼트리');
    const v = await btn('pp-speech-reject');
    const p2 = await people(t);
    const msg = await toastText();
    await t.shot(P + 'speech-rejected');
    R.step('2 말투 변경 거절', '「말투 변경을 거절했어요. 조짐을 지웠어요.」, 승인 대기 표지 사라짐(집계 지움)', '코스 I-1 말투 변경 거절·speech.ts', { clicked: v, msg, speech: (p2.people['잼트리'].slots.speech ?? []).filter((e) => !p2.people['잼트리'].slots.speech.some((x) => x.replaces === e.id)).map((e) => e.text).slice(-2) }, v !== null);
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); } finally { await rsp.stop(); await t.close(); }
