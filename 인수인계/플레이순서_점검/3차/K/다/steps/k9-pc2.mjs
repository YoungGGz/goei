// K9 PC 이어서: 위키 목록 서랍 쪽, 호출 진행 창 끔/켬(실제 보내기), 테마 채팅마다(두 번째 채팅 넣고 오가기)
import { rec, sleep, STATES } from '../lib.mjs';
export default async function (C) {
  const { t } = C;
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec('k9-pc2 ' + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const prefs = () => C.store('goei:prefs');

  // 1. 위키 목록 서랍: 왼쪽/오른쪽
  for (const side of ['왼쪽', '오른쪽']) {
    await C.openSet(); await C.node('set:screen'); await C.seg('위키 목록 위치', side); await C.closeSet();
    await C.act('br-go', 'wk', false); await sleep(1200);
    await C.act('wiki-list', 'open', false); await sleep(900);
    const d = await t.F().evaluate(() => { const w = document.querySelector('.gx .wk .wdr'); const r = w?.getBoundingClientRect(); const p = document.querySelector('.gx .wk')?.getBoundingClientRect(); return w ? { open: w.classList.contains('open'), x: Math.round(r.x), w: Math.round(r.width), wkX: Math.round(p.x), wkW: Math.round(p.width) } : null; });
    await C.shot(`k9-pc-14-위키서랍-${side}`);
    await step(`위키 목록 서랍 ${side}`, `서랍(.wdr)이 위키 화면 ${side} 끝에 붙어 열림`, 'setdef 위키 목록 위치, style.css:5035', async () => ({ actual: d, ok: !!d && d.open && (side === '왼쪽' ? Math.abs(d.x - d.wkX) < 4 : Math.abs(d.x + d.w - (d.wkX + d.wkW)) < 4) }));
    await C.act('wiki-list', 'close', false).catch(() => {});
  }

  // 2. 호출 진행 창 끔 → 보내기 → 진행 창 없음 / 켬 → 있음
  await C.openSet(); await C.node('set:screen');
  await t.F().locator('.gw [data-action="set-progress"]').click(); await sleep(500);
  const pOff = await prefs();
  await C.closeSet(); await t.closeWindow();
  await t.send('K9 진행 창 끔 확인.', { wait: false }); await sleep(1500);
  const progOff = await t.page.evaluate(() => { const e = document.querySelector('[x-goei-prog]'); return e ? { display: getComputedStyle(e).display, vis: getComputedStyle(e).display !== 'none' && [e, ...e.querySelectorAll('*')].some((x) => x.getBoundingClientRect().width > 0), text: e.innerText.slice(0, 80) } : null; });
  await C.shot('k9-pc-15-진행창끔-보내는중');
  await t.waitIdle();
  await step('호출 진행 창 OFF', 'prefs.progress=false, 보내는 중에도 채팅 화면 오른쪽 위 진행 창(카드·버튼) 안 보임', 'setdef 호출 진행 창', async () => ({ actual: { progress: pOff.progress, progOff }, ok: pOff.progress === false && (!progOff || !progOff.vis) }));
  await C.openSet(); await C.node('set:screen');
  await t.F().locator('.gw [data-action="set-progress"]').click(); await sleep(500);
  const pOn = await prefs();
  await C.closeSet(); await t.closeWindow();
  await t.send('K9 진행 창 켬 확인.', { wait: false }); await sleep(1500);
  const progOn = await t.page.evaluate(() => { const e = document.querySelector('[x-goei-prog]'); return e ? { vis: getComputedStyle(e).display !== 'none' && [e, ...e.querySelectorAll('*')].some((x) => x.getBoundingClientRect().width > 0), text: e.innerText.replace(/\s+/g, ' ').slice(0, 120) } : null; });
  await C.shot('k9-pc-16-진행창켬-보내는중');
  await t.waitIdle();
  await step('호출 진행 창 ON', 'prefs.progress 칸 없음, 보내는 중 진행 창 보임', '', async () => ({ actual: { progress: pOn.progress ?? null, progOn }, ok: pOn.progress === undefined && !!progOn?.vis }));

  // 3. 테마 채팅마다: 지금 채팅(관리국)은 앞 단계에서 페이퍼. 두 번째 채팅(백일몽)을 넣고 오간다
  const vA = await C.vars(/theme/);
  const ls = await t.loadState(STATES + 'S-백일몽-3턴.json');
  await sleep(1000);
  const vB = await C.vars(/theme/);
  await C.open(); await sleep(500);
  const thB = await t.F().evaluate(() => document.querySelector('.gx')?.dataset.theme);
  await C.shot('k9-pc-17-테마-다른채팅');
  await t.closeWindow();
  await t.switchChat(1); await sleep(1500);
  await C.open(); await sleep(500);
  const thA = await t.F().evaluate(() => document.querySelector('.gx')?.dataset.theme);
  const vA2 = await C.vars(/theme/);
  await step('테마 채팅마다', '관리국 채팅=페이퍼 그대로, 넣은 백일몽 채팅=자기 값(없으면 기본 다크), 오가도 섞이지 않음', 'settings.ts:419 「테마는 채팅마다 ($st_fixed_theme)」', async () => ({ actual: { vA, vB, thB, thA, vA2, ls }, ok: thB !== 'paper' && thA === 'paper' }));
  await t.closeWindow();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
