// 재확인 남은 칸 · R09 준비: 같은 상태를 세 번 넣어 쓸 시작 상태 둘을 만든다 (틀/states 는 안 건드림, 결과는 OUT 에)
//  S-상점방문.json : S-상점표식 + 본편 한 턴(갱신기가 기독교 상점 방문 판정) → $st_shop 있음 (re-e.mjs R07 앞부분과 같은 길)
//  S-홈쇼핑망.json : S-관리국-3턴 + $hs_net='1' (설정 「망에서 늘 닿음」 값을 변수로. 설정 화면 자체는 K 구간 몫)
// 사용: source /tmp/t2-rest/t2-env.sh && OUT=<dir> node prep-states.mjs
import { openRun, sleep, STATES, userText } from '../EG/lib.mjs';
const OUT = process.env.OUT;
const r = await openRun({ out: OUT + '/.prep', fake: process.env.FAKE_URL });
const { t } = r;
await t.setup();
await t.loadState(STATES + 'S-상점표식.json');
r.on('updater', (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name: '기독교 상점', owner: '블라렛', m } }) : '{}'; });
r.once('main', `블라렛이 진열대를 가리켰다.\n[shop: 기독교 상점|블라렛]\n\n${r.status()}`);
let s = r.lastSeq();
await t.send('진열대를 본다.');
await r.until(async () => r.since(s, 'updater').length, 30000);
await sleep(3000);
const st = r.J(await r.vars(), '$st_shop');
console.log('st_shop', st?.shop, 'loaded', st?.loaded);
console.log(await t.exportState(OUT + '/S-상점방문.json', { name: 'S-상점방문' }));
await t.loadState(STATES + 'S-관리국-3턴.json');
await r.setVars({ $hs_net: '1' });
await sleep(1500);
console.log(await t.exportState(OUT + '/S-홈쇼핑망.json', { name: 'S-홈쇼핑망' }));
await r.stop(); await t.close();
process.exit(0);
