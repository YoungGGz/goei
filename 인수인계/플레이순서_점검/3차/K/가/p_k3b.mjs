// K3 덧(다시 돌림): 이동·임무에 붙는 추가 규칙의 [[…]] — [[foo]] 가 임무 보내기를 막나, [[DEST]] 가 지시문 자리에서 바뀌나
//   p_k3 의 K3-06 은 고른 목표가 「이미 발생 중」이라 못 봤고, K3-07 은 RP 자리(그대로)만 읽었다 → 붙일 곳을 이동·임무 하나로, 목표는 안 막힌 것을 차례로 찾음
import { session, sleep, flat } from './lib.mjs';

export async function k3b() {
  const S = await session('K3b');
  const { t, step } = S;
  const rid = async () => (await S.prefs())?.rules?.[0]?.id;
  /** 커스텀 임무 목록에서 안 막힌 목표를 차례로 골라 보냄 */
  const mission = async (skip = []) => {
    const tried = [];
    for (let i = 0; i < 8; i++) {
      await S.winClose(); await S.winOpen();
      await S.click('.gx [data-action="tab"][data-value="map"]', 700);
      await S.click('.gx [data-action="tab"][data-value="mission"]', 900);
      const vals = await S.fe(() => [...new Set([...document.querySelectorAll('[data-action="mission-open"]')].map((e) => e.dataset.value))]);
      const v = vals.filter((x) => !skip.includes(x) && !tried.includes(x))[0];
      if (!v) break;
      tried.push(v);
      await S.click(`[data-action="mission-open"][data-value="${v}"]`, 700);
      await S.click(`[data-action="mission-pick"][data-value="${v}"]`, 700);
      const picked = await S.fe(() => document.querySelector('[data-action="mission-send"]')?.closest('section, div')?.textContent.replace(/\s+/g, ' ').slice(0, 160) ?? null);
      const s0 = await S.seq();
      await S.click('[data-action="mission-send"]', 1500);
      const notice = await S.fe(() => [...document.querySelectorAll('.gx-notice, .gx-err, [role="alert"], .gx-toast')].map((e) => e.textContent.trim()).filter(Boolean).join(' / ') || null).catch(() => null);
      if (/이미 발생/.test(notice ?? '')) continue;
      await t.waitBusy(6000).catch(() => {});
      await t.waitIdle().catch(() => {});
      await sleep(2500);
      const l = await S.log(s0);
      return { target: v, picked, notice, tried, main: l.filter((r) => r.route === 'main'), last: (await t.chatState()).message.at(-1) };
    }
    return { target: null, tried, main: [] };
  };
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');
    await S.ed('rule:all');
    await S.click('.gw [data-action="ed-rule-new"]', 900);
    const id = await rid();
    await S.setVal(`.gw input[data-input="ed-rule-title"][data-key="${id}"]`, 'K3b규칙', 'input', 300);
    await S.click(`.gw [data-action="ed-rule-to"][data-value="${id}|Directive"]`, 500);
    await S.click(`.gw [data-action="ed-rule-to"][data-value="${id}|RP"]`, 500);
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3B-RULE-PLAIN: stay calm.', 'input', 1200);
    S.note('규칙(붙일 곳)', (await S.prefs())?.rules);

    let st = step('[[…]] 없는 규칙(붙일 곳 이동·임무만) → 커스텀 임무가 나가고 지시문 COMMON 끝 뒤에 규칙', '임무 본편 1건, 「If a Situation is given, follow it first.」 뒤 400자 안에 K3B-RULE-PLAIN', '지침 탭 안내 「이동·임무 = 그 지침의 공통 절 끝」');
    let ms = await mission();
    const used = [ms.target];
    let f = flat(ms.main[0] ?? {});
    const i = f.indexOf('If a Situation is given, follow it first.'); const j = f.indexOf('K3B-RULE-PLAIN');
    st.req('임무_규칙', ms.main[0]);
    st.check(ms.main.length >= 1 && i >= 0 && j > i && j - i < 450, { target: ms.target, tried: ms.tried, notice: ms.notice, main: ms.main.length, gap: j - i });

    st = step('규칙 글에 [[foo]] → 커스텀 임무 보내기', '규칙 칸 안내 「모델에게 그대로 가요」대로 임무가 나가고 [[foo]] 글자 그대로 (막히면 어긋남)', '규칙 칸 안내 / dispatch.ts:66-70 fill (2차 결과 B 「안 돌림」)');
    await S.ed('rule:all');
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3B-RULE-FOO: see [[foo]] for notes.', 'input', 1200);
    ms = await mission(used);
    used.push(ms.target);
    await st.shot('임무_foo');
    const errs = t.errors.filter((e) => /치환|\[\[foo\]\]|Directive/.test(e)).slice(-3);
    st.req('임무_foo', ms.main[0]);
    st.check(ms.main.length >= 1 && /K3B-RULE-FOO: see \[\[foo\]\]/.test(flat(ms.main[0] ?? {})), { target: ms.target, tried: ms.tried, notice: ms.notice, mainSent: ms.main.length, lastMsg: String(ms.last?.data ?? '').slice(0, 100), errs });

    st = step('규칙 글에 [[DEST]] → 커스텀 임무: 지시문 자리의 규칙 글', '「[[DEST]]」 글자 그대로 (규칙 칸 안내 「모델에게 그대로 가요」)', '규칙 칸 안내 / dispatch.ts fill');
    await S.ed('rule:all');
    await S.setVal(`.gw textarea[data-input="ed-rule-text"][data-key="${id}"]`, 'K3B-RULE-DEST: arrive at [[DEST]] quietly.', 'input', 1200);
    ms = await mission(used);
    f = flat(ms.main[0] ?? {});
    const all = [...f.matchAll(/K3B-RULE-DEST: arrive at ([^\n]*?) quietly/g)].map((m) => m[1]);
    st.req('임무_DEST', ms.main[0]);
    st.check(all.length > 0 && all.every((x) => x === '[[DEST]]'), { target: ms.target, notice: ms.notice, mainSent: ms.main.length, occurrences: all });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
    await t.shot('K3b_예외').catch(() => {});
  } finally {
    S.note('콘솔 오류(displayData 뺌)', t.errors.filter((x) => !/displayData|\[goei\] (시작|본체|세계|인물 모습|소지품 그림)/.test(x)).slice(0, 30));
    await S.close();
  }
}
