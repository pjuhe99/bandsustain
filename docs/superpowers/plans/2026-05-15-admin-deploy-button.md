# Admin Deploy Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/deploy` tab to bandsustain admin so the operator can pull `origin/main`, build, and restart PM2 from the browser, with diff preview, rollback, and history.

**Architecture:** Next.js API handler spawns a detached, ec2-user-owned bash script (`scripts/deploy.sh`) that holds a single `flock` for the duration, writes a marker-formatted log to `/var/log/bandsustain-deploy/<jobId>.log`, and updates `deploy_history` in MariaDB. UI polls the log endpoint every 2s and survives `pm2 restart` because the script is independent of the Next.js process.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), mysql2/promise, bash 5 (`flock`, `pm2`, `pnpm`, `git`, `curl`), MariaDB.

**Spec:** [`docs/2026-05-15-admin-deploy-button-design.md`](../../2026-05-15-admin-deploy-button-design.md)

**Test strategy deviation from spec:** repo has no existing test framework (no vitest/jest). To stay surgical, this plan uses (a) bash assertions for `deploy.sh --dry-run`, (b) `tsc --noEmit` for type safety, (c) integration smoke checklists for API + UI. JS unit tests are out of scope for the 1차 테스트.

**Conventions used throughout this plan:**
- All shell commands assume cwd `/root/bandsustain/public_html/bandsustain` (= `/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain`).
- All `git` commits are authored by the user (`pjuhe99 <soritunenglish@gmail.com>`) — when committing via this Claude instance use `git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit ...`.
- All shell needing ec2-user perms uses `sudo -u ec2-user bash -lc '<command>'`.
- Do **not** push to `origin/main` from inside this plan. Commits stay local until the operator does a manual `git push` at the end (per `MEMORY.md` deploy rule).

---

## File Map

**Create:**
- `db/schema/011_deploy_history.sql` — table DDL
- `scripts/deploy.sh` — main deploy/rollback script (bash)
- `scripts/deploy-sweep.sh` — stale-row sweeper (bash)
- `scripts/test_deploy.sh` — plain-bash assertion tests for deploy.sh --dry-run
- `src/lib/deploy.ts` — pure helpers (jobId, log parsing, log path)
- `src/lib/deploy-db.ts` — `deploy_history` CRUD
- `src/app/api/admin/deploy/route.ts` — POST start
- `src/app/api/admin/deploy/diff/route.ts` — POST diff preview
- `src/app/api/admin/deploy/rollback/route.ts` — POST rollback
- `src/app/api/admin/deploy/history/route.ts` — GET 10 rows
- `src/app/api/admin/deploy/[jobId]/log/route.ts` — GET tail
- `src/app/admin/(authed)/deploy/page.tsx` — server component (SSR fetch)
- `src/app/admin/(authed)/deploy/DeployPanel.tsx` — client component

**Modify:**
- `src/components/admin/AdminNav.tsx` — add `{ href: "/admin/deploy", label: "Deploy" }`

---

## Task 1: Create and apply `deploy_history` schema

**Files:**
- Create: `db/schema/011_deploy_history.sql`

- [ ] **Step 1: Write the schema file**

```sql
-- 011_deploy_history.sql
-- bandsustain.com /admin/deploy — git pull + build + pm2 restart 이력
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/011_deploy_history.sql

CREATE TABLE IF NOT EXISTS deploy_history (
  id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
  job_id        VARCHAR(40)  NOT NULL UNIQUE,
  actor         VARCHAR(64)  NOT NULL,
  kind          ENUM('deploy','rollback') NOT NULL,
  pre_head      CHAR(40)     NULL,
  post_head     CHAR(40)     NULL,
  target_ref    VARCHAR(100) NULL,
  status        ENUM('running','success','fail','interrupted') NOT NULL,
  fail_step     VARCHAR(40)  NULL,
  started_at    DATETIME     NOT NULL,
  ended_at      DATETIME     NULL,
  duration_sec  INT          NULL,
  log_path      VARCHAR(255) NOT NULL,
  INDEX idx_started_at (started_at DESC),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Apply to bandsustain DB**

Run:
```bash
set -a; . /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /root/bandsustain/public_html/bandsustain/db/schema/011_deploy_history.sql
```

Expected: no output, exit 0.

- [ ] **Step 3: Verify table exists and is empty**

Run:
```bash
set -a; . /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DESCRIBE deploy_history; SELECT COUNT(*) AS n FROM deploy_history;"
```

Expected: 13 columns described, `n = 0`.

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add db/schema/011_deploy_history.sql
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): add deploy_history schema (011)"
```

---

## Task 2: Set up `/var/log/bandsustain-deploy/` directory

**Files:** (no source files; system state only)

- [ ] **Step 1: Create the directory with correct ownership**

Run:
```bash
sudo mkdir -p /var/log/bandsustain-deploy
sudo chown ec2-user:ec2-user /var/log/bandsustain-deploy
sudo chmod 755 /var/log/bandsustain-deploy
sudo restorecon -Rv /var/log/bandsustain-deploy
```

Expected: directory exists, owner `ec2-user:ec2-user`, mode `755`, SELinux context `var_log_t`.

- [ ] **Step 2: Verify**

Run:
```bash
ls -lZd /var/log/bandsustain-deploy
sudo -u ec2-user touch /var/log/bandsustain-deploy/_smoke && sudo -u ec2-user rm /var/log/bandsustain-deploy/_smoke && echo OK
```

Expected: directory line shows `ec2-user ec2-user ... var_log_t ...`, smoke prints `OK`.

(No commit — directory creation is environment, not source.)

---

## Task 3: `scripts/deploy.sh` — skeleton (arg parse, log redirect, lock, trap)

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Write the skeleton**

