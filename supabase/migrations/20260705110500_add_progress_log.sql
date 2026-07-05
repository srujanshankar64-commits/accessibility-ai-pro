ALTER TABLE audit_jobs 
ADD COLUMN IF NOT EXISTS progress_log jsonb DEFAULT '[]'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE audit_jobs;
