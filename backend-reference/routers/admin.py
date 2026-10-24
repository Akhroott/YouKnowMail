import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_settings
from app.db import get_conn
from app.schemas import (
    BulkMailboxRequest,
    CreateCustomerRequest,
    CreateInvitationRequest,
    CreateMailboxRequest,
    UpdateCustomerStatusRequest,
    UpdateMailboxRequest,
)
from app.security.deps import AuthUser, require_admin, require_admin_readonly
from app.security.passwords import hash_password
from app.security.tokens import hash_token, new_token
from app.services.audit import write_audit
from app.services.serializers import mailbox_public, user_public

router = APIRouter(prefix="/admin", tags=["admin"])

USERNAME_RE = re.compile(r"^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$")


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.get("/stats")
def stats(user: AuthUser = Depends(require_admin_readonly)):
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM mailboxes").fetchone()["c"]
        active = conn.execute(
            "SELECT COUNT(*) AS c FROM mailboxes WHERE is_active = TRUE"
        ).fetchone()["c"]
        suspended = conn.execute(
            "SELECT COUNT(*) AS c FROM mailboxes WHERE is_active = FALSE"
        ).fetchone()["c"]
        created_today = conn.execute(
            "SELECT COUNT(*) AS c FROM mailboxes WHERE created_at::date = CURRENT_DATE"
        ).fetchone()["c"]
        messages_today = conn.execute(
            "SELECT COUNT(*) AS c FROM messages WHERE received_at::date = CURRENT_DATE"
        ).fetchone()["c"]
        growth = conn.execute(
            """
            SELECT d::date AS date, COUNT(m.id) AS count
            FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
            LEFT JOIN mailboxes m ON m.created_at::date <= d::date
            GROUP BY d ORDER BY d
            """
        ).fetchall()
        volume = conn.execute(
            """
            SELECT d::date AS date, COUNT(msg.id) AS count
            FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
            LEFT JOIN messages msg ON msg.received_at::date = d::date
            GROUP BY d ORDER BY d
            """
        ).fetchall()
        recent = conn.execute(
            """
            SELECT id, action, actor_email, actor_role, target_id AS target,
                   metadata, ip, created_at, success
            FROM audit_logs ORDER BY created_at DESC LIMIT 6
            """
        ).fetchall()
        return {
            "totalMailboxes": total,
            "activeMailboxes": active,
            "suspendedMailboxes": suspended,
            "mailboxesCreatedToday": created_today,
            "messagesToday": messages_today,
            "storageUsed": 0,
            "storageLimit": 10_000_000_000,
            "mailboxGrowth": [
                {"date": r["date"].isoformat(), "count": int(r["count"])} for r in growth
            ],
            "inboundVolume": [
                {"date": r["date"].isoformat(), "count": int(r["count"])} for r in volume
            ],
            "recentActivity": [
                {
                    "id": str(r["id"]),
                    "action": r["action"],
                    "actor": r["actor_email"] or "",
                    "actorRole": r["actor_role"] or "system",
                    "target": r["target"],
                    "metadata": r["metadata"] if isinstance(r["metadata"], dict) else {},
                    "ip": str(r["ip"]) if r["ip"] else None,
                    "createdAt": r["created_at"].isoformat(),
                    "success": r["success"],
                }
                for r in recent
            ],
        }


