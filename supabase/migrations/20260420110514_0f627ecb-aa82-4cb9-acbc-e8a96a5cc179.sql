-- 1) Add columns to livestock_care_logs for grouping into treatment courses + withdrawal
ALTER TABLE public.livestock_care_logs
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS course_start_date date,
  ADD COLUMN IF NOT EXISTS course_end_date date,
  ADD COLUMN IF NOT EXISTS course_day_number integer,
  ADD COLUMN IF NOT EXISTS course_total_days integer,
  ADD COLUMN IF NOT EXISTS withdrawal_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_end_date date,
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_care_logs_course ON public.livestock_care_logs(course_id);
CREATE INDEX IF NOT EXISTS idx_care_logs_batch_date ON public.livestock_care_logs(batch_id, care_date);
CREATE INDEX IF NOT EXISTS idx_care_logs_withdrawal ON public.livestock_care_logs(batch_id, withdrawal_end_date);

-- 2) Care log templates (user-saved, per-farm) — distinct from existing schedule templates
CREATE TABLE IF NOT EXISTS public.care_log_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  care_type text NOT NULL,
  description text,
  product_name text,
  dosage text,
  duration_days integer DEFAULT 1,
  withdrawal_days integer DEFAULT 0,
  default_cost numeric DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.care_log_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view care log templates"
  ON public.care_log_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage care log templates"
  ON public.care_log_templates FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER update_care_log_templates_updated_at
  BEFORE UPDATE ON public.care_log_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();