-- Daily layer feed intake with per-entry bag pricing (25kg default = 1 bag)
CREATE TABLE IF NOT EXISTS public.batch_feed_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  kg_consumed numeric NOT NULL DEFAULT 0 CHECK (kg_consumed >= 0),
  bag_size_kg numeric NOT NULL DEFAULT 25 CHECK (bag_size_kg > 0),
  price_per_bag numeric NOT NULL DEFAULT 0 CHECK (price_per_bag >= 0),
  feed_cost numeric NOT NULL DEFAULT 0,
  birds_at_record integer,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batch_feed_intake_batch_date_key UNIQUE (batch_id, date)
);
CREATE INDEX IF NOT EXISTS idx_batch_feed_intake_batch ON public.batch_feed_intake (batch_id, date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_feed_intake TO authenticated;
GRANT ALL ON public.batch_feed_intake TO service_role;

ALTER TABLE public.batch_feed_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage batch feed intake"
  ON public.batch_feed_intake FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Authenticated can view batch feed intake"
  ON public.batch_feed_intake FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners manage their batch feed intake"
  ON public.batch_feed_intake FOR ALL
  TO authenticated
  USING (partner_has_batch(batch_id))
  WITH CHECK (partner_has_batch(batch_id));

-- Keep feed_cost = kg / bag_size * price_per_bag consistent
CREATE OR REPLACE FUNCTION public.set_feed_intake_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.feed_cost := ROUND((NEW.kg_consumed / NEW.bag_size_kg) * NEW.price_per_bag, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_intake_cost ON public.batch_feed_intake;
CREATE TRIGGER trg_feed_intake_cost
BEFORE INSERT OR UPDATE OF kg_consumed, bag_size_kg, price_per_bag ON public.batch_feed_intake
FOR EACH ROW EXECUTE FUNCTION public.set_feed_intake_cost();

DROP TRIGGER IF EXISTS trg_feed_intake_updated ON public.batch_feed_intake;
CREATE TRIGGER trg_feed_intake_updated
BEFORE UPDATE ON public.batch_feed_intake
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Immutable audit trail for feed intake changes
DROP TRIGGER IF EXISTS audit_batch_feed_intake ON public.batch_feed_intake;
CREATE TRIGGER audit_batch_feed_intake
AFTER INSERT OR UPDATE OR DELETE ON public.batch_feed_intake
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();
