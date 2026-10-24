import uuid

from tests.conftest import login, requires_db


def _secret_keys(obj: dict) -> set[str]:
    banned = {
        "password",
        "password_hash",
        "passwordHash",
        "token",
        "tempToken",
        "csrf_secret",
        "csrfSecret",
        "totp_secret",
        "totpSecret",
        "recovery_codes",
        "recoveryCodes",
        "recovery_codes_hash",
        "recoveryCodesHash",
        "session",
        "sessions",
        "bodyText",
        "bodyHtml",
        "raw_message",
    }
    return banned.intersection(obj.keys())


@requires_db
def test_list_accounts_customer_forbidden(client, customer_pair):
    alice, _bob = customer_pair
    login(client, alice["email"], alice["password"])
    r = client.get("/admin/accounts")
    assert r.status_code == 403


@requires_db
def test_list_accounts_admin_sees_all_roles(client, admin_user, owner_user, customer_pair):
    alice, bob = customer_pair
    login(client, admin_user["email"], admin_user["password"])
    r = client.get("/admin/accounts", params={"page": 1, "pageSize": 100})
    assert r.status_code == 200
    body = r.json()
    assert "data" in body and "total" in body and "totalPages" in body
    roles = {row["role"] for row in body["data"]}
    assert "customer" in roles
    assert "admin" in roles
    assert "owner" in roles

    emails = {row["email"] for row in body["data"]}
    assert admin_user["email"] in emails
    assert owner_user["email"] in emails
    assert alice["email"] in emails
    assert bob["email"] in emails

    for row in body["data"]:
        assert _secret_keys(row) == set()
        assert "id" in row
        assert "email" in row
        assert "displayName" in row
        assert "role" in row
        assert "status" in row
        assert "mailboxId" in row
        assert "mailboxAddress" in row


@requires_db
def test_list_accounts_owner_authorized(client, owner_user):
    login(client, owner_user["email"], owner_user["password"])
    r = client.get("/admin/accounts")
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)