@router.get("/mailboxes")
def list_mailboxes(
    search: str = "",
    status: str = "all",
    page: int = 1,
    pageSize: int = 20,
    user: AuthUser = Depends(require_admin_readonly),
):
    with get_conn() as conn:
        where = ["TRUE"]
        params: list = []
        if status == "active":
            where.append("m.is_active = TRUE AND o.user_id IS NOT NULL")
        elif status == "suspended":
            where.append("m.is_active = FALSE")
        elif status == "unassigned":
            where.append("o.user_id IS NULL AND m.is_active = TRUE")
        if search.strip():
            where.append("(m.address ILIKE %s OR u.email ILIKE %s OR u.display_name ILIKE %s)")
            q = f"%{search.strip()}%"
            params.extend([q, q, q])
        where_sql = " AND ".join(where)
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS c FROM mailboxes m
            LEFT JOIN mailbox_owners o ON o.mailbox_id = m.id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE {where_sql}
            """,
            params,
        ).fetchone()["c"]
        rows = conn.execute(
            f"""
            SELECT m.id, m.address, m.is_active, m.created_at,
                   o.user_id, u.display_name AS customer_name, u.email AS customer_email,
                   u.last_login_at,
                   (SELECT COUNT(*) FROM messages msg WHERE msg.mailbox_id = m.id) AS message_count,
                   0 AS storage_used, 100000000 AS storage_limit
            FROM mailboxes m
            LEFT JOIN mailbox_owners o ON o.mailbox_id = m.id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE {where_sql}
            ORDER BY m.created_at DESC
            LIMIT %s OFFSET %s
            """,
            [*params, pageSize, (page - 1) * pageSize],
        ).fetchall()
        return {
            "data": [mailbox_public(r) for r in rows],
            "total": total,
            "page": page,
            "pageSize": pageSize,
            "totalPages": max(1, (total + pageSize - 1) // pageSize),
        }


@router.post("/mailboxes")
def create_mailbox(
    payload: CreateMailboxRequest,
    request: Request,
    user: AuthUser = Depends(require_admin),
):
    settings = get_settings()
    username = payload.username.lower().strip()
    domain = payload.domain.lower().strip() or settings.mail_domain
    if domain != settings.mail_domain:
        raise HTTPException(status_code=400, detail=f"Domain must be {settings.mail_domain}")
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Invalid username")
    address = f"{username}@{domain}"
    with get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM mailboxes WHERE address = %s", (address,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Mailbox address already exists")
        row = conn.execute(
            """
            INSERT INTO mailboxes (address, is_active)
            VALUES (%s, TRUE) RETURNING id, address, is_active, created_at
            """,
            (address,),
        ).fetchone()
        customer_id = payload.customerId
        if customer_id:
            conn.execute(
                """
                INSERT INTO mailbox_owners (mailbox_id, user_id, assigned_by)
                VALUES (%s, %s, %s)
                ON CONFLICT (mailbox_id) DO UPDATE SET user_id = EXCLUDED.user_id, assigned_by = EXCLUDED.assigned_by
                """,
                (row["id"], customer_id, user.id),
            )
        write_audit(
            conn,
            action="mailbox_created",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role="admin",
            target_type="mailbox",
            target_id=address,
            metadata={"domain": domain},
            ip=_ip(request),
        )
        conn.commit()
        full = conn.execute(
            """
            SELECT m.id, m.address, m.is_active, m.created_at,
                   o.user_id, u.display_name AS customer_name, u.email AS customer_email,
                   u.last_login_at, 0 AS message_count, 0 AS storage_used, 100000000 AS storage_limit
            FROM mailboxes m
            LEFT JOIN mailbox_owners o ON o.mailbox_id = m.id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE m.id = %s
            """,
            (row["id"],),
        ).fetchone()
        return mailbox_public(full)


@router.post("/mailboxes/bulk")
def bulk_create(payload: BulkMailboxRequest, request: Request, user: AuthUser = Depends(require_admin)):
    settings = get_settings()
    if payload.count > settings.bulk_mailbox_limit:
        raise HTTPException(status_code=400, detail=f"Max {settings.bulk_mailbox_limit} per request")
    domain = payload.domain.lower().strip() or settings.mail_domain
    if domain != settings.mail_domain:
        raise HTTPException(status_code=400, detail=f"Domain must be {settings.mail_domain}")
    prefix = payload.prefix.lower().strip()
    if not re.fullmatch(r"[a-z0-9-]+", prefix):
        raise HTTPException(status_code=400, detail="Invalid prefix")

    created = []
    skipped = []
    with get_conn() as conn:
        for i in range(payload.count):
            if payload.useRandom:
                username = f"{prefix}{secrets.token_hex(3)}"
            else:
                username = f"{prefix}{str(i + 1).zfill(3)}"
            address = f"{username}@{domain}"
            exists = conn.execute("SELECT 1 FROM mailboxes WHERE address = %s", (address,)).fetchone()
            if exists:
                skipped.append(address)
                continue
            row = conn.execute(
                "INSERT INTO mailboxes (address, is_active) VALUES (%s, TRUE) RETURNING id, address, is_active, created_at",
                (address,),
            ).fetchone()
            created.append(
                mailbox_public(
                    {
                        **row,
                        "user_id": None,
                        "customer_name": None,
                        "customer_email": None,
                        "last_login_at": None,
                        "message_count": 0,
                        "storage_used": 0,
                        "storage_limit": 100_000_000,
                    }
                )
            )
        write_audit(
            conn,
            action="mailbox_created",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role="admin",
            target_type="mailbox",
            target_id=f"bulk:{len(created)}",
            metadata={"skipped": len(skipped)},
            ip=_ip(request),
        )
        conn.commit()
    return {"created": created, "skipped": skipped, "progress": 100}


@router.patch("/mailboxes/{mailbox_id}")
def update_mailbox(
    mailbox_id: str,
    payload: UpdateMailboxRequest,
    request: Request,
    user: AuthUser = Depends(require_admin),
):
    with get_conn() as conn:
        mbx = conn.execute("SELECT * FROM mailboxes WHERE id = %s", (int(mailbox_id),)).fetchone()
        if not mbx:
            raise HTTPException(status_code=404, detail="Mailbox not found")
        if payload.status == "suspended" or payload.is_active is False:
            conn.execute("UPDATE mailboxes SET is_active = FALSE WHERE id = %s", (int(mailbox_id),))
            write_audit(
                conn,
                action="mailbox_suspended",
                actor_user_id=user.id,
                actor_email=user.email,
                actor_role="admin",
                target_id=mbx["address"],
                ip=_ip(request),
            )
        if payload.status in ("active", "unassigned") or payload.is_active is True:
            conn.execute("UPDATE mailboxes SET is_active = TRUE WHERE id = %s", (int(mailbox_id),))
            write_audit(
                conn,
                action="mailbox_reactivated",
                actor_user_id=user.id,
                actor_email=user.email,
                actor_role="admin",
                target_id=mbx["address"],
                ip=_ip(request),
            )
        if payload.customerId is not None:
            if payload.customerId == "" or payload.customerId == "null":
                conn.execute("DELETE FROM mailbox_owners WHERE mailbox_id = %s", (int(mailbox_id),))
            else:
                conn.execute(
                    """
                    INSERT INTO mailbox_owners (mailbox_id, user_id, assigned_by)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (mailbox_id) DO UPDATE
                    SET user_id = EXCLUDED.user_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
                    """,
                    (int(mailbox_id), payload.customerId, user.id),
                )
                write_audit(
                    conn,
                    action="ownership_transfer",
                    actor_user_id=user.id,
                    actor_email=user.email,
                    actor_role="admin",
                    target_id=mbx["address"],
                    metadata={"to": payload.customerId},
                    ip=_ip(request),
                )
        conn.commit()
        full = conn.execute(
            """
            SELECT m.id, m.address, m.is_active, m.created_at,
                   o.user_id, u.display_name AS customer_name, u.email AS customer_email,
                   u.last_login_at,
                   (SELECT COUNT(*) FROM messages msg WHERE msg.mailbox_id = m.id) AS message_count,
                   0 AS storage_used, 100000000 AS storage_limit
            FROM mailboxes m
            LEFT JOIN mailbox_owners o ON o.mailbox_id = m.id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE m.id = %s
            """,
            (int(mailbox_id),),
        ).fetchone()
        return mailbox_public(full)


@router.delete("/mailboxes/{mailbox_id}", status_code=204)
def delete_mailbox(mailbox_id: str, request: Request, user: AuthUser = Depends(require_admin)):
    with get_conn() as conn:
        mbx = conn.execute("SELECT address FROM mailboxes WHERE id = %s", (int(mailbox_id),)).fetchone()
        if not mbx:
            raise HTTPException(status_code=404, detail="Mailbox not found")
        # Soft-deactivate instead of hard-delete to protect ingest history
        conn.execute("UPDATE mailboxes SET is_active = FALSE WHERE id = %s", (int(mailbox_id),))
        conn.execute("DELETE FROM mailbox_owners WHERE mailbox_id = %s", (int(mailbox_id),))
        write_audit(
            conn,
            action="mailbox_deleted",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role="admin",
            target_id=mbx["address"],
            metadata={"mode": "deactivate"},
            ip=_ip(request),
        )
        conn.commit()
    return None


@router.get("/customers")
def list_customers(
    search: str = "",
    page: int = 1,
    pageSize: int = 20,
    user: AuthUser = Depends(require_admin_readonly),
):
    with get_conn() as conn:
        where = ["role = 'customer'"]
        params: list = []
        if search.strip():
            where.append("(email ILIKE %s OR display_name ILIKE %s)")
            q = f"%{search.strip()}%"
            params.extend([q, q])
        where_sql = " AND ".join(where)
        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM users WHERE {where_sql}", params
        ).fetchone()["c"]
        rows = conn.execute(
            f"""
            SELECT u.*, (
              SELECT o.mailbox_id FROM mailbox_owners o WHERE o.user_id = u.id ORDER BY o.assigned_at LIMIT 1
            ) AS mailbox_id
            FROM users u WHERE {where_sql}
            ORDER BY u.created_at DESC
            LIMIT %s OFFSET %s
            """,
            [*params, pageSize, (page - 1) * pageSize],
        ).fetchall()
        data = []
        for r in rows:
            base = user_public(r, str(r["mailbox_id"]) if r.get("mailbox_id") else None)
            data.append(
                {
                    **base,
                    "preferences": r["preferences"] if isinstance(r["preferences"], dict) else {},
                    "recoveryCodesRemaining": len(r.get("recovery_codes_hash") or []),
                    "sessions": [],
                }
            )
        return {
            "data": data,
            "total": total,
            "page": page,
            "pageSize": pageSize,
            "totalPages": max(1, (total + pageSize - 1) // pageSize),
        }


@router.post("/customers")
def create_customer(payload: CreateCustomerRequest, request: Request, user: AuthUser = Depends(require_admin)):
    settings = get_settings()
    password = payload.password or new_token(12)
    with get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM users WHERE email = %s", (payload.email.lower(),)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Customer already exists")
        row = conn.execute(
            """
            INSERT INTO users (email, password_hash, role, status, display_name)
            VALUES (%s, %s, 'customer', 'pending', %s)
            RETURNING id, email, role, status, display_name, totp_enabled, preferences, created_at, last_login_at
            """,
            (payload.email.lower(), hash_password(password), payload.displayName or ""),
        ).fetchone()
        write_audit(
            conn,
            action="invitation_created" if payload.sendInvitation else "customer_reactivated",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role="admin",
            target_id=str(row["email"]),
            ip=_ip(request),
        )
        conn.commit()
        return {
            **user_public(row, None),
            "preferences": row["preferences"] if isinstance(row["preferences"], dict) else {},
            "recoveryCodesRemaining": 0,
            "sessions": [],
            "temporaryPasswordIssued": payload.password is None,
        }


@router.patch("/customers/{customer_id}")
def update_customer(
    customer_id: str,
    payload: UpdateCustomerStatusRequest,
    request: Request,
    user: AuthUser = Depends(require_admin),
):
    with get_conn() as conn:
        row = conn.execute(
            "UPDATE users SET status = %s WHERE id = %s AND role = 'customer' RETURNING *",
            (payload.status, customer_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")
        action = "customer_suspended" if payload.status == "suspended" else "customer_reactivated"
        write_audit(
            conn,
            action=action,
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role="admin",
            target_id=str(row["email"]),
            ip=_ip(request),
        )
        if payload.status == "suspended":
            conn.execute(
                "UPDATE sessions SET revoked_at = NOW() WHERE user_id = %s AND revoked_at IS NULL",
                (customer_id,),
            )
        conn.commit()
        return {
            **user_public(row, None),
            "preferences": row["preferences"] if isinstance(row["preferences"], dict) else {},
            "recoveryCodesRemaining": len(row.get("recovery_codes_hash") or []),
            "sessions": [],
        }


@router.get("/audit-logs")
def audit_logs(
    search: str = "",
    page: int = 1,
    pageSize: int = 25,
    user: AuthUser = Depends(require_admin_readonly),
):
    with get_conn() as conn:
        where = ["TRUE"]
        params: list = []
        if search.strip():
            where.append("(action ILIKE %s OR actor_email ILIKE %s OR target_id ILIKE %s)")
            q = f"%{search.strip()}%"
            params.extend([q, q, q])
        where_sql = " AND ".join(where)
        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM audit_logs WHERE {where_sql}", params
        ).fetchone()["c"]
        rows = conn.execute(
            f"""
            SELECT * FROM audit_logs WHERE {where_sql}
            ORDER BY created_at DESC LIMIT %s OFFSET %s
            """,
            [*params, pageSize, (page - 1) * pageSize],
        ).fetchall()
        data = []
        for r in rows:
            meta = r["metadata"] if isinstance(r["metadata"], dict) else {}
            # Never leak sensitive keys
            meta = {k: v for k, v in meta.items() if not re.search(r"password|secret|token|code|body|otp|recovery", k, re.I)}
            data.append(
                {
                    "id": str(r["id"]),
                    "action": r["action"],
                    "actor": r["actor_email"] or "",
                    "actorRole": r["actor_role"] or "system",
                    "target": r["target_id"],
                    "metadata": meta,
                    "ip": str(r["ip"]) if r["ip"] else None,
                    "createdAt": r["created_at"].isoformat(),
                    "success": r["success"],
                }
            )
        return {
            "data": data,
            "total": total,
            "page": page,
            "pageSize": pageSize,
            "totalPages": max(1, (total + pageSize - 1) // pageSize),
        }


@router.post("/invitations")
def create_invitation(
    payload: CreateInvitationRequest,
    request: Request,
    user: AuthUser = Depends(require_admin),
):
    settings = get_settings()
    raw = new_token(24)
    with get_conn() as conn:
        mbx = conn.execute(
            "SELECT id, address FROM mailboxes WHERE id = %s",
            (int(payload.mailboxId),),
        ).fetchone()
        if not mbx:
            raise HTTPException(status_code=404, detail="Mailbox not found")
        cust = conn.execute(
            "SELECT id, email FROM users WHERE email = %s AND role = 'customer'",
            (payload.customerEmail.lower(),),
        ).fetchone()
        if not cust:
            # create pending customer shell
            cust = conn.execute(
                """
                INSERT INTO users (email, password_hash, role, status, display_name)
                VALUES (%s, %s, 'customer', 'pending', %s)
                RETURNING id, email
                """,
                (payload.customerEmail.lower(), hash_password(new_token(16)), ""),
            ).fetchone()
        expires = datetime.now(timezone.utc).replace(microsecond=0)
        from datetime import timedelta

        expires = expires + timedelta(days=7)
        row = conn.execute(
            """
            INSERT INTO invitations (
                token_hash, user_id, mailbox_id, customer_email, mailbox_address,
                status, expires_at, created_by
            ) VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s)
            RETURNING *
            """,
            (
                hash_token(raw),
                cust["id"],
                mbx["id"],
                str(cust["email"]),
                mbx["address"],
                expires,
                user.id,
            ),
        ).fetchone()
        conn.execute(
            """
            INSERT INTO mailbox_owners (mailbox_id, user_id, assigned_by)
            VALUES (%s, %s, %s)
            ON CONFLICT (mailbox_id) DO UPDATE
            SET user_id = EXCLUDED.user_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
            """,
            (mbx["id"], cust["id"], user.id),
        )
        write_audit(
            conn,
            action="invitation_created",
            actor_user_id=user.id,
            actor_email=user.email,
            actor_role="admin",
            target_id=mbx["address"],
            metadata={"customer": str(cust["email"])},
            ip=_ip(request),
        )
        conn.commit()
        return {
            "id": str(row["id"]),
            "token": raw,
            "mailboxId": str(mbx["id"]),
            "mailboxAddress": mbx["address"],
            "customerEmail": str(cust["email"]),
            "status": "pending",
            "createdAt": row["created_at"].isoformat(),
            "expiresAt": row["expires_at"].isoformat(),
            "acceptedAt": None,
            "inviteUrl": f"{settings.origins[0].rstrip('/')}/invite/{raw}",
        }
