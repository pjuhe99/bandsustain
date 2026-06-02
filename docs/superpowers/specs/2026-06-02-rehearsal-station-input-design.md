# 합주실 추천 — 출발지 "지하철 역 선택" 입력 설계문서

**날짜:** 2026-06-02
**대상:** bandsustain.com `/playground/rehearsal-finder` (dev 전용, 기존 합주실 추천 기능의 입력 방식 개선)
**상태:** 설계 합의 완료

## 1. 배경 / 목적

현재 합주실 추천은 멤버 출발지를 **위도/경도 직접 입력**으로 받는다 — 일반 사용자에게 너무 불편하다.
이를 **지하철 역 선택**으로 바꿔, 멤버가 역을 고르면 시스템이 좌표를 자동으로 채우게 한다.

기존 추천 파이프라인(이동시간/가격/인원/장비 점수화, MockRouteProvider, route_cache, ranker)은 그대로 두고,
**입력 레이어만 교체**한다. recommend API/스키마/추천 로직은 변경하지 않는다.

## 2. 합의된 결정

1. **역 데이터:** 공개 표준데이터셋을 받아 **정적 파일로 번들**(런타임 외부 API 호출 없음, 오프라인, 수도권 전체). 좌표는 **실제 공개 데이터에서만** — 기억으로 추정하지 않는다.
2. **입력 방식:** 멤버 출발지는 **역 선택만**. 수동 좌표/주소 입력은 제거.

## 3. 데이터 출처 (정확도 우선)

후보 (machine-readable 우선):
- 공공데이터포털 **전국도시철도역사정보표준데이터** (역명/노선/위도/경도) — https://www.data.go.kr/data/15013205/standard.do
- 공공데이터포털 **서울교통공사 1-8호선 역사 좌표(위경도)** — https://www.data.go.kr/data/15099316/fileData.do
- 보조: 수도권 지하철 좌표 공개 자료(gaussian37 등)

획득 방식: 구현 시 실제 데이터셋을 받아 정규화 → 정적 JSON으로 커밋. **다운로드가 세션/리다이렉트로 막혀 어떤 머신리더블 소스도 못 받으면** → 주요 역 큐레이션 셋으로 축소하고 그 사실을 명시(좌표 추정 금지).

## 4. 데이터 모델 (정적 번들)

- 파일: `src/lib/playground/rehearsal/data/metro-stations.json`
- 엔트리: `{ name: string; lines: string[]; lat: number; lng: number }`
- **환승역**: 같은 역명이 여러 노선에 나오면 1개 좌표로 dedupe (대표 좌표). `lines` 에 노선 모음.
- **동명이역**(예: 총신대입구↔이수, 서로 다른 위치의 양평역): 이름이 같지만 위치가 다른 경우는 `name` 에 노선/구분 병기로 유일성 확보 (예: `"양평역(5호선)"`, `"양평역(경의중앙선)"`).
- 로더/헬퍼: `src/lib/playground/rehearsal/metroStations.ts`
  - `getStationOptions(): { name: string; lines: string[] }[]` — 피커 표시용(정렬).
  - `findStationByName(name: string): { name; lat; lng } | null` — 정확 매칭, 없으면 null.
  - 타입 `MetroStation = { name; lines; lat; lng }`.

## 5. UI (RehearsalFinderClient.tsx 수정)

- 멤버 행에서 `위도`/`경도` 텍스트 입력 2개 제거 → **역 검색 입력 1개**로 교체.
- 구현: `<input list="metro-stations">` + 단일 `<datalist id="metro-stations">`(역명 옵션). 추가 라이브러리 없음.
- 동작: 사용자가 역명을 입력/선택 → `findStationByName` 으로 좌표 해석해 멤버 state 에 저장.
  - 정확 매칭 실패(오타/미선택) 시 그 멤버는 미완성 → 제출 대상에서 제외 + "목록에서 역을 선택하세요" 힌트.
- 닉네임 필드 유지. 제출 payload(멤버): `{ nickname, originText: 역명, originLat, originLng, originType: "station", transportMode }`.
- 멤버 추가/삭제(최대 10), 이동수단/예산/선호지역/필수장비 입력은 기존 그대로.

## 6. 백엔드 — 변경 없음

- `POST /api/playground/rehearsal/recommend` 는 이미 `originLat/originLng`(finite) + `originType`("station" 포함) + `originText` 를 받는다.
- recommend 오케스트레이션/스키마(019)/scoring/ranker/route-cache 전부 **무변경**. 클라이언트가 역→좌표만 해결해 보낸다.

## 7. 테스트

- **데이터 무결성** (`metroStations.test.ts`, node:test):
  - 모든 좌표가 한국 범위(위도 33~39, 경도 124~132) 안.
  - `name` 유니크(동명이역은 병기로 구분되어 유일).
  - 엔트리 수 > 0 (데이터 로드 확인).
- **해석 헬퍼**: `findStationByName` 정확 매칭 성공 / 미존재 → null / 좌표 형태.

## 8. 파일 변경 요약

```
src/lib/playground/rehearsal/data/metro-stations.json   # 신규 (공개 데이터에서 생성, 커밋)
src/lib/playground/rehearsal/metroStations.ts           # 신규 (타입+로더+헬퍼)
src/lib/playground/rehearsal/metroStations.test.ts      # 신규 (무결성+해석)
src/app/playground/rehearsal-finder/RehearsalFinderClient.tsx  # 수정 (좌표입력→역 datalist)
scripts/build-metro-stations.ts (선택)                   # 원천 데이터 정규화 1회용 (커밋, 재현용)
```

## 9. 비노출 / 배포

- 기존 dev 게이트(`REHEARSAL_FINDER_ENABLED`) 그대로. 이 변경도 dev 에만. 운영 반영은 사용자 명시 요청 시.
