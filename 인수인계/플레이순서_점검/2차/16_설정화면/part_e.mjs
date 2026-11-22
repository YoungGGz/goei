// 파트 e: 폰 크기(390×844) 갈래 — 같은 동작이 폰 배치에서도 되나 (배치 모양은 다름이 정상)
import { fx, boot, launch, goNode, sleep, recorder, ss, prefs, settle, openStarted, barAct, startedChat, packs, setInput, closeEditor, openEditor } from './lib.mjs';

export default async function (part) {
  const R = recorder(part);
  const browser = await launch();
  const { page, errors } = await boot(browser, fx, startedChat(), 'phone', { store: packs() });
  await openStarted(page, 'set:items');
  await settle(page);
  const box = '.gw input.adv-val[data-change="set-items-slots"]';
  const plusBtn = '.gw [data-action="set-items-slots"][data-value="n:+"]';
  {
    const s = R.step('폰_칸수_더하기');
    const v0 = Number(await page.$eval(box, (e) => e.value));
    await page.tap(plusBtn).catch(async () => page.evaluate((q) => document.querySelector(q).click(), plusBtn));
    await settle(page);
    const v1 = Number(await page.$eval(box, (e) => e.value));
    const st = await ss(page);
    R.check(s, '+ 를 누르면 1 늘고 바로 저장', v1 === v0 + 1 && st.$it_slots === String(v1), v0 + 1, { v1, saved: st.$it_slots });
  }
  {
    const s = R.step('폰_칸수_직접입력_범위밖');
    await setInput(page, box, '999'); await settle(page);
    const hi = await page.$eval(box, (e) => e.max);
    const v = await page.$eval(box, (e) => e.value);
    const st = await ss(page);
    R.check(s, '999 → 최대값으로', v === hi && st.$it_slots === hi, hi, { v, saved: st.$it_slots });
  }
  {
    const s = R.step('폰_닫았다_다시열기');
    await closeEditor(page, true);
    await openEditor(page, 'set:items');
    await settle(page);
    const v = await page.$eval(box, (e) => e.value);
    R.check(s, '다시 열어도 같은 값', v === (await ss(page)).$it_slots, (await ss(page)).$it_slots, v);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    R.check(s, '가로 넘침 없음', !ov, false, ov);
  }
  {
    const s = R.step('폰_지침_고치기');
    await goNode(page, 'guide:Phone');
    await settle(page);
    const key = await page.evaluate(() => document.querySelector('.gw textarea[data-input="ed-guide-sec"]')?.dataset.key);
    await page.evaluate((k) => { const t = document.querySelector(`.gw textarea[data-key="${k}"]`); t.value = `${t.value.replace(/^\n/, '')}\n폰점검표식`; t.dispatchEvent(new Event('input', { bubbles: true })); }, key);
    await sleep(1800);
    const p = await prefs(page);
    R.check(s, '폰에서도 지침이 바로 저장', (p.guides?.Phone ?? '').includes('폰점검표식'), true, (p.guides?.Phone ?? '').includes('폰점검표식'));
  }
  {
    const s = R.step('폰_기본값저장_초기화');
    await barAct(page, 'save');
    const p = await prefs(page);
    R.check(s, '기본값으로 저장에 칸 수가 담김', p.vars?.$it_slots === (await ss(page)).$it_slots, (await ss(page)).$it_slots, p.vars?.$it_slots);
    await barAct(page, 'reset');
    const st = await ss(page); const p2 = await prefs(page);
    R.check(s, '초기화 → 칸 수 지움·지침 원래대로', st.$it_slots === undefined && !p2.guides?.Phone, { slots: undefined, guide: undefined }, { slots: st.$it_slots, guide: !!p2.guides?.Phone });
    R.state(s, { ss: st, prefs: p2 });
  }
  R.check(R.step('오류'), '페이지 오류 없음', errors.length === 0, [], errors.slice(0, 10));
  R.save();
  await browser.close();
}
