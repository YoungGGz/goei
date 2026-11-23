// 파트 f: 관제(호출 흐름) 페이지 수 칸의 범위 밖 직접 입력 다시 보기 — 칸에 보이는 값과 저장값, 다시 열면 어떤지
import { fx, boot, launch, goNode, recorder, ss, settle, openStarted, startedChat, packs } from './lib.mjs';

export default async function (part) {
  const R = recorder(part);
  const browser = await launch();
  const { page, errors } = await boot(browser, fx, startedChat(), 'pc', { store: packs() });
  await openStarted(page, 'manage:flow');
  await settle(page);
  const cases = [['gen:retries', '$gen_retries', '1003', '3'], ['hs-retry', '$hs_retry', '-5', '0'], ['gen:reiterate', '$gen_reiterate', '1002', '2']];
  for (const [frag, v, text, want] of cases) {
    const s = R.step(`관제_${v.slice(1)}_${text}`);
    const sel = `.gw input.adv-val[data-change="fl-do"][data-key*="${frag}"]`;
    const all = await page.$$(sel);
    let el = null;
    for (const x of all) if (await x.isVisible()) { el = x; break; }
    if (!el) { R.check(s, '칸이 있음', false, true, false); continue; }
    // 사람이 하듯: 칸을 눌러 지우고 치고 Enter, 다른 곳을 누른다
    await el.click({ clickCount: 3 });
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await settle(page);
    const vis = (q) => page.evaluate((q) => [...document.querySelectorAll(q)].find((e) => e.getBoundingClientRect().width > 0)?.value ?? null, q);
    const shown = await vis(sel);
    const st = await ss(page);
    R.file(s, `입력 ${text}\n칸에 보이는 값 ${shown}\n저장값 ${v}=${st[v]}\n`);
    R.check(s, `저장값이 끝값 ${want}`, String(st[v] ?? '') === want || (want === '0' && (st[v] ?? '') === ''), want, st[v]);
    R.check(s, `칸에 보이는 값도 끝값 ${want}`, shown === want || (want === '0' && shown === ''), want, shown);
    await goNode(page, 'set:screen'); await settle(page);
    await goNode(page, 'manage:flow'); await settle(page);
    const again = await vis(sel);
    R.check(s, '다른 페이지 갔다 오면 칸 = 저장값', again === want || (want === '0' && again === ''), want, again);
  }
  R.check(R.step('오류'), '페이지 오류 없음', errors.length === 0, [], errors.slice(0, 10));
  R.save();
  await browser.close();
}
