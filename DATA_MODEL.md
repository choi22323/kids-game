# DATA_MODEL.md — 데이터 구조

> 문서 버전 0.1.0 · `schemaVersion: 1` · `SEED_VERSION: 1` · 2026-11-19
> 저장소: 브라우저 IndexedDB (DB명 `hangul-classroom`, DB 버전 = `schemaVersion`)
> 모든 샘플 값은 **가상 데이터**이며 실제 이용자 정보가 아니다.

---

## 1. 설계 원칙

1. **학습자 개인 엔터티 없음**: `Learner`, `Student`, `Attendance` 같은 개인 단위 엔터티를 만들지 않는다. 기록은 활동 1회 단위(`ActivityRecord`)로만 남긴다.
2. **세트 자기완결성**: 문제 세트는 낱말·문장을 내부에 포함(embed)한다. 세트 단위 복제·공유·백업이 쉽고 참조 무결성 문제가 적다. 그림만 `Asset`으로 분리 참조한다.
3. **파생 값은 저장하지 않는다**: 초성, 빈칸 문장, 가능 활동, 점수 합계 등은 실행 시 계산한다(단, `ActivityRecord`의 결과값은 당시 결과 보존을 위해 저장).
4. **날짜·시간**: 날짜는 `YYYY-MM-DD` 문자열(현지 날짜), 시각은 ISO 8601 문자열(`new Date().toISOString()`, UTC).
5. **ID**: 문자열. 사용자 생성 = `crypto.randomUUID()`(미지원 시 `crypto.getRandomValues` 기반 UUID v4 폴백), 내장 = 고정 문자열(`seed-…`, `topic-…`).
6. IndexedDB는 boolean을 인덱싱할 수 없으므로 boolean 필드에는 인덱스를 두지 않고 메모리에서 필터링한다(데이터 규모가 작음: 세트 수백 건 이하 가정).

## 2. 엔터티 관계

```
Topic 1 ──── N ProblemSet ──(embed)── WordItem[] ── 0..1 ──► Asset (image.kind = 'asset')
                 │          └─(embed)── SentenceItem[]
                 │
                 ├── N ◄── Lesson.activityPlan[].problemSetId   (N:M, 참조)
                 └── N ◄── ActivityRecord.problemSetId           (참조, 세트 삭제 후에도 기록 유지)
Lesson 1 ──── N ActivityRecord (lessonId, 빠른 시작은 null)
Settings (key-value), Meta (key-value) — 독립
```

## 3. 객체 저장소(Object Store)와 엔터티

### 3.0 저장소 요약

| Store | keyPath | 인덱스 | 설명 |
|---|---|---|---|
| `topics` | `id` | `order` | 주제 |
| `problemSets` | `id` | `topicId`, `level`, `topicLevel`(복합 `[topicId, level]`), `updatedAt` | 문제 세트 |
| `assets` | `id` | `sha256`(unique), `createdAt` | 이미지 Blob |
| `lessons` | `id` | `date`, `status` | 수업 계획 |
| `activityRecords` | `id` | `lessonId`, `startedAt`, `activity`, `problemSetId` | 활동 기록 |
| `settings` | `key` | — | 설정 |
| `meta` | `key` | — | 시스템 메타 |

### 3.1 Topic (주제)

| 필드 | 타입 | 필수 | 규칙/설명 | 예 |
|---|---|---|---|---|
| `id` | string | ✔ | 내장 `topic-<slug>`, 사용자 UUID | `topic-market` |
| `name` | string | ✔ | 1~12자, 앞뒤 공백 제거, 이름 중복 불가 | `시장·경제` |
| `icon` | string | ✔ | 내장 아이콘 키(`family`,`health`,`market`,`seasons`,`transport`,`book`,`star`,`home`,`food`,`holiday`) | `market` |
| `order` | number | ✔ | 0 이상 정수, 표시 순서 | `2` |
| `isBuiltIn` | boolean | ✔ | 내장 주제는 삭제 불가 | `true` |
| `createdAt` | string(ISO) | ✔ | | |
| `updatedAt` | string(ISO) | ✔ | | |

