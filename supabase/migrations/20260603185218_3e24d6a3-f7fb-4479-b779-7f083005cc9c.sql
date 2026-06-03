
-- =========================================================
-- EQUIPMENT
-- =========================================================
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric DEFAULT 0,
  warranty_end date,
  location text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage equipment" ON public.equipment FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_equipment_branch ON public.equipment(branch_id);

-- =========================================================
-- MAINTENANCE LOGS
-- =========================================================
CREATE TABLE public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  service_type text NOT NULL,
  description text,
  cost numeric DEFAULT 0,
  performed_by text,
  next_due_date date,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view maintenance logs" ON public.maintenance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage maintenance logs" ON public.maintenance_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON public.maintenance_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_maintenance_equipment ON public.maintenance_logs(equipment_id);
CREATE INDEX idx_maintenance_branch_date ON public.maintenance_logs(branch_id, service_date DESC);

-- =========================================================
-- BIOSECURITY CHECKS
-- =========================================================
CREATE TABLE public.biosecurity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  check_type text NOT NULL,
  area text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text,
  status text NOT NULL DEFAULT 'passed',
  notes text,
  photo_url text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biosecurity_checks TO authenticated;
GRANT ALL ON public.biosecurity_checks TO service_role;
ALTER TABLE public.biosecurity_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view biosecurity" ON public.biosecurity_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can record biosecurity" ON public.biosecurity_checks FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by OR public.is_admin());
CREATE POLICY "Admins manage biosecurity" ON public.biosecurity_checks FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete biosecurity" ON public.biosecurity_checks FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER trg_biosecurity_updated BEFORE UPDATE ON public.biosecurity_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_biosecurity_branch_date ON public.biosecurity_checks(branch_id, check_date DESC);

-- =========================================================
-- FARM TASKS (assignment board)
-- =========================================================
CREATE TABLE public.farm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  category text,
  notes text,
  completed_at timestamptz,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_tasks TO authenticated;
GRANT ALL ON public.farm_tasks TO service_role;
ALTER TABLE public.farm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or all if admin" ON public.farm_tasks FOR SELECT TO authenticated USING (public.is_admin() OR assigned_to = auth.uid());
CREATE POLICY "Admins insert tasks" ON public.farm_tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins or assignee update tasks" ON public.farm_tasks FOR UPDATE TO authenticated USING (public.is_admin() OR assigned_to = auth.uid()) WITH CHECK (public.is_admin() OR assigned_to = auth.uid());
CREATE POLICY "Admins delete tasks" ON public.farm_tasks FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER trg_farm_tasks_updated BEFORE UPDATE ON public.farm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_farm_tasks_assigned ON public.farm_tasks(assigned_to, status);
CREATE INDEX idx_farm_tasks_branch ON public.farm_tasks(branch_id, due_date);
