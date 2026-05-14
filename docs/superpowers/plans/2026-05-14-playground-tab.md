# PLAYGROUND 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bandsustain.com 상단 네비게이션에 PLAYGROUND 탭을 추가하고, `/playground` 페이지에서 데이터 배열 기반의 기능 카드 4장(모두 Coming Soon)을 노출한다.

**Architecture:** 데이터 단일 source(`src/lib/playground.ts`)에 feature 배열을 두고, `/playground` 페이지가 이 배열을 그대로 그리드로 렌더. 카드의 활성/비활성은 `href` 필드 유무로 결정 → 본체 구현 시 한 줄 추가만으로 활성화. 사이트 디자인 DNA(strict 모노크롬, 직각, 그림자 없음)는 그대로 유지하고 카피 톤으로만 장난기 부여.

**Tech Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. PM2 (port 3100). 빌드: `pnpm build`, 재시작: `pm2 restart bandsustain`.

**Spec:** [`docs/superpowers/specs/2026-05-14-playground-tab-design.md`](../specs/2026-05-14-playground-tab-design.md)

---

## File Structure

| 파일 | 역할 | 작업 |
|------|------|------|
| `src/lib/playground.ts` | feature 데이터 배열 (단일 source) | Create |
| `src/app/playground/page.tsx` | `/playground` 페이지 (metadata + intro + 카드 그리드) | Create |
| `src/components/Nav.tsx` | nav 배열에 Playground 추가 | Modify (1 line) |

---

### Task 1: Feature 데이터 모듈 생성

**Files:**
- Create: `src/lib/playground.ts`

- [ ] **Step 1: 파일 작성**

`src/lib/playground.ts`:

```ts
export type PlaygroundFeature = {
  slug: string;
  title: string;
  description: string;
  cta: string;
  href?: string;
  eyebrow?: string;
};

export const playgroundFeatures: PlaygroundFeature[] = [
  {
    slug: "band-name-generator",
    title: "밴드 이름 생성기",
    description: "몇 가지 취향을 고르면 나만의 인디밴드 이름을 만들어드려요.",
    cta: "이름 만들러 가기",
    eyebrow: "이상한 도구",
  },
  {
    slug: "song-taste-test",
    title: "서스테인 노래 취향 테스트",
    description: "다섯 가지 질문에 답하면 어울리는 서스테인 트랙을 골라드려요.",
    cta: "테스트 시작",
    eyebrow: "취향 진단",
  },
  {
    slug: "daily-lyric-card",
    title: "오늘의 가사 카드",
    description: "서스테인 가사 한 줄을 카드로 받아보세요. 매일 바뀝니다.",
    cta: "오늘 카드 받기",
    eyebrow: "매일 변하는",
  },
  {
    slug: "random-mood-line",
    title: "랜덤 감성 문장",
    description: "버튼을 누르면 의미 있는 듯 없는 듯 한 문장이 튀어나옵니다.",
    cta: "한 줄 뽑기",
    eyebrow: "랜덤 생성",
  },
];
```

- [ ] **Step 2: 타입 체크**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm tsc --noEmit`
Expected: no errors (or unchanged from baseline)

---

### Task 2: `/playground` 페이지 생성

**Files:**
- Create: `src/app/playground/page.tsx`

- [ ] **Step 1: 페이지 파일 작성**

`src/app/playground/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { playgroundFeatures, type PlaygroundFeature } from "@/lib/playground";

const description =
  "서스테인이 만든 작은 놀이터. 이상하고 귀엽고 쓸데없지만 묘하게 즐거운 것들을 모아둔 공간입니다.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = {
  title: "Playground",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/playground",
    title: "Playground — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Playground" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playground — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default function PlaygroundPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-12 md:mb-16">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl">
          Playground
        </h1>
        <p className="mt-6 text-lg text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
          {description}
        </p>
      </header>

      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {playgroundFeatures.map((f) => (
          <PlaygroundCard key={f.slug} feature={f} />
        ))}
      </ul>
    </section>
  );
}

