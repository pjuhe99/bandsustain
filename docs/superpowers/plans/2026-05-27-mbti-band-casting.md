# MBTI 밴드 캐스팅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 밴드 이름 생성기 사이트(`bandsustain`)에 정적 데이터 기반 "MBTI 밴드 캐스팅" 기능(`/playground/mbti-band-casting`)을 신규 라우트로 추가하고, 결과의 풀 공유(카톡/OG)와 밴드 이름 생성기 핸드오프를 연결한다.

**Architecture:** 제공된 4개 TS 데이터/엔진 파일을 `src/lib/mbtiCasting/`로 이식(DB 없음). 결정론 엔진이 6개 입력만으로 결과 전체를 재생산하므로 공유는 6개 입력만 base64url 토큰에 담고 share 페이지·OG 이미지가 서버에서 재계산한다. 클라이언트 5스텝 마법사가 결과 카드를 같은 화면에 렌더. 생성기는 `searchParams`로 초기값을 받도록 회귀 안전하게 확장.

**Tech Stack:** Next.js 16 App Router + TypeScript + Tailwind v4, `next/og`(satori, 정적 OTF), `node:test`(`node --import tsx --test`로 실행), PM2 `bandsustain-dev`(포트 3101). 기존 디자인 토큰/애니메이션 재사용.

**환경 주의 (메모리 규칙):**
- 모든 작업은 `bandsustain-dev`(`/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`, **dev 브랜치**)에서만.
- git/build/file 작업은 **ec2-user**로 수행(root로 만들면 root:root 파일이 박혀 다음 ec2-user fetch/build가 EACCES). 명령 prefix: `sudo -u ec2-user env PATH="$PATH" ...`. git commit identity: `-c user.name="yekong" -c user.email="pjuhe99@naver.com"`.
- 운영(`bandsustain`, 포트 3100) 직접 수정/머지 금지. dev 검증 후 사용자 명시 요청 시에만 운영 반영.

**원본 데이터 파일 위치(이식 소스):**
`/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/mbti_band_recommendation_mvp/`
- `mbtiBandData.ts`, `bandMusicData.ts`, `bandGearData.ts`, `bandRecommendationEngine.ts`

---

## File Structure

```
src/lib/mbtiCasting/
  types.ts        # 공유 타입 (Position/Genre/Mbti/Stage/Sound/Experience/Budget Id + scores/definition/MbtiProfile)
  data.ts         # POSITIONS, GENRES, STAGE/SOUND_PREFERENCES, EXPERIENCES, BUDGETS, MBTI_PROFILES, POSITION_PRIORITY, getPositionTitle/Description
  songs.ts        # SONGS(35), DIFFICULTY_LABELS, EXPERIENCE_DIFFICULTY_PREFERENCE, SongRecommendation/DifficultyId
  gear.ts         # GEAR_BUNDLES(30), GENRE_GEAR_TIPS, GEAR_NOTICE, getGearBundle, GearItem/GearBundle
  engine.ts       # recommendBandCasting + helper, BandCastingInput/BandCastingResult/DisplaySong
  share.ts        # encodeCasting/decodeCasting (6입력 ↔ base64url) + 검증
  nameGenLink.ts  # GENRE_TO_SCENE, MOOD_TAG_TO_MOOD, buildNameGenQuery
  shareImage.tsx  # renderCastingImage (og 1200×630 / kakao 1200×1200)
  engine.test.ts / share.test.ts / nameGenLink.test.ts

src/app/playground/mbti-band-casting/
  page.tsx                          # 서버: metadata + 헤더 + <MbtiBandCasting/>
  MbtiBandCasting.tsx               # 클라이언트: 마법사 + 결과 카드
  CastingShareSheet.tsx             # 공유 시트
  share/[data]/page.tsx
  share/[data]/opengraph-image.tsx
  share/[data]/kakao-image/route.ts

수정:
  src/lib/bandName/options.ts                          # parseInitialInput 헬퍼 추가
  src/app/playground/band-name-generator/page.tsx      # searchParams → initialInput
  src/app/playground/band-name-generator/BandNameGenerator.tsx  # initialInput prop
  src/lib/playground.ts                                # 진입 카드 1개
```

모든 명령은 `cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain` 기준. 테스트 실행은:
`sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/<file>.test.ts`

---

## Task 1: 데이터/타입 모듈 이식 (types/data/songs/gear)

**Files:**
- Create: `src/lib/mbtiCasting/types.ts`
- Create: `src/lib/mbtiCasting/data.ts`
- Create: `src/lib/mbtiCasting/songs.ts`
- Create: `src/lib/mbtiCasting/gear.ts`

- [ ] **Step 1: `types.ts` — 공유 타입만 추출**

원본 `mbtiBandData.ts` 상단의 **타입 선언만** 옮긴다(값/함수 제외). 내용 전체:

```ts
// src/lib/mbtiCasting/types.ts
// MBTI 밴드 캐스팅 — 공유 타입 정의. (값/데이터는 data.ts, songs.ts, gear.ts)

export type PositionId =
  | "vocal" | "leadGuitar" | "rhythmGuitar" | "bass" | "drums" | "keyboard";

export type GenreId =
  | "jPop" | "jRock" | "popPunk" | "alternative" | "indieRock" | "cityPop" | "metalHeavyRock";

export type MbtiId =
  | "ISTJ" | "ISFJ" | "INFJ" | "INTJ"
  | "ISTP" | "ISFP" | "INFP" | "INTP"
  | "ESTP" | "ESFP" | "ENFP" | "ENTP"
  | "ESTJ" | "ESFJ" | "ENFJ" | "ENTJ";

export type StagePreferenceId = "spotlight" | "signature" | "foundation" | "groove" | "texture";
export type SoundPreferenceId = "voice" | "riff" | "lowEnd" | "beat" | "synth";
export type ExperienceId = "beginner" | "starter" | "player";
export type BudgetId = "browse" | "under300" | "under600" | "under1000" | "owned";

export type PositionScores = Record<PositionId, number>;

export interface PositionDefinition {
  id: PositionId;
  label: string;
  englishLabel: string;
  icon: string;
  keyword: string;
  baseDescription: string;
}

export interface GenreDefinition {
  id: GenreId;
  label: string;
  shortDescription: string;
  positionBoosts: PositionScores;
  moodTags: string[];
}

export interface WeightedOption<T extends string> {
  id: T;
  label: string;
  positionBoosts: PositionScores;
}

export interface MbtiProfile {
  id: MbtiId;
  nickname: string;
  intro: string;
  bandStyle: string;
  moodTags: string[];
  baseScores: PositionScores;
  positionDescriptions: Partial<Record<PositionId, string>>;
}
```

- [ ] **Step 2: `data.ts` — 데이터 + 헬퍼 이식**

원본 `mbtiBandData.ts`에서 **타입 선언을 제외한 나머지 전부**(zeroScores, POSITION_PRIORITY, POSITIONS, GENRES, STAGE_PREFERENCES, SOUND_PREFERENCES, EXPERIENCES, BUDGETS, MBTI_PROFILES, getPositionTitle, getPositionDescription)를 그대로 복사하되, 상단에 타입 import를 추가하고 export type 라인은 삭제한다. 파일 시작 부분만 다음과 같이:

