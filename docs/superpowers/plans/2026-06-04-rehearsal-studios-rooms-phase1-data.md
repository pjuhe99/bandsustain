# 합주실 데이터(방 단위) — Phase 1: 데이터 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> 이 플랜은 설계문서 `docs/superpowers/specs/2026-06-04-rehearsal-studios-rooms-detail-design.md` 의 **Phase 1(데이터 기반)** 만 다룬다. Phase 2(백엔드 집계·추천·응답)·Phase 3(카드·모달)은 Phase 1 완료 후 별도 플랜.

**Goal:** 노션 CSV(20곳/47방)를 합주실→방 구조로 DEV DB에 적재한다 — 스키마 020 + 커밋된 데이터(좌표·장비분류) + 멱등 임포트.

**Architecture:** `playground_studios` 컬럼 확장 + 신규 `playground_studio_rooms`. 외부 의존(노션 CSV·Naver 좌표·장비 타입)은 **커밋된 데이터 파일**로 고정해 임포트를 오프라인·재현 가능하게. 순수 변환 헬퍼(CSV행→합주실/방, 가격·주차 파싱, 공통접두사, 장비 타입)는 node:test.

**Tech Stack:** MariaDB(raw mysql2) · TypeScript · tsx · node:test.

**작업 규칙(MEMORY bandsustain):** `bandsustain-dev`(dev 브랜치, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/tsx/mysql 은 `sudo -u ec2-user`. **DB 변경은 DEV 만**(PROD 반영은 사용자 명시 요청 시). 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지.

**DEV DB 자격증명:** `set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a` → `mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"` (또는 tsx 스크립트가 `.db_credentials` 로드).

**저장소 루트(`<repo>`):** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

**노션 CSV 원본:** `/var/www/html/_______site_BANDSUSTAIN/합주실 리스트 e0d759ac1f7b49f9a4455e3ebbadc828.csv` (UTF-8, 47방).

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `db/schema/020_rehearsal_rooms.sql` | studios 컬럼 추가 + rooms 테이블 (멱등) | Create |
| `src/lib/playground/rehearsal/types.ts` | `RoomEquipmentType` union + `ROOM_EQUIPMENT_LABELS` | Modify |
| `src/lib/playground/rehearsal/gearClassify.ts` | gear name → RoomEquipmentType (커밋 맵 사용, 순수) | Create |
| `src/lib/playground/rehearsal/gearClassify.test.ts` | 분류 단위테스트 | Create |
| `scripts/data/equipment-classification.json` | 140개 `{ "<gear>": "<type>" }` (컨트롤러 생성) | Create |
| `scripts/data/rehearsal-studios.csv` | 노션 CSV vendor 사본 | Create |
| `scripts/data/rehearsal-studio-coords.json` | 20곳 `{ "<studio>": {lat,lng,roadAddress,homepageUrl} }` (Naver, 컨트롤러 생성) | Create |
| `src/lib/playground/rehearsal/studioImport.ts` | CSV행→합주실/방 순수 변환 (그룹핑·접두사·가격·주차) | Create |
| `src/lib/playground/rehearsal/studioImport.test.ts` | 변환 단위테스트 | Create |
| `scripts/import-rehearsal-studios.ts` | DEV DB 적재(트랜잭션 교체) | Create |

> **컨트롤러 선행 작업(서브에이전트 아님):** `equipment-classification.json`(140 gear→type)과 `rehearsal-studio-coords.json`(20곳 Naver 좌표/주소)은 MCP(Naver)·도메인 지식이 필요하므로 **컨트롤러가 실행 중 직접 생성·커밋**한다. Task 2/Task 3 가 그 산출물을 소비한다.

---

## Task 1: 스키마 020 (studios 확장 + rooms)

**Files:** Create `<repo>/db/schema/020_rehearsal_rooms.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 020 합주실 방(room) 구조 + 합주실 추가 메타. 멱등.
-- studios.id 는 INT UNSIGNED → 방 FK 동일 타입.

-- 1) studios 컬럼 추가 (존재 시 무시되도록 동적 ADD)
SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playground_studios' AND COLUMN_NAME = 'road_address'),
  'ALTER TABLE playground_studios
     ADD COLUMN road_address  VARCHAR(255) NULL AFTER area_label,
     ADD COLUMN booking_method VARCHAR(120) NULL AFTER booking_url,
     ADD COLUMN amenities      VARCHAR(120) NULL AFTER booking_method,
     ADD COLUMN homepage_url   VARCHAR(255) NULL AFTER map_url',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) rooms 테이블
CREATE TABLE IF NOT EXISTS playground_studio_rooms (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  studio_id      INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  hourly_price   INT UNSIGNED NULL,
  capacity       INT UNSIGNED NULL,
  equipment_json JSON NULL,
  review         TEXT NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_room_studio (studio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: DEV 적용**

```bash
cd <repo>
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
sudo -u ec2-user bash -c "set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; mysql -u\"\$DB_USER\" -p\"\$DB_PASS\" \"\$DB_NAME\" < db/schema/020_rehearsal_rooms.sql"
```
Expected: 에러 없음. 재실행해도 멱등(컬럼 중복 추가 안 함, 테이블 IF NOT EXISTS).

- [ ] **Step 3: 적용 검증**

```bash
sudo -u ec2-user bash -c "set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; mysql -u\"\$DB_USER\" -p\"\$DB_PASS\" \"\$DB_NAME\" -e \"SHOW COLUMNS FROM playground_studios LIKE 'road_address'; SHOW COLUMNS FROM playground_studios LIKE 'booking_method'; SHOW TABLES LIKE 'playground_studio_rooms';\""
```
Expected: road_address·booking_method 컬럼 존재, playground_studio_rooms 테이블 존재.

- [ ] **Step 4: Commit**

```bash
cd <repo>
chown ec2-user:ec2-user db/schema/020_rehearsal_rooms.sql
sudo -u ec2-user git add db/schema/020_rehearsal_rooms.sql
sudo -u ec2-user git commit -m "feat(rehearsal): schema 020 — studio rooms table + studio meta columns"
```

---

## Task 2: 장비 타입 + 분류 헬퍼 (`types.ts`, `gearClassify.ts`) — TDD

**Files:**
- Modify: `<repo>/src/lib/playground/rehearsal/types.ts`
- Create: `<repo>/src/lib/playground/rehearsal/gearClassify.ts`, `gearClassify.test.ts`
- Consume (컨트롤러 선행 생성): `<repo>/scripts/data/equipment-classification.json`

> **컨트롤러 선행:** `scripts/data/equipment-classification.json` = 노션 CSV 의 고유 장비 140개를 `DRUM|GUITAR_AMP|BASS_AMP|KEYBOARD|ETC` 로 분류한 `{ "<gear name>": "<type>" }`. 캐비넷은 해당 앰프 타입에 흡수. (컨트롤러가 도메인 지식으로 생성·커밋.) 형식 예: `{ "Ampeg SVT810E": "BASS_AMP", "Pearl Masters": "DRUM", "Marshall JCM2000 DSL": "GUITAR_AMP", "YAMAHA MOTIF7": "KEYBOARD" }`.

- [ ] **Step 1: `types.ts` 에 타입 추가** — 파일 끝에 추가:

```ts
export const ROOM_EQUIPMENT_TYPES = ["DRUM", "GUITAR_AMP", "BASS_AMP", "KEYBOARD", "ETC"] as const;
export type RoomEquipmentType = (typeof ROOM_EQUIPMENT_TYPES)[number];
export const ROOM_EQUIPMENT_LABELS: Record<RoomEquipmentType, string> = {
  DRUM: "드럼", GUITAR_AMP: "기타앰프", BASS_AMP: "베이스앰프", KEYBOARD: "키보드", ETC: "그외",
};
export type RoomGear = { name: string; type: RoomEquipmentType };
```

- [ ] **Step 2: 실패 테스트 작성** — `gearClassify.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { classifyGear, classifyGearList } from "./gearClassify";

test("classifyGear: 매핑된 장비는 해당 타입", () => {
  assert.equal(classifyGear("Ampeg SVT810E"), "BASS_AMP");
  assert.equal(classifyGear("Pearl Masters"), "DRUM");
  assert.equal(classifyGear("Marshall JCM2000 DSL"), "GUITAR_AMP");
  assert.equal(classifyGear("YAMAHA MOTIF7"), "KEYBOARD");
});

test("classifyGear: 미매핑은 ETC", () => {
  assert.equal(classifyGear("듣도보도못한장비9999"), "ETC");
});

test("classifyGearList: 콤마 문자열 → RoomGear[] (트림·빈값 제거)", () => {
  const r = classifyGearList("Pearl Masters, Ampeg SVT810E ,, ");
  assert.deepEqual(r, [
    { name: "Pearl Masters", type: "DRUM" },
    { name: "Ampeg SVT810E", type: "BASS_AMP" },
  ]);
});
```

- [ ] **Step 3: 실패 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/gearClassify.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head
```
Expected: import 실패/fail.

- [ ] **Step 4: 구현** — `gearClassify.ts`:

```ts
import map from "../../../../scripts/data/equipment-classification.json";
import type { RoomEquipmentType, RoomGear } from "./types";

const TABLE = map as Record<string, RoomEquipmentType>;

export function classifyGear(name: string): RoomEquipmentType {
  return TABLE[name.trim()] ?? "ETC";
}

export function classifyGearList(raw: string): RoomGear[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name, type: classifyGear(name) }));
}
```
> 주: import 경로는 repo 루트의 `scripts/data/...` 기준 상대경로. tsconfig `resolveJsonModule` 활성(기존 사용). 경로 깊이가 안 맞으면 빌드 에러로 드러나니 조정.

- [ ] **Step 5: 통과 확인 + 분류 커버리지 로그**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/gearClassify.test.ts 2>&1 | grep -E "# (pass|fail)"
# 노션 CSV 전 장비 중 ETC(미분류) 비율 확인 (참고용)
sudo -u ec2-user npx tsx -e '
import { classifyGearList } from "./src/lib/playground/rehearsal/gearClassify";
import { readFileSync } from "node:fs";
const csv = readFileSync("scripts/data/rehearsal-studios.csv","utf-8");
' 2>/dev/null || echo "(커버리지 로그는 Task4 임포트에서 확인)"
```
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/gearClassify.ts src/lib/playground/rehearsal/gearClassify.test.ts scripts/data/equipment-classification.json
sudo -u ec2-user git add src/lib/playground/rehearsal/types.ts src/lib/playground/rehearsal/gearClassify.ts src/lib/playground/rehearsal/gearClassify.test.ts scripts/data/equipment-classification.json
sudo -u ec2-user git commit -m "feat(rehearsal): room equipment types + gear classification (140-item map, TDD)"
```

---

## Task 3: CSV vendor + 합주실 좌표 (컨트롤러 데이터)

**Files:**
- Create: `<repo>/scripts/data/rehearsal-studios.csv`
- Create (컨트롤러): `<repo>/scripts/data/rehearsal-studio-coords.json`

- [ ] **Step 1: CSV vendor**

```bash
cd <repo>
cp "/var/www/html/_______site_BANDSUSTAIN/합주실 리스트 e0d759ac1f7b49f9a4455e3ebbadc828.csv" scripts/data/rehearsal-studios.csv
chown ec2-user:ec2-user scripts/data/rehearsal-studios.csv
head -1 scripts/data/rehearsal-studios.csv
```
Expected: 헤더 `합주실 이름,가격(시간당),기타 정보,네이버 지도,수용 인원 (오피셜),예약 방식,위치,장비,후기(요약)`.

- [ ] **Step 2: 좌표 JSON (컨트롤러 선행 생성)**

`scripts/data/rehearsal-studio-coords.json` = 20개 합주실명 → `{ lat, lng, roadAddress, homepageUrl }`. 컨트롤러가 Naver 지역검색으로 합주실명 조회(카테고리 음악/합주실/장소대여/악기대여 확인) 후 `mapx/1e7`=lng, `mapy/1e7`=lat, `roadAddress`, `link`=homepageUrl 로 작성. 합주실명은 Task 4 의 공통접두사 추출 결과와 **정확히 일치**해야 함(아래 20개 키):
`뉴잭사운드, 엠플사운드, 고니뮤직랩, 유앤미 뮤직앤미디어 스튜디오, 텐마일즈 합주실, 그루브합주실 사당점, 그루브합주실 방배점, 윤악당, 아지트합주실, Azi Studio, 107밴드센터, 사운딕트, 비쥬합주실 1호점, 비쥬합주실 3호점, 엘뮤직 합주실, 비케이 합주실, 그라운드 합주실 합정 1호점, 스페이스 개러지, 리엠뮤직합주실 잠실석촌점, 드림합주실 사당점`.
형식 예:
```json
{
  "엠플사운드": { "lat": 37.4962069, "lng": 127.0394148, "roadAddress": "서울특별시 강남구 논현로 404 정안빌딩 B1", "homepageUrl": "http://www.mple.kr" }
}
```
> 못 찾는 합주실은 BLOCKED 로 보고(좌표 추정 금지). bbox(33<lat<39,124<lng<132) 밖이면 재확인.

- [ ] **Step 3: 형식 검증 + Commit**

```bash
cd <repo>
sudo -u ec2-user node -e 'const c=require("./scripts/data/rehearsal-studio-coords.json"); const ks=Object.keys(c); console.log("studios:",ks.length); for(const k of ks){const v=c[k]; if(!(v.lat>33&&v.lat<39&&v.lng>124&&v.lng<132)) throw new Error("OOR: "+k);} console.log("coords ok");'
chown ec2-user:ec2-user scripts/data/rehearsal-studio-coords.json
sudo -u ec2-user git add scripts/data/rehearsal-studios.csv scripts/data/rehearsal-studio-coords.json
sudo -u ec2-user git commit -m "data(rehearsal): vendor notion CSV + 20 studio coords/address (Naver)"
```
Expected: `studios: 20`, `coords ok`.

---

## Task 4: 임포트 변환 헬퍼 (`studioImport.ts`) — TDD

**Files:**
- Create: `<repo>/src/lib/playground/rehearsal/studioImport.ts`, `studioImport.test.ts`

> 순수 함수만(DB 없음). CSV 파싱 결과(행 객체 배열)를 받아 합주실/방 구조로 변환. DB 적재는 Task 5.

- [ ] **Step 1: 실패 테스트** — `studioImport.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parsePrice, parseHasParking, commonPrefix, buildStudios, type CsvRow } from "./studioImport";

test("parsePrice: ₩/콤마 제거 → int, 빈값 null", () => {
  assert.equal(parsePrice("₩15,000"), 15000);
  assert.equal(parsePrice("25000"), 25000);
  assert.equal(parsePrice(""), null);
});

test("parseHasParking: '주차 O' true, '주차 X' false", () => {
  assert.equal(parseHasParking("악기대여 O, 주차 O"), true);
  assert.equal(parseHasParking("악기대여 O, 주차 X"), false);
  assert.equal(parseHasParking(""), false);
});

test("commonPrefix: 방 이름들의 공통 접두사", () => {
  assert.equal(commonPrefix(["엠플사운드 A1 room", "엠플사운드 B1 room"]), "엠플사운드");
  assert.equal(commonPrefix(["뉴잭사운드"]), "뉴잭사운드");
});

test("buildStudios: 네이버링크 그룹핑 + 합주실/방 변환", () => {
  const rows: CsvRow[] = [
    { name: "엠플사운드 A1 room", price: "₩25,000", etc: "악기대여 O, 주차 O", naver: "https://naver.me/X", capacity: "10", booking: "사이트 예약", location: "서울, 역삼", gear: "Pearl Masters, Ampeg SVT810E", review: "좋음" },
    { name: "엠플사운드 B1 room", price: "₩23,000", etc: "악기대여 O, 주차 O", naver: "https://naver.me/X", capacity: "7", booking: "사이트 예약", location: "서울, 역삼", gear: "Marshall JCM2000 DSL", review: "" },
  ];
  const studios = buildStudios(rows);
  assert.equal(studios.length, 1);
  const s = studios[0];
  assert.equal(s.name, "엠플사운드");
  assert.equal(s.areaLabel, "서울, 역삼");
  assert.equal(s.hasParking, true);
  assert.equal(s.bookingMethod, "사이트 예약");
  assert.equal(s.mapUrl, "https://naver.me/X");
  assert.equal(s.priceMin, 23000);
  assert.equal(s.priceMax, 25000);
  assert.equal(s.rooms.length, 2);
  assert.deepEqual(s.rooms[0], {
    name: "A1 room", hourlyPrice: 25000, capacity: 10,
    equipment: [{ name: "Pearl Masters", type: "DRUM" }, { name: "Ampeg SVT810E", type: "BASS_AMP" }],
    review: "좋음", sortOrder: 0,
  });
  assert.equal(s.rooms[1].name, "B1 room");
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/studioImport.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head
```
Expected: import 실패/fail.

- [ ] **Step 3: 구현** — `studioImport.ts`:

```ts
import { classifyGearList } from "./gearClassify";
import type { RoomGear } from "./types";

export type CsvRow = {
  name: string; price: string; etc: string; naver: string;
  capacity: string; booking: string; location: string; gear: string; review: string;
};

export type ImportRoom = {
  name: string; hourlyPrice: number | null; capacity: number | null;
  equipment: RoomGear[]; review: string | null; sortOrder: number;
};
export type ImportStudio = {
  name: string; areaLabel: string; bookingMethod: string; amenities: string;
  hasParking: boolean; mapUrl: string;
  priceMin: number | null; priceMax: number | null; capacityMax: number | null;
  rooms: ImportRoom[];
};

export function parsePrice(s: string): number | null {
  const digits = s.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : null;
}

export function parseHasParking(etc: string): boolean {
  return /주차\s*O/.test(etc);
}

export function commonPrefix(names: string[]): string {
  if (names.length === 1) return names[0].trim();
  let p = names[0];
  for (const n of names.slice(1)) {
    let i = 0;
    while (i < p.length && i < n.length && p[i] === n[i]) i++;
    p = p.slice(0, i);
  }
  return p.trim();
}

export function buildStudios(rows: CsvRow[]): ImportStudio[] {
  // 네이버 링크로 그룹핑 (순서 보존)
  const groups = new Map<string, CsvRow[]>();
  for (const r of rows) {
    const key = r.naver.trim();
    const arr = groups.get(key);
    if (arr) arr.push(r); else groups.set(key, [r]);
  }
  const out: ImportStudio[] = [];
  for (const [naver, rs] of groups) {
    const studioName = commonPrefix(rs.map((r) => r.name));
    const rooms: ImportRoom[] = rs.map((r, i) => {
      const roomName = r.name.slice(studioName.length).trim() || "메인";
      return {
        name: roomName,
        hourlyPrice: parsePrice(r.price),
        capacity: r.capacity.trim() ? parseInt(r.capacity.replace(/[^0-9]/g, ""), 10) : null,
        equipment: classifyGearList(r.gear),
        review: r.review.trim() || null,
        sortOrder: i,
      };
    });
    const prices = rooms.map((x) => x.hourlyPrice).filter((x): x is number => x != null);
    const caps = rooms.map((x) => x.capacity).filter((x): x is number => x != null);
    out.push({
      name: studioName,
      areaLabel: rs[0].location.trim(),
      bookingMethod: rs[0].booking.trim(),
      amenities: rs[0].etc.trim(),
      hasParking: parseHasParking(rs[0].etc),
      mapUrl: naver,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      capacityMax: caps.length ? Math.max(...caps) : null,
      rooms,
    });
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/studioImport.test.ts 2>&1 | grep -E "# (pass|fail)"
```
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/studioImport.ts src/lib/playground/rehearsal/studioImport.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/studioImport.ts src/lib/playground/rehearsal/studioImport.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): pure CSV→studio/room transform (group/prefix/price/parking, TDD)"
```

---

## Task 5: DB 임포트 스크립트 (DEV 적재)

**Files:** Create `<repo>/scripts/import-rehearsal-studios.ts`

- [ ] **Step 1: 스크립트 작성**

```ts
/**
 * 노션 CSV → DEV DB 적재 (트랜잭션 교체). 멱등 재실행 가능.
 * 실행: cd <repo> && sudo -u ec2-user npx tsx scripts/import-rehearsal-studios.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { getPool } from "@/lib/db";
import { buildStudios, type CsvRow } from "@/lib/playground/rehearsal/studioImport";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const slugify = (s: string, i: number) =>
  "notion-" + i + "-" + s.replace(/[^a-zA-Z0-9가-힣]+/g, "-").toLowerCase().slice(0, 40);

async function main() {
  const csvPath = resolve(__dirname, "data/rehearsal-studios.csv");
  const coordsPath = resolve(__dirname, "data/rehearsal-studio-coords.json");
  const raw = parse(readFileSync(csvPath, "utf-8"), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const rows: CsvRow[] = raw.map((r) => ({
    name: r["합주실 이름"] ?? "", price: r["가격(시간당)"] ?? "", etc: r["기타 정보"] ?? "",
    naver: r["네이버 지도"] ?? "", capacity: r["수용 인원 (오피셜)"] ?? "", booking: r["예약 방식"] ?? "",
    location: r["위치"] ?? "", gear: r["장비"] ?? "", review: r["후기(요약)"] ?? "",
  }));
  const studios = buildStudios(rows);
  const coords = JSON.parse(readFileSync(coordsPath, "utf-8")) as Record<string, { lat: number; lng: number; roadAddress: string; homepageUrl: string | null }>;

  // 좌표 매칭 가드
  const missing = studios.filter((s) => !coords[s.name]);
  if (missing.length) throw new Error("coords 누락: " + missing.map((s) => s.name).join(", "));

  let etcCount = 0, gearCount = 0;
  for (const s of studios) for (const rm of s.rooms) for (const g of rm.equipment) { gearCount++; if (g.type === "ETC") etcCount++; }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 기존 노션 임포트 + mock 제거 (rooms 는 FK CASCADE 로 함께 삭제)
    await conn.query("DELETE FROM playground_studios");
    for (const s of studios) {
      const c = coords[s.name];
      const [res]: any = await conn.query(
        `INSERT INTO playground_studios
           (name, slug, area_label, road_address, lat, lng, hourly_price_min, hourly_price_max,
            min_capacity, max_capacity, has_parking, status, source_note, map_url, homepage_url, booking_method, amenities)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'approved', 'notion-import', ?,?,?,?)`,
        [s.name, slugify(s.name, studios.indexOf(s)), s.areaLabel, c.roadAddress, c.lat, c.lng,
         s.priceMin, s.priceMax, null, s.capacityMax, s.hasParking ? 1 : 0,
         s.mapUrl, c.homepageUrl, s.bookingMethod, s.amenities],
      );
      const studioId = res.insertId;
      for (const rm of s.rooms) {
        await conn.query(
          `INSERT INTO playground_studio_rooms (studio_id, name, hourly_price, capacity, equipment_json, review, sort_order)
           VALUES (?,?,?,?,?,?,?)`,
          [studioId, rm.name, rm.hourlyPrice, rm.capacity, JSON.stringify(rm.equipment), rm.review, rm.sortOrder],
        );
      }
    }
    await conn.commit();
    console.log(`적재 완료: 합주실 ${studios.length}곳, 방 ${studios.reduce((a, s) => a + s.rooms.length, 0)}개. 장비 ${gearCount}개 중 ETC ${etcCount}개.`);
  } catch (e) {
    await conn.rollback(); throw e;
  } finally {
    conn.release();
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
```
> 주: `csv-parse` 가 devDependency 에 없으면 Step 2 에서 추가. `@/` 별칭이 tsx 에서 안 풀리면 상대경로(`../src/lib/...`)로 교체. `getPool()` 은 `.db_credentials`(DEV) 를 로드(기존 동작).

- [ ] **Step 2: csv-parse 설치(필요 시) + 실행**

```bash
cd <repo>
sudo -u ec2-user node -e "require.resolve('csv-parse/sync')" 2>/dev/null || sudo -u ec2-user pnpm add -D csv-parse
sudo -u ec2-user npx tsx scripts/import-rehearsal-studios.ts
```
Expected: `적재 완료: 합주실 20곳, 방 47개. 장비 N개 중 ETC M개.` (ETC 비율이 높으면 분류 맵 보완 검토 — 보고만, 실패 아님.)

- [ ] **Step 3: DB 검증**

```bash
cd <repo>
sudo -u ec2-user bash -c "set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; mysql -u\"\$DB_USER\" -p\"\$DB_PASS\" \"\$DB_NAME\" -e \"
  SELECT (SELECT COUNT(*) FROM playground_studios) studios, (SELECT COUNT(*) FROM playground_studio_rooms) rooms;
  SELECT name, area_label, road_address, hourly_price_min, hourly_price_max, has_parking FROM playground_studios ORDER BY id LIMIT 5;
  SELECT studio_id, name, hourly_price, capacity, JSON_LENGTH(equipment_json) eq FROM playground_studio_rooms ORDER BY id LIMIT 5;\""
```
Expected: studios=20, rooms=47; 합주실 행에 주소·가격대·주차; 방 행에 가격·인원·장비 개수.

- [ ] **Step 4: 멱등 재실행 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx scripts/import-rehearsal-studios.ts 2>&1 | tail -1
```
Expected: 동일 `합주실 20곳, 방 47개` (중복 누적 없음).

- [ ] **Step 5: Commit**

```bash
cd <repo>
chown ec2-user:ec2-user scripts/import-rehearsal-studios.ts
sudo -u ec2-user git add scripts/import-rehearsal-studios.ts package.json pnpm-lock.yaml
sudo -u ec2-user git commit -m "feat(rehearsal): import notion studios/rooms into DEV DB (transactional replace, idempotent)"
```

> **⛔ Phase 1 종료.** DEV DB 에 20곳/47방 적재됨. 앱 UI 는 아직 옛 응답(방 미사용) — Phase 2(백엔드 집계·추천·응답)에서 연결. dev push 는 Phase 2/3 까지 묶어 진행(또는 사용자 지시).

---

## Self-Review (작성자 점검)

- **스펙 커버리지(Phase 1):** 스키마 020(§2.1·2.2)=T1 · 장비타입/분류(§2.3)=T2 · CSV vendor + 좌표(§3 소스/coords)=T3 · CSV→합주실/방 변환(§3 임포트 1~4)=T4 · DB 교체적재(§3 임포트 5·6)=T5. Phase 2/3(조회·추천·카드·모달=§4·5·6)은 후속 플랜.
- **타입 일관성:** `RoomEquipmentType`/`RoomGear`(T2) ↔ `classifyGearList`(T2) ↔ `ImportRoom.equipment`(T4) ↔ `equipment_json`(T5 INSERT) 동일. `CsvRow` 필드(T4) ↔ 임포트 매핑(T5) 동일. studios.id INT UNSIGNED ↔ rooms FK INT UNSIGNED(T1).
- **컨트롤러 선행물:** `equipment-classification.json`(140)·`rehearsal-studio-coords.json`(20)은 MCP/지식 필요 → 컨트롤러 생성. 합주실명 키는 T4 commonPrefix 산출과 일치해야 함(검증: T5 의 coords 누락 가드).
- **멱등:** 스키마(동적 ADD + IF NOT EXISTS), 임포트(DELETE 후 재삽입). 재실행 안전.
- **알려진 단순화:** region_id 미설정(area_label 사용), min_capacity null. 좌표/주소 Naver 1회. ETC 비율은 로그만(차단 아님).
