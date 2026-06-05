# 합주실 찾기 — 네이버 지도 70곳 임포트 + 정보 없음 표시 + 모드/필터 수정 Design

> 네이버 지도 스크랩 JSON(70곳, 이름·주소·좌표·전화·예약URL만 — 가격/방/악기 없음)을 추가 임포트하고, **정보가 없는 항목은 0원이 아니라 "정보 없음"으로 구분 표시**한다. 미구현 상태인 모드 셀렉터+필터 설계(2026-06-04)를 새 데이터에 맞게 수정해 함께 구현한다.

## 1. 데이터 소스 / 현황

- 기존: 합주실 20곳/방 47개 (`notion-import`, 가격·방·악기·주차 풍부).
- 신규: `/var/www/html/_______site_BANDSUSTAIN/naver_map_hapjusil_list_retry.json` — 70곳. 필드: `id`(네이버 place id)·`name`·`full_address`·`common_address`·`phone`/`virtual_phone`·`booking_url`·`naver_map_url`·`x`/`y`. **가격·방·악기·주차 정보 없음.** 전부 서울(마포 30, 동작 6, 성북 5, 서초 5 등).
- 좌표/이름 대조 결과 기존과 **확실 중복 ~5곳** (엠플사운드·사운딕트·그루브 방배점·스페이스개러지(중앙대)·그라운드 합정1호점). 다른 지점(비쥬 2호점, 드림 사당2호점 등)은 신규.

## 2. 스키마 (021)

- `playground_studios.phone VARCHAR(40) NULL` 추가 (멱등 ADD). 신규 데이터의 주 연락수단. `Studio` 타입·`SELECT_STUDIO`·`mapStudioRow` 에 plumb-through, 상세 모달에 표시.

## 3. 임포트 (`naverImport.ts` 순수 변환 + 러너)

- **변환(순수, TDD):** JSON item → `{ name, slug: "naver-<id>", areaLabel, roadAddress: full_address, lat: y, lng: x, mapUrl: naver_map_url, bookingUrl, phone: phone || virtual_phone || null, bookingMethod }`.
  - `areaLabel`: `common_address`("서울 마포구 동교동 …")에서 `"서울, 동교동"` — 시(첫 토큰 단축형) + 동(세 번째 토큰). 동 토큰 없으면 구로 폴백.
  - `bookingMethod`: booking_url 있으면 `"네이버 예약"`, 아니고 phone 있으면 `"전화"`, 둘 다 없으면 null.
  - 가격·방·악기·주차: 전부 NULL/없음 (**0 금지**). `status='approved'`, `source_note='naver-map-import'`.
- **중복 스킵(순수, TDD):** 기존 studio 목록(이름+좌표) 대비 **좌표 50m 이내 OR 정규화 이름(공백·"합주실" 제거) 일치** → skip, 사유 리포트.
- **러너(`scripts/import-naver-studios.ts`):** 기존 `import-rehearsal-studios.ts` 패턴 — env 자격증명 + `DB_NAME` 에 DEV 없으면 거부, 트랜잭션. **추가형 멱등**: `DELETE … WHERE source_note='naver-map-import'` 후 재삽입 (notion-import 20곳 불변). 중복 판정은 DB의 비-naver 행 기준.

## 4. "정보 없음" 표시 (두 모드 공유)

- **`StudioCard`(공유 컴포넌트, 2026-06-04 설계의 T3에 통합):**
  - 가격 min null → `💸 가격 정보 없음` (muted). 0원 표기 금지.
  - rooms 0개 → `🚪 방 정보 없음` (muted, "방 0" 금지).
  - equipmentTypes 비고 rooms 도 0개 → 칩 대신 `악기 정보 없음` (muted).
- **`StudioDetailModal`:** `phone` 있으면 `📞 <번호>` 추가. rooms 0개 → 방 섹션 대신 "방·가격 정보가 아직 없어요. 네이버 지도에서 확인해주세요."
- 추천 모드: `PREFILTER_LIMIT=15` 그대로 — 후보 85곳이어도 경로 API 비용 동일. price null 은 기존 scoring 이 페널티 없이 통과(확인됨).

## 5. 모드 셀렉터 + 필터 — 2026-06-04 설계에서 수정되는 점

(나머지는 `2026-06-04-rehearsal-mode-filter-design.md` 그대로.)

1. **지역 필터 = 시 → 구** (동 단위 폐기): 서울 선택 시 **구 칩 다중선택**(마포구·서초구… 데이터 기준), 성남·수원은 시 단위만. `parseArea` 대신 **`parseRegion(roadAddress, areaLabel)`**: `road_address` 에서 `시`(서울특별시→서울 등)·`OO구` 토큰 추출 (전 레코드 road_address 보유). `StudioFilter` 는 `dongs: string[]` → `gus: string[]`.
2. **정보 없음 분리 응답:** 방 단위 조건(가격대·인원·악기)이 하나라도 걸렸을 때 `rooms.length === 0` 인 합주실은 매칭 제외하되 **`noInfo` 리스트로 분리 반환** (합주실 단위 조건은 통과한 것만). 응답 `{ studios, noInfo }`. UI: 결과 하단 "조건 확인이 안 되는 N곳 (가격·악기 정보 없음)" 접기/펼치기(`<details>`), 펼치면 동일 `StudioCard`.
   - 주차·악기대여 토글은 단순 제외 (has_parking=0/amenities null 이 '없음'인지 '미상'인지 구분 불가).
3. 정렬: 가격 오름차순, **가격 null 뒤** (기존과 동일, null=Infinity).
4. 필터 모드 구 칩 목록은 임포트 후 실데이터로 확정해 하드코딩 (기존 AREA_OPTIONS 트레이드오프 동일).

## 6. 테스트

- `naverImport` 순수 단위테스트: 변환(전화 폴백·bookingMethod·areaLabel 동/구 폴백), 중복 판정(좌표 50m·이름 정규화), 가격/방 없음이 null 인지.
- `filter` 단위테스트: `parseRegion`(서울특별시/경기도 성남시), 구 필터, noInfo 분리(방 조건 있을 때만), 버킷 경계, 정렬 null 뒤.
- 스모크: 임포트 후 개수(20+~65), 카드에 "정보 없음" 문구, /filter 응답 `{studios, noInfo}`.

## 7. 한계 / 단순화

- 신규 65곳은 추천 점수에서 가격·장비 페널티 0 (정보 없음 = 페널티 없음) — 이동시간 위주 순위. 후속으로 가격 수집 시 자연 개선.
- 네이버 1페이지(70/615)만 수집된 데이터 — 추가 수집 시 같은 러너 재실행으로 갱신.
- 구 칩 하드코딩 — 데이터 변경 시 갱신 필요.

## 작업 규칙 (MEMORY bandsustain)

`bandsustain-dev`(dev, 포트 3101)에서만. 모든 git/build/tsx 는 `sudo -u ec2-user`. DB 변경은 **DEV 먼저**(021 + 임포트). dev push 후 멈추고 사용자 확인 — main 머지·PROD 반영(021+임포트 PROD 실행 포함)은 명시 요청 시에만. 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지.
