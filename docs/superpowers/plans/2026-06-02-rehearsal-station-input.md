# 합주실 추천 — 출발지 "지하철 역 선택" 입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 합주실 추천(`/playground/rehearsal-finder`)의 멤버 출발지 입력을 위/경도 직접 입력에서 **지하철 역 선택**으로 바꾼다 — 역을 고르면 좌표가 자동으로 채워진다.

**Architecture:** 수도권 전철역 좌표를 정적 JSON으로 번들(런타임 외부 API 없음)하고, 작은 로더/헬퍼(`metroStations.ts`)로 노출한다. 클라이언트 폼은 좌표 입력을 `<datalist>` 역 검색으로 교체하고, 선택된 역명을 `findStationByName`으로 좌표로 해석해 기존 recommend API(`originType:"station"` + 좌표)에 그대로 보낸다. **백엔드/스키마/추천 로직은 변경 없음.**

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind v4 · node:test(`npx tsx --test`). 추가 라이브러리 없음.

**작업 규칙 (MEMORY bandsustain):** `bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/build 는 `sudo -u ec2-user`. dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크)는 절대 `git add .` 금지(파일 명시 커밋). root 로 만든 파일은 커밋 전 `chown ec2-user:ec2-user`.

**테스트 실행:** `npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts`.

**전제 (이미 확보된 산출물):** 데이터 파일 `src/lib/playground/rehearsal/data/metro-stations.json` 은 **이미 생성되어 working tree 에 존재**한다 — 공개 데이터([gaussian37 수도권 지하철 좌표 JSONDict](https://gaussian37.github.io/python-etc-%EC%88%98%EB%8F%84%EA%B6%8C-%EC%A7%80%ED%95%98%EC%B2%A0/), 카카오 로컬 API 기반)에서 controller 가 HTML 태그 제거→정규화로 추출, 589개 역, 전부 한국 좌표 범위 내, 역명 유니크, 샘플 검증 완료(강남 37.497175,127.027926 등). 형태: `[{"name":string,"lat":number,"lng":number}, ...]` (역명 오름차순). T1 은 이 파일을 입력으로 받아 테스트+커밋한다.

---

## File Structure

| 파일 | 책임 |
|------|------|
| `src/lib/playground/rehearsal/data/metro-stations.json` | 수도권 역명+좌표 정적 데이터 (이미 생성됨, 589역) |
| `src/lib/playground/rehearsal/metroStations.ts` | 타입 `MetroStation` + `METRO_STATIONS`/`getStationNames`/`findStationByName` |
| `src/lib/playground/rehearsal/metroStations.test.ts` | 데이터 무결성(좌표 범위/유니크/개수) + 해석 헬퍼 테스트 |
| `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` | 좌표 입력 → 역 datalist 검색으로 교체 (수정) |

---

## Task 1: 역 데이터 로더 + 무결성 테스트

**Files:**
- Confirm exists: `src/lib/playground/rehearsal/data/metro-stations.json` (이미 생성됨)
- Create: `src/lib/playground/rehearsal/metroStations.ts`
- Create: `src/lib/playground/rehearsal/metroStations.test.ts`

- [ ] **Step 1: 데이터 파일 존재/형태 확인**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user node -e "const a=require('./src/lib/playground/rehearsal/data/metro-stations.json'); console.log('count', a.length, 'sample', JSON.stringify(a.find(s=>s.name==='강남')));"
```
Expected: `count 589 sample {"name":"강남","lat":37.497175,"lng":127.027926}`.
파일이 없거나 형태가 다르면 STOP 하고 BLOCKED 보고(controller 가 재생성).

- [ ] **Step 2: `tsconfig.json` 에 `resolveJsonModule` 확인**

```bash
sudo -u ec2-user node -e "const t=require('./tsconfig.json'); console.log('resolveJsonModule:', t.compilerOptions && t.compilerOptions.resolveJsonModule)"
```
Expected: `resolveJsonModule: true`. (Next.js 기본값.) 만약 `undefined`/`false` 면 `compilerOptions.resolveJsonModule = true` 를 추가하고, 그 변경도 커밋에 포함.

