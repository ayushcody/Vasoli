-- Create achievements table
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create user_achievements table
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- Seed default achievements
INSERT INTO achievements (id, code, title, description, icon) VALUES
    (gen_random_uuid(), 'FIRST_IMPORT', 'First Statement Imported', 'You took the first step by importing a bank statement.', 'FileText'),
    (gen_random_uuid(), 'FIRST_RECEIPT', 'First Receipt Saved', 'You safely stored your first receipt in the vault.', 'Receipt'),
    (gen_random_uuid(), 'FIRST_GOAL', 'Goal Setter', 'You created your first financial goal.', 'Target'),
    (gen_random_uuid(), 'EMERGENCY_STARTER', 'Emergency Fund Starter', 'You set up a goal for an emergency fund. Smart move!', 'ShieldAlert'),
    (gen_random_uuid(), 'SUB_SPOTTER', 'Subscription Spotter', 'You identified and confirmed a recurring subscription rule.', 'TrendingUp'),
    (gen_random_uuid(), 'DEBT_FIGHTER', 'Debt Fighter', 'You confronted your liabilities by adding them to Vasoli.', 'HandCoins')
ON CONFLICT (code) DO NOTHING;
