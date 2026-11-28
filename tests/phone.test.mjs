import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { phone as P, phonePrompt as PP, unwrapCalls, recentTurns, migrateLore } from '../dist-test/core.mjs';

import { REAL } from './realcard.mjs';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;

const chatOf = (vars = {}, message = []) => ({ message, scriptstate: { '$st_faction': 'A00', ...vars } });
const dmRoom = (cid, extra = {}) => ({ id: `dm_${cid}`, kind: 'dm', members: [cid], people: { [cid]: { id: cid, name: '상대' } }, messages: [], draft: '', unread: 0, ...extra });
const add = (content, sender, type = 'text') => ({ op: 'add', path: '/messages/-', value: { content, sender, type } });

test('directory follows faction tabs, custom contacts land in 기타', { skip: !realLore }, () => {
  const a = P.directory(realLore, chatOf());
  assert.deepEqual(a.tabs.map((t) => t.id), ['T01', 'T04', 'T05']);
  assert.ok(a.contacts.length > 10 && a.contacts.every((c) => c.visible));
  const b = P.directory(realLore, chatOf({ '$st_faction': 'B00' }));
  assert.deepEqual(b.tabs.map((t) => [t.id, t.name]).slice(0, 2), [['T02', '관리'], ['T04', '이면의 주민들']]);
  const all = P.directory(realLore, chatOf({ '$ph_all_contacts': '1', '$ph_anomaly_contacts': '1' }));
  assert.ok(all.tabs.some((t) => t.id === 'X01') && all.tabs.some((t) => t.id === 'T03'));
  const custom = { version: 1, seq: 1, items: [{ id: P.contactId('custom:1'), name: '김씨', note: '편의점 사장' }] };
  const c = P.directory(realLore, chatOf({ '$ph_contacts': JSON.stringify(custom) }));
  const kim = c.contacts.find((x) => x.name === '김씨');
  assert.ok(kim.custom && kim.tabs.includes('T05'));
  assert.equal(P.contactId('P001'), 'c_50303031');
});

test('시작 묶음(「이면의 주민들」 F00) 코드로 시작해도 모두에게 열린 탭이 보이고, 직접 추가한 연락처가 기타에 보인다 (전수점검 중대-8)', { skip: !realLore }, () => {
  const moved = migrateLore(realLore);
  const g = P.directory(moved, chatOf({ '$st_faction': 'F00' }));
  assert.deepEqual(g.tabs.map((t) => [t.id, t.name]), [['T04', '이면의 주민들'], ['T05', '기타']]);
  assert.ok(g.contacts.some((c) => c.name === '차여진'));
  const custom = { version: 1, seq: 1, items: [{ id: P.contactId('custom:1'), name: '김씨' }, { id: P.contactId('P001'), name: '쟈알디', agentId: 'P001' }] };
  const c = P.directory(moved, chatOf({ '$st_faction': 'F00', '$ph_contacts': JSON.stringify(custom) }));
  const kim = c.contacts.find((x) => x.name === '김씨');
  const jy = c.contacts.find((x) => x.agentId === 'P001');
  // 명부 인물을 기타에 넣어도 지울 수 있다 (전수점검 보통-49). 내 소속 탭에 원래 보이는 사람은 지우기가 없다
  assert.ok(kim?.visible && kim.removable && jy?.visible && jy.removable);
  const a = P.directory(moved, chatOf({ '$ph_contacts': JSON.stringify(custom) }));
  assert.equal(a.contacts.find((x) => x.agentId === 'P001')?.removable, false);
});

test('대기 줄 길이 기준은 「대기 설명」 토큰 상한 하나 (전수점검 보통-50)', () => {
  const long = '한참 시간이 흐르고 난 뒤에';
  assert.ok([...long].length > 12);
  assert.equal(P.hiddenPause(long), false);
  const keep = P.LIMITS.pause_tokens;
  try {
    P.LIMITS.pause_tokens = 5;
    assert.equal(P.hiddenPause(long), true);
    assert.equal(P.hiddenPause('잠시 후'), false);
  } finally {
    P.LIMITS.pause_tokens = keep;
  }
});

test('patch accepts only appended rows from active members', () => {
  const r = dmRoom('c_1');
  const ok = P.eventsFromPatch([add('안녕', 'c_1'), add('잠시 후', '-', 'pause'), add('...', '-', 'pause')], r, false);
  assert.equal(ok.events.length, 2);
  assert.throws(() => P.eventsFromPatch([{ op: 'replace', path: '/messages/0', value: {} }], r, false), /수정|고치거나/);
  assert.throws(() => P.eventsFromPatch([add('누구', 'c_9')], r, false), /참여하지 않은/);
  assert.throws(() => P.eventsFromPatch([add('c_1', '-', 'exit')], r, false), /퇴장/);
  const g = { ...dmRoom('c_1'), id: 'g_1', kind: 'group', members: ['c_1', 'c_2'] };
  assert.throws(() => P.eventsFromPatch([add('[[ATTACH:gift]]꽃[[/ATTACH]]', 'c_1')], g, false), /선물/);
  const exit = P.eventsFromPatch([add('난 간다', 'c_2'), add('c_2', '-', 'exit')], g, false);
  assert.equal(exit.events[1].type, 'exit');
  // 틀린 말풍선만 빠지고 나머지는 남는다. 전부 틀렸을 때만 실패
  const dropped = [];
  const part = P.eventsFromPatch([add('c_2', '-', 'exit'), add('다시', 'c_2'), add('남음', 'c_1')], g, false, dropped);
  assert.deepEqual(part.events.map((e) => e.type), ['exit', 'message']);
  assert.equal(part.events[1].text, '남음');
  assert.match(dropped[0], /참여하지 않은/);
  assert.equal(P.eventsFromPatch([add('안녕', 'c_1'), add('누구', 'c_9'), { op: 'replace', path: '/messages/0', value: {} }], r, false).events.length, 1);
  assert.equal(P.keepValid(Array.from({ length: 20 }, () => ({ type: 'message', sender: 'c_1', text: '응' })), r).length, P.LIMITS.events, '넘치는 말풍선은 잘라 낸다');
  const title = P.eventsFromPatch([{ op: 'replace', path: '/name', value: '조사팀' }], g, true);
  assert.equal(title.title, '조사팀');
});

