// 세계 데이터 기록의 기본 칸 정의 (docs/설계안_세계편집.md 2장, 사용자 2026-10-27 결정).
// 종류마다 기본 칸은 모든 기록에 늘 있고(비면 조립에서 생략), 그 위에 기록별 「칸 추가」가 붙는다.
// title 은 조립할 때 쓰는 절 제목(지금 로어북 글과 같은 영문), label 은 편집 화면 이름.
// 모델에 가는 절 제목은 지침 「메인 요청에 붙는 글」 WORLD.FIELD.<종류>.<칸> 절에서 읽는다 (2026-11-14 사용자: 모델에 가는 글은 전부 지침 파일에)
import { guideTxt } from '../guides';

export type WorldKind = 'agent' | 'org' | 'anomaly' | 'site' | 'appendix';
export const WORLD_KINDS: WorldKind[] = ['agent', 'org', 'anomaly', 'site', 'appendix'];
export const WORLD_KIND_LABEL: Record<WorldKind, string> = { agent: '요원', org: '조직', anomaly: '괴이', site: '파밍', appendix: '부록' };

export interface FieldDef {
  id: string;
  /** 편집 화면 이름 */
  label: string;
  /** 조립 절 제목 (Identity 절 안의 한 줄 항목은 「- 제목: 값」의 제목). 지침 WORLD.FIELD.<종류>.<칸> 절을 읽을 때마다 새로 읽는다 */
  readonly title: string;
  /** line = 한 줄, text = 글칸 */
  type: 'line' | 'text';
  /** 요원만: 어느 절에 들어가는 한 줄 항목인지 */
  sec?: 'identity' | 'appearance';
  /** 설명 (편집 화면 도움말) */
  hint?: string;
}

/** 요원: 식별·소속·사진은 명부(Directory) 칸이 맡고, 여기는 로어 글 칸만 */
export const AGENT_FIELDS: FieldDef[] = titled('agent', [
  { id: 'age', label: '나이', type: 'line', sec: 'identity' },
  { id: 'gender', label: '성별', type: 'line', sec: 'identity', hint: '로어 글의 Gender 줄. 명부 성별 칸과 별개로 모델에게 보이는 표기' },
  { id: 'organization', label: '소속 표기', type: 'line', sec: 'identity', hint: '비우면 명부 소속·호칭 표로 자동. 「Walpurgis Society, the Ten Witches」처럼 다르게 쓰고 싶을 때만' },
  { id: 'department_en', label: '부서 표기', type: 'line', sec: 'identity', hint: '모델에게 보이는 부서 이름(영문). 명부 부서 칸은 묶는 데 쓰고 이 칸이 글에 들어감' },
  { id: 'role', label: '역할', type: 'line', sec: 'identity' },
  { id: 'physique', label: '체격', type: 'line', sec: 'appearance' },
  { id: 'appearance', label: '외모', type: 'line', sec: 'appearance' },
  { id: 'outfit', label: '복장', type: 'line', sec: 'appearance' },
  { id: 'character', label: '성격', type: 'text', hint: '글머리 그대로. 결점([Flaws])도 이 안에' },
  { id: 'voice', label: '말투', type: 'text' },
  { id: 'background', label: '배경', type: 'text' },
  { id: 'abilities', label: '능력', type: 'text' },
  // 소개 칸은 조립 절이 아니라 Roster 줄이라 절 제목이 모델에 가지 않는다: 편집 화면에만 보이는 고정 제목
  { id: 'intro', label: '소개', title: 'Roster', type: 'line', hint: 'Roster 지침의 한 줄. 「(나이/성별, 직급): 외모; 성격; 능력」 꼴' },
]);

/** 조직: 소개의 첫 문단은 Faction 요약에, 나머지는 세력 상세에 쓰인다 (한 문단뿐이면 양쪽에) */
export const ORG_FIELDS: FieldDef[] = titled('org', [
  { id: 'intro', label: '소개', type: 'text', hint: '첫 문단은 Faction 지침 요약에, 나머지는 세력 상세 로어에' },
  { id: 'doctrine', label: '교리·방침', type: 'text' },
  { id: 'hq', label: '본부·거점', type: 'text' },
  { id: 'structure', label: '조직 구조', type: 'text' },
  { id: 'hierarchy', label: '계급', type: 'text' },
  { id: 'recruitment', label: '모집·첫 접촉', type: 'text' },
  { id: 'assets', label: '핵심 자산·특성', type: 'text' },
  { id: 'personnel', label: '인원', type: 'text' },
]);

export const ANOMALY_FIELDS: FieldDef[] = titled('anomaly', [
  { id: 'identity', label: '정체', type: 'text', hint: '뭐가 어떻게 된 괴이인지, 어디에 깃드는지' },
  { id: 'entry', label: '입장 조건', type: 'text', hint: '들어가는 길·징후·돌아갈 수 있는 시점' },
  { id: 'space', label: '공간·구조', type: 'text', hint: '구역·층·동선·공간 규칙' },
  { id: 'rules', label: '규칙', type: 'text', hint: '안에서 지켜야 하는 것, 어기면 생기는 일' },
  { id: 'entities', label: '개체', type: 'text', hint: '등장하는 존재들 (여럿이면 ##### 소제목)' },
  { id: 'survival', label: '생존·탈출', type: 'text', hint: '클리어 조건·출구·하면 안 되는 것·약점' },
  { id: 'notes', label: '비고', type: 'text', hint: '등급·발생지 같은 짧은 정보, 외부 노출' },
]);

export const SITE_FIELDS: FieldDef[] = titled('site', [
  { id: 'identity', label: '정체', type: 'text' },
  { id: 'access', label: '접근', type: 'text' },
  { id: 'location', label: '위치와 외관', type: 'text' },
  { id: 'environment', label: '환경', type: 'text' },
  { id: 'rules', label: '이용 규칙(거래·대가)', type: 'text' },
  { id: 'keeper', label: '주인/운영자', type: 'text' },
]);

export const APPENDIX_FIELDS: FieldDef[] = [
  { id: 'title', label: '제목', title: '', type: 'line', hint: '「### 」 뒤에 붙는 제목 줄' },
  { id: 'body', label: '본문', title: '', type: 'text' },
];

export const FIELDS: Record<WorldKind, FieldDef[]> = { agent: AGENT_FIELDS, org: ORG_FIELDS, anomaly: ANOMALY_FIELDS, site: SITE_FIELDS, appendix: APPENDIX_FIELDS };

/** 칸 정의에 지침 절 제목을 붙인다: title 은 읽을 때마다 지침 WORLD.FIELD.<kind>.<id> 절 (사용자가 고친 글 반영). title 을 이미 적은 칸(편집 화면 전용)은 그대로 */
function titled(kind: WorldKind, list: (Omit<FieldDef, 'title'> & { title?: string })[]): FieldDef[] {
  return list.map((f) => (f.title !== undefined ? (f as FieldDef) : (Object.defineProperty({ ...f }, 'title', { get: () => guideTxt('Main', `WORLD.FIELD.${kind}.${f.id}`), enumerable: true }) as FieldDef)));
}

export const fieldDef = (kind: WorldKind, id: string): FieldDef | undefined => FIELDS[kind].find((f) => f.id === id);

/** 괴이 공통 머리말: 지침 「메인 요청에 붙는 글」 WORLD.ANOMALY.NOTE 절 (세계 자료 덧쓰기가 없을 때) */
export const anomalyNoteDefault = (): string => guideTxt('Main', 'WORLD.ANOMALY.NOTE');
