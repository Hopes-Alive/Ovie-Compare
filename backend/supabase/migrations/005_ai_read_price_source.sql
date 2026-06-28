-- Allow ai_read as a price_history source for AI product read jobs
ALTER TABLE public.price_history
  DROP CONSTRAINT IF EXISTS price_history_source_check;

ALTER TABLE public.price_history
  ADD CONSTRAINT price_history_source_check
  CHECK (source IN ('scheduled', 'live_check', 'manual', 'ai_read'));
