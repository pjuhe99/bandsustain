import "server-only";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { findRecent } from "@/lib/deploy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await findRecent(10);
  return NextResponse.json({
    rows: rows.map((r) => ({
      jobId: r.job_id,
      actor: r.actor,
      kind: r.kind,
      preHead: r.pre_head,
      postHead: r.post_head,
      targetRef: r.target_ref,
      status: r.status,
      failStep: r.fail_step,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationSec: r.duration_sec,
    })),
  });
}
