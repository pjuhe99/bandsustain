#!/usr/bin/env bash
# scripts/deploy-sweep.sh — mark abandoned running rows as interrupted.
set -euo pipefail
DB_CREDS="${DB_CREDS:-/var/www/html/_______site_BANDSUSTAIN/.db_credentials}"
STALE_MIN="${STALE_MIN:-15}"
# shellcheck disable=SC1090
set -a; set +u; . "$DB_CREDS"; set -u; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
UPDATE deploy_history
   SET status='interrupted', ended_at=NOW()
 WHERE status='running' AND started_at < NOW() - INTERVAL ${STALE_MIN} MINUTE;
SQL
