// 3차 점검 G · 망상홈쇼핑 남은 칸: 스티커 끌어 떼기(G-31) · 매진(G-19)·지난 부 잠그기 · 맞교환 감정. 실제 리스AI(996a553) + 가짜 모델 서버(이 일 전용 8794)
// 사용: source /tmp/t2/t2-env.sh && FAKE_URL=http://192.0.2.2:8794 node 인수인계/플레이순서_점검/3차/G/run-hs2.mjs [pc] [phone] [--tag 이름]
//   pc    = PC 1280×800 마우스 끌기 + 매진·지난 부 + 맞교환 (한 판)
//   phone = 폰 344×882 터치(CDP Input.dispatchTouchEvent) 끌기
// 단계마다 기대값·근거(결정표 줄 또는 코드)를 먼저 적고(check 의 expect·row) 대조한다. 결과 out/결과-hs2[-태그].json, 요청 전문 out/HS2-*.txt, 캡처 out/HS2-*.png
import { openRun, clickChatCard, sleep, STATES, msgsText, userText } from '../E/lib.mjs';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const argv = process.argv.slice(2);
const tagI = argv.indexOf('--tag');
const TAG = tagI >= 0 ? argv[tagI + 1] : '';
const want = new Set(argv.filter((a, i) => !a.startsWith('--') && (tagI < 0 || i !== tagI + 1)));
const on = (p) => !want.size || want.has(p);
const P = (n) => `HS2${TAG ? `-${TAG}` : ''}-${n}`;

// 편성: 1부 손전등(숨은 진실 있음, 매진 임박·남은 수량은 있지만 매진 줄 없음) · 2부 손난로(두 번째 큐에 sold) · 3부 벽시계(맞교환 대상)
// 매진 줄 꼴: 큐 줄 「컷|표정|대사|화면 사건」의 사건 칸이 sold (src/core/homeshop.ts eventOf·CUE_EVENT_WORD, 지침 BROADCAST 의 events)
const TRUTH1 = '빛에 닿은 그림자를 떼어 낸다. 사람 그림자에 세 번 비추면 풀린다';
const HS_SHOW2 = `<title>
토요 새벽 특가
</title>
<shelf>
붉은 리본 손전등|100000|손|도구/손전등/flashlight|0.246|켜면 붉은 빛이 납니다. 스티커: 사람에게 비추지 말 것.|어둠 속 길이 보인다|O|${TRUTH1}
따뜻한 손난로|20000|소모3|소모품/손난로/hand warmer|0.054|쥐면 금방 따뜻해집니다.|손이 따뜻해진다|-|체온을 옮기는 주머니. 남이 쥐면 그 사람 체온이 넘어온다
세 번 우는 벽시계|30000|사용|기기/벽시계/wall clock|1.84|정각마다 세 번 웁니다.|시간을 알려 준다|-|부르는 종. 네 번째 울음을 세면 따라간다
</shelf>
<cue>
#1
wide|talk|고객님들, 오늘도 잠 못 드셨죠?|-
bust|talk|오늘만 십만 원!|price
bust|talk|전화가 몰리고 있어요.|rush
wide|talk|남은 수량이 줄고 있습니다.|left -3
wide|talk|곧 매진입니다!|soon
#2
wide|talk|다음은 따뜻한 손난로!|price
bust|talk|매진입니다, 감사합니다!|sold
bust|talk|다음 상품을 기다려 주세요.|-
#3
wide|talk|마지막, 세 번 우는 벽시계!|price
bust|talk|정각마다 세 번 웁니다.|-
</cue>
<chat>
#1
야식왕|저거 진짜 켜져요?
#2
하루|손난로 귀엽다
#3
rose|시계 소리 왜 이럼
</chat>`;

// 맞교환으로 내밀 내 물건: 숨은 효과(truth) 있는 것 하나, 없는 것 하나. anchor '' = 직접 넣은 것(늘 산다, core/items.ts)
const MIRROR_TRUTH = '비추면 뒤에 선 것이 한 박자 늦게 움직인다';
const MY_ITEMS = { list: [
  { id: 'i_mirror', name: '금 간 손거울', desc: '모서리가 깨진 작은 손거울', effect: '', truth: MIRROR_TRUTH, use: true, state: 'damaged', icon: 'mirror', weight: 0.1, from: 'manual', anchor: '' },
  { id: 'i_coin', name: '녹슨 동전', desc: '오래된 백 원짜리', effect: '', use: false, state: 'intact', icon: 'coin', weight: 0.005, from: 'manual', anchor: '' },
], log: [] };

