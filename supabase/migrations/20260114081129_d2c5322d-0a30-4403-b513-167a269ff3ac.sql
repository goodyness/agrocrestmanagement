-- Create branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Policies for branches
CREATE POLICY "Anyone authenticated can view branches"
  ON public.branches FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage branches"
  ON public.branches FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Insert default branches
INSERT INTO public.branches (name, location) VALUES
  ('Abeokuta', 'Abeokuta, Ogun State'),
  ('Ibadan', 'Ibadan, Oyo State'),
  ('Oyo', 'Oyo, Oyo State');

-- Add branch_id to profiles
ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to all operational tables
ALTER TABLE public.livestock_categories ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.livestock_census ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.mortality_records ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.daily_production ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.feed_types ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.feed_inventory ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.feed_consumption ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.feed_purchases ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.sales_records ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.vaccination_types ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.vaccination_records ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.vaccination_schedules ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.miscellaneous_expenses ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.admin_notes ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.cleaning_schedules ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.cleaning_records ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.low_stock_alerts ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.activity_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add image_url column to admin_notes for photo attachments
ALTER TABLE public.admin_notes ADD COLUMN image_url TEXT;

-- Update existing data to belong to Abeokuta branch
UPDATE public.livestock_categories SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.livestock_census SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.mortality_records SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.daily_production SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.feed_types SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.feed_inventory SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.feed_consumption SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.feed_purchases SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.sales_records SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.vaccination_types SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.vaccination_records SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.vaccination_schedules SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.miscellaneous_expenses SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.admin_notes SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.cleaning_schedules SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.cleaning_records SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.low_stock_alerts SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.activity_logs SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta');
UPDATE public.profiles SET branch_id = (SELECT id FROM public.branches WHERE name = 'Abeokuta') WHERE branch_id IS NULL;

-- Create storage bucket for note images
INSERT INTO storage.buckets (id, name, public) VALUES ('note-images', 'note-images', true);

-- Storage policies for note images
CREATE POLICY "Note images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'note-images');

CREATE POLICY "Authenticated users can upload note images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'note-images' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete note images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'note-images' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));