- [ ] **Step 3: 실패 테스트 작성 `src/lib/playground/rehearsal/metroStations.test.ts`**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { METRO_STATIONS, getStationNames, findStationByName } from "./metroStations";

test("데이터 로드: 역이 충분히 많다 (>400)", () => {
  assert.ok(METRO_STATIONS.length > 400, `got ${METRO_STATIONS.length}`);
});

test("모든 좌표가 한국 범위(위도 33~39, 경도 124~132) 안", () => {
  for (const s of METRO_STATIONS) {
    assert.ok(s.lat >= 33 && s.lat <= 39, `${s.name} lat ${s.lat}`);
    assert.ok(s.lng >= 124 && s.lng <= 132, `${s.name} lng ${s.lng}`);
  }
});

test("역명 유니크", () => {
  const names = getStationNames();
  assert.equal(new Set(names).size, names.length);
});

test("findStationByName: 정확 매칭은 좌표 반환", () => {
  const s = findStationByName("강남");
  assert.ok(s, "강남 should exist");
  assert.equal(s!.lat, 37.497175);
  assert.equal(s!.lng, 127.027926);
});

test("findStationByName: 앞뒤 공백 트림", () => {
  assert.ok(findStationByName(" 홍대입구 "), "trim should match 홍대입구");
});

test("findStationByName: 없는 역은 null", () => {
  assert.equal(findStationByName("없는역12345"), null);
});
```

- [ ] **Step 4: 실패 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts
```
Expected: FAIL — `Cannot find module './metroStations'`.

- [ ] **Step 5: 구현 `src/lib/playground/rehearsal/metroStations.ts`**

```typescript
import stationsData from "./data/metro-stations.json";

export type MetroStation = { name: string; lat: number; lng: number };

export const METRO_STATIONS: MetroStation[] = stationsData as MetroStation[];

const byName = new Map<string, MetroStation>(
  METRO_STATIONS.map((s) => [s.name, s]),
);

export function getStationNames(): string[] {
  return METRO_STATIONS.map((s) => s.name);
}

export function findStationByName(name: string): MetroStation | null {
  return byName.get(name.trim()) ?? null;
}
```

- [ ] **Step 6: 통과 확인**

```bash
sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/metroStations.test.ts
```
Expected: PASS (6 tests, `# fail 0`).

- [ ] **Step 7: 타입 확인**

```bash
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "metroStations|metro-stations" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 8: Commit**

```bash
sudo -u ec2-user git add src/lib/playground/rehearsal/data/metro-stations.json src/lib/playground/rehearsal/metroStations.ts src/lib/playground/rehearsal/metroStations.test.ts docs/superpowers/specs/2026-06-02-rehearsal-station-input-design.md docs/superpowers/plans/2026-06-02-rehearsal-station-input.md
# tsconfig.json 을 Step 2 에서 수정했다면 같이 add
sudo -u ec2-user git commit -m "feat(rehearsal): bundle metro station coords + loader"
```
**`git add .` 금지** (untracked `public/playground/images` 심볼릭 링크 staging 금지). 명시한 파일만.

---

## Task 2: 출발지 입력을 역 선택(datalist)으로 교체

**Files:**
- Modify: `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx`

> 현재 멤버 행은 `닉네임 / 출발지(메모) / 위도 / 경도` 4개 입력이다. 이를 `닉네임 / 역 검색(datalist)` 2개로 바꾸고, 선택된 역명을 좌표로 해석해 전송한다. 아래는 **정확한 old→new 치환**이다.

- [ ] **Step 1: import + MemberForm 타입 교체**

치환 — old:
```typescript
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";

type Region = { id: number; displayName: string };
type EquipOption = { value: string; label: string };
type MemberForm = { nickname: string; originText: string; originLat: string; originLng: string };
```
new:
```typescript
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import { getStationNames, findStationByName } from "@/lib/playground/rehearsal/metroStations";