내장 주제: `topic-family`(가족), `topic-health`(건강·병원), `topic-market`(시장·경제), `topic-seasons`(사계절), `topic-transport`(교통)

### 3.2 ProblemSet (문제 세트)

| 필드 | 타입 | 필수 | 규칙/설명 |
|---|---|---|---|
| `id` | string | ✔ | 내장 `seed-<topicSlug>-<level>`, 사용자 UUID |
| `title` | string | ✔ | 1~30자 |
| `topicId` | string | ✔ | → `Topic.id` (존재해야 함) |
| `level` | enum | ✔ | `beginner`(초급) / `intermediate`(중급) / `advanced`(고급) |
| `description` | string | | 0~100자 |
| `isBuiltIn` | boolean | ✔ | true면 읽기 전용 |
| `isHidden` | boolean | ✔ | 기본 false. 목록·선택지에서 숨김 |
| `words` | WordItem[] | ✔ | 4~20개, `text` 중복 불가 |
| `sentences` | SentenceItem[] | ✔ | 0~12개 (빈 배열 허용) |
| `activityOptions` | object | ✔ | 아래 표 |
| `tags` | string[] | | 각 1~10자, 최대 5개 |
| `sourceSetId` | string \| null | | 복제·가져오기 원본 id (참조 무결성 강제 안 함) |
| `createdAt` / `updatedAt` | string(ISO) | ✔ | |

`activityOptions`

| 키 | 타입 | 기본값 | 범위 |
|---|---|---|---|
| `trace.enabled` | boolean | true | |
| `trace.gridStyle` | enum | `cross` | `cross`(십자 점선) / `plain` |
| `trace.repeat` | number | 1 | 1~3 (낱말당 반복 쓰기 횟수) |
| `chosung.enabled` | boolean | true | |
| `chosung.optionCount` | number | 3 | 3 / 4 |
| `chosung.showImageHint` | boolean | true | |
| `match.enabled` | boolean | true | |
| `match.pairsPerRound` | number | 3 | 3 / 4 |
| `blank.enabled` | boolean | true | |

**가능 활동(파생)**: `enabled` 이면서 — trace/chosung: 낱말 ≥ 3 / match: 그림 있는 낱말 ≥ 3 / blank: 문장 ≥ 1

### 3.3 WordItem (낱말, ProblemSet에 포함)

| 필드 | 타입 | 필수 | 규칙/설명 |
|---|---|---|---|
| `id` | string | ✔ | 세트 내 고유(`w1`, `w2` … 또는 UUID) |
| `text` | string | ✔ | 1~8 음절(공백 제외), 한글 음절·공백만 권장(숫자·영문은 경고) |
| `image` | object \| null | | `{ kind: 'builtin' \| 'asset' \| 'emoji', ref: string, alt: string }` |
| `hint` | string | | 0~30자 (예: "빨간 과일") |
| `order` | number | ✔ | 0 이상 정수 |

- `image.kind='builtin'` → `ref` = `assets/images/samples/` 내 파일명(예: `apple.svg`)
- `image.kind='asset'` → `ref` = `Asset.id`
- `image.kind='emoji'` → `ref` = 이모지 문자 1개(그림 대체용; 기기별 표시 차이 있음, 확인 필요 Q-07)
- `alt`: 1~30자, 없으면 `text` 사용
- **파생**: `chosung = HG.hangul.getChosung(text)`

### 3.4 SentenceItem (문장, ProblemSet에 포함)

| 필드 | 타입 | 필수 | 규칙/설명 |
|---|---|---|---|
| `id` | string | ✔ | 세트 내 고유(`s1` …) |
| `text` | string | ✔ | 완성 문장, 4~40자 |
| `answer` | string | ✔ | 1~10자, `text` 안에 **정확히 1회** 등장 |
| `distractors` | string[2] | ✔ | 각 1~10자, `answer` 및 서로 중복 불가 |
| `order` | number | ✔ | |

