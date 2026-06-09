# 합주실 추천 — 출발지 선택 모달/바텀시트 + 초성 검색 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 멤버 출발지 입력을, 멤버 행은 `[역 선택]` 버튼으로 축소하고 검색 전용(+초성) 모달/바텀시트로 고르는 방식으로 교체한다.

**Architecture:** 멤버 행은 버튼만 두고, 부모가 공유 `StationSearchSheet`(모바일 바텀시트/데스크탑 모달)를 안정적 멤버 `id`로 제어한다. 시트 안은 호선 칩 없이 검색 입력 + 결과(호선 배지)뿐이며, 순수 헬퍼 `chosung.ts`로 초성 검색을 지원한다. 멤버 자유 입력이 사라져 `query`/`reconcileSelection`을 제거하고 멤버 상태를 `{id,nickname,stationId}`로 단순화한다. recommend API/추천 로직은 무변경.

**Tech Stack:** Next.js 16 App Router · React(client) · TypeScript · Tailwind v4 · node:test(`npx tsx --test`).

**작업 규칙 (MEMORY bandsustain 섹션):** `bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. **모든 git/build는 `sudo -u ec2-user`.** dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크)는 `git add .` 금지. **DB 변경 없음.** 새 파일은 커밋 전 `chown ec2-user:ec2-user`.

**테스트 실행:** `cd <repo>` 후 `sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/<file>.test.ts`.

**저장소 루트(`<repo>`):** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

설계문서: `docs/superpowers/specs/2026-06-04-rehearsal-station-sheet-chosung-design.md`.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/playground/rehearsal/chosung.ts` | 한글 초성 추출 + 초성쿼리 판별 (순수) | Create |
| `src/lib/playground/rehearsal/chosung.test.ts` | chosung 단위테스트 | Create |
| `src/lib/playground/rehearsal/metroStations.ts` | `searchStations` 초성 지원 + 시그니처 `(query)`, `reconcileSelection` 제거 | Modify |
| `src/lib/playground/rehearsal/metroStations.test.ts` | searchStations 테스트 갱신(단일인자+초성), reconcile 테스트 제거 | Modify |
| `src/app/playground/rehearsal-finder/LineBadge.tsx` | 노선색 배지 (시트·버튼 공용) | Create |
| `src/app/playground/rehearsal-finder/StationSearchSheet.tsx` | 검색 전용 모달/바텀시트 | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` | 버튼+공유 시트, `{id,nickname,stationId}` 상태, 해제 | Modify |
| `src/app/playground/rehearsal-finder/StationPicker.tsx` | 칩 콤보박스(대체됨) | Delete |

---

## Task 1: 초성 헬퍼 (`chosung.ts`) — TDD

**Files:**
- Test: `<repo>/src/lib/playground/rehearsal/chosung.test.ts`
- Create: `<repo>/src/lib/playground/rehearsal/chosung.ts`

- [ ] **Step 1: 실패 테스트 작성** — write `chosung.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { toChosung, isChosungQuery } from "./chosung";

test("toChosung: 한글 음절 → 초성", () => {
  assert.equal(toChosung("강남"), "ㄱㄴ");
  assert.equal(toChosung("강남구청"), "ㄱㄴㄱㅊ");
  assert.equal(toChosung("광화문"), "ㄱㅎㅁ");
});

test("toChosung: 비한글은 그대로 보존", () => {
  assert.equal(toChosung("GTX-A"), "GTX-A");
  assert.equal(toChosung("강남2"), "ㄱㄴ2");
});

