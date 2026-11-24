// I 구간 run12: 코스 I-1 「소속 고치기」 — 인물 상세에 소속을 고치는 단추·입력 칸이 정말 없는지. 상세 안의 모든 조작 요소를 모으고 기본정보 칸을 캡처. PC 1280x800 · 폰 344x882
import { open, OUT, sleep, recorder } from './common.mjs';
const R = recorder('run12');
for (const [mode, vp] of [['pc', { width: 1280, height: 800 }], ['phone', { width: 344, height: 882, touch: true }]]) {
  const t = await open(vp);
  try {
    await t.setup();
    await t.loadState(OUT + '/run4-state.json');
    await t.openWindow('.gx'); await sleep(800);
    const act = (a, v) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [a, v ?? null]).then(() => sleep(1000));
    await act('rec-people'); await act('rec-person', '잼트리');
    const ctrls = await t.feval(() => { const pane = document.querySelector('.gx .pp-pane') ?? document.querySelector('.gx'); return [...pane.querySelectorAll('[data-action],[data-input],[data-change],input,select,textarea,[contenteditable="true"]')].map((e) => [e.dataset.action && 'a:' + e.dataset.action, e.dataset.input && 'i:' + e.dataset.input, e.dataset.change && 'c:' + e.dataset.change, !e.dataset.action && !e.dataset.input && !e.dataset.change ? e.tagName.toLowerCase() : null].filter(Boolean).join('|') + (e.dataset.value ? '=' + String(e.dataset.value).split('|').slice(1, 2).join('') : '')); });
    const uniq = [...new Set(ctrls)];
    const sub = await t.feval(() => document.querySelector('.gx .pp-pane small, .gx .pp-pane .ph-sub')?.innerText ?? null);
    // 기본정보 칸으로 내려 캡처
    const found = await t.feval(() => { const b = [...document.querySelectorAll('.gx [data-action="pp-pin"]')].find((e) => String(e.dataset.value).includes('|identity|')); if (!b) return null; const box = b.closest('.pp-slot, section, .ph-room > div') ?? b; box.scrollIntoView({ block: 'start' }); return (box.innerText ?? '').replace(/\s+/g, ' ').slice(0, 300); });
    await sleep(600);
    await t.shot(`../../I/out/run12-${mode}-identity`);
    R.step(`${mode} 인물 상세 조작 요소`, '소속을 고치는 단추·입력 칸이 있는지 사실로 (호감·호칭 고치기는 있음)', '코스 I-1 「소속 고치기」', { sub, identityHeader: found, controls: uniq.filter((x) => !/rec-sub|rec-docs|^a:gx-/.test(x)).map((x) => x.replace(/=.*/, '')).filter((x, i, a) => a.indexOf(x) === i), factionLike: uniq.filter((x) => /fac|faction|identity|소속|org/i.test(x)) }, null);
  } catch (e) { R.step(mode + ' 예외', '', '', String(e?.stack ?? e).slice(0, 800), false); } finally { await t.close(); }
}
