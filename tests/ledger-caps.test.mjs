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

test('거래 줄 상한: 포인트 장부를 읽을 때도 같은 값', () => {
  const log = Array.from({ length: 700 }, (_, i) => ({ id: `p${i}`, anchor: 'a1', amount: 1, memo: 'p', at: '' }));
  const raw = JSON.stringify({ start: 0, log });
  assert.equal(readPoints({ [POINTS_VAR]: raw }).log.length, 400);
  assert.equal(readPoints({ [POINTS_VAR]: raw, [WALLET_CAP_VAR]: '200' }).log.length, 200);
  assert.equal(readPoints({ [POINTS_VAR]: raw, [WALLET_CAP_VAR]: '600' }).log.at(0).id, 'p100');
  assert.equal(readPoints({ [POINTS_VAR]: raw, [WALLET_CAP_VAR]: 'x' }).log.length, 400);
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
