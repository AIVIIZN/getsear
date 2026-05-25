#!/usr/bin/env bash
# Restore a Sear POS PostgreSQL backup into staging and verify core table counts.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/build-pipeline/logs/restores.jsonl"

STAGING_DATABASE_URL="${STAGING_DATABASE_URL:-}"
BACKUP_S3_URI="${BACKUP_S3_URI:-}"
SEAR_RESTORE_TARGET="${SEAR_RESTORE_TARGET:-}"

if [ "$SEAR_RESTORE_TARGET" != "staging" ]; then
  echo "SEAR_RESTORE_TARGET=staging is required; refusing restore" >&2
  exit 2
fi

if [ -z "$STAGING_DATABASE_URL" ]; then
  echo "STAGING_DATABASE_URL is required" >&2
  exit 2
fi

if [ -z "$BACKUP_S3_URI" ]; then
  echo "BACKUP_S3_URI is required, e.g. s3://bucket/sear-pos/postgres/20260525T020000Z/sear-pos-pg-20260525T020000Z.dump" >&2
  exit 2
fi

case "$BACKUP_S3_URI" in
  s3://*.dump) ;;
  *)
    echo "BACKUP_S3_URI must be an s3:// URI ending in .dump" >&2
    exit 2
    ;;
esac

for bin in aws pg_restore psql; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "$bin is required" >&2
    exit 2
  fi
done

checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

json_log() {
  local status="$1"
  local message="${2:-}"
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  printf '{"ts":"%s","scope":"restore","status":"%s","message":"%s"}\n' \
    "$ts" "$status" "$message" >> "$LOG_FILE"
}

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

DUMP_FILE="$WORK_DIR/$(basename "$BACKUP_S3_URI")"
BASE_URI="${BACKUP_S3_URI%/*}"
STEM="$(basename "$BACKUP_S3_URI" .dump)"
EXPECTED_SHA_FILE="$WORK_DIR/${STEM}.sha256"
EXPECTED_INTEGRITY_FILE="$WORK_DIR/${STEM}.integrity.tsv"
RESTORED_INTEGRITY_FILE="$WORK_DIR/restored.integrity.tsv"

json_log "started" "$BACKUP_S3_URI"

aws s3 cp "$BACKUP_S3_URI" "$DUMP_FILE"
aws s3 cp "${BASE_URI}/${STEM}.sha256" "$EXPECTED_SHA_FILE"
aws s3 cp "${BASE_URI}/${STEM}.integrity.tsv" "$EXPECTED_INTEGRITY_FILE"

EXPECTED_SHA="$(awk '{print $1}' "$EXPECTED_SHA_FILE")"
ACTUAL_SHA="$(checksum "$DUMP_FILE")"
if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
  json_log "failed" "checksum mismatch"
  echo "Checksum mismatch for $BACKUP_S3_URI" >&2
  exit 1
fi

pg_restore \
  --dbname "$STAGING_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "$DUMP_FILE"

psql "$STAGING_DATABASE_URL" \
  --no-align \
  --tuples-only \
  --field-separator $'\t' \
  --command "
    select 'orders', count(*) from public.orders
    union all select 'payments', count(*) from public.payments
    union all select 'audit_log', count(*) from public.audit_log
    order by 1;
  " > "$RESTORED_INTEGRITY_FILE"

if ! diff -u "$EXPECTED_INTEGRITY_FILE" "$RESTORED_INTEGRITY_FILE"; then
  json_log "failed" "integrity counts mismatch"
  echo "Restored staging integrity check failed" >&2
  exit 1
fi

json_log "ok" "$BACKUP_S3_URI"
echo "[restore] OK $BACKUP_S3_URI"
