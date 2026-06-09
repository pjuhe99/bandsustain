# 합주실 네이버 임포트 + 정보 없음 표시 + 모드/필터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
>
> 설계 `docs/superpowers/specs/2026-06-05-rehearsal-naver-import-noinfo-design.md`. 본 계획은 `2026-06-04-rehearsal-mode-filter.md` 를 **대체**한다(StudioCard/필터/모드 코드를 새 데이터·정보없음 요건에 맞게 수정 통합).

**Goal:** 네이버 지도 70곳(가격·방·악기 없음)을 추가 임포트하고, 정보 없는 항목은 "정보 없음"으로 표시하며, 모드 셀렉터(위치 추천/조건 필터)+구 단위 필터를 구현한다.

**Architecture:** 임포트는 순수 변환(`naverImport.ts`, TDD) + DEV 가드 러너(`naver-map-import` 행만 교체하는 추가형 멱등). UI 는 공유 `StudioCard`(정보없음 표기 내장) + `StudioDetailModal`(phone, 방없음 안내). 필터는 순수 `applyStudioFilters` 가 `{studios, noInfo}` 분리 반환, `road_address` 에서 구 추출.

**Tech Stack:** Next.js 16 · TypeScript · Zod · mysql2 · node:test · Tailwind.

**작업 규칙(MEMORY bandsustain):** `bandsustain-dev`(dev, 포트 3101)에서만. 모든 git/build/tsx 는 `sudo -u ec2-user`. DB 는 **DEV 먼저**. dev push 후 멈추고 사용자 확인. 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지. **`<repo>`:** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `db/schema/021_studio_phone.sql` | studios.phone 컬럼(멱등) | Create |
| `src/lib/playground/rehearsal/types.ts` | `Studio.phone` 추가 | Modify |
| `src/lib/playground/rehearsal/studios.ts` | SELECT/map 에 phone | Modify |
| `src/lib/playground/rehearsal/naverImport.ts`(+test) | JSON→ImportStudio 순수 변환+중복판정 | Create |
| `scripts/data/naver-map-hapjusil-2026-06-04.json` | 스크랩 원본 vendored | Create |
| `scripts/import-naver-studios.ts` | DEV 가드 러너(추가형 멱등) | Create |
| `src/app/playground/rehearsal-finder/StudioCard.tsx` | 공유 카드(정보없음 표기) | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` | 카드→StudioCard | Modify |
| `src/app/playground/rehearsal-finder/StudioDetailModal.tsx` | phone·방없음 안내 | Modify |
| `src/lib/playground/rehearsal/filter.ts`(+test) | parseRegion/버킷/applyStudioFilters | Create |
| `src/app/api/playground/rehearsal/filter/route.ts` | 필터 라우트 | Create |
| `src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx` | 필터 UI(구 칩+noInfo) | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx` | 모드 셀렉터 | Create |
| `src/app/playground/rehearsal-finder/page.tsx` | Entry 렌더 | Modify |

---

## Task 1: 스키마 021 phone + Studio plumb-through

**Files:** Create `<repo>/db/schema/021_studio_phone.sql` · Modify `types.ts`, `studios.ts`

- [ ] **Step 1: `021_studio_phone.sql` 작성** — EXACTLY:
```sql
-- 021 합주실 전화번호 (네이버 임포트 연락수단). 멱등.
SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playground_studios' AND COLUMN_NAME = 'phone'),
  'ALTER TABLE playground_studios ADD COLUMN phone VARCHAR(40) NULL AFTER road_address',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
```

- [ ] **Step 2: DEV DB 적용 + 확인**
```bash
cd <repo>
sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/021_studio_phone.sql && mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW COLUMNS FROM playground_studios LIKE \"phone\""'
```
Expected: `phone varchar(40) YES`.

- [ ] **Step 3: `types.ts` Studio 에 phone** — `roadAddress: string | null;` 줄 바로 아래에 추가:
```ts
  phone: string | null;
```

- [ ] **Step 4: `studios.ts` plumb** — (a) `mapStudioRow` 의 `roadAddress: r.road_address ?? null,` 뒤에 `phone: r.phone ?? null,` 추가. (b) `SELECT_STUDIO` 의 `st.road_address,` 뒤에 `st.phone,` 추가.

- [ ] **Step 5: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | head`. Expected: 에러 없음.

- [ ] **Step 6: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user db/schema/021_studio_phone.sql
sudo -u ec2-user git add db/schema/021_studio_phone.sql src/lib/playground/rehearsal/types.ts src/lib/playground/rehearsal/studios.ts
sudo -u ec2-user git commit -m "feat(rehearsal): schema 021 studio phone column + plumb-through"
```

---

## Task 2: 순수 변환 `naverImport.ts` — TDD

**Files:** Create `<repo>/src/lib/playground/rehearsal/naverImport.ts`, `naverImport.test.ts`

