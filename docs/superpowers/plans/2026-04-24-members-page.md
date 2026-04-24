# Members Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/members` page of bandsustain.com — a grid of band member cards with a hover/tap-reveal orange overlay showing position, name (EN/KR), favorite artist, and favorite song.

**Architecture:** Server-rendered page shell + two client components. `MembersGrid` owns the "one open at a time" state and a `matchMedia` listener that resets state on hover-capability change. `MemberCard` is a single accessible button whose full member info lives in `aria-label` — all inner visual content is `aria-hidden` so screen readers hear each member exactly once, regardless of reveal state. Reveal visibility = CSS `:hover` (desktop only) OR `:focus-visible` OR `data-open=true` (state-driven).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, static data module (no DB).

**Source spec:** `docs/superpowers/specs/2026-04-24-members-page-design.md`

**Testing approach:** The codebase has no unit-test infrastructure (no jest/vitest, no `*.test.*` files). Verification is `pnpm lint` + `pnpm build` (type-checks) + manual browser checks per the spec's §11 checklist. Tasks below follow this established pattern instead of forcing TDD into a codebase that doesn't use it.

---

## File Structure

| File | Responsibility | Type |
|---|---|---|
| `src/data/members.ts` | Static member list, type, sort helper | Plain TS data module |
| `src/components/MemberCard.tsx` | Single card with aria-label, reveal overlay, scrim, Tap badge | Client component |
| `src/components/MembersGrid.tsx` | Grid layout, `openId` state, matchMedia reset, one-at-a-time enforcement | Client component |
| `src/app/members/page.tsx` | Server page — header + `<MembersGrid>` | Server component (replaces current "Coming soon" stub) |
| `public/members/memberNN.jpg` | Profile photos | User-provided asset |

---

## Task 1: Data module

**Files:**
- Create: `src/data/members.ts`

- [ ] **Step 1: Create the data module**

Create `src/data/members.ts` with:

```ts
export type Member = {
  id: string;
  nameEn: string;
  nameKr: string;
  position: string;
  photo: string;
  favoriteArtist?: string;
  favoriteSong?: string;
  order?: number;
};

export const members: Member[] = [
  {
    id: "01",
    nameEn: "SAMPLE NAME ONE",
    nameKr: "샘플일",
    position: "Vocal",
    photo: "/members/member01.jpg",
    favoriteArtist: "Sample Artist",
    favoriteSong: "Sample Song",
  },
  {
    id: "02",
    nameEn: "SAMPLE NAME TWO",
    nameKr: "샘플이",
    position: "Guitar/Vocal",
    photo: "/members/member02.jpg",
    favoriteArtist: "Another Artist",
    favoriteSong: "Another Song",
  },
  {
    id: "03",
    nameEn: "SAMPLE NAME THREE",
    nameKr: "샘플삼",
    position: "Bass",
    photo: "/members/member03.jpg",
  },
];

export const sortedMembers = (): Member[] =>
  [...members].sort((a, b) => {
    const ao = a.order ?? Number.parseInt(a.id, 10);
    const bo = b.order ?? Number.parseInt(b.id, 10);
    return ao - bo;
  });
```

Note: three sample entries seed verification. User will replace with real 9 members in a separate content task after implementation lands. Entry 3 intentionally has no `favoriteArtist`/`favoriteSong` — this is the fixture that exercises the "fav block hidden when both empty" branch.

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm build`
Expected: build succeeds (members.ts is not yet imported anywhere, but must type-check).

If there's any existing broken state, stop and diagnose.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/data/members.ts
git commit -m "Add members data module with sample fixtures"
```

---

## Task 2: MemberCard component

**Files:**
- Create: `src/components/MemberCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/MemberCard.tsx`:

```tsx
"use client";

import Image from "next/image";
import type { Member } from "@/data/members";

type Props = {
  member: Member;
  isOpen: boolean;
  onToggle: () => void;
};

function buildAriaLabel(m: Member): string {
  return [
    m.nameKr,
    m.nameEn,
    m.position,
    m.favoriteArtist && `Favorite Artist ${m.favoriteArtist}`,
    m.favoriteSong && `Favorite Song ${m.favoriteSong}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function MemberCard({ member, isOpen, onToggle }: Props) {
  const hasFav = Boolean(member.favoriteArtist || member.favoriteSong);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={buildAriaLabel(member)}
      className="relative aspect-square overflow-hidden group block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span aria-hidden="true" className="contents">
        {/* Photo */}
        <Image
          src={member.photo}
          alt=""
          fill
          sizes="(min-width:768px) 33vw, (min-width:640px) 50vw, 100vw"
          className="object-cover"
        />

        {/* Bottom scrim for name legibility */}
        <span className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

        {/* Name — photo state */}
        <span className="absolute bottom-0 left-0 right-14 p-4 text-white text-left">
          <span className="block font-display font-black uppercase text-lg md:text-xl leading-[1.05] line-clamp-1">
            {member.nameEn}
          </span>
          <span className="block text-xs opacity-90 mt-0.5 line-clamp-1">
            {member.nameKr}
          </span>
        </span>

        {/* Tap badge — mobile only, decorative */}
        <span className="md:hidden absolute top-2 right-2 bg-[var(--color-text)] text-[var(--color-bg)] text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1">
          Tap
        </span>

        {/* Orange reveal overlay */}
        <span
          data-open={isOpen}
          className="absolute inset-0 bg-[var(--color-accent)] text-[var(--color-accent-ink)] p-4 md:p-5 flex flex-col justify-end text-left opacity-0 transition-opacity duration-200 md:group-hover:opacity-100 group-focus-visible:opacity-100 data-[open=true]:opacity-100"
        >
          <span className="block text-[10px] uppercase tracking-[0.2em] font-bold opacity-90 mb-1.5 line-clamp-1">
            {member.position}
          </span>
          <span className="block font-display font-black uppercase text-lg md:text-2xl leading-[1.05] line-clamp-1">
            {member.nameEn}
          </span>
          <span className="block text-xs md:text-sm opacity-90 mt-0.5 mb-3 line-clamp-1">
            {member.nameKr}
          </span>
          {hasFav && (
            <span className="block border-t border-white/40 pt-2.5 text-xs leading-[1.6]">
              {member.favoriteArtist && (
                <span className="block">
                  <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">
                    Favorite Artist
                  </span>
                  <span className="block line-clamp-1">{member.favoriteArtist}</span>
                </span>
              )}
              {member.favoriteSong && (
                <span className="block mt-1.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">
                    Favorite Song
                  </span>
                  <span className="block line-clamp-1">{member.favoriteSong}</span>
                </span>
              )}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
```

Implementation notes:
- All inner markup uses `<span>` rather than `<div>` because a `<button>` element cannot legally contain block-level descendants like `<div>`. `display: block` is applied via class where needed.
- `<Image alt="">` is intentional — the `aria-hidden="true"` wrapper marks the image as decoration. The button's `aria-label` already carries the identity information.
- `md:group-hover:` keeps hover-reveal off on narrow screens where touch pointers can fire synthetic hover.
- `group-focus-visible:` has no breakpoint gate — keyboard focus should reveal the overlay on every viewport.
- `data-[open=true]:` also has no breakpoint gate — state-driven reveal works everywhere; resize-leak is handled at the grid level (Task 3).

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm build`
Expected: build succeeds. The component is not yet imported, but must type-check standalone.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/components/MemberCard.tsx
git commit -m "Add MemberCard with aria-label + reveal overlay"
```

---

## Task 3: MembersGrid component

**Files:**
- Create: `src/components/MembersGrid.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/MembersGrid.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Member } from "@/data/members";
import MemberCard from "./MemberCard";

type Props = {
  members: Member[];
};

export default function MembersGrid({ members }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  // Reset open state when hover capability changes (viewport crosses
  // into or out of hover-capable environments). Prevents a pinned
  // desktop card from rendering as open after resizing to a mobile
  // viewport, and vice versa.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const handler = () => setOpenId(null);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
      {members.map((m) => (
        <MemberCard
          key={m.id}
          member={m}
          isOpen={openId === m.id}
          onToggle={() => handleToggle(m.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm build`
Expected: build succeeds. Still not imported by a page, but must type-check.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/components/MembersGrid.tsx
git commit -m "Add MembersGrid with one-at-a-time state + matchMedia reset"
```

---

## Task 4: Wire into members page

**Files:**
- Modify: `src/app/members/page.tsx` (currently a "Coming soon" stub)

- [ ] **Step 1: Replace the page**

Overwrite `src/app/members/page.tsx` with:

```tsx
import MembersGrid from "@/components/MembersGrid";
import { sortedMembers } from "@/data/members";

export default function MembersPage() {
  const all = sortedMembers();

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

      <MembersGrid members={all} />
    </section>
  );
}
```

Page shell follows the existing Songs page pattern (`src/app/songs/page.tsx`) — same max-width, same vertical rhythm, same header typography scale.

- [ ] **Step 2: Build**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm build`
Expected: build succeeds. This now exercises the full import graph.

- [ ] **Step 3: Lint**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm lint`
Expected: no errors in the three new files and the modified page.

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/app/members/page.tsx
git commit -m "Wire members page to grid + sample data"
```

---

## Task 5: Manual browser verification

**Files:** none (verification only)

**Prerequisite:** Task 1's three sample members have `photo: "/members/memberNN.jpg"` paths. For verification, place any square test images (any content — can be your own photos, free stock portraits, or solid-color squares) at `public/members/member01.jpg`, `member02.jpg`, `member03.jpg`. These do not need to be committed — they're only for visual verification. Real member photos land in a separate content task after implementation.

- [ ] **Step 1: Start dev server**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm dev`
Open `http://localhost:3000/members` (or whatever port `pnpm dev` prints).

- [ ] **Step 2: Desktop verification (viewport ≥ 768px wide)**

In the browser, verify:
- [ ] Page header renders "MEMBERS" with the bilingual subtitle matching the Songs page typography.
- [ ] Three cards render in a 3-column grid (since we have exactly 3 fixtures).
- [ ] Each card shows a square photo with English + Korean name overlaid at the bottom-left in white, visible against a subtle dark scrim.
- [ ] Hovering a card fades in the orange overlay (~200ms). Overlay contains: position (tiny uppercase), English name (large Archivo Black), Korean name, divider, Favorite Artist, Favorite Song.
- [ ] Hovering card #3 (the fixture with no fav fields) shows position + names only, no divider, no fav block.
- [ ] Moving mouse off card fades overlay out.
- [ ] Clicking a card "pins" the overlay — mouse leaves, overlay stays.
- [ ] Clicking the same pinned card closes it.
- [ ] Clicking a different card while one is pinned: the previous closes, the new one opens (only one pinned at a time).

- [ ] **Step 3: Keyboard verification**

- [ ] Click into the page, then press Tab until a card is focused — orange accent focus ring appears and overlay fades in while focused.
- [ ] Tab again → focus moves to next card; prior card's overlay fades out; new card's fades in.
- [ ] On a focused card, press Enter → overlay pins (stays after Tab moves focus away). Press Enter again on the same card → unpins.

- [ ] **Step 4: Mobile verification (Chrome DevTools device toolbar, e.g. iPhone 12 Pro @ 390px)**

- [ ] Cards now render one-per-row (1 column).
- [ ] Each card has a small rectangular black "Tap" badge in the top-right corner.
- [ ] Tap a card → orange overlay appears. Tap again → closes.
- [ ] Tap card #1, then tap card #2 → card #1 closes automatically, card #2 opens.
- [ ] No hover effect fires from synthetic touch events on this viewport.

- [ ] **Step 5: Resize-leak verification**

- [ ] At desktop width, click card #2 to pin it. Confirm overlay visible.
- [ ] In DevTools, toggle device toolbar on (switch to mobile emulation). Verify card #2's overlay is now closed (`openId` was reset by the matchMedia listener crossing into `(hover: none)`).
- [ ] Repeat in the other direction: at mobile width, tap a card open, then switch back to desktop emulation. Verify no card renders as open.

- [ ] **Step 6: Screen-reader spot-check (optional but recommended)**

On macOS: enable VoiceOver (Cmd+F5) and Tab to a card.
- [ ] VO reads the full `aria-label` string once: Korean name, English name, position, favorite artist, favorite song. No "expanded/collapsed" state announced. No duplicated name readings.
- [ ] Card #3 (no favs) reads only: Korean name, English name, position.

- [ ] **Step 7: Stop dev server and summarize**

Press Ctrl+C in the terminal running `pnpm dev`.

Report findings. If any checklist item failed, capture the symptom and decide whether to patch inline (small fix) or return to the plan/spec for a rethink.

No commit — this task is verification.

---

## Task 6: Content handoff (user-facing, not engineer-executed)

**Files:**
- Modify: `src/data/members.ts` (replace sample fixtures with real 9 members)
- Create: `public/members/memberNN.jpg` × N (real photos)

This task is a handoff note for the project owner, not an engineering step:

- Replace the three sample entries in `members.ts` with the real 9 band members. Fields: `id` (zero-padded, e.g. `"01"`..`"09"`), `nameEn`, `nameKr`, `position`, `photo` path, and optional `favoriteArtist` / `favoriteSong`.
- Drop 9 square `.jpg` files into `public/members/` with filenames matching the `photo` paths in the data.
- Keep field lengths within the guidelines in spec §5 (line-clamp-1 will truncate overrun gracefully, but SR reads the full `aria-label` regardless).
- Commit the data + photo changes together, then `pnpm build` + `pm2 restart bandsustain` to deploy per the project's `main`-only workflow.

---

## Self-review notes

Spec coverage audit (§§ reference the design spec):

| Spec requirement | Covered by |
|---|---|
| §2 Photo + scrim + name overlay | Task 2 (photo state markup + gradient scrim) |
| §2 Orange reveal overlay with pos/name/fav | Task 2 (overlay markup) |
| §2 Trigger model (hover OR focus OR state) | Task 2 (CSS classes `md:group-hover:` / `group-focus-visible:` / `data-[open=true]:`) |
| §2 Resize-leak reset | Task 3 (`useEffect` with matchMedia) |
| §2 200ms opacity transition, no transform | Task 2 (`transition-opacity duration-200`) |
| §2 Accent only one at a time | Task 3 (single `openId`) + inherent single-hover |
| §3 Grid 1/2/3 columns | Task 3 (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`) |
| §4 Page header | Task 4 (matches Songs page pattern) |
| §5 Data model + helpers | Task 1 |
| §5 Required/optional fields | Task 1 (`favoriteArtist?`, `favoriteSong?`) + Task 2 (`hasFav` gating) |
| §5 Field length guidelines + `line-clamp-1` | Task 2 (clamps on every text node) |
| §5 Image-missing policy (no fallback UI) | Task 2 (no onError handler — spec explicitly YAGNIs this) |
| §6 Component structure | Tasks 1–4 |
| §7 aria-label + aria-hidden, no aria-expanded | Task 2 (`buildAriaLabel`, `aria-hidden` wrapper) |
| §7 Focus ring | Task 2 (`focus-visible:outline-*`) |
| §11 Checklist | Task 5 (each sub-item mapped) |

No spec requirement left unmapped.

Placeholder scan: no TBDs, no "implement later", every code block is complete. Sample data in Task 1 is real, runnable code — intentional fixtures for verification, flagged for replacement in Task 6.

Type consistency check: `Member` field names, `MembersGrid` prop (`members`), `MemberCard` props (`member`, `isOpen`, `onToggle`), and `sortedMembers()` signature all match across Tasks 1–4.