```ts
// src/lib/mbtiCasting/data.ts
// MBTI 밴드 캐스팅 콘텐츠 DB. (원본 mbtiBandData.ts 이식)
import type {
  BudgetId, ExperienceId, GenreDefinition, GenreId, MbtiId, MbtiProfile,
  PositionDefinition, PositionId, SoundPreferenceId,
  StagePreferenceId, WeightedOption,
} from "./types";
// (data.ts 에서 직접 참조하지 않는 PositionScores 는 import 하지 않는다 — lint 통과.
//  positionBoosts/baseScores 객체 리터럴의 타입은 위 interface 들이 제공한다.)

// (원본의 미사용 zeroScores 헬퍼는 생략 — lint 통과)
export const POSITION_PRIORITY: PositionId[] = [
  "vocal", "leadGuitar", "rhythmGuitar", "bass", "drums", "keyboard",
];
// ... 이하 POSITIONS, GENRES, STAGE_PREFERENCES, SOUND_PREFERENCES, EXPERIENCES,
//     BUDGETS, MBTI_PROFILES, getPositionTitle, getPositionDescription 를
//     원본 mbtiBandData.ts 에서 값/함수 부분 그대로 복사.
```

주의: 원본의 `EXPERIENCES`/`BUDGETS`는 `{ id; label }[]` 형태이며 `WeightedOption`이 아니다 — 그대로 둔다. **`zeroScores`는 원본에서 어디서도 호출되지 않는 미사용 함수다 — lint(`no-unused-vars`) 통과를 위해 `data.ts`에서는 생략한다.** `STAGE_PREFERENCES`/`SOUND_PREFERENCES`는 `WeightedOption<...>[]` 타입을 명시한다.

- [ ] **Step 3: `songs.ts` 이식**

원본 `bandMusicData.ts` 전체를 복사하고 import 경로만 변경:

```ts
// src/lib/mbtiCasting/songs.ts
import type { ExperienceId, GenreId, PositionId } from "./types";
// ... 이하 DifficultyId, SongRecommendation, DIFFICULTY_LABELS,
//     EXPERIENCE_DIFFICULTY_PREFERENCE, SONGS(35곡) 를 원본에서 그대로 복사.
```

- [ ] **Step 4: `gear.ts` 이식**

원본 `bandGearData.ts` 전체를 복사하고 import 경로만 변경:

```ts
// src/lib/mbtiCasting/gear.ts
import type { BudgetId, GenreId, PositionId } from "./types";
// ... 이하 GearItem, GearBundle, commonNotice, GEAR_NOTICE, GEAR_BUNDLES(30세트),
//     GENRE_GEAR_TIPS, getGearBundle 를 원본에서 그대로 복사.
```

- [ ] **Step 5: 이식 검증 (개수 스모크)**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" node --import tsx -e "import('./src/lib/mbtiCasting/data.ts').then(async d=>{const s=await import('./src/lib/mbtiCasting/songs.ts');const g=await import('./src/lib/mbtiCasting/gear.ts');console.log(Object.keys(d.MBTI_PROFILES).length, s.SONGS.length, g.GEAR_BUNDLES.length, Object.keys(d.GENRES).length, d.STAGE_PREFERENCES.length, d.SOUND_PREFERENCES.length);})"
```
Expected: `16 35 30 7 5 5`

- [ ] **Step 6: 소유권 보정 + 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/mbtiCasting
sudo -u ec2-user git add src/lib/mbtiCasting/types.ts src/lib/mbtiCasting/data.ts src/lib/mbtiCasting/songs.ts src/lib/mbtiCasting/gear.ts
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): port static data/type modules"
```

---

## Task 2: 추천 엔진 (engine.ts) — TDD

**Files:**
- Test: `src/lib/mbtiCasting/engine.test.ts`
- Create: `src/lib/mbtiCasting/engine.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/mbtiCasting/engine.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { recommendBandCasting, type BandCastingInput } from "./engine";
import {
  MBTI_PROFILES, GENRES, STAGE_PREFERENCES, SOUND_PREFERENCES,
  EXPERIENCES, BUDGETS, POSITION_PRIORITY,
} from "./data";
import type { MbtiId, GenreId } from "./types";

const base: BandCastingInput = {
  mbti: "INFP", genre: "indieRock", stagePreference: "foundation",
  soundPreference: "lowEnd", experience: "starter", budget: "under600",
};

test("all 16 MBTI produce a valid result", () => {
  for (const mbti of Object.keys(MBTI_PROFILES) as MbtiId[]) {
    const r = recommendBandCasting({ ...base, mbti });
    assert.ok(POSITION_PRIORITY.includes(r.primaryPosition));
    assert.notEqual(r.primaryPosition, r.secondaryPosition);
    assert.equal(r.songs.length, 3);
    assert.equal(r.gear.items.length, 3);
    assert.ok(r.moodTags.length > 0 && r.moodTags.length <= 3);
  }
});

test("all 7 genres produce a valid result", () => {
  for (const genre of Object.keys(GENRES) as GenreId[]) {
    const r = recommendBandCasting({ ...base, genre });
    assert.equal(r.songs.length, 3);
    assert.equal(r.gear.items.length, 3);
  }
});

test("deterministic: same input yields same output", () => {
  const a = recommendBandCasting(base);
  const b = recommendBandCasting(base);
  assert.equal(a.primaryPosition, b.primaryPosition);
  assert.deepEqual(a.songs.map((s) => s.id), b.songs.map((s) => s.id));
  assert.deepEqual(a.gear.items, b.gear.items);
});

test("every position can be primary for some input combination", () => {
  const reached = new Set<string>();
  for (const mbti of Object.keys(MBTI_PROFILES) as MbtiId[]) {
    for (const genre of Object.keys(GENRES) as GenreId[]) {
      for (const stage of STAGE_PREFERENCES) {
        for (const sound of SOUND_PREFERENCES) {
          const r = recommendBandCasting({
            mbti, genre, stagePreference: stage.id, soundPreference: sound.id,
            experience: "starter", budget: "under600",
          });
          reached.add(r.primaryPosition);
        }
      }
    }
  }
  assert.equal(reached.size, POSITION_PRIORITY.length);
});

test("songs and gear are always exactly 3 across all experience/budget", () => {
  for (const budget of BUDGETS) {
    for (const exp of EXPERIENCES) {
      const r = recommendBandCasting({ ...base, budget: budget.id, experience: exp.id });
      assert.equal(r.songs.length, 3);
      assert.equal(r.gear.items.length, 3);
    }
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/engine.test.ts 2>&1 | tail -8`
Expected: FAIL (`Cannot find module './engine'` 류).

- [ ] **Step 3: `engine.ts` 이식**

원본 `bandRecommendationEngine.ts` 전체를 복사하되 (1) import 경로를 분리된 모듈로 변경하고 (2) 맨 아래 `createNameGeneratorQuery` 함수는 **삭제**한다(별도 `nameGenLink.ts`가 대체). 상단 import만 다음으로 교체, 나머지(인터페이스·함수 본문)는 원본 그대로:

```ts
// src/lib/mbtiCasting/engine.ts
import {
  GENRES, MBTI_PROFILES, POSITIONS, POSITION_PRIORITY,
  SOUND_PREFERENCES, STAGE_PREFERENCES,
  getPositionDescription, getPositionTitle,
} from "./data";
import type {
  BudgetId, ExperienceId, GenreId, MbtiId, PositionId,
  PositionScores, SoundPreferenceId, StagePreferenceId,
} from "./types";
import {
  DIFFICULTY_LABELS, EXPERIENCE_DIFFICULTY_PREFERENCE, SONGS,
  type SongRecommendation,
} from "./songs";
import { GENRE_GEAR_TIPS, GEAR_NOTICE, getGearBundle } from "./gear";

// ... 원본 bandRecommendationEngine.ts 의 인터페이스(BandCastingInput, ScoredPosition,
//     DisplaySong, BandCastingResult)와 함수(addScores, rankPositions, unique,
//     scoreSong, getSongReason, pickSongs, recommendBandCasting) 를 그대로 복사.
//     단, 파일 끝의 createNameGeneratorQuery 는 포함하지 않는다.
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/engine.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` (5 tests pass).