test('reply parser reads tagged, bare and contact-mode output', () => {
  const r = dmRoom('c_1');
  assert.equal(P.parseReply('<think>x</think><lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"응","sender":"c_1","type":"text"}}]</lb-minitalk-patch>', r, false).events.length, 1);
  assert.equal(P.parseReply('```json\n[{"op":"add","path":"/messages/-","value":{"content":"응","sender":"c_1","type":"text"},},]\n```', r, false).events.length, 1);
  assert.equal(P.parseReply('{"contacts":[],"result":{"patch":[]}}', r, true).events.length, 0);
  assert.throws(() => P.parseReply('그냥 말로 답함', r, false), (e) => e instanceof P.PhoneError && e.raw === '그냥 말로 답함');
});

test('events add bubbles, split attachments, track follow-ups and receipts', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '뭐해?', 't1');
  const n = P.applyEvents(st, r, [{ type: 'message', sender: 'c_1', text: '이거 봐 [[ATTACH:photo]]골목 사진[[/ATTACH]]' }], 't2');
  assert.equal(n, 2);
  assert.equal(r.unread, 2);
  assert.equal(r.followupSent, false);
  P.applyEvents(st, r, [{ type: 'message', sender: 'c_1', text: '답장 없네?' }], 't3');
  assert.equal(r.followupSent, true);
  const cs = P.conversationState(r);
  assert.equal(cs.npcMessagesSinceOwner, 3);
  assert.equal(cs.senders[0].lastMessageRead, 'unread');
  assert.equal(P.refreshAllowed(chatOf(), r, P.phoneSettings({}))[0], false);
  P.readRoom(r);
  assert.equal(P.conversationState(r).senders[0].lastMessageRead, 'read');
});

test('storage trim keeps a conversation baseline', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  for (let i = 0; i < P.STORAGE.dm + 5; i++) P.push(st, r, i % 2 ? 'c_1' : 'me', `m${i}`, '');
  P.trimRooms(st);
  assert.equal(r.messages.length, P.STORAGE.dm);
  assert.equal(r.trimmedRecords, 5);
  assert.ok(r.conversationBaseline.ownerHasSpoken);
});

test('reply prompt picks sections and carries the room packet', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: '사무실에 들어간다' }, { role: 'char', data: '쟈알디가 서류를 넘긴다.' }]);
  const d = P.directory(realLore, chat);
  const c = d.contacts[0];
  const st = P.blankState();
  const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } });
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '팀장님 지금 어디세요?', '');
  r.pending = { status: 'error', action: { type: 'send' } };
  const p = PP.replyPrompt({ char: { globalLore: realLore, desc: '세계관 설명' }, chat }, st, r, d, { A00: '관리국' });
  const sys = p.messages[0].content;
  assert.match(sys, /OUTPUT CONTRACT/);
  assert.match(sys, /send: reply to the owner's exact text/);
  assert.doesNotMatch(sys, /### Direct rooms/, '내 말에 답하는 요청엔 먼저 연락 규칙을 붙이지 않는다 (gphone#7)');
  assert.doesNotMatch(sys, /Obey announcementCheck|When invitationCheck.allowed/);
  const body = JSON.parse(p.messages[1].content);
  assert.equal(body.room.messages[0].content, '팀장님 지금 어디세요?');
  assert.equal(body.participants[0].sender, c.id);
  assert.equal(body.participants[0].faction, '관리국');
  assert.equal(body.narratorOnly.universe.characterDescription, '세계관 설명');
  assert.equal(body.narratorOnly.recentStory.length, 2);
  assert.equal(p.contactMode, false);
  // 직접 추가한 연락처: 근거 뽑기 없이 MANUAL_CONTACT 규칙만, 메모가 있으면 앱이 관계를 못박지 않는다 (사용자 11-13 7번 (가))
  const m = { id: 'c_custom', name: '김씨', custom: true, note: '편의점 사장' };
  const r2 = dmRoom(m.id, { people: { [m.id]: m } });
  P.push(st, r2, 'me', '사장님', '');
  r2.pending = { status: 'error', action: { type: 'send' } };
  const p2 = PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, r2, d, {});
  assert.equal(p2.contactMode, false);
  assert.match(p2.messages[0].content, /manuallySavedContact/);
  assert.match(p2.messages[0].content, /Return only <lb-minitalk-patch>/);
  const b2 = JSON.parse(p2.messages[1].content);
  assert.equal(b2.recipientEvidenceSources, undefined);
  assert.equal(b2.participants[0].relationshipToOwner, undefined, '메모가 있으면 모델이 메모로 판단');
  // 메모·로어북·이름 언급·지난 대화가 다 없으면 처음 연락하는 사이로 못박는다
  const n = { id: 'c_new', name: '처음보는번호', custom: true, note: '' };
  const r3 = dmRoom(n.id, { people: { [n.id]: n } });
  P.push(st, r3, 'me', '안녕하세요', '');
  r3.pending = { status: 'error', action: { type: 'send' } };
  const b3 = JSON.parse(PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, r3, d, {}).messages[1].content);
  assert.match(b3.participants[0].relationshipToOwner, /^none/);
  P.push(st, r3, n.id, '누구세요?', '');
  const b4 = JSON.parse(PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, r3, d, {}).messages[1].content);
  assert.equal(b4.participants[0].relationshipToOwner, undefined, '말을 주고받은 뒤에는 못박지 않는다');
});

