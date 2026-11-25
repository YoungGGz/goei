// I 구간 T1(가짜 리스): 저장 실패(채팅 던짐/조용히 안 씀, 기기 저장소 진단 열쇠) · 조립 단계 실패(__goeiFaultSteps '인물 기록')
// 사용: node t1.mjs /tmp/claude-0/hi/t1/fixture.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, boot, startChat, request, output, setVars, setSaveFail, clearSaveFail, saveFails, testBodyCode } from '../../../../tests/qc-host.mjs';
import { OUT, kst, scrub } from './common.mjs';

const fxPath = process.argv[2] || '/tmp/claude-0/hi/t1/fixture.json';
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const browser = await launch();
const res = { name: 't1', at: kst(), steps: [] };
const step = (id, expect, ref, actual, ok) => { res.steps.push({ id, expect, ref, actual, ok, t: kst() }); console.log(`${ok === true ? 'OK ' : ok === false ? 'NG ' : '-- '} ${id} | ${JSON.stringify(actual)}`.slice(0, 900)); writeFileSync(OUT + '/t1-result.json', scrub(JSON.stringify(res, null, 1))); };
const sys = (c) => ({ role: 'system', content: c });
const usr = (c) => ({ role: 'user', content: c });
const bot = (c) => ({ role: 'assistant', content: c });
const ok = (json) => ({ type: 'success', result: JSON.stringify(json) });
const E = { entries: [], cues: [], address: [], new_people: [], renames: [], docs: [], present: [], issues: [] };
const st = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';

