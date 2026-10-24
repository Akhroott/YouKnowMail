import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from psycopg import connect
from psycopg.rows import dict_row

# Test DB URL — must be set explicitly for integration tests. Placeholder CHANGE_ME is rejected.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("FRONTEND_ORIGINS", "http://localhost:3000")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("MAIL_DOMAIN", "yoyknowmail.com")
if "DATABASE_URL" not in os.environ and "TEST_DATABASE_URL" in os.environ:
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://yoyknowmail:yoyknowmail@127.0.0.1:5432/yoyknowmail_test",
    ),
)


def _db_available() -> bool:
    url = os.environ.get("DATABASE_URL", "")
    if "CHANGE_ME" in url:
        return False
    try:
        with connect(url, connect_timeout=2) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


requires_db = pytest.mark.skipif(not _db_available(), reason="PostgreSQL test database unavailable")


@pytest.fixture(scope="session")
def migrated_db() -> Generator[None, None, None]:
    if not _db_available():
        pytest.skip("PostgreSQL test database unavailable")
    from app.config import get_settings
    from app.migrate import _ensure_table, cmd_up

    get_settings.cache_clear()
    with connect(os.environ["DATABASE_URL"], row_factory=dict_row) as conn:
        _ensure_table(conn)
        cmd_up(conn, profile="local")
    yield


@pytest.fixture
def client(migrated_db) -> Generator[TestClient, None, None]:
    from app.config import get_settings
    from app.db import close_pool
    from app.main import create_app

    get_settings.cache_clear()
    close_pool()
    app = create_app()
    with TestClient(app) as c:
        yield c
    close_pool()


@pytest.fixture
def db_conn(migrated_db):
    with connect(os.environ["DATABASE_URL"], row_factory=dict_row) as conn:
        yield conn
        conn.rollback()


@pytest.fixture
def admin_user(db_conn, client: TestClient):
    from app.security.passwords import hash_password

    email = f"admin-{uuid.uuid4().hex[:8]}@yoyknowmail.com"
    password = "AdminPass123!"
    row = db_conn.execute(
        """
        INSERT INTO users (email, password_hash, role, status, display_name, totp_enabled)
        VALUES (%s, %s, 'admin', 'active', 'Admin', FALSE)
        RETURNING id, email
        """,
        (email, hash_password(password)),
    ).fetchone()
    db_conn.commit()
    return {"id": row["id"], "email": email, "password": password}


@pytest.fixture
def owner_user(db_conn, client: TestClient):
    from app.security.passwords import hash_password

    email = f"owner-{uuid.uuid4().hex[:8]}@yoyknowmail.com"
    password = "OwnerPass123!"
    row = db_conn.execute(
        """
        INSERT INTO users (email, password_hash, role, status, display_name, totp_enabled)
        VALUES (%s, %s, 'owner', 'active', 'Owner', FALSE)
        RETURNING id, email
        """,
        (email, hash_password(password)),
    ).fetchone()
    db_conn.commit()
    return {"id": row["id"], "email": email, "password": password}


@pytest.fixture
def customer_pair(db_conn, admin_user):
    from app.security.passwords import hash_password

    def make(label: str):
        email = f"{label}-{uuid.uuid4().hex[:8]}@example.com"
        password = "CustomerPass123!"
        user = db_conn.execute(
            """
            INSERT INTO users (email, password_hash, role, status, display_name, totp_enabled)
            VALUES (%s, %s, 'customer', 'active', %s, FALSE)
            RETURNING id, email
            """,
            (email, hash_password(password), label),
        ).fetchone()
        mbx = db_conn.execute(
            """
            INSERT INTO mailboxes (address, is_active)
            VALUES (%s, TRUE) RETURNING id, address
            """,
            (f"{label}.{uuid.uuid4().hex[:6]}@yoyknowmail.com",),
        ).fetchone()
        db_conn.execute(
            "INSERT INTO mailbox_owners (mailbox_id, user_id) VALUES (%s, %s)",
            (mbx["id"], user["id"]),
        )
        db_conn.commit()
        return {
            "id": user["id"],
            "email": email,
            "password": password,
            "mailbox_id": mbx["id"],
            "address": mbx["address"],
        }

    a = make("alice")
    b = make("bob")
    return a, b


def login(client: TestClient, email: str, password: str) -> None:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    assert r.json().get("requires2FA") is False
    assert client.cookies.get("ykm_session")
    assert client.cookies.get("ykm_csrf")
