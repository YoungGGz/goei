// 3차 점검 0번 몫: A~C 대표 줄기를 실제 리스AI 단추로 한 번 돌아 구간별 시작 상태 파일을 만든다 (2026-11-24).
// 사용: FAKE_URL=http://<IP>:<port> node make-states.mjs [--only 가,나,다,라] [--states <dir>]
//   가짜 서버는 이 일 전용으로 따로 띄운다: node fake-llm.mjs --port 8795 --log out/s0/fake-s0.jsonl
//   (이 스크립트가 시작할 때 그 서버 기록을 비우고 규칙을 통째로 바꾼다 — 다른 스레드가 쓰는 서버에 대지 않는다)
// 대본: 본편은 hold+replyFile 로 붙잡고, 들어온 요청 글(상황판 World Entries·[Previous status]·상태창 칸)을 읽어
//   지침 꼴(지침/상태창_태그.txt·메인요청_덧붙임.txt)대로 답을 지어 넣은 뒤 푼다. 보조는 Router {selected:[]}·Director {notes:[]}·그 밖 '{}'.
// 결과: states/<이름>.json (리스AI 채팅 내보내기 + t2 칸), states/first-requests/<줄기>.json·.txt (첫 본편 요청 전문),
//   out/s0/make-<시각>.json (턴마다 요청 요약·답·상태·화면·콘솔).
import { openT2 } from './risu-t2.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = (opt('--only', '가,나,다,라')).split(',');
const STATES = opt('--states', HERE + 'states');
const OUT = HERE + 'out/s0';
const FR = STATES + '/first-requests';
// 요청 전문을 저장소에 남길 때 카드 로어의 나이 줄 값은 지운다 (사용자 결정: 인물 나이 언급 금지)
const redact = (s) => String(s).replace(/(Age:)(?! \[생략\])[^\\"\n]*/g, '$1 [생략]');
mkdirSync(FR, { recursive: true }); mkdirSync(OUT, { recursive: true });
const REPLY_FILE = OUT + '/reply-now.txt';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLUGIN_VER = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8')).version;
let RISU_COMMIT = 'unknown';
try { RISU_COMMIT = execSync(`git -C ${process.env.RISU_DIR || '/tmp/t2/risu-src'} rev-parse HEAD`).toString().trim(); } catch {}
let GOEI_COMMIT = 'unknown';
try { GOEI_COMMIT = execSync(`git -C ${decodeURIComponent(new URL('../../../../', import.meta.url).pathname)} rev-parse --short HEAD`).toString().trim(); } catch {}

// ── 요청 글 읽기 ─────────────────────────────
const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text ?? '').join('') : JSON.stringify(c));
function readRequest(body) {
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
const FILL = {
  AN: { '<등급>': 'D', '<배치>': '없음', '<상황>': '이상 징후 신고가 들어왔지만 아직 대응 인원은 없다' },
  IN: { '<배치>': '없음', '<상황>': '대형 추돌 사고로 도로가 통제되고 구급차가 몰려들고 있다' },
  MS: { '<방문자>': '없음', '<상황>': '문을 열어 둔 채 조용히 손님을 기다리고 있다' },
  AG: { '<상태>': '내근', '<상황>': '본부 사무실에서 평소 업무를 보고 있다' },
};
// 무작위 괴이·사건의 <발생지점> 은 모델이 이름을 짓는 칸이다. 대본은 이름을 지어내지 않고 위키에 있는 이름 가운데 요청 글에 아직 없는 것을 쓴다
const PICK = { AN: ['명일 아파트', '소라 랜드', '금지된 비디오', '미술관', '강변', '인스피레이션 호텔'], IN: ['중림 지하상가', '기독교 상점', '관리국 본부'] };
function worldTags(entries, loreText = '') {
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
function advance(date, time, mins) {
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
function statusLine(req, s) {
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
function buildReply(req, turn) {
  const parts = [turn.prose.trim(), '', ...worldTags(req.entries, req.lore)];
  if (turn.shop) parts.push(`[shop: ${turn.shop}]`);
  parts.push(statusLine(req, turn.status));
  return parts.join('\n');
}

// ── 줄기 대본 (장소·인물 이름은 카드/wiki-base.json 과 명부에 있는 것만) ──
const D = '2025.03.14';
const FLOWS = {
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

// ── 돌리기 ─────────────────────────────
const run = { at: new Date().toISOString(), plugin: PLUGIN_VER, goeiCommit: GOEI_COMMIT, risuCommit: RISU_COMMIT, fake: process.env.FAKE_URL, flows: {}, states: [], errors: [] };
const t = await openT2({ via: 'plain', streaming: false, width: 1280, height: 800 });
const order = []; // 만든 순서
const reqText = (body) => (body.messages ?? []).map((m, i) => `===== [${i}] ${m.role} (${text(m.content).length}자)\n${text(m.content)}`).join('\n\n');

async function quietAux(ms = 4000, max = 90000) {
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
/** 한 턴: 보내기(또는 sendFn) → 붙잡힌 본편 요청 읽기 → 답 짓기 → 풀기 → 답 붙기·보조 끝날 때까지 */
async function turn(flowKey, idx, tdef, sendFn) {
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
  if (!rec) throw new Error(`${flowKey} 턴${idx + 1}: 본편 요청이 안 옴`);
  const req = readRequest(rec.body);
  const reply = buildReply(req, tdef);
  writeFileSync(REPLY_FILE, reply);
  await t.fake('release', { seq: rec.seq });
  await t.waitBusy(5000).catch(() => {});
  await t.waitIdle();
  await quietAux();
  const st = await t.chatState(true);
  const last = st.message.at(-1);
  const scr = await t.waitScreenText(st.message.length - 1, /\S/, 10000);
  const info = { turn: idx + 1, mainSeq: rec.seq, user: req.lastUser, fields: req.fields, prevLine: req.prevLine, start: req.start, entries: req.entries.length, newEntries: req.entries.filter((e) => e.isNew).length, inventory: req.inventory, nMsgs: req.nMsgs, reply, savedLast: last?.data, savedRole: last?.role, chatMessages: st.message.length, chatPage: st.chatPage, chatId: st.chatId, screenLast: scr?.slice(0, 120) ?? null, world: st.scriptstate?.$goei_world ? JSON.parse(st.scriptstate.$goei_world) : null, wallet: st.scriptstate?.$st_wallet ?? null, pointsOn: st.scriptstate?.$st_points_on ?? null, faction: st.scriptstate?.$st_faction ?? null, player: st.scriptstate?.$st_player ?? null, pointVars: Object.fromEntries(Object.entries(st.scriptstate ?? {}).filter(([k]) => /point|^\$bm_|^\$st_col_/.test(k)).map(([k, v]) => [k, String(v).slice(0, 300)])) };
  return { rec, req, info };
}
const summary = (st) => ({ faction: st.scriptstate?.$st_faction ?? null, player: st.scriptstate?.$st_player ?? null, pointsOn: st.scriptstate?.$st_points_on ?? null, wallet: st.scriptstate?.$st_wallet ?? null, lastStatus: (String(st.message.at(-1)?.data ?? '').match(/\[▣\|[^\n]*\]/) ?? [])[0] ?? null, messages: st.message.length, people: st.people ? Object.keys(st.people.people ?? st.people).length : 0 });
async function save(name, info) {
  const file = `${STATES}/${name}.json`;
  order.push(name);
  const st = await t.chatState(true);
  const r = await t.exportState(file, { name, plugin: PLUGIN_VER, goeiCommit: GOEI_COMMIT, risuCommit: RISU_COMMIT, order: order.length, ...info, contents: { ...summary(st), ...(info.contents ?? {}) } });
  run.states.push({ name, ...r });
  console.log('[state]', name, r.bytes, 'bytes', r.messages, 'msgs');
  return r;
}

try {
  await t.fake('reset', {});
  await t.fake('rules', { rules: [
    { id: 's0-main-hold', route: 'main', hold: true, replyFile: REPLY_FILE },
    // 보조: Router·Director 는 빈 목록(지침 꼴로 맞는 답), 그 밖(인물 기록 갱신기 등)은 '{}'
    { id: 's0-aux-router', route: 'aux', match: '# Router — scene people selection', reply: '{"selected":[],"new_characters":[]}' },
    { id: 's0-aux-director', route: 'aux', match: '# Scene Director', reply: '{"notes":[]}' },
    { id: 's0-aux', route: 'aux', reply: '{}' },
  ] });
  const su = await t.setup();
  run.setup = su;
  const greet = await t.waitScreenText(-1, /\S/, 15000);
  run.setupGreet = greet?.slice(0, 80) ?? null;
  await save('S-start', { flow: '설치만', made: 'setup() — 카드·플러그인 가져오기, 모델 설정, 캐릭터 고르기. 출발 전(시작 패널을 열지 않음)', contents: { turns: 0 } });

  let firstChat = true;
  for (const key of ['가', '나', '다', '라']) {
    if (!ONLY.includes(key)) continue;
    const f = FLOWS[key];
    const fr = { title: f.title, turns: [] };
    run.flows[key] = fr;
    if (!firstChat) { await t.closeWindow(); fr.newChat = await t.newChat(); }
    firstChat = false;
    t.errors.splice(0);
    let st0 = null;
    for (let i = 0; i < f.turns.length; i++) {
      const td = f.turns[i];
      let sendFn = null;
      if (i === 0) {
        if (td.user == null) sendFn = async () => { fr.picked = await t.startPanel(f.start); };
        else {
          fr.picked = await t.startPanel(f.start);
          await sleep(2500);
          st0 = await t.chatState(true);
          fr.afterStart = { messages: st0.message.length, fmIndex: st0.fmIndex, first: String(st0.message[0]?.data ?? '').slice(0, 200) };
          await t.closeWindow();
        }
      }
      const r = await turn(key, i, td, sendFn);
      fr.turns.push(r.info);
      if (i === 0) {
        const base = `${FR}/${key}-${{ 가: '관리국-인물장면', 나: '백일몽-직접입력', 다: '프리랜서-커스텀임무', 라: '요원플레이-에일린' }[key]}`;
        writeFileSync(base + '.json', redact(JSON.stringify({ flow: f.title, plugin: PLUGIN_VER, risuCommit: RISU_COMMIT, seq: r.rec.seq, t: r.rec.t, stream: r.rec.stream, model: r.rec.model, path: r.rec.path, body: r.rec.body }, null, 1)));
        writeFileSync(base + '.txt', `# ${f.title} — 첫 본편 요청 전문 (가짜 서버 seq ${r.rec.seq}, ${r.rec.t}, v${PLUGIN_VER}, 리스AI ${RISU_COMMIT.slice(0, 7)})\n\n` + redact(reqText(r.rec.body)));
        fr.firstRequest = base + '.json';
      }
      if (i === 0) await t.closeWindow();
    }
    fr.errors = t.errors.splice(0);
    const stEnd = await t.chatState(true);
    fr.end = summary(stEnd);
    const nm = { 가: 'S-관리국-3턴', 나: 'S-백일몽-3턴', 다: 'S-프리랜서-임무', 라: 'S-요원플레이' }[key];
    await save(nm, { flow: f.title, made: `새 채팅 → 시작 패널 ${JSON.stringify(f.start)} → 본편 ${f.turns.length}턴 (대본 답, 보조는 Router·Director 빈 목록·그 밖 '{}')`, contents: { turns: f.turns.length, statusFields: fr.turns.at(-1).fields } });
    await t.shot(`s0-${key}-end`);
    if (key === '가') {
      const r = await turn(key, 3, f.shopTurn, null);
      fr.shopTurn = r.info;
      await sleep(1500);
      fr.shopCard = await t.R(() => { const box = [...document.querySelectorAll('.risu-chat[data-chat-index]')].sort((a, b) => Number(b.dataset.chatIndex) - Number(a.dataset.chatIndex))[0]; return box ? box.innerText.replace(/\s+/g, ' ').slice(-300) : null; });
      await t.shot('s0-가-shop');
      await save('S-상점표식', { flow: f.title + ' + 상점 표식 턴', made: 'S-관리국-3턴 에서 한 턴 더: 답 끝 상태창 줄 바로 앞에 [shop: 기독교 상점|블라렛]', contents: { turns: 4, shopTag: '기독교 상점|블라렛' } });
    }
  }
} catch (e) {
  run.errors.push(String(e?.stack ?? e));
  console.error(e);
  try { await t.shot('s0-FAIL'); } catch {}
} finally {
  run.consoleTail = t.errors.slice(-80);
  run.served = t.served;
  run.order = order;
  const of = `${OUT}/make-${Date.now()}.json`;
  writeFileSync(of, JSON.stringify(run, null, 1));
  console.log('결과:', of);
  await t.close();
}
