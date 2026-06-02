# 합주실 추천 (Rehearsal Finder) 설계문서

**날짜:** 2026-06-02
**위치:** bandsustain.com `/playground/rehearsal-finder` (dev 전용 노출)
**상태:** 설계 합의 완료 (브레인스토밍 + 미확인 2건 확정)

## 1. 목적

밴드 멤버 최대 10명이 각자 출발 위치를 입력하면, 이동시간·가격·수용인원·장비를 고려해
합주실 추천 순위를 보여주는 기능. `/playground` 허브에 신규 도구로 추가한다.

## 2. 합의된 설계 결정

1. **테이블 네이밍:** `playground_` 프리픽스 (7개 전부). 기존 playground 카탈로그 테이블과 일관.
2. **관리 입력:** `/admin/(authed)/rehearsal-studios` 인증 CRUD 화면 (quotes server-actions 패턴).
3. **노출 범위:** dev 에만. `/playground/rehearsal-finder` URL + dev 허브 카드.
   - 게이팅: `ecosystem.config.js`(DEV-only, git `--skip-worktree`)에 `REHEARSAL_FINDER_ENABLED="1"` env 추가.
     PROD ecosystem 에는 이 플래그가 없으므로 main 머지되어도 PROD에서 카드/라우트가 숨겨짐.
4. **equipment_type:** DB ENUM 대신 **VARCHAR(32) + 앱레벨 검증**(TS union + Zod enum). 장비 종류 추가 시 마이그레이션 불필요.
5. **모듈 배치:** `src/lib/playground/rehearsal/` 전용 하위 디렉토리.

## 3. 작업 환경 (MEMORY bandsustain 규칙 준수)

