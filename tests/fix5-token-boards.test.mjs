// 토큰 낭비 정리 (게시판 4종·위키) 시험: 같은 글을 한 요청에 두 번 넣지 않는다, 버리는 출력을 쓰게 하지 않는다,
// 늘 붙던 덩어리를 끄거나 줄이는 설정이 듣는다, 채팅이 이어져도 자동 새로고침 결과를 그 턴에 쓴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../dist-test/core.mjs';
import { build } from 'esbuild';

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
  // 출처 댓글은 작업 입력 comments 의 index 로만 (본문은 comments 와 action 에)
  assert.deepEqual(o.incomingOrigin, { post: 100002, comment: { index: 2 } });
  assert.equal(count(text, '무섭네요'), 2);
  assert.equal(JSON.parse(text.slice(0, text.indexOf('\nCOMBINED OUTPUT OPTIONS:')).split('\n').pop()).comments.find((c) => c.index === 2).content, '무섭네요');
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
  assert.equal(all.previousIncoming.length, 6, '기본값 50통 안이면 전부');
  const many = board();
  many.dms = Array.from({ length: 60 }, (_, i) => ({ nick: `보낸이${i}`, side: 'npc', body: `쪽지 ${i}`, unread: false, date: '' }));
  const def = optionsOf(userText(C.refreshPrompt(src(), many, allowed(many), '나', {})));
  assert.equal(def.previousIncoming.length, 50, '기본값: 최근 50통');
  assert.equal(def.previousIncoming[0].body, '쪽지 10');
  const zero = optionsOf(userText(C.refreshPrompt(src({ [ADV('incoming_prev')]: '0' }), many, allowed(many), '나', {})));
  assert.equal(zero.previousIncoming.length, 60, '0 = 전부');
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
  assert.deepEqual(['activity', 'dm_public', 'incoming_prev', 'ctx_recent_posts', 'ctx_recent_dms'].map(v), ['1', '8', '50', '1', '5']);
  assert.deepEqual(C.advanced.advChanged({}, 'gn'), []);
  C.advanced.applyAdvanced({});
  assert.deepEqual([C.HISTORY.activity, C.HISTORY.dmPublic, C.HISTORY.incomingPrev, C.CONTEXT.recentPosts, C.CONTEXT.recentDms], [true, 8, 50, 1, 5]);
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

test('댓글 달기: 선쪽지 출처 댓글이 보이는 댓글 범위 밖이어도 comments 에 넣고 index 만 가리킨다', () => {
  const st = board();
  const p0 = st.posts[1];
  p0.comments = [cm('나', '맨 처음 내 댓글', 0, true), ...Array.from({ length: 40 }, (_, i) => cm(`n${i}`, `댓글 ${i}`))];
  const plan = allowed(st, { post: p0, commentIndex: 1 });
  const p = C.commentPrompt(src(), st, 100002, 41, '댓글 39', plan, '나', {});
  const text = userText(p);
  assert.equal(optionsOf(text).incomingOrigin.comment.index, 1);
  assert.ok(p.supplied.has(1));
  assert.equal(count(text, '맨 처음 내 댓글'), 1);
});

test('새로고침: 새 댓글 하나가 저장 댓글과 같아도 다른 새 댓글의 답글 연결은 그대로다', () => {
  const st = { posts: [post(100002, { comments: [cm('a', 'ㅋㅋㅋ'), cm('b', '진짜?'), cm('c', '무섭다')] })], archive: [], dms: [], sources: {}, seq: 100002 };
  const o = { nick: '나', settings: C.gnetSettings({}), date: '2025.01.02 10:00' };
  const got = (comments) => C.applyBoard(st, st, { posts: [{ id: 100002, views: 9, upvotes: 2, comments }] }, o).st.posts[0].comments.map((c) => [c.nick, c.parent]);
  // 새 꼴: 저장 3개 뒤에 4·5·6. 4번(a:ㅋㅋㅋ)은 저장 1번과 같아 버리고, x 는 3번(c)에, y 는 5번(x)에
  assert.deepEqual(got([{ author: 'a', content: 'ㅋㅋㅋ', parent: 0 }, { author: 'x', content: 'c에게 답', parent: 3 }, { author: 'y', content: 'x에게 답', parent: 5 }]),
    [['a', 0], ['b', 0], ['c', 0], ['x', 3], ['y', 4]]);
  // 옛 꼴(저장 댓글을 앞에 그대로)도 그대로 읽는다
  assert.deepEqual(got([{ author: 'a', content: 'ㅋㅋㅋ' }, { author: 'b', content: '진짜?' }, { author: 'c', content: '무섭다' }, { author: 'x', content: 'c에게 답', parent: 3 }, { author: 'y', content: 'x에게 답', parent: 4 }]),
    [['a', 0], ['b', 0], ['c', 0], ['x', 3], ['y', 4]]);
});

