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

**두 공개 소스를 결합한다 — 좌표는 한쪽, 호선 멤버십은 합집합.** 단일 소스로는 둘 다 부족했다(실측):

- **소스 A (좌표 기준) — `jhj0517` gist `korean-subway-station-list.json5`**: 역당 1엔트리 `name / city / areas[] / lines[] / lat / lng`. 전국 874역, **좌표 결측 0 · 범위 이상 0**, 현대 호선명(수인분당선·경의중앙선·GTX-A·김포골드라인·신림선).
  - URL: https://gist.github.com/jhj0517/9bd253175c4410493af024d5e0a1c01f
  - **한계(실측):** 주요 환승역의 **호선 멤버십이 절반가량 누락**. 강남=`["2호선"]`(신분당선 빠짐), 서울=경의중앙선·GTX 빠짐, 왕십리·공덕=경의중앙선 빠짐, 양재=3호선 빠짐, **사당역은 아예 없음**. 호선 필터가 이 기능의 핵심이라 단독 사용 불가.
- **소스 B (호선 보강) — `MountainNine/seoul-metro-map` `station_coordinate.csv`**: `(line, name, lat, lng)` 행 단위. 환승역 호선 멤버십이 정확(강남=2호선+신분당선, 사당=2·4호선 등). 한계: 표기가 옛 방식(`02호선`/`경의선`/`분당선`/`수인선`/`인천선`)이고 좌표 30역 결측·일부 좌표 오류(예: 경기광주 55km 오차), GTX 없음.
- 현재 번들(589역, 호선 없음)을 **대체**한다.

**소스 disclaimer:** 두 소스 모두 "직접 수집·일부 부정확 가능" — 플레이그라운드 수용 범위(추천은 mock 직선거리 기반이라 정밀 좌표 불요).

### 정규화 빌드 스크립트 `scripts/build-metro-stations.ts`

두 원천(json5 + csv) → 정적 JSON. **재현 가능**하도록 스크립트로 커밋하고, 출처 URL(불변 commit SHA)·취득일을 스크립트 주석에 명시. (원천은 네트워크에서 받으므로 URL 고정; 빌드 1회 후 산출 JSON을 커밋해 런타임 네트워크 의존 0.)

처리 단계:

1. **파싱** — A(json5)는 **반드시 정식 JSON5 파서 사용**(`json5` devDependency, `JSON5.parse()`). 정규식 치환 금지(문자열 내부 따옴표·주석 유사 토큰에서 조용히 깨짐). B(csv)는 단순 콤마 split(BOM 제거). 파싱 실패 시 빌드 실패(silent 금지).
2. **호선명 정규화:**
   - A: `경의중앙 → 경의중앙선`, `김포 골드라인 → 김포골드라인`, `신림역(오기) → 신림선`.
   - B: `0N호선 → N호선`(앞자리 0 제거), `경의선 → 경의중앙선`, `분당선·수인선 → 수인분당선`, `인천선 → 인천1호선`, `김포도시철도 → 김포골드라인`, `용인경전철 → 에버라인`, `의정부경전철 → 의정부선`, `우이신설경전철 → 우이신설선`.
   - 정규화 결과는 24개 정식 호선명 집합에 수렴(스트레이 호선 leak 시 호선수 검증으로 드러남).
3. **수도권 필터(bbox):** `36.7 < lat < 38.3 && 126.2 < lng < 127.8` (양쪽 소스 공통).
4. **좌표 기준 base = A.** A를 같은 `name` 그룹 내 **< 1.5km** 군집으로 병합(lines 합집합, 좌표=러닝 centroid 평균, area는 비어있지 않은 첫 값). 멀면(예: **양평** — 5호선 영등포 vs 경의중앙선 양평군, 53km) **별도 유지**.
5. **B로 호선만 보강 (B 좌표는 신뢰하지 않음):** B의 각 행을 **역명으로 A base에 매칭**해 그 역 `lines`에 추가. 동명이 여러 곳(양평)이면 B행 좌표로 **가장 가까운** base에 배정. A에 그 역명이 **전혀 없으면**(예: 사당) "B-only" 버킷에 모아 자기들끼리 < 1.5km 군집으로 신규 추가(area=""). → B의 잘못된 좌표(경기광주 55km 오차)가 **거짓 동명이역을 만들지 않음**(이름 매칭이라 기존 역에 호선만 더함).
6. **id/ambiguous:** 최종 name 카운트로 `ambiguous`(동명 2곳 이상) 계산, `id` = 일반역 `name` / 동명이역 `name#area`. unique 보장(가드).

