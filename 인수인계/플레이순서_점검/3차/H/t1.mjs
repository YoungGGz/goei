// H 구간 T1(가짜 리스, 시험 본체): 저장 실패(chat/storage/char × throw/silent) · 조립 단계 「소지품」 실패
// 사용: node t1.mjs /tmp/claude-0/hi/t1/fixture.json  (fixture 는 I 점검자가 만든 것을 그대로 씀)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, boot, startChat, request, output, setVars, setSaveFail, clearSaveFail, saveFails, counts, testBodyCode } from '../../../../tests/qc-host.mjs';

const OUT = fileURLToPath(new URL('./out', import.meta.url));
mkdirSync(OUT, { recursive: true });
const fxPath = process.argv[2] || '/tmp/claude-0/hi/t1/fixture.json';
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const browser = await launch();
const steps = [];
const file = `${OUT}/t1-steps.jsonl`;
writeFileSync(file, '');
const expect = (id, e, rows) => { steps.push({ id, expect: e, rows, t: new Date().toISOString() }); console.log(`\n[기대 ${id}] ${e} (${rows})`); };
const actual = (id, ok, a) => { const s = steps.find((x) => x.id === id) ?? { id }; Object.assign(s, { ok, actual: a }); writeFileSync(file, steps.filter((x) => 'actual' in x).map((x) => JSON.stringify(x)).join('\n') + '\n'); console.log(`[실제 ${id}] ${ok === true ? '맞음' : ok === false ? '어긋남' : '기록'} — ${JSON.stringify(a).slice(0, 700)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const st = (t, bal = 140000) => `[▣|2025.03.14|${t}|☀️|12°C|서울 종로구 관리국 본부 사무실|없음|없음|없음|관리국/선임 요원|${bal}]`;

const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, body: testBodyCode });
const items = () => page.evaluate(() => { try { return JSON.parse(window.__chat.scriptstate?.$st_items ?? 'null'); } catch { return null; } });
const names = (it) => (it?.list ?? []).filter((e) => !e.outHow).map((e) => e.name + (e.uses ? `(u${e.uses})` : ''));
const vars = () => page.evaluate(() => ({ use: window.__chat.scriptstate?.$st_item_use ?? null, useAt: window.__chat.scriptstate?.$st_item_use_at ?? null }));
const push = (role, data, chatId) => page.evaluate(([r, d, id]) => { window.__chat.message.push({ role: r, data: d, chatId: id }); }, [role, data, chatId]);
// 갱신기 답: 요청 자료(messages[1])를 보고 답을 짓는다
await page.evaluate(() => {
  const orig = window.risuai.runLLMModel;
  window.__updFn = null;
  window.__updSeen = [];
  window.risuai.runLLMModel = async (o) => {
    const all = (o.messages ?? []).map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
    if (/You update the per-chat record of named characters/.test(all)) {
      let d = null; try { d = JSON.parse(o.messages[1].content); } catch {}
      window.__updSeen.push({ span: (d?.span ?? []).map((x) => `${x.role}:${x.m}:${String(x.text).slice(0, 14)}${x.context_only ? '(ctx)' : ''}`), want: d?.want, used_now: d?.used_now });
      const r = window.__updFn ? window.__updFn(d) : {};
      await new Promise((r2) => setTimeout(r2, 100));
      return { type: 'success', result: JSON.stringify(r) };
    }
    return orig(o);
  };
});
const setUpd = (src) => page.evaluate((s) => { window.__updFn = s ? (0, eval)(s) : null; }, src);
const newItem = (name, quote) => `(d) => { const m = (d?.span ?? []).filter((x) => x.role === 'assistant').at(-1)?.m ?? 'm1'; return { items: [{ name: ${JSON.stringify(name)}, action: 'new', desc: '시험 물건', usable: true, uses: 2, equip: 'none', icon: 'tool/손전등/flashlight', weight: 0.2, m, quote: ${JSON.stringify(quote)} }] }; }`;
const msgs = () => page.evaluate(() => [{ role: 'system', content: 'SYSTEM' }, ...window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }))]);
const invOf = (out) => out.map((m) => String(m.content)).find((c) => c.startsWith('[Inventory]')) ?? null;
const openItems = async () => {
  if (await page.evaluate(() => document.querySelector('.gx')?.style.display === 'none' || !document.querySelector('.gx'))) await page.click('[x-goei-fab] button');
  await sleep(800);
  for (let i = 0; i < 6 && !(await page.$('.gx-items')); i++) { await page.click('[data-action="nav-tab"][data-value="items"]').catch(() => {}); await sleep(700); }
};
const closeWin = async () => { await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()); await sleep(500); };
const info = () => page.evaluate(() => [...document.querySelectorAll('.gx-toast, .it-info, [role="status"], .gx-err, .gx-note')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));

try {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-fac');
  await page.click('.gx-fac[data-value="A00"]'); await sleep(400);
  await page.click('[data-action="player"][data-value="P004"]'); await sleep(400);
  await page.click('[data-action="fm"][data-value="8"]'); await sleep(400);
  await page.fill('[data-input="start-note"]', '출근 첫날 아침').catch(() => {}); await sleep(300);
  const n0 = await page.evaluate(() => window.__calls.setChat.length);
  await page.click('.gx-foot .gx-start').catch(() => page.click('.gx-start'));
  await page.waitForFunction((n) => window.__calls.setChat.length > n, n0, { timeout: 20000 });
  await sleep(1500);
  await setVars(page, { $pp_on: '1', $pp_when: 'turn', $pp_model: 'aux', $pp_router: 'code', $pp_director: 'off', $st_asset_on: '0' });
  const it0 = await items();
  expect('T0 기준 턴', '에일린(P004)으로 시작하면 시작 소지품이 있고, 응답 처리에서 갱신기 new(구급약)가 들어온다', 'H-08·H-05 (사용자 결정)');
  await push('user', '매점에 간다.', 'u1');
  await push('char', '에일린은 매점에서 구급약을 샀다.\n' + st('10:00 AM'), 'c1');
  await setUpd(newItem('구급약', '에일린은 매점에서 구급약을 샀다.'));
  await output(page);
  let it = await items();
  actual('T0 기준 턴', names(it).includes('구급약(u2)'), { start: names(it0), now: names(it) });

  // ── chat throw: 응답 처리 ──
  expect('T1-chat-throw', '응답 처리의 채팅 저장이 던지면 그 턴의 물건(손전등)은 안 남는다. 다시 시도는 없고, 다음 턴 갱신기 자료에 그 응답이 다시 확정 구간으로 들어가 손전등을 다시 받을 수 있다(읽음 표시도 같이 안 남았으므로)', '코스 5장 「저장 실패: 다시 시도 없음, 응답 처리 첫 저장 실패 시 뒤 처리 빠짐」, 공-02');
  await push('user', '창고에 간다.', 'u2');
  await push('char', '에일린은 창고에서 손전등을 집었다.\n' + st('10:20 AM'), 'c2');
  await setUpd(newItem('손전등', '에일린은 창고에서 손전등을 집었다.'));
  await setSaveFail(page, 'chat', { from: 1, mode: 'throw' });
  let threw = null;
  await output(page).catch((e) => (threw = String(e).slice(0, 120)));
  const f1 = await saveFails(page);
  await clearSaveFail(page, 'chat');
  it = await items();
  const after1 = names(it);
  await push('user', '복도로 나간다.', 'u3');
  await push('char', '에일린은 복도로 나갔다.\n' + st('10:40 AM'), 'c3');
  await setUpd(`(d) => { const m = (d?.span ?? []).find((x) => x.role === 'assistant' && /손전등/.test(x.text) && !x.context_only)?.m; return m ? { items: [{ name: '손전등', action: 'new', desc: '시험 물건', usable: true, uses: 2, equip: 'none', icon: 'tool/손전등/flashlight', weight: 0.2, m, quote: '에일린은 창고에서 손전등을 집었다.' }] } : {}; }`);
  await output(page);
  const seen1 = await page.evaluate(() => window.__updSeen.at(-1));
  it = await items();
  actual('T1-chat-throw', !after1.includes('손전등(u2)') && names(it).includes('손전등(u2)'), { threw, fails: f1.length, afterFail: after1, nextSpan: seen1?.span, afterNext: names(it), logs: logs.filter((l) => /실패|저장/.test(l)).slice(-3), pageErrors: errors.slice(-3) });

  // ── chat silent: 응답 처리 ──
  expect('T1-chat-silent', '채팅 저장이 조용히 안 쓰이면(리스AI dbWrite 거절 꼴) 플러그인은 모른 채 넘어가고, 물건(라이터)도 읽음 표시도 안 남아 다음 턴에 다시 읽는다', '코스 5장 저장 실패(조용히 안 씀)');
  await push('user', '책상을 본다.', 'u4');
  await push('char', '에일린은 책상 위 라이터를 챙겼다.\n' + st('11:00 AM'), 'c4');
  await setUpd(newItem('라이터', '에일린은 책상 위 라이터를 챙겼다.'));
  await setSaveFail(page, 'chat', { from: 1, mode: 'silent' });
  let threw2 = null;
  await output(page).catch((e) => (threw2 = String(e).slice(0, 120)));
  const f2 = await saveFails(page);
  await clearSaveFail(page, 'chat');
  const after2 = names(await items());
  await push('user', '계단으로 간다.', 'u5');
  await push('char', '에일린은 계단을 내려갔다.\n' + st('11:20 AM'), 'c5');
  await setUpd(`(d) => { const m = (d?.span ?? []).find((x) => x.role === 'assistant' && /라이터/.test(x.text) && !x.context_only)?.m; return m ? { items: [{ name: '라이터', action: 'new', desc: '시험 물건', usable: true, uses: 2, equip: 'none', icon: 'tool/라이터/lighter', weight: 0.05, m, quote: '에일린은 책상 위 라이터를 챙겼다.' }] } : {}; }`);
  await output(page);
  const seen2 = await page.evaluate(() => window.__updSeen.at(-1));
  actual('T1-chat-silent', !threw2 && !after2.includes('라이터(u2)') && names(await items()).includes('라이터(u2)'), { threw: threw2, fails: f2.length, afterFail: after2, nextSpan: seen2?.span, afterNext: names(await items()) });

  // ── chat throw/silent: 창에서 「사용」 ──
  expect('T1-use-throw', '창에서 구급약 「사용」을 누를 때 채팅 저장이 던지면 사용 자리는 안 생기고(저장 안 됨) 창이 죽지 않는다. 화면 안내를 기록', '코스 5장 저장 실패 — 결정표 줄 없음');
  await openItems();
  const kit = (await items()).list.find((e) => e.name === '구급약').id;
  await page.click(`[data-action="items-open"][data-value="${kit}"]`); await sleep(500);
  await setSaveFail(page, 'chat', { from: 1, mode: 'throw' });
  await page.click(`button[data-action="items-use"][data-value="${kit}"]`).catch(() => {}); await sleep(1200);
  const i3 = await info(); const v3 = await vars(); const f3 = await saveFails(page);
  await page.screenshot({ path: `${OUT}/t1-사용-저장던짐.png` });
  await clearSaveFail(page, 'chat');
  const gxShown = await page.evaluate(() => !!document.querySelector('.gx-items'));
  actual('T1-use-throw', !v3.use && gxShown, { info: i3, vars: v3, fails: f3.length, windowAlive: gxShown, logs: logs.filter((l) => /실패|저장/.test(l)).slice(-2), pageErrors: errors.slice(-3) });
  expect('T1-use-silent', '같은 일을 조용히 안 씀으로: 창에는 「다음 메시지에 같이 보내요」가 뜨지만 저장된 채팅에는 사용 자리가 없다. 다시 읽으면 사용 예정이 사라지는지 기록', '코스 5장 저장 실패(조용히 안 씀)');
  await setSaveFail(page, 'chat', { from: 1, mode: 'silent' });
  await page.click(`button[data-action="items-use"][data-value="${kit}"]`).catch(() => {}); await sleep(1200);
  const i4 = await info(); const v4 = await vars();
  await clearSaveFail(page, 'chat');
  await closeWin(); await openItems();
  const grid4 = await page.evaluate(() => document.querySelector('.gx-items')?.innerText.replace(/\s+/g, ' ').slice(0, 200));
  await page.screenshot({ path: `${OUT}/t1-사용-조용히안씀.png` });
  actual('T1-use-silent', null, { info: i4, vars: v4, gridAfterReopen: grid4 });
  await closeWin();

  // ── storage: 새 채팅 기본값(goei:prefs) ──
  expect('T1-storage', '새 채팅 기본값(goei:prefs) 저장이 던지거나 조용히 안 쓰이면, 시작 소지품 끔이 저장되지 않는다. 던짐은 화면 안내·페이지 오류 없음을 기록, 조용히는 저장값이 그대로인지 기록', '코스 5장 저장 실패(기기 저장소), K-01 (설정은 바로 저장)');
  const res = {};
  for (const mode of ['throw', 'silent']) {
    const { page: p2, errors: e2, logs: l2 } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, body: testBodyCode });
    await p2.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
    await p2.click('[x-goei-fab] button');
    await p2.waitForSelector('.gx-fac');
    await p2.click('[data-action="prefs-open"]'); await sleep(1200);
    await p2.click('[data-action="ed-node"][data-value="set:items"]').catch(() => {}); await sleep(1000);
    const pre = await p2.evaluate(() => window.__store['p:goei:prefs'] ?? null);
    await setSaveFail(p2, 'storage', { key: 'goei:prefs', mode });
    await p2.click('[data-action="set-items-start"][data-value="0"]').catch((e) => res[mode + 'ClickErr'] = String(e).slice(0, 80)); await sleep(1200);
    const shownAfter = await p2.evaluate(() => [...document.querySelectorAll('[data-action="set-items-start"]')].map((e) => `${e.dataset.value}:${e.getAttribute('aria-checked')}`));
    const note = await p2.evaluate(() => [...document.querySelectorAll('.gx-toast, [role="status"], .gx-err, .ps-err, .gx-note')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));
    await p2.screenshot({ path: `${OUT}/t1-새채팅기본값-저장${mode}.png` });
    const post = await p2.evaluate(() => window.__store['p:goei:prefs'] ?? null);
    const fails = (await saveFails(p2)).length;
    await clearSaveFail(p2, 'storage');
    res[mode] = { pre: pre?.slice(0, 100) ?? null, post: post?.slice(0, 100) ?? null, shownAfter, note, fails, logs: l2.filter((l) => /실패|저장/.test(l)).slice(-2), pageErrors: e2.slice(-3) };
    await p2.close();
  }
  actual('T1-storage', res.throw?.fails > 0 && res.silent?.fails > 0 && !/it_start/.test(res.throw.post ?? '') && !/it_start/.test(res.silent.post ?? ''), res);

  // ── char: 소지품은 카드에 안 씀 ──
  expect('T1-char', '카드 저장(setCharacterToIndex)을 던지게 두고 물건 턴을 돌려도 소지품은 영향이 없다(소지품은 채팅 변수에만 씀). 카드 저장 호출 수 기록', '코스 5장 저장 실패(카드) — 소지품은 카드에 쓰지 않음(src 에서 setCharacterToIndex 는 host/risu.ts 로어·install·update 만)');
  const c0 = (await counts(page)).setChar;
  await setSaveFail(page, 'char', { mode: 'throw' });
  await push('user', '사물함을 연다.', 'u6');
  await push('char', '에일린은 사물함에서 무전기를 꺼냈다.\n' + st('11:40 AM'), 'c6');
  await setUpd(newItem('무전기', '에일린은 사물함에서 무전기를 꺼냈다.'));
  let threw5 = null;
  await output(page).catch((e) => (threw5 = String(e).slice(0, 120)));
  const charFails = (await saveFails(page)).filter((x) => x.target === 'char').length;
  await clearSaveFail(page, 'char');
  actual('T1-char', names(await items()).includes('무전기(u2)'), { threw: threw5, setCharCalls: (await counts(page)).setChar - c0, charFails, now: names(await items()) });

  expect('T1-fault-use', '사용(구급약)을 걸어 둔 채 「소지품」 단계가 실패해 [Inventory](This turn: uses)가 안 실리면, 그 답이 와도 사용은 기록되지 않고 횟수가 안 빠지며 사용 자리가 남아 다음 요청에 실린다', 'H-17b 「「사용」 자리는 모델에 보낸 만큼만 기록」 (Claude 판정)');
  await openItems();
  if (!(await page.$(`button[data-action="items-use"][data-value="${kit}"]`))) { await page.click(`[data-action="items-open"][data-value="${kit}"]`); await sleep(400); }
  await page.click(`button[data-action="items-use"][data-value="${kit}"]`).catch(() => {}); await sleep(900);
  await closeWin();
  const vq = await vars();
  await push('user', '구급약을 바른다.', 'u8');
  await page.evaluate(() => { globalThis.__goeiFaultSteps = ['소지품']; });
  let out = await request(page, await msgs());
  await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  await push('char', '에일린은 상처를 살폈다.\n' + st('12:00 PM'), 'c8');
  await setUpd(null);
  await output(page);
  const itq = await items();
  const kitE = itq.list.find((e) => e.id === kit);
  const useLogs = itq.log.filter((l) => l.item === kit && l.what === 'use').map((l) => l.anchor);
  const vq2 = await vars();
  await push('user', '다시 바른다.', 'u9');
  const out2 = await request(page, await msgs());
  actual('T1-fault-use', !useLogs.includes('c8') && !!vq2.use, { queued: vq, invSent: !!invOf(out), useLogs, varsAfter: vq2, nextThisTurn: invOf(out2)?.match(/This turn:[^\n]*/)?.[0] ?? null, kitUses: kitE?.uses });
  // ── 조립 단계 「소지품」 실패 ──
  expect('T1-fault', '조립 단계 「소지품」을 실패시키면 [Inventory] 블록만 빠지고 나머지(로어·상태창)는 그대로 감, 콘솔에 단계 이름', '코스 5장 조립 단계 실패 (그 단계만 건너뜀)');
  await push('user', '무전기를 켠다.', 'u7');
  out = await request(page, await msgs());
  const hadInv = !!invOf(out);
  await page.evaluate(() => { globalThis.__goeiFaultSteps = ['소지품']; });
  out = await request(page, await msgs());
  await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  actual('T1-fault', hadInv && !invOf(out) && out.some((m) => String(m.content).includes('goei:lore')), { before: hadInv, after: !!invOf(out), lore: out.some((m) => String(m.content).includes('goei:lore')), prevStatus: out.some((m) => String(m.content).startsWith('[Previous status]')), n: out.length, logs: logs.filter((l) => /조립 실패/.test(l)).slice(-2) });

  actual('끝', null, { pageErrors: errors.slice(-5) });
} catch (e) {
  actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await page.screenshot({ path: `${OUT}/t1-error.png` }).catch(() => {});
} finally {
  await browser.close();
}
