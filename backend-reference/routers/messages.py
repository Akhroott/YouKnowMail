from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_conn
from app.schemas import MessageUpdate
from app.security.deps import AuthUser, get_current_user, get_current_user_readonly
from app.services.serializers import message_public

router = APIRouter(prefix="/messages", tags=["messages"])


def _owned_ids(conn, user_id) -> list[int]:
    rows = conn.execute(
        "SELECT mailbox_id FROM mailbox_owners WHERE user_id = %s",
        (user_id,),
    ).fetchall()
    return [int(r["mailbox_id"]) for r in rows]


def _ensure_state(conn, user_id, message_id):
    conn.execute(
        """
        INSERT INTO message_states (user_id, message_id)
        VALUES (%s, %s)
        ON CONFLICT (user_id, message_id) DO NOTHING
        """,
        (user_id, message_id),
    )


@router.get("")
def list_messages(
    folder: str = Query(default="inbox"),
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    mailboxId: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user_readonly),
):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customers only")

    with get_conn() as conn:
        owned = _owned_ids(conn, user.id)
        if not owned:
            return {"data": [], "total": 0, "page": page, "pageSize": pageSize, "totalPages": 1}
        if mailboxId:
            mid = int(mailboxId)
            if mid not in owned:
                raise HTTPException(status_code=404, detail="Mailbox not found")
            owned = [mid]

        where = ["m.mailbox_id = ANY(%s)"]
        params: list = [owned]

        # Default state: missing row => inbox unread
        if folder == "unread":
            where.append("COALESCE(s.is_read, FALSE) = FALSE")
            where.append("COALESCE(s.folder, 'inbox') = 'inbox'")
        elif folder == "starred":
            where.append("COALESCE(s.is_starred, FALSE) = TRUE")
            where.append("COALESCE(s.folder, 'inbox') <> 'trash'")
        elif folder in ("inbox", "archive", "trash"):
            where.append("COALESCE(s.folder, 'inbox') = %s")
            params.append(folder)
        else:
            where.append("COALESCE(s.folder, 'inbox') = 'inbox'")

        if search.strip():
            where.append("(m.subject ILIKE %s OR m.sender ILIKE %s)")
            q = f"%{search.strip()}%"
            params.extend([q, q])

        where_sql = " AND ".join(where)
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM messages m
            LEFT JOIN message_states s ON s.message_id = m.id AND s.user_id = %s
            WHERE {where_sql}
            """,
            [user.id, *params],
        ).fetchone()["c"]

        offset = (page - 1) * pageSize
        rows = conn.execute(
            f"""
            SELECT m.id, m.mailbox_id, m.sender, m.recipient, m.subject,
                   m.body_text, m.body_html, m.received_at,
                   COALESCE(s.is_read, FALSE) AS is_read,
                   COALESCE(s.is_starred, FALSE) AS is_starred,
                   COALESCE(s.folder, 'inbox') AS folder
            FROM messages m
            LEFT JOIN message_states s ON s.message_id = m.id AND s.user_id = %s
            WHERE {where_sql}
            ORDER BY m.received_at DESC
            LIMIT %s OFFSET %s
            """,
            [user.id, *params, pageSize, offset],
        ).fetchall()

        total_pages = max(1, (total + pageSize - 1) // pageSize)
        return {
            "data": [message_public(r, include_body=False) for r in rows],
            "total": total,
            "page": page,
            "pageSize": pageSize,
            "totalPages": total_pages,
        }


@router.get("/{message_id}")
def get_message(message_id: str, user: AuthUser = Depends(get_current_user_readonly)):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customers only")
    with get_conn() as conn:
        owned = _owned_ids(conn, user.id)
        row = conn.execute(
            """
            SELECT m.id, m.mailbox_id, m.sender, m.recipient, m.subject,
                   m.body_text, m.body_html, m.received_at,
                   COALESCE(s.is_read, FALSE) AS is_read,
                   COALESCE(s.is_starred, FALSE) AS is_starred,
                   COALESCE(s.folder, 'inbox') AS folder
            FROM messages m
            LEFT JOIN message_states s ON s.message_id = m.id AND s.user_id = %s
            WHERE m.id = %s AND m.mailbox_id = ANY(%s)
            """,
            (user.id, int(message_id), owned),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")
        return message_public(row, include_body=True)


@router.patch("/{message_id}")
def update_message(
    message_id: str,
    payload: MessageUpdate,
    user: AuthUser = Depends(get_current_user),
):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customers only")
    with get_conn() as conn:
        owned = _owned_ids(conn, user.id)
        exists = conn.execute(
            "SELECT id FROM messages WHERE id = %s AND mailbox_id = ANY(%s)",
            (int(message_id), owned),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Message not found")
        _ensure_state(conn, user.id, int(message_id))
        sets = []
        params: list = []
        if payload.isRead is not None:
            sets.append("is_read = %s")
            params.append(payload.isRead)
        if payload.isStarred is not None:
            sets.append("is_starred = %s")
            params.append(payload.isStarred)
        if payload.folder is not None:
            sets.append("folder = %s")
            params.append(payload.folder)
        if sets:
            sets.append("updated_at = NOW()")
            conn.execute(
                f"UPDATE message_states SET {', '.join(sets)} WHERE user_id = %s AND message_id = %s",
                [*params, user.id, int(message_id)],
            )
        conn.commit()
        row = conn.execute(
            """
            SELECT m.id, m.mailbox_id, m.sender, m.recipient, m.subject,
                   m.body_text, m.body_html, m.received_at,
                   COALESCE(s.is_read, FALSE) AS is_read,
                   COALESCE(s.is_starred, FALSE) AS is_starred,
                   COALESCE(s.folder, 'inbox') AS folder
            FROM messages m
            LEFT JOIN message_states s ON s.message_id = m.id AND s.user_id = %s
            WHERE m.id = %s
            """,
            (user.id, int(message_id)),
        ).fetchone()
        return message_public(row, include_body=True)


@router.delete("/{message_id}", status_code=204)
def delete_message(message_id: str, user: AuthUser = Depends(get_current_user)):
    """Soft-delete: move to trash. Second delete from trash keeps soft-deleted (retained)."""
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customers only")
    with get_conn() as conn:
        owned = _owned_ids(conn, user.id)
        exists = conn.execute(
            "SELECT id FROM messages WHERE id = %s AND mailbox_id = ANY(%s)",
            (int(message_id), owned),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Message not found")
        _ensure_state(conn, user.id, int(message_id))
        conn.execute(
            """
            UPDATE message_states
            SET folder = 'trash', is_read = TRUE, updated_at = NOW()
            WHERE user_id = %s AND message_id = %s
            """,
            (user.id, int(message_id)),
        )
        conn.commit()
    return None
