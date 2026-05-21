# Member Pedalboard Pinning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to pin selected pedalboards (by `playground_layouts.id`) as member pedalboards rendered in a separate corner at the top of `/playground/pedalboard-planner/gallery`, with per-pin override title, short caption, and admin-controlled ordering.

**Architecture:** New table `playground_member_pins` linking `playground_layouts` ↔ `members`. A single new server-only module `src/lib/playground/memberPins.ts` owns all pin DB I/O. The new admin menu `/admin/pedalboard-pins` mirrors the existing `/admin/members` patterns (list page + inline new-pin form + edit page + server actions). The gallery page becomes two-section ("Sustain Member Pedalboards" on top + "Recent Public Boards" below excluding pinned ids). The single-layout share view (`/playground/p/[shareToken]`) gains a "if pinned ⇒ private layout becomes viewable" exception.

**Tech Stack:** Next.js 16 App Router + TypeScript + Tailwind v4, `mysql2` (pool exposed via `@/lib/db`), `zod` for server-action input validation, `node:test` (run with `pnpm exec tsx --test <file>`), single-branch `main`, PM2 process `bandsustain` (port 3100).

---

## Pre-flight Notes for the Implementer

1. **Spec correction (members FK type).** The spec's `Dependencies / Open Questions` section assumed `members.id` was `INT UNSIGNED`. The actual schema (`db/schema/002_members.sql:6`) is signed `INT AUTO_INCREMENT`. The migration in **Task 1** uses signed `INT NOT NULL` for `member_id` to satisfy the FK signedness rule. `playground_layouts.id` is `BIGINT UNSIGNED`, so `layout_id` is `BIGINT UNSIGNED NOT NULL`.
2. **Single-branch repo.** bandsustain uses only `main`. No `dev`/`prod` fork (CLAUDE.md §10). Do **not** push, build, or restart PM2 inside any task. The final commit is staged for review; the user will explicitly request the deploy step (`git push origin main && pnpm build && pm2 restart bandsustain`).
3. **Test command.** `pnpm exec tsx --test src/lib/playground/<file>.test.ts` — matches existing `seo.test.ts` / `yeongminBotLimits.test.ts` (built-in `node:test`, not vitest).
4. **DB access.** Single environment (`.db_credentials` at `/var/www/html/_______site_BANDSUSTAIN/.db_credentials`, env key is `DB_PASS` not `DB_PASSWORD`). Each DB-touching task migrates the live DB at apply time; this is acceptable because pins are additive and the new table is empty until admin uses the UI.
5. **Design rules.** All new UI must follow `CLAUDE.md` §6 — Tailwind utilities only, no rounded corners (`rounded-none` or omit), no shadow, no auto dark mode, blue accent only on rare action elements. Member group header uses 48×48 square photo (no `rounded-full`).
6. **No layout structural restructuring.** Files in this plan are small and focused (one responsibility each). The gallery page is the only existing file that gains real new content; it stays well under 200 lines.
7. **TDD scope.** Only the two **pure helpers** (`normalizePinInput`, `groupConsecutiveBy`) get unit tests. DB-touching `memberPins.ts` functions are integration-verified via the `verify-member-pins.ts` script (Task 14) and the post-deploy HTTP smoke (Task 15) — same pattern as `yeongminBot.ts` etc.

---

## File Structure

### New files

- `db/schema/016_member_pedalboard_pins.sql` — table create + indexes + FKs
- `src/lib/playground/groupConsecutive.ts` + `groupConsecutive.test.ts` — pure helper to group items by consecutive same-key runs
- `src/lib/playground/normalizePinInput.ts` + `normalizePinInput.test.ts` — pure helper for trim/empty→null/newline-collapse + length boundary
- `src/lib/playground/memberPins.ts` — server-only DB module (queries, server-side helpers)
- `src/components/playground/pedalboard/MemberPinCard.tsx` — single-card view (title + board meta + caption)
- `src/components/playground/pedalboard/MemberPinSection.tsx` — full top-corner section (member group headers + cards)
- `src/app/admin/(authed)/pedalboard-pins/page.tsx` — admin list + inline new-pin form
- `src/app/admin/(authed)/pedalboard-pins/actions.ts` — `"use server"` actions
- `src/app/admin/(authed)/pedalboard-pins/[id]/page.tsx` — edit single pin
- `scripts/verify-member-pins.ts` — invariant checker

### Modified files

- `src/app/playground/pedalboard-planner/gallery/page.tsx` — render top section + exclude pinned ids from bottom grid
- `src/app/playground/p/[shareToken]/page.tsx` — allow pinned private layouts
- `src/app/playground/p/[shareToken]/opengraph-image.tsx` — same exception for OG
- `src/components/admin/AdminNav.tsx` — new menu item
- `package.json` — `pins:verify` script

---

## Task 1: Migration — create `playground_member_pins`

**Files:**
- Create: `db/schema/016_member_pedalboard_pins.sql`

- [ ] **Step 1: Write the migration file**

Create `db/schema/016_member_pedalboard_pins.sql`:

```sql
-- 016_member_pedalboard_pins.sql
-- /playground/pedalboard-planner/gallery 멤버 페달보드 핀
-- 갤러리 상단에 별도 코너로 노출되는 큐레이션 메타 (admin 전용).
-- 수동 실행:
--   set -a; source /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
--   mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
--     < db/schema/016_member_pedalboard_pins.sql

CREATE TABLE IF NOT EXISTS playground_member_pins (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  layout_id       BIGINT UNSIGNED NOT NULL,
  member_id       INT             NOT NULL,
  override_title  VARCHAR(200)    NULL,
  caption         VARCHAR(280)    NULL,
  pin_order       INT             NOT NULL DEFAULT 0,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pin_layout_member (layout_id, member_id),
  KEY idx_pin_order (pin_order, id),
  KEY idx_pin_member (member_id),
  CONSTRAINT fk_pin_layout FOREIGN KEY (layout_id)
    REFERENCES playground_layouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pin_member FOREIGN KEY (member_id)
    REFERENCES members(id)            ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Apply migration**

Run:

```bash
set -a; source /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  < /root/bandsustain/public_html/bandsustain/db/schema/016_member_pedalboard_pins.sql
```

Expected: silent success (no output). If the table already exists from a re-run, `CREATE TABLE IF NOT EXISTS` is a no-op — that is fine.

- [ ] **Step 3: Verify table + FKs exist**

Run:

```bash
set -a; source /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e \
  "SHOW CREATE TABLE playground_member_pins\G" | head -30
```

Expected output should contain `UNIQUE KEY \`uk_pin_layout_member\` (\`layout_id\`,\`member_id\`)` and both FK constraints (`fk_pin_layout`, `fk_pin_member`).

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add db/schema/016_member_pedalboard_pins.sql
git commit -m "$(cat <<'EOF'
db(playground): add playground_member_pins table

(layout_id, member_id) UNIQUE pin rows with override title / caption /
admin-controlled pin_order. FKs CASCADE so deleting a layout or member
cleans up its pins.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure helper — `groupConsecutiveBy`

**Files:**
- Create: `src/lib/playground/groupConsecutive.ts`
- Test: `src/lib/playground/groupConsecutive.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/playground/groupConsecutive.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { groupConsecutiveBy } from "./groupConsecutive";

test("empty array returns empty", () => {
  assert.deepEqual(groupConsecutiveBy([], (x: number) => x), []);
});

test("single key throughout returns one group", () => {
  const items = [
    { mid: 1, n: "a" },
    { mid: 1, n: "b" },
    { mid: 1, n: "c" },
  ];
  const out = groupConsecutiveBy(items, (it) => it.mid);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 1);
  assert.deepEqual(out[0].items.map((x) => x.n), ["a", "b", "c"]);
});

test("ABA pattern produces 3 groups (admin order respected)", () => {
  const items = [
    { mid: 1, n: "a1" },
    { mid: 1, n: "a2" },
    { mid: 2, n: "b1" },
    { mid: 1, n: "a3" },
  ];
  const out = groupConsecutiveBy(items, (it) => it.mid);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((g) => g.key), [1, 2, 1]);
  assert.deepEqual(out[0].items.map((x) => x.n), ["a1", "a2"]);
  assert.deepEqual(out[1].items.map((x) => x.n), ["b1"]);
  assert.deepEqual(out[2].items.map((x) => x.n), ["a3"]);
});

test("key comparison is value-based (not identity)", () => {
  // Two distinct object literals with same .id should group together.
  const a = { id: 7 };
  const b = { id: 7 };
  const out = groupConsecutiveBy([{ k: a }, { k: b }], (x) => x.k.id);
  assert.equal(out.length, 1);
  assert.equal(out[0].items.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsx --test src/lib/playground/groupConsecutive.test.ts`

