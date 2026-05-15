import "server-only";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readSession } from "@/lib/auth";
import { newJobId, logPathFor, DEPLOY_SCRIPT, APP_DIR } from "@/lib/deploy";
import { findRunning, insertRunning } from "@/lib/deploy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await findRunning();
  if (existing) {
    return NextResponse.json(
      { error: "already_running", jobId: existing.job_id },
      { status: 409 },
    );
  }

  const jobId = newJobId();
  const logPath = logPathFor(jobId);
  await insertRunning({ jobId, actor: session.u, kind: "deploy", targetRef: "origin/main", logPath });

  const child = spawn("bash", [DEPLOY_SCRIPT, jobId], {
    cwd: APP_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ACTOR: session.u },
  });
  child.unref();

  return NextResponse.json({ jobId }, { status: 202 });
}
