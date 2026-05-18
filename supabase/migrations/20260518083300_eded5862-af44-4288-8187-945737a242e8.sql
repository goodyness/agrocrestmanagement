CREATE INDEX IF NOT EXISTS idx_daily_production_branch_date ON public.daily_production (branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_records_branch_date ON public.sales_records (branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_consumption_branch_date ON public.feed_consumption (branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_branch_date ON public.miscellaneous_expenses (branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mortality_records_branch_date ON public.mortality_records (branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_baselines_branch_at ON public.stock_baselines (branch_id, baseline_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id, created_at DESC);