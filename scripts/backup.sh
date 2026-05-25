#!/usr/bin/env bash
# Daily PostgreSQL backup for Sear POS.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/build-pipeline/logs/backups.jsonl"

DATABASE_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-sear-pos/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_TIMESTAMP="${BACKUP_TIMESTAMP:-$(date -u +"%Y%m%dT%H%M%SZ")}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL or SUPABASE_DB_URL is required" >&2
  exit 2
fi

if [ -z "$BACKUP_S3_BUCKET" ]; then
  echo "BACKUP_S3_BUCKET is required" >&2
  exit 2
fi

for bin in aws pg_dump psql; do
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
  printf '{"ts":"%s","scope":"backup","status":"%s","message":"%s"}\n' \
    "$ts" "$status" "$message" >> "$LOG_FILE"
}

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

DUMP_FILE="$WORK_DIR/sear-pos-pg-${BACKUP_TIMESTAMP}.dump"
INTEGRITY_FILE="$WORK_DIR/sear-pos-pg-${BACKUP_TIMESTAMP}.integrity.tsv"
SHA_FILE="$WORK_DIR/sear-pos-pg-${BACKUP_TIMESTAMP}.sha256"
S3_BASE="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${BACKUP_TIMESTAMP}"

json_log "started" "$S3_BASE"

pg_dump \
  --dbname "$DATABASE_URL" \
  --format custom \
  --no-owner \
  --no-acl \
  --file "$DUMP_FILE"

psql "$DATABASE_URL" \
  --no-align \
  --tuples-only \
  --field-separator $'\t' \
  --command "
    select 'orders', count(*) from public.orders
    union all select 'payments', count(*) from public.payments
    union all select 'audit_log', count(*) from public.audit_log
    order by 1;
  " > "$INTEGRITY_FILE"

checksum "$DUMP_FILE" > "$SHA_FILE"

aws s3 cp "$DUMP_FILE" "${S3_BASE}/$(basename "$DUMP_FILE")"
aws s3 cp "$SHA_FILE" "${S3_BASE}/$(basename "$SHA_FILE")"
aws s3 cp "$INTEGRITY_FILE" "${S3_BASE}/$(basename "$INTEGRITY_FILE")"

if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
  CUTOFF=$(date -u -d "${BACKUP_RETENTION_DAYS} days ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || true)
  if [ -n "$CUTOFF" ]; then
    aws s3api list-objects-v2 \
      --bucket "$BACKUP_S3_BUCKET" \
      --prefix "$BACKUP_S3_PREFIX/" \
      --query "Contents[?LastModified<='${CUTOFF}'].Key" \
      --output text |
      tr '\t' '\n' |
      while read -r key; do
        [ -z "$key" ] && continue
        aws s3api delete-object --bucket "$BACKUP_S3_BUCKET" --key "$key" >/dev/null
      done
  fi
fi

json_log "ok" "$S3_BASE"
echo "[backup] OK ${S3_BASE}"
