# 합주실 admin 방 편집 + 누락 필드 + 목록 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
>
> 설계 `docs/superpowers/specs/2026-06-05-rehearsal-admin-rooms-editor-design.md`.

**Goal:** admin 에서 합주실 방(가격·인원·장비)·전화 등 누락 필드를 입력/수정하고, 목록에서 정보 없는 곳을 골라 채우며, 삭제할 수 있게 한다.

**Architecture:** 순수 헬퍼(`adminRooms.ts`: 방 행 파싱+파생, TDD) → `studios.ts` write 확장(새 컬럼·rooms 교체·equipment 옵셔널·delete) → 서버 액션 → 폼(방 동적 행 + `classifyGearList` 클라 미리보기) → 목록(searchParams 필터 + 삭제). DB 스키마 변경 없음.

**Tech Stack:** Next.js 16 server actions · TypeScript · Zod · mysql2 · node:test.

**작업 규칙(MEMORY bandsustain):** `bandsustain-dev`(dev, 3101)에서만. 모든 git/build/tsx 는 `sudo -u ec2-user`. dev push 후 멈춤. 새 파일 `chown ec2-user:ec2-user`. `git add .` 금지. **`<repo>`:** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/playground/rehearsal/adminRooms.ts`(+test) | 방 행 파싱·gear 라운드트립·파생(min/max) 순수함수 | Create |
| `src/lib/playground/rehearsal/studios.ts` | WriteInput 확장·INSERT/UPDATE 새 컬럼·replaceRooms·deleteStudio·equipment 옵셔널 | Modify |
| `src/app/admin/(authed)/rehearsal-studios/actions.ts` | 스키마/폼 파싱 확장·방 파싱·파생 적용·삭제 액션 | Modify |
| `src/components/admin/RehearsalStudioForm.tsx` | 새 필드·방 동적 행+분류 미리보기·legacy 장비 제거 | Modify |
| `src/components/admin/StudioDeleteButton.tsx` | confirm 삭제 버튼(client) | Create |
| `src/app/admin/(authed)/rehearsal-studios/page.tsx` | 검색·출처·정보없음 필터 + 컬럼 + 삭제 | Modify |

---

## Task 1: 순수 헬퍼 `adminRooms.ts` — TDD

**Files:** Create `<repo>/src/lib/playground/rehearsal/adminRooms.ts`, `adminRooms.test.ts`

- [ ] **Step 1: 실패 테스트** — `adminRooms.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseRoomRows, deriveStudioStats, gearToText, type RoomRowInput } from "./adminRooms";

test("parseRoomRows: 텍스트 행 → RoomWrite (장비 자동분류, 빈 이름 행 skip)", () => {
  const rows: RoomRowInput[] = [
    { name: "A룸", price: "20000", capacity: "8", gear: "DW 드럼, 마샬 기타앰프", review: "좋음" },
    { name: "", price: "1", capacity: "1", gear: "", review: "" },           // 이름 없음 → skip
    { name: "B룸", price: "", capacity: "", gear: "", review: "" },          // 가격/인원 미상 허용
  ];
  const out = parseRoomRows(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "A룸");
  assert.equal(out[0].hourlyPrice, 20000);
  assert.equal(out[0].capacity, 8);
  assert.equal(out[0].equipment.length, 2);
  assert.equal(out[0].equipment[0].name, "DW 드럼");
  assert.equal(out[0].review, "좋음");
  assert.equal(out[0].sortOrder, 0);
  assert.equal(out[1].hourlyPrice, null);
  assert.equal(out[1].capacity, null);
  assert.deepEqual(out[1].equipment, []);
  assert.equal(out[1].review, null);
  assert.equal(out[1].sortOrder, 1);
});

test("deriveStudioStats: 방 가격 min/max(null 제외)·인원 max, 전부 null 이면 null", () => {
  assert.deepEqual(
    deriveStudioStats([
      { hourlyPrice: 20000, capacity: 8 }, { hourlyPrice: 15000, capacity: null }, { hourlyPrice: null, capacity: 12 },
    ]),
    { priceMin: 15000, priceMax: 20000, capacityMax: 12 },
  );
  assert.deepEqual(deriveStudioStats([{ hourlyPrice: null, capacity: null }]), { priceMin: null, priceMax: null, capacityMax: null });
  assert.deepEqual(deriveStudioStats([]), { priceMin: null, priceMax: null, capacityMax: null });
});

