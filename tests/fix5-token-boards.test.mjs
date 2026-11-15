// 토큰 낭비 정리 (게시판 4종·위키) 시험: 같은 글을 한 요청에 두 번 넣지 않는다, 버리는 출력을 쓰게 하지 않는다,
// 늘 붙던 덩어리를 끄거나 줄이는 설정이 듣는다, 채팅이 이어져도 자동 새로고침 결과를 그 턴에 쓴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../dist-test/core.mjs';

const ADV = (k) => `$lb_cfg_lb-gn.adv_${k}`;
const BODY = '3층 복도 불이 깜빡인다. 어제 밤부터 계속 그런다';
const src = (vars = {}, message = [{ role: 'user', data: '가' }, { role: 'char', data: '나' }]) => ({ char: { name: '괴이', desc: '', globalLore: [] }, chat: { message, scriptstate: vars, localLore: [] } });
const post = (id, extra = {}) => ({ id, nick: `n${id}`, title: `글 ${id}`, body: `본문 ${id}`, date: '2025.01.01 10:00', views: 3, votes: 1, mine: false, comments: [], ...extra });
const cm = (nick, body, parent = 0, mine = false) => ({ nick, body, parent, mine, unread: false, date: '2025.01.01 10:05' });
const board = () => ({
  posts: [post(100003), post(100002, { body: BODY, comments: [cm('댓글러', '저도 봤어요'), cm('나', '무섭네요', 0, true)] }), post(100001, { mine: true, nick: '나', body: '내 글 본문' })],
  archive: [], dms: [], sources: {}, seq: 100003,
});
const userText = (p) => p.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
const sysText = (p) => p.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
const count = (text, part) => text.split(part).length - 1;
const allowed = (st, origin) => C.incomingPlan(src().chat, st, C.gnetSettings({}), '나', () => 0, origin);
const optionsOf = (text) => JSON.parse(text.slice(text.indexOf('COMBINED OUTPUT OPTIONS:') + 'COMBINED OUTPUT OPTIONS:'.length).trim().split('\n')[0]);

test('댓글 달기: 대상 글의 본문·댓글은 요청에 한 번만 들어간다 (다른 글 활동·선쪽지 출처에 다시 넣지 않는다)', () => {
  const st = board();
  const plan = allowed(st, { post: st.posts[1], commentIndex: 2 });
  assert.equal(plan.allowed, true);
  const p = C.commentPrompt(src(), st, 100002, 2, '무섭네요', plan, '나', {});
  const text = userText(p);
  assert.equal(count(text, BODY), 1, '대상 글 본문은 작업 입력에만');
  assert.equal(count(text, '저도 봤어요'), 1, '대상 글 댓글은 작업 입력에만');
  const o = optionsOf(text);
  assert.deepEqual(o.incomingOrigin, { post: 100002, title: '글 100002', author: 'n100002', comment: { author: '나', content: '무섭네요' } });
  const target = o.activityPosts.find((x) => x.id === 100002);
  assert.deepEqual(target, { id: 100002, author: 'n100002', title: '글 100002', date: '2025.01.01 10:00', views: 3, upvotes: 1, commentCount: 2, commentsAllowed: false });
  // 다른 글은 그대로 본문·댓글과 함께
  assert.equal(o.activityPosts.find((x) => x.id === 100003).content, '본문 100003');
  // 대상 글의 조회·추천 증가는 여전히 받는다
  const [changed] = C.applyActivity(st, [{ id: 100002, viewsDelta: 4 }], p.activity.snapshots, '나');
  assert.equal(changed, true);
  assert.equal(st.posts[1].views, 7);
});

