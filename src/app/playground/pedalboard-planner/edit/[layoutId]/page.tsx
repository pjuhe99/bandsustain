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
  const row = await getLayoutWithBoard(id) as RowDataPacket;
  if (!row) notFound();
  const owner = await getOwnerToken();
  if (!canMutateLayout({ visibility: row["visibility"], owner_token: row["owner_token"] }, owner)) {
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
    kind: "catalog", id: Number(r["id"]), x: Number(r["x"]), y: Number(r["y"]),
    rot: Number(r["rot"]) as 0 | 90 | 180 | 270, z: Number(r["z"]),
    brand: String(r["brand"] ?? ""), name: String(r["name"] ?? "삭제된 페달"),
    width_in: Number(r["width_in"] ?? 2), height_in: Number(r["height_in"] ?? 2),
    image_filename: r["image_filename"] ? String(r["image_filename"]) : null,
  }));

  return (
    <EditorClient
      layoutId={id}
      shareToken={String(row["share_token"])}
      initialTitle={String(row["title"])}
      initialVisibility={row["visibility"]}
      initialBoard={{
        kind: "catalog", id: Number(row["catalog_board_id"]),
        brand: String(row["board_brand"] ?? ""), name: String(row["board_name"] ?? ""),
        width_in: Number(row["board_width_in"] ?? 14), height_in: Number(row["board_height_in"] ?? 3),
        image_filename: row["board_image_filename"] ? String(row["board_image_filename"]) : null,
      }}
      initialItems={items}
    />
  );
}
