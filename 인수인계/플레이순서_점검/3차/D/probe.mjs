// 둘러보기: 상태 하나 넣고 플러그인 창의 화면별 data-action 목록과 캡처
import { open, STATES, sleep, saveJson } from './lib.mjs';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('./out/probe', import.meta.url));
const state = process.argv[2] || 'S-관리국-3턴';
const t = await open({ out: OUT });
try {
  await t.setup();
  const r = await t.loadState(STATES + state + '.json');
  await t.reload();
  const F = await t.openWindow('.gx');
  await sleep(1500);
  const dump = async (name) => {
    const d = await F.evaluate(() => ({
      title: document.querySelector('.gx')?.innerText?.slice(0, 1500),
      actions: [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null).map((e) => `${e.dataset.action}${e.dataset.value != null ? '=' + e.dataset.value : ''}${e.dataset.v != null ? ' v=' + e.dataset.v : ''} «${(e.innerText || e.title || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 30)}»`),
    }));
    await t.shot(name);
    return d;
  };
  const res = { r, home: await dump('home') };
  saveJson(OUT + '/probe-' + state + '.json', res);
  console.log(JSON.stringify(res, null, 1).slice(0, 6000));
} catch (e) { console.error(e); } finally { await t.close(); }
