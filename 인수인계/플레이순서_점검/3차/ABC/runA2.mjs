// A2·A3 본체·세계 자료 받기 갈래 (실제 리스아이, 받는 주소를 끊거나 바꿔서)
// 사용: FAKE_URL=… node runA2.mjs <part-fail|newer|file|world-fail|slow>
//  part-fail : goei-body.7.txt 만 끊음 → 받기 창 → 끊긴 채 「다시 받기」 → 되살리고 「다시 받기」 → 본체 켜짐
//  newer     : goei-body.json 의 판을 0.21.99 로 → 받기 창 글이 플러그인 업데이트 안내인지
//  file      : 본체 조각 전부 끊음 → 받기 창 「파일로 넣기」(조각을 이은 goei-body.js) → 켜짐
//  world-fail: goei-data-world.* 끊음 → 세계 자료 창 → 「다시 받기」(끊긴 채) → 되살리고 「다시 받기」 → 켜짐
//  slow      : goei-body.5.txt 를 100초 늦게 → 받기 창이 언제 뜨는지(40초 시간 제한 ×2 길)
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { OUT, sleep } from './lib.mjs';

const which = process.argv[2] ?? 'part-fail';
const tag = `A2-${which}`;
const t = await openT2({ via: 'plain' });
const res = { tag, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 400)); };
const REL = t.cfg.rel;
let block = null; // 정규식: 맞는 받는 주소는 끊음
let hits = [];
// 받는 주소 가로채기: 틀의 route 보다 나중에 건 것이 먼저 돈다 (playwright)
await t.ctx.route((u) => u.href.includes('raw.githubusercontent.com/ygberserk/goei/release/') || (u.href.includes('/proxy2')), async (r) => {
  const req = r.request();
  let url = req.url();
  if (url.includes('/proxy2')) url = decodeURIComponent(req.headers()['risu-url'] || '');
  const name = decodeURIComponent((url.split('/ygberserk/goei/release/')[1] ?? '').split('?')[0]);
  if (!name) return r.fallback();
  if (block && block.test(name)) { hits.push({ name, at: Date.now() }); return r.abort(); }
  if (which === 'newer' && name === 'goei-body.json') {
    const j = JSON.parse(readFileSync(REL + name, 'utf8')); j.version = '0.21.99';
    return r.fulfill({ status: 200, body: JSON.stringify(j), headers: { 'access-control-allow-origin': '*' } });
  }
  if (which === 'slow' && name === 'goei-body.5.txt') { hits.push({ name, at: Date.now(), slow: true }); await sleep(100000); return r.fulfill({ status: 200, body: readFileSync(REL + name), headers: { 'access-control-allow-origin': '*' } }).catch(() => {}); }
  return r.fallback();
});
const panel = async (ms = 60000) => { try { const f = await t.frame('.gl-card', ms); return { f, text: await f.evaluate(() => [...document.querySelectorAll('.gl-card')].map((c) => c.innerText.replace(/\s+/g, ' ')).join(' / ')) }; } catch { return null; } };
const fabOn = () => t.R(() => document.querySelector('[x-goei-fab]')?.style.display === 'block');
try {
  if (which === 'part-fail') block = /^goei-body\.7\.txt$/;
  if (which === 'file') block = /^goei-body\.(\d+\.txt|json)$/;
  if (which === 'world-fail') block = /^goei-data-world\./;
  const t0 = Date.now();
  await t.setup();
  const p1 = await panel(which === 'slow' ? 150000 : 60000);
  step('받기 실패 → 창', '창 뜸 + 까닭 글', { sec: Math.round((Date.now() - t0) / 1000), text: p1?.text?.slice(0, 300), hits: hits.length }, !!p1);
  await t.shot(`${tag}-01-panel`);
  if (p1 && (which === 'part-fail' || which === 'world-fail')) {
    // 끊긴 채 다시 받기
    await p1.f.click('[data-gl="get"]');
    await sleep(4000);
    const p2 = await panel(5000);
    step('끊긴 채 「다시 받기」', '창 그대로·실패 글', p2?.text?.slice(0, 300), !!p2);
    block = null;
    await p1.f.click('[data-gl="get"]');
    let on = false; for (let i = 0; i < 40 && !on; i++) { await sleep(500); on = await fabOn(); }
    const p3 = await t.R(() => null);
    step('되살리고 「다시 받기」', '본체 켜짐(유령 단추)·창 닫힘', { fab: on, panelLeft: !!(await panel(1500)) }, on);
  }
  if (p1 && which === 'file') {
    const parts = JSON.parse(readFileSync(REL + 'goei-body.json', 'utf8')).parts;
    const code = parts.map((n) => readFileSync(REL + n, 'utf8')).join('');
    const [fc] = await Promise.all([t.page.waitForEvent('filechooser', { timeout: 10000 }), p1.f.click('[data-gl="file"]')]);
    await fc.setFiles({ name: 'goei-body.js', mimeType: 'text/javascript', buffer: Buffer.from(code) });
    let on = false; for (let i = 0; i < 40 && !on; i++) { await sleep(500); on = await fabOn(); }
    step('「파일로 넣기」(조각 이은 본체)', '본체 켜짐', { fab: on, stored: await t.R(async () => { const cs = await import('/src/ts/process/coldstorage.svelte.ts'); return String((await cs.pluginStorage.getItem('goei:body')) ?? '').length; }) }, on);
  }
  if (which === 'newer') {
    step('새 판 목록: 첫 창 글', '플러그인 업데이트 안내 글(11-14 D-4)', p1?.text, /옛 판/.test(p1?.text ?? ''));
    await p1.f.click('[data-gl="get"]'); await sleep(4000);
    const p2 = await panel(5000);
    step('새 판 목록: 「다시 받기」 뒤 창 글', '(관찰)', p2?.text, /옛 판/.test(p2?.text ?? ''));
  }
  await t.shot(`${tag}-02-end`);
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.hits = hits.slice(0, 50);
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-40);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
