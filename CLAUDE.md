@AGENTS.md

# bandsustain.com — Design System & Project Context

> 이 문서는 Claude Code에게 bandsustain 프로젝트의 **디자인 언어와 구현 가이드라인**을 전달하기 위한 파일이다. 작업 전 반드시 이 문서를 숙지하고, 새 컴포넌트/페이지를 만들 때 이 원칙을 지킨다.

---

## 1. 프로젝트 개요

- **도메인**: `bandsustain.com`
- **스택**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **목적**: 밴드/음악 관련 사이트. 서브도메인에 개인 연습용 프로젝트도 추가될 예정.
- **배포**: PM2 (port 3100) + Apache 리버스 프록시, Let's Encrypt SSL
- **DB**: MariaDB, credentials는 `/var/www/html/_______site_BANDSUSTAIN/.db_credentials`

---

## 2. 디자인 레퍼런스

**Reference**: [oasisinet.com](https://www.oasisinet.com/) (Oasis 공식 사이트)

**분위기 한 줄 요약**:
> **뉴스페이퍼/매거진 × 음악 브랜드** — 화이트 베이스 미니멀, 블랙 타이포 중심, 사진 편집권 강하게 살린 에디토리얼. 장식·그라디언트·그림자 배제, 타이포그래피와 여백이 디자인의 주인공.

### 디자인 DNA (반드시 지킬 원칙)

1. **Light is default, always** — 페이지 바탕색은 **화이트**. 다크는 옵션 토글(미구현)이지, 시스템 `prefers-color-scheme`을 따라 자동 전환하지 않는다. Hero·본문 섹션을 블랙으로 만들면 안 된다.
2. **Dark sections are exceptions, not the base** — 다크 배경은 **푸터**와 **mid-page splash 섹션(큰 라이브 사진 + 오버레이 카피)** 두 곳에만 허용. 메인 콘텐츠 영역은 항상 화이트.
3. **High-contrast monochrome base** — 화이트 바탕에 거의 블랙 텍스트. 회색 계조는 2~3단계만.
4. **Accent color is rare** — 액센트(오렌지 등)는 **페이지당 1~2개 요소에만**. 베이스 톤을 침범하지 않음.
5. **Typography-first** — 장식 없이 타이포의 사이즈·웨이트 대비만으로 위계를 만든다.
6. **Editorial link style** — 본문 텍스트 링크는 **underline** 기본. 파란색 링크 금지. 블랙 underline.
7. **Clean flat imagery** — 사진은 drop shadow, rounded corner, border 없이 그대로 배치. 제품은 플랫레이.
8. **Generous whitespace** — 여백이 후함. 섹션 간 수직 간격 크게.
9. **Rectangle, not rounded** — 버튼/입력/카드 대부분 직각. radius 쓰더라도 최소치 (2~4px).
10. **No gradients, no glassmorphism, no neon glow** — 디자인 트릭 금지. 단순한 면·선·글자로 구성.

---

## 3. 색상 시스템

### Light mode (기본)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-bg` | `#FFFFFF` | 페이지/카드 배경 |
| `--color-bg-muted` | `#F5F5F5` | 섹션 구분, disabled |
| `--color-text` | `#0A0A0A` | 본문·제목 |
| `--color-text-muted` | `#555555` | 메타·캡션 |
| `--color-border` | `#E5E5E5` | 연한 구분선 |
| `--color-border-strong` | `#0A0A0A` | 버튼 보더, 필터 pill |
| `--color-accent` | `#F05A28` | 네온 오렌지 포인트 (극소량 사용) |
| `--color-accent-ink` | `#FFFFFF` | 액센트 배경 위 텍스트 |

### Dark mode (향후 수동 토글용 — 현재 미구현)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-bg` | `#0A0A0A` | 배경 |
| `--color-bg-muted` | `#181818` | 섹션 구분 |
| `--color-text` | `#F5F5F5` | 본문 |
| `--color-text-muted` | `#A0A0A0` | 메타 |
| `--color-border` | `#2A2A2A` | 구분선 |
| `--color-border-strong` | `#F5F5F5` | 버튼 보더 |
| `--color-accent` | `#F05A28` | 그대로 |

> ⚠️ **`prefers-color-scheme: dark` 미디어 쿼리로 자동 전환하지 말 것.** 시스템 다크모드를 따라가면 레퍼런스 디자인이 깨진다. 다크는 반드시 사용자 토글로만 활성화.

### Tailwind v4 설정 (`src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-inter), "Helvetica Neue", Arial, sans-serif;
  --font-display: var(--font-archivo), "Inter", sans-serif;
}

