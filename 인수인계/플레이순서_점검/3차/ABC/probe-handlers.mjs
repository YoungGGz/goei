// 7번 가르기 보조: setup 뒤 리스아이 pluginV2 처리기 수가 언제 생기는지 (display·output·beforeRequest)
import { openT2 } from '../틀/risu-t2.mjs';
import { sleep } from './lib.mjs';
const t = await openT2({ via: 'plain' });
const probe = () => t.R(async () => { const pl = await import('/src/ts/plugins/plugins.svelte.ts'); return { disp: pl.pluginV2.editdisplay.size, out: pl.pluginV2.chatOutput?.size, req: pl.pluginV2.replacerbeforeRequest.size, inp: pl.pluginV2.editinput.size, fab: document.querySelector('[x-goei-fab]')?.style.display ?? null }; });
await t.setup();
const t0 = Date.now();
for (let i = 0; i < 12; i++) { console.log(((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(await probe())); await sleep(1000); }
console.log('alerts', JSON.stringify(await t.alerts()));
console.log('errors', JSON.stringify(t.errors.filter((e) => !/displayData/.test(e)).slice(-20)));
await t.close();
