# 밴드 이름 생성기 데이터 관리자 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 코드 배포 없이 `/admin/band-name`에서 밴드 이름 생성기의 단어/패턴/단어쌍/차단밴드명을 추가·삭제·수정할 수 있게 한다.

**Architecture:** 하드코딩 데이터(`data.ts`)를 DB로 1회 이전(단일 원천). `data.ts`는 `defaultDataset`(시드 원본 + 폴백 + 테스트 픽스처)로 유지. `generate.ts`를 데이터셋 주입형으로 리팩터(`generateBandNames(input, dataset, rng?)`). 생성기 페이지(서버 컴포넌트)가 DB에서 데이터셋을 로드해 클라이언트 생성기에 prop으로 전달(읽기 경로 A1). 관리자는 기존 admin 패턴(서버 액션 + zod + 쿠키 인증)을 재사용.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, MariaDB(mysql2), Tailwind v4, zod, node:test + tsx.

**작업 환경 규칙:** 모든 작업은 `bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서. git/build/pm2/mysql는 `sudo -u ec2-user`로 실행(파일 소유권). DB 마이그·시드는 **DEV DB 먼저**. 운영 반영은 사용자 명시 시에만 dev→main 머지 후 진행.

**앱 루트:** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain` (이하 경로는 이 기준 상대경로).

**참고 패턴 파일(기존 admin CRUD 컨벤션):** `src/app/admin/(authed)/songs/{page.tsx,actions.ts,new/page.tsx,[id]/page.tsx}`, `src/components/admin/SongForm.tsx`, `src/lib/songs.ts`. 새 admin 섹션은 이들의 구조(server action + zod + `requireAuth()` + `revalidatePath`, `useActionState` 폼)를 그대로 따른다.

---

## File Structure

**신규**
- `db/schema/017_bandname.sql` — 4테이블 DDL
- `scripts/seed-bandname.ts` — `defaultDataset` → DB 멱등 시드
- `src/lib/bandName/dataset.ts` — server-only 로더 `loadBandNameDataset()` + 순수 매퍼 `rowsToDataset()`
- `src/lib/bandName/dataset.test.ts` — `rowsToDataset` + 생성 통합 테스트
- `src/app/admin/(authed)/band-name/page.tsx` — `/admin/band-name/words`로 redirect
- `src/app/admin/(authed)/band-name/words/{page.tsx,actions.ts,WordsPanel.tsx}`
- `src/app/admin/(authed)/band-name/patterns/{page.tsx,actions.ts,PatternForm.tsx}`
- `src/app/admin/(authed)/band-name/pairs/{page.tsx,actions.ts,PairsPanel.tsx}`
- `src/app/admin/(authed)/band-name/blocked-names/{page.tsx,actions.ts,BlockedNamesPanel.tsx}`

**수정**
- `src/lib/bandName/types.ts` — `BandNameDataset` 타입 + `ALL_WORD_CATEGORIES` 런타임 목록
- `src/lib/bandName/data.ts` — `defaultDataset` export
- `src/lib/bandName/generate.ts` — 데이터셋 주입 리팩터
- `src/lib/bandName/generate.test.ts` — `defaultDataset`/`buildPairSets` 주입으로 갱신
- `src/app/playground/band-name-generator/page.tsx` — 데이터셋 로드 후 prop 전달
- `src/app/playground/band-name-generator/BandNameGenerator.tsx` — `dataset` prop 수용
- `src/components/admin/AdminNav.tsx` — "Band Name" 항목 추가
- `package.json` — `bandname:seed` 스크립트

---

## Task 1: `BandNameDataset` 타입 + 카테고리 런타임 목록

**Files:**
- Modify: `src/lib/bandName/types.ts`

- [ ] **Step 1: 타입과 런타임 카테고리 목록 추가**

`types.ts` 맨 끝에 추가:

```ts
// 단어 맵은 DB에서 일부 카테고리만 채워질 수 있으므로 Partial 로 둔다.
export type WordMap = Partial<Record<WordCategory, string[]>>;

// 생성기에 주입되는 데이터셋. 운영자 관리 대상(단어/패턴/쌍/차단명)만 담는다.
// (sceneCategoryBoosts/moodCategoryBoosts/labels 는 알고리즘 상수라 코드에 유지.)
export type BandNameDataset = {
  koreanWords: WordMap;
  englishWords: WordMap;
  koreanPatterns: Pattern[];
  englishPatterns: Pattern[];
  preferredPairs: [string, string][];
  blockedPairs: [string, string][];
  blockedExactNames: Set<string>;
};

// 런타임에서 카테고리를 열거해야 할 때(admin 드롭다운, 시드, 검증) 쓰는 단일 출처.
export const ALL_WORD_CATEGORIES: WordCategory[] = [
  "time", "season", "weather", "color", "light", "place", "city", "room",
  "analog", "sound", "nature", "emotion", "youth", "machine", "movement",
  "odd", "food", "suffix", "metalMaterial", "doom", "ritual", "beast",
];
```

- [ ] **Step 2: 타입체크**

Run: `sudo -u ec2-user env PATH="$PATH" npx tsc --noEmit 2>&1 | grep -E "bandName/types" || echo OK`
Expected: `OK` (기존 sitemap.test.ts 외 신규 오류 없음)

- [ ] **Step 3: 커밋**

```bash
sudo -u ec2-user git add src/lib/bandName/types.ts
sudo -u ec2-user git commit -m "feat(bandName): BandNameDataset 타입 + ALL_WORD_CATEGORIES"
```

---

## Task 2: `defaultDataset` export (data.ts)

**Files:**
- Modify: `src/lib/bandName/data.ts`

- [ ] **Step 1: import 추가 + defaultDataset export**

`data.ts` 상단 import 에 `BandNameDataset` 추가:

```ts
import type {
  BandNameDataset, Mood, Pattern, Scene, WordCategory,
} from "./types";
```

`data.ts` 맨 끝(파일 마지막)에 추가:

```ts
// 기본 데이터셋 — DB 시드 원본 + DB 장애 시 폴백 + 테스트 픽스처.
export const defaultDataset: BandNameDataset = {
  koreanWords,
  englishWords,
  koreanPatterns,
  englishPatterns,
  preferredPairs,
  blockedPairs,
  blockedExactNames,
};
```

- [ ] **Step 2: 타입체크**

Run: `sudo -u ec2-user env PATH="$PATH" npx tsc --noEmit 2>&1 | grep -E "bandName/data" || echo OK`
Expected: `OK`

- [ ] **Step 3: 커밋**

```bash
sudo -u ec2-user git add src/lib/bandName/data.ts
sudo -u ec2-user git commit -m "feat(bandName): defaultDataset export"
```

---

## Task 3: `generate.ts` 데이터셋 주입 리팩터

데이터셋에 의존하는 부분(단어/패턴/쌍/차단명)을 인자로 받게 바꾼다. **코드 상수**(`sceneCategoryBoosts`, `moodCategoryBoosts`, `sceneLabels`, `moodLabels`)와 순수 함수(`isFunnyPattern`, `effectivePatternWeight`, `selectDiverseResults`, `slotLanguages`, `separatorFor`, `pickWeighted`, `pickOne`, `applyMetalSceneScoreAdjustments`, `FUNNY_METAL_PATTERNS`)는 그대로 둔다.

**Files:**
- Modify: `src/lib/bandName/generate.ts`

- [ ] **Step 1: import 교체**

기존 import 블록을 아래로 교체 (데이터 항목 제거, 상수만 유지, 타입 추가):

