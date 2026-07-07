-- Monthly audit usage window.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS audit_period_start timestamptz NOT NULL DEFAULT now();

UPDATE public.settings
SET audit_period_start = now()
WHERE audit_period_start IS NULL;

-- Replace broad settings policies with explicit own-row policies.
DROP POLICY IF EXISTS "own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can update safe columns" ON public.settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.settings;

CREATE POLICY "Users can view own settings"
  ON public.settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS controls rows; column grants prevent client-side plan/usage tampering.
REVOKE INSERT, UPDATE ON public.settings FROM authenticated;
GRANT INSERT (
  user_id,
  agency_name,
  agency_logo_url,
  brand_color,
  gemini_api_key,
  logo_url,
  updated_at
) ON public.settings TO authenticated;

GRANT UPDATE (
  agency_name,
  agency_logo_url,
  brand_color,
  gemini_api_key,
  logo_url,
  updated_at
) ON public.settings TO authenticated;

-- Referral tables should not be globally readable/writable.
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can update own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can view own referral clicks" ON public.referral_clicks;
DROP POLICY IF EXISTS "Users can insert own referral clicks" ON public.referral_clicks;
DROP POLICY IF EXISTS "Users can view own referral signups" ON public.referral_signups;
DROP POLICY IF EXISTS "Users can insert own referral signups" ON public.referral_signups;

CREATE POLICY "Users can view own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals"
  ON public.referrals
  FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update own referrals"
  ON public.referrals
  FOR UPDATE
  USING (auth.uid() = referrer_id)
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referral clicks"
  ON public.referral_clicks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.id = referral_clicks.referral_id
        AND r.referrer_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own referral clicks"
  ON public.referral_clicks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.id = referral_clicks.referral_id
        AND r.referrer_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own referral signups"
  ON public.referral_signups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.id = referral_signups.referral_id
        AND r.referrer_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own referral signups"
  ON public.referral_signups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.id = referral_signups.referral_id
        AND r.referrer_id = auth.uid()
    )
  );
