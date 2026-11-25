// 폰 가로(882×344)에서 설정 창 위 오른쪽에 뜬 초록 단추가 무엇인지 (CM-폰가로 캡처) 확인용
import { session, sleep } from './lib.mjs';
const S = await session('dbgFab', { w: 882, h: 344, touch: true });
try {
  await S.fakeReset(); await S.t.setup(); await S.loadState('S-관리국-3턴.json');
  await S.ed('rule:all'); await sleep(800);
  const top = await S.t.R(() => {
    const fab = document.querySelector('[x-goei-fab]');
    const fr = fab?.getBoundingClientRect();
    const cont = document.querySelector('[x-goei-container], iframe');
    const at = fr ? document.elementFromPoint(fr.x + fr.width / 2, fr.y + fr.height / 2) : null;
    return { fab: fab ? { disp: getComputedStyle(fab).display, z: getComputedStyle(fab).zIndex, rect: fr && [fr.x, fr.y, fr.width, fr.height].map(Math.round) } : null,
      cont: cont ? { tag: cont.tagName, z: getComputedStyle(cont).zIndex, pos: getComputedStyle(cont).position, rect: [cont.getBoundingClientRect().width, cont.getBoundingClientRect().height].map(Math.round) } : null,
      topAt: at ? (at.closest('[x-goei-fab]') ? 'fab' : at.tagName + '.' + at.className) : null };
  });
  const what = await S.fe(() => { const e = document.elementFromPoint(845, 100); const b = e?.closest('button, a, [data-action]') ?? e; return b ? { tag: b.tagName, cls: b.className, act: b.dataset?.action ?? null, title: b.getAttribute('title') ?? b.getAttribute('aria-label'), pos: getComputedStyle(b).position, parentCls: b.parentElement?.className } : null; });
  const topWhat = await S.t.R(() => { const e = document.elementFromPoint(845, 100); let n = e; const chain = []; for (let i = 0; n && i < 5; i++, n = n.parentElement) chain.push(n.tagName + '.' + String(n.className?.baseVal ?? n.className ?? '').slice(0, 40) + [...(n.attributes ?? [])].filter((a) => a.name.startsWith('x-')).map((a) => '[' + a.name + ']').join('')); return { chain, z: e && getComputedStyle(e.closest('[style], div') ?? e).zIndex }; });
  console.log(JSON.stringify({ what, topWhat }));
  const inner = await S.fe(() => { const b = document.querySelector('.gw [data-action="ed-rule-new"]'); const r = b?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height].map(Math.round); });
  console.log(JSON.stringify({ top, newRuleBtn: inner }));
  await S.t.shot('dbgFab');
} finally { await S.close(); }
process.exit(0);