- [ ] **Step 5: 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/mbtiCasting
sudo -u ec2-user git add src/lib/mbtiCasting/engine.ts src/lib/mbtiCasting/engine.test.ts
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): deterministic recommendation engine + tests"
```

---

## Task 3: 공유 토큰 (share.ts) — TDD

**Files:**
- Test: `src/lib/mbtiCasting/share.test.ts`
- Create: `src/lib/mbtiCasting/share.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/mbtiCasting/share.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { encodeCasting, decodeCasting } from "./share";
import type { BandCastingInput } from "./engine";

const input: BandCastingInput = {
  mbti: "ENFP", genre: "jRock", stagePreference: "spotlight",
  soundPreference: "voice", experience: "player", budget: "under1000",
};

// 라이브러리와 동일한 base64url 인코딩(ASCII enum 전용)
function rawToken(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

test("round-trip preserves all six inputs", () => {
  assert.deepEqual(decodeCasting(encodeCasting(input)), input);
});

test("garbage token returns null", () => {
  assert.equal(decodeCasting("!!!not-base64!!!"), null);
  assert.equal(decodeCasting(""), null);
});

test("tampered enum returns null", () => {
  const bad = rawToken(["XXXX", "jRock", "spotlight", "voice", "player", "under1000"]);
  assert.equal(decodeCasting(bad), null);
});

test("wrong-length array returns null", () => {
  assert.equal(decodeCasting(rawToken(["ENFP", "jRock"])), null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/share.test.ts 2>&1 | tail -8`
Expected: FAIL (module not found).

- [ ] **Step 3: `share.ts` 구현**

```ts
// src/lib/mbtiCasting/share.ts
// 캐스팅 결과 공유 — 6개 입력만 base64url 토큰으로 인코딩한다.
// 엔진이 결정론적이라 share 페이지/OG 이미지가 이 입력으로 결과 전체를 재계산한다.

import {
  BUDGETS, EXPERIENCES, GENRES, MBTI_PROFILES,
  SOUND_PREFERENCES, STAGE_PREFERENCES,
} from "./data";
import type { BandCastingInput } from "./engine";
import type {
  BudgetId, ExperienceId, GenreId, MbtiId, SoundPreferenceId, StagePreferenceId,
} from "./types";

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeCasting(input: BandCastingInput): string {
  return toBase64Url(JSON.stringify([
    input.mbti, input.genre, input.stagePreference,
    input.soundPreference, input.experience, input.budget,
  ]));
}

const STAGE_IDS = new Set(STAGE_PREFERENCES.map((s) => s.id));
const SOUND_IDS = new Set(SOUND_PREFERENCES.map((s) => s.id));
const EXPERIENCE_IDS = new Set(EXPERIENCES.map((e) => e.id));
const BUDGET_IDS = new Set(BUDGETS.map((b) => b.id));

export function decodeCasting(token: string): BandCastingInput | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed) || parsed.length !== 6) return null;
    const [mbti, genre, stage, sound, experience, budget] = parsed;
    if (typeof mbti !== "string" || !(mbti in MBTI_PROFILES)) return null;
    if (typeof genre !== "string" || !(genre in GENRES)) return null;
    if (typeof stage !== "string" || !STAGE_IDS.has(stage as StagePreferenceId)) return null;
    if (typeof sound !== "string" || !SOUND_IDS.has(sound as SoundPreferenceId)) return null;
    if (typeof experience !== "string" || !EXPERIENCE_IDS.has(experience as ExperienceId)) return null;
    if (typeof budget !== "string" || !BUDGET_IDS.has(budget as BudgetId)) return null;
    return {
      mbti: mbti as MbtiId, genre: genre as GenreId,
      stagePreference: stage as StagePreferenceId, soundPreference: sound as SoundPreferenceId,
      experience: experience as ExperienceId, budget: budget as BudgetId,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/share.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` (4 tests pass).

- [ ] **Step 5: 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/mbtiCasting
sudo -u ec2-user git add src/lib/mbtiCasting/share.ts src/lib/mbtiCasting/share.test.ts
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): share token encode/decode + tests"
```

---

## Task 4: 생성기 핸드오프 매핑 (nameGenLink.ts) — TDD

**Files:**
- Test: `src/lib/mbtiCasting/nameGenLink.test.ts`
- Create: `src/lib/mbtiCasting/nameGenLink.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/mbtiCasting/nameGenLink.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { GENRE_TO_SCENE, buildNameGenQuery } from "./nameGenLink";
import { GENRES } from "./data";
import type { GenreId } from "./types";
import { sceneOptions, moodOptions } from "../bandName/options";

const validScenes = new Set(sceneOptions.map((o) => o.value));
const validMoods = new Set(moodOptions.map((o) => o.value));

test("every genre maps to a valid generator scene", () => {
  for (const g of Object.keys(GENRES) as GenreId[]) {
    assert.ok(validScenes.has(GENRE_TO_SCENE[g]));
  }
});

test("buildNameGenQuery always includes a valid scene", () => {
  for (const g of Object.keys(GENRES) as GenreId[]) {
    const qs = new URLSearchParams(buildNameGenQuery(g, []));
    assert.ok(qs.get("scene") && validScenes.has(qs.get("scene") as never));
  }
});

test("mood param, when present, is a valid generator mood", () => {
  const qs = new URLSearchParams(buildNameGenQuery("jRock", ["청춘", "질주"]));
  const mood = qs.get("mood");
  if (mood !== null) assert.ok(validMoods.has(mood as never));
});

test("unmapped mood tags omit the mood param", () => {
  const qs = new URLSearchParams(buildNameGenQuery("jRock", ["존재하지않는태그"]));
  assert.equal(qs.get("mood"), null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/nameGenLink.test.ts 2>&1 | tail -8`
Expected: FAIL (module not found).

- [ ] **Step 3: `nameGenLink.ts` 구현**

```ts
// src/lib/mbtiCasting/nameGenLink.ts
// 캐스팅 결과 → 밴드 이름 생성기 초기값 매핑.
// 생성기 씬/무드 enum 으로 best-effort 변환해 쿼리스트링을 만든다.

import type { GenreId } from "./types";
import type { Mood, Scene } from "../bandName/types";

export const GENRE_TO_SCENE: Record<GenreId, Scene> = {
  jPop: "jrock",
  jRock: "jrock",
  popPunk: "punk",
  alternative: "emo",
  indieRock: "hongdae",
  cityPop: "citypop",
  metalHeavyRock: "metal",
};

// MBTI moodTags(자유 한글) → 생성기 6-enum. 매핑 없는 태그는 무시한다.
export const MOOD_TAG_TO_MOOD: Record<string, Mood> = {
  청량: "fresh", 청춘: "fresh", 질주: "fresh", 반짝임: "fresh", 스피드: "fresh",
  여름: "fresh", 컬러풀: "fresh", 속도감: "fresh", 직진: "fresh", 떼창: "fresh",
  몽환: "dreamy", 공간감: "dreamy", 새벽: "dreamy", 야경: "dreamy", 네온: "dreamy",
  미래적: "dreamy", 실험적: "dreamy", 호기심: "dreamy", 변칙: "dreamy",
  여운: "wistful", 서사: "wistful", 감성: "wistful", 나른함: "wistful",
  잔상: "wistful", 산책: "wistful",
  폭발: "rough", 강렬: "rough", 반항: "rough", 하이게인: "rough", 중량감: "rough",
  파워: "rough", 카리스마: "rough", 도발: "rough",
  낭만: "romantic", 따뜻함: "romantic", 온기: "romantic", 멜로디: "romantic",
  재치: "funny", 즐거움: "funny",
};

export function buildNameGenQuery(genre: GenreId, moodTags: string[]): string {
  const params = new URLSearchParams({ scene: GENRE_TO_SCENE[genre] });
  for (const tag of moodTags) {
    const mood = MOOD_TAG_TO_MOOD[tag];
    if (mood) {
      params.set("mood", mood);
      break;
    }
  }
  return params.toString();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/nameGenLink.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` (4 tests pass).

- [ ] **Step 5: 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/mbtiCasting
sudo -u ec2-user git add src/lib/mbtiCasting/nameGenLink.ts src/lib/mbtiCasting/nameGenLink.test.ts
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): name-generator handoff mapping + tests"
```

---

## Task 5: OG/카톡 공유 이미지 렌더러 (shareImage.tsx)

**Files:**
- Create: `src/lib/mbtiCasting/shareImage.tsx`

원본 `src/lib/bandName/shareImage.tsx`의 톤을 따르되, 입력으로부터 엔진 결과를 재계산해 타이틀·포지션·MBTI·장르·무드를 그린다.

- [ ] **Step 1: 구현**

```tsx
// src/lib/mbtiCasting/shareImage.tsx
// 캐스팅 결과 공유 이미지(next/og). og 1200×630 / kakao 정사각형 1200×1200.
// 디코드된 입력으로 엔진을 재계산해 결과 타이틀/포지션을 그린다.

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GENRES, POSITIONS } from "./data";
import { recommendBandCasting, type BandCastingInput } from "./engine";

export type ShareImageVariant = "og" | "kakao";

export const OG_SIZE = { width: 1200, height: 630 };
export const KAKAO_SIZE = { width: 1200, height: 1200 };

export function shareImageSize(variant: ShareImageVariant) {
  return variant === "kakao" ? KAKAO_SIZE : OG_SIZE;
}

export function renderCastingImage(
  input: BandCastingInput | null,
  variant: ShareImageVariant = "og",
): ImageResponse {
  const square = variant === "kakao";
  const size = shareImageSize(variant);

  // 디코드 실패 시에도 500 내지 않도록 중립 카드로 폴백.
  const result = input ? recommendBandCasting(input) : null;
  const title = result?.title ?? "MBTI 밴드 캐스팅";
  const positionLabel = result ? POSITIONS[result.primaryPosition].label : "";
  const eyebrow = input ? `${input.mbti} · ${GENRES[input.genre].label}` : "MBTI 밴드 캐스팅";
  const tags = result ? result.moodTags : [];

  const fontData = readFileSync(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));

  const len = title.length;
  const base = len <= 8 ? 96 : len <= 14 ? 76 : len <= 20 ? 60 : 48;
  const titleSize = square ? Math.round(base * 1.06) : base;
  const align = square ? "center" : "flex-start";

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "stretch",
          padding: square ? "104px 90px" : "64px 80px",
          fontFamily: "Pretendard",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: square ? "center" : "flex-start",
            fontSize: 24,
            letterSpacing: 6,
            color: "#2563FF",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 24, width: "100%" }}>
          {positionLabel && (
            <div style={{ display: "flex", justifyContent: square ? "center" : "flex-start", fontSize: 32, color: "#555555" }}>
              {positionLabel}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: square ? "center" : "flex-start",
              width: "100%",
              fontSize: titleSize,
              fontWeight: 700,
              color: "#0a0a0a",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              textAlign: square ? "center" : "left",
            }}
          >
            {title}
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 12, justifyContent: square ? "center" : "flex-start", flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <div key={tag} style={{ display: "flex", fontSize: 24, color: "#555555", border: "1px solid #e5e5e5", padding: "8px 18px" }}>
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#888888" }}>
          <div style={{ display: "flex" }}>bandsustain.com</div>
          <div style={{ display: "flex" }}>MBTI 밴드 캐스팅</div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: [{ name: "Pretendard", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
```

- [ ] **Step 2: 타입 컴파일 스모크**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" node --import tsx -e "import('./src/lib/mbtiCasting/shareImage.tsx').then(m=>console.log(typeof m.renderCastingImage, m.OG_SIZE.width, m.KAKAO_SIZE.width))"
```
Expected: `function 1200 1200`

- [ ] **Step 3: 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/mbtiCasting
sudo -u ec2-user git add src/lib/mbtiCasting/shareImage.tsx
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): og/kakao share image renderer"
```

---

## Task 6: 마법사 + 결과 카드 (page.tsx, MbtiBandCasting.tsx)

**Files:**
- Create: `src/app/playground/mbti-band-casting/page.tsx`
- Create: `src/app/playground/mbti-band-casting/MbtiBandCasting.tsx`

- [ ] **Step 1: `page.tsx` (서버) 작성**

`band-name-generator/page.tsx` 패턴을 따른다.

```tsx
// src/app/playground/mbti-band-casting/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import MbtiBandCasting from "./MbtiBandCasting";

const description =
  "MBTI와 음악 취향을 고르면 내가 밴드 멤버라면 어떤 포지션일지, 어울리는 커버곡과 첫 장비까지 추천해드려요. 재미로 보는 밴드 캐릭터 발견 놀이.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "MBTI 밴드 캐스팅",
  path: "/playground/mbti-band-casting",
  description,
  keywords: ["MBTI 밴드", "밴드 포지션 테스트", "MBTI 밴드 캐스팅", "밴드 멤버 추천"],
  ogImage,
});

