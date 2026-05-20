# Pedalboard Planner UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec `docs/superpowers/specs/2026-05-20-pedalboard-planner-ui-design.md` 의 UI 1차 릴리즈를 bandsustain main 에 구현. 카탈로그 검색 + 드래그 배치 + 자동 저장 + 3단계 공유.

**Architecture:** Next 16 App Router. Server pages 가 SSR/SEO 를 잡고, 편집기만 클라이언트 컴포넌트. Pointer events 직접으로 0.25" snap 캔버스. mysql2 pool + 트랜잭션 기반 snapshot 저장. 익명 owner_token cookie + visibility-gated share_token URL.

**Tech Stack:** Next 16 · TypeScript · Tailwind v4 · mysql2 · node:test + tsx · `crypto.randomBytes` · zod (이미 의존성에 있음).

**Spec section refs:** 본 plan 의 거의 모든 task 가 spec 의 특정 절을 직접 구현. 해당 task 머리에 `Spec §X` 로 표기.

---

## 파일 구조

```
src/
├── app/playground/
│   ├── pedalboard-planner/
│   │   ├── page.tsx                          (보드 선택, server)
│   │   ├── edit/[layoutId]/
│   │   │   ├── page.tsx                      (server shell — 권한 체크)
│   │   │   └── EditorClient.tsx              (editor client component)
│   │   ├── me/page.tsx                       (내 명단)
│   │   └── gallery/page.tsx                  (public 갤러리)
│   └── p/[shareToken]/page.tsx               (공유 보기 read-only)
├── app/api/playground/
│   ├── boards/route.ts                       (GET 검색)
│   ├── boards/brands/route.ts                (GET 브랜드 칩)
│   ├── pedals/route.ts                       (GET 검색)
│   ├── pedals/brands/route.ts                (GET 브랜드 칩)
│   └── layouts/
│       ├── route.ts                          (POST 새 layout)
│       ├── [id]/route.ts                     (GET, DELETE)
│       ├── [id]/snapshot/route.ts            (POST 저장 트랜잭션)
│       ├── me/route.ts                       (GET 내 명단)
│       └── public/route.ts                   (GET 갤러리)
├── components/playground/pedalboard/
│   ├── BoardSelectGrid.tsx
│   ├── BoardCanvas.tsx
│   ├── PedalPiece.tsx
│   ├── PedalSearchSheet.tsx
│   ├── SelectedInspector.tsx
│   ├── TopBar.tsx
│   ├── ShareSheet.tsx
│   ├── ShareView.tsx                         (공유 보기 SSR 렌더)
│   └── LayoutGrid.tsx                        (me/gallery 공통)
├── lib/playground/
│   ├── snap.ts + snap.test.ts
│   ├── rotate.ts + rotate.test.ts
│   ├── tokens.ts + tokens.test.ts            (owner-token + share-token)
│   ├── layoutSerializer.ts + .test.ts
│   ├── visibility.ts + visibility.test.ts
│   ├── playgroundDb.ts                       (server-only repos)
│   └── playgroundCookies.ts                  (server-only cookie helper)
├── lib/playground.ts                          (기존 — features 배열에 pedalboard 추가)
└── scripts/
    └── playground-invariants.ts               (§9 의 5가지 검증)

public/playground/
├── placeholder-pedal.svg
└── placeholder-board.svg
```

---

## Task 1: snap 유틸 (Spec §2 배치 정밀도, §10 unit test)

**Files:**
- Create: `src/lib/playground/snap.ts`
- Test:   `src/lib/playground/snap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/playground/snap.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { snapTo025 } from "./snap";

test("snapTo025 rounds to nearest 0.25", () => {
  assert.equal(snapTo025(0), 0);
  assert.equal(snapTo025(0.1), 0);
  assert.equal(snapTo025(0.13), 0.25);
  assert.equal(snapTo025(0.25), 0.25);
  assert.equal(snapTo025(0.37), 0.25);
  assert.equal(snapTo025(0.38), 0.5);
  assert.equal(snapTo025(-0.13), -0.25);
  assert.equal(snapTo025(-0.37), -0.25);
  assert.equal(snapTo025(-0.38), -0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx tsx --test src/lib/playground/snap.test.ts
```
Expected: FAIL with `Cannot find module './snap'`

- [ ] **Step 3: Implement snap**

```ts
// src/lib/playground/snap.ts
export const SNAP_STEP_INCHES = 0.25;

export function snapTo025(value: number): number {
  return Math.round(value / SNAP_STEP_INCHES) * SNAP_STEP_INCHES;
}
```

- [ ] **Step 4: Run test, expect PASS**

```
npx tsx --test src/lib/playground/snap.test.ts
```

- [ ] **Step 5: Commit**

```
git add src/lib/playground/snap.ts src/lib/playground/snap.test.ts
git commit -m "feat(playground): 0.25 inch snap utility"
```

---

## Task 2: rotate 유틸 (Spec §2 회전 정책)

**Files:**
- Create: `src/lib/playground/rotate.ts`
- Test:   `src/lib/playground/rotate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/playground/rotate.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { ROTATIONS, rotateLeft, rotateRight, isValidRotation } from "./rotate";

test("ROTATIONS is the four 90deg increments in order", () => {
  assert.deepEqual(ROTATIONS, [0, 90, 180, 270]);
});

test("rotateRight cycles 0 → 90 → 180 → 270 → 0", () => {
  assert.equal(rotateRight(0), 90);
  assert.equal(rotateRight(90), 180);
  assert.equal(rotateRight(180), 270);
  assert.equal(rotateRight(270), 0);
});

test("rotateLeft cycles 0 → 270 → 180 → 90 → 0", () => {
  assert.equal(rotateLeft(0), 270);
  assert.equal(rotateLeft(270), 180);
  assert.equal(rotateLeft(180), 90);
  assert.equal(rotateLeft(90), 0);
});

test("isValidRotation accepts only 0/90/180/270", () => {
  assert.equal(isValidRotation(0), true);
  assert.equal(isValidRotation(90), true);
  assert.equal(isValidRotation(180), true);
  assert.equal(isValidRotation(270), true);
  assert.equal(isValidRotation(45), false);
  assert.equal(isValidRotation(360), false);
  assert.equal(isValidRotation(-90), false);
});
```

- [ ] **Step 2: Run, expect FAIL**

```
npx tsx --test src/lib/playground/rotate.test.ts
```

- [ ] **Step 3: Implement rotate**

```ts
// src/lib/playground/rotate.ts
export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export function rotateRight(current: number): Rotation {
  const i = ROTATIONS.indexOf(current as Rotation);
  return ROTATIONS[(i + 1) % ROTATIONS.length];
}

export function rotateLeft(current: number): Rotation {
  const i = ROTATIONS.indexOf(current as Rotation);
  return ROTATIONS[(i - 1 + ROTATIONS.length) % ROTATIONS.length];
}

export function isValidRotation(value: number): value is Rotation {
  return (ROTATIONS as readonly number[]).includes(value);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```
git add src/lib/playground/rotate.ts src/lib/playground/rotate.test.ts
git commit -m "feat(playground): 4-step rotation helpers"
```

---

## Task 3: tokens 유틸 (Spec §5 owner_token, §6 share_token)

**Files:**
- Create: `src/lib/playground/tokens.ts`
- Test:   `src/lib/playground/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/playground/tokens.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { generateToken, isValidToken } from "./tokens";

test("generateToken returns 32 hex chars", () => {
  const t = generateToken();
  assert.match(t, /^[a-f0-9]{32}$/);
});

test("generateToken is non-deterministic", () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a, b);
});

test("isValidToken accepts 32 lowercase hex only", () => {
  assert.equal(isValidToken("a".repeat(32)), true);
  assert.equal(isValidToken("0123456789abcdef0123456789abcdef"), true);
  assert.equal(isValidToken("A".repeat(32)), false); // uppercase rejected
  assert.equal(isValidToken("a".repeat(31)), false);
  assert.equal(isValidToken("a".repeat(33)), false);
  assert.equal(isValidToken("g".repeat(32)), false);
  assert.equal(isValidToken(""), false);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement tokens**

```ts
// src/lib/playground/tokens.ts
import { randomBytes } from "node:crypto";

const TOKEN_RE = /^[a-f0-9]{32}$/;

export function generateToken(): string {
  return randomBytes(16).toString("hex");
}

export function isValidToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```
git add src/lib/playground/tokens.ts src/lib/playground/tokens.test.ts
git commit -m "feat(playground): 32-hex token generator + validator"
```

---

## Task 4: layoutSerializer 유틸 (Spec §5 snapshot_json 포맷)

**Files:**
- Create: `src/lib/playground/layoutSerializer.ts`
- Test:   `src/lib/playground/layoutSerializer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/playground/layoutSerializer.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  serializeLayout,
  parseSnapshot,
  type Layout,
} from "./layoutSerializer";

const sample: Layout = {
  title: "메인 보드",
  board: { kind: "catalog", id: 17, brand: "Pedaltrain", name: "Nano",
           width_in: 14.0, height_in: 3.0, image_filename: "pedaltrain-nano.png" },
  items: [
    { kind: "catalog", id: 1234, x: 0.25, y: 0.25, rot: 0, z: 0,
      brand: "Boss", name: "DS-1", width_in: 2.87, height_in: 4.72,
      image_filename: "boss-ds-1.png" },
  ],
};

test("serializeLayout produces v:1 JSON with the right shape", () => {
  const json = serializeLayout(sample);
  const parsed = JSON.parse(json);
  assert.equal(parsed.v, 1);
  assert.equal(parsed.title, "메인 보드");
  assert.equal(parsed.board.name, "Nano");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].name, "DS-1");
});

