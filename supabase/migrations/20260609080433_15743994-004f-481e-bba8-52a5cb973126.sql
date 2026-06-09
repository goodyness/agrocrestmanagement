
-- Add batch_id to production/vaccination/feed (nullable for backward compatibility)
ALTER TABLE public.daily_production
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL;
ALTER TABLE public.vaccination_records
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL;
ALTER TABLE public.feed_consumption
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_prod_batch ON public.daily_production(batch_id);
CREATE INDEX IF NOT EXISTS idx_vacc_batch ON public.vaccination_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_feed_consumption_batch ON public.feed_consumption(batch_id);

-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partners" ON public.partners
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Partner can view own row" ON public.partners
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Partner-Batches
CREATE TABLE public.partner_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  share_percentage numeric NOT NULL DEFAULT 50,
  investment_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, batch_id)
);
CREATE INDEX idx_partner_batches_partner ON public.partner_batches(partner_id);
CREATE INDEX idx_partner_batches_batch ON public.partner_batches(batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_batches TO authenticated;
GRANT ALL ON public.partner_batches TO service_role;
ALTER TABLE public.partner_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partner_batches" ON public.partner_batches
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Partner views own links" ON public.partner_batches
  FOR SELECT TO authenticated USING (
    partner_id IN (SELECT id FROM public.partners WHERE profile_id = auth.uid())
  );

CREATE TRIGGER trg_partner_batches_updated BEFORE UPDATE ON public.partner_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helpers
CREATE OR REPLACE FUNCTION public.is_partner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'partner')
$$;

CREATE OR REPLACE FUNCTION public.partner_has_batch(_batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM partner_batches pb
    JOIN partners p ON p.id = pb.partner_id
    WHERE p.profile_id = auth.uid() AND pb.batch_id = _batch_id
  )
$$;

-- Partner RLS additions
CREATE POLICY "Partners view linked batches" ON public.livestock_batches
  FOR SELECT TO authenticated USING (public.partner_has_batch(id));

CREATE POLICY "Partners view linked production" ON public.daily_production
  FOR SELECT TO authenticated USING (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));
CREATE POLICY "Partners insert linked production" ON public.daily_production
  FOR INSERT TO authenticated WITH CHECK (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));

CREATE POLICY "Partners view linked mortality" ON public.mortality_records
  FOR SELECT TO authenticated USING (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));
CREATE POLICY "Partners insert linked mortality" ON public.mortality_records
  FOR INSERT TO authenticated WITH CHECK (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));

CREATE POLICY "Partners view linked vacc" ON public.vaccination_records
  FOR SELECT TO authenticated USING (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));
CREATE POLICY "Partners insert linked vacc" ON public.vaccination_records
  FOR INSERT TO authenticated WITH CHECK (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));

CREATE POLICY "Partners view linked feed" ON public.feed_consumption
  FOR SELECT TO authenticated USING (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));
CREATE POLICY "Partners insert linked feed" ON public.feed_consumption
  FOR INSERT TO authenticated WITH CHECK (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));

CREATE POLICY "Partners view linked care" ON public.livestock_care_logs
  FOR SELECT TO authenticated USING (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));
CREATE POLICY "Partners insert linked care" ON public.livestock_care_logs
  FOR INSERT TO authenticated WITH CHECK (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));

CREATE POLICY "Partners view linked weights" ON public.batch_weight_records
  FOR SELECT TO authenticated USING (public.partner_has_batch(batch_id));
CREATE POLICY "Partners insert linked weights" ON public.batch_weight_records
  FOR INSERT TO authenticated WITH CHECK (public.partner_has_batch(batch_id));
