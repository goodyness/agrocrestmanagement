-- Stock baselines: snapshots of expected stock at a point in time
CREATE TABLE public.stock_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID,
  item_type TEXT NOT NULL, -- 'eggs' | 'livestock'
  batch_id UUID, -- nullable; set for livestock items
  -- Egg quantities
  crates INTEGER NOT NULL DEFAULT 0,
  pieces INTEGER NOT NULL DEFAULT 0,
  -- Livestock quantity
  animal_count INTEGER NOT NULL DEFAULT 0,
  baseline_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_baselines_lookup ON public.stock_baselines(item_type, branch_id, batch_id, baseline_at DESC);

ALTER TABLE public.stock_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view stock baselines"
  ON public.stock_baselines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage stock baselines"
  ON public.stock_baselines FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Physical recounts (reconciliation against expected)
CREATE TABLE public.stock_recounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID,
  item_type TEXT NOT NULL,
  batch_id UUID,
  baseline_id UUID,
  recount_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Actual physical count
  actual_crates INTEGER NOT NULL DEFAULT 0,
  actual_pieces INTEGER NOT NULL DEFAULT 0,
  actual_animal_count INTEGER NOT NULL DEFAULT 0,
  -- Snapshot of expected at recount time
  expected_crates INTEGER NOT NULL DEFAULT 0,
  expected_pieces INTEGER NOT NULL DEFAULT 0,
  expected_animal_count INTEGER NOT NULL DEFAULT 0,
  -- Variance (actual - expected), in pieces for eggs
  variance_pieces INTEGER NOT NULL DEFAULT 0,
  variance_animals INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_recounts_lookup ON public.stock_recounts(item_type, branch_id, batch_id, recount_at DESC);

ALTER TABLE public.stock_recounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view stock recounts"
  ON public.stock_recounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage stock recounts"
  ON public.stock_recounts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());