**산출 형태:** 약 **657역 · 24호선**(실측). 각 레코드:

```ts
type MetroStation = {
  id: string;            // 유니크 키 (동명이역 구분). 예: "yangpyeong-5" / "yangpyeong-gyeonguijungang"
  name: string;          // "양평" — 검색/매칭 대상
  lines: string[];       // ["5호선"] / ["2호선","경의중앙선"] — 정규화·정렬됨
  lat: number;
  lng: number;
  area: string;          // 지역구. 예: "영등포구"
  ambiguous: boolean;    // 같은 name 이 2곳 이상이면 true (양평). build 단계에서 계산.
};
```

> 검증: 모든 좌표가 한국 범위(33<lat<39, 124<lng<132) 안, `id` 유니크, `lines` 비어있지 않음, 양평역 2엔트리(`ambiguous:true`) 존재, 호선 24종.

**표시·기록 라벨 (`stationLabel`):** `ambiguous` 면 `"양평 (영등포구)"`, 아니면 `name` 그대로. 이 라벨이 (a) 드롭다운/입력란 표시, (b) **추천 payload `originText`** 양쪽에 쓰인다 — 동명이역도 다운스트림 로그/재현에서 구분되도록(아래 §3·§4 참조). build 단계에서 `ambiguous` 를 미리 계산해 둔다.

## 3. 데이터 모델 / 로더 (`metroStations.ts` 확장)

기존 로더는 `getStationNames()` / `findStationByName()`(name 키)였다. 동명이역·호선필터를 위해 **id 키**로 전환:

- `getStations(): MetroStation[]`
- `getLines(): string[]` — 정렬된 24호선(노선번호 우선 → 광역노선). 칩/필터용.
- `findStationById(id): MetroStation | null` — 선택값 해석.
- `stationLabel(station): string` — `ambiguous` 면 `"{name} ({area})"`, 아니면 `name`.
- `searchStations(query: string, selectedLines: string[]): MetroStation[]` — **순수 함수**.
  - **빈 쿼리 규칙(명시):** `query.trim()` 이 비면 **항상 `[]` 반환** — selectedLines 가 있어도 전체 목록을 쏟지 않는다. 즉 호선 칩은 "검색 범위 한정"이지 "역 목록 나열"이 아니다(search-first UX, 모바일 노이즈 방지). UI 는 빈 쿼리일 때 드롭다운 대신 힌트(`역명을 입력하세요`)를 보인다.
  - **비어있지 않은 쿼리:** 역명 매칭(공백 정규화·prefix 우선, 그 외 substring) ∩ 호선 필터(selectedLines 비면 전체, 아니면 `lines`가 하나라도 교집합). prefix 매칭 우선 정렬 후 이름순. 상한 50개로 드롭다운 폭주 방지.

> 추천 payload는 여전히 `originLat/originLng/originText/originType="station"`. 클라이언트가 `findStationById`로 좌표를 채우고, **`originText` 에는 `name` 이 아니라 `stationLabel(station)`** 을 넣는다 — 동명이역(양평)도 `"양평 (영등포구)"` / `"양평 (양평군)"` 으로 기록돼 로그/디버깅/재현에서 구분된다. recommend 오케스트레이션/스키마(019)/scoring/ranker/route-cache **무변경**.

## 4. UI — 검색창 + 호선 칩 필터 (`StationPicker` 컴포넌트 분리)

`RehearsalFinderClient.tsx`의 멤버 행 입력을 새 `StationPicker.tsx`로 분리:

> **상태 모델 (가장 중요 — 기존 단일 `station: string` 의 결함 차단):** 멤버는 **두 개의 분리된 필드**를 가진다 — `query`(입력란에 보이는 표시 텍스트)와 `stationId`(유효 선택값, 없으면 `null`). 제출은 **오직 `stationId`** 로 좌표를 해석한다. 화면 텍스트로 좌표를 역추적하지 않는다.
>
> **동기화 규칙(필수):**
> 1. 후보를 **선택**하면 → `stationId = 선택역.id`, `query = stationLabel(선택역)`.
> 2. 사용자가 입력란을 **타이핑**하면 → `query` 갱신, 그리고 **현재 `query` 가 선택역의 `stationLabel` 과 한 글자라도 다르면 즉시 `stationId = null`**. (선택 후 다시 타이핑해 다른 역명이 보이는데 옛 좌표로 제출되는 상태 불일치를 원천 차단.)
> 3. 제출 시 `stationId === null` 인 멤버가 있으면 에러(`목록에서 역을 선택하세요`) — `query` 텍스트로 fuzzy 재해석하지 않는다.

