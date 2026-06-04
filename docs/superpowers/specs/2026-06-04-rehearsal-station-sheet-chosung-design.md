# 합주실 추천 — 출발지 선택 모달/바텀시트 + 초성 검색 Design

> 선행: `2026-06-04-rehearsal-station-search-filter-design.md`(검색+호선칩 콤보박스). dev 사용자 피드백으로 입력 UX를 재설계한다.

## 1. 문제 / 목표

현재(dev) 멤버 출발지 입력은 멤버 행마다 **24개 호선 칩 + 검색 콤보박스**가 인라인으로 펼쳐진다. 사용자 피드백:

- 멤버를 추가할수록 호선 칩+검색창이 세로로 반복돼 화면이 복잡하고 스크롤이 길다.
- "역명 검색"과 "호선 필터"의 역할 분담이 모호해 피로감.
- 타이핑 후 어떤 액션을 해야 하는지 모호.

**목표:** (1) 멤버 행을 **버튼 하나로 축소**하고 선택 UI를 **모달/바텀시트**로 분리해 메인 화면 복잡도를 낮춘다. (2) 시트 안은 **검색 전용**(호선 칩 제거, 결과에 호선 태그). (3) **초성 검색**으로 모바일 입력 속도를 높인다.

**비목표:** recommend API/스키마/추천 로직 변경. 호선 "전체 목록 브라우징"(특정 호선의 모든 역 나열) — 이름/초성 검색으로 대체(합의).

## 2. 컨테이너 — `[역 선택]` 버튼 + 반응형 시트

- 멤버 행 = `닉네임 input` + **`[역 선택]` 버튼** + `✕`(행 삭제). 버튼은:
  - 미선택: placeholder "역 선택" (회색).
  - 선택됨: `stationLabel`(동명이역이면 `양평 (영등포구)`) + 작은 호선 배지들.
- 버튼 클릭 → 시트 오픈. **반응형:** 모바일(`< sm`)=바텀시트(하단에서 슬라이드, 풀 너비), 데스크탑(`≥ sm`)=가운데 모달. CSS transform/transition만 사용(외부 라이브러리 없음).
- **시트는 부모가 하나만 렌더.** 부모 state `openMemberIndex: number | null`. 멤버가 10명이어도 시트 인스턴스는 1개. `onSelect(station)`는 `openMemberIndex` 멤버에 적용.
- 닫기: backdrop 클릭 · Esc · 닫기(✕) 버튼. `role="dialog"`, `aria-modal`. 열릴 때 검색 input 자동 포커스. 열린 동안 body 스크롤은 시트 내부로 한정(간단히 backdrop overlay).

## 3. 시트 내부 — 검색 전용

`StationSearchSheet.tsx` (신규, controlled):

- props: `{ open: boolean; onClose: () => void; onSelect: (s: MetroStation) => void }`.
- 내부 state: `query`(시트 한정·휘발성), 키보드 highlight 인덱스.
- 구성: 제목("출발지 역 선택") + 닫기 버튼 + **단일 검색 input(자동 포커스)** + 결과 리스트.
- 결과 행 = 역명(+동명이역 area) + **호선 배지(노선색, `metroLineColors`)**. 탭/Enter → `onSelect(s)` 후 `onClose()`.
- 빈/공백 쿼리 → 리스트 대신 힌트 "역명을 입력하세요". 결과 0 → "검색 결과 없음".
- 키보드 ↑↓/Enter 선택, Esc 닫기.

> 멤버 행에 자유 입력 칸이 없으므로 `stationId`는 **결과를 명시적으로 탭/선택할 때만** 설정된다 → 표시 텍스트와 좌표가 어긋날 여지가 구조적으로 없음. 이전 콤보박스의 `query`/`reconcileSelection` 불일치 방어 로직은 **불필요**해져 제거한다.

## 4. 초성 검색 — `chosung.ts` (신규, 순수)

- `toChosung(str: string): string` — 각 한글 음절(U+AC00–U+D7A3)을 초성 자모로 변환, 그 외 문자는 그대로. 예: `"강남" → "ㄱㄴ"`, `"강남구청" → "ㄱㄴㄱㅊ"`.
  - 초성 추출: `code = char - 0xAC00; choIndex = Math.floor(code / 588)`; `CHO[choIndex]` (19 초성 테이블).
- `isChosungQuery(q: string): boolean` — 공백 제거 후 모든 문자가 초성 자모(ㄱ~ㅎ, 단 ㄲㄸㅃㅆㅉ 포함 19종)인지. 빈 문자열은 false.

## 5. 검색 랭킹 — `searchStations` 확장