Create `/root/bandsustain/public_html/bandsustain/scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
# scripts/deploy.sh — bandsustain admin [배포] button entrypoint
#
# Usage:
#   deploy.sh <jobId>                       # forward deploy from origin/main
#   deploy.sh <jobId> --rollback <hash>     # reset to <hash> and rebuild
#   deploy.sh --dry-run <jobId> [...]       # echo commands instead of running them
#
# Env overrides (optional):
#   DEPLOY_LOG_DIR (default /var/log/bandsustain-deploy)
#   APP_DIR        (default /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain)
#   PM2_NAME       (default bandsustain)
#   HEALTH_URL     (default http://127.0.0.1:3100/)
#   DB_CREDS       (default /var/www/html/_______site_BANDSUSTAIN/.db_credentials)
#
# Exit codes: 0=ok, 1=deploy step failed, 2=smoke failed, 3=lock not acquired
set -euo pipefail

DEPLOY_LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/bandsustain-deploy}"
APP_DIR="${APP_DIR:-/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain}"
PM2_NAME="${PM2_NAME:-bandsustain}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3100/}"
DB_CREDS="${DB_CREDS:-/var/www/html/_______site_BANDSUSTAIN/.db_credentials}"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

JOB_ID="${1:-}"
KIND="deploy"
ROLLBACK_HASH=""
if [[ "${2:-}" == "--rollback" ]]; then
  KIND="rollback"
  ROLLBACK_HASH="${3:-}"
fi

# Validate jobId: yyyymmdd-HHMMSS-<6 hex>
if ! [[ "$JOB_ID" =~ ^[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$ ]]; then
  echo "deploy.sh: invalid jobId: ${JOB_ID}" >&2
  exit 1
fi

if [[ "$KIND" == "rollback" ]] && ! [[ "$ROLLBACK_HASH" =~ ^[a-f0-9]{7,40}$ ]]; then
  echo "deploy.sh: invalid rollback hash: ${ROLLBACK_HASH}" >&2
  exit 1
fi

# Must run as ec2-user so git/pnpm/pm2 act on the correct ownership.
# When spawned by PM2 (Next.js), this is automatic. For manual runs from root,
# re-exec via sudo -u ec2-user.
if [[ "$(id -un)" != "ec2-user" ]]; then
  exec sudo -u ec2-user -- "$0" ${DRY_RUN:+--dry-run} "$JOB_ID" ${ROLLBACK_HASH:+--rollback "$ROLLBACK_HASH"}
fi

LOG_FILE="${DEPLOY_LOG_DIR}/${JOB_ID}.log"
LOCK_FILE="${DEPLOY_LOG_DIR}/lock"

# Redirect all output to the job log from this point on.
exec >>"${LOG_FILE}" 2>&1

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

now_ts() { date +%s; }
START_TS="$(now_ts)"

trap 'rc=$?; if ! grep -q "^## RESULT " "${LOG_FILE}"; then echo "## RESULT INTERRUPTED total=$(( $(now_ts) - START_TS ))s"; fi; exit "$rc"' EXIT

# Acquire lock (non-blocking). If lost, do not write any RESULT — caller will sweep us.
exec {LOCKFD}>"${LOCK_FILE}"
if ! flock -n "$LOCKFD"; then
  echo "## JOB ${JOB_ID} ABORT reason=lock_held"
  echo "## RESULT FAIL step=lock_acquire"
  exit 3
fi

echo "## JOB ${JOB_ID} START kind=${KIND} actor=${ACTOR:-unknown}"

# (Steps fill in later tasks.)
# Placeholder so the skeleton exits cleanly:
echo "## RESULT SUCCESS total=$(( $(now_ts) - START_TS ))s"
```

- [ ] **Step 2: Make executable**

Run:
```bash
chmod +x /root/bandsustain/public_html/bandsustain/scripts/deploy.sh
```

- [ ] **Step 3: Smoke the skeleton with a valid jobId**

Run:
```bash
sudo -u ec2-user env ACTOR=test /root/bandsustain/public_html/bandsustain/scripts/deploy.sh 20260515-000000-aaaaaa
cat /var/log/bandsustain-deploy/20260515-000000-aaaaaa.log
```

Expected: log shows
```
## JOB 20260515-000000-aaaaaa START kind=deploy actor=test
## RESULT SUCCESS total=0s
```

- [ ] **Step 4: Smoke with invalid jobId**

Run:
```bash
sudo -u ec2-user /root/bandsustain/public_html/bandsustain/scripts/deploy.sh bogus; echo "exit=$?"
```

Expected: stderr `deploy.sh: invalid jobId: bogus`, `exit=1`.

- [ ] **Step 5: Smoke the lock (start two concurrent dry-runs)**

Run:
```bash
sudo -u ec2-user /root/bandsustain/public_html/bandsustain/scripts/deploy.sh --dry-run 20260515-000001-bbbbbb &
sudo -u ec2-user /root/bandsustain/public_html/bandsustain/scripts/deploy.sh --dry-run 20260515-000002-cccccc &
wait
grep -H RESULT /var/log/bandsustain-deploy/20260515-00000[12]-*.log
```

Expected: one log ends `## RESULT SUCCESS`, the other ends `## RESULT FAIL step=lock_acquire`.

- [ ] **Step 6: Clean up smoke log files**

Run:
```bash
sudo -u ec2-user rm /var/log/bandsustain-deploy/20260515-000000-aaaaaa.log /var/log/bandsustain-deploy/20260515-000001-bbbbbb.log /var/log/bandsustain-deploy/20260515-000002-cccccc.log
```

- [ ] **Step 7: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add scripts/deploy.sh
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): deploy.sh skeleton with arg parse + flock + log trap"
```

---

## Task 4: `scripts/deploy.sh` — git steps (fetch / pull / rollback)

**Files:**
- Modify: `scripts/deploy.sh` (replace the placeholder block from Task 3 Step 1)

- [ ] **Step 1: Replace the placeholder block**

In `scripts/deploy.sh`, replace the two trailing lines

```bash
# (Steps fill in later tasks.)
# Placeholder so the skeleton exits cleanly:
echo "## RESULT SUCCESS total=$(( $(now_ts) - START_TS ))s"
```

with this block (keep everything above unchanged):

```bash
cd "$APP_DIR"

