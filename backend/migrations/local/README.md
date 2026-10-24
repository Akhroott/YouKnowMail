# Local-only migrations

These scripts create empty `mailboxes` / `messages` tables for development when no ingest DB exists.

**Never apply this folder on production.** Production already has real `mailboxes` and `messages` data.

The migration runner only loads `migrations/local/` when:
- `APP_ENV` is `development`, `test`, or `local`, **and**
- you pass `--profile local` (or `up` defaults to local when `APP_ENV` is not `production`)

The local down script contains `DROP TABLE` and is blocked unless `--allow-drop-ingest` is set.
