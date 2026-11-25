// 재확인 남은 칸 · R13 우주몰 시그니처를 설정 화면으로 켜고 끈 뒤 진열 요청 「Previously shown here」에 이름이 들어가나
// 사용: source /tmp/t2-rest/t2-env.sh && OUT=<dir> node re-sig2.mjs
// 앞 재확인(re-sig.mjs)은 $cos_fixed 를 변수로 넣고 껐다. 이번엔 설정 창 → 설정 탭 → 「우주몰」(set:cos) → 시그니처 상품 칸에서
//   「상품 추가」 → 이름·확률 100 입력 → ON, 새로고침 1~3, 같은 칸의 OFF 단추로 끔, 새로고침 4~5.
// 기대값(재확인자): 설정 도움말 「모델에게는 이름을 알리지 않고」대로 어느 진열 요청에도 시그니처 이름이 없다. 끈 뒤엔 새로 끼우지 않는다.
import { openRun, sleep, STATES, msgsText } from '../EG/lib.mjs';

const OUT = process.env.OUT;
const r = await openRun({ out: OUT, fake: process.env.FAKE_URL });
const { t, check, note } = r;
const SIG = '설정화면 시그니처 종';
const shelf = (n) => `<shop-identity>\nsells: 이상한 물건\nnever: 환불\nprices: 원화\ncurrency: -\n</shop-identity>\n<owner>\n${n}번째.\n</owner>\n<shelf>\n물건${n}가|1000|-|도구/가/a|0.1|가.|||?\n물건${n}나|2000|-|도구/나/b|0.1|나.|||?\n</shelf>`;
const fixedNow = async () => { const v = await r.vars(); try { return JSON.parse(v.$cos_fixed || 'null'); } catch { return v.$cos_fixed ?? null; } };

await t.setup();
await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
note('준비', '$cos_fixed 처음(없으면 기본값)', await fixedNow());

// ── 설정 화면으로 시그니처 하나 추가·켬 ──
const openCosSettings = async () => {
  await t.openWindow('.gx');
  const F = await t.frame('.gx');
  const gwVis = await F.evaluate(() => !!document.querySelector('.gw')?.getClientRects().length);
  if (!gwVis) { await F.locator('[data-action="ed-open"]:visible').first().click({ timeout: 8000 }); await sleep(900); }
  if (!(await F.evaluate(() => !!document.querySelector('.gw [data-action="ed-node"][data-value="set:cos"]')))) { await F.locator('.gw [data-action="ed-tab"][data-value="set"]').first().click({ timeout: 8000 }); await sleep(600); }
  await F.locator('.gw [data-action="ed-node"][data-value="set:cos"]').first().click({ timeout: 8000 }); await sleep(900);
  return F;
};
let F = await openCosSettings();
const fxRows = () => F.evaluate(() => [...document.querySelectorAll('.ms-fx')].map((e) => ({ name: e.querySelector('[data-key$=":name"]')?.value, id: (e.querySelector('[data-key$=":name"]')?.dataset.key ?? '').split(':')[0], on: !e.classList.contains('off'), pct: e.querySelector('[data-key$=":pct"]')?.value })));
note('설정', '시그니처 칸 처음', await fxRows());
await F.locator('.gw [data-action="ms-fx-add"]').first().click({ timeout: 8000 }); await sleep(900);
let rows = await fxRows();
const id = rows.at(-1).id;
note('설정', '상품 추가 뒤', rows);
const setInput = async (key, val) => { const loc = F.locator(`.gw [data-change="ms-fx"][data-key="${id}:${key}"]`).first(); await loc.fill(String(val)); await loc.dispatchEvent('change'); await sleep(700); };
await setInput('name', SIG);
await setInput('pct', 100);
await setInput('price', 7777);
await setInput('truth', '숨은 진실 설정화면');
rows = await fxRows();
if (!rows.find((x) => x.id === id)?.on) { await F.locator(`.gw [data-action="ms-cfg"][data-value="cos:fx_on:${id}=1"]`).first().click({ timeout: 5000 }).catch(() => {}); await sleep(700); }
rows = await fxRows();
note('설정', '이름·확률·켬 뒤 칸', rows);
note('설정', '$cos_fixed (켬 뒤)', await fixedNow());
await t.shot('R13-설정-켬');
await F.locator('.gw [data-action="ed-close"]').first().click({ timeout: 5000 }).catch(() => {}); await sleep(500);
await t.closeWindow();

