// 공용 그림 고르기. 모델을 부르지 않고 이름·상황 글의 낱말로 고른다. 후보 이름을 좋은 순서로 돌려주고, 카드에 있는 첫 그림을 쓰는 건 부르는 쪽이 한다.
// 괴이·사건의 장소 낱말은 src/data/picwords.json (그림 한 장마다 낱말, 2026-11-19 사용자: 엉뚱한 그림이 붙지 않게).
// 그림 이름: 처음 31곳은 「Situation Anomaly <장소> <n>」(pics), 그 뒤 새 그림은 숫자 없이 「Situation Anomaly <내용>」 한 장에 항목 하나 (pics 없음, 11-19 사용자).
import pw from '../data/picwords.json';
import { SIDO_NAME, SIGUN } from './world/geo';

type Table = [string, string[]][];

// 특수는 아무 데나 나타나는 가게·공간이라 장소가 아니라 무엇인지로 고른다
const KINDS_MS: Table = [
  ['Shop', ['샵', '숍', '상점', '가게', '쇼핑', '몰', '마트', '타투', '편의점']],
  ['Bookshop', ['책방', '서점', '도서', '책']],
  ['Workshop', ['공방', '작업실', '대장간', '공작소']],
  ['Market', ['장터', '시장', '노점', '바자', '맨홀']],
  ['Vending', ['자판기']],
  ['Room', ['상담', '사무소', '카페', '찻집', '실', '방']],
  ['Object', ['키트', '키링', '발견', '상자', '인형', '물건', '씨앗', '요정', '선물']],
];
const KINDS_BASE: Table = [
  ['Office', ['본부', '본사', '사무소', '사무실', '협회', '빌딩', '센터']],
  ['Shop', ['상점', '가게', '샵', '숍', '알선', '전당포']],
  ['Religious', ['성당', '교회', '성원', '절', '사찰', '신당', '수도원', '예배당']],
  ['Underground', ['지하', '상가', '역']],
  ['Clinic', ['의원', '병원', '약국', '클리닉']],
];
const KINDS_ORG: Table = [
  ['Corporate', ['주식회사', '회사', '기업', '그룹', '제약']],
  ['Religious', ['교황청', '교회', '성원', '이슬람', '성당', '수도회']],
  ['Cult', ['교단', '교', '신도', '찬란']],
  ['Research', ['연구', '실험', '학회']],
  ['Criminal', ['사채', '조직', '파', '상가', '암시장', '중림']],
  ['Military', ['부대', '군', '대응', '진압', '협회']],
  ['Underground', ['프리랜서', '은신', '모임', '게시판']],
];

/** 이름에서 정한 0~n-1 (같은 이름은 늘 같은 값) */
function pick(seed: string, n: number): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0) % Math.max(1, n);
}

// 한 글자 낱말은 낱말 끝에서만 (유계역·북한산은 맞고 광역시·지역·부산은 안 맞음). '폐'는 낱말 앞 (폐공장)
const STOP = /부산|울산|안산|군산|익산|경산|양산|서산|오산|논산|아산|얼굴|지역|구역|영역|전역/g;
/** 「~실」로 끝나도 방이 아닌 말(현실·상실): 실내 단서(IN_CUE)·「실」 낱말에 걸리지 않게 뺀다. 낱말 앞에서만 (조사실·검사실은 방) */
const NOT_ROOM = /(?<![가-힣])(현실|상실|사실|확실|진실|손실|분실|과실|결실|충실|성실|절실|착실|부실|소실|유실|망실|멸실|매실|건실|독실|허실|득실|여실)/g;
const one = new Map<string, RegExp>();
function hit(text: string, w: string): boolean {
  if (w.length > 1) return text.includes(w);
  let re = one.get(w);
  if (!re) one.set(w, (re = w === '폐' ? /(?<![가-힣])폐[가-힣]/ : new RegExp(`[가-힣]${w}(?![가-힣])|(?<![가-힣])${w}(?![가-힣])`)));
  return re.test(text);
}
const clean = (text: string) => text.replace(STOP, ' ').replace(NOT_ROOM, ' ');
const score = (words: string[], text: string) => words.reduce((n, w) => n + (hit(text, w) ? w.length : 0), 0);

