# Pedalboard Planner — UI 설계 (1차 릴리즈)

bandsustain `/playground/pedalboard-planner` 의 사용자 화면·데이터 흐름·API 설계. 카탈로그 스키마와 catalog import 는 이미 PROD 에 반영(Task 1+2, 2026-05-19; Task 3, 2026-05-20). 본 문서는 그 위에서 동작하는 사용자 인터페이스를 정의한다.

## 1. 범위

### 포함

- 카탈로그 페달 검색 + 보드 위 드래그 배치 + 자동 저장 + 공유 URL.
- 보드 선택 화면, 편집 화면, 공유 보기 화면, 내 명단 화면, public 갤러리 화면.
- visibility 3단계 (private / unlisted / public).
- 익명 `owner_token` 쿠키 기반 소유권.
- 모바일 우선 + 데스크탑 보조 (반응형 한 코드).

### 제외 (다음 사이클)

- `playground_custom_items` (사용자 자작 페달/보드 등록). 스키마는 이미 있고 UI 에서는 무시한다. 빈 보드 옵션도 없다.
- 회원 계정·로그인.
- OG 카드 동적 생성. 1차에는 기본 사이트 OG 만 노출.
- 페달 간 케이블 연결 시각화.
- 보드 PDF/이미지 내보내기.

## 2. 사용자 결정 사항 (브레인스토밍 합의)

| 결정 | 값 | 근거 |
|---|---|---|
| 디바이스 우선순위 | 모바일 우선, 데스크탑 보조 | 반응형 한 코드, 사이드 시트가 1024+ 에서 우측 고정 |
| 페달 검색 UX | 단일 검색바 + 브랜드 칩 필터 | 진입 부담 최저. 결과는 server-side LIKE 50개 + "더 보기" |
| 배치 정밀도 | 0.25 인치 snap | 모바일 손가락 친화. DB 의 DECIMAL(7,3) 정밀도는 유지하되 입력값만 snap |
| 회전 정책 | 0°/90°/180°/270° 4단계 | 케이블 방향 맞추기 충분. 자유 회전은 제외 |
| 페달 overlap | 허용 (z_order 로 앞뒤) | 스키마와 일치 |
| 첫 진입 | 보드 선택 화면 | "보드 위에 페달" mental model 명확 |
| 저장 | 1초 디바운스 자동 + 명시적 공유 | 익명 owner_token 에서 작업 분실 위험 최소화 |
| Visibility | private / unlisted / public 3단계 | public 갤러리 페이지 포함 |
| Drag·드래그 구현 | pointer events 직접 (의존성 0) | 자유 좌표 캔버스, dnd-kit drop-zone 패러다임은 부적합 |
| 카탈로그 검색 | server-driven LIKE on `search_name` | 8333 row + 인덱스, 풀 클라이언트 인덱스보다 가벼움 |
| 페이지 라우팅 | 다중 URL | App Router 자연, SEO·OG 분리 |

## 3. 페이지 라우트

| Route | Render | 역할 |
|---|---|---|
| `/playground/pedalboard-planner` | server | 보드 선택. 245 board grid + 검색바 + 브랜드 칩. 카드 탭 → POST `/api/playground/layouts` → 새 layout 생성 후 `/edit/<id>` redirect. 항상 **새 layout 시작**(기존 작업은 `/me` 에서 그대로 보존). 상단 [내 보드] [갤러리] 링크. |
| `/playground/pedalboard-planner/edit/[layoutId]` | client | 편집기. `owner_token` 일치 안 하면 403. 자동 저장. |
| `/playground/p/[shareToken]` | server | 공유 보기 (read-only). `snapshot_json` 으로 SSR. `visibility=private` 또는 토큰 미존재면 404. |
| `/playground/pedalboard-planner/me` | server | 내 보드 명단 (`owner_token` cookie 기준). grid + 썸네일 + 제목 + 수정일. |
| `/playground/pedalboard-planner/gallery` | server | public 갤러리. `visibility='public'` 최신순. 페이지네이션. |

`/playground/p/[shareToken]` 는 의도적으로 `/pedalboard-planner` 하위가 아닌 `/playground/p/` 에 둔다 — URL 길이 최소화, 향후 다른 playground 도구의 공유에도 재사용 가능.

## 4. 편집기 컴포넌트 분담

