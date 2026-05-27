# 칼럼 게시판 (Columns) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bandsustain.com에 멤버별 칼럼 게시판(`/columns`) 추가 — 주제(토픽) 칩 필터, 마크다운 글쓰기(이미지 첨부·미리보기), 익명 댓글(IP 일부·비번 본인삭제), 조회수/댓글수 메타, 어드민 CRUD/모더레이션.

**Architecture:** 기존 `news` 기능 패턴(마이그 SQL + `src/lib` 데이터 레이어 + 어드민 CRUD + 이미지 업로드 + 공개 리스트/상세)을 미러링하고, 그 위에 주제·댓글 두 축을 얹는다. 순수 로직(IP 마스킹·발췌·URL 검증·zod)은 server-only가 아닌 별도 모듈로 분리해 `node:test`로 TDD하고, DB/UI는 레포 관례대로 빌드+lint+수동 스모크로 검증한다.

**Tech Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + MariaDB(mysql2) + zod + bcryptjs + react-markdown/remark-gfm. 스펙: `docs/superpowers/specs/2026-05-27-columns-board-design.md`.

> **공통 규칙**: (1) bandsustain-dev, dev 브랜치에서만 작업. (2) 모든 커밋 메시지는 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` 트레일러로 끝낸다(아래 커밋 예시엔 생략). (3) 테스트 실행: `npx tsx --test <path>`. (4) `git add`에 `.`를 쓰지 말 것 — `public/playground/images` 심볼릭 링크가 untracked로 떠 있으므로 항상 파일을 명시 add.

---

### Task 1: 의존성 추가 + 마이그레이션 작성 + DEV DB 적용

**Files:**
- Modify: `package.json` (deps)
- Create: `db/schema/018_columns.sql`

- [ ] **Step 1: 마크다운 의존성 설치**

Run:
```bash
cd /root/bandsustain-dev/public_html/bandsustain
pnpm add react-markdown remark-gfm
```
Expected: `package.json` dependencies에 `react-markdown`, `remark-gfm` 추가, lockfile 갱신.

- [ ] **Step 2: 마이그레이션 SQL 작성**

Create `db/schema/018_columns.sql`:
```sql
-- 018_columns.sql
-- bandsustain.com /columns 탭 — 멤버별 칼럼 게시판 (주제/글/댓글)

