// 망상홈쇼핑 접속 (2026-11-16 사용자: 접속 카드로만 열리는 것이 기본, 늘 열림은 설정 「인터넷에 상시 노출」).
// 닿을 수 있나 = 설정이 켜져 있거나, 마지막 응답에 이 사이트의 접속 표식이 붙어 있을 때. 지난 응답의 표식은 응답 정리(settleShop)가 지운다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist-test/core.mjs';
const { homeshop } = core;
const { hsSettings, hsReach } = homeshop;
const settleShop = core.settleShop ?? core.shop?.settleShop;

const TAG = '[shop: 망상홈쇼핑|@web:hs]';
const msg = (role, data, i) => ({ role, data, chatId: `c${i}` });
const chatOf = (texts, vars = {}) => ({ message: texts.flatMap((t, i) => [msg('user', 'go', i * 2), msg('char', t, i * 2 + 1)]), scriptstate: vars });

test('「인터넷에 상시 노출」 기본은 끔, 1 일 때만 켬', () => {
  assert.equal(hsSettings({}).net, false);
  assert.equal(hsSettings({ $hs_net: '1' }).net, true);
  assert.equal(hsSettings({ $hs_net: '0' }).net, false);
});

test('기본(끔): 마지막 응답에 접속 표식이 있을 때만 닿는다', () => {
  assert.equal(hsReach(chatOf(['밤이다.'])), false, '표식 없음');
  assert.equal(hsReach(chatOf([`TV가 켜진다.\n${TAG}`])), true, '마지막 응답의 표식');
  assert.equal(hsReach(chatOf([`TV가 켜진다.\n${TAG}`, '집을 나선다.'])), false, '지난 응답의 표식은 통하지 않는다');
  assert.equal(hsReach(chatOf(['밤이다.\n[shop: 우주 쇼핑몰|@web:cos]'])), false, '다른 사이트의 표식');
  assert.equal(hsReach(chatOf(['밤이다.\n[shop: 망상홈쇼핑|@web]'])), false, '정리되지 않은 표식');
  assert.equal(hsReach({ message: [], scriptstate: {} }), false, '응답이 없으면 닿지 않는다');
});

test('설정을 켜면 표식 없이도 늘 닿고, 망상홈쇼핑을 끄면 표식이 있어도 닿지 않는다', () => {
  assert.equal(hsReach(chatOf(['밤이다.'], { $hs_net: '1' })), true);
  assert.equal(hsReach(chatOf([`TV.\n${TAG}`], { $hs_on: '0' })), false);
  assert.equal(hsReach(chatOf(['밤이다.'], { $hs_on: '0', $hs_net: '1' })), false);
});

test('새 응답에 표식이 없으면 응답 정리가 지난 응답의 접속 표식을 지운다 (방문 중인 상점이 없어도)', () => {
  const chat = chatOf([`TV가 켜진다.\n${TAG}`, '집을 나선다.']);
  const r = settleShop(chat, 3, []);
  assert.ok(r?.message, '고칠 것이 있다');
  assert.ok(!r.message[1].data.includes('[shop:'), '지난 응답의 표식이 지워진다');
  assert.equal(r.message[3].data, '집을 나선다.');
  assert.equal(settleShop({ ...chat, message: r.message }, 3, []), null, '다시 돌리면 바뀔 것이 없다');
});