test("isChosungQuery: 순수 초성만 true", () => {
  assert.equal(isChosungQuery("ㄱㄴ"), true);
  assert.equal(isChosungQuery("ㄱ ㄴ"), true); // 공백 무시
  assert.equal(isChosungQuery("강"), false);
  assert.equal(isChosungQuery("ㄱa"), false);
  assert.equal(isChosungQuery(""), false);
  assert.equal(isChosungQuery("   "), false);
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/chosung.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head
```
Expected: import 실패 / fail.

- [ ] **Step 3: 구현** — write `chosung.ts`:

```ts
// 한글 초성 추출 + 초성 쿼리 판별 (순수 함수, 검색용).
const CHO = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const CHO_SET = new Set(CHO);

// 각 한글 음절(U+AC00–U+D7A3)을 초성 자모로, 그 외 문자는 그대로.
export function toChosung(str: string): string {
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHO[Math.floor((code - 0xac00) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

// 공백 제거 후 모든 문자가 초성 자모(19종)면 true. 빈 문자열은 false.
export function isChosungQuery(q: string): boolean {
  const s = q.replace(/\s+/g, "");
  if (!s) return false;
  for (const ch of s) if (!CHO_SET.has(ch)) return false;
  return true;
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/chosung.test.ts 2>&1 | grep -E "# (pass|fail)"
```
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd <repo>
chown ec2-user:ec2-user src/lib/playground/rehearsal/chosung.ts src/lib/playground/rehearsal/chosung.test.ts
sudo -u ec2-user git add src/lib/playground/rehearsal/chosung.ts src/lib/playground/rehearsal/chosung.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): chosung extraction + chosung-query detection (TDD)"
```

---

## Task 2: `searchStations` 초성 지원 + 시그니처 변경 (`metroStations.ts`) — TDD

**Files:**
- Modify: `<repo>/src/lib/playground/rehearsal/metroStations.ts`
- Modify (test): `<repo>/src/lib/playground/rehearsal/metroStations.test.ts`

> Breaking change: `searchStations(query, selectedLines)` → `searchStations(query)`. `reconcileSelection` 은 제거(자유 입력 폐지로 불필요). 유일 호출처 `StationPicker.tsx` 는 Task 4에서 삭제되고, 테스트는 이 Task에서 갱신한다.

- [ ] **Step 1: 테스트 갱신 (실패 상태로)** — `metroStations.test.ts` 에서 (a) import 줄의 `reconcileSelection` 제거, (b) 기존 4개 `searchStations` 테스트 + `reconcileSelection` 테스트 블록을 아래로 교체.

import 줄(파일 상단)을 다음으로 교체:
```ts
import {
  METRO_STATIONS, getStations, getLines, findStationById,
  stationLabel, searchStations,
} from "./metroStations";
```

그리고 `test("searchStations: 빈/공백 쿼리 …")` 부터 파일 끝의 `reconcileSelection` 테스트까지(현재 마지막 5개 테스트)를 다음으로 교체:
```ts
test("searchStations: 빈/공백 쿼리는 항상 []", () => {
  assert.deepEqual(searchStations(""), []);
  assert.deepEqual(searchStations("   "), []);
});

test("searchStations: 한글 prefix 매칭 + prefix 우선", () => {
  const r = searchStations("강남");
  assert.ok(r.length > 0);
  assert.equal(r[0].name.startsWith("강남"), true);
  assert.ok(r.some((s) => s.id === "강남"));
});

test("searchStations: substring fallback (prefix 아님)", () => {
  const r = searchStations("디지털");
  assert.ok(r.some((s) => s.name.includes("디지털") && !s.name.startsWith("디지털")),
    "구로디지털단지 류가 substring 으로 잡혀야");
});

test("searchStations: 초성 'ㄱㄴ' → 강남 포함, 결과 전부 초성 prefix", () => {
  const r = searchStations("ㄱㄴ");
  assert.ok(r.some((s) => s.id === "강남"), "강남 included");
  for (const s of r) assert.ok(toChosungLocal(s.name).startsWith("ㄱㄴ"), `${s.name}`);
});

test("searchStations: 결과 상한 50", () => {
  assert.ok(searchStations("ㄱ").length <= 50);
});

// 테스트 보조 (구현과 동일 규칙) — 초성 검증용
function toChosungLocal(str) {
  const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  let out = "";
  for (const ch of str) {
    const c = ch.charCodeAt(0);
    out += (c >= 0xac00 && c <= 0xd7a3) ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
  }
  return out;
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts 2>&1 | grep -E "# (pass|fail)|Error" | head
```
Expected: 타입/런타임 실패 (searchStations 가 아직 2인자 시그니처라 `searchStations("ㄱㄴ")` 는 초성 미지원 → 초성 테스트 fail).

- [ ] **Step 3: 구현** — `metroStations.ts` 수정.

(a) 파일 상단 import에 chosung 추가 (line 2 `metroLineColors` import 아래):
```ts
import { isChosungQuery, toChosung } from "./chosung";
```

(b) 기존 `searchStations`(현재 line 37–52) 전체를 아래로 교체:
```ts
export function searchStations(query: string): MetroStation[] {
  const raw = query.trim();
  if (!raw) return [];
  const cho = isChosungQuery(raw);
  const q = cho ? raw.replace(/\s+/g, "") : normalize(query);
  // tier: 0 역명 prefix, 1 역명 substring, 2 초성 prefix (쿼리 형태로 분기 — 상호배타)
  const matches: { s: MetroStation; tier: number }[] = [];
  for (const s of METRO_STATIONS) {
    if (cho) {
      if (toChosung(s.name).startsWith(q)) matches.push({ s, tier: 2 });
    } else {
      const n = normalize(s.name);
      if (n.startsWith(q)) matches.push({ s, tier: 0 });
      else if (n.includes(q)) matches.push({ s, tier: 1 });
    }
  }
  matches.sort((a, b) => a.tier - b.tier || a.s.name.localeCompare(b.s.name, "ko"));
  return matches.slice(0, 50).map((m) => m.s);
}
```

(c) 기존 `reconcileSelection` 함수(현재 line 54–60, 주석 포함) 전체 **삭제**.

- [ ] **Step 4: 통과 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts 2>&1 | grep -E "# (pass|fail)"
```
Expected: `# fail 0`. (`normalize` 헬퍼는 그대로 사용되므로 미사용 경고 없음.)

- [ ] **Step 5: Commit**

```bash
cd <repo>
sudo -u ec2-user git add src/lib/playground/rehearsal/metroStations.ts src/lib/playground/rehearsal/metroStations.test.ts
sudo -u ec2-user git commit -m "feat(rehearsal): chosung-aware searchStations(query); drop reconcileSelection + selectedLines"
```

---

## Task 3: 노선 배지 + 검색 시트 (`LineBadge.tsx`, `StationSearchSheet.tsx`)

**Files:**
- Create: `<repo>/src/app/playground/rehearsal-finder/LineBadge.tsx`
- Create: `<repo>/src/app/playground/rehearsal-finder/StationSearchSheet.tsx`

- [ ] **Step 1: `LineBadge.tsx` 작성** (시트·멤버 버튼 공용 배지)

```tsx
import { lineColor } from "@/lib/playground/rehearsal/metroLineColors";

export default function LineBadge({ line }: { line: string }) {
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white align-middle"
      style={{ backgroundColor: lineColor(line) }}>{line}</span>
  );
}
```

- [ ] **Step 2: `StationSearchSheet.tsx` 작성** (검색 전용 모달/바텀시트)

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchStations, type MetroStation } from "@/lib/playground/rehearsal/metroStations";
import LineBadge from "./LineBadge";

export default function StationSearchSheet({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (s: MetroStation) => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchStations(query), [query]);

  // 열릴 때: 검색어 초기화 + 포커스 + body 스크롤 락 (닫힐 때 복원)
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => { document.body.style.overflow = prev; clearTimeout(t); };
  }, [open]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { if (results[highlight]) { e.preventDefault(); onSelect(results[highlight]); } }
    else if (e.key === "Escape") { onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-h-[85vh] flex-col rounded-t-2xl bg-[var(--color-bg)] shadow-xl sm:max-w-md sm:max-h-[70vh] sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-display font-bold">출발지 역 선택</h3>
          <button type="button" aria-label="닫기" onClick={onClose} className="px-2 text-[var(--color-text-muted)]">✕</button>
        </div>
        <div className="p-4 pb-2">
          <input ref={inputRef} value={query} placeholder="역명 검색 (예: 강남, ㄱㄴ)" inputMode="text"
            className="w-full border border-[var(--color-border-strong)] px-3 py-2 text-sm"
            role="combobox" aria-expanded={true} aria-autocomplete="list"
            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} onKeyDown={onKeyDown} />
        </div>
        <div role="listbox" className="overflow-auto px-2 pb-3">
          {query.trim() === "" ? (
            <p className="px-2 py-2 text-xs text-[var(--color-text-muted)]">역명을 입력하세요</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--color-text-muted)]">검색 결과 없음</p>
          ) : (
            results.map((s, i) => (
              <button key={s.id} type="button" role="option" aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)} onClick={() => onSelect(s)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ${i === highlight ? "bg-[var(--color-surface,#f3f3f3)]" : ""}`}>
                <span>{s.name}{s.ambiguous ? <span className="text-[var(--color-text-muted)]"> ({s.area})</span> : null}</span>
                <span className="flex flex-wrap justify-end gap-1">{s.lines.map((l) => <LineBadge key={l} line={l} />)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 타입 컴파일 확인**

```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "StationSearchSheet|LineBadge" || echo "no sheet/badge type errors"
```
Expected: `no sheet/badge type errors`. (이 시점엔 `RehearsalFinderClient.tsx` 가 아직 옛 StationPicker/searchStations 2인자 등으로 에러가 있을 수 있음 — Task 4에서 정리. StationSearchSheet/LineBadge 만 깨끗하면 통과.)

- [ ] **Step 4: 소유권 보정 + Commit**

```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/LineBadge.tsx src/app/playground/rehearsal-finder/StationSearchSheet.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/LineBadge.tsx src/app/playground/rehearsal-finder/StationSearchSheet.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): StationSearchSheet (modal/bottom-sheet, search-only) + LineBadge"
```

---

## Task 4: 폼 연결 + 상태 단순화 + StationPicker 삭제 (`RehearsalFinderClient.tsx`)

**Files:**
- Modify: `<repo>/src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx`
- Delete: `<repo>/src/app/playground/rehearsal-finder/StationPicker.tsx`

> 먼저 현재 파일을 읽어 구조를 파악할 것. 아래 5개 편집을 정확히 적용한다.

- [ ] **Step 1: import 교체 (line 2, 4–5)**

현재:
```tsx
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import { findStationById, stationLabel, reconcileSelection } from "@/lib/playground/rehearsal/metroStations";
import StationPicker from "./StationPicker";
```
교체:
```tsx
import { useRef, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { findStationById, stationLabel } from "@/lib/playground/rehearsal/metroStations";
import StationSearchSheet from "./StationSearchSheet";
import LineBadge from "./LineBadge";
```

- [ ] **Step 2: MemberForm 타입 + 초기 state + 새 state (line 9, 19–22)**

현재 `type MemberForm = { nickname: string; query: string; stationId: string | null };` 를 교체:
```tsx
type MemberForm = { id: number; nickname: string; stationId: string | null };
```
현재 초기 members state 를 교체:
```tsx
  const [members, setMembers] = useState<MemberForm[]>([
    { id: 0, nickname: "", stationId: null },
    { id: 1, nickname: "", stationId: null },
  ]);
  const nextId = useRef(2);
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);
```
(나머지 transportMode/maxBudget/... state 는 그대로.)

- [ ] **Step 3: submit 검증·payload 교체 (line 36–57)**

현재 `const typedButUnknown = …` 부터 `payload` 객체 끝(`};`)까지를 교체:
```tsx
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
(이후 `if (payload.members.length === 0) …` 등 나머지 submit 본문은 그대로.)

- [ ] **Step 4: 멤버 입력 JSX 교체 (line 75–97 의 `<div className="space-y-3">` … 안내 `<p>` 까지)**

해당 블록 전체를 교체:
```tsx
        <div className="space-y-3">
          {members.map((m) => {
            const st = m.stationId ? findStationById(m.stationId) : null;
            return (
              <div key={m.id} className="grid grid-cols-[1fr_2fr_40px] gap-2 items-start">
                <input placeholder="닉네임" value={m.nickname} className={input}
                  onChange={(e) => setMembers(members.map((x) => x.id === m.id ? { ...x, nickname: e.target.value } : x))} />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setOpenMemberId(m.id)}
                    className={`flex-1 border border-[var(--color-border-strong)] px-3 py-2 text-sm text-left ${st ? "" : "text-[var(--color-text-muted)]"}`}>
                    {st ? (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {stationLabel(st)}
                        {st.lines.map((l) => <LineBadge key={l} line={l} />)}
                      </span>
                    ) : "역 선택"}
                  </button>
                  {st && (
                    <button type="button" aria-label="역 선택 해제" className="px-1.5 py-2 text-[var(--color-text-muted)]"
                      onClick={() => setMembers(members.map((x) => x.id === m.id ? { ...x, stationId: null } : x))}>✕</button>
                  )}
                </div>
                <button type="button" className="text-red-600 py-2"
                  onClick={() => setMembers(members.filter((x) => x.id !== m.id))}>✕</button>
              </div>
            );
          })}
        </div>
        {members.length < 10 && (
          <button type="button" className="mt-2 text-sm border border-[var(--color-border-strong)] px-3 py-1"
            onClick={() => setMembers([...members, { id: nextId.current++, nickname: "", stationId: null }])}>+ 멤버 추가</button>
        )}
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">※ 멤버별로 [역 선택]을 눌러 가까운 지하철 역을 검색·선택하세요(초성 검색 가능). 좌표는 자동으로 채워집니다.</p>
```

- [ ] **Step 5: 공유 시트 마운트 (최상위 컨테이너 닫기 직전)**

`return ( <div className="space-y-8"> … )` 의 **마지막 `</div>` 바로 앞**(결과 렌더 블록 다음)에 공유 시트를 추가:
```tsx
      <StationSearchSheet
        open={openMemberId !== null}
        onClose={() => setOpenMemberId(null)}
        onSelect={(s) => {
          setMembers(members.map((x) => x.id === openMemberId ? { ...x, stationId: s.id } : x));
          setOpenMemberId(null);
        }}
      />
```

- [ ] **Step 6: StationPicker 삭제 + 타입/잔존참조 확인**

```bash
cd <repo>
sudo -u ec2-user git rm src/app/playground/rehearsal-finder/StationPicker.tsx
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rehearsal-finder|StationPicker|reconcileSelection|m\.query" || echo "clean"
grep -rn "StationPicker\|reconcileSelection\|m\.query\|\.query\b" src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx || echo "no stale refs"
```
Expected: `clean` 그리고 `no stale refs`.

- [ ] **Step 7: Commit**

```bash
cd <repo>
sudo -u ec2-user git add src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): member [역 선택] button + shared search sheet, stable id state, deselect; remove StationPicker"
```

---

## Task 5: 빌드 · 스모크 · 회귀 · push

**Files:** (없음 — 검증)

- [ ] **Step 1: 전체 lib 테스트 회귀**

```bash
cd <repo>
for f in geo scoring reason route-provider ranker recommend metroStations chosung; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)";
done
```
Expected: 각 파일 `# fail 0`.

- [ ] **Step 2: 빌드 + 재시작 (DEV)**

```bash
cd <repo>
sudo -u ec2-user pnpm build 2>&1 | grep -E "Compiled|rehearsal-finder|error|Error" | head
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 4
curl -s -o /dev/null -w "rehearsal-finder: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
```
Expected: 컴파일 성공, `rehearsal-finder: 200`.

- [ ] **Step 3: 렌더 스모크 (버튼화 확인)**

```bash
cd <repo>
html=$(curl -s "http://127.0.0.1:3101/playground/rehearsal-finder")
echo "역 선택 버튼: $(echo "$html" | grep -o '역 선택' | wc -l) (멤버 2 → 2 이상)"
echo "옛 호선칩(전체): $(echo "$html" | grep -o '>전체<' | wc -l) (0 이어야)"
echo "옛 datalist: $(echo "$html" | grep -o 'metro-stations' | wc -l) (0)"
echo "닉네임 input: $(echo "$html" | grep -o 'placeholder=\"닉네임\"' | wc -l) (2)"
```
Expected: 역 선택 ≥2, 옛 칩 0, datalist 0, 닉네임 2.

- [ ] **Step 4: e2e 추천 회귀 (역→좌표 payload 형태)**

```bash
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" \
  -H 'Content-Type: application/json' \
  -d '{"headcount":2,"members":[{"nickname":"보컬","originText":"홍대입구","originLat":37.5572,"originLng":126.9254,"originType":"station"},{"nickname":"기타","originText":"강남","originLat":37.497,"originLng":127.0276,"originType":"station"}]}' \
  | head -c 200; echo
```
Expected: `searchId` + `results` 반환(에러 아님).

- [ ] **Step 5: 브라우저 수동 확인 안내**

`https://dev.bandsustain.com/playground/rehearsal-finder` — (1) `[역 선택]` 버튼 클릭 시 모바일=바텀시트/데스크탑=모달, (2) 역명/초성(`ㄱㄴ`) 검색 → 결과 호선 배지, (3) 선택 시 버튼에 역명+배지, (4) `✕ 해제`로 미선택 복귀, (5) 시트 열린 동안 배경 스크롤 잠금, (6) 추천 결과 정상.

- [ ] **Step 6: dev push**

```bash
cd <repo>
sudo -u ec2-user git push origin dev
```

> **⛔ 여기서 멈춤.** dev push 후 사용자에게 `https://dev.bandsustain.com/playground/rehearsal-finder` 확인 요청. main 머지(운영 반영)는 사용자가 명시 요청 시에만.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지:** 초성 헬퍼(T1) · searchStations 초성+시그니처(T2) · 시트/배지(T3) · 버튼·공유시트·안정 id·해제·StationPicker 삭제(T4) · 빌드/스모크/e2e(T5). 스펙 §2~§8 + 리뷰 4건(해제 경로=T4 Step4 `✕ 해제`, 안정 id+openMemberId=T4 Step2/5, body scroll lock=T3 StationSearchSheet useEffect, 시그니처 breaking=T2) 모두 대응.
- **타입 일관성:** `searchStations(query)` 단일 인자(T2 정의 ↔ StationSearchSheet 호출 T3 ↔ 테스트 T2). `MetroStation`·`stationLabel`·`findStationById` 시그니처 동일. StationSearchSheet props(`open/onClose/onSelect`)가 T3 정의 ↔ T4 Step5 호출 일치. `MemberForm {id,nickname,stationId}` T4 전반 일관(자유입력/`query`/`reconcileSelection` 잔존 0 — T4 Step6 grep 가드).
- **상태 안전:** 멤버 안정 `id`(nextId ref) + `openMemberId` 타깃팅으로 인덱스 밀림 오선택 차단. 해제는 행 삭제와 별개(`stationId=null`).
- **알려진 단순화:** 호선 칩/전체 브라우징 제거(검색 대체), 포커스 트랩 최소(Esc/backdrop+자동포커스), 바텀시트 CSS만. React 컴포넌트 단위테스트 도구 없음 → 시트/폼은 e2e+수동 검증(T5), 검색·초성 로직은 순수함수 단위테스트(T1/T2)로 커버.
