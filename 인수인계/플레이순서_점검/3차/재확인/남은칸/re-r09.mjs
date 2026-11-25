// 재확인 남은 칸 · R09 답 기다리는 중 채팅 번호 밀림 → 답이 어느 채팅에 저장되나, 원래 채팅으로 돌아온 화면
// 사용: source /tmp/t2-rest/t2-env.sh && OUT=<dir> SP_STATES=<prep-states 결과 폴더> node re-r09.mjs <gn|shop|hs|wiki|phone> <new|del|imp>
//
// 차림: setup → 같은 상태 파일을 세 번 넣음 → 채팅 [0 C3, 1 C2, 2 C1, 3 Chat 1]. 1번(C2)을 「원래 채팅」으로 고른다.
//   C1·C3 은 C2 와 같은 상태(번호만 다름)라, 플러그인이 번호로 저장하면 그 자리에 온 이웃 채팅이 받아들일 수 있는 가장 나쁜 꼴이다.
// 번호 밀림 셋 (리스AI 996a553 코드와 같은 길, 모듈로 돎):
//   new : 채팅 목록 「새 채팅」 (chats.unshift + changeChatTo(0)) → 원래 채팅 2번, 1번 자리엔 C3
//   del : 채팅 목록 휴지통으로 0번(C3) 지우기 (SideChatList.svelte: changeChatTo(0) → ReloadGUIPointer+1 → splice) → 원래 채팅 0번(화면도 원래 채팅), 1번 자리엔 C1
//   imp : 채팅 목록 「가져오기」 json ver2 (characters.ts importChat: unshift, chatPage 그대로) → 원래 채팅 2번, 1번 자리(=지금 화면)엔 C3
// 기능 (답을 가짜 서버가 붙잡은 채 창을 닫고 번호를 민 뒤 답을 푼다):
//   gn    괴담넷 게시판 「새로고침」(목록 받기)             표식: 글 제목 「번호밀림 시험 게시글」
//   shop  장면 속 상점 카드 → 첫 진열 받기                   표식: 물건 「번호밀림 진열품」
//   hs    망상홈쇼핑 사이트 열기 → 편성 받기                 표식: 방송 제목 「번호밀림 특가 방송」
//   wiki  괴이위키 새 문서 작성                              표식: 문서 제목 「번호밀림 시험 문서」
//   phone 괴담톡 1:1 (에일린) 보내기                         표식: 답장 「번호 밀린 뒤 온 답장 R09」
// 기대값(재확인자, 공-02 근처): 답은 보낸 채팅(같은 chat.id)에만 저장되거나 버려진다. 다른 id 채팅엔 아무것도 안 바뀐다. 버렸으면 원래 채팅에서 다시 할 길이 보인다.
import { openRun, sleep, STATES, msgsText } from '../EG/lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const [feat, op] = process.argv.slice(2);
if (!['gn', 'shop', 'hs', 'wiki', 'phone'].includes(feat) || !['new', 'del', 'imp'].includes(op)) { console.error('사용: re-r09.mjs <gn|shop|hs|wiki|phone> <new|del|imp>'); process.exit(2); }
const OUT = `${process.env.OUT}/${feat}-${op}${process.env.ORIG0 === '1' ? '-orig0' : ''}`;
mkdirSync(OUT, { recursive: true });
const SPS = process.env.SP_STATES;
const FILE = { gn: STATES + 'S-관리국-3턴.json', phone: STATES + 'S-관리국-3턴.json', wiki: STATES + 'S-관리국-3턴.json', shop: `${SPS}/S-상점방문.json`, hs: `${SPS}/S-홈쇼핑망.json` }[feat];
const E = 'c_50303034';
const MARK = { gn: '번호밀림 시험 게시글', shop: '번호밀림 진열품', hs: '번호밀림 특가 방송', wiki: '번호밀림 시험 문서', phone: '번호 밀린 뒤 온 답장 R09' }[feat];

