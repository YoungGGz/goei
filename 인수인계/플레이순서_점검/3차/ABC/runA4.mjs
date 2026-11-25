// A4·A7 설치·업데이트 창 (실제 리스아이 햄버거 메뉴 → 플러그인 단추)
// 사용: FAKE_URL=… node runA4.mjs <goei|other>
//  goei : 괴이 카드에서 설치 창 → 점검표 → 위키 기본 문서·토크나이저 받기를 끊고 「빠진 것 전부 채우기」 → 된 것/안 된 것 글 → 되살리고 다시 → 안 된 것만
//  other: 빈 봇(로어북 한 줄·첫 메시지 있음) → 유령 단추(아무것도 안 떠야) → 햄버거로 설치 창 → 「설치」(이름 그대로) → 기존 로어북·첫 메시지 자리·이름 → 그 봇에서 시작 패널이 뜨는지
//         → 다시 괴이 카드로 돌아와 첫 그리기(A7 다른 봇 다녀온 직후)
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { OUT, sleep } from './lib.mjs';

const which = process.argv[2] ?? 'goei';
const tag = `A4-${which}`;
const t = await openT2({ via: 'plain' });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 500)); };
let block = null; const hits = [];
await t.ctx.route((u) => u.href.includes('raw.githubusercontent.com/ygberserk/goei/release/') || u.href.includes('/proxy2'), async (r) => {
  const req = r.request(); let url = req.url();
  if (url.includes('/proxy2')) url = decodeURIComponent(req.headers()['risu-url'] || '');
  const name = decodeURIComponent((url.split('/ygberserk/goei/release/')[1] ?? '').split('?')[0]);
  if (!name) return r.fallback();
  if (block && block.test(name)) { hits.push(name); return r.abort(); }
  return r.fallback();
});
// 햄버거 메뉴 → 플러그인 설치 단추
const hamburger = async () => {
  const open = await t.page.evaluate(() => !![...document.querySelectorAll('svg path')].find((p) => (p.getAttribute('d') ?? '').startsWith('M11.5 2.5C7.8') && p.closest('svg').getBoundingClientRect().width > 0 && p.closest('svg').getBoundingClientRect().x < 100));
  if (!open) {
    const list = t.page.locator('button:has(svg.lucide-list)').first();
    if (!(await list.count())) return 'no-list';
    await list.click(); await sleep(500);
  }
  const box = await t.page.evaluate(() => { const p = [...document.querySelectorAll('svg path')].find((p) => (p.getAttribute('d') ?? '').startsWith('M11.5 2.5C7.8') && p.closest('svg').getBoundingClientRect().width > 0 && p.closest('svg').getBoundingClientRect().x < 100); if (!p) return null; const r = p.closest('svg').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (!box) return 'no-ghost';
  await t.page.mouse.click(box.x, box.y);
  return 'ok';
};
const instFrame = async (ms = 60000) => t.frame('.gw-install, .gw-install-pre', ms);
const instRead = async (f) => f.evaluate(() => ({
  head: document.querySelector('.gw-install p, .gw-install .gw-lead, .gw-install header + *')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? null,
  rows: [...document.querySelectorAll('.gw-inst-list .ps-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
  main: document.querySelector('[data-action="ed-inst-all"]')?.innerText ?? document.querySelector('.gw-head-act button')?.innerText ?? null,
  err: document.querySelector('.gw-install .gx-err, .gw-install-pre .gx-err')?.innerText ?? null,
  info: [...document.querySelectorAll('.gw-install .gx-ok, .gw-install .gx-info, .gw-install .gx-note')].map((e) => e.innerText).join(' / ') || null,
  pre: document.querySelector('.gw-install-pre')?.innerText?.replace(/\s+/g, ' ') ?? null,
}));
const waitDone = async (f, ms = 240000) => { const end = Date.now() + ms; while (Date.now() < end) { await sleep(800); const busy = await f.evaluate(() => !!document.querySelector('.gw-install .gw-head-act button[disabled]') || !!document.querySelector('.gw-install-pre:not(:has(.gx-err))')).catch(() => true); if (!busy) return true; } return false; };
const charInfo = (i) => t.R(async (i) => { const st = await import('/src/ts/stores.svelte.ts'); const c = st.DBState.db.characters[i]; return { name: c.name, lore: (c.globalLore ?? []).map((l) => l.comment || l.key).slice(0, 8), loreN: (c.globalLore ?? []).length, first: String(c.firstMessage ?? '').slice(0, 80), alt: (c.alternateGreetings ?? []).length, assets: (c.additionalAssets ?? []).length, emotions: (c.emotionImages ?? []).length, image: !!c.image, loreSetting: c.lorePlus ?? null }; }, i);
try {
  await t.setup();
  await t.fabReady();
  const goeiIdx = await t.charIndex();
  if (which === 'goei') {
    const h = await hamburger();
    step('햄버거 → 설치 단추', '단추 있음·눌림', h, h === 'ok');
    await sleep(5000);
    await t.shot(`${tag}-00-after-hamburger`);
    res.frames = await Promise.all(t.page.frames().map(async (fr) => ({ url: fr.url().slice(0, 60), cls: await fr.evaluate(() => [...new Set([...document.querySelectorAll('[class]')].map((e) => String(e.className).split(' ')[0]).filter((c) => /^g[wx]-/.test(c)))].slice(0, 30)).catch(() => null) })));
    console.log('frames', JSON.stringify(res.frames).slice(0, 1500));
    let f = await instFrame();
    await waitDone(f, 60000);
    const s0 = await instRead(f);
    step('괴이 카드 설치 창 점검표', '(관찰) 카드 로어북·인사말·사진 갖춤, 위키·토크나이저 없음', s0, null);
    await t.shot(`${tag}-01-check`);
    block = /^(wiki-base|tok-o200k)\./;
    if (await f.$('[data-action="ed-inst-all"]')) {
      await f.click('[data-action="ed-inst-all"]');
      await waitDone(f);
      const s1 = await instRead(f);
      step('위키·토크나이저 끊고 「빠진 것 전부 채우기」', '나머지는 하고 끝에 안 된 것 둘을 한꺼번에(A-02·코스 A4 중간 실패해도 다음으로)', { ...s1, hits: hits.length }, /위키/.test(s1.err ?? '') && /토크나이저/.test(s1.err ?? ''));
      await t.shot(`${tag}-02-fail`);
      block = null;
      await f.click('[data-action="ed-inst-all"]');
      await waitDone(f);
      const s2 = await instRead(f);
      step('되살리고 다시 누름', '안 된 것만 이어서 → 모두 갖춤', s2, !s2.err && s2.rows.every((r) => !/없음 \(/.test(r)));
      await t.shot(`${tag}-03-done`);
    }
    // 이름 바꾸기 단추
    const nm0 = (await charInfo(goeiIdx)).name;
    step('봇 이름 줄', '(관찰) 지금 이름', nm0, null);
  }
  if (which === 'other') {
    // 빈 봇 만들기: 로어북 한 줄·첫 메시지
    const oi = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const i = ch.createNewCharacter(); const c = st.DBState.db.characters[i]; c.name = '시험 봇'; c.firstMessage = '안녕, 나는 시험 봇이야.'; c.globalLore = [{ key: '시험', comment: '시험 로어', content: '시험 로어 본문', mode: 'normal', insertorder: 100, alwaysActive: false, secondkey: '', selective: false }]; return i; });
    await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, oi);
    await sleep(2500);
    const before = await charInfo(oi);
    step('빈 봇 만듦', '(관찰)', before, null);
    // 유령 단추를 눌러도 아무것도 안 뜸 (공-22)
    const fab = await t.R(() => ({ shown: document.querySelector('[x-goei-fab]')?.style.display ?? null }));
    let opened = null;
    if (fab.shown === 'block') { await t.page.click('[x-goei-fab] button').catch(() => {}); await sleep(1500); opened = await t.frame('.gx', 3000).then(() => true).catch(() => false); }
    step('다른 봇: 유령 단추', '안 보이거나 눌러도 안 뜸(공-22)', { ...fab, opened }, fab.shown !== 'block' || opened === false);
    await t.shot(`${tag}-01-otherbot`);
    const h = await hamburger();
    step('다른 봇: 햄버거 → 설치 단추', '단추 있음', h, h === 'ok');
    const f = await instFrame();
    await waitDone(f, 60000);
    const s0 = await instRead(f);
    step('다른 봇 설치 창', '「아직 카드가 아니에요」 + 「괴이 ː ANOMALY 설치」 단추, 이름 줄 「그대로」', s0, /설치/.test(s0.main ?? ''));
    await t.shot(`${tag}-02-install`);
    await f.click('[data-action="ed-inst-all"]');
    await waitDone(f);
    const s1 = await instRead(f);
    const after = await charInfo(oi);
    step('설치 뒤 창', '(관찰) 된 것 글·남은 것', s1, null);
    step('설치 뒤 봇', '기존 로어북 그대로 + 설정 폴더·명부, 이름 그대로, 사진·아이콘', { before: { name: before.name, loreN: before.loreN }, after }, after.name === '시험 봇' && after.lore.includes('시험 로어') && after.loreN > before.loreN);
    await t.shot(`${tag}-03-installed`);
    // 그 봇에서 시작 패널이 뜨는지
    await t.closeWindow().catch(() => {});
    await t.page.keyboard.press('Escape').catch(() => {});
    await sleep(1500);
    const fab2 = await t.R(() => document.querySelector('[x-goei-fab]')?.style.display ?? null);
    let panel = null;
    try { await t.openWindow('.gx'); panel = await t.feval(() => document.querySelector('.gx')?.innerText?.replace(/\s+/g, ' ').slice(0, 200)); } catch (e) { panel = 'ERR ' + String(e?.message ?? e).slice(0, 120); }
    step('설치한 봇에서 유령 단추', '시작 패널(소속 고르기)이 뜸', { fab2, panel }, /소속|시작/.test(panel ?? ''));
    await t.shot(`${tag}-04-panel`);
    await t.closeWindow().catch(() => {});
    // 괴이 카드로 돌아오기: 첫 그리기
    await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, goeiIdx);
    await sleep(3000);
    const back = await t.screenMessages().catch(() => null);
    step('괴이 카드로 돌아옴(A7 다른 봇 다녀온 직후)', '(관찰) 인사말 칸 그려짐', back?.slice?.(0, 3), null);
    await t.shot(`${tag}-05-back`);
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.hits = hits.slice(0, 30);
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-40);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
