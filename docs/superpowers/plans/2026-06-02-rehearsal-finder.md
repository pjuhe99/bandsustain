# 합주실 추천 (Rehearsal Finder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bandsustain.com `/playground/rehearsal-finder`(dev 전용)에 멤버 출발지 기반 합주실 추천 기능을 구축한다 — 이동시간·가격·인원·장비를 점수화해 순위를 보여준다.

**Architecture:** 순수 도메인 로직(geo/scoring/reason/route-provider/ranker)을 `src/lib/playground/rehearsal/`에 모으고 node:test로 단위검증한다. DB는 raw mysql2(`getPool()`) + 수동 마이그레이션(`019`). 이동시간은 `route_cache` read-through + `MockRouteProvider`(직선거리 기반)로 계산하며 실 제공자(ODsay/TMAP)는 인터페이스 골격만 둔다. 관리 입력은 admin server-actions CRUD, 노출은 `ecosystem.config.js`(DEV-only) env 플래그로 게이팅한다.

**Tech Stack:** Next.js 16 App Router · TypeScript · mysql2(raw) · Zod 4 · Tailwind v4 · node:test(`npx tsx --test`).

**작업 규칙 (MEMORY bandsustain 섹션):** `bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만 작업. DB는 DEV 먼저. **모든 git/build 는 `sudo -u ec2-user`.** dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크)는 절대 `git add .` 금지(파일 명시 커밋).

**테스트 실행:** `cd <repo>` 후 `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/<file>.test.ts`. (package.json 에 test 스크립트 없음 — 항상 파일 경로 직접 지정.)

**DEV DB 자격증명 로드(마이그/시드용):**
```bash
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
```

---

## File Structure

| 파일 | 책임 |
|------|------|
| `db/schema/019_rehearsal_finder.sql` | 7개 테이블 정의 (멱등 CREATE) |
| `db/seed/rehearsal_regions.sql` | 지역 마스터(서울25구+경기 주요시) 멱등 시드 |
| `scripts/seed-rehearsal.ts` | tsx 멱등 시드 (mock 합주실 + 장비) |
| `src/lib/playground/rehearsal/types.ts` | enum 상수(union)·Zod enum·도메인 타입 |
| `src/lib/playground/rehearsal/config.ts` | 가중치/임계값/TTL 상수 |
| `src/lib/playground/rehearsal/geo.ts` | haversine/centroid/좌표반올림 (순수) |
| `src/lib/playground/rehearsal/scoring.ts` | `scoreStudioForGroup` 점수식 (순수) |
| `src/lib/playground/rehearsal/reason.ts` | `generateRecommendationReason` (순수) |
| `src/lib/playground/rehearsal/ranker.ts` | `filterStudiosByConditions`/`prefilterByCentroid`/`rankStudios` (순수) |
| `src/lib/playground/rehearsal/route-provider.ts` | `RouteProvider` 인터페이스 + `MockRouteProvider` + 골격 |
| `src/lib/playground/rehearsal/route-cache.ts` | 캐시 키·read-through (DB) |
| `src/lib/playground/rehearsal/studios.ts` | 합주실 조회/장비 로드 (DB) |
| `src/lib/playground/rehearsal/regions.ts` | 지역 조회 (DB) |
| `src/lib/playground/rehearsal/recommend.ts` | `recommendStudios` 오케스트레이션 (DB+순수) |
| `src/app/api/playground/rehearsal/studios/route.ts` | GET 목록(검수) |
| `src/app/api/playground/rehearsal/recommend/route.ts` | POST 추천 |
| `src/app/admin/(authed)/rehearsal-studios/{page,new/page,[id]/page}.tsx`, `actions.ts` | 인증 CRUD |
| `src/components/admin/RehearsalStudioForm.tsx` | 합주실 입력 폼(장비 동적 행) |
| `src/app/playground/rehearsal-finder/{page,RehearsalFinderClient}.tsx` | dev 게이트 + 추천 UI |
| `src/lib/playground/rehearsalFlag.ts` | dev 노출 게이트 헬퍼 |
| `src/lib/playground.ts` (modify) | 허브 카드 등록(게이트) |
| `ecosystem.config.js` (modify, DEV-only) | `REHEARSAL_FINDER_ENABLED="1"` env |

---

## Task 1: DB 마이그레이션 (019) — 7 테이블

**Files:**
- Create: `db/schema/019_rehearsal_finder.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 019_rehearsal_finder.sql
-- bandsustain.com /playground/rehearsal-finder — 합주실 추천
-- 멤버 출발지 기반 이동시간/가격/인원/장비 점수화. dev 전용 노출.
-- 수동 실행: set -a; source <DEV site>/.db_credentials; set +a
--   mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < db/schema/019_rehearsal_finder.sql
-- equipment_type 은 DB ENUM 대신 VARCHAR(32) + 앱레벨(TS union+Zod enum) 검증.

