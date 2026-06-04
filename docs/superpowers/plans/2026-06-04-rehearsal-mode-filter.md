# 합주실 찾기 — 모드 분기 + 조건 필터링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
>
> 설계 `docs/superpowers/specs/2026-06-04-rehearsal-mode-filter-design.md`.

**Goal:** 합주실 찾기 진입을 [멤버 위치 추천]/[조건 필터링] 두 모드로 나누고, 필터 모드에서 같은 DB를 지역·악기타입·가격대·인원·주차·악기대여로 거른다.

**Architecture:** 데이터가 작아(20곳/47방) 새 SQL 없이 `getCandidateStudios()` + **순수 `applyStudioFilters`** + 신규 `/filter` 라우트. 결과 카드를 **`StudioCard` 공유 컴포넌트**로 추출(추천=이동시간 포함/필터=생략), 상세 모달·데이터 그대로 재사용. 신규 `RehearsalFinderEntry`(모드 셀렉터)가 두 모드를 감싼다.

**Tech Stack:** Next.js 16 · React(client) · TypeScript · Zod · node:test · Tailwind.

**작업 규칙(MEMORY bandsustain):** `bandsustain-dev`(dev, 포트 3101)에서만. 모든 git/build/tsx 는 `sudo -u ec2-user`. **DB 변경 없음.** dev push 후 멈추고 사용자 확인. 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지. **저장소 루트(`<repo>`):** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/playground/rehearsal/filter.ts` | `parseArea`·`priceBucketMatch`·`applyStudioFilters` (순수) | Create |
| `src/lib/playground/rehearsal/filter.test.ts` | 필터 단위테스트 | Create |
| `src/app/api/playground/rehearsal/filter/route.ts` | 필터 라우트(dev 게이트+Zod) | Create |
| `src/app/playground/rehearsal-finder/StudioCard.tsx` | 결과 카드 공유 컴포넌트 | Create |
| `src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx` | 필터 UI + 결과 | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx` | 모드 셀렉터 래퍼 | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` | 결과 카드 → `StudioCard` 사용 | Modify |
| `src/app/playground/rehearsal-finder/page.tsx` | `RehearsalFinderEntry` 렌더 | Modify |

---

## Task 1: 순수 필터 (`filter.ts`) — TDD

**Files:** Create `<repo>/src/lib/playground/rehearsal/filter.ts`, `filter.test.ts`

- [ ] **Step 1: 실패 테스트** — `filter.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseArea, priceBucketMatch, applyStudioFilters, type StudioFilter } from "./filter";
import type { Studio } from "./types";

const EMPTY: StudioFilter = { city: null, dongs: [], instrumentTypes: [], priceBucket: null, capacityMin: null, parkingOnly: false, rentalOnly: false };