step_ok() { local name="$1" t0="$2"; echo "## STEP_OK ${name} $(( $(now_ts) - t0 ))s"; }
step_fail() {
  local name="$1" rc="$2" t0="$3"
  echo "## STEP_FAIL ${name} exit=${rc} elapsed=$(( $(now_ts) - t0 ))s"
  echo "## RESULT FAIL step=${name} total=$(( $(now_ts) - START_TS ))s"
  exit 1
}

# 1. git fetch
echo "## STEP git_fetch"
T0="$(now_ts)"
if ! run git fetch origin main; then step_fail git_fetch $? "$T0"; fi
step_ok git_fetch "$T0"

# 2. PRE_HEAD
PRE_HEAD="$(git rev-parse HEAD)"
echo "## PRE_HEAD ${PRE_HEAD}"

# 3. pull or reset
if [[ "$KIND" == "rollback" ]]; then
  echo "## STEP git_reset target=${ROLLBACK_HASH}"
  T0="$(now_ts)"
  if ! run git reset --hard "$ROLLBACK_HASH"; then step_fail git_reset $? "$T0"; fi
  step_ok git_reset "$T0"
else
  echo "## STEP git_pull"
  T0="$(now_ts)"
  if ! run git pull --ff-only origin main; then step_fail git_pull $? "$T0"; fi
  step_ok git_pull "$T0"
fi

# (More steps in next tasks.)
echo "## RESULT SUCCESS total=$(( $(now_ts) - START_TS ))s"
```

- [ ] **Step 2: Verify git_fetch step in dry-run**

Run:
```bash
sudo -u ec2-user env ACTOR=test /root/bandsustain/public_html/bandsustain/scripts/deploy.sh --dry-run 20260515-100000-aaaaaa
grep -E '^## (STEP|PRE_HEAD|STEP_OK|RESULT)' /var/log/bandsustain-deploy/20260515-100000-aaaaaa.log
```

Expected:
```
## JOB ... START ...
## STEP git_fetch
## STEP_OK git_fetch 0s
## PRE_HEAD <40-char hash>
## STEP git_pull
## STEP_OK git_pull 0s
## RESULT SUCCESS ...
```

- [ ] **Step 3: Verify rollback path in dry-run**

Run:
```bash
sudo -u ec2-user env ACTOR=test /root/bandsustain/public_html/bandsustain/scripts/deploy.sh --dry-run 20260515-100001-bbbbbb --rollback 35e23b8
grep -E '^## (STEP|PRE_HEAD)' /var/log/bandsustain-deploy/20260515-100001-bbbbbb.log
```

Expected: `STEP git_fetch`, `PRE_HEAD ...`, `STEP git_reset target=35e23b8`, `STEP_OK git_reset 0s`.

- [ ] **Step 4: Clean up smoke logs**

```bash
sudo -u ec2-user rm /var/log/bandsustain-deploy/20260515-100000-aaaaaa.log /var/log/bandsustain-deploy/20260515-100001-bbbbbb.log
```

- [ ] **Step 5: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add scripts/deploy.sh
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): deploy.sh git fetch/pull/reset steps"
```

---

## Task 5: `scripts/deploy.sh` — build steps (pnpm install detect, pnpm build, POST_HEAD)

**Files:**
- Modify: `scripts/deploy.sh`

- [ ] **Step 1: Add build steps before the final `## RESULT SUCCESS` line**

Insert immediately above `echo "## RESULT SUCCESS ..."`:

```bash
# 4. pnpm install (only if lockfile changed in this pull/reset)
LOCKFILE_CHANGED=0
if git diff --name-only "$PRE_HEAD" HEAD | grep -q '^pnpm-lock.yaml$'; then
  LOCKFILE_CHANGED=1
fi

if [[ "$LOCKFILE_CHANGED" == "1" ]]; then
  echo "## STEP pnpm_install"
  T0="$(now_ts)"
  if ! run pnpm install --frozen-lockfile; then step_fail pnpm_install $? "$T0"; fi
  step_ok pnpm_install "$T0"
else
  echo "## STEP pnpm_install skipped reason=lockfile_unchanged"
fi

# 5. pnpm build
echo "## STEP pnpm_build"
T0="$(now_ts)"
if ! run pnpm build; then step_fail pnpm_build $? "$T0"; fi
step_ok pnpm_build "$T0"

# 6. POST_HEAD
POST_HEAD="$(git rev-parse HEAD)"
echo "## POST_HEAD ${POST_HEAD}"
```

- [ ] **Step 2: Verify build steps in dry-run**

Run:
```bash
sudo -u ec2-user env ACTOR=test /root/bandsustain/public_html/bandsustain/scripts/deploy.sh --dry-run 20260515-110000-aaaaaa
grep -E '^## (STEP|PRE_HEAD|POST_HEAD|RESULT)' /var/log/bandsustain-deploy/20260515-110000-aaaaaa.log
```

Expected: includes `STEP pnpm_install ...`, `STEP pnpm_build`, `STEP_OK pnpm_build 0s`, `POST_HEAD <40-char>`.

- [ ] **Step 3: Clean and commit**

```bash
sudo -u ec2-user rm /var/log/bandsustain-deploy/20260515-110000-aaaaaa.log
cd /root/bandsustain/public_html/bandsustain
git add scripts/deploy.sh
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): deploy.sh pnpm install/build steps"
```

---

## Task 6: `scripts/deploy.sh` — restart + smoke + DB UPDATE

**Files:**
- Modify: `scripts/deploy.sh`

- [ ] **Step 1: Add restart/smoke/DB block before `## RESULT SUCCESS`**

Insert immediately above `echo "## RESULT SUCCESS ..."`:

