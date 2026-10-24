import ipaddress
from typing import Any
from uuid import UUID

from psycopg import Connection


def _safe_inet(ip: str | None) -> str | None:
    if not ip:
        return None
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError:
        return None


def write_audit(
    conn: Connection,
    *,
    action: str,
    actor_user_id: UUID | None = None,
    actor_email: str | None = None,
    actor_role: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    ip: str | None = None,
    success: bool = True,
) -> None:
    conn.execute(
        """
        INSERT INTO audit_logs (
            actor_user_id, actor_email, actor_role, action,
            target_type, target_id, metadata, ip, success
        ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::inet, %s)
        """,
        (
            actor_user_id,
            actor_email,
            actor_role,
            action,
            target_type,
            target_id,
            __import__("json").dumps(metadata or {}),
            _safe_inet(ip),
            success,
        ),
    )
