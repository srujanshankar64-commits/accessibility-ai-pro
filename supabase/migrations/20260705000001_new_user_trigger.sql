-- Create trigger to auto-create settings row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.settings (
    user_id, 
    plan, 
    audits_used, 
    audits_limit,
    agency_name,
    brand_color
  )
  VALUES (
    new.id, 
    'free', 
    0, 
    3,
    '',
    '#6E56CF'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill existing users who have no settings row
INSERT INTO public.settings (user_id, plan, audits_used, audits_limit, brand_color)
SELECT id, 'free', 0, 3, '#6E56CF'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.settings WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;
