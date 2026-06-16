CREATE TABLE public.audit_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_jobs TO authenticated;
GRANT ALL ON public.audit_jobs TO service_role;

ALTER TABLE public.audit_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own audit_jobs" ON public.audit_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX audit_jobs_user_id_created_at_idx ON public.audit_jobs (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_audit_jobs_updated_at
  BEFORE UPDATE ON public.audit_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();