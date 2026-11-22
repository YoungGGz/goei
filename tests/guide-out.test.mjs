// 코드에 박혀 있던 지침을 지침 절로 옮긴 것 (2026-11-13 사용자: 「설정 지침칸으로 안 빠지고 하드코딩 돼 있는 것을 지침으로」).
// 1) 기본 지침의 새 절 = 옛 소스의 글자 그대로 (tests/fixtures/guide-out-old.json sections)
// 2) 기본 지침으로 만든 요청문 = 옛 코드가 만들던 요청문 (같은 파일의 calls: 옮기기 전 코드로 만든 것)
// 3) 새 절이 없는 지침(옛 글로 고쳐 저장해 둔 것)이면 코드에 남긴 옛 글을 써서 요청문이 같다
// 4) 절을 고치면 요청문이 바뀐다 (절마다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBundle, calls, withoutSections, withSection, GUIDES_OF } from './guide-out-calls.mjs';

const OLD = JSON.parse(readFileSync(new URL('./fixtures/guide-out-old.json', import.meta.url), 'utf8'));
const M = await buildBundle(process.cwd());
const G = M.G;
const reset = () => { for (const n of G.GUIDE_NAMES) G.setGuideOverride(n, ''); };
const sectionsOf = (name) => Object.fromEntries([...G.guideDefault(name).matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)].map((m) => [m[1].trim(), m[2]]));
const BASE = calls(M);
// 상점 파일의 절 가운데 몇은 그 몰 지침에만 있다 (전수검사 11-13: 상점 지침은 몰 전용 절을, 우주몰·백일몽몰은 상점 전용 절을 뺌)
const IN = { TRUTH_ALL: ['Cos'], TRUTH_MIX: ['Cos'], TRUTH_NONE: ['Cos'], SECRET_NOTE: ['Cos'], WHERE_ANY: ['Shop'], WHERE_SHOP: ['Shop'], ASSIGN_ROLE_USEFUL: ['Cos', 'Bm'], ASSIGN_ROLE_BROAD: ['Cos', 'Bm'], ASSIGN_RULE: ['Cos', 'Bm'] };
const guidesOf = (file, name) => (file === 'Shop' && IN[name]) || GUIDES_OF[file];
// 사용자 2026-11-14 (여쭐 것 B~E 답): 옮긴 뒤 고친 지침 문장. 옛 글에 같은 고침을 입혀 견준다
const ANSWERED = [
  ['"react":"<≤400 chars or omit>"', '"react":"<≤400 chars, only when `react` is defined above; else omit>"'],
  [' `affinity.appraisal` (first impression) is never rewritten: return it unchanged or leave the slot out.', ''],
  ['(true = 0.10.9 explicit vocabulary, false = 0.10.7 blunt style)', '(true = explicit vocabulary, false = blunt style)'],
  [' rather than the summary fields', ''],
  ['Never propose dialogue, emotion, next actions, plot or outcomes.', 'Never propose dialogue, emotion, next actions, plot or outcomes beyond what a feature section below asks for.'],
  ["the user's latest input (≤120 chars)", "the user's latest input (≤400 chars)"],
  ['{"name":"<canonical>","reason":"<≤40 chars>"}', '{"name":"<canonical>"}'],
  ['updates: PATCH rows, add /messages/- only, each supplied room ID at most once.', 'updates: PATCH rows, each supplied room ID at most once.'],
  // 11-14 사용자: 「댓글을 다 비우지 마라」 네 번 → 한 번만 (AUTO.GUIDELINE 것만 남김)
  [' Empty comments is [] only for a quiet thread.', ''],
  [' do not copy identical counts or treat every topic as a silent thread.', ' do not copy identical counts.'],
  [' Zero comments is valid for an individual quiet post, not a default for every topic.', ''],
  // 11-15 사용자: 관전 방은 참여 인물마다 하나 (같은 인물들이면 이어 쓰고, 다르면 새 방)
  ['Do not repeat earlier output; when previousRoom is given, continue from it and reuse its identities and names where they still fit.', 'Do not repeat earlier output. rooms, when given, lists the existing view-only rooms of this kind with their recent messages. A room belongs to its participants: output with the same participants as a listed room is appended to that room, so continue from where that room stopped and keep its participant names exactly as listed. Output with different participants becomes a separate new room.'],
  // 11-15 토큰 낭비 정리: 새로고침에서 남긴 글은 번호·조회·추천·새 댓글만 돌려받는다(나머지는 저장본을 씀), 글의 time 칸(date 와 겹침)과 위키 여는 태그의 asset_src(읽는 곳 없음)는 쓰게 하지 않는다
  [" Protected records may exceed the maximum; preserve their IDs, authors, titles, bodies, dates, ownership and comment ancestry verbatim.", " Protected records may exceed the maximum; keep each one by returning its saved ID (the application restores its author, title, body, date, ownership and saved comments)."],
  ["On retained posts, keep all saved comments in order and append plausible NEW NPC comments; view/vote increases follow elapsed time and readership. Never edit or delete saved text.", "On retained posts, return only plausible NEW NPC comments, never the saved ones; view/vote increases follow elapsed time and readership. Saved text cannot be edited or deleted."],
  [" 1-based index. Every new post/comment is NPC-authored", " 1-based index. On a retained post, saved comments keep their 1-based positions from the persisted board and NEW comments are numbered after them (saved count + 1 onward): parent=0, a saved position or an earlier NEW number. Every new post/comment is NPC-authored"],
  ["Each posts item must be a complete object, including retained posts: author, title, time, date and content are JSON strings", "Each NEW posts item must be a complete object: author, title, date and content are JSON strings"],
  [" Copy retained fields verbatim rather than omitting them.", " A retained post is only {id, views, upvotes, comments}, where id is its saved ID and comments holds NEW comments only: do not copy its author, title, date, content, tag or saved comments."],
  ["\"time\":\"14:27\",", ""],
  ["\"time\":\"14:20\",", ""],
  ["every post (new or retained) also has \"tag\"", "every NEW post also has \"tag\""],
  [" Reuse labels already used on the board when they fit; supplied tags on retained posts are records, never change them.", " Reuse labels already used on the board when they fit. A retained post keeps its saved tag; return a tag for it only when it has none."],
  ["Keep asset_src=\"\". ", ""],
  [" asset_src=\"\"", ""],
  // 11-15 사용자(토큰 낭비 점검): 관전 출력의 반응 칸은 따로 절(VIEW.REACTIONS)로 — 이모지 반응이 꺼져 있거나 혼잣말이면 요청하지 않는다. 저장 상한(말풍선 수·글자 수)을 지침에 적는다
  [',"reactions":"-"}]}.', '}]}.'],
  [' reactions is "-" or space-separated emoji with counts such as "👍2", used sparingly and never above the number of other participants.', ' At most 30 messages; each text content at most 600 characters.'],
  ['OUTPUT CONTRACT\nReturn exactly {"name":"room name"', 'EMOJI REACTIONS\nA text message in the output may also carry "reactions": space-separated emoji with counts such as "👍2", used sparingly and never above the number of other participants. Omit it when there are none.\n\nOUTPUT CONTRACT\nReturn exactly {"name":"room name"'],
  // 11-16 인수 검토: 남긴 글의 말머리 두 절이 부딪치던 것, 다양성 강화가 쓰는 벌 설명(확률 낮은 벌)
  ["do not copy its author, title, date, content, tag or saved comments.", "do not copy its author, title, date, content, saved tag or saved comments."],
  ["{id, views, upvotes, comments}, where id is its saved ID", "{id, views, upvotes, comments}, plus tag only where the post category rule asks for one; id is its saved ID"],
  ["uses alternativePosts, the second candidate.", "uses the board with the lower probability."],
  // 11-16 사용자: 상점 주인은 주인공 자료(신분·최근 본문)를 읽은 사람이 아니다
  ["The protagonist is the player. Write everything in Korean unless told otherwise. Prices are in Korean won", "The protagonist is the player. The material about the protagonist (identity, recent story) is for you as the writer: the owner has not read it and knows only what happens in the shop, what the protagonist says or shows there, and what the story has already shown this owner to know. Write everything in Korean unless told otherwise. Prices are in Korean won"],
  // 11-16 사용자: 우주몰 운영자도 주인공 자료를 읽은 것이 아니다
  ["The \"owner\" is the 운영자. Buying is a bank transfer", "The \"owner\" is the 운영자. The material about the protagonist (identity, recent story) is for you as the writer: the 운영자 has not read it and knows the customer only by what they type and buy on this page. Buying is a bank transfer"],
  // 11-16 사용자: 포인트몰 1:1 상담도 본편 맥락을 받는다. 상담사는 그걸 읽은 사람이 아니다
  ["sees the counselor only as the code name on [손님에게 보이는 호칭]. Text chat only. Write in Korean.", "sees the counselor only as the code name on [손님에게 보이는 호칭]. Text chat only. The material about the customer under [주인공 신분], [상태창 — 지금 시각·장소], [진행 중 괴이·사건] and [최근 본문] is for you as the writer: the counselor has not read it and knows the customer only as the account under [손님] and by what they type in this chat. Write in Korean."],
  // 11-16 사용자: 포인트몰 공지도 주인공 자료를 아는 것처럼 쓰지 않는다
  ["There is no shopkeeper or chat; the \"owner\" line is a short mall notice about the goods in plain corporate Korean (never about points being issued or granted), or empty.", "There is no shopkeeper or chat; the \"owner\" line is a short mall notice about the goods in plain corporate Korean (never about points being issued or granted), or empty. The material about the protagonist (identity, recent story) is for you as the writer: the mall page does not know it, and the notice never refers to the customer or to what they are going through."],
  // 11-15 사용자: 같은 말 되풀이 줄이기. 상태창 이어 쓰기 안내는 직전 상태 블록에서 한 번만 (다시 물을 때의 분석 지시는 11-16 사용자 결정으로 원문 그대로)
  [' block just before the latest user input. Continue from it: advance the time and update the other fields. Older responses do not carry their status lines.', ' block just before the latest user input; follow the note in that block.'],
  // 전수점검 사소-77: Director 언어를 한국어로 두면 메모가 한국어라 「English reference」가 틀린다
  ['this English reference does not change it', 'this reference does not change it'],
  // 사용자 11-22: 연어 마켓 「정보」는 정보 공유가 아니라 정보를 사고파는 글
  ["Each post is a listing whose tag is exactly one of 팝니다 (selling), 삽니다 (buying), 나눔 (giving away) or 정보 (occult information).", "Each post is a listing whose tag is exactly one of 팝니다 (selling), 삽니다 (buying), 나눔 (giving away) or 정보 (information for sale or wanted). A 정보 listing trades a piece of information the way other listings trade goods: the poster either sells what they know or offers to pay for what someone else knows. The post says only what the information is about and why it is worth paying for, names a price or asks for offers, and says how it is handed over once the deal is made; the information itself is never written in the post or given away in the comments. It is not a tip, a warning, a rumor thread or a discussion post."],
  ["Comments are questions, haggling, 예약 requests and warnings.", "Comments are questions, haggling, 예약 requests and warnings; under a 정보 listing they haggle, ask for proof that the information is real, or doubt the seller, and nobody leaks the information for free."],
  ["salvage, information and odd services. Sellers and buyers", "salvage, information and odd services. Information is a commodity here like any other: it is sold and bought, never posted for free. Sellers and buyers"],
];
const moved = Object.entries(OLD.sections).flatMap(([file, list]) => list.map(([name, body]) => ({ file, name, body })));

