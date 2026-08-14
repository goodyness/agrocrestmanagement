
-- 1. Link general sales records to batches
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_records_batch ON public.sales_records(batch_id);
ALTER TABLE public.batch_sales ADD COLUMN IF NOT EXISTS sales_record_id uuid REFERENCES public.sales_records(id) ON DELETE SET NULL;
ALTER TABLE public.batch_sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.batch_sales ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.batch_sales ADD COLUMN IF NOT EXISTS unit text DEFAULT 'bird';
ALTER TABLE public.batch_sales ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid';
ALTER TABLE public.batch_sales ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

-- 2. Weekly FCR / feeding performance records per batch
CREATE TABLE IF NOT EXISTS public.batch_fcr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  week_number integer,
  animal_type text NOT NULL,
  sample_size integer NOT NULL,
  avg_weight_g numeric NOT NULL,
  feed_consumed_kg numeric NOT NULL,
  feed_type_id uuid REFERENCES public.feed_types(id) ON DELETE SET NULL,
  live_count integer,
  weight_gain_kg numeric,
  fcr numeric,
  observation text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batch_fcr_batch ON public.batch_fcr_records(batch_id, record_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_fcr_records TO authenticated;
GRANT ALL ON public.batch_fcr_records TO service_role;
ALTER TABLE public.batch_fcr_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage FCR records" ON public.batch_fcr_records
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Partners manage FCR for their batches" ON public.batch_fcr_records
  FOR ALL TO authenticated USING (public.partner_has_batch(batch_id)) WITH CHECK (public.partner_has_batch(batch_id));
CREATE POLICY "Authenticated can view FCR records" ON public.batch_fcr_records
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_batch_fcr_updated BEFORE UPDATE ON public.batch_fcr_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Robust batch quantity recalculation from mortality
CREATE OR REPLACE FUNCTION public.recalc_batch_quantity(_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _batch_id IS NULL THEN RETURN; END IF;
  UPDATE public.livestock_batches b
  SET current_quantity = GREATEST(
        COALESCE(b.quantity, 0) - COALESCE((
          SELECT SUM(m.quantity_dead) FROM public.mortality_records m WHERE m.batch_id = b.id
        ), 0), 0),
      updated_at = now()
  WHERE b.id = _batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_batch_on_mortality()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_batch_quantity(OLD.batch_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_batch_quantity(NEW.batch_id);
  IF TG_OP = 'UPDATE' AND OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN
    PERFORM public.recalc_batch_quantity(OLD.batch_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_batch_on_mortality ON public.mortality_records;
CREATE TRIGGER trigger_update_batch_on_mortality
AFTER INSERT OR UPDATE OR DELETE ON public.mortality_records
FOR EACH ROW EXECUTE FUNCTION public.update_batch_on_mortality();

-- 4. Backfill any drifted batch quantities
UPDATE public.livestock_batches b
SET current_quantity = GREATEST(COALESCE(b.quantity,0) - COALESCE((
      SELECT SUM(m.quantity_dead) FROM public.mortality_records m WHERE m.batch_id = b.id), 0), 0)
WHERE b.current_quantity IS DISTINCT FROM GREATEST(COALESCE(b.quantity,0) - COALESCE((
      SELECT SUM(m.quantity_dead) FROM public.mortality_records m WHERE m.batch_id = b.id), 0), 0);
