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
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    board_kind: r.board_kind,
    catalog_board_id: r.catalog_board_id,
    visibility: r.visibility,
    share_token: r.share_token,
    snapshot_json: r.snapshot_json,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  return NextResponse.json({ items });
}
