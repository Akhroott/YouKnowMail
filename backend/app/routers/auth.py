import base64
import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.db import get_conn
from app.schemas import LoginRequest, LoginResponse, TwoFactorVerifyRequest
from app.security.deps import AuthUser, get_current_user, get_current_user_readonly, get_optional_user, require_csrf
from app.security.passwords import verify_password
from app.security.rate_limit import check_login_rate_limit, check_2fa_rate_limit
from app.security.tokens import new_token
from app.security.totp import (
    decrypt_secret,
    encrypt_secret,
    generate_secret,
    hash_recovery_code,
    provisioning_uri,
    verify_code,
)
from app.services.audit import write_audit
from app.services.serializers import user_public
from app.services.sessions import (
    clear_session_cookies,
    consume_temp_token,
    create_session,
    create_temp_token,
    revoke_session,
    set_session_cookies,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    # Trust the client address supplied by the local ASGI proxy layer,
    # not arbitrary X-Forwarded-For headers.
    return request.client.host if request.client else "unknown"


def _primary_mailbox_id(conn, user_id) -> str | None:
    row = conn.execute(
        "SELECT mailbox_id FROM mailbox_owners WHERE user_id = %s ORDER BY assigned_at LIMIT 1",
        (user_id,),
    ).fetchone()
    return str(row["mailbox_id"]) if row else None


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response):
    ip = _client_ip(request)
    if not check_login_rate_limit(ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts")

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, email, password_hash, role, status, display_name, totp_enabled,
                   preferences, created_at, last_login_at
            FROM users WHERE email = %s
            """,
            (payload.email.lower(),),
        ).fetchone()
        if not row or not verify_password(row["password_hash"], payload.password):
            write_audit(
                conn,
                action="login_failed",
                actor_email=payload.email.lower(),
                actor_role="customer",
                metadata={"reason": "invalid_credentials"},
                ip=ip,
                success=False,
            )
            conn.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        if row["status"] == "suspended":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

        if row["totp_enabled"]:
            temp = create_temp_token(conn, row["id"], "login_2fa")
            conn.commit()
            return LoginResponse(requires2FA=True, tempToken=temp)

        raw, csrf, _sid = create_session(
            conn,
            user_id=row["id"],
            user_agent=request.headers.get("user-agent"),
            ip=ip,
        )
        conn.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (row["id"],))
        write_audit(
            conn,
            action="login_success",
            actor_user_id=row["id"],
            actor_email=str(row["email"]),
            actor_role=row["role"],
            ip=ip,
        )
        conn.commit()
        set_session_cookies(response, raw, csrf)
        mbx = _primary_mailbox_id(conn, row["id"])
        return LoginResponse(requires2FA=False, user=user_public(row, mbx))


@router.post("/2fa/verify")
def verify_2fa(payload: TwoFactorVerifyRequest, request: Request, response: Response):
    """Login 2FA completion, or authenticated setup confirmation when setup=true."""
    ip = _client_ip(request)

    if not check_2fa_rate_limit(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many verification attempts",
        )

    if payload.setup:
        user = get_optional_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        require_csrf(request, user)
        with get_conn() as conn:
            row = conn.execute(
                "SELECT totp_secret_enc FROM users WHERE id = %s",
                (user.id,),
            ).fetchone()
            if not row or not row["totp_secret_enc"]:
                raise HTTPException(status_code=400, detail="Start 2FA setup first")
            secret = decrypt_secret(row["totp_secret_enc"])
            if not verify_code(secret, payload.code):
                raise HTTPException(status_code=400, detail="Invalid authenticator code")
            codes = [f"YKM-{new_token(4).upper()}" for _ in range(10)]
            hashes = [hash_recovery_code(c) for c in codes]
            conn.execute(
                "UPDATE users SET totp_enabled = TRUE, recovery_codes_hash = %s WHERE id = %s",
                (hashes, user.id),
            )
            write_audit(
                conn,
                action="2fa_enabled",
                actor_user_id=user.id,
                actor_email=user.email,
                actor_role=user.role,
                metadata={"method": "totp"},
                ip=ip,
            )
            conn.commit()
            return {"recoveryCodes": codes}

    with get_conn() as conn:
        row = consume_temp_token(conn, payload.tempToken, "login_2fa")
        if not row:
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

        ok = False
        if payload.method == "totp":
            if not row.get("totp_secret_enc"):
                raise HTTPException(status_code=400, detail="2FA not configured")
            secret = decrypt_secret(row["totp_secret_enc"])
            ok = verify_code(secret, payload.code)
        else:
            code_h = hash_recovery_code(payload.code)
            hashes = list(row.get("recovery_codes_hash") or [])
            if code_h in hashes:
                hashes.remove(code_h)
                conn.execute(
                    "UPDATE users SET recovery_codes_hash = %s WHERE id = %s",
                    (hashes, row["id"]),
                )
                ok = True

        if not ok:
            write_audit(
                conn,
                action="login_failed",
                actor_user_id=row["id"],
                actor_email=str(row["email"]),
                actor_role=row["role"],
                metadata={"reason": "invalid_2fa"},
                ip=ip,
                success=False,
            )
            conn.commit()
            raise HTTPException(status_code=401, detail="Invalid authentication code")

        raw, csrf, _sid = create_session(
            conn,
            user_id=row["id"],
            user_agent=request.headers.get("user-agent"),
            ip=ip,
        )
        conn.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (row["id"],))
        write_audit(
            conn,
            action="login_success",
            actor_user_id=row["id"],
            actor_email=str(row["email"]),
            actor_role=row["role"],
            metadata={"method": payload.method},
            ip=ip,
        )
        conn.commit()
        set_session_cookies(response, raw, csrf)
        mbx = _primary_mailbox_id(conn, row["id"])
        return {"user": user_public(row, mbx)}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    optional = get_optional_user(request)
    if optional:
        require_csrf(request, optional)
        with get_conn() as conn:
            revoke_session(conn, optional.session_id)
            write_audit(
                conn,
                action="logout",
                actor_user_id=optional.id,
                actor_email=optional.email,
                actor_role=optional.role,
                ip=_client_ip(request),
            )
            conn.commit()
    clear_session_cookies(response)
    response.status_code = 204
    return response


@router.get("/me")
def auth_me(user: AuthUser = Depends(get_current_user_readonly)):
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, email, role, status, display_name, totp_enabled, preferences, created_at, last_login_at
            FROM users WHERE id = %s
            """,
            (user.id,),
        ).fetchone()
        mbx = _primary_mailbox_id(conn, user.id)
        return user_public(row, mbx)


@router.post("/2fa/setup")
def setup_2fa(user: AuthUser = Depends(get_current_user)):
    if user.totp_enabled:
        raise HTTPException(
            status_code=409,
            detail="2FA is already enabled. Disable it through a verified recovery flow before reconfiguring.",
        )
    secret = generate_secret()
    uri = provisioning_uri(secret, user.email)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET totp_secret_enc = %s, totp_enabled = FALSE WHERE id = %s",
            (encrypt_secret(secret), user.id),
        )
        conn.commit()
    return {"secret": secret, "otpauthUrl": uri, "qrDataUrl": qr_data}
