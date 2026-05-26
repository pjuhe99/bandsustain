# 밴드 이름 생성기 데이터 관리자 — 설계 (Design Spec)

- 작성일: 2026-05-26
- 대상 기능: `/admin/band-name` — 밴드 이름 생성기의 단어/패턴/단어쌍/차단 밴드명을 운영자가 추가·삭제·수정
- 현재 상태: 생성기 데이터(`src/lib/bandName/data.ts`)는 하드코딩 TS이며, 생성기(`generateBandNames`)는 **브라우저(클라이언트)** 에서 실행된다.

## 1. 목적 / 배경

밴드 이름 생성기는 6→7개 씬으로 자라며 단어·패턴 데이터가 계속 커지고 있다. 지금은 데이터를 바꾸려면 코드 수정 → dev → 운영 배포가 필요하다. 운영자가 **코드 배포 없이** 장르별/언어별 단어와 조합을 추가·삭제할 수 있게 해, 콘텐츠 반복 주기를 짧게 만든다.

## 2. 범위

### 관리 대상 (운영자가 CRUD)
1. **단어(words)** — 언어(korean/english) × 카테고리별 단어 목록
2. **패턴(patterns)** — 카테고리 결합 규칙(slots) + scenes/moods/weirdness 범위/weight
3. **선호/차단 단어쌍(pairs)** — 특정 두 단어 조합에 가점/감점
4. **차단 밴드명(blocked names)** — 실제 유명 밴드명 정확 일치 제외 목록

### 범위 밖 (코드로만 변경 — 고정 분류 체계)
- **씬(Scene)**, **분위기(Mood)**, **단어 카테고리(WordCategory)**, **언어(LanguageStyle)** 의 *목록 자체* — 타입으로 정의되고 라벨/UI/가중치가 코드에서 이를 참조하므로, 새 씬·새 카테고리 추가는 코드 작업(메탈 추가와 동일).
- **씬/분위기 카테고리 가중치**(`sceneCategoryBoosts`, `moodCategoryBoosts`) 와 **점수화 로직** — 알고리즘 튜닝이라 코드에 유지.
- 즉, 운영자는 *고정된 분류 체계 안에서* 데이터(단어/패턴/쌍/차단명)만 관리한다.

## 3. 데이터 원천 & 읽기 경로 (결정: 전체 DB 이전 + A1)

- **단일 원천 = DB.** 기존 하드코딩 데이터는 1회 시드로 DB에 적재되고, 이후 런타임의 진실은 DB.
- `data.ts`는 **`defaultDataset`** 으로 유지하며 세 역할을 한다: ① DB 시드 원본, ② DB 비었음/장애 시 폴백, ③ 단위 테스트 픽스처.
- **읽기 경로 A1**: 생성기 페이지(서버 컴포넌트)가 DB에서 전체 데이터셋을 읽어 클라이언트 컴포넌트에 prop으로 전달한다. 생성/다시 만들기는 지금처럼 브라우저에서 즉시 수행(네트워크 없음). 데이터셋(수십 KB, 비민감)은 페이지 로드 시 1회 전송.
  - *대안 A2(서버 생성 API)는 채택하지 않음 — 현재 즉시 재생성 UX 유지 우선.*

## 4. 아키텍처

### 4.1 데이터셋 주입 리팩터링 (`generate.ts`)
`generate.ts`가 `data.ts`를 직접 import하지 않고 **데이터셋을 인자로 받는다.**

```ts
export type BandNameDataset = {
  koreanWords: Record<WordCategory, string[]>;
  englishWords: Partial<Record<WordCategory, string[]>>;
  koreanPatterns: Pattern[];
  englishPatterns: Pattern[];
  preferredPairs: [string, string][];
  blockedPairs: [string, string][];
  blockedExactNames: Set<string>;
};

export function generateBandNames(
  input: BandNameInput,
  dataset: BandNameDataset,
  rng?: Rng,
): GeneratedBandName[];
```

- 내부 함수(`patternPool`, `effectivePatternWeight`, `scoreGeneratedName`, `generateCandidate` 등)가 module-level import 대신 `dataset`을 받는다.
- `sceneCategoryBoosts`/`moodCategoryBoosts`/`sceneLabels`/`moodLabels` 등 **코드 상수**는 그대로 import (관리자 범위 밖).
- `data.ts`는 `defaultDataset: BandNameDataset` 를 export (기존 named export 유지하여 시드/테스트에서 사용).

### 4.2 데이터셋 로더 (`src/lib/bandName/dataset.ts`, server-only)
```ts
export async function loadBandNameDataset(): Promise<BandNameDataset>;
```
- 4개 테이블을 조회해 `BandNameDataset` 형태로 조립.
- 순수 매핑 함수 `rowsToDataset(rows)` 를 분리해 단위 테스트 가능하게 한다.
- DB 비었음/오류 시 `defaultDataset` 반환(도구 무중단).
- `revalidatePath` 와 함께 동작하므로 페이지 캐시로 충분 (요청마다 4쿼리지만 admin 편집 시에만 무효화). 필요 시 `unstable_cache`/`React.cache`로 요청 단위 메모이즈.

### 4.3 생성기 페이지 / 클라이언트
- `src/app/playground/band-name-generator/page.tsx`(서버): `const dataset = await loadBandNameDataset()` → `<BandNameGenerator dataset={dataset} />`.
- `BandNameGenerator.tsx`(클라이언트): `dataset` prop 받아 `generateBandNames(input, dataset)` 호출. 그 외 UI/로딩/공유 로직 변화 없음.
- 공유 랜딩/OG/카카오 이미지 라우트는 단어 DB를 쓰지 않으므로 변경 없음.

