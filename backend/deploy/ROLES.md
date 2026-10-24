# PostgreSQL roles (migration vs runtime)

The app supports a **restricted runtime role** separate from the **migration role**.

- Migration / bootstrap: connect as `yoyknowmail_app` (your existing migration role).
- Long-running API (`yoyknowmail-app.service`): connect as `yoyknowmail_runtime` (create if missing).

Ingest (`yoyknowmail-api` on `:8000`) keeps its own credentials; do not change them.

## One-time setup (as postgres superuser)

```sql
-- Extensions (if not already present)
\i /opt/yoyknowmail-app/migrations/dba/0000_extensions.up.sql

-- Runtime role (password from secret store)
CREATE ROLE yoyknowmail_runtime LOGIN PASSWORD 'REPLACE_ME';
GRANT CONNECT ON DATABASE yoyknowmail TO yoyknowmail_runtime;
GRANT USAGE ON SCHEMA public TO yoyknowmail_runtime;

-- After migrate up --profile production as yoyknowmail_app:
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, sessions, auth_temp_tokens, mailbox_owners, message_states,
  invitations, audit_logs, schema_migrations
TO yoyknowmail_runtime;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO yoyknowmail_runtime;

-- Existing ingest tables: read for customer inbox; no DDL
GRANT SELECT ON mailboxes, messages TO yoyknowmail_runtime;

-- Optional: if you later add columns the app updates on ingest tables, grant UPDATE
-- only on those columns — not needed for current read-only inbox design.
```

## Migration role expectations (`yoyknowmail_app`)

Must be able to:

- `CREATE TABLE` / indexes for app tables (`users`, `sessions`, …)
- `REFERENCES` `mailboxes(id)` and `messages(id)` for FK columns
- `SELECT` on `mailboxes` / `messages` (preflight inspect)
- **Not** required: `CREATE EXTENSION` (DBA script handles that)

## Switching `.env`

1. Migrate with `DATABASE_URL=…yoyknowmail_app…`
2. Apply `GRANT`s above
3. Set service `DATABASE_URL=…yoyknowmail_runtime…`
4. `systemctl restart yoyknowmail-app`
