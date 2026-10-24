# YoyKnowMail App API — Deployment

This service is **separate** from `/opt/yoyknowmail/api.py` (ingestion on `127.0.0.1:8000`).  
Do not replace or restart the inbound worker until Nginx routes are verified.

| Doc | Purpose |
|-----|---------|
| [ENV.md](./ENV.md) | Production environment variables |
| [ROLES.md](./ROLES.md) | Migration vs runtime PostgreSQL roles |
| [PRODUCTION_MIGRATIONS.md](./PRODUCTION_MIGRATIONS.md) | SQL checklist & rollback |
| [PACKAGING.md](./PACKAGING.md) | Build `yoyknowmail-backend.tar.gz` |
| `yoyknowmail-app.service` | systemd unit → `127.0.0.1:8001` |
| `nginx-app-locations.conf.snippet` | App locations (not `/inbound`) |

## Prerequisites

- Database `yoyknowmail` already used by ingestion
- Migration role `yoyknowmail_app` (DDL for app tables)
- Prefer runtime role `yoyknowmail_runtime` for the systemd service ([ROLES.md](./ROLES.md))
- Extensions `citext` + `pgcrypto` installed via `migrations/dba/0000_extensions.up.sql` (superuser, once)
- Read-only inspect first: `python -m app.migrate inspect --profile production`
- Confirm `delivery_id` uniqueness before applying anything

## Python version

| Environment | Notes |
|-------------|--------|
| Local (dev) | Python **3.14** verified with current pins |
| Vultr Ubuntu | Prefer **3.12+** from distro/`deadsnakes` if 3.14 is unavailable. Install with the **same** interpreter you put in the venv. |

## Install (Vultr)

```bash
sudo useradd --system --home /opt/yoyknowmail-app --shell /usr/sbin/nologin yoyknowmail || true
sudo mkdir -p /opt/yoyknowmail-app
# Extract tarball or rsync — NEVER overwrite /opt/yoyknowmail/api.py
sudo tar -xzf yoyknowmail-backend.tar.gz -C /opt/yoyknowmail-app --strip-components=1
cd /opt/yoyknowmail-app
python3 -m venv .venv
.venv/bin/pip install -r requirements-prod.txt
sudo cp .env.example .env
sudo nano .env   # see ENV.md — real secrets, APP_ENV=production, COOKIE_SECURE=true
sudo chown -R yoyknowmail:yoyknowmail /opt/yoyknowmail-app
sudo chmod 600 /opt/yoyknowmail-app/.env
```

## Migrations (approval required)

Never use `--profile local` on Vultr. Local `migrations/local/` contains DROP TABLE scripts for empty DBs only.

```bash
# 1) Superuser once (if extensions missing)
sudo -u postgres psql -d yoyknowmail -f /opt/yoyknowmail-app/migrations/dba/0000_extensions.up.sql

# 2) Read-only checks as yoyknowmail_app
cd /opt/yoyknowmail-app
export DATABASE_URL='postgresql://yoyknowmail_app:…@127.0.0.1:5432/yoyknowmail'
export APP_ENV=production
.venv/bin/python -m app.migrate inspect --profile production
.venv/bin/python -m app.migrate status --profile production
# WAIT FOR APPROVAL then:
.venv/bin/python -m app.migrate up --profile production
.venv/bin/python -m app.migrate verify --profile production
```

Production `up` applies **only** `0001`–`0004` (never `local/` or `dba/`).

## Bootstrap admin (once)

```bash
export BOOTSTRAP_ADMIN_PASSWORD='…'
.venv/bin/python -m app.bootstrap_admin --email admin@yoyknowmail.com
unset BOOTSTRAP_ADMIN_PASSWORD
```

Then switch systemd `DATABASE_URL` to `yoyknowmail_runtime` and apply grants ([ROLES.md](./ROLES.md)).

## Systemd (`yoyknowmail-app`)

Dedicated unit — **does not** replace `yoyknowmail-api`:

```bash
sudo cp deploy/yoyknowmail-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now yoyknowmail-app
curl -sS http://127.0.0.1:8001/app-health
# Confirm ingest still on 8000:
curl -sS http://127.0.0.1:8000/health
```

## Nginx

1. Keep existing upstream for ingestion (`/inbound`, `/health` → `:8000`).
2. Include `deploy/nginx-app-locations.conf.snippet` locations → `:8001`.
3. `sudo nginx -t && sudo systemctl reload nginx`

## Frontend (Vercel)

- `NEXT_PUBLIC_API_BASE_URL=https://mail.yoyknowmail.com`
- `NEXT_PUBLIC_USE_MOCK=false`
- Backend `FRONTEND_ORIGINS` must include the Vercel origin
- `COOKIE_SECURE=true`

## Health checks

| Check | Expect |
|-------|--------|
| `GET /app-health` on `:8001` | `{"ok":true}` |
| Existing `GET /health` on `:8000` | unchanged |
| Inbound email test | still stores message with unique `delivery_id` |

## Do not

- SSH/run production migrations without explicit approval
- Apply `migrations/local/*` or `migrations/dba/*` via the migrate runner
- Put secrets in git or `NEXT_PUBLIC_*`
- Proxy browser traffic to `/inbound`
- Merge this app into production `api.py` for v1
- Change or restart `yoyknowmail-api` as part of this deploy