const GN_REPLY = JSON.stringify({ posts: [{ author: '야근요정', id: 1846003, tag: '현장', title: MARK, date: '2025.03.14 09:40', views: 120, upvotes: 4, content: '번호 밀림 시험 본문.', mine: false, comments: [] }], incoming: [], keyFigures: [] });
const SHOP_REPLY = `<shop-identity>\nsells: 성물\nnever: 무기\nprices: 원으로 받는다\ncurrency: -\n</shop-identity>\n<owner>\n천천히 보세요.\n</owner>\n<shelf>\n${MARK}|12000|손|귀중품/묵주/rosary|0.031|시험용 진열품||\n작은 성경|8000|-|서류/성경/bible|0.21|손바닥만 한 신약 성경||\n</shelf>`;
const HS_REPLY = `<title>\n${MARK}\n</title>\n<shelf>\n붉은 리본 손전등|100000|손|도구/손전등/flashlight|0.246|켜면 붉은 빛이 납니다.|어둠 속 길이 보인다|O|빛에 닿은 그림자를 떼어 낸다\n세 번 우는 벽시계|30000|사용|기기/벽시계/wall clock|1.84|정각마다 세 번 웁니다.|시간을 알려 준다|-|부르는 종\n</shelf>\n<cue>\n#1\nwide|talk|고객님들, 잘 오셨습니다.|-\nproduct|talk|첫 상품, 붉은 리본 손전등입니다.|price\n#2\nwide|talk|마지막, 세 번 우는 벽시계!|price\n</cue>\n<chat>\n#1\n야식왕|저거 진짜 켜져요?\n#2\nrose|시계 소리 왜 이럼\n</chat>`;
const WIKI_REPLY = `<lightboard-namuwiki doc_title="${MARK}">\n[Paragraph]\n## 개요\n${MARK}은 번호 밀림을 보려고 만든 시험 문서다.\n</lightboard-namuwiki>`;
const PH_REPLY = `<lb-minitalk-patch>${JSON.stringify([{ op: 'add', path: '/messages/-', value: { content: MARK, sender: E, type: 'text' } }])}</lb-minitalk-patch>`;
const GN_RE = /괴담넷 is a closed forum/;
const WIKI_RE = /encyclopedia article/;
const PH_RE = /Append NPC communication/;

const r = await openRun({ out: OUT, fake: process.env.FAKE_URL });
const { t, check, note } = r;
const res = { feat, op, at: new Date().toISOString() };

const chats = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
  const c = st.DBState.db.characters[ci];
  const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  return { page: c.chatPage, list: c.chats.map((ch, i) => { const blob = JSON.stringify({ ss: ch.scriptstate ?? {}, lore: ch.localLore ?? [] }); return { i, id: ch.id, name: ch.name, n: ch.message.length, hash: h(blob), blob }; }) };
});
const brief = (L) => L.list.map((c) => `${c.i}:${c.id.slice(0, 8)}:${c.name}`);
const act = (action, value) => t.feval(({ action, value }) => { const el = document.createElement('button'); el.dataset.action = action; if (value !== undefined) el.dataset.value = value; el.style.display = 'none'; (document.querySelector('.gx') || document.body).appendChild(el); el.click(); el.remove(); }, { action, value }).then(() => sleep(900));
const openNav = async (tab) => {
  await t.openWindow(); await sleep(1500);
  const vis = await t.F().locator(`.gx [data-action="nav-tab"][data-value="${tab}"]:visible`).count();
  if (vis) await t.fclick(`.gx [data-action="nav-tab"][data-value="${tab}"]:visible`); else await act('nav-tab', tab);
  await sleep(900);
};
const openSite = async (site, sel) => {
  await openNav('net');
  if (!(await t.feval((s) => !!document.querySelector(s), sel))) { if (!(await r.fclickAction('br-go', site))) await act('br-go', site); await sleep(1500); }
  return t.feval((s) => !!document.querySelector(s), sel);
};
const closeAll = async () => {
  await t.feval(() => { for (const a of ['shop-close', 'close']) { const b = [...document.querySelectorAll(`[data-action="${a}"]`)].find((e) => e.getClientRects().length); if (b) { b.click(); return a; } } return null; }).catch(() => null);
  await sleep(500);
  await t.closeWindow();
  await sleep(500);
};
const shotWin = async (name) => { await t.shot(`${feat}-${op}-${name}`).catch(() => {}); };

