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
