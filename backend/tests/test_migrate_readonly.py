"""Ensure inspect/status/verify never mutate the database."""

from __future__ import annotations

import os
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from psycopg import connect
from psycopg.rows import dict_row

from app.migrate import (
    WRITE_SQL_RE,
    _applied,
    _schema_migrations_exists,
    cmd_inspect,
    cmd_status,
    cmd_up,
    main,
    verify_invariants,
)
from tests.conftest import requires_db


class _Result:
    def __init__(self, rows: list[Any] | None = None):
        self._rows = rows or []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class RecordingConn:
    """Minimal connection stub that records SQL and serves information_schema answers."""

    def __init__(self, *, tracking_exists: bool = False, applied: set[str] | None = None):
        self.statements: list[str] = []
        self.tracking_exists = tracking_exists
        self.applied = applied or set()
        self.committed = False
        self.rolled_back = False

    def execute(self, sql: str, params=None):
        self.statements.append(" ".join(sql.split()))
        normalized = sql.lower()
        if "information_schema.tables" in normalized and "schema_migrations" in normalized:
            return _Result([{"ok": 1}] if self.tracking_exists else [])
        if "information_schema.tables" in normalized and "table_name" in normalized:
            # Generic table listing / existence checks used by inspect
            return _Result([])
        if "from schema_migrations" in normalized and "select version" in normalized:
            return _Result([{"version": v} for v in sorted(self.applied)])
        if "information_schema.columns" in normalized:
            return _Result([])
        if "pg_indexes" in normalized or "table_constraints" in normalized:
            return _Result([])
        if "pg_extension" in normalized:
            return _Result([])
        return _Result([])

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def _write_statements(statements: list[str]) -> list[str]:
    return [s for s in statements if WRITE_SQL_RE.search(s)]


def test_applied_empty_when_tracking_table_missing():
    conn = RecordingConn(tracking_exists=False)
    assert _schema_migrations_exists(conn) is False
    assert _applied(conn) == set()
    assert _write_statements(conn.statements) == []


def test_status_reports_all_pending_when_tracking_missing(capsys):
    conn = RecordingConn(tracking_exists=False)
    cmd_status(conn, "production")
    out = capsys.readouterr().out
    assert "schema_migrations: missing" in out
    assert "0001_users_sessions: pending" in out
    assert "0002_mailbox_ownership: pending" in out
    assert "0003_message_states: pending" in out
    assert "0004_invitations_audit: pending" in out
    assert "applied" not in out
    assert _write_statements(conn.statements) == []
    assert conn.committed is False


def test_inspect_and_verify_emit_only_reads():
    conn = RecordingConn(tracking_exists=False)
    cmd_inspect(conn)
    verify_invariants(conn)
    writes = _write_statements(conn.statements)
    assert writes == [], f"unexpected writes: {writes}"
    assert conn.committed is False


def test_readonly_main_commands_never_call_ensure_table():
    fake_conn = MagicMock()
    fake_conn.__enter__ = MagicMock(return_value=fake_conn)
    fake_conn.__exit__ = MagicMock(return_value=False)

    for command in ("inspect", "status", "verify"):
        with (
            patch("app.migrate.get_settings") as gs,
            patch("app.migrate.connect", return_value=fake_conn) as connect_mock,
            patch("app.migrate._ensure_table") as ensure,
            patch("app.migrate.cmd_inspect"),
            patch("app.migrate.cmd_status"),
            patch("app.migrate.verify_invariants"),
        ):
            settings = MagicMock()
            settings.database_url = "postgresql://u:p@127.0.0.1:5432/db"
            settings.app_env = "development"
            settings.is_production = False
            gs.return_value = settings

            rc = main([command, "--profile", "production"])
            assert rc == 0
            ensure.assert_not_called()
            kwargs = connect_mock.call_args.kwargs
            assert "default_transaction_read_only=on" in kwargs.get("options", "")


def test_up_calls_ensure_table():
    with (
        patch("app.migrate.preflight") as preflight,
        patch("app.migrate._ensure_table") as ensure,
        patch("app.migrate._applied", return_value={"0001_users_sessions", "0002_mailbox_ownership", "0003_message_states", "0004_invitations_audit"}),
        patch("app.migrate.verify_invariants"),
    ):
        preflight.return_value = MagicMock(
            mailbox_pk="BIGINT",
            message_pk="BIGINT",
            mailboxes_exists=True,
            messages_exists=True,
        )
        conn = RecordingConn(tracking_exists=True)
        cmd_up(conn, "production")
        ensure.assert_called_once_with(conn)


@requires_db
def test_readonly_commands_no_schema_fingerprint_change(capsys):
    """Against a real DB: inspect/status/verify must not create schema_migrations or change counts."""
    url = os.environ["DATABASE_URL"]

    def fingerprint(conn):
        tables = {
            r["table_name"]
            for r in conn.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """
            ).fetchall()
        }
        tracking = "schema_migrations" in tables
        n_mig = 0
        if tracking:
            n_mig = conn.execute("SELECT COUNT(*) AS c FROM schema_migrations").fetchone()["c"]
        n_mbx = (
            conn.execute("SELECT COUNT(*) AS c FROM mailboxes").fetchone()["c"]
            if "mailboxes" in tables
            else None
        )
        n_msg = (
            conn.execute("SELECT COUNT(*) AS c FROM messages").fetchone()["c"]
            if "messages" in tables
            else None
        )
        return {
            "tables": frozenset(tables),
            "tracking": tracking,
            "n_mig": n_mig,
            "n_mbx": n_mbx,
            "n_msg": n_msg,
        }

    with connect(url, row_factory=dict_row) as conn:
        before = fingerprint(conn)

    # Session-level read-only: any accidental write raises.
    with connect(
        url,
        row_factory=dict_row,
        options="-c default_transaction_read_only=on",
    ) as conn:
        cmd_inspect(conn)
        cmd_status(conn, "production")
        verify_invariants(conn)
        cmd_inspect(conn)

    with connect(url, row_factory=dict_row) as conn:
        after = fingerprint(conn)

    assert after == before
    out = capsys.readouterr().out
    assert "mailboxes exists:" in out
    if not before["tracking"]:
        assert "pending" in out


@requires_db
def test_status_does_not_create_tracking_table():
    url = os.environ["DATABASE_URL"]
    with connect(url, row_factory=dict_row) as conn:
        existed = _schema_migrations_exists(conn)

    with connect(
        url,
        row_factory=dict_row,
        options="-c default_transaction_read_only=on",
    ) as conn:
        cmd_status(conn, "local")

    with connect(url, row_factory=dict_row) as conn:
        assert _schema_migrations_exists(conn) is existed