// ── 기능별 「보내고 붙잡기」·「돌아와 보기」 ──
const F = {
  gn: {
    async start() { r.on('aux', GN_REPLY, GN_RE); await openSite('gn', '.bs'); r.hold('aux'); await r.fclickAction('gn-refresh'); return r.until(async () => r.held().some((x) => GN_RE.test(msgsText(x.body))), 20000); },
    async view() { await openSite('gn', '.bs'); await sleep(1200); return (await r.ftext('.bs')).slice(0, 600); },
  },
  shop: {
    async start() { r.once('shop', SHOP_REPLY); r.hold('shop'); await r.until(async () => (await t.page.locator('.default-chat-screen [data-goei-shop]').count()) > 0, 20000); const ok = await (await import('../EG/lib.mjs')).clickChatCard(t); note('shop', '카드 누름', ok); return r.until(async () => r.held().length, 20000); },
    async view() { r.once('shop', SHOP_REPLY.replace(MARK, '다시 받은 진열품')); const ok = await (await import('../EG/lib.mjs')).clickChatCard(t); await sleep(2500); return ok ? (await r.ftext('.gx').catch(() => '(창 글 없음)')).slice(0, 600) : '(카드 없음)'; },
  },
  hs: {
    async start() { r.once('hs', HS_REPLY); r.hold('hs'); await openSite('hs', '.hs'); return r.until(async () => r.held().length, 25000); },
    async view() { r.once('hs', HS_REPLY.replace(MARK, '다시 받은 방송')); await openSite('hs', '.hs'); await sleep(2500); return (await r.ftext('.hs').catch(() => '')).slice(0, 600); },
  },
  wiki: {
    async start() {
      r.on('main', WIKI_REPLY, WIKI_RE);
      await openNav('wiki');
      if (!(await t.feval(() => !!document.querySelector('.wk')))) await act('br-go', 'wk');
      await t.F().locator('.wk-top [data-input="wiki-query"]:visible').first().fill(MARK); await sleep(200);
      await t.F().locator('.wk-top [data-action="wiki-search"]:visible').first().click(); await sleep(900);
      if (!(await t.feval(() => !!document.querySelector('.wk-compose')))) { await t.F().locator('[data-action="wiki-write"]:visible, [data-action="wiki-new"]:visible').first().click().catch(() => {}); await sleep(800); }
      note('wiki', '작성 화면', await t.feval(() => !!document.querySelector('.wk-compose [data-action="wiki-start"]')));
      r.hold('main');
      await t.F().locator('.wk-compose [data-action="wiki-start"]:visible').first().click();
      return r.until(async () => r.held().some((x) => WIKI_RE.test(msgsText(x.body))), 20000);
    },
    async view() {
      await openNav('wiki');
      if (!(await t.feval(() => !!document.querySelector('.wk')))) await act('br-go', 'wk');
      const home = (await r.ftext('.wk').catch(() => '')).slice(0, 400);
      await t.F().locator('.wk-top [data-input="wiki-query"]:visible').first().fill(MARK).catch(() => {}); await sleep(200);
      await t.F().locator('.wk-top [data-action="wiki-search"]:visible').first().click().catch(() => {}); await sleep(1200);
      return { home, title: (await r.ftext('.wk').catch(() => '')).slice(0, 500) };
    },
  },
  phone: {
    async openDm() {
      await openNav('phone');
      await t.F().locator('[data-action="ph-sub"][data-value="contacts"]').first().click().catch(() => {}); await sleep(500);
      let how = 'contacts';
      const ok = await t.F().locator(`[data-action="ph-dm"][data-value="${E}"]`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
      if (!ok) {
        how = 'chats';
        await t.F().locator('[data-action="ph-sub"][data-value="chats"]').first().click().catch(() => {}); await sleep(500);
        await t.F().locator(`[data-action="ph-room"][data-value="dm_${E}"]`).first().click({ timeout: 5000 }).catch(() => { how = 'none'; });
      }
      await sleep(900);
      return how;
    },
    async start() {
      r.on('aux', `<lb-minitalk-patch>${JSON.stringify([{ op: 'add', path: '/messages/-', value: { content: '대조 답 R09', sender: E, type: 'text' } }])}</lb-minitalk-patch>`, PH_RE);
      note('phone', '방 여는 길', await this.openDm());
      await t.F().locator('[data-input=ph-draft]').fill('대조 보내기.'); await t.F().locator('[data-action=ph-send]').click(); await sleep(4000);
      r.clearHandlers(); r.on('aux', PH_REPLY, PH_RE); r.hold('aux');
      await t.F().locator('[data-input=ph-draft]').fill('번호 밀림 시험.'); await t.F().locator('[data-action=ph-send]').click();
      return r.until(async () => r.held().some((x) => PH_RE.test(msgsText(x.body))), 20000);
    },
    async view() {
      const how = await this.openDm();
      const vis = await t.feval(() => { const q = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length); return { log: (document.querySelector('.ph-log')?.innerText ?? '').slice(-300), retry: q('[data-action="ph-retry"]').length, skip: q('[data-action="ph-skip"]').length, typing: q('.ph-typing').length, draftDisabled: document.querySelector('[data-input=ph-draft]')?.disabled ?? null }; });
      return { how, ...vis };
    },
  },
};

const doOp = async () => {
  if (op === 'new') return t.newChat();
  if (op === 'del') return t.R(async () => {
    const st = await import('/src/ts/stores.svelte.ts');
    const g = await import('/src/ts/globalApi.svelte.ts');
    const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
    const chara = st.DBState.db.characters[ci];
    // SideChatList.svelte 휴지통(확인 yes 뒤)과 같은 차례
    g.changeChatTo(0);
    st.ReloadGUIPointer.update((v) => v + 1);
    const cs = chara.chats; cs.splice(0, 1); chara.chats = cs;
    return { chatPage: chara.chatPage, n: chara.chats.length };
  }).then(async (x) => { await sleep(800); return x; });
  if (op === 'imp') return t.loadState(FILE, { select: false, storage: false });
};

