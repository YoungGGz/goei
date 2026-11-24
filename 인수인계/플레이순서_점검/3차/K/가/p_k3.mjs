// K3 덧붙일 규칙(지침 탭 「추가 규칙」): 붙는 다섯 자리(RP 끝·Directive COMMON·게시판 LB·괴담톡 COMMON·위키 NW.GUIDE) → 끄기·지우기 → [[…]]
import { session, sleep, flat } from './lib.mjs';
import { readFileSync } from 'node:fs';

const G = (f) => readFileSync(new URL(`../../../../../지침/${f}`, import.meta.url), 'utf8');
const lastLine = (txt) => txt.trim().split('\n').filter((l) => l.trim()).at(-1).trim();
const secOf = (txt, s) => txt.match(new RegExp(`@@SECTION ${s.replace('.', '\\.')}\\n([\\s\\S]*?)\\n@@END`))[1];
const END = {
  RP: lastLine(G('RP지침.txt')),
  Directive: 'If a Situation is given, follow it first.',
  GNet: lastLine(secOf(G('괴담넷.txt'), 'LB')),
  Phone: lastLine(secOf(G('괴담톡.txt'), 'COMMON')),
  Wiki: lastLine(secOf(G('괴이위키.txt'), 'NW.GUIDE')),
};
/** 규칙 글이 그 자리 끝 글 바로 뒤(그 사이 400자 안, 규칙 머리만)에 붙었나 */
const placed = (txt, end, mark) => { const i = txt.indexOf(end); const j = txt.indexOf(mark); return { endAt: i, markAt: j, gap: i >= 0 && j > i ? j - i - end.length : null, ok: i >= 0 && j > i && j - i - end.length < 400, between: i >= 0 && j > i ? txt.slice(i + end.length, j).slice(0, 200) : null }; };

