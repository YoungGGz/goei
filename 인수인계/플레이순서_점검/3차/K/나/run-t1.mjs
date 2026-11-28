// 3차 K4 세계 탭 편집기 · T1 (가짜 리스, tests/qc-host.mjs). 사용: node run-t1.mjs [절 글자들 예: ABE]  (없으면 전부)
// 시작 상태: 3차/틀/states/S-관리국-3턴.json (관리국·면접·3턴), 새 채팅은 빈 채팅({message:[]}).
// 저장 자리: 세계 편집은 카드 로어북 「Directory」(명부 + 「세계」 덧쓰기), 관계 「대칭」은 기기 저장소 goei:prefs.relationsSym.
import { launch, session, STATE, dump, fmt, all, sleep, check, results, OUT, scrubAge } from './lib-t1.mjs';
import { setSaveFail, clearSaveFail, saveFails } from '../../../../../tests/qc-host.mjs';
import { writeFileSync } from 'node:fs';

const ONLY = (process.argv[2] ?? '').toUpperCase();
const want = (k) => !ONLY || ONLY.includes(k);
const st = STATE('S-관리국-3턴');
const PREFS = JSON.parse(st.t2.pluginStorage['goei:prefs']);
const DIR0 = JSON.parse(st.t2 && (await import('node:fs')).readFileSync('/tmp/t1fx/fixture.json', 'utf8')).globalLore.find((e) => e.comment === 'Directory').content;
const D0 = JSON.parse(DIR0);
const scrubRoster = (t) => scrubAge(t).replace(/\((\d+|early \d+s|mid \d+s|late \d+s)\//g, '([생략]/');
const reqDump = (name, msgs) => dump(name, scrubRoster(fmt(msgs)));
const b = await launch();
const fresh = () => session(b, { chat: structuredClone(st.data), prefs: PREFS });
const W = (o) => o?.세계 ?? {};

// ═══ A. 기본값이 카드와 같은가 (편집기를 열고 둘러보고 닫기만) ═══
if (want('A')) {
  const S = await fresh();
  const before = await S.setChar();
  await S.openEd('agent');
  for (const n of ['agent', 'org', 'anomaly', 'site', 'appendix', 'base', 'relations', 'start']) await S.node(n);
  // B-04: 조직 › 관리국 › 기본 정보 「첫 장면에 함께 넣을 로어북」
  await S.node('org');
  await S.act('ed-sel', '관리국');
  const seeds = await S.page.evaluate(() => [...document.querySelectorAll('.gw [data-key^="seed:"]')].map((e) => [e.dataset.key, e.value, e.closest('label')?.querySelector('span')?.textContent]));
  const want0 = Object.entries(D0['시작 로어북']).filter(([k]) => k.startsWith('A00-')).map(([k, v]) => [`seed:${k}`, v.join(', ')]);
  check('A-02', '조직 관리국 기본 정보에 data-key seed:A00-1~9 칸이 있고 값이 카드 명부 「시작 로어북」과 같음', '9칸, 값 같음', 'B-04 (Claude 판정)', seeds.length === 9 && want0.every(([k, v]) => seeds.find((s) => s[0] === k)?.[1] === v), seeds, dump('A-02_seed칸.json', { seeds, card: want0 }));
  await S.page.evaluate(() => document.querySelector('.gw [data-key="seed:A00-1"]')?.scrollIntoView({ block: 'center' }));
  await S.page.screenshot({ path: `${OUT}A-02_seed칸_PC.png` });
  await S.act('ed-sel', '민간인');
  const dseeds = await S.page.evaluate(() => [...document.querySelectorAll('.gw [data-key^="seed:D00"]')].map((e) => [e.dataset.key, e.value]));
  check('A-03', '민간인 첫 장면 로어북: 직접 입력(D00-6)·커스텀 임무(D00-7) 칸이 빈 채', 'D00-6·7 빈 값', 'B-05 (사용자 결정)', dseeds.length === 7 && dseeds.filter(([k]) => /D00-[67]$/.test(k)).every(([, v]) => v === ''), dseeds);
  // 요원 쟈알디 기본 정보 = 명부
  await S.node('agent');
  await S.act('ed-sel', '쟈알디');
  const jy = await S.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gw .gw-basic [data-input="dir"]')].map((e) => [e.dataset.key, e.value])));
  const dj = D0.요원['쟈알디'] ?? {};
  check('A-04', '요원 쟈알디 기본 정보(영문명·직급·부서)가 카드 명부 줄과 같음', `english=${dj.english} rank=${dj.rank} dept=${dj.department}`, 'Claude 판정 (편집기 기본값 = 카드)', jy['english|쟈알디'] === (dj.english ?? '') && jy['rank|쟈알디'] === (dj.rank ?? '') && jy['department|쟈알디'] === (dj.department ?? ''), { ui: jy, card: dj });
  await S.node('base');
  const bases = await S.page.evaluate(() => [...document.querySelectorAll('.gw .dir-row .dir-name b')].map((e) => e.textContent));
  check('A-05', '거점 화면 목록 = 카드 명부 거점 6곳', Object.keys(D0.거점).join(','), 'Claude 판정', bases.length === 6 && Object.keys(D0.거점).every((n) => bases.includes(n)), bases);
  await S.closeEd();
  await sleep(800);
  check('A-01', '세계 탭 8쪽을 둘러보고 닫기만 하면 카드 로어북을 다시 쓰지 않음(초안 = 카드)', 'setCharacterToIndex 0회', 'K-01 (바로 저장은 바꿀 때만) · Claude 판정', (await S.setChar()) === before, await S.setChar() - before);
  check('A-06', '편집기 둘러보는 동안 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ B. 요원: 기본 정보·로어 칸·추가 칸·가져오기·순서·명부 포함·사진·틀 → 다음 요청 ═══
if (want('B')) {
  const S = await fresh();
  await S.openEd('agent');
  // B-01 데쥬레 「요원 목록에 보일 세력」 관리국 끔 → 다음 요청 code 목록 (2차 15 문제3 다시 보기)
  await S.act('ed-sel', '데쥬레');
  let n0 = await S.setChar();
  await S.act('dir-toggle', 'rosterFor|A00|데쥬레');
  const saved1 = await S.waitSave(n0);
  const d1 = await S.dir();
  await S.closeEd();
  const r1 = await S.request('사무실을 둘러본다.');
  reqDump('B-01_요청_데쥬레숨김.txt', r1);
  const codeLine = all(r1).split('\n').find((l) => l.startsWith('- code:')) ?? '';
  check('B-01', '데쥬레를 관리국 요원 목록에서 끄면 → 카드 명부 저장, 바로 다음 본편 요청 code 목록에서 P012 빠짐', 'roster_for 에 A00 없음 · code 줄에 P012 없음', '2차 15 문제3 → output.ts:150 「명부를 고친 직후 요청에도 바로」(Claude 판정)', saved1 && !d1.요원['데쥬레'].roster_for?.includes('A00') && codeLine && !codeLine.includes('P012'), { saved1, roster_for: d1.요원['데쥬레'].roster_for, codeLine }, 'out/B-01_요청_데쥬레숨김.txt');
  const agLines = all(r1).split('\n').filter((l) => /^\[AG\|P012/.test(l));
  check('B-01b', '같은 요청 World Entries 의 [AG|P012…] 줄도 빠짐', '0줄', '위와 같음', agLines.length === 0, agLines);
  await S.page.evaluate(() => window.__chat.message.pop());

  // B-02 스팡달 로어 칸 「소개」(Roster 한 줄) 고침 → Roster
  await S.openEd('agent');
  await S.act('ed-sel', '스팡달');
  const introKey = '.gw [data-input="ed-field"][data-key="agent|스팡달|intro"]';
  const intro0 = await S.val(introKey);
  n0 = await S.setChar();
  await S.type(introKey, `${intro0} 시험소개1`);
  const saved2 = await S.waitSave(n0);
  const ov2 = W(await S.dir()).agent?.['스팡달'];
  // B-03 별칭 「시험별칭1」 → 그 말을 하면 스팡달 로어가 켜지는지
  n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="aliases|스팡달"]', '시험별칭1');
  const saved3 = await S.waitSave(n0);
  // B-04 추가 칸 「시험칸1」 = 「시험값1」
  await S.type('.gw [name="ed-extra-name"]', '시험칸1');
  await S.act('ed-extra-add');
  const xi = await S.page.evaluate(() => { const els = [...document.querySelectorAll('.gw [data-input="ed-extra-name"]')]; const e = els.find((x) => x.value === '시험칸1'); return e ? e.dataset.key.split('|')[2] : '-1'; });
  n0 = await S.setChar();
  await S.type(`.gw [data-input="ed-extra"][data-key="agent|스팡달|${xi}"]`, '시험값1');
  const saved4 = await S.waitSave(n0);
  // 추가 칸 이름을 비우면 받지 않음(보통-69)
  await S.type(`.gw [data-input="ed-extra-name"][data-key="agent|스팡달|${xi}"]`, '');
  const warn = await S.text('.gw .gw-xname-warn');
  await S.type(`.gw [data-input="ed-extra-name"][data-key="agent|스팡달|${xi}"]`, '시험칸1');
  // B-05 글로 가져오기
  await S.act('ed-import-toggle');
  await S.type('.gw [data-input="ed-import"]', '# Personality\n시험성격1\n# 시험절2\n시험내용2');
  await S.act('ed-import-parse');
  const map = await S.page.evaluate(() => [...document.querySelectorAll('.gw .gw-map tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  n0 = await S.setChar();
  await S.act('ed-import-apply');
  const saved5 = await S.waitSave(n0);
  // B-06 순서: 「소개」를 위로 한 칸
  n0 = await S.setChar();
  await S.act('ed-field-up', 'intro');
  const saved6 = await S.waitSave(n0);
  // 조립 글 보기
  await S.act('ed-preview');
  const preview = await S.text('.gw .gw-preview');
  dump('B-06_조립글_스팡달.txt', scrubRoster(preview));
  const ov = W(await S.dir()).agent?.['스팡달'] ?? {};
  check('B-02', '스팡달 「소개」 고침이 바로 카드 「세계」 덧쓰기에 저장', '세계.agent.스팡달.fields.intro 에 시험소개1', 'K-01 (사용자 결정)', saved2 && String(ov2?.fields?.intro ?? '').includes('시험소개1'), { saved2, intro: ov2?.fields?.intro });
  check('B-04', '추가 칸 「시험칸1」 저장, 빈 이름은 받지 않고 칸 아래 알림', 'extra[0] 시험칸1=시험값1, 알림 「칸 이름을 적어 주세요」', '전수점검 보통-69 (Claude 판정)', saved4 && ov.extra?.some((e) => e.name === '시험칸1' && e.value === '시험값1' && e.kind === 'block') && /칸 이름/.test(warn), { xi, extra: ov.extra, warn });
  check('B-05', '글로 가져오기: Personality→성격 칸, 모르는 절→추가 칸, 이대로 넣기 뒤 저장', '배정표 2줄, fields.character 에 시험성격1, extra 에 시험절2', 'Claude 판정 (화면 설명 글)', saved5 && String(ov.fields?.character ?? '').includes('시험성격1') && ov.extra?.some((e) => e.name === '시험절2'), { map, character: String(ov.fields?.character ?? '').slice(-40), extra: ov.extra?.map((e) => e.name) });
  check('B-06', '순서 ▲ 가 덧쓰기 order 에 저장되고 조립 글에 시험값1·시험성격1·시험내용2 가 들어감', 'order 있음, 조립 글에 셋 다', 'Claude 판정', saved6 && Array.isArray(ov.order) && ['시험값1', '시험성격1', '시험내용2'].every((t) => preview.includes(t)), { order: ov.order, has: ['시험값1', '시험성격1', '시험내용2'].map((t) => preview.includes(t)) }, 'out/B-06_조립글_스팡달.txt');
  await S.closeEd();
  const r2a = await S.request('복도 끝 사무실 문을 연다.');
  reqDump('B-02b_요청_스팡달소개.txt', r2a);
  const rosterLine = all(r2a).split('\n').find((l) => l.startsWith('- Spangdal ')) ?? '';
  await S.page.evaluate(() => window.__chat.message.pop());
  const r2 = await S.request('시험별칭1 에게 말을 건다.');
  reqDump('B-02_요청_스팡달고침.txt', r2);
  const t2 = all(r2);
  const loreOn = /### Character - Spangdal|## 스팡달|\bSpangdal\b[\s\S]{0,50}시험값1/.test(t2) || t2.includes('시험값1');
  check('B-02b', '다음 본편 요청 Roster 의 스팡달 줄에 「시험소개1」', 'Roster 줄에 시험소개1', '코스 K4 「다음 턴 Roster 반영」', rosterLine.includes('시험소개1'), { rosterLine: scrubRoster(rosterLine) }, 'out/B-02b_요청_스팡달소개.txt');
  check('B-03', '별칭 「시험별칭1」을 말하면 스팡달 캐릭터 로어가 켜지고 추가 칸·가져온 절이 함께 감', '요청에 시험값1·시험내용2', '코스 K4 · Claude 판정', saved3 && loreOn && t2.includes('시험내용2'), { saved3, 시험값1: t2.includes('시험값1'), 시험내용2: t2.includes('시험내용2') });
  await S.page.evaluate(() => window.__chat.message.pop());

  // B-07 명부 지침에 포함 끔 → Roster 에서 빠짐
  await S.openEd('agent');
  await S.act('ed-sel', '스팡달');
  n0 = await S.setChar();
  await S.act('ed-roster-toggle', '');
  const saved7 = await S.waitSave(n0);
  await S.closeEd();
  const r3 = await S.request('복도를 걷는다.');
  const rl3 = all(r3).split('\n').find((l) => l.startsWith('- Spangdal ')) ?? '';
  check('B-07', '「명부 지침에 포함」 끄면 다음 요청 Roster 에서 Spangdal 줄이 빠짐', '줄 없음', '화면 설명 「명부 지침(🙂Roster)에 들어가지 않아요」', saved7 && !rl3, scrubRoster(rl3));
  await S.page.evaluate(() => window.__chat.message.pop());

  // B-08 K-19: 소속 미정·직급 비우기는 남고, 성별·사진은 비우면 기본값
  await S.openEd('agent');
  await S.act('ed-sel', '고그니쟈');
  n0 = await S.setChar();
  await S.act('dir-org-pick', '|고그니쟈');
  await S.type('.gw [data-input="dir"][data-key="rank|고그니쟈"]', '');
  const saved8 = await S.waitSave(n0);
  await S.closeEd();
  await S.openEd('agent');
  await S.act('ed-sel', '고그니쟈');
  const g8 = await S.page.evaluate(() => ({ none: document.querySelector('.gw [data-action="dir-org-pick"][data-value="|고그니쟈"]')?.getAttribute('aria-pressed'), rank: document.querySelector('.gw [data-key="rank|고그니쟈"]')?.value }));
  const d8 = (await S.dir()).요원['고그니쟈'];
  check('B-08', '소속 「미정」·직급 비움은 저장 뒤 다시 열어도 그대로(되살아나지 않음)', '미정 눌림, 직급 빈 값, 명부 affiliation 없음', 'K-19 (사용자 결정 11-14 F-6)', saved8 && g8.none === 'true' && g8.rank === '' && !d8.affiliation && !d8.rank, { g8, d8: { affiliation: d8.affiliation, rank: d8.rank } });
  const alert = await S.text('.gw');
  check('B-08b', '소속 미정 요원이 생기면 경고 줄은? (세계 편집기 요원 목록)', '참고', '—', null, /소속을 정하지 않은 요원/.test(alert) ? '경고 줄 있음' : '경고 줄 없음(설정 창 요원 목록)');
  // 성별: 로어북 성별과 다르게 → 명부에 gender, 다시 로어북과 같게 → 지움
  n0 = await S.setChar();
  await S.act('dir-gender', 'F|고그니쟈');
  await S.waitSave(n0);
  const gF = (await S.dir()).요원['고그니쟈'].gender;
  n0 = await S.setChar();
  await S.act('dir-gender', 'X|고그니쟈');
  await S.waitSave(n0);
  const gX = (await S.dir()).요원['고그니쟈'].gender;
  await S.closeEd();
  await S.openEd('agent');
  await S.act('ed-sel', '고그니쟈');
  const gChip = await S.page.evaluate(() => [...document.querySelectorAll('.gw [data-action="dir-gender"]')].map((e) => `${e.dataset.value.split('|')[0]}:${e.getAttribute('aria-pressed')}`).join(' '));
  check('B-09', '성별 칩: F(로어북과 다름) 저장 → 미정(X)으로 바꾸면 명부·화면', '참고: 미정이 남는지 로어북 성별로 돌아가는지', 'K-19 「요원 사진·성별은 비워 저장하면 기본값이 다시」', null, { gF, gX, chips: gChip });
  // 사진 고르기·자동으로·얼굴 틀
  await S.act('dir-photo-pick', 'main>고그니쟈');
  const pics = await S.page.evaluate(() => [...document.querySelectorAll('.gw .dir-pic')].slice(0, 3).map((e) => e.dataset.value));
  await S.page.screenshot({ path: `${OUT}B-10_사진고르기_PC.png` });
  n0 = await S.setChar();
  if (pics[1]) await S.act('dir-photo-set', pics[1]);
  await S.waitSave(n0);
  const ph1 = (await S.dir()).요원['고그니쟈'].photo;
  n0 = await S.setChar();
  await S.act('dir-photo-set', '|main>고그니쟈');
  await S.waitSave(n0);
  const ph2 = (await S.dir()).요원['고그니쟈'].photo;
  check('B-10', '사진 고르기 → 명부 photo 저장, 「자동으로」 → photo 지움', `photo=${pics[1]?.split('|')[0]} → 없음`, 'K-19 · Claude 판정', !!ph1 && ph1 === pics[1]?.split('|')[0] && !ph2, { pics, ph1, ph2 });
  const cropBtn = await S.has('.gw [data-action="dir-crop"]');
  if (cropBtn) {
    await S.act('dir-crop', '고그니쟈');
    n0 = await S.setChar();
    await S.type('.gw [data-input="dir-crop-size"]', '40', { ev: 'input' });
    await S.type('.gw [data-input="dir-crop-size"]', '40', { ev: 'change' });
    await S.waitSave(n0);
    await S.page.screenshot({ path: `${OUT}B-11_얼굴틀_PC.png` });
  }
  const crop = (await S.dir()).요원['고그니쟈'].crop;
  check('B-11', '얼굴 틀 크기 40 → 명부 crop 의 셋째 값 40', 'crop "x,y,40"', 'Claude 판정', cropBtn && /,40$/.test(String(crop ?? '')), { cropBtn, crop });
  // B-12 칸 → 새로 고침 없이 페이지 옮기기: 거점 페이지로 0.3초 안에 옮기면 (resetDirectory)
  await S.act('ed-sel', '큐라스');
  n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="rank|큐라스"]', '시험직급1', { wait: 50 });
  await S.node('base');
  await sleep(2500);
  const kq = (await S.dir()).요원['큐라스'].rank;
  check('B-12', '요원 직급을 친 직후(0.7초 안) 「거점」 페이지로 옮겨도 고친 값이 저장', 'rank=시험직급1', 'K-01 바로 저장 (사용자 결정)', kq === '시험직급1', { rank: kq, writes: (await S.setChar()) - n0 }, 'src/ui/editor/index.ts:1128 resetDirectory');
  await S.node('agent');
  await S.act('ed-sel', '큐라스');
  n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="rank|큐라스"]', '시험직급1', { wait: 50 });
  await S.node('org');
  await sleep(2500);
  const kq2 = (await S.dir()).요원['큐라스'].rank;
  check('B-12b', '같은 것을 「조직」 페이지로 옮길 때 (비교)', 'rank=시험직급1', 'K-01', kq2 === '시험직급1', kq2);
  await S.closeEd();
  check('B-13', '요원 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ C. 조직: 추가·로어 칸·관계·이름 바꾸기·지우기·세력별 시점 글 ═══
if (want('C')) {
  const S = await fresh();
  await S.openEd('org');
  await S.act('ed-add-toggle');
  let n0 = await S.setChar();
  await S.take('ed-new-name', '시험조직1', 'ed-add');
  let ok = await S.waitSave(n0);
  await S.closeEd();
  await S.openEd('org');
  await S.act('ed-sel', '시험조직1');
  const hasRow = await S.has('.gw .gw-basic [data-action="dir-org-rename"]');
  n0 = await S.setChar();
  await S.type('.gw [data-input="ed-field"][data-key="org|시험조직1|intro"]', '시험조직 소개 첫 문단.\n\n둘째 문단.');
  await S.waitSave(n0);
  const d1 = await S.dir();
  check('C-01', '조직 기록 「시험조직1」 만들기 → 저장 뒤 명부 조직 줄 생김(기본 정보에 이름 바꾸기·지우기)', '세계.org.시험조직1 · 명부 조직.시험조직1', 'Claude 판정 (화면 「저장 뒤 명부 줄이 생기면」)', ok && !!W(d1).org?.['시험조직1'] && !!d1.조직['시험조직1'] && hasRow, { ok, rec: !!W(d1).org?.['시험조직1'], dirRow: !!d1.조직['시험조직1'], hasRow });
  // 관계: 관리국 → 시험조직1 적대 (대칭 켬)
  await S.node('relations');
  await S.act('ed-rel-pick', '관리국');
  n0 = await S.setChar();
  await S.act('ed-rel-set', '관리국>시험조직1:hostile');
  await S.waitSave(n0);
  await S.closeEd();
  let r = await S.request('본부 회의실에 들어간다.');
  reqDump('C-02_요청_시험조직1.txt', r);
  let t = all(r);
  const facHead = /### 시험조직1/.test(t);
  const tblRow = t.split('\n').find((l) => /\| \d+ 시험조직1 \|/.test(l)) ?? '';
  check('C-02', '다음 요청 📜Faction 에 「### 시험조직1」 소개, 관계 표에 시험조직1 줄(관리국 쪽 H, 대칭)', '제목·표 줄, 시험조직1→관리국 H', '코스 K4 「Faction 로어 반영」, 세력 관계 대칭 (화면 설명)', facHead && /\| H \|/.test(tblRow), { facHead, tblRow }, 'out/C-02_요청_시험조직1.txt');
  await S.page.evaluate(() => window.__chat.message.pop());
  // 이름 바꾸기
  await S.openEd('org');
  await S.act('ed-sel', '시험조직1');
  n0 = await S.setChar();
  await S.take('dir-org-name', '시험조직2', 'dir-org-rename');
  ok = await S.waitSave(n0);
  await sleep(800);
  const d2 = await S.dir();
  const sel2 = await S.page.evaluate(() => document.querySelector('.gw .gw-detail h2')?.textContent ?? '');
  const ghost = await S.page.evaluate(() => [...document.querySelectorAll('.gw .gw-row b')].map((e) => e.textContent).filter((n) => n.startsWith('시험조직')));
  const rel2 = W(d2).relations?.pairs ?? {};
  check('C-03', '조직 이름 바꾸기 → 명부·기록·관계 덧쓰기가 새 이름으로, 목록에 옛 이름 유령 줄 없음', '조직/세계.org 에 시험조직2만, 관계 쌍 관리국>시험조직2', '전수검사 11-13 주석 (Claude 판정)', ok && d2.조직['시험조직2'] && !d2.조직['시험조직1'] && W(d2).org?.['시험조직2'] && !W(d2).org?.['시험조직1'] && rel2['관리국>시험조직2'] && !rel2['관리국>시험조직1'] && ghost.length === 1, { org: Object.keys(d2.조직).filter((k) => k.startsWith('시험')), rec: Object.keys(W(d2).org ?? {}).filter((k) => k.startsWith('시험')), rel: Object.keys(rel2), ghost, sel2 });
  await S.closeEd();
  r = await S.request('회의실을 나선다.');
  t = all(r);
  check('C-03b', '이름 바꾼 뒤 다음 요청 Faction·관계 표가 시험조직2', '시험조직2 있음, 시험조직1 없음', '코스 K4', t.includes('시험조직2') && !t.includes('시험조직1'), { has2: t.includes('시험조직2'), has1: t.includes('시험조직1') });
  await S.page.evaluate(() => window.__chat.message.pop());
  // 지우기: 기본 정보의 지우기(dir-org-del) — 로어 칸이 있으면 기록도 같이 지워지나
  await S.openEd('org');
  await S.act('ed-sel', '시험조직2');
  n0 = await S.setChar();
  await S.act('dir-org-del', '시험조직2');
  ok = await S.waitSave(n0);
  const d3 = await S.dir();
  const list3 = await S.page.evaluate(() => [...document.querySelectorAll('.gw .gw-row b')].map((e) => e.textContent).filter((n) => n.startsWith('시험조직')));
  await S.closeEd();
  r = await S.request('계단을 내려간다.');
  t = all(r);
  reqDump('C-04_요청_조직지운뒤.txt', r);
  check('C-04', '기본 정보 「지우기」(dir-org-del) → 명부 조직 줄이 빠지고, 다음 요청 Faction 에 시험조직2 없음', '명부 없음 · 요청 없음', 'K-19 「지운 거점·조직은 되살아나지 않음」(사용자 결정)', ok && !d3.조직['시험조직2'] && !t.includes('시험조직2'), { dirRow: !!d3.조직['시험조직2'], rec: !!W(d3).org?.['시험조직2'], inReq: t.includes('시험조직2'), list3 }, 'out/C-04_요청_조직지운뒤.txt');
  await S.page.evaluate(() => window.__chat.message.pop());
  await S.openEd('org');
  await S.act('ed-sel', '시험조직2');
  const head4 = await S.text('.gw .gw-detail .gw-head');
  await S.page.screenshot({ path: `${OUT}C-04_조직지운뒤_PC.png` });
  // 머리의 「삭제」(ed-delete) 로는
  await S.act('ed-delete');
  const pop4 = await S.text('.gw .gw-confirm');
  n0 = await S.setChar();
  await S.act('ed-delete-yes');
  await S.waitSave(n0);
  const d4 = await S.dir();
  await S.closeEd();
  r = await S.request('계단을 내려간다.');
  check('C-04b', '같은 조직을 머리의 「삭제」로 지우면 확인 팝업 → 기록까지 빠지고 다음 요청에서도 없음', '세계.org.시험조직2 없음 · 요청 없음', 'record.ts ed-delete-yes 주석 (2026-11-05 사용자)', !W(d4).org?.['시험조직2'] && !all(r).includes('시험조직2'), { head4: head4.slice(0, 120), pop4, rec: !!W(d4).org?.['시험조직2'], inReq: all(r).includes('시험조직2') });
  await S.page.evaluate(() => window.__chat.message.pop());
  // 세력별 시점 글: 관리국 기록에 백일몽(C00) 시점 소개
  await S.openEd('org');
  await S.act('ed-sel', '관리국');
  await S.page.evaluate(() => { const s = document.querySelector('.gw [name="ed-variant-new"]'); if (s) s.value = 'C00'; });
  await S.act('ed-variant-add');
  n0 = await S.setChar();
  await S.type('.gw [data-input="ed-field"][data-key="org|관리국|intro"]', '시험시점글1 백일몽이 보는 관리국.');
  await S.waitSave(n0);
  const v = W(await S.dir()).org?.['관리국']?.variants;
  await S.closeEd();
  r = await S.request('창밖을 본다.');
  const a00 = all(r).includes('시험시점글1');
  await S.page.evaluate(() => { window.__chat.message.pop(); window.__chat.scriptstate.$st_faction = 'C00'; });
  r = await S.request('창밖을 본다.');
  reqDump('C-05_요청_C00시점.txt', r);
  const c00 = all(r).includes('시험시점글1');
  check('C-05', '관리국 기록에 「백일몽 시점」 소개를 쓰면 C00 으로 플레이할 때만 그 글', 'A00 요청 없음 · C00 요청 있음', '화면 설명 「그 세력으로 플레이할 때만」', !!v?.C00 && !a00 && c00, { variants: Object.keys(v ?? {}), a00, c00 }, 'out/C-05_요청_C00시점.txt');
  check('C-06', '조직 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ D. 세력 관계: 대칭 켬/끔, 기본값으로 돌아가면 덧쓰기 지움, 관계도 제외 ═══
if (want('D')) {
  const S = await fresh();
  await S.openEd('relations');
  await S.act('ed-rel-pick', '관리국');
  let n0 = await S.setChar();
  await S.act('ed-rel-set', '관리국>백일몽:friendly');
  await S.waitSave(n0);
  let p = W(await S.dir()).relations?.pairs ?? {};
  const symOn = p['관리국>백일몽']?.stage === 'friendly' && p['백일몽>관리국']?.stage === 'friendly';
  // 대칭 끄기
  await S.act('ed-rel-sym');
  const prefSym = JSON.parse(await S.page.evaluate(() => window.__store['p:goei:prefs'])).relationsSym;
  n0 = await S.setChar();
  await S.act('ed-rel-set', '관리국>백일몽:hostile');
  await S.waitSave(n0);
  p = W(await S.dir()).relations?.pairs ?? {};
  const symOff = p['관리국>백일몽']?.stage === 'hostile' && p['백일몽>관리국']?.stage === 'friendly';
  await S.closeEd();
  const r = await S.request('보고서를 넘긴다.');
  reqDump('D-01_요청_관계.txt', r);
  const rows = all(r).split('\n').filter((l) => /^\| (1 Management Bureau|3 Baekilmong) \|/.test(l));
  const cell = (row, col) => row?.split('|').map((x) => x.trim()).filter((x, i) => i > 0)[col];
  check('D-01', '대칭 켬(기본): 관리국→백일몽 우호로 바꾸면 양쪽 다 바뀜', '두 쌍 friendly', '코스 K4 「세력 관계(대칭)」, 화면 설명', symOn, p);
  check('D-02', '대칭 끔: 한쪽만 바뀌고, 대칭 설정은 기기 저장소 goei:prefs.relationsSym=false', '관리국>백일몽 hostile, 반대 friendly, prefs false', '화면 설명 · Claude 판정(기기 값)', symOff && prefSym === false, { pairs: p, prefSym });
  check('D-03', '다음 요청 관계 표: 1행 3열 H, 3행 1열 A', 'H / A', '코스 K4', cell(rows[0], 3) === 'H' && cell(rows[1], 1) === 'A', rows, 'out/D-01_요청_관계.txt');
  await S.page.evaluate(() => window.__chat.message.pop());
  // 기본값(원래 단계)로 되돌리면 덧쓰기 지움
  await S.openEd('relations');
  await S.act('ed-rel-pick', '관리국');
  n0 = await S.setChar();
  await S.act('ed-rel-set', '관리국>백일몽:wary');
  await S.act('ed-rel-pick', '백일몽');
  await S.act('ed-rel-set', '백일몽>관리국:wary');
  await S.waitSave(n0);
  await sleep(800);
  p = W(await S.dir()).relations?.pairs ?? {};
  check('D-04', '원래 단계(경계)로 되돌리면 덧쓰기에서 빠짐(= 기본값)', 'pairs 에 관리국>백일몽·백일몽>관리국 없음', 'Claude 판정 (relations.ts setCell 주석)', !('관리국>백일몽' in p) && !('백일몽>관리국' in p), p);
  // 관계도에서 제외
  await S.act('ed-rel-pick', '세계정치 게시판');
  n0 = await S.setChar();
  await S.act('ed-rel-org', '세계정치 게시판');
  await S.waitSave(n0);
  await S.closeEd();
  const r2 = await S.request('보고서를 넘긴다.');
  const t2 = all(r2);
  const header = t2.split('\n').find((l) => l.startsWith('| viewer')) ?? '';
  check('D-05', '「세력 관계도에 포함」 끄면 다음 요청 관계 표에서 그 조직이 빠짐', '14열 → 13열, World Politics Forum 줄 없음', '화면 설명', !/\| \d+ The World Politics Forum \|/.test(t2) && (header.match(/\|/g) ?? []).length === 15, header);
  // 대칭 다시 켬(다음 절이 기본으로 돌게)
  await S.openEd('relations');
  await S.act('ed-rel-sym');
  await S.closeEd();
  check('D-06', '관계 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ E. 괴이·파밍: 표시 이름, 발생 후보, 다른 폴더에서 들이기, 공통 머리말, 로어 칸 ═══
if (want('E')) {
  const S = await fresh();
  await S.openEd('anomaly');
  await S.act('ed-sel', '명일 아파트');
  let n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="label|명일 아파트"]', '명일 아파트 시험');
  await S.type('.gw [data-input="ed-field"][data-key="anomaly|명일 아파트|rules"]', '시험규칙1');
  await S.waitSave(n0);
  // 괴이 공통 머리말
  await S.act('ed-anote-toggle');
  const note0 = await S.val('.gw [data-input="ed-anote"]');
  n0 = await S.setChar();
  await S.type('.gw [data-input="ed-anote"]', `${note0}\n시험머리말1`);
  await S.waitSave(n0);
  await S.act('ed-anote-toggle');
  // 발생 후보 끄기 (목록 줄 단추)
  n0 = await S.setChar();
  await S.act('dir-set', 'preset|0|소라 랜드');
  await S.waitSave(n0);
  // 다른 폴더에서 추가
  await S.act('dir-add-toggle');
  const ext = await S.page.evaluate(() => [...document.querySelectorAll('.gw .dir-ext-item')].map((e) => `${e.dataset.value}·${e.querySelector('small')?.textContent}`));
  await S.page.screenshot({ path: `${OUT}E-03_다른폴더_PC.png` });
  n0 = await S.setChar();
  const pickExt = ext.find((x) => x.startsWith('흡혈귀·')) ? '흡혈귀' : ext[0]?.split('·')[0];
  await S.act('dir-ext-add', pickExt);
  await S.waitSave(n0);
  let d = await S.dir();
  const selAfter = await S.page.evaluate(() => document.querySelector('.gw .gw-detail h2')?.textContent ?? '');
  check('E-03', '「다른 폴더에서 추가」 목록(세력·요원 등 다른 폴더 로어북) → 하나 넣으면 괴이 후보(발생 켬)로 저장, 바로 그 기록이 열림', `괴이.${pickExt}.preset=true`, '사용자 2026-10-21 (record.ts 주석) · 코스 K4', !!d.괴이[pickExt]?.preset && selAfter.includes(pickExt), { n: ext.length, sample: ext.slice(0, 6), saved: d.괴이[pickExt], selAfter });
  check('E-01', '표시 이름 「명일 아파트 시험」·로어 칸·발생 후보 끔 저장', 'label·rules·preset=false', 'K-01', d.괴이['명일 아파트'].label === '명일 아파트 시험' && d.괴이['소라 랜드'].preset === false && String(W(d).anomaly?.['명일 아파트']?.fields?.rules ?? '').includes('시험규칙1'), { label: d.괴이['명일 아파트'].label, preset: d.괴이['소라 랜드'].preset, rules: W(d).anomaly?.['명일 아파트']?.fields?.rules });
  await S.closeEd();
  const r = await S.request('명일 아파트 쪽 상황을 묻는다.');
  reqDump('E-02_요청_괴이고침.txt', r);
  const t = all(r);
  const anLine = t.split('\n').filter((l) => /^\[AN\|/.test(l) && /명일 아파트/.test(l));
  check('E-02', '다음 요청: 괴이 로어에 시험규칙1·시험머리말1 (World Entries 줄 이름은 로어북 이름 그대로)', '본문 둘 다', '코스 K4', t.includes('시험규칙1') && t.includes('시험머리말1'), { anLine, 규칙: t.includes('시험규칙1'), 머리말: t.includes('시험머리말1') }, 'out/E-02_요청_괴이고침.txt');
  await S.page.evaluate(() => window.__chat.message.pop());
  await S.openWin();
  await S.act('tab', 'board', { scope: '.gx', wait: 900 });
  const boardTxt = await S.text('.gx');
  await S.page.screenshot({ path: `${OUT}E-02b_상황판_표시이름_PC.png` });
  check('E-02b', '상황판 화면에는 표시 이름 「명일 아파트 시험」', '상황판 글에 명일 아파트 시험', '화면 설명 「상황판과 지도에 보이는 이름」 → 참고: 이미 상황판에 뜬 항목은 뜰 때 이름(catalog.ts:89 은 새로 뽑을 때 label)', null, { has: boardTxt.includes('명일 아파트 시험'), old: (boardTxt.match(/명일 아파트[^\n]{0,8}/g) ?? []).slice(0, 4) });
  await S.closeWin();
  await S.page.evaluate(() => window.__chat.message.push({ role: 'user', data: 'x', chatId: 'pad' }));
  await S.page.evaluate(() => window.__chat.message.pop());
  // 들인 후보가 상황판 태그로 받아지는지 (모델이 그 이름으로 AN 을 적음)
  await S.page.evaluate(() => window.__chat.message.push({ role: 'user', data: '흡혈귀 소문을 확인한다.', chatId: 't1uE' }));
  await S.reply(`소문을 확인했다.\n\n[AN|서울특별시 중구|${pickExt}|활성|C|없음|시험 상황 한 줄]\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]`);
  const w = JSON.parse((await S.chat()).scriptstate.$goei_world || '{}');
  check('E-04', '들인 후보 이름으로 적은 [AN] 태그가 상황판에 들어감', `an 에 ${pickExt}`, '참고 (괴이 아닌 로어북도 「괴이처럼 발생」, 화면 설명)', null, (w.an ?? []).map((e) => `${e.name}|${e.state}`));
  // 후보 목록에서 빼기
  await S.openEd('anomaly');
  await S.act('ed-sel', pickExt);
  n0 = await S.setChar();
  await S.act('dir-ext-del', pickExt);
  await S.waitSave(n0);
  d = await S.dir();
  const selDel = await S.page.evaluate(() => document.querySelector('.gw .gw-detail')?.innerText.slice(0, 40) ?? '');
  check('E-05', '「후보 목록에서 빼기」 → 명부에서 빠지고 본문이 비어짐', `괴이.${pickExt} 없음`, '눌러 보기 3차 (Claude 판정)', !d.괴이[pickExt] && /고르세요/.test(selDel), { saved: d.괴이[pickExt] ?? null, selDel });
  // 파밍: 기록 칸
  await S.node('site');
  const sites = await S.page.evaluate(() => [...document.querySelectorAll('.gw .gw-row b')].map((e) => e.textContent));
  const site = sites.includes('도깨비 공방') ? '도깨비 공방' : sites[0];
  await S.act('ed-sel', site);
  n0 = await S.setChar();
  await S.type(`.gw [data-input="ed-field"][data-key="site|${site}|keeper"]`, '시험주인1');
  await S.waitSave(n0);
  await S.closeEd();
  const r2 = await S.request(`${site}에 가 본다.`);
  check('E-06', `파밍 「${site}」 주인 칸 고침 → 그 이름을 말한 다음 요청에 시험주인1`, '요청에 시험주인1', '코스 K4', all(r2).includes('시험주인1'), { site, has: all(r2).includes('시험주인1') });
  check('E-07', '괴이·파밍 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ F. 부록: 조건·해금 ═══
if (want('F')) {
  const S = await fresh();
  await S.openEd('appendix');
  const apps = await S.page.evaluate(() => [...document.querySelectorAll('.gw .gw-row b')].map((e) => e.textContent));
  const app = apps[0];
  await S.act('ed-sel', app);
  const parent = await S.val(`.gw [data-key="app:parent|${app}"]`);
  const toggles0 = await S.page.evaluate(() => [...document.querySelectorAll('.gw [data-action="dir-app-toggle"]')].map((e) => `${e.dataset.value.split('|')[0]}:${e.getAttribute('aria-pressed')}`));
  let n0 = await S.setChar();
  if (!toggles0.includes('withParent:true')) await S.act('dir-app-toggle', `withParent|${app}`);
  await S.type(`.gw [data-key="app:unlock|${app}"]`, '시험해금조건1');
  await S.waitSave(n0);
  const d = await S.dir();
  await S.closeEd();
  const r = await S.request(`${parent} 이야기를 꺼낸다.`);
  reqDump('F-01_요청_부록잠김.txt', r);
  const t = all(r);
  check('F-01', `부록 「${app}」(본 항목 ${parent}) 해금 조건을 적으면 해금 전엔 조건 한 줄만`, '요청에 시험해금조건1, 부록 본문 없음', '화면 설명 「해금 전에는 본문 대신 이 조건 한 줄만」', t.includes('시험해금조건1'), { apps, toggles0, unlock: d.부록?.[app], has: t.includes('시험해금조건1') }, 'out/F-01_요청_부록잠김.txt');
  await S.page.evaluate(() => window.__chat.message.pop());
  await S.openEd('appendix');
  await S.act('ed-sel', app);
  const c0 = await S.page.evaluate(() => window.__calls.setChat.length);
  await S.act('dir-app-unlock', app, { wait: 900 });
  const unlocked = (await S.chat()).scriptstate?.$lore_unlocked ?? Object.entries((await S.chat()).scriptstate ?? {}).find(([k]) => /unlock/i.test(k));
  await S.closeEd();
  const r2 = await S.request(`${parent} 이야기를 꺼낸다.`);
  const t2 = all(r2);
  check('F-02', '「이 채팅 · 누르면 해금」 → 지금 채팅에만 적히고 다음 요청에 조건 줄 대신 본문', '채팅 변수에 해금, 요청에 시험해금조건1 없음', '화면 설명 (해금은 채팅마다)', (await S.page.evaluate(() => window.__calls.setChat.length)) > c0 && !t2.includes('시험해금조건1'), { unlocked, has: t2.includes('시험해금조건1') });
  check('F-03', '부록 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ G. 거점: 새로·숨김·이름 바꾸기·지우기, 비우면 다시 채워지는 칸(K-19), 지도 반영 ═══
if (want('G')) {
  const S = await fresh();
  await S.openEd('base');
  await S.act('dir-add-toggle');
  let n0 = await S.setChar();
  await S.take('dir-base-new', '시험거점1', 'dir-base-new');
  await S.waitSave(n0);
  let d = await S.dir();
  const g1 = d.거점['시험거점1'];
  check('G-01', '거점 추가 「시험거점1」 → 명부 거점에 저장(지역 02, 가운데 50·50, 보임)', '거점.시험거점1', 'K-01', !!g1, g1);
  // 조직 고르기, 지역·시군구, 지도 누르기
  n0 = await S.setChar();
  await S.act('dir-base-org', '관리국|시험거점1');
  await S.page.evaluate(() => { const s = document.querySelector('.gw [data-change="dir-base-gu"]'); if (s) { s.value = '중구'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await sleep(500);
  const mapImg = await S.has('.gw [data-base-pick="시험거점1"] img');
  if (mapImg) { const loc = S.page.locator('.gw [data-base-pick="시험거점1"] img'); await loc.scrollIntoViewIfNeeded(); const box = await loc.boundingBox(); if (box) await loc.click({ position: { x: box.width * 0.3, y: box.height * 0.4 }, force: true }); }
  await S.waitSave(n0);
  await sleep(600);
  d = await S.dir();
  await S.page.screenshot({ path: `${OUT}G-02_거점편집_PC.png` });
  check('G-02', '조직·시군구·지도 누른 자리 저장', 'org=관리국, gu=중구, x≈30, y≈40', 'Claude 판정', d.거점['시험거점1']?.org === '관리국' && d.거점['시험거점1']?.gu === '중구' && (!mapImg || Math.abs(d.거점['시험거점1'].x - 30) < 3), { saved: d.거점['시험거점1'], mapImg });
  await S.closeEd();
  // 지도 반영: 본 창 임무 지도(서울 02)에 「시험거점1」
  await S.openWin();
  const tabs = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="tab"], .gx [data-action="nav-tab"]')].map((e) => e.dataset.value));
  if (tabs.includes('map')) await S.act('tab', 'map', { scope: '.gx', wait: 800 }) || await S.act('nav-tab', 'map', { scope: '.gx', wait: 800 });
  await S.act('map-region', '02', { scope: '.gx', wait: 900 });
  const mapTxt = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="map-place"], .gx .gx-pin, .gx [class*="pin"]')].map((e) => e.textContent.trim() || e.dataset.value).filter(Boolean));
  await S.page.screenshot({ path: `${OUT}G-03_지도_PC.png` });
  check('G-03', '저장한 거점이 본 창 지도(서울)에 보임', '시험거점1 (또는 표시명) 핀', '코스 K4 「지도 반영」', mapTxt.some((x) => /시험거점1/.test(x)), { tabs, mapTxt: mapTxt.slice(0, 20) });
  await S.closeWin();
  // 숨김
  await S.openEd('base');
  await S.act('dir-open', '시험거점1');
  n0 = await S.setChar();
  await S.act('dir-base-show', '0|시험거점1');
  await S.waitSave(n0);
  d = await S.dir();
  await S.closeEd();
  await S.openWin();
  if (tabs.includes('map')) await S.act('tab', 'map', { scope: '.gx', wait: 800 }) || await S.act('nav-tab', 'map', { scope: '.gx', wait: 800 });
  await S.act('map-region', '02', { scope: '.gx', wait: 900 });
  const mapTxt2 = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="map-place"], .gx .gx-pin, .gx [class*="pin"]')].map((e) => e.textContent.trim() || e.dataset.value).filter(Boolean));
  check('G-04', '숨김 → 명부 show=false, 지도에서 빠짐', 'show false · 핀 없음', '화면 설명 「지도에 보이기」', d.거점['시험거점1']?.show === false && !mapTxt2.some((x) => /시험거점1/.test(x)), { show: d.거점['시험거점1']?.show, mapTxt2: mapTxt2.slice(0, 20) });
  await S.closeWin();
  // 이름 바꾸기·지우기(확인 팝업)
  await S.openEd('base');
  await S.act('dir-open', '시험거점1');
  n0 = await S.setChar();
  await S.take('dir-base-name', '시험거점2', 'dir-base-rename');
  await S.waitSave(n0);
  await S.act('dir-base-del', 'ask|시험거점2');
  const pop = await S.text('.gw .gw-confirm');
  await S.page.screenshot({ path: `${OUT}G-05_거점지우기확인_PC.png` });
  n0 = await S.setChar();
  await S.act('dir-base-del', 'yes|시험거점2');
  await S.waitSave(n0);
  d = await S.dir();
  check('G-05', '이름 바꾸기 뒤 지우기: 가운데 확인 팝업 → 지우기 → 명부에서 빠짐', '팝업 글 「거점을 지울까요?」, 거점.시험거점2 없음', '전수검사 11-13 사용자 승인 (한 번 더 묻기)', /지울까요/.test(pop) && !d.거점['시험거점2'] && !d.거점['시험거점1'], { pop, keys: Object.keys(d.거점) });
  // K-19: 영문명·별칭 비우기 → 다시 채워짐 / 조직 없음
  await S.act('dir-open', '관리국 본부');
  n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="base:english|관리국 본부"]', '');
  await S.act('dir-base-org', '|관리국 본부');
  await S.waitSave(n0);
  const raw = (await S.dir()).거점['관리국 본부'];
  await S.closeEd();
  await S.openEd('base');
  await S.act('dir-open', '관리국 본부');
  const back = await S.page.evaluate(() => ({ en: document.querySelector('.gw [data-key="base:english|관리국 본부"]')?.value, org: [...document.querySelectorAll('.gw [data-action="dir-base-org"]')].find((e) => e.getAttribute('aria-pressed') === 'true')?.textContent }));
  check('G-06', '거점 영문명·조직을 비워 저장 → 다시 열면?', 'K-19 문장: 기본값이 다시 들어옴', 'K-19 (사용자 결정 11-14 F-6 「그대로」, 지금 코드로 다시 확인 안 함)', null, { saved: raw, reopened: back });
  await S.node('org');
  await S.act('ed-sel', '남해지사');
  n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="org:english|남해지사"]', '');
  await S.waitSave(n0);
  const oraw = (await S.dir()).조직['남해지사'];
  await S.closeEd();
  await S.openEd('org');
  await S.act('ed-sel', '남해지사');
  const oback = await S.val('.gw [data-key="org:english|남해지사"]');
  check('G-06b', '조직 세부 칸(영문명)을 비워 저장 → 다시 열면?', 'K-19 문장: 기본값이 다시 들어옴', 'K-19', null, { saved: oraw, reopened: oback });
  await S.node('base');
  // 지운 기본 거점은 되살아나지 않음
  await S.act('dir-open', '서울중앙성원');
  await S.act('dir-base-del', 'ask|서울중앙성원');
  n0 = await S.setChar();
  await S.act('dir-base-del', 'yes|서울중앙성원');
  await S.waitSave(n0);
  await S.closeEd();
  await S.openEd('base');
  const has = await S.page.evaluate(() => [...document.querySelectorAll('.gw .dir-row .dir-name b')].map((e) => e.textContent));
  const dd = await S.dir();
  check('G-07', '기본 거점 「서울중앙성원」을 지우면 다시 열어도 없음', '목록·명부에 없음', 'K-19 「지운 거점·조직은 되살아나지 않는다」(사용자 결정)', !has.includes('서울중앙성원') && !dd.거점['서울중앙성원'], { has, removed: dd._removed });
  await S.closeEd();
  check('G-08', '거점 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ H. 시작 화면: 칸 보임·순서·묶음·첫 장면 글·시작 화면 이름·첫 장면 로어북 → 새 채팅 시작 패널·첫 요청 ═══
if (want('H')) {
  const S = await session(b, { chat: { message: [], scriptstate: {} }, prefs: PREFS });
  await S.openEd('start');
  let n0 = await S.setChar();
  await S.act('dir-start-show', '0|B00');
  // 순서: ▲▼ 단추는 없음(11-07 사용자: 손잡이 끌기) → C00 손잡이를 A00 줄 위쪽으로 끌어 놓기
  {
    const g = await S.page.locator('.gw [data-drag-slot="C00"]').boundingBox();
    const a = await S.page.locator('.gw [data-slot-row="A00"]').boundingBox();
    await S.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await S.page.mouse.down();
    await S.page.mouse.move(a.x + 40, a.y + 4, { steps: 8 });
    await S.page.mouse.up();
    await sleep(400);
  }
  await S.act('dir-start-open', 'A00');
  await S.type('.gw [data-input="dir"][data-key="org:title|관리국"]', '시험관리국');
  // 공용 장면 1 이름 고침
  await S.page.evaluate(() => document.querySelectorAll('.gw details.st-scene').forEach((d) => (d.open = true)));
  await S.type('.gw [data-input="dir"][data-key="scene:A00|1|label"]', '면접 시험');
  await S.act('dir-scene-add', 'A00');
  await S.page.evaluate(() => document.querySelectorAll('.gw details.st-scene').forEach((d) => (d.open = true)));
  const emptyScenePanel = await S.page.evaluate(() => [...document.querySelectorAll('.gw details.st-scene summary')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  await S.waitSave(n0);
  const sc = await S.page.evaluate(() => [...document.querySelectorAll('.gw details.st-scene summary')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  // 묶음 추가 → 이름 → 구성원
  n0 = await S.setChar();
  await S.act('dir-group-add');
  const gcode = await S.page.evaluate(() => document.querySelector('.gw .st-sel small')?.textContent ?? '');
  await S.type(`.gw [data-input="dir"][data-key="group:name|${gcode}"]`, '시험묶음1');
  await S.act('dir-group-member', `${gcode}|P003`);
  await S.waitSave(n0);
  await S.page.screenshot({ path: `${OUT}H-01_시작화면편집_PC.png`, fullPage: false });
  let d = await S.dir();
  // 조직을 시작 칸으로 (교황청)
  n0 = await S.setChar();
  await S.act('dir-fac-play', '1|교황청');
  await S.waitSave(n0);
  d = await S.dir();
  const vat = d.조직['교황청'];
  // 첫 장면 로어북 seed:A00-1 에 「명일 아파트」 더하기 (조직 › 관리국 기본 정보)
  await S.node('org');
  await S.act('ed-sel', '관리국');
  n0 = await S.setChar();
  const seed0 = await S.val('.gw [data-key="seed:A00-1"]');
  await S.type('.gw [data-key="seed:A00-1"]', `${seed0}, 명일 아파트`);
  await S.waitSave(n0);
  d = await S.dir();
  await S.closeEd();
  dump('H-명부.json', { 시작화면: d['시작 화면'], 첫장면: d['첫 장면'], 시작묶음: d['시작 묶음'], 교황청: vat, seedA001: d['시작 로어북']?.['A00-1'] });
  check('H-01', '시작 화면 편집(숨김·순서·이름·장면 이름·장면 추가·묶음·플레이 조직·첫 장면 로어북) 모두 카드 명부에 저장', '시작 화면 order·첫 장면·시작 묶음·교황청 code·시작 로어북 A00-1 에 명일 아파트', 'K-01 · B-04', d['시작 화면']?.order?.length && d['시작 묶음']?.['시험묶음1'] && vat?.code && d['시작 로어북']?.['A00-1']?.includes('명일 아파트') && d.조직['관리국']?.title === '시험관리국', { order: d['시작 화면']?.order, groups: Object.keys(d['시작 묶음'] ?? {}), vatCode: vat?.code, seed: d['시작 로어북']?.['A00-1'], title: d.조직['관리국']?.title, scenes: sc });
  // 새 채팅 시작 패널
  await S.openWin();
  const facs = await S.page.evaluate(() => [...document.querySelectorAll('.gx .gx-fac')].map((e) => `${e.dataset.value}:${e.innerText.replace(/\s+/g, ' ').slice(0, 30)}`));
  await S.page.screenshot({ path: `${OUT}H-02_시작패널_PC.png` });
  check('H-02', '새 채팅 시작 패널: 가짜 관리국 숨김, C00 를 A00 위로 끌어 놓음, 관리국 이름 「시험관리국」, 시험묶음1·교황청 칸', 'B00 없음, C00 이 맨 앞(끌어 놓기), 시험관리국·시험묶음1·교황청', '코스 K4 「시작 패널 반영」', !facs.some((f) => f.startsWith('B00')) && facs.findIndex((f) => f.startsWith('C00')) === 0 && facs.some((f) => f.includes('시험관리국')) && facs.some((f) => f.includes('시험묶음1')) && facs.some((f) => f.includes('교황청')), facs);
  await S.act('faction', 'A00', { scope: '.gx', wait: 500 });
  if (!(await S.has('.gx .gx-sc'))) await S.page.evaluate(() => document.querySelector('.gx .gx-fac[data-value="A00"]')?.click());
  await sleep(400);
  const scs = await S.page.evaluate(() => [...document.querySelectorAll('.gx .gx-sc')].map((e) => `${e.dataset.value}:${e.innerText.replace(/\s+/g, ' ').slice(0, 20)}`));
  check('H-03', '관리국 칸 장면 목록: 1 「면접 시험」. 글이 빈 새 장면(10)은 시작 패널에 안 보임', '1:면접 시험, 10 없음', '코스 K4 · factions.ts:99 (글 없는 장면은 뺌, Claude 판정)', scs.some((s) => s.startsWith('1:') && s.includes('면접 시험')) && !scs.some((s) => s.startsWith('10:')), { scs, emptyScenePanel });
  // 새 장면(글 없음)으로 출발하면? / 장면 1 로 출발 → 시드
  await S.page.evaluate(() => document.querySelector('.gx .gx-sc[data-value="1"]')?.click());
  await sleep(300);
  const n1 = await S.page.evaluate(() => window.__calls.setChat.length);
  await S.page.evaluate(() => document.querySelector('.gx .gx-start')?.click());
  await S.page.waitForFunction((n) => window.__calls.setChat.length > n, n1, { timeout: 8000 }).catch(() => {});
  await sleep(1200);
  const c = await S.chat();
  const seedLore = String(c.scriptstate?.$seed_lore ?? '');
  const r = await S.request('자리에 앉는다.');
  reqDump('H-04_첫요청_시드.txt', r);
  check('H-04', '첫 장면 로어북에 「명일 아파트」를 더하고 관리국·면접으로 출발 → $seed_lore 와 첫 본편 요청에 명일 아파트 로어 본문', '시드에 Myeongil Apartment 절', 'B-04 (Claude 판정) · 코스 K4', /Myeongil Apartment|명일 아파트/.test(seedLore) && /Myeongil Apartment/.test(all(r)), { seedHas: /Myeongil Apartment|명일 아파트/.test(seedLore), reqHas: /Myeongil Apartment/.test(all(r)), scene0: String(c.message?.[0]?.data ?? '').slice(0, 60) }, 'out/H-04_첫요청_시드.txt');
  // 새 세력(교황청) 으로 다른 새 채팅 시작
  await S.page.evaluate(() => { window.__chat = { message: [], scriptstate: {} }; window.__calls.setChat = []; });
  await S.closeWin();
  await S.openWin();
  const vcode = vat?.code;
  await S.page.evaluate((v) => document.querySelector(`.gx .gx-fac[data-value="${v}"]`)?.click(), vcode);
  await sleep(400);
  const vscs = await S.page.evaluate(() => [...document.querySelectorAll('.gx .gx-sc')].map((e) => `${e.dataset.value}:${e.innerText.replace(/\s+/g, ' ').slice(0, 20)}`));
  const pick = vscs.find((s) => /커스텀|직접/.test(s)) ?? vscs[0];
  await S.page.evaluate((v) => document.querySelector(`.gx .gx-sc[data-value="${v}"]`)?.click(), pick?.split(':')[0]);
  await sleep(300);
  if (/직접/.test(pick ?? '')) await S.page.evaluate(() => { const t = document.querySelector('.gx textarea, .gx [data-input="start-direct"]'); if (t) { t.value = '성당 앞에서 시작한다.'; t.dispatchEvent(new Event('input', { bubbles: true })); } });
  await sleep(300);
  const startDis = await S.page.evaluate(() => document.querySelector('.gx .gx-start')?.disabled);
  await S.page.evaluate(() => document.querySelector('.gx .gx-start')?.click());
  await sleep(1800);
  const vc = await S.chat();
  check('H-05', `시작 칸으로 켠 교황청(${vcode}) 칸으로 새 채팅 출발 → 소속 변수·시드(교황청 로어)`, `$st_faction=${vcode}, $seed_lore 에 Vatican`, '코스 K4', vc.scriptstate?.$st_faction === vcode && /Vatican|교황청/.test(String(vc.scriptstate?.$seed_lore ?? '')), { vscs, pick, startDis, faction: vc.scriptstate?.$st_faction, aff: vc.scriptstate?.$ib_affiliation, seed: String(vc.scriptstate?.$seed_lore ?? '').slice(0, 120), fac_codes: vc.scriptstate?.$fac_codes });
  check('H-06', '시작 화면 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

// ═══ I. 카드 로어북 저장 실패 (T1 'char' 스위치: 던짐 / 조용히 안 씀) ═══
if (want('I')) {
  for (const mode of ['throw', 'silent']) {
    const S = await fresh();
    await setSaveFail(S.page, 'char', { from: 1, count: 1, mode });
    await S.openEd('agent');
    await S.act('ed-sel', '잼트리');
    await S.type('.gw [data-input="dir"][data-key="rank|잼트리"]', `시험직급-${mode}`);
    await sleep(2200);
    const notice = await S.text('.gw .gx-err, .gw .gw-notice, .gw [role="alert"]');
    const ui = await S.val('.gw [data-key="rank|잼트리"]');
    const card = (await S.dir()).요원['잼트리'].rank;
    const fails = await saveFails(S.page);
    await S.page.screenshot({ path: `${OUT}I-${mode}_저장실패_PC.png` });
    // 그 상태로 다음 요청: 카드 값(옛 값)이 감
    const tabTxt = await S.text('.gw');
    check(`I-01-${mode}`, `카드 저장 실패(${mode}): 화면 알림과 카드·화면 값`, mode === 'throw' ? '「저장하지 못했어요」 알림, 카드 옛 값, 화면 새 값' : '조용히 안 씀: 알림 없음, 카드 옛 값 → 다음 저장에 다시?', 'T1 스위치 · K-01', mode === 'throw' ? /저장하지 못했어요/.test(notice || tabTxt) && card !== ui : null, { notice: notice.slice(0, 80), ui, card, fails });
    // 다음 입력 때 다시 저장되는가
    await S.type('.gw [data-input="dir"][data-key="department|잼트리"]', (await S.val('.gw [data-key="department|잼트리"]')) ?? '');
    await S.type('.gw [data-input="dir"][data-key="rank|잼트리"]', `시험직급-${mode}`);
    await sleep(2200);
    const card2 = (await S.dir()).요원['잼트리'].rank;
    check(`I-02-${mode}`, `실패(${mode}) 뒤 다음 입력에 다시 저장되어 카드에 남음`, `rank=시험직급-${mode}`, '코드 주석 「다음 입력 때 다시」 (Claude 판정)', card2 === `시험직급-${mode}`, { card2 });
    // 창을 닫으면
    await clearSaveFail(S.page, 'char');
    await setSaveFail(S.page, 'char', { from: 1, mode });
    await S.type('.gw [data-input="dir"][data-key="rank|잼트리"]', `시험직급2-${mode}`);
    await S.page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]')?.click());
    await sleep(1500);
    const confirm = await S.text('.gw');
    const stillOpen = await S.page.evaluate(() => document.querySelector('.gw')?.hidden === false);
    await S.page.screenshot({ path: `${OUT}I-03-${mode}_닫기_PC.png` });
    check(`I-03-${mode}`, `저장이 계속 실패(${mode})하는 채 닫기`, mode === 'throw' ? '닫지 않고 묻기(저장 실패 때만 묻는다)' : '참고', 'editor/index.ts:1085 「저장이 실패했을 때만 묻는다」', mode === 'throw' ? stillOpen && /저장/.test(confirm) : null, { stillOpen, confirm: confirm.slice(0, 200), card: (await S.dir()).요원['잼트리'].rank });
    await clearSaveFail(S.page, 'char');
    // 거점 페이지로 가면 초안이 버려지는가 (실패 알림이 떠 있는 채)
    await S.page.close();
  }
  // I-04 실패 알림이 뜬 채 거점 페이지로 가면 고친 값은?
  {
    const S = await fresh();
    await setSaveFail(S.page, 'char', { from: 1, count: 1, mode: 'throw' });
    await S.openEd('agent');
    await S.act('ed-sel', '잼트리');
    await S.type('.gw [data-input="dir"][data-key="rank|잼트리"]', '시험직급3');
    await sleep(2000);
    await S.node('base');
    await sleep(800);
    await S.node('agent');
    await S.act('ed-sel', '잼트리');
    const ui = await S.val('.gw [data-key="rank|잼트리"]');
    await S.closeEd();
    await sleep(800);
    const card = (await S.dir()).요원['잼트리'].rank;
    check('I-04', '저장 실패 알림이 뜬 채 「거점」 페이지를 다녀오면 고친 직급', '참고: 남는지/조용히 사라지는지', 'K-01 · index.ts:1128', null, { ui, card });
    await S.page.close();
  }
}

// ═══ J. 범위: 세계 편집은 카드(모든 채팅·새 채팅), 시작 전(시작 패널) 범위에서 연 편집기도 같은 곳 ═══
if (want('J')) {
  const S = await session(b, { chat: { message: [], scriptstate: {} }, prefs: PREFS });
  await S.openEd('agent');
  const scopeTxt = await S.text('.gw .gw-top, .gw .gw-scope');
  await S.act('ed-sel', '로제몬');
  let n0 = await S.setChar();
  await S.type('.gw [data-input="dir"][data-key="department|로제몬"]', (await S.val('.gw [data-key="department|로제몬"]')) + '');
  await S.type('.gw [data-input="ed-field"][data-key="agent|로제몬|intro"]', `${await S.val('.gw [data-key="agent|로제몬|intro"]')} 시험범위1`);
  const ok = await S.waitSave(n0);
  await S.closeEd();
  const prefsAfter = JSON.parse(await S.page.evaluate(() => window.__store['p:goei:prefs']) || '{}');
  const chatAfter = await S.chat();
  // 다른(시작된) 채팅으로 바꿔 끼우고 요청
  await S.page.evaluate((c) => { window.__chat = c; }, structuredClone(st.data));
  const r = await S.request('기록실로 간다.');
  const line = all(r).split('\n').find((l) => l.startsWith('- Rojemon ')) ?? '';
  check('J-01', '시작 전(시작 패널 「설정」)에서 고친 세계 값은 카드에 저장되어 이미 시작한 다른 채팅 요청에도 감, 기기 prefs·채팅 변수엔 안 남음', 'Roster 로제몬 줄에 시험범위1, prefs.world 그대로, 빈 채팅 scriptstate 그대로', 'Claude 판정 (세계 = 카드 명부; directory.ts:2 주석)', ok && line.includes('시험범위1') && JSON.stringify(prefsAfter.world ?? {}) === JSON.stringify(PREFS.world ?? {}) && !Object.keys(chatAfter.scriptstate ?? {}).length, { ok, line: scrubRoster(line), prefsWorld: prefsAfter.world, scope: scopeTxt.slice(0, 120) });
  check('J-02', '세계 탭에 「이 채팅 / 새 채팅 기본값」 범위 칩이 있는지', '참고', '코스 K1', null, scopeTxt.slice(0, 200));
  await S.page.close();
}

// ═══ K. 새 플레이 세력을 이미 시작한 채팅에서 켤 때, 세력 자리표시 로어북 채우기, 세력 지침 미리보기 = 요청 ═══
if (want('K')) {
  const S = await fresh();
  // K-01 미리보기와 요청 글 같은지
  await S.openEd('relations');
  await S.act('ed-rel-preview');
  const pv = await S.text('.gw .gw-preview');
  await S.closeEd();
  const r0 = await S.request('보고서를 넘긴다.');
  const t0 = all(r0);
  const head = pv.split('\n').find((l) => l.trim()) ?? '';
  const facBlock = t0.slice(t0.indexOf(head), t0.indexOf(head) + pv.length);
  check('K-01', '세력 관계 「세력 지침 보기」 글이 다음 요청의 📜Faction 덩어리와 같음', '같은 글', 'Claude 판정 (미리보기 = 모델에게 가는 글)', null, { note: '미리보기는 CBS({{#if …st_faction…}})를 풀기 전 글, 요청은 리스아이가 푼 글. 그 밖의 줄은 같음(out/K-01_미리보기.txt · out/K-01_요청Faction.txt diff)', pvLen: pv.length, head, same: facBlock.trim() === pv.trim() }, dump('K-01_미리보기.txt', pv));
  await S.page.evaluate(() => window.__chat.message.pop());
  // K-02 이미 시작한 채팅에서 교황청을 플레이 조직으로 켬 → 바로 다음 요청의 소속 변경 코드 목록
  await S.openEd('start');
  let n0 = await S.setChar();
  await S.act('dir-fac-play', '1|교황청');
  await S.waitSave(n0);
  const code = (await S.dir()).조직['교황청']?.code;
  await S.closeEd();
  const before = (await S.chat()).scriptstate.$fac_codes;
  const r1 = await S.request('교황청 사람과 통화한다.');
  reqDump('K-02_요청_새세력직후.txt', r1);
  const t1 = all(r1);
  const acLine = t1.split('\n').find((l) => /code = A00 \| B00 \| C00 \| D00 \| E00/.test(l)) ?? '';
  check('K-02', `이미 시작한 채팅에서 교황청을 플레이 조직(${code})으로 켠 직후 다음 요청 [AC] 코드 목록에 ${code}`, `code 줄에 ${code}`, '코스 K4 · directory.ts:1404 주석 「지금 채팅의 새 세력 변수를 바로 맞춘다」(명부 판 dir-save 에만 있음)', acLine.includes(code), { acLine: acLine.trim(), $fac_codes: before }, 'out/K-02_요청_새세력직후.txt');
  await S.reply(`통화를 마쳤다.\n\n[▣|2025.03.14|10:20 AM|☀️|12°C|서울 종로구 관리국 본부 로비|없음|없음|없음|관리국/신입|140000]`);
  const after = (await S.chat()).scriptstate.$fac_codes;
  const r2 = await S.request('다시 통화한다.');
  const ac2 = all(r2).split('\n').find((l) => /code = A00 \| B00 \| C00 \| D00 \| E00/.test(l)) ?? '';
  check('K-03', '응답이 한 번 붙은 뒤의 요청에는 들어감', `code 줄에 ${code}`, 'body.ts:718 (응답 처리 때 staleFactionVars)', ac2.includes(code), { ac2: ac2.trim(), $fac_codes: after });
  await S.page.close();
  // K-04 카드에 자리표시자 없는 🏷️Tag 로어북이 있을 때 「로어북에 자리 넣기」
  const S2 = await fresh();
  const tagText = (await import('node:fs')).readFileSync(new URL('../../../../../지침/상태창_태그.txt', import.meta.url), 'utf8').split('{{getvar::fac_codes}}').join('').split('{{getvar::fac_ac}}').join('');
  await S2.page.evaluate((t) => { window.__char.globalLore.push({ key: 'tag', comment: '🏷️Tag', content: t, mode: 'normal', insertorder: 100, alwaysActive: true, secondkey: '', selective: false }); }, tagText);
  await S2.openEd('start');
  n0 = await S2.setChar();
  await S2.act('dir-fac-play', '1|이슬람');
  await S2.waitSave(n0);
  await S2.node('org');
  await S2.act('ed-sel', '이슬람');
  const hint = await S2.text('.gw .gx-hint');
  const btn = await S2.has('.gw [data-action="dir-fac-patch"]');
  n0 = await S2.setChar();
  if (btn) await S2.act('dir-fac-patch', undefined, { wait: 1200 });
  const tagNow = await S2.page.evaluate(() => window.__char.globalLore.find((e) => e.comment === '🏷️Tag')?.content ?? '');
  const done = await S2.text('.gw');
  await S2.page.screenshot({ path: `${OUT}K-04_자리넣기_PC.png` });
  check('K-04', '카드 🏷️Tag 에 새 세력 자리가 없으면 안내와 「로어북에 자리 넣기」 → 누르면 자리표시자가 들어감', '안내·단추 있음 → Tag 에 {{getvar::fac_codes}}·{{getvar::fac_ac}}', '코스 K4 「세력 자리표시 로어북 채우기」', btn && tagNow.includes('{{getvar::fac_codes}}') && tagNow.includes('{{getvar::fac_ac}}'), { hint: hint.slice(0, 80), btn, codes: tagNow.includes('{{getvar::fac_codes}}'), ac: tagNow.includes('{{getvar::fac_ac}}'), msg: (done.match(/[^\n]*자리[^\n]*/g) ?? []).slice(0, 3) });
  await S2.closeEd();
  check('K-05', 'K 절 콘솔 오류 없음', '0', '—', S.errors.length + S2.errors.length === 0, [...S.errors, ...S2.errors]);
  await S2.page.close();
}

// ═══ L. 연락처: 요원 「괴담톡 연락처 탭」 → 괴담톡 연락처 ═══
if (want('L')) {
  const read = async (S) => {
    await S.openWin();
    await S.act('nav-tab', 'phone', { scope: '.gx', wait: 1000 });
    const tabs = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="ph-ctab"]')].map((e) => e.dataset.value));
    const out = {};
    for (const t of tabs) { await S.act('ph-ctab', t, { scope: '.gx', wait: 400 }); out[t] = await S.page.evaluate(() => [...document.querySelectorAll('.gx [data-action="ph-call"]')].map((e) => e.dataset.value).filter(Boolean)); }
    return out;
  };
  const S0 = await fresh();
  const c0 = await read(S0);
  await S0.page.close();
  const S = await fresh();
  await S.openEd('agent');
  await S.act('ed-sel', '쟈알디');
  let n0 = await S.setChar();
  await S.act('dir-toggle', 'phoneTabs|T01|쟈알디');
  await S.act('dir-toggle', 'phoneTabs|T04|쟈알디');
  await S.waitSave(n0);
  await S.closeEd();
  await S.closeWin();
  const c1 = await read(S);
  await S.page.screenshot({ path: `${OUT}L-01_연락처_PC.png` });
  check('L-01', '쟈알디의 연락처 탭을 관리→중립으로 바꾸면 괴담톡 연락처에서 관리 탭에서 빠지고 중립 탭에 나옴', 'T01 에 쟈알디 없음, T04 에 있음', '코스 K4 「연락처 반영」', c0.T01?.includes('쟈알디') && !c1.T01?.includes('쟈알디') && c1.T04?.includes('쟈알디'), { before: c0, after: c1 });
  check('L-02', 'L 절 콘솔 오류 없음', '0', '—', S.errors.length === 0, S.errors);
  await S.page.close();
}

dump('결과_T1.json', results);
const n = results.filter((r) => r.ok !== 'info');
console.log(`\n== T1 ${n.filter((r) => r.ok).length}/${n.length} 통과 (참고 ${results.length - n.length})`);
await b.close();
