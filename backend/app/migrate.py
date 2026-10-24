"""Versioned SQL migration runner with production safety guards.

Usage:
  python -m app.migrate inspect
  python -m app.migrate status [--profile local|production]
  python -m app.migrate up [--profile local|production]
  python -m app.migrate down [--profile local|production] [--allow-drop-ingest]
  python -m app.migrate verify

Production profile NEVER applies migrations/local/ and refuses DROP TABLE.

Read-only commands (inspect, status, verify) never CREATE/ALTER/INSERT/UPDATE/DELETE
and never call _ensure_table(). Only `up` initializes schema_migrations.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from psycopg import connect
from psycopg.rows import dict_row

from app.config import get_settings

ROOT = Path(__file__).resolve().parent.parent
PROD_MIGRATIONS_DIR = ROOT / "migrations"
LOCAL_MIGRATIONS_DIR = ROOT / "migrations" / "local"

DROP_RE = re.compile(r"\bDROP\s+(TABLE|SCHEMA|DATABASE|INDEX)\b", re.IGNORECASE)
TRUNCATE_RE = re.compile(r"\bTRUNCATE\b", re.IGNORECASE)
ALTER_DROP_COLUMN_RE = re.compile(r"\bALTER\s+TABLE\b.*\bDROP\s+COLUMN\b", re.IGNORECASE | re.DOTALL)
CREATE_EXTENSION_RE = re.compile(r"\bCREATE\s+EXTENSION\b", re.IGNORECASE)
REQUIRED_EXTENSIONS = ("citext", "pgcrypto")
READ_ONLY_COMMANDS = frozenset({"inspect", "status", "verify"})
# Reject write statements if a read-only path ever mis-routes SQL (defense in depth).
WRITE_SQL_RE = re.compile(
    r"\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|TRUNCATE|GRANT|REVOKE|COPY)\b",
    re.IGNORECASE,
)
# Block mutating existing ingest tables/data (app migrations are additive only).
INGEST_MUTATION_RE = re.compile(
    r"\b(ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(public\.)?(mailboxes|messages)\b|"
    r"UPDATE\s+(ONLY\s+)?(public\.)?(mailboxes|messages)\b|"
    r"DELETE\s+FROM\s+(ONLY\s+)?(public\.)?(mailboxes|messages)\b|"
    r"TRUNCATE\s+(TABLE\s+)?(ONLY\s+)?(public\.)?(mailboxes|messages)\b|"
    r"DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(public\.)?(mailboxes|messages)\b)",
    re.IGNORECASE,
)


@dataclass
class SchemaInfo:
    mailboxes_exists: bool
    messages_exists: bool
    mailbox_pk: str | None
    message_pk: str | None
    delivery_id_unique: bool
    mailbox_columns: set[str]
    message_columns: set[str]


def _pg_type_to_sql(udt_name: str, data_type: str) -> str:
    if udt_name == "uuid":
        return "UUID"
    if udt_name == "int8" or data_type == "bigint":
        return "BIGINT"
    if udt_name == "int4" or data_type == "integer":
        return "INTEGER"
    if udt_name == "int2":
        return "SMALLINT"
    if data_type == "text":
        return "TEXT"
    raise RuntimeError(
        f"Unsupported primary key type for FK mapping: data_type={data_type!r} udt_name={udt_name!r}. "
        "Update migrate.py before applying."
    )


def inspect_schema(conn) -> SchemaInfo:
    tables = {
        r["table_name"]
        for r in conn.execute(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """
        ).fetchall()
    }
    mailboxes_exists = "mailboxes" in tables
    messages_exists = "messages" in tables

    def pk_type(table: str) -> str | None:
        if table not in tables:
            return None
        row = conn.execute(
            """
            SELECT data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name = 'id'
            """,
            (table,),
        ).fetchone()
        if not row:
            return None
        return _pg_type_to_sql(row["udt_name"], row["data_type"])

    def cols(table: str) -> set[str]:
        if table not in tables:
            return set()
        rows = conn.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table,),
        ).fetchall()
        return {r["column_name"] for r in rows}

    delivery_id_unique = False
    if messages_exists:
        row = conn.execute(
            """
            SELECT 1 AS ok
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'messages'
              AND (
                indexdef ILIKE '%UNIQUE%delivery_id%'
                OR indexdef ILIKE '%delivery_id%UNIQUE%'
                OR (
                  indexname ILIKE '%delivery_id%'
                  AND indexdef ILIKE '%UNIQUE%'
                )
              )
            LIMIT 1
            """
        ).fetchone()
        # Also accept unique constraint
        if not row:
            row = conn.execute(
                """
                SELECT 1 AS ok
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
                WHERE tc.table_schema = 'public'
                  AND tc.table_name = 'messages'
                  AND tc.constraint_type = 'UNIQUE'
                  AND ccu.column_name = 'delivery_id'
                LIMIT 1
                """
            ).fetchone()
        delivery_id_unique = bool(row)

    return SchemaInfo(
        mailboxes_exists=mailboxes_exists,
        messages_exists=messages_exists,
        mailbox_pk=pk_type("mailboxes"),
        message_pk=pk_type("messages"),
        delivery_id_unique=delivery_id_unique,
        mailbox_columns=cols("mailboxes"),
        message_columns=cols("messages"),
    )