```ts
import {
  moodCategoryBoosts,
  moodLabels,
  sceneCategoryBoosts,
  sceneLabels,
} from "./data";
import type {
  BandNameDataset,
  BandNameInput,
  GeneratedBandName,
  LanguageStyle,
  Pattern,
  SlotLanguage,
  WordCategory,
} from "./types";
```

- [ ] **Step 2: 페어 셋 빌더 + 페어/차단명 헬퍼 교체**

기존 `preferredSet`/`blockedSet`/`isPreferredPair`/`isBlockedPair`/`isBlockedExactName` 부분을 아래로 교체:

```ts
export type PairSets = { preferred: Set<string>; blocked: Set<string> };

// 데이터셋의 페어 배열을 빠른 조회용 Set 으로. (생성 1회당 1번 빌드)
export function buildPairSets(dataset: BandNameDataset): PairSets {
  return {
    preferred: new Set(dataset.preferredPairs.map(([a, b]) => `${a} ${b}`)),
    // 차단 조합은 의미 중복이라 순서 무관.
    blocked: new Set(dataset.blockedPairs.flatMap(([a, b]) => [`${a} ${b}`, `${b} ${a}`])),
  };
}

export function isPreferredPair(sets: PairSets, a: string, b: string): boolean {
  return sets.preferred.has(`${a} ${b}`);
}

export function isBlockedPair(sets: PairSets, a: string, b: string): boolean {
  return sets.blocked.has(`${a} ${b}`);
}

export function isBlockedExactName(blocked: Set<string>, name: string): boolean {
  return blocked.has(name) || blocked.has(name.toUpperCase());
}
```

(`isFunnyPattern` 은 그대로 둔다.)

- [ ] **Step 3: patternPool / wordPool 를 dataset 인자형으로 교체**

```ts
function patternPool(dataset: BandNameDataset, language: LanguageStyle): Pattern[] {
  if (language === "english") return dataset.englishPatterns;
  if (language === "korean") return dataset.koreanPatterns;
  // mixed: 한국어 2슬롯 패턴을 차용하되 첫 슬롯을 영어 단어로 채운다.
  return dataset.koreanPatterns.filter(
    (p) => p.slots.length === 2 && (dataset.englishWords[p.slots[0]]?.length ?? 0) > 0,
  );
}
```

```ts
function wordPool(dataset: BandNameDataset, category: WordCategory, lang: SlotLanguage): string[] {
  return (lang === "english" ? dataset.englishWords[category] : dataset.koreanWords[category]) ?? [];
}
```

(`slotLanguages`, `separatorFor`, `pickWeighted`, `pickOne`, `effectivePatternWeight` 는 그대로.)

- [ ] **Step 4: scoreGeneratedName 에 `sets` 인자 추가**

시그니처와 페어 검사 두 줄만 변경:

```ts
export function scoreGeneratedName(
  name: string,
  words: string[],
  input: BandNameInput,
  pattern: Pattern,
  sets: PairSets,
): number {
```
내부 페어 루프를 교체:
```ts
  // 선호 조합 보너스 (슬롯 순서 그대로)
  for (let i = 0; i < words.length - 1; i++) {
    if (isPreferredPair(sets, words[i], words[i + 1])) score += 35;
  }
  // 차단 조합 감점
  for (let i = 0; i < words.length - 1; i++) {
    if (isBlockedPair(sets, words[i], words[i + 1])) score -= 100;
  }
```
(나머지 길이/반복/metal 보정 로직은 그대로.)

- [ ] **Step 5: generateCandidate 에 dataset/sets 전달**

```ts
function generateCandidate(
  dataset: BandNameDataset,
  input: BandNameInput,
  pool: Pattern[],
  sets: PairSets,
  rng: Rng,
): GeneratedBandName | null {
  if (pool.length === 0) return null;

  const pattern = pickWeighted(pool, pool.map((p) => effectivePatternWeight(p, input)), rng);

  const langs = slotLanguages(input.language, pattern.slots.length);
  const words: string[] = [];
  for (let i = 0; i < pattern.slots.length; i++) {
    const candidates = wordPool(dataset, pattern.slots[i], langs[i]);
    if (candidates.length === 0) return null;
    words.push(pickOne(candidates, rng));
  }

  if (new Set(words).size !== words.length) return null;
  for (let i = 0; i < words.length - 1; i++) {
    if (isBlockedPair(sets, words[i], words[i + 1])) return null;
  }

  const name = words.join(separatorFor(input.language, pattern));
  if (isBlockedExactName(dataset.blockedExactNames, name)) return null;

  return {
    name,
    scene: input.scene,
    mood: input.mood,
    patternId: pattern.id,
    score: scoreGeneratedName(name, words, input, pattern, sets),
    tags: [sceneLabels[input.scene], moodLabels[input.mood]],
    usedWords: words,
  };
}
```

- [ ] **Step 6: generateBandNames 시그니처에 dataset 추가**

```ts
export function generateBandNames(
  input: BandNameInput,
  dataset: BandNameDataset,
  rng: Rng = Math.random,
): GeneratedBandName[] {
  const pool = patternPool(dataset, input.language);
  if (pool.length === 0) return [];

  const sets = buildPairSets(dataset);
  const candidates: GeneratedBandName[] = [];
  const maxAttempts = CANDIDATE_COUNT * 5;
  for (let i = 0; i < maxAttempts && candidates.length < CANDIDATE_COUNT; i++) {
    const candidate = generateCandidate(dataset, input, pool, sets, rng);
    if (candidate) candidates.push(candidate);
  }

  return selectDiverseResults(candidates, RESULT_COUNT);
}
```

- [ ] **Step 7: 타입체크 (테스트는 아직 깨진 상태 — 다음 태스크에서 수정)**

Run: `sudo -u ec2-user env PATH="$PATH" npx tsc --noEmit 2>&1 | grep -E "bandName/generate.ts" || echo "generate.ts OK"`
Expected: `generate.ts OK` (generate.test.ts 는 다음 태스크 전까지 오류 — 정상)

- [ ] **Step 8: 커밋**

```bash
sudo -u ec2-user git add src/lib/bandName/generate.ts
sudo -u ec2-user git commit -m "refactor(bandName): generateBandNames 데이터셋 주입형으로 변경"
```

---

## Task 4: 기존 테스트를 데이터셋 주입형으로 갱신

**Files:**
- Modify: `src/lib/bandName/generate.test.ts`

- [ ] **Step 1: import 에 defaultDataset/buildPairSets 추가**

상단 import 교체:

```ts
import { blockedExactNames, defaultDataset, koreanPatterns, englishPatterns } from "./data";
import {
  buildPairSets,
  generateBandNames,
  isBlockedPair,
  isFunnyPattern,
  isPreferredPair,
  makeSeededRng,
  RESULT_COUNT,
  scoreGeneratedName,
  selectDiverseResults,
} from "./generate";
```

- [ ] **Step 2: generateBandNames 호출에 defaultDataset 주입**

파일 내 모든 `generateBandNames(input, makeSeededRng(seed))` 및 `generateBandNames(c.input)` 호출을 `generateBandNames(input, defaultDataset, makeSeededRng(seed))` 형태로 변경(두 번째 인자로 `defaultDataset` 삽입). sed 일괄 변경:

```bash
sudo -u ec2-user sed -i 's/generateBandNames(\([^,]*\), makeSeededRng/generateBandNames(\1, defaultDataset, makeSeededRng/g' src/lib/bandName/generate.test.ts
```
변경 후 남은 인자 1개짜리 호출이 없는지 확인:
Run: `grep -n "generateBandNames(" src/lib/bandName/generate.test.ts`
Expected: 모든 호출이 `, defaultDataset, makeSeededRng(...)` 형태.

