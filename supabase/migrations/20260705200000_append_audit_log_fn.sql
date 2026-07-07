-- Atomic function to append to progress_log without race condition
CREATE OR REPLACE FUNCTION append_audit_log(
  job_id uuid, 
  percent int, 
  step text, 
  log_entry text
) RETURNS void LANGUAGE sql AS $$
  UPDATE audit_jobs SET
    progress_percent = percent,
    current_step = step,
    progress_log = COALESCE(progress_log, '[]'::jsonb) || log_entry::jsonb
  WHERE id = job_id;
$$;
