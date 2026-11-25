// K11 관리 ① 저장·불러오기: 내보내기(지금 채팅 값 넣기 끔/켬)·가져오기(확인 팝업, 기기 설정·채팅 값)·에셋용 사본 넣기/빼기, 실패 기록: 진단 묶음(대화 본문 없음)·지우기
// 시험 리스AI 안의 것만 누른다 (결과물 삭제 금지 규칙: 사용자 파일 아님)
import { rec, sleep, save } from '../lib.mjs';
import { readFileSync } from 'node:fs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k11a ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const dl = async (action) => { const [d] = await Promise.all([t.page.waitForEvent('download', { timeout: 15000 }), C.act(action)]); const p = await d.path(); return { name: d.suggestedFilename(), text: readFileSync(p, 'utf8') }; };
  const info = () => t.F().evaluate(() => [...document.querySelectorAll('.gw .gx-hint, .gw .gx-err')].map((e) => e.textContent.trim()).join(' | '));

  // 준비: 기기 설정 하나(메뉴 오른쪽)·채팅 설정 하나(괴담톡 자동 호출 등 아무 채팅 변수: 생성 공통 다시 보기 1)
  await C.openSet(); await C.node('set:screen'); await C.seg('메뉴 위치', '오른쪽');
  await C.node('set:adv'); await C.typeNum('다시 보기', 1);
  await C.node('manage:backup'); await sleep(600);
  await C.shot('k11a-1-저장불러오기');
  const e0 = await dl('man-download');
  const j0 = JSON.parse(e0.text); save('k11a-내보내기-채팅값없음.json', e0.text);
  await step('내보내기 (지금 채팅 값 끔)', 'JSON 에 기기 설정(nav right) 있음, chat 칸 없음, 대화 글 없음', 'manage.ts exportJson, 「지금 채팅 값도 넣기」 기본 끔', async () => ({ actual: { name: e0.name, keys: Object.keys(j0), nav: j0.nav, hasChat: 'chat' in j0 }, ok: j0.nav === 'right' && !('chat' in j0) }));
  await t.F().locator('.gw [data-action="man-with-chat"]').click(); await sleep(500);
  const e1 = await dl('man-download'); const j1 = JSON.parse(e1.text); save('k11a-내보내기-채팅값.json', e1.text);
  const chatLine = (await t.chatState(true)).message.find((m) => m.role === 'char')?.data.slice(0, 30) ?? '';
  await step('내보내기 (지금 채팅 값 켬)', 'chat.vars 에 이 채팅 설정 값($gen_reiterate=1 포함), 기록·대화 글은 없음', 'manage.ts:204 「기록은 안 들어가요」', async () => ({ actual: { chatKeys: Object.keys(j1.chat?.vars ?? {}), reit: j1.chat?.vars?.$gen_reiterate, convo: e1.text.includes(chatLine), chatLine }, ok: String(j1.chat?.vars?.$gen_reiterate) === '1' && !e1.text.includes(chatLine) }));

  // 가져오기: 메뉴 왼쪽·다시 보기 0 으로 바꾼 뒤 e1 을 붙여 넣고 적용 → 확인 팝업 → 둘 다 돌아옴
  await C.node('set:screen'); await C.seg('메뉴 위치', '왼쪽'); await C.node('set:adv'); await C.typeNum('다시 보기', 0);
  await C.node('manage:backup'); await sleep(500);
  const ta = t.F().locator('.gw textarea[data-input="man-import-text"]'); await ta.scrollIntoViewIfNeeded(); await ta.fill(e1.text); await sleep(400);
  await C.act('man-import'); await sleep(400);
  const pop = await t.F().evaluate(() => document.querySelector('.gw .gw-confirm, .gw [class*="ask"]')?.textContent.trim().slice(0, 120) ?? null);
  await C.shot('k11a-2-가져오기-확인팝업');
  await C.act('man-import-yes'); await sleep(1200);
  const msg = await info();
  const pf = await C.store('goei:prefs'); const vv = await C.vars(/^\$gen_reiterate$/);
  await step('가져오기 (확인 팝업 → 적용)', '확인 팝업 뜸, 적용 뒤 기기 nav=right, 이 채팅 $gen_reiterate=1, 안내 글에 「채팅 값 N개」', 'manage.ts man-import-yes, 2026-11-08 사용자 「확인은 팝업」', async () => ({ actual: { pop, msg, nav: pf.nav, vv }, ok: !!pop && pf.nav === 'right' && String(vv.$gen_reiterate) === '1' }));
  // 틀린 JSON
  await ta.fill('{ 이건 json 아님'); await C.act('man-import'); await C.act('man-import-yes'); await sleep(600);
  const bad = await info();
  await step('가져오기: 틀린 글', '오류 안내, 설정 그대로', '', async () => ({ actual: { bad, nav: (await C.store('goei:prefs')).nav }, ok: /못|아니|오류|Unexpected|JSON/.test(bad) && (await C.store('goei:prefs')).nav === 'right' }));
  await C.node('set:screen'); await C.seg('메뉴 위치', '왼쪽'); await C.node('set:adv'); await C.typeNum('다시 보기', 0);

  // 에셋용 사본 넣기/빼기 (시험 카드)
  await C.node('manage:backup'); await sleep(500);
  const cnt = () => t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return { assetCopy: (c.assetCopy ?? []).length ?? null, folder: c.globalLore.filter((l) => /사본|asset/i.test(String(l.comment ?? ''))).length }; });
  const c0 = await cnt(); await C.act('man-asset-put'); await sleep(1500); const i1 = await info(); const c1 = await cnt();
  await C.shot('k11a-3-에셋사본-넣음');
  await C.act('man-asset-drop'); await sleep(1500); const i2 = await info(); const c2 = await cnt();
  await step('에셋용 사본 넣기 → 빼기', '넣으면 카드 로어북에 사본 폴더·안내 「요원 N명」, 빼면 그 폴더만 빠짐', 'manage.ts:229-233 (사용자 11-15)', async () => ({ actual: { c0, i1, c1, i2, c2 }, ok: /넣었어요/.test(i1) && /뺐어요/.test(i2) && c2.folder === c0.folder }));

  // 실패 기록: 괴담톡 확인을 실패시키고(보조 형식 틀린 답) 진단 묶음 → 대화 글 없음 → 지우기
  await C.closeSet();
  await t.fake('rules/add', { rule: { id: 'k11-badph', route: 'aux', match: 'messenger records', reply: '이건 형식이 틀린 답 K11_RAW_MARK' } });
  await C.open(); await C.act('tab', 'phone', false); await sleep(800); await C.act('ph-refresh', undefined, false);
  await sleep(9000);
  await t.fake('rules/del', { id: 'k11-badph' });
  await C.openSet(); await C.node('manage:log'); await sleep(600);
  const logTxt = await t.F().evaluate(() => document.querySelector('.gw .gw-page')?.innerText.slice(0, 600));
  await C.shot('k11a-4-실패기록');
  const d0 = await dl('man-diag-download'); save('k11a-진단묶음.json', d0.text);
  const allMsgs = (await t.chatState(true)).message.map((m) => m.data);
  const leak = allMsgs.map((m) => m.replace(/\[▣[^\]]*\]/g, '').trim().slice(0, 25)).filter((s) => s.length > 8 && d0.text.includes(s));
  await step('진단 묶음', '판·설정·실패 원문(K11_RAW_MARK) 들어감, 대화 본문은 안 들어감', 'manage.ts diagBundle 「대화 본문은 넣지 않는다」(사용자 11-06)', async () => ({ actual: { name: d0.name, raw: d0.text.includes('K11_RAW_MARK'), leak, keys: Object.keys(JSON.parse(d0.text)), logTxt: logTxt?.slice(0, 200) }, ok: d0.text.includes('K11_RAW_MARK') && leak.length === 0 }));
  await C.act('man-clear-fail'); await sleep(400); const pop2 = await t.F().evaluate(() => document.querySelector('.gw .gw-confirm')?.textContent.trim().slice(0, 80) ?? null);
  await C.act('man-clear-fail-yes'); await sleep(700);
  const after = await t.F().evaluate(() => document.querySelector('.gw .gw-page')?.innerText.includes('실패한 요청이 없어요'));
  await C.node('manage:diag'); await sleep(500); const diagFail = await t.F().evaluate(() => [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label b')?.textContent.includes('최근 실패'))?.innerText.replace(/\s+/g, ' '));
  await step('실패 기록 지우기', '확인 팝업 → 지우면 「실패한 요청이 없어요」, 상태 점검 최근 실패 「없음」', 'manage.ts:272', async () => ({ actual: { pop2, after, diagFail }, ok: !!pop2 && after && /없음/.test(JSON.stringify(diagFail)) }));
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