- [ ] **Step 3: 페어/스코어 테스트를 sets 주입으로 수정**

`"pair + funny-pattern helpers behave"` 테스트 본문 교체:

```ts
test("pair + funny-pattern helpers behave", () => {
  const sets = buildPairSets(defaultDataset);
  assert.equal(isPreferredPair(sets, "새벽", "옥상"), true);
  assert.equal(isPreferredPair(sets, "옥상", "새벽"), false); // 순서 지킴
  assert.equal(isBlockedPair(sets, "새벽", "아침"), true);
  assert.equal(isBlockedPair(sets, "아침", "새벽"), true); // 순서 무관
  assert.equal(isFunnyPattern(patternById("ko_odd_suffix")), true);
  assert.equal(isFunnyPattern(patternById("ko_machine_emotion")), true);
  assert.equal(isFunnyPattern(patternById("ko_time_place")), false);
});
```

`"scoring rewards preferred pairs and punishes duplicates"` 테스트 본문 교체:

```ts
test("scoring rewards preferred pairs and punishes duplicates", () => {
  const input: BandNameInput = { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 };
  const pattern = patternById("ko_time_place");
  const sets = buildPairSets(defaultDataset);
  const preferred = scoreGeneratedName("새벽옥상", ["새벽", "옥상"], input, pattern, sets);
  const neutral = scoreGeneratedName("저녁복도", ["저녁", "복도"], input, pattern, sets);
  assert.ok(preferred > neutral, "preferred pair should score higher");

  const dup = scoreGeneratedName("옥상옥상", ["옥상", "옥상"], input, pattern, sets);
  assert.ok(dup < neutral, "duplicate words should be punished");
});
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/bandName/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 22` / `# pass 22` / `# fail 0`

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add src/lib/bandName/generate.test.ts
sudo -u ec2-user git commit -m "test(bandName): 데이터셋/sets 주입형으로 테스트 갱신"
```

---

## Task 5: BandNameGenerator 가 defaultDataset 으로 동작하도록 임시 연결 + 빌드 확인

이 시점에서 앱이 다시 동작하게 만든다(아직 DB 미사용 — 클라이언트가 `defaultDataset` import).

**Files:**
- Modify: `src/app/playground/band-name-generator/BandNameGenerator.tsx`

- [ ] **Step 1: defaultDataset import 후 generateBandNames 에 주입**

상단 import 에 추가:
```ts
import { defaultDataset } from "@/lib/bandName/data";
```
`generate` 핸들러 내부 호출 변경:
```ts
    setResults(generateBandNames(input, defaultDataset));
```

- [ ] **Step 2: 빌드 + 테스트 + 린트**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" npx tsc --noEmit 2>&1 | grep -E "bandName|band-name-generator" || echo "TS OK"
sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3
```
Expected: `TS OK`, `✓ Compiled successfully`

- [ ] **Step 3: dev 재시작 + smoke**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" pm2 restart bandsustain-dev --update-env >/dev/null && sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3101/playground/band-name-generator
```
Expected: `200`

- [ ] **Step 4: 커밋**

```bash
sudo -u ec2-user git add src/app/playground/band-name-generator/BandNameGenerator.tsx
sudo -u ec2-user git commit -m "refactor(bandName): 클라이언트가 defaultDataset 주입해 생성"
```

---

## Task 6: DB 스키마 마이그레이션 (017) — DEV DB 적용

**Files:**
- Create: `db/schema/017_bandname.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 017_bandname.sql
-- 밴드 이름 생성기 데이터 관리자(/admin/band-name) 4테이블.
-- 수동 실행 (DEV 먼저):
--   set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
--   mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/017_bandname.sql

CREATE TABLE IF NOT EXISTS bandname_words (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  language   ENUM('korean','english') NOT NULL,
  category   VARCHAR(32) NOT NULL,
  word       VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_word (language, category, word)
);

CREATE TABLE IF NOT EXISTS bandname_patterns (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pattern_key   VARCHAR(64) NOT NULL,
  language      ENUM('korean','english') NOT NULL,
  slots         JSON NOT NULL,
  scenes        JSON NOT NULL,
  moods         JSON NOT NULL,
  separator     VARCHAR(4) NOT NULL DEFAULT '',
  min_weirdness TINYINT NOT NULL,
  max_weirdness TINYINT NOT NULL,
  weight        INT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pattern_key (pattern_key)
);

CREATE TABLE IF NOT EXISTS bandname_pairs (
  id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind   ENUM('preferred','blocked') NOT NULL,
  word_a VARCHAR(64) NOT NULL,
  word_b VARCHAR(64) NOT NULL,
  UNIQUE KEY uk_pair (kind, word_a, word_b)
);

CREATE TABLE IF NOT EXISTS bandname_blocked_names (
  id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  UNIQUE KEY uk_name (name)
);
```

- [ ] **Step 2: DEV DB 에 적용**

Run:
```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/017_bandname.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'bandname_%';"
```
Expected: 4개 테이블 나열(bandname_words, bandname_patterns, bandname_pairs, bandname_blocked_names).

- [ ] **Step 3: 커밋**

```bash
sudo -u ec2-user git add db/schema/017_bandname.sql
sudo -u ec2-user git commit -m "feat(bandName): 017 DB 스키마 (단어/패턴/쌍/차단명)"
```

---

## Task 7: 시드 스크립트 — DEV DB 적재

**Files:**
- Create: `scripts/seed-bandname.ts`
- Modify: `package.json`

- [ ] **Step 1: 시드 스크립트 작성**

```ts
// scripts/seed-bandname.ts
// defaultDataset → bandname_* 테이블 멱등 시드. DEV DB 먼저.
//   set -a; source <site>/.db_credentials; set +a
//   sudo -u ec2-user env PATH="$PATH" pnpm bandname:seed
import mysql from "mysql2/promise";
import { defaultDataset } from "../src/lib/bandName/data";
import type { WordMap } from "../src/lib/bandName/types";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
  });

  const wordRows: [string, string, string][] = [];
  const pushWords = (lang: "korean" | "english", map: WordMap) => {
    for (const [cat, list] of Object.entries(map)) {
      for (const w of list ?? []) wordRows.push([lang, cat, w]);
    }
  };
  pushWords("korean", defaultDataset.koreanWords);
  pushWords("english", defaultDataset.englishWords);
  for (const [lang, cat, w] of wordRows) {
    await conn.query(
      "INSERT IGNORE INTO bandname_words (language, category, word) VALUES (?,?,?)",
      [lang, cat, w],
    );
  }

  const pushPatterns = async (lang: "korean" | "english", patterns: typeof defaultDataset.koreanPatterns) => {
    for (const p of patterns) {
      await conn.query(
        `INSERT INTO bandname_patterns
           (pattern_key, language, slots, scenes, moods, separator, min_weirdness, max_weirdness, weight)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           slots=VALUES(slots), scenes=VALUES(scenes), moods=VALUES(moods),
           separator=VALUES(separator), min_weirdness=VALUES(min_weirdness),
           max_weirdness=VALUES(max_weirdness), weight=VALUES(weight)`,
        [p.id, lang, JSON.stringify(p.slots), JSON.stringify(p.scenes),
         JSON.stringify(p.moods), p.separator, p.minWeirdness, p.maxWeirdness, p.weight],
      );
    }
  };
  await pushPatterns("korean", defaultDataset.koreanPatterns);
  await pushPatterns("english", defaultDataset.englishPatterns);

  for (const [a, b] of defaultDataset.preferredPairs) {
    await conn.query("INSERT IGNORE INTO bandname_pairs (kind, word_a, word_b) VALUES ('preferred',?,?)", [a, b]);
  }
  for (const [a, b] of defaultDataset.blockedPairs) {
    await conn.query("INSERT IGNORE INTO bandname_pairs (kind, word_a, word_b) VALUES ('blocked',?,?)", [a, b]);
  }
  for (const name of defaultDataset.blockedExactNames) {
    await conn.query("INSERT IGNORE INTO bandname_blocked_names (name) VALUES (?)", [name]);
  }

  const [[counts]] = await conn.query<any>(
    `SELECT
       (SELECT COUNT(*) FROM bandname_words) AS words,
       (SELECT COUNT(*) FROM bandname_patterns) AS patterns,
       (SELECT COUNT(*) FROM bandname_pairs) AS pairs,
       (SELECT COUNT(*) FROM bandname_blocked_names) AS names`,
  );
  console.log("seeded:", counts, "| source words:", wordRows.length,
    "patterns:", defaultDataset.koreanPatterns.length + defaultDataset.englishPatterns.length);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: package.json 스크립트 추가**