test('글 하나만 새로고침: 대상 글은 한 번만, 「지난 글 활동」을 끄면 다른 글을 넘기지 않는다', () => {
  const st = board();
  const plan = C.incomingPlan(src().chat, st, { ...C.gnetSettings({}), incoming: false }, '나', () => 0);
  const on = C.commentPrompt(src(), st, 100002, 0, '', plan, '나', {}, C.POST_REFRESH_ACTION, 'refresh');
  assert.equal(count(userText(on), BODY), 1);
  assert.ok(userText(on).includes('본문 100003'), '기본값: 다른 글도 넘긴다');
  const off = C.commentPrompt(src({ [ADV('activity')]: '0' }), st, 100002, 0, '', plan, '나', {}, C.POST_REFRESH_ACTION, 'refresh');
  assert.ok(!userText(off).includes('본문 100003'));
  assert.deepEqual(optionsOf(userText(off)).activityPosts, []);
  assert.equal(off.activity.snapshots.size, 0);
  assert.ok(sysText(off).includes('No activityPosts are supplied'));
  assert.ok(!sysText(off).includes('simulate modest readership'));
  C.advanced.applyAdvanced({});
});

test('글 쓰기: 「지난 글 활동」을 끄면 게시판 글을 넘기지 않고, 켜 두면 지금처럼 넘긴다', () => {
  const st = board();
  const plan = C.incomingPlan(src().chat, st, { ...C.gnetSettings({}), incoming: false }, '나', () => 0);
  assert.ok(userText(C.postPrompt(src(), st, '새 글 생각', plan, {})).includes('본문 100003'));
  const off = C.postPrompt(src({ [ADV('activity')]: '0' }), st, '새 글 생각', plan, {});
  assert.ok(!userText(off).includes('본문 100003'));
  assert.equal(off.activity.posts.length, 0);
  C.advanced.applyAdvanced({});
});

test('글 쓰기: 내가 적은 내용은 한 번만 들어가고, 말머리를 골랐으면 post.tag 를 쓰게 하지 않는다', () => {
  const st = board();
  const input = '어제 본 복도 이야기를 써 줘';
  const draft = { id: 0, date: '', nick: '나', title: '', body: input, views: 0, votes: 0, mine: true, comments: [] };
  const plan = allowed(st, { post: draft });
  assert.equal(plan.allowed, true);
  const p = C.postPrompt(src(), st, input, plan, {});
  assert.equal(count(userText(p), input), 1);
  const o = optionsOf(userText(p));
  assert.equal(o.incomingAllowed, true);
  assert.equal(o.incomingOrigin, undefined, '출처는 이 응답이 완성하는 글');
  assert.ok(Array.isArray(o.previousIncoming));
  assert.ok(sysText(p).includes('Also give post.tag'));
  const tagged = C.postPrompt(src(), st, input, plan, {}, '팝니다');
  assert.ok(!sysText(tagged).includes('Also give post.tag'));
  assert.ok(userText(tagged).includes(`[팝니다] ${input}`));
});

test('새로고침: 선쪽지 출처는 그대로 본문과 함께 가고, 받은 쪽지는 정한 수만큼만 넘긴다', () => {
  const st = board();
  st.dms = Array.from({ length: 6 }, (_, i) => ({ nick: `보낸이${i}`, side: 'npc', body: `쪽지 ${i}`, unread: false, date: '' }));
  const plan = allowed(st);
  const all = optionsOf(userText(C.refreshPrompt(src(), st, plan, '나', {})));
  assert.equal(all.incomingOrigin.content, BODY, '출처 글이 작업 입력에 따로 없으니 본문과 함께');
  assert.equal(all.previousIncoming.length, 6, '기본값: 전부');
  const two = optionsOf(userText(C.refreshPrompt(src({ [ADV('incoming_prev')]: '2' }), st, plan, '나', {})));
  assert.deepEqual(two.previousIncoming.map((m) => m.body), ['쪽지 4', '쪽지 5']);
  // 넘기지 않은 옛 쪽지와 같은 것이 와도 저장할 때 걸러진다
  assert.equal(C.commitIncoming(st, [{ nick: '보낸이0', body: '쪽지 0' }], plan, ''), false);
  C.advanced.applyAdvanced({});
});

