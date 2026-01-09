-- Create cleaning schedule table
CREATE TABLE public.cleaning_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL DEFAULT '2026-01-12',
  interval_days INTEGER NOT NULL DEFAULT 5,
  tasks TEXT[] DEFAULT ARRAY['Flush gutters', 'Sweep farm', 'Remove cobwebs'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cleaning completion records
CREATE TABLE public.cleaning_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaning_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cleaning_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_records ENABLE ROW LEVEL SECURITY;

-- RLS for cleaning_schedules
CREATE POLICY "Anyone authenticated can view cleaning schedules" 
ON public.cleaning_schedules 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage cleaning schedules" 
ON public.cleaning_schedules 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- RLS for cleaning_records
CREATE POLICY "Anyone authenticated can view cleaning records" 
ON public.cleaning_records 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create cleaning records" 
ON public.cleaning_records 
FOR INSERT 
WITH CHECK (auth.uid() = completed_by);

CREATE POLICY "Only admins can delete cleaning records" 
ON public.cleaning_records 
FOR DELETE 
USING (is_admin());

-- Insert default schedule
INSERT INTO public.cleaning_schedules (start_date, interval_days)
VALUES ('2026-01-12', 5);