from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from typing import Literal

from pydantic import BaseModel

from app.db import get_conn
from app.security.deps import AuthUser, require_owner
from app.services.audit import write_audit

router = APIRouter(prefix="/admin/owners", tags=["owners"])


class UpdateRoleRequest(BaseModel):
    role: Literal["customer", "admin", "owner"]


class UpdateStatusRequest(BaseModel):
    status: Literal["active", "suspended"]


def _lock_role_management(conn):
    conn.execute("SELECT pg_advisory_xact_lock(918472615)")


def _protect_last_owner(conn, target):
    if target["role"] != "owner" or target["status"] != "active":
        return

    count = conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM users
        WHERE role = 'owner' AND status = 'active'
        """
    ).fetchone()["total"]

    if count <= 1:
        raise HTTPException(
            status_code=409,
            detail="Cannot remove the last active owner",
        )


@router.patch("/{user_id}/role")
def update_role(
    user_id: UUID,
    payload: UpdateRoleRequest,
    actor: AuthUser = Depends(require_owner),
):
    with get_conn() as conn:
        with conn.transaction():
            _lock_role_management(conn)

            target = conn.execute(
                "SELECT id, email, role, status FROM users WHERE id = %s FOR UPDATE",
                (user_id,),
            ).fetchone()

            if not target:
                raise HTTPException(status_code=404, detail="User not found")

            if payload.role == "owner" and target["status"] != "active":
                raise HTTPException(
                    status_code=409,
                    detail="Only active accounts can become owners",
                )

            if target["role"] == "owner" and payload.role != "owner":
                _protect_last_owner(conn, target)

            updated = conn.execute(
                """
                UPDATE users
                SET role = %s
                WHERE id = %s
                RETURNING id, email, role, status
                """,
                (payload.role, user_id),
            ).fetchone()

            if target["role"] != payload.role:
                write_audit(
                    conn,
                    action="account_role_changed",
                    actor_user_id=actor.id,
                    actor_email=actor.email,
                    actor_role=actor.role,
                    target_type="user",
                    target_id=str(user_id),
                    metadata={
                        "previousRole": target["role"],
                        "newRole": payload.role,
                        "targetEmail": str(target["email"]),
                    },
                )

                conn.execute(
                    """
                    UPDATE sessions
                    SET revoked_at = NOW()
                    WHERE user_id = %s AND revoked_at IS NULL
                    """,
                    (user_id,),
                )

        return {
            "id": str(updated["id"]),
            "email": str(updated["email"]),
            "role": updated["role"],
            "status": updated["status"],
        }


@router.patch("/{user_id}/status")
def update_status(
    user_id: UUID,
    payload: UpdateStatusRequest,
    actor: AuthUser = Depends(require_owner),
):
    with get_conn() as conn:
        with conn.transaction():
            _lock_role_management(conn)

            target = conn.execute(
                "SELECT id, email, role, status FROM users WHERE id = %s FOR UPDATE",
                (user_id,),
            ).fetchone()

            if not target:
                raise HTTPException(status_code=404, detail="User not found")

            if payload.status == "suspended":
                _protect_last_owner(conn, target)

            updated = conn.execute(
                """
                UPDATE users
                SET status = %s
                WHERE id = %s
                RETURNING id, email, role, status
                """,
                (payload.status, user_id),
            ).fetchone()

            if target["status"] != payload.status:
                write_audit(
                    conn,
                    action="account_status_changed",
                    actor_user_id=actor.id,
                    actor_email=actor.email,
                    actor_role=actor.role,
                    target_type="user",
                    target_id=str(user_id),
                    metadata={
                        "previousStatus": target["status"],
                        "newStatus": payload.status,
                        "targetEmail": str(target["email"]),
                    },
                )

            if payload.status == "suspended":
                conn.execute(
                    """
                    UPDATE sessions
                    SET revoked_at = NOW()
                    WHERE user_id = %s AND revoked_at IS NULL
                    """,
                    (user_id,),
                )

        return {
            "id": str(updated["id"]),
            "email": str(updated["email"]),
            "role": updated["role"],
            "status": updated["status"],
        }
