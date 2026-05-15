import { findRecent, findRunning, findLastSuccess, type DeployRow } from "@/lib/deploy-db";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { APP_DIR } from "@/lib/deploy";
import DeployPanel from "./DeployPanel";

const exec = promisify(execFile);

export const dynamic = "force-dynamic";

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: APP_DIR, timeout: 10_000 });
  return stdout.trim();
}

export default async function DeployPage() {
  const [head, headSubject, recent, running, lastSuccess] = await Promise.all([
    git(["rev-parse", "HEAD"]),
    git(["log", "-1", "--pretty=%s"]),
    findRecent(10),
    findRunning(),
    findLastSuccess(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display font-black uppercase text-2xl md:text-3xl">Deploy</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          현재 HEAD: <code className="font-mono text-[var(--color-text)]">{head.slice(0, 7)}</code>{" "}
          — {headSubject}
        </p>
      </header>

      <DeployPanel
        initialHead={head}
        initialHeadSubject={headSubject}
        initialRecent={serializeRows(recent)}
        initialRunningJobId={running?.job_id ?? null}
        rollbackCandidateHash={lastSuccess?.pre_head ?? null}
      />
    </div>
  );
}

function serializeRows(rows: DeployRow[]) {
  return rows.map((r) => ({
    jobId: r.job_id,
    actor: r.actor,
    kind: r.kind,
    preHead: r.pre_head,
    postHead: r.post_head,
    status: r.status,
    failStep: r.fail_step,
    startedAt: r.started_at.toISOString(),
    endedAt: r.ended_at ? r.ended_at.toISOString() : null,
    durationSec: r.duration_sec,
  }));
}
