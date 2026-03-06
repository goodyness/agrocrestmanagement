
-- Worker salary settings table
CREATE TABLE public.worker_salary_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(worker_id)
);

-- Salary advances / collections table
CREATE TABLE public.salary_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

-- RLS policies for worker_salary_settings
CREATE POLICY "Admins can manage salary settings" ON public.worker_salary_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Workers can view own salary" ON public.worker_salary_settings FOR SELECT TO authenticated USING (worker_id = auth.uid() OR is_admin());

-- RLS policies for salary_advances
CREATE POLICY "Admins can manage advances" ON public.salary_advances FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Workers can view own advances" ON public.salary_advances FOR SELECT TO authenticated USING (worker_id = auth.uid() OR is_admin());
