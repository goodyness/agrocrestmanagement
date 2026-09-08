ALTER TABLE public.livestock_batches
  ADD COLUMN IF NOT EXISTS production_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_closed_by uuid;

CREATE TABLE IF NOT EXISTS public.batch_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL UNIQUE REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  expense_note text,
  expenses_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  purchase_cost numeric NOT NULL DEFAULT 0,
  other_cost numeric NOT NULL DEFAULT 0,
  initial_birds integer NOT NULL DEFAULT 0,
  survived_birds integer NOT NULL DEFAULT 0,
  sale_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  sales_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_note text,
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.batch_closures TO authenticated;
GRANT ALL ON public.batch_closures TO service_role;

ALTER TABLE public.batch_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view closures" ON public.batch_closures
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Partners can view their batch closures" ON public.batch_closures
  FOR SELECT TO authenticated USING (public.partner_has_batch(batch_id));

CREATE POLICY "Admins can create closures" ON public.batch_closures
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Partners can create closures for their batches" ON public.batch_closures
  FOR INSERT TO authenticated WITH CHECK (public.partner_has_batch(batch_id));

CREATE INDEX IF NOT EXISTS idx_batch_closures_batch ON public.batch_closures(batch_id);