test('새로고침: 넘기는 글에 time 칸이 없고, 지침은 남긴 글을 다시 쓰게 하지 않는다', () => {
  const st = board();
  const plan = C.incomingPlan(src().chat, st, { ...C.gnetSettings({}), incoming: false }, '나', () => 0);
  const p = C.refreshPrompt(src(), st, plan, '나', {});
  assert.ok(!JSON.parse(C.boardJson(st.posts)).posts.some((x) => 'time' in x));
  const sys = sysText(p);
  assert.ok(!sys.includes('"time":"14:27"'));
  assert.ok(!sys.includes('Copy retained fields verbatim'));
  assert.ok(!sys.includes('keep all saved comments in order'));
  assert.ok(sys.includes('comments holds NEW comments only'));
});

test('새로고침 반영: 남긴 글은 번호·조회·추천·새 댓글만 와도 되고, 새 댓글의 parent 는 저장 댓글 번호를 가리킨다', () => {
  const st = board();
  const opts = { nick: '나', settings: C.gnetSettings({}), date: '2025.01.01 12:00' };
  const value = { posts: [
    { author: 'x', id: 100010, title: '새 글', date: '2025.01.01 11:00', views: 5, upvotes: 1, content: '새 본문', mine: false, comments: [] },
    { id: 100002, views: 30, upvotes: 4, comments: [{ author: 'r1', content: '저도요', parent: 1 }, { author: 'r2', content: '어디예요', parent: 3 }, { author: 'r3', content: '새 줄기', parent: 0 }] },
  ] };
  const res = C.applyBoard(st, structuredClone(st), value, opts);
  const kept = res.st.posts.find((p) => p.id === 100002);
  assert.deepEqual([kept.nick, kept.title, kept.body, kept.date], ['n100002', '글 100002', BODY, '2025.01.01 10:00']);
  assert.deepEqual([kept.views, kept.votes], [30, 4]);
  assert.deepEqual(kept.comments.map((c) => [c.nick, c.body, c.parent]), [['댓글러', '저도 봤어요', 0], ['나', '무섭네요', 0], ['r1', '저도요', 1], ['r2', '어디예요', 3], ['r3', '새 줄기', 0]]);
  // 내 글은 응답에 없어도 남는다
  assert.ok(res.st.posts.some((p) => p.id === 100001));
});

test('새로고침 반영: 저장 댓글을 그대로 다시 쓴 옛 꼴 응답도 전과 같이 읽는다', () => {
  const st = board();
  const opts = { nick: '나', settings: C.gnetSettings({}), date: '2025.01.01 12:00' };
  const value = { posts: [{ author: 'n100002', id: 100002, title: '글 100002', time: '10:00', date: '2025.01.01 10:00', views: 30, upvotes: 4, content: BODY, mine: false, comments: [
    { author: '댓글러', content: '저도 봤어요', parent: 0, mine: false }, { author: '나', content: '무섭네요', parent: 0, mine: true },
    { author: 'r1', content: '저도요', parent: 1, mine: false }, { author: 'r2', content: '어디예요', parent: 3, mine: false },
  ] }] };
  const kept = C.applyBoard(st, structuredClone(st), value, opts).st.posts.find((p) => p.id === 100002);
  assert.deepEqual(kept.comments.map((c) => [c.nick, c.parent]), [['댓글러', 0], ['나', 0], ['r1', 1], ['r2', 3]]);
});

