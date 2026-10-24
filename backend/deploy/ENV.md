# Production environment variables

Copy `.env.example` → `/opt/yoyknowmail-app/.env` on the server.  
Owned by the systemd user (`yoyknowmail`), mode `0600`. Never commit real values.

| Variable | Required | Production value / notes |
|----------|----------|--------------------------|
| `DATABASE_URL` | Yes | `postgresql://yoyknowmail_runtime:…@127.0.0.1:5432/yoyknowmail` for the long-running app. Use `yoyknowmail_app` only for one-shot `migrate` / `bootstrap_admin`. Must not contain `CHANGE_ME`. |
| `APP_ENV` | Yes | `production` (forces migrate to refuse non-production profile) |
| `FRONTEND_ORIGINS` | Yes | Comma-separated HTTPS origins (Vercel + custom domain), e.g. `https://mail.yoyknowmail.com,https://….vercel.app` |
| `COOKIE_SECURE` | Yes | `true` (HTTPS) |
| `COOKIE_SAMESITE` | Yes | `lax` (or `none` only if cross-site cookies are required + Secure) |
| `SESSION_TTL_HOURS` | No | Default `168` |
| `TEMP_TOKEN_TTL_MINUTES` | No | Default `10` (2FA / reset temp tokens) |
| `MAIL_DOMAIN` | Yes | `yoyknowmail.com` |
| `BULK_MAILBOX_LIMIT` | No | Default `100` |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | No | Default `10` |
| `TOTP_ENCRYPTION_KEY` | Recommended | Fernet key or stable secret material for at-rest TOTP obfuscation. Generate once; rotating invalidates stored secrets. |
| `SESSION_COOKIE_NAME` | No | Default `ykm_session` |
| `CSRF_COOKIE_NAME` | No | Default `ykm_csrf` |
| `CSRF_HEADER_NAME` | No | Default `X-CSRF-Token` |
| `BOOTSTRAP_ADMIN_PASSWORD` | CLI only | Set only for `python -m app.bootstrap_admin`; **unset** afterward. Do not put in the systemd `EnvironmentFile`. |

## Dual PostgreSQL roles

| Role | Used by | Privileges |
|------|---------|------------|
| `yoyknowmail_app` | Migration / bootstrap CLI | DDL on new app tables; `REFERENCES` / `SELECT` on existing `mailboxes`, `messages`; insert into `schema_migrations` |
| `yoyknowmail_runtime` | systemd `yoyknowmail-app` (`DATABASE_URL`) | DML on app tables; `SELECT` (and limited `UPDATE` if needed for ownership flags) on ingest tables — **no** `CREATE` / `DROP` / `ALTER` / `CREATE EXTENSION` |

See [ROLES.md](./ROLES.md) for example `GRANT` statements.
