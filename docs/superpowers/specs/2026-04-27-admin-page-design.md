# /admin 페이지 디자인 — Spec

**작성일:** 2026-04-27 (§1~§4) / 2026-04-28 (§5~§6 추가)
**대상:** bandsustain.com `/admin` 페이지 — members, songs, news, quotes 4개 리소스 CRUD
**스코프 제외:** Live 탭 (현재 미구현)

---

## 진행 상태

| Section | 상태 |
|---------|------|
| 1. 아키텍처 개요 | ✅ |
| 2. DB 스키마 | ✅ |
| 3. 인증 | ✅ |
| 4. 이미지 업로드 | ✅ |
| 5. Admin UI 상세 | ✅ |
| 6. 마이그레이션 & out-of-scope | ✅ |

---

## 사용자가 확정한 결정 (Q&A)

| Q | 결정 |
|---|------|
| Q1 인증 모델 | **A** — 단일 사용자, `.db_credentials` 환경변수, 로그인 폼 + httpOnly 세션 쿠키 |
| Q2 이미지 업로드 | **B** — admin 파일 업로드, MIME 검증 + 사이즈 제한 |
| Q3 정적 → DB | **A** — 모두 `force-dynamic`, quote 패턴과 통일 |
| Q4 삭제 방식 | **B** — 소프트 삭제 (`published` 플래그) |
| Q5 admin URL 구조 | **B** — 리소스별 라우트 (`/admin/{resource}`, `/admin/{resource}/[id\|new]`) |
| Q6 폼 검증 | **A** — Zod 도입 (react-hook-form 없음, 클라이언트 즉시검증 포기) |
| Q7 리스트 표시 | **A** — HTML 표 (전 리소스 동일 패턴) |
| Q8 멤버 정렬 UX | **B** — 리스트 행마다 ▲▼ 버튼 (옆 멤버와 swap) |
| Q9 공개/삭제 액션 | **A** — 단일 published 토글, 별도 삭제 버튼 없음 |
| Q10 본문 에디터 | **A** — 순수 `<textarea>`, 공개 페이지에서 `\n\n` 단락 + `\n` 줄바꿈 렌더 |
| Q11 미리보기 | **A** — 편집 화면 상단 "공개 페이지 보기" 새 탭 링크 (미공개 미리보기 없음) |
| Q12 대시보드 | **B** — 리소스 4개 카운트 카드 + 최근 수정 5건 표 |
| Q13 Server Action 위치 | **A** — `src/app/admin/{resource}/actions.ts` (Zod 스키마 동거) |
| Q14 .ts → SQL | **C** — 일회성 스크립트로 SQL 파일 생성, git 커밋 |
| Q15 컴포넌트 인터페이스 | **C** — lib 도메인 타입(camelCase) + DB→도메인 매핑, `src/data/*` 삭제 |

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
- `src/lib/{members,songs,news,quotes}.ts` — public/admin 둘 다 호출하는 read 쿼리 helper + 도메인 타입
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
- `zod` 추가 (폼 입력 검증)
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
3. 폼 컴포넌트: 받은 경로를 `photoUrl`/`artworkUrl` 필드에 채우고 미리보기 표시

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

## 5. Admin UI 상세

### 5.1 라우트 / 페이지 책임

```
/admin/login              로그인 폼
/admin/logout             POST 전용
/admin                    대시보드 (카운트 + 최근 수정)
/admin/members            리스트 표 (▲▼, 토글, 편집 링크, + 새로 추가)
/admin/members/new        생성 폼
/admin/members/[id]       편집 폼
/admin/songs              리스트 표
/admin/songs/new          생성 폼
/admin/songs/[id]         편집 폼
/admin/news               리스트 표
/admin/news/new           생성 폼
/admin/news/[id]          편집 폼
/admin/quotes             리스트 표 (기존 quotes 재사용, admin 진입점만 추가)
/admin/quotes/new         생성 폼
/admin/quotes/[id]        편집 폼
```

공통 레이아웃 `src/app/admin/layout.tsx` — 좌측 네비게이션(Members / Songs / News / Quotes / 로그아웃) + 메인 영역. `force-dynamic`.

**디자인 원칙 (CLAUDE.md 준수):** admin도 공개 사이트와 동일한 디자인 시스템(`globals.css` 토큰, Inter/Archivo, 화이트 베이스 + 블랙 타이포 + 직각 + shadow/gradient/rounded 금지)을 따른다. 좌측 nav는 단순 텍스트 링크 리스트, 표는 `--color-border` 1px 구분선만, 버튼은 컴포넌트 카탈로그의 Primary/Secondary 스타일 그대로. 액센트 오렌지는 admin에서도 절제(예: 위험 액션 강조 정도). 다크 자동 전환 금지 동일하게 적용.

### 5.2 폼 검증 — Zod (Q6=A)

