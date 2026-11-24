// K10 대기 시간 (T1 가짜 리스 + 가짜 시계): 「메인 응답 대기」·「응답 다시 확인」 설정값이 실제 기다림에 쓰이는지.
// 판정 화면: 보내지 못한 직접 입력 하나만 있는 채팅 — 기다리는 중이면 진행 중, 풀리면 시작 화면(.gx-fac) (T1_사용법 2).
// 사용: node t1-k10.mjs /tmp/t1fx/fixture.json
import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, boot, open, request, setRisuBusy } from '../../../../../tests/qc-host.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fxPath = process.argv[2] || '/tmp/t1fx/fixture.json';
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const core = await import('../../../../../dist-test/core.mjs');
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rec = (name, o) => { const l = { t: new Date().toISOString(), name, ...o }; appendFileSync(HERE + '/out/steps.jsonl', JSON.stringify(l) + '\n'); console.log(o.ok ? 'OK ' : 'NG ', name, JSON.stringify(o.actual)); };
const unsentChat = () => ({ message: [{ role: 'user', data: core.setUnsent('직접 입력 첫 상황', true), chatId: 'u0' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } });
const send = (page) => request(page, [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: '직접 입력 첫 상황' }]);
const startShown = (page) => page.evaluate(() => document.querySelector('.gx')?.style.display !== 'none' && [...document.querySelectorAll('.gx-fac')].some((e) => e.offsetParent !== null));
// 창을 닫았다 다시 열어 그때 상태를 본다 (열 때 refresh 가 freeUseLock 으로 화면을 보는 길은 idle 일 때만 풀므로, busy/none 에서는 기다림 상태 그대로)
const look = async (page) => { await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click()); await sleep(400); await page.click('[x-goei-fab] button'); await sleep(900); return startShown(page); };

async function run(name, prefs, plan, expect, src) {
  const { page, errors } = await boot(browser, fixture, unsentChat(), { fixtureDir, clock: true, prefs });
  await setRisuBusy(page, 'busy');
  await send(page);
  await open(page); await sleep(800);
  const seen = [['보낸 직후', await startShown(page)]];
  for (const [what, ms, busy] of plan) {
    if (busy) await setRisuBusy(page, busy);
    if (ms) { await page.clock.fastForward(ms); await sleep(900); }
    seen.push([what, await look(page)]);
  }
  const got = seen.map((x) => x[1]);
  rec('k10-t1 ' + name, { expect, src, actual: { seen, errors: errors.slice(0, 5) }, ok: JSON.stringify(got) === JSON.stringify(expect.arr) });
  await page.close();
}

// A. 메인 응답 대기 2분, 응답 다시 확인 10초 (prefs.times 는 칸 단위: 분·초)
// 가짜 시계도 실제 시간이 같이 흘러(창 닫고 열기마다 2~3초) 여유를 크게 둔다
await run('대기 2분·다시 확인 60초', { times: { mainWait: 2, mainAgain: 60 } }, [
  ['61초 뒤(busy)', 61_000],
  ['121초 뒤(busy, 만료→다시 확인 걸림)', 60_000],
  ['단추 뺌 + 35초', 35_000, 'none'],
  ['+30초(다시 확인 60초 지남)', 30_000],
], { arr: [false, false, false, false, true], text: '2분 전 풀리지 않음, 2분에 아직 만드는 중이면 60초 뒤 다시 봄, 그 전엔 안 풀리고 다시 볼 때 풀림' }, 'setdef time-mainWait·time-mainAgain, host/waiting.ts:15-38');

// B. 끝값: 대기 1분(최소)·다시 확인 5초(최소)
await run('끝값 대기 1분·다시 확인 5초', { times: { mainWait: 1, mainAgain: 5 } }, [
  ['59초(busy)', 59_000],
  ['61초(busy)', 2_000],
  ['단추 뺌 + 6초', 6_000, 'none'],
], { arr: [false, false, false, true] }, 'timing.ts TIME_SPEC lo');

// C. 범위 밖 값이 저장소에 있으면 버리고 기본(3분·30초)
await run('저장소의 범위 밖 값(대기 0·다시 확인 999) → 기본값', { times: { mainWait: 0, mainAgain: 999 } }, [
  ['61초(busy)', 61_000],
  ['단추 뺌 + 100초(180초 전)', 100_000, 'none'],
  ['+20초(180초 지남, 만드는 중 아님)', 20_000],
], { arr: [false, false, false, true] }, 'timing.ts setTimes (틀린 칸 버림)');

await browser.close();
