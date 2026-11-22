// 생각 모델(<Thoughts>) 응답 속 상점 표식: 본문에 표식이 없어도 생각 블록 안 표식으로 상점이 열리나
// 돌리는 법: 저장소 맨 위에서 node --import ./tests/world-preload.mjs 인수인계/플레이순서_점검/2차/99_빠진것/thoughts_shop.mjs
import * as core from '../../../../dist-test/core.bundle.mjs';
const { findShopTag, settleShop } = core;
const think = '<Thoughts>\n장면: 편의점. 상점 표식을 붙일까? [shop: 세븐마트|김점장] 아니, 주인공은 계산만 하고 나가니 거래 자리가 아니다.\n</Thoughts>\n';
const body = '그녀는 계산을 마치고 편의점을 나섰다. 밤공기가 차가웠다.';
const data = think + body;
console.log('본문만 표식:', findShopTag(body));
console.log('전체 표식:', findShopTag(data));
const chat = { message: [{ role: 'user', data: '계산하고 나간다', chatId: 'u1' }, { role: 'char', data, chatId: 'c1' }], scriptstate: {} };
const r = settleShop(chat, 1, []);
console.log('settleShop vars:', r && r.vars);
