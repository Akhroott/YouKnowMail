# YoyKnowMail

**Private, receive-only email for verification codes and account security messages.**

Live product: [yoyknowmail.com](https://yoyknowmail.com)

YoyKnowMail (also known as **YoyKnow Mail** / **YoyKnow**) gives each user exactly one private mailbox. Customers can receive mail and read OTPs securely — they cannot send mail. Staff (admin / owner) provision accounts through a unified admin console.

> GitHub repository: [Akhroott/YouKnowMail](https://github.com/Akhroott/YouKnowMail)

---

## Features

- **One account = one mailbox** — no shared inboxes
- **Receive-only** — inbound verification and security mail only
- **Roles** — `customer`, `admin`, and `owner` with clear permission boundaries
- **Unified account creation** — single and bulk create (login + mailbox together)
- **Owner-protected accounts** — accounts created by an owner cannot be managed by admins
- **Sandboxed HTML reader** — email templates render with images; scripts stay blocked
- **Session security** — HttpOnly cookies + CSRF double-submit
- **2FA (TOTP)** — supported on the authenticated API

---

## Architecture

| Layer | Role |
|--------|------|
| **Next.js UI** | Customer inbox, settings, admin/owner console |
| **FastAPI app** (`backend/`) | Auth, accounts, messages, admin APIs (port 8001) |
| **Ingest pipeline** | Cloudflare Email Routing → Worker → R2 → existing `POST /inbound` (separate service) |
| **PostgreSQL** | Shared database for users, sessions, ownership, and messages |

The authenticated app **does not** replace inbound ingestion. Do not call `POST /inbound` from the browser.

```
Browser ──► Next.js (yoyknowmail.com)
                │
                └──► FastAPI app API (mail.yoyknowmail.com)
                           │
                           └──► PostgreSQL

Internet mail ──► Cloudflare ──► Ingest API ──► PostgreSQL (messages)
```

---

## Repository layout

```
├── src/                  # Next.js App Router UI
├── backend/              # Authenticated FastAPI application
├── backend-reference/    # API contract / schema reference for the UI
├── backend/deploy/       # systemd, Nginx, migration, and rollback docs
└── .env.example          # Frontend env template (no secrets)
```

---

## Tech stack

**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query, Zod, React Hook Form  

**Backend:** FastAPI, PostgreSQL, Argon2id passwords, session cookies, CSRF, optional TOTP

---

## Quick start — frontend

```bash
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL to your API, e.g. https://mail.yoyknowmail.com
npm run dev
```

Same-origin cookie proxy (optional):

```env
NEXT_PUBLIC_API_BASE_URL=/api/backend
API_PROXY_TARGET=https://mail.yoyknowmail.com
```

---

## Quick start — backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit DATABASE_URL and other settings

# Local profile only — never use local migrate profile on production ingest DB
python -m app.migrate inspect --profile local
python -m app.migrate up --profile local
python -m app.migrate verify --profile local

# First owner/admin bootstrap (use a strong password)
# Windows: set BOOTSTRAP_ADMIN_PASSWORD=...
# Unix:    export BOOTSTRAP_ADMIN_PASSWORD=...
python -m app.bootstrap_admin --email admin@yoyknowmail.com

uvicorn app.main:app --reload --port 8001
```

Health check: `GET http://127.0.0.1:8001/app-health`

---

## Roles & permissions (summary)

| Action | Customer | Admin | Owner |
|--------|----------|-------|-------|
| Own inbox | ✓ | ✓ | ✓ |
| Create accounts | — | ✓ | ✓ |
| Suspend admin-created customers | — | ✓ | ✓ |
| Manage owner-created customers | — | — | ✓ |
| Promote / demote roles | — | — | ✓ |

---

## Security

- Passwords hashed with Argon2id
- HttpOnly session cookie + `X-CSRF-Token` on mutating requests
- HTML email sanitized and rendered in a sandboxed iframe
- Admin APIs never return message bodies or password hashes
- Never put database credentials or ingestion secrets in `NEXT_PUBLIC_*` variables
- Do not commit `.env`, dumps, or backup archives

---

## Production deploy

Operational runbooks live under [`backend/deploy/`](backend/deploy/):

- [`README.md`](backend/deploy/README.md) — systemd, Nginx, rollback
- [`PRODUCTION_MIGRATIONS.md`](backend/deploy/PRODUCTION_MIGRATIONS.md) — migration safety
- [`ENV.md`](backend/deploy/ENV.md) — environment variables
- [`ROLES.md`](backend/deploy/ROLES.md) — role model

Apply production migrations only with explicit approval and backups.

---

## API contract

Frontend integration types and router shapes are documented in [`backend-reference/`](backend-reference/). The live authenticated app exposes OpenAPI when enabled in that environment.

---

## Contributing

1. Fork or branch from `main` / `master`
2. Keep secrets out of commits (`.env*` is gitignored)
3. Run frontend checks: `npx tsc --noEmit` and `npm run lint`
4. Run backend unit tests where applicable: `cd backend && pytest`

---

## License

All rights reserved unless a license file is added to this repository. Contact the maintainer before commercial reuse.

---

## Links

- Website: [https://yoyknowmail.com](https://yoyknowmail.com)
- Sign in: [https://yoyknowmail.com/login](https://yoyknowmail.com/login)
- Repository: [https://github.com/Akhroott/YouKnowMail](https://github.com/Akhroott/YouKnowMail)
