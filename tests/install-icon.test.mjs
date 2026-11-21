// 사용자 11-14 D-2 (가): 「이전 아이콘으로」 되돌린 봇은 전체 설치 단추(「빠진 것 전부 채우기」)가 아이콘을 건드리지 않고 단추 강조도 풀린다.
// 세부 선택의 「플러그인 아이콘으로」 단추로만 다시 플러그인 아이콘이 된다.
// 실행: node --test tests/install-icon.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { installPackText } from '../scripts/data-pack.mjs';

const out = await build({
  stdin: {
    contents: `
      export { checkInstall, installIcon, restoreIcon, tidyIconList } from './src/host/install';
      export { installAction, installPage, instUi, refreshInstall } from './src/ui/editor/install';
      export { applyInstallPack } from './src/core/datapack';
      export { installData, installLore, plantGreetings, installLoreSettings } from './src/core/install';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text', '.md': 'text' },
  define: { __UPDATE_BASE__: '"https://example.invalid/release"', __PLUGIN_VERSION__: '"0.0.0"', __WORLD_PACK__: '"{}"', __INSTALL_PACK__: '"{}"', __ITEMS_PACK__: '"{}"', __LOOKS_PACK__: '"{}"', __HOMESHOP_PACK__: '"{}"' },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
M.applyInstallPack(installPackText());

// 설치 아이콘은 카드 빌드가 카드/봇카드.webp 를 그대로 release/icon.webp 로 쓴 것 (release/ 는 빌드 결과라 저장소에 없다)
const ICON = new Uint8Array(readFileSync(new URL('../카드/봇카드.webp', import.meta.url)));
const ICON_KEY = 'goei:icon';
const DIGEST = createHash('sha1').update(ICON).digest('hex').slice(0, 12);

/** 캐릭터 하나와 기기 저장소만 있는 가짜 Risu. 아이콘 파일만 받을 수 있다 (그 밖의 받기는 실패) */
function fakeRisu(char) {
  const store = new Map();
  const box = { char, store, fetched: [], files: new Map() };
  let n = 0;
  globalThis.risuai = {
    getCharacterFromIndex: async () => structuredClone(box.char),
    setCharacterToIndex: async (_i, next) => void (box.char = structuredClone(next)),
    saveAsset: async (bytes) => {
      const path = `assets/saved-${++n}.webp`;
      box.files.set(path, new Uint8Array(bytes));
      return path;
    },
    readImage: async (path) => box.files.get(path) ?? null,
    nativeFetch: async (url) => {
      box.fetched.push(String(url));
      if (/\/icon\.(png|webp)\?/.test(String(url))) return { ok: true, status: 200, arrayBuffer: async () => ICON.buffer.slice(0) };
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' };
    },
    pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k), keys: async () => [...store.keys()] },
  };
  return box;
}
const note = (box) => JSON.parse(box.store.get(ICON_KEY) ?? '{}')[box.char.chaId];
const iconFetches = (box) => box.fetched.filter((u) => /\/icon\./.test(u)).length;

test('host: 「이전 아이콘으로」는 기록을 지우지 않고 되돌렸다고 적는다. 다시 넣으면 풀린다', async () => {
  const box = fakeRisu({ chaId: 'c1', name: '내 봇', image: 'assets/mine.png' });
  await M.installIcon(0, () => {});
  assert.equal(box.char.image, 'assets/saved-1.webp');
  assert.deepEqual(note(box), { ours: 'assets/saved-1.webp', prev: 'assets/mine.png', digest: DIGEST }, '기록: 우리 아이콘·설치 전 아이콘·그림 지문');
  let r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.iconPrev, 'assets/mine.png');
  assert.equal(r.iconDeclined, false);

  assert.equal(await M.restoreIcon(0), true);
  assert.equal(box.char.image, 'assets/mine.png');
  assert.equal(note(box)?.declined, true, '되돌린 기록이 남는다');
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, false);
  assert.equal(r.iconDeclined, true);
  assert.equal(r.iconPrev, '', '이미 이전 아이콘이므로 「이전 아이콘으로」는 내지 않는다');

  await M.installIcon(0, () => {});
  assert.deepEqual(note(box), { ours: 'assets/saved-2.webp', prev: 'assets/mine.png', digest: DIGEST }, '다시 넣으면 되돌린 표시가 풀린다');
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.iconDeclined, false);
  assert.equal(r.iconPrev, 'assets/mine.png');
});

test('host: 봇 카드에 처음부터 든 아이콘(플러그인이 넣은 기록 없음)도 그림이 같으면 「있음」', async () => {
  const box = fakeRisu({ chaId: 'c9', name: '괴이', image: 'assets/card-icon.webp' });
  box.files.set('assets/card-icon.webp', ICON);
  let r = await M.checkInstall(0);
  assert.equal(r.state.icon, true, '카드 아이콘이 이번 판 그림이면 있음');
  assert.equal(r.state.iconOld, false);
  assert.equal(r.iconPrev, '', '설치 전 아이콘이 없으니 「이전 아이콘으로」는 없다');
  assert.deepEqual(note(box), { ours: 'assets/card-icon.webp', prev: '', digest: DIGEST });
  // 다른 그림이면 그대로 없음
  const other = fakeRisu({ chaId: 'c10', name: '내 봇', image: 'assets/else.png' });
  other.files.set('assets/else.png', new Uint8Array([1, 2, 3]));
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, false);
  assert.equal(note(other), undefined);
});

test('host·화면: 되돌린 뒤 Risu 에서 플러그인 아이콘을 직접 메인으로 고르면 「이전 아이콘으로」가 다시 나온다', async () => {
  const box = fakeRisu({ chaId: 'c3', name: '내 봇', image: 'assets/mine.png' });
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: box.char, chat: {} });
  M.instUi.forChar = -1;
  await M.installIcon(0, () => {});
  const ours = box.char.image;
  assert.equal(await M.restoreIcon(0), true);
  // Risu 아이콘 목록에서 직접 고름: 기록(declined)은 그대로, 메인만 우리 것
  box.char = { ...box.char, image: ours };
  assert.equal(note(box)?.declined, true);
  let r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.iconPrev, 'assets/mine.png', '지금 플러그인 아이콘이므로 되돌릴 길을 낸다');
  assert.equal(r.iconDeclined, false);
  await M.refreshInstall(ctx());
  const html = M.installPage(ctx());
  assert.match(html, /data-action="ed-inst-icon-back"/);
  assert.doesNotMatch(html, /data-action="ed-inst-icon"[ >]/);

  // 다시 되돌리면 전과 같다
  assert.equal(await M.restoreIcon(0), true);
  assert.equal(box.char.image, 'assets/mine.png');
  r = await M.checkInstall(0);
  assert.equal(r.iconDeclined, true);
  assert.equal(r.iconPrev, '');
});

test('화면: 되돌린 봇은 전체 단추가 아이콘을 건드리지 않고 강조가 풀린다. 「플러그인 아이콘으로」로만 다시 바뀐다', async () => {
  // 로어북·인사말·첫 메시지·로어북 설정이 갖춰진 설치된 봇 (사진은 다 받지 못한 상태: 이어 받으려고 전체 단추를 누르는 경우)
  const lore = M.installLore([]).lore;
  const planted = M.plantGreetings([], lore);
  const box = fakeRisu({ chaId: 'c2', name: '내 봇', image: 'assets/mine.png', globalLore: planted.lore ?? lore, alternateGreetings: planted.greetings, firstMessage: M.installData().greetings.first, loreSettings: M.installLoreSettings(undefined), additionalAssets: [] });
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: box.char, chat: {} });
  const env = { render: () => {}, refresh: async () => {} };
  M.instUi.forChar = -1;

  await M.installIcon(0, () => {});
  await M.refreshInstall(ctx());
  assert.match(M.installPage(ctx()), /data-action="ed-inst-icon-back"/);
  assert.doesNotMatch(M.installPage(ctx()), /data-action="ed-inst-icon"[ >]/);

  await M.installAction('ed-inst-icon-back', ctx(), env);
  assert.equal(box.char.image, 'assets/mine.png');
  assert.equal(M.instUi.iconDeclined, true);
  let html = M.installPage(ctx());
  assert.match(html, /<button class="gx-mini" data-action="ed-inst-icon" >플러그인 아이콘으로<\/button>/, '세부 선택에 「플러그인 아이콘으로」');
  assert.doesNotMatch(html, /data-action="ed-inst-icon-back"/);

  // 전체 단추: 사진 받기는 이 가짜 환경에서 실패하지만 아이콘은 받으려 들지도 않는다
  const before = iconFetches(box);
  await M.installAction('ed-inst-all', ctx(), env);
  assert.equal(iconFetches(box), before, '전체 단추가 아이콘을 받지 않는다');
  assert.equal(box.char.image, 'assets/mine.png', '되돌린 아이콘 그대로');
  assert.equal(note(box)?.declined, true);

  // 단추 강조: 아이콘 말고 다 갖춰졌으면 「다시 점검·맞추기」(강조 없음)
  M.instUi.state = { ...M.instUi.state, goei: true, pictures: { missing: [], bytes: 0, total: 0 }, wikiPack: true, tokenizer: true, directoryGaps: 0 };
  html = M.installPage(ctx());
  assert.match(html, /<button class="gx-mini" data-action="ed-inst-all">다시 점검·맞추기<\/button>/);
  M.instUi.iconDeclined = false;
  assert.match(M.installPage(ctx()), /<button class="gx-mini primary" data-action="ed-inst-all">빠진 것 전부 채우기<\/button>/, '기록이 없는 봇은 전처럼 강조');

  // 「플러그인 아이콘으로」
  await M.installAction('ed-inst-icon', ctx(), env);
  assert.equal(box.char.image, note(box).ours, '플러그인 아이콘이 메인');
  assert.equal(M.instUi.iconDeclined, false);
  assert.equal(M.instUi.state.icon, true);
  assert.match(M.instUi.info, /^아이콘 — 끝났어요\.$/);
  html = M.installPage(ctx());
  assert.match(html, /data-action="ed-inst-icon-back"/);
  assert.doesNotMatch(html, /data-action="ed-inst-icon"[ >]/);
});

const icons = (box) => (box.char.ccAssets ?? []).filter((a) => a.type === 'icon').map((a) => a.uri);

test('host: 메인이 되는 아이콘은 목록에 넣지 않는다 (같은 그림 두 장 X). 되돌리면 메인과 목록을 맞바꾼다 (사용자 2026-11-15)', async () => {
  const box = fakeRisu({ chaId: 'd1', name: '내 봇', image: 'assets/mine.png' });
  await M.installIcon(0, () => {});
  assert.equal(box.char.image, 'assets/saved-1.webp');
  assert.deepEqual(icons(box), ['assets/mine.png'], '목록에는 설치 전 아이콘만');
  assert.equal(await M.restoreIcon(0), true);
  assert.equal(box.char.image, 'assets/mine.png');
  assert.deepEqual(icons(box), ['assets/saved-1.webp'], '되돌리면 목록에는 플러그인 아이콘만');

  // 아이콘이 없던 봇: 목록이 빈 채로 메인만
  const bare = fakeRisu({ chaId: 'd2', name: '빈 봇', image: '' });
  await M.installIcon(0, () => {});
  assert.deepEqual(icons(bare), []);
});

test('host: 옛 판이 넣은 옛 그림 아이콘은 「새 그림 있음」으로 세고, 다시 받으면 새 그림이 메인이 된다 (사용자 2026-11-15)', async () => {
  // 옛 판이 넣은 상태: 지문 없는 기록, 메인 = 옛 그림, 목록에 설치 전 아이콘과 옛 그림이 둘 다 있다
  const box = fakeRisu({ chaId: 'e1', name: '내 봇', image: 'assets/old-ours.png', ccAssets: [{ type: 'icon', uri: 'assets/mine.png', name: 'main', ext: 'png' }, { type: 'icon', uri: 'assets/old-ours.png', name: 'goei', ext: 'png' }] });
  box.files.set('assets/old-ours.png', new Uint8Array([1, 2, 3]));
  box.store.set(ICON_KEY, JSON.stringify({ e1: { ours: 'assets/old-ours.png', prev: 'assets/mine.png' } }));
  let r = await M.checkInstall(0);
  assert.equal(r.state.icon, false);
  assert.equal(r.state.iconOld, true);
  assert.equal(r.iconPrev, 'assets/mine.png', '되돌릴 길은 그대로');
  await M.installIcon(0, () => {});
  assert.equal(box.char.image, 'assets/saved-1.webp');
  assert.deepEqual(note(box), { ours: 'assets/saved-1.webp', prev: 'assets/mine.png', digest: DIGEST }, '설치 전 아이콘 기록은 그대로');
  assert.deepEqual(icons(box), ['assets/mine.png'], '옛 그림은 목록에서 빠진다');
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.state.iconOld, false);

  // 옛 판이 넣었지만 그림이 이번 판과 같으면 그대로 두고 지문만 적어 둔다
  const same = fakeRisu({ chaId: 'e2', name: '내 봇', image: 'assets/ours.webp' });
  same.files.set('assets/ours.webp', ICON);
  same.store.set(ICON_KEY, JSON.stringify({ e2: { ours: 'assets/ours.webp', prev: '' } }));
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.state.iconOld, false);
  assert.equal(note(same).digest, DIGEST);
  assert.equal(iconFetches(same), 0);

  // 그림을 읽지 못하면 같은 것으로 본다
  const blind = fakeRisu({ chaId: 'e3', name: '내 봇', image: 'assets/gone.webp' });
  blind.store.set(ICON_KEY, JSON.stringify({ e3: { ours: 'assets/gone.webp', prev: '' } }));
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.state.iconOld, false);
});

test('host: 옛 판이 목록에도 넣어 둔 메인 아이콘을 목록에서 뺀다 (기록이 있는 봇만)', async () => {
  const dup = [{ type: 'icon', uri: 'assets/ours.webp', name: 'goei', ext: 'webp' }, { type: 'icon', uri: 'assets/mine.png', name: 'main', ext: 'png' }, { type: 'x', uri: 'assets/ours.webp', name: 'other', ext: 'webp' }];
  const box = fakeRisu({ chaId: 'f1', name: '내 봇', image: 'assets/ours.webp', ccAssets: structuredClone(dup) });
  assert.equal(await M.tidyIconList(0), false, '기록이 없는 봇은 건드리지 않는다');
  box.store.set(ICON_KEY, JSON.stringify({ f1: { ours: 'assets/ours.webp', prev: 'assets/mine.png' } }));
  assert.equal(await M.tidyIconList(0), true);
  assert.deepEqual(box.char.ccAssets, dup.slice(1), '메인과 같은 아이콘만 빠지고 나머지는 그대로');
  assert.equal(await M.tidyIconList(0), false);
});
