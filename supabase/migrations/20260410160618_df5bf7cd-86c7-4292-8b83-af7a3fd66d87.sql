
-- Clinic admissions table
CREATE TABLE public.clinic_admissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_type TEXT NOT NULL,
  category TEXT NOT NULL,
  age_weeks INTEGER NOT NULL DEFAULT 0,
  condition TEXT,
  symptoms TEXT,
  severity TEXT NOT NULL DEFAULT 'moderate',
  status TEXT NOT NULL DEFAULT 'admitted',
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  discharge_date DATE,
  death_date DATE,
  cause_of_death TEXT,
  discharge_notes TEXT,
  batch_id UUID REFERENCES public.livestock_batches(id),
  branch_id UUID REFERENCES public.branches(id),
  admitted_by UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view clinic admissions"
  ON public.clinic_admissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage clinic admissions"
  ON public.clinic_admissions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Clinic treatments table
CREATE TABLE public.clinic_treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admission_id UUID NOT NULL REFERENCES public.clinic_admissions(id) ON DELETE CASCADE,
  treatment_description TEXT NOT NULL,
  medication TEXT,
  dosage TEXT,
  administered_by UUID NOT NULL REFERENCES public.profiles(id),
  treatment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view clinic treatments"
  ON public.clinic_treatments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage clinic treatments"
  ON public.clinic_treatments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Clinic observations table
CREATE TABLE public.clinic_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admission_id UUID NOT NULL REFERENCES public.clinic_admissions(id) ON DELETE CASCADE,
  observation TEXT NOT NULL,
  observed_by UUID NOT NULL REFERENCES public.profiles(id),
  observation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view clinic observations"
  ON public.clinic_observations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage clinic observations"
  ON public.clinic_observations FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Triggers for updated_at
CREATE TRIGGER update_clinic_admissions_updated_at
  BEFORE UPDATE ON public.clinic_admissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
