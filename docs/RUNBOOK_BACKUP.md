# Sear POS Backup Runbook

## Schedule

The `backup` GitHub Actions workflow runs daily at `09:30 UTC` and can also be started manually. It runs `scripts/backup.sh`, which writes a custom-format PostgreSQL dump plus SHA-256 and integrity-count sidecars to S3.

## Required Configuration

- `SUPABASE_PRODUCTION_DB_URL`
- `BACKUP_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- Optional repository variables: `BACKUP_S3_PREFIX`, `AWS_DEFAULT_REGION`

Backups are written under `s3://$BACKUP_S3_BUCKET/${BACKUP_S3_PREFIX:-sear-pos/postgres}/<timestamp>/`.

## Retention

`scripts/backup.sh` deletes objects older than `BACKUP_RETENTION_DAYS`, defaulting to `30`. The S3 bucket should also have a lifecycle rule expiring the same prefix after 30 days so retention still holds if a workflow run is skipped.

## Manual Backup

```bash
DATABASE_URL='postgres://...' \
BACKUP_S3_BUCKET='sear-pos-backups' \
AWS_ACCESS_KEY_ID='...' \
AWS_SECRET_ACCESS_KEY='...' \
bash scripts/backup.sh
```

Success writes a `build-pipeline/logs/backups.jsonl` record and prints the S3 prefix for the backup set.