:root {
  color-scheme: light;

  --color-bg: #ffffff;
  --color-bg-muted: #f5f5f5;
  --color-text: #0a0a0a;
  --color-text-muted: #555555;
  --color-border: #e5e5e5;
  --color-border-strong: #0a0a0a;
  --color-accent: #f05a28;
  --color-accent-ink: #ffffff;
}

/* NOTE: @media (prefers-color-scheme: dark) 블록 추가 금지.
   다크모드는 향후 수동 토글로만 활성화한다. */
```

### 색상 사용 규칙
- 액센트 오렌지는 **페이지당 1~2곳**. 버튼 전면, 태그 뱃지, 강조 카피의 하이라이트 등.
- 파란색·녹색 등 보조 컬러 금지 (이 브랜드는 모노크롬).
- 상태 컬러(성공/경고/에러)는 꼭 필요할 때만, 역시 저채도로.

---

## 4. 타이포그래피

### 폰트
- **본문/UI**: **Inter** (구글폰트, 무료). Oasis가 쓰는 Neue Haas Grotesk에 가장 가까운 무료 대체재.
- **디스플레이/제목**: **Archivo** 또는 **Archivo Narrow** (강한 blocky 느낌).
- **절대 금지**: 세리프, 손글씨체, 라이센스 불명 폰트.

```tsx
// src/app/layout.tsx
import { Inter, Archivo } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-display", weight: ["700", "900"] });
```

### 스케일 (Mobile → Desktop)

| 용도 | Mobile | Desktop | Weight | Tracking |
|------|--------|---------|--------|----------|
| Hero H1 | 40px | 72px | 900 | -0.02em |
| H1 page title | 32px | 48px | 800 | -0.015em |
| H2 section | 24px | 32px | 700 | -0.01em |
| H3 subsection | 18px | 20px | 700 | 0 |
| Body | 16px | 16px | 400 | 0 |
| Body lg | 18px | 18px | 400 | 0 |
| Meta / caption | 12px | 13px | 500 | 0.02em |
| Link (body) | inherit | inherit | 500 | inherit, **underline** |
| Button label | 14px | 14px | 600 | 0.04em uppercase |

### 타이포 규칙
- 제목은 꽉 찬 검정(`--color-text`), 서브헤더는 `--color-text-muted`.
- 본문 line-height는 `1.6`, 제목은 `1.1 ~ 1.2`.
- 모든 **텍스트 링크는 underline**. hover시 underline offset 크게 또는 끊어서 강조.
- Navigation/button 라벨의 uppercase는 선택. 대문자 쓰면 tracking 넓힌다.

---

## 5. 레이아웃

### Container
- Max-width: `1280px` (`max-w-7xl`)
- Horizontal padding: `24px` (mobile) → `48px` (desktop)
- 페이지 루트에서 `mx-auto` 로 중앙 정렬

### Grid
- **3-column grid** — 앨범·가사·제품 모두 이 패턴.
- Desktop: `grid-cols-3 gap-8`
- Tablet: `grid-cols-2 gap-6`
- Mobile: `grid-cols-1 gap-5`

### Vertical rhythm
- 섹션 간 간격: `py-16 md:py-24`
- 블록 간 간격: `mb-8 md:mb-12`

### Breakpoints (Tailwind 기본)
- `sm:` 640px / `md:` 768px / `lg:` 1024px / `xl:` 1280px

### Header / Footer
- **Header**: 상단 고정 안 함(sticky만 고려). 높이 ~72px. 좌측 로고 / 중앙~우측 네비 / 우측 소셜 아이콘.
- **Footer**: 다크(`bg-[--color-text]`) + 라이트 텍스트. 대형 히어로 이미지 위에 얹는 구조도 가능.
- Mobile header는 햄버거 오른쪽, 로고 왼쪽. 햄버거 탭시 **풀스크린 화이트 오버레이**, 왼쪽 정렬 큰 링크, 하단 소셜.

---

## 6. 컴포넌트 카탈로그

각 컴포넌트는 `src/components/` 아래 구현하고 Tailwind 유틸 클래스만 쓴다. CSS 모듈/styled-components 금지.

### Button
```tsx
// Primary — 블랙 솔리드
className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[--color-text] text-[--color-bg] border border-[--color-text] hover:bg-transparent hover:text-[--color-text] transition-colors"

