// 3차 재확인 F (재현 관점) · T2 실제 리스AI + 가짜 모델 서버. 원래 점검자의 run-t2.mjs·메모 순서를 다시 짜서 돌린다.
// R26 연락처 탭 이름 · R28 위키 작성 중 다른 채팅 다녀오기 · R23 괴담톡 보내기 때 채팅 저장이 조용히 안 됨(리스AI dbWrite 권한 거절 길)
// 쓰는 법: source /tmp/t2-F/t2-env.sh; OUT=<폴더> node 인수인계/플레이순서_점검/3차/재확인/F/re-f-t2.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openT2 } from '../../틀/risu-t2.mjs';

const OUT = process.env.OUT || '/tmp/re-f-out';
const STATES = fileURLToPath(new URL('../../틀/states/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const E = 'c_50303034'; // 에일린 P004
const patch = (...texts) => `<lb-minitalk-patch>${JSON.stringify(texts.map((content) => ({ op: 'add', path: '/messages/-', value: { content, sender: E, type: 'text' } })))}</lb-minitalk-patch>`;
const MAIN = '가짜 본편 답 #{{seq}}.\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';

const res = { at: new Date().toISOString(), steps: [], notes: [] };
const step = (id, expect, ok, actual) => { res.steps.push({ id, expect, ok: !!ok, actual }); console.log(ok ? 'ok  ' : 'FAIL', id, JSON.stringify(actual).slice(0, 300)); };
const note = (id, v) => { res.notes.push({ id, v }); console.log('NOTE', id, JSON.stringify(v).slice(0, 300)); };

const t = await openT2({ via: 'plain', out: OUT, width: 344, height: 882, touch: true });
const rules = (r) => t.fake('rules', { rules: [...r, { id: 'default-aux', route: 'aux', reply: '{}' }, { id: 'default-main', route: 'main', reply: MAIN }] });
const ftext = () => t.feval(() => (document.querySelector('.ph-app') || document.querySelector('.gx'))?.innerText ?? '');
const chatsInfo = () => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const ch = st.DBState.db.characters.at(-1);
  return { chatPage: ch.chatPage, chats: ch.chats.map((c) => { let p = null; try { p = JSON.parse(c.scriptstate?.['$ph_state'] || 'null'); } catch {} return { name: c.name, wiki: (c.localLore ?? []).filter((e) => String(e.comment).startsWith('WIKI｜')).map((e) => e.comment), dm: p?.rooms?.[`dm_c_50303034`]?.messages?.map((m) => m.text) ?? null, pending: p?.rooms?.[`dm_c_50303034`]?.pending ?? null }; }) };
});
// 폰 배치에서는 탭 단추가 서랍 속이라 보이지 않을 수 있어, 원래 점검의 act 처럼 숨은 단추를 만들어 누른다 (같은 data-action 길)
const act = (action, value) => t.feval(({ action, value }) => { const el = document.createElement('button'); el.dataset.action = action; if (value !== undefined) el.dataset.value = value; el.style.display = 'none'; (document.querySelector('.ph-app') || document.querySelector('.gx') || document.body).appendChild(el); el.click(); el.remove(); }, { action, value }).then(() => sleep(900));
const openNav = async (tab) => { await t.openWindow(); await sleep(1500); const vis = await t.F().locator(`.gx [data-action="nav-tab"][data-value="${tab}"]:visible`).count(); if (vis) await t.fclick(`.gx [data-action="nav-tab"][data-value="${tab}"]:visible`); else await act('nav-tab', tab); await sleep(900); };