test('refresh covers directory, announcements and invitations, then commits', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const d = P.directory(realLore, chat);
  const st = P.blankState();
  const plan = PP.refreshPrompt({ char: { globalLore: realLore }, chat }, st, d, { A00: '관리국' }, () => 0);
  assert.ok(plan.prompt);
  const body = JSON.parse(plan.prompt.messages[1].content);
  assert.equal(body.rooms.length, d.contacts.length);
  assert.ok(body.announcementCheck.allowed && !('channel' in body.announcementCheck));
  assert.ok(body.invitationCheck.allowed);
  assert.match(plan.prompt.messages[0].content, /REFRESH OUTPUT CONTRACT/);
  assert.match(plan.prompt.messages[0].content, /When invitationCheck.allowed/);
  const [a, b] = d.contacts;
  const raw = JSON.stringify({
    updates: [{ room: `dm_${a.id}`, patch: [add('혹시 시간 돼?', a.id)] }, { room: `dm_${b.id}`, patch: [] }],
    announcements: [{ issuer: '관리국 총무과', category: '시설', title: '엘리베이터 점검', text: '내일 오전 점검합니다.' }],
    invitations: [{ inviter: a.id, members: [a.id, b.id], name: '야간조', patch: [add('어서 와', b.id)] }],
  });
  const res = P.parseRefresh(raw, plan.selected, plan.receive, plan.announce, plan.invite, st, d, false);
  assert.equal(res.updates[0].events.length, 1);
  const r = plan.selected.get(`dm_${a.id}`);
  st.rooms[r.id] = r;
  P.applyEvents(st, r, res.updates[0].events, '');
  assert.equal(P.commitInvitations(st, res.invitations, ''), 1);
  const g = Object.values(st.rooms).find((x) => x.kind === 'group');
  assert.equal(g.messages[0].kind, 'invite');
  assert.equal(g.unread, 2);
  const bl = P.readBulletins(chat);
  assert.equal(P.commitAnnouncements(bl, st, res.announcements, plan.announce, ''), 1);
  assert.equal(bl.items[0].channel, 'A00');
  assert.equal(P.commitAnnouncements(bl, st, res.announcements, plan.announce, ''), 0, '같은 공지는 한 번만');
  // 허용되지 않은 방·초과 공지는 거절
  assert.throws(() => P.parseRefresh('{"updates":[{"room":"dm_zzz","patch":[]}]}', plan.selected, plan.receive, plan.announce, plan.invite, st, d, false), /허용되지 않은/);
  const two = { issuer: 'x', category: '공지', title: 't', text: 'b' };
  assert.equal(P.parseRefresh(JSON.stringify({ updates: [], announcements: [two, two] }), plan.selected, plan.receive, plan.announce, plan.invite, st, d, false).announcements.length, 1, '넘친 공지는 잘라 낸다');
  assert.throws(() => P.parseRefresh(JSON.stringify({ updates: [], announcements: [{ ...two, category: '잡담' }] }), plan.selected, plan.receive, plan.announce, plan.invite, st, d, false), /분류/);
  // 틀린 방은 빼고 맞는 방은 쓴다
  const ok = P.parseRefresh(JSON.stringify({ updates: [{ room: 'dm_zzz', patch: [] }, ...JSON.parse(raw).updates] }), plan.selected, plan.receive, plan.announce, plan.invite, st, d, false);
  assert.equal(ok.updates.length, JSON.parse(raw).updates.length);
});

test('refresh is skipped when incoming and invites are off and no notice is due', { skip: !realLore }, () => {
  const chat = chatOf({ '$ph_incoming': '0', '$ph_group_invites': '0', '$ph_announcements': '0' });
  const plan = PP.refreshPrompt({ char: { globalLore: realLore }, chat }, P.blankState(), P.directory(realLore, chat), {}, () => 0);
  assert.equal(plan.prompt, null);
  assert.match(plan.reason, /꺼져/);
});

test('cooldowns count story turns', () => {
  const chat = chatOf({ '$cooldown_received_incoming': '1' }, [{ role: 'char', data: 'a' }]);
  assert.equal(P.cooldownReady(chat, 'incoming'), false);
  chat.message.push({ role: 'char', data: 'b' });
  assert.equal(P.cooldownReady(chat, 'incoming'), true);
});

test('main context lists messages and the latest notice', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '안녕', '');
  P.push(st, r, 'c_1', '응', '');
  const b = { version: 2, seq: 1, items: [{ id: 1, order: 9, read: true, channel: 'A00', channelName: '관리국', issuer: '총무과', category: '공지', title: 't', text: 'x', time: '' }], checks: {}, seen: {} };
  const out = P.mainContext(st, b, P.phoneSettings({}), 'RULES');
  assert.match(out, /^\[MODULE_CONTEXT_BEGIN\]\nRULES\n/);
  const json = JSON.parse(out.split('\n')[2]);
  assert.equal(json.feature, 'phone');
  // 보통 말풍선은 종류를 싣지 않는다. 방 이름·받는 사람은 rooms 에 한 번만, 기록에는 방 ID 만
  assert.deepEqual(json.records.map((x) => x.kind), [undefined, undefined, 'announcement']);
  assert.equal(json.records[0].sender, '주인공');
  assert.deepEqual(json.rooms, { dm_c_1: { title: '상대', recipients: ['상대'] } });
  assert.deepEqual(Object.keys(json.records[0]), ['room', 'sender', 'text', 'time']);
  assert.equal(P.mainContext(st, b, P.phoneSettings({ '$ph_context': '0' }), 'R'), '');
});

