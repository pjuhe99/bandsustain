# 합주실 추천 — 출발지 역 선택(검색 + 호선 필터) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 합주실 추천 출발지 입력을, 호선 정보가 포함된 새 역 데이터 위에서 **검색 + 호선 칩 필터**가 되는 콤보박스로 교체한다.

**Architecture:** 공개 소스(jhj0517 gist)를 빌드 스크립트로 정규화해 `{id,name,lines[],lat,lng,area,ambiguous}` 정적 JSON으로 번들. 순수 로더/검색/선택동기화 헬퍼를 `metroStations.ts`에 모아 node:test로 검증. UI는 네이티브 `datalist`를 폐기하고 `StationPicker` 컴포넌트(호선 칩 + 검색 드롭다운)로 분리하며, 멤버 상태를 `query`(표시) / `stationId`(유효 선택값) 두 필드로 분리해 상태 불일치를 차단. recommend API/스키마/추천 로직은 무변경.

**Tech Stack:** Next.js 16 App Router · React(client) · TypeScript · Tailwind v4 · `json5`(빌드 전용 devDep) · node:test(`npx tsx --test`).

**작업 규칙 (MEMORY bandsustain 섹션):** `bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. **모든 git/build는 `sudo -u ec2-user`.** dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크)는 `git add .` 금지(파일 명시 커밋). 이 작업은 **DB 변경 없음**(정적 JSON 번들). root로 파일을 만들면 ec2-user fetch/build가 EACCES — 새 파일은 커밋 전 `chown ec2-user:ec2-user`.

**테스트 실행:** `cd <repo>` 후 `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/<file>.test.ts`. (package.json에 test 스크립트 없음 — 파일 경로 직접 지정.)

**저장소 루트:** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain` (심볼릭 링크 `/root/bandsustain-dev/public_html/bandsustain`). 아래 `<repo>`는 이 경로.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `package.json` | `json5` devDependency 추가 | Modify |
| `scripts/build-metro-stations.ts` | 두 원천(jhj0517 json5 좌표 + MountainNine csv 호선)→정규화·합집합→정적 JSON 산출(재현용) | Create |
| `src/lib/playground/rehearsal/data/metro-stations.json` | 657역 `{id,name,lines[],lat,lng,area,ambiguous}` | Regenerate |
| `src/lib/playground/rehearsal/metroLineColors.ts` | 호선 표시순서(`LINE_ORDER`) + 노선색(`lineColor`) | Create |
| `src/lib/playground/rehearsal/metroStations.ts` | id 키 로더 + `getLines`/`searchStations`/`stationLabel`/`reconcileSelection` | Rewrite |
| `src/lib/playground/rehearsal/metroStations.test.ts` | 데이터 무결성 + 순수 헬퍼 단위테스트 | Rewrite |
| `src/app/playground/rehearsal-finder/StationPicker.tsx` | 호선 칩 + 검색 드롭다운 콤보박스(controlled) | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` | StationPicker 연결, datalist 제거, 멤버 state `query`/`stationId` | Modify |

설계문서: `docs/superpowers/specs/2026-06-04-rehearsal-station-search-filter-design.md`.

---

## Task 1: 역 데이터 재생성 (빌드 스크립트 + 정적 JSON)

**Files:**
- Modify: `<repo>/package.json` (devDependencies에 `json5`)
- Create: `<repo>/scripts/build-metro-stations.ts`
- Regenerate: `<repo>/src/lib/playground/rehearsal/data/metro-stations.json`

- [ ] **Step 1: `json5` devDependency 설치**

```bash
cd <repo>
sudo -u ec2-user pnpm add -D json5
```
Expected: `package.json` devDependencies에 `json5` 추가, lockfile 갱신.

- [ ] **Step 2: 빌드 스크립트 작성**

> **⚠️ 실행 중 갱신(2026-06-04):** 단일 소스(jhj0517)는 주요 환승역 호선 멤버십이 ~50% 누락(강남에 신분당선 없음, 사당 자체 없음)이라, **이중 소스(jhj0517 좌표 + MountainNine csv 호선 합집합)** 로 전환했다. 실제 커밋된 스크립트는 `62561de` 의 dual-source 버전이며, 상세 알고리즘은 설계문서 §2 참조. 아래 단일-소스 코드 블록은 역사적 참고용(최종본 아님).

Create `scripts/build-metro-stations.ts` — 원천 gist(불변 SHA 고정 raw URL)를 받아 **정식 JSON5 파서**로 파싱하고 정규화해 정적 JSON을 쓴다. 정규식으로 json5를 손보지 않는다.

```ts
/**
 * 합주실 추천용 수도권 지하철 역 데이터 빌드 스크립트.
 *
 * 원천: jhj0517 공개 gist (역명/노선/좌표, "직접 수집·일부 부정확 가능" disclaimer).
 *   https://gist.github.com/jhj0517/9bd253175c4410493af024d5e0a1c01f
 * 취득일: 2026-06-04 (아래 RAW_URL은 불변 commit SHA 고정).
 *
 * 산출: src/lib/playground/rehearsal/data/metro-stations.json
 *   { id, name, lines[], lat, lng, area, ambiguous }[]  (수도권 ~601역, 24호선)
 *
 * 실행: cd <repo> && sudo -u ec2-user npx tsx scripts/build-metro-stations.ts
 * 런타임 네트워크 의존 없음 — 산출 JSON을 커밋하면 앱 빌드는 정적 파일만 읽는다.
 */
