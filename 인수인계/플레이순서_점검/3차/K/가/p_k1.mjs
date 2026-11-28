// K1 범위 둘(이 채팅 / 새 채팅 기본값), 시작 전 범위. 시작 상태 S-start, 시작 뒤는 같은 채팅을 이어서.
import { session, sleep } from './lib.mjs';

const nr = (v) => (v === undefined || v === null || v === '' ? '1(기본)' : String(v));
export async function k1() {
  const S = await session('K1');
  const { t, step } = S;
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-start.json');
    const p0 = await S.prefs();
    S.note('시작 prefs', p0);

    // 1. 시작 패널 → 「새 채팅 기본 설정」 → 생성 공통
    let st = step('시작 전: 생성 공통 「형식 오류 재시도」 + → 새 채팅 기본값(prefs.vars)에만, 이 채팅 변수는 그대로. 범위 표시 「새 채팅 기본값 (시작 전)」', 'prefs.vars.$gen_retries=2, chat.$gen_retries 없음, 줄 표시 「새 채팅 기본값 (시작 전)」', 'K-01 (사용자 결정 바로 저장) / app.ts:1040 시작 전 gen=defaults (Claude 판정)');
    await S.winOpen();
    await S.click('[data-action="prefs-open"]', 1200);
    await S.ed('set:adv');
    const badge = await S.fe(() => [...document.querySelectorAll('.gw .gx-scope')].map((e) => e.textContent.trim())[0] ?? null);
    await S.click('.gw [data-action="adv-set"][data-value="gen:retries=2"]', 900);
    let pr = await S.prefs(); let ss = await S.ss();
    await st.shot('시작전_생성공통');
    st.check(pr?.vars?.$gen_retries === '2' && ss.$gen_retries === undefined && /새 채팅 기본값/.test(badge ?? ''), { badge, prefsRetries: pr?.vars?.$gen_retries, chatRetries: ss.$gen_retries ?? null });

    st = step('시작 전: 캐릭터 이미지 「모델」 보조 → prefs.basic 에만', 'prefs.basic.assetModel=aux (또는 같은 뜻), chat 변수 없음', 'K-01, K-15(범위 칩 없음)');
    await S.ed('set:image');
    const imgActs = await S.fe(() => [...document.querySelectorAll('.gw [data-action]')].map((e) => e.dataset.action + ':' + (e.dataset.value ?? '')).filter((a) => /asset/.test(a)));
    S.note('이미지 페이지 단추', imgActs);
    await S.click('.gw [data-action="set-asset-model"][data-value="aux"]', 900);
    pr = await S.prefs(); ss = await S.ss();
    st.check(JSON.stringify(pr?.basic ?? {}).includes('aux') && !Object.keys(ss).some((k) => /asset/.test(k)), { basic: pr?.basic, chatAssetKeys: Object.keys(ss).filter((k) => /asset/.test(k)) });

    st = step('시작 전: 기능 페이지(괴담톡) 생성 방식 「생각 단계」 속으로만 → 이 채팅 변수에 (페이지 안내 「이 채팅에 그대로 적용」)', 'chat.$ph_adv_thoughts(같은 뜻 열쇠)=inner, prefs.vars 에는 없음', 'app.ts:1034-1040 주석 (Claude 판정, 2026-10-28 QC)');
    await S.ed('set:phone');
    const phThought = await S.fe(() => [...document.querySelectorAll('.gw [data-action="adv-set"]')].map((e) => e.dataset.value).filter((v) => /thoughts/.test(v)));
    S.note('괴담톡 생각 단계 단추', phThought);
    const innerV = phThought.find((v) => /=inner/.test(v));
    if (innerV) await S.click(`.gw [data-action="adv-set"][data-value="${innerV}"]`, 900);
    pr = await S.prefs(); ss = await S.ss();
    const phKeys = Object.entries(ss).filter(([k]) => /thought/.test(k));
    const prKeys = Object.entries(pr?.vars ?? {}).filter(([k]) => /thought/.test(k));
    st.check(phKeys.some(([, v]) => v === 'inner') && !prKeys.length, { chat: phKeys, prefs: prKeys, hint: await S.fe(() => document.querySelector('.gw .st-prehint, .gw .gx-hint')?.textContent?.slice(0, 120) ?? null) });

    // 2. 출발
    st = step('출발(관리국 · 인물 장면 면접) → 이 채팅에 새 채팅 기본값이 적힘', 'chat.$gen_retries=2, 이미지 모델 aux, 괴담톡 생각 inner 유지', 'app.ts:1517 「새 채팅 기본값을 이 채팅에 적어 둔다」(Claude 판정)');
    await S.winClose();
    await t.startPanel({ fac: 'A00', player: '', scene: '면접' });
    await sleep(2500);
    ss = await S.ss();
    st.check(ss.$gen_retries === '2' && /aux/.test(String(ss.$st_asset_model ?? '')) && Object.entries(ss).some(([k, v]) => /thought/.test(k) && v === 'inner'), { gen_retries: ss.$gen_retries, asset_model: ss.$st_asset_model, thoughts: Object.entries(ss).filter(([k]) => /thought/.test(k)), msgs: (await t.chatState()).message.length });

    // 3. 출발 직후·첫 전송 전 (staged)
    st = step('출발 직후 첫 전송 전에 설정 창: 범위 표시와 바꾼 값이 어디로 가나 (생성 공통 재시도 2→3)', '실제 동작을 적음 — 결정: 범위 칩 없음(K-15), 판정은 Claude', 'K-15 (Claude 판정), 2차 13 Q1');
    await S.winOpen();
    const view0 = await S.fe(() => ({ head: document.querySelector('.gx-head, header')?.textContent?.replace(/\s+/g, ' ').slice(0, 80) ?? null, acts: [...document.querySelectorAll('[data-action]')].map((e) => e.dataset.action).filter((a) => /prefs|ed-open/.test(a)) }));
    if (!(await S.tryClick('[data-action="prefs-open"]', 1200))) await S.tryClick('[data-action="ed-open"]', 1200);
    await S.ed('set:adv');
    const badge2 = await S.fe(() => [...document.querySelectorAll('.gw .gx-scope')].map((e) => e.textContent.trim())[0] ?? null);
    await S.click('.gw [data-action="adv-set"][data-value="gen:retries=3"]', 900);
    await S.ed('set:image');
    await S.tryClick('.gw [data-action="set-asset-model"][data-value="main"]', 900);
    pr = await S.prefs(); ss = await S.ss();
    await st.shot('출발직후_생성공통');
    const stagedRes = { view0, badge: badge2, prefsRetries: pr?.vars?.$gen_retries, chatRetries: ss.$gen_retries, prefsBasic: pr?.basic, chatAssetModel: ss.$st_asset_model };
    st.check(true, stagedRes);

    st = step('첫 전송 → 본편 요청에 보이는 값 (이미지 모델이 메인이면 이미지 지침이 본편 끝에, 보조면 없음)', '실제 동작을 적음 (위 단계 결과대로 이 채팅 값이 쓰이는지)', 'K-15, L1');
    const tr = await S.turn('면접관에게 인사한다.');
    const m = tr.main[0];
    st.req('첫전송_본편', m);
    const hasImg = /## Inserting Character Visual Images/.test(JSON.stringify(m?.body ?? ''));
    const auxImg = tr.aux.filter((r) => /image tag|이미지|<img=/i.test(JSON.stringify(r.body?.messages?.[0] ?? '')));
    st.check(true, { chatAssetModel: (await S.ss()).$st_asset_model, mainHasImageGuide: hasImg, auxCalls: tr.aux.map((r) => String(r.body?.messages?.[0]?.content ?? '').slice(0, 60)), auxImgCalls: auxImg.length });

    // 4. 시작 뒤: 이 채팅 범위
    st = step('시작 뒤 생성 공통 「형식 오류 재시도」 − 두 번(2→0 안 함) → 이 채팅 변수만, prefs 그대로. 표시 「이 채팅」', 'chat.$gen_retries 바뀜(1=기본이라 빈 값으로 적힐 수 있음), prefs.vars.$gen_retries 그대로, 줄에 범위 표시 없음(시작 뒤엔 이 채팅 하나)', 'K-01, settings.ts v0.16.23 주석 「설정은 하나(지금 채팅)」(사용자 설계)');
    const prBefore = (await S.prefs())?.vars?.$gen_retries;
    await S.ed('set:adv');
    const badge3 = await S.fe(() => [...document.querySelectorAll('.gw .gx-scope')].map((e) => e.textContent.trim())[0] ?? null);
    const curR = Number((await S.ss()).$gen_retries ?? 1);
    const advVals = await S.fe(() => [...document.querySelectorAll('.gw [data-action="adv-set"]')].map((e) => e.dataset.value).filter((v) => /retries/.test(v)));
    S.note('시작 뒤 생성 공통 재시도 단추', { advVals, curR, scopeBadge: badge3 });
    await S.click(`.gw [data-action="adv-set"][data-value="gen:retries=${curR - 1}"]`, 900);
    if (curR - 1 > 0) await S.click(`.gw [data-action="adv-set"][data-value="gen:retries=${curR - 2}"]`, 900);
    pr = await S.prefs(); ss = await S.ss();
    st.check(nr(ss.$gen_retries) === nr(String(Math.max(0, curR - 2))) && pr?.vars?.$gen_retries === prBefore && !badge3, { badge: badge3, chat: nr(ss.$gen_retries), prefsBefore: prBefore, prefsAfter: pr?.vars?.$gen_retries });

    st = step('새 채팅을 만들어 출발 → 새 채팅은 prefs 값(앞 채팅에서 바꾼 값 아님)', '새 채팅 $gen_retries = prefs 값', 'K-01');
    await S.winClose();
    await t.newChat(); await sleep(1500);
    await t.startPanel({ fac: 'A00', player: '', scene: '면접' }); await sleep(2500);
    ss = await S.ss(); pr = await S.prefs();
    st.check(nr(ss.$gen_retries) === nr(pr?.vars?.$gen_retries), { newChat: nr(ss.$gen_retries), prefs: nr(pr?.vars?.$gen_retries) });

    st = step('앞 채팅으로 돌아가 「기본값으로 저장」(점검 → 저장·불러오기, 확인 팝업) → prefs 가 그 채팅 값, 그다음 새 채팅이 그 값', 'prefs.vars.$gen_retries = 앞 채팅 값, 다음 새 채팅도 같음', 'K-01 (기본값 저장은 점검 한 곳, 확인 팝업)');
    await S.winClose();
    await t.switchChat(1); await sleep(1500);
    const oldVal = (await S.ss()).$gen_retries;
    await S.ed('manage:backup');
    await S.click('.gw [data-action="set-bar"][data-value="save"]', 700);
    const pop = await S.has('.gw-confirm [data-action="set-bar-yes"][data-value="save"]');
    await S.click('.gw-confirm [data-action="set-bar-yes"][data-value="save"]', 1200);
    pr = await S.prefs();
    await S.winClose();
    await t.newChat(); await sleep(1500);
    await t.startPanel({ fac: 'A00', player: '', scene: '면접' }); await sleep(2500);
    ss = await S.ss();
    st.check(pop && nr(pr?.vars?.$gen_retries) === nr(oldVal) && nr(ss.$gen_retries) === nr(oldVal), { popup: pop, oldChat: nr(oldVal), prefs: nr(pr?.vars?.$gen_retries), newChat2: nr(ss.$gen_retries) });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K1_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData/.test(x)).slice(0, 30));
    await S.close();
  }
}
