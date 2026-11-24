// I 구간 run2: 별칭 규칙(I-01), 주인공·페르소나 제외(I-08, 요원으로 플레이 포함), Router 힌트 (PC 1280x800)
import { open, responder, people, diag, STATES, updData, lastTag, sleep, ctl, recorder, EMPTY_UPD } from './common.mjs';

const R = recorder('run2');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(t.cfg.out.replace(/틀\/out$/, 'I/out') + '/calls-run2.jsonl');
const MAIN = new Map();
let stLine = '[▣|2025.03.14|10:30 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]';
rsp.plan.main = (body) => {
  const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  for (const [k, v] of MAIN) if (String(last).includes(k)) return v + '\n' + stLine;
  return '잠시 조용한 시간이 흘렀다.\n' + stLine;
};
const U = (o) => JSON.stringify({ ...EMPTY_UPD, ...o });
const names = async () => Object.keys((await people(t))?.people ?? {}).sort();
const updCalls = (from) => rsp.since(from).filter((c) => c.kind === 'upd');
const waitUpd = async (from, n = 1, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (updCalls(from).length >= n) { await sleep(1800); return true; } await sleep(300); } return false; };
const lastDiag = async () => (await diag(t)).filter((d) => d.reason === 'turn').at(-1);
const turn = async (input, reply, upd) => { MAIN.set(input, reply); if (upd) rsp.plan.upd = upd; else rsp.plan.upd = () => U({}); const c0 = rsp.maxSeq(); await t.send(input); await waitUpd(c0); return c0; };

