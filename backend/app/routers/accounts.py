import re
import secrets
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from psycopg.errors import UniqueViolation

from app.config import get_settings
from app.db import get_conn
from app.security.deps import AuthUser, require_admin, require_admin_readonly
from app.security.passwords import hash_password
from app.services.audit import write_audit

router = APIRouter(prefix="/admin/accounts", tags=["accounts"])

USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$")


class CreateAccountRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=10, max_length=256)
    displayName: str = ""


class BulkCreateAccountsRequest(BaseModel):
    prefix: str = Field(min_length=1, max_length=48)
    count: int = Field(ge=1, le=100)
    startIndex: int = Field(default=1, ge=0, le=999999)
    padWidth: int = Field(default=3, ge=1, le=8)
    useRandom: bool = False
    passwordMode: Literal["shared", "generate"] = "generate"
    password: str | None = Field(default=None, min_length=10, max_length=256)
    displayNamePrefix: str = ""

    @model_validator(mode="after")
    def _validate_password_mode(self):
        prefix = self.prefix.strip().lower()
        if not USERNAME_RE.fullmatch(prefix) and not re.fullmatch(
            r"^[a-z0-9][a-z0-9._-]*$", prefix
        ):
            raise ValueError("Invalid prefix")
        if self.passwordMode == "shared" and not self.password:
            raise ValueError("password is required when passwordMode is shared")
        return self


class SetAccountPasswordRequest(BaseModel):
    password: str = Field(min_length=10, max_length=256)


def _account_list_item(row: dict) -> dict:
    """Public account list fields only — never secrets or message content."""
    mailbox_id = row.get("mailbox_id")
    mailbox_address = row.get("mailbox_address")
    # Owner-provisioned customers are locked for admin management.
    owner_protected = (
        row.get("role") == "customer"
        and (row.get("assigned_by_role") or "") == "owner"
    )
    return {
        "id": str(row["id"]),
        "email": str(row["email"]),
        "displayName": row.get("display_name") or "",
        "role": row["role"],
        "status": row["status"],
        "mailboxId": str(mailbox_id) if mailbox_id else None,
        "mailboxAddress": str(mailbox_address) if mailbox_address else None,
        "ownerProtected": owner_protected,
    }


def _normalize_username(username: str) -> str:
    username = username.strip().lower()
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(status_code=400, detail="Invalid username")
    return username