Expected: FAIL with `Cannot find module './groupConsecutive'`.

- [ ] **Step 3: Implement `groupConsecutive.ts`**

Create `src/lib/playground/groupConsecutive.ts`:

```ts
export type ConsecutiveGroup<T, K> = { key: K; items: T[] };

export function groupConsecutiveBy<T, K>(
  items: readonly T[],
  key: (t: T) => K,
): ConsecutiveGroup<T, K>[] {
  if (items.length === 0) return [];
  const groups: ConsecutiveGroup<T, K>[] = [];
  let currentKey = key(items[0]);
  let currentItems: T[] = [items[0]];
  for (let i = 1; i < items.length; i++) {
    const k = key(items[i]);
    if (k === currentKey) {
      currentItems.push(items[i]);
    } else {
      groups.push({ key: currentKey, items: currentItems });
      currentKey = k;
      currentItems = [items[i]];
    }
  }
  groups.push({ key: currentKey, items: currentItems });
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsx --test src/lib/playground/groupConsecutive.test.ts`

Expected: `tests 4`, `pass 4`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/playground/groupConsecutive.ts src/lib/playground/groupConsecutive.test.ts
git commit -m "$(cat <<'EOF'
feat(playground): add groupConsecutiveBy pure helper

Groups items by runs of the same key while preserving original order.
Used by the gallery to render member-group headers without re-sorting
admin-controlled pin_order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Pure helper — `normalizePinInput`

**Files:**
- Create: `src/lib/playground/normalizePinInput.ts`
- Test: `src/lib/playground/normalizePinInput.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/playground/normalizePinInput.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePinInput } from "./normalizePinInput";

test("undefined → null", () => {
  assert.equal(normalizePinInput(undefined), null);
});

test("empty string → null", () => {
  assert.equal(normalizePinInput(""), null);
});

test("whitespace-only → null", () => {
  assert.equal(normalizePinInput("   \t  "), null);
});

test("trims surrounding whitespace", () => {
  assert.equal(normalizePinInput("  hello  "), "hello");
});

test("collapses newlines to single space", () => {
  assert.equal(normalizePinInput("hi\nworld"), "hi world");
  assert.equal(normalizePinInput("hi\r\nworld"), "hi world");
  assert.equal(normalizePinInput("hi\rworld"), "hi world");
});

test("collapses consecutive newlines into single space", () => {
  assert.equal(normalizePinInput("a\n\n\nb"), "a b");
});

test("preserves internal single spaces but trims surroundings + newlines", () => {
  assert.equal(normalizePinInput("  hi  \nworld  "), "hi   world");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsx --test src/lib/playground/normalizePinInput.test.ts`

Expected: FAIL with `Cannot find module './normalizePinInput'`.

- [ ] **Step 3: Implement `normalizePinInput.ts`**

Create `src/lib/playground/normalizePinInput.ts`:

```ts
/**
 * Trim + collapse newlines for member-pin override_title / caption inputs.
 * Returns null when the result is empty so the caller can store SQL NULL
 * (which lets the gallery fall back to layout.title for missing override).
 *
 * Note: only newlines are collapsed to a single space — internal
 * consecutive spaces are preserved (admin's choice, not noise).
 */
export function normalizePinInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const collapsed = raw.replace(/(?:\r\n|\r|\n)+/g, " ");
  const trimmed = collapsed.trim();
  return trimmed.length === 0 ? null : trimmed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsx --test src/lib/playground/normalizePinInput.test.ts`

Expected: `tests 7`, `pass 7`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/playground/normalizePinInput.ts src/lib/playground/normalizePinInput.test.ts
git commit -m "$(cat <<'EOF'
feat(playground): add normalizePinInput helper

Trim + collapse newlines + empty→null normalization for member-pin
override_title and caption inputs. Empty result becomes SQL NULL so the
gallery can fall back to the original layout.title.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Backend reads — `memberPins.ts` (gallery + share-page path)

**Files:**
- Create: `src/lib/playground/memberPins.ts`

This task only adds the **read** functions used by public pages. Admin write functions land in Task 5.

- [ ] **Step 1: Create `memberPins.ts` with the read helpers**

Create `src/lib/playground/memberPins.ts`:

```ts
import "server-only";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export type MemberPinView = {
  pin_id: number;
  layout_id: number;
  share_token: string;
  title: string;          // override_title?.trim() || layout.title
  caption: string | null; // null if empty
  pin_order: number;
  member: {
    id: number;
    nameKr: string;
    nameEn: string;
    position: string;
    photoUrl: string;
  };
  board: {
    image_filename: string | null;
    name: string;
    brand: string;
  };
  updated_at: Date;
};

type PinRow = RowDataPacket & {
  pin_id: number;
  layout_id: number;
  override_title: string | null;
  caption: string | null;
  pin_order: number;
  updated_at: Date;
  share_token: string;
  layout_title: string;
  board_image_filename: string | null;
  board_name: string | null;
  board_brand: string | null;
  member_id: number;
  name_kr: string;
  name_en: string;
  position: string;
  photo_url: string;
};

/**
 * Gallery top-corner data. Excludes pins whose member is unpublished
 * (JOIN condition) or whose layout has no snapshot (WHERE).
 * Sorted by admin-controlled pin_order then pin.id.
 */
export async function getPublishedMemberPins(): Promise<MemberPinView[]> {
  const [rows] = await getPool().query<PinRow[]>(
    `SELECT p.id           AS pin_id,
            p.layout_id,
            p.override_title,
            p.caption,
            p.pin_order,
            p.updated_at,
            l.share_token,
            l.title        AS layout_title,
            b.image_filename AS board_image_filename,
            b.name           AS board_name,
            br.name          AS board_brand,
            m.id             AS member_id,
            m.name_kr,
            m.name_en,
            m.position,
            m.photo_url
       FROM playground_member_pins p
       JOIN playground_layouts l       ON l.id = p.layout_id
       JOIN members m                  ON m.id = p.member_id AND m.published = 1
       LEFT JOIN playground_boards b   ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.snapshot_json IS NOT NULL
      ORDER BY p.pin_order ASC, p.id ASC`,
  );
  return rows.map((r) => {
    const override = r.override_title?.trim() ?? "";
    const cap = r.caption?.trim() ?? "";
    return {
      pin_id: Number(r.pin_id),
      layout_id: Number(r.layout_id),
      share_token: String(r.share_token),
      title: override.length > 0 ? override : String(r.layout_title),
      caption: cap.length > 0 ? cap : null,
      pin_order: Number(r.pin_order),
      member: {
        id: Number(r.member_id),
        nameKr: String(r.name_kr),
        nameEn: String(r.name_en),
        position: String(r.position),
        photoUrl: String(r.photo_url),
      },
      board: {
        image_filename: r.board_image_filename
          ? String(r.board_image_filename)
          : null,
        name: r.board_name ? String(r.board_name) : "보드 정보 없음",
        brand: r.board_brand ? String(r.board_brand) : "",
      },
      updated_at: new Date(r.updated_at),
    };
  });
}

/** Used by gallery's bottom section to exclude pinned layouts. */
export async function getPinnedLayoutIds(): Promise<Set<number>> {
  const [rows] = await getPool().query<(RowDataPacket & { layout_id: number })[]>(
    `SELECT DISTINCT layout_id FROM playground_member_pins`,
  );
  return new Set(rows.map((r) => Number(r.layout_id)));
}

/** Used by /playground/p/[shareToken] to grant access to pinned private layouts. */
export async function isLayoutPinned(layoutId: number): Promise<boolean> {
  const [rows] = await getPool().query<(RowDataPacket & { ok: number })[]>(
    `SELECT 1 AS ok FROM playground_member_pins WHERE layout_id = ? LIMIT 1`,
    [layoutId],
  );
  return rows.length > 0;
}
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors (or only pre-existing ones unrelated to this file — `git stash && pnpm exec tsc --noEmit && git stash pop` to compare if uncertain).

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/playground/memberPins.ts
git commit -m "$(cat <<'EOF'
feat(playground): add memberPins read helpers

getPublishedMemberPins / getPinnedLayoutIds / isLayoutPinned used by
the gallery top-corner section and the pinned-layout share-page
exception.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Backend writes — admin pin CRUD + lookup

**Files:**
- Modify: `src/lib/playground/memberPins.ts`

- [ ] **Step 1: Append admin helpers to `memberPins.ts`**

Append the following block to the **end** of `src/lib/playground/memberPins.ts` (after `isLayoutPinned`):

```ts

