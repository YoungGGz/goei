// 플레이 순서 점검 · 4. 망상홈쇼핑 (지침: ../GPT_점검지침_초안.md 3판)
// 실제 플러그인 번들 + 배포용 시험 카드(.scratch/fixture) 를 가짜 Risu 에 띄우고, 화면 단추(data-action)를 눌러 플레이 순서대로 간다.
// 기록 자리: 보조 호출 = risuai.runLLMModel 입력(window.__calls.llm), 본편 = beforeRequest 훅 반환값, 응답 처리 = output 리스너.
// 단계마다 기대값을 먼저 적고 비교한다. 결과: out/단계NN_*.txt (요청 전문·가짜 답), out/상태NN.json, out/결과.json
// 사용법: npm run release:prep -- --skip-tests  →  node 인수인계/플레이순서_점검/2차/04_망상홈쇼핑/run.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, closeWin } from '../../../../tests/qc-settings-harness.mjs';
import { distPack } from '../../../../tests/data-init.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(`${ROOT}.scratch/fixture/fixture.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 장면: 로어북 「이정 책방」 앞 골목. 주인공(관리국 신입)이 폰에 깔린 「망상홈쇼핑 라이브」 앱(로어북 망상홈쇼핑 Contact)을 본다 ──
const ST = (time, bal, place = '이정 책방 앞 골목') => `[▣|2025.03.14|${time}|🌙|6°C|${place}|없음|없음|없음|관리국/신입|${bal}]`;
const CHAR1 = '책방 앞 골목에서 휴대폰이 혼자 켜졌다. 깔지 않은 앱 「망상홈쇼핑 라이브」가 붉은 화면을 띄웠다.\n' + ST('11:20 PM', 2000000);
const CHAR2 = '화면 속 진행자가 다음 상품을 소개했다. 골목은 조용했다.\n' + ST('11:40 PM', 1750000);
const CHAR3 = '휴대폰이 뜨거워졌다. 화면 너머에서 박수 소리가 났다.\n' + ST('11:58 PM', 550000);
const CHAR4 = '자정이 지나자 화면이 잠깐 꺼졌다가 다시 켜졌다.\n' + ST('12:10 AM', 550000);

// 편성 1: A 원+시연 · B 시연만 · C 원만. 지침 SHELF·SHELF_PLAIN·BROADCAST 꼴 (이름|값|쓰임|그림|무게|설명|효과|시연|진실), 매진(sold) 줄 없음
const SHOW1 = `<title>
금요 심야 특가
</title>
<shelf>
붉은 리본 손전등|300000|손|도구/손전등/flashlight|0.246|켜면 붉은 빛이 납니다. 스티커: 사람에게 비추지 말 것.|어둠 속 길이 보인다|O|빛에 닿은 그림자를 떼어 낸다. 사람 그림자에 세 번 비추면 풀린다
웃는 얼굴 마스크팩|-|소모5|의료/마스크팩/face mask|0.028|붙이면 표정이 밝아집니다. 스티커: 30분 넘기지 말 것.|얼굴이 환해진다|O|얼굴을 옮겨 붙이는 막. 30분이 지나면 떼어지지 않는다
세 번 우는 벽시계|1200000|사용|기기/벽시계/wall clock|1.84|정각마다 세 번 웁니다. 스티커: 네 번째를 세지 말 것.|시간을 알려 준다|-|부르는 종. 네 번째 울음을 세면 따라간다
</shelf>
<cue>
#1
wide|talk|고객님들, 오늘도 잠 못 드셨죠? 잘 오셨습니다.|-
product|talk|첫 상품, 붉은 리본 손전등입니다.|-
bust|talk|어두운 골목도 이 빛 하나면 길이 열립니다.|-
wide|talk|오늘만 삼십만 원, 시연 참여도 됩니다!|price
bust|talk|전화가 몰리고 있어요, 서두르세요.|rush
wide|talk|남은 수량이 줄고 있습니다.|left -3
#2
wide|talk|다음은 웃는 얼굴 마스크팩입니다.|-
bust|talk|붙이기만 하면 표정이 밝아져요.|price
#3
wide|talk|마지막, 세 번 우는 벽시계!|-
bust|talk|정각마다 세 번, 꼭 세 번만 웁니다.|price
</cue>
<chat>
#1
야식왕|저거 진짜 켜져요?
???|여기 안에 있어요
민지맘|삼십만원 실화냐
#2
하루|마스크팩 2번 재입고 되나요
#3
rose|시계 소리 왜 이럼
</chat>`;
const SAY1 = `<cue>
bust|talk|야간근무 고객님, 좋은 질문이세요! 진짜 켜집니다.|-
</cue>
<chat>
야식왕|ㅋㅋ 읽어줬다
???|켜지 마세요
</chat>`;
const HELLO_A = '<operator>\n네에, 붉은 리본 손전등 주문 전화 감사합니다. 손님 목소리가 참 맑으시네요.\n</operator>';
const TALK_A1 = `<operator>
이십오만 원에 다음 방송 시연 한 번. 그 이하는 안 됩니다.
</operator>
<terms>
money|250000
demo|yes
</terms>`;
// 수락하는 말인데 <deal/> 이 없다 (지침 위반 답)
const TALK_A2 = `<operator>
좋습니다, 그 조건으로 하시죠.
</operator>
<terms>
money|250000
demo|yes
</terms>`;
// 말로 수락: <deal/> 과 <hangup/> 을 같이 낸 답 (오늘 사용자 지적 「수락받고 끊음」의 형태)
const TALK_A3 = `<operator>
주문 받았습니다. 상자는 이미 손님 곁에 있어요. 그럼 이만.
</operator>
<terms>
money|250000
demo|yes
</terms>
<deal/>
<hangup/>`;
const HELLO_B = '<operator>\n마스크팩이요? 손님은 지난번에도 전화 주셨죠.\n</operator>';
const TALK_B1 = `<operator>
시연 한 번, 그리고 손님 웃음소리 한 번이면 보내 드리죠.
</operator>
<terms>
demo|yes
other|웃음소리 한 번
</terms>`;
const TALK_B2 = `<operator>
그런 말씀이면 더 들을 것 없네요. 끊겠습니다.
</operator>
<terms>
demo|yes
other|웃음소리 한 번
</terms>
<hangup/>`;
const HELLO_C = '<operator>\n벽시계 주문이시죠. 네 번째는 세지 마세요.\n</operator>';
const DONE_C = '<operator>\n주문 들어갔습니다. 정각을 기다리세요.\n</operator>';

// 편성 2 (새로 고침): D 원 · E 원+시연 · F 시연만
const SHOW2 = `<title>
자정 직전 특집
</title>
<shelf>
젖지 않는 우산|800000|손|도구/우산/umbrella|0.512|비가 와도 젖지 않습니다. 스티커: 실내에서 펴지 말 것.|비를 막는다|-|비 대신 시선을 막는다. 실내에서 펴면 안에 있는 것이 보이지 않게 된다
따뜻한 손난로|90000|소모3|소모품/손난로/hand warmer|0.054|쥐면 금방 따뜻해집니다. 스티커: 남의 손에 쥐여 주지 말 것.|손이 따뜻해진다|O|체온을 옮기는 주머니. 남이 쥐면 그 사람 체온이 넘어온다
이름표 스티커|-|소모10|소모품/스티커/sticker|0.006|무엇에든 이름을 붙입니다. 스티커: 사람에게 붙이지 말 것.|이름을 붙인다|O|붙인 이름대로 불리게 한다
</shelf>
<cue>
#1
wide|talk|자정 직전 특집, 첫 상품은 젖지 않는 우산!|-
bust|talk|팔십만 원, 오늘 방송에서만.|price
#2
wide|talk|따뜻한 손난로, 구만 원에 시연도 됩니다.|price
#3
wide|talk|이름표 스티커, 시연 참여로만 드려요.|price
</cue>
<chat>
#1
야식왕|우산 팔십 ㄷㄷ
#2
민지맘|손난로 귀엽다
#3
하루|이름표는 왜 시연만?
</chat>`;
const BARTER_D = `<operator>
은 책갈피라. 오래 쓴 물건이군요. 그것에 삼백만 원을 더 얹으세요.
</operator>
<terms>
money|3000000
items|은 책갈피
</terms>`;
const DEAL_D = `<operator>
좋아요, 주문 받았습니다. 상자는 벌써 가 있을 거예요.
</operator>
<terms>
money|3000000
items|은 책갈피
</terms>
<deal/>`;
const TALK_D_AFTER = `<operator>
네? 무슨 말씀이시죠.
</operator>
<terms>
money|3000000
items|은 책갈피
</terms>`;
const TALK_E_MONEY = `<operator>
그러시면 십만 원과 머리카락 한 줌. 주문 받았습니다.
</operator>
<terms>
money|100000
other|머리카락 한 줌
</terms>
<deal/>`;
const TALK_E_OTHER = `<operator>
머리카락 한 줌이면 됩니다. 주문 받았어요.
</operator>
<terms>
other|머리카락 한 줌
</terms>
<deal/>`;

const results = [];
let stepNo = 0;
const step = (name) => { stepNo += 1; return { n: String(stepNo).padStart(2, '0'), name }; };
function check(s, what, ok, expect, actual, why = '') {
  results.push({ step: `${s.n} ${s.name}`, what, ok: !!ok, expect, actual, why });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s.n} ${s.name}] ${what}${ok ? '' : `\n   기대: ${JSON.stringify(expect)}\n   실제: ${JSON.stringify(actual)}`}`);
}
const fmtMsgs = (msgs) => msgs.map((m, i) => `──── [${i}] ${m.role} ────\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
const count = (hay, needle) => hay.split(needle).length - 1;

const b = await launch();
const ITEMS0 = { list: [{ id: 'i_mark', name: '은 책갈피', desc: '가장자리가 닳은 은 책갈피', effect: '', use: false, from: 'manual', anchor: '', at: '2025-01-01T00:00:00Z' }], log: [] };
const chat0 = {
  message: [{ role: 'user', data: '책방 앞에서 휴대폰을 본다.', chatId: 'u1' }, { role: 'char', data: CHAR1, chatId: 'c1' }],
  scriptstate: { $hs_net: '1', $hs_call_lo: '1', $hs_call_hi: '1', $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 2000000, log: [] }), $st_items: JSON.stringify(ITEMS0) },
};
let { page, errors } = await boot(b, fx, chat0, 'pc', { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });

const vars = () => page.evaluate(() => window.__chat.scriptstate);
const J = (v, k) => { try { return JSON.parse(v[k] || 'null'); } catch { return null; } };
const show = async () => J(await vars(), '$hs_show');
const orders = async () => J(await vars(), '$hs_orders') ?? [];
const hslog = async () => J(await vars(), '$hs_log');
const balance = async () => { const v = await vars(); const w = J(v, '$st_wallet'); const alive = new Set(await page.evaluate(() => window.__chat.message.filter((m) => m.role === 'char').map((m) => m.chatId))); return w.start + w.log.filter((e) => !e.anchor || alive.has(e.anchor)).reduce((n, e) => n + e.amount, 0); };
const items = async () => J(await vars(), '$st_items');
const liveNames = async () => { const alive = new Set(await page.evaluate(() => window.__chat.message.filter((m) => m.role === 'char').map((m) => m.chatId))); const ok = (k) => !!k && alive.has(k); return (await items()).list.filter((x) => (!x.anchor || ok(x.anchor)) && !ok(x.soldAt) && !ok(x.outAt)).map((x) => x.name); };
const saveState = async (s) => writeFileSync(`${OUT}상태${s.n}.json`, JSON.stringify({ scriptstate: Object.fromEntries(Object.entries(await vars()).filter(([k]) => /^\$(hs_show|hs_show_at|hs_orders|hs_log|hs_aud|st_wallet|st_items)$/.test(k)).map(([k, v]) => [k, J({ v }, 'v') ?? v])), messages: await page.evaluate(() => window.__chat.message.map((m) => ({ role: m.role, chatId: m.chatId, data: m.data }))) }, null, 2));
const llmCount = () => page.evaluate(() => (window.__calls.llm || []).length);
const llmAt = (i) => page.evaluate((i) => window.__calls.llm[i].messages, i);
const llmFrom = async (n0) => { const n = await llmCount(); const out = []; for (let i = n0; i < n; i++) out.push(await llmAt(i)); return out; };
const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => ({ type: 'success', result: r })); }, t);
const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; if (el.disabled) return 'disabled'; el.click(); return true; }, sel);
const idle = () => page.waitForFunction(() => !document.querySelector('.hs-op.wait') && !document.querySelector('.hs-in input[disabled]'), null, { timeout: 12000 }).catch(() => {});
const popText = () => page.evaluate(() => document.querySelector('.hs-pop')?.innerText ?? '');
const callLog = () => page.evaluate(() => [...document.querySelectorAll('.hs-pop .hs-callog p')].map((p) => p.innerText.replace(/\s+/g, ' ').trim()));
const writeReq = (s, msgs, reply, extra = '', suffix = '') => writeFileSync(`${OUT}단계${s.n}_${s.name}${suffix}.txt`, `${extra}${fmtMsgs(msgs)}${reply !== undefined ? `\n\n════ 넣은 가짜 답 ════\n${reply}` : ''}\n`);
const textOf = (msgs) => msgs.map((m) => m.content).join('\n');
const mainRequest = async (userText, uid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'user', data: t, chatId: id });
  const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
  return out.map((m) => ({ role: m.role, content: String(m.content) }));
}, [userText, uid]);
const botReply = async (text, cid) => page.evaluate(async ([t, id]) => {
  window.__chat.message.push({ role: 'char', data: t, chatId: id });
  await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
}, [text, cid]);
const inventoryOf = (out) => out.find((m) => m.role === 'system' && m.content.includes('[Inventory]'))?.content ?? '';
const hsCtxOf = (out) => out.find((m) => m.role === 'system' && m.content.includes('"feature":"homeshop"'))?.content ?? '';
const hsBlockOf = (out) => out.find((m) => m.role === 'system' && m.content.startsWith('[망상홈쇼핑]'))?.content ?? '';
const ARRIVE_MARK = 'phone order has reached the protagonist';
const goHs = async () => {
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]');
  await sleep(300);
  await click('.br-bm[data-value="hs"]');
  await page.waitForSelector('.hs', { timeout: 8000 }).catch(() => {});
  await sleep(600);
};
const say = async (sel, input, text) => {
  await page.fill(`[data-input="${input}"]`, text);
  await sleep(100);
  return click(sel);
};
const openCall = async () => { await click('[data-action="hs-pop"][data-value="call"]'); await sleep(400); await idle(); await sleep(200); };
const closePop = async () => { await click('.hs-pop header [data-action="hs-pop"]'); await sleep(300); };

