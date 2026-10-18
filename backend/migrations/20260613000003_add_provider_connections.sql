CREATE TABLE provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    connection_status TEXT NOT NULL DEFAULT 'PENDING',
    consent_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_provider_type CHECK (provider_type IN ('ACCOUNT_AGGREGATOR', 'BROKER', 'UPI', 'EMAIL')),
    CONSTRAINT valid_connection_status CHECK (connection_status IN ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX idx_provider_connections_user ON provider_connections(user_id);

ALTER TABLE financial_accounts
ADD COLUMN provider_connection_id UUID REFERENCES provider_connections(id) ON DELETE SET NULL;