test('call records show a card, send the request text, and absorb a typed follow-up', () => {
  const rec = P.callRecord('쟈알디', '보고할 게 있어요');
  assert.ok(P.hasCall(rec));
  assert.equal(P.renderCalls(`앞${rec}뒤`, (t) => `[${t}]`), '앞[쟈알디]뒤');
  assert.equal(P.stripCall(rec), '{{user}} places a phone call to 쟈알디.\n\n보고할 게 있어요');
  const out = unwrapCalls([{ role: 'user', content: '주인공 places x' }, { role: 'user', content: rec }, { role: 'user', content: '급해요' }]).messages;
  assert.equal(out.length, 2);
  assert.equal(out[1].content, '{{user}} places a phone call to 쟈알디.\n\n보고할 게 있어요\n\n급해요');
  const turns = recentTurns({ message: [{ role: 'user', data: rec }] }, 3);
  assert.match(turns[0].user, /^주인공 places a phone call/);
  assert.equal(P.validCallTarget('a{b}'), false);
});

test('대기 줄은 짧은 시간 표시만 남기고 지문은 버린다', () => {
  assert.equal(P.hiddenPause('잠시 후'), false);
  assert.equal(P.hiddenPause('10분 후'), false);
  assert.equal(P.hiddenPause('송주익이 기겁하며 급하게 메시지를 연타한다.'), true);
  assert.equal(P.hiddenPause('답이 없다.'), true);
  assert.equal(P.hiddenPause('…'), true);
});

test('이름을 정하지 않은 단톡방은 남은 사람 이름으로 부른다', () => {
  const people = { a: { id: 'a', name: '사장' }, b: { id: 'b', name: '송주익' }, c: { id: 'c', name: '문혜란' } };
  const room = { id: 'g_1', kind: 'group', name: '사장, 송주익, 문혜란', members: ['b'], people, messages: [], draft: '', unread: 0 };
  const st = P.readPhone({ scriptstate: { [P.PH_STATE]: JSON.stringify({ version: 2, seq: 1, mid: 0, rooms: { g_1: room }, order: ['g_1'] }) } });
  assert.equal(P.roomLabel(st.rooms.g_1), '송주익');
  assert.equal(P.roomLabel({ ...room, name: '야간조' }), '야간조');
});

// ── 토큰 낭비 점검 (2026-11-15) ──
const { advanced: ADV, tokens: countTokens, G_POST_BASE: POST_BASE, addUserPost: userPost, writeGnet: saveGnet } = await import('../dist-test/core.mjs');

test('메인 요청 기록: 받는 사람이 방의 것과 다를 때만 기록에 따로 싣는다', () => {
  ADV.applyAdvanced({});
  const st = P.blankState();
  const g = { id: 'g_1', kind: 'group', name: '모임', members: ['c_1', 'c_2'], people: { c_1: { id: 'c_1', name: '가' }, c_2: { id: 'c_2', name: '나' }, c_3: { id: 'c_3', name: '다' } }, messages: [], draft: '', unread: 0 };
  st.rooms[g.id] = g;
  P.push(st, g, 'c_1', '하나', 't1');
  P.push(st, g, 'c_2', '둘', 't2');
  g.members.push('c_3');
  P.push(st, g, 'c_3', '셋', 't3');
  const json = JSON.parse(P.mainContext(st, { items: [] }, P.phoneSettings({}), 'R').split('\n')[2]);
  assert.deepEqual(json.rooms, { g_1: { title: '모임', recipients: ['가', '나'] } });
  assert.deepEqual(json.records.map((x) => x.recipients), [undefined, undefined, ['가', '나', '다']]);
  assert.deepEqual(json.records.map((x) => x.text), ['하나', '둘', '셋'], '시간 순 그대로');
  assert.ok(!/"title":"모임".*"title":"모임"/.test(JSON.stringify(json)), '방 이름은 한 번만');
});