try {
  await t.setup();
  // ORIG0=1: 상태를 한 번만 넣고 0번을 원래 채팅으로 (이웃에 같은 상태가 없는 흔한 꼴. new 만 뜻이 있음 — 새 채팅이 0번 자리에 온다)
  const ORIG0 = process.env.ORIG0 === '1';
  for (let k = 0; k < (ORIG0 ? 1 : 3); k++) { await t.loadState(FILE); await sleep(1200); }
  if (!ORIG0) { await t.switchChat(1); await sleep(1500); }
  // 한 번만 넣으면 가져오기 전에도 0번을 보고 있어서 리스AI 가 화면을 다시 그리지 않는다(states/README 「넣는 차례」) → 1번을 거쳐 0번으로 (상점 카드가 화면에 그려지게)
  else { await t.switchChat(1); await sleep(1200); await t.switchChat(0); await sleep(1500); }
  let L = await chats();
  const ORIG = L.list[ORIG0 ? 0 : 1].id;
  res.orig0 = ORIG0;
  res.before = brief(L);
  note('준비', '채팅 목록(원래 = 1번)', { page: L.page, list: brief(L) });
  const held = await F[feat].start();
  check('붙잡기', '그 기능 요청이 가짜 서버에 붙잡힘', !!held, '붙잡힘', r.held().map((x) => x.kind));
  await closeAll();
  const pre = await chats();
  const opRes = await doOp();
  await sleep(1500);
  const mid = await chats();
  const origIdx = mid.list.findIndex((c) => c.id === ORIG);
  res.afterOp = { op: opRes && typeof opRes === 'object' ? { chatPage: opRes.chatPage, n: opRes.n ?? opRes.nChats } : opRes, page: mid.page, origIdx, list: brief(mid), atOldIdx: mid.list[process.env.ORIG0 === '1' ? 0 : 1] ? `${mid.list[1].id.slice(0, 8)}:${mid.list[1].name}` : null };
  note('번호 밀림', `${op} 뒤 (원래 채팅 1번 → ${origIdx}번, 화면 ${mid.page}번)`, res.afterOp);
  // 답 풀기
  const kind = { gn: 'aux', phone: 'aux', shop: 'shop', hs: 'hs', wiki: 'main' }[feat];
  await r.unhold(kind);
  await sleep(6000);
  const post = await chats();
  const hasMark = (c) => feat === 'wiki' ? (JSON.parse(c.blob).lore ?? []).some((e) => String(e.comment ?? '') === `WIKI｜${MARK}`) : c.blob.includes(MARK);
  const preById = new Map([...pre.list, ...mid.list].map((c) => [c.id, c]));
  const changed = post.list.filter((c) => preById.get(c.id)?.hash !== c.hash).map((c) => ({ i: c.i, id: c.id.slice(0, 8), name: c.name, orig: c.id === ORIG, mark: hasMark(c) }));
  const marked = post.list.filter(hasMark).map((c) => ({ i: c.i, id: c.id.slice(0, 8), name: c.name, orig: c.id === ORIG }));
  res.changed = changed; res.marked = marked;
  note('답 뒤', '표식이 들어간 채팅', marked);
  note('답 뒤', '번호 밀린 뒤 내용이 바뀐 채팅(전부)', changed);
  check('저장 자리', '기대: 원래 채팅 말고 다른 id 채팅에 변화 없음', changed.every((c) => c.orig), '원래 채팅만 또는 없음', changed, '공-02');
  note('저장 자리', '원래 채팅에 답이 들어감', marked.some((c) => c.orig));
  res.goeiLog = t.errors.filter((e) => /\[goei\]/.test(e)).slice(-12);
  // 지금 화면(번호 민 뒤 고른 채팅)에서 그 기능을 열어 봄
  res.curView = await F[feat].view().catch((e) => 'ERR ' + String(e?.message ?? e).slice(0, 160));
  await shotWin('1-지금채팅');
  note('화면', `지금 고른 채팅(${post.page}번) 창`, res.curView);
  await closeAll();
  // 원래 채팅으로 돌아와 봄
  const oi = (await chats()).list.findIndex((c) => c.id === ORIG);
  if (oi !== post.page) { await t.switchChat(oi); await sleep(1500); }
  res.origView = await F[feat].view().catch((e) => 'ERR ' + String(e?.message ?? e).slice(0, 160));
  await shotWin('2-원래채팅');
  note('화면', `원래 채팅(${oi}번)으로 돌아와 연 창`, res.origView);
  await closeAll();
} catch (e) {
  res.error = String(e?.stack ?? e); console.error(e);
  await shotWin('FAIL');
}
res.errors = t.errors.filter((e) => !/displayData/.test(e)).slice(-30);
writeFileSync(`${OUT}/결과.json`, JSON.stringify({ ...res, results: r.results }, null, 1));
r.writeResults(`${OUT}/check.json`);
await r.stop(); await t.close();
process.exit(0);
