ALTER TABLE public.daily_production
  ADD COLUMN IF NOT EXISTS egg_type text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS crack_reason text;

ALTER TABLE public.daily_production
  ADD CONSTRAINT daily_production_egg_type_check CHECK (egg_type IN ('good','cracked'));

CREATE INDEX IF NOT EXISTS idx_daily_production_egg_type ON public.daily_production(egg_type, date);