test('메인 요청 기록: 보기 전용 방·이모지 반응·말버릇은 칩을 켰을 때만, 토큰 상한 안에서', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '안녕', 't');
  P.push(st, r, 'c_1', '응', 't');
  r.messages[0].reactions = '👍1';
  const views = [{ id: 'v_1', preset: 'side', name: '퇴근길', pov: 'p1', people: [{ id: 'p1', name: '에일린' }, { id: 'p2', name: '동료' }], time: 't',
    unread: false, messages: [{ sender: '-', type: 'time', text: 't' }, ...Array.from({ length: 40 }, (_, i) => ({ sender: i % 2 ? 'p1' : 'p2', type: 'text', text: `관전 말 ${i} ${'가나다라'.repeat(10)}` }))] }];
  const extra = { views, habits: [{ id: 'c_1', name: '상대', note: '마침표를 안 찍는다' }, { id: 'c_9', name: '남', note: '기록에 없는 사람' }] };
  const set = P.phoneSettings({});
  try {
    ADV.applyAdvanced({});
    const off = P.mainContext(st, { items: [] }, set, 'R', null, extra);
    assert.doesNotMatch(off, /viewOnlyRooms|관전 말|textingHabits|reactions|👍/, '기본은 끔: 전과 같다');
    assert.equal(P.mainContext(P.blankState(), { items: [] }, set, 'R', null, extra), '', '끄면 관전 방만 있어도 아무것도 안 붙는다');

    ADV.applyAdvanced({ '$ph_adv_ctx_views': '1', '$ph_adv_ctx_reactions': '1', '$ph_adv_ctx_habits': '1' });
    const on = P.mainContext(st, { items: [] }, set, 'R', null, extra);
    const lines = on.split('\n');
    const json = JSON.parse(lines[lines.length - 2]);
    assert.match(on, /viewOnlyRooms are not messenger traffic/, '관전 방 설명 글이 같이 붙는다');
    assert.match(on, /textingHabits are preserved notes/);
    assert.equal(json.viewOnlyRooms[0].kind, 'side');
    assert.equal(json.viewOnlyRooms[0].viewpoint, '에일린');
    assert.equal(json.viewOnlyRooms[0].messages.at(-1).text, views[0].messages.at(-1).text, '최근 말부터');
    assert.equal(json.viewOnlyRooms[0].messages.at(-1).sender, '에일린', '말한 사람은 이름으로');
    assert.equal(json.records[0].reactions, '👍1');
    assert.deepEqual(json.textingHabits, [{ sender: '상대', note: '마침표를 안 찍는다' }], '기록에 말한 사람 것만');
    assert.ok(P.mainContext(P.blankState(), { items: [] }, set, 'R', null, extra).includes('관전 말 39'), '톡 기록이 없어도 관전 방은 붙는다');
    // 기능을 꺼 두면 칩이 켜져 있어도 반응·말버릇은 붙지 않는다
    const plain = P.mainContext(st, { items: [] }, P.phoneSettings({ '$ph_reactions': '0', '$ph_habits': '0' }), 'R', null, extra);
    assert.doesNotMatch(plain, /textingHabits|👍/);

    // 컨텍스트 토큰 상한을 지킨다
    ADV.applyAdvanced({ '$ph_adv_ctx_views': '1', '$ph_adv_ctx_tokens': '600' });
    const capped = P.mainContext(st, { items: [] }, set, 'R', null, extra);
    assert.ok(countTokens(capped) <= 600, `상한 안 (${countTokens(capped)})`);
    const cj = JSON.parse(capped.split('\n').at(-2));
    assert.ok(cj.viewOnlyRooms[0].messages.length > 0 && cj.viewOnlyRooms[0].messages.length < json.viewOnlyRooms[0].messages.length, '상한에 맞춰 줄인다');
    assert.equal(cj.records.length, 2, '톡 기록이 먼저');
  } finally {
    ADV.applyAdvanced({});
  }
});

test('자동 호출 결과: 채팅 뒤에 메시지가 붙기만 했으면 쓰고, 앞 메시지가 바뀌었으면 버린다', () => {
  const before = { message: [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }] };
  assert.equal(P.chatPrefixKept(before, { message: [...before.message] }), true);
  assert.equal(P.chatPrefixKept(before, { message: [...before.message, { role: 'user', data: 'c' }, { role: 'char', data: '' }] }), true, '다음 말을 보냈어도 그 턴의 결과는 그대로');
  assert.equal(P.chatPrefixKept(before, { message: [before.message[0], { role: 'char', data: '다시 굴린 응답' }] }), false, '다시 굴림');
  assert.equal(P.chatPrefixKept(before, { message: [before.message[0]] }), false, '지움');
  const ui = readFileSync(new URL('../src/ui/phone.ts', import.meta.url), 'utf8');
  assert.equal(ui.match(/if \(automatic && !chatPrefixKept\(ctx\.chat, chat\)\)/g)?.length, 2, '자동 확인·자동 관전 둘 다 이 판정을 쓴다');
  assert.doesNotMatch(ui, /automatic && \(chat\.message\?\.length \?\? 0\) !== startLength/);
});

test('메인 요청 기록: 톡 기록이 토큰 상한을 채워도 켜 둔 보기 전용 방의 최근 말은 들어간다', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  for (let i = 0; i < 300; i++) P.push(st, r, i % 2 ? 'c_1' : 'me', `톡 말 ${i} ${'가나다라마바사아자차'.repeat(5)}`, 't');
  const views = [{ id: 'v_1', preset: 'side', name: '퇴근길', pov: 'p1', people: [{ id: 'p1', name: '에일린' }, { id: 'p2', name: '동료' }], time: 't',
    unread: false, messages: Array.from({ length: 10 }, (_, i) => ({ sender: i % 2 ? 'p1' : 'p2', type: 'text', text: `관전 말 ${i}` })) }];
  const set = P.phoneSettings({});
  const read = (text) => JSON.parse(text.split('\n').at(-2));
  try {
    for (const vars of [{ '$ph_adv_ctx_focus': '0' }, {}]) {
      ADV.applyAdvanced({ ...vars });
      const off = read(P.mainContext(st, { items: [] }, set, 'R', { scene: '상대가 휴대폰을 본다', names: ['상대'] }, { views }));
      assert.equal(off.viewOnlyRooms, undefined, '끄면 전과 같다');
      ADV.applyAdvanced({ ...vars, '$ph_adv_ctx_views': '1' });
      const text = P.mainContext(st, { items: [] }, set, 'R', { scene: '상대가 휴대폰을 본다', names: ['상대'] }, { views });
      const on = read(text);
      assert.ok(countTokens(text) <= 4000, `상한 안 (${countTokens(text)})`);
      assert.ok(on.viewOnlyRooms?.[0].messages.length >= 6, `관전 방의 최근 말이 들어간다 (${on.viewOnlyRooms?.[0].messages.length ?? 0})`);
      assert.equal(on.viewOnlyRooms[0].messages.at(-1).text, '관전 말 9');
      assert.ok(on.records.length >= off.records.length - 8 && on.records.at(-1).text === off.records.at(-1).text, '톡 기록은 관전 몫만큼만 줄고 최근 것은 그대로');
    }
  } finally {
    ADV.applyAdvanced({});
  }
});

