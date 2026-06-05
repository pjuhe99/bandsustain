# 합주실 admin 편집 강화 (방 단위 + 누락 필드 + 목록 개선) Design

> 네이버 임포트 64곳의 가격·방·악기 정보를 admin 에서 쉽게 채우고, 새 합주실을 손으로 추가/수정/삭제할 수 있게 한다. 기존 `/admin/rehearsal-studios` CRUD 를 확장.

## 1. 현황 / 문제

- 사용자 화면(카드·필터·모달)은 **방(`playground_studio_rooms`) 단위 데이터**(방별 가격/인원/장비 `equipment_json`)가 핵심인데 admin 폼은 방을 전혀 못 다룸.
- 020/021 에서 추가된 `road_address`·`phone`·`booking_method`·`amenities`·`homepage_url` 이 폼·`createStudio`/`updateStudio` UPDATE 쿼리에 없음 → **admin 저장 시 해당 값 유실 위험**(INSERT 는 NULL, UPDATE 는 보존되나 편집 불가).
- 목록 84곳에 검색·필터 없음 → 정보 없는 곳 골라 채우기 불편. 삭제 기능 없음.

## 2. 방 편집 (폼 동적 행)

- 폼에 **"방" fieldset**: 행마다 `이름 · 시간당 가격 · 인원 · 장비 텍스트(쉼표 구분 한 줄) · 후기(선택)` + 행 삭제, `+ 방 추가`. 행 순서 = `sort_order`.
- **장비 텍스트 → 자동 분류**: 저장 시 서버에서 기존 `classifyGearList`(140개 맵, 노션 임포트와 동일)로 `RoomGear[]` 생성. 폼에는 입력 아래 **실시간 분류 미리보기 칩**(클라이언트에서 같은 순수함수 재사용 — `ROOM_EQUIPMENT_LABELS`, 미분류는 "그외"로 보임).
- 편집 진입 시 기존 `room.equipment` → `name` 들을 쉼표로 join 해 텍스트 복원(라운드트립).
- 저장 = 방 전체 교체(`replaceRooms`: DELETE→INSERT, 트랜잭션 불요한 단순 교체 — 방은 외부 참조 없음).

## 3. 파생 필드 자동화

- 저장 시 **방이 1개 이상이면** `hourly_price_min/max` = 방 가격 min/max(가격 null 인 방 제외), `max_capacity` = 방 인원 max — 노션 임포트와 동일 규칙. 해당 폼 입력엔 "방이 있으면 자동 계산" 안내(입력값 무시됨).
- **방이 없으면** 폼 입력값 그대로 (비우면 NULL → 사용자 화면 "정보 없음").
- `min_capacity` 는 폼 값 유지(파생 안 함).

## 4. 누락 필드 + legacy 정리

- `StudioWriteInput`/Zod/폼/INSERT/UPDATE 에 `phone`·`roadAddress`·`bookingMethod`·`amenities`·`homepageUrl` 추가.
- legacy "보유 장비"(합주실 단위 `playground_studio_equipment`) fieldset 은 폼에서 **제거** — 사용자 화면은 방 장비만 사용. 데이터/테이블은 보존(서버 코드의 equipment 인자는 빈 배열 전달 시 기존 행 삭제되므로, **폼 제거 시 기존 equipment 를 그대로 재전송**하지 않고 `replaceEquipment 호출을 생략**하도록 write 함수 시그니처 조정(equipment 옵셔널, undefined 면 미변경).

## 5. 목록 개선 + 삭제

- 목록 페이지에 GET `searchParams`: `q`(이름 부분일치)·`source`(notion-import/naver-map-import/manual=그 외)·`noinfo=1`(방 0개) — 서버 컴포넌트에서 `listStudios({})` 후 in-memory 필터(84건 규모라 충분).
- 컬럼: 이름 / 지역(`areaLabel`) / 가격(min~max, 없으면 "정보 없음") / **방 수** / 상태 / 동작(편집·삭제). 정보 없는 행은 muted 뱃지.
- **삭제**: 행별 삭제 버튼(server action + `confirm`) — `DELETE FROM playground_studios WHERE id=?` (rooms/equipment CASCADE).

## 6. 테스트 / 검증

- 순수 단위테스트: 방 폼 파싱+파생(`parseRoomsFromForm`/`deriveStudioStats` — 가격 min/max·null 방 제외·인원 max·빈 방 배열), 장비 텍스트 라운드트립.
- tsc + build + admin 페이지 응답(비로그인 → 로그인 리다이렉트 = 라우트 생존) + tsx 스크립트로 DEV DB 에 createStudio(방 포함)→getStudioById 검증→삭제 라운드트립 (⚠️ `DB_CREDENTIALS_PATH` DEV 명시 — creds.ts DEFAULT_PATH 가 PROD).
- 최종 수동 확인: dev.bandsustain.com/admin — 네이버 합주실 하나에 방 2개 입력→사용자 화면 카드/필터 반영.

## 7. 범위 외

- 네이버 수동 복사본(231곳) 임포트 — 보류. DB 스키마 변경 없음. regions/legacy equipment 테이블 정리 없음.

## 작업 규칙 (MEMORY bandsustain)

`bandsustain-dev`(dev, 포트 3101)에서만. 모든 git/build/tsx 는 `sudo -u ec2-user`. dev push 후 멈추고 사용자 확인. 새 파일 커밋 전 `chown ec2-user:ec2-user`. `git add .` 금지.