function studio(over: Partial<Studio> & { rooms: Studio["rooms"] }): Studio {
  return {
    id: 1, name: "S", slug: "s", regionId: null, regionName: null, areaLabel: "서울, 역삼", roadAddress: null,
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

test("parseArea: 순서 섞인 라벨 → 시/동", () => {
  assert.deepEqual(parseArea("서울, 역삼"), { city: "서울", dong: "역삼" });
  assert.deepEqual(parseArea("방배, 서울"), { city: "서울", dong: "방배" });
  assert.deepEqual(parseArea("성남, 야탑"), { city: "성남", dong: "야탑" });
  assert.deepEqual(parseArea(null), { city: null, dong: null });
});

test("priceBucketMatch: 경계(상한 포함)", () => {
  assert.equal(priceBucketMatch(15000, "u15"), true);
  assert.equal(priceBucketMatch(15001, "u15"), false);
  assert.equal(priceBucketMatch(20000, "15_20"), true);
  assert.equal(priceBucketMatch(25001, "o25"), true);
  assert.equal(priceBucketMatch(null, "u15"), false);
});

test("지역 필터: 시+동", () => {
  const a = studio({ areaLabel: "서울, 역삼", rooms: [room({})] });
  const b = studio({ areaLabel: "성남, 야탑", rooms: [room({})] });
  assert.deepEqual(applyStudioFilters([a, b], { ...EMPTY, city: "서울" }).map((s) => s.areaLabel), ["서울, 역삼"]);
  assert.deepEqual(applyStudioFilters([a, b], { ...EMPTY, city: "서울", dongs: ["이수"] }), []);
});

test("악기 AND: 한 방에 모두", () => {
  const ok = studio({ rooms: [room({ equipment: [{ name: "x", type: "DRUM" }, { name: "y", type: "BASS_AMP" }] })] });
  const split = studio({ rooms: [room({ equipment: [{ name: "x", type: "DRUM" }] }), room({ equipment: [{ name: "y", type: "BASS_AMP" }] })] });
  const f = { ...EMPTY, instrumentTypes: ["DRUM", "BASS_AMP"] as const };
  assert.equal(applyStudioFilters([ok], { ...f }).length, 1);
  assert.equal(applyStudioFilters([split], { ...f }).length, 0); // 두 방에 나뉘면 제외
});

test("가격대/인원/주차/악기대여 + 가격 오름차순 정렬", () => {
  const cheap = studio({ hourlyPriceMin: 12000, rooms: [room({ hourlyPrice: 12000, capacity: 5 })] });
  const mid = studio({ hourlyPriceMin: 22000, hasParking: true, amenities: "악기대여 O, 주차 O", rooms: [room({ hourlyPrice: 22000, capacity: 15 })] });
  // 가격대 20_25 → mid 만
  assert.deepEqual(applyStudioFilters([cheap, mid], { ...EMPTY, priceBucket: "20_25" }).map((s) => s.hourlyPriceMin), [22000]);
  // 인원 10이상 → mid 만
  assert.deepEqual(applyStudioFilters([cheap, mid], { ...EMPTY, capacityMin: 10 }).map((s) => s.hourlyPriceMin), [22000]);
  // 주차 → mid 만
  assert.equal(applyStudioFilters([cheap, mid], { ...EMPTY, parkingOnly: true }).length, 1);
  // 악기대여 → mid 만
  assert.equal(applyStudioFilters([cheap, mid], { ...EMPTY, rentalOnly: true }).length, 1);
  // 정렬: 둘 다 통과 시 cheap 먼저
  assert.deepEqual(applyStudioFilters([mid, cheap], { ...EMPTY }).map((s) => s.hourlyPriceMin), [12000, 22000]);
});
```

- [ ] **Step 2: 실패 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/filter.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head`.

- [ ] **Step 3: 구현** — `filter.ts`:
```ts
import type { Studio, RoomEquipmentType } from "./types";

export type PriceBucket = "u15" | "15_20" | "20_25" | "o25";
export type StudioFilter = {
  city: string | null;
  dongs: string[];
  instrumentTypes: RoomEquipmentType[];
  priceBucket: PriceBucket | null;
  capacityMin: number | null;
  parkingOnly: boolean;
  rentalOnly: boolean;
};

const CITIES = new Set(["서울", "성남", "수원"]);

export function parseArea(label: string | null): { city: string | null; dong: string | null } {
  if (!label) return { city: null, dong: null };
  let city: string | null = null;
  let dong: string | null = null;
  for (const tok of label.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (CITIES.has(tok)) city = tok; else dong = tok;
  }
  return { city, dong };
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

export function applyStudioFilters(studios: Studio[], f: StudioFilter): Studio[] {
  return studios
    .filter((s) => {
      const { city, dong } = parseArea(s.areaLabel);
      if (f.city && city !== f.city) return false;
      if (f.dongs.length && (dong == null || !f.dongs.includes(dong))) return false;
      if (f.parkingOnly && !s.hasParking) return false;
      if (f.rentalOnly && !/악기대여\s*O/.test(s.amenities ?? "")) return false;
      return s.rooms.some((r) => {
        if (f.priceBucket && !priceBucketMatch(r.hourlyPrice, f.priceBucket)) return false;
        if (f.capacityMin != null && !(r.capacity != null && r.capacity >= f.capacityMin)) return false;
        if (f.instrumentTypes.length && !f.instrumentTypes.every((t) => r.equipment.some((g) => g.type === t))) return false;
        return true;
      });
    })
    .sort((a, b) => (a.hourlyPriceMin ?? Infinity) - (b.hourlyPriceMin ?? Infinity));
}
```

- [ ] **Step 4: 통과 확인** — `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/filter.test.ts 2>&1 | grep -E "# (pass|fail)"`. Expected `# fail 0`.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/filter.ts src/lib/playground/rehearsal/filter.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/filter.ts src/lib/playground/rehearsal/filter.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): pure studio filter (parseArea/priceBucket/applyStudioFilters, TDD)"
```

---

## Task 2: 필터 라우트 (`/api/.../filter`)

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
  dongs: z.array(z.string()).default([]),
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
  return NextResponse.json({ studios: applyStudioFilters(studios, parsed.data) });
}
```

- [ ] **Step 2: 타입 컴파일** — `sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep "filter/route" || echo "filter route clean"`. Expected: `filter route clean`.

- [ ] **Step 3: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/api/playground/rehearsal/filter/route.ts
sudo -u ec2-user git add src/app/api/playground/rehearsal/filter/route.ts
sudo -u ec2-user git commit -m "feat(rehearsal): POST /api/.../filter route (dev-gated, zod)"
```

---

## Task 3: 결과 카드 공유 컴포넌트 (`StudioCard.tsx`) + 추천 모드 리팩터

**Files:**
- Create: `<repo>/src/app/playground/rehearsal-finder/StudioCard.tsx`
- Modify: `<repo>/src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx`

- [ ] **Step 1: `StudioCard.tsx` 작성** — EXACTLY:
```tsx
"use client";
import { buttonClasses } from "@/components/Button";
import { ROOM_EQUIPMENT_LABELS, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";

export type CardGear = { name: string; type: string };
export type CardRoom = { id: number; name: string; hourlyPrice: number | null; capacity: number | null; equipment: CardGear[]; review: string | null };
export type CardStudio = {
  name: string; regionName: string | null; areaLabel: string | null; roadAddress: string | null;
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
  return (
    <div className="border border-[var(--color-border)] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-bold text-lg">{rankNo ? `${rankNo}. ` : ""}{studio.name}</h3>
        <span className="shrink-0 text-sm text-[var(--color-text-muted)]">{studio.regionName ?? studio.areaLabel ?? ""}</span>
      </div>
      {reason && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {travel && <span>⏱ 평균 {Math.round(travel.avgMinutes)}분 · 최대 {Math.round(travel.maxMinutes)}분</span>}
        {price && <span>💸 {price}</span>}
        <span>🚪 방 {studio.rooms.length}</span>
        {studio.hasParking && <span>🅿 주차</span>}
      </div>
      {studio.equipmentTypes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {studio.equipmentTypes.map((t) => (
            <span key={t} className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 text-[11px]">{ROOM_EQUIPMENT_LABELS[t]}</span>
          ))}
        </div>
      )}
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

- [ ] **Step 2: `RehearsalFinderClient.tsx` 리팩터** — 결과 카드를 `StudioCard` 로 교체.

(a) import 추가(상단):
```tsx
import StudioCard, { type CardStudio } from "./StudioCard";
```
(b) `ResultGear/ResultRoom/ResultStudio` 타입 선언 3개를 삭제하고, `ResultItem` 의 `studio: ResultStudio;` 를 `studio: CardStudio;` 로, `detailStudio` state 타입을 `CardStudio | null` 로 바꾼다. (즉 `useState<ResultStudio | null>` → `useState<CardStudio | null>`.) `RoomEquipmentType` import 가 더 이상 안 쓰이면 import 에서 제거. `ROOM_EQUIPMENT_LABELS` 도 카드로 옮겨갔으니 client 에서 안 쓰면 import 제거.
(c) `{results.map((r) => { … return ( <div key={r.rankNo} …> … </div> ); })}` 전체를 아래로 교체:
```tsx
          {results.map((r) => (
            <StudioCard key={r.rankNo} studio={r.studio} rankNo={r.rankNo} reason={r.reason}
              travel={{ avgMinutes: r.avgMinutes, maxMinutes: r.maxMinutes, memberRoutes: r.memberRoutes }}
              onDetail={setDetailStudio} />
          ))}
```
(d) 하단 `<StudioDetailModal studio={detailStudio} … />` 는 그대로(타입 CardStudio 호환).

- [ ] **Step 3: 잔존 import 정리 + 타입 컴파일**
```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-finder|StudioCard" || echo "tsc clean"
```
Expected: `tsc clean`. (미사용 import 가 있으면 제거: `ROOM_EQUIPMENT_LABELS`/`RoomEquipmentType` 가 client 에서 안 쓰이면.)

- [ ] **Step 4: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/StudioCard.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/StudioCard.tsx src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx
sudo -u ec2-user git commit -m "refactor(rehearsal): extract StudioCard, use in recommend results"
```

---

## Task 4: 필터 클라이언트 + 모드 엔트리 + page

**Files:**
- Create: `<repo>/src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx`
- Create: `<repo>/src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx`
- Modify: `<repo>/src/app/playground/rehearsal-finder/page.tsx`

- [ ] **Step 1: `RehearsalFilterClient.tsx` 작성** — EXACTLY:
```tsx
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import StudioCard, { type CardStudio } from "./StudioCard";
import StudioDetailModal from "./StudioDetailModal";
import { ROOM_EQUIPMENT_LABELS } from "@/lib/playground/rehearsal/types";

const AREA_OPTIONS: Record<string, string[]> = {
  "서울": ["역삼", "이수", "잠실", "합정", "흑석", "석촌", "방배", "사당", "양재"],
  "성남": ["야탑", "정자"],
  "수원": ["인계"],
};
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
  const [dongs, setDongs] = useState<string[]>([]);
  const [instrumentTypes, setInstrumentTypes] = useState<string[]>([]);
  const [priceBucket, setPriceBucket] = useState<string | null>(null);
  const [capacityMin, setCapacityMin] = useState<number | null>(null);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [rentalOnly, setRentalOnly] = useState(false);
  const [results, setResults] = useState<CardStudio[] | null>(null);
  const [detailStudio, setDetailStudio] = useState<CardStudio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }

  async function apply() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/playground/rehearsal/filter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ city, dongs, instrumentTypes, priceBucket, capacityMin, parkingOnly, rentalOnly }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "필터 실패"); return; }
      setResults(data.studios);
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
            <button type="button" className={chip(city === null)} onClick={() => { setCity(null); setDongs([]); }}>전체</button>
            {Object.keys(AREA_OPTIONS).map((c) => (
              <button key={c} type="button" className={chip(city === c)} onClick={() => { setCity(c); setDongs([]); }}>{c}</button>
            ))}
          </div>
          {city && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {AREA_OPTIONS[city].map((d) => (
                <button key={d} type="button" className={chip(dongs.includes(d))} onClick={() => setDongs(toggle(dongs, d))}>{d}</button>
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
          <h2 className="font-display font-bold text-xl">조건에 맞는 합주실 {results.length}곳</h2>
          {results.length === 0 && <p className="text-[var(--color-text-muted)]">조건에 맞는 곳이 없어요. 필터를 완화해보세요.</p>}
          {results.map((s, i) => <StudioCard key={i} studio={s} onDetail={setDetailStudio} />)}
        </div>
      )}
      <StudioDetailModal studio={detailStudio} onClose={() => setDetailStudio(null)} />
    </div>
  );
}
```
> 주: instrumentTypes/priceBucket 은 string state 로 두고 라우트가 Zod 로 검증(잘못된 값은 무시/에러). AREA_OPTIONS 는 현재 데모 데이터 기준 하드코딩(데이터 변경 시 갱신).

- [ ] **Step 2: `RehearsalFinderEntry.tsx` 작성** — EXACTLY:
```tsx
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
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