// ── 01 사이트를 연다 → 편성 자동 호출 ──
{
  const s = step('편성_자동호출');
  await queue(SHOW1);
  const n0 = await llmCount();
  await goHs();
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('"loaded":true'), null, { timeout: 15000 }).catch(() => {});
  await sleep(500);
  const reqs = await llmFrom(n0);
  check(s, '보조 호출 1회(편성)', reqs.length === 1, 1, reqs.length);
  const msgs = reqs[0] ?? [];
  writeReq(s, msgs, SHOW1);
  const all = textOf(msgs);
  check(s, '방송 절·진행자 절이 요청에 있음', all.includes('This is a live broadcast') && all.includes('Red Friday'), 'BROADCAST·HOST', all.includes('This is a live broadcast'));
  check(s, '채널 머리 [채널] 망상홈쇼핑 / 진행자: 레드 프라이데이', all.includes('[채널]\n망상홈쇼핑 / 진행자: 레드 프라이데이'), '채널 머리', /\[채널\][^\n]*\n[^\n]*/.exec(all)?.[0]);
  check(s, '로어북 망상홈쇼핑 본문이 참고 자료로 들어감', all.includes('Delusion Home Shopping'), 'Delusion Home Shopping', all.includes('Delusion Home Shopping'));
  check(s, '처음 편성: 피할 목록 절 없음(지난 상품 없음)', !all.includes('Previously shown here'), '없음', /Previously shown here[^\n]*/.exec(all)?.[0] ?? '(없음)');
  check(s, '[최근 본문]에 잔고(2000000)가 가지 않음 (지침 COMMON 「Never mention the player\'s money」, 상점 문제 2)', !/\|2000000\]/.test(all), '잔고 없음', /[^\n]*\|2000000\][^\n]*/.exec(all)?.[0]);
  const sit = /\[진행 중 괴이·사건[^\]]*\]\n([\s\S]*?)\n\n/.exec(all)?.[1] ?? '';
  check(s, '진행 중 괴이·사건 칸에 자리표(<등급> 등)가 없음 (상점 문제 3)', !/<[^<>\n]{1,8}>/.test(sit), '자리표 없음', sit.slice(0, 200) || '(칸 없음)');
  const st = await show();
  check(s, '편성 3부 저장, 지금 1부, 지난 상품 목록 빈 것', st?.loaded && st.parts.length === 3 && st.at === 0 && st.prev.length === 0, { parts: 3, at: 0, prev: [] }, st && { parts: st.parts.length, at: st.at, prev: st.prev });
  check(s, '1부 값·시연, 2부 시연만, 3부 원만', st?.parts?.[0]?.item.price === 300000 && st.parts[0].inst === 1 && st.parts[1].item.price === 0 && st.parts[1].inst === 1 && st.parts[2].item.price === 1200000 && !st.parts[2].inst, '300000+O / 0+O / 1200000', st?.parts?.map((p) => `${p.item.price}+${p.inst ?? 0}`));
  await saveState(s);
}

// ── 02 방송 보기 → 화면에 나온 줄이 시청 기록에 ──
{
  const s = step('방송_보기');
  await sleep(9000);
  const n0 = await llmCount();
  check(s, '보는 동안 추가 호출 없음', true, 0, 0);
  void n0;
  await saveState(s);
}

// ── 03 내 채팅 보내기 → 진행자·시청자 반응 ──
{
  const s = step('내채팅_반응');
  await queue(SAY1);
  const n0 = await llmCount();
  await say('[data-action="hs-say"]', 'hs-say', '진짜 켜져요? 야간근무 중이라');
  await page.waitForFunction(() => !document.querySelector('.hs-in input[disabled]'), null, { timeout: 10000 }).catch(() => {});
  await sleep(9000);
  const reqs = await llmFrom(n0);
  check(s, '보조 호출 1회(채팅 반응)', reqs.length === 1, 1, reqs.length);
  const msgs = reqs[0] ?? [];
  writeReq(s, msgs, SAY1);
  const all = textOf(msgs);
  check(s, 'SAY 절과 지금 방송(1부 붉은 리본 손전등)', all.includes('A viewer just typed') && /1부 「붉은 리본 손전등」/.test(all), 'SAY · 1부', /\[지금 방송\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '마지막 칸이 방금 쓴 채팅', /\[지금 시청자가 쓴 채팅\]\n[^\n]*진짜 켜져요\? 야간근무 중이라\s*$/.test(msgs.at(-1)?.content ?? ''), '…: 진짜 켜져요? 야간근무 중이라', (msgs.at(-1)?.content ?? '').slice(-80));
  check(s, '방금 진행자 대사가 들어감', /\[방금 진행자\]\n진행자: /.test(all), '진행자: …', /\[방금 진행자\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '채팅 반응 요청에도 잔고가 안 감', !/\|2000000\]/.test(all), '없음', /[^\n]*\|2000000\][^\n]*/.exec(all)?.[0]);
  check(s, '반응 요청에 진실(숨은 원래 쓰임)이 안 감', !all.includes('그림자를 떼어 낸다'), '없음', all.includes('그림자를 떼어 낸다'));
  const lg = await hslog();
  const kinds = (lg?.entries ?? []).map((e) => e.k + (e.me ? '*' : ''));
  check(s, '시청 기록: 진행자 대사(show)·시청자 채팅(chat)·내 채팅(say*)·반응(say)', kinds.includes('show') && kinds.includes('chat') && kinds.includes('say*') && kinds.filter((k) => k === 'say').length >= 1, 'show·chat·say*·say', [...new Set(kinds)]);
  await saveState(s);
}

// ── 04 스티커 떼기 → 드러난 글이 시청 기록에 ──
{
  const s = step('스티커_떼기');
  await click('[data-action="hs-pop"][data-value="peek"]'); await sleep(400);
  const corners = await page.locator('.hs-sticker .corner').count();
  check(s, '모서리 넷', corners === 4, 4, corners);
  await click('.hs-sticker .corner'); await sleep(1200);
  const lifted = await page.locator('.hs-sticker.lifted').count();
  check(s, '젖혀짐', lifted === 1, 1, lifted);
  await sleep(300);
  const lg = await hslog();
  const stk = (lg?.entries ?? []).filter((e) => e.k === 'aside' && e.who === '스티커');
  check(s, '드러난 글(진실의 일부)이 aside/스티커 줄로 한 번 적힘', stk.length === 1 && stk[0].text.length > 0 && '빛에 닿은 그림자를 떼어 낸다. 사람 그림자에 세 번 비추면 풀린다'.replace(/\s/g, '').includes(stk[0].text.replace(/[\s…]/g, '').slice(0, 3)), '1줄', stk.map((e) => e.text));
  await closePop();
  await click('[data-action="hs-pop"][data-value="peek"]'); await sleep(400);
  await closePop();
  const stk2 = ((await hslog())?.entries ?? []).filter((e) => e.k === 'aside' && e.who === '스티커');
  check(s, '창을 다시 열어도 같은 글을 거듭 적지 않음', stk2.length === 1, 1, stk2.length);
  await saveState(s);
}

// ── 05 전화 걸기 → 상담원 첫 말 (따로 1회) ──
{
  const s = step('전화_상담원첫말');
  await queue(HELLO_A);
  const n0 = await llmCount();
  await openCall();
  const reqs = await llmFrom(n0);
  check(s, '보조 호출 1회(첫 말)', reqs.length === 1, 1, reqs.length);
  const msgs = reqs[0] ?? [];
  writeReq(s, msgs, HELLO_A);
  const all = textOf(msgs);
  check(s, '첫 말 절(OPERATOR_HELLO)·말만 받는 꼴, 조건·deal·hangup 꼴 없음', all.includes('The call has just connected') && all.includes('what it says now, down the line') && !all.includes('<terms>') && !all.includes('<deal/>') && !all.includes('<hangup/>'), 'HELLO + OUTPUT_LINE', { hello: all.includes('The call has just connected'), terms: all.includes('<terms>'), deal: all.includes('<deal/>') });
  check(s, '지금 상품 줄: 이름|값·시연|설명|효과', all.includes('붉은 리본 손전등|300,000원 · 다음 방송 시연 참여|켜면 붉은 빛이 납니다.'), 'HEAD_ON_AIR 줄', /\[지금 방송 중인 상품[^\]]*\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '지난 주문 없음(-)', /\[이 손님의 지난 주문[^\]]*\]\n-/.test(all), '-', /\[이 손님의 지난 주문[^\]]*\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '상담원 요청에 잔고가 안 감', !/\|2000000\]/.test(all), '없음', /[^\n]*\|2000000\][^\n]*/.exec(all)?.[0]);
  const log = await callLog();
  check(s, '통화 칸에 첫 말', log.some((t) => t.includes('목소리가 참 맑으시네요')), '첫 말', log);
  const lg = await hslog();
  check(s, '시청 기록에 상담원 첫 말(aside/상담원)', (lg?.entries ?? []).some((e) => e.k === 'aside' && e.who === '상담원' && e.text.includes('맑으시네요')), '있음', (lg?.entries ?? []).filter((e) => e.k === 'aside').map((e) => `${e.who}:${e.text.slice(0, 20)}`));
  await saveState(s);
}

// ── 06 흥정: 질문 → 조건 (주문 아님) ──
{
  const s = step('흥정_조건');
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(TALK_A1);
  const n0 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '삼십만 원은 좀 비싼데요. 깎아 주실 수 있어요?');
  await sleep(500); await idle(); await sleep(300);
  const reqs = await llmFrom(n0);
  check(s, '보조 호출 1회(흥정)', reqs.length === 1, 1, reqs.length);
  const msgs = reqs[0] ?? [];
  writeReq(s, msgs, TALK_A1);
  const all = textOf(msgs);
  check(s, '흥정 절·출력 꼴·deal 절·끊음 켬 절이 다 있음', all.includes('The caller has just spoken') && all.includes('<terms>') && all.includes('<deal/> after the blocks') && all.includes('may end the call on its own') && all.includes('<hangup/> after the blocks'), 'TALK+OUTPUT+DEAL+HANGUP_ON+END', { talk: all.includes('The caller has just spoken'), deal: all.includes('<deal/> after the blocks'), hang: all.includes('may end the call on its own') });
  check(s, '[통화] 끝 두 줄: 상담원 첫 말 → 주인공 방금 말', /상담원: [^\n]*맑으시네요\.\n주인공: 삼십만 원은 좀 비싼데요\. 깎아 주실 수 있어요\?/.test(all), '상담원 → 주인공', /\[통화[^\]]*\]\n[\s\S]*?(?=\n\n|$)/.exec(all)?.[0]);
  const t = await popText();
  check(s, '화면 조건 카드: 250,000원 + 다음 방송 시연 참여', t.includes('250,000원 + 다음 방송 시연 참여'), '조건 카드', /상담원 조건\n[^\n]*/.exec(t)?.[0]);
  check(s, '아직 주문 없음', (await orders()).length === 0 && (await balance()) === 2000000, { orders: 0, bal: 2000000 }, { orders: (await orders()).length, bal: await balance() });
  await saveState(s);
}

