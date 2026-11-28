// 재확인 KL — T2: R50(출발 직후 첫 전송 전 설정 창 범위) · R52(요청 토큰 상한에 걸린 자동 괴담넷 새로고침 알림 자리)
import { session, sleep, flat } from './lib.mjs';

const GN = 'Board refresh preserves';
const S = await session('reKB');
const { t, step } = S;
const flowDo = async (v) => { await S.ed('manage:flow'); await S.click(`.gw [data-action="fl-do"][data-value="${v}"]`, 900); };
try {
  await S.fakeReset();
  await t.setup();
  await S.loadState('S-start.json');

  // R50
  let st = step('R50 출발 → 첫 전송 전 설정 → 생성 공통 재시도 + 한 칸, 이미지 모델 보조 → 어디에 들어가나', '이미 출발한 채팅이면 이 채팅 값이 바뀌어야(또는 그렇게 표시) 자연스러움 — 기록', 'K-15·K-01');
  const pr0 = await S.prefs();
  await t.startPanel({ fac: 'A00', player: '', scene: '면접' });
  await sleep(2500);
  const ss0 = await S.ss();
  const msgs0 = (await t.chatState()).message.length;
  await S.winOpen();
  if (!(await S.tryClick('[data-action="prefs-open"]', 1200))) await S.tryClick('[data-action="ed-open"]', 1200);
  await S.ed('set:adv');
  const badge = await S.fe(() => [...document.querySelectorAll('.gw .gx-scope')].map((e) => e.textContent.trim()).slice(0, 3));
  const rv = await S.fe(() => [...document.querySelectorAll('.gw [data-action="adv-set"]')].map((e) => e.dataset.value).filter((v) => /gen:retries=/.test(v)));
  const up = rv.map((v) => Number(v.split('=')[1])).sort((a, b) => b - a)[0];
  S.note('재시도 단추', rv);
  await S.click(`.gw [data-action="adv-set"][data-value="gen:retries=${up}"]`, 900);
  await S.ed('set:image');
  const badgeImg = await S.fe(() => [...document.querySelectorAll('.gw .gx-scope, .gw .gw-head small')].map((e) => e.textContent.trim()).slice(0, 4));
  await S.tryClick('.gw [data-action="set-asset-model"][data-value="aux"]', 900);
  await st.shot('R50_출발직후');
  const pr1 = await S.prefs(); const ss1 = await S.ss();
  const tr = await S.turn('면접관에게 인사한다.');
  const hasImgGuide = /## Inserting Character Visual Images/.test(JSON.stringify(tr.main[0]?.body ?? ''));
  const ss2 = await S.ss();
  st.check(ss1.$gen_retries !== ss0.$gen_retries, { msgsAtOpen: msgs0, badge, badgeImg, prefsRetries: [pr0?.vars?.$gen_retries ?? null, pr1?.vars?.$gen_retries ?? null], chatRetries: [ss0.$gen_retries ?? null, ss1.$gen_retries ?? null, ss2.$gen_retries ?? null], prefsAssetModel: pr1?.basic, chatAssetModel: [ss0.$st_asset_model ?? null, ss1.$st_asset_model ?? null], firstSendMainHasImgGuide: hasImgGuide, auxImgCalls: tr.aux.filter((r) => /Insert <img> tags/.test(flat(r))).length });

  // R52
  await S.loadState('S-관리국-3턴.json');
  st = step('R52 요청 토큰 상한 1500 + 괴담넷 매 턴 → 한 턴 → 진행 창·실패 기록·괴담넷 창', '안 보냈으면 진행 창이나 실패 기록에 그 사실이 보임', 'budget.ts BudgetError');
  await flowDo('fam-set|b:gn:lazy=0');
  if (await S.has('.gw [data-action="fl-do"][data-value="fam-set|b:gn:joint=0"]')) await flowDo('fam-set|b:gn:joint=0');
  await S.ed('set:adv');
  await S.setVal('.gw input[data-change="adv-set"][data-key="gen:budget"]', '1500', 'change', 900);
  const tr2 = await S.turn('게시판을 본다.', { settle: 6000 });
  const gnN = tr2.all.filter((r) => flat(r).includes(GN)).length;
  const prog = String((await t.progText().catch(() => '')) ?? '');
  await t.shot('R52_진행창');
  await S.ed('manage:log');
  const logPage = await S.fe(() => document.querySelector('.gw .gw-page')?.innerText.replace(/\s+/g, ' ').slice(0, 300) ?? '');
  await st.shot('실패기록');
  await S.winClose(); await S.winOpen();
  await S.tryClick('.gx-nav .gx-nb:not(.mob)[data-value="net"]', 800);
  await S.tryClick('.br-bm[data-value="gn"]', 1200);
  const gnWin = await S.fe(() => document.querySelector('.gn')?.innerText.replace(/\s+/g, ' ').slice(0, 300) ?? null);
  await st.shot('괴담넷창');
  st.check(gnN === 0 && (/상한/.test(prog) || /상한/.test(logPage)), { gnCalls: gnN, allCalls: tr2.all.map((r) => r.route + ':' + String(r.body?.messages?.[0]?.content ?? '').slice(0, 30)), prog: prog.replace(/\s+/g, ' ').slice(0, 300), logPage, gnWin, consoleHits: t.errors.filter((e) => /상한/.test(e)).slice(-2) });
} catch (e) {
  S.note('예외', String(e?.stack ?? e));
  await t.shot('reKB_예외').catch(() => {});
} finally {
  await S.close();
  process.exit(0);
}
