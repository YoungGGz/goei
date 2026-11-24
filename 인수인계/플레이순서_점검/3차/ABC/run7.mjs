// 0단계_본것 7번 가르기: S-프리랜서-임무를 setup 직후 첫 상태로 넣으면 상태창·시작 카드가 원문으로 남는가, 왜인가.
// 사용: FAKE_URL=http://192.0.2.2:8796 node run7.mjs <갈래>
//   갈래 a: setup → 바로 loadState(프리랜서)            (0단계에서 본 길)
//   갈래 b: setup → 유령 단추(본체 뜸) 기다림 → loadState(프리랜서)
//   갈래 c: setup → 바로 loadState(관리국-3턴)            (대조: 0단계에선 정상)
//   갈래 d: setup → 바로 loadState(백일몽-3턴)            (대조)
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OUT, sleep } from './lib.mjs';

const which = process.argv[2] ?? 'a';
const ST = (n) => fileURLToPath(new URL(`../틀/states/${n}.json`, import.meta.url));
const file = { a: 'S-프리랜서-임무', b: 'S-프리랜서-임무', c: 'S-관리국-3턴', d: 'S-백일몽-3턴', e: 'S-프리랜서-임무', f: 'S-관리국-3턴' }[which];
const t = await openT2({ via: 'plain', width: 1280, height: 800 });
const res = { which, file, at: new Date().toISOString(), marks: [] };
const look = async (label) => {
  const r = await t.R(() => {
    const boxes = [...document.querySelectorAll('.default-chat-screen .risu-chat[data-chat-index]')];
    return boxes.map((b) => {
      const ct = b.querySelector('.chattext');
      const txt = ct?.innerText ?? '';
      return { idx: Number(b.dataset.chatIndex), rawStatus: /\[▣\|/.test(txt), rawCard: /%%SCENE_CARD|%%GOEI/.test(txt), statusBox: !!ct?.querySelector('[data-goei-status], .goei-status, [data-goei-card]'), len: txt.length, head: txt.replace(/\s+/g, ' ').slice(0, 80) };
    }).sort((a, b) => a.idx - b.idx);
  });
  const fab = await t.R(() => document.querySelector('[x-goei-fab]')?.style.display ?? null);
  res.marks.push({ label, t: Date.now(), fab, msgs: r });
  console.log(label, 'fab=', fab, JSON.stringify(r.map((m) => [m.idx, m.rawStatus ? 'RAW▣' : '', m.rawCard ? 'RAWCARD' : '', m.statusBox ? 'card' : ''].join(''))));
};
try {
  await t.fake('reset', {});
  res.setup = await t.setup();
  await look('setup 직후');
  if (which === 'b') { await t.fabReady(); await look('유령 단추 뜬 뒤'); }
  if (which === 'e' || which === 'f') {
    // 리스아이 pluginV2.editdisplay 처리기를 감싸 부를 때마다 받은 글·돌려준 글·걸린 시간을 남긴다 (리스아이 동작은 그대로)
    res.wrap = await t.R(async () => {
      const pl = await import('/src/ts/plugins/plugins.svelte.ts');
      window.__dispLog = [];
      const fns = [...pl.pluginV2.editdisplay];
      pl.pluginV2.editdisplay.clear();
      for (const f of fns) pl.pluginV2.editdisplay.add(async (d) => {
        const t0 = performance.now(); const rec = { t0: Math.round(t0), inMark: /\[▣\||%%SCENE_CARD/.test(d), inHead: String(d).slice(0, 40) };
        window.__dispLog.push(rec);
        try { const r = await f(d); rec.ms = Math.round(performance.now() - t0); rec.outRaw = /\[▣\||%%SCENE_CARD/.test(String(r)); rec.outNull = r == null; return r; }
        catch (e) { rec.err = String(e); throw e; }
      });
      return fns.length;
    });
  }
  const consoleBefore = t.errors.length;
  res.load = await t.loadState(ST(file));
  let acc = 0; for (const ms of [0, 3000, 5000, 7000]) { await sleep(ms); acc += ms; await look(`넣은 뒤 +${acc / 1000}s`); }
  await t.shot(`run7-${which}-chat`);
  res.dispLog = await t.R(() => window.__dispLog ?? null);
  if (res.dispLog) console.log('dispLog', JSON.stringify(res.dispLog.filter((x) => x.inMark).map((x) => [x.t0, x.ms, x.outRaw, x.outNull, x.err ?? ''])));
  res.console = t.errors.slice(consoleBefore).filter((e) => !/displayData/.test(e));
  // 플러그인 본체가 떴는지(유령 단추), 처리기 등록 여부
  res.bodyState = await t.R(() => ({ fab: document.querySelector('[x-goei-fab]')?.style.display ?? null, prog: !!document.querySelector('[x-goei-prog]') }));
  // 채팅을 다른 것으로 갔다 오기(리스AI 다시 그리기)
  await t.switchChat(1); await sleep(1500); await t.switchChat(0); await sleep(3000);
  await look('다른 채팅 다녀온 뒤');
  await t.shot(`run7-${which}-after-switch`);
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); }
finally {
  res.allConsole = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  writeFileSync(`${OUT}/run7-${which}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
