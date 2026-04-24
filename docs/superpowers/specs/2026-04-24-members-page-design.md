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

### 트리거 (단일 모델, 모든 viewport 동일)
오버레이 opacity = `hover` OR `focus-visible` OR `data-[open=true]` (셋 중 하나라도 참이면 보임)

- **Hover (desktop only, `md:` 게이팅)**: 일시적 노출. 마우스 벗어나면 페이드아웃. 단, state가 true면 계속 보임
- **Focus-visible (전 viewport)**: 키보드 Tab으로 포커스 시 일시적 노출
- **State (`openId` 기반, 전 viewport)**: 클릭/탭/Enter/Space 로 토글. 한 번 켜지면 명시적으로 닫을 때까지 지속. **한 번에 한 카드만** (다른 카드가 열리면 이전 카드 자동 닫힘)
- **데스크톱 클릭 의미**: "핀 고정" — hover와 달리 마우스 벗어나도 남음. 같은 카드 다시 클릭하거나 다른 카드 클릭 시 닫힘

### 리사이즈 리크 방지
MembersGrid에서 `matchMedia("(hover: hover) and (pointer: fine)")` 변경 리스너 등록. **양방향 모두** hover-capability 전환이 발생하면 `openId`를 `null`로 초기화. 이유: 환경 특성이 바뀌면 사용자 기대도 바뀌므로 열린 상태를 깨끗이 리셋하는 게 예측 가능. (특히 데스크톱에서 핀 고정해둔 카드가 모바일 뷰로 줄어들었을 때 그대로 열린 채 시작하는 문제 방지)

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

### 필드 길이 가이드 (편집 규칙)
각 표시 필드는 **한 줄에 들어가는 길이**로 작성. 구현은 `line-clamp-1`로 가드하지만, 편집 단계에서 아래 기준을 맞춰 의도치 않은 말줄임을 방지.
- `nameEn`: ~16자 이내 (공백 포함)
- `nameKr`: ~8자 이내
- `position`: ~20자 이내 (복합 역할은 "Guitar/Vocal"처럼 슬래시 구분)
- `favoriteArtist`, `favoriteSong`: ~25자 이내

> 기준 초과 시 `line-clamp-1`로 줄임 처리되어도 `aria-label`엔 전체 텍스트가 실려 SR 사용자는 완전한 정보를 받는다.

### 빈 값 처리
- `favoriteArtist` 또는 `favoriteSong`이 `undefined`이면 **해당 라인만** 생략 (구분선은 유지)
- 둘 다 없으면 구분선과 전체 fav 블록 제거

### 사진 저장
- `public/members/memberNN.jpg` (기존 `public/songs/songNN.jpg` 규칙과 동일)
- 사진은 정사각 비율로 준비 (이미 1:1 이라고 사용자 확인됨)
- Next.js `<Image>`의 `fill` + `object-cover` 사용 → 살짝 비정사각이어도 크롭됨

### 이미지 누락 정책
`photo`는 **필수 필드**이며 실제 파일 존재 여부는 콘텐츠 파이프라인(사용자 업로드) 책임. 코드 단에서 별도 fallback UI(onError placeholder, initial 뱃지 등)는 **만들지 않음** — YAGNI. 파일 누락은 배포 전 스팟체크로 발견·수정할 문제지 런타임에 우아하게 복구할 시나리오가 아님.

---

## 6. 컴포넌트 구조

세 파일로 분리 — 각각 단일 책임.

### `src/app/members/page.tsx` (재작성)
서버 컴포넌트. 헤더 + `<MembersGrid>` 렌더. 데이터 import 후 `sortedMembers()` 전달.

### `src/components/MembersGrid.tsx` (신규, `"use client"`)
그리드 래퍼 + **한 번에 하나만 열림** 상태 호스팅.
- state: `openId: string | null`
- 카드 클릭/탭/Enter·Space 시 `openId === id ? null : id` 토글 (모든 viewport 공통)
- **리사이즈 리크 방지**: `useEffect`에서 `matchMedia("(hover: hover) and (pointer: fine)")`에 change 리스너 등록. 양방향(mobile↔desktop)으로 hover-capability가 바뀔 때마다 `setOpenId(null)` 호출. 언마운트 시 리스너 정리.
- 배열: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3`

### `src/components/MemberCard.tsx` (신규, `"use client"`)
단일 카드. props:
- `member: Member`
- `isOpen: boolean`
- `onToggle: () => void`

렌더 구조 (개념 예시 — 최종 JSX는 구현 단계에서):
```tsx
// SR 접근성 라벨: 버튼 하나 = 한 번의 full 낭독
const ariaLabel = [
  member.nameKr,
  member.nameEn,
  member.position,
  member.favoriteArtist && `Favorite Artist ${member.favoriteArtist}`,
  member.favoriteSong && `Favorite Song ${member.favoriteSong}`,
].filter(Boolean).join(", ");

<button
  type="button"
  onClick={onToggle}
  aria-label={ariaLabel}
  className="relative aspect-square overflow-hidden group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
