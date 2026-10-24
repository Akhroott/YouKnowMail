# Backend API reference (read-only)

Copied from the deployed YoyKnowMail FastAPI app for frontend integration.

**Do not run or modify these files as a second backend.**  
The live service is `https://mail.yoyknowmail.com`. Ingestion (`POST /inbound`) is separate and must not be called from the browser.

| Path | Role |
|------|------|
| `schemas.py` | Request/response Pydantic models |
| `routers/auth.py` | Login, 2FA, logout, `/auth/me` (session cookies + CSRF) |
| `routers/account.py` | Customer account + password + session revoke |
| `routers/mailboxes.py` | Customer-owned mailbox list / primary |
| `routers/messages.py` | Inbox list/detail/patch/delete (folders + unread/starred) |
| `routers/admin.py` | Admin stats, mailboxes, customers, audit, invitations |
| `routers/invitations.py` | Public invite accept flow |
