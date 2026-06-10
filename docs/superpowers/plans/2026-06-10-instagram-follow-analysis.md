# 인스타그램 맞팔 분석기 (playground/instagram-follow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인스타그램 데이터 내보내기 ZIP을 브라우저에서만 분석해 맞팔 관계·팔로우 시작일을 보여주고, `@band_sustain` 팔로워는 명예의 전당(DB)에 등록할 수 있는 playground 신규 기능.

**Architecture:** ZIP 해제·HTML 파싱·관계 계산은 전부 클라이언트(JSZip + 문자열 파서)에서 수행하고 서버로 전송하지 않는다. 서버에는 명예의 전당 등록(닉네임 + band_sustain 팔로우 시작일 + HMAC IP 해시)만 저장한다. 기존 rehearsal-finder 패턴(env 플래그 게이트 + `src/lib/playground/<slug>/` 순수 로직 + `src/app/api/playground/<slug>/` 라우트 + admin (authed) 페이지)을 그대로 따른다.

**Tech Stack:** Next.js 16.2.4 App Router, React 19, TypeScript, Tailwind v4(CSS 변수 테마), zod v4, mysql2(raw SQL, ORM 없음), JSZip(신규 의존성), node:test + tsx(테스트).

**작업 위치:** `/root/bandsustain-dev/public_html/bandsustain` (dev 브랜치). **모든 git/pnpm/pm2 명령은 `sudo -u ec2-user`로 실행** (root 소유 파일 생성 금지 — feedback_root_owned_files_in_ec2user_dirs). prod 직접 수정 절대 금지. dev push 후 멈추고 사용자 확인.

---

## 0. 사전 분석 결과 (스펙 §19 답변)

### 0.1 기술 스택 / 폴더 구조
- Next.js 16.2.4 App Router + React 19.2.4 + TS, Tailwind v4, zod ^4.3.6, mysql2 ^3.22.2 (raw SQL), bcryptjs. **Prisma 없음** → 스펙의 Prisma 예시는 수동 SQL 마이그레이션(`db/schema/NNN_*.sql`)으로 변환한다. 다음 번호는 **023**.
- playground 기능 패턴: `src/lib/playground.ts`의 `playgroundFeatures[]` 배열 + `visiblePlaygroundFeatures()` 플래그 필터. 페이지 `src/app/playground/<slug>/`, API `src/app/api/playground/<slug>/`, 로직 `src/lib/playground/<slug>/`, 컴포넌트 `src/components/playground/<slug>/`.
- 플래그 패턴: `rehearsalFlag.ts`처럼 `process.env.INSTAGRAM_FOLLOW_ENABLED === "1"`. env는 `ecosystem.config.js`(git --skip-worktree, DEV/PROD 별도 관리)에 설정.

### 0.2 디자인 시스템
- CSS 변수: `--color-bg #fff`, `--color-text #0a0a0a`, `--color-text-muted #555`, `--color-border #e5e5e5`, `--color-accent #2563FF`, `--color-accent-ink #fff`. 폰트 `--font-display`(Archivo 700/900, 대문자 헤딩), `--font-sans`(Inter). 라이트 모드 고정.
- 재사용: `src/components/Button.tsx`(`buttonClasses(variant)`, primary/secondary/accent), `src/lib/useScrollLock.ts`(모달 필수 — feedback_bandsustain_scroll_lock_hook), `.page-fade-in` 애니메이션, `AnalyticsBeacon`(전 페이지 자동 — 추가 작업 불필요).
- 인스타그램 브랜드 UI 복제 금지 → 사이트의 흑백+블루 액센트 톤 유지.

### 0.3 DB / ORM
- MariaDB(MySQL), `utf8mb4_unicode_ci`. 접근: `src/lib/db.ts` `getPool()` (mysql2/promise 풀, creds는 `src/lib/creds.ts` `loadCreds()` ← `DB_CREDENTIALS_PATH` env, DEV는 ecosystem에 설정됨).
- 마이그레이션: `db/schema/023_instagram_follow.sql` 작성 후 수동 적용. **DEV DB(BANDSUSTAIN_DEV) 먼저**, PROD는 운영 반영 시점에.

### 0.4 배포 환경 / 클라이언트 IP
- Apache 리버스 프록시 뒤 PM2(`bandsustain-dev`/3101, prod `bandsustain`/3100). 기존 코드(`/api/analytics/log`)가 `x-forwarded-for` 첫 항목 → `x-real-ip` → `"0.0.0.0"` 순으로 추출 — 동일 패턴 사용 (Apache가 직접 받으므로 첫 XFF 항목 신뢰 가능).
- IP는 원문 저장 금지: `HMAC_SHA256(INSTAGRAM_HOF_SECRET, normalizedIp)` hex 저장. `INSTAGRAM_HOF_SECRET`는 `.db_credentials`에 신규 추가 (DEV 즉시, PROD는 운영 반영 시).

### 0.5 클라이언트 완전 처리 가능 여부 → **가능**
- 실측 ZIP(2.4MB, followers_1.html 131KB·528계정 / following.html 251KB·774계정)은 브라우저 메모리에서 충분히 처리 가능. JSZip으로 해제, 정규식 기반 문자열 파서로 추출(`innerHTML`/iframe 렌더링 없음 — DOM에 안 올리므로 XSS 표면 자체가 없고, node:test로 그대로 테스트 가능). 서버 업로드 경로는 만들지 않는다.

### 0.6 실측 ZIP 마크업 (파서 근거 — 첨부 ZIP에서 확인)
```html
<!-- followers_1.html: 링크 텍스트 = username, 직후 <div>가 날짜 -->
<div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/2e_1n">2e_1n</a></div><div>6월 06, 2026 10:49 오전</div></div></div>
<!-- following.html: <h2>username</h2> + _u/ 링크(텍스트도 URL), 직후 <div>가 날짜 -->
<h2 class="...">band_sustain</h2><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/_u/band_sustain">https://www.instagram.com/_u/band_sustain</a></div><div>9월 22, 2024 10:10 오후</div></div></div>
```
- 날짜 형식: `M월 DD, YYYY H:MM 오전|오후` (12시간제, `12:19 오전`=00:19 주의). 영어 로케일 `Jun 06, 2026 10:49 AM`도 지원.
- 인코딩 UTF-8. 테스트 ZIP의 following에 `band_sustain` 존재(2024-09-22) → E2E 검증에 그대로 사용. **원본 ZIP은 커밋 금지** (실사용자 데이터, 경로: `/var/www/html/_______site_BANDSUSTAIN/instagram-_mongsil_kim-2026-06-08-qNJMxQEM.zip`).

### 0.7 화면 구성 결정 (스펙 §15 예시를 코드베이스에 맞게 조정)
- 분석 결과는 브라우저 메모리에만 있으므로 멀티 페이지 대신 **단일 클라이언트 페이지의 step 상태머신**(intro → guide(5단계) → upload → result)으로 구현. 새로고침 시 분석 데이터는 사라짐(beforeunload 경고 표시), "지난 분석 내역"은 localStorage에 **요약 수치만** 저장.
- 명예의 전당 등록 폼은 result 화면 내(SustainCard)에서 처리, 공개 랭킹은 별도 서버 페이지 `/playground/instagram-follow/hall-of-fame`.
- 참고 이미지 자산이 없으므로 guide 단계 이미지는 단계 번호 + 텍스트 일러스트(이모지/도형)로 대체 — 한계로 보고.

### 0.8 보안 체크리스트
- ZIP을 서버에 안 보냄(핵심 방어). 클라 측 50MB 상한 + ZIP 시그니처(`PK\x03\x04`) 확인 + 암호 ZIP 감지 안내.
- HTML은 DOM 렌더링 없이 문자열 파싱만. username은 `^[a-z0-9._]{1,30}$` 화이트리스트 검증 후 링크를 `https://www.instagram.com/{username}/`로 재생성(원본 href 미사용).
- POST API: zod 검증, 닉네임 필터(2~20자/태그·욕설·특수문자 과다 금지), 날짜 범위(2010-10-01~오늘), same-origin(Origin↔Host) 검사, in-memory rate limit(IP당 10분 5회), `UNIQUE(ip_hash, sustain_followed_at)` 중복 차단(errno 1062 → 409), 닉네임 출력은 React 기본 이스케이프.
- 관리자 화면에 IP 해시 전체값 미노출(앞 10자만), 숨김/복구만 제공.

---

## 1. 파일 구조 (생성/수정 전체 목록)

```text
[수정] package.json                              # jszip 의존성, test 스크립트 추가
[수정] src/lib/playground.ts                     # feature 항목 + 플래그 필터
[수정] src/components/admin/AdminNav.tsx          # admin 메뉴 항목
[수정] ecosystem.config.js (skip-worktree, 비커밋) # INSTAGRAM_FOLLOW_ENABLED=1 (DEV)
[수정] /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials  # INSTAGRAM_HOF_SECRET (비커밋)

[생성] db/schema/023_instagram_follow.sql

# 순수 로직 (클라/서버 공용, node:test 대상)
[생성] src/lib/playground/instagram/flag.ts
[생성] src/lib/playground/instagram/config.ts          # SUSTAIN_USERNAME 등 단일 관리
[생성] src/lib/playground/instagram/types.ts
[생성] src/lib/playground/instagram/normalizeUsername.ts (+ .test.ts)
[생성] src/lib/playground/instagram/parseInstagramDate.ts (+ .test.ts)
[생성] src/lib/playground/instagram/parseConnectionsHtml.ts (+ .test.ts)
[생성] src/lib/playground/instagram/findFiles.ts (+ .test.ts)
[생성] src/lib/playground/instagram/relations.ts (+ .test.ts)
[생성] src/lib/playground/instagram/followDays.ts (+ .test.ts)
[생성] src/lib/playground/instagram/nickname.ts (+ .test.ts)

# 서버 전용
[생성] src/lib/playground/instagram/ipHash.ts
[생성] src/lib/playground/instagram/rateLimit.ts (+ .test.ts)
[생성] src/lib/playground/instagram/hofDb.ts

# 클라이언트 전용
[생성] src/lib/playground/instagram/analyzeZip.ts      # JSZip 오케스트레이션
[생성] src/lib/playground/instagram/history.ts         # localStorage 요약 이력

# 페이지 / API
[생성] src/app/playground/instagram-follow/page.tsx
[생성] src/app/playground/instagram-follow/hall-of-fame/page.tsx
[생성] src/app/api/playground/instagram-follow/hall-of-fame/route.ts
[생성] src/app/admin/(authed)/instagram-follow/page.tsx
[생성] src/app/admin/(authed)/instagram-follow/actions.ts

# UI 컴포넌트
[생성] src/components/playground/instagram/InstagramFollowClient.tsx   # step 상태머신
[생성] src/components/playground/instagram/IntroScreen.tsx
[생성] src/components/playground/instagram/GuideSteps.tsx
[생성] src/components/playground/instagram/UploadDropzone.tsx
[생성] src/components/playground/instagram/ResultView.tsx
[생성] src/components/playground/instagram/AccountList.tsx
[생성] src/components/playground/instagram/SustainCard.tsx
[생성] src/components/playground/instagram/HallOfFameForm.tsx
```

테스트 실행 명령(검증 완료): `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/*.test.ts`

---

### Task 1: 기반 셋업 (의존성·플래그·설정·타입·feature 등록)

**Files:**
- Modify: `package.json` (jszip, test 스크립트)
- Create: `src/lib/playground/instagram/flag.ts`
- Create: `src/lib/playground/instagram/config.ts`
- Create: `src/lib/playground/instagram/types.ts`
- Modify: `src/lib/playground.ts`
- Modify(비커밋): `ecosystem.config.js`, DEV `.db_credentials`

