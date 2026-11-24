// 전수점검 3차 L 구간 (이미지·아바타) — 다시 돌리기:
//   node 틀/fake-llm.mjs --port 8804 --log L/out/fake.jsonl &         (가짜 모델 서버, L 전용)
//   FAKE_URL=http://<컨테이너IP>:8804 node L/run.mjs <단계…>         (단계 이름은 아래 STEPS, 없으면 ORDER 전부)
//   또는 drv.mjs 로 세션을 띄워 둔 채 {"step":"…"} 로 하나씩.
// 결과: L/out/steps.jsonl (단계마다 기대값·결정표 줄·실제값·근거), 요청 전문 L/out/req-*.json, 캡처 L/out/*.png
import { writeFileSync, appendFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = HERE + '/out';
export const STATES = HERE + '/../틀/states';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 기록 ─────────────────────────────────────────────
export const results = [];
/** 단계 하나: 기대값·결정표 줄을 먼저 적고 돌린 뒤 실제값과 대조 */
export function rec(id, { expect, rule, ok, actual, evidence }) {
  const r = { id, at: new Date().toISOString(), expect, rule, ok: !!ok, actual, evidence };
  results.push(r);
  appendFileSync(OUT + '/steps.jsonl', JSON.stringify(r) + '\n');
  console.log(`[${ok ? '통과' : '어긋남'}] ${id} — ${typeof actual === 'string' ? actual : JSON.stringify(actual).slice(0, 300)}`);
  return r;
}
/** 나이 줄 값은 [생략] (공통 규칙) */
const scrub = (s) => String(s).replace(/((?:Age|나이)\s*[:=]\s*)[^\n|,]+/gi, '$1[생략]');
export function saveReq(name, rec0) {
  const body = rec0?.body ?? rec0;
  writeFileSync(`${OUT}/req-${name}.json`, scrub(JSON.stringify(body, null, 1)));
  const msgs = body?.messages ?? [];
  writeFileSync(`${OUT}/req-${name}.txt`, scrub(msgs.map((m, i) => `===== [${i}] ${m.role} =====\n${m.content}`).join('\n\n')));
  return `out/req-${name}.txt`;
}

// ── 대본 ─────────────────────────────────────────────
export const STATUS = (time = '10:20 AM') => `[▣|2025.03.14|${time}|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]`;
/** 메인 방식: 지침대로 태그를 쓴 답 (세트 밖 표정 하나, 없는 이름 하나 섞음) */
export const REPLY_MAIN = (n = 1, time) => `잼트리가 고개를 갸웃했다. "벌써 가려고? 출입증은 챙겼고?" (메인 ${n})

<img=Jaemtri_curious>

쟈알디가 로비 반대편에서 걸어왔다. 장갑 낀 손으로 서류철을 든 채, 짧게 고개를 끄덕였다.

<img=Jyaldi_serious>

경비원이 하품을 했다.

<img=Jaemtri_neutral>

<img=Nobody_smile>

${STATUS(time)}`;
/** 보조 방식: 태그 없는 답 (단락 셋, 잼트리·쟈알디 이름이 나옴) */
export const REPLY_PLAIN = (n = 1, time) => `잼트리가 고개를 갸웃했다. "벌써 가려고? 출입증은 챙겼고?" (보조 ${n})

쟈알디가 로비 반대편에서 걸어왔다. 장갑 낀 손으로 서류철을 든 채, 짧게 고개를 끄덕였다.

창밖으로 오후 햇빛이 길게 들었다.

${STATUS(time)}`;
export const PATCH_OK = '[{"line":1,"tag":"<img=\\"Jaemtri_curious\\">"},{"line":2,"tag":"<img=\\"Jyaldi_serious\\">"}]';

export const AUX_BASE = [
  { id: 'aux-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
  { id: 'aux-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
  { id: 'aux-img', route: 'aux', match: 'Insert <img> tags into a finished narrative', reply: PATCH_OK },
  { id: 'aux-any', route: 'aux', reply: '{}' },
];
export async function rules(t, mainRules, auxOver = []) {
  await t.fake('rules', { rules: [...mainRules, ...auxOver, ...AUX_BASE] });
}
export const main = (reply, extra = {}) => ({ id: 'main', route: 'main', reply, ...extra });

// ── 리스AI·플러그인 도우미 ──────────────────────────────
export const db = (t, fn, arg) => t.R(fn, arg);
/** 지금 채팅 (원문 그대로) */
export const chat = (t) => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const ci = await new Promise((r) => { const u = st.selectedCharID.subscribe((v) => r(v)); u?.(); });
  const c = st.DBState.db.characters[ci];
  const ch = c.chats[c.chatPage];
  return { ci, page: c.chatPage, id: ch.id, msgs: ch.message.map((m) => ({ role: m.role, data: m.data, swipes: m.swipes?.length ?? null })), ss: Object.fromEntries(Object.entries(ch.scriptstate ?? {}).filter(([k]) => /asset|look|img|act_gap|st_player/.test(k))) };
});
/** 플러그인 기기 설정 */
export const prefs = (t) => t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); const v = await cs.pluginStorage.getItem('goei:prefs'); try { return JSON.parse(v); } catch { return v; } });
/** 화면의 메시지 칸별 그림 칸 수·보이는 수·원문 태그 글자 */
export const shots = async (t, name) => { await t.shot(name); return `out/${name}.png`; };
export const imgScreen = (t) => t.R(() => [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].map((e) => {
  const boxes = [...e.querySelectorAll('.x-risu-gim, .gim')];
  return {
    idx: Number(e.dataset.chatIndex),
    boxes: boxes.length,
    visible: boxes.filter((b) => b.getClientRects().length && getComputedStyle(b).display !== 'none').length,
    urls: boxes.map((b) => (getComputedStyle(b).backgroundImage || '').slice(0, 60)),
    raw: ((e.querySelector('.chattext')?.innerText ?? '').match(/<img=[^>]*>/g) ?? []),
  };
}).sort((a, b) => a.idx - b.idx));
export const gimStyle = (t) => t.R(() => { const b = document.querySelector('.default-chat-screen .x-risu-gim, .default-chat-screen .gim'); if (!b) return null; const s = getComputedStyle(b); return { display: s.display, maxWidth: s.maxWidth, aspect: s.aspectRatio, cursor: s.cursor, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }; });
/** 가짜 서버 기록 since 뒤 */
export const log = (t, since, route) => t.fake(`log?since=${since}${route ? '&route=' + route : ''}`);
export const seqNow = (t) => t.fakeSeq();
export const text = (r) => (r?.body?.messages ?? []).map((m) => `${m.role}: ${m.content}`).join('\n');
export const isImgAux = (r) => r.route === 'aux' && /Insert <img> tags into a finished narrative/.test(text(r));

