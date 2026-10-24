-- DANGEROUS on production: do not run down on shared ingest DB.
-- Only for ephemeral local databases.
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS mailboxes CASCADE;
