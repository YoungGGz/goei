import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeshop } from '../dist-test/core.mjs';
const { scheduleDues, openOrder, newOrder, ordersVars, liveOrders, paidOf, callNow, homeshopBlock, withHomeshop, boxOrder, HS_AUD_VAR, parseShow, applyShow, readShow, showVars, emptyShow, moodMap, hsSettings, HS_KEY, HS_NUM, parseClipGroups, clipsOf, idleState, nextIdle, moodClip, cueMs } = homeshop;

const meta = JSON.parse(readFileSync(new URL('../그림/홈쇼핑/homeshop.json', import.meta.url), 'utf8'));
const moods = moodMap(meta);
const RAW = `<shelf>
행운의 무전기|무이자 6회|사용|walkie talkie|0.4|건전지 없이도 누군가 받습니다.|누군가 받는다|
잠들지 않는 베개|무이자 3회|사용|pillow|0.8|아침까지 눈이 떠 있습니다.|잠이 오지 않는다|
</shelf>
<title>
금요 심야 특집
</title>
<cue>
#1
와이드|말하기|고객님들, 잘 오셨습니다.|-
상품|신남|행운의 무전기입니다!|가격 공개
바스트|다급|서두르세요!|남은 수량 -12
#2
전화|말하기|연결됐습니다.|전화 연결
바스트|없는표정|…끊지 마세요.|응시
</cue>
<chat>
ㅇㅇ|재입고 되나요
???|여기 안에 있어요
</chat>`;

test('망상홈쇼핑: 편성 응답을 상품·큐시트·채팅으로 읽는다', () => {
  const r = parseShow(RAW, moods);
  assert.equal(r.title, '금요 심야 특집');
  assert.deepEqual(r.items.map((i) => i.name), ['행운의 무전기', '잠들지 않는 베개']);
  // 값 칸의 「무이자 N회」는 출연으로 읽고 원 값은 0 (돈으로는 안 판다 — 공짜 주문이 되지 않게)
  assert.deepEqual(r.insts, [1, 1]);
  assert.equal(r.items[0].price, 0);
  assert.deepEqual(r.cues.map((c) => c.length), [3, 2]);
  assert.deepEqual(r.cues[0].map((c) => c.cut), ['A', 'C', 'B']);
  assert.equal(r.cues[0][1].ev, 'price');
  assert.equal(r.cues[0][2].ev, 'left');
  assert.equal(r.cues[0][2].n, 12);
  assert.equal(r.cues[1][0].cut, 'D');
  assert.equal(r.cues[1][1].ev, 'look');
  assert.deepEqual(r.chat, [{ nick: 'ㅇㅇ', text: '재입고 되나요' }, { nick: '???', text: '여기 안에 있어요' }]);
});

test('망상홈쇼핑: 큐시트가 없거나 상품보다 모자라면 오류', () => {
  assert.throws(() => parseShow(RAW.replace(/<cue>[\s\S]*<\/cue>/, ''), moods), /<cue>/);
});

test('망상홈쇼핑: 편성은 저장했다 그대로 읽는다', () => {
  const st = applyShow(emptyShow(), parseShow(RAW, moods), 'k1');
  const back = readShow(showVars(st));
  assert.equal(back.loaded, true);
  assert.equal(back.at, 0);
  assert.deepEqual(back.parts.map((p) => p.item.name), st.parts.map((p) => p.item.name));
  assert.equal(back.parts[0].cues.length, 3);
  const next = applyShow(st, parseShow(RAW, moods), 'k2');
  assert.ok(next.prev.includes('행운의 무전기'), '지난 상품을 기억');
});

test('망상홈쇼핑: 설정은 기본값과 범위를 지킨다', () => {
  const d = hsSettings({});
  assert.equal(d.on, true);
  assert.deepEqual(d.cue, [HS_NUM.cueMin.def, HS_NUM.cueMax.def]);
  const s = hsSettings({ [HS_KEY.on]: '0', [HS_NUM.speed.key]: '99999', [HS_NUM.rareP.key]: '50' });
  assert.equal(s.on, false);
  assert.equal(s.speed, HS_NUM.speed.hi);
  assert.equal(s.rules.rareP, 0.5);
  assert.ok(cueMs({ text: '가나다라마' }, { speed: 10, hold: 1 }) === 1500);
});