test('옮긴 절: 기본 지침의 글이 옛 소스 글자와 같다', () => {
  assert.equal(moved.length, 95);
  for (const { file, name, body } of moved) {
    for (const guide of guidesOf(file, name)) assert.equal(sectionsOf(guide)[name], ANSWERED.reduce((x, [o, n]) => x.split(o).join(n), body), `${guide} / ${name}`);
  }
});

test('새 지침 넷이 지침 목록에 있고 이름표가 있다', () => {
  for (const n of ['Common', 'Main', 'UpdaterExtra', 'Asset']) {
    assert.ok(G.GUIDE_NAMES.includes(n) && G.isGuideName(n), n);
    assert.ok(G.GUIDE_LABEL[n], n);
    assert.ok(G.splitGuide(G.guideDefault(n)).length > 3, `${n}: 절 단위로 갈린다`);
    assert.equal(G.joinGuide(G.splitGuide(G.guideDefault(n))), G.guideDefault(n), `${n}: 쪼갰다 합치면 그대로`);
  }
});

test('기본 지침으로 만든 요청문 = 옮기기 전 코드가 만들던 요청문', () => {
  reset();
  const names = Object.keys(OLD.calls);
  assert.equal(names.length, 56);
  // 옛 요청문에서 옮겨 쓰는 글: 활발한 게시판 문단, 괴담넷 소개 문단, 진열대용 구분 규칙, 우주몰 SHELF_SECRET 문단(진실 섞음)
  const ACTIVE = 'This is an active public community with many silent readers, not a nearly empty board. Typical new board entries have roughly 500–8,000 views and 20–300 upvotes; widely shared or older popular topics can reach tens of thousands of views and hundreds of upvotes. These are scale guides, not fixed floors or matched ratios: vary irregularly by age, topic and popularity, with upvotes below views. Spread posting times plausibly before narrative time so readership can accumulate; do not make every post seconds old with single-digit votes and tens of views. Existing counts never decrease and may grow with elapsed time and continued discussion.';
  const ABOUT = OLD.calls['gnet.refresh.gn'].match(/## About the board\\n.*?(?=\\n)/)[0];
  const TAGS = OLD.calls['shop.talk.cos.secret'].match(/\\n구분: leave empty.*?(?=\\n)/)[0];
  const SECRET = OLD.calls['shop.shelf.cos.mix'].match(/\\nFor this mall the 설명 column.*?(?=\\n)/)[0];
  // 11-15 토큰 낭비 정리: 댓글·글 하나 새로고침의 「다른 글 활동」에서 작업 대상 글은 본문·댓글을 빼고 번호·제목·수치만 넘긴다 (작업 입력에 이미 있음)
  const ACT_TARGET = OLD.calls['gnet.comment'].match(/\{\\"id\\":100001,[^{}]*\\"comments\\":\[\{[^{}]*\}\],\\"commentCount\\":1,\\"commentsAllowed\\":false\}/)[0];
  // 옮긴 뒤 사용자 지시로 고친 지침 문장 (2026-11-13 소모·장착 판정): 옛 요청문에 같은 고침을 입혀 견준다. 그 밖의 글자는 그대로여야 한다
  const LATER = [
    [ACT_TARGET, '{\\"id\\":100001,\\"author\\":\\"글쓴이\\",\\"title\\":\\"복도 불빛\\",\\"date\\":\\"2025.01.01 10:00\\",\\"views\\":3,\\"upvotes\\":1,\\"commentCount\\":1,\\"commentsAllowed\\":false}'],
    // 11-15 토큰 낭비 정리: 새로고침에 넘기는 게시판 글에서 time 칸을 뺌 (date 와 겹침)
    ['\\"time\\":\\"10:00\\",\\"date\\"', '\\"date\\"'],
    // 11-15 토큰 낭비 정리: 쪽지 답장의 공개 글 참고에서 원글(PUBLIC ORIGIN 에 이미 실림)은 본문을 뺌
    ['\\"date\\":\\"2025.01.01 10:00\\",\\"content\\":\\"3층 복도 불이 깜빡인다\\",\\"comments\\":[{\\"id\\"', '\\"date\\":\\"2025.01.01 10:00\\",\\"comments\\":[{\\"id\\"'],
    ['장비 (worn or carried on the body: clothes, armor, bags, accessories)', '장비 (worn or strapped on the body: clothes, armor, bags, accessories; not something merely kept in a pocket or bag)'],
    ['소모N (used up; N is how many uses this one item holds, judged from what it is and how it is sold)', '소모N (anything spent by using it — medicine, dressings, food and drink, ammunition, tape, batteries, single-use talismans — must be 소모N; N is how many uses this one item holds, counting everything in a set or pack, judged from what it is and how it is sold)'],
    // 전수검사 11-13: 괴담넷 보호 글은 최대 개수에 안 센다(코드와 맞춤)
    ["Total target maximum including protected posts: ", "Target maximum, not counting protected posts: "],
    // 전수검사 11-13: 같은 뜻
    ["\\nOn regeneration:\\n- Replace unprotected NPC posts with new topics.\\n- Preserve the specified protected categories with original IDs/text.\\n- Count protected posts toward the maximum. If they fill it, add no new posts.\\n- Protected records may exceed the maximum; never delete them automatically.\\n- Do not invent user actions or mine=true ownership.", ""],
    // 전수검사 11-13: DC 말투 기본은 괴담갤 갈래에만
    ["Default to Korean DCInside-style anonymous-community speech: informal, casual, slang, memes, blunt skepticism, rough jokes, occasional profanity and arguments; casual comments often omit final periods. Include serious firsthand accounts too. Vary ages, interests, sentence lengths and endings; do not make everyone a polite adviser or an exposition narrator. Strong criticism and disagreement need not be immediately moderated or resolved.\\nDo not use civilian DC meme speech.", "Include serious firsthand accounts too. Vary ages, interests, sentence lengths and endings; do not make everyone a polite adviser or an exposition narrator. Strong criticism and disagreement need not be immediately moderated or resolved.\\nDo not use civilian DC meme speech."],
    // 전수검사 11-13: 같은 뜻
    ["Default to Korean DCInside-style anonymous-community speech: informal, casual, slang, memes, blunt skepticism, rough jokes, occasional profanity and arguments; casual comments often omit final periods. Include serious firsthand accounts too. Vary ages, interests, sentence lengths and endings; do not make everyone a polite adviser or an exposition narrator. Strong criticism and disagreement need not be immediately moderated or resolved.\\nThis is not a DC gallery", "Include serious firsthand accounts too. Vary ages, interests, sentence lengths and endings; do not make everyone a polite adviser or an exposition narrator. Strong criticism and disagreement need not be immediately moderated or resolved.\\nThis is not a DC gallery"],
    // 전수검사 11-13 (사용자 10-1): 새로고침 출력 예시를 자리표시로
    ["{\\\"posts\\\":[{\\\"author\\\":\\\"abc92\\\",\\\"id\\\":1846002,\\\"title\\\":\\\"폐건물 체험 업체 사진 재탕 아님?\\\",\\\"time\\\":\\\"14:27\\\",\\\"date\\\":\\\"2025.05.13 14:27\\\",\\\"views\\\":4237,\\\"upvotes\\\":113,\\\"content\\\":\\\"어제 찍었다는 인증사진이 작년 후기랑 똑같음\\\\n창문에 걸린 비닐 모양까지 같은데 이걸 돈 받고 파네\\\",\\\"mine\\\":false,\\\"comments\\\":[{\\\"author\\\":\\\"ㅇㅇ(118.235)\\\",\\\"content\\\":\\\"작년 사진 주소도 올려봐 사진만 같으면 광고용일 수도 있지\\\",\\\"parent\\\":0,\\\"mine\\\":false},{\\\"author\\\":\\\"abc92\\\",\\\"content\\\":\\\"후기 게시판 8월 글 봐 거기선 참가자가 직접 찍었다고 함\\\",\\\"parent\\\":1,\\\"mine\\\":false},{\\\"author\\\":\\\"감자\\\",\\\"content\\\":\\\"나 저기 예약했는데 확인부터 해야겠네\\\",\\\"parent\\\":0,\\\"mine\\\":false},{\\\"author\\\":\\\"ㅁㄴㅇㄹ\\\",\\\"content\\\":\\\"귀신보다 환불이 더 무섭겠노 ㅋㅋ\\\",\\\"parent\\\":3,\\\"mine\\\":false}]},{\\\"author\\\":\\\"아직안잠\\\",\\\"id\\\":1846001,\\\"title\\\":\\\"야간 편의점 앞 고양이 오늘도 출근함\\\",\\\"time\\\":\\\"14:20\\\",\\\"date\\\":\\\"2025.05.13 14:20\\\",\\\"views\\\":941,\\\"upvotes\\\":27,\\\"content\\\":\\\"내 교대시간보다 정확하다\\\\n사료 없으니까 쳐다도 안 봄\\\",\\\"mine\\\":false,\\\"comments\\\":[{\\\"author\\\":\\\"ㅇㅇ(211.36)\\\",\\\"content\\\":\\\"걔 입장에선 니가 사료 늦게 주는 알바임\\\",\\\"parent\\\":0,\\\"mine\\\":false}]}],\\\"incoming\\\":[]}", "{\\\"posts\\\":[{\\\"author\\\":\\\"handle\\\",\\\"id\\\":1846002,\\\"title\\\":\\\"title\\\",\\\"time\\\":\\\"14:27\\\",\\\"date\\\":\\\"2025.05.13 14:27\\\",\\\"views\\\":4237,\\\"upvotes\\\":113,\\\"content\\\":\\\"body line\\\\nbody line\\\",\\\"mine\\\":false,\\\"comments\\\":[{\\\"author\\\":\\\"handle\\\",\\\"content\\\":\\\"comment\\\",\\\"parent\\\":0,\\\"mine\\\":false},{\\\"author\\\":\\\"handle\\\",\\\"content\\\":\\\"reply to comment 1\\\",\\\"parent\\\":1,\\\"mine\\\":false},{\\\"author\\\":\\\"handle\\\",\\\"content\\\":\\\"comment\\\",\\\"parent\\\":0,\\\"mine\\\":false},{\\\"author\\\":\\\"handle\\\",\\\"content\\\":\\\"reply to comment 3\\\",\\\"parent\\\":3,\\\"mine\\\":false}]},{\\\"author\\\":\\\"handle\\\",\\\"id\\\":1846001,\\\"title\\\":\\\"title\\\",\\\"time\\\":\\\"14:20\\\",\\\"date\\\":\\\"2025.05.13 14:20\\\",\\\"views\\\":941,\\\"upvotes\\\":27,\\\"content\\\":\\\"body line\\\\nbody line\\\",\\\"mine\\\":false,\\\"comments\\\":[{\\\"author\\\":\\\"handle\\\",\\\"content\\\":\\\"comment\\\",\\\"parent\\\":0,\\\"mine\\\":false}]}],\\\"incoming\\\":[]}"],
    // 전수검사 11-13 (사용자 9-1): 연어 마켓 말머리 넷
    ["Each post is a listing: 팝니다 (selling) or 삽니다 (buying).", "Each post is a listing whose tag is exactly one of 팝니다 (selling), 삽니다 (buying), 나눔 (giving away) or 정보 (occult information)."],
    // 전수검사 11-13 (승인 글): 괴담넷 요청문에서 로그 끝 표시·주인공 머리말을 뺌, 활발한 게시판 문단을 새 글 반응 절로 옮김, 쪽지에 게시판 소개 문단
    ['\\nThe end of the chat log will be marked with `--- End of the log ---`. Ignore all other similar markers in the middle.', ''],
    ['## User-controlled protagonist (narrator reference only)\\n\\n## Universe Settings\\n\\n', ''],
    [`\\n${ACTIVE}`, ''],
    [' There is no per-post minimum. Saved threads are not capped at six; user-action reactions follow their separate contract.', `\\n${ACTIVE}`],
    ['Retained comment totals may exceed six; the initial', 'The initial'],
    ['no markup, process blocks or text', 'no markup or text'],
    ['Return only NEW comments: 0–4 per post, each', 'Return only NEW comments, each'],
    ['instructions.\\nROLE BINDING', `instructions.\\n${ABOUT}\\n\\nROLE BINDING`],
    // 전수검사 11-13 (승인 글): 괴담톡 보기 전용 방
    ['recognizable character nicknames', "each character's name as written in the universe settings"],
    [" Limit each speaker to established knowledge and keep the exchange within the narrative's current endpoint.", ''],
    // 전수검사 11-13 (승인 글): 우주몰 예시 말·설명 칸·흥정 문장. 대화 요청은 그 몰의 줄 꼴(진실 칸)·SHELF_SECRET 절, 진열대용 구분 규칙은 뺌
    ['Like: 「굉장하고 강한 상품, 만일 우리에게 물어보면」, 「입금 확인되면 상품 간다, 즉시」, 「환불 다음 기회」 — do not reuse these or the Waldo line.', 'Do not reuse the Waldo line.'],
    ['효과|구분\\" to add', '효과|구분|진실\\" to add'],
    ['(이름|값|쓰임|그림|무게|설명|효과|구분).', '(이름|값|쓰임|그림|무게|설명|효과|구분|진실).'],
    ['exactly: 이름|값|쓰임|그림|무게|설명|효과|구분. 값', 'exactly: 이름|값|쓰임|그림|무게|설명|효과|구분|진실. 값'],
    [`ordinary goods).${TAGS}`, `ordinary goods).${SECRET}`],
    ['(what it is, condition, quantity).', '(what it is, condition).'],
    ['— where it supposedly comes from and how to use it (출처·사용법), in', '— what it is and how to use it (사용법), in'],
    [" Haggling: the owner may refuse, counter, or accept; accept only when it makes sense for this owner, and then change that item's price: a lower figure, or another payment the owner agrees to take instead, written in words.", ''],
    // 전수검사 11-13 (승인 글): 아는 것 규칙은 메인 요청에 한 번만(인물 지침), 성 어휘 문장은 인물별 문장으로
    ['not lines to say. Do not have a character mention or act on a secret or fact they have not witnessed, learned, or otherwise demonstrably known. Never invent how they acquired information. Keep facts, beliefs, guesses, and misunderstandings distinct. A missing record does not prove ignorance: actual evidence in the conversation may establish knowledge.', 'not lines to say.'],
    [' Vocabulary rule, mandatory: write like adults talking dirty in private. Name body parts and acts with the crude Korean words actually used (`자지`, `보지`, `젖`, `엉덩이`, `박다`, `빨다`, `싸다` and similar), and name positions and play plainly. Euphemism, medical or academic terms, poetic wording, and softened phrasing are errors; if a sentence could appear in a romance novel, rewrite it cruder.', ''],
    [' Use the 0.10.7 style: blunt everyday sex words and slang, crude terms included, with no euphemism, clinical vocabulary, literary wording, or psychological analysis. Keep it direct but do not force the stronger explicit vocabulary examples.', ''],
    // 전수검사 11-13 (승인 글): 상태창·소지품·잠긴 로어·그림 요청 예시
    ['every response, as the final line.', 'every response.'],
    ['points and won never convert, and points are spent only at the Baekilmong point shop (Welfare Mall).', 'points and won never convert.'],
    [' If a "Really" list follows, those items\' real effects differ from or go beyond their labels: what happens follows the Really line, nobody knew it beforehand, and the protagonist learns it only through what happens.', ''],
    ['on its own line at the very end.', 'on its own line after the prose.'],
    ['[1] Lee Ha-neul walked into the room with a quiet smile.\n[2] She glanced', '[1] Lee Ha-neul walked into the room with a quiet smile.\n[2] Lee Ha-neul glanced'],
    ['[1] Eileen walked into the room with a quiet smile.\n[2] She glanced', '[1] Eileen walked into the room with a quiet smile.\n[2] Eileen glanced'],
    // 사용자 2026-11-14: 「실제 한국 물가처럼」은 일반 상점에만, 연어 마켓은 DC 말투 기본 문장 없음, 📜Faction 범례 줄 없음
    ['\\nPrices should feel like real Korean prices for that kind of shop.', ''],
    ['not story readers or game players.\\n\\n### Tone and manner\\n\\nDefault to Korean DCInside-style anonymous-community speech: informal, casual, slang, memes, blunt skepticism, rough jokes, occasional profanity and arguments; casual comments often omit final periods. ', 'not story readers or game players.\\n\\n### Tone and manner\\n\\nWrite like a busy neighborhood resale app used by very different people, each in their own way: terse sellers who give only the item, condition and price; chatty sellers who explain why they are selling; older users in polite full sentences; younger users in clipped casual speech; collectors precise about provenance; brokers vague about where things came from; buyers who haggle, ask to reserve, ask for more photos or never reply. Vary length, politeness, spelling care and how much each poster reveals. Keep it a trade board, not a story board. '],
    [', all listed in the same plain resale tone.', '.'],
    ['\nFactions: 1 Management Bureau · 2 Fake Management Bureau · 3 Baekilmong · 4 Civilian · 5 Freelancer\n', '\n'],
    // 사용자 2026-11-14: 「무기」 칸 → 「손」 칸 (손에 드는 것 전부)
    ['무기 (held and fought with)', '손 (held in the hand to be used or fought with: weapons, tools, lights, umbrellas and anything else the protagonist holds rather than wears; the protagonist has two hands)'],
  ];
  // 요청문은 JSON 글자열 꼴(따옴표 \\")로 견주므로 두 꼴 모두 입힌다
  const esc = (t) => JSON.stringify(t).slice(1, -1);
  const later = (t) => [...LATER, ...ANSWERED, ...ANSWERED.map(([a, b]) => [esc(a), esc(b)])].reduce((x, [a, b]) => x.split(a).join(b), t);
  // 전수점검 보통-36: 우주 쇼핑몰은 값이 정해져 있다(COMMON) — 그 몰 지침의 대화 절에서만 값 바꾸기·할인 문장을 뺐다 (다른 상점 지침은 그대로)
  const COS_LATER = [
    ['and prizes it (discounts on it are rare and grudging).', 'and prizes it.'],
    ['" to add, "~ 이름|새값" to change a price (won, or the agreed payment in words), "- 이름" to remove.', '" to add, "- 이름" to remove. Prices are fixed, so never change one.'],
    ['answer only, fetch something, re-stock the whole shelf, lower a price, refuse, or end the dealing?', 'answer only, fetch something, re-stock the whole shelf, refuse, or end the dealing? (Prices are fixed: never lower one.)'],
    ['never add an item and never re-stock the shelf (no "+" lines, no mode all). A price may still change ("~" lines) and an item may be withdrawn ("-" lines).', 'never add an item and never re-stock the shelf (no "+" lines, no mode all). Prices stay as listed (no "~" lines); an item may be withdrawn ("-" lines).'],
    // 「문의 끊음」(사용자): 우주 쇼핑몰은 흥정이 없어 「끝없는 흥정」이 안 맞는다 — 그 몰 지침의 KICK_ON·KICK_OFF 만 운영자 글로
    ['If the owner has had enough (insults, endless haggling, trouble), they may end the dealing: say so in character and add <closed/>.', 'If the 운영자 has had enough of this customer, by its own odd standards, it may end the enquiry: it says so in its own voice, and <closed/> follows after the blocks. Only the enquiry ends; the page goes on selling at its fixed prices.'],
    ['<closed/> only if the owner ends the dealing.', '<closed/> only if the 운영자 ends the enquiry.'],
    ['The owner never ends the dealing; however annoyed, they keep the shop open (never output <closed/>).', 'The 운영자 never ends the enquiry; it keeps answering (never output <closed/>).'],
  ];
  const cosLater = (k, t) => (/\.cos\b/.test(k) ? [...COS_LATER, ...COS_LATER.map(([a, b]) => [esc(a), esc(b)])].reduce((x, [a, b]) => x.split(a).join(b), t) : t);
  // 사용자 2026-11-22: 주인·운영자 답 길이를 문장 수로 못박지 않는다, 반응을 메뉴에서 고르게 하지 않는다, 값은 새로 부르거나 바뀔 때만 말한다
  const TALK_1122 = [
    ["the owner's reply, in character, Korean, 1–4 sentences, no stage directions", "the owner's reply, in character, Korean, speech only (no stage directions); as much as this owner would say to that at this point, a word or two when that answers it, more when they have more to say. Each reply is judged on its own; how long the earlier replies ran is not a pattern to keep"],
    ["2. Given this owner's character and the shop identity, what is the honest reaction: answer only, fetch something, re-stock the whole shelf, lower a price, refuse, or end the dealing?\n3. Pick exactly one change mode. Only things within the shop identity may be added.", '2. How does this owner, being who they are, take that and answer it?\n3. Does anything on the shelf change because of it? Pick exactly one change mode; when it was only talk, nothing changes. Only things within the shop identity may be added.'],
    ["2. Given this owner's character and the shop identity, what is the honest reaction: answer only, fetch something, re-stock the whole shelf, refuse, or end the dealing? (Prices are fixed: never lower one.)\n3. Pick exactly one change mode. Only things within the shop identity may be added.", '2. How does the 운영자, being what it is, take that and answer it? (Prices are fixed: never lower one.)\n3. Does anything on the shelf change because of it? Pick exactly one change mode; when it was only talk, nothing changes. Only things within the shop identity may be added.'],
    ["Put the price in the owner's line too.", "The owner's line names the figure when it is new or has changed."],
    ["5. Write the owner's line with the figure, and the <offer>.", "5. Write the owner's line (it names the figure when the figure is new or has changed), and the <offer>."],
  ];
  const talk1122 = (t) => [...TALK_1122, ...TALK_1122.map(([a, b]) => [esc(a), esc(b)])].reduce((x, [a, b]) => x.split(a).join(b), t);
  for (const k of names) { const a = BASE[k], b = talk1122(cosLater(k, later(OLD.calls[k]))); if (a !== b && process.env.DBG) { let i = 0; while (a[i] === b[i]) i++; console.log(k, i, JSON.stringify(a.slice(i - 80, i + 160)), JSON.stringify(b.slice(i - 80, i + 160))); } assert.equal(a, b, k); }
});

test('새 절이 없는 지침(옛 글로 고쳐 둔 것)이면 코드에 남긴 옛 글을 쓴다: 요청문이 같다', () => {
  for (const [file, guides] of Object.entries(GUIDES_OF)) {
    const names = OLD.sections[file].map(([n]) => n);
    for (const g of guides) {
      const cut = withoutSections(G.guideDefault(g), names);
      for (const n of names) assert.ok(!cut.includes(`@@SECTION ${n}\n`), `${g} ${n}`);
      G.setGuideOverride(g, cut);
    }
  }
  try {
    for (const { file, name } of moved) for (const g of GUIDES_OF[file]) assert.equal(G.guideSec(g, name), null, `${g} / ${name}`);
    const out = calls(M);
    for (const k of Object.keys(BASE)) assert.equal(out[k], BASE[k], k);
  } finally { reset(); }
});

test('절을 고치면 그 절이 들어가는 요청문이 바뀐다 (절마다)', () => {
  const MARK = 'ZZ-EDITED-ZZ';
  for (const { file, name } of moved) {
    for (const g of guidesOf(file, name)) G.setGuideOverride(g, withSection(G.guideDefault(g), name, (b) => `${b} ${MARK}`));
    try {
      const out = calls(M);
      const hit = Object.keys(out).filter((k) => out[k] !== BASE[k]);
      assert.ok(hit.length > 0, `${file} / ${name}: 어느 요청문도 바뀌지 않았다`);
      assert.ok(hit.every((k) => out[k].includes(MARK)), `${file} / ${name}: 바뀐 요청문에 고친 글이 있다`);
    } finally { reset(); }
  }
  assert.deepEqual(calls(M), BASE, '되돌리면 처음과 같다');
});

test('자리 채우기: {이름} 만 채우고 {{…}}·모르는 이름은 그대로, 채운 값은 다시 훑지 않는다', () => {
  assert.equal(G.fillVars('a {x} {{user}} {y} {X}', { x: '{y}', user: 'U' }), 'a {y} {{user}} {y} {X}');
  assert.equal(G.guideTxt('Common', 'NO.SUCH'), '', '없는 절은 빈 글 (코드에 옛 글 없음)');
  G.setGuideOverride('Common', withSection(G.guideDefault('Common'), 'RETRY.ANALYZE', () => '   '));
  try {
    assert.equal(G.guideSec('Common', 'RETRY.ANALYZE'), null, '비운 절은 없는 것으로');
    assert.equal(M.craft.retryAnalyze(), G.guideDefaultSec('Common', 'RETRY.ANALYZE'), '비우면 기본 파일의 절');
  } finally { reset(); }
});