@requires_db
def test_list_accounts_pagination_and_search(client, admin_user, customer_pair):
    alice, _bob = customer_pair
    login(client, admin_user["email"], admin_user["password"])

    page1 = client.get("/admin/accounts", params={"page": 1, "pageSize": 1})
    assert page1.status_code == 200
    body1 = page1.json()
    assert body1["page"] == 1
    assert body1["pageSize"] == 1
    assert len(body1["data"]) == 1
    assert body1["total"] >= 3
    assert body1["totalPages"] == max(1, (body1["total"] + 1 - 1) // 1)

    page2 = client.get("/admin/accounts", params={"page": 2, "pageSize": 1})
    assert page2.status_code == 200
    assert page2.json()["page"] == 2
    assert len(page2.json()["data"]) == 1
    assert page1.json()["data"][0]["id"] != page2.json()["data"][0]["id"]

    searched = client.get("/admin/accounts", params={"search": alice["email"]})
    assert searched.status_code == 200
    emails = [row["email"] for row in searched.json()["data"]]
    assert alice["email"] in emails
    assert all(alice["email"] == e or alice["email"].split("@")[0] in e for e in emails)


@requires_db
def test_admin_cannot_change_owner_role_or_status(client, admin_user, owner_user):
    login(client, admin_user["email"], admin_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    role_r = client.patch(
        f"/admin/owners/{owner_user['id']}/role",
        headers={"X-CSRF-Token": csrf},
        json={"role": "admin"},
    )
    assert role_r.status_code == 403

    status_r = client.patch(
        f"/admin/owners/{owner_user['id']}/status",
        headers={"X-CSRF-Token": csrf},
        json={"status": "suspended"},
    )
    assert status_r.status_code == 403


@requires_db
def test_owner_can_promote_and_promoted_admin_remains_listed(
    client, owner_user, customer_pair
):
    alice, _bob = customer_pair
    login(client, owner_user["email"], owner_user["password"])
    csrf = client.cookies.get("ykm_csrf")

    promote = client.patch(
        f"/admin/owners/{alice['id']}/role",
        headers={"X-CSRF-Token": csrf},
        json={"role": "admin"},
    )
    assert promote.status_code == 200
    assert promote.json()["role"] == "admin"

    listed = client.get("/admin/accounts", params={"search": alice["email"], "pageSize": 50})
    assert listed.status_code == 200
    match = next(row for row in listed.json()["data"] if row["email"] == alice["email"])
    assert match["role"] == "admin"
    assert match["id"] == str(alice["id"])

    # demote back for isolation of other tests
    demote = client.patch(
        f"/admin/owners/{alice['id']}/role",
        headers={"X-CSRF-Token": csrf},
        json={"role": "customer"},
    )
    assert demote.status_code == 200


@requires_db
def test_last_active_owner_protection(client, owner_user, db_conn):
    # Isolate to a single active owner (prior test runs may leave extras).
    db_conn.execute(
        """
        UPDATE users
        SET role = 'admin'
        WHERE role = 'owner' AND status = 'active' AND id <> %s
        """,
        (owner_user["id"],),
    )
    db_conn.commit()

    login(client, owner_user["email"], owner_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    r = client.patch(
        f"/admin/owners/{owner_user['id']}/status",
        headers={"X-CSRF-Token": csrf},
        json={"status": "suspended"},
    )
    assert r.status_code == 409
    assert "last active owner" in r.json()["detail"].lower()


@requires_db
def test_bulk_create_accounts_and_admin_set_password(client, admin_user, owner_user):
    login(client, admin_user["email"], admin_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    prefix = f"blk{uuid.uuid4().hex[:6]}"
    r = client.post(
        "/admin/accounts/bulk",
        headers={"X-CSRF-Token": csrf},
        json={
            "prefix": prefix,
            "count": 3,
            "startIndex": 1,
            "padWidth": 2,
            "useRandom": False,
            "passwordMode": "generate",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["createdCount"] == 3
    assert body["skippedCount"] == 0
    assert len(body["created"]) == 3
    for row in body["created"]:
        assert row["email"].startswith(prefix)
        assert "@" in row["email"]
        assert row["role"] == "customer"
        assert row["mailboxId"]
        assert isinstance(row["password"], str) and len(row["password"]) >= 10
        assert "password_hash" not in row

    target = body["created"][0]
    new_password = "ManualReset!99"
    set_r = client.post(
        f"/admin/accounts/{target['id']}/password",
        headers={"X-CSRF-Token": csrf},
        json={"password": new_password},
    )
    assert set_r.status_code == 204

    # Admin cannot set owner password
    deny = client.post(
        f"/admin/accounts/{owner_user['id']}/password",
        headers={"X-CSRF-Token": csrf},
        json={"password": "ShouldNotWork1"},
    )
    assert deny.status_code == 403

    # Login with new password works
    client.post("/auth/logout", headers={"X-CSRF-Token": csrf})
    login_ok = client.post(
        "/auth/login",
        json={"email": target["email"], "password": new_password},
    )
    assert login_ok.status_code == 200


@requires_db
def test_bulk_create_shared_password_and_customer_forbidden(
    client, admin_user, customer_pair
):
    alice, _bob = customer_pair
    login(client, alice["email"], alice["password"])
    csrf = client.cookies.get("ykm_csrf")
    forbidden = client.post(
        "/admin/accounts/bulk",
        headers={"X-CSRF-Token": csrf},
        json={
            "prefix": "nope",
            "count": 2,
            "passwordMode": "shared",
            "password": "SharedPass99",
        },
    )
    assert forbidden.status_code == 403

    login(client, admin_user["email"], admin_user["password"])
    csrf = client.cookies.get("ykm_csrf")
    prefix = f"sh{uuid.uuid4().hex[:6]}"
    r = client.post(
        "/admin/accounts/bulk",
        headers={"X-CSRF-Token": csrf},
        json={
            "prefix": prefix,
            "count": 2,
            "startIndex": 10,
            "padWidth": 2,
            "passwordMode": "shared",
            "password": "SharedPass99",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["createdCount"] == 2
    assert all(row["password"] == "SharedPass99" for row in body["created"])
    assert body["created"][0]["email"].endswith("@yoyknowmail.com")
    assert f"{prefix}10@" in body["created"][0]["email"] or f"{prefix}11@" in body["created"][0]["email"]
