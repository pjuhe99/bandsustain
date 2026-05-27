# MBTI 밴드 캐스팅 — 설계

**작성일:** 2026-05-27
**대상:** bandsustain (`dev.bandsustain.com` → `bandsustain.com`)
**기술 스택:** Next.js 16 App Router + TypeScript + Tailwind v4, `node:test`(`node --import tsx --test`로 실행), PM2(`bandsustain-dev` 포트 3101 / `bandsustain` 포트 3100).

## 1. 목적

사용자가 MBTI와 음악 취향을 고르면 "내가 밴드 멤버라면?"이라는 **밴드 캐릭터 발견 놀이**를 보여주는 신규 플레이그라운드 기능. 심리·적성 판정이 아니라 재미 콘텐츠이며, 결과 화면에 그 취지의 면책 문구를 유지한다. 결과의 Primary CTA는 기존 밴드 이름 생성기로 연결된다.

기능명: **MBTI 밴드 캐스팅** · 라우트: `/playground/mbti-band-casting`

## 2. 핵심 설계 원칙

- **신규 라우트만 추가** — 기존 기능 무수정 (예외: §6 생성기 핸드오프, 회귀 안전하게).
- **정적 TS 데이터** — DB·admin·마이그레이션 없음. 콘텐츠가 고정이므로 제공된 4개 `.ts` 파일을 `src/lib/mbtiCasting/`로 이식한다. (밴드 이름 생성기는 운영자 편집 때문에 DB지만, 이 콘텐츠는 편집 대상이 아니다.)
- **결정론 엔진** — `recommendBandCasting(input)`은 6개 입력만으로 결과 전체(포지션·곡·장비)를 결정론적으로 재생산한다. 공유는 이 성질을 이용해 6개 입력만 토큰에 담는다.
- **기존 디자인 시스템 재사용** — `--color-text/bg/accent/border` 토큰, `font-display`, pill/카드 스타일, `page-fade-in`/`bandname-pop`/`bandname-progress` 애니메이션.

## 3. 파일 구조

```
src/lib/mbtiCasting/
  types.ts        # PositionId/GenreId/MbtiId/StagePreferenceId/SoundPreferenceId/
                  #   ExperienceId/BudgetId, PositionScores, *Definition, MbtiProfile 등 모든 타입
  data.ts         # POSITIONS, GENRES, STAGE_PREFERENCES, SOUND_PREFERENCES,
                  #   EXPERIENCES, BUDGETS, MBTI_PROFILES, POSITION_PRIORITY,
                  #   getPositionTitle/getPositionDescription (mbtiBandData.ts 이식)
  songs.ts        # SONGS(35), DIFFICULTY_LABELS, EXPERIENCE_DIFFICULTY_PREFERENCE,
                  #   SongRecommendation/DifficultyId (bandMusicData.ts 이식)
  gear.ts         # GEAR_BUNDLES(30), GENRE_GEAR_TIPS, GEAR_NOTICE, getGearBundle,
                  #   GearItem/GearBundle (bandGearData.ts 이식)
  engine.ts       # recommendBandCasting + 내부 helper, BandCastingInput/BandCastingResult/
                  #   DisplaySong (bandRecommendationEngine.ts 이식)
  share.ts        # encodeCasting/decodeCasting (6개 입력 ↔ base64url 토큰) + 검증
  nameGenLink.ts  # GENRE_TO_SCENE, MOOD_TAG_TO_MOOD, buildNameGenQuery
  shareImage.tsx  # next/og 결과 이미지 렌더러 (og 1200×630 / kakao 1200×1200)
  engine.test.ts
  share.test.ts
  nameGenLink.test.ts

src/app/playground/mbti-band-casting/
  page.tsx                          # 서버: metadata + 헤더(진입 카피) + <MbtiBandCasting/>
  MbtiBandCasting.tsx               # 클라이언트: 5스텝 마법사 + 결과 카드 (CastingShareSheet 호출)
  CastingShareSheet.tsx             # 공유 시트 (카톡/링크복사/Web Share) — BandNameShareSheet 거울
  share/[data]/page.tsx             # 토큰 디코드 → 엔진 재계산 → 결과 요약 + OG metadata
  share/[data]/opengraph-image.tsx  # 1200×630
  share/[data]/kakao-image/route.ts # 1200×1200

수정:
  src/lib/playground.ts                              # playgroundFeatures 카드 1개 추가
  src/app/playground/band-name-generator/page.tsx    # searchParams 읽어 initialInput 전달
  src/app/playground/band-name-generator/BandNameGenerator.tsx  # initialInput prop 수용
```

