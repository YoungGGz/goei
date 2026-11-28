// A·B·C 구간 점검 공용: make-states.mjs 의 요청 읽기·답 짓기를 그대로 옮기고(내용 같음), 한 턴 돌리기를 t 를 받게 바꿈.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const HERE = fileURLToPath(new URL('.', import.meta.url));
export const OUT = HERE + 'out';
mkdirSync(OUT, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const redact = (s) => String(s).replace(/(Age:)(?! \[생략\])[^\\"\n]*/g, '$1 [생략]');
// ── 요청 글 읽기 ─────────────────────────────
export const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text ?? '').join('') : JSON.stringify(c));
export function readRequest(body) {
  const msgs = body.messages ?? [];
  const all = msgs.map((m) => text(m.content));
  const lore = all.find((c) => c.includes('## Status')) ?? '';
  const fields = (lore.match(/Fields in order: (.+?)\. Never/) ?? [])[1]?.split('|').map((s) => s.trim()) ?? [];
  const fmt = (lore.match(/## Status\n(\[▣\|[^\n]*\])/) ?? [])[1] ?? '';
  const prevBlock = [...all].reverse().find((c) => c.startsWith('[Previous status]')) ?? '';
  const prevLine = (prevBlock.match(/\[▣\|[^\n]*\]/) ?? [])[0] ?? '';
  const start = {};
  for (const m of prevBlock.matchAll(/(Balance|Points) = (\d+)/g)) start[m[1]] = m[2];
  // World Entries 칸의 줄 (NEW 자리표 줄과 이미 있는 줄)
  const we0 = lore.indexOf('### World Entries'), we1 = lore.indexOf('#### Mandatory');
  const weText = we0 >= 0 ? lore.slice(we0, we1 > we0 ? we1 : undefined) : '';
  const entries = [...weText.matchAll(/^(NEW )?(\[(AN|IN|MS|AG)\|[^\]\n]*\])/gm)].map((m) => ({ isNew: !!m[1], tag: m[2], kind: m[3] }));
  const inventory = all.find((c) => c.startsWith('[Inventory]'))?.split('\n')[0] ?? null;
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
  return { lore, fields, fmt, prevLine, start, entries, inventory, nMsgs: msgs.length, lastUser: lastUser ? text(lastUser.content).slice(0, 400) : '', hasSeed: all.some((c) => /order 399|%%GOEI_SEED|Seed/i.test(c)), shopTagRule: all.some((c) => c.includes('[shop:')) };
}

// ── 답 짓기 (지침 꼴) ─────────────────────────
export const FILL = {
  AN: { '<등급>': 'D', '<배치>': '없음', '<상황>': '이상 징후 신고가 들어왔지만 아직 대응 인원은 없다' },
  IN: { '<배치>': '없음', '<상황>': '대형 추돌 사고로 도로가 통제되고 구급차가 몰려들고 있다' },
  MS: { '<방문자>': '없음', '<상황>': '문을 열어 둔 채 조용히 손님을 기다리고 있다' },
  AG: { '<상태>': '내근', '<상황>': '본부 사무실에서 평소 업무를 보고 있다' },
};
// 무작위 괴이·사건의 <발생지점> 은 모델이 이름을 짓는 칸이다. 대본은 이름을 지어내지 않고 위키에 있는 이름 가운데 요청 글에 아직 없는 것을 쓴다
export const PICK = { AN: ['명일 아파트', '소라 랜드', '금지된 비디오', '미술관', '강변', '인스피레이션 호텔'], IN: ['중림 지하상가', '기독교 상점', '관리국 본부'] };
export function worldTags(entries, loreText = '') {
  const used = new Set();
  return entries.map((e) => {
    let t = e.tag;
    if (t.includes('<발생지점>') && PICK[e.kind]) {
      const name = PICK[e.kind].find((n) => !loreText.includes(n) && !used.has(n)) ?? PICK[e.kind][0];
      used.add(name);
      t = t.replace('<발생지점>', name);
    }
    for (const [k, v] of Object.entries(FILL[e.kind] ?? {})) t = t.replaceAll(k, v);
    // 커스텀 임무로 고른 대상은 지역이 자리표로 온다(<발생 지역: 시도와 시군구>) — 실제 행정구역 하나로 채운다
    t = t.replace(/<발생 지역[^>|\]]*>/g, '서울특별시 강서구');
    return t.replace(/<[^>|\]]*>/g, '없음');
  });
}
const pad = (n) => String(n).padStart(2, '0');
export function advance(date, time, mins) {
  // time 'HH:MM AM/PM'
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return { date, time };
  let h = Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  let t = h * 60 + Number(m[2]) + mins;
  t %= 24 * 60;
  h = Math.floor(t / 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { date, time: `${pad(h12)}:${pad(t % 60)} ${ap}` };
}
export function statusLine(req, s) {
  const prev = req.prevLine ? req.prevLine.slice(1, -1).split('|').slice(1) : null;
  const pv = (label) => (prev ? prev[req.fields.indexOf(label)] : undefined);
  const dt = prev ? advance(pv('날짜') ?? s.date, pv('시각') ?? s.time, 20) : { date: s.date, time: s.time };
  const val = {
    날짜: dt.date, 시각: dt.time, 날씨: s.weather ?? '☀️', 기온: s.temp ?? '12°C', 위치: s.place, 목표: s.target ?? '없음', 동행: s.companions ?? '없음', 투입: s.deployed ?? '없음', 신분: s.identity,
    잔고: s.balance ?? pv('잔고') ?? req.start.Balance ?? '0',
    포인트: s.points ?? pv('포인트') ?? req.start.Points ?? '0',
  };
  return `[▣|${req.fields.map((f) => val[f] ?? pv(f) ?? '없음').join('|')}]`;
}
export function buildReply(req, turn) {
  const parts = [turn.prose.trim(), '', ...worldTags(req.entries, req.lore)];
  if (turn.shop) parts.push(`[shop: ${turn.shop}]`);
  parts.push(statusLine(req, turn.status));
  return parts.join('\n');
}

// ── 줄기 대본 (장소·인물 이름은 카드/wiki-base.json 과 명부에 있는 것만) ──
const D = '2025.03.14';
export const FLOWS = {
  가: {
    title: '특수재난관리국 · 인물 장면(면접)', start: { fac: 'A00', player: '', scene: '면접' },
    turns: [
      { user: '쟈알디의 시선을 피하지 않고 의자에 바로 앉아 대답할 준비를 한다.',
        prose: '쟈알디는 장갑 낀 손가락으로 책상을 한 번 두드렸다.\n\n<img=Jyaldi_serious>\n\n"좋다. 도망치지 않는 눈이군. 첫 질문이다. 거기서 나올 때, 무엇을 버리고 나왔지?"\n\n면담실의 공기는 여전히 무거웠다. 질문은 짧았지만, 대답이 쉽지 않다는 것을 둘 다 알고 있었다.',
        status: { date: D, time: '09:20 AM', place: '서울 종로구 관리국 본부 면담실', companions: '쟈알디', identity: '관리국/신입' } },
      { user: '어젯밤 그곳을 빠져나온 과정을 차분하게 처음부터 설명한다.',
        prose: '이야기가 끝날 때까지 쟈알디는 한 번도 끼어들지 않았다.\n\n<img=Jyaldi_thinking>\n\n"보고서와 다르지 않군. 거짓말을 할 줄 모르거나, 아주 잘하거나."\n\n그녀가 서류에 무언가를 적었다. 펜 끝이 멈춘 자리에는 짧은 한 단어가 남았다.\n\n"합격이다. 아래층에서 잼트리가 기다린다."',
        status: { place: '서울 종로구 관리국 본부 면담실', companions: '쟈알디', identity: '관리국/신입' } },
      { user: '면담실을 나와 엘리베이터를 타고 로비로 내려가 잼트리를 찾는다.',
        prose: '로비 소파에서 잼트리가 손을 흔들었다.\n\n<img=Jaemtri_smile>\n\n"축하해, 후배. 표정 보니까 붙었구나? 이건 임시 출입증이야. 잃어버리면 선배가 혼나니까 꼭 챙겨."\n\n그녀는 하얀 카드를 건네고는 손목시계를 보았다.\n\n"오늘은 이만 퇴근해도 돼. 내일부터 바빠질 거야."',
        status: { place: '서울 종로구 관리국 본부 로비', companions: '잼트리', identity: '관리국/신입' } },
    ],
    shopTurn: { user: '퇴근길에 서대문구 골목의 기독교 상점에 들어가 본다.',
      prose: '작은 종이 딸랑 울렸다. 십자가와 묵주가 빼곡한 진열대 너머에서 금발의 수녀가 고개를 들었다.\n\n<img=Blaret_smile>\n\n"어서 오세요. 기독교 상점입니다. 찾으시는 물건이 있으면 편하게 말씀하세요."\n\n블라렛은 상냥하게 웃었지만, 초록색 눈은 손님의 손과 발끝을 차례로 훑고 있었다.',
      shop: '기독교 상점|블라렛',
      status: { place: '서울 서대문구 기독교 상점', companions: '없음', identity: '관리국/신입' } },
  },
  나: {
    title: '백일몽 주식회사 · 직접 입력', start: { fac: 'C00', player: '', scene: '직접 입력', situation: '백일몽 본사, 개발부 현장탐사팀으로 첫 출근한 날 아침. 사원증을 받고 팀 사무실로 간다.' },
    turns: [
      { user: null,
        prose: '강남의 사옥 로비는 제약회사답게 하얗고 조용했다. 출입 게이트 앞에서 금빛 청둥오리 가면을 손에 든 여자가 기다리고 있었다.\n\n<img=Baek Seok-ju_smile>\n\n"신입이지? 백석주 과장이야. 사원증 여기. 목에 걸고, 잃어버리면 다시 들어오기 힘들어."\n\n건네받은 사원증에는 아직 잉크 냄새가 남아 있었다.',
        status: { date: D, time: '08:40 AM', place: '서울 강남구 백일몽 본사 로비', companions: '백석주', identity: '백일몽/사원' } },
      { user: '백석주 과장을 따라 개발부 현장탐사팀 사무실로 올라간다.',
        prose: '사무실 창가 자리에서 외알 안경을 쓴 여자가 모니터에서 눈을 떼지 않은 채 손만 들었다.\n\n<img=Jin Na-sol_indifferent>\n\n"진나솔 대리예요. 입사 축하 복지 포인트 5,000 포인트 들어갔을 거예요. 확인해 봐요."\n\n백석주가 빈 책상 하나를 가리켰다. "오늘부터 저기가 네 자리야."',
        status: { place: '서울 강남구 백일몽 본사 개발부 현장탐사팀 사무실', companions: '백석주,진나솔', identity: '백일몽/사원', points: '5000' } },
      { user: '자리에 앉아 사내 복지몰 안내문을 천천히 읽어 본다.',
        prose: '안내문은 생각보다 두꺼웠다. 복지 포인트는 현금으로 바꿀 수 없고, 복지몰에서만 쓸 수 있다는 문장이 굵게 적혀 있었다.\n\n<img=Jin Na-sol_smirk>\n\n"그거 끝까지 읽는 사람 처음 보네요." 진나솔이 작게 중얼거렸다.\n\n창밖으로 점심시간을 알리는 음악이 희미하게 들려왔다.',
        status: { place: '서울 강남구 백일몽 본사 개발부 현장탐사팀 사무실', companions: '진나솔', identity: '백일몽/사원' } },
    ],
  },
  다: {
    title: '프리랜서 · 커스텀 임무(룩키마트)', start: { fac: 'E00', player: '', scene: '커스텀 임무', mission: 'an:룩키마트' },
    turns: [
      { user: null,
        prose: '협회 의뢰서에 적힌 주소에는 2000년대 중반에 멈춘 듯한 할인마트가 서 있었다. 간판의 LOOKYMART 철자가 형광등 아래에서 흐릿하게 깜빡였다.\n\n자동문은 손님을 기다렸다는 듯 열려 있었다. 안쪽에서 오래된 안내 방송 음악이 끊어질 듯 이어졌다.\n\n의뢰 조건은 하나였다. 실종자의 흔적을 찾고, 해가 지기 전에 나올 것.',
        status: { date: D, time: '03:10 PM', place: '룩키마트 정문 앞', target: '룩키마트', companions: '없음', deployed: '없음', identity: '프리랜서/5급' } },
      { user: '마트 안으로 들어가 1층 진열대를 하나씩 살핀다.',
        prose: '진열대의 상품은 모두 유통기한이 같은 날짜였다. 카트 한 대가 아무도 밀지 않았는데 천천히 통로 끝으로 굴러갔다.\n\n천장의 층 안내판에는 지하 1층부터 3층까지 적혀 있었고, 그 위에 누군가 매직으로 4라는 숫자를 덧그려 놓았다.',
        status: { place: '룩키마트 1층 식품 코너', target: '룩키마트', companions: '없음', deployed: '투입', identity: '프리랜서/5급' } },
      { user: '계산대 쪽에서 들려오는 안내 방송에 귀를 기울인다.',
        prose: '"고객 여러분께 알려 드립니다. 4층 특별 할인 행사가 곧 시작됩니다."\n\n방송은 같은 문장을 세 번 되풀이하고 뚝 끊겼다. 계산대에는 아무도 없었지만, 영수증 한 장이 막 뽑혀 나온 듯 말려 올라가 있었다.\n\n영수증 맨 아래에는 오늘 날짜와 함께 실종자의 이름이 찍혀 있었다.',
        status: { place: '룩키마트 1층 계산대', target: '룩키마트', companions: '없음', deployed: '투입', identity: '프리랜서/5급' } },
    ],
  },
  라: {
    title: '캐릭터(요원)로 플레이 · 관리국 에일린 · 직접 입력', start: { fac: 'A00', player: 'P004', scene: '직접 입력', situation: '관리국 본부 사무실, 아침 브리핑 전. 커피를 들고 자리에 앉는다.' },
    turns: [
      { user: null,
        prose: '사무실에는 아직 사람이 드물었다. 탕비실에서 내려 온 커피가 손바닥을 데웠다.\n\n문이 열리고 쟈알디가 들어왔다. 검은 장갑을 벗으며 곧장 자리로 향하던 그녀가 걸음을 멈췄다.\n\n<img=Jyaldi_default>\n\n"일찍 왔군. 브리핑은 십 분 뒤다. 그 전에 커피 한 잔 더 마셔 둬. 오늘은 길어질 거다."',
        status: { date: D, time: '08:50 AM', place: '서울 종로구 관리국 본부 사무실', companions: '쟈알디', identity: '관리국/선임 요원' } },
      { user: '쟈알디에게 오늘 일정이 어떻게 되는지 묻는다.',
        prose: '<img=Jyaldi_thinking>\n\n"오전엔 보고서 정리, 오후엔 신규 신고 확인."\n\n쟈알디는 모니터를 켜며 짧게 덧붙였다.\n\n"신고 중에 냄새가 나는 게 하나 있다. 확인되면 바로 나간다. 장비는 미리 챙겨 둬."',
        status: { place: '서울 종로구 관리국 본부 사무실', companions: '쟈알디', identity: '관리국/선임 요원' } },
      { user: '브리핑 자료를 받아 들고 한 장씩 훑어본다.',
        prose: '자료는 얇았다. 사진 몇 장과 목격자 진술 두 줄. 그중 한 장의 사진 구석에 같은 그림자가 세 번 찍혀 있었다.\n\n<img=Jyaldi_serious>\n\n"봤나. 그게 냄새다." 쟈알디가 말했다. "점심 먹고 출발한다."',
        status: { place: '서울 종로구 관리국 본부 사무실', companions: '쟈알디', identity: '관리국/선임 요원' } },
    ],
  },
};
export const reqText = (body) => (body.messages ?? []).map((m, i) => `===== [${i}] ${m.role} (${text(m.content).length}자)\n${text(m.content)}`).join('\n\n');
export async function quietAux(t, ms = 4000, max = 90000) {
  const end = Date.now() + max;
  let last = await t.fakeSeq(), since = Date.now();
  while (Date.now() < end) {
    await sleep(700);
    const pend = await t.fake('pending');
    const s = await t.fakeSeq();
    if (s !== last) { last = s; since = Date.now(); continue; }
    if (!pend.length && Date.now() - since >= ms) return true;
  }
  return false;
}
/** 대본 규칙: 본편은 hold+replyFile, 보조는 Router/Director 빈 목록·그 밖 '{}' (0단계와 같음) */
export const REPLY_FILE = OUT + '/reply-now.txt';
export const baseRules = () => [
  { id: 'main-hold', route: 'main', hold: true, replyFile: REPLY_FILE },
  { id: 'aux-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
  { id: 'aux-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
  { id: 'aux', route: 'aux', reply: '{}' },
];
/** 한 턴: 보내기(sendFn) → 붙잡힌 본편 요청 → 답(tdef 또는 replyFn(req)) → 풀기 → 답·보조 끝날 때까지 */
export async function turn(t, tdef, sendFn, { replyFn, wait = true } = {}) {
  writeFileSync(REPLY_FILE, '(아직 답 안 지음)');
  const seq0 = await t.fakeSeq();
  if (sendFn) await sendFn(); else await t.send(tdef.user, { wait: false });
  let rec = null;
  const end = Date.now() + 120000;
  while (Date.now() < end && !rec) {
    await sleep(400);
    const log = await t.fakeLog(seq0, 'main');
    rec = log.find((x) => x.action === 'hold' && !x.response) ?? null;
  }
  if (!rec) throw new Error('본편 요청이 안 옴');
  const req = readRequest(rec.body);
  const reply = replyFn ? replyFn(req, rec) : buildReply(req, tdef);
  writeFileSync(REPLY_FILE, reply);
  await t.fake('release', { seq: rec.seq });
  if (wait) { await t.waitBusy(5000).catch(() => {}); await t.waitIdle(); await quietAux(t); }
  return { rec, req, reply };
}
