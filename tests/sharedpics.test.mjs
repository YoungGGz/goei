// 공용 그림 고르기 (src/core/sharedpics.ts)와 요원 성별 (명부 칸 → 로어북 Gender 줄)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { situationShared, baseShared, orgShared, agentShared, loreGender, agentGender, readDirectory } from '../dist-test/core.mjs';

test('situations pick by place, mystic sites by what they are', () => {
  assert.equal(situationShared('in', '평택항 컨테이너 터미널', '컨테이너 야적장 화재')[0], 'Situation Incident Port');
  assert.equal(situationShared('an', '샛별 고시원')[0], 'Situation Anomaly Apartment 2');
  assert.match(situationShared('an', '유계역')[0], /^Situation Anomaly Subway [123]$/);
  assert.equal(situationShared('ms', '이정 책방', '지하철역 앞')[0], 'Situation Mystic Bookshop');
  assert.equal(situationShared('ms', '무엇이든 자판기')[0], 'Situation Mystic Vending');
  const odd = situationShared('ms', '이상한 그것');
  assert.equal(odd.at(-1), 'Situation Mystic');
  assert.ok(odd.includes('Situation Mystic Door'));
  // 같은 이름은 늘 같은 순서
  assert.deepEqual(situationShared('an', '모르는 곳'), situationShared('an', '모르는 곳'));
});

const top = (name, text = '', loc = '') => situationShared('an', name, text, loc)[0].replace('Situation Anomaly', '').trim();
const have = new Set(readdirSync('그림/위키/Situations').map((f) => f.replace('.avif', '')));
const now = (name, text = '', loc = '') => (situationShared('an', name, text, loc).find((n) => have.has(n)) ?? '').replace('Situation Anomaly', '').trim();

