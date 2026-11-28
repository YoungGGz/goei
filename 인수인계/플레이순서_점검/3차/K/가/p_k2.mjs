// K2 지침 탭: 고침 → 다음 요청에 바로 → 「비우면 기본 글이 쓰여요」 → 기본값 되돌리기(초기화) → (저장 실패는 t1.mjs)
// + 공통 갈래: 다시 굴리기·새로고침·다른 채팅 다녀오기 뒤에도 고친 지침이 쓰이는지
import { session, sleep, flat } from './lib.mjs';
import { readFileSync } from 'node:fs';

const RP = readFileSync(new URL('../../../../../지침/RP지침.txt', import.meta.url), 'utf8');
const ROUTER = readFileSync(new URL('../../../../../지침/Router.txt', import.meta.url), 'utf8');
const routerRole = ROUTER.match(/@@SECTION ROLE\n([\s\S]*?)\n@@END/)[1].trim();
const routerRoleLine = routerRole.split('\n').find((l) => l.trim().length > 30).trim();

export async function k2() {
  const S = await session('K2');
  const { t, step } = S;
  /** 지침 페이지의 절 목록 [{i, title, len, label}] */
  const fields = (g) => S.fe((g) => [...document.querySelectorAll(`.gw textarea[data-input="ed-guide-sec"]`)].filter((e) => e.dataset.key.startsWith(g + '|')).map((e) => {
    const box = e.closest('.gw-field');
    const title = box.querySelector('.gw-gtitle')?.value ?? box.querySelector('.gw-field-head b')?.textContent ?? '';
    return { key: e.dataset.key, title: title.trim(), len: e.value.trim().length, label: box.querySelector('.gw-ftok')?.textContent ?? '', head: e.value.trim().split('\n')[0].slice(0, 80) };
  }), g);
  const head = () => S.fe(() => document.querySelector('.gw .gw-head small')?.textContent ?? '');
  const typeSec = async (key, value) => { await S.setVal(`.gw textarea[data-input="ed-guide-sec"][data-key="${key}"]`, value, 'input', 200); await sleep(1300); };
  const secVal = (key) => S.fe((k) => document.querySelector(`.gw textarea[data-input="ed-guide-sec"][data-key="${k}"]`)?.value ?? null, key);
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    let st = step('지침 탭 → RP 지침 「Play Principles」 절 끝에 표식 글 → 손을 떼면 바로 저장(prefs.guides.RP), 머리 「고침」', 'prefs.guides.RP 에 표식, 머리 small 에 「고침」', 'K-01·공-15 (사용자 결정: 지침은 설정 「지침」 메뉴, 바로 저장)');
    await S.ed('guide:RP');
    const f0 = await fields('RP');
    const head0 = await head();
    const pp = f0.find((f) => /Play Principles/.test(f.title));
    const kd = f0.find((f) => /Knowledge and Disclosure/.test(f.title));
    const ppBody = await secVal(pp.key);
    await typeSec(pp.key, ppBody.replace(/\s+$/, '') + '\n- K2-MARK-RP-ALPHA: 표식 글.');
    let pr = await S.prefs();
    const head1 = await head();
    await S.ed('guide:Tag');
    await S.ed('guide:RP');
    const head1b = await head();
    await st.shot('RP_고침');
    st.check(/K2-MARK-RP-ALPHA/.test(pr?.guides?.RP ?? '') && /고침/.test(head1b) && /기본값/.test(head0), { head0, head1_typing: head1, head1_reopen: head1b, saved: /K2-MARK-RP-ALPHA/.test(pr?.guides?.RP ?? ''), sections: f0.length });
    if (!/고침/.test(head1)) S.note('치는 중에는 머리 「기본값」 그대로, 다른 페이지 갔다 오면 「고침」', { head1, head1b });

    st = step('다음 본편 요청에 고친 RP 글이 바로 들어감', '본편 요청에 K2-MARK-RP-ALPHA', 'guides.ts guidePrompt (Claude 판정: 고친 글 = 기기 설정)');
    let tr = await S.turn('주위를 둘러본다.');
    st.req('본편_RP고침', tr.main[0]);
    st.check(tr.main.length === 1 && /K2-MARK-RP-ALPHA/.test(flat(tr.main[0])), { main: tr.main.length, mark: /K2-MARK-RP-ALPHA/.test(flat(tr.main[0])), aux: tr.aux.map((r) => String(r.body?.messages?.[0]?.content ?? '').slice(0, 40)) });

    st = step('기본 글을 안 쓰는 절(RP Knowledge and Disclosure)을 비움 → 표시 없음, 요청에서 정말로 빠짐', '그 절 칸 표시 「」(비우면 기본 글 표시 없음), 다음 본편에 그 절 첫 줄 없음', 'K-12 (Claude 판정: 표시는 실제로 기본 글을 쓰는 절에만)');
    const kdBody = await secVal(kd.key);
    const kdLine = kdBody.split('\n').find((l) => l.trim().length > 30).trim();
    await typeSec(kd.key, '');
    await S.click(`.gw [data-action="ed-node"][data-value="guide:Router"]`, 600).catch(() => {});
    await S.ed('guide:RP');
    const f1 = await fields('RP');
    const kd1 = f1.find((f) => f.key === kd.key) ?? f1.find((f) => /Knowledge/.test(f.title));
    tr = await S.turn('서류를 집어 든다.');
    st.req('본편_RP절비움', tr.main[0]);
    st.check(kd1 && kd1.len === 0 && !/비우면/.test(kd1.label) && !flat(tr.main[0]).includes(kdLine) && RP.includes(kdLine), { label: kd1?.label, len: kd1?.len, lineGone: !flat(tr.main[0]).includes(kdLine), line: kdLine.slice(0, 60) });

    st = step('기본 글을 쓰는 절(Router ROLE·괴담톡 MAIN_CONTEXT.VIEWS)을 비움 → 「비우면 기본 글이 쓰여요」 표시, Router 요청엔 ROLE 기본 글이 그대로 (0.21.34 에서 붙인 절)', '두 절 칸 표시 「비우면 기본 글이 쓰여요」, Router 보조 요청에 ROLE 기본 첫 줄', 'K-12 / 업데이트내역 v0.21.34 「비워도 기본 글이 쓰이는 지침 칸에 표시」');
    await S.ed('guide:Router');
    const fr = await fields('Router');
    const role = fr.find((f) => f.title === 'ROLE');
    await typeSec(role.key, '');
    await S.ed('guide:Phone');
    const fp = await fields('Phone');
    const views = fp.find((f) => f.title === 'MAIN_CONTEXT.VIEWS');
    await typeSec(views.key, '');
    await S.ed('guide:Router');
    const role2 = (await fields('Router')).find((f) => f.title === 'ROLE');
    await st.shot('Router_ROLE비움');
    await S.ed('guide:Phone');
    const views2 = (await fields('Phone')).find((f) => f.title === 'MAIN_CONTEXT.VIEWS');
    tr = await S.turn('잼트리에게 말을 건다.');
    const router = tr.aux.find((r) => /"input":/.test(r.lastUser ?? '') && /Select participants|# Router/.test(flat(r)));
    st.req('Router_ROLE비움', router);
    pr = await S.prefs();
    st.check(/비우면 기본 글이 쓰여요/.test(role2?.label ?? '') && /비우면 기본 글이 쓰여요/.test(views2?.label ?? '') && !!router && flat(router).includes(routerRoleLine), { roleLabel: role2?.label, viewsLabel: views2?.label, routerCalled: !!router, roleDefaultInRequest: router ? flat(router).includes(routerRoleLine) : null, routerSystemHead: router ? String(router.body.messages[0].content).slice(0, 120) : null, savedRouterGuide: typeof pr?.guides?.Router === 'string' });
    // 같은 자리: RULES 만 비우면? (ROLE 되돌리고)
    if (router && !flat(router).includes(routerRoleLine)) {
      const st2 = step('(덧) Router RULES 만 비우고 ROLE 은 되돌림 → Router 요청에 RULES 기본 글이 쓰이나', 'RULES 칸 표시 「비우면 기본 글이 쓰여요」, Router 요청에 RULES 기본 첫 줄', 'K-12');
      await S.ed('guide:Router');
      const fr2 = await fields('Router');
      await typeSec(fr2.find((f) => f.title === 'ROLE').key, routerRole);
      const rulesKey = fr2.find((f) => f.title === 'RULES').key;
      const rulesDef = ROUTER.match(/@@SECTION RULES\n([\s\S]*?)\n@@END/)[1].trim();
      const rulesLine = rulesDef.split('\n').find((l) => l.trim().length > 30).trim();
      await typeSec(rulesKey, '');
      await S.ed('guide:Phone'); await S.ed('guide:Router');
      const rl = (await fields('Router')).find((f) => f.title === 'RULES');
      const tr2 = await S.turn('잼트리를 다시 부른다.');
      const r2 = tr2.aux.find((r) => /"input":/.test(r.lastUser ?? '') && /Select participants|# Router/.test(flat(r)));
      st2.req('Router_RULES비움', r2);
      st2.check(/비우면/.test(rl?.label ?? '') && !!r2 && flat(r2).includes(rulesLine), { label: rl?.label, routerCalled: !!r2, rulesDefaultInRequest: r2 ? flat(r2).includes(rulesLine) : null, roleIn: r2 ? flat(r2).includes(routerRoleLine) : null });
      await typeSec(rulesKey, rulesDef);
    }

    st = step('고친 뒤 다시 굴리기 → 다시 굴린 본편 요청도 고친 RP 글(표식 BETA 로 바꿈)', '다시 굴린 본편 요청에 BETA, ALPHA 없음', '공통 갈래 「다시 굴리기」, guidePrompt 매 요청 읽음');
    await S.ed('guide:RP');
    const ppNow = await secVal(pp.key);
    await typeSec(pp.key, ppNow.replace('K2-MARK-RP-ALPHA', 'K2-MARK-RP-BETA'));
    await S.winClose();
    let s0 = await S.seq();
    await t.reroll();
    await sleep(2500);
    let l = await S.log(s0);
    const rr = l.find((r) => r.route === 'main');
    st.req('다시굴림_본편', rr);
    st.check(!!rr && /K2-MARK-RP-BETA/.test(flat(rr)) && !/K2-MARK-RP-ALPHA/.test(flat(rr)), { main: l.filter((r) => r.route === 'main').length, beta: rr ? /BETA/.test(flat(rr)) : null });

    st = step('새로고침(저장 끝난 뒤) → 고친 지침이 남아 다음 본편에 BETA', '새로고침 뒤 본편 요청에 BETA, 머리 「고침」', '공통 갈래 「새로고침」');
    await t.reload();
    await sleep(2000);
    tr = await S.turn('창밖을 본다.');
    st.req('새로고침뒤_본편', tr.main[0]);
    await S.ed('guide:RP');
    const head2 = await head();
    st.check(/K2-MARK-RP-BETA/.test(flat(tr.main[0])) && /고침/.test(head2), { beta: /BETA/.test(flat(tr.main[0])), head: head2 });

    st = step('다른 채팅(새 채팅·인물 장면)에서도 같은 고친 지침(이 기기 공통)', '다른 채팅 첫 본편 요청에 BETA', 'guides.ts 「이 기기 공통」 표시 (Claude 판정)');
    await S.winClose();
    await t.newChat(); await sleep(1500);
    await t.startPanel({ fac: 'A00', player: '', scene: '면접' }); await sleep(2500);
    tr = await S.turn('인사한다.');
    st.check(/K2-MARK-RP-BETA/.test(flat(tr.main[0])), { beta: /BETA/.test(flat(tr.main[0])) });
    await S.winClose();
    await t.switchChat(1); await sleep(1500);

    st = step('기본값 되돌리기: 점검 → 저장·불러오기 「초기화」(확인 팝업) → 고친 지침 전부 버림, 머리 「기본값」, 다음 본편에 표식 없음·비웠던 절 돌아옴, 되돌리기 띠는 「지침은 되돌아오지 않아요」', 'prefs.guides 없음, RP 머리 「기본값」, 본편에 BETA 없음·Knowledge 첫 줄 있음', 'K-01 (사용자 결정: 기본값 저장·불러오기·초기화는 점검 한 곳, 확인 팝업), settings.ts CONFIRM.reset 글');
    await S.ed('manage:backup');
    await S.click('.gw [data-action="set-bar"][data-value="reset"]', 700);
    const popTxt = await S.fe(() => document.querySelector('.gw-confirm p')?.textContent ?? null);
    await S.click('.gw-confirm [data-action="set-bar-yes"][data-value="reset"]', 1500);
    const undoTxt = await S.fe(() => document.querySelector('.gw .st-undobar p')?.textContent ?? null);
    pr = await S.prefs();
    await S.ed('guide:RP');
    const head3 = await head();
    tr = await S.turn('숨을 고른다.');
    st.req('초기화뒤_본편', tr.main[0]);
    st.check(!pr?.guides && /기본값/.test(head3) && !/K2-MARK/.test(flat(tr.main[0])) && flat(tr.main[0]).includes(kdLine), { popup: popTxt?.slice(0, 80), undo: undoTxt?.slice(0, 80), guides: pr?.guides ? Object.keys(pr.guides) : null, head: head3, markGone: !/K2-MARK/.test(flat(tr.main[0])), kdBack: flat(tr.main[0]).includes(kdLine) });

    st = step('지침 글을 손으로 기본 글과 똑같이 되돌리면 「고침」이 아니라 「기본값」(저장값 지움)', '표식 넣었다가 지우면 prefs.guides.RP 없음, 머리 「기본값」', 'ui/editor/guides.ts ed-guide-save isDefault (Claude 판정)');
    await S.ed('guide:RP');
    const pp3 = await secVal(pp.key);
    await typeSec(pp.key, pp3 + '\nX');
    const mid = (await S.prefs())?.guides?.RP ? 'saved' : 'none';
    await typeSec(pp.key, pp3);
    pr = await S.prefs();
    await S.ed('guide:Tag');
    await S.ed('guide:RP');
    st.check(mid === 'saved' && !pr?.guides?.RP && /기본값/.test(await head()), { mid, after: pr?.guides?.RP ? 'saved' : 'none', head: await head() });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K2_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 30));
    await S.close();
  }
}
