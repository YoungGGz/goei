// 재확인 남은칸 R23 게시판·위키 꼴 — T2 실제 리스AI: 「데이터베이스 수정」 권한(dbWrite)을 거절한 뒤 괴담넷 글쓰기·위키 문서 만들기.
// 거절 만들기는 재확인/F/re-f-t2.mjs 와 같음(권한 저장소 lastGrantTime 4일 전 → 새로고침 → no). 폰 344×882 손가락(F 재확인과 같은 크기).
// 쓰는 법: source /tmp/t2-remain/t2-env.sh; OUT=<폴더> node r23-t2.mjs
import { session, sleep } from './lib.mjs';

const S = await session('R23', { w: 344, h: 882, touch: true });
const { t, step, note } = S;
const POST = (tag) => ({ id: `post-${tag}`, route: 'aux', match: `RE23-POST-${tag}`, reply: JSON.stringify({ post: { title: `RE23 제목 ${tag}`, content: `RE23 본문 ${tag}` }, comments: [] }) });
const WIKI = { id: 'wiki', route: 'any', match: 'lightboard-namuwiki', reply: '<lightboard-namuwiki doc_title="x">\n[Paragraph]\nRE23 위키 본문 #{{seq}}.\n</lightboard-namuwiki>' };
const app = () => S.fe(() => (document.querySelector('.br') || document.querySelector('.ph-app') || document.querySelector('.gx'))?.innerText ?? '');
const act = (action, value) => S.fe(({ action, value }) => { const el = document.createElement('button'); el.dataset.action = action; if (value !== undefined) el.dataset.value = value; el.style.display = 'none'; (document.querySelector('.gx') || document.body).appendChild(el); el.click(); el.remove(); }, { action, value }).then(() => sleep(900));
const openNav = async (tab) => { await S.winOpen(); await sleep(1200); const F = await S.frame(); const vis = await F.locator(`.gx [data-action="nav-tab"][data-value="${tab}"]:visible`).count(); if (vis) await F.locator(`.gx [data-action="nav-tab"][data-value="${tab}"]:visible`).first().click(); else await act('nav-tab', tab); await sleep(900); };
const chatInfo = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const ch = st.DBState.db.characters.at(-1);
  const c = ch.chats[ch.chatPage];
  return { ss: JSON.stringify(c.scriptstate ?? {}), wiki: (c.localLore ?? []).filter((e) => String(e.comment).startsWith('WIKI｜')).map((e) => e.comment) };
});
const auxCount = async (id) => (await S.log(0)).filter((x) => x.ruleId === id).length;

async function openBoard() {
  await openNav('net');
  if (!(await S.has('.gx [data-action="gn-write"]'))) { if (!(await S.has('[data-action="br-go"][data-value="gn"]'))) await act('br-site', 'gn'); else await act('br-go', 'gn'); await sleep(1200); }
}
async function writePost(tag) {
  await openBoard();
  const F = await S.frame();
  const wb = F.locator('[data-action="gn-write"]:visible');
  if (await wb.count()) await wb.first().click(); else await act('gn-write');
  await sleep(900);
  await F.locator('[data-input="gn-draft"]:visible').first().fill(`RE23-POST-${tag} 게시판에 올릴 글.`);
  await sleep(300);
  await F.locator('[data-action="gn-send"]:visible').first().click();
  await sleep(6000);
  return app();
}
async function wikiCompose(title) {
  await openNav('wiki');
  if (!(await S.has('.wk'))) await act('br-go', 'wk');
  const F = await S.frame();
  await F.locator('.wk-top [data-input="wiki-query"]:visible').first().fill(title); await sleep(200);
  await F.locator('.wk-top [data-action="wiki-search"]:visible').first().click(); await sleep(900);
  if (!(await S.has('.wk-compose'))) { await F.locator('[data-action="wiki-write"]:visible, [data-action="wiki-new"]:visible').first().click().catch(() => {}); await sleep(800); }
  await F.locator('.wk-compose [data-action="wiki-start"]:visible').first().click();
  await sleep(6000);
  return S.fe(() => document.querySelector('.wk')?.innerText ?? '');
}

