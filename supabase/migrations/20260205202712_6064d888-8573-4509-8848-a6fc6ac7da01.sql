-- Add payment tracking columns to sales_records
ALTER TABLE public.sales_records 
ADD COLUMN payment_status text NOT NULL DEFAULT 'pending',
ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0;

-- Add check constraint for valid payment statuses
ALTER TABLE public.sales_records 
ADD CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'paid', 'partial'));