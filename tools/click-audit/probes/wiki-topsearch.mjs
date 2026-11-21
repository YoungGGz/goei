// 위키 머리줄 검색칸에 한 글자씩 쳐서 결과 칸이 바로 바뀌는지 찍는다 (11-20)
export default async function (page, { vp, shots, log }) {
  const out = [];
  if (!(await page.$('.wk'))) {
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'br-go'; b.dataset.value = 'wk'; b.style.display = 'none'; (document.querySelector('.gx-panel') || document.querySelector('.gx')).appendChild(b); b.click(); });
    await new Promise((r) => setTimeout(r, 900));
  }
  // 문서 하나 열어 둔 상태(대문 아님)에서
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'wiki-pick'; b.dataset.value = '소라 랜드'; b.style.display = 'none'; document.querySelector('.wk').appendChild(b); b.click(); });
  await new Promise((r) => setTimeout(r, 800));
  const sel = '.wk .top .sr input';
  await page.click(sel);
  for (const [i, ch] of ['특', '수', '재'].entries()) {
    await page.keyboard.type(ch);
    await new Promise((r) => setTimeout(r, 250));
    const st = await page.evaluate(() => { const b = document.querySelector('.wk .wtres'); const r = b?.getBoundingClientRect(); return { shown: !!b && getComputedStyle(b).display !== 'none', rows: b?.querySelectorAll('.it').length ?? 0, h: Math.round(r?.height ?? 0), w: Math.round(r?.width ?? 0), first: b?.querySelector('.it')?.textContent?.trim() ?? '' }; });
    await page.screenshot({ path: `${shots}/top_${vp}_${i + 1}.png` });
    out.push({ typed: ch, ...st });
  }
  // 결과 첫 줄을 누르면 그 문서로 가고 결과 칸이 닫힌다
  await page.click('.wk .wtres .it');
  await new Promise((r) => setTimeout(r, 900));
  const after = await page.evaluate(() => ({ h1: document.querySelector('.wk h1')?.textContent?.trim(), shown: getComputedStyle(document.querySelector('.wk .wtres')).display !== 'none', q: document.querySelector('.wk .top .sr input')?.value }));
  await page.screenshot({ path: `${shots}/top_${vp}_pick.png` });
  out.push({ after });
  log(JSON.stringify(out));
  return out;
}
