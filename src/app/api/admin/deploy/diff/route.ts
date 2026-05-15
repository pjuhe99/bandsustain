import "server-only";
import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readSession } from "@/lib/auth";
import { APP_DIR } from "@/lib/deploy";

const exec = promisify(execFile);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: APP_DIR, timeout: 30_000 });
  return stdout.trim();
}

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await git(["fetch", "origin", "main"]);
  const head = await git(["rev-parse", "HEAD"]);
  const remote = await git(["rev-parse", "origin/main"]);
  const aheadStr = await git(["rev-list", "--count", "HEAD..origin/main"]);
  const behindStr = await git(["rev-list", "--count", "origin/main..HEAD"]);
  const commitsRaw = aheadStr === "0"
    ? ""
    : await git(["log", "--pretty=format:%h %s", "HEAD..origin/main"]);

  const commits = commitsRaw
    ? commitsRaw.split("\n").map((line) => {
        const [hash, ...rest] = line.split(" ");
        return { hash, subject: rest.join(" ") };
      })
    : [];

  return NextResponse.json({
    head,
    remote,
    ahead: Number(aheadStr),
    behind: Number(behindStr),
    commits,
    fetchedAt: new Date().toISOString(),
  });
}
