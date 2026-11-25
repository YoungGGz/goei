// K-08 설정 창은 마지막 보던 페이지로 열린다 (창 닫기 → 다시 열기, 상황판 창까지 닫았다 열기, 다른 탭 페이지, 새로고침 뒤는 사실만)
import { rec, sleep } from '../lib.mjs';
export default async function (C, arg) {
  const { t } = C;
  const tag = arg?.tag ?? 'pc';
  const R = [];
  const step = async (name, expect, src, fn) => { let actual, ok, err; try { ({ actual, ok } = await fn()); } catch (e) { err = String(e.message ?? e); ok = false; } const r = rec(`k08-${tag} ` + name, { expect, src, actual, ok, err }); R.push(r); return r; };
  const cur = () => t.F().evaluate(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value ?? document.querySelector('.gw h2, .gw .gw-head h2, .gw .ph-title')?.textContent?.trim() ?? null);
  const title = () => t.F().evaluate(() => [...document.querySelectorAll('.gw h2, .gw .gw-title, .gw header b')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3));
  await C.openSet(); await C.node('set:lore'); const a = await title();
  await C.closeSet(); await C.openSet(); const b = await title(); const bn = await cur();
  await C.shot(`k08-${tag}-1-다시열기`);
  await step('설정 닫고 다시 열기', '로어북 호출 페이지로 열림', 'K-08 (사용자 11-22)', async () => ({ actual: { before: a, after: b, node: bn }, ok: JSON.stringify(a) === JSON.stringify(b) }));
  await C.node('manage:trace'); const c = await title();
  await C.closeSet(); await t.closeWindow(); await C.openSet(); const d = await title();
  await step('점검 탭 페이지 → 상황판 창까지 닫고 다시', '호출 기록 페이지로 열림', 'K-08', async () => ({ actual: { before: c, after: d }, ok: JSON.stringify(c) === JSON.stringify(d) }));
  await C.closeSet(); await t.closeWindow();
  await t.reload({ settle: true }); await sleep(1500);
  await C.openSet(); const e = await title();
  await C.shot(`k08-${tag}-2-새로고침뒤`);
  await step('새로고침 뒤 (사실만)', '기록만: 새로고침 뒤 처음 여는 페이지', 'K-08 은 「닫기 전 페이지」. 새로고침은 결정 밖', async () => ({ actual: { after: e }, ok: true }));
  await C.closeSet();
  return R.map((r) => ({ name: r.name, ok: r.ok, err: r.err }));
}