test('자동 호출 결과: 플러그인이 응답에 붙였다 뗀 것(상점 표식·이미지 태그·끝 줄바꿈)은 바뀐 것으로 보지 않는다', () => {
  const before = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '가게에 들어갔다.', chatId: 'c1' }] };
  const next = (data, chatId = 'c1') => ({ message: [before.message[0], { role: 'char', data, chatId }, { role: 'user', data: '다음 말', chatId: 'u2' }] });
  assert.equal(P.chatPrefixKept(before, next('가게에 들어갔다.\n[shop: 잡화점|주인]')), true, '갱신기가 상점 표식을 붙임');
  assert.equal(P.chatPrefixKept({ message: [before.message[0], { role: 'char', data: '가게에 들어갔다.\n[shop: 잡화점|주인]', chatId: 'c1' }] }, next('가게에 들어갔다.')), true, '지난 응답의 상점 표식을 지움');
  assert.equal(P.chatPrefixKept(before, next('가게에 들어갔다.\n')), true, '끝 줄바꿈');
  assert.equal(P.chatPrefixKept(before, next('<img=가게>\n가게에 들어갔다.')), true, '이미지 태그 보충');
  assert.equal(P.chatPrefixKept({ message: [before.message[0], { role: 'char', data: '가게에 들어갔다.\n[shop-ready: cos|망토]', chatId: 'c1' }] }, next('가게에 들어갔다.')), true, '주문을 받아 완성 표식이 빠짐');
  assert.equal(P.chatPrefixKept(before, next('가게에 들어갔다.\n[shop-ready: cos|망토]')), true, '완성 표식이 붙음');
  assert.equal(P.chatPrefixKept(before, next('가게에 들어갔다.', 'c9')), false, '같은 글이어도 다른 메시지(다시 굴림)');
  assert.equal(P.chatPrefixKept(before, next('가게를 지나쳤다.')), false, '내용을 고침');
});

test('자동 확인·자동 관전: 본편 응답을 기다리는 동안에는 결과를 저장하지 않고 대기가 풀린 뒤 저장한다', () => {
  const ui = readFileSync(new URL('../src/ui/phone.ts', import.meta.url), 'utf8');
  // 두 곳 모두 저장(updateChat) 바로 앞에서 기다리고, 기다린 뒤 저장 안에서 앞 메시지를 다시 확인한다
  assert.equal(ui.match(/if \(automatic\) await park\(\);\n    await updateChatOf\(ctx, \(chat\) => \{\n[^\n]*\n      if \(automatic && !chatPrefixKept\(ctx\.chat, chat\)\)/g)?.length, 2);
  assert.match(ui, /function whenIdle\(\): Promise<void> \{\n  if \(!isWaiting\(\)\) return Promise\.resolve\(\);/);
});

test('답장·확인 요청: 괴담넷 글·다른 방 말풍선·후보 수를 설정으로 줄이거나 끈다 (기본은 전과 같다)', { skip: !realLore }, () => {
  const gst = { seq: POST_BASE, posts: [], dms: [], sources: {} };
  for (let i = 0; i < 3; i++) userPost(gst, '나', `글 ${i}`, '본문', '2025.05.13 14:00');
  const base = saveGnet(chatOf({}, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]), gst);
  const d = P.directory(realLore, base);
  const [a, b] = d.contacts;
  const make = () => {
    const st = P.blankState();
    for (const c of [a, b]) { const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } }); st.rooms[r.id] = r; }
    const g = { id: 'g_1', kind: 'group', name: '모임', members: [a.id, b.id], people: { [a.id]: P.personOf(a), [b.id]: P.personOf(b) }, messages: [], draft: '', unread: 0 };
    st.rooms[g.id] = g;
    for (let i = 0; i < 3; i++) P.push(st, g, a.id, `단톡 말 ${i}`, '');
    const r = st.rooms[`dm_${a.id}`];
    P.push(st, r, 'me', '안녕', '');
    r.pending = { status: 'error', action: { type: 'send' } };
    return { st, r };
  };
  const reply = (vars) => { const { st, r } = make(); const chat = { ...base, scriptstate: { ...base.scriptstate, ...vars } }; return JSON.parse(PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, r, d, {}).messages[1].content); };
  const def = reply({});
  assert.equal(def.publicBoard.posts.length, 3);
  assert.equal(def.crossRoomMessages.length, 3);
  assert.equal(reply({ '$ph_adv_board_posts': '1' }).publicBoard.posts.length, 1);
  assert.equal(reply({ '$ph_adv_board_posts': '0' }).publicBoard, undefined);
  assert.equal(reply({ '$ph_adv_cross_history': '1' }).crossRoomMessages.length, 1);
  assert.equal(reply({ '$ph_adv_cross_history': '0' }).crossRoomMessages, undefined);
  // 선톡·초대 후보 수
  const check = (vars, rng = () => 0) => JSON.parse(PP.refreshPrompt({ char: { globalLore: realLore }, chat: { ...base, scriptstate: { ...base.scriptstate, ...vars } } }, P.blankState(), d, {}, rng).prompt.messages[1].content);
  assert.equal(check({}).rooms.length, d.contacts.length, '기본은 전원');
  const three = check({ '$ph_adv_check_contacts': '3' });
  assert.equal(three.rooms.length, 3);
  assert.equal(three.participants.length, 3);
  // 최근 챗로그에 이름이 나온 사람이 먼저
  const last = d.contacts.at(-1);
  const named = { ...base, message: [{ role: 'user', data: 'a' }, { role: 'char', data: `${last.name}에게서 연락이 올 것 같다.` }] };
  const one = JSON.parse(PP.refreshPrompt({ char: { globalLore: realLore }, chat: { ...named, scriptstate: { ...named.scriptstate, '$ph_adv_check_contacts': '1' } } }, P.blankState(), d, {}, Math.random).prompt.messages[1].content);
  assert.equal(d.contacts.filter((c) => last.name.includes(c.name)).length, 1, '시험 전제: 이름이 겹치는 연락처가 없다');
  assert.deepEqual(one.rooms.map((x) => x.id), [`dm_${last.id}`]);
});

