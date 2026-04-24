# Quote 탭 디자인 — Spec

**작성일:** 2026-04-24
**대상:** bandsustain.com `/quote` 탭
**스코프:** public 렌더 UI + DB 스키마. 어드민·API 라우트는 별도 spec.

---

## 1. 컨텍스트

### 탭의 성격

`/quote` 는 "진짜 명언이 아닌 것을 대단한 명언처럼 올려놓는 공간" 이다. 부제는 다른 탭과 동일 포맷:

- EN: *These are words that don't really help in life*
- KO: *삶에 별로 도움은 되지 않을 명언들*

톤은 이미 songs 탭 안의 가짜 인용 section divider (`"좋은 곡을 듣는다는 것은, 좋은 삶을 살고 있다는 뜻입니다. — 서스테인 —"`) 에서 확장된다. 독립된 탭으로 빼면서 수량이 축적될 공간이 된다.

### 사이트 디자인 DNA (유지)

`CLAUDE.md` 에 정의된 원칙 그대로:

- 화이트 기본, 블랙 타이포, 오렌지 액센트 극소량
- 직각, 그림자/그라디언트 없음
- 타이포그래피·여백이 주인공 (editorial)
- 3-column grid 또는 매거진 스타일 세로 리듬
- members 탭과 같은 header 패턴 (`h1` + bilingual subtitle muted)

Quote 탭은 이 DNA 안에서 **portrait 를 동반한 zigzag editorial** 형식으로 구현된다. 다크/골드 장식·세리프 전환은 도입하지 않는다 (조크는 "권위적 프레이밍 옆의 실없는 문장" 대조만으로 성립).

---

## 2. 확정 결정

| 항목 | 결정 |
|------|------|
| 콘텐츠 소스 | DB (MariaDB) — 초기엔 수동 INSERT. 어드민 UI 는 별도 spec |
| 언어 처리 | 각 quote 는 한 언어(ko/en). 번역 있으면 optional 필드로 병기 |
| Attribution | 자유 텍스트. nullable. 멤버/가짜 유명인/익명 모두 수용 |
| 정렬 | `created_at DESC` 전체 노출. 페이지네이션 없음 |
| 레이아웃 | zigzag — portrait 4:5 좌/우 번갈아. 모바일은 세로 단일 컬럼 |
| 인터랙션 | permalink (`/quote#q{id}`) 앵커 + hover 시 복사 아이콘. 모달 없음 |
| 이미지 처리 | grayscale 필터 강제, 포트레이트 없으면 이니셜/심볼 플레이스홀더 |

---

## 3. 데이터 모델

```sql
CREATE TABLE quotes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  text            TEXT           NOT NULL,
  lang            ENUM('ko','en') NOT NULL,
  text_translated TEXT           NULL,
  attribution     VARCHAR(120)   NULL,
  portrait_url    VARCHAR(255)   NULL,
  published       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_published_created (published, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 필드 의미

- `text` — 원문. 필수. **따옴표는 저장하지 않는다**. 본문 저장은 순수 텍스트, 렌더 시 UI 가 curly quote(`“”`) 로 감싼다.
- `lang` — `'ko'` 또는 `'en'`. 본문 언어 태그. `<article>` 의 `lang` 속성에도 반영(a11y).
- `text_translated` — 번역본. NULL 이면 번역 줄 생략. 번역도 따옴표 없이 저장.
- `attribution` — 표기명. 예: `"서스테인, 밴드 리더"`, `"John, age unknown"`, `"anonymous"`, `NULL`. 렌더 시 `— {attribution} —` 로 감싼다 (em-dash 는 UI 에서 부착).
- `portrait_url` — Next.js public-root 기준 경로 (`/members/member01.jpg` 등) 또는 `https://` 절대 URL. NULL 이면 플레이스홀더 렌더. 절대 URL 쓰려면 `next.config.ts` `images.remotePatterns` 선등록 필요.
- `published` — 현재는 insert 시 항상 1. 미래 어드민이 draft staging 할 때 사용.
- `created_at` — 정렬·permalink 기준.

