# /live 탭 + 어드민 디자인 — Spec

**작성일:** 2026-05-08
**대상:** bandsustain.com `/live` 공개 페이지 + `/admin/live` CRUD
**참고:** [oasisinet.com/live](https://www.oasisinet.com/live/) — 행 단위 리스트, Past Shows에 영상 ▶
**스코프 제외:** 실시간 좌석 잔여, 다국어, 임베드 플레이어

---

## 사용자가 확정한 결정 (Q&A)

| Q | 결정 |
|---|------|
| Q1 필드 구성 | **기본형** — 날짜·공연장·도시·티켓링크·영상링크. 시각/국가/포스터/메모 없음 |
| Q2 과거 노출 | **연도별 그룹** — 전체 노출, 연도 헤더로 시각 구분 (oasisinet 패턴) |
| Q3 시각 정보 | 안 받음 — `event_date`(DATE)만 |
| Q4 영상 클릭 동작 | 새 탭으로 유튜브 이동 (임베드 모달 없음) |
| Q5 오늘 공연 처리 | Upcoming에 유지, KST 자정 지나면 Past로 자연 이동 |
| Q6 어드민 대시보드 카드 | 5개 카드 그리드 (members/songs/news/quotes/**live**) |

---

## 1. 아키텍처

기존 `/admin` Spec(2026-04-27)의 News 패턴을 그대로 미러링한다. 새 리소스 1개를 추가하는 작업.

```
public:  /live  ────► src/lib/live.ts  ────► MariaDB live_events
                                              ▲
admin:   /admin/live, /new, /[id]  ────►  Server Actions (actions.ts)
                                              │
대시보드:  /admin (5번째 카드 추가)            │
                                              ▼
                                         live_events 테이블
```

기존 패턴과 동일한 점:
- `force-dynamic` SSR
- httpOnly 세션 쿠키 인증 (`/admin/(authed)` layout가 처리 — 신규 작업 없음)
- Zod 스키마 + Server Actions
- 소프트 삭제 (`published` 토글)
- HTML 표 + 행 단위 액션 (어드민)
- lib 도메인 타입(camelCase) + DB→도메인 매핑

---

## 2. DB 스키마 — `db/schema/005_live_events.sql`

```sql
-- 005_live_events.sql
-- bandsustain.com /live 탭 — 공연 일정(예정 + 과거)

CREATE TABLE IF NOT EXISTS live_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  event_date  DATE          NOT NULL,             -- KST 기준 공연일
  venue       VARCHAR(200)  NOT NULL,             -- 예: "Yes24 Live Hall"
  city        VARCHAR(100)  NOT NULL,             -- 예: "Seoul"
  ticket_url  VARCHAR(500)  NULL,                 -- 예매 링크 (예정 공연용)
  video_url   VARCHAR(500)  NULL,                 -- 외부 영상 링크 (과거 공연용, 유튜브/인스타 등)
  published   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_date (published, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

설계 노트:
- `ticket_url`·`video_url` 모두 nullable. 같은 row가 시간 흐름에 따라 예정→과거로 이동(자동), 과거가 된 뒤 영상 링크를 추가 입력하면 ▶ 노출
- 시각(시간) 컬럼 없음. 필요해지면 후속 마이그레이션
- 인덱스: `(published, event_date)` — 공개 페이지의 두 쿼리(upcoming asc / past desc)를 모두 커버

---

## 3. Upcoming vs Past 분기 — KST 경계

서버 시간대는 운영 정책상 어떻게 설정되든 의존하지 않는다. 매 SSR마다 `Asia/Seoul` 기준의 "오늘"을 계산해서 비교.

```ts
// src/lib/live.ts (개념 코드)
function todayKST(): string {
  // YYYY-MM-DD (Asia/Seoul)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
```

분기 규칙:
- `event_date >= todayKST()` → **Upcoming** (오름차순, 가까운 날짜 위)
- `event_date <  todayKST()` → **Past** (내림차순, 최신 위)
- 오늘(`event_date === todayKST()`)은 Upcoming의 첫 줄에 머무름. KST 자정을 넘기면 다음 SSR에서 자동으로 Past 최상단으로 이동
- 모두 `WHERE published = 1`

---

## 4. lib 모듈 — `src/lib/live.ts`

도메인 타입과 데이터 함수를 한 파일로 모은다 (다른 리소스와 동일 패턴).

```ts
export type LiveEvent = {
  id: number;
  eventDate: string;     // "YYYY-MM-DD" (KST)
  venue: string;
  city: string;
  ticketUrl: string | null;
  videoUrl: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// 공개 페이지용 (published=1만)
export async function getUpcomingEvents(): Promise<LiveEvent[]>;
export async function getPastEventsByYear(): Promise<Map<number, LiveEvent[]>>;

// 어드민용 (전체)
export async function listAllLiveEvents(): Promise<LiveEvent[]>;
export async function getLiveEvent(id: number): Promise<LiveEvent | null>;
export async function countLiveEvents(): Promise<number>;
export async function createLiveEvent(input: LiveEventInput): Promise<number>;
export async function updateLiveEvent(id: number, input: LiveEventInput): Promise<void>;
export async function setLiveEventPublished(id: number, published: boolean): Promise<void>;
```

`getPastEventsByYear()`는 `event_date DESC`로 한 번에 가져와서 메모리에서 연도별 `Map`을 만든다. 페이지에서 `[...map.entries()]`로 그대로 렌더 가능. 매년 12건 미만 가정에서 페이지네이션 불필요.

---

## 5. 공개 페이지 — `src/app/live/page.tsx`

레이아웃 구성:

```
┌─ Hero (h1 LIVE) ──────────────────────┐
│   서브카피 1줄                         │
└────────────────────────────────────────┘

┌─ Upcoming Shows ──────────────────────┐  ← upcoming.length > 0 일 때만
│   섹션 라벨: "UPCOMING SHOWS"          │
│   ─────────────────────────────────── │
│   MAY 24 · 2026   Yes24 Live Hall     │
│                   Seoul    [Tickets]  │
│   ─────────────────────────────────── │
│   JUN 12 · 2026   Rolling Hall        │
│                   Seoul    [Tickets]  │
└────────────────────────────────────────┘

┌─ Past Shows ──────────────────────────┐
│   섹션 라벨: "PAST SHOWS"              │
│                                        │
│   2026                                 │
│   ─────────────────────────────────── │
│   MAR 18   Sangsang Madang   Seoul ▶  │  ← video_url 있을 때만
│   FEB 02   Strange Fruit     Seoul    │
│                                        │
│   2025                                 │
│   ─────────────────────────────────── │
│   DEC 14   Club FF           Seoul ▶  │
│   …                                    │
└────────────────────────────────────────┘
```

행 마크업 원칙:
- 데스크톱: `grid-cols-[120px_1fr_120px_40px]` (날짜 / 공연장+도시 / 액션 / ▶) 정렬
- 모바일(<md): 날짜 위, 공연장·도시 다음, 액션 줄 마지막으로 stack
- `[Tickets]` 버튼: `<a href={ticketUrl} target="_blank" rel="noopener">` — `ticket_url`이 null이면 노출 안 함 (예매 시작 전이면 행만 보임)
- ▶ 버튼: `<a href={videoUrl} target="_blank" rel="noopener" aria-label="Watch video">` — `video_url`이 null이면 자리만 비움 (정렬 흐트러지지 않게)
- 빈 상태:
  - upcoming만 0건 → Upcoming 섹션 통째 숨김
  - past만 0건 → Past 섹션 자리에 "공연 일정 준비 중" 1줄
  - 둘 다 0건 → "Coming soon." (현재 placeholder 유지 효과)

날짜 포매팅: `MAY 24` (M월 d일, 영문 약어 대문자) / Past 헤더는 `2026` 같은 4자리 연도. `Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", timeZone: "Asia/Seoul" })`로 SSR에서 생성.

메타데이터:
- `metadata.title`: "Live"
- `metadata.description`: "Band Sustain 공연 일정 — 예정 공연과 지나간 라이브."
- og/twitter: 기존 `/slides/hero-b4d9e516.jpg` 그대로 재사용

---

## 6. 어드민 — `/admin/live`

### 6.1 라우트
- `src/app/admin/(authed)/live/page.tsx` — 리스트 표
- `src/app/admin/(authed)/live/new/page.tsx` — 신규 폼
- `src/app/admin/(authed)/live/[id]/page.tsx` — 수정/삭제(=published 토글)
- `src/app/admin/(authed)/live/actions.ts` — Server Actions + Zod 스키마

### 6.2 리스트 표

| 날짜 | 시각 구분 | 공연장 | 도시 | 영상 | 공개 | 액션 |
|------|-----------|--------|------|------|------|------|
| 2026-06-12 | Upcoming | Rolling Hall | Seoul | — | ✓ | 편집 |
| 2026-05-24 | Upcoming | Yes24 Live Hall | Seoul | — | ✓ | 편집 |
| 2026-03-18 | Past     | Sangsang Madang | Seoul | ▶ | ✓ | 편집 |
| 2026-02-02 | Past     | Strange Fruit | Seoul | — | ✓ | 편집 |

- 정렬: `event_date DESC`
- "시각 구분" 칼럼은 SSR에서 `event_date` vs `todayKST()` 비교로 라벨링 (DB 컬럼 아님)
- 표 위에 `[+ 새 공연 등록]` 버튼

### 6.3 폼 (new / edit 공통)

```
공연 일자       [date input, required]
공연장          [text, required, max 200]
도시            [text, required, max 100]
티켓 URL        [url, optional, max 500, https 권장]
영상 URL        [url, optional, max 500, 도메인 제한 없음 — 유튜브/인스타/페북 등 자유]
공개            [checkbox, default 체크]

[저장]  [취소]
```

검증 (`actions.ts`의 Zod 스키마):
```ts
const LiveEventSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  ticketUrl: z.string().url().max(500).nullable().or(z.literal("").transform(() => null)),
  videoUrl: z.string().url().max(500).nullable().or(z.literal("").transform(() => null)),
  published: z.boolean(),
});
```

기존 News 폼과 동일한 시각 톤(라벨/입력 박스 스타일)을 재사용.

### 6.4 Server Actions
- `createLiveEventAction(formData)` — 검증 → `createLiveEvent` → `revalidatePath("/live")` + `revalidatePath("/admin/live")` → redirect
- `updateLiveEventAction(id, formData)` — 검증 → `updateLiveEvent` → revalidate
- `togglePublishedAction(id, published)` — `setLiveEventPublished` → revalidate

소프트 삭제 정책 유지 (`published=0`로 비공개 처리, 물리 삭제 없음). 다른 리소스와 동일.

### 6.5 대시보드 (5번째 카드 + 최근 수정 union)

`src/app/admin/(authed)/page.tsx` 변경:
- `cards` 배열에 `{ resource: "live", label: "Live" }` 추가 → 그리드를 `grid-cols-2 md:grid-cols-5` 로 (또는 모바일 2 / 데스크톱 5)
- `getRecent()`의 UNION에 `live_events` 1줄 추가:
  ```sql
  (SELECT 'live' AS resource, id, CONCAT(DATE_FORMAT(event_date, '%Y-%m-%d'), ' ', venue) AS label,
          updated_at AS ts FROM live_events)
  ```
- `Recent.resource` 타입에 `"live"` 추가
- `countLiveEvents()`를 dashboard `Promise.all`에 추가

---

## 7. Seed (선택) — `db/seed/005_live_events.sql`

빠른 시각 확인용 더미 2건:
```sql
INSERT INTO live_events (event_date, venue, city, ticket_url, video_url, published) VALUES
  ('2026-06-12', 'Rolling Hall', 'Seoul', 'https://example.com/tickets/rolling-hall', NULL, 1),
  ('2025-12-14', 'Club FF',      'Seoul', NULL, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1);
```

운영 데이터 입력 시 어드민에서 수동 추가 후 seed는 비활성. (프로젝트 관행 따라)

---

## 8. 구현 범위 외 (out of scope)

- 다국어 (영문 한 언어 고정. 다른 탭 패턴 동일)
- 임베드 플레이어 (새 탭 이동만 — 플랫폼별 임베드 위젯 없음)
- 좌석 매진/잔여 표시
- 포스터 이미지 업로드
- Setlist / 게스트 / 부가 메모
- 공연 카테고리(투어/단발/페스티벌) 구분
- ICS 캘린더 export, RSS

위 항목은 사용자 요청 시 후속 마이그레이션으로 컬럼 추가하는 방식으로 확장.

---

## 9. 마이그레이션 절차

1. `db/schema/005_live_events.sql` 작성·커밋
2. DEV DB(`BANDSUSTAIN`)에 적용 — bandsustain은 단일 main 브랜치, dev/prod 분리 없음(`/root/.claude/projects/-root/memory/MEMORY.md` 참고)
3. (선택) `db/seed/005_live_events.sql` 실행으로 더미 2건 입력
4. 코드 머지 → PROD pull → PM2 restart (port 3100)

브랜드 단일 main 운영이므로 dev push 후 운영 반영 게이트는 적용 안 됨 (junior/boot/pt와 다름).