- [ ] **Step 3: `page.tsx` 교체** — `import RehearsalFinderClient from "./RehearsalFinderClient";` → `import RehearsalFinderEntry from "./RehearsalFinderEntry";`, 그리고 `<RehearsalFinderClient />` → `<RehearsalFinderEntry />`. (header 문구는 유지.)

- [ ] **Step 4: 타입 컴파일**
```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-finder" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 5: Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/RehearsalFilterClient.tsx src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx src/app/playground/rehearsal-finder/page.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): mode selector entry + filter client"
```

---

## Task 5: 빌드 · 스모크 · push

- [ ] **Step 1: 전체 lib 테스트 + 빌드 + 재시작**
```bash
cd <repo>
for f in geo scoring reason route-provider ranker recommend metroStations chosung gearClassify studioImport types filter; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)" | tr '\n' ' '; echo;
done
sudo -u ec2-user pnpm build 2>&1 | grep -E "Compiled|error|Error|Failed" | head
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 4
curl -s -o /dev/null -w "route: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
```
Expected: 각 테스트 `# fail 0`, 빌드 성공, route 200.

- [ ] **Step 2: 모드 셀렉터 + 필터 라우트 스모크**
```bash
cd <repo>
html=$(curl -s "http://127.0.0.1:3101/playground/rehearsal-finder")
echo "멤버 위치 버튼: $(echo "$html" | grep -o '멤버 위치 기반으로 찾기' | wc -l)"
echo "조건 필터 버튼: $(echo "$html" | grep -o '조건으로 필터링하기' | wc -l)"
echo "=== /filter (서울+드럼+20_25) ==="
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/filter" -H 'Content-Type: application/json' \
  -d '{"city":"서울","instrumentTypes":["DRUM"],"priceBucket":"20_25"}' \
  | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("matched:",j.studios.length);for(const st of j.studios.slice(0,5))console.log("  -",st.name,"|",st.areaLabel,"| min",st.hourlyPriceMin,"| 방",st.rooms.length);});'
echo "=== /filter 전체(빈 필터) ==="
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/filter" -H 'Content-Type: application/json' -d '{}' | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log("전체:",JSON.parse(s).studios.length,"곳 (20 이어야)");});'
```
Expected: 두 버튼 각 1, /filter 가 매칭 합주실 반환(가격 오름차순), 빈 필터=20곳.