`searchStations(query, selectedLines?)` 시그니처에서 `selectedLines`는 더 이상 UI에서 안 쓰이지만(칩 제거) **하위호환·내부 단순화를 위해 파라미터를 제거**한다 → `searchStations(query: string): MetroStation[]`. (호출처는 시트 하나뿐.)

매칭/랭킹(빈 쿼리 → `[]` 유지):
- 정규화 `normalize` = trim + 공백제거 + lowercase.
- 쿼리가 **순수 초성**(`isChosungQuery`)이면: 각 역의 `toChosung(name)` 가 쿼리로 **prefix 매칭**되는 역. (tier C)
- 아니면: 역명 정규화 기준 **prefix(tier A) → substring(tier B)**.
- 정렬: tier(A<B<C 우선) → 역명 `localeCompare(ko)`. 상한 50.

> 초성과 일반 검색은 상호배타(쿼리 형태로 분기) — `강`(완성형)은 A/B, `ㄱㄴ`(초성)은 C. 혼합 쿼리(`강ㄴ`)는 순수 초성이 아니므로 일반 경로(매칭 적음) — 수용.

## 6. 상태 모델 단순화 (`RehearsalFinderClient.tsx`)

- `MemberForm = { nickname: string; stationId: string | null }` (이전 `query` 필드 제거).
- 멤버 행: 닉네임 input + 역선택 버튼(라벨=`stationId ? stationLabel(findStationById(stationId)!) : "역 선택"`) + ✕.
- 공유 `StationSearchSheet`를 `openMemberIndex`로 제어. `onSelect(s)` → 해당 멤버 `stationId = s.id`, 시트 닫기.
- submit: 멤버 중 `nickname.trim() && stationId` 인 것만, `findStationById`로 좌표 해석, `originText = stationLabel(st)`, `originType "station"`. 유효 멤버 0이면 기존 에러. (이전 `typedButUnknown` 자유입력 검증은 불필요 — 버튼은 유효 stationId만 설정.)

## 7. 변경 / 무변경 범위

**신규:** `src/lib/playground/rehearsal/chosung.ts`, `src/app/playground/rehearsal-finder/StationSearchSheet.tsx`
**수정:** `metroStations.ts`(searchStations 초성·시그니처 변경, `reconcileSelection` 제거), `metroStations.test.ts`(초성/랭킹 테스트, reconcile 테스트 제거, searchStations 호출 시그니처 갱신), `RehearsalFinderClient.tsx`(버튼+공유 시트, 상태 단순화)
**삭제:** `src/app/playground/rehearsal-finder/StationPicker.tsx`(칩 콤보박스 대체)
**무변경:** `metroLineColors.ts`(결과 배지에 계속 사용), 데이터 JSON·빌드 스크립트, recommend API/스키마/scoring/ranker/route, admin/dev 게이트.

## 8. 테스트

- **`chosung` 단위테스트:** `toChosung("강남")==="ㄱㄴ"`, `toChosung("강남구청")==="ㄱㄴㄱㅊ"`, 비한글 보존, `isChosungQuery("ㄱㄴ")===true`/`isChosungQuery("강")===false`/`isChosungQuery("")===false`.
- **`searchStations` 단위테스트(갱신):** 빈 쿼리 `[]`, 역명 prefix 우선, substring fallback, **초성 `"ㄱㄴ"`→강남 포함**, 상한 50. (reconcileSelection 테스트 삭제.)
- **데이터 무결성** 기존 테스트 유지(count·id·lines·양평·24호선).
- **빌드 스모크(DEV):** `pnpm build` → `pm2 restart bandsustain-dev` → 라우트 200 → 멤버 행에 `[역 선택]` 버튼 N개(칩 0) → 시트 마크업 존재 → e2e 추천(역 선택 → payload → 결과). 인터랙션(시트 열림/검색/초성/선택→라벨) 최종 확인은 사용자가 dev에서.

## 9. 단순화 / 알려진 한계

- 호선 전체 브라우징 제거(검색 대체). 혼합 초성+완성 쿼리는 일반 경로(수용).
- 바텀시트/모달은 CSS만(애니메이션 라이브러리 없음). 포커스 트랩은 최소(Esc/backdrop 닫기 + 검색 input 자동 포커스).
- `StationPicker.tsx` 삭제로 호선 칩 필터 UI는 사라짐(데이터/로더는 그대로 — 필요 시 후속 복원 가능).

## 작업 규칙 (MEMORY bandsustain 섹션)

`bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/build는 `sudo -u ec2-user`. dev push 후 멈추고 사용자 확인 — main 머지는 명시 요청 시에만. `public/playground/images`(심볼릭 링크) `git add .` 금지. DB 변경 없음. root 생성 파일은 커밋 전 `chown ec2-user:ec2-user`.
