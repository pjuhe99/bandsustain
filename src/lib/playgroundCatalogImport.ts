// Pedalboard planner — 공식 카탈로그 import 유틸.
//
// 안정 식별자 규약 (review 회신):
//   카탈로그 row 의 stable identity 는 (brand, name) 한 쌍이다.
//   width / height / image / category 등 변경 가능한 필드는 식별자에 포함하지 않는다.
//   외부 카탈로그(예: pedalplayground 의 pedals.json) 가 같은 (brand, name) 의 치수/이미지를
//   교정해도 같은 row 가 UPDATE 되어야 하며, 새 row 가 INSERT 되어서는 안 된다.

import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export type CatalogKind = "pedal" | "board";

export type CatalogSourceRow = {
  Brand: string;
  Name: string;
  Width: number;
  Height: number;
  Image?: string | null;
};

export type NormalizedCatalogItem = {
  brand: string;
  name: string;
  brandSlug: string;
  slug: string;
  searchName: string;
  brandSearchName: string;
  widthIn: number;
  heightIn: number;
  imageFilename: string | null;
};

export type UpsertOutcome = "inserted" | "updated" | "unchanged";

export type ItemUpsertResult = {
  id: number;
  brandId: number;
  outcome: UpsertOutcome;
};

export type ImportCounters = {
  brandsInserted: number;
  brandsReused: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsSkipped: number;
  itemsDeactivated: number;
};

export function emptyCounters(): ImportCounters {
  return {
    brandsInserted: 0,
    brandsReused: 0,
    itemsInserted: 0,
    itemsUpdated: 0,
    itemsUnchanged: 0,
    itemsSkipped: 0,
    itemsDeactivated: 0,
  };
}

// ── 정규화 ──────────────────────────────────────────────────────────────

export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g;
const ALLOWED_SEARCH_CHARS = /[^a-z0-9가-힣\s]+/g;
const ALLOWED_SLUG_CHARS = /[^a-z0-9가-힣]+/g;

