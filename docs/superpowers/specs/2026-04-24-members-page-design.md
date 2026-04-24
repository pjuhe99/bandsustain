# Members 페이지 디자인 스펙

**작성일**: 2026-04-24
**대상 파일**: `/members` 라우트 (현재 "Coming soon" 자리표시자 상태)
**스택**: Next.js 16 App Router + Tailwind v4 + TypeScript

---

## 1. 목적

밴드 멤버 9명(늘어나고 줄어들 수 있음)을 한 페이지에 프로필 카드 형태로 소개한다. 각 멤버에 대해 프로필 사진, 한글/영어 이름, 밴드 포지션, Favorite Artist, Favorite Song을 보여준다.

sustain의 에디토리얼 모노크롬 톤(레퍼런스: oasisinet.com)을 유지하면서, 다른 탭(Songs, Quote, Live 등)보다 인터랙티브한 "한 포인트" 재미 요소를 준다.

---

## 2. 인터랙션 — 호버/탭 리빌

### 기본 상태 (photo state)
- 정사각(1:1) 프로필 사진이 카드 전체를 채움
- 사진 좌하단에 영문 이름(Archivo Black, uppercase) + 한글 이름(작게) 흰 글자로 오버레이
- 사진 하단 ~45% 영역에 **검정 그라디언트 스크림** (`linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))`) — 이름 가독성 보장
  - ⚠️ design system의 "no gradients" 원칙의 예외. 장식 목적이 아니라 **사진 위 텍스트 가독성** 목적이므로 허용. 이 용도 외에는 그라디언트 추가 금지.
- 모바일에서만: 우상단 검정 사각 "Tap" 뱃지(흰 글자, 직각, `text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-1`)