// Secondary (outline)
className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[--color-text] border border-[--color-text] hover:bg-[--color-text] hover:text-[--color-bg] transition-colors"

// Accent (orange — 드물게 사용)
className="... bg-[--color-accent] text-[--color-accent-ink] border-[--color-accent] hover:opacity-90"
```

### Filter Pill (탭 필터)
```tsx
// 선택됨
"px-5 py-2 text-sm font-medium border border-[--color-text] bg-[--color-text] text-[--color-bg]"

// 비선택
"px-5 py-2 text-sm font-medium border border-[--color-text] bg-transparent text-[--color-text] hover:bg-[--color-bg-muted]"
```

### Card (제품/뉴스)
- **No shadow, no border-radius (or `rounded-none`)**
- 이미지 → 아래에 제목(`font-semibold`) → 메타 → View 버튼
- Card 자체는 bg 없음. 이미지 + 텍스트만.

### Navigation
- Desktop: 가로 텍스트 링크 리스트, `gap-6 md:gap-8`. 현재 페이지는 `underline`.
- Mobile: 햄버거 → fullscreen overlay, 좌측 정렬. 각 링크 `text-2xl md:text-4xl`, `py-3`. 하단에 소셜 아이콘 가로 배치.

### Breadcrumb
```
Home › Song Lyrics
```
- 화살표 `›` 구분자, 각 세그먼트 underline, muted text.

### Input & Search
- Border 1px solid `--color-border-strong`
- `rounded-none`, `px-4 py-2`
- Search 버튼은 Primary 버튼 스타일을 인풋 오른쪽에 붙임.

### Hero — 2가지 variant (상황에 따라 선택)

**A. Home / Landing Hero (기본, 라이트)** — oasisinet의 상단 홈 페이지 패턴
- **흰색 배경**, 블랙 텍스트. 섹션을 블랙으로 만들지 말 것.
- 작은 eyebrow 라벨 (uppercase, tracking-wide, **오렌지 액센트 허용**)
- 큰 display 제목 (`font-display`, `text-5xl md:text-7xl`, uppercase)
- 서브카피 + CTA 버튼 1~2개
- 하단에 **비디오/이미지 임베드 박스** (`aspect-video`, bg-muted, 재생 버튼 오버레이)

**B. Splash Banner (중간 삽입용, 다크)** — oasisinet의 "All around the world" 대형 라이브 사진 구간
- 풀블리드 이미지, 높이 `h-[70vh] md:h-[85vh]`
- 이미지 위 어두운 스크림 (`bg-black/30`)
- 오버레이 카피는 center + uppercase, `font-display`
- CTA 버튼 (Outline Ghost — 화이트 보더 + 화이트 텍스트)
- **페이지당 최대 1개**. 홈 Hero를 이걸로 대체하지 말 것.

### Media Embed
- YouTube/Spotify/Apple iframe을 `aspect-video` 또는 `aspect-square` wrapper에 넣는다.
- 플레이 버튼 오버레이는 흰 원 + 검은 삼각형.

---

## 7. 인터랙션 가이드

- **모든 transition은 `transition-colors` 또는 `transition-opacity` 200ms**. transform 애니메이션 남용 금지.
- **Hover 기본**: 링크는 underline offset 증가, 버튼은 배경/텍스트 색 반전.
- **Focus state**: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--color-accent] focus-visible:outline-offset-2`
- **Scroll**: parallax, 스크롤 연동 애니메이션 금지 (정적 느낌 유지).
- **Dark mode**: 현재 미구현. 추후 **수동 토글만** 지원 (라이트/다크/시스템 3단 푸터에 작게). `prefers-color-scheme` 자동 전환은 금지.

