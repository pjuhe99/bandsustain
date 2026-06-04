# 합주실 추천 — 출발지 역 선택 개선 (검색 + 호선 필터) Design

> 선행: `2026-06-02-rehearsal-station-input-design.md` (좌표 입력 → 역 datalist 교체). 본 문서는 그 입력 레이어를 **검색 가능 + 호선 필터** 콤보박스로 개선한다.

## 1. 문제 / 목표

현재 출발지 입력은 단일 `<input list="metro-stations">` + 전체 589역 `<datalist>`다. 문제:

- 네이티브 `datalist`는 실질 검색이 약하고(브라우저별 매칭 편차), 모바일에서 긴 평면 목록이라 고르기 어렵다.
- 호선 구분/필터가 없다.
- 현재 번들 데이터에 **호선 정보가 없다**(name/lat/lng만).

**목표:** 멤버가 (1) 역명을 **타이핑해 검색**하고 (2) **호선으로 필터링**해 빠르게 출발지 역을 고를 수 있게 한다. 모바일 사용 비중이 높으므로 터치 친화적이어야 한다.

**비목표(범위 밖):** recommend API/스키마/추천 로직 변경. **입력 레이어와 그것이 의존하는 역 데이터만** 교체한다.

## 2. 데이터 (소스 교체)

### 출처

- **주 소스:** `jhj0517` 공개 gist `korean-subway-station-list.json5` — 역당 1엔트리에 `name / city / areas[] / lines[] / lat / lng`. 전국 874역, **좌표 결측 0 · 범위 이상 0**, 현대 호선명(수인분당선·경의중앙선·GTX-A·김포골드라인·신림선·동해선 등).
  - URL: https://gist.github.com/jhj0517/9bd253175c4410493af024d5e0a1c01f
  - 소스 disclaimer: "직접 수집, 일부 오기/좌표 부정확 가능" → 플레이그라운드 수용 범위(추천은 mock 직선거리 기반이라 정밀 좌표 불요).
- 현재 번들(589역, 호선 없음)과 검토했던 MountainNine CSV(좌표 결측 30)를 **모두 대체**한다.

### 정규화 빌드 스크립트 `scripts/build-metro-stations.ts`

원천(json5) → 정적 JSON. **재현 가능**하도록 스크립트로 커밋하고, 출처 URL·취득일을 스크립트 주석에 명시. (원천 json5는 네트워크에서 받으므로 스크립트에 URL 고정; 빌드 1회 후 산출 JSON을 커밋해 런타임 네트워크 의존 0.)

처리 단계:

1. **json5 파싱** (주석/홑따옴표/trailing comma 정리 후 JSON 파싱).
2. **호선명 정규화:** `경의중앙 → 경의중앙선`, `김포 골드라인 → 김포골드라인`, `신림역(오기) → 신림선`. 각 엔트리 `lines`는 정규화 후 정렬·유니크.
3. **수도권 필터(bbox):** `36.7 < lat < 38.3 && 126.2 < lng < 127.8`. 부산/대구/광주/대전 등 256역 제외 → 618행. (line 화이트리스트 대신 bbox — 견고하고 노선명 변화에 둔감.)
4. **동명이역 병합:** 같은 `name` 그룹에서 좌표 거리 **< 1.5km**면 1역으로 병합(lines 합집합, 좌표 평균, area는 대표 1개). 멀면(예: **양평역** — 5호선 영등포 vs 경의중앙선 양평군, 53km) **별도 유지**. 분석상 18개 동명 중 17개는 병합, 양평역만 분리.
5. **id 부여:** 유니크 `id`(슬러그: 역명 + 필요한 경우 지역구/호선 disambiguator). 병합 후 unique 보장.

**산출 형태:** 약 **601역 · 24호선**. 각 레코드:

```ts
type MetroStation = {
  id: string;        // 유니크 키 (동명이역 구분). 예: "yangpyeong-5" / "yangpyeong-gyeonguijungang"
  name: string;      // "양평" (표시는 name + 동명이역이면 area 보조)
  lines: string[];   // ["5호선"] / ["2호선","경의중앙선"] — 정규화·정렬됨
  lat: number;
  lng: number;
  area: string;      // 지역구 라벨 (동명이역 구분·표시 보조). 예: "영등포구"
};
```

> 검증: 모든 좌표가 한국 범위(33<lat<39, 124<lng<132) 안, `id` 유니크, `lines` 비어있지 않음, 양평역 2엔트리 존재, 호선 24종.

## 3. 데이터 모델 / 로더 (`metroStations.ts` 확장)

기존 로더는 `getStationNames()` / `findStationByName()`(name 키)였다. 동명이역·호선필터를 위해 **id 키**로 전환:

- `getStations(): MetroStation[]`
- `getLines(): string[]` — 정렬된 24호선(노선번호 우선 → 광역노선). 칩/필터용.
- `findStationById(id): MetroStation | null` — 선택값 해석.
- `searchStations(query: string, selectedLines: string[]): MetroStation[]` — **순수 함수**. 역명 매칭(공백 정규화·prefix 우선, 그 외 substring) ∩ 호선 필터(selectedLines 비면 전체, 아니면 `lines`가 하나라도 교집합). 결과는 prefix 매칭 우선 정렬 후 이름순. 상한(예: 50개) 둬서 드롭다운 폭주 방지.

> 추천 payload는 여전히 `originLat/originLng/originText/originType="station"`. 클라이언트가 `findStationById`로 좌표를 채운다. recommend 오케스트레이션/스키마(019)/scoring/ranker/route-cache **무변경**.

## 4. UI — 검색창 + 호선 칩 필터 (`StationPicker` 컴포넌트 분리)

`RehearsalFinderClient.tsx`의 멤버 행 입력을 새 `StationPicker.tsx`로 분리:

- **호선 칩 줄:** `(전체)` + 24호선 칩. 다중 토글(선택된 호선들의 OR 합집합으로 후보 한정). 모바일에서 wrap. 칩은 **공식 노선색** 적용.
- **검색 입력 + 드롭다운:** 타이핑하면 `searchStations(query, selectedLines)`로 실시간 후보. 각 후보 = 역명 + 호선 배지(노선색) + 동명이역이면 area. 키보드 ↑↓/Enter 선택, Esc·외부 클릭 닫기.
- **선택 상태:** 선택 시 멤버 state에 `stationId` 저장, 입력란에 역명 표시. 미선택/무효 id면 submit 시 에러(`목록에서 역을 선택하세요`).
- 네이티브 `datalist` 제거.

**호선색 상수** `metroLineColors.ts`(또는 데이터 모듈 내 맵): 호선명 → hex. 칩·배지 공통 사용. 미정의 호선은 중립 회색 fallback.

**접근성/모바일:** 입력 `inputMode=text`, 큰 탭 타겟, 드롭다운 스크롤. `aria` role(combobox/listbox/option) 기본 적용.

## 5. 변경 / 무변경 범위

**변경·추가:**
- `scripts/build-metro-stations.ts` (신규, 원천→정규화)
- `src/lib/playground/rehearsal/data/metro-stations.json` (재생성: name/lat/lng → id/name/lines/lat/lng/area)
- `src/lib/playground/rehearsal/metroStations.ts` (id 키 로더 + `getLines`/`searchStations`)
- `src/lib/playground/rehearsal/metroLineColors.ts` (신규, 노선색)
- `src/app/playground/rehearsal-finder/StationPicker.tsx` (신규)
- `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` (StationPicker 연결, datalist 제거, 멤버 state name→stationId)

**무변경:** recommend API(`recommend/route.ts`, `studios/route.ts`) · 스키마 019 · scoring · ranker · reason · route-provider · route-cache · recommend 오케스트레이션 · admin CRUD · dev 게이트.

## 6. 테스트

- **데이터 무결성** (`metroStations.test.ts` 갱신): 좌표 범위, `id` 유니크, `lines` 비어있지 않음·정규화된 호선만, 양평역 2엔트리, `getLines()` 24종.
- **`searchStations` 단위테스트:** 한글 prefix 매칭, substring fallback, 호선필터 교집합, 빈 selectedLines=전체, 결과 상한, prefix 우선 정렬.
- **빌드 스모크(DEV):** `pnpm build` → `pm2 restart bandsustain-dev` → 라우트 200 → 콤보박스/호선 칩 노출 → 검색·필터 동작 → end-to-end 추천(역 선택 → 좌표 payload → 결과) 회귀.

## 7. 단순화 / 알려진 한계

- 호선 칩 24개는 모바일에서 다소 많다 → 기본 전부 wrap 노출. 그룹핑/접기는 후속(YAGNI).
- 좌표 정밀도는 소스 의존(일부 부정확 가능) — mock 직선거리 추천이라 영향 미미, disclaimer 유지.
- 동명이역은 양평역만 분리. 추가 동명이역 발생 시 build 스크립트의 1.5km 임계로 자동 처리.
- 원천이 전국 데이터 → bbox로 수도권만. GTX-A(3역)·신림선·김포골드라인 포함, 부산/대구/광주/대전 제외.

## 작업 규칙 (MEMORY bandsustain 섹션)

`bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/build는 `sudo -u ec2-user`. dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크)는 `git add .` 금지(파일 명시 커밋). DB 변경 없음(데이터는 정적 JSON 번들).