test('쪽지 답장: 공개 글 수를 정할 수 있고(0이면 안 넣음), 원글은 본문을 두 번 넣지 않는다', () => {
  const st = board();
  st.dms = [{ nick: 'n100002', side: 'me', body: '글 봤어요', unread: false, date: '' }];
  st.sources = { n100002: C.sourceFor(st.posts[1], 0) };
  const def = userText(C.dmPrompt(src(), st, 'n100002', '글 봤어요', '나', {}));
  assert.ok(def.includes('PUBLIC BOARD REFERENCE:'));
  assert.equal(count(def, BODY), 1, '원글 본문은 PUBLIC ORIGIN 에만');
  assert.ok(def.includes('저도 봤어요'), '원글의 댓글은 공개 글 참고에 그대로');
  assert.ok(def.includes('본문 100003'));
  const one = userText(C.dmPrompt(src({ [ADV('dm_public')]: '1' }), st, 'n100002', '안녕', '나', {}));
  assert.equal(JSON.parse(one.slice(one.indexOf('PUBLIC BOARD REFERENCE:')).split('\n')[1]).posts.length, 1);
  const none = userText(C.dmPrompt(src({ [ADV('dm_public')]: '0' }), st, 'n100002', '안녕', '나', {}));
  assert.ok(!none.includes('PUBLIC BOARD REFERENCE:'));
  assert.ok(none.includes(BODY), '원글은 그대로');
  C.advanced.applyAdvanced({});
  // 원글이 그 뒤에 바뀌었으면 공개 글 참고에는 지금 본문이 간다
  st.posts[1].body = '고친 본문';
  assert.ok(userText(C.dmPrompt(src(), st, 'n100002', '안녕', '나', {})).includes('고친 본문'));
  // 괴담톡이 쓰는 공개 글 참고는 그대로 (최대 8개, 본문 포함)
  assert.equal(C.publicBoard(st, '', 'A').posts.length, 3);
});

test('메인 요청: access 글은 덩어리에 한 번, 같은 안내문은 처음 붙는 게시판 덩어리에만', () => {
  const st = board();
  st.dms = [{ nick: 'x', side: 'npc', body: '응', unread: false, date: '' }];
  C.advanced.applyAdvanced({ [ADV('ctx_focus')]: '0' });
  const text = C.mainContext(st, '나', 'RULES', null, '괴담넷');
  assert.equal(count(text, 'publicly accessible; reading by each character is not established'), 1);
  assert.equal(count(text, 'sender and recipient only'), 1);
  const onlyPosts = JSON.parse(C.mainContext({ ...st, dms: [] }, '나', 'RULES').split('\n')[2]);
  assert.deepEqual(Object.keys(onlyPosts.access), ['public_post'], '넣은 종류만');
  const other = C.mainContext(st, '나', 'RULES', null, '괴담갤');
  const diff = C.mainContext(st, '나', 'OTHER', null, '세정게');
  const out = C.shareContextRules([text, '', other, diff], ['RULES', 'RULES', 'RULES', 'OTHER']);
  assert.equal(out[0], text);
  assert.equal(out[1], '');
  assert.ok(out[2].startsWith('[MODULE_CONTEXT_BEGIN]\n{"feature":"gnet","site":"괴담갤"'), '같은 안내문은 다시 넣지 않는다');
  assert.equal(out[3], diff, '다른 안내문은 그대로');
  // 앞 게시판이 붙지 않았으면 다음 게시판이 안내문을 갖는다
  assert.equal(C.shareContextRules(['', other], ['RULES', 'RULES'])[1], other);
  C.advanced.applyAdvanced({});
});

test('메인 요청: 장면과 무관하게 늘 넣는 최근 글·쪽지 수를 정할 수 있다 (기본 1·5)', () => {
  const st = board();
  st.dms = Array.from({ length: 7 }, (_, i) => ({ nick: `보낸이${i}`, side: 'npc', body: `쪽지 ${i}`, unread: false, date: '' }));
  const f = { scene: '아무 관련 없는 장면', terms: [] };
  const records = (state) => {
    C.advanced.applyAdvanced(state);
    const t = C.mainContext(st, '나', 'R', f);
    return t ? JSON.parse(t.split('\n')[2]).records : [];
  };
  const base = records({});
  assert.equal(base.filter((r) => r.kind === 'public_post').length, 1);
  assert.equal(base.filter((r) => r.kind === 'private_message').length, 5);
  const less = records({ [ADV('ctx_recent_posts')]: '0', [ADV('ctx_recent_dms')]: '2' });
  assert.equal(less.filter((r) => r.kind === 'public_post').length, 0);
  assert.deepEqual(less.filter((r) => r.kind === 'private_message').map((r) => r.content), ['쪽지 5', '쪽지 6']);
  assert.deepEqual(records({ [ADV('ctx_recent_posts')]: '0', [ADV('ctx_recent_dms')]: '0' }), []);
  C.advanced.applyAdvanced({});
});