/** 낱말이 많이 맞는 순(이름은 두 배), 같으면 이름으로 돌린 순서. 하나도 안 맞는 것은 뒤에 (그것도 이름으로 돌린 순서) */
function rank(table: Table, name: string, text: string, seed: string): string[] {
  const n = clean(name), t = clean(text);
  const scored = table.map(([key, words], i) => ({ key, i, score: score(words, n) * 2 + score(words, t) }));
  const start = pick(seed, table.length);
  const turn = (i: number) => (i - start + table.length) % table.length;
  return scored.sort((a, b) => b.score - a.score || turn(a.i) - turn(b.i)).map((x) => x.key);
}

// ── 괴이·사건: 그림 한 장마다 낱말 ──
/** s: 다른 장소의 일부이기도 한 낱말(객실: 열차·배에도 있음). 이름에 다른 장소 낱말이 있으면 그 장소가 먼저 */
interface Pic { n: number; w: string[]; s?: string[]; in?: boolean; inc?: string[] }
/** pics 가 없으면 그림 한 장(이름 = k, 숫자 없음). s: 어느 장소에나 딸린 길 낱말(산책로): 이름에 다른 장소 낱말이 있으면 그 뒤로 간다 */
interface Place { k: string; w?: string[]; s?: string[]; pics?: Pic[]; g?: { w: string[]; p: number[] }; near?: string; inc?: string[]; base?: boolean }
const PLACES = (pw as { places: Place[] }).places;