test('새로고침: 앞 새 댓글이 모두 저장 댓글과 같아도 parent 가 새 번호로만 맞으면 새 꼴로 읽는다', () => {
  const st = { posts: [post(100002, { comments: [cm('a', 'ㅋㅋㅋ')] })], archive: [], dms: [], sources: {}, seq: 100002 };
  const o = { nick: '나', settings: C.gnetSettings({}), date: '2025.01.02 10:00' };
  const got = (comments) => C.applyBoard(st, st, { posts: [{ id: 100002, views: 9, upvotes: 2, comments }] }, o).st.posts[0].comments.map((c) => [c.nick, c.parent]);
  // 새 꼴: 저장 1개 뒤에 2·3·4. 2번(a:ㅋㅋㅋ)은 저장 1번과 같아 버리고, x 는 1번(a)에, y 는 3번(x)에
  assert.deepEqual(got([{ author: 'a', content: 'ㅋㅋㅋ', parent: 0 }, { author: 'x', content: 'a에게 답', parent: 1 }, { author: 'y', content: 'x에게 답', parent: 3 }]),
    [['a', 0], ['x', 1], ['y', 2]]);
  // 옛 꼴(저장 댓글을 앞에 그대로, 번호는 배열 차례)은 그대로
  assert.deepEqual(got([{ author: 'a', content: 'ㅋㅋㅋ' }, { author: 'x', content: 'a에게 답', parent: 1 }, { author: 'y', content: 'x에게 답', parent: 2 }]),
    [['a', 0], ['x', 1], ['y', 2]]);
});

test('새로고침: 남긴 글에 저장 댓글이 있으면 새 댓글이 없어도 「댓글이 하나도 없어요」가 아니다', () => {
  const st = { posts: [post(100002, { comments: [cm('a', 'ㅋㅋㅋ'), cm('b', '진짜?'), cm('c', '무섭다')] })], archive: [], dms: [], sources: {}, seq: 100002 };
  const o = { nick: '나', settings: C.gnetSettings({}), date: '2025.01.02 10:00' };
  const r = C.applyBoard(st, st, { posts: [{ id: 100002, views: 9, upvotes: 2, comments: [] }] }, o);
  assert.equal(r.emptyComments, false);
  assert.equal(r.st.posts[0].comments.length, 3);
  const bare = { posts: [post(100002)], archive: [], dms: [], sources: {}, seq: 100002 };
  assert.equal(C.applyBoard(bare, bare, { posts: [{ id: 100002, views: 9, upvotes: 2, comments: [] }] }, o).emptyComments, true);
});

test('메인 요청: 같은 안내문의 둘째 게시판은 안내문 없이 만들어 상한에서 세지 않고, 앞 게시판이 비면 안내문을 옮겨 붙인다', () => {
  const st = board();
  C.advanced.applyAdvanced({ [ADV('ctx_focus')]: '0' });
  const RULE = 'LONGRULE '.repeat(300);
  const full = C.mainContext(st, '나', RULE, null, '괴담갤');
  const bare = C.mainContext(st, '나', '', null, '괴담갤');
  assert.ok(bare.startsWith('[MODULE_CONTEXT_BEGIN]\n{"feature":"gnet","site":"괴담갤"'), '빈 안내문이면 빈 줄도 없다');
  // 게시판별 상한이 안내문 크기만큼 작으면 안내문을 세는 쪽은 글이 덜 들어간다
  const cap = C.tokens(bare);
  C.advanced.applyAdvanced({ [ADV('ctx_focus')]: '0', [ADV('ctx_tokens')]: String(cap) });
  assert.equal(C.mainContext(st, '나', '', null, '괴담갤'), bare);
  assert.ok(C.mainContext(st, '나', RULE, null, '괴담갤').length < full.length);
  C.advanced.applyAdvanced({ [ADV('ctx_focus')]: '0' });
  const first = C.mainContext(st, '나', RULE, null, '괴담넷');
  assert.deepEqual(C.shareContextRules([first, bare], [RULE, RULE]), [first, bare]);
  // 앞 게시판 덩어리가 비면 다음 덩어리가 안내문을 갖는다
  assert.equal(C.shareContextRules(['', bare], [RULE, RULE])[1], full);
  C.advanced.applyAdvanced({});
});