// ── 우주몰 진열 ──
const openCos = async () => {
  await t.openWindow(); await sleep(1200);
  for (let k = 0; k < 4 && !(await t.feval(() => !!document.querySelector('.ms-cos'))); k++) {
    if (!(await t.feval(() => !!document.querySelector('.br')))) { await r.fclickAction('nav-tab', 'net'); await sleep(1200); }
    if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); await sleep(1200); }
  }
};
const rowsOut = [];
const refreshOnce = async (n, on) => {
  r.once('cos', shelf(n));
  const s = r.lastSeq();
  const ok = n === 1 ? await r.fclickAction('mall-refresh') : ((await r.fclickAction('br-reload')) || (await r.fclickAction('mall-refresh')));
  await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(1800);
  const req = r.since(s, 'cos')[0];
  r.save(`R13b-진열${n}`, r.since(s, 'cos'));
  const txt = req ? msgsText(req.body) : '';
  const prevLine = (/Previously shown here[^\n]*/.exec(txt) || [''])[0];
  const items = (r.J(await r.vars(), '$cos_shop')?.items ?? []).filter((x) => !x.sold).map((x) => x.name);
  rowsOut.push({ n, clicked: ok, reqs: r.since(s, 'cos').length, sigOn: on, prevLine, sigInReq: txt.includes(SIG), truthInReq: txt.includes('숨은 진실 설정화면'), shelfAfter: items, sigOnShelf: items.includes(SIG) });
  note('R13', `새로고침 ${n} (시그니처 ${on ? '켬' : '끔'})`, rowsOut.at(-1));
};
await openCos();
for (let n = 1; n <= 3; n++) await refreshOnce(n, true);
await t.shot('R13-켬-진열3');
await t.closeWindow();

// ── 설정 화면으로 끔 ──
F = await openCosSettings();
await F.locator(`.gw [data-action="ms-cfg"][data-value="cos:fx_on:${id}=0"]`).first().click({ timeout: 8000 }); await sleep(900);
rows = await fxRows();
note('설정', '끈 뒤 칸', rows);
const fxOff = await fixedNow();
note('설정', '$cos_fixed (끈 뒤)', fxOff);
check('설정', '설정 화면 OFF 로 그 상품 on=false 저장', Array.isArray(fxOff) && fxOff.find((f) => f.name === SIG)?.on === false, 'on:false', fxOff);
await t.shot('R13-설정-끔');
await F.locator('.gw [data-action="ed-close"]').first().click({ timeout: 5000 }).catch(() => {}); await sleep(500);
await t.closeWindow();
await openCos();
note('R13', '끈 뒤 창 상태', await t.feval(() => ({ gw: !!document.querySelector('.gw')?.getClientRects().length, cos: !!document.querySelector('.ms-cos'), reload: [...document.querySelectorAll('[data-action="br-reload"],[data-action="mall-refresh"]')].filter((e) => e.getClientRects().length).map((e) => e.dataset.action) })));
await t.shot('R13-끔-연창');
note('R13', '끈 뒤 우주몰 열었을 때 진열', (r.J(await r.vars(), '$cos_shop')?.items ?? []).filter((x) => !x.sold).map((x) => x.name));
for (let n = 4; n <= 5; n++) await refreshOnce(n, false);
await t.shot('R13-끔-진열5');
for (const x of rowsOut) check('R13', `기대: 진열 요청 ${x.n}(${x.sigOn ? '켬' : '끔'}) 에 시그니처 이름 없음`, !x.sigInReq, '없음', { prevLine: x.prevLine, truthInReq: x.truthInReq });
for (const x of rowsOut.filter((x) => !x.sigOn)) check('R13', `기대: 끈 뒤 새로고침 ${x.n} 진열에 시그니처 없음`, !x.sigOnShelf, '없음', x.shelfAfter);
await r.stop();
r.writeResults();
process.exit(0);