def _is_owner_provisioned(conn, user_id: UUID) -> bool:
    """True when this user's mailbox was assigned by an owner account."""
    row = conn.execute(
        """
        SELECT creator.role AS creator_role
        FROM mailbox_owners mo
        JOIN users creator ON creator.id = mo.assigned_by
        WHERE mo.user_id = %s
        ORDER BY mo.assigned_at
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    return bool(row and row["creator_role"] == "owner")


def _assert_admin_may_manage_customer(conn, actor: AuthUser, user_id: UUID) -> None:
    """Owners may manage anyone; admins cannot manage owner-created customers."""
    if actor.role == "owner":
        return
    if _is_owner_provisioned(conn, user_id):
        raise HTTPException(
            status_code=403,
            detail="This account was created by an owner and cannot be managed by admins",
        )


def _provision_account(
    conn,
    *,
    username: str,
    password: str,
    display_name: str,
    actor: AuthUser,
) -> dict:
    """Create one customer user + private mailbox. Caller owns the transaction."""
    address = f"{username}@{get_settings().mail_domain}"

    conn.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
        (address,),
    )

    existing_user = conn.execute(
        "SELECT id FROM users WHERE email = %s",
        (address,),
    ).fetchone()
    if existing_user:
        raise HTTPException(status_code=409, detail="Account already exists")

    mailbox = conn.execute(
        """
        SELECT id, address
        FROM mailboxes
        WHERE lower(address) = %s
        FOR UPDATE
        """,
        (address,),
    ).fetchone()

    if mailbox:
        ownership = conn.execute(
            """
            SELECT user_id
            FROM mailbox_owners
            WHERE mailbox_id = %s
            """,
            (mailbox["id"],),
        ).fetchone()
        if ownership:
            raise HTTPException(status_code=409, detail="Mailbox already assigned")
        mailbox_id = mailbox["id"]
        conn.execute(
            "UPDATE mailboxes SET is_active = TRUE WHERE id = %s",
            (mailbox_id,),
        )
    else:
        mailbox = conn.execute(
            """
            INSERT INTO mailboxes (address, is_active)
            VALUES (%s, TRUE)
            RETURNING id
            """,
            (address,),
        ).fetchone()
        mailbox_id = mailbox["id"]

    new_user = conn.execute(
        """
        INSERT INTO users (
            email, password_hash, role, status, display_name
        )
        VALUES (%s, %s, 'customer', 'active', %s)
        RETURNING id, email, role, status
        """,
        (address, hash_password(password), display_name),
    ).fetchone()

    conn.execute(
        """
        INSERT INTO mailbox_owners (mailbox_id, user_id, assigned_by)
        VALUES (%s, %s, %s)
        """,
        (mailbox_id, new_user["id"], actor.id),
    )

    write_audit(
        conn,
        action="account_created",
        actor_user_id=actor.id,
        actor_email=actor.email,
        actor_role=actor.role,
        target_type="user",
        target_id=str(new_user["id"]),
        metadata={
            "email": address,
            "mailboxId": str(mailbox_id),
        },
    )

    return {
        "id": str(new_user["id"]),
        "email": str(new_user["email"]),
        "role": new_user["role"],
        "status": new_user["status"],
        "mailboxId": str(mailbox_id),
        "mailboxAddress": address,
    }


def _generate_password() -> str:
    # URL-safe, >= 10 chars for policy
    return secrets.token_urlsafe(12)


def _bulk_username(prefix: str, index: int, pad_width: int, use_random: bool) -> str:
    if use_random:
        return f"{prefix}{secrets.token_hex(3)}"
    return f"{prefix}{str(index).zfill(pad_width)}"


@router.get("")
def list_accounts(
    search: str = "",
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    _actor: AuthUser = Depends(require_admin_readonly),
):
    """
    List all account roles (customer, admin, owner) for staff.
    Safe fields only — no password hashes, tokens, 2FA secrets, or messages.
    """
    with get_conn() as conn:
        where: list[str] = ["TRUE"]
        params: list = []
        if search.strip():
            where.append(
                "(u.email ILIKE %s OR u.display_name ILIKE %s OR m.address ILIKE %s)"
            )
            q = f"%{search.strip()}%"
            params.extend([q, q, q])
        where_sql = " AND ".join(where)

        total = conn.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM users u
            LEFT JOIN LATERAL (
              SELECT o.mailbox_id
              FROM mailbox_owners o
              WHERE o.user_id = u.id
              ORDER BY o.assigned_at
              LIMIT 1
            ) mo ON TRUE
            LEFT JOIN mailboxes m ON m.id = mo.mailbox_id
            WHERE {where_sql}
            """,
            params,
        ).fetchone()["c"]

        rows = conn.execute(
            f"""
            SELECT
              u.id,
              u.email,
              u.display_name,
              u.role,
              u.status,
              mo.mailbox_id,
              m.address AS mailbox_address,
              creator.role AS assigned_by_role
            FROM users u
            LEFT JOIN LATERAL (
              SELECT o.mailbox_id, o.assigned_by
              FROM mailbox_owners o
              WHERE o.user_id = u.id
              ORDER BY o.assigned_at
              LIMIT 1
            ) mo ON TRUE
            LEFT JOIN mailboxes m ON m.id = mo.mailbox_id
            LEFT JOIN users creator ON creator.id = mo.assigned_by
            WHERE {where_sql}
            ORDER BY u.created_at DESC
            LIMIT %s OFFSET %s
            """,
            [*params, pageSize, (page - 1) * pageSize],
        ).fetchall()

        return {
            "data": [_account_list_item(r) for r in rows],
            "total": total,
            "page": page,
            "pageSize": pageSize,
            "totalPages": max(1, (total + pageSize - 1) // pageSize),
        }


@router.post("", status_code=201)
def create_account(
    payload: CreateAccountRequest,
    actor: AuthUser = Depends(require_admin),
):
    username = _normalize_username(payload.username)

    try:
        with get_conn() as conn:
            with conn.transaction():
                return _provision_account(
                    conn,
                    username=username,
                    password=payload.password,
                    display_name=payload.displayName,
                    actor=actor,
                )
    except UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="Account or mailbox already exists",
        )


