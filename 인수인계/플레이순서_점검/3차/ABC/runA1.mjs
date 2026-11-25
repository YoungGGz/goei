// A1 권한 하나씩 거부 + B5 직접 입력 전송 막힘(전송 대기·취소 실제 클릭, 기다리는 중 취소 두 번)
// 사용: FAKE_URL=http://192.0.2.2:8796 node runA1.mjs <sendChat|mainDom|replacer>
//  거부할 권한 묻기에만 'no', 나머지는 'yes' (리스아이 alertStore ask 를 글로 가림)
import { openT2 } from '../틀/risu-t2.mjs';
import { writeFileSync } from 'node:fs';
import { OUT, sleep, baseRules, turn, FLOWS, redact, reqText, text, quietAux } from './lib.mjs';

const deny = process.argv[2] ?? 'sendChat';
const tag = `A1-deny-${deny}`;
const RE = { sendChat: 'send chat messages', mainDom: 'access the main Document', replacer: 'replace content in the chat', db: 'access the full database' }[deny];
const t = await openT2({ via: 'plain' });
await t.ctx.addInitScript((re) => {
  Object.defineProperty(window, '__t2Answer', { configurable: true, get() { const a = (window.__t2Alerts ?? []).at(-1); return a && new RegExp(re).test(a.msg) ? 'no' : 'yes'; }, set() {} });
}, RE);
const res = { tag, deny, at: new Date().toISOString(), steps: [] };
const step = (name, expect, actual, ok) => { res.steps.push({ name, expect, actual, ok }); console.log(ok === true ? 'OK ' : ok === false ? 'NG ' : '-- ', name, '|', JSON.stringify(actual).slice(0, 300)); };
const handlers = () => t.R(async () => { const pl = await import('/src/ts/plugins/plugins.svelte.ts'); return { disp: pl.pluginV2.editdisplay.size, out: pl.pluginV2.chatOutput?.size, req: pl.pluginV2.replacerbeforeRequest.size, inp: pl.pluginV2.editinput.size }; });
const N = FLOWS['나'];
try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: baseRules() });
  await t.setup();
  await sleep(4000);
  const fab = await t.R(() => document.querySelector('[x-goei-fab]')?.style.display ?? 'none');
  step('권한 묻기·처리기', `${deny} 만 거부`, { alerts: (await t.alerts()).filter((a) => a.type === 'ask').map((a) => a.msg.slice(0, 60)), handlers: await handlers(), fab }, null);
  if (deny === 'mainDom') {
    step('mainDom 거부: 유령 단추', '없음(감시만 돎)', fab, fab !== 'block');
    // 유령 단추가 없으면 창을 못 연다 → 상태 파일로 본편 처리만 본다
    const r = await t.loadState((await import('node:url')).fileURLToPath(new URL('../틀/states/S-관리국-3턴.json', import.meta.url)));
    await sleep(3000);
    const scr = await t.screenMessages();
    step('mainDom 거부: 상태창 그리기', '상태창 카드(원문 [▣ 없음)', scr.filter((m) => /\[▣\|/.test(m.text)).map((m) => m.idx), !scr.some((m) => /\[▣\|/.test(m.text)));
    const s0 = await t.fakeSeq();
    const r1 = await turn(t, { user: '잼트리에게 다음 일정을 묻는다.', prose: '잼트리가 서류철을 넘겼다.\n\n<img=Jaemtri_neutral>\n\n"오후에 현장 견학이야."', status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } });
    const all = (r1.rec.body.messages ?? []).map((m) => text(m.content)).join('\n');
    step('mainDom 거부: 본편 요청 조립', '로어·상태창·[Inventory] 들어감', { lore: all.includes('<!-- goei:lore -->'), status: all.includes('[Previous status]'), inv: all.includes('[Inventory]'), user: (all.match(/\{\{user\}\}/g) ?? []).length }, all.includes('<!-- goei:lore -->') && all.includes('[Previous status]'));
    const st = await t.chatState(true);
    step('mainDom 거부: 응답 처리(상황판 태그 걷음)', '저장 답에 [AN|·[AG| 없음', /\[(AN|IN|MS|AG)\|/.test(String(st.message.at(-1)?.data)), !/\[(AN|IN|MS|AG)\|/.test(String(st.message.at(-1)?.data)));
  } else {
    await t.fabReady().catch(() => {});
    // 백일몽 · 08 직접 입력 → 출발
    const s0 = await t.fakeSeq();
    await t.startPanel(N.start);
    await sleep(4000);
    let st = await t.chatState(true);
    const main0 = await t.fakeLog(s0, 'main');
    step('출발 뒤', deny === 'sendChat' ? '본편 요청 없음, 마지막 user 에 %%GOEI_UNSENT%%' : '(관찰)', { mainReqs: main0.length, n: st.message.length, last: String(st.message.at(-1)?.data ?? '').slice(-80), unsent: String(st.message.at(-1)?.data ?? '').includes('%%GOEI_UNSENT%%') }, deny === 'sendChat' ? main0.length === 0 && String(st.message.at(-1)?.data ?? '').includes('%%GOEI_UNSENT%%') : null);
    const winMsg = await t.feval(() => document.querySelector('.gx-err, .gx-notice')?.innerText ?? null).catch(() => null);
    step('창 안내 글', '자동 전송 막힘 안내', winMsg, null);
    await t.closeWindow();
    await sleep(800);
    const card = await t.R(() => { const b = document.querySelector('.default-chat-screen .risu-chat[data-chat-index="0"]'); const c = b?.querySelector('[data-goei-cancel]'); return c ? { text: c.innerText, row: c.parentElement?.innerText?.replace(/\s+/g, ' ') } : null; });
    step('채팅 속 전송 대기·취소', '카드·「취소」 단추', card, deny === 'sendChat' ? !!card : null);
    await t.shot(`${tag}-01-unsent`);
    if (deny === 'sendChat' && card) {
      // 기다리는 중 아님 → 한 번 누르면 물림 → 채팅 비고 시작 화면 열림
      await t.page.click('.default-chat-screen .risu-chat[data-chat-index="0"] [data-goei-cancel]');
      await sleep(2000);
      st = await t.chatState(true);
      const gx = await t.frame('.gx-fac', 5000).then(() => true).catch(() => false);
      step('취소 한 번(기다림 없음)', '메시지 지워짐·시작 화면 다시 열림', { n: st.message.length, startScreen: gx }, st.message.length === 0 && gx);
      await t.shot(`${tag}-02-after-cancel`);
      // 다시 출발 → 대기 → 리스아이 보내기 단추로 직접 보냄(본편 붙잡음) → 기다리는 중 취소 두 번
      await t.closeWindow(); await sleep(800);
      await t.startPanel(N.start);
      await sleep(3000);
      await t.closeWindow();
      const s1 = await t.fakeSeq();
      await t.page.click('.default-chat-screen .button-icon-send');
      let rec = null; for (let i = 0; i < 40 && !rec; i++) { await sleep(400); rec = (await t.fakeLog(s1, 'main')).find((x) => x.action === 'hold' && !x.response); }
      st = await t.chatState(true);
      step('보내기 단추로 직접 보냄', '본편 1건(붙잡음), user 글 그대로 1개', { main: !!rec, n: st.message.length, unsentStill: String(st.message.at(-1)?.data ?? '').includes('%%GOEI_UNSENT%%'), lastUser: rec ? text(rec.body.messages.filter((m) => m.role === 'user').at(-1)?.content).slice(0, 80) : null, markInReq: rec ? /%%GOEI_UNSENT%%/.test(JSON.stringify(rec.body)) : null }, !!rec);
      const prog = await t.progText();
      step('진행 창', '「메인 응답 대기」', prog, /메인 응답 대기/.test(prog ?? ''));
      const c1 = await t.R(() => !!document.querySelector('.default-chat-screen [data-goei-cancel]'));
      if (c1) {
        await t.page.click('.default-chat-screen [data-goei-cancel]');
        await sleep(500);
        const txt1 = await t.R(() => document.querySelector('.default-chat-screen [data-goei-cancel]')?.innerText ?? null);
        st = await t.chatState(true);
        step('기다리는 중 취소 한 번', '「한 번 더 누르면 취소」, 메시지 그대로', { button: txt1, n: st.message.length }, /한 번 더/.test(txt1 ?? '') && st.message.length === 1);
        await t.page.click('.default-chat-screen [data-goei-cancel]');
        await sleep(1500);
        st = await t.chatState(true);
        step('기다리는 중 취소 두 번', '(관찰) 메시지 물림', { n: st.message.length }, null);
      } else step('기다리는 중 취소 단추', '(관찰) 보낸 뒤 카드가 남는지', c1, null);
      // 붙잡은 답을 풀어 본다 → 지운 user 뒤에 답이 붙는지
      const { buildReply, readRequest } = await import('./lib.mjs');
      if (rec) { writeFileSync(`${OUT}/reply-now.txt`, buildReply(readRequest(rec.body), N.turns[0])); await t.fake('release', { seq: rec.seq }); }
      await t.waitIdle().catch(() => {});
      await quietAux(t);
      st = await t.chatState(true);
      step('취소 뒤 늦게 온 답', '(관찰) 채팅 모양', st.message.map((m) => [m.role, String(m.data).slice(0, 40)]), null);
      await t.shot(`${tag}-03-late-reply`);
    }
  }
} catch (e) { res.error = String(e?.stack ?? e); console.error(e); try { await t.shot(`${tag}-FAIL`); } catch {} }
finally {
  res.console = t.errors.filter((e) => !/displayData/.test(e)).slice(-60);
  res.alerts = await t.alerts().catch(() => null);
  writeFileSync(`${OUT}/${tag}-${Date.now()}.json`, JSON.stringify(res, null, 1));
  await t.close();
}