/** 낱말 끝에 붙어 장소를 알려 주는 한 글자 (옥정호·중랑천·북한산·유계역). 세 글자 이상인 낱말의 끝에서만 보고(두 글자는 TWO 에 있는 강·산 이름만), 같은 글자로 끝나는 다른 낱말은 뺀다 */
const SUFFIX: Record<string, { to: string; n?: number; not: string[] }> = {
  호: { to: 'Lake', n: 1, not: ['번호', '신호', '보호', '간호', '구호', '암호', '경호', '수호', '변호', '상호', '기호', '부호', '애호', '옹호', '양호', '괄호', '점호', '전호', '엄호', '원호', '칭호', '존호', '방호', '참호', '산호', '미호', '호호', '선호', '환호', '연호', '국호', '시호', '묘호', '당호', '아호', '별호', '작호', '군호', '문호', '가호', '비호', '맹호', '백호', '흑호', '념호', '집호'] },
  천: { to: 'RiversidePark', not: ['온천', '수천', '추천', '원천', '실천', '황천'] },
  강: { to: 'RiversidePark', not: ['건강', '보강', '증강', '철강', '제강', '하강', '특강', '휴강', '개강'] },
  산: { to: 'Forest', not: ['부동산', '낙하산', '화산', '수산', '재산', '유산', '생산', '계산', '출산', '예산', '파산', '해산', '하산', '우산', '자산', '축산', '농산', '임산', '광산', '물산', '정산', '전산', '분산', '확산', '무산', '양산'] },
  봉: { to: 'Forest', not: ['개봉', '밀봉', '면봉', '철봉', '경찰봉', '야광봉', '응원봉', '지휘봉', '곤봉', '연봉', '상봉'] },
  령: { to: 'Forest', not: ['대통령', '유령', '명령', '사령', '법령', '연령', '수령', '망령', '혼령', '악령', '심령', '점령', '발령'] },
  항: { to: 'Sea', n: 2, not: ['공항', '사항', '조항', '저항', '대항', '반항', '출항', '입항', '결항', '회항'] },
  포: { to: 'Sea', n: 2, not: ['폭포', '공포', '체포', '세포', '대포', '발포', '배포', '살포', '유포', '분포', '점포', '전당포', '소포', '선포', '수배포'] },
  굴: { to: 'Cave', not: ['얼굴', '발굴', '채굴', '시굴', '도굴'] },
  역: { to: 'Subway', not: ['지역', '구역', '영역', '전역', '번역', '통역', '면역', '무역', '징역', '용역', '현역', '병역', '주역', '악역', '배역', '광역', '권역', '수역', '해역', '방역', '부역', '노역', '교역'] },
  섬: { to: 'IslandVillage', not: [] },
  숲: { to: 'Forest', not: [] },
  댐: { to: 'Lake', n: 1, not: [] },
};
/** 두 글자인데도 강·산 이름인 낱말 (한강·남산). 두 글자 「~강」「~산」은 보통 낱말(생강·통산·인강·도산)이 훨씬 많아 이 목록에 있는 것만 끝말로 본다 */
const TWO: Record<string, string[]> = {
  강: ['한강', '금강', '남강', '섬강', '동강', '서강'],
  산: ['남산'],
};
/** 「~교」로 끝나지만 다리가 아닌 말 (사전에서 「교」로 끝나는 3자 이상 낱말 732개를 갈라 뽑음). 학교류는 표의 낱말이 먼저 받는다 */
const GYO_NOT = ['학교', '장교', '외교', '대주교', '좌주교', '부주교', '설교', '조교', '비교', '기교', '등교', '하교', '휴교', '모교', '본교', '타교', '국교', '배교', '친교', '절교', '순교', '함교', '근교', '소방교', '탑승교', '실험교', '자매교'];
/** 종교 이름 (교회 그림으로) */
const FAITH = ['종교', '불교', '신교', '유교', '회교', '밀교', '기독교', '천주교', '천도교', '그리스도교', '대도교', '선도교', '성도교', '백도교', '가톨릭교', '감리교', '장로교', '침례교', '성결교', '안식교', '구세교', '예수교', '야소교', '유대교', '유태교', '힌두교', '이슬람교', '라마교', '로마교', '마니교', '배화교', '조로아스터교', '자이나교', '시크교', '브라만교', '바라문교', '비슈누교', '모르몬교', '부두교', '드루이드교', '미트라교', '바하이교', '카오다이교', '단군교', '증산교', '보천교', '태을교', '흠치교', '청림교', '수운교', '시천교', '상제교', '천리교', '백백교', '백련교', '통일교', '한얼교', '정토교', '진언교', '대승교', '소승교', '그리스정교', '동방정교', '희랍정교', '러시아정교', '크리스트교', '칼뱅교', '공자교', '인류교', '전진교', '사이비교', '찬란교', '마호메트교', '모하메드교', '바리새교', '네스토리우스교', '오르페우스교', '미이미교', '배물교', '도덕교', '대세교', '태일교', '한검교', '환검교', '제우교', '삼계교', '지나교', '그리스교', '희랍교', '모세교', '율법교', '천법교', '천태교'];
const FAITH_CUE = /신도|교주|교단|포교|교리|신앙|교인|사이비|집회|예배|숭배|전도|광신|종교|신흥/;
/** 「~호」가 배·열차 이름임을 알리는 단서 */
const HO_LAKE = /호숫|호반|수변|둘레|낚시|저수|수몰|수면|물가|물속|물안개|유원지|담수|수상|수심|익사|빙판|얼음|잠긴|수문|제방|오리배/;
/** 사람 이름을 알리는 말과 흔한 성 */
const PERSON_CUE = /씨(\s|$)|자택|의 집|일가|가족|부부/;
const SURNAME = '김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용';
const HO_SHIP_CUE = /침몰|좌초|난파|표류|출항|입항|귀항|항해|승선|선원|선장|선체|선실|선미|갑판|조타|기관실|어선|여객선|유람선|화물선|낚싯배|선박|조업|유령선|구명|해경|뱃|해상|인양/;
const HO_TRAIN_CUE = /열차|객차|탈선|기관사|선로|철도|차량기지|호차/;
const HO_SHIP = /(훼리|페리|크루즈|마루|프린세스|익스프레스)호$|^제\s?\d/;
const hoKind = (t: string): 'lake' | 'ship' | 'train' | '' => (HO_LAKE.test(t) ? 'lake' : HO_SHIP_CUE.test(t) ? 'ship' : HO_TRAIN_CUE.test(t) ? 'train' : '');
/** 이름에서 장소가 아닌 낱말: 시·도, 시·군·구 (플러그인 지도 이름표) */
const REGION = new Set<string>();
for (const n of [...Object.values(SIDO_NAME), ...Object.values(SIGUN).flat()]) {
  REGION.add(n);
  const short = n.replace(/(특별자치도|특별자치시|특별시|광역시|[시군구도])$/, '');
  if (short.length >= 2) REGION.add(short);
}
// 장소 낱말과 같은 지역 줄임말(광산구의 광산)은 장소로 본다
for (const p of PLACES) for (const w of [...(p.w ?? []), ...(p.s ?? []), ...(p.g?.w ?? []), ...(p.pics ?? []).flatMap((x) => [...x.w, ...(x.s ?? [])])]) REGION.delete(w);
/** 낱말 뒤에 붙은 조사·자리 말 (중랑천변, 옥정호에서) */
const TAIL = /(에서|에|의|변|가|길|앞|뒤|옆|쪽|인근|근처|부근|일대|주변|방면)$/;
const IN_CUE = /\d\s?층|지하\s?\d|[가-힣]실(\s|$)|복도|내부|실내|로비|호실|\d\s?호(\s|$)|객실|병동|안쪽/;
const OUT_CUE = /앞|입구|정문|후문|마당|옥외|외벽|담장|운동장|교문|외곽|뒤편/;
/** 상황 글에서 발생지점이 아닌 곳을 가리키는 꼴 (인근 병원으로 이송, 경찰서에서 출동) */
const ELSEWHERE = /[가-힣]+\s?(으로|로|에서)\s?(긴급\s?)?(이송|후송|옮겨|출동|대피|향하|연행|호송|파견)[가-힣]*/g;

