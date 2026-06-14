-- Add Business Elite tier fields to audits table
ALTER TABLE audits 
ADD COLUMN IF NOT EXISTS parent_audit_id UUID REFERENCES audits(id),
ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS remediation_roadmap JSONB,
ADD COLUMN IF NOT EXISTS competitor_audit_id UUID REFERENCES audits(id),
ADD COLUMN IF NOT EXISTS competitor_url TEXT,
ADD COLUMN IF NOT EXISTS has_competitor_benchmark BOOLEAN DEFAULT FALSE;

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_audits_parent_audit_id ON audits(parent_audit_id);
CREATE INDEX IF NOT EXISTS idx_audits_competitor_audit_id ON audits(competitor_audit_id);

-- Add comments
COMMENT ON COLUMN audits.parent_audit_id IS 'Links child audits to a parent multi-page audit';
COMMENT ON COLUMN audits.is_parent IS 'Indicates if this is a parent audit for multi-page crawling';
COMMENT ON COLUMN audits.total_pages IS 'Total number of pages in multi-page audit';
COMMENT ON COLUMN audits.remediation_roadmap IS 'AI-generated remediation roadmap with 5-step action plan';
COMMENT ON COLUMN audits.competitor_audit_id IS 'Links to competitor audit for benchmarking';
COMMENT ON COLUMN audits.competitor_url IS 'Competitor URL used for benchmarking';
COMMENT ON COLUMN audits.has_competitor_benchmark IS 'Flag indicating if competitor benchmark was performed';
