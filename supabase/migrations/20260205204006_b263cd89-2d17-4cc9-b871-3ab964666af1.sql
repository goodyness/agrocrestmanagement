-- Add delivery_status column to sales_records
ALTER TABLE public.sales_records 
ADD COLUMN delivery_status text NOT NULL DEFAULT 'delivered';

-- Add constraint to ensure valid values
ALTER TABLE public.sales_records 
ADD CONSTRAINT sales_records_delivery_status_check 
CHECK (delivery_status IN ('preorder', 'delivered'));

-- Add index for filtering by delivery status
CREATE INDEX idx_sales_records_delivery_status ON public.sales_records(delivery_status);