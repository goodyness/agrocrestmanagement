CREATE TABLE public.batch_egg_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  price_per_crate NUMERIC NOT NULL CHECK (price_per_crate >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_egg_prices TO authenticated;
GRANT ALL ON public.batch_egg_prices TO service_role;

ALTER TABLE public.batch_egg_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage egg prices" ON public.batch_egg_prices
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Partners view their batch egg prices" ON public.batch_egg_prices
  FOR SELECT TO authenticated USING (public.partner_has_batch(batch_id));

CREATE POLICY "Partners add their batch egg prices" ON public.batch_egg_prices
  FOR INSERT TO authenticated WITH CHECK (public.partner_has_batch(batch_id));

CREATE TRIGGER trg_batch_egg_prices_updated
  BEFORE UPDATE ON public.batch_egg_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_batch_egg_prices_batch ON public.batch_egg_prices(batch_id, effective_from DESC);

ALTER TABLE public.batch_egg_production
  ADD COLUMN IF NOT EXISTS price_per_crate NUMERIC,
  ADD COLUMN IF NOT EXISTS egg_value NUMERIC;