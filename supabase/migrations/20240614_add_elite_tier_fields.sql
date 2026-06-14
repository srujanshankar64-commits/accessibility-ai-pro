-- Add Business Elite tier fields to audits table
ALTER TABLE audits 
ADD COLUMN IF NOT EXISTS parent_audit_id UUID REFERENCES audits(id),
ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS remediation_roadmap JSONB;

-- Create index for parent_audit_id lookups
CREATE INDEX IF NOT EXISTS idx_audits_parent_audit_id ON audits(parent_audit_id);

-- Add comment
COMMENT ON COLUMN audits.parent_audit_id IS 'Links child audits to a parent multi-page audit';
COMMENT ON COLUMN audits.is_parent IS 'Indicates if this is a parent audit for multi-page crawling';
COMMENT ON COLUMN audits.total_pages IS 'Total number of pages in multi-page audit';
COMMENT ON COLUMN audits.remediation_roadmap IS 'AI-generated remediation roadmap with 5-step action plan';
