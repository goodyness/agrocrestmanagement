
-- Daily Task Checklists table
CREATE TABLE public.daily_task_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.profiles(id),
  branch_id UUID REFERENCES public.branches(id),
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  task_name TEXT NOT NULL,
  task_period TEXT NOT NULL DEFAULT 'morning',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view checklists" ON public.daily_task_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Workers can manage own checklists" ON public.daily_task_checklists FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "Workers can update own checklists" ON public.daily_task_checklists FOR UPDATE TO authenticated USING (auth.uid() = worker_id OR is_admin());
CREATE POLICY "Admins can manage all checklists" ON public.daily_task_checklists FOR DELETE TO authenticated USING (is_admin());

-- Default task templates table
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_name TEXT NOT NULL,
  task_period TEXT NOT NULL DEFAULT 'morning',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view templates" ON public.task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.task_templates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Insert default task templates
INSERT INTO public.task_templates (task_name, task_period, sort_order) VALUES
  ('Check water supply', 'morning', 1),
  ('Feed the birds', 'morning', 2),
  ('Collect eggs', 'morning', 3),
  ('Clean feeders', 'morning', 4),
  ('Check for sick birds', 'morning', 5),
  ('Record mortality', 'morning', 6),
  ('Evening feeding', 'evening', 1),
  ('Collect remaining eggs', 'evening', 2),
  ('Lock up pens', 'evening', 3),
  ('Check water levels', 'evening', 4),
  ('General observation', 'evening', 5);

-- Veterinary Visit Logs table
CREATE TABLE public.vet_visit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.livestock_batches(id),
  branch_id UUID REFERENCES public.branches(id),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vet_name TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  treatment TEXT,
  prescription TEXT,
  follow_up_date DATE,
  cost NUMERIC DEFAULT 0,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vet_visit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view vet logs" ON public.vet_visit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage vet logs" ON public.vet_visit_logs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Add expiry_date to feed_purchases
ALTER TABLE public.feed_purchases ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Add expiry_date to feed_inventory
ALTER TABLE public.feed_inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
