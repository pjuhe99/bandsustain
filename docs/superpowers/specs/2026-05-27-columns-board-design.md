# 칼럼 게시판 (Columns) — 설계 문서

- **날짜**: 2026-05-27
- **대상**: bandsustain.com `/columns` 탭 (멤버별 칼럼/블로그 게시판)
- **환경**: bandsustain-dev (dev 브랜치, DB `BANDSUSTAIN_DEV`)에서만 작업. 운영 반영은 사용자 명시 요청 시에만.

## 1. 목적

멤버들이 "주제(토픽)"를 만들고 그 안에 글을 연재하는 칼럼 게시판. 기존 `news` 탭보다 **글쓰기 기능(마크다운 서식 + 자유로운 이미지 첨부)**, **주제 칩 필터**, **로그인 없는 익명 댓글(IP 일부 표시 + 어드민 모더레이션)**, **조회수/댓글수 메타데이터 표시**가 강화된 형태.

기존 `news` 기능 패턴(DB 테이블 + `src/lib` 데이터 레이어 + 어드민 CRUD + 이미지 업로드 + 공개 리스트/상세 페이지)을 그대로 따르고, 그 위에 **주제(topics)**와 **댓글(comments)** 두 축을 새로 얹는다. 경쟁하는 대안 아키텍처는 없음 — 코드베이스가 패턴을 강하게 규정하므로 일관성을 위해 news 패턴을 미러링한다.

## 2. 핵심 결정 (확정)

| 항목 | 결정 |
|------|------|
| 주제↔멤버 연결 | **선택적**. `column_topics.member_id` NULL 허용 FK→`members`. 고르면 멤버 프로필/이름 연동, 안 고르면 주제 제목만. (1:1 매칭 아님) |
| 글쓰기 에디터 | **마크다운 + 툴바 + 미리보기**. `react-markdown` + `remark-gfm`. raw HTML 비허용. |
| 댓글 노출 정책 | **즉시 노출 + 사후 숨김** (디시인사이드 방식). `visible` 기본 1, 어드민이 부적절한 것만 숨김. |
| 댓글 기능 범위 | **닉네임 + 비밀번호(본인 삭제) + 평면 구조**. 대댓글 없음. IP 일부 공개 표시 + 봇 방지(허니팟·레이트리밋). |

## 3. 데이터 모델 — 마이그레이션 `db/schema/018_columns.sql`