export function buildSearchName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(ALLOWED_SEARCH_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(ALLOWED_SLUG_CHARS, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return ascii.length > 0 ? ascii.slice(0, 200) : "item";
}

const PEDAL_TABLES = {
  brands: "playground_pedal_brands",
  items: "playground_pedals",
} as const;

const BOARD_TABLES = {
  brands: "playground_board_brands",
  items: "playground_boards",
} as const;

function tablesFor(kind: CatalogKind) {
  return kind === "pedal" ? PEDAL_TABLES : BOARD_TABLES;
}

// ── 검증 ───────────────────────────────────────────────────────────────

export function normalizeRow(row: CatalogSourceRow): NormalizedCatalogItem | null {
  const brand = typeof row.Brand === "string" ? normalizeName(row.Brand) : "";
  const name = typeof row.Name === "string" ? normalizeName(row.Name) : "";
  const width = Number(row.Width);
  const height = Number(row.Height);
  if (brand.length === 0 || name.length === 0) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0 || width > 999.999 || height > 999.999) return null;
  const image = typeof row.Image === "string" && row.Image.trim().length > 0
    ? row.Image.trim().slice(0, 255)
    : null;
  return {
    brand,
    name,
    brandSlug: slugify(brand),
    slug: slugify(name),
    searchName: buildSearchName(name),
    brandSearchName: buildSearchName(brand),
    widthIn: round3(width),
    heightIn: round3(height),
    imageFilename: image,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ── 브랜드 upsert ──────────────────────────────────────────────────────
// 식별자: brand name (정확 매칭). 슬러그 충돌 시 brand 의 진짜 이름이 다르면
// 새 row 로 처리해야 하므로 lookup 키는 name 이지 slug 가 아니다.

export async function upsertBrand(
  conn: PoolConnection | Pool,
  kind: CatalogKind,
  brandName: string,
  brandSlug: string,
  brandSearchName: string,
  counters: ImportCounters,
): Promise<number> {
  const t = tablesFor(kind);
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM ${t.brands} WHERE name = ? LIMIT 1`,
    [brandName],
  );
  if (rows.length > 0) {
    counters.brandsReused += 1;
    return rows[0].id as number;
  }
  const uniqueSlug = await resolveUniqueSlug(conn, t.brands, brandSlug);
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO ${t.brands} (name, slug, search_name) VALUES (?, ?, ?)`,
    [brandName, uniqueSlug, brandSearchName],
  );
  counters.brandsInserted += 1;
  return result.insertId;
}

async function resolveUniqueSlug(
  conn: PoolConnection | Pool,
  table: string,
  base: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE slug = ? LIMIT 1`,
      [candidate],
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 999) throw new Error(`Cannot resolve unique slug for base "${base}"`);
  }
}

// ── 아이템 upsert ──────────────────────────────────────────────────────
// 식별자: (brand_id, name). 다른 컬럼은 모두 mutable.
// 같은 (brand, name) 으로 다시 들어오면 width/height/image/is_active 만 갱신한다.
// 모든 mutable 컬럼 값이 동일하면 outcome='unchanged' (source_revision 미증가, last_imported_at 만 갱신).

export async function upsertItem(
  conn: PoolConnection | Pool,
  kind: CatalogKind,
  item: NormalizedCatalogItem,
  brandId: number,
  counters: ImportCounters,
): Promise<ItemUpsertResult> {
  const t = tablesFor(kind);
  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT id, slug, width_in, height_in, image_filename, is_active, source_revision
       FROM ${t.items}
       WHERE brand_id = ? AND name = ?
       LIMIT 1`,
    [brandId, item.name],
  );

  if (existing.length === 0) {
    const slug = await resolveUniqueSlugScoped(conn, t.items, brandId, item.slug);
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO ${t.items}
         (brand_id, name, slug, search_name, width_in, height_in, image_filename,
          is_active, source_revision, last_imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)`,
      [brandId, item.name, slug, item.searchName, item.widthIn, item.heightIn, item.imageFilename],
    );
    counters.itemsInserted += 1;
    return { id: result.insertId, brandId, outcome: "inserted" };
  }

  const row = existing[0];
  const id = row.id as number;
  const currWidth = Number(row.width_in);
  const currHeight = Number(row.height_in);
  const currImage = (row.image_filename as string | null) ?? null;
  const currActive = Number(row.is_active);

  const widthChanged = round3(currWidth) !== item.widthIn;
  const heightChanged = round3(currHeight) !== item.heightIn;
  const imageChanged = (currImage ?? null) !== item.imageFilename;
  const activeChanged = currActive !== 1;
  const anyChange = widthChanged || heightChanged || imageChanged || activeChanged;

  if (!anyChange) {
    await conn.query(
      `UPDATE ${t.items}
         SET search_name = ?, last_imported_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [item.searchName, id],
    );
    counters.itemsUnchanged += 1;
    return { id, brandId, outcome: "unchanged" };
  }

  await conn.query(
    `UPDATE ${t.items}
       SET width_in = ?,
           height_in = ?,
           image_filename = ?,
           is_active = 1,
           search_name = ?,
           source_revision = source_revision + 1,
           last_imported_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [item.widthIn, item.heightIn, item.imageFilename, item.searchName, id],
  );
  counters.itemsUpdated += 1;
  return { id, brandId, outcome: "updated" };
}

async function resolveUniqueSlugScoped(
  conn: PoolConnection | Pool,
  table: string,
  brandId: number,
  base: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE brand_id = ? AND slug = ? LIMIT 1`,
      [brandId, candidate],
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 999) throw new Error(`Cannot resolve unique slug for base "${base}" within brand ${brandId}`);
  }
}

// ── deactivate-missing ─────────────────────────────────────────────────
// 이번 import 에서 보지 못한 active row 를 is_active=0 으로 표시한다.
// hard-delete 는 하지 않는다 (layout_items 가 catalog_pedal_id 로 참조 중일 수 있음).

export async function deactivateMissing(
  conn: PoolConnection | Pool,
  kind: CatalogKind,
  seenIds: ReadonlySet<number>,
  counters: ImportCounters,
): Promise<number> {
  const t = tablesFor(kind);
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM ${t.items} WHERE is_active = 1`,
  );
  const toDeactivate: number[] = [];
  for (const r of rows) {
    const id = r.id as number;
    if (!seenIds.has(id)) toDeactivate.push(id);
  }
  if (toDeactivate.length === 0) return 0;
  // chunk in batches of 1000 to keep IN list manageable
  let total = 0;
  for (let i = 0; i < toDeactivate.length; i += 1000) {
    const chunk = toDeactivate.slice(i, i + 1000);
    const placeholders = chunk.map(() => "?").join(",");
    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE ${t.items} SET is_active = 0 WHERE id IN (${placeholders})`,
      chunk,
    );
    total += result.affectedRows ?? 0;
  }
  counters.itemsDeactivated += total;
  return total;
}
