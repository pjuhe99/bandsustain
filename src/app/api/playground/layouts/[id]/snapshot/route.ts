import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import {
  getLayoutById,
  saveLayoutSnapshot,
} from "@/lib/playground/playgroundDb";
import { canMutateLayout, type Visibility } from "@/lib/playground/visibility";
import { serializeLayout, type Layout } from "@/lib/playground/layoutSerializer";
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
