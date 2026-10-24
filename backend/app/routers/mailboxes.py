from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_conn
from app.security.deps import AuthUser, get_current_user_readonly
from app.services.serializers import mailbox_public

router = APIRouter(tags=["mailboxes"])

_BASE = """
    SELECT m.id, m.address, m.is_active, m.created_at,
           o.user_id, u.display_name AS customer_name, u.email AS customer_email,
           u.last_login_at,
           (SELECT COUNT(*) FROM messages msg WHERE msg.mailbox_id = m.id) AS message_count,
           0 AS storage_used, 100000000 AS storage_limit
    FROM mailboxes m
    JOIN mailbox_owners o ON o.mailbox_id = m.id
    JOIN users u ON u.id = o.user_id
    WHERE o.user_id = %s
"""


@router.get("/mailboxes")
def list_mailboxes(user: AuthUser = Depends(get_current_user_readonly)):
    if user.role != "customer":
        return {"data": []}
    with get_conn() as conn:
        rows = conn.execute(_BASE + " ORDER BY o.assigned_at", (user.id,)).fetchall()
        return {"data": [mailbox_public(r) for r in rows]}


@router.get("/mailbox")
def get_primary_mailbox(
    mailboxId: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user_readonly),
):
    if user.role != "customer":
        raise HTTPException(status_code=404, detail="Mailbox not found")
    with get_conn() as conn:
        if mailboxId:
            row = conn.execute(
                _BASE + " AND m.id = %s",
                (user.id, int(mailboxId)),
            ).fetchone()
        else:
            row = conn.execute(_BASE + " ORDER BY o.assigned_at LIMIT 1", (user.id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Mailbox not found")
        return mailbox_public(row)