CREATE TABLE IF NOT EXISTS column_topics (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(120)  NOT NULL,
  member_id   INT           NULL,
  description VARCHAR(500)  NULL,
  visible     TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_topic_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
  INDEX idx_visible_sort (visible, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS column_posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  topic_id     INT           NOT NULL,
  title        VARCHAR(200)  NOT NULL,
  hero_image   VARCHAR(255)  NULL,
  excerpt      VARCHAR(500)  NULL,
  body         MEDIUMTEXT    NOT NULL,
  view_count   INT           NOT NULL DEFAULT 0,
  published    TINYINT(1)    NOT NULL DEFAULT 0,
  published_at TIMESTAMP     NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_topic FOREIGN KEY (topic_id) REFERENCES column_topics(id) ON DELETE CASCADE,
  INDEX idx_published_order (published, published_at DESC, id),
  INDEX idx_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS column_comments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  post_id       INT           NOT NULL,
  nickname      VARCHAR(40)   NOT NULL,
  password_hash VARCHAR(72)   NULL,
  body          VARCHAR(1000) NOT NULL,
  ip            VARCHAR(45)   NOT NULL,
  visible       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES column_posts(id) ON DELETE CASCADE,
  INDEX idx_post_visible (post_id, visible, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 3: DEV DB 확인 (PROD 아님 가드)**

Run:
```bash
cd /root/bandsustain-dev/public_html/bandsustain
grep -E '^DB_NAME=' .db_credentials
```
Expected: `DB_NAME=BANDSUSTAIN_DEV` (반드시 `_DEV`. 아니면 중단 — DEV 자격증명이 아님).

- [ ] **Step 4: DEV DB에 마이그 적용**

Run:
```bash
cd /root/bandsustain-dev/public_html/bandsustain
DBH=$(grep -E '^DB_HOST=' .db_credentials | cut -d= -f2-)
DBU=$(grep -E '^DB_USER=' .db_credentials | cut -d= -f2-)
DBP=$(grep -E '^DB_PASS=' .db_credentials | cut -d= -f2-)
DBN=$(grep -E '^DB_NAME=' .db_credentials | cut -d= -f2-)
mysql -h "$DBH" -u "$DBU" -p"$DBP" "$DBN" < db/schema/018_columns.sql
mysql -h "$DBH" -u "$DBU" -p"$DBP" "$DBN" -e "SHOW TABLES LIKE 'column_%';"
```
Expected: `column_comments`, `column_posts`, `column_topics` 3개 출력.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml db/schema/018_columns.sql
git commit -m "feat(columns): 의존성(react-markdown) + 018 마이그(주제/글/댓글) + DEV 적용"
```

---

### Task 2: 순수 포맷 헬퍼 `columnsFormat.ts` (TDD)

**Files:**
- Create: `src/lib/columnsFormat.ts`
- Test: `src/lib/columnsFormat.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/columnsFormat.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { maskIp, excerptFromMarkdown, formatColumnDate, timeAgo } from "./columnsFormat";

test("maskIp keeps first two IPv4 octets", () => {
  assert.equal(maskIp("121.131.45.200"), "121.131");
});

test("maskIp handles IPv6 by first two hextets", () => {
  assert.equal(maskIp("2001:db8::1"), "2001:db8");
});

test("maskIp falls back for empty/garbage", () => {
  assert.equal(maskIp(""), "?");
  assert.equal(maskIp("   "), "?");
});

test("excerptFromMarkdown strips markdown and truncates with ellipsis", () => {
  const md = "# 제목\n\n**굵게** 그리고 [링크](https://x.com) 와 `코드`.\n\n![img](/uploads/columns/a.jpg)";
  const out = excerptFromMarkdown(md, 20);
  assert.ok(!out.includes("#"));
  assert.ok(!out.includes("!["));
  assert.ok(!out.includes("https://x.com"));
  assert.ok(out.includes("링크"));
  assert.ok(out.length <= 20);
  assert.ok(out.endsWith("..."));
});

test("excerptFromMarkdown returns whole string when short", () => {
  assert.equal(excerptFromMarkdown("짧은 글", 100), "짧은 글");
});

test("formatColumnDate is YYYY-MM-DD", () => {
  assert.equal(formatColumnDate(new Date(2026, 4, 27)), "2026-05-27");
});

test("timeAgo gives relative korean labels", () => {
  const now = new Date(2026, 4, 27, 12, 0, 0);
  assert.equal(timeAgo(new Date(2026, 4, 27, 11, 59, 30), now), "방금 전");
  assert.equal(timeAgo(new Date(2026, 4, 27, 11, 30, 0), now), "30분 전");
  assert.equal(timeAgo(new Date(2026, 4, 27, 9, 0, 0), now), "3시간 전");
  assert.equal(timeAgo(new Date(2026, 4, 25, 12, 0, 0), now), "2일 전");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/columnsFormat.test.ts`
Expected: FAIL (Cannot find module './columnsFormat').

- [ ] **Step 3: 구현 작성**

Create `src/lib/columnsFormat.ts`:
```ts
// Pure formatting helpers for the columns feature. No DB / server-only imports
// so this module can be unit-tested directly with `tsx --test`.

export function maskIp(ip: string): string {
  const v = (ip || "").trim();
  if (!v) return "?";
  const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}`;
  if (v.includes(":")) {
    const groups = v.split(":").filter(Boolean);
    if (groups.length >= 2) return `${groups[0]}:${groups[1]}`;
    if (groups.length === 1) return groups[0];
    return "?";
  }
  return v.split(".")[0] || "?";
}

export function excerptFromMarkdown(body: string, max: number): string {
  const plain = (body || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~`#>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (max <= 0) return "";
  if (plain.length <= max) return plain;
  if (max <= 3) return plain.slice(0, max);
  return `${plain.slice(0, max - 3).trimEnd()}...`;
}

export function formatColumnDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeAgo(date: Date, now: Date = new Date()): string {
  const sec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return formatColumnDate(date);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/columnsFormat.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/columnsFormat.ts src/lib/columnsFormat.test.ts
git commit -m "feat(columns): 순수 포맷 헬퍼(maskIp/excerpt/date/timeAgo) + 테스트"
```

---

### Task 3: 마크다운 URL 화이트리스트 `markdownUrl.ts` (TDD)

**Files:**
- Create: `src/lib/markdownUrl.ts`
- Test: `src/lib/markdownUrl.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/markdownUrl.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeMarkdownUrl } from "./markdownUrl";

test("allows http/https/mailto", () => {
  assert.equal(sanitizeMarkdownUrl("https://x.com/a"), "https://x.com/a");
  assert.equal(sanitizeMarkdownUrl("http://x.com"), "http://x.com");
  assert.equal(sanitizeMarkdownUrl("mailto:a@b.com"), "mailto:a@b.com");
});

test("allows site-relative and anchors and bare relative", () => {
  assert.equal(sanitizeMarkdownUrl("/uploads/columns/a.jpg"), "/uploads/columns/a.jpg");
  assert.equal(sanitizeMarkdownUrl("#sec"), "#sec");
  assert.equal(sanitizeMarkdownUrl("foo/bar"), "foo/bar");
});

test("drops dangerous schemes", () => {
  assert.equal(sanitizeMarkdownUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeMarkdownUrl("data:text/html;base64,x"), "");
  assert.equal(sanitizeMarkdownUrl("vbscript:x"), "");
  assert.equal(sanitizeMarkdownUrl("file:///etc/passwd"), "");
});

test("empty stays empty", () => {
  assert.equal(sanitizeMarkdownUrl(""), "");
  assert.equal(sanitizeMarkdownUrl("   "), "");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/markdownUrl.test.ts`
Expected: FAIL (Cannot find module './markdownUrl').

- [ ] **Step 3: 구현 작성**

Create `src/lib/markdownUrl.ts`:
```ts
// Whitelist transform for markdown link/image URLs. Returns "" to drop the URL.
// Shared by the public <Markdown> renderer and the editor preview.
const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

export function sanitizeMarkdownUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("#")) return raw;
  const m = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
  if (!m) return raw; // bare relative path (no scheme) — safe
  return SAFE_SCHEMES.includes(m[1].toLowerCase()) ? raw : "";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/markdownUrl.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdownUrl.ts src/lib/markdownUrl.test.ts
git commit -m "feat(columns): 마크다운 URL 화이트리스트 sanitize + 테스트"
```

---

### Task 4: zod 검증 스키마 `columnsValidation.ts` (TDD)

**Files:**
- Create: `src/lib/columnsValidation.ts`
- Test: `src/lib/columnsValidation.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/columnsValidation.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";
import { commentInputSchema, topicSchema, postSchema } from "./columnsValidation";

test("commentInputSchema accepts valid input", () => {
  const r = commentInputSchema.safeParse({ nickname: "영민팬", body: "좋은 글이에요" });
  assert.ok(r.success);
});

test("commentInputSchema rejects empty nickname/body", () => {
  assert.ok(!commentInputSchema.safeParse({ nickname: "", body: "x" }).success);
  assert.ok(!commentInputSchema.safeParse({ nickname: "a", body: "" }).success);
});

test("commentInputSchema rejects too-long body", () => {
  assert.ok(!commentInputSchema.safeParse({ nickname: "a", body: "x".repeat(1001) }).success);
});

test("commentInputSchema rejects short password but allows empty", () => {
  assert.ok(!commentInputSchema.safeParse({ nickname: "a", body: "b", password: "12" }).success);
  assert.ok(commentInputSchema.safeParse({ nickname: "a", body: "b", password: "" }).success);
});

test("topicSchema coerces optional memberId and defaults sortOrder", () => {
  const r = topicSchema.safeParse({ title: "역사갤러리", memberId: "", description: "", sortOrder: "" });
  assert.ok(r.success);
  assert.equal(r.data.memberId, undefined);
  assert.equal(r.data.sortOrder, 0);
  const r2 = topicSchema.safeParse({ title: "t", memberId: "3", sortOrder: "5" });
  assert.ok(r2.success && r2.data.memberId === 3 && r2.data.sortOrder === 5);
});

test("postSchema requires positive topicId and non-empty body", () => {
  assert.ok(!postSchema.safeParse({ topicId: "0", title: "t", body: "b" }).success);
  assert.ok(!postSchema.safeParse({ topicId: "1", title: "t", body: "" }).success);
  assert.ok(postSchema.safeParse({ topicId: "1", title: "t", body: "b", heroImage: "", excerpt: "" }).success);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/columnsValidation.test.ts`
Expected: FAIL (Cannot find module './columnsValidation').

- [ ] **Step 3: 구현 작성**

Create `src/lib/columnsValidation.ts`:
```ts
import { z } from "zod";

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

const intWithDefault = (def: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? def : Number(v)),
    z.number().int(),
  );

export const commentInputSchema = z.object({
  nickname: z.string().trim().min(1, "닉네임을 입력하세요").max(40),
  body: z.string().trim().min(1, "내용을 입력하세요").max(1000, "1000자 이내"),
  password: z
    .union([z.string().min(4, "비밀번호는 4자 이상").max(72), z.literal("")])
    .optional(),
  website: z.string().optional(), // honeypot (route ignores non-empty)
});
export type CommentInput = z.infer<typeof commentInputSchema>;

export const topicSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(120),
  memberId: optionalPositiveInt,
  description: z.union([z.string().max(500), z.literal("")]).optional(),
  sortOrder: intWithDefault(0),
});
export type TopicInput = z.infer<typeof topicSchema>;

export const postSchema = z.object({
  topicId: z.preprocess((v) => Number(v), z.number().int().positive("주제를 선택하세요")),
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  heroImage: z.union([z.string().max(255), z.literal("")]).optional(),
  excerpt: z.union([z.string().max(500), z.literal("")]).optional(),
  body: z.string().min(1, "본문을 입력하세요"),
});
export type PostInput = z.infer<typeof postSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/columnsValidation.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/columnsValidation.ts src/lib/columnsValidation.test.ts
git commit -m "feat(columns): zod 스키마(comment/topic/post) + 테스트"
```

---

### Task 5: 데이터 레이어 `columns.ts` (server-only)

**Files:**
- Create: `src/lib/columns.ts`

> 레포 관례상 server-only(DB) 모듈은 단위 테스트하지 않는다. 검증은 타입체크/빌드(Task 18)와 수동 스모크로 한다.

- [ ] **Step 1: 타입 + row 매퍼 + 조회 함수 작성**

Create `src/lib/columns.ts`:
```ts
import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "./db";
import { maskIp } from "./columnsFormat";

export type ColumnTopic = {
  id: number;
  title: string;
  memberId: number | null;
  authorName: string | null; // members.name_kr
  description: string | null;
  visible: boolean;
  sortOrder: number;
};

export type ColumnPost = {
  id: number;
  topicId: number;
  topicTitle: string;
  authorName: string | null;
  title: string;
  heroImage: string | null;
  excerpt: string | null;
  body: string;
  viewCount: number;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  commentCount: number;
};

// data-layer shape (distinct from ColumnComments.tsx's client `PublicComment`)
export type VisibleComment = {
  id: number;
  nickname: string;
  ipMasked: string;
  body: string;
  createdAt: Date;
  hasPassword: boolean;
};

export type AdminComment = {
  id: number;
  postId: number;
  postTitle: string;
  nickname: string;
  ip: string;
  body: string;
  visible: boolean;
  createdAt: Date;
};

type TopicRow = RowDataPacket & {
  id: number; title: string; member_id: number | null; author_name: string | null;
  description: string | null; visible: number; sort_order: number;
};
type PostRow = RowDataPacket & {
  id: number; topic_id: number; topic_title: string; author_name: string | null;
  title: string; hero_image: string | null; excerpt: string | null; body: string;
  view_count: number; published: number; published_at: Date | null; created_at: Date;
  comment_count: number;
};

function toTopic(r: TopicRow): ColumnTopic {
  return {
    id: r.id, title: r.title, memberId: r.member_id, authorName: r.author_name,
    description: r.description, visible: r.visible === 1, sortOrder: r.sort_order,
  };
}
function toDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}
function toPost(r: PostRow): ColumnPost {
  return {
    id: r.id, topicId: r.topic_id, topicTitle: r.topic_title, authorName: r.author_name,
    title: r.title, heroImage: r.hero_image, excerpt: r.excerpt, body: r.body,
    viewCount: r.view_count, published: r.published === 1,
    publishedAt: toDate(r.published_at), createdAt: toDate(r.created_at) as Date,
    commentCount: Number(r.comment_count ?? 0),
  };
}

const POST_SELECT = `
  SELECT p.id, p.topic_id, t.title AS topic_title, m.name_kr AS author_name,
         p.title, p.hero_image, p.excerpt, p.body, p.view_count, p.published,
         p.published_at, p.created_at,
         (SELECT COUNT(*) FROM column_comments c WHERE c.post_id = p.id AND c.visible = 1) AS comment_count
  FROM column_posts p
  JOIN column_topics t ON t.id = p.topic_id
  LEFT JOIN members m ON m.id = t.member_id`;

// ---- topics ----
export async function getVisibleTopics(): Promise<ColumnTopic[]> {
  const [rows] = await getPool().query<TopicRow[]>(
    `SELECT t.id, t.title, t.member_id, m.name_kr AS author_name, t.description, t.visible, t.sort_order
     FROM column_topics t LEFT JOIN members m ON m.id = t.member_id
     WHERE t.visible = 1 ORDER BY t.sort_order ASC, t.id ASC`,
  );
  return rows.map(toTopic);
}
export async function getAllTopicsForAdmin(): Promise<ColumnTopic[]> {
  const [rows] = await getPool().query<TopicRow[]>(
    `SELECT t.id, t.title, t.member_id, m.name_kr AS author_name, t.description, t.visible, t.sort_order
     FROM column_topics t LEFT JOIN members m ON m.id = t.member_id
     ORDER BY t.sort_order ASC, t.id ASC`,
  );
  return rows.map(toTopic);
}
export async function getTopicById(id: number): Promise<ColumnTopic | null> {
  const [rows] = await getPool().query<TopicRow[]>(
    `SELECT t.id, t.title, t.member_id, m.name_kr AS author_name, t.description, t.visible, t.sort_order
     FROM column_topics t LEFT JOIN members m ON m.id = t.member_id WHERE t.id = ?`, [id],
  );
  return rows[0] ? toTopic(rows[0]) : null;
}

// ---- posts ----
export async function getPublishedPosts(opts: { topicId?: number } = {}): Promise<ColumnPost[]> {
  const where = `WHERE p.published = 1 AND t.visible = 1${opts.topicId ? " AND p.topic_id = ?" : ""}`;
  const order = `ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC`;
  const args = opts.topicId ? [opts.topicId] : [];
  const [rows] = await getPool().query<PostRow[]>(`${POST_SELECT} ${where} ${order}`, args);
  return rows.map(toPost);
}
export async function getAllPostsForAdmin(): Promise<ColumnPost[]> {
  // comment_count here counts ALL comments (incl. hidden) for moderation overview
  const [rows] = await getPool().query<PostRow[]>(
    `SELECT p.id, p.topic_id, t.title AS topic_title, m.name_kr AS author_name,
            p.title, p.hero_image, p.excerpt, p.body, p.view_count, p.published,
            p.published_at, p.created_at,
            (SELECT COUNT(*) FROM column_comments c WHERE c.post_id = p.id) AS comment_count
     FROM column_posts p
     JOIN column_topics t ON t.id = p.topic_id
     LEFT JOIN members m ON m.id = t.member_id
     ORDER BY p.created_at DESC, p.id DESC`,
  );
  return rows.map(toPost);
}
export async function getPublishedPostById(id: number): Promise<ColumnPost | null> {
  const [rows] = await getPool().query<PostRow[]>(
    `${POST_SELECT} WHERE p.id = ? AND p.published = 1 AND t.visible = 1`, [id],
  );
  return rows[0] ? toPost(rows[0]) : null;
}
export async function getPostByIdForAdmin(id: number): Promise<ColumnPost | null> {
  const [rows] = await getPool().query<PostRow[]>(`${POST_SELECT} WHERE p.id = ?`, [id]);
  return rows[0] ? toPost(rows[0]) : null;
}
export async function incrementViewCount(id: number): Promise<void> {
  await getPool().query(`UPDATE column_posts SET view_count = view_count + 1 WHERE id = ?`, [id]);
}
export async function canCommentOnPost(id: number): Promise<boolean> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT 1 FROM column_posts p JOIN column_topics t ON t.id = p.topic_id
     WHERE p.id = ? AND p.published = 1 AND t.visible = 1 LIMIT 1`, [id],
  );
  return rows.length > 0;
}

// ---- comments ----
export async function getVisibleComments(postId: number): Promise<VisibleComment[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, nickname, ip, body, password_hash, created_at
     FROM column_comments WHERE post_id = ? AND visible = 1 ORDER BY created_at ASC, id ASC`, [postId],
  );
  return rows.map((r) => ({
    id: r.id, nickname: r.nickname, ipMasked: maskIp(r.ip), body: r.body,
    createdAt: toDate(r.created_at) as Date, hasPassword: r.password_hash != null,
  }));
}
export async function getAllCommentsForAdmin(opts: { postId?: number } = {}): Promise<AdminComment[]> {
  const where = opts.postId ? "WHERE c.post_id = ?" : "";
  const args = opts.postId ? [opts.postId] : [];
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT c.id, c.post_id, p.title AS post_title, c.nickname, c.ip, c.body, c.visible, c.created_at
     FROM column_comments c JOIN column_posts p ON p.id = c.post_id
     ${where} ORDER BY c.created_at DESC, c.id DESC`, args,
  );
  return rows.map((r) => ({
    id: r.id, postId: r.post_id, postTitle: r.post_title, nickname: r.nickname,
    ip: r.ip, body: r.body, visible: r.visible === 1, createdAt: toDate(r.created_at) as Date,
  }));
}
export async function getLatestCommentAtByIp(ip: string): Promise<Date | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT created_at FROM column_comments WHERE ip = ? ORDER BY id DESC LIMIT 1`, [ip],
  );
  return rows[0] ? (toDate(rows[0].created_at) as Date) : null;
}
export async function getCommentAuthRow(
  id: number,
): Promise<{ id: number; postId: number; passwordHash: string | null } | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, post_id, password_hash FROM column_comments WHERE id = ?`, [id],
  );
  return rows[0] ? { id: rows[0].id, postId: rows[0].post_id, passwordHash: rows[0].password_hash } : null;
}
export async function insertComment(input: {
  postId: number; nickname: string; body: string; ip: string; passwordHash: string | null;
}): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO column_comments (post_id, nickname, password_hash, body, ip, visible)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [input.postId, input.nickname, input.passwordHash, input.body, input.ip],
  );
  return res.insertId;
}
export async function deleteCommentById(id: number): Promise<void> {
  await getPool().query(`DELETE FROM column_comments WHERE id = ?`, [id]);
}
export async function setCommentVisible(id: number, visible: boolean): Promise<void> {
  await getPool().query(`UPDATE column_comments SET visible = ? WHERE id = ?`, [visible ? 1 : 0, id]);
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i columns || echo "no columns type errors"`
Expected: `no columns type errors` (또는 columns.ts 관련 에러 없음).