**파생**: 빈칸 문장 = `text`의 `answer` 위치를 빈칸으로 치환. 조사는 빈칸에 포함하지 않는다.

### 3.5 Asset (이미지)

| 필드 | 타입 | 필수 | 규칙/설명 |
|---|---|---|---|
| `id` | string | ✔ | UUID |
| `label` | string | ✔ | 이름표·대체텍스트 1~30자 |
| `mime` | enum | ✔ | `image/webp` / `image/jpeg` / `image/png` (재인코딩 결과) |
| `blob` | Blob | ✔ | 긴 변 ≤ 1024px, 목표 ≤ 500KB |
| `width` / `height` | number | ✔ | px |
| `size` | number | ✔ | bytes |
| `sha256` | string | ✔ | 재인코딩 후 Blob 해시(hex), unique |
| `createdAt` / `updatedAt` | string(ISO) | ✔ | |

- 원본 파일명은 **저장하지 않는다**(파일명에 개인정보가 들어갈 수 있음).
- 사용처는 저장하지 않고 `problemSets` 전체를 조회해 계산한다.

### 3.6 Lesson (수업 계획)

| 필드 | 타입 | 필수 | 규칙/설명 |
|---|---|---|---|
| `id` | string | ✔ | UUID |
| `date` | string | ✔ | `YYYY-MM-DD` |
| `title` | string | ✔ | 1~30자 (예: "시장에 가요") |
| `topicId` | string | ✔ | → Topic |
| `level` | enum | ✔ | |
| `activityPlan` | object[] | ✔ | 1~8개 `{ order, activity: 'trace'\|'chosung'\|'match'\|'blank', problemSetId }` |
| `status` | enum | ✔ | `planned` / `inProgress` / `done` / `canceled` |
| `participantCount` | number \| null | | 0~30 정수. **인원 수만**, 명단 아님 |
| `memo` | string | | 0~200자, 개인정보 경고 대상 |
| `startedAt` / `endedAt` | string(ISO) \| null | | |
| `createdAt` / `updatedAt` | string(ISO) | ✔ | |

상태 전환

```
planned ──수업 시작──► inProgress ──수업 종료──► done
   │                       │
   └──취소──► canceled     └──(중단 후 재실행 시 이어하기 / 강제 종료 시 done)
```
- `done`, `canceled`는 편집 불가(복제만 가능). `canceled` → `planned` 되돌리기 허용.

### 3.7 ActivityRecord (활동 기록)

| 필드 | 타입 | 필수 | 규칙/설명 |
|---|---|---|---|
| `id` | string | ✔ | UUID |
| `lessonId` | string \| null | ✔ | 빠른 시작은 null |
| `problemSetId` | string | ✔ | 세트 삭제 후에도 유지 |
| `problemSetTitle` | string | ✔ | 기록 시점 제목 스냅샷 |
| `topicId` / `level` | string / enum | ✔ | 스냅샷 (통계 필터용) |
| `activity` | enum | ✔ | `trace` / `chosung` / `match` / `blank` |
| `startedAt` / `endedAt` | string(ISO) | ✔ | |
| `durationSec` | number | ✔ | 정수, 점수 미반영 |
| `totalQuestions` | number | ✔ | ≥ 1 |
| `correctFirstTry` | number | ✔ | |
| `correctAfterRetry` | number | ✔ | |
| `revealed` | number | ✔ | 정답 보여 주기 횟수 |
| `skipped` | number | ✔ | |
| `hintsUsed` | number | ✔ | |
| `avgCoverage` | number \| null | | trace만, 0~1 |
| `score` | number | ✔ | 0~100 (`FEATURES.md` F-10) |
| `stars` | number | ✔ | 0~3 |
| `completed` | boolean | ✔ | |
| `itemResults` | object[] | ✔ | `{ itemId, text, attempts, result: 'first'\|'retry'\|'revealed'\|'skipped', coverage? }` |

