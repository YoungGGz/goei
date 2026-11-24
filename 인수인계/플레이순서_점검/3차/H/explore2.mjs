import { boot, act, fText, sleep, OUT, baseRules, updaterScript, openItems } from './hlib.mjs';
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot();
await openItems(t);
console.log(await act(t,'ed-open','set:screen',{wait:2000}));
const dumpAll = async (tag) => { const a = await t.page.evaluate(() => 1); for (const f of t.page.frames()) { try { const r = await f.evaluate(() => [...document.querySelectorAll('[data-action],[data-change]')].filter(e=>e.offsetParent!==null).map((e) => `${e.dataset.action??('change:'+e.dataset.change)}=${e.dataset.value ?? ''}|${(e.innerText||e.getAttribute('aria-label')||e.value||'').replace(/\s+/g,' ').slice(0,40)}`)); console.log(`---${tag} frame ${f.url().slice(0,60)}\n`+r.filter(x=>!/^(agent-info|ops-|pick-event|wiki-goto|end-event)/.test(x)).join('\n')); } catch(e){} } };
for (const n of ['set:items','set:status']) { await act(t,'ed-node',n,{wait:1500}); const r = await t.F().evaluate(() => [...document.querySelectorAll('[data-action],[data-change]')].filter(e=>e.offsetParent!==null).map((e) => `${e.dataset.action??('change:'+e.dataset.change)}=${e.dataset.value ?? ''}|${(e.closest('[data-row],.st-row,.gx-row,li,tr')?.querySelector('b,h3,.st-name,th,td')?.innerText||'').replace(/\s+/g,' ').slice(0,20)}|${(e.innerText||e.getAttribute('aria-label')||e.value||'').replace(/\s+/g,' ').slice(0,40)}`)); console.log('---'+n+'\n'+r.filter(x=>!/^(ed-node|ed-tab|nav-|items-|ai-toggle|ed-close)/.test(x)).join('\n')); await t.shot('x-'+n.replace(':','-')); }
await u.stop(); await t.close();
