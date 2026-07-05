-- Add missing columns for proposal tracking and user API key storage
ALTER TABLE audits ADD COLUMN IF NOT EXISTS has_proposal boolean DEFAULT false;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS competitor_audit_id uuid;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS competitor_url text;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS has_competitor_benchmark boolean DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_api_key text;
