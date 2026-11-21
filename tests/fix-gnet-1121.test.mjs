// 전수점검 11-21 게시판 고침 시험: 설정 글의 괄호·느낌표, 날짜 꼴, 빠진 댓글 시각, 보관 글 읽음, 다양성 강화 다른 벌, 뺀 댓글 알림, 쪽지 원글
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validDate, stampComments, reconcileUnread, applyBoard, addOutgoingDm, gnetSettings, CFG, G_POST_BASE } from '../dist-test/core.mjs';

test('CBS 식: 사용자 글의 ( ) ! :: 가 연산자로 잘리지 않는다 (중대-9)', () => {
  const env = (v) => ({ vars: { '$lb_cfg_lb-gn.mood': v } });
  const t = '{{#when {{and::{{? {{length::{{trim::{{getvar::lb_cfg_lb-gn.mood}} }} }} > 0 }}::{{? {{getvar::lb_cfg_lb-gn.mood}} != null }}}} }}말투: {{getvar::lb_cfg_lb-gn.mood}}{{:else}}기본{{/when}}';
  for (const v of ['거친 말투, 욕설 많음!', '30대 직장인 말투 (존댓말)', '이지은(요원)', 'a::b', '!(x) == 1']) assert.equal(evaluate(t, env(v)), `말투: ${v}`, v);
  assert.equal(evaluate(t, { vars: {} }), '기본');
  assert.equal(evaluate(t, env('  ')), '기본');
  assert.equal(evaluate('{{? {{getvar::p}} == 2}}', { vars: { $p: '2' } }), '1');
  assert.equal(evaluate('{{? {{getvar::p}} > 1}}', { vars: { $p: '0' } }), '0');
});

test('날짜 「2025-05-13」 꼴은 점 꼴로 맞춘다 (사소-53)', () => {
  assert.equal(validDate('2025-05-13 14:05'), '2025.05.13 14:05');
  assert.equal(validDate('2025.05.13'), '2025.05.13');
});

test('빠진 댓글 시각 뒤 댓글이 앞 댓글보다 이르지 않다 (보통-55)', () => {
  const p = { id: 1, date: '2025.05.13 14:00', nick: 'a', title: 't', body: 'b', views: 0, votes: 0, mine: false, comments: [
    { nick: 'x', body: '1', parent: 0, mine: false, unread: false },
    { nick: 'y', body: '2', parent: 0, mine: false, unread: false },
    { nick: 'z', body: '3', parent: 0, mine: false, unread: false },
  ] };
  stampComments(p, 0, ['14:30', '', '14:10'], '2025.05.13 16:00');
  const t = p.comments.map((c) => c.time);
  assert.ok(t[0] <= t[1] && t[1] <= t[2], t.join(' / '));
});

test('보관함에서 되돌아온 글의 옛 답글은 다시 새 답글이 되지 않는다 (보통-53)', () => {
  const c = (nick, body, mine = false, unread = false) => ({ nick, body, parent: 0, mine, unread });
  const old = { id: 5, date: '', nick: '나', title: 't', body: 'b', views: 0, votes: 0, mine: true, comments: [c('x', '읽은 답글')] };
  const previous = { seq: 0, posts: [], archive: [old], dms: [], sources: {} };
  const now = { seq: 0, posts: [{ ...old, comments: [c('x', '읽은 답글', false, true), c('나', '새 댓글', true)] }], archive: [], dms: [], sources: {} };
  reconcileUnread(now, previous);
  assert.equal(now.posts[0].comments[0].unread, false);
});

test('다양성 강화: 고른 벌이 다 걸러지면 다른 벌을 쓴다 (보통-62), 형식 오류 댓글은 사용자 명의로 세지 않는다 (사소-47)', () => {
  const st = { seq: G_POST_BASE, posts: [], dms: [], sources: {} };
  const settings = gnetSettings({ [CFG('sampling')]: '1' });
  const good = [{ author: 'abc', id: G_POST_BASE + 1, title: '제목', content: '본문', comments: [{ author: '', content: '빈 작성자', parent: 0 }, { author: '나', content: '내 이름', parent: 0 }] }];
  const bad = [{ author: '나', id: G_POST_BASE + 2, title: '내 글', content: '본문', comments: [] }];
  const r = applyBoard(st, st, { posts: good, alternativePosts: bad }, { nick: '나', settings, date: '2025.05.13 14:00' });
  assert.equal(r.st.posts[0].title, '제목');
  assert.match(r.notice, /댓글 1개는 뺐어요/);
  assert.match(r.notice, /형식이 맞지 않는 댓글과 뺀 댓글에 달린 답글 1개/);
});

test('다른 글을 보고 보낸 쪽지는 그 글이 원글이 된다 (보통-59)', () => {
  const st = { seq: 0, posts: [], dms: [], sources: { x: { postid: 1, title: 'A', body: '', author: 'x', quote: '', quoteAuthor: '' } } };
  addOutgoingDm(st, 'x', '안녕', '', { postid: 2, title: 'B', body: '', author: 'x', quote: '', quoteAuthor: '' });
  assert.equal(st.sources.x.title, 'B');
  addOutgoingDm(st, 'x', '또', '');
  assert.equal(st.sources.x.title, 'B', '원글 없이 보내면 그대로');
});
