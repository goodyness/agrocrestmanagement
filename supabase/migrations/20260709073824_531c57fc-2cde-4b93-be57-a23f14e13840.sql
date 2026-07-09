-- 1. Availability audit log
CREATE TABLE IF NOT EXISTS public.batch_availability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_role TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.batch_availability_events TO authenticated;
GRANT ALL ON public.batch_availability_events TO service_role;

ALTER TABLE public.batch_availability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on availability events" ON public.batch_availability_events;
CREATE POLICY "Admin full access on availability events"
  ON public.batch_availability_events FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Partners view own batch availability events" ON public.batch_availability_events;
CREATE POLICY "Partners view own batch availability events"
  ON public.batch_availability_events FOR SELECT
  USING (public.partner_has_batch(batch_id));

DROP POLICY IF EXISTS "Authenticated insert their own availability events" ON public.batch_availability_events;
CREATE POLICY "Authenticated insert their own availability events"
  ON public.batch_availability_events FOR INSERT
  WITH CHECK (auth.uid() = changed_by);

CREATE INDEX IF NOT EXISTS idx_bae_batch ON public.batch_availability_events(batch_id, created_at DESC);

-- 2. Overdue notification stamp
ALTER TABLE public.livestock_batches
  ADD COLUMN IF NOT EXISTS last_overdue_notified_at TIMESTAMPTZ;

-- 3. Secure confirm-stock RPC (partner or admin)
CREATE OR REPLACE FUNCTION public.confirm_stock_available(_batch_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_allowed BOOLEAN := false;
  v_batch RECORD;
  v_new_cost NUMERIC;
  v_new_source TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

  IF v_role = 'admin' THEN
    v_allowed := true;
  ELSIF v_role = 'partner' AND public.partner_has_batch(_batch_id) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to confirm this batch';
  END IF;

  SELECT * INTO v_batch FROM public.livestock_batches WHERE id = _batch_id FOR UPDATE;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF COALESCE(v_batch.availability_status, 'available') = 'available' THEN
    RAISE EXCEPTION 'Batch is already marked as available';
  END IF;

  v_new_cost := COALESCE(NULLIF(v_batch.cost_per_unit, 0), COALESCE(v_batch.expected_cost_per_unit, 0));
  v_new_source := COALESCE(NULLIF(v_batch.source, ''), v_batch.expected_source);

  UPDATE public.livestock_batches SET
    availability_status = 'available',
    date_acquired = CURRENT_DATE,
    age_weeks = 0,
    availability_confirmed_at = now(),
    availability_confirmed_by = auth.uid(),
    cost_per_unit = v_new_cost,
    total_cost = COALESCE(v_new_cost, 0) * COALESCE(v_batch.quantity, 0),
    source = v_new_source,
    updated_at = now()
  WHERE id = _batch_id;

  INSERT INTO public.batch_availability_events
    (batch_id, event_type, from_status, to_status, changed_by, changed_by_role, notes, metadata)
  VALUES (
    _batch_id, 'marked_available', 'pending', 'available', auth.uid(), v_role,
    'Stock confirmed on hand',
    jsonb_build_object(
      'applied_cost_per_unit', v_new_cost,
      'applied_source', v_new_source,
      'expected_arrival_date', v_batch.expected_arrival_date
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_stock_available(UUID) TO authenticated;