- **저장하지 않는 것**: 누가 참여했는지(이름·번호·차례·좌석), 필기 이미지·획 좌표, 사진·음성.
- 무결성: `correctFirstTry + correctAfterRetry + revealed + skipped = totalQuestions`

### 3.8 Settings (key-value)

| key | 타입 | 기본값 | 범위 |
|---|---|---|---|
| `fontScale` | number | 1.0 | 1.0 / 1.15 / 1.3 |
| `soundEnabled` | boolean | true | |
| `volume` | number | 0.6 | 0~1 (0.1 단위) |
| `reduceMotion` | enum | `auto` | `auto`(OS 따름) / `on` / `off` |
| `traceStrokeWidth` | number | 24 | 12~40 |
| `shuffleQuestions` | boolean | false | |
| `praiseMessages` | string[] | F-09 기본 문구 | 각 1~20자, 1~10개 |
| `retryMessages` | string[] | F-09 기본 문구 | 각 1~20자, 1~10개 |
| `backupReminderDays` | number | 7 | 0~30 |
| `recordRetentionMonths` | number | 12 | 0~60 (확인 필요 Q-08) |
| `adminPinHash` | string \| null | null | PBKDF2 결과 hex |
| `adminPinSalt` | string \| null | null | 16바이트 hex |
| `institutionName` | string | `서구종합사회복지관` | 1~30자 (학습지 머리글) |
| `programName` | string | `우리들의 즐거운 한글 교실` | 1~30자 |

범위 밖 값은 읽을 때 기본값으로 교정한다.

### 3.9 Meta (key-value)

| key | 타입 | 설명 |
|---|---|---|
| `schemaVersion` | number | 현재 1 |
| `seedVersion` | number | 설치된 내장 데이터 버전 |
| `appVersion` | string | 예 `0.1.0` |
| `installedAt` | string(ISO) | 최초 실행 |
| `lastBackupAt` | string(ISO) \| null | 마지막 전체 백업 |
| `lastRestoreAt` | string(ISO) \| null | |
| `resumeLessonId` | string \| null | 중단된 수업 이어하기 |

## 4. 검증 규칙 (`js/core/validate.js`와 1:1)

| 코드 | 대상 | 규칙 | 오류 문구(예) |
|---|---|---|---|
| V-01 | 모든 문자열 | 앞뒤 공백 제거, 제어문자(U+0000~001F, U+007F) 제거 | — |
| V-02 | 길이 | §3 각 필드 최소·최대 | "제목은 1~30자로 입력해 주세요 (지금 32자)" |
| V-03 | `WordItem.text` | 공백 제외 1~8음절, 세트 내 중복 불가 | "'사과'가 이미 있습니다" |
| V-04 | `WordItem.text` | 한글 음절(가~힣)·공백 외 문자 → **경고** | "한글이 아닌 글자가 있습니다. 그대로 저장할까요?" |
| V-05 | `SentenceItem.answer` | `text` 안 정확히 1회 | "문장에 정답 '사과'가 없습니다" / "정답 '사'가 문장에 2번 나옵니다. 더 긴 낱말로 정해 주세요" |
| V-06 | `distractors` | 2개, 빈 값·정답·서로 중복 불가 | "보기에 같은 낱말이 있습니다" |
| V-07 | `distractors` | 받침 유무가 정답과 다름 → **경고**(조사 단서 방지) | "보기의 받침이 정답과 달라 조사로 답을 짐작할 수 있습니다" |
| V-08 | `ProblemSet.words` | 4~20개 | "낱말을 4개 이상 넣어 주세요" |
| V-09 | `topicId` | 존재하는 주제 | "주제를 골라 주세요" |
| V-10 | `Lesson.activityPlan` | 각 단계 세트 존재 + 해당 활동 가능 | "이 세트로는 짝짓기를 할 수 없습니다(그림 있는 낱말 3개 미만)" |
| V-11 | 개인정보 의심 | `title`, `memo`, `description`, `hint`, `label`, 문장에서 패턴 감지 시 **경고**(`SECURITY.md` §2.3) | "전화번호처럼 보이는 내용이 있습니다. 어르신 개인정보는 입력하지 마세요" |
| V-12 | 숫자 | 정수·범위 | "참여 인원은 0~30 사이 숫자로 입력해 주세요" |
| V-13 | 날짜 | 유효한 `YYYY-MM-DD` | "날짜를 다시 확인해 주세요" |
| V-14 | 이미지 | MIME 화이트리스트, 원본 ≤ 5MB, 디코딩 성공 | F-14 참조 |

