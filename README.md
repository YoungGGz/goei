# 괴이 ː ANOMALY

RisuAI용 괴담 시뮬레이션 「괴이 ː ANOMALY」의 전용 플러그인과 카드입니다.

## 설치

1. [Releases](https://github.com/ygberserk/goei/releases)에서 「플러그인」(`goei-plugin.js`)과 「봇 카드」(`goei-anomaly.charx`)를 받습니다.
2. Risu 설정 → 플러그인 → 가져오기에서 `goei-plugin.js`를 추가하고, 뜨는 권한 확인 창(요청 처리·본 화면·채팅 보내기)을 모두 허용합니다.
3. `goei-anomaly.charx`를 캐릭터로 가져옵니다.
4. 괴이 카드를 처음 열면 플러그인 본체를 한 번 받습니다.
5. 채팅 화면 구석의 유령 버튼을 눌러 세력, 주인공, 아바타, 첫 장면, 시작 잔고, 언어를 정하고 **출발**을 누릅니다.

## 업데이트

- 플러그인: Risu 설정 → 플러그인 탭에서 업데이트합니다. 본체는 괴이 카드를 열 때 알아서 새로 받습니다.
- 카드: 유령 버튼 → 설정 → 점검 → 설치·업데이트에서 「카드 업데이트 준비」 → 「카드에 적용」. 새 판이 나오면 유령 버튼으로 연 화면 맨 위에 안내가 뜨고, 거기서 「업데이트」를 누르면 같은 화면으로 갑니다.

## 저장소

- `지침/` 지침 23개, 하나당 파일 하나. 모델이 받는 기본 글 그대로입니다. 지침을 고치려면 이 파일을 고칩니다.
- `카드/` 카드 재료. `그림/` 플러그인이 받는 그림 원본. `src/` 플러그인 코드. `scripts/` 빌드. `tests/` 시험. `tools/` 카드 빌드, 소지품 그림 도구, PixelLab 승인 문. `인수인계/` 인수인계 문서.

## 개발

- `npm ci` → `npm run build`: `dist/`에 시작기(`goei-plugin.js`), 본체 조각(`goei-body.*`), 자료 팩(`goei-data-*`), 토크나이저 조각(`tok-o200k.*`)을 만듭니다.
- 시험: `npm run typecheck` → `npm test`(단위). 화면 시험(`tests/*-browser.mjs`)은 고친 화면 것만 돌립니다.
- 릴리스 준비: `npm run release:prep -- --bump patch`(판 올림 → 빌드 → 카드 빌드 → `release/`에 받기용 파일 → 형 검사·단위 시험). `release/`는 git에 올리지 않습니다.
- 릴리스: main의 `package.json` 판이 아직 릴리스되지 않은 판이면 GitHub Actions(`.github/workflows/release.yml`)가 같은 순서로 빌드하고 형 검사·단위 시험을 통과하면 `release` 브랜치를 새로 덮어쓰고 Releases에 플러그인·카드·본체·세계 자료를 올립니다. 설치된 플러그인은 `release` 브랜치에서 본체·자료·카드 업데이트를 받습니다.
