// 망상홈쇼핑 설정 정의표 (core/setdef/homeshop.ts): 줄·기본값·줄이 적는 변수와 읽는 쪽이 맞는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeshop, hslog, hsset, settings } from '../dist-test/core.mjs';
const { hsSettings, HS_NUM, HS_KEY, HS_READ_DEFAULT, HS_VAR, HS_AT_VAR, HS_ORDERS_VAR, HS_AUD_VAR } = homeshop;
const { HOMESHOP_SET, HS_PAIRS, HS_DEF_TEXT, hsRowVars, HS_TEL_KEY, HS_RETRY_KEY } = hsset;
const rows = HOMESHOP_SET.groups.flatMap((g) => g.rows);

test('망상홈쇼핑 설정: 묶음과 줄 — 이 페이지에만 있는 줄만, 상점 표의 줄은 없다', () => {
  assert.deepEqual(HOMESHOP_SET.groups.map((g) => [g.title, g.rows.map((r) => r.key)]), [
    ['', ['net', 'retry', 'say', 'sayCue', 'sayChat', 'sayHost', 'sayFlow']],
    ['편성', ['cue', 'chat', 'prevKeep']],
    ['방송 흐름', ['speed', 'hold', 'frame', 'chatGap', 'next', 'turn', 'lock']],
    ['남은 수량', ['left', 'drop', 'dropRate', 'dropFast', 'dropStep', 'soonAt', 'end']],
    ['주문', ['barter', 'talk', 'talkKeep', 'orderKeep', 'peek']],
    ['컨텍스트 포함', ['call', 'aud', 'logKeep']],
    ['진행자 동작', ['fill', 'fillCool', 'rareP', 'rareCool', 'read', 'clips']],
    ['방송 화면', ['tel', 'cut', 'bulb', 'tear', 'tearP', 'scan', 'scalePc', 'scalePh']],
  ]);
  // 상점마다 따로 정하는 값·네 곳이 같이 쓰는 값·메인 요청에 붙이는 것은 설정 → 상점에 있다
  for (const r of rows) {
    assert.ok(!/^(on|auto|size|turns|refs)$|^sh:/.test(r.key), `상점 표의 줄이 페이지에 있다: ${r.key}`);
    for (const v of hsRowVars(r.key)) assert.ok(!v.startsWith('$hs_sh_') && !v.startsWith('$hs_main') && v !== HS_KEY.on, `${r.key} → ${v}`);
  }
  assert.equal(new Set(rows.map((r) => r.label)).size, rows.length, '줄 이름이 겹치지 않는다');
  for (const w of ['컨텍스트에 포함', '최근 본문 턴 수', '참고 로어북', '정부기관', '이면', '본편', '참고 자료']) for (const r of rows) assert.ok(!r.label.includes(w), `${r.label}: ${w}`);
});

