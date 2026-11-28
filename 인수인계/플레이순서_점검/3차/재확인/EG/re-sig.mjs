// 재확인 EG · R13 우주몰 시그니처 상품 이름이 진열 요청 「Previously shown here」에 들어가나
// 사용: source /tmp/t2-EG/t2-env.sh && FAKE_URL=… OUT=<dir> node re-sig.mjs
// 기대값(재확인자): 설정 도움말 「모델에게는 이름을 알리지 않고」대로 어느 진열 요청 글에도 시그니처 이름이 없다
// 시그니처 표는 설정 화면 대신 채팅 변수 $cos_fixed 로 바로 넣음(원래 점검은 설정 화면으로 고침)
import { openRun, sleep, STATES, msgsText } from './lib.mjs';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user/16087847-a906-5c84-b8d3-cf81709eb728/scratchpad/re-EG/sig';
const r = await openRun({ out: OUT, fake: process.env.FAKE_URL });
const { t, check, note } = r;
const SIG = '재확인 시그니처 종';
const shelf = (n) => `<shop-identity>\nsells: 이상한 물건\nnever: 환불\nprices: 원화\ncurrency: -\n</shop-identity>\n<owner>\n${n}번째.\n</owner>\n<shelf>\n물건${n}가|1000|-|도구/가/a|0.1|가.|||?\n물건${n}나|2000|-|도구/나/b|0.1|나.|||?\n</shelf>`;

await t.setup();
await t.loadState(STATES + 'S-관리국-3턴.json'); await sleep(1500);
await r.setVars({ $cos_fixed: JSON.stringify([{ id: 'f_re', on: true, pct: 100, name: SIG, price: 7777, desc: '흔든다.', effect: '소리', truth: '숨은 진실 재확인' }]) });
await t.openWindow(); await sleep(1200);
await r.fclickAction('nav-tab', 'net'); await sleep(800);
if (!(await t.feval(() => !!document.querySelector('.ms-cos')))) { if (!(await r.fclickAction('br-go', 'cos'))) await r.fclickAction('br-site', 'cos'); }
await sleep(1200);
const rows = [];
for (let n = 1; n <= 4; n++) {
  if (n === 4) await r.setVars({ $cos_fixed: JSON.stringify([{ id: 'f_re', on: false, pct: 100, name: SIG, price: 7777, desc: '흔든다.', effect: '소리', truth: '숨은 진실 재확인' }]) });
  r.once('cos', shelf(n));
  const s = r.lastSeq();
  const ok = n === 1 ? await r.fclickAction('mall-refresh') : await r.fclickAction('br-reload');
  await r.until(async () => r.since(s, 'cos').length, 15000); await sleep(1800);
  const req = r.since(s, 'cos')[0];
  r.save(`R13-진열${n}`, r.since(s, 'cos'));
  const txt = req ? msgsText(req.body) : '';
  const prevLine = (/Previously shown here[^\n]*/.exec(txt) || [''])[0];
  const items = (r.J(await r.vars(), '$cos_shop')?.items ?? []).filter((x) => !x.sold).map((x) => x.name);
  rows.push({ n, clicked: ok, prevLine, sigInReq: txt.includes(SIG), truthInReq: txt.includes('숨은 진실 재확인'), shelfAfter: items, sigOn: n < 4 });
  note('R13', `새로고침 ${n} (시그니처 ${n < 4 ? '켬' : '끔'})`, rows.at(-1));
}
for (const x of rows) check('R13', `기대: 진열 요청 ${x.n} 에 시그니처 이름 없음`, !x.sigInReq, '없음', { prevLine: x.prevLine, truthInReq: x.truthInReq }, 'src/ui/malls.ts 시그니처 도움말');
await r.stop();
r.writeResults();
process.exit(0);