import JSON5 from "json5";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW_URL =
  "https://gist.githubusercontent.com/jhj0517/9bd253175c4410493af024d5e0a1c01f/raw/4a71b4b16ee2a25737acd1fdc595b7b8824a0dd1/korean-subway-station-list.json5";

// 호선명 표기 정규화 (오기/표기흔들림 → 정식 노선명)
const LINE_FIX: Record<string, string> = {
  "경의중앙": "경의중앙선",
  "김포 골드라인": "김포골드라인",
  "신림역": "신림선",
};

type Src = { name: string; areas?: string[]; lines: string[]; lat: number; lng: number };
type Station = { id: string; name: string; lines: string[]; lat: number; lng: number; area: string; ambiguous: boolean };

// 수도권 bounding box (부산/대구/광주/대전 등 제외)
const inMetro = (lat: number, lng: number) =>
  lat > 36.7 && lat < 38.3 && lng > 126.2 && lng < 127.8;

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function main() {
  const res = await fetch(RAW_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  const raw = JSON5.parse(text) as Src[]; // 파싱 실패 시 throw → 빌드 실패(silent 금지)

  // 1) 수도권 필터 + 역명에서 후행 '역' 제거 + 호선 정규화
  type Norm = { name: string; lines: string[]; lat: number; lng: number; area: string };
  const norm: Norm[] = [];
  for (const d of raw) {
    const lat = Number(d.lat), lng = Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inMetro(lat, lng)) continue;
    const name = d.name.endsWith("역") ? d.name.slice(0, -1) : d.name;
    const lines = [...new Set(d.lines.map((l) => LINE_FIX[l] ?? l))].sort((a, b) => a.localeCompare(b, "ko"));
    norm.push({ name, lines, lat, lng, area: (d.areas?.[0] ?? "") });
  }

  // 2) 같은 name 그룹 내 <1.5km 군집 병합
  const groups = new Map<string, Norm[]>();
  for (const r of norm) (groups.get(r.name) ?? groups.set(r.name, []).get(r.name)!).push(r);

  const merged: Norm[] = [];
  for (const [, es] of groups) {
    const clusters: Norm[][] = [];
    for (const e of es) {
      const c = clusters.find((cl) => haversineKm([cl[0].lat, cl[0].lng], [e.lat, e.lng]) < 1.5);
      if (c) c.push(e); else clusters.push([e]);
    }
    for (const c of clusters) {
      const lines = [...new Set(c.flatMap((e) => e.lines))].sort((a, b) => a.localeCompare(b, "ko"));
      const lat = Number((c.reduce((s, e) => s + e.lat, 0) / c.length).toFixed(6));
      const lng = Number((c.reduce((s, e) => s + e.lng, 0) / c.length).toFixed(6));
      merged.push({ name: c[0].name, lines, lat, lng, area: c[0].area });
    }
  }

  // 3) ambiguous(동명 2곳 이상) + id 부여
  const nameCount = new Map<string, number>();
  for (const m of merged) nameCount.set(m.name, (nameCount.get(m.name) ?? 0) + 1);

  const out: Station[] = merged
    .map((m) => {
      const ambiguous = (nameCount.get(m.name) ?? 0) > 1;
      return { id: ambiguous ? `${m.name}#${m.area}` : m.name, name: m.name, lines: m.lines, lat: m.lat, lng: m.lng, area: m.area, ambiguous };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id, "ko"));

  // 4) 무결성 가드 (위반 시 빌드 실패)
  const ids = out.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate ids");
  for (const s of out) {
    if (!(s.lat >= 33 && s.lat <= 39 && s.lng >= 124 && s.lng <= 132)) throw new Error(`coord OOR: ${s.id}`);
    if (s.lines.length === 0) throw new Error(`no lines: ${s.id}`);
  }
  if (out.length < 550) throw new Error(`too few stations: ${out.length}`);

  const dest = resolve(__dirname, "../src/lib/playground/rehearsal/data/metro-stations.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf-8");
  const lineCount = new Set(out.flatMap((s) => s.lines)).size;
  console.log(`wrote ${out.length} stations, ${lineCount} lines -> ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: 스크립트 실행 → JSON 재생성**

```bash
cd <repo>
sudo -u ec2-user npx tsx scripts/build-metro-stations.ts
```
Expected: `wrote 601 stations, 24 lines -> .../metro-stations.json` (±몇 역 허용; 550 미만이면 throw). 네트워크 차단 시 fetch 실패 → 그 경우 보고하고 멈춤(BLOCKED).

- [ ] **Step 4: 산출물 형태 확인**

```bash
cd <repo>
sudo -u ec2-user node -e "const d=require('./src/lib/playground/rehearsal/data/metro-stations.json'); console.log('count',d.length); console.log('keys',Object.keys(d[0])); console.log('강남',d.find(s=>s.id==='강남')); console.log('양평',d.filter(s=>s.name==='양평'))"
```
Expected: count 601, keys `id,name,lines,lat,lng,area,ambiguous`, 강남 `lines:["2호선"]`, 양평 2엔트리(`양평#영등포구`,`양평#양평군`, `ambiguous:true`).

- [ ] **Step 5: 소유권 보정 + Commit**

```bash
cd <repo>
chown ec2-user:ec2-user scripts/build-metro-stations.ts
sudo -u ec2-user git add package.json pnpm-lock.yaml scripts/build-metro-stations.ts src/lib/playground/rehearsal/data/metro-stations.json
sudo -u ec2-user git commit -m "feat(rehearsal): regenerate metro station data with lines (build script + JSON5 source)"
```

---

## Task 2: 호선 색/순서 상수 (`metroLineColors.ts`)

**Files:**
- Create: `<repo>/src/lib/playground/rehearsal/metroLineColors.ts`

- [ ] **Step 1: 상수 작성**

```ts
// 호선 표시 순서(칩/목록) + 노선색. 미정의 호선은 중립 회색 fallback.
export const LINE_ORDER: string[] = [
  "1호선", "2호선", "3호선", "4호선", "5호선", "6호선", "7호선", "8호선", "9호선",
  "신분당선", "수인분당선", "경의중앙선", "경춘선", "공항철도",
  "인천1호선", "인천2호선", "의정부선", "에버라인", "우이신설선",
  "경강선", "서해선", "김포골드라인", "신림선", "GTX-A",
];

const COLORS: Record<string, string> = {
  "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE",
  "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C",
  "9호선": "#BDB092", "신분당선": "#D4003B", "수인분당선": "#FABE00", "경의중앙선": "#77C4A3",
  "경춘선": "#0C8E72", "공항철도": "#0090D2", "인천1호선": "#7CA8D5", "인천2호선": "#ED8B00",
  "의정부선": "#FDA600", "에버라인": "#6FB245", "우이신설선": "#B7C452", "경강선": "#003DA5",
  "서해선": "#8FC31F", "김포골드라인": "#AD8605", "신림선": "#6789CA", "GTX-A": "#9A6292",
};

export function lineColor(line: string): string {
  return COLORS[line] ?? "#888888";
}
```

- [ ] **Step 2: 타입 컴파일 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep metroLineColors || echo "no errors in metroLineColors"
```
Expected: `no errors in metroLineColors`.

- [ ] **Step 3: Commit**

```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/metroLineColors.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/metroLineColors.ts
sudo -u ec2-user git commit -m "feat(rehearsal): metro line order + official colors"
```

---

## Task 3: 로더 + 순수 헬퍼 재작성 (`metroStations.ts`) — TDD

**Files:**
- Test: `<repo>/src/lib/playground/rehearsal/metroStations.test.ts` (rewrite)
- Modify: `<repo>/src/lib/playground/rehearsal/metroStations.ts` (rewrite)

> 기존 `getStationNames`/`findStationByName`(name 키)는 제거된다. Task 5에서 클라이언트가 새 API로 전환하므로 깨지는 import는 Task 5에서 정리.

- [ ] **Step 1: 실패 테스트 작성 (기존 파일 전체 교체)**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  METRO_STATIONS, getStations, getLines, findStationById,
  stationLabel, searchStations, reconcileSelection,
} from "./metroStations";

test("데이터 로드: 수도권 역이 충분히 많다 (>550)", () => {
  assert.ok(METRO_STATIONS.length > 550, `got ${METRO_STATIONS.length}`);
});

test("모든 좌표가 한국 범위(위도 33~39, 경도 124~132) 안", () => {
  for (const s of METRO_STATIONS) {
    assert.ok(s.lat >= 33 && s.lat <= 39, `${s.id} lat ${s.lat}`);
    assert.ok(s.lng >= 124 && s.lng <= 132, `${s.id} lng ${s.lng}`);
  }
});

test("id 유니크 · lines 비어있지 않음", () => {
  const ids = METRO_STATIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of METRO_STATIONS) assert.ok(s.lines.length > 0, `${s.id} has no lines`);
});

test("호선명 정규화: 흔들림 표기 잔존 0", () => {
  const bad = new Set(["경의중앙", "김포 골드라인", "신림역"]);
  for (const s of METRO_STATIONS) for (const l of s.lines) assert.ok(!bad.has(l), `bad line ${l} in ${s.id}`);
});

test("getLines: 24개 호선, LINE_ORDER 순서대로", () => {
  const lines = getLines();
  assert.equal(lines.length, 24, lines.join(","));
  assert.equal(lines[0], "1호선");
  assert.ok(lines.includes("수인분당선") && lines.includes("GTX-A"));
});

test("동명이역 양평: 2엔트리 · ambiguous true", () => {
  const yp = getStations().filter((s) => s.name === "양평");
  assert.equal(yp.length, 2, "양평 should have 2 entries");
  assert.ok(yp.every((s) => s.ambiguous), "both ambiguous");
});

test("findStationById: 매칭/미매칭", () => {
  const s = findStationById("강남");
  assert.ok(s, "강남 should exist");
  assert.deepEqual(s!.lines, ["2호선", "신분당선"]);
  assert.equal(findStationById("없는id12345"), null);
});

test("stationLabel: 일반역=name, 동명이역=name (area)", () => {
  assert.equal(stationLabel(findStationById("강남")!), "강남");
  const yp = getStations().find((s) => s.id === "양평#영등포구")!;
  assert.equal(stationLabel(yp), "양평 (영등포구)");
});

test("searchStations: 빈/공백 쿼리는 항상 [] (호선 선택과 무관)", () => {
  assert.deepEqual(searchStations("", []), []);
  assert.deepEqual(searchStations("   ", ["2호선"]), []);
});

test("searchStations: 한글 prefix 매칭 + prefix 우선 정렬", () => {
  const r = searchStations("강남", []);
  assert.ok(r.length > 0);
  assert.equal(r[0].name.startsWith("강남"), true);
  assert.ok(r.some((s) => s.id === "강남"));
});

test("searchStations: 호선 필터 교집합", () => {
  const r = searchStations("강", ["신분당선"]);
  assert.ok(r.every((s) => s.lines.includes("신분당선")), "all on 신분당선");
  assert.ok(r.some((s) => s.name === "강남"), "강남 is on 신분당선");
});

test("searchStations: 결과 상한 50", () => {
  assert.ok(searchStations("역", []).length <= 50);
});

test("reconcileSelection: 라벨 일치 유지 / 불일치 시 null", () => {
  assert.equal(reconcileSelection("강남", "강남"), "강남");
  assert.equal(reconcileSelection("강남", "강남구청"), null);
  assert.equal(reconcileSelection(null, "강남"), null);
  assert.equal(reconcileSelection("강남", ""), null);
  // 동명이역: 라벨(괄호 포함)이 정확히 일치해야 유지
  assert.equal(reconcileSelection("양평#영등포구", "양평 (영등포구)"), "양평#영등포구");
  assert.equal(reconcileSelection("양평#영등포구", "양평"), null);
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head
```
Expected: import 실패/`fail`(아직 새 export 없음).

- [ ] **Step 3: 로더 구현 (파일 전체 교체)**

```ts
import stationsData from "./data/metro-stations.json";
import { LINE_ORDER } from "./metroLineColors";

export type MetroStation = {
  id: string; name: string; lines: string[]; lat: number; lng: number; area: string; ambiguous: boolean;
};

export const METRO_STATIONS: MetroStation[] = stationsData as MetroStation[];

const byId = new Map<string, MetroStation>(METRO_STATIONS.map((s) => [s.id, s]));

export function getStations(): MetroStation[] {
  return METRO_STATIONS;
}

export function findStationById(id: string): MetroStation | null {
  return byId.get(id) ?? null;
}

export function stationLabel(s: MetroStation): string {
  return s.ambiguous ? `${s.name} (${s.area})` : s.name;
}

function lineRank(line: string): number {
  const i = LINE_ORDER.indexOf(line);
  return i === -1 ? 999 : i;
}

export function getLines(): string[] {
  const present = new Set<string>();
  for (const s of METRO_STATIONS) for (const l of s.lines) present.add(l);
  return [...present].sort((a, b) => lineRank(a) - lineRank(b) || a.localeCompare(b, "ko"));
}

const normalize = (s: string) => s.trim().replace(/\s+/g, "").toLowerCase();

export function searchStations(query: string, selectedLines: string[]): MetroStation[] {
  const q = normalize(query);
  if (!q) return []; // 빈 쿼리: 호선 선택과 무관하게 나열하지 않음 (search-first)
  const lineSet = new Set(selectedLines);
  const matches: { s: MetroStation; prefix: boolean }[] = [];
  for (const s of METRO_STATIONS) {
    if (lineSet.size > 0 && !s.lines.some((l) => lineSet.has(l))) continue;
    const n = normalize(s.name);
    if (n.startsWith(q)) matches.push({ s, prefix: true });
    else if (n.includes(q)) matches.push({ s, prefix: false });
  }
  matches.sort((a, b) =>
    a.prefix === b.prefix ? a.s.name.localeCompare(b.s.name, "ko") : a.prefix ? -1 : 1,
  );
  return matches.slice(0, 50).map((m) => m.s);
}

// 선택 후 입력 텍스트가 라벨과 달라지면 선택 무효화 — 표시/선택값 불일치 차단.
export function reconcileSelection(selectedStationId: string | null, newQuery: string): string | null {
  if (!selectedStationId) return null;
  const s = byId.get(selectedStationId);
  if (!s) return null;
  return stationLabel(s) === newQuery ? selectedStationId : null;
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts 2>&1 | grep -E "# (pass|fail)"
```
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd <repo>
sudo -u ec2-user git add src/lib/playground/rehearsal/metroStations.ts src/lib/playground/rehearsal/metroStations.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): id-keyed station loader + getLines/searchStations/stationLabel/reconcileSelection (TDD)"
```

---

## Task 4: 역 선택 콤보박스 (`StationPicker.tsx`)

**Files:**
- Create: `<repo>/src/app/playground/rehearsal-finder/StationPicker.tsx`

> controlled 컴포넌트: 부모(멤버 state)가 `query`/`stationId`를 들고, 콜백으로 변경을 받는다. 호선 칩 선택(`selectedLines`)·드롭다운 open·하이라이트는 내부 state.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";
import { useMemo, useRef, useState } from "react";
import {
  getLines, searchStations, type MetroStation,
} from "@/lib/playground/rehearsal/metroStations";
import { lineColor } from "@/lib/playground/rehearsal/metroLineColors";

const ALL_LINES = getLines();

function LineBadge({ line }: { line: string }) {
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
      style={{ backgroundColor: lineColor(line) }}>{line}</span>
  );
}

export default function StationPicker({
  query, invalid, onQueryChange, onSelect,
}: {
  query: string;
  invalid: boolean;
  onQueryChange: (q: string) => void;
  onSelect: (s: MetroStation) => void;
}) {
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchStations(query, selectedLines), [query, selectedLines]);

  function toggleLine(line: string) {
    setSelectedLines((cur) => (cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line]));
  }

  function pick(s: MetroStation) {
    onSelect(s);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { if (results[highlight]) { e.preventDefault(); pick(results[highlight]); } }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const inputCls = "border px-3 py-2 text-sm w-full";

  return (
    <div ref={boxRef} className="relative"
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      {/* 호선 칩 */}
      <div className="mb-1 flex flex-wrap gap-1">
        <button type="button" onClick={() => setSelectedLines([])}
          className={`rounded px-2 py-0.5 text-[11px] border ${selectedLines.length === 0 ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border-strong)]"}`}>
          전체
        </button>
        {ALL_LINES.map((line) => {
          const on = selectedLines.includes(line);
          return (
            <button key={line} type="button" onClick={() => toggleLine(line)}
              className="rounded px-2 py-0.5 text-[11px] font-bold border"
              style={on
                ? { backgroundColor: lineColor(line), color: "#fff", borderColor: lineColor(line) }
                : { color: lineColor(line), borderColor: lineColor(line) }}>
              {line}
            </button>
          );
        })}
      </div>

      {/* 검색 입력 */}
      <input
        value={query}
        placeholder="역명 검색 (예: 강남)"
        className={`${inputCls} ${invalid ? "border-red-500" : "border-[var(--color-border-strong)]"}`}
        onChange={(e) => { onQueryChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox" aria-expanded={open} aria-autocomplete="list" inputMode="text"
      />

      {/* 드롭다운 */}
      {open && (
        <div role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto border border-[var(--color-border-strong)] bg-[var(--color-bg)] shadow-lg">
          {query.trim() === "" ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">역명을 입력하세요</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">검색 결과 없음</p>
          ) : (
            results.map((s, i) => (
              <button key={s.id} type="button" role="option" aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)} onClick={() => pick(s)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${i === highlight ? "bg-[var(--color-surface,#f3f3f3)]" : ""}`}>
                <span>{s.name}{s.ambiguous ? <span className="text-[var(--color-text-muted)]"> ({s.area})</span> : null}</span>
                <span className="flex flex-wrap justify-end gap-1">{s.lines.map((l) => <LineBadge key={l} line={l} />)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입 컴파일 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "StationPicker" || echo "no StationPicker type errors"
```
Expected: `no StationPicker type errors`.

- [ ] **Step 3: 소유권 보정 + Commit**

```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/StationPicker.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/StationPicker.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): StationPicker combobox (line chips + searchable dropdown)"
```

---

## Task 5: 추천 폼에 연결 (`RehearsalFinderClient.tsx`)

**Files:**
- Modify: `<repo>/src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx`

> 멤버 state를 `{ nickname, station: string }` → `{ nickname, query: string, stationId: string | null }`로 교체. datalist 제거, StationPicker 연결, originText에 `stationLabel` 전송.

- [ ] **Step 1: import 교체 (4행 부근)**

기존:
```tsx
import { getStationNames, findStationByName } from "@/lib/playground/rehearsal/metroStations";
```
교체:
```tsx
import { findStationById, stationLabel, reconcileSelection } from "@/lib/playground/rehearsal/metroStations";
import StationPicker from "./StationPicker";
```

- [ ] **Step 2: MemberForm 타입 + 초기 state + STATION_NAMES 제거 (8~23행 부근)**

기존:
```tsx
type MemberForm = { nickname: string; station: string };

const STATION_NAMES = getStationNames();
```
교체:
```tsx
type MemberForm = { nickname: string; query: string; stationId: string | null };
```
그리고 초기 state:
```tsx
  const [members, setMembers] = useState<MemberForm[]>([
    { nickname: "", query: "", stationId: null },
    { nickname: "", query: "", stationId: null },
  ]);
```

- [ ] **Step 3: submit의 검증·payload 매핑 교체 (37~60행 부근)**

기존 `typedButUnknown`~`payload` 블록을 교체:
```tsx
      const typedButUnknown = members.filter((m) => m.query.trim() && !m.stationId);
      if (typedButUnknown.length > 0) {
        setError(`목록에서 역을 선택하세요: ${typedButUnknown.map((m) => m.query).join(", ")}`);
        return;
      }
      const payload = {
        transportMode,
        maxBudgetPerHour: maxBudget ? Number(maxBudget) : null,
        requiredEquipment,
        preferredRegionIds,
        members: members
          .map((m) => ({ m, st: m.stationId ? findStationById(m.stationId) : null }))
          .filter((x) => x.m.nickname.trim() && x.st)
          .map(({ m, st }) => ({
            nickname: m.nickname,
            originText: stationLabel(st!),
            originLat: st!.lat,
            originLng: st!.lng,
            originType: "station",
            transportMode,
          })),
      };
```

- [ ] **Step 4: 멤버 입력 JSX 교체 (datalist + 멤버 행, 78~104행 부근)**

기존 `<datalist>…</datalist>` 와 `members.map(...)` 행 전체, 그리고 하단 안내 문구를 교체:
```tsx
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_40px] gap-2 items-start">
              <input placeholder="닉네임" value={m.nickname} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, nickname: e.target.value } : x))} />
              <StationPicker
                query={m.query}
                invalid={m.query.trim().length > 0 && !m.stationId}
                onQueryChange={(q) => setMembers(members.map((x, j) =>
                  j === i ? { ...x, query: q, stationId: reconcileSelection(x.stationId, q) } : x))}
                onSelect={(s) => setMembers(members.map((x, j) =>
                  j === i ? { ...x, stationId: s.id, query: stationLabel(s) } : x))}
              />
              <button type="button" className="text-red-600 py-2"
                onClick={() => setMembers(members.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        {members.length < 10 && (
          <button type="button" className="mt-2 text-sm border border-[var(--color-border-strong)] px-3 py-1"
            onClick={() => setMembers([...members, { nickname: "", query: "", stationId: null }])}>+ 멤버 추가</button>
        )}
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">※ 멤버별로 가까운 지하철 역을 검색·선택하세요(호선 칩으로 좁힐 수 있어요). 좌표는 자동으로 채워집니다.</p>
```
> 주: 기존 `const input = "..."`(32행)는 닉네임 input에 계속 쓰이므로 유지.

- [ ] **Step 5: 타입 컴파일 + 잔존 참조 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-finder|getStationNames|findStationByName|\.station\b" || echo "clean"
```
Expected: `clean` (옛 `getStationNames`/`findStationByName`/`m.station` 참조 없음).

- [ ] **Step 6: Commit**

```bash
cd <repo>
sudo -u ec2-user git add src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): wire StationPicker into finder form (query/stationId state, label originText)"
```

---

## Task 6: 빌드 · 스모크 · 회귀

**Files:** (없음 — 검증 단계)

- [ ] **Step 1: 전체 lib 테스트 회귀**

```bash
cd <repo>
for f in geo scoring reason route-provider ranker recommend metroStations; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)";
done
```
Expected: 각 파일 `# fail 0`.

- [ ] **Step 2: 빌드 + 재시작 (DEV)**

```bash
cd <repo>
sudo -u ec2-user pnpm build 2>&1 | tail -8
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 3
curl -s -o /dev/null -w "rehearsal-finder: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
```
Expected: 빌드 성공, `rehearsal-finder: 200`.

- [ ] **Step 3: 콤보박스 렌더 스모크**

```bash
cd <repo>
html=$(curl -s "http://127.0.0.1:3101/playground/rehearsal-finder")
echo "$html" | grep -c "역명 검색" || echo "input MISSING"
echo "$html" | grep -c "전체" || echo "chip MISSING"
echo "$html" | grep -c "metro-stations" # 옛 datalist id 잔존 0 이어야
```
Expected: "역명 검색" ≥1, "전체" ≥1, 옛 `metro-stations` datalist id 0.

- [ ] **Step 4: end-to-end 추천 회귀 (역→좌표 payload)**

```bash
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" \
  -H 'Content-Type: application/json' \
  -d '{"headcount":2,"members":[{"nickname":"보컬","originText":"홍대입구","originLat":37.5572,"originLng":126.9254,"originType":"station"},{"nickname":"기타","originText":"강남","originLat":37.497,"originLng":127.0276,"originType":"station"}]}' \
  | head -c 300; echo
```
Expected: `searchId`와 `results`(rankNo/score/avgMinutes 포함) 반환(에러 아님).

- [ ] **Step 5: 브라우저 수동 확인 안내**

`https://dev.bandsustain.com/playground/rehearsal-finder` — (1) 역명 타이핑 시 후보 드롭다운, (2) 호선 칩 토글로 후보 좁힘, (3) 선택 후 다른 글자 입력 시 빨간 테두리(미선택), (4) 양평 검색 시 `양평 (영등포구)`/`양평 (양평군)` 구분, (5) 추천 결과 표시.

- [ ] **Step 6: dev push**

```bash
cd <repo>
sudo -u ec2-user git push origin dev
```

> **⛔ 여기서 멈춤.** dev push 후 사용자에게 `https://dev.bandsustain.com/playground/rehearsal-finder` 확인 요청. main 머지(운영 반영)는 사용자가 명시 요청 시에만. (PROD ecosystem엔 `REHEARSAL_FINDER_ENABLED`가 없어 머지돼도 PROD에선 라우트/카드 숨김.)

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지:** 데이터 소스 교체+정규화(T1) · 호선색/순서(T2) · id 로더+검색+라벨+선택동기화 헬퍼 TDD(T3) · 콤보박스 UI(T4) · 폼 연결/상태모델/originText 라벨(T5) · 빌드·스모크·e2e(T6). 스펙 §2~§6 전 항목 대응. 리뷰 4건(상태동기화·라벨 originText·JSON5 파서·빈쿼리 규칙) 모두 T3/T4/T5/T1에 반영.
- **타입 일관성:** `MetroStation`(id/name/lines/lat/lng/area/ambiguous)·`searchStations(query,selectedLines)`·`reconcileSelection(id|null,query)`·`stationLabel(station)` 시그니처가 T3 정의와 T4/T5 사용처에서 동일. StationPicker props(`query/invalid/onQueryChange/onSelect`)가 T4 정의와 T5 호출에서 일치.
- **빈쿼리/상태 규칙:** `searchStations` 빈쿼리 `[]`(T3 테스트) + UI 힌트(T4) + 선택후 재타이핑 무효화 `reconcileSelection`(T3 테스트, T5 배선)로 3중 고정.
- **알려진 단순화:** 좌표 정밀도 소스 의존(mock 직선거리라 영향 미미), 호선 칩 24개 전부 노출, 동명이역은 양평만. StationPicker는 순수 헬퍼(T3)로 로직을 빼 테스트하고 컴포넌트 자체는 e2e/수동 검증(repo 관례: React 컴포넌트 단위테스트 도구 없음).
