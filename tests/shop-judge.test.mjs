// 상점 판단 (11-09 사용자): 메인 모델/갱신기 고르기, 판단 기준은 한 곳(SHOP_RULE)을 양쪽이 같이, 고유 상점 표(인터넷 접속 → 그 사이트)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { settleShop, readShop, shopGuide, shopRule, shopJudgeBy, ownShops, ownShopOf, webSiteOfOwner, SHOP_OWN_VAR, findShopTag } from '../dist-test/core.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-shop-judge-'));
await build({
  entryPoints: ['src/core/people/store.ts', 'src/core/people/updater.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const T = await mod('types');
const St = await mod('settings');
const P = await mod('prompt/index');
const { messageHash } = await mod('store');

test('누가 판단하나: 자동은 갱신기가 매 턴 돌면 갱신기, 갱신기를 골랐는데 안 돌면 메인이 대신', () => {
  assert.deepEqual(shopJudgeBy({}), { pick: 'auto', by: 'updater', fallback: false });
  assert.equal(shopJudgeBy({ $pp_when: 'manual' }).by, 'main');
  assert.equal(shopJudgeBy({ $pp_on: '0' }).by, 'main');
  assert.deepEqual(shopJudgeBy({ $sh_judge: 'updater', $pp_on: '0' }), { pick: 'updater', by: 'main', fallback: true });
  assert.equal(shopJudgeBy({ $sh_judge: 'main' }).by, 'main');
  // 본편 표식 지침은 메인이 판단할 때만, 그 안에 공용 기준이 그대로
  assert.equal(shopGuide({}), '');
  const g = shopGuide({ $sh_judge: 'main' });
  assert.ok(g.includes(shopRule({ $sh_judge: 'main' })), '본편 지침 = 공용 기준을 품음');
  assert.ok(/own shop, or one they work at/.test(shopRule({})));
});

test('공용 기준에 켜진 고유 상점만 들어가고, 다른 이름·여는 방식이 붙는다', () => {
  const r = shopRule({});
  assert.ok(r.includes('우주 쇼핑몰 — online or in person'));
  assert.ok(r.includes('백일몽 포인트몰 (also 포인트몰, 복지몰) — online only'));
  assert.ok(/name in talk, a rumour, an ad/.test(r), '언급만으로는 안 연다');
  const none = shopRule({ [SHOP_OWN_VAR]: '[]' });
  assert.ok(!none.includes('Shops with their own screen'));
  const off = ownShops({ [SHOP_OWN_VAR]: JSON.stringify([{ id: 'x', on: false, name: '망상홈쇼핑', alias: '', web: '', visit: 'shop' }]) });
  assert.equal(off[0].name, '망상홈쇼핑');
  assert.equal(ownShopOf({}, '복지몰').id, 'bm');
});

test('고유 상점 표식: 인터넷 접속이면 사이트 표식으로 바꾸고 방문은 열지 않음, 직접 가면 창 설정대로', () => {
  const chat = (tag, vars = {}) => ({ message: [{ role: 'user', data: 'x', chatId: 'u1' }, { role: 'char', data: `본문\n${tag}`, chatId: 'c1' }], scriptstate: vars });
  const web = settleShop(chat('[shop: 우주쇼핑몰|@web]'), 1);
  assert.equal(findShopTag(web.message[1].data).owner, '@web:cos');
  assert.equal(webSiteOfOwner('@web:cos'), 'cos');
  assert.equal(readShop(web.vars)?.shop ?? '', '', '기본 상점 방문은 열지 않음');
  // 직접 간 팝업스토어 = 기본 상점창
  assert.equal(readShop(settleShop(chat('[shop: 우주 쇼핑몰|]'), 1).vars).shop, '우주 쇼핑몰');
  // 표에 없는 사이트 접속은 지움
  assert.ok(!settleShop(chat('[shop: 아무 몰|@web]'), 1)?.message?.[1]?.data.includes('[shop:'));
  // 인터넷 전용 가게(사이트 있음, 직접 가면 쓸 창 없음)는 모델이 매장으로 적어도, 이름을 다르게 적어도, 주인 칸이 무엇이든 접속 표식으로 바로잡는다 (2026-11-16 사용자)
  for (const [t, site, name] of [
    ['[shop: 백일몽 포인트몰|]', 'bm', '백일몽 포인트몰'],
    ['[shop: 임직원 복지몰|]', 'bm', '백일몽 포인트몰'],
    ['[shop: 백일몽 복지몰 매장|김 대리]', 'bm', '백일몽 포인트몰'],
    ['[shop: 망상홈쇼핑|레드 프라이데이]', 'hs', '망상홈쇼핑'],
    ['[shop: 망상 홈쇼핑 쇼룸|]', 'hs', '망상홈쇼핑'],
  ]) {
    const r = settleShop(chat(t), 1, ['김 대리']);
    const fixed = findShopTag(r.message[1].data);
    assert.deepEqual([fixed.shop, fixed.owner], [name, `@web:${site}`], t);
    assert.equal(readShop(r.vars)?.shop ?? '', '', `${t}: 기본 상점 방문은 열지 않음`);
  }
  // 이름이 들어 있어도 직접 가는 창이 있는 가게(우주 쇼핑몰)는 그대로 기본 상점 창, 상관없는 가게는 고유 상점으로 보지 않음
  assert.equal(readShop(settleShop(chat('[shop: 우주 쇼핑몰 팝업스토어|]'), 1).vars).shop, '우주 쇼핑몰 팝업스토어');
  assert.equal(ownShopOf({}, '임직원 복지몰').id, 'bm');
  assert.equal(ownShopOf({}, '쇼핑몰 지하상가'), null);
  assert.equal(ownShopOf({}, '몰'), null);
  // 한 글자 별칭은 들어 있나로 보지 않고, 여러 줄이 걸리면 가장 긴 이름이 맞은 줄
  const table = { [SHOP_OWN_VAR]: JSON.stringify([{ id: 'a', on: true, name: '몰', alias: '', web: 'cos', visit: '' }, { id: 'b', on: true, name: '복지', alias: '', web: 'cos', visit: '' }, { id: 'c', on: true, name: '복지몰', alias: '', web: 'bm', visit: '' }]) };
  assert.equal(ownShopOf(table, '쇼핑몰'), null);
  assert.equal(ownShopOf(table, '임직원 복지몰').id, 'c');
  // 사이트도 창도 없는 줄은 전처럼 열지 않음
  const none = { [SHOP_OWN_VAR]: JSON.stringify([{ id: 'n', on: true, name: '없는 가게', alias: '', web: '', visit: '' }]) };
  assert.ok(!settleShop(chat('[shop: 없는 가게|]', none), 1)?.message?.[1]?.data.includes('[shop:'));
  // 편의점은 표와 상관없이 그대로
  assert.equal(readShop(settleShop(chat('[shop: 편의점|]'), 1).vars).shop, '편의점');
  // 같은 표식을 다시 정리해도 바뀌지 않는다
  assert.equal(settleShop({ ...chat('x'), message: web.message, scriptstate: web.vars }, 1), null);
});

test('읽음 해시는 상점 표식을 보지 않는다 (지난 응답 표식을 지워도·갱신기가 붙여도 「안 읽음」이 안 생김)', () => {
  assert.equal(messageHash({ role: 'char', data: '본문' }), messageHash({ role: 'char', data: '본문\n[shop: 편의점|]' }));
});

test('갱신기: 맡긴 응답에만 shop_check, 지침에 상점 절, 결과는 가게 하나 또는 없음', () => {
  const s = { ...St.peopleSettings({}) };
  const store = T.emptyStore();
  const c = { scriptstate: {}, message: [['user', '들어간다', 'u1'], ['char', '편의점 문을 열고 들어갔다. 점원이 인사했다.', 'c1']].map(([role, data, chatId]) => ({ role, data, chatId })) };
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names: [], shop: { at: 1, self: ['마덕희', ''] } });
  assert.deepEqual(input.data.shop_check, { m: 'm2', protagonist: ['마덕희'] });
  assert.equal(input.data.want.shop, true);
  assert.deepEqual(input.shop, { m: 'm2' });
  const off = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names: [] });
  assert.equal(off.data.shop_check, undefined);
  assert.equal(off.shop, null);
  for (const text of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const on = U.assemblePrompt(text, new Set(['shop']));
    assert.ok(on.includes('<<SHOP_RULE>>') && on.includes('<<SHOP_JUDGE>>') && on.includes('"shop"'));
    assert.ok(!U.assemblePrompt(text, new Set()).includes('"shop"'));
  }
  const yes = U.applyUpdate(store, c, input, { shop: { name: '편의점', owner: '', m: 'm2' } }, { settings: s });
  assert.deepEqual(yes.shop, { index: 1, name: '편의점', owner: '' });
  const no = U.applyUpdate(store, c, input, { shop: null }, { settings: s });
  assert.equal(no.shop, null);
  const notAsked = U.applyUpdate(store, c, off, { shop: { name: '편의점', m: 'm2' } }, { settings: s });
  assert.equal(notAsked.shop, undefined);
});