REQUIRED_MAILBOX_COLS = {"id", "address", "is_active", "created_at"}
REQUIRED_MESSAGE_COLS = {
    "id",
    "mailbox_id",
    "sender",
    "subject",
    "body_text",
    "body_html",
    "raw_message",
    "message_id",
    "recipient",
    "received_at",
    "delivery_id",
}


def _extensions_installed(conn) -> set[str]:
    rows = conn.execute("SELECT extname FROM pg_extension").fetchall()
    return {r["extname"] if isinstance(r, dict) else r[0] for r in rows}


def preflight(conn, *, profile: str) -> SchemaInfo:
    info = inspect_schema(conn)
    errors: list[str] = []
    installed_ext = _extensions_installed(conn)

    if profile == "production":
        missing_ext = [e for e in REQUIRED_EXTENSIONS if e not in installed_ext]
        if missing_ext:
            errors.append(
                f"Missing PostgreSQL extensions: {missing_ext}. "
                "Apply migrations/dba/0000_extensions.up.sql once as a superuser "
                "before migrate up --profile production."
            )
        if not info.mailboxes_exists or not info.messages_exists:
            errors.append(
                "Production profile requires existing mailboxes and messages tables. "
                "Refusing to create ingest tables on production."
            )
        if info.mailboxes_exists:
            missing = REQUIRED_MAILBOX_COLS - info.mailbox_columns
            if missing:
                errors.append(f"mailboxes missing columns: {sorted(missing)}")
        if info.messages_exists:
            missing = REQUIRED_MESSAGE_COLS - info.message_columns
            if missing:
                errors.append(f"messages missing columns: {sorted(missing)}")
        if info.messages_exists and not info.delivery_id_unique:
            errors.append(
                "messages.delivery_id must have a UNIQUE index/constraint before app migrations. "
                "Do not alter or drop it; fix uniqueness first if missing."
            )
        if not info.mailbox_pk or not info.message_pk:
            errors.append("Could not resolve mailboxes.id / messages.id types for FK mapping.")
    else:
        # local: ingest tables / extensions may be missing; local 0000 will create them
        pass

    if errors:
        print("PREFLIGHT FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        raise SystemExit(2)

    print(
        f"PREFLIGHT OK profile={profile} "
        f"mailboxes.id={info.mailbox_pk} messages.id={info.message_pk} "
        f"delivery_id_unique={info.delivery_id_unique} "
        f"extensions={sorted(installed_ext & set(REQUIRED_EXTENSIONS))}"
    )
    return info


def _versions(profile: str) -> list[tuple[str, Path]]:
    items: list[tuple[str, Path]] = []
    if profile == "local":
        for p in sorted(LOCAL_MIGRATIONS_DIR.glob("*.up.sql")):
            items.append((p.name.replace(".up.sql", ""), p))
    for p in sorted(PROD_MIGRATIONS_DIR.glob("*.up.sql")):
        # Skip nested / local folder (glob on migrations/ only returns top-level)
        items.append((p.name.replace(".up.sql", ""), p))
    return items


def _schema_migrations_exists(conn) -> bool:
    row = conn.execute(
        """
        SELECT 1 AS ok
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
        LIMIT 1
        """
    ).fetchone()
    return bool(row)


def _ensure_table(conn) -> None:
    """Create/upgrade schema_migrations. Call only from `up` (never from read-only cmds)."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            profile TEXT
        )
        """
    )
    # Additive: older installs may lack profile column
    conn.execute(
        """
        ALTER TABLE schema_migrations
        ADD COLUMN IF NOT EXISTS profile TEXT
        """
    )
    conn.commit()


