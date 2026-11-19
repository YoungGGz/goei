// 설정으로 옮긴 줄 상한: 거래 줄 상한($st_wallet_cap, 가계부·포인트 장부) · 기록 줄 상한($it_logcap, 소지품 사용·처분 기록). 기본값은 예전 고정값 400.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addWalletEntry, walletBalance, walletCapOf, setWalletCap, WALLET_CAP_VAR, WALLET_CAP_DEFAULT, WALLET_CAP_MIN, WALLET_CAP_MAX,
  readPoints, POINTS_VAR,
  addItem, addItemLog, itemLeft, setItemRules, itemLogCap, itemLogCapOf, ITEM_LOG_CAP_VAR, ITEM_LOG_CAP_DEFAULT, ITEM_LOG_CAP_MIN, ITEM_LOG_CAP_MAX,
} from '../dist-test/core.mjs';

const alive = new Set(['a1']);
const fillWallet = (n) => {
  let w = { start: 0, log: [] };
  for (let i = 0; i < n; i++) w = addWalletEntry(w, { anchor: 'a1', amount: 10, memo: `m${i}`, src: 'story', id: `m${i}` }, alive);
  return w;
};

test('거래 줄 상한: 기본값은 400, 틀린 값은 기본값', () => {
  assert.equal(WALLET_CAP_DEFAULT, 400);
  assert.equal(walletCapOf(undefined), 400);
  assert.equal(walletCapOf({}), 400);
  assert.equal(walletCapOf({ [WALLET_CAP_VAR]: '' }), 400);
  for (const bad of ['abc', '0', '-5', '99', '250.5', 'NaN']) assert.equal(walletCapOf({ [WALLET_CAP_VAR]: bad }), 400, bad);
  assert.equal(walletCapOf({ [WALLET_CAP_VAR]: String(WALLET_CAP_MIN) }), WALLET_CAP_MIN);
  assert.equal(walletCapOf({ [WALLET_CAP_VAR]: '800' }), 800);
  assert.equal(walletCapOf({ [WALLET_CAP_VAR]: '99999' }), WALLET_CAP_MAX);
});

test('거래 줄 상한: 설정대로 가계부를 정리하고 잔고는 그대로', () => {
  setWalletCap(undefined);
  let w = fillWallet(450);
  assert.equal(w.log.length, 400);
  assert.equal(walletBalance(w, alive), 4500);
  setWalletCap({ [WALLET_CAP_VAR]: '200' });
  w = fillWallet(450);
  assert.equal(w.log.length, 200);
  assert.equal(walletBalance(w, alive), 4500);
  setWalletCap({ [WALLET_CAP_VAR]: '600' });
  assert.equal(fillWallet(650).log.length, 600);
  setWalletCap({ [WALLET_CAP_VAR]: '엉뚱' });
  assert.equal(fillWallet(450).log.length, 400);
  setWalletCap(undefined);
});

test('거래 줄 상한: 포인트 장부는 읽을 때 자르지 않는다 (상한을 낮춰도 잔액이 그대로, 정리는 거래를 더할 때)', () => {
  const log = Array.from({ length: 250 }, (_, i) => ({ id: `p${i}`, anchor: 'a1', amount: 10, memo: 'p', src: 'story', at: '' }));
  const raw = JSON.stringify({ start: 0, log });
  for (const cap of [undefined, '100', '2000', 'x']) {
    const p = readPoints({ [POINTS_VAR]: raw, ...(cap ? { [WALLET_CAP_VAR]: cap } : {}) });
    assert.equal(p.log.length, 250, String(cap));
    assert.equal(walletBalance(p, alive), 2500, String(cap));
  }
  // 상한을 100으로 낮춘 뒤 거래 한 줄: 100줄로 줄고 잔액은 그대로
  setWalletCap({ [WALLET_CAP_VAR]: '100' });
  const p = addWalletEntry(readPoints({ [POINTS_VAR]: raw, [WALLET_CAP_VAR]: '100' }), { anchor: 'a1', amount: 10, memo: 'new', src: 'story', id: 'new' }, alive);
  assert.equal(p.log.length, 100);
  assert.equal(p.log.at(-1).id, 'new');
  assert.equal(walletBalance(p, alive), 2510);
  setWalletCap(undefined);
});