test('망상홈쇼핑 설정: 기본값·범위 (넘김 문서 2절)', () => {
  const D = { chatMin: [30, 0, 120], chatMax: [40, 0, 120], cueMin: [12, 2, 20], cueMax: [16, 2, 20], sayCueMin: [1, 1, 6], sayCueMax: [3, 1, 6], sayChatMin: [2, 0, 12], sayChatMax: [5, 0, 12],
    chatGap: [22, 5, 100], speed: [11, 3, 40], hold: [12, 0, 50], frame: [110, 50, 250], tearP: [6, 0, 100], fillLo: [3, 1, 30], fillHi: [6, 1, 30], fillCool: [8, 0, 60], rareP: [10, 0, 100], rareCool: [20, 0, 120],
    next: [0, 0, 60], left: [30, 1, 999], dropRate: [100, 10, 400], dropFast: [20, 10, 50], dropStep: [3, 1, 20], soonAt: [5, 0, 99], endLo: [2, 1, 99], endHi: [8, 1, 99], callLo: [6, 1, 60], callHi: [12, 1, 60],
    sayHost: [4, 1, 20], sayFlow: [24, 1, 60], prevKeep: [24, 1, 200], talkKeep: [40, 4, 200], orderKeep: [40, 10, 200], logKeep: [400, 50, 2000] };
  assert.deepEqual(Object.keys(HS_NUM).sort(), Object.keys(D).sort());
  for (const [k, [def, lo, hi]] of Object.entries(D)) assert.deepEqual([HS_NUM[k].def, HS_NUM[k].lo, HS_NUM[k].hi], [def, lo, hi], k);
  const s = hsSettings({});
  assert.deepEqual([s.sayCue, s.sayChat, s.cue, s.chat, s.next], [[1, 3], [2, 5], [12, 16], [30, 40], 0]);
  assert.deepEqual(s.read, ['고개 꺾기', '굳은 응시']);
  assert.equal(HS_READ_DEFAULT, '고개 꺾기, 굳은 응시');
  assert.deepEqual(HS_DEF_TEXT.read, [HS_KEY.read, HS_READ_DEFAULT, 200]);
  // 줄의 조작 범위는 HS_NUM 그대로
  for (const r of rows) {
    if (r.ctl.t === 'num') assert.deepEqual([r.ctl.lo, r.ctl.hi, r.ctl.unit], [HS_NUM[r.key].lo, HS_NUM[r.key].hi, HS_NUM[r.key].unit], r.key);
    if (r.ctl.t === 'minmax') { const [a, b] = HS_PAIRS[r.key]; assert.deepEqual(r.ctl.keys, [a, b]); assert.deepEqual([r.ctl.lo, r.ctl.hi, HS_NUM[b].lo, HS_NUM[b].hi], [HS_NUM[a].lo, HS_NUM[a].hi, HS_NUM[a].lo, HS_NUM[a].hi], r.key); }
  }
  const by = (k) => rows.find((r) => r.key === k);
  assert.deepEqual([by('sayCue').ctl.lo, by('sayCue').ctl.hi, by('sayChat').ctl.lo, by('sayChat').ctl.hi], [1, 6, 0, 12]);
  assert.deepEqual(by('read').ctl, { t: 'text', ph: '', def: HS_READ_DEFAULT, max: 200 });
  // 회색 안내 글을 기본값처럼 쓰지 않는다: 기본값이 든 칸은 def, 그 밖의 칸은 안내 글 없음
  for (const r of rows) if (r.ctl.t === 'text' || r.ctl.t === 'area') assert.equal(r.ctl.ph, '', `${r.key} 회색 안내 글`);
});

