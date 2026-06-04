# 합주실 데이터(방 단위) — Phase 3: 카드 개선 + 상세 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
>
> 설계 `docs/superpowers/specs/2026-06-04-rehearsal-studios-rooms-detail-design.md` §5·§6. Phase 1·2 완료(데이터·백엔드). 이 단계로 기능 완성.

**Goal:** 추천 결과 카드를 스캔 가능하게(이동시간·가격대·방수·주차·장비타입 칩, reason 차분하게) 바꾸고, `자세히 보기` 모달로 주소·예약·방·장비를 보여준다.

**Architecture:** Phase 2가 recommend 응답에 실어준 `studio.rooms`·`roadAddress`·`equipmentTypes`·`bookingMethod`·`homepageUrl` 등을 카드+신규 `StudioDetailModal`(StationSearchSheet의 반응형 모달/바텀시트·스크롤락 패턴 재사용)로 렌더. 백엔드/추천 무변경.

**Tech Stack:** Next.js 16 · React(client) · TypeScript · Tailwind v4.

**작업 규칙(MEMORY bandsustain):** `bandsustain-dev`(dev, 포트 3101)에서만. 모든 git/build 는 `sudo -u ec2-user`. DB 변경 없음. 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지. **저장소 루트(`<repo>`):** `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`.

