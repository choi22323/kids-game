# CLAUDE.md — AI 개발 지침

> 프로젝트: **우리들의 즐거운 한글 교실** (성인문해교실 스마트 칠판 체험 프로그램)
> 기관: 서구종합사회복지관 (종합사회복지관)
> 문서 버전: 0.1.0 (설계 단계) · 작성일: 2026-11-19

이 문서는 Claude Code 등 AI 개발 도구와 개발자가 이 저장소에서 작업할 때 **반드시 먼저 읽고 따라야 하는 규칙**입니다. 다른 문서와 충돌하면 아래 우선순위를 따릅니다.

**문서 우선순위**: `SECURITY.md` > `PROJECT_SPEC.md` > `DATA_MODEL.md` > `FEATURES.md` > `UI_UX.md` > `DEVELOPMENT_PLAN.md` > `README.md`
(개인정보·보안 규칙이 항상 최우선입니다.)

---

## 1. 프로젝트 목적

- 성인문해교실 어르신(기초 한글 해득 ~ 초등학력 인정 과정 수준, 정확한 단계 매핑은 `PROJECT_SPEC.md` §10 확인 필요)이 **대형 스마트 칠판(16:9 터치 모니터/스마트 TV)** 앞에서 손가락·터치펜으로 직접 참여하는 체험형 한글 학습 도구를 만든다.
- 4대 핵심 활동
  | 코드 | 활동명 | 내부 식별자 |
  |---|---|---|
  | ① | 깍두기 칸 글씨 따라쓰기 | `trace` |
  | ② | 초성 보고 낱말 맞히기 | `chosung` |
  | ③ | 그림과 낱말 선 긋기 짝짓기 | `match` |
  | ④ | 생활 속 빈칸 문장 완성하기 | `blank` |
- 업무 흐름: **수업 전 준비**(강사: 문제 세트 선택·편집·백업) → **수업 중 체험**(수업 모드 전체 화면, 즉각 칭찬 피드백) → **수업 후 마무리**(A4 복습 학습지 인쇄/PDF 저장).
- 학습자는 **어린이가 아닌 성인 어르신**이다. 저장소 이름(`kids-game`)과 무관하게 유아적 캐릭터·말투·디자인을 쓰지 않는다.

## 2. 작업 원칙

1. **문서 우선**: 기능을 구현·변경하기 전에 관련 문서(§9)를 먼저 확인하고, 문서와 코드가 다르면 문서를 기준으로 하되 충돌을 사용자에게 보고한다.
2. **개인정보 비수집**: 어르신의 성명·생년월일·연락처·주소·사진 등 개인 식별 정보를 입력받는 필드, 저장 로직, 샘플 데이터를 만들지 않는다. 학습 기록은 **개인이 아닌 활동(회차) 단위**로만 저장한다. (`SECURITY.md` §2)
3. **완전 오프라인**: 외부 네트워크 요청이 0건이어야 한다. CDN·외부 폰트·외부 API·분석 도구·`fetch()`로 원격 URL 호출 금지.
4. **존엄성 우선 피드백**: 오답에도 꾸짖는 표현·버저음·빨간 X 대형 표시를 쓰지 않는다. 개인별 순위·등수를 표시하지 않는다. 시간 제한(카운트다운)을 기본으로 두지 않는다.
5. **고시인성·터치 안전 규칙은 협상 불가**: `UI_UX.md` §2의 최소 크기(본문 24px, 버튼 글자 28px, 제목 42px, 학습 낱말·초성 64px, 버튼 높이 80px, 버튼 간격 20px)와 **세로 스크롤 금지(100vh 한 화면)** 를 모든 화면에 적용한다.
6. **확인되지 않은 사항은 단정하지 않는다**: 법령·공식 평가지표·보존 기간·문해교육 단계 기준은 "확인 필요"로 표시하고 TODO로 남긴다.
7. **작게, 검증하며**: `DEVELOPMENT_PLAN.md`의 단계 순서를 따르고, 각 단계의 검증 기준을 통과한 뒤 다음 단계로 간다.

## 3. 기술 스택