- [ ] **Step 1: jszip 설치 + test 스크립트**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm add jszip
```

`package.json`의 `"scripts"`에 추가:

```json
"test:instagram": "tsx --test src/lib/playground/instagram/*.test.ts"
```

- [ ] **Step 2: 플래그 / 설정 / 타입 파일 작성**

`src/lib/playground/instagram/flag.ts`:

```typescript
export function isInstagramFollowEnabled(): boolean {
  return process.env.INSTAGRAM_FOLLOW_ENABLED === "1";
}
```

`src/lib/playground/instagram/config.ts` (band_sustain 계정명 단일 관리 — 스펙 §8):

```typescript
export const SUSTAIN_USERNAME = "band_sustain";
export const SUSTAIN_INSTAGRAM_URL = `https://www.instagram.com/${SUSTAIN_USERNAME}/`;
export const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50MB
export const HOF_PAGE_SIZE = 50;
// 명예의 전당 등록 허용 날짜 하한 (인스타그램 서비스 시작)
export const MIN_FOLLOW_DATE = "2010-10-01";
```

`src/lib/playground/instagram/types.ts`:

```typescript
export type InstagramConnection = {
  username: string;
  profileUrl: string;          // https://www.instagram.com/{username}/ 로 재생성된 값
  followedAt: string | null;   // "YYYY-MM-DDTHH:mm:00" (로컬 naive) 파싱 실패 시 null
  followedAtRaw: string | null; // 원문 보존
};

export type ParseOutcome = {
  connections: InstagramConnection[];
  failedCount: number; // 인스타 링크였지만 username 추출 실패한 항목 수
};

export type AccountRelation = {
  username: string;
  profileUrl: string;
  isFollower: boolean;          // 나를 팔로우함
  isFollowing: boolean;         // 내가 팔로우함
  followerSince: string | null; // 나를 팔로우한 날 (ISO)
  followerSinceRaw: string | null;
  followingSince: string | null; // 내가 팔로우한 날 (ISO)
  followingSinceRaw: string | null;
};

export type RelationResult = {
  followers: AccountRelation[];
  following: AccountRelation[];
  mutuals: AccountRelation[];
  notFollowingMeBack: AccountRelation[]; // 내가 팔로우, 상대는 안 함 (핵심 탭)
  iDoNotFollowBack: AccountRelation[];   // 상대가 팔로우, 나는 안 함
};

export type AnalysisResult = {
  relations: RelationResult;
  hasFollowers: boolean;   // followers 파일 존재 여부 (부분 데이터 안내용)
  hasFollowing: boolean;
  parseFailedCount: number;
  sustain: { following: boolean; since: string | null; sinceRaw: string | null };
  analyzedAt: string; // ISO
};

export type AnalysisErrorCode =
  | "NOT_ZIP"
  | "TOO_LARGE"
  | "ENCRYPTED_ZIP"
  | "FILES_NOT_FOUND"
  | "PARSE_FAILED";

export class AnalysisError extends Error {
  constructor(public code: AnalysisErrorCode, message?: string) {
    super(message ?? code);
  }
}
```

- [ ] **Step 3: playground feature 등록**

`src/lib/playground.ts` — import 추가 후 `playgroundFeatures` 배열 맨 앞(rehearsal-finder 다음)에 항목 추가, 필터 수정:

```typescript
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
// playgroundFeatures 배열에 추가:
  {
    slug: "instagram-follow",
    title: "인스타 맞팔 분석기",
    description:
      "인스타그램 데이터 파일 하나로 나를 맞팔하지 않는 계정과 팔로우 시작일을 확인해보세요.",
    cta: "분석하러 가기",
    eyebrow: "쓸모 있는 도구",
    badge: "BETA",
    href: "/playground/instagram-follow",
  },
// visiblePlaygroundFeatures 교체:
export function visiblePlaygroundFeatures(): PlaygroundFeature[] {
  return playgroundFeatures.filter((f) => {
    if (f.slug === "rehearsal-finder") return isRehearsalFinderEnabled();
    if (f.slug === "instagram-follow") return isInstagramFollowEnabled();
    return true;
  });
}
```

- [ ] **Step 4: DEV 전용 env/secret (커밋 금지 — ecosystem.config.js는 --skip-worktree)**

```bash
# ecosystem.config.js 의 env 블록에 추가 (DEV 파일):  INSTAGRAM_FOLLOW_ENABLED: "1",
# DEV .db_credentials 에 추가:
sudo bash -c 'echo "INSTAGRAM_HOF_SECRET=$(openssl rand -hex 32)" >> /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials'
sudo chown ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
sudo chmod 600 /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
```

- [ ] **Step 5: 빌드 확인 후 커밋**

```bash
sudo -u ec2-user pnpm lint && sudo -u ec2-user pnpm build
sudo -u ec2-user git add package.json pnpm-lock.yaml src/lib/playground.ts src/lib/playground/instagram/
sudo -u ec2-user git commit -m "feat(instagram-follow): scaffold flag, config, types, playground entry"
```

---

### Task 2: normalizeUsername (TDD)

**Files:**
- Create: `src/lib/playground/instagram/normalizeUsername.ts`
- Test: `src/lib/playground/instagram/normalizeUsername.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsername, toProfileUrl } from "./normalizeUsername";

test("일반 username 정규화", () => {
  assert.equal(normalizeUsername("  @Some_User.99 "), "some_user.99");
});
test("일반 프로필 URL에서 추출", () => {
  assert.equal(normalizeUsername("https://www.instagram.com/2e_1n"), "2e_1n");
  assert.equal(normalizeUsername("https://instagram.com/Abc/"), "abc");
});
test("_u/ 딥링크 URL에서 추출", () => {
  assert.equal(normalizeUsername("https://www.instagram.com/_u/band_sustain"), "band_sustain");
});
test("쿼리스트링 제거", () => {
  assert.equal(normalizeUsername("https://www.instagram.com/abc?hl=ko"), "abc");
});
test("인스타그램 외 도메인 거부", () => {
  assert.equal(normalizeUsername("https://evil.com/abc"), null);
  assert.equal(normalizeUsername("https://instagram.com.evil.com/abc"), null);
});
test("허용 문자 외 거부 (XSS 방어)", () => {
  assert.equal(normalizeUsername('<script>alert(1)</script>'), null);
  assert.equal(normalizeUsername(""), null);
});
test("프로필 링크는 정규형으로 재생성", () => {
  assert.equal(toProfileUrl("abc"), "https://www.instagram.com/abc/");
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/normalizeUsername.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```typescript
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const ALLOWED_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

export function normalizeUsername(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return null;
    }
    if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    s = parts[0] === "_u" ? (parts[1] ?? "") : parts[0];
  }
  s = s.replace(/^@/, "").split("?")[0].replace(/\//g, "").trim().toLowerCase();
  return USERNAME_RE.test(s) ? s : null;
}

export function toProfileUrl(username: string): string {
  return `https://www.instagram.com/${username}/`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/normalizeUsername.test.ts`
Expected: PASS (fail 0)

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/normalizeUsername*
sudo -u ec2-user git commit -m "feat(instagram-follow): username normalization with domain whitelist"
```

---

### Task 3: parseInstagramDate (TDD)

**Files:**
- Create: `src/lib/playground/instagram/parseInstagramDate.ts`
- Test: `src/lib/playground/instagram/parseInstagramDate.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { parseInstagramDate } from "./parseInstagramDate";

test("한국어 오전", () => {
  assert.equal(parseInstagramDate("6월 06, 2026 10:49 오전"), "2026-06-06T10:49:00");
});
test("한국어 오후", () => {
  assert.equal(parseInstagramDate("9월 22, 2024 10:10 오후"), "2024-09-22T22:10:00");
});
test("12시 경계: 오전 12시 = 00시, 오후 12시 = 12시", () => {
  assert.equal(parseInstagramDate("6월 06, 2026 12:19 오전"), "2026-06-06T00:19:00");
  assert.equal(parseInstagramDate("6월 06, 2026 12:19 오후"), "2026-06-06T12:19:00");
});
test("영어 로케일 (약식/전체 월 이름, AM/PM)", () => {
  assert.equal(parseInstagramDate("Jun 06, 2026 10:49 AM"), "2026-06-06T10:49:00");
  assert.equal(parseInstagramDate("September 22, 2024 10:10 PM"), "2024-09-22T22:10:00");
});
test("파싱 불가 시 null (원문은 호출부가 보존)", () => {
  assert.equal(parseInstagramDate("nonsense"), null);
  assert.equal(parseInstagramDate(""), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/parseInstagramDate.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```typescript
const KO_RE = /^(\d{1,2})월\s*(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(오전|오후)$/;
const EN_RE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/;

const EN_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function build(y: number, mo: number, d: number, h12: number, mi: number, pm: boolean): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h12 < 1 || h12 > 12 || mi > 59) return null;
  const h = (h12 % 12) + (pm ? 12 : 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:00`;
}

export function parseInstagramDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(KO_RE);
  if (m) {
    return build(+m[3], +m[1], +m[2], +m[4], +m[5], m[6] === "오후");
  }
  m = s.match(EN_RE);
  if (m) {
    const mo = EN_MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return build(+m[3], mo, +m[2], +m[4], +m[5], m[6].toLowerCase() === "p");
  }
  return null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/parseInstagramDate.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/parseInstagramDate*
sudo -u ec2-user git commit -m "feat(instagram-follow): Korean/English export date parser"
```

---

### Task 4: parseConnectionsHtml (TDD) — followers/following 공용 파서

클래스명에 의존하지 않고 "instagram.com 링크 `<a>` → 바로 다음 `<div>텍스트</div>`가 날짜" 라는 구조적 패턴만 사용 (스펙 §16, 실측 마크업 §0.6 근거). followers(링크 텍스트=username)와 following(`_u/` href에서 추출) 모두 동일 로직으로 처리된다.

**Files:**
- Create: `src/lib/playground/instagram/parseConnectionsHtml.ts`
- Test: `src/lib/playground/instagram/parseConnectionsHtml.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성 (실측 마크업 기반 fixture)**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { parseConnectionsHtml } from "./parseConnectionsHtml";

const FOLLOWERS_FIXTURE = `<html><body><main>
<div class="pam _a6-g"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/2e_1n">2e_1n</a></div><div>6월 06, 2026 10:49 오전</div></div></div></div>
<div class="pam _a6-g"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/Byeongguk__0714">Byeongguk__0714</a></div><div>6월 06, 2026 12:19 오전</div></div></div></div>
</main></body></html>`;

const FOLLOWING_FIXTURE = `<html><body><main>
<div class="pam _a6-g"><h2 class="_a6-h">band_sustain</h2><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/_u/band_sustain">https://www.instagram.com/_u/band_sustain</a></div><div>9월 22, 2024 10:10 오후</div></div></div></div>
</main></body></html>`;

test("followers: username/링크/날짜 추출", () => {
  const { connections, failedCount } = parseConnectionsHtml(FOLLOWERS_FIXTURE);
  assert.equal(failedCount, 0);
  assert.equal(connections.length, 2);
  assert.deepEqual(connections[0], {
    username: "2e_1n",
    profileUrl: "https://www.instagram.com/2e_1n/",
    followedAt: "2026-06-06T10:49:00",
    followedAtRaw: "6월 06, 2026 10:49 오전",
  });
  assert.equal(connections[1].username, "byeongguk__0714"); // 소문자 정규화
});

test("following: _u/ href에서 username 추출", () => {
  const { connections } = parseConnectionsHtml(FOLLOWING_FIXTURE);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].username, "band_sustain");
  assert.equal(connections[0].profileUrl, "https://www.instagram.com/band_sustain/");
  assert.equal(connections[0].followedAt, "2024-09-22T22:10:00");
});

test("날짜 없는/깨진 항목도 계정은 유지하고 날짜만 null", () => {
  const html = `<a href="https://www.instagram.com/abc">abc</a></div><div>알 수 없는 날짜형식</div>`;
  const { connections } = parseConnectionsHtml(html);
  assert.equal(connections[0].followedAt, null);
  assert.equal(connections[0].followedAtRaw, "알 수 없는 날짜형식");
});

test("인스타그램 외 링크는 무시, 중복 username은 첫 항목 유지", () => {
  const html = `
<a href="https://evil.com/x">x</a>
<a href="https://www.instagram.com/dup">dup</a></div><div>6월 01, 2026 1:00 오전</div>
<a href="https://www.instagram.com/dup">dup</a></div><div>6월 02, 2026 1:00 오전</div>`;
  const { connections } = parseConnectionsHtml(html);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].followedAt, "2026-06-01T01:00:00");
});

