// I 구간 run8: 하이파 참조 켬 → 갱신기 자료 memory / 인물당 저장 상한 넘김 → 같은 호출에 정리(tidy) 얹기. PC 1280x800
// 상태: 틀 S-관리국-3턴 에 hypaV3Data 요약 둘을 넣은 사본 (out/S-관리국-3턴-hypa.json)
import { open, responder, people, OUT, updData, tagOf, sleep, recorder, setVars, EMPTY_UPD } from './common.mjs';
const R = recorder('run8');
const t = await open({ width: 1280, height: 800 });
const rsp = responder(OUT + '/calls-run8.jsonl');
const ST = '[▣|2025.03.14|10:50 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|잼트리|없음|관리국/신입|140000]';
const LONG = '잼트리는 서류철을 하나씩 넘기며 지난 사건의 기록을 길게 설명했다';
rsp.plan.main = () => LONG + '. ' + '그녀는 각 항목의 의미와 처리 순서를 꼼꼼히 짚었다. '.repeat(8) + '\n' + ST;
const TOPICS = [
  '지하 보관실 열쇠를 분실했다가 화분 밑에서 찾아냈고 그 일로 보안팀 회의에 불려가 시말서를 세 장이나 썼다. 이후 열쇠는 목걸이로 걸고 다닌다.',
  '작년 겨울 한강 다리 위 괴이 출동 때 무전기가 얼어붙어 본부와 연락이 끊겼고, 혼자 판단으로 시민 열두 명을 대피시켜 표창을 받았다.',
  '매주 목요일마다 구내식당 김치찌개를 두 그릇씩 먹는 습관이 있어 식당 아주머니가 따로 냄비를 남겨 둔다고 동료들 사이에 소문이 났다.',
  '새벽 세 시에 지하철 종착역에서 울음소리 신고를 받고 혼자 내려갔다가 빈 유모차만 발견했고, 그 기록을 지금도 서랍 맨 아래에 보관한다.',
  '자격시험 실기에서 결계 도형을 거꾸로 그려 낙방한 적이 있어, 지금은 신입들에게 도형 방향부터 손바닥에 적어 외우게 한다.',
  '부산 지부로 파견 갔을 때 태풍 때문에 일주일 동안 숙소에 갇혀 지부장과 바둑만 두었고, 그때 배운 수를 아직도 자랑한다.',
  '관리국 체육대회 줄다리기에서 연구팀을 상대로 혼자 버티다 손바닥이 다 까졌고, 그 뒤로 연구팀 사람들과 묘하게 친해졌다.',
  '오래된 필름 카메라를 수리점에 맡겼다가 찾은 사진 속에 찍힌 적 없는 그림자를 발견해 정식 사건으로 접수시킨 일이 있다.',
];
const waitUpd = async (from) => { for (let i = 0; i < 60 && !rsp.since(from).some((c) => c.kind === 'upd'); i++) await sleep(500); await sleep(2000); return rsp.since(from).find((c) => c.kind === 'upd'); };
try {
  await t.setup();
  await t.loadState(OUT + '/S-관리국-3턴-hypa.json');
  await setVars(t, { '$pp_hypa': '1', '$pp_person_cap': '2000', '$pp_tidy': 'same' });
  // 1턴: 갱신기가 잼트리에게 긴 행적 8개를 붙임
  rsp.plan.upd = (body) => { const d = updData(body); const m = tagOf(d, LONG); return JSON.stringify({ ...EMPTY_UPD, entries: TOPICS.map((x) => ({ who: '잼트리', slot: 'history', op: 'add', text: x, m, quote: LONG })) }); };
  let c0 = rsp.maxSeq();
  await t.send('잼트리에게 지난 사건을 묻는다.');
  const u1 = await waitUpd(c0);
  const d1 = updData(u1?.body);
  const p1 = await people(t);
  const chars = (p) => JSON.stringify(Object.values(p.people['잼트리'].slots).flat().filter((e) => !e.voided).map((e) => e.text)).length;
  R.step('1 하이파 참조 켬', '갱신기 자료에 memory(하이파 요약, 중요 표시 먼저)', 'K 하이파(리수폿 J-3) · 코스 I-4', { memory: d1?.memory ?? null, tidy: d1?.tidy ?? null }, Array.isArray(d1?.memory) && d1.memory.length > 0);
  R.step('1-2 긴 행적 반영', '잼트리 기록이 상한 2000자를 넘음', '코스 I-4 줄이기', { historyN: (p1.people['잼트리'].slots.history ?? []).length, approxChars: chars(p1) }, null);
  // 2턴: 상한 넘은 인물 → 같은 호출에 tidy 가 얹혀야 함
  rsp.plan.upd = () => JSON.stringify(EMPTY_UPD);
  c0 = rsp.maxSeq();
  await t.send('잼트리에게 고맙다고 한다.');
  const u2 = await waitUpd(c0);
  const d2 = updData(u2?.body);
  const sys2 = String(u2?.body?.messages?.[0]?.content ?? '');
  R.step('2 저장 상한 넘김 → 정리 얹기', '자료 tidy 에 잼트리(chars·target 1600), 지침에 정리 절', 'I-04(Claude 판정)·설정 「정리 방식: 같은 호출에 얹기」', { tidy: d2?.tidy ?? null, sysHasTidy: /tidy|정리/i.test(sys2.slice(-4000)) }, Array.isArray(d2?.tidy) && d2.tidy.some((x) => x.name === '잼트리'));
} catch (e) { R.step('예외', '', '', String(e?.stack ?? e).slice(0, 1200), false); } finally { await rsp.stop(); await t.close(); }
