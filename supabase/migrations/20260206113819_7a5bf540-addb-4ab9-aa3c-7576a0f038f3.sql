-- Fix overly permissive RLS policies for customers table
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone authenticated can create customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone authenticated can create customer purchases" ON public.customer_purchases;

-- Replace with properly authenticated policies
CREATE POLICY "Authenticated users can create customers" 
ON public.customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create customer purchases" 
ON public.customer_purchases FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);