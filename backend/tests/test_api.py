import uuid

import pytest

from tests.conftest import login, requires_db


@requires_db
def test_app_health(client):
    r = client.get("/app-health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


@requires_db
def test_login_logout(client, admin_user):
    login(client, admin_user["email"], admin_user["password"])
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["role"] == "admin"

    csrf = client.cookies.get("ykm_csrf")
    r = client.post("/auth/logout", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204
    assert client.get("/auth/me").status_code == 401


@requires_db
def test_unauthorized_messages(client):
    assert client.get("/messages").status_code == 401


@requires_db
def test_csrf_required(client, admin_user):
    login(client, admin_user["email"], admin_user["password"])
    # Missing CSRF header on mutating request
    r = client.post(
        "/admin/mailboxes",
        json={"username": "nocsrf", "domain": "yoyknowmail.com"},
    )
    assert r.status_code == 403


@requires_db
def test_admin_only_customer_create(client, customer_pair, admin_user):
    alice, _bob = customer_pair
    login(client, alice["email"], alice["password"])
    csrf = client.cookies.get("ykm_csrf")
    r = client.post(
        "/admin/customers",
        headers={"X-CSRF-Token": csrf},
        json={"email": "new@example.com", "displayName": "New", "password": "CustomerPass123!"},
    )
    assert r.status_code == 403

    login(client, admin_user["email"], admin_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    r = client.post(
        "/admin/customers",
        headers={"X-CSRF-Token": csrf},
        json={
            "email": f"cust-{uuid.uuid4().hex[:6]}@example.com",
            "displayName": "New",
            "password": "CustomerPass123!",
            "sendInvitation": False,
        },
    )
    assert r.status_code == 200
    assert r.json()["role"] == "customer"


@requires_db
def test_mailbox_ownership_isolation(client, customer_pair, db_conn):
    alice, bob = customer_pair
    # Seed a message into bob's mailbox
    db_conn.execute(
        """
        INSERT INTO messages (mailbox_id, sender, subject, body_text, body_html, raw_message, message_id, recipient, delivery_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            bob["mailbox_id"],
            "noreply@example.com",
            "Secret for Bob",
            "code is 441902",
            "<p>code is 441902</p>",
            "raw",
            f"mid-{uuid.uuid4()}",
            bob["address"],
            str(uuid.uuid4()),
        ),
    )
    db_conn.commit()

    login(client, alice["email"], alice["password"])
    listed = client.get("/messages").json()
    assert all(m["mailboxId"] != str(bob["mailbox_id"]) or m["subject"] != "Secret for Bob" for m in listed["data"])
    # Direct ID access should 404 for alice — get bob message id
    bob_msg = db_conn.execute(
        "SELECT id FROM messages WHERE mailbox_id = %s ORDER BY id DESC LIMIT 1",
        (bob["mailbox_id"],),
    ).fetchone()
    assert client.get(f"/messages/{bob_msg['id']}").status_code == 404


@requires_db
def test_duplicate_mailbox(client, admin_user):
    login(client, admin_user["email"], admin_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    username = f"dup{uuid.uuid4().hex[:6]}"
    r1 = client.post(
        "/admin/mailboxes",
        headers={"X-CSRF-Token": csrf},
        json={"username": username, "domain": "yoyknowmail.com"},
    )
    assert r1.status_code == 200
    r2 = client.post(
        "/admin/mailboxes",
        headers={"X-CSRF-Token": csrf},
        json={"username": username, "domain": "yoyknowmail.com"},
    )
    assert r2.status_code == 409


@requires_db
def test_bulk_validation(client, admin_user):
    login(client, admin_user["email"], admin_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    r = client.post(
        "/admin/mailboxes/bulk",
        headers={"X-CSRF-Token": csrf},
        json={"count": 101, "prefix": "bulk", "domain": "yoyknowmail.com", "useRandom": True},
    )
    assert r.status_code == 400


@requires_db
def test_message_pagination(client, customer_pair, db_conn):
    alice, _ = customer_pair
    for i in range(5):
        db_conn.execute(
            """
            INSERT INTO messages (mailbox_id, sender, subject, body_text, body_html, raw_message, message_id, recipient, delivery_id)
            VALUES (%s, 'a@b.c', %s, 'x', 'x', 'raw', %s, %s, %s)
            """,
            (
                alice["mailbox_id"],
                f"Msg {i}",
                f"mid-{uuid.uuid4()}",
                alice["address"],
                str(uuid.uuid4()),
            ),
        )
    db_conn.commit()
    login(client, alice["email"], alice["password"])
    page1 = client.get("/messages?page=1&pageSize=2").json()
    assert len(page1["data"]) == 2
    assert page1["total"] >= 5
    assert page1["totalPages"] >= 3


@requires_db
def test_ingestion_delivery_id_unique(db_conn, customer_pair):
    alice, _ = customer_pair
    did = str(uuid.uuid4())
    db_conn.execute(
        """
        INSERT INTO messages (mailbox_id, sender, subject, body_text, body_html, raw_message, message_id, recipient, delivery_id)
        VALUES (%s, 'a@b.c', 't', 'b', 'b', 'raw', %s, %s, %s)
        """,
        (alice["mailbox_id"], f"mid-{uuid.uuid4()}", alice["address"], did),
    )
    db_conn.commit()
    with pytest.raises(Exception):
        db_conn.execute(
            """
            INSERT INTO messages (mailbox_id, sender, subject, body_text, body_html, raw_message, message_id, recipient, delivery_id)
            VALUES (%s, 'a@b.c', 't2', 'b', 'b', 'raw', %s, %s, %s)
            """,
            (alice["mailbox_id"], f"mid-{uuid.uuid4()}", alice["address"], did),
        )
        db_conn.commit()
    db_conn.rollback()