## 5. DB 스키마 (`db/schema/017_bandname.sql`)

```sql
CREATE TABLE IF NOT EXISTS bandname_words (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  language  ENUM('korean','english') NOT NULL,
  category  VARCHAR(32) NOT NULL,         -- WordCategory 값
  word      VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_word (language, category, word)
);

CREATE TABLE IF NOT EXISTS bandname_patterns (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pattern_key   VARCHAR(64) NOT NULL,     -- 기존 id (예: ko_time_place). UNIQUE
  language      ENUM('korean','english') NOT NULL,
  slots         JSON NOT NULL,            -- ["time","place"]
  scenes        JSON NOT NULL,            -- ["jrock","emo"]
  moods         JSON NOT NULL,            -- ["fresh","wistful"]
  separator     VARCHAR(4) NOT NULL DEFAULT '',
  min_weirdness TINYINT NOT NULL,
  max_weirdness TINYINT NOT NULL,
  weight        INT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pattern_key (pattern_key)
);

CREATE TABLE IF NOT EXISTS bandname_pairs (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind    ENUM('preferred','blocked') NOT NULL,
  word_a  VARCHAR(64) NOT NULL,
  word_b  VARCHAR(64) NOT NULL,
  UNIQUE KEY uk_pair (kind, word_a, word_b)
);

CREATE TABLE IF NOT EXISTS bandname_blocked_names (
  id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(128) NOT NULL,
  UNIQUE KEY uk_name (name)
);
```
- JSON 컬럼은 MariaDB에서 LONGTEXT alias로 동작. 앱에서 파싱/검증.
- 적용: 기존 선례대로 **수동 mysql 실행**(주석에 명령 명시). DEV DB 먼저.

### 시드 (`scripts/seed-bandname.ts`, tsx)
- `defaultDataset`(=data.ts)을 읽어 4테이블에 멱등 삽입(`INSERT ... ON DUPLICATE KEY UPDATE` 또는 빈 테이블일 때만 삽입).
- 실행 후 행 개수 == defaultDataset 항목 수 검증 로그.
- `package.json` 에 `bandname:seed` 스크립트 추가. DEV DB 먼저.
- `mixed` 패턴은 기존 구조대로 korean 2슬롯에서 파생하므로 별도 저장하지 않는다(언어 컬럼은 korean/english만).

## 6. 관리자 UI (`/admin/band-name`)

기존 admin 패턴(서버 액션 + zod + `requireAuth()` + `revalidatePath`) 재사용. `AdminNav` 에 "Band Name" 항목 추가.

상단 4개 섹션(서브경로 또는 탭):
- **Words** — 언어·카테고리 필터 → 목록 + 추가(단건 및 쉼표 일괄 추가) + 삭제.
- **Patterns** — 씬별 그룹 목록, 추가/수정(pattern_key, language, slots·scenes·moods 다중선택, separator, weirdness min/max[1–5], weight), 삭제.
- **Pairs** — kind(preferred/blocked) + word_a + word_b 추가/삭제, kind 필터.
- **Blocked Names** — name 추가/삭제.

모든 변경 액션은 성공 시 `revalidatePath("/playground/band-name-generator")` 호출.

## 7. 검증 & 안전장치 (zod)

- **Words**: language ∈ {korean,english}, category ∈ 코드 WordCategory 목록, word 1–64자. 일괄 추가는 쉼표 분리 후 trim/중복 제거.
- **Patterns**: slots 비어있지 않고 모두 알려진 카테고리, scenes/moods 모두 유효, 1 ≤ min_weirdness ≤ max_weirdness ≤ 5, weight > 0, pattern_key 유일·`^[a-z0-9_]+$`.
- **Pairs**: word_a/word_b 비어있지 않음.
- **Blocked names**: 1–128자.
- **삭제 가드**: 어떤 단어를 지워서 그 (language,category)가 **0개**가 되고 그 카테고리를 쓰는 패턴이 있으면 → 차단(생성 후보 0 방지). 소수(<3)면 경고 표시 후 허용.
- **폴백**: 로더가 DB 비었음/오류 감지 시 `defaultDataset` 반환.

## 8. 테스트

- `generate.test.ts`: 기존 테스트를 `defaultDataset` 주입 형태로 수정(알고리즘 동작 불변, 22 케이스 유지).
- 신규 `dataset.test.ts`: `rowsToDataset` 순수 매핑(픽스처 행→데이터셋), 빈 입력 시 폴백 동작.
- 시드 멱등성: 두 번 실행해도 개수 불변(스크립트 자체 검증 로그 + 수동 확인).
- HTTP smoke: `/playground/band-name-generator` 200, `/admin/band-name` 인증 리다이렉트.

## 9. 배포 / 운영

- 항상 dev 먼저 → 사용자 확인 → 운영(메모리 규칙). 
- **DB 마이그(017) + 시드는 DEV DB 먼저 적용**, dev 검증 후 운영 반영 시 PROD DB에 동일 적용.
- 운영 빌드 전 `.next` root 소유 파일 점검(기존 함정).

## 10. 비범위 / 향후

- 새 씬/카테고리/분위기 추가, 가중치(boosts) 편집, 점수화 파라미터 튜닝은 본 작업 범위 밖(코드).
- "기본값으로 재시드" 관리 버튼은 선택적 후속(시드 스크립트로 대체 가능).
- 단어 사용 통계/미리보기(이 단어가 들어간 생성 예시)는 후속 개선 여지.