### 마이그레이션 파일

- `db/schema/001_quotes.sql` — 위 DDL 그대로 커밋. 수동 실행.
- `db/seed/quotes_seed.sql` — 초기 샘플 INSERT (3~5 건). songs 탭 상단 blockquote (`src/app/songs/page.tsx:44-51`) 의 `"좋은 곡을 듣는다는 것은, 좋은 삶을 살고 있다는 뜻입니다."` (lang=ko, attribution="서스테인") 한 건 포함 가능. 나머지 샘플은 구현 시 사용자가 확정.

---

## 4. 파일 구조

```
src/lib/db.ts                       (신규) mysql2 pool 싱글톤 + .db_credentials 로더
src/lib/quotes.ts                   (신규) getPublishedQuotes() 서버 전용 접근 함수
src/app/quote/page.tsx              (수정) 서버 컴포넌트로 재작성, ISR revalidate=60
src/components/QuoteRow.tsx         (신규) 한 row 렌더 + zigzag 로직
src/components/QuotePortrait.tsx    (신규) portrait_url 분기 (Image vs placeholder)
src/components/CopyPermalink.tsx    (신규, 유일한 "use client") # 버튼 + 클립보드 복사
db/schema/001_quotes.sql            (신규) 스키마 마이그레이션
db/seed/quotes_seed.sql             (신규) 초기 샘플 INSERT
```

모든 CSS 는 Tailwind 유틸만 — styled-components / CSS 모듈 금지 (CLAUDE.md 6.).

---

## 5. DB 레이어

### `src/lib/db.ts`

```ts
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

function loadCreds(): Record<string, string> {
  const path = process.env.DB_CREDENTIALS_PATH
    ?? "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

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
export const db: mysql.Pool = g.__bs_pool ?? (g.__bs_pool = createPool());
```

Next.js hot-reload 에서 풀이 재생성되지 않도록 `globalThis` 싱글톤 패턴.

### `src/lib/quotes.ts`

```ts
import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "./db";

export type Quote = {
  id: number;
  text: string;
  lang: "ko" | "en";
  text_translated: string | null;
  attribution: string | null;
  portrait_url: string | null;
  created_at: Date;
};

export async function getPublishedQuotes(): Promise<Quote[]> {
  const [rows] = await db.query<(Quote & RowDataPacket)[]>(
    `SELECT id, text, lang, text_translated, attribution, portrait_url, created_at
     FROM quotes
     WHERE published = 1
     ORDER BY created_at DESC, id DESC`
  );
  return rows;
}
```

### `.db_credentials` 파일

CLAUDE.md 에 명시된 `/var/www/html/_______site_BANDSUSTAIN/.db_credentials` 파일 포맷:

```
DB_HOST=localhost
DB_USER=<user>
DB_PASS=<password>
DB_NAME=BANDSUSTAIN
```

chmod 600. 구현 첫 단계에서 파일 존재 여부 확인, 없으면 DB 및 user 생성 후 기록.

### 의존성 추가

```
pnpm add mysql2
```

---

## 6. 페이지 · 컴포넌트 렌더

### `src/app/quote/page.tsx`

```tsx
import type { Metadata } from "next";
import { getPublishedQuotes } from "@/lib/quotes";
import QuoteRow from "@/components/QuoteRow";

export const revalidate = 60; // ISR: DB insert 후 최대 1분 내 반영

const description = "These are words that don't really help in life — 삶에 별로 도움은 되지 않을 명언들";

export const metadata: Metadata = {
  title: "Quote",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/quote",
    title: "Quote — Band Sustain",
    description,
    images: [{ url: "/slides/hero-c28a7f43.jpg", alt: "Quote" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quote — Band Sustain",
    description,
    images: ["/slides/hero-c28a7f43.jpg"],
  },
};

export default async function QuotePage() {
  const quotes = await getPublishedQuotes();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-12">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Quote
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          These are words that don&apos;t really help in life
          <br />
          삶에 별로 도움은 되지 않을 명언들
        </p>
      </header>

      {quotes.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          Nothing quotable yet. / 아직 인용할 만한 말이 없습니다.
        </p>
      ) : (
        <div>
          {quotes.map((q, i) => (
            <QuoteRow key={q.id} quote={q} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
```

