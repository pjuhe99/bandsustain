# PLAYGROUND 탭 — 설계 문서

날짜: 2026-05-14
범위: bandsustain.com 상단 네비게이션에 PLAYGROUND 탭 신설 + `/playground` 페이지(기능 모음 리스트) + 첫 카드 4장(전부 Coming Soon). 생성기 본체(`/playground/band-name-generator` 등)는 다음 세션.

## 1. 목적

- 방문자가 가볍게 즐길 수 있는 테스트/생성기/랜덤 콘텐츠를 모아두는 공간.
- 밴드 홍보보다 "작은 놀이터" 톤. 방문자가 도구를 쓰러 들어왔다가 자연스럽게 서스테인을 알게 하는 흐름.
- 카드형 UI로 기능이 점진적으로 추가될 수 있는 구조.

## 2. 비목적 (out of scope, 이번 세션)

- 밴드 이름 생성기 본체 페이지 동작 (현재는 카드만, body는 Coming Soon).
- 노래 취향 테스트, 오늘의 가사 카드, 랜덤 감성 문장 등 후속 기능 본체.
- 어드민에서 PLAYGROUND 카드를 토글하는 기능 (필요해지면 별도 spec).

## 3. 디자인 톤

bandsustain CLAUDE.md의 strict한 매거진 모노크롬 DNA는 그대로 유지한다. 즉:

- 직각 사각형, 그림자/그라디언트 없음.
- 화이트 베이스, 블랙 타이포, 블루 액센트는 절제.
- 타이포그래피 + 여백으로만 위계 표현.

**놀이 분위기는 디자인이 아니라 카피로만 부여한다.** 카드 eyebrow와 description의 문장을 가볍게/장난스럽게 쓰되, 컴포넌트 외형은 사이트 다른 페이지(Live, News)와 동일한 어휘.

## 4. 구조

### 4.1 파일

| 파일 | 역할 |
|------|------|
| `src/lib/playground.ts` | feature 데이터 배열의 단일 source. 새 기능은 이 배열에 항목 추가만으로 등장. |
| `src/app/playground/page.tsx` | `/playground` 페이지. metadata + intro + 카드 그리드. |
| `src/components/Nav.tsx` | `navLinks` 배열에 `{ href: "/playground", label: "Playground" }` 항목 추가 (마지막). |

### 4.2 데이터 모델 (`src/lib/playground.ts`)

```ts
export type PlaygroundFeature = {
  slug: string;
  title: string;
  description: string;
  cta: string;          // 활성일 때 버튼 라벨
  href?: string;        // 정의되면 활성 카드 (이 경로로 링크), 없으면 Coming Soon
  eyebrow?: string;     // 카드 상단 작은 라벨 (장난스러운 분류)
};

export const playgroundFeatures: PlaygroundFeature[] = [
  {
    slug: "band-name-generator",
    title: "밴드 이름 생성기",
    description: "몇 가지 취향을 고르면 나만의 인디밴드 이름을 만들어드려요.",
    cta: "이름 만들러 가기",
    eyebrow: "이상한 도구",
    // href 없음 → 현재 Coming Soon. 본체 구현 시 href: "/playground/band-name-generator" 추가.
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

활성 카드 vs Coming Soon 카드의 차이는 `href` 한 필드로만 결정한다. 향후 PROD에서 생성기 본체를 배포할 때는 해당 항목에 `href` 한 줄 추가하면 끝.

### 4.3 페이지 레이아웃 (`src/app/playground/page.tsx`)

`Live` 페이지와 동일한 컨테이너 패턴:

```
<section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
  <header className="mb-12 md:mb-16">
    <h1>PLAYGROUND</h1>              {/* font-display font-black uppercase tracking-tight text-4xl md:text-6xl */}
    <p className="mt-6 text-lg text-[var(--color-text-muted)] max-w-2xl">
      서스테인이 만든 작은 놀이터. 이상하고 귀엽고 쓸데없지만 묘하게 즐거운 것들을 모아둔 공간입니다.
    </p>
  </header>

  <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
    {playgroundFeatures.map(f => <PlaygroundCard key={f.slug} feature={f} />)}
  </ul>