test('망상홈쇼핑: 대기 동작은 기본을 돌리다 정해진 횟수마다 다른 동작을 끼운다', () => {
  const clips = clipsOf(meta.cuts.B, 'B', {});
  const rules = { fill: [3, 3], fillCool: 8, rareP: 0, rareCool: 20 };
  const st = idleState();
  const seq = Array.from({ length: 40 }, () => nextIdle(clips, st, rules, () => 0.3));
  const others = seq.filter((c) => c.group !== 'base');
  assert.ok(others.length >= 5 && others.length <= 10, '3번 돌고 1번 자리에서만');
  assert.ok(seq.slice(0, 3).every((c) => c.group === 'base'), '처음 3번은 기본');
  assert.ok(others.every((c) => c.group === 'filler'), '드물게 0% 면 가끔 동작만');
  const st2 = idleState();
  const rare = Array.from({ length: 40 }, () => nextIdle(clips, st2, { ...rules, rareP: 1 }, () => 0.3)).filter((c) => c.group === 'rare');
  assert.ok(rare.length >= 1 && rare.length <= 2, '드물게 동작은 쉬는 횟수를 지킴');
});

test('망상홈쇼핑: 동작 분류는 설정 글로 고친다', () => {
  const some = meta.cuts.B.clips.find((c) => c.group === 'filler');
  const over = parseClipGroups(`B:${some.ko}=안씀\nA : talk = 기본\n엉터리 줄`);
  assert.equal(Object.keys(over).length, 2);
  const clips = clipsOf(meta.cuts.B, 'B', over);
  assert.ok(clips.filter((c) => c.name === some.name).every((c) => c.group === 'off'));
  assert.ok(moodClip(clips, '없는동작', idleState()), '모르는 표정은 말하기·기본으로');
});

const chatOf = (turns, vars = {}) => ({ message: Array.from({ length: turns * 2 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `m${i}`, chatId: `c${i}` })), scriptstate: vars });
const ITEM = { id: 'x1', name: '행운의 무전기', desc: '광고', effect: '', use: true, price: 0, pay: '무이자 3회' };

test('망상홈쇼핑: 호출 턴은 간격 안에서 뽑고 다른 주문과 겹치지 않는다', () => {
  const d = scheduleDues([8, 9], 2, 3, [6, 6], () => 0);
  assert.deepEqual(d, [10, 16, 22], '8·9 는 차 있어 10 으로 밀림');
  assert.deepEqual(scheduleDues([], 5, 0, [6, 12]), [], '맞교환은 호출 없음');
});