**경고**는 강사 확인 후 저장 가능, **오류**는 저장 불가.

## 5. 저장·삭제·복원 정책

### 5.1 저장
- 모든 쓰기는 `readwrite` 트랜잭션. 세트 저장 시 검증 → `updatedAt` 갱신 → put.
- 앱 시작 시 `navigator.storage.persist()` 요청(지원·허용 여부는 브라우저별 상이, 결과를 설정 화면에 표시).
- `QuotaExceededError` 처리: 저장 실패 안내 + 백업·이미지 정리 유도.

### 5.2 삭제
| 대상 | 정책 |
|---|---|
| 내장 주제·세트 | 삭제 불가(세트는 숨김만) |
| 사용자 세트 | 확인 대화상자 → 즉시 삭제, 10초 "되돌리기"(메모리 보관 후 재저장). 참조 중인 `planned` 수업 계획이 있으면 경고 |
| 주제 | 소속 세트 0개일 때만 |
| 이미지 | 참조 시 사용처 안내 후 삭제, 참조한 낱말의 `image`는 null로 정리(같은 트랜잭션) |
| 수업 계획 | `inProgress` 삭제 불가, 그 외 확인 후 삭제. 연결된 `ActivityRecord`는 유지(`lessonId` 그대로, 통계에서 "삭제된 수업"으로 표시) |
| 활동 기록 | F-19 정리 기능 또는 [모든 기록 지우기](이중 확인) |
| 전체 초기화 | 설정 > 백업·복원 > [모든 데이터 지우기]: 안전 백업 다운로드 권장 → "모두 지우기" 문구 입력 확인 → DB 삭제 후 시드 재설치 |

### 5.3 백업 파일 형식

```json
{
  "format": "hangul-classroom-backup",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "exportedAt": "2026-11-19T06:00:00.000Z",
  "options": { "includeRecords": true, "includeImages": true },
  "counts": { "topics": 5, "problemSets": 17, "assets": 3, "lessons": 4, "activityRecords": 26, "settings": 14 },
  "checksum": { "algorithm": "SHA-256", "value": "<data를 JSON.stringify한 문자열의 hex 해시>" },
  "data": {
    "topics": [ ... ],
    "problemSets": [ ... ],
    "assets": [ { "id": "...", "label": "...", "mime": "image/webp", "width": 800, "height": 600, "size": 41230, "sha256": "...", "dataBase64": "...", "createdAt": "...", "updatedAt": "..." } ],
    "lessons": [ ... ],
    "activityRecords": [ ... ],
    "settings": [ { "key": "fontScale", "value": 1.15 } ]
  }
}
```
- `settings`의 `adminPinHash`·`adminPinSalt`는 **백업에 포함하지 않는다**(다른 기기로 PIN 잠금이 옮겨지는 혼란 방지).
- 내장 세트(`isBuiltIn`)는 `isHidden` 상태만 `builtInState: [{id, isHidden}]`로 저장하고 본문은 제외한다.
- 체크섬은 무결성 확인용이며 **위변조 방지·암호화가 아니다**.

세트 공유 파일

