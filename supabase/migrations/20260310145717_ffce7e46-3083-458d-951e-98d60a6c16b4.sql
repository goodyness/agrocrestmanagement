
-- Add batch_id to miscellaneous_expenses so expenses can be linked to livestock batches
ALTER TABLE public.miscellaneous_expenses 
ADD COLUMN batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_misc_expenses_batch_id ON public.miscellaneous_expenses(batch_id);
