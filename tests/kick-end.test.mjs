// 저쪽에서 먼저 끝내는 장치 두 곳: 우주 쇼핑몰 「문의 끊음」(<closed/>) · 포인트몰 1:1 상담 「상담 끊음」(<end/>)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = await build({
  stdin: {
    contents: `
      export { mallSettings, mallVarsOf, readMall, cosKickKey } from './src/core/malls';
      export { applyTalk, applyShelf, parseTalk, parseShelf, talkPrompt, markSold, shelfItems, SHOP_KICK_VAR } from './src/core/shop';
      export { deskSettings, DESK_KEY, parseTalk as parseDeskTalk, talkPrompt as deskTalkPrompt, readDesk, deskVars, endDesk } from './src/core/bmdesk';
      export { guideTxt } from './src/core/guides';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const item = (id, price = 1000) => ({ id, name: id, price, desc: '설명', effect: '효과' });
const cosState = () => ({ shop: '우주 쇼핑몰', owner: '운영자', key: 'c1', loaded: true, identity: { sells: '', never: '', prices: '' }, items: [item('별가루'), item('은하수 병')], talk: [{ who: 'me', text: '이거 진짜예요?' }], closed: false, prev: [], sell: null, sales: [] });
const src = (st) => ({ st, refs: '', story: '', status: '', situation: '', identity: '' });
const sysOf = (msgs) => msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
const CLOSE = '<owner>충분하다. 끝이다 문의, 여기서.</owner>\n<change mode="none">\n</change>\n<closed/>';

test('우주 쇼핑몰 「문의 끊음」: 기본 켬, 우주 쇼핑몰 값($cos_sh_kick)만 따른다. 포인트몰은 없음', () => {
  const COS_KICK = M.cosKickKey();
  assert.equal(COS_KICK, '$cos_sh_kick');
  assert.equal(M.mallSettings({}, 'cos').kick, true);
  assert.equal(M.mallSettings({ [M.cosKickKey()]: '0' }, 'cos').kick, false);
  assert.equal(M.mallSettings({ [M.SHOP_KICK_VAR]: '0' }, 'cos').kick, true, '기본 상점의 「거래 끊음」과는 따로');
  assert.equal(M.mallSettings({}, 'bm').kick, false);
  assert.equal(M.mallSettings({ $bm_sh_kick: '1' }, 'bm').kick, false);
});

test('우주 쇼핑몰 문의 요청문: 켬이면 KICK_ON + TALK_OUTPUT_END, 끔이면 KICK_OFF', () => {
  const st = cosState();
  const on = sysOf(M.talkPrompt(src(st), M.mallSettings({}, 'cos'), 'Cos'));
  assert.ok(on.includes(M.guideTxt('Cos', 'KICK_ON')));
  assert.ok(on.includes(M.guideTxt('Cos', 'TALK_OUTPUT_END')));
  assert.ok(!on.includes(M.guideTxt('Cos', 'KICK_OFF')));
  assert.match(M.guideTxt('Cos', 'KICK_ON'), /end the enquiry/);
  const off = sysOf(M.talkPrompt(src(st), M.mallSettings({ [M.cosKickKey()]: '0' }, 'cos'), 'Cos'));
  assert.ok(off.includes(M.guideTxt('Cos', 'KICK_OFF')));
  assert.ok(!off.includes(M.guideTxt('Cos', 'KICK_ON')));
  assert.ok(!off.includes(M.guideTxt('Cos', 'TALK_OUTPUT_END')));
});

test('우주 쇼핑몰: <closed/> 를 읽어 문의가 끊긴다. 끔이면 무시', () => {
  const st = cosState();
  const r = M.parseTalk(CLOSE);
  assert.equal(r.closed, true);
  assert.equal(M.applyTalk(st, r, M.mallSettings({}, 'cos').kick).closed, true);
  assert.equal(M.applyTalk(st, r, M.mallSettings({ [M.cosKickKey()]: '0' }, 'cos').kick).closed, false);
  // 대사 안에서 말로만 한 것은 표식이 아니다
  assert.equal(M.parseTalk('<owner>나는 쓴다 <closed/> 라고, 농담으로.</owner>\n<change mode="none">\n</change>').closed, false);
});

test('우주 쇼핑몰: 끊긴 뒤에도 구매는 된다 (문의만 막는다)', () => {
  const closed = M.applyTalk(cosState(), M.parseTalk(CLOSE), true);
  assert.equal(closed.closed, true);
  // 저장했다 읽어도 끊김과 진열대가 그대로
  const back = M.readMall(M.mallVarsOf('cos', closed), 'cos');
  assert.equal(back.closed, true);
  assert.equal(M.shelfItems(back).length, 2);
  const bought = M.markSold(back, '별가루', 'c1');
  assert.equal(bought.items.find((x) => x.id === '별가루').sold, true);
  assert.equal(M.shelfItems(bought).length, 1);
  // 화면의 사는 길(buy · 결제 · 쪽지 · 견적)은 끊김을 보지 않는다: closed 를 보는 것은 문의 쪽 동작뿐
  const ui = readFileSync(new URL('../src/ui/malls.ts', import.meta.url), 'utf8');
  const fn = ui.slice(ui.indexOf('async function buy('), ui.indexOf('/** data-action 처리.'));
  assert.ok(fn.length > 500 && !fn.includes('closed'));
  const cases = [...ui.matchAll(/\n    case '(mall-[a-z-]+)':[^\n]*\n(?:    case '[^\n]*\n)*([\s\S]*?)(?=\n    case '|\n    default:)/g)];
  const guarded = cases.filter((m) => m[2].includes('st.closed')).map((m) => m[1]).sort();
  assert.deepEqual(guarded, ['mall-pick', 'mall-say', 'mall-sell-open', 'mall-sell-pick']);
});

test('우주 쇼핑몰: 끊김 → 진열 새로고침 → 풀림, 그 전 대화(끊으며 한 말)가 다음 문의 요청문에 들어 있다', () => {
  const s = M.mallSettings({}, 'cos');
  const closed = M.applyTalk(cosState(), M.parseTalk(CLOSE), s.kick);
  assert.equal(closed.closed, true);
  const shelf = M.parseShelf('<owner>새 물건이다.</owner>\n<shelf>\n달 조각|5000|사용|rock|달에서 떼어 온 조각|밤에 빛난다|\n혜성 꼬리|7000|사용|ribbon|혜성의 꼬리 한 가닥|차갑다|\n</shelf>', closed.identity);
  // ui/malls.ts 의 진열 받기와 같은 꼴: 새 진열을 얹고 문의 대화는 그대로 둔다
  const fresh = { ...M.applyShelf(closed, shelf, s), talk: closed.talk };
  assert.equal(fresh.closed, false, '새로고침하면 풀린다');
  assert.ok(M.shelfItems(fresh).some((x) => x.name === '달 조각'));
  const user = M.talkPrompt(src({ ...fresh, talk: [...fresh.talk, { who: 'me', text: '다시 왔어요' }] }), s, 'Cos').at(-1).content;
  assert.ok(user.includes('충분하다. 끝이다 문의, 여기서.'), user.slice(-600));
  assert.ok(user.includes('이거 진짜예요?'));
  assert.ok(user.includes('다시 왔어요'));
});

// ── 포인트몰 1:1 상담 ──
const agent = { id: 'a1', no: '0427', name: '김모', rank: '대리', dept: '복지팀', intro: '소개', voice: '말투', dice: [['직급', '대리']] };
const desk = () => ({ agent, talk: [{ who: 'sys', text: '연결' }, { who: 'op', text: '안녕하세요' }, { who: 'me', text: '네' }], anchor: 'c1', past: [] });
const dsrc = { refs: '', shelf: '', points: 100, nick: '나', language: null, identity: '', status: '', situation: '', story: '' };

test('1:1 상담 「상담 끊음」: 기본 켬, $bm_desk_end=0 이면 끔', () => {
  assert.equal(M.DESK_KEY.end, '$bm_desk_end');
  assert.equal(M.deskSettings({}).end, true);
  assert.equal(M.deskSettings({ [M.DESK_KEY.end]: '0' }).end, false);
});

test('1:1 상담 요청문: 켬이면 END_ON + TALK_OUTPUT_END, 끔이면 END_OFF', () => {
  const on = sysOf(M.deskTalkPrompt(dsrc, desk(), true).messages);
  assert.ok(on.includes(M.guideTxt('BmDesk', 'END_ON')));
  assert.ok(on.includes(`${M.guideTxt('BmDesk', 'TALK_OUTPUT')}\n${M.guideTxt('BmDesk', 'TALK_OUTPUT_END')}`), 'TALK_OUTPUT 바로 뒤');
  assert.ok(!on.includes(M.guideTxt('BmDesk', 'END_OFF')));
  const off = sysOf(M.deskTalkPrompt(dsrc, desk(), false).messages);
  assert.ok(off.includes(M.guideTxt('BmDesk', 'END_OFF')));
  assert.ok(!off.includes(M.guideTxt('BmDesk', 'END_ON')));
  assert.ok(!off.includes(M.guideTxt('BmDesk', 'TALK_OUTPUT_END')));
  assert.equal(M.guideTxt('BmDesk', 'TALK_OUTPUT_END'), '<end/> after the <say> block, only if the counselor ends the chat.');
});

test('1:1 상담: <say> 밖에 놓인 <end/> 만 인정, 끔이면 무시', () => {
  assert.deepEqual(M.parseDeskTalk('<say>이만 가 보겠습니다.</say>\n<end/>'), { say: ['이만 가 보겠습니다.'], ended: true });
  assert.equal(M.parseDeskTalk('<say>이만 가 보겠습니다.</say><end/>').ended, true, '블록 바로 뒤');
  assert.equal(M.parseDeskTalk('<say>이만 가 보겠습니다.</say>\n<end>').ended, true);
  assert.equal(M.parseDeskTalk('<say>이만 가 보겠습니다.</say>\n<end/>', false).ended, false, '끔이면 무시');
  assert.equal(M.parseDeskTalk('<say>네, 말씀하세요.</say>').ended, false);
  assert.equal(M.parseDeskTalk('<say>태그로는 <end/> 라고 씁니다.\n<end/>\n그렇죠.</say>').ended, false, '<say> 안은 아님');
  assert.equal(M.parseDeskTalk('Maybe I should output <end/> here.\n<say>네.</say>').ended, false, '문장 속 언급은 아님');
  assert.throws(() => M.parseDeskTalk('<end/>'), '말이 없으면 실패');
});

test('1:1 상담: 끝났다는 상태는 저장되고, 상담을 끝내면(endDesk) 지워진다', () => {
  const ended = { ...desk(), ended: true };
  const back = M.readDesk(M.deskVars(ended));
  assert.equal(back.ended, true);
  assert.equal(M.readDesk(M.deskVars(desk())).ended, undefined);
  const next = M.endDesk(back);
  assert.equal(next.ended, undefined);
  assert.equal(next.agent, null);
  assert.equal(next.past[0].id, 'a1');
});