try {
  await S.fakeReset([POST('A'), POST('B'), WIKI]);
  note('setup', await t.setup());
  note('load', await S.loadState('S-관리국-3턴.json'));
  await sleep(2000);

  // ── 대조: 권한 있을 때 ──
  {
    const txt = await writePost('A');
    const ci = await chatInfo();
    await t.shot('R23-board-대조');
    step('대조 괴담넷 글쓰기(권한 있음)', '글이 저장되고 목록·화면에 보임', '-').check(ci.ss.includes('RE23 제목 A') && /RE23 제목 A/.test(txt), { saved: ci.ss.includes('RE23 제목 A'), screen: (txt.match(/[^\n]*RE23[^\n]*/g) ?? []).slice(0, 3), notice: (txt.match(/[^\n]*(올렸어요|못했|실패)[^\n]*/) ?? [''])[0], aux: await auxCount('post-A') });
    await S.winClose();
  }
  {
    const txt = await wikiCompose('빛이 없으라');
    const ci = await chatInfo();
    await t.shot('R23-wiki-대조');
    step('대조 위키 문서(권한 있음)', '문서가 저장되고 화면에 본문', '-').check(ci.wiki.some((w) => w.includes('빛이 없으라')) && /RE23 위키 본문/.test(txt), { wiki: ci.wiki, screen: (txt.match(/[^\n]*RE23[^\n]*/) ?? [''])[0], aux: await auxCount('wiki') });
    await S.winClose();
  }

  // ── 권한 거절 만들기 ──
  const pname = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return st.DBState.db.plugins.map((p) => p.name); });
  note('권한 저장소', await t.R(async (name) => new Promise((resolve) => { const rq = indexedDB.open('plugin_permissions'); rq.onsuccess = () => { const tx = rq.result.transaction('plugin_permissions', 'readwrite'); tx.objectStore('plugin_permissions').put(Date.now() - 4 * 24 * 3600 * 1000, `${name}_dbWrite_lastGrantTime`); tx.oncomplete = () => resolve('ok'); tx.onerror = () => resolve(String(tx.error)); }; rq.onerror = () => resolve(String(rq.error)); }), pname[0]));
  await t.ctx.addInitScript(() => { window.__t2Answer = 'no'; });
  await t.reload();
  await sleep(3000);

  // ── 게시판 글쓰기 ──
  {
    const a0 = await auxCount('post-B');
    const txt = await writePost('B');
    const ci = await chatInfo();
    const draft = await S.fe(() => document.querySelector('[data-input="gn-draft"]')?.value ?? null);
    await t.shot('R23-board-거절뒤');
    step('괴담넷 글쓰기(권한 거절 뒤)', '저장이 안 됐으면 안내하고 쓴 글이 남음 (R23 기대)', 'R23').check(!/글을 올렸어요/.test(txt) && (/못|실패/.test(txt) || (draft ?? '').includes('RE23-POST-B')), { saved: ci.ss.includes('RE23 제목 B'), screenHasPost: /RE23 제목 B/.test(txt), notice: (txt.match(/[^\n]*(올렸어요|못했|실패|없어요)[^\n]*/g) ?? []).slice(0, 3), draftLeft: draft, screenAll: txt.replace(/\s+/g, ' ').slice(0, 700), auxCalls: (await auxCount('post-B')) - a0, alerts: (await t.alerts()).map((a) => a.msg.slice(0, 80)) });
    await S.winClose();
  }
  // ── 위키 문서 ──
  {
    const a0 = await auxCount('wiki');
    const txt = await wikiCompose('달빛 타투샵');
    const ci = await chatInfo();
    await t.shot('R23-wiki-거절뒤');
    step('위키 문서 만들기(권한 거절 뒤)', '저장이 안 됐으면 안내 (R23 기대)', 'R23').check(/못했|실패/.test(txt) && !ci.wiki.some((w) => w.includes('달빛 타투샵')) || ci.wiki.some((w) => w.includes('달빛 타투샵')), { wiki: ci.wiki, screenHead: txt.slice(0, 260), screenHasBody: /RE23 위키 본문/.test(txt), notice: (txt.match(/[^\n]*(못했|실패|찾을 수 없)[^\n]*/g) ?? []).slice(0, 3), auxCalls: (await auxCount('wiki')) - a0 });
    await S.winClose();
  }
} catch (e) {
  step('예외', '', '-').check(false, String(e?.stack ?? e).slice(0, 1500));
  try { await t.shot('R23-FAIL'); } catch {}
} finally {
  S.rec.errors = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  await S.close();
}