테이블 3개. 모두 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`, `CREATE TABLE IF NOT EXISTS`.

### 3.1 `column_topics` (주제)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | INT AUTO_INCREMENT PK | |
| `title` | VARCHAR(120) NOT NULL | 예: "김영민의 휴먼 역사갤러리" |
| `member_id` | INT NULL | FK→`members(id)` `ON DELETE SET NULL` (선택 연결) |
| `description` | VARCHAR(500) NULL | 주제 소개(선택) |
| `visible` | TINYINT(1) NOT NULL DEFAULT 1 | 숨김 토글 (0이면 칩·하위 글 모두 비노출) |
| `sort_order` | INT NOT NULL DEFAULT 0 | 칩 정렬 |
| `created_at` / `updated_at` | TIMESTAMP | news 패턴과 동일 |

인덱스: `INDEX idx_visible_sort (visible, sort_order, id)`

### 3.2 `column_posts` (글)
> 테이블명은 `columns`가 아니라 **`column_posts`** — `COLUMNS`는 SQL에서 혼동 소지가 있어 회피. 공개 라우트는 `/columns` 유지.

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | INT AUTO_INCREMENT PK | |
| `topic_id` | INT NOT NULL | FK→`column_topics(id)` `ON DELETE CASCADE`. 글은 정확히 1개 주제 소속(필수) |
| `title` | VARCHAR(200) NOT NULL | |
| `hero_image` | VARCHAR(255) NULL | 대표 이미지(선택). 없으면 텍스트형 카드 |
| `excerpt` | VARCHAR(500) NULL | 수동 발췌(선택). 없으면 본문 마크다운 스트립으로 자동 생성 |
| `body` | MEDIUMTEXT NOT NULL | 마크다운 **원문** 저장 |
| `view_count` | INT NOT NULL DEFAULT 0 | |
| `published` | TINYINT(1) NOT NULL DEFAULT 0 | 0=초안, 1=공개 |
| `published_at` | TIMESTAMP NULL | **공개 정렬 기준.** 초안 0→1 전환 시 NULL이면 `NOW()`로 set, 이미 값 있으면 유지. 비공개로 되돌려도 보존 |
| `created_at` / `updated_at` | TIMESTAMP | |

인덱스: `INDEX idx_published_order (published, published_at DESC, id)`, `INDEX idx_topic (topic_id)`

> **정렬**: 공개 목록·상세 모두 `ORDER BY COALESCE(published_at, created_at) DESC, id DESC`. 오래 전 만든 초안을 나중에 공개해도 "방금 공개한 글"로 최상단에 노출됨(연재 UX). 어드민 목록은 `created_at DESC`(작성순) 유지.

### 3.3 `column_comments` (댓글)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | INT AUTO_INCREMENT PK | |
| `post_id` | INT NOT NULL | FK→`column_posts(id)` `ON DELETE CASCADE` |
| `nickname` | VARCHAR(40) NOT NULL | |
| `password_hash` | VARCHAR(72) NULL | bcrypt. 비번 미설정 시 NULL → 본인 삭제 불가(어드민만) |
| `body` | VARCHAR(1000) NOT NULL | 평문(마크다운/HTML 미지원, 렌더 시 이스케이프) |
| `ip` | VARCHAR(45) NOT NULL | **전체 IP 저장**(모더레이션용). 공개 시 마스킹 |
| `visible` | TINYINT(1) NOT NULL DEFAULT 1 | 어드민 숨김 토글 |
| `created_at` | TIMESTAMP | |

인덱스: `INDEX idx_post_visible (post_id, visible, created_at)`

### 3.4 가시성 규칙 (불변식)
- **공개 노출 = `post.published = 1` AND `topic.visible = 1`.** 둘 중 하나라도 아니면 공개 사이트에 안 보임.
- 주제 "숨김"(`visible=0`)은 **소프트·가역**. 하위 글을 지우지 않고 일괄 비노출만. 복구하면 다시 보임.
- 주제/글 **하드 삭제**는 별도 액션. FK `ON DELETE CASCADE`로 하위 글·댓글 정합성 유지.
- 공개 댓글 수 = 해당 글의 `visible=1` 댓글 수.

## 4. 의존성 추가
- `react-markdown`, `remark-gfm` (`pnpm add`). raw HTML 렌더링 비활성(react-markdown 기본값) → 마크다운 본문 XSS 안전. `@tailwindcss/typography`는 도입하지 않고, react-markdown의 `components` 매핑으로 각 요소를 CLAUDE.md 디자인 톤에 맞춘 Tailwind 클래스로 직접 스타일링.

## 5. 데이터 레이어 — `src/lib/columns.ts`
`news.ts` 스타일(snake_case Row → camelCase 타입 매퍼, `getPool().query`) 답습.

- **타입**: `ColumnTopic`, `ColumnPost`(+ joined `topicTitle`/`authorName` 옵션), `ColumnComment`.
- **주제**: `getVisibleTopics()`, `getAllTopicsForAdmin()`, `getTopicById(id)`.
- **글**: `getPublishedPosts(opts?: { topicId?: number })`(topic.visible=1 조인, `ORDER BY COALESCE(published_at, created_at) DESC, id DESC`), `getAllPostsForAdmin()`(주제·조회수·댓글수 조인, `created_at DESC`), `getPublishedPostById(id)`(published=1 && topic.visible=1), `getPostByIdForAdmin(id)`, `incrementViewCount(id)`, **`canCommentOnPost(id): Promise<boolean>`**(= getPublishedPostById가 non-null인지; 댓글 게이트 전용).
- **댓글**: `getVisibleComments(postId)`, `getCommentCountsByPost(postIds)`(map 반환), `getAllCommentsForAdmin(opts?)`, `getCommentById(id)`, `getLatestCommentAtByIp(ip)`(레이트리밋용), `insertComment(...)`.
- **공개 전환**: `togglePostPublished`/`updatePost`에서 0→1 전환 시 `published_at IS NULL`이면 `published_at = NOW()` 함께 set(SQL `CASE`/조건 update). 1→0 전환은 `published_at` 보존.
- **헬퍼**: `maskIp(ip): string`(IPv4 앞 2옥텟 `121.131`, IPv6 앞 2헥텟, 비정상값은 안전 폴백), `excerptFromMarkdown(body, max)`(마크다운 기호 제거 후 truncate).

## 6. 공개 사이트

### 6.1 네비게이션
`src/components/Nav.tsx` `navLinks`에 `{ href: "/columns", label: "칼럼" }` 추가 (PC + 모바일 오버레이 둘 다 자동 반영).

### 6.2 `/columns` — 리스트 (`src/app/columns/page.tsx`)
- 상단 **주제 칩 필터**: `전체` + `getVisibleTopics()`. CLAUDE.md Filter Pill 스타일(직각, 선택 시 블랙 솔리드). 선택은 **쿼리파라미터 `?topic=<id>`** (서버 컴포넌트에서 `searchParams`로 필터, 링크 기반 — JS 없이도 동작).
- 카드(news 카드 디자인 계승, 그림자·radius 없음): hero 이미지(없으면 텍스트형) → 제목(`font-semibold`) → 메타(`주제 · 작성자(멤버명 or 없음) · 공개일`) → 발췌 → **조회수 · 댓글수**.
- 정렬: `COALESCE(published_at, created_at) DESC, id DESC` (§3.2 정렬 규칙).

### 6.3 `/columns/[id]` — 상세 (`src/app/columns/[id]/page.tsx`)
- 미공개(`published=0` 또는 주제 `visible=0`)면 404.
- Breadcrumb `Home › 칼럼 › <주제>`(CLAUDE.md `›` 스타일) → 제목(H1) → 메타(주제·작성자·공개일·**조회수**) → hero → **마크다운 본문**(`<Markdown>` 컴포넌트) → 댓글 섹션.
- **조회수 (route handler + 클라이언트 ping)**: RSC 렌더 중엔 응답 쿠키 set이 불가하므로, 기존 analytics 비콘 패턴(`/api/analytics/log`)을 미러링한다.
  - 상세 페이지에 클라이언트 컴포넌트 `<ColumnViewPing id />`를 마운트 → `useEffect`에서 한 번 `POST /api/columns/[id]/view` 호출(`keepalive`).
  - **route handler `src/app/api/columns/[id]/view/route.ts`**: 쿠키 `col_v_<id>` 확인 → 없으면 `incrementViewCount(id)` + `Set-Cookie col_v_<id>`(Max-Age ~6h, httpOnly, sameSite=lax) → 있으면 no-op. published && topic.visible인 글만 카운트(canCommentOnPost 동일 게이트 재사용 가능).
  - 페이지에 표시되는 조회수는 SSR 시점 값(증가분은 다음 로드에 반영). 클라 ping 방식이라 SSR/프리패치 인플레이션도 자연 방지. 봇 완전 차단은 목표 아님.

### 6.4 `<Markdown>` 컴포넌트 (`src/components/Markdown.tsx`)
- 공개 본문 + 에디터 미리보기 **공용**. `react-markdown` + `remark-gfm`, raw HTML 비허용.
- 허용 요소: 제목(h1~h3), 굵게/기울임, 목록(ul/ol), 인용(blockquote), 링크(underline·블랙), 코드(inline/block), 이미지, 표, 구분선.
- `components` 매핑으로 각 요소에 디자인 톤 클래스 부여(링크 underline, 이미지 flat·max-w-full, 인용 좌측 보더 등). 본문 외 폭은 `max-w-3xl`(news 상세와 동일 리듬).
- **URL 정책** (`urlTransform` prop으로 명시 — 작성자가 어드민이라도 방어):
  - **링크(`a`)**: `http:`/`https:`/`mailto:` + 사이트 내 상대경로(`/`로 시작)만 허용. 그 외(`javascript:`, `vbscript:`, `file:`, `data:` 등)는 `#`로 치환·드롭. 외부 링크는 `rel="nofollow noopener noreferrer" target="_blank"`.
  - **이미지(`img`)**: 업로드 경로(`/uploads/columns/...`)와 `https:` 외부 이미지만 허용. `data:`·기타 스킴은 드롭(렌더 안 함). 외부 이미지는 `next.config.ts` `images.remotePatterns` 미등록 시 일반 `<img>`로 폴백(Next `<Image>` 강제하지 않음 — 본문 이미지는 폭만 제한).
  - react-markdown 기본 `defaultUrlTransform`이 위험 스킴을 1차 제거하지만, 위 화이트리스트를 커스텀 `urlTransform`으로 **명시 구현**(구현자가 놓치지 않도록).

