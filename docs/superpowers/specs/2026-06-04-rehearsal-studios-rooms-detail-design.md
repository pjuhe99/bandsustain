# 합주실 데이터(방 단위) + 상세 모달 + 카드 개선 Design

> 합주실 추천(베타)의 추천 결과를 **실제 큐레이션 데이터(노션 CSV)**로 교체하고, 합주실→방 구조·상세 모달·스캔 가능한 카드를 도입한다.

## 1. 문제 / 목표

현재 추천 결과는 가상 mock 7곳이고, (a) 합주실에 **방·방별 장비/가격/인원** 개념이 없으며, (b) 카드의 `reason`이 파란 장문 텍스트라 한눈에 안 들어오고 이동시간/가격이 텍스트로만 노출되며, (c) 상세 정보(주소·예약·방·장비)를 볼 수 없다.

**목표:** 사용자가 노션에 정리한 **20개 합주실 · 47개 방** 데이터를 데모로 넣고, 추천 카드를 스캔 가능하게 개선하고, "자세히 보기" 모달로 방·장비·주소·예약을 보여준다.

**소스 데이터:** `/var/www/html/_______site_BANDSUSTAIN/합주실 리스트 ….csv` (UTF-8, 47행=방). 컬럼: 합주실 이름, 가격(시간당), 기타 정보(악기대여/주차/할인), 네이버 지도(naver.me), 수용 인원, 예약 방식, 위치(예 "성남, 야탑"), 장비(브랜드/모델 콤마구분), 후기(요약). **네이버 링크가 같은 행 = 같은 합주실**(위치·예약방식·기타정보 일정, 가격/인원/장비/후기는 방마다 다름).

## 2. 데이터 모델 (스키마 020, 멱등)

### 2.1 `playground_studios` 확장 (ALTER ADD COLUMN, 멱등)
- `road_address VARCHAR(255) NULL` — Naver 도로명 주소
- `booking_method VARCHAR(120) NULL` — 예약 방식 텍스트(예 "네이버 예약, 전화")
- `amenities VARCHAR(120) NULL` — 기타 정보 원문(예 "악기대여 O, 주차 O")
- `homepage_url VARCHAR(255) NULL` — Naver 제공 홈페이지(있을 때)
- 기존 컬럼 활용: `area_label` = 위치 원문, `map_url` = naver.me 링크, `lat/lng` = Naver 좌표, `has_parking`/`parking_note` = 기타정보의 주차 O/X 파싱, `hourly_price_min/max`·`min/max_capacity` = **방에서 집계해 denormalize**(카드 정렬·표시용), `source_note` = "notion-import".

