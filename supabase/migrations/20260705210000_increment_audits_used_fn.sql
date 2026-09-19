-- Atomic function to increment audits_used without race condition
CREATE OR REPLACE FUNCTION increment_audits_used(user_id uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE settings SET audits_used = audits_used + 1 WHERE user_id = $1;
$$;