test("parseSnapshot round-trips serializeLayout", () => {
  const round = parseSnapshot(serializeLayout(sample));
  assert.deepEqual(round, sample);
});

test("parseSnapshot rejects wrong version", () => {
  assert.throws(() => parseSnapshot('{"v":2,"title":"x","board":{},"items":[]}'));
});

test("parseSnapshot rejects malformed JSON", () => {
  assert.throws(() => parseSnapshot("not json"));
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement serializer with zod**

```ts
// src/lib/playground/layoutSerializer.ts
import { z } from "zod";

const BoardSchema = z.object({
  kind: z.literal("catalog"),
  id: z.number().int().positive(),
  brand: z.string(),
  name: z.string(),
  width_in: z.number(),
  height_in: z.number(),
  image_filename: z.string().nullable(),
});

const ItemSchema = z.object({
  kind: z.literal("catalog"),
  id: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  z: z.number().int(),
  brand: z.string(),
  name: z.string(),
  width_in: z.number(),
  height_in: z.number(),
  image_filename: z.string().nullable(),
});

const SnapshotSchema = z.object({
  v: z.literal(1),
  title: z.string(),
  board: BoardSchema,
  items: z.array(ItemSchema),
});

const LayoutSchema = SnapshotSchema.omit({ v: true });
export type Layout = z.infer<typeof LayoutSchema>;
export type LayoutItem = z.infer<typeof ItemSchema>;
export type LayoutBoard = z.infer<typeof BoardSchema>;

export function serializeLayout(layout: Layout): string {
  return JSON.stringify({ v: 1, ...layout });
}

export function parseSnapshot(json: string): Layout {
  const parsed = SnapshotSchema.parse(JSON.parse(json));
  const { v: _v, ...rest } = parsed;
  return rest;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```
git add src/lib/playground/layoutSerializer.ts src/lib/playground/layoutSerializer.test.ts
git commit -m "feat(playground): zod-based layout snapshot serializer"
```

---

## Task 5: visibility 유틸 (Spec §7 정책)

**Files:**
- Create: `src/lib/playground/visibility.ts`
- Test:   `src/lib/playground/visibility.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/playground/visibility.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { canViewLayout, canMutateLayout } from "./visibility";

const OWNER = "a".repeat(32);
const OTHER = "b".repeat(32);

test("canViewLayout for private — only owner", () => {
  const l = { visibility: "private" as const, owner_token: OWNER };
  assert.equal(canViewLayout(l, OWNER), true);
  assert.equal(canViewLayout(l, OTHER), false);
  assert.equal(canViewLayout(l, null), false);
});

test("canViewLayout for unlisted — anyone with the URL", () => {
  const l = { visibility: "unlisted" as const, owner_token: OWNER };
  assert.equal(canViewLayout(l, OWNER), true);
  assert.equal(canViewLayout(l, OTHER), true);
  assert.equal(canViewLayout(l, null), true);
});

test("canViewLayout for public — anyone", () => {
  const l = { visibility: "public" as const, owner_token: OWNER };
  assert.equal(canViewLayout(l, OWNER), true);
  assert.equal(canViewLayout(l, OTHER), true);
  assert.equal(canViewLayout(l, null), true);
});

test("canMutateLayout — only owner regardless of visibility", () => {
  for (const v of ["private", "unlisted", "public"] as const) {
    const l = { visibility: v, owner_token: OWNER };
    assert.equal(canMutateLayout(l, OWNER), true);
    assert.equal(canMutateLayout(l, OTHER), false);
    assert.equal(canMutateLayout(l, null), false);
  }
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/lib/playground/visibility.ts
export type Visibility = "private" | "unlisted" | "public";

export interface LayoutGate {
  visibility: Visibility;
  owner_token: string;
}

export function canViewLayout(layout: LayoutGate, viewer: string | null): boolean {
  if (layout.visibility !== "private") return true;
  return viewer !== null && viewer === layout.owner_token;
}

export function canMutateLayout(layout: LayoutGate, viewer: string | null): boolean {
  return viewer !== null && viewer === layout.owner_token;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```
git add src/lib/playground/visibility.ts src/lib/playground/visibility.test.ts
git commit -m "feat(playground): visibility access gates"
```

---

## Task 6: DB repository + cookie helper (Spec §5, §6)

DB 헬퍼는 단일 server-only module. mysql2 pool + 트랜잭션 함수.

**Files:**
- Create: `src/lib/playground/playgroundDb.ts`
- Create: `src/lib/playground/playgroundCookies.ts`

이 task 는 단위 테스트 대상 아님(실 DB 의존 + 다음 task 의 API 통합 테스트에서 자연 검증). 코드 한 번에 작성 + commit.

- [ ] **Step 1: playgroundDb.ts 작성 — 검색 함수**

```ts
// src/lib/playground/playgroundDb.ts
import "server-only";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { Visibility } from "./visibility";

export interface CatalogBrand { id: number; name: string; slug: string }

export interface CatalogPedal {
  id: number; brand_id: number; brand_name: string;
  name: string; slug: string;
  width_in: number; height_in: number;
  image_filename: string | null;
}
export interface CatalogBoard extends CatalogPedal {}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (m) => "\\" + m);
}

async function searchItems(
  table: "playground_pedals" | "playground_boards",
  brandTable: "playground_pedal_brands" | "playground_board_brands",
  opts: { q?: string; brand_id?: number; limit: number; offset: number },
): Promise<CatalogPedal[]> {
  const pool = getPool();
  const where: string[] = [`p.is_active = 1`];
  const args: (string | number)[] = [];
  if (opts.q && opts.q.trim().length > 0) {
    where.push(`p.search_name LIKE ? ESCAPE '\\\\'`);
    args.push(`%${escapeLike(opts.q.trim().toLowerCase())}%`);
  }
  if (opts.brand_id) {
    where.push(`p.brand_id = ?`);
    args.push(opts.brand_id);
  }
  const sql = `
    SELECT p.id, p.brand_id, b.name AS brand_name,
           p.name, p.slug, p.width_in, p.height_in, p.image_filename
    FROM ${table} p
    JOIN ${brandTable} b ON b.id = p.brand_id
    WHERE ${where.join(" AND ")}
    ORDER BY p.search_name ASC
    LIMIT ? OFFSET ?
  `;
  args.push(opts.limit, opts.offset);
  const [rows] = await pool.query<RowDataPacket[]>(sql, args);
  return rows.map((r) => ({
    id: Number(r.id), brand_id: Number(r.brand_id), brand_name: String(r.brand_name),
    name: String(r.name), slug: String(r.slug),
    width_in: Number(r.width_in), height_in: Number(r.height_in),
    image_filename: r.image_filename ? String(r.image_filename) : null,
  }));
}

export async function searchPedals(opts: { q?: string; brand_id?: number; limit: number; offset: number }) {
  return searchItems("playground_pedals", "playground_pedal_brands", opts);
}
export async function searchBoards(opts: { q?: string; brand_id?: number; limit: number; offset: number }) {
  return searchItems("playground_boards", "playground_board_brands", opts);
}

async function listBrandsForActive(
  brandTable: "playground_pedal_brands" | "playground_board_brands",
  itemTable: "playground_pedals" | "playground_boards",
  q?: string,
): Promise<CatalogBrand[]> {
  const pool = getPool();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (q && q.trim().length > 0) {
    where.push(`b.search_name LIKE ? ESCAPE '\\\\'`);
    args.push(`%${escapeLike(q.trim().toLowerCase())}%`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT b.id, b.name, b.slug
    FROM ${brandTable} b
    WHERE EXISTS (SELECT 1 FROM ${itemTable} p WHERE p.brand_id = b.id AND p.is_active = 1)
    ${whereClause ? "AND " + where.join(" AND ") : ""}
    ORDER BY b.search_name ASC
    LIMIT 200
  `;
  const [rows] = await pool.query<RowDataPacket[]>(sql, args);
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug) }));
}
export async function listPedalBrands(q?: string) {
  return listBrandsForActive("playground_pedal_brands", "playground_pedals", q);
}
export async function listBoardBrands(q?: string) {
  return listBrandsForActive("playground_board_brands", "playground_boards", q);
}
```

- [ ] **Step 2: playgroundDb.ts — layout CRUD + snapshot 트랜잭션**

```ts
// (continued) src/lib/playground/playgroundDb.ts
import { generateToken } from "./tokens";
import type { Layout } from "./layoutSerializer";

export interface LayoutRow {
  id: number;
  owner_token: string;
  title: string;
  board_kind: "catalog";
  catalog_board_id: number | null;
  visibility: Visibility;
  share_token: string;
  snapshot_json: string | null;
  created_at: string;
  updated_at: string;
}

export async function createLayout(input: {
  owner_token: string;
  catalog_board_id: number;
  title: string;
}): Promise<LayoutRow> {
  const pool = getPool();
  const share_token = generateToken();
  const [res] = await pool.query<any>(
    `INSERT INTO playground_layouts
       (owner_token, title, board_kind, catalog_board_id, visibility, share_token)
     VALUES (?, ?, 'catalog', ?, 'private', ?)`,
    [input.owner_token, input.title, input.catalog_board_id, share_token],
  );
  const id = Number(res.insertId);
  const row = await getLayoutById(id);
  if (!row) throw new Error("createLayout: row not visible after insert");
  return row;
}

export async function getLayoutById(id: number): Promise<LayoutRow | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM playground_layouts WHERE id = ? LIMIT 1`, [id]);
  if (rows.length === 0) return null;
  return rows[0] as unknown as LayoutRow;
}

export async function getLayoutByShareToken(token: string): Promise<LayoutRow | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM playground_layouts WHERE share_token = ? LIMIT 1`, [token]);
  if (rows.length === 0) return null;
  return rows[0] as unknown as LayoutRow;
}

