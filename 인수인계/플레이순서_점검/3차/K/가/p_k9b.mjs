// K 덧 2차 (리드 요청): ① 위키 문서 요청의 덧붙일 규칙 자리 ② 괴담톡·위키 컨텍스트 포함·요청당 사진 ③ 다른 봇 채팅 ④ 기능별 토큰 상한(괴담넷 새로고침) ⑤ 커스텀 임무 목표 고르기 캡처
import { session, sleep, flat } from './lib.mjs';
import { readFileSync } from 'node:fs';

const G = (f) => readFileSync(new URL(`../../../../../지침/${f}`, import.meta.url), 'utf8');
const secOf = (txt, s) => txt.match(new RegExp(`@@SECTION ${s.replace(/\./g, '\\.')}\\n([\\s\\S]*?)\\n@@END`))[1];
const lastLine = (txt) => txt.trim().split('\n').filter((l) => l.trim()).at(-1).trim();
const WIKI_END = lastLine(secOf(G('괴이위키.txt'), 'NW.GUIDE'));
const GN = 'Board refresh preserves';
const TITLE_Q = 'Pick one wiki article title';
const hex = (s) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
const photo = (n) => `%%ATTACHMENT:${hex(JSON.stringify({ kind: 'image', content: `K9 사진 ${n}`, asset: `assets/k9photo${n}.png` }))}%%`;
const REFRESH = (id, title) => JSON.stringify({ posts: [{ author: '야근요정', id, tag: '현장', title, date: '2025.03.14 22:40', views: 5, upvotes: 1, content: '셔터.', mine: false, comments: [] }], incoming: [], keyFigures: [] });

