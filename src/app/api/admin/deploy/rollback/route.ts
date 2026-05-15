import "server-only";
import { NextResponse } from "next/server";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readSession } from "@/lib/auth";
import { COMMIT_HASH_REGEX, newJobId, logPathFor, DEPLOY_LAUNCH_SCRIPT, APP_DIR } from "@/lib/deploy";
import { findRunning, insertRunning, isWhitelistedRollbackHash } from "@/lib/deploy-db";

const exec = promisify(execFile);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { target_hash?: unknown };
  try { body = (await req.json()) as { target_hash?: unknown }; } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const hash = String(body.target_hash ?? "");
  if (!COMMIT_HASH_REGEX.test(hash)) {
    return NextResponse.json({ error: "invalid target_hash" }, { status: 400 });
  }

  if (!(await isWhitelistedRollbackHash(hash))) {
    return NextResponse.json({ error: "hash not in success history" }, { status: 400 });
  }

  try {
    await exec("git", ["cat-file", "-e", hash], { cwd: APP_DIR, timeout: 10_000 });
  } catch {
    return NextResponse.json({ error: "hash not present in local repo" }, { status: 400 });
  }

  const existing = await findRunning();
  if (existing) {
    return NextResponse.json({ error: "already_running", jobId: existing.job_id }, { status: 409 });
  }

  const jobId = newJobId();
  await insertRunning({
    jobId, actor: session.u, kind: "rollback", targetRef: hash, logPath: logPathFor(jobId),
  });

  const child = spawn("bash", [DEPLOY_LAUNCH_SCRIPT, jobId, "--rollback", hash], {
    cwd: APP_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ACTOR: session.u },
  });
  child.unref();

  return NextResponse.json({ jobId }, { status: 202 });
}