```json
{
  "format": "hangul-classroom-sets",
  "schemaVersion": 1,
  "exportedAt": "...",
  "checksum": { "algorithm": "SHA-256", "value": "..." },
  "data": { "topics": [ /* 세트가 참조하는 사용자 주제만 */ ], "problemSets": [ ... ], "assets": [ ... ] }
}
```

### 5.4 복원·가져오기 규칙
1. 파일 크기 ≤ 200MB, `JSON.parse` 실패 시 중단.
2. `format` 확인 → `schemaVersion` 비교: 같음 → 진행 / 낮음 → `migrate(fromVersion)` 순차 적용 / 높음 → 중단.
3. 체크섬 검증 → 불일치 시 중단.
4. 모든 레코드에 §4 검증 + 타입 검사 + **허용 필드 외 키 제거**(`__proto__`, `constructor`, `prototype` 키가 있으면 파일 전체 거부).
5. 미리보기 → 강사 확인 → (권장) 현재 데이터 안전 백업 다운로드.
6. 적용은 하나의 `readwrite` 트랜잭션(모든 store). 실패 시 자동 롤백.
7. **전체 교체**: 사용자 데이터 store 비우기 → 백업 데이터 넣기 → 내장 시드 재적용 → `builtInState` 반영.
   **병합**: id 같으면 `updatedAt` 최신 유지, 이미지는 `sha256`으로 통합 후 참조 id 재매핑, 주제는 이름 같으면 기존 주제로 매핑.
8. 세트 파일 가져오기: 모든 세트·이미지·주제에 새 id 부여, 이미지 sha256 중복은 기존 것 재사용.

### 5.5 마이그레이션
- `onupgradeneeded`에서 `oldVersion`부터 순차 `migrations[v]()` 실행. 각 마이그레이션은 멱등이어야 한다.
- 백업 파일 마이그레이션은 같은 함수 표(`HG.backup.migrations`)를 사용한다.
- 스키마 변경 시 이 문서의 `schemaVersion`, 변경 필드, 변환 규칙을 갱신한다(`CLAUDE.md` §8).

## 6. 내장 샘플 데이터 (SEED_VERSION 1)

- 5개 주제 × 3개 수준 = **15세트** (요구: 12세트 이상)
- 수준 구분(기관 내부 기준 제안, 공식 단계 대응은 확인 필요 Q-04)
  - **초급**: 받침이 없거나 적은 2~3음절 생활 낱말, 짧은 문장
  - **중급**: 받침 있는 낱말, 생활 장소·행동 낱말
  - **고급**: 겹받침·합성어·생활 행정/금융 낱말, 조금 긴 문장
- 모든 낱말·문장은 **현장 강사 검수 필요(Q-05)**. 그림은 1차로 이모지(`image.kind='emoji'`)를 사용하고, 자체 제작 SVG로 교체 예정(Q-07).
- 문장 표기: `문장 [정답 / 오답1, 오답2]`

### 6.1 가족 (`topic-family`)

| 세트 id | 제목 | 낱말(그림) | 문장 |
|---|---|---|---|
| `seed-family-beginner` | 우리 가족 (초급) | 엄마👩, 아빠👨, 아기👶, 누나, 오빠, 이모, 고모, 부부💑 | 아기가 방긋 웃어요. [아기 / 오이, 나무] · 이모가 놀러 오셨어요. [이모 / 모자, 우유] · 오빠와 누나는 사이가 좋아요. [누나 / 바다, 구두] · 엄마가 밥을 지으세요. [엄마 / 거미, 하마] |
| `seed-family-intermediate` | 정다운 우리 집 (중급) | 할머니👵, 할아버지👴, 아들, 딸, 손자, 손녀, 사위, 며느리 | 할머니 댁에 손자가 왔어요. [손자 / 시장, 감기] · 우리 딸이 전화를 했어요. [딸 / 떡, 달] · 며느리가 반찬을 보내 주었어요. [며느리 / 미나리, 머리] · 할아버지는 산책을 좋아하세요. [산책 / 신발, 선물] |
| `seed-family-advanced` | 가족 행사 (고급) | 가족사진📷, 생일잔치🎂, 결혼식💒, 명절, 안부 전화☎️, 손주, 돌잔치, 효도 | 명절에 온 가족이 모였어요. [명절 / 병원, 영수증] · 손주의 돌잔치에 다녀왔어요. [돌잔치 / 정류장, 김장] · 주말마다 안부 전화를 해요. [안부 전화 / 전기 요금, 신호등] · 벽에 가족사진을 걸었어요. [가족사진 / 처방전, 교통카드] |