export async function deleteLayoutById(id: number): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM playground_layouts WHERE id = ?`, [id]);
}

interface SnapshotItemInput {
  catalog_pedal_id: number;
  x: number; y: number; rot: number; z: number;
}

export async function saveLayoutSnapshot(input: {
  id: number;
  title: string;
  visibility: Visibility;
  items: SnapshotItemInput[];
  snapshot_json: string;
}): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE playground_layouts SET title=?, visibility=?, snapshot_json=? WHERE id=?`,
      [input.title, input.visibility, input.snapshot_json, input.id],
    );
    await conn.query(`DELETE FROM playground_layout_items WHERE layout_id=?`, [input.id]);
    if (input.items.length > 0) {
      const values = input.items.map((it, idx) => [
        input.id, "catalog", it.catalog_pedal_id, null,
        it.x, it.y, it.rot, it.z !== undefined ? it.z : idx,
      ]);
      await conn.query(
        `INSERT INTO playground_layout_items
           (layout_id, item_kind, catalog_pedal_id, custom_item_id, position_x_in, position_y_in, rotation_deg, z_order)
         VALUES ?`,
        [values],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function listLayoutsForOwner(owner_token: string, limit: number, offset: number): Promise<LayoutRow[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM playground_layouts WHERE owner_token = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [owner_token, limit, offset],
  );
  return rows as unknown as LayoutRow[];
}

export async function listPublicLayouts(limit: number, offset: number): Promise<LayoutRow[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM playground_layouts WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows as unknown as LayoutRow[];
}

export async function getLayoutWithBoard(id: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.*, b.name AS board_name, br.name AS board_brand,
            b.width_in AS board_width_in, b.height_in AS board_height_in,
            b.image_filename AS board_image_filename
       FROM playground_layouts l
       LEFT JOIN playground_boards b ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.id = ? LIMIT 1`, [id]);
  if (rows.length === 0) return null;
  return rows[0];
}
```

- [ ] **Step 3: Cookie helper**

```ts
// src/lib/playground/playgroundCookies.ts
import "server-only";
import { cookies } from "next/headers";
import { generateToken, isValidToken } from "./tokens";

const COOKIE_NAME = "playground_owner";
const TEN_YEARS_S = 60 * 60 * 24 * 365 * 10;

export async function getOwnerToken(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value ?? null;
  return v && isValidToken(v) ? v : null;
}

export async function getOrCreateOwnerToken(): Promise<string> {
  const c = await cookies();
  const existing = c.get(COOKIE_NAME)?.value;
  if (existing && isValidToken(existing)) return existing;
  const fresh = generateToken();
  c.set(COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: "lax",
    path: "/playground",
    maxAge: TEN_YEARS_S,
    secure: true,
  });
  return fresh;
}
```

- [ ] **Step 4: Type check**

```
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/lib/playground/playgroundDb.ts src/lib/playground/playgroundCookies.ts
git commit -m "feat(playground): DB repository and owner_token cookie helper"
```

---

## Task 7: API — boards 검색 + 브랜드 칩 (Spec §6)

**Files:**
- Create: `src/app/api/playground/boards/route.ts`
- Create: `src/app/api/playground/boards/brands/route.ts`

bandsustain 의 기존 route handler 패턴 (`yeongmin-bot/chat/route.ts`) 따름. zod 로 query 검증.

- [ ] **Step 1: boards 검색 route**

```ts
// src/app/api/playground/boards/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { searchBoards } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().optional(),
  brand_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_query" }, { status: 400 });
  }
  const rows = await searchBoards(parsed.data);
  return NextResponse.json({ items: rows });
}
```

- [ ] **Step 2: boards/brands route**

```ts
// src/app/api/playground/boards/brands/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { listBoardBrands } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ q: z.string().optional() });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_query" }, { status: 400 });
  }
  const brands = await listBoardBrands(parsed.data.q);
  return NextResponse.json({ items: brands });
}
```

- [ ] **Step 3: Smoke verify via dev server**

```bash
pnpm dev &  # 또는 이미 떠 있으면 그대로
# 다른 터미널/혹은 wait, 첫 fetch
curl -s "http://localhost:3100/api/playground/boards?q=nano&limit=5" | head -c 400
curl -s "http://localhost:3100/api/playground/boards/brands?q=pedal" | head -c 400
```
Expected: `{"items":[...]}` JSON 정상 구조, 최소 한 항목 이상.

- [ ] **Step 4: Commit**

```
git add src/app/api/playground/boards/
git commit -m "feat(playground): boards search and brand-chip API"
```

---

## Task 8: API — pedals 검색 + 브랜드 칩 (Spec §6)

Task 7 과 같은 패턴. 차이는 `searchPedals` / `listPedalBrands` 호출만.

**Files:**
- Create: `src/app/api/playground/pedals/route.ts`
- Create: `src/app/api/playground/pedals/brands/route.ts`

- [ ] **Step 1: pedals 검색 route**

```ts
// src/app/api/playground/pedals/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { searchPedals } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().optional(),
  brand_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "bad_query" }, { status: 400 });
  const rows = await searchPedals(parsed.data);
  return NextResponse.json({ items: rows });
}
```

- [ ] **Step 2: pedals/brands route**

```ts
// src/app/api/playground/pedals/brands/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { listPedalBrands } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ q: z.string().optional() });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "bad_query" }, { status: 400 });
  const brands = await listPedalBrands(parsed.data.q);
  return NextResponse.json({ items: brands });
}
```

- [ ] **Step 3: Smoke verify**

```bash
curl -s "http://localhost:3100/api/playground/pedals?q=ds-1&limit=5" | head -c 400
curl -s "http://localhost:3100/api/playground/pedals/brands?q=boss" | head -c 400
```
Expected: JSON 정상, Boss DS-1 등 카탈로그 결과.

- [ ] **Step 4: Commit**

```
git add src/app/api/playground/pedals/
git commit -m "feat(playground): pedals search and brand-chip API"
```

---

## Task 9: API — POST 새 layout 생성 (Spec §6)

**Files:**
- Create: `src/app/api/playground/layouts/route.ts`

- [ ] **Step 1: route handler**

```ts
// src/app/api/playground/layouts/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateOwnerToken } from "@/lib/playground/playgroundCookies";
import { createLayout } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  catalog_board_id: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
});

function defaultTitle(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `Untitled ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  const owner_token = await getOrCreateOwnerToken();
  const row = await createLayout({
    owner_token,
    catalog_board_id: parsed.data.catalog_board_id,
    title: parsed.data.title ?? defaultTitle(),
  });
  return NextResponse.json({ id: row.id, share_token: row.share_token });
}
```

- [ ] **Step 2: Smoke verify (catalog_board_id 는 DB 의 실제 board id — `SELECT id FROM playground_boards LIMIT 1` 로 한 개 골라 사용)**

```bash
BID=$(CREDS=/var/www/html/_______site_BANDSUSTAIN/.db_credentials && . "$CREDS" && \
  mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -Ns -e "SELECT id FROM playground_boards LIMIT 1")
curl -s -c /tmp/pg-cookies.txt -X POST http://localhost:3100/api/playground/layouts \
  -H 'Content-Type: application/json' -d "{\"catalog_board_id\":$BID}"
```
Expected: `{"id":<n>,"share_token":"<32hex>"}` + `/tmp/pg-cookies.txt` 에 `playground_owner` cookie 기록.

- [ ] **Step 3: Commit**

```
git add src/app/api/playground/layouts/route.ts
git commit -m "feat(playground): POST /api/playground/layouts to create"
```

---

## Task 10: API — GET/DELETE layouts/[id] (Spec §6, §8 권한)

**Files:**
- Create: `src/app/api/playground/layouts/[id]/route.ts`

- [ ] **Step 1: GET + DELETE handler**

```ts
// src/app/api/playground/layouts/[id]/route.ts
import { NextResponse } from "next/server";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import { getLayoutById, deleteLayoutById } from "@/lib/playground/playgroundDb";
import { canMutateLayout } from "@/lib/playground/visibility";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const layout = await getLayoutById(id);
  if (!layout) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const viewer = await getOwnerToken();
  if (!canMutateLayout({ visibility: layout.visibility, owner_token: layout.owner_token }, viewer)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const pool = getPool();
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT li.id, li.catalog_pedal_id, li.position_x_in AS x, li.position_y_in AS y,
            li.rotation_deg AS rot, li.z_order AS z,
            p.name AS name, br.name AS brand,
            p.width_in, p.height_in, p.image_filename
       FROM playground_layout_items li
       LEFT JOIN playground_pedals p ON p.id = li.catalog_pedal_id
       LEFT JOIN playground_pedal_brands br ON br.id = p.brand_id
      WHERE li.layout_id = ?
      ORDER BY li.z_order ASC, li.id ASC`, [id]);

  return NextResponse.json({ layout, items });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const layout = await getLayoutById(id);
  if (!layout) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const viewer = await getOwnerToken();
  if (!canMutateLayout({ visibility: layout.visibility, owner_token: layout.owner_token }, viewer)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await deleteLayoutById(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Smoke verify**

```bash
ID=<Task 9 의 결과 id>
curl -s -b /tmp/pg-cookies.txt http://localhost:3100/api/playground/layouts/$ID
# 다른 쿠키파일(없는)로 시도
curl -s http://localhost:3100/api/playground/layouts/$ID
```
Expected: 첫 명령 200 + layout + items 빈 배열, 두 번째 403.

- [ ] **Step 3: Commit**

```
git add src/app/api/playground/layouts/\[id\]/route.ts
git commit -m "feat(playground): GET/DELETE single layout with owner gate"
```

---

## Task 11: API — POST snapshot 트랜잭션 (Spec §5, §6, §9 invariant #2)

**Files:**
- Create: `src/app/api/playground/layouts/[id]/snapshot/route.ts`

- [ ] **Step 1: snapshot handler**

```ts
// src/app/api/playground/layouts/[id]/snapshot/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import {
  getLayoutById,
  saveLayoutSnapshot,
} from "@/lib/playground/playgroundDb";
import { canMutateLayout, type Visibility } from "@/lib/playground/visibility";
import { serializeLayout, type Layout } from "@/lib/playground/layoutSerializer";
import { ROTATIONS } from "@/lib/playground/rotate";
import { snapTo025 } from "@/lib/playground/snap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

const ItemSchema = z.object({
  catalog_pedal_id: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  rot: RotationSchema,
  z: z.number().int().optional(),
  // SSR fast-path 캐시 (snapshot_json 안에 들어감)
  brand: z.string(),
  name: z.string(),
  width_in: z.number(),
  height_in: z.number(),
  image_filename: z.string().nullable(),
});

const BoardSchema = z.object({
  kind: z.literal("catalog"),
  id: z.number().int().positive(),
  brand: z.string(),
  name: z.string(),
  width_in: z.number(),
  height_in: z.number(),
  image_filename: z.string().nullable(),
});

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  visibility: z.enum(["private", "unlisted", "public"]) as z.ZodType<Visibility>,
  board: BoardSchema,
  items: z.array(ItemSchema).max(200),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const layout = await getLayoutById(id);
  if (!layout) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const viewer = await getOwnerToken();
  if (!canMutateLayout({ visibility: layout.visibility, owner_token: layout.owner_token }, viewer)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  // board 본문은 받지만 변경 불가 — 검증만, 적용 안 함
  if (parsed.data.board.id !== layout.catalog_board_id) {
    return NextResponse.json({ error: "board_change_not_allowed" }, { status: 400 });
  }

  // server-side snap (보안 가드 — 클라이언트가 잘못 보내도 0.25 격자로 강제)
  const snappedItems = parsed.data.items.map((it, idx) => ({
    catalog_pedal_id: it.catalog_pedal_id,
    x: snapTo025(it.x),
    y: snapTo025(it.y),
    rot: it.rot,
    z: it.z ?? idx,
    brand: it.brand,
    name: it.name,
    width_in: it.width_in,
    height_in: it.height_in,
    image_filename: it.image_filename,
  }));

  const layoutSnapshot: Layout = {
    title: parsed.data.title,
    board: parsed.data.board,
    items: snappedItems.map((it) => ({
      kind: "catalog",
      id: it.catalog_pedal_id,
      x: it.x, y: it.y, rot: it.rot, z: it.z,
      brand: it.brand, name: it.name,
      width_in: it.width_in, height_in: it.height_in,
      image_filename: it.image_filename,
    })),
  };
  const snapshot_json = serializeLayout(layoutSnapshot);

  await saveLayoutSnapshot({
    id,
    title: parsed.data.title,
    visibility: parsed.data.visibility,
    items: snappedItems.map((it) => ({
      catalog_pedal_id: it.catalog_pedal_id,
      x: it.x, y: it.y, rot: it.rot, z: it.z,
    })),
    snapshot_json,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Smoke verify**

```bash
ID=<Task 9 의 id>
# 실 board id, pedal id 가져오기
BID=$(CREDS=/var/www/html/_______site_BANDSUSTAIN/.db_credentials && . "$CREDS" && mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -Ns -e "SELECT catalog_board_id FROM playground_layouts WHERE id=$ID")
PID=$(CREDS=/var/www/html/_______site_BANDSUSTAIN/.db_credentials && . "$CREDS" && mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -Ns -e "SELECT id FROM playground_pedals LIMIT 1")

cat > /tmp/snap.json <<EOF
{
  "title": "smoke",
  "visibility": "private",
  "board": { "kind": "catalog", "id": $BID, "brand": "B", "name": "N", "width_in": 14, "height_in": 3, "image_filename": null },
  "items": [
    { "catalog_pedal_id": $PID, "x": 0.13, "y": 0.4, "rot": 90, "z": 0,
      "brand": "Bx", "name": "Px", "width_in": 2.87, "height_in": 4.72, "image_filename": null }
  ]
}
EOF

curl -s -b /tmp/pg-cookies.txt -X POST "http://localhost:3100/api/playground/layouts/$ID/snapshot" \
  -H 'Content-Type: application/json' --data @/tmp/snap.json
```
Expected: `{"ok":true}`. DB 확인: `SELECT title, visibility, JSON_LENGTH(snapshot_json,'$.items') FROM playground_layouts WHERE id=<ID>` → `("smoke","private",1)`. items 좌표: `0.13` → `0.25`, `0.4` → `0.5` (snap 동작).

- [ ] **Step 3: Commit**

```
git add src/app/api/playground/layouts/\[id\]/snapshot/route.ts
git commit -m "feat(playground): POST snapshot with transactional write + server-side snap"
```

---

## Task 12: API — me + public 목록 (Spec §6)

**Files:**
- Create: `src/app/api/playground/layouts/me/route.ts`
- Create: `src/app/api/playground/layouts/public/route.ts`

- [ ] **Step 1: me route**

```ts
// src/app/api/playground/layouts/me/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import { listLayoutsForOwner } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const owner = await getOwnerToken();
  if (!owner) return NextResponse.json({ items: [] });
  const url = new URL(req.url);
  const p = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!p.success) return NextResponse.json({ error: "bad_query" }, { status: 400 });
  const rows = await listLayoutsForOwner(owner, p.data.limit, p.data.offset);
  return NextResponse.json({ items: rows });
}
```

- [ ] **Step 2: public route**

```ts
// src/app/api/playground/layouts/public/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { listPublicLayouts } from "@/lib/playground/playgroundDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!p.success) return NextResponse.json({ error: "bad_query" }, { status: 400 });
  const rows = await listPublicLayouts(p.data.limit, p.data.offset);
  return NextResponse.json({ items: rows });
}
```

- [ ] **Step 3: Smoke verify**

```bash
curl -s -b /tmp/pg-cookies.txt "http://localhost:3100/api/playground/layouts/me?limit=5" | head -c 200
curl -s "http://localhost:3100/api/playground/layouts/public?limit=5" | head -c 200
```
Expected: 첫 명령은 Task 9~11 에서 만든 layout 1건 포함. 두 번째는 빈 배열 (아직 public 없음).

- [ ] **Step 4: Commit**

```
git add src/app/api/playground/layouts/me/ src/app/api/playground/layouts/public/
git commit -m "feat(playground): GET /me and /public layout list APIs"
```

---

## Task 13: 보드 선택 페이지 (Spec §3, §4)

`/playground/pedalboard-planner` — server component. 보드 grid + 검색 input + 브랜드 칩. 카드 클릭 시 server action 으로 POST layouts → redirect.

**Files:**
- Create: `src/components/playground/pedalboard/BoardSelectGrid.tsx`
- Create: `src/app/playground/pedalboard-planner/page.tsx`

- [ ] **Step 1: BoardSelectGrid (client component — 검색 상태)**

```tsx
// src/components/playground/pedalboard/BoardSelectGrid.tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface BoardRow {
  id: number; brand_name: string; name: string;
  width_in: number; height_in: number; image_filename: string | null;
}
interface BrandRow { id: number; name: string }

export function BoardSelectGrid({ initialBrands, initialBoards }: {
  initialBrands: BrandRow[]; initialBoards: BoardRow[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [boards, setBoards] = useState<BoardRow[]>(initialBoards);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      const url = new URL("/api/playground/boards", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (brandId) url.searchParams.set("brand_id", String(brandId));
      url.searchParams.set("limit", "50");
      const res = await fetch(url.toString());
      if (res.ok) {
        const j = await res.json();
        setBoards(j.items);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, brandId]);

  function pick(id: number) {
    startTransition(async () => {
      const res = await fetch("/api/playground/layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog_board_id: id }),
      });
      if (!res.ok) return alert("새 레이아웃 생성 실패");
      const j = await res.json();
      router.push(`/playground/pedalboard-planner/edit/${j.id}`);
    });
  }

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">Pedalboard Planner</h1>
        <p className="mt-3 text-sm md:text-base text-[var(--color-text-muted)]">시작할 보드를 고르세요.</p>
        <nav className="mt-4 flex gap-4 text-xs uppercase tracking-wider">
          <a href="/playground/pedalboard-planner/me" className="underline">내 보드</a>
          <a href="/playground/pedalboard-planner/gallery" className="underline">갤러리</a>
        </nav>
      </header>

      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="보드 이름·브랜드 검색"
        className="w-full border border-[var(--color-border-strong)] rounded-none px-4 py-3 text-base mb-3"
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-6 px-6">
        <button onClick={() => setBrandId(null)}
          className={`whitespace-nowrap px-4 py-1.5 text-sm border border-[var(--color-border-strong)] ${brandId === null ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "bg-transparent"}`}>
          전체
        </button>
        {initialBrands.map((b) => (
          <button key={b.id} onClick={() => setBrandId(b.id === brandId ? null : b.id)}
            className={`whitespace-nowrap px-4 py-1.5 text-sm border border-[var(--color-border-strong)] ${brandId === b.id ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "bg-transparent"}`}>
            {b.name}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-[var(--color-text-muted)] mb-4">불러오는 중…</p>}
      {!loading && boards.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">검색 결과 없음. 다른 키워드/브랜드를 시도해보세요.</p>
      )}

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {boards.map((b) => (
          <li key={b.id}>
            <button onClick={() => pick(b.id)} className="text-left w-full">
              <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
                {b.image_filename && (
                  <Image src={`/playground/images/pedalboards/${b.image_filename}`}
                    alt={`${b.brand_name} ${b.name}`} fill className="object-contain"
                    sizes="(max-width: 768px) 50vw, 25vw" />
                )}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{b.brand_name}</div>
              <div className="font-semibold text-base md:text-lg">{b.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{b.width_in}" × {b.height_in}"</div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: 보드 선택 page (server)**

```tsx
// src/app/playground/pedalboard-planner/page.tsx
import type { Metadata } from "next";
import { BoardSelectGrid } from "@/components/playground/pedalboard/BoardSelectGrid";
import { listBoardBrands, searchBoards } from "@/lib/playground/playgroundDb";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pedalboard Planner",
  path: "/playground/pedalboard-planner",
  description: "원하는 보드를 골라 페달을 배치하고 공유하세요.",
});

export default async function Page() {
  const [brands, boards] = await Promise.all([
    listBoardBrands(),
    searchBoards({ limit: 50, offset: 0 }),
  ]);
  return <BoardSelectGrid initialBrands={brands} initialBoards={boards} />;
}
```

- [ ] **Step 3: Smoke verify**

```bash
curl -sI "http://localhost:3100/playground/pedalboard-planner" | head -3
# 또는 브라우저로 열어 카드 클릭 → /edit/<id> 리다이렉트 확인
```
Expected: 200 OK, 보드 카드 grid 렌더.

- [ ] **Step 4: Commit**

```
git add src/components/playground/pedalboard/BoardSelectGrid.tsx src/app/playground/pedalboard-planner/page.tsx
git commit -m "feat(playground): board selection page"
```

---

## Task 14: TopBar + ShareSheet 컴포넌트 (Spec §4, §7)

**Files:**
- Create: `src/components/playground/pedalboard/TopBar.tsx`
- Create: `src/components/playground/pedalboard/ShareSheet.tsx`

- [ ] **Step 1: TopBar**

```tsx
// src/components/playground/pedalboard/TopBar.tsx
"use client";
import Link from "next/link";

export function TopBar({
  title, dirty, savedAt, onTitleChange, onShareClick,
}: {
  title: string; dirty: boolean; savedAt: string | null;
  onTitleChange: (next: string) => void;
  onShareClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-4 md:px-6 py-3 flex items-center gap-3">
      <Link href="/playground/pedalboard-planner"
        className="text-sm font-semibold uppercase tracking-wider underline">
        ← 다른 보드
      </Link>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1 text-base font-semibold bg-transparent border-0 border-b border-transparent focus:border-[var(--color-text)] focus:outline-none"
        aria-label="레이아웃 제목"
      />
      <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
        {dirty ? "저장 중…" : savedAt ? `저장됨 · ${savedAt}` : ""}
      </span>
      <button onClick={onShareClick}
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">
        공유
      </button>
    </header>
  );
}
```

- [ ] **Step 2: ShareSheet**

```tsx
// src/components/playground/pedalboard/ShareSheet.tsx
"use client";
import { useState } from "react";
import type { Visibility } from "@/lib/playground/visibility";

export function ShareSheet({
  shareToken, visibility, onVisibilityChange, onClose,
}: {
  shareToken: string; visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/playground/p/${shareToken}`
    : `/playground/p/${shareToken}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function kakao() {
    // 카카오 SDK 가 사이트 전체에서 lazy 로드되어 있다 가정.
    // 없으면 fallback Web Share.
    const w = window as unknown as { Kakao?: { Share?: { sendDefault: (a: unknown) => void } } };
    if (w.Kakao?.Share) {
      w.Kakao.Share.sendDefault({
        objectType: "feed",
        content: { title: "Pedalboard", description: "내 페달보드 레이아웃", link: { mobileWebUrl: url, webUrl: url } },
      });
    } else if (navigator.share) {
      navigator.share({ url });
    } else {
      copy();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-[var(--color-bg)] w-full md:max-w-md p-6 border-t md:border border-[var(--color-border-strong)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">레이아웃 공유</h2>
          <button onClick={onClose} aria-label="닫기" className="text-sm underline">닫기</button>
        </div>

        <fieldset className="mb-4">
          <legend className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">공유 범위</legend>
          {(["private", "unlisted", "public"] as Visibility[]).map((v) => (
            <label key={v} className="flex items-start gap-2 py-1.5 text-sm">
              <input type="radio" name="visibility" checked={visibility === v}
                onChange={() => onVisibilityChange(v)} />
              <span>
                {v === "private" && <>🔒 나만 — URL 있어도 안 보임</>}
                {v === "unlisted" && <>🔗 URL 아는 사람</>}
                {v === "public" && <>🌐 공개 — 갤러리에 노출</>}
              </span>
            </label>
          ))}
        </fieldset>

        {visibility !== "private" && (
          <>
            <div className="border border-[var(--color-border)] px-3 py-2 text-xs font-mono break-all mb-3">{url}</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copy}
                className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">
                {copied ? "복사됨" : "URL 복사"}
              </button>
              <button onClick={kakao}
                className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[#FEE500] text-black border border-[#FEE500]">
                카카오
              </button>
            </div>
          </>
        )}
        {visibility === "private" && (
          <p className="text-xs text-[var(--color-text-muted)]">private 상태에서는 공유 URL 이 비활성화됩니다.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/components/playground/pedalboard/TopBar.tsx src/components/playground/pedalboard/ShareSheet.tsx
git commit -m "feat(playground): TopBar + ShareSheet components"
```

---

## Task 15: PedalSearchSheet (Spec §4 모바일 하단 시트 / PC 사이드)

**Files:**
- Create: `src/components/playground/pedalboard/PedalSearchSheet.tsx`

- [ ] **Step 1: 컴포넌트**

```tsx
// src/components/playground/pedalboard/PedalSearchSheet.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export interface PedalRow {
  id: number; brand_name: string; name: string;
  width_in: number; height_in: number; image_filename: string | null;
}
interface BrandRow { id: number; name: string }

export function PedalSearchSheet({ onAdd }: { onAdd: (p: PedalRow) => void }) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [pedals, setPedals] = useState<PedalRow[]>([]);
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/playground/pedals/brands");
      if (res.ok) setBrands((await res.json()).items);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const url = new URL("/api/playground/pedals", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (brandId) url.searchParams.set("brand_id", String(brandId));
      url.searchParams.set("limit", "50");
      const res = await fetch(url.toString());
      if (res.ok) setPedals((await res.json()).items);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, brandId]);

  return (
    <aside className="fixed bottom-0 left-0 right-0 h-[50vh] lg:h-auto lg:top-[57px] lg:bottom-0 lg:left-auto lg:right-0 lg:w-[360px] z-20
                       bg-[var(--color-bg)] border-t lg:border-t-0 lg:border-l border-[var(--color-border-strong)] flex flex-col">
      <div className="p-3 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg)]">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="페달 이름·브랜드"
          className="w-full border border-[var(--color-border-strong)] rounded-none px-3 py-2 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1 -mx-1 px-1">
          <button onClick={() => setBrandId(null)}
            className={`whitespace-nowrap px-3 py-1 text-xs border border-[var(--color-border-strong)] ${brandId === null ? "bg-[var(--color-text)] text-[var(--color-bg)]" : ""}`}>
            전체
          </button>
          {brands.map((b) => (
            <button key={b.id} onClick={() => setBrandId(b.id === brandId ? null : b.id)}
              className={`whitespace-nowrap px-3 py-1 text-xs border border-[var(--color-border-strong)] ${brandId === b.id ? "bg-[var(--color-text)] text-[var(--color-bg)]" : ""}`}>
              {b.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="text-xs text-[var(--color-text-muted)]">불러오는 중…</p>}
        {!loading && pedals.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">검색 결과 없음.</p>
        )}
        <ul className="grid grid-cols-2 gap-2">
          {pedals.map((p) => (
            <li key={p.id}>
              <button onClick={() => onAdd(p)} className="text-left w-full">
                <div className="aspect-square bg-[var(--color-bg-muted)] relative overflow-hidden">
                  {p.image_filename && (
                    <Image src={`/playground/images/pedals/${p.image_filename}`} alt={`${p.brand_name} ${p.name}`}
                      fill sizes="50vw" className="object-contain" />
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1">{p.brand_name}</div>
                <div className="text-xs font-semibold leading-tight">{p.name}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/playground/pedalboard/PedalSearchSheet.tsx
git commit -m "feat(playground): pedal search sheet"
```

---

## Task 16: BoardCanvas + PedalPiece + SelectedInspector (Spec §4 드래그, §2 snap/회전)

캔버스: 절대좌표 컨테이너, 보드 이미지를 배경으로, 페달들이 `position: absolute`. pointer events 로 drag. 좌표는 inch → 화면 px 변환 (스케일: `boardWidthIn` 이 컨테이너의 `clientWidth` 가 되도록).

**Files:**
- Create: `src/components/playground/pedalboard/BoardCanvas.tsx`
- Create: `src/components/playground/pedalboard/PedalPiece.tsx`
- Create: `src/components/playground/pedalboard/SelectedInspector.tsx`

- [ ] **Step 1: PedalPiece (presentation)**

```tsx
// src/components/playground/pedalboard/PedalPiece.tsx
"use client";
import Image from "next/image";

export interface PieceProps {
  x: number; y: number; rot: number; widthIn: number; heightIn: number;
  selected: boolean; brand: string; name: string;
  imageFilename: string | null;
  pxPerIn: number;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function PedalPiece(props: PieceProps) {
  const { x, y, rot, widthIn, heightIn, pxPerIn, selected, imageFilename, brand, name, onPointerDown } = props;
  const wPx = widthIn * pxPerIn;
  const hPx = heightIn * pxPerIn;
  return (
    <button type="button" onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: x * pxPerIn,
        top: y * pxPerIn,
        width: wPx,
        height: hPx,
        transform: `rotate(${rot}deg)`,
        transformOrigin: "center center",
        touchAction: "none",
        border: selected ? "2px solid #2563FF" : "1px solid rgba(0,0,0,0.2)",
        background: "transparent",
        padding: 0,
      }}
      aria-label={`${brand} ${name}`}
    >
      {imageFilename ? (
        <Image src={`/playground/images/pedals/${imageFilename}`} alt={`${brand} ${name}`}
          fill className="object-contain pointer-events-none" sizes="200px"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] pointer-events-none">{name}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: BoardCanvas (pointer events + snap)**

```tsx
// src/components/playground/pedalboard/BoardCanvas.tsx
"use client";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { snapTo025 } from "@/lib/playground/snap";
import { PedalPiece } from "./PedalPiece";
import type { Layout, LayoutItem } from "@/lib/playground/layoutSerializer";

interface Props {
  board: Layout["board"];
  items: LayoutItem[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (id: number, x: number, y: number) => void;
}

export function BoardCanvas({ board, items, selectedId, onSelect, onMove }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pxPerIn, setPxPerIn] = useState(40);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = () => setPxPerIn(el.clientWidth / board.width_in);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.width_in]);

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xIn = (e.clientX - rect.left) / pxPerIn - d.offsetX;
    const yIn = (e.clientY - rect.top) / pxPerIn - d.offsetY;
    onMove(d.id, snapTo025(xIn), snapTo025(yIn));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }

  return (
    <div ref={ref}
      className="relative w-full mx-auto"
      style={{ aspectRatio: `${board.width_in} / ${board.height_in}`, maxWidth: "min(100%, 920px)" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      {board.image_filename && (
        <Image src={`/playground/images/pedalboards/${board.image_filename}`}
          alt={`${board.brand} ${board.name}`} fill className="object-contain pointer-events-none" sizes="100vw" />
      )}
      {items.map((it) => (
        <PedalPiece key={it.id} {...{
          x: it.x, y: it.y, rot: it.rot, widthIn: it.width_in, heightIn: it.height_in,
          imageFilename: it.image_filename, brand: it.brand, name: it.name,
          selected: selectedId === it.id, pxPerIn,
        }} onPointerDown={(e) => {
          e.preventDefault();
          onSelect(it.id);
          const rect = ref.current!.getBoundingClientRect();
          dragRef.current = {
            id: it.id,
            offsetX: (e.clientX - rect.left) / pxPerIn - it.x,
            offsetY: (e.clientY - rect.top) / pxPerIn - it.y,
          };
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: SelectedInspector**

```tsx
// src/components/playground/pedalboard/SelectedInspector.tsx
"use client";
import type { LayoutItem } from "@/lib/playground/layoutSerializer";
import { rotateLeft, rotateRight } from "@/lib/playground/rotate";

interface Props {
  item: LayoutItem | null;
  onRotate: (id: number, next: number) => void;
  onDelete: (id: number) => void;
  onZ: (id: number, delta: 1 | -1) => void;
}

export function SelectedInspector({ item, onRotate, onDelete, onZ }: Props) {
  if (!item) return null;
  return (
    <div className="fixed left-0 right-0 bottom-[50vh] lg:bottom-0 lg:right-[360px] z-10
                     bg-[var(--color-bg)] border-t border-[var(--color-border-strong)] px-3 py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{item.brand}</div>
        <div className="text-sm font-semibold truncate">{item.name}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{item.width_in}" × {item.height_in}" · {item.rot}°</div>
      </div>
      <button onClick={() => onRotate(item.id, rotateLeft(item.rot))}
        className="px-3 py-2 text-xs uppercase tracking-wider border border-[var(--color-border-strong)]" aria-label="좌로 회전">↺</button>
      <button onClick={() => onRotate(item.id, rotateRight(item.rot))}
        className="px-3 py-2 text-xs uppercase tracking-wider border border-[var(--color-border-strong)]" aria-label="우로 회전">↻</button>
      <button onClick={() => onZ(item.id, -1)} className="px-2 py-2 text-xs border border-[var(--color-border-strong)]" aria-label="뒤로">⬇</button>
      <button onClick={() => onZ(item.id, 1)} className="px-2 py-2 text-xs border border-[var(--color-border-strong)]" aria-label="앞으로">⬆</button>
      <button onClick={() => onDelete(item.id)} className="px-3 py-2 text-xs uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)]">삭제</button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```
git add src/components/playground/pedalboard/PedalPiece.tsx src/components/playground/pedalboard/BoardCanvas.tsx src/components/playground/pedalboard/SelectedInspector.tsx
git commit -m "feat(playground): board canvas, pedal piece, inspector"
```

---

## Task 17: EditorClient + edit page (Spec §4, §5 자동 저장)

state 종합 + auto-save 1초 디바운스.

**Files:**
- Create: `src/app/playground/pedalboard-planner/edit/[layoutId]/EditorClient.tsx`
- Create: `src/app/playground/pedalboard-planner/edit/[layoutId]/page.tsx`

- [ ] **Step 1: EditorClient (state hub)**

```tsx
// src/app/playground/pedalboard-planner/edit/[layoutId]/EditorClient.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { BoardCanvas } from "@/components/playground/pedalboard/BoardCanvas";
import { PedalSearchSheet, type PedalRow } from "@/components/playground/pedalboard/PedalSearchSheet";
import { SelectedInspector } from "@/components/playground/pedalboard/SelectedInspector";
import { TopBar } from "@/components/playground/pedalboard/TopBar";
import { ShareSheet } from "@/components/playground/pedalboard/ShareSheet";
import type { Layout, LayoutItem } from "@/lib/playground/layoutSerializer";
import type { Visibility } from "@/lib/playground/visibility";

interface Props {
  layoutId: number;
  shareToken: string;
  initialTitle: string;
  initialVisibility: Visibility;
  initialBoard: Layout["board"];
  initialItems: LayoutItem[];
}

export function EditorClient(props: Props) {
  const [title, setTitle] = useState(props.initialTitle);
  const [visibility, setVisibility] = useState<Visibility>(props.initialVisibility);
  const [items, setItems] = useState<LayoutItem[]>(props.initialItems);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const nextLocalId = useRef(-1);

  function add(p: PedalRow) {
    const board = props.initialBoard;
    const x = Math.max(0, (board.width_in - p.width_in) / 2);
    const y = Math.max(0, (board.height_in - p.height_in) / 2);
    setItems((arr) => [...arr, {
      kind: "catalog", id: p.id, x, y, rot: 0, z: arr.length,
      brand: p.brand_name, name: p.name,
      width_in: p.width_in, height_in: p.height_in,
      image_filename: p.image_filename,
    }]);
    setDirty(true);
  }

  function move(id: number, x: number, y: number) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, x, y } : it)));
    setDirty(true);
  }

  function rotateOne(id: number, next: number) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, rot: next as 0 | 90 | 180 | 270 } : it)));
    setDirty(true);
  }

  function deleteOne(id: number) {
    setItems((arr) => arr.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  function bumpZ(id: number, delta: 1 | -1) {
    setItems((arr) => {
      const idx = arr.findIndex((it) => it.id === id);
      if (idx < 0) return arr;
      const next = [...arr];
      const target = next[idx];
      const swapIdx = idx + delta;
      if (swapIdx < 0 || swapIdx >= next.length) return arr;
      next[idx] = { ...next[swapIdx], z: target.z };
      next[swapIdx] = { ...target, z: next[idx].z + delta };
      return next;
    });
    setDirty(true);
  }

  function onTitle(next: string) { setTitle(next); setDirty(true); }
  function onVisibility(v: Visibility) { setVisibility(v); setDirty(true); }

  // debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    const handle = setTimeout(async () => {
      const body = {
        title, visibility, board: props.initialBoard,
        items: items.map((it) => ({
          catalog_pedal_id: it.id, x: it.x, y: it.y, rot: it.rot, z: it.z,
          brand: it.brand, name: it.name, width_in: it.width_in, height_in: it.height_in,
          image_filename: it.image_filename,
        })),
      };
      let attempt = 0;
      while (true) {
        attempt += 1;
        const res = await fetch(`/api/playground/layouts/${props.layoutId}/snapshot`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setDirty(false);
          const d = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          setSavedAt(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          break;
        }
        if (attempt >= 2) {
          alert("저장 실패 — 다시 시도");
          break;
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }, 1000);
    return () => clearTimeout(handle);
  }, [dirty, title, visibility, items, props.initialBoard, props.layoutId]);

  const selected = items.find((it) => it.id === selectedId) ?? null;

  return (
    <div>
      <TopBar title={title} dirty={dirty} savedAt={savedAt}
        onTitleChange={onTitle} onShareClick={() => setShareOpen(true)} />
      <main className="lg:mr-[360px] pb-[50vh] lg:pb-0 p-3">
        <BoardCanvas board={props.initialBoard} items={items}
          selectedId={selectedId} onSelect={setSelectedId} onMove={move} />
      </main>
      <PedalSearchSheet onAdd={add} />
      <SelectedInspector item={selected} onRotate={rotateOne} onDelete={deleteOne} onZ={bumpZ} />
      {shareOpen && (
        <ShareSheet shareToken={props.shareToken} visibility={visibility}
          onVisibilityChange={onVisibility} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: edit page (server shell)**

```tsx
// src/app/playground/pedalboard-planner/edit/[layoutId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import { getLayoutWithBoard } from "@/lib/playground/playgroundDb";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { canMutateLayout } from "@/lib/playground/visibility";
import { EditorClient } from "./EditorClient";
import type { LayoutItem } from "@/lib/playground/layoutSerializer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ layoutId: string }> }) {
  const { layoutId } = await params;
  const id = Number(layoutId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const row = await getLayoutWithBoard(id) as any;
  if (!row) notFound();
  const owner = await getOwnerToken();
  if (!canMutateLayout({ visibility: row.visibility, owner_token: row.owner_token }, owner)) {
    // 공유 보기는 다른 URL — 편집 진입 거부는 보드 선택으로
    redirect("/playground/pedalboard-planner");
  }

  const pool = getPool();
  const [itemRows] = await pool.query<RowDataPacket[]>(
    `SELECT li.catalog_pedal_id AS id, li.position_x_in AS x, li.position_y_in AS y,
            li.rotation_deg AS rot, li.z_order AS z,
            p.name, br.name AS brand, p.width_in, p.height_in, p.image_filename
       FROM playground_layout_items li
       LEFT JOIN playground_pedals p ON p.id = li.catalog_pedal_id
       LEFT JOIN playground_pedal_brands br ON br.id = p.brand_id
      WHERE li.layout_id = ? ORDER BY li.z_order ASC, li.id ASC`, [id]);

  const items: LayoutItem[] = itemRows.map((r) => ({
    kind: "catalog", id: Number(r.id), x: Number(r.x), y: Number(r.y),
    rot: Number(r.rot) as 0 | 90 | 180 | 270, z: Number(r.z),
    brand: String(r.brand ?? ""), name: String(r.name ?? "삭제된 페달"),
    width_in: Number(r.width_in ?? 2), height_in: Number(r.height_in ?? 2),
    image_filename: r.image_filename ? String(r.image_filename) : null,
  }));

  return (
    <EditorClient
      layoutId={id}
      shareToken={row.share_token}
      initialTitle={row.title}
      initialVisibility={row.visibility}
      initialBoard={{
        kind: "catalog", id: row.catalog_board_id,
        brand: String(row.board_brand ?? ""), name: String(row.board_name ?? ""),
        width_in: Number(row.board_width_in ?? 14), height_in: Number(row.board_height_in ?? 3),
        image_filename: row.board_image_filename ? String(row.board_image_filename) : null,
      }}
      initialItems={items}
    />
  );
}
```

- [ ] **Step 3: Smoke verify**

```bash
ID=<Task 9 layout id>
curl -sI -b /tmp/pg-cookies.txt "http://localhost:3100/playground/pedalboard-planner/edit/$ID" | head -3
```
Expected: 200. 브라우저로 열어 보드 + (snapshot 에 들어간) 페달 1개 보임. 페달 드래그 → 1초 후 "저장됨" 표시. 우상단 [공유] → ShareSheet 동작.

- [ ] **Step 4: Commit**

```
git add src/app/playground/pedalboard-planner/edit/
git commit -m "feat(playground): editor client + edit page route"
```

---

## Task 18: 공유 보기 페이지 (Spec §3, §7)

`/playground/p/[shareToken]` — server, snapshot_json SSR.

**Files:**
- Create: `src/components/playground/pedalboard/ShareView.tsx`
- Create: `src/app/playground/p/[shareToken]/page.tsx`

- [ ] **Step 1: ShareView (정적 렌더)**

```tsx
// src/components/playground/pedalboard/ShareView.tsx
import Image from "next/image";
import type { Layout } from "@/lib/playground/layoutSerializer";

export function ShareView({ layout }: { layout: Layout }) {
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-5xl">{layout.title}</h1>
        <div className="mt-2 text-sm text-[var(--color-text-muted)]">
          {layout.board.brand} {layout.board.name} · {layout.board.width_in}" × {layout.board.height_in}"
        </div>
      </header>
      <div className="relative w-full" style={{ aspectRatio: `${layout.board.width_in} / ${layout.board.height_in}` }}>
        {layout.board.image_filename && (
          <Image src={`/playground/images/pedalboards/${layout.board.image_filename}`}
            alt={`${layout.board.brand} ${layout.board.name}`} fill className="object-contain" sizes="100vw" />
        )}
        {layout.items.map((it, i) => {
          const wPct = (it.width_in / layout.board.width_in) * 100;
          const hPct = (it.height_in / layout.board.height_in) * 100;
          const xPct = (it.x / layout.board.width_in) * 100;
          const yPct = (it.y / layout.board.height_in) * 100;
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${xPct}%`, top: `${yPct}%`,
              width: `${wPct}%`, height: `${hPct}%`,
              transform: `rotate(${it.rot}deg)`, transformOrigin: "center center",
            }}>
              {it.image_filename && (
                <Image src={`/playground/images/pedals/${it.image_filename}`} alt={`${it.brand} ${it.name}`}
                  fill className="object-contain" sizes="200px" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 공유 보기 page**

```tsx
// src/app/playground/p/[shareToken]/page.tsx
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

export async function generateMetadata({ params }: { params: Promise<{ shareToken: string }> }): Promise<Metadata> {
  const { shareToken } = await params;
  const loaded = await loadLayout(shareToken);
  if (!loaded) return buildPageMetadata({ title: "Pedalboard", path: `/playground/p/${shareToken}`, description: "공유된 페달보드 레이아웃" });
  return buildPageMetadata({
    title: loaded.layout.title,
    path: `/playground/p/${shareToken}`,
    description: `${loaded.layout.board.brand} ${loaded.layout.board.name} · 페달 ${loaded.layout.items.length}개`,
  });
}

export default async function Page({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const loaded = await loadLayout(shareToken);
  if (!loaded) notFound();
  return <ShareView layout={loaded.layout} />;
}
```

- [ ] **Step 3: Smoke verify (편집기에서 unlisted/public 토글 후)**

```bash
TOK=<Task 9 의 share_token>
curl -sI "http://localhost:3100/playground/p/$TOK" | head -3
```
Expected: snapshot 가 있고 visibility 가 unlisted/public 이면 200 + 페달 1개 렌더. private 이면 404.

- [ ] **Step 4: Commit**

```
git add src/components/playground/pedalboard/ShareView.tsx src/app/playground/p/
git commit -m "feat(playground): share view at /playground/p/<token>"
```

---

## Task 19: 내 명단 + 갤러리 + LayoutGrid (Spec §3)

**Files:**
- Create: `src/components/playground/pedalboard/LayoutGrid.tsx`
- Create: `src/app/playground/pedalboard-planner/me/page.tsx`
- Create: `src/app/playground/pedalboard-planner/gallery/page.tsx`

- [ ] **Step 1: LayoutGrid (server-rendered card grid)**

```tsx
// src/components/playground/pedalboard/LayoutGrid.tsx
import Link from "next/link";
import Image from "next/image";

export interface LayoutCard {
  id: number; title: string; share_token: string;
  visibility: "private" | "unlisted" | "public";
  updated_at: string;
  board_image_filename: string | null;
  board_brand: string | null; board_name: string | null;
}

export function LayoutGrid({ items, hrefBuilder, emptyMessage }: {
  items: LayoutCard[];
  hrefBuilder: (it: LayoutCard) => string;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>;
  }
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {items.map((it) => (
        <li key={it.id}>
          <Link href={hrefBuilder(it)} className="block">
            <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
              {it.board_image_filename && (
                <Image src={`/playground/images/pedalboards/${it.board_image_filename}`}
                  alt={`${it.board_brand ?? ""} ${it.board_name ?? ""}`} fill className="object-contain"
                  sizes="(max-width: 768px) 50vw, 25vw" />
              )}
            </div>
            <div className="mt-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              {it.board_brand} {it.board_name}
            </div>
            <div className="font-semibold text-base truncate">{it.title}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{new Date(it.updated_at).toLocaleString("ko-KR")} · {it.visibility}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: /me page**

```tsx
// src/app/playground/pedalboard-planner/me/page.tsx
import type { Metadata } from "next";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import { LayoutGrid, type LayoutCard } from "@/components/playground/pedalboard/LayoutGrid";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "내 페달보드",
  path: "/playground/pedalboard-planner/me",
  description: "내가 만든 페달보드 레이아웃",
});

async function loadMine(owner: string): Promise<LayoutCard[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.share_token, l.visibility, l.updated_at,
            b.image_filename AS board_image_filename, b.name AS board_name, br.name AS board_brand
       FROM playground_layouts l
       LEFT JOIN playground_boards b ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.owner_token = ? ORDER BY l.updated_at DESC LIMIT 50`, [owner]);
  return rows as unknown as LayoutCard[];
}

export default async function Page() {
  const owner = await getOwnerToken();
  const items = owner ? await loadMine(owner) : [];
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">내 페달보드</h1>
        <nav className="mt-3 flex gap-4 text-xs uppercase tracking-wider">
          <a href="/playground/pedalboard-planner" className="underline">보드 고르기</a>
          <a href="/playground/pedalboard-planner/gallery" className="underline">갤러리</a>
        </nav>
      </header>
      <LayoutGrid items={items}
        hrefBuilder={(it) => `/playground/pedalboard-planner/edit/${it.id}`}
        emptyMessage="아직 만든 보드가 없습니다 — 보드를 골라 시작해보세요." />
    </section>
  );
}
```

- [ ] **Step 3: /gallery page**

```tsx
// src/app/playground/pedalboard-planner/gallery/page.tsx
import type { Metadata } from "next";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { LayoutGrid, type LayoutCard } from "@/components/playground/pedalboard/LayoutGrid";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "페달보드 갤러리",
  path: "/playground/pedalboard-planner/gallery",
  description: "공개된 페달보드 레이아웃 모음",
});

async function loadPublic(): Promise<LayoutCard[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.share_token, l.visibility, l.updated_at,
            b.image_filename AS board_image_filename, b.name AS board_name, br.name AS board_brand
       FROM playground_layouts l
       LEFT JOIN playground_boards b ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.visibility = 'public' ORDER BY l.updated_at DESC LIMIT 50`);
  return rows as unknown as LayoutCard[];
}

export default async function Page() {
  const items = await loadPublic();
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">갤러리</h1>
        <nav className="mt-3 flex gap-4 text-xs uppercase tracking-wider">
          <a href="/playground/pedalboard-planner" className="underline">보드 고르기</a>
          <a href="/playground/pedalboard-planner/me" className="underline">내 보드</a>
        </nav>
      </header>
      <LayoutGrid items={items}
        hrefBuilder={(it) => `/playground/p/${it.share_token}`}
        emptyMessage="공개 보드가 아직 없습니다." />
    </section>
  );
}
```

- [ ] **Step 4: Smoke verify**

```bash
curl -sI -b /tmp/pg-cookies.txt "http://localhost:3100/playground/pedalboard-planner/me" | head -3
curl -sI "http://localhost:3100/playground/pedalboard-planner/gallery" | head -3
```
Expected: 둘 다 200.

- [ ] **Step 5: Commit**

```
git add src/components/playground/pedalboard/LayoutGrid.tsx src/app/playground/pedalboard-planner/me/ src/app/playground/pedalboard-planner/gallery/
git commit -m "feat(playground): my-layouts and public gallery pages"
```

---

## Task 20: playground features 리스트 + placeholder SVG (Spec §3 진입점)

**Files:**
- Modify: `src/lib/playground.ts`
- Create: `public/playground/placeholder-pedal.svg`
- Create: `public/playground/placeholder-board.svg`

- [ ] **Step 1: playground.ts 의 features 배열에 pedalboard-planner 추가 (기존 placeholder 였던 `band-name-generator` 와 같은 형식)**

기존 `src/lib/playground.ts`:
```ts
export const playgroundFeatures: PlaygroundFeature[] = [
  { slug: "kim-yeongmin-bot", title: "김영민 봇", ... },
  { slug: "band-name-generator", title: "밴드 이름 생성기", ... },
];
```

`band-name-generator` 위치(2번째)에 `pedalboard-planner` 추가:

```ts
{
  slug: "pedalboard-planner",
  title: "페달보드 플래너",
  description: "원하는 보드를 고르고 페달을 배치해 나만의 페달보드를 공유해보세요.",
  cta: "보드 만들러 가기",
  eyebrow: "이상한 도구",
  href: "/playground/pedalboard-planner",
},
```

- [ ] **Step 2: placeholder SVG**

```xml
<!-- public/playground/placeholder-pedal.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet">
  <rect width="100" height="130" fill="#f5f5f5" stroke="#e5e5e5"/>
  <text x="50" y="68" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#999">pedal</text>
</svg>
```

```xml
<!-- public/playground/placeholder-board.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet">
  <rect width="300" height="100" fill="#f5f5f5" stroke="#e5e5e5"/>
  <text x="150" y="55" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#999">pedalboard</text>
</svg>
```

- [ ] **Step 3: Commit**

```
git add src/lib/playground.ts public/playground/placeholder-pedal.svg public/playground/placeholder-board.svg
git commit -m "feat(playground): list pedalboard planner on /playground; add fallback svgs"
```

---

## Task 21: invariants 스크립트 (Spec §9)

**Files:**
- Create: `scripts/playground-invariants.ts`
- Modify: `package.json` (script 추가)

- [ ] **Step 1: 스크립트 작성**

```ts
// scripts/playground-invariants.ts
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

function loadCreds(path: string) {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const credsArg = process.argv.find((a) => a.startsWith("--creds="));
  const path = credsArg ? credsArg.slice("--creds=".length) : "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";
  const c = loadCreds(path);
  const conn = await mysql.createConnection({
    host: c.DB_HOST, user: c.DB_USER, password: c.DB_PASS, database: c.DB_NAME,
  });

  const checks: { name: string; sql: string }[] = [
    {
      name: "xor invariant (layouts)",
      sql: `SELECT COUNT(*) AS n FROM playground_layouts
            WHERE (board_kind='catalog' AND (catalog_board_id IS NULL OR custom_board_id IS NOT NULL))
               OR (board_kind='custom'  AND (custom_board_id  IS NULL OR catalog_board_id IS NOT NULL))`,
    },
    {
      name: "xor invariant (layout_items)",
      sql: `SELECT COUNT(*) AS n FROM playground_layout_items
            WHERE (item_kind='catalog' AND (catalog_pedal_id IS NULL OR custom_item_id IS NOT NULL))
               OR (item_kind='custom'  AND (custom_item_id  IS NULL OR catalog_pedal_id IS NOT NULL))`,
    },
    {
      name: "snapshot/normalized sync (item count match)",
      sql: `SELECT COUNT(*) AS n FROM playground_layouts l
            WHERE l.snapshot_json IS NOT NULL
              AND JSON_LENGTH(l.snapshot_json, '$.items')
                  <> (SELECT COUNT(*) FROM playground_layout_items li WHERE li.layout_id = l.id)`,
    },
    {
      name: "share_token uniqueness (count distinct = count rows)",
      sql: `SELECT (COUNT(*) - COUNT(DISTINCT share_token)) AS n FROM playground_layouts`,
    },
  ];

  let failed = 0;
  for (const ck of checks) {
    const [rows] = await conn.query<any[]>(ck.sql);
    const n = Number(rows[0]?.n ?? 0);
    const ok = n === 0;
    console.log(`${ok ? "OK  " : "FAIL"}  ${ck.name}  (n=${n})`);
    if (!ok) failed += 1;
  }

  await conn.end();
  if (failed > 0) {
    console.error(`${failed} invariant(s) FAILED`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
```

- [ ] **Step 2: package.json script**

```
// package.json scripts 에 추가
"playground:invariants": "tsx scripts/playground-invariants.ts"
```

- [ ] **Step 3: 실행 — PROD DB**

```
cd /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain
pnpm playground:invariants
```
Expected: 4 OK 라인, exit 0.

- [ ] **Step 4: Commit**

```
git add scripts/playground-invariants.ts package.json
git commit -m "feat(playground): invariants check script"
```

---

## Task 22: Build · chown · final smoke

**Files:** 없음 (운영 시스템 명령만).

- [ ] **Step 1: 빌드**

```
cd /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain
pnpm build
```
Expected: ✓ Compiled. 에러 0.

- [ ] **Step 2: PM2 재시작**

```
pm2 restart bandsustain
```

- [ ] **Step 3: chown 보정**

```
chown -R ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain
```

- [ ] **Step 4: HTTP smoke**

```bash
for path in \
  /playground/pedalboard-planner \
  /playground/pedalboard-planner/me \
  /playground/pedalboard-planner/gallery; do
  curl -sIo /dev/null -w "%{http_code} $path\n" "https://bandsustain.com$path"
done
```
Expected: 모두 200.

- [ ] **Step 5: 사용자 모바일 실기기 검증 — 다음 사이클**

여기서 사용자에게 PROD 시각 검증 요청. 이 시점이 작업 종료점.

- [ ] **Step 6: Commit + push**

```
git push origin main
```

bandsustain 은 main 단일 브랜치라 push 가 곧 PROD. 이미 build·restart·chown 가 완료된 상태로 push.

---

## Self-Review

### Spec coverage

| Spec § | Task |
|---|---|
| §1 범위 | 전체 plan |
| §2 사용자 결정 | Task 1 (snap), 2 (rotate), 4 (serializer), 11 (server-side snap) |
| §3 라우트 | Task 13, 17, 18, 19 |
| §4 컴포넌트 | Task 13~17 |
| §5 owner_token + 자동 저장 + snapshot 포맷 | Task 6 (cookie), 11 (snapshot), 17 (debounce) |
| §6 API | Task 7~12 |
| §7 visibility | Task 5, 14 (ShareSheet), 18 (private→404) |
| §8 에러 처리 | Task 10 (403), 17 (저장 실패 재시도), 18 (404), 11 (board change reject) |
| §9 invariants | Task 21 |
| §10 테스트 | Task 1~5 (unit), 7~12 (smoke), 21 (invariants) |
| §11 디자인 토큰 | Task 13, 14, 15, 16, 18, 19 의 Tailwind class 가 모두 `var(--color-*)`, `font-display`, 직각, 단색 강조 |
| §12 비-목표 | 의도적 제외 (커스텀 페달, 키보드 단축키 등) |

### Placeholder scan

전체 plan 에서 "TBD"/"TODO"/"appropriate handling"/"similar to"  검색 — 없음. 각 step 에 실제 코드 + 명령 + expected output.

### Type consistency

- `Layout`, `LayoutItem`, `LayoutBoard` → Task 4 정의, Task 11/17/18 에서 일관 사용.
- `Visibility` → Task 5 정의, Task 11/14/19 에서 동일 union.
- `Rotation` 의 0/90/180/270 → Task 2 정의, Task 4/11/16 에서 zod literal/type narrow 일치.
- `LayoutCard` → Task 19 정의, /me 와 /gallery 모두 같은 shape.
- `PedalRow` → Task 15 export, Task 17 import 시 같은 필드 (`brand_name`, `name`, `width_in`, `height_in`, `image_filename`).

`onMove(id, x, y)`/`onRotate(id, next)`/`onZ(id, delta)`/`onSelect(id|null)` 시그니처가 BoardCanvas/SelectedInspector/EditorClient 사이에서 일치.

---
