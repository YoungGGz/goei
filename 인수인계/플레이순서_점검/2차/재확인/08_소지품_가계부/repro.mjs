// 재확인: B1~B3 (다시 굴리기 뒤 update/equip 남음), Q2 (지운 응답의 사용 자리)
const m = await import('/home/user/goei-rel/dist-test/core.mjs');
const { applyItemChanges, addItem, equipItem, readItems, itemsVars, liveItems, aliveAnchors, queueUseVars, pendingItemUse, settleItemUse, addUse, readItemUse } = m;
const mk = (msgs, vars) => ({ message: msgs.map(([role, id, data]) => ({ role, chatId: id, data: data ?? id })), scriptstate: vars });
// B1/B3/B2
let it = { list: [], log: [] };
it = addItem(it, new Set(), { name: '검은 우산', desc: '접이식', from: 'manual', anchor: '', icon: 'umbrella' });
it = addItem(it, new Set(), { name: '빈 꿈결 수집기', desc: '비어 있음', use: true, from: 'manual', anchor: '', icon: '괴이/꿈결 수집기/dream collector' });
it = addItem(it, new Set(), { name: '방검 조끼', desc: '얇은', equip: 'gear', wear: true, from: 'manual', anchor: '' });
console.log('vest slot start', it.list.find(x=>x.name==='방검 조끼').slot);
let alive = new Set(['u1', 'c1']);
it = applyItemChanges(it, alive, [
  { name: '검은 우산', action: 'update', state: 'broken', desc: '살이 꺾임', anchor: 'c1', quote: 'q' },
  { name: '빈 꿈결 수집기', action: 'update', icon: '꿈결 수집기 B등급', desc: '노란 빛', anchor: 'c1', quote: 'q' },
  { name: '방검 조끼', action: 'unequip', anchor: 'c1', quote: 'q' },
]);
const show = (t, a) => liveItems(t, a).map(e => `${e.name}|${e.state}|${e.desc}|slot=${e.slot}`).join(' ; ');
console.log('after c1:', show(it, alive));
alive = new Set(['u1', 'c1b']); // 다시 굴림: c1 사라지고 c1b, 갱신기는 바뀜 없음
it = applyItemChanges(it, alive, []);
console.log('after reroll:', show(it, alive));
// Q2
const pain = { id: 'i_pain', name: '진통제', desc: '', effect: '', use: true, uses: 4, state: 'ok', from: 'manual', anchor: '', at: '' };
let vars = { $st_items: JSON.stringify({ list: [pain], log: [] }), $st_item_use: JSON.stringify([{ id: 'i_pain', n: 1 }]), $st_item_use_at: '' };
let chat = mk([['char', 'c0'], ['user', 'u2'], ['char', 'c2']], vars);
Object.assign(vars, settleItemUse(chat, 2, new Set(['i_pain']), false) ?? {});
console.log('after c2 settle at=', vars.$st_item_use_at, 'queue', vars.$st_item_use);
chat = mk([['char', 'c0'], ['user', 'u2']], vars); // 응답 지움
console.log('pending for u2 (빈 전송/다시 생성):', JSON.stringify(pendingItemUse(vars, 'u2')));
const chat3 = mk([['char', 'c0'], ['user', 'u2'], ['user', 'u3']], vars);
console.log('pending for u3 (새 메시지):', JSON.stringify(pendingItemUse(vars, 'u3')));
// 지운 뒤 같은 진통제를 다시 「사용」
const r = queueUseVars(chat, (q) => addUse(q, pain, 4));
console.log('re-add painkiller after delete ->', JSON.stringify(r));
