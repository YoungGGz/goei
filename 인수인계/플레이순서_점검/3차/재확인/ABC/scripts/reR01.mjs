// 재확인 R01 덧붙임: (a) <think> 안에만 상태창(잔고 7), 본문엔 상태창 없음 → 잔고 맞춤이 7 로 가는지
// (b) <Thoughts>·<think> 안 <img=Kyuras_angry> 가 그림 칸으로 그려지는지 (본문엔 Jaemtri)
// (c) <thinking> 안 [shop:] 만 (본문엔 상점 표식 없음) → 상점 카드
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OUT, sleep, baseRules, turn, buildReply, worldTags, text } from './lib.mjs';
const t = await openT2({ via: 'plain', streaming: process.argv[2] === 'stream' });
const res = { at: new Date().toISOString(), stream: process.argv[2] === 'stream', steps: [] };
const step = (name, actual) => { res.steps.push({ name, actual }); console.log('-- ', name, '|', JSON.stringify(actual).slice(0, 500)); };
const ST = (n) => fileURLToPath(new URL(`../틀/states/${n}.json`, import.meta.url));
const BODY = { user: '잼트리에게 오후 일정을 묻는다.', prose: '잼트리가 서류철을 넘겼다.\n\n<img=Jaemtri_neutral>\n\n"오후엔 현장 견학이야. 늦지 마."', status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } };
const lastBox = () => t.R(() => {
  const b = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')].sort((a, b) => Number(b.dataset.chatIndex) - Number(a.dataset.chatIndex))[0];
  return { idx: b?.dataset.chatIndex, statusBoxes: b?.querySelectorAll('[data-goei-status]').length ?? 0, shop: /상점 열기/.test(b?.innerText ?? ''), imgs: [...(b?.querySelectorAll('img') ?? [])].map((i) => (i.getAttribute('src') ?? '').slice(0, 60) + ' alt=' + (i.getAttribute('alt') ?? '')), rawImgTag: /<img=|&lt;img=/.test(b?.innerHTML ?? ''), gims: [...(b?.querySelectorAll('[class*="gim"]') ?? [])].map((g) => ({ bg: (g.getAttribute('style') ?? '').match(/url\(['"]?([^'")]*)/)?.[1]?.slice(-50) ?? '', inDetails: !!g.closest('details') })), text: (b?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 400) };
});
const wallet = async () => { const st = await t.chatState(true); return { wallet: String(st.scriptstate?.$st_wallet ?? '').slice(0, 300) }; };
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await t.fabReady();
  await t.loadState(ST('S-관리국-3턴'));
  await sleep(2000);
  step('시작 잔고', await wallet());
  // (a) 생각에만 상태창
  let r = await turn(t, BODY, null, { replyFn: (req) => {
    const st = buildReply(req, BODY).split('\n'); const line = st.pop(); // 마지막 줄 = 상태창
    return `<think>계획: ${line.replace(/\|\d+\]$/, '|7]')}</think>\n` + st.join('\n');
  } });
  step('(a) 답 글', r.reply.slice(0, 300));
  step('(a) 화면 마지막 답', await lastBox());
  step('(a) 잔고 장부', await wallet());
  r = await turn(t, { ...BODY, user: '고개를 끄덕인다.' });
  step('(a) 다음 턴 [Previous status]', r.req.prevLine);
  await t.shot('reR01-a');
  // (b) 생각 안 그림 태그
  for (const tag of ['Thoughts', 'think']) {
    r = await turn(t, { ...BODY, user: '서류를 받아 든다.' }, null, { replyFn: (req) => `<${tag}>큐라스가 화낼 것. <img=Kyuras_angry></${tag}>\n` + buildReply(req, BODY) });
    step(`(b) <${tag}> 안 img: 화면`, await lastBox());
    await t.shot(`reR01-b-${tag}`);
  }
  // (c) <thinking> 안 상점만
  r = await turn(t, { ...BODY, user: '복도를 걷는다.' }, null, { replyFn: (req) => `<thinking>[shop: 생각 상점|생각 주인]</thinking>\n` + buildReply(req, BODY) });
  step('(c) <thinking> 안 shop: 화면', await lastBox());
  await t.shot('reR01-c');
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot('reR01-FAIL'); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-30);
  writeFileSync(`${OUT}/reR01-${res.stream ? 'stream' : 'plain'}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
