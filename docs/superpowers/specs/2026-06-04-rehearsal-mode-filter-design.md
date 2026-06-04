# 합주실 찾기 — 모드 분기 + 조건 필터링 Design

> 합주실 추천(베타)에 **두 가지 찾기 방식**을 도입한다: (A) 멤버 위치 기반 추천(현행) / (B) 조건 필터링(신규). 같은 DB(20곳/47방)를 위치·악기·가격 등으로 거른다.

## 1. 문제 / 목표

현재는 진입하면 곧장 멤버 출발지 입력(이동시간 추천)만 가능하다. 출발지 없이 **속성으로 둘러보고 싶은** 사용자를 위해 필터 모드를 추가한다.

**목표:** 진입 시 두 버튼으로 모드를 고르게 하고, 필터 모드에서 지역·악기타입·가격대·수용인원·주차·악기대여로 합주실을 거른다. **추천 로직·데이터·상세 모달은 무변경**, 결과 카드는 두 모드가 공유한다.

## 2. 진입 / 모드 선택

- `page.tsx` 는 신규 `RehearsalFinderEntry`(client) 를 렌더.
- `RehearsalFinderEntry`: `mode: "select" | "recommend" | "filter"` state.
  - `select`: 큰 버튼 2개 — **[멤버 위치 기반으로 찾기]**(→recommend), **[조건으로 필터링하기]**(→filter). 각 버튼에 한 줄 설명.
  - `recommend`: 기존 `RehearsalFinderClient` 그대로 렌더.
  - `filter`: 신규 `RehearsalFilterClient` 렌더.
  - 두 모드 상단에 **"← 다른 방법으로 찾기"**(→select).
- 기존 `RehearsalFinderClient` 는 내용 변경 없음(엔트리가 감쌀 뿐).

## 3. 필터 모드 (`RehearsalFilterClient`)

### 필터 컨트롤
- **지역(시→동 2단계):** 시 라디오/셀렉트(전체·서울·성남·수원) → 선택 시의 **동 칩 다중선택**(서울: 역삼·이수·잠실·합정·흑석·석촌·방배·사당·양재 / 성남: 야탑·정자 / 수원: 인계). 동 옵션은 데이터에서 파생.
- **악기(타입):** 드럼·기타앰프·베이스앰프·키보드 칩 다중선택. **AND** — 선택 악기를 **한 방 안에 모두** 갖춘 합주실만.
- **가격대(버킷, 단일):** 전체 / `~15,000` / `15,000~20,000` / `20,000~25,000` / `25,000~`. 그 가격대 **방이 있는** 합주실.
- **수용인원:** "최소 ◯명"(셀렉트 또는 입력). 그 인원 **이상 방이 있는** 합주실(인원 미상 방 제외).
- **주차:** 토글(주차 가능). **악기대여:** 토글(악기대여 가능).

### 결과
- 조건 매칭 합주실 카드 목록(공유 `StudioCard`, 이동시간 없음): 지역·가격대(min~max)·방수·주차·**장비타입 칩** + **자세히 보기**(공유 `StudioDetailModal`).
- **가격 낮은 순**(`hourlyPriceMin` asc, null 뒤) 정렬. 상단에 "N곳". 0건 → "조건에 맞는 곳이 없어요. 필터를 완화해보세요."

## 4. 매칭 규칙 (AND 교집합)

순수 함수 `applyStudioFilters(studios, filter): Studio[]`:

- **합주실 단위 조건(AND):**
  - 지역: `filter.city` 있으면 `parseArea(studio.areaLabel).city === city`; `filter.dongs` 비어있지 않으면 `parseArea(...).dong ∈ dongs`.
  - 주차: `parkingOnly` 면 `studio.hasParking`.
  - 악기대여: `rentalOnly` 면 `/악기대여\s*O/.test(studio.amenities ?? "")`.
- **방 존재 조건:** 위 합주실 조건을 통과한 합주실 중, 아래를 **모두 만족하는 방이 1개 이상** 있을 것:
  - 가격: `priceBucket` 의 범위에 `room.hourlyPrice` 포함.
  - 수용인원: `capacityMin` 있으면 `room.capacity != null && room.capacity >= capacityMin`.
  - 악기타입: 선택한 모든 `t` 에 대해 `room.equipment.some(g => g.type === t)`.
  - (미설정 조건은 통과로 간주.)
- 통과 합주실을 `hourlyPriceMin` 오름차순(null 뒤) 정렬해 반환.