type Region = { id: number; displayName: string };
type EquipOption = { value: string; label: string };
type MemberForm = { nickname: string; station: string };

const STATION_NAMES = getStationNames();
```

- [ ] **Step 2: 초기 멤버 state 교체**

치환 — old:
```typescript
  const [members, setMembers] = useState<MemberForm[]>([
    { nickname: "", originText: "", originLat: "", originLng: "" },
    { nickname: "", originText: "", originLat: "", originLng: "" },
  ]);
```
new:
```typescript
  const [members, setMembers] = useState<MemberForm[]>([
    { nickname: "", station: "" },
    { nickname: "", station: "" },
  ]);
```

- [ ] **Step 3: submit 의 멤버 매핑 + 검증 교체**

치환 — old (the whole `const payload = {...}` block through the empty-members check):
```typescript
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
```
new:
```typescript
      const typedButUnknown = members.filter(
        (m) => m.station.trim() && !findStationByName(m.station),
      );
      if (typedButUnknown.length > 0) {
        setError(`목록에 없는 역입니다: ${typedButUnknown.map((m) => m.station).join(", ")} — 목록에서 역을 선택하세요.`);
        return;
      }
      const payload = {
        transportMode,
        maxBudgetPerHour: maxBudget ? Number(maxBudget) : null,
        requiredEquipment,
        preferredRegionIds,
        members: members
          .map((m) => ({ m, st: findStationByName(m.station) }))
          .filter((x) => x.m.nickname.trim() && x.st)
          .map(({ m, st }) => ({
            nickname: m.nickname,
            originText: st!.name,
            originLat: st!.lat,
            originLng: st!.lng,
            originType: "station",
            transportMode,
          })),
      };
      if (payload.members.length === 0) { setError("닉네임과 역이 채워진 멤버가 최소 1명 필요합니다."); return; }
```

- [ ] **Step 4: 멤버 입력 행 JSX 교체 (좌표 2칸 → 역 검색 1칸 + datalist)**

치환 — old (the entire `{/* 멤버 입력 */}` block, from `<div>` after the comment through its closing `</div>` that ends with the `※ 현재는 좌표...` `<p>`):
```tsx
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
```
new:
```tsx
      {/* 멤버 입력 */}
      <div>
        <h2 className="font-display font-bold text-xl mb-3">멤버 출발지 (최대 10명)</h2>
        <datalist id="metro-stations">
          {STATION_NAMES.map((n) => <option key={n} value={n} />)}
        </datalist>
        <div className="space-y-2">
          {members.map((m, i) => {
            const unknown = m.station.trim().length > 0 && !findStationByName(m.station);
            return (
              <div key={i} className="grid grid-cols-[1fr_1.6fr_40px] gap-2 items-start">
                <input placeholder="닉네임" value={m.nickname} className={input}
                  onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, nickname: e.target.value } : x))} />
                <div>
                  <input list="metro-stations" placeholder="가까운 지하철 역" value={m.station}
                    className={`${input} w-full ${unknown ? "border-red-500" : ""}`}
                    onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, station: e.target.value } : x))} />
                  {unknown && <p className="mt-1 text-xs text-red-600">목록에서 역을 선택하세요</p>}
                </div>
                <button type="button" className="text-red-600 py-2"
                  onClick={() => setMembers(members.filter((_, j) => j !== i))}>✕</button>
              </div>
            );
          })}
        </div>
        {members.length < 10 && (
          <button type="button" className="mt-2 text-sm border border-[var(--color-border-strong)] px-3 py-1"
            onClick={() => setMembers([...members, { nickname: "", station: "" }])}>+ 멤버 추가</button>
        )}
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">※ 멤버별로 가까운 지하철 역을 입력해 목록에서 선택하세요. 좌표는 자동으로 채워집니다.</p>
      </div>
```

- [ ] **Step 5: 타입 확인**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "RehearsalFinderClient" || echo "clean"
```
Expected: `clean`. (특히 옛 `originText/originLat/originLng` 잔여 참조가 없어야 함 — 있으면 제거.)