interface Hit { place: Place; pic?: number; general?: boolean; soft?: boolean; end: number; len: number }

/** 이름에서 장소 낱말 찾기: 뒤에 나온 낱말이 먼저 (우리말은 뒤 낱말이 더 좁은 자리), 같은 자리면 긴 낱말 */
function findPlaces(text: string, byPosition: boolean, ctx = text): Hit[] {
  const tokens = text.split(/[\s,·()[\]「」'"]+/).filter((t) => t && !REGION.has(t));
  const flat = tokens.join('');
  const hits: Hit[] = [];
  const tokenEnd: { stem: string; end: number }[] = [];
  let off = 0;
  for (const t of tokens) {
    let stem = t;
    for (let m = TAIL.exec(stem); m && stem.length - m[0].length >= 2; m = TAIL.exec(stem)) stem = stem.slice(0, -m[0].length);
    tokenEnd.push({ stem, end: off + stem.length });
    off += t.length;
  }
  const one = (w: string): number => {
    for (let i = tokenEnd.length - 1; i >= 0; i--) if (tokenEnd[i].stem === w) return tokenEnd[i].end;
    return -1;
  };
  // 짧은 낱말은 한 낱말 안에서만 찾는다 (「가온 천」의 온천처럼 띄어쓰기를 넘어 걸리지 않게). 긴 낱말은 띄어 써도 찾는다 (컨테이너 터미널)
  const inToken = (w: string): number => {
    let o = off;
    for (let i = tokens.length - 1; i >= 0; i--) {
      o -= tokens[i].length;
      const at = tokens[i].lastIndexOf(w);
      if (at >= 0) return o + at + w.length;
    }
    return -1;
  };
  const add = (place: Place, w: string, pic?: number, general?: boolean, soft?: boolean) => {
    // 한 글자 낱말(산·섬·절)은 이름에서만: 상황 글에서는 「멈춰 섬」 같은 말에 걸린다
    const end = w.length === 1 ? (byPosition ? one(w) : -1) : w.length >= 4 ? (flat.lastIndexOf(w) < 0 ? -1 : flat.lastIndexOf(w) + w.length) : inToken(w);
    if (end >= 0) hits.push({ place, pic, general, soft, end, len: w.length });
  };
  for (const p of PLACES) {
    for (const w of p.w ?? []) add(p, w);
    for (const w of p.s ?? []) add(p, w, undefined, undefined, true);
    for (const w of p.g?.w ?? []) add(p, w, undefined, true);
    for (const pic of p.pics ?? []) {
      for (const w of pic.w) add(p, w, pic.n);
      for (const w of pic.s ?? []) add(p, w, pic.n, undefined, true);
    }
  }
  // 끝말 (이름에만). 같은 자리에서 표의 낱말이 이미 맞았으면 끝말은 보지 않는다 (세월호·기차역)
  if (byPosition) {
    const taken = new Set(hits.filter((h) => h.len > 1).map((h) => h.end));
    const put = (key: string, end: number, n?: number) => {
      const place = PLACES.find((p) => p.k === key);
      if (place) hits.push({ place, pic: n, general: !n, end, len: 1 });
    };
    const person = PERSON_CUE.test(text);
    for (const { stem, end } of tokenEnd) {
      const last = stem.slice(-1);
      if (stem.length < 3 && !(stem.length === 2 && TWO[last]?.includes(stem))) continue;
      if (last === '호' && /\d/.test(stem.slice(-2, -1))) continue;
      // 종교 이름(유대교·○○신교)은 「대교」 같은 표의 낱말보다 먼저 가른다
      if (last === '교' && !GYO_NOT.some((x) => stem.endsWith(x)) && (FAITH.some((x) => stem.endsWith(x)) || (!taken.has(end) && FAITH_CUE.test(ctx.replace(stem, ' '))))) {
        for (let i = hits.length - 1; i >= 0; i--) if (hits[i].end === end) hits.splice(i, 1);
        put('Church', end);
        continue;
      }
      // 사람 이름(김민호 씨 자택)은 넘긴다
      if (taken.has(end) || (person && stem.length === 3 && SURNAME.includes(stem[0]))) continue;
      if (last === '교') {
        // 다리 이름(광진교). 학교·계급·그 밖의 말이면 넘긴다
        if (!GYO_NOT.some((x) => stem.endsWith(x))) put('Bridge', end, 1);
        continue;
      }
      const rule = SUFFIX[last];
      if (!rule || rule.not.some((x) => stem.endsWith(x))) continue;
      if (last === '호') {
        // 「~호」는 호수·배·열차·사람 이름·보통 낱말이 다 같은 꼴이다: 이름 → 상황 글 순으로 단서가 있을 때만 받는다 (이름난 호수는 표의 낱말)
        const kind = HO_SHIP.test(stem) ? 'ship' : hoKind(text) || hoKind(ctx);
        if (kind === 'ship') put('Ferry', end);
        else if (kind === 'train') put('Subway', end, 2);
        else if (kind === 'lake') put('Lake', end, 1);
        continue;
      }
      put(rule.to, end, rule.n);
    }
  }
  hits.sort((a, b) => (byPosition ? b.end - a.end || b.len - a.len : b.len - a.len || a.end - b.end));
  return [...hits.filter((h) => !h.soft), ...hits.filter((h) => h.soft)];
}

/** 한 장소의 그림 순서: 그 그림의 낱말이면 그 그림 먼저, 장소 이름뿐이면 안/바깥 단서 → 이름으로 돌린 순서 */
function picsOf(h: Hit, cue: 'in' | 'out' | '', seed: string): string[] {
  const p = h.place;
  if (p.base) return ['@'];
  if (!p.pics) return [p.k];
  const all = p.pics.map((x) => x.n);
  const pool = h.pic ? [h.pic] : (p.g?.p ?? all);
  const start = pick(seed, pool.length);
  const turned = pool.map((_, i) => pool[(start + i) % pool.length]);
  const want = cue === 'in' ? true : cue === 'out' ? false : null;
  const fit = (n: number) => want === null || !!p.pics!.find((x) => x.n === n)?.in === want;
  const order = h.pic && !fit(h.pic) && cue ? [h.pic] : [...turned.filter(fit), ...turned.filter((n) => !fit(n))];
  return [...new Set([...order, ...all])].map((n) => `${p.k} ${n}`);
}

/** 어느 장소 낱말도 안 맞을 때의 넓은 갈래 */
function broad(name: string, text: string, loc: string): string {
  const all = `${name} ${text}`;
  if (IN_CUE.test(clean(name)) || /실내|건물 안|집 안|방 안|천장|벽지|문틈/.test(all)) return 'Indoor';
  if (/수변|물가|낚시|수면|물안개|익사|수심|강물|파도|물속|물에 /.test(all)) return 'Water';
  if (/등산|능선|조난|산속|산중|약초|산불|벌목|골짜기|산자락/.test(all)) return 'Mountain';
  if (/군(\s|$)/.test(loc) || /이장|농민|경운기|농가|읍내|면사무소|마을/.test(all)) return 'Country';
  if (/[시구](\s|$)/.test(loc) || /행인|시민|차량|도심|시내/.test(all)) return 'City';
  return 'Night';
}
/** 넓은 갈래의 그림 (숫자 없음). 두 장인 갈래는 이름으로 돌린 순서 */
const BROAD_AN: Record<string, string[]> = {
  Indoor: ['Generic Indoor EmptyHall', 'Generic Indoor Lobby'],
  Water: ['Generic Waterside Reeds', 'Generic Waterside NightLights'],
  Mountain: ['Generic Mountain Ridge'],
  Country: ['Generic Country Lane', 'Generic Country Hillside'],
  City: ['Generic City SideStreet', 'Generic City Skyline'],
  Night: ['Generic EmptyLot'],
};
const BROAD_IN: Record<string, string[]> = { Indoor: ['Street'], Water: ['River'], Mountain: ['Mountain'], Country: ['Farm', 'Mountain'], City: ['Street'], Night: ['Street'] };

const SIT: Record<string, string> = { an: 'Anomaly', in: 'Incident', ms: 'Mystic' };

/**
 * 상황 공용 그림 후보. 괴이·사건은 발생지점 이름의 장소 낱말로(못 찾으면 상황 글 → 넓은 갈래), 특수는 종류로. 끝은 종류별 기본 그림.
 * text: 상황 글, loc: 지역 이름 (넓은 갈래를 정할 때만)
 */
export function situationShared(kind: string, name: string, text = '', loc = ''): string[] {
  const k = SIT[kind];
  if (!k) return [];
  if (kind === 'ms') {
    // 특수는 이름만 본다 (나타난 장소는 그 가게와 상관없음)
    return [...rank(KINDS_MS, name, '', name).map((key) => `Situation ${k} ${key}`), 'Situation Mystic Door', `Situation ${k}`];
  }
  let hits = findPlaces(name, true, `${name} ${text}`);
  if (!hits.length && text) hits = findPlaces(text.replace(ELSEWHERE, ' '), false);
  const seen = new Set<string>();
  const places = hits.filter((h) => !seen.has(h.place.k) && seen.add(h.place.k));
  const group = broad(name, text, loc);
  const out: string[] = [];
  if (kind === 'an') {
    const cue = IN_CUE.test(clean(name)) ? 'in' : OUT_CUE.test(name) ? 'out' : '';
    for (const h of places) out.push(...picsOf(h, cue, name));
    for (const h of places) if (h.place.near) out.push(h.place.near);
    const wide = BROAD_AN[group];
    const start = pick(name, wide.length);
    out.push(...wide.map((_, i) => wide[(start + i) % wide.length]));
  } else {
    for (const h of places) out.push(...(h.place.pics?.find((x) => x.n === h.pic)?.inc ?? []), ...(h.place.inc ?? []));
    out.push(...BROAD_IN[group]);
  }
  return [...new Set([...out.map((key) => (key === '@' ? `Situation ${k}` : `Situation ${k} ${key}`)), `Situation ${k}`])];
}

/** 거점 공용 그림 후보 (바깥 모습). 맞는 게 없으면 은신처 */
export function baseShared(name: string, label = ''): string[] {
  const hay = clean(`${name} ${label}`);
  const hits = rank(KINDS_BASE, name, label, name).filter((key) => KINDS_BASE.find(([k]) => k === key)![1].some((w) => hit(hay, w)));
  return [...hits, 'Shared Base Hideout', 'Shared Base Office'].map((k) => (k.startsWith('Shared') ? k : `Shared Base ${k}`));
}

/** 조직 공용 그림 후보 (안쪽 모습). 민간형·프리랜서형은 그 유형 그림이 먼저 */
export function orgShared(name: string, type = 'org', text = ''): string[] {
  const head = type === 'civilian' ? ['Civilian'] : type === 'freelancer' ? ['Freelancer'] : [];
  const hay = clean(`${name} ${text}`);
  const hits = rank(KINDS_ORG, name, text, name).filter((key) => KINDS_ORG.find(([k]) => k === key)![1].some((w) => hit(hay, w)));
  return [...head, ...hits.map((k) => `Shared Org ${k}`), 'Shared Org Office'];
}

/** 요원 공용 그림 후보 (사진 없는 요원의 임시 그림, 11-21 사용자: 세력과 상관없이 남녀 한 장씩).
 *  성별을 알면 그 그림, 미정이면 두 장 중 하나를 요원 이름으로 정한다(그림이 도중에 바뀌지 않게) */
export function agentShared(gender: 'F' | 'M' | '', seed: string): string[] {
  const both = ['Shared Agent Female', 'Shared Agent Male'];
  if (gender === 'F') return [both[0]];
  if (gender === 'M') return [both[1]];
  return pick(seed, 2) ? [both[1], both[0]] : both;
}