- `src/app/admin/{resource}/actions.ts` 상단에 `const memberSchema = z.object({...})` 정의
- Server Action 진입 직후 `memberSchema.safeParse(formData)` → 실패 시 `{ ok: false, fieldErrors }` 반환
- 클라이언트 폼은 Server Action 응답을 받아 필드별 에러 표시 (react-hook-form 없음, useFormState 또는 useActionState 사용)
- 클라이언트 즉시검증은 포기. 운영자 1명용이라 라운드트립 1회 비용 허용.

### 5.3 리스트 페이지 — HTML 표 (Q7=A)

상단: `[+ 새로 추가]` 버튼.
표 컬럼:

| 리소스 | 컬럼 |
|--------|------|
| members | 썸네일 / 이름(EN/KR) / 포지션 / display_order / 공개 토글 / [▲][▼][편집] |
| songs   | 아트워크 / 제목 / 카테고리 / 발매일 / 공개 토글 / [편집] |
| news    | 썸네일 / 헤드라인 / 카테고리 / 날짜 / 공개 토글 / [편집] |
| quotes  | 인물 / 인용문 발췌 / 공개 토글 / [편집] |

- 정렬: members는 `display_order ASC, id`, songs는 `released_at DESC, id`, news는 `date DESC, id`, quotes는 기존 정렬 유지.
- 검색/페이지네이션 없음 (out-of-scope).
- "삭제" 버튼 없음 — 비공개 토글 = 사실상 삭제 (Q4=B / Q9=A).

### 5.4 ▲▼ 순서 변경 (Q8=B)

- members 리스트 행마다 ▲ ▼ 버튼.
- 클릭 시 Server Action `swapMemberOrder(id, direction)`:
  - 현재 행과 인접 행 두 개의 `display_order` 값을 SWAP.
  - 트랜잭션 1개 안에서 처리.
  - 맨 위에서 ▲, 맨 아래에서 ▼는 disable.
- songs/news/quotes는 정렬 기준이 발매일/날짜라 ▲▼ 없음.

### 5.5 published 토글 (Q9=A)

- 리스트 행의 토글: `togglePublished(id)` Server Action 호출 → `UPDATE ... SET published = NOT published`.
- 별도 확인 다이얼로그 없음 (한 번 더 누르면 원복되므로 안전).
- 토글 후 리스트 자체 갱신(revalidatePath).

### 5.6 본문 에디터 (Q10=A)

- `songs.lyrics` `news.body` 모두 순수 `<textarea>`, rows=20 정도.
- 공개 페이지 렌더: 입력값을 `\n\n` 기준 split → 각 단락마다 `<p>` 출력 → 단락 안의 `\n`은 `text.split('\n').flatMap((line, i) => i === 0 ? [line] : [<br key={i} />, line])` 형태로 React 노드로 매핑.
- `dangerouslySetInnerHTML` 절대 사용 금지. 입력값은 React가 자동 escape하는 텍스트 노드로만 렌더 (XSS 차단).

### 5.7 Server Action 구조 (Q13=A)

```
src/app/admin/members/actions.ts
  - memberSchema (zod)
  - createMember(formData)
  - updateMember(id, formData)
  - togglePublishedMember(id)
  - swapMemberOrder(id, direction)

src/app/admin/songs/actions.ts
  - songSchema, createSong, updateSong, togglePublishedSong

src/app/admin/news/actions.ts
  - newsSchema, createNews, updateNews, togglePublishedNews

src/app/admin/quotes/actions.ts
  - quoteSchema, createQuote, updateQuote, togglePublishedQuote

src/lib/upload.ts
  - uploadImage(formData, resource)  ← admin actions에서 import해서 호출
```

읽기 함수(`getPublishedMembers` / `getAllMembersForAdmin` 등)는 `src/lib/{resource}.ts`에 둠 — public 페이지와 admin 둘 다 호출.

### 5.8 미리보기 (Q11=A)

편집 폼 상단에 "공개 페이지에서 보기 ↗" 링크. members는 `/members#member-<id>`, songs는 `/songs#song-<id>`, news는 `/news/<id>`, quotes는 `/quote#quote-<id>`. 새 탭에서 열림. published=0이면 안 보이는 게 정상.

### 5.9 대시보드 `/admin` (Q12=B)

- 상단: 4개 카드(Members N / Songs N / News N / Quotes N), 각 카드는 해당 리스트로 링크 + `[+ 새로 추가]` 보조 버튼.
- 하단: "최근 수정 5건" 표 (리소스 / 제목 또는 인물 / 수정일).
  - 4개 테이블 union 후 `ORDER BY updated_at DESC LIMIT 5`. quotes에는 `updated_at` 없으므로 `created_at`을 그 자리에 사용.
  - 클릭 시 해당 리소스 편집 페이지로.

---

## 6. 마이그레이션 & 배포

### 6.1 데이터 변환 (Q14=C)

`scripts/seed-from-data.ts` (Node + tsx로 일회성 실행):

