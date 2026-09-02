CREATE TABLE public.batch_egg_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  crates INTEGER NOT NULL DEFAULT 0,
  pieces INTEGER NOT NULL DEFAULT 0,
  cracked_pieces INTEGER NOT NULL DEFAULT 0,
  birds_at_record INTEGER,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_egg_production TO authenticated;
GRANT ALL ON public.batch_egg_production TO service_role;

ALTER TABLE public.batch_egg_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage batch egg production"
ON public.batch_egg_production FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Partners manage their batch egg production"
ON public.batch_egg_production FOR ALL TO authenticated
USING (public.partner_has_batch(batch_id)) WITH CHECK (public.partner_has_batch(batch_id));

CREATE POLICY "Authenticated can view batch egg production"
ON public.batch_egg_production FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER trg_batch_egg_production_updated
BEFORE UPDATE ON public.batch_egg_production
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_batch_egg_production_batch_date ON public.batch_egg_production (batch_id, date DESC);

ALTER TABLE public.livestock_batches
  ADD COLUMN IF NOT EXISTS bird_count_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bird_count_confirmed_by UUID;