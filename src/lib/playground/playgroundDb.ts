import "server-only";
import { getPool } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { Visibility } from "./visibility";
import { generateToken } from "./tokens";

export interface CatalogBrand {
  id: number;
  name: string;
  slug: string;
}

export interface CatalogPedal {
  id: number;
  brand_id: number;
  brand_name: string;
  name: string;
  slug: string;
  width_in: number;
  height_in: number;
  image_filename: string | null;
}
export type CatalogBoard = CatalogPedal;

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
    id: Number(r.id),
    brand_id: Number(r.brand_id),
    brand_name: String(r.brand_name),
    name: String(r.name),
    slug: String(r.slug),
    width_in: Number(r.width_in),
    height_in: Number(r.height_in),
    image_filename: r.image_filename ? String(r.image_filename) : null,
  }));
}

export async function searchPedals(opts: {
  q?: string;
  brand_id?: number;
  limit: number;
  offset: number;
}) {
  return searchItems("playground_pedals", "playground_pedal_brands", opts);
}
export async function searchBoards(opts: {
  q?: string;
  brand_id?: number;
  limit: number;
  offset: number;
}) {
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
  const whereClause = where.length ? `AND ${where.join(" AND ")}` : "";
  const sql = `
    SELECT b.id, b.name, b.slug
    FROM ${brandTable} b
    WHERE EXISTS (SELECT 1 FROM ${itemTable} p WHERE p.brand_id = b.id AND p.is_active = 1)
    ${whereClause}
    ORDER BY b.search_name ASC
    LIMIT 1000
  `;
  const [rows] = await pool.query<RowDataPacket[]>(sql, args);
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    slug: String(r.slug),
  }));
}
export async function listPedalBrands(q?: string) {
  return listBrandsForActive("playground_pedal_brands", "playground_pedals", q);
}
export async function listBoardBrands(q?: string) {
  return listBrandsForActive("playground_board_brands", "playground_boards", q);
}

export interface LayoutRow {
  id: number;
  owner_token: string;
  title: string;
  board_kind: "catalog";
  catalog_board_id: number | null;
  visibility: Visibility;
  share_token: string;
  snapshot_json: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createLayout(input: {
  owner_token: string;
  catalog_board_id: number;
  title: string;
}): Promise<LayoutRow> {
  const pool = getPool();
  const share_token = generateToken();
  const [res] = await pool.query<ResultSetHeader>(
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
    `SELECT * FROM playground_layouts WHERE id = ? LIMIT 1`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as LayoutRow;
}

export async function getLayoutByShareToken(
  token: string,
): Promise<LayoutRow | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM playground_layouts WHERE share_token = ? LIMIT 1`,
    [token],
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as LayoutRow;
}

export async function deleteLayoutById(id: number): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM playground_layouts WHERE id = ?`, [id]);
}

interface SnapshotItemInput {
  catalog_pedal_id: number;
  x: number;
  y: number;
  rot: number;
  z: number;
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
    await conn.query(
      `DELETE FROM playground_layout_items WHERE layout_id=?`,
      [input.id],
    );
    if (input.items.length > 0) {
      const values = input.items.map((it, idx) => [
        input.id,
        "catalog",
        it.catalog_pedal_id,
        null,
        it.x,
        it.y,
        it.rot,
        it.z !== undefined ? it.z : idx,
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

export async function listLayoutsForOwner(
  owner_token: string,
  limit: number,
  offset: number,
): Promise<LayoutRow[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM playground_layouts WHERE owner_token = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [owner_token, limit, offset],
  );
  return rows as unknown as LayoutRow[];
}

export async function listPublicLayouts(
  limit: number,
  offset: number,
): Promise<LayoutRow[]> {
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
      WHERE l.id = ? LIMIT 1`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0];
}
