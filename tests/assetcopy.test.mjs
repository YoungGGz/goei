// 에셋용 사본 (core/world/assetcopy.ts): 요원 로어북 사본을 카드 로어북 전용 폴더에 넣어도
// 플러그인이 읽는 로어북·본편에 고르는 로어·카드 업데이트 결과가 넣기 전과 같고, 사본은 저장을 거쳐도 남는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lore, withWorldLore, planUpdate, auxlore, ASSET_COPY_KEY, ASSET_COPY_NAME, makeAssetCopy, splitAssetCopy, assetCopyCount, sameAssetCopy } from '../dist-test/core.mjs';

const base = () => [{ comment: 'Directory', key: '', mode: 'normal', content: readFileSync(new URL('../src/data/install/directory.json', import.meta.url), 'utf8') }, { comment: '내가 넣은 글', key: '아무개', mode: 'normal', content: '내 글' }];
const world = withWorldLore(base());
const copy = makeAssetCopy(world);

test('사본: 요원만, 전용 폴더 하나, Risu 가 넣지 않는 첫 줄, 열쇠·본문은 그대로', () => {
  const agents = world.filter((e) => e.mode !== 'folder' && e.goeiKind === 'agent');
  assert.ok(agents.length > 0);
  assert.equal(assetCopyCount(copy), agents.length);
  assert.deepEqual([copy[0].mode, copy[0].key, copy[0].comment], ['folder', ASSET_COPY_KEY, ASSET_COPY_NAME]);
  for (const [i, e] of copy.slice(1).entries()) {
    assert.equal(e.folder, ASSET_COPY_KEY);
    assert.ok(e.content.startsWith('@@dont_activate\n'), e.comment);
    assert.equal(e.alwaysActive, false);
    assert.ok(!('goeiVirtual' in e) && !('goeiKind' in e));
    assert.deepEqual([e.comment, e.key, e.content], [agents[i].comment, agents[i].key, agents[i].content]);
    assert.ok(e.key, `${e.comment} 열쇠`);
  }
  assert.ok(!world.some((e) => e.goeiKind && e.goeiKind !== 'agent' && copy.some((c) => c.comment === e.comment && c.mode !== 'folder')), '괴이·세력은 넣지 않는다');
});

test('사본을 넣은 카드: 플러그인이 읽는 로어북과 본편에 고르는 로어가 넣기 전과 같다', () => {
  const withCopy = [...base(), ...copy];
  const seen = withWorldLore(withCopy);
  assert.deepEqual(seen, world);
  assert.ok(!seen.some((e) => e.key === ASSET_COPY_KEY || e.folder === ASSET_COPY_KEY));
  const name = world.find((e) => e.goeiKind === 'agent').comment;
  const chat = { message: [{ role: 'user', data: `${name} 을 만난다` }, { role: 'char', data: '본문' }], scriptstate: { $st_faction: 'A00' } };
  for (const mode of ['plugin', 'risu']) {
    const opts = lore.loreOptions({ globalLore: world }, chat, mode);
    assert.deepEqual(lore.computeLore(withWorldLore(withCopy), chat, opts), lore.computeLore(world, chat, opts), mode);
    assert.equal(lore.syncDecorators(withWorldLore(withCopy), mode) === null, lore.syncDecorators(world, mode) === null, mode);
  }
  // 「로어북 포함」 보조 호출도 사본을 읽지 않는다
  assert.deepEqual(auxlore.outsideEntries({ card: withWorldLore(withCopy), local: [], modules: [] }, () => true), auxlore.outsideEntries({ card: world, local: [], modules: [] }, () => true));
});

test('가르기: 사본만 떼고 나머지는 그대로, 빼면 넣기 전 카드', () => {
  const withCopy = [...base(), ...copy];
  const { rest, copy: got } = splitAssetCopy(withCopy);
  assert.deepEqual(rest, base());
  assert.deepEqual(got, copy);
  assert.deepEqual(splitAssetCopy(base()), { rest: base(), copy: [] });
  assert.ok(sameAssetCopy(got, makeAssetCopy(withWorldLore(rest))));
  assert.ok(!sameAssetCopy([copy[0], { ...copy[1], content: '@@dont_activate\n옛 글' }, ...copy.slice(2)], copy));
});

test('카드 업데이트: 사본은 그대로 남고 나머지 결과는 사본이 없을 때와 같다', () => {
  const payload = { schema: 1, version: '9.9.9', minPlugin: '0.0.0', data: { globalLore: [{ comment: 'Directory', key: '', mode: 'normal', content: base()[0].content }, { comment: 'Plugin manifest', content: '{"version":"9.9.9"}' }], customscript: [] } };
  const plain = planUpdate({ globalLore: base(), customscript: [] }, payload);
  const plan = planUpdate({ globalLore: [...base(), ...copy], customscript: [] }, payload);
  const { rest, copy: kept } = splitAssetCopy(plan.next.globalLore);
  assert.deepEqual(kept, copy);
  assert.deepEqual(rest, plain.next.globalLore);
  assert.deepEqual(plan.lore, plain.lore);
});
