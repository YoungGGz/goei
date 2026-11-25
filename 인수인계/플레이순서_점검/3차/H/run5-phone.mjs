// H 구간 run5: 폰 344×882(터치) 화면 확인 — 소지품 칸·물건 팝업·사용 칸·가계부·설정 소지품 쪽. S-요원플레이
import { boot, openItems, act, fText, toastText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, auxKind, lastAsst, recorder, goItems } from './hlib.mjs';
import { writeFileSync } from 'node:fs';

const rec = recorder('run5');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json', width: 344, height: 882 });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function turn(tag, text, reply, updFn) {
  const s0 = await seqNow();
  await mainRule('m-' + tag, esc(text), reply);
  if (updFn) u.push(updFn);
  await t.send(text);
  for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); }
  await sleep(1500);
}
const overflowX = () => t.F().evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, wide: [...document.querySelectorAll('.gx *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1); }).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}:${Math.round(e.getBoundingClientRect().left)}~${Math.round(e.getBoundingClientRect().right)}`) }));

try {
  const q = '에일린은 구급상자와 붕대를 챙기고 택시비 3만 원을 냈다.';
  await turn('P1', 'P1 챙기기', `${q}\n${st({ time: '10:00 AM', bal: 110000 })}`, (d) => ({
    items: [
      { name: '구급상자', action: 'new', desc: '응급 처치 도구', usable: true, uses: 3, equip: 'none', icon: 'medical/구급상자/first aid kit', weight: 1.2, m: lastAsst(d)?.m ?? 'm1', quote: q },
      { name: '붕대', action: 'new', desc: '압박 붕대', usable: true, uses: 2, equip: 'none', icon: 'medical/붕대/bandage', weight: 0.1, m: lastAsst(d)?.m ?? 'm1', quote: q },
    ],
    transactions: [{ amount: -30000, memo: '택시비', m: lastAsst(d)?.m ?? 'm1', quote: q }],
  }));

  rec.expect('P-items', '폰 소지품 칸: 가로 넘침 없이 무게·칸 수·물건 칸이 보이고 사용 칸이 있음', 'CLAUDE.md 「PC와 폰 배치를 똑같이 만들지 않는다」 — 결정표 줄 없음(배치 자체는 확인만)');
  await openItems(t);
  const tx1 = await fText(t, '.gx-items');
  const ov1 = await overflowX();
  await t.shot('run5-폰-소지품');
  rec.actual('P-items', ov1.docW <= ov1.winW && /\/ 30kg/.test(tx1 ?? ''), { text: tx1?.slice(0, 300), ov: ov1 }, { shot: 'out/run5-폰-소지품.png' });

  rec.expect('P-pop', '폰에서 물건(구급상자) 누르면 팝업: 사용·버리기 단추가 화면 안에 보임', '코스 H-1 (폰 터치)');
  const kit = (await invState(t)).items.list.find((e) => e.name === '구급상자')?.id;
  const op = await act(t, 'items-open', kit, { wait: 1000 });
  const ov2 = await overflowX();
  const popBtns = await t.F().evaluate(() => [...document.querySelectorAll('button[data-action^="items-"]')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return `${e.dataset.action}:${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`; }));
  await t.shot('run5-폰-팝업');
  const useR = await act(t, 'items-use', kit);
  const toast = await toastText(t);
  await act(t, 'items-close');
  await t.shot('run5-폰-사용칸');
  rec.actual('P-pop', op === 'ok' && useR === 'ok' && ov2.docW <= ov2.winW, { op, useR, toast, popBtns, ov: ov2 }, { shot: 'out/run5-폰-팝업.png' });

  rec.expect('P-wallet', '폰 가계부: 잔고 110,000·택시비 줄, 가로 넘침 없음', '코스 H-3');
  await act(t, 'items-sub', 'wallet', { wait: 1000 });
  const tx3 = await fText(t, '.gx');
  const ov3 = await overflowX();
  await t.shot('run5-폰-가계부');
  rec.actual('P-wallet', /110,000/.test(tx3 ?? '') && /택시비/.test(tx3 ?? '') && ov3.docW <= ov3.winW, { text: tx3?.slice(0, 300), ov: ov3 }, { shot: 'out/run5-폰-가계부.png' });

  rec.expect('P-set', '폰 설정 소지품 쪽이 열리고 가로 넘침 없음', 'H-01 (한 페이지에 가계부·소지품·상점)');
  // 폰: 하단 바를 위로 쓸어 서랍을 연 뒤 「설정」 (app.ts commonDrawer)
  let e1 = await act(t, 'ed-open', 'set:screen', { wait: 1500 });
  let how = 'direct';
  if (e1 !== 'ok') {
    const bar = await t.F().locator('[data-action="tab"]:visible').first().boundingBox();
    if (bar) { await t.page.mouse.move(bar.x + 150, bar.y + bar.height / 2); await t.page.mouse.down(); await t.page.mouse.move(bar.x + 150, bar.y - 250, { steps: 12 }); await t.page.mouse.up(); await sleep(1200); }
    await t.shot('run5-폰-서랍');
    e1 = await act(t, 'ed-open', 'set:screen', { wait: 1500 }); how = 'swipe';
    if (e1 !== 'ok') { e1 = await act(t, 'cdr', null, { wait: 1200, force: true }); e1 = await act(t, 'ed-open', 'set:screen', { wait: 1500 }); how = 'grip'; }
  }
  let e2 = await act(t, 'ed-node', 'set:items', { wait: 1200 });
  if (e2 !== 'ok') { await act(t, 'ed-drawer', null, { wait: 1000 }); await t.shot('run5-폰-설정메뉴'); e2 = await act(t, 'ed-node', 'set:items', { wait: 1200 }); }
  const ov4 = await overflowX();
  const tx4 = await fText(t, '.gx');
  await t.shot('run5-폰-설정소지품');
  rec.actual('P-set', e2 === 'ok' && ov4.docW <= ov4.winW, { e1, how, e2, text: tx4?.slice(0, 200), ov: ov4 }, { shot: 'out/run5-폰-설정소지품.png' });
  await act(t, 'ed-close', null, { wait: 800 });
  await t.closeWindow();
  await t.shot('run5-폰-채팅칩');
} catch (e) {
  rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1500));
  await t.shot('run5-error').catch(() => {});
} finally {
  writeFileSync(`${OUT}/run5-errors.json`, JSON.stringify(t.errors.slice(-80), null, 1));
  await u.stop();
  await t.close();
}