test('위키 자동 작성: 제목 고르기 요청이 요청 토큰 상한을 넘으면 모델을 부르지 않고, 위키 화면에 까닭을 남긴다', async () => {
  // 채팅 저장·모델 호출만 바꿔 끼운 위키 화면 모듈
  const stubs = {
    'host/risu': `let chat = null; export const setChat = (c) => { chat = c; };
      export async function updateChat(a, b, f) { chat = f(chat); return chat; }
      export const updateChatOf = (ctx, f) => updateChat(ctx.charIndex, ctx.chatIndex, f);
      export async function getChar() { return null; } export async function updateCharacterLore() { return true; } export async function setAssetCopy() { return []; }
      export function onLoreSaved() { return () => {}; } export function notifyLoreSaved() {} export async function loadContext() { return null; }`,
    'host/llm': `export const calls = []; export class LlmError extends Error {}
      export async function generate(messages) { calls.push(messages); throw new Error('stub'); }
      export const stripThoughts = (s) => s; export async function runModel() { return ''; }`,
  };
  const out = await build({
    stdin: { contents: "export { autoWriteWiki, wiki, wikiOpenCheck } from './src/ui/wiki'; export { setChat } from './src/host/risu'; export { calls } from './src/host/llm';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'error',
    plugins: [{ name: 'stub', setup(b) {
      b.onResolve({ filter: /host\/(risu|llm)$/ }, (a) => ({ path: a.path.match(/host\/(risu|llm)$/)[0], namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js' }));
    } }],
  });
  const W = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  const lore = [{ comment: '🚧괴이', key: 'folder:a', mode: 'folder', content: '' }, { comment: '명일 아파트', key: 'Myeongil Apartment, 명일 아파트', content: '설정', mode: 'normal', folder: 'folder:a' }];
  const chat = { message: [{ role: 'user', data: '가 '.repeat(400), chatId: 'u1' }, { role: 'char', data: '나 '.repeat(400), chatId: 'c1' }], scriptstate: { $nw_auto: 'open', $nw_adv_budget: '50' }, localLore: [] };
  W.setChat(chat);
  const ctx = { charIndex: 0, chatIndex: 0, char: { name: '괴이', desc: '', globalLore: lore }, chat };
  let renders = 0;
  const env = { render: () => renders++, refresh: async () => {}, current: () => ctx };
  W.wikiOpenCheck(ctx, env);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(W.calls.length, 0, '상한을 넘는 요청은 보내지 않는다');
  assert.ok(W.wiki.notice.startsWith('자동 작성 제목을 고르지 못했어요.'), W.wiki.notice);
  assert.ok(W.wiki.notice.includes('토큰 상한'));
  assert.ok(renders > 0);
});

test('다양성 강화: 확률이 더 낮은 벌을 쓰고, 확률이 없거나 같으면 두 번째 벌', () => {
  const A = [{ id: 1 }], B = [{ id: 2 }];
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B, postsProb: 0.08, alternativeProb: 0.03 }), B);
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B, postsProb: 0.02, alternativeProb: 0.07 }), A, '순서가 거꾸로면 첫 벌');
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B, postsProb: 0.05, alternativeProb: 0.05 }), B);
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B }), B, '확률 없음');
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B, postsProb: 'x', alternativeProb: 0.1 }), B);
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B, postsProb: null, alternativeProb: 0.06 }), B, '빈 확률 칸은 0 이 아니다');
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: B, postsProb: '', alternativeProb: 0.06 }), B);
  assert.equal(C.sampledBoard({ posts: A, alternativePosts: [] }), A, '두 번째 벌이 비면 첫 벌');
  assert.equal(C.sampledBoard({ posts: [], alternativePosts: B, postsProb: 0.01, alternativeProb: 0.09 }), B, '첫 벌이 비면 두 번째 벌');
});