def _applied(conn) -> set[str]:
    """Return applied versions. Missing tracking table => empty set (all pending)."""
    if not _schema_migrations_exists(conn):
        return set()
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
    return {r["version"] if isinstance(r, dict) else r[0] for r in rows}


def _strip_sql_comments(sql: str) -> str:
    """Remove full-line `--` comments so safety regexes ignore documentation text."""
    lines = []
    for line in sql.splitlines():
        if line.strip().startswith("--"):
            continue
        lines.append(line)
    return "\n".join(lines)


def _assert_safe_sql(sql: str, *, profile: str, allow_drop_ingest: bool) -> None:
    body = _strip_sql_comments(sql)
    if profile == "production":
        if DROP_RE.search(body) or TRUNCATE_RE.search(body) or ALTER_DROP_COLUMN_RE.search(body):
            raise RuntimeError(
                "Refusing to run destructive SQL under production profile "
                "(DROP/TRUNCATE/ALTER DROP COLUMN)."
            )
        if CREATE_EXTENSION_RE.search(body):
            raise RuntimeError(
                "Refusing CREATE EXTENSION under production profile. "
                "Apply migrations/dba/0000_extensions.up.sql as a superuser first."
            )
        if INGEST_MUTATION_RE.search(body):
            raise RuntimeError(
                "Refusing SQL that mutates mailboxes/messages "
                "(including raw_message / delivery_id). App migrations must be additive only."
            )
        if "migrations/local" in body:
            raise RuntimeError("Refusing local migration content in production.")
    else:
        if DROP_RE.search(body) and not allow_drop_ingest:
            # Local down of ingest tables needs explicit flag
            if re.search(r"\bDROP\s+TABLE\b.*\b(mailboxes|messages)\b", body, re.I | re.S):
                raise RuntimeError(
                    "Refusing DROP of mailboxes/messages without --allow-drop-ingest"
                )


def _render(sql: str, info: SchemaInfo) -> str:
    mailbox_pk = info.mailbox_pk or "BIGINT"
    message_pk = info.message_pk or "BIGINT"
    return (
        sql.replace("{{MAILBOX_PK}}", mailbox_pk).replace("{{MESSAGE_PK}}", message_pk)
    )


def _run_script(conn, sql: str) -> None:
    cleaned = _strip_sql_comments(sql)
    for stmt in cleaned.split(";"):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)


