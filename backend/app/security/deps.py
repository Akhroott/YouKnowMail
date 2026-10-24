from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status

from app.config import get_settings
from app.db import get_conn
from app.security.tokens import hash_token


@dataclass
class AuthUser:
    id: UUID
    email: str
    role: str
    status: str
    display_name: str
    totp_enabled: bool
    preferences: dict[str, Any]
    session_id: UUID
    csrf_secret: str


def _parse_cookie(request: Request) -> str | None:
    settings = get_settings()
    return request.cookies.get(settings.session_cookie_name)


def require_csrf(request: Request, user: AuthUser) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    settings = get_settings()
    header = request.headers.get(settings.csrf_header_name)
    cookie = request.cookies.get(settings.csrf_cookie_name)
    if not header or not cookie or header != cookie or cookie != user.csrf_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")


def get_optional_user(request: Request) -> AuthUser | None:
    raw = _parse_cookie(request)
    if not raw:
        return None
    token_h = hash_token(raw)
    now = datetime.now(timezone.utc)
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT s.id AS session_id, s.csrf_secret, s.expires_at, s.revoked_at,
                   u.id, u.email, u.role, u.status, u.display_name, u.totp_enabled, u.preferences
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s
            """,
            (token_h,),
        ).fetchone()
        if not row:
            return None
        if row["revoked_at"] is not None or row["expires_at"] < now:
            return None
        if row["status"] == "suspended":
            return None
        conn.execute(
            "UPDATE sessions SET last_active_at = NOW() WHERE id = %s",
            (row["session_id"],),
        )
        conn.commit()
        prefs = row["preferences"] if isinstance(row["preferences"], dict) else {}
        return AuthUser(
            id=row["id"],
            email=str(row["email"]),
            role=row["role"],
            status=row["status"],
            display_name=row["display_name"] or "",
            totp_enabled=bool(row["totp_enabled"]),
            preferences=prefs,
            session_id=row["session_id"],
            csrf_secret=row["csrf_secret"],
        )


def get_current_user(request: Request) -> AuthUser:
    user = get_optional_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    require_csrf(request, user)
    return user


def get_current_user_readonly(request: Request) -> AuthUser:
    """Authenticated user without CSRF (safe for GET)."""
    user = get_optional_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if user.role not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def require_admin_readonly(user: AuthUser = Depends(get_current_user_readonly)) -> AuthUser:
    if user.role not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def require_owner(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner only",
        )
    return user


def require_owner_readonly(
    user: AuthUser = Depends(get_current_user_readonly),
) -> AuthUser:
    if user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner only",
        )
    return user