test('망상홈쇼핑: 주문 때는 출연이 걸리지 않고, 출연 호출 턴은 상자를 열 때 뽑는다', () => {
  const c2 = chatOf(2);
  const terms = { money: 0, items: [], appear: 3, other: '' };
  const o0 = newOrder(c2, ITEM, 'appear', terms);
  assert.equal(o0.n, 1, '주문 한 건에 시연 한 번');
  assert.deepEqual(o0.dues, [], '주문 때는 출연이 걸리지 않는다');
  // 안 연 주문에는 호출이 없다
  const at = (turns, vars) => ({ ...chatOf(turns), message: [...chatOf(turns - 1).message, { role: 'user', data: 'go', chatId: 'u' }], scriptstate: vars });
  const sealed = { ...o0, boxId: 'box1', dues: [5] };
  assert.equal(homeshopBlock(at(5, ordersVars([sealed]))), '', '안 연 상자는 묶지 않는다');
  assert.equal(callNow(at(5, ordersVars([sealed]))), null);
  // 3턴째 응답(c5) 뒤에 열었다: 그때부터 간격대로
  const c3 = { ...chatOf(3), scriptstate: ordersVars([sealed]) };
  const o = openOrder(c3, sealed, { call: [3, 3] }, 'c5', () => 0);
  assert.equal(o.openKey, 'c5');
  assert.deepEqual(o.dues, [6]);
  const vars = ordersVars([o]);
  assert.equal(homeshopBlock(at(5, vars)), '');
  const b6 = homeshopBlock(at(6, vars));
  assert.ok(b6.startsWith('[망상홈쇼핑]') && b6.includes('행운의 무전기') && b6.includes('the demonstration owed') && !/\{\w+\}/.test(b6), b6);
  assert.equal(homeshopBlock(at(7, vars)), '', '지나면 다시 안 보냄');
  assert.equal(callNow(at(9, vars)), null, '한 번뿐');
  assert.equal(paidOf(o, 5), 0);
  assert.equal(paidOf(o, 9), 1);
  const msgs = withHomeshop([{ role: 'system', content: 'S' }, { role: 'user', content: 'go' }], at(6, vars));
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].role, 'system');
  assert.equal(withHomeshop(msgs, at(6, vars)).length, 3, '두 번 넣지 않음');
  // 연 응답을 지우거나 다시 굴리면 출연도 없던 일 (다시 열 때 새로 뽑는다)
  const rerolled = { ...at(6, vars), message: at(6, vars).message.filter((m) => m.chatId !== 'c5') };
  assert.equal(callNow(rerolled), null);
  // 다른 연 주문의 호출 턴과 겹치면 한 턴 미룬다
  const other = { ...sealed, id: 'ho_x2', boxId: 'box2' };
  const c3b = { ...chatOf(3), scriptstate: ordersVars([o, other]) };
  assert.deepEqual(openOrder(c3b, other, { call: [3, 3] }, 'c5', () => 0).dues, [7]);
  // 주문한 응답이 지워지면 장부도 없던 일
  const gone = { message: c2.message.slice(0, 2), scriptstate: vars };
  assert.equal(liveOrders(gone.scriptstate, new Set(gone.message.map((m) => m.chatId))).length, 0);
  assert.equal(boxOrder(ordersVars([sealed]), 'box1', new Set([sealed.anchor, 'c5'])).id, sealed.id);
  assert.equal(boxOrder(ordersVars([sealed]), 'nope', new Set([sealed.anchor, 'c5'])), null);
  assert.equal(boxOrder(vars, 'box1', new Set([o.anchor, 'c5'])), null, '연 상자는 다시 못 연다');
});

test('망상홈쇼핑: 방청 신청은 바로 다음 턴에만 한 줄', () => {
  const c = chatOf(2);
  const key = (() => { const o = newOrder(c, ITEM, 'appear', { money: 0, items: [], appear: 3, other: '' }); return o.anchor; })();
  const vars = { [HS_AUD_VAR]: JSON.stringify({ anchor: key, no: '4821', name: '나' }) };
  const next = { message: [...c.message, { role: 'user', data: 'go', chatId: 'u' }], scriptstate: vars };
  assert.ok(homeshopBlock(next).includes('4821'));
  const later = { message: [...next.message, { role: 'char', data: 'r', chatId: 'r' }, { role: 'user', data: 'go2', chatId: 'u2' }], scriptstate: vars };
  assert.equal(homeshopBlock(later), '', '그다음 턴에는 저절로 풀림');
});

