// A5 업데이트·A6 옛 판 채팅·A8 판 대조·아이콘 거절 (실제 리스아이)
// 사용: FAKE_URL=… node runA5.mjs <card|switch|old|icon>
//  card  : 받는 곳의 카드 판을 0.21.99 로 → 창 위 「새 버전이 있어요」 → 건너뛰기(다시 열어도 안 뜸) → 설치·업데이트 창 「새 버전 확인 → 카드 업데이트 준비 → 카드에 적용」 → 카드 판·채팅 그대로
//  switch: 준비까지 한 뒤 다른 캐릭터로 바꿔 설치 창 → 적용 단추가 그 봇에 안 뜨는지 → 괴이 카드로 돌아와 적용
//  old   : 옛 판 채팅 흉내(설정 변수·세력 변수 몇 개 지움) → 한 턴 → 다시 채워지는지, 상태 점검 화면(판 맞춤 줄 = A8)
//  icon  : 아이콘 있는 다른 봇에 설치 → 「이전 아이콘으로」 → 아이콘 되돌아감 → 「다시 점검·맞추기」가 아이콘을 다시 안 바꿈(D-2) → 「플러그인 아이콘으로」
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OUT, sleep, baseRules, turn } from './lib.mjs';

const which = process.argv[2] ?? 'card';
const tag = `A5-${which}`;
const t = await openT2({ via: 'plain' });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 700)); };
const REL = t.cfg.rel;
const NEW = '0.21.99';
const ST = (n) => fileURLToPath(new URL(`../틀/states/${n}.json`, import.meta.url));
// 카드 업데이트 판 올리기
let bump = which === 'card' || which === 'switch';
const cu = JSON.parse(readFileSync(REL + 'card-update.json', 'utf8'));
const payload = cu.parts.map((n) => readFileSync(REL + n, 'utf8')).join('').replaceAll('"version": "0.21.34"', `"version": "${NEW}"`).replaceAll('"characterVersion": "0.21.34"', `"characterVersion": "${NEW}"`).replaceAll('\\"version\\": \\"0.21.34\\"', `\\"version\\": \\"${NEW}\\"`);
const half = Math.ceil(payload.length / cu.parts.length);
const newParts = cu.parts.map((_, i) => payload.slice(i * half, (i + 1) * half));
await t.ctx.route((u) => u.href.includes('raw.githubusercontent.com/ygberserk/goei/release/') || u.href.includes('/proxy2'), async (r) => {
  const req = r.request(); let url = req.url();
  if (url.includes('/proxy2')) url = decodeURIComponent(req.headers()['risu-url'] || '');
  const name = decodeURIComponent((url.split('/ygberserk/goei/release/')[1] ?? '').split('?')[0]);
  if (!name || !bump) return r.fallback();
  const ok = (body) => r.fulfill({ status: 200, body, headers: { 'access-control-allow-origin': '*' } });
  if (name === 'version.json') return ok(JSON.stringify({ card: NEW, plugin: '0.21.34', minPlugin: '0.17.0' }));
  if (name === 'card-update.json') return ok(JSON.stringify({ ...cu, version: NEW, length: payload.length }));
  const i = cu.parts.indexOf(name);
  if (i >= 0) return ok(newParts[i]);
  return r.fallback();
});
const hamburger = async () => {
  const find = () => t.page.evaluate(() => { const p = [...document.querySelectorAll('svg path')].find((p) => (p.getAttribute('d') ?? '').startsWith('M11.5 2.5C7.8') && p.closest('svg').getBoundingClientRect().width > 0 && p.closest('svg').getBoundingClientRect().x < 100); if (!p) return null; const r = p.closest('svg').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  let box = await find();
  if (!box) { await t.page.locator('button:has(svg.lucide-list)').first().click(); await sleep(500); box = await find(); }
  if (!box) return false;
  await t.page.mouse.click(box.x, box.y); return true;
};
const instFrame = () => t.frame('.gw-install, .gw-install-pre', 60000);
const waitIdle = async (f, ms = 180000) => { const end = Date.now() + ms; while (Date.now() < end) { await sleep(800); const busy = await f.evaluate(() => [...document.querySelectorAll('.gw-page button[disabled]')].some((b) => /중…|중\.\.\./.test(b.innerText)) || !!document.querySelector('.gw-install-pre:not(:has(.gx-err))')).catch(() => true); if (!busy) return true; } return false; };
const updRead = (f) => f.evaluate(() => ({
  rows: [...document.querySelectorAll('.gw-page .ps-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()).filter((x) => /플러그인|카드|아이콘/.test(x)).slice(0, 8),
  btns: [...document.querySelectorAll('[data-action^="upd-"], [data-action^="ed-inst-"]')].map((b) => `${b.dataset.action}:${b.innerText.trim()}`),
  plan: document.querySelector('.upd-plan')?.innerText?.replace(/\s+/g, ' ') ?? null,
  err: [...document.querySelectorAll('.gw-page .gx-err')].map((e) => e.innerText).join(' / ') || null,
  hint: [...document.querySelectorAll('.gw-page .gx-hint')].map((e) => e.innerText).join(' / ').slice(0, 200) || null,
}));
const cardVer = (i) => t.R(async (i) => { const st = await import('/src/ts/stores.svelte.ts'); const c = st.DBState.db.characters[i ?? st.DBState.db.characters.findIndex((x) => x.chaId === st.DBState.db.characters[0].chaId)]; const m = (c.globalLore ?? []).find((l) => l.comment === 'Plugin manifest'); return { name: c.name, ver: (() => { try { return JSON.parse(String(m?.content ?? '')).version; } catch { return null; } })(), charVer: c.characterVersion ?? null, image: c.image ?? null, cc: (c.ccAssets ?? []).length }; }, i);
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await t.fabReady();
  const goeiIdx = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return st.DBState.db.characters.length - 1; });
  if (which === 'card' || which === 'switch') {
    await t.loadState(ST('S-관리국-3턴'));
    await sleep(2000);
    const n0 = (await t.chatState()).message.length;
    await t.openWindow('.gx');
    let banner = null; for (let i = 0; i < 30 && !banner; i++) { await sleep(1000); banner = await t.feval(() => document.querySelector('.upd-banner')?.innerText?.replace(/\s+/g, ' ') ?? null); }
    step('창 위 새 버전 안내', `「새 버전이 있어요 카드 v${NEW}」`, banner, new RegExp(NEW).test(banner ?? ''));
    await t.shot(`${tag}-01-banner`);
    if (which === 'card') {
      await t.F().click('[data-action="upd-skip"]'); await sleep(800);
      const b2 = await t.feval(() => !!document.querySelector('.upd-banner'));
      await t.closeWindow(); await sleep(600); await t.openWindow('.gx'); await sleep(1500);
      const b3 = await t.feval(() => !!document.querySelector('.upd-banner'));
      const dot = await t.feval(() => !!document.querySelector('.gx-nbadge.dot'));
      step('건너뛰기 → 다시 열기', '안내 사라지고 다시 안 뜸, 설정 단추 점은 남음', { afterSkip: b2, reopen: b3, dot }, !b2 && !b3);
      await t.closeWindow();
    } else await t.closeWindow();
    await hamburger();
    const f = await instFrame();
    await waitIdle(f, 60000);
    await f.click('[data-action="upd-check"]').catch(() => {}); await waitIdle(f);
    const u1 = await updRead(f);
    step('새 버전 확인', `카드 v0.21.34 → v${NEW}, 「카드 업데이트 준비」`, u1, u1.btns.some((b) => b.startsWith('upd-prepare')));
    await f.click('[data-action="upd-prepare"]'); await waitIdle(f);
    const u2 = await updRead(f);
    step('카드 업데이트 준비', '바뀌는 칸·로어북·사진 요약 + 「카드에 적용」', u2, !!u2.plan && u2.btns.some((b) => b.startsWith('upd-apply')));
    await t.shot(`${tag}-02-plan`);
    if (which === 'switch') {
      await t.closeWindow().catch(() => {}); await sleep(800);
      const oi = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const i = ch.createNewCharacter(); st.DBState.db.characters[i].name = '다른 봇'; return i; });
      await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, oi);
      await sleep(2500);
      await hamburger();
      const f2 = await instFrame(); await waitIdle(f2, 60000);
      const u3 = await updRead(f2);
      step('준비 뒤 다른 봇으로 바꿔 설치 창', '그 봇엔 「카드에 적용」 없음(괴이 카드 아님)', u3, !u3.btns.some((b) => b.startsWith('upd-apply')));
      await t.shot(`${tag}-03-otherbot`);
      await t.closeWindow().catch(() => {}); await sleep(800);
      // 괴이 카드로 돌아옴
      const gi = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return st.DBState.db.characters.findIndex((c) => (c.globalLore ?? []).some((l) => l.comment === 'Plugin manifest')); });
      await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, gi);
      await sleep(2500);
      await hamburger();
      const f3 = await instFrame(); await waitIdle(f3, 60000);
      const u4 = await updRead(f3);
      step('괴이 카드로 돌아와 설치 창', '(관찰) 준비가 남았는지(카드에 적용) 또는 다시 준비', u4, null);
      if (u4.btns.some((b) => b.startsWith('upd-apply'))) { await f3.click('[data-action="upd-apply"]'); await waitIdle(f3); }
      else if (u4.btns.some((b) => b.startsWith('upd-prepare'))) { await f3.click('[data-action="upd-prepare"]'); await waitIdle(f3); await f3.click('[data-action="upd-apply"]'); await waitIdle(f3); }
      const u5 = await updRead(f3);
      const cv = await cardVer(gi);
      const other = await cardVer(oi);
      step('적용 뒤', `괴이 카드 판 ${NEW}, 다른 봇은 그대로`, { u5, cv, other }, cv.ver === NEW && other.name === '다른 봇');
    } else {
      await f.click('[data-action="upd-apply"]'); await waitIdle(f);
      const u3 = await updRead(f);
      const cv = await cardVer(goeiIdx);
      const n1 = (await t.chatState()).message.length;
      step('카드에 적용', `카드 판 ${NEW}, 끝났다는 글, 채팅 그대로`, { u3, cv, n0, n1 }, cv.ver === NEW && n0 === n1);
      await t.shot(`${tag}-03-applied`);
    }
  }
  if (which === 'old') {
    await t.loadState(ST('S-관리국-3턴'));
    await sleep(2000);
    const before = (await t.chatState(true)).scriptstate ?? {};
    const drop = Object.keys(before).filter((k) => /^\$st_(asset_on|asset_model|asset_player|asset_limit|agent_limit|support_on)$/.test(k));
    // 세력 변수는 명부에 덧붙인 세력이 없으면 빈 값이 맞다 → 일부러 틀린 값을 넣어 「명부가 바뀐 옛 채팅」을 흉내
    drop.push('$fac_codes');
    await t.R(async (drop) => { const st = await import('/src/ts/stores.svelte.ts'); const db = st.DBState.db; const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); const c = db.characters[ci].chats[db.characters[ci].chatPage]; const ss = { ...c.scriptstate }; for (const k of drop) delete ss[k]; ss.$fac_codes = ' | Z99'; c.scriptstate = ss; }, drop);
    step('옛 판 흉내: 지운 변수', '(관찰)', drop, drop.length > 0);
    const r = await turn(t, { user: '고개를 끄덕인다.', prose: '잼트리가 고개를 끄덕였다.', status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } });
    const after = (await t.chatState(true)).scriptstate ?? {};
    const back = drop.map((k) => [k, k === '$fac_codes' ? after[k] !== ' | Z99' : after[k] !== undefined && after[k] !== '', String(after[k] ?? '').slice(0, 30)]);
    step('한 턴 뒤 다시 채움', '지운 설정·세력 변수가 다시 채워짐', back, back.every((x) => x[1]));
    // 상태 점검 화면 (A8 판 맞춤)
    await t.openWindow('.gx');
    await t.F().click('[data-action="ed-open"]').catch(() => {}); await sleep(1200);
    await t.F().click('[data-action="ed-tab"][data-value="manage"]').catch(() => {}); await sleep(600);
    await t.F().click('[data-action="ed-node"][data-value="manage:diag"]').catch(() => {}); await sleep(2500);
    const diag = await t.feval(() => [...document.querySelectorAll('.gw-page .ps-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()).slice(0, 40));
    step('상태 점검 화면', '판 맞춤(카드 = 플러그인 = 0.21.34)·빨간 줄 없음(A-08)', diag, null);
    await t.shot(`${tag}-diag`);
  }
  if (which === 'icon') {
    // 아이콘 있는 다른 봇: 괴이 카드의 아이콘 자산을 빌려 이 봇 아이콘으로
    const oi = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const g = st.DBState.db.characters.find((c) => (c.globalLore ?? []).some((l) => l.comment === 'Plugin manifest')); const src = (g.additionalAssets ?? [])[0]?.[1]; const i = ch.createNewCharacter(); const c = st.DBState.db.characters[i]; c.name = '아이콘 봇'; c.image = src; c.firstMessage = '안녕.'; return i; });
    await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, oi);
    await sleep(2500);
    const v0 = await cardVer(oi);
    await hamburger();
    let f = await instFrame(); await waitIdle(f, 60000);
    await f.click('[data-action="ed-inst-all"]');
    for (let i = 0; i < 400; i++) { await sleep(1000); const done = await f.evaluate(() => [...document.querySelectorAll('[data-action="ed-inst-all"]')].some((b) => !b.disabled) || !!document.querySelector('.gw-install .gx-err')).catch(() => false); if (done && i > 3) break; }
    const v1 = await cardVer(oi);
    const u1 = await updRead(f);
    step('아이콘 있는 다른 봇에 설치', '플러그인 아이콘이 메인, 「이전 아이콘으로」 단추', { v0, v1, u1 }, v1.image !== v0.image && u1.btns.some((b) => b.startsWith('ed-inst-icon-back')));
    await f.click('[data-action="ed-inst-icon-back"]'); await waitIdle(f);
    const v2 = await cardVer(oi);
    const u2 = await updRead(f);
    step('「이전 아이콘으로」', '설치 전 아이콘으로, 「플러그인 아이콘으로」 단추', { v2, u2 }, v2.image === v0.image && u2.btns.some((b) => b === 'ed-inst-icon:플러그인 아이콘으로'));
    await t.shot(`${tag}-02-back`);
    const allBtn = u2.btns.find((b) => b.startsWith('ed-inst-all'));
    if (allBtn) { await f.click('[data-action="ed-inst-all"]'); await waitIdle(f); }
    const v3 = await cardVer(oi);
    step('되돌린 뒤 「다시 점검·맞추기」', '아이콘을 다시 안 바꿈(D-2)', { allBtn, v3 }, v3.image === v0.image);
    await f.click('[data-action="ed-inst-icon"]').catch(() => {}); await waitIdle(f);
    const v4 = await cardVer(oi);
    step('「플러그인 아이콘으로」', '플러그인 아이콘이 다시 메인', v4, v4.image !== v0.image);
    await t.shot(`${tag}-03-icon`);
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-40);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
