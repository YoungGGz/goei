// 고친 화면을 크기별로 열어 그림으로 남긴다 (릴리스 전 확인: 상황판·임무·기록). 사용: FAKE_URL=… node screens.mjs [pc|phone]   pc = 1920x1080, phone = 390x844(터치)
// 순서: 한 턴(명일 아파트 격리) → 그 응답을 지운 직후의 상황판·임무·기록 화면.
import { open, STATES, sleep, turn, world } from './lib.mjs';
import { fileURLToPath } from 'node:url';
const mode = process.argv[2] || 'pc';
const phone = mode === 'phone';
const OUT = fileURLToPath(new URL(`./out/screens-${mode}-${Date.now()}`, import.meta.url));
const t = await open({ out: OUT, ...(phone ? { width: 390, height: 844, touch: true } : { width: 1920, height: 1080 }) });
const F = () => t.F();
const act = (a, v) => F().evaluate(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [a, v ?? null]).then(() => sleep(1000));
const overflow = () => F().evaluate(() => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('.gx *')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > w + 1).length; });
const txt = () => F().evaluate(() => (document.querySelector('.gx')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 400));
async function tabs(tag) {
  await t.openWindow('.gx'); await sleep(1000);
  const out = {};
  for (const v of ['board', 'map', 'records']) { await act('nav-tab', v); await t.shot(`${tag}-${v}`); out[v] = { overflow: await overflow(), text: await txt() }; }
  await t.closeWindow();
  return out;
}
try {
  await t.setup(); await t.loadState(STATES + 'S-관리국-3턴.json'); await t.reload(); await sleep(800);
  const PROSE = '쟈알디가 무전기를 내려놓았다.\n\n<img=Jyaldi_serious>\n\n"끝났다."';
  await turn(t, { prose: PROSE, status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' }, mutate: (w) => w.map((x) => x.startsWith('[AN|') && x.includes('명일 아파트') ? x.replace('|활성|', '|격리|') : x) }, null, '현장 정리를 지켜본다.');
  const a = await tabs('1-응답뒤');
  const st = await t.chatState(true);
  await t.deleteMessage(st.message.length - 1); await sleep(1500);
  const b = await tabs('2-지운직후');
  const an = ((await world(t))?.an ?? []).map((x) => `${x.name}:${x.state}`);
  console.log(JSON.stringify({ mode, OUT, afterReply: a, afterDelete: b, anAfterDelete: an }, null, 1));
} catch (e) { console.log('ERR', String(e?.stack ?? e).slice(0, 800)); }
finally { await t.close?.(); process.exit(0); }
