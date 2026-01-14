-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create admin notes table
CREATE TABLE public.admin_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone authenticated can view admin notes"
ON public.admin_notes FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage admin notes"
ON public.admin_notes FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_admin_notes_updated_at
BEFORE UPDATE ON public.admin_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();