```
EditPage (client)
├── BoardCanvas           — 보드 이미지 + 페달들 (절대좌표). pointerdown/move/up.
│   └── PedalPiece × N    — 한 페달. position·rotation 표현. 탭 → select.
├── PedalSearchSheet      — 모바일 하단 50vh / PC 우측 360px 고정.
├── SelectedInspector     — 선택된 페달의 [회전] [앞] [뒤] [삭제] + 이름·치수.
├── TopBar                — [← 다른 보드] · 제목(인라인 편집) · [공유].
└── ShareSheet (modal)    — visibility 라디오 + URL + 카카오 + Web Share.
```

### 책임 분담

- `BoardCanvas` 만 좌표·드래그 상태를 안다. 다른 컴포넌트는 layout state(items 배열)와 dispatch 만 다룬다.
- `PedalSearchSheet` 는 카탈로그 검색·결과 그리드만. 탭 → "add item" dispatch.
- `SelectedInspector` 는 단일 선택된 item id 와 controls 뿐. 선택 해제 시 숨김.
- `ShareSheet` 는 layout 메타(title/visibility/share_token)만. 페달 목록 없음.
- 페달 추가 시 보드 중앙(또는 빈 자리 휴리스틱)에 배치 — 사용자가 모바일에서 드래그 안 해도 일단 들어감.
- `TopBar` 의 [← 다른 보드] 는 보드 선택 화면(`/playground/pedalboard-planner`)으로 이동. 현재 layout 의 board 는 **변경 불가** — 다른 board 를 쓰려면 거기서 새 layout 을 시작한다. 이유: 페달 좌표가 board 의 width/height 에 매여 있어 board 만 갈아끼우면 좌표 의미가 불확정.

### 모바일/PC 차이

- 같은 컴포넌트 트리. Tailwind `lg:` 분기로 sheet 위치/너비 변경.
- 모바일: pinch-zoom 가능. PC: 스크롤·키보드 단축키 없음(MVP).

## 5. 데이터 흐름

### owner_token

- 첫 사이트 진입 또는 첫 layout 생성 시 서버가 `playground_owner` 쿠키 발급. 32-hex random, `httpOnly` `SameSite=Lax` `Path=/playground` `Max-Age=10년`.
- 모든 mutate API 는 쿠키에서 추출한 owner_token 으로 `WHERE owner_token = ?` 강제.
- 쿠키 분실 = 작업 분실. 사용자가 공유 URL 을 북마크해두면 본인이 read-only 로 다시 볼 수는 있다. 편집은 안 됨. MVP 는 명시적 "내 작업 복구" 흐름을 만들지 않는다.

### 자동 저장

```
client state: { board, items[], title, visibility, dirty }
       │
       │ pointerup / item 추가 / 삭제 / 회전 / 제목 변경 / visibility 변경
       ▼
   set dirty = true
       │
       │ 1초 debounce
       ▼
   POST /api/playground/layouts/[id]/snapshot
   body: { title, visibility, items[], snapshot_json }
       │  (board 는 본문에 포함하지 않는다 — 변경 불가)
       ▼
   server: 트랜잭션
       1. UPDATE playground_layouts SET title, visibility, snapshot_json
          (board_kind / catalog_board_id 는 갱신 대상 아님)
       2. DELETE FROM playground_layout_items WHERE layout_id = ?
       3. INSERT items[] (bulk)
       COMMIT
       │
       ▼
   client: dirty = false, 우상단 "저장됨 · HH:mm"
```

- **DELETE + INSERT bulk**: items 개수가 작고(보통 < 50), partial diff sync 보다 정확하다.
- **snapshot_json**: 같은 트랜잭션 안에서 normalized rows 와 동일 JSON 동시 기록. 공유 보기 페이지는 snapshot_json 으로 한 번에 SSR 한다(JOIN 없음).
- **충돌**: owner_token 익명이라 멀티탭 race 가능. last-write-wins, 알림 없음. 모바일 단일 탭 가정.

### snapshot_json 포맷

```json
{
  "v": 1,
  "title": "메인 보드",
  "board": { "kind": "catalog", "id": 17, "brand": "Pedaltrain", "name": "Nano", "width_in": 14.0, "height_in": 3.0, "image_filename": "pedaltrain-nano.png" },
  "items": [
    { "kind": "catalog", "id": 1234, "x": 0.25, "y": 0.25, "rot": 0, "z": 0,
      "brand": "Boss", "name": "DS-1", "width_in": 2.87, "height_in": 4.72, "image_filename": "boss-ds-1.png" }
  ]
}
```

