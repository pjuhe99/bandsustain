# /admin 페이지 디자인 — Spec (WIP)

**작성일:** 2026-04-27
**상태:** ⚠️ WIP — 6 섹션 중 1~4 까지만 작성됨. 5(Admin UI 상세) / 6(Migration & out-of-scope) 미완.
**대상:** bandsustain.com `/admin` 페이지 — members, songs, news, quote 4개 리소스 CRUD
**스코프 제외:** Live 탭 (현재 미구현)

---

## 진행 상태

| Section | 상태 |
|---------|------|
| 1. 아키텍처 개요 | ✅ 사용자 OK |
| 2. DB 스키마 | ✅ 사용자 OK |
| 3. 인증 | ✅ 사용자 OK |
| 4. 이미지 업로드 | ✅ 사용자 OK |
| 5. Admin UI 상세 (라우트/폼/리스트) | ❌ 미작성 |
| 6. 마이그레이션 & out-of-scope | ❌ 미작성 |

재개 시 §5 부터 브레인스토밍 계속.

---

## 사용자가 확정한 결정 (Q&A)

| Q | 결정 |
|---|------|
| Q1 인증 모델 | **A** — 단일 사용자, `.db_credentials` 환경변수, 로그인 폼 + httpOnly 세션 쿠키 |
| Q2 이미지 업로드 | **B** — admin 파일 업로드, MIME 검증 + 사이즈 제한 |
| Q3 정적 → DB | **A** — 모두 `force-dynamic`, quote 패턴과 통일 |
| Q4 삭제 방식 | **B** — 소프트 삭제 (`published` 플래그) |
| Q5 admin URL 구조 | **B** — 리소스별 라우트 (`/admin/{resource}`, `/admin/{resource}/[id|new]`) |

---

## 1. 아키텍처 개요

```
┌──────────────────────────────────────────────────────┐
│ Public pages (force-dynamic, DB read-only)           │
│  /members  /songs  /news  /news/[id]  /quote          │
│       ↑                                              │
│       │ src/lib/{members,songs,news,quotes}.ts        │
│       │   (DB query helpers — 기존 quotes.ts 패턴)    │
│       ↑                                              │
│  ┌────┴────────┐    ┌──────────────────────────────┐ │
│  │  MariaDB    │    │ Admin (Next.js App Router)   │ │
│  │ BANDSUSTAIN │←───│  /admin (대시보드)           │ │
│  │             │    │  /admin/login                 │ │
│  │ - members   │    │  /admin/{resource}            │ │
│  │ - songs     │    │  /admin/{resource}/[id|new]   │ │
│  │ - news      │    │       │                       │ │
│  │ - quotes    │    │       └ Server Actions        │ │
│  └─────────────┘    │           (CRUD + 업로드)     │ │
│                     └──────────────────────────────┘ │
│                                                      │
│  middleware.ts: /admin/* 요청 → 세션 쿠키 검증       │
│  미인증 시 /admin/login 으로 리다이렉트              │
│                                                      │
│  업로드 저장: public/uploads/{resource}/<uuid>.<ext> │
│  (DB에는 그 경로만 기록)                              │
└──────────────────────────────────────────────────────┘
```

**핵심 단위:**
- `src/lib/db.ts` — 기존 lazy pool, 그대로 사용
- `src/lib/creds.ts` — **신규** (`db.ts`에서 `loadCreds()` 추출, db/auth 공유)
- `src/lib/{members,songs,news,quotes}.ts` — public/admin 둘 다 호출하는 쿼리 helper
- `src/lib/auth.ts` — 세션 발급/검증 (HMAC 서명 쿠키)
- `src/lib/upload.ts` — 파일 검증 + 저장
- `src/middleware.ts` — `/admin/*` 보호
- `src/app/admin/...` — UI + Server Actions
- `db/schema/00X_*.sql`, `db/seed/*.sql` — 신규 테이블 + 기존 .ts 데이터 import

---

## 2. DB 스키마

`quotes`는 이미 운영 중이라 그대로 둠. 신규 3개 테이블 추가.

### 002_members.sql

