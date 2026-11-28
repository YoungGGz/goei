// 재확인 남은칸2 R67: 폰 가로 882×344 를 터치로 처음부터 연 판 (KL 재확인은 PC 세션 창 크기만 바꿈)
import { openT2 } from '../../틀/risu-t2.mjs';
import { gimStyle, AUX_BASE, REPLY_MAIN } from '../../L/run.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-rest2/out-r67';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = Number(process.argv[2] ?? 882), H = Number(process.argv[3] ?? 344);
const res = { size: `${W}x${H}`, touch: true, at: new Date().toISOString() };
const t = await openT2({ via: 'plain', width: W, height: H, touch: true, out: OUT, fake: process.env.FAKE_URL });
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: [{ id: 'main', route: 'main', reply: REPLY_MAIN(1) }, ...AUX_BASE] });
  await t.setup();
  await t.loadState('/home/user/goei/인수인계/플레이순서_점검/3차/틀/states/S-관리국-3턴.json');
  await sleep(1500);
  res.env = await t.page.evaluate(() => ({ vw: innerWidth, vh: innerHeight, coarse: matchMedia('(pointer: coarse)').matches, land: matchMedia('(max-height: 499px) and (pointer: coarse)').matches, touchPts: navigator.maxTouchPoints }));
  await t.send('잼트리에게 출입증을 보여 준다.');
  await sleep(5000);
  await t.page.evaluate(() => { const b = [...document.querySelectorAll('.default-chat-screen .x-risu-gim, .default-chat-screen .gim')].pop(); b?.scrollIntoView({ block: 'center' }); });
  await sleep(800);
  res.first = await gimStyle(t);
  res.boxes = await t.R(() => [...document.querySelectorAll('.default-chat-screen .x-risu-gim, .default-chat-screen .gim')].map((b) => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return { w: Math.round(r.width), h: Math.round(r.height), maxW: s.maxWidth, maxH: s.maxHeight, cls: String(b.className).slice(0, 40) }; }).slice(-4));
  await t.shot('R67t-chat');
  // 그림 칸 하나를 눌러 본다 (펼침/확대가 있는지)
  const box = await t.page.$('.default-chat-screen .risu-chat:last-of-type .x-risu-gim, .default-chat-screen .x-risu-gim');
  if (box) { await box.tap().catch(() => {}); await sleep(1200); res.afterTap = await t.page.evaluate(() => { const o = [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); return (s.position === 'fixed') && e.getBoundingClientRect().width > 200 && s.display !== 'none' && s.visibility !== 'hidden'; }).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 40), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })).slice(0, 6); return o; }); await t.shot('R67t-after-tap'); }
  res.overflow = await t.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
} catch (e) { res.error = String(e?.stack ?? e).slice(0, 800); await t.shot('R67t-error').catch(() => {}); }
console.log(JSON.stringify(res, null, 1));
writeFileSync(`${OUT}/R67t-${W}x${H}.json`, JSON.stringify(res, null, 1));
await t.close();
