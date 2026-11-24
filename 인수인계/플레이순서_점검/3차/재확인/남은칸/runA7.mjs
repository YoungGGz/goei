// 재확인 남은 칸 · ABC A7 다른 봇 다녀온 직후 괴이 카드 첫 그리기 (원래 ABC/runA4.mjs other 의 끝 단계)
// 원래 대본은 시작 때 잡은 괴이 캐릭터 번호(charIndex)로 돌아가다 「reading 'chats'」로 멈췄다.
// 까닭(첫 판에서 확인): t.charIndex() 가 이 카드에서 -1 을 돌려줘 changeChar(-1) 이 던졌다(캐릭터 목록 순서는 안 바뀜).
// 고친 것: 시작 때 고른 캐릭터(selectedCharID)의 chaId 를 잡아 두고, 돌아갈 때 그 chaId 로 지금 번호를 찾는다. 앞뒤 캐릭터 목록도 남겨 원래 멈춤의 까닭을 본다.
// 나머지 순서(빈 봇 만들기 → 유령 단추 → 햄버거로 설치 → 설치한 봇 시작 패널)는 runA4.mjs other 그대로 옮김.
// 덧붙인 것: 괴이 채팅을 빈 인사말 대신 S-관리국-3턴(상태창 줄 있는 답 3개)으로 넣고, 돌아온 직후 화면(글·상태창 상자·유령 단추·창 첫 화면)을 본다.
// 사용: source /tmp/t2-rest/t2-env.sh && OUT=<dir> node runA7.mjs
import { openT2 } from '../../틀/risu-t2.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT; mkdirSync(OUT, { recursive: true });
const STATES = fileURLToPath(new URL('../../틀/states/', import.meta.url));
const tag = 'A7';
const t = await openT2({ via: 'plain', out: OUT });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 600)); };
let block = null; const hits = [];
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
const chars = () => t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const sel = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); }); return { sel, list: st.DBState.db.characters.map((c, i) => ({ i, chaId: c.chaId, name: c.name, chats: Array.isArray(c.chats) ? c.chats.length : null, type: c.type })) }; });
const idxOfCha = async (id) => (await chars()).list.findIndex((c) => c.chaId === id);
const screenDom = () => t.R(() => {
  const boxes = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')];
  return {
    title: document.querySelector('.default-chat-screen')?.closest('main, body')?.querySelector('h1, h2')?.innerText ?? null,
    n: boxes.length,
    msgs: boxes.map((b) => ({ idx: Number(b.dataset.chatIndex), text: (b.querySelector('.chattext')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 80), status: b.querySelectorAll('[data-goei-status]').length, rawStatus: /\[▣\|/.test(b.innerText) })).sort((a, b) => a.idx - b.idx),
    fab: document.querySelector('[x-goei-fab]')?.style.display ?? null,
  };
});
try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await t.fabReady();
  // 원래 대본의 t.charIndex() 는 카드 로어북 comment·key 에 goei|괴이 가 있는 캐릭터를 찾는데, 이 카드에서는 -1 을 돌려준다(첫 판에서 확인).
  // 그래서 지금 고른 캐릭터(selectedCharID, setup 이 changeChar 로 고른 괴이 카드)를 쓴다
  const charIndexOld = await t.charIndex();
  const before = await chars();
  const goeiIdx = before.sel;
  step('원래 대본의 charIndex()', '(관찰) 괴이 카드 번호를 찾나', charIndexOld, null);
  const goeiCha = before.list[goeiIdx]?.chaId;
  res.charsBefore = before;
  step('시작: 괴이 캐릭터', '(관찰) 번호·chaId', { goeiIdx, goeiCha }, null);
  const d0 = await screenDom();
  step('떠나기 전 괴이 채팅 화면', '(대조) 메시지 글·상태창 상자', d0, d0.msgs.some((m) => m.status > 0));
  await t.shot(`${tag}-00-goei-before`);
  // ── runA4 other 그대로 ──
  const oi = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const i = ch.createNewCharacter(); const c = st.DBState.db.characters[i]; c.name = '시험 봇'; c.firstMessage = '안녕, 나는 시험 봇이야.'; c.globalLore = [{ key: '시험', comment: '시험 로어', content: '시험 로어 본문', mode: 'normal', insertorder: 100, alwaysActive: false, secondkey: '', selective: false }]; return i; });
  const otherCha = (await chars()).list[oi]?.chaId;
  await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, oi);
  await sleep(2500);
  res.charsAfterCreate = await chars();
  step('빈 봇 만듦', '(관찰) 번호·목록', { oi, otherCha, list: res.charsAfterCreate.list }, null);
  const fab = await t.R(() => ({ shown: document.querySelector('[x-goei-fab]')?.style.display ?? null }));
  step('다른 봇: 유령 단추', '안 보임(공-22)', fab, fab.shown !== 'block');
  const h = await hamburger();
  step('다른 봇: 햄버거 → 설치 단추', '단추 있음', h, h === 'ok');
  const f = await instFrame();
  await waitDone(f, 60000);
  await f.click('[data-action="ed-inst-all"]');
  await waitDone(f);
  const s1 = await instRead(f);
  step('설치 뒤 창', '(관찰)', s1, null);
  await t.shot(`${tag}-01-installed`);
  await t.closeWindow().catch(() => {});
  await t.page.keyboard.press('Escape').catch(() => {});
  await sleep(1500);
  res.charsAfterInstall = await chars();
  step('설치 뒤 캐릭터 목록', '(관찰) 시작 때 잡은 괴이 번호가 아직 괴이 캐릭터인가', { goeiIdx, atGoeiIdx: res.charsAfterInstall.list[goeiIdx] ?? null, list: res.charsAfterInstall.list }, null);
  // ── 괴이 카드로 돌아오기 (chaId 로 번호를 다시 찾음) ──
  const back = await idxOfCha(goeiCha);
  step('괴이 캐릭터 지금 번호(chaId 로)', '찾음', { back, startIdx: goeiIdx }, back >= 0);
  await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, back);
  const t0 = Date.now();
  await t.page.waitForSelector('.default-chat-screen', { timeout: 60000 });
  // 첫 그리기: 1초 간격으로 다섯 번 찍어 언제 글·상태창이 그려지는지
  const seq = [];
  for (let k = 0; k < 6; k++) { const d = await screenDom(); seq.push({ ms: Date.now() - t0, n: d.n, withText: d.msgs.filter((m) => m.text).length, status: d.msgs.reduce((a, m) => a + m.status, 0), raw: d.msgs.filter((m) => m.rawStatus).length, fab: d.fab }); if (k === 0) await t.shot(`${tag}-02-back-0s`); await sleep(1000); }
  step('돌아온 직후 6초', '(관찰) 메시지 글·상태창 상자·유령 단추가 그려짐', seq, null);
  const d1 = await screenDom();
  step('돌아온 뒤 괴이 채팅 화면', '떠나기 전과 같음(메시지 글 보임·상태창 상자 있음·원문 [▣ 없음·유령 단추 보임)', d1, d1.msgs.filter((m) => m.text).length === d0.msgs.filter((m) => m.text).length && d1.msgs.reduce((a, m) => a + m.status, 0) === d0.msgs.reduce((a, m) => a + m.status, 0) && d1.fab === 'block');
  await t.shot(`${tag}-03-back`);
  let panel = null;
  try { await t.openWindow('.gx'); await sleep(1500); panel = await t.feval(() => document.querySelector('.gx')?.innerText?.replace(/\s+/g, ' ').slice(0, 240)); } catch (e) { panel = 'ERR ' + String(e?.message ?? e).slice(0, 120); }
  step('돌아온 뒤 창', '이 괴이 채팅 상황판(시작 패널·「괴이 카드 아님」 아님)', panel, /상황판/.test(panel ?? '') && !/아직 괴이 카드가 아니에요|새 작전 준비/.test(panel ?? ''));
  await t.shot(`${tag}-04-back-window`);
  await t.closeWindow().catch(() => {});
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.hits = hits.slice(0, 30);
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-40);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
  process.exit(0);
}
