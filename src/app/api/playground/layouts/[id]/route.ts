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

  const safeLayout = {
    id: layout.id,
    title: layout.title,
    board_kind: layout.board_kind,
    catalog_board_id: layout.catalog_board_id,
    visibility: layout.visibility,
    share_token: layout.share_token,
    snapshot_json: layout.snapshot_json,
    created_at: layout.created_at,
    updated_at: layout.updated_at,
  };
  return NextResponse.json({ layout: safeLayout, items });
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