### 6.2 건강·병원 (`topic-health`)

| 세트 id | 제목 | 낱말(그림) | 문장 |
|---|---|---|---|
| `seed-health-beginner` | 내 몸 (초급) | 머리, 다리🦵, 허리, 이마, 코👃, 귀👂, 의사🧑‍⚕️, 주사💉 | 머리가 아파요. [머리 / 바다, 오리] · 의사 선생님을 만나요. [의사 / 이사, 우유] · 허리를 쭉 펴요. [허리 / 오리, 보리] · 주사를 맞았어요. [주사 / 주스, 가지] |
| `seed-health-intermediate` | 병원에 가요 (중급) | 병원🏥, 약국💊, 감기🤧, 혈압, 보건소, 간호사, 체온🌡️, 진찰 | 감기에 걸려서 병원에 갔어요. [병원 / 시장, 공원] · 약국에서 약을 샀어요. [약국 / 학교, 극장] · 보건소에서 혈압을 재요. [혈압 / 사과, 반찬] · 간호사가 체온을 재 주었어요. [체온 / 차표, 계란] |
| `seed-health-advanced` | 건강 지키기 (고급) | 처방전📝, 건강검진, 접수 창구, 복용법, 예방접종💉, 진료비, 보호자, 식후 | 의사 선생님이 처방전을 써 주셨어요. [처방전 / 영수증, 승차권] · 올해 건강검진 날짜를 잡았어요. [건강검진 / 단풍놀이, 결혼식] · 약은 식후 삼십 분에 드세요. [식후 / 입춘, 왕복] · 독감 예방접종을 맞았어요. [예방접종 / 노약자석, 공과금] |

### 6.3 시장·경제 (`topic-market`)

| 세트 id | 제목 | 낱말(그림) | 문장 |
|---|---|---|---|
| `seed-market-beginner` | 장보기 (초급) | 사과🍎, 배추🥬, 무, 두부, 우유🥛, 고구마🍠, 바나나🍌, 가지🍆 | 시장에서 사과를 샀어요. [사과 / 사자, 가구] · 두부로 찌개를 끓여요. [두부 / 구두, 나비] · 배추로 김치를 담가요. [배추 / 기차, 버스] · 아침에 우유를 마셔요. [우유 / 오이, 나무] |
| `seed-market-intermediate` | 시장 구경 (중급) | 시장🏪, 생선🐟, 계란🥚, 과일🍇, 반찬, 거스름돈🪙, 가격, 할인 | 생선 가게에서 고등어를 샀어요. [생선 / 생일, 선물] · 거스름돈을 받았어요. [거스름돈 / 정류장, 보건소] · 오늘은 과일을 할인해요. [할인 / 환승, 진찰] · 계란 한 판을 샀어요. [계란 / 기린, 계단] |
| `seed-market-advanced` | 은행과 생활비 (고급) | 영수증🧾, 통장📒, 현금인출기🏧, 적금, 공과금, 전기 요금💡, 카드 결제💳, 비밀번호🔒 | 물건을 사고 영수증을 받았어요. [영수증 / 처방전, 승차권] · 은행에서 통장 정리를 했어요. [통장 / 단풍, 체온] · 이번 달 전기 요금을 냈어요. [전기 요금 / 안부 전화, 하차 벨] · 비밀번호는 남에게 알려 주지 않아요. [비밀번호 / 건강검진, 꽃샘추위] |

### 6.4 사계절 (`topic-seasons`)

