-- Create rate_limits table for per-user per-endpoint rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint, window_start)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint, window_start DESC);

-- Create function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests integer,
  p_window_hours integer DEFAULT 1
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_current_count integer;
  v_window_start timestamptz;
  v_result jsonb;
BEGIN
  -- Get or create the rate limit record for the current window
  SELECT request_count, window_start INTO v_current_count, v_window_start
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start > NOW() - (p_window_hours || ' hours')::interval
  FOR UPDATE;

  -- If no record exists or window expired, create new one
  IF v_current_count IS NULL OR v_window_start IS NULL OR v_window_start < NOW() - (p_window_hours || ' hours')::interval THEN
    INSERT INTO public.rate_limits (user_id, endpoint, request_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, NOW())
    ON CONFLICT (user_id, endpoint, window_start)
    DO UPDATE SET request_count = 1, updated_at = NOW();
    
    v_result := jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', NOW() + (p_window_hours || ' hours')::interval
    );
  ELSE
    -- Check if limit exceeded
    IF v_current_count >= p_max_requests THEN
      v_result := jsonb_build_object(
        'allowed', false,
        'remaining', 0,
        'reset_at', v_window_start + (p_window_hours || ' hours')::interval
      );
    ELSE
      -- Increment count
      UPDATE public.rate_limits
      SET request_count = request_count + 1,
          updated_at = NOW()
      WHERE user_id = p_user_id
        AND endpoint = p_endpoint
        AND window_start = v_window_start;
      
      v_result := jsonb_build_object(
        'allowed', true,
        'remaining', p_max_requests - v_current_count - 1,
        'reset_at', v_window_start + (p_window_hours || ' hours')::interval
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own rate limits" ON public.rate_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rate limits" ON public.rate_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits" ON public.rate_limits
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "Service role full access" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role');
