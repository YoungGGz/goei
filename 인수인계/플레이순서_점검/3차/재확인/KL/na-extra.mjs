// 재확인 KL — T1: R58(조직 이름 바꾼 뒤 위 안내 줄) · R59(요원 목록 「소속 미정」 경고 줄, 거점 페이지와 비교)
import { launch, session, STATE, sleep, OUT } from './na-lib-t1.mjs';
import { writeFileSync } from 'node:fs';

const st = STATE('S-관리국-3턴');
const PREFS = JSON.parse(st.t2.pluginStorage['goei:prefs']);
const b = await launch();
const S = await session(b, { chat: structuredClone(st.data), prefs: PREFS });
const out = {};
const hints = () => S.page.evaluate(() => [...document.querySelectorAll('.gw .gw-notice, .gw .gx-err')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 6));
try {
  // R58
  await S.openEd('org');
  await S.act('ed-add-toggle');
  let n0 = await S.setChar();
  await S.take('ed-new-name', '시험조직1', 'ed-add');
  await S.waitSave(n0);
  out.R58_afterAdd = await hints();
  await S.act('ed-sel', '시험조직1');
  out.R58_afterSel = await hints();
  n0 = await S.setChar();
  await S.take('dir-org-name', '시험조직2', 'dir-org-rename');
  await S.waitSave(n0);
  await sleep(800);
  out.R58_afterRename = await hints();
  out.R58_title = await S.page.evaluate(() => document.querySelector('.gw .gw-detail h2')?.textContent ?? '');
  await S.page.screenshot({ path: `${OUT}R58_이름바꾼뒤_PC.png` });
  await S.closeEd();
  // R59
  await S.openEd('agent');
  await S.act('ed-sel', '고그니쟈');
  n0 = await S.setChar();
  await S.act('dir-org-pick', '|고그니쟈');
  await S.waitSave(n0);
  await S.closeEd();
  await S.openEd('agent');
  const agentTxt = await S.text('.gw');
  await S.page.screenshot({ path: `${OUT}R59_요원목록_PC.png` });
  await S.node('base');
  const baseTxt = await S.text('.gw');
  await S.page.screenshot({ path: `${OUT}R59_거점_PC.png` });
  out.R59 = { agentPageAlert: /소속을 정하지 않은 요원/.test(agentTxt), basePageAlert: (baseTxt.match(/소속을 정하지 않은 요원[^\n]*/) ?? [null])[0] };
} catch (e) { out.err = String(e?.stack ?? e); }
console.log(JSON.stringify(out, null, 1));
writeFileSync(`${OUT}결과_extra.json`, JSON.stringify(out, null, 1));
await b.close();
