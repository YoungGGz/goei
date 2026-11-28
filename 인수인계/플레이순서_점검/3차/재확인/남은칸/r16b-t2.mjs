// 재확인 남은칸 R16 (나) 큰 설정 길 — goei:prefs 가 256KB 를 넘은 기기(큰 지침 4개를 고친 뒤)에서 저장소가 찼을 때.
// 이때는 리스아이 setItem 이 OPFS 쓰기를 기다리고 실패하면 던진다(pluginStorageStore.ts:383-398). r16-t2.mjs 의 작은 설정 길과 대조.
// 리스AI 996a553 웹: pluginStorage = PluginStorageStore(coldstorage). 작은 값(≤256KB)은 메모리에 넣고 1초 뒤 index 를 OPFS 에 새로 쓰며,
// 그 쓰기가 실패하면 console.error 만 찍고 15초마다 다시 해 본다(pluginStorageStore.ts doFlush/scheduleFlush). setItem 자체는 던지지 않는다.
// 큰 값(>256KB)만 setItem 이 던진다(:396-398). OPFS 쓰기 실패는 브라우저 저장 용량이 찼을 때 난다 → CDP Storage.overrideQuotaForOrigin 으로 용량을 1바이트로.
// 쓰는 법: source /tmp/t2-remain/t2-env.sh; OUT=<폴더> node r16-t2.mjs
import { session, sleep, flat } from './lib.mjs';

