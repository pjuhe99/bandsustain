# 유명인·브랜드 구분 (인스타 맞팔 분석기) 설계

2026-06-10 사용자 승인. 배경: "나를 맞팔하지 않음" 목록에서 연예인(원래 맞팔 안 함)과 일반인을 구분하고 싶다. 인스타그램 내보내기 ZIP에는 표시 이름·팔로워 수가 없고 인스타 API/스크레이핑은 불가하므로, 공개 데이터(위키데이터) 명단을 클라이언트에 내장해 대조한다.

## 원칙
- 판별은 **전부 브라우저 안에서** 수행 — 사용자 팔로워/팔로잉 목록이 서버·외부로 나가지 않는다는 기존 약속 유지.
- "추정" 표현 필수 (블룸필터 오탐 ~1% + 위키 미등재 인플루언서 누락).

## 1. 데이터셋 (빌드 타임, repo 커밋)
- `scripts/build-celebrity-usernames.ts` (수동 실행): QLever Wikidata 엔드포인트(`https://qlever.cs.uni-freiburg.de/api/wikidata`, `-L` 리다이렉트 필수)에서 `SELECT ?u WHERE { ?i wdt:P2003 ?u }` CSV 단일 요청(~5.4MB, 38.2만 건, 실측 3.7s). 실패 시 WDQS 폴백은 구현하지 않음(수동 스크립트이므로 재시도로 충분).
- 정규화: 소문자, 앞 `@` 제거, `^[a-z0-9._]{1,30}$` 불일치 폐기, 중복 제거.
- 블룸필터 생성: 오탐율 p=0.01, k=7, FNV-1a 기반 더블 해싱 → `public/playground/instagram/celebs-v1.bin` (~480KB) + `celebs-v1.meta.json` (생성일, 건수, m, k, 버전).
- 갱신: 필요할 때 스크립트 재실행 후 커밋 (자동화 없음 — YAGNI).

## 2. 판별 모듈 (클라이언트)
- `src/lib/playground/instagram/bloom.ts`: 순수 블룸필터 (직렬화 포맷: 헤더[매직 "BSBF", 버전, m, k] + 비트배열). node:test 단위 테스트.
- `src/lib/playground/instagram/celebrity.ts`:
  - `loadCelebrityFilter()`: 결과 화면 진입 시 1회 lazy fetch + 모듈 캐시. 실패 시 null (배지/토글 기능 조용히 숨김, 분석 무영향).
  - `classify(username, filter)`: ① localStorage 수동 보정(`bs_instagram_celebrity_overrides_v1`: {username: "celebrity"|"person"}) 최우선 → ② 블룸필터 매칭 → ③ 보조 휴리스틱(계정명에 `official` 포함). 반환 "celebrity" | "person".
  - `setOverride(username, verdict|null)`.

## 3. UI (배지 + 제외 토글 — 사용자 선택안)
- `AccountList.tsx`:
  - 카드: 유명인 판정 시 `⭐ 유명인·브랜드 추정` 배지. 배지(또는 작은 토글 버튼) 클릭으로 수동 표시/해제 — localStorage 저장, 다음 분석에도 유지.
  - 툴바: `☐ 유명인·브랜드 제외 (N)` 체크박스 — 전 탭 동작, 기본 꺼짐, 탭 카운트는 원본 유지(보기만 거름).
  - 명단 미로드(null) 시 배지·토글 모두 미표시.
- 목록 하단 또는 토글 옆에 작은 고지: "위키백과 등재 기준 자동 추정이라 누락·오판이 있을 수 있어요."

## 4. 테스트
- bloom: 직렬화/역직렬화 라운드트립, 멤버십(포함 전부 true, 미포함 대부분 false), 헤더 검증.
- celebrity: 보정 > 필터 > 휴리스틱 우선순위, 휴리스틱 케이스.
- 스모크: 실측 ZIP following 774건 대조해 매칭 수 출력(상식 범위 확인).

## 한계 (고지)
- 위키데이터 등재 인물·그룹·브랜드만 자동 판별. 중소 인플루언서는 수동 표시로 보완.
- 블룸필터 특성상 ~1% 일반인 오탐 가능 → "추정" 배지 + 클릭 해제.