`scripts` 객체에 추가:
```json
    "bandname:seed": "tsx scripts/seed-bandname.ts",
```

- [ ] **Step 3: DEV DB 에 시드 실행 + 개수 확인**

Run:
```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
sudo -u ec2-user env PATH="$PATH" DB_HOST="$DB_HOST" DB_USER="$DB_USER" DB_PASS="$DB_PASS" DB_NAME="$DB_NAME" pnpm bandname:seed
```
Expected: `seeded: { words: N, patterns: M, pairs: K, names: J }` — words>0, patterns == 코드 패턴 수, names>0.

- [ ] **Step 4: 멱등성 확인 (재실행 후 개수 동일)**

Run: 위 시드 명령 1회 더 실행.
Expected: `words`/`pairs`/`names` 개수 동일(INSERT IGNORE), patterns 동일(ON DUPLICATE KEY).

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add scripts/seed-bandname.ts package.json
sudo -u ec2-user git commit -m "feat(bandName): defaultDataset DB 시드 스크립트 + bandname:seed"
```

---

## Task 8: 데이터셋 로더 + 매퍼 + 테스트

**Files:**
- Create: `src/lib/bandName/dataset.ts`
- Create: `src/lib/bandName/dataset.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (rowsToDataset 순수 매퍼 + 생성 통합)**

`src/lib/bandName/dataset.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { rowsToDataset } from "./dataset";
import { generateBandNames, makeSeededRng } from "./generate";
import type { BandNameInput } from "./types";

test("rowsToDataset groups words by language/category and parses patterns", () => {
  const ds = rowsToDataset(
    [
      { language: "korean", category: "time", word: "새벽" },
      { language: "korean", category: "place", word: "옥상" },
      { language: "english", category: "time", word: "MIDNIGHT" },
    ] as never,
    [
      {
        pattern_key: "ko_time_place", language: "korean",
        slots: ["time", "place"], scenes: ["jrock"], moods: ["fresh"],
        separator: "", min_weirdness: 1, max_weirdness: 3, weight: 14,
      },
    ] as never,
    [
      { kind: "preferred", word_a: "새벽", word_b: "옥상" },
      { kind: "blocked", word_a: "밤", word_b: "한밤" },
    ] as never,
    [{ name: "혁오" }] as never,
  );

  assert.deepEqual(ds.koreanWords.time, ["새벽"]);
  assert.deepEqual(ds.koreanWords.place, ["옥상"]);
  assert.deepEqual(ds.englishWords.time, ["MIDNIGHT"]);
  assert.equal(ds.koreanPatterns.length, 1);
  assert.equal(ds.koreanPatterns[0].id, "ko_time_place");
  assert.deepEqual(ds.koreanPatterns[0].slots, ["time", "place"]);
  assert.deepEqual(ds.preferredPairs, [["새벽", "옥상"]]);
  assert.deepEqual(ds.blockedPairs, [["밤", "한밤"]]);
  assert.ok(ds.blockedExactNames.has("혁오"));
});

test("rowsToDataset parses JSON columns whether string or object", () => {
  const ds = rowsToDataset(
    [{ language: "korean", category: "time", word: "새벽" },
     { language: "korean", category: "place", word: "옥상" }] as never,
    [{
      pattern_key: "ko_time_place", language: "korean",
      slots: '["time","place"]', scenes: '["jrock"]', moods: '["fresh"]',
      separator: "", min_weirdness: 1, max_weirdness: 3, weight: 14,
    }] as never,
    [] as never, [] as never,
  );
  assert.deepEqual(ds.koreanPatterns[0].slots, ["time", "place"]);
  // 생성기가 이 데이터셋으로 동작하는지 (통합)
  const input: BandNameInput = { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 };
  const out = generateBandNames(input, ds, makeSeededRng(1));
  assert.ok(out.length >= 1 && out[0].name.length >= 2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/bandName/dataset.test.ts 2>&1 | tail -5`
Expected: FAIL (`rowsToDataset` 없음 / 모듈 없음)

- [ ] **Step 3: dataset.ts 구현**

```ts
// src/lib/bandName/dataset.ts
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { defaultDataset } from "./data";
import type {
  BandNameDataset, LanguageStyle, Mood, Pattern, Scene, WordCategory, WordMap, Weirdness,
} from "./types";

type WordRow = { language: "korean" | "english"; category: string; word: string };
type PatternRow = {
  pattern_key: string; language: "korean" | "english";
  slots: unknown; scenes: unknown; moods: unknown; separator: string;
  min_weirdness: number; max_weirdness: number; weight: number;
};
type PairRow = { kind: "preferred" | "blocked"; word_a: string; word_b: string };
type NameRow = { name: string };

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? (p as T[]) : []; } catch { return []; }
  }
  return [];
}

export function rowsToDataset(
  words: WordRow[], patterns: PatternRow[], pairs: PairRow[], names: NameRow[],
): BandNameDataset {
  const koreanWords: WordMap = {};
  const englishWords: WordMap = {};
  for (const r of words) {
    const map = r.language === "english" ? englishWords : koreanWords;
    (map[r.category as WordCategory] ??= []).push(r.word);
  }

  const toPatterns = (lang: "korean" | "english"): Pattern[] =>
    patterns.filter((p) => p.language === lang).map((r) => ({
      id: r.pattern_key,
      slots: asArray<WordCategory>(r.slots),
      separator: r.separator,
      scenes: asArray<Scene>(r.scenes),
      moods: asArray<Mood>(r.moods),
      minWeirdness: r.min_weirdness as Weirdness,
      maxWeirdness: r.max_weirdness as Weirdness,
      weight: r.weight,
    }));

  return {
    koreanWords,
    englishWords,
    koreanPatterns: toPatterns("korean"),
    englishPatterns: toPatterns("english"),
    preferredPairs: pairs.filter((p) => p.kind === "preferred").map((p) => [p.word_a, p.word_b]),
    blockedPairs: pairs.filter((p) => p.kind === "blocked").map((p) => [p.word_a, p.word_b]),
    blockedExactNames: new Set(names.map((n) => n.name)),
  };
}

// DB 에서 전체 데이터셋 로드. 비었거나 오류 시 defaultDataset 폴백.
export async function loadBandNameDataset(): Promise<BandNameDataset> {
  try {
    const pool = getPool();
    const [w] = await pool.query<(RowDataPacket & WordRow)[]>(
      "SELECT language, category, word FROM bandname_words");
    if (w.length === 0) return defaultDataset;
    const [p] = await pool.query<(RowDataPacket & PatternRow)[]>(
      "SELECT pattern_key, language, slots, scenes, moods, separator, min_weirdness, max_weirdness, weight FROM bandname_patterns");
    const [pr] = await pool.query<(RowDataPacket & PairRow)[]>(
      "SELECT kind, word_a, word_b FROM bandname_pairs");
    const [n] = await pool.query<(RowDataPacket & NameRow)[]>(
      "SELECT name FROM bandname_blocked_names");
    return rowsToDataset(w, p, pr, n);
  } catch {
    return defaultDataset;
  }
}
```

