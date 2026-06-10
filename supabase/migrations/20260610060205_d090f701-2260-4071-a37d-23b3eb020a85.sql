
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_partners_branch_id ON public.partners(branch_id);

-- Backfill batches missing a branch_id to Abeokuta (legacy data so it shows in intake)
UPDATE public.livestock_batches
SET branch_id = '0ef521f3-59d6-427f-9348-4c5bf0b3075a'
WHERE branch_id IS NULL;