export default function MbtiBandCastingPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">MBTI 밴드 캐스팅</span>
      </nav>

      <header className="mb-10 md:mb-14 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-4">
          이상한 도구
        </p>
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl leading-[1.05]">
          MBTI 밴드 캐스팅
        </h1>
        <p className="mt-6 text-xl md:text-2xl font-display font-bold text-[var(--color-text)]">
          내 MBTI가 밴드 멤버가 된다면?
        </p>
        <p className="mt-3 text-lg text-[var(--color-text-muted)] leading-relaxed">
          포지션부터 커버곡, 첫 장비까지 추천받아보세요.
        </p>
      </header>

      <MbtiBandCasting />
    </section>
  );
}
```

- [ ] **Step 2: `MbtiBandCasting.tsx` (클라이언트) 작성**

```tsx
// src/app/playground/mbti-band-casting/MbtiBandCasting.tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  BUDGETS, EXPERIENCES, GENRES, MBTI_PROFILES, POSITIONS,
  SOUND_PREFERENCES, STAGE_PREFERENCES,
} from "@/lib/mbtiCasting/data";
import { recommendBandCasting, type BandCastingInput, type BandCastingResult } from "@/lib/mbtiCasting/engine";
import { buildNameGenQuery } from "@/lib/mbtiCasting/nameGenLink";
import type {
  BudgetId, ExperienceId, GenreId, MbtiId, SoundPreferenceId, StagePreferenceId,
} from "@/lib/mbtiCasting/types";
import CastingShareSheet from "./CastingShareSheet";

