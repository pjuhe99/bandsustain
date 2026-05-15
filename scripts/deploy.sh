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
#   ACTOR          (optional, set by caller; written to ## JOB START line)
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

# Bootstrap log directory before redirecting output.
mkdir -p "${DEPLOY_LOG_DIR}" || { echo "deploy.sh: cannot create log dir: ${DEPLOY_LOG_DIR}" >&2; exit 1; }

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

# Trap: ensure every log ends with a ## RESULT line so the parser sees a terminal state
# even on abnormal exit (kill, OOM, pm2 restart killing this child mid-flight).
trap 'rc=$?; if ! grep -q "^## RESULT " "${LOG_FILE}"; then echo "## RESULT INTERRUPTED total=$(( $(now_ts) - START_TS ))s"; fi; exit "$rc"' EXIT

# Acquire lock (non-blocking). If lost, do not write any RESULT — caller will sweep us.
exec {LOCKFD}>"${LOCK_FILE}"
if ! flock -n "$LOCKFD"; then
  echo "## JOB ${JOB_ID} ABORT reason=lock_held"
  echo "## RESULT FAIL step=lock_acquire"
  exit 3
fi

echo "## JOB ${JOB_ID} START kind=${KIND} actor=${ACTOR:-unknown}"

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
