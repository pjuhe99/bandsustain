# 합주실 데이터(방 단위) — Phase 2: 백엔드(방 집계·응답) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> 설계 `docs/superpowers/specs/2026-06-04-rehearsal-studios-rooms-detail-design.md` 의 **Phase 2(조회/응답)** 만. Phase 1(데이터)은 완료. Phase 3(카드·모달)은 후속.

**Goal:** 추천 응답의 `studio` 에 방 목록·가격대·주소·예약방식·홈페이지·장비타입 요약을 실어, 프런트(Phase 3)가 카드·모달을 그릴 수 있게 한다.

**Architecture:** `studio` 객체가 recommend 결과로 그대로 전달되므로, `Studio` 타입을 확장하고 `studios.ts` 가 신규 컬럼 + 방을 붙이면 자동으로 응답에 흐른다. **추천 순위 로직(scoring/ranker)은 무변경** — 예산/장비 필터가 빈 값이라 이미 이동시간 중심으로 동작.

**Tech Stack:** Next.js 16 · TypeScript · mysql2(raw) · node:test.

**작업 규칙(MEMORY bandsustain):** `bandsustain-dev`(dev, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/tsx/build 는 `sudo -u ec2-user`. **DB 변경 없음**(Phase 1에서 적재 완료). 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지.

**테스트:** `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/<file>.test.ts`. **저장소 루트(`<repo>`):** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/playground/rehearsal/types.ts` | `StudioRoom` 타입 + `Studio` 확장(rooms/주소/링크/타입요약) + `roomEquipmentTypes` 순수헬퍼 | Modify |
| `src/lib/playground/rehearsal/types.test.ts` | `roomEquipmentTypes` 단위테스트 | Create |
| `src/lib/playground/rehearsal/rooms.ts` | 방 조회(`loadRoomsByStudioIds`) | Create |
| `src/lib/playground/rehearsal/studios.ts` | SELECT 신규컬럼 + mapStudioRow + `attachRooms` 배선 | Modify |

> `recommend.ts`/`ranker.ts`/`scoring.ts`/route 는 **무변경**(studio 통과 전달, 순위 로직 유지).

---

## Task 1: 타입 확장 + 타입요약 헬퍼 (`types.ts`) — TDD

**Files:**
- Modify: `<repo>/src/lib/playground/rehearsal/types.ts`
- Create: `<repo>/src/lib/playground/rehearsal/types.test.ts`

> 기존 `types.ts` 에는 `Studio`(equipment 포함)·`RoomEquipmentType`·`ROOM_EQUIPMENT_TYPES`·`RoomGear` 가 이미 있다(Phase 1).

- [ ] **Step 1: `StudioRoom` 타입 추가 + `Studio` 확장**

`types.ts` 의 `export type Studio = { … equipment: StudioEquipment[]; };` 블록에서, `equipment: StudioEquipment[];` 줄 **다음**에 아래 필드를 추가:
```ts
  roadAddress: string | null;
  bookingMethod: string | null;
  amenities: string | null;
  homepageUrl: string | null;
  rooms: StudioRoom[];
  equipmentTypes: RoomEquipmentType[];
```
그리고 `Studio` 타입 정의 **바로 위**에 `StudioRoom` 추가:
```ts
export type StudioRoom = {
  id: number;
  name: string;
  hourlyPrice: number | null;
  capacity: number | null;
  equipment: RoomGear[];
  review: string | null;
};
```

- [ ] **Step 2: `roomEquipmentTypes` 헬퍼 추가** — `types.ts` 파일 끝에:
```ts
// 방들의 장비 타입 합집합 (ROOM_EQUIPMENT_TYPES 정의 순서 유지)
export function roomEquipmentTypes(rooms: { equipment: RoomGear[] }[]): RoomEquipmentType[] {
  const present = new Set<RoomEquipmentType>();
  for (const r of rooms) for (const g of r.equipment) present.add(g.type);
  return ROOM_EQUIPMENT_TYPES.filter((t) => present.has(t));
}
```

- [ ] **Step 3: 실패 테스트 작성** — `types.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { roomEquipmentTypes } from "./types";

test("roomEquipmentTypes: 방들의 타입 합집합, 정의 순서 유지", () => {
  const rooms = [
    { equipment: [{ name: "x", type: "KEYBOARD" as const }, { name: "y", type: "DRUM" as const }] },
    { equipment: [{ name: "z", type: "GUITAR_AMP" as const }] },
  ];
  assert.deepEqual(roomEquipmentTypes(rooms), ["DRUM", "GUITAR_AMP", "KEYBOARD"]);
});

test("roomEquipmentTypes: 빈 입력 → []", () => {
  assert.deepEqual(roomEquipmentTypes([]), []);
});
```

- [ ] **Step 4: 실패 확인 → 통과 확인**
```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/types.test.ts 2>&1 | grep -E "# (pass|fail)"
```
Expected: `# fail 0` (구현이 Step 1~2에서 이미 됨 → 바로 통과).

- [ ] **Step 5: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "types.ts|studios.ts" || echo "(studios.ts 는 Task 3 전까지 Studio 필드 누락으로 에러날 수 있음 — 정상)"`
> 주: `Studio` 에 필수 필드가 늘었으므로 `studios.ts` 의 `mapStudioRow` 가 아직 안 채워 **studios.ts 에 타입에러**가 날 수 있다. Task 3에서 해소. types.ts 자체는 깨끗해야 함.

- [ ] **Step 6: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/types.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/types.ts src/lib/playground/rehearsal/types.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): StudioRoom type + Studio rooms/meta fields + roomEquipmentTypes (TDD)"
```

---

## Task 2: 방 조회 (`rooms.ts`)

**Files:** Create `<repo>/src/lib/playground/rehearsal/rooms.ts`

- [ ] **Step 1: 작성**
```ts
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { StudioRoom, RoomGear } from "./types";

function parseEquipment(v: unknown): RoomGear[] {
  if (v == null) return [];
  if (typeof v === "string") { try { return JSON.parse(v) as RoomGear[]; } catch { return []; } }
  return v as RoomGear[];
}

export async function loadRoomsByStudioIds(ids: number[]): Promise<Map<number, StudioRoom[]>> {
  const map = new Map<number, StudioRoom[]>();
  if (ids.length === 0) return map;
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, studio_id, name, hourly_price, capacity, equipment_json, review
       FROM playground_studio_rooms
      WHERE studio_id IN (${ids.map(() => "?").join(",")})
      ORDER BY studio_id, sort_order, id`,
    ids,
  );
  for (const r of rows) {
    const room: StudioRoom = {
      id: r.id, name: r.name,
      hourlyPrice: r.hourly_price != null ? Number(r.hourly_price) : null,
      capacity: r.capacity != null ? Number(r.capacity) : null,
      equipment: parseEquipment(r.equipment_json),
      review: r.review,
    };
    const list = map.get(r.studio_id) ?? [];
    list.push(room);
    map.set(r.studio_id, list);
  }
  return map;
}
```
> mysql2 의 JSON 컬럼은 보통 파싱된 객체로 옴 → `parseEquipment` 가 string/object 양쪽 처리.

- [ ] **Step 2: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep "rooms.ts" || echo "rooms.ts clean"`. Expected: `rooms.ts clean`.