const TOTAL_STEPS = 5;
const LOADING_MS = 1200;
const MBTI_LIST = Object.keys(MBTI_PROFILES) as MbtiId[];
const GENRE_LIST = Object.values(GENRES);

const STAGE_QUESTION = "무대에서 어떤 순간에 가장 끌리나요?";
const SOUND_QUESTION = "어떤 소리가 가장 좋나요?";

function cardClass(active: boolean): string {
  return `text-left p-4 md:p-5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 ${
    active
      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
      : "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)]"
  }`;
}

function StepHeading({ step, title, sub }: { step: number; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-[0.1em] text-[var(--color-text-muted)] mb-2">
        {step} / {TOTAL_STEPS}
      </p>
      <h2 className="font-display font-bold text-xl md:text-2xl text-[var(--color-text)]">{title}</h2>
      {sub && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  );
}

export default function MbtiBandCasting() {
  const [step, setStep] = useState(1);
  const [mbti, setMbti] = useState<MbtiId | null>(null);
  const [genre, setGenre] = useState<GenreId | null>(null);
  const [stage, setStage] = useState<StagePreferenceId | null>(null);
  const [sound, setSound] = useState<SoundPreferenceId | null>(null);
  const [experience, setExperience] = useState<ExperienceId | null>(null);
  const [budget, setBudget] = useState<BudgetId | null>(null);
  const [result, setResult] = useState<BandCastingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = ((step - 1) / TOTAL_STEPS) * 100;

  const reset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStep(1);
    setMbti(null); setGenre(null); setStage(null); setSound(null);
    setExperience(null); setBudget(null);
    setResult(null); setLoading(false); setSharing(false);
  };

  const finish = () => {
    if (!mbti || !genre || !stage || !sound || !experience || !budget) return;
    const input: BandCastingInput = {
      mbti, genre, stagePreference: stage, soundPreference: sound, experience, budget,
    };
    setLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setResult(recommendBandCasting(input));
      setLoading(false);
      timeoutRef.current = null;
    }, LOADING_MS);
  };

  // 결과 화면 ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="border-t border-[var(--color-border)] pt-12" aria-live="polite">
        <p className="font-display font-bold text-2xl md:text-3xl mb-6">캐스팅 중…</p>
        <div className="h-1 w-full bg-[var(--color-border)] overflow-hidden" role="progressbar" aria-label="캐스팅 중">
          <div className="h-full bg-[var(--color-accent)] bandname-progress" />
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">당신에게 어울리는 무대 자리를 찾는 중이에요.</p>
      </div>
    );
  }

  if (result) {
    const input = result.input;
    const primary = POSITIONS[result.primaryPosition];
    const secondary = POSITIONS[result.secondaryPosition];
    const nameGenHref = `/playground/band-name-generator?${buildNameGenQuery(input.genre, result.moodTags)}`;
    return (
      <div className="page-fade-in">
        <div className="bandname-pop border border-[var(--color-text)] p-6 md:p-8">
          {/* 뱃지 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-semibold bg-[var(--color-text)] text-[var(--color-bg)]">
              {input.mbti}
            </span>
            <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {GENRES[input.genre].label}
            </span>
          </div>

          {/* 포지션 + 타이틀 */}
          <div className="flex items-center gap-3 text-[var(--color-text-muted)] mb-2">
            <span className="text-3xl" aria-hidden>{primary.icon}</span>
            <span className="text-sm uppercase tracking-[0.1em]">{primary.englishLabel}</span>
          </div>
          <h2 className="font-display font-black text-3xl md:text-4xl leading-tight break-keep [overflow-wrap:anywhere]">
            {result.title}
          </h2>
          <p className="mt-4 text-base md:text-lg text-[var(--color-text)] leading-relaxed">
            {result.description}
          </p>

          {/* 무드 태그 */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {result.moodTags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">
                {tag}
              </span>
            ))}
          </div>

          {/* 함께 잘 맞는 포지션 */}
          <p className="mt-6 text-sm text-[var(--color-text-muted)]">
            함께 잘 맞는 포지션: <span className="text-[var(--color-text)] font-medium">{secondary.icon} {secondary.label}</span>
          </p>
        </div>

        {/* 커버곡 */}
        <div className="mt-8">
          <h3 className="font-display font-bold text-lg md:text-xl mb-4">추천 커버곡</h3>
          <ul className="grid grid-cols-1 gap-3">
            {result.songs.map((song) => (
              <li key={song.id} className="border border-[var(--color-border)] p-4 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-base break-keep [overflow-wrap:anywhere]">{song.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)] break-keep [overflow-wrap:anywhere]">{song.artist}</p>
                  </div>
                  <span className="shrink-0 px-2 py-1 text-[11px] uppercase tracking-[0.06em] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                    {song.difficultyLabel}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text)] leading-relaxed">{song.reason}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* 첫 장비 */}
        <div className="mt-8">
          <h3 className="font-display font-bold text-lg md:text-xl mb-4">첫 장비 추천</h3>
          <ul className="grid grid-cols-1 gap-3">
            {result.gear.items.map((item, i) => (
              <li key={`${item.category}-${i}`} className="border border-[var(--color-border)] p-4">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-1">{item.category}</p>
                <p className="font-display font-bold text-base break-keep [overflow-wrap:anywhere]">{item.name}</p>
                <p className="mt-1 text-sm text-[var(--color-text)] leading-relaxed">{item.reason}</p>
              </li>
            ))}
          </ul>
          {result.gear.genreTip && (
            <p className="mt-3 text-sm text-[var(--color-text)] leading-relaxed">
              <span className="font-medium">장르 팁 — </span>{result.gear.genreTip}
            </p>
          )}
          <p className="mt-3 text-xs text-[var(--color-text-muted)] leading-relaxed">{result.gear.notice}</p>
        </div>

        {/* 면책 */}
        <p className="mt-8 text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border)] pt-5">
          {result.disclaimer}
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            href={nameGenHref}
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-accent-ink)] border border-[var(--color-accent)] hover:opacity-90 transition-opacity"
          >
            이 캐릭터로 밴드 이름 만들기
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            다시 캐스팅하기
          </button>
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:opacity-90 transition-opacity"
          >
            결과 공유하기
          </button>
        </div>

        {sharing && <CastingShareSheet input={input} result={result} onClose={() => setSharing(false)} />}
      </div>
    );
  }

  // 마법사 화면 -------------------------------------------------------------
  return (
    <div>
      <div className="h-1 w-full bg-[var(--color-border)] overflow-hidden mb-8" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
        <div className="h-full bg-[var(--color-accent)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="border border-[var(--color-border-strong)] p-6 md:p-8">
        {step === 1 && (
          <fieldset>
            <StepHeading step={1} title="당신의 MBTI는 무엇인가요?" sub="몰라도 괜찮아요. 가장 끌리는 유형을 골라보세요." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {MBTI_LIST.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mbti === id}
                  onClick={() => { setMbti(id); setStep(2); }}
                  className={`py-3 font-display font-bold text-base border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 ${
                    mbti === id
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)]"
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <StepHeading step={2} title="어떤 무대의 사운드가 끌리나요?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-3">
              {GENRE_LIST.map((g) => (
                <button key={g.id} type="button" aria-pressed={genre === g.id} onClick={() => { setGenre(g.id); setStep(3); }} className={cardClass(genre === g.id)}>
                  <span className="block font-display font-bold text-base md:text-lg leading-snug">{g.label}</span>
                  <span className={`mt-1 block text-sm leading-relaxed ${genre === g.id ? "text-[var(--color-bg)]/70" : "text-[var(--color-text-muted)]"}`}>
                    {g.shortDescription}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <StepHeading step={3} title={STAGE_QUESTION} />
            <div className="grid grid-cols-1 auto-rows-fr gap-3">
              {STAGE_PREFERENCES.map((opt) => (
                <button key={opt.id} type="button" aria-pressed={stage === opt.id} onClick={() => { setStage(opt.id); setStep(4); }} className={cardClass(stage === opt.id)}>
                  <span className="block font-medium text-base leading-snug">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset>
            <StepHeading step={4} title={SOUND_QUESTION} />
            <div className="grid grid-cols-1 auto-rows-fr gap-3">
              {SOUND_PREFERENCES.map((opt) => (
                <button key={opt.id} type="button" aria-pressed={sound === opt.id} onClick={() => { setSound(opt.id); setStep(5); }} className={cardClass(sound === opt.id)}>
                  <span className="block font-medium text-base leading-snug">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 5 && (
          <div>
            <fieldset className="mb-8">
              <StepHeading step={5} title="연주 경험과 예산을 알려주세요" sub="장비 추천에만 쓰여요." />
              <p className="text-sm font-semibold text-[var(--color-text)] mb-3">연주 경험</p>
              <div className="grid grid-cols-1 auto-rows-fr gap-2.5">
                {EXPERIENCES.map((opt) => (
                  <button key={opt.id} type="button" aria-pressed={experience === opt.id} onClick={() => setExperience(opt.id)} className={cardClass(experience === opt.id)}>
                    <span className="block font-medium text-base leading-snug">{opt.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <p className="text-sm font-semibold text-[var(--color-text)] mb-3">예산</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-2.5">
                {BUDGETS.map((opt) => (
                  <button key={opt.id} type="button" aria-pressed={budget === opt.id} onClick={() => setBudget(opt.id)} className={cardClass(budget === opt.id)}>
                    <span className="block font-medium text-base leading-snug">{opt.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="mt-6 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            이전
          </button>
        )}
        {step === TOTAL_STEPS && (
          <button
            type="button"
            onClick={finish}
            disabled={!experience || !budget}
            className="inline-flex items-center justify-center px-10 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-accent-ink)] border border-[var(--color-accent)] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            내 밴드 캐릭터 보기
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 커밋 (CastingShareSheet는 Task 7에서 생성하므로 빌드는 Task 7 후)**

```bash
chown -R ec2-user:ec2-user src/app/playground/mbti-band-casting
sudo -u ec2-user git add src/app/playground/mbti-band-casting/page.tsx src/app/playground/mbti-band-casting/MbtiBandCasting.tsx
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): wizard page + result card"
```

---

## Task 7: 공유 시트 (CastingShareSheet.tsx)

**Files:**
- Create: `src/app/playground/mbti-band-casting/CastingShareSheet.tsx`

`BandNameShareSheet.tsx`를 거울로 한다.

- [ ] **Step 1: 구현**

```tsx
// src/app/playground/mbti-band-casting/CastingShareSheet.tsx
"use client";

import { useState } from "react";
import { GENRES, POSITIONS } from "@/lib/mbtiCasting/data";
import type { BandCastingInput, BandCastingResult } from "@/lib/mbtiCasting/engine";
import { encodeCasting } from "@/lib/mbtiCasting/share";

type KakaoShare = {
  isInitialized: () => boolean;
  Share?: { sendDefault: (args: object) => void };
};

export default function CastingShareSheet({
  input,
  result,
  onClose,
}: {
  input: BandCastingInput;
  result: BandCastingResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const token = encodeCasting(input);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://bandsustain.com";
  const url = `${origin}/playground/mbti-band-casting/share/${token}`;
  const kakaoImageUrl = `${url}/kakao-image`;
  const description = `${GENRES[input.genre].label} · ${POSITIONS[result.primaryPosition].label} · MBTI 밴드 캐스팅`;
  const canWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 거부됨 — 조용히 실패
    }
  };

  const kakao = () => {
    const Kakao = (window as unknown as { Kakao?: KakaoShare }).Kakao;
    if (Kakao && Kakao.isInitialized() && Kakao.Share) {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: result.title,
          description,
          imageUrl: kakaoImageUrl,
          imageWidth: 1200,
          imageHeight: 1200,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: "결과 보기", link: { mobileWebUrl: url, webUrl: url } }],
      });
    } else if (canWebShare) {
      navigator.share({ title: result.title, text: description, url }).catch(() => {});
    } else {
      copy();
    }
  };

  const webShare = () => {
    navigator.share({ title: result.title, text: description, url }).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="캐스팅 결과 공유"
    >
      <div
        className="bg-[var(--color-bg)] w-full md:max-w-md p-6 border-t md:border border-[var(--color-border-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl">결과 공유</h2>
          <button onClick={onClose} aria-label="닫기" className="text-sm underline underline-offset-4">닫기</button>
        </div>

        <p className="font-display font-black text-2xl md:text-3xl leading-tight break-keep [overflow-wrap:anywhere] mb-2">
          {result.title}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {result.moodTags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {tag}
            </span>
          ))}
        </div>

        <div className="border border-[var(--color-border)] px-3 py-2 text-xs font-mono break-all mb-4 text-[var(--color-text-muted)]">
          {url}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={copy} className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">
            {copied ? "복사됨" : "링크 복사"}
          </button>
          <button onClick={kakao} className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[#FEE500] text-black border border-[#FEE500] hover:opacity-90 transition-opacity">
            카톡 공유
          </button>
        </div>

        {canWebShare && (
          <button onClick={webShare} className="mt-2 w-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:opacity-90 transition-opacity">
            다른 앱으로 공유
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
chown -R ec2-user:ec2-user src/app/playground/mbti-band-casting
sudo -u ec2-user git add src/app/playground/mbti-band-casting/CastingShareSheet.tsx
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): result share sheet (kakao/copy/web share)"
```

---

## Task 8: 공유 페이지 + OG/카톡 이미지 라우트

**Files:**
- Create: `src/app/playground/mbti-band-casting/share/[data]/page.tsx`
- Create: `src/app/playground/mbti-band-casting/share/[data]/opengraph-image.tsx`
- Create: `src/app/playground/mbti-band-casting/share/[data]/kakao-image/route.ts`

- [ ] **Step 1: `share/[data]/page.tsx` 작성**

`band-name-generator/share/[data]/page.tsx` 패턴을 따른다.

```tsx
// src/app/playground/mbti-band-casting/share/[data]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { GENRES, POSITIONS } from "@/lib/mbtiCasting/data";
import { recommendBandCasting } from "@/lib/mbtiCasting/engine";
import { decodeCasting } from "@/lib/mbtiCasting/share";
import { BAND_NAME_KR_FULL, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ data: string }> };

const CASTING_PATH = "/playground/mbti-band-casting";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await params;
  const input = decodeCasting(data);

  if (!input) {
    return {
      title: `MBTI 밴드 캐스팅 | ${BAND_NAME_KR_FULL}`,
      description: "MBTI와 음악 취향으로 보는 내 밴드 캐릭터.",
      alternates: { canonical: `${SITE_URL}${CASTING_PATH}` },
    };
  }

  const result = recommendBandCasting(input);
  const position = POSITIONS[result.primaryPosition].label;
  const title = `${result.title} — MBTI 밴드 캐스팅`;
  const description = `${input.mbti} · ${GENRES[input.genre].label} — 내 밴드 포지션은 '${position}'. ${result.description}`;
  const url = `${SITE_URL}${CASTING_PATH}/share/${data}`;

  return {
    title: `${title} | ${BAND_NAME_KR_FULL}`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, locale: "ko_KR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CastingSharePage({ params }: Props) {
  const { data } = await params;
  const input = decodeCasting(data);

  if (!input) {
    return (
      <section className="max-w-3xl mx-auto px-6 md:px-12 py-24 text-center page-fade-in">
        <h1 className="font-display font-black text-3xl md:text-4xl">결과를 찾을 수 없어요</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">공유 링크가 올바르지 않은 것 같아요. 직접 캐스팅해보세요.</p>
        <Link href={CASTING_PATH} className={buttonClasses("primary", "mt-8")}>캐스팅 시작하기</Link>
      </section>
    );
  }

  const result = recommendBandCasting(input);
  const primary = POSITIONS[result.primaryPosition];

  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center page-fade-in">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-6">MBTI 밴드 캐스팅</p>

      <div className="flex flex-wrap gap-2 justify-center mb-6">
        <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-semibold bg-[var(--color-text)] text-[var(--color-bg)]">{input.mbti}</span>
        <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">{GENRES[input.genre].label}</span>
      </div>

      <p className="text-sm text-[var(--color-text-muted)] mb-3">{primary.icon} {primary.label}</p>
      <h1 className="font-display font-black text-3xl sm:text-4xl md:text-6xl leading-[1.05] tracking-tight break-keep [overflow-wrap:anywhere]">
        {result.title}
      </h1>
      <p className="mt-5 text-base md:text-lg text-[var(--color-text-muted)] leading-relaxed max-w-xl mx-auto">{result.description}</p>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {result.moodTags.map((tag) => (
          <span key={tag} className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">{tag}</span>
        ))}
      </div>

      <ul className="mt-10 text-left max-w-xl mx-auto grid grid-cols-1 gap-2">
        {result.songs.map((song) => (
          <li key={song.id} className="border border-[var(--color-border)] p-3 flex items-center justify-between gap-3">
            <span className="min-w-0 break-keep [overflow-wrap:anywhere]"><span className="font-medium">{song.title}</span> <span className="text-[var(--color-text-muted)] text-sm">/ {song.artist}</span></span>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.06em] border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-muted)]">{song.difficultyLabel}</span>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={CASTING_PATH} className={buttonClasses("accent")}>나도 캐스팅해보기</Link>
        <Link href="/playground" className={buttonClasses("secondary")}>플레이그라운드 둘러보기</Link>
      </div>

      <p className="mt-12 text-xs text-[var(--color-text-muted)] leading-relaxed">{result.disclaimer}</p>
    </section>
  );
}
```

- [ ] **Step 2: `opengraph-image.tsx` 작성**

```tsx
// src/app/playground/mbti-band-casting/share/[data]/opengraph-image.tsx
import { decodeCasting } from "@/lib/mbtiCasting/share";
import { OG_SIZE, renderCastingImage } from "@/lib/mbtiCasting/shareImage";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;
export const alt = "MBTI 밴드 캐스팅 — 밴드 서스테인";

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  return renderCastingImage(decodeCasting(data), "og");
}
```

- [ ] **Step 3: `kakao-image/route.ts` 작성**

```ts
// src/app/playground/mbti-band-casting/share/[data]/kakao-image/route.ts
import { decodeCasting } from "@/lib/mbtiCasting/share";
import { renderCastingImage } from "@/lib/mbtiCasting/shareImage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  return renderCastingImage(decodeCasting(data), "kakao");
}
```

- [ ] **Step 4: 커밋**

```bash
chown -R ec2-user:ec2-user src/app/playground/mbti-band-casting
sudo -u ec2-user git add src/app/playground/mbti-band-casting/share
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(mbti-casting): share page + og/kakao image routes"
```

---

## Task 9: 밴드 이름 생성기 핸드오프 (회귀 안전)

**Files:**
- Modify: `src/lib/bandName/options.ts` (헬퍼 추가)
- Modify: `src/app/playground/band-name-generator/page.tsx`
- Modify: `src/app/playground/band-name-generator/BandNameGenerator.tsx`

- [ ] **Step 1: `options.ts`에 `parseInitialInput` 추가**

파일 끝(`defaultInput` 아래)에 추가:

```ts
// 외부(예: MBTI 캐스팅)에서 넘어온 query 로 초기 선택값을 만든다.
// 알려진 값만 통과시키므로 잘못된 파라미터는 무시되어 기본 동작이 유지된다.
export function parseInitialInput(
  sp: Record<string, string | string[] | undefined>,
): Partial<BandNameInput> {
  const out: Partial<BandNameInput> = {};
  const scene = typeof sp.scene === "string" ? sp.scene : undefined;
  if (scene && sceneOptions.some((o) => o.value === scene)) out.scene = scene as Scene;
  const mood = typeof sp.mood === "string" ? sp.mood : undefined;
  if (mood && moodOptions.some((o) => o.value === mood)) out.mood = mood as Mood;
  return out;
}
```

- [ ] **Step 2: `page.tsx`가 `searchParams`를 읽어 전달**

`band-name-generator/page.tsx`를 수정한다. (1) import에 `parseInitialInput` 추가, (2) 함수 시그니처에 `searchParams` 추가, (3) `BandNameGenerator`에 `initialInput` 전달.

import 라인 교체:
```ts
import { loadBandNameDataset } from "@/lib/bandName/dataset";
import { parseInitialInput } from "@/lib/bandName/options";
import BandNameGenerator from "./BandNameGenerator";
```

함수 본문 교체 (기존 `export default async function ...` 블록):
```tsx
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BandNameGeneratorPage({ searchParams }: Props) {
  const dataset = await loadBandNameDataset();
  const initialInput = parseInitialInput(await searchParams);
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 page-fade-in">
      {/* (기존 nav/header 그대로 유지) */}
```
그리고 파일 하단의 `<BandNameGenerator dataset={dataset} />`를 다음으로 교체:
```tsx
      <BandNameGenerator dataset={dataset} initialInput={initialInput} />
```
(nav/header JSX 본문은 변경하지 않는다. `export const dynamic = "force-dynamic";`는 이미 존재하므로 유지.)

- [ ] **Step 3: `BandNameGenerator.tsx`가 `initialInput` 수용**

import에 `BandNameInput`이 이미 포함돼 있다(타입 import 블록 확인). 컴포넌트 시그니처와 초기 state 두 줄을 교체:

```tsx
export default function BandNameGenerator({
  dataset,
  initialInput,
}: {
  dataset: BandNameDataset;
  initialInput?: Partial<BandNameInput>;
}) {
  const [scene, setScene] = useState<Scene>(initialInput?.scene ?? defaultInput.scene);
  const [mood, setMood] = useState<Mood>(initialInput?.mood ?? defaultInput.mood);
  const [language, setLanguage] = useState<LanguageStyle>(defaultInput.language);
  const [weirdness, setWeirdness] = useState<Weirdness>(defaultInput.weirdness);
```
(나머지 state/로직/JSX는 변경하지 않는다.)

- [ ] **Step 4: 기존 생성기 테스트 회귀 확인**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/bandName/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` (기존 테스트 전부 통과 — options 변경이 깨뜨리지 않음).

- [ ] **Step 5: 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/bandName src/app/playground/band-name-generator
sudo -u ec2-user git add src/lib/bandName/options.ts src/app/playground/band-name-generator/page.tsx src/app/playground/band-name-generator/BandNameGenerator.tsx
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(band-name): accept scene/mood from query for MBTI casting handoff"
```

---

## Task 10: 진입 카드 (playground 레지스트리)

**Files:**
- Modify: `src/lib/playground.ts`

- [ ] **Step 1: `playgroundFeatures` 배열에 카드 추가**

`band-name-generator` 항목 **앞**(또는 배열 첫 항목 뒤)에 다음 객체를 추가한다. 위치는 `pedalboard-planner`와 `band-name-generator` 사이를 권장:

```ts
  {
    slug: "mbti-band-casting",
    title: "MBTI 밴드 캐스팅",
    description: "내 MBTI가 밴드 멤버가 된다면? 포지션부터 커버곡, 첫 장비까지 추천받아보세요.",
    cta: "캐스팅 시작하기",
    eyebrow: "이상한 도구",
    href: "/playground/mbti-band-casting",
  },
```

- [ ] **Step 2: 커밋**

```bash
chown -R ec2-user:ec2-user src/lib/playground.ts
sudo -u ec2-user git add src/lib/playground.ts
sudo -u ec2-user git -c user.name="yekong" -c user.email="pjuhe99@naver.com" commit -m "feat(playground): MBTI 밴드 캐스팅 진입 카드"
```

---

## Task 11: 전체 테스트 + 빌드 + DEV 배포 + 스모크

**Files:** (없음 — 검증/배포)

- [ ] **Step 1: mbtiCasting 전체 단위 테스트**

Run: `sudo -u ec2-user env PATH="$PATH" node --import tsx --test src/lib/mbtiCasting/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` (engine 5 + share 4 + nameGenLink 4 = 13 tests pass).

- [ ] **Step 2: lint**

Run: `sudo -u ec2-user env PATH="$PATH" pnpm lint 2>&1 | tail -20`
Expected: 신규 파일에 에러 없음 (경고만 허용).

- [ ] **Step 3: 프로덕션 빌드**

Run: `sudo -u ec2-user env PATH="$PATH" pnpm build 2>&1 | tail -30`
Expected: 빌드 성공. `/playground/mbti-band-casting`와 `/playground/mbti-band-casting/share/[data]` 라우트가 출력에 보임. (EACCES 발생 시 `chown -R ec2-user:ec2-user .next` 후 재시도.)

- [ ] **Step 4: PM2 dev 재시작**

Run: `sudo -u ec2-user pm2 restart bandsustain-dev 2>&1 | tail -5`
Expected: `bandsustain-dev` online.

- [ ] **Step 5: 공유 토큰 생성**

Run:
```bash
sudo -u ec2-user env PATH="$PATH" node --import tsx -e "import('./src/lib/mbtiCasting/share.ts').then(m=>console.log(m.encodeCasting({mbti:'ENFP',genre:'jRock',stagePreference:'spotlight',soundPreference:'voice',experience:'player',budget:'under1000'})))"
```
출력 토큰을 `TOKEN` 변수로 사용.

- [ ] **Step 6: HTTP 스모크 (포트 3101)**

Run (각 줄 200 기대):
```bash
TOKEN=$(sudo -u ec2-user env PATH="$PATH" node --import tsx -e "import('./src/lib/mbtiCasting/share.ts').then(m=>process.stdout.write(m.encodeCasting({mbti:'ENFP',genre:'jRock',stagePreference:'spotlight',soundPreference:'voice',experience:'player',budget:'under1000'})))")
curl -s -o /dev/null -w "casting %{http_code}\n" http://localhost:3101/playground/mbti-band-casting
curl -s -o /dev/null -w "share %{http_code}\n" "http://localhost:3101/playground/mbti-band-casting/share/$TOKEN"
curl -s -o /dev/null -w "og %{http_code} %{content_type}\n" "http://localhost:3101/playground/mbti-band-casting/share/$TOKEN/opengraph-image"
curl -s -o /dev/null -w "kakao %{http_code} %{content_type}\n" "http://localhost:3101/playground/mbti-band-casting/share/$TOKEN/kakao-image"
curl -s -o /dev/null -w "handoff %{http_code}\n" "http://localhost:3101/playground/band-name-generator?scene=citypop&mood=dreamy"
curl -s -o /dev/null -w "playground %{http_code}\n" http://localhost:3101/playground
curl -s -o /dev/null -w "bad-token %{http_code}\n" "http://localhost:3101/playground/mbti-band-casting/share/garbage"
```
Expected: `casting 200`, `share 200`, `og 200 image/png`, `kakao 200 image/png`, `handoff 200`, `playground 200`, `bad-token 200`(중립 폴백, 500 아님).

- [ ] **Step 7: dev 브랜치 push**

```bash
sudo -u ec2-user git push origin dev 2>&1 | tail -5
```

- [ ] **Step 8: ⛔ 멈춤 — 사용자 DEV 검증 요청**

사용자에게 보고: https://dev.bandsustain.com/playground/mbti-band-casting 검증 요청 + QA 체크리스트(아래) 결과. **운영(main) 반영은 사용자가 명시적으로 요청할 때만.**

---

## 수동 QA 체크리스트 (https://dev.bandsustain.com)

- [ ] 16개 MBTI 모두 선택 → 다음 단계로 자동 전환
- [ ] 7개 장르 모두 결과 생성
- [ ] 여러 조합에서 서로 다른 포지션 등장(보컬/리드/리듬/베이스/드럼/키보드)
- [ ] 결과에 커버곡 항상 3곡 / 장비 항상 3개
- [ ] "다시 캐스팅하기" → Step 1 초기화
- [ ] "이 캐릭터로 밴드 이름 만들기" → 생성기에서 장르 씬·무드 프리필 확인
- [ ] "결과 공유하기" → 링크 복사 / 카톡 / Web Share 동작, share 페이지·OG 이미지 정상
- [ ] 새로고침/뒤로가기에서 화면 깨짐 없음
- [ ] 모바일 폭 360px 가로 스크롤·텍스트 잘림 없음 (DevTools)
- [ ] 일본어/특수문자 곡명(夜に駆ける, ギミチョコ!! 등) 정상 표시
- [ ] 기존 밴드 이름 생성기: 파라미터 없이 진입 시 기본 동작 회귀 없음

---

## Self-Review 결과 (작성자 기록)

- **Spec 커버리지:** §1 목적→Task6 헤더 카피·면책. §3 파일구조→Task1~10. §4 마법사→Task6. §5 결과카드→Task6. §6 핸드오프→Task4+9. §7 공유→Task3+5+7+8. §8 진입CTA→Task10. §9 테스트→Task2,3,4 + Task11. §10 QA→Task11 체크리스트. §11 배포→Task11. 모든 spec 섹션에 대응 task 존재.
- **타입 일관성:** `BandCastingInput`(engine.ts, 필드 `stagePreference`/`soundPreference`)이 share.ts/MbtiBandCasting/CastingShareSheet/shareImage/share page 전체에서 동일하게 사용. `recommendBandCasting`/`encodeCasting`/`decodeCasting`/`buildNameGenQuery`/`renderCastingImage` 시그니처 일치. `parseInitialInput`(options.ts)→`initialInput: Partial<BandNameInput>`(page.tsx→BandNameGenerator.tsx) 일치.
- **Placeholder:** 데이터 이식 task(1,2)는 명시된 원본 파일 경로에서 verbatim 복사 + import 교체만 — 실행 가능한 구체 지시. 그 외 모든 코드 step은 전체 코드 포함.