### 6.5 SEO / sitemap (공개 라우트 반영)
공개 라우트 추가이므로 기존 패턴에 반드시 반영(누락 시 검색 노출 빠짐):
- **sitemap**: `src/app/sitemap.ts` / `src/lib/sitemap.ts`에 `/columns`(정적) + 공개 칼럼 상세(`getPublishedPosts`로 동적 URL·`lastModified=updated_at`) 추가. 기존 news 상세가 sitemap에 들어가는 방식을 그대로 따름.
- **metadata**: `/columns/[id]/page.tsx`에 `generateMetadata`(제목·발췌 description·OG). `/columns/page.tsx`에 정적 metadata. `src/lib/seo.ts` 헬퍼 패턴 재사용.
- **JSON-LD**: 상세 페이지에 `Article`(또는 `BlogPosting`) JSON-LD를 seo.ts 패턴으로 주입(news 상세가 하는 방식 확인 후 동일하게).

## 7. 익명 댓글

### 7.1 표시 + 작성 UI — `src/components/ColumnComments.tsx` (클라이언트)
상세 페이지가 서버에서 초기 댓글 목록을 props로 넘기고, 이 컴포넌트가 목록 렌더 + 작성/삭제 폼을 담당.
- **목록**: 각 댓글 `닉네임 · IP일부(maskIp) · 상대시각 · 본문(이스케이프 평문)`. `password_hash`가 있던 댓글엔 "삭제" 버튼. 정렬 `created_at ASC`(오래된 것부터, 평면).
- **작성 폼**: 닉네임·비밀번호(선택)·본문 + **허니팟 hidden 필드(`website`)**. 제출 → `POST /api/columns/[id]/comments`.
- **삭제**: "삭제" 클릭 → 비번 입력 프롬프트 → `DELETE /api/columns/comments/[cid]`(body에 비번).
- **흐름/실패 처리**: 성공 시 `router.refresh()`로 서버 컴포넌트 재검증(최신 목록 반영) + 폼 리셋. 실패 시 인라인 에러 메시지(레이트리밋 "잠시 후 다시", 검증 실패, 비번 불일치 등). 제출 중 버튼 disabled.
- 비번 설정 댓글의 삭제 버튼 노출 여부는 `password_hash IS NOT NULL` 불리언만 props로 전달(해시 자체는 절대 미노출).