- `v: 1` 로 버전 고정. 추후 schema migration 여지.
- `kind`/`id`/`x`/`y`/`rot`/`z` 가 핵심. 나머지는 SSR fast path 용 캐시 — 카탈로그가 바뀌면 normalized rows JOIN 으로 재계산해 다시 snapshot 을 쓰면 된다(MVP 에서는 안 함).

## 6. API 엔드포인트

| Method · Path | 역할 | 권한 |
|---|---|---|
| `GET /api/playground/boards?q&brand_id&limit&offset` | 보드 검색 | public |
| `GET /api/playground/boards/brands?q` | 보드 브랜드 칩 (`is_active=1` boards 보유 brand) | public |
| `GET /api/playground/pedals?q&brand_id&limit&offset` | 페달 검색 | public |
| `GET /api/playground/pedals/brands?q` | 페달 브랜드 칩 | public |
| `POST /api/playground/layouts` | 새 layout 생성. board 선택 직후. 본문 `{ board_kind, catalog_board_id }`. default title `"Untitled YYYY-MM-DD HH:mm"`, visibility=`private`, share_token 자동 생성. 이후 board 는 변경 불가 | owner_token cookie 발급/사용 |
| `GET /api/playground/layouts/[id]` | 편집기 read (items 포함) | owner_token 일치 |
| `POST /api/playground/layouts/[id]/snapshot` | title/visibility/items/snapshot_json 전체 저장(트랜잭션). board 는 변경 불가 | owner_token 일치 |
| `DELETE /api/playground/layouts/[id]` | 삭제 | owner_token 일치 |
| `GET /api/playground/layouts/me?limit&offset` | 내 명단 | owner_token cookie |
| `GET /api/playground/layouts/public?limit&offset` | 갤러리 | public |

공유 보기(`/playground/p/[shareToken]`)는 서버 컴포넌트 안에서 직접 DB 조회 — API 거치지 않음.

## 7. Visibility 정책

| 값 | share_token URL | `/me` | `/gallery` | mutate |
|---|---|---|---|---|
| private | 404 (owner 외 차단) | ○ | ✕ | owner 만 |
| unlisted | ○ | ○ | ✕ | owner 만 |
| public | ○ | ○ | ○ | owner 만 |

- `share_token` 은 layout 생성 시 32-hex 자동 부여. visibility 변경해도 같은 token 유지(URL 안정).
- private 로 다시 내리면 그 token URL 즉시 404. share_token 회수/회전은 MVP 에 없음.
- private 의 응답을 404 로 통일(401 아님) — share_token 의 존재 자체를 누설하지 않는다.

## 8. 에러 처리

| 상황 | 동작 |
|---|---|
| owner_token cookie 미일치 (mutate API) | 403 + `{ error: "forbidden" }`. 클라 토스트 "다른 기기에서 만든 보드입니다" |
| owner_token cookie 미일치 (편집 페이지 진입) | 403 페이지로 — "공유 보기로 열려면 공유 링크를 받으세요" CTA |
| `share_token` 미존재 또는 private | 404 페이지 |
| catalog item `is_active=0` | 카탈로그 검색에서 제외. 이미 layout_items 에 있던 item 은 그대로 렌더 |
| `catalog_pedal_id` SET NULL (카탈로그 삭제) | "⚠ 삭제된 페달" placeholder. 사용자가 명시적으로 지울 수 있게 |
| 이미지 파일 누락 | `<img onerror>` placeholder SVG. 서버 영향 없음 |
| 자동 저장 fetch 실패 | 5초 후 재시도 1회. 그래도 실패 시 토스트 "저장 실패 — 다시 시도" + dirty 유지 |
| 검색 빈 결과 | "검색 결과 없음. 다른 키워드/브랜드를 시도해보세요" |
| 갤러리 빈 상태 | "공개 보드가 아직 없습니다" |
| 내 명단 빈 상태 | "아직 만든 보드가 없습니다 — 보드를 골라 시작해보세요" CTA |
| share_token URL 보기 (unlisted) + 다른 owner | 정상 보기. owner_token 비교는 편집 권한 판정용일 뿐 |
| DB 트랜잭션 실패 (snapshot) | 500. 클라 위와 같은 재시도 |

