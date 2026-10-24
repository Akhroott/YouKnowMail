from pathlib import Path

import pytest

from app.migrate import (
    DROP_RE,
    INGEST_MUTATION_RE,
    SchemaInfo,
    _assert_safe_sql,
    _pg_type_to_sql,
    _render,
    _versions,
)


def test_drop_regex_detects_table_drop():
    assert DROP_RE.search("DROP TABLE IF EXISTS mailboxes CASCADE;")
    assert DROP_RE.search("drop table messages;")
    assert not DROP_RE.search("CREATE TABLE mailboxes (id BIGINT);")


def test_production_refuses_drop_sql():
    with pytest.raises(RuntimeError, match="destructive"):
        _assert_safe_sql(
            "DROP TABLE IF EXISTS users;",
            profile="production",
            allow_drop_ingest=False,
        )


def test_local_refuses_ingest_drop_without_flag():
    with pytest.raises(RuntimeError, match="allow-drop-ingest"):
        _assert_safe_sql(
            "DROP TABLE IF EXISTS messages CASCADE; DROP TABLE IF EXISTS mailboxes CASCADE;",
            profile="local",
            allow_drop_ingest=False,
        )


def test_local_allows_ingest_drop_with_flag():
    _assert_safe_sql(
        "DROP TABLE IF EXISTS messages CASCADE; DROP TABLE IF EXISTS mailboxes CASCADE;",
        profile="local",
        allow_drop_ingest=True,
    )


def test_production_versions_only_0001_to_0004():
    versions = _versions("production")
    names = [v for v, _ in versions]
    paths = [str(p) for _, p in versions]
    assert all("local" not in Path(p).parts for p in paths)
    assert all("dba" not in Path(p).parts for p in paths)
    assert names == [
        "0001_users_sessions",
        "0002_mailbox_ownership",
        "0003_message_states",
        "0004_invitations_audit",
    ]
    assert not any(v.startswith("0000_") for v in names)


def test_production_refuses_create_extension_sql():
    with pytest.raises(RuntimeError, match="CREATE EXTENSION"):
        _assert_safe_sql(
            "CREATE EXTENSION IF NOT EXISTS citext;",
            profile="production",
            allow_drop_ingest=False,
        )


def test_local_versions_include_baseline():
    versions = [v for v, _ in _versions("local")]
    assert "0000_baseline_ingest_tables" in versions
    assert "0001_users_sessions" in versions


def test_render_substitutes_pk_types():
    info = SchemaInfo(
        mailboxes_exists=True,
        messages_exists=True,
        mailbox_pk="UUID",
        message_pk="BIGINT",
        delivery_id_unique=True,
        mailbox_columns=set(),
        message_columns=set(),
    )
    sql = "mailbox_id {{MAILBOX_PK}} , message_id {{MESSAGE_PK}}"
    assert _render(sql, info) == "mailbox_id UUID , message_id BIGINT"


def test_pg_type_mapping():
    assert _pg_type_to_sql("uuid", "uuid") == "UUID"
    assert _pg_type_to_sql("int8", "bigint") == "BIGINT"
    assert _pg_type_to_sql("int4", "integer") == "INTEGER"


def test_production_refuses_ingest_table_mutation():
    assert INGEST_MUTATION_RE.search("ALTER TABLE messages ADD COLUMN x INT;")
    assert INGEST_MUTATION_RE.search("UPDATE mailboxes SET is_active = FALSE;")
    assert INGEST_MUTATION_RE.search("DELETE FROM messages WHERE id = 1;")
    with pytest.raises(RuntimeError, match="mutates mailboxes/messages"):
        _assert_safe_sql(
            "ALTER TABLE messages ALTER COLUMN raw_message TYPE TEXT;",
            profile="production",
            allow_drop_ingest=False,
        )


def test_production_migration_files_do_not_mutate_ingest():
    from app.migrate import PROD_MIGRATIONS_DIR

    for path in sorted(PROD_MIGRATIONS_DIR.glob("*.up.sql")):
        sql = path.read_text(encoding="utf-8")
        _assert_safe_sql(sql, profile="production", allow_drop_ingest=False)