### 7.2 작성 — `POST /api/columns/[id]/comments` (`src/app/api/columns/[id]/comments/route.ts`)
- **공개 게이트(필수)**: insert 전에 **`canCommentOnPost(id)` 확인** → false면 `404`. `post_id`만 맞으면 초안/숨김 글에도 댓글이 쌓이는 것을 차단(published=1 && topic.visible=1인 글에만 허용).
- IP: `req.headers.get("x-forwarded-for")`(첫 값) → 폴백 `x-real-ip`(기존 analytics 라우트 패턴 재사용).
- zod 검증: `nickname` 1~40, `body` 1~1000, `password` 선택(있으면 4자+).
- **봇 방지**: (a) **허니팟** hidden 필드(`website`)가 비어있지 않으면 무시(200으로 가장), (b) **동일 IP 15초 레이트리밋**(`getLatestCommentAtByIp`).
- 비번 제공 시 bcrypt 해시 저장. `visible=1` 삽입. 응답은 단순 성공(클라가 `router.refresh()`로 갱신).

### 7.3 본인 삭제 — `DELETE /api/columns/comments/[cid]` (`src/app/api/columns/comments/[cid]/route.ts`)
- body의 비번을 `password_hash`와 bcrypt 대조 → 일치 시 **하드 삭제**. `password_hash` NULL이면 거부.

## 8. 어드민 (`/admin/columns`)

`src/components/admin/AdminNav.tsx` items에 `/admin/columns` 추가. 모든 서버 액션은 `readSession()` 가드(기존 패턴).

| 경로 | 내용 |
|------|------|
| `/admin/(authed)/columns/page.tsx` | **글 목록** 테이블: 썸네일·제목·주제·작성자·공개토글·**조회수·댓글수**·수정. "새 글" 버튼 |
| `/admin/(authed)/columns/new/page.tsx` | 글 생성 폼 (`ColumnForm`) |
| `/admin/(authed)/columns/[id]/page.tsx` | 글 수정 폼 (`ColumnForm`) |
| `/admin/(authed)/columns/topics/page.tsx` | **주제 관리**: 목록·생성·수정·숨김토글·정렬·멤버 연결 |
| `/admin/(authed)/columns/comments/page.tsx` | **전 댓글 일괄 관리/모더레이션**: 글제목·닉·**전체 IP**·본문·시각·숨김토글·삭제 (글별 필터 옵션) |

- **`ColumnForm`** (`src/components/admin/ColumnForm.tsx`): 주제 select(필수)·제목·hero(`<ImageUpload resource="columns">`)·발췌(선택)·본문(`<ColumnBodyEditor>`)·공개 토글.
- **`ColumnBodyEditor`** (`src/components/admin/ColumnBodyEditor.tsx`, 클라이언트): textarea + 툴바(H2/H3·굵게·기울임·인용·목록·링크·**이미지 업로드**) → 커서 위치에 마크다운 삽입. 이미지 버튼은 기존 `uploadImage(formData, "columns")` 호출 후 `![alt](path)` 삽입. "미리보기" 토글 → `<Markdown>`로 렌더.
- **서버 액션** (`.../columns/actions.ts`): `createTopic` / `updateTopic` / `toggleTopicVisible` / `deleteTopic` / `createPost` / `updatePost` / `togglePostPublished` / `deletePost` / `toggleCommentVisible` / `deleteComment`. zod 검증 + `readSession()`.

