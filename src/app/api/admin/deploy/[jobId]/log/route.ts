import "server-only";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { JOB_ID_REGEX, readLogTail, parseLog } from "@/lib/deploy";
import { findByJobId } from "@/lib/deploy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { jobId } = await ctx.params;
  if (!JOB_ID_REGEX.test(jobId)) {
    return NextResponse.json({ error: "invalid jobId" }, { status: 400 });
  }

  const row = await findByJobId(jobId);
  const text = await readLogTail(jobId);
  const parsed = parseLog(text);

  return NextResponse.json({
    jobId,
    row,
    log: text,
    parsed,
  });
}
