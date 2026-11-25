// K5 이미지 지침 페이지(지침 탭 「이미지(메인 모델)」): 틀·대상·표정 세트·추가 이름·낱말 거르기 → 본편 요청 / 보조 방식 요청
import { session, sleep, flat } from './lib.mjs';

const HEAD = '## Inserting Character Visual Images';
const charsOf = (txt) => (txt.match(/Characters \{name\}: ([^\n]*)/) ?? [])[1]?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const kwOf = (txt) => (txt.match(/Available \{keyword\}: ([^\n]*)/) ?? [])[1]?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const imgBlock = (rec) => { const f = flat(rec); const i = f.lastIndexOf(HEAD); return i >= 0 ? f.slice(i, i + 4000) : ''; };

export async function k5() {
  const S = await session('K5');
  const { t, step } = S;
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');

    let st = step('기준: 메인 방식(기본) 본편 요청 끝에 이미지 지침 한 번, 명부 영문명 목록·표정 42종', '이미지 지침 머리 1번, Characters 목록 있음, 표정 42개', 'L1 / 2차 13 「메인 모델: 첫 요청부터 이미지 지침이 맨 끝 한 번 … 표정 42종」');
    let tr = await S.turn('주위를 본다.');
    let b0 = imgBlock(tr.main[0]);
    const c0 = charsOf(b0); const k0 = kwOf(b0);
    const nHead = flat(tr.main[0]).split(HEAD).length - 1;
    st.req('기준_본편', tr.main[0]);
    st.check(nHead === 1 && c0?.length > 10 && k0?.length === 42, { nHead, chars: c0?.length, kw: k0?.length, sample: c0?.slice(0, 5) });

    st = step('틀 글칸 끝에 표식 → 손 떼면 저장(prefs.imgPrompt) → 다음 본편 이미지 지침에 표식', 'prefs.imgPrompt 에 K5-TPL-MARK, 본편에 표식', '이미지 지침 페이지 「비우면 기본 틀」·바로 저장 (사용자 2026-11-08 바로 저장)');
    await S.ed('guide:Image');
    await st.shot('이미지지침_페이지');
    const tpl = await S.fe(() => document.querySelector('.gw textarea[data-input="ip-template"]')?.value ?? '');
    await S.setVal('.gw textarea[data-input="ip-template"]', tpl.replace('### Logic Priority', '### Logic Priority\n- K5-TPL-MARK keep tags rare.'), 'input', 1400);
    let pr = await S.prefs();
    tr = await S.turn('서류를 본다.');
    st.req('틀고침_본편', tr.main[0]);
    st.check(/K5-TPL-MARK/.test(pr?.imgPrompt ?? '') && /K5-TPL-MARK/.test(imgBlock(tr.main[0])), { saved: /K5-TPL-MARK/.test(pr?.imgPrompt ?? ''), inReq: /K5-TPL-MARK/.test(imgBlock(tr.main[0])) });

    st = step('출력 대상: 명부 한 명 체크 풀기 → prefs.imgNamesOff → 본편 Characters 목록에서 빠짐', '끈 이름이 목록에 없음, 나머지는 그대로', 'imgprompt.ts imgCharacters (Claude 판정)');
    await S.ed('guide:Image');
    const names = await S.fe(() => [...document.querySelectorAll('.gw input[data-change="ip-toggle"]')].map((e) => ({ k: e.dataset.key, on: e.checked })));
    const victim = names.find((n) => n.on && n.k !== c0?.[0])?.k ?? names[1]?.k;
    await S.fe((k) => { const e = document.querySelector(`.gw input[data-change="ip-toggle"][data-key="${k}"]`); e.click(); }, victim);
    await sleep(1200);
    pr = await S.prefs();
    tr = await S.turn('복도로 나간다.');
    const c2 = charsOf(imgBlock(tr.main[0]));
    st.check((pr?.imgNamesOff ?? []).includes(victim) && !c2?.includes(victim) && c2?.length === (c0?.length ?? 0) - 1, { victim, off: pr?.imgNamesOff, n: c2?.length });

    st = step('추가 이름 「Kfive」 → prefs.imgNamesExtra → 본편 목록 끝에, 명부에 있는 이름(첫 이름)을 다시 넣으면 「이미 목록에 있어요」', '목록에 Kfive, 중복은 알림만', 'imgprompt.ts ip-extra-add');
    await S.ed('guide:Image');
    await S.setVal('.gw input[data-input="ip-extra"]', 'Kfive', 'input', 300);
    await S.click('.gw [data-action="ip-extra-add"]', 1000);
    const info1 = await S.fe(() => document.querySelector('.gw .gx-hint, .gw .gx-err')?.textContent ?? null);
    await S.setVal('.gw input[data-input="ip-extra"]', c0[0], 'input', 300);
    await S.click('.gw [data-action="ip-extra-add"]', 1000);
    const dupMsg = await S.fe(() => document.querySelector('.gw .gx-err')?.textContent ?? null);
    pr = await S.prefs();
    tr = await S.turn('엘리베이터를 탄다.');
    const c3 = charsOf(imgBlock(tr.main[0]));
    st.check(c3?.at(-1) === 'Kfive' && (pr?.imgNamesExtra ?? []).length === 1 && /이미 목록/.test(dupMsg ?? ''), { info1, dupMsg, extra: pr?.imgNamesExtra, last: c3?.at(-1) });

    st = step('표정 세트를 「Smile, 웃음, sad!, angry」로 → 낱말 거르기(소문자·영문만) → 본편 Available 목록', '본편 표정 목록 = smile, sad, angry (웃음 빠짐·! 빠짐)', 'imgprompt.ts cleanKeyword / 페이지 안내 「카드 그림에 있는 이름이어야」');
    await S.ed('guide:Image');
    await S.setVal('.gw textarea[data-input="ip-keywords"]', 'Smile, 웃음, sad!, angry', 'input', 1400);
    pr = await S.prefs();
    tr = await S.turn('창문을 연다.');
    const k4 = kwOf(imgBlock(tr.main[0]));
    st.req('표정바꿈_본편', tr.main[0]);
    st.check(JSON.stringify(k4) === JSON.stringify(['smile', 'sad', 'angry']), { saved: pr?.imgKeywords, req: k4 });
    S.note('표정 세트 저장값(거르기 전 그대로인지)', pr?.imgKeywords);

    st = step('보조 방식으로 바꾸면 본편엔 이미지 지침 없음, 보조 이미지 요청이 같은 표정 세트·대상 목록을 씀', '본편에 머리 없음, 보조 「Insert <img> tags」 요청에 smile/sad/angry, 끈 이름 없음', 'imgprompt.ts 머리 「메인 모델 지침과 보조 모델 자료가 같은 목록」');
    await S.ed('set:image');
    await S.click('.gw [data-action="set-asset-model"][data-value="aux"]', 900);
    tr = await S.turn('잼트리를 부른다.');
    const auxImg = tr.aux.find((r) => /Insert <img> tags/.test(flat(r)));
    st.req('보조방식_이미지요청', auxImg);
    const af = auxImg ? flat(auxImg) : '';
    st.check(!flat(tr.main[0]).includes(HEAD) && !!auxImg && /smile/.test(af) && !/crazy smile/.test(af) && !af.includes(`${victim}_`), { mainHead: flat(tr.main[0]).includes(HEAD), aux: !!auxImg, kwSmile: /smile/.test(af), noCrazy: !/crazy smile/.test(af) });

    st = step('틀을 비우면 기본 틀로(prefs.imgPrompt 지움), 표식 사라짐', '본편(메인 방식) 이미지 지침에 표식 없음, 기본 머리 있음', '페이지 안내 「비우면 기본 틀」');
    await S.ed('set:image');
    await S.click('.gw [data-action="set-asset-model"][data-value="main"]', 900);
    await S.ed('guide:Image');
    await S.setVal('.gw textarea[data-input="ip-template"]', '', 'input', 1400);
    pr = await S.prefs();
    tr = await S.turn('계단을 내려간다.');
    const b5 = imgBlock(tr.main[0]);
    st.check(!pr?.imgPrompt && b5.startsWith(HEAD) && !/K5-TPL-MARK/.test(b5), { imgPrompt: pr?.imgPrompt ?? null, head: b5.startsWith(HEAD), mark: /K5-TPL-MARK/.test(b5) });

    st = step('지침 탭 「이미지(보조 모델)」 MAIN_TEMPLATE 절을 고치면 이미지 지침 틀도 그 글(2026-11-15 주석)', '본편 이미지 지침에 K5-ASSET-MARK', 'imgprompt.ts imgPromptDefault = guideTxt(Asset, MAIN_TEMPLATE), ui/imgprompt.ts 2026-11-15 주석');
    await S.ed('guide:Asset');
    const key = await S.fe(() => [...document.querySelectorAll('.gw textarea[data-input="ed-guide-sec"]')].find((e) => e.closest('.gw-field').querySelector('.gw-field-head b')?.textContent === 'MAIN_TEMPLATE')?.dataset.key ?? null);
    const v = await S.fe((k) => document.querySelector(`.gw textarea[data-key="${k}"]`).value, key);
    await S.setVal(`.gw textarea[data-key="${key}"]`, v.replace('### Logic Priority', '### Logic Priority\n- K5-ASSET-MARK.'), 'input', 1400);
    tr = await S.turn('밖으로 나간다.');
    await S.ed('guide:Image');
    const tplNow = await S.fe(() => document.querySelector('.gw textarea[data-input="ip-template"]')?.value ?? '');
    st.check(/K5-ASSET-MARK/.test(imgBlock(tr.main[0])) && /K5-ASSET-MARK/.test(tplNow), { req: /K5-ASSET-MARK/.test(imgBlock(tr.main[0])), page: /K5-ASSET-MARK/.test(tplNow) });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K5_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 30));
    await S.close();
  }
}