- [ ] **Step 3: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/rooms.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/rooms.ts
sudo -u ec2-user git commit -m "feat(rehearsal): rooms loader (loadRoomsByStudioIds)"
```

---

## Task 3: studios.ts 배선 (신규 컬럼 + 방 부착)

**Files:** Modify `<repo>/src/lib/playground/rehearsal/studios.ts`

> 현재 구조: `mapStudioRow(r): Omit<Studio,"equipment">` · `attachEquipment(studios): Promise<Studio[]>` · `SELECT_STUDIO`(컬럼 목록) · `getCandidateStudios`/`listStudios`/`getStudioById` 가 `attachEquipment(...)` 로 끝남.

- [ ] **Step 1: import 추가** — 파일 상단 import 들 아래에:
```ts
import { loadRoomsByStudioIds } from "./rooms";
import { roomEquipmentTypes } from "./types";
```
그리고 기존 `import type { Studio, StudioStatus, StudioEquipment, EquipmentType } from "./types";` 는 그대로 둔다.

- [ ] **Step 2: `mapStudioRow` 반환 타입/필드 갱신** — 현재:
```ts
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
```
교체:
```ts
function mapStudioRow(r: RowDataPacket): Omit<Studio, "equipment" | "rooms" | "equipmentTypes"> {
  return {
    id: r.id, name: r.name, slug: r.slug, regionId: r.region_id, regionName: r.region_name ?? null,
    areaLabel: r.area_label, roadAddress: r.road_address ?? null,
    lat: r.lat != null ? Number(r.lat) : NaN, lng: r.lng != null ? Number(r.lng) : NaN,
    nearestStation: r.nearest_station, nearestStationMeters: r.nearest_station_meters,
    hourlyPriceMin: r.hourly_price_min, hourlyPriceMax: r.hourly_price_max,
    minCapacity: r.min_capacity, maxCapacity: r.max_capacity,
    hasParking: r.has_parking === 1, parkingNote: r.parking_note,
    status: r.status as StudioStatus, sourceNote: r.source_note,
    bookingUrl: r.booking_url, mapUrl: r.map_url,
    bookingMethod: r.booking_method ?? null, amenities: r.amenities ?? null, homepageUrl: r.homepage_url ?? null,
  };
}
```

- [ ] **Step 3: `attachEquipment` 반환 타입 갱신 + `attachRooms` 추가** — 현재 `attachEquipment` 의 시그니처/끝부분:
```ts
async function attachEquipment(studios: Omit<Studio, "equipment">[]): Promise<Studio[]> {
  …
  return studios.map((s) => ({ ...s, equipment: byStudio.get(s.id) ?? [] }));
}
```
를 아래로 교체(반환을 `Omit<Studio,"rooms"|"equipmentTypes">` 로, 인자도 동일 Omit 추가):
```ts
async function attachEquipment(
  studios: Omit<Studio, "equipment" | "rooms" | "equipmentTypes">[],
): Promise<Omit<Studio, "rooms" | "equipmentTypes">[]> {
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

async function attachRooms(studios: Omit<Studio, "rooms" | "equipmentTypes">[]): Promise<Studio[]> {
  if (studios.length === 0) return [];
  const roomsByStudio = await loadRoomsByStudioIds(studios.map((s) => s.id));
  return studios.map((s) => {
    const rooms = roomsByStudio.get(s.id) ?? [];
    return { ...s, rooms, equipmentTypes: roomEquipmentTypes(rooms) };
  });
}
```
> 주: `attachEquipment` 가 빈 배열 가드(`if (studios.length === 0) return [];`)를 갖도록 추가(기존엔 attach 안쪽 ids 가드만 있었음 — 동작 동일하나 명시).

- [ ] **Step 4: `SELECT_STUDIO` 에 신규 컬럼 추가** — 현재:
```ts
const SELECT_STUDIO = `
  SELECT st.id, st.name, st.slug, st.region_id, rg.display_name AS region_name, st.area_label,
         st.lat, st.lng, st.nearest_station, st.nearest_station_meters,
         st.hourly_price_min, st.hourly_price_max, st.min_capacity, st.max_capacity,
         st.has_parking, st.parking_note, st.status, st.source_note, st.booking_url, st.map_url
    FROM playground_studios st
    LEFT JOIN playground_regions rg ON rg.id = st.region_id`;
```
교체(SELECT 절에 `st.road_address, st.booking_method, st.amenities, st.homepage_url` 추가):
```ts
const SELECT_STUDIO = `
  SELECT st.id, st.name, st.slug, st.region_id, rg.display_name AS region_name, st.area_label,
         st.road_address, st.lat, st.lng, st.nearest_station, st.nearest_station_meters,
         st.hourly_price_min, st.hourly_price_max, st.min_capacity, st.max_capacity,
         st.has_parking, st.parking_note, st.status, st.source_note, st.booking_url, st.map_url,
         st.booking_method, st.amenities, st.homepage_url
    FROM playground_studios st
    LEFT JOIN playground_regions rg ON rg.id = st.region_id`;
```

- [ ] **Step 5: 조회 함수 3곳에 `attachRooms` 배선** — `attachEquipment(...)` 로 끝나는 3개 함수를 `attachRooms(await attachEquipment(...))` 로 감싼다.

`getCandidateStudios`:
```ts
export async function getCandidateStudios(): Promise<Studio[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_STUDIO} WHERE st.status = 'approved' AND st.lat IS NOT NULL AND st.lng IS NOT NULL`,
  );
  return attachRooms(await attachEquipment(rows.map(mapStudioRow)));
}
```
`listStudios` 의 `return attachEquipment(...)` → `return attachRooms(await attachEquipment(...))`.
`getStudioById` 의 마지막 `return (await attachEquipment([mapStudioRow(rows[0])]))[0] ?? null;` 류를 → `return (await attachRooms(await attachEquipment([mapStudioRow(rows[0])])))[0] ?? null;` (기존 형태에 맞춰 `attachRooms(await attachEquipment(...))` 로 감싸기).

> `listStudios`/`getStudioById` 의 정확한 현재 코드를 읽어 동일 패턴으로 감쌀 것. 핵심: 세 함수 모두 최종 결과가 `attachRooms(await attachEquipment(...))` 를 거치게 한다.

- [ ] **Step 6: 타입 컴파일 + 전체 lib 테스트**
```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal" || echo "tsc clean (rehearsal)"
for f in geo scoring reason route-provider ranker recommend metroStations chosung gearClassify studioImport types; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)" | tr '\n' ' '; echo;
done
```
Expected: `tsc clean (rehearsal)`, 각 테스트 `# fail 0`.

- [ ] **Step 7: Commit**
```bash
cd <repo>
sudo -u ec2-user git add src/lib/playground/rehearsal/studios.ts
sudo -u ec2-user git commit -m "feat(rehearsal): studios.ts surface rooms + meta cols + equipmentTypes in Studio"
```

---

## Task 4: 빌드 · 응답 스모크 · push

**Files:** (검증)

- [ ] **Step 1: 빌드 + 재시작(DEV)**
```bash
cd <repo>
sudo -u ec2-user pnpm build 2>&1 | grep -E "Compiled|error|Error|Failed" | head
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 4
curl -s -o /dev/null -w "route: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
```
Expected: 컴파일 성공, route 200.

- [ ] **Step 2: recommend 응답에 방·주소·타입요약 포함 확인**
```bash
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" \
  -H 'Content-Type: application/json' \
  -d '{"members":[{"nickname":"A","originText":"사당","originLat":37.4765,"originLng":126.9816,"originType":"station"}]}' \
  | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const t=j.results[0];const st=t.studio;console.log("studio:",st.name);console.log("roadAddress:",st.roadAddress);console.log("bookingMethod:",st.bookingMethod,"| amenities:",st.amenities,"| homepageUrl:",st.homepageUrl);console.log("priceMin/Max:",st.hourlyPriceMin,st.hourlyPriceMax,"| equipmentTypes:",st.equipmentTypes);console.log("rooms:",st.rooms.length,"first:",JSON.stringify(st.rooms[0]).slice(0,160));});'
```
Expected: roadAddress·bookingMethod·amenities·homepageUrl 채워짐, equipmentTypes 배열(예 `["DRUM","GUITAR_AMP","BASS_AMP","KEYBOARD"]`), rooms.length>0, 첫 방에 name/hourlyPrice/capacity/equipment.

- [ ] **Step 3: studios 검수 API 도 방 포함(있으면)**
```bash
curl -s "http://127.0.0.1:3101/api/playground/rehearsal/studios" | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const it=j.items[0];console.log("studios:",j.items.length,"| 첫 합주실 rooms 필드 존재:", it && "rooms" in it ? it.rooms?.length : "(studios API 는 rooms 미포함일 수 있음 — 정상)");});'
```
> studios GET 라우트가 `rooms` 를 직렬화 안 할 수도 있음(자체 매핑이면). 그 경우 정상 — recommend 응답이 핵심.

- [ ] **Step 4: dev push**
```bash
cd <repo>
sudo -u ec2-user git push origin dev
```
> Phase 3(카드·모달)에서 이 응답을 화면에 그린다. UI 는 아직 옛 카드(빈 장비) — Phase 3 후 사용자 확인.

---

## Self-Review (작성자 점검)

- **스펙 커버리지(Phase 2 = §4):** StudioRoom/Studio 확장+타입요약(T1) · 방 조회(T2) · studios.ts 신규컬럼+방부착+세 조회함수 배선(T3) · 빌드/응답 스모크(T4). recommend/ranker/scoring/route 무변경(순위=이동시간, 필터 빈값).
- **타입 일관성:** `StudioRoom`(T1) ↔ `loadRoomsByStudioIds` 반환(T2) ↔ `attachRooms`(T3). `roomEquipmentTypes`(T1) ↔ attachRooms 호출(T3). `Studio` 신규필드(roadAddress/bookingMethod/amenities/homepageUrl/rooms/equipmentTypes) ↔ mapStudioRow(주소·예약·편의·홈피)+attachRooms(rooms·타입)에서 전부 채움 → 필수필드 누락 없음.
- **무변경 안전:** 예산/장비 필터가 빈 값이라 scoring/ranker 결과 불변. 추천 응답은 studio 통과 → 신규필드 자동 포함.
- **알려진 단순화:** studio.equipment(옛 enum)는 notion 데이터에선 빈 배열(미사용). studios 검수 GET 은 자체 매핑이면 rooms 미직렬화 가능(핵심 아님).