test('새로고침: 댓글은 글마다 최근 30개와 그 윗댓글만 넘기고, 돌아온 번호는 넘긴 차례로 읽는다', () => {
  const st = board();
  // 댓글 80개: 1번은 뿌리, 75번은 1번의 답글, 나머지는 뿌리
  st.posts[1].comments = Array.from({ length: 80 }, (_, i) => cm(`c${i + 1}`, `댓글 ${i + 1}`, i + 1 === 75 ? 1 : 0));
  const plan = C.incomingPlan(src().chat, st, { ...C.gnetSettings({}), incoming: false }, '나', () => 0);
  const prompt = C.refreshPrompt(src(), st, plan, '나', {});
  const text = userText(prompt);
  const line = text.split('\n').find((l) => l.includes('"posts"') && l.includes('댓글 80'));
  const sent = JSON.parse(line.slice(line.indexOf('{"posts"'))).posts.find((p) => p.id === 100002).comments;
  assert.equal(sent.length, 31, '최근 30개 + 75번의 윗댓글 1번');
  assert.deepEqual([sent[0].content, sent[1].content, sent[30].content], ['댓글 1', '댓글 51', '댓글 80']);
  assert.equal(sent.find((c) => c.content === '댓글 75').parent, 1, 'parent 는 넘긴 배열 안의 차례');
  assert.ok(!text.includes('댓글 50"'), '옛 댓글은 안 넘긴다');
  // 응답: 새 댓글만. parent 2 = 넘긴 둘째(저장 51번), parent 32 = 첫 새 댓글
  const value = { posts: [{ id: 100002, comments: [{ author: '새1', content: '51번에 답', parent: 2 }, { author: '새2', content: '새1에 답', parent: 32 }, { author: '새3', content: '뿌리', parent: 0 }] }] };
  const got = C.applyBoard(st, structuredClone(st), value, { nick: '나', settings: C.gnetSettings({}), date: '2025.01.01 11:00', sent: prompt.sent }).st.posts.find((p) => p.id === 100002).comments;
  assert.equal(got.length, 83);
  assert.deepEqual(got.slice(80).map((c) => c.parent), [51, 81, 0]);
});

test('새로고침: 내 글도 참조할 글 수 안의 것만 넘기고, 안 넘긴 내 글은 그대로 남는다', () => {
  const st = board();
  st.posts = [...Array.from({ length: 12 }, (_, i) => post(100100 + i)), post(100001, { mine: true, nick: '나', body: '뒤로 밀린 내 글' })];
  st.seq = 100200;
  const plan = C.incomingPlan(src().chat, st, { ...C.gnetSettings({}), incoming: false }, '나', () => 0);
  st.posts[12].comments = [cm('a', '옛 댓글')];
  const prompt = C.refreshPrompt(src(), st, plan, '나', {});
  const text = userText(prompt);
  assert.ok(!text.includes('뒤로 밀린 내 글'));
  assert.ok(!text.includes('100001'), '안 넘긴 글은 번호도 알리지 않는다');
  // 모델이 못 본 글을 돌려줘도 그 글은 그대로 둔다
  const value = { posts: [{ id: 100201, author: 'x', title: '새 글', content: '새 본문', comments: [] }, { id: 100001, views: 99, comments: [{ author: 'z', content: '지어낸 댓글', parent: 0 }] }] };
  const res = C.applyBoard(st, structuredClone(st), value, { nick: '나', settings: C.gnetSettings({}), date: '2025.01.01 11:00', sent: prompt.sent });
  assert.deepEqual(res.st.posts.find((p) => p.id === 100001).comments.map((c) => c.body), ['옛 댓글']);
});

test('쪽지 원글: 글이 살아 있으면 본문을 상대마다 또 적지 않고, 글이 사라지면 사본을 남긴다', () => {
  const st = board();
  for (const q of st.posts) q.id += 2000000;
  st.seq += 2000000;
  const long = '긴 본문 '.repeat(200);
  st.posts[2].body = long;
  for (let i = 0; i < 30; i++) st.sources[`상대${i}`] = C.sourceFor(st.posts[2], 0);
  st.sources['댓글상대'] = C.sourceFor(st.posts[1], 1);
  const raw = C.encode(st);
  assert.equal(count(raw, long.trim().slice(0, 40)) >= 1, true);
  assert.equal(raw.split('\n').filter((l) => l.startsWith('T|') && l.includes('긴 본문')).length, 0, 'T 줄에는 본문이 없다');
  const back = C.decode(raw);
  assert.deepEqual(back.sources, st.sources, '읽으면 전과 같은 원글');
  // 글이 게시판·보관함에서 사라진 뒤 저장: 사본이 T 줄에 남는다
  back.posts = back.posts.filter((p) => p.id !== 2100001);
  const raw2 = C.encode(back);
  assert.equal(raw2.split('\n').filter((l) => l.startsWith('T|') && l.includes('긴 본문')).length, 30);
  assert.deepEqual(C.decode(raw2).sources, st.sources);
  // 보관함으로 간 글은 번호만으로 찾는다
  const arch = C.decode(raw);
  arch.archive.push(...arch.posts.splice(2, 1));
  assert.deepEqual(C.decode(C.encode(arch)).sources, st.sources);
});

