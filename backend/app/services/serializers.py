from __future__ import annotations

import re
from email.utils import parseaddr
from typing import Any


OTP_PATTERNS = [
    re.compile(
        r"(?:verification|verify|security|authentication|login|one[- ]?time|otp|pass\s?code|access)\s*(?:code|number|pin)?\s*(?:is|:)\s*([0-9]{4,8})\b",
        re.I,
    ),
    re.compile(r"\b(?:code|pin)\s*(?:is|:)\s*([0-9]{4,8})\b", re.I),
]


def extract_otp(subject: str, body_text: str, body_html: str) -> str | None:
    plain = f"{subject}\n{body_text}\n{re.sub(r'<[^>]+>', ' ', body_html or '')}"
    for pattern in OTP_PATTERNS:
        m = pattern.search(plain)
        if m and _plausible(m.group(1)):
            return m.group(1)
    if re.search(r"\b(verification|verify|otp|one[- ]?time|security code)\b", plain, re.I):
        m = re.search(r"(?:^|\s)([0-9]{6})(?:\s|$)", plain)
        if m and _plausible(m.group(1)):
            return m.group(1)
    return None


def _plausible(code: str) -> bool:
    if not re.fullmatch(r"[0-9]{4,8}", code):
        return False
    if re.fullmatch(r"(19|20)\d{2}", code):
        return False
    if re.fullmatch(r"(\d)\1+", code):
        return False
    if code in {"123456", "000000", "1234"}:
        return False
    return True


def parse_address(raw: str | None) -> dict[str, str]:
    name, addr = parseaddr(raw or "")
    if not addr and raw:
        addr = raw.strip()
    return {"name": name or addr.split("@")[0] if addr else "", "address": addr or ""}


def split_email(address: str) -> tuple[str, str]:
    if "@" not in address:
        return address, ""
    user, domain = address.rsplit("@", 1)
    return user, domain


def user_public(row: dict[str, Any], mailbox_id: str | None = None) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": str(row["email"]),
        "displayName": row.get("display_name") or "",
        "status": row["status"],
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "lastLoginAt": row["last_login_at"].isoformat() if row.get("last_login_at") else None,
        "twoFactorEnabled": bool(row.get("totp_enabled")),
        "role": row["role"],
        "mailboxId": mailbox_id,
    }


def mailbox_public(row: dict[str, Any]) -> dict[str, Any]:
    address = row["address"]
    username, domain = split_email(address)
    is_active = bool(row.get("is_active", True))
    owner_id = row.get("user_id")
    if owner_id:
        ownership = "owned"
        status = "active" if is_active else "suspended"
    else:
        ownership = "unassigned"
        status = "active" if is_active else "suspended"
        if is_active and not owner_id:
            status = "unassigned"
    return {
        "id": str(row["id"]),
        "address": address,
        "username": username,
        "domain": domain,
        "customerId": str(owner_id) if owner_id else None,
        "customerName": row.get("customer_name"),
        "customerEmail": str(row["customer_email"]) if row.get("customer_email") else None,
        "status": status,
        "ownershipStatus": ownership,
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "lastLoginAt": row["last_login_at"].isoformat() if row.get("last_login_at") else None,
        "messageCount": int(row.get("message_count") or 0),
        "storageUsed": int(row.get("storage_used") or 0),
        "storageLimit": int(row.get("storage_limit") or 100_000_000),
    }


def message_public(row: dict[str, Any], include_body: bool = True) -> dict[str, Any]:
    subject = row.get("subject") or ""
    body_text = row.get("body_text") or ""
    body_html = row.get("body_html") or ""
    preview = (body_text or re.sub(r"<[^>]+>", " ", body_html))[:120].strip()
    folder = row.get("folder") or "inbox"
    is_starred = bool(row.get("is_starred"))
    payload = {
        "id": str(row["id"]),
        "mailboxId": str(row["mailbox_id"]),
        "folder": "starred" if is_starred and folder == "inbox" else folder,
        "from": parse_address(row.get("sender")),
        "to": parse_address(row.get("recipient")),
        "subject": subject,
        "preview": preview,
        "receivedAt": row["received_at"].isoformat() if row.get("received_at") else None,
        "isRead": bool(row.get("is_read")),
        "isStarred": is_starred,
        "hasAttachments": False,
        "attachments": [],
        "detectedCode": extract_otp(subject, body_text, body_html),
    }
    if include_body:
        payload["bodyText"] = body_text
        payload["bodyHtml"] = body_html
    else:
        payload["bodyText"] = ""
        payload["bodyHtml"] = ""
    return payload
