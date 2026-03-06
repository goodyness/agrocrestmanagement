
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  gross_salary numeric NOT NULL DEFAULT 0,
  total_advances numeric NOT NULL DEFAULT 0,
  net_paid numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  paid_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(worker_id, month, year)
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view own payments" ON public.salary_payments
  FOR SELECT USING (worker_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage payments" ON public.salary_payments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