-- ── 지역 마스터 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_regions (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  province      VARCHAR(40)   NOT NULL,          -- 서울특별시 / 경기도
  city          VARCHAR(40)   NULL,              -- 경기 시 단위 (서울은 NULL)
  district      VARCHAR(40)   NULL,              -- 구 (구 없는 시는 NULL)
  display_name  VARCHAR(80)   NOT NULL,          -- 노출용 (예: 서울 마포구)
  is_supported  TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order    INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_region_name (display_name),
  KEY idx_region_supported_sort (is_supported, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 합주실 ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_studios (
  id                    INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(160)  NOT NULL,
  slug                  VARCHAR(180)  NOT NULL,
  region_id             INT UNSIGNED  NULL,
  area_label            VARCHAR(120)  NULL,       -- "서울 마포구 합정동" 등 (상세주소 지양)
  lat                   DECIMAL(10,7) NULL,
  lng                   DECIMAL(10,7) NULL,
  nearest_station       VARCHAR(80)   NULL,
  nearest_station_meters INT UNSIGNED NULL,
  hourly_price_min      INT UNSIGNED  NULL,
  hourly_price_max      INT UNSIGNED  NULL,
  min_capacity          INT UNSIGNED  NULL,
  max_capacity          INT UNSIGNED  NULL,
  has_parking           TINYINT(1)    NOT NULL DEFAULT 0,
  parking_note          VARCHAR(200)  NULL,
  status                ENUM('candidate','approved','hidden','closed') NOT NULL DEFAULT 'candidate',
  source_note           VARCHAR(255)  NULL,
  booking_url           VARCHAR(255)  NULL,
  map_url               VARCHAR(255)  NULL,
  verified_at           TIMESTAMP     NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_studio_slug (slug),
  KEY idx_studio_status (status),
  KEY idx_studio_region (region_id),
  CONSTRAINT fk_studio_region FOREIGN KEY (region_id) REFERENCES playground_regions(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 합주실 장비 (equipment_type = VARCHAR, 앱검증) ────────────────────────
CREATE TABLE IF NOT EXISTS playground_studio_equipment (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  studio_id      INT UNSIGNED    NOT NULL,
  equipment_type VARCHAR(32)     NOT NULL,        -- 앱레벨 EquipmentType union
  equipment_name VARCHAR(120)    NULL,
  quantity       INT UNSIGNED    NOT NULL DEFAULT 1,
  note           VARCHAR(200)    NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_equip_studio (studio_id),
  KEY idx_equip_type (equipment_type),
  CONSTRAINT fk_equip_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 추천 검색 (1회 요청) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_rehearsal_searches (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_count             INT UNSIGNED    NOT NULL,
  transport_mode           ENUM('transit','car','mixed') NOT NULL DEFAULT 'transit',
  max_budget_per_hour      INT UNSIGNED    NULL,
  required_equipment_json  JSON            NULL,
  preferred_region_ids_json JSON           NULL,
  search_status            ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  error_note               VARCHAR(255)    NULL,
  created_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_search_status_created (search_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 검색 멤버 (출발지) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_rehearsal_search_members (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  search_id      BIGINT UNSIGNED NOT NULL,
  nickname       VARCHAR(40)     NOT NULL,
  origin_text    VARCHAR(160)    NOT NULL,
  origin_lat     DECIMAL(10,7)   NULL,
  origin_lng     DECIMAL(10,7)   NULL,
  origin_type    ENUM('station','address','district','manual') NOT NULL DEFAULT 'manual',
  transport_mode ENUM('transit','car','mixed') NOT NULL DEFAULT 'transit',
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_search_member (search_id),
  CONSTRAINT fk_search_member FOREIGN KEY (search_id) REFERENCES playground_rehearsal_searches(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 경로 캐시 (read-through) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_route_cache (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_key        VARCHAR(40)     NOT NULL,     -- "lat,lng" 반올림 좌표
  origin_lat        DECIMAL(10,7)   NOT NULL,
  origin_lng        DECIMAL(10,7)   NOT NULL,
  destination_id    INT UNSIGNED    NOT NULL,     -- playground_studios.id
  transport_mode    ENUM('transit','car','mixed') NOT NULL,
  time_bucket       ENUM('weekday_day','weekday_evening','weekday_night','weekend_day','weekend_night','unknown') NOT NULL DEFAULT 'unknown',
  travel_minutes    INT UNSIGNED    NOT NULL,
  transfer_count    INT UNSIGNED    NOT NULL DEFAULT 0,
  walking_minutes   INT UNSIGNED    NOT NULL DEFAULT 0,
  fare              INT UNSIGNED    NULL,
  distance_meters   INT UNSIGNED    NOT NULL DEFAULT 0,
  provider          ENUM('mock','kakao','odsay','tmap','manual') NOT NULL DEFAULT 'mock',
  raw_response_json JSON            NULL,
  expires_at        TIMESTAMP       NOT NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_cache (origin_key, destination_id, transport_mode, time_bucket),
  KEY idx_route_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 추천 결과 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_studio_recommendation_results (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  search_id             BIGINT UNSIGNED NOT NULL,
  studio_id             INT UNSIGNED    NOT NULL,
  rank_no               INT UNSIGNED    NOT NULL,
  score                 DECIMAL(10,3)   NOT NULL,
  avg_minutes           DECIMAL(8,2)    NOT NULL,
  max_minutes           DECIMAL(8,2)    NOT NULL,
  min_minutes           DECIMAL(8,2)    NOT NULL,
  spread_minutes        DECIMAL(8,2)    NOT NULL,
  avg_transfer          DECIMAL(6,2)    NOT NULL,
  avg_walking           DECIMAL(6,2)    NOT NULL,
  price_penalty         DECIMAL(8,2)    NOT NULL DEFAULT 0,
  capacity_penalty      DECIMAL(8,2)    NOT NULL DEFAULT 0,
  equipment_penalty     DECIMAL(8,2)    NOT NULL DEFAULT 0,
  fairness_score        DECIMAL(8,2)    NOT NULL DEFAULT 0,
  recommendation_reason VARCHAR(400)    NULL,
  raw_score_json        JSON            NULL,
  created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_result_search_rank (search_id, rank_no),
  CONSTRAINT fk_result_search FOREIGN KEY (search_id) REFERENCES playground_rehearsal_searches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_result_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> 주의: `rank` 은 MySQL 8 예약어 → 컬럼명 `rank_no` 사용. MariaDB 10.5 에선 `rank` 도 가능하나 안전하게 회피.

- [ ] **Step 2: DEV DB에 적용**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/019_rehearsal_finder.sql
```
Expected: 에러 없이 종료 (재실행해도 IF NOT EXISTS 로 멱등).

- [ ] **Step 3: 테이블 생성 검증**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'playground_re%'; SHOW TABLES LIKE 'playground_studio%'; SHOW TABLES LIKE 'playground_route%';"
```
Expected: `playground_regions`, `playground_studios`, `playground_studio_equipment`, `playground_rehearsal_searches`, `playground_rehearsal_search_members`, `playground_route_cache`, `playground_studio_recommendation_results` 7개 모두 표시.

- [ ] **Step 4: Commit**

```bash
sudo -u ec2-user git add db/schema/019_rehearsal_finder.sql docs/superpowers/specs/2026-06-02-rehearsal-finder-design.md docs/superpowers/plans/2026-06-02-rehearsal-finder.md
sudo -u ec2-user git commit -m "feat(rehearsal): add 019 schema + design/plan docs"
```

---

## Task 2: 타입·상수 (`types.ts`, `config.ts`)

**Files:**
- Create: `src/lib/playground/rehearsal/types.ts`
- Create: `src/lib/playground/rehearsal/config.ts`

- [ ] **Step 1: `types.ts` 작성**

```typescript
import { z } from "zod";

export const TRANSPORT_MODES = ["transit", "car", "mixed"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const ORIGIN_TYPES = ["station", "address", "district", "manual"] as const;
export type OriginType = (typeof ORIGIN_TYPES)[number];

export const ROUTE_PROVIDERS = ["mock", "kakao", "odsay", "tmap", "manual"] as const;
export type RouteProviderName = (typeof ROUTE_PROVIDERS)[number];

export const TIME_BUCKETS = [
  "weekday_day", "weekday_evening", "weekday_night",
  "weekend_day", "weekend_night", "unknown",
] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

export const EQUIPMENT_TYPES = [
  "DRUM_SET", "GUITAR_AMP", "BASS_AMP", "KEYBOARD", "MIC", "PA_SYSTEM",
  "MIXER", "CYMBAL", "DOUBLE_PEDAL", "PEDAL_BOARD", "STAND", "OTHER",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const STUDIO_STATUSES = ["candidate", "approved", "hidden", "closed"] as const;
export type StudioStatus = (typeof STUDIO_STATUSES)[number];

// 한국어 라벨 (UI/관리 폼 공용)
export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  DRUM_SET: "드럼셋", GUITAR_AMP: "기타 앰프", BASS_AMP: "베이스 앰프",
  KEYBOARD: "키보드", MIC: "마이크", PA_SYSTEM: "PA 시스템", MIXER: "믹서",
  CYMBAL: "심벌", DOUBLE_PEDAL: "더블 페달", PEDAL_BOARD: "페달보드",
  STAND: "스탠드", OTHER: "기타",
};

// Zod enums (tuple 캐스팅 — z.enum 은 non-empty 튜플 요구)
export const transportModeEnum = z.enum(TRANSPORT_MODES as unknown as [TransportMode, ...TransportMode[]]);
export const originTypeEnum = z.enum(ORIGIN_TYPES as unknown as [OriginType, ...OriginType[]]);
export const equipmentTypeEnum = z.enum(EQUIPMENT_TYPES as unknown as [EquipmentType, ...EquipmentType[]]);
export const studioStatusEnum = z.enum(STUDIO_STATUSES as unknown as [StudioStatus, ...StudioStatus[]]);

// ── 도메인 타입 ──────────────────────────────────────────────────────────
export type GeoPoint = { lat: number; lng: number };

export type StudioEquipment = {
  equipmentType: EquipmentType;
  equipmentName: string | null;
  quantity: number;
  note: string | null;
};

export type Studio = {
  id: number;
  name: string;
  slug: string;
  regionId: number | null;
  regionName: string | null;
  areaLabel: string | null;
  lat: number;
  lng: number;
  nearestStation: string | null;
  nearestStationMeters: number | null;
  hourlyPriceMin: number | null;
  hourlyPriceMax: number | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  hasParking: boolean;
  parkingNote: string | null;
  status: StudioStatus;
  sourceNote: string | null;
  bookingUrl: string | null;
  mapUrl: string | null;
  equipment: StudioEquipment[];
};

export type SearchMemberInput = {
  nickname: string;
  originText: string;
  originLat: number;
  originLng: number;
  originType: OriginType;
  transportMode: TransportMode;
};

export type RecommendInput = {
  transportMode: TransportMode;
  maxBudgetPerHour: number | null;
  requiredEquipment: EquipmentType[];
  preferredRegionIds: number[];
  members: SearchMemberInput[];
};

export type RouteResult = {
  travelMinutes: number;
  transferCount: number;
  walkingMinutes: number;
  fare: number | null;
  distanceMeters: number;
  provider: RouteProviderName;
};

export type MemberRoute = {
  nickname: string;
  route: RouteResult;
};
```

- [ ] **Step 2: `config.ts` 작성**

```typescript
// 추천 점수식 튜닝 지점. 모든 값 "낮을수록 좋음" 점수에 더해지는 분(minute)-환산.
export const PREFILTER_LIMIT = 15;   // 중심점 직선거리 상위 N개만 경로계산
export const FINAL_LIMIT = 5;        // 최종 추천 노출 개수

export const SCORING_WEIGHTS = {
  spread: 0.7,     // (max - avg) 이동시간 편차 가중
  transfer: 4,     // 평균 환승 1회당 분-환산
  walking: 0.15,   // 평균 도보 1분당 가중
} as const;

export const PRICE_PENALTY_PER_1000_OVER = 2; // 예산 초과 1000원당 분-환산
export const CAPACITY_PENALTY = 30;           // 수용인원 미달 시 고정 페널티
export const MISSING_EQUIPMENT_PENALTY = 50;  // 필수장비 1종 누락당 페널티

export const ROUTE_CACHE_TTL_HOURS = 24 * 7;  // 경로 캐시 7일
export const COORD_ROUNDING_DECIMALS = 3;     // 캐시 키 좌표 반올림(~110m 그리드)
```

- [ ] **Step 3: 타입 컴파일 확인**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i rehearsal || echo "no rehearsal type errors"
```
Expected: `no rehearsal type errors`.

- [ ] **Step 4: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/types.ts src/lib/playground/rehearsal/config.ts
sudo -u ec2-user git commit -m "feat(rehearsal): types + scoring config constants"
```

---

## Task 3: 지오 유틸 (`geo.ts`) — TDD

**Files:**
- Create: `src/lib/playground/rehearsal/geo.test.ts`
- Create: `src/lib/playground/rehearsal/geo.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/playground/rehearsal/geo.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { haversineMeters, centroid, roundCoord } from "./geo";

test("haversineMeters: 동일 좌표는 0", () => {
  assert.equal(haversineMeters({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 }), 0);
});

test("haversineMeters: 서울시청~강남역 ~ 8.5km 근사", () => {
  const d = haversineMeters({ lat: 37.5663, lng: 126.9779 }, { lat: 37.4979, lng: 127.0276 });
  assert.ok(d > 8000 && d < 9500, `got ${d}`);
});

test("centroid: 두 점의 중점", () => {
  const c = centroid([{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }]);
  assert.deepEqual(c, { lat: 1, lng: 2 });
});

test("centroid: 빈 배열은 throw", () => {
  assert.throws(() => centroid([]));
});

test("roundCoord: 소수 3자리 반올림", () => {
  assert.equal(roundCoord(37.566789), 37.567);
  assert.equal(roundCoord(126.97712), 126.977);
});
```

- [ ] **Step 2: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/geo.test.ts
```
Expected: FAIL — `Cannot find module './geo'`.

- [ ] **Step 3: `geo.ts` 구현**

```typescript
import type { GeoPoint } from "./types";
import { COORD_ROUNDING_DECIMALS } from "./config";

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) throw new Error("centroid: empty points");
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export function roundCoord(value: number, decimals = COORD_ROUNDING_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
```

- [ ] **Step 4: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/geo.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/geo.ts src/lib/playground/rehearsal/geo.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): geo utils (haversine/centroid/roundCoord)"
```

---

## Task 4: 점수식 (`scoring.ts`) — TDD

**Files:**
- Create: `src/lib/playground/rehearsal/scoring.test.ts`
- Create: `src/lib/playground/rehearsal/scoring.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/playground/rehearsal/scoring.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { scoreStudioForGroup, type StudioScoreInput } from "./scoring";
import type { RouteResult } from "./types";

function route(min: number, transfer = 0, walk = 0): RouteResult {
  return { travelMinutes: min, transferCount: transfer, walkingMinutes: walk, fare: null, distanceMeters: 0, provider: "mock" };
}

const base: StudioScoreInput = {
  routes: [route(20), route(20)],
  memberCount: 2,
  hourlyPriceMin: 20000,
  maxCapacity: 6,
  studioEquipmentTypes: ["DRUM_SET", "GUITAR_AMP"],
  requiredEquipment: [],
  maxBudgetPerHour: null,
};

test("균등 이동시간이면 score = avg (편차/환승/도보 0)", () => {
  const s = scoreStudioForGroup(base);
  assert.equal(s.avgMinutes, 20);
  assert.equal(s.spreadMinutes, 0);
  assert.equal(s.score, 20);
});

test("이동시간 편차가 크면 score 가 avg 보다 커진다", () => {
  const even = scoreStudioForGroup({ ...base, routes: [route(20), route(20)] });
  const uneven = scoreStudioForGroup({ ...base, routes: [route(10), route(30)] });
  assert.equal(even.avgMinutes, 20);
  assert.equal(uneven.avgMinutes, 20);
  assert.ok(uneven.score > even.score, `uneven ${uneven.score} > even ${even.score}`);
  // spread = 30 - 20 = 10, +0.7*10 = +7
  assert.equal(uneven.score, 20 + 0.7 * 10);
});

test("예산 초과분만큼 price penalty (1000원당 2)", () => {
  const s = scoreStudioForGroup({ ...base, hourlyPriceMin: 25000, maxBudgetPerHour: 20000 });
  assert.equal(s.pricePenalty, (5000 / 1000) * 2); // = 10
  assert.equal(s.score, 20 + 10);
});

test("필수장비 누락 1종당 50 penalty", () => {
  const s = scoreStudioForGroup({ ...base, requiredEquipment: ["DRUM_SET", "MIC"] });
  // MIC 누락 1종 -> 50
  assert.equal(s.equipmentPenalty, 50);
  assert.equal(s.score, 20 + 50);
});

test("수용인원 미달 시 capacity penalty 30", () => {
  const s = scoreStudioForGroup({ ...base, memberCount: 8, maxCapacity: 6 });
  assert.equal(s.capacityPenalty, 30);
});

test("환승/도보 가중 반영", () => {
  const s = scoreStudioForGroup({ ...base, routes: [route(20, 1, 10), route(20, 1, 10)] });
  // +4*1(transfer) +0.15*10(walk) = +5.5
  assert.equal(s.score, 20 + 4 * 1 + 0.15 * 10);
});
```

- [ ] **Step 2: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/scoring.test.ts
```
Expected: FAIL — `Cannot find module './scoring'`.

- [ ] **Step 3: `scoring.ts` 구현**

```typescript
import type { RouteResult, EquipmentType } from "./types";
import {
  SCORING_WEIGHTS, CAPACITY_PENALTY, MISSING_EQUIPMENT_PENALTY,
  PRICE_PENALTY_PER_1000_OVER,
} from "./config";

export type StudioScoreInput = {
  routes: RouteResult[]; // 멤버 1인당 1개
  memberCount: number;
  hourlyPriceMin: number | null;
  maxCapacity: number | null;
  studioEquipmentTypes: EquipmentType[];
  requiredEquipment: EquipmentType[];
  maxBudgetPerHour: number | null;
};

export type StudioScore = {
  score: number; // 낮을수록 좋음
  avgMinutes: number;
  maxMinutes: number;
  minMinutes: number;
  spreadMinutes: number;
  avgTransfer: number;
  avgWalking: number;
  pricePenalty: number;
  capacityPenalty: number;
  equipmentPenalty: number;
  fairnessScore: number;
  missingEquipment: EquipmentType[];
};

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function scoreStudioForGroup(input: StudioScoreInput): StudioScore {
  if (input.routes.length === 0) throw new Error("scoreStudioForGroup: empty routes");

  const minutes = input.routes.map((r) => r.travelMinutes);
  const avgMinutes = mean(minutes);
  const maxMinutes = Math.max(...minutes);
  const minMinutes = Math.min(...minutes);
  const spreadMinutes = maxMinutes - avgMinutes;
  const avgTransfer = mean(input.routes.map((r) => r.transferCount));
  const avgWalking = mean(input.routes.map((r) => r.walkingMinutes));

  let pricePenalty = 0;
  if (
    input.maxBudgetPerHour != null &&
    input.hourlyPriceMin != null &&
    input.hourlyPriceMin > input.maxBudgetPerHour
  ) {
    pricePenalty =
      ((input.hourlyPriceMin - input.maxBudgetPerHour) / 1000) * PRICE_PENALTY_PER_1000_OVER;
  }

  let capacityPenalty = 0;
  if (input.maxCapacity != null && input.maxCapacity < input.memberCount) {
    capacityPenalty = CAPACITY_PENALTY;
  }

  const missingEquipment = input.requiredEquipment.filter(
    (e) => !input.studioEquipmentTypes.includes(e),
  );
  const equipmentPenalty = missingEquipment.length * MISSING_EQUIPMENT_PENALTY;

  const score =
    avgMinutes +
    SCORING_WEIGHTS.spread * spreadMinutes +
    SCORING_WEIGHTS.transfer * avgTransfer +
    SCORING_WEIGHTS.walking * avgWalking +
    pricePenalty +
    capacityPenalty +
    equipmentPenalty;

  return {
    score, avgMinutes, maxMinutes, minMinutes, spreadMinutes,
    avgTransfer, avgWalking, pricePenalty, capacityPenalty, equipmentPenalty,
    fairnessScore: spreadMinutes, missingEquipment,
  };
}
```

- [ ] **Step 4: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/scoring.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/scoring.ts src/lib/playground/rehearsal/scoring.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): scoreStudioForGroup pure scoring"
```

---

## Task 5: 추천 이유 (`reason.ts`) — TDD

**Files:**
- Create: `src/lib/playground/rehearsal/reason.test.ts`
- Create: `src/lib/playground/rehearsal/reason.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/playground/rehearsal/reason.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { generateRecommendationReason } from "./reason";
import type { StudioScore } from "./scoring";

function score(partial: Partial<StudioScore>): StudioScore {
  return {
    score: 20, avgMinutes: 20, maxMinutes: 25, minMinutes: 15, spreadMinutes: 5,
    avgTransfer: 0, avgWalking: 5, pricePenalty: 0, capacityPenalty: 0,
    equipmentPenalty: 0, fairnessScore: 5, missingEquipment: [], ...partial,
  };
}

test("평균 이동시간을 항상 포함", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({ avgMinutes: 18.4 }), hasAllEquipment: true, hourlyPriceMin: 20000 });
  assert.ok(r.includes("평균 이동 18분"), r);
});

test("편차 작으면 공평 문구", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({ spreadMinutes: 4 }), hasAllEquipment: true, hourlyPriceMin: null });
  assert.ok(r.includes("공평"), r);
});

test("장비 모두 갖추면 장비 문구", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({}), hasAllEquipment: true, hourlyPriceMin: null });
  assert.ok(r.includes("장비"), r);
});

test("가격 있으면 시간당 가격 노출(천단위 콤마)", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({}), hasAllEquipment: false, hourlyPriceMin: 22000 });
  assert.ok(r.includes("22,000"), r);
});
```

- [ ] **Step 2: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/reason.test.ts
```
Expected: FAIL — `Cannot find module './reason'`.

- [ ] **Step 3: `reason.ts` 구현**

```typescript
import type { StudioScore } from "./scoring";

export function generateRecommendationReason(args: {
  studioName: string;
  score: StudioScore;
  hasAllEquipment: boolean;
  hourlyPriceMin: number | null;
}): string {
  const parts: string[] = [];
  const avg = Math.round(args.score.avgMinutes);
  const max = Math.round(args.score.maxMinutes);
  parts.push(`평균 이동 ${avg}분`);

  if (args.score.spreadMinutes <= 10) parts.push("멤버 간 이동 편차가 작아 공평해요");
  else parts.push(`가장 먼 멤버도 ${max}분`);

  if (args.score.avgTransfer < 0.5) parts.push("환승 부담이 적어요");
  if (args.hasAllEquipment) parts.push("필요 장비를 모두 갖췄어요");
  if (args.hourlyPriceMin != null) {
    parts.push(`시간당 ${args.hourlyPriceMin.toLocaleString("ko-KR")}원부터`);
  }
  return parts.join(" · ");
}
```

- [ ] **Step 4: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/reason.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/reason.ts src/lib/playground/rehearsal/reason.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): rule-based recommendation reason"
```

---

## Task 6: 경로 제공자 (`route-provider.ts`) — TDD

**Files:**
- Create: `src/lib/playground/rehearsal/route-provider.test.ts`
- Create: `src/lib/playground/rehearsal/route-provider.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/playground/rehearsal/route-provider.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { MockRouteProvider } from "./route-provider";

const seoul = { lat: 37.5663, lng: 126.9779 };
const gangnam = { lat: 37.4979, lng: 127.0276 };

test("MockRouteProvider: 동일 좌표는 최소 1분", async () => {
  const p = new MockRouteProvider();
  const r = await p.getRoute(seoul, seoul, "transit");
  assert.equal(r.travelMinutes, 1);
  assert.equal(r.distanceMeters, 0);
  assert.equal(r.provider, "mock");
});

test("MockRouteProvider: 거리 멀수록 시간 증가, car 가 transit 보다 빠름", async () => {
  const p = new MockRouteProvider();
  const transit = await p.getRoute(seoul, gangnam, "transit");
  const car = await p.getRoute(seoul, gangnam, "car");
  assert.ok(transit.travelMinutes > 0);
  assert.ok(car.travelMinutes < transit.travelMinutes, `car ${car.travelMinutes} < transit ${transit.travelMinutes}`);
  assert.equal(car.transferCount, 0);
  assert.equal(car.walkingMinutes, 0);
  assert.equal(car.fare, null);
});

test("MockRouteProvider: transit 은 환승/도보/요금 추정값 포함", async () => {
  const p = new MockRouteProvider();
  const r = await p.getRoute(seoul, gangnam, "transit");
  assert.ok(r.transferCount >= 0);
  assert.ok(r.walkingMinutes >= 0);
  assert.ok(r.fare != null && r.fare >= 1400);
});
```

- [ ] **Step 2: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/route-provider.test.ts
```
Expected: FAIL — `Cannot find module './route-provider'`.

- [ ] **Step 3: `route-provider.ts` 구현**

```typescript
import type { GeoPoint, RouteResult, TransportMode, RouteProviderName } from "./types";
import { haversineMeters } from "./geo";

export interface RouteProvider {
  readonly name: RouteProviderName;
  getRoute(origin: GeoPoint, destination: GeoPoint, mode: TransportMode): Promise<RouteResult>;
}

// 인터페이스 placeholder — 이번 슬라이스 미구현
export interface Geocoder {
  geocode(query: string): Promise<GeoPoint | null>;
}

const TRANSIT_KMH = 22; // 버스/지하철 대기 포함 실효 속도
const CAR_KMH = 30;     // 도심 주행

export class MockRouteProvider implements RouteProvider {
  readonly name: RouteProviderName = "mock";

  async getRoute(origin: GeoPoint, destination: GeoPoint, mode: TransportMode): Promise<RouteResult> {
    const distanceMeters = haversineMeters(origin, destination);
    const km = distanceMeters / 1000;
    const isCar = mode === "car";
    const kmh = isCar ? CAR_KMH : TRANSIT_KMH;
    const travelMinutes = Math.max(1, Math.round((km / kmh) * 60));
    const transferCount = isCar ? 0 : Math.min(3, Math.floor(km / 6)); // ~6km당 환승 1
    const walkingMinutes = isCar ? 0 : Math.min(20, Math.round(km * 1.5));
    const fare = isCar ? null : 1400 + Math.max(0, Math.floor((km - 10) / 5)) * 100;
    return {
      travelMinutes, transferCount, walkingMinutes, fare,
      distanceMeters: Math.round(distanceMeters), provider: this.name,
    };
  }
}

// 실 제공자 골격 — env/creds 자리만, 미구현
export class TransitRouteProvider implements RouteProvider {
  readonly name: RouteProviderName = "odsay";
  constructor(private readonly apiKey: string) {}
  async getRoute(): Promise<RouteResult> {
    // TODO: ODsay/TMAP 대중교통 경로 API 연동
    throw new Error("TransitRouteProvider not implemented");
  }
}

export class CarRouteProvider implements RouteProvider {
  readonly name: RouteProviderName = "tmap";
  constructor(private readonly apiKey: string) {}
  async getRoute(): Promise<RouteResult> {
    // TODO: TMAP/Kakao 자동차 경로 API 연동
    throw new Error("CarRouteProvider not implemented");
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/route-provider.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/route-provider.ts src/lib/playground/rehearsal/route-provider.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): RouteProvider interface + MockRouteProvider + skeletons"
```

---

## Task 7: 랭커 (`ranker.ts`) — TDD (순수 필터/prefilter/랭킹)

**Files:**
- Create: `src/lib/playground/rehearsal/ranker.test.ts`
- Create: `src/lib/playground/rehearsal/ranker.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/playground/rehearsal/ranker.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { filterStudiosByConditions, prefilterByCentroid, rankStudios } from "./ranker";
import type { Studio, RouteResult } from "./types";

function studio(p: Partial<Studio>): Studio {
  return {
    id: 1, name: "S", slug: "s", regionId: 1, regionName: "서울 마포구", areaLabel: null,
    lat: 37.55, lng: 126.92, nearestStation: null, nearestStationMeters: null,
    hourlyPriceMin: 20000, hourlyPriceMax: 25000, minCapacity: 1, maxCapacity: 6,
    hasParking: false, parkingNote: null, status: "approved", sourceNote: null,
    bookingUrl: null, mapUrl: null, equipment: [], ...p,
  };
}
function route(min: number): RouteResult {
  return { travelMinutes: min, transferCount: 0, walkingMinutes: 0, fare: null, distanceMeters: 0, provider: "mock" };
}

test("filter: 수용인원 미달 제외", () => {
  const out = filterStudiosByConditions(
    [studio({ id: 1, maxCapacity: 4 }), studio({ id: 2, maxCapacity: 8 })],
    { memberCount: 6, maxBudgetPerHour: null, requiredEquipment: [], preferredRegionIds: [] },
  );
  assert.deepEqual(out.map((s) => s.id), [2]);
});

test("filter: 예산 초과(price_min > 예산) 제외", () => {
  const out = filterStudiosByConditions(
    [studio({ id: 1, hourlyPriceMin: 30000 }), studio({ id: 2, hourlyPriceMin: 18000 })],
    { memberCount: 2, maxBudgetPerHour: 20000, requiredEquipment: [], preferredRegionIds: [] },
  );
  assert.deepEqual(out.map((s) => s.id), [2]);
});

test("filter: 필수장비 보유만 통과", () => {
  const withDrum = studio({ id: 1, equipment: [{ equipmentType: "DRUM_SET", equipmentName: null, quantity: 1, note: null }] });
  const without = studio({ id: 2, equipment: [] });
  const out = filterStudiosByConditions([withDrum, without], { memberCount: 2, maxBudgetPerHour: null, requiredEquipment: ["DRUM_SET"], preferredRegionIds: [] });
  assert.deepEqual(out.map((s) => s.id), [1]);
});

test("filter: preferred_region 지정 시 해당 지역만", () => {
  const out = filterStudiosByConditions(
    [studio({ id: 1, regionId: 5 }), studio({ id: 2, regionId: 9 })],
    { memberCount: 2, maxBudgetPerHour: null, requiredEquipment: [], preferredRegionIds: [9] },
  );
  assert.deepEqual(out.map((s) => s.id), [2]);
});

test("prefilter: 중심점 가까운 상위 N", () => {
  const near = studio({ id: 1, lat: 37.50, lng: 127.00 });
  const far = studio({ id: 2, lat: 37.80, lng: 127.50 });
  const out = prefilterByCentroid([far, near], { lat: 37.50, lng: 127.0 }, 1);
  assert.deepEqual(out.map((s) => s.id), [1]);
});

test("rank: 점수 오름차순(낮을수록 상위), rank_no 1부터", () => {
  const a = studio({ id: 1 });
  const b = studio({ id: 2 });
  const routesByStudio = new Map<number, RouteResult[]>([
    [1, [route(10), route(10)]], // avg 10
    [2, [route(30), route(30)]], // avg 30
  ]);
  const ranked = rankStudios({
    studios: [a, b], routesByStudioId: routesByStudio,
    conditions: { memberCount: 2, maxBudgetPerHour: null, requiredEquipment: [], preferredRegionIds: [] },
    limit: 5,
  });
  assert.deepEqual(ranked.map((r) => r.studio.id), [1, 2]);
  assert.equal(ranked[0].rankNo, 1);
  assert.equal(ranked[1].rankNo, 2);
  assert.ok(ranked[0].reason.length > 0);
});
```

- [ ] **Step 2: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/ranker.test.ts
```
Expected: FAIL — `Cannot find module './ranker'`.

- [ ] **Step 3: `ranker.ts` 구현**

```typescript
import type { Studio, RouteResult, EquipmentType, GeoPoint } from "./types";
import { haversineMeters } from "./geo";
import { scoreStudioForGroup, type StudioScore } from "./scoring";
import { generateRecommendationReason } from "./reason";
import { FINAL_LIMIT } from "./config";

export type RecommendConditions = {
  memberCount: number;
  maxBudgetPerHour: number | null;
  requiredEquipment: EquipmentType[];
  preferredRegionIds: number[];
};

export type RankedStudio = {
  rankNo: number;
  studio: Studio;
  score: StudioScore;
  reason: string;
};

function studioEquipmentTypes(s: Studio): EquipmentType[] {
  return s.equipment.map((e) => e.equipmentType);
}

export function filterStudiosByConditions(studios: Studio[], cond: RecommendConditions): Studio[] {
  return studios.filter((s) => {
    if (s.maxCapacity != null && s.maxCapacity < cond.memberCount) return false;
    if (cond.maxBudgetPerHour != null && s.hourlyPriceMin != null && s.hourlyPriceMin > cond.maxBudgetPerHour) return false;
    if (cond.requiredEquipment.length > 0) {
      const have = new Set(studioEquipmentTypes(s));
      if (!cond.requiredEquipment.every((e) => have.has(e))) return false;
    }
    if (cond.preferredRegionIds.length > 0) {
      if (s.regionId == null || !cond.preferredRegionIds.includes(s.regionId)) return false;
    }
    return true;
  });
}

export function prefilterByCentroid(studios: Studio[], center: GeoPoint, limit: number): Studio[] {
  return [...studios]
    .map((s) => ({ s, d: haversineMeters(center, { lat: s.lat, lng: s.lng }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.s);
}

export function rankStudios(args: {
  studios: Studio[];
  routesByStudioId: Map<number, RouteResult[]>;
  conditions: RecommendConditions;
  limit?: number;
}): RankedStudio[] {
  const scored = args.studios
    .map((studio) => {
      const routes = args.routesByStudioId.get(studio.id);
      if (!routes || routes.length === 0) return null;
      const score = scoreStudioForGroup({
        routes,
        memberCount: args.conditions.memberCount,
        hourlyPriceMin: studio.hourlyPriceMin,
        maxCapacity: studio.maxCapacity,
        studioEquipmentTypes: studioEquipmentTypes(studio),
        requiredEquipment: args.conditions.requiredEquipment,
        maxBudgetPerHour: args.conditions.maxBudgetPerHour,
      });
      return { studio, score };
    })
    .filter((x): x is { studio: Studio; score: StudioScore } => x !== null)
    .sort((a, b) => a.score.score - b.score.score)
    .slice(0, args.limit ?? FINAL_LIMIT);

  return scored.map(({ studio, score }, i) => ({
    rankNo: i + 1,
    studio,
    score,
    reason: generateRecommendationReason({
      studioName: studio.name,
      score,
      hasAllEquipment: score.missingEquipment.length === 0,
      hourlyPriceMin: studio.hourlyPriceMin,
    }),
  }));
}
```

- [ ] **Step 4: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/ranker.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/ranker.ts src/lib/playground/rehearsal/ranker.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): pure filter/prefilter/rank logic"
```

---

## Task 8: DB 조회 레이어 (`regions.ts`, `studios.ts`, `route-cache.ts`)

**Files:**
- Create: `src/lib/playground/rehearsal/regions.ts`
- Create: `src/lib/playground/rehearsal/studios.ts`
- Create: `src/lib/playground/rehearsal/route-cache.ts`

> 순수 DB 함수 — 단위테스트 없이 통합테스트(Task 9 API)에서 검증. mysql2 `getPool().query<RowDataPacket[]>` 패턴(Task 패턴 참조).

- [ ] **Step 1: `regions.ts` 구현**

```typescript
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type Region = {
  id: number;
  province: string;
  city: string | null;
  district: string | null;
  displayName: string;
  isSupported: boolean;
  sortOrder: number;
};

export async function listRegions(opts?: { onlySupported?: boolean }): Promise<Region[]> {
  const where = opts?.onlySupported ? "WHERE is_supported = 1" : "";
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, province, city, district, display_name, is_supported, sort_order
       FROM playground_regions ${where}
      ORDER BY sort_order, id`,
  );
  return rows.map((r) => ({
    id: r.id, province: r.province, city: r.city, district: r.district,
    displayName: r.display_name, isSupported: r.is_supported === 1, sortOrder: r.sort_order,
  }));
}
```

- [ ] **Step 2: `studios.ts` 구현**

```typescript
import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { Studio, StudioStatus, StudioEquipment, EquipmentType } from "./types";

function mapStudioRow(r: RowDataPacket): Omit<Studio, "equipment"> {
  return {
    id: r.id, name: r.name, slug: r.slug, regionId: r.region_id, regionName: r.region_name ?? null,
    areaLabel: r.area_label, lat: r.lat != null ? Number(r.lat) : NaN, lng: r.lng != null ? Number(r.lng) : NaN,
    nearestStation: r.nearest_station, nearestStationMeters: r.nearest_station_meters,
    hourlyPriceMin: r.hourly_price_min, hourlyPriceMax: r.hourly_price_max,
    minCapacity: r.min_capacity, maxCapacity: r.max_capacity,
    hasParking: r.has_parking === 1, parkingNote: r.parking_note,
    status: r.status as StudioStatus, sourceNote: r.source_note,
    bookingUrl: r.booking_url, mapUrl: r.map_url,
  };
}

async function attachEquipment(studios: Omit<Studio, "equipment">[]): Promise<Studio[]> {
  if (studios.length === 0) return [];
  const ids = studios.map((s) => s.id);
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT studio_id, equipment_type, equipment_name, quantity, note
       FROM playground_studio_equipment
      WHERE studio_id IN (${ids.map(() => "?").join(",")})
      ORDER BY id`,
    ids,
  );
  const byStudio = new Map<number, StudioEquipment[]>();
  for (const r of rows) {
    const list = byStudio.get(r.studio_id) ?? [];
    list.push({
      equipmentType: r.equipment_type as EquipmentType, equipmentName: r.equipment_name,
      quantity: r.quantity, note: r.note,
    });
    byStudio.set(r.studio_id, list);
  }
  return studios.map((s) => ({ ...s, equipment: byStudio.get(s.id) ?? [] }));
}

const SELECT_STUDIO = `
  SELECT st.id, st.name, st.slug, st.region_id, rg.display_name AS region_name, st.area_label,
         st.lat, st.lng, st.nearest_station, st.nearest_station_meters,
         st.hourly_price_min, st.hourly_price_max, st.min_capacity, st.max_capacity,
         st.has_parking, st.parking_note, st.status, st.source_note, st.booking_url, st.map_url
    FROM playground_studios st
    LEFT JOIN playground_regions rg ON rg.id = st.region_id`;

// 추천 후보: approved + 좌표 보유
export async function getCandidateStudios(): Promise<Studio[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_STUDIO} WHERE st.status = 'approved' AND st.lat IS NOT NULL AND st.lng IS NOT NULL`,
  );
  return attachEquipment(rows.map(mapStudioRow));
}

// 관리/검수용 목록
export async function listStudios(filter: {
  regionId?: number; status?: StudioStatus; keyword?: string; equipmentType?: EquipmentType;
}): Promise<Studio[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.regionId) { clauses.push("st.region_id = ?"); params.push(filter.regionId); }
  if (filter.status) { clauses.push("st.status = ?"); params.push(filter.status); }
  if (filter.keyword) { clauses.push("st.name LIKE ?"); params.push(`%${filter.keyword}%`); }
  if (filter.equipmentType) {
    clauses.push("EXISTS (SELECT 1 FROM playground_studio_equipment e WHERE e.studio_id = st.id AND e.equipment_type = ?)");
    params.push(filter.equipmentType);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_STUDIO} ${where} ORDER BY st.updated_at DESC, st.id DESC`,
    params,
  );
  return attachEquipment(rows.map(mapStudioRow));
}

export async function getStudioById(id: number): Promise<Studio | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(`${SELECT_STUDIO} WHERE st.id = ?`, [id]);
  if (rows.length === 0) return null;
  const [withEquip] = await attachEquipment([mapStudioRow(rows[0])]);
  return withEquip;
}

// 관리 CRUD (Task 11)
export type StudioWriteInput = {
  name: string; slug: string; regionId: number | null; areaLabel: string | null;
  lat: number | null; lng: number | null; nearestStation: string | null; nearestStationMeters: number | null;
  hourlyPriceMin: number | null; hourlyPriceMax: number | null; minCapacity: number | null; maxCapacity: number | null;
  hasParking: boolean; parkingNote: string | null; status: StudioStatus; sourceNote: string | null;
  bookingUrl: string | null; mapUrl: string | null;
  equipment: { equipmentType: EquipmentType; equipmentName: string | null; quantity: number; note: string | null }[];
};

export async function createStudio(input: StudioWriteInput): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO playground_studios
       (name, slug, region_id, area_label, lat, lng, nearest_station, nearest_station_meters,
        hourly_price_min, hourly_price_max, min_capacity, max_capacity, has_parking, parking_note,
        status, source_note, booking_url, map_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [input.name, input.slug, input.regionId, input.areaLabel, input.lat, input.lng, input.nearestStation,
     input.nearestStationMeters, input.hourlyPriceMin, input.hourlyPriceMax, input.minCapacity, input.maxCapacity,
     input.hasParking ? 1 : 0, input.parkingNote, input.status, input.sourceNote, input.bookingUrl, input.mapUrl],
  );
  const studioId = res.insertId;
  await replaceEquipment(studioId, input.equipment);
  return studioId;
}

export async function updateStudio(id: number, input: StudioWriteInput): Promise<void> {
  await getPool().query(
    `UPDATE playground_studios SET
       name=?, slug=?, region_id=?, area_label=?, lat=?, lng=?, nearest_station=?, nearest_station_meters=?,
       hourly_price_min=?, hourly_price_max=?, min_capacity=?, max_capacity=?, has_parking=?, parking_note=?,
       status=?, source_note=?, booking_url=?, map_url=?
     WHERE id=?`,
    [input.name, input.slug, input.regionId, input.areaLabel, input.lat, input.lng, input.nearestStation,
     input.nearestStationMeters, input.hourlyPriceMin, input.hourlyPriceMax, input.minCapacity, input.maxCapacity,
     input.hasParking ? 1 : 0, input.parkingNote, input.status, input.sourceNote, input.bookingUrl, input.mapUrl, id],
  );
  await replaceEquipment(id, input.equipment);
}

async function replaceEquipment(studioId: number, equipment: StudioWriteInput["equipment"]): Promise<void> {
  await getPool().query(`DELETE FROM playground_studio_equipment WHERE studio_id = ?`, [studioId]);
  for (const e of equipment) {
    await getPool().query(
      `INSERT INTO playground_studio_equipment (studio_id, equipment_type, equipment_name, quantity, note)
       VALUES (?,?,?,?,?)`,
      [studioId, e.equipmentType, e.equipmentName, e.quantity, e.note],
    );
  }
}
```

- [ ] **Step 3: `route-cache.ts` 구현**

```typescript
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { GeoPoint, RouteResult, TransportMode, TimeBucket } from "./types";
import { roundCoord } from "./geo";
import { ROUTE_CACHE_TTL_HOURS } from "./config";

export function makeOriginKey(origin: GeoPoint): string {
  return `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
}

export async function readRouteCache(args: {
  origin: GeoPoint; destinationId: number; mode: TransportMode; timeBucket: TimeBucket;
}): Promise<RouteResult | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT travel_minutes, transfer_count, walking_minutes, fare, distance_meters, provider
       FROM playground_route_cache
      WHERE origin_key=? AND destination_id=? AND transport_mode=? AND time_bucket=? AND expires_at > NOW()
      LIMIT 1`,
    [makeOriginKey(args.origin), args.destinationId, args.mode, args.timeBucket],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    travelMinutes: r.travel_minutes, transferCount: r.transfer_count, walkingMinutes: r.walking_minutes,
    fare: r.fare, distanceMeters: r.distance_meters, provider: r.provider,
  };
}

export async function writeRouteCache(args: {
  origin: GeoPoint; destinationId: number; mode: TransportMode; timeBucket: TimeBucket; route: RouteResult;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO playground_route_cache
       (origin_key, origin_lat, origin_lng, destination_id, transport_mode, time_bucket,
        travel_minutes, transfer_count, walking_minutes, fare, distance_meters, provider, raw_response_json, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? HOUR))
     ON DUPLICATE KEY UPDATE
       travel_minutes=VALUES(travel_minutes), transfer_count=VALUES(transfer_count),
       walking_minutes=VALUES(walking_minutes), fare=VALUES(fare), distance_meters=VALUES(distance_meters),
       provider=VALUES(provider), raw_response_json=VALUES(raw_response_json), expires_at=VALUES(expires_at)`,
    [makeOriginKey(args.origin), roundCoord(args.origin.lat), roundCoord(args.origin.lng), args.destinationId,
     args.mode, args.timeBucket, args.route.travelMinutes, args.route.transferCount, args.route.walkingMinutes,
     args.route.fare, args.route.distanceMeters, args.route.provider, JSON.stringify(args.route), ROUTE_CACHE_TTL_HOURS],
  );
}
```

- [ ] **Step 4: 타입 컴파일 확인**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "rehearsal/(regions|studios|route-cache)" || echo "no errors in DB layer"
```
Expected: `no errors in DB layer`.

- [ ] **Step 5: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/regions.ts src/lib/playground/rehearsal/studios.ts src/lib/playground/rehearsal/route-cache.ts
sudo -u ec2-user git commit -m "feat(rehearsal): DB layer (regions/studios/route-cache)"
```

---

## Task 9: 오케스트레이션 (`recommend.ts`) + seed

**Files:**
- Create: `src/lib/playground/rehearsal/recommend.ts`
- Create: `src/lib/playground/rehearsal/timeBucket.ts`
- Create: `src/lib/playground/rehearsal/recommend.test.ts`
- Create: `db/seed/rehearsal_regions.sql`
- Create: `scripts/seed-rehearsal.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: `timeBucket.ts` 구현 (순수, Date 주입)**

```typescript
import type { TimeBucket } from "./types";

// 주입형: 테스트 가능하게 Date 를 인자로 받음
export function timeBucketFor(date: Date): TimeBucket {
  const day = date.getDay(); // 0=일,6=토
  const hour = date.getHours();
  const weekend = day === 0 || day === 6;
  if (weekend) return hour >= 18 ? "weekend_night" : "weekend_day";
  if (hour >= 22 || hour < 6) return "weekday_night";
  if (hour >= 18) return "weekday_evening";
  return "weekday_day";
}
```

- [ ] **Step 2: `recommend.test.ts` 작성 (주입형 mock provider, DB 미사용 경로 검증은 ranker 로 이미 커버 — 여기선 timeBucket + 통합 헬퍼만)**

```typescript
// src/lib/playground/rehearsal/recommend.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { timeBucketFor } from "./timeBucket";

test("timeBucketFor: 평일 낮", () => {
  assert.equal(timeBucketFor(new Date("2026-06-03T14:00:00+09:00")), "weekday_day"); // 수요일
});
test("timeBucketFor: 평일 저녁", () => {
  assert.equal(timeBucketFor(new Date("2026-06-03T19:00:00+09:00")), "weekday_evening");
});
test("timeBucketFor: 토요일 낮은 weekend_day", () => {
  assert.equal(timeBucketFor(new Date("2026-06-06T13:00:00+09:00")), "weekend_day"); // 토
});
```

> 참고: 환경 시간대 의존을 줄이려고 KST 오프셋 명시. CI 시간대가 다르면 `getDay/getHours`가 흔들릴 수 있어, 이 테스트는 로컬(KST 서버) 기준. recommend 의 핵심 분기/랭킹은 Task 7 ranker 테스트가 DB 없이 커버한다.

- [ ] **Step 3: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/recommend.test.ts
```
Expected: FAIL — `Cannot find module './timeBucket'`.

- [ ] **Step 4: `recommend.ts` 구현**

```typescript
import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type {
  RecommendInput, Studio, RouteResult, MemberRoute, TimeBucket, GeoPoint,
} from "./types";
import { centroid } from "./geo";
import { getCandidateStudios } from "./studios";
import { readRouteCache, writeRouteCache } from "./route-cache";
import { MockRouteProvider, type RouteProvider } from "./route-provider";
import { filterStudiosByConditions, prefilterByCentroid, rankStudios } from "./ranker";
import { timeBucketFor } from "./timeBucket";
import { PREFILTER_LIMIT, FINAL_LIMIT } from "./config";

export type RecommendResultItem = {
  rankNo: number;
  studio: Studio;
  score: number;
  avgMinutes: number;
  maxMinutes: number;
  minMinutes: number;
  spreadMinutes: number;
  avgTransfer: number;
  avgWalking: number;
  reason: string;
  memberRoutes: MemberRoute[];
};

export type RecommendOutput = {
  searchId: number;
  results: RecommendResultItem[];
};

export async function recommendStudios(
  input: RecommendInput,
  opts?: { routeProvider?: RouteProvider; now?: Date },
): Promise<RecommendOutput> {
  // 1) 좌표 없는 멤버 즉시 에러 (geocode 는 이번 범위 밖)
  for (const m of input.members) {
    if (!Number.isFinite(m.originLat) || !Number.isFinite(m.originLng)) {
      throw new Error(`member "${m.nickname}" 좌표 없음`);
    }
  }
  if (input.members.length === 0) throw new Error("members 비어있음");

  const provider = opts?.routeProvider ?? new MockRouteProvider();
  const timeBucket: TimeBucket = timeBucketFor(opts?.now ?? new Date());
  const memberCount = input.members.length;

  // 2) search + members 저장 (pending)
  const searchId = await insertSearch(input, memberCount);

  try {
    // 3) 후보 + 4) 조건필터 + 5) prefilter
    const candidates = await getCandidateStudios();
    const filtered = filterStudiosByConditions(candidates, {
      memberCount, maxBudgetPerHour: input.maxBudgetPerHour,
      requiredEquipment: input.requiredEquipment, preferredRegionIds: input.preferredRegionIds,
    });
    const center = centroid(input.members.map((m) => ({ lat: m.originLat, lng: m.originLng })));
    const prefiltered = prefilterByCentroid(filtered, center, PREFILTER_LIMIT);

    // 6) 경로 계산 (캐시 read-through)
    const routesByStudioId = new Map<number, RouteResult[]>();
    const memberRoutesByStudioId = new Map<number, MemberRoute[]>();
    for (const studio of prefiltered) {
      const routes: RouteResult[] = [];
      const memberRoutes: MemberRoute[] = [];
      for (const m of input.members) {
        const origin: GeoPoint = { lat: m.originLat, lng: m.originLng };
        const route = await getOrCalcRoute(origin, studio, input.transportMode, timeBucket, provider);
        routes.push(route);
        memberRoutes.push({ nickname: m.nickname, route });
      }
      routesByStudioId.set(studio.id, routes);
      memberRoutesByStudioId.set(studio.id, memberRoutes);
    }

    // 7-8) 점수 + 랭킹
    const ranked = rankStudios({
      studios: prefiltered, routesByStudioId,
      conditions: {
        memberCount, maxBudgetPerHour: input.maxBudgetPerHour,
        requiredEquipment: input.requiredEquipment, preferredRegionIds: input.preferredRegionIds,
      },
      limit: FINAL_LIMIT,
    });

    // 9) 결과 저장 + completed
    await persistResults(searchId, ranked);
    await getPool().query(`UPDATE playground_rehearsal_searches SET search_status='completed' WHERE id=?`, [searchId]);

    const results: RecommendResultItem[] = ranked.map((r) => ({
      rankNo: r.rankNo, studio: r.studio, score: r.score.score,
      avgMinutes: r.score.avgMinutes, maxMinutes: r.score.maxMinutes, minMinutes: r.score.minMinutes,
      spreadMinutes: r.score.spreadMinutes, avgTransfer: r.score.avgTransfer, avgWalking: r.score.avgWalking,
      reason: r.reason, memberRoutes: memberRoutesByStudioId.get(r.studio.id) ?? [],
    }));
    return { searchId, results };
  } catch (e) {
    await getPool().query(
      `UPDATE playground_rehearsal_searches SET search_status='failed', error_note=? WHERE id=?`,
      [String(e instanceof Error ? e.message : e).slice(0, 250), searchId],
    );
    throw e;
  }
}

async function getOrCalcRoute(
  origin: GeoPoint, studio: Studio, mode: RecommendInput["transportMode"],
  timeBucket: TimeBucket, provider: RouteProvider,
): Promise<RouteResult> {
  const cached = await readRouteCache({ origin, destinationId: studio.id, mode, timeBucket });
  if (cached) return cached;
  const route = await provider.getRoute(origin, { lat: studio.lat, lng: studio.lng }, mode);
  await writeRouteCache({ origin, destinationId: studio.id, mode, timeBucket, route });
  return route;
}

async function insertSearch(input: RecommendInput, memberCount: number): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO playground_rehearsal_searches
       (member_count, transport_mode, max_budget_per_hour, required_equipment_json, preferred_region_ids_json, search_status)
     VALUES (?,?,?,?,?, 'pending')`,
    [memberCount, input.transportMode, input.maxBudgetPerHour,
     JSON.stringify(input.requiredEquipment), JSON.stringify(input.preferredRegionIds)],
  );
  const searchId = res.insertId;
  for (const m of input.members) {
    await getPool().query(
      `INSERT INTO playground_rehearsal_search_members
         (search_id, nickname, origin_text, origin_lat, origin_lng, origin_type, transport_mode)
       VALUES (?,?,?,?,?,?,?)`,
      [searchId, m.nickname, m.originText, m.originLat, m.originLng, m.originType, m.transportMode],
    );
  }
  return searchId;
}

async function persistResults(searchId: number, ranked: ReturnType<typeof rankStudios>): Promise<void> {
  for (const r of ranked) {
    await getPool().query(
      `INSERT INTO playground_studio_recommendation_results
         (search_id, studio_id, rank_no, score, avg_minutes, max_minutes, min_minutes, spread_minutes,
          avg_transfer, avg_walking, price_penalty, capacity_penalty, equipment_penalty, fairness_score,
          recommendation_reason, raw_score_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [searchId, r.studio.id, r.rankNo, r.score.score, r.score.avgMinutes, r.score.maxMinutes,
       r.score.minMinutes, r.score.spreadMinutes, r.score.avgTransfer, r.score.avgWalking,
       r.score.pricePenalty, r.score.capacityPenalty, r.score.equipmentPenalty, r.score.fairnessScore,
       r.reason, JSON.stringify(r.score)],
    );
  }
}
```

- [ ] **Step 5: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/recommend.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 6: `db/seed/rehearsal_regions.sql` 작성 (지역 마스터, 멱등)**

```sql
-- rehearsal_regions.sql — 합주실 추천 지역 마스터 (서울 25구 + 경기 주요시)
-- 수동 실행: set -a; source <DEV site>/.db_credentials; set +a
--   mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < db/seed/rehearsal_regions.sql
INSERT INTO playground_regions (province, city, district, display_name, sort_order) VALUES
  ('서울특별시', NULL, '마포구', '서울 마포구', 10),
  ('서울특별시', NULL, '서대문구', '서울 서대문구', 11),
  ('서울특별시', NULL, '용산구', '서울 용산구', 12),
  ('서울특별시', NULL, '강남구', '서울 강남구', 13),
  ('서울특별시', NULL, '서초구', '서울 서초구', 14),
  ('서울특별시', NULL, '송파구', '서울 송파구', 15),
  ('서울특별시', NULL, '광진구', '서울 광진구', 16),
  ('서울특별시', NULL, '성동구', '서울 성동구', 17),
  ('서울특별시', NULL, '동대문구', '서울 동대문구', 18),
  ('서울특별시', NULL, '종로구', '서울 종로구', 19),
  ('서울특별시', NULL, '중구', '서울 중구', 20),
  ('서울특별시', NULL, '영등포구', '서울 영등포구', 21),
  ('서울특별시', NULL, '관악구', '서울 관악구', 22),
  ('서울특별시', NULL, '동작구', '서울 동작구', 23),
  ('경기도', '고양시', NULL, '경기 고양시', 50),
  ('경기도', '성남시', NULL, '경기 성남시', 51),
  ('경기도', '부천시', NULL, '경기 부천시', 52),
  ('경기도', '안양시', NULL, '경기 안양시', 53),
  ('경기도', '수원시', NULL, '경기 수원시', 54)
ON DUPLICATE KEY UPDATE province=VALUES(province), city=VALUES(city), district=VALUES(district), sort_order=VALUES(sort_order);
```

- [ ] **Step 7: `scripts/seed-rehearsal.ts` 작성 (mock 합주실 + 장비, 멱등)**

```typescript
// scripts/seed-rehearsal.ts
// mock 합주실 + 장비 멱등 시드 (DEV 검증용). slug UNIQUE 기준 upsert.
//   set -a; source <DEV site>/.db_credentials; set +a
//   sudo -u ec2-user env PATH="$PATH" pnpm rehearsal:seed
import mysql from "mysql2/promise";

type SeedStudio = {
  name: string; slug: string; regionDisplay: string; areaLabel: string;
  lat: number; lng: number; nearestStation: string; nearestStationMeters: number;
  priceMin: number; priceMax: number; minCap: number; maxCap: number; hasParking: boolean;
  equipment: { type: string; name: string | null; qty: number }[];
};

const STUDIOS: SeedStudio[] = [
  { name: "합정 사운드합주실", slug: "hapjeong-sound", regionDisplay: "서울 마포구", areaLabel: "서울 마포구 합정동",
    lat: 37.5495, lng: 126.9136, nearestStation: "합정역", nearestStationMeters: 250,
    priceMin: 18000, priceMax: 25000, minCap: 1, maxCap: 8, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: "Pearl Export", qty: 1 }, { type: "GUITAR_AMP", name: "JC-120", qty: 2 }, { type: "BASS_AMP", name: "Ampeg", qty: 1 }, { type: "MIC", name: "SM58", qty: 3 }] },
  { name: "강남 락스타합주실", slug: "gangnam-rockstar", regionDisplay: "서울 강남구", areaLabel: "서울 강남구 역삼동",
    lat: 37.5006, lng: 127.0364, nearestStation: "강남역", nearestStationMeters: 400,
    priceMin: 25000, priceMax: 35000, minCap: 1, maxCap: 10, hasParking: true,
    equipment: [{ type: "DRUM_SET", name: "Yamaha", qty: 1 }, { type: "GUITAR_AMP", name: "Marshall", qty: 2 }, { type: "BASS_AMP", name: "Hartke", qty: 1 }, { type: "KEYBOARD", name: "Roland", qty: 1 }, { type: "PA_SYSTEM", name: null, qty: 1 }] },
  { name: "신촌 그루브합주실", slug: "sinchon-groove", regionDisplay: "서울 서대문구", areaLabel: "서울 서대문구 창천동",
    lat: 37.5559, lng: 126.9368, nearestStation: "신촌역", nearestStationMeters: 300,
    priceMin: 16000, priceMax: 22000, minCap: 1, maxCap: 6, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: null, qty: 1 }, { type: "GUITAR_AMP", name: "JC-120", qty: 1 }, { type: "BASS_AMP", name: null, qty: 1 }] },
  { name: "건대 비트합주실", slug: "kondae-beat", regionDisplay: "서울 광진구", areaLabel: "서울 광진구 화양동",
    lat: 37.5403, lng: 127.0695, nearestStation: "건대입구역", nearestStationMeters: 350,
    priceMin: 17000, priceMax: 24000, minCap: 1, maxCap: 8, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: "Tama", qty: 1 }, { type: "GUITAR_AMP", name: "Fender", qty: 2 }, { type: "BASS_AMP", name: "Markbass", qty: 1 }, { type: "MIC", name: "SM58", qty: 2 }, { type: "DOUBLE_PEDAL", name: null, qty: 1 }] },
  { name: "수원역 멜로디합주실", slug: "suwon-melody", regionDisplay: "경기 수원시", areaLabel: "경기 수원시 팔달구",
    lat: 37.2659, lng: 127.0001, nearestStation: "수원역", nearestStationMeters: 500,
    priceMin: 14000, priceMax: 20000, minCap: 1, maxCap: 7, hasParking: true,
    equipment: [{ type: "DRUM_SET", name: null, qty: 1 }, { type: "GUITAR_AMP", name: "JC-120", qty: 1 }, { type: "BASS_AMP", name: null, qty: 1 }, { type: "KEYBOARD", name: null, qty: 1 }] },
  { name: "성남 모던합주실", slug: "seongnam-modern", regionDisplay: "경기 성남시", areaLabel: "경기 성남시 분당구",
    lat: 37.3827, lng: 127.1189, nearestStation: "서현역", nearestStationMeters: 600,
    priceMin: 15000, priceMax: 21000, minCap: 1, maxCap: 9, hasParking: true,
    equipment: [{ type: "DRUM_SET", name: "Pearl", qty: 1 }, { type: "GUITAR_AMP", name: "Marshall", qty: 2 }, { type: "BASS_AMP", name: "Ampeg", qty: 1 }, { type: "MIXER", name: null, qty: 1 }, { type: "MIC", name: "SM58", qty: 4 }] },
  { name: "홍대 인디합주실", slug: "hongdae-indie", regionDisplay: "서울 마포구", areaLabel: "서울 마포구 서교동",
    lat: 37.5563, lng: 126.9236, nearestStation: "홍대입구역", nearestStationMeters: 200,
    priceMin: 20000, priceMax: 28000, minCap: 1, maxCap: 8, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: "DW", qty: 1 }, { type: "GUITAR_AMP", name: "Vox", qty: 2 }, { type: "BASS_AMP", name: "Aguilar", qty: 1 }, { type: "KEYBOARD", name: "Nord", qty: 1 }, { type: "PA_SYSTEM", name: null, qty: 1 }, { type: "MIC", name: "SM58", qty: 3 }] },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME, charset: "utf8mb4",
  });

  for (const s of STUDIOS) {
    const [regionRows] = await conn.query<any[]>(
      `SELECT id FROM playground_regions WHERE display_name = ? LIMIT 1`, [s.regionDisplay],
    );
    const regionId = regionRows[0]?.id ?? null;

    await conn.query(
      `INSERT INTO playground_studios
         (name, slug, region_id, area_label, lat, lng, nearest_station, nearest_station_meters,
          hourly_price_min, hourly_price_max, min_capacity, max_capacity, has_parking, status, source_note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'approved', 'seed-mock')
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), region_id=VALUES(region_id), area_label=VALUES(area_label),
         lat=VALUES(lat), lng=VALUES(lng), nearest_station=VALUES(nearest_station),
         nearest_station_meters=VALUES(nearest_station_meters), hourly_price_min=VALUES(hourly_price_min),
         hourly_price_max=VALUES(hourly_price_max), min_capacity=VALUES(min_capacity),
         max_capacity=VALUES(max_capacity), has_parking=VALUES(has_parking), status='approved'`,
      [s.name, s.slug, regionId, s.areaLabel, s.lat, s.lng, s.nearestStation, s.nearestStationMeters,
       s.priceMin, s.priceMax, s.minCap, s.maxCap, s.hasParking ? 1 : 0],
    );
    const [studioRows] = await conn.query<any[]>(`SELECT id FROM playground_studios WHERE slug = ? LIMIT 1`, [s.slug]);
    const studioId = studioRows[0].id;
    await conn.query(`DELETE FROM playground_studio_equipment WHERE studio_id = ?`, [studioId]);
    for (const e of s.equipment) {
      await conn.query(
        `INSERT INTO playground_studio_equipment (studio_id, equipment_type, equipment_name, quantity) VALUES (?,?,?,?)`,
        [studioId, e.type, e.name, e.qty],
      );
    }
  }

  const [[counts]] = await conn.query<any>(
    `SELECT (SELECT COUNT(*) FROM playground_studios) AS studios,
            (SELECT COUNT(*) FROM playground_studio_equipment) AS equipment,
            (SELECT COUNT(*) FROM playground_regions) AS regions`,
  );
  console.log("seeded:", counts);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 8: `package.json` 에 seed 스크립트 추가**

`scripts` 객체에 다음 줄 추가 (기존 `"bandname:seed": ...` 다음):

```json
    "rehearsal:seed": "tsx scripts/seed-rehearsal.ts"
```

- [ ] **Step 9: 시드 실행 (DEV)**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/seed/rehearsal_regions.sql
sudo -u ec2-user env PATH="$PATH" DB_HOST="$DB_HOST" DB_USER="$DB_USER" DB_PASS="$DB_PASS" DB_NAME="$DB_NAME" pnpm rehearsal:seed
```
Expected: `seeded: { studios: 7, equipment: >=25, regions: 19 }`.

- [ ] **Step 10: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/recommend.ts src/lib/playground/rehearsal/timeBucket.ts src/lib/playground/rehearsal/recommend.test.ts db/seed/rehearsal_regions.sql scripts/seed-rehearsal.ts package.json
sudo -u ec2-user git commit -m "feat(rehearsal): recommend orchestration + seed (regions/studios)"
```

---

## Task 10: API 라우트 (studios GET, recommend POST)

**Files:**
- Create: `src/app/api/playground/rehearsal/studios/route.ts`
- Create: `src/app/api/playground/rehearsal/recommend/route.ts`

- [ ] **Step 1: `studios/route.ts` 작성 (GET 검수용 목록)**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { listStudios } from "@/lib/playground/rehearsal/studios";
import { studioStatusEnum, equipmentTypeEnum } from "@/lib/playground/rehearsal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  region_id: z.coerce.number().int().positive().optional(),
  status: studioStatusEnum.optional(),
  keyword: z.string().max(80).optional(),
  equipment_type: equipmentTypeEnum.optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "bad_query" }, { status: 400 });
  const items = await listStudios({
    regionId: parsed.data.region_id, status: parsed.data.status,
    keyword: parsed.data.keyword, equipmentType: parsed.data.equipment_type,
  });
  return NextResponse.json({ items });
}
```

- [ ] **Step 2: `recommend/route.ts` 작성 (POST 추천)**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { recommendStudios } from "@/lib/playground/rehearsal/recommend";
import {
  transportModeEnum, originTypeEnum, equipmentTypeEnum,
} from "@/lib/playground/rehearsal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MemberSchema = z.object({
  nickname: z.string().min(1).max(40),
  originText: z.string().min(1).max(160),
  originLat: z.number().finite(),
  originLng: z.number().finite(),
  originType: originTypeEnum.default("manual"),
  transportMode: transportModeEnum.default("transit"),
});

const BodySchema = z.object({
  transportMode: transportModeEnum.default("transit"),
  maxBudgetPerHour: z.number().int().positive().nullable().default(null),
  requiredEquipment: z.array(equipmentTypeEnum).default([]),
  preferredRegionIds: z.array(z.number().int().positive()).default([]),
  members: z.array(MemberSchema).min(1).max(10),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const out = await recommendStudios(parsed.data);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: "recommend_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }
}
```

- [ ] **Step 3: 빌드 + 런타임 스모크 (DEV)**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user pnpm build 2>&1 | tail -5
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 3
# studios 목록
curl -s "http://127.0.0.1:3101/api/playground/rehearsal/studios?status=approved" | head -c 400; echo
# recommend (홍대/강남 출발 2인)
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" \
  -H 'content-type: application/json' \
  -d '{"transportMode":"transit","members":[{"nickname":"가","originText":"홍대입구역","originLat":37.5571,"originLng":126.9245,"originType":"station","transportMode":"transit"},{"nickname":"나","originText":"강남역","originLat":37.4979,"originLng":127.0276,"originType":"station","transportMode":"transit"}]}' | head -c 600; echo
```
Expected: studios 는 `{"items":[...7 studios...]}`, recommend 는 `{"searchId":N,"results":[{"rankNo":1,...}]}` (상위 5개, score 오름차순).

- [ ] **Step 4: Commit**

```bash
sudo -u ec2-user git add src/app/api/playground/rehearsal
sudo -u ec2-user git commit -m "feat(rehearsal): API routes (studios GET, recommend POST)"
```

---

## Task 11: 관리 CRUD (`/admin/(authed)/rehearsal-studios`)

**Files:**
- Create: `src/app/admin/(authed)/rehearsal-studios/actions.ts`
- Create: `src/app/admin/(authed)/rehearsal-studios/page.tsx`
- Create: `src/app/admin/(authed)/rehearsal-studios/new/page.tsx`
- Create: `src/app/admin/(authed)/rehearsal-studios/[id]/page.tsx`
- Create: `src/components/admin/RehearsalStudioForm.tsx`
- Modify: admin 네비게이션(있다면) — 사이드바 링크 추가

> **사전 확인:** admin 좌측 네비가 어디서 렌더되는지 확인. `sudo -u ec2-user grep -rn "/admin/quotes" src/app/admin src/components` 로 네비 컴포넌트를 찾아 `rehearsal-studios` 링크를 같은 패턴으로 추가한다(없으면 직접 URL 접근).

- [ ] **Step 1: `actions.ts` 작성**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { createStudio, updateStudio, type StudioWriteInput } from "@/lib/playground/rehearsal/studios";
import { equipmentTypeEnum, studioStatusEnum } from "@/lib/playground/rehearsal/types";

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

const intOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().nullable(),
);
const floatOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite().nullable(),
);
const strOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v)),
  z.string().nullable(),
);

const StudioSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(180).regex(/^[a-z0-9-]+$/, "소문자/숫자/하이픈만"),
  regionId: intOrNull,
  areaLabel: strOrNull,
  lat: floatOrNull,
  lng: floatOrNull,
  nearestStation: strOrNull,
  nearestStationMeters: intOrNull,
  hourlyPriceMin: intOrNull,
  hourlyPriceMax: intOrNull,
  minCapacity: intOrNull,
  maxCapacity: intOrNull,
  hasParking: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  parkingNote: strOrNull,
  status: studioStatusEnum,
  sourceNote: strOrNull,
  bookingUrl: strOrNull,
  mapUrl: strOrNull,
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function parseEquipment(fd: FormData): StudioWriteInput["equipment"] {
  const types = fd.getAll("equipmentType").map(String);
  const names = fd.getAll("equipmentName").map(String);
  const qtys = fd.getAll("equipmentQty").map(String);
  const out: StudioWriteInput["equipment"] = [];
  for (let i = 0; i < types.length; i++) {
    const t = equipmentTypeEnum.safeParse(types[i]);
    if (!t.success || !types[i]) continue;
    out.push({
      equipmentType: t.data,
      equipmentName: names[i] && names[i] !== "" ? names[i] : null,
      quantity: Number(qtys[i]) > 0 ? Number(qtys[i]) : 1,
      note: null,
    });
  }
  return out;
}