@router.post("/bulk", status_code=201)
def bulk_create_accounts(
    payload: BulkCreateAccountsRequest,
    actor: AuthUser = Depends(require_admin),
):
    """
    Create many customer accounts (one login + one mailbox each).
    Plaintext passwords are returned once for export — never logged.
    """
    settings = get_settings()
    limit = min(payload.count, settings.bulk_mailbox_limit, 100)
    prefix = payload.prefix.strip().lower()

    created: list[dict] = []
    skipped: list[dict] = []

    with get_conn() as conn:
        for i in range(limit):
            index = payload.startIndex + i
            username = _bulk_username(prefix, index, payload.padWidth, payload.useRandom)
            if len(username) > 64 or not USERNAME_RE.fullmatch(username):
                skipped.append({"username": username, "reason": "invalid_username"})
                continue

            if payload.passwordMode == "shared":
                password = payload.password or ""
            else:
                password = _generate_password()

            display = (
                f"{payload.displayNamePrefix.strip()} {username}".strip()
                if payload.displayNamePrefix.strip()
                else ""
            )

            try:
                with conn.transaction():
                    row = _provision_account(
                        conn,
                        username=username,
                        password=password,
                        display_name=display,
                        actor=actor,
                    )
                # Include password once for operator export (CSV). Not stored in audit.
                created.append({**row, "password": password})
            except HTTPException as exc:
                reason = "conflict" if exc.status_code == 409 else "error"
                detail = exc.detail if isinstance(exc.detail, str) else reason
                skipped.append({"username": username, "reason": detail})
            except UniqueViolation:
                skipped.append({"username": username, "reason": "already_exists"})

        write_audit(
            conn,
            action="accounts_bulk_created",
            actor_user_id=actor.id,
            actor_email=actor.email,
            actor_role=actor.role,
            target_type="bulk",
            target_id=f"bulk:{len(created)}",
            metadata={
                "createdCount": len(created),
                "skippedCount": len(skipped),
                "prefix": prefix,
                "passwordMode": payload.passwordMode,
            },
        )
        conn.commit()

    return {
        "created": created,
        "skipped": skipped,
        "createdCount": len(created),
        "skippedCount": len(skipped),
    }


@router.post("/{user_id}/password", status_code=204)
def set_account_password(
    user_id: UUID,
    payload: SetAccountPasswordRequest,
    actor: AuthUser = Depends(require_admin),
):
    """
    Admin sets a customer's password. Owners may set any account's password.
    Revokes all sessions for the target. Never returns or logs the password.
    """
    with get_conn() as conn:
        with conn.transaction():
            target = conn.execute(
                "SELECT id, email, role, status FROM users WHERE id = %s FOR UPDATE",
                (user_id,),
            ).fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="User not found")

            if actor.role != "owner" and target["role"] != "customer":
                raise HTTPException(
                    status_code=403,
                    detail="Admins can only set passwords for customer accounts",
                )

            _assert_admin_may_manage_customer(conn, actor, user_id)

            conn.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (hash_password(payload.password), user_id),
            )
            conn.execute(
                """
                UPDATE sessions
                SET revoked_at = NOW()
                WHERE user_id = %s AND revoked_at IS NULL
                """,
                (user_id,),
            )
            write_audit(
                conn,
                action="account_password_set",
                actor_user_id=actor.id,
                actor_email=actor.email,
                actor_role=actor.role,
                target_type="user",
                target_id=str(user_id),
                metadata={"targetEmail": str(target["email"])},
            )