def cmd_inspect(conn) -> None:
    info = inspect_schema(conn)
    print("=== Schema inspection (read-only) ===")
    print(f"mailboxes exists: {info.mailboxes_exists}")
    print(f"messages exists:  {info.messages_exists}")
    print(f"mailboxes.id:     {info.mailbox_pk}")
    print(f"messages.id:      {info.message_pk}")
    print(f"delivery_id UNIQUE: {info.delivery_id_unique}")
    print(f"mailboxes columns: {sorted(info.mailbox_columns)}")
    print(f"messages columns:  {sorted(info.message_columns)}")
    for table in (
        "users",
        "sessions",
        "mailbox_owners",
        "message_states",
        "invitations",
        "audit_logs",
        "schema_migrations",
    ):
        exists = conn.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name=%s
            """,
            (table,),
        ).fetchone()
        print(f"{table}: {'present' if exists else 'missing'}")


def cmd_status(conn, profile: str) -> None:
    exists = _schema_migrations_exists(conn)
    applied = _applied(conn)
    if not exists:
        print("schema_migrations: missing (treating all versions as pending)")
    for version, path in _versions(profile):
        mark = "applied" if version in applied else "pending"
        print(f"{version}: {mark}  ({path.relative_to(ROOT)})")


def cmd_up(conn, profile: str) -> None:
    info = preflight(conn, profile=profile)
    # Only `up` may create/alter the tracking table.
    _ensure_table(conn)
    applied = _applied(conn)
    for version, path in _versions(profile):
        if version in applied:
            continue
        if profile == "production" and "local" in path.parts:
            raise RuntimeError(f"Refusing to apply local migration in production: {path}")
        sql = path.read_text(encoding="utf-8")
        # Local baseline may create mailboxes; re-inspect after it if needed
        if "{{MAILBOX_PK}}" in sql or "{{MESSAGE_PK}}" in sql:
            if not info.mailbox_pk or not info.message_pk:
                info = inspect_schema(conn)
            if not info.mailbox_pk or not info.message_pk:
                raise RuntimeError(
                    f"Cannot apply {version}: mailboxes/messages id types unknown. "
                    "Run inspect and ensure ingest tables exist."
                )
            sql = _render(sql, info)
        _assert_safe_sql(sql, profile=profile, allow_drop_ingest=False)
        print(f"Applying {version} ...")
        try:
            _run_script(conn, sql)
            conn.execute(
                """
                INSERT INTO schema_migrations (version, profile)
                VALUES (%s, %s)
                """,
                (version, profile),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        print(f"Applied {version}")
        info = inspect_schema(conn)
    verify_invariants(conn)


def cmd_down(conn, profile: str, *, allow_drop_ingest: bool) -> None:
    if profile == "production":
        print(
            "Production down is disabled by default. "
            "Use deploy/PRODUCTION_MIGRATIONS.md rollback steps instead.",
            file=sys.stderr,
        )
        raise SystemExit(3)

    applied = sorted(_applied(conn), reverse=True)
    # Only roll back versions that belong to this profile set
    known = {v for v, _ in _versions(profile)}
    applied = [v for v in applied if v in known]
    if not applied:
        print("Nothing to roll back")
        return
    version = applied[0]
    path = None
    for v, p in _versions(profile):
        if v == version:
            down = p.with_name(p.name.replace(".up.sql", ".down.sql"))
            path = down
            break
    if path is None or not path.exists():
        print(f"No down migration for {version}")
        return
    sql = path.read_text(encoding="utf-8")
    _assert_safe_sql(sql, profile=profile, allow_drop_ingest=allow_drop_ingest)
    print(f"Rolling back {version} ...")
    try:
        _run_script(conn, sql)
        conn.execute("DELETE FROM schema_migrations WHERE version = %s", (version,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    print(f"Rolled back {version}")


def verify_invariants(conn) -> None:
    """Read-only checks: never mutate schema or data."""
    info = inspect_schema(conn)
    if info.messages_exists and not info.delivery_id_unique:
        print("WARNING: delivery_id uniqueness not detected", file=sys.stderr)
    else:
        print(
            "OK: delivery_id uniqueness preserved/detected"
            if info.messages_exists
            else "OK: no messages table yet (local)"
        )
    if info.mailboxes_exists and info.messages_exists:
        print("OK: mailboxes and messages still present")


def resolve_profile(cli_profile: str | None) -> str:
    settings = get_settings()
    if cli_profile:
        return cli_profile
    if settings.is_production:
        return "production"
    return "local"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="YoyKnowMail migrations (safe by default)")
    parser.add_argument(
        "command",
        choices=["inspect", "status", "up", "down", "verify"],
    )
    parser.add_argument(
        "--profile",
        choices=["local", "production"],
        default=None,
        help="local includes migrations/local/; production is additive-only on existing ingest tables",
    )
    parser.add_argument(
        "--allow-drop-ingest",
        action="store_true",
        help="Required to run local down scripts that DROP mailboxes/messages",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Override DATABASE_URL for this run (does not use example credentials implicitly)",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    database_url = args.database_url or settings.database_url
    if "CHANGE_ME" in database_url:
        print(
            "DATABASE_URL still contains CHANGE_ME placeholder. "
            "Set a real connection string in backend/.env or pass --database-url.",
            file=sys.stderr,
        )
        return 1

    profile = resolve_profile(args.profile)
    if settings.is_production and profile != "production":
        print("APP_ENV=production requires --profile production", file=sys.stderr)
        return 1

    print(f"Using profile={profile} (APP_ENV={settings.app_env})")
    # Never print password
    safe_url = re.sub(r":([^:@/]+)@", ":***@", database_url)
    print(f"DATABASE_URL={safe_url}")

    connect_kwargs: dict = {"row_factory": dict_row}
    if args.command in READ_ONLY_COMMANDS:
        # Enforce at the session level so accidental writes fail hard.
        connect_kwargs["options"] = "-c default_transaction_read_only=on"

    with connect(database_url, **connect_kwargs) as conn:
        if args.command == "inspect":
            cmd_inspect(conn)
        elif args.command == "status":
            cmd_status(conn, profile)
        elif args.command == "up":
            cmd_up(conn, profile)
        elif args.command == "down":
            cmd_down(conn, profile, allow_drop_ingest=args.allow_drop_ingest)
        elif args.command == "verify":
            verify_invariants(conn)
            cmd_inspect(conn)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
