# bandsustain /admin 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bandsustain.com에 인증된 단일 운영자가 members/songs/news/quotes 4개 리소스를 CRUD할 수 있는 `/admin` 화면을 구현한다. 동시에 기존 정적 데이터(`src/data/*.ts`)를 DB로 옮겨 공개 페이지가 DB 기반 동적 렌더링하도록 전환한다.

**Architecture:** Next.js 16 App Router + TypeScript + Tailwind v4 + MariaDB. `src/lib/{members,songs,news,quotes}.ts`가 read 쿼리 + 도메인 타입(camelCase)을 모두 담당하고, public 페이지와 admin이 동일한 read 함수를 사용한다. Mutation은 `src/app/admin/{resource}/actions.ts`의 Server Action으로 격리하고 Zod로 검증한다. 인증은 `.db_credentials`의 ADMIN_* 키 + bcrypt + HMAC 서명 세션 쿠키(stateless). 이미지는 `public/uploads/{resource}/<uuid>.<ext>`로 저장한다.

**Tech Stack:** Next.js 16 / TS 5 / Tailwind v4 / MariaDB / mysql2 / bcryptjs / zod / Node crypto / pnpm.

**스펙 참조:** `docs/superpowers/specs/2026-04-27-admin-page-design.md` (15개 Q&A 결정 + 6개 섹션).

---

## 매우 중요한 환경 메모

- **bandsustain은 단일 DB 환경**(`BANDSUSTAIN`)이다. routines처럼 dev/prod DB 분리가 없으며 `pnpm dev`와 PM2 production이 같은 MariaDB를 본다.
- 즉 schema/seed SQL 적용 = **PROD DB에 직접 적용**이다. `IF NOT EXISTS`를 쓰고, 적용 전에 `git status` / `git diff`로 SQL 내용을 한 번 더 확인한다.
- `.db_credentials` 경로: `/var/www/html/_______site_BANDSUSTAIN/.db_credentials`. 소유자는 ec2-user (PM2 실행 계정). DB_HOST/DB_USER/DB_PASS/DB_NAME 4 키 + 이번 작업에서 ADMIN_USERNAME/ADMIN_PASSWORD_HASH/ADMIN_SESSION_SECRET 3 키 추가.
- Branch: `main` 단일. dev/prod 분리 없음. 각 task 후 commit, 전체 완료 시 push.
- 디자인 시스템(`CLAUDE.md`): 화이트 베이스 + 블랙 타이포 + Inter/Archivo + 직각 + shadow/gradient/rounded 금지. admin도 동일 규칙.

---

## 파일 구조 (생성/수정 전체 매핑)

**신규:**
- `src/lib/creds.ts` — `loadCreds()` 추출 (db.ts와 auth.ts 공유)
- `src/lib/auth.ts` — 세션 토큰 sign/verify (HMAC), 쿠키 helper
- `src/lib/upload.ts` — 이미지 파일 검증 + 저장 (server action으로 export)
- `src/lib/members.ts` `src/lib/songs.ts` `src/lib/news.ts` — 도메인 타입 + read 쿼리
- `src/middleware.ts` — `/admin/*` 보호
- `src/app/admin/layout.tsx` — 좌측 nav + 메인 영역
- `src/app/admin/page.tsx` — 대시보드 (카운트 4 + 최근 5건)
- `src/app/admin/login/page.tsx` `src/app/admin/login/actions.ts`
- `src/app/admin/logout/route.ts`
- `src/app/admin/members/{page,actions}.ts(x)`, `members/new/page.tsx`, `members/[id]/page.tsx`
- `src/app/admin/songs/{page,actions}.ts(x)`, `songs/new/page.tsx`, `songs/[id]/page.tsx`
- `src/app/admin/news/{page,actions}.ts(x)`, `news/new/page.tsx`, `news/[id]/page.tsx`
- `src/app/admin/quotes/{page,actions}.ts(x)`, `quotes/new/page.tsx`, `quotes/[id]/page.tsx`
- `src/components/admin/AdminNav.tsx`
- `src/components/admin/ImageUpload.tsx` (client) — 4개 폼이 공유
- `src/components/admin/PublishedToggle.tsx` (client)
- `src/components/admin/{Member,Song,News,Quote}Form.tsx` — 폼 UI
- `db/schema/002_members.sql` `003_songs.sql` `004_news.sql`
- `db/seed/002_members_seed.sql` `003_songs_seed.sql` `004_news_seed.sql` (스크립트가 생성)
- `scripts/seed-from-data.ts` `scripts/admin-set-password.ts`
- `public/uploads/{members,songs,news,quotes}/.gitkeep`

**수정:**
- `src/lib/db.ts` — `loadCreds()`를 `creds.ts`에서 import
- `src/lib/quotes.ts` — admin용 함수 추가 (`getAllQuotesForAdmin`, `getQuoteById`)
- `src/app/{members,songs,news}/page.tsx` — lib 사용으로 전환 + `force-dynamic`
- `src/app/news/[id]/page.tsx` — lib 사용 + `generateStaticParams` 제거 + id 타입 number
- `src/components/{MemberCard,SongCard,NewsCard,MembersGrid,QuotePortrait}.tsx` — props 타입을 lib 도메인 타입으로
- `package.json` — bcryptjs, @types/bcryptjs, zod, tsx 추가
- `.gitignore` — 필요 시 `/public/uploads/**` 외 nothing 변경 없음 (실 업로드 파일은 git 추적)

**삭제:**
- `src/data/members.ts` `src/data/songs.ts` `src/data/news.ts`

---

## Task 1: 의존성 추가 + uploads 디렉토리 보존

**Files:**
- Modify: `package.json`
- Create: `public/uploads/members/.gitkeep`, `public/uploads/songs/.gitkeep`, `public/uploads/news/.gitkeep`, `public/uploads/quotes/.gitkeep`

- [ ] **Step 1: 의존성 설치**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm add bcryptjs zod
pnpm add -D @types/bcryptjs tsx
```

- [ ] **Step 2: 업로드 디렉토리 + .gitkeep 생성**

```bash
mkdir -p public/uploads/{members,songs,news,quotes}
for d in members songs news quotes; do
  echo "# admin이 업로드한 이미지가 저장되는 디렉토리. 정적 자산 디렉토리(public/{members,songs,news})와 분리." > public/uploads/$d/.gitkeep
done
```

- [ ] **Step 3: package.json 변경 확인**

```bash
git diff package.json
```

기대: dependencies에 `bcryptjs`, `zod` 추가. devDependencies에 `@types/bcryptjs`, `tsx` 추가.

- [ ] **Step 4: 빌드/타입 확인**

```bash
pnpm tsc --noEmit
```

기대: 에러 없음. (의존성만 추가했으므로 타입 변화 없음)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml public/uploads/
git commit -m "Add bcryptjs/zod deps and reserve public/uploads/ for admin uploads"
```

---

## Task 2: `loadCreds()` 추출 → `src/lib/creds.ts`

**Files:**
- Create: `src/lib/creds.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: `src/lib/creds.ts` 작성**

```ts
import "server-only";
import { readFileSync } from "node:fs";

const DEFAULT_PATH = "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";

