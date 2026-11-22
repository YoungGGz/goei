// 파트 a: 모든 설정 페이지 조작 한 번씩 → 바로 저장 / 기본값 저장 → 불러오기 / 초기화 가 그 값을 다 다루나
import { fx, boot, launch, goNode, sleep, recorder, ss, prefs, settle, openStarted, barAct, startedChat, packs } from './lib.mjs';

const GROUPS = {
  a1: ['manage:flow', 'set:lore', 'set:adv', 'set:screen', 'set:image', 'set:status', 'set:board', 'set:net', 'set:phone'],
  a2: ['set:wiki', 'set:items', 'set:shop', 'set:cos', 'set:bm', 'set:hs', 'set:journal', 'set:people', 'set:factions'],
};
/** 누르면 저장이 아니라 다른 일을 하는 단추 (화면 이동·모델 호출·지우기·되돌리기·창 닫기) */
const SKIP = /^(set-scope|set-bar|set-feat-back|set-anomaly|ed-|upd-|visit-|gn-def|ph-def|wiki-def|pp-def|jr-def|rec-|pp-update|pp-backfill|pp-reread|pp-diag|pp-tidy|pp-register|pp-ignore|pp-pin|pp-jump|pp-del|wiki-(open|gen|search|go|del|back)|man-|ip-|dir-|mk-|nav-|tab|close|adv-book$|.*-del$|.*-reset$|flow-go|go$)/;
const CHANGE_SKIP = /^(ed-|dir-|ip-|man-|pp-diag-all|pp-backfill-turns|pp-reread-turns)/;

async function controls(page) {
  return page.evaluate(() => {
    const body = document.querySelector('.gw .gw-setbody') || document.querySelector('.gw .gw-page');
    if (!body) return [];
    const out = [];
    const rowOf = (el) => el.closest('.ps-row, .st-col-row, .ck-line, .ck-row, .ms-fx, .ms-tb-r')?.querySelector('.ps-label > b, .st-col-name > b, .ck-name, span:first-child, b')?.textContent?.trim().slice(0, 30) ?? '';
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    [...body.querySelectorAll('button[data-action]')].forEach((b) => {
      if (b.disabled || !vis(b)) return;
      const sw = b.getAttribute('role') === 'switch';
      if (!sw && (b.classList.contains('on') || b.getAttribute('aria-pressed') === 'true')) return;
      out.push({ kind: sw ? 'switch' : 'button', action: b.dataset.action, value: b.dataset.value ?? '', row: rowOf(b), text: b.textContent.trim().slice(0, 12) });
    });
    [...body.querySelectorAll('[data-change]')].forEach((el) => {
      if (el.disabled || !vis(el) || el.tagName === 'BUTTON') return;
      out.push({ kind: el.tagName === 'SELECT' ? 'select' : el.type === 'range' ? 'range' : el.type === 'checkbox' ? 'checkbox' : el.classList.contains('adv-val') ? 'num' : el.tagName === 'TEXTAREA' ? 'area' : 'text', action: el.dataset.change, key: el.dataset.key ?? '', row: rowOf(el), value: el.value, min: el.min, max: el.max, step: el.step, name: el.name ?? '' });
    });
    return out;
  });
}