- [ ] **Step 4: 테스트 통과 + 전체 테스트**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/bandName/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# pass` 증가, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add src/lib/bandName/dataset.ts src/lib/bandName/dataset.test.ts
sudo -u ec2-user git commit -m "feat(bandName): DB 데이터셋 로더 + rowsToDataset 매퍼 + 테스트"
```

---

## Task 9: 생성기 페이지를 DB 데이터셋으로 연결

**Files:**
- Modify: `src/app/playground/band-name-generator/page.tsx`
- Modify: `src/app/playground/band-name-generator/BandNameGenerator.tsx`

- [ ] **Step 1: 페이지에서 데이터셋 로드 후 prop 전달**

`page.tsx` 의 컴포넌트를 async 로 바꾸고 로더 호출:

```tsx
import { loadBandNameDataset } from "@/lib/bandName/dataset";
// ...
export default async function BandNameGeneratorPage() {
  const dataset = await loadBandNameDataset();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 page-fade-in">
      {/* ...기존 nav/header 그대로... */}
      <BandNameGenerator dataset={dataset} />
    </section>
  );
}
```
(기존 `metadata`, breadcrumb, header 마크업은 변경 없음. `BandNameGenerator` 사용처에 `dataset={dataset}` 만 추가.)

- [ ] **Step 2: 클라이언트가 prop dataset 사용**

`BandNameGenerator.tsx`:
- `import { defaultDataset } from "@/lib/bandName/data";` 제거
- `import type { BandNameDataset, ... } from "@/lib/bandName/types";` 에 `BandNameDataset` 추가
- 컴포넌트 시그니처:
```tsx
export default function BandNameGenerator({ dataset }: { dataset: BandNameDataset }) {
```
- generate 핸들러:
```tsx
    setResults(generateBandNames(input, dataset));
```

- [ ] **Step 3: 빌드 + dev 재시작 + 실제 생성 smoke**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" npx tsc --noEmit 2>&1 | grep -E "band-name-generator" || echo "TS OK"
sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3
sudo -u ec2-user env PATH="$PATH" pm2 restart bandsustain-dev --update-env >/dev/null && sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3101/playground/band-name-generator
```
Expected: `TS OK`, `✓ Compiled successfully`, `200`. (브라우저에서 메탈 등 생성이 시드 전과 동일하게 동작해야 함 — DB가 defaultDataset 으로 시드됐으므로 결과 결 동일.)

- [ ] **Step 4: 커밋**

```bash
sudo -u ec2-user git add src/app/playground/band-name-generator/page.tsx src/app/playground/band-name-generator/BandNameGenerator.tsx
sudo -u ec2-user git commit -m "feat(bandName): 생성기 페이지가 DB 데이터셋을 로드해 주입"
```

---

## Task 10: AdminNav 항목 + /admin/band-name 허브 redirect

**Files:**
- Modify: `src/components/admin/AdminNav.tsx`
- Create: `src/app/admin/(authed)/band-name/page.tsx`

- [ ] **Step 1: AdminNav 에 항목 추가**

`items` 배열에서 `{ href: "/admin/pedalboard-pins", ... }` 다음 줄에 추가:
```ts
  { href: "/admin/band-name", label: "Band Name" },
```

- [ ] **Step 2: 허브 페이지(첫 섹션으로 redirect)**

`src/app/admin/(authed)/band-name/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function BandNameAdminPage() {
  redirect("/admin/band-name/words");
}
```

- [ ] **Step 3: 빌드 확인**

Run: `sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed" | head -2`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 커밋**

```bash
sudo -u ec2-user git add src/components/admin/AdminNav.tsx "src/app/admin/(authed)/band-name/page.tsx"
sudo -u ec2-user git commit -m "feat(admin): Band Name 네비 + 허브 redirect"
```

---

## Task 11: Admin — Words 섹션 (목록/추가/삭제 + 삭제 가드)

기존 admin 패턴(server action + zod + requireAuth + revalidatePath)을 따른다. 추가는 쉼표 일괄 입력 지원. 삭제는 카테고리 0개化 가드.

**Files:**
- Create: `src/app/admin/(authed)/band-name/words/actions.ts`
- Create: `src/app/admin/(authed)/band-name/words/page.tsx`
- Create: `src/app/admin/(authed)/band-name/words/WordsPanel.tsx`

- [ ] **Step 1: actions.ts**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}
const GEN_PATH = "/playground/band-name-generator";
const categories = ALL_WORD_CATEGORIES as [string, ...string[]];

const addSchema = z.object({
  language: z.enum(["korean", "english"]),
  category: z.enum(categories),
  words: z.string().min(1),
});

export type FormState = { error?: string; ok?: string };

export async function addWords(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = addSchema.safeParse({
    language: fd.get("language"), category: fd.get("category"), words: fd.get("words"),
  });
  if (!parsed.success) return { error: "입력값을 확인해 주세요." };
  const { language, category } = parsed.data;
  const words = [...new Set(parsed.data.words.split(",").map((w) => w.trim()).filter(Boolean))]
    .filter((w) => w.length <= 64);
  if (words.length === 0) return { error: "추가할 단어가 없습니다." };
  const pool = getPool();
  for (const w of words) {
    await pool.query(
      "INSERT IGNORE INTO bandname_words (language, category, word) VALUES (?,?,?)",
      [language, category, w],
    );
  }
  revalidatePath("/admin/band-name/words");
  revalidatePath(GEN_PATH);
  return { ok: `${words.length}개 추가됨` };
}

export async function deleteWord(id: number): Promise<FormState> {
  await requireAuth();
  const pool = getPool();
  const [[row]] = await pool.query<(RowDataPacket & { language: string; category: string })[]>(
    "SELECT language, category FROM bandname_words WHERE id=?", [id]);
  if (!row) return { error: "이미 삭제됨" };
  // 삭제 가드: 이 카테고리의 마지막 단어이고, 그 카테고리를 쓰는 패턴이 있으면 차단.
  const [[cnt]] = await pool.query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) c FROM bandname_words WHERE language=? AND category=?", [row.language, row.category]);
  if (cnt.c <= 1) {
    const [pats] = await pool.query<(RowDataPacket & { slots: unknown })[]>(
      "SELECT slots FROM bandname_patterns WHERE language=?", [row.language]);
    const used = pats.some((p) => {
      const slots = Array.isArray(p.slots) ? p.slots : JSON.parse(String(p.slots));
      return (slots as string[]).includes(row.category);
    });
    if (used) return { error: `'${row.category}' 카테고리의 마지막 단어라 삭제할 수 없습니다(패턴이 사용 중).` };
  }
  await pool.query("DELETE FROM bandname_words WHERE id=?", [id]);
  revalidatePath("/admin/band-name/words");
  revalidatePath(GEN_PATH);
  return { ok: "삭제됨" };
}
```

- [ ] **Step 2: page.tsx (서버 — 필터 + 목록)**

```tsx
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";
import WordsPanel from "./WordsPanel";

export const dynamic = "force-dynamic";

