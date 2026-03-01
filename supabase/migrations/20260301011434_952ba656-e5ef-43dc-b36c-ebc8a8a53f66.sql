
-- Worker reviews table
CREATE TABLE public.worker_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  review_month INTEGER NOT NULL CHECK (review_month BETWEEN 1 AND 12),
  review_year INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  review_text TEXT NOT NULL,
  salary_amount NUMERIC NOT NULL DEFAULT 0,
  salary_expense_id UUID REFERENCES public.miscellaneous_expenses(id),
  has_balance_debt BOOLEAN NOT NULL DEFAULT false,
  balance_debt_amount NUMERIC NOT NULL DEFAULT 0,
  has_equipment_debt BOOLEAN NOT NULL DEFAULT false,
  equipment_debt_amount NUMERIC NOT NULL DEFAULT 0,
  equipment_debt_description TEXT,
  total_debt NUMERIC NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, review_month, review_year)
);

ALTER TABLE public.worker_reviews ENABLE ROW LEVEL SECURITY;

-- Workers can view their own reviews
CREATE POLICY "Workers can view own reviews"
ON public.worker_reviews FOR SELECT
TO authenticated
USING (worker_id = auth.uid() OR is_admin());

-- Only admins can manage reviews
CREATE POLICY "Only admins can manage reviews"
ON public.worker_reviews FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