## 9. 업로드 RESOURCES 동기화 (⚠️ 두 곳)
`"columns"`를 **반드시 두 리스트 모두에** 추가 (한쪽만 하면 디스크에 파일 있어도 GET 404):
- `src/lib/upload.ts` 의 `RESOURCES` 배열
- `src/app/uploads/[resource]/[filename]/route.ts` 의 `RESOURCES` Set

## 10. 보안/sanitization 요약
- 댓글 본문: 평문 저장 + React 기본 이스케이프 렌더(마크다운/HTML 미해석).
- 마크다운 본문: react-markdown raw HTML 비활성 + 커스텀 `urlTransform`(링크/이미지 스킴 화이트리스트, §6.4) → XSS·위험 스킴 차단.
- 댓글 비번: bcrypt 해시, 응답/렌더에 절대 노출 안 함(`password_hash IS NOT NULL` 불리언만 클라 전달).
- **댓글 작성 게이트**: `canCommentOnPost`(published && topic.visible) 통과한 글에만 insert. 초안/숨김 글 댓글 적재 차단.
- IP: 전체 저장(어드민만 열람), 공개는 `maskIp` 일부만.
- 봇 방지: 허니팟 + 동일 IP 15초 레이트리밋.

## 11. 테스트 (node:test, 기존 `src/lib/*.test.ts` 패턴)
- `maskIp`: IPv4 정상/IPv6/빈값·비정상 폴백.
- `excerptFromMarkdown`: 마크다운 기호 제거 + 길이 truncate(+말줄임).
- 댓글 zod 스키마: 닉/본문 경계, 허니팟.
- 가시성 규칙(`canCommentOnPost` = published && topic.visible): 초안/숨김주제 글이 false.
- `urlTransform`: `javascript:`/`data:`(링크) 드롭, `/uploads/...`·`https:` 통과 등 스킴 화이트리스트.
- 공개 정렬: `COALESCE(published_at, created_at)` — 과거 created 초안을 나중 공개 시 최상단.

## 12. 배포 (메모리 규칙 준수)
1. **dev에서만** 코드 작성.
2. `018_columns.sql`을 **DEV DB(`BANDSUSTAIN_DEV`) 먼저** 적용 (`.db_credentials` 사용, `DB_CREDENTIALS_PATH` 주의).
3. `pnpm build` → `pm2 restart bandsustain-dev` → https://dev.bandsustain.com 검증.
4. dev 푸시 후 **⛔ 멈춤. 사용자에게 dev 확인 요청.**
5. 운영 반영은 사용자가 명시 요청한 경우에만: main 머지 → 운영 pull/build/restart **+ PROD DB에도 마이그 018 적용**(운영 수동 배포 절차 참조).

## 13. 변경 파일 요약
- **신규**: `db/schema/018_columns.sql`, `src/lib/columns.ts`(+`.test.ts`), `src/components/Markdown.tsx`, `src/components/ColumnComments.tsx`, `src/components/ColumnViewPing.tsx`, `src/app/columns/page.tsx`, `src/app/columns/[id]/page.tsx`, `src/app/api/columns/[id]/comments/route.ts`, `src/app/api/columns/[id]/view/route.ts`, `src/app/api/columns/comments/[cid]/route.ts`, `src/components/admin/ColumnForm.tsx`, `src/components/admin/ColumnBodyEditor.tsx`, `src/app/admin/(authed)/columns/{page,new/page,[id]/page,topics/page,comments/page}.tsx`, `.../columns/actions.ts`.
- **수정**: `src/components/Nav.tsx`(칼럼 링크), `src/components/admin/AdminNav.tsx`(어드민 링크), `src/lib/upload.ts` + `src/app/uploads/[resource]/[filename]/route.ts`(RESOURCES에 columns), `src/app/sitemap.ts` + `src/lib/sitemap.ts`(/columns + 공개 상세), `src/lib/seo.ts`(필요 시 칼럼 metadata/JSON-LD 헬퍼), `package.json`(react-markdown, remark-gfm).

## 14. 범위 밖 (YAGNI)
- 대댓글/스레딩, 댓글 좋아요/추천, 댓글 페이지네이션(초기엔 전체 로드), 주제 구독/알림, 글 예약 발행, 다크모드, 마크다운 raw HTML/임베드.