export function loadCreds(): Record<string, string> {
  const path = process.env.DB_CREDENTIALS_PATH ?? DEFAULT_PATH;
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function requireCred(key: string): string {
  const c = loadCreds();
  const v = c[key];
  if (!v) throw new Error(`Missing credential: ${key}`);
  return v;
}
```

- [ ] **Step 2: `src/lib/db.ts`에서 loadCreds 인라인 제거 + import**

`src/lib/db.ts`를 다음과 같이 수정:

```ts
import "server-only";
import mysql from "mysql2/promise";
import { loadCreds } from "./creds";

function createPool(): mysql.Pool {
  const c = loadCreds();
  return mysql.createPool({
    host: c.DB_HOST,
    user: c.DB_USER,
    password: c.DB_PASS,
    database: c.DB_NAME,
    connectionLimit: 5,
    waitForConnections: true,
    charset: "utf8mb4",
  });
}

const g = globalThis as unknown as { __bs_pool?: mysql.Pool };

export function getPool(): mysql.Pool {
  return g.__bs_pool ?? (g.__bs_pool = createPool());
}
```

(기존 `loadCreds`, `readFileSync` import 제거. `import "server-only"` 추가.)

- [ ] **Step 3: 타입 확인**

```bash
pnpm tsc --noEmit
```

기대: 에러 없음.

- [ ] **Step 4: 동작 확인 — /quote 페이지가 여전히 작동하는지**

```bash
pnpm dev
# 브라우저: http://localhost:3100/quote 접속, 명언 5건 정상 렌더 확인
# Ctrl+C로 종료
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/creds.ts src/lib/db.ts
git commit -m "Extract loadCreds() to src/lib/creds.ts for db/auth sharing"
```

---

## Task 3: admin 비밀번호 해시 스크립트 + `.db_credentials` 키 3개 추가

**Files:**
- Create: `scripts/admin-set-password.ts`
- Modify: `/var/www/html/_______site_BANDSUSTAIN/.db_credentials` (시스템 파일, 사용자 직접 편집)

- [ ] **Step 1: `scripts/admin-set-password.ts` 작성**

```ts
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: pnpm tsx scripts/admin-set-password.ts <password>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("ERROR: password must be at least 12 chars");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const sessionSecret = randomBytes(32).toString("hex");

console.log("");
console.log("# .db_credentials 에 아래 3줄을 추가하세요 (ADMIN_USERNAME은 본인 ID로 교체):");
console.log("");
console.log("ADMIN_USERNAME=<운영자 ID>");
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
console.log("");
console.log("주의: 파일 소유자는 ec2-user:ec2-user, 권한은 600 이어야 합니다.");
```

- [ ] **Step 2: 스크립트 실행 (사용자가 비밀번호 직접 결정)**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm tsx scripts/admin-set-password.ts '<직접 정한 비밀번호 12자 이상>'
```

기대: bcrypt 해시 + 32바이트 랜덤 hex secret이 출력됨.

- [ ] **Step 3: `.db_credentials`에 3줄 추가 (사용자 협업)**

출력된 3줄을 `/var/www/html/_______site_BANDSUSTAIN/.db_credentials` 끝에 붙여넣고 `ADMIN_USERNAME`은 실제 ID로 교체.

권한/소유자 확인:

```bash
ls -la /var/www/html/_______site_BANDSUSTAIN/.db_credentials
# 기대: -rw------- 1 ec2-user ec2-user
```

만약 root 소유면 메모리 `feedback_db_credentials_owner.md`에 따라 ec2-user로 chown 필요:

```bash
sudo chown ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN/.db_credentials
```

- [ ] **Step 4: 환경변수 로딩 검증**

```bash
node -e '
  const { loadCreds } = require("./src/lib/creds.ts");
' 2>&1 || true
# (위 한 줄은 ts 직접 require 불가라 실패. 아래로 대체)

pnpm tsx -e '
  import("./src/lib/creds").then(({ loadCreds }) => {
    const c = loadCreds();
    console.log("USERNAME:", c.ADMIN_USERNAME);
    console.log("HASH OK:", c.ADMIN_PASSWORD_HASH?.startsWith("$2"));
    console.log("SECRET LEN:", c.ADMIN_SESSION_SECRET?.length);
  });
'
```

기대: USERNAME이 정확히 나오고, HASH OK: true, SECRET LEN: 64.

- [ ] **Step 5: Commit (스크립트만)**

```bash
git add scripts/admin-set-password.ts
git commit -m "Add admin-set-password.ts script generating bcrypt hash + session secret"
```

`.db_credentials`는 git 추적 대상 아님 (`.gitignore` 또는 outside repo).

---

## Task 4: `src/lib/auth.ts` (HMAC 세션 토큰)

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: `src/lib/auth.ts` 작성**

```ts
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { loadCreds } from "./creds";

const COOKIE_NAME = "bs_admin";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

type Payload = { u: string; iat: number; exp: number };

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSessionToken(username: string): string {
  const c = loadCreds();
  const secret = c.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET missing");

  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { u: username, iat: now, exp: now + SEVEN_DAYS };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): Payload | null {
  if (!token) return null;
  const c = loadCreds();
  const secret = c.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = sign(payloadB64, secret);

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  return payload;
}

export async function verifyAdminPassword(
  username: string,
  password: string,
): Promise<boolean> {
  const c = loadCreds();
  const expectedUser = c.ADMIN_USERNAME;
  const hash = c.ADMIN_PASSWORD_HASH;
  if (!expectedUser || !hash) return false;

  const a = Buffer.from(username);
  const b = Buffer.from(expectedUser);
  const userOk = a.length === b.length && timingSafeEqual(a, b);
  const passOk = await bcrypt.compare(password, hash);
  return userOk && passOk;
}

export async function setSessionCookie(username: string): Promise<void> {
  const token = createSessionToken(username);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function readSession(): Promise<Payload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
```

- [ ] **Step 2: 스모크 검증 (수동)**

```bash
pnpm tsx -e '
  import("./src/lib/auth").then(async ({ createSessionToken, verifySessionToken, verifyAdminPassword }) => {
    const t = createSessionToken("testuser");
    console.log("token:", t.length, "chars");
    const p = verifySessionToken(t);
    console.log("verified:", p);

    // 위변조 검출
    const bad = t.slice(0, -3) + "xxx";
    console.log("tampered:", verifySessionToken(bad));

    // 만료
    const expired = "eyJ1IjoieCIsImlhdCI6MTAwMCwiZXhwIjoyMDAwfQ.xxxxxx";
    console.log("expired:", verifySessionToken(expired));
  });
'
```

기대:
- `token: <긴 문자열> chars`
- `verified: { u: "testuser", iat, exp }`
- `tampered: null`
- `expired: null`

- [ ] **Step 3: 비밀번호 검증 스모크**

```bash
pnpm tsx -e '
  import("./src/lib/auth").then(async ({ verifyAdminPassword }) => {
    console.log("good:", await verifyAdminPassword("<실제 ID>", "<실제 비밀번호>"));
    console.log("bad pw:", await verifyAdminPassword("<실제 ID>", "wrongpassword"));
    console.log("bad user:", await verifyAdminPassword("nobody", "<실제 비밀번호>"));
  });
'
```

기대: `good: true`, `bad pw: false`, `bad user: false`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "Add HMAC-signed session token + bcrypt admin password verifier"
```

---

## Task 5: `src/lib/upload.ts` (이미지 업로드 검증 + 저장)

**Files:**
- Create: `src/lib/upload.ts`

- [ ] **Step 1: `src/lib/upload.ts` 작성**

```ts
"use server";
import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readSession } from "./auth";

const MAX_BYTES = 8 * 1024 * 1024;
const RESOURCES = ["members", "songs", "news", "quotes"] as const;
type Resource = (typeof RESOURCES)[number];

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) return "image/png";
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
  ) return "image/gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function uploadImage(
  formData: FormData,
  resource: Resource,
): Promise<UploadResult> {
  const session = await readSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (!RESOURCES.includes(resource)) {
    return { ok: false, error: "Invalid resource" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file" };
  if (file.size === 0) return { ok: false, error: "Empty file" };
  if (file.size > MAX_BYTES) return { ok: false, error: "File too large (max 8MB)" };

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectMimeFromMagic(buf);
  if (!detected) return { ok: false, error: "Unsupported image format" };

  const ext = MIME_EXT[detected];
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", resource);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  return { ok: true, path: `/uploads/${resource}/${filename}` };
}
```

- [ ] **Step 2: 매직바이트 검증 스모크**

```bash
pnpm tsx -e '
  // 직접 import 불가 (use server). 매직바이트 detection만 테스트
  const fs = require("node:fs");
  const buf1 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)]);
  const buf2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(20).fill(0)]);
  const buf3 = Buffer.from(Array(20).fill(0));
  console.log("jpeg magic:", buf1.slice(0,3).toString("hex"));
  console.log("png magic:", buf2.slice(0,4).toString("hex"));
  console.log("zero magic:", buf3.slice(0,4).toString("hex"));
'
```

기대: ffd8ff, 89504e47, 00000000. (실제 동작은 admin 폼 통합 후 브라우저로 검증)

- [ ] **Step 3: Commit**

```bash
git add src/lib/upload.ts
git commit -m "Add upload action with magic-byte validation and uuid filename"
```

---

## Task 6: `members` 테이블 schema + DB 적용

**Files:**
- Create: `db/schema/002_members.sql`

- [ ] **Step 1: `db/schema/002_members.sql` 작성**

```sql
-- 002_members.sql
-- bandsustain.com /members 탭 — 멤버 카드 데이터
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/002_members.sql

