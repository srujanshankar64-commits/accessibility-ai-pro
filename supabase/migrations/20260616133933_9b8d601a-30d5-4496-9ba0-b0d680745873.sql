
ALTER TABLE public.audit_jobs ADD COLUMN IF NOT EXISTS progress_log jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.audit_jobs REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_jobs';
  END IF;
END $$;