1. `import { members } from '@/data/members'` 등으로 정적 데이터 로드.
2. `INSERT INTO members (name_en, name_kr, ...) VALUES (...);` 형태 SQL 문자열 생성 (이스케이프는 `mysql.escape()` 또는 직접 처리).
3. `db/seed/002_members_seed.sql`, `003_songs_seed.sql`, `004_news_seed.sql` 3개 파일로 출력.
4. 결과 SQL은 git 커밋 → DEV/PROD에 동일 적용.
5. 스크립트 자체는 한 번 쓰고 제거하지 않고 남김 (재실행 가능, idempotent하지는 않으니 주의).

### 6.2 컴포넌트 인터페이스 (Q15=C)

`src/lib/{members,songs,news}.ts`에 도메인 타입(camelCase) 정의:

```ts
// src/lib/members.ts
export type Member = {
  id: number;
  nameEn: string;
  nameKr: string;
  position: string;
  photoUrl: string;
  favoriteArtist?: string;
  favoriteSong?: string;
  displayOrder: number;
  published: boolean;
};

export async function getPublishedMembers(): Promise<Member[]> {
  // SELECT ... ORDER BY display_order, id
  // row → Member 매핑 (snake_case → camelCase, TINYINT → boolean)
}

export async function getAllMembersForAdmin(): Promise<Member[]> { ... }
```

`MemberCard`, `SongCard`, `NewsCard`의 props 타입과 사용 필드명을 도메인 타입에 맞춰 수정:
- `member.photo` → `member.photoUrl`
- `song.artwork` → `song.artworkUrl`
- `song.year` → `song.releasedAt.getFullYear()` (lib에서 `releasedAt: Date` 형태로 매핑해 반환, 컴포넌트에서 연도 추출)
- `item.heroImage` 그대로, `item.midImage` 그대로
- `id: string` → `id: number` (URL 생성 시 `String(id)` 또는 템플릿 리터럴)

`src/data/{members,songs,news}.ts` 3개 파일은 마이그레이션 완료 후 **삭제**.

### 6.3 구현 단계 (DEV)

한 PR/브랜치 안에서 단계별 커밋:

1. 의존성 + auth 기반 (`bcryptjs`, `zod`, `loadCreds()` → `src/lib/creds.ts`)
2. 스키마 SQL 3개 작성 + DEV 적용
3. `scripts/seed-from-data.ts` 작성 → seed SQL 3개 산출 → DEV 적용
4. `src/lib/{members,songs,news}.ts` 도메인 타입 + read 함수 (`@/data/*` 아직 살아 있음)
5. 공개 페이지 4개를 lib 사용으로 전환 + 컴포넌트 props 필드명 일괄 수정 + `force-dynamic`
6. `src/data/{members,songs,news}.ts` 삭제 + 사용처 없음 확인 (grep)
7. `src/middleware.ts` + `/admin/login` + `/admin/logout` + `src/lib/auth.ts`
8. `/admin` 대시보드 (카운트 + 최근 수정 5건)
9. `/admin/{members,songs,news,quotes}` 리스트 페이지 (표 + 토글 + ▲▼)
10. `/admin/{resource}/[id|new]` 폼 페이지 + Server Actions + Zod + `src/lib/upload.ts`
11. `scripts/admin-set-password.ts`

각 단계 후 dev 서버에서 빠른 동작 확인.

### 6.4 PROD 배포 순서

1. `.db_credentials`에 `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` 3줄 추가 (`scripts/admin-set-password.ts` 사용).
2. PROD DB에 스키마 + seed SQL 적용 (`002~004` 6개 파일).
3. `git pull origin main` → `pnpm install` → `pnpm build` → `pm2 restart bandsustain`.
4. 스모크 (아래).

### 6.5 PROD 스모크 체크리스트

- 공개 페이지 정상 렌더: `/members` `/songs` `/news` `/quote`
- `/news/<id>` 상세 정상 (URL이 `01`→`1`로 바뀐 점 확인)
- `/admin/login` 로그인 → `/admin` 대시보드, 카운트가 DB row 수와 일치
- 멤버 1건 토글 → 공개 사이트에서 사라짐 / 토글 복원 → 다시 보임
- 멤버 ▲▼ 1회 → 공개 페이지 순서 반영 → 원복
- 곡 1건 신규 생성 + 이미지 업로드 → published=1 → `/songs`에 노출
- 비공개 토글 → 사라짐 → 다시 켜기
- 로그아웃 → `/admin` 재방문 시 `/admin/login`으로 리다이렉트

### 6.6 out-of-scope (이번 spec 밖)

- Live 탭 (현재 미구현)
- 멀티 사용자 / 권한 / 비밀번호 재설정 UI
- audit log / 변경 이력
- 이미지 자동 정리 / orphan 청소
- 검색 / 페이지네이션
- 공개 페이지 미공개 미리보기 (`?preview=...`)
- WYSIWYG / 마크다운 렌더링
- 회원가입 / 비밀번호 분실 흐름
- members/songs/news 삭제 후 옛 URL 리다이렉트 (Apache rewrite로 별도 처리 가능)
