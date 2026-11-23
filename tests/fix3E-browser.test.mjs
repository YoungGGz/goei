// 2차 점검 고침 (인터넷 창): 카드 단독 창 뒤 탭 id, 메뉴 ‹ › 와 탭 기록, 한참 뒤로 간 탭 저장, 게시판 즐겨찾기 첫 화면
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = `/tmp/fix3-E/unit-${process.pid}`;
await mkdir(dir, { recursive: true });
const outfile = join(dir, 'bundle.mjs');
const ENTRY = `
export * as B from './src/ui/browser';
export { NavHistory } from './src/core/navhist';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { B, NavHistory } = await import(pathToFileURL(outfile));
const app = await readFile(new URL('../src/ui/app.ts', import.meta.url), 'utf8');

test('B1: 카드 단독 창이 끝나면 탭이 id 까지 그대로, 단독 창에서 지나온 화면은 기록에 안 남는다', () => {
  B.restoreTabs('');
  B.br.tabs[0].site = 'wk';
  B.recordTab({ tab: 'wiki', b: 'wk' });
  const nav = new NavHistory();
  nav.record({ tab: 'board' });
  nav.record({ tab: 'wiki', b: 'wk', bt: B.curTab().id });
  const back = { tabs: B.snapTabs(), nav: nav.snapshot() };
  // 단독 창: 지금 탭에서 우주몰을 열고 그 화면이 기록에 쌓인다
  B.openSite('cos');
  nav.record({ tab: 'net', b: 'cos', bt: B.curTab().id });
  B.putTabs(back.tabs);
  nav.restore(back.nav);
  assert.equal(B.curTab().site, 'wk');
  // 뒤로 가도 우주몰로 가지 않고, 적힌 탭 id 를 그대로 찾는다 (없으면 새 탭이 생겼다)
  assert.equal(nav.can(1), false);
  const s = nav.go(-1);
  assert.deepEqual(s, { tab: 'board' });
  const w = nav.go(1);
  assert.ok(B.br.tabs.some((t) => t.id === w.bt));
  assert.equal(B.br.tabs.length, 1);
  // 단독 창 쪽은 저장 꼴(JSON)로 되살리지 않는다
  assert.match(app, /soloBack = \{ tabs: snapTabs\(\), tab, nav: navHist\.snapshot\(\) \}/);
  // 단독 창은 제 기록만 쓴다 (열기 전 화면으로 뒤로 가지 않는다)
  assert.match(app, /soloBack = \{ tabs: snapTabs\(\), tab, nav: navHist\.snapshot\(\) \};\s*\/\/[^\n]*\n\s*navHist\.clear\(\);/);
  assert.match(app, /putTabs\(soloBack\.tabs\);\s*tab = soloBack\.tab;\s*navHist\.restore\(soloBack\.nav\);/);
});

test('Q1: 메뉴 ‹ › 로 탭 기록에 있는 화면에 닿으면 새로 붙이지 않고 그 칸으로', () => {
  B.restoreTabs('');
  const blank = { tab: 'net', b: '' };
  const wiki = { tab: 'wiki', b: 'wk', w: { view: 'home', title: '', list: false } };
  B.recordTab(blank);
  B.recordTab(wiki);
  // 메뉴 ‹ : 새 탭 화면으로
  B.tabSeek(blank, -1);
  B.recordTab(blank); // 그린 뒤 적기
  assert.equal(B.curTab().hist.length, 2);
  assert.equal(B.tabCan(1), true, '주소줄 › 가 켜져 있다');
  assert.deepEqual(B.tabGo(1), wiki);
  // 메뉴 › : 다시 위키로
  B.tabSeek(blank, -1);
  B.tabSeek(wiki, 1);
  assert.equal(B.curTab().at, 1);
  assert.match(app, /const \{ bt: _bt, \.\.\.ts \} = s;\s*tabSeek\(ts, dir\);/);
});

test('B4: 한참 뒤로 간 탭을 저장해도 보던 화면과 앞뒤 기록이 남는다', () => {
  B.restoreTabs('');
  B.br.tabs[0].site = 'wk';
  for (let i = 0; i < 12; i++) B.recordTab({ tab: 'wiki', n: i });
  for (let i = 0; i < 10; i++) B.tabGo(-1);
  assert.deepEqual(B.tabState(), { tab: 'wiki', n: 1 });
  const json = B.tabsJson();
  B.restoreTabs(json);
  assert.deepEqual(B.tabState(), { tab: 'wiki', n: 1 });
  assert.equal(B.tabCan(-1), true);
  assert.equal(B.tabCan(1), true);
  // 끝 쪽을 보고 있으면 전처럼 최근 10칸
  for (let i = 0; i < 20; i++) B.tabGo(1);
  B.restoreTabs(B.tabsJson());
  assert.equal(B.curTab().hist.length, 10);
  assert.deepEqual(B.tabState(), { tab: 'wiki', n: 9 });
});

test('B3: 게시판 즐겨찾기는 그 게시판 첫 화면부터 (로고와 같은 길)', () => {
  const go = app.slice(app.indexOf('function goSite('), app.indexOf('/** 설정 창(폰)에 주는 하단 바'));
  assert.match(go, /if \(isBoardSite\(site\)\) \{\s*useBoardSite\(site\);\s*gnetHome\(\);\s*\}/);
});

test('주소줄 ‹ › 단추는 이 화면을 탭 기록에 적은 뒤의 상태로 맞춘다', () => {
  assert.match(app, /recordTab\(ts\);\s*\/\/[^\n]*\n\s*root\.querySelectorAll<HTMLButtonElement>\('\.br-tool \[data-action="br-back"\], \.br-tool \[data-action="br-fwd"\]'\)\.forEach\(\(b\) => \(b\.disabled = !tabCan\(/);
  // 새 탭에서 사이트를 열면 뒤로 갈 수 있고, 뒤로 간 뒤 다른 곳을 열면 앞으로는 없다
  B.restoreTabs('');
  B.recordTab({ tab: 'net', b: '' });
  B.recordTab({ tab: 'gnet', b: 'gn' });
  assert.equal(B.tabCan(-1), true);
  B.tabGo(-1);
  B.recordTab({ tab: 'wiki', b: 'wk' });
  assert.equal(B.tabCan(1), false);
});