- [ ] **Step 3: 브라우저 수동 확인 안내**

`https://dev.bandsustain.com/playground/rehearsal-finder` — (1) 진입 시 두 버튼, (2) [조건으로 필터링] → 지역(시→동)·악기·가격대·인원·주차·악기대여 필터 → [이 조건으로 찾기] → 결과 카드(이동시간 없음) + 자세히 보기, (3) [멤버 위치 기반] → 기존 추천 동작, (4) "← 다른 방법으로 찾기" 전환.

- [ ] **Step 4: dev push**
```bash
cd <repo>
sudo -u ec2-user git push origin dev
```
> **⛔ 멈춤.** dev push 후 사용자에게 확인 요청. 운영 반영은 명시 요청 시에만(이 기능은 DB 변경 없음 — 코드만).

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** 모드 셀렉터(§2)=T4 Entry · 필터 UI(§3)=T4 FilterClient · 매칭규칙/parseArea/버킷(§4)=T1 · 백엔드 라우트(§5)=T2 · StudioCard 추출·재사용(§6)=T3. 테스트(§8)=T1 단위 + T5 스모크.
- **타입 일관성:** `StudioFilter`/`PriceBucket`(T1) ↔ 라우트 Zod(T2) ↔ FilterClient 바디(T4). `CardStudio`(T3 StudioCard) ↔ 추천 ResultItem.studio(T3) ↔ 필터 results(T4) ↔ `StudioDetailModal` DetailStudio(구조적 호환). recommend 응답 studio shape ⊇ CardStudio.
- **무변경:** recommend 백엔드·studios.ts·데이터·모달. RehearsalFinderClient 는 카드만 StudioCard 로 교체(로직 동일).
- **AND 교집합:** 악기는 한 방에 모두(every+some), 부가필터 AND, 지역 시+동. 정렬 가격 오름차순.
- **단순화:** AREA_OPTIONS 하드코딩(데모), in-app 필터, 가격 버킷 단일.
