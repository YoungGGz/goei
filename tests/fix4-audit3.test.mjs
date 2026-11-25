// 전수점검 3차(2026-11-24) 진짜 버그 고침 점검. 번호는 인수인계/플레이순서_점검/3차/결과.md 의 R 번호
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-audit3-'));
const load = async (name, contents) => {
  const outfile = join(dir, `${name}.mjs`);
  await build({ stdin: { contents, resolveDir: 'src/core', loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'esm', loader: { '.txt': 'text' }, logLevel: 'silent' });
  return import(pathToFileURL(outfile));
};
const T = await load('thoughts', "export * from './thoughts'; export { findStatusTags } from './world/status'; export { syncWalletToStatus, readWallet } from './wallet'; export { findShopTag } from './shop'; export { messageText } from './refs'; export { sceneMessage } from './dispatch';");
const D = await load('dispatch', "export * from './dispatch'; export { setUserRules, setGuideOverride } from './guides';");
const S = await load('shop', "export * from './shop';");
const I = await load('items', "export * from './items';");

const STATUS = (won) => `[▣|2026.11.25|10:00|맑음|12|서울|없음|없음|N|민간인|${won}]`;

// ── R01 ──
test('R01: <thinking> 도 생각 블록으로 뗀다 (thoughts·thinking·think)', () => {
  for (const tag of ['Thoughts', 'thinking', 'think', 'THINKING']) {
    assert.equal(T.stripThoughts(`<${tag}>속\n[shop: 가게|주인]</${tag}>\n본문`), '본문', tag);
    assert.deepEqual(T.splitThoughts(`<${tag}>속</${tag}>\n본문`), { head: `<${tag}>속</${tag}>\n`, body: '본문' }, tag);
  }
  assert.equal(T.findShopTag('<thinking>[shop: 가게|주인]</thinking>\n본문'), null);
});

test('R01: 상태창 찾기는 생각 블록 안의 상태창을 읽지 않는다', () => {
  const text = `<think>${STATUS('999')}</think>\n본문\n${STATUS('140,000')}`;
  const tags = T.findStatusTags(text);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].wallet, '140000');
  assert.equal(T.findStatusTags(`<thinking>${STATUS('7')}</thinking>\n본문`).length, 0);
});

test('R01: 생각 블록에만 상태창이 있으면 가계부를 그 값으로 맞추지 않는다', () => {
  const chat = { message: [{ role: 'user', data: '가', chatId: 'u1' }, { role: 'char', data: `<think>${STATUS('7')}</think>\n본문`, chatId: 'c1' }], scriptstate: {} };
  assert.equal(T.syncWalletToStatus(T.readWallet(chat.scriptstate, 140000), chat), null);
});

test('R01: outsideThoughts 는 블록 밖 글에만 적용하고 블록은 그대로 둔다', () => {
  const up = (s) => s.toUpperCase();
  assert.equal(T.outsideThoughts('ab<think>cd</think>\nef', up), 'AB<think>cd</think>\nEF');
  assert.equal(T.outsideThoughts('<Thoughts>a</Thoughts>\n<thinking>b</thinking>\nxy', up), '<Thoughts>a</Thoughts>\n<thinking>b</thinking>\nXY');
  assert.equal(T.outsideThoughts('xy', up), 'XY');
  // 닫히지 않은 블록이 맨 앞이면(받는 중) 통째로 생각이다
  assert.equal(T.outsideThoughts('<think>cd [x]', up), '<think>cd [x]');
  const src = readFileSync('src/body.ts', 'utf8');
  assert.match(src, /out = outsideThoughts\(out, \(part\) => drawPart\(part, ours\)\);/);
});

// ── R04 ──
test('R04: 첫 장면 표식은 메시지 글에서 뗀다 (인물 갱신기·곁 기능 요청에 안 간다)', () => {
  const t = T.messageText(T.sceneMessage('면접장에 들어섰다.'));
  assert.equal(t, '면접장에 들어섰다.');
  assert.doesNotMatch(t, /GOEI_SCENE/);
});

// ── R17 ──
test('R17: 이동·임무 덧붙일 규칙의 [[영문]] 은 치환되지 않고 출동도 막지 않는다', () => {
  D.setUserRules([{ id: 'r1', title: '시험', text: '[[TIP]] 과 [[DEST]] 와 [[foo]] 를 그대로 둔다', to: ['Directive'], on: true }]);
  try {
    const d = D.parseDirective();
    const out = D.sceneDirective(d, '명일 아파트', ['스팡달'], 0, true);
    assert.match(out, /\[\[TIP\]\] 과 \[\[DEST\]\] 와 \[\[foo\]\] 를 그대로 둔다/);
    assert.match(out, /명일 아파트/);
    // 규칙은 COMMON 절 끝(OPENING 앞)에 붙는다: 규칙 묶음을 빼면 규칙 없는 지시문과 같고, 그 뒤에 OPENING·CONTEXT 가 온다
    D.setUserRules([]);
    const plain = D.sceneDirective(D.parseDirective(), '명일 아파트', ['스팡달'], 0, true);
    const at = out.indexOf('[[TIP]]');
    const head = out.lastIndexOf('\n\n', at);
    const end = out.indexOf('\n\n', at);
    assert.equal(out.slice(0, head) + out.slice(end), plain);
    assert.ok(end < out.length - 10, '규칙 뒤에 OPENING·CONTEXT 가 이어진다');
  } finally {
    D.setUserRules([]);
  }
});