---

## 8. 이미지 가이드

- **톤**: 고대비, 컬러든 흑백이든 편집적으로. 필터 남발 금지.
- **비율**: hero `16:9` 또는 `21:9`, 카드 `1:1` 또는 `4:5`.
- **처리**: rounded 금지, shadow 금지, border 금지. 순수하게 배치.
- **alt 텍스트**: 반드시 작성.
- **Next.js `<Image>` 사용 필수** (성능). external 이미지는 `next.config.ts`의 `images.remotePatterns` 등록.

---

## 9. ⚠️ 저작권·복제 금지 사항

다음은 **절대 복제하거나 비슷하게 만들지 않는다**:

1. **Oasis 로고** (이탤릭 "oasis" + 검정 박스 프레임) — 고유 상표.
2. **"live '25" 오렌지 뱃지** — 투어 브랜딩 자산.
3. **밴드 사진 / 앨범아트 / 라이브 공연 사진** — 저작권자 있음.
4. **Oasis 특유의 텍스트 ("Definitely Maybe", 곡 제목, 가사)** — 가져오면 안 됨.
5. **Gallagher 형제 관련 링크·이미지·이름** 일체.

**참고만 허용되는 것**:
- 전반적인 레이아웃 구조 (3컬럼 그리드 등)
- 색상 철학 (화이트+블랙 + 오렌지 액센트)
- 타이포 위계와 링크 스타일
- 햄버거 메뉴의 풀스크린 처리 방식
- 버튼·카드의 사각형·플랫 스타일

> **원칙**: "Oasis 사이트의 **느낌**은 흡수하되, **자산은 만지지 않는다**." bandsustain만의 밴드/아티스트·콘텐츠로 채울 것.

---

## 10. 개발·배포 워크플로우

### 로컬 개발
```bash
cd /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain
pnpm dev
```

### 프로덕션 반영
```bash
# main 단일 브랜치 (DEV/PROD 분리 없음 — routines 방식)
git add -A && git commit -m "..."
git push origin main
pnpm build           # ⚠️ 필수 — 빌드 없이 restart하면 옛 번들 유지됨
pm2 restart bandsustain
```

### 확인
- 로그: `/var/www/html/_______site_BANDSUSTAIN/logs/`
- PM2 상태: `pm2 describe bandsustain`
- 접속: https://bandsustain.com

---

## 11. 새 페이지/컴포넌트 체크리스트

- [ ] 이 화면이 oasisinet의 어떤 페이지와 대응되는가? (참고 대상 명확히)
- [ ] 화이트 베이스 + 블랙 타이포 기본 규칙을 지키는가? (메인 섹션을 블랙으로 만들지 않았는가?)
- [ ] 다크 배경은 푸터 또는 mid-page splash 구간에만 쓰였는가?
- [ ] 직각 / 그림자 없음 / 그라디언트 없음을 지키는가?
- [ ] 타이포 스케일(섹션 4)을 벗어나지 않는가?
- [ ] 저작권 금지 자산을 쓰지 않는가?
- [ ] `prefers-color-scheme: dark` 자동 전환을 추가하지 않았는가?

애매하면 구현 전에 사용자에게 확인받는다. **디자인 일관성이 속도보다 우선**.