// ── Admin helpers ────────────────────────────────────────────────────────

import type { ResultSetHeader } from "mysql2";
import { normalizePinInput } from "./normalizePinInput";

export type AdminPinRow = {
  pin_id: number;
  layout_id: number;
  member_id: number;
  member_name_kr: string;
  member_name_en: string;
  member_position: string;
  member_photo_url: string;
  member_published: boolean;
  override_title: string | null;
  caption: string | null;
  pin_order: number;
  share_token: string;
  layout_title: string;
  board_name: string;       // "보드 정보 없음" if LEFT JOIN missed
  board_brand: string;      // "" if LEFT JOIN missed
  board_image_filename: string | null;
  updated_at: Date;
};

type AdminPinSqlRow = RowDataPacket & {
  pin_id: number;
  layout_id: number;
  override_title: string | null;
  caption: string | null;
  pin_order: number;
  updated_at: Date;
  share_token: string;
  layout_title: string;
  board_name: string | null;
  board_brand: string | null;
  board_image_filename: string | null;
  member_id: number;
  member_name_kr: string;
  member_name_en: string;
  member_position: string;
  member_photo_url: string;
  member_published: number;
};

export async function getAllMemberPinsForAdmin(): Promise<AdminPinRow[]> {
  const [rows] = await getPool().query<AdminPinSqlRow[]>(
    `SELECT p.id           AS pin_id,
            p.layout_id,
            p.override_title,
            p.caption,
            p.pin_order,
            p.updated_at,
            l.share_token,
            l.title        AS layout_title,
            b.name           AS board_name,
            br.name          AS board_brand,
            b.image_filename AS board_image_filename,
            m.id             AS member_id,
            m.name_kr        AS member_name_kr,
            m.name_en        AS member_name_en,
            m.position       AS member_position,
            m.photo_url      AS member_photo_url,
            m.published      AS member_published
       FROM playground_member_pins p
       JOIN playground_layouts l       ON l.id = p.layout_id
       JOIN members m                  ON m.id = p.member_id
       LEFT JOIN playground_boards b   ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      ORDER BY p.pin_order ASC, p.id ASC`,
  );
  return rows.map((r) => ({
    pin_id: Number(r.pin_id),
    layout_id: Number(r.layout_id),
    member_id: Number(r.member_id),
    member_name_kr: String(r.member_name_kr),
    member_name_en: String(r.member_name_en),
    member_position: String(r.member_position),
    member_photo_url: String(r.member_photo_url),
    member_published: r.member_published === 1,
    override_title: r.override_title,
    caption: r.caption,
    pin_order: Number(r.pin_order),
    share_token: String(r.share_token),
    layout_title: String(r.layout_title),
    board_name: r.board_name ? String(r.board_name) : "보드 정보 없음",
    board_brand: r.board_brand ? String(r.board_brand) : "",
    board_image_filename: r.board_image_filename ? String(r.board_image_filename) : null,
    updated_at: new Date(r.updated_at),
  }));
}

export type LayoutLookup = {
  id: number;
  title: string;
  share_token: string;
  visibility: "private" | "unlisted" | "public";
  board_name: string;
  board_brand: string;
  updated_at: Date;
  has_snapshot: boolean;
};

