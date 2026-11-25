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

export async function k9() {
  const S = await session('K9');
  const { t, step } = S;
  const flowDo = async (v) => { await S.ed('manage:flow'); await S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900); };
  const mainCtx = (r, feature) => { const s = flat(r); const i = s.indexOf(`"feature":"${feature}"`); return i < 0 ? '' : s.slice(Math.max(0, s.lastIndexOf('[MODULE_CONTEXT_BEGIN]', i)), s.indexOf('[MODULE_CONTEXT_END]', i) + 20); };
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');
    await S.ed('manage:flow');
    if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await flowDo('fam-set|b:gn:joint=0');

    // ── ① 위키 문서 요청 + 규칙 자리 ──
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
    let st = step('위키 매 턴: 제목 답(대본) → 문서 요청이 나가고, 붙일 곳 「위키」 규칙이 NW.GUIDE(작성 안내) 끝 바로 뒤', '문서 요청 1건, NW.GUIDE 마지막 줄 뒤 400자 안에 K9-RULE-WIKI, 제목 요청엔 규칙 없음', '지침 탭 안내 「위키 = 작성 안내 절 끝」 / guides.ts RULE_SECTION.Wiki');
    tr = await S.turn('관리국 이야기를 다시 떠올린다.', { settle: 9000 });
    const docReq = tr.all.find((r) => flat(r).includes('in-universe encyclopedia'));
    const titleReq = tr.all.find((r) => flat(r).includes(TITLE_Q));
    const f = flat(docReq ?? {}); const i = f.indexOf(WIKI_END); const j = f.indexOf('K9-RULE-WIKI');
    st.req('위키_문서요청', docReq);
    st.check(!!docReq && i >= 0 && j > i && j - i - WIKI_END.length < 400 && !flat(titleReq ?? {}).includes('K9-RULE-WIKI'), { title, docReq: !!docReq, gap: i >= 0 && j > i ? j - i - WIKI_END.length : null, between: i >= 0 && j > i ? f.slice(i + WIKI_END.length, j) : null, ruleInTitleReq: flat(titleReq ?? {}).includes('K9-RULE-WIKI') });
    await flowDo('wiki-auto|0');

    st = step('위키 컨텍스트 포함 켬(위키 페이지) → 받은 문서가 다음 본편에 「feature":"wiki"」 덩어리로', '본편에 K9-WIKI-BODY 든 wiki 덩어리', 'body.ts moduleContext wantWiki / wiki.ts wikiContextOn($nw_context)');
    await S.ed('set:wiki');
    const wctl = await S.fe(() => [...document.querySelectorAll('.gw [data-action="wiki-context"]')].map((e) => e.dataset.value));
    S.note('위키 컨텍스트 포함 단추', wctl);
    await S.click('.gw [data-action="wiki-context"][data-value="1"]', 900);
    tr = await S.turn(`${title} 쪽을 살핀다.`, { settle: 4000 });
    const wb = mainCtx(tr.main[0], 'wiki');
    st.req('본편_위키덩어리', tr.main[0]);
    st.check(/K9-WIKI-BODY/.test(wb), { block: !!wb, body: /K9-WIKI-BODY/.test(wb), len: wb.length, ss: (await S.ss()).$nw_context });

    // ── ② 괴담톡 방 한 번 + 본편 컨텍스트 ──
    st = step('괴담톡 1:1 보내기(답은 대본 패치) → 방 기록이 생기고 다음 본편에 괴담톡 덩어리', '본편에 K9-PH-REPLY 든 phone 덩어리', 'body.ts moduleContext wantPhone / 괴담톡 컨텍스트 포함 기본 켬');
    await S.winClose(); await S.winOpen();
    await S.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]', 1200);
    const cid = await S.fe(() => document.querySelector('.ph-list [data-action="ph-dm"]')?.dataset.value ?? null);
    await S.addRules([{ id: 'k9-ph', route: 'aux', match: 'send: reply to the owner', reply: `<lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"K9-PH-REPLY 알겠어, 조심해.","sender":"${cid}","type":"text"}}]</lb-minitalk-patch>` }]);
    await S.click(`.ph-list [data-action="ph-dm"][data-value="${cid}"]`, 1000);
    await S.setVal('[data-input="ph-draft"]', 'K9-PH-ME 지금 현장 도착했어요.', 'input', 300);
    const s0 = await S.seq();
    await S.click('[data-action="ph-send"]', 4000);
    const phReq = (await S.log(s0)).filter((r) => flat(r).includes('send: reply to the owner'));
    await st.shot('괴담톡_방');
    tr = await S.turn('휴대폰을 주머니에 넣는다.', { settle: 4000 });
    const pb = mainCtx(tr.main[0], 'phone') || (flat(tr.main[0]).includes('K9-PH-REPLY') ? 'K9-PH-REPLY(덩어리 표식 다름)' : '');
    st.req('본편_괴담톡덩어리', tr.main[0]);
    st.check(phReq.length >= 1 && /K9-PH-REPLY/.test(flat(tr.main[0])), { contact: cid, phoneCalls: phReq.length, inMain: /K9-PH-REPLY/.test(flat(tr.main[0])), me: /K9-PH-ME/.test(flat(tr.main[0])), block: pb.slice(0, 120) });

    // ── ② 요청당 사진 ──
    const gnTurnWithPhotos = async (txt, n) => { await S.delRule('k9-gn'); await S.addRules([{ id: 'k9-gn', route: 'aux', match: GN, reply: REFRESH(1849000 + n, `K9 글 ${n}`) }]); return S.turn(`${photo(1)}\n${photo(2)}\n${photo(3)}\n${txt}`, { settle: 6000 }); };
    await flowDo('fam-set|b:gn:lazy=0');
    st = step('사진 세 장이 든 내 메시지 → 괴담넷 요청의 첨부 자료: 「요청당 사진」 기본 8이면 세 장 모두 실제 사진(image 1~3)', '첨부 줄 3개 모두 "image":n', 'advanced.ts image_max / attach.ts withImage (사진 기록은 플러그인 저장 꼴 %%ATTACHMENT%% 를 입력란에 직접 넣어 흉내)');
    tr = await gnTurnWithPhotos('사진을 보여 준다.', 1);
    const g1 = tr.all.find((r) => flat(r).includes(GN));
    const att = (r) => { const s = JSON.stringify(r?.body?.messages ?? []); return { real: (s.match(/\\"image\\":\d/g) ?? []).length, older: (s.match(/K9 사진 \d\\",\\"note/g) ?? []).length, mm: JSON.stringify(r?.body ?? {}).match(/"(image_url|multimodals|inlineData)"/g)?.length ?? 0 }; };
    const a1 = att(g1);
    st.req('사진8_괴담넷', g1);
    st.check(a1.real === 3, { ...a1, gn: !!g1, mainHasPhotoText: /K9 사진/.test(flat(tr.main[0])) });

    st = step('「요청당 사진」 1 → 같은 메시지에서 최근 한 장만 실제 사진, 앞 두 장은 설명 글만(ATTACH.OLDER)', '"image":1 한 줄, OLDER 두 줄', 'advanced.ts image_max 안내 「넘으면 최근 사진만 붙이고 앞의 사진은 설명 글만」');
    await S.ed('set:adv');
    await S.setVal('.gw input[data-change="adv-set"][data-key="gen:image_max"]', '1', 'change', 900);
    tr = await gnTurnWithPhotos('사진을 다시 보여 준다.', 2);
    const g2 = tr.all.find((r) => flat(r).includes(GN));
    const a2 = att(g2);
    st.req('사진1_괴담넷', g2);
    st.check(a2.real === 1 && a2.older === 2, { ...a2, saved: (await S.ss()).$gen_image_max });
    await S.ed('set:adv');
    await S.setVal('.gw input[data-change="adv-set"][data-key="gen:image_max"]', '8', 'change', 900);

    // ── ④ 기능별 토큰 상한 (괴담넷 새로고침 칸) ──
    st = step('괴담넷 「요청 토큰 상한」 기능 칸(새로고침)을 6000 → 생성 공통 0(제한 없음)이어도 새로고침 요청이 상한 안으로 줄어 나감, 넘으면 안 나감', '새로고침 요청이 앞보다 작음(또는 안 나가고 괴담넷 창에 「토큰 상한」 알림)', 'reffn.ts budget 「0이면 생성 공통 값 따름」 / famtable 넘길 양 표');
    const base = g2 ? JSON.stringify(g2.body.messages).length : 0;
    await S.ed('set:net');
    const fsel = await S.fe(() => { const e = document.querySelector('.gw input[data-key="gn:fn_refresh_budget"]'); return e ? `.gw input[data-key="gn:fn_refresh_budget"]` : null; });
    S.note('괴담넷 새로고침 토큰 상한 칸', fsel);
    if (fsel) await S.setVal(fsel, '6000', 'change', 900);
    await S.delRule('k9-gn'); await S.addRules([{ id: 'k9-gn', route: 'aux', match: GN, reply: REFRESH(1849100, 'K9 글 상한') }]);
    tr = await S.turn('게시판을 한 번 더 본다.', { settle: 6000 });
    const g3 = tr.all.find((r) => flat(r).includes(GN));
    let note3 = null;
    if (!g3) { await S.winClose(); await S.winOpen(); await S.tryClick('.gx-nav .gx-nb:not(.mob)[data-value="net"]', 800); await S.tryClick('.br-bm[data-value="gn"]', 1200); note3 = await S.fe(() => (document.querySelector('.gn')?.innerText.match(/[^\n]*토큰 상한[^\n]*/) ?? [])[0] ?? null); }
    st.req('기능상한_괴담넷', g3);
    st.check(!!fsel && (g3 ? JSON.stringify(g3.body.messages).length < base : /토큰 상한\(6,000\)/.test(note3 ?? '')), { fsel, before: base, after: g3 ? JSON.stringify(g3.body.messages).length : null, notice: note3, saved: Object.entries(await S.ss()).filter(([k]) => /fn_refresh_budget/.test(k)) });
    if (fsel) { await S.ed('set:net'); await S.setVal(fsel, '0', 'change', 900); }
    await flowDo('fam-set|b:gn:lazy=1');
    S.note('상점 토큰 상한 칸', '상점·쇼핑몰 설정에는 요청 토큰 상한 칸이 없음 (src/core/shop.ts·malls.ts 에 budget 없음, fngrid 는 gn·ph 만)');

    // ── ⑤ 커스텀 임무 목표 고르기 캡처 ──
    st = step('커스텀 임무: 목표 하나를 열고 고른 뒤 화면(편성 단계 머리)과 실제 나간 요청의 Subject 가 같은가 — 단계마다 캡처', '고른 이름 = 편성 화면 이름 = Subject', '패널 임무 탭 / field.ts mission-open·mission-pick·mission-send');
    await S.winClose(); await S.winOpen();
    await S.click('.gx [data-action="tab"][data-value="map"]', 700);
    await S.click('.gx [data-action="tab"][data-value="mission"]', 900);
    await st.shot('임무_목록');
    const list = await S.fe(() => [...document.querySelectorAll('[data-action="mission-open"]')].map((e) => ({ v: e.dataset.value, txt: e.textContent.trim().slice(0, 30), vis: !!e.offsetParent })));
    S.note('목록(열기 단추)', list.slice(0, 8));
    const target = list.find((x) => x.vis && /^an:/.test(x.v))?.v ?? list[0]?.v;
    await S.click(`[data-action="mission-open"][data-value="${target}"]`, 800);
    await st.shot('임무_열기');
    const picks = await S.fe((v) => [...document.querySelectorAll(`[data-action="mission-pick"]`)].map((e) => ({ v: e.dataset.value, vis: !!e.offsetParent })), target);
    S.note('고르기 단추들', picks.slice(0, 8));
    await S.click(`[data-action="mission-pick"][data-value="${target}"]`, 900);
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

    // ── ③ 다른 봇 채팅 (L 갈래와 같은 방법: 빈 캐릭터를 DB 에 넣고 바꿈) ──
    st = step('다른 봇 채팅으로 바꿔 보냄 → 본편 요청에 괴이의 추가 규칙·RP 지침·이미지 지침·상태창 지침이 안 붙음', '요청에 「## User Rules」·「## RP Guidance」·「## Inserting Character Visual Images」·「## Tag System Directive」 없음', '공통 갈래 「다른 봇 채팅」 / L run.mjs otherbot');
    S.note('규칙 붙일 곳(다른 봇 전)', (await S.prefs())?.rules?.[0]?.to);
    await S.winClose();
    const idx = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const stt = await import('/src/ts/stores.svelte.ts'); const c = ch.createBlankChar(); c.name = '다른봇'; c.firstMessage = '안녕.'; c.desc = 'K9-OTHER-DESC 평범한 봇.'; c.chaId = crypto.randomUUID(); c.chats = [{ message: [], note: '', name: 'Chat 1', localLore: [], fmIndex: -1, id: crypto.randomUUID() }]; stt.DBState.db.characters.push(c); return stt.DBState.db.characters.length - 1; });
    await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, idx); await sleep(3000);
    const s2 = await S.seq();
    await t.send('안녕, 다른 봇.', { wait: true }).catch((e) => S.note('보내기', String(e).slice(0, 120)));
    await sleep(3000);
    const ol = await S.log(s2);
    const om = ol.find((r) => r.route === 'main');
    const of = flat(om ?? {});
    st.req('다른봇_본편', om);
    await st.shot('다른봇');
    const marks = { userRules: of.includes('## User Rules'), rule: of.includes('K9-RULE-WIKI'), rp: of.includes('## RP Guidance'), img: of.includes('## Inserting Character Visual Images'), tag: of.includes('## Tag System Directive'), desc: of.includes('K9-OTHER-DESC') };
    st.check(!!om && marks.desc && !marks.userRules && !marks.rule && !marks.rp && !marks.img && !marks.tag, { ...marks, calls: ol.map((r) => r.route), aux: ol.filter((r) => r.route === 'aux').length });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K9_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 30));
    await S.close();
  }
}
