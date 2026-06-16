-- Fix audit_jobs table permissions for PostgREST API access
-- Run this after project restart to ensure API can see the table

-- Grant usage on public schema to API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant all permissions on audit_jobs table
GRANT ALL ON TABLE public.audit_jobs TO anon, authenticated;

-- Ensure RLS is enabled (already in previous migration, but confirming)
ALTER TABLE public.audit_jobs ENABLE ROW LEVEL SECURITY;

-- Verify grants (for debugging - can be removed after)
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'audit_jobs';