function PlaygroundCard({ feature }: { feature: PlaygroundFeature }) {
  const { title, description, cta, href, eyebrow } = feature;

  return (
    <li className="border border-[var(--color-border)] p-6 md:p-8 flex flex-col gap-4">
      {eyebrow && (
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight">
        {title}
      </h2>
      <p className="text-[var(--color-text-muted)] flex-1 leading-relaxed">
        {description}
      </p>
      {href ? (
        <Link href={href} className={buttonClasses("primary", "self-start")}>
          {cta}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)] self-start">
          <span
            className="inline-block w-2 h-2 bg-[var(--color-border-strong)]"
            aria-hidden
          />
          곧 공개
        </span>
      )}
    </li>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm tsc --noEmit`
Expected: no errors

---

### Task 3: Nav에 Playground 링크 추가

**Files:**
- Modify: `src/components/Nav.tsx:7-13`

- [ ] **Step 1: `navLinks` 배열 끝에 한 줄 추가**

`src/components/Nav.tsx`에서

```ts
const navLinks = [
  { href: "/members", label: "Members" },
  { href: "/songs", label: "Our Songs" },
  { href: "/quote", label: "Quote" },
  { href: "/live", label: "Live" },
  { href: "/news", label: "News" },
];
```

를 아래로 변경:

```ts
const navLinks = [
  { href: "/members", label: "Members" },
  { href: "/songs", label: "Our Songs" },
  { href: "/quote", label: "Quote" },
  { href: "/live", label: "Live" },
  { href: "/news", label: "News" },
  { href: "/playground", label: "Playground" },
];
```

- [ ] **Step 2: 타입 체크**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm tsc --noEmit`
Expected: no errors

---

### Task 4: 빌드 + 배포 검증

**Files:** 없음 (로컬 빌드 + PM2 재시작 + curl 스모크)

- [ ] **Step 1: 프로덕션 빌드**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm build`
Expected: 빌드 성공, 출력에 `/playground` 라우트가 SSG(`○`)로 표시됨

- [ ] **Step 2: PM2 재시작**

Run: `sudo -u ec2-user pm2 restart bandsustain`
Expected: status `online`

- [ ] **Step 3: `/playground` 응답 확인**

Run: `curl -s -o /dev/null -w '%{http_code}\n' https://bandsustain.com/playground`
Expected: `200`

- [ ] **Step 4: 본문 핵심 문구 + nav 링크 검증**

Run:
```bash
curl -s https://bandsustain.com/playground | grep -E '(Playground|작은 놀이터|밴드 이름 생성기|곧 공개)' | head -20
```
Expected: 4개 패턴 모두 매치

Run:
```bash
curl -s https://bandsustain.com/ | grep -o 'href="/playground"'
```
Expected: 최소 1개 매치 (홈 페이지 nav에 링크 존재)

---

### Task 5: Commit + push

**Files:** 없음 (git만)

- [ ] **Step 1: 변경 파일 확인**

Run: `cd /root/bandsustain/public_html/bandsustain && git status --short`
Expected:
```
?? src/app/playground/
?? src/lib/playground.ts
 M src/components/Nav.tsx
```

- [ ] **Step 2: stage**

Run:
```bash
cd /root/bandsustain/public_html/bandsustain && \
git add src/components/Nav.tsx src/lib/playground.ts src/app/playground/
```

- [ ] **Step 3: commit**

Run:
```bash
cd /root/bandsustain/public_html/bandsustain && \
git -c user.name='pjuhe99' -c user.email='soritunenglish@gmail.com' commit -m "$(cat <<'EOF'
feat(playground): /playground tab with 4 coming-soon feature cards

Adds PLAYGROUND nav entry and a data-driven card grid. Cards activate
by adding `href` to their entry in src/lib/playground.ts; no body
implementations yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: push**

Run: `cd /root/bandsustain/public_html/bandsustain && git push origin main`
Expected: push 성공

---

## Self-Review

**Spec coverage:**
- Nav 추가 → Task 3 ✓
- `/playground` 페이지 → Task 2 ✓
- intro 문구 → Task 2 (description 상수) ✓
- 기능 카드 영역 + 4장 → Task 2 (grid + 4 features in Task 1) ✓
- 밴드 이름 생성기 카드 (description + CTA) → Task 1 데이터에 포함, Task 2 카드가 렌더 ✓
- Coming Soon 후속 3종 → Task 1 데이터 ✓
- 배열 기반 확장 구조 → Task 1 `playgroundFeatures` + Task 2 `.map()` ✓
- 모바일 반응형 → Task 2 grid breakpoints (1/2/3 col) ✓
- 디자인 톤 (strict DNA, 카피만 장난) → 카드 마크업이 border-only 직각, eyebrow/description 카피만 가벼움 ✓

**Placeholder scan:** 없음. 모든 step에 실제 코드/명령 포함.

**Type consistency:** `PlaygroundFeature` 타입(Task 1) + import(Task 2) + 필드명 5개(`title/description/cta/href/eyebrow`) 일치. `buttonClasses` signature는 기존 `src/components/Button.tsx`에 정의된 것 그대로 사용.