| 구분 | 결정 | 비고 |
|---|---|---|
| 언어 | HTML5, CSS3, JavaScript(ES2020) | 프레임워크·빌드 도구 없음 |
| 모듈 방식 | **클래식 `<script defer>` + 전역 네임스페이스 `window.HG`** | `file://` 직접 실행 시 ES Module은 CORS로 로드되지 않으므로 사용하지 않는다 |
| 라우팅 | 해시 라우팅(`#/home`) | `file://`에서도 동작 |
| 저장소 | IndexedDB (DB명 `hangul-classroom`) | `localStorage`는 마지막 화면 등 **비핵심 UI 상태**에만 허용 |
| 필기 | Canvas 2D + Pointer Events | `pointerdown/move/up/cancel`, `getCoalescedEvents()`, `lineCap/lineJoin = 'round'` |
| 소리 | Web Audio API (오실레이터 합성) | 음원 파일·외부 리소스 없음 |
| 출력 | 인쇄 전용 CSS(`@page A4`) + `window.print()` | PDF는 브라우저 인쇄 대화상자의 "PDF로 저장" 사용. PDF 라이브러리 미사용 |
| 글꼴 | 시스템 글꼴 우선(맑은 고딕 등) | 로컬 번들 글꼴은 라이선스 확인 후에만 `assets/fonts/`에 포함 (TODO) |
| 테스트 | 자체 제작 브라우저 테스트 러너(`tests/test.html`) | 개발 PC 전용 E2E(Playwright 등)는 선택 사항이며 배포물에 포함하지 않음 |
| 대상 브라우저 | Chrome / Edge 최신 안정판(데스크톱) | 스마트 칠판 내장 브라우저 지원 여부 확인 필요 (`PROJECT_SPEC.md` §10) |

## 4. 파일 구조

```
/ (프로젝트 루트)
├─ index.html                 # 단일 진입점. 모든 css/js를 상대경로로 로드
├─ css/
│  ├─ tokens.css              # 색상·글자·간격 디자인 토큰 (UI_UX.md §2와 1:1)
│  ├─ base.css                # 리셋, 글꼴, 100vh 고정 레이아웃
│  ├─ layout.css              # 앱 셸, 그리드(16:9)
│  ├─ components.css          # 버튼, 카드, 대화상자, 토스트, 페이지네이션
│  ├─ activities.css          # 활동 4종 화면
│  └─ print.css               # A4 학습지 (@media print)
├─ js/
│  ├─ app.js                  # 부트스트랩(DB 열기→시드→설정 적용→라우터 시작)
│  ├─ core/
│  │  ├─ namespace.js         # window.HG = {} 생성 (가장 먼저 로드)
│  │  ├─ db.js                # IndexedDB 래퍼(open/upgrade/CRUD/트랜잭션)
│  │  ├─ repo.js              # 엔터티별 저장소(topics, problemSets, assets, lessons, activityRecords, settings, meta)
│  │  ├─ router.js            # 해시 라우터 + 화면 생명주기(mount/unmount)
│  │  ├─ validate.js          # 입력 검증 규칙 (DATA_MODEL.md §4와 1:1)
│  │  ├─ privacy.js           # 개인정보 의심 패턴 경고 (SECURITY.md §2.3)
│  │  ├─ hangul.js            # 초성 추출, 음절 분해, 받침 유무 판정
│  │  ├─ audio.js             # Web Audio 효과음
│  │  ├─ scoring.js           # 점수·별 계산 (FEATURES.md F-10)
│  │  ├─ backup.js            # 내보내기/가져오기/검증/마이그레이션
│  │  ├─ ids.js               # ID 생성(crypto.randomUUID 폴백 포함)
│  │  ├─ hash.js              # SHA-256(폴백 포함)·PBKDF2
│  │  └─ format.js            # 날짜·숫자 표시
│  ├─ data/
│  │  └─ seed.js              # 내장 샘플 데이터 15세트 (DATA_MODEL.md §6)
│  ├─ ui/
│  │  ├─ dom.js               # 안전한 DOM 생성 헬퍼(textContent 전용)
│  │  ├─ components.js        # 버튼, 카드, 페이지네이션
│  │  ├─ dialog.js            # 확인/경고 대화상자 (포커스 트랩)
│  │  ├─ toast.js             # 알림 + 되돌리기
│  │  ├─ feedback.js          # 정답/오답/칭찬 애니메이션 + live region
│  │  └─ images.js            # 그림 표시·업로드 축소/재인코딩
│  ├─ activities/
│  │  ├─ common.js            # 섞기, 조사, 오답 보기 선택
│  │  ├─ trace.js             # ① 따라쓰기 (캔버스·커버리지 판정)
│  │  ├─ chosung.js           # ② 초성 맞히기
│  │  ├─ match.js             # ③ 선 긋기 짝짓기 (SVG 선 오버레이)
│  │  └─ blank.js             # ④ 빈칸 문장
│  └─ screens/                # UI_UX.md §3 화면 ID와 1:1 대응
│     ├─ home.js  quick.js  plans.js  plan-edit.js  run.js  result.js  summary.js
│     ├─ print.js  stats.js
│     └─ admin-home.js  admin-sets.js  admin-set-edit.js  admin-topics.js
│        admin-images.js  admin-backup.js  admin-display.js  pin.js
├─ assets/
│  ├─ images/samples/         # 내장 그림(자체 제작 SVG만, 저작권 확인 필수)
│  ├─ icons/                  # UI 아이콘(SVG, 자체 제작)
│  └─ fonts/                  # (선택) 라이선스 확인된 글꼴만
├─ tests/
│  ├─ test.html               # 브라우저에서 여는 테스트 러너
│  ├─ runner.js               # 최소 assert/describe 구현
│  ├─ *.test.js               # 단위 테스트
│  └─ fixtures/               # 가상 데이터 백업 파일(정상/손상/구버전)
└─ *.md                       # 설계 문서 (§9)
```

