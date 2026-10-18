CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    masked_account_number TEXT,
    balance_paise BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    is_manual BOOLEAN NOT NULL DEFAULT true,
    provider_name TEXT,
    provider_account_id TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_account_type CHECK (account_type IN ('CASH', 'SAVINGS', 'CURRENT', 'CREDIT_CARD', 'LOAN', 'BROKERAGE', 'MUTUAL_FUND', 'EPF', 'PPF', 'NPS', 'WALLET', 'OTHER'))
);

CREATE INDEX idx_financial_accounts_user ON financial_accounts(user_id);

CREATE TABLE liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
    liability_type TEXT NOT NULL,
    principal_paise BIGINT NOT NULL DEFAULT 0,
    outstanding_paise BIGINT NOT NULL DEFAULT 0,
    interest_rate_bps INTEGER,
    emi_paise BIGINT,
    due_day INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_liability_type CHECK (liability_type IN ('CREDIT_CARD', 'PERSONAL_LOAN', 'EDUCATION_LOAN', 'HOME_LOAN', 'VEHICLE_LOAN', 'BNPL', 'OTHER'))
);

CREATE INDEX idx_liabilities_user ON liabilities(user_id);