## 9. Invariants

스키마가 강제 못 하는 항목을 어플리케이션이 보장. 검증 스크립트로도 확인 가능.

1. **xor invariant**: `playground_layouts.board_kind='catalog'` ↔ `catalog_board_id IS NOT NULL AND custom_board_id IS NULL` (그리고 'custom' 의 역). `playground_layout_items` 도 동일.
   - 검증 SQL — 결과 0 행 기대:
     ```sql
     SELECT COUNT(*) FROM playground_layouts
     WHERE (board_kind='catalog' AND (catalog_board_id IS NULL OR custom_board_id IS NOT NULL))
        OR (board_kind='custom'  AND (custom_board_id  IS NULL OR catalog_board_id IS NOT NULL));
     ```
2. **snapshot/normalized sync**: `snapshot_json.items` 개수 == `COUNT(playground_layout_items WHERE layout_id=...)` (저장 트랜잭션이 둘을 함께 쓰므로 INSERT/UPDATE 직후만 보장).
3. **share_token 유일성**: `UNIQUE KEY uk_layout_share_token` (DDL 보장).
4. **visibility 게이트**: `visibility='private'` 인 layout 의 share_token URL → 404.
5. **mutate 권한**: cookie 의 owner_token ≠ DB owner_token → 403.

## 10. 테스트 전략

### vitest unit (`src/lib/playground*.test.ts`)

- `snap.ts`: `snapTo025(value)` — 음수, 0, 정확한 격자, 격자 사이 9 케이스.
- `rotate.ts`: 4단계 `rotateLeft/rotateRight` 한 바퀴.
- `owner-token.ts` / `share-token.ts`: 32-hex 생성·검증 정규식.
- `layout-serializer.ts`: items[] → snapshot_json round-trip (직렬화 → 역직렬화 = 원본).
- `visibility.ts`: `canViewLayout(layout, viewerToken)` — 3 visibility × {owner, other, no-cookie} = 9 케이스.

### vitest API integration (`src/app/api/playground/**/route.test.ts`)

- 각 엔드포인트 권한 매트릭스 (200 / 401 / 403 / 404).
- `POST /api/playground/layouts/[id]/snapshot` 트랜잭션 의미: invalid item 끼면 전체 롤백, 기존 items 보존.
- 검색 API: `q` 정상·빈문자·LIKE escape (`%`, `_`) 처리.
- limit/offset 페이지네이션 (경계값 0, 1, 큰 값).

### invariants 스크립트 (`scripts/playground-invariants.ts`)

- §9 의 5가지를 production DB 에 dry-run 으로 돌려 0 행 보장.
- `scripts/import-pedalplayground-catalog.ts` 의 `--creds=` 패턴 따름.

### 수동 검증

- pinch-zoom, drag latency, snap 체감 — 사용자 본인 모바일 실기기.
- 자동화 없음. UI verification 결과를 사용자가 확인.

## 11. 의존성·구현 메모

- pointer events 직접. dnd-kit 도입 안 함.
- 이미지: `public/playground/images/{pedals,pedalboards}/<filename>` — 이미 PROD 서버에 번들(3.0GB, .gitignore).
- 디자인 토큰: bandsustain `CLAUDE.md` 디자인 시스템 그대로 따름. 화이트 베이스 · 블랙 타이포 · 모노크롬 + 단일 액센트(`#2563FF`) · 직각 · 그림자/그라디언트 없음 · `font-display`(Archivo) 와 `font-sans`(Inter). `prefers-color-scheme: dark` 자동 분기 금지. 브레인스토밍 mockup 의 종이 톤(예: `#fdfaf3`) 은 그림 도구라 그렇게 그렸을 뿐, 실 구현에서는 사용하지 않는다.
- DB: 기존 mysql2 pool 패턴 재사용 (kim-yeongmin-bot 의 connect 헬퍼 참조).

## 12. 비-목표

- 페달 라이브러리 자작 등록(다음 사이클).
- 키보드 단축키, 멀티 셀렉트, 그룹 이동.
- 케이블/신호 흐름 시각화.
- 보드 외부 임시 트레이.
- 사용자 정의 보드 크기.
- 멀티 탭 / 멀티 디바이스 충돌 해결.
- 버전 history / undo-redo (브라우저 새로고침 시 자동 저장된 마지막 상태만).
