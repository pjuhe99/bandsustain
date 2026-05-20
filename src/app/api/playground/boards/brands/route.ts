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
