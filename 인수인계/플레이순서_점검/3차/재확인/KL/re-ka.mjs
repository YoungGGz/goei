// 재확인 KL — T2 한 세션: R48(Router ROLE·RULES 비움) · R51(지침 머리 기본값/고침) · R49(이미지 임의 추가 겹침) · R61(켬끔 aria-label) · R62(점검 안내가 실패 기록에 남음)
// FAKE_URL=http://192.0.2.2:9590 RISU_URL=http://127.0.0.1:5980 node re-ka.mjs
import { session, sleep, flat } from './lib.mjs';
import { readFileSync } from 'node:fs';

const ROUTER = readFileSync(new URL('../../../../../지침/Router.txt', import.meta.url), 'utf8');
const sec = (n) => ROUTER.match(new RegExp(`@@SECTION ${n}\\n([\\s\\S]*?)\\n@@END`))[1].trim();
const roleDef = sec('ROLE'), rulesDef = sec('RULES');
const line = (s) => s.split('\n').find((l) => l.trim().length > 30).trim();
const roleLine = line(roleDef), rulesLine = line(rulesDef);

const S = await session('reKA');
const { t, step } = S;
const fields = (g) => S.fe((g) => [...document.querySelectorAll('.gw textarea[data-input="ed-guide-sec"]')].filter((e) => e.dataset.key.startsWith(g + '|')).map((e) => {
  const box = e.closest('.gw-field');
  const title = box.querySelector('.gw-gtitle')?.value ?? box.querySelector('.gw-field-head b')?.textContent ?? '';
  return { key: e.dataset.key, title: title.trim(), len: e.value.trim().length, label: box.querySelector('.gw-ftok')?.textContent ?? '' };
}), g);
const head = () => S.fe(() => document.querySelector('.gw .gw-head small')?.textContent ?? '');
const typeSec = async (key, value) => { await S.setVal(`.gw textarea[data-input="ed-guide-sec"][data-key="${key}"]`, value, 'input', 200); await sleep(1300); };
const routerOf = (tr) => tr.aux.find((r) => /"input":/.test(r.lastUser ?? '') && /Select participants|# Router|Rules:/.test(flat(r)));
try {
  await S.fakeReset();
  await t.setup();
  await S.loadState('S-관리국-3턴.json');

  // 기준: 아무것도 안 고친 채 한 턴 → Router 요청에 ROLE·RULES 기본 첫 줄 둘 다 있어야 비교가 선다
  let st = step('기준 턴: 고치지 않은 Router 요청', 'ROLE·RULES 기본 첫 줄 둘 다', '대조용');
  let tr = await S.turn('주위를 둘러본다.');
  let r0 = routerOf(tr);
  st.req('Router_기준', r0);
  st.check(!!r0 && flat(r0).includes(roleLine) && flat(r0).includes(rulesLine), { router: !!r0, role: r0 && flat(r0).includes(roleLine), rules: r0 && flat(r0).includes(rulesLine) });

  // R51: 치는 동안 머리 표시
  st = step('R51 RP 지침 절 끝에 표식을 치고 1.3초 (같은 페이지) → 머리 표시', '저장은 바로, 머리는 「고침」이어야 맞음', 'K-12');
  await S.ed('guide:RP');
  const h0 = await head();
  const f0 = await fields('RP');
  const k0 = f0[0].key;
  const v0 = await S.fe((k) => document.querySelector(`.gw textarea[data-key="${k}"]`).value, k0);
  await typeSec(k0, v0.replace(/\s+$/, '') + '\n- RE-KL-MARK');
  const h1 = await head();
  const saved = /RE-KL-MARK/.test((await S.prefs())?.guides?.RP ?? '');
  await st.shot('R51_치는중');
  await S.ed('guide:Tag'); await S.ed('guide:RP');
  const h2 = await head();
  st.check(/고침/.test(h1), { head0: h0, headTyping: h1, saved, headAfterReopen: h2 });
  await typeSec(k0, v0); // 되돌림

  // R48: ROLE 비움
  st = step('R48 Router ROLE 비움 → 칸 표시와 Router 요청', '표시 「비우면 기본 글이 쓰여요」 이면 요청에 ROLE 기본 글이 있어야 함', 'K-12, core/guides.ts:204');
  await S.ed('guide:Router');
  let fr = await fields('Router');
  await typeSec(fr.find((f) => f.title === 'ROLE').key, '');
  await S.ed('guide:Tag'); await S.ed('guide:Router');
  const roleLab = (await fields('Router')).find((f) => f.title === 'ROLE')?.label;
  await st.shot('R48_ROLE비움');
  tr = await S.turn('잼트리에게 말을 건다.');
  const r1 = routerOf(tr) ?? tr.aux.find((r) => /"catalog"/.test(r.lastUser ?? ''));
  st.req('Router_ROLE비움', r1);
  st.check(!!r1 && flat(r1).includes(roleLine), { label: roleLab, router: !!r1, roleIn: r1 ? flat(r1).includes(roleLine) : null, rulesIn: r1 ? flat(r1).includes(rulesLine) : null, sysHead: r1 ? String(r1.body.messages[0].content).slice(0, 100) : null, auxHeads: tr.aux.map((r) => String(r.body?.messages?.[0]?.content ?? '').slice(0, 50)), errs: t.errors.filter((e) => /Router/.test(e)).slice(-3) });

  st = step('R48 ROLE 되돌리고 RULES 비움', '요청에 RULES 기본 글', 'K-12');
  await S.ed('guide:Router');
  fr = await fields('Router');
  await typeSec(fr.find((f) => f.title === 'ROLE').key, roleDef);
  await typeSec(fr.find((f) => f.title === 'RULES').key, '');
  await S.ed('guide:Tag'); await S.ed('guide:Router');
  const rulesLab = (await fields('Router')).find((f) => f.title === 'RULES')?.label;
  tr = await S.turn('잼트리를 다시 부른다.');
  const r2 = routerOf(tr);
  st.req('Router_RULES비움', r2);
  st.check(!!r2 && flat(r2).includes(rulesLine), { label: rulesLab, router: !!r2, rulesIn: r2 ? flat(r2).includes(rulesLine) : null, roleIn: r2 ? flat(r2).includes(roleLine) : null });
  await S.ed('guide:Router');
  fr = await fields('Router');
  await typeSec(fr.find((f) => f.title === 'RULES').key, rulesDef);

  // R49: 이미지 임의 추가에 명부 이름
  st = step('R49 이미지(메인 모델) 임의 추가 「Jyaldi」(명부에 있음)', '「이미 목록에 있어요」, prefs.imgNamesExtra 에 안 들어감', 'src/ui/imgprompt.ts:87-91 주석');
  await S.ed('guide:Image');
  const extraBefore = (await S.prefs())?.imgNamesExtra ?? [];
  const names = await S.fe(() => [...document.querySelectorAll('.gw input[data-change="ip-toggle"]')].map((e) => e.dataset.key));
  await S.setVal('.gw input[data-input="ip-extra"]', 'Jyaldi', 'input', 300);
  await S.click('.gw [data-action="ip-extra-add"]', 1200);
  const msg = await S.fe(() => [...document.querySelectorAll('.gw .gx-err, .gw .gx-hint')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3));
  const extraAfter = (await S.prefs())?.imgNamesExtra ?? [];
  const delBtns = await S.fe(() => [...document.querySelectorAll('.gw [data-action="ip-extra-del"]')].map((e) => e.dataset.value ?? e.dataset.key ?? e.textContent));
  const jyRows = await S.fe(() => [...document.querySelectorAll('.gw .gw-page *')].filter((e) => e.children.length === 0 && /^Jyaldi$/.test(e.textContent.trim())).length);
  await st.shot('R49_임의추가');
  st.check(!extraAfter.includes('Jyaldi') && msg.some((m) => /이미 목록/.test(m)), { inRoster: names.includes('Jyaldi'), extraBefore, extraAfter, msg, delBtns, jyaldiTextCells: jyRows });

  // R61: 켬끔 aria-label
  st = step('R61 설정 → 화면 → 「호출 진행 창」 켬끔 단추 aria-label', '「호출 진행 창」', '화면 읽기');
  await S.ed('set:screen');
  const labs = await S.fe(() => [...document.querySelectorAll('.gw button.gx-switch[role="switch"]')].map((b) => b.getAttribute('aria-label')));
  const rowHtml = await S.fe(() => { const b = [...document.querySelectorAll('.gw button.gx-switch[role="switch"]')].find((x) => /호출 진행/.test(x.getAttribute('aria-label') ?? '')); return b?.closest('.ps-row')?.querySelector('.ps-label')?.outerHTML?.slice(0, 300) ?? null; });
  st.check(labs.includes('호출 진행 창'), { labels: labs, rowLabelHtml: rowHtml });

  // R62: 에셋용 사본 → 실패 기록
  st = step('R62 점검 → 저장·불러오기 → 에셋용 사본 넣기·빼기 → 실패 기록 페이지', '실패 기록 페이지엔 앞 안내 없음', 'manage.ts');
  await S.ed('manage:backup');
  await S.tryClick('.gw [data-action="man-asset-put"]:not([disabled])', 1500);
  const i1 = await S.fe(() => document.querySelector('.gw .gw-head .gx-hint')?.textContent ?? null);
  await S.tryClick('.gw [data-action="man-asset-drop"]:not([disabled])', 1500);
  const i2 = await S.fe(() => document.querySelector('.gw .gw-head .gx-hint')?.textContent ?? null);
  await S.ed('manage:log');
  const i3 = await S.fe(() => ({ title: document.querySelector('.gw .gw-head h2')?.textContent ?? null, hint: document.querySelector('.gw .gw-head .gx-hint')?.textContent ?? null }));
  await st.shot('R62_실패기록');
  st.check(!i3.hint, { afterPut: i1, afterDrop: i2, logPage: i3 });
} catch (e) {
  S.note('예외', String(e?.stack ?? e));
  await t.shot('reKA_예외').catch(() => {});
} finally {
  await S.close();
  process.exit(0);
}