test('공개 글 참고의 댓글 수·전체 길이, 주요 인물 닉네임 수: 기본값은 전과 같고 설정으로 바뀐다', () => {
  const v = (k) => C.advanced.advValue({}, 'gn', k);
  assert.deepEqual(['dm_public_comments', 'dm_public_chars', 'keyfig_keep'].map(v), ['12', '12000', '60']);
  C.advanced.applyAdvanced({});
  assert.deepEqual([C.HISTORY.dmPublicComments, C.HISTORY.dmPublicChars, C.HISTORY.keyFigures], [12, 12000, 60]);

  const many = () => ({ posts: [post(100001, { comments: Array.from({ length: 20 }, (_, i) => cm(`c${i + 1}`, `댓글 ${i + 1}`)) })], archive: [], dms: [], sources: {}, seq: 100001 });
  const ids = (st) => C.publicBoard(st, '', 'A').posts[0].comments.map((c) => c.id);
  assert.deepEqual(ids(many()), Array.from({ length: 12 }, (_, i) => i + 9), '기본: 최근 12개');
  C.advanced.applyAdvanced({ [ADV('dm_public_comments')]: '3' });
  assert.deepEqual(ids(many()), [18, 19, 20]);
  C.advanced.applyAdvanced({ [ADV('dm_public_comments')]: '0' });
  assert.deepEqual(ids(many()), [], '0이면 댓글은 안 넣음');
  for (const bad of ['-1', '201', '1.5', 'x', '']) {
    C.advanced.applyAdvanced({ [ADV('dm_public_comments')]: bad });
    assert.equal(C.HISTORY.dmPublicComments, 12, `틀린 값 ${bad}`);
  }

  // 전체 길이: 기본(12000자)에서는 긴 글 셋 가운데 둘만, 줄이면 하나, 늘리면 다 들어간다
  const long = () => ({ posts: [1, 2, 3].map((i) => post(100000 + i, { body: 'abcd '.repeat(900) })), archive: [], dms: [], sources: {}, seq: 100003 });
  C.advanced.applyAdvanced({});
  assert.equal(C.publicBoard(long(), '', 'A').posts.length, 2);
  C.advanced.applyAdvanced({ [ADV('dm_public_chars')]: '5000' });
  assert.equal(C.publicBoard(long(), '', 'A').posts.length, 1);
  C.advanced.applyAdvanced({ [ADV('dm_public_chars')]: '50000' });
  assert.equal(C.publicBoard(long(), '', 'A').posts.length, 3);
  for (const bad of ['0', '999', '200001', 'x']) {
    C.advanced.applyAdvanced({ [ADV('dm_public_chars')]: bad });
    assert.equal(C.HISTORY.dmPublicChars, 12000, `틀린 값 ${bad}`);
  }

  // 주요 인물 닉네임 수
  const rows = Array.from({ length: 70 }, (_, i) => ({ keyFigure: `인물${i + 1}`, nickname: `닉${i + 1}`, note: '' }));
  C.advanced.applyAdvanced({});
  const kept = C.keyFigures(C.mergeKeyFigures({}, rows));
  assert.equal(kept.length, 60);
  assert.equal(kept[0].keyFigure, '인물11');
  C.advanced.applyAdvanced({ [ADV('keyfig_keep')]: '5' });
  assert.deepEqual(C.keyFigures(C.mergeKeyFigures({}, rows)).map((x) => x.keyFigure), ['인물66', '인물67', '인물68', '인물69', '인물70']);
  for (const bad of ['0', '501', 'x']) {
    C.advanced.applyAdvanced({ [ADV('keyfig_keep')]: bad });
    assert.equal(C.HISTORY.keyFigures, 60, `틀린 값 ${bad}`);
  }
  C.advanced.applyAdvanced({});
});