type WordRow = { id: number; language: string; category: string; word: string };

export default async function WordsAdminPage({
  searchParams,
}: { searchParams: Promise<{ language?: string; category?: string }> }) {
  const sp = await searchParams;
  const language = sp.language === "english" ? "english" : "korean";
  const category = ALL_WORD_CATEGORIES.includes(sp.category as never) ? sp.category! : "time";
  const [rows] = await getPool().query<(RowDataPacket & WordRow)[]>(
    "SELECT id, language, category, word FROM bandname_words WHERE language=? AND category=? ORDER BY word",
    [language, category],
  );
  return (
    <WordsPanel
      language={language}
      category={category}
      categories={ALL_WORD_CATEGORIES}
      words={rows.map((r) => ({ id: r.id, word: r.word }))}
    />
  );
}
```

- [ ] **Step 3: WordsPanel.tsx (클라이언트 — 필터/추가/삭제 UI)**

```tsx
"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addWords, deleteWord, type FormState } from "./actions";

export default function WordsPanel({
  language, category, categories, words,
}: {
  language: string; category: string; categories: string[];
  words: { id: number; word: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<FormState, FormData>(addWords, {});
  const setFilter = (l: string, c: string) =>
    router.push(`/admin/band-name/words?language=${l}&category=${c}`);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-black text-2xl mb-6">단어 관리</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {["korean", "english"].map((l) => (
          <button key={l} onClick={() => setFilter(l, category)}
            className={`px-3 py-1.5 text-sm border ${l === language ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border)]"}`}>
            {l === "korean" ? "한국어" : "영어"}
          </button>
        ))}
      </div>
      <select value={category} onChange={(e) => setFilter(language, e.target.value)}
        className="border border-[var(--color-border-strong)] px-3 py-2 mb-6">
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <form action={formAction} className="border border-[var(--color-border)] p-4 mb-6">
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="category" value={category} />
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          단어 추가 (쉼표로 여러 개)
        </label>
        <textarea name="words" rows={2} className="w-full border border-[var(--color-border-strong)] px-3 py-2 mb-2"
          placeholder="예: 철, 강철, 쇳물" />
        <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">
          추가
        </button>
        {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700 mt-2">{state.ok}</p>}
      </form>

      <ul className="flex flex-wrap gap-2">
        {words.map((w) => (
          <li key={w.id} className="inline-flex items-center gap-2 border border-[var(--color-border)] pl-3 pr-1 py-1">
            <span className="text-sm">{w.word}</span>
            <button aria-label={`${w.word} 삭제`}
              onClick={async () => { if (confirm(`'${w.word}' 삭제?`)) { const r = await deleteWord(w.id); if (r.error) alert(r.error); else router.refresh(); } }}
              className="w-5 h-5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">×</button>
          </li>
        ))}
        {words.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">단어 없음</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 + 인증 동작 smoke**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3
sudo -u ec2-user env PATH="$PATH" pm2 restart bandsustain-dev --update-env >/dev/null && sleep 2
curl -s -o /dev/null -w "words(미인증 리다이렉트 예상 200/307): %{http_code}\n" http://127.0.0.1:3101/admin/band-name/words
```
Expected: `✓ Compiled successfully`. (미인증 접근은 admin layout 의 인증 처리에 따름 — 기존 admin 과 동일 동작.)

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add "src/app/admin/(authed)/band-name/words"
sudo -u ec2-user git commit -m "feat(admin): 단어 관리(추가/삭제/일괄/삭제가드)"
```

---

## Task 12: Admin — Patterns 섹션 (목록/추가/수정/삭제)

**Files:**
- Create: `src/app/admin/(authed)/band-name/patterns/actions.ts`
- Create: `src/app/admin/(authed)/band-name/patterns/page.tsx`
- Create: `src/app/admin/(authed)/band-name/patterns/PatternForm.tsx`

- [ ] **Step 1: actions.ts**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";

async function requireAuth() { if (!(await readSession())) throw new Error("UNAUTHENTICATED"); }
const GEN_PATH = "/playground/band-name-generator";
const SCENES = ["jrock", "hongdae", "punk", "citypop", "emo", "campus", "metal"] as const;
const MOODS = ["fresh", "dreamy", "wistful", "funny", "rough", "romantic"] as const;

const schema = z.object({
  patternKey: z.string().regex(/^[a-z0-9_]+$/, "소문자/숫자/밑줄만"),
  language: z.enum(["korean", "english"]),
  slots: z.array(z.enum(ALL_WORD_CATEGORIES as [string, ...string[]])).min(1),
  scenes: z.array(z.enum(SCENES)).min(1),
  moods: z.array(z.enum(MOODS)).min(1),
  separator: z.string().max(4),
  minWeirdness: z.coerce.number().int().min(1).max(5),
  maxWeirdness: z.coerce.number().int().min(1).max(5),
  weight: z.coerce.number().int().positive(),
}).refine((d) => d.minWeirdness <= d.maxWeirdness, { message: "min ≤ max", path: ["minWeirdness"] });

export type FormState = { error?: string };

function parse(fd: FormData) {
  return {
    patternKey: fd.get("patternKey"),
    language: fd.get("language"),
    slots: fd.getAll("slots"),
    scenes: fd.getAll("scenes"),
    moods: fd.getAll("moods"),
    separator: fd.get("separator") ?? "",
    minWeirdness: fd.get("minWeirdness"),
    maxWeirdness: fd.get("maxWeirdness"),
    weight: fd.get("weight"),
  };
}

export async function savePattern(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = schema.safeParse(parse(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "검증 실패" };
  const d = r.data;
  await getPool().query(
    `INSERT INTO bandname_patterns
       (pattern_key, language, slots, scenes, moods, separator, min_weirdness, max_weirdness, weight)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       language=VALUES(language), slots=VALUES(slots), scenes=VALUES(scenes), moods=VALUES(moods),
       separator=VALUES(separator), min_weirdness=VALUES(min_weirdness),
       max_weirdness=VALUES(max_weirdness), weight=VALUES(weight)`,
    [d.patternKey, d.language, JSON.stringify(d.slots), JSON.stringify(d.scenes),
     JSON.stringify(d.moods), d.separator, d.minWeirdness, d.maxWeirdness, d.weight],
  );
  revalidatePath("/admin/band-name/patterns");
  revalidatePath(GEN_PATH);
  return {};
}

export async function deletePattern(id: number): Promise<void> {
  await requireAuth();
  await getPool().query("DELETE FROM bandname_patterns WHERE id=?", [id]);
  revalidatePath("/admin/band-name/patterns");
  revalidatePath(GEN_PATH);
}
```

- [ ] **Step 2: page.tsx (서버 — 씬별 그룹 목록 + 폼)**

```tsx
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";
import PatternForm from "./PatternForm";
import { deletePattern } from "./actions";

export const dynamic = "force-dynamic";
type Row = { id: number; pattern_key: string; language: string; slots: unknown; scenes: unknown; moods: unknown; weight: number };

export default async function PatternsAdminPage() {
  const [rows] = await getPool().query<(RowDataPacket & Row)[]>(
    "SELECT id, pattern_key, language, slots, scenes, moods, weight FROM bandname_patterns ORDER BY pattern_key");
  const arr = (v: unknown) => (Array.isArray(v) ? v : JSON.parse(String(v))) as string[];
  return (
    <div className="max-w-3xl">
      <h1 className="font-display font-black text-2xl mb-6">패턴 관리</h1>
      <PatternForm categories={ALL_WORD_CATEGORIES} />
      <table className="w-full text-sm mt-8 border-collapse">
        <thead><tr className="text-left border-b border-[var(--color-border-strong)]">
          <th className="py-2">key</th><th>lang</th><th>slots</th><th>scenes</th><th>w</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-2 font-mono text-xs">{r.pattern_key}</td>
              <td>{r.language}</td>
              <td>{arr(r.slots).join("+")}</td>
              <td className="text-xs">{arr(r.scenes).join(",")}</td>
              <td>{r.weight}</td>
              <td>
                <form action={async () => { "use server"; await deletePattern(r.id); }}>
                  <button className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">삭제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: PatternForm.tsx (클라이언트 — 다중선택 폼)**

```tsx
"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { savePattern, type FormState } from "./actions";

const SCENES = ["jrock", "hongdae", "punk", "citypop", "emo", "campus", "metal"];
const MOODS = ["fresh", "dreamy", "wistful", "funny", "rough", "romantic"];

export default function PatternForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(
    async (p, fd) => { const r = await savePattern(p, fd); if (!r.error) router.refresh(); return r; }, {});
  const checks = (name: string, opts: string[]) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
      {opts.map((o) => (
        <label key={o} className="text-xs inline-flex items-center gap-1">
          <input type="checkbox" name={name} value={o} /> {o}
        </label>
      ))}
    </div>
  );
  return (
    <form action={action} className="border border-[var(--color-border)] p-4 grid gap-2">
      <input name="patternKey" placeholder="pattern_key (예: ko_doom_ritual)" required
        className="border border-[var(--color-border-strong)] px-3 py-2" />
      <select name="language" className="border border-[var(--color-border-strong)] px-3 py-2">
        <option value="korean">korean</option><option value="english">english</option>
      </select>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">slots</p>{checks("slots", categories)}
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">scenes</p>{checks("scenes", SCENES)}
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">moods</p>{checks("moods", MOODS)}
      <div className="flex gap-2">
        <input name="separator" placeholder="separator(빈칸=한국어, 공백=영어)" className="border border-[var(--color-border-strong)] px-3 py-2 flex-1" />
        <input name="minWeirdness" type="number" min={1} max={5} defaultValue={1} className="border border-[var(--color-border-strong)] px-3 py-2 w-20" />
        <input name="maxWeirdness" type="number" min={1} max={5} defaultValue={5} className="border border-[var(--color-border-strong)] px-3 py-2 w-20" />
        <input name="weight" type="number" min={1} defaultValue={10} className="border border-[var(--color-border-strong)] px-3 py-2 w-24" />
      </div>
      <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] justify-self-start">
        저장(추가/수정)
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: 빌드 확인**

Run: `sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add "src/app/admin/(authed)/band-name/patterns"
sudo -u ec2-user git commit -m "feat(admin): 패턴 관리(추가/수정/삭제, 다중선택)"
```

---

## Task 13: Admin — Pairs 섹션 (선호/차단 단어쌍)

**Files:**
- Create: `src/app/admin/(authed)/band-name/pairs/actions.ts`
- Create: `src/app/admin/(authed)/band-name/pairs/page.tsx`
- Create: `src/app/admin/(authed)/band-name/pairs/PairsPanel.tsx`

- [ ] **Step 1: actions.ts**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

async function requireAuth() { if (!(await readSession())) throw new Error("UNAUTHENTICATED"); }
const GEN_PATH = "/playground/band-name-generator";
const schema = z.object({
  kind: z.enum(["preferred", "blocked"]),
  wordA: z.string().min(1).max(64),
  wordB: z.string().min(1).max(64),
});
export type FormState = { error?: string; ok?: string };

export async function addPair(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = schema.safeParse({ kind: fd.get("kind"), wordA: fd.get("wordA"), wordB: fd.get("wordB") });
  if (!r.success) return { error: "입력값을 확인해 주세요." };
  const { kind, wordA, wordB } = r.data;
  await getPool().query(
    "INSERT IGNORE INTO bandname_pairs (kind, word_a, word_b) VALUES (?,?,?)",
    [kind, wordA.trim(), wordB.trim()],
  );
  revalidatePath("/admin/band-name/pairs");
  revalidatePath(GEN_PATH);
  return { ok: "추가됨" };
}

export async function deletePair(id: number): Promise<void> {
  await requireAuth();
  await getPool().query("DELETE FROM bandname_pairs WHERE id=?", [id]);
  revalidatePath("/admin/band-name/pairs");
  revalidatePath(GEN_PATH);
}
```

- [ ] **Step 2: page.tsx**

```tsx
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import PairsPanel from "./PairsPanel";

export const dynamic = "force-dynamic";
type Row = { id: number; kind: string; word_a: string; word_b: string };

export default async function PairsAdminPage({
  searchParams,
}: { searchParams: Promise<{ kind?: string }> }) {
  const kind = (await searchParams).kind === "blocked" ? "blocked" : "preferred";
  const [rows] = await getPool().query<(RowDataPacket & Row)[]>(
    "SELECT id, kind, word_a, word_b FROM bandname_pairs WHERE kind=? ORDER BY word_a, word_b", [kind]);
  return <PairsPanel kind={kind} pairs={rows.map((r) => ({ id: r.id, a: r.word_a, b: r.word_b }))} />;
}
```

- [ ] **Step 3: PairsPanel.tsx**

```tsx
"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addPair, deletePair, type FormState } from "./actions";

export default function PairsPanel({
  kind, pairs,
}: { kind: string; pairs: { id: number; a: string; b: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(addPair, {});
  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-black text-2xl mb-6">단어쌍 관리</h1>
      <div className="flex gap-2 mb-4">
        {["preferred", "blocked"].map((k) => (
          <button key={k} onClick={() => router.push(`/admin/band-name/pairs?kind=${k}`)}
            className={`px-3 py-1.5 text-sm border ${k === kind ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border)]"}`}>
            {k === "preferred" ? "선호(가점)" : "차단(감점)"}
          </button>
        ))}
      </div>
      <form action={action} className="flex flex-wrap gap-2 border border-[var(--color-border)] p-4 mb-6">
        <input type="hidden" name="kind" value={kind} />
        <input name="wordA" placeholder="단어 A" className="border border-[var(--color-border-strong)] px-3 py-2" />
        <input name="wordB" placeholder="단어 B" className="border border-[var(--color-border-strong)] px-3 py-2" />
        <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">추가</button>
        {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="w-full text-sm text-green-700">{state.ok}</p>}
      </form>
      <ul className="flex flex-col gap-1">
        {pairs.map((p) => (
          <li key={p.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-1.5 text-sm">
            <span>{p.a} + {p.b}</span>
            <button onClick={async () => { await deletePair(p.id); router.refresh(); }}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">삭제</button>
          </li>
        ))}
        {pairs.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">없음</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

Run: `sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3`
Expected: `✓ Compiled successfully`
```bash
sudo -u ec2-user git add "src/app/admin/(authed)/band-name/pairs"
sudo -u ec2-user git commit -m "feat(admin): 단어쌍(선호/차단) 관리"
```

---

## Task 14: Admin — Blocked Names 섹션

**Files:**
- Create: `src/app/admin/(authed)/band-name/blocked-names/actions.ts`
- Create: `src/app/admin/(authed)/band-name/blocked-names/page.tsx`
- Create: `src/app/admin/(authed)/band-name/blocked-names/BlockedNamesPanel.tsx`

- [ ] **Step 1: actions.ts**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

async function requireAuth() { if (!(await readSession())) throw new Error("UNAUTHENTICATED"); }
const GEN_PATH = "/playground/band-name-generator";
const schema = z.object({ name: z.string().min(1).max(128) });
export type FormState = { error?: string; ok?: string };

export async function addBlockedName(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = schema.safeParse({ name: fd.get("name") });
  if (!r.success) return { error: "1–128자" };
  await getPool().query("INSERT IGNORE INTO bandname_blocked_names (name) VALUES (?)", [r.data.name.trim()]);
  revalidatePath("/admin/band-name/blocked-names");
  revalidatePath(GEN_PATH);
  return { ok: "추가됨" };
}

export async function deleteBlockedName(id: number): Promise<void> {
  await requireAuth();
  await getPool().query("DELETE FROM bandname_blocked_names WHERE id=?", [id]);
  revalidatePath("/admin/band-name/blocked-names");
  revalidatePath(GEN_PATH);
}
```

- [ ] **Step 2: page.tsx**

```tsx
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import BlockedNamesPanel from "./BlockedNamesPanel";

export const dynamic = "force-dynamic";
type Row = { id: number; name: string };

export default async function BlockedNamesAdminPage() {
  const [rows] = await getPool().query<(RowDataPacket & Row)[]>(
    "SELECT id, name FROM bandname_blocked_names ORDER BY name");
  return <BlockedNamesPanel names={rows.map((r) => ({ id: r.id, name: r.name }))} />;
}
```

- [ ] **Step 3: BlockedNamesPanel.tsx**

```tsx
"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addBlockedName, deleteBlockedName, type FormState } from "./actions";

export default function BlockedNamesPanel({ names }: { names: { id: number; name: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(addBlockedName, {});
  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-black text-2xl mb-6">차단 밴드명</h1>
      <form action={action} className="flex gap-2 border border-[var(--color-border)] p-4 mb-6">
        <input name="name" placeholder="예: METALLICA / 부활" className="border border-[var(--color-border-strong)] px-3 py-2 flex-1" />
        <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">추가</button>
        {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="w-full text-sm text-green-700">{state.ok}</p>}
      </form>
      <ul className="flex flex-wrap gap-2">
        {names.map((n) => (
          <li key={n.id} className="inline-flex items-center gap-2 border border-[var(--color-border)] pl-3 pr-1 py-1">
            <span className="text-sm">{n.name}</span>
            <button onClick={async () => { await deleteBlockedName(n.id); router.refresh(); }}
              className="w-5 h-5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">×</button>
          </li>
        ))}
        {names.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">없음</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

Run: `sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3`
Expected: `✓ Compiled successfully`
```bash
sudo -u ec2-user git add "src/app/admin/(authed)/band-name/blocked-names"
sudo -u ec2-user git commit -m "feat(admin): 차단 밴드명 관리"
```

---

## Task 15: 섹션 내비 + 최종 검증 + dev push

**Files:**
- (선택) Create: `src/app/admin/(authed)/band-name/layout.tsx` — 4섹션 하위 탭

- [ ] **Step 1: band-name 하위 탭 레이아웃**

`src/app/admin/(authed)/band-name/layout.tsx`:
```tsx
import Link from "next/link";

const tabs = [
  { href: "/admin/band-name/words", label: "Words" },
  { href: "/admin/band-name/patterns", label: "Patterns" },
  { href: "/admin/band-name/pairs", label: "Pairs" },
  { href: "/admin/band-name/blocked-names", label: "Blocked Names" },
];

export default function BandNameAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex flex-wrap gap-4 mb-8 border-b border-[var(--color-border)] pb-3">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 전체 검증**

Run:
```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/bandName/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
sudo -u ec2-user env PATH="$PATH" npx eslint src/lib/bandName "src/app/admin/(authed)/band-name" src/app/playground/band-name-generator 2>&1 | tail -5; echo "(eslint done)"
sudo -u ec2-user env PATH="$PATH" npx tsc --noEmit 2>&1 | grep -E "bandName|band-name" || echo "TS OK(신규 파일)"
sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | grep -E "Compiled successfully|Failed|error TS" | head -3
```
Expected: `# fail 0`, eslint 무출력, `TS OK`, `✓ Compiled successfully`.

- [ ] **Step 3: dev 재시작 + smoke (생성기 + admin 라우트)**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" pm2 restart bandsustain-dev --update-env >/dev/null && sleep 2
for p in /playground/band-name-generator /admin/band-name/words /admin/band-name/patterns /admin/band-name/pairs /admin/band-name/blocked-names; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3101$p)"
done
```
Expected: 생성기 200. admin 경로는 미인증 시 로그인 리다이렉트(기존 admin 동작과 동일) — 200/307 등 기존과 일관.

- [ ] **Step 4: layout 커밋 + dev push**

```bash
sudo -u ec2-user git add "src/app/admin/(authed)/band-name/layout.tsx"
sudo -u ec2-user git commit -m "feat(admin): band-name 하위 탭 레이아웃"
sudo -u ec2-user git push origin dev
```

- [ ] **Step 5: ⛔ 멈춤 — 사용자 dev 검증 요청**

dev(https://dev.bandsustain.com)에서 `/admin/band-name`의 단어/패턴/쌍/차단명 추가·삭제를 실제로 해보고, 생성기에 반영되는지 확인 요청. **운영 반영은 사용자 명시 시에만** dev→main 머지 + PROD DB 에 017 마이그/시드 적용 + 빌드/재시작.

---

## Self-Review (작성자 체크 결과)

**스펙 커버리지:** 단어(Task 11)/패턴(12)/쌍(13)/차단명(14) CRUD ✓. 전체 DB 이전+시드(6,7) ✓. 데이터셋 주입 리팩터(3,4) ✓. 읽기 경로 A1(9) ✓. 폴백(8 loadBandNameDataset catch) ✓. 삭제 가드(11) ✓. boosts/씬/카테고리 코드 유지(3에서 상수 import 유지) ✓. 테스트(4,8) ✓. AdminNav(10) ✓.

**Placeholder 스캔:** 없음 — 모든 step에 실제 코드/명령/기대값.

**타입 일관성:** `BandNameDataset`(Task 1) ↔ `defaultDataset`(2) ↔ `generateBandNames(input,dataset,rng)`(3) ↔ 테스트(4) ↔ `rowsToDataset`(8) ↔ 페이지 prop(9) 일관. `WordMap` Partial → `wordPool ?? []`(3) 일관. `ALL_WORD_CATEGORIES`(1) → 시드(7)/검증(11,12) 재사용. SQL 컬럼명 ↔ 매퍼/쿼리 일관(`pattern_key`, `min_weirdness`, `word_a/b`, `name`).

**범위:** 단일 기능(생성기 데이터 관리자) — 분해 불필요.

---

## 알려진 주의사항 (실행 시)

- **DB 작업은 DEV 먼저.** 017 마이그/시드 모두 DEV DB. 운영은 사용자 명시 후 PROD DB에 동일 적용(같은 SQL + `bandname:seed` with PROD creds).
- **파일 소유권:** root로 생성/수정한 파일은 `chown -R ec2-user:ec2-user`로 보정(빌드 EACCES 방지). 운영 빌드 전 `.next` root 소유 점검.
- **mysql2 JSON 컬럼**: 드라이버가 객체로 줄 수도, 문자열로 줄 수도 있어 `asArray()`로 양쪽 방어(매퍼/페이지 모두).
- **revalidate**: 모든 admin 변경은 `/playground/band-name-generator` 재검증 → 다음 페이지 로드시 새 데이터셋 반영.
- **JSON 타입 안전성**: `z.enum(ALL_WORD_CATEGORIES as [string, ...string[]])` 캐스팅은 런타임 목록을 zod enum으로 쓰기 위함.
