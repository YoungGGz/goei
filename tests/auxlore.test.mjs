// 보조 호출 로어북 「로어북 포함」 (core/auxlore.ts, core/refs.ts collectRefs): 기본값은 지금 방식 그대로,
// 켜면 카드에 넣은 항목·채팅 로어북·모듈 로어북이 Risu 규칙(항상 활성화, 활성화 키, 선택적 보조 키, 정규식 키)으로 더해진다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectRefs, auxlore, advanced } from '../dist-test/core.mjs';

const card = [
  { comment: '📜Faction', content: '세력 글' },
  { comment: '🙂Roster', content: '명부 글' },
  { comment: '늘 넣는 글', content: '카드 상시', alwaysActive: true, key: '' },
  { comment: '열쇠 글', content: '카드 열쇠', key: '은빛 열쇠, silver key' },
  { comment: '둘 다 나와야', content: '선택적', key: '창고', selective: true, secondkey: '지하, 옥상' },
  { comment: '식으로', content: '정규식', key: '/문\\s*지기/i', useRegex: true },
  { comment: '안 켜는 글', content: '@@dont_activate\n숨김', key: '숨김말' },
  { comment: '장식 있는 글', content: '@@depth 0\n장식 뗀 본문', key: '장식말' },
  { comment: 'GNet', content: '@@SECTION X\nsecret\n@@END', alwaysActive: true },
  { comment: '폴더', mode: 'folder', key: 'f1' },
];
const local = [{ comment: '채팅 글', content: '채팅 열쇠', key: '채팅말' }, { comment: 'WIKI｜문서', content: '위키 문서', alwaysActive: true }];
const modules = [{ comment: '모듈 상시', content: '모듈 늘', alwaysActive: true }, { comment: '', content: '이름 없는 모듈 글', key: '모듈말' }, { comment: '모듈 빈 키', content: '키 없음', key: '' }];
const src = (state = {}) => ({ char: { name: '봇', globalLore: card, moduleLore: modules }, chat: { message: [], scriptstate: state, localLore: local } });
const RISU = { [auxlore.AUX_LORE_VAR]: 'risu' };
const names = (rows, kind) => rows.filter((r) => !kind || r.kind === kind).map((r) => r.sources[0]);
const run = (state, text, opt = {}) => collectRefs(src(state), { scope: 'gnet', text, ...opt });

test('설정: 로어북 호출에 「보조 호출 로어북」, 기본값은 플러그인 기준', () => {
  assert.equal(advanced.advValue({}, 'gen', 'aux_lore'), 'plugin');
  assert.equal(advanced.advValue(RISU, 'gen', 'aux_lore'), 'risu');
  assert.equal(auxlore.auxLoreRisu({}), false);
  assert.equal(auxlore.auxLoreRisu(RISU), true);
});

test('기본값(플러그인 기준): 틀 밖 로어북은 들어가지 않는다 — 켜기 전과 같은 결과', () => {
  const text = '은빛 열쇠를 들고 창고 지하로. 문 지기와 채팅말, 모듈말, 장식말';
  const rows = run({}, text, { secondary: true });
  assert.deepEqual(names(rows), ['📜Faction', '🙂Roster']);
  // 「로어북 포함」여도 플러그인이 고르던 줄은 그대로 앞에 있다
  const on = run(RISU, text, { secondary: true });
  assert.deepEqual(names(on).slice(0, 2), ['📜Faction', '🙂Roster']);
  assert.deepEqual(on.slice(0, 2), rows);
});

test('로어북 포함: 항상 활성화는 늘, 그 밖에는 활성화 키가 글에 나올 때', () => {
  const none = run(RISU, '아무 말');
  assert.deepEqual(names(none), ['📜Faction', '🙂Roster', '늘 넣는 글', '모듈 상시']);
  assert.equal(none.find((r) => r.sources[0] === '모듈 상시').kind, 'active');
  const hit = run(RISU, 'Silver  KEY 를 들고 채팅말, 모듈말, 장식말');
  assert.deepEqual(names(hit, 'direct'), ['열쇠 글', '장식 있는 글', '채팅 글', '모듈말']);
  assert.equal(hit.find((r) => r.sources[0] === '장식 있는 글').content, '장식 뗀 본문');
  // 띄어쓰기를 지우고 본다 (Risu 와 같다)
  assert.deepEqual(names(run(RISU, '은빛열쇠'), 'direct'), ['열쇠 글']);
});

test('로어북 포함: 선택적은 보조 키도, 정규식 키는 정규식으로, @@dont_activate·내부 로어북·위키 문서·키 없는 항목은 빼고', () => {
  assert.deepEqual(names(run(RISU, '창고에 갔다'), 'direct'), []);
  assert.deepEqual(names(run(RISU, '창고 옥상'), 'direct'), ['둘 다 나와야']);
  assert.deepEqual(names(run(RISU, '문  지기가 섰다'), 'direct'), ['식으로']);
  const all = names(run(RISU, '숨김말 GNet 위키 문서 키 없음'));
  for (const n of ['안 켜는 글', 'GNet', 'WIKI｜문서', '모듈 빈 키']) assert.ok(!all.includes(n), n);
});

test('로어북 포함: 기능의 칩을 끄면 그 몫이 빠진다 (상시 로어북 = 항상 활성화, 관련 로어북 = 활성화 키, 2차 참조 = 고른 글 속 키)', () => {
  const text = '은빛 열쇠';
  assert.deepEqual(names(run(RISU, text, { active: false })), ['열쇠 글']);
  assert.deepEqual(names(run(RISU, text, { related: false })), ['📜Faction', '🙂Roster', '늘 넣는 글', '모듈 상시']);
  const hop = { char: { name: '봇', globalLore: [{ comment: '첫 글', content: '여기에 둘째말 이 나온다', key: '첫말' }, { comment: '둘째 글', content: '둘째', key: '둘째말' }] }, chat: { message: [], scriptstate: RISU } };
  assert.deepEqual(names(collectRefs(hop, { scope: 'gnet', text: '첫말', active: false })), ['첫 글']);
  const two = collectRefs(hop, { scope: 'gnet', text: '첫말', active: false, secondary: true });
  assert.deepEqual(two.map((r) => [r.sources[0], r.kind]), [['첫 글', 'direct'], ['둘째 글', 'secondary']]);
});
