-- Create audit_jobs table for async audit processing
CREATE TABLE IF NOT EXISTS audit_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_step TEXT,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_jobs_user_id ON audit_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_created_at ON audit_jobs(created_at);

-- Enable RLS
ALTER TABLE audit_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own jobs
CREATE POLICY "Users can view own audit jobs"
  ON audit_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit jobs"
  ON audit_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audit jobs"
  ON audit_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audit_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER audit_jobs_updated_at_trigger
  BEFORE UPDATE ON audit_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_jobs_updated_at();

-- Function to delete old completed/failed jobs (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_audit_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_jobs
  WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