test('기록 줄 상한: 기본값은 400, 틀린 값은 기본값', () => {
  assert.equal(ITEM_LOG_CAP_DEFAULT, 400);
  assert.equal(itemLogCapOf(undefined), 400);
  assert.equal(itemLogCapOf({ [ITEM_LOG_CAP_VAR]: '' }), 400);
  for (const bad of ['abc', '0', '-5', '99', '250.5']) assert.equal(itemLogCapOf({ [ITEM_LOG_CAP_VAR]: bad }), 400, bad);
  assert.equal(itemLogCapOf({ [ITEM_LOG_CAP_VAR]: String(ITEM_LOG_CAP_MIN) }), ITEM_LOG_CAP_MIN);
  assert.equal(itemLogCapOf({ [ITEM_LOG_CAP_VAR]: '99999' }), ITEM_LOG_CAP_MAX);
  setItemRules(undefined);
  assert.equal(itemLogCap(), 400);
});

test('기록 줄 상한: 설정대로 기록을 정리하고 남은 횟수는 그대로', () => {
  const fill = (n) => {
    let it = addItem({ list: [], log: [] }, alive, { name: '붕대', uses: 999, from: 'manual', anchor: '' });
    const id = it.list[0].id;
    for (let i = 0; i < n; i++) it = addItemLog(it, { name: '붕대', item: id, what: 'use', by: 'use', anchor: 'a1' }, alive);
    return it;
  };
  setItemRules(undefined);
  let it = fill(450);
  assert.equal(it.log.length, 400);
  assert.equal(itemLeft(it, it.list[0], alive), 999 - 450);
  setItemRules({ [ITEM_LOG_CAP_VAR]: '200' });
  it = fill(450);
  assert.equal(it.log.length, 200);
  assert.equal(itemLeft(it, it.list[0], alive), 999 - 450);
  setItemRules({ [ITEM_LOG_CAP_VAR]: '600' });
  assert.equal(fill(650).log.length, 600);
  setItemRules({ [ITEM_LOG_CAP_VAR]: '엉뚱' });
  assert.equal(fill(450).log.length, 400);
  setItemRules(undefined);
});

test('기록 줄 상한: 상한을 낮춘 뒤에도 방금 넣은 줄은 남는다', () => {
  setItemRules(undefined);
  let it = addItem({ list: [], log: [] }, alive, { name: '붕대', uses: 1000, from: 'manual', anchor: '' });
  const id = it.list[0].id;
  for (let i = 0; i < 60; i++) it = addItemLog(it, { name: `잡동사니${i}`, what: 'drop', by: 'manual', anchor: 'a1' }, alive);
  for (let i = 0; i < 240; i++) it = addItemLog(it, { name: '붕대', item: id, what: 'use', by: 'use', anchor: 'a1' }, alive);
  const before = itemLeft(it, it.list[0], alive);
  // 기본 상한에서는 그대로 한 줄 늘어난다
  assert.equal(addItemLog(it, { name: '라디오', what: 'sell', by: 'manual', anchor: 'a1', id: 'sold' }).log.at(-1).id, 'sold');
  setItemRules({ [ITEM_LOG_CAP_VAR]: '100' });
  // alive 를 모르고 넣는 길(팔기·버리기)
  let out = addItemLog(it, { name: '라디오', what: 'sell', by: 'manual', anchor: 'a1', id: 'sold' });
  assert.equal(out.log.at(-1).id, 'sold');
  // alive 를 아는 길: 100줄로 줄고 새 줄이 남고 남은 횟수는 그대로
  out = addItemLog(it, { name: '라디오', what: 'sell', by: 'manual', anchor: 'a1', id: 'sold' }, alive);
  assert.equal(out.log.length, 100);
  assert.equal(out.log.at(-1).id, 'sold');
  assert.equal(itemLeft(out, out.list[0], alive), before);
  setItemRules(undefined);
});
