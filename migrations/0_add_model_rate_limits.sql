-- Add rate limit columns to ai_models table
ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS tpm_limit INTEGER,
ADD COLUMN IF NOT EXISTS rpm_limit INTEGER,
ADD COLUMN IF NOT EXISTS tpd_limit INTEGER;
