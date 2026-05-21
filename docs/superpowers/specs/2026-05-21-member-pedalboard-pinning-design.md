# Member Pedalboard Pinning Design

## Goal

`/playground/pedalboard-planner/gallery` 페이지에 **서스테인 멤버들의 페달보드를 별도 코너로 고정 노출**한다. 멤버 페달보드는 일반 사용자와 동일하게 `/playground/pedalboard-planner` 에서 만들고, 어드민이 layout id 와 멤버를 짝지어 핀으로 등록한다. 핀별로 override 타이틀과 캡션을 따로 둘 수 있고, 어드민이 ▲/▼ 로 노출 순서를 정한다.

## Scope

포함:

- 신규 테이블 `playground_member_pins` (마이그 016)
- `src/lib/playground/memberPins.ts` 신규 모듈 (server-only)
- `src/app/admin/(authed)/pedalboard-pins/` 신규 admin 메뉴 (목록 + 신규 등록 인라인 폼 + 단일 핀 편집 페이지)
- 갤러리 페이지 (`/playground/pedalboard-planner/gallery/page.tsx`) 를 "멤버 페달보드 + 최근 공개 보드" 두 섹션 구조로 개편
- `/playground/p/[shareToken]` 노출 정책 변경 — 핀된 layout 은 visibility `private`/`unlisted` 라도 통과
- 새 admin 사이드바 항목 ("Pedalboard Pins")

제외:

- 멤버별 핀 필터 / 검색 UI (멤버 페이지에서 그 멤버의 핀 한눈에 보기 등)
- 핀 row 의 audit log (어드민 1인 운영 가정)
- 핀 일괄 import / CSV
- 갤러리에서 멤버 핀 별도 페이지(전용 라우트)
- 다크모드 변형 (CLAUDE.md 의 화이트 베이스 원칙 그대로)
- 멤버 admin 페이지 안에 "이 멤버의 핀 N개" 요약 (필요해지면 별도 작업)

## Behavior

### 핀의 정의

- 핀 = `(layout_id, member_id)` 1쌍 + override_title / caption / pin_order 메타
- 같은 layout 을 둘 이상의 멤버가 공유해서 각자 자신의 핀으로 등록 가능 (콜라보 케이스)
- 같은 멤버가 같은 layout 을 두 번 등록하는 것은 금지 (UNIQUE)
- 핀의 layout 이 가리키는 `playground_layouts` 원본은 핀과 무관하게 사용자(`owner_token`)에게 계속 귀속됨. 핀은 큐레이션 메타이지 소유권 이전이 아님.
- 핀 삭제는 원본 layout 을 건드리지 않음. 원본 layout 삭제(/me 에서 사용자 본인 또는 admin)는 FK CASCADE 로 핀도 함께 사라짐.

### 노출 정책

갤러리 페이지(`/playground/pedalboard-planner/gallery`) 는 두 섹션:

1. **상단 — "서스테인 멤버 페달보드"**
   - `playground_member_pins` JOIN `playground_layouts` JOIN `members(published=1)`
   - `pin_order ASC, pins.id ASC` 정렬
   - 연속된 동일 멤버를 그룹으로 묶어 멤버 헤더(사진 + 이름 + 포지션) 아래에 카드 N개 배치
   - 멤버가 `published=0` 이면 그 멤버의 핀들도 자동 제외 (JOIN 조건)
   - 핀 0개면 섹션 자체를 렌더하지 않음

2. **하단 — "최근 공개 보드"**
   - 기존 갤러리 쿼리에 `AND l.id NOT IN (SELECT layout_id FROM playground_member_pins)` 추가
   - LIMIT 50 은 핀 제외 후 적용
   - 핀 1개 이상일 때만 작은 섹션 헤더("최근 공개 보드") 노출. 핀 0개면 현재 모양 그대로(헤더 없음).

`/playground/p/[shareToken]`:

- 원본 visibility 가 `public` → 기존대로 통과
- 원본 visibility 가 `unlisted` → 토큰 있으면 통과 (기존 동작 유지)
- 원본 visibility 가 `private` → 기본은 404 였지만, **핀 row 가 존재하면 통과**
- 핀 해제하면 (admin 삭제) private 원본은 즉시 다시 404 — 의도된 부수효과
- OG 이미지(`opengraph-image.tsx`) 도 동일 정책

