#!/usr/bin/env python3
"""
Sear POS Migration Runner

Connects to Supabase PostgreSQL and runs all .sql migration files in order.
Tracks applied migrations in a _migrations table to prevent re-running.

Usage:
    python run_migrations.py                    # Run all pending migrations
    python run_migrations.py --dry-run          # Show what would be run
    python run_migrations.py --status           # Show migration status
    python run_migrations.py --file 005         # Run a specific migration

Requires:
    pip install psycopg2-binary python-dotenv
"""

import sys
import hashlib
import argparse
from pathlib import Path
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv
import os


MIGRATIONS_DIR = Path(__file__).parent
ENV_PATH = Path(__file__).parent.parent / ".env"


def get_connection_string() -> str:
    """Build PostgreSQL connection string from environment variables."""
    load_dotenv(ENV_PATH)

    db_host = os.environ.get("SUPABASE_DB_HOST", "db.lbekiyxqemxozmghgmtp.supabase.co")
    db_port = os.environ.get("SUPABASE_DB_PORT", "5432")
    db_name = os.environ.get("SUPABASE_DB_NAME", "postgres")
    db_user = os.environ.get("SUPABASE_DB_USER", "postgres")
    db_password = os.environ.get("SUPABASE_DB_PASSWORD")

    if not db_password:
        print("ERROR: SUPABASE_DB_PASSWORD not set in .env")
        sys.exit(1)

    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def ensure_migrations_table(conn) -> None:
    """Create the _migrations tracking table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                id serial PRIMARY KEY,
                filename text UNIQUE NOT NULL,
                checksum text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now(),
                duration_ms integer
            );
            COMMENT ON TABLE _migrations IS 'Tracks which SQL migration files have been applied';
        """)
    conn.commit()


def get_applied_migrations(conn) -> dict[str, str]:
    """Return dict of {filename: checksum} for already-applied migrations."""
    with conn.cursor() as cur:
        cur.execute("SELECT filename, checksum FROM _migrations ORDER BY filename")
        return {row[0]: row[1] for row in cur.fetchall()}


def get_migration_files() -> list[Path]:
    """Return sorted list of .sql migration files."""
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    return files


def file_checksum(path: Path) -> str:
    """SHA256 checksum of a file."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def run_migration(conn, filepath: Path) -> int:
    """Execute a single migration file. Returns duration in ms."""
    sql = filepath.read_text()
    start = datetime.now(timezone.utc)

    with conn.cursor() as cur:
        cur.execute(sql)

    elapsed_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
    conn.commit()
    return elapsed_ms


def record_migration(conn, filename: str, checksum: str, duration_ms: int) -> None:
    """Record a migration as applied."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO _migrations (filename, checksum, duration_ms) VALUES (%s, %s, %s)",
            (filename, checksum, duration_ms),
        )
    conn.commit()


def show_status(conn) -> None:
    """Display migration status."""
    applied = get_applied_migrations(conn)
    files = get_migration_files()

    print(f"\n{'Filename':<45} {'Status':<12} {'Checksum':<18} {'Applied At'}")
    print("-" * 100)

    for f in files:
        name = f.name
        checksum = file_checksum(f)

        if name in applied:
            if applied[name] == checksum:
                status = "APPLIED"
            else:
                status = "MODIFIED"
        else:
            status = "PENDING"

        # Get applied_at if exists
        applied_at = ""
        if name in applied:
            with conn.cursor() as cur:
                cur.execute("SELECT applied_at FROM _migrations WHERE filename = %s", (name,))
                row = cur.fetchone()
                if row:
                    applied_at = row[0].strftime("%Y-%m-%d %H:%M:%S")

        print(f"  {name:<43} {status:<12} {checksum:<18} {applied_at}")

    pending = [f for f in files if f.name not in applied]
    print(f"\n  {len(applied)} applied, {len(pending)} pending, {len(files)} total\n")


def main():
    parser = argparse.ArgumentParser(description="Sear POS Migration Runner")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be run without executing")
    parser.add_argument("--status", action="store_true", help="Show migration status")
    parser.add_argument("--file", type=str, help="Run a specific migration file (prefix match, e.g. '005')")
    args = parser.parse_args()

    conn_string = get_connection_string()

    try:
        conn = psycopg2.connect(conn_string)
        conn.autocommit = False
    except psycopg2.Error as e:
        print(f"ERROR: Could not connect to database: {e}")
        sys.exit(1)

    try:
        ensure_migrations_table(conn)

        if args.status:
            show_status(conn)
            return

        applied = get_applied_migrations(conn)
        files = get_migration_files()

        # Filter to specific file if requested
        if args.file:
            files = [f for f in files if f.name.startswith(args.file)]
            if not files:
                print(f"ERROR: No migration file matching '{args.file}'")
                sys.exit(1)

        pending = [f for f in files if f.name not in applied]

        if not pending:
            print("All migrations are up to date.")
            return

        print(f"\n{len(pending)} pending migration(s):\n")

        for filepath in pending:
            checksum = file_checksum(filepath)
            name = filepath.name

            # Check if file was modified after being applied
            if name in applied and applied[name] != checksum:
                print(f"  WARNING: {name} has been modified since it was applied!")
                print(f"    Applied checksum: {applied[name]}")
                print(f"    Current checksum: {checksum}")
                continue

            if args.dry_run:
                print(f"  [DRY RUN] Would apply: {name}")
                continue

            print(f"  Applying {name}...", end=" ", flush=True)
            try:
                duration_ms = run_migration(conn, filepath)
                record_migration(conn, name, checksum, duration_ms)
                print(f"OK ({duration_ms}ms)")
            except psycopg2.Error as e:
                conn.rollback()
                print(f"FAILED!")
                print(f"    Error: {e}")
                print(f"\n  Migration aborted. Fix the error and re-run.")
                sys.exit(1)

        if not args.dry_run:
            print(f"\nAll migrations applied successfully.\n")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
