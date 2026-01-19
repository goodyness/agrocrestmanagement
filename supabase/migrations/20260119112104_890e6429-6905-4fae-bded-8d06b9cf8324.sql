-- Create table for stock reconciliation periods
CREATE TABLE public.stock_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  opening_stock_crates INTEGER NOT NULL DEFAULT 0,
  opening_stock_pieces INTEGER NOT NULL DEFAULT 0,
  total_production_crates INTEGER NOT NULL DEFAULT 0,
  total_production_pieces INTEGER NOT NULL DEFAULT 0,
  total_sales_crates INTEGER NOT NULL DEFAULT 0,
  total_sales_pieces INTEGER NOT NULL DEFAULT 0,
  adjustment_crates INTEGER NOT NULL DEFAULT 0,
  adjustment_pieces INTEGER NOT NULL DEFAULT 0,
  closing_stock_crates INTEGER NOT NULL DEFAULT 0,
  closing_stock_pieces INTEGER NOT NULL DEFAULT 0,
  expected_closing_crates INTEGER NOT NULL DEFAULT 0,
  expected_closing_pieces INTEGER NOT NULL DEFAULT 0,
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'balanced', 'adjusted', 'unresolved')),
  notes TEXT,
  balanced_by UUID REFERENCES public.profiles(id),
  balanced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for adjustment entries (breakage, spoilage, etc.)
CREATE TABLE public.stock_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_id UUID NOT NULL REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('breakage', 'spoilage', 'given_away', 'theft', 'counting_error', 'other')),
  crates INTEGER NOT NULL DEFAULT 0,
  pieces INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_reconciliations
CREATE POLICY "Anyone authenticated can view stock reconciliations"
  ON public.stock_reconciliations FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage stock reconciliations"
  ON public.stock_reconciliations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS policies for stock_adjustments
CREATE POLICY "Anyone authenticated can view stock adjustments"
  ON public.stock_adjustments FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage stock adjustments"
  ON public.stock_adjustments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add updated_at trigger
CREATE TRIGGER update_stock_reconciliations_updated_at
  BEFORE UPDATE ON public.stock_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();