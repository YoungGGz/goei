import {parseShelf} from '../../../../dist-test/core.mjs';
import assert from 'node:assert/strict';
const r=line=>parseShelf('<shelf>'+line+'</shelf>',{sells:'종이',never:'',prices:''}).items[0];
const good=r('부적지|300|사용|서류/부적/paper|0.1|누런 종이|부적을 쓰면 값이 덜 든다||?');
const short=r('부적지|300|사용|서류/부적/paper|누런 종이|부적을 쓰면 값이 덜 든다|');
console.log('정상',JSON.stringify(good),'누락',JSON.stringify(short));
assert.ok(!short||short.desc==='누런 종이','무게 칸이 빠진 줄을 받아 설명이 다른 칸 값으로 바뀜');
