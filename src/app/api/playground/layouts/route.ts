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