async function press(page, c) {
  return page.evaluate((c) => {
    const body = document.querySelector('.gw .gw-setbody') || document.querySelector('.gw .gw-page');
    if (c.kind === 'button' || c.kind === 'switch') {
      const b = [...body.querySelectorAll('button[data-action]')].find((x) => x.dataset.action === c.action && (x.dataset.value ?? '') === c.value && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    }
    const el = [...body.querySelectorAll('[data-change]')].find((x) => x.dataset.change === c.action && (x.dataset.key ?? '') === c.key && (x.name ?? '') === c.name);
    if (!el) return false;
    if (c.kind === 'select') el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
    else if (c.kind === 'checkbox') el.checked = !el.checked;
    else if (c.kind === 'range' || c.kind === 'num') {
      const min = Number(el.min || 0); const max = Number(el.max || 100); const step = Number(el.step || 1);
      const cur = Number(String(el.value || el.placeholder && 0 || 0).replace(/[,\s]/g, '')) || 0;
      let next = cur + step; if (next > max) next = cur - step; if (next < min) next = min;
      el.value = String(next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.value = el.value === '점검 글' ? '점검 글 2' : '점검 글';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, c);
}

const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

export default async function (part) {
  const R = recorder(part);
  const browser = await launch();
  const { page, errors } = await boot(browser, fx, startedChat(), 'pc', { store: packs() });
  await openStarted(page, 'set:screen');
  await settle(page);
  const S0 = await ss(page);
  const P0 = await prefs(page);
  const log = [];
  const touched = new Map(); // 채팅 변수 → 바꾼 조작
  for (const node of GROUPS[part]) {
    const s = R.step(`누르기_${node.replace(/[:]/g, '_')}`);
    await goNode(page, node);
    await settle(page);
    const done = new Set();
    let guard = 0; let n = 0; let none = 0; let both = 0;
    const lines = [];
    for (;;) {
      const list = (await controls(page)).filter((c) => !SKIP.test(c.action) && !CHANGE_SKIP.test(c.action));
      const id = (c) => `${c.kind}|${c.action}|${c.kind === 'button' || c.kind === 'switch' ? `${(c.value ?? '').replace(/=-?[\d.,]+$/, '=#').replace(/:[-+]$/, ':±')}|${c.text}` : ''}|${c.key ?? ''}|${c.row}|${c.name ?? ''}`;
      const next = list.find((c) => !done.has(id(c)));
      if (!next || guard++ > 500) break;
      done.add(id(next));
      const b0 = await ss(page); const p0 = await prefs(page); const w0 = await page.evaluate(() => window.__calls.setChat.length);
      const ok = await press(page, next);
      await settle(page);
      if (await page.$('.gw .gw-confirm [data-action="ed-askdel-yes"]')) { await page.evaluate(() => document.querySelector('.gw .gw-confirm [data-action="ed-askdel-no"], .gw .gw-confirm [data-action="ed-askdel-yes"]').click()); await settle(page); }
      // 다른 곳으로 옮겨 갔으면 되돌아온다
      const on = await page.evaluate(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value);
      if (on !== node) { await goNode(page, node); await settle(page); }
      const b1 = await ss(page); const p1 = await prefs(page); const w1 = await page.evaluate(() => window.__calls.setChat.length);
      const dc = diff(b0, b1); const dp = diff(p0, p1);
      n++;
      const label = `${next.row} · ${next.action}=${next.value || next.key}${next.text ? ` (${next.text})` : ''}`;
      for (const k of dc) { if (!touched.has(k)) touched.set(k, `${node} ${label}`); }
      if (!ok) lines.push(`못 누름  ${label}`);
      else if (!dc.length && !dp.length) { none++; lines.push(`변화 없음  ${label}${w1 > w0 ? ' (같은 값 다시 씀)' : ''}`); log.push({ node, label, change: 'none' }); }
      else { if (dc.length && dp.length) both++; lines.push(`${dc.length ? `채팅[${dc.join(',')}]` : ''}${dp.length ? ` 기기[${dp.join(',')}]` : ''}  ${label}`); log.push({ node, label, chat: dc, prefs: dp }); }
    }
    R.file(s, `${node} 조작 ${n}개\n\n${lines.join('\n')}\n`);
    R.check(s, `조작을 누르면 저장값이 바뀐다 (설정 11-08 「바꾸면 바로 저장」) — 변화 없는 조작 ${none}개는 파일에서 확인`, true, '', `${n}개 중 변화 없음 ${none}`);
    R.check(s, '한 조작이 채팅과 기기 설정을 같이 바꾸지 않음', both === 0, 0, both);
  }
  const S1 = await ss(page);
  const P1 = await prefs(page);
  const K = diff(S0, S1);
  {
    const s = R.step('바꾼_채팅변수');
    R.state(s, { changed: Object.fromEntries(K.map((k) => [k, { before: S0[k], after: S1[k], by: touched.get(k) }])), prefsBefore: P0, prefsAfter: P1 });
    R.check(s, '채팅 변수가 바뀜', K.length > 0, '>0', K.length);
  }
  // 기본값으로 저장
  {
    const s = R.step('기본값으로_저장');
    await barAct(page, 'save');
    const P2 = await prefs(page);
    const vars = P2.vars ?? {};
    const basicMap = { $st_asset_on: 'assetOn', $st_asset_model: 'assetModel', $st_asset_player: 'assetPlayer', $st_asset_limit: 'assetLimit', $st_agent_limit: 'agentLimit', $st_support_on: 'supportOn' };
    const missing = K.filter((k) => !(k in vars) && !basicMap[k] && !/^\$wg_/.test(k) && k !== '$st_fixed_theme');
    const wrong = K.filter((k) => k in vars && vars[k] !== String(S1[k]));
    R.state(s, { prefs: P2, missing: missing.map((k) => ({ k, v: S1[k], by: touched.get(k) })) });
    R.file(s, `기본값에 안 담긴 바뀐 채팅 변수 ${missing.length}개 (상태 변수 포함, 손으로 가름)\n${missing.map((k) => `${k} = ${String(S1[k]).slice(0, 120)}   ← ${touched.get(k)}`).join('\n')}\n\n값이 다르게 담긴 것\n${wrong.map((k) => `${k}: 채팅 ${S1[k]} / 기본값 ${vars[k]}`).join('\n')}\n`);
    R.check(s, '바꾼 설정 변수가 모두 기본값에 담김 (목록은 파일, 상태 변수는 손으로 뺌)', missing.length === 0, [], missing);
    R.check(s, '담긴 값이 채팅 값과 같음', wrong.length === 0, [], wrong);
  }
  // 새 채팅처럼 비우고 불러오기
  {
    const s = R.step('비우고_불러오기');
    await page.evaluate((s0) => { window.__chat.scriptstate = s0; }, S0);
    await goNode(page, 'set:screen');
    await barAct(page, 'load');
    const S2 = await ss(page);
    const back = K.filter((k) => JSON.stringify(S2[k]) !== JSON.stringify(S1[k]));
    R.state(s, { notBack: Object.fromEntries(back.map((k) => [k, { saved: S1[k], loaded: S2[k], by: touched.get(k) }])) });
    R.file(s, `불러오기로 돌아오지 않은 것 ${back.length}개\n${back.map((k) => `${k}: 바꾼 값 ${String(S1[k]).slice(0, 80)} / 불러온 뒤 ${String(S2[k]).slice(0, 80)}   ← ${touched.get(k)}`).join('\n')}\n`);
    R.check(s, '바꾼 설정이 불러오기로 모두 돌아옴', back.length === 0, [], back);
  }
  // 초기화
  {
    const s = R.step('초기화');
    await page.evaluate((s1) => { window.__chat.scriptstate = s1; }, S1);
    await goNode(page, 'set:screen');
    await barAct(page, 'reset');
    const S3 = await ss(page);
    const P3 = await prefs(page);
    const left = K.filter((k) => S3[k] !== undefined && JSON.stringify(S3[k]) === JSON.stringify(S1[k]) && JSON.stringify(S1[k]) !== JSON.stringify(S0[k]));
    R.state(s, { left: Object.fromEntries(left.map((k) => [k, { v: S3[k], by: touched.get(k) }])), prefs: P3 });
    R.file(s, `초기화 뒤에도 바꾼 값 그대로인 것 ${left.length}개\n${left.map((k) => `${k} = ${String(S3[k]).slice(0, 80)}   ← ${touched.get(k)}`).join('\n')}\n`);
    R.check(s, '초기화가 바꾼 설정을 모두 되돌림', left.length === 0, [], left);
    R.check(s, '초기화 뒤 기본값(vars) 비움', !P3.vars || !Object.keys(P3.vars).length, {}, P3.vars);
  }
  R.check(R.step('오류'), '페이지 오류 없음', errors.length === 0, [], errors.slice(0, 10));
  R.save();
  await browser.close();
}