- **호선 칩 줄:** `(전체)` + 24호선 칩. 다중 토글(선택된 호선들의 OR 합집합으로 검색 범위 한정). 모바일에서 wrap. 칩은 **공식 노선색** 적용. 칩 변경은 `query` 가 비어 있지 않을 때만 드롭다운에 반영(빈 쿼리는 여전히 결과 없음 — §3 빈 쿼리 규칙).
- **검색 입력 + 드롭다운:** 타이핑하면 `searchStations(query, selectedLines)`로 실시간 후보. 각 후보 = 역명 + 호선 배지(노선색) + 동명이역이면 area. **빈 쿼리면 드롭다운 대신 힌트(`역명을 입력하세요`).** 키보드 ↑↓/Enter 선택, Esc·외부 클릭 닫기.
- 네이티브 `datalist` 제거.

**호선색 상수** `metroLineColors.ts`(또는 데이터 모듈 내 맵): 호선명 → hex. 칩·배지 공통 사용. 미정의 호선은 중립 회색 fallback.

**접근성/모바일:** 입력 `inputMode=text`, 큰 탭 타겟, 드롭다운 스크롤. `aria` role(combobox/listbox/option) 기본 적용.

## 5. 변경 / 무변경 범위

**변경·추가:**
- `package.json` (`json5` devDependency 추가 — build 스크립트 파싱용)
- `scripts/build-metro-stations.ts` (신규, 원천→정규화, `JSON5.parse`)
- `src/lib/playground/rehearsal/data/metro-stations.json` (재생성: name/lat/lng → id/name/lines/lat/lng/area)
- `src/lib/playground/rehearsal/metroStations.ts` (id 키 로더 + `getLines`/`searchStations`)
- `src/lib/playground/rehearsal/metroLineColors.ts` (신규, 노선색)
- `src/app/playground/rehearsal-finder/StationPicker.tsx` (신규)
- `src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx` (StationPicker 연결, datalist 제거, 멤버 state name→stationId)

**무변경:** recommend API(`recommend/route.ts`, `studios/route.ts`) · 스키마 019 · scoring · ranker · reason · route-provider · route-cache · recommend 오케스트레이션 · admin CRUD · dev 게이트.

## 6. 테스트

- **데이터 무결성** (`metroStations.test.ts` 갱신): 좌표 범위, `id` 유니크, `lines` 비어있지 않음·정규화된 호선만(`경의중앙`/`김포 골드라인`/`신림역` 잔존 0), 양평역 2엔트리·`ambiguous:true`, `getLines()` 24종.
- **`searchStations` 단위테스트:** **빈/공백 쿼리 → `[]`**(selectedLines 가 있어도), 한글 prefix 매칭, substring fallback, 호선필터 교집합, 결과 상한, prefix 우선 정렬.
- **`stationLabel` 단위테스트:** 일반역 → `name`, 동명이역(양평) → `"양평 (영등포구)"` / `"양평 (양평군)"`.
- **상태 동기화(StationPicker):** 선택 후 입력 텍스트가 라벨과 달라지면 `stationId=null` 로 떨어지는지 — 컴포넌트/로직 테스트로 회귀 고정(스펙 §4 규칙 2). 제출 시 `stationId=null` 멤버는 에러.
- **빌드 스모크(DEV):** `pnpm build` → `pm2 restart bandsustain-dev` → 라우트 200 → 콤보박스/호선 칩 노출 → 검색·필터·빈쿼리 힌트 동작 → 선택→재타이핑 시 stationId 무효화 → end-to-end 추천(역 선택 → `originText=라벨` payload → 결과) 회귀.

## 7. 단순화 / 알려진 한계

- 호선 칩 24개는 모바일에서 다소 많다 → 기본 전부 wrap 노출. 그룹핑/접기는 후속(YAGNI).
- 좌표 정밀도는 소스 의존(일부 부정확 가능) — mock 직선거리 추천이라 영향 미미, disclaimer 유지.
- 동명이역은 양평역만 분리. 추가 동명이역 발생 시 build 스크립트의 1.5km 임계로 자동 처리.
- 원천이 전국 데이터 → bbox로 수도권만. GTX-A(3역)·신림선·김포골드라인 포함, 부산/대구/광주/대전 제외.

## 작업 규칙 (MEMORY bandsustain 섹션)

`bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/build는 `sudo -u ec2-user`. dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크)는 `git add .` 금지(파일 명시 커밋). DB 변경 없음(데이터는 정적 JSON 번들).