- [ ] **Step 6: 빌드 + 재시작 (DEV)**

```bash
sudo -u ec2-user pnpm build 2>&1 | tail -6
sudo -u ec2-user pm2 restart ecosystem.config.js --update-env
sleep 4
```
빌드 성공해야 함. 실패 시 본인 변경에서 고치고, 아니면 BLOCKED 보고.

- [ ] **Step 7: 페이지 스모크 + datalist 노출 확인**

```bash
curl -s -o /dev/null -w "finder: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
echo "=== datalist + 역 옵션 노출 확인 ==="
curl -s "http://127.0.0.1:3101/playground/rehearsal-finder" | grep -c 'id="metro-stations"'
curl -s "http://127.0.0.1:3101/playground/rehearsal-finder" | grep -oE '<option value="강남"' | head -1
```
Expected: `finder: 200`, datalist 1개, `<option value="강남"` 노출(역 옵션이 SSR 됨).

- [ ] **Step 8: 추천 end-to-end (역명 기반 payload — 클라이언트가 보낼 형태와 동일하게 직접 검증)**

```bash
# 클라이언트는 역명을 좌표로 변환해 originType:"station" 으로 보냄. 변환 결과(홍대입구/강남 좌표)로 직접 호출.
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" \
  -H 'content-type: application/json' \
  -d '{"transportMode":"transit","members":[{"nickname":"가","originText":"홍대입구","originLat":37.557192,"originLng":126.925381,"originType":"station","transportMode":"transit"},{"nickname":"나","originText":"강남","originLat":37.497175,"originLng":127.027926,"originType":"station","transportMode":"transit"}]}' \
  | head -c 300; echo
```
Expected: `{"searchId":N,"results":[{"rankNo":1,...}]}` (정상 추천). 브라우저(`https://dev.bandsustain.com/playground/rehearsal-finder`)에서 역 2개 선택→추천 동작도 확인.

- [ ] **Step 9: 전체 lib 테스트 회귀**

```bash
for f in geo scoring reason route-provider ranker recommend metroStations; do
  echo "== $f =="; sudo -u ec2-user npx tsx --test src/lib/playground/rehearsal/$f.test.ts 2>&1 | grep -E "# (pass|fail)";
done
```
Expected: 각 파일 `# fail 0`.

- [ ] **Step 10: Commit**

```bash
sudo -u ec2-user git add src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): station-select input (datalist) replacing raw coords"
```

> **⛔ dev push 는 controller(최종 리뷰 후)가 수행.** 이 태스크는 로컬 커밋까지만.

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** 데이터 정적 번들+로더(T1) · 무결성 테스트 좌표범위/유니크/해석(T1) · 좌표입력→역 datalist 교체(T2) · originType="station" 전송(T2 Step3) · 백엔드 무변경(확인: API/스키마 손대는 태스크 없음) · 데이터 모델 `{name,lat,lng}`(spec 의 `lines` 는 소스 부재+동명이역 자동해소로 드롭, spec §4 단순화 반영).
- **플레이스홀더:** 없음. 모든 코드/명령/기대출력 명시. 데이터 파일은 실제 생성된 산출물.
- **타입 일관성:** `MetroStation{name,lat,lng}`, `findStationByName`/`getStationNames`/`METRO_STATIONS`, `MemberForm{nickname,station}` 가 T1↔T2 에서 일치. 전송 payload 필드(originText/originLat/originLng/originType/transportMode)는 기존 recommend `MemberSchema` 와 일치(역명→좌표 변환만 신규).
- **알려진 단순화:** 좌표 1개/역명(환승역 대표 좌표, 동명이역은 소스가 이미 단일 엔트리). `lines` 미수록. 데이터는 gaussian37 시점 기준(최신 신설역 일부 누락 가능). datalist 자유입력이라 정확매칭 실패 시 그 멤버 제외 + 빨간 힌트.
