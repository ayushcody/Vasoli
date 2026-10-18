-- Additive contract fields finalized during pilot implementation.
ALTER TABLE import_commit_idempotency ADD COLUMN IF NOT EXISTS preview_token UUID NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_batches_user_file_hash ON import_batches(user_id,file_hash);
ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_user_id_file_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_preview_identity ON import_commit_idempotency(user_id,preview_token);
