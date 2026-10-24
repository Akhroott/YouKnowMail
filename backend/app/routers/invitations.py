from fastapi import APIRouter, HTTPException, Request

from app.db import get_conn
from app.schemas import AcceptInvitationRequest
from app.security.passwords import hash_password
from app.security.tokens import hash_token
from app.services.audit import write_audit
from app.services.sessions import revoke_other_sessions

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.get("/{token}")
def get_invitation(token: str):
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT * FROM invitations WHERE token_hash = %s
            """,
            (hash_token(token),),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if row["status"] != "pending":
            raise HTTPException(status_code=400, detail="This invitation is no longer valid")
        if row["expires_at"].timestamp() < __import__("time").time():
            conn.execute(
                "UPDATE invitations SET status = 'expired' WHERE id = %s",
                (row["id"],),
            )
            conn.commit()
            raise HTTPException(status_code=400, detail="This invitation has expired")
        return {
            "id": str(row["id"]),
            "token": token,
            "mailboxId": str(row["mailbox_id"]) if row["mailbox_id"] else None,
            "mailboxAddress": row["mailbox_address"],
            "customerEmail": str(row["customer_email"]),
            "status": row["status"],
            "createdAt": row["created_at"].isoformat(),
            "expiresAt": row["expires_at"].isoformat(),
            "acceptedAt": row["accepted_at"].isoformat() if row["accepted_at"] else None,
        }


@router.post("/{token}/accept")
def accept_invitation(token: str, payload: AcceptInvitationRequest, request: Request):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM invitations WHERE token_hash = %s FOR UPDATE",
            (hash_token(token),),
        ).fetchone()
        if not row or row["status"] != "pending":
            raise HTTPException(status_code=400, detail="This invitation is no longer valid")
        if row["expires_at"].timestamp() < __import__("time").time():
            conn.execute("UPDATE invitations SET status = 'expired' WHERE id = %s", (row["id"],))
            conn.commit()
            raise HTTPException(status_code=400, detail="This invitation has expired")

        conn.execute(
            """
            UPDATE users
            SET password_hash = %s, status = 'active'
            WHERE id = %s
            """,
            (hash_password(payload.password), row["user_id"]),
        )
        # Revoke existing sessions on ownership accept
        conn.execute(
            "UPDATE sessions SET revoked_at = NOW() WHERE user_id = %s AND revoked_at IS NULL",
            (row["user_id"],),
        )
        conn.execute(
            """
            UPDATE invitations
            SET status = 'accepted', accepted_at = NOW()
            WHERE id = %s
            """,
            (row["id"],),
        )
        write_audit(
            conn,
            action="invitation_accepted",
            actor_user_id=row["user_id"],
            actor_email=str(row["customer_email"]),
            actor_role="customer",
            target_id=row["mailbox_address"],
            ip=_ip(request),
        )
        conn.commit()
        return {"requires2FASetup": True}