데이터 이식 시 추천 데이터(점수·곡·장비)와 핵심 로직(점수 합산·tie-break·곡/장비 선택)은 원본 그대로 유지하고, import 경로/파일 분리만 위 구조에 맞춘다.

## 4. 마법사 UI (`MbtiBandCasting.tsx`, client)

모바일 우선 중앙 카드. 상단 `n / 5` 텍스트 + progress bar, **이전** 버튼 제공.

| Step | 질문 | 선택지 | 진행 |
|---|---|---|---|
| 1 | 당신의 MBTI는 무엇인가요? | MBTI 16버튼 그리드 | 선택 시 자동 다음 |
| 2 | 어떤 무대의 사운드가 끌리나요? | 장르 7 (단일) | 선택 시 자동 다음 |
| 3 | (무대에서 끌리는 순간) | STAGE_PREFERENCES 5 (단일) | 선택 시 자동 다음 |
| 4 | (좋아하는 소리) | SOUND_PREFERENCES 5 (단일) | 선택 시 자동 다음 |
| 5 | 연주 경험 + 예산 | EXPERIENCES 3 + BUDGETS 5 | 둘 다 선택 → `내 밴드 캐릭터 보기` |

- Step 1~4는 단일 선택이므로 선택 즉시 다음 단계로 자동 전환. 오선택은 **이전** 버튼으로 복귀해 재선택.
- Step 5는 두 항목 모두 선택해야 `내 밴드 캐릭터 보기` 버튼이 활성화된다.
- 버튼 클릭 시 짧은 "캐스팅 중…" 연출(`bandname-progress` 재사용, ~1.2s) 후 같은 화면 하단에 결과를 `page-fade-in`/`bandname-pop`으로 노출.
- 선택 옵션은 명확한 active 상태(기존 pill/카드 active 스타일). 모바일 터치 영역 충분히 확보, 긴 텍스트 줄바꿈/반응형(`break-keep [overflow-wrap:anywhere]`).
- 새로고침/뒤로가기에서 화면이 깨지지 않도록 마법사 상태는 컴포넌트 로컬 state로만 관리(URL 동기화 없음). `다시 캐스팅하기`는 입력을 초기화하고 Step 1로 되돌린다.

## 5. 결과 카드 (세로형, 스크린샷 친화)

표시 순서:
1. 선택한 MBTI + 장르 뱃지
2. 메인 포지션 아이콘 + 라벨
3. 결과 타이틀 `getPositionTitle(profile, primary)`
4. 캐릭터 설명 `getPositionDescription` (2~3문장)
5. 어울리는 키워드 태그 3개 (`moodTags`)
6. `함께 잘 맞는 포지션`: 2순위 포지션을 작게
7. 추천 커버곡 3곡 — 곡명/아티스트, 추천 이유 1문장, 커버 난이도 뱃지(`DIFFICULTY_LABELS`)
8. 첫 장비 3개 — 분류, 장비명, 역할/이유 + 장르 팁(`GENRE_GEAR_TIPS`) + `GEAR_NOTICE` 안내(가격/재고 단정 금지)
9. 면책 문구: `MBTI는 재미를 위한 힌트로만 활용했어요. 실제 포지션은 좋아하는 소리와 연주 경험에 따라 달라질 수 있어요.`
10. CTA — Primary(accent) **이 캐릭터로 밴드 이름 만들기** / Secondary **다시 캐스팅하기** / **결과 공유하기**(시트)

