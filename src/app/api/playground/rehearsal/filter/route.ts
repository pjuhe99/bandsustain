import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateStudios } from "@/lib/playground/rehearsal/studios";
import { applyStudioFilters } from "@/lib/playground/rehearsal/filter";
import { ROOM_EQUIPMENT_TYPES, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FilterSchema = z.object({
  city: z.string().nullable().default(null),
  gus: z.array(z.string()).default([]),
  instrumentTypes: z.array(z.enum(ROOM_EQUIPMENT_TYPES as unknown as [RoomEquipmentType, ...RoomEquipmentType[]])).default([]),
  priceBucket: z.enum(["u15", "15_20", "20_25", "o25"]).nullable().default(null),
  capacityMin: z.number().int().positive().nullable().default(null),
  parkingOnly: z.boolean().default(false),
  rentalOnly: z.boolean().default(false),
});

export async function POST(req: Request) {
  if (!isRehearsalFinderEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const parsed = FilterSchema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "bad_body", issues: parsed.error.issues }, { status: 400 });
  const studios = await getCandidateStudios();
  return NextResponse.json(applyStudioFilters(studios, parsed.data));
}