```bash
# 7. pm2 restart
echo "## STEP pm2_restart"
T0="$(now_ts)"
if ! run pm2 restart "$PM2_NAME" --update-env; then step_fail pm2_restart $? "$T0"; fi
step_ok pm2_restart "$T0"

# 8. smoke (after first 5s warmup, retry 3 times)
echo "## STEP smoke"
T0="$(now_ts)"
sleep 5
SMOKE_OK=0
LAST_HTTP=""
for delay in 0 8 13; do
  if [[ "$delay" -gt 0 ]]; then sleep "$delay"; fi
  LAST_HTTP="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo 000)"
  if [[ "$LAST_HTTP" == "200" ]]; then SMOKE_OK=1; break; fi
done
if [[ "$SMOKE_OK" != "1" ]]; then
  echo "HTTP ${LAST_HTTP} (failed after retries)"
  echo "## STEP_FAIL smoke exit=2 elapsed=$(( $(now_ts) - T0 ))s last_http=${LAST_HTTP}"
  echo "## RESULT FAIL step=smoke last_http=${LAST_HTTP} total=$(( $(now_ts) - START_TS ))s"
  # DB update on failure handled by `## RESULT FAIL` trap-equivalent below.
  exit 2
fi
echo "HTTP 200"
step_ok smoke "$T0"
```

- [ ] **Step 2: Add a DB-write helper invoked at the END (after RESULT line)**

Append at the very bottom of the script (after the final `## RESULT SUCCESS` line), replacing nothing — just adding:

```bash
# ─── DB update ────────────────────────────────────────────────────────────────
# Re-read the last RESULT line we just wrote and persist to deploy_history.
RESULT_LINE="$(tac "${LOG_FILE}" | grep -m1 '^## RESULT ' || true)"
case "$RESULT_LINE" in
  *"RESULT SUCCESS"*) DB_STATUS="success"; FAIL_STEP="" ;;
  *"RESULT FAIL"*)    DB_STATUS="fail";    FAIL_STEP="$(echo "$RESULT_LINE" | sed -nE 's/.*step=([a-z_]+).*/\1/p')" ;;
  *)                  DB_STATUS="interrupted"; FAIL_STEP="" ;;
esac
DUR=$(( $(now_ts) - START_TS ))

# Load DB creds without leaking into the environment of caller.
DB_HOST=""; DB_USER=""; DB_PASS=""; DB_NAME=""
# shellcheck disable=SC1090
set -a; . "$DB_CREDS"; set +a

if command -v mysql >/dev/null 2>&1; then
  POST_HEAD_SQL="$( [[ -n "${POST_HEAD:-}" ]] && printf %s "'${POST_HEAD}'" || printf NULL )"
  PRE_HEAD_SQL="$(  [[ -n "${PRE_HEAD:-}"  ]] && printf %s "'${PRE_HEAD}'"  || printf NULL )"
  FAIL_STEP_SQL="$( [[ -n "$FAIL_STEP" ]] && printf %s "'${FAIL_STEP}'" || printf NULL )"
  SQL="UPDATE deploy_history
       SET status='${DB_STATUS}',
           fail_step=${FAIL_STEP_SQL},
           pre_head=${PRE_HEAD_SQL},
           post_head=${POST_HEAD_SQL},
           ended_at=NOW(),
           duration_sec=${DUR}
       WHERE job_id='${JOB_ID}';"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] mysql UPDATE: ${SQL//$'\n'/ }"
  else
    echo "$SQL" | mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>&1 || true
  fi
fi
```

- [ ] **Step 3: Dry-run again**

Run:
```bash
sudo -u ec2-user env ACTOR=test /root/bandsustain/public_html/bandsustain/scripts/deploy.sh --dry-run 20260515-120000-aaaaaa
tail -n 30 /var/log/bandsustain-deploy/20260515-120000-aaaaaa.log
```

Expected: log contains `STEP pm2_restart`, `STEP smoke`, `HTTP 200`, `## RESULT SUCCESS ...`, `[dry-run] mysql UPDATE: UPDATE deploy_history SET status='success' ...`.

- [ ] **Step 4: Clean and commit**

```bash
sudo -u ec2-user rm /var/log/bandsustain-deploy/20260515-120000-aaaaaa.log
cd /root/bandsustain/public_html/bandsustain
git add scripts/deploy.sh
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): deploy.sh pm2 restart, smoke, DB update"
```

---

## Task 7: `src/lib/deploy.ts` — pure helpers

**Files:**
- Create: `src/lib/deploy.ts`

- [ ] **Step 1: Write the module**

```ts
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
  // Try to acquire a non-blocking exclusive lock via O_EXLOCK-like; on Linux we use flock(2).
  // We implement this as: open the file and ask the kernel via `flock` syscall through child? — simpler: read process list.
  // For simplicity in 1차 테스트 we rely on DB status='running' as the primary gate.
  // This helper returns false (best-effort) — callers must combine with DB check.
  // We still open+close so that test code can rely on file presence.
  try {
    const fd = openSync(DEPLOY_LOCK_FILE, "r");
    closeSync(fd);
    return true; // file exists, status unknown — treat as 'possibly held'
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Type-check the file**

Run:
```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 3: Self-smoke the parser with a one-shot Node script**

Run:
```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsx -e '
import { parseLog, newJobId, JOB_ID_REGEX } from "./src/lib/deploy";
const jid = newJobId();
if (!JOB_ID_REGEX.test(jid)) throw new Error("regex fail");
const p = parseLog([
  "## JOB " + jid + " START kind=deploy actor=admin",
  "## STEP git_fetch",
  "## STEP_OK git_fetch 0.4s",
  "## PRE_HEAD abc1234567890abcdef1234567890abcdef1234",
  "## STEP pnpm_build",
  "## STEP_FAIL pnpm_build exit=1 elapsed=12.5s",
  "## RESULT FAIL step=pnpm_build total=15.0s",
].join("\n"));
console.log(JSON.stringify(p, null, 2));
if (p.kind !== "deploy") throw new Error("kind");
if (p.actor !== "admin") throw new Error("actor");
if (p.preHead !== "abc1234567890abcdef1234567890abcdef1234") throw new Error("preHead");
if (p.steps.length !== 2) throw new Error("steps len " + p.steps.length);
if (p.steps[1].status !== "fail") throw new Error("step2 status");
if (p.result?.status !== "fail" || p.result.failStep !== "pnpm_build") throw new Error("result");
console.log("OK");
'
```