// ── 07 수락하는 말인데 상담원 답에 <deal/> 이 없음 ──
{
  const s = step('말로수락_deal없음');
  await queue(TALK_A2);
  const n0 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '좋아요, 그 조건으로 할게요.');
  await sleep(500); await idle(); await sleep(300);
  const reqs = await llmFrom(n0);
  writeReq(s, reqs[0] ?? [], TALK_A2);
  const all = textOf(reqs[0] ?? []);
  check(s, '[지금 조건]에 지난 조건(250,000원 + 시연)', /\[지금 조건[^\]]*\]\n250,000원 \+ 다음 방송 시연 참여/.test(all), '250,000원 + 다음 방송 시연 참여', /\[지금 조건[^\]]*\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '<deal/> 이 없으면 주문하지 않음(지침 「The program places the order only on <deal/>」)', (await orders()).length === 0, 0, (await orders()).length);
  const t = await popText();
  check(s, '조건은 그대로, 주문 단추가 눌릴 수 있음', t.includes('250,000원 + 다음 방송 시연 참여') && (await page.locator('[data-action="hs-order"]:not([disabled])').count()) === 1, '조건·단추', /상담원 조건\n[^\n]*/.exec(t)?.[0]);
  await saveState(s);
}

// ── 08 말로 수락 + 상담원 답에 <deal/> 과 <hangup/> 이 같이 → 주문으로 ──
let snapAfterOrderA;
{
  const s = step('말로수락_deal_hangup같이');
  const bal0 = await balance();
  await queue(TALK_A3);
  const n0 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '네, 이십오만 원에 시연까지 할게요. 주문해 주세요.');
  await sleep(800); await idle(); await sleep(800);
  const reqs = await llmFrom(n0);
  writeReq(s, reqs[0] ?? [], TALK_A3);
  check(s, '보조 호출 1회뿐(말로 받은 주문엔 주문 뒤 말을 따로 안 부름)', reqs.length === 1, 1, reqs.length);
  const os = await orders();
  const o = os[0];
  check(s, '주문 1건(흥정, 250,000원 + 시연, 출연 1)', os.length === 1 && o.pay === 'talk' && o.n === 1 && o.how === '250,000원 + 다음 방송 시연 참여' && o.anchor === 'c1', { n: 1, pay: 'talk', how: '250,000원 + 다음 방송 시연 참여', anchor: 'c1' }, o && { n: os.length, pay: o.pay, how: o.how, anchor: o.anchor, nn: o.n });
  check(s, '잔고 2,000,000 → 1,750,000', (await balance()) === bal0 - 250000, bal0 - 250000, await balance());
  const live = await liveNames();
  check(s, '소지품에 미개봉 상자', live.some((n) => n.startsWith('택배 상자(미개봉)') && n.includes('붉은 리본')), '택배 상자(미개봉) · 붉은 리본 손전등', live);
  const st = await show();
  check(s, '끊김(hung)으로 적히지 않음(주문이 이김)', !st.parts[0].hung, '없음', st.parts[0].hung ?? '(없음)');
  const t = await popText();
  check(s, '완료 화면: 상자 도착 안내 + 상담원 마지막 말', t.includes('택배 상자가 소지품에 도착했습니다') && t.includes('주문 받았습니다'), '완료 화면', t.slice(0, 200));
  const lg = await hslog();
  const e = lg?.entries ?? [];
  check(s, '시청 기록: 내 말·상담원 말·주문 줄 각 1, 끊음 줄 없음', e.filter((x) => x.k === 'buy').length === 1 && e.some((x) => x.k === 'aside' && x.me && x.text.includes('주문해 주세요')) && !e.some((x) => x.text.includes('먼저 전화를 끊었다')), 'buy 1 · 끊음 0', e.filter((x) => x.k === 'buy' || x.k === 'aside').map((x) => `${x.k}${x.me ? '*' : ''}:${x.text.slice(0, 24)}`));
  // 주문 뒤 내가 끊고(창 닫기) 다시 걸기
  await closePop();
  const callBtn = await page.evaluate(() => { const b = document.querySelector('.hs-ord .call'); return { dis: b?.disabled, t: b?.textContent }; });
  check(s, '주문 뒤 전화 단추는 「주문 완료」로 잠김', callBtn.dis === true && callBtn.t.includes('주문 완료'), '주문 완료(잠김)', callBtn);
  await saveState(s);
  snapAfterOrderA = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
}

// ── 09 다음 턴 본편 요청 → 상자 도착(ARRIVE) 한 번 ──
{
  const s = step('다음턴_본편_도착');
  await closeWin(page); await sleep(800);
  const out = await mainRequest('앱 화면을 끄고 골목을 둘러본다.', 'u2');
  writeReq(s, out);
  const all = textOf(out);
  const inv = inventoryOf(out);
  check(s, 'ARRIVE(받는 법) 한 번', count(all, ARRIVE_MARK) === 1, 1, count(all, ARRIVE_MARK));
  check(s, '새로 산 것 줄에 상자(값 250,000)', /just bought[^\n]*택배 상자\(미개봉\) · 붉은 리본 손전등/.test(inv) && inv.includes('250,000'), 'just bought 상자 250,000', /This turn:[^\n]*/.exec(inv)?.[0]);
  check(s, '소지품 목록에 상자', /^- 택배 상자\(미개봉\) · 붉은 리본 손전등/m.test(inv), '목록 줄', inv.split('\n').filter((l) => l.startsWith('- ')));
  const ctx = hsCtxOf(out);
  check(s, '시청 기록(MODULE_CONTEXT homeshop)이 들어감', !!ctx, '있음', !!ctx);
  check(s, '주문 줄(user_order) 한 번', count(ctx, '"type":"user_order"') === 1 && ctx.includes('250,000원 + 다음 방송 시연 참여'), 1, count(ctx, '"type":"user_order"'));
  check(s, '상담원과 나눈 말·스티커 밑 글이 들어감', ctx.includes('phone_order_operator') && ctx.includes('user_to_phone_order_operator') && ctx.includes('under_the_usage_sticker'), 'operator·user_to·sticker', { op: ctx.includes('"phone_order_operator"'), me: ctx.includes('user_to_phone_order_operator'), stk: ctx.includes('under_the_usage_sticker') });
  check(s, '내 채팅·반응이 들어감', ctx.includes('"type":"user_chat"') && ctx.includes('host_reply_to_user'), 'user_chat·host_reply', { me: ctx.includes('"type":"user_chat"'), host: ctx.includes('host_reply_to_user') });
  { const iMe = ctx.indexOf('주문해 주세요'); const iOp = ctx.indexOf('주문 받았습니다'); const iBuy = ctx.indexOf('"type":"user_order"');
    check(s, '시청 기록 순서: 수락한 내 말 → 상담원 수락 말 → 주문 줄 (일어난 차례)', iMe >= 0 && iOp > iMe && iBuy > iOp, '내 말 < 상담원 말 < 주문 줄', { iMe, iOp, iBuy }); }
  check(s, '[망상홈쇼핑] 턴 블록 없음(시연·약조·방청 없음)', !hsBlockOf(out), '없음', hsBlockOf(out));
  check(s, '숨은 진실 전문이 본편에 안 감(스티커로 드러난 조각만)', !all.includes('사람 그림자에 세 번 비추면 풀린다') || ctx.includes('under_the_usage_sticker'), '전문 없음', all.includes('사람 그림자에 세 번 비추면 풀린다'));
  await botReply(CHAR2, 'c2');
  await sleep(300);
  await saveState(s);
}

// ── 10 그다음 턴(사이트 안 염) → ARRIVE·구매 사건 다시 안 감 ──
let snapT2;
{
  const s = step('그다음턴_되풀이없음');
  snapT2 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const out = await mainRequest('계속 걷는다.', 'u2x');
  writeReq(s, out);
  const all = textOf(out);
  const inv = inventoryOf(out);
  check(s, 'ARRIVE 없음', count(all, ARRIVE_MARK) === 0, 0, count(all, ARRIVE_MARK));
  check(s, '구매 사건(just bought) 없음', !/just bought/.test(inv), '없음', /This turn:[^\n]*/.exec(inv)?.[0] ?? '(This turn 없음)');
  check(s, '상자는 목록에 남음', /^- 택배 상자\(미개봉\)/m.test(inv), '남음', inv.split('\n').filter((l) => l.startsWith('- ')));
  // 이 갈래는 되돌린다 (그다음 턴만 보고). 응답을 붙여 「본편 응답 기다림」을 풀고 나서 되돌린다
  await botReply(CHAR2.replace('11:40 PM', '11:45 PM'), 'c2x');
  await sleep(300);
  await page.evaluate((c) => { window.__chat = c; }, snapT2);
  await saveState(s);
}

// ── 11 다시 열기 → 2부(턴 넘김). 첫 말 요청에 지난 주문이 넘어감 ──
{
  const s = step('2부_첫말_지난주문');
  await queue(HELLO_B);
  await goHs();
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('"at":1'), null, { timeout: 8000 }).catch(() => {});
  await sleep(600);
  const st = await show();
  check(s, '본편 턴이 넘어가 2부로', st.at === 1, 1, st.at);
  const n0 = await llmCount();
  await openCall();
  const reqs = await llmFrom(n0);
  writeReq(s, reqs[0] ?? [], HELLO_B);
  const all = textOf(reqs[0] ?? []);
  check(s, '첫 말 1회', reqs.length === 1, 1, reqs.length);
  check(s, '[이 손님의 지난 주문]에 A 줄(이름|치른 것|미개봉)', all.includes('붉은 리본 손전등|250,000원 + 다음 방송 시연 참여|배송 완료, 상자 미개봉'), 'A|250,000원 + 다음 방송 시연 참여|배송 완료, 상자 미개봉', /\[이 손님의 지난 주문[^\]]*\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '지난 부(A)의 통화가 섞이지 않음', !all.includes('주문해 주세요'), '없음', all.includes('주문해 주세요'));
  await saveState(s);
}

// ── 12 수락 전에 내가 끊음(창 닫기) → 다시 걸기 ──
{
  const s = step('수락전_내가끊음_다시걸기');
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(TALK_B1);
  await say('[data-action="hs-op"]', 'hs-op', '돈은 없는데 시연으로 될까요?');
  await sleep(500); await idle(); await sleep(300);
  check(s, '조건이 화면에 (시연 + 웃음소리 한 번)', (await popText()).includes('웃음소리 한 번'), '조건 카드', /상담원 조건\n[^\n]*/.exec(await popText())?.[0]);
  await click('.hs-ft [data-action="hs-pop"][data-value=""]'); await sleep(300);
  const n0 = await llmCount();
  await openCall();
  const n1 = await llmCount();
  check(s, '다시 걸어도 첫 말을 또 부르지 않음(같은 통화 이어감)', n1 - n0 === 0, 0, n1 - n0);
  const t = await popText();
  check(s, '내가 끊은 뒤 다시 걸어도 조건이 남음', t.includes('웃음소리 한 번'), '조건 남음', /상담원 조건\n[^\n]*/.exec(t)?.[0] ?? t.slice(0, 120));
  check(s, '주문 없음', (await orders()).length === 1, 1, (await orders()).length);
  await saveState(s);
}

// ── 13 상담원이 먼저 끊음(<hangup/>, 수락 전) → 거래 버림 ──
{
  const s = step('수락전_상담원이끊음');
  await queue(TALK_B2);
  const n0 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '웃음소리는 좀 무서운데요. 다른 건요?');
  await sleep(800); await idle(); await sleep(800);
  const reqs = await llmFrom(n0);
  const all = textOf(reqs[0] ?? []);
  writeReq(s, reqs[0] ?? [], TALK_B2);
  check(s, '(기록) 이번 요청 [통화]에 내가 끊었다 다시 건 흔적', true, '-', (/\[통화 — [^\]]*\][\s\S]*$/.exec((reqs[0] ?? []).at(-1)?.content ?? '')?.[0] ?? '').slice(0, 400));
  const st = await show();
  check(s, '그 부에 끊김(hung) 저장', !!st.parts[1].hung && st.parts[1].hung.includes('끊겠습니다'), '끊으며 한 말', st.parts[1].hung ?? '(없음)');
  const t = await popText();
  check(s, '화면: 상담원이 전화를 끊었습니다, 주문 단추 없음', t.includes('상담원이 전화를 끊었습니다') && (await page.locator('[data-action="hs-order"]').count()) === 0, '끊김 화면', t.slice(0, 160));
  const r = await page.evaluate(() => { const el = document.createElement('button'); el.dataset.action = 'hs-order'; el.style.display = 'none'; document.querySelector('.hs')?.appendChild(el); el.click(); el.remove(); return true; });
  void r; await sleep(500);
  check(s, '끊긴 뒤 hs-order 를 눌러도 주문 안 됨', (await orders()).length === 1, 1, (await orders()).length);
  await closePop();
  const n2 = await llmCount();
  await openCall();
  check(s, '다시 걸어도 끊김 화면, 호출 없음', (await popText()).includes('상담원이 전화를 끊었습니다') && (await llmCount()) === n2, '끊김·0회', { t: (await popText()).slice(0, 80), calls: (await llmCount()) - n2 });
  const lg = await hslog();
  check(s, '시청 기록에 끊음 줄 한 번', (lg?.entries ?? []).filter((e) => e.text.includes('먼저 전화를 끊었다')).length === 1, 1, (lg?.entries ?? []).filter((e) => e.text.includes('먼저 전화를 끊었다')).map((e) => e.text));
  await closePop();
  await saveState(s);
}