문체: 단정적 적성 판정 금지, 친근한 음악 세계관 문구.

## 6. 생성기 연동 (장르→씬 + 무드 best-effort)

`nameGenLink.ts`:

**GENRE_TO_SCENE** (모든 장르 → 유효 씬):

| MBTI 장르 | 생성기 씬 |
|---|---|
| jPop | jrock |
| jRock | jrock |
| popPunk | punk |
| alternative | emo |
| indieRock | hongdae |
| cityPop | citypop |
| metalHeavyRock | metal |

**MOOD_TAG_TO_MOOD**: MBTI `moodTags`(자유 한글, 예: "청춘"·"새벽"·"폭발")를 생성기 6-enum(`fresh/dreamy/wistful/funny/rough/romantic`)에 큐레이션 매핑하는 테이블. `buildNameGenQuery(genre, moodTags)`는 결과 `moodTags`를 순회해 **첫 매칭 mood**를 채택하고, 매칭이 하나도 없으면 `mood`를 생략한다(생성기 기본값 사용). 반환값은 `?scene=…&mood=…`(또는 `?scene=…`) 쿼리스트링.

**생성기 수정 (회귀 안전):**
- `band-name-generator/page.tsx`(이미 `export const dynamic = "force-dynamic"`)가 `searchParams`를 받아 `scene`/`mood`를 각각 `sceneOptions`/`moodOptions` 값과 대조 검증한 뒤, 유효한 것만 모아 `initialInput`(부분 override) prop으로 `BandNameGenerator`에 전달.
- `BandNameGenerator`는 `initialInput?: Partial<BandNameInput>`을 받아 초기 state 계산 시 `defaultInput`에 머지. prop이 없으면 **기존 동작 그대로**.
- `useSearchParams` 훅을 쓰지 않으므로 클라이언트 Suspense 경계 불필요.

## 7. 공유 (풀 패리티)

- `share.ts`:
  - `encodeCasting(input)` → `[mbti, genre, stage, sound, experience, budget]` JSON → base64url(`+/=`를 `-_` 치환·패딩 제거; 밴드 이름 `share.ts`와 동일 헬퍼 방식).
  - `decodeCasting(token)` → 6개 값을 각각 알려진 집합(`MBTI_PROFILES` 키, `GENRES` 키, `STAGE_PREFERENCES`/`SOUND_PREFERENCES` id, `EXPERIENCES`/`BUDGETS` id)과 대조 검증. 하나라도 불일치/파싱 실패 시 `null`.
- `share/[data]/page.tsx`: 디코드 → `recommendBandCasting()` 재계산 → 캐릭터 요약(타이틀·포지션·뱃지·무드·커버곡 3곡 압축 표시) + `직접 캐스팅하기`/`이름 만들기` CTA. `generateMetadata`로 title/description/canonical/openGraph/twitter. 디코드 실패 시 중립 안내 + 캐스팅 시작 링크.
- `opengraph-image.tsx`(`size = OG_SIZE`, runtime nodejs) + `kakao-image/route.ts`(1200×1200): 둘 다 `shareImage.tsx`의 `renderShareImage(decodeCasting(data), variant)` 호출. 렌더 내용 = eyebrow(`MBTI 밴드 캐스팅`) + MBTI·장르 + 결과 타이틀 + 포지션 라벨 + 무드 태그. **Pretendard-Bold.otf**(이미 `public/fonts/`에 번들) 사용 — satori는 정적 OTF만 허용. 디코드 실패는 helper가 중립 카드로 폴백(500 방지).
- `CastingShareSheet.tsx`: `BandNameShareSheet` 거울. 토큰으로 share URL 구성 → 카톡 feed(`title`=결과 타이틀, `description`=`장르 · 포지션 · MBTI 밴드 캐스팅`, `imageUrl`=kakao-image, `link`=share 페이지) / 링크 복사 / `navigator.share`(가능 시). Kakao SDK는 기존 `layout.tsx`의 `KakaoSdk`로 전역 초기화되어 있어 추가 셋업 불필요.