test('확인 요청: 이번에 받을 수 없는 공지·초대의 자료와 쓰이지 않는 칸은 싣지 않는다', { skip: !realLore }, () => {
  const chat = chatOf({ '$ph_announcements': '0', '$ph_group_invites': '0' }, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const bulletins = { version: 2, seq: 1, items: [{ id: 1, order: 1, read: true, channel: 'A00', channelName: '관리국', issuer: '총무과', category: '공지', title: '지난 공지 제목', text: '지난 공지 본문', time: '' }], checks: {}, seen: {} };
  chat.scriptstate['$ph_bulletins'] = JSON.stringify(bulletins);
  const d = P.directory(realLore, chat);
  const st = P.blankState();
  const [a, b] = d.contacts;
  const g = { id: 'g_1', kind: 'group', name: '모임', members: [a.id], people: { [a.id]: P.personOf(a), [b.id]: P.personOf(b) }, messages: [], draft: '', unread: 0 };
  st.rooms[g.id] = g; st.order = [g.id];
  P.push(st, g, b.id, '먼저 나갈게', '');
  const plan = PP.refreshPrompt({ char: { globalLore: realLore }, chat }, st, d, { A00: '관리국' }, () => 0);
  const text = plan.prompt.messages[1].content;
  const body = JSON.parse(text);
  assert.deepEqual(body.announcementCheck, { allowed: false });
  assert.deepEqual(body.invitationCheck, { allowed: false });
  assert.doesNotMatch(text, /지난 공지/);
  assert.equal(plan.announce.recent.length, 1, '저장·검사에 쓰는 쪽은 그대로');
  for (const k of ['activityCheck']) assert.ok(!(k in body), k);
  for (const k of ['currentSceneEntries', 'factionLabels']) assert.ok(!(k in body.narratorOnly), k);
  const room = body.rooms.find((x) => x.id === 'g_1');
  for (const k of ['pov', 'directoryEstablishesRelationship', 'participants']) assert.ok(!(k in room), k);
  assert.deepEqual(room.formerMembers, [{ id: b.id, name: b.name }], '나간 사람의 이름은 남긴다');
  assert.ok(body.participants.every((x) => !('source' in x) && 'factionDisplayName' in x && 'manuallySavedContact' in x));
  // 받을 수 있을 때는 전과 같이 싣는다
  const on = JSON.parse(PP.refreshPrompt({ char: { globalLore: realLore }, chat: { ...chat, scriptstate: { ...chat.scriptstate, '$ph_announcements': '1', '$ph_group_invites': '1' } } }, st, d, { A00: '관리국' }, () => 0).prompt.messages[1].content);
  assert.equal(on.announcementCheck.recent[0].title, '지난 공지 제목');
  assert.ok(on.invitationCheck.candidates.length >= 2 && on.invitationCheck.existingGroups.length === 1);
});

test('단톡 만들기: 방 이름을 지어도 된다는 글은 이름을 비우고 만들 때만', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const d = P.directory(realLore, chat);
  const [a, b] = d.contacts;
  const sys = (name) => {
    const st = P.blankState();
    const g = { id: 'g_1', kind: 'group', name, members: [a.id, b.id], people: { [a.id]: P.personOf(a), [b.id]: P.personOf(b) }, messages: [], draft: '', unread: 0, pending: { status: 'error', action: { type: 'invite_initial', invited: [a.id, b.id] } } };
    st.rooms[g.id] = g;
    return PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, g, d, {}).messages[0].content;
  };
  assert.match(sys(undefined), /"path":"\/name"/);
  assert.match(sys('내가 지은 이름'), /invite_initial: the group and invitations already exist/);
  assert.doesNotMatch(sys('내가 지은 이름'), /"path":"\/name"/);
});

test('관전: 반응 칸은 이모지 반응이 켜져 있고 혼잣말이 아닐 때만 요청하고, 저장 상한을 지침에 적는다', () => {
  const src = (v) => ({ char: { name: '괴이', desc: '', globalLore: [] }, chat: { message: [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }], scriptstate: v, localLore: [] } });
  const sys = (v) => PP.viewPrompt(src(v), {}, []).messages[0].content;
  assert.match(sys({}), /may also carry "reactions"/);
  assert.match(sys({ '$ph_view_preset': 'multi' }), /may also carry "reactions"/);
  assert.doesNotMatch(sys({ '$ph_view_preset': 'mono' }), /reactions/);
  assert.doesNotMatch(sys({ '$ph_reactions': '0' }), /reactions/);
  assert.match(sys({ '$ph_view_preset': 'mono' }), /At most 30 messages; each text content at most 600 characters\./);
  assert.doesNotMatch(sys({}), /__VIEW_LIMIT/);
});