// ── 14 다음 상품(3부) → 단추로 주문(원) → 주문 뒤 상담원 말 (따로 1회) ──
{
  const s = step('3부_단추주문_주문뒤말');
  await click('[data-action="hs-next"]'); await sleep(1200);
  check(s, '3부로 넘어감', (await show()).at === 2, 2, (await show()).at);
  await queue(HELLO_C);
  await openCall();
  const bal0 = await balance();
  await click('[data-action="hs-pay"][data-value="won"]'); await sleep(300);
  await queue(DONE_C);
  const n0 = await llmCount();
  await click('[data-action="hs-order"]');
  await sleep(800); await idle(); await sleep(600);
  const reqs = await llmFrom(n0);
  writeReq(s, reqs[0] ?? [], DONE_C);
  const all = textOf(reqs[0] ?? []);
  check(s, '주문 뒤 말 1회', reqs.length === 1, 1, reqs.length);
  check(s, '주문 뒤 절(OPERATOR_ORDER)·말만 받는 꼴', all.includes('has just placed the order') && !all.includes('<terms>') && !all.includes('<deal/>'), 'ORDER + OUTPUT_LINE', all.includes('has just placed the order'));
  check(s, '[지금 조건] = 1,200,000원', /\[지금 조건[^\]]*\]\n1,200,000원/.test(all), '1,200,000원', /\[지금 조건[^\]]*\]\n[^\n]*/.exec(all)?.[0]);
  check(s, '[통화] 끝이 상담원 첫 말(주문은 조건으로만)', /상담원: 벽시계 주문이시죠/.test(all), '첫 말 포함', (/\[통화[^\]]*\][\s\S]*?(?=\n\n|$)/.exec(all)?.[0] ?? ''));
  const os = await orders();
  const o = os.find((x) => x.item.name === '세 번 우는 벽시계');
  check(s, '주문 2건째: 원 1,200,000', os.length === 2 && o?.pay === 'won' && o?.how === '1,200,000원', { n: 2, pay: 'won', how: '1,200,000원' }, o && { n: os.length, pay: o.pay, how: o.how });
  check(s, '잔고 1,750,000 → 550,000', (await balance()) === bal0 - 1200000, bal0 - 1200000, await balance());
  const t = await popText();
  check(s, '완료 화면에 주문 뒤 상담원 말', t.includes('정각을 기다리세요'), '주문 뒤 말', t.slice(0, 200));
  const lg = await hslog();
  check(s, '시청 기록 주문 줄 2', (lg?.entries ?? []).filter((e) => e.k === 'buy').length === 2, 2, (lg?.entries ?? []).filter((e) => e.k === 'buy').map((e) => e.text));
  await closePop();
  await saveState(s);
}

// ── 15 소지품에서 A 상자 열기 → 시연 호출 턴이 잡힘 ──
{
  const s = step('A상자_열기');
  const a = (await orders()).find((x) => x.item.name === '붉은 리본 손전등');
  await click('[data-action="nav-tab"][data-value="items"]'); await sleep(400);
  await click(`[data-action="items-open"][data-value="${a.boxId}"]`); await sleep(400);
  const had = await page.locator('[data-action="hs-box-open"]').count();
  check(s, '상자 상세에 「열기」', had === 1, 1, had);
  await click('[data-action="hs-box-open"]'); await sleep(800);
  const o = (await orders()).find((x) => x.item.name === '붉은 리본 손전등');
  check(s, '연 응답 키 c2, 시연 호출 턴 = 지금 턴(2)+1 (설정 1~1)', o.openKey === 'c2' && JSON.stringify(o.dues) === '[3]', { openKey: 'c2', dues: [3] }, { openKey: o.openKey, dues: o.dues });
  const live = await liveNames();
  check(s, '상자가 빠지고 물건이 들어옴', live.includes('붉은 리본 손전등') && !live.some((n) => n.includes('붉은 리본') && n.startsWith('택배')), '물건만', live);
  await click('[data-action="items-close"]'); await sleep(300);
  await saveState(s);
}

// ── 16 방청 신청 ──
{
  const s = step('방청신청');
  await goHs();
  await click('.hs-menu [data-action="hs-pop"][data-value="aud"]'); await sleep(300);
  await click('[data-action="hs-agree"]'); await sleep(200);
  await click('[data-action="hs-aud"]'); await sleep(500);
  const aud = J(await vars(), '$hs_aud');
  check(s, '접수(기준 응답 c2)', aud?.anchor === 'c2' && /^\d{4}$/.test(aud.no), { anchor: 'c2' }, aud);
  await closePop();
  await saveState(s);
}

// ── 17 다음 턴 본편: C 상자 ARRIVE 한 번 · 연 A 물건 · 시연 호출(CALL) · 방청(AUDIENCE) 한 번씩 ──
let snapBeforeU3;
{
  const s = step('다음턴_시연호출_방청_도착');
  await closeWin(page); await sleep(800);
  snapBeforeU3 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const out = await mainRequest('휴대폰을 주머니에 넣고 손전등을 켜 본다.', 'u3');
  writeReq(s, out);
  const all = textOf(out);
  const inv = inventoryOf(out);
  const blk = hsBlockOf(out);
  check(s, 'ARRIVE 한 번(C 상자)', count(all, ARRIVE_MARK) === 1, 1, count(all, ARRIVE_MARK));
  check(s, '새로 산 것: C 상자(1,200,000)와 연 A 물건', /just bought[^\n]*택배 상자\(미개봉\) · 세 번 우는 벽시계/.test(inv) && /just bought[^\n]*붉은 리본 손전등/.test(inv), 'C 상자 · A 물건', /This turn:[^\n]*/.exec(inv)?.[0]);
  check(s, '상자를 연 턴에 A 의 구매(250,000원)가 새 구매 사건으로 다시 나오지 않음 (구매 사건은 주문한 턴에 한 번, 지침 3-C)', !/붉은 리본 손전등 \(paid[^)]*\)[^;]*250,000/.test(/This turn:[^\n]*/.exec(inv)?.[0] ?? ''), '없음', /This turn:[^\n]*/.exec(inv)?.[0]);
  check(s, '[망상홈쇼핑] 블록에 시연 호출(CALL) 한 번', count(blk, 'calls the user in for the demonstration owed on 「붉은 리본 손전등」') === 1, 1, blk);
  check(s, '[망상홈쇼핑] 블록에 방청(AUDIENCE) 한 번', count(blk, 'applied for a studio audience seat') === 1, 1, blk.slice(0, 300));
  const ctx = hsCtxOf(out);
  check(s, '시청 기록: 주문 줄 2, 끊음 줄 1', count(ctx, '"type":"user_order"') === 2 && count(ctx, '먼저 전화를 끊었다') === 1, { order: 2, hang: 1 }, { order: count(ctx, '"type":"user_order"'), hang: count(ctx, '먼저 전화를 끊었다') });
  check(s, '[망상홈쇼핑] 블록이 마지막 유저 메시지 바로 앞쪽에 있음', out.findIndex((m) => m.content.startsWith('[망상홈쇼핑]')) === out.map((m) => m.role).lastIndexOf('user') - 1, '유저 바로 앞', [out.findIndex((m) => m.content.startsWith('[망상홈쇼핑]')), out.map((m) => m.role).lastIndexOf('user')]);
  await botReply(CHAR3, 'c3');
  await sleep(300);
  await saveState(s);
}

// ── 18 그다음 턴: 시연 호출·방청·도착 모두 다시 안 감 ──
{
  const s = step('그다음턴_턴블록_되풀이없음');
  const out = await mainRequest('박수 소리가 멎기를 기다린다.', 'u4');
  writeReq(s, out);
  const all = textOf(out);
  check(s, '[망상홈쇼핑] 블록 없음', !hsBlockOf(out), '없음', hsBlockOf(out));
  check(s, 'ARRIVE 없음', count(all, ARRIVE_MARK) === 0, 0, count(all, ARRIVE_MARK));
  check(s, 'just bought 없음', !/just bought/.test(inventoryOf(out)), '없음', /This turn:[^\n]*/.exec(inventoryOf(out))?.[0] ?? '(없음)');
  await botReply(CHAR4, 'c4');
  await sleep(300);
  await goHs();
  await sleep(800);
  await saveState(s);
}

// ── 19 편성 끝 → 새로 고침: 지난 상품 피하기, 이번 편성 상품 ──
{
  const s = step('새로고침_편성2');
  const st0 = await show();
  for (let i = st0.at; i < 3; i++) { await click('[data-action="hs-next"]'); await sleep(900); }
  check(s, '방송 끝(at=3)', (await show()).at === 3, 3, (await show()).at);
  await queue(SHOW2);
  const n0 = await llmCount();
  const r = await click('[data-action="hs-refresh"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('자정 직전 특집'), null, { timeout: 15000 }).catch(() => {});
  await sleep(600);
  const reqs = await llmFrom(n0);
  writeReq(s, reqs[0] ?? [], SHOW2);
  const all = textOf(reqs[0] ?? []);
  check(s, '새로 고침 단추가 있고 호출 1회', r === true && reqs.length === 1, 1, { r, n: reqs.length });
  const avoid = /Previously shown here \(do not repeat\): ([^\n]*)/.exec(all)?.[1] ?? '';
  check(s, '피할 목록에 지난 편성 A·B·C 모두 (상점 문제 1과 비교)', ['붉은 리본 손전등', '웃는 얼굴 마스크팩', '세 번 우는 벽시계'].every((x) => avoid.includes(x)), 'A·B·C', avoid || '(절 없음)');
  const st = await show();
  check(s, '새 편성 3부, 지난 상품 목록에 A·B·C', st.parts.length === 3 && st.at === 0 && ['붉은 리본 손전등', '웃는 얼굴 마스크팩', '세 번 우는 벽시계'].every((x) => st.prev.includes(x)), 'prev A·B·C', st.prev);
  await saveState(s);
}

// ── 20 갈래: 상담원 응답 실패 → 내 말 되돌림 ──
{
  const s = step('갈래_상담원응답실패');
  await queue(); // 가짜 답 없음 → 실패
  await openCall(); // 첫 말도 실패 (말없이 넘어감)
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  const n0 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '우산 값 좀 깎아 주세요.');
  await sleep(2500); await idle(); await sleep(300);
  const n1 = await llmCount();
  const t = await popText();
  const log = await callLog();
  const inp = await page.evaluate(() => document.querySelector('[data-input="hs-op"]')?.value ?? '');
  check(s, '실패 안내가 창에 보임', t.includes('상담원과 연결되지 않았어요'), '안내', t.slice(0, 200));
  check(s, '내 말이 통화 칸에서 빠지고 입력칸에 되돌아옴', !log.some((x) => x.includes('우산 값 좀')) && inp === '우산 값 좀 깎아 주세요.', { log: '없음', input: '우산 값 좀 깎아 주세요.' }, { log, inp });
  check(s, '시청 기록에 실패한 말이 안 남음', !((await hslog())?.entries ?? []).some((e) => e.text.includes('우산 값 좀')), '없음', true);
  check(s, '호출 횟수 기록(재시도 포함)', n1 - n0 >= 1, '≥1', n1 - n0);
  await saveState(s);
}