- 스크립트 로드 순서: `namespace.js` → `core/*` → `data/*` → `ui/*` → `activities/*` → `screens/*` → `app.js`.
- 각 파일은 IIFE로 감싸고 `HG.<모듈명>`에만 공개 API를 등록한다.

## 5. 코딩 규칙

### 5.1 일반
- `'use strict';`, `const`/`let`만 사용, 세미콜론 사용, 들여쓰기 2칸.
- 식별자는 영어, 사용자에게 보이는 문구는 한국어 **존댓말**. 문구는 각 화면 파일 상단 `TEXT` 상수에 모은다(추후 문구 검수 용이).
- 함수는 한 가지 일만. 화면 파일 하나는 `mount(container, params)` / `unmount()` 두 공개 함수를 가진다.
- 모든 비동기 IndexedDB 작업은 Promise 기반 `HG.db` 래퍼를 통해서만 호출한다. 화면에서 `indexedDB`를 직접 쓰지 않는다.

### 5.2 DOM·보안
- 사용자 입력·백업 파일에서 온 문자열은 **반드시 `textContent`** 로 출력. `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, 인라인 이벤트 속성(`onclick=""`) 금지.
- 업로드 이미지는 `Blob` → `URL.createObjectURL()`로 표시하고, 화면 해제 시 `URL.revokeObjectURL()` 호출.
- `index.html`에 CSP 메타 태그 적용(`SECURITY.md` §5.1).

### 5.3 레이아웃·스타일
- 색·크기·간격은 `tokens.css`의 CSS 변수만 사용(하드코딩 금지).
- 최상위 앱 셸은 `height: 100vh; height: 100dvh; overflow: hidden;`. 콘텐츠가 넘치면 **스크롤이 아니라 페이지 나눔(페이지네이션)** 으로 해결한다.
- 글자 크기는 `--font-scale` 변수 × 기본값. 어떤 배율에서도 최소값(§2-5) 아래로 내려가지 않게 `max()`를 사용한다.

### 5.4 터치·필기
- 필기 캔버스: `touch-action: none`, `pointerdown`에서 `setPointerCapture`, `getCoalescedEvents()`로 중간 좌표 보간, 중점 기반 `quadraticCurveTo` 곡선 보정, `devicePixelRatio` 반영.
- 버튼은 `pointerup` 기준으로 동작(`click` 이벤트 사용 가능)하며, 동일 버튼 연타 방지(300ms 디바운스)를 적용한다.
- 다중 터치 시 첫 번째 포인터만 필기에 사용(`isPrimary`), 손바닥 오입력 완화.

### 5.5 소리
- `AudioContext`는 첫 사용자 제스처에서 생성/`resume()`. 소리 끔 설정 시 생성하지 않는다.
- 피드백은 **소리만으로 전달하지 않는다**(항상 시각 표시 + 텍스트 동반).

## 6. 금지사항 (위반 시 작업 중단 후 보고)

- [ ] 외부 URL 로드(`<script src="https://…">`, `@import url(https://…)`, Google Fonts, CDN, 원격 이미지, 원격 `fetch`)
- [ ] 어르신 개인정보 입력 필드 생성(이름, 생년월일, 전화번호, 주소, 주민등록번호, 건강 상태 등) 및 개인별 성적 저장
- [ ] 실제 인물 정보·실명·실제 사진이 들어간 샘플 데이터·테스트 픽스처
- [ ] 개인별 순위·등수·"꼴찌" 표현, 큰 소리 버저음, 공포·조롱 연출
- [ ] 세로 스크롤이 생기는 화면, 높이 80px 미만 터치 버튼
- [ ] `innerHTML` 등 HTML 문자열 삽입, `eval`
- [ ] ES Module(`type="module"`)·npm 런타임 의존성·프레임워크 도입 (사전 합의 없이)
- [ ] 백업 파일에 암호화가 적용된 것처럼 안내하는 문구 (현재 암호화 미제공)
- [ ] 확인되지 않은 법령 조항·평가지표를 사실처럼 기재
- [ ] 사용자가 요청하지 않은 문서 파일 추가 생성 (현재 선택 문서: §9의 8종)

## 7. 완료 기준 (Definition of Done)

기능 하나를 "완료"로 보고하려면 아래를 모두 충족해야 한다.

1. `FEATURES.md`의 해당 기능 **완료 기준** 항목을 모두 충족.
2. `tests/test.html`의 관련 단위 테스트 통과, `DEVELOPMENT_PLAN.md` 해당 단계 **검증 기준** 통과.
3. 1920×1080, 1366×768, 1280×720 뷰포트 및 글자 크기 배율 3단계 모두에서 **세로 스크롤 없음** 확인.
4. 키보드만으로 조작 가능(필기 활동은 "건너뛰기/다음" 대체 경로 제공), 포커스 표시 확인.
5. 네트워크 차단 상태(개발자도구 Offline)에서 동작, 콘솔에 외부 요청·오류 없음.
6. 개인정보 입력 필드가 새로 생기지 않았음을 확인.
7. 관련 문서 갱신(§8) 완료.

## 8. 변경 시 문서 갱신 규칙

| 변경 내용 | 반드시 갱신할 문서 |
|---|---|
| 엔터티·필드·인덱스·검증 규칙 변경 | `DATA_MODEL.md` (+ `schemaVersion` 증가, 마이그레이션 절차 기재) |
| 기능 추가·삭제·동작 변경 | `FEATURES.md`, 필요 시 `PROJECT_SPEC.md` 요구사항 ID |
| 화면·문구·크기·색 변경 | `UI_UX.md`, `css/tokens.css` |
| 저장·백업·입력 처리 방식 변경 | `SECURITY.md`, `DATA_MODEL.md` §5 |
| 단계·우선순위 변경 | `DEVELOPMENT_PLAN.md` |
| 실행 방법·사용법 변경 | `README.md` |
| 새 파일·폴더 추가 | 이 문서 §4 |

- 용어는 아래 **용어집**을 기준으로 모든 문서·코드·화면 문구에서 통일한다.
- 변경 이력 전용 문서(CHANGELOG 등)는 현재 생성 범위에 포함되지 않았다. 버전 변경 시 커밋 메시지에 `schemaVersion`/`appVersion` 변화를 명시한다. (별도 문서 필요 여부: 확인 필요)

## 9. 문서 목록

| 파일 | 역할 |
|---|---|
| `CLAUDE.md` | AI 개발 지침 (이 문서) |
| `README.md` | 설치·사용 안내 |
| `PROJECT_SPEC.md` | 요구사항 명세 (FR/NFR, 수용 기준) |
| `FEATURES.md` | 기능 명세 (F-01 ~ F-19) |
| `DATA_MODEL.md` | 데이터 구조, 검증 규칙, 백업 형식, 내장 샘플 |
| `UI_UX.md` | 메뉴·화면(S-00 ~ S-21)·디자인 토큰·접근성 |
| `SECURITY.md` | 개인정보·보안·로컬 저장 한계 |
| `DEVELOPMENT_PLAN.md` | 단계별 개발·검증 계획(테스트 시나리오 포함) |

## 10. 용어집

| 용어 | 정의 | 코드 식별자 |
|---|---|---|
| 강사 | 문해교육 강사 또는 담당 사회복지사. 앱의 유일한 관리 역할 | — |
| 학습자 / 어르신 | 성인문해교실 수강생. 앱에 계정·식별 정보가 없음 | — |
| 주제 | 가족, 건강·병원, 시장·경제, 사계절, 교통 등 학습 분류 | `Topic` |
| 수준 | 초급·중급·고급 | `level`: `beginner` / `intermediate` / `advanced` |
| 문제 세트 | 낱말 목록 + 문장 목록 + 활동 옵션의 묶음 | `ProblemSet` |
| 낱말 | 세트 안의 학습 낱말(따라쓰기·초성·짝짓기에 사용) | `WordItem` |
| 문장 | 빈칸 문장 활동용 생활 문장 | `SentenceItem` |
| 내장 세트 | 앱에 포함된 샘플 세트. 수정 불가, 복제 후 편집 | `isBuiltIn: true` |
| 수업 계획 | 날짜·주제·세트·활동 순서를 정한 수업 단위 | `Lesson` |
| 빠른 시작 | 수업 계획 없이 세트·활동을 골라 바로 진행 | `lessonId: null` |
| 수업 모드 | 학습자용 전체 화면 진행 상태(관리 메뉴 숨김) | `run` 화면 |
| 활동 기록 | 활동 1회 진행 결과(개인 식별 없음) | `ActivityRecord` |
| 별 | 활동 1회 결과 1~3개. 참여만 해도 최소 1개 | `stars` |
| 우리 반 별 | 수업 1회 동안 모은 별의 합(공동 목표) | 계산값 |
| 학습지 | A4 복습 인쇄물 | `print` 화면 |
| 백업 파일 | 전체 데이터 JSON 내보내기 파일 | `format: "hangul-classroom-backup"` |
| 세트 파일 | 문제 세트 1개 이상만 담은 공유용 JSON | `format: "hangul-classroom-sets"` |
