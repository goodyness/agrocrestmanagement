
-- ============ ALTER existing ============
ALTER TABLE public.livestock_batches ADD COLUMN IF NOT EXISTS admin_contribution NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.partner_batches ADD COLUMN IF NOT EXISTS partner_contribution NUMERIC NOT NULL DEFAULT 0;

-- ============ partner_bank_details ============
CREATE TABLE IF NOT EXISTS public.partner_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_bank_details TO authenticated;
GRANT ALL ON public.partner_bank_details TO service_role;
ALTER TABLE public.partner_bank_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partner manages own bank" ON public.partner_bank_details FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR is_admin()) WITH CHECK (profile_id = auth.uid() OR is_admin());
CREATE TRIGGER trg_partner_bank_updated BEFORE UPDATE ON public.partner_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ batch_acceptances ============
CREATE TABLE IF NOT EXISTS public.batch_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','disputed')),
  accepted_budget NUMERIC,
  partner_contribution NUMERIC NOT NULL DEFAULT 0,
  admin_contribution_snapshot NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, partner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_acceptances TO authenticated;
GRANT ALL ON public.batch_acceptances TO service_role;
ALTER TABLE public.batch_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all acceptances" ON public.batch_acceptances FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Partner views own acceptances" ON public.batch_acceptances FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE profile_id = auth.uid()));
CREATE POLICY "Partner updates own acceptances" ON public.batch_acceptances FOR UPDATE TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE profile_id = auth.uid()));
CREATE TRIGGER trg_batch_acceptances_updated BEFORE UPDATE ON public.batch_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ batch_complaints ============
CREATE TABLE IF NOT EXISTS public.batch_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id UUID REFERENCES public.batch_acceptances(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  admin_response TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_complaints TO authenticated;
GRANT ALL ON public.batch_complaints TO service_role;
ALTER TABLE public.batch_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all complaints" ON public.batch_complaints FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Partner views own complaints" ON public.batch_complaints FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE profile_id = auth.uid()));
CREATE POLICY "Partner inserts own complaints" ON public.batch_complaints FOR INSERT TO authenticated
  WITH CHECK (partner_id IN (SELECT id FROM public.partners WHERE profile_id = auth.uid()));
CREATE TRIGGER trg_batch_complaints_updated BEFORE UPDATE ON public.batch_complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ batch_sales ============
CREATE TABLE IF NOT EXISTS public.batch_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  buyer TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_sales TO authenticated;
GRANT ALL ON public.batch_sales TO service_role;
ALTER TABLE public.batch_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all batch sales" ON public.batch_sales FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Partner views own batch sales" ON public.batch_sales FOR SELECT TO authenticated
  USING (partner_has_batch(batch_id));
CREATE POLICY "Partner inserts own batch sales" ON public.batch_sales FOR INSERT TO authenticated
  WITH CHECK (partner_has_batch(batch_id));
CREATE TRIGGER trg_batch_sales_updated BEFORE UPDATE ON public.batch_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ wallet_withdrawals ============
CREATE TABLE IF NOT EXISTS public.wallet_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.livestock_batches(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  request_note TEXT,
  admin_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_withdrawals TO authenticated;
GRANT ALL ON public.wallet_withdrawals TO service_role;
ALTER TABLE public.wallet_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all withdrawals" ON public.wallet_withdrawals FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Partner views own withdrawals" ON public.wallet_withdrawals FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
CREATE POLICY "Partner inserts own withdrawals" ON public.wallet_withdrawals FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND status = 'pending');
CREATE TRIGGER trg_wallet_withdrawals_updated BEFORE UPDATE ON public.wallet_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ batch_projections ============
CREATE TABLE IF NOT EXISTS public.batch_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL UNIQUE REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'per_bird' CHECK (mode IN ('per_bird','per_kg')),
  weeks_to_raise INTEGER,
  expected_price_per_bird NUMERIC,
  expected_price_per_kg NUMERIC,
  expected_avg_weight_kg NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_projections TO authenticated;
GRANT ALL ON public.batch_projections TO service_role;
ALTER TABLE public.batch_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all projections" ON public.batch_projections FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Partner views own projections" ON public.batch_projections FOR SELECT TO authenticated
  USING (partner_has_batch(batch_id));
CREATE TRIGGER trg_batch_projections_updated BEFORE UPDATE ON public.batch_projections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Helper RPCs ============
CREATE OR REPLACE FUNCTION public.get_batch_financials(_batch_id UUID)
RETURNS TABLE (
  budget NUMERIC,
  admin_contribution NUMERIC,
  partner_contribution NUMERIC,
  total_expenses NUMERIC,
  total_sales NUMERIC,
  gross_profit NUMERIC,
  remaining_budget NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_budget NUMERIC := 0;
  v_admin NUMERIC := 0;
  v_partner NUMERIC := 0;
  v_exp NUMERIC := 0;
  v_sales NUMERIC := 0;
BEGIN
  SELECT COALESCE(lb.budget,0), COALESCE(lb.admin_contribution,0)
    INTO v_budget, v_admin
    FROM livestock_batches lb WHERE lb.id = _batch_id;

  SELECT COALESCE(SUM(partner_contribution),0) INTO v_partner
    FROM partner_batches WHERE batch_id = _batch_id;

  SELECT COALESCE(SUM(amount),0) INTO v_exp
    FROM miscellaneous_expenses WHERE batch_id = _batch_id;

  SELECT COALESCE(SUM(total_amount),0) INTO v_sales
    FROM batch_sales WHERE batch_id = _batch_id;

  RETURN QUERY SELECT
    v_budget, v_admin, v_partner, v_exp, v_sales,
    (v_sales - v_exp)::NUMERIC AS gross_profit,
    (v_budget - v_exp)::NUMERIC AS remaining_budget;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_partner_wallet(_profile_id UUID)
RETURNS TABLE (
  total_earned NUMERIC,
  total_withdrawn NUMERIC,
  pending_withdrawals NUMERIC,
  available_balance NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_earned NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_pending NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    GREATEST(0, COALESCE(fs.gross_profit,0)) * COALESCE(pb.profit_share_percentage,0)/100.0
  ),0) INTO v_earned
  FROM partner_batches pb
  JOIN partners p ON p.id = pb.partner_id
  JOIN batch_acceptances ba ON ba.batch_id = pb.batch_id AND ba.partner_id = pb.partner_id AND ba.status = 'accepted'
  CROSS JOIN LATERAL public.get_batch_financials(pb.batch_id) fs
  WHERE p.profile_id = _profile_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid
    FROM wallet_withdrawals WHERE profile_id = _profile_id AND status IN ('approved','paid');

  SELECT COALESCE(SUM(amount),0) INTO v_pending
    FROM wallet_withdrawals WHERE profile_id = _profile_id AND status = 'pending';

  RETURN QUERY SELECT v_earned, v_paid, v_pending, (v_earned - v_paid - v_pending)::NUMERIC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_batch_financials(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_wallet(UUID) TO authenticated;