- [ ] **Step 1: 실패 테스트** — `naverImport.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { areaLabelFromAddress, normalizeName, transformNaverItems, type NaverItem } from "./naverImport";

function item(over: Partial<NaverItem>): NaverItem {
  return {
    id: "100", name: "테스트합주실", full_address: "서울특별시 종로구 대학로8가길 66", common_address: "서울 종로구 동숭동",
    phone: "", virtual_phone: "", booking_url: "", naver_map_url: "https://map.naver.com/p/entry/place/100",
    x: "127.0032507", y: "37.5829708", ...over,
  };
}

test("areaLabelFromAddress: 동/가 추출 + 폴백", () => {
  assert.equal(areaLabelFromAddress("서울 종로구 동숭동", ""), "서울, 동숭동");
  assert.equal(areaLabelFromAddress("서울 종로구 명륜2가 8-30 지하1층", ""), "서울, 명륜2가");
  assert.equal(areaLabelFromAddress("서울 종로구 8-30", ""), "서울, 종로구"); // 동 토큰 아님 → 구 폴백
  assert.equal(areaLabelFromAddress("", "서울특별시 중구 다산로14길 23"), "서울, 중구"); // common 없음 → full + 특별시 제거
});

test("normalizeName: 공백·'합주실' 제거", () => {
  assert.equal(normalizeName("엠플사운드합주실"), "엠플사운드");
  assert.equal(normalizeName("그루브합주실 방배점"), "그루브방배점");
});

test("중복: 좌표 25m 이내 skip / 이름 포함 skip / 38m 다른지점 유지", () => {
  const existing = [
    { name: "엠플사운드", lat: 37.51, lng: 127.04 },
    { name: "비쥬합주실 1호점", lat: 37.5, lng: 126.98 },
  ];
  const dupName = item({ id: "1", name: "엠플사운드합주실", y: "37.6", x: "127.1" });        // 이름 포함
  const dupCoord = item({ id: "2", name: "전혀다른이름", y: "37.51", x: "127.04" });          // 좌표 0m
  const nearBranch = item({ id: "3", name: "비쥬 합주실 2호점", y: "37.50034", x: "126.98" }); // ~38m + 이름 비포함 → 유지
  const r = transformNaverItems([dupName, dupCoord, nearBranch], existing);
  assert.deepEqual(r.skipped.map((s) => s.name).sort(), ["엠플사운드합주실", "전혀다른이름"]);
  assert.equal(r.studios.length, 1);
  assert.equal(r.studios[0].name, "비쥬 합주실 2호점");
});

test("JSON 내부 중복도 skip (먼저 수락된 것 기준)", () => {
  const a = item({ id: "1", name: "같은곳", y: "37.5", x: "127.0" });
  const b = item({ id: "2", name: "같은곳2호", y: "37.50001", x: "127.0" }); // ~1m
  const r = transformNaverItems([a, b], []);
  assert.equal(r.studios.length, 1);
  assert.equal(r.skipped.length, 1);
});

test("변환 필드: slug/phone 폴백/bookingMethod/가격 없음", () => {
  const withBook = item({ id: "55", booking_url: "https://booking", phone: "02-1", virtual_phone: "" });
  const phoneOnly = item({ id: "56", name: "둘", booking_url: "", phone: "", virtual_phone: "0507-1", y: "37.0", x: "127.5" });
  const none = item({ id: "57", name: "셋", booking_url: "", phone: "", virtual_phone: "", y: "36.0", x: "127.9" });
  const r = transformNaverItems([withBook, phoneOnly, none], []);
  assert.equal(r.studios[0].slug, "naver-55");
  assert.equal(r.studios[0].bookingMethod, "네이버 예약");
  assert.equal(r.studios[1].phone, "0507-1");
  assert.equal(r.studios[1].bookingMethod, "전화");
  assert.equal(r.studios[2].phone, null);
  assert.equal(r.studios[2].bookingMethod, null);
  assert.equal(r.studios[0].lat, 37.5829708);
  assert.equal(r.studios[0].roadAddress, "서울특별시 종로구 대학로8가길 66");
});
```

- [ ] **Step 2: 실패 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/naverImport.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head`. Expected: 실패(모듈 없음).

- [ ] **Step 3: 구현** — `naverImport.ts`:
```ts
import { haversineMeters } from "./geo";

export type NaverItem = {
  id: string; name: string; full_address: string; common_address: string;
  phone: string; virtual_phone: string; booking_url: string; naver_map_url: string;
  x: string; y: string;
};
export type ExistingStudioRef = { name: string; lat: number; lng: number };
export type NaverImportStudio = {
  name: string; slug: string; areaLabel: string; roadAddress: string;
  lat: number; lng: number; mapUrl: string; bookingUrl: string | null;
  phone: string | null; bookingMethod: string | null;
};
export type NaverImportResult = {
  studios: NaverImportStudio[];
  skipped: { name: string; matchedExisting: string; by: "coord" | "name" }[];
};

const DUP_COORD_METERS = 25; // 같은 건물(0m)만 잡고 인접 별도 지점(~38m)은 살림

export function normalizeName(s: string): string {
  return s.replace(/\s|합주실/g, "");
}

export function areaLabelFromAddress(commonAddress: string, fullAddress: string): string {
  const toks = (commonAddress.trim() || fullAddress.trim()).split(/\s+/);
  const city = (toks[0] ?? "").replace(/(특별시|광역시)$/, "");
  const dong = toks[2] && /[가-힣]\d*(동|가)\d*$/.test(toks[2]) ? toks[2] : toks[1] ?? "";
  return `${city}, ${dong}`;
}