const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir, body: testBodyCode });
try {
  const saved = await startChat(page, 'A00', 2);
  await setVars(page, { $pp_on: '1', $pp_when: 'turn', $pp_model: 'aux', $pp_router: 'code', $pp_director: 'off', $st_asset_on: '0' });
  const push = (role, data, chatId) => page.evaluate(([r, d, id]) => { window.__chat.message.push({ role: r, data: d, chatId: id }); }, [role, data, chatId]);
  const store = () => page.evaluate(() => window.__clone(window.__chat.goeiPeopleV1 ?? null));
  const llmQueue = (q) => page.evaluate((q) => { window.__llm = q; window.__calls.llm = []; }, q);
  const llmCalls = () => page.evaluate(() => (window.__calls.llm || []).map((o) => ({ system: String(o.messages?.[0]?.content ?? '').slice(0, 60), data: String(o.messages?.[1]?.content ?? '') })));
  const tagFor = (data, sub) => JSON.parse(data).span.filter((x) => String(x.text).includes(sub)).map((x) => x.m).at(-1);
  const diagList = () => page.evaluate(async () => { const raw = await risuai.pluginStorage.getItem('goei-people-diag'); const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return (v ?? []).map((d) => ({ reason: d.reason, ok: d.ok, stage: d.stage, error: d.error })); });

  // 첫 턴: 스팡달(명부) 등장 → 갱신기 정상
  await push('user', '로비로 간다.', 'u1');
  await push('char', '로비에 스팡달이 서 있었다. "왔냐, 신입."\n' + st, 'c1');
  await llmQueue([ok(E)]);
  await output(page);
  let s = await store();
  step('0 첫 턴', '스팡달 기록, 읽음 표시', 'I-02', { people: Object.keys(s?.people ?? {}), read: Object.keys(s?.read ?? {}).length }, !!s?.people?.['스팡달']);

  // 1. 채팅 저장 던짐: 갱신기 결과 저장 실패
  await push('user', '스팡달에게 인사한다.', 'u2');
  await push('char', '스팡달 옆에 있던 여자가 손을 들었다. "나는 나은솔. 격리팀이야."\n' + st, 'c2');
  await page.evaluate(() => { window.__llmFn = null; });
  // 갱신기 답은 요청을 본 뒤: 대기열에 넣을 때 m 꼬리표를 모르니 맨 끝 assistant 를 m 으로 고르는 대신 인용만 맞춘다 → 갱신기 자료로 꼬리표를 구한다
  await llmQueue([]);
  const seedOnly = await page.evaluate(() => 1);
  await setSaveFail(page, 'chat', { from: 1, mode: 'throw' });
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{}' }]; });
  await output(page).catch((e) => e);
  const f1 = await saveFails(page);
  await clearSaveFail(page, 'chat');
  s = await store();
  step('1-1 채팅 저장 던짐 (갱신 결과 저장)', '저장 실패를 진단에 실패로 남김, 읽음 표시 안 남음 → 다음 턴에 다시 읽음 (다시 시도는 없음)', '코스 5장 저장 실패·공-02', { saveFails: f1.length, diag: (await diagList()).at(-1), readCount: Object.keys(s?.read ?? {}).length, logs: logs.filter((l) => /인물|갱신/.test(l)).slice(-3) }, null);
  // 다음 턴에 c2 를 다시 읽나
  await push('user', '나은솔에게 인사한다.', 'u3');
  await push('char', '나은솔이 고개를 까딱했다.\n' + st, 'c3');
  await llmQueue([]);
  await page.evaluate(() => { window.__llmAuto = true; });
  // 대기열 비우고 한 번 부른 뒤 자료를 보고 답 짓기: 가짜 리스는 대기열 순서라 먼저 빈 답 하나로 자료를 얻는다
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ entries: [], new_people: [], issues: [] }) }]; });
  await output(page);
  let calls = await llmCalls();
  const d1 = calls.at(-1)?.data ?? '';
  step('1-2 다음 턴 span', '저장 실패한 턴의 응답(c2 나은솔)도 확정 구간에 다시 들어감', '코드 splitUnread', { confirmed: d1 ? JSON.parse(d1).span.filter((x) => !x.context_only).map((x) => x.m + ':' + String(x.text).slice(0, 12)) : null }, d1.includes('나는 나은솔'));

  // 2. 채팅 저장 조용히 안 씀
  await push('user', '격리팀 이야기를 묻는다.', 'u4');
  await push('char', '나은솔 뒤에서 남자가 나타났다. "도경수다. 나도 격리팀."\n' + st, 'c4');
  await setSaveFail(page, 'chat', { from: 1, mode: 'silent' });
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: 'PLACEHOLDER' }]; });
  // 자료를 보고 답: 한 번 호출로 꼬리표를 알 수 없으니 m 은 c4 가 들어간 꼬리표를 짐작하지 않고, 먼저 빈 호출로 자료만 얻는다
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{}' }]; });
  await output(page);
  calls = await llmCalls();
  const d2 = calls.at(-1)?.data ?? '';
  const m2 = d2 ? tagFor(d2, '도경수다') : null;
  const f2 = await saveFails(page);
  await clearSaveFail(page, 'chat');
  s = await store();
  step('2 채팅 저장 조용히 안 씀', '플러그인은 성공으로 알고 진단 ok, 실제로는 읽음·기록 안 남음 → 다음 턴에 다시 읽음 (사실로)', '코스 5장 저장 실패', { saveFails: f2.length, diag: (await diagList()).at(-1), read: Object.keys(s?.read ?? {}).length, m2 }, null);

  // 3. 갱신기 결과로 새 인물 저장 + 채팅 저장 던짐
  await push('user', '도경수에게 묻는다.', 'u5');
  await push('char', '도경수가 대답했다. "내 이름은 도경수, 다시 말하지만." \n' + st, 'c5');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{}' }]; });
  await output(page);
  calls = await llmCalls();
  const d3 = calls.at(-1)?.data ?? '';
  const m3 = tagFor(d3, '내 이름은 도경수');
  step('3-0 정상 턴 (앞 조용한 실패 응답까지)', 'span 에 c4·c5', '코드 splitUnread', { confirmed: JSON.parse(d3).span.filter((x) => !x.context_only).map((x) => x.m + ':' + String(x.text).slice(0, 10)), m3 }, null);
  await push('user', '도경수와 악수한다.', 'u6');
  await push('char', '도경수가 손을 내밀었다. "잘 부탁한다, 신입."\n' + st, 'c6');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{}' }]; });
  await output(page);
  calls = await llmCalls();
  const d4 = calls.at(-1)?.data ?? '';
  const m4 = tagFor(d4, '잘 부탁한다, 신입');
  // 같은 응답 다시 읽기를 위해 읽음 표시를 지우고 새 인물 답 + 저장 던짐
  await page.evaluate(() => { const s = window.__chat.goeiPeopleV1; delete s.read['c6']; });
  await setSaveFail(page, 'chat', { from: 1, count: 1, mode: 'throw' });
  await page.evaluate((m) => { window.__llm = [{ type: 'success', result: JSON.stringify({ new_people: [{ name: '도경수', aliases: [], m, quote: '잘 부탁한다, 신입', identity: '격리팀', speech: '반말' }] }) }]; }, m4);
  await output(page).catch(() => {});
  await clearSaveFail(page, 'chat');
  s = await store();
  step('3 새 인물 답 + 저장 던짐', '도경수 기록 없음(저장 안 됨), 진단 실패, 콘솔 「인물 기록 갱신 실패」', '코스 5장 저장 실패', { has: !!s?.people?.['도경수'], diag: (await diagList()).at(-1), logs: logs.filter((l) => /인물 기록/.test(l)).slice(-2) }, !s?.people?.['도경수']);

  // 4. 기기 저장소(진단 열쇠) 저장 던짐
  await setSaveFail(page, 'storage', { key: 'goei-people-diag', mode: 'throw' });
  await push('user', '돌아선다.', 'u7');
  await push('char', '로비는 다시 조용해졌다.\n' + st, 'c7');
  const nd = (await diagList()).length;
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{}' }]; });
  let threw = null;
  await output(page).catch((e) => (threw = String(e)));
  const f4 = await saveFails(page);
  await clearSaveFail(page, 'storage');
  s = await store();
  step('4 진단 저장 던짐', '진단만 못 남기고 갱신은 그대로 (읽음 표시 남음)', 'host/people.ts pushDiag(못 남겨도 진행)', { threw, storageFails: f4.filter((x) => x.target === 'storage').length, diagCountSame: (await diagList()).length === nd, readC7: !!s?.read?.['c7'] }, !threw && !!s?.read?.['c7']);

  // 5. 조립 단계 실패 '인물 기록'
  const base = [sys('SYSTEM'), bot('첫 장면'), usr('로비로 간다.'), bot('로비에 스팡달이 서 있었다.'), usr('스팡달을 부른다.')];
  let out = await request(page, base);
  const hadBlock = out.some((m) => String(m.content).includes('[People records]'));
  await page.evaluate(() => { globalThis.__goeiFaultSteps = ['인물 기록']; });
  out = await request(page, base);
  await page.evaluate(() => { globalThis.__goeiFaultSteps = []; });
  step('5 조립 단계 「인물 기록」 실패', '기록 블록만 빠지고 나머지 요청은 그대로 감, 콘솔에 단계 이름', '코스 5장 조립 단계 실패', { before: hadBlock, after: out.some((m) => String(m.content).includes('[People records]')), n: out.length, lore: out.some((m) => String(m.content).includes('goei:lore')), logs: logs.filter((l) => /조립 실패|인물 기록/.test(l)).slice(-2) }, hadBlock && !out.some((m) => String(m.content).includes('[People records]')));
  step('끝', '', '', { pageErrors: errors.slice(-5) }, null);
} catch (e) {
  step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false);
} finally {
  await browser.close();
}