function fromForm(fd: FormData) {
  return {
    name: fd.get("name") ?? "", slug: fd.get("slug") ?? "",
    regionId: fd.get("regionId"), areaLabel: fd.get("areaLabel"),
    lat: fd.get("lat"), lng: fd.get("lng"),
    nearestStation: fd.get("nearestStation"), nearestStationMeters: fd.get("nearestStationMeters"),
    hourlyPriceMin: fd.get("hourlyPriceMin"), hourlyPriceMax: fd.get("hourlyPriceMax"),
    minCapacity: fd.get("minCapacity"), maxCapacity: fd.get("maxCapacity"),
    hasParking: fd.get("hasParking"), parkingNote: fd.get("parkingNote"),
    status: fd.get("status") ?? "candidate", sourceNote: fd.get("sourceNote"),
    bookingUrl: fd.get("bookingUrl"), mapUrl: fd.get("mapUrl"),
  };
}

function validationErrors(r: z.SafeParseError<unknown>): FormState {
  const fe: Record<string, string> = {};
  for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
  return { error: "검증 실패", fieldErrors: fe };
}

export async function createRehearsalStudio(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = StudioSchema.safeParse(fromForm(fd));
  if (!r.success) return validationErrors(r);
  await createStudio({ ...r.data, equipment: parseEquipment(fd) });
  revalidatePath("/admin/rehearsal-studios");
  redirect("/admin/rehearsal-studios");
}