try {
  await t.setup();
  await t.loadState(STATES + 'S-관리국-3턴.json');
  const persona = await t.R(async () => { const st = await import('/src/ts/stores.svelte.ts'); const db = st.DBState.db; return db.personas?.[db.selectedPersona]?.name ?? db.username; });
  R.step('0 시작', '관리국 3턴, 페르소나 이름', 'states/README', { names: await names(), persona }, null);

  // ── A. 별칭만 (동물 별명) ──
  await turn('복도 쪽을 본다', '복도 끝에서 독사가 낄낄 웃었다. "신입이 왔다며? 얼굴 좀 보자."\n\n독사는 벽에 기대 팔짱을 꼈다.');
  R.step('A-1 별명 「독사」만 (코드 판정)', '백사헌 기록 안 생김 (초상 태그·소속 근거 없음)', 'I-01(사용자 결정)', await names(), !(await names()).includes('백사헌'));
  let c0 = await turn('독사에게 다가간다', '독사가 이를 드러내며 웃었다. "겁도 없네, 신입."', (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '독사', aliases: ['독사'], m, quote: '독사가 이를 드러내며 웃었다', identity: '미확인', speech: '반말' }] }); });
  R.step('A-2 별명 「독사」만, 갱신기가 new_people 로 올림 (모델 판정)', '사용자 결정: 별명만이면 첫 등록 안 함(다른 근거 있을 때만). 코드가 이 길을 막는지 사실로', 'I-01(사용자 결정)', { names: await names(), rosterSent: (updData(updCalls(c0)[0]?.body)?.roster ?? []).some((r) => r.name === '백사헌'), knownNamesHas: (updData(updCalls(c0)[0]?.body)?.known_names ?? []).includes('백사헌'), diag: await lastDiag() }, !(await names()).includes('백사헌'));
  // 초상 태그와 같이
  await turn('독사의 얼굴을 살핀다', '<img=Baek Sa-heon_smirk>\n\n독사가 고개를 갸웃했다. "뭘 그렇게 봐?"');
  R.step('A-3 별명 + 초상 태그', '백사헌 기록 생김 (초상 태그 근거)', 'I-01(사용자 결정)', await names(), (await names()).includes('백사헌'));

  // ── B. 「사장님」 ──
  await turn('누가 오는지 본다', '"사장님이 찾으신대." 누군가 복도에서 외쳤다. 사장님이라는 말에 다들 자세를 고쳤다.');
  R.step('B-1 「사장님」만', '사장 기록 안 생김', 'I-01(사용자 결정)', await names(), !(await names()).includes('사장'));
  await turn('자세를 고친다', '"관리국 사장님께서 직접 내려오셨다." 쟈알디가 낮게 말했다. 사장님은 말없이 로비를 둘러보았다.');
  R.step('B-2 「사장님」 + 「관리국」(사장 소속은 B00 가짜 관리국)', '사실로: 소속 근거가 「관리국」 글자로 맞는지', 'I-01(사용자 결정)·코드 relations-base 사장 faction B00', await names(), null);
  await turn('사장님께 인사한다', '<img=Sa-jang_default>\n\n사장님이 고개를 끄덕였다. "자네가 신입인가."');
  R.step('B-3 「사장님」 + 초상 태그', '사장 기록 생김', 'I-01(사용자 결정)', await names(), (await names()).includes('사장'));

  // ── C. 페르소나 제외 (내 페르소나로 플레이) ──
  c0 = await turn('이름을 말한다', `"${persona}, 맞지?" 잼트리가 명단을 확인했다. "${persona} 씨, 여기 서명."`, (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: persona, aliases: [], m, quote: `${persona} 씨, 여기 서명.`, identity: '신입', speech: null }] }); });
  R.step('C-1 페르소나 이름을 new_people 로', `「${persona}」 기록 안 생김 (진단 dropped 「주인공」)`, 'I-08(Claude 판정, 0.21.34)', { names: await names(), dropped: (await lastDiag())?.report?.dropped, shopProtagonist: updData(updCalls(c0)[0]?.body)?.shop_check?.protagonist }, !(await names()).includes(persona));

  // ── D. 요원으로 플레이 (에일린) ──
  await t.loadState(STATES + 'S-요원플레이.json');
  stLine = '[▣|2025.03.14|09:40 AM|☀️|12°C|서울 종로구 관리국 본부 사무실|없음|쟈알디|없음|관리국/선임 요원|140000]';
  R.step('D-0 요원 플레이 상태', '기록 쟈알디만', 'states/README', await names(), null);
  rsp.plan.router = () => JSON.stringify({ selected: [{ name: '쟈알디' }], new_characters: [{ name: '에일린', aliases: ['Aileen'], quote: '에일린, 이리 와' }, { name: '하늘별', aliases: [], quote: '하늘별이 손을 흔들었다' }] });
  c0 = await turn('쟈알디에게 간다', '<img=Aileen_default>\n\n"에일린, 이리 와." 쟈알디가 손짓했다. 에일린 선임 요원은 서류철을 들고 책상 앞에 섰다.\n\n창가에서 하늘별이 손을 흔들었다. "에일린 선배, 안녕하세요!"');
  const u1 = updData(updCalls(c0)[0]?.body);
  const rt = rsp.since(c0).filter((c) => c.kind === 'router').at(-1);
  R.step('D-1 코드 판정·자료', '에일린 기록 안 생김. 갱신기 자료 roster·known_names·name_hints·Router 명단에 에일린 없음 (하늘별 힌트는 감)', 'I-08(Claude 판정, 0.21.34)·공-22 아님', { names: await names(), rosterHas: (u1?.roster ?? []).some((r) => r.name === '에일린'), hints: u1?.name_hints, routerCatalog: rt ? JSON.parse(rt.body.messages[1].content).catalog.map((x) => x.name) : null, shopProtagonist: u1?.shop_check?.protagonist }, !(await names()).includes('에일린'));
  c0 = await turn('보고서를 내민다', '쟈알디가 보고서를 받았다. "에일린, 수고했다." 하늘별은 어느새 사라지고 없었다.', (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '에일린', aliases: ['Aileen'], m, quote: '에일린, 수고했다.', identity: '관리국 선임 요원', speech: null }, { name: 'Aileen', aliases: [], m, quote: '에일린, 수고했다.', identity: '미확인', speech: null }], entries: [{ who: '에일린', slot: 'state', op: 'add', replace: null, text: '보고서를 냄', target: null, m, quote: '쟈알디가 보고서를 받았다' }] }); });
  R.step('D-2 갱신기가 에일린·영문 표기를 new_people 로', '둘 다 버림(주인공), 항목도 안 붙음', 'I-08(Claude 판정, 0.21.34)', { names: await names(), dropped: (await lastDiag())?.report?.dropped }, !(await names()).some((n) => /에일린|Aileen/.test(n)));
  // 호칭 기록을 에일린으로 옮기려는 답
  c0 = await turn('복도의 청소부를 본다', '복도에서 청소부 아주머니가 대걸레를 밀고 있었다. "어머, 요원님. 바닥 미끄러워요."', (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: '청소부 아주머니', aliases: [], m, quote: '청소부 아주머니가 대걸레를 밀고', identity: '미확인', speech: '존댓말', provisional: true }] }); });
  c0 = await turn('청소부에게 이름을 묻는다', '"저요? 에일린이라고 불러요, 다들." 아주머니가 웃었다.', (body) => { const d = updData(body); const m = lastTag(d); return U({ renames: [{ from: '청소부 아주머니', to: '에일린', m, quote: '에일린이라고 불러요' }] }); });
  R.step('D-3 호칭 기록 → 주인공 이름으로 옮기기', '옮기지 않음(dropped rename 「주인공」), 청소부 아주머니 그대로', 'I-08(Claude 판정)', { names: await names(), dropped: (await lastDiag())?.report?.dropped }, (await names()).includes('청소부 아주머니') && !(await names()).includes('에일린'));
  // 페르소나 이름은 요원 플레이 때 어떻게 되나
  c0 = await turn('명부를 본다', `명부 맨 아래에 ${persona}라는 이름이 적혀 있었다. "${persona}? 처음 듣는 이름인데." 쟈알디가 중얼거렸다.`, (body) => { const d = updData(body); const m = lastTag(d); return U({ new_people: [{ name: persona, aliases: [], m, quote: `${persona}? 처음 듣는 이름인데.`, identity: '미확인', speech: null }] }); });
  R.step('D-4 요원 플레이 중 페르소나 이름을 new_people 로', '사실로 적음 (요원 플레이 때 제외 이름은 그 요원 하나: host/people.ts ownNames)', 'I-08(Claude 판정)', { names: await names(), dropped: (await lastDiag())?.report?.dropped }, null);
  await t.shot('../../I/out/run2-end');
  R.step('끝', '', '', { errors: t.errors.filter((e) => !/displayData/.test(e)).slice(-10) }, null);
} catch (e) {
  R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1500), false);
} finally {
  await rsp.stop();
  await t.close();
}
