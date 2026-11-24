// 상점 켜기·끄기 설정 단추 찾기 (E8f 를 설정 화면으로 돌리려고)
import { openRun, sleep, STATES } from './lib.mjs';
const r = await openRun({ out: process.argv[2] });
const { t } = r;
await t.setup();
await t.loadState(STATES + 'S-상점표식.json');
await t.openWindow();
await sleep(1500);
console.log('ed-open', await r.fclickAction('ed-open', 'set:screen'));
await sleep(2000);
console.log(JSON.stringify(await t.feval(() => [...new Set([...document.querySelectorAll('[data-action]')].map((e) => `${e.dataset.action}|${e.dataset.value ?? ''}`).filter((s) => /items|ed-|nav/.test(s)))].slice(0, 60))));
const go = await t.feval(() => { const e = [...document.querySelectorAll('[data-value="set:items"]')][0]; if (!e) return null; e.click(); return e.dataset.action; });
console.log('go', go);
await sleep(2000);
const list = await t.feval(() => [...document.querySelectorAll('[data-action]')].map((e) => `${e.dataset.action}|${e.dataset.value ?? ''}|${(e.innerText || '').trim().slice(0, 20)}`).filter((s) => /shop|inv|wallet|상점/.test(s)));
console.log(JSON.stringify(list, null, 1));
await t.shot('probe-items');
await r.stop(); await t.close();
