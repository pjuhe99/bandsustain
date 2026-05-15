# Homepage Upcoming Live Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one emphasized `Upcoming Show` card on the homepage when at least one published upcoming live event exists, primarily to signal that a scheduled performance is coming up.

**Architecture:** Keep all data sourcing in existing server-side homepage loading, add one homepage-only live selection helper for predictable behavior, and render a dedicated presentational card between `Hero` and `About`. The change stays inside `src/app`, `src/components`, and `src/lib`; it does not touch `.env`-style credentials, deployment config, or database files.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript, Tailwind CSS v4, `tsx` for a lightweight verification script, ESLint, Next production build verification.

---

## Preconditions

- `node_modules` is currently absent in this workspace. Before implementation, install dependencies so the local Next.js 16 guides exist.
- Before writing code, read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` for App Router server component conventions used by `src/app/page.tsx`.
- Do not modify any of these without explicit user approval:
  - `.env` files or credential loading such as `src/lib/creds.ts`
  - deployment/runtime config such as `ecosystem.config.js` or `next.config.ts`
  - database schema/seed files under `db/`

## File Structure

- Create: `src/lib/home-live.ts`
  - Homepage-only helper for choosing the single event to highlight.
- Create: `src/components/UpcomingShowCard.tsx`
  - Presentational card for the homepage.
- Create: `scripts/verify-home-upcoming-live.ts`
  - Lightweight assertion script for the homepage helper.
- Modify: `src/app/page.tsx`
  - Fetch upcoming live events alongside songs/news/members and render the card between `Hero` and `About`.
- Read-only reference: `src/lib/live.ts`
  - Reuse `LiveEvent` type and `formatLiveDateWithYear`.

### Task 1: Add homepage upcoming-event selection helper

**Files:**
- Create: `src/lib/home-live.ts`
- Create: `scripts/verify-home-upcoming-live.ts`
- Test: `scripts/verify-home-upcoming-live.ts`

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-home-upcoming-live.ts`:

```ts
import assert from "node:assert/strict";
import {
  getHomepageUpcomingEvent,
  type HomepageUpcomingEvent,
} from "@/lib/home-live";

const fixtures: HomepageUpcomingEvent[] = [
  {
    id: 2,
    eventDate: "2026-08-19",
    venue: "Rolling Hall",
    city: "Seoul",
    ticketUrl: null,
  },
  {
    id: 1,
    eventDate: "2026-06-12",
    venue: "Club FF",
    city: "Seoul",
    ticketUrl: "https://example.com/tickets/club-ff",
  },
];

assert.equal(
  getHomepageUpcomingEvent([]),
  null,
  "empty upcoming lists should not produce a homepage card",
);

assert.deepEqual(
  getHomepageUpcomingEvent(fixtures),
  fixtures[0],
  "homepage should show the first already-sorted upcoming event",
);

console.log("verify-home-upcoming-live: ok");
```

- [ ] **Step 2: Run the verification script to confirm it fails first**

Run:

```bash
pnpm exec tsx scripts/verify-home-upcoming-live.ts
```

Expected: FAIL with a module resolution error for `@/lib/home-live` or a missing export error, proving the helper does not exist yet.

- [ ] **Step 3: Implement the minimal helper**

Create `src/lib/home-live.ts`:

```ts
import "server-only";
import type { LiveEvent } from "@/lib/live";

export type HomepageUpcomingEvent = Pick<
  LiveEvent,
  "id" | "eventDate" | "venue" | "city" | "ticketUrl"
>;

export function getHomepageUpcomingEvent(
  events: HomepageUpcomingEvent[],
): HomepageUpcomingEvent | null {
  return events[0] ?? null;
}
```

- [ ] **Step 4: Re-run the verification script**

Run:

```bash
pnpm exec tsx scripts/verify-home-upcoming-live.ts
```

Expected: PASS with output `verify-home-upcoming-live: ok`

- [ ] **Step 5: Commit the helper groundwork**

```bash
git add src/lib/home-live.ts scripts/verify-home-upcoming-live.ts
git commit -m "test: add homepage upcoming live helper verification"
```

### Task 2: Render the homepage upcoming-show card

**Files:**
- Create: `src/components/UpcomingShowCard.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/app/page.tsx`

- [ ] **Step 1: Write the failing homepage integration**

Update `src/app/page.tsx` so the homepage expects the new component and helper before they exist. Replace the top imports and data load with:

```tsx
import Hero from "@/components/Hero";
import JsonLd from "@/components/JsonLd";
import NewsCard from "@/components/NewsCard";
import SongGrid from "@/components/SongGrid";
import UpcomingShowCard from "@/components/UpcomingShowCard";
import { getHomepageUpcomingEvent } from "@/lib/home-live";
import { getUpcomingEvents } from "@/lib/live";
import { getPublishedMembers } from "@/lib/members";
import { getPublishedNews } from "@/lib/news";
import { getPublishedSongs } from "@/lib/songs";
import { buildMusicGroupSchema } from "@/lib/seo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [songs, latestNewsAll, members, upcomingEvents] = await Promise.all([
    getPublishedSongs(),
    getPublishedNews(),
    getPublishedMembers(),
    getUpcomingEvents(),
  ]);
  const featured = songs.slice(0, 3);
  const latestNews = latestNewsAll.slice(0, 3);
  const upcomingShow = getHomepageUpcomingEvent(upcomingEvents);
```

Insert this block immediately after `<Hero />`:

```tsx
      {upcomingShow ? <UpcomingShowCard event={upcomingShow} /> : null}
```

- [ ] **Step 2: Run type/build verification to confirm the integration fails first**

Run:

```bash
pnpm build
```

Expected: FAIL because `@/components/UpcomingShowCard` does not exist yet.

- [ ] **Step 3: Implement the card component**

Create `src/components/UpcomingShowCard.tsx`:

```tsx
import Link from "next/link";
import { formatLiveDateWithYear, type LiveEvent } from "@/lib/live";

type Props = {
  event: Pick<LiveEvent, "id" | "eventDate" | "venue" | "city" | "ticketUrl">;
};

export default function UpcomingShowCard({ event }: Props) {
  return (
    <section className="border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-10">
        <article className="border border-[var(--color-border-strong)] px-6 py-6 md:px-8 md:py-7 bg-[var(--color-bg)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Upcoming Show
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="font-display font-black text-2xl md:text-3xl uppercase tracking-tight">
                {event.venue}
              </p>
              <p className="text-sm md:text-base text-[var(--color-text-muted)] mt-2">
                {formatLiveDateWithYear(event.eventDate)} · {event.city}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/live"
                className="text-sm underline underline-offset-4"
              >
                See live schedule
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Re-run lint and production build**

Run:

```bash
pnpm lint
pnpm build
```

Expected:
- `pnpm lint` passes with no new errors
- `pnpm build` passes and the homepage compiles with the new card

- [ ] **Step 5: Commit the homepage UI**

```bash
git add src/app/page.tsx src/components/UpcomingShowCard.tsx
git commit -m "feat: highlight upcoming live show on homepage"
```

### Task 3: Manually verify presence and absence states

**Files:**
- Modify: none
- Test: homepage route and live route in a local browser

- [ ] **Step 1: Start the dev server**

Run:

```bash
pnpm dev
```

Expected: Next dev server starts successfully, typically on `http://localhost:3000`

- [ ] **Step 2: Verify the positive state with at least one upcoming published event**

Open:

```text
http://localhost:3000/
http://localhost:3000/live
```

Expected:
- Homepage shows exactly one `Upcoming Show` card between the hero and about section
- Card content matches the first entry in `/live`’s `Upcoming Shows` list
- CTA text links to `/live`
- Layout works on both desktop and mobile widths

- [ ] **Step 3: Verify the empty state without editing database files**

Use the existing admin UI to temporarily unpublish or date-shift every upcoming live event in development data, then refresh the homepage.

Expected:
- Homepage renders normally with no gap or placeholder where the card was
- `/live` still behaves as designed for its own empty-upcoming state

- [ ] **Step 4: Restore the original development data state**

Use the same admin UI to restore the published/dev records changed in the previous step.

Expected: The homepage card returns once an upcoming published event exists again.

- [ ] **Step 5: Commit only if no follow-up fixes were needed**

```bash
git status
```

Expected: clean working tree after the two commits above, unless follow-up polish was intentionally added.

## Self-Review

- Spec coverage: This plan covers the agreed design choice of one medium-emphasis homepage card, placed after `Hero`, showing only the nearest upcoming published event and linking to `/live`.
- Placeholder scan: No `TODO`/`TBD` placeholders remain; commands, file paths, and code are concrete.
- Type consistency: `HomepageUpcomingEvent` uses a `Pick<LiveEvent, ...>` shape that matches the component prop and the helper return type.