**참고 타입(Phase 2):** `types.ts` 에 `ROOM_EQUIPMENT_TYPES`(["DRUM","GUITAR_AMP","BASS_AMP","KEYBOARD","ETC"]) · `ROOM_EQUIPMENT_LABELS`(한글) · `RoomEquipmentType`. recommend 응답 `studio` 에 `roadAddress, bookingMethod, amenities, homepageUrl, mapUrl, hourlyPriceMin/Max, hasParking, equipmentTypes: RoomEquipmentType[], rooms: {id,name,hourlyPrice,capacity,equipment:{name,type}[],review}[]`.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/app/playground/rehearsal-finder/StudioDetailModal.tsx` | 합주실 상세 모달(주소·예약·방·장비) | Create |
| `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` | 결과 카드 개선 + 모달 연결 + ResultItem 타입 확장 | Modify |

---

## Task 1: 상세 모달 (`StudioDetailModal.tsx`)

**Files:** Create `<repo>/src/app/playground/rehearsal-finder/StudioDetailModal.tsx`

- [ ] **Step 1: 작성** — EXACTLY:
```tsx
"use client";
import { useEffect } from "react";
import { ROOM_EQUIPMENT_TYPES, ROOM_EQUIPMENT_LABELS, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";

type Gear = { name: string; type: string };
type DetailRoom = { id: number; name: string; hourlyPrice: number | null; capacity: number | null; equipment: Gear[]; review: string | null };
export type DetailStudio = {
  name: string; regionName: string | null; areaLabel: string | null; roadAddress: string | null;
  bookingMethod: string | null; amenities: string | null; homepageUrl: string | null; mapUrl: string | null;
  rooms: DetailRoom[];
};

export default function StudioDetailModal({ studio, onClose }: { studio: DetailStudio | null; onClose: () => void }) {
  useEffect(() => {
    if (!studio) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [studio, onClose]);

  if (!studio) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-h-[88vh] flex-col rounded-t-2xl bg-[var(--color-bg)] shadow-xl sm:max-w-lg sm:max-h-[80vh] sm:rounded-lg">
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="font-display font-bold text-lg">{studio.name}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{studio.regionName ?? studio.areaLabel ?? ""}</p>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} className="px-2 text-lg leading-none text-[var(--color-text-muted)]">✕</button>
        </div>
        <div className="space-y-5 overflow-auto px-5 py-4">
          <div className="space-y-1 text-sm">
            {studio.roadAddress && <p>📍 {studio.roadAddress}</p>}
            {studio.bookingMethod && <p className="text-[var(--color-text-muted)]">예약 방식: {studio.bookingMethod}</p>}
            {studio.amenities && <p className="text-[var(--color-text-muted)]">{studio.amenities}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              {studio.mapUrl && <a href={studio.mapUrl} target="_blank" rel="noreferrer" className="underline">네이버 지도</a>}
              {studio.homepageUrl && <a href={studio.homepageUrl} target="_blank" rel="noreferrer" className="underline">홈페이지·예약</a>}
            </div>
          </div>
          <div className="space-y-3">
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
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 컴파일**
```bash
cd <repo>
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep "StudioDetailModal" || echo "StudioDetailModal clean"
```
Expected: `StudioDetailModal clean`.

- [ ] **Step 3: 소유권 보정 + Commit**
```bash
cd <repo>
chown ec2-user:ec2-user src/app/playground/rehearsal-finder/StudioDetailModal.tsx
sudo -u ec2-user git add src/app/playground/rehearsal-finder/StudioDetailModal.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): StudioDetailModal (address/booking/rooms/equipment-by-type)"
```

---

## Task 2: 결과 카드 개선 + 모달 연결 (`RehearsalFinderClient.tsx`)

**Files:** Modify `<repo>/src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx`

> **FIRST 파일 읽기.** 현재: import 에 `EQUIPMENT_LABELS`(from types) 있음. `ResultItem.studio` 에 `equipment: { equipmentType: string }[]` 있음. 결과 카드가 `reason`(accent 파랑), 이동/가격 한 줄, `studio.equipment` 배지, memberRoutes, 지도/예약 링크를 렌더. `StationSearchSheet` import 존재, `useState` 존재.

- [ ] **Step 1: import 교체** — `import { EQUIPMENT_LABELS } from "@/lib/playground/rehearsal/types";` 를 다음으로 교체(없으면 추가):
```tsx
import { ROOM_EQUIPMENT_LABELS, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";
import StudioDetailModal from "./StudioDetailModal";
```
(`findStationById, stationLabel`·`StationSearchSheet`·`LineBadge`·`buttonClasses` import 는 유지.)

- [ ] **Step 2: `ResultItem` 타입 교체** — 현재 `type ResultItem = { … }` 전체를 교체:
```tsx
type ResultGear = { name: string; type: string };
type ResultRoom = { id: number; name: string; hourlyPrice: number | null; capacity: number | null; equipment: ResultGear[]; review: string | null };
type ResultStudio = {
  name: string; regionName: string | null; areaLabel: string | null; roadAddress: string | null;
  bookingMethod: string | null; amenities: string | null; homepageUrl: string | null; mapUrl: string | null;
  hourlyPriceMin: number | null; hourlyPriceMax: number | null; hasParking: boolean;
  equipmentTypes: RoomEquipmentType[]; rooms: ResultRoom[];
};
type ResultItem = {
  rankNo: number;
  studio: ResultStudio;
  avgMinutes: number; maxMinutes: number; reason: string;
  memberRoutes: { nickname: string; route: { travelMinutes: number } }[];
};
```

- [ ] **Step 3: 상세 모달 state 추가** — `const [results, setResults] = useState<ResultItem[] | null>(null);` 줄 **다음**에:
```tsx
  const [detailStudio, setDetailStudio] = useState<ResultStudio | null>(null);
```

- [ ] **Step 4: 결과 카드 JSX 교체** — 현재 `{results.map((r) => ( <div key={r.rankNo} … > … </div> ))}` 카드 한 장 전체(`<div key={r.rankNo} className="border border-[var(--color-border)] p-5">` 부터 그 닫는 `</div>` 까지)를 교체:
```tsx
          {results.map((r) => {
            const priceMin = r.studio.hourlyPriceMin;
            const priceMax = r.studio.hourlyPriceMax;
            const priceLabel = priceMin
              ? (priceMax && priceMax !== priceMin
                  ? `${priceMin.toLocaleString("ko-KR")}~${priceMax.toLocaleString("ko-KR")}원`
                  : `${priceMin.toLocaleString("ko-KR")}원~`)
              : null;
            return (
              <div key={r.rankNo} className="border border-[var(--color-border)] p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display font-bold text-lg">{r.rankNo}. {r.studio.name}</h3>
                  <span className="shrink-0 text-sm text-[var(--color-text-muted)]">{r.studio.regionName ?? r.studio.areaLabel ?? ""}</span>
                </div>
                {r.reason && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{r.reason}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span>⏱ 평균 {Math.round(r.avgMinutes)}분 · 최대 {Math.round(r.maxMinutes)}분</span>
                  {priceLabel && <span>💸 {priceLabel}</span>}
                  <span>🚪 방 {r.studio.rooms.length}</span>
                  {r.studio.hasParking && <span>🅿 주차</span>}
                </div>
                {r.studio.equipmentTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.studio.equipmentTypes.map((t) => (
                      <span key={t} className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 text-[11px]">{ROOM_EQUIPMENT_LABELS[t]}</span>
                    ))}
                  </div>
                )}
                <ul className="mt-2 flex flex-wrap gap-x-4 text-xs text-[var(--color-text-muted)]">
                  {r.memberRoutes.map((mr, i) => <li key={i}>{mr.nickname}: {mr.route.travelMinutes}분</li>)}
                </ul>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => setDetailStudio(r.studio)}
                    className={buttonClasses("secondary", "px-4 py-2 text-xs")}>자세히 보기</button>
                  {r.studio.mapUrl && <a href={r.studio.mapUrl} target="_blank" rel="noreferrer" className="underline">지도</a>}
                </div>
              </div>
            );
          })}
```

- [ ] **Step 5: 상세 모달 마운트** — 파일 하단의 `<StationSearchSheet … />` 바로 **다음**(최상위 div 닫기 전)에:
```tsx
      <StudioDetailModal studio={detailStudio} onClose={() => setDetailStudio(null)} />
```

- [ ] **Step 6: 잔존 참조 정리 확인** — 옛 `EQUIPMENT_LABELS`·`studio.equipment` 참조가 남으면 안 됨:
```bash
cd <repo>
grep -n "EQUIPMENT_LABELS\b\|studio.equipment\|\.equipment\b" src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx || echo "no stale refs"
sudo -u ec2-user npx tsc --noEmit -p tsconfig.json 2>&1 | grep "rehearsal-finder" || echo "tsc clean"
```
Expected: `no stale refs` (ROOM_EQUIPMENT_LABELS 는 grep `EQUIPMENT_LABELS\b` 에 안 걸리도록 `\b` 경계로 검사 — 만약 `ROOM_EQUIPMENT_LABELS` 가 잡히면 그건 정상, 옛 `EQUIPMENT_LABELS`(ROOM_ 없는) 만 0이어야), `tsc clean`.

- [ ] **Step 7: Commit**
```bash
cd <repo>
sudo -u ec2-user git add src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx
sudo -u ec2-user git commit -m "feat(rehearsal): scannable result cards (metrics/type chips/muted reason) + detail modal wiring"
```

---

## Task 3: 빌드 · 스모크 · push

- [ ] **Step 1: 빌드 + 재시작 + 라우트**
```bash
cd <repo>
sudo -u ec2-user pnpm build 2>&1 | grep -E "Compiled|error|Error|Failed" | head
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 4
curl -s -o /dev/null -w "route: %{http_code}\n" "http://127.0.0.1:3101/playground/rehearsal-finder"
```
Expected: 컴파일 성공, route 200.

- [ ] **Step 2: end-to-end 추천 + 카드 필드 확인(SSR 후 클라 렌더라 응답으로 확인)**
```bash
curl -s -X POST "http://127.0.0.1:3101/api/playground/rehearsal/recommend" \
  -H 'Content-Type: application/json' \
  -d '{"members":[{"nickname":"A","originText":"사당","originLat":37.4765,"originLng":126.9816,"originType":"station"}]}' \
  | sudo -u ec2-user node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const st=JSON.parse(s).results[0].studio;console.log("자세히보기 데이터: 방",st.rooms.length,"| 타입칩",JSON.stringify(st.equipmentTypes),"| 주소",!!st.roadAddress,"| 예약",st.bookingMethod);});'
```
Expected: 방>0, 타입칩 배열, 주소 true, 예약 채워짐(카드/모달이 그릴 데이터 존재).

- [ ] **Step 3: 브라우저 수동 확인 안내**

`https://dev.bandsustain.com/playground/rehearsal-finder` — 멤버 역 선택 → 추천 → (1) 카드에 ⏱이동시간·💸가격대·🚪방수·🅿주차 + 장비타입 칩, reason 차분(파랑 아님), (2) `자세히 보기` → 모바일 바텀시트/데스크탑 모달: 주소·네이버지도·예약방식·편의·홈페이지 링크 + 방 목록(방별 가격·인원·**타입별 장비**·후기), (3) 배경 스크롤 잠금·Esc·backdrop 닫기.

- [ ] **Step 4: dev push**
```bash
cd <repo>
sudo -u ec2-user git push origin dev
```
> **⛔ 여기서 멈춤.** 3단계 전부 완료 → 사용자에게 `https://dev.bandsustain.com/playground/rehearsal-finder` 확인 요청. 운영 반영(main 머지 + PROD DB 에 020 마이그 + 임포트)은 사용자 명시 요청 시에만.

---

## Self-Review (작성자 점검)

- **스펙 커버리지(§5·§6):** 카드 스캔화(reason muted·이동/가격/방수/주차 메트릭·타입칩·자세히보기)=T2 · 상세 모달(주소·네이버지도·예약방식·편의·홈피·방별 타입장비·후기)=T1 · 빌드/스모크=T3.
- **타입 일관성:** `ResultStudio`(T2) ⊇ `DetailStudio`(T1) 필드 → `setDetailStudio(r.studio)` 전달 가능(구조적 호환). `ROOM_EQUIPMENT_LABELS`/`RoomEquipmentType`(types) ↔ 칩(T2)·모달 그룹(T1). `studio.rooms`/`equipmentTypes`(Phase2 응답) ↔ 카드/모달 사용.
- **무변경:** 추천/백엔드/응답(Phase2) 그대로. 멤버 입력(에디토리얼 카드)·역 시트 무변경.
- **알려진 단순화:** reason 텍스트 자체는 유지(스타일만 차분). 모달 포커스트랩 최소(Esc/backdrop/스크롤락). 가격 정렬 토글 등 후속.