### 2.2 신규 `playground_studio_rooms`
```sql
CREATE TABLE IF NOT EXISTS playground_studio_rooms (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  studio_id     BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(120) NOT NULL,          -- 예 "A1 room", "사당점 A룸"
  hourly_price  INT NULL,                        -- 원, 시간당
  capacity      INT NULL,                        -- 수용 인원(빈 값 가능)
  equipment_json JSON NULL,                       -- [{ "name":"Ampeg SVT810E", "type":"BASS_AMP" }, …]
  review        TEXT NULL,                        -- 후기(요약)
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE,
  KEY idx_room_studio (studio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
> 기존 `playground_studio_equipment`(enum 단위, 합주실 레벨)는 **이 데이터에 미사용**(deprecated). 새 장비는 방의 `equipment_json`이 진실. 추천의 장비 필터/점수는 이미 제거됨.

### 2.3 장비 타입 분류
- 타입 5종: `DRUM`(드럼) · `GUITAR_AMP`(기타앰프) · `BASS_AMP`(베이스앰프) · `KEYBOARD`(키보드) · `ETC`(그외, PA·마이크·하드웨어 등). **캐비넷은 해당 앰프 타입에 흡수**(베이스캐비넷→BASS_AMP, 기타캐비넷→GUITAR_AMP).
- `src/lib/playground/rehearsal/types.ts`에 `RoomEquipmentType` union + `ROOM_EQUIPMENT_LABELS`(한글) 추가.
- **분류 매핑**: 고유 장비 **140개**를 브랜드/모델 지식으로 타입 분류해 `scripts/data/equipment-classification.json`(`{ "Ampeg SVT810E": "BASS_AMP", … }`)으로 **커밋**. 임포트가 이 맵으로 각 장비에 타입 부여. 맵에 없는 신규 장비는 `ETC` + 빌드 경고 로그(누락 표면화).

## 3. 임포트 (데모 데이터 교체)

재현 가능·오프라인을 위해 외부 의존을 커밋된 데이터로 고정:
- `scripts/data/rehearsal-studios.csv` — 노션 CSV vendor 사본(원본 복사).
- `scripts/data/rehearsal-studio-coords.json` — 20개 합주실 `{ "<studio name>": { lat, lng, roadAddress, homepageUrl } }`. Naver 지역검색으로 **1회 확보해 커밋**(카테고리가 합주실/음악/장소대여/악기대여인지 확인; 못 찾으면 BLOCKED 보고, 추정 금지).

`scripts/import-rehearsal-studios.ts` (tsx, DEV DB):
1. CSV 파싱(정식 CSV 파서, 멀티라인 셀 지원).
2. **네이버 링크로 그룹핑** → 합주실. 합주실명 = 그룹 내 방 이름들의 **최장 공통 접두사** trim(단일 방이면 이름 전체, 방 이름은 "메인").
3. 합주실 필드: area_label=위치, booking_method=예약방식, amenities=기타정보, has_parking=기타정보에 "주차 O" 포함, map_url=네이버링크, lat/lng/road_address/homepage_url=coords.json, source_note="notion-import". hourly_price_min/max·capacity = 방 집계.
4. 방 필드: name=공통접두사 제거 후 잔여, hourly_price=가격 파싱(₩/콤마 제거→int), capacity=수용인원(빈값 NULL), equipment_json=장비 분리·타입분류, review=후기.
5. **교체**: 트랜잭션으로 기존 `playground_studio_rooms`·`playground_studios`(+의존 equipment/결과) 삭제 후 20곳·47방 insert. (멱등 재실행 가능.)
6. 무결성 가드: 합주실 20±, 방 47±, 좌표 범위, 가격>0, 장비 타입 분류율 로그.

## 4. 조회 / 추천 변경

- `studios.ts`: 합주실 조회에 방 LEFT JOIN → `rooms[]`(name·price·capacity·equipment·review) + 집계(price_min/max·capacity_max·room_count). 합주실 보유 **타입 요약**(방들의 equipment 타입 합집합) 계산.
- `recommend.ts`/`ranker.ts`/`scoring.ts`: **이동시간 기준 순위**(멤버 좌표→합주실 좌표, 기존 route-provider/mock 유지). 예산·장비·지역 점수/필터는 제거(이미 UI 제거됨) → scoring을 travel-time 중심으로 단순화. 추천 결과 `studio`에 추가: `priceMin/priceMax`, `roomCount`, `equipmentTypes`(요약), `roadAddress`, `bookingMethod`, `amenities`, `mapUrl`, `homepageUrl`, `rooms[]`.
- 라우트 스키마(recommend/route.ts, studios/route.ts)는 응답 확장만(요청 스키마 무변경).

## 5. 카드 개선 (스캔 가능)

`RehearsalFinderClient` 결과 카드:
- `reason` 파란 장문 → **차분한 톤(muted) 한 줄** 또는 제거. 강조색 남용 금지.
- **시각 메트릭 행**: 이동시간(평균/최대)·가격대(₩min~max)·방 수·주차를 아이콘+숫자 블록으로. 보유 장비 타입 요약(드럼·기타앰프·베이스앰프·키보드 중 보유분) 작은 칩.
- **`자세히 보기` 버튼** → 상세 모달 오픈.
- 예:
```
1. 그루브합주실 사당점                서초구
   ⏱ 평균 12 · 최대 18분   ₩15,000~22,000   방 4   🅿
   🥁 🎸 🎹            [ 자세히 보기 ]
