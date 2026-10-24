-- Additive only. {{MESSAGE_PK}} substituted from messages.id data type.

CREATE TABLE IF NOT EXISTS message_states (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id {{MESSAGE_PK}} NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    folder TEXT NOT NULL DEFAULT 'inbox'
        CHECK (folder IN ('inbox', 'archive', 'trash')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS message_states_user_folder_idx
    ON message_states (user_id, folder, updated_at DESC);
CREATE INDEX IF NOT EXISTS message_states_message_idx ON message_states (message_id);
