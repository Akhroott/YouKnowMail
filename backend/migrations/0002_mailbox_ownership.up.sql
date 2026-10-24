-- Additive only. {{MAILBOX_PK}} is substituted by the migrate runner after
-- inspecting information_schema for mailboxes.id (never hard-code production PKs).

CREATE TABLE IF NOT EXISTS mailbox_owners (
    mailbox_id {{MAILBOX_PK}} NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (mailbox_id)
);

CREATE INDEX IF NOT EXISTS mailbox_owners_user_idx ON mailbox_owners (user_id);