```

## 6. 상세 모달 (`StudioDetailModal`)

기존 `StationSearchSheet`와 동일한 반응형 패턴(모바일 바텀시트/데스크탑 모달, body scroll lock, Esc/backdrop 닫기) 재사용:
- 헤더: 합주실명 + 지역. 닫기.
- 정보: **도로명 주소**(+ `네이버 지도` 링크=map_url), 예약 방식, 편의(악기대여/주차/할인), 홈페이지/예약 링크(homepage_url 있을 때).
- **방 목록**: 방마다 — 이름 · 가격(₩/시간) · 수용인원 · **장비(타입별 그룹: 드럼/기타앰프/베이스앰프/키보드/그외 + 모델명)** · 후기.

## 7. 변경 / 무변경 범위

**신규:** `db/schema/020_*.sql`, `scripts/data/rehearsal-studios.csv`, `scripts/data/rehearsal-studio-coords.json`, `scripts/data/equipment-classification.json`, `scripts/import-rehearsal-studios.ts`, `src/lib/playground/rehearsal/rooms.ts`(방 조회), `src/app/playground/rehearsal-finder/StudioDetailModal.tsx`.
**수정:** `types.ts`(RoomEquipmentType+labels), `studios.ts`/`recommend.ts`/`ranker.ts`/`scoring.ts`(rooms 집계·travel-time 순위·응답 확장), `recommend/route.ts`·`studios/route.ts`(응답형), `RehearsalFinderClient.tsx`(카드 개선+모달 연결).
**무변경:** 역 검색/시트/초성·metroStations·데이터 보정·recommend 요청 스키마·dev 게이트.

## 8. 테스트

- **순수 단위테스트**: 장비 분류 적용 헬퍼(name→type, 미분류→ETC), 방 집계(price_min/max·capacity_max·타입 합집합), CSV 행→합주실/방 변환(공통접두사 추출·가격 파싱·주차 파싱)을 순수 함수로 빼 node:test.
- **임포트 검증(DEV)**: 합주실 20·방 47, 좌표 범위, 분류 누락 0(또는 로그), 트랜잭션 재실행 멱등.
- **빌드 스모크(DEV)**: build→restart→라우트 200→추천 e2e(카드에 가격대/방수/타입 칩)→자세히보기 모달(방·장비·주소·링크). 인터랙션 최종 확인은 사용자 dev.

## 9. 단순화 / 한계

- 추천은 **이동시간만**으로 순위(가격/인원/장비는 표시·필터 아님). 가격대 정렬 토글 등은 후속(YAGNI).
- 장비 타입 분류는 모델명 휴리스틱(커밋 맵) — 신규/오기 모델은 ETC로 떨어지고 로그로 표면화. 노션 색깔 메타는 CSV에 없어 미사용.
- 합주실 좌표/주소는 Naver 지역검색 1회 확보(일부 부정확 가능, mock 직선거리라 영향 미미).
- 동명/체인 분점(그루브 사당/방배)은 네이버 링크로 분리되므로 별도 합주실로 정확 처리.

## 작업 규칙 (MEMORY bandsustain)

`bandsustain-dev`(dev 브랜치, 포트 3101, DB `BANDSUSTAIN_DEV`)에서만. 모든 git/build/tsx는 `sudo -u ec2-user`. **DB 변경은 DEV 먼저**(스키마 020 + 임포트). dev push 후 멈추고 사용자 확인 — main 머지·PROD 반영은 명시 요청 시에만(그때 PROD DB에도 020+임포트 적용 필요). 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지.
