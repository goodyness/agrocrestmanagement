
-- Create a function to atomically increment batch ages
CREATE OR REPLACE FUNCTION public.increment_batch_ages()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE livestock_batches
  SET age_weeks = COALESCE(age_weeks, 0) + 1,
      updated_at = NOW()
  WHERE is_active = true;
END;
$$;