test('확인 요청: 말풍선은 최근에 말이 오간 방 몇 개만, 인물 로어북은 그 방 인원에게만 붙는다', { skip: !realLore }, () => {
  const chat = chatOf({ '$ph_incoming': '1' }, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const d = P.directory(realLore, chat);
  const st = P.blankState();
  const talk = d.contacts.slice(0, 12);
  for (const c of talk) {
    const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } });
    st.rooms[r.id] = r; st.order.push(r.id);
    for (let i = 0; i < 15; i++) P.push(st, r, i % 2 ? 'me' : c.id, `${c.id} 말 ${i}`, '');
  }
  const run = (vars = {}) => JSON.parse(PP.refreshPrompt({ char: { globalLore: realLore }, chat: { ...chat, scriptstate: { ...chat.scriptstate, ...vars } } }, st, d, {}, () => 0).prompt.messages[1].content);
  const body = run();
  const withTalk = body.rooms.filter((r) => r.messages.length);
  assert.equal(withTalk.length, 10, '기본: 방 10개만 말풍선과 함께');
  assert.ok(withTalk.every((r) => r.messages.length === 10), '방마다 최근 10개');
  // 가장 나중에 말이 오간 방(마지막에 넣은 방)이 들어가고, 가장 오래된 두 방은 방 정보와 대화 상태만
  const old = body.rooms.filter((r) => [talk[0].id, talk[1].id].some((id) => r.id === `dm_${id}`));
  assert.ok(old.length === 2 && old.every((r) => !r.messages.length && r.conversationState && !r.candidateOnly));
  assert.ok(withTalk.some((r) => r.id === `dm_${talk[11].id}`));
  // 인물 로어북: 말풍선과 함께 넘긴 방의 인원만
  const lore = new Set(body.participants.filter((p) => p.lore).map((p) => p.sender));
  const full = new Set(withTalk.flatMap((r) => r.activeMembers));
  assert.ok(lore.size > 0 && [...lore].every((id) => full.has(id)), '그 밖의 사람에게는 로어북 글이 없다');
  const blank = body.participants.filter((p) => !full.has(p.sender));
  assert.ok(blank.length > 0 && blank.every((p) => p.lore === ''));
  assert.ok(blank.some((p) => p.hasCharacterLore), '로어북이 있는지는 그대로 알린다');
  // 설정: 0 = 전부
  assert.equal(run({ '$ph_adv_check_rooms': '0' }).rooms.filter((r) => r.messages.length).length, 12);
  assert.equal(run({ '$ph_adv_check_rooms': '3' }).rooms.filter((r) => r.messages.length).length, 3);
});

test('확인 요청: 로어북을 뺀 사람의 인물 로어북이 다른 자리로 다시 실리지 않고, 말풍선 없이 넘긴 방의 말은 다른 방 참조로 간다', { skip: !realLore }, () => {
  const chat = chatOf({ '$ph_incoming': '1' }, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const d = P.directory(realLore, chat);
  const st = P.blankState();
  const talk = d.contacts.slice(0, 4);
  for (const c of talk) {
    const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } });
    st.rooms[r.id] = r; st.order.push(r.id);
    for (let i = 0; i < 4; i++) P.push(st, r, i % 2 ? 'me' : c.id, `${c.id} 말 ${i}`, '');
  }
  // 가장 최근 방: 첫 사람(오래된 1:1 방의 상대)이 든 단톡
  const g = { id: 'g_1', kind: 'group', name: '모임', members: [talk[0].id, talk[3].id], people: { [talk[0].id]: P.personOf(talk[0]), [talk[3].id]: P.personOf(talk[3]) }, messages: [], draft: '', unread: 0 };
  st.rooms[g.id] = g; st.order.push(g.id);
  P.push(st, g, talk[3].id, '단톡 말', '');
  const src = { char: { globalLore: realLore }, chat: { ...chat, scriptstate: { ...chat.scriptstate, '$ph_adv_check_rooms': '2', '$ph_banter': '1', '$ph_banter_chance': '100' } } };
  const body = JSON.parse(PP.refreshPrompt(src, st, d, {}, () => 0.99).prompt.messages[1].content);
  const withTalk = body.rooms.filter((r) => r.messages.length).map((r) => r.id);
  assert.deepEqual(withTalk.sort(), ['g_1', `dm_${talk[3].id}`].sort());
  const noLore = body.participants.filter((p) => p.lore === '' && p.hasCharacterLore);
  assert.ok(noLore.length > 0);
  const refs = JSON.stringify(body.narratorOnly.universe.activeLoreBooks.filter((x) => x.kind === 'direct'));
  const full = body.participants.filter((p) => p.lore);
  assert.ok(full.length > 0);
  let checked = 0;
  for (const p of noLore) {
    const own = PP.refreshPrompt({ ...src, chat: { ...src.chat, scriptstate: { ...src.chat.scriptstate, '$ph_adv_check_rooms': '0' } } }, st, d, {}, () => 0.99);
    const all = JSON.parse(own.prompt.messages[1].content).participants.find((x) => x.sender === p.sender).lore;
    if (!all) continue; // 대화한 적 없는 후보는 어느 설정에서도 로어북 글이 없다
    checked++;
    assert.ok(!refs.includes(JSON.stringify(all).slice(1, 80)), `${p.name}: 로어북이 universe 로 다시 실리지 않는다`);
  }
  assert.ok(checked > 0);
  // 첫 사람과의 오래된 1:1 방은 말풍선 없이 갔지만, 그 말은 다른 방 참조로 간다
  assert.ok((body.crossRoomMessages ?? []).some((m) => m.room === `dm_${talk[0].id}`));
  // 수다는 말풍선과 함께 넘긴 방에서만
  assert.ok(body.rooms.filter((r) => r.banter).every((r) => r.messages.length > 0));
});