```sql
CREATE TABLE members (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name_en         VARCHAR(80)    NOT NULL,
  name_kr         VARCHAR(40)    NOT NULL,
  position        VARCHAR(120)   NOT NULL,
  photo_url       VARCHAR(255)   NOT NULL,
  favorite_artist VARCHAR(120)   NULL,
  favorite_song   VARCHAR(255)   NULL,
  display_order   INT            NOT NULL DEFAULT 0,
  published       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_order (published, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 003_songs.sql

```sql
CREATE TABLE songs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255)   NOT NULL,
  category     ENUM('Album','EP','Single','Live Session') NOT NULL,
  artwork_url  VARCHAR(255)   NOT NULL,
  listen_url   VARCHAR(500)   NULL,
  lyrics       TEXT           NULL,
  released_at  DATE           NOT NULL,
  published    TINYINT(1)     NOT NULL DEFAULT 1,
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_released (published, released_at DESC, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 004_news.sql

```sql
CREATE TABLE news (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  headline    VARCHAR(255)   NOT NULL,
  category    VARCHAR(40)    NOT NULL,
  date        DATE           NOT NULL,
  hero_image  VARCHAR(255)   NOT NULL,
  body        MEDIUMTEXT     NOT NULL,
  mid_image   VARCHAR(255)   NULL,
  published   TINYINT(1)     NOT NULL DEFAULT 1,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_date (published, date DESC, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 주요 결정

- ID는 모두 `INT AUTO_INCREMENT`. 기존 `.ts` 파일의 `id: "01"~"09"`는 마이그레이션 시 1~9로 재발급됨.
- `members.display_order` (현재 `order?: number`) — 멤버 정렬용.
- `news.body MEDIUMTEXT` (16MB) — 본문 길이 여유.
- `songs.category ENUM` — 현재 4개 값 그대로.
- 모든 신규 테이블에 `updated_at` 추가 (quote에는 없지만 admin 운영상 유용).
- `quotes`는 그대로 둠 (운영 중, 변경 시 위험).

### URL 변경 주의

`/news/01` → `/news/1` 등 URL 변경됨. 사이트 신규라 외부 인덱싱 영향 거의 없을 거지만, 신경 쓰이면 Apache vhost에서 `/news/0(\d+)` → `/news/$1` redirect 한 줄 추가하는 옵션 있음.

---

## 3. 인증

### 자격증명 저장

기존 `/var/www/html/_______site_BANDSUSTAIN/.db_credentials` 파일에 키 3개 추가 (별도 .env 안 만듦, 패턴 일치):

```
ADMIN_USERNAME=<운영자 ID>
ADMIN_PASSWORD_HASH=$2b$12$<bcrypt 해시>
ADMIN_SESSION_SECRET=<랜덤 32바이트 hex>
```

### 리팩토링

`db.ts`의 `loadCreds()`를 `src/lib/creds.ts`로 추출. `db.ts`와 신규 `auth.ts`가 공유.

### 의존성

- `bcryptjs` 추가 (pure JS, native build 불필요)
- `crypto` (Node 빌트인) — HMAC, randomUUID

### 로그인 흐름 (`/admin/login`)

1. POST { username, password }
2. 서버: `bcrypt.compare(password, ADMIN_PASSWORD_HASH)` + username 상수시간 비교
3. 성공 시 세션 쿠키 발급:
   - payload: `{ u: username, iat: <epoch>, exp: <epoch + 7d> }` (JSON)
   - 쿠키값: `base64url(payload).hmac_sha256(payload, SESSION_SECRET)`
   - 속성: `httpOnly`, `secure`, `SameSite=Strict`, `Path=/`, `Max-Age=604800`
4. `/admin`으로 리다이렉트

### 세션 검증 (`src/middleware.ts`)

- `/admin/*` 요청 (단, `/admin/login` 제외)
- 쿠키 없거나 HMAC 위변조/만료 시 → `/admin/login?next=<원래경로>`로 리다이렉트
- DB sessions 테이블 없음 (쿠키 자체가 진실 — stateless)

### 로그아웃 (`/admin/logout` POST)

- Set-Cookie: `Max-Age=0`으로 만료, `/admin/login`으로 리다이렉트

### CSRF / 보안

- Next.js 16 Server Actions가 Origin 헤더 자동 검증
- `SameSite=Strict` 세션 쿠키로 cross-site 요청 차단
- 별도 CSRF 토큰 불필요
- bcrypt cost=12로 무차별 대입 자연 제한 (검증 1회당 ~250ms)

### 초기 셋업 스크립트 (`scripts/admin-set-password.ts`)

운영자가 한 번 실행: `node scripts/admin-set-password.ts <password>` → bcrypt 해시 출력 → `.db_credentials`에 붙여넣기.

---

## 4. 이미지 업로드

### 디렉토리 구조

```
public/
├── members/      ← 기존 정적 파일 (마이그레이션 후에도 유지)
├── songs/
├── news/
└── uploads/      ← 신규: admin 업로드 전용
    ├── members/
    ├── songs/
    ├── news/
    └── quotes/
```

마이그레이션 시 기존 `.ts` 데이터의 `photo: "/members/member01.jpg"` 그대로 DB에 들어감 — 기존 파일 그대로 동작. admin에서 새로 업로드하는 것만 `/uploads/{resource}/<uuid>.<ext>` 경로.

### Server Action 흐름

1. 클라이언트: `<input type="file">`로 FormData 전송
2. 서버 액션 `uploadImage(formData, resource)`:
   - 사이즈 검증: 최대 8MB
   - MIME 검증: `image/jpeg | png | webp | gif` 허용
   - 매직 바이트 검증 (JPEG `FF D8 FF`, PNG `89 50 4E 47` 등) — 확장자 위조 차단
   - 파일명: `crypto.randomUUID() + ext`
   - `fs.writeFile('public/uploads/{resource}/<uuid>.<ext>', buffer)`
   - 반환: `/uploads/{resource}/<uuid>.<ext>` (DB 컬럼에 저장될 경로)
3. 폼 컴포넌트: 받은 경로를 `photo_url`/`artwork_url` 필드에 채우고 미리보기 표시

### SELinux

메모리상 업로드 dir에 `httpd_sys_rw_content_t` 권장 사항이 있지만, 이 사이트는 Apache가 reverse-proxy만 하고 정적 파일은 Next.js(PM2/ec2-user)가 직접 서빙하므로 SELinux 컨텍스트 불필요. 향후 Apache 직접 서빙으로 바꾸면 그때 설정.

### 디스크 정리

사진 교체/삭제 시 옛 파일은 디스크에 남음. 자동 청소 안 함 (YAGNI — 사이즈 미미). 필요하면 나중에 별도 cron.

### 클라이언트 UX

- 업로드 진행 중 disable + spinner
- 성공 시 미리보기 갱신
- 실패 시 에러 메시지 (사이즈 초과 / 형식 불가 등)
- "URL 직접 입력" 토글 옵션은 안 만듦 (Q2=B 선택 — 업로드 일관)

---

## 5. Admin UI 상세 (TBD)

다음 세션에서 결정할 항목:

- 라우트별 페이지 책임 (`/admin`, `/admin/{resource}`, `/admin/{resource}/[id|new]`)
- 폼 레이아웃 (필드 그룹, 검증, 에러 표시)
- 리스트 테이블 (정렬 기준, 컬럼, 액션 버튼)
- 폼 검증 라이브러리 (Zod vs 직접)
- Server Action 구조 (resource별 파일 분리)
- "비공개" 토글 UX
- "삭제 확인" 다이얼로그
- 멤버 `display_order` 편집 UX (드래그 vs 숫자 입력)
- 본문 textarea (가사/뉴스 body)
- 미리보기 ("공개 사이트에서 어떻게 보일지" 링크 정도면 충분?)
- 대시보드(`/admin`)에 뭘 보여줄지 (리소스별 개수 + 최근 수정?)

---

## 6. 마이그레이션 & out-of-scope (TBD)

다음 세션에서 결정할 항목:

- 기존 `.ts` 데이터를 SQL INSERT로 변환하는 방법 (수동 작성 vs 스크립트)
- 마이그레이션 순서 (스키마 적용 → 시드 → 페이지 코드 전환 → 정적 .ts 삭제)
- 페이지별 전환 (`members/page.tsx`, `songs/page.tsx`, `news/page.tsx`, `news/[id]/page.tsx`)
- 정적 `.ts` 파일 처리 (삭제 vs 보관)
- `MemberCard`, `SongCard`, `NewsCard` 등 기존 컴포넌트 인터페이스 유지 여부
- 테스트 전략 (수동 검증 체크리스트)
- 배포 순서 (스키마/시드 PROD 적용 시점, admin URL 노출 시점)
- out-of-scope 명시:
  - Live 탭 (미구현)
  - 멀티 사용자
  - audit log / 변경 이력
  - 이미지 자동 정리
  - 검색/페이지네이션 (현재 row 수 작아서 불필요)