>
  {/* 시각 레이어 전체를 aria-hidden — SR은 aria-label만 읽음 */}
  <div aria-hidden="true" className="contents">

    {/* Photo layer */}
    <Image src={member.photo} alt="" fill sizes="(min-width:768px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />

    {/* Bottom scrim for name legibility */}
    <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

    {/* Name at bottom-left (photo state) */}
    <div className="absolute bottom-0 left-0 right-14 p-4 text-white">
      <div className="font-display font-black uppercase text-lg md:text-xl leading-[1.05] line-clamp-1">{member.nameEn}</div>
      <div className="text-xs opacity-90 mt-0.5 line-clamp-1">{member.nameKr}</div>
    </div>

    {/* "Tap" badge (mobile only, decorative hint) */}
    <span className="md:hidden absolute top-2 right-2 bg-[var(--color-text)] text-[var(--color-bg)] text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1">
      Tap
    </span>

    {/* Overlay (reveal state) */}
    <div
      data-open={isOpen}
      className="
        absolute inset-0 bg-[var(--color-accent)] text-[var(--color-accent-ink)]
        p-4 md:p-5 flex flex-col justify-end
        opacity-0 transition-opacity duration-200
        md:group-hover:opacity-100 group-focus-visible:opacity-100
        data-[open=true]:opacity-100
      "
    >
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-90 mb-1.5 line-clamp-1">
        {member.position}
      </div>
      <div className="font-display font-black uppercase text-lg md:text-2xl leading-[1.05] line-clamp-1">
        {member.nameEn}
      </div>
      <div className="text-xs md:text-sm opacity-90 mt-0.5 mb-3 line-clamp-1">
        {member.nameKr}
      </div>
      {(member.favoriteArtist || member.favoriteSong) && (
        <div className="border-t border-white/40 pt-2.5 text-xs leading-[1.6] space-y-1.5">
          {member.favoriteArtist && (
            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">Favorite Artist</span>
              <span className="line-clamp-1">{member.favoriteArtist}</span>
            </div>
          )}
          {member.favoriteSong && (
            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">Favorite Song</span>
              <span className="line-clamp-1">{member.favoriteSong}</span>
            </div>
          )}
        </div>
      )}
    </div>

  </div>
</button>
```

핵심:
- `<button>` 래핑 + 키보드/SR 접근 가능
- **전체 시각 콘텐츠는 `aria-hidden="true"` 래퍼 안** → SR은 `aria-label` 한 번만 낭독. 기본/오버레이 텍스트 중복 없음. `<Image>`의 `alt=""`는 의도적 — 시각 이미지도 decoration 처리 (텍스트 정보는 라벨로 이미 충분)
- `aria-expanded` 제거 — SR 관점에서 상태 변화가 노출할 정보가 없음 (전부 `aria-label`에 있음)
- Tailwind `md:group-hover:` — hover는 데스크톱 폭에서만 작동 (터치 디바이스의 hover 에뮬레이션 방지)
- `group-focus-visible:` — `md:` 게이팅 제거. 키보드 포커스는 전 viewport에서 일관되게 오버레이 노출
- `data-[open=true]:` — `max-md:` 게이팅 제거. 클릭/탭/Enter·Space 토글은 전 viewport 공통. 리사이즈 리크는 MembersGrid의 matchMedia 리셋으로 방어
- 모든 텍스트에 `line-clamp-1` 적용 — 필드 길이 초과 시 우아한 말줄임. 전체 텍스트는 `aria-label`에 항상 포함

---

## 7. 접근성

### 핵심 원칙
오버레이는 **시각 인터랙션**이다. SR 사용자에게는 카드가 "열렸다/닫혔다"는 개념이 무의미하므로, 모든 멤버 정보를 버튼의 `aria-label`에 한 번에 실어 SR은 카드 하나당 정확히 한 번 완전한 정보를 낭독하게 한다.

### 구체 규칙
- 카드는 `<button type="button">`로 포커스 가능
- `aria-label`: `"{nameKr}, {nameEn}, {position}, Favorite Artist {...}, Favorite Song {...}"` (빈 필드는 생략)
- 카드 내부의 모든 시각 요소(사진, 이름 텍스트, Tap 뱃지, 오버레이 전체)는 `aria-hidden="true"` 래퍼 안에 위치 → SR은 **aria-label만** 읽음, 중복 낭독 없음
- `<Image>`의 `alt=""` (decoration 처리) — 이미지의 시각 정보는 이미 `aria-label`에 요약됨
- `aria-expanded`는 사용하지 않음 — 상태 전환으로 노출되는 새 정보가 없기 때문
- 포커스 링: `focus-visible:outline-2 outline-[var(--color-accent)]` (design system 규칙)
- 키보드: Tab으로 카드 간 이동, Enter/Space로 토글. 포커스 시 오버레이가 나타나 사용자가 상호작용 가능함을 시각적으로 확인 (단, SR 사용자에게 이 시각 효과는 무관)
- `Tap` 뱃지는 시각 힌트 (이미 `aria-hidden="true"` 래퍼 안)

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
- [ ] 데스크톱 호버 → 오렌지 오버레이 페이드인, 마우스 이탈 시 페이드아웃
- [ ] 데스크톱 클릭 → 오버레이 핀 고정, 다시 클릭 또는 다른 카드 클릭으로 닫힘
- [ ] 모바일(크롬 DevTools 반응형)에서 탭 토글, 한 번에 하나만 열림 확인
- [ ] 키보드 Tab으로 카드 이동 시 포커스 카드만 오버레이 노출, Enter/Space로 핀 고정 토글
- [ ] DevTools에서 데스크톱→모바일 / 모바일→데스크톱 리사이즈 후 openId 리셋 확인 (이전 상태가 새 뷰에 새어나오지 않음)
- [ ] 긴 이름/포지션/fav 값 입력 시 `line-clamp-1`로 한 줄 말줄임, 오버레이 박스 자체는 깨지지 않음
- [ ] favoriteArtist/Song 둘 다 비어있는 경우 구분선 + fav 블록 전체 미렌더 확인
- [ ] SR(VoiceOver 또는 NVDA)로 카드 포커스 시 `aria-label`이 한 번만 낭독되고 중복 없음 확인
