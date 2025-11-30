-- Create feed consumption table for daily tracking
CREATE TABLE public.feed_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_type_id UUID NOT NULL REFERENCES public.feed_types(id) ON DELETE CASCADE,
  livestock_category_id UUID NOT NULL REFERENCES public.livestock_categories(id) ON DELETE CASCADE,
  quantity_used NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feed_consumption ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed consumption
CREATE POLICY "Anyone authenticated can view feed consumption"
  ON public.feed_consumption
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create feed consumption records"
  ON public.feed_consumption
  FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Only admins can update/delete feed consumption"
  ON public.feed_consumption
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create trigger to update feed inventory when consumption is recorded
CREATE OR REPLACE FUNCTION public.update_feed_inventory_on_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE feed_inventory
  SET quantity_in_stock = quantity_in_stock - NEW.quantity_used,
      updated_at = NOW()
  WHERE feed_type_id = NEW.feed_type_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_feed_consumption_recorded
  AFTER INSERT ON public.feed_consumption
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feed_inventory_on_consumption();

-- Function to check if any admin exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE role = 'admin'
  );
END;
$$;