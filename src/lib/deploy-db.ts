import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "./db";

export type DeployStatus = "running" | "success" | "fail" | "interrupted";
export type DeployKind = "deploy" | "rollback";

export type DeployRow = {
  id: number;
  job_id: string;
  actor: string;
  kind: DeployKind;
  pre_head: string | null;
  post_head: string | null;
  target_ref: string | null;
  status: DeployStatus;
  fail_step: string | null;
  started_at: Date;
  ended_at: Date | null;
  duration_sec: number | null;
  log_path: string;
};

export async function insertRunning(opts: {
  jobId: string;
  actor: string;
  kind: DeployKind;
  targetRef: string | null;
  logPath: string;
}): Promise<void> {
  const pool = getPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO deploy_history
       (job_id, actor, kind, target_ref, status, started_at, log_path)
     VALUES (?, ?, ?, ?, 'running', NOW(), ?)`,
    [opts.jobId, opts.actor, opts.kind, opts.targetRef, opts.logPath],
  );
}

export async function findRunning(): Promise<DeployRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM deploy_history WHERE status='running' ORDER BY started_at DESC LIMIT 1`,
  );
  return (rows[0] as DeployRow | undefined) ?? null;
}

export async function findByJobId(jobId: string): Promise<DeployRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM deploy_history WHERE job_id=? LIMIT 1`,
    [jobId],
  );
  return (rows[0] as DeployRow | undefined) ?? null;
}

export async function findRecent(limit = 10): Promise<DeployRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM deploy_history ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return rows as DeployRow[];
}

export async function findLastSuccess(): Promise<DeployRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM deploy_history WHERE status='success' ORDER BY started_at DESC LIMIT 1`,
  );
  return (rows[0] as DeployRow | undefined) ?? null;
}

/** Returns true if the given hash appears as pre_head OR post_head in any success row. */
export async function isWhitelistedRollbackHash(hash: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok
       FROM deploy_history
      WHERE status='success' AND (pre_head=? OR post_head=?)
      LIMIT 1`,
    [hash, hash],
  );
  return rows.length > 0;
}

/** Sweep stale running rows whose log file lock is no longer held. */
export async function sweepStale(staleMinutes = 15): Promise<number> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE deploy_history
        SET status='interrupted', ended_at=NOW()
      WHERE status='running' AND started_at < NOW() - INTERVAL ? MINUTE`,
    [staleMinutes],
  );
  return res.affectedRows;
}
