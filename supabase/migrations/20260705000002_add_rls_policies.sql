-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.settings;

-- Create policy to allow users to view their own settings
CREATE POLICY "Users can view own settings"
  ON public.settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to update ONLY safe columns (not plan or audits_used)
CREATE POLICY "Users can update safe columns"
  ON public.settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    -- Prevent changing plan or audits_used
    (plan IS NULL OR plan = (SELECT plan FROM public.settings WHERE user_id = auth.uid())) AND
    (audits_used IS NULL OR audits_used = (SELECT audits_used FROM public.settings WHERE user_id = auth.uid())) AND
    (audits_limit IS NULL OR audits_limit = (SELECT audits_limit FROM public.settings WHERE user_id = auth.uid()))
  );

-- Create policy to allow users to insert their own settings (for new user trigger)
CREATE POLICY "Users can insert own settings"
  ON public.settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
