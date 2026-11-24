// 둘러보기 2: 차례로 눌러 가며 화면 글·단추 목록·캡처. 사용: node probe2.mjs <상태> '<sel1>' '<sel2>' ...
import { open, STATES, sleep, saveJson } from './lib.mjs';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('./out/probe', import.meta.url));
const [state, ...sels] = process.argv.slice(2);
const W = Number(process.env.W || 1280), H = Number(process.env.H || 800);
const t = await open({ out: OUT, width: W, height: H, touch: W < 600 });
const res = { state, steps: [] };
try {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  const F = await t.openWindow('.gx');
  await sleep(1200);
  const dump = async (name) => {
    const d = await F.evaluate(() => ({
      text: (document.querySelector('.gx-main, .gx-body, main') ?? document.querySelector('.gx'))?.innerText?.replace(/\n+/g, ' / ').slice(0, 2500),
      actions: [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null).map((e) => `[data-action="${e.dataset.action}"]${e.dataset.value != null ? `[data-value="${e.dataset.value}"]` : ''} «${(e.innerText || e.title || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 30)}»`),
      inputs: [...document.querySelectorAll('[data-input],[data-key]')].filter((e) => e.offsetParent !== null).map((e) => `${e.dataset.input ? 'input=' + e.dataset.input : 'key=' + e.dataset.key}`).slice(0, 60),
    }));
    await t.shot(`${state}-${name}`);
    return d;
  };
  let i = 0;
  for (const s of sels) {
    i++;
    try {
      if (s.startsWith('eval:')) await F.evaluate(s.slice(5));
      else await F.locator(s).first().click({ timeout: 6000 });
    } catch (e) { res.steps.push({ s, err: String(e.message).slice(0, 200) }); continue; }
    await sleep(1200);
    res.steps.push({ s, ...(await dump(String(i).padStart(2, '0'))) });
  }
  saveJson(`${OUT}/probe2-${state}-${Date.now()}.json`, res);
  for (const st of res.steps) console.log('\n#####', st.s, st.err ?? '', '\n', st.text ?? '', '\n', (st.actions ?? []).join('\n'), '\n', (st.inputs ?? []).join(' '));
  console.log('ERR', t.errors.filter((e) => !/displayData/.test(e)).slice(0, 10));
} catch (e) { console.error(e); } finally { await t.close(); }
