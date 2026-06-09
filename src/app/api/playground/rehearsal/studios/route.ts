import { NextResponse } from "next/server";
import { z } from "zod";
import { listStudios } from "@/lib/playground/rehearsal/studios";
import { studioStatusEnum, equipmentTypeEnum } from "@/lib/playground/rehearsal/types";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  region_id: z.coerce.number().int().positive().optional(),
  status: studioStatusEnum.optional(),
  keyword: z.string().max(80).optional(),
  equipment_type: equipmentTypeEnum.optional(),
});

export async function GET(req: Request) {
  if (!isRehearsalFinderEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "bad_query" }, { status: 400 });
  const items = await listStudios({
    regionId: parsed.data.region_id, status: parsed.data.status,
    keyword: parsed.data.keyword, equipmentType: parsed.data.equipment_type,
  });
  return NextResponse.json({ items });
}