- [ ] **Step 3: Commit**

```bash
git add src/lib/columns.ts
git commit -m "feat(columns): DB 데이터 레이어(주제/글/댓글 조회·삽입·조회수·게이트)"
```

---

### Task 6: `<Markdown>` 렌더 컴포넌트

**Files:**
- Create: `src/components/Markdown.tsx`

- [ ] **Step 1: 컴포넌트 작성**

Create `src/components/Markdown.tsx`:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeMarkdownUrl } from "@/lib/markdownUrl";

// Renders trusted (admin-authored) markdown. raw HTML is NOT enabled
// (react-markdown default) and URLs pass through a scheme whitelist.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-base md:text-lg leading-[1.75] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => sanitizeMarkdownUrl(url)}
        components={{
          h1: (p) => <h2 className="font-display font-bold text-2xl md:text-3xl mt-10 mb-4 tracking-tight" {...p} />,
          h2: (p) => <h2 className="font-display font-bold text-2xl md:text-3xl mt-10 mb-4 tracking-tight" {...p} />,
          h3: (p) => <h3 className="font-bold text-lg md:text-xl mt-8 mb-3" {...p} />,
          p: (p) => <p className="mb-6" {...p} />,
          a: ({ href, ...p }) => {
            const external = !!href && /^https?:/i.test(href);
            return (
              <a
                href={href}
                className="underline underline-offset-4 hover:decoration-2"
                {...(external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}
                {...p}
              />
            );
          },
          ul: (p) => <ul className="list-disc pl-6 mb-6 space-y-1" {...p} />,
          ol: (p) => <ol className="list-decimal pl-6 mb-6 space-y-1" {...p} />,
          li: (p) => <li className="leading-[1.7]" {...p} />,
          blockquote: (p) => (
            <blockquote className="border-l-4 border-[var(--color-border-strong)] pl-4 italic text-[var(--color-text-muted)] my-6" {...p} />
          ),
          code: ({ className, ...p }) => (
            <code className={"bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-[0.9em] " + (className ?? "")} {...p} />
          ),
          pre: (p) => <pre className="bg-[var(--color-bg-muted)] p-4 overflow-x-auto text-sm mb-6" {...p} />,
          img: ({ src, alt }) => {
            if (!src || typeof src !== "string") return null;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={src} alt={alt ?? ""} className="max-w-full h-auto my-6" loading="lazy" />;
          },
          hr: () => <hr className="my-10 border-[var(--color-border)]" />,
          table: (p) => <div className="overflow-x-auto my-6"><table className="w-full text-sm border-collapse" {...p} /></div>,
          th: (p) => <th className="border border-[var(--color-border)] px-3 py-2 text-left bg-[var(--color-bg-muted)]" {...p} />,
          td: (p) => <td className="border border-[var(--color-border)] px-3 py-2" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 검증 (react-markdown API 확인)**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "Markdown.tsx" || echo "ok"`
Expected: `ok`. (만약 `urlTransform`/`img src` 타입 에러가 나면 설치된 react-markdown 버전의 `node_modules/react-markdown/` 타입을 확인해 prop 시그니처를 맞춘다 — v9/v10 모두 `urlTransform`과 string `src`를 지원.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Markdown.tsx
git commit -m "feat(columns): 마크다운 렌더 컴포넌트(gfm+URL 화이트리스트+디자인 매핑)"
```

---

### Task 7: 업로드 RESOURCES에 `columns` 추가 (3곳)

**Files:**
- Modify: `src/lib/upload.ts:9`
- Modify: `src/app/uploads/[resource]/[filename]/route.ts:7`
- Modify: `src/components/admin/ImageUpload.tsx` (Resource 타입)

- [ ] **Step 1: 업로드 액션 RESOURCES**

In `src/lib/upload.ts`, replace:
```ts
const RESOURCES = ["members", "songs", "news", "quotes", "yeongmin"] as const;
```
with:
```ts
const RESOURCES = ["members", "songs", "news", "quotes", "yeongmin", "columns"] as const;
```

- [ ] **Step 2: 서빙 라우트 RESOURCES**

In `src/app/uploads/[resource]/[filename]/route.ts`, replace:
```ts
const RESOURCES = new Set(["members", "songs", "news", "quotes", "yeongmin"]);
```
with:
```ts
const RESOURCES = new Set(["members", "songs", "news", "quotes", "yeongmin", "columns"]);
```

- [ ] **Step 3: ImageUpload Resource 타입**

In `src/components/admin/ImageUpload.tsx`, replace:
```ts
type Resource = "members" | "songs" | "news" | "quotes";
```
with:
```ts
type Resource = "members" | "songs" | "news" | "quotes" | "yeongmin" | "columns";
```

- [ ] **Step 4: 동기화 확인**

Run:
```bash
cd /root/bandsustain-dev/public_html/bandsustain
grep -rn '"columns"' src/lib/upload.ts "src/app/uploads/[resource]/[filename]/route.ts" src/components/admin/ImageUpload.tsx
```
Expected: 3개 파일 모두에 `"columns"` 출현.

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload.ts "src/app/uploads/[resource]/[filename]/route.ts" src/components/admin/ImageUpload.tsx
git commit -m "feat(columns): 업로드 RESOURCES에 columns 추가(업로드/서빙/ImageUpload 3곳)"
```

---

### Task 8: 네비게이션 링크 추가 (공개 + 어드민)

**Files:**
- Modify: `src/components/Nav.tsx`
- Modify: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: 공개 네비에 칼럼 추가**

In `src/components/Nav.tsx`, replace:
```tsx
  { href: "/news", label: "News" },
  { href: "/playground", label: "Playground" },
```
with:
```tsx
  { href: "/news", label: "News" },
  { href: "/columns", label: "칼럼" },
  { href: "/playground", label: "Playground" },
```

- [ ] **Step 2: 어드민 네비에 칼럼 추가**

In `src/components/admin/AdminNav.tsx`, replace:
```tsx
  { href: "/admin/news", label: "News" },
  { href: "/admin/quotes", label: "Quotes" },
```
with:
```tsx
  { href: "/admin/news", label: "News" },
  { href: "/admin/columns", label: "Columns" },
  { href: "/admin/quotes", label: "Quotes" },
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.tsx src/components/admin/AdminNav.tsx
git commit -m "feat(columns): 공개/어드민 네비에 칼럼 링크 추가"
```

---

### Task 9: 공개 리스트 페이지 `/columns`

**Files:**
- Create: `src/app/columns/page.tsx`

- [ ] **Step 1: 리스트 페이지 작성**

Create `src/app/columns/page.tsx`:
```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getVisibleTopics, getPublishedPosts } from "@/lib/columns";
import { excerptFromMarkdown, formatColumnDate } from "@/lib/columnsFormat";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 멤버들이 연재하는 칼럼. 주제별로 멤버들의 글과 이야기를 만나보세요.";

export const metadata: Metadata = buildPageMetadata({
  title: "칼럼",
  path: "/columns",
  description,
  keywords: ["서스테인 칼럼", "밴드 서스테인 칼럼", "Band Sustain column"],
  ogImage: "/slides/hero-a7f3c1e2.jpg",
});

export default async function ColumnsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const sp = await searchParams;
  const topicNum = sp.topic ? Number(sp.topic) : NaN;
  const activeTopic = Number.isInteger(topicNum) ? topicNum : undefined;

  const [topics, posts] = await Promise.all([
    getVisibleTopics(),
    getPublishedPosts({ topicId: activeTopic }),
  ]);

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-14">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Column
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          멤버들이 연재하는 이야기
        </p>
      </header>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-12">
          <ChipLink href="/columns" active={activeTopic === undefined} label="전체" />
          {topics.map((t) => (
            <ChipLink
              key={t.id}
              href={`/columns?topic=${t.id}`}
              active={activeTopic === t.id}
              label={t.title}
            />
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">아직 글이 없습니다.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/columns/${p.id}`} className="group block">
                <div className="relative aspect-[3/2] bg-[var(--color-bg-muted)] mb-4 overflow-hidden flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                  {p.heroImage ? (
                    <Image
                      src={p.heroImage}
                      alt={p.title}
                      fill
                      sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="font-display uppercase tracking-widest px-4 text-center">
                      {p.topicTitle}
                    </span>
                  )}
                </div>
                <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                  {p.topicTitle}
                  {p.authorName ? ` · ${p.authorName}` : ""} · {formatColumnDate(p.publishedAt ?? p.createdAt)}
                </p>
                <h2 className="font-display font-bold text-xl md:text-2xl tracking-tight mb-2 group-hover:underline underline-offset-4 decoration-2">
                  {p.title}
                </h2>
                <p className="text-[var(--color-text-muted)] text-sm leading-[1.6] mb-3">
                  {p.excerpt || excerptFromMarkdown(p.body, 120)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  조회 {p.viewCount} · 댓글 {p.commentCount}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChipLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        "px-5 py-2 text-sm font-medium border border-[var(--color-text)] transition-colors " +
        (active
          ? "bg-[var(--color-text)] text-[var(--color-bg)]"
          : "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]")
      }
    >
      {label}
    </Link>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "columns/page" || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add src/app/columns/page.tsx
git commit -m "feat(columns): 공개 리스트 페이지(주제 칩 필터 + 카드 + 조회/댓글수)"
```

---

### Task 10: 조회수 ping (클라이언트 컴포넌트 + route handler)

**Files:**
- Create: `src/components/ColumnViewPing.tsx`
- Create: `src/app/api/columns/[id]/view/route.ts`

- [ ] **Step 1: ping 컴포넌트 작성**

Create `src/components/ColumnViewPing.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";

// Fires once on mount to register a view. Server route handles cookie dedup,
// so SSR/prefetch never inflates the count.
export default function ColumnViewPing({ id }: { id: number }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch(`/api/columns/${id}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
```

- [ ] **Step 2: view route handler 작성**

Create `src/app/api/columns/[id]/view/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { canCommentOnPost, incrementViewCount } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = new NextResponse(null, { status: 204 });
  try {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId)) return res;
    if (!(await canCommentOnPost(numId))) return res; // only public posts count
    const key = `col_v_${numId}`;
    if (req.cookies.get(key)) return res; // already counted recently
    await incrementViewCount(numId);
    res.cookies.set(key, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });
  } catch {
    // never surface view tracking as an error
  }
  return res;
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "ColumnViewPing|view/route" || echo "ok"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ColumnViewPing.tsx "src/app/api/columns/[id]/view/route.ts"
git commit -m "feat(columns): 조회수 ping 컴포넌트 + view route(쿠키 6h dedup)"
```

---

### Task 11: 댓글 API (작성 POST + 본인삭제 DELETE) + `ColumnComments` UI

**Files:**
- Create: `src/app/api/columns/[id]/comments/route.ts`
- Create: `src/app/api/columns/comments/[cid]/route.ts`
- Create: `src/components/ColumnComments.tsx`

- [ ] **Step 1: 댓글 작성 route**

Create `src/app/api/columns/[id]/comments/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { commentInputSchema } from "@/lib/columnsValidation";
import { canCommentOnPost, getLatestCommentAtByIp, insertComment } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  return (
    (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
      .split(",")[0]
      .trim() || "0.0.0.0"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = commentInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값 오류" },
      { status: 400 },
    );
  }
  const { nickname, body, password, website } = parsed.data;

  // honeypot: pretend success, store nothing
  if (website && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (!(await canCommentOnPost(numId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = clientIp(req);
  const last = await getLatestCommentAtByIp(ip);
  if (last && Date.now() - last.getTime() < 15_000) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const passwordHash = password && password.length > 0 ? await bcrypt.hash(password, 10) : null;
  await insertComment({ postId: numId, nickname, body, ip, passwordHash });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 본인삭제 route**

Create `src/app/api/columns/comments/[cid]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCommentAuthRow, deleteCommentById } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> },
) {
  const { cid } = await params;
  const numId = Number(cid);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const password = json && typeof json.password === "string" ? json.password : "";

  const row = await getCommentAuthRow(numId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.passwordHash) {
    return NextResponse.json({ error: "삭제할 수 없는 댓글입니다." }, { status: 403 });
  }
  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  }
  await deleteCommentById(numId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 댓글 UI 컴포넌트**

Create `src/components/ColumnComments.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type PublicComment = {
  id: number;
  nickname: string;
  ipMasked: string;
  body: string;
  when: string;
  hasPassword: boolean;
};

export default function ColumnComments({
  postId,
  comments,
}: {
  postId: number;
  comments: PublicComment[];
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/columns/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, password, body, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setNickname("");
      setPassword("");
      setBody("");
      router.refresh();
    } catch {
      setError("등록에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    const pw = window.prompt("댓글 비밀번호를 입력하세요");
    if (pw === null) return;
    const res = await fetch(`/api/columns/comments/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-16 md:mt-20 pt-10 border-t border-[var(--color-border)]">
      <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-6">
        댓글 <span className="text-[var(--color-text-muted)]">{comments.length}</span>
      </h2>

      <ul className="flex flex-col divide-y divide-[var(--color-border)] mb-10">
        {comments.length === 0 && (
          <li className="py-6 text-[var(--color-text-muted)] text-sm">첫 댓글을 남겨보세요.</li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="py-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
              <span className="font-medium text-[var(--color-text)]">{c.nickname}</span>
              <span>({c.ipMasked})</span>
              <span>·</span>
              <span>{c.when}</span>
              {c.hasPassword && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="ml-auto underline underline-offset-2 hover:text-[var(--color-text)]"
                >
                  삭제
                </button>
              )}
            </div>
            <p className="text-sm leading-[1.6] whitespace-pre-wrap break-words">{c.body}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex flex-col gap-3 max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={40}
            required
            className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm sm:w-40"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호(선택)"
            type="password"
            maxLength={72}
            className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm sm:w-40"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="댓글을 입력하세요"
          rows={3}
          maxLength={1000}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm"
        />
        {/* honeypot: hidden from humans, bots tend to fill it */}
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          name="website"
          className="hidden"
        />
        {error && <p className="text-sm text-[var(--color-accent)]">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
          >
            {pending ? "등록 중…" : "댓글 등록"}
          </button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "ColumnComments|comments/route|comments/\[cid\]" || echo "ok"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/columns/[id]/comments/route.ts" "src/app/api/columns/comments/[cid]/route.ts" src/components/ColumnComments.tsx
git commit -m "feat(columns): 댓글 작성/본인삭제 API(게이트·허니팟·레이트리밋) + 댓글 UI"
```

---

### Task 12: 공개 상세 페이지 `/columns/[id]` + JSON-LD

**Files:**
- Modify: `src/lib/seo.ts` (buildColumnArticleSchema 추가)
- Create: `src/app/columns/[id]/page.tsx`

- [ ] **Step 1: seo.ts에 칼럼 Article 스키마 추가**

In `src/lib/seo.ts`, 파일 끝(마지막 `buildNewsArticleSchema` 함수 뒤)에 추가:
```ts
export function buildColumnArticleSchema(post: {
  id: number;
  title: string;
  topicTitle: string;
  authorName: string | null;
  heroImage: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: dateOnly(post.publishedAt ?? post.createdAt),
    ...(post.heroImage ? { image: [abs(post.heroImage)] } : {}),
    author: {
      "@type": post.authorName ? "Person" : "Organization",
      name: post.authorName ?? BAND_NAME_KR_FULL,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: BAND_NAME_KR_FULL,
      logo: { "@type": "ImageObject", url: abs("/icon.svg") },
    },
    articleSection: post.topicTitle,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/columns/${post.id}`,
    },
  };
}
```

- [ ] **Step 2: 상세 페이지 작성**

Create `src/app/columns/[id]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import Markdown from "@/components/Markdown";
import ColumnViewPing from "@/components/ColumnViewPing";
import ColumnComments, { type PublicComment } from "@/components/ColumnComments";
import { getPublishedPostById, getVisibleComments } from "@/lib/columns";
import { excerptFromMarkdown, formatColumnDate, timeAgo } from "@/lib/columnsFormat";
import { buildColumnArticleSchema, buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return {};
  const post = await getPublishedPostById(numId);
  if (!post) return {};
  const description = post.excerpt || excerptFromMarkdown(post.body, 200);
  return buildPageMetadata({
    title: `${post.title} - 칼럼`,
    path: `/columns/${post.id}`,
    description,
    keywords: ["서스테인 칼럼", post.topicTitle, post.title],
    ogImage: post.heroImage || "/slides/hero-a7f3c1e2.jpg",
    type: "article",
  });
}

export default async function ColumnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const post = await getPublishedPostById(numId);
  if (!post) notFound();

  const rawComments = await getVisibleComments(numId);
  const now = new Date();
  const comments: PublicComment[] = rawComments.map((c) => ({
    id: c.id,
    nickname: c.nickname,
    ipMasked: c.ipMasked,
    body: c.body,
    when: timeAgo(c.createdAt, now),
    hasPassword: c.hasPassword,
  }));

  return (
    <article className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <JsonLd data={buildColumnArticleSchema(post)} />
      <ColumnViewPing id={post.id} />

      <nav className="text-sm text-[var(--color-text-muted)] mb-8">
        <Link href="/" className="underline underline-offset-4">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/columns" className="underline underline-offset-4">칼럼</Link>
        <span className="mx-2">›</span>
        <Link href={`/columns?topic=${post.topicId}`} className="underline underline-offset-4">
          {post.topicTitle}
        </Link>
      </nav>

      <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
        {post.topicTitle}
        {post.authorName ? ` · ${post.authorName}` : ""} · {formatColumnDate(post.publishedAt ?? post.createdAt)} · 조회 {post.viewCount}
      </p>
      <h1 className="font-display font-black uppercase tracking-tight leading-[1.05] text-3xl md:text-5xl mb-10 md:mb-12">
        {post.title}
      </h1>

      {post.heroImage && (
        <figure className="relative aspect-[3/2] bg-[var(--color-bg-muted)] mb-12 md:mb-16 overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            priority
            sizes="(min-width:768px) 768px, 100vw"
            className="object-cover"
          />
        </figure>
      )}

      <Markdown>{post.body}</Markdown>

      <ColumnComments postId={post.id} comments={comments} />

      <nav className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <Link href="/columns" className="text-sm underline underline-offset-4">← 칼럼 목록</Link>
      </nav>
    </article>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "columns/\[id\]|seo.ts" || echo "ok"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/seo.ts "src/app/columns/[id]/page.tsx"
git commit -m "feat(columns): 공개 상세 페이지(마크다운 본문+조회 ping+댓글+JSON-LD)"
```

---

### Task 13: 어드민 서버 액션 `actions.ts`

**Files:**
- Create: `src/app/admin/(authed)/columns/actions.ts`

- [ ] **Step 1: 액션 작성**

Create `src/app/admin/(authed)/columns/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { topicSchema, postSchema } from "@/lib/columnsValidation";
import type { RowDataPacket } from "mysql2";

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}
function fieldErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const i of issues) fe[i.path.join(".")] = i.message;
  return fe;
}
function revalidateColumns() {
  revalidatePath("/admin/columns");
  revalidatePath("/admin/columns/topics");
  revalidatePath("/columns");
}

// ---------- topics ----------
export async function createTopic(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = topicSchema.safeParse({
    title: fd.get("title"),
    memberId: fd.get("memberId") ?? "",
    description: fd.get("description") ?? "",
    sortOrder: fd.get("sortOrder") ?? "",
  });
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const t = r.data;
  await getPool().query(
    `INSERT INTO column_topics (title, member_id, description, sort_order, visible)
     VALUES (?, ?, ?, ?, 1)`,
    [t.title, t.memberId ?? null, t.description || null, t.sortOrder],
  );
  revalidateColumns();
  redirect("/admin/columns/topics");
}

export async function updateTopic(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = topicSchema.safeParse({
    title: fd.get("title"),
    memberId: fd.get("memberId") ?? "",
    description: fd.get("description") ?? "",
    sortOrder: fd.get("sortOrder") ?? "",
  });
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const t = r.data;
  await getPool().query(
    `UPDATE column_topics SET title=?, member_id=?, description=?, sort_order=? WHERE id=?`,
    [t.title, t.memberId ?? null, t.description || null, t.sortOrder, id],
  );
  revalidateColumns();
  redirect("/admin/columns/topics");
}

export async function toggleTopicVisible(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE column_topics SET visible = 1 - visible WHERE id = ?`, [id]);
  revalidateColumns();
}

export async function deleteTopic(id: number) {
  await requireAuth();
  // CASCADE removes posts + their comments
  await getPool().query(`DELETE FROM column_topics WHERE id = ?`, [id]);
  revalidateColumns();
}

// ---------- posts ----------
function readPostForm(fd: FormData) {
  return {
    topicId: fd.get("topicId"),
    title: fd.get("title"),
    heroImage: fd.get("heroImage") ?? "",
    excerpt: fd.get("excerpt") ?? "",
    body: fd.get("body"),
  };
}

export async function createPost(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = postSchema.safeParse(readPostForm(fd));
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const p = r.data;
  const published = fd.get("published") === "on" ? 1 : 0;
  const publishedAt = published === 1 ? new Date() : null;
  await getPool().query(
    `INSERT INTO column_posts (topic_id, title, hero_image, excerpt, body, published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.topicId, p.title, p.heroImage || null, p.excerpt || null, p.body, published, publishedAt],
  );
  revalidateColumns();
  redirect("/admin/columns");
}

export async function updatePost(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = postSchema.safeParse(readPostForm(fd));
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const p = r.data;
  const published = fd.get("published") === "on" ? 1 : 0;

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT published_at FROM column_posts WHERE id = ?`, [id],
  );
  let publishedAt: Date | null = rows[0]?.published_at ? new Date(rows[0].published_at) : null;
  if (published === 1 && publishedAt === null) publishedAt = new Date();

  await getPool().query(
    `UPDATE column_posts SET topic_id=?, title=?, hero_image=?, excerpt=?, body=?, published=?, published_at=? WHERE id=?`,
    [p.topicId, p.title, p.heroImage || null, p.excerpt || null, p.body, published, publishedAt, id],
  );
  revalidateColumns();
  revalidatePath(`/columns/${id}`);
  redirect("/admin/columns");
}

export async function togglePostPublished(id: number) {
  await requireAuth();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT published, published_at FROM column_posts WHERE id = ?`, [id],
  );
  if (!rows[0]) return;
  const next = rows[0].published === 1 ? 0 : 1;
  if (next === 1 && rows[0].published_at == null) {
    await getPool().query(`UPDATE column_posts SET published=1, published_at=NOW() WHERE id=?`, [id]);
  } else {
    await getPool().query(`UPDATE column_posts SET published=? WHERE id=?`, [next, id]);
  }
  revalidateColumns();
  revalidatePath(`/columns/${id}`);
}

export async function deletePost(id: number) {
  await requireAuth();
  await getPool().query(`DELETE FROM column_posts WHERE id = ?`, [id]);
  revalidateColumns();
}

// ---------- comments (moderation) ----------
export async function toggleCommentVisibleAdmin(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE column_comments SET visible = 1 - visible WHERE id = ?`, [id]);
  revalidatePath("/admin/columns/comments");
  revalidatePath("/columns");
}

export async function deleteCommentAdmin(id: number) {
  await requireAuth();
  await getPool().query(`DELETE FROM column_comments WHERE id = ?`, [id]);
  revalidatePath("/admin/columns/comments");
  revalidatePath("/columns");
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "columns/actions" || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(authed)/columns/actions.ts"
git commit -m "feat(columns): 어드민 서버 액션(주제/글 CRUD·공개전환·댓글 모더레이션)"
```

---

### Task 14: 어드민 글쓰기 — `ColumnBodyEditor` + `ColumnForm` + 글 목록/생성/수정 페이지

**Files:**
- Create: `src/components/admin/ColumnBodyEditor.tsx`
- Create: `src/components/admin/ColumnForm.tsx`
- Create: `src/app/admin/(authed)/columns/page.tsx`
- Create: `src/app/admin/(authed)/columns/new/page.tsx`
- Create: `src/app/admin/(authed)/columns/[id]/page.tsx`

- [ ] **Step 1: 마크다운 에디터 (툴바 + 이미지 업로드 + 미리보기)**

Create `src/components/admin/ColumnBodyEditor.tsx`:
```tsx
"use client";
import { useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import { uploadImage } from "@/lib/upload";

export default function ColumnBodyEditor({
  name,
  initialValue,
}: {
  name: string;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function surround(before: string, after = "") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    const pos = ta ? ta.selectionStart : value.length;
    setValue(value.slice(0, pos) + text + value.slice(pos));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await uploadImage(fd, "columns");
      if (res.ok) {
        insertAtCursor(`\n\n![${f.name}](${res.path})\n\n`);
      } else {
        setError(res.error);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const Btn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5 items-center">
        <Btn label="H2" onClick={() => surround("\n## ", "")} />
        <Btn label="H3" onClick={() => surround("\n### ", "")} />
        <Btn label="굵게" onClick={() => surround("**", "**")} />
        <Btn label="기울임" onClick={() => surround("_", "_")} />
        <Btn label="인용" onClick={() => surround("\n> ", "")} />
        <Btn label="• 목록" onClick={() => surround("\n- ", "")} />
        <Btn label="1. 목록" onClick={() => surround("\n1. ", "")} />
        <Btn label="링크" onClick={() => surround("[", "](https://)")} />
        <Btn label="구분선" onClick={() => insertAtCursor("\n\n---\n\n")} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
        >
          {uploading ? "업로드 중…" : "이미지"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onPickImage}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className={
            "ml-auto px-2 py-1 text-xs border border-[var(--color-border-strong)] " +
            (preview ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "hover:bg-[var(--color-bg-muted)]")
          }
        >
          {preview ? "편집" : "미리보기"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--color-accent)]">{error}</p>}
      {preview ? (
        <div className="border border-[var(--color-border-strong)] px-4 py-3 min-h-[20rem]">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-[var(--color-text-muted)]">미리볼 내용이 없습니다.</p>}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={25}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm leading-relaxed font-mono"
          placeholder="마크다운으로 작성하세요. 이미지는 위 '이미지' 버튼으로 첨부합니다."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 글 폼**

Create `src/components/admin/ColumnForm.tsx`:
```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import ImageUpload from "@/components/admin/ImageUpload";
import ColumnBodyEditor from "@/components/admin/ColumnBodyEditor";
import type { FormState } from "@/app/admin/(authed)/columns/actions";
import type { ColumnPost, ColumnTopic } from "@/lib/columns";

export default function ColumnForm({
  post,
  topics,
  action,
  submitLabel,
}: {
  post?: ColumnPost;
  topics: ColumnTopic[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  if (topics.length === 0) {
    return (
      <p className="text-sm">
        먼저 <Link href="/admin/columns/topics" className="underline underline-offset-4">주제</Link>를 하나 이상 만들어 주세요.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {post && (
        <div className="flex justify-end">
          <Link
            href={`/columns/${post.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">주제</span>
        <select
          name="topicId"
          defaultValue={post?.topicId ?? ""}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          <option value="" disabled>주제 선택</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}{t.visible ? "" : " (숨김)"}
            </option>
          ))}
        </select>
        {fe.topicId && <span className="text-xs text-[var(--color-accent)]">{fe.topicId}</span>}
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">제목</span>
        <input
          name="title"
          defaultValue={post?.title ?? ""}
          required
          maxLength={200}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
        {fe.title && <span className="text-xs text-[var(--color-accent)]">{fe.title}</span>}
      </label>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Hero Image (선택)
        </label>
        <ImageUpload
          name="heroImage"
          resource="columns"
          initialPath={post?.heroImage}
          alt={post?.title ?? "column hero"}
        />
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">발췌 (선택, 비우면 본문에서 자동)</span>
        <input
          name="excerpt"
          defaultValue={post?.excerpt ?? ""}
          maxLength={500}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
      </label>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">본문 (마크다운)</label>
        <ColumnBodyEditor name="body" initialValue={post?.body} />
        {fe.body && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.body}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={post?.published ?? false} />
        <span>공개</span>
      </label>

      {state.error && <p className="text-sm text-[var(--color-accent)]">{state.error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
        <Link
          href="/admin/columns"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: 글 목록 페이지**

Create `src/app/admin/(authed)/columns/page.tsx`:
```tsx
import Link from "next/link";
import { getAllPostsForAdmin } from "@/lib/columns";
import { formatColumnDate } from "@/lib/columnsFormat";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePostPublished } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminColumnsPage() {
  const posts = await getAllPostsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h1 className="font-display font-black uppercase text-3xl">Columns</h1>
        <div className="flex gap-2">
          <Link href="/admin/columns/topics" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">주제 관리</Link>
          <Link href="/admin/columns/comments" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">댓글 관리</Link>
          <Link href="/admin/columns/new" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">+ 새 글</Link>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2">제목</th>
            <th className="py-2 w-40">주제</th>
            <th className="py-2 w-24">작성자</th>
            <th className="py-2 w-28">공개일</th>
            <th className="py-2 w-16 text-right">조회</th>
            <th className="py-2 w-16 text-right">댓글</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-16 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{p.title}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{p.topicTitle}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{p.authorName ?? "—"}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{p.publishedAt ? formatColumnDate(p.publishedAt) : "—"}</td>
              <td className="py-3 text-right tabular-nums">{p.viewCount}</td>
              <td className="py-3 text-right tabular-nums">{p.commentCount}</td>
              <td className="py-3">
                <PublishedToggle
                  published={p.published}
                  toggleAction={async () => { "use server"; await togglePostPublished(p.id); }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/columns/${p.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-[var(--color-text-muted)]">아직 글이 없습니다.</td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
```

- [ ] **Step 4: 새 글 / 편집 페이지**

Create `src/app/admin/(authed)/columns/new/page.tsx`:
```tsx
import { getAllTopicsForAdmin } from "@/lib/columns";
import ColumnForm from "@/components/admin/ColumnForm";
import { createPost } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewColumnPage() {
  const topics = await getAllTopicsForAdmin();
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 글</h1>
      <ColumnForm topics={topics} action={createPost} submitLabel="저장" />
    </div>
  );
}
```

Create `src/app/admin/(authed)/columns/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getPostByIdForAdmin, getAllTopicsForAdmin } from "@/lib/columns";
import ColumnForm from "@/components/admin/ColumnForm";
import { updatePost } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditColumnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const [post, topics] = await Promise.all([
    getPostByIdForAdmin(numId),
    getAllTopicsForAdmin(),
  ]);
  if (!post) notFound();
  const action = updatePost.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">글 편집</h1>
      <ColumnForm post={post} topics={topics} action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "ColumnForm|ColumnBodyEditor|admin/\(authed\)/columns" || echo "ok"`
Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ColumnBodyEditor.tsx src/components/admin/ColumnForm.tsx "src/app/admin/(authed)/columns/page.tsx" "src/app/admin/(authed)/columns/new/page.tsx" "src/app/admin/(authed)/columns/[id]/page.tsx"
git commit -m "feat(columns): 어드민 글쓰기(마크다운 에디터+폼) + 글 목록/생성/편집"
```

---

### Task 15: 어드민 주제 관리 — `TopicForm` + 목록/생성/수정 + `ConfirmActionButton`

**Files:**
- Create: `src/components/admin/ConfirmActionButton.tsx`
- Create: `src/components/admin/TopicForm.tsx`
- Create: `src/app/admin/(authed)/columns/topics/page.tsx`
- Create: `src/app/admin/(authed)/columns/topics/new/page.tsx`
- Create: `src/app/admin/(authed)/columns/topics/[id]/page.tsx`

- [ ] **Step 1: 확인 버튼 컴포넌트 (삭제용)**

Create `src/components/admin/ConfirmActionButton.tsx`:
```tsx
"use client";
import { useTransition } from "react";

export default function ConfirmActionButton({
  action,
  label,
  confirm,
}: {
  action: () => Promise<void>;
  label: string;
  confirm: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirm)) startTransition(() => action());
      }}
      className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: 주제 폼**

Create `src/components/admin/TopicForm.tsx`:
```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/admin/(authed)/columns/actions";
import type { ColumnTopic } from "@/lib/columns";

export type TopicMemberOption = { id: number; label: string };

export default function TopicForm({
  topic,
  members,
  action,
  submitLabel,
}: {
  topic?: ColumnTopic;
  members: TopicMemberOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-xl">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">제목 (예: 김영민의 휴먼 역사갤러리)</span>
        <input
          name="title"
          defaultValue={topic?.title ?? ""}
          required
          maxLength={120}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
        {fe.title && <span className="text-xs text-[var(--color-accent)]">{fe.title}</span>}
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">연결 멤버 (선택)</span>
        <select
          name="memberId"
          defaultValue={topic?.memberId ?? ""}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          <option value="">— 연결 안 함 —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">소개 (선택)</span>
        <input
          name="description"
          defaultValue={topic?.description ?? ""}
          maxLength={500}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">정렬 순서 (낮을수록 앞)</span>
        <input
          name="sortOrder"
          type="number"
          defaultValue={topic?.sortOrder ?? 0}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] w-32"
        />
      </label>

      {state.error && <p className="text-sm text-[var(--color-accent)]">{state.error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
        <Link
          href="/admin/columns/topics"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: 주제 목록 페이지**

Create `src/app/admin/(authed)/columns/topics/page.tsx`:
```tsx
import Link from "next/link";
import { getAllTopicsForAdmin } from "@/lib/columns";
import PublishedToggle from "@/components/admin/PublishedToggle";
import ConfirmActionButton from "@/components/admin/ConfirmActionButton";
import { toggleTopicVisible, deleteTopic } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminTopicsPage() {
  const topics = await getAllTopicsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h1 className="font-display font-black uppercase text-3xl">주제</h1>
        <div className="flex gap-2">
          <Link href="/admin/columns" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">← 글 목록</Link>
          <Link href="/admin/columns/topics/new" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">+ 새 주제</Link>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2">제목</th>
            <th className="py-2 w-28">연결 멤버</th>
            <th className="py-2 w-16 text-right">정렬</th>
            <th className="py-2 w-24">노출</th>
            <th className="py-2 w-28 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => (
            <tr key={t.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{t.title}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{t.authorName ?? "—"}</td>
              <td className="py-3 text-right tabular-nums">{t.sortOrder}</td>
              <td className="py-3">
                <PublishedToggle
                  published={t.visible}
                  toggleAction={async () => { "use server"; await toggleTopicVisible(t.id); }}
                />
              </td>
              <td className="py-3 text-right">
                <div className="flex gap-2 justify-end">
                  <Link href={`/admin/columns/topics/${t.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                  <ConfirmActionButton
                    label="삭제"
                    confirm="이 주제와 하위 글·댓글이 모두 삭제됩니다. 계속할까요?"
                    action={async () => { "use server"; await deleteTopic(t.id); }}
                  />
                </div>
              </td>
            </tr>
          ))}
          {topics.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-[var(--color-text-muted)]">아직 주제가 없습니다.</td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
```

- [ ] **Step 4: 주제 생성/수정 페이지**

Create `src/app/admin/(authed)/columns/topics/new/page.tsx`:
```tsx
import { getAllMembersForAdmin } from "@/lib/members";
import TopicForm from "@/components/admin/TopicForm";
import { createTopic } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewTopicPage() {
  const members = await getAllMembersForAdmin();
  const options = members.map((m) => ({ id: m.id, label: `${m.nameKr} (${m.nameEn})` }));
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 주제</h1>
      <TopicForm members={options} action={createTopic} submitLabel="저장" />
    </div>
  );
}
```

Create `src/app/admin/(authed)/columns/topics/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getTopicById } from "@/lib/columns";
import { getAllMembersForAdmin } from "@/lib/members";
import TopicForm from "@/components/admin/TopicForm";
import { updateTopic } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const [topic, members] = await Promise.all([
    getTopicById(numId),
    getAllMembersForAdmin(),
  ]);
  if (!topic) notFound();
  const options = members.map((m) => ({ id: m.id, label: `${m.nameKr} (${m.nameEn})` }));
  const action = updateTopic.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">주제 편집</h1>
      <TopicForm topic={topic} members={options} action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "TopicForm|ConfirmActionButton|columns/topics" || echo "ok"`
Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ConfirmActionButton.tsx src/components/admin/TopicForm.tsx "src/app/admin/(authed)/columns/topics/page.tsx" "src/app/admin/(authed)/columns/topics/new/page.tsx" "src/app/admin/(authed)/columns/topics/[id]/page.tsx"
git commit -m "feat(columns): 어드민 주제 관리(폼+목록+노출토글+삭제)"
```

---

### Task 16: 어드민 댓글 모더레이션 페이지

**Files:**
- Create: `src/app/admin/(authed)/columns/comments/page.tsx`

- [ ] **Step 1: 댓글 관리 페이지 작성**

Create `src/app/admin/(authed)/columns/comments/page.tsx`:
```tsx
import Link from "next/link";
import { getAllCommentsForAdmin } from "@/lib/columns";
import { formatColumnDate } from "@/lib/columnsFormat";
import PublishedToggle from "@/components/admin/PublishedToggle";
import ConfirmActionButton from "@/components/admin/ConfirmActionButton";
import { toggleCommentVisibleAdmin, deleteCommentAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const comments = await getAllCommentsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h1 className="font-display font-black uppercase text-3xl">댓글</h1>
        <Link href="/admin/columns" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">← 글 목록</Link>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-36">글</th>
            <th className="py-2 w-24">닉네임</th>
            <th className="py-2 w-28">IP</th>
            <th className="py-2">내용</th>
            <th className="py-2 w-24">작성일</th>
            <th className="py-2 w-24">노출</th>
            <th className="py-2 w-16 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {comments.map((c) => (
            <tr key={c.id} className="border-b border-[var(--color-border)] align-top">
              <td className="py-3">
                <Link href={`/columns/${c.postId}`} target="_blank" className="underline underline-offset-2 text-[var(--color-text-muted)]">{c.postTitle}</Link>
              </td>
              <td className="py-3">{c.nickname}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{c.ip}</td>
              <td className="py-3 whitespace-pre-wrap break-words">{c.body}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{formatColumnDate(c.createdAt)}</td>
              <td className="py-3">
                <PublishedToggle
                  published={c.visible}
                  toggleAction={async () => { "use server"; await toggleCommentVisibleAdmin(c.id); }}
                />
              </td>
              <td className="py-3 text-right">
                <ConfirmActionButton
                  label="삭제"
                  confirm="이 댓글을 영구 삭제할까요?"
                  action={async () => { "use server"; await deleteCommentAdmin(c.id); }}
                />
              </td>
            </tr>
          ))}
          {comments.length === 0 && (
            <tr><td colSpan={7} className="py-6 text-[var(--color-text-muted)]">아직 댓글이 없습니다.</td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "columns/comments" || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(authed)/columns/comments/page.tsx"
git commit -m "feat(columns): 어드민 댓글 모더레이션(전체 목록·전체IP·노출토글·삭제)"
```

---

### Task 17: sitemap에 `/columns` + 공개 상세 반영

**Files:**
- Modify: `src/lib/sitemap.ts`
- Modify: `src/app/sitemap.ts`
- Test: `src/lib/sitemap.test.ts`

- [ ] **Step 1: 기존 sitemap 테스트 확인**

Run: `npx tsx --test src/lib/sitemap.test.ts`
Expected: PASS (현재 통과 상태 확인 — 변경 전 baseline).

- [ ] **Step 2: `buildPublicSitemap`에 columns(선택 파라미터) 추가**

In `src/lib/sitemap.ts`, `SitemapLiveEvent` 타입 정의 아래에 추가:
```ts
type SitemapColumnItem = {
  id: number;
  lastModified: Date;
};
```
`BuildPublicSitemapInput` 타입에 `columns?: SitemapColumnItem[];` 필드를 추가:
```ts
type BuildPublicSitemapInput = {
  siteUrl: string;
  now: Date;
  news: SitemapNewsItem[];
  songs: SitemapSongItem[];
  liveEvents: SitemapLiveEvent[];
  columns?: SitemapColumnItem[];
};
```
함수 시그니처 구조분해에 `columns = []` 추가:
```ts
export function buildPublicSitemap({
  siteUrl,
  now,
  news,
  songs,
  liveEvents,
  columns = [],
}: BuildPublicSitemapInput): MetadataRoute.Sitemap {
```
`staticPages` 배열의 `/news` 항목 바로 뒤에 `/columns` 정적 항목 추가:
```ts
    {
      url: `${siteUrl}/columns`,
      lastModified: columns[0]?.lastModified ?? now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
```
`newsPages` 정의 아래에 `columnPages` 추가하고 return에 포함:
```ts
  const columnPages: MetadataRoute.Sitemap = columns.map((item) => ({
    url: `${siteUrl}/columns/${item.id}`,
    lastModified: item.lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...newsPages, ...columnPages];
```

- [ ] **Step 3: `sitemap.ts`에서 공개 칼럼 fetch 후 전달**

In `src/app/sitemap.ts`, replace the entire file with:
```ts
import type { MetadataRoute } from "next";
import { listAllLiveEvents } from "@/lib/live";
import { getPublishedNews } from "@/lib/news";
import { getPublishedPosts } from "@/lib/columns";
import { buildPublicSitemap } from "@/lib/sitemap";
import { getPublishedSongs } from "@/lib/songs";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, songs, liveEvents, posts] = await Promise.all([
    getPublishedNews(),
    getPublishedSongs(),
    listAllLiveEvents(),
    getPublishedPosts(),
  ]);

  return buildPublicSitemap({
    siteUrl: SITE_URL,
    now: new Date(),
    news,
    songs,
    liveEvents,
    columns: posts.map((p) => ({ id: p.id, lastModified: p.publishedAt ?? p.createdAt })),
  });
}
```

- [ ] **Step 4: sitemap 테스트에 columns 케이스 추가**

In `src/lib/sitemap.test.ts`, 파일 끝에 새 테스트를 추가 (기존 테스트는 그대로 — columns는 선택 파라미터라 깨지지 않음):
```ts
test("buildPublicSitemap includes /columns and published column detail URLs", () => {
  const now = new Date("2026-05-27T00:00:00Z");
  const result = buildPublicSitemap({
    siteUrl: "https://bandsustain.com",
    now,
    news: [],
    songs: [],
    liveEvents: [],
    columns: [
      { id: 7, lastModified: new Date("2026-05-20T00:00:00Z") },
      { id: 9, lastModified: new Date("2026-05-25T00:00:00Z") },
    ],
  });
  const urls = result.map((e) => e.url);
  assert.ok(urls.includes("https://bandsustain.com/columns"));
  assert.ok(urls.includes("https://bandsustain.com/columns/7"));
  assert.ok(urls.includes("https://bandsustain.com/columns/9"));
});
```
> 만약 `sitemap.test.ts` 상단에 `import test from "node:test"` / `import assert from "node:assert/strict"` / `import { buildPublicSitemap } from "./sitemap"` 가 이미 없다면 추가한다(기존 테스트가 이미 import 하고 있으므로 대개 그대로 사용 가능).

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx tsx --test src/lib/sitemap.test.ts`
Expected: PASS (기존 + 신규 테스트 모두).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sitemap.ts src/app/sitemap.ts src/lib/sitemap.test.ts
git commit -m "feat(columns): sitemap에 /columns + 공개 상세 URL 반영 + 테스트"
```

---

### Task 18: 통합 검증 (lint·전체 테스트·빌드·DEV 재기동·스모크) + dev 푸시

**Files:** 없음 (검증/배포만)

- [ ] **Step 1: 전체 단위 테스트**

Run: `npx tsx --test src/lib/columnsFormat.test.ts src/lib/markdownUrl.test.ts src/lib/columnsValidation.test.ts src/lib/sitemap.test.ts`
Expected: 모든 테스트 PASS, fail 0.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 에러 0. (경고는 기존 수준 유지. `<img>` 관련 경고는 Markdown.tsx의 eslint-disable로 억제됨 — 새 에러가 나면 수정.)

- [ ] **Step 3: 프로덕션 빌드**

Run: `pnpm build`
Expected: 빌드 성공. `/columns`, `/columns/[id]`, `/admin/columns*`, `/api/columns/*` 라우트가 빌드 결과에 나타남. 타입 에러 0.

- [ ] **Step 4: DEV 재기동**

Run: `sudo -u ec2-user pm2 restart bandsustain-dev`
Expected: `bandsustain-dev` online. (`sudo -u ec2-user pm2 list`로 확인.)

- [ ] **Step 5: 수동 스모크 (https://dev.bandsustain.com)**

다음을 순서대로 확인 (어드민 로그인 후):
1. `/admin/columns/topics` → "새 주제"로 주제 1개 생성 (멤버 연결 선택). 목록에 노출.
2. `/admin/columns/new` → 주제 선택, 제목/본문(마크다운: 제목·굵게·목록·이미지 업로드 1장) 작성, "미리보기" 토글로 렌더 확인, **공개 체크** 후 저장.
3. `/columns` → 칩 필터에 주제 노출, 카드에 글·조회수·댓글수 표시. 칩 클릭 시 필터.
4. `/columns/<id>` → 본문 마크다운/이미지 렌더, breadcrumb, 조회수(새로고침해도 6h 내 1회만 증가).
5. 비로그인(또는 시크릿창)에서 댓글 작성(닉네임+비번) → 즉시 노출 + IP 일부 표시. 같은 IP로 즉시 재작성 시 "잠시 후" 안내(레이트리밋).
6. 본인 "삭제" 버튼 → 비번 입력 → 삭제됨.
7. `/admin/columns/comments` → 댓글 보임(전체 IP), 노출 토글로 숨기면 공개 페이지에서 사라짐.
8. `/admin/columns/topics`에서 주제 "노출" 끄면 `/columns`에서 해당 주제·글이 사라짐. 숨김 글에 댓글 POST 시 404(개발자도구 확인, 선택).

문제 발견 시 해당 Task로 돌아가 수정 후 재빌드.

- [ ] **Step 6: dev 푸시 후 정지**

```bash
git push origin dev
```
그리고 **⛔ 여기서 멈춘다.** 사용자에게 `https://dev.bandsustain.com`에서 확인 요청. 운영(main 머지 + PROD DB에 `018_columns.sql` 적용 + 수동 배포)은 **사용자가 명시적으로 요청한 경우에만** 진행.

---

## Self-Review (작성자 체크 결과)

**Spec coverage** (스펙 각 절 → 태스크):
- §3.1~3.3 테이블 3개 → Task 1. §3.4 가시성 규칙 → `getPublishedPosts`/`getPublishedPostById`/`canCommentOnPost` (Task 5).
- §4 의존성 → Task 1. §5 데이터 레이어(+canCommentOnPost·maskIp·excerpt) → Task 2·5. published_at 전환 → Task 13.
- §6.1 네비 → Task 8. §6.2 리스트/칩 → Task 9. §6.3 조회수 ping → Task 10. §6.4 Markdown+urlTransform → Task 3·6. §6.5 SEO/sitemap → Task 12(metadata/JSON-LD)·17(sitemap).
- §7.1 댓글 UI → Task 11. §7.2 작성 게이트·허니팟·레이트리밋 → Task 11. §7.3 본인삭제 → Task 11.
- §8 어드민(글/주제/댓글) → Task 13·14·15·16. §9 업로드 RESOURCES 3곳 → Task 7. §10 보안 → Task 3·5·6·11 전반. §11 테스트 → Task 2·3·4·17. §12 배포 → Task 1(DEV DB)·18.

**Placeholder scan:** 없음 — 모든 코드 스텝에 완성 코드 포함.

**Type consistency 체크:**
- `ColumnPost`/`ColumnTopic`/`VisibleComment`/`AdminComment` (Task 5) ↔ 사용처(Task 9·12·14·15·16) 필드명 일치.
- `getPublishedPosts(opts?)`, `getAllPostsForAdmin()`, `getPublishedPostById`, `getPostByIdForAdmin`, `getVisibleTopics`, `getAllTopicsForAdmin`, `getTopicById`, `getVisibleComments`, `getAllCommentsForAdmin`, `canCommentOnPost`, `incrementViewCount`, `insertComment`, `getLatestCommentAtByIp`, `getCommentAuthRow`, `deleteCommentById`, `setCommentVisible` — 정의(Task 5) ↔ 호출(Task 10·11·12·13·14·15·16·17) 시그니처 일치. (주: `setCommentVisible`는 데이터 레이어에 정의하되 어드민 토글은 actions.ts에서 직접 SQL `1 - visible`로 처리 — 중복 아님, helper는 향후용. 불필요하면 Task 5에서 빼도 무방.)
- 폼 필드명: ColumnForm `topicId/title/heroImage/excerpt/body/published` ↔ actions `readPostForm`/`createPost` 일치. TopicForm `title/memberId/description/sortOrder` ↔ `createTopic`/`updateTopic` 일치.
- `FormState`는 actions.ts에서 export, 폼들이 동일 타입 import. ImageUpload `resource="columns"` ↔ Resource 타입(Task 7) 일치.
- 댓글 타입 분리: 데이터 레이어는 `VisibleComment`(`createdAt:Date`/`ipMasked`), 클라이언트(ColumnComments.tsx)는 `PublicComment`(`when:string`). 상세 페이지(Task 12)가 `getVisibleComments()`→`VisibleComment[]`를 `PublicComment[]`로 매핑(`timeAgo`로 `when` 생성). 이름이 달라 import 혼동 없음.

발견 이슈 없음(setCommentVisible는 향후용 helper로 명시, 댓글 타입 이름 충돌은 VisibleComment/PublicComment로 분리 완료).