export async function updateRehearsalStudio(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = StudioSchema.safeParse(fromForm(fd));
  if (!r.success) return validationErrors(r);
  await updateStudio(id, { ...r.data, equipment: parseEquipment(fd) });
  revalidatePath("/admin/rehearsal-studios");
  revalidatePath(`/admin/rehearsal-studios/${id}`);
  redirect("/admin/rehearsal-studios");
}
```

- [ ] **Step 2: `RehearsalStudioForm.tsx` 작성 (장비 동적 행)**

```tsx
"use client";
import { useActionState, useState } from "react";
import { buttonClasses } from "@/components/Button";
import {
  EQUIPMENT_TYPES, EQUIPMENT_LABELS, STUDIO_STATUSES, type Studio,
} from "@/lib/playground/rehearsal/types";
import type { FormState } from "@/app/admin/(authed)/rehearsal-studios/actions";

type Region = { id: number; displayName: string };
type EquipRow = { type: string; name: string; qty: number };

export default function RehearsalStudioForm({
  studio, regions, action, submitLabel,
}: {
  studio?: Studio;
  regions: Region[];
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [rows, setRows] = useState<EquipRow[]>(
    studio?.equipment.map((e) => ({ type: e.equipmentType, name: e.equipmentName ?? "", qty: e.quantity })) ?? [],
  );
  const err = (k: string) => state.fieldErrors?.[k];
  const input = "border border-[var(--color-border-strong)] px-3 py-2 w-full text-sm";
  const label = "block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1";

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>이름</label>
          <input name="name" defaultValue={studio?.name} className={input} required />
          {err("name") && <p className="text-xs text-red-600">{err("name")}</p>}</div>
        <div><label className={label}>slug</label>
          <input name="slug" defaultValue={studio?.slug} className={input} required />
          {err("slug") && <p className="text-xs text-red-600">{err("slug")}</p>}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>지역</label>
          <select name="regionId" defaultValue={studio?.regionId ?? ""} className={input}>
            <option value="">(없음)</option>
            {regions.map((rg) => <option key={rg.id} value={rg.id}>{rg.displayName}</option>)}
          </select></div>
        <div><label className={label}>지역 라벨(area_label)</label>
          <input name="areaLabel" defaultValue={studio?.areaLabel ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>위도(lat)</label>
          <input name="lat" type="number" step="any" defaultValue={studio?.lat ?? ""} className={input} /></div>
        <div><label className={label}>경도(lng)</label>
          <input name="lng" type="number" step="any" defaultValue={studio?.lng ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>최근접 역</label>
          <input name="nearestStation" defaultValue={studio?.nearestStation ?? ""} className={input} /></div>
        <div><label className={label}>역까지 거리(m)</label>
          <input name="nearestStationMeters" type="number" defaultValue={studio?.nearestStationMeters ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>시간당 최저가</label>
          <input name="hourlyPriceMin" type="number" defaultValue={studio?.hourlyPriceMin ?? ""} className={input} /></div>
        <div><label className={label}>시간당 최고가</label>
          <input name="hourlyPriceMax" type="number" defaultValue={studio?.hourlyPriceMax ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>최소 인원</label>
          <input name="minCapacity" type="number" defaultValue={studio?.minCapacity ?? ""} className={input} /></div>
        <div><label className={label}>최대 인원</label>
          <input name="maxCapacity" type="number" defaultValue={studio?.maxCapacity ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div><label className={label}>상태</label>
          <select name="status" defaultValue={studio?.status ?? "candidate"} className={input}>
            {STUDIO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hasParking" defaultChecked={studio?.hasParking ?? false} /> 주차 가능
        </label>
      </div>

      <div><label className={label}>주차 메모</label>
        <input name="parkingNote" defaultValue={studio?.parkingNote ?? ""} className={input} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>예약 URL</label>
          <input name="bookingUrl" defaultValue={studio?.bookingUrl ?? ""} className={input} /></div>
        <div><label className={label}>지도 URL</label>
          <input name="mapUrl" defaultValue={studio?.mapUrl ?? ""} className={input} /></div>
      </div>
      <div><label className={label}>출처 메모</label>
        <input name="sourceNote" defaultValue={studio?.sourceNote ?? ""} className={input} /></div>

      {/* 장비 동적 행 */}
      <fieldset className="border border-[var(--color-border)] p-4">
        <legend className="text-xs uppercase tracking-wider px-2">보유 장비</legend>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_40px] gap-2 items-center">
              <select name="equipmentType" defaultValue={row.type} className={input}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{EQUIPMENT_LABELS[t]}</option>)}
              </select>
              <input name="equipmentName" defaultValue={row.name} placeholder="모델명(선택)" className={input} />
              <input name="equipmentQty" type="number" min="1" defaultValue={row.qty} className={input} />
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-red-600 text-sm">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows([...rows, { type: "DRUM_SET", name: "", qty: 1 }])}
          className="mt-3 text-sm border border-[var(--color-border-strong)] px-3 py-1">+ 장비 추가</button>
      </fieldset>

      <button type="submit" className={buttonClasses("primary")}>{submitLabel}</button>
    </form>
  );
}
```

> 주의: `setRows` 삭제/추가 후 남은 행의 `defaultValue` 는 React 키 인덱스 변동으로 깨질 수 있으나, 폼 제출은 DOM 의 현재 `name=equipment*` 값을 `getAll` 로 읽으므로 저장에는 영향 없음. (편집 UX 단순화 — 행 추가/삭제만 지원, 인라인 재정렬 없음.)

- [ ] **Step 3: `page.tsx` (목록) 작성**

```tsx
import Link from "next/link";
import { listStudios } from "@/lib/playground/rehearsal/studios";

export const dynamic = "force-dynamic";

export default async function RehearsalStudiosListPage() {
  const studios = await listStudios({});
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Rehearsal Studios</h1>
        <Link href="/admin/rehearsal-studios/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
          + 새로 추가
        </Link>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr><th className="py-2">이름</th><th className="py-2 w-32">지역</th><th className="py-2 w-24">가격</th>
            <th className="py-2 w-20">인원</th><th className="py-2 w-24">상태</th><th className="py-2 w-16 text-right">동작</th></tr>
        </thead>
        <tbody>
          {studios.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{s.name}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.regionName ?? "—"}</td>
              <td className="py-3">{s.hourlyPriceMin ? `${s.hourlyPriceMin.toLocaleString("ko-KR")}~` : "—"}</td>
              <td className="py-3">{s.maxCapacity ?? "—"}</td>
              <td className="py-3">{s.status}</td>
              <td className="py-3 text-right">
                <Link href={`/admin/rehearsal-studios/${s.id}`}
                  className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
```

- [ ] **Step 4: `new/page.tsx` 작성**

```tsx
import RehearsalStudioForm from "@/components/admin/RehearsalStudioForm";
import { listRegions } from "@/lib/playground/rehearsal/regions";
import { createRehearsalStudio } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRehearsalStudioPage() {
  const regions = await listRegions();
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 합주실</h1>
      <RehearsalStudioForm
        regions={regions.map((r) => ({ id: r.id, displayName: r.displayName }))}
        action={createRehearsalStudio} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: `[id]/page.tsx` 작성**

```tsx
import { notFound } from "next/navigation";
import RehearsalStudioForm from "@/components/admin/RehearsalStudioForm";
import { getStudioById } from "@/lib/playground/rehearsal/studios";
import { listRegions } from "@/lib/playground/rehearsal/regions";
import { updateRehearsalStudio } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditRehearsalStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const [studio, regions] = await Promise.all([getStudioById(numId), listRegions()]);
  if (!studio) notFound();
  const action = updateRehearsalStudio.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">합주실 편집</h1>
      <RehearsalStudioForm studio={studio}
        regions={regions.map((r) => ({ id: r.id, displayName: r.displayName }))}
        action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 6: 빌드 + 수동 검증 (DEV)**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user pnpm build 2>&1 | tail -5
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3101/admin/rehearsal-studios"
```
Expected: 빌드 성공, `/admin/rehearsal-studios` 는 인증 리다이렉트(307/302) 또는 로그인 후 200. 브라우저에서 로그인 후 목록·추가·편집 동작 확인(`https://dev.bandsustain.com/admin/rehearsal-studios`).

- [ ] **Step 7: Commit**

```bash
sudo -u ec2-user git add src/app/admin/\(authed\)/rehearsal-studios src/components/admin/RehearsalStudioForm.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): admin CRUD for studios"
```

---

## Task 12: 추천 UI (`/playground/rehearsal-finder`) + dev 게이트 + 허브 카드

**Files:**
- Create: `src/lib/playground/rehearsalFlag.ts`
- Create: `src/app/playground/rehearsal-finder/page.tsx`
- Create: `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx`
- Modify: `src/lib/playground.ts` (허브 카드, 게이트)
- Modify: `ecosystem.config.js` (DEV-only env 플래그)

- [ ] **Step 1: `rehearsalFlag.ts` 작성 (dev 게이트 헬퍼)**

```typescript
// dev 전용 노출 게이트. ecosystem.config.js(DEV-only, --skip-worktree)에만
// REHEARSAL_FINDER_ENABLED="1" 이 설정됨 → PROD ecosystem 엔 없으므로 PROD 자동 숨김.
export function isRehearsalFinderEnabled(): boolean {
  return process.env.REHEARSAL_FINDER_ENABLED === "1";
}
```

- [ ] **Step 2: `ecosystem.config.js` 에 env 추가 (DEV-only 파일)**

`env` 객체에 한 줄 추가:

```javascript
      env: {
        NODE_ENV: "production",
        PORT: 3101,
        DB_CREDENTIALS_PATH: "/var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials",
        REHEARSAL_FINDER_ENABLED: "1",
      },
```

> `ecosystem.config.js` 는 git `--skip-worktree` 상태(MEMORY 참조) — 커밋하지 않는다. `git status` 에 안 떠야 정상. 떠 있으면 `sudo -u ec2-user git update-index --skip-worktree ecosystem.config.js` 재적용.

- [ ] **Step 3: 허브 카드 등록 (`src/lib/playground.ts`)**

`playgroundFeatures` 배열에 항목 추가 + 게이트 적용. 파일 하단에 게이트 헬퍼 export 추가:

```typescript
// import 추가 (파일 상단)
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsalFlag";
```

`playgroundFeatures` 배열 끝에 항목 추가:

```typescript
  {
    slug: "rehearsal-finder",
    title: "합주실 추천",
    description: "멤버들의 출발 위치를 입력하면 이동시간·가격·장비를 고려해 합주실을 추천해드려요.",
    cta: "합주실 찾으러 가기",
    eyebrow: "이상한 도구",
    href: "/playground/rehearsal-finder",
  },
```

파일 하단에 게이트된 노출용 헬퍼 추가(허브 페이지에서 사용):

```typescript
export function visiblePlaygroundFeatures(): PlaygroundFeature[] {
  return playgroundFeatures.filter(
    (f) => f.slug !== "rehearsal-finder" || isRehearsalFinderEnabled(),
  );
}
```

- [ ] **Step 4: 허브 페이지가 게이트 헬퍼를 쓰도록 수정 (`src/app/playground/page.tsx`)**

`playgroundFeatures` 직접 map 하던 부분을 `visiblePlaygroundFeatures()` 로 교체:

```tsx
// import 교체
import { visiblePlaygroundFeatures, type PlaygroundFeature } from "@/lib/playground";
// ...
        {visiblePlaygroundFeatures().map((f) => (
          <PlaygroundCard key={f.slug} feature={f} />
        ))}
```

> `page.tsx` 가 정적 메타+서버 컴포넌트이므로 `dynamic = "force-dynamic"` 추가 필요할 수 있음(env 런타임 평가). 파일 상단에 `export const dynamic = "force-dynamic";` 가 없으면 추가.

- [ ] **Step 5: `rehearsal-finder/page.tsx` 작성 (서버: 게이트 + 메타)**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsalFlag";
import { listRegions } from "@/lib/playground/rehearsal/regions";
import { EQUIPMENT_TYPES, EQUIPMENT_LABELS } from "@/lib/playground/rehearsal/types";
import RehearsalFinderClient from "./RehearsalFinderClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "합주실 추천",
  path: "/playground/rehearsal-finder",
  description: "멤버 출발 위치 기반 합주실 추천 (베타).",
  keywords: ["합주실 추천", "밴드 합주실"],
});

export default async function RehearsalFinderPage() {
  if (!isRehearsalFinderEnabled()) notFound();
  const regions = await listRegions();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">합주실 추천</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">멤버들의 출발 위치(좌표)를 입력하면 이동시간·가격·장비로 순위를 매겨드려요. (베타 · MockRouteProvider)</p>
      </header>
      <RehearsalFinderClient
        regions={regions.map((r) => ({ id: r.id, displayName: r.displayName }))}
        equipmentOptions={EQUIPMENT_TYPES.map((t) => ({ value: t, label: EQUIPMENT_LABELS[t] }))}
      />
    </section>
  );
}
```

- [ ] **Step 6: `RehearsalFinderClient.tsx` 작성 (클라 폼/결과)**

```tsx
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";

type Region = { id: number; displayName: string };
type EquipOption = { value: string; label: string };
type MemberForm = { nickname: string; originText: string; originLat: string; originLng: string };

type ResultItem = {
  rankNo: number;
  studio: { name: string; regionName: string | null; areaLabel: string | null; bookingUrl: string | null; mapUrl: string | null; hourlyPriceMin: number | null; equipment: { equipmentType: string }[] };
  avgMinutes: number; maxMinutes: number; reason: string;
  memberRoutes: { nickname: string; route: { travelMinutes: number } }[];
};

export default function RehearsalFinderClient({ regions, equipmentOptions }: { regions: Region[]; equipmentOptions: EquipOption[] }) {
  const [members, setMembers] = useState<MemberForm[]>([
    { nickname: "", originText: "", originLat: "", originLng: "" },
    { nickname: "", originText: "", originLat: "", originLng: "" },
  ]);
  const [transportMode, setTransportMode] = useState("transit");
  const [maxBudget, setMaxBudget] = useState("");
  const [requiredEquipment, setRequiredEquipment] = useState<string[]>([]);
  const [preferredRegionIds, setPreferredRegionIds] = useState<number[]>([]);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const input = "border border-[var(--color-border-strong)] px-3 py-2 text-sm";

  async function submit() {
    setError(null); setLoading(true); setResults(null);
    try {
      const payload = {
        transportMode,
        maxBudgetPerHour: maxBudget ? Number(maxBudget) : null,
        requiredEquipment,
        preferredRegionIds,
        members: members
          .filter((m) => m.nickname && m.originLat && m.originLng)
          .map((m) => ({
            nickname: m.nickname, originText: m.originText || m.nickname,
            originLat: Number(m.originLat), originLng: Number(m.originLng),
            originType: "manual", transportMode,
          })),
      };
      if (payload.members.length === 0) { setError("닉네임+좌표가 채워진 멤버가 최소 1명 필요합니다."); return; }
      const res = await fetch("/api/playground/rehearsal/recommend", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "추천 실패"); return; }
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      {/* 멤버 입력 */}
      <div>
        <h2 className="font-display font-bold text-xl mb-3">멤버 출발지 (최대 10명)</h2>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_1fr_40px] gap-2">
              <input placeholder="닉네임" value={m.nickname} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, nickname: e.target.value } : x))} />
              <input placeholder="출발지(메모)" value={m.originText} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, originText: e.target.value } : x))} />
              <input placeholder="위도" value={m.originLat} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, originLat: e.target.value } : x))} />
              <input placeholder="경도" value={m.originLng} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, originLng: e.target.value } : x))} />
              <button type="button" className="text-red-600"
                onClick={() => setMembers(members.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        {members.length < 10 && (
          <button type="button" className="mt-2 text-sm border border-[var(--color-border-strong)] px-3 py-1"
            onClick={() => setMembers([...members, { nickname: "", originText: "", originLat: "", originLng: "" }])}>+ 멤버 추가</button>
        )}
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">※ 현재는 좌표(위도/경도)를 직접 입력합니다. (주소→좌표 변환은 추후)</p>
      </div>

      {/* 조건 */}
      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="block text-xs uppercase tracking-wider mb-1">이동수단</label>
          <select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className={`${input} w-full`}>
            <option value="transit">대중교통</option><option value="car">자동차</option><option value="mixed">혼합</option>
          </select></div>
        <div><label className="block text-xs uppercase tracking-wider mb-1">시간당 예산(원)</label>
          <input value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="예: 25000" className={`${input} w-full`} /></div>
        <div><label className="block text-xs uppercase tracking-wider mb-1">선호 지역</label>
          <select multiple value={preferredRegionIds.map(String)} className={`${input} w-full h-24`}
            onChange={(e) => setPreferredRegionIds(Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.displayName}</option>)}
          </select></div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider mb-1">필수 장비</label>
        <div className="flex flex-wrap gap-2">
          {equipmentOptions.map((e) => {
            const on = requiredEquipment.includes(e.value);
            return (
              <button key={e.value} type="button"
                onClick={() => setRequiredEquipment(on ? requiredEquipment.filter((x) => x !== e.value) : [...requiredEquipment, e.value])}
                className={`px-3 py-1 text-sm border ${on ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border-strong)]"}`}>
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" onClick={submit} disabled={loading} className={buttonClasses("accent")}>
        {loading ? "추천 중…" : "합주실 추천받기"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl">추천 결과 {results.length}곳</h2>
          {results.length === 0 && <p className="text-[var(--color-text-muted)]">조건에 맞는 합주실이 없어요. 예산/장비/지역 조건을 완화해보세요.</p>}
          {results.map((r) => (
            <div key={r.rankNo} className="border border-[var(--color-border)] p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display font-bold text-lg">{r.rankNo}. {r.studio.name}</h3>
                <span className="text-sm text-[var(--color-text-muted)]">{r.studio.regionName ?? r.studio.areaLabel ?? ""}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-accent)]">{r.reason}</p>
              <p className="mt-2 text-sm">평균 이동 {Math.round(r.avgMinutes)}분 · 최대 {Math.round(r.maxMinutes)}분
                {r.studio.hourlyPriceMin ? ` · 시간당 ${r.studio.hourlyPriceMin.toLocaleString("ko-KR")}원~` : ""}</p>
              <ul className="mt-2 text-xs text-[var(--color-text-muted)] flex flex-wrap gap-x-4">
                {r.memberRoutes.map((mr, i) => <li key={i}>{mr.nickname}: {mr.route.travelMinutes}분</li>)}
              </ul>
              <div className="mt-3 flex gap-3 text-sm">
                {r.studio.mapUrl && <a href={r.studio.mapUrl} target="_blank" rel="noreferrer" className="underline">지도</a>}
                {r.studio.bookingUrl && <a href={r.studio.bookingUrl} target="_blank" rel="noreferrer" className="underline">예약</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: 빌드 + 수동 검증 (DEV)**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user pnpm build 2>&1 | tail -5
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 3
# dev 에선 라우트 200 (env 플래그 1)
curl -s -o /dev/null -w "rehearsal-finder: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
# 허브에 카드 노출 확인
curl -s "http://127.0.0.1:3101/playground" | grep -c "합주실 추천" || echo "card not found"
```
Expected: `rehearsal-finder: 200`, 허브에 "합주실 추천" 1회 이상. 브라우저(`https://dev.bandsustain.com/playground/rehearsal-finder`)에서 멤버 좌표(예: 홍대 37.5571/126.9245, 강남 37.4979/127.0276) 입력 → 추천 결과 표시 확인.

- [ ] **Step 8: 전체 테스트 재확인**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
for f in geo scoring reason route-provider ranker recommend; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)";
done
```
Expected: 각 파일 `# fail 0`.

- [ ] **Step 9: Commit + dev push**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsalFlag.ts src/app/playground/rehearsal-finder src/lib/playground.ts src/app/playground/page.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): finder UI + dev gate + hub card"
sudo -u ec2-user git push origin dev
```

> **⛔ 여기서 멈춤.** dev push 후 사용자에게 `https://dev.bandsustain.com/playground/rehearsal-finder` 확인 요청.
> main 머지(운영 반영)는 사용자가 명시 요청 시에만. PROD ecosystem 엔 `REHEARSAL_FINDER_ENABLED` 가 없으므로 머지되어도 PROD 에선 카드/라우트가 숨겨진다(404).

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지:** 7 테이블(T1) · enum 상수(T2) · geo(T3) · scoring(T4) · reason(T5) · route-provider+Mock+골격(T6) · 필터/prefilter/랭킹(T7) · DB 레이어+캐시(T8) · recommend 오케스트레이션+seed(T9) · API 2종(T10) · admin CRUD(T11) · UI+dev게이트+허브카드(T12). 설계문서 §의 모든 항목에 대응 태스크 존재.
- **타입 일관성:** `Studio`/`RouteResult`/`StudioScore`/`RecommendConditions`/`RankedStudio` 시그니처가 T2~T12 전체에서 동일. `rankStudios`/`scoreStudioForGroup`/`generateRecommendationReason` 인자명 일치. DB 컬럼 `rank_no`(예약어 회피) 일관.
- **플레이스홀더:** TODO 는 외부 API 골격(T6 Transit/Car provider)·geocode 인터페이스에 한정 — 의도된 미구현 자리이며 본 슬라이스 범위 밖임을 명시. 그 외 모든 스텝에 실제 코드 포함.
- **알려진 단순화:** 좌표는 직접 입력(geocode 추후), MockRouteProvider 직선거리 기반, 장비 행 인라인 재정렬 미지원, timeBucket 테스트는 KST 서버 기준.