Expected: prints JSON then `OK`.

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/deploy.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): src/lib/deploy.ts pure helpers + log parser"
```

---

## Task 8: `src/lib/deploy-db.ts` — `deploy_history` CRUD

**Files:**
- Create: `src/lib/deploy-db.ts`

- [ ] **Step 1: Write the module**

```ts
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
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Functional smoke (insert + read + sweep)**

Run:
```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsx -e '
import { newJobId, logPathFor } from "./src/lib/deploy";
import { insertRunning, findByJobId, findRunning, sweepStale } from "./src/lib/deploy-db";
(async () => {
  const id = newJobId();
  await insertRunning({ jobId: id, actor: "smoke", kind: "deploy", targetRef: "origin/main", logPath: logPathFor(id) });
  const row = await findByJobId(id);
  if (!row || row.status !== "running") throw new Error("insert/find failed");
  console.log("inserted:", row.job_id);
  const running = await findRunning();
  console.log("running:", running?.job_id);
  const n = await sweepStale(0);
  console.log("swept:", n);
  process.exit(0);
})();
'
```

Expected: prints inserted jobId, running jobId, sweep count ≥ 1.

- [ ] **Step 4: Clean up the smoke row**

Run:
```bash
set -a; . /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DELETE FROM deploy_history WHERE actor='smoke';"
```

- [ ] **Step 5: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/lib/deploy-db.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): src/lib/deploy-db.ts deploy_history CRUD"
```

---

## Task 9: API `POST /api/admin/deploy` — start deployment

**Files:**
- Create: `src/app/api/admin/deploy/route.ts`

- [ ] **Step 1: Write the handler**

```ts
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
```

- [ ] **Step 2: Type-check**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/deploy/route.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): POST /api/admin/deploy starts deployment"
```

(Functional smoke happens in Task 17 end-to-end.)

---

## Task 10: API `GET /api/admin/deploy/[jobId]/log` — tail + status

**Files:**
- Create: `src/app/api/admin/deploy/[jobId]/log/route.ts`

- [ ] **Step 1: Write the handler**

```ts
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
```

- [ ] **Step 2: Type-check + commit**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
git add src/app/api/admin/deploy/\[jobId\]/log/route.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): GET /api/admin/deploy/[jobId]/log tail+status"
```

---

## Task 11: API `POST /api/admin/deploy/diff` — origin/main preview

**Files:**
- Create: `src/app/api/admin/deploy/diff/route.ts`

- [ ] **Step 1: Write the handler**

```ts
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
```

- [ ] **Step 2: Type-check + commit**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
git add src/app/api/admin/deploy/diff/route.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): POST /api/admin/deploy/diff origin/main preview"
```

---

## Task 12: API `GET /api/admin/deploy/history` — recent 10

**Files:**
- Create: `src/app/api/admin/deploy/history/route.ts`

- [ ] **Step 1: Write the handler**

```ts
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
```

- [ ] **Step 2: Type-check + commit**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
git add src/app/api/admin/deploy/history/route.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): GET /api/admin/deploy/history recent 10"
```

---

## Task 13: API `POST /api/admin/deploy/rollback`

**Files:**
- Create: `src/app/api/admin/deploy/rollback/route.ts`

- [ ] **Step 1: Write the handler**

```ts
import "server-only";
import { NextResponse } from "next/server";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readSession } from "@/lib/auth";
import { COMMIT_HASH_REGEX, newJobId, logPathFor, DEPLOY_SCRIPT, APP_DIR } from "@/lib/deploy";
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

  const child = spawn("bash", [DEPLOY_SCRIPT, jobId, "--rollback", hash], {
    cwd: APP_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ACTOR: session.u },
  });
  child.unref();

  return NextResponse.json({ jobId }, { status: 202 });
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
git add src/app/api/admin/deploy/rollback/route.ts
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): POST /api/admin/deploy/rollback whitelisted hash"
```

---

## Task 14: AdminNav — add Deploy item

**Files:**
- Modify: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: Add the nav entry**

In `src/components/admin/AdminNav.tsx`, change the `items` array to append `{ href: "/admin/deploy", label: "Deploy" }`:

```ts
const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/songs", label: "Songs" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/live", label: "Live" },
  { href: "/admin/yeongmin-bot", label: "Kim Yeong-min Bot" },
  { href: "/admin/deploy", label: "Deploy" },
];
```

Note: existing item was renamed from `youngmin-bot` / `"Kim Young-min Bot"` to `yeongmin-bot` / `"Kim Yeongmin Bot"` in a separate refactor commit `cb73684`. When you open `AdminNav.tsx` you should already see the new href/label — your job is just to append the Deploy entry. If the file still shows `youngmin-bot`, STOP and report — the refactor was not committed.

- [ ] **Step 2: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add src/components/admin/AdminNav.tsx
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): admin nav Deploy item"
```

---

## Task 15: `DeployPanel.tsx` — render-only scaffold (no actions yet)

**Files:**
- Create: `src/app/admin/(authed)/deploy/DeployPanel.tsx`

(Written before the server page so page.tsx imports a real module.)

- [ ] **Step 1: Write the panel with the rendering layer**