/** 플러그인 창: 설정 → 「캐릭터 이미지」(설정 페이지 안 묶음) 열기 */
export async function openSettings(t) {
  await t.openWindow('.gx');
  const F = await t.frame('.gx');
  await F.click('[data-action="tab"][data-value="settings"]').catch(() => {});
  await sleep(600);
  return F;
}
export async function fclickAct(t, action, value) {
  const F = await t.frame('.gx');
  const sel = value === undefined ? `[data-action="${action}"]` : `[data-action="${action}"][data-value="${value}"]`;
  await F.locator(sel).first().click({ timeout: 8000 });
  await sleep(500);
}

// STEPS·ORDER 는 파일 끝 (drv 로 실제 돌린 호출을 옮겨 적음)

/** 설정 창 → 페이지(node, 예 'set:image') 열기. 이미 열려 있으면 그 페이지로 */
export async function openEd(t, node = 'set:image') {
  const shown = await t.R(() => [...document.querySelectorAll('iframe')].some((f) => getComputedStyle(f).display !== 'none' && f.getBoundingClientRect().width > 200));
  let F = shown ? await t.frame('.gx', 3000).catch(() => null) : null;
  if (!F) F = await t.openWindow('.gx');
  const gwVis = await F.evaluate(() => !!document.querySelector('.gw')?.getClientRects().length);
  if (!gwVis) {
    for (let k = 0; k < 4; k++) { try { await F.locator('[data-action="ed-open"]:visible').first().click({ timeout: 5000 }); break; } catch (e) { if (k === 3) throw e; await sleep(800); } }
    await sleep(800);
  }
  const has = await F.evaluate((n) => !!document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`), node);
  if (!has) { await F.locator(`.gw [data-action="ed-tab"][data-value="${node.includes(':') ? node.split(':')[0] : 'manage'}"]`).first().click({ timeout: 8000 }); await sleep(600); }
  await F.locator(`.gw [data-action="ed-node"][data-value="${node}"]`).first().click({ timeout: 8000 });
  await sleep(600);
  return F;
}
export async function edClick(t, action, value) {
  const F = await t.frame('.gx', 5000);
  const sel = value === undefined ? `[data-action="${action}"]` : `[data-action="${action}"][data-value="${value}"]`;
  await F.locator('.gw ' + sel).first().click({ timeout: 8000 });
  await sleep(700);
}
export async function edClose(t) {
  const F = await t.frame('.gx', 3000).catch(() => null);
  if (F && await F.evaluate(() => !!document.querySelector('.gw')?.getClientRects().length)) { await F.locator('.gw [data-action="ed-close"]').first().click({ timeout: 5000 }).catch(() => {}); await sleep(500); }
  await t.closeWindow();
}
export const edText = async (t) => (await t.frame('.gx', 5000)).evaluate(() => document.querySelector('.gw')?.innerText.replace(/\s+/g, ' ').slice(0, 3000));
export async function edRange(t, change, val) {
  const F = await t.frame('.gx', 5000);
  await F.evaluate(({ change, val }) => { const el = document.querySelector(`.gw input[data-change="${change}"]`); if (!el) throw new Error('no range ' + change); el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, { change, val });
  await sleep(800);
}
/** 한 턴 보내고 그 사이 가짜 서버 기록·저장·화면을 모아 돌려준다 */
export async function turn(t, name, userText, mainRule, auxOver = [], { waitAfter = 4000 } = {}) {
  const s0 = await seqNow(t);
  await rules(t, [mainRule], auxOver);
  await t.send(userText);
  await sleep(waitAfter);
  const lg = await log(t, s0);
  const m = lg.find((r) => r.route === 'main');
  const img = lg.filter(isImgAux);
  if (m) saveReq(`${name}-main`, m);
  img.forEach((r, i) => saveReq(`${name}-aux-img${i ? i + 1 : ''}`, r));
  const c = await chat(t);
  const scr = await imgScreen(t);
  return { lg, m, img, c, last: c.msgs.at(-1)?.data, scr: scr.at(-1), calls: lg.map((r) => `${r.route}${isImgAux(r) ? ':IMG' : ''}:${r.seq}`) };
}
export const narrativeOf = (r) => { const s = text(r); const i = s.indexOf('## Narrative (numbered by paragraph)'); return i < 0 ? null : s.slice(i + 37, s.indexOf('# Reminder', i)).trim(); };
export const namesOf = (r) => (text(r).match(/## Allowed Character Names \(use exactly as written\)\n([^\n]*)/) ?? [])[1] ?? null;

/** 카드 업데이트 가로채기: version.json 을 새 판으로, card-update.json 을 꾸민 묶음으로 (page.route 가 ctx.route 보다 먼저) */
export async function routeUpdate(t, payloadFile) {
  await t.page.unroute('**/ygberserk/goei/release/version.json*').catch(() => {});
  await t.page.unroute('**/ygberserk/goei/release/card-update.json*').catch(() => {});
  if (!payloadFile) return;
  const body = readFileSync(payloadFile);
  const hit = { version: 0, card: 0 };
  t.__updHit = hit;
  await t.page.route('**/ygberserk/goei/release/version.json*', (r) => { hit.version++; r.fulfill({ status: 200, body: JSON.stringify({ card: '0.21.35', plugin: '0.21.34', minPlugin: '0.17.0' }), headers: { 'access-control-allow-origin': '*' } }); });
  await t.page.route('**/ygberserk/goei/release/card-update.json*', (r) => { hit.card++; r.fulfill({ status: 200, body, headers: { 'access-control-allow-origin': '*' } }); });
}
/** 카드 상태 요약 (판·사진 줄·로어 해시) */
export const cardSnap = (t) => t.R(async () => {
  const st = await import('/src/ts/stores.svelte.ts');
  const c = st.DBState.db.characters.find((x) => (x.globalLore ?? []).some((l) => String(l.comment) === 'Plugin manifest'));
  const man = c.globalLore.find((l) => String(l.comment) === 'Plugin manifest');
  let v = null; try { v = JSON.parse(man.content).version; } catch {}
  const rows = c.additionalAssets ?? [];
  const row = (n) => rows.find((r) => r[0] === n) ?? null;
  const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  return { version: v, assets: rows.length, smile: row('Jaemtri_smile'), crying: row('Jaemtri_crying'), ltest: row('Ltest_smile'), lfail: row('Lfail_smile'), map18: row('map18'), loreHash: h(JSON.stringify(c.globalLore)) };
});
export const pluginCode = (t) => readFileSync(t.cfg.rel + 'goei-plugin.js', 'utf8');

// ── 단계 (drv.mjs 로 하나씩 돌린 호출을 그대로 옮김. 앞 단계 상태를 이어 받는다) ──
const tagsOf = (s) => String(s ?? '').match(/<img=[^>]+>/g) ?? [];
const IMG = 'Insert <img> tags into a finished narrative';
export const STEPS = {
  async setup(t) { await t.setup(); await t.loadState(STATES + '/S-관리국-3턴.json'); await sleep(6000); const scr = await imgScreen(t); await shots(t, 'L0-loaded');
    return rec('L0 시작 상태', { expect: '그림 칸 3개, 날것 태그 0', rule: 'L3', ok: scr.reduce((a, m) => a + m.visible, 0) >= 3 && scr.every((m) => !m.raw.length), actual: scr.filter((m) => m.boxes).map((m) => m.idx + ':' + m.visible), evidence: 'out/L0-loaded.png' }); },
  async L1A(t) { const r = await turn(t, 'L1A', '[L1A] 잼트리에게 인사한다.', main(REPLY_MAIN(1, '10:30 AM'))); const tx = text(r.m);
    return rec('L1A 메인 방식', { expect: '지침이 요청 끝, 이름 목록·42 표정, 태그 2칸(neutral·Nobody 버림), 보조 이미지 호출 0', rule: 'L1·L6', ok: /Inserting Character Visual/.test(tx) && r.img.length === 0 && r.scr.visible === 2, actual: { calls: r.calls, saved: tagsOf(r.last), scr: r.scr }, evidence: 'out/req-L1A-main.txt' }); },
  async L1B(t) { await openEd(t, 'set:image'); await edClick(t, 'set-asset-model', 'aux'); await edClose(t);
    const r = await turn(t, 'L1B', '[L1B] 쟈알디를 본다.', main(REPLY_PLAIN(2, '10:40 AM')));
    return rec('L1B 보조 방식', { expect: '메인 요청 지침·태그 0, 보조 이미지 요청 1, 저장 글에 태그 2', rule: 'L1 (L-07)', ok: !/Inserting Character Visual/.test(text(r.m)) && r.img.length === 1 && tagsOf(r.last).length === 2, actual: { calls: r.calls, names: namesOf(r.img[0]), saved: tagsOf(r.last), note: r.c.ss.$goei_asset_note }, evidence: 'out/req-L1B-aux-img.txt' }); },
  async L1S6(t) { const cases = [['prose', { reply: '잼트리와 쟈알디에게 태그를 붙이면 좋겠습니다.' }], ['emptyArr', { reply: '[]' }], ['empty', { empty: true }], ['s500', { status: 500 }], ['badtags', { reply: '[{"line":1,"tag":"<img=\\"Nobody_smile\\">"},{"line":9,"tag":"<img=\\"Jaemtri_smile\\">"},{"line":2,"tag":"<img=\\"Jyaldi_neutral\\">"}]' }]]; const out = {}; let n = 4;
    for (const [k, o] of cases) { const r = await turn(t, 'L1S6-' + k, `[L1S6 ${k}] 잠시 기다린다.`, main(REPLY_PLAIN(n, `11:${20 + n * 2} AM`)), [{ id: 'aux-img-x', route: 'aux', match: IMG, ...o }], { waitAfter: k === 's500' ? 12000 : 4000 }); n++; out[k] = { calls: r.calls, note: r.c.ss.$goei_asset_note, tags: tagsOf(r.last) }; }
    return rec('손-06 보충 실패 메모', { expect: '지금 상태 기록 (말글·[] 같은 메모인지, 빈 답·500 은 실패 메모)', rule: '손-06', ok: true, actual: out, evidence: 'out/req-L1S6-*.txt' }); },
  async L1C(t) { await openEd(t, 'set:image'); await edClick(t, 'set-asset-model', 'main'); await edClick(t, 'set-asset', '0'); await edClose(t); await sleep(800);
    const off = await imgScreen(t); const r = await turn(t, 'L1C-off', '[L1COFF] 로비를 나선다.', main(REPLY_MAIN(30, '02:20 PM')));
    await openEd(t, 'set:image'); await edClick(t, 'set-asset', '1'); await edClose(t); await sleep(800); const on = await imgScreen(t);
    return rec('L1C 끔', { expect: '켜진 칸 0, 요청에 지침·태그 0, 다시 켜면 보임', rule: 'L1', ok: off.every((m) => !m.visible) && !/Inserting Character Visual/.test(text(r.m)) && on.some((m) => m.visible), actual: { calls: r.calls, offVisible: off.reduce((a, m) => a + m.visible, 0), onVisible: on.reduce((a, m) => a + m.visible, 0) }, evidence: 'out/req-L1C-off-main.txt' }); },
  async L4fail(t) { await routeUpdate(t, OUT + '/upd-fail.json'); const a = await cardSnap(t); await openEd(t, 'install'); await edClick(t, 'upd-check'); await sleep(3000); await edClick(t, 'upd-prepare').catch(() => {}); await sleep(5000); await edClick(t, 'upd-apply').catch(() => {}); await sleep(5000); const msg = await edText(t); const b = await cardSnap(t); await shots(t, 'L4-fail'); await edClose(t);
    return rec('L4 사진 하나 못 받음', { expect: '카드 판·사진·로어 그대로', rule: 'L-05', ok: a.version === b.version && a.loreHash === b.loreHash && a.assets === b.assets, actual: { a, b, msg: (msg.match(/사진 「[^」]+」[^.]*\./) ?? [])[0] }, evidence: 'out/L4-fail.png' }); },
  async L4ok(t) { await routeUpdate(t, OUT + '/upd-ok.json'); await openEd(t, 'install'); await edClick(t, 'upd-check'); await sleep(3000); await edClick(t, 'upd-prepare').catch(() => {}); await sleep(5000); await edClick(t, 'upd-apply').catch(() => {}); await sleep(5000); const b = await cardSnap(t); await shots(t, 'L4-ok'); await edClose(t); await routeUpdate(t, null);
    return rec('L4 사진 팩 받기', { expect: '판 0.21.35, Ltest 추가, map18 뺌', rule: 'L4', ok: b.version === '0.21.35' && !!b.ltest && !b.map18, actual: b, evidence: 'out/L4-ok.png' }); },
  async otherbot(t) { const idx = await t.R(async () => { const ch = await import('/src/ts/characters.ts'); const st = await import('/src/ts/stores.svelte.ts'); const c = ch.createBlankChar(); c.name = '다른봇'; c.firstMessage = '안녕. <img=Jyaldi_smile> 그리고 <img=Alice_smile>'; c.chaId = crypto.randomUUID(); c.chats = [{ message: [], note: '', name: 'Chat 1', localLore: [], fmIndex: -1, id: crypto.randomUUID() }]; st.DBState.db.characters.push(c); return st.DBState.db.characters.length - 1; });
    await t.R(async (i) => { const ch = await import('/src/ts/characters.ts'); await ch.changeChar(i); }, idx); await sleep(3000);
    const g = await t.R(() => { const e = document.querySelector('.risu-chat[data-chat-index="-1"] .chattext'); return { text: e?.innerText.slice(0, 120), boxes: document.querySelectorAll('.default-chat-screen .x-risu-gim,.default-chat-screen .gim').length }; }); await shots(t, 'L-otherbot');
    return rec('공-22 다른 봇 채팅', { expect: '다른 봇 첫 메시지의 <img=…> 글이 그대로 (괴이가 손대지 않음)', rule: '공-22', ok: g.boxes === 0 && /Alice_smile/.test(g.text ?? ''), actual: g, evidence: 'out/L-otherbot.png' }); },
  async phone(t) { await sleep(500); await t.page.evaluate(() => { const b = [...document.querySelectorAll('.default-chat-screen .x-risu-gim, .default-chat-screen .gim')].pop(); b?.scrollIntoView({ block: 'center' }); }); await sleep(800); const tag = `L${t.cfg.width}x${t.cfg.height}`; await shots(t, tag + '-chat-box');
    const vw = await t.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    return rec('화면 크기 ' + tag, { expect: '가로 넘침 없음, 그림 칸 폭 ≤ 화면', rule: '공통 화면', ok: vw[0] <= vw[1], actual: { vw, st: await gimStyle(t) }, evidence: `out/${tag}-chat-box.png` }); },
};
export const ORDER = ['setup', 'L1A', 'L1B', 'L1S6', 'L1C', 'L4fail', 'L4ok', 'otherbot'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { openT2 } = await import('../틀/risu-t2.mjs');
  const t = await openT2({ via: 'plain', width: 1280, height: 800, out: OUT });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ORDER;
  try { for (const n of names) await STEPS[n](t, {}); } finally { await t.close?.(); }
}
