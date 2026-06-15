-- Add indexes for Business Elite features
CREATE INDEX IF NOT EXISTS idx_audits_parent_audit_id ON audits(parent_audit_id);
CREATE INDEX IF NOT EXISTS idx_audits_competitor_audit_id ON audits(competitor_audit_id);
CREATE INDEX IF NOT EXISTS idx_audits_user_id_created_at ON audits(user_id, created_at DESC);