### 오픈 상태 (reveal state)
- 카드 전체를 덮는 `--color-accent`(#F05A28) 오버레이
- 오버레이 내용 (좌하단 정렬, 아래에서 위로):
  1. 포지션 라벨 (uppercase, tracking-wide, 작게, opacity 90%)
  2. 영문 이름 (Archivo Black, uppercase, 크게)
  3. 한글 이름 (작게, opacity 90%)
  4. 1px 흰 구분선(opacity 40%)
  5. Favorite Artist — "Favorite Artist" 라벨(uppercase, 매우 작음, opacity 75%) + 값
  6. Favorite Song — "Favorite Song" 라벨 + 값

### 트리거
- **데스크톱(`md:` 이상)**: 순수 CSS — `:hover` / `:focus-visible` 에서만 오픈. JS state의 `isOpen`은 무시됨 (`max-md:` 으로 게이팅)
- **모바일/태블릿(`md:` 미만)**: 탭(클릭) 토글. `isOpen` state로만 제어. 한 번에 한 카드만 오픈(다른 카드 탭 시 이전 카드 자동 닫힘)

> 주의: 데스크톱에서 클릭 시에도 `onClick`은 동작해 state가 바뀌지만, 시각 효과는 hover로만 제어되므로 state 값은 무해하게 무시됨. 이렇게 분리한 이유 — `data-[open=true]`가 데스크톱에서도 반영되면 hover-out 후에도 오버레이가 남아 버리기 때문.

### 전환
- opacity 페이드, 200ms, `transition-opacity`
- ⚠️ design system 규칙: transform 애니메이션 금지. 슬라이드·스케일 없이 단순 페이드

### 액센트 사용량 준수
- 언제든 오렌지 오버레이는 최대 1개만 노출 (데스크톱은 단일 hover, 모바일은 단일 open 제약)
- 따라서 "페이지당 액센트 1~2곳" 디자인 원칙 유지

---

## 3. 그리드 & 레이아웃

| 브레이크포인트 | 열 수 | gap | 카드 크기(대략) |
|---|---|---|---|
| Mobile (기본) | 1 | 14px (`gap-4`) | ~320px² |
| Tablet (`sm:` 640px+) | 2 | 24px (`gap-6`) | ~300px² |
| Desktop (`md:` 768px+) | 3 | 32px (`gap-8`) | ~360px² |

- 페이지 셸은 기존 Songs 페이지와 동일: `max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24`
- 가로 정렬/여백 모두 기존 페이지 패턴 그대로

---

## 4. 페이지 헤더

Songs 페이지와 동일한 헤더 패턴:

```tsx
<header className="mb-4">
  <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
    Members
  </h1>
  <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
    Let me introduce the best friends of your life
    <br />
    너의 인생에 최고의 친구들을 소개합니다
  </p>
</header>
```

(Songs가 쓰는 `<blockquote>` 중간 삽입부는 이 페이지에선 제외 — YAGNI)

---

## 5. 데이터 모델 — `src/data/members.ts`

기존 `src/data/songs.ts` 패턴을 따라 정적 TypeScript 데이터로 관리.

```ts
export type Member = {
  id: string;              // "01", "02", ... (zero-padded)
  nameEn: string;          // 영문 이름 (예: "JUHE PARK")
  nameKr: string;          // 한글 이름 (예: "박주혜")
  position: string;        // 자유 텍스트 (예: "Vocal", "Guitar/Vocal", "Guitar, Keyboard")
  photo: string;           // "/members/member01.jpg"
  favoriteArtist?: string; // 선택 — 비어있으면 해당 라인 생략
  favoriteSong?: string;   // 선택 — 비어있으면 해당 라인 생략
  order?: number;          // 선택 — 표시 순서 제어용. 없으면 id 오름차순
};

export const members: Member[] = [
  // ... 9명 (사용자가 채움)
];

export const sortedMembers = (): Member[] =>
  [...members].sort((a, b) => {
    const ao = a.order ?? Number.parseInt(a.id, 10);
    const bo = b.order ?? Number.parseInt(b.id, 10);
    return ao - bo;
  });
```

### 필수/선택 필드
- **필수**: id, nameEn, nameKr, position, photo
- **선택**: favoriteArtist, favoriteSong, order

### 빈 값 처리
- `favoriteArtist` 또는 `favoriteSong`이 `undefined`이면 **해당 라인만** 생략 (구분선은 유지)
- 둘 다 없으면 구분선과 전체 fav 블록 제거

### 사진 저장
- `public/members/memberNN.jpg` (기존 `public/songs/songNN.jpg` 규칙과 동일)
- 사진은 정사각 비율로 준비 (이미 1:1 이라고 사용자 확인됨)
- Next.js `<Image>`의 `fill` + `object-cover` 사용 → 살짝 비정사각이어도 크롭됨

---

## 6. 컴포넌트 구조

세 파일로 분리 — 각각 단일 책임.

### `src/app/members/page.tsx` (재작성)
서버 컴포넌트. 헤더 + `<MembersGrid>` 렌더. 데이터 import 후 `sortedMembers()` 전달.

### `src/components/MembersGrid.tsx` (신규, `"use client"`)
그리드 래퍼 + **모바일 "한 번에 하나만 열림" 제어 상태** 호스팅.
- state: `openId: string | null`
- 카드 클릭 시 `openId === id ? null : id` 토글
- 데스크톱(hover)은 CSS로만 처리되므로 이 state에 영향 없음 → `openId`는 모바일 탭 인터랙션 전용
- `<MemberCard>` 9개를 `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3` 로 배열

### `src/components/MemberCard.tsx` (신규, `"use client"`)
단일 카드. props:
- `member: Member`
- `isOpen: boolean` — 부모에서 전달 (모바일 탭 상태)
- `onToggle: () => void` — 부모 콜백

렌더 구조:
```tsx
<button
  type="button"
  onClick={onToggle}
  aria-expanded={isOpen}
  className="relative aspect-square overflow-hidden group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
>
  {/* Photo layer */}
  <Image src={member.photo} alt={`${member.nameKr} (${member.nameEn})`} fill sizes="..." className="object-cover" />

  {/* Bottom scrim (photo state only; hidden when overlay is visible) */}
  <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

  {/* Name at bottom-left (photo state) */}
  <div className="absolute bottom-0 left-0 p-4 text-white">
    <div className="font-display font-black uppercase text-lg md:text-xl leading-[1.05]">{member.nameEn}</div>
    <div className="text-xs opacity-90 mt-0.5">{member.nameKr}</div>
  </div>

  {/* "Tap" badge (mobile only, decorative) */}
  <span
    aria-hidden="true"
    className="md:hidden absolute top-2 right-2 bg-[var(--color-text)] text-[var(--color-bg)] text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1"
  >
    Tap
  </span>

  {/* Overlay (reveal state) */}
  <div
    data-open={isOpen}
    className="
      absolute inset-0 bg-[var(--color-accent)] text-[var(--color-accent-ink)]
      p-4 md:p-5 flex flex-col justify-end
      opacity-0 transition-opacity duration-200
      md:group-hover:opacity-100 md:group-focus-visible:opacity-100
      max-md:data-[open=true]:opacity-100
    "
  >
    <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-90 mb-1.5">
      {member.position}
    </div>
    <div className="font-display font-black uppercase text-lg md:text-2xl leading-[1.05]">
      {member.nameEn}
    </div>
    <div className="text-xs md:text-sm opacity-90 mt-0.5 mb-3">
      {member.nameKr}
    </div>
    {(member.favoriteArtist || member.favoriteSong) && (
      <div className="border-t border-white/40 pt-2.5 text-xs leading-[1.6] space-y-1.5">
        {member.favoriteArtist && (
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">Favorite Artist</span>
            {member.favoriteArtist}
          </div>
        )}
        {member.favoriteSong && (
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">Favorite Song</span>
            {member.favoriteSong}
          </div>
        )}
      </div>
    )}
  </div>
</button>
```

핵심:
- `<button>` 래핑 → 키보드 접근성 확보
- Tailwind `group-hover` / `group-focus-visible`는 데스크톱(`md:`)에서만 활성
- `data-open` 속성으로 모바일 열림 제어 (state 기반)
- `aria-expanded`로 스크린리더 지원

---

## 7. 접근성

- 카드는 `<button type="button">`로 포커스 가능
- 오버레이 열림 상태: `aria-expanded={isOpen}`
- 포커스 링: `focus-visible:outline-2 outline-[var(--color-accent)]` (design system 규칙)
- 데스크톱에서 키보드 포커스 시에도 hover와 동일하게 오버레이 노출 (`md:group-focus-visible:opacity-100`)
- 이미지 alt: `"{nameKr} ({nameEn})"`
- `Tap` 뱃지는 시각적 힌트로만 동작 (`aria-hidden`) — 버튼 자체가 이미 tappable

---

## 8. 변경되는 파일 요약

| 파일 | 변경 종류 |
|------|---|
| `src/app/members/page.tsx` | 재작성 ("Coming soon" → 실제 페이지) |
| `src/data/members.ts` | 신규 |
| `src/components/MembersGrid.tsx` | 신규 |
| `src/components/MemberCard.tsx` | 신규 |
| `public/members/memberNN.jpg` × N | 신규 (사용자가 자산 제공) |

---

## 9. YAGNI — 이번 스펙에서 뺀 것들

- `/members/[id]` 상세 페이지 (정보량이 오버레이로 충분)
- 포지션별 필터 탭 (9명 규모엔 과잉)
- SNS 링크, 장비, 가입 연도 등 추가 필드 (현 요구사항 범위 밖)
- 멤버 순서 드래그 정렬 (정적 데이터라 코드 수정으로 충분)
- 오버레이 닫기 버튼(×) (카드 재탭 또는 다른 카드 탭으로 닫힘 → 명시 버튼 불필요)
- 다크모드 대응 별도 작업 (design system: 전체 다크모드 자체가 미구현 상태. 현재 라이트 기준만 맞추면 됨)

---

## 10. 디자인 시스템 체크리스트

CLAUDE.md §11 체크리스트 기준:

- [x] **레퍼런스 대응**: oasisinet의 멤버/아티스트 섹션 톤 차용 (에디토리얼 그리드, 모노크롬, 정적)
- [x] **화이트 베이스**: 페이지 배경은 화이트. 오렌지 오버레이는 카드 내부에서만 쓰임
- [x] **다크 배경은 푸터/splash만**: 오렌지 오버레이는 "액센트 면"이지 다크 섹션 아님 → 규칙 무관
- [x] **직각 / 그림자 없음**: 모든 카드·뱃지 직각. 그림자 없음
- [x] **그라디언트 없음**: 단 이름 가독성용 하단 블랙 스크림 1종만 예외로 허용(§2에 명시)
- [x] **타이포 스케일**: Archivo Black display + Inter body, CLAUDE.md §4 스케일 준수
- [x] **저작권 금지 자산**: 사용자 본인 멤버 사진만 사용
- [x] **`prefers-color-scheme: dark` 자동 전환 없음**: 추가하지 않음
- [x] **액센트 1~2곳**: 오렌지 오버레이는 동시에 최대 1개만 노출되도록 인터랙션 제약

---

## 11. 구현 후 확인 항목

- [ ] `pnpm dev` 로컬에서 멤버 9명 렌더 확인
- [ ] 데스크톱 호버 → 오렌지 오버레이 페이드인
- [ ] 모바일(크롬 DevTools 반응형)에서 탭 토글, 한 번에 하나만 열림 확인
- [ ] 키보드 Tab으로 카드 이동, Enter/Space로 토글 확인
- [ ] 이름이 긴 경우(한글/영문) 레이아웃 깨지지 않는지
- [ ] 포지션이 긴 복합 역할(`Guitar/Vocal/Backup`) 2줄 넘어가도 오버레이 유지되는지
- [ ] favoriteArtist/Song 둘 다 비어있는 경우 구분선 제거 확인
- [ ] 이미지 누락 시 alt 텍스트 노출 확인