export async function lookupLayoutForPin(layoutId: number): Promise<LayoutLookup | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.share_token, l.visibility, l.snapshot_json,
            l.updated_at,
            b.name  AS board_name,
            br.name AS board_brand
       FROM playground_layouts l
       LEFT JOIN playground_boards b ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.id = ? LIMIT 1`,
    [layoutId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    title: String(r.title),
    share_token: String(r.share_token),
    visibility: r.visibility as LayoutLookup["visibility"],
    board_name: r.board_name ? String(r.board_name) : "보드 정보 없음",
    board_brand: r.board_brand ? String(r.board_brand) : "",
    updated_at: new Date(r.updated_at),
    has_snapshot: r.snapshot_json !== null,
  };
}

export type CreatePinInput = {
  layout_id: number;
  member_id: number;
  override_title: string | null;
  caption: string | null;
};

export type CreatePinResult =
  | { ok: true; id: number }
  | { ok: false; code: "LAYOUT_NOT_FOUND" | "MEMBER_NOT_FOUND" | "DUPLICATE"; existingPinId?: number };

export async function createMemberPin(input: CreatePinInput): Promise<CreatePinResult> {
  const pool = getPool();

  // Validate existence first (returns sharper error than relying on FK violation).
  const [layouts] = await pool.query<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM playground_layouts WHERE id = ? LIMIT 1`,
    [input.layout_id],
  );
  if (layouts.length === 0) return { ok: false, code: "LAYOUT_NOT_FOUND" };

  const [members] = await pool.query<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM members WHERE id = ? LIMIT 1`,
    [input.member_id],
  );
  if (members.length === 0) return { ok: false, code: "MEMBER_NOT_FOUND" };

  // Use COALESCE-style "next pin_order = max+1" to append at end of admin order.
  const [maxRows] = await pool.query<(RowDataPacket & { mx: number | null })[]>(
    `SELECT COALESCE(MAX(pin_order), -1) AS mx FROM playground_member_pins`,
  );
  const nextOrder = Number(maxRows[0]?.mx ?? -1) + 1;

  const overrideTitle = normalizePinInput(input.override_title);
  const caption = normalizePinInput(input.caption);

  try {
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO playground_member_pins (layout_id, member_id, override_title, caption, pin_order)
       VALUES (?, ?, ?, ?, ?)`,
      [input.layout_id, input.member_id, overrideTitle, caption, nextOrder],
    );
    return { ok: true, id: Number(res.insertId) };
  } catch (e) {
    const errno = (e as { errno?: number }).errno;
    // ER_DUP_ENTRY 1062 — UNIQUE (layout_id, member_id) violation.
    if (errno === 1062) {
      const [dup] = await pool.query<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM playground_member_pins WHERE layout_id = ? AND member_id = ? LIMIT 1`,
        [input.layout_id, input.member_id],
      );
      return { ok: false, code: "DUPLICATE", existingPinId: dup[0] ? Number(dup[0].id) : undefined };
    }
    throw e;
  }
}

export type UpdatePinInput = {
  member_id: number;
  override_title: string | null;
  caption: string | null;
};

export type UpdatePinResult =
  | { ok: true }
  | { ok: false; code: "PIN_NOT_FOUND" | "MEMBER_NOT_FOUND" | "DUPLICATE"; existingPinId?: number };

export async function updateMemberPin(pinId: number, input: UpdatePinInput): Promise<UpdatePinResult> {
  const pool = getPool();
  const [existing] = await pool.query<(RowDataPacket & { id: number; layout_id: number })[]>(
    `SELECT id, layout_id FROM playground_member_pins WHERE id = ? LIMIT 1`,
    [pinId],
  );
  if (existing.length === 0) return { ok: false, code: "PIN_NOT_FOUND" };

  const [members] = await pool.query<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM members WHERE id = ? LIMIT 1`,
    [input.member_id],
  );
  if (members.length === 0) return { ok: false, code: "MEMBER_NOT_FOUND" };

  const overrideTitle = normalizePinInput(input.override_title);
  const caption = normalizePinInput(input.caption);

  try {
    await pool.query(
      `UPDATE playground_member_pins
          SET member_id = ?, override_title = ?, caption = ?
        WHERE id = ?`,
      [input.member_id, overrideTitle, caption, pinId],
    );
    return { ok: true };
  } catch (e) {
    const errno = (e as { errno?: number }).errno;
    if (errno === 1062) {
      const [dup] = await pool.query<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM playground_member_pins
          WHERE layout_id = ? AND member_id = ? AND id <> ?
          LIMIT 1`,
        [existing[0].layout_id, input.member_id, pinId],
      );
      return { ok: false, code: "DUPLICATE", existingPinId: dup[0] ? Number(dup[0].id) : undefined };
    }
    throw e;
  }
}

export async function deleteMemberPin(pinId: number): Promise<void> {
  await getPool().query(
    `DELETE FROM playground_member_pins WHERE id = ?`,
    [pinId],
  );
}

/** Swaps pin_order with the adjacent pin (up=lower order, down=higher). No-op at edges. */
export async function swapMemberPinOrder(pinId: number, direction: "up" | "down"): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [self] = await conn.query<(RowDataPacket & { id: number; pin_order: number })[]>(
      `SELECT id, pin_order FROM playground_member_pins WHERE id = ? FOR UPDATE`,
      [pinId],
    );
    if (!self[0]) {
      await conn.rollback();
      return;
    }
    const op = direction === "up" ? "<" : ">";
    const order = direction === "up" ? "DESC" : "ASC";
    const [neighbor] = await conn.query<(RowDataPacket & { id: number; pin_order: number })[]>(
      `SELECT id, pin_order FROM playground_member_pins
        WHERE pin_order ${op} ? OR (pin_order = ? AND id ${op} ?)
        ORDER BY pin_order ${order}, id ${order} LIMIT 1 FOR UPDATE`,
      [self[0].pin_order, self[0].pin_order, pinId],
    );
    if (!neighbor[0]) {
      await conn.commit();
      return;
    }
    await conn.query(
      `UPDATE playground_member_pins SET pin_order = ? WHERE id = ?`,
      [neighbor[0].pin_order, self[0].id],
    );
    await conn.query(
      `UPDATE playground_member_pins SET pin_order = ? WHERE id = ?`,
      [self[0].pin_order, neighbor[0].id],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    const errno = (e as { errno?: number }).errno;
    if (errno === 1213) {
      // InnoDB deadlock — opposing swap. Treat as no-op; admin can retry.
      return;
    }
    throw e;
  } finally {
    conn.release();
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/playground/memberPins.ts
git commit -m "$(cat <<'EOF'
feat(playground): add memberPins admin helpers (CRUD + swap + lookup)

createMemberPin returns sharp error codes (LAYOUT_NOT_FOUND /
MEMBER_NOT_FOUND / DUPLICATE) instead of bubbling FK / UNIQUE errors.
swapMemberPinOrder uses the same FOR UPDATE transactional pattern as
swapMemberOrder, with the same 1213 deadlock no-op safeguard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Share-page exception for pinned private layouts

**Files:**
- Modify: `src/app/playground/p/[shareToken]/page.tsx`

- [ ] **Step 1: Read the current file to confirm line numbers**

```bash
cd /root/bandsustain/public_html/bandsustain
sed -n '1,30p' src/app/playground/p/[shareToken]/page.tsx
```

- [ ] **Step 2: Edit `loadLayout` to allow pinned private**

Replace the import block and `loadLayout` function. The current file content (verbatim) is in `src/app/playground/p/[shareToken]/page.tsx:1-21`. Apply this edit:

OLD lines 1-21:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLayoutByShareToken } from "@/lib/playground/playgroundDb";
import { parseSnapshot } from "@/lib/playground/layoutSerializer";
import { ShareView } from "@/components/playground/pedalboard/ShareView";
import { isValidToken } from "@/lib/playground/tokens";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadLayout(token: string) {
  if (!isValidToken(token)) return null;
  const row = await getLayoutByShareToken(token);
  if (!row) return null;
  if (row.visibility === "private") return null;
  if (!row.snapshot_json) return null;
  try {
    return { row, layout: parseSnapshot(row.snapshot_json) };
  } catch { return null; }
}
```

NEW:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLayoutByShareToken } from "@/lib/playground/playgroundDb";
import { parseSnapshot } from "@/lib/playground/layoutSerializer";
import { ShareView } from "@/components/playground/pedalboard/ShareView";
import { isValidToken } from "@/lib/playground/tokens";
import { isLayoutPinned } from "@/lib/playground/memberPins";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadLayout(token: string) {
  if (!isValidToken(token)) return null;
  const row = await getLayoutByShareToken(token);
  if (!row) return null;
  if (!row.snapshot_json) return null;
  if (row.visibility === "private") {
    const pinned = await isLayoutPinned(Number(row.id));
    if (!pinned) return null;
  }
  try {
    return { row, layout: parseSnapshot(row.snapshot_json) };
  } catch { return null; }
}
```

- [ ] **Step 3: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/app/playground/p/\[shareToken\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(playground): allow pinned private layouts on share page

If a private layout is pinned (admin curation), the share-page route
serves it normally. Unpinning a private layout returns it to 404.
Public and unlisted behavior unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: OG image exception for pinned private layouts

**Files:**
- Modify: `src/app/playground/p/[shareToken]/opengraph-image.tsx`

- [ ] **Step 1: Edit the gate condition**

In `src/app/playground/p/[shareToken]/opengraph-image.tsx:6` add the import, and on the gate line (currently `src/app/playground/p/[shareToken]/opengraph-image.tsx:26` — `if (row && row.visibility !== "private" && row.snapshot_json) {`) replace with a version that allows pinned private:

OLD (line 6):

```tsx
import { isValidToken } from "@/lib/playground/tokens";
```

NEW (line 6, add one import below it):

```tsx
import { isValidToken } from "@/lib/playground/tokens";
import { isLayoutPinned } from "@/lib/playground/memberPins";
```

OLD (around line 25-26):

```tsx
      const row = await getLayoutByShareToken(shareToken);
      if (row && row.visibility !== "private" && row.snapshot_json) {
```

NEW:

```tsx
      const row = await getLayoutByShareToken(shareToken);
      const allowPrivate = row && row.visibility === "private"
        ? await isLayoutPinned(Number(row.id))
        : false;
      if (row && row.snapshot_json && (row.visibility !== "private" || allowPrivate)) {
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/app/playground/p/\[shareToken\]/opengraph-image.tsx
git commit -m "$(cat <<'EOF'
feat(playground): OG image honors pin exception for private layouts

Pinned private layouts get a real OG (board image + pedals) instead of
the neutral fallback card. Unpinned private still renders the neutral
card.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Gallery — top "Sustain Member Pedalboards" section + exclude pinned from bottom

**Files:**
- Modify: `src/app/playground/pedalboard-planner/gallery/page.tsx`

- [ ] **Step 1: Replace the file content**

Replace the **entire content** of `src/app/playground/pedalboard-planner/gallery/page.tsx` with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { LayoutGrid, type LayoutCard } from "@/components/playground/pedalboard/LayoutGrid";
import { MemberPinSection } from "@/components/playground/pedalboard/MemberPinSection";
import { getPublishedMemberPins } from "@/lib/playground/memberPins";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "페달보드 갤러리",
  path: "/playground/pedalboard-planner/gallery",
  description: "공개된 페달보드 레이아웃 모음",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

async function loadPublicExcludingPins(): Promise<LayoutCard[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.share_token, l.visibility, l.updated_at,
            b.image_filename AS board_image_filename, b.name AS board_name, br.name AS board_brand
       FROM playground_layouts l
       LEFT JOIN playground_boards b ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.visibility = 'public'
        AND l.id NOT IN (SELECT layout_id FROM playground_member_pins)
      ORDER BY l.updated_at DESC LIMIT 50`);
  return rows as unknown as LayoutCard[];
}

export default async function Page() {
  const [pins, items] = await Promise.all([
    getPublishedMemberPins(),
    loadPublicExcludingPins(),
  ]);
  const hasPins = pins.length > 0;
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-8 md:flex md:items-end md:justify-between md:gap-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">갤러리</h1>
        <nav className="mt-5 md:mt-0 flex flex-wrap gap-3 md:shrink-0">
          <Link href="/playground/pedalboard-planner"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold uppercase tracking-wider border border-[var(--color-border-strong)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">
            보드 고르기
          </Link>
          <Link href="/playground/pedalboard-planner/me"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold uppercase tracking-wider border border-[var(--color-border-strong)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">
            내 보드
          </Link>
        </nav>
      </header>

      {hasPins && (
        <>
          <MemberPinSection pins={pins} />
          <hr className="my-12 border-[var(--color-border)]" />
          <h2 className="font-display font-black uppercase tracking-tight text-2xl md:text-3xl mb-6">
            최근 공개 보드
          </h2>
        </>
      )}

      <LayoutGrid items={items}
        hrefBuilder={(it) => `/playground/p/${it.share_token}`}
        emptyMessage="공개 보드가 아직 없습니다." />
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: error — `Cannot find module ... MemberPinSection` (that's deliberate; we add the component in Task 9). Skip step 3 until Task 9 lands.

- [ ] **Step 3: Stage but do NOT commit yet**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/app/playground/pedalboard-planner/gallery/page.tsx
```

The commit ships together with Task 9 (component must exist for type-check / build to pass).

---

## Task 9: `MemberPinSection` + `MemberPinCard` components

**Files:**
- Create: `src/components/playground/pedalboard/MemberPinCard.tsx`
- Create: `src/components/playground/pedalboard/MemberPinSection.tsx`

- [ ] **Step 1: Create `MemberPinCard.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import type { MemberPinView } from "@/lib/playground/memberPins";

export function MemberPinCard({ pin }: { pin: MemberPinView }) {
  return (
    <li>
      <Link href={`/playground/p/${pin.share_token}`} className="block">
        <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
          {pin.board.image_filename && (
            <Image
              src={`/playground/images/pedalboards/${pin.board.image_filename}`}
              alt={`${pin.board.brand} ${pin.board.name}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          )}
        </div>
        <div className="mt-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          {pin.board.brand} {pin.board.name}
        </div>
        <div className="font-semibold text-base truncate">{pin.title}</div>
        {pin.caption && (
          <div className="text-sm text-[var(--color-text-muted)] line-clamp-2 mt-1">
            {pin.caption}
          </div>
        )}
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Create `MemberPinSection.tsx`**

```tsx
import Image from "next/image";
import type { MemberPinView } from "@/lib/playground/memberPins";
import { groupConsecutiveBy } from "@/lib/playground/groupConsecutive";
import { MemberPinCard } from "./MemberPinCard";

export function MemberPinSection({ pins }: { pins: MemberPinView[] }) {
  if (pins.length === 0) return null;
  const groups = groupConsecutiveBy(pins, (p) => p.member.id);
  return (
    <section className="mb-12" aria-labelledby="member-pin-section-heading">
      <h2
        id="member-pin-section-heading"
        className="font-display font-black uppercase tracking-tight text-2xl md:text-3xl mb-6"
      >
        서스테인 멤버 페달보드
      </h2>
      <div className="space-y-10">
        {groups.map((g, idx) => {
          const m = g.items[0].member;
          return (
            <div key={`${m.id}-${idx}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-12 h-12 bg-[var(--color-bg-muted)] shrink-0">
                  <Image
                    src={m.photoUrl}
                    alt={m.nameKr}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div>
                  <div className="font-semibold text-base">{m.nameKr}</div>
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    {m.position}
                  </div>
                </div>
              </div>
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {g.items.map((pin) => (
                  <MemberPinCard key={pin.pin_id} pin={pin} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Type-check + sanity build**

Run:

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm exec tsc --noEmit
```

Expected: no errors. Now gallery page from Task 8 also resolves.

- [ ] **Step 4: Commit (gallery + components together)**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/components/playground/pedalboard/MemberPinCard.tsx \
        src/components/playground/pedalboard/MemberPinSection.tsx
# gallery page was staged in Task 8 step 3 — confirm:
git status --short
git commit -m "$(cat <<'EOF'
feat(playground): gallery member-pins corner + components

Top section renders Sustain member pedalboards grouped by consecutive
admin pin_order. Bottom section keeps the recent-public grid, now
excluding pinned ids. Section heading appears only when there is at
least one pin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Admin server actions

**Files:**
- Create: `src/app/admin/(authed)/pedalboard-pins/actions.ts`

- [ ] **Step 1: Create the actions file**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import {
  createMemberPin,
  updateMemberPin,
  deleteMemberPin,
  swapMemberPinOrder,
  lookupLayoutForPin,
  type LayoutLookup,
} from "@/lib/playground/memberPins";

const TITLE_MAX = 200;
const CAPTION_MAX = 200;

async function requireAuth() {
  const s = await readSession();
  if (!s) throw new Error("UNAUTHENTICATED");
}

const createSchema = z.object({
  member_id: z.coerce.number().int().positive(),
  layout_id: z.coerce.number().int().positive(),
  override_title: z.string().max(TITLE_MAX, `제목은 ${TITLE_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
  caption: z.string().max(CAPTION_MAX, `캡션은 ${CAPTION_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
});

const updateSchema = z.object({
  member_id: z.coerce.number().int().positive(),
  override_title: z.string().max(TITLE_MAX, `제목은 ${TITLE_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
  caption: z.string().max(CAPTION_MAX, `캡션은 ${CAPTION_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function fromCreate(fd: FormData) {
  return {
    member_id: fd.get("member_id"),
    layout_id: fd.get("layout_id"),
    override_title: fd.get("override_title") ?? "",
    caption: fd.get("caption") ?? "",
  };
}

function fromUpdate(fd: FormData) {
  return {
    member_id: fd.get("member_id"),
    override_title: fd.get("override_title") ?? "",
    caption: fd.get("caption") ?? "",
  };
}

function buildFieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const issue of issues) fe[issue.path.join(".")] = issue.message;
  return fe;
}

export async function createPinAction(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = createSchema.safeParse(fromCreate(fd));
  if (!parsed.success) {
    return { error: "검증 실패", fieldErrors: buildFieldErrors(parsed.error.issues) };
  }
  const { layout_id, member_id, override_title, caption } = parsed.data;
  const res = await createMemberPin({
    layout_id,
    member_id,
    override_title: override_title || null,
    caption: caption || null,
  });
  if (!res.ok) {
    if (res.code === "LAYOUT_NOT_FOUND") {
      return { error: `layout id #${layout_id}는 존재하지 않습니다`, fieldErrors: { layout_id: "존재하지 않는 layout id" } };
    }
    if (res.code === "MEMBER_NOT_FOUND") {
      return { error: "멤버를 다시 선택해주세요", fieldErrors: { member_id: "존재하지 않는 멤버" } };
    }
    if (res.code === "DUPLICATE") {
      return {
        error: res.existingPinId
          ? `이 멤버에게 이미 등록된 페달보드입니다 (pin #${res.existingPinId})`
          : "이 멤버에게 이미 등록된 페달보드입니다",
        fieldErrors: { layout_id: "이 조합은 이미 등록됨" },
      };
    }
  }
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath("/playground/pedalboard-planner/gallery");
  return {};
}

export async function updatePinAction(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = updateSchema.safeParse(fromUpdate(fd));
  if (!parsed.success) {
    return { error: "검증 실패", fieldErrors: buildFieldErrors(parsed.error.issues) };
  }
  const { member_id, override_title, caption } = parsed.data;
  const res = await updateMemberPin(id, {
    member_id,
    override_title: override_title || null,
    caption: caption || null,
  });
  if (!res.ok) {
    if (res.code === "PIN_NOT_FOUND") return { error: "이미 삭제된 핀입니다" };
    if (res.code === "MEMBER_NOT_FOUND") {
      return { error: "멤버를 다시 선택해주세요", fieldErrors: { member_id: "존재하지 않는 멤버" } };
    }
    if (res.code === "DUPLICATE") {
      return {
        error: res.existingPinId
          ? `이 멤버에게 이미 등록된 페달보드입니다 (pin #${res.existingPinId})`
          : "이 멤버에게 이미 등록된 페달보드입니다",
        fieldErrors: { member_id: "이 조합은 이미 등록됨" },
      };
    }
  }
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath(`/admin/pedalboard-pins/${id}`);
  revalidatePath("/playground/pedalboard-planner/gallery");
  redirect("/admin/pedalboard-pins");
}

export async function deletePinAction(id: number) {
  await requireAuth();
  await deleteMemberPin(id);
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath("/playground/pedalboard-planner/gallery");
}

export async function swapPinOrderAction(id: number, direction: "up" | "down") {
  await requireAuth();
  await swapMemberPinOrder(id, direction);
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath("/playground/pedalboard-planner/gallery");
}

export async function lookupLayoutAction(layoutId: number): Promise<{ ok: true; layout: LayoutLookup } | { ok: false; error: string }> {
  await requireAuth();
  if (!Number.isFinite(layoutId) || layoutId <= 0) {
    return { ok: false, error: "올바른 layout id를 입력해주세요" };
  }
  const lookup = await lookupLayoutForPin(layoutId);
  if (!lookup) return { ok: false, error: `layout id #${layoutId}는 존재하지 않습니다` };
  if (!lookup.has_snapshot) return { ok: false, error: `layout #${layoutId}는 아직 저장되지 않은 보드입니다` };
  return { ok: true, layout: lookup };
}
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/app/admin/\(authed\)/pedalboard-pins/actions.ts
git commit -m "$(cat <<'EOF'
feat(admin): pedalboard pins server actions

createPinAction / updatePinAction / deletePinAction / swapPinOrderAction
/ lookupLayoutAction. Each maps the lib-level error codes
(LAYOUT_NOT_FOUND / MEMBER_NOT_FOUND / DUPLICATE / PIN_NOT_FOUND) to
Korean user-facing messages and field-level errors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Admin list + inline new-pin form

**Files:**
- Create: `src/app/admin/(authed)/pedalboard-pins/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";
import Image from "next/image";
import { getAllMembersForAdmin } from "@/lib/members";
import { getAllMemberPinsForAdmin } from "@/lib/playground/memberPins";
import { createPinAction, deletePinAction, swapPinOrderAction, lookupLayoutAction } from "./actions";
import { NewPinForm } from "./NewPinForm";

export const dynamic = "force-dynamic";

export default async function PedalboardPinsListPage() {
  const [pins, members] = await Promise.all([
    getAllMemberPinsForAdmin(),
    getAllMembersForAdmin(),
  ]);
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Pedalboard Pins</h1>
      </div>

      <section className="mb-10 border border-[var(--color-border)] p-4 md:p-6">
        <h2 className="font-semibold text-lg mb-4">신규 등록</h2>
        <NewPinForm
          members={members}
          createAction={createPinAction}
          lookupAction={lookupLayoutAction}
        />
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-4">목록 ({pins.length}개, pin_order 오름차순)</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-sm">
          <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2 w-16">정렬</th>
              <th className="py-2 w-16">사진</th>
              <th className="py-2 w-40">멤버</th>
              <th className="py-2 w-20">layout</th>
              <th className="py-2 w-48">보드</th>
              <th className="py-2">제목</th>
              <th className="py-2">캡션</th>
              <th className="py-2 w-32 text-right">동작</th>
            </tr>
          </thead>
          <tbody>
            {pins.map((p, i) => {
              const isFirst = i === 0;
              const isLast = i === pins.length - 1;
              const titleShown = p.override_title?.trim() || p.layout_title;
              return (
                <tr key={p.pin_id} className="border-b border-[var(--color-border)]">
                  <td className="py-3">
                    <form className="inline-flex items-center gap-1" action={async () => {
                      "use server";
                      await swapPinOrderAction(p.pin_id, "up");
                    }}>
                      <button type="submit" disabled={isFirst} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▲</button>
                    </form>
                    <form className="inline-flex items-center gap-1 ml-1" action={async () => {
                      "use server";
                      await swapPinOrderAction(p.pin_id, "down");
                    }}>
                      <button type="submit" disabled={isLast} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▼</button>
                    </form>
                  </td>
                  <td className="py-3">
                    <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                      <Image src={p.member_photo_url} alt={p.member_name_kr} fill className="object-cover" sizes="48px" />
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-medium">{p.member_name_kr}{!p.member_published && <span className="ml-1 text-xs text-[var(--color-text-muted)]">(비공개)</span>}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{p.member_position}</div>
                  </td>
                  <td className="py-3 tabular-nums">
                    <Link href={`/playground/p/${p.share_token}`} target="_blank" className="underline">
                      #{p.layout_id}
                    </Link>
                  </td>
                  <td className="py-3 text-[var(--color-text-muted)]">{p.board_brand} {p.board_name}</td>
                  <td className="py-3">{titleShown}</td>
                  <td className="py-3 text-[var(--color-text-muted)]">{p.caption ?? ""}</td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/pedalboard-pins/${p.pin_id}`} className="ml-2 px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                    <form className="inline-block ml-1" action={async () => {
                      "use server";
                      await deletePinAction(p.pin_id);
                    }}>
                      <button type="submit" className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">삭제</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {pins.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-[var(--color-text-muted)]">등록된 핀이 없습니다.</td></tr>
            )}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create the `NewPinForm` client component**

Create `src/app/admin/(authed)/pedalboard-pins/NewPinForm.tsx`:

```tsx
"use client";
import { useActionState, useState, useTransition } from "react";
import type { Member } from "@/lib/members";
import type { FormState } from "./actions";
import { createPinAction, lookupLayoutAction } from "./actions";

type LayoutPreview = {
  id: number;
  title: string;
  share_token: string;
  visibility: "private" | "unlisted" | "public";
  board_name: string;
  board_brand: string;
  updated_at: string;
};

export function NewPinForm({
  members,
  createAction,
  lookupAction,
}: {
  members: Member[];
  createAction: typeof createPinAction;
  lookupAction: typeof lookupLayoutAction;
}) {
  const initial: FormState = {};
  const [state, formAction] = useActionState(createAction, initial);
  const [layoutIdRaw, setLayoutIdRaw] = useState("");
  const [preview, setPreview] = useState<LayoutPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLookup() {
    setPreview(null);
    setPreviewError(null);
    const id = Number(layoutIdRaw);
    if (!Number.isFinite(id) || id <= 0) {
      setPreviewError("올바른 layout id를 입력해주세요");
      return;
    }
    startTransition(async () => {
      const res = await lookupAction(id);
      if (!res.ok) {
        setPreviewError(res.error);
        return;
      }
      setPreview({
        id: res.layout.id,
        title: res.layout.title,
        share_token: res.layout.share_token,
        visibility: res.layout.visibility,
        board_name: res.layout.board_name,
        board_brand: res.layout.board_brand,
        updated_at: res.layout.updated_at.toString(),
      });
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1">멤버</span>
          <select name="member_id" required defaultValue="" className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2">
            <option value="" disabled>멤버 선택…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.nameKr} · {m.position}{!m.published && " (비공개)"}</option>
            ))}
          </select>
          {state.fieldErrors?.member_id && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.member_id}</p>}
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">Layout ID</span>
          <div className="flex gap-2">
            <input
              type="number"
              name="layout_id"
              required
              min={1}
              value={layoutIdRaw}
              onChange={(e) => { setLayoutIdRaw(e.target.value); setPreview(null); setPreviewError(null); }}
              className="flex-1 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2"
            />
            <button type="button" onClick={handleLookup} disabled={isPending} className="px-4 py-2 text-sm font-semibold uppercase tracking-wider border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50">
              {isPending ? "..." : "확인"}
            </button>
          </div>
          {previewError && <p className="mt-1 text-sm text-red-700">{previewError}</p>}
          {preview && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              ✓ Layout #{preview.id} · &quot;{preview.title}&quot; · {preview.board_brand} {preview.board_name} · {preview.visibility}
            </p>
          )}
          {state.fieldErrors?.layout_id && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.layout_id}</p>}
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Override 타이틀 <span className="text-[var(--color-text-muted)]">(비우면 원본 layout title 사용, 200자 이내)</span></span>
        <input type="text" name="override_title" maxLength={200} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.override_title && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.override_title}</p>}
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">캡션 <span className="text-[var(--color-text-muted)]">(200자 이내, 한 줄 정도)</span></span>
        <input type="text" name="caption" maxLength={200} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.caption && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.caption}</p>}
      </label>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button type="submit" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
        + 추가
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/app/admin/\(authed\)/pedalboard-pins/page.tsx \
        src/app/admin/\(authed\)/pedalboard-pins/NewPinForm.tsx
git commit -m "$(cat <<'EOF'
feat(admin): pedalboard pins list page + new-pin form

List with ▲/▼ swap + edit + delete. Inline new-pin form with member
select, layout id confirm button (lookupLayoutAction preview line),
override title, caption. Unpublished members shown with (비공개) suffix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Admin edit page

**Files:**
- Create: `src/app/admin/(authed)/pedalboard-pins/[id]/page.tsx`

- [ ] **Step 1: Add a `getMemberPinByIdForAdmin` lib helper**

Append to `src/lib/playground/memberPins.ts`:

```ts

export async function getMemberPinByIdForAdmin(pinId: number): Promise<AdminPinRow | null> {
  const [rows] = await getPool().query<AdminPinSqlRow[]>(
    `SELECT p.id           AS pin_id,
            p.layout_id,
            p.override_title,
            p.caption,
            p.pin_order,
            p.updated_at,
            l.share_token,
            l.title        AS layout_title,
            b.name           AS board_name,
            br.name          AS board_brand,
            b.image_filename AS board_image_filename,
            m.id             AS member_id,
            m.name_kr        AS member_name_kr,
            m.name_en        AS member_name_en,
            m.position       AS member_position,
            m.photo_url      AS member_photo_url,
            m.published      AS member_published
       FROM playground_member_pins p
       JOIN playground_layouts l       ON l.id = p.layout_id
       JOIN members m                  ON m.id = p.member_id
       LEFT JOIN playground_boards b   ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE p.id = ?
      LIMIT 1`,
    [pinId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    pin_id: Number(r.pin_id),
    layout_id: Number(r.layout_id),
    member_id: Number(r.member_id),
    member_name_kr: String(r.member_name_kr),
    member_name_en: String(r.member_name_en),
    member_position: String(r.member_position),
    member_photo_url: String(r.member_photo_url),
    member_published: r.member_published === 1,
    override_title: r.override_title,
    caption: r.caption,
    pin_order: Number(r.pin_order),
    share_token: String(r.share_token),
    layout_title: String(r.layout_title),
    board_name: r.board_name ? String(r.board_name) : "보드 정보 없음",
    board_brand: r.board_brand ? String(r.board_brand) : "",
    board_image_filename: r.board_image_filename ? String(r.board_image_filename) : null,
    updated_at: new Date(r.updated_at),
  };
}
```

- [ ] **Step 2: Create the edit page**

Create `src/app/admin/(authed)/pedalboard-pins/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAllMembersForAdmin } from "@/lib/members";
import { getMemberPinByIdForAdmin } from "@/lib/playground/memberPins";
import { updatePinAction, deletePinAction } from "../actions";
import { EditPinForm } from "./EditPinForm";

export const dynamic = "force-dynamic";

export default async function EditPedalboardPinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pinId = Number(id);
  if (!Number.isFinite(pinId) || pinId <= 0) notFound();
  const [pin, members] = await Promise.all([
    getMemberPinByIdForAdmin(pinId),
    getAllMembersForAdmin(),
  ]);
  if (!pin) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">핀 편집</h1>
        <Link href="/admin/pedalboard-pins" className="text-sm underline">← 목록</Link>
      </div>

      <section className="mb-8 border border-[var(--color-border)] p-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider mb-3 text-[var(--color-text-muted)]">원본 layout</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm">
          <div><dt className="inline text-[var(--color-text-muted)]">layout id: </dt><dd className="inline">#{pin.layout_id}</dd></div>
          <div><dt className="inline text-[var(--color-text-muted)]">제목: </dt><dd className="inline">{pin.layout_title}</dd></div>
          <div><dt className="inline text-[var(--color-text-muted)]">보드: </dt><dd className="inline">{pin.board_brand} {pin.board_name}</dd></div>
          <div><dt className="inline text-[var(--color-text-muted)]">share: </dt>
            <dd className="inline"><Link href={`/playground/p/${pin.share_token}`} target="_blank" className="underline">열기</Link></dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">layout id 는 변경할 수 없습니다. 다른 layout을 핀하려면 이 핀을 삭제하고 새로 등록하세요.</p>
      </section>

      <EditPinForm pin={pin} members={members} updateAction={updatePinAction} />

      <section className="mt-12 border-t border-[var(--color-border)] pt-6">
        <form action={async () => {
          "use server";
          await deletePinAction(pin.pin_id);
          redirect("/admin/pedalboard-pins");
        }}>
          <button type="submit" className="px-4 py-2 text-sm font-semibold uppercase tracking-wider border border-red-700 text-red-700 hover:bg-red-700 hover:text-white transition-colors">
            이 핀 삭제
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Create `EditPinForm` client component**

Create `src/app/admin/(authed)/pedalboard-pins/[id]/EditPinForm.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import type { Member } from "@/lib/members";
import type { AdminPinRow } from "@/lib/playground/memberPins";
import type { FormState } from "../actions";
import { updatePinAction } from "../actions";

export function EditPinForm({
  pin,
  members,
  updateAction,
}: {
  pin: AdminPinRow;
  members: Member[];
  updateAction: typeof updatePinAction;
}) {
  const initial: FormState = {};
  const bound = updateAction.bind(null, pin.pin_id);
  const [state, formAction] = useActionState(bound, initial);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-1">멤버</span>
        <select name="member_id" required defaultValue={String(pin.member_id)} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2">
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.nameKr} · {m.position}{!m.published && " (비공개)"}</option>
          ))}
        </select>
        {state.fieldErrors?.member_id && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.member_id}</p>}
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Override 타이틀 <span className="text-[var(--color-text-muted)]">(비우면 원본 layout title 사용, 200자 이내)</span></span>
        <input type="text" name="override_title" maxLength={200} defaultValue={pin.override_title ?? ""} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.override_title && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.override_title}</p>}
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">캡션 <span className="text-[var(--color-text-muted)]">(200자 이내)</span></span>
        <input type="text" name="caption" maxLength={200} defaultValue={pin.caption ?? ""} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.caption && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.caption}</p>}
      </label>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button type="submit" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
        저장
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/playground/memberPins.ts \
        src/app/admin/\(authed\)/pedalboard-pins/\[id\]/page.tsx \
        src/app/admin/\(authed\)/pedalboard-pins/\[id\]/EditPinForm.tsx
git commit -m "$(cat <<'EOF'
feat(admin): pedalboard pin edit page

Read-only original layout meta + editable member / override title /
caption + delete. layout_id is intentionally not editable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Admin nav menu item

**Files:**
- Modify: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: Add the menu entry**

In `src/components/admin/AdminNav.tsx:5-15`, the `items` array currently is:

```tsx
const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/songs", label: "Songs" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/live", label: "Live" },
  { href: "/admin/yeongmin-bot", label: "Kim Yeong-min Bot" },
  { href: "/admin/deploy", label: "Deploy" },
];
```

Replace with (insert `Pedalboard Pins` right after `Members`, since pins live conceptually adjacent to members):

```tsx
const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/pedalboard-pins", label: "Pedalboard Pins" },
  { href: "/admin/songs", label: "Songs" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/live", label: "Live" },
  { href: "/admin/yeongmin-bot", label: "Kim Yeong-min Bot" },
  { href: "/admin/deploy", label: "Deploy" },
];
```

- [ ] **Step 2: Type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/components/admin/AdminNav.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add Pedalboard Pins nav entry

Slots between Members and Songs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Invariant verification script

**Files:**
- Create: `scripts/verify-member-pins.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the script**

Create `scripts/verify-member-pins.ts`:

```ts
#!/usr/bin/env -S tsx
// scripts/verify-member-pins.ts
//
// Verifies structural invariants for playground_member_pins.
//
// Usage:
//   pnpm pins:verify
//   pnpm pins:verify -- --creds=/path/to/.db_credentials

import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

function loadCreds(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const k of ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]) {
    if (!out[k]) throw new Error(`Missing ${k} in credentials file`);
  }
  return out;
}

async function main() {
  const credsArg = process.argv.find((a) => a.startsWith("--creds="));
  const path =
    credsArg
      ? credsArg.slice("--creds=".length)
      : process.env.DB_CREDENTIALS_PATH
        ?? "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";
  const c = loadCreds(path);
  const conn = await mysql.createConnection({
    host: c.DB_HOST,
    user: c.DB_USER,
    password: c.DB_PASS,
    database: c.DB_NAME,
  });

  const failChecks: { name: string; sql: string }[] = [
    {
      name: "no orphan layout_id (FK)",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             LEFT JOIN playground_layouts l ON l.id = p.layout_id
            WHERE l.id IS NULL`,
    },
    {
      name: "no orphan member_id (FK)",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             LEFT JOIN members m ON m.id = p.member_id
            WHERE m.id IS NULL`,
    },
    {
      name: "UNIQUE (layout_id, member_id) holds",
      sql: `SELECT COUNT(*) AS n FROM (
              SELECT layout_id, member_id FROM playground_member_pins
              GROUP BY layout_id, member_id HAVING COUNT(*) > 1
            ) dup`,
    },
    {
      name: "all pinned layouts have snapshot_json",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             JOIN playground_layouts l ON l.id = p.layout_id
            WHERE l.snapshot_json IS NULL`,
    },
  ];

  const warnChecks: { name: string; sql: string }[] = [
    {
      name: "pins for unpublished members (warning only)",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             JOIN members m ON m.id = p.member_id
            WHERE m.published = 0`,
    },
  ];

  let failed = 0;
  for (const ck of failChecks) {
    const [rows] = await conn.query<any[]>(ck.sql);
    const n = Number(rows[0]?.n ?? 0);
    const ok = n === 0;
    console.log(`${ok ? "OK  " : "FAIL"}  ${ck.name}  (n=${n})`);
    if (!ok) failed += 1;
  }
  for (const ck of warnChecks) {
    const [rows] = await conn.query<any[]>(ck.sql);
    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) console.log(`WARN  ${ck.name}  (n=${n})`);
    else console.log(`OK    ${ck.name}  (n=${n})`);
  }

  await conn.end();
  if (failed > 0) {
    console.error(`${failed} invariant(s) FAILED`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
```

- [ ] **Step 2: Add the `pins:verify` script**

Edit `package.json` `scripts` block. Current:

```json
"scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "playground:import-catalog": "tsx scripts/import-pedalplayground-catalog.ts",
    "playground:invariants": "tsx scripts/playground-invariants.ts"
  },
```

Insert one new line after `playground:invariants`:

```json
"scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "playground:import-catalog": "tsx scripts/import-pedalplayground-catalog.ts",
    "playground:invariants": "tsx scripts/playground-invariants.ts",
    "pins:verify": "tsx scripts/verify-member-pins.ts"
  },
```

- [ ] **Step 3: Run the script (empty table baseline)**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm pins:verify`

Expected (empty table, fresh after Task 1 migration):

```
OK    no orphan layout_id (FK)  (n=0)
OK    no orphan member_id (FK)  (n=0)
OK    UNIQUE (layout_id, member_id) holds  (n=0)
OK    all pinned layouts have snapshot_json  (n=0)
OK    pins for unpublished members (warning only)  (n=0)
```

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add scripts/verify-member-pins.ts package.json
git commit -m "$(cat <<'EOF'
chore(playground): add pins:verify invariant script

Mirrors playground-invariants.ts pattern. Four fail-checks (orphan
layout_id, orphan member_id, UNIQUE breach, missing snapshot_json) and
one warning (pins for unpublished members — possibly intentional).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Final type-check + lint + unit tests + manual smoke checklist

**Files:** none (verification only)

- [ ] **Step 1: Run full type-check**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 2: Run all unit tests added by this plan**

Run:

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm exec tsx --test src/lib/playground/groupConsecutive.test.ts src/lib/playground/normalizePinInput.test.ts
```

Expected: `tests 11`, `pass 11`, `fail 0` (4 grouping + 7 normalize).

- [ ] **Step 3: Run lint**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm lint`

Expected: no errors related to changes. Pre-existing warnings (if any) are not in scope.

- [ ] **Step 4: Run invariants on the live DB**

Run: `cd /root/bandsustain/public_html/bandsustain && pnpm pins:verify`

Expected: all `OK`, no `FAIL`.

- [ ] **Step 5: Hand off to the user for deploy + manual smoke**

Stop. Report to the user that the work is staged on local `main` and ready to ship. Provide this hand-off summary:

```
Member pedalboard pinning — all 14 tasks committed on local main (NN commits).
- Migration 016 applied to live DB (table is empty).
- 11/11 unit tests passing.
- tsc + lint + pins:verify clean.

⛔ Stopped before push / build / pm2 restart per project rule.

To deploy, request:
  cd /root/bandsustain/public_html/bandsustain
  git push origin main
  pnpm build
  pm2 restart bandsustain

Then manual smoke checklist (sample, ask user to walk through):
  1. /admin/pedalboard-pins loads (admin login required)
  2. Pick a member + a known existing layout id → [확인] shows preview line
  3. Submit → list shows the new pin row
  4. /playground/pedalboard-planner/gallery shows the "서스테인 멤버 페달보드" top section with that pin
  5. Pinned layout's /playground/p/{share_token} returns 200 even if its visibility is 'private'
  6. ▲/▼ swaps adjust pin_order; reload gallery and confirm reorder
  7. Delete the pin → gallery top section hides (if it was the only pin); private /p/{token} returns 404 again
  8. Toggle the pinned-pin's member published=0 in /admin/members → gallery top section omits that member's pins
  9. /admin/pedalboard-pins/[id]/edit form saves override title + caption changes
```

There is intentionally no commit in this task — it is verification only.

---

## Self-Review Notes (do not run; for the author's archive)

- **Spec §1 (Data model)**: Task 1.
- **Spec §2 (Backend module)**: Tasks 4 + 5 + Task 12 step 1 (`getMemberPinByIdForAdmin`).
- **Spec §3 (Admin UI)**: Tasks 10 + 11 + 12 + 13.
- **Spec §4 (Gallery UI)**: Tasks 8 + 9.
- **Spec §5 (Share-page exception)**: Tasks 6 + 7.
- **Spec §6 (Error handling)**: Task 5 (lib error codes) + Task 10 (Korean messages mapped from codes).
- **Spec §7 (Tests)**: Tasks 2 + 3 (unit) + Task 14 (invariants) + Task 15 (smoke).
- **Type consistency**: `MemberPinView` used end-to-end (Tasks 4 → 9). `AdminPinRow` used end-to-end (Tasks 5 → 11 → 12). `LayoutLookup` used in Tasks 5 → 10 → 11. `FormState` reused between create and update actions (Task 10).
- **No placeholders.** Every code step contains full code; every command step contains the exact command and expected output.