const updaterHs = (body) => { const m = /"shop_check":\{"m":"(m\d+)"/.exec(userText(body))?.[1]; return m ? JSON.stringify({ shop: { name: '망상홈쇼핑', owner: '@web', m } }) : '{}'; };

/** 망상홈쇼핑을 카드로 열고 편성 HS_SHOW2 를 받는다 (g3 와 같은 길) */
async function openHs(r, S, { items = false } = {}) {
  const { t, check, note } = r;
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  await sleep(1500);
  if (items) await r.setVars({ $st_items: JSON.stringify(MY_ITEMS) });
  const offU = r.on('updater', updaterHs);
  r.once('main', `휴대폰이 혼자 켜졌다. 깔지 않은 앱 「망상홈쇼핑 라이브」가 붉은 화면을 띄웠다.\n[shop: 망상홈쇼핑|@web]\n\n${r.status()}`);
  await t.send('휴대폰을 본다.');
  await sleep(6000);
  offU();
  r.once('hs', HS_SHOW2);
  const s = r.lastSeq();
  const clicked = await clickChatCard(t, '[data-goei-shop="hs"]');
  await r.until(async () => r.since(s, 'hs').length, 15000);
  await sleep(3000);
  const sh = r.J(await r.vars(), '$hs_show');
  check(S, '카드로 열고 편성 3부 받음 (지금 1부)', clicked && sh?.parts?.length === 3 && sh.at === 0, '3부·1부', sh && { n: sh.parts?.length, at: sh.at }, 'G-17');
  note(S, '편성 요청 수', r.since(s, 'hs').length);
}

/** 스티커 재기 (T1 tests/homeshop-browser.mjs seen() 과 같은 잣대 + 앞면 clipPath 로 들린 넓이) */
const STK = () => {
  const st = document.querySelector('.hs-sticker');
  if (!st) return null;
  st.querySelectorAll('.corner').forEach((c) => { c.style.pointerEvents = 'none'; });
  const e = st.querySelector('.hs-und .emb');
  const cs = e ? [...e.querySelectorAll('i')] : [];
  const vis = cs.map((c) => { const r = c.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === c || top === e || top?.classList.contains('w') || top?.classList.contains('hs-und'); });
  st.querySelectorAll('.corner').forEach((c) => { c.style.pointerEvents = ''; });
  // 보이는 글자를 차례대로, 끊긴 자리는 「…」
  let txt = ''; let last = -2;
  cs.forEach((c, i) => { if (!vis[i]) return; if (txt && i !== last + 1) txt += ' … '; else if (txt && !c.previousElementSibling) txt += ' '; txt += c.textContent; last = i; });
  const W = st.offsetWidth, H = st.offsetHeight;
  const clip = st.querySelector('.face')?.style.clipPath ?? '';
  const pts = clip.startsWith('polygon(') ? clip.replace(/^polygon\(|\)$/g, '').split(',').map((p) => p.trim().split(/\s+/).map(parseFloat)) : [[0, 0], [W, 0], [W, H], [0, H]];
  let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
  const frac = Math.max(0, 1 - Math.abs(a) / 2 / (W * H));
  return { all: e?.textContent ?? '', n: cs.length, seen: vis.filter(Boolean).length, txt, W, H, lim: Number(st.dataset.lim), corner: st.dataset.corner, dir: st.dataset.dir, tilt: Number(st.dataset.tilt), lifted: st.classList.contains('lifted'), pts: pts.map((p) => p.map((v) => Math.round(v * 10) / 10)), frac: Math.round(frac * 1000) / 1000, corners: st.querySelectorAll('.corner').length, rest: getComputedStyle(st).getPropertyValue('--rest') };
};
/** 접는 선(앞면 꼭짓점 가운데 네 귀퉁이가 아닌 두 점)의 법선과 화면에서 끈 방향 사이 각(도). 스티커 기울기(tilt)를 빼고 잰다 */
const foldAngle = (st, dx, dy) => {
  const cn = [[0, 0], [st.W, 0], [st.W, st.H], [0, st.H]];
  const cut = st.pts.filter((p) => !cn.some((c) => Math.abs(c[0] - p[0]) < 0.6 && Math.abs(c[1] - p[1]) < 0.6));
  if (cut.length !== 2) return null;
  const lx = cut[1][0] - cut[0][0], ly = cut[1][1] - cut[0][1];
  const a = (-st.tilt * Math.PI) / 180;
  const mx = dx * Math.cos(a) - dy * Math.sin(a), my = dx * Math.sin(a) + dy * Math.cos(a);
  const cos = Math.abs(lx * mx + ly * my) / (Math.hypot(lx, ly) * Math.hypot(mx, my));
  return Math.round((90 - (Math.acos(Math.min(1, cos)) * 180) / Math.PI) * 10) / 10; // 0 = 선이 끈 방향에 수직
};
const norm = (s) => s.replace(/\s+/g, ' ').trim();
/** 드러난 글이 진실의 조각들인가: 「…」 로 나눈 조각마다 진실 속 이어진 글 */
const pieceOf = (txt, truth) => !!txt && txt.split(' … ').every((p) => norm(truth).includes(norm(p)));
/** 시청 기록($hs_log)의 스티커 줄 */
const stickerLogs = async (r) => (r.J(await r.vars(), '$hs_log')?.entries ?? []).filter((e) => e.k === 'aside' && e.who === '스티커').map((e) => e.text);

/** 모서리 가운데의 페이지 좌표와, 그 점이 프레임 안에서 실제로 그 모서리에 닿는지 (프레임 좌표 틀 확인) */
async function cornerAt(t, corner) {
  const b = await t.F().locator(`.hs-sticker .corner.c-${corner}`).boundingBox();
  const fb = await (await t.F().frameElement()).boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const hit = await t.feval(({ x, y, corner }) => document.elementFromPoint(x, y)?.classList.contains(`c-${corner}`) ?? false, { x: x - fb.x, y: y - fb.y, corner });
  return { x, y, hit, frame: { x: Math.round(fb.x), y: Math.round(fb.y), w: Math.round(fb.width) } };
}

// ═════════════════════ PC: 마우스 끌기 · 매진 · 지난 부 · 맞교환 ═════════════════════
async function pc(all) {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: 1280, height: 800 });
  const { t, check, note } = r;
  const page = t.page;
  const S0 = 'HS2 PC 스티커(마우스)';
  await openHs(r, S0, { items: true });
  await t.shot(P('pc-open'));

  // ── 스티커 창 ──
  await r.fclickAction('hs-pop', 'peek');
  await sleep(800);
  let st = await t.feval(STK);
  await t.shot(P('pc-peek'));
  check(S0, '잡는 모서리 넷', st?.corners === 4, 4, st?.corners, 'G-31 (「떼는 방향을 조정」) · src/ui/homeshop.ts peekPop STICKER_CORNERS');
  check(S0, '바닥 글 = 숨은 진실 전체 문장', norm(st?.all ?? '') === norm(TRUTH1), TRUTH1, st?.all, 'G-31 (「바닥에 숨은 효과 문장 전체」)');
  check(S0, '떼지는 넓이 한도 data-lim 15~35%', st && st.lim >= 0.15 && st.lim <= 0.35, '0.15~0.35', st?.lim, 'src/core/homeshop.ts stickerLimit · 설정 기본 15~35 (T1 시험과 같은 잣대)');
  check(S0, '가만히 있을 때: 들리지 않음(lifted 없음)', st && !st.lifted, 'lifted 없음', st && { lifted: st.lifted, frac: st.frac, seen: st.seen }, 'src/ui/homeshop.ts stickerMount (가만히 = 정해진 모서리가 살짝 --rest)');
  note(S0, '스티커 모양', st && { W: st.W, H: st.H, corner: st.corner, dir: st.dir, tilt: st.tilt, rest: st.rest, n: st.n, restSeen: st.seen, restFrac: st.frac });
  const lim = st?.lim ?? 0.35;
  const mdrag = async (corner, dx, dy, steps = 10) => {
    const c = await cornerAt(t, corner);
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(c.x + (dx * i) / steps, c.y + (dy * i) / steps); await sleep(25); }
    await page.mouse.up(); await sleep(900);
    return c;
  };
  // ① 왼쪽 위 모서리를 옆(오른쪽)으로 130px: 세로 띠가 접힘 → 앞면은 네모, 왼쪽 두 꼭짓점 x 가 같음
  let logs0 = await stickerLogs(r);
  let c = await mdrag('tl', 130, 0);
  check(S0, '프레임 좌표 확인: 계산한 점이 프레임 안 왼쪽 위 모서리에 닿음', c.hit, true, c, '틀 (iframe 위치를 더함)');
  st = await t.feval(STK);
  await t.shot(P('pc-drag-tl-right'));
  {
    const xs = st.pts.map((p) => p[0]);
    const left = st.pts.filter((p) => p[0] < st.W / 2);
    check(S0, '① 왼쪽 위 → 오른쪽 끌기: 놓은 모양으로 남음', st.lifted, 'lifted', st.lifted, 'src/ui/homeshop.ts peelDragEnd (한도 × PEEL_KEEP 넘으면 keepFold)');
    const ang = foldAngle(st, 130, 0);
    check(S0, '① 끄는 방향대로: 왼쪽 세로 띠가 접힘 (앞면 꼭짓점 4·왼쪽 두 점·왼쪽 x > 20·접는 선이 끈 방향에 거의 수직 ≤10°)', st.pts.length === 4 && left.length === 2 && Math.min(...xs) > 20 && ang !== null && ang <= 10, '세로 띠·≤10°', { pts: st.pts, ang }, 'G-31 「떼는 방향을 조정」 · T1 peek-drag-side (기본 모서리는 가만히 들린 만큼(--rest)에서 이어 끌어 선이 조금 기움: homeshop.ts pointerdown base=restDrag)');
    check(S0, '① 들린 넓이 ≤ 한도', st.frac <= lim + 0.01, `≤ ${lim}`, st.frac, 'G-31 「끝까지 안 떨어짐」 · src/core/hspeel.ts limitDrag');
    check(S0, '① 드러난 글자 > 0 이고 전부는 아님', st.seen > 0 && st.seen < st.n, `0 < 보임 < ${st.n}`, st.seen, 'G-31 「들린 자리만큼만 보이게」');
    check(S0, '① 드러난 글이 숨은 진실의 이어진 조각', pieceOf(st.txt, TRUTH1), '진실의 조각', st.txt, 'G-31');
  }
  let logs1 = await r.until(async () => { const l = await stickerLogs(r); return l.length > logs0.length ? l : null; }, 4000) ?? await stickerLogs(r);
  check(S0, '① 드러난 글이 시청 기록(스티커 줄)에 적힘 · 진실의 조각', logs1.length > logs0.length && pieceOf(logs1.at(-1), TRUTH1), '새 스티커 줄', logs1.slice(logs0.length), 'src/ui/homeshop.ts keepFold → saveLog aside');
  // ② 오른쪽 아래 모서리를 위로 120px: 가로 띠 → 아래 두 꼭짓점 y 같음
  c = await mdrag('br', 0, -120);
  st = await t.feval(STK);
  await t.shot(P('pc-drag-br-up'));
  {
    const ys = st.pts.map((p) => p[1]);
    const low = st.pts.filter((p) => p[1] > st.H / 2);
    const ang = foldAngle(st, 0, -120);
    check(S0, '② 오른쪽 아래 → 위로 끌기: 아래 가로 띠가 접힘 (꼭짓점 4·아래 두 점·아래 y < H-20·접는 선 ⊥ 끈 방향 ≤10°)', st.lifted && st.pts.length === 4 && low.length === 2 && Math.max(...ys) < st.H - 20 && ang !== null && ang <= 10, '가로 띠·≤10°', { pts: st.pts, H: st.H, ang, hit: c.hit }, 'G-31 「떼는 방향을 조정」');
    check(S0, '② 들린 넓이 ≤ 한도', st.frac <= lim + 0.01, `≤ ${lim}`, st.frac, 'G-31');
    check(S0, '② 드러난 글이 숨은 진실의 조각 (보이는 글자 있으면)', st.seen === 0 || pieceOf(st.txt, TRUTH1), '조각', { seen: st.seen, txt: st.txt }, 'G-31');
  }
  // ③ 오른쪽 위 모서리를 대각선으로 멀리(왼쪽 아래로 500px): 한도에서 멈춤, 떨어지지 않음
  c = await mdrag('tr', -500, 500, 16);
  st = await t.feval(STK);
  await t.shot(P('pc-drag-tr-far'));
  check(S0, '③ 멀리 끌어도 들린 넓이 ≤ 한도 (끝까지 안 떨어짐)', st.lifted && st.frac <= lim + 0.01 && st.frac > lim * 0.5, `${lim * 0.5} < frac ≤ ${lim}`, { frac: st.frac, lim, pts: st.pts, hit: c.hit }, 'G-31 「끝까지 안 떨어짐」 · limitDrag');
  check(S0, '③ 드러난 글자 일부만 · 진실의 조각', st.seen > 0 && st.seen < st.n && pieceOf(st.txt, TRUTH1), '일부', { seen: st.seen, n: st.n, txt: st.txt }, 'G-31');
  // ④ 왼쪽 아래 모서리를 아주 조금(6px): 한도의 10% 못 미치면 도로 붙음
  c = await mdrag('bl', 6, -2, 3);
  st = await t.feval(STK);
  check(S0, '④ 조금만 끌면 도로 붙음 (lifted 없음)', !st.lifted, 'lifted 없음', { lifted: st.lifted, frac: st.frac, hit: c.hit }, 'src/ui/homeshop.ts peelDragEnd PEEL_KEEP 0.1 (결정표에 맞는 줄 없음, 코드 근거)');
  // ⑤ 그냥 누르기: 정해진 모서리가 한도까지
  {
    const cc = await cornerAt(t, 'tl');
    await page.mouse.click(cc.x, cc.y);
    await sleep(1200);
    st = await t.feval(STK);
    await t.shot(P('pc-press'));
    check(S0, '⑤ 모서리 누르기: 젖혀짐, 한도 근처까지 (≤ 한도)', st.lifted && st.frac <= lim + 0.01 && st.frac >= lim * 0.7, `${(lim * 0.7).toFixed(3)} ≤ frac ≤ ${lim}`, { frac: st.frac, lim, seen: st.seen }, 'src/ui/homeshop.ts pressPeel → pressDrag (T1 「그냥 누르면 정해진 모서리가 한도까지」)');
  }
  await r.fclickAction('hs-pop', '');
  await sleep(500);

  // ── 지난 부 잠김: 1부 전화로 흥정 조건을 받아 둔 채 다음 부로 넘어가면 그 조건으로 주문 안 됨 ──
  const S1 = 'HS2 PC 지난 부 잠김';
  const wal0 = r.J(await r.vars(), '$st_wallet')?.log?.length ?? 0;
  r.once('hsop', '<operator>\n손전등이요. 말씀하세요.\n</operator>');
  let s = r.lastSeq();
  await r.fclickAction('hs-pop', 'call');
  await r.until(async () => r.since(s, 'hsop').length, 15000);
  await sleep(1500);
  await r.fclickAction('hs-pay', 'talk');
  r.once('hsop', `<operator>\n오만 원이면 드리죠.\n</operator>\n<terms>\nmoney|50000\n</terms>`);
  s = r.lastSeq();
  await t.F().fill('[data-input="hs-op"]', '좀 깎아 주세요.');
  await r.fclickAction('hs-op');
  await r.until(async () => r.since(s, 'hsop').length, 15000);
  await sleep(1500);
  const t1 = await r.ftext('.hs-pop');
  check(S1, '1부 흥정 조건 50,000원 보임 · 주문 단추 켜짐', /50,000/.test(t1) && await t.feval(() => !document.querySelector('[data-action="hs-order"]')?.disabled), '조건·단추', t1.slice(0, 200), 'G-20');
  // 전화 창이 열린 채로 「다음 상품」 (사람 손으로는 창에 가려 못 누르는 단추: 창 뒤 화면을 바꾸는 시험)
  const nx = await r.fclickAction('hs-next');
  await sleep(1200);
  const at1 = r.J(await r.vars(), '$hs_show')?.at;
  const popAfter = await t.feval(() => ({ txt: (document.querySelector('.hs-pop')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 220), orderDis: document.querySelector('[data-action="hs-order"]')?.disabled ?? null }));
  note(S1, '전화 창 연 채 다음 상품 → 지금 부·창', { clicked: nx, at: at1, ...popAfter });
  await t.shot(P('pc-stale-call'));
  // 주문 단추를 억지로 (disabled 를 떼고) 눌러도 1부 조건으로 주문이 들어가면 안 됨
  s = r.lastSeq();
  await t.feval(() => { const b = document.querySelector('[data-action="hs-order"]'); if (b) { b.disabled = false; b.click(); } });
  await sleep(2500);
  const ord1 = r.J(await r.vars(), '$hs_orders') ?? [];
  const wal1 = r.J(await r.vars(), '$st_wallet')?.log?.length ?? 0;
  check(S1, '부가 넘어간 뒤 1부 흥정 조건으로 주문 안 됨 (주문 0·가계부 그대로)', at1 === 1 && ord1.length === 0 && wal1 === wal0, '주문 0', { at: at1, orders: ord1.map((o) => [o.item?.name, o.how]), wallet: [wal0, wal1] }, 'G-19 「지난 부」 · src/ui/homeshop.ts termsFor (통화 pid ≠ 지금 상품 → 조건 없음)');
  await r.fclickAction('hs-pop', '');
  await sleep(500);
  // 편성 줄: 1부 「판매 종료」(잠그기 기본 켬), 1부에 전화 단추 없음
  const lu1 = await t.feval(() => [...document.querySelectorAll('.hs-lu .hs-lc')].map((e) => ({ cls: e.className, txt: e.innerText.replace(/\s+/g, ' '), btn: !!e.querySelector('[data-action]') || e.matches('[data-action]') })));
  check(S1, '지난 1부: 편성 줄 「판매 종료」, 누를 단추 없음', /판매 종료/.test(lu1[0]?.txt ?? '') && !lu1[0]?.btn, '판매 종료', lu1, 'G-19 (잠그기 켬 기본 → 「판매 종료」) · 설정 「지난 부 잠그기」');
  check(S1, '1부(매진 임박·남은 수량만 있음)는 「매진」 아님', !/매진/.test(lu1[0]?.txt ?? ''), '매진 아님', lu1[0]?.txt, 'G-19 「매진은 정말 다 팔린 상품만」');

  // ── 매진: 2부 큐 두 번째 줄 sold 가 나오면 ──
  const S2 = 'HS2 PC 매진';
  const outed = await r.until(async () => r.J(await r.vars(), '$hs_show')?.parts?.[1]?.out, 45000, 500);
  check(S2, '2부 sold 큐가 나온 뒤 그 부에 매진 저장(out)', !!outed, 'parts[1].out', r.J(await r.vars(), '$hs_show')?.parts?.map((p) => ({ n: p.item?.name, out: p.out })), 'G-19 「부마다 저장」 · src/ui/homeshop.ts soldOut');
  await sleep(800);
  await t.shot(P('pc-sold'));
  const callBtn = await t.feval(() => { const b = document.querySelector('.hs-ord [data-action="hs-pop"][data-value="call"]'); return b ? { dis: b.disabled, txt: b.innerText.trim() } : null; });
  check(S2, '매진: 전화 주문 단추 꺼짐 · 「매진」', callBtn?.dis && /매진/.test(callBtn.txt), '꺼짐·매진', callBtn, 'G-19 · src/ui/homeshop.ts onAir');
  const lu2 = await t.feval(() => [...document.querySelectorAll('.hs-lu .hs-lc')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  check(S2, '편성 줄: 2부 「매진」, 1부 「판매 종료」 그대로', /매진/.test(lu2[1] ?? '') && /판매 종료/.test(lu2[0] ?? ''), '1부 판매 종료·2부 매진', lu2, 'G-19');
  // 억지로 전화 창을 열면(단추 disabled 떼고) 「매진되어…」만, 상담원 요청 없음, 주문 단추 없음
  s = r.lastSeq();
  await t.feval(() => { const b = document.querySelector('.hs-ord [data-action="hs-pop"][data-value="call"]'); if (b) { b.disabled = false; b.click(); } });
  await sleep(2000);
  const soldPop = await t.feval(() => ({ txt: (document.querySelector('.hs-pop')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 200), order: !!document.querySelector('[data-action="hs-order"]') }));
  check(S2, '매진 부의 전화 창: 「매진되어 더 이상 주문을 받지 않습니다」·주문 단추 없음·상담원 호출 0', /매진되어/.test(soldPop.txt) && !soldPop.order && r.since(s, 'hsop').length === 0, '막힘', { ...soldPop, hsop: r.since(s, 'hsop').length }, 'G-19 · src/ui/homeshop.ts callPop soldNow');
  await t.feval(() => { const b = document.querySelector('[data-action="hs-order"]'); if (b) { b.disabled = false; b.click(); } });
  await sleep(1500);
  check(S2, '매진 부: 주문 0건 그대로', (r.J(await r.vars(), '$hs_orders') ?? []).length === 0, 0, (r.J(await r.vars(), '$hs_orders') ?? []).length, 'G-19');
  await r.fclickAction('hs-pop', '');
  await sleep(400);
  // 창을 닫았다 카드로 다시 열어도 매진 그대로
  await t.closeWindow();
  await sleep(800);
  r.once('hs', HS_SHOW2);
  s = r.lastSeq();
  await clickChatCard(t, '[data-goei-shop="hs"]');
  await sleep(4000);
  const reqAgain = r.since(s, 'hs').length;
  if (!reqAgain) r.dropOnce('hs');
  const sh2 = r.J(await r.vars(), '$hs_show');
  const cb2 = await t.feval(() => { const b = document.querySelector('.hs-ord [data-action="hs-pop"][data-value="call"]'); return b ? { dis: b.disabled, txt: b.innerText.trim() } : null; });
  check(S2, '닫았다 다시 열어도 2부 매진 그대로 (편성 새로 안 받음)', reqAgain === 0 && sh2?.at === 1 && sh2?.parts?.[1]?.out && cb2?.dis, '매진 그대로', { reqAgain, at: sh2?.at, out: sh2?.parts?.[1]?.out, call: cb2 }, 'G-19 「다시 열어도 매진」(homeshop.ts HsPart.out 주석)');
  await t.shot(P('pc-sold-reopen'));

  // ── 3부로: 지난 부 둘 · 잠그기 끄면 「방송 종료」 ──
  const S3 = 'HS2 PC 지난 부 표시';
  await r.fclickAction('hs-next');
  await sleep(1500);
  let lu3 = await t.feval(() => [...document.querySelectorAll('.hs-lu .hs-lc')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  check(S3, '3부 방송 중: 1부 「판매 종료」·2부 「매진」·3부 「방송 중」', /판매 종료/.test(lu3[0] ?? '') && /매진/.test(lu3[1] ?? '') && !/판매 종료|방송 종료/.test(lu3[1] ?? '') && /방송 중/.test(lu3[2] ?? ''), '판매 종료·매진·방송 중', lu3, 'G-19');
  await r.setVars({ $hs_lock: '0' });
  await t.closeWindow();
  await sleep(600);
  s = r.lastSeq();
  await clickChatCard(t, '[data-goei-shop="hs"]');
  await sleep(3500);
  lu3 = await t.feval(() => [...document.querySelectorAll('.hs-lu .hs-lc')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  check(S3, '잠그기 끔($hs_lock=0): 1부 「방송 종료」, 2부는 「매진」 그대로', /방송 종료/.test(lu3[0] ?? '') && /매진/.test(lu3[1] ?? ''), '방송 종료·매진', { lu: lu3, hsReq: r.since(s, 'hs').length }, 'G-19 「아니면 방송 종료」 · 설정 lock (core/homeshop.ts:301)');
  await t.shot(P('pc-lock-off'));
  await r.setVars({ $hs_lock: '' });

  // ── 맞교환 감정 (3부 벽시계) ──
  const S4 = 'HS2 PC 맞교환';
  r.once('hsop', '<operator>\n벽시계요. 무엇을 내미실 건가요.\n</operator>');
  s = r.lastSeq();
  await r.fclickAction('hs-pop', 'call');
  await r.until(async () => r.since(s, 'hsop').length, 15000);
  await sleep(1200);
  await r.fclickAction('hs-pay', 'barter');
  await sleep(400);
  const pick = await t.feval(() => [...document.querySelectorAll('[data-action="hs-offer"]')].map((b) => ({ id: b.dataset.value, txt: b.innerText.trim() })));
  const apprDis = await t.feval(() => document.querySelector('[data-action="hs-appraise"]')?.disabled ?? null);
  check(S4, '맞교환: 내 물건 둘(손거울·동전)이 고르기에 · 고르기 전 「감정 받기」 꺼짐', pick.some((p) => p.id === 'i_mirror') && pick.some((p) => p.id === 'i_coin') && apprDis === true, '둘·꺼짐', { pick, apprDis }, 'src/ui/homeshop.ts callPop pick · barterItems');
  // (가) 동전만 내밈 → 감정: 돈 2만 + 동전 + 상담원이 모르는 이름(내밀지 않은 손거울)은 버려져야
  await r.fclickAction('hs-offer', 'i_coin');
  r.once('hsop', `<operator>\n동전 하나로는 어림없죠. 이만 원 얹으세요.\n</operator>\n<terms>\nmoney|20000\nitems|녹슨 동전, 금 간 손거울\n</terms>`);
  s = r.lastSeq();
  await r.fclickAction('hs-appraise');
  await r.until(async () => r.since(s, 'hsop').length, 15000);
  await sleep(1500);
  const ra = r.since(s, 'hsop')[0];
  r.save(P('맞교환-감정1-동전'), r.since(s, 'hsop'));
  const ua = ra ? msgsText(ra.body) : '';
  check(S4, '감정 1 요청: 내민 동전 줄이 가고 손거울은 안 감', /녹슨 동전\|/.test(ua) && !/금 간 손거울/.test(ua), '동전만', (/\[내민 물건[^\n]*\n[^\n]*\n?[^\n]*/.exec(ua) || [''])[0], 'G-20 · 지침 HEAD_OFFERED·OFFERED_LINE');
  check(S4, '감정 1 요청: 「주인공이 물건을 내밀었다: 녹슨 동전」', /주인공이 물건을 내밀었다: 녹슨 동전/.test(ua), '있음', '', '지침 CALL_OFFER');
  const terms1 = await r.ftext('.hs-terms');
  check(S4, '감정 1 조건: 20,000원 + 녹슨 동전 (내밀지 않은 손거울은 버림)', /20,000/.test(terms1) && /녹슨 동전/.test(terms1) && !/손거울/.test(terms1), '20,000·동전', terms1, 'src/core/homeshop.ts parseOperator (물건 이름은 내민 물건 가운데서만)');
  // (나) 동전을 빼고 손거울만 → 감정: 손거울만으로 됨
  await r.fclickAction('hs-offer', 'i_coin');
  await r.fclickAction('hs-offer', 'i_mirror');
  r.once('hsop', `<operator>\n손거울… 뒤에 선 것이 늦게 따라오는군요. 그거면 충분합니다.\n</operator>\n<terms>\nitems|금 간 손거울\n</terms>`);
  s = r.lastSeq();
  await t.F().fill('[data-input="hs-op"]', '이건 어때요?');
  await r.fclickAction('hs-appraise');
  await r.until(async () => r.since(s, 'hsop').length, 15000);
  await sleep(1500);
  const rb = r.since(s, 'hsop')[0];
  r.save(P('맞교환-감정2-손거울'), r.since(s, 'hsop'));
  const ub = rb ? msgsText(rb.body) : '';
  check(S4, '감정 2 요청: 손거울 줄(손상됨)과 숨은 효과(truth) 전문이 상담원에게 감', /금 간 손거울\|[^\n]*손상됨/.test(ub) && ub.includes(MIRROR_TRUTH), '손거울·진실', (/[^\n]*금 간 손거울\|[^\n]*\n[^\n]*/.exec(ub) || [''])[0], 'G-20 「내민 물건 숨은 효과까지 읽고」');
  check(S4, '감정 2 요청: 덧붙인 말 「이건 어때요?」·동전은 이번 내민 물건에 없음', /주인공이 물건을 내밀었다: 금 간 손거울\) 이건 어때요\?/.test(ub) && !/녹슨 동전\|/.test(ub), '있음·동전 없음', (/\[내민 물건[^\n]*\n[^\n]*/.exec(ub) || [''])[0], '지침 CALL_OFFER · homeshop.ts operatorAsk');
  const terms2 = await r.ftext('.hs-terms');
  const ordDis = await t.feval(() => document.querySelector('[data-action="hs-order"]')?.disabled ?? null);
  check(S4, '감정 2 조건: 금 간 손거울만 (돈 없음) · 주문 단추 켜짐', /금 간 손거울/.test(terms2) && !/\d[\d,]*\s*원/.test(terms2) && ordDis === false, '손거울만·켜짐', { terms2, ordDis }, 'G-20');
  await t.shot(P('pc-barter-terms'));
  // 주문
  const walB = r.J(await r.vars(), '$st_wallet')?.log?.length ?? 0;
  r.once('hsop', '<operator>\n거래 성립. 상자는 이미 곁에 있습니다.\n</operator>');
  s = r.lastSeq();
  await r.fclickAction('hs-order');
  await sleep(3500);
  r.save(P('맞교환-주문뒤말'), r.since(s, 'hsop'));
  const vB = await r.vars();
  const oB = (r.J(vB, '$hs_orders') ?? []).find((o) => o.item?.name === '세 번 우는 벽시계');
  const listB = r.J(vB, '$st_items')?.list ?? [];
  const live = (x) => !x.soldAt && !x.outAt && !x.gone;
  check(S4, '맞교환 주문 성립: pay barter · 치른 것 「금 간 손거울」', oB?.pay === 'barter' && /금 간 손거울/.test(oB?.how ?? ''), 'barter·손거울', oB && { pay: oB.pay, how: oB.how, terms: oB.terms }, 'G-20');
  check(S4, '내민 손거울은 소지품에서 빠지고 동전은 남음', !listB.some((x) => x.id === 'i_mirror' && live(x)) && listB.some((x) => x.id === 'i_coin' && live(x)), '손거울 빠짐·동전 남음', listB.map((x) => ({ id: x.id, name: x.name, soldAt: x.soldAt ?? '', outAt: x.outAt ?? '' })), 'src/ui/homeshop.ts order (terms.items → sellItem)');
  check(S4, '주문하자마자 미개봉 택배 상자(벽시계)', listB.some((x) => live(x) && /택배 상자/.test(x.name) && /벽시계/.test(x.name)), '상자', listB.filter(live).map((x) => x.name), 'G-29');
  check(S4, '돈 안 냄: 가계부 줄 그대로', (r.J(vB, '$st_wallet')?.log?.length ?? 0) === walB, walB, r.J(vB, '$st_wallet')?.log?.length, 'G-20');
  const popB = await r.ftext('.hs-pop');
  check(S4, '주문 뒤 상담원 마지막 말이 창에', /거래 성립/.test(popB), '거래 성립', popB.slice(0, 200), 'src/ui/homeshop.ts operatorSay order');
  await t.shot(P('pc-barter-done'));
  // 상자 칸에서 맞교환 상자는 다음 맞교환 고르기에 안 나옴
  await r.fclickAction('hs-pop', '');
  await sleep(500);
  const cbB = await t.feval(() => { const b = document.querySelector('.hs-ord [data-action="hs-pop"][data-value="call"]'); return b ? { dis: b.disabled, txt: b.innerText.trim() } : null; });
  check(S4, '주문 뒤 전화 단추: 「주문 완료」로 꺼짐', cbB?.dis && /주문 완료/.test(cbB.txt), '주문 완료', cbB, 'src/ui/homeshop.ts onAir (ordered)');
  await t.closeWindow();
  // 다음 본편: ARRIVE 한 번, 판 것(맞교환)·통화 내용
  r.once('main', `발치에 상자 하나가 놓여 있었다. 손거울은 어디에도 없었다.\n\n${r.status()}`);
  s = r.lastSeq();
  await t.send('주위를 둘러본다.');
  await sleep(4500);
  const mr = r.since(s, 'main')[0];
  r.save(P('맞교환-본편'), r.since(s, 'main'));
  const mt = mr ? msgsText(mr.body) : '';
  check(S4, '주문 턴 본편: ARRIVE 한 번', (mt.match(/phone order has reached the protagonist/g) || []).length === 1, 1, (mt.match(/phone order has reached the protagonist/g) || []).length, 'G-29');
  check(S4, '주문 턴 본편: 손거울 감정 통화(내민 말·상담원 말)가 넘어감', /주인공이 물건을 내밀었다: 금 간 손거울/.test(mt) || /뒤에 선 것이 늦게 따라오는군요/.test(mt), '통화', (/[^\n]{0,80}(금 간 손거울|늦게 따라오는군요)[^\n]{0,80}/.exec(mt) || [''])[0], 'G-24 (상담원 통화 내용은 다음 본편에)');
  note(S4, '주문 턴 본편: 손거울·맞교환 언급 줄', (mt.match(/[^\n]{0,100}(손거울|맞교환)[^\n]{0,100}/g) || []).slice(0, 6));
  check(S4, '주문 턴 본편: 벽시계 숨은 진실 전문 안 감', !/네 번째 울음을 세면 따라간다/.test(mt), '없음', '', 'G-21');
  // 상자 열기 → 벽시계
  await t.openWindow(); await sleep(1000);
  if (!(await t.feval(() => !!document.querySelector('[data-action="items-open"]')))) await r.fclickAction('nav-tab', 'items');
  await sleep(600);
  const box = (r.J(await r.vars(), '$st_items')?.list ?? []).find((x) => live(x) && /택배 상자/.test(x.name) && /벽시계/.test(x.name));
  if (box) { await r.fclickAction('items-open', box.id); await sleep(500); }
  const opened = await r.fclickAction('hs-box-open');
  await sleep(1200);
  const listC = (r.J(await r.vars(), '$st_items')?.list ?? []).filter(live);
  const clock = listC.find((x) => x.name === '세 번 우는 벽시계');
  check(S4, '상자 열기 → 벽시계 들어오고 상자 빠짐 · 치른 것 손거울', opened && !!clock && !listC.some((x) => /택배 상자/.test(x.name)) && /손거울/.test(clock?.paidWith ?? ''), '벽시계', listC.map((x) => ({ n: x.name, paid: x.paidWith ?? '' })), 'G-23');
  await t.shot(P('pc-box-opened'));
  r.writeResults(`${OUT}결과-hs2-pc${TAG ? `-${TAG}` : ''}.json`);
  all.push(...r.results.map((x) => ({ ...x, run: 'pc' })));
  await r.stop();
  await t.close();
}

// ═════════════════════ 폰: 터치 끌기 (CDP) ═════════════════════
async function phone(all) {
  const r = await openRun({ out: OUT, fake: process.env.FAKE_URL, width: 344, height: 882, touch: true, dsf: 2 });
  const { t, check, note } = r;
  const S0 = 'HS2 폰 스티커(터치)';
  await openHs(r, S0);
  const cdp = await t.page.context().newCDPSession(t.page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
  const tdrag = async (corner, dx, dy, steps = 10) => {
    const c = await cornerAt(t, corner);
    await touch('touchStart', c.x, c.y);
    for (let i = 1; i <= steps; i++) { await sleep(30); await touch('touchMove', c.x + (dx * i) / steps, c.y + (dy * i) / steps); }
    await sleep(30);
    await touch('touchEnd');
    await sleep(900);
    return c;
  };
  await r.fclickAction('hs-pop', 'peek');
  await sleep(900);
  let st = await t.feval(STK);
  await t.shot(P('phone-peek'));
  check(S0, '폰: 모서리 넷 · 바닥 글 = 진실 전체 · 한도 15~35% · 가만히 안 들림', st?.corners === 4 && norm(st?.all ?? '') === norm(TRUTH1) && st.lim >= 0.15 && st.lim <= 0.35 && !st.lifted, '넷·전체·한도·안 들림', st && { corners: st.corners, all: st.all, lim: st.lim, lifted: st.lifted, W: st.W, H: st.H }, 'G-31');
  const hint = await r.ftext('.hs-peelhint');
  note(S0, '폰 안내 글', hint);
  const lim = st?.lim ?? 0.35;
  // ① 왼쪽 위 모서리를 터치로 오른쪽 110px
  let logs0 = await stickerLogs(r);
  let c = await tdrag('tl', 110, 0);
  check(S0, '프레임 좌표 확인: 계산한 점이 왼쪽 위 모서리에 닿음', c.hit, true, c, '틀');
  st = await t.feval(STK);
  await t.shot(P('phone-touch-tl-right'));
  {
    const left = st.pts.filter((p) => p[0] < st.W / 2);
    const ang = foldAngle(st, 110, 0);
    check(S0, '① 터치 끌기 왼쪽 위 → 오른쪽: 남음 · 왼쪽 세로 띠 (꼭짓점 4·x > 20·접는 선 ⊥ 끈 방향 ≤10°)', st.lifted && st.pts.length === 4 && left.length === 2 && Math.min(...st.pts.map((p) => p[0])) > 20 && ang !== null && ang <= 10, '세로 띠', { lifted: st.lifted, pts: st.pts, ang }, 'G-31 「떼는 방향을 조정」');
    check(S0, '① 들린 넓이 ≤ 한도 · 드러난 글 일부 · 진실의 조각', st.frac <= lim + 0.01 && st.seen > 0 && st.seen < st.n && pieceOf(st.txt, TRUTH1), '한도 안·조각', { frac: st.frac, lim, seen: st.seen, n: st.n, txt: st.txt }, 'G-31');
  }
  const logs1 = await r.until(async () => { const l = await stickerLogs(r); return l.length > logs0.length ? l : null; }, 4000) ?? await stickerLogs(r);
  check(S0, '① 드러난 글이 시청 기록에 · 진실의 조각', logs1.length > logs0.length && pieceOf(logs1.at(-1), TRUTH1), '새 줄', logs1.slice(logs0.length), 'keepFold');
  // ② 오른쪽 아래를 터치로 위로 100px
  c = await tdrag('br', 0, -100);
  st = await t.feval(STK);
  await t.shot(P('phone-touch-br-up'));
  {
    const low = st.pts.filter((p) => p[1] > st.H / 2);
    const ang = foldAngle(st, 0, -100);
    check(S0, '② 터치 끌기 오른쪽 아래 → 위: 아래 가로 띠 (y < H-20·접는 선 ⊥ 끈 방향 ≤10°) · 한도 안', st.lifted && st.pts.length === 4 && low.length === 2 && Math.max(...st.pts.map((p) => p[1])) < st.H - 20 && ang !== null && ang <= 10 && st.frac <= lim + 0.01, '가로 띠', { pts: st.pts, H: st.H, ang, frac: st.frac, hit: c.hit }, 'G-31');
  }
  // ③ 오른쪽 위를 터치로 멀리 대각선
  c = await tdrag('tr', -400, 500, 16);
  st = await t.feval(STK);
  await t.shot(P('phone-touch-tr-far'));
  check(S0, '③ 터치로 멀리 끌어도 ≤ 한도 · 일부만 · 진실의 조각', st.lifted && st.frac <= lim + 0.01 && st.frac > lim * 0.5 && st.seen < st.n && pieceOf(st.txt, TRUTH1), '한도 안', { frac: st.frac, lim, seen: st.seen, txt: st.txt, hit: c.hit }, 'G-31 「끝까지 안 떨어짐」');
  // ④ 쪽 스크롤이 끌기 때문에 밀리지 않았나 (touch-action:none)
  const scr = await t.feval(() => ({ y: (document.querySelector('.hs-pop .pb, .hs-pop')?.scrollTop ?? 0), win: window.scrollY }));
  note(S0, '터치 끌기 뒤 창 스크롤', scr);
  // ⑤ 스티커 몸통 톡 (폰: 어디를 눌러도 젖혀짐) — 이미 접혀 있으면 그대로라, 창을 닫았다 다시 열어 가만한 상태에서
  await r.fclickAction('hs-pop', '');
  await sleep(400);
  await r.fclickAction('hs-pop', 'peek');
  await sleep(900);
  st = await t.feval(STK);
  check(S0, '창 다시 열면 접힘 풀린 가만한 모양', !st.lifted, 'lifted 없음', { lifted: st.lifted, frac: st.frac }, 'src/ui/homeshop.ts hs-pop (ui.fold = null)');
  const bb = await t.F().locator('.hs-sticker .face').boundingBox();
  await touch('touchStart', bb.x + bb.width / 2, bb.y + bb.height / 2);
  await sleep(60);
  await touch('touchEnd');
  await sleep(1300);
  st = await t.feval(STK);
  await t.shot(P('phone-tap-body'));
  check(S0, '⑤ 폰: 스티커 몸통 톡 → 정해진 모서리가 한도 근처까지', st.lifted && st.frac <= lim + 0.01 && st.frac >= lim * 0.7, `${(lim * 0.7).toFixed(3)}~${lim}`, { lifted: st.lifted, frac: st.frac, corner: st.corner, seen: st.seen }, 'src/ui/homeshop.ts stickerMount (isPhone → 스티커 click → pressPeel)');
  r.writeResults(`${OUT}결과-hs2-phone${TAG ? `-${TAG}` : ''}.json`);
  all.push(...r.results.map((x) => ({ ...x, run: 'phone' })));
  await r.stop();
  await t.close();
}

const all = [];
if (on('pc')) await pc(all).catch((e) => { console.log('PC 판 멈춤', e); all.push({ step: 'HS2 PC', what: '대본 멈춤', ok: false, expect: '끝까지', actual: String(e?.stack ?? e).slice(0, 600), run: 'pc' }); });
if (on('phone')) await phone(all).catch((e) => { console.log('폰 판 멈춤', e); all.push({ step: 'HS2 폰', what: '대본 멈춤', ok: false, expect: '끝까지', actual: String(e?.stack ?? e).slice(0, 600), run: 'phone' }); });
const pass = all.filter((x) => !x.note && x.ok).length, n = all.filter((x) => !x.note).length;
const file = `${OUT}결과-hs2${TAG ? `-${TAG}` : ''}.json`;
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), runs: [...want].join(',') || 'pc,phone', pass, all: n, results: all }, null, 1));
console.log(`합계 ${pass}/${n} → ${file}`);
process.exit(0);