// ── R13 ──
test('R13: 코드가 끼운 물건(시그니처)은 진열 요청의 지난 목록에 안 들어간다', () => {
  const c = { message: [{ role: 'user', data: '가', chatId: 'u1' }, { role: 'char', data: 'x\n[shop: 가게|주인]', chatId: 'c1' }], scriptstate: {} };
  let st = S.readShop(S.settleShop(c, 1).vars);
  st = S.applyShelf(st, S.parseShelf('<shop-identity>\nsells: 잡화\nnever: 음식\nprices: 싸다\n</shop-identity>\n<shelf>\n손전등|18000|사용|flashlight|0.5|LED|비춘다\n</shelf>', null), S.shopSettings({}));
  st = S.appendItems(st, [{ name: '우리가 도움!', desc: '', effect: '', use: false, price: 1000, truth: '?', fixed: true }]);
  assert.deepEqual(S.prevNames(st), ['손전등']);
  // 저장했다 읽어도 표시가 남는다
  const again = S.readShop(S.shopVars(st));
  assert.equal(again.items.find((x) => x.name === '우리가 도움!').fixed, true);
  // 새 진열을 받아도 지난 목록(prev)으로 넘어가지 않는다
  const next = S.applyShelf(again, S.parseShelf('<shelf>\n생수|1500|소모|water|0.5|물|마신다\n</shelf>', again.identity), S.shopSettings({}));
  assert.deepEqual(next.prev, ['손전등']);
  assert.match(readFileSync('src/ui/malls.ts', 'utf8'), /const fixedItem = [^\n]*fixed: true/);
});

// ── R07 ──
test('R07: 같은 턴에 사서 바로 되판 물건도 「이번 턴에 산 것」으로 간다 (치른 대가 포함)', () => {
  const alive = new Set(['u1', 'b1']);
  let it = I.addItem({ list: [], log: [] }, alive, { name: '은 십자가', from: 'store', anchor: 'b1', store: '성물방', paidWith: '기도 한 번' });
  const id = it.list[0].id;
  const chat0 = { message: [{ role: 'user', data: 'u1', chatId: 'u1' }, { role: 'char', data: 'b1', chatId: 'b1' }], scriptstate: I.itemsVars(it) };
  const before = I.inventoryText(chat0);
  assert.match(before, /기도 한 번/);
  it = I.sellItem(it, id, 'b1', '성물방에 팖');
  const chat = { ...chat0, scriptstate: I.itemsVars(it) };
  const text = I.inventoryText(chat);
  assert.match(text, /기도 한 번/, '산 값(대가)이 남는다');
  assert.match(text, /은 십자가/);
  // 가진 물건 목록에는 없다 (판 물건)
  assert.equal(I.liveItems(I.readItems(chat.scriptstate), alive).length, 0);
  assert.equal(I.boughtPool(I.readItems(chat.scriptstate), alive, 'b1').length, 1);
});

// ── R48 · R29 (글자 그대로 확인) ──
test('R48: Router 기본 지침은 절마다 비면 기본 글', () => {
  assert.match(readFileSync('src/host/people.ts', 'utf8'), /const routerBase = \(\) => \[guideTxt\('Router', 'ROLE'\), guideTxt\('Router', 'RULES'\)\]/);
});
test('R29: 받기 실패 까닭을 받기 창에 처음부터 넘긴다', () => {
  assert.match(readFileSync('src/main.ts', 'utf8'), /showPanel\(VERSION, install, error instanceof BodyError \? error\.message : '', 'fetch'\)/);
});

// ── R41 ──
test('R41: 갱신기가 별명(「독사」)만 보고 올린 새 인물은 다른 근거(초상 태그·소속)가 없으면 버린다', async () => {
  const { initTestData } = await import('./data-init.mjs');
  const P = await load('people41', "export * as U from '../people/updater'; export * as T from '../people/types'; export * as St from '../people/settings'; export * as B from '../people/base'; export * as H from '../../host/people'; export * as Pack from '../datapack';".replace(/\.\.\/people\//g, './people/').replace("'../../host/people'", "'../host/people'").replace("'../datapack'", "'./datapack'"));
  initTestData(P.Pack);
  const run = (text) => {
    const c = { message: [{ role: 'user', data: '복도', chatId: 'u1' }, { role: 'char', data: text, chatId: 'c1' }] };
    const store = P.T.emptyStore();
    const s = { ...P.St.peopleSettings({}), twoTurn: false };
    const input = P.U.buildUpdate(c, store, [1], { settings: s, system: '', values: {}, names: P.B.allNames([]) });
    const m = [...input.tags].find(([, i]) => i === 1)[0];
    const appears = (name, aliases, indexes) => P.H.appearingIn(c, indexes, [{ name, aliases }], (n) => P.B.seedBaseFor(n, 'A00', undefined).faction ?? '', {}).has(name);
    return P.U.applyUpdate(store, c, input, { new_people: [{ name: '백사헌', m, quote: text.replace(/<img=[^>]*>/g, '').trim().slice(0, 12) }] }, { settings: s, sheetOf: () => null, appears });
  };
  let rep = run('독사가 웃으며 다가왔다.');
  assert.deepEqual(rep.applied.newPeople, []);
  assert.deepEqual(rep.dropped.map((d) => [d.who, d.reason]), [['백사헌', '별명만 나옴(다른 근거 없음)']]);
  // 이름이 같이 나오면 받는다
  rep = run('독사, 백사헌이 웃으며 다가왔다.');
  assert.deepEqual(rep.applied.newPeople, ['백사헌']);
  // 별명 + 초상 태그면 받는다 (코드 판정과 같은 근거)
  const en = P.B.RELATIONS.people['백사헌']?.english?.[0];
  if (en) {
    rep = run(`독사가 웃으며 다가왔다.\n<img=${en}_smile>`);
    assert.deepEqual(rep.applied.newPeople, ['백사헌']);
  }
});
