
-- Livestock batches: main registration table for incoming livestock
CREATE TABLE public.livestock_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id),
  livestock_category_id UUID REFERENCES public.livestock_categories(id),
  species TEXT NOT NULL, -- chicken, pig, goat, cattle, other
  species_type TEXT, -- layer, broiler, noiler, landrace, boer, etc.
  stage TEXT, -- pullet, point_of_cage, point_of_lay, piglet, grower, kid, calf, etc.
  age_weeks INTEGER DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  date_acquired DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT, -- where acquired from
  cost_per_unit NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  has_started_laying BOOLEAN NOT NULL DEFAULT false,
  laying_start_date DATE,
  registered_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Care logs: daily records of what was administered
CREATE TABLE public.livestock_care_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.livestock_batches(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  care_date DATE NOT NULL DEFAULT CURRENT_DATE,
  care_type TEXT NOT NULL, -- vaccination, medication, feeding, supplement, deworming, vitamin, observation, other
  description TEXT NOT NULL,
  product_name TEXT,
  dosage TEXT,
  quantity_affected INTEGER,
  administered_by UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-built care schedule templates
CREATE TABLE public.livestock_care_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  species TEXT NOT NULL,
  species_type TEXT,
  stage TEXT,
  week_number INTEGER NOT NULL,
  care_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  product_name TEXT,
  dosage TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for livestock_batches
ALTER TABLE public.livestock_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view batches" ON public.livestock_batches FOR SELECT USING (true);
CREATE POLICY "Only admins can manage batches" ON public.livestock_batches FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- RLS for livestock_care_logs
ALTER TABLE public.livestock_care_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view care logs" ON public.livestock_care_logs FOR SELECT USING (true);
CREATE POLICY "Only admins can manage care logs" ON public.livestock_care_logs FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- RLS for livestock_care_templates
ALTER TABLE public.livestock_care_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view templates" ON public.livestock_care_templates FOR SELECT USING (true);
CREATE POLICY "Only admins can manage templates" ON public.livestock_care_templates FOR ALL USING (is_admin()) WITH CHECK (is_admin());