test('새 설정의 기본값은 지금 동작 그대로다', () => {
  const v = (k) => C.advanced.advValue({}, 'gn', k);
  assert.deepEqual(['activity', 'dm_public', 'incoming_prev', 'ctx_recent_posts', 'ctx_recent_dms'].map(v), ['1', '8', '0', '1', '5']);
  assert.deepEqual(C.advanced.advChanged({}, 'gn'), []);
  C.advanced.applyAdvanced({});
  assert.deepEqual([C.HISTORY.activity, C.HISTORY.dmPublic, C.HISTORY.incomingPrev, C.CONTEXT.recentPosts, C.CONTEXT.recentDms], [true, 8, 0, 1, 5]);
});

test('자동 새로고침 결과: 채팅이 이어져도 그 응답이 그대로면 쓰고, 다시 굴렸거나 지웠으면 쓰지 않는다', () => {
  const chat = { message: [{ role: 'user', data: '가', chatId: 'u1' }, { role: 'char', data: '나', chatId: 'c1' }] };
  const made = { index: 1, data: '나', turn: C.turnKeyAt(chat, 1) };
  assert.equal(C.turnResultValid(chat, made), true);
  const longer = { message: [...chat.message, { role: 'user', data: '다', chatId: 'u2' }, { role: 'char', data: '라', chatId: 'c2' }] };
  assert.equal(C.turnResultValid(longer, made), true, '뒤에 메시지가 붙은 것은 괜찮다');
  assert.equal(C.turnResultValid({ message: [chat.message[0], { role: 'char', data: '다시 굴린 응답', chatId: 'c1' }] }, made), false);
  assert.equal(C.turnResultValid({ message: [chat.message[0]] }, made), false);
  assert.equal(C.turnResultValid({ message: [{ role: 'user', data: '고친 입력', chatId: 'u9' }, chat.message[1]] }, made), false);
});

test('위키 제목 고르기: 요청 토큰 상한을 걸면 챗로그를 줄이고, 상한이 없으면 그대로다', () => {
  const message = Array.from({ length: 16 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `이야기-${i}-끝 `.repeat(40) }));
  const build = () => ({ messages: C.wikiTitlePrompt(src({}, message), ['오후역', '어둠의 정원'], [], {}) });
  const full = build();
  const size = C.budget.promptTokens(full);
  assert.deepEqual(C.budget.fitPrompt(0, build), full);
  const cut = C.budget.fitPrompt(Math.floor(size * 0.6), build);
  assert.ok(C.budget.promptTokens(cut) <= Math.floor(size * 0.6));
  assert.ok(cut.messages[1].content.includes('오후역'), '후보 제목은 그대로');
  assert.ok(cut.messages[1].content.includes('이야기-15-끝'), '가장 새 챗로그는 남는다');
  assert.ok(!cut.messages[1].content.includes('이야기-0-끝'));
});

test('위키 지침: 여는 태그에 asset_src 를 쓰게 하지 않고, 옛 응답의 asset_src 는 그대로 받는다', () => {
  const fmt = C.guideDefaultSec('Wiki', 'NW.FORMAT');
  assert.ok(fmt.includes('<lightboard-namuwiki doc_title='));
  assert.ok(!fmt.includes('asset_src'));
});
