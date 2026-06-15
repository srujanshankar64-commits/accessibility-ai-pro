-- Add auto re-audits and score tracking
ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS last_reaudited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_reaudit_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reaudit_frequency_days INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS previous_score INT,
ADD COLUMN IF NOT EXISTS score_drop_threshold INT DEFAULT 10;

-- Create index for auto re-audit queries
CREATE INDEX IF NOT EXISTS idx_audits_auto_reaudit ON public.audits(auto_reaudit_enabled, last_reaudited_at) WHERE auto_reaudit_enabled = true;