</section>
```

- SSG로 두고 `dynamic` 지정 없음 (정적 데이터).
- `metadata` export: title "Playground — Band Sustain", description은 페이지 intro 문장 사용. OG는 기존 `/slides/hero-b4d9e516.jpg` 재사용.

### 4.4 카드 마크업 (페이지 파일 안 inline 컴포넌트로 충분)

활성 (`href` 있음):

```
<li className="border border-[var(--color-border)] p-6 md:p-8 flex flex-col gap-4">
  {eyebrow && <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{eyebrow}</span>}
  <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight">{title}</h2>
  <p className="text-[var(--color-text-muted)] flex-1">{description}</p>
  <Link href={href} className={buttonClasses("primary")}>{cta}</Link>
</li>
```

Coming Soon (`href` 없음):

```
<li className="border border-[var(--color-border)] p-6 md:p-8 flex flex-col gap-4">
  {eyebrow && <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{eyebrow}</span>}
  <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight">{title}</h2>
  <p className="text-[var(--color-text-muted)] flex-1">{description}</p>
  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
    <span className="inline-block w-2 h-2 bg-[var(--color-border-strong)]" aria-hidden /> 곧 공개
  </span>
</li>
```

- `Button.tsx`의 `buttonClasses("primary")`를 그대로 사용해 다른 페이지 버튼과 시각 일관성 유지.
- 카드 자체 hover 효과 없음 (CLAUDE.md의 "no shadow/no rounded/transform 남용 금지" 원칙).
- Coming Soon 라벨은 작은 사각형 dot + uppercase로 표현 (블루 액센트 사용하지 않음 — 액센트는 페이지당 1~2개 원칙 보호).

### 4.5 Nav 변경 (`src/components/Nav.tsx`)

`navLinks` 배열 끝에 한 줄 추가:

```ts
const navLinks = [
  { href: "/members", label: "Members" },
  { href: "/songs", label: "Our Songs" },
  { href: "/quote", label: "Quote" },
  { href: "/live", label: "Live" },
  { href: "/news", label: "News" },
  { href: "/playground", label: "Playground" },  // 신규
];
```

데스크탑/모바일 모두 이 배열을 공유하므로 한 줄 추가로 두 곳 동시 반영.

## 5. 반응형

- Mobile (`< md`): 1열, 카드 세로 stack, padding `p-6`.
- Tablet (`md`): 2열, `gap-8`.
- Desktop (`lg+`): 3열 (현재 카드 4개라 마지막 줄은 1개만 들어감 — 자연스러움).

이 그리드는 `Songs`/`News` 그리드와 동일한 어휘.

## 6. 테스트 / 검증

수동 시각 검증으로 충분 (기존 페이지들도 별도 vitest 없음). 체크 포인트:

- [ ] 네비게이션에서 Playground 클릭 시 `/playground` 진입.
- [ ] 데스크탑 헤더, 모바일 햄버거 메뉴 양쪽에 Playground 노출.
- [ ] 카드 4장 표시: 밴드 이름 생성기 (Coming Soon), 노래 취향 테스트 (Coming Soon), 오늘의 가사 카드 (Coming Soon), 랜덤 감성 문장 (Coming Soon).
- [ ] 모바일 1열 / 태블릿 2열 / 데스크탑 3열로 그리드 변환.
- [ ] 카드에 그림자/둥근 모서리/그라디언트 없음.
- [ ] 블루 액센트 컬러 미사용 (Coming Soon 라벨이 액센트로 빠지지 않음).
- [ ] `pnpm build` 통과, `pm2 restart bandsustain` 후 https://bandsustain.com/playground 정상.

## 7. 향후 확장

생성기 본체 작업 시:
1. `src/app/playground/band-name-generator/page.tsx` 생성.
2. `src/lib/playground.ts` 의 해당 항목에 `href: "/playground/band-name-generator"` 추가.
3. 카드는 자동으로 활성 상태로 전환됨 (데이터 한 줄 변경만으로 활성화).

다른 기능 추가도 동일 패턴 (페이지 + 배열 항목 추가).

## 8. 변경 파일 요약

- `src/components/Nav.tsx` — 한 줄 추가.
- `src/lib/playground.ts` — 신규.
- `src/app/playground/page.tsx` — 신규.

신규 라우트 1개, 컴포넌트 신규 0개 (inline), 컴포넌트 수정 1개.
