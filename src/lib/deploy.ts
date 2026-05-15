import "server-only";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { existsSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";

export const DEPLOY_LOG_DIR = "/var/log/bandsustain-deploy";
export const DEPLOY_LOCK_FILE = join(DEPLOY_LOG_DIR, "lock");
export const APP_DIR = "/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain";
export const DEPLOY_SCRIPT = join(APP_DIR, "scripts", "deploy.sh");
export const JOB_ID_REGEX = /^[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$/;
export const COMMIT_HASH_REGEX = /^[a-f0-9]{7,40}$/;

/** Create a jobId of the form yyyymmdd-HHMMSS-<6 hex>, in server's local TZ. */
export function newJobId(now: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = randomBytes(3).toString("hex");
  return `${date}-${time}-${rand}`;
}

/** Path of a job log file. */
export function logPathFor(jobId: string): string {
  if (!JOB_ID_REGEX.test(jobId)) throw new Error(`invalid jobId: ${jobId}`);
  return join(DEPLOY_LOG_DIR, `${jobId}.log`);
}

export type StepStatus = "running" | "ok" | "fail";
export type ParsedLog = {
  kind: "deploy" | "rollback" | null;
  actor: string | null;
  preHead: string | null;
  postHead: string | null;
  steps: { name: string; status: StepStatus; durationSec: number | null }[];
  result: { status: "success" | "fail" | "interrupted"; failStep: string | null; totalSec: number | null } | null;
};

/** Parse the marker-based log format from deploy.sh into a structured form. */
export function parseLog(text: string): ParsedLog {
  const out: ParsedLog = {
    kind: null,
    actor: null,
    preHead: null,
    postHead: null,
    steps: [],
    result: null,
  };
  for (const line of text.split("\n")) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^## JOB \S+ START kind=(\S+) actor=(\S+)/))) {
      out.kind = m[1] === "rollback" ? "rollback" : "deploy";
      out.actor = m[2];
    } else if ((m = line.match(/^## PRE_HEAD ([a-f0-9]{7,40})/))) {
      out.preHead = m[1];
    } else if ((m = line.match(/^## POST_HEAD ([a-f0-9]{7,40})/))) {
      out.postHead = m[1];
    } else if ((m = line.match(/^## STEP (\S+)(?:\s+(.*))?/))) {
      out.steps.push({ name: m[1], status: "running", durationSec: null });
    } else if ((m = line.match(/^## STEP_OK (\S+) ([0-9.]+)s/))) {
      const last = out.steps[out.steps.length - 1];
      if (last && last.name === m[1]) {
        last.status = "ok";
        last.durationSec = Number(m[2]);
      } else {
        out.steps.push({ name: m[1], status: "ok", durationSec: Number(m[2]) });
      }
    } else if ((m = line.match(/^## STEP_FAIL (\S+) exit=(\d+)(?: elapsed=([0-9.]+)s)?/))) {
      const last = out.steps[out.steps.length - 1];
      if (last && last.name === m[1]) {
        last.status = "fail";
        last.durationSec = m[3] ? Number(m[3]) : null;
      } else {
        out.steps.push({ name: m[1], status: "fail", durationSec: m[3] ? Number(m[3]) : null });
      }
    } else if ((m = line.match(/^## RESULT (SUCCESS|FAIL|INTERRUPTED)(?:\s+step=(\S+))?(?:.*\stotal=([0-9.]+)s)?/))) {
      out.result = {
        status: m[1].toLowerCase() as "success" | "fail" | "interrupted",
        failStep: m[2] ?? null,
        totalSec: m[3] ? Number(m[3]) : null,
      };
    }
  }
  return out;
}

/** Read the log file with bounded tail size. */
export async function readLogTail(jobId: string, maxBytes = 64 * 1024): Promise<string> {
  const path = logPathFor(jobId);
  if (!existsSync(path)) return "";
  const stat = await fs.stat(path);
  if (stat.size <= maxBytes) {
    return fs.readFile(path, "utf8");
  }
  const fd = await fs.open(path, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    await fd.read(buf, 0, maxBytes, stat.size - maxBytes);
    return buf.toString("utf8");
  } finally {
    await fd.close();
  }
}

/** True iff the lock file is currently held by another process. */
export function isLockHeld(): boolean {
  if (!existsSync(DEPLOY_LOCK_FILE)) return false;
  try {
    const fd = openSync(DEPLOY_LOCK_FILE, "r");
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}