### `QuoteRow`

- 한 quote 를 `<article id={`q${quote.id}`} lang={quote.lang} className="group ...">` 로 감쌈 (permalink 앵커 + a11y)
- `index % 2 === 1` 이면 `md:` 이상 breakpoint 에서 portrait/text 좌우 스위치. `md:` 미만에서는 index 무관하게 portrait 위 / text 아래 세로 정렬
- 데스크탑 그리드: `md:grid md:grid-cols-[160px_1fr] md:gap-8` / reverse 일 때 `md:grid-cols-[1fr_160px]` + text 컬럼 `md:text-right`
- 상단 구분선: 첫 row 는 `border-t border-[var(--color-text)]`, 나머지는 `border-t border-[var(--color-border)]`
- 본문 렌더: `<blockquote>` 안에 `“{text}”` (curly double quotes). 타이포 `font-display font-extrabold text-xl md:text-2xl leading-[1.18] tracking-[-0.01em]`
- 번역(있으면): 본문 아래 `<p lang={quote.lang === 'ko' ? 'en' : 'ko'} className="mt-3 text-sm md:text-base text-[var(--color-text-muted)]">“{text_translated}”</p>`
- Attribution(있으면): `mt-4 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]` 로 `— {attribution} —` (em-dash 는 UI 에서 부착)
- Permalink 아이콘: attribution 옆에 작게 `#` 버튼. hover 시 나타남 (`opacity-0 group-hover:opacity-100 transition-opacity`). 클릭 시 클립보드 복사 + "copied" 1.5초. 이 버튼만 클라이언트 컴포넌트(`CopyPermalink.tsx`, `"use client"`).
  - **접근성:** `aria-label="Copy permalink to this quote"`. 키보드 focus 에서도 visible 되도록 `focus-visible:opacity-100` 추가.

### `QuotePortrait`

- `portrait_url` 있음: `<Image src={portrait_url} alt={attribution ?? "portrait"} width={160} height={200} className="w-full aspect-[4/5] object-cover grayscale contrast-[1.05]" />`
  - `next.config.ts` 의 `images.remotePatterns` 에 등록된 도메인 외는 허용 안 함. 현재는 로컬 경로만 쓰므로 추가 설정 불필요
- `portrait_url` 없음: 회색 박스 `bg-[var(--color-bg-muted)]` + 중앙에 이니셜 또는 `★`
  - **익명 판정 (이 순서로 체크):**
    1. `attribution == null` → `★`
    2. `attribution.trim().toLowerCase()` 이 `"anonymous"` 또는 `"익명"` 과 정확히 일치 → `★`
    3. 그 외 → 이니셜 1 글자
  - **이니셜 추출:** `attribution.trim()` 의 첫 문자 (영문이면 `toUpperCase()`, 한글이면 그대로). 예: `"John, age unknown"` → `J`, `"이름 모를 할아버지"` → `이`, `"서스테인, 밴드 리더"` → `서`.
  - 스타일: `font-display font-black text-4xl md:text-5xl text-[var(--color-border-strong)] opacity-30`

### 모바일 동작

- `md:` 미만에서는 `grid-cols-1 gap-5`, portrait 가 항상 위. zigzag 무효화.
- Portrait 모바일 크기: `w-full aspect-[4/5]`. 데스크탑에서는 `md:w-40 md:h-auto`.

---

## 7. 인터랙션

### Permalink 앵커

- URL 은 `/quote#q{id}` 형태. 브라우저가 자동으로 해당 `<article id>` 로 스크롤.
- 서버 렌더된 HTML 에 모든 quote 가 박혀있어 앵커 타겟은 항상 존재.
- "Copy link" 아이콘은 attribution 옆에만 존재 — 호버 시 나타나고, 클릭 시 클립보드 복사 + 시각적 피드백. 다른 버튼/모달 없음.

### 스크롤