// ── 21 맞교환 감정 → 말로 수락(<deal/>)인데 잔고가 모자람 ──
{
  const s = step('갈래_deal_잔고모자람');
  await click('[data-action="hs-pay"][data-value="barter"]'); await sleep(300);
  await click('[data-action="hs-offer"][data-value="i_mark"]'); await sleep(200);
  await queue(BARTER_D);
  const n0 = await llmCount();
  await click('[data-action="hs-appraise"]');
  await sleep(800); await idle(); await sleep(300);
  const req1 = (await llmFrom(n0))[0] ?? [];
  writeReq(s, req1, BARTER_D, '■ 감정\n');
  const a1 = textOf(req1);
  check(s, '감정 요청: [내민 물건]에 은 책갈피, 맞교환 절', a1.includes('[내민 물건') && a1.includes('은 책갈피|') && a1.includes('puts forward the belongings'), '내민 물건·BARTER', /\[내민 물건[^\]]*\]\n[^\n]*/.exec(a1)?.[0]);
  check(s, '지난 편성의 주문(A·C)이 지난 주문에 둘 다', a1.includes('붉은 리본 손전등|') && a1.includes('세 번 우는 벽시계|'), 'A·C', /\[이 손님의 지난 주문[^\]]*\]\n[^\n]*\n[^\n]*/.exec(a1)?.[0]);
  check(s, 'A 는 연 상태·시연 다녀옴 표시(지금 턴 > 호출 턴 3)', /붉은 리본 손전등\|[^\n]*상자를 열어 받음, 시연 다녀옴/.test(a1), '상자를 열어 받음, 시연 다녀옴', /붉은 리본 손전등\|[^\n]*/.exec(a1)?.[0]);
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(DEAL_D);
  const bal0 = await balance();
  const n1 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '좋아요, 그걸로 주문할게요.');
  await sleep(800); await idle(); await sleep(500);
  writeReq(s, (await llmFrom(n1))[0] ?? [], DEAL_D, '■ 말로 수락\n', '_2');
  check(s, '잔고가 모자라 주문 안 됨(돈·물건 그대로)', (await orders()).length === 2 && (await balance()) === bal0 && (await liveNames()).includes('은 책갈피'), { orders: 2, bal: bal0 }, { orders: (await orders()).length, bal: await balance() });
  const t = await popText();
  check(s, '화면에 잔고 모자람 안내', t.includes('잔고가 모자랍니다'), '안내', t.slice(0, 240));
  // 이어서 한마디 더: 상담원 요청이 「주문이 안 됐다」를 아나
  await queue(TALK_D_AFTER);
  const n2 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '여보세요? 주문 된 거예요?');
  await sleep(800); await idle(); await sleep(300);
  const req3 = (await llmFrom(n2))[0] ?? [];
  writeReq(s, req3, TALK_D_AFTER, '■ 수락 뒤 한마디\n', '_3');
  const a3 = textOf(req3);
  const callTxt = /\[통화 — [^\]]*\][\s\S]*$/.exec(req3.at(-1)?.content ?? '')?.[0] ?? '';
  // 사용자 결정 11-22 22:42: 주문이 안 들어간 <deal/> 의 수락하는 말과 「주문 받았습니다」는 시청 기록과 다음 상담원 요청 [통화]에서 뺀다
  check(s, '다음 상담원 요청 [통화]에 안 들어간 주문의 수락 말·「주문 받았습니다」가 없음 (사용자 11-22 22:42)', callTxt.includes('여보세요? 주문 된 거예요?') && !callTxt.includes('그걸로 주문할게요') && !callTxt.includes('주문 받았습니다'), '빠짐', callTxt.slice(0, 400));
  const asides = ((await hslog())?.entries ?? []).filter((e) => e.k === 'aside').map((e) => e.text);
  check(s, '본편으로 갈 시청 기록에도 수락 말·「주문 받았습니다」가 없음 (사용자 11-22 22:42)', !asides.some((x) => x.includes('그걸로 주문할게요') || x.includes('주문 받았습니다')) && asides.some((x) => x.includes('여보세요? 주문 된 거예요?')), '빠짐', asides.slice(-4));
  await saveState(s);
}

// ── 22 갈래: 가계부 끔 → 돈 없는 통화. 돈이 섞인 조건 + <deal/> / 돈 없는 조건 + <deal/> ──
{
  const s = step('갈래_가계부끔_deal');
  await closePop();
  await page.evaluate(() => { window.__chat.scriptstate.$st_col_wallet = 'off'; window.__chat.scriptstate.$hs_op_hello = '0'; });
  await click('[data-action="hs-next"]'); await sleep(1000);
  check(s, '2부(따뜻한 손난로)로', (await show()).at === 1, 1, (await show()).at);
  const n0 = await llmCount();
  await openCall();
  check(s, '설정 「상담원 첫 말」 끔: 전화 걸어도 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
  const won = await page.evaluate(() => document.querySelector('[data-action="hs-pay"][data-value="won"]')?.disabled);
  check(s, '원 결제 단추 잠김(가계부 꺼짐)', won === true, true, won);
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(TALK_E_MONEY);
  const n1 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '돈 말고 다른 걸로 할게요. 주문해 주세요.');
  await sleep(800); await idle(); await sleep(400);
  const req1 = (await llmFrom(n1))[0] ?? [];
  writeReq(s, req1, TALK_E_MONEY, '■ 돈 섞인 조건 + deal\n');
  const a1 = textOf(req1);
  check(s, '요청에 돈 없는 통화 절(OPERATOR_NO_MONEY)', a1.includes('This call cannot take money'), 'NO_MONEY', a1.includes('This call cannot take money'));
  check(s, '돈 섞인 조건 + <deal/>: 주문 안 됨', (await orders()).length === 2, 2, (await orders()).length);
  const t1 = await page.evaluate(() => [...document.querySelectorAll('.hs-pop .hs-terms, .hs-pop .hs-warn')].map((e) => e.innerText).join(' / '));
  check(s, '돈 몫을 뺀 나머지 조건(머리카락 한 줌)이 조건 칸에 남거나, 안 된 까닭이 안내로 보임', /머리카락 한 줌/.test(t1) || /가계부|돈으로|주문이 되지/.test(t1), '조건 또는 안내', t1);
  await queue(TALK_E_OTHER);
  await say('[data-action="hs-op"]', 'hs-op', '머리카락만이면 좋아요.');
  await sleep(800); await idle(); await sleep(600);
  const os = await orders();
  const o = os.find((x) => x.item.name === '따뜻한 손난로');
  check(s, '돈 없는 조건 + <deal/>: 주문(흥정, 머리카락 한 줌), 가계부 줄 안 생김', os.length === 3 && o?.pay === 'talk' && o?.how === '머리카락 한 줌', { pay: 'talk', how: '머리카락 한 줌' }, o && { pay: o.pay, how: o.how, n: os.length });
  await saveState(s);
}

// ── 23 갈래: 설정 「주문 뒤 상담원 말」 끔 → 단추로 시연 주문 ──
{
  const s = step('갈래_주문뒤말끔_시연주문');
  await closePop();
  await page.evaluate(() => { delete window.__chat.scriptstate.$st_col_wallet; window.__chat.scriptstate.$hs_op_done = '0'; });
  await click('[data-action="hs-next"]'); await sleep(1000);
  await openCall();
  await click('[data-action="hs-pay"][data-value="appear"]'); await sleep(300);
  const n0 = await llmCount();
  await click('[data-action="hs-order"]'); await sleep(1200);
  const os = await orders();
  const o = os.find((x) => x.item.name === '이름표 스티커');
  check(s, '시연 주문(출연 1, 값 0)', o?.pay === 'appear' && o?.n === 1 && o?.how === '다음 방송 시연 참여', { pay: 'appear', n: 1 }, o && { pay: o.pay, n: o.n, how: o.how });
  check(s, '주문 뒤 말 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
  await closePop();
  await saveState(s);
}

// ── 24 갈래: 주문한 턴의 본편 응답(c1)을 다시 굴림 → 주문·돈·상자가 같이 사라지나 ──
{
  const s = step('갈래_주문턴_다시굴리기');
  const c = JSON.parse(JSON.stringify(snapAfterOrderA));
  c.message[1] = { role: 'char', data: CHAR1, chatId: 'c1b' };
  await page.evaluate((c) => { window.__chat = c; }, c);
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  check(s, '잔고 2,000,000 으로 돌아옴', (await balance()) === 2000000, 2000000, await balance());
  const out = await mainRequest('앱 화면을 끄고 골목을 둘러본다.', 'u2');
  writeReq(s, out);
  const all = textOf(out);
  const inv = inventoryOf(out);
  const ctx = hsCtxOf(out);
  check(s, 'ARRIVE 없음 · 상자 없음', count(all, ARRIVE_MARK) === 0 && !inv.includes('택배 상자'), { arrive: 0, box: false }, { arrive: count(all, ARRIVE_MARK), box: inv.includes('택배 상자') });
  check(s, '시청 기록에서 주문 줄 빠짐', count(ctx, '"type":"user_order"') === 0, 0, count(ctx, '"type":"user_order"'));
  check(s, '본편 상태창 잔고가 2,000,000', /\|2000000\]|2,000,000/.test(all), '2000000', /\[▣[^\n]*\]/.exec(all.split('SYSTEM PROMPT').at(-1))?.[0]);
  check(s, '(기록) 주문을 받은 상담원 말은 남는가', true, '-', { op: ctx.includes('주문 받았습니다') });
  await saveState(s);
}

// ── 25 갈래: 설정 끔($hs_on=0) → 시연 호출·방청·시청 기록이 본편에서 빠짐 ──
{
  const s = step('갈래_설정끔');
  const c = JSON.parse(JSON.stringify(snapBeforeU3));
  c.scriptstate.$hs_on = '0';
  await page.evaluate((c) => { window.__chat = c; }, c);
  const out = await mainRequest('휴대폰을 주머니에 넣고 손전등을 켜 본다.', 'u3');
  writeReq(s, out);
  const all = textOf(out);
  check(s, '[망상홈쇼핑] 블록 없음', !hsBlockOf(out), '없음', hsBlockOf(out).slice(0, 120));
  check(s, '시청 기록 없음', !hsCtxOf(out), '없음', !!hsCtxOf(out));
  check(s, '(기록) 끈 뒤에도 ARRIVE 가 가나', true, '-', count(all, ARRIVE_MARK));
  await saveState(s);
}
let page2;

// ════════════════════════════════════════════════════════════════════
// 2차 갈래 (26~). 1차(01~25)와 같은 틀에서 상태만 바꿔 돈다.
// ════════════════════════════════════════════════════════════════════
const swapChat = async (c) => { await closeWin(page).catch(() => {}); await page.evaluate((c) => { window.__chat = c; }, JSON.parse(JSON.stringify(c))); await sleep(200); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const infoText = () => page.evaluate(() => [...document.querySelectorAll('.hs-info, .hs-pop .hs-warn')].map((e) => e.innerText).join(' / '));
const SHOW2_KEY_WAIT = () => page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('자정 직전 특집'), null, { timeout: 15000 }).catch(() => {});
const chatKinds = async () => ((await hslog())?.entries ?? []);

