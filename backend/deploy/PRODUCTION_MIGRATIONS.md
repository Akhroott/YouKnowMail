# Production migration checklist & rollback

**Do not run any SQL on production until this checklist is explicitly approved.**

This document covers only the **authenticated app API** schema additions.  
It does **not** modify Cloudflare routing, the Email Worker, R2, or `/opt/yoyknowmail/api.py` (`POST /inbound`).

## Safety rules

1. Use `--profile production` only (never apply `migrations/local/`).
2. Local baseline scripts that `DROP TABLE mailboxes/messages` must never run in production (runner blocks them).
3. Migrations are **additive**: new tables/indexes only. Existing `mailboxes` / `messages` rows, columns, and `delivery_id` uniqueness stay intact.
4. Example `DATABASE_URL` values in `.env.example` are **placeholders**. Use the real Vultr Postgres credentials from your secret store — do not assume they match the example.
5. Prefer a **staging clone** of `yoyknowmail` before touching production.

## Pre-flight (read-only)

### Extensions (superuser, once)

`yoyknowmail_app` usually cannot `CREATE EXTENSION`. Before migrate:

```bash
sudo -u postgres psql -d yoyknowmail -f /opt/yoyknowmail-app/migrations/dba/0000_extensions.up.sql
```

### Inspect / status (migration role)

On a machine with network access to Postgres (staging first):

```bash
cd /opt/yoyknowmail-app   # or local checkout with prod URL in env
export DATABASE_URL='postgresql://yoyknowmail_app:PASS@HOST:5432/yoyknowmail'  # real secrets
export APP_ENV=production

# inspect / status / verify are read-only (no schema_migrations create, no DDL/DML)
.venv/bin/python -m app.migrate inspect
.venv/bin/python -m app.migrate verify --profile production
.venv/bin/python -m app.migrate status --profile production
```

If `schema_migrations` is missing, `status` lists every version as **pending** (does not fail).

Confirm inspect output shows:

- `mailboxes` and `messages` **present**
- `delivery_id UNIQUE: True`
- `mailboxes.id` / `messages.id` types printed (BIGINT or UUID — runner maps FKs automatically)
- Extensions `citext` and `pgcrypto` installed (preflight fails otherwise)
- New app tables (`users`, `sessions`, …) **missing** before first apply

If `delivery_id` uniqueness is missing, **stop** and fix ingest schema first. Do not proceed.

## Migrations to apply (production)

Apply **only** these versions (in order), via the runner:

| Order | Version | File | Effect |
|------:|---------|------|--------|
| 1 | `0001_users_sessions` | `migrations/0001_users_sessions.up.sql` | `users`, `sessions`, `auth_temp_tokens` |
| 2 | `0002_mailbox_ownership` | `migrations/0002_mailbox_ownership.up.sql` | `mailbox_owners` (FK type auto-matched) |
| 3 | `0003_message_states` | `migrations/0003_message_states.up.sql` | `message_states` |
| 4 | `0004_invitations_audit` | `migrations/0004_invitations_audit.up.sql` | `invitations`, `audit_logs` |

**Do not apply via migrate runner:**

- anything under `migrations/local/` (including `0000_baseline_ingest_tables`)
- anything under `migrations/dba/` (superuser only, outside the runner)

Command:

```bash
.venv/bin/python -m app.migrate up --profile production
.venv/bin/python -m app.migrate verify --profile production
```

Post-check:

```sql
-- Read-only sanity
SELECT COUNT(*) FROM mailboxes;
SELECT COUNT(*) FROM messages;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'messages' AND indexdef ILIKE '%delivery_id%';
SELECT version, profile, applied_at FROM schema_migrations ORDER BY applied_at;
```

## Bootstrap admin (after migrations)

```bash
export BOOTSTRAP_ADMIN_PASSWORD='…'   # from secret store; never commit
.venv/bin/python -m app.bootstrap_admin --email admin@yoyknowmail.com
unset BOOTSTRAP_ADMIN_PASSWORD
```

## Files to deploy (application)

Deploy the **new** app alongside ingestion — do not overwrite `api.py`:

| Path | Purpose |
|------|---------|
| `backend/app/**` | FastAPI authenticated API |
| `backend/migrations/0001_*.sql` … `0004_*.sql` | Production additive migrations |
| `backend/migrations/local/**` | Ship for repo completeness; **do not run** on prod |
| `backend/requirements.txt` | Python deps |
| `backend/deploy/yoyknowmail-app.service` | systemd unit (port 8001) |
| `backend/deploy/nginx-app-locations.conf.snippet` | Nginx locations (not `/inbound`) |
| Frontend build / Vercel env | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_USE_MOCK=false` |

**Do not deploy over / replace:** `/opt/yoyknowmail/api.py`, ingest systemd unit, Worker, R2 bindings.

## Rollback plan

### A. Application rollback (preferred — no data loss)

1. Revert/remove Nginx locations for `/auth`, `/messages`, `/admin`, `/account`, `/mailbox`, `/mailboxes`, `/invitations`, `/app-health`.
2. `nginx -t && systemctl reload nginx`
3. `systemctl stop yoyknowmail-app`
4. Point frontend away from the new API (or disable the Vercel deploy)
5. Confirm ingest still works: `GET /health`, send a test message to `/inbound`

Existing email data in `mailboxes` / `messages` is untouched.

### B. Schema rollback (only if new tables are empty / unused)

Production `migrate down` is **disabled** by the runner. If you must remove additive tables after approval:

```sql
-- ONLY after explicit approval. Does NOT touch mailboxes/messages.
BEGIN;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS message_states;
DROP TABLE IF EXISTS mailbox_owners;
DROP TABLE IF EXISTS auth_temp_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DELETE FROM schema_migrations
 WHERE version IN (
   '0004_invitations_audit',
   '0003_message_states',
   '0002_mailbox_ownership',
   '0001_users_sessions'
 );
COMMIT;
```

**Never** `DROP TABLE mailboxes` or `DROP TABLE messages` on production.  
**Never** drop the `delivery_id` unique index.

## Approval gate

Stop here until you approve:

1. Staging `inspect` + `up --profile production` succeeded  
2. Inbound smoke test still green on staging  
3. Explicit go-ahead for production `DATABASE_URL` + migration apply
