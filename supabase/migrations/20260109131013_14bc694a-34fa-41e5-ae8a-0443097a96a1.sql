-- Create vaccination types table
CREATE TABLE public.vaccination_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  interval_weeks INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create vaccination records table
CREATE TABLE public.vaccination_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livestock_category_id UUID NOT NULL REFERENCES public.livestock_categories(id) ON DELETE CASCADE,
  vaccination_type_id UUID NOT NULL REFERENCES public.vaccination_types(id) ON DELETE CASCADE,
  administered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE NOT NULL,
  administered_by UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create vaccination schedules table for tracking upcoming
CREATE TABLE public.vaccination_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livestock_category_id UUID NOT NULL REFERENCES public.livestock_categories(id) ON DELETE CASCADE,
  vaccination_type_id UUID NOT NULL REFERENCES public.vaccination_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT '2026-01-12',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_reminder_sent TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(livestock_category_id, vaccination_type_id)
);

-- Enable RLS
ALTER TABLE public.vaccination_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_schedules ENABLE ROW LEVEL SECURITY;

-- Vaccination types policies
CREATE POLICY "Anyone authenticated can view vaccination types"
ON public.vaccination_types FOR SELECT USING (true);

CREATE POLICY "Only admins can manage vaccination types"
ON public.vaccination_types FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Vaccination records policies
CREATE POLICY "Anyone authenticated can view vaccination records"
ON public.vaccination_records FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create vaccination records"
ON public.vaccination_records FOR INSERT WITH CHECK (auth.uid() = administered_by);

CREATE POLICY "Only admins can update vaccination records"
ON public.vaccination_records FOR UPDATE USING (is_admin());

CREATE POLICY "Only admins can delete vaccination records"
ON public.vaccination_records FOR DELETE USING (is_admin());

-- Vaccination schedules policies
CREATE POLICY "Anyone authenticated can view vaccination schedules"
ON public.vaccination_schedules FOR SELECT USING (true);

CREATE POLICY "Only admins can manage vaccination schedules"
ON public.vaccination_schedules FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Insert default vaccination types
INSERT INTO public.vaccination_types (name, description, interval_weeks) VALUES
('Multivitamin', 'Multivitamin supplements for overall health', 3),
('Antibiotics', 'Antibiotic treatment for disease prevention', 6),
('Newcastle Disease', 'Vaccine for Newcastle disease prevention', 12),
('Infectious Bronchitis', 'Vaccine for bronchitis prevention', 16),
('Gumboro Disease', 'Vaccine for Gumboro disease prevention', 8);