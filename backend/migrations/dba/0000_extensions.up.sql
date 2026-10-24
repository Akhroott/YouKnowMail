-- ONE-TIME DBA / superuser step for production.
-- Not applied by `python -m app.migrate` (any profile).
-- Run as postgres (or another role with CREATE privilege on the database):
--
--   psql -d yoyknowmail -f migrations/dba/0000_extensions.up.sql
--
-- Then run app migrations as yoyknowmail_app:
--   python -m app.migrate up --profile production

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
