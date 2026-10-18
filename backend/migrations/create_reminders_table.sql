CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    reminder_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    snoozed_until TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    linked_entity_type TEXT,
    linked_entity_id UUID,
    channel_email BOOLEAN DEFAULT false,
    channel_push BOOLEAN DEFAULT false,
    channel_in_app BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'SNOOZED', 'COMPLETED', 'DISMISSED')),
    CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('BILL_DUE', 'GOAL_CONTRIBUTION', 'RECEIPT_RETURN', 'WARRANTY_EXPIRY', 'REIMBURSEMENT', 'CUSTOM'))
);

CREATE INDEX idx_reminders_user_due_at ON reminders(user_id, due_at);
CREATE INDEX idx_reminders_user_status ON reminders(user_id, status);
CREATE INDEX idx_reminders_user_type ON reminders(user_id, reminder_type);
CREATE INDEX idx_reminders_linked_entity ON reminders(linked_entity_type, linked_entity_id);
