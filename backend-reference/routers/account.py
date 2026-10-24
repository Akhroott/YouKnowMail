from fastapi import APIRouter, Depends, HTTPException, Request

from app.db import get_conn
from app.schemas import AccountUpdate, ChangePasswordRequest
from app.security.deps import AuthUser, get_current_user, get_current_user_readonly
from app.security.passwords import hash_password, verify_password
from app.services.audit import write_audit
from app.services.serializers import user_public
from app.services.sessions import revoke_other_sessions

router = APIRouter(tags=["account"])


def _sessions_list(conn, user_id, current_session_id):
    rows = conn.execute(
        """
        SELECT id, user_agent, ip, last_active_at, created_at
        FROM sessions
        WHERE user_id = %s AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY last_active_at DESC
        """,
        (user_id,),
    ).fetchall()
    out = []
    for r in rows:
        ua = r["user_agent"] or "Unknown"
        out.append(
            {
                "id": str(r["id"]),
                "device": ua[:80],
                "browser": ua[:40],
                "location": "Unknown",
                "ip": str(r["ip"]) if r["ip"] else "",
                "lastActiveAt": r["last_active_at"].isoformat(),
                "current": r["id"] == current_session_id,
            }
        )
    return out


@router.get("/account")
def get_account(user: AuthUser = Depends(get_current_user_readonly)):
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, email, role, status, display_name, totp_enabled, preferences,
                   created_at, last_login_at, recovery_codes_hash
            FROM users WHERE id = %s
            """,
            (user.id,),
        ).fetchone()
        mbx = conn.execute(
            "SELECT mailbox_id FROM mailbox_owners WHERE user_id = %s ORDER BY assigned_at LIMIT 1",
            (user.id,),
        ).fetchone()
        base = user_public(row, str(mbx["mailbox_id"]) if mbx else None)
        return {
            **base,
            "preferences": row["preferences"] if isinstance(row["preferences"], dict) else user.preferences,
            "recoveryCodesRemaining": len(row["recovery_codes_hash"] or []),
            "sessions": _sessions_list(conn, user.id, user.session_id),
        }


@router.patch("/account")
def update_account(payload: AccountUpdate, user: AuthUser = Depends(get_current_user)):
    with get_conn() as conn:
        if payload.displayName is not None:
            conn.execute(
                "UPDATE users SET display_name = %s WHERE id = %s",
                (payload.displayName, user.id),
            )
        if payload.preferences is not None:
            import json

            conn.execute(
                "UPDATE users SET preferences = %s::jsonb WHERE id = %s",
                (json.dumps(payload.preferences), user.id),
            )
        conn.commit()
    return get_account(user)


@router.post("/account/password", status_code=204)
def change_password(payload: ChangePasswordRequest, request: Request, user: AuthUser = Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = %s", (user.id,)).fetchone()
        if not verify_password(row["password_hash"], payload.currentPassword):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        conn.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(payload.newPassword), user.id),
        )
        write_audit(
            conn,
            action="password_changed",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role=user.role,
        )
        conn.commit()
    return None


@router.post("/account/sessions/revoke", status_code=204)
def revoke_sessions(user: AuthUser = Depends(get_current_user)):
    with get_conn() as conn:
        revoke_other_sessions(conn, user.id, user.session_id)
        write_audit(
            conn,
            action="session_revoked",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role=user.role,
            metadata={"sessions": "all_other"},
        )
        conn.commit()
    return None
