-- Retain the reviewed statement discrepancy without retaining the statement file.
ALTER TABLE import_commit_idempotency ADD COLUMN IF NOT EXISTS reconciliation_difference_paise BIGINT;
