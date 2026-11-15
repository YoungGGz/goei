// 망상홈쇼핑 방송 화면 확인 (2026-11-11, 작업용): node tests/homeshop-browser.mjs <사진 폴더>
// 인터넷 즐겨찾기로 열기 → 편성(상품·큐시트·채팅) 한 번 호출 → 방송이 큐시트대로 흐른다 → 스티커 들추기 → 전화 주문(흥정·맞교환 감정 → 맞교환으로 주문) → 설정 페이지
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';
import { SHOW } from './homeshop-show.mjs';

const OUT = process.argv[2] || '.scratch/br-homeshop';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
// 맞교환으로 내밀 물건: 숨은 효과(진실)가 상담원 요청에 가는지 본다
const ITEMS0 = { list: [{ id: 'i_old', name: '낡은 손전등', desc: '배터리 반쯤', effect: '', truth: '빛이 닿은 그림자를 붙잡아 둔다', use: true, state: 'damaged', from: 'manual', anchor: '', at: '2025-01-01T00:00:00Z' }], log: [] };
const TRUTH = '건너편 교환대의 귀. 자정에 송신 단추를 세 번 누르면 풀린다';
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const VPS = [['pc', { width: 1280, height: 800, touch: false }], ['pcbig', { width: 1920, height: 1080, touch: false }], ['phone', 'phone']].filter(([v]) => !process.env.VP || process.env.VP.split(',').includes(v));
for (const [vp, size] of VPS) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 500000, log: [] }), $st_items: JSON.stringify(ITEMS0) } };
  const { page, errors } = await boot(browser, fx, chat, size, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
  let n = 0;
  const shot = async (tag) => { await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
  const goHs = async () => {
    if (vp !== 'phone') { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); }
    else { await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="hs"]'); }
  };
  await goHs();
  await page.waitForSelector('.hs-scr', { timeout: 6000 });
  await shot('connecting');
  await page.waitForSelector('.hs-l3', { timeout: 15000 });
  const call = await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'));
  assert.ok(call.includes('<cue>') && call.includes('wide'), '방송 절이 요청문에 들어감');
  if (process.env.GIF) {
    // 움직임 확인용: 방송 칸을 0.2초마다 찍는다 (GIF=장수)
    const box = await page.locator(vp !== 'phone' ? '.hs-bd' : '.hs-main').boundingBox();
    mkdirSync(`${OUT}/gif-${vp}`, { recursive: true });
    for (let i = 0; i < Number(process.env.GIF); i++) { await page.screenshot({ path: `${OUT}/gif-${vp}/${String(i).padStart(3, '0')}.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 1280 - box.x), height: Math.min(box.height, 800 - box.y) } }); await page.waitForTimeout(120); }
    await page.close();
    continue;
  }
  if (process.env.TRACE) {
    // 동작 흐름 기록: 0.1초마다 「컷:동작:큐」 → 바뀐 자리만
    const seq = await page.evaluate(async () => { const out = []; for (let i = 0; i < 300; i++) { const v = document.querySelector('.hs-scr')?.dataset.clip ?? ''; if (out.at(-1)?.[1] !== v) out.push([i / 10, v]); await new Promise((r) => setTimeout(r, 100)); } return out; });
    console.log(vp, seq.map(([t, v]) => `${t.toFixed(1)} ${v}`).join('\n'));
  }
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(2600); await shot(`t${i}`); }
  const ss = () => page.evaluate(() => window.__chat.scriptstate);
  // 사이트 안 스크롤이 된다 · 방송 칸이 보이는 높이의 2/3 를 넘지 않는다 (11-11 사용자)
  const geo = await page.evaluate(() => { const h = document.querySelector('.br-page > .hs'); const tv = document.querySelector('.hs-scr').getBoundingClientRect(); const before = h.scrollTop; h.scrollTop = 99999; const moved = h.scrollTop - before; h.scrollTop = before; return { moved, can: h.scrollHeight > h.clientHeight, tvH: tv.height, pageH: h.clientHeight, chat: document.querySelector('.hs-chat').getBoundingClientRect().width }; });
  console.log(vp, JSON.stringify(geo));
  assert.ok(!geo.can || geo.moved > 0, '스크롤 됨');
  assert.ok(geo.tvH <= geo.pageH * 0.66, `방송 칸 높이 ${geo.tvH} / ${geo.pageH}`);
  await page.evaluate(() => document.querySelector('.hs-sec')?.scrollIntoView({ block: 'end' })); await page.waitForTimeout(300); await shot('lineup');
  await page.evaluate(() => document.querySelector('.hs-gnb')?.scrollIntoView({ block: 'start' }));
  // 채팅은 지금 부의 것만 흐르고, 다 흘러도 되풀이하지 않는다 (11-12 사용자)
  { const lines = await page.evaluate(() => [...document.querySelectorAll('.hs-chlog p')].map((p) => p.textContent));
    assert.ok(!lines.some((t) => t.includes('이부전용') || t.includes('삼부전용')), `다른 부 채팅이 섞임: ${lines.join(' / ')}`);
    assert.equal(new Set(lines).size, lines.length, `채팅 되풀이: ${lines.join(' / ')}`); }
  // 스티커 들추기: 모서리를 젖히면 숨은 효과 몇 글자만 (진실 전체는 화면 어디에도 없다)
  await click('[data-action="hs-pop"][data-value="peek"]'); await page.waitForTimeout(300); await shot('peek');
  assert.equal(await page.locator('.hs-sticker .corner').count(), 1, '들출 모서리');
  await click('[data-action="hs-lift"]'); await page.waitForTimeout(900); await shot('peek-lifted');
  assert.equal(await page.locator('.hs-sticker.lifted').count(), 1, '젖혀짐');
  { const frag = (await page.textContent('.hs-und .emb b')).trim();
    assert.ok(frag.length > 0 && frag.length <= 8 && TRUTH.replace(/\s/g, '').includes(frag.replace(/\s/g, '')), `진실 조각: ${frag}`);
    assert.ok(!(await page.evaluate((t) => document.body.innerHTML.includes(t), TRUTH)), '진실 전체는 화면에 없음'); }
  await click('.hs-pop header [data-action="hs-pop"]');
  // 채팅 보내기: 한 번 더 호출 → 진행자 반응이 끼어든다
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<cue>\n바스트|웃음|은하제 고객님, 좋은 질문이십니다!|-\n</cue>\n<chat>\n민지맘|ㅋㅋㅋ 읽어줬다\n???|읽지 마세요\n</chat>' }]; });
  await page.fill('[data-input="hs-say"]', '진짜 누가 받아요?');
  await click('[data-action="hs-say"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.hs-chlog p')].some((p) => p.textContent.includes('읽어줬다')), null, { timeout: 30000 });
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.hs-chlog p.me')].some((p) => p.textContent.includes('진짜 누가 받아요?'))), '내 채팅 줄');
  await page.waitForFunction(() => [...document.querySelectorAll('.hs-chlog p.host')].some((p) => p.textContent.includes('좋은 질문')), null, { timeout: 30000 });
  await shot('say');
  // 전화 주문: 결제 네 가지 → 흥정 → 맞교환 감정 → 그 조건으로 주문 (원 몫은 가계부, 내민 물건은 소지품에서 빠짐)
  const wallet0 = JSON.parse((await ss()).$st_wallet);
  await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(300); await shot('call');
  assert.equal(await page.locator('[data-action="hs-pay"]').count(), 4, '결제 네 가지');
  assert.ok((await page.textContent('.hs-pop')).includes('380,000원'), '원 값');
  assert.ok((await page.textContent('.hs-pop')).includes('출연 6회'), '출연');
  assert.ok((await page.textContent('.hs-op')).includes('주문 도와드리겠습니다'), '상담원 인사');
  // 흥정: 상담원(사람이 아닌 채널 직원) 요청 한 번
  await click('[data-action="hs-pay"][data-value="talk"]'); await page.waitForTimeout(200);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<operator>출연이라면 네 번은 주셔야겠습니다, 고객님. 머리카락도 조금 보내 주시고요.</operator>\n<terms>\nappear|4\nother|머리카락 한 줌\n</terms>' }]; });
  await page.fill('[data-input="hs-op"]', '출연 두 번으로 안 될까요');
  await click('[data-action="hs-op"]');
  await page.waitForFunction(() => !!document.querySelector('.hs-terms') && document.querySelector('.hs-terms').textContent.includes('머리카락'), null, { timeout: 15000 });
  { const req = await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'));
    assert.ok(req.includes('not a human') && req.includes('출연 두 번으로 안 될까요'), '흥정 요청: 상담원 지침 + 내 말'); }
  await page.waitForTimeout(200); await shot('call-talk');
  // 맞교환: 물건 고르기 → 감정 받기
  await click('[data-action="hs-pay"][data-value="barter"]'); await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-action="hs-appraise"][disabled]').count(), 1, '물건 고르기 전에는 감정 못 받음');
  await click('[data-action="hs-offer"][data-value="i_old"]'); await page.waitForTimeout(200);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<operator>손전등이군요. 그것만으로는 모자랍니다. 이십만 원을 더 얹어 주시면 보내 드리겠습니다.</operator>\n<terms>\nmoney|200000\nitems|낡은 손전등\n</terms>' }]; });
  await click('[data-action="hs-appraise"]');
  await page.waitForFunction(() => (document.querySelector('.hs-terms')?.textContent || '').includes('200,000'), null, { timeout: 15000 });
  { const req = await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'));
    assert.ok(req.includes('빛이 닿은 그림자를 붙잡아 둔다'), '내민 물건의 숨은 효과가 상담원에게 감'); }
  await page.waitForTimeout(200); await shot('call-barter');
  await click('[data-action="hs-order"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_orders || '').includes('무전기'), null, { timeout: 8000 });
  await page.waitForTimeout(300); await shot('call-done');
  let st = await ss();
  const o1 = JSON.parse(st.$hs_orders)[0];
  assert.deepEqual([o1.pay, o1.n, o1.dues.length], ['barter', 0, 0]);
  assert.ok(o1.how.includes('200,000원') && o1.how.includes('낡은 손전등'), `치른 것: ${o1.how}`);
  const w1 = JSON.parse(st.$st_wallet);
  assert.equal(w1.log.length, wallet0.log.length + 1, '가계부 한 줄');
  assert.equal(w1.log.at(-1).amount, -200000);
  assert.ok(st.$st_items.includes('택배 상자(미개봉)'), '소지품에 택배 상자');
  { const live = JSON.parse(st.$st_items).list.filter((x) => !x.soldAt);
    assert.ok(!live.some((x) => x.id === 'i_old'), '내민 손전등은 소지품에서 빠짐'); }
  await click('.hs-pop footer [data-action="hs-page"][data-value="orders"]'); await page.waitForTimeout(300); await shot('orders');
  assert.ok((await page.textContent('.hs-ol')).includes('낡은 손전등'));
  // 방청 신청
  await click('.hs-menu [data-action="hs-pop"][data-value="aud"]'); await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-action="hs-aud"][disabled]').count(), 1, '동의 전에는 신청 못 함');
  await click('[data-action="hs-agree"]'); await page.waitForTimeout(200); await shot('aud');
  await click('[data-action="hs-aud"]');
  await page.waitForFunction(() => !!window.__chat.scriptstate.$hs_aud); await page.waitForTimeout(200); await shot('aud-done');
  await click('.hs-pop footer [data-action="hs-pop"]');
  // 소지품에서 택배 상자 열기
  const boxId = o1.boxId;
  await click('[data-action="nav-tab"][data-value="items"]'); await page.waitForTimeout(300);
  await click(`[data-action="items-open"][data-value="${boxId}"]`); await page.waitForTimeout(300); await shot('box');
  assert.equal(await page.locator('[data-action="hs-box-open"]').count(), 1, '소지품 상세에 「열기」');
  await click('[data-action="hs-box-open"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$hs_orders)[0].openKey !== undefined, null, { timeout: 8000 });
  st = await ss();
  const live = JSON.parse(st.$st_items).list.filter((x) => !x.soldAt).map((x) => x.name);
  assert.ok(live.includes('행운의 무전기') && !live.some((n) => n.includes('택배 상자')), `상자를 열면 실제 물건: ${live}`);
  { const got = JSON.parse(st.$st_items).list.find((x) => x.name === '행운의 무전기' && !x.soldAt);
    assert.deepEqual([got.truth, got.price, !!got.walletId], [TRUTH, 200000, true], '숨은 효과·치른 값이 물건에 남음'); }
  await page.waitForTimeout(300); await shot('box-opened');
  await click('[data-action="items-close"]'); await goHs(); await page.waitForTimeout(400);
  await click('[data-action="hs-page"][data-value="orders"]'); await page.waitForTimeout(300); await shot('orders-opened');
  assert.ok((await page.textContent('.hs-ol:last-of-type')).includes('수령 확인'));
  await click('[data-action="hs-page"][data-value=""]'); await page.waitForTimeout(300);

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
  await click('[data-action="hs-page"][data-value="sched"]'); await page.waitForTimeout(300); await shot('sched');
  await openEditor(page, 'set:hs'); await page.waitForTimeout(300); await shot('set');
  await click('.gw [data-action="hs-retry"][data-value="n:+"]'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$hs_retry), '2', '자동 다시 연결 증감');
  await goNode(page, 'guide:Hs'); await page.waitForTimeout(300); await shot('guide');
  // 독립 창: 본편 카드 「접속하기」 → 상황판 없이 인터넷 창만 망상홈쇼핑으로 (고유 상점 @web)
  await closeEditor(page, true).catch(() => {}); await closeWin(page); await page.waitForTimeout(200);
  const html = await page.evaluate(() => window.__calls.handlers.display('TV를 켰다.\n[shop: 망상홈쇼핑|@web:hs]'));
  assert.ok(html.includes('data-goei-shop="hs"'), '접속하기 카드');
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:240px;width:340px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate(() => window.__calls.handlers.display('TV를 켰다.\n[shop: 망상홈쇼핑|@web:hs]'));
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForSelector('.gx-netsolo .hs-scr', { timeout: 8000 }).catch(async (e) => { await shot('solo-fail'); throw e; });
  await page.waitForTimeout(2500); await shot('solo');
  if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 5));
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
