// 전수점검 11-21 (상점·쇼핑몰·망상홈쇼핑): 산 물건 id 겹침, 진열 합치기 상한, 빼기 줄 꼴, 지난 대화 상한, 출연 칸 표기, 전화 컷, 주문 정리
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1121/shop';
await mkdir(dir, { recursive: true });
const file = `${dir}/shop-${process.pid}.mjs`;
await build({
  stdin: { contents: "export * from './src/core/shop'; export { shopGive } from './src/core/shopfn'; export { hsLine, parseCue, pruneOrders } from './src/core/homeshop';", resolveDir: process.cwd(), loader: 'ts' },
  outfile: file, bundle: true, platform: 'node', format: 'esm', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const M = await import(pathToFileURL(file).href);

const base = { shop: '철물점', owner: '주인', key: 'k1', loaded: true, identity: { sells: '공구', never: '', prices: '' }, items: [], talk: [], closed: false, prev: [], sell: null, sales: [] };
const it = (name, extra = {}) => ({ name, desc: '', effect: '', use: false, price: 1000, ...extra });

test('보통-29: 산 물건과 같은 이름이 새 진열 같은 자리에 와도 id 가 겹치지 않는다', () => {
  const s = M.shopSettings({});
  const first = M.applyShelf(base, { identity: base.identity, owner: '', items: [it('생수'), it('손전등')] }, s);
  const water = first.items.find((x) => x.name === '생수');
  const bought = M.markSold(first, water.id, 'k1');
  const again = M.applyShelf(bought, { identity: base.identity, owner: '', items: [it('생수'), it('장갑')] }, s);
  const ids = again.items.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'id 가 모두 다르다');
  const fresh = again.items.find((x) => x.name === '생수' && !x.sold);
  assert.ok(fresh, '새로 진열된 생수는 산 물건이 아니다');
  assert.notEqual(fresh.id, water.id);
});

test('보통-31: 기다리는 사이 산 물건이 붙어도 새 진열은 잘리지 않는다 (파는 것·산 것 따로 센다)', () => {
  const sold = Array.from({ length: 36 }, (_, i) => ({ ...it(`산것${i}`), id: `s${i}`, sold: true }));
  const st0 = { ...base, items: [...sold, { ...it('카트'), id: 'cart' }] };
  const now = { ...st0, items: st0.items.map((x) => (x.id === 'cart' ? { ...x, sold: true } : x)) };
  const next = { ...st0, items: [...sold, ...Array.from({ length: 8 }, (_, i) => ({ ...it(`새것${i}`), id: `n${i}` }))] };
  const merged = M.mergeLate(now, next, st0, 40);
  assert.equal(merged.items.filter((x) => !x.sold).length, 8);
  assert.ok(merged.items.some((x) => x.id === 'cart' && x.sold));
});

test('보통-32: 기다리는 사이 「그만」한 판매는 답이 와도 되살아나지 않는다', () => {
  const st0 = { ...base, sell: { itemId: 'i1', name: '방망이', desc: '', effect: '', use: false } };
  const now = { ...st0, sell: null };
  const next = { ...st0, sell: { ...st0.sell, price: 5000 } };
  assert.equal(M.mergeLate(now, next, st0).sell, null);
});

test('사소-35: 「- 이름|값」으로 빼라고 해도 이름만 읽는다', () => {
  const r = M.parseTalk('<owner>치웠소.</owner>\n<change mode="partial">\n- 손전등|18000\n</change>');
  assert.deepEqual(r.remove, ['손전등']);
});

test('보통-33: 지난 대화 기본값은 보관하는 양을 따라간다', () => {
  assert.equal(M.shopGive({ [M.SHOP_LIMITS.talk.key]: '150' }, 'shop', 'talk').talk, 150);
});

test('사소-41: 출연 칸의 전각 Ｏ·◯·예도 시연으로 읽는다', () => {
  for (const mark of ['O', 'Ｏ', '◯', '〇', '예']) {
    const r = M.hsLine(`부적|-|-|talisman|0.01|종이|막는다|${mark}|?`);
    assert.ok(r, mark);
    assert.equal(r.inst, 1, mark);
  }
});

test('사소-42: 컷 칸 「call」은 전화 컷', () => {
  const c = M.parseCue('call|talk|여보세요|-', new Map([['talk', 'talk']]));
  assert.ok(c);
  assert.equal(c.cut, 'D');
});

test('보통-43: 안 연 주문도 상자가 소지품에 없으면 넘칠 때 정리된다', () => {
  const o = (id, box) => ({ id, anchor: '', boxId: box, dues: [], n: 0, item: { name: id } });
  const list = [o('a', 'boxA'), o('b', 'boxB'), o('c', 'boxC')];
  const kept = M.pruneOrders(list, 2, { alive: new Set(), turn: 1, last: '', boxHeld: (id) => id !== 'boxA' });
  assert.deepEqual(kept.map((x) => x.id), ['b', 'c']);
  const all = M.pruneOrders(list, 2, { alive: new Set(), turn: 1, last: '' });
  assert.equal(all.length, 3, '상자를 모르면 그대로 둔다');
});

test('눌러2-사소-14: 주인 대화로 진열을 바꿔도 산 물건과 같은 이름의 새 물건은 새로고침처럼 보통 상품으로 들어온다', () => {
  const st = { ...base, items: [{ ...it('생수'), id: 'w0', sold: true }, { ...it('장갑'), id: 'g0' }] };
  const talk = (r) => ({ owner: '자', reprice: [], remove: [], add: [], all: [], closed: false, ...r });
  const all = M.applyTalk(st, talk({ mode: 'all', all: [it('생수'), it('끈')] }));
  const a = all.items.find((x) => x.name === '생수' && !x.sold);
  assert.ok(a, '전체 다시 짜기에서 빠지지 않는다');
  assert.notEqual(a.id, 'w0');
  const part = M.applyTalk(st, talk({ mode: 'partial', add: [it('생수'), it('장갑')] }));
  assert.ok(part.items.some((x) => x.name === '생수' && !x.sold), '더하기에서 빠지지 않는다');
  assert.equal(part.items.filter((x) => x.name === '장갑').length, 1, '진열 중인 것과 같은 이름은 여전히 막는다');
  const ids = part.items.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});