const S = await session('R16b');
const { t, step, note } = S;
const origin = new URL(process.env.RISU_URL || t.cfg.risu).origin;
let cdp = null;
const quota = async (size) => {
  cdp ??= await t.ctx.newCDPSession(t.page);
  await cdp.send('Storage.overrideQuotaForOrigin', size === null ? { origin } : { origin, quotaSize: size });
};
const probe = () => t.R(async () => {
  const out = {};
  try { out.estimate = await navigator.storage.estimate(); } catch (e) { out.estimate = String(e); }
  try { const d = await navigator.storage.getDirectory(); const f = await d.getFileHandle('t2probe_r16.json', { create: true }); const w = await f.createWritable(); await w.write('x'.repeat(200000)); await w.close(); out.opfs = 'ok'; } catch (e) { out.opfs = `${e?.name}: ${e?.message}`; }
  out.opfsFlag = localStorage.getItem('opfs_flag!');
  return out;
});
const storeInfo = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const cs = await import('/src/ts/process/coldstorage.svelte.ts');
  const v = await cs.pluginStorage.getItem('goei:prefs');
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return { pointer: st.DBState.db.pluginCustomStorage?._coldpluginIndex ?? null, prefsLen: s?.length ?? 0, mem: s ?? '' };
});
/** 저장소 index 를 직접(메모리 아닌 OPFS 에서) 읽어 goei:prefs 를 꺼냄 */
const storedPrefs = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const cs = await import('/src/ts/process/coldstorage.svelte.ts');
  const ptr = st.DBState.db.pluginCustomStorage?._coldpluginIndex;
  if (!ptr) return { ptr: null };
  const idx = await cs.getColdStorageItem(ptr);
  const e = idx?.entries?.find((x) => x.k === 'goei:prefs');
  return { ptr, prefs: e?.s ?? null };
});
const errs = (re) => t.errors.filter((e) => re.test(e));
const MARK_G = 'RE16T2-GUIDE-MARK';
const MARK_R = 'RE16T2-RULE-MARK';
const uiNotes = () => S.fe(() => [...document.querySelectorAll('.gw .gx-err, .gx-toast, [role="alert"], .gw .gx-hint, .gx-note')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 6)).catch(() => []);
const segOn = () => S.fe(() => { const row = [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label b')?.textContent.includes('메뉴 위치')); return row ? [...row.querySelectorAll('.gx-seg.on, .gx-seg[aria-pressed="true"]')].map((e) => e.textContent.trim()) : null; });

try {
  await S.fakeReset();
  note('setup', await t.setup());
  note('load', await S.loadState('S-관리국-3턴.json'));
  await sleep(2000);
  note('저장 길·용량(처음)', await probe());
  // 준비 1: 정상 저장으로 RP 규칙
  {
    await S.ed('rule:all');
    await S.click('.gw [data-action="ed-rule-new"]', 900);
    await S.setVal('.gw [data-input="ed-rule-text"]', `${MARK_R} 규칙 글`, 'input', 1200);
    const chips = await S.fe(() => [...document.querySelectorAll('.gw [data-action="ed-rule-to"]')].map((e) => [e.dataset.value, e.classList.contains('on'), e.textContent.trim()]));
    const rp = chips.find((c) => /\|rp$/i.test(c[0]) || /RP|역할/.test(c[2]));
    if (rp && !rp[1]) await S.click(`.gw [data-action="ed-rule-to"][data-value="${rp[0]}"]`, 900);
    await S.edClose();
  }
  // 준비 2: 큰 지침 4개(갱신기 자세히·간결, 괴담톡, 연어 마켓)의 첫 절 끝에 한 줄씩 → 기기 설정이 256KB 를 넘음 (정상 저장)
  for (const g of ['Updater', 'UpdaterCompact', 'Phone', 'Salmon']) {
    await S.ed(`guide:${g}`);
    await S.fe(([sel, m]) => { const e = document.querySelector(sel); e.focus(); e.value += `\n- ${m}.`; e.dispatchEvent(new Event('input', { bubbles: true })); }, ['.gw textarea[data-input="ed-guide-sec"]', `RE16B-PREP-${g}`]);
    await sleep(2500);
  }
  await S.edClose();
  await sleep(3000);
  const i0 = await storeInfo();
  const idx0 = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const idx = await cs.getColdStorageItem(st.DBState.db.pluginCustomStorage?._coldpluginIndex); const e = idx?.entries?.find((x) => x.k === 'goei:prefs'); return e ? { large: !!e.l, small: !!e.s } : null; });
  {
    const tr = await S.turn('준비 턴: 주위를 본다.');
    const st = step('준비: 큰 기기 설정 정상 저장', 'goei:prefs 가 256KB 넘고 저장소에 큰 항목으로, 요청에 규칙 글', '-');
    st.check(i0.prefsLen > 256 * 1024 && idx0?.large && tr.main.some((r) => flat(r).includes(MARK_R)), { prefsLen: i0.prefsLen, indexEntry: idx0, reqHasRule: tr.main.map((r) => flat(r).includes(MARK_R)) });
  }
  await quota(1);
  const pq = await probe();
  step('용량 1바이트 에서 OPFS 쓰기', 'QuotaExceededError', '-').check(/Quota/i.test(pq.opfs), pq);
  const e0 = t.errors.length;
  // (가) 지침 RP 절 끝
  let headG, uiG;
  {
    await S.ed('guide:RP');
    await S.fe(([sel, m]) => { const e = document.querySelector(sel); e.focus(); e.value += `\n- ${m}.`; e.dispatchEvent(new Event('input', { bubbles: true })); }, ['.gw textarea[data-input="ed-guide-sec"]', MARK_G]);
    await sleep(2500);
    uiG = await uiNotes();
    headG = await S.fe(() => document.querySelector('.gw .gw-head small')?.textContent ?? null);
    await t.shot('R16b-가-지침');
  }
  const memG = (await storeInfo()).mem.includes(MARK_G);
  // (나) 규칙 사용 끄기
  let swN, uiN;
  {
    await S.ed('rule:all');
    await S.click('.gw [data-action="ed-rule-on"]', 1500);
    swN = await S.fe(() => { const b = document.querySelector('.gw [data-action="ed-rule-on"]'); return b ? { aria: b.getAttribute('aria-checked'), on: b.classList.contains('on') } : null; });
    uiN = await uiNotes();
    await t.shot('R16b-나-규칙끄기');
  }
  // (다) 메뉴 위치 오른쪽
  let segD, uiD, navD;
  {
    await S.ed('set:screen');
    const before = await segOn();
    await S.fe(() => { const row = [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label b')?.textContent.includes('메뉴 위치')); [...row.querySelectorAll('.gx-seg')].find((e) => e.textContent.includes('오른쪽'))?.click(); });
    await sleep(1500);
    segD = { before, after: await segOn() };
    uiD = await uiNotes();
    navD = await S.fe(() => document.querySelector('.gx')?.dataset.nav ?? null);
    await t.shot('R16b-다-메뉴위치');
  }
  await S.edClose();
  await sleep(2000);
  const memNow = await storeInfo();
  const tq = await S.turn('용량 1바이트 턴: 주위를 본다.');
  const reqNow = tq.main.map(flat).join('\n');
  step('(가)(나)(다) 이번 세션 (큰 설정)', '알림이 있거나 화면·이번 요청·저장소가 같음 (R16 기대)', 'R16').check(false, {
    ui: { 가: uiG, 나: uiN, 다: uiD }, headG, switchN: swN, segD, navD,
    storeMemory: { guideRightAfter가: memG, guide: memNow.mem.includes(MARK_G), nav: /"nav":"right"/.test(memNow.mem), ruleOnInStore: /"on":true/.test(memNow.mem) },
    req: { guide: reqNow.includes(MARK_G), rule: reqNow.includes(MARK_R) },
    newErrors: t.errors.slice(e0).filter((e) => !/displayData/.test(e)).map((e) => e.slice(0, 260)).slice(0, 10),
  });
  // 다시 켬: 용량을 먼저 풀고 다시 켬 (리스아이 자체 저장은 되돌아온 상태에서, 플러그인 설정만 보려고)
  await quota(null);
  await sleep(3000);
  await t.reload();
  await sleep(4000);
  const a = await storeInfo();
  const tr2 = await S.turn('다시 켠 뒤 턴: 주위를 본다.');
  const req2 = tr2.main.map(flat).join('\n');
  step('다시 켠 뒤', '이번 세션에 보였던 상태와 같음', 'R16').check(a.mem.includes(MARK_G) === true && !req2.includes(MARK_R), { prefsGuide: a.mem.includes(MARK_G), prefsNavRight: /"nav":"right"/.test(a.mem), reqGuide: req2.includes(MARK_G), reqRule: req2.includes(MARK_R), alerts: await t.alerts().catch(() => null) });
  await t.shot('R16b-다시켬');
} catch (e) {
  step('예외', '', '-').check(false, String(e?.stack ?? e).slice(0, 1500));
  try { await t.shot('R16b-FAIL'); } catch {}
} finally {
  try { await quota(null); } catch {}
  S.rec.errors = t.errors.slice(-80);
  await S.close();
}
