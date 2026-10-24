import ipaddress
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Response
from psycopg import Connection

from app.config import get_settings
from app.security.tokens import hash_token, new_token


def _safe_inet(ip: str | None) -> str | None:
    """Store only valid IPs; TestClient / unknown hosts become NULL."""
    if not ip:
        return None
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError:
        return None


def create_session(
    conn: Connection,
    *,
    user_id: UUID,
    user_agent: str | None,
    ip: str | None,
) -> tuple[str, str, UUID]:
    settings = get_settings()
    raw = new_token(32)
    csrf = new_token(24)
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours)
    row = conn.execute(
        """
        INSERT INTO sessions (user_id, token_hash, csrf_secret, expires_at, user_agent, ip)
        VALUES (%s, %s, %s, %s, %s, %s::inet)
        RETURNING id
        """,
        (user_id, hash_token(raw), csrf, expires, user_agent, _safe_inet(ip)),
    ).fetchone()
    return raw, csrf, row["id"]


def revoke_session(conn: Connection, session_id: UUID) -> None:
    conn.execute(
        "UPDATE sessions SET revoked_at = NOW() WHERE id = %s AND revoked_at IS NULL",
        (session_id,),
    )


def revoke_other_sessions(conn: Connection, user_id: UUID, keep_session_id: UUID) -> None:
    conn.execute(
        """
        UPDATE sessions SET revoked_at = NOW()
        WHERE user_id = %s AND id <> %s AND revoked_at IS NULL
        """,
        (user_id, keep_session_id),
    )


def set_session_cookies(response: Response, raw_token: str, csrf: str) -> None:
    settings = get_settings()
    max_age = settings.session_ttl_hours * 3600
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


def create_temp_token(conn: Connection, user_id: UUID, purpose: str = "login_2fa") -> str:
    settings = get_settings()
    raw = new_token(24)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.temp_token_ttl_minutes)
    conn.execute(
        """
        INSERT INTO auth_temp_tokens (token_hash, user_id, purpose, expires_at)
        VALUES (%s, %s, %s, %s)
        """,
        (hash_token(raw), user_id, purpose, expires),
    )
    return raw


def consume_temp_token(conn: Connection, raw: str, purpose: str = "login_2fa") -> dict[str, Any] | None:
    token_h = hash_token(raw)
    row = conn.execute(
        """
        SELECT t.user_id, u.email, u.role, u.status, u.display_name, u.totp_enabled,
               u.totp_secret_enc, u.recovery_codes_hash, u.preferences, u.created_at, u.last_login_at, u.id
        FROM auth_temp_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = %s AND t.purpose = %s AND t.expires_at > NOW()
        """,
        (token_h, purpose),
    ).fetchone()
    if not row:
        return None
    conn.execute("DELETE FROM auth_temp_tokens WHERE token_hash = %s", (token_h,))
    return row
