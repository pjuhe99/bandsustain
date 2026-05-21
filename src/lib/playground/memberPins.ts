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