test('망상홈쇼핑 설정: 줄이 적는 변수를 읽는 쪽이 읽는다 (적고 → 설정 값이 바뀐다)', () => {
  const base = JSON.stringify(hsSettings({}));
  const uiRead = new Set([HS_TEL_KEY, HS_RETRY_KEY]); // 화면이 바로 읽는 값 (ui/homeshop.ts telOf · retryOf)
  const seen = new Set();
  for (const r of rows) {
    const vars = hsRowVars(r.key);
    assert.ok(vars.length, `${r.key}: 적는 변수가 없다`);
    for (const v of vars) {
      assert.ok(!seen.has(v), `${v} 를 두 줄이 적는다`); seen.add(v);
      if (uiRead.has(v)) continue;
      const num = Object.values(HS_NUM).find((d) => d.key === v);
      const val = num ? String(num.def === num.hi ? num.lo : num.hi) : r.ctl.t === 'seg' && r.ctl.opts.length > 2 ? '2' : r.ctl.t === 'seg' ? '0' : 'B:웃음=드물게';
      // 켬/끔 줄은 기본이 켬인 것도 끔인 것도 있다(「인터넷에 상시 노출」은 기본 끔, 11-16): 반대 값을 적었을 때 바뀌는지 본다
      const flip = !num && r.ctl.t === 'seg' && r.ctl.opts.length <= 2 ? ['0', '1'] : [val];
      assert.ok(flip.some((x) => JSON.stringify(hsSettings({ [v]: x })) !== base), `${r.key} → ${v} 를 아무도 읽지 않는다`);
    }
  }
  assert.deepEqual([HS_TEL_KEY, HS_RETRY_KEY], ['$hs_tel', '$hs_retry']);
  // 새 줄
  assert.deepEqual(hsRowVars('sayCue'), ['$hs_say_cue_min', '$hs_say_cue_max']);
  assert.deepEqual(hsRowVars('sayChat'), ['$hs_say_chat_min', '$hs_say_chat_max']);
  assert.deepEqual(hsRowVars('read'), ['$hs_read']);
  assert.deepEqual(hsSettings({ $hs_say_cue_min: '2', $hs_say_cue_max: '6' }).sayCue, [2, 6]);
  assert.deepEqual(hsSettings({ $hs_say_cue_max: '9' }).sayCue, [1, 6], '범위 밖은 끝 값으로');
  assert.deepEqual(hsSettings({ $hs_say_chat_min: '0', $hs_say_chat_max: '12' }).sayChat, [0, 12]);
  assert.deepEqual(hsSettings({ $hs_read: '웃음, 끄덕임' }).read, ['웃음', '끄덕임']);
  assert.deepEqual(hsSettings({ $hs_read: '' }).read, ['고개 꺾기', '굳은 응시'], '비우면 기본값');
  // 네 곳이 같이 쓰는 값은 기본 상점 자리($sh_*) 하나: 망상홈쇼핑 이름으로 적어도 읽지 않는다 (그래서 그런 줄·처리기를 두지 않는다)
  // 맥락 반영만은 가게 표의 제 줄($hs_sh_ctx)이 있다 (core/shopfn.ts, 전수검사 11-13)
  assert.equal(hsSettings({ $hs_sh_ctx: '0' }).shop.context, false);
  assert.equal(hsSettings({ $sh_ctx: '0' }).shop.context, false, '제 값이 없으면 기본 상점 값');
  for (const k of ['turns', 'refs', 'thoughts', 'diverse', 'prev']) assert.equal(JSON.stringify(hsSettings({ [`$hs_sh_${k}`]: k === 'thoughts' ? 'note' : k === 'turns' || k === 'refs' ? '7' : '0' })), base, `$hs_sh_${k}`);
  assert.equal(hsSettings({ $sh_turns: '7' }).shop.turns, 7);
});

test('망상홈쇼핑 설정: 모든 설정 변수는 「기본값으로 저장」 범위, 상태 변수는 아니다', () => {
  for (const r of rows) for (const v of hsRowVars(r.key)) assert.ok(settings.PREF_VAR.test(v), `${r.key} → ${v}`);
  for (const v of [...Object.values(hslog.HS_MAIN_KEY), HS_KEY.on, HS_KEY.auto, '$hs_sh_model', '$hs_sh_min', '$hs_sh_max', '$hs_sh_price']) assert.ok(settings.PREF_VAR.test(v), v);
  for (const v of [HS_VAR, HS_AT_VAR, HS_ORDERS_VAR, HS_AUD_VAR, hslog.HS_LOG_VAR, '$hs_anything']) assert.ok(!settings.PREF_VAR.test(v), `${v} 는 상태`);
  assert.deepEqual(settings.chatSettingVars({ $hs_read: '웃음', $hs_say_cue_max: '4', $hs_drop: '0', $hs_main_tokens: '500', $hs_show: '{}', $hs_log: '{}' }), { $hs_read: '웃음', $hs_say_cue_max: '4', $hs_drop: '0', $hs_main_tokens: '500' });
});