CREATE TABLE IF NOT EXISTS members (
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

- [ ] **Step 2: DB 적용**

```bash
cd /root/bandsustain/public_html/bandsustain
. <(grep -E '^DB_(HOST|USER|PASS|NAME)=' /var/www/html/_______site_BANDSUSTAIN/.db_credentials | sed 's/^/export /')
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/002_members.sql
unset DB_PASS
```

- [ ] **Step 3: 적용 확인**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e 'DESCRIBE members'
```

기대: 11개 컬럼 (id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published, created_at, updated_at).

- [ ] **Step 4: Commit**

```bash
git add db/schema/002_members.sql
git commit -m "Add members table schema"
```

---

## Task 7: `songs` 테이블 schema + DB 적용

**Files:**
- Create: `db/schema/003_songs.sql`

- [ ] **Step 1: `db/schema/003_songs.sql` 작성**

```sql
-- 003_songs.sql
-- bandsustain.com /songs 탭 — 곡 카드 + 가사 데이터

CREATE TABLE IF NOT EXISTS songs (
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

- [ ] **Step 2: DB 적용**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/003_songs.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e 'DESCRIBE songs'
```

기대: 10개 컬럼.

- [ ] **Step 3: Commit**

```bash
git add db/schema/003_songs.sql
git commit -m "Add songs table schema"
```

---

## Task 8: `news` 테이블 schema + DB 적용

**Files:**
- Create: `db/schema/004_news.sql`

- [ ] **Step 1: `db/schema/004_news.sql` 작성**

```sql
-- 004_news.sql
-- bandsustain.com /news 탭 — 뉴스 카드 + 본문 데이터

CREATE TABLE IF NOT EXISTS news (
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

- [ ] **Step 2: DB 적용 + 검증**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/004_news.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e 'DESCRIBE news'
```

기대: 10개 컬럼.

- [ ] **Step 3: Commit**

```bash
git add db/schema/004_news.sql
git commit -m "Add news table schema"
```

---

## Task 9: `scripts/seed-from-data.ts` 작성 + seed SQL 3개 생성 + DB 적용

**Files:**
- Create: `scripts/seed-from-data.ts`
- Create: `db/seed/002_members_seed.sql`, `db/seed/003_songs_seed.sql`, `db/seed/004_news_seed.sql` (스크립트가 생성)

- [ ] **Step 1: `scripts/seed-from-data.ts` 작성**

```ts
import { writeFileSync } from "node:fs";
import { members } from "../src/data/members";
import { songs } from "../src/data/songs";
import { news } from "../src/data/news";

function esc(s: string | null | undefined): string {
  if (s == null) return "NULL";
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

function bool(b: boolean): string {
  return b ? "1" : "0";
}

// members
{
  const lines: string[] = [
    "-- 002_members_seed.sql (auto-generated by scripts/seed-from-data.ts)",
    "-- src/data/members.ts → INSERT 변환",
    "",
    "INSERT INTO members (name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published) VALUES",
  ];
  const rows = members.map((m, i) => {
    const order = m.order ?? (i + 1);
    return `(${esc(m.nameEn)}, ${esc(m.nameKr)}, ${esc(m.position)}, ${esc(m.photo)}, ${esc(m.favoriteArtist)}, ${esc(m.favoriteSong)}, ${order}, 1)`;
  });
  lines.push(rows.join(",\n") + ";");
  writeFileSync("db/seed/002_members_seed.sql", lines.join("\n") + "\n");
  console.log(`Wrote ${rows.length} members`);
}

// songs
{
  const lines: string[] = [
    "-- 003_songs_seed.sql (auto-generated)",
    "",
    "INSERT INTO songs (title, category, artwork_url, listen_url, lyrics, released_at, published) VALUES",
  ];
  const rows = songs.map((s) => {
    return `(${esc(s.title)}, ${esc(s.category)}, ${esc(s.artwork)}, ${esc(s.listenUrl || null)}, ${esc(s.lyrics || null)}, ${esc(s.releasedAt)}, 1)`;
  });
  lines.push(rows.join(",\n") + ";");
  writeFileSync("db/seed/003_songs_seed.sql", lines.join("\n") + "\n");
  console.log(`Wrote ${rows.length} songs`);
}

// news
{
  const lines: string[] = [
    "-- 004_news_seed.sql (auto-generated)",
    "",
    "INSERT INTO news (headline, category, date, hero_image, body, mid_image, published) VALUES",
  ];
  const rows = news.map((n) => {
    return `(${esc(n.headline)}, ${esc(n.category)}, ${esc(n.date)}, ${esc(n.heroImage)}, ${esc(n.body)}, ${esc(n.midImage ?? null)}, 1)`;
  });
  lines.push(rows.join(",\n") + ";");
  writeFileSync("db/seed/004_news_seed.sql", lines.join("\n") + "\n");
  console.log(`Wrote ${rows.length} news`);
}

console.log("Done. Inspect db/seed/*.sql before applying.");
```

주의: `members.order` 필드가 없으면 인덱스+1로 fallback. `songs.listenUrl`/`lyrics`가 빈 문자열이면 `null`로 변환(스키마는 NULL 허용).

- [ ] **Step 2: 스크립트 실행 → SQL 파일 생성**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm tsx scripts/seed-from-data.ts
```

기대: `Wrote 9 members` `Wrote N songs` `Wrote M news` 출력 + 3개 SQL 파일 생성.

- [ ] **Step 3: 생성된 SQL 검토**

```bash
head -20 db/seed/002_members_seed.sql
head -10 db/seed/003_songs_seed.sql
head -10 db/seed/004_news_seed.sql
```

이스케이프(따옴표, 줄바꿈) 잘 처리되었는지 육안 확인.

- [ ] **Step 4: DB 적용**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/seed/002_members_seed.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/seed/003_songs_seed.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/seed/004_news_seed.sql
```

- [ ] **Step 5: row 카운트 검증**

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e '
  SELECT "members" AS t, COUNT(*) AS n FROM members
  UNION ALL SELECT "songs", COUNT(*) FROM songs
  UNION ALL SELECT "news", COUNT(*) FROM news;
'
```

기대: 각각 src/data 파일의 배열 길이와 일치.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-from-data.ts db/seed/002_members_seed.sql db/seed/003_songs_seed.sql db/seed/004_news_seed.sql
git commit -m "Generate seed SQL from src/data/* and apply to BANDSUSTAIN DB"
```

---

## Task 10: `src/lib/members.ts` 도메인 타입 + read 함수

**Files:**
- Create: `src/lib/members.ts`

- [ ] **Step 1: `src/lib/members.ts` 작성**

```ts
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type Member = {
  id: number;
  nameEn: string;
  nameKr: string;
  position: string;
  photoUrl: string;
  favoriteArtist: string | null;
  favoriteSong: string | null;
  displayOrder: number;
  published: boolean;
};

type Row = RowDataPacket & {
  id: number;
  name_en: string;
  name_kr: string;
  position: string;
  photo_url: string;
  favorite_artist: string | null;
  favorite_song: string | null;
  display_order: number;
  published: number;
};

function rowToMember(r: Row): Member {
  return {
    id: r.id,
    nameEn: r.name_en,
    nameKr: r.name_kr,
    position: r.position,
    photoUrl: r.photo_url,
    favoriteArtist: r.favorite_artist,
    favoriteSong: r.favorite_song,
    displayOrder: r.display_order,
    published: r.published === 1,
  };
}

export async function getPublishedMembers(): Promise<Member[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published
     FROM members
     WHERE published = 1
     ORDER BY display_order ASC, id ASC`,
  );
  return rows.map(rowToMember);
}

export async function getAllMembersForAdmin(): Promise<Member[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published
     FROM members
     ORDER BY display_order ASC, id ASC`,
  );
  return rows.map(rowToMember);
}

export async function getMemberById(id: number): Promise<Member | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published
     FROM members WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToMember(rows[0]) : null;
}

export async function countMembers(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM members",
  );
  return rows[0]?.c ?? 0;
}
```

- [ ] **Step 2: 스모크**

```bash
pnpm tsx -e '
  import("./src/lib/members").then(async ({ getPublishedMembers, getMemberById }) => {
    const all = await getPublishedMembers();
    console.log("count:", all.length);
    console.log("first:", all[0]);
    if (all[0]) {
      console.log("byId:", await getMemberById(all[0].id));
    }
  });
'
```

기대: count가 src/data/members.ts 길이와 같고, first가 camelCase 도메인 타입.

- [ ] **Step 3: Commit**

```bash
git add src/lib/members.ts
git commit -m "Add Member domain type and read queries"
```

---

## Task 11: `src/lib/songs.ts` 도메인 타입 + read 함수

**Files:**
- Create: `src/lib/songs.ts`

- [ ] **Step 1: 작성**

```ts
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type SongCategory = "Album" | "EP" | "Single" | "Live Session";

export type Song = {
  id: number;
  title: string;
  category: SongCategory;
  artworkUrl: string;
  listenUrl: string | null;
  lyrics: string | null;
  releasedAt: Date;
  published: boolean;
};

type Row = RowDataPacket & {
  id: number;
  title: string;
  category: SongCategory;
  artwork_url: string;
  listen_url: string | null;
  lyrics: string | null;
  released_at: Date;
  published: number;
};

function rowToSong(r: Row): Song {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    artworkUrl: r.artwork_url,
    listenUrl: r.listen_url,
    lyrics: r.lyrics,
    releasedAt: r.released_at instanceof Date ? r.released_at : new Date(r.released_at),
    published: r.published === 1,
  };
}

export async function getPublishedSongs(): Promise<Song[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, title, category, artwork_url, listen_url, lyrics, released_at, published
     FROM songs WHERE published = 1
     ORDER BY released_at DESC, id DESC`,
  );
  return rows.map(rowToSong);
}

export async function getAllSongsForAdmin(): Promise<Song[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, title, category, artwork_url, listen_url, lyrics, released_at, published
     FROM songs ORDER BY released_at DESC, id DESC`,
  );
  return rows.map(rowToSong);
}

export async function getSongById(id: number): Promise<Song | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, title, category, artwork_url, listen_url, lyrics, released_at, published
     FROM songs WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToSong(rows[0]) : null;
}

export async function countSongs(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM songs",
  );
  return rows[0]?.c ?? 0;
}
```

- [ ] **Step 2: 스모크**

```bash
pnpm tsx -e '
  import("./src/lib/songs").then(async ({ getPublishedSongs }) => {
    const all = await getPublishedSongs();
    console.log("count:", all.length);
    console.log("first.year:", all[0]?.releasedAt.getFullYear());
    console.log("first.lyrics len:", all[0]?.lyrics?.length);
  });
'
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/songs.ts
git commit -m "Add Song domain type and read queries"
```

---

## Task 12: `src/lib/news.ts` 도메인 타입 + read 함수

**Files:**
- Create: `src/lib/news.ts`

- [ ] **Step 1: 작성**

```ts
import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type NewsItem = {
  id: number;
  headline: string;
  category: string;
  date: Date;
  heroImage: string;
  body: string;
  midImage: string | null;
  published: boolean;
};

type Row = RowDataPacket & {
  id: number;
  headline: string;
  category: string;
  date: Date;
  hero_image: string;
  body: string;
  mid_image: string | null;
  published: number;
};

function rowToItem(r: Row): NewsItem {
  return {
    id: r.id,
    headline: r.headline,
    category: r.category,
    date: r.date instanceof Date ? r.date : new Date(r.date),
    heroImage: r.hero_image,
    body: r.body,
    midImage: r.mid_image,
    published: r.published === 1,
  };
}

export async function getPublishedNews(): Promise<NewsItem[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, headline, category, date, hero_image, body, mid_image, published
     FROM news WHERE published = 1
     ORDER BY date DESC, id DESC`,
  );
  return rows.map(rowToItem);
}

export async function getAllNewsForAdmin(): Promise<NewsItem[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, headline, category, date, hero_image, body, mid_image, published
     FROM news ORDER BY date DESC, id DESC`,
  );
  return rows.map(rowToItem);
}

export async function getNewsById(id: number): Promise<NewsItem | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, headline, category, date, hero_image, body, mid_image, published
     FROM news WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function countNews(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM news",
  );
  return rows[0]?.c ?? 0;
}

export function formatNewsDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function excerpt(body: string, max: number): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + "…";
}
```

- [ ] **Step 2: 스모크**

```bash
pnpm tsx -e '
  import("./src/lib/news").then(async ({ getPublishedNews, getNewsById, formatNewsDate, excerpt }) => {
    const all = await getPublishedNews();
    console.log("count:", all.length);
    console.log("first date:", formatNewsDate(all[0].date));
    console.log("first excerpt:", excerpt(all[0].body, 80));
  });
'
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/news.ts
git commit -m "Add NewsItem domain type and read queries"
```

---

## Task 13: `src/lib/quotes.ts`에 admin read 함수 + count 추가

**Files:**
- Modify: `src/lib/quotes.ts`

- [ ] **Step 1: 함수 3개 추가 (기존 함수는 보존)**

`src/lib/quotes.ts` 끝에 다음을 추가:

```ts
export async function getAllQuotesForAdmin(): Promise<Quote[]> {
  const [rows] = await getPool().query<(Quote & RowDataPacket)[]>(
    `SELECT id, text, lang, text_translated, attribution, portrait_url, created_at, published
     FROM quotes
     ORDER BY created_at DESC, id DESC`,
  );
  return rows;
}

