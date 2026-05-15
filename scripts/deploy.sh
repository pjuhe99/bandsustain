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

echo "## RESULT SUCCESS total=$(( $(now_ts) - START_TS ))s"

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