// ── 26 갈래: 내 채팅 응답 실패 → 내 줄·입력은? 시청 기록(본편)에 남나 ──
{
  const s = step('갈래_내채팅_응답실패');
  await swapChat(snapBeforeU3);
  await goHs();
  await sleep(500);
  const before = (await chatKinds()).filter((e) => e.k === 'say' && e.me).length;
  await queue(); // 가짜 답 없음 → 실패
  const n0 = await llmCount();
  await say('[data-action="hs-say"]', 'hs-say', '실패할 채팅 한 줄');
  await page.waitForFunction(() => !document.querySelector('.hs-in input[disabled]'), null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const calls = (await llmCount()) - n0;
  const inp = await page.evaluate(() => document.querySelector('[data-input="hs-say"]')?.value ?? '');
  const shownMine = await page.evaluate(() => [...document.querySelectorAll('.hs-chlog p.me')].map((p) => p.innerText));
  const info = await infoText();
  const lg = await chatKinds();
  const mine = lg.filter((e) => e.k === 'say' && e.me);
  check(s, '실패 안내가 보임', info.includes('채팅이 전달되지 않았어요'), '안내', info);
  check(s, '실패한 채팅이 입력칸으로 돌아옴 (상담원 실패·상점·포인트몰 상담과 같은 처리, src/ui/homeshop.ts:545-550)', inp === '실패할 채팅 한 줄', '실패할 채팅 한 줄', inp);
  check(s, '실패한 채팅이 시청 기록(본편으로 가는 user_chat)에 남지 않음 (창은 「전달되지 않았어요」라고 함)', mine.length === before && !mine.some((e) => e.text.includes('실패할 채팅')), { before, after: before }, { before, after: mine.length, texts: mine.map((e) => e.text) });
  check(s, '(기록) 방송 채팅 칸에 내 줄이 남는가 · 호출 수', true, '-', { shownMine, calls });
  await saveState(s);
  // 다음 턴 본편에 그 줄이 「방에서 공개된 내 채팅」으로 가는지
  await closeWin(page); await sleep(500);
  const out = await mainRequest('휴대폰을 주머니에 넣고 손전등을 켜 본다.', 'u3');
  writeReq(s, out, undefined, '', '_본편');
  const ctx = hsCtxOf(out);
  check(s, '다음 본편 시청 기록에 실패한 채팅이 user_chat 으로 가지 않음', !ctx.includes('실패할 채팅 한 줄'), '없음', /\{[^{}]*실패할 채팅 한 줄[^{}]*\}/.exec(ctx)?.[0] ?? '(없음)');
  await botReply(CHAR3, 'c3'); await sleep(1500);
  const later = (await chatKinds()).filter((e) => e.text.includes('실패할 채팅'));
  check(s, '본편 응답이 붙은 뒤에도 시청 기록에 실패한 채팅이 들어오지 않음', later.length === 0, 0, later);
}

// ── 27 새 편성(편성 2)을 받아 둔다: 이후 갈래의 바탕 ──
let snapShow2;
{
  const s = step('바탕_편성2');
  await swapChat(snapBeforeU3);
  await page.evaluate(() => { const st = JSON.parse(window.__chat.scriptstate.$hs_show); st.at = st.parts.length; window.__chat.scriptstate.$hs_show = JSON.stringify(st); });
  await goHs();
  await queue(SHOW2);
  await click('[data-action="hs-refresh"]');
  await SHOW2_KEY_WAIT();
  await sleep(600);
  const st = await show();
  check(s, '편성 2 받음(1부 젖지 않는 우산)', st.parts[0]?.item.name === '젖지 않는 우산' && st.at === 0, '우산 1부', st.parts.map((p) => p.item.name));
  // 이후 갈래(소지품 끔 원 주문·폰 흥정 주문)가 잔고에 막히지 않게 시작 잔고를 늘려 둔다
  await page.evaluate(() => { const w = JSON.parse(window.__chat.scriptstate.$st_wallet); w.start += 5000000; window.__chat.scriptstate.$st_wallet = JSON.stringify(w); });
  snapShow2 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  await saveState(s);
}

// ── 28 갈래: 말로 수락했는데 상담원 답의 조건이 비어 있음(<terms>none</terms> + <deal/>) ──
{
  const s = step('갈래_deal_조건없음');
  await queue('<operator>\n우산 말씀이시죠.\n</operator>');
  await openCall();
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(`<operator>\n팔십만 원이면 보내 드리죠.\n</operator>\n<terms>\nmoney|800000\n</terms>`);
  await say('[data-action="hs-op"]', 'hs-op', '우산 얼마예요?');
  await sleep(500); await idle(); await sleep(300);
  const NONE_DEAL = `<operator>\n좋습니다, 주문 받았습니다.\n</operator>\n<terms>\nnone\n</terms>\n<deal/>`;
  await queue(NONE_DEAL);
  const n0 = await llmCount();
  await say('[data-action="hs-op"]', 'hs-op', '좋아요, 그걸로 주문할게요.');
  await sleep(800); await idle(); await sleep(500);
  writeReq(s, (await llmFrom(n0))[0] ?? [], NONE_DEAL);
  const log = await callLog();
  const info = await infoText();
  const t = await popText();
  check(s, '주문은 안 들어감', (await orders()).every((o) => o.item.name !== '젖지 않는 우산'), '없음', (await orders()).map((o) => o.item.name));
  check(s, '내가 한 말이 통화 칸에서 사라지면 까닭이 창에 보임 (사용자 11-22 22:42 「막힌 까닭은 창의 안내 그대로」)', log.some((x) => x.includes('그걸로 주문할게요')) || info.length > 0, '내 말이 남거나 안내', { log, info });
  check(s, '(기록) 조건 칸', true, '-', /상담원 조건\n[^\n]*/.exec(t)?.[0] ?? '(조건 칸 없음)');
  // 같은 꼴: 금액을 우리말로 적은 답 (money|팔십만 원 + <deal/>)
  await queue(`<operator>\n그럼 그 값에 주문 받겠습니다.\n</operator>\n<terms>\nmoney|팔십만 원\n</terms>\n<deal/>`);
  await say('[data-action="hs-op"]', 'hs-op', '팔십만 원 맞죠? 주문해 주세요.');
  await sleep(800); await idle(); await sleep(500);
  const log2 = await callLog();
  const info2 = await infoText();
  check(s, '금액을 「팔십만 원」으로 적은 <deal/>: 말이 사라지면 까닭이 보임', log2.some((x) => x.includes('주문해 주세요')) || info2.length > 0, '내 말이 남거나 안내', { log: log2, info: info2 });
  await closePop();
  await saveState(s);
}

// ── 29 갈래: 약조(other) 주문 → 다음 턴 → 상자 열기 → 약조 받으러 오는 턴(PROMISE) 한 번 · 지난 주문 줄 · 주문 조회 ──
let snapOpenedE;
{
  const s = step('약조주문_열기_PROMISE');
  await swapChat(snapShow2);
  await goHs();
  await click('[data-action="hs-next"]'); await sleep(1000); // 2부 손난로
  check(s, '2부(따뜻한 손난로)', (await show()).at === 1, 1, (await show()).at);
  await queue('<operator>\n손난로요. 손이 차시군요.\n</operator>');
  await openCall();
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(`<operator>\n돈은 필요 없어요. 손님 그림자 한 뼘이면 됩니다. 주문 받았습니다.\n</operator>\n<terms>\nother|그림자 한 뼘\n</terms>\n<deal/>`);
  await say('[data-action="hs-op"]', 'hs-op', '돈 말고 다른 걸로 할 수 있어요? 좋아요, 주문해 주세요.');
  await sleep(800); await idle(); await sleep(600);
  const o = (await orders()).find((x) => x.item.name === '따뜻한 손난로');
  check(s, '주문(흥정, 약조 「그림자 한 뼘」)', o?.pay === 'talk' && o?.how === '그림자 한 뼘' && o?.terms?.other === '그림자 한 뼘', { how: '그림자 한 뼘' }, o && { pay: o.pay, how: o.how, terms: o.terms });
  await closePop();
  // 다음 턴 (u3 → c3)
  await closeWin(page); await sleep(500);
  const out1 = await mainRequest('휴대폰을 주머니에 넣는다.', 'u3');
  writeReq(s, out1, undefined, '', '_주문턴본편');
  check(s, '주문 턴: ARRIVE 한 번, PROMISE 없음(열기 전)', count(textOf(out1), ARRIVE_MARK) === 1 && !hsBlockOf(out1).includes('comes to collect'), { arrive: 1, promise: false }, { arrive: count(textOf(out1), ARRIVE_MARK), blk: hsBlockOf(out1) });
  await botReply(CHAR3, 'c3'); await sleep(300);
  // 상자 열기 (c3 뒤)
  await openWin(page); await sleep(300);
  await click('[data-action="nav-tab"][data-value="items"]'); await sleep(400);
  const oe = (await orders()).find((x) => x.item.name === '따뜻한 손난로');
  await click(`[data-action="items-open"][data-value="${oe.boxId}"]`); await sleep(400);
  await click('[data-action="hs-box-open"]'); await sleep(800);
  await click('[data-action="items-close"]'); await sleep(300);
  const oe2 = (await orders()).find((x) => x.item.name === '따뜻한 손난로');
  const turnNow = await page.evaluate(() => window.__chat.message.filter((m) => m.role === 'user').length);
  check(s, '연 응답 키 c3, 약조 받으러 오는 턴 = 지금 턴+1, 시연 없음', oe2.openKey === 'c3' && oe2.owe === turnNow + 1 && oe2.dues.length === 0, { openKey: 'c3', owe: turnNow + 1, dues: [] }, { openKey: oe2.openKey, owe: oe2.owe, dues: oe2.dues });
  // 주문 조회 화면: 약조 내역 대기
  await goHs();
  await click('[data-action="hs-page"][data-value="orders"]'); await sleep(400);
  const pageTxt = await page.evaluate(() => document.querySelector('.hs-wrap')?.innerText ?? '');
  check(s, '주문 조회에 약조 내역 「그림자 한 뼘」 대기', /약조 내역[\s\S]*그림자 한 뼘[\s\S]*대기/.test(pageTxt), '대기', pageTxt.slice(pageTxt.indexOf('약조'), pageTxt.indexOf('약조') + 80));
  await click('[data-action="hs-page"][data-value=""]'); await sleep(300);
  snapOpenedE = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  await closeWin(page); await sleep(500);
  const out2 = await mainRequest('손난로를 꺼내 쥔다.', 'u4');
  writeReq(s, out2, undefined, '', '_약조턴본편');
  const blk = hsBlockOf(out2);
  check(s, '약조 턴 본편: [망상홈쇼핑] 블록에 PROMISE 한 번(손난로·그림자 한 뼘)', count(blk, 'comes to collect what the user promised') === 1 && blk.includes('「따뜻한 손난로」') && blk.includes('그림자 한 뼘'), 1, blk);
  check(s, '약조 턴 본편: 손난로의 숨은 진실(체온을 옮기는)이 쓰지 않은 턴엔 안 감 (items.ts:982)', !textOf(out2).includes('체온을 옮기는 주머니'), '없음', textOf(out2).includes('체온을 옮기는 주머니'));
  check(s, '약조 턴 본편: 연 물건이 just bought 로 다시 감(1차 misread·DO NOT CHANGE, 기록만)', true, '-', /This turn:[^\n]*/.exec(inventoryOf(out2))?.[0] ?? '(없음)');
  await botReply(CHAR4, 'c4'); await sleep(300);
  const out3 = await mainRequest('계속 걷는다.', 'u5');
  writeReq(s, out3, undefined, '', '_그다음턴');
  check(s, '그다음 턴: PROMISE 다시 안 감', !hsBlockOf(out3).includes('comes to collect'), '없음', hsBlockOf(out3));
  await botReply(CHAR4.replace('12:10', '12:20'), 'c5'); await sleep(300);
  // 상담원 요청의 지난 주문 줄: 약조 받아 감
  await goHs();
  const stx = await show();
  if (stx.at >= stx.parts.length) { await queue(SHOW1); await click('[data-action="hs-refresh"]'); await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('금요 심야 특가'), null, { timeout: 15000 }).catch(() => {}); await sleep(600); }
  await queue('<operator>\n또 오셨네요.\n</operator>');
  const n0 = await llmCount();
  await openCall();
  const req = (await llmFrom(n0))[0] ?? [];
  writeReq(s, req, undefined, '', '_다음부첫말');
  const a = textOf(req);
  check(s, '상담원 [지난 주문]: 손난로|그림자 한 뼘|상자를 열어 받음, 약조 「그림자 한 뼘」 받아 감', /따뜻한 손난로\|그림자 한 뼘\|상자를 열어 받음, 약조 「그림자 한 뼘」 받아 감/.test(a), '받아 감', /따뜻한 손난로\|[^\n]*/.exec(a)?.[0] ?? '(없음)');
  await closePop();
  await saveState(s);
}

// ── 30 갈래: 상자를 연 응답(c3)을 다시 굴림 → 상자 미개봉으로, 물건 빠짐, 약조 안 걸림 ──
{
  const s = step('갈래_상자연응답_다시굴리기');
  const c = clone(snapOpenedE);
  const i = c.message.findIndex((m) => m.chatId === 'c3');
  c.message[i] = { role: 'char', data: CHAR3.replace('11:58', '11:59'), chatId: 'c3b' };
  await swapChat(c);
  await page.evaluate(async (i) => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: i }); }, i);
  await sleep(300);
  const live = await liveNames();
  check(s, '손난로 상자가 미개봉으로 돌아오고 물건은 빠짐', live.some((n) => n.startsWith('택배 상자(미개봉)') && n.includes('손난로')) && !live.includes('따뜻한 손난로'), '상자만', live);
  const out = await mainRequest('손난로를 꺼내 쥔다.', 'u4');
  writeReq(s, out);
  check(s, 'PROMISE 가 안 감(연 일이 없던 일)', !hsBlockOf(out).includes('comes to collect'), '없음', hsBlockOf(out));
  check(s, 'ARRIVE 도 안 감(주문은 그 전 턴)', count(textOf(out), ARRIVE_MARK) === 0, 0, count(textOf(out), ARRIVE_MARK));
  await botReply(CHAR4, 'c4'); await sleep(300);
  await openWin(page); await sleep(300);
  await click('[data-action="nav-tab"][data-value="items"]'); await sleep(400);
  const oe = (await orders()).find((x) => x.item.name === '따뜻한 손난로');
  await click(`[data-action="items-open"][data-value="${oe.boxId}"]`); await sleep(400);
  const btn = await page.locator('[data-action="hs-box-open"]').count();
  check(s, '돌아온 상자를 다시 열 수 있음', btn === 1, 1, btn);
  await click('[data-action="items-close"]'); await sleep(300);
  await saveState(s);
}