export async function k9b() {
  const S = await session(process.env.K9B_TARGET ? 'K9c' : 'K9b');
  const { t, step } = S;
  const flowDo = async (v) => { await S.ed('manage:flow'); await S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900); };
  const mainCtx = (r, feature) => { const s = flat(r); const i = s.indexOf(`"feature":"${feature}"`); return i < 0 ? '' : s.slice(Math.max(0, s.lastIndexOf('[MODULE_CONTEXT_BEGIN]', i)), s.indexOf('[MODULE_CONTEXT_END]', i) + 20); };
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');
    await S.ed('manage:flow');
    if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await flowDo('fam-set|b:gn:joint=0');

    await S.ed('rule:all');
    await S.click('.gw [data-action="ed-rule-new"]', 900);
    const id = (await S.prefs())?.rules?.[0]?.id;
    await S.setVal(`.gw input[data-input="ed-rule-title"][data-key="${id}"]`, 'K9규칙', 'input', 300);
    await S.click(`.gw [data-action="ed-rule-to"][data-value="${id}|Wiki"]`, 500);
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K9-RULE-WIKI: keep it short.', 'input', 1200);
    await flowDo('wiki-auto|turn');
    await flowDo('wiki-model|aux');
    let tr = await S.turn('관리국 이야기를 떠올린다.', { settle: 7000 });
    const tq = tr.all.find((r) => flat(r).includes(TITLE_Q));
    const cands = tq ? (String(tq.body.messages.at(-1).content).split('[후보 제목]')[1] ?? '').split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean) : [];
    const title = cands[0];
    S.note('위키 제목 후보(앞 5)', cands.slice(0, 5));
    const doc = `<lightboard-namuwiki doc_title="${title}" doc_type="other" main_color="#27685b">\n[Infobox]Title:${title}|분류:K9\n[Heading]Level:1|Title:개요\n[Paragraph]K9-WIKI-BODY ${title}에 관한 문서다. 관리국 기록에 따르면 이곳은 오래전부터 알려져 있었다.\n[Paragraph]두 번째 문단도 이어진다.\n</lightboard-namuwiki>`;
    await S.addRules([{ id: 'k9-title', route: 'aux', match: TITLE_Q, reply: JSON.stringify({ title }) }, { id: 'k9-doc', route: 'aux', match: 'in-universe encyclopedia', reply: doc }]);
    let st = step('(준비) 위키 매 턴: 제목 답(대본) → 문서 요청이 나가고, 붙일 곳 「위키」 규칙이 NW.GUIDE(작성 안내) 끝 바로 뒤', '문서 요청 1건, NW.GUIDE 마지막 줄 뒤 400자 안에 K9-RULE-WIKI, 제목 요청엔 규칙 없음', '지침 탭 안내 「위키 = 작성 안내 절 끝」 / guides.ts RULE_SECTION.Wiki');
    tr = await S.turn('관리국 이야기를 다시 떠올린다.', { settle: 9000 });
    const docReq = tr.all.find((r) => flat(r).includes('in-universe encyclopedia'));
    const titleReq = tr.all.find((r) => flat(r).includes(TITLE_Q));
    const f = flat(docReq ?? {}); const i = f.indexOf(WIKI_END); const j = f.indexOf('K9-RULE-WIKI');
    st.req('위키_문서요청', docReq);
    st.check(!!docReq && i >= 0 && j > i && j - i - WIKI_END.length < 400 && !flat(titleReq ?? {}).includes('K9-RULE-WIKI'), { title, docReq: !!docReq, gap: i >= 0 && j > i ? j - i - WIKI_END.length : null, between: i >= 0 && j > i ? f.slice(i + WIKI_END.length, j) : null, ruleInTitleReq: flat(titleReq ?? {}).includes('K9-RULE-WIKI') });
    await flowDo('wiki-auto|0');

    st = step('위키 컨텍스트 포함 켬 + 「로어북 있는 문서」 칩 켬(위키 페이지) → 받은 문서가 다음 본편에 「feature":"wiki"」 덩어리로', '본편에 K9-WIKI-BODY 든 wiki 덩어리', 'body.ts moduleContext wantWiki / wiki.ts wikiContextOn($nw_context)');
    await S.ed('set:wiki');
    const wctl = await S.fe(() => [...document.querySelectorAll('.gw [data-action="wiki-context"]')].map((e) => e.dataset.value));
    S.note('위키 컨텍스트 포함 단추', wctl);
    await S.click('.gw [data-action="wiki-context"][data-value="1"]', 900);
    await S.click('.gw [data-action="adv-set"][data-value="nw:ctx_lore=1"]', 900);
    S.note('붙일 것 칩', await S.fe(() => [...document.querySelectorAll('.gw [data-action="adv-set"][data-value^="nw:ctx_"]')].map((e) => e.dataset.value + ' ' + e.getAttribute('aria-pressed'))));
    tr = await S.turn(`${title} 쪽을 살핀다.`, { settle: 4000 });
    const wb = mainCtx(tr.main[0], 'wiki');
    st.req('본편_위키덩어리', tr.main[0]);
    st.check(/K9-WIKI-BODY/.test(wb), { block: !!wb, body: /K9-WIKI-BODY/.test(wb), len: wb.length, ss: (await S.ss()).$nw_context });

    // ── ⑤ 다시 ──
    st = step('커스텀 임무(다시, 고른 뒤 3초 기다림 — 잠금 효과 1.5초): 목표 하나를 열고 고른 뒤 화면(편성 단계 머리)과 실제 나간 요청의 Subject 가 같은가 — 단계마다 캡처', '고른 이름 = 편성 화면 이름 = Subject', '패널 임무 탭 / field.ts mission-open·mission-pick·mission-send');
    await S.winClose(); await S.winOpen();
    await S.click('.gx [data-action="tab"][data-value="map"]', 700);
    await S.click('.gx [data-action="tab"][data-value="mission"]', 900);
    await st.shot('임무_목록');
    const list = await S.fe(() => [...document.querySelectorAll('[data-action="mission-open"]')].map((e) => ({ v: e.dataset.value, txt: e.textContent.trim().slice(0, 30), vis: !!e.offsetParent })));
    S.note('목록(열기 단추)', list.slice(0, 8));
    const target = process.env.K9B_TARGET || (list.find((x) => x.vis && /^an:/.test(x.v))?.v ?? list[0]?.v);
    await S.click(`[data-action="mission-open"][data-value="${target}"]`, 800);
    await st.shot('임무_열기');
    const picks = await S.fe((v) => [...document.querySelectorAll(`[data-action="mission-pick"]`)].map((e) => ({ v: e.dataset.value, vis: !!e.offsetParent })), target);
    S.note('고르기 단추들', picks.slice(0, 8));
    await S.click(`[data-action="mission-pick"][data-value="${target}"]`, 300);
    await st.shot('임무_고름_0.3초');
    await sleep(2700);
    await st.shot('임무_고름');
    const team = await S.fe(() => document.querySelector('[data-action="mission-send"]')?.closest('.gx-team, section, .gx-panel, div')?.innerText.replace(/\s+/g, ' ').slice(0, 200) ?? null);
    const s1 = await S.seq();
    await S.click('[data-action="mission-send"]', 1500);
    const notice = await S.fe(() => [...document.querySelectorAll('.gx-notice, .gx-err, [role="alert"], .gx-toast')].map((e) => e.textContent.trim()).filter(Boolean).join(' / ') || null).catch(() => null);
    await st.shot('임무_보냄');
    await t.waitBusy(6000).catch(() => {}); await t.waitIdle().catch(() => {}); await sleep(2500);
    const mreq = (await S.log(s1)).find((r) => r.route === 'main');
    const subject = (flat(mreq ?? {}).match(/Subject: ([^\n]+)/) ?? [])[1] ?? null;
    st.req('임무_본편', mreq);
    st.check(!!subject && target.endsWith(subject.trim()), { target, team, notice, subject });

  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K9_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 30));
    await S.close();
  }
}