export async function k3() {
  const S = await session('K3');
  const { t, step } = S;
  const rid = async () => (await S.prefs())?.rules?.[0]?.id;
  const flowDo = async (v) => S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900);
  /** 커스텀 임무: 임무 → 커스텀 → 목표 열기 → 고르기 → 임무 요청. 돌려줌: { notice, sent } */
  const mission = async (nth = 0) => {
    await S.winClose();
    await S.winOpen();
    await S.click('.gx [data-action="tab"][data-value="map"]', 900);
    await S.click('.gx [data-action="tab"][data-value="mission"]', 900);
    const vals = await S.fe(() => [...new Set([...document.querySelectorAll('[data-action="mission-open"]')].map((e) => e.dataset.value))]);
    const v = vals[nth];
    await S.click(`[data-action="mission-open"][data-value="${v}"]`, 700);
    await S.click(`[data-action="mission-pick"][data-value="${v}"]`, 700);
    const s0 = await S.seq();
    await S.click('[data-action="mission-send"]', 1500);
    const notice = await S.fe(() => document.querySelector('.gx-notice, .gx-err, [role="alert"]')?.textContent ?? null).catch(() => null);
    await t.waitBusy(6000).catch(() => {});
    await t.waitIdle().catch(() => {});
    await sleep(2500);
    const l = await S.log(s0);
    return { target: v, notice, main: l.filter((r) => r.route === 'main'), aux: l.filter((r) => r.route === 'aux'), last: (await t.chatState()).message.at(-1) };
  };
  try {
    await S.fakeReset([
      { id: 'k3-gnet', route: 'aux', match: '"feature":"gnet"|Current persisted board', reply: '{"posts":[],"incoming":[],"keyFigures":[]}' },
    ]);
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    let st = step('「새 규칙」 → 기본 붙일 곳 RP·켬 → 제목·본문 입력(0.4초 모아 저장) → prefs.rules', 'prefs.rules[0] = {title K3규칙, text K3-RULE-ONE…, to [RP], on true}', 'rules.ts (Claude 판정: 이 기기 설정, 바로 저장) / K-01');
    await S.ed('rule:all');
    await S.click('.gw [data-action="ed-rule-new"]', 900);
    let id = await rid();
    await S.setVal(`.gw input[data-input="ed-rule-title"][data-key="${id}"]`, 'K3규칙', 'input', 300);
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3-RULE-ONE: keep each line short.', 'input', 1200);
    let pr = await S.prefs();
    await st.shot('규칙_새로');
    st.check(pr?.rules?.length === 1 && pr.rules[0].title === 'K3규칙' && /K3-RULE-ONE/.test(pr.rules[0].text) && JSON.stringify(pr.rules[0].to) === '["RP"]' && pr.rules[0].on === true, pr?.rules);

    st = step('RP: 다음 본편 요청의 RP 지침 끝 바로 뒤에 규칙(머리 USER_RULES + 제목 + 본문)', 'RP 마지막 줄 뒤 400자 안에 K3-RULE-ONE', '지침 탭 안내 「RP = RP 지침 끝」 / guides.ts RULE_SECTION.RP=null');
    let tr = await S.turn('복도를 걷는다.');
    let p = placed(flat(tr.main[0]), END.RP, 'K3-RULE-ONE');
    st.req('RP규칙_본편', tr.main[0]);
    st.check(p.ok, p);

    st = step('붙일 곳에 괴담넷·괴담톡·위키·이동·임무를 더하고, 호출 흐름에서 괴담톡·괴담넷·위키 「매 턴」, 한 번에 요청 끔 → 한 턴', '괴담넷 요청: LB 절 끝 뒤 / 괴담톡: COMMON 끝 뒤 / 위키: NW.GUIDE 끝 뒤 (부른 것만)', '지침 탭 안내 「괴담넷… = 게시판 절 끝 · 괴담톡 = 공통 절 끝 · 위키 = 작성 안내 절 끝」');
    await S.ed('rule:all');
    for (const tg of ['GNet', 'Phone', 'Wiki', 'Directive']) await S.click(`.gw [data-action="ed-rule-to"][data-value="${id}|${tg}"]`, 500);
    await S.ed('manage:flow');
    await flowDo('ph-cfg|auto=1');
    await flowDo('fam-set|b:gn:lazy=0');
    await flowDo('wiki-auto|turn');
    const jointOn = await S.fe(() => !!document.querySelector('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]'));
    if (jointOn) await flowDo('fam-set|b:gn:joint=0');
    pr = await S.prefs();
    tr = await S.turn('휴대폰을 꺼내 본다.', { settle: 6000 });
    const byKind = {};
    for (const r of tr.aux) {
      const f = flat(r);
      const kind = /# Router/.test(f) ? 'router' : /People Record Updater/.test(f) ? 'updater' : f.includes(END.GNet) ? 'gnet' : f.includes(END.Phone) ? 'phone' : f.includes(END.Wiki) ? 'wiki' : /Insert <img>/.test(f) ? 'img' : 'other';
      byKind[kind] = byKind[kind] ?? r;
    }
    for (const k of ['gnet', 'phone', 'wiki']) if (byKind[k]) st.req(`${k}_요청`, byKind[k]);
    const res = Object.fromEntries(['gnet', 'phone', 'wiki'].map((k) => [k, byKind[k] ? placed(flat(byKind[k]), END[{ gnet: 'GNet', phone: 'Phone', wiki: 'Wiki' }[k]], 'K3-RULE-ONE') : '호출 없음']));
    st.check(res.gnet?.ok && res.phone?.ok && (res.wiki === '호출 없음' || res.wiki.ok), { to: pr?.rules?.[0]?.to, jointWasOn: jointOn, kinds: Object.keys(byKind), res });
    if (res.wiki === '호출 없음') S.note('위키 자동 작성이 이 턴엔 호출되지 않음(쓸 문서 후보 없음일 수 있음)', tr.aux.map((r) => String(r.body?.messages?.[0]?.content ?? '').slice(0, 50)));

    st = step('이동·임무(Directive): 커스텀 임무 요청 → 그 본편 요청의 지시문 COMMON 끝 바로 뒤에 규칙', '본편 요청에 「If a Situation is given, follow it first.」 뒤 400자 안에 K3-RULE-ONE', '지침 탭 안내 「이동·임무 = 그 지침의 공통 절 끝」');
    let ms = await mission(0);
    st.req('임무_본편', ms.main[0]);
    p = ms.main[0] ? placed(flat(ms.main[0]), END.Directive, 'K3-RULE-ONE') : null;
    st.check(!!p?.ok, { target: ms.target, notice: ms.notice, main: ms.main.length, p });

    st = step('규칙 끄기(사용 스위치) → 다음 본편·보조 어디에도 규칙 글 없음, 글은 남음', '모든 요청에 K3-RULE-ONE 없음, prefs.rules[0].on=false·text 그대로', '규칙 칸 안내 「끄면 어느 지침에도 붙지 않아요. 글은 남아요.」');
    await S.ed('rule:all');
    await S.click(`.gw [data-action="ed-rule-on"][data-value="${id}"]`, 900);
    pr = await S.prefs();
    tr = await S.turn('잠시 쉰다.', { settle: 5000 });
    const anyRule = tr.all.some((r) => /K3-RULE-ONE/.test(flat(r)));
    st.check(!anyRule && pr?.rules?.[0]?.on === false && /K3-RULE-ONE/.test(pr.rules[0].text), { anyRule, on: pr?.rules?.[0]?.on, calls: tr.all.length });

    st = step('규칙 글에 [[foo]] 를 넣고(붙일 곳 이동·임무) 다시 켬 → 커스텀 임무 요청', '규칙 글은 「모델에게 그대로 가요」라서 임무가 그대로 나가고 글도 그대로 (막히면 진짜 버그 후보)', '규칙 칸 안내 「본문: 모델에게 그대로 가요」 / 2차 결과 B 「[[…]] 든 규칙이 임무 보내기를 막을 수 있음(dispatch.ts:66-70, 안 돌림)」');
    await S.ed('rule:all');
    await S.click(`.gw [data-action="ed-rule-on"][data-value="${id}"]`, 700);
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3-RULE-TWO: see [[foo]] for notes.', 'input', 1200);
    ms = await mission(1);
    await st.shot('임무_foo');
    const blocked = ms.main.length === 0;
    st.check(!blocked && /K3-RULE-TWO: see \[\[foo\]\]/.test(flat(ms.main[0] ?? {})), { target: ms.target, notice: ms.notice, mainSent: ms.main.length, lastMsg: String(ms.last?.data ?? '').slice(0, 120) });

    st = step('규칙 글에 [[DEST]] → 임무 요청: 규칙 글이 그대로 가는지(자리표로 바뀌는지)', '요청에 「[[DEST]]」 글자 그대로', '규칙 칸 안내 「본문: 모델에게 그대로 가요」');
    await S.ed('rule:all');
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3-RULE-THREE: arrive at [[DEST]] quietly.', 'input', 1200);
    ms = await mission(2);
    st.req('임무_DEST', ms.main[0]);
    const m3 = (flat(ms.main[0] ?? {}).match(/K3-RULE-THREE: arrive at ([^\n]*?) quietly/) ?? [])[1] ?? null;
    st.check(m3 === '[[DEST]]', { target: ms.target, notice: ms.notice, mainSent: ms.main.length, ruleBecame: m3 });

    st = step('규칙 지우기 → 확인 팝업 → 예 → prefs.rules 없음, 다음 요청에 규칙 글 없음', 'prefs.rules 없음, 본편에 K3-RULE 없음', 'rules.ts ed-rule-del 확인 팝업 (전수점검 눌러-보통-28)');
    await S.ed('rule:all');
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3-RULE-FOUR: plain.', 'input', 1200);
    await S.click(`.gw [data-action="ed-rule-del"][data-value="${id}"]`, 600);
    const popTxt = await S.fe(() => document.querySelector('.gw-confirm p, .gw .gw-confirm-box p')?.textContent ?? null);
    await S.click(`[data-action="ed-rule-del-yes"][data-value="${id}"]`, 900);
    pr = await S.prefs();
    tr = await S.turn('주위를 정리한다.', { settle: 5000 });
    st.check(!pr?.rules && !tr.all.some((r) => /K3-RULE/.test(flat(r))), { popup: popTxt, rules: pr?.rules ?? null, anyRule: tr.all.some((r) => /K3-RULE/.test(flat(r))) });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K3_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 40));
    await S.close();
  }
}