### Admin 동작 (`/admin/pedalboard-pins`)

목록 + 신규 등록 인라인 폼이 한 페이지에 함께. 단일 핀 편집은 `[id]/page.tsx` 로 분리.

신규 등록 폼:

- 멤버 select: `getAllMembersForAdmin()` 전체 (published=0 멤버도 선택 가능)
- Layout ID: 숫자 입력 + 우측 [확인] 버튼 → server action `lookupLayoutForPin(id)` 호출 → 아래에 1줄 미리보기 (`✓ Layout #12345 · "Trent's Drive Rig" · Pedaltrain Classic JR · @2026-04-21`)
- override_title: 비워두면 원본 layout.title 사용. 200자 한도.
- caption: 200자 한도 (DB 컬럼은 280자 여유).
- [+ 추가] 클릭 시 server action `createMemberPin` — 미존재/UNIQUE 위반/길이 초과 모두 사용자 친화 에러 메시지.

목록 표:

- 컬럼: ▲▼ | 사진 | 멤버 | layout id | 보드 | 제목(override fallback layout) | 캡션 | 편집 | 삭제
- ▲/▼ 는 `swapMemberPinOrder(id, dir)` server action — 인접 row 와 `pin_order` 값 교환. 첫/마지막 row 는 버튼 disabled.
- 편집 → `[id]/page.tsx` (멤버 변경 / override_title / caption 수정. layout_id 는 read-only — 다른 layout 핀하려면 삭제 후 재등록).
- 삭제 → 확인 없는 즉시 삭제 (기존 members admin 패턴 따름).

### Caption / Override Title 입력 정규화

`normalizePinInput` 헬퍼:

- trim → 빈 문자열이면 `null`
- 줄바꿈 문자(`\r\n`, `\n`, `\r`) 는 단일 공백으로 collapse (카드 줄 깨짐 방지)
- 200자 / 280자 boundary 는 입력 검증 단계에서 차단

## Data Model

신규 마이그레이션: `db/schema/016_member_pedalboard_pins.sql`

```sql
-- 016_member_pedalboard_pins.sql
-- /playground/pedalboard-planner/gallery 멤버 페달보드 핀
-- 수동 실행: mysql ... < db/schema/016_member_pedalboard_pins.sql

CREATE TABLE IF NOT EXISTS playground_member_pins (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  layout_id       BIGINT UNSIGNED NOT NULL,
  member_id       INT UNSIGNED    NOT NULL,
  override_title  VARCHAR(200)    NULL,
  caption         VARCHAR(280)    NULL,
  pin_order       INT             NOT NULL DEFAULT 0,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pin_layout_member (layout_id, member_id),
  KEY idx_pin_order (pin_order, id),
  KEY idx_pin_member (member_id),
  CONSTRAINT fk_pin_layout FOREIGN KEY (layout_id)
    REFERENCES playground_layouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pin_member FOREIGN KEY (member_id)
    REFERENCES members(id)            ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

가설: `members.id` 가 `INT UNSIGNED` 라는 전제. 실제 컬럼 타입이 다를 경우 (예: 부호 있는 INT) 마이그 작성 단계에서 동일 타입으로 맞춘다. `members` 테이블 생성 마이그 (`002_members.sql`) 확인 후 결정.

### 불변식 (애플리케이션 layer)

- `pin_order ASC, id ASC` 가 안정 정렬
- 갤러리 1차 정렬 = `pin_order`, 멤버 그룹 헤더는 "연속된 동일 멤버" 를 묶음 (강제 멤버별 재정렬 안 함)
- `override_title` 이 NULL 이거나 trim 후 빈 문자열이면 `layout.title` 을 사용
- `caption` 이 trim 후 빈 문자열이면 NULL 저장 (조회 시 NULL 또는 ""을 동일하게 "없음" 으로 처리)

## Backend Module

`src/lib/playground/memberPins.ts` (server-only, 기존 `members.ts` / `playgroundDb.ts` 패턴).

### 공개 API

```ts
// 갤러리 핀 코너용 — published 멤버 + pin_order 정렬
export async function getPublishedMemberPins(): Promise<MemberPinView[]>;

