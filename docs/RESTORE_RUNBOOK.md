# Sear POS Restore Runbook

## Drill Schedule

The `restore-drill` GitHub Actions workflow runs quarterly at `18:00 UTC` on January 1, April 1, July 1, and October 1. It can also be started manually with a specific backup `.dump` S3 URI.

## Required Configuration

- `SUPABASE_STAGING_DB_URL`
- `BACKUP_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- Optional repository variables: `BACKUP_S3_PREFIX`, `AWS_DEFAULT_REGION`

## Restore Procedure

The workflow resolves the requested backup, or the latest backup when no URI is supplied, then runs:

```bash
SEAR_RESTORE_TARGET=staging \
STAGING_DATABASE_URL='postgres://...' \
BACKUP_S3_URI='s3://bucket/sear-pos/postgres/<timestamp>/sear-pos-pg-<timestamp>.dump' \
bash scripts/restore-staging.sh
```

The script refuses to run unless `SEAR_RESTORE_TARGET=staging`, verifies the backup checksum, restores with `pg_restore --clean --if-exists`, and compares restored row counts for `orders`, `payments`, and `audit_log` against the backup integrity file.

## Pass Criteria

- The checksum sidecar matches the downloaded dump.
- `pg_restore` exits zero.
- Restored staging row counts match the backup integrity sidecar for `orders`, `payments`, and `audit_log`.
- `build-pipeline/logs/restores.jsonl` contains an `ok` event.
