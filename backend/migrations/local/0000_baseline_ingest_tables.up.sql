-- Local/dev baseline that mirrors production ingest tables.
-- On production these tables already exist; CREATE IF NOT EXISTS is a no-op.
-- Verify column types with: SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('mailboxes','messages');

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS mailboxes (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    mailbox_id BIGINT NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    sender TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    raw_message TEXT,
    message_id TEXT,
    recipient TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_id UUID NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_delivery_id_uidx ON messages (delivery_id);
CREATE INDEX IF NOT EXISTS messages_mailbox_received_idx ON messages (mailbox_id, received_at DESC);
