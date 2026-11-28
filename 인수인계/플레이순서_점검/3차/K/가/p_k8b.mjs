// K8 덧(다시 돌림): K8-04 는 기능 페이지에서 바꾼 뒤 흐름 페이지로 돌아가지 않고 읽었다 → 돌아가서 읽음
import { session } from './lib.mjs';

export async function k8b() {
  const S = await session('K8b');
  const { t, step } = S;
  const pressed = (sel) => S.fe((s) => { const b = document.querySelector(s); return b ? (b.getAttribute('aria-pressed') ?? b.getAttribute('aria-checked') ?? (b.classList.contains('on') ? 'on' : 'off')) : null; }, sel);
  try {
    await S.fakeReset();
    await t.setup();
    await S.loadState('S-관리국-3턴.json');
    const st = step('흐름 페이지 괴담넷 모델 「메인」 → 인터넷 페이지 격자 「메인」 켜짐 / 인터넷 페이지에서 「보조」 → 흐름 페이지로 돌아가면 「보조」 켜짐', '두 페이지가 한 값', 'flowpage.ts model2 ↔ famtable boardTable (같은 b:gn:mode)');
    await S.ed('manage:flow');
    await S.click('.gw [data-action="fl-do"][data-value="fam-set|b:gn:mode=1"]', 900);
    await S.ed('set:net');
    const net1 = await pressed('.gw [data-value="b:gn:mode=1"]');
    await S.click('.gw [data-value="b:gn:mode=2"]', 900);
    await S.ed('manage:flow');
    const fl2 = await pressed('.gw [data-action="fl-do"][data-value="fam-set|b:gn:mode=2"]');
    const fl1 = await pressed('.gw [data-action="fl-do"][data-value="fam-set|b:gn:mode=1"]');
    await st.shot('흐름_보조');
    st.check(net1 === 'true' && fl2 === 'true' && fl1 !== 'true', { netMainAfterFlow: net1, flowAuxAfterNet: fl2, flowMain: fl1 });
  } catch (e) {
    S.note('예외', String(e?.stack ?? e));
  } finally {
    await S.close();
  }
}