test("프로필 외 경로(p/, reel/ 등) 링크는 무시", () => {
  const html = `<a href="https://www.instagram.com/p/Cxyz123">post</a>`;
  // p/ 는 1.5스텝의 RESERVED 목록으로 걸러짐
  assert.equal(parseConnectionsHtml(html).connections.length, 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/parseConnectionsHtml.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
import { normalizeUsername, toProfileUrl } from "./normalizeUsername";
import { parseInstagramDate } from "./parseInstagramDate";
import type { InstagramConnection, ParseOutcome } from "./types";

const ANCHOR_RE =
  /<a\b[^>]*href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
// 프로필이 아닌 인스타그램 경로 (게시물/릴스 등)
const RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct"]);

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

export function parseConnectionsHtml(html: string): ParseOutcome {
  const seen = new Map<string, InstagramConnection>();
  let failedCount = 0;

  for (const m of html.matchAll(ANCHOR_RE)) {
    const href = m[1];
    const firstSeg = href.split("instagram.com/")[1]?.split(/[/?]/)[0]?.toLowerCase() ?? "";
    if (RESERVED.has(firstSeg)) continue;

    const linkText = decodeEntities(m[2].replace(/<[^>]*>/g, "")).trim();
    const username = normalizeUsername(href) ?? normalizeUsername(linkText);
    if (!username) {
      failedCount++;
      continue;
    }

    // <a> 닫힌 직후 ~300자 내 첫 <div>텍스트</div> = 팔로우 날짜 (실측 마크업 §0.6)
    const tail = html.slice(m.index! + m[0].length, m.index! + m[0].length + 300);
    const dm = tail.match(/<div>([^<>]{4,80})<\/div>/);
    const followedAtRaw = dm ? decodeEntities(dm[1]).trim() : null;
    const followedAt = followedAtRaw ? parseInstagramDate(followedAtRaw) : null;

    if (!seen.has(username)) {
      seen.set(username, {
        username,
        profileUrl: toProfileUrl(username),
        followedAt,
        followedAtRaw,
      });
    }
  }
  return { connections: [...seen.values()], failedCount };
}
```

- [ ] **Step 4: 통과 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/parseConnectionsHtml.test.ts`
Expected: PASS

- [ ] **Step 5: 실측 ZIP 전체 파일로 스모크 검증 (커밋하지 않는 1회용 스크립트)**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user node -e '
const { execSync } = require("child_process");' 2>/dev/null || true
# tsx 원라이너로 실측 검증:
sudo -u ec2-user pnpm exec tsx -e "
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { parseConnectionsHtml } from './src/lib/playground/instagram/parseConnectionsHtml';
const zip = await JSZip.loadAsync(readFileSync('/var/www/html/_______site_BANDSUSTAIN/instagram-_mongsil_kim-2026-06-08-qNJMxQEM.zip'));
const fol = parseConnectionsHtml(await zip.file('connections/followers_and_following/followers_1.html')!.async('string'));
const fng = parseConnectionsHtml(await zip.file('connections/followers_and_following/following.html')!.async('string'));
console.log('followers:', fol.connections.length, 'failed:', fol.failedCount);
console.log('following:', fng.connections.length, 'failed:', fng.failedCount);
console.log('band_sustain:', fng.connections.find(c => c.username === 'band_sustain'));
"
```

Expected: `followers: 528 failed: 0`, `following: 774 failed: 0`, band_sustain의 followedAt = `2024-09-22T22:10:00`.

- [ ] **Step 6: 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/parseConnectionsHtml*
sudo -u ec2-user git commit -m "feat(instagram-follow): class-independent connections HTML parser"
```

---

### Task 5: findFiles — ZIP 내 대상 파일 탐색 (TDD)

**Files:**
- Create: `src/lib/playground/instagram/findFiles.ts`
- Test: `src/lib/playground/instagram/findFiles.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { matchConnectionFiles } from "./findFiles";

test("표준 경로에서 followers_N/following 매칭 + 숫자 정렬", () => {
  const r = matchConnectionFiles([
    "start_here.html",
    "connections/followers_and_following/followers_10.html",
    "connections/followers_and_following/followers_2.html",
    "connections/followers_and_following/followers_1.html",
    "connections/followers_and_following/following.html",
    "connections/followers_and_following/blocked_profiles.html",
    "media/other/123.jpg",
  ]);
  assert.deepEqual(r.followers, [
    "connections/followers_and_following/followers_1.html",
    "connections/followers_and_following/followers_2.html",
    "connections/followers_and_following/followers_10.html",
  ]);
  assert.equal(r.following, "connections/followers_and_following/following.html");
});

test("followers.html (숫자 없음) / 대소문자 차이 / 루트 폴백", () => {
  const r = matchConnectionFiles(["Followers.HTML", "FOLLOWING.html"]);
  assert.deepEqual(r.followers, ["Followers.HTML"]);
  assert.equal(r.following, "FOLLOWING.html");
});

test("recently_unfollowed 등 유사 파일은 매칭 안 됨", () => {
  const r = matchConnectionFiles([
    "connections/followers_and_following/recently_unfollowed_profiles.html",
    "connections/followers_and_following/recent_follow_requests.html",
  ]);
  assert.deepEqual(r.followers, []);
  assert.equal(r.following, null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/findFiles.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
export type ConnectionFiles = { followers: string[]; following: string | null };

const FOLLOWERS_RE = /^followers(_\d+)?\.html$/;
const FOLLOWING_RE = /^following\.html$/;
const STANDARD_DIR = "followers_and_following/";

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function followerNum(p: string): number {
  const m = basename(p).toLowerCase().match(/_(\d+)\.html$/);
  return m ? +m[1] : 0;
}

function pick(paths: string[]): ConnectionFiles {
  const followers = paths
    .filter((p) => FOLLOWERS_RE.test(basename(p).toLowerCase()))
    .sort((a, b) => followerNum(a) - followerNum(b));
  const following = paths.find((p) => FOLLOWING_RE.test(basename(p).toLowerCase())) ?? null;
  return { followers, following };
}

export function matchConnectionFiles(allPaths: string[]): ConnectionFiles {
  // 1순위: 표준 디렉터리 안에서 탐색, 폴백: 전체 경로에서 basename 매칭
  const standard = pick(allPaths.filter((p) => p.toLowerCase().includes(STANDARD_DIR)));
  if (standard.followers.length > 0 || standard.following) return standard;
  return pick(allPaths);
}
```

- [ ] **Step 4: 통과 확인 후 커밋**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/findFiles.test.ts` → PASS

```bash
sudo -u ec2-user git add src/lib/playground/instagram/findFiles*
sudo -u ec2-user git commit -m "feat(instagram-follow): zip entry matcher for followers/following files"
```

---

### Task 6: relations — 관계 집합 계산 (TDD)

**Files:**
- Create: `src/lib/playground/instagram/relations.ts`
- Test: `src/lib/playground/instagram/relations.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { calculateRelations } from "./relations";
import type { InstagramConnection } from "./types";

function conn(username: string, followedAt: string | null = null): InstagramConnection {
  return {
    username,
    profileUrl: `https://www.instagram.com/${username}/`,
    followedAt,
    followedAtRaw: followedAt,
  };
}

test("mutual / notFollowingMeBack / iDoNotFollowBack 분리 + 양쪽 날짜 보존", () => {
  const followers = [conn("a", "2025-09-03T10:00:00"), conn("b")];
  const following = [conn("a", "2025-08-12T10:00:00"), conn("c", "2025-01-01T10:00:00")];
  const r = calculateRelations(followers, following);

  assert.deepEqual(r.mutuals.map((x) => x.username), ["a"]);
  assert.equal(r.mutuals[0].followerSince, "2025-09-03T10:00:00");
  assert.equal(r.mutuals[0].followingSince, "2025-08-12T10:00:00");
  assert.deepEqual(r.notFollowingMeBack.map((x) => x.username), ["c"]);
  assert.deepEqual(r.iDoNotFollowBack.map((x) => x.username), ["b"]);
  assert.equal(r.followers.length, 2);
  assert.equal(r.following.length, 2);
});

test("입력 중복은 1회만 반영 (파서가 이미 dedup하지만 방어)", () => {
  const r = calculateRelations([conn("a"), conn("a")], []);
  assert.equal(r.followers.length, 1);
});

test("빈 입력", () => {
  const r = calculateRelations([], []);
  assert.deepEqual(r.mutuals, []);
  assert.deepEqual(r.notFollowingMeBack, []);
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/relations.test.ts` → FAIL

- [ ] **Step 3: 구현**

```typescript
import type { AccountRelation, InstagramConnection, RelationResult } from "./types";

export function calculateRelations(
  followers: InstagramConnection[],
  following: InstagramConnection[],
): RelationResult {
  const map = new Map<string, AccountRelation>();

  const ensure = (c: InstagramConnection): AccountRelation => {
    let r = map.get(c.username);
    if (!r) {
      r = {
        username: c.username,
        profileUrl: c.profileUrl,
        isFollower: false,
        isFollowing: false,
        followerSince: null,
        followerSinceRaw: null,
        followingSince: null,
        followingSinceRaw: null,
      };
      map.set(c.username, r);
    }
    return r;
  };

  for (const c of followers) {
    const r = ensure(c);
    if (!r.isFollower) {
      r.isFollower = true;
      r.followerSince = c.followedAt;
      r.followerSinceRaw = c.followedAtRaw;
    }
  }
  for (const c of following) {
    const r = ensure(c);
    if (!r.isFollowing) {
      r.isFollowing = true;
      r.followingSince = c.followedAt;
      r.followingSinceRaw = c.followedAtRaw;
    }
  }

  const all = [...map.values()];
  return {
    followers: all.filter((r) => r.isFollower),
    following: all.filter((r) => r.isFollowing),
    mutuals: all.filter((r) => r.isFollower && r.isFollowing),
    notFollowingMeBack: all.filter((r) => r.isFollowing && !r.isFollower),
    iDoNotFollowBack: all.filter((r) => r.isFollower && !r.isFollowing),
  };
}
```

- [ ] **Step 4: 통과 확인 후 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/relations*
sudo -u ec2-user git commit -m "feat(instagram-follow): follower/following relation sets"
```

---

### Task 7: followDays — 경과 일수 계산 (TDD)

규칙(스펙 §8): 팔로우 당일 = **1일째**, 로컬 날짜 단위 정규화(시각 무시), 미래 날짜는 null.

**Files:**
- Create: `src/lib/playground/instagram/followDays.ts`
- Test: `src/lib/playground/instagram/followDays.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { followDayCount, formatKoreanDate } from "./followDays";

test("팔로우 당일은 1일째 (시각이 달라도)", () => {
  assert.equal(followDayCount("2026-06-06T23:59:00", new Date(2026, 5, 6, 0, 1)), 1);
});
test("다음날은 2일째 (자정 직후)", () => {
  assert.equal(followDayCount("2026-06-06T10:00:00", new Date(2026, 5, 7, 0, 0, 1)), 2);
});
test("윤년 포함 구간 (2024-02-28 → 2024-03-01 = 3일째, 2/29 존재)", () => {
  assert.equal(followDayCount("2024-02-28T00:00:00", new Date(2024, 2, 1)), 3);
});
test("실측 fixture: band_sustain 2024-09-22 → 2026-06-10 = 627일째", () => {
  assert.equal(followDayCount("2024-09-22T22:10:00", new Date(2026, 5, 10)), 627);
});
test("미래 날짜 방어", () => {
  assert.equal(followDayCount("2026-06-11T00:00:00", new Date(2026, 5, 10)), null);
});
test("잘못된 입력", () => {
  assert.equal(followDayCount("not-a-date", new Date(2026, 5, 10)), null);
});
test("한국어 날짜 포맷", () => {
  assert.equal(formatKoreanDate("2024-09-22T22:10:00"), "2024년 9월 22일");
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/followDays.test.ts` → FAIL

- [ ] **Step 3: 구현**

```typescript
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

// iso: "YYYY-MM-DD..." (naive). 팔로우 당일 = 1일째. 미래/파싱불가 = null.
export function followDayCount(iso: string, today: Date = new Date()): number | null {
  const m = iso.match(ISO_DATE_RE);
  if (!m) return null;
  const start = new Date(+m[1], +m[2] - 1, +m[3]); // 로컬 자정
  if (start.getFullYear() !== +m[1] || start.getMonth() !== +m[2] - 1) return null;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? null : diff + 1;
}

export function formatKoreanDate(iso: string): string | null {
  const m = iso.match(ISO_DATE_RE);
  if (!m) return null;
  return `${+m[1]}년 ${+m[2]}월 ${+m[3]}일`;
}
```

- [ ] **Step 4: 통과 확인 후 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/followDays*
sudo -u ec2-user git commit -m "feat(instagram-follow): follow day counting (day 1 = follow date)"
```

---

### Task 8: nickname 검증 (TDD, 클라/서버 공용)

**Files:**
- Create: `src/lib/playground/instagram/nickname.ts`
- Test: `src/lib/playground/instagram/nickname.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { validateNickname } from "./nickname";

test("정상 닉네임 (트림 적용)", () => {
  assert.deepEqual(validateNickname("  몽실이 "), { ok: true, value: "몽실이" });
  assert.deepEqual(validateNickname("Rock스타99"), { ok: true, value: "Rock스타99" });
});
test("길이 제한 2~20자", () => {
  assert.equal(validateNickname("a").ok, false);
  assert.equal(validateNickname("가".repeat(21)).ok, false);
  assert.equal(validateNickname("가".repeat(20)).ok, true);
});
test("HTML 태그/꺾쇠 금지", () => {
  assert.equal(validateNickname("<b>몽실</b>").ok, false);
  assert.equal(validateNickname("a<scr").ok, false);
});
test("욕설 필터", () => {
  assert.equal(validateNickname("시발이").ok, false);
  assert.equal(validateNickname("fuckyou").ok, false);
});
test("특수문자 과다 (절반 초과) 금지, 적당한 특수문자는 허용", () => {
  assert.equal(validateNickname("!!!!!!####").ok, false);
  assert.equal(validateNickname("몽실★").ok, true);
});
test("제어문자/줄바꿈 금지", () => {
  assert.equal(validateNickname("몽\n실이").ok, false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/nickname.test.ts` → FAIL

- [ ] **Step 3: 구현**

```typescript
export type NicknameResult = { ok: true; value: string } | { ok: false; reason: string };

const BANNED_SUBSTRINGS = [
  "시발", "씨발", "병신", "지랄", "좆", "썅", "개새끼", "새끼", "느금", "니애미", "보지", "자지",
  "fuck", "shit", "bitch", "asshole", "nigger", "sex",
];
const CONTROL_RE = /[\x00-\x1f\x7f]/; // 제어문자(줄바꿈 포함)
const PLAIN_CHAR_RE = /[0-9A-Za-z가-힣ㄱ-ㆎ ]/; // 한글/영문/숫자/공백

export function validateNickname(raw: string): NicknameResult {
  const value = raw.trim();
  if (value.length < 2 || value.length > 20) {
    return { ok: false, reason: "닉네임은 2~20자로 입력해 주세요." };
  }
  if (/[<>]/.test(value) || CONTROL_RE.test(value)) {
    return { ok: false, reason: "사용할 수 없는 문자가 포함되어 있어요." };
  }
  const lower = value.toLowerCase().replace(/\s/g, "");
  if (BANNED_SUBSTRINGS.some((w) => lower.includes(w))) {
    return { ok: false, reason: "부적절한 표현은 사용할 수 없어요." };
  }
  const special = [...value].filter((ch) => !PLAIN_CHAR_RE.test(ch)).length;
  if (special > value.length / 2) {
    return { ok: false, reason: "특수문자를 줄여 주세요." };
  }
  return { ok: true, value };
}
```

- [ ] **Step 4: 통과 확인 후 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/nickname*
sudo -u ec2-user git commit -m "feat(instagram-follow): nickname validation shared by client/server"
```

---

### Task 9: DB 스키마 + 서버 헬퍼 (ipHash / rateLimit / hofDb)

**Files:**
- Create: `db/schema/023_instagram_follow.sql`
- Create: `src/lib/playground/instagram/ipHash.ts`
- Create: `src/lib/playground/instagram/rateLimit.ts`
- Test: `src/lib/playground/instagram/rateLimit.test.ts`
- Create: `src/lib/playground/instagram/hofDb.ts`

- [ ] **Step 1: 스키마 작성 — `db/schema/023_instagram_follow.sql`**

스펙의 Prisma 모델을 기존 수동 SQL 방식으로 변환. 경과 일수 컬럼은 만들지 않는다(조회 시 계산, 스펙 §10).

```sql
-- 인스타 맞팔 분석기: 서스테인 팔로우 명예의 전당
CREATE TABLE IF NOT EXISTS instagram_follow_hof (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nickname VARCHAR(20) NOT NULL,
  sustain_followed_at DATE NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  browser_token_hash CHAR(64) NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_iphash_followdate (ip_hash, sustain_followed_at),
  KEY idx_rank (is_visible, sustain_followed_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: DEV DB에 적용 (PROD 적용 금지 — 운영 반영 시점에 별도 진행)**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/023_instagram_follow.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW CREATE TABLE instagram_follow_hof"
```

Expected: 테이블 생성, UNIQUE KEY `uq_iphash_followdate` 확인.

- [ ] **Step 3: ipHash 구현 — `src/lib/playground/instagram/ipHash.ts` (서버 전용)**

```typescript
import "server-only";
import { createHmac } from "node:crypto";
import { requireCred } from "@/lib/creds";

export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped IPv6
  return ip;
}

// 기존 analytics 라우트와 동일 추출 방식 (Apache 리버스 프록시 전제)
export function extractClientIp(req: Request): string {
  const raw =
    (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
      .split(",")[0]
      .trim() || "0.0.0.0";
  return normalizeIp(raw);
}

// 원본 IP는 저장하지 않는다. 서버 비밀키 HMAC만 저장 (스펙 §9).
export function hashIp(ip: string): string {
  return createHmac("sha256", requireCred("INSTAGRAM_HOF_SECRET"))
    .update(normalizeIp(ip))
    .digest("hex");
}

export function hashBrowserToken(token: string): string {
  return createHmac("sha256", requireCred("INSTAGRAM_HOF_SECRET"))
    .update(`bt:${token}`)
    .digest("hex");
}
```

- [ ] **Step 4: rateLimit 실패 테스트 작성 — `rateLimit.test.ts`**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "./rateLimit";

test("한도 내 허용, 초과 거부, 윈도 경과 후 회복", () => {
  const allow = createRateLimiter({ limit: 3, windowMs: 1000 });
  assert.equal(allow("ip1", 0), true);
  assert.equal(allow("ip1", 10), true);
  assert.equal(allow("ip1", 20), true);
  assert.equal(allow("ip1", 30), false);      // 4번째 거부
  assert.equal(allow("ip2", 30), true);       // 다른 키는 독립
  assert.equal(allow("ip1", 1100), true);     // 윈도 지나면 회복
});
```

- [ ] **Step 5: 실패 확인 → 구현 — `rateLimit.ts`**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/rateLimit.test.ts` → FAIL

```typescript
// PM2 단일 프로세스 전제의 in-memory sliding window (스펙 §12: IP당 10분 5회)
type Options = { limit: number; windowMs: number };

export function createRateLimiter({ limit, windowMs }: Options) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number = Date.now()): boolean {
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      hits.set(key, arr);
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 10_000) hits.clear(); // 메모리 방어
    return true;
  };
}
```

Run again → PASS.

- [ ] **Step 6: hofDb 구현 — `src/lib/playground/instagram/hofDb.ts` (서버 전용)**

```typescript
import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type HofListItem = { id: number; nickname: string; followedAt: string };

export type HofAdminRow = {
  id: number;
  nickname: string;
  sustainFollowedAt: string; // "YYYY-MM-DD"
  createdAt: string;
  isVisible: boolean;
  ipHashPrefix: string; // admin 표시용 앞 10자만 (전체값 미노출)
};

export async function listVisibleHof(
  page: number,
  pageSize: number,
): Promise<{ items: HofListItem[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, nickname, DATE_FORMAT(sustain_followed_at, '%Y-%m-%d') AS followedAt
       FROM instagram_follow_hof
      WHERE is_visible = 1
      ORDER BY sustain_followed_at ASC, created_at ASC, id ASC
      LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
  const [cnt] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM instagram_follow_hof WHERE is_visible = 1`,
  );
  return {
    items: rows.map((r) => ({
      id: r.id as number,
      nickname: r.nickname as string,
      followedAt: r.followedAt as string,
    })),
    total: Number(cnt[0].total),
  };
}

export type InsertHofResult =
  | { ok: true; id: number }
  | { ok: false; code: "DUPLICATE_ENTRY" };

export async function insertHof(input: {
  nickname: string;
  sustainFollowedAt: string; // "YYYY-MM-DD"
  ipHash: string;
  browserTokenHash: string | null;
}): Promise<InsertHofResult> {
  try {
    const [res] = await getPool().query<ResultSetHeader>(
      `INSERT INTO instagram_follow_hof (nickname, sustain_followed_at, ip_hash, browser_token_hash)
       VALUES (?, ?, ?, ?)`,
      [input.nickname, input.sustainFollowedAt, input.ipHash, input.browserTokenHash],
    );
    return { ok: true, id: res.insertId };
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { errno?: number }).errno === 1062) {
      return { ok: false, code: "DUPLICATE_ENTRY" };
    }
    throw e;
  }
}

export async function adminListHof(search: string | null): Promise<HofAdminRow[]> {
  const where = search ? `WHERE nickname LIKE ?` : "";
  const params = search ? [`%${search}%`] : [];
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, nickname, DATE_FORMAT(sustain_followed_at, '%Y-%m-%d') AS followedAt, is_visible,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt,
            LEFT(ip_hash, 10) AS ipHashPrefix
       FROM instagram_follow_hof ${where}
      ORDER BY created_at DESC LIMIT 500`,
    params,
  );
  return rows.map((r) => ({
    id: r.id as number,
    nickname: r.nickname as string,
    sustainFollowedAt: r.followedAt as string,
    createdAt: r.createdAt as string,
    isVisible: r.is_visible === 1,
    ipHashPrefix: r.ipHashPrefix as string,
  }));
}

export async function setHofVisibility(id: number, visible: boolean): Promise<void> {
  await getPool().query(`UPDATE instagram_follow_hof SET is_visible = ? WHERE id = ?`, [
    visible ? 1 : 0,
    id,
  ]);
}
```

- [ ] **Step 7: 전체 테스트 + 빌드 확인 후 커밋**

```bash
sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/*.test.ts   # 전부 PASS
sudo -u ec2-user pnpm build
sudo -u ec2-user git add db/schema/023_instagram_follow.sql src/lib/playground/instagram/ipHash.ts src/lib/playground/instagram/rateLimit.ts src/lib/playground/instagram/rateLimit.test.ts src/lib/playground/instagram/hofDb.ts
sudo -u ec2-user git commit -m "feat(instagram-follow): hall-of-fame schema, HMAC ip hash, rate limiter, db helpers"
```

---

### Task 10: 명예의 전당 API — `GET/POST /api/playground/instagram-follow/hall-of-fame`

기존 API 패턴(zod safeParse + `{ error: code }` 응답 + `runtime nodejs` + `force-dynamic`)을 따른다.

**Files:**
- Create: `src/app/api/playground/instagram-follow/hall-of-fame/route.ts`

- [ ] **Step 1: 라우트 구현**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import { HOF_PAGE_SIZE, MIN_FOLLOW_DATE } from "@/lib/playground/instagram/config";
import { validateNickname } from "@/lib/playground/instagram/nickname";
import { followDayCount } from "@/lib/playground/instagram/followDays";
import { extractClientIp, hashIp, hashBrowserToken } from "@/lib/playground/instagram/ipHash";
import { createRateLimiter } from "@/lib/playground/instagram/rateLimit";
import { insertHof, listVisibleHof } from "@/lib/playground/instagram/hofDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 스펙 §12: 동일 IP 10분 5회
const allowPost = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(HOF_PAGE_SIZE),
});

const BodySchema = z.object({
  nickname: z.string().min(1).max(100),
  sustainFollowedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  browserToken: z.string().max(128).optional(),
  agreedToPolicy: z.literal(true),
});

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetch는 Origin이 없을 수 있음
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!isInstagramFollowEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_query" }, { status: 400 });
  }
  const { page, pageSize } = parsed.data;
  const { items, total } = await listVisibleHof(page, pageSize);
  const offset = (page - 1) * pageSize;
  return NextResponse.json({
    items: items.map((it, i) => ({
      rank: offset + i + 1,
      nickname: it.nickname,
      followedAt: it.followedAt,
      daysFollowing: followDayCount(it.followedAt) ?? 0,
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(req: Request) {
  if (!isInstagramFollowEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const ip = extractClientIp(req);
  if (!allowPost(ip)) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "입력값을 확인해 주세요." },
      { status: 400 },
    );
  }

  const nick = validateNickname(parsed.data.nickname);
  if (!nick.ok) {
    return NextResponse.json({ code: "BAD_NICKNAME", message: nick.reason }, { status: 400 });
  }

  // 날짜 검증: 미래 금지, 인스타그램 출시(2010-10-01) 이전 금지 (스펙 §11)
  const date = parsed.data.sustainFollowedAt;
  const days = followDayCount(date); // 미래/비정상 날짜면 null
  if (days === null || date < MIN_FOLLOW_DATE) {
    return NextResponse.json(
      { code: "BAD_DATE", message: "팔로우 시작일이 올바르지 않아요." },
      { status: 400 },
    );
  }

  const result = await insertHof({
    nickname: nick.value,
    sustainFollowedAt: date,
    ipHash: hashIp(ip),
    browserTokenHash: parsed.data.browserToken ? hashBrowserToken(parsed.data.browserToken) : null,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        code: "DUPLICATE_ENTRY",
        message: "이미 같은 환경과 팔로우 날짜로 등록된 기록이 있어요.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
```

- [ ] **Step 2: 빌드 + curl 스모크 (DEV 서버 기동 후)**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm build
sudo -u ec2-user pm2 restart ecosystem.config.js --only bandsustain-dev   # env 재파싱 방식 필수 (feedback_pm2_update_env_not_reread_ecosystem)

# GET (빈 목록)
curl -s "http://127.0.0.1:3101/api/playground/instagram-follow/hall-of-fame" ; echo
# POST 정상 등록
curl -s -X POST "http://127.0.0.1:3101/api/playground/instagram-follow/hall-of-fame" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스트몽실","sustainFollowedAt":"2024-09-22","agreedToPolicy":true}' ; echo
# 같은 IP + 같은 날짜 재등록 → 409 DUPLICATE_ENTRY
curl -s -X POST "http://127.0.0.1:3101/api/playground/instagram-follow/hall-of-fame" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스트몽실2","sustainFollowedAt":"2024-09-22","agreedToPolicy":true}' ; echo
# 같은 IP + 다른 날짜 → 201 허용
curl -s -X POST "http://127.0.0.1:3101/api/playground/instagram-follow/hall-of-fame" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스트몽실3","sustainFollowedAt":"2024-09-23","agreedToPolicy":true}' ; echo
# 미래 날짜 → 400 BAD_DATE / 욕설 닉네임 → 400 BAD_NICKNAME / 6번째 연속 요청 → 429
```

Expected 순서대로: `{"items":[],...}` → `{"ok":true,...}` → `DUPLICATE_ENTRY`(409) → `{"ok":true}` → 400/400/429.

검증 후 테스트 row 정리:

```bash
set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DELETE FROM instagram_follow_hof WHERE nickname LIKE '테스트몽실%'"
```

- [ ] **Step 3: 커밋**

```bash
sudo -u ec2-user git add src/app/api/playground/instagram-follow/
sudo -u ec2-user git commit -m "feat(instagram-follow): hall-of-fame GET/POST api with rate limit and dedup"
```

---

### Task 11: analyzeZip + history — 클라이언트 분석 오케스트레이션

**Files:**
- Create: `src/lib/playground/instagram/analyzeZip.ts` (브라우저 전용 — JSZip)
- Create: `src/lib/playground/instagram/history.ts` (localStorage 요약 이력)

- [ ] **Step 1: analyzeZip 구현**

```typescript
import JSZip from "jszip";
import { MAX_ZIP_BYTES, SUSTAIN_USERNAME } from "./config";
import { matchConnectionFiles } from "./findFiles";
import { parseConnectionsHtml } from "./parseConnectionsHtml";
import { calculateRelations } from "./relations";
import { AnalysisError, type AnalysisResult, type InstagramConnection } from "./types";

async function isZipSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05);
}

export async function analyzeZip(file: File): Promise<AnalysisResult> {
  if (file.size > MAX_ZIP_BYTES) throw new AnalysisError("TOO_LARGE");
  if (!(await isZipSignature(file))) throw new AnalysisError("NOT_ZIP");

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new AnalysisError("NOT_ZIP");
  }

  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const found = matchConnectionFiles(paths);
  if (found.followers.length === 0 && !found.following) {
    // 내부 경로는 개발 콘솔에만 (스펙 §13)
    if (process.env.NODE_ENV !== "production") console.debug("zip entries:", paths);
    throw new AnalysisError("FILES_NOT_FOUND");
  }

  const readHtml = async (path: string): Promise<string> => {
    try {
      return await zip.file(path)!.async("string");
    } catch (e) {
      // JSZip은 암호화된 엔트리 해제 미지원 → 읽기 시점 에러
      if (e instanceof Error && /encrypt/i.test(e.message)) {
        throw new AnalysisError("ENCRYPTED_ZIP");
      }
      throw new AnalysisError("PARSE_FAILED");
    }
  };

  let parseFailedCount = 0;
  const followers: InstagramConnection[] = [];
  const dedup = new Set<string>();
  for (const p of found.followers) {
    const out = parseConnectionsHtml(await readHtml(p));
    parseFailedCount += out.failedCount;
    for (const c of out.connections) {
      if (!dedup.has(c.username)) {
        dedup.add(c.username);
        followers.push(c); // 여러 followers_*.html 병합 (스펙 §5)
      }
    }
  }

  let following: InstagramConnection[] = [];
  if (found.following) {
    const out = parseConnectionsHtml(await readHtml(found.following));
    parseFailedCount += out.failedCount;
    following = out.connections;
  }

  const relations = calculateRelations(followers, following);
  const sustainConn = following.find((c) => c.username === SUSTAIN_USERNAME) ?? null;

  return {
    relations,
    hasFollowers: found.followers.length > 0,
    hasFollowing: found.following !== null,
    parseFailedCount,
    sustain: {
      following: sustainConn !== null,
      since: sustainConn?.followedAt ?? null,
      sinceRaw: sustainConn?.followedAtRaw ?? null,
    },
    analyzedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: history 구현 (요약 수치만 — 전체 목록 저장 금지, 스펙 §3)**

```typescript
import type { AnalysisResult } from "./types";

const KEY = "bs_instagram_follow_history_v1";
const TOKEN_KEY = "bs_instagram_follow_token_v1";
const REGISTERED_KEY = "bs_instagram_follow_registered_v1";
const MAX_ITEMS = 10;

export type HistoryEntry = {
  analyzedAt: string;
  followerCount: number;
  followingCount: number;
  notFollowingMeBackCount: number;
  sustainFollowing: boolean;
};

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(r: AnalysisResult): void {
  const entry: HistoryEntry = {
    analyzedAt: r.analyzedAt,
    followerCount: r.relations.followers.length,
    followingCount: r.relations.following.length,
    notFollowingMeBackCount: r.relations.notFollowingMeBack.length,
    sustainFollowing: r.sustain.following,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...loadHistory()].slice(0, MAX_ITEMS)));
  } catch {
    /* storage 불가 환경은 무시 */
  }
}

// 명예의 전당 보조 중복 안내용 (스펙 §9 — 보조 수단)
export function getOrCreateBrowserToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return "no-storage";
  }
}

export function isRegisteredLocally(followDate: string): boolean {
  try {
    return localStorage.getItem(`${REGISTERED_KEY}:${followDate}`) === "1";
  } catch {
    return false;
  }
}

export function markRegisteredLocally(followDate: string): void {
  try {
    localStorage.setItem(`${REGISTERED_KEY}:${followDate}`, "1");
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 3: 빌드 확인 후 커밋**

```bash
sudo -u ec2-user pnpm build
sudo -u ec2-user git add src/lib/playground/instagram/analyzeZip.ts src/lib/playground/instagram/history.ts
sudo -u ec2-user git commit -m "feat(instagram-follow): client-side zip analysis orchestration + local history"
```

---

### Task 12: 페이지 + step 상태머신 + 인트로/가이드/업로드 UI

**Files:**
- Create: `src/app/playground/instagram-follow/page.tsx`
- Create: `src/components/playground/instagram/InstagramFollowClient.tsx`
- Create: `src/components/playground/instagram/IntroScreen.tsx`
- Create: `src/components/playground/instagram/GuideSteps.tsx`
- Create: `src/components/playground/instagram/UploadDropzone.tsx`

- [ ] **Step 1: 서버 페이지 (플래그 게이트 + 메타데이터)**

`src/app/playground/instagram-follow/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import InstagramFollowClient from "@/components/playground/instagram/InstagramFollowClient";

export const metadata: Metadata = {
  title: "인스타 맞팔 분석기 | BAND SUSTAIN",
  description:
    "인스타그램 데이터 파일 하나로 나를 맞팔하지 않는 계정과 팔로우 시작일을 확인해보세요.",
};

export default function InstagramFollowPage() {
  if (!isInstagramFollowEnabled()) notFound();
  return (
    <main className="page-fade-in mx-auto w-full max-w-xl px-4 py-8 md:py-12">
      <InstagramFollowClient />
    </main>
  );
}
```

- [ ] **Step 2: 상태머신 클라이언트 — `InstagramFollowClient.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { analyzeZip } from "@/lib/playground/instagram/analyzeZip";
import { saveHistoryEntry } from "@/lib/playground/instagram/history";
import { AnalysisError, type AnalysisResult } from "@/lib/playground/instagram/types";
import IntroScreen from "./IntroScreen";
import GuideSteps from "./GuideSteps";
import UploadDropzone from "./UploadDropzone";
import ResultView from "./ResultView";

type Step = "intro" | "guide" | "upload" | "analyzing" | "result";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_ZIP: "ZIP 형식의 인스타그램 내보내기 파일을 올려 주세요.",
  TOO_LARGE:
    "파일 용량이 너무 커요. 인스타그램 내보내기 설정에서 '팔로워 및 팔로잉' 정보만 선택해 다시 받아 주세요.",
  ENCRYPTED_ZIP: "암호가 설정된 ZIP 파일은 분석할 수 없어요.",
  FILES_NOT_FOUND:
    "팔로워 및 팔로잉 파일을 찾지 못했어요. 인스타그램에서 '팔로워 및 팔로잉', '전체 기간', 'HTML'을 선택했는지 확인해 주세요.",
  PARSE_FAILED: "인스타그램 파일 형식이 변경되어 일부 정보를 읽지 못했어요.",
};

export default function InstagramFollowClient() {
  const [step, setStep] = useState<Step>("intro");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 결과가 메모리에만 있으므로 새로고침 경고 (스펙 §15)
  useEffect(() => {
    if (step !== "result") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setStep("analyzing");
    try {
      const r = await analyzeZip(file);
      saveHistoryEntry(r);
      setResult(r);
      setStep("result");
    } catch (e) {
      setError(
        e instanceof AnalysisError
          ? ERROR_MESSAGES[e.code]
          : "분석 중 문제가 발생했어요. 다시 시도해 주세요.",
      );
      setStep("upload");
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null); // 파싱 결과를 메모리에서 정리 (스펙 §2)
    setError(null);
    setStep("intro");
  }, []);

  if (step === "intro")
    return <IntroScreen onStart={() => setStep("guide")} onSkipToUpload={() => setStep("upload")} />;
  if (step === "guide")
    return <GuideSteps onDone={() => setStep("upload")} onBackToIntro={() => setStep("intro")} />;
  if (step === "upload" || step === "analyzing")
    return (
      <UploadDropzone
        busy={step === "analyzing"}
        error={error}
        onFile={handleFile}
        onBack={() => setStep("guide")}
      />
    );
  return result ? <ResultView result={result} onReset={reset} /> : null;
}
```

- [ ] **Step 3: IntroScreen (스펙 §3 STEP 0 — 카피·신뢰 카드·기능 강조 순서)**

```tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { loadHistory, type HistoryEntry } from "@/lib/playground/instagram/history";

const TRUST_CARDS = [
  { title: "로그인 없이 안전하게", body: "계정 아이디와 비밀번호를 입력하지 않아요." },
  { title: "공식 데이터로 정확하게", body: "인스타그램에서 직접 내려받은 파일을 분석해요." },
  { title: "업로드 후 바로 분석", body: "팔로워와 팔로잉 관계를 빠르게 확인해요." },
];

const FEATURES = [
  "1. 나만 팔로우하고 있는 계정 찾기",
  "2. 팔로워·팔로잉 날짜 확인",
  "3. @band_sustain 팔로우 기간 확인 및 명예의 전당 등록",
];

export default function IntroScreen(props: { onStart: () => void; onSkipToUpload: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => setHistory(loadHistory()), []);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Playground</p>
        <h1 className="font-display text-3xl font-black leading-tight">
          내 인스타 맞팔 현황,
          <br />
          파일 하나로 확인해 드려요
        </h1>
        <p className="text-[var(--color-text-muted)]">
          내가 팔로우하지만 나를 팔로우하지 않는 계정을 찾고,
          <br className="hidden md:block" /> 서로 언제부터 팔로우했는지도 확인해 보세요.
        </p>
      </header>

      <ul className="space-y-1 text-sm">
        {FEATURES.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <div className="grid gap-3 md:grid-cols-3">
        {TRUST_CARDS.map((c) => (
          <div key={c.title} className="border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold">{c.title}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
        <p>· 인스타그램 아이디와 비밀번호를 입력하지 않습니다.</p>
        <p>· 업로드한 ZIP 파일은 기기에서만 분석합니다.</p>
        <p>· 팔로워 및 팔로잉 목록은 서버에 저장하지 않습니다.</p>
        <p>· 명예의 전당 등록을 선택한 경우에만 필요한 일부 정보가 서버로 전송됩니다.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" className={buttonClasses("accent", "w-full")} onClick={props.onStart}>
          시작하기
        </button>
        <button
          type="button"
          className={buttonClasses("secondary", "w-full")}
          onClick={() => setShowHistory((v) => !v)}
        >
          지난 분석 내역
        </button>
        <Link
          href="/playground/instagram-follow/hall-of-fame"
          className="text-center text-sm underline underline-offset-4"
        >
          서스테인 팔로우 명예의 전당 보기
        </Link>
      </div>

      {showHistory && (
        <div className="border border-[var(--color-border)] p-4 text-sm">
          {history.length === 0 && <p className="text-[var(--color-text-muted)]">아직 분석 내역이 없어요.</p>}
          {history.map((h) => (
            <p key={h.analyzedAt} className="py-1">
              {new Date(h.analyzedAt).toLocaleDateString("ko-KR")} · 팔로워 {h.followerCount} · 팔로잉{" "}
              {h.followingCount} · 맞팔 아님 {h.notFollowingMeBackCount} ·{" "}
              {h.sustainFollowing ? "서스테인 팔로우 중" : "서스테인 미팔로우"}
            </p>
          ))}
          {history.length > 0 && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              분석 일시와 요약 수치만 이 브라우저에 저장돼요. 전체 목록은 저장하지 않아요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: GuideSteps (스펙 §4 STEP 1~5 온보딩 — 프로그레스 바/뒤로/건너뛰기/다음)**

```tsx
"use client";
import { buttonClasses } from "@/components/Button";

type GuideStep = {
  emoji: string;
  title: string;
  lines: string[];
  note?: string;
  link?: { label: string; href: string };
};

const STEPS: GuideStep[] = [
  {
    emoji: "1️⃣",
    title: "계정 센터 열기",
    lines: [
      "인스타그램 앱에서 내 프로필을 연 뒤",
      "우측 상단 메뉴 → 설정 및 활동 → 계정 센터로 이동해 주세요.",
    ],
    link: { label: "계정 센터 바로가기", href: "https://accountscenter.instagram.com/" },
    note: "버튼이 동작하지 않으면 인스타그램 앱에서 직접 이동해 주세요.",
  },
  {
    emoji: "2️⃣",
    title: "내 정보 및 권한 선택",
    lines: ["계정 센터에서", "'내 정보 및 권한' → '내 정보 내보내기'를 선택해 주세요."],
    note: "인스타그램 로그인 화면이 표시될 수 있어요.",
  },
  {
    emoji: "3️⃣",
    title: "기기로 내보내기",
    lines: [
      "'내보내기 만들기'를 누른 뒤 분석할 인스타그램 계정을 선택하고",
      "'기기로 내보내기'를 선택해 주세요.",
    ],
    note: "외부 서비스가 아니라 반드시 내 기기로 내려받아 주세요.",
  },
  {
    emoji: "4️⃣",
    title: "필요한 정보만 선택",
    lines: [
      "정보 맞춤 설정에서 '팔로워 및 팔로잉'만 선택해 주세요.",
      "기간은 '전체 기간', 형식은 'HTML'로 설정해 주세요.",
    ],
    note: "JSON이 아니라 HTML 형식으로 내려받아 주세요. 미디어 품질은 기본값이면 충분해요.",
  },
  {
    emoji: "5️⃣",
    title: "파일 내려받기",
    lines: [
      "인스타그램에서 파일 준비가 끝나면 알림이나 이메일이 도착합니다.",
      "파일을 기기에 내려받은 뒤 압축을 풀지 말고 ZIP 파일 그대로 업로드해 주세요.",
    ],
    note: "파일 준비에 수 분 이상 걸릴 수 있어요.",
  },
];

import { useState } from "react";

export default function GuideSteps(props: { onDone: () => void; onBackToIntro: () => void }) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="space-y-6">
      {/* 프로그레스 바 */}
      <div className="h-1 w-full bg-[var(--color-bg-muted)]">
        <div
          className="h-1 bg-[var(--color-accent)] transition-all"
          style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
        STEP {idx + 1} / {STEPS.length}
      </p>

      <div className="space-y-4 border border-[var(--color-border)] p-6 text-center">
        <p className="text-5xl" aria-hidden>
          {step.emoji}
        </p>
        <h2 className="font-display text-xl font-black">{step.title}</h2>
        {step.lines.map((l) => (
          <p key={l} className="text-sm text-[var(--color-text-muted)]">
            {l}
          </p>
        ))}
        {step.link && (
          <a
            href={step.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary", "w-full")}
          >
            {step.link.label}
          </a>
        )}
        {step.note && <p className="text-xs text-[var(--color-text-muted)]">{step.note}</p>}
        <p className="text-xs text-[var(--color-text-muted)]">
          인스타그램 앱 버전에 따라 메뉴 이름이나 위치가 조금 다를 수 있어요.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={buttonClasses("secondary")}
          onClick={() => (idx === 0 ? props.onBackToIntro() : setIdx(idx - 1))}
        >
          뒤로
        </button>
        <button
          type="button"
          className="text-sm text-[var(--color-text-muted)] underline underline-offset-4"
          onClick={props.onDone}
        >
          건너뛰기
        </button>
        <button
          type="button"
          className={buttonClasses("accent")}
          onClick={() => (isLast ? props.onDone() : setIdx(idx + 1))}
        >
          {isLast ? "업로드로" : "다음"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: UploadDropzone (스펙 §4 STEP 6 — 드래그앤드롭/파일 선택/zip만)**

```tsx
"use client";
import { useRef, useState, type DragEvent } from "react";
import { buttonClasses } from "@/components/Button";

export default function UploadDropzone(props: {
  busy: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) props.onFile(f);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-black">ZIP 파일 업로드</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        인스타그램에서 받은 ZIP 파일을 그대로 올려 주세요.
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label="ZIP 파일 선택"
        onClick={() => !props.busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !props.busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-[var(--color-accent)] bg-[var(--color-bg-muted)]" : "border-[var(--color-border)]"
        }`}
      >
        {props.busy ? (
          <p className="text-sm">분석 중이에요… 파일은 기기 밖으로 나가지 않아요.</p>
        ) : (
          <>
            <p className="text-4xl" aria-hidden>📦</p>
            <p className="text-sm font-semibold">여기를 눌러 파일을 선택하거나 끌어다 놓아 주세요</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              압축을 풀지 않은 .zip 파일을 업로드해 주세요.
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {props.error && (
        <div role="alert" className="border border-[var(--color-border-strong)] p-4 text-sm">
          {props.error}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        업로드한 ZIP 파일은 이 브라우저 안에서만 분석되고 서버로 전송되지 않아요.
      </p>

      <button type="button" className={buttonClasses("secondary")} onClick={props.onBack} disabled={props.busy}>
        뒤로
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 임시 ResultView 스텁으로 빌드 통과 (Task 13에서 교체)**

`src/components/playground/instagram/ResultView.tsx`:

```tsx
"use client";
import type { AnalysisResult } from "@/lib/playground/instagram/types";

export default function ResultView(props: { result: AnalysisResult; onReset: () => void }) {
  return <pre className="text-xs">{JSON.stringify(props.result.sustain, null, 2)}</pre>;
}
```

- [ ] **Step 7: 빌드 + DEV 화면 확인 후 커밋**

```bash
sudo -u ec2-user pnpm build && sudo -u ec2-user pm2 restart bandsustain-dev
# 브라우저: https://dev.bandsustain.com/playground/instagram-follow (intro→guide→upload 동작 확인)
sudo -u ec2-user git add src/app/playground/instagram-follow/page.tsx src/components/playground/instagram/
sudo -u ec2-user git commit -m "feat(instagram-follow): page with intro/guide/upload step machine"
```

---

### Task 13: ResultView + AccountList — 요약 카드·탭·검색·정렬·더보기

스펙 §6~§7. 기본 탭 = `나를 맞팔하지 않음`. "더 보기" 방식 페이지 처리(50개 단위)로 대량 DOM 방지.

**Files:**
- Modify(교체): `src/components/playground/instagram/ResultView.tsx`
- Create: `src/components/playground/instagram/AccountList.tsx`

- [ ] **Step 1: AccountList 구현**

```tsx
"use client";
import { useMemo, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import type { AccountRelation } from "@/lib/playground/instagram/types";

export type TabKey = "notFollowingMeBack" | "iDoNotFollowBack" | "mutuals" | "followers" | "following";
type SortKey = "recent" | "oldest" | "name" | "daysDesc" | "daysAsc";

const PAGE = 50;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "최근 팔로우한 순" },
  { key: "oldest", label: "오래 팔로우한 순" },
  { key: "name", label: "사용자명순" },
  { key: "daysDesc", label: "경과 일수 많은 순" },
  { key: "daysAsc", label: "경과 일수 적은 순" },
];

// 탭별 대표 날짜: 팔로워 탭은 상대가 나를 팔로우한 날, 그 외는 내가 팔로우한 날 우선
function primaryDate(a: AccountRelation, tab: TabKey): string | null {
  if (tab === "followers" || tab === "iDoNotFollowBack") return a.followerSince;
  return a.followingSince ?? a.followerSince;
}

function DateLine({ label, iso, raw }: { label: string; iso: string | null; raw: string | null }) {
  if (!iso) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        {label} · {raw ? `날짜 확인 불가 (${raw})` : "팔로우 날짜 확인 불가"}
      </p>
    );
  }
  const days = followDayCount(iso);
  return (
    <p className="text-xs text-[var(--color-text-muted)]">
      {label} {formatKoreanDate(iso)}
      {days !== null && <> · <span className="font-semibold text-[var(--color-text)]">{days.toLocaleString()}일째</span></>}
    </p>
  );
}

export default function AccountList({ accounts, tab }: { accounts: AccountRelation[]; tab: TabKey }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [limit, setLimit] = useState(PAGE);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? accounts.filter((a) => a.username.includes(q)) : [...accounts];
    const date = (a: AccountRelation) => primaryDate(a, tab) ?? "";
    const days = (a: AccountRelation) => {
      const d = primaryDate(a, tab);
      return d ? (followDayCount(d) ?? -1) : -1;
    };
    switch (sort) {
      case "recent":
        filtered.sort((a, b) => date(b).localeCompare(date(a)));
        break;
      case "oldest":
        filtered.sort((a, b) => date(a).localeCompare(date(b)));
        break;
      case "name":
        filtered.sort((a, b) => a.username.localeCompare(b.username));
        break;
      case "daysDesc":
        filtered.sort((a, b) => days(b) - days(a));
        break;
      case "daysAsc":
        filtered.sort((a, b) => days(a) - days(b));
        break;
    }
    return filtered;
  }, [accounts, query, sort, tab]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="사용자명 검색"
          className="w-full border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="border border-[var(--color-border)] px-3 py-2 text-sm"
          aria-label="정렬"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">표시할 계정이 없어요.</p>
      )}

      <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)]">
        {visible.slice(0, limit).map((a) => (
          <li key={a.username} className="space-y-1 p-4">
            <div className="flex items-center justify-between gap-2">
              <a
                href={a.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-semibold underline-offset-4 hover:underline"
              >
                @{a.username}
              </a>
              <a
                href={a.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("secondary", "shrink-0 px-3 py-1.5 text-xs normal-case tracking-normal")}
              >
                인스타그램에서 보기
              </a>
            </div>
            {a.isFollowing && (
              <DateLine label="내가 팔로우한 날" iso={a.followingSince} raw={a.followingSinceRaw} />
            )}
            {a.isFollower && (
              <DateLine label="나를 팔로우한 날" iso={a.followerSince} raw={a.followerSinceRaw} />
            )}
          </li>
        ))}
      </ul>

      {visible.length > limit && (
        <button type="button" className={buttonClasses("secondary", "w-full")} onClick={() => setLimit(limit + PAGE)}>
          더 보기 ({(visible.length - limit).toLocaleString()}개 남음)
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ResultView 본 구현으로 교체**

```tsx
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import type { AnalysisResult } from "@/lib/playground/instagram/types";
import AccountList, { type TabKey } from "./AccountList";
import SustainCard from "./SustainCard";

const TABS: { key: TabKey; label: string }[] = [
  { key: "notFollowingMeBack", label: "나를 맞팔하지 않음" },
  { key: "iDoNotFollowBack", label: "내가 맞팔하지 않음" },
  { key: "mutuals", label: "맞팔" },
  { key: "followers", label: "팔로워" },
  { key: "following", label: "팔로잉" },
];

export default function ResultView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const [tab, setTab] = useState<TabKey>("notFollowingMeBack");
  const r = result.relations;
  const counts: Record<TabKey, number> = {
    notFollowingMeBack: r.notFollowingMeBack.length,
    iDoNotFollowBack: r.iDoNotFollowBack.length,
    mutuals: r.mutuals.length,
    followers: r.followers.length,
    following: r.following.length,
  };

  return (
    <div className="space-y-6">
      {/* 부분 데이터/파싱 실패 안내 (스펙 §13) */}
      {!result.hasFollowing && (
        <p className="border border-[var(--color-border-strong)] p-3 text-xs">
          팔로잉 파일을 찾지 못해 맞팔 여부는 정확히 계산할 수 없어요. 팔로워 목록만 표시합니다.
        </p>
      )}
      {!result.hasFollowers && (
        <p className="border border-[var(--color-border-strong)] p-3 text-xs">
          팔로워 파일을 찾지 못해 관계 비교는 할 수 없어요. 팔로잉 목록만 표시합니다.
        </p>
      )}
      {result.parseFailedCount > 0 && (
        <p className="border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">
          인스타그램 파일 형식이 변경되어 {result.parseFailedCount}개 항목을 읽지 못했어요. 읽은 항목은 모두 표시합니다.
        </p>
      )}

      {/* 대표 강조 문구 + 요약 카드 (스펙 §7) */}
      {result.hasFollowers && result.hasFollowing && (
        <h2 className="font-display text-2xl font-black leading-snug">
          내가 팔로우하지만
          <br />
          나를 팔로우하지 않는 계정은{" "}
          <span className="text-[var(--color-accent)]">{counts.notFollowingMeBack.toLocaleString()}명</span>
          이에요.
        </h2>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["팔로워", counts.followers],
          ["팔로잉", counts.following],
          ["맞팔", counts.mutuals],
          ["나를 맞팔 안 함", counts.notFollowingMeBack],
          ["내가 맞팔 안 함", counts.iDoNotFollowBack],
        ].map(([label, n]) => (
          <div key={label as string} className="border border-[var(--color-border)] p-3 text-center">
            <p className="font-display text-xl font-black">{(n as number).toLocaleString()}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
          </div>
        ))}
      </div>

      <SustainCard sustain={result.sustain} />

      {/* 결과 탭 */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`border px-3 py-1.5 text-xs ${
              tab === t.key
                ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {t.label} {counts[t.key].toLocaleString()}
          </button>
        ))}
      </div>

      <AccountList key={tab} accounts={r[tab]} tab={tab} />

      <button type="button" className={buttonClasses("secondary", "w-full")} onClick={onReset}>
        새 파일로 다시 분석하기
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 임시 SustainCard 스텁으로 빌드 통과 (Task 14에서 교체)**

`src/components/playground/instagram/SustainCard.tsx`:

```tsx
"use client";
import type { AnalysisResult } from "@/lib/playground/instagram/types";

export default function SustainCard({ sustain }: { sustain: AnalysisResult["sustain"] }) {
  return <p className="text-xs">{sustain.following ? "서스테인 팔로우 중" : "서스테인 미팔로우"}</p>;
}
```

- [ ] **Step 4: 빌드 + 실측 ZIP으로 브라우저 확인 후 커밋**

```bash
sudo -u ec2-user pnpm build && sudo -u ec2-user pm2 restart bandsustain-dev
# 브라우저에서 실측 ZIP 업로드 → 팔로워 528 / 팔로잉 774 / 탭 수치·검색·정렬·더보기 확인
sudo -u ec2-user git add src/components/playground/instagram/
sudo -u ec2-user git commit -m "feat(instagram-follow): result summary, tabs, search/sort, load-more list"
```

---

### Task 14: SustainCard + HallOfFameForm — 팔로우 기간·등록 폼

스펙 §8~§9. 팔로우 중이면 시작일·N일째·등록 버튼, 아니면 팔로우 유도 카드.

**Files:**
- Modify(교체): `src/components/playground/instagram/SustainCard.tsx`
- Create: `src/components/playground/instagram/HallOfFameForm.tsx`

- [ ] **Step 1: SustainCard 본 구현**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { SUSTAIN_INSTAGRAM_URL, SUSTAIN_USERNAME } from "@/lib/playground/instagram/config";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import type { AnalysisResult } from "@/lib/playground/instagram/types";
import HallOfFameForm from "./HallOfFameForm";

export default function SustainCard({ sustain }: { sustain: AnalysisResult["sustain"] }) {
  const [showForm, setShowForm] = useState(false);

  if (!sustain.following) {
    return (
      <div className="space-y-3 border-2 border-[var(--color-text)] p-5">
        <p className="text-sm">
          아직 <strong>@{SUSTAIN_USERNAME}</strong>을 팔로우하지 않고 있어요.
          <br />
          서스테인의 새로운 음악과 소식을 인스타그램에서 만나보세요!
        </p>
        <a
          href={SUSTAIN_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("accent", "w-full")}
        >
          서스테인 인스타그램 팔로우하기
        </a>
        <p className="text-xs text-[var(--color-text-muted)]">
          방금 팔로우했다면 인스타그램 데이터를 새로 내려받은 뒤 다시 분석해 주세요.
        </p>
      </div>
    );
  }

  const days = sustain.since ? followDayCount(sustain.since) : null;
  return (
    <div className="space-y-3 border-2 border-[var(--color-accent)] p-5">
      {days !== null && sustain.since ? (
        <p className="font-display text-lg font-black">
          서스테인과 함께한 지 <span className="text-[var(--color-accent)]">{days.toLocaleString()}일째</span>예요!
        </p>
      ) : (
        <p className="font-display text-lg font-black">@{SUSTAIN_USERNAME}을 팔로우하고 있어요!</p>
      )}
      <p className="text-sm text-[var(--color-text-muted)]">
        {sustain.since
          ? `${formatKoreanDate(sustain.since)}부터 @${SUSTAIN_USERNAME}을 팔로우하고 있어요.`
          : `팔로우 시작일은 확인할 수 없었어요. (${sustain.sinceRaw ?? "날짜 확인 불가"})`}
      </p>
      {sustain.since ? (
        showForm ? (
          <HallOfFameForm followedAtIso={sustain.since} />
        ) : (
          <button type="button" className={buttonClasses("accent", "w-full")} onClick={() => setShowForm(true)}>
            명예의 전당에 등록하기
          </button>
        )
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          팔로우 시작일을 읽을 수 없어 명예의 전당 등록은 어려워요.
        </p>
      )}
      <Link
        href="/playground/instagram-follow/hall-of-fame"
        className="block text-center text-sm underline underline-offset-4"
      >
        명예의 전당 보러 가기
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: HallOfFameForm 구현**

```tsx
"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import { validateNickname } from "@/lib/playground/instagram/nickname";
import {
  getOrCreateBrowserToken,
  isRegisteredLocally,
  markRegisteredLocally,
} from "@/lib/playground/instagram/history";

export default function HallOfFameForm({ followedAtIso }: { followedAtIso: string }) {
  const followDate = followedAtIso.slice(0, 10); // "YYYY-MM-DD"
  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    isRegisteredLocally(followDate) ? "이 브라우저에서 이미 등록한 기록이 있어요." : null,
  );
  const [done, setDone] = useState(false);

  const submit = async () => {
    const nick = validateNickname(nickname);
    if (!nick.ok) {
      setMessage(nick.reason);
      return;
    }
    if (!agreed) {
      setMessage("개인정보 및 운영 정책에 동의해 주세요.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/playground/instagram-follow/hall-of-fame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nick.value,
          sustainFollowedAt: followDate,
          browserToken: getOrCreateBrowserToken(),
          agreedToPolicy: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        markRegisteredLocally(followDate);
        setDone(true);
        setMessage("명예의 전당에 등록됐어요!");
      } else {
        setMessage(data.message ?? "등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setMessage("네트워크 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="text-sm font-semibold">{message}</p>;

  return (
    <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
      <label className="block text-sm">
        명예의 전당에 표시할 닉네임
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="2~20자"
          className="mt-1 w-full border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-[var(--color-text-muted)]">
        닉네임은 직접 입력한 표시명이며 인스타그램 사용자명 인증값이 아니에요.
      </p>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
        <span>
          닉네임·팔로우 시작일이 서버에 저장되고 명예의 전당에 공개되는 것에 동의해요. 반복 등록 방지를 위해
          IP를 비식별 해시로만 저장해요.
        </span>
      </label>
      {message && (
        <p role="alert" className="text-xs text-[var(--color-text-muted)]">
          {message}
        </p>
      )}
      <button type="button" className={buttonClasses("accent", "w-full")} onClick={submit} disabled={busy}>
        {busy ? "등록 중…" : "등록하기"}
      </button>
      <p className="text-xs text-[var(--color-text-muted)]">
        명예의 전당 기록은 사용자가 제출한 인스타그램 내보내기 파일을 기준으로 등록됩니다.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 + 브라우저에서 등록 E2E (실측 ZIP → 등록 → 중복 안내) 후 커밋**

```bash
sudo -u ec2-user pnpm build && sudo -u ec2-user pm2 restart bandsustain-dev
sudo -u ec2-user git add src/components/playground/instagram/SustainCard.tsx src/components/playground/instagram/HallOfFameForm.tsx
sudo -u ec2-user git commit -m "feat(instagram-follow): sustain follow card and hall-of-fame registration form"
```

---

### Task 15: 명예의 전당 공개 페이지

**Files:**
- Create: `src/app/playground/instagram-follow/hall-of-fame/page.tsx`

- [ ] **Step 1: 서버 컴포넌트 구현 (DB 직접 조회 — API 우회 불필요, 경과 일수는 렌더 시 계산)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import { HOF_PAGE_SIZE } from "@/lib/playground/instagram/config";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import { listVisibleHof } from "@/lib/playground/instagram/hofDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "서스테인 팔로우 명예의 전당 | BAND SUSTAIN",
  description: "@band_sustain을 가장 오래 팔로우한 팬들의 명예의 전당",
};

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isInstagramFollowEnabled()) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listVisibleHof(page, HOF_PAGE_SIZE);
  const offset = (page - 1) * HOF_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(total / HOF_PAGE_SIZE));

  return (
    <main className="page-fade-in mx-auto w-full max-w-xl px-4 py-8 md:py-12">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Playground</p>
        <h1 className="font-display text-3xl font-black">서스테인 팔로우 명예의 전당</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          @band_sustain을 가장 오래 팔로우한 순서예요. 총 {total.toLocaleString()}명이 등록했어요.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          아직 등록된 기록이 없어요. 첫 번째 주인공이 되어보세요!
        </p>
      ) : (
        <ol className="divide-y divide-[var(--color-border)] border border-[var(--color-border)]">
          {items.map((it, i) => {
            const rank = offset + i + 1;
            const days = followDayCount(it.followedAt);
            return (
              <li key={it.id} className="flex items-center gap-4 p-4">
                <span className="font-display w-10 shrink-0 text-xl font-black">{rank}위</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{it.nickname}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatKoreanDate(it.followedAt)}부터
                    {days !== null && <> · <span className="font-semibold text-[var(--color-text)]">{days.toLocaleString()}일째</span></>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {lastPage > 1 && (
        <nav className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="underline underline-offset-4">이전</Link> : <span />}
          <span className="text-[var(--color-text-muted)]">{page} / {lastPage}</span>
          {page < lastPage ? <Link href={`?page=${page + 1}`} className="underline underline-offset-4">다음</Link> : <span />}
        </nav>
      )}

      <p className="mt-6 text-xs text-[var(--color-text-muted)]">
        명예의 전당 기록은 사용자가 제출한 인스타그램 내보내기 파일을 기준으로 등록됩니다. 닉네임은 등록자가
        직접 입력한 표시명이에요.
      </p>
      <Link href="/playground/instagram-follow" className="mt-4 block text-center text-sm underline underline-offset-4">
        내 맞팔 현황 분석하러 가기
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: 빌드 + 화면 확인 후 커밋**

```bash
sudo -u ec2-user pnpm build && sudo -u ec2-user pm2 restart bandsustain-dev
# https://dev.bandsustain.com/playground/instagram-follow/hall-of-fame
sudo -u ec2-user git add "src/app/playground/instagram-follow/hall-of-fame/"
sudo -u ec2-user git commit -m "feat(instagram-follow): public hall-of-fame ranking page"
```

---

### Task 16: 관리자 숨김/복구 화면

기존 admin (authed) 레이아웃이 세션을 강제하지만, server action에도 `readSession()` 재확인(rehearsal-studios actions.ts 패턴). IP 해시는 앞 10자만 표시 (스펙 §11).

**Files:**
- Create: `src/app/admin/(authed)/instagram-follow/actions.ts`
- Create: `src/app/admin/(authed)/instagram-follow/page.tsx`
- Modify: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: server actions**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth";
import { setHofVisibility } from "@/lib/playground/instagram/hofDb";

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

export async function hideEntry(formData: FormData) {
  await requireAuth();
  await setHofVisibility(Number(formData.get("id")), false);
  revalidatePath("/admin/instagram-follow");
}

export async function showEntry(formData: FormData) {
  await requireAuth();
  await setHofVisibility(Number(formData.get("id")), true);
  revalidatePath("/admin/instagram-follow");
}
```

- [ ] **Step 2: admin 페이지 (닉네임 검색 + 목록 + 숨김/복구)**

```tsx
import { adminListHof } from "@/lib/playground/instagram/hofDb";
import { followDayCount } from "@/lib/playground/instagram/followDays";
import { hideEntry, showEntry } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminInstagramFollowPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || null;
  const rows = await adminListHof(q);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-black">Instagram Follow 명예의 전당</h1>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="닉네임 검색"
          className="border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="border border-[var(--color-text)] px-4 py-2 text-sm">
          검색
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border-strong)] text-left">
            <th className="py-2 pr-2">ID</th>
            <th className="py-2 pr-2">닉네임</th>
            <th className="py-2 pr-2">팔로우 시작일</th>
            <th className="py-2 pr-2">일수</th>
            <th className="py-2 pr-2">등록일</th>
            <th className="py-2 pr-2">IP해시(앞10)</th>
            <th className="py-2 pr-2">상태</th>
            <th className="py-2">동작</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-2 pr-2">{r.id}</td>
              <td className="py-2 pr-2">{r.nickname}</td>
              <td className="py-2 pr-2">{r.sustainFollowedAt}</td>
              <td className="py-2 pr-2">{followDayCount(r.sustainFollowedAt) ?? "-"}</td>
              <td className="py-2 pr-2">{r.createdAt}</td>
              <td className="py-2 pr-2 font-mono text-xs">{r.ipHashPrefix}…</td>
              <td className="py-2 pr-2">{r.isVisible ? "공개" : "숨김"}</td>
              <td className="py-2">
                <form action={r.isVisible ? hideEntry : showEntry}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="underline underline-offset-4">
                    {r.isVisible ? "숨김" : "복구"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">기록이 없어요.</p>}
    </div>
  );
}
```

- [ ] **Step 3: AdminNav items 배열에 추가 (Deploy 항목 위)**

```typescript
  { href: "/admin/instagram-follow", label: "Instagram Follow" },
```

- [ ] **Step 4: 빌드 + admin 로그인 후 숨김/복구 동작 확인 → 숨긴 row가 공개 랭킹에서 빠지는지 확인 후 커밋**

```bash
sudo -u ec2-user pnpm build && sudo -u ec2-user pm2 restart bandsustain-dev
sudo -u ec2-user git add "src/app/admin/(authed)/instagram-follow/" src/components/admin/AdminNav.tsx
sudo -u ec2-user git commit -m "feat(instagram-follow): admin moderation (hide/restore, nickname search)"
```

---

### Task 17: 최종 검증 + dev push (⛔ 운영 반영 금지)

- [ ] **Step 1: 전체 테스트 + lint + build**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/*.test.ts   # 전부 PASS
sudo -u ec2-user pnpm lint
sudo -u ec2-user pnpm build
sudo -u ec2-user pm2 restart ecosystem.config.js --only bandsustain-dev
```

- [ ] **Step 2: 완료 조건(스펙 §18) 체크리스트 — 실측 ZIP으로 브라우저 E2E**

dev.bandsustain.com/playground/instagram-follow 에서:
1. /playground 랜딩에 "인스타 맞팔 분석기" 카드 노출 (BETA)
2. intro → guide 5단계(뒤로/건너뛰기/다음/프로그레스 바) → upload
3. 실측 ZIP 업로드 → 팔로워 528 / 팔로잉 774 / 각 탭 수치 정합 (mutuals + notFollowingMeBack = 774)
4. `나를 맞팔하지 않음` 기본 탭, 검색/정렬/더 보기 동작
5. 계정 클릭 → `https://www.instagram.com/{username}/` 새 창
6. SustainCard: "서스테인과 함께한 지 N일째" (2024-09-22 시작, 오늘 기준 일수), 명예의 전당 등록 → 랭킹 페이지 반영
7. 중복 등록 시 409 메시지 / 같은 브라우저 재시도 시 사전 안내
8. admin에서 숨김 → 랭킹에서 제외 → 복구
9. 오류 케이스: zip 아닌 파일 / 빈 zip(followers 없음) / 모바일 화면(DevTools 시뮬)
10. 새로고침 시 beforeunload 경고, 지난 분석 내역에 요약 표시

- [ ] **Step 3: dev push 후 정지**

```bash
sudo -u ec2-user git push origin dev
```

**⛔ 여기서 반드시 멈춤.** 사용자에게 dev 확인 요청 (https://dev.bandsustain.com/playground/instagram-follow). 운영 반영은 사용자가 명시적으로 요청한 경우에만 아래 진행:

- [ ] **(운영 반영 시에만) Step 4: PROD 반영 체크리스트**

```text
1. PROD .db_credentials 에 INSTAGRAM_HOF_SECRET 추가 (DEV와 다른 값으로 새로 생성, ec2-user 600)
2. PROD DB(BANDSUSTAIN)에 db/schema/023_instagram_follow.sql 적용
3. PROD ecosystem.config.js (skip-worktree) env 에 INSTAGRAM_FOLLOW_ENABLED: "1" 추가
4. bandsustain-dev: checkout main → merge dev → push origin main → checkout dev
5. bandsustain(운영): git pull origin main → pnpm install → pnpm build
6. pm2 restart ecosystem.config.js --only bandsustain   (--update-env 금지, ecosystem 재파싱 방식)
7. https://bandsustain.com/playground/instagram-follow 스모크
```

---

## 완료 후 보고 사항 (스펙 §19)

- **변경 파일**: §1 파일 구조 목록 전체
- **DB 변경**: `instagram_follow_hof` 테이블 신설 (DEV만, PROD는 운영 반영 시)
- **실행 테스트**: `pnpm exec tsx --test src/lib/playground/instagram/*.test.ts` (파서/정규화/날짜/관계/일수/닉네임/rate limit) + curl API 스모크 + 실측 ZIP 브라우저 E2E
- **로컬 테스트 방법**: dev.bandsustain.com 접속 → 실측 ZIP(`/var/www/html/_______site_BANDSUSTAIN/instagram-_mongsil_kim-2026-06-08-qNJMxQEM.zip`) 업로드
- **배포 시 필요한 env/secret**: `INSTAGRAM_FOLLOW_ENABLED=1` (ecosystem), `INSTAGRAM_HOF_SECRET` (.db_credentials — PROD는 별도 생성. 주의: PROD 키 변경 시 기존 ip_hash와 매칭 불가하므로 최초 설정 후 변경 금지)
- **한계/주의사항**:
  - 가이드 단계 이미지는 참고 이미지 자산이 없어 이모지+텍스트로 대체 (추후 스크린샷 교체 가능)
  - 날짜 로케일은 한국어/영어만 지원 (기타 로케일은 "날짜 확인 불가"로 표시되며 계정 목록은 정상)
  - rate limit은 in-memory (PM2 단일 프로세스 전제, 재시작 시 초기화)
  - IP 해시 기반 중복 방지는 최소 장치 (같은 와이파이 공유/VPN 우회 가능 — 스펙 명시 한계)
  - ZIP 위변조로 팔로우 날짜 조작 가능 → 화면 고지 + admin 숨김으로 대응
  - 광고 슬롯은 미구현 (추후 intro/result 사이에 독립 컴포넌트로 삽입 가능한 구조)

## Self-Review 결과

- **스펙 커버리지**: §1 서비스목적/기능강조순서→Task 12 Intro, §2 개인정보→클라 분석+메모리 정리(reset)+안내문구, §3 STEP0/지난내역→Task 11~12, §4 STEP1~6→Task 12 GuideSteps/UploadDropzone, §5 파일탐색/병합/정규화/날짜→Task 2~5·11, §6 집합→Task 6, §7 결과화면(요약/탭/카드/검색/정렬/더보기)→Task 13, §8 sustain 카드/1일째 규칙/미팔로우 유도→Task 7·14, §9 명예의전당/중복제한/닉네임규칙/한계고지→Task 8~10·14, §10 DB→Task 9, §11 API/관리자→Task 10·16, §12 보안(클라 처리/도메인 화이트리스트/rate limit/XFF)→Task 2·9·10, §13 오류처리→Task 11·12·13 (모든 에러 코드별 문구), §14 반응형/디자인→기존 디자인 시스템 사용, §15 구조→§0.7 결정, §16 파서요구→Task 4 (클래스 비의존), §17 테스트요구→각 Task TDD + Task 17 E2E, §18 완료조건→Task 17 Step 2, §19→§0 + 본 섹션.
- **타입 일관성**: `InstagramConnection`/`AccountRelation`/`AnalysisResult`(types.ts) ↔ parser/relations/analyzeZip/UI 시그니처 일치 확인. `followDayCount(iso, today?)` 모든 호출부 일치. `TabKey`는 `RelationResult` 키와 일치(`r[tab]` 인덱싱 성립).
- **플레이스홀더 없음**: 전 단계 실제 코드/명령/expected 출력 포함.