test("gearToText: equipment → 쉼표 텍스트 라운드트립", () => {
  assert.equal(gearToText([{ name: "DW 드럼", type: "DRUM" }, { name: "마샬", type: "GUITAR_AMP" }]), "DW 드럼, 마샬");
  assert.equal(gearToText([]), "");
});
```

- [ ] **Step 2: 실패 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/adminRooms.test.ts 2>&1 | grep -E "# (pass|fail)|Cannot find" | head`. Expected: 실패.

- [ ] **Step 3: 구현** — `adminRooms.ts`:
```ts
import { classifyGearList } from "./gearClassify";
import type { RoomGear } from "./types";

export type RoomRowInput = { name: string; price: string; capacity: string; gear: string; review: string };
export type RoomWrite = {
  name: string; hourlyPrice: number | null; capacity: number | null;
  equipment: RoomGear[]; review: string | null; sortOrder: number;
};

function intOrNull(s: string): number | null {
  const t = s.trim().replace(/[^0-9]/g, "");
  return t ? parseInt(t, 10) : null;
}

export function parseRoomRows(rows: RoomRowInput[]): RoomWrite[] {
  const out: RoomWrite[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    out.push({
      name,
      hourlyPrice: intOrNull(r.price),
      capacity: intOrNull(r.capacity),
      equipment: classifyGearList(r.gear),
      review: r.review.trim() || null,
      sortOrder: out.length,
    });
  }
  return out;
}

export function deriveStudioStats(rooms: { hourlyPrice: number | null; capacity: number | null }[]):
  { priceMin: number | null; priceMax: number | null; capacityMax: number | null } {
  const prices = rooms.map((r) => r.hourlyPrice).filter((p): p is number => p != null);
  const caps = rooms.map((r) => r.capacity).filter((c): c is number => c != null);
  return {
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    capacityMax: caps.length ? Math.max(...caps) : null,
  };
}

export function gearToText(equipment: { name: string }[]): string {
  return equipment.map((g) => g.name).join(", ");
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령. Expected `# fail 0`.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/adminRooms.ts src/lib/playground/rehearsal/adminRooms.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/adminRooms.ts src/lib/playground/rehearsal/adminRooms.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): admin room-row parse/derive/gear-text pure helpers (TDD)"
```

---

## Task 2: `studios.ts` write 경로 확장

**Files:** Modify `<repo>/src/lib/playground/rehearsal/studios.ts`

- [ ] **Step 1: `StudioWriteInput` 교체** — 기존 선언을 아래로:
```ts
export type StudioWriteInput = {
  name: string; slug: string; regionId: number | null; areaLabel: string | null;
  roadAddress: string | null; phone: string | null;
  lat: number | null; lng: number | null; nearestStation: string | null; nearestStationMeters: number | null;
  hourlyPriceMin: number | null; hourlyPriceMax: number | null; minCapacity: number | null; maxCapacity: number | null;
  hasParking: boolean; parkingNote: string | null; status: StudioStatus; sourceNote: string | null;
  bookingUrl: string | null; mapUrl: string | null;
  bookingMethod: string | null; amenities: string | null; homepageUrl: string | null;
  equipment?: { equipmentType: EquipmentType; equipmentName: string | null; quantity: number; note: string | null }[];
  rooms?: RoomWrite[];
};
```
파일 상단 import 에 `import type { RoomWrite } from "./adminRooms";` 추가.

- [ ] **Step 2: `createStudio` 교체**:
```ts
export async function createStudio(input: StudioWriteInput): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO playground_studios
       (name, slug, region_id, area_label, road_address, phone, lat, lng, nearest_station, nearest_station_meters,
        hourly_price_min, hourly_price_max, min_capacity, max_capacity, has_parking, parking_note,
        status, source_note, booking_url, map_url, booking_method, amenities, homepage_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [input.name, input.slug, input.regionId, input.areaLabel, input.roadAddress, input.phone, input.lat, input.lng,
     input.nearestStation, input.nearestStationMeters, input.hourlyPriceMin, input.hourlyPriceMax,
     input.minCapacity, input.maxCapacity, input.hasParking ? 1 : 0, input.parkingNote, input.status,
     input.sourceNote, input.bookingUrl, input.mapUrl, input.bookingMethod, input.amenities, input.homepageUrl],
  );
  const studioId = res.insertId;
  if (input.equipment) await replaceEquipment(studioId, input.equipment);
  if (input.rooms) await replaceRooms(studioId, input.rooms);
  return studioId;
}
```

- [ ] **Step 3: `updateStudio` 교체**:
```ts
export async function updateStudio(id: number, input: StudioWriteInput): Promise<void> {
  await getPool().query(
    `UPDATE playground_studios SET
       name=?, slug=?, region_id=?, area_label=?, road_address=?, phone=?, lat=?, lng=?,
       nearest_station=?, nearest_station_meters=?, hourly_price_min=?, hourly_price_max=?,
       min_capacity=?, max_capacity=?, has_parking=?, parking_note=?, status=?, source_note=?,
       booking_url=?, map_url=?, booking_method=?, amenities=?, homepage_url=?
     WHERE id=?`,
    [input.name, input.slug, input.regionId, input.areaLabel, input.roadAddress, input.phone, input.lat, input.lng,
     input.nearestStation, input.nearestStationMeters, input.hourlyPriceMin, input.hourlyPriceMax,
     input.minCapacity, input.maxCapacity, input.hasParking ? 1 : 0, input.parkingNote, input.status,
     input.sourceNote, input.bookingUrl, input.mapUrl, input.bookingMethod, input.amenities, input.homepageUrl, id],
  );
  if (input.equipment) await replaceEquipment(id, input.equipment);
  if (input.rooms) await replaceRooms(id, input.rooms);
}
```

- [ ] **Step 4: `replaceRooms` + `deleteStudio` 추가** (`replaceEquipment` 아래):
```ts
async function replaceRooms(studioId: number, rooms: RoomWrite[]): Promise<void> {
  await getPool().query(`DELETE FROM playground_studio_rooms WHERE studio_id = ?`, [studioId]);
  for (const r of rooms) {
    await getPool().query(
      `INSERT INTO playground_studio_rooms (studio_id, name, hourly_price, capacity, equipment_json, review, sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      [studioId, r.name, r.hourlyPrice, r.capacity, JSON.stringify(r.equipment), r.review, r.sortOrder],
    );
  }
}

export async function deleteStudio(id: number): Promise<void> {
  await getPool().query(`DELETE FROM playground_studios WHERE id = ?`, [id]); // rooms/equipment CASCADE
}
```

- [ ] **Step 5: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | head`. Expected: 에러 없음(actions 는 다음 태스크에서 함께 — 에러 나면 Task 3 후 재확인).

- [ ] **Step 6: Commit**
```bash
cd <repo>
sudo -u ec2-user git add src/lib/playground/rehearsal/studios.ts
sudo -u ec2-user git commit -m "feat(rehearsal): studio write path — meta cols, rooms replace, optional equipment, delete"
```

---

## Task 3: 서버 액션 확장 (`actions.ts`)

**Files:** Modify `<repo>/src/app/admin/(authed)/rehearsal-studios/actions.ts`

- [ ] **Step 1: import 교체** — `createStudio, updateStudio` import 줄에 `deleteStudio` 추가, `equipmentTypeEnum` import 제거하고:
```ts
import { createStudio, updateStudio, deleteStudio, type StudioWriteInput } from "@/lib/playground/rehearsal/studios";
import { studioStatusEnum } from "@/lib/playground/rehearsal/types";
import { parseRoomRows, deriveStudioStats, type RoomRowInput } from "@/lib/playground/rehearsal/adminRooms";
```

- [ ] **Step 2: `StudioSchema` 에 새 필드** — `areaLabel: strOrNull,` 뒤에 추가:
```ts
  roadAddress: strOrNull,
  phone: strOrNull,
  bookingMethod: strOrNull,
  amenities: strOrNull,
  homepageUrl: strOrNull,
```

- [ ] **Step 3: `parseEquipment` 함수 삭제**, 자리에 방 파싱 추가:
```ts
function parseRooms(fd: FormData): RoomRowInput[] {
  const names = fd.getAll("roomName").map(String);
  const prices = fd.getAll("roomPrice").map(String);
  const caps = fd.getAll("roomCapacity").map(String);
  const gears = fd.getAll("roomGear").map(String);
  const reviews = fd.getAll("roomReview").map(String);
  return names.map((name, i) => ({
    name, price: prices[i] ?? "", capacity: caps[i] ?? "", gear: gears[i] ?? "", review: reviews[i] ?? "",
  }));
}
```

- [ ] **Step 4: `fromForm` 에 새 필드 추가** — `areaLabel: fd.get("areaLabel"),` 뒤에:
```ts
    roadAddress: fd.get("roadAddress"), phone: fd.get("phone"),
    bookingMethod: fd.get("bookingMethod"), amenities: fd.get("amenities"), homepageUrl: fd.get("homepageUrl"),
```

- [ ] **Step 5: create/update 액션 본문 교체** — 두 함수의 `await createStudio(...)`/`await updateStudio(...)` 부분을 공통 빌더로:
```ts
function buildInput(data: z.infer<typeof StudioSchema>, fd: FormData): StudioWriteInput {
  const rooms = parseRoomRows(parseRooms(fd));
  const derived = rooms.length > 0 ? deriveStudioStats(rooms) : null;
  return {
    ...data,
    hourlyPriceMin: derived ? derived.priceMin : data.hourlyPriceMin,
    hourlyPriceMax: derived ? derived.priceMax : data.hourlyPriceMax,
    maxCapacity: derived ? derived.capacityMax : data.maxCapacity,
    rooms,
  };
}
```
- `createRehearsalStudio`: `await createStudio({ ...r.data, equipment: parseEquipment(fd) });` → `await createStudio(buildInput(r.data, fd));`
- `updateRehearsalStudio`: 동일하게 `await updateStudio(id, buildInput(r.data, fd));`

- [ ] **Step 6: 삭제 액션 추가** (파일 끝):
```ts
export async function deleteRehearsalStudio(id: number): Promise<void> {
  await requireAuth();
  await deleteStudio(id);
  revalidatePath("/admin/rehearsal-studios");
  redirect("/admin/rehearsal-studios");
}
```

- [ ] **Step 7: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-studios|adminRooms" || echo "tsc clean"`. Expected: `tsc clean` (폼의 parseEquipment 참조 에러가 나면 Task 4 후 재확인).

- [ ] **Step 8: Commit**
```bash
cd <repo>
sudo -u ec2-user git add "src/app/admin/(authed)/rehearsal-studios/actions.ts"
sudo -u ec2-user git commit -m "feat(rehearsal): admin actions — rooms parse+derive, new fields, delete"
```

---

## Task 4: 폼 (`RehearsalStudioForm.tsx`)

**Files:** Modify `<repo>/src/components/admin/RehearsalStudioForm.tsx`

- [ ] **Step 1: import/타입 교체** — 상단을:
```tsx
"use client";
import { useActionState, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { STUDIO_STATUSES, ROOM_EQUIPMENT_LABELS, type Studio } from "@/lib/playground/rehearsal/types";
import { classifyGearList } from "@/lib/playground/rehearsal/gearClassify";
import { gearToText } from "@/lib/playground/rehearsal/adminRooms";
import type { FormState } from "@/app/admin/(authed)/rehearsal-studios/actions";

type Region = { id: number; displayName: string };
type RoomRow = { name: string; price: string; capacity: string; gear: string; review: string };
```
(`EQUIPMENT_TYPES`/`EQUIPMENT_LABELS`/`EquipRow` 제거.)

- [ ] **Step 2: state 교체** — `rows`(EquipRow) state 를:
```tsx
  const [rooms, setRooms] = useState<RoomRow[]>(
    studio?.rooms.map((r) => ({
      name: r.name, price: r.hourlyPrice != null ? String(r.hourlyPrice) : "",
      capacity: r.capacity != null ? String(r.capacity) : "",
      gear: gearToText(r.equipment), review: r.review ?? "",
    })) ?? [],
  );
```

- [ ] **Step 3: 가격/인원 필드에 자동계산 안내** — 시간당 최저가/최고가/최대 인원 3개 label 을 `시간당 최저가 (방 있으면 자동)` / `시간당 최고가 (방 있으면 자동)` / `최대 인원 (방 있으면 자동)` 으로 변경.

- [ ] **Step 4: 새 필드 입력 추가** — "주차 메모" div 앞에:
```tsx
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>전화</label>
          <input name="phone" defaultValue={studio?.phone ?? ""} className={input} /></div>
        <div><label className={label}>도로명 주소</label>
          <input name="roadAddress" defaultValue={studio?.roadAddress ?? ""} className={input} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>예약 방식</label>
          <input name="bookingMethod" defaultValue={studio?.bookingMethod ?? ""} placeholder="네이버 예약, 전화 …" className={input} /></div>
        <div><label className={label}>부가정보(amenities)</label>
          <input name="amenities" defaultValue={studio?.amenities ?? ""} placeholder="악기대여 O, 주차 O …" className={input} /></div>
      </div>
      <div><label className={label}>홈페이지 URL</label>
        <input name="homepageUrl" defaultValue={studio?.homepageUrl ?? ""} className={input} /></div>
```

- [ ] **Step 5: legacy 장비 fieldset 전체를 방 fieldset 으로 교체**:
```tsx
      {/* 방 동적 행 */}
      <fieldset className="border border-[var(--color-border)] p-4">
        <legend className="text-xs uppercase tracking-wider px-2">방 (가격·인원·악기)</legend>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">방이 1개 이상 있으면 합주실 가격(min/max)·최대 인원은 방에서 자동 계산됩니다. 장비는 쉼표로 구분해 입력하면 자동 분류돼요.</p>
        <div className="space-y-4">
          {rooms.map((row, i) => {
            const preview = classifyGearList(row.gear);
            return (
              <div key={i} className="border border-[var(--color-border)] p-3 space-y-2">
                <div className="grid grid-cols-[1fr_110px_80px_40px] gap-2 items-center">
                  <input name="roomName" value={row.name} placeholder="방 이름 (예: A룸)" className={input}
                    onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input name="roomPrice" value={row.price} placeholder="시간당 가격" inputMode="numeric" className={input}
                    onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                  <input name="roomCapacity" value={row.capacity} placeholder="인원" inputMode="numeric" className={input}
                    onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, capacity: e.target.value } : x))} />
                  <button type="button" aria-label="방 삭제" onClick={() => setRooms(rooms.filter((_, j) => j !== i))}
                    className="text-red-600 text-sm">✕</button>
                </div>
                <input name="roomGear" value={row.gear} placeholder="장비 (쉼표 구분: DW 드럼, 마샬 JCM900, …)" className={input}
                  onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, gear: e.target.value } : x))} />
                {preview.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {preview.map((g, k) => (
                      <span key={k} className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 text-[11px]">
                        {g.name} → {ROOM_EQUIPMENT_LABELS[g.type]}
                      </span>
                    ))}
                  </div>
                )}
                <input name="roomReview" value={row.review} placeholder="후기 요약 (선택)" className={input}
                  onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, review: e.target.value } : x))} />
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setRooms([...rooms, { name: "", price: "", capacity: "", gear: "", review: "" }])}
          className="mt-3 text-sm border border-[var(--color-border-strong)] px-3 py-1">+ 방 추가</button>
      </fieldset>
```

- [ ] **Step 6: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "RehearsalStudioForm|rehearsal-studios" || echo "tsc clean"`. Expected: `tsc clean`.

- [ ] **Step 7: Commit**
```bash
cd <repo>
sudo -u ec2-user git add src/components/admin/RehearsalStudioForm.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): admin form — room rows with gear auto-classify preview, new fields, drop legacy equipment"
```

---

## Task 5: 목록 페이지 + 삭제 버튼

**Files:** Create `<repo>/src/components/admin/StudioDeleteButton.tsx` · Modify `<repo>/src/app/admin/(authed)/rehearsal-studios/page.tsx`

- [ ] **Step 1: `StudioDeleteButton.tsx`**:
```tsx
"use client";

export default function StudioDeleteButton({ name, action }: { name: string; action: () => Promise<void> }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`'${name}' 합주실을 삭제할까요? 방 정보도 함께 삭제됩니다.`)) e.preventDefault(); }} className="inline">
      <button type="submit" className="px-2 py-1 text-xs border border-red-300 text-red-600 hover:bg-red-50">삭제</button>
    </form>
  );
}
```

- [ ] **Step 2: `page.tsx` 교체**:
```tsx
import Link from "next/link";
import { listStudios } from "@/lib/playground/rehearsal/studios";
import StudioDeleteButton from "@/components/admin/StudioDeleteButton";
import { deleteRehearsalStudio } from "./actions";

