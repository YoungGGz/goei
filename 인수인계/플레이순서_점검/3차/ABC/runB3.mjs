// B3 소속×시작 방식×언어 표 (실제 단추). 새 채팅마다 시작 패널에서 고르고 출발.
//  인물 장면: 출발 뒤 첫 장면 메시지(언어·표식)만 본다(본편 요청 없음).
//  직접 입력: 출발 = 첫 전송 → 첫 본편 요청 글(표식·NEW 줄·잔고·{{user}}) 을 보고 짧은 답.
//  커스텀 임무: 출발 → 임무 창이 뜨는지만(보내지 않음, 대표 줄기 다에서 돌림).
//  묶음(이면의 주민들): 첫 요원으로, 인물 장면 칸이 비는지(B-02).
// 사용: FAKE_URL=… node runB3.mjs [--lang ko,en]
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { OUT, sleep, baseRules, turn, text } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LANGS = opt('--lang', 'ko,en').split(',');
const t = await openT2({ via: 'plain' });
const rows = [];
const res = { at: new Date().toISOString(), rows };
const hangul = (s) => { const h = (s.match(/[가-힣]/g) ?? []).length, l = (s.match(/[A-Za-z]/g) ?? []).length; return h + l ? +(h / (h + l)).toFixed(2) : null; };
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await t.fabReady();
  await t.openWindow('.gx-fac');
  const facs = await t.feval(() => [...document.querySelectorAll('.gx-fac')].map((b) => ({ code: b.dataset.value, name: b.querySelector('b')?.innerText })));
  await t.closeWindow();
  res.facs = facs;
  let first = true;
  for (const f of facs) {
    for (const lang of LANGS) {
      // 이 소속의 장면 목록 읽기
      if (!first) { await t.newChat(); await sleep(800); }
      first = false;
      await t.openWindow('.gx-fac');
      await t.F().click(`.gx-fac[data-value="${f.code}"]`); await sleep(400);
      const info = await t.feval(() => ({
        players: [...document.querySelectorAll('[data-action="player"]')].map((b) => b.dataset.value),
        sc: [...document.querySelectorAll('[data-action="fm"]')].map((b) => ({ fm: b.dataset.value, label: b.innerText.replace(/\s+/g, ' ').trim() })),
      }));
      const group = !info.players.includes('');
      if (group && info.players[0]) { await t.F().click(`[data-action="player"][data-value="${info.players[0]}"]`); await sleep(400); }
      const sc = await t.feval(() => [...document.querySelectorAll('[data-action="fm"]')].map((b) => ({ fm: b.dataset.value, label: b.innerText.replace(/\s+/g, ' ').trim() })));
      rows.push({ fac: f.code, name: f.name, lang, group, players: info.players.length, scBeforePlayer: info.sc.length, sc: sc.map((x) => x.label) });
      console.log(f.code, f.name, lang, 'group', group, 'sc', sc.map((x) => x.label).join(' / '));
      await t.closeWindow();
      for (const s of sc) {
        const kind = /직접 입력/.test(s.label) ? 'direct' : /커스텀 임무/.test(s.label) ? 'mission' : 'opening';
        if (kind !== 'opening' && lang !== 'ko') continue; // 직접 입력·커스텀 임무는 언어가 첫 장면 글에만 닿아 한국어만
        await t.newChat(); await sleep(700);
        const row = { fac: f.code, lang, fm: s.fm, label: s.label, kind };
        try {
          await t.openWindow('.gx-fac');
          await t.F().click(`.gx-fac[data-value="${f.code}"]`); await sleep(300);
          if (group && info.players[0]) { await t.F().click(`[data-action="player"][data-value="${info.players[0]}"]`); await sleep(300); }
          await t.F().click(`[data-action="fm"][data-value="${s.fm}"]`); await sleep(300);
          await t.F().click(`[data-action="lang"][data-value="${lang}"]`); await sleep(200);
          if (kind === 'direct') await t.F().fill('[data-input="start-note"]', '평소처럼 출근한 아침, 사무실 자리에 앉는다.');
          const ready = await t.feval(() => !document.querySelector('.gx-foot .gx-start')?.disabled);
          row.ready = ready;
          if (!ready) { row.note = await t.feval(() => document.querySelector('.gx-foot')?.innerText?.replace(/\s+/g, ' ')); rows.push(row); await t.closeWindow(); continue; }
          const s0 = await t.fakeSeq();
          if (kind === 'direct') {
            const r = await turn(t, null, () => t.F().click('.gx-foot .gx-start'), { replyFn: (req) => `평범한 아침이었다.\n\n[▣|${req.fields.map((x) => ({ 날짜: '2025.03.14', 시각: '09:00 AM', 위치: '사무실', 신분: '-', 잔고: req.start.Balance ?? '0', 포인트: req.start.Points ?? '0' })[x] ?? '없음').join('|')}]` });
            const all = (r.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
            Object.assign(row, { markers: [...new Set(all.match(/%%[A-Z_\/]+[%:]/g) ?? [])], userTag: (all.match(/\{\{user\}\}/g) ?? []).length, newLines: r.req.entries.filter((e) => e.isNew).length, start: r.req.start, fields: r.req.fields.join('|'), seedLike: (all.match(/^### [^\n]+/gm) ?? []).length, opening: /OPENING|Opening/.test(all) });
            await t.closeWindow();
          } else {
            await t.F().click('.gx-foot .gx-start');
            await sleep(2500);
            const st = await t.chatState(true);
            const notice = await t.feval(() => document.querySelector('.gx-err')?.innerText ?? null).catch(() => null);
            row.notice = notice;
            if (kind === 'opening') {
              const m0 = String(st.message[0]?.data ?? '');
              Object.assign(row, { n: st.message.length, role: st.message[0]?.role, len: m0.length, hangul: hangul(m0.replace(/\{\{user\}\}|%%[A-Z_]+%%/g, '')), sceneMark: m0.includes('%%GOEI_SCENE%%'), main: (await t.fakeLog(s0, 'main')).length });
            } else {
              row.missionWin = await t.feval(() => !!document.querySelector('[data-action="mission-open"]')).catch(() => false);
              row.n = st.message.length;
            }
            await t.closeWindow();
          }
        } catch (e) { row.error = String(e?.message ?? e).slice(0, 200); try { await t.closeWindow(); } catch {} }
        rows.push(row);
        console.log(' ', JSON.stringify(row).slice(0, 300));
      }
    }
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot('B3-FAIL'); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  writeFileSync(`${OUT}/B3-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