- 코드는 `bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만.
- DB 수정은 `bandsustain-dev`의 `.db_credentials`로 DEV DB 먼저.
- **dev push 후 멈춤.** main 머지(운영 반영)는 사용자가 명시 요청 시에만.
- DB 마이그레이션 실행: `set -a; source <DEV site>/.db_credentials; set +a` 후
  `mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < db/schema/019_rehearsal_finder.sql`.

## 4. 스택 (탐색 확인됨)

- Next.js 16 App Router + TS + raw `mysql2`(ORM 없음) + Tailwind v4 + Zod ^4.
- DB: `src/lib/db.ts`(`getPool()`), 자격증명 `src/lib/creds.ts`(`loadCreds()`, `DB_CREDENTIALS_PATH` env).
- 마이그레이션: `db/schema/NNN_*.sql` 수동 실행 (현재 018까지 → 신규 `019`). 시드 `db/seed/`, `scripts/*.ts`(tsx).
- 테스트: `node:test` + `node:assert/strict`, 실행 `npx tsx --test <file>` (package.json test 스크립트 없음).
- 인증: `readSession()` (`src/lib/auth.ts`). admin server actions = `"use server"` + `requireAuth()` + Zod + `getPool().query` + `revalidatePath`/`redirect`.
- 디자인: Tailwind v4 `@theme` + CSS 변수(`--color-*`), `buttonClasses()`(`src/components/Button.tsx`).

## 5. 파일 구조

```
db/schema/019_rehearsal_finder.sql        # 7 테이블
db/seed/rehearsal_regions.sql             # 서울25구 + 경기 주요시 (지역 마스터)
scripts/seed-rehearsal.ts                 # tsx 멱등 (지역 + mock 합주실 + 장비)
src/lib/playground/rehearsal/
  types.ts            # TS union/타입 + Zod enum (transport, origin_type, provider, time_bucket, equipment)
  config.ts           # 가중치/임계값 (PREFILTER_LIMIT=15, FINAL_LIMIT=5, 점수 가중치)
  geo.ts              # haversine / centroid / 좌표반올림 (순수)
  scoring.ts          # scoreStudioForGroup (순수, 점수식 본체)
  reason.ts           # generateRecommendationReason (규칙기반 한국어, 순수)
  route-provider.ts   # RouteProvider 인터페이스 + MockRouteProvider + Transit/Car 골격(TODO)
  route-cache.ts      # 캐시 키 생성 + read-through (DB)
  regions.ts          # 지역 조회 (DB)
  studios.ts          # 합주실 조회/필터 (DB)
  recommend.ts        # recommendStudios 오케스트레이션 (DB + 순수 조합)
  geo.test.ts scoring.test.ts reason.test.ts route-provider.test.ts recommend.test.ts
src/app/api/playground/rehearsal/studios/route.ts     # GET 목록(검수용)
src/app/api/playground/rehearsal/recommend/route.ts   # POST 추천
src/app/admin/(authed)/rehearsal-studios/
  page.tsx new/page.tsx [id]/page.tsx actions.ts       # 인증 CRUD (장비 반복행, 저장시 replace)
src/components/admin/RehearsalStudioForm.tsx           # 합주실 입력 폼 (장비 동적 행)
src/app/playground/rehearsal-finder/page.tsx           # 서버: dev 게이트 + 메타
src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx  # 클라 폼/결과
src/lib/playground.ts                                  # 허브 카드 등록 (dev 게이트)
```

## 6. 7 테이블 (playground_ 프리픽스, snake_case, status 등 DB ENUM, equipment_type만 VARCHAR)

1. **playground_regions** — province/city/district/display_name/is_supported/sort_order
2. **playground_studios** — name/slug UNIQUE/region_id FK/area_label/lat·lng/nearest_station(+거리)/
   hourly_price_min·max/min·max_capacity/has_parking·parking_note/
   `status ENUM('candidate','approved','hidden','closed')`/source_note/verified_at
3. **playground_studio_equipment** — studio_id FK/`equipment_type VARCHAR(32)`/equipment_name/quantity/note
4. **playground_rehearsal_searches** — member_count/transport_mode/max_budget_per_hour/
   required_equipment_json/preferred_region_ids_json/search_status
5. **playground_rehearsal_search_members** — search_id FK/nickname/origin_text/origin_lat·lng(nullable)/origin_type/transport_mode
6. **playground_route_cache** — origin_key/좌표/destination_id/transport_mode/time_bucket/
   travel_minutes/transfer_count/walking_minutes/fare/distance_meters/provider/raw_response_json/expires_at
   + UNIQUE(origin_key, destination_id, transport_mode, time_bucket)
7. **playground_studio_recommendation_results** — search_id/studio_id/rank/score +
   avg·max·min·spread·transfer·walking + price/equipment/capacity/fairness_score + recommendation_reason + raw_score_json

## 7. 앱레벨 enum 상수 (`types.ts`)

- **transport_mode:** `transit` | `car` | `mixed`
- **origin_type:** `station` | `address` | `district` | `manual`
- **provider:** `mock` | `kakao` | `odsay` | `tmap` | `manual`
- **time_bucket:** `weekday_day` | `weekday_evening` | `weekday_night` | `weekend_day` | `weekend_night` | `unknown`
- **equipment_type** (12종): `DRUM_SET` `GUITAR_AMP` `BASS_AMP` `KEYBOARD` `MIC` `PA_SYSTEM` `MIXER` `CYMBAL` `DOUBLE_PEDAL` `PEDAL_BOARD` `STAND` `OTHER`
- **studio status** (DB ENUM): `candidate` | `approved` | `hidden` | `closed`

## 8. 추천 흐름 (`recommendStudios`)

1. Zod 검증 → **좌표 없는 멤버 있으면 즉시 에러** (geocode는 이번 범위 밖, 좌표는 입력 필수).
2. search + members 저장 (`search_status='pending'`).
3. `getCandidateStudios()` — status='approved' AND 좌표 有.
4. `filterStudiosByConditions()` — capacity≥인원, price_min≤예산, 필수장비 보유, preferred_region 일치(지정 시).
5. **prefilter** — 멤버 중심점(centroid) 직선거리 상위 `PREFILTER_LIMIT(15)`.
6. `getOrCalculateRoutes()` — **route_cache 먼저 → 없으면 MockRouteProvider 계산 후 캐시 저장**.
7. `scoreStudioForGroup()` (순수, **낮을수록 좋음**):
   `avg + 0.7*(max-avg) + 4*avgTransfer + 0.15*avgWalk + price/capacity/equipment penalty`.
8. 정렬 → 상위 `FINAL_LIMIT(5)` → `generateRecommendationReason()`.
9. results 저장 (raw_score_json) + `search_status='completed'` + member_routes 응답.

- **MockRouteProvider:** 직선거리 기반. transit=낮은 속도 + 임시 transfer 추정, car=높은 속도.

## 9. API / UI

- `GET /api/playground/rehearsal/studios` — 목록 검수 (region_id/status/keyword/equipment_type 필터).
- `POST /api/playground/rehearsal/recommend` — 추천 JSON 입출력 (§8).
- 합주실 CRUD = admin server actions (장비 폼 반복행, 저장 시 equipment replace).
- 추천 테스트 UI = `/playground/rehearsal-finder` 클라 컴포넌트
  (멤버1~10/이동수단/예산/필수장비 → 순위·이름·지역·주소·평균/최대 이동·멤버별 이동·가격·장비 충족·이유·지도/예약 링크).

## 10. 기타 (개인정보 / 확장)

- 외부 API: route-provider 에 Transit/CarRouteProvider 골격 + `// TODO: ODsay/TMAP/Kakao`,
  키는 env/creds 자리만, `geocode()` 인터페이스 자리(이번엔 미구현).
- 개인정보: 상세주소 저장 지양. 멤버는 origin_text + 좌표 + origin_type 만.
- 점수식 튜닝 지점 = `scoring.ts` + `config.ts`.
- 테스트: node:test 순수함수 (scoring 편차감점/예산 penalty, geo, reason, route-provider mock 거리→시간,
  recommend 주입형 mock + 필터/prefilter/랭킹).
