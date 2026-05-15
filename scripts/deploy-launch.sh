#!/usr/bin/env bash
# scripts/deploy-launch.sh — orphan-launches deploy.sh so PM2's children-kill
# on bandsustain restart cannot reach it.
#
# Why: deploy.sh calls `pm2 restart bandsustain` mid-flight. PM2 kills the
# process AND its descendant tree. With Node's `spawn({ detached: true })`
# alone, deploy.sh's ppid is still bandsustain → PM2 finds and SIGKILLs it,
# producing a spurious `## RESULT INTERRUPTED`. This launcher uses a
# subshell + setsid + background so deploy.sh is reparented to init (PID 1)
# within milliseconds; by the time pm2_restart fires, the ppid chain no
# longer leads to bandsustain.
#
# Usage: deploy-launch.sh <jobId> [--rollback <hash>]
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain}"
DEPLOY_SCRIPT="${APP_DIR}/scripts/deploy.sh"

# Subshell + setsid + & + immediate exit:
#   1. Subshell () forks; child sets up setsid for deploy.sh and backgrounds it
#   2. Subshell exits the moment the inner & returns
#   3. deploy.sh's ppid (subshell pid) becomes init=1 within milliseconds
( setsid "$DEPLOY_SCRIPT" "$@" </dev/null >/dev/null 2>&1 & )
exit 0