export async function getQuoteById(id: number): Promise<Quote | null> {
  const [rows] = await getPool().query<(Quote & RowDataPacket)[]>(
    `SELECT id, text, lang, text_translated, attribution, portrait_url, created_at, published
     FROM quotes WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function countQuotes(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM quotes",
  );
  return rows[0]?.c ?? 0;
}
```

기존 `Quote` 타입에도 `published?: number` 필드를 옵션으로 추가하고, `getPublishedQuotes`는 그대로 유지(기존 동작 보존).

`Quote` 타입을 다음과 같이 수정:

```ts
export type Quote = {
  id: number;
  text: string;
  lang: "ko" | "en";
  text_translated: string | null;
  attribution: string | null;
  portrait_url: string | null;
  created_at: Date;
  published?: number;  // admin 함수에서만 셋
};
```

- [ ] **Step 2: 타입/스모크 확인**

```bash
pnpm tsc --noEmit
pnpm tsx -e '
  import("./src/lib/quotes").then(async ({ getAllQuotesForAdmin, countQuotes }) => {
    console.log("count:", await countQuotes());
    const all = await getAllQuotesForAdmin();
    console.log("first:", all[0]?.text?.slice(0, 30));
  });
'
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/quotes.ts
git commit -m "Add admin read queries + count to quotes lib"
```

---

## Task 14: `/members` public 페이지 + MemberCard / MembersGrid 도메인 타입으로 전환

**Files:**
- Modify: `src/app/members/page.tsx`
- Modify: `src/components/MemberCard.tsx`
- Modify: `src/components/MembersGrid.tsx`

- [ ] **Step 1: `src/app/members/page.tsx`를 lib 사용으로 전환**

전체 파일 교체:

```tsx
import type { Metadata } from "next";
import MembersGrid from "@/components/MembersGrid";
import { getPublishedMembers } from "@/lib/members";

export const dynamic = "force-dynamic";

const description = "Let me introduce the best friends of your life — 너의 인생에 최고의 친구들을 소개합니다";
const ogImage = "/members/member01.jpg";

export const metadata: Metadata = {
  title: "Members",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/members",
    title: "Members — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Members" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Members — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default async function MembersPage() {
  const members = await getPublishedMembers();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-12">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Members
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          Let me introduce the best friends of your life
          <br />
          너의 인생에 최고의 친구들을 소개합니다
        </p>
      </header>

      <MembersGrid members={members} />
    </section>
  );
}
```

- [ ] **Step 2: `MembersGrid.tsx` props 타입 교체**

`import type { Member } from "@/data/members";`를 `import type { Member } from "@/lib/members";`로 바꾸고 컴파일 에러 발생하는 부분 모두 수정. (기본적으로 import 한 줄만 바꿔도 새 타입과 호환되는 필드가 대부분이고, 아래 단계에서 필드명 마이그레이션을 처리)

- [ ] **Step 3: `MemberCard.tsx` props 마이그레이션**

```bash
grep -n "member\.\(photo\|nameEn\|nameKr\|position\|favoriteArtist\|favoriteSong\|order\)" src/components/MemberCard.tsx
```

다음 매핑으로 일괄 치환:
- `member.photo` → `member.photoUrl`
- `member.order` → `member.displayOrder`
- 그 외(`nameEn`, `nameKr`, `position`, `favoriteArtist`, `favoriteSong`)는 동일

`import type { Member } from "@/data/members"` → `import type { Member } from "@/lib/members"`.

- [ ] **Step 4: 타입 + 동작 확인**

```bash
pnpm tsc --noEmit
pnpm dev
# 브라우저: http://localhost:3100/members
# 9명 멤버가 정상 렌더, 사진 표시, expand/collapse 동작 확인
```

- [ ] **Step 5: Commit**

```bash
git add src/app/members/page.tsx src/components/MemberCard.tsx src/components/MembersGrid.tsx
git commit -m "Switch /members page to lib + force-dynamic + camelCase props"
```

---

## Task 15: `/songs` public 페이지 + SongCard / SongGrid 전환

**Files:**
- Modify: `src/app/songs/page.tsx`
- Modify: `src/components/SongCard.tsx`
- Modify: `src/components/SongGrid.tsx` (있다면)
- Modify: `src/components/LyricsModal.tsx` (Song 타입 사용 시)

- [ ] **Step 1: `src/app/songs/page.tsx` lib 사용 전환**

기존 page.tsx를 `getPublishedSongs()` 호출하는 형태로 수정. quote 패턴 참고:

```tsx
// 파일 상단
import { getPublishedSongs } from "@/lib/songs";

export const dynamic = "force-dynamic";

// 컴포넌트
export default async function SongsPage() {
  const songs = await getPublishedSongs();
  // 나머지 JSX는 기존 그대로, songs 배열을 SongGrid 등에 전달
}
```

- [ ] **Step 2: `SongCard.tsx` props 마이그레이션**

매핑:
- `song.artwork` → `song.artworkUrl`
- `song.year` → `song.releasedAt.getFullYear()`
- `song.listenUrl` 그대로 (단 type이 `string | null`로 바뀜 — null check 추가 필요)
- `song.lyrics` 그대로 (`string | null`)

`import type { Song } from "@/data/songs"` → `import type { Song } from "@/lib/songs"`.

- [ ] **Step 3: `LyricsModal.tsx`도 동일 마이그레이션 (Song 타입 import 변경)**

- [ ] **Step 4: 동작 확인**

```bash
pnpm tsc --noEmit
pnpm dev
# 브라우저: http://localhost:3100/songs
# 곡 카드 정상 렌더, 가사 모달 열림 확인
```

- [ ] **Step 5: Commit**

```bash
git add src/app/songs/page.tsx src/components/SongCard.tsx src/components/SongGrid.tsx src/components/LyricsModal.tsx
git commit -m "Switch /songs page to lib + force-dynamic + camelCase props"
```

---

## Task 16: `/news` + `/news/[id]` public 페이지 + NewsCard 전환

**Files:**
- Modify: `src/app/news/page.tsx`
- Modify: `src/app/news/[id]/page.tsx`
- Modify: `src/components/NewsCard.tsx`

- [ ] **Step 1: `/news/page.tsx` 전환**

```tsx
// 파일 상단 import
import { getPublishedNews } from "@/lib/news";

export const dynamic = "force-dynamic";

// 컴포넌트
export default async function NewsPage() {
  const items = await getPublishedNews();
  // 기존 JSX, items 배열을 NewsCard 리스트로 렌더
}
```

- [ ] **Step 2: `/news/[id]/page.tsx` 전환**

`generateStaticParams` 제거. id는 `Number(params.id)`로 변환:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsById, formatNewsDate, excerpt } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return {};
  const item = await getNewsById(numId);
  if (!item) return {};

  const description = excerpt(item.body, 200);
  const url = `https://bandsustain.com/news/${item.id}`;

  return {
    title: item.headline,
    description,
    openGraph: {
      type: "article",
      siteName: "Band Sustain",
      url,
      title: item.headline,
      description,
      images: [{ url: item.heroImage, alt: item.headline }],
      locale: "ko_KR",
      publishedTime: formatNewsDate(item.date),
    },
    twitter: {
      card: "summary_large_image",
      title: item.headline,
      description,
      images: [item.heroImage],
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const item = await getNewsById(numId);
  if (!item || !item.published) notFound();

  // 본문 단락 렌더 (안전한 텍스트 노드, dangerouslySetInnerHTML 금지)
  const paragraphs = item.body.split(/\n\n+/);

  return (
    // 기존 JSX 구조 유지하면서 paragraphs를 다음과 같이 렌더:
    // {paragraphs.map((p, i) => (
    //   <p key={i} className="...">
    //     {p.split("\n").flatMap((line, j) =>
    //       j === 0 ? [line] : [<br key={j} />, line],
    //     )}
    //   </p>
    // ))}
    // formatNewsDate(item.date), item.heroImage, item.midImage 등 그대로 사용
    <></>
  );
}
```

기존 `/news/[id]/page.tsx`의 JSX 구조(브레드크럼, 헤더, hero 이미지, midImage 위치 등)는 그대로 유지하고 데이터 출처만 lib로 바꾸고 본문 렌더만 위 안전한 형태로 교체.

- [ ] **Step 3: `NewsCard.tsx` props 마이그레이션**

`import type { NewsItem } from "@/data/news"` → `import type { NewsItem } from "@/lib/news"`.
`item.heroImage` 그대로, `item.midImage` 그대로. `item.id`는 number이므로 `<Link href={`/news/${item.id}`}>`는 템플릿 리터럴로 자동 변환됨. `formatNewsDate`는 lib에서 import.

- [ ] **Step 4: 동작 확인**

```bash
pnpm tsc --noEmit
pnpm dev
# 브라우저:
# - /news 리스트 정상
# - /news/1 상세 페이지 정상 (URL이 01에서 1로 바뀐 점 확인)
# - 본문 단락이 \n\n 기준으로 분리되고 \n은 <br>로 렌더
# - midImage 있는 글에서 중간 이미지 정상 표시
```

- [ ] **Step 5: Commit**

```bash
git add src/app/news/page.tsx src/app/news/[id]/page.tsx src/components/NewsCard.tsx
git commit -m "Switch /news pages to lib + force-dynamic + safe paragraph render"
```

---

## Task 17: `src/data/{members,songs,news}.ts` 삭제 + 사용처 검증

**Files:**
- Delete: `src/data/members.ts`, `src/data/songs.ts`, `src/data/news.ts`

- [ ] **Step 1: 사용처 검증 (남은 import 있는지)**

```bash
cd /root/bandsustain/public_html/bandsustain
grep -rn "from \"@/data" src/ 2>&1 || true
grep -rn "from \"@/data" scripts/ 2>&1 || true
```

기대: scripts/seed-from-data.ts에서 한 번만 import (작업 완료된 일회성 스크립트). 그 외 src/ 안에 남은 참조 없음.

- [ ] **Step 2: 파일 삭제**

```bash
rm src/data/members.ts src/data/songs.ts src/data/news.ts
# src/data 디렉토리가 비면 디렉토리 자체도 제거
rmdir src/data 2>/dev/null || true
```

- [ ] **Step 3: scripts/seed-from-data.ts 의 import 처리**

스크립트는 일회용이지만 git에는 남음. `@/data/*` 경로가 더 이상 존재하지 않으므로 스크립트가 깨짐. 두 가지 선택:
- (a) 스크립트 상단에 `// 이 스크립트는 src/data/* 가 존재하던 시점에 한 번 실행되었습니다. 재실행 불가.` 주석 추가만.
- (b) 스크립트도 함께 삭제.

(a)를 채택. import 라인 위에 주석:

```ts
// 주의: 이 스크립트는 src/data/{members,songs,news}.ts 가 존재하던 시점에
// 한 번 실행되어 db/seed/00{2,3,4}_*_seed.sql 을 생성한 일회성 코드입니다.
// 해당 데이터 파일이 제거된 이후로는 재실행 불가능합니다 (히스토리 보존용).
```

- [ ] **Step 4: 빌드 확인**

```bash
pnpm tsc --noEmit
pnpm build
```

기대: 빌드 성공. `@/data/*` 참조 에러 없음.

- [ ] **Step 5: 동작 확인**

```bash
pnpm dev
# 브라우저: /members, /songs, /news, /news/<id>, /quote 모두 정상 렌더 확인
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Delete src/data/* — public pages now read from DB"
```

---

## Task 18: `src/middleware.ts` (`/admin/*` 보호)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 작성**

```ts
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bs_admin";

// Edge runtime에서 동작해야 하므로 lib/auth의 verifySessionToken 을 인라인으로 가져오기
// (auth.ts 는 server-only / node:crypto 의존이라 middleware 에서 import 불가)
// 대신 여기서는 토큰의 존재 여부 + 형식만 검증하고, 실제 HMAC 검증은 페이지 레벨에서
// readSession() 으로 한다. 형식이 깨진 경우 즉시 차단.

function looksLikeToken(t: string | undefined): boolean {
  if (!t) return false;
  const parts = t.split(".");
  if (parts.length !== 2) return false;
  return parts[0].length > 0 && parts[1].length > 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/admin/login")
    || pathname === "/admin/logout"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!looksLikeToken(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

**중요한 보안 메모:** middleware는 Edge runtime 제약상 HMAC 검증을 못 한다(node:crypto 미지원 가능성). 따라서 middleware는 "쿠키가 토큰 형식인지"만 확인하는 1차 게이트. 실제 위변조 검증은 각 admin 페이지/Server Action에서 `readSession()`을 호출해 수행. 위변조된 쿠키를 든 사용자는 middleware 통과 후 페이지가 `notFound()`/`redirect("/admin/login")`을 던지게 만든다.

- [ ] **Step 2: 동작 확인**

```bash
pnpm dev
# 브라우저:
# - /admin 접속 → /admin/login?next=/admin 으로 리다이렉트
# - /admin/login 접속 → 폼 보임 (다음 task에서 구현)
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "Add middleware: redirect unauthenticated /admin/* to /admin/login"
```

---

## Task 19: `/admin/login` 페이지 + 로그인 server action

**Files:**
- Create: `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`

- [ ] **Step 1: `src/app/admin/login/actions.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setSessionCookie, verifyAdminPassword } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "잘못된 입력" };
  }
  const ok = await verifyAdminPassword(parsed.data.username, parsed.data.password);
  if (!ok) {
    return { error: "ID 또는 비밀번호가 올바르지 않습니다" };
  }
  await setSessionCookie(parsed.data.username);

  const next = parsed.data.next && parsed.data.next.startsWith("/admin")
    ? parsed.data.next
    : "/admin";
  redirect(next);
}
```

- [ ] **Step 2: `src/app/admin/login/page.tsx`**

```tsx
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--color-bg)]">
      <div className="w-full max-w-md">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-4xl mb-8">
          Admin Login
        </h1>
        <Suspense>
          <LoginForm next={next ?? "/admin"} />
        </Suspense>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: `src/app/admin/login/LoginForm.tsx` (client)**

```tsx
"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        <span className="uppercase tracking-wider text-[var(--color-text-muted)]">ID</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          className="border border-[var(--color-border-strong)] px-4 py-3 text-base bg-[var(--color-bg)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        <span className="uppercase tracking-wider text-[var(--color-text-muted)]">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border border-[var(--color-border-strong)] px-4 py-3 text-base bg-[var(--color-bg)]"
        />
      </label>
      {state.error && (
        <p className="text-sm text-[var(--color-accent)]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: 동작 확인**

```bash
pnpm dev
# 브라우저: /admin/login
# - 잘못된 비밀번호 → 에러 메시지
# - 올바른 ID/PW → /admin 으로 리다이렉트 (다음 task의 dashboard가 아직 없으면 404, 그건 정상)
# - 쿠키 확인: bs_admin httpOnly 쿠키 발급되는지 DevTools에서 검증
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/login/
git commit -m "Add /admin/login page with bcrypt verify + session cookie"
```

---

## Task 20: `/admin/logout` (POST 라우트 핸들러)

**Files:**
- Create: `src/app/admin/logout/route.ts`

- [ ] **Step 1: 작성**

```ts
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/admin/login", "http://placeholder"), {
    status: 303,
  });
}
```

주의: `NextResponse.redirect` 절대 URL 필요. 위 placeholder는 동작 안 할 수 있으므로 다음 형태가 더 안전:

```ts
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearSessionCookie();
  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
```

- [ ] **Step 2: 동작 확인**

```bash
pnpm dev
# 1) /admin/login 에서 로그인
# 2) curl 또는 다음 task의 nav에서 logout button 통해 POST /admin/logout
# 3) 쿠키 만료 + /admin/login 으로 리다이렉트
```

수동 검증 (브라우저 콘솔):
```js
fetch("/admin/logout", { method: "POST", redirect: "manual" })
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/logout/
git commit -m "Add /admin/logout POST route to clear session cookie"
```

---

## Task 21: `src/app/admin/layout.tsx` + `AdminNav`

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: `src/components/admin/AdminNav.tsx` (client)**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/songs", label: "Songs" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/quotes", label: "Quotes" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] py-8 px-6">
      <p className="font-display font-black uppercase text-lg mb-6">Admin</p>
      <nav className="flex flex-col gap-3 mb-8">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                "text-sm uppercase tracking-wider " +
                (active
                  ? "text-[var(--color-text)] underline underline-offset-4"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]")
              }
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <form action="/admin/logout" method="post">
        <button
          type="submit"
          className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Logout
        </button>
      </form>
    </aside>
  );
}
```

**구조 결정:** Next.js App Router에서 `/admin/layout.tsx`는 `/admin/login`에도 적용된다. 로그인 페이지에는 nav/세션 가드를 적용하지 않아야 하므로 **route group `(authed)`**를 사용해 인증 필요한 경로만 묶는다:

```
src/app/admin/
├── login/              ← 보호 layout 밖
│   ├── page.tsx
│   ├── LoginForm.tsx
│   └── actions.ts
├── logout/             ← 보호 layout 밖
│   └── route.ts
└── (authed)/           ← 보호 layout 적용
    ├── layout.tsx       (이 task)
    ├── page.tsx         (Task 22)
    ├── members/...      (Task 24)
    ├── songs/...        (Task 25)
    ├── news/...         (Task 26)
    └── quotes/...       (Task 27)
```

`(authed)` 디렉토리 이름은 괄호로 시작하므로 URL에는 포함되지 않는다. `/admin` URL은 `(authed)/page.tsx`로, `/admin/login` URL은 `login/page.tsx`로 매핑된다.

- [ ] **Step 2: `(authed)` 디렉토리 생성 + layout.tsx 작성**

```bash
mkdir -p 'src/app/admin/(authed)'
```

`src/app/admin/(authed)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      <AdminNav />
      <main className="flex-1 px-8 py-8 max-w-7xl">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: 동작 확인 (대시보드는 다음 task에서 만드므로 임시 검증)**

`(authed)` 안에 페이지가 아직 없으므로 `/admin` 접속 시 404가 정상. 로그인 상태에서 `/admin/login`은 layout 적용 없이 폼만 보이는 게 정상.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminNav.tsx 'src/app/admin/(authed)/layout.tsx'
git commit -m "Add /admin (authed) route group with session-gated layout + AdminNav"
```

---

## Task 22: `/admin` 대시보드 (카운트 4개 + 최근 수정 5건)

**Files:**
- Create: `src/app/admin/(authed)/page.tsx`

- [ ] **Step 1: 대시보드 페이지 작성**

```tsx
import Link from "next/link";
import { getPool } from "@/lib/db";
import { countMembers } from "@/lib/members";
import { countSongs } from "@/lib/songs";
import { countNews } from "@/lib/news";
import { countQuotes } from "@/lib/quotes";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

type Recent = {
  resource: "members" | "songs" | "news" | "quotes";
  id: number;
  label: string;
  ts: Date;
};

async function getRecent(): Promise<Recent[]> {
  const pool = getPool();
  const [rows] = await pool.query<(RowDataPacket & {
    resource: Recent["resource"];
    id: number;
    label: string;
    ts: Date;
  })[]>(
    `SELECT * FROM (
      (SELECT 'members' AS resource, id, name_en AS label, updated_at AS ts FROM members)
      UNION ALL
      (SELECT 'songs' AS resource, id, title AS label, updated_at AS ts FROM songs)
      UNION ALL
      (SELECT 'news' AS resource, id, headline AS label, updated_at AS ts FROM news)
      UNION ALL
      (SELECT 'quotes' AS resource, id, COALESCE(attribution, LEFT(text, 40)) AS label, created_at AS ts FROM quotes)
    ) AS u ORDER BY ts DESC LIMIT 5`,
  );
  return rows.map((r) => ({
    resource: r.resource,
    id: r.id,
    label: r.label,
    ts: r.ts instanceof Date ? r.ts : new Date(r.ts),
  }));
}

const cards = [
  { resource: "members" as const, label: "Members" },
  { resource: "songs" as const, label: "Songs" },
  { resource: "news" as const, label: "News" },
  { resource: "quotes" as const, label: "Quotes" },
];

export default async function DashboardPage() {
  const [m, s, n, q, recent] = await Promise.all([
    countMembers(),
    countSongs(),
    countNews(),
    countQuotes(),
    getRecent(),
  ]);
  const counts = { members: m, songs: s, news: n, quotes: q };

  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl md:text-4xl mb-8">
        Dashboard
      </h1>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {cards.map((c) => (
          <Link
            key={c.resource}
            href={`/admin/${c.resource}`}
            className="border border-[var(--color-border)] p-5 hover:border-[var(--color-text)] transition-colors"
          >
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              {c.label}
            </p>
            <p className="font-display text-3xl font-bold">{counts[c.resource]}</p>
            <p className="mt-3 text-xs uppercase tracking-wider underline underline-offset-2">
              관리하기
            </p>
          </Link>
        ))}
      </section>
      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
          최근 수정 5건
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2 font-medium">리소스</th>
              <th className="py-2 font-medium">제목</th>
              <th className="py-2 font-medium">수정일</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={`${r.resource}-${r.id}`} className="border-b border-[var(--color-border)]">
                <td className="py-3">
                  <span className="text-xs uppercase tracking-wider">{r.resource}</span>
                </td>
                <td className="py-3">
                  <Link
                    href={`/admin/${r.resource}/${r.id}`}
                    className="underline underline-offset-2"
                  >
                    {r.label}
                  </Link>
                </td>
                <td className="py-3 text-[var(--color-text-muted)]">
                  {r.ts.toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 동작 확인**

```bash
pnpm dev
# 1) /admin/login 로그인
# 2) /admin 대시보드: 카운트 4개 카드 + 최근 5건 표
# 3) 카운트가 DB row 수와 일치 확인
# 4) "관리하기" 링크 클릭 시 /admin/<resource>로 이동 (404 정상 — 다음 task)
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/(authed)/page.tsx'
git commit -m "Add /admin dashboard with counts and recent 5"
```

---

## Task 23: 공통 admin UI 컴포넌트 (`PublishedToggle`, `ImageUpload`)

**Files:**
- Create: `src/components/admin/PublishedToggle.tsx`
- Create: `src/components/admin/ImageUpload.tsx`

- [ ] **Step 1: `PublishedToggle.tsx` (client)**

```tsx
"use client";
import { useTransition } from "react";

export default function PublishedToggle({
  published,
  toggleAction,
}: {
  published: boolean;
  toggleAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleAction())}
      className={
        "px-3 py-1 text-xs uppercase tracking-wider border " +
        (published
          ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]"
          : "bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)]")
      }
    >
      {published ? "공개" : "비공개"}
    </button>
  );
}
```

- [ ] **Step 2: `ImageUpload.tsx` (client)**

```tsx
"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/upload";

type Resource = "members" | "songs" | "news" | "quotes";

export default function ImageUpload({
  name,
  resource,
  initialPath,
  required,
  alt,
}: {
  name: string;
  resource: Resource;
  initialPath?: string | null;
  required?: boolean;
  alt: string;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await uploadImage(fd, resource);
      if (res.ok) {
        setPath(res.path);
      } else {
        setError(res.error);
      }
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={path} required={required} />
      {path && (
        <div className="relative w-40 h-40 bg-[var(--color-bg-muted)]">
          <Image src={path} alt={alt} fill className="object-cover" sizes="160px" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleChange}
          disabled={pending}
          className="text-sm"
        />
        {pending && <span className="text-xs text-[var(--color-text-muted)]">업로드 중…</span>}
      </div>
      {error && <p className="text-xs text-[var(--color-accent)]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: 타입 확인**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/PublishedToggle.tsx src/components/admin/ImageUpload.tsx
git commit -m "Add shared admin components: PublishedToggle and ImageUpload"
```

---

## Task 24: Members admin 전체 (list + 폼 + actions)

**Files:**
- Create: `src/app/admin/(authed)/members/page.tsx`
- Create: `src/app/admin/(authed)/members/actions.ts`
- Create: `src/app/admin/(authed)/members/new/page.tsx`
- Create: `src/app/admin/(authed)/members/[id]/page.tsx`
- Create: `src/components/admin/MemberForm.tsx`

- [ ] **Step 1: `actions.ts` (Zod 스키마 + CRUD + ▲▼)**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const memberSchema = z.object({
  nameEn: z.string().min(1).max(80),
  nameKr: z.string().min(1).max(40),
  position: z.string().min(1).max(120),
  photoUrl: z.string().min(1).max(255),
  favoriteArtist: z.string().max(120).optional().or(z.literal("")),
  favoriteSong: z.string().max(255).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(9999),
});

async function requireAuth() {
  const s = await readSession();
  if (!s) throw new Error("UNAUTHENTICATED");
}

function fromForm(formData: FormData) {
  return {
    nameEn: formData.get("nameEn"),
    nameKr: formData.get("nameKr"),
    position: formData.get("position"),
    photoUrl: formData.get("photoUrl"),
    favoriteArtist: formData.get("favoriteArtist") ?? "",
    favoriteSong: formData.get("favoriteSong") ?? "",
    displayOrder: formData.get("displayOrder"),
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createMember(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = memberSchema.safeParse(fromForm(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fe[issue.path.join(".")] = issue.message;
    }
    return { error: "검증 실패", fieldErrors: fe };
  }
  const m = parsed.data;
  await getPool().query(
    `INSERT INTO members (name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [m.nameEn, m.nameKr, m.position, m.photoUrl, m.favoriteArtist || null, m.favoriteSong || null, m.displayOrder],
  );
  revalidatePath("/admin/members");
  revalidatePath("/members");
  redirect("/admin/members");
}

export async function updateMember(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = memberSchema.safeParse(fromForm(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const m = parsed.data;
  await getPool().query(
    `UPDATE members SET name_en=?, name_kr=?, position=?, photo_url=?, favorite_artist=?, favorite_song=?, display_order=? WHERE id=?`,
    [m.nameEn, m.nameKr, m.position, m.photoUrl, m.favoriteArtist || null, m.favoriteSong || null, m.displayOrder, id],
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
  revalidatePath("/members");
  redirect("/admin/members");
}

export async function togglePublishedMember(id: number) {
  await requireAuth();
  await getPool().query(
    `UPDATE members SET published = 1 - published WHERE id = ?`,
    [id],
  );
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

export async function swapMemberOrder(id: number, direction: "up" | "down") {
  await requireAuth();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [self] = await conn.query<({ id: number; display_order: number } & import("mysql2").RowDataPacket)[]>(
      `SELECT id, display_order FROM members WHERE id = ? FOR UPDATE`,
      [id],
    );
    if (!self[0]) {
      await conn.rollback();
      return;
    }
    const op = direction === "up" ? "<" : ">";
    const order = direction === "up" ? "DESC" : "ASC";
    const [neighbor] = await conn.query<({ id: number; display_order: number } & import("mysql2").RowDataPacket)[]>(
      `SELECT id, display_order FROM members
       WHERE display_order ${op} ? OR (display_order = ? AND id ${op} ?)
       ORDER BY display_order ${order}, id ${order} LIMIT 1 FOR UPDATE`,
      [self[0].display_order, self[0].display_order, id],
    );
    if (!neighbor[0]) {
      await conn.commit();
      return;
    }
    await conn.query(
      `UPDATE members SET display_order = ? WHERE id = ?`,
      [neighbor[0].display_order, self[0].id],
    );
    await conn.query(
      `UPDATE members SET display_order = ? WHERE id = ?`,
      [self[0].display_order, neighbor[0].id],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  revalidatePath("/admin/members");
  revalidatePath("/members");
}
```

- [ ] **Step 2: `MemberForm.tsx` (client)**

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Member } from "@/lib/members";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/members/actions";

export default function MemberForm({
  member,
  action,
  submitLabel,
}: {
  member?: Member;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {member && (
        <div className="flex justify-end">
          <Link
            href={`/members#member-${member.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field name="nameEn" label="Name (EN)" defaultValue={member?.nameEn} error={fe.nameEn} required />
      <Field name="nameKr" label="이름" defaultValue={member?.nameKr} error={fe.nameKr} required />
      <Field name="position" label="Position" defaultValue={member?.position} error={fe.position} required />
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">사진</label>
        <ImageUpload
          name="photoUrl"
          resource="members"
          initialPath={member?.photoUrl}
          required
          alt={member?.nameKr ?? "member photo"}
        />
        {fe.photoUrl && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.photoUrl}</p>}
      </div>
      <Field name="favoriteArtist" label="Favorite Artist" defaultValue={member?.favoriteArtist ?? ""} error={fe.favoriteArtist} />
      <Field name="favoriteSong" label="Favorite Song" defaultValue={member?.favoriteSong ?? ""} error={fe.favoriteSong} />
      <Field name="displayOrder" label="순서 (숫자, 낮을수록 위)" defaultValue={String(member?.displayOrder ?? 0)} error={fe.displayOrder} required type="number" />
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
          href="/admin/members"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  name, label, defaultValue, error, required, type,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
      />
      {error && <span className="text-xs text-[var(--color-accent)]">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 3: `members/page.tsx` (리스트)**

```tsx
import Link from "next/link";
import Image from "next/image";
import { getAllMembersForAdmin } from "@/lib/members";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedMember, swapMemberOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function MembersListPage() {
  const members = await getAllMembersForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Members</h1>
        <Link
          href="/admin/members/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-16">사진</th>
            <th className="py-2">이름</th>
            <th className="py-2">포지션</th>
            <th className="py-2 w-20 text-right">순서</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-32 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => {
            const isFirst = i === 0;
            const isLast = i === members.length - 1;
            return (
              <tr key={m.id} className="border-b border-[var(--color-border)]">
                <td className="py-3">
                  <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                    <Image src={m.photoUrl} alt={m.nameKr} fill className="object-cover" sizes="48px" />
                  </div>
                </td>
                <td className="py-3">
                  <div className="font-medium">{m.nameKr}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{m.nameEn}</div>
                </td>
                <td className="py-3 text-[var(--color-text-muted)]">{m.position}</td>
                <td className="py-3 text-right tabular-nums">{m.displayOrder}</td>
                <td className="py-3">
                  <PublishedToggle
                    published={m.published}
                    toggleAction={async () => {
                      "use server";
                      await togglePublishedMember(m.id);
                    }}
                  />
                </td>
                <td className="py-3 text-right">
                  <form className="inline-flex items-center gap-1" action={async () => {
                    "use server";
                    await swapMemberOrder(m.id, "up");
                  }}>
                    <button type="submit" disabled={isFirst} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▲</button>
                  </form>
                  <form className="inline-flex items-center gap-1 ml-1" action={async () => {
                    "use server";
                    await swapMemberOrder(m.id, "down");
                  }}>
                    <button type="submit" disabled={isLast} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▼</button>
                  </form>
                  <Link href={`/admin/members/${m.id}`} className="ml-2 px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `members/new/page.tsx`**

```tsx
import MemberForm from "@/components/admin/MemberForm";
import { createMember } from "../actions";

export const dynamic = "force-dynamic";

export default function NewMemberPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 멤버</h1>
      <MemberForm action={createMember} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: `members/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getMemberById } from "@/lib/members";
import MemberForm from "@/components/admin/MemberForm";
import { updateMember } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const member = await getMemberById(numId);
  if (!member) notFound();

  const action = updateMember.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">멤버 편집</h1>
      <MemberForm member={member} action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 6: 동작 검증**

```bash
pnpm dev
# /admin 로그인 → /admin/members
# - 9 멤버 표 정상
# - ▲▼ 클릭 → 순서 즉시 swap, 공개 페이지(/members)에 반영
# - 토글 클릭 → 공개/비공개 전환, /members에서 가시성 변화
# - "+ 새로 추가" → 빈 폼, 사진 업로드, 저장 → 리스트에 추가
# - 행 "편집" → 폼에 기존값 채워짐, 수정 → 반영
# - 검증 에러: 빈 nameEn 등으로 저장 시도 → 필드 에러 표시
# - 8MB 초과 / 이상한 확장자 업로드 → 에러 메시지
```

- [ ] **Step 7: Commit**

```bash
git add 'src/app/admin/(authed)/members/' src/components/admin/MemberForm.tsx
git commit -m "Add /admin/members CRUD with ▲▼ swap, toggle, image upload"
```

---

## Task 25: Songs admin 전체

**Files:**
- Create: `src/app/admin/(authed)/songs/{page.tsx,actions.ts,new/page.tsx,[id]/page.tsx}`
- Create: `src/components/admin/SongForm.tsx`

- [ ] **Step 1: `songs/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const songSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.enum(["Album", "EP", "Single", "Live Session"]),
  artworkUrl: z.string().min(1).max(255),
  listenUrl: z.string().max(500).optional().or(z.literal("")),
  lyrics: z.string().optional().or(z.literal("")),
  releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다"),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    title: fd.get("title"),
    category: fd.get("category"),
    artworkUrl: fd.get("artworkUrl"),
    listenUrl: fd.get("listenUrl") ?? "",
    lyrics: fd.get("lyrics") ?? "",
    releasedAt: fd.get("releasedAt"),
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function asFieldErrors(parsed: { error: { issues: { path: (string | number)[]; message: string }[] } }): FormState {
  const fe: Record<string, string> = {};
  for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
  return { error: "검증 실패", fieldErrors: fe };
}

export async function createSong(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = songSchema.safeParse(fromForm(fd));
  if (!r.success) return asFieldErrors(r);
  const s = r.data;
  await getPool().query(
    `INSERT INTO songs (title, category, artwork_url, listen_url, lyrics, released_at, published)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [s.title, s.category, s.artworkUrl, s.listenUrl || null, s.lyrics || null, s.releasedAt],
  );
  revalidatePath("/admin/songs");
  revalidatePath("/songs");
  redirect("/admin/songs");
}

export async function updateSong(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = songSchema.safeParse(fromForm(fd));
  if (!r.success) return asFieldErrors(r);
  const s = r.data;
  await getPool().query(
    `UPDATE songs SET title=?, category=?, artwork_url=?, listen_url=?, lyrics=?, released_at=? WHERE id=?`,
    [s.title, s.category, s.artworkUrl, s.listenUrl || null, s.lyrics || null, s.releasedAt, id],
  );
  revalidatePath("/admin/songs");
  revalidatePath(`/admin/songs/${id}`);
  revalidatePath("/songs");
  redirect("/admin/songs");
}

export async function togglePublishedSong(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE songs SET published = 1 - published WHERE id = ?`, [id]);
  revalidatePath("/admin/songs");
  revalidatePath("/songs");
}
```

- [ ] **Step 2: `src/components/admin/SongForm.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Song } from "@/lib/songs";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/songs/actions";

const CATEGORIES = ["Album", "EP", "Single", "Live Session"] as const;

export default function SongForm({
  song,
  action,
  submitLabel,
}: {
  song?: Song;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const releasedDefault = song ? song.releasedAt.toISOString().slice(0, 10) : "";
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {song && (
        <div className="flex justify-end">
          <Link
            href={`/songs#song-${song.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field name="title" label="Title" defaultValue={song?.title} error={fe.title} required />
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Category</span>
        <select
          name="category"
          defaultValue={song?.category ?? "Single"}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {fe.category && <span className="text-xs text-[var(--color-accent)]">{fe.category}</span>}
      </label>
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Artwork</label>
        <ImageUpload
          name="artworkUrl"
          resource="songs"
          initialPath={song?.artworkUrl}
          required
          alt={song?.title ?? "song artwork"}
        />
        {fe.artworkUrl && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.artworkUrl}</p>}
      </div>
      <Field name="listenUrl" label="Listen URL (YouTube/Spotify 등, 선택)" defaultValue={song?.listenUrl ?? ""} error={fe.listenUrl} />
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Lyrics</span>
        <textarea
          name="lyrics"
          rows={20}
          defaultValue={song?.lyrics ?? ""}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] font-mono text-sm leading-relaxed"
        />
        {fe.lyrics && <span className="text-xs text-[var(--color-accent)]">{fe.lyrics}</span>}
      </label>
      <Field name="releasedAt" label="Released Date" defaultValue={releasedDefault} error={fe.releasedAt} required type="date" />
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
          href="/admin/songs"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  name, label, defaultValue, error, required, type,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
      />
      {error && <span className="text-xs text-[var(--color-accent)]">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 3: `src/app/admin/(authed)/songs/page.tsx` (리스트)**

```tsx
import Link from "next/link";
import Image from "next/image";
import { getAllSongsForAdmin } from "@/lib/songs";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedSong } from "./actions";

export const dynamic = "force-dynamic";

export default async function SongsListPage() {
  const songs = await getAllSongsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Songs</h1>
        <Link
          href="/admin/songs/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-16">아트워크</th>
            <th className="py-2">제목</th>
            <th className="py-2 w-32">카테고리</th>
            <th className="py-2 w-32">발매일</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-20 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-3">
                <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                  <Image src={s.artworkUrl} alt={s.title} fill className="object-cover" sizes="48px" />
                </div>
              </td>
              <td className="py-3 font-medium">{s.title}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.category}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">
                {s.releasedAt.toISOString().slice(0, 10)}
              </td>
              <td className="py-3">
                <PublishedToggle
                  published={s.published}
                  toggleAction={async () => {
                    "use server";
                    await togglePublishedSong(s.id);
                  }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/songs/${s.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/admin/(authed)/songs/new/page.tsx`**

```tsx
import SongForm from "@/components/admin/SongForm";
import { createSong } from "../actions";

export const dynamic = "force-dynamic";

export default function NewSongPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 곡</h1>
      <SongForm action={createSong} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 4b: `src/app/admin/(authed)/songs/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSongById } from "@/lib/songs";
import SongForm from "@/components/admin/SongForm";
import { updateSong } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const song = await getSongById(numId);
  if (!song) notFound();

  const action = updateSong.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">곡 편집</h1>
      <SongForm song={song} action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: 동작 검증**

```bash
pnpm dev
# /admin/songs: 표, 토글, 편집, 새 곡 추가, 아트워크 업로드, 가사 textarea 입력, 발매일 날짜 picker
# 공개 페이지 /songs 정상
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/admin/(authed)/songs/' src/components/admin/SongForm.tsx
git commit -m "Add /admin/songs CRUD with category select, lyrics textarea, artwork upload"
```

---

## Task 26: News admin 전체

**Files:**
- Create: `src/app/admin/(authed)/news/{page.tsx,actions.ts,new/page.tsx,[id]/page.tsx}`
- Create: `src/components/admin/NewsForm.tsx`

- [ ] **Step 1: `src/app/admin/(authed)/news/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const newsSchema = z.object({
  headline: z.string().min(1).max(255),
  category: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"),
  heroImage: z.string().min(1).max(255),
  body: z.string().min(1),
  midImage: z.string().max(255).optional().or(z.literal("")),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    headline: fd.get("headline"),
    category: fd.get("category"),
    date: fd.get("date"),
    heroImage: fd.get("heroImage"),
    body: fd.get("body"),
    midImage: fd.get("midImage") ?? "",
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function asFieldErrors(parsed: { error: { issues: { path: (string | number)[]; message: string }[] } }): FormState {
  const fe: Record<string, string> = {};
  for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
  return { error: "검증 실패", fieldErrors: fe };
}

export async function createNews(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = newsSchema.safeParse(fromForm(fd));
  if (!r.success) return asFieldErrors(r);
  const n = r.data;
  await getPool().query(
    `INSERT INTO news (headline, category, date, hero_image, body, mid_image, published)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [n.headline, n.category, n.date, n.heroImage, n.body, n.midImage || null],
  );
  revalidatePath("/admin/news");
  revalidatePath("/news");
  redirect("/admin/news");
}

export async function updateNews(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = newsSchema.safeParse(fromForm(fd));
  if (!r.success) return asFieldErrors(r);
  const n = r.data;
  await getPool().query(
    `UPDATE news SET headline=?, category=?, date=?, hero_image=?, body=?, mid_image=? WHERE id=?`,
    [n.headline, n.category, n.date, n.heroImage, n.body, n.midImage || null, id],
  );
  revalidatePath("/admin/news");
  revalidatePath(`/admin/news/${id}`);
  revalidatePath("/news");
  revalidatePath(`/news/${id}`);
  redirect("/admin/news");
}

export async function togglePublishedNews(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE news SET published = 1 - published WHERE id = ?`, [id]);
  revalidatePath("/admin/news");
  revalidatePath("/news");
}
```

- [ ] **Step 2: `src/components/admin/NewsForm.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { NewsItem } from "@/lib/news";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/news/actions";

export default function NewsForm({
  item,
  action,
  submitLabel,
}: {
  item?: NewsItem;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const dateDefault = item ? item.date.toISOString().slice(0, 10) : "";
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {item && (
        <div className="flex justify-end">
          <Link
            href={`/news/${item.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field name="headline" label="Headline" defaultValue={item?.headline} error={fe.headline} required />
      <Field name="category" label="Category (예: Lifestyle, News)" defaultValue={item?.category} error={fe.category} required />
      <Field name="date" label="Date" type="date" defaultValue={dateDefault} error={fe.date} required />
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hero Image</label>
        <ImageUpload
          name="heroImage"
          resource="news"
          initialPath={item?.heroImage}
          required
          alt={item?.headline ?? "news hero"}
        />
        {fe.heroImage && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.heroImage}</p>}
      </div>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Body</span>
        <textarea
          name="body"
          rows={25}
          defaultValue={item?.body ?? ""}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm leading-relaxed"
        />
        {fe.body && <span className="text-xs text-[var(--color-accent)]">{fe.body}</span>}
      </label>
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Mid Image (선택)</label>
        <ImageUpload
          name="midImage"
          resource="news"
          initialPath={item?.midImage}
          alt={(item?.headline ?? "news") + " mid"}
        />
        {fe.midImage && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.midImage}</p>}
      </div>
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
          href="/admin/news"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  name, label, defaultValue, error, required, type,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
      />
      {error && <span className="text-xs text-[var(--color-accent)]">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 3: `src/app/admin/(authed)/news/page.tsx` (리스트)**

```tsx
import Link from "next/link";
import Image from "next/image";
import { getAllNewsForAdmin, formatNewsDate } from "@/lib/news";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedNews } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewsListPage() {
  const items = await getAllNewsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">News</h1>
        <Link
          href="/admin/news/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-16">썸네일</th>
            <th className="py-2">헤드라인</th>
            <th className="py-2 w-32">카테고리</th>
            <th className="py-2 w-32">날짜</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-20 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-b border-[var(--color-border)]">
              <td className="py-3">
                <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                  <Image src={n.heroImage} alt={n.headline} fill className="object-cover" sizes="48px" />
                </div>
              </td>
              <td className="py-3 font-medium">{n.headline}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{n.category}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{formatNewsDate(n.date)}</td>
              <td className="py-3">
                <PublishedToggle
                  published={n.published}
                  toggleAction={async () => {
                    "use server";
                    await togglePublishedNews(n.id);
                  }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/news/${n.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/admin/(authed)/news/new/page.tsx`**

```tsx
import NewsForm from "@/components/admin/NewsForm";
import { createNews } from "../actions";

export const dynamic = "force-dynamic";

export default function NewNewsPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 글</h1>
      <NewsForm action={createNews} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 4b: `src/app/admin/(authed)/news/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getNewsById } from "@/lib/news";
import NewsForm from "@/components/admin/NewsForm";
import { updateNews } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const item = await getNewsById(numId);
  if (!item) notFound();

  const action = updateNews.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">글 편집</h1>
      <NewsForm item={item} action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: 동작 검증**

```bash
pnpm dev
# /admin/news 전 동작
# 공개 /news + /news/<id> 정상 (특히 본문 단락 렌더와 mid_image 위치)
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/admin/(authed)/news/' src/components/admin/NewsForm.tsx
git commit -m "Add /admin/news CRUD with hero/mid image upload and body textarea"
```

---

## Task 27: Quotes admin 전체

**Files:**
- Create: `src/app/admin/(authed)/quotes/{page.tsx,actions.ts,new/page.tsx,[id]/page.tsx}`
- Create: `src/components/admin/QuoteForm.tsx`

- [ ] **Step 1: `src/app/admin/(authed)/quotes/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const quoteSchema = z.object({
  text: z.string().min(1),
  lang: z.enum(["ko", "en"]),
  textTranslated: z.string().optional().or(z.literal("")),
  attribution: z.string().max(120).optional().or(z.literal("")),
  portraitUrl: z.string().max(255).optional().or(z.literal("")),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    text: fd.get("text"),
    lang: fd.get("lang"),
    textTranslated: fd.get("textTranslated") ?? "",
    attribution: fd.get("attribution") ?? "",
    portraitUrl: fd.get("portraitUrl") ?? "",
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function asFieldErrors(parsed: { error: { issues: { path: (string | number)[]; message: string }[] } }): FormState {
  const fe: Record<string, string> = {};
  for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
  return { error: "검증 실패", fieldErrors: fe };
}

export async function createQuote(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = quoteSchema.safeParse(fromForm(fd));
  if (!r.success) return asFieldErrors(r);
  const q = r.data;
  await getPool().query(
    `INSERT INTO quotes (text, lang, text_translated, attribution, portrait_url, published)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [q.text, q.lang, q.textTranslated || null, q.attribution || null, q.portraitUrl || null],
  );
  revalidatePath("/admin/quotes");
  revalidatePath("/quote");
  redirect("/admin/quotes");
}

export async function updateQuote(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = quoteSchema.safeParse(fromForm(fd));
  if (!r.success) return asFieldErrors(r);
  const q = r.data;
  await getPool().query(
    `UPDATE quotes SET text=?, lang=?, text_translated=?, attribution=?, portrait_url=? WHERE id=?`,
    [q.text, q.lang, q.textTranslated || null, q.attribution || null, q.portraitUrl || null, id],
  );
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/quote");
  redirect("/admin/quotes");
}

export async function togglePublishedQuote(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE quotes SET published = 1 - published WHERE id = ?`, [id]);
  revalidatePath("/admin/quotes");
  revalidatePath("/quote");
}
```

- [ ] **Step 2: `src/components/admin/QuoteForm.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Quote } from "@/lib/quotes";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/quotes/actions";

export default function QuoteForm({
  quote,
  action,
  submitLabel,
}: {
  quote?: Quote;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {quote && (
        <div className="flex justify-end">
          <Link
            href={`/quote#quote-${quote.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Text</span>
        <textarea
          name="text"
          rows={8}
          defaultValue={quote?.text ?? ""}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] leading-relaxed"
        />
        {fe.text && <span className="text-xs text-[var(--color-accent)]">{fe.text}</span>}
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Language</span>
        <select
          name="lang"
          defaultValue={quote?.lang ?? "ko"}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          <option value="ko">ko</option>
          <option value="en">en</option>
        </select>
        {fe.lang && <span className="text-xs text-[var(--color-accent)]">{fe.lang}</span>}
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Translation (선택)</span>
        <textarea
          name="textTranslated"
          rows={4}
          defaultValue={quote?.text_translated ?? ""}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] leading-relaxed"
        />
        {fe.textTranslated && <span className="text-xs text-[var(--color-accent)]">{fe.textTranslated}</span>}
      </label>
      <Field name="attribution" label="Attribution (인물, 선택)" defaultValue={quote?.attribution ?? ""} error={fe.attribution} />
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Portrait (선택)</label>
        <ImageUpload
          name="portraitUrl"
          resource="quotes"
          initialPath={quote?.portrait_url}
          alt={quote?.attribution ?? "quote portrait"}
        />
        {fe.portraitUrl && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.portraitUrl}</p>}
      </div>
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
          href="/admin/quotes"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  name, label, defaultValue, error, required, type,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
      />
      {error && <span className="text-xs text-[var(--color-accent)]">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 3: `src/app/admin/(authed)/quotes/page.tsx` (리스트)**

```tsx
import Link from "next/link";
import { getAllQuotesForAdmin } from "@/lib/quotes";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedQuote } from "./actions";

export const dynamic = "force-dynamic";

export default async function QuotesListPage() {
  const quotes = await getAllQuotesForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Quotes</h1>
        <Link
          href="/admin/quotes/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-40">인물</th>
            <th className="py-2">인용문</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-20 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{q.attribution ?? "—"}</td>
              <td className="py-3 text-[var(--color-text-muted)]">
                {q.text.length > 80 ? q.text.slice(0, 79) + "…" : q.text}
              </td>
              <td className="py-3">
                <PublishedToggle
                  published={q.published === 1}
                  toggleAction={async () => {
                    "use server";
                    await togglePublishedQuote(q.id);
                  }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/quotes/${q.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/admin/(authed)/quotes/new/page.tsx`**

```tsx
import QuoteForm from "@/components/admin/QuoteForm";
import { createQuote } from "../actions";

export const dynamic = "force-dynamic";

export default function NewQuotePage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 인용문</h1>
      <QuoteForm action={createQuote} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 4b: `src/app/admin/(authed)/quotes/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getQuoteById } from "@/lib/quotes";
import QuoteForm from "@/components/admin/QuoteForm";
import { updateQuote } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const quote = await getQuoteById(numId);
  if (!quote) notFound();

  const action = updateQuote.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">인용문 편집</h1>
      <QuoteForm quote={quote} action={action} submitLabel="저장" />
    </div>
  );
}
```

- [ ] **Step 5: 동작 검증**

```bash
pnpm dev
# /admin/quotes 전 동작
# 공개 /quote 정상 (5개 명언 그대로)
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/admin/(authed)/quotes/' src/components/admin/QuoteForm.tsx
git commit -m "Add /admin/quotes CRUD reusing existing snake_case quotes lib"
```

---

## Task 28: 최종 빌드 + 스모크 + push 준비

**Files:**
- 변경 없음 (검증 단계)

- [ ] **Step 1: 전체 빌드**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm tsc --noEmit
pnpm build
```

기대: 두 명령 모두 에러 없이 성공. (`pnpm build`는 페이지를 force-dynamic으로 표시했으므로 SSG 시도하지 않음)

- [ ] **Step 2: production 모드 dev 검증 (선택)**

```bash
pnpm start
# 브라우저: http://localhost:3100/
```

- [ ] **Step 3: 8개 스모크 체크리스트 (스펙 §6.5)**

DEV에서 모두 직접 수행:

- [ ] 공개 페이지 정상 렌더: `/` `/members` `/songs` `/news` `/quote`
- [ ] `/news/<id>` 상세 정상 (URL이 `01`→`1`로 바뀌어도 접근됨)
- [ ] `/admin/login` → `/admin` 대시보드, 카운트가 `mysql ... -e "SELECT COUNT(*) FROM ..."` 결과와 일치
- [ ] 멤버 1건 토글 → 공개 사이트에서 사라짐 / 토글 복원 → 다시 보임
- [ ] 멤버 ▲▼ 1회 → 공개 페이지 순서 반영 → 원복
- [ ] 곡 1건 신규 생성 + 아트워크 업로드 → published=1 → `/songs`에 노출
- [ ] 비공개 토글 → 사라짐 → 다시 켜기
- [ ] 로그아웃 → `/admin` 재방문 시 `/admin/login`으로 리다이렉트

- [ ] **Step 4: PROD 반영 (사용자 명시 요청 시에만)**

운영 배포는 메모리 `feedback_deploy_flow.md`에 따라 사용자가 명시적으로 요청한 경우에만:

```bash
cd /root/bandsustain/public_html/bandsustain
git push origin main
pnpm install   # bcryptjs/zod 새로 설치
pnpm build
pm2 restart bandsustain
```

(bandsustain은 단일 환경 + main 브랜치라 push = 운영 반영. junior/boot의 dev/prod 분리 플로우와 다르다.)

- [ ] **Step 5: 사후 정리**

성공 시 메모리 `project_bandsustain_admin_wip.md`를 완료 메모리로 갱신하고 `MEMORY.md`의 "진행 중인 작업" → "완료된 작업"으로 이동. (이는 사용자가 별도 지시하면 진행)

---

## 부록: 태스크 의존성 그래프

```
1 (deps)
├── 2 (creds.ts) ─── 4 (auth.ts) ─── 18 (middleware), 19 (login), 20 (logout), 21 (layout)
│                                            └── 22 (dashboard), 24-27 (CRUD)
├── 3 (admin password)
└── 5 (upload.ts)
6,7,8 (schemas, 병렬 가능)
9 (seed) — 의존: 6,7,8 + src/data/* (아직 존재)
10,11,12,13 (libs, 병렬 가능) — 의존: 9
14 (members public) — 의존: 10
15 (songs public) — 의존: 11
16 (news public) — 의존: 12
17 (delete src/data) — 의존: 14,15,16
21 (admin layout) — 의존: 4
22 (dashboard) — 의존: 10,11,12,13,21
23 (shared admin components) — 의존: 5
24 (members admin) — 의존: 10,21,23
25 (songs admin) — 의존: 11,21,23
26 (news admin) — 의존: 12,21,23
27 (quotes admin) — 의존: 13,21,23
28 (smoke) — 의존: 모두
```

병렬 처리: 6/7/8 schemas를 동시에, 10/11/12/13 libs를 동시에, 24/25/26/27 admin CRUD를 동시에 진행 가능 (subagent-driven mode 추천).