- `CLAUDE.md` 7. 원칙대로 smooth-scroll / parallax 금지. 브라우저 기본 anchor 점프 동작에 맡김 (`globals.css` 에 `scroll-behavior` 를 추가하지 않는다).

---

## 8. 에러 / 빈 상태

- **DB 빈 테이블** (`published=1` 없음): 위 page.tsx 의 empty state 문구 그대로.
- **DB 연결 실패 / 쿼리 throw**: `getPublishedQuotes` 가 그대로 throw → Next.js 루트 `error.tsx` (현재 없음) 또는 기본 500 페이지. `/quote` 전용 `error.tsx` 는 만들지 않는다.
- **잘못된 이미지 URL**: `next/image` 가 알아서 깨짐. 수동 관리 단계라 운영자가 INSERT 시 점검.

---

## 9. SEO / OG

- `title`: `"Quote"` (layout.tsx 의 `%s — Band Sustain` 템플릿과 결합)
- `description`: `"These are words that don't really help in life — 삶에 별로 도움은 되지 않을 명언들"` 한 줄
- OG image: 현재 hero 이미지 재사용. quote 별 OG 이미지는 이번 스코프 아님.

---

## 10. 배포 / 검증

### 배포 플로우 (CLAUDE.md 10. 그대로)

```bash
pnpm add mysql2
# (1회) DB + user + .db_credentials 파일 셋업, 001_quotes.sql 실행, seed 데이터 INSERT
git add -A && git commit -m "Add quote tab with DB-backed content"
git push origin main
pnpm build         # 빌드 에러 확인
pm2 restart bandsustain
curl -I https://bandsustain.com/quote   # 200 OK 확인
```

### 수동 검증 체크리스트

- `/quote` 최초 접근 200
- 샘플 3~5 건 중 zigzag 가 실제로 적용됨 (data 1, 3, 5 좌측 portrait / data 2, 4 우측 portrait)
- 포트레이트 있는 row 와 없는 row (플레이스홀더) 둘 다 포함해서 테스트
- `text_translated` 있음/없음 둘 다 렌더 확인
- `attribution` null 인 row 에서 `— —` 가 나오지 않는지 (attribution 줄 자체 생략)
- 모바일 폭(~375px) 에서 세로 단일 컬럼으로 자연 정렬
- `/quote#q3` 로 직접 접근하면 해당 row 로 스크롤
- Hover 시 `#` 아이콘 노출 + 클릭 시 클립보드 복사 확인
- 브라우저 콘솔 에러/워닝 0
- `pnpm build` 성공

---

## 11. 범위 밖 (명시적으로 제외)

이 spec 에 **포함되지 않는 것들** — 모두 별도 spec 으로 미룸:

- 어드민 CRUD 페이지 / 인증 / NextAuth 등
- `/api/quotes` REST API (현재는 서버 컴포넌트가 직접 DB 접근)
- 페이지네이션 / 무한 스크롤 / 필터 / 태그 / 검색
- 모달 상세 보기 / 개별 quote 라우트 (`/quote/{id}`)
- quote-per-quote OG 이미지 생성
- 자동화 테스트 (Vitest / Playwright) — 현재 프로젝트 베이스라인 없음
- 다크모드 전환 — quote 탭은 사이트 전체 다크모드 도입 시 일괄 적용
- Quote 좋아요 / 코멘트 / 공유 집계

---

## 12. 의존성 정리

신규 추가:

- `mysql2` (prod dep)

스키마 요구사항:

- MariaDB 에 `BANDSUSTAIN` 데이터베이스 존재 (없으면 생성)
- `BANDSUSTAIN.quotes` 테이블 생성 (001_quotes.sql)
- `.db_credentials` 파일 (chmod 600)

---

## 13. 다음 단계

이 spec 승인 후:

1. `writing-plans` skill 로 구현 플랜(Task 분해) 작성
2. 플랜 기반 구현 — 실 코드 작성 시점에서 DB 계정 준비 포함
3. 구현 완료 후 별도 어드민 spec 착수 시점 재결정
