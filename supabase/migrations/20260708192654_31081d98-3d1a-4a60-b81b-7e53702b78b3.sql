
ALTER TABLE public.livestock_batches
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS expected_source TEXT,
  ADD COLUMN IF NOT EXISTS expected_cost_per_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS expected_arrival_date DATE,
  ADD COLUMN IF NOT EXISTS availability_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.livestock_batches
  DROP CONSTRAINT IF EXISTS livestock_batches_availability_status_check;
ALTER TABLE public.livestock_batches
  ADD CONSTRAINT livestock_batches_availability_status_check
  CHECK (availability_status IN ('available','pending'));

CREATE OR REPLACE FUNCTION public.increment_batch_ages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE livestock_batches
  SET age_weeks = COALESCE(age_weeks, 0) + 1,
      updated_at = NOW()
  WHERE is_active = true
    AND COALESCE(availability_status, 'available') = 'available';
END;
$function$;