| 세트 id | 제목 | 낱말(그림) | 문장 |
|---|---|---|---|
| `seed-seasons-beginner` | 자연과 날씨 (초급) | 나무🌳, 바다🌊, 비🌧️, 해☀️, 하늘, 나비🦋, 개나리, 소나기 | 개나리가 노랗게 피었어요. [개나리 / 미나리, 오리] · 바다에 가요. [바다 / 바지, 다리] · 소나기가 내려요. [소나기 / 소나무, 고기] · 하늘이 파래요. [하늘 / 허리, 나무] |
| `seed-seasons-intermediate` | 봄 여름 가을 겨울 (중급) | 봄🌸, 여름, 가을🍂, 겨울❄️, 장마☔, 단풍🍁, 눈사람⛄, 진달래 | 봄에는 진달래가 피어요. [진달래 / 장마, 생선] · 여름에는 장마가 와요. [장마 / 장미, 감자] · 가을 산에 단풍이 들었어요. [단풍 / 단추, 반찬] · 겨울에 눈사람을 만들어요. [눈사람 / 눈썹, 손수건] |
| `seed-seasons-advanced` | 절기와 생활 (고급) | 꽃샘추위, 무더위🥵, 김장, 입춘, 단풍놀이, 첫눈🌨️, 일교차, 동지팥죽 | 봄인데 꽃샘추위가 매서워요. [꽃샘추위 / 무더위, 첫눈] · 온 동네가 모여 김장을 했어요. [김장 / 환승, 통장] · 동짓날에는 동지팥죽을 먹어요. [동지팥죽 / 미역국, 떡국] · 아침저녁 일교차가 커요. [일교차 / 일요일, 교차로] |

### 6.5 교통 (`topic-transport`)

| 세트 id | 제목 | 낱말(그림) | 문장 |
|---|---|---|---|
| `seed-transport-beginner` | 타고 다녀요 (초급) | 기차🚆, 버스🚌, 배🚢, 비행기✈️, 오토바이🏍️, 자리💺, 기사, 차표🎫 | 기차를 타고 고향에 가요. [기차 / 기자, 가지] · 버스 기사님께 인사해요. [기사 / 가사, 기러기] · 차표를 사요. [차표 / 주소, 치마] · 빈 자리에 앉아요. [자리 / 자두, 우비] |
| `seed-transport-intermediate` | 길 찾기 (중급) | 정류장🚏, 지하철🚇, 택시🚕, 신호등🚦, 횡단보도, 교통카드💳, 출구, 환승 | 버스 정류장에서 기다려요. [정류장 / 정육점, 운동장] · 초록불일 때 횡단보도를 건너요. [횡단보도 / 지하철, 거스름돈] · 지하철 3번 출구로 나와요. [출구 / 축구, 친구] · 택시를 불렀어요. [택시 / 탁자, 떡국] |
| `seed-transport-advanced` | 안전한 외출 (고급) | 충전🔋, 노약자석, 터미널, 승차권🎟️, 하차 벨🔔, 왕복, 도착 시간⏰, 안전띠 | 교통카드를 충전했어요. [충전 / 진찰, 출구] · 노약자석을 양보해요. [노약자석 / 노래자랑, 일교차] · 내릴 때 하차 벨을 눌러요. [하차 벨 / 승차권, 왕복] · 차에 타면 안전띠를 매요. [안전띠 / 터미널, 영수증] |

검수 메모
- 시드 문장의 V-07(받침 일치) 경고는 일부 남아 있을 수 있다. 시드 확정 전 `validate.js`로 전수 검사해 수정한다.
- 정답이 문장에 1회만 등장하는지(V-05) 전수 검사한다. 예: "동짓날"과 "동지팥죽"은 서로 다른 문자열이므로 통과.
- 숫자가 포함된 문장("3번 출구", "삼십 분")은 문해 수준에 따라 읽기 방식이 달라질 수 있어 강사 검수 필요.
