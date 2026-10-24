# DBA-only scripts (not auto-applied)

These files are **never** executed by `python -m app.migrate`.

| File | Who runs it | When |
|------|-------------|------|
| `0000_extensions.up.sql` | PostgreSQL superuser / owner | Once per database, **before** `migrate up --profile production` |

Reason: `CREATE EXTENSION` requires privileges that the migration role `yoyknowmail_app` usually does not have.
