import { NextResponse } from "next/server";
import { z } from "zod";
import { recommendStudios } from "@/lib/playground/rehearsal/recommend";
import {
  transportModeEnum, originTypeEnum, equipmentTypeEnum,
} from "@/lib/playground/rehearsal/types";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MemberSchema = z.object({
  nickname: z.string().min(1).max(40),
  originText: z.string().min(1).max(160),
  originLat: z.number().finite(),
  originLng: z.number().finite(),
  originType: originTypeEnum.default("manual"),
  transportMode: transportModeEnum.default("transit"),
});

const BodySchema = z.object({
  transportMode: transportModeEnum.default("transit"),
  maxBudgetPerHour: z.number().int().positive().nullable().default(null),
  requiredEquipment: z.array(equipmentTypeEnum).default([]),
  preferredRegionIds: z.array(z.number().int().positive()).default([]),
  members: z.array(MemberSchema).min(1).max(10),
});

export async function POST(req: Request) {
  if (!isRehearsalFinderEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const out = await recommendStudios(parsed.data);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: "recommend_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }
}