test('장소 낱말 전부: 낱말마다 정한 그림(장소)이 첫 후보', () => {
  const rows = readFileSync('tests/sharedpics-words.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
  assert.ok(rows.length > 1000);
  const bad = [];
  for (const [w, k, n] of rows) {
    const t = top(`가온 ${w}`);
    const ok = k === 'Anomaly' ? t === '' : n ? t === `${k} ${n}` : t.replace(/ \d$/, '') === k;
    if (!ok) bad.push(`${w}: ${k} ${n} → ${t}`);
  }
  assert.deepEqual(bad, []);
});

test('이름에서 뒤에 나온 낱말(더 좁은 자리)을 따르고, 안·바깥 단서로 그림을 가른다', () => {
  assert.equal(top('강서대학병원 지하 주차장'), 'Parking 1');
  assert.equal(top('성북초등학교 3층 화장실'), 'Restroom 2');
  assert.match(top('세광병원 옥상'), /^Rooftop/);
  assert.equal(top('신축 아파트 공사 현장').replace(/ \d$/, ''), 'Construction');
  assert.equal(top('모텔 3층'), 'Lodging 2');
  assert.equal(top('목욕탕 앞'), 'Bathhouse 1');
  // 복도 그림이 아직 없으면 그 건물의 안쪽 그림
  assert.equal(now('강서대학병원 3층 복도'), 'Hospital 2');
  assert.match(top('충장로 구시가지 영화관', '낡은 상영관에서 사람이 사라진다', '광주광역시 동구'), /^Theater [12]$/);
});

test('끝말: 세 글자 이상인 낱말 끝에서만, 같은 글자로 끝나는 다른 낱말과 행정구역은 뺀다', () => {
  // 2026-11-19 사용자 스샷: 옥정호 수변 산책로에 상가 복도 그림. 새 그림이 오기 전에도 저수지 그림
  assert.equal(now('옥정호 수변 산책로 안개 구역', '안개 속에서 낚시객 두 명이 같은 자리를 맴돎', '전북특별자치도 임실군'), 'Lake 1');
  assert.equal(top('중랑천변 자전거 보관소').replace(/ \d$/, ''), 'Riverside');
  assert.match(top('북한산 둘레길'), /^Forest/);
  assert.equal(top('구룡포항'), 'Sea 2');
  assert.equal(top('유성온천').replace(/ \d$/, ''), 'Bathhouse');
  assert.equal(top('인천국제공항').replace(/ \d$/, ''), 'Airport');
  for (const name of ['교통신호 제어기', '재산 분쟁', '번역 사무', '무명찬란교 집회', '302호', '순천', '부산 어딘가', '광역시 지역 구역']) {
    assert.ok(!/^(Lake|Forest|Subway|Riverside|Bridge|Sea|Cave)/.test(top(name)), name);
  }
  assert.ok(!/Subway|Forest/.test(top('이상한 횟집', '지역 주민의 얼굴', '부산광역시 해운대구')));
});

test('상황 글은 이름에서 못 고를 때만, 다른 곳을 가리키는 말과 한 글자 낱말은 빼고', () => {
  assert.match(top('은하 목욕탕', '지하철 타고 온 손님'), /^Bathhouse/);
  assert.match(top('세광병원 옥상', '목격자는 인근 경찰서로 이송'), /^Rooftop/);
  assert.match(top('이름 모를 곳', '목격자는 인근 병원으로 이송됨'), /^Generic/);
  assert.match(top('이름 모를 곳', '차량이 멈춰 섬', '서울특별시 강남구'), /^Generic City/);
  assert.match(top('이름 모를 곳', '폐공장 굴뚝에서 연기'), /^Ruin/);
  assert.match(top('알 수 없는 장소', '주민들이 같은 꿈을 꿈', '충청북도 음성군'), /^Generic Country/);
  // 사건은 사건 그림 안에서만
  const inc = situationShared('in', '강남대로 사거리', '다중 추돌', '서울특별시 강남구');
  assert.equal(inc[0], 'Situation Incident Street');
  assert.ok(inc.every((n) => n.startsWith('Situation Incident')));
});

test('bases and orgs pick by name words', () => {
  assert.equal(baseShared('관리국 본부')[0], 'Shared Base Office');
  assert.equal(baseShared('서울중앙성원')[0], 'Shared Base Religious');
  assert.equal(baseShared('비밀 아지트').at(-2), 'Shared Base Hideout');
  assert.equal(orgShared('백일몽 주식회사')[0], 'Shared Org Corporate');
  assert.equal(orgShared('민간 모임', 'civilian')[0], 'Civilian');
  assert.equal(orgShared('아무개').at(-1), 'Shared Org Office');
});

test('agents pick outfit by org, gender, one of three by name', () => {
  const a = agentShared('관리국', 'A00', 'F', '쟈알디');
  assert.match(a[0], /^Shared Agent Suit Female [123]$/);
  assert.equal(new Set(a.slice(0, 3)).size, 3);
  assert.deepEqual(agentShared('관리국', 'A00', 'F', '쟈알디'), a);
  assert.match(agentShared('백일몽', 'C00', 'M', 'x')[0], /^Shared Agent Masked Male/);
  assert.match(agentShared('관리국', 'A00', '', 'x')[0], /^Shared Agent Religious/);
  assert.match(agentShared('발푸르기스', '', 'F', 'x')[0], /^Shared Agent Occult/);
});

test('gender: directory field first, then the lorebook Gender line', () => {
  const lore = [{ comment: '가', content: '- Gender: Female\n' }, { comment: '나', content: '성별: 남' }, { comment: '다', content: '설명 없음' }];
  assert.equal(loreGender(lore, '가'), 'F');
  assert.equal(loreGender(lore, '나'), 'M');
  assert.equal(loreGender(lore, '다'), '');
  assert.equal(agentGender({ lore: '가' }, lore), 'F');
  assert.equal(agentGender({ lore: '가', gender: 'M' }, lore), 'M');
  assert.equal(agentGender({ lore: '가', gender: 'X' }, lore), '');
  assert.equal(readDirectory([]).agents.length, 0);
});
