-- Suppliers table to track feed vendors and other suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  supplier_type TEXT NOT NULL DEFAULT 'feed',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Supplier pricing history to track price changes over time
CREATE TABLE public.supplier_pricing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  feed_type_id UUID REFERENCES public.feed_types(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'bag',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customers table to track buyers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  customer_type TEXT NOT NULL DEFAULT 'regular',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customer purchase summary (derived from sales_records, but we'll track totals)
CREATE TABLE public.customer_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales_records(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;

-- Suppliers policies
CREATE POLICY "Anyone authenticated can view suppliers" 
ON public.suppliers FOR SELECT USING (true);

CREATE POLICY "Only admins can manage suppliers" 
ON public.suppliers FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Supplier pricing history policies
CREATE POLICY "Anyone authenticated can view supplier pricing" 
ON public.supplier_pricing_history FOR SELECT USING (true);

CREATE POLICY "Only admins can manage supplier pricing" 
ON public.supplier_pricing_history FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Customers policies
CREATE POLICY "Anyone authenticated can view customers" 
ON public.customers FOR SELECT USING (true);

CREATE POLICY "Anyone authenticated can create customers" 
ON public.customers FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can update/delete customers" 
ON public.customers FOR UPDATE USING (is_admin());

CREATE POLICY "Only admins can delete customers" 
ON public.customers FOR DELETE USING (is_admin());

-- Customer purchases policies
CREATE POLICY "Anyone authenticated can view customer purchases" 
ON public.customer_purchases FOR SELECT USING (true);

CREATE POLICY "Anyone authenticated can create customer purchases" 
ON public.customer_purchases FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can manage customer purchases" 
ON public.customer_purchases FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Add supplier_id to feed_purchases for linking purchases to suppliers
ALTER TABLE public.feed_purchases ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);

-- Add customer_id to sales_records for linking sales to customers
ALTER TABLE public.sales_records ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();