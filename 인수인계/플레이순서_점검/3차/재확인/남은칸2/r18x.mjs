// 재확인 남은칸2 R18: 응답을 지운 직후(다음 말 전) 소지품·가계부·인물 화면이 지운 응답의 변경을 보여 주는지 (PC 1280x800, S-요원플레이)
import { boot, openItems, act, fText, invState, itemNames, sleep, OUT, baseRules, updaterScript, mainRule, st, seqNow, logSince, auxKind, updaterData, lastAsst, recorder } from './hlib.mjs';
const rec = recorder('r18x');
const u = updaterScript();
await baseRules(u.file);
const { t } = await boot({ state: 'S-요원플레이.json' });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const waitUpd = async (s0) => { for (let i = 0; i < 40; i++) { const l = await logSince(s0, 'aux'); if (l.some((x) => auxKind(x.body) === 'updater' && x.response)) break; await sleep(500); } await sleep(1500); };
async function turn(tag, text, reply, updFn) { const s0 = await seqNow(); await mainRule('m-' + tag, esc(text), reply); if (updFn) u.push(updFn); await t.send(text); await waitUpd(s0); return s0; }
const peopleNames = async () => Object.keys((await t.R(async () => { const db = await import('/src/ts/storage/database.svelte.ts'); const c = db.getCurrentCharacter(); return JSON.parse(JSON.stringify(c.chats[c.chatPage].goeiPeopleV1 ?? { people: {} })); })).people ?? {}).sort();
const hidden = (a, v) => t.feval(([a, v]) => { const b = document.createElement('button'); b.dataset.action = a; if (v != null) b.dataset.value = v; b.style.display = 'none'; document.querySelector('.gx').appendChild(b); b.click(); b.remove(); }, [a, v ?? null]).then(() => sleep(1000));
async function screens(tag) {
  await openItems(t);
  const items = await fText(t, '.gx-items'); await t.shot(`r18x-${tag}-소지품`);
  await act(t, 'items-sub', 'wallet', { wait: 900 });
  const wallet = await fText(t, '.gx-items'); await t.shot(`r18x-${tag}-가계부`);
  await hidden('rec-people');
  const ppl = await fText(t, '.gx'); await t.shot(`r18x-${tag}-인물`);
  await t.closeWindow();
  const s = await invState(t);
  return {
    items손전등: /손전등/.test(items ?? ''), wallet110: /110,000/.test(wallet ?? ''), wallet140: /140,000/.test(wallet ?? ''), wallet편의점: /편의점/.test(wallet ?? ''), ppl오지훈: /오지훈/.test(ppl ?? ''),
    store: { items: itemNames(s.items), walletLog: (s.wallet?.log ?? []).map((e) => `${e.src}:${e.amount}:${e.memo}:${String(e.anchor ?? '').slice(0, 8)}`), people: await peopleNames(), msgs: s.s.message.length },
    walletHead: (wallet ?? '').slice(0, 160),
  };
}
try {
  const q1 = '에일린은 편의점에서 손전등을 3만 원에 샀다. 계산대의 아르바이트생 오지훈이 영수증을 건넸다.';
  await turn('R1', 'R1 편의점에 들른다', `${q1}\n${st({ time: '10:10 AM', bal: 110000 })}`, (d) => ({
    items: [{ m: lastAsst(d)?.m, name: '손전등', action: 'new', desc: '작은 LED 손전등', usable: true, uses: null, equip: 'none', icon: 'tool/손전등/flashlight', weight: 0.2, quote: q1 }],
    transactions: [{ amount: -30000, memo: '편의점 손전등', m: lastAsst(d)?.m, quote: q1 }],
    new_people: [{ name: '오지훈', aliases: [], m: lastAsst(d)?.m, quote: '아르바이트생 오지훈이 영수증을 건넸다', identity: '편의점 아르바이트생', speech: '존댓말' }],
  }));
  rec.expect('R18x-0', '지우기 전: 소지품 손전등, 가계부 110,000·편의점 거래, 인물 오지훈', '준비');
  const a = await screens('지우기전');
  rec.actual('R18x-0', a.items손전등 && a.wallet110 && a.ppl오지훈, a);
  const n = (await invState(t)).s.message.length;
  await t.deleteMessage(n - 1);
  await sleep(2000);
  rec.expect('R18x-1', '응답을 지운 직후(다음 말 전): 지운 응답이 만든 손전등·편의점 거래(잔고 110,000)·오지훈이 화면에서 빠짐', '공-01(사용자 결정)·공-02·D-04·I-05');
  const b = await screens('지운직후');
  rec.actual('R18x-1', !b.items손전등 && !b.wallet편의점 && !b.ppl오지훈, b);
  await sleep(5000);
  const b2 = await screens('지운뒤5초');
  rec.actual('R18x-1b', !b2.items손전등 && !b2.wallet편의점 && !b2.ppl오지훈, b2);
  const s0 = await turn('R2', 'R2 사무실로 돌아간다', `에일린은 사무실로 돌아왔다.\n${st({ time: '10:30 AM', bal: 140000 })}`, () => ({}));
  rec.expect('R18x-2', '다음 말을 보낸 뒤: 셋 다 빠져 있음', '공-01');
  const c = await screens('다음말뒤');
  const lg = await logSince(s0);
  const main = lg.filter((x) => x.route === 'main').at(-1);
  const flat = (main?.body?.messages ?? []).map((m) => String(m.content)).join('\n');
  rec.actual('R18x-2', !c.items손전등 && !c.wallet편의점 && !c.ppl오지훈, { ...c, reqHas손전등: flat.includes('손전등'), reqHas오지훈: flat.includes('오지훈'), prevStatus: flat.match(/\[Previous status\][^\n]*\n?[^\n]*/)?.[0]?.slice(0, 200) });
} catch (e) { rec.actual('예외', false, String(e?.stack ?? e).slice(0, 1200)); await t.shot('r18x-error').catch(() => {}); }
finally { await u.stop(); await t.close(); }
