-- Create feed_purchases table to track all purchases with history
CREATE TABLE public.feed_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_type_id UUID NOT NULL REFERENCES public.feed_types(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  purchased_by UUID NOT NULL REFERENCES public.profiles(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feed_purchases ENABLE ROW LEVEL SECURITY;

-- Policies for feed_purchases
CREATE POLICY "Anyone authenticated can view feed purchases" 
ON public.feed_purchases 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage feed purchases" 
ON public.feed_purchases 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Create low_stock_alerts table to track alerts
CREATE TABLE public.low_stock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_type_id UUID NOT NULL REFERENCES public.feed_types(id) ON DELETE CASCADE,
  threshold_quantity NUMERIC NOT NULL DEFAULT 50,
  threshold_unit TEXT NOT NULL DEFAULT 'kg',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_alert_sent TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for low_stock_alerts
CREATE POLICY "Anyone authenticated can view low stock alerts" 
ON public.low_stock_alerts 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage low stock alerts" 
ON public.low_stock_alerts 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Add trigger to update feed inventory when purchase is made
CREATE OR REPLACE FUNCTION public.update_feed_inventory_on_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Check if inventory record exists for this feed type
  IF EXISTS (SELECT 1 FROM feed_inventory WHERE feed_type_id = NEW.feed_type_id) THEN
    -- Update existing inventory
    UPDATE feed_inventory
    SET quantity_in_stock = quantity_in_stock + NEW.quantity,
        updated_at = NOW()
    WHERE feed_type_id = NEW.feed_type_id;
  ELSE
    -- Create new inventory record
    INSERT INTO feed_inventory (feed_type_id, quantity_in_stock, unit)
    VALUES (NEW.feed_type_id, NEW.quantity, NEW.unit);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_inventory_on_purchase
AFTER INSERT ON public.feed_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_feed_inventory_on_purchase();