// ── 31 갈래: 주문 단추 연타 (시연만 상품) → 주문 1건, 주문 뒤 말 1회, 실패 안내 안 뜸 ──
{
  const s = step('갈래_주문단추_연타');
  await swapChat(snapShow2);
  await goHs();
  await click('[data-action="hs-next"]'); await sleep(900);
  await click('[data-action="hs-next"]'); await sleep(900); // 3부 이름표 스티커(시연만)
  check(s, '3부(이름표 스티커)', (await show()).at === 2, 2, (await show()).at);
  await queue('<operator>\n이름표요.\n</operator>');
  await openCall();
  await click('[data-action="hs-pay"][data-value="appear"]'); await sleep(300);
  await queue('<operator>\n이름 잘 붙이세요.\n</operator>', '<operator>\n두 번째 말.\n</operator>');
  const n0 = await llmCount();
  await page.evaluate(() => { const b = document.querySelector('[data-action="hs-order"]'); b.click(); b.click(); b.click(); });
  await sleep(1500); await idle(); await sleep(500);
  const os = (await orders()).filter((x) => x.item.name === '이름표 스티커');
  const calls = (await llmCount()) - n0;
  const box = (await liveNames()).filter((n) => n.includes('이름표 스티커'));
  check(s, '주문 1건 · 상자 1개', os.length === 1 && box.length === 1, { orders: 1, box: 1 }, { orders: os.length, box });
  check(s, '주문 뒤 상담원 말 1회', calls === 1, 1, calls);
  await closePop();
  const info = await infoText();
  check(s, '닫은 뒤 방송 화면에 「주문이 되지 않았어요」가 안 남음', !info.includes('주문이 되지 않았어요'), '없음', info);
  const lg = (await chatKinds()).filter((e) => e.k === 'buy');
  check(s, '시청 기록 주문 줄 1', lg.filter((e) => e.text.includes('이름표 스티커')).length === 1, 1, lg.map((e) => e.text));
  await saveState(s);
}

// ── 32 갈래: 페이지 새로고침(같은 채팅으로 다시 띄움) → 편성·주문·잠금 그대로, 호출 없음 ──
{
  const s = step('갈래_페이지새로고침');
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const store = await page.evaluate(() => { const o = {}; for (const k of Object.keys(window.__store)) if (k.startsWith('p:goei:data-') || k === 'p:goei:prefs') o[k] = window.__store[k]; return o; });
  const before = { at: (await show()).at, orders: (await orders()).length };
  await page.close();
  ({ page: page2 } = await boot(b, fx, saved, 'pc', { store }));
  page = page2;
  const n0 = await llmCount();
  await goHs();
  await sleep(800);
  const st = await show();
  check(s, '편성 같은 부, 주문 수 같음', st.at === before.at && (await orders()).length === before.orders, before, { at: st.at, orders: (await orders()).length });
  check(s, '다시 띄워 열어도 편성 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
  const callBtn = await page.evaluate(() => { const b = document.querySelector('.hs-ord .call'); return { dis: b?.disabled, t: b?.textContent }; });
  check(s, '주문한 부는 「주문 완료」로 잠김', callBtn.dis === true && callBtn.t.includes('주문 완료'), '주문 완료', callBtn);
  await saveState(s);
}

// ── 33 갈래: 흥정 중 페이지 새로고침 → 통화(조건)는? ──
{
  const s = step('갈래_통화중_새로고침');
  await swapChat(snapShow2);
  await goHs();
  await queue('<operator>\n우산입니다.\n</operator>');
  await openCall();
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(`<operator>\n칠십만 원.\n</operator>\n<terms>\nmoney|700000\n</terms>`);
  await say('[data-action="hs-op"]', 'hs-op', '깎아 주세요.');
  await sleep(500); await idle(); await sleep(300);
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
  const store = await page.evaluate(() => { const o = {}; for (const k of Object.keys(window.__store)) if (k.startsWith('p:goei:data-') || k === 'p:goei:prefs') o[k] = window.__store[k]; return o; });
  await page.close();
  ({ page: page2 } = await boot(b, fx, saved, 'pc', { store }));
  page = page2;
  await goHs();
  await queue('<operator>\n여보세요, 우산 주문이시죠.\n</operator>');
  const n0 = await llmCount();
  await openCall();
  const req = (await llmFrom(n0))[0] ?? [];
  writeReq(s, req, undefined, '', '_다시건첫말');
  const t = await popText();
  check(s, '(기록) 새로고침 뒤 다시 걸면 첫 말을 또 부르나 · 조건이 남나 · 요청 [통화]', true, '-', { hello: req.length > 0, terms: /상담원 조건\n[^\n]*/.exec(t)?.[0] ?? '(없음)', call: /\[통화[^\]]*\]\n[\s\S]*$/.exec(req.at(-1)?.content ?? '')?.[0]?.slice(0, 200) });
  const lg = (await chatKinds()).filter((e) => e.k === 'aside').map((e) => `${e.who}:${e.text}`);
  check(s, '(기록) 시청 기록에는 새로고침 전 흥정 말이 남음', true, '-', lg.slice(-4));
  await closePop();
  await saveState(s);
}

// ── 34 갈래: 소지품 끔($it_on 0, 가계부는 켬) → 원 결제 주문 ──
{
  const s = step('갈래_소지품끔_원주문');
  const c = clone(snapShow2);
  c.scriptstate.$it_on = '0';
  await swapChat(c);
  await goHs();
  await queue('<operator>\n우산입니다.\n</operator>');
  await openCall();
  const won = await page.evaluate(() => document.querySelector('[data-action="hs-pay"][data-value="won"]')?.disabled);
  await click('[data-action="hs-pay"][data-value="won"]'); await sleep(300);
  await queue('<operator>\n상자는 곁에 있습니다.\n</operator>');
  const bal0 = await balance();
  await click('[data-action="hs-order"]'); await sleep(1200); await idle();
  const os = (await orders()).filter((x) => x.item.name === '젖지 않는 우산');
  const bal1 = await balance();
  const t = await popText();
  check(s, '(기록) 원 결제 단추가 열려 있나 · 주문 됐나 · 잔고', true, '-', { wonDisabled: won, orders: os.length, bal0, bal1, done: t.includes('택배 상자가 소지품에 도착했습니다') });
  await closePop();
  await closeWin(page); await sleep(500);
  const out = await mainRequest('주변을 둘러본다.', 'u3');
  writeReq(s, out);
  const all = textOf(out);
  // 상자를 열 길: 소지품 탭에서 상자가 보이나
  await openWin(page); await sleep(300);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-action="nav-tab"]')].map((b) => b.dataset.value));
  await click('[data-action="nav-tab"][data-value="items"]'); await sleep(500);
  const boxCell = os[0] ? await page.locator(`[data-action="items-open"][data-value="${os[0].boxId}"]`).count() : 0;
  const itemsTxt = await page.evaluate(() => (document.querySelector('.gx-body, .gx')?.innerText ?? '').slice(0, 300));
  check(s, '돈을 냈으면 본편이 그 주문(받는 법 ARRIVE)을 알거나, 소지품 끔이면 주문이 막혀야 함 (사용자 11-16 「주문하면 상자가 소지품에, 그 턴 ARRIVE 한 번」)', os.length === 0 || count(all, ARRIVE_MARK) === 1, '막히거나 ARRIVE 1', { orders: os.length, arrive: count(all, ARRIVE_MARK), userOrderLine: hsCtxOf(out).includes('젖지 않는 우산') });
  check(s, '돈을 냈으면 상자를 열 길이 있어야 함 (소지품 화면에 상자 칸)', os.length === 0 || boxCell > 0, '상자 칸 있음', { boxCell, tabs, itemsTxt });
  await closeWin(page).catch(() => {});
  await saveState(s);
}

// ── 35 갈래: 편성 응답 실패 · 빈 답 · 꼴 틀린 답 · 실패 뒤 성공 ──
{
  const s = step('갈래_편성응답실패');
  const c = clone(snapShow2);
  const st0 = JSON.parse(c.scriptstate.$hs_show); st0.at = st0.parts.length; c.scriptstate.$hs_show = JSON.stringify(st0);
  await swapChat(c);
  await goHs();
  // ① 답 없음
  await queue();
  let n0 = await llmCount();
  await click('[data-action="hs-refresh"]');
  await page.waitForFunction(() => !!document.querySelector('.hs-err'), null, { timeout: 20000 }).catch(() => {});
  await sleep(500);
  const calls1 = (await llmCount()) - n0;
  const err1 = await page.evaluate(() => document.querySelector('.hs-err')?.innerText ?? '');
  const stA = await show();
  check(s, '실패: 안내·「다시 연결」, 편성 그대로(편성 2, 끝난 채)', !!err1 && err1.includes('다시 연결') && stA.parts[0]?.item.name === '젖지 않는 우산' && stA.at === stA.parts.length, '안내·그대로', { err1, at: stA.at });
  check(s, '(기록) 실패 한 번에 부른 수(형식 재시도 × 자동 다시 연결)', true, '-', calls1);
  // ② 빈 답 · 꼴 틀린 답(<shelf> 만, <cue> 없음)
  await queue('', '', '', '');
  n0 = await llmCount();
  await click('.hs-err [data-action="hs-refresh"]');
  await sleep(500);
  await page.waitForFunction(() => !!document.querySelector('.hs-err') && !document.querySelector('.hs-err')?.innerText.includes('no mock'), null, { timeout: 20000 }).catch(() => {});
  check(s, '(기록) 빈 답 때 부른 수·화면', true, '-', { calls: (await llmCount()) - n0, err: await page.evaluate(() => document.querySelector('.hs-err')?.innerText ?? ''), prod: await page.evaluate(() => document.querySelector('.hs-prod')?.innerText ?? '') });
  const err2 = await page.evaluate(() => document.querySelector('.hs-err')?.innerText ?? '');
  check(s, '빈 답: 안내, 편성 그대로', !!err2 && (await show()).parts[0]?.item.name === '젖지 않는 우산', '안내', err2.slice(0, 120));
  const BAD = SHOW1.replace(/<cue>[\s\S]*<\/cue>/, '');
  await queue(BAD, BAD, BAD, BAD);
  await click('.hs-err [data-action="hs-refresh"]');
  await sleep(4000);
  const err3 = await page.evaluate(() => document.querySelector('.hs-err')?.innerText ?? '');
  check(s, '<cue> 빠진 답: 「<cue> 블록이 없어요」 안내, 편성 그대로', err3.includes('<cue>') && (await show()).parts[0]?.item.name === '젖지 않는 우산', 'ERR_NO_CUE', err3.slice(0, 160));
  // ③ 실패 뒤 성공 (첫 호출 실패 → 재시도에서 성공)
  await page.evaluate((r) => { window.__llm = [{ type: 'fail', result: 'x' }, { type: 'success', result: r }]; }, SHOW1);
  await click('.hs-err [data-action="hs-refresh"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('금요 심야 특가'), null, { timeout: 15000 }).catch(() => {});
  await sleep(600);
  const st = await show();
  const err4 = await page.evaluate(() => document.querySelector('.hs-err')?.innerText ?? '');
  check(s, '실패 뒤 다시 연결에서 성공: 새 편성, 안내 사라짐, 지난 상품에 편성 2', st.parts[0]?.item.name === '붉은 리본 손전등' && !err4 && st.prev.includes('젖지 않는 우산'), '편성 1 다시', { first: st.parts[0]?.item.name, err4, prev: st.prev });
  await saveState(s);
}

// ── 36 갈래: 사이트를 안 연 채 본편 3턴이 지난 뒤 연다 → 편성 몇 칸 넘어가나 ──
{
  const s = step('갈래_여러턴뒤_열기');
  const c = clone(snapShow2); // 1부, tk = 편성 받은 턴
  for (let k = 0; k < 3; k++) c.message.push({ role: 'user', data: `걷는다 ${k}`, chatId: `uz${k}` }, { role: 'char', data: CHAR2.replace('11:40', `11:4${k + 1}`), chatId: `cz${k}` });
  await swapChat(c);
  await goHs();
  await sleep(1500);
  const st = await show();
  check(s, '본편 3턴 뒤 열면 3칸 넘어감 (설정 설명 「턴이 한 번 진행될 때마다 편성이 한 칸 넘어가요」, src/core/setdef/homeshop.ts:68)', st.at === 3, 3, st.at);
  await saveState(s);
}

// ── 37 갈래: 자동 호출 「수동」 → 열어도 호출 없음, 새로 고침 단추로 1회 ──
{
  const s = step('갈래_자동호출_수동');
  const c = clone(snapShow2);
  const st0 = JSON.parse(c.scriptstate.$hs_show); st0.at = st0.parts.length; c.scriptstate.$hs_show = JSON.stringify(st0);
  c.message.push({ role: 'user', data: '걷는다', chatId: 'um' }, { role: 'char', data: CHAR2, chatId: 'cm' });
  c.scriptstate.$hs_sh_auto = 'manual';
  await swapChat(c);
  const n0 = await llmCount();
  await goHs();
  await sleep(1200);
  check(s, '수동: 열어도 편성 호출 없음', (await llmCount()) === n0, 0, (await llmCount()) - n0);
  const btn = await page.locator('.hs-reload[data-action="hs-refresh"]').count();
  check(s, '「새로 고침」 단추가 보임', btn === 1, 1, btn);
  await queue(SHOW1);
  await click('.hs-reload[data-action="hs-refresh"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('금요 심야 특가'), null, { timeout: 15000 }).catch(() => {});
  check(s, '새로 고침 1회로 편성', (await llmCount()) - n0 === 1, 1, (await llmCount()) - n0);
  // 자동(창을 열 때): 같은 상태에서 열면 1회
  const c2 = clone(c); delete c2.scriptstate.$hs_sh_auto;
  await swapChat(c2);
  await queue(SHOW1);
  const n1 = await llmCount();
  await goHs();
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_show || '').includes('금요 심야 특가'), null, { timeout: 15000 }).catch(() => {});
  await sleep(500);
  check(s, '자동: 끝난 편성에서 열면 1회', (await llmCount()) - n1 === 1, 1, (await llmCount()) - n1);
  // 같은 턴에 닫았다 다시 열면 또 안 부름
  await closeWin(page); await sleep(300);
  const n2 = await llmCount();
  await goHs(); await sleep(800);
  check(s, '같은 턴에 다시 열면 호출 없음', (await llmCount()) === n2, 0, (await llmCount()) - n2);
  await saveState(s);
}

// ── 38 갈래: 상시 노출 끔($hs_net 없음) — 표식 없는 응답 → 신호 없음 · 표식 있는 응답 → 열림 ──
{
  const s = step('갈래_접속표식');
  const c = clone(snapShow2);
  delete c.scriptstate.$hs_net;
  await swapChat(c);
  const n0 = await llmCount();
  await goHs(); await sleep(800);
  const t1 = await page.evaluate(() => document.querySelector('.hs-prod')?.innerText ?? '');
  check(s, '표식 없음: 「신호가 없습니다」, 전화 단추 잠김, 호출 없음', t1.includes('신호가 없습니다') && (await llmCount()) === n0 && (await page.evaluate(() => document.querySelector('.hs-ord .call')?.disabled)) === true, '신호 없음', t1.slice(0, 60));
  const c2 = clone(c);
  c2.message.push({ role: 'user', data: '앱을 다시 켠다', chatId: 'ut' }, { role: 'char', data: `화면이 다시 붉게 켜졌다.\n[shop: 망상홈쇼핑|@web:hs]\n${ST('11:50 PM', 2000000)}`, chatId: 'ct' });
  await swapChat(c2);
  await goHs(); await sleep(1200);
  const t2 = await page.evaluate(() => document.querySelector('.hs-prod')?.innerText ?? '');
  check(s, '표식 있는 응답 뒤: 방송이 보임(지금 방송 중)', t2.includes('지금 방송 중'), '방송 중', t2.slice(0, 60));
  await saveState(s);
}

// ── 39 갈래: 방청 신청 다음 턴을 다시 굴림 → AUDIENCE 다시 · 그다음 턴엔 안 감 ──
{
  const s = step('갈래_방청턴_다시굴리기');
  await swapChat(snapBeforeU3);
  const out1 = await mainRequest('휴대폰을 주머니에 넣고 손전등을 켜 본다.', 'u3');
  check(s, '방청 다음 턴: AUDIENCE 한 번', count(hsBlockOf(out1), 'applied for a studio audience seat') === 1, 1, hsBlockOf(out1).slice(0, 120));
  await botReply(CHAR3, 'c3'); await sleep(300);
  // 다시 굴리기: 리수는 옛 응답을 지우고 같은 요청을 다시 보낸다
  await page.evaluate(() => { window.__chat.message = window.__chat.message.filter((m) => m.chatId !== 'c3'); });
  const out2 = await page.evaluate(async () => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
    return out.map((m) => ({ role: m.role, content: String(m.content) }));
  });
  writeReq(s, out2, undefined, '', '_다시굴림');
  check(s, '다시 굴린 요청에도 AUDIENCE·CALL 이 다시 감(그 턴을 다시 쓰므로)', count(hsBlockOf(out2), 'applied for a studio audience seat') === 1 && count(hsBlockOf(out2), 'calls the user in for the demonstration') === 1, { aud: 1, call: 1 }, hsBlockOf(out2).slice(0, 200));
  await botReply(CHAR3, 'c3b'); await sleep(300);
  const out3 = await mainRequest('박수 소리가 멎기를 기다린다.', 'u4');
  check(s, '그다음 턴: AUDIENCE·CALL 없음', !hsBlockOf(out3), '없음', hsBlockOf(out3));
  await saveState(s);
}

// ── 40 갈래: 주문한 턴의 본편 응답(c1)을 지움 → 주문·돈·상자가 같이 사라지나 ──
{
  const s = step('갈래_주문턴_응답지우기');
  const c = clone(snapAfterOrderA);
  c.message = c.message.filter((m) => m.chatId !== 'c1');
  await swapChat(c);
  check(s, '잔고 2,000,000 으로', (await balance()) === 2000000, 2000000, await balance());
  const out = await mainRequest('다시 앱을 연다.', 'u2');
  writeReq(s, out);
  const ctx = hsCtxOf(out);
  check(s, 'ARRIVE·상자·주문 줄·「주문 받았습니다」 없음', count(textOf(out), ARRIVE_MARK) === 0 && !inventoryOf(out).includes('택배 상자') && !ctx.includes('user_order') && !ctx.includes('주문 받았습니다'), '없음', { arrive: count(textOf(out), ARRIVE_MARK), box: inventoryOf(out).includes('택배 상자'), order: ctx.includes('user_order'), op: ctx.includes('주문 받았습니다') });
  await saveState(s);
}

// ── 41 갈래: 상자를 연 뒤 시연 호출 턴에 망상홈쇼핑을 꺼 둠 → 다시 켜면 상담원 [지난 주문]은? ──
{
  const s = step('갈래_호출턴에_끔_다시켬');
  const c = clone(snapBeforeU3);
  c.scriptstate.$hs_on = '0';
  await swapChat(c);
  const out = await mainRequest('휴대폰을 주머니에 넣고 손전등을 켜 본다.', 'u3');
  check(s, '끈 턴: CALL 없음', !hsBlockOf(out), '없음', hsBlockOf(out));
  await botReply(CHAR3, 'c3'); await sleep(300);
  await page.evaluate(() => { delete window.__chat.scriptstate.$hs_on; const st = JSON.parse(window.__chat.scriptstate.$hs_show); st.at = st.parts.length; window.__chat.scriptstate.$hs_show = JSON.stringify(st); });
  await goHs();
  await queue(SHOW2);
  await click('[data-action="hs-refresh"]');
  await SHOW2_KEY_WAIT(); await sleep(500);
  await queue('<operator>\n우산입니다.\n</operator>');
  const n0 = await llmCount();
  await openCall();
  const a = textOf((await llmFrom(n0))[0] ?? []);
  check(s, '(기록) 꺼 둔 사이 지난 호출 턴: [지난 주문]의 A 상태', true, '-', /붉은 리본 손전등\|[^\n]*/.exec(a)?.[0] ?? '(없음)');
  const out2 = await (async () => { await closePop(); await closeWin(page); await sleep(300); return mainRequest('걷는다.', 'u4'); })();
  check(s, '(기록) 다시 켠 뒤 CALL 이 늦게라도 가나', true, '-', hsBlockOf(out2) || '(없음)');
  await saveState(s);
}

// ── 42 갈래: 상담원 답을 기다리는 동안 창을 닫고 다음 상품으로 → 늦게 온 답이 새 상품에 붙지 않음 ──
{
  const s = step('갈래_늦게온_상담원답');
  await swapChat(snapShow2);
  await goHs();
  await queue('<operator>\n우산입니다.\n</operator>');
  await openCall();
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await page.evaluate(() => { const f = window.risuai.runLLMModel; window.__slowOnce = true; window.risuai.runLLMModel = async (o) => { if (window.__slowOnce) { window.__slowOnce = false; await new Promise((r) => setTimeout(r, 3000)); } return f(o); }; });
  await queue(`<operator>\n육십만 원, 주문 받았습니다.\n</operator>\n<terms>\nmoney|600000\n</terms>\n<deal/>`);
  await page.fill('[data-input="hs-op"]', '육십만 원이면 주문할게요.'); await sleep(100);
  await page.evaluate(() => document.querySelector('[data-action="hs-op"]')?.click());
  await sleep(400);
  await closePop();
  await click('[data-action="hs-next"]'); await sleep(4500);
  const os = (await orders()).filter((x) => x.item.name === '젖지 않는 우산' || x.item.name === '따뜻한 손난로');
  check(s, '늦게 온 <deal/> 로 주문이 생기지 않음(지난 상품·새 상품 모두)', os.length === 0, 0, os.map((o) => o.item.name));
  const lg = (await chatKinds()).filter((e) => e.k === 'aside' && e.text.includes('육십만 원'));
  check(s, '(기록) 늦게 온 말이 시청 기록에 남나', true, '-', lg.map((e) => `${e.who}:${e.text}`));
  await queue('<operator>\n손난로입니다.\n</operator>');
  await openCall();
  const t = await popText();
  check(s, '새 상품 전화 창에 지난 상품 조건·말이 없음, 입력 잠김 아님', !t.includes('600,000') && !t.includes('육십만') && !(await page.evaluate(() => document.querySelector('[data-input="hs-op"]')?.disabled ?? false)), '깨끗함', t.slice(0, 200));
  await closePop();
  await saveState(s);
}

// ── 43 폰 크기: 전화 → 흥정 → 말로 수락 → 주문 (대표 경로 폰 갈래) ──
{
  const s = step('폰_전화_말로수락주문');
  const saved = clone(snapShow2);
  const store = await page.evaluate(() => { const o = {}; for (const k of Object.keys(window.__store)) if (k.startsWith('p:goei:data-') || k === 'p:goei:prefs') o[k] = window.__store[k]; return o; });
  await page.close();
  ({ page: page2 } = await boot(b, fx, saved, 'phone', { store }));
  page = page2;
  await goHs();
  const mobile = await page.evaluate(() => !!document.querySelector('.hs.hs-m'));
  check(s, '폰 배치(.hs-m)', mobile, true, mobile);
  await queue('<operator>\n우산 주문이시죠.\n</operator>');
  await openCall();
  const m = await page.evaluate(() => document.querySelector('.hs-pop')?.className ?? '');
  check(s, '전화 창이 폰 꼴(call m)', m.includes('call') && m.includes(' m'), 'call m', m);
  await click('[data-action="hs-pay"][data-value="talk"]'); await sleep(300);
  await queue(`<operator>\n육십만 원에 드리죠.\n</operator>\n<terms>\nmoney|600000\n</terms>`);
  await say('[data-action="hs-op"]', 'hs-op', '육십만 원이면 안 될까요?');
  await sleep(500); await idle(); await sleep(300);
  const t1 = await popText();
  check(s, '폰: 조건 카드 600,000원', t1.includes('600,000원'), '600,000원', /상담원 조건\n[^\n]*/.exec(t1)?.[0] ?? t1.slice(0, 120));
  await queue(`<operator>\n주문 받았습니다.\n</operator>\n<terms>\nmoney|600000\n</terms>\n<deal/>`);
  const bal0 = await balance();
  await say('[data-action="hs-op"]', 'hs-op', '좋아요, 주문해 주세요.');
  await sleep(800); await idle(); await sleep(800);
  const o = (await orders()).find((x) => x.item.name === '젖지 않는 우산');
  check(s, '폰: 주문 1건(흥정 600,000원), 잔고 -600,000', o?.pay === 'talk' && o?.how === '600,000원' && (await balance()) === bal0 - 600000, { how: '600,000원', bal: bal0 - 600000 }, o && { how: o.how, bal: await balance() });
  const t2 = await popText();
  check(s, '폰: 완료 화면', t2.includes('택배 상자가 소지품에 도착했습니다'), '완료', t2.slice(0, 120));
  await closePop();
  await saveState(s);
}

writeFileSync(`${OUT}결과.json`, JSON.stringify({ commit: process.env.GIT_COMMIT ?? '', results, pageErrors: errors }, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} 통과${errors.length ? ` · 페이지 오류 ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
