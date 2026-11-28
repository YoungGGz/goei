// 3차 D 구간 (상황판·지도·출동·임무). 사용: FAKE_URL=http://<IP>:<port> node run.mjs [--only d1,d2,...] [--w 1280 --h 800]
// 단계마다 기대값·결정표 줄을 먼저 적고(step 의 want/ref), 실제값을 붙여 자동 대조한다. src 는 안 건드림.
import { open, STATES, sleep, turn, waitMain, readRequest, buildReply, quietAux, world, saveJson, saveText, reqText, text } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const OUT = fileURLToPath(new URL(`./out/run-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), size: `${W}x${H}`, steps: [] };
const step = (id, name, ok, want, ref, got) => { res.steps.push({ id, name, ok, want, ref, got }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 300)); saveJson(OUT + '/result.json', res); };
const on = (k) => !ONLY.length || ONLY.includes(k);
const t = await open({ out: OUT, width: W, height: H, touch: W < 600 });
const shot = async (n) => { await t.shot(n); return `${OUT}/${n}.png`; };
const F = () => t.F();
const fc = async (sel, i = 0) => { try { await F().locator(sel).locator("visible=true").nth(i).click({ timeout: 3000 }); } catch (e) { const ok = await F().evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, { sel, i }); if (!ok) throw e; res.domClicks = (res.domClicks ?? []).concat(sel); } await sleep(700); };
const ftext = (sel = '.gx') => F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ') ?? null, sel);
const acts = (re) => F().evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r.test(e.dataset.action)).map((e) => ({ a: e.dataset.action, v: e.dataset.value ?? null, t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), dis: !!e.disabled })); }, re.source);
const userMsgs = (body) => (body.messages ?? []).filter((m) => m.role === 'user').map((m) => text(m.content));
const has = (s, sec) => s.includes(sec.slice(0, 60));
const PROSE = '쟈알디가 서류를 덮었다.\n\n<img=Jyaldi_serious>\n\n"출발한다."';
const ST = { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' };
let DIR = {};
{ const raw = (await import('node:fs')).readFileSync(new URL('../../../../지침/이동_임무_지시문.txt', import.meta.url), 'utf8'); for (const m of raw.matchAll(/===([A-Z]+)===\n([\s\S]*?)(?====|$)/g)) DIR[m[1]] = m[2].trim(); }

async function boot(state = 'S-관리국-3턴') {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  await t.openWindow('.gx');
  await sleep(1200);
}
async function openTab(v) { if (!F() || !(await F().$('.gx'))) await t.openWindow('.gx'); const cur = await F().evaluate(() => document.querySelector('[data-action="nav-tab"].on, [data-action="nav-tab"][aria-current="page"], [data-action="nav-tab"].active')?.dataset.value ?? null); if (cur !== v) await fc(`[data-action="nav-tab"][data-value="${v}"]`); if (!(await F().evaluate((v) => !!document.querySelector(`[data-action="nav-tab"][data-value="${v}"].on, [data-action="nav-tab"][data-value="${v}"][aria-current="page"]`), v))) { await fc('[data-action="nav-tab"][data-value="board"]').catch(() => {}); if (v !== 'board') await fc(`[data-action="nav-tab"][data-value="${v}"]`); } }
async function reopen() { await t.closeWindow(); await t.openWindow('.gx'); await sleep(1000); }

try {
  await boot();
  if (on('r17foo')) { // 덧붙일 규칙에 [[…]] 가 든 채 출동
    await reopen(); await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="guide"]'); await fc('[data-action="ed-node"][data-value="rule:all"]');
    await fc('[data-action="ed-rule-new"]');
    const id = await F().evaluate(() => document.querySelector('[data-input="ed-rule-text"]')?.dataset.key);
    await F().fill(`[data-input="ed-rule-text"][data-key="${id}"]`, '대사 끝에 [[foo]] 같은 꺾쇠 표시를 쓰지 않는다.');
    await F().fill(`[data-input="ed-rule-title"][data-key="${id}"]`, '표시');
    await sleep(500);
    const toOn = await F().evaluate((id) => document.querySelector(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`)?.getAttribute('aria-pressed'), id);
    if (toOn !== 'true') await fc(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`);
    await shot('r17foo-rule');
    await reopen(); await openTab('map');
    await fc('[data-action="ev-pop"][data-value^="an|12-10|명일 아파트"]');
    await fc('[data-action="pick-event"]');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="depart"]');
    const rec = await waitMain(t, seq0, 15000);
    const note = rec ? null : await F().evaluate(() => document.querySelector('.gx-err, [role="alert"]')?.innerText ?? null);
    await shot('r17foo-depart');
    step('R17-foo', '덧붙일 규칙 글에 [[foo]] → 출동', !!rec, '규칙 글은 플레이어 글이라 출동이 막히지 않고 COMMON 끝에 그대로 붙는다 (Claude 판정)', '코스 D7', { toOnBefore: toOn, sent: !!rec, note, lastUser: rec ? userMsgs(rec.body).at(-1) : null });
    if (rec) { writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST })); await t.fake('release', { seq: rec.seq }); await t.waitIdle().catch(() => {}); }
  }

  if (on('r17dest')) { // 덧붙일 규칙에 [[…]] 가 든 채 출동
    await reopen(); await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="guide"]'); await fc('[data-action="ed-node"][data-value="rule:all"]');
    await fc('[data-action="ed-rule-new"]');
    const id = await F().evaluate(() => document.querySelector('[data-input="ed-rule-text"]')?.dataset.key);
    await F().fill(`[data-input="ed-rule-text"][data-key="${id}"]`, '대사 끝에 [[DEST]] 같은 꺾쇠 표시를 쓰지 않는다.');
    await F().fill(`[data-input="ed-rule-title"][data-key="${id}"]`, '표시');
    await sleep(500);
    const toOn = await F().evaluate((id) => document.querySelector(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`)?.getAttribute('aria-pressed'), id);
    if (toOn !== 'true') await fc(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`);
    await shot('r17dest-rule');
    await reopen(); await openTab('map');
    await fc('[data-action="ev-pop"][data-value^="an|12-10|명일 아파트"]');
    await fc('[data-action="pick-event"]');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="depart"]');
    const rec = await waitMain(t, seq0, 15000);
    const note = rec ? null : await F().evaluate(() => document.querySelector('.gx-err, [role="alert"]')?.innerText ?? null);
    await shot('r17dest-depart');
    step('R17-dest', '덧붙일 규칙 글에 [[DEST]] → 출동', !!rec, '규칙 글은 플레이어 글이라 출동이 막히지 않고 COMMON 끝에 그대로 붙는다 (Claude 판정)', '코스 D7', { toOnBefore: toOn, sent: !!rec, note, lastUser: rec ? userMsgs(rec.body).at(-1) : null });
    if (rec) { writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST })); await t.fake('release', { seq: rec.seq }); await t.waitIdle().catch(() => {}); }
  }

  if (on('r17kor')) { // 덧붙일 규칙에 [[…]] 가 든 채 출동
    await reopen(); await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="guide"]'); await fc('[data-action="ed-node"][data-value="rule:all"]');
    await fc('[data-action="ed-rule-new"]');
    const id = await F().evaluate(() => document.querySelector('[data-input="ed-rule-text"]')?.dataset.key);
    await F().fill(`[data-input="ed-rule-text"][data-key="${id}"]`, '대사 끝에 [[대상]] 같은 꺾쇠 표시를 쓰지 않는다.');
    await F().fill(`[data-input="ed-rule-title"][data-key="${id}"]`, '표시');
    await sleep(500);
    const toOn = await F().evaluate((id) => document.querySelector(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`)?.getAttribute('aria-pressed'), id);
    if (toOn !== 'true') await fc(`[data-action="ed-rule-to"][data-value="${id}|Directive"]`);
    await shot('r17kor-rule');
    await reopen(); await openTab('map');
    await fc('[data-action="ev-pop"][data-value^="an|12-10|명일 아파트"]');
    await fc('[data-action="pick-event"]');
    const seq0 = await t.fakeSeq();
    await fc('[data-action="depart"]');
    const rec = await waitMain(t, seq0, 15000);
    const note = rec ? null : await F().evaluate(() => document.querySelector('.gx-err, [role="alert"]')?.innerText ?? null);
    await shot('r17kor-depart');
    step('R17-kor', '덧붙일 규칙 글에 [[대상]] → 출동', !!rec, '규칙 글은 플레이어 글이라 출동이 막히지 않고 COMMON 끝에 그대로 붙는다 (Claude 판정)', '코스 D7', { toOnBefore: toOn, sent: !!rec, note, lastUser: rec ? userMsgs(rec.body).at(-1) : null });
    if (rec) { writeFileSync(t.REPLY, buildReply(readRequest(rec.body), { prose: PROSE, status: ST })); await t.fake('release', { seq: rec.seq }); await t.waitIdle().catch(() => {}); }
  }

} catch (e) {
  step('ERR', '예외', false, null, null, String(e?.stack ?? e).slice(0, 1500));
  await shot('ERR').catch(() => {});
} finally {
  res.errors = t.errors.filter((e) => !/displayData|\[goei\] (시작|본체|세계)/.test(e)).slice(0, 40);
  saveJson(OUT + '/result.json', res);
  console.log('OUT', OUT);
  await t.close();
}
