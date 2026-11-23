// 파트 d: 설정값이 실제 요청 글·호출에 반영되나 (설정이 코드에 박힌 값으로 덮이지 않나, 하드코딩 금지 규칙)
import { fx, boot, launch, goNode, sleep, recorder, ss, prefs, settle, openStarted, startedChat, packs, fmtMsgs, setInput, closeEditor, closeWin } from './lib.mjs';

const ST = '[▣|2025.03.14|11:20 PM|🌙|6°C|편의점|없음|없음|없음|관리국/신입|1000]';
const shelf = (names) => `<shop-identity>\nsells: 과자, 음료\nnever: -\nprices: -\ncurrency: -\n</shop-identity>\n<owner>\n어서 오세요.\n</owner>\n<shelf>\n${names.map((n, i) => `${n}|${1000 + i * 100}|소모1|음식/과자/snack|0.09|봉지 과자|`).join('\n')}\n</shelf>`;
const restock = (names) => `<owner>\n새로 채웠어요.\n</owner>\n<shelf>\n${names.map((n, i) => `${n}|${1000 + i * 100}|소모1|음식/과자/snack|0.09|봉지 과자|`).join('\n')}\n</shelf>`;

export default async function (part) {
  const R = recorder(part);
  const browser = await launch();
  const chat = startedChat();
  // 턴 넷: 턴마다 표식 낱말
  chat.message = [
    { role: 'user', data: '유저표식A 사무실에 들어간다.', chatId: 'u1' }, { role: 'char', data: `본문표식1 사무실은 조용했다.\n${ST.replace('편의점', '관리국 본부')}`, chatId: 'c1' },
    { role: 'user', data: '유저표식B 밖으로 나간다.', chatId: 'u2' }, { role: 'char', data: `본문표식2 골목은 어두웠다.\n${ST.replace('편의점', '골목')}`, chatId: 'c2' },
    { role: 'user', data: '유저표식C 편의점에 들어간다.', chatId: 'u3' }, { role: 'char', data: `본문표식3 편의점 불빛이 밝았다.\n${ST}`, chatId: 'c3' },
    { role: 'user', data: '유저표식D 계산대로 간다.', chatId: 'u4' }, { role: 'char', data: `본문표식4 점원이 고개를 들었다.\n${ST}\n[shop: 편의점|]`, chatId: 'c4' },
  ];
  chat.scriptstate.$sh_judge = 'main';
  chat.scriptstate.$st_wallet = JSON.stringify({ start: 10000, log: [{ id: 'w1', anchor: 'c3', amount: -3000, memo: '점검커피', src: 'story' }] });
  const { page, errors } = await boot(browser, fx, chat, 'pc', { store: packs() });
  await openStarted(page, 'set:lore');
  await settle(page);
  const mainReq = async () => page.evaluate(async () => {
    const hist = window.__chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    hist.push({ role: 'user', content: '유저표식E 과자를 고른다.' });
    const out = await window.__calls.replacers[0]([{ role: 'system', content: 'SYSTEM PROMPT' }, ...hist], 'model');
    return out.map((m) => ({ role: m.role, content: String(m.content) }));
  });
  const joined = (msgs) => msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  const FAC = 'This reference describes the world to the GM';
  const ROS = 'GM reference for consistent character introductions';
  // ── 01 본편 기본 ──
  let base;
  {
    const s = R.step('본편_기본');
    base = await mainReq();
    R.file(s, fmtMsgs(base));
    const all = joined(base);
    R.check(s, '세력 요약이 들어감 (기본 켬)', all.includes(FAC), FAC, all.includes(FAC));
    R.check(s, '요원 명단이 들어감 (기본 켬)', all.includes(ROS), ROS, all.includes(ROS));
    R.check(s, '최근 거래 줄 기본 0 → 「점검커피」 없음 (설정 「컨텍스트 포함」 0~10, 기본 0)', !all.includes('점검커피'), '없음', all.includes('점검커피'));
  }
  // ── 02 로어북 호출: 세력 요약·요원 명단 끄기 (화면 단추) ──
  {
    const s = R.step('본편_세력요약_명단_끔');
    for (const k of ['lore_faction', 'lore_roster']) {
      const ok = await page.evaluate((k) => { const b = document.querySelector(`.gw [data-action="adv-set"][data-value="gen:${k}=0"]`); if (!b) return false; b.click(); return true; }, k);
      await settle(page);
      if (!ok) R.check(s, `${k} 끄기 단추가 있음`, false, true, false);
    }
    const v = await ss(page);
    R.check(s, '바로 저장 ($gen_lore_faction·$gen_lore_roster = 0)', v.$gen_lore_faction === '0' && v.$gen_lore_roster === '0', ['0', '0'], [v.$gen_lore_faction, v.$gen_lore_roster]);
    const out = await mainReq();
    R.file(s, fmtMsgs(out));
    const all = joined(out);
    R.check(s, '세력 요약이 빠짐', !all.includes(FAC), '없음', all.includes(FAC));
    R.check(s, '요원 명단이 빠짐', !all.includes(ROS), '없음', all.includes(ROS));
  }
  // ── 03 가계부 최근 거래 줄 3 (화면 직접 입력) ──
  {
    const s = R.step('본편_최근거래3');
    await goNode(page, 'set:items'); await settle(page);
    const sel = '.gw input.adv-val[data-change="set-wallet-recent"]';
    const has = await page.$(sel);
    if (has) { await setInput(page, sel, '3'); await settle(page); }
    const v = await ss(page);
    R.check(s, '직접 입력 3 이 바로 저장', v.$st_wallet_recent === '3', '3', v.$st_wallet_recent);
    const out = await mainReq();
    R.file(s, fmtMsgs(out));
    R.check(s, '본편에 최근 거래 「점검커피」 줄이 들어감', joined(out).includes('점검커피'), '점검커피', joined(out).includes('점검커피'));
  }
  // ── 04 상시 로어북 하나 더 고르기 (로어북 호출 페이지 목록) ──
  let pickedBook = '';
  {
    const s = R.step('상시로어북_고르기');
    await goNode(page, 'set:lore'); await settle(page);
    await page.evaluate(() => document.querySelector('.gw [data-action="adv-books"]')?.click());
    await settle(page);
    pickedBook = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.gw [data-action="adv-book"][aria-pressed="false"]')].find((x) => !x.querySelector('small') && /편의점|책방|상점|가게/.test(x.dataset.value)) || [...document.querySelectorAll('.gw [data-action="adv-book"][aria-pressed="false"]')].find((x) => !x.querySelector('small'));
      if (!b) return '';
      b.click();
      return b.dataset.value;
    });
    await settle(page);
    const v = await ss(page);
    R.check(s, `「${pickedBook}」 고르면 바로 저장 ($gen_active_books)`, !!pickedBook && String(v.$gen_active_books ?? '').includes(pickedBook), pickedBook, v.$gen_active_books);
  }
  // ── 상점 열기 (기본값) ──
  await closeEditor(page, true).catch(() => {});
  await closeWin(page).catch(() => {});
  await page.evaluate(async (i) => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: i }); }, 7);
  await sleep(300);
  { let last = -1; for (let i = 0; i < 40; i++) { const n = await page.evaluate(() => (window.__calls.llm || []).length); if (n === last) break; last = n; await sleep(500); } }
  const openShop = async () => {
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), chat.message[7].data);
    await page.evaluate((h) => { document.getElementById('chat-card')?.remove(); const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:2147483000'; d.innerHTML = h; document.body.appendChild(d); }, html);
    await page.evaluate((t) => window.__calls.handlers.display(t), chat.message[7].data);
    const has = await page.$('#chat-card [data-goei-shop]');
    if (has) await page.click('#chat-card [data-goei-shop]');
    await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
    return !!has;
  };
  const llmN = () => page.evaluate(() => (window.__calls.llm || []).length);
  const queue = (...t) => page.evaluate((t) => { window.__llm = t.map((r) => (typeof r === 'string' ? { type: 'success', result: r } : r)); }, t);
  const waitCalls = async (n0, k = 1) => { await page.waitForFunction(([n, k]) => (window.__calls.llm || []).length >= n + k, [n0, k], { timeout: 15000 }).catch(() => {}); await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 15000 }).catch(() => {}); await sleep(400); };
  const callAt = (i) => page.evaluate((i) => window.__calls.llm[i], i);
  const refresh = async () => page.evaluate(() => { const el = document.createElement('button'); el.dataset.action = 'shop-refresh'; el.style.display = 'none'; (document.querySelector('.sh-wrap') || document.body).appendChild(el); el.click(); el.remove(); });
  const setVars = (o) => page.evaluate((o) => { for (const [k, v] of Object.entries(o)) { if (v === null) delete window.__chat.scriptstate[k]; else window.__chat.scriptstate[k] = v; } }, o);
  // 설정을 바꾼 뒤엔 상점을 닫고 카드로 다시 연다 (열린 상점은 연 때의 채팅을 쥐고 있다. 화면에서 바꾸면 창이 새로 읽는 것과 같게)
  const apply = async (o) => {
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'shop-close'; b.style.display = 'none'; (document.querySelector('.gx-panel') || document.querySelector('.gx') || document.body).appendChild(b); b.click(); b.parentNode?.removeChild(b); });
    await sleep(300);
    await closeWin(page).catch(() => {});
    await setVars(o);
    await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = ''; });
    const before = await llmN();
    await openShop();
    await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 15000 }).catch(() => {});
    await sleep(600);
    return (await llmN()) - before;
  };
  let names = 0;
  const fresh = (n = 2) => Array.from({ length: n }, () => `점검과자${++names}`);
  {
    const s = R.step('상점_첫진열_기본');
    await queue(shelf(fresh()));
    const n0 = await llmN();
    const card = await openShop();
    await waitCalls(n0);
    const c = await callAt(n0);
    R.file(s, `mode=${c?.mode}\n\n${fmtMsgs(c?.messages ?? [])}`);
    const all = joined(c?.messages ?? []);
    R.check(s, '카드가 뜨고 첫 진열 요청 1회', card && (await llmN()) - n0 === 1, 1, (await llmN()) - n0);
    R.check(s, '모델 기본 = 보조 모델 (submodel)', c?.mode === 'submodel', 'submodel', c?.mode);
    R.check(s, '챗로그 기본 3턴: 본문표식2·3·4 있고 1 없음 (양 표 「정하지 않은 기능은 3턴」)', all.includes('본문표식2') && all.includes('본문표식4') && !all.includes('본문표식1'), '2~4', ['1', '2', '3', '4'].map((x) => all.includes(`본문표식${x}`)));
    R.check(s, '유저 메시지 기본 포함', all.includes('유저표식C'), true, all.includes('유저표식C'));
    R.check(s, `고른 상시 로어북 「${pickedBook}」 이 참고 자료로 들어감 (가게 표·기능 표 「상시 로어북」 기본 켬)`, !!pickedBook && all.includes(pickedBook), pickedBook, all.includes(pickedBook));
  }
  // ── 05 새로고침: 챗로그 1턴·유저 메시지 빼기·영어 (설정 값) ──
  {
    const s = R.step('상점_새로고침_턴1_유저빼기_영어');
    await apply({ $sh_fn_shelf_turns: '1', $gen_user_msgs: '0', $gen_lang: 'en' });
    await queue(restock(fresh()));
    const n0 = await llmN();
    await refresh();
    await waitCalls(n0);
    const c = await callAt(n0);
    R.file(s, `mode=${c?.mode}\n\n${fmtMsgs(c?.messages ?? [])}`);
    const all = joined(c?.messages ?? []);
    R.check(s, '챗로그 1턴: 본문표식4 만', all.includes('본문표식4') && !all.includes('본문표식3'), '4만', ['1', '2', '3', '4'].map((x) => all.includes(`본문표식${x}`)));
    R.check(s, '유저 메시지 빼기: 유저표식 없음', !/유저표식[A-E]/.test(all), '없음', all.match(/유저표식[A-E]/g));
    R.check(s, '생성 언어 영어 문장이 붙음 (요청 공통 LANGUAGE.EN)', all.includes('Write all output in English.') && !all.includes('Write all output in Korean.'), 'Write all output in English.', [all.includes('Write all output in English.'), all.includes('Write all output in Korean.')]);
  }
  // ── 06 모델: 메인 모델 ──
  {
    const s = R.step('상점_모델_메인');
    await apply({ $sh_model: 'main', $gen_lang: null, $gen_user_msgs: null, $sh_fn_shelf_turns: null });
    await queue(restock(fresh()));
    const n0 = await llmN();
    await refresh();
    await waitCalls(n0);
    const c = await callAt(n0);
    R.check(s, '상점 모델 = 메인 → mode model', c?.mode === 'model', 'model', c?.mode);
  }
  // ── 07 형식 오류 재시도 3회 + 재시도 모델 보조 ──
  {
    const s = R.step('상점_형식오류_재시도3');
    await apply({ $gen_retries: '3', $gen_retry_model: 'aux' });
    await queue('아무 꼴도 아닌 답', '아무 꼴도 아닌 답', '아무 꼴도 아닌 답', '아무 꼴도 아닌 답', restock(fresh()));
    const n0 = await llmN();
    await refresh();
    await waitCalls(n0, 4);
    const n1 = await llmN();
    const modes = [];
    for (let i = n0; i < n1; i++) modes.push((await callAt(i))?.mode);
    R.file(s, `호출 ${n1 - n0}회 mode ${modes.join(',')}`);
    R.check(s, '형식 오류 재시도 3 → 4회 부름', n1 - n0 === 4, 4, n1 - n0);
    R.check(s, '첫 호출은 상점 모델(메인), 다시 묻기는 재시도 모델(보조)', modes[0] === 'model' && modes.slice(1).every((m) => m === 'submodel'), ['model', 'submodel×3'], modes);
  }
  // ── 08 모델 오류 재시도 0 ──
  {
    const s = R.step('상점_모델오류_재시도0');
    await apply({ $gen_retries: '0', $gen_retry_model: null, $gen_transient: '0', $sh_model: null });
    await queue({ type: 'success', result: '' }, restock(fresh()));
    const n0 = await llmN();
    await refresh();
    await waitCalls(n0);
    await sleep(2500);
    const n1 = await llmN();
    R.check(s, '빈 응답 + 모델 오류 재시도 0 → 1회만', n1 - n0 === 1, 1, n1 - n0);
    await page.evaluate(() => { window.__llm = []; });
  }
  // ── 09 모델 오류 재시도 기본 2 ──
  {
    const s = R.step('상점_모델오류_재시도기본');
    await apply({ $gen_transient: null });
    await queue({ type: 'success', result: '' }, { type: 'success', result: '' }, { type: 'success', result: '' }, restock(fresh()));
    const n0 = await llmN();
    await refresh();
    await page.waitForFunction((n) => (window.__calls.llm || []).length >= n + 3, n0, { timeout: 30000 }).catch(() => {});
    await sleep(3000);
    const n1 = await llmN();
    R.check(s, '빈 응답 셋 → 기본 2회 다시 (3회)', n1 - n0 === 3, 3, n1 - n0);
    await page.evaluate(() => { window.__llm = []; });
  }
  R.state(R.step('상태'), await ss(page));
  R.check(R.step('오류'), '페이지 오류 없음', errors.filter((e) => !/모델|빈 응답|형식/.test(e)).length === 0, [], errors.slice(0, 10));
  R.save();
  await browser.close();
}
