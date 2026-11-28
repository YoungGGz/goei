// L 공통 갈래 「저장 실패」: 보조 방식 이미지 보충의 저장이 실패할 때 (T1 가짜 리스, tests/qc-host.mjs 스위치)
// node 인수인계/플레이순서_점검/3차/L/t1-save.mjs /tmp/t1fx/fixture.json   → out/t1-save.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, boot, startChat, output, chat, setVars, setSaveFail, clearSaveFail, saveFails, counts } from '../../../../tests/qc-host.mjs';
const fx = process.argv[2] ?? '/tmp/t1fx/fixture.json';
const fixture = JSON.parse(readFileSync(fx, 'utf8'));
const browser = await launch();
const res = {};
try {
  const { page, logs } = await boot(browser, fixture, { message: [], scriptstate: { $sh_on: '0' } }, { fixtureDir: dirname(resolve(fx)) });
  await startChat(page, 'A00', 2);
  await setVars(page, { $pp_on: '0', $st_asset_model: 'aux', $st_asset_on: '1' });
  const one = async (name, mode, from = 1) => {
    await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify([{ line: 1, tag: '<img=Jyaldi_smile>' }]) }]; window.__calls.llm = []; });
    await page.evaluate((n) => { window.__chat.message.push({ role: 'user', data: n, chatId: 'u-' + n }, { role: 'char', data: '쟈알디가 웃었다.\n\n그리고 걸어갔다.\n[▣|2025.01.01|05:00 AM|☀️|4°C|관리국|없음]', chatId: 'c-' + n }); }, name);
    const c0 = await counts(page); const l0 = logs.length;
    if (mode) await setSaveFail(page, 'chat', { from, mode, ...(from > 1 ? { count: 1 } : {}) });
    let err = null; try { await output(page); } catch (e) { err = String(e).slice(0, 200); }
    const fails = await saveFails(page); await clearSaveFail(page);
    const c = await chat(page);
    return { mode, from, err, llm: await page.evaluate(() => window.__calls.llm.length), setChatTried: (await counts(page)).setChat - c0.setChat, fails: fails.length, saved: c.message.at(-1).data.includes('<img=Jyaldi_smile>'), note: c.scriptstate.$goei_asset_note ?? null, logs: logs.slice(l0).filter((x) => /이미지|보충|저장/.test(x)) };
  };
  res.ok = await one('정상', null);
  res.throw = await one('던짐', 'throw');
  res.silent = await one('조용히', 'silent');
  res.throw2 = await one('둘째던짐', 'throw', 2);
  res.silent2 = await one('둘째조용히', 'silent', 2);
} finally { await browser.close(); }
writeFileSync(new URL('./out/t1-save.json', import.meta.url), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
