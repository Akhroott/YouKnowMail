import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from app.config import get_settings
from app.db import get_conn
from app.security.deps import AuthUser, require_admin
from app.security.passwords import hash_password
from app.services.audit import write_audit

router = APIRouter(prefix="/admin/accounts", tags=["accounts"])

USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$")


class CreateAccountRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=10, max_length=256)
    displayName: str = ""


@router.post("", status_code=201)
def create_account(
    payload: CreateAccountRequest,
    actor: AuthUser = Depends(require_admin),
):
    username = payload.username.strip().lower()

    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(status_code=400, detail="Invalid username")

    address = f"{username}@{get_settings().mail_domain}"

    try:
        with get_conn() as conn:
            with conn.transaction():
                # Serialize account provisioning to avoid racing with
                # another request provisioning the same address.
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    (address,),
                )

                existing_user = conn.execute(
                    "SELECT id FROM users WHERE email = %s",
                    (address,),
                ).fetchone()

                if existing_user:
                    raise HTTPException(
                        status_code=409,
                        detail="Account already exists",
                    )

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
                        raise HTTPException(
                            status_code=409,
                            detail="Mailbox already assigned",
                        )

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
                    (
                        address,
                        hash_password(payload.password),
                        payload.displayName,
                    ),
                ).fetchone()

                conn.execute(
                    """
                    INSERT INTO mailbox_owners (
                        mailbox_id, user_id, assigned_by
                    )
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

    except UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="Account or mailbox already exists",
        )