test('망상홈쇼핑: 메인 요청에 붙이는 값($hs_main·$hs_main_kinds·$hs_main_tokens)을 읽는 뜻', () => {
  const m = hslog.hsMainSettings;
  assert.deepEqual(m({}), { on: true, kinds: ['show', 'chat', 'say', 'buy'], tokens: 3000, turns: 0 });
  assert.equal(m({ $hs_main: '0' }).on, false);
  assert.equal(m({ $hs_main: '' }).on, true);
  assert.deepEqual(m({ $hs_main_kinds: 'buy, show' }).kinds, ['show', 'buy']);
  assert.deepEqual(m({ $hs_main_kinds: '' }).kinds, ['show', 'chat', 'say', 'buy'], '빈 글 = 전부');
  assert.deepEqual(m({ $hs_main_kinds: 'none' }).kinds, [], '아는 종류가 없는 글 = 아무것도 안 넘김');
  assert.equal(m({ $hs_main_tokens: '0' }).tokens, 0);
  assert.equal(m({ $hs_main_tokens: '999999' }).tokens, 200000);
  assert.equal(m({ $hs_main_tokens: '' }).tokens, 3000);
});

test('망상홈쇼핑 설정: 남겨 두는 수·같이 넘기는 줄 수 — 기본값은 전과 같고, 고치면 바뀌고, 잘못된 값은 기본값·범위로', () => {
  const d = hsSettings({});
  assert.deepEqual([d.sayHost, d.sayFlow, d.keep], [4, 24, { prev: 24, talk: 40, orders: 40, log: 400 }]);
  assert.equal(hslog.HS_LOG_MAX, 400);
  const s = hsSettings({ $hs_say_host: '8', $hs_say_flow: '10', $hs_prev_keep: '5', $hs_talk_keep: '12', $hs_order_keep: '15', $hs_log_keep: '60' });
  assert.deepEqual([s.sayHost, s.sayFlow, s.keep], [8, 10, { prev: 5, talk: 12, orders: 15, log: 60 }]);
  const bad = hsSettings({ $hs_say_host: 'x', $hs_say_flow: '', $hs_prev_keep: 'NaN', $hs_talk_keep: {}, $hs_order_keep: '많이', $hs_log_keep: '4백' });
  assert.deepEqual([bad.sayHost, bad.sayFlow, bad.keep], [d.sayHost, d.sayFlow, d.keep], '글자·빈 값은 기본값');
  const out = hsSettings({ $hs_say_host: '0', $hs_say_flow: '999', $hs_prev_keep: '-3', $hs_talk_keep: '1', $hs_order_keep: '0', $hs_log_keep: '99999' });
  assert.deepEqual([out.sayHost, out.sayFlow, out.keep], [1, 60, { prev: 1, talk: 4, orders: 10, log: 2000 }], '범위 밖은 끝 값');

  // 주문: 새 주문을 넣을 때만, 설정 수를 넘으면 다 끝난 연 주문부터 오래된 순으로 버린다. 그냥 적을 때(ordersVars)는 자르지 않는다
  const order = (i) => ({ id: `o${i}`, item: { name: `물건${i}` }, n: 0, how: '', pay: 'won', anchor: '', turn: 0, dues: [], boxId: '', openKey: '' });
  const many = Array.from({ length: 60 }, (_, i) => order(i));
  const ids = (vars) => homeshop.readOrders(vars).map((o) => o.id);
  const alive = new Set(['a', 'r', 'last']);
  const now = { alive, turn: 10, last: 'last' };
  const cut = (list, max) => homeshop.pruneOrders(list, max, now).map((o) => o.id);
  assert.equal(ids(homeshop.ordersVars(many)).length, 60, '적기만 할 때는 자르지 않는다');
  assert.deepEqual(cut(many, 40), many.slice(-40).map((o) => o.id));
  assert.deepEqual(cut(many, s.keep.orders), many.slice(-15).map((o) => o.id));
  assert.equal(cut(many, 200).length, 60);

  // 안 연 상자가 걸린 주문은 넘쳐도 버리지 않는다 (버리면 그 상자를 못 연다). 죽은 주문(주문한 응답이 지워진 것)·다 끝난 연 주문부터 오래된 순으로
  const sealed = (i) => ({ ...order(i), anchor: 'a', boxId: `box${i}`, openKey: undefined });
  const eleven = Array.from({ length: 11 }, (_, i) => sealed(i));
  assert.equal(cut(eleven, 10).length, 11, '전부 안 연 상자면 수를 넘겨도 남긴다');
  assert.equal(homeshop.boxOrder(homeshop.ordersVars(homeshop.pruneOrders(eleven, 10, now)), 'box0', alive)?.id, 'o0', '가장 오래된 상자도 열 수 있다');
  const mixed = [sealed(0), { ...sealed(1), anchor: 'gone' }, { ...sealed(2), openKey: 'r' }, { ...sealed(3), openKey: 'gone' }, { ...sealed(4), openKey: 'r' }, ...Array.from({ length: 8 }, (_, i) => sealed(5 + i))];
  assert.deepEqual(cut(mixed, 10), ['o0', 'o3', ...Array.from({ length: 8 }, (_, i) => `o${5 + i}`)], '죽은 주문·연 주문만 빠지고, 연 응답이 지워져 다시 미개봉이 된 상자는 남는다');
  assert.deepEqual(cut(mixed, 12), mixed.filter((o) => o.id !== 'o1').map((o) => o.id), '넘친 만큼만, 오래된 것부터');

  // 상자를 열 때는 자르지 않는다: 안 연 상자가 이미 수를 넘겨도 방금 연 주문과 그 호출 턴이 남는다
  const opened = eleven.map((o) => (o.id === 'o0' ? { ...o, n: 1, openKey: 'last', dues: [13] } : o));
  assert.deepEqual(homeshop.readOrders(homeshop.ordersVars(opened))[0].dues, [13]);
  // 새 주문이 들어와도 남는 연 주문: 시연 호출이 남은 것 · 연 응답이 마지막 응답인 것 (다시 굴리면 상자가 미개봉으로 돌아오므로 주문이 있어야 다시 연다)
  const done = [{ ...sealed(0), openKey: 'r', dues: [13] }, { ...sealed(1), openKey: 'r', dues: [10] }, { ...sealed(2), openKey: 'r', dues: [9] }, { ...sealed(3), openKey: 'last' }, { ...sealed(4), openKey: 'r' }, ...Array.from({ length: 10 }, (_, i) => sealed(5 + i))];
  assert.deepEqual(cut(done, 10), done.filter((o) => o.id !== 'o2' && o.id !== 'o4').map((o) => o.id), '호출이 끝난 연 주문만 빠진다');
  const rerolled = new Set(['a', 'r']);
  assert.equal(homeshop.boxOrder(homeshop.ordersVars(homeshop.pruneOrders(done, 10, now)), 'box3', rerolled)?.id, 'o3', '연 응답을 다시 굴리면 그 상자를 다시 열 수 있다');
  assert.deepEqual(homeshop.pruneOrders(done, 10, { alive: rerolled, turn: 14, last: 'r2' }).map((o) => o.id), ['o3', ...Array.from({ length: 10 }, (_, i) => `o${5 + i}`)], '호출도 끝나고 연 응답도 지난 주문은 빠진다 (연 응답이 지워진 o3 은 다시 미개봉)');

  // 지난 상품 이름: 기본 24개, 설정을 넘기면 그 수만
  const reply = (k) => ({ title: '', items: Array.from({ length: 5 }, (_, i) => ({ name: `${k}-${i}`, price: 0 })), cues: Array.from({ length: 5 }, () => []), chat: [] });
  const roll = (keep) => { let st = homeshop.emptyShow(); for (let k = 0; k < 8; k++) st = keep === undefined ? homeshop.applyShow(st, reply(k), `k${k}`) : homeshop.applyShow(st, reply(k), `k${k}`, keep); return st; };
  assert.equal(roll().prev.length, 24);
  assert.deepEqual(roll(5).prev, ['6-0', '6-1', '6-2', '6-3', '6-4']);
  assert.equal(roll(200).prev.length, 35);
  const saved = homeshop.showVars(roll(200));
  assert.equal(homeshop.readShow(saved).prev.length, 24, '읽을 때도 기본 24개');
  assert.equal(homeshop.readShow({ ...saved, $hs_prev_keep: '30' }).prev.length, 30);
  assert.equal(homeshop.readShow({ ...saved, $hs_prev_keep: '모름' }).prev.length, 24);
});
