
-- 1. Audit trail table
CREATE TABLE public.audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_trail TO authenticated;
GRANT ALL ON public.audit_trail TO service_role;

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit trail"
ON public.audit_trail FOR SELECT TO authenticated
USING (is_admin());

CREATE POLICY "System can insert audit entries"
ON public.audit_trail FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_audit_trail_table_record ON public.audit_trail(table_name, record_id);
CREATE INDEX idx_audit_trail_created_at ON public.audit_trail(created_at DESC);
CREATE INDEX idx_audit_trail_branch ON public.audit_trail(branch_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_record_id uuid;
  v_branch_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_record_id := OLD.id;
    v_branch_id := COALESCE((to_jsonb(OLD)->>'branch_id')::uuid, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_branch_id := COALESCE((to_jsonb(NEW)->>'branch_id')::uuid, NULL);
  ELSE
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_branch_id := COALESCE((to_jsonb(NEW)->>'branch_id')::uuid, NULL);
  END IF;

  INSERT INTO public.audit_trail (
    table_name, record_id, operation, before_data, after_data, changed_by, branch_id
  ) VALUES (
    TG_TABLE_NAME, v_record_id, TG_OP, v_before, v_after, auth.uid(), v_branch_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_stock_baselines ON public.stock_baselines;
CREATE TRIGGER audit_stock_baselines
AFTER INSERT OR UPDATE OR DELETE ON public.stock_baselines
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_daily_production ON public.daily_production;
CREATE TRIGGER audit_daily_production
AFTER INSERT OR UPDATE OR DELETE ON public.daily_production
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_sales_records ON public.sales_records;
CREATE TRIGGER audit_sales_records
AFTER INSERT OR UPDATE OR DELETE ON public.sales_records
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_mortality_records ON public.mortality_records;
CREATE TRIGGER audit_mortality_records
AFTER INSERT OR UPDATE OR DELETE ON public.mortality_records
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- 2. Stock drift checks (nightly job results)
CREATE TABLE public.stock_drift_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid,
  branch_name text,
  item_type text NOT NULL DEFAULT 'eggs',
  expected_pieces integer NOT NULL DEFAULT 0,
  drift_pieces integer NOT NULL DEFAULT 0,
  threshold_pieces integer NOT NULL DEFAULT 30,
  flagged boolean NOT NULL DEFAULT false,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.stock_drift_checks TO authenticated;
GRANT ALL ON public.stock_drift_checks TO service_role;

ALTER TABLE public.stock_drift_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view drift checks"
ON public.stock_drift_checks FOR SELECT TO authenticated
USING (is_admin());

CREATE POLICY "System can insert drift checks"
ON public.stock_drift_checks FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_drift_run_at ON public.stock_drift_checks(run_at DESC);
CREATE INDEX idx_drift_branch ON public.stock_drift_checks(branch_id, run_at DESC);
CREATE INDEX idx_drift_flagged ON public.stock_drift_checks(flagged, run_at DESC);