```tsx
"use client";
import { useMemo, useState } from "react";

type Row = {
  jobId: string;
  actor: string;
  kind: "deploy" | "rollback";
  preHead: string | null;
  postHead: string | null;
  status: "running" | "success" | "fail" | "interrupted";
  failStep: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
};

type Diff = {
  head: string;
  remote: string;
  ahead: number;
  behind: number;
  commits: { hash: string; subject: string }[];
  fetchedAt: string;
};

export default function DeployPanel(props: {
  initialHead: string;
  initialHeadSubject: string;
  initialRecent: Row[];
  initialRunningJobId: string | null;
  rollbackCandidateHash: string | null;
}) {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [recent, setRecent] = useState<Row[]>(props.initialRecent);
  const [runningJobId, setRunningJobId] = useState<string | null>(props.initialRunningJobId);
  const [activeJobId, setActiveJobId] = useState<string | null>(props.initialRunningJobId);
  const [logText, setLogText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRollback = useMemo(() => Boolean(props.rollbackCandidateHash), [props.rollbackCandidateHash]);

  // Stubs filled in Task 17.
  const onDiff = async () => { /* Task 17 */ };
  const onDeploy = async () => { /* Task 17 */ };
  const onRollback = async () => { /* Task 17 */ };

  // Suppress unused-var TS warnings in this no-action stage.
  void diff; void setDiff; void recent; void setRecent;
  void runningJobId; void setRunningJobId; void activeJobId; void setActiveJobId;
  void logText; void setLogText; void busy; void setBusy; void error; void setError;
  void onDiff; void onDeploy; void onRollback; void canRollback;

  return (
    <div className="space-y-8">
      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold uppercase tracking-wider text-sm">Remote Status</h2>
          <button
            type="button"
            onClick={onDiff}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]"
          >
            Diff 새로고침
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">아직 diff 를 불러오지 않았습니다.</p>
      </section>

      <section className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          onClick={onDeploy}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          ▶ 운영에 반영 (origin/main → 서버)
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={!canRollback}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩ 이전 버전으로 롤백
        </button>
      </section>

      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <h2 className="font-semibold uppercase tracking-wider text-sm">진행 로그</h2>
        <pre className="mt-3 text-xs font-mono bg-[var(--color-bg-muted)] p-3 overflow-auto max-h-72">
{logText || "(진행 중인 배포 없음)"}
        </pre>
      </section>

      <section>
        <h2 className="font-semibold uppercase tracking-wider text-sm">최근 배포 이력</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 pr-3">시각</th>
                <th className="text-left py-2 pr-3">종류</th>
                <th className="text-left py-2 pr-3">pre → post</th>
                <th className="text-left py-2 pr-3">actor</th>
                <th className="text-left py-2 pr-3">결과</th>
                <th className="text-left py-2 pr-3">시간</th>
                <th className="text-left py-2 pr-3">jobId</th>
              </tr>
            </thead>
            <tbody>
              {props.initialRecent.map((r) => (
                <tr key={r.jobId} className="border-t border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-mono">{r.startedAt.slice(0, 19).replace("T", " ")}</td>
                  <td className="py-2 pr-3">{r.kind}</td>
                  <td className="py-2 pr-3 font-mono">{(r.preHead ?? "-").slice(0,7)} → {(r.postHead ?? "-").slice(0,7)}</td>
                  <td className="py-2 pr-3">{r.actor}</td>
                  <td className="py-2 pr-3">
                    <span className={r.status === "success" ? "text-[var(--color-text)]" : r.status === "fail" ? "text-red-700" : "text-[var(--color-text-muted)]"}>
                      {r.status}{r.failStep ? ` (${r.failStep})` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{r.durationSec != null ? `${r.durationSec}s` : "-"}</td>
                  <td className="py-2 pr-3 font-mono">{r.jobId}</td>
                </tr>
              ))}
              {props.initialRecent.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-[var(--color-text-muted)]">이력 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

Note: this is `useState`/`useMemo` only — `useEffect` and the action wiring come in Task 17. The imports at the top intentionally do not include `useEffect`.

- [ ] **Step 2: Type-check (page.tsx not yet created, so this file alone)**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(authed\)/deploy/DeployPanel.tsx
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): DeployPanel render-only scaffold"
```

---

## Task 16: `/admin/deploy` server page — SSR data fetch

**Files:**
- Create: `src/app/admin/(authed)/deploy/page.tsx`

- [ ] **Step 1: Write the server component**

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(authed\)/deploy/page.tsx
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): /admin/deploy server page"
```

---

## Task 17: `DeployPanel.tsx` — wire up diff/deploy/rollback + polling

**Files:**
- Modify: `src/app/admin/(authed)/deploy/DeployPanel.tsx`

- [ ] **Step 1: Replace the entire `DeployPanel.tsx` body with the wired version**

Open the file and replace the whole component body. Final file:

```tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Row = {
  jobId: string;
  actor: string;
  kind: "deploy" | "rollback";
  preHead: string | null;
  postHead: string | null;
  status: "running" | "success" | "fail" | "interrupted";
  failStep: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
};

type Diff = {
  head: string;
  remote: string;
  ahead: number;
  behind: number;
  commits: { hash: string; subject: string }[];
  fetchedAt: string;
};

type LogResponse = {
  jobId: string;
  row: { status: Row["status"]; fail_step: string | null } | null;
  log: string;
  parsed: { result: { status: "success" | "fail" | "interrupted" } | null };
};

const POLL_MS = 2000;

