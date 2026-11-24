// I 구간 run4: 인물 창 조작 — 목록·상세·고정·호칭·호감·말투 변경 승인/거절·축 변경 승인/거절/되돌림·마지막 갱신 되돌리기·등록 대기(확인 뒤 등록/무시)·
// 지난 응답 읽기·다시 읽기·정리·세력 저장·인물 기록 점검. PC 1280x800 에서 누르고, 끝 상태를 폰 344x882 에서 다시 열어 화면을 본다.
// 사용: node run4.mjs [pc|phone]   (phone 은 pc 가 남긴 out/run4-state.json 을 넣는다)
import { open, responder, people, diag, STATES, OUT, updData, lastTag, sleep, ctl, setVars, recorder, EMPTY_UPD } from './common.mjs';
import { existsSync } from 'node:fs';

const mode = process.argv[2] || 'pc';
const phone = mode === 'phone';
const R = recorder('run4-' + mode);
const t = await open(phone ? { width: 344, height: 882, touch: true } : { width: 1280, height: 800 });
const rsp = responder(OUT + `/calls-run4-${mode}.jsonl`);
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
const P = '../../I/out/run4-' + mode + '-';
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
  if (phone) {
    if (!existsSync(OUT + '/run4-state.json')) throw new Error('pc 상태 파일 없음');
    await t.loadState(OUT + '/run4-state.json');
    await openPeople();
    await t.shot(P + 'list');
    R.step('P1 폰 인물 목록', '목록이 화면 폭 안(가로 넘침 없음), 소속별 묶음·등록 대기', '공-13·공-14', { overflow: await overflow(), actions: await actions() }, null);
    await act('rec-person', '잼트리'); await sleep(800);
    await t.shot(P + 'person');
    R.step('P2 폰 인물 상세', '가로 넘침 없음, 단추가 눌림', '공-13', { overflow: await overflow(), actions: await actions() }, null);
    const pinned = await btn('pp-pin');
    await t.shot(P + 'person-pin');
    const pv = await people(t);
    R.step('P3 폰에서 고정 누르기', '고정 표시가 바뀜', '코스 I-1 고정', { clicked: pinned, pins: Object.values(pv.people['잼트리'].slots).flat().filter((e) => e.pin).length }, null);
    await t.closeWindow();
    await t.openWindow('.gx');
    await act('ed-open', 'manage:people'); await sleep(1200);
    await t.shot(P + 'manage-people');
    R.step('P4 폰 인물 기록 점검', '가로 넘침 없음, 지금 갱신·갱신 기록 보임', 'K-04', { overflow: await overflow(), actions: await actions() }, null);
    await act('ed-open', 'set:people'); await sleep(1200);
    await t.shot(P + 'settings-people');
    R.step('P5 폰 인물 설정', '맨 위 보조 호출 흐름 도식, 단계별 블록', 'I-09(사용자 결정)', { overflow: await overflow(), head: (await text()).slice(0, 300) }, null);
  } else {
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

    await openPeople();
    await t.shot(P + 'list');
    R.step('2 목록', '소속별 묶음, 바뀐 인물 ● 표시, 되돌리기 단추', 'I-11·공-14', { actions: await actions(), overflow: await overflow() }, null);
    await act('rec-person', '잼트리');
    await t.shot(P + 'person');
    const acts = await actions();
    R.step('3 잼트리 상세', '말투 승인/거절, 축 승인/거절, 고정, 호감·호칭 고치기, 다시 읽기·정리 단추', '코스 I-1', acts, null);

    // 말투 변경 승인
    let v = await btn('pp-speech-approve');
    p = await people(t);
    R.step('4 말투 변경 승인', '표지가 「변경 가능」으로 (다음 턴 갱신기가 바꿀 수 있음)', '코스 I-1·speech.ts', { clicked: v, speech: (p.people['잼트리'].slots.speech ?? []).map((e) => e.text + (e.src === 'manual' ? '(manual)' : '')).slice(-2), toast: await toastText() }, v !== null);
    // 축 후보 승인 → 되돌림
    v = await btn('pp-axis-approve');
    p = await people(t);
    const afterApprove = { axes: p.people['잼트리'].axes?.guardedness, status: Object.values(p.people['잼트리'].candidates ?? {}).map((c) => c.status) };
    const rv = await btn('pp-axis-revert');
    p = await people(t);
    R.step('5 축 변경 승인 → 되돌림', '승인하면 guardedness 가 내려가고 후보가 applied, 되돌리면 전 값으로', '코스 I-1·axes.ts(리수폿 이식)', { approve: v, afterApprove, revert: rv, afterRevert: { axes: p.people['잼트리'].axes?.guardedness, status: Object.values(p.people['잼트리'].candidates ?? {}).map((c) => c.status) }, toast: await toastText() }, v !== null);
    await t.shot(P + 'person-after-axis');
    // 고정
    v = await btn('pp-pin');
    p = await people(t);
    R.step('6 항목 고정', '그 항목 pin=true (다음 갱신기 자료에 "pin": true)', '갱신기 지침 5절', { clicked: v, pins: Object.values(p.people['잼트리'].slots).flat().filter((e) => e.pin).map((e) => e.text.slice(0, 20)) }, null);
    // 호칭 고치기
    await btn('pp-addr-edit');
    await fillIn('pp-addr-to', '후배님');
    await btn('pp-addr-save');
    p = await people(t);
    R.step('7 호칭 고치기', '수동 호칭 변경 기록(후배님)', '코스 I-1', { toast: await toastText(), manualAddr: p.log.filter((c) => c.who === '잼트리' && c.kind === 'address' && c.src === 'manual').map((c) => c.toUser) }, null);
    // 호감 고치기
    await btn('pp-aff-edit');
    await fillIn('pp-aff-num', '150');
    await fillIn('pp-aff-reason', '점검: 손으로 고정');
    await btn('pp-aff-save');
    p = await people(t);
    R.step('8 호감 고치기', '호감 150 고정(이유 남음)', '코스 I-1', { toast: await toastText(), pins: p.log.filter((c) => c.who === '잼트리' && c.pin !== undefined).map((c) => `${c.pin}:${c.reason}`) }, null);
    await t.shot(P + 'person-edited');
    // 다음 턴: 고정 항목이 자료에 pin 으로 가는지, 승인된 말투가 「변경 가능」으로 가는지
    MAIN.set('잼트리를 부른다', '잼트리가 돌아보았다. "왜, 후배?"');
    let c0 = rsp.maxSeq();
    rsp.plan.upd = () => U({});
    await sendW('잼트리를 부른다.');
    await waitUpd(c0);
    const d9 = updData(updCalls(c0)[0]?.body);
    const jd = d9?.people?.find((x) => x.name === '잼트리');
    R.step('9 다음 갱신기 자료', '고정 항목 pin:true, 말투 항목 「[말투 변경 가능 …]」, 호칭 후배님, 호감 고정 반영', '갱신기 지침 5절·9절', { pinned: Object.values(jd?.entries ?? {}).flat().filter((e) => e.pin).length, speech: (jd?.entries?.speech ?? []).map((e) => e.text), address_now: jd?.address_now, affinity_now: jd?.affinity_now }, null);

    // 마지막 갱신 되돌리기 (새 인물 하나 만든 갱신)
    MAIN.set('새 얼굴을 본다', '로비에 택배 기사 소태성이 들어왔다. "소태성입니다, 서명 부탁드려요."');
    rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '소태성', aliases: [], m, quote: '소태성입니다, 서명 부탁드려요', identity: '택배 기사', speech: '존댓말' }], entries: [{ who: '잼트리', slot: 'state', op: 'add', replace: null, text: '로비에서 택배를 기다림', target: null, m, quote: '로비에 택배 기사' }] }); };
    c0 = rsp.maxSeq();
    await sendW('새 얼굴을 본다.');
    await waitUpd(c0);
    await t.openWindow('.gx'); await sleep(800);
    await act('rec-people');
    await t.shot(P + 'list-before-undo');
    v = await btn('pp-undo-run');
    const ask = await toastText();
    await btn('pp-undo-run-yes');
    p = await people(t);
    R.step('10 마지막 갱신 되돌리기', '한 번 더 묻고(취소할까요?) → 소태성 지워지고 잼트리 state 항목 취소', '코스 I-1·전수검사 11-13', { asked: ask, toast: await toastText(), has소태성: !!p.people['소태성'], lastRun: p.lastRun ?? null }, !p.people['소태성']);

    // 확인 뒤 등록 / 무시
    await setVars(t, { '$pp_newpeople': 'confirm' });
    MAIN.set('손님들을 본다', '로비 의자에 두 사람이 앉아 있었다. "저는 민아영이에요." "전 곽두식." 둘은 차례로 고개를 숙였다.');
    rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '민아영', aliases: [], m, quote: '저는 민아영이에요.', identity: '미확인', speech: '존댓말' }, { name: '곽두식', aliases: [], m, quote: '전 곽두식.', identity: '미확인', speech: '반말' }] }); };
    c0 = rsp.maxSeq();
    await sendW('손님들을 본다.');
    await waitUpd(c0);
    await t.openWindow('.gx'); await sleep(800);
    await act('rec-people');
    await t.shot(P + 'list-pending');
    p = await people(t);
    const pend = Object.keys(p.pending ?? {});
    await btn('pp-register', '^민아영$');
    await btn('pp-ignore', '^곽두식$');
    p = await people(t);
    R.step('11 확인 뒤 등록 → 등록·무시', '둘 다 등록 대기 → 민아영 등록, 곽두식 무시 목록', '코스 I-1·보통-17', { pendingBefore: pend, has민아영: !!p.people['민아영'], ignored: p.ignored, pendingAfter: Object.keys(p.pending ?? {}) }, !!p.people['민아영'] && p.ignored.includes('곽두식'));
    // 무시한 이름이 다시 나오면
    MAIN.set('곽두식을 다시 본다', '곽두식이 다시 손을 들었다. "곽두식이라니까요."');
    rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '곽두식', aliases: [], m, quote: '곽두식이라니까요', identity: '미확인', speech: null }] }); };
    c0 = rsp.maxSeq();
    await sendW('곽두식을 다시 본다.');
    await waitUpd(c0);
    await t.openWindow('.gx'); await sleep(800);
    p = await people(t);
    R.step('11-2 무시한 이름 다시', '다시 올리지 않음', '보통-17', { pending: Object.keys(p.pending ?? {}), has: !!p.people['곽두식'] }, !p.people['곽두식'] && !p.pending?.['곽두식']);
    await setVars(t, { '$pp_newpeople': 'auto' });

    // 다시 읽기 · 정리 · 지난 응답 읽기
    await act('rec-people'); await act('rec-person', '잼트리');
    rsp.plan.upd = (body) => { const d = updData(body); const m = lastTag(d); return U({ entries: [{ who: '잼트리', slot: 'state', op: 'add', replace: null, text: '다시 읽기로 적은 상태', target: null, m, quote: '잼트리가 돌아보았다' }] }); };
    c0 = rsp.maxSeq();
    v = await btn('pp-reread');
    await waitUpd(c0, 1, 20000);
    await sleep(1500);
    p = await people(t);
    R.step('12 다시 읽기', '잼트리 이야기 기록을 비우고 그 인물이 나온 응답만 다시 읽음, 고정 항목은?', '코스 I-1·rereadPerson', { clicked: v, toast: await toastText(), updOnly: updData(updCalls(c0)[0]?.body)?.people?.map((x) => x.name), state: (p.people['잼트리'].slots.state ?? []).map((e) => e.text), pinsLeft: Object.values(p.people['잼트리'].slots).flat().filter((e) => e.pin).length }, null);
    rsp.plan.tidy = () => JSON.stringify({ slots: {} });
    v = await btn('pp-tidy');
    await sleep(3000);
    R.step('13 정리', '정리 호출 1회, 「바뀐 칸이 없어요」 또는 결과 알림', 'I-04(Claude 판정)', { clicked: v, tidyCalls: rsp.calls.filter((c) => c.kind === 'tidy').length, toast: await toastText() }, null);
    await act('rec-people');
    v = await btn('pp-backfill');
    await sleep(3000);
    R.step('14 지난 응답 읽기', '안 읽은 응답이 없으면 「그 범위에 안 읽은 응답이 없어요」', '코스 I-1·backfillPeople', { clicked: v, toast: await toastText() }, null);

    // 세력 저장
    await act('rec-faction', 'A00');
    await t.shot(P + 'faction');
    await btn('pp-aff-edit');
    await fillIn('pp-aff-num', '30');
    await fillIn('pp-aff-reason', '점검: 세력 고정');
    v = await btn('pp-fac-save');
    p = await people(t);
    R.step('15 세력 평판 저장', '관리국 평판 30 고정 기록', '코스 I-1 세력 저장', { clicked: v, toast: await toastText(), pins: p.log.filter((c) => /^#?A00|faction/.test(c.who) || c.who.includes('A00')).map((c) => `${c.who}:${c.pin}:${c.reason}`) }, null);
    await t.shot(P + 'faction-after');
    await t.closeWindow();

    // 인물 기록 점검 페이지
    await t.openWindow('.gx');
    await act('ed-open', 'manage:people'); await sleep(1200);
    await t.shot(P + 'manage-people');
    const mt = await text();
    R.step('16 인물 기록 점검', '지금 갱신·모든 채팅·갱신 기록(성공·실패·이유·입력 크기)·진단 지우기', 'K-04·K-16·I-12', { actions: await actions(), excerpt: mt.slice(0, 600) }, null);
    v = await btn('pp-diag-show');
    await t.shot(P + 'manage-people-row');
    await act('ed-open', 'set:people'); await sleep(1200);
    await t.shot(P + 'settings-people');
    R.step('17 인물 설정 화면', '맨 위 보조 호출 흐름 도식(입력→Router→Director→본편→갱신→정리), 공통, 단계별', 'I-09(사용자 결정)', { head: (await text()).slice(0, 400) }, null);
    await t.closeWindow();
    await t.exportState(OUT + '/run4-state.json', { name: 'run4-state' });
  }
  R.step('끝', '', '', { errors: t.errors.filter((e) => !/displayData|\[goei\] (시작|세계|본체|소지품)/.test(e)).slice(-12) }, null);
} catch (e) {
  await t.shot(P + 'error').catch(() => {});
  R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1500), false);
} finally {
  await rsp.stop();
  await t.close();
}