// admin 목록 — 비공개 멤버/원본 layout 메타 포함
export async function getAllMemberPinsForAdmin(): Promise<AdminPin[]>;

// admin 생성/수정/삭제
export async function createMemberPin(input: NewPinInput): Promise<{ id: bigint }>;
export async function updateMemberPin(id: bigint, patch: PinPatch): Promise<void>;
export async function deleteMemberPin(id: bigint): Promise<void>;

// admin swap (▲/▼) — 단일 트랜잭션에서 인접 row 두 개 pin_order 교환
export async function swapMemberPinOrder(id: bigint, dir: "up" | "down"): Promise<void>;

// admin 검증: 입력받은 layout_id 존재 + 미리보기 메타 반환 (없으면 null)
export async function lookupLayoutForPin(layoutId: bigint): Promise<LayoutLookup | null>;

// 갤러리 "최근 공개 보드" 섹션에서 핀 layout_id 제외용
export async function getPinnedLayoutIds(): Promise<Set<bigint>>;

// /playground/p/[shareToken] 노출 정책에서 사용 — pins 테이블에 해당 layout 이 있는지
export async function isLayoutPinned(layoutId: bigint): Promise<boolean>;
```

### `MemberPinView` 모양 (DB row → 카드 props)

```ts
type MemberPinView = {
  pin_id: number;
  layout_id: number;
  share_token: string;
  title: string;              // override_title?.trim() || layout.title
  caption: string | null;     // trim 후 "" 이면 null
  pin_order: number;
  member: {
    id: number;
    nameKr: string;
    nameEn: string;
    position: string;
    photoUrl: string;
  };
  board: {
    image_filename: string | null;
    name: string;             // LEFT JOIN 결과 NULL 이면 "보드 정보 없음"
    brand: string;            // LEFT JOIN 결과 NULL 이면 ""
  };
  updated_at: Date;
};
```

### 핵심 쿼리 — `getPublishedMemberPins`

```sql
SELECT p.id           AS pin_id,
       p.layout_id,
       p.override_title,
       p.caption,
       p.pin_order,
       p.updated_at,
       l.share_token,
       l.title        AS layout_title,
       b.image_filename AS board_image_filename,
       b.name           AS board_name,
       br.name          AS board_brand,
       m.id             AS member_id,
       m.name_kr,
       m.name_en,
       m.position,
       m.photo_url
  FROM playground_member_pins p
  JOIN playground_layouts l       ON l.id = p.layout_id
  JOIN members m                  ON m.id = p.member_id AND m.published = 1
  LEFT JOIN playground_boards b   ON b.id = l.catalog_board_id
  LEFT JOIN playground_board_brands br ON br.id = b.brand_id
 WHERE l.snapshot_json IS NOT NULL
 ORDER BY p.pin_order ASC, p.id ASC;
```

행 1개당 1 카드. `m.published = 1` 을 JOIN 조건에 두어 비공개 멤버의 핀 자동 제외. `snapshot_json IS NOT NULL` 가드로 깨진 핀(스냅샷 없는 layout 가리키는 경우)도 silent skip.

### 갤러리 두 번째 섹션 — 핀 제외

기존 `loadPublic` 의 WHERE 절에 `AND l.id NOT IN (SELECT layout_id FROM playground_member_pins)` 를 추가하고 LIMIT 50 을 그대로 둠.

또는 (성능 동일, 가독성 차이): `getPinnedLayoutIds()` 로 Set 받아 `WHERE l.id NOT IN (...)` 에 IN list 로 바인딩.

### `/playground/p/[shareToken]` 노출 정책

```ts
async function loadLayout(token: string) {
  if (!isValidToken(token)) return null;
  const row = await getLayoutByShareToken(token);
  if (!row) return null;
  if (!row.snapshot_json) return null;

  if (row.visibility === 'private') {
    const pinned = await isLayoutPinned(BigInt(row.id));
    if (!pinned) return null;
  }
  // public / unlisted 는 기존 동작 그대로 (unlisted 는 토큰 있으면 통과)
  try {
    return { row, layout: parseSnapshot(row.snapshot_json) };
  } catch { return null; }
}
```

OG 이미지 `opengraph-image.tsx` 도 동일 정책 적용.

## UI

### `/admin/(authed)/pedalboard-pins`

**파일 구성**

```
src/app/admin/(authed)/pedalboard-pins/
  page.tsx        # 핀 목록 + 신규 등록 인라인 폼
  actions.ts      # createPin / updatePin / deletePin / swapPinOrder server actions
  [id]/page.tsx   # 단일 핀 편집