function nameDup(a: string, b: string): boolean {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na.length < 4 || nb.length < 4) return na === nb;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function transformNaverItems(items: NaverItem[], existing: ExistingStudioRef[]): NaverImportResult {
  const studios: NaverImportStudio[] = [];
  const skipped: NaverImportResult["skipped"] = [];
  const refs: ExistingStudioRef[] = [...existing];
  for (const it of items) {
    const lat = Number(it.y), lng = Number(it.x);
    const coordHit = refs.find((r) => haversineMeters({ lat, lng }, { lat: r.lat, lng: r.lng }) < DUP_COORD_METERS);
    const nameHit = coordHit ? null : refs.find((r) => nameDup(it.name, r.name));
    const hit = coordHit ?? nameHit;
    if (hit) {
      skipped.push({ name: it.name, matchedExisting: hit.name, by: coordHit ? "coord" : "name" });
      continue;
    }
    const phone = it.phone.trim() || it.virtual_phone.trim() || null;
    const bookingUrl = it.booking_url.trim() || null;
    studios.push({
      name: it.name.trim(), slug: `naver-${it.id}`,
      areaLabel: areaLabelFromAddress(it.common_address ?? "", it.full_address ?? ""),
      roadAddress: it.full_address.trim(), lat, lng,
      mapUrl: it.naver_map_url.trim(), bookingUrl, phone,
      bookingMethod: bookingUrl ? "네이버 예약" : phone ? "전화" : null,
    });
    refs.push({ name: it.name, lat, lng });
  }
  return { studios, skipped };
}
```

- [ ] **Step 4: 통과 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/naverImport.test.ts 2>&1 | grep -E "# (pass|fail)"`. Expected `# fail 0`.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/naverImport.ts src/lib/playground/rehearsal/naverImport.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/naverImport.ts src/lib/playground/rehearsal/naverImport.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): naver map JSON pure transform + dedup (TDD)"
```

---

## Task 3: 데이터 vendoring + 러너 + DEV 실행

**Files:** Create `<repo>/scripts/data/naver-map-hapjusil-2026-06-04.json`, `<repo>/scripts/import-naver-studios.ts`

- [ ] **Step 1: JSON vendoring**
```bash
cd <repo>
cp /var/www/html/_______site_BANDSUSTAIN/naver_map_hapjusil_list_retry.json scripts/data/naver-map-hapjusil-2026-06-04.json
chown ec2-user:ec2-user scripts/data/naver-map-hapjusil-2026-06-04.json
```

- [ ] **Step 2: 러너 작성** — `scripts/import-naver-studios.ts` EXACTLY:
```ts
/**
 * 네이버 지도 스크랩 JSON → studios 적재. source_note='naver-map-import' 행만 교체(추가형 멱등) — notion-import 20곳 불변.
 * 실행(DEV): cd <repo> && sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; npx tsx scripts/import-naver-studios.ts'
 * PROD 는 사용자 명시 요청 후: PROD .db_credentials source + ALLOW_PROD=1.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformNaverItems, type NaverItem, type ExistingStudioRef } from "../src/lib/playground/rehearsal/naverImport";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  const DB_NAME = process.env.DB_NAME ?? "";
  if (!/DEV/i.test(DB_NAME) && process.env.ALLOW_PROD !== "1")
    throw new Error(`거부: DEV DB 아님 (DB_NAME='${DB_NAME}'). DEV .db_credentials 를 source 하거나 ALLOW_PROD=1.`);

  const raw = JSON.parse(readFileSync(resolve(__dirname, "data/naver-map-hapjusil-2026-06-04.json"), "utf-8")) as { items: NaverItem[] };

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1", user: process.env.DB_USER, password: process.env.DB_PASS,
    database: DB_NAME, charset: "utf8mb4", multipleStatements: false,
  });
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM playground_studios WHERE source_note = 'naver-map-import'");
    const [rows]: any = await conn.query("SELECT name, lat, lng FROM playground_studios WHERE lat IS NOT NULL AND lng IS NOT NULL");
    const existing: ExistingStudioRef[] = rows.map((r: any) => ({ name: r.name, lat: Number(r.lat), lng: Number(r.lng) }));
    const { studios, skipped } = transformNaverItems(raw.items, existing);
    for (const s of studios) {
      await conn.query(
        `INSERT INTO playground_studios
           (name, slug, area_label, road_address, phone, lat, lng, status, source_note, map_url, booking_url, booking_method)
         VALUES (?,?,?,?,?,?,?, 'approved', 'naver-map-import', ?,?,?)`,
        [s.name, s.slug, s.areaLabel, s.roadAddress, s.phone, s.lat, s.lng, s.mapUrl, s.bookingUrl, s.bookingMethod],
      );
    }
    await conn.commit();
    console.log(`적재 완료(DB=${DB_NAME}): 신규 ${studios.length}곳, 중복 스킵 ${skipped.length}곳.`);
    for (const sk of skipped) console.log(`  skip [${sk.by}] ${sk.name} = 기존 '${sk.matchedExisting}'`);
  } catch (e) { await conn.rollback(); throw e; }
  finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: DEV 실행 + 검증**
```bash
cd <repo>
sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; npx tsx scripts/import-naver-studios.ts'
sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT source_note, COUNT(*) FROM playground_studios GROUP BY source_note; SELECT COUNT(*) AS no_price FROM playground_studios WHERE hourly_price_min IS NULL"'
```
Expected: `신규 64곳, 중복 스킵 6곳` (스킵: 그라운드 홍대1호점+합정1호점·스페이스개러지 중앙대점·엠플사운드합주실·그루브 방배점·사운딕트). `notion-import 20 / naver-map-import 64`, `no_price 64`. **가격 0 행이 없어야 함** (NULL 만).

- [ ] **Step 4: 멱등 재실행 확인** — Step 3 첫 명령 재실행 → 동일 결과(65/5), 총 개수 그대로 84.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user scripts/import-naver-studios.ts
sudo -u ec2-user git add scripts/data/naver-map-hapjusil-2026-06-04.json scripts/import-naver-studios.ts
sudo -u ec2-user git commit -m "feat(rehearsal): import naver map 70 studios (additive idempotent, DEV-guarded)"
```

---

## Task 4: 공유 `StudioCard`(정보없음 표기) + 추천 클라이언트 리팩터

**Files:** Create `<repo>/src/app/playground/rehearsal-finder/StudioCard.tsx` · Modify `RehearsalFinderClient.tsx`

- [ ] **Step 1: `StudioCard.tsx` 작성** — EXACTLY:
```tsx
"use client";
import { buttonClasses } from "@/components/Button";
import { ROOM_EQUIPMENT_LABELS, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";

export type CardGear = { name: string; type: string };
export type CardRoom = { id: number; name: string; hourlyPrice: number | null; capacity: number | null; equipment: CardGear[]; review: string | null };
export type CardStudio = {
  name: string; regionName: string | null; areaLabel: string | null; roadAddress: string | null; phone: string | null;
  bookingMethod: string | null; amenities: string | null; homepageUrl: string | null; mapUrl: string | null;
  hourlyPriceMin: number | null; hourlyPriceMax: number | null; hasParking: boolean;
  equipmentTypes: RoomEquipmentType[]; rooms: CardRoom[];
};
export type CardTravel = {
  avgMinutes: number; maxMinutes: number;
  memberRoutes: { nickname: string; route: { travelMinutes: number } }[];
};

function priceLabel(min: number | null, max: number | null): string | null {
  if (!min) return null;
  return max && max !== min
    ? `${min.toLocaleString("ko-KR")}~${max.toLocaleString("ko-KR")}원`
    : `${min.toLocaleString("ko-KR")}원`;
}

export default function StudioCard({
  studio, rankNo, reason, travel, onDetail,
}: {
  studio: CardStudio;
  rankNo?: number;
  reason?: string;
  travel?: CardTravel;
  onDetail: (s: CardStudio) => void;
}) {
  const price = priceLabel(studio.hourlyPriceMin, studio.hourlyPriceMax);
  const noRooms = studio.rooms.length === 0;
  return (
    <div className="border border-[var(--color-border)] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-bold text-lg">{rankNo ? `${rankNo}. ` : ""}{studio.name}</h3>
        <span className="shrink-0 text-sm text-[var(--color-text-muted)]">{studio.regionName ?? studio.areaLabel ?? ""}</span>
      </div>
      {reason && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {travel && <span>⏱ 평균 {Math.round(travel.avgMinutes)}분 · 최대 {Math.round(travel.maxMinutes)}분</span>}
        {price ? <span>💸 {price}</span> : <span className="text-[var(--color-text-muted)]">💸 가격 정보 없음</span>}
        {noRooms
          ? <span className="text-[var(--color-text-muted)]">🚪 방 정보 없음</span>
          : <span>🚪 방 {studio.rooms.length}</span>}
        {studio.hasParking && <span>🅿 주차</span>}
      </div>
      {studio.equipmentTypes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {studio.equipmentTypes.map((t) => (
            <span key={t} className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 text-[11px]">{ROOM_EQUIPMENT_LABELS[t]}</span>
          ))}
        </div>
      ) : noRooms ? (
        <div className="mt-2 text-xs text-[var(--color-text-muted)]">악기 정보 없음</div>
      ) : null}
      {travel && (
        <ul className="mt-2 flex flex-wrap gap-x-4 text-xs text-[var(--color-text-muted)]">
          {travel.memberRoutes.map((mr, i) => <li key={i}>{mr.nickname}: {mr.route.travelMinutes}분</li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button type="button" onClick={() => onDetail(studio)} className={buttonClasses("secondary", "px-4 py-2 text-xs")}>자세히 보기</button>
        {studio.mapUrl && <a href={studio.mapUrl} target="_blank" rel="noreferrer" className="underline">지도</a>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `RehearsalFinderClient.tsx` 리팩터**

(a) import 추가: `import StudioCard, { type CardStudio } from "./StudioCard";`
(b) `ResultGear`/`ResultRoom`/`ResultStudio` 타입 선언 3개 삭제. `ResultItem.studio: ResultStudio;` → `studio: CardStudio;`. `useState<ResultStudio | null>` → `useState<CardStudio | null>`. 미사용이 된 `ROOM_EQUIPMENT_LABELS, type RoomEquipmentType` import 제거.
(c) `{results.map((r) => { … })}` 카드 블록 전체(현재 125~163행 `const priceMin…` 포함)를 아래로 교체:
```tsx
          {results.map((r) => (
            <StudioCard key={r.rankNo} studio={r.studio} rankNo={r.rankNo} reason={r.reason}
              travel={{ avgMinutes: r.avgMinutes, maxMinutes: r.maxMinutes, memberRoutes: r.memberRoutes }}
              onDetail={setDetailStudio} />
          ))}
```
(d) 하단 `<StudioDetailModal studio={detailStudio} … />` 는 그대로.

- [ ] **Step 3: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-finder|StudioCard" || echo "tsc clean"`. Expected: `tsc clean`.

- [ ] **Step 4: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/StudioCard.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/StudioCard.tsx src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): shared StudioCard with no-info labels; use in recommend"
```

---

## Task 5: `StudioDetailModal` — phone + 방없음 안내

**Files:** Modify `<repo>/src/app/playground/rehearsal-finder/StudioDetailModal.tsx`

- [ ] **Step 1: `DetailStudio` 에 phone** — `roadAddress: string | null;` 뒤에 `phone: string | null;` 추가.

- [ ] **Step 2: 본문 수정** — (a) `{studio.roadAddress && <p>📍 {studio.roadAddress}</p>}` 다음 줄에 추가:
```tsx
            {studio.phone && <p className="text-[var(--color-text-muted)]">📞 {studio.phone}</p>}
```
(b) 방 섹션 `<div className="space-y-3">…</div>` 전체를 아래로 교체:
```tsx
          <div className="space-y-3">
            {studio.rooms.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">방·가격·악기 정보가 아직 없어요. 네이버 지도에서 확인해주세요.</p>
            ) : (
              <>
                <h4 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">방 {studio.rooms.length}개</h4>
                {studio.rooms.map((room) => (
                  <div key={room.id} className="border border-[var(--color-border)] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-sm">{room.name}</span>
                      <span className="shrink-0 text-sm text-[var(--color-text-muted)]">
                        {room.hourlyPrice ? `${room.hourlyPrice.toLocaleString("ko-KR")}원/시간` : ""}
                        {room.capacity ? ` · ${room.capacity}인` : ""}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(ROOM_EQUIPMENT_TYPES as readonly RoomEquipmentType[])
                        .filter((t) => room.equipment.some((g) => g.type === t))
                        .map((t) => (
                          <div key={t} className="flex gap-2 text-xs">
                            <span className="w-16 shrink-0 text-[var(--color-text-muted)]">{ROOM_EQUIPMENT_LABELS[t]}</span>
                            <span>{room.equipment.filter((g) => g.type === t).map((g) => g.name).join(", ")}</span>
                          </div>
                        ))}
                    </div>
                    {room.review && <p className="mt-2 whitespace-pre-line text-xs text-[var(--color-text-muted)]">{room.review}</p>}
                  </div>
                ))}
              </>
            )}
          </div>
```

- [ ] **Step 3: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "DetailModal|rehearsal-finder" || echo "tsc clean"`. Expected: `tsc clean`. (CardStudio 가 phone 을 포함하므로 구조 호환.)

- [ ] **Step 4: Commit**
```bash
cd <repo>
sudo -u ec2-user git add src/app/playground/rehearsal-finder/StudioDetailModal.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): detail modal phone + no-room-info message"
```

---

## Task 6: 순수 필터 `filter.ts` — TDD

**Files:** Create `<repo>/src/lib/playground/rehearsal/filter.ts`, `filter.test.ts`

- [ ] **Step 1: 실패 테스트** — `filter.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseRegion, priceBucketMatch, applyStudioFilters, type StudioFilter } from "./filter";
import type { Studio } from "./types";

const EMPTY: StudioFilter = { city: null, gus: [], instrumentTypes: [], priceBucket: null, capacityMin: null, parkingOnly: false, rentalOnly: false };

function studio(over: Partial<Studio> & { rooms: Studio["rooms"] }): Studio {
  return {
    id: 1, name: "S", slug: "s", regionId: null, regionName: null, areaLabel: "서울, 역삼",
    roadAddress: "서울특별시 강남구 논현로 404", phone: null,
    lat: 37.5, lng: 127, nearestStation: null, nearestStationMeters: null,
    hourlyPriceMin: 20000, hourlyPriceMax: 20000, minCapacity: null, maxCapacity: null,
    hasParking: false, parkingNote: null, status: "approved", sourceNote: null,
    bookingUrl: null, mapUrl: null, bookingMethod: null, amenities: null, homepageUrl: null,
    equipment: [], equipmentTypes: [], ...over,
  } as Studio;
}
function room(over: Partial<Studio["rooms"][number]>): Studio["rooms"][number] {
  return { id: 1, name: "A", hourlyPrice: 20000, capacity: 10, equipment: [], review: null, ...over };
}

test("parseRegion: 시·구 추출 + 폴백", () => {
  assert.deepEqual(parseRegion("서울특별시 마포구 양화로 12", null), { city: "서울", gu: "마포구" });
  assert.deepEqual(parseRegion("경기도 성남시 분당구 판교로 441", null), { city: "성남", gu: "분당구" });
  assert.deepEqual(parseRegion(null, "수원, 인계"), { city: "수원", gu: null });
  assert.deepEqual(parseRegion(null, null), { city: null, gu: null });
});

test("priceBucketMatch: 경계(상한 포함)", () => {
  assert.equal(priceBucketMatch(15000, "u15"), true);
  assert.equal(priceBucketMatch(15001, "u15"), false);
  assert.equal(priceBucketMatch(20000, "15_20"), true);
  assert.equal(priceBucketMatch(25001, "o25"), true);
  assert.equal(priceBucketMatch(null, "u15"), false);
});

test("지역 필터: 시+구", () => {
  const a = studio({ roadAddress: "서울특별시 마포구 양화로 12", rooms: [room({})] });
  const b = studio({ roadAddress: "경기도 성남시 분당구 판교로 441", rooms: [room({})] });
  assert.equal(applyStudioFilters([a, b], { ...EMPTY, city: "서울" }).studios.length, 1);
  assert.equal(applyStudioFilters([a, b], { ...EMPTY, city: "서울", gus: ["서초구"] }).studios.length, 0);
  assert.equal(applyStudioFilters([a, b], { ...EMPTY, city: "서울", gus: ["마포구"] }).studios.length, 1);
});

test("악기 AND: 한 방에 모두", () => {
  const ok = studio({ rooms: [room({ equipment: [{ name: "x", type: "DRUM" }, { name: "y", type: "BASS_AMP" }] })] });
  const split = studio({ rooms: [room({ equipment: [{ name: "x", type: "DRUM" }] }), room({ equipment: [{ name: "y", type: "BASS_AMP" }] })] });
  const f: StudioFilter = { ...EMPTY, instrumentTypes: ["DRUM", "BASS_AMP"] };
  assert.equal(applyStudioFilters([ok], f).studios.length, 1);
  assert.equal(applyStudioFilters([split], f).studios.length, 0); // 두 방에 나뉘면 제외
});

test("정보 없음(방 0): 방 조건 걸면 noInfo 로 분리, 안 걸면 studios 포함", () => {
  const naver = studio({ name: "네이버만", hourlyPriceMin: null, hourlyPriceMax: null, rooms: [] });
  const full = studio({ rooms: [room({})] });
  const empty = applyStudioFilters([naver, full], EMPTY);
  assert.equal(empty.studios.length, 2);   // 조건 없음 → 모두 노출
  assert.equal(empty.noInfo.length, 0);
  const priced = applyStudioFilters([naver, full], { ...EMPTY, priceBucket: "15_20" });
  assert.deepEqual(priced.studios.map((s) => s.name), ["S"]);
  assert.deepEqual(priced.noInfo.map((s) => s.name), ["네이버만"]); // 판단불가 분리
  // 지역 불일치면 noInfo 에도 안 들어감
  const off = applyStudioFilters([naver], { ...EMPTY, city: "성남", priceBucket: "15_20" });
  assert.equal(off.noInfo.length, 0);
});

test("가격/인원/주차/악기대여 + 정렬(null 뒤)", () => {
  const cheap = studio({ name: "C", hourlyPriceMin: 12000, rooms: [room({ hourlyPrice: 12000, capacity: 5 })] });
  const mid = studio({ name: "M", hourlyPriceMin: 22000, hasParking: true, amenities: "악기대여 O, 주차 O", rooms: [room({ hourlyPrice: 22000, capacity: 15 })] });
  const noPrice = studio({ name: "N", hourlyPriceMin: null, hourlyPriceMax: null, rooms: [] });
  assert.deepEqual(applyStudioFilters([cheap, mid], { ...EMPTY, priceBucket: "20_25" }).studios.map((s) => s.name), ["M"]);
  assert.deepEqual(applyStudioFilters([cheap, mid], { ...EMPTY, capacityMin: 10 }).studios.map((s) => s.name), ["M"]);
  assert.equal(applyStudioFilters([cheap, mid], { ...EMPTY, parkingOnly: true }).studios.length, 1);
  assert.equal(applyStudioFilters([cheap, mid], { ...EMPTY, rentalOnly: true }).studios.length, 1);
  assert.deepEqual(applyStudioFilters([noPrice, mid, cheap], EMPTY).studios.map((s) => s.name), ["C", "M", "N"]); // null 마지막
});
```

- [ ] **Step 2: 실패 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/filter.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head`. Expected: 실패(모듈 없음).

- [ ] **Step 3: 구현** — `filter.ts`:
```ts
import type { Studio, RoomEquipmentType } from "./types";

export type PriceBucket = "u15" | "15_20" | "20_25" | "o25";
export type StudioFilter = {
  city: string | null;
  gus: string[];
  instrumentTypes: RoomEquipmentType[];
  priceBucket: PriceBucket | null;
  capacityMin: number | null;
  parkingOnly: boolean;
  rentalOnly: boolean;
};
export type FilterResult = { studios: Studio[]; noInfo: Studio[] };

const CITIES = ["서울", "성남", "수원"] as const;

export function parseRegion(roadAddress: string | null, areaLabel: string | null): { city: string | null; gu: string | null } {
  const src = roadAddress ?? "";
  let city: string | null = null;
  if (/^서울/.test(src)) city = "서울";
  else if (/성남시/.test(src)) city = "성남";
  else if (/수원시/.test(src)) city = "수원";
  if (!city && areaLabel) {
    for (const tok of areaLabel.split(",").map((s) => s.trim())) {
      if ((CITIES as readonly string[]).includes(tok)) city = tok;
    }
  }
  const gu = src.match(/(?:^|\s)([가-힣]+구)(?=\s|$)/)?.[1] ?? null;
  return { city, gu };
}

export function priceBucketMatch(price: number | null, b: PriceBucket): boolean {
  if (price == null) return false;
  switch (b) {
    case "u15": return price <= 15000;
    case "15_20": return price > 15000 && price <= 20000;
    case "20_25": return price > 20000 && price <= 25000;
    case "o25": return price > 25000;
  }
}

export function applyStudioFilters(studios: Studio[], f: StudioFilter): FilterResult {
  const roomCondActive = f.priceBucket != null || f.capacityMin != null || f.instrumentTypes.length > 0;
  const matched: Studio[] = [];
  const noInfo: Studio[] = [];
  for (const s of studios) {
    const { city, gu } = parseRegion(s.roadAddress, s.areaLabel);
    if (f.city && city !== f.city) continue;
    if (f.gus.length && (gu == null || !f.gus.includes(gu))) continue;
    if (f.parkingOnly && !s.hasParking) continue;
    if (f.rentalOnly && !/악기대여\s*O/.test(s.amenities ?? "")) continue;
    if (roomCondActive && s.rooms.length === 0) { noInfo.push(s); continue; } // 정보 없음 → 판단불가 분리
    const ok = !roomCondActive || s.rooms.some((r) => {
      if (f.priceBucket && !priceBucketMatch(r.hourlyPrice, f.priceBucket)) return false;
      if (f.capacityMin != null && !(r.capacity != null && r.capacity >= f.capacityMin)) return false;
      if (f.instrumentTypes.length && !f.instrumentTypes.every((t) => r.equipment.some((g) => g.type === t))) return false;
      return true;
    });
    if (ok) matched.push(s);
  }
  const byPrice = (a: Studio, b: Studio) => (a.hourlyPriceMin ?? Infinity) - (b.hourlyPriceMin ?? Infinity);
  return { studios: matched.sort(byPrice), noInfo: noInfo.sort(byPrice) };
}
```

- [ ] **Step 4: 통과 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/filter.test.ts 2>&1 | grep -E "# (pass|fail)"`. Expected `# fail 0`.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/filter.ts src/lib/playground/rehearsal/filter.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/filter.ts src/lib/playground/rehearsal/filter.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): pure studio filter (parseRegion/gu, noInfo split, TDD)"
```

---

## Task 7: 필터 라우트

**Files:** Create `<repo>/src/app/api/playground/rehearsal/filter/route.ts`

- [ ] **Step 1: 작성** — EXACTLY:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateStudios } from "@/lib/playground/rehearsal/studios";
import { applyStudioFilters } from "@/lib/playground/rehearsal/filter";
import { ROOM_EQUIPMENT_TYPES, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FilterSchema = z.object({
  city: z.string().nullable().default(null),
  gus: z.array(z.string()).default([]),
  instrumentTypes: z.array(z.enum(ROOM_EQUIPMENT_TYPES as unknown as [RoomEquipmentType, ...RoomEquipmentType[]])).default([]),
  priceBucket: z.enum(["u15", "15_20", "20_25", "o25"]).nullable().default(null),
  capacityMin: z.number().int().positive().nullable().default(null),
  parkingOnly: z.boolean().default(false),
  rentalOnly: z.boolean().default(false),
});

export async function POST(req: Request) {
  if (!isRehearsalFinderEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const parsed = FilterSchema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "bad_body", issues: parsed.error.issues }, { status: 400 });
  const studios = await getCandidateStudios();
  return NextResponse.json(applyStudioFilters(studios, parsed.data));
}
```

- [ ] **Step 2: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep "filter/route" || echo "filter route clean"`. Expected: `filter route clean`.

- [ ] **Step 3: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/api/playground/rehearsal/filter/route.ts
sudo -u ec2-user git add src/app/api/playground/rehearsal/filter/route.ts
sudo -u ec2-user git commit -m "feat(rehearsal): POST /api/.../filter route (dev-gated, zod, noInfo)"
```

---

## Task 8: 필터 클라이언트 + 모드 엔트리 + page

**Files:** Create `<repo>/src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx`, `RehearsalFinderEntry.tsx` · Modify `page.tsx`

- [ ] **Step 1: `RehearsalFilterClient.tsx` 작성** — EXACTLY:
```tsx
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import StudioCard, { type CardStudio } from "./StudioCard";
import StudioDetailModal from "./StudioDetailModal";
import { ROOM_EQUIPMENT_LABELS } from "@/lib/playground/rehearsal/types";

const CITY_OPTIONS = ["서울", "성남", "수원"];
// 서울 구 칩 (2026-06-05 데이터 기준, 많은 순). 데이터 변경 시 갱신.
const SEOUL_GUS = ["마포구", "서초구", "동작구", "성북구", "중구", "동대문구", "송파구", "서대문구", "성동구", "강남구", "종로구", "영등포구", "광진구", "관악구", "강서구", "구로구", "중랑구"];
const INSTRUMENTS = ["DRUM", "GUITAR_AMP", "BASS_AMP", "KEYBOARD"] as const;
const PRICE_BUCKETS = [
  { v: "u15", label: "~15,000" }, { v: "15_20", label: "15,000~20,000" },
  { v: "20_25", label: "20,000~25,000" }, { v: "o25", label: "25,000~" },
] as const;
const CAPACITIES = [4, 6, 8, 10, 15, 20];

const chip = (on: boolean) =>
  `rounded px-2.5 py-1 text-xs border ${on ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border-strong)]"}`;

export default function RehearsalFilterClient() {
  const [city, setCity] = useState<string | null>(null);
  const [gus, setGus] = useState<string[]>([]);
  const [instrumentTypes, setInstrumentTypes] = useState<string[]>([]);
  const [priceBucket, setPriceBucket] = useState<string | null>(null);
  const [capacityMin, setCapacityMin] = useState<number | null>(null);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [rentalOnly, setRentalOnly] = useState(false);
  const [results, setResults] = useState<{ studios: CardStudio[]; noInfo: CardStudio[] } | null>(null);
  const [detailStudio, setDetailStudio] = useState<CardStudio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }

  async function apply() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/playground/rehearsal/filter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ city, gus, instrumentTypes, priceBucket, capacityMin, parkingOnly, rentalOnly }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "필터 실패"); return; }
      setResults({ studios: data.studios, noInfo: data.noInfo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">지역</label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(city === null)} onClick={() => { setCity(null); setGus([]); }}>전체</button>
            {CITY_OPTIONS.map((c) => (
              <button key={c} type="button" className={chip(city === c)} onClick={() => { setCity(c); setGus([]); }}>{c}</button>
            ))}
          </div>
          {city === "서울" && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SEOUL_GUS.map((g) => (
                <button key={g} type="button" className={chip(gus.includes(g))} onClick={() => setGus(toggle(gus, g))}>{g}</button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">악기 (한 방에 모두)</label>
          <div className="flex flex-wrap gap-1.5">
            {INSTRUMENTS.map((t) => (
              <button key={t} type="button" className={chip(instrumentTypes.includes(t))} onClick={() => setInstrumentTypes(toggle(instrumentTypes, t))}>
                {ROOM_EQUIPMENT_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">가격대(시간당)</label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(priceBucket === null)} onClick={() => setPriceBucket(null)}>전체</button>
            {PRICE_BUCKETS.map((b) => (
              <button key={b.v} type="button" className={chip(priceBucket === b.v)} onClick={() => setPriceBucket(b.v)}>{b.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">최소 인원</label>
            <select value={capacityMin ?? ""} onChange={(e) => setCapacityMin(e.target.value ? Number(e.target.value) : null)}
              className="border border-[var(--color-border-strong)] px-3 py-2 text-sm">
              <option value="">상관없음</option>
              {CAPACITIES.map((c) => <option key={c} value={c}>{c}인 이상</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={parkingOnly} onChange={(e) => setParkingOnly(e.target.checked)} />주차 가능</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rentalOnly} onChange={(e) => setRentalOnly(e.target.checked)} />악기대여</label>
        </div>
      </div>

      <button type="button" onClick={apply} disabled={loading} className={buttonClasses("accent")}>
        {loading ? "찾는 중…" : "이 조건으로 찾기"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl">조건에 맞는 합주실 {results.studios.length}곳</h2>
          {results.studios.length === 0 && <p className="text-[var(--color-text-muted)]">조건에 맞는 곳이 없어요. 필터를 완화해보세요.</p>}
          {results.studios.map((s, i) => <StudioCard key={i} studio={s} onDetail={setDetailStudio} />)}
          {results.noInfo.length > 0 && (
            <details className="border border-dashed border-[var(--color-border-strong)] p-4">
              <summary className="cursor-pointer text-sm text-[var(--color-text-muted)]">
                조건 확인이 안 되는 {results.noInfo.length}곳 (가격·악기 정보 없음) — 펼쳐보기
              </summary>
              <div className="mt-3 space-y-4">
                {results.noInfo.map((s, i) => <StudioCard key={i} studio={s} onDetail={setDetailStudio} />)}
              </div>
            </details>
          )}
        </div>
      )}
      <StudioDetailModal studio={detailStudio} onClose={() => setDetailStudio(null)} />
    </div>
  );
}
```
> 주: instrumentTypes/priceBucket 은 string state, 라우트 Zod 가 검증. SEOUL_GUS 는 현 데이터 기준 하드코딩.

- [ ] **Step 2: `RehearsalFinderEntry.tsx` 작성** — EXACTLY:
```tsx
"use client";
import { useState } from "react";
import RehearsalFinderClient from "./RehearsalFinderClient";
import RehearsalFilterClient from "./RehearsalFilterClient";

type Mode = "select" | "recommend" | "filter";

export default function RehearsalFinderEntry() {
  const [mode, setMode] = useState<Mode>("select");

  if (mode === "select") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setMode("recommend")}
          className="border border-[var(--color-border-strong)] p-6 text-left hover:bg-[var(--color-bg-muted)]">
          <span className="font-display font-bold text-lg">멤버 위치 기반으로 찾기</span>
          <span className="mt-2 block text-sm text-[var(--color-text-muted)]">멤버들의 출발 역을 입력하면 이동시간 순으로 추천해드려요.</span>
        </button>
        <button type="button" onClick={() => setMode("filter")}
          className="border border-[var(--color-border-strong)] p-6 text-left hover:bg-[var(--color-bg-muted)]">
          <span className="font-display font-bold text-lg">조건으로 필터링하기</span>
          <span className="mt-2 block text-sm text-[var(--color-text-muted)]">지역·악기·가격 등 원하는 조건으로 합주실을 골라보세요.</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => setMode("select")}
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">← 다른 방법으로 찾기</button>
      {mode === "recommend" ? <RehearsalFinderClient /> : <RehearsalFilterClient />}
    </div>
  );
}
```

- [ ] **Step 3: `page.tsx` 수정** — `import RehearsalFinderClient from "./RehearsalFinderClient";` → `import RehearsalFinderEntry from "./RehearsalFinderEntry";`, `<RehearsalFinderClient />` → `<RehearsalFinderEntry />`. (header 문구 유지.)

- [ ] **Step 4: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-finder" || echo "tsc clean"`. Expected: `tsc clean`.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx src/app/playground/rehearsal-finder/page.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): mode selector entry + filter client (gu chips, noInfo section)"
```

---

## Task 9: 전체 테스트 · 빌드 · 스모크 · push

- [ ] **Step 1: 전체 lib 테스트 + 빌드 + 재시작**
```bash
cd <repo>
for f in geo scoring reason route-provider ranker recommend metroStations chosung gearClassify studioImport types naverImport filter; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)" | tr '\n' ' '; echo;
done
sudo -u ec2-user pnpm build 2>&1 | grep -E "Compiled|error|Error|Failed" | head
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 4
curl -s -o /dev/null -w "route: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
```
Expected: 각 `# fail 0`, 빌드 성공, route 200.

- [ ] **Step 2: 스모크 — 모드 버튼 / 필터 / 정보 없음**
```bash
cd <repo>
html=$(curl -s "http://127.0.0.1:3101/playground/rehearsal-finder")
echo "멤버 위치 버튼: $(echo "$html" | grep -o '멤버 위치 기반으로 찾기' | wc -l) / 조건 필터 버튼: $(echo "$html" | grep -o '조건으로 필터링하기' | wc -l)"
echo "=== /filter 빈 필터 (전체 84 기대) ==="
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/filter" -H 'Content-Type: application/json' -d '{}' \
  | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("studios:",j.studios.length,"noInfo:",j.noInfo.length);const np=j.studios.filter(x=>x.hourlyPriceMin==null);console.log("가격없음:",np.length,"| 샘플:",np.slice(0,3).map(x=>x.name+"/"+x.areaLabel+"/phone:"+x.phone).join(" ; "));});'
echo "=== /filter 서울+마포구+드럼+20_25 (noInfo 분리 기대) ==="
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/filter" -H 'Content-Type: application/json' \
  -d '{"city":"서울","gus":["마포구"],"instrumentTypes":["DRUM"],"priceBucket":"20_25"}' \
  | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("matched:",j.studios.length,"noInfo:",j.noInfo.length);});'
echo "=== /recommend 스모크 (정보없음 카드 데이터 확인) ==="
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" -H 'Content-Type: application/json' \
  -d '{"members":[{"nickname":"a","originText":"홍대입구","originLat":37.557,"originLng":126.924,"originType":"station"}]}' \
  | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("results:",(j.results??[]).length, (j.results??[]).map(r=>r.studio.name+"/min:"+r.studio.hourlyPriceMin).join(" ; "));});'
```
Expected: 버튼 각 1, 빈 필터 studios 84 / noInfo 0 / 가격없음 64(phone 포함), 조건 필터에서 noInfo > 0, 추천은 홍대 주변(마포 신규 포함 가능) 결과에 `min:null` 항목 동작.

- [ ] **Step 3: 브라우저 수동 확인 안내** — `https://dev.bandsustain.com/playground/rehearsal-finder`: (1) 두 모드 버튼, (2) 필터: 서울→구 칩, 가격대 걸면 "조건 확인이 안 되는 N곳" 접기, (3) 정보 없는 카드에 "가격 정보 없음/방 정보 없음/악기 정보 없음", (4) 상세 모달: 📞 전화 + "방·가격·악기 정보가 아직 없어요", (5) 추천 모드 기존 동작.

- [ ] **Step 4: dev push**
```bash
cd <repo>
sudo -u ec2-user git push origin dev
```
> **⛔ 멈춤.** dev push 후 사용자에게 dev 확인 요청. 운영 반영(main 머지 + prod pull + **PROD 에 021 적용 + ALLOW_PROD=1 임포트**)은 명시 요청 시에만.

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** §2 스키마=T1 · §3 임포트=T2,T3 · §4 정보없음=T4,T5 · §5 모드/필터 수정=T6,T7,T8 · §6 테스트=T2/T6 단위+T9 스모크. 0원 금지=가격 컬럼 NULL 적재(T3 검증)+priceLabel null 분기(T4).
- **타입 일관성:** `Studio.phone`(T1) ↔ `CardStudio.phone`(T4) ↔ `DetailStudio.phone`(T5). `StudioFilter.gus`(T6) ↔ Zod `gus`(T7) ↔ FilterClient body(T8). `FilterResult {studios,noInfo}`(T6) ↔ 라우트 직렬화(T7) ↔ 클라이언트 `{studios,noInfo}`(T8). recommend 응답 studio = Studio ⊇ CardStudio.
- **멱등:** 021 동적 ADD, 러너 DELETE-by-source_note 후 재삽입(T3 Step 4 재실행 검증).
- **중복 5곳 기대값:** 사전 분석(25m+정규화이름(지점표식 구분) 규칙)으로 확정 — 그라운드 홍대1호점·스페이스개러지 중앙대점·엠플사운드합주실·그루브 방배점·사운딕트 합주실. 비쥬 2호점(38m)·성신여대점·고려대점·하모닉스 2호점·타수 2호점은 별도 지점으로 신규 유지.