## 8. 진입 CTA

`src/lib/playground.ts`의 `playgroundFeatures` 배열에 카드 추가:
```ts
{
  slug: "mbti-band-casting",
  title: "MBTI 밴드 캐스팅",
  description: "내 MBTI가 밴드 멤버가 된다면? 포지션부터 커버곡, 첫 장비까지 추천받아보세요.",
  cta: "캐스팅 시작하기",
  eyebrow: "이상한 도구",
  href: "/playground/mbti-band-casting",
}
```
캐스팅 페이지 헤더에 프롬프트 카피(`내 MBTI가 밴드 멤버가 된다면?` / `포지션부터 커버곡, 첫 장비까지 추천받아보세요.`). 밴드 이름 생성기 페이지는 수정하지 않는다(레지스트리 카드로 충분).

## 9. 테스트 (`node --import tsx --test src/lib/mbtiCasting/*.test.ts`)

- `engine.test.ts`:
  - 16개 MBTI 각각 유효 결과 생성(throw 없음, 곡 3·장비 3).
  - 7개 장르 각각 유효 결과.
  - 결정론: 동일 입력 → 동일 출력(포지션·곡 id·장비 동일).
  - 커버리지: 6개 포지션 각각이 **어떤 입력 조합에서는 메인 포지션으로 등장**한다.
  - 곡 항상 정확히 3개, 장비 항상 정확히 3개.
  - tie-break 안정성: 동점 시 `POSITION_PRIORITY` 우선순위로 고정.
- `share.test.ts`: encode→decode round-trip 일치 / 깨진 토큰 → null / enum 변조 토큰 → null / 길이 다른 배열 → null.
- `nameGenLink.test.ts`: 7개 장르 모두 유효 씬(`sceneOptions` 값)으로 매핑 / `buildNameGenQuery`의 mood는 항상 유효(`moodOptions` 값)하거나 생략 / 매핑 없는 moodTags 입력 시 `scene`만 반환.

## 10. 수동 QA (dev, https://dev.bandsustain.com)

프롬프트 §9 체크리스트:
- 16개 MBTI 모두 선택 가능 / 7개 장르 모두 결과 생성
- 모든 포지션이 특정 조합에서 결과로 등장
- 추천 곡 항상 3곡 / 장비 항상 3개
- 다시 시작 시 입력 초기화
- 생성기 이동 시 선택 장르·무드 전달 확인 (씬/무드 프리필)
- 새로고침/뒤로가기에서 화면 정상
- 모바일 폭 360px 가로 스크롤·텍스트 잘림 없음
- 일본어/특수문자 곡명 정상 표시(UTF-8 + 폰트 fallback)
- 기존 밴드 이름 생성 기능 회귀 없음 (파라미터 없을 때 기본 동작 유지)

## 11. 배포 플로우 (메모리 규칙 준수)

1. `bandsustain-dev`(dev 브랜치)에서만 구현 → commit → push origin dev
2. `pnpm build` → `pm2 restart bandsustain-dev`
3. https://dev.bandsustain.com 에서 사용자 검증
4. ⛔ **여기서 멈춤.** 운영 반영은 사용자가 명시적으로 요청한 경우에만:
   dev에서 checkout main → merge dev → push origin main → checkout dev →
   `bandsustain`(운영)에서 git pull → pnpm install(필요시) → pnpm build → pm2 restart bandsustain
   (※ `ecosystem.config.js`는 `--skip-worktree`, DB 변경 없음.)

## 12. 범위 밖 (Non-goals)

- 곡 스트리밍/음원 재생 링크, 장비 실판매 가격·재고·구매 링크.
- MBTI 데이터의 운영자 편집 UI(admin) — 정적 콘텐츠로 충분.
- 결과 이력 저장/계정 연동.
