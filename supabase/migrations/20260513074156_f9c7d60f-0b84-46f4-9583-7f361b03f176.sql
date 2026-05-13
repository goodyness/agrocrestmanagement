CREATE TABLE public.profit_monitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  batch_id UUID,
  branch_id UUID,
  livestock_category_id UUID,
  bird_count INTEGER NOT NULL DEFAULT 0,
  bags_per_day NUMERIC NOT NULL DEFAULT 0,
  price_per_bag NUMERIC NOT NULL DEFAULT 0,
  fallback_price_per_crate NUMERIC NOT NULL DEFAULT 0,
  fallback_price_per_piece NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  baseline_crates INTEGER NOT NULL DEFAULT 0,
  baseline_pieces INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profit_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view profit monitors"
ON public.profit_monitors FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage profit monitors"
ON public.profit_monitors FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE TRIGGER update_profit_monitors_updated_at
BEFORE UPDATE ON public.profit_monitors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();