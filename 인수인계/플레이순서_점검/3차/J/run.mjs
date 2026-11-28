// 3차 J 구간 (기록·일지·보고서). 사용: FAKE_URL=http://<IP>:<port> node run.mjs [--only d1,d2,...] [--w 1280 --h 800]
// 단계마다 기대값·결정표 줄을 먼저 적고(step 의 want/ref), 실제값을 붙여 자동 대조한다. src 는 안 건드림.
import { open, STATES, sleep, turn, waitMain, readRequest, buildReply, quietAux, world, saveJson, saveText, reqText, text } from '../D/lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const OUT = fileURLToPath(new URL(`./out/run-${W}x${H}-${Date.now()}`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const res = { at: new Date().toISOString(), size: `${W}x${H}`, steps: [] };
const step = (id, name, ok, want, ref, got) => { res.steps.push({ id, name, ok, want, ref, got }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', id, name, JSON.stringify(got).slice(0, 300)); saveJson(OUT + '/result.json', res); };
const on = (k) => !ONLY.length || ONLY.includes(k);
const t = await open({ out: OUT, width: W, height: H, touch: W < 600 });
const shot = async (n) => { await t.shot(n); return `${OUT}/${n}.png`; };
const F = () => t.F();
const fc = async (sel, i = 0) => { try { await F().locator(sel).locator("visible=true").nth(i).click({ timeout: 3000 }); } catch (e) { const ok = await F().evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, { sel, i }); if (!ok) throw e; res.domClicks = (res.domClicks ?? []).concat(sel); } await sleep(700); };
const ftext = (sel = '.gx') => F().evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ') ?? null, sel);
const acts = (re) => F().evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('[data-action]')].filter((e) => e.offsetParent !== null && r.test(e.dataset.action)).map((e) => ({ a: e.dataset.action, v: e.dataset.value ?? null, t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), dis: !!e.disabled })); }, re.source);
const userMsgs = (body) => (body.messages ?? []).filter((m) => m.role === 'user').map((m) => text(m.content));
const has = (s, sec) => s.includes(sec.slice(0, 60));
const PROSE = '쟈알디가 서류를 덮었다.\n\n<img=Jyaldi_serious>\n\n"출발한다."';
const ST = { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' };
let DIR = {};
{ const raw = (await import('node:fs')).readFileSync(new URL('../../../../지침/이동_임무_지시문.txt', import.meta.url), 'utf8'); for (const m of raw.matchAll(/===([A-Z]+)===\n([\s\S]*?)(?====|$)/g)) DIR[m[1]] = m[2].trim(); }

async function boot(state = 'S-관리국-3턴') {
  await t.setup();
  await t.loadState(STATES + state + '.json');
  await t.reload();
  await t.openWindow('.gx');
  await sleep(1200);
}
async function openTab(v) { if (!F() || !(await F().$('.gx'))) await t.openWindow('.gx'); const cur = await F().evaluate(() => document.querySelector('[data-action="nav-tab"].on, [data-action="nav-tab"][aria-current="page"], [data-action="nav-tab"].active')?.dataset.value ?? null); if (cur !== v) await fc(`[data-action="nav-tab"][data-value="${v}"]`); if (!(await F().evaluate((v) => !!document.querySelector(`[data-action="nav-tab"][data-value="${v}"].on, [data-action="nav-tab"][data-value="${v}"][aria-current="page"]`), v))) { await fc('[data-action="nav-tab"][data-value="board"]').catch(() => {}); if (v !== 'board') await fc(`[data-action="nav-tab"][data-value="${v}"]`); } }
async function reopen() { await t.closeWindow(); await t.openWindow('.gx'); await sleep(1000); }


const rows = async () => { const st = await t.chatState(true); let j = null, r = null; try { j = JSON.parse(st.scriptstate?.$goei_journal ?? 'null'); } catch {} try { r = JSON.parse(st.scriptstate?.$goei_reports ?? 'null'); } catch {}
  // 플러그인이 보여 주는 것과 같게 (2026-11-28 liveJournal·liveReports): 사라진 응답($goei_turns 에 결과가 있지만 채팅에 없는 응답)이 만든 자동 종료 줄은 가린다. 저장값에는 남아 있다 (◀ 로 돌아오면 다시 보임)
  try { const tn = JSON.parse(st.scriptstate?.$goei_turns || 'null'); const alive = new Set(st.message.map((m, i) => m.chatId || `#${i + 1}`)); const dead = new Set((tn?.list ?? []).map((x) => x.k).filter((k) => !k.startsWith('#') && !alive.has(k))); const hide = (x) => (x.cause === 'model' || x.cause === 'ttl') && dead.has(x.anchor); if (dead.size) { if (j?.rows) j = { ...j, rows: j.rows.filter((x) => !hide(x)) }; if (r?.items) r = { ...r, items: r.items.filter((x) => !hide(x)) }; } } catch {}
  return { j, r }; };
const repList = (r) => (r?.items ?? r?.list ?? (Array.isArray(r) ? r : Object.values(r ?? {}).find(Array.isArray) ?? [])).map((x) => ({ id: x.id, name: x.name ?? x.title ?? x.target, pin: !!x.pin, made: x.made ?? null }));
try {
  await boot();
  // 이 응답이 명일 아파트를 격리로 끝냄 → 보고서
  const closeTurn = { prose: '쟈알디가 무전기를 내려놓았다.\n\n<img=Jyaldi_serious>\n\n"명일 아파트 격리 끝."', status: ST, mutate: (w) => w.map((x) => x.startsWith('[AN|') && x.includes('명일 아파트') ? x.replace('|활성|', '|격리|').replace(/\|[^|]*\]$/, '|현관이 봉인되고 입주민 대피가 끝났다 (종료 03.14 10:15)]') : x) };
  if (on('j1')) {
    // 손 종료 하나(소라 랜드) + 모델 종료 하나(명일 아파트)
    await openTab('board');
    const key = (await acts(/^ops-sel$/)).find((x) => /소라 랜드/.test(x.t))?.v;
    await fc(`[data-action="ops-sel"][data-value="${key}"]`); await fc(`[data-action="end-event"][data-value="${key}"]`); await fc(`[data-action="end-event"][data-value="${key}"]`);
    await sleep(1000);
    const tr = await turn(t, closeTurn, null, '현장 정리를 지켜본다.');
    const { j, r } = await rows();
    saveJson(OUT + '/j1-rows.json', { j, r });
    await reopen(); await openTab('records');
    const views = {};
    for (const sub of ['journal', 'chronicle', 'people', 'factions']) {
      await fc(`[data-action="rec-sub"][data-value="${sub}"]`);
      views[sub] = (await ftext('.gx-body, main'))?.slice(0, 500);
      await shot('j1-' + sub);
    }
    await fc('[data-action="rec-sub"][data-value="journal"]');
    const filt = {};
    for (const f of ['all', 'mine', 'bg']) { await fc(`[data-action="rec-filter"][data-value="${f}"]`).catch(() => {}); filt[f] = (await acts(/^rec-open$/)).map((x) => x.t); }
    await fc('[data-action="rec-filter"][data-value="all"]').catch(() => {});
    step('J1-1', '기록: 일지·연대기·인물·세력 보기, 걸러 보기', /소라 랜드/.test(views.journal ?? '') && /명일 아파트/.test(views.journal ?? ''), '일지에 손 종료(소라 랜드)·모델 종료(명일 아파트) 둘 다, 걸러 보기 전체/내 것/배경', '코스 J1, J-01', { views, filt, journalRows: (j?.rows ?? []).map((x) => JSON.stringify(x).slice(0, 160)) });
    const opens = await acts(/^rec-open$/);
    const target = opens.find((x) => /명일 아파트/.test(x.t)) ?? opens[0];
    await fc(`[data-action="rec-open"][data-value="${target.v}"]`);
    const rpt = (await ftext('.gx-rptcard'))?.slice(0, 1200);
    await shot('j1-report');
    await fc(`[data-action="rec-pin"][data-value="${target.v}"]`).catch(() => {});
    await sleep(800);
    const afterPin = repList((await rows()).r);
    await fc(`[data-action="rec-png"][data-value="${target.v}"]`).catch(() => {});
    await sleep(3000);
    const png = await F().evaluate(() => { const i = document.querySelector('.gx-pngcard img'); return i ? { src: i.src.slice(0, 40), w: i.naturalWidth, h: i.naturalHeight } : null; });
    await shot('j1-png');
    // PNG 그림 자체를 저장해 바닥글 확인
    const dataUrl = await F().evaluate(async () => { const i = document.querySelector('.gx-pngcard img'); if (!i) return null; const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); return c.toDataURL('image/png'); });
    if (dataUrl) writeFileSync(OUT + '/j1-report.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
    step('J1-2', '보고서 열기·고정·PNG', !!rpt && afterPin.some((x) => x.pin) && !!png, '보고서 창, 고정하면 pin, 「이미지로 저장」 → 900×1200 PNG 미리보기', '코스 J1, J-02, 답-01', { target: target.t, rpt, afterPin, png, pngFile: dataUrl ? OUT + '/j1-report.png' : null });
    step('J1-3', '보고서 「투입」 시각 (손-05)', null, '사실 기록: 보고서 글의 투입·소요 칸', '손-05', { rpt });
    // J2: 다시 굴리면 고정한 보고서·일지 되감기, 손 종료는 남음
    await t.closeWindow();
    const rr = await turn(t, { prose: PROSE + ' (다시)', status: ST }, () => t.reroll({ wait: false }));
    const { j: j2, r: r2 } = await rows();
    const names = (rr2) => JSON.stringify(rr2 ?? '');
    step('J2-1', '다시 굴리면 그 응답이 만든 보고서(고정한 것도)·일지가 되감김, 손으로 끝낸 것은 남음', !names(j2).includes('명일 아파트') && names(j2).includes('소라 랜드') && !names(r2).includes('명일 아파트'), '명일 아파트 일지·보고서(고정)는 빠지고 소라 랜드(손 종료)는 남음 (J-03 Claude 판정, D-04)', 'J-03, D-04', { journal: (j2?.rows ?? []).map((x) => JSON.stringify(x).slice(0, 120)), reports: repList(r2) });
  }
  if (on('j2')) { // 보고서 카드 표시 끔/내 것/전부
    await t.closeWindow();
    const tr = await turn(t, closeTurn, null, '현장 정리를 지켜본다.');
    const cards = async () => t.page.evaluate(() => { const ms = [...document.querySelectorAll('.risu-chat[data-chat-index]')]; return ms.slice(-2).map((m) => ({ idx: m.dataset.chatIndex, rpt: m.querySelectorAll('[class*="goei"], .x-goei-card, [data-goei-report]').length, txt: m.innerText.replace(/\s+/g, ' ').slice(-200) })); });
    const res2 = {};
    for (const v of ['mine', 'off', 'all']) {
      await t.openWindow('.gx'); await sleep(600);
      await fc('[data-action="ed-open"][data-value="set:screen"]'); await fc('[data-action="ed-tab"][data-value="set"]').catch(() => {}); await fc('[data-action="ed-node"][data-value="set:journal"]');
      await fc(`[data-action="jr-set"][data-value="chat_card=${v}"]`);
      await sleep(800);
      await t.closeWindow(); await sleep(1500);
      res2[v] = await cards();
      await shot('j2-card-' + v);
    }
    const hasCard = (x) => x.some((m) => /보고서|REPORT|격리/.test(m.txt));
    step('J2-2', '보고서 카드 표시: 내 것/끔/전부', null, '끔이면 채팅 속 보고서 카드가 사라지고 내 것·전부면 보임 (눈으로 확인: 캡처 j2-card-*)', '코스 J2', res2);
  }
  if (on('j3')) { // 실제 채팅 바꾸기: 다른 채팅 기록이 안 섞임
    await openTab('records');
    const a = (await ftext('.gx-body, main'))?.slice(0, 300);
    await t.closeWindow();
    await t.loadState(STATES + 'S-백일몽-3턴.json'); await t.reload();
    await t.openWindow('.gx'); await sleep(1000);
    await openTab('records');
    const b = (await ftext('.gx-body, main'))?.slice(0, 300);
    await t.closeWindow(); await t.switchChat(1); await sleep(1000);
    await t.openWindow('.gx'); await sleep(1000); await openTab('records');
    const c = (await ftext('.gx-body, main'))?.slice(0, 300);
    step('J3-1', '채팅을 바꾸면 기록도 그 채팅 것', a === c && a !== b, '관리국 채팅 기록 ≠ 백일몽 채팅 기록, 돌아오면 처음과 같음', '코스 J2', { a, b, c });
  }
} catch (e) {
  step('ERR', '예외', false, null, null, String(e?.stack ?? e).slice(0, 1500));
  await shot('ERR').catch(() => {});
} finally {
  res.errors = t.errors.filter((e) => !/displayData|\[goei\] (시작|본체|세계)/.test(e)).slice(0, 40);
  saveJson(OUT + '/result.json', res);
  console.log('OUT', OUT);
  await t.close();
}