test('턴 열쇠: 응답을 다시 굴리면 같고 새 턴이면 달라진다 (자동 호출·편성 넘기기 공통)', async () => {
  const core = await import('../dist-test/core.mjs');
  const turnKey = core.turnKey ?? core.shop?.turnKey;
  const base = [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답', chatId: 'c1' }];
  const k1 = turnKey({ message: base });
  // 다시 굴리기: 같은 자리의 응답이 새 chatId·새 글
  assert.equal(turnKey({ message: [base[0], { role: 'char', data: '다른 답', chatId: 'c1b' }] }), k1);
  // 새 턴
  assert.notEqual(turnKey({ message: [...base, { role: 'user', data: '계속', chatId: 'u2' }, { role: 'char', data: '둘째 답', chatId: 'c2' }] }), k1);
  assert.equal(turnKey({ message: [] }), '');
});

// ── 11-12: 상품마다 채팅 · 방송 전용 지침 ──
const core1112 = await import('../dist-test/core.mjs');

test('망상홈쇼핑: 채팅은 상품마다(#n) 읽고 그 부에 담는다. 머리 없는 줄은 공용', () => {
  const raw = RAW.replace(/<chat>[\s\S]*<\/chat>/, `<chat>
#1
ㅇㅇ|이거 뭐임
abc12|배송 며칠 걸려요
#2
감자|베개는 좀 끌리네
</chat>`);
  const r = parseShow(raw, moods);
  assert.deepEqual(r.chats.map((c) => c.length), [2, 1]);
  assert.deepEqual(r.chat, []);
  const st = applyShow(emptyShow(), r, 'k1');
  assert.deepEqual(st.parts.map((p) => p.chat?.length), [2, 1]);
  // 저장했다 읽어도 부마다 그대로
  const back = readShow(showVars(st));
  assert.deepEqual(back.parts[0].chat, [{ nick: 'ㅇㅇ', text: '이거 뭐임' }, { nick: 'abc12', text: '배송 며칠 걸려요' }]);
  assert.deepEqual(back.parts[1].chat, [{ nick: '감자', text: '베개는 좀 끌리네' }]);
  // 머리 없이 온 옛 꼴은 공용 줄로
  const old = applyShow(emptyShow(), parseShow(RAW, moods), 'k2');
  assert.equal(old.chat.length, 2);
  assert.equal(old.parts[0].chat, undefined);
});

test('망상홈쇼핑: 지침은 방송 전용 (상점 진열·주인 절을 빌리지 않고, 시청자 절·생각 단계가 있다)', () => {
  const g = core1112.guideDefault('Hs');
  const names = [...g.matchAll(/@@SECTION ([^\n]+)/g)].map((m) => m[1].trim());
  for (const n of ['COMMON', 'SHELF', 'BROADCAST', 'VIEWERS', 'THOUGHTS_PROGRAM', 'SAY', 'CALL', 'AUDIENCE']) assert.ok(names.includes(n), n);
  for (const n of ['FIRST', 'RESTOCK', 'THOUGHTS_SHELF', 'TALK', 'SELL', 'MAIN_TAG', 'SHOP_RULE']) assert.ok(!names.includes(n), `${n} 없어야`);
  const viewers = /@@SECTION VIEWERS\n([\s\S]*?)\n@@END/.exec(g)[1];
  assert.match(viewers, /without knowing what it is/);
  assert.match(viewers, /know what the channel really is/);
  assert.match(viewers, /Strange beings/);
  // 대화 예시를 박지 않는다 (11-12 사용자): 따옴표로 든 말·한글 예문 없음
  assert.doesNotMatch(viewers, /[「」"“”]|e\.g\.|[가-힣ㄱ-ㅎ]/);
});

test('망상홈쇼핑: 편성 요청문은 방송 꼴만 (가게 정체·주인 한마디·진열대 새로 짜기 없음), 채팅은 상품마다', () => {
  const st = { ...core1112.emptyShop({ raw: '', shop: '망상홈쇼핑', owner: '레드 프라이데이' }, ''), loaded: true, identity: { sells: '망상홈쇼핑', never: '', prices: '무이자 N회' }, prev: ['행운의 무전기'] };
  const src = { st, refs: '참고 글', story: '', status: '', situation: '', identity: '', language: null };
  const msgs = core1112.programPrompt(src, core1112.shopSettings({}), { cue: '6 to 10', chat: '12 to 18', cuts: '와이드, 바스트', moods: '말하기', moods_b: '-', events: '가격 공개' });
  const sys = msgs.find((m) => m.role === 'system').content;
  const user = msgs.at(-1).content;
  assert.match(sys, /live feed of 망상홈쇼핑/);
  assert.match(sys, /<chat>\n#1\nhandle\|message/);
  // 고르는 낱말·줄 꼴은 영어 (11-12 사용자), 진행자 절이 같이 간다
  assert.match(sys, /<cue>\n#1\ncut\|mood\|line\|event/);
  assert.match(sys, /# Host on air/);
  assert.match(sys, /12 to 18 lines of the live viewer chat while that item is on air/);
  assert.match(sys, /# Viewer chat/);
  assert.match(sys, /행운의 무전기/);
  assert.doesNotMatch(sys, /Re-stock|First visit|<owner>|shop-identity|\{[a-z_]+\}/);
  assert.match(user, /^\[채널\]\n망상홈쇼핑 \/ 진행자: 레드 프라이데이/);
  assert.match(user, /참고 글/);
  assert.match(user, /\[현재 작업\]\n오늘 편성/);
  assert.doesNotMatch(user, /가게 정체|진열대/);
});

test('남은 수량 저절로 줄기: 큐시트 끝에 끝 수에 닿고 0이 되지 않는다', () => {
  const { dropEnd, dropRest, nextDrop } = homeshop;
  const d0 = hsSettings({}).drop;
  assert.deepEqual(d0, { on: true, rate: HS_NUM.dropRate.def / 100, fast: HS_NUM.dropFast.def / 10, step: HS_NUM.dropStep.def, soon: HS_NUM.soonAt.def, end: [HS_NUM.endLo.def, HS_NUM.endHi.def] });
  assert.equal(hsSettings({ [HS_KEY.drop]: '0' }).drop.on, false);
  assert.deepEqual(hsSettings({ [HS_NUM.endLo.key]: '9', [HS_NUM.endHi.key]: '4' }).drop.end, [4, 9]);
  // 끝 수: 범위 안, 시작 값보다 작게, 1 이상
  assert.equal(dropEnd(30, d0, () => 0), d0.end[0]);
  assert.equal(dropEnd(30, d0, () => 0.999), d0.end[1]);
  assert.equal(dropEnd(3, d0, () => 0.999), 2);
  assert.equal(dropEnd(1, d0, () => 0.5), 1);
  // 남은 길이: 가격 공개 뒤는 배수만큼 길게, 매진 뒤는 안 친다, 큐시트가 뺄 수는 따로
  const s = { speed: 10, hold: 1, drop: d0 };
  const cue = (ev, n) => ({ cut: 'B', mood: '', text: '가나다라마가나다라마', ev, ...(n ? { n } : {}) });
  const cues = [cue(''), cue('left', 4), cue('price'), cue(''), cue('sold'), cue('')];
  assert.deepEqual(dropRest(cues, 0, 1000, false, s), { ms: 1000 + 2000 + 2000 * d0.fast * 2, planned: 4 });
  assert.deepEqual(dropRest(cues, 2, 500, true, s), { ms: 500 * d0.fast + 2000 * d0.fast, planned: 0 });
  // 꺼짐 · 줄일 것 없음 · 시간 없음
  assert.equal(nextDrop(30, 5, { ms: 10000, planned: 0 }, { ...d0, on: false }), null);
  assert.equal(nextDrop(5, 5, { ms: 10000, planned: 0 }, d0), null);
  assert.equal(nextDrop(9, 5, { ms: 10000, planned: 4 }, d0), null);
  assert.equal(nextDrop(30, 5, { ms: 0, planned: 0 }, d0), null);
  // 한 부를 처음부터 끝까지 흘려 본다 (33ms 씩): 끝에는 끝 수 근처, 그 아래로는 안 간다
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const start of [30, 200, 999, 8]) {
    const plain = Array.from({ length: 8 }, (_, i) => cue(i === 4 ? 'rush' : ''));
    const end = dropEnd(start, d0, rnd);
    let left = start, n = 0, wait = 0, fast = false, drops = 0;
    for (let i = 0; i < plain.length; i++) {
      if (plain[i].ev === 'rush') fast = true;
      for (let at = 0; at < 2000; at += 33) {
        if (!n) { const p = nextDrop(left, end, dropRest(plain, i, 2000 - at, fast, s), d0, rnd); if (p) ({ n, wait } = p); }
        else if ((wait -= 33 * (fast ? d0.fast : 1)) <= 0) { left = Math.max(1, end, left - n); n = 0; drops++; }
      }
    }
    assert.ok(left >= end && left >= 1, `${start}: ${left} >= ${end}`);
    assert.ok(left - end <= Math.max(3, start * 0.1), `${start}: 끝 ${left} (목표 ${end})`);
    assert.ok(drops <= 16 + 2, `${start}: ${drops}번 (1초보다 잦지 않게)`);
  }
});

test('망상홈쇼핑: 큐 낱말은 영어로 주고, 영어·우리말 둘 다 읽는다 · 진행자 절에 대화 예시 없음', () => {
  const { parseCue, CUE_CUT_WORD, CUE_EVENT_WORD } = homeshop;
  assert.deepEqual(Object.values(CUE_CUT_WORD), ['wide', 'bust', 'product', 'phone']);
  assert.doesNotMatch(Object.values(CUE_EVENT_WORD).join(' '), /[가-힣]/);
  const en = [['wide|talk|하나|price', 'A', 'price'], ['bust|whisper|둘|left -7', 'B', 'left'], ['product|excited|셋|soon', 'C', 'soon'], ['phone|talk|넷|call', 'D', 'call'], ['bust|cold|다섯|look', 'B', 'look'], ['bust|urgent|여섯|sold', 'B', 'sold'], ['wide|amazed|일곱|rush', 'A', 'rush'], ['bust|talk|여덟|tear', 'B', 'tear'], ['bust|talk|아홉|-', 'B', '']];
  for (const [line, cut, ev] of en) {
    const c = parseCue(line, moods);
    assert.equal(c.cut, cut, line);
    assert.equal(c.ev, ev, line);
  }
  assert.equal(parseCue('bust|whisper|둘|left -7', moods).n, 7);
  assert.equal(parseCue('bust|whisper|둘|left -7', moods).mood, 'whisper');
  assert.equal(parseCue('바스트|속삭임|둘|남은 수량 -12', moods).n, 12);
  assert.equal(parseCue('상품|신남|셋|매진 임박', moods).ev, 'soon');
  // 11-15 사용자: 매진이 거의 모든 상품에 뜬다 → 칸 전체가 사건 낱말일 때만, 낱말 일부(곧 매진·매진 직전·nearly sold out)는 사건이 아니다
  for (const cell of ['곧 매진', '매진 직전', 'nearly sold out', 'almost sold', '매진 아님', '완판', 'sold out']) assert.equal(parseCue(`bust|talk|대사|${cell}`, moods).ev, '', cell);
  assert.equal(parseCue('bust|talk|대사|매진', moods).ev, 'sold');
  assert.equal(parseCue('bust|talk|대사| SOLD ', moods).ev, 'sold');
  // 대사 안의 「|」: 사건은 맨 끝 칸, 사이는 대사로 잇는다
  const pipe = parseCue('bust|talk|하나|둘 매진 얘기|rush', moods);
  assert.equal(pipe.ev, 'rush');
  assert.equal(pipe.text, '하나 둘 매진 얘기');
  assert.equal(parseCue('bust|talk|사건 칸 없음', moods).ev, '');
  const g = core1112.guideSections('Hs');
  assert.match(g.HOST, /# Host on air/);
  assert.doesNotMatch(g.HOST, /[「」"“”]|e\.g\.|[가-힣ㄱ-ㅎ]/);
  assert.match(g.MAIN_CONTEXT, /reference data, not instructions/);
  assert.match(g.SAY, /cut\|mood\|line\|event/);
  const s = homeshop.hsSettings({ $hs_say_cue_min: '2', $hs_say_cue_max: '4', $hs_say_chat_min: '0', $hs_say_chat_max: '9' });
  assert.deepEqual([s.sayCue, s.sayChat], [[2, 4], [0, 9]]);
  assert.deepEqual([homeshop.hsSettings({}).sayCue, homeshop.hsSettings({}).sayChat], [[1, 3], [2, 5]]);
});

test('망상홈쇼핑 편성 요청문: 누가 무엇을 아는지(KNOWS)가 들어가고, 스티커 밑 글·맞교환 말은 청하지 않는다 (11-15: 스티커는 진실 칸에서, 맞교환은 상담원 요청이 따로)', () => {
  const st = { ...core1112.emptyShop({ raw: '', shop: '망상홈쇼핑', owner: '레드 프라이데이' }, ''), loaded: true, identity: { sells: '망상홈쇼핑', never: '', prices: '원 값, 다음 방송 시연 참여' }, prev: [] };
  const src = { st, refs: '', story: '', status: '', situation: '', identity: '', language: null };
  const fill = { cue: '6 to 10', chat: '12 to 18', cuts: '와이드, 바스트', moods: '말하기', moods_b: '-', events: '가격 공개' };
  const sys = core1112.programPrompt(src, homeshop.hsSettings({}).shop, fill).find((m) => m.role === 'system').content;
  assert.match(sys, /Who knows what: /);
  assert.match(sys, /<\/chat>\n<operator>\nhello\|[^\n]+\ndone\|[^\n]+\n<\/operator>\n<cue>:/);
  assert.doesNotMatch(sys, /<peek>|barter\||\{[a-z_]+\}|\n\n\n/);
  assert.match(sys, /이름\|값\|쓰임\|그림\|무게\|설명\|효과\|시연\|진실/);
  assert.match(sys, /시연: O if the channel sells/);
  const raw = `<title>밤 편성</title>\n<shelf>\n무전기|-|-|기기/무전기/radio|0.3|받는다||4|\n</shelf>\n<cue>\n#1\nwide|talk|어서 오세요|-\n</cue>\n<chat>\n#1\nㅇㅇ|와\n</chat>\n<operator>\nhello|네 고객님\ndone|접수했습니다\n</operator>`;
  const r = homeshop.parseShow(raw, new Map());
  assert.deepEqual(r.ops, { hello: '네 고객님', done: '접수했습니다' });
  assert.equal(r.items[0].price, 0, '값 「-」= 돈으로는 안 팖, 상품은 남는다');
  assert.deepEqual(r.insts, [1]);
});

test('망상홈쇼핑 상품 줄: 원 값·출연 칸 (둘 다 없으면 버림) · 값 글', () => {
  const { hsLine, hsPayText } = homeshop;
  const a = hsLine('부적|1,200,000|-|부적/부적/talisman|0.01|붉은 종이||3|');
  assert.equal(a.item.price, 1200000);
  assert.equal(a.inst, 1);
  assert.equal(hsPayText({ item: a.item, inst: a.inst }), '1,200,000원 · 다음 방송 시연 참여');
  const b = hsLine('부적|800000|-|부적/부적/talisman|0.01|붉은 종이||-|');
  assert.equal(b.inst, 0);
  assert.equal(hsPayText({ item: b.item, inst: 0 }), '800,000원');
  assert.equal(hsLine('부적|-|-|부적/부적/talisman|0.01|붉은 종이||-|'), null);
  assert.equal(hsLine('부적|피 한 방울|-|부적/부적/talisman|0.01|붉은 종이||-|'), null, '원이 아닌 대가 글만 있으면 버림 (그런 대가는 상담원 흥정에서)');
});

test('망상홈쇼핑 상담원: 응답의 말·조건 읽기 (내민 물건만 가져간다) · 조건 글', () => {
  const { parseOperator, termsText } = homeshop;
  const offered = [{ id: 'i1', name: '은 나침반' }, { id: 'i2', name: '붕대' }];
  const r = parseOperator('<operator>\n고객님, 이건 저희가 받기 어렵네요.\n</operator>\n<terms>\nmoney|300,000\nitems|은 나침반; 없는 물건\nappear|2\nother|계약서 한 장\n</terms>', offered);
  assert.equal(r.line, '고객님, 이건 저희가 받기 어렵네요.');
  assert.deepEqual(r.terms, { money: 300000, items: [{ id: 'i1', name: '은 나침반' }], appear: 1, other: '계약서 한 장' });
  assert.equal(termsText(r.terms), '300,000원 + 「은 나침반」 맞교환 + 다음 방송 시연 참여 + 계약서 한 장');
  assert.equal(termsText(r.terms, false), '「은 나침반」 맞교환 + 다음 방송 시연 참여 + 계약서 한 장');
  assert.equal(parseOperator('<operator>안 됩니다</operator><terms>none</terms>', offered).terms, null);
  assert.throws(() => parseOperator('<terms>none</terms>', offered), /operator/);
});

test('망상홈쇼핑 상담원 요청문: 상담원은 사람이 아니고 후려친다 · 돈을 못 받으면 그 줄 · 내민 물건·통화가 user 칸에', () => {
  const st = { ...core1112.emptyShop({ raw: '', shop: '망상홈쇼핑', owner: '레드 프라이데이' }, ''), loaded: true, identity: { sells: '망상홈쇼핑', never: '', prices: '' }, prev: [] };
  const src = { st, refs: '', story: '', status: '', situation: '', identity: '', language: null };
  const msgs = core1112.operatorPrompt(src, core1112.shopSettings({}), 'barter', '[내민 물건]\n붕대|소모3|-|-', true);
  const sys = msgs.find((m) => m.role === 'system').content;
  assert.match(sys, /not a human/);
  assert.match(sys, /underpays/);
  assert.match(sys, /Who knows what: /);
  assert.match(sys, /cannot take money/);
  assert.match(sys, /<terms>/);
  assert.match(msgs.find((m) => m.role === 'user').content, /\[내민 물건\]\n붕대/);
  const talk = core1112.operatorPrompt(src, core1112.shopSettings({}), 'talk', '-', false).find((m) => m.role === 'system').content;
  assert.match(talk, /has just spoken/);
  assert.doesNotMatch(talk, /cannot take money/);
});

test('스티커 들추기: 진실에서 몇 글자만, 같은 상품이면 늘 같은 조각 · 진실이 없거나 ?면 빈 글', () => {
  const { peelFragment } = homeshop;
  const t = '셋째 알 뒤 술을 마시면 잠든 몸이 살아있는 악기가 된다';
  const f = peelFragment(t, 'ms1_0_ab', 8);
  assert.ok(f.length > 0 && Array.from(f).length <= 8, f);
  assert.ok(t.includes(f), '조각은 진실 원문의 일부');
  assert.ok(f.length < t.length, '전체가 아니다');
  assert.equal(peelFragment(t, 'ms1_0_ab', 8), f, '다시 열어도 같다');
  assert.equal(peelFragment('?', 'x', 8), '');
  assert.equal(peelFragment(undefined, 'x', 8), '');
});

test('망상홈쇼핑: 진실 칸(숨은 원래 용도)을 받아 상품에 둔다 · 화면용 기록에는 없다 (11-15 사용자: 쓸 때 숨은 효과가 하나도 안 들어감)', () => {
  const raw = RAW.replace('누군가 받는다|\n', '누군가 받는다||받는 쪽이 대신 말을 시작한다 · 밤 열두 시 넘어 켜면\n');
  const r = parseShow(raw, moods);
  assert.equal(r.items[0].truth, '받는 쪽이 대신 말을 시작한다 · 밤 열두 시 넘어 켜면');
  assert.equal(r.items[1].truth, undefined);
  const g = core1112.guideSections('Hs');
  assert.match(g.LINE, /\|진실$/);
  assert.match(g.BROADCAST, /진실/);
});
