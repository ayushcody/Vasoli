-- Migration: Add Budget Intelligence
ALTER TABLE budgets
ADD COLUMN IF NOT EXISTS roll_unused_funds BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deduct_overspend BOOLEAN NOT NULL DEFAULT false;