try {
  await t.fake('reset', {});
  await rules([]);
  const su = await t.setup();
  note('setup', su);
  // 0 S-관리국-3턴, 1 S-백일몽-3턴, 2 Chat 1 (백일몽을 먼저 넣고 관리국을 넣어 0번에)
  note('load 백일몽', await t.loadState(STATES + 'S-백일몽-3턴.json', { select: false }));
  await sleep(2500);
  note('load 관리국', await t.loadState(STATES + 'S-관리국-3턴.json'));
  let ci = await chatsInfo();
  note('chats', ci);
  if (ci.chats[0].name !== 'S-관리국-3턴' || ci.chats[1].name !== 'S-백일몽-3턴') throw new Error('상태 넣기가 어긋남: ' + ci.chats.map((c) => c.name).join(','));

  // ── R26 연락처 탭 이름 ──
  await openNav('phone');
  await t.F().locator('[data-action="ph-sub"][data-value="contacts"]').first().click().catch(() => {}); await sleep(500);
  const chips = await t.feval(() => [...document.querySelectorAll('[data-action="ph-ctab"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  await t.shot('R26-contacts-phone');
  step('R26 연락처 탭', '「이면의 주민들」 탭이 있고 「중립」 탭은 없음 (공-20 사용자 결정)', chips.some((c) => /이면의 주민들/.test(c)) && !chips.some((c) => /^중립/.test(c)), chips);
  // 카드 로어북의 괴담톡 탭 자리 (설치 자료가 들어간 곳)
  note('R26 카드 로어북 탭 이름', await t.R(async () => {
    const st = await import('/src/ts/stores.svelte.ts');
    const ch = st.DBState.db.characters.at(-1);
    return (ch.globalLore ?? []).filter((l) => /중립|이면의 주민들/.test(String(l.content)) && /탭|tab/i.test(String(l.comment) + String(l.content).slice(0, 200))).map((l) => ({ comment: l.comment, hit: (String(l.content).match(/.{0,60}(중립|이면의 주민들).{0,60}/) || [])[0] })).slice(0, 6);
  }));
  await t.closeWindow();

  // ── R28 위키 작성 중 다른 채팅 다녀오기 ──
  // 대조: 같은 채팅에 머물면 실패 안내가 뜨는지
  const WIKI_RULE = { id: 'wiki-500', route: 'any', match: 'lightboard-namuwiki', status: 500, hold: true };
  await rules([WIKI_RULE]);
  const wikiCompose = async (title) => {
    await openNav('wiki');
    if (!(await t.feval(() => !!document.querySelector('.wk')))) await act('br-go', 'wk');
    await t.F().locator('.wk-top [data-input="wiki-query"]:visible').first().fill(title); await sleep(200);
    await t.F().locator('.wk-top [data-action="wiki-search"]:visible').first().click(); await sleep(900);
    // 검색 결과 화면이면 「작성하기」
    if (!(await t.feval(() => !!document.querySelector('.wk-compose')))) { await t.F().locator('[data-action="wiki-write"]:visible, [data-action="wiki-new"]:visible').first().click().catch(() => {}); await sleep(800); }
    return t.feval(() => !!document.querySelector('.wk-compose [data-action="wiki-start"]'));
  };
  const pendingWiki = async () => (await t.fake('pending')).length;
  {
    const ok = await wikiCompose('빛이 없으라');
    note('R28-대조 작성 화면', ok);
    await t.F().locator('.wk-compose [data-action="wiki-start"]:visible').first().click(); await sleep(1500);
    note('R28-대조 붙잡힌 요청', await pendingWiki());
    await t.fake('release', {}); await sleep(1500);
    for (let i = 0; i < 3 && (await pendingWiki()); i++) { await t.fake('release', {}); await sleep(1500); }
    await sleep(2500);
    const txt = await t.feval(() => document.querySelector('.wk')?.innerText ?? '');
    await t.shot('R28-control-same-chat');
    step('R28-대조 같은 채팅', '실패 안내 「문서를 만들지 못했어요」', /문서를 만들지 못했어요/.test(txt), (txt.match(/[^\n]*만들지 못했[^\n]*/) || [txt.slice(0, 200)])[0]);
    await t.closeWindow();
  }
  {
    const ok = await wikiCompose('달빛 타투샵');
    note('R28 작성 화면', ok);
    const s0 = (await t.fake('log?full=0')).length;
    await t.F().locator('.wk-compose [data-action="wiki-start"]:visible').first().click(); await sleep(1500);
    note('R28 붙잡힌 요청', await pendingWiki());
    await t.closeWindow();
    await t.switchChat(1); await sleep(1000);
    note('R28 바꾼 뒤', (await chatsInfo()).chatPage);
    await openNav('wiki');
    for (let i = 0; i < 4; i++) { await t.fake('release', {}); await sleep(1800); }
    await sleep(2000);
    const other = await t.feval(() => document.querySelector('.wk')?.innerText ?? '');
    await t.shot('R28-other-chat');
    step('R28 다른 채팅에 실패 안내 안 뜸', '앞 채팅 실패가 안 뜸(0.21.34 고침)', !/달빛 타투샵」 문서를 만들지/.test(other), (other.match(/[^\n]*만들지 못했[^\n]*/) || [''])[0]);
    const log = (await t.fake('log?full=0')).slice(s0);
    note('R28 위키 요청 수·상태', log.map((x) => ({ seq: x.seq, route: x.route, rule: x.ruleId, status: x.response?.status })));
    await t.closeWindow();
    await t.switchChat(0); await sleep(1200);
    await openNav('wiki');
    if (!(await t.feval(() => !!document.querySelector('.wk')))) await act('br-go', 'wk');
    const home = await t.feval(() => document.querySelector('.wk')?.innerText ?? '');
    await t.shot('R28-back-home');
    note('R28 돌아와 위키 첫 화면(앞 400자)', home.slice(0, 400));
    // 같은 제목을 다시 찾아 들어가 봄
    await t.F().locator('.wk-top [data-input="wiki-query"]:visible').first().fill('달빛 타투샵'); await sleep(200);
    await t.F().locator('.wk-top [data-action="wiki-search"]:visible').first().click(); await sleep(1200);
    const doc = await t.feval(() => document.querySelector('.wk')?.innerText ?? '');
    const btn = await t.feval(() => document.querySelector('.wk-compose [data-action="wiki-start"]')?.innerText ?? null);
    await t.shot('R28-back-title');
    const info = await chatsInfo();
    step('R28 원래 채팅으로 돌아옴', '실패를 알 수 있는 안내가 있음(공-02 Claude 판정 기대)', /만들지 못했|실패/.test(home + doc), { home: (home.match(/[^\n]*(만들지 못했|실패)[^\n]*/) || [''])[0], doc: (doc.match(/[^\n]*(만들지 못했|실패)[^\n]*/) || [''])[0], btn, wikiDocs0: info.chats[0].wiki });
    await t.closeWindow();
  }

  // ── R23 괴담톡 보내기: dbWrite 권한 거절 → setChatToIndex 가 조용히 안 씀 ──
  await rules([{ id: 'ph', route: 'aux', match: 'Append NPC communication', reply: patch('응, 들었어.') }]);
  // 대조: 권한 있을 때 보내기
  const openDm = async () => {
    await openNav('phone');
    await t.F().locator('[data-action="ph-sub"][data-value="contacts"]').first().click().catch(() => {}); await sleep(400);
    await t.fclick(`[data-action="ph-dm"][data-value="${E}"]`); await sleep(900);
  };
  await openDm();
  await t.F().locator('[data-input=ph-draft]').fill('권한 있을 때.'); await t.F().locator('[data-action=ph-send]').click(); await sleep(4000);
  const c1 = await chatsInfo();
  step('R23-대조 권한 있음', '방에 내 글·답 저장', (c1.chats[0].dm ?? []).includes('권한 있을 때.'), c1.chats[0].dm);
  await t.closeWindow();
  // 3일 지난 권한으로 만든다(리스AI getPluginPermission 'periodically': 마지막 허락 3일 넘으면 다시 묻고, 거절은 이 세션 동안 기억)
  const pname = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); return st.DBState.db.plugins.map((p) => p.name); });
  note('R23 플러그인 이름', pname);
  const put = await t.R(async (name) => new Promise((resolve) => {
    const rq = indexedDB.open('plugin_permissions');
    rq.onsuccess = () => {
      const db = rq.result;
      const tx = db.transaction('plugin_permissions', 'readwrite');
      const os = tx.objectStore('plugin_permissions');
      const keys = os.getAllKeys();
      os.put(Date.now() - 4 * 24 * 3600 * 1000, `${name}_dbWrite_lastGrantTime`);
      tx.oncomplete = () => resolve({ keys: keys.result });
      tx.onerror = () => resolve({ err: String(tx.error) });
    };
    rq.onerror = () => resolve({ err: String(rq.error) });
  }), pname[0]);
  note('R23 권한 저장소(바꾸기 전 열쇠)', put);
  await t.ctx.addInitScript(() => { window.__t2Answer = 'no'; });
  await t.reload();
  await sleep(3000);
  note('R23 새로고침 뒤 알림', await t.alerts());
  await openDm();
  await sleep(1000);
  await t.F().locator('[data-input=ph-draft]').fill('권한 거절 뒤.'); await t.F().locator('[data-action=ph-send]').click(); await sleep(4000);
  const draft = await t.feval(() => document.querySelector('[data-input="ph-draft"]')?.value ?? null);
  const txt = await ftext();
  await t.shot('R23-after-deny');
  const c2 = await chatsInfo();
  const al = await t.alerts();
  note('R23 알림(권한 묻기)', al);
  const aux = (await t.fake('log?full=0')).filter((x) => x.ruleId === 'ph').length;
  note('R23 괴담톡 보조 호출 누적', aux);
  step('R23 권한 거절 뒤 보내기', '저장이 안 됐으면 입력칸에 글이 남거나 실패 안내(공-02 Claude 판정 기대)', draft === '권한 거절 뒤.' || /실패|못/.test(txt.slice(-300)), { draft, savedDm: c2.chats[0].dm, screenTail: txt.slice(-160), dbWriteAsked: al.filter((a) => /modify your database|데이터베이스를 수정/.test(a.msg)).length });
} catch (e) {
  step('예외', '', false, String(e?.stack ?? e).slice(0, 800));
  try { await t.shot('FAIL'); } catch {}
} finally {
  res.errors = t.errors.slice(-60);
  writeFileSync(`${OUT}/re-f-t2.json`, JSON.stringify(res, null, 1));
  console.log('결과', `${OUT}/re-f-t2.json`, res.steps.filter((s) => s.ok).length, '/', res.steps.length);
  await t.close();
}