```

좌측 사이드바 (`src/app/admin/(authed)/layout.tsx`) 에 항목 1개 추가: `Pedalboard Pins → /admin/pedalboard-pins`.

**목록 페이지 골격**

```
┌─────────────────────────────────────────────┐
│  Pedalboard Pins                            │
├─ 신규 등록 ────────────────────────────────│
│   멤버: [select]                            │
│   Layout ID: [_____] [확인]                 │
│   ↳ ✓ Layout #12345 · "Drive Rig" · ...    │
│   Override 타이틀: [_______________]        │
│   캡션 (200자): [_________________]         │
│   [+ 추가]                                  │
├─ 목록 (pin_order ASC) ─────────────────────│
│  [▲][▼]│사진│멤버│layout│보드│제목│캡션│[편집][삭제]
│  ...                                        │
└─────────────────────────────────────────────┘
```

**편집 페이지 (`[id]/page.tsx`)**

- 상단: 원본 layout 메타 (read-only) + `/p/{share_token}` 링크
- 폼: 멤버 select / override_title / caption / [저장] / [삭제]
- layout_id 변경 불가 (다른 layout 으로 옮기려면 삭제 후 재등록)

### 갤러리 페이지 개편 — `src/app/playground/pedalboard-planner/gallery/page.tsx`

```
┌─ <header>: 갤러리 + nav (보드 고르기 / 내 보드)     ┐
│                                                      │
│  서스테인 멤버 페달보드  (핀 1개 이상일 때만 렌더)   │
│  ───────────────────────                             │
│  ┌─ 멤버 그룹 (연속 동일 멤버 묶음) ─────┐           │
│  │  [photo] Brody · Drums                │           │
│  │  ┌──┐ ┌──┐ ┌──┐                       │           │
│  │  └──┘ └──┘ └──┘  ← MemberPinCard      │           │
│  └─────────────────────────────────────────┘         │
│  ┌─ 다음 멤버 ───────────────────────────┐           │
│  │  [photo] Sora · Guitar                │           │
│  │  ┌──┐                                  │           │
│  │  └──┘                                  │           │
│  └─────────────────────────────────────────┘         │
│                                                      │
│  ── 구분선 (py-12) ──                                │
│                                                      │
│  최근 공개 보드  (핀 1개 이상일 때만 헤더 노출)      │
│  ─────────────                                       │
│  [기존 LayoutGrid 50개, 핀 layout_id 제외]          │
└──────────────────────────────────────────────────────┘
```

**컴포넌트**

- `src/components/playground/pedalboard/MemberPinCard.tsx` 신규
  - 위쪽: 기존 LayoutCard 와 동일한 보드 썸네일 + 제목(`override_title ?? layout_title`) + 보드 메타
  - 제목 아래 caption 한 줄 (있을 때만, `text-sm text-[var(--color-text-muted)]`, `line-clamp-2`)
  - 카드 전체 `<Link href={`/playground/p/${share_token}`}>`
- `src/components/playground/pedalboard/MemberPinSection.tsx` 신규
  - 멤버 그룹 헤더(사진 48×48 사각형 + 이름 + 포지션) + 그 그룹 카드 grid
  - 디자인 톤: CLAUDE.md 화이트 베이스, rounded 없음, shadow 없음

**그룹화**

```ts
// pin_order 정렬 유지하며 연속 동일 멤버를 그룹으로 묶기
function groupConsecutiveBy<T, K>(items: T[], key: (t: T) => K): { key: K; items: T[] }[];
```

별도 `src/lib/playground/groupConsecutive.ts` 로 분리 (테스트 가능).

## Error Handling

### Admin server action 에러 메시지

- Layout id 미존재 → `"layout id #{입력값}는 존재하지 않습니다"`
- UNIQUE (layout_id, member_id) 위반 → `"이 멤버에게 이미 등록된 페달보드입니다 (pin #{기존id})"`
- override_title 200자 초과 → `"제목은 200자 이내로 입력해주세요"`
- caption 200자 초과 → `"캡션은 200자 이내로 입력해주세요"`
- 멤버 select 에서 미존재 id → `"멤버를 다시 선택해주세요"`
- ▲/▼ swap 에서 인접 row 없음 → 버튼이 이미 disabled. 그래도 도달하면 silent no-op (throw 안 함).

### 갤러리 정상 처리

- 핀이 가리키는 layout 의 `snapshot_json IS NULL` → `getPublishedMemberPins` 쿼리에서 자동 제외 (`WHERE l.snapshot_json IS NOT NULL`)
- `playground_boards` LEFT JOIN NULL → board name `"보드 정보 없음"` 으로 표시
- 멤버 `published=0` → 자동 제외 (JOIN 조건)

### 경합 / 트랜잭션

- ▲/▼ swap 은 단일 트랜잭션 안에서 인접 row 두 개 UPDATE
- 두 admin 동시 swap 은 1인 운영 가정상 무시

### FK CASCADE

- 멤버 삭제 → 그 멤버의 모든 핀 자동 cascade (현재 members admin 에 hard delete UI 없음. 추가될 때 핀 개수 사전 경고 고려)
- 원본 layout 삭제(/me 사용자 본인 또는 admin) → 핀 자동 cascade (의도된 동작)

## Tests

### 단위 (vitest)

`src/lib/playground/groupConsecutive.test.ts`:
- 빈 배열 → `[]`
- 단일 멤버 N개 → 1 그룹
- A·A·B·A → 3 그룹 (admin 의 의도 존중)
- 키가 같은 객체끼리 grouping (참조 비교 아님)

`src/lib/playground/memberPins.test.ts` — `normalizePinInput` (pure helper):
- `undefined` / `""` / `"   "` → `null`
- `"  hi  \nworld  "` → `"hi world"` (줄바꿈 collapse + trim)
- 200자 boundary (title) / 280자 boundary (caption DB)
- 입력 검증 측 200자 boundary (caption)

### 통합 검증 스크립트

`scripts/verify-member-pins.ts` (기존 verify 패턴):
1. 모든 pin 의 layout_id 가 `playground_layouts` 에 존재 (orphan 0)
2. 모든 pin 의 member_id 가 `members` 에 존재 (orphan 0)
3. UNIQUE (layout_id, member_id) 위반 0
4. 모든 pin 의 layout 이 `snapshot_json IS NOT NULL`
5. `published=0` 멤버의 핀이 있는 경우 경고 출력 (오류 아님 — 의도된 임시 상태일 수 있음)

### HTTP smoke (배포 직후)

- `GET /playground/pedalboard-planner/gallery` → 200
- 핀 1개 등록 후 갤러리 HTML 에서 멤버 이름·override 타이틀·caption 등장
- 핀된 private layout 의 `GET /playground/p/{share_token}` → 200
- 핀 삭제 후 같은 URL → 404
- `GET /admin/pedalboard-pins` (admin 인증 상태) → 200

### 회귀 가드 (수동 시각)

- 핀 등록 시 두 번째 섹션에서 그 layout 이 사라지고 첫 번째 섹션에 등장 (id 기준 중복 없음)
- 핀 0개 상태에서 페이지 모양이 현재 모양과 동일

## Out of Scope (재확인)

- 멤버 페이지(`/members`) 에 그 멤버의 핀 보여주기 — 다음 작업으로
- 핀 일괄 import / CSV — 운영 규모상 1~수십 개이므로 GUI 등록으로 충분
- 핀 row audit log — 1인 어드민 운영
- 갤러리 무한 스크롤 / 페이지네이션 — 50개 LIMIT 유지
- 핀 카드의 별도 디자인 시안 — 기존 LayoutCard 톤 그대로 + caption 한 줄 추가

## Dependencies / Open Questions

- `members.id` 타입 (`INT UNSIGNED` 가정) — 마이그 작성 시 `db/schema/002_members.sql` 확인 후 동일 타입으로 FK 잡기
- 좌측 사이드바 (`src/app/admin/(authed)/layout.tsx`) 항목 추가 — 다른 admin 메뉴와 동일 패턴 따름
- `LayoutCard` / `LayoutGrid` 컴포넌트 구조 — `MemberPinCard` 가 비주얼 톤을 맞추기 위해 작성 시 정확한 인터페이스 확인