export const dynamic = "force-dynamic";

const SOURCES = [
  { v: "", label: "전체 출처" },
  { v: "notion-import", label: "노션" },
  { v: "naver-map-import", label: "네이버" },
  { v: "manual", label: "수동/기타" },
];

export default async function RehearsalStudiosListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const source = sp.source ?? "";
  const noinfo = sp.noinfo === "1";
  let studios = await listStudios({});
  if (q) studios = studios.filter((s) => s.name.includes(q));
  if (source === "manual") studios = studios.filter((s) => s.sourceNote !== "notion-import" && s.sourceNote !== "naver-map-import");
  else if (source) studios = studios.filter((s) => s.sourceNote === source);
  if (noinfo) studios = studios.filter((s) => s.rooms.length === 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-black uppercase text-3xl">Rehearsal Studios</h1>
        <Link href="/admin/rehearsal-studios/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
          + 새로 추가
        </Link>
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <input name="q" defaultValue={q} placeholder="이름 검색" className="border border-[var(--color-border-strong)] px-3 py-2" />
        <select name="source" defaultValue={source} className="border border-[var(--color-border-strong)] px-3 py-2">
          {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="noinfo" value="1" defaultChecked={noinfo} /> 방 정보 없는 곳만</label>
        <button type="submit" className="border border-[var(--color-border-strong)] px-4 py-2">필터</button>
        <span className="text-[var(--color-text-muted)]">{studios.length}곳</span>
      </form>

      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr><th className="py-2">이름</th><th className="py-2 w-32">지역</th><th className="py-2 w-36">가격</th>
            <th className="py-2 w-16">방</th><th className="py-2 w-24">출처</th><th className="py-2 w-24">상태</th><th className="py-2 w-28 text-right">동작</th></tr>
        </thead>
        <tbody>
          {studios.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{s.name}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.areaLabel ?? s.regionName ?? "—"}</td>
              <td className="py-3">
                {s.hourlyPriceMin
                  ? `${s.hourlyPriceMin.toLocaleString("ko-KR")}${s.hourlyPriceMax && s.hourlyPriceMax !== s.hourlyPriceMin ? `~${s.hourlyPriceMax.toLocaleString("ko-KR")}` : ""}원`
                  : <span className="text-[var(--color-text-muted)]">정보 없음</span>}
              </td>
              <td className="py-3">{s.rooms.length > 0 ? s.rooms.length : <span className="text-[var(--color-text-muted)]">—</span>}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.sourceNote === "notion-import" ? "노션" : s.sourceNote === "naver-map-import" ? "네이버" : "수동"}</td>
              <td className="py-3">{s.status}</td>
              <td className="py-3 text-right space-x-1.5">
                <Link href={`/admin/rehearsal-studios/${s.id}`}
                  className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                <StudioDeleteButton name={s.name} action={deleteRehearsalStudio.bind(null, s.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
```

- [ ] **Step 3: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | head`. Expected: 에러 없음.

- [ ] **Step 4: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/components/admin/StudioDeleteButton.tsx
sudo -u ec2-user git add src/components/admin/StudioDeleteButton.tsx "src/app/admin/(authed)/rehearsal-studios/page.tsx"
sudo -u ec2-user git commit -m "feat(rehearsal): admin list — search/source/no-info filters, rooms col, delete"
```

---

## Task 6: 테스트 · 빌드 · DEV 라운드트립 · push

- [ ] **Step 1: 단위테스트 + 빌드 + 재시작**
```bash
cd <repo>
for f in adminRooms naverImport filter gearClassify studioImport; do
  echo -n "== $f: "; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; echo;
done
sudo -u ec2-user pnpm build 2>&1 | grep -E "Compiled|error|Error|Failed" | head
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 4
curl -s -o /dev/null -w "admin list: %{http_code}\n" "http://127.0.0.1:3101/admin/rehearsal-studios"
```
Expected: 각 `# fail 0`, 빌드 성공, admin list 200 또는 307(로그인 리다이렉트) — 라우트 생존.

- [ ] **Step 2: DEV DB write 라운드트립** (server action 대신 라이브러리 직접 — ⚠️ `DB_CREDENTIALS_PATH` DEV 명시):
```bash
cd <repo>
sudo -u ec2-user bash -c 'export DB_CREDENTIALS_PATH=/var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; npx tsx -e "
import { createStudio, getStudioById, updateStudio, deleteStudio } from \"./src/lib/playground/rehearsal/studios\";
import { parseRoomRows, deriveStudioStats } from \"./src/lib/playground/rehearsal/adminRooms\";
const rooms = parseRoomRows([{ name: \"A룸\", price: \"18000\", capacity: \"8\", gear: \"드럼, 마샬 기타앰프\", review: \"\" }]);
const d = deriveStudioStats(rooms);
const id = await createStudio({ name: \"__라운드트립테스트\", slug: \"__rt-test\", regionId: null, areaLabel: \"서울, 테스트\", roadAddress: \"서울특별시 테스트구 1\", phone: \"02-000-0000\", lat: 37.5, lng: 127, nearestStation: null, nearestStationMeters: null, hourlyPriceMin: d.priceMin, hourlyPriceMax: d.priceMax, minCapacity: null, maxCapacity: d.capacityMax, hasParking: false, parkingNote: null, status: \"hidden\", sourceNote: \"rt-test\", bookingUrl: null, mapUrl: null, bookingMethod: \"전화\", amenities: null, homepageUrl: null, rooms });
const s = await getStudioById(id);
console.log(\"created:\", s?.name, \"| phone:\", s?.phone, \"| priceMin:\", s?.hourlyPriceMin, \"| rooms:\", s?.rooms.length, \"| gear types:\", s?.equipmentTypes.join(\",\"));
await deleteStudio(id);
console.log(\"deleted:\", (await getStudioById(id)) === null);
process.exit(0);
"'
```
Expected: `created: __라운드트립테스트 | phone: 02-000-0000 | priceMin: 18000 | rooms: 1 | gear types: DRUM,GUITAR_AMP` · `deleted: true`.

- [ ] **Step 3: 브라우저 수동 확인 안내** — `https://dev.bandsustain.com/admin/rehearsal-studios`: (1) 필터(네이버+방 정보 없는 곳만) → 64곳, (2) 하나 편집 → 방 추가(장비 텍스트 → 분류 칩 확인) → 저장 → 목록 가격 갱신, (3) 사용자 화면 필터 모드에서 해당 합주실 정보 노출, (4) 새로 추가/삭제.

- [ ] **Step 4: dev push**
```bash
cd <repo>
sudo -u ec2-user git push origin dev
```
> **⛔ 멈춤.** dev push 후 사용자 확인 요청. 운영 반영은 명시 요청 시에만(이번 건 DB 변경 없음 — 코드만. 단 PROD 에 합주실 기능 자체가 미반영 상태).

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** §2 방 편집=T1(파싱)+T2(replaceRooms)+T3(액션)+T4(폼) · §3 파생=T1+T3 buildInput · §4 누락필드/legacy=T2+T3+T4 · §5 목록/삭제=T5 · §6 검증=T6.
- **타입 일관성:** `RoomRowInput`/`RoomWrite`(T1) ↔ actions parseRooms(T3) ↔ 폼 name 속성 `roomName/roomPrice/roomCapacity/roomGear/roomReview`(T4). `StudioWriteInput.rooms?`(T2) ↔ buildInput(T3). `gearToText`(T1) ↔ 폼 초기화(T4).
- **equipment 옵셔널 동작:** 폼이 equipment 미전송 → buildInput 에 equipment 없음 → replaceEquipment 미호출 → legacy 데이터 보존 ✓.
- **파생 규칙:** 방 있으면 폼 가격/인원 무시(파생), 방 없으면 폼 값 — naver 합주실에 studio 단위 가격만 적는 케이스 지원.