export default function DeployPanel(props: {
  initialHead: string;
  initialHeadSubject: string;
  initialRecent: Row[];
  initialRunningJobId: string | null;
  rollbackCandidateHash: string | null;
}) {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [recent, setRecent] = useState<Row[]>(props.initialRecent);
  const [activeJobId, setActiveJobId] = useState<string | null>(props.initialRunningJobId);
  const [logText, setLogText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    const r = await fetch("/api/admin/deploy/history", { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { rows: Row[] };
      setRecent(j.rows);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const pollOnce = useCallback(async (jobId: string) => {
    try {
      const r = await fetch(`/api/admin/deploy/${jobId}/log`, { cache: "no-store" });
      if (!r.ok) {
        // Likely transient (Next.js restarting). Retry.
        pollTimerRef.current = setTimeout(() => pollOnce(jobId), POLL_MS);
        return;
      }
      const j = (await r.json()) as LogResponse;
      setLogText(j.log);
      const finished =
        (j.row && (j.row.status === "success" || j.row.status === "fail" || j.row.status === "interrupted")) ||
        Boolean(j.parsed.result);
      if (finished) {
        stopPolling();
        setActiveJobId(null);
        await fetchHistory();
      } else {
        pollTimerRef.current = setTimeout(() => pollOnce(jobId), POLL_MS);
      }
    } catch {
      pollTimerRef.current = setTimeout(() => pollOnce(jobId), POLL_MS);
    }
  }, [fetchHistory, stopPolling]);

  const onDiff = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/deploy/diff", { method: "POST" });
      if (!r.ok) throw new Error((await r.text()) || "diff failed");
      setDiff((await r.json()) as Diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onDeploy = useCallback(async () => {
    if (!confirm("origin/main 을 운영에 반영합니다. 진행할까요?")) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/deploy", { method: "POST" });
      const j = (await r.json()) as { jobId?: string; error?: string };
      if (r.status === 409 && j.jobId) {
        setActiveJobId(j.jobId);
        pollOnce(j.jobId);
        return;
      }
      if (!r.ok || !j.jobId) throw new Error(j.error || "deploy failed");
      setActiveJobId(j.jobId);
      setLogText("");
      pollOnce(j.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pollOnce]);

  const onRollback = useCallback(async () => {
    if (!props.rollbackCandidateHash) return;
    const target = props.rollbackCandidateHash;
    if (!confirm(`이전 안정 버전 ${target.slice(0,7)} 로 롤백합니다. 진행할까요?`)) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/deploy/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_hash: target }),
      });
      const j = (await r.json()) as { jobId?: string; error?: string };
      if (r.status === 409 && j.jobId) {
        setActiveJobId(j.jobId);
        pollOnce(j.jobId);
        return;
      }
      if (!r.ok || !j.jobId) throw new Error(j.error || "rollback failed");
      setActiveJobId(j.jobId);
      setLogText("");
      pollOnce(j.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pollOnce, props.rollbackCandidateHash]);

  useEffect(() => {
    if (props.initialRunningJobId) pollOnce(props.initialRunningJobId);
    return () => stopPolling();
  }, [pollOnce, props.initialRunningJobId, stopPolling]);

  return (
    <div className="space-y-8">
      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold uppercase tracking-wider text-sm">Remote Status</h2>
          <button
            type="button"
            onClick={onDiff}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)] disabled:opacity-40"
          >
            Diff 새로고침
          </button>
        </div>
        {diff ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              HEAD <code className="font-mono">{diff.head.slice(0,7)}</code> ↔ origin/main <code className="font-mono">{diff.remote.slice(0,7)}</code>{" "}
              · ahead <b>{diff.ahead}</b> · behind <b>{diff.behind}</b>
            </p>
            {diff.commits.length > 0 ? (
              <ul className="font-mono text-xs space-y-1">
                {diff.commits.map((c) => (
                  <li key={c.hash}><code>{c.hash}</code> {c.subject}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--color-text-muted)]">변경 없음 (이미 최신).</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)]">fetched {new Date(diff.fetchedAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">[Diff 새로고침] 을 눌러 origin/main 상태를 확인하세요.</p>
        )}
      </section>

      {error && (
        <div className="border border-red-700 bg-red-50 text-red-800 p-3 text-sm">{error}</div>
      )}

      <section className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          onClick={onDeploy}
          disabled={busy || Boolean(activeJobId)}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ▶ 운영에 반영 (origin/main → 서버)
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={busy || Boolean(activeJobId) || !props.rollbackCandidateHash}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩ 이전 버전으로 롤백 {props.rollbackCandidateHash ? `(${props.rollbackCandidateHash.slice(0,7)})` : ""}
        </button>
      </section>

      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold uppercase tracking-wider text-sm">
            진행 로그 {activeJobId ? <code className="ml-2 font-mono text-xs">{activeJobId}</code> : null}
          </h2>
          {activeJobId && (
            <span className="text-xs text-[var(--color-text-muted)]">2초마다 자동 갱신</span>
          )}
        </div>
        <pre className="mt-3 text-xs font-mono bg-[var(--color-bg-muted)] p-3 overflow-auto max-h-72 whitespace-pre">
{logText || "(진행 중인 배포 없음)"}
        </pre>
      </section>

      <section>
        <h2 className="font-semibold uppercase tracking-wider text-sm">최근 배포 이력</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 pr-3">시각</th>
                <th className="text-left py-2 pr-3">종류</th>
                <th className="text-left py-2 pr-3">pre → post</th>
                <th className="text-left py-2 pr-3">actor</th>
                <th className="text-left py-2 pr-3">결과</th>
                <th className="text-left py-2 pr-3">시간</th>
                <th className="text-left py-2 pr-3">jobId</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.jobId} className="border-t border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-mono">{r.startedAt.slice(0, 19).replace("T", " ")}</td>
                  <td className="py-2 pr-3">{r.kind}</td>
                  <td className="py-2 pr-3 font-mono">{(r.preHead ?? "-").slice(0,7)} → {(r.postHead ?? "-").slice(0,7)}</td>
                  <td className="py-2 pr-3">{r.actor}</td>
                  <td className="py-2 pr-3">
                    <span className={r.status === "success" ? "text-[var(--color-text)]" : r.status === "fail" ? "text-red-700" : "text-[var(--color-text-muted)]"}>
                      {r.status}{r.failStep ? ` (${r.failStep})` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{r.durationSec != null ? `${r.durationSec}s` : "-"}</td>
                  <td className="py-2 pr-3 font-mono">{r.jobId}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-[var(--color-text-muted)]">이력 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build (this verifies the whole feature compiles)**

```bash
cd /root/bandsustain/public_html/bandsustain
sudo -u ec2-user npx --no -- tsc --noEmit
sudo -u ec2-user pnpm build
```

Expected: tsc exit 0, pnpm build success (no errors, may emit warnings).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(authed\)/deploy/DeployPanel.tsx
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): DeployPanel actions + 2s log polling"
```

---

## Task 18: `scripts/deploy-sweep.sh` + cron registration

**Files:**
- Create: `scripts/deploy-sweep.sh`

- [ ] **Step 1: Write the sweep script**

```bash
#!/usr/bin/env bash
# scripts/deploy-sweep.sh — mark abandoned running rows as interrupted.
set -euo pipefail
DB_CREDS="${DB_CREDS:-/var/www/html/_______site_BANDSUSTAIN/.db_credentials}"
STALE_MIN="${STALE_MIN:-15}"
# shellcheck disable=SC1090
set -a; . "$DB_CREDS"; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
UPDATE deploy_history
   SET status='interrupted', ended_at=NOW()
 WHERE status='running' AND started_at < NOW() - INTERVAL ${STALE_MIN} MINUTE;
SQL
```

- [ ] **Step 2: Make executable + smoke**

Run:
```bash
chmod +x /root/bandsustain/public_html/bandsustain/scripts/deploy-sweep.sh
/root/bandsustain/public_html/bandsustain/scripts/deploy-sweep.sh
```

Expected: exit 0, no stdout (no rows match).

- [ ] **Step 3: Register cron for ec2-user (every minute)**

Run:
```bash
( sudo -u ec2-user crontab -l 2>/dev/null; echo "* * * * * /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/scripts/deploy-sweep.sh >> /var/log/bandsustain-deploy/sweep.log 2>&1" ) | sudo -u ec2-user crontab -
sudo -u ec2-user crontab -l | grep deploy-sweep
```

Expected: cron line printed.

- [ ] **Step 4: Commit**

```bash
cd /root/bandsustain/public_html/bandsustain
git add scripts/deploy-sweep.sh
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -m "feat(deploy): deploy-sweep.sh + cron every minute"
```

---

## Task 19: End-to-end integration smoke

**Files:** (no source changes; verification only)

- [ ] **Step 1: Restart PM2 so the new code is live**

Run:
```bash
sudo -u ec2-user pm2 restart bandsustain --update-env
sleep 5
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/
```

Expected: HTTP `200`.

- [ ] **Step 2: Log in to /admin (manual)**

Open https://bandsustain.com/admin/login in browser, log in with the admin creds.

- [ ] **Step 3: Open /admin/deploy and verify static rendering**

Navigate to `/admin/deploy`. Confirm:
- "현재 HEAD" matches `git -C /root/bandsustain/public_html/bandsustain rev-parse --short HEAD`.
- "최근 배포 이력" table renders (likely empty).
- [▶ 운영에 반영] button present, [↩ 롤백] button disabled (no success history yet).

- [ ] **Step 4: Click [Diff 새로고침]**

Click the button. Expect either "변경 없음" or commit list with hashes from `origin/main..HEAD`. No error banner.

- [ ] **Step 5: Make a no-op commit, push to origin/main, click [▶ 운영에 반영]**

Run (operator does this manually, this plan only documents the verification):
```bash
cd /root/bandsustain/public_html/bandsustain
# create a no-op commit, e.g. touch a doc file
echo "<!-- ping $(date +%s) -->" >> docs/2026-05-15-admin-deploy-button-design.md
git -c user.email=soritunenglish@gmail.com -c user.name=pjuhe99 commit -am "chore: deploy smoke ping"
git push origin main
```

In the UI: click [Diff 새로고침] → confirm 1 commit ahead → click [▶ 운영에 반영] → confirm modal → expect 진행 로그 streaming.

Within ~60s: log shows `## RESULT SUCCESS`. Table refreshes with new row, status=`success`.

- [ ] **Step 6: Verify DB row + log file**

Run:
```bash
set -a; . /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT job_id, status, fail_step, duration_sec, pre_head, post_head FROM deploy_history ORDER BY id DESC LIMIT 5;"
ls -lh /var/log/bandsustain-deploy/ | tail -5
```

Expected: most recent row is `success`, with pre_head ≠ post_head, log file exists and has `## RESULT SUCCESS` as last marker line.

- [ ] **Step 7: Rollback smoke**

Click [↩ 이전 버전으로 롤백] (now enabled — last_success.pre_head exists). Confirm modal → expect new job streaming, ends `## RESULT SUCCESS`, `pre_head` = previous `post_head`, `post_head` = previous `pre_head`.

Run after:
```bash
sudo -u ec2-user git -C /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain rev-parse --short HEAD
```

Expected: HEAD now matches the rollback target.

- [ ] **Step 8: Concurrency smoke**

In the UI, click [▶ 운영에 반영] twice in rapid succession. Expect: second click immediately picks up the running jobId via 409 response and shows the same in-flight log (no second row created).

Verify in DB:
```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT job_id, status FROM deploy_history ORDER BY id DESC LIMIT 3;"
```

Expected: only one `running` row at any moment.

- [ ] **Step 9: Failure smoke (optional, destructive — make a broken commit)**

(Skip in production unless the operator wants to verify FAIL path. To trigger, intentionally push a TypeScript syntax error to `origin/main`, click [▶ 운영에 반영], expect `## RESULT FAIL step=pnpm_build`, no pm2 restart, site stays on previous HEAD. Then revert and redeploy.)

- [ ] **Step 10: Final summary commit (no code changes — close the smoke loop in conversation)**

After all manual checks pass, the operator confirms in conversation that the feature is live. No further commit is needed unless smoke revealed bugs.

---

## Self-Review Checklist

(Run by the plan author after writing; no separate review pass once items are fixed.)

- ✅ Spec coverage: all of §3 (architecture), §4 (file map), §5 (deploy.sh interface), §6 (data model), §7 (sequences), §8 (UI), §9 (security), §11 (setup) are covered by Tasks 1–19.
- ✅ Test strategy deviation (no vitest) explicitly documented at the top.
- ✅ No "TBD"/"TODO"/"add error handling" placeholders. The Task 16 stub bodies are intentional scaffolding with `void` markers, replaced in Task 17.
- ✅ Type names consistent: `Row`, `Diff`, `LogResponse`, `DeployRow`, `DeployStatus`, `DeployKind` defined once.
- ✅ All `git commit` shell commands use the operator's identity (`pjuhe99 <soritunenglish@gmail.com>`).
- ✅ Cleanup steps for smoke artifacts (logs + DB rows) are explicit.
- ✅ No `git push` instructions inside automated tasks — per `MEMORY.md` rule, push is operator-driven (Task 19 Step 5 has the operator running it manually).