**`parseArea(label): { city: string | null; dong: string | null }`** (순수): 라벨을 `,` 로 분리·트림 → 토큰 중 `서울|성남|수원` 인 것을 `city`, 나머지를 `dong`. (라벨 순서가 "서울, 역삼"/"방배, 서울" 처럼 섞여 있어 토큰 매칭으로 정규화.)

**가격 버킷 → 범위:** `u15`= `price ≤ 15000`, `15_20`= `15000 < price ≤ 20000`, `20_25`= `20000 < price ≤ 25000`, `o25`= `price > 25000`. (경계는 상한 포함.)

### 필터 타입
```ts
type PriceBucket = "u15" | "15_20" | "20_25" | "o25";
type StudioFilter = {
  city: string | null;
  dongs: string[];
  instrumentTypes: RoomEquipmentType[];
  priceBucket: PriceBucket | null;
  capacityMin: number | null;
  parkingOnly: boolean;
  rentalOnly: boolean;
};
```

## 5. 백엔드 (재사용 + 순수 필터 + 라우트)

- 데이터가 작으니(20곳/47방) **새 SQL 없음**. 신규 라우트가 기존 `getCandidateStudios()`(20곳+방 포함)를 호출 → `applyStudioFilters` 적용 → 반환.
- 신규 라우트 `POST /api/playground/rehearsal/filter` (dev 게이트 `isRehearsalFinderEnabled` 동일 적용). 요청 바디 = `StudioFilter`(Zod 검증, 모두 optional·기본값). 응답 = `{ studios: Studio[] }`(추천 응답의 `studio` 와 동일 shape, 이동시간/순위 없음).
- `applyStudioFilters`·`parseArea`·`priceBucketMatch` 는 `src/lib/playground/rehearsal/filter.ts`(순수) + 단위테스트.

## 6. 재사용 / 리팩터

- **`StudioCard` 공유 컴포넌트 추출:** 현재 `RehearsalFinderClient` 결과 카드 JSX를 `StudioCard.tsx` 로 빼서 두 모드가 공유. props: `studio` + optional `rankNo`·`travel: {avgMinutes,maxMinutes,memberRoutes}` + `onDetail(studio)`. 추천 모드는 travel 전달, 필터 모드는 생략(이동시간 행 안 그림).
- `StudioDetailModal` 그대로 공유.

## 7. 변경 / 무변경 범위

**신규:** `src/lib/playground/rehearsal/filter.ts`(+test) · `src/app/api/playground/rehearsal/filter/route.ts` · `src/app/playground/rehearsal-finder/RehearsalFinderEntry.tsx` · `RehearsalFilterClient.tsx` · `StudioCard.tsx`.
**수정:** `page.tsx`(Entry 렌더) · `RehearsalFinderClient.tsx`(결과 카드 → `StudioCard` 사용, 상단 "← 다른 방법" 은 Entry가 담당하므로 내부 변경 최소).
**무변경:** recommend 백엔드·studios.ts·types(Studio)·StudioDetailModal·데이터·역 검색/시트.

## 8. 테스트

- **`filter.ts` 순수 단위테스트:** `parseArea`(순서 섞인 라벨·미상), `priceBucketMatch`(경계), `applyStudioFilters`(지역·악기 AND 한 방·가격대·인원·주차·악기대여 각각 + 복합 + 정렬 + 0건). fixture 는 Studio 형 mock.
- **라우트 스모크(DEV):** `POST /filter` 로 (예: 서울+드럼+`20_25`) → 매칭 합주실 반환, shape 에 rooms/타입칩.
- **빌드 스모크:** build→restart→라우트 200→모드 선택 버튼 2개→필터 모드 렌더→필터 적용 결과→자세히 보기. 인터랙션 최종 확인은 사용자 dev.

## 9. 단순화 / 한계

- 필터는 in-app 순수 함수(데이터 작아 충분; 커지면 SQL 이관). 가격 버킷 단일선택. 악기타입 AND(한 방에 모두). 부가필터 AND.
- 지역 라벨이 비정규(시/동 순서 혼재) → `parseArea` 토큰매칭으로 흡수. 새 시 추가 시 city 집합 갱신.
- 정렬은 가격 오름차순 고정(후속에 정렬 옵션 가능).

## 작업 규칙 (MEMORY bandsustain)

`bandsustain-dev`(dev, 포트 3101)에서만. 모든 git/build 는 `sudo -u ec2-user`. **DB 변경 없음.** dev push 후 멈추고 사용자 확인 — main 머지·PROD 반영은 명시 요청 시에